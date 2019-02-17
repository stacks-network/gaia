#!/bin/bash

###
### Stop Services
###
echo -e "### Stopping gaia-hub service ..."
/usr/bin/systemctl stop gaia-hub.service

echo -e "### Stopping check_dns timer ..."
/usr/bin/systemctl stop check_dns.service
/usr/bin/systemctl stop check_dns.timer

echo -e "### Stopping letsencrypt_init timer ..."
/usr/bin/systemctl stop letsencrypt_init.service
/usr/bin/systemctl stop letsencrypt_init.timer

###
### Cleanup the system
###

### remove any installed certs
if [ -e "/gaia/docker/nginx/certbot/conf" ]; then
  echo -e "### Removing Certs from -> /gaia/docker/nginx/certbot/conf/* ..."
  /usr/bin/rm -rf /gaia/docker/nginx/certbot/conf/*
fi

### enable letsencrypt init to run again
if [ -e "/tmp/letsencrypt.init" ]; then
  echo -e "### Removing letsencrypt-init file -> /tmp/letsencrypt.init ..."
  /usr/bin/rm /tmp/letsencrypt.init
fi

### reset the check_dns timer/service
if [ -e "/tmp/dns_checked" ]; then
  echo -e "### Removing check_dns file -> /tmp/dns_checked ..."
  /usr/bin/rm /tmp/dns_checked
fi

if [ -e "/tmp/ssl_created" ]; then
  echo -e "### Removing check_dns file -> /tmp/ssl_created ..."
  /usr/bin/rm /tmp/ssl_created
fi

### remove any remaning docker volumes
if [ `/usr/bin/docker volume ls -q | /usr/bin/wc -l` -gt 0 ]; then
  echo -e "### Removing any remaining docker volumes ..."
  /usr/bin/docker volume rm \
    $( \
      docker volume ls -q \
    )
fi

### remove any unlabelled images
if [ `/usr/bin/docker images | /usr/bin/grep "<none>" | /usr/bin/awk '{print $3}' | wc -l` -gt 0 ]; then
  echo -e "### Removing any unlabelled images ..."
  /usr/bin/docker rmi \
    $( \
      /usr/bin/docker images | \
      /usr/bin/grep "<none>" | \
      /usr/bin/awk '{print $3}' \
    )
fi

echo -e "### Removing any containers created by docker-compose ..."
/opt/bin/docker-compose \
  --project-directory /gaia/docker \
  -f /gaia/docker/docker-compose.yaml \
  -f /gaia/docker/docker-compose.certbot.yaml \
  rm -v

# # remove any other containers
# if [ `docker ps -aq | wc -l` -gt 0 ]; then
#   /usr/bin/docker rm -v $(/usr/bin/docker ps -aq)
# fi
#
# if [ `/usr/bin/docker images -q | wc -l` -gt 0 ]; then
#   echo -e "Removing all downloaded docker images"
#   /usr/bin/docker rmi $(/usr/bin/docker images -q)
# fi

### remove docker networks
if [ `/usr/bin/docker network ls  | /usr/bin/grep docker_gaia | /usr/bin/awk '{print $1}' | wc -l` -gt 0 ]; then
  echo -e "### Deleting docker_gaia networks ... "
  /usr/bin/docker network rm \
    $( \
      /usr/bin/docker network ls  | \
      /usr/bin/grep docker_gaia | \
      /usr/bin/awk '{print $1}' \
    )
fi

###
### Resetting the sysytem for ignition
###
/usr/bin/touch /boot/coreos/first_boot
/usr/bin/rm /etc/machine-id


###
### Start Services
###
echo -e "### Starting gaia-hub service ..."
/usr/bin/systemctl start gaia-hub.service

echo -e "### Starting check_dns timer ..."
/usr/bin/systemctl start check_dns.timer

echo -e "### Starting letsencrypt_init timer ..."
/usr/bin/systemctl start letsencrypt_init.timer

echo -e "### Done..."
