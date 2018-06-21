/* @flow */

import express from 'express'
import expressWinston from 'express-winston'
import logger from 'winston'
import cors from 'cors'

import { ProofChecker } from './ProofChecker'
import { getChallengeText, LATEST_AUTH_VERSION } from './authentication'
import { HubServer } from './server'

function writeResponse(res: express.response, data: Object, statusCode: number) {
  res.writeHead(statusCode, {'Content-Type' : 'application/json'})
  res.write(JSON.stringify(data))
  res.end()
}

function writeErrorResponse(res: express.response, error) {
  if (error.name === 'ValidationError') {
    writeResponse(res, { message: error.message }, 401)
  } else if (error.name === 'BadPathError') {
    writeResponse(res, { message: error.message }, 403)
  } else if (error.name === 'NotEnoughProofError') {
    writeResponse(res, { message: error.message }, 402)
  } else {
    writeResponse(res, { message: 'Server Error' }, 500)
  }
}

function getAddressAndFileName(request: express.request): Object {
  let filename = request.params[1]
  if (filename.endsWith('/')) {
    filename = filename.substring(0, filename.length - 1)
  }
  const address = request.params[0]

  return {address, filename}
}

export function makeHttpServer(config: Object) {
  const app = express()

  // Handle driver configuration
  let driver
  if (config.driver === 'aws') {
    const S3Driver = require('./drivers/S3Driver')
    driver = new S3Driver(config)
  } else if (config.driver === 'azure') {
    const AzDriver = require('./drivers/AzDriver')
    driver = new AzDriver(config)
  } else if (config.driver === 'disk') {
    const DiskDriver = require('./drivers/diskDriver')
    driver = new DiskDriver(config)
  } else if (config.driver === 'google-cloud') {
    const GcDriver = require('./drivers/GcDriver')
    driver = new GcDriver(config)
  } else if (config.driver === 'dropbox') {
    const DBXDriver = require('./drivers/DBXDriver')
    driver = new DBXDriver(config)
  } else if (config.driverClass) {
    driver = new config.driverClass(config)
  } else {
    logger.error('Failed to load driver. Check driver configuration.')
    throw new Error('Failed to load driver')
  }

  const proofChecker = new ProofChecker(config.proofsConfig)
  const server = new HubServer(driver, proofChecker, config)

  app.config = config
  app.driver = driver

  // Instantiate server logging with Winston
  app.use(expressWinston.logger({
    transports: logger.loggers.default.transports }))

  app.use(cors())

  // sadly, express doesn't like to capture slashes.
  //  but that's okay! regexes solve that problem
  app.post(/^\/store\/([a-zA-Z0-9]+)\/(.+)/, (req: express.request, res: express.response) => {
    const {address, filename} = getAddressAndFileName(req)

    server.handleRequest(address, filename, req.headers, req)
      .then((publicURL) => {
        writeResponse(res, { publicURL }, 202)
      })
      .catch((err) => {
        logger.error(err)
        writeErrorResponse(res, err)
      })
  })

  app.get('/hub_info/', (req: express.request,
                         res: express.response) => {
    const challengeText = getChallengeText(server.serverName)
    if (challengeText.length < 10) {
      return writeResponse(res, { message: 'Server challenge text misconfigured' }, 500)
    }
    const readURLPrefix = server.getReadURLPrefix()
    writeResponse(res, { 'challenge_text': challengeText,
                         'latest_auth_version': LATEST_AUTH_VERSION,
                         'read_url_prefix': readURLPrefix }, 200)
  })

  app.get(/^\/read\/([a-zA-Z0-9]+)\/(.+)/, (req: express.request, res: express.response) => {
    const {address, filename} = getAddressAndFileName(req)

    server.handleGetFileRequest(address, filename)
      .then(content => {
        res.writeHead(200, {'Content-Type' : 'text/plain'})
        res.end(content, 'binary')
      })
      .catch(err => {
        logger.error(err)
        writeErrorResponse(res, err)
      })
  })

  // Instantiate express application
  return app
}
