let winston = require('winston');
let fs = require('fs');

let server = require(`./server/server.js`);
let config = require(`./server/config.js`);

let configPath = process.env.CONFIG_PATH || "./config.json"
const conf = config(JSON.parse(fs.readFileSync(configPath)))
let app = server(conf)

app.listen(app.config.port, function(){
  app.config.logger.warn("server starting on port %d in %s mode", this.address().port, app.settings.env);
});
