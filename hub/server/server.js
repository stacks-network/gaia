let express = require('express')
let expressWinston = require('express-winston')
let winston = require('winston')
let cors = require('cors')

// Program Imports
let StorageRequest = require(`./StorageRequest`)
let ProofChecker = require(`./ProofChecker`)
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

  let proofChecker = new ProofChecker(config.proofsConfig, config.logger, driver)

  app.config = config

  // Instantiate server logging with Winston
  app.use(expressWinston.logger({transports: [config.transport]}))

  app.use(cors())

  // sadly, express doesn't like to capture slashes.
  //  but that's okay! regexes solve that problem
  app.post(/^\/store\/([a-zA-Z0-9]+)\/(.+)/, function(req, res, next) {
    let filename = req.params[1]
    if (filename.endsWith("/")){
      filename = filename.substring(0, filename.length - 1)
    }
    req.params.address = req.params[0]
    req.params.filename = filename

    let sr = new StorageRequest(req, res, proofChecker, config)
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

  // Instantiate express application
  return app
}

module.exports = server
