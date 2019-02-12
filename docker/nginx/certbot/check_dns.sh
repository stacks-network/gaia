#!/bin/bash


PUBLIC_IPV4=`/usr/bin/curl -s https://api.ipify.org`
DIG="/usr/bin/dig"
OPTS="A +short"
RECORD=`$DIG $OPTS $DOMAIN`


if [[ $RECORD == "" || "$RECORD" != "$PUBLIC_IPV4" ]]; then
  exit 1
else
  echo -e "[ $DOMAIN IN A $RECORD ] Found"
  echo -e "Setting up $DOMAIN certificates"
  # touch /tmp/dns_checked
  exit 0
fi
