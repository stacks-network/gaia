1. clone-repo
  - created /gaia  or pulled /gaia
2. create-docker-network
  - created docker network
3. letsencrypt-init
  - created /gaia/nginx/certbot/conf/live/deathmetal.ml/*.pem
  - created /tmp/letsencrypt.init
4. check-dns
  - created /tmp/dns_checked
5. gaia
  - starts all gaia containers
  - starts nginx container
6. letsencrypt
  - creates valid certs in /gaia/nginx/certbot/conf/live/deathmetal.ml/*
    `openssl x509 -in /gaia/nginx/certbot/conf/live/deathmetal.ml/fullchain.pem -text -noout`
