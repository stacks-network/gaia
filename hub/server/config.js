let fs = require('fs')
let path = require('path')
let winston = require('winston');

// Read Config file
let configPath = process.env.CONFIG_PATH || "../config.json"
const conf = JSON.parse(fs.readFileSync(configPath))

// Configure Logging:
// https://github.com/winstonjs/winston/blob/master/docs/transports.md
var transport = new winston.transports.Console({
  level: "error",
  handleExceptions: true,
  timestamp: true,
  // stringify: true,
  colorize: true,
  json: true
})

// Instantiate Logging
var logger = new winston.Logger({transports: [transport]});

// Add logger and transport to the config
const config = Object.assign({}, conf, {transport, logger})

module.exports = config
