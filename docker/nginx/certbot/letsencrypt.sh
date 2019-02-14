#!/bin/bash
# with slight modifications: https://raw.githubusercontent.com/wmnnd/nginx-certbot/master/init-letsencrypt.sh


domains=${DOMAIN}
rsa_key_size=4096
root="/gaia/docker"
data_path="${root}/nginx/certbot"
webroot="/usr/share/nginx/html/certbot"
staging=${STAGING} # Set to 1 if you're testing your setup to avoid hitting request limits
cd $root


if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
  echo
fi
COUNT=10
SLEEP=5
INCR=5
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

# Enable staging mode if needed
if [[ $staging != "0" ]]; then
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
COUNT=10
SLEEP=5
INCR=5
CERT_PATH="$data_path/conf/live/$domains"

for i in $(seq "$COUNT"); do
  if [ -e "$data_path/conf/live/$domains" ]; then
    if [ `ls $data_path/conf/live/$domains | wc -l` -gt 0 ];then
      if [ -L $data_path/conf/live/$domains/cert.pem -a \
           -L $data_path/conf/live/$domains/chain.pem -a \
           -L $data_path/conf/live/$domains/fullchain.pem -a \
           -L $data_path/conf/live/$domains/privkey.pem \
      ]; then
        /opt/bin/docker-compose \
          --project-directory $root \
          -f ${root}/docker-compose.yaml \
          -f ${root}/docker-compose.certbot.yaml \
        stop nginx
        sleep 2;
        /opt/bin/docker-compose \
          --project-directory $root \
          -f ${root}/docker-compose.yaml \
          -f ${root}/docker-compose.certbot.yaml \
        start nginx
        touch /tmp/dns_checked
        exit 0
      fi
    fi
  fi
  echo "Certs not written yet...sleeping for $SLEEP"
  sleep $SLEEP
  SLEEP=$((SLEEP + INCR))
done
echo "Timed out. There was a problem creating the SSL certificates"
exit 2
