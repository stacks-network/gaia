FROM node:10-alpine

WORKDIR /hub

COPY package*.json ./
COPY tsconfig*.json ./
COPY src ./src

RUN apk add --no-cache --virtual .build-deps alpine-sdk python && \
    npm install && \
    npm run build && \
    npm prune --production && \
    apk del .build-deps

CMD ["node", "lib/index.js"]