#!/bin/bash

cp ./hub/config.sample.json ./hub/config.json
sed -i "s/\"accessKeyId\": \"\",/\"accessKeyId\": \"$BUCKETEER_AWS_ACCESS_KEY_ID\",/g" ./hub/config.json
sed -i "s#\"secretAccessKey\": \"\"#\"secretAccessKey\": \"$BUCKETEER_AWS_SECRET_ACCESS_KEY\"#g" ./hub/config.json
sed -i "s/\"readURL\": \"\",/\"readURL\": \"$BUCKETEER_BUCKET_NAME.s3.amazonaws.com\",/g" ./hub/config.json
sed -i "s/\"driver\": \"\",/\"driver\": \"aws\",/g" ./hub/config.json
sed -i "s/\"bucket\": \"\",/\"bucket\": \"$BUCKETEER_BUCKET_NAME\",/g" ./hub/config.json
sed -i "s/\"servername\": \"\",/\"servername\": \"$CHALLENGE_TOKEN\",/g" ./hub/config.json
sed -i "s/\"port\": 3000,/\"port\": $PORT,/g" ./hub/config.json
sed -i "s/\"proofsRequired\" : 3/\"proofsRequired\": 0/g" ./hub/config.json
sed -i "s/\"warn\"/\"debug\"/g" ./hub/config.json
cat ./hub/config.json
npm --prefix hub run start
