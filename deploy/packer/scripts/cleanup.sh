#!/bin/sh
unset HISTFILE
echo === Waiting for Cloud-Init ===
timeout 180 /bin/bash -c 'until stat /var/lib/cloud/instance/boot-finished &>/dev/null; do echo waiting...; sleep 6; done'
sudo apt-get -qq update
sudo apt-get -y -qq --purge autoremove
sudo apt-get autoclean
sudo apt-get clean

echo === System Settings ===
sudo update-alternatives --set editor /usr/bin/vim.basic
sudo sed -i 's/^# *\(en_US.UTF-8\)/\1/' /etc/locale.gen && sudo locale-gen
sudo update-locale LC_CTYPE=en_US.UTF-8

echo === System Cleanup ===
sudo shred -u /etc/ssh/*_key 
sudo shred -u /etc/ssh/*_key.pub
sudo shred -u /root/.*history 
sudo shred -u /home/admin/.*history
sudo shred -u /root/.ssh/authorized_keys 
sudo shred -u /home/admin/.ssh/authorized_keys
sudo rm -f /var/log/wtmp
sudo rm -f /var/log/btmp
sudo rm -rf /var/log/installer
sudo rm -rf /var/lib/cloud/instances
sudo rm -rf /tmp/* /var/tmp/* /tmp/.*-unix
sudo find /var/cache -type f -delete
sudo find /var/log -type f | while read f; do echo -n '' | sudo tee $f > /dev/null; done;
sudo find /var/lib/apt/lists -not -name lock -type f -delete
sudo sync
echo === All Done ===