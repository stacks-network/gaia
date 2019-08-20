FROM node:10-alpine

WORKDIR /reader

COPY package*.json ./
COPY tsconfig*.json ./
COPY src ./src

RUN npm install && \
    npm run build && \
    npm prune --production

CMD ["node", "lib/index.js"]