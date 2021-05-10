#!/bin/bash
# with modifications: https://raw.githubusercontent.com/wmnnd/nginx-certbot/master/init-letsencrypt.sh

if [ ! -f "/tmp/dns_checked" ] || [ -f "/tmp/ssl_created" ] || [ ! -f "/tmp/letsencrypt.init" ]; then
  exit 1
fi

source /etc/environment
source /gaia/gaia.env
RSA_KEYSIZE=4096
DATA_PATH="/gaia/nginx/certbot"
CERT_PATH="$DATA_PATH/conf/live/${DOMAIN}"
WEBROOT="/usr/share/nginx/html/certbot"

function get_acme_certs () {
  echo "### Deleting dummy certificate for ${DOMAIN} ..."
  if [ -d ${DATA_PATH}/live/${DOMAIN} ]; then
    rm -Rf ${DATA_PATH}/live/${DOMAIN}
  fi
  if [ -d ${DATA_PATH}/archive/${DOMAIN} ]; then
    rm -Rf ${DATA_PATH}/archive/${DOMAIN}
  fi
  if [ -f ${DATA_PATH}/renewal/${DOMAIN}.conf ]; then
    rm -f ${DATA_PATH}/renewal/${DOMAIN}.conf
  fi
  echo ""

  echo "### Requesting Let's Encrypt certificate for $DOMAIN ..."
  if [[ $1 != "0" ]]; then
    STAGING_ARG="--staging";
  fi
  if [ -d ${CERT_PATH} ];then
    rm -rf ${CERT_PATH}
  fi
  /usr/bin/docker run \
    --rm \
    --net=gaia \
    -m 128m \
    --oom-kill-disable \
    -v ${LOCAL_CERTBOT_CONF}:${REMOTE_CERTBOT_CONF} \
    -v ${LOCAL_CERTBOT_WWW}:${REMOTE_CERTBOT_WWW} \
    --name certbot \
    ${CERTBOT_IMAGE} \
  certonly \
    --webroot \
    -w $REMOTE_CERTBOT_WWW \
    ${STAGING_ARG} \
    -d $DOMAIN \
    --register-unsafely-without-email \
    --rsa-key-size $RSA_KEYSIZE \
    --agree-tos \
    --force-renewal

  echo
  echo "### Restarting nginx ..."
  # wait 2.5m for certs to show up
  COUNT=5
  SLEEP=10
  INCR=10
  CERT_PATH="$DATA_PATH/conf/live/${DOMAIN}"
  for i in $(seq "$COUNT"); do
    if [ -e "${DATA_PATH}" ]; then
      if [ `ls ${CERT_PATH} | wc -l` -gt 0 ];then
        if [ -f ${CERT_PATH}/fullchain.pem -a \
             -f ${CERT_PATH}/privkey.pem -a \
             -f ${DATA_PATH}/conf/options-ssl-nginx.conf -a \
             -f ${DATA_PATH}/conf/ssl-dhparams.pem \
        ]; then
          /usr/bin/systemctl restart nginx
          touch /tmp/ssl_created
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
}

if [ ! -d "${DATA_PATH}/conf" ]; then
  echo -e "### Creating conf dir: ${DATA_PATH}/conf ... "
  mkdir -p "${DATA_PATH}/conf"
  echo
fi

# wait 2.5m for nginx come up
COUNT=5
SLEEP=10
INCR=10
for i in $(seq "$COUNT"); do
  curl -Ls localhost/ping --insecure | grep "01000110110000011010001100001" > /dev/null 2>&1
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


get_acme_certs $STAGING
