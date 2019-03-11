FROM node:8-alpine

WORKDIR /src/hub

COPY . .

RUN npm install && \
    npm run build && \
    npm install -g

CMD ["npm", "run", "start"]
