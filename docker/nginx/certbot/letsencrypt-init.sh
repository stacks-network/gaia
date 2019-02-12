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
  touch /tmp/letsencrypt.init
fi
