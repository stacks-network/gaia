#!/bin/bash


PUBLIC_IPV4=`/usr/bin/curl -s https://api.ipify.org`
DIG="/usr/bin/dig"
OPTS="A +short"
RECORD=`$DIG $OPTS $DOMAIN`
COUNT=10
SLEEP=10
INCR=10

for i in $(seq "$COUNT"); do
  if [[ "$RECORD" == "$PUBLIC_IPV4" ]]; then
    echo -e "[ $DOMAIN IN A $RECORD ] Found"
    echo -e "    Setting up $DOMAIN certificates"
    touch /tmp/dns_checked
    exit 0
  else
    echo -e "Record doesn't match public IP. sleeping...."
    sleep $SLEEP
    SLEEP=$((SLEEP + INCR))
  fi
done
echo "Timed out. There was a problem verifying the DNS A record"
exit 1
