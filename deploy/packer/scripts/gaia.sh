#!/bin/sh
echo === Cloning gaia repo ===
sudo git clone -b great-gaia-guidance  --depth 1 https://github.com/blockstack/gaia /root/gaia

echo === Copying files ===
sudo mkdir -p /storage /gaia
sudo cp -R /root/gaia/deploy/packer/system-files/etc/modules-load.d/nf.conf /etc/modules-load.d/nf.conf 
sudo cp -R /root/gaia/deploy/packer/system-files/etc/sysctl.d/startup.conf /etc/sysctl.d/startup.conf
for FILE in $(sudo ls /root/gaia/deploy/unit-files); do
  sudo cp -a /root/gaia/deploy/unit-files/${FILE} /etc/systemd/system/${FILE}
done
sudo cp -R /root/gaia/deploy/scripts /gaia/
sudo cp -R /root/gaia/deploy/configs /gaia/
sudo cp -R /root/gaia/deploy/.env /gaia/gaia.env
sudo cp -R /root/gaia/deploy/docker-compose.yaml /gaia/docker-compose.yaml

