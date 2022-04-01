FROM node:17-alpine

WORKDIR /hub

COPY package*.json ./
COPY tsconfig*.json ./
COPY src ./src

RUN apk add --no-cache --virtual .build-deps alpine-sdk python3 && \
    npm install && \
    npm run build && \
    npm prune --production && \
    apk del .build-deps

CMD ["npm", "run", "start"]
