FROM node:lts-alpine

ARG DOCKER_CLI_VERSION="18.09.3"
ENV DOWNLOAD_URL="https://download.docker.com/linux/static/stable/x86_64/docker-$DOCKER_CLI_VERSION.tgz"
ENV GLIBC_VER="2.29-r0"

WORKDIR /src/admin

COPY . .

RUN apk --no-cache add --update ca-certificates curl \
    && curl -L -s -o /etc/apk/keys/sgerrand.rsa.pub https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub \
    && curl -L -s -o /tmp/glibc-$GLIBC_VER.apk https://github.com/sgerrand/alpine-pkg-glibc/releases/download/$GLIBC_VER/glibc-$GLIBC_VER.apk \
    && apk add /tmp/glibc-$GLIBC_VER.apk \
    && mkdir -p /tmp/download \
    && curl -L -s $DOWNLOAD_URL | tar -xz -C /tmp/download \
    && mv /tmp/download/docker/docker /usr/local/bin/ \
    && rm -rf /tmp/download \
    && apk del curl \
    && rm -rf /var/cache/apk/* \
    && npm install \
    && npm run build \
    && npm install -g

CMD ["npm", "run", "start"]
