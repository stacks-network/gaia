let express = require('express')
let expressWinston = require('express-winston')
let winston = require('winston')
let cors = require('cors')

// Program Imports
let StorageRequest = require(`./StorageRequest`)
let StorageAuthentication = require(`./StorageAuthentication`)

function server (config) {
  var app = express();

  // Handle driver configuration
  let driver = false
  switch (config.driver) {
    case "aws":
      let S3Driver = require(`./drivers/S3Driver`)
      driver = new S3Driver(config)
      break;
    case "azure":
      let AzDriver = require(`./drivers/AzDriver`)
      driver = new AzDriver(config)
      break;
    default:
      config.logger.error("Failed to load driver. Check driver configuration.")
      process.exit()
      break
  }

  app.config = config

  // Instantiate server logging with Winston
  app.use(expressWinston.logger({transports: [config.transport]}))

  app.use(cors())

  app.post('/store/:address/:filename', function(req, res, next) {
    let sr = new StorageRequest(req, res, config.logger)
    sr.handle(driver)
  })

  app.get('/hub_info/', function(req, res, next) {
    let challengeText = StorageAuthentication.challengeText()
    let readURLPrefix = driver.getReadURLPrefix()
    res.writeHead(200, {'Content-Type' : 'application/json'})
    res.write(JSON.stringify(
      { challenge_text : challengeText, read_url_prefix : readURLPrefix }))
    res.end()
  })

  return app
}
// Instantiate express application

module.exports = server
