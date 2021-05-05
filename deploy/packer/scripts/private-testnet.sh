#!/bin/sh
echo === Cloning stacks-local-dev ===
git clone -b private-testnet  --depth 1 https://github.com/blockstack/stacks-local-dev /stacks-local-dev
ln -s /stacks-local-dev/sample.env /stacks-local-dev/.env

echo === Adding testnet unit-file ===
cat <<EOF> /etc/systemd/system/testnet.service
# testnet.service
[Unit]
Description=Private Testnet Service
After=docker.service
ConditionFileIsExecutable=/usr/local/bin/docker-compose

[Service]
WorkingDirectory=/stacks-local-dev
TimeoutStartSec=0
Restart=on-failure
RemainAfterExit=yes
RestartSec=30
ExecStartPre=-/bin/bash manage.sh private-testnet pull
ExecStart=/bin/bash manage.sh private-testnet up

ExecStop=-/bin/bash manage.sh private-testnet down
ExecReload=-/bin/bash manage.sh private-testnet restart

[Install]
WantedBy=testnet.service
EOF
systemctl enable testnet.service
systemctl daemon-reload