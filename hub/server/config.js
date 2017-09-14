let fs = require('fs')
let path = require('path')
let winston = require('winston');

// Read Config file
function config (json) {

  // Configure Logging:
  // https://github.com/winstonjs/winston/blob/master/docs/transports.md
  var transport = new winston.transports.Console({
    level: "warn",
    handleExceptions: true,
    timestamp: true,
    // stringify: true,
    colorize: true,
    json: true
  })

  // Instantiate Logging
  var logger = new winston.Logger({transports: [transport]});

  // Add logger and transport to the config
  return Object.assign({}, json, {transport, logger})
}

module.exports = config
