#!/bin/bash


PUBLIC_IPV4=`/usr/bin/curl -s https://api.ipify.org`
DIG="/usr/bin/dig"
OPTS="A +short"
SLEEP=5
INCR=5
CURRENT_EPOCH=$(date +%s)
END_EPOCH=$(($CURRENT_EPOCH + 601))

echo "Current epoch: ${CURRENT_EPOCH}"
echo "End epoch:     ${END_EPOCH}"
if [ ! -f "/tmp/dns_checked" -a "$DOMAIN" != "" ]; then
  while [ $(date +%s) -lt $END_EPOCH ]; do
    RECORD=`$DIG $OPTS $DOMAIN`
    if [[ "$RECORD" == "$PUBLIC_IPV4" ]]; then
      echo -e "[ $DOMAIN IN A $RECORD ] Matched $PUBLIC_IPV4"
      touch /tmp/dns_checked
      exit 0
    else
      echo -e "[ ${DOMAIN} ] Record (${RECORD}) doesn't match public IP (${PUBLIC_IPV4}) - sleeping for ${SLEEP}s...."
      sleep $SLEEP
      SLEEP=$((SLEEP + INCR))
    fi
  done
  echo "Timed out. There was a problem verifying the DNS A record"
  exit 1
else
  exit 1
fi
