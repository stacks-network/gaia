#!/bin/bash

echo -e "Stopping gaia-hub service"
systemctl stop gaia-hub.service
if [ -e "/gaia/docker/nginx/certbot/conf/" ]; then
  echo -e "Removing Certs from -> /gaia/docker/nginx/certbot/conf/"
  rm -rf /gaia/docker/nginx/certbot/conf/*
fi
if [ -e "/tmp/letsencrypt.init" ]; then
  echo -e "Removing letsencrypt-init file -> /tmp/letsencrypt.init"
  rm /tmp/letsencrypt.init
fi
echo -e "Starting gaia-hub service (will recreate localhost certs)"
systemctl start gaia-hub.service
echo -e "Done..."
