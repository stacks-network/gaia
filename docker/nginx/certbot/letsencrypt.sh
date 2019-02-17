#!/bin/bash
# with modifications: https://raw.githubusercontent.com/wmnnd/nginx-certbot/master/init-letsencrypt.sh

if [ ! -f "/tmp/dns_checked" ] || [ -f "/tmp/ssl_created" ]; then
  exit 1
fi

domains=${DOMAIN}
rsa_key_size=4096
root="/gaia/docker"
data_path="${root}/nginx/certbot"
webroot="/usr/share/nginx/html/certbot"
staging=${STAGING} # Set to 1 if you're testing your setup to avoid hitting request limits
cd $root

function get_acme_certs () {
  if [[ $1 != "0" ]]; then
    staging_arg="--staging";
  fi
  /opt/bin/docker-compose \
    --project-directory $root \
    -f ${root}/docker-compose.yaml \
    -f ${root}/docker-compose.certbot.yaml run \
    --rm \
    --entrypoint "\
      certbot certonly --webroot -w $webroot \
        $staging_arg \
        $domain_args \
        --register-unsafely-without-email \
        --rsa-key-size $rsa_key_size \
        --agree-tos \
        --force-renewal" \
    certbot
  echo

  echo "### Restarting nginx ..."
  # wait 2.5m for certs to show up
  COUNT=5
  SLEEP=10
  INCR=10
  CERT_PATH="$data_path/conf/live/$domains"

  for i in $(seq "$COUNT"); do
    if [ -e "$data_path/conf/live/$domains" ]; then
      if [ `ls $data_path/conf/live/$domains | wc -l` -gt 0 ];then
        if [ -L $data_path/conf/live/$domains/cert.pem -a \
             -L $data_path/conf/live/$domains/chain.pem -a \
             -L $data_path/conf/live/$domains/fullchain.pem -a \
             -L $data_path/conf/live/$domains/privkey.pem \
        ]; then
          /usr/bin/systemctl restart gaia-hub.service
          touch /tmp/ssl_created
          exit 0
        fi
      fi
    fi
    echo "Certs not written yet...sleeping for $SLEEP"
    sleep $SLEEP
    SLEEP=$((SLEEP + INCR))
  done
  /usr/bin/grep "STAGING=0" /etc/environment > /dev/null 2>&1
  IS_STAGING=$?
  if [ $IS_STAGING -eq 0 ]; then
    /usr/bin/sed -i -e 's/STAGING=0/STAGING=1/' /etc/environment
    /usr/bin/systemctl start reset-ssl-certs.service
    exit 0
  fi
  echo "Timed out. There was a problem creating the SSL certificates"
  exit 1
}

if [ ! -d "$data_path/conf" ]; then
  echo -e "### Creating conf dir: $data_path/conf ... "
  mkdir -p "$data_path/conf"
  echo
fi

if [ ! -f "$data_path/conf/options-ssl-nginx.conf" ]; then
  echo -e "### Downloading options-ssl-nginx.conf: $data_path/conf/options-ssl-nginx.conf ... "
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/options-ssl-nginx.conf \
    > "$data_path/conf/options-ssl-nginx.conf"
  echo
fi

if [ ! -f "$data_path/conf/ssl-dhparams.pem" ]; then
  echo -e "### Downloading ssl-dhparams.pem: $data_path/conf/ssl-dhparams.pem ... "
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/ssl-dhparams.pem \
    > "$data_path/conf/ssl-dhparams.pem"
  echo
fi

# wait 2.5m for nginx to serve index page
COUNT=5
SLEEP=10
INCR=10
for i in $(seq "$COUNT"); do
  curl -Ls localhost --insecure | grep "01000110110000011010001100001" > /dev/null 2>&1
  RETURN=$?
  if [[ "$RETURN" -eq "0" ]]; then
    break
  fi
  if [ \( "$i" -lt "$COUNT" \) -a \( "$RETURN" -ne "0" \) ]; then
      echo "Nginx not up yet. Sleeping for $SLEEP"
      sleep $SLEEP
      SLEEP=$((SLEEP + INCR))
  fi
  if [ \( "$i" -eq "$COUNT" \) -a \( "$RETURN" -ne "0" \) ]; then
    echo "NGINX never started correctly. exiting"
    exit 1
  fi
done

echo "### Deleting dummy certificate for $domains ..."
/opt/bin/docker-compose \
  --project-directory $root \
  -f ${root}/docker-compose.yaml \
  -f ${root}/docker-compose.certbot.yaml run \
  --rm \
  --entrypoint "\
    rm -Rf /etc/letsencrypt/live/$domains && \
    rm -Rf /etc/letsencrypt/archive/$domains && \
    rm -Rf /etc/letsencrypt/renewal/$domains.conf" \
  certbot
echo

echo "### Requesting Let's Encrypt certificate for $domains ..."
#Join $domains to -d args
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done


get_acme_certs $staging
