#!/bin/bash
npm install --prefix hub
cp ./hub/config.sample.json ./hub/config.json
sed -i "s/\"accessKeyId\": \"\",/\"accessKeyId\": \"$BUCKETEER_AWS_ACCESS_KEY_ID\",/g" ./hub/config.json
sed -i "s/\"secretAccessKey\": \"\",/\"secretAccessKey\": \"$BUCKETEER_AWS_SECRET_ACCESS_KEY\",/g" ./hub/config.json
cat ./hub/config.json
npm --prefix hub run start