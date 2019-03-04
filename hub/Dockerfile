FROM node:10.15-alpine

WORKDIR /src/hub

COPY . .

RUN npm install && \
    npm run build && \
    npm install -g

CMD ["npm", "run", "start"]
