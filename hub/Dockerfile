FROM node:lts-alpine

WORKDIR /src/hub

RUN apk add python py-pip make g++

COPY . .

RUN npm install
RUN npm run build && \
    npm install -g

CMD ["npm", "run", "start"]
