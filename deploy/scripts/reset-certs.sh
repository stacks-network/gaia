#!/bin/bash

###
### Stop Services
###
echo -e "### Stopping gaia-hub service ..."
/usr/bin/systemctl stop gaia.service
/usr/bin/systemctl stop certbot.service
/usr/bin/systemctl stop create-docker-network.service
/usr/bin/systemctl stop clone-repo.service
/usr/bin/systemctl stop check-dns.timer
/usr/bin/systemctl stop check-dns.service
/usr/bin/systemctl stop letsencrypt-init.timer
/usr/bin/systemctl stop letsencrypt-init.service
/usr/bin/systemctl stop letsencrypt.service


###
### Cleanup the system
###

### remove any installed certs
if [ -e "/gaia/nginx/certbot/conf" ]; then
  echo -e "### Removing Certs from -> /gaia/nginx/certbot/conf/* ..."
  /usr/bin/rm -rf /gaia/nginx/certbot/conf/*
fi

### enable letsencrypt init to run again
if [ -e "/tmp/letsencrypt.init" ]; then
  echo -e "### Removing letsencrypt-init file -> /tmp/letsencrypt.init ..."
  /usr/bin/rm -f /tmp/letsencrypt.init
fi

### reset the check_dns timer/service
if [ -e "/tmp/dns_checked" ]; then
  echo -e "### Removing check_dns file -> /tmp/dns_checked ..."
  /usr/bin/rm -f /tmp/dns_checked
fi

if [ -e "/tmp/ssl_created" ]; then
  echo -e "### Removing check_dns file -> /tmp/ssl_created ..."
  /usr/bin/rm -f /tmp/ssl_created
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

# remove any other containers
if [ `docker ps -aq | wc -l` -gt 0 ]; then
  /usr/bin/docker rm -v $(/usr/bin/docker ps -aq)
fi

if [ `/usr/bin/docker images -q | wc -l` -gt 0 ]; then
  echo -e "Removing all downloaded docker images"
  /usr/bin/docker rmi $(/usr/bin/docker images -q)
fi

### remove docker networks
if [ `/usr/bin/docker network ls  | /usr/bin/grep gaia | /usr/bin/awk '{print $1}' | wc -l` -gt 0 ]; then
  echo -e "### Deleting gaia networks ... "
  /usr/bin/docker network rm \
    $( \
      /usr/bin/docker network ls  | \
      /usr/bin/grep gaia | \
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
echo -e "### Starting letsencrypt-init ..."
/usr/bin/systemctl start letsencrypt-init.timer
/usr/bin/systemctl start letsencrypt-init.service

echo -e "### Starting create-docker-network ..."
/usr/bin/systemctl start create-docker-network.service

echo -e "### Starting check-dns ..."
/usr/bin/systemctl start check-dns.timer
/usr/bin/systemctl start check-dns.service

echo -e "### Starting clone-repo ..."
/usr/bin/systemctl start clone-repo.service

echo -e "### Starting gaia ..."
/usr/bin/systemctl start gaia.service

echo -e "### Starting letsencrypt ..."
/usr/bin/systemctl start letsencrypt.service

echo -e "### Starting certbot ..."
/usr/bin/systemctl start certbot.timer
/usr/bin/systemctl start certbot.service

echo -e "### Done..."
