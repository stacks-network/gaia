#!/bin/sh
echo === Cloning gaia repo ===
sudo git clone -b great-gaia-guidance  --depth 1 https://github.com/blockstack/gaia /root/gaia

echo === Configuring Boot Scripts ===
sudo mkdir -p /gaia
sudo cat <<EOF> /etc/rc.local
#!/bin/sh -e
#
# rc.local
#
# This script is executed at the end of each multiuser runlevel.
# Make sure that the script will "exit 0" on success or any other
# value on error.
/usr/local/bin/aws_tags || exit 1
exit 0
EOF
chmod 755 /etc/rc.local
sudo mv /tmp/aws_tags /usr/local/bin/aws_tags
sudo chmod 755 /usr/local/bin/aws_tags

echo === Copying files ===
sudo cp -R /root/gaia/deploy/packer/system-files/etc/modules-load.d/nf.conf /etc/modules-load.d/nf.conf 
sudo cp -R /root/gaia/deploy/packer/system-files/etc/sysctl.d/startup.conf /etc/sysctl.d/startup.conf
for FILE in $(sudo ls /root/gaia/deploy/unit-files); do
  sudo cp -a /root/gaia/deploy/unit-files/${FILE} /etc/systemd/system/${FILE}
done
sudo systemctl disable gaia

