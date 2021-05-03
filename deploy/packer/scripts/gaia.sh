#!/bin/sh
echo === Cloning gaia repo ===
sudo git clone -b great-gaia-guidance  --depth 1 https://github.com/blockstack/gaia /root/gaia

echo === Copying files ===
sudo mkdir -p /storage /gaia
sudo cp -R /root/gaia/deploy/packer/system-files/etc/motd.d/default.conf /etc/motd.d/default.conf
sudo cp -R /root/gaia/deploy/packer/system-files/etc/modules-load.d/nf.conf /etc/modules-load.d/nf.conf 
# cp -R /gaia/deploy/packer/system-files/etc/sysctl.d/startup.conf /etc/sysctl.d/startup.conf
sudo cp -R /root/gaia/deploy/unit-files/* /etc/systemd/system/
sudo cp -R /root/gaia/deploy/scripts /gaia/
sudo cp -R /root/gaia/deploy/admin-config /gaia/admin-config
sudo cp -R /root/gaia/deploy/reader-config /gaia/reader-config
sudo cp -R /root/gaia/deploy/hub-config /gaia/hub-config
sudo cp -R /root/gaia/deploy/.env /gaia/gaia.env
sudo cp -R /root/gaia/deploy/docker-compose.yaml /gaia/docker-compose.yaml

