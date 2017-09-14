let express = require('express');
let expressWinston = require('express-winston');
let winston = require('winston');
let cors = require('cors');
let path = require('path')

// Program Imports
let S3Driver = require(`./drivers/S3Driver`);
let AzDriver = require(`./drivers/AzDriver`);
let StorageRequest = require(`./StorageRequest`);

function server (config) {
  var app = express();

  // Handle driver configuration
  let driver = false
  switch (config.driver) {
    case "aws":
      driver = new S3Driver(config)
      break;
    case "azure":
      driver = new AzDriver(config)
      break;
    default:
      logger.error("Failed to load driver. Check driver configuration.")
      process.exit()
      break
  }

  app.config = config

  // Instantiate server logging with Winston
  app.use(expressWinston.logger({transports: [config.transport]}))

  // Configure CORS for the `/store/:address/:filename` route
  // https://github.com/expressjs/cors#configuring-cors
  const corsOptions = {
    origin: config.servername,
    optionsSuccessStatus: 200
  }

  app.post('/store/:address/:filename', cors(corsOptions), function(req, res, next) {
    let sr = new StorageRequest(req, res, config.logger)
    sr.handle(driver)
  })

  return app
}
// Instantiate express application

module.exports = server
