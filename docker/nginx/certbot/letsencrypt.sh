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

echo "### Deleting dummy certificate for $domains ..."
/opt/bin/docker-compose --project-directory $root -f ${root}/docker-compose.yaml -f ${root}/docker-compose.certbot.yaml run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$domains && \
  rm -Rf /etc/letsencrypt/archive/$domains && \
  rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
echo

echo "### Requesting Let's Encrypt certificate for $domains ..."
#Join $domains to -d args
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Enable staging mode if needed
if [[ $staging != "0" ]]; then staging_arg="--staging"; fi

/opt/bin/docker-compose --project-directory $root -f ${root}/docker-compose.yaml -f ${root}/docker-compose.certbot.yaml run --rm --entrypoint "\
  certbot certonly --webroot -w $webroot \
    $staging_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

echo "### Restarting nginx ..."
/opt/bin/docker-compose --project-directory $root -f ${root}/docker-compose.yaml -f ${root}/docker-compose.certbot.yaml restart nginx
