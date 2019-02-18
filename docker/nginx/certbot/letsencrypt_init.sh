#!/bin/bash
# with modifications: https://raw.githubusercontent.com/wmnnd/nginx-certbot/master/init-letsencrypt.sh


domains=${DOMAIN}
rsa_key_size=4096
root="/gaia/docker"
data_path="${root}/nginx/certbot"
webroot="/usr/share/nginx/html/certbot"
staging=${STAGING} # Set to 1 if you're testing your setup to avoid hitting request limits
cd $root


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

# wait 2.5m for certbot to come up
COUNT=5
SLEEP=10
INCR=10
for i in $(seq "$COUNT"); do
  /usr/bin/docker ps | grep docker_certbot_1 > /dev/null 2>&1
  RETURN=$?
  if [[ "$RETURN" -eq "0" ]]; then
    break
  fi
  if [ \( "$i" -lt "$COUNT" \) -a \( "$RETURN" -ne "0" \) ]; then
      echo "Certbot not up yet. Sleeping for $SLEEP"
      sleep $SLEEP
      SLEEP=$((SLEEP + INCR))
  fi
  if [ \( "$i" -eq "$COUNT" \) -a \( "$RETURN" -ne "0" \) ]; then
    echo "Certbot never started correctly. exiting"
    exit 1
  fi
done


if [ ! -e "/tmp/letsencrypt.init" ]; then
  echo "### Creating dummy certificate for $domains ..."
  path="/etc/letsencrypt/live/$domains"
  mkdir -p "$data_path/conf/live/$domains"
  /opt/bin/docker-compose \
    --project-directory $root \
    -f ${root}/docker-compose.yaml \
    -f ${root}/docker-compose.certbot.yaml run \
    --rm \
    --entrypoint "\
      openssl req -x509 -nodes -newkey rsa:1024 -days 1 \
        -keyout '$path/privkey.pem' \
        -out '$path/fullchain.pem' \
        -subj '/CN=localhost'" \
    certbot
  echo
  echo "### Restarting nginx ..."
  # wait 2.5m for certs to show up
  COUNT=5
  SLEEP=10
  INCR=10
  for i in $(seq "$COUNT"); do
    if [ -e "$data_path/conf/live/$domains" ]; then
      if [ `ls $data_path/conf/live/$domains | wc -l` -gt 0 ];then
        if [ -f $data_path/conf/live/$domains/fullchain.pem -a \
             -f $data_path/conf/live/$domains/privkey.pem -a \
             -f $data_path/conf/options-ssl-nginx.conf -a \
             -f $data_path/conf/ssl-dhparams.pem \
        ]; then
          /usr/bin/systemctl restart gaia-hub.service
          touch /tmp/letsencrypt.init
          exit 0
        fi
      else
        echo "Certbot files not written yet...sleeping for $SLEEP"
        sleep $SLEEP
        SLEEP=$((SLEEP + INCR))
      fi
    fi
  done
  echo "Timed out. There was a problem creating the SSL certificates"
  exit 1
fi
