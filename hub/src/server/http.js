let express = require('express')
let expressWinston = require('express-winston')
let winston = require('winston')
let cors = require('cors')

// Program Imports
let StorageRequest = require(`./StorageRequest`)
let ProofChecker = require(`./ProofChecker`)
let StorageAuthentication = require(`./StorageAuthentication`)

function writeResponse(res, data, statusCode) {
  res.writeHead(statusCode, {'Content-Type' : 'application/json'})
  res.write(JSON.stringify(data))
  res.end()
}

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
    const address = req.params[0]

    server.handleRequest(address, filename, req.headers, req)
      .then((publicURL) => {
        writeResponse(res, { publicURL }, 202)
      })
      .catch((err) => {
        logger.error(err)
        if (err instanceof ValidationError) {
          writeResponse(res, { message: err.message }, 401)
        } else if (err instanceof BadPathError) {
          writeResponse(res, { message: err.message }, 403)
        } else if (err instanceof NotEnoughProofError) {
          writeResponse(res, { message: err.message }, 402)
        } else {
          writeResponse(res, { message: 'Server Error' }, 500)
        }
      })
  })

  app.get('/hub_info/', function(req, res, next) {
    const challengeText = StorageAuthentication.challengeText()
    const readURLPrefix = driver.getReadURLPrefix()
    writeResponse(res, { challenge_text : challengeText, read_url_prefix : readURLPrefix }, 200)
  })

  // Instantiate express application
  return app
}

module.exports = server
