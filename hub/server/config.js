let fs = require('fs')
let winston = require('winston');

// Read Config file
function config (json) {

  // Configure logging, defaults below:
  // https://github.com/winstonjs/winston/blob/master/docs/transports.md
  var argsTransport = {
    level: "warn",
    handleExceptions: true,
    timestamp: true,
    stringify: true,
    colorize: true,
    json: true
  }

  if ('argsTransport' in json){
    Object.assign(argsTransport, json.argsTransport)
  }

  // Instantiate Logging
  var transport = new winston.transports.Console(argsTransport)
  var logger = new winston.Logger({transports: [transport]});

  // Add logger and transport to the config
  return Object.assign({}, {logger, transport}, json)
}

module.exports = config
