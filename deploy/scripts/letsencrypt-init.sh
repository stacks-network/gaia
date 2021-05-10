#!/bin/bash
# with modifications: https://raw.githubusercontent.com/wmnnd/nginx-certbot/master/init-letsencrypt.sh


source /etc/environment
RSA_KEYSIZE=4096
DATA_PATH="/gaia/nginx/certbot"
CERT_PATH="$DATA_PATH/conf/live/${DOMAIN}"

if [ -f /tmp/letsencrypt.init ]; then
  echo -e "Already executed"
  exit 0
fi

if [ ! -d "${DATA_PATH}/conf" ]; then
  echo -e "### Creating conf dir: ${DATA_PATH}/conf ... "
  mkdir -p "${DATA_PATH}/conf"
  echo
fi


if [ ! -f "${DATA_PATH}/conf/options-ssl-nginx.conf" ]; then
  echo -e "### Downloading missing options-ssl-nginx.conf: ${DATA_PATH}/conf/options-ssl-nginx.conf ... "
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/tls_configs/options-ssl-nginx.conf \
    > "${DATA_PATH}/conf/options-ssl-nginx.conf"
  echo
elif [ -f "${DATA_PATH}/conf/options-ssl-nginx.conf" -a $(stat -c %s ${DATA_PATH}/conf/options-ssl-nginx.conf) -lt 721 ]; then
  echo -e "### re-downloading options-ssl-nginx.conf: ${DATA_PATH}/conf/options-ssl-nginx.conf ... "
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/tls_configs/options-ssl-nginx.conf \
    > "${DATA_PATH}/conf/options-ssl-nginx.conf"
  echo
fi

if [ ! -f "${DATA_PATH}/conf/ssl-dhparams.pem" ]; then
  echo -e "### Downloading missing ssl-dhparams.pem: ${DATA_PATH}/conf/ssl-dhparams.pem ... "
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/ssl-dhparams.pem \
    > "${DATA_PATH}/conf/ssl-dhparams.pem"
  echo
elif [ -f "${DATA_PATH}/conf/ssl-dhparams.pem" -a $(stat -c %s ${DATA_PATH}/conf/ssl-dhparams.pem) -lt 424 ]; then
  echo -e "### re-downloading  ssl-dhparams.pem: ${DATA_PATH}/conf/ssl-dhparams.pem ... "
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/ssl-dhparams.pem \
    > "${DATA_PATH}/conf/ssl-dhparams.pem"
  echo
fi


if [ ! -d ${CERT_PATH} ];then
  mkdir -p ${CERT_PATH}
fi
/usr/bin/openssl req \
  -x509 \
  -nodes \
  -newkey rsa:${RSA_KEYSIZE} \
  -days 1024 \
  -keyout ${CERT_PATH}/privkey.pem \
  -out ${CERT_PATH}/fullchain.pem \
  -subj /CN=localhost


if [ -e "${DATA_PATH}" ]; then
  if [ `ls ${CERT_PATH} | wc -l` -gt 0 ];then
    if [ -f ${CERT_PATH}/fullchain.pem -a \
         -f ${CERT_PATH}/privkey.pem -a \
         -f ${DATA_PATH}/conf/options-ssl-nginx.conf -a \
         -f ${DATA_PATH}/conf/ssl-dhparams.pem \
    ]; then
      # /usr/bin/systemctl restart nginx
      # /usr/bin/docker exec nginx sh -c "nginx -s reload"
      touch /tmp/letsencrypt.init
      exit 0
    fi
  fi
else
  echo "Error creating self-signed certs"
  exit 2
fi
