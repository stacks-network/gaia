#!/bin/bash

echo -e "Resetting gaia services"
echo -e "Stopping timers/services"
/usr/bin/systemctl stop letsencrypt_init.timer
/usr/bin/systemctl stop letsencrypt_init.service
/usr/bin/systemctl stop check_dns.timer
/usr/bin/systemctl stop check_dns.service

echo -e "Stopping gaia-hub service"
/usr/bin/systemctl stop gaia-hub.service

echo -e "Stopping check_dns service"
/usr/bin/systemctl stop check_dns.service

echo -e "Stopping check_dns timer"
/usr/bin/systemctl stop check_dns.timer

# remove any installed certs
if [ -e "/gaia/docker/nginx/certbot/conf/" ]; then
  echo -e "Removing Certs from -> /gaia/docker/nginx/certbot/conf/"
  rm -rf /gaia/docker/nginx/certbot/conf/*
fi

# enable letsencrypt init to run again
if [ -e "/tmp/letsencrypt.init" ]; then
  echo -e "Removing letsencrypt-init file -> /tmp/letsencrypt.init"
  rm /tmp/letsencrypt.init
fi

# reset the check_dns timer/service
if [ -e "/tmp/dns_checked" ]; then
  echo -e "Removing check_dns file -> /tmp/dns_checked"
  rm /tmp/dns_checked
fi
if [ -e "/tmp/ssl_created" ]; then
  echo -e "Removing check_dns file -> /tmp/ssl_created"
  rm /tmp/ssl_created
fi

# remove any remaning docker volumes
if [ `docker volume ls -q | wc -l` -gt 0 ]; then
  /usr/bin/docker volume rm $(docker volume ls -q)
fi

# remove any unlabelled images
if [ `docker images | grep "<none>" | awk '{print $3}' | wc -l` -gt 0 ]; then
  /usr/bin/docker rmi $(/usr/bin/docker images | grep "<none>" | awk '{print $3}')
fi

# remove any other containers
if [ `docker ps -aq | wc -l` -gt 0 ]; then
  /usr/bin/docker rm -v $(/usr/bin/docker ps -aq)
fi

echo -e "Remove any containers created by docker-compose"
/opt/bin/docker-compose -f /gaia/docker/docker-compose.yaml -f /gaia/docker/docker-compose.certbot.yaml rm -v

if [ `/usr/bin/docker images -q | wc -l` -gt 0 ]; then
  echo -e "Removing all downloaded docker images"
  /usr/bin/docker rmi $(/usr/bin/docker images -q)
fi
# echo -e "Starting gaia-hub service (will recreate localhost certs)"
# systemctl start gaia-hub.service
# echo -e "Done..."
