#!/bin/bash

echo -e "Stopping gaia-hub service"
systemctl stop gaia-hub.service

echo -e "Stopping check_dns service"
systemctl stop check_dns.service

echo -e "Stopping check_dns timer"
systemctl stop check_dns.timer

if [ -e "/gaia/docker/nginx/certbot/conf/" ]; then
  echo -e "Removing Certs from -> /gaia/docker/nginx/certbot/conf/"
  rm -rf /gaia/docker/nginx/certbot/conf/*
fi
if [ -e "/tmp/letsencrypt.init" ]; then
  echo -e "Removing letsencrypt-init file -> /tmp/letsencrypt.init"
  rm /tmp/letsencrypt.init
fi
if [ -e "/tmp/dns_checked" ]; then
  echo -e "Removing check_dns file -> /tmp/dns_checked"
  rm /tmp/dns_checked
fi

# echo -e "Starting gaia-hub service (will recreate localhost certs)"
# systemctl start gaia-hub.service
# echo -e "Done..."
