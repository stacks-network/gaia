import express from 'express'
import expressWinston from 'express-winston'
import logger from 'winston'
import cors from 'cors'

import { ProofChecker } from './ProofChecker'
import { StorageAuthentication } from './StorageAuthentication'
import { HubServer } from './server'

function writeResponse(res, data, statusCode) {
  res.writeHead(statusCode, {'Content-Type' : 'application/json'})
  res.write(JSON.stringify(data))
  res.end()
}

export function makeHttpServer(config) {
  const app = express()

  // Handle driver configuration
  let driver = false
  switch (config.driver) {
    case 'aws':
      const S3Driver = require('./drivers/S3Driver')
      driver = new S3Driver(config)
      break
    case 'azure':
      const AzDriver = require('./drivers/AzDriver')
      driver = new AzDriver(config)
      break
    case 'disk':
      const DiskDriver = require('./drivers/diskDriver')
      driver = new DiskDriver(config)
      break
    default:
      logger.error('Failed to load driver. Check driver configuration.')
      process.exit()
      break
  }

  const proofChecker = new ProofChecker(config.proofsConfig, driver)
  const server = new HubServer(driver, proofChecker, config)

  app.config = config

  // Instantiate server logging with Winston
  app.use(expressWinston.logger({
    transports: logger.loggers.default.transports }))

  app.use(cors())

  // sadly, express doesn't like to capture slashes.
  //  but that's okay! regexes solve that problem
  app.post(/^\/store\/([a-zA-Z0-9]+)\/(.+)/, function(req, res) {
    let filename = req.params[1]
    if (filename.endsWith('/')){
      filename = filename.substring(0, filename.length - 1)
    }
    const address = req.params[0]

    server.handleRequest(address, filename, req.headers, req)
      .then((publicURL) => {
        writeResponse(res, { publicURL }, 202)
      })
      .catch((err) => {
        logger.error(err)
        if (err.name === 'ValidationError') {
          writeResponse(res, { message: err.message }, 401)
        } else if (err.name === 'BadPathError') {
          writeResponse(res, { message: err.message }, 403)
        } else if (err.name === 'NotEnoughProofError') {
          writeResponse(res, { message: err.message }, 402)
        } else {
          writeResponse(res, { message: 'Server Error' }, 500)
        }
      })
  })

  app.get('/hub_info/', function(req, res) {
    const challengeText = StorageAuthentication.challengeText(server.serverName)
    const readURLPrefix = driver.getReadURLPrefix()
    writeResponse(res, { 'challenge_text' : challengeText,
                         'read_url_prefix' : readURLPrefix }, 200)
  })

  // Instantiate express application
  return app
}
