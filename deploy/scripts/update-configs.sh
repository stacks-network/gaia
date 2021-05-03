#!/bin/sh

# modify the readURL for the hub if DOMAIN exists
echo "Checking for existence of DOMAIN env var"
if [ $DOMAIN ]; then
  echo "DOMAIN ($DOMAIN) env var found, attempting sed on /gaia/hub-config/config.json"
  /usr/bin/sed -i -e 's|"readURL".*|"readURL": "https://'${DOMAIN}'/reader/",|' /gaia/hub-config/config.json
  echo "DOMAIN ($DOMAIN) env var found, attempting sed on /gaia/nginx/conf.d/default.conf"
  /usr/bin/sed -i -e "s|\${DOMAIN}|${DOMAIN}|g" /gaia/nginx/conf.d/default.conf
fi

# modify the apikey for the admin container if API_KEY exists
echo "Checking for existence of API_KEY env var"
if [ $API_KEY ]; then
  echo "API_KEY ($API_KEY) env var found, attempting sed on /gaia/admin-config/config.json"
  /usr/bin/sed -i -e 's|"apiKeys".*|"apiKeys": ["'$API_KEY'"],|' /gaia/admin-config/config.json
fi

exit 0
