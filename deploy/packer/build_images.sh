#!/bin/sh

VERSION=$(curl -sL https://api.github.com/repos/stacks-network/gaia/tags | jq .[0].name | tr -d '"v')
echo "Setting Version to ${VERSION}"
# echo ""
# echo "Building gaia-hub-ephemeral"
# echo "    version: ${VERSION}"
# echo "    json: gaia.json"
# packer build --var-file=vars.json --var "version=${VERSION}" gaia-ephemeral.json

echo ""
echo "Building gaia-hub-ebs"
echo "    user_data_file: gaia-ebs.ign"
echo "    version: ${VERSION}"
echo "    json: gaia-ebs.json"
packer build --var-file=vars.json --var "version=${VERSION}" gaia-ebs.json

echo ""
echo "Building gaia-hub"
echo "    version: ${VERSION}"
echo "    json: gaia.json"
packer build --var-file=vars.json --var "version=${VERSION}" gaia.json

