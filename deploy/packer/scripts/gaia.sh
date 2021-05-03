#!/bin/sh
echo === Cloning gaia repo ===
git clone -b great-gaia-guidance  --depth 1 https://github.com/blockstack/gaia /gaia

echo === Copying files ===
mkdir -p /configs/gaia
ln -s /gaia/deploy/admin-config /configs/gaia/admin-config
ln -s /gaia/deploy/hub-config /configs/gaia/hub-config
ln -s /gaia/deploy/reader-config /configs/gaia/reader-config
ln -s /gaia/deploy/nginx /configs/nginx
ln -s /gaia/scripts /scripts
ln -s /gaia/.env /.env
ln -s /gaia/docker-compose.yaml /docker-compose.yaml
