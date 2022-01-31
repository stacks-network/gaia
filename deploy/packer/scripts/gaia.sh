#!/bin/sh
echo === Cloning gaia repo ===
sudo git clone -b great-gaia-guidance --depth 1 https://github.com/stacks-network/gaia /gaia

echo === Configuring Boot Scripts ===
sudo mkdir -p /gaia
sudo cat <<'EOF'> /etc/rc.local
#!/bin/sh -e
#
# rc.local
#
# This script is executed at the end of each multiuser runlevel.
# Make sure that the script will "exit 0" on success or any other
# value on error.
. /usr/local/bin/aws_tags || exit 1

echo === Configuring Gaia ===
cp /gaia/deploy/docker/sample-aws.env /gaia/deploy/docker/aws.env
cp /gaia/deploy/docker/sample-disk.env /gaia/deploy/docker/disk.env

sed -i "s/DOMAIN_NAME=\".*\"/DOMAIN_NAME=\"$Domain\"/g" /gaia/deploy/docker/aws.env
sed -i "s/CERTBOT_EMAIL=\".*\"/CERTBOT_EMAIL=\"$Email\"/g" /gaia/deploy/docker/aws.env
sed -i "s/GAIA_BUCKET_NAME=\".*\"/GAIA_BUCKET_NAME=\"$BucketName\"/g" /gaia/deploy/docker/aws.env

sed -i "s/DOMAIN_NAME=\".*\"/DOMAIN_NAME=\"$Domain\"/g" /gaia/deploy/docker/disk.env
sed -i "s/CERTBOT_EMAIL=\".*\"/CERTBOT_EMAIL=\"$Email\"/g" /gaia/deploy/docker/disk.env

exit 0
EOF

sudo chmod 755 /etc/rc.local
sudo mv /tmp/aws_tags /usr/local/bin/aws_tags
sudo chmod 755 /usr/local/bin/aws_tags

echo === Copying files ===
sudo cp -R /gaia/deploy/packer/system-files/etc/modules-load.d/nf.conf /etc/modules-load.d/nf.conf 
sudo cp -R /gaia/deploy/packer/system-files/etc/sysctl.d/startup.conf /etc/sysctl.d/startup.conf
for FILE in $(sudo ls /gaia/deploy/unit-files); do
  sudo cp -a /gaia/deploy/unit-files/${FILE} /etc/systemd/system/${FILE}
done

sudo systemctl enable gaia.timer
sudo systemctl enable gaia.service
