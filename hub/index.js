let path = require('path');
let winston = require('winston');

let app = require(`./server/server.js`);
let config = require(`./server/config.js`);

app.listen(config.port, function(){
  config.logger.info("server starting on port %d in %s mode", this.address().port, app.settings.env);
});
