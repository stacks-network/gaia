#!/bin/sh
if [ $1 ]; then
  VERSION=$1
else
  VERSION=`/usr/local/bin/epoch`
fi

# packer build --var-file=vars.json --var "user_data_file=gaia-ebs.ign" --var "version=$VERSION" --var "ami_regions=us-west-2" gaia-ebs.json

echo "Setting Version to ${VERSION}"
echo ""
echo "Building gaia-hub-ephemeral"
echo "    user_data_file: gaia-ephemeral.ign"
echo "    version: $VERSION"
echo "    json: gaia-ephemeral.json"
packer build --var-file=vars.json --var "user_data_file=gaia-ephemeral.ign" --var "version=$VERSION" gaia-ephemeral.json
echo ""
echo "Building gaia-hub-ebs"
echo "    user_data_file: gaia-ebs.ign"
echo "    version: $VERSION"
echo "    json: gaia-ebs.json"
packer build --var-file=vars.json --var "user_data_file=gaia-ebs.ign" --var "version=$VERSION" gaia-ebs.json
