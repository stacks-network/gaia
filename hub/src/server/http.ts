import express from 'express'
import * as expressWinston from 'express-winston'
import cors from 'cors'

import { ProofChecker } from './ProofChecker.js'
import { getChallengeText, LATEST_AUTH_VERSION } from './authentication.js'
import { HubServer } from './server.js'
import { getDriverClass, logger, AsyncMutexScope } from './utils.js'
import { DriverModel } from './driverModel.js'
import * as errors from './errors.js'
import { HubConfigInterface } from './config.js'

function writeResponse(res: express.Response, data: any, statusCode: number) {
  res.writeHead(statusCode, {'Content-Type' : 'application/json'})
  res.write(JSON.stringify(data))
  res.end()
}

export function makeHttpServer(config: HubConfigInterface): { app: express.Application, server: HubServer, driver: DriverModel, asyncMutex: AsyncMutexScope } {

  const app: express.Application = express()

  const asyncMutex = new AsyncMutexScope()

  // Handle driver configuration
  let driver: DriverModel

  if (config.driverInstance) {
    driver = config.driverInstance
  } else if (config.driverClass) {
    driver = new config.driverClass(config)
  } else if (config.driver) {
    const driverClass = getDriverClass(config.driver)
    driver = new driverClass(config)
  } else {
    throw new Error('Driver option not configured')
  }

  const proofChecker = new ProofChecker(config.proofsConfig)
  const server = new HubServer(driver, proofChecker, config)

  // Instantiate server logging with Winston
  app.use(expressWinston.logger({
    winstonInstance: logger }))

  const corsConfig = cors({
    origin: '*',
    // Set the Access-Control-Max-Age header to 24 hours.
    maxAge: 86400, 
    methods: 'DELETE,POST,GET,OPTIONS,HEAD',
    // Allow the client to include match headers in http requests
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers
    allowedHeaders: 'Authorization,Content-Type,If-Match,If-None-Match'
  })
  
  app.use(corsConfig)

  // Enabling CORS Pre-Flight
  // https://www.npmjs.com/package/cors#enabling-cors-pre-flight
  app.options('*', corsConfig)

  // sadly, express doesn't like to capture slashes.
  //  but that's okay! regexes solve that problem
  app.post(/^\/store\/([a-zA-Z0-9]+)\/(.+)/, (
    req: express.Request,
    res: express.Response
  ) => {
    let filename = req.params[1]
    if (filename.endsWith('/')){
      filename = filename.substring(0, filename.length - 1)
    }
    const address = req.params[0]
    const endpoint = `${address}/${filename}`

    const handleRequest = async () => {
      try {
        const responseData = await server.handleRequest(address, filename, req.headers, req)
        writeResponse(res, responseData, 202)
      } catch (err) {
        logger.error(err)
        if (err instanceof errors.ValidationError) {
          writeResponse(res, { message: err.message, error: err.name }, 401)
        } else if (err instanceof errors.AuthTokenTimestampValidationError) {
          writeResponse(res, { message: err.message, error: err.name }, 401)
        } else if (err instanceof errors.BadPathError) {
          writeResponse(res, { message: err.message, error: err.name }, 403)
        } else if (err instanceof errors.NotEnoughProofError) {
          writeResponse(res, { message: err.message, error: err.name }, 402)
        } else if (err instanceof errors.ConflictError) {
          writeResponse(res, { message: err.message, error: err.name }, 409) 
        } else if (err instanceof errors.PayloadTooLargeError) {
          writeResponse(res, { message: err.message, error: err.name }, 413)
        } else if (err instanceof errors.PreconditionFailedError) {
          writeResponse(res, { message: err.message, error: err.name, etag: err.expectedEtag }, 412)
        } else {
          writeResponse(res, { message: 'Server Error' }, 500)
        }
      }
    }

    try {
      if (!asyncMutex.tryAcquire(endpoint, handleRequest)) {
        const errMsg = `Concurrent operation (store) attempted on ${endpoint}`
        logger.error(errMsg)
        writeResponse(res, { 
          message: errMsg, 
          error: errors.ConflictError.name 
        }, 409)
      }
    } catch (err) {
      logger.error(err)
      writeResponse(res, { message: 'Server Error' }, 500)
    }

  })

  app.delete(/^\/delete\/([a-zA-Z0-9]+)\/(.+)/, (
    req: express.Request,
    res: express.Response
  ) => {
    let filename = req.params[1]
    if (filename.endsWith('/')){
      filename = filename.substring(0, filename.length - 1)
    }
    const address = req.params[0]
    const endpoint = `${address}/${filename}`

    const handleRequest = async () => {
      try {
        await server.handleDelete(address, filename, req.headers)
        res.writeHead(202)
        res.end()
      } catch (err) {
        logger.error(err)
        if (err instanceof errors.ValidationError) {
          writeResponse(res, { message: err.message, error: err.name }, 401)
        } else if (err instanceof errors.AuthTokenTimestampValidationError) {
          writeResponse(res, { message: err.message, error: err.name  }, 401)
        } else if (err instanceof errors.BadPathError) {
          writeResponse(res, { message: err.message, error: err.name  }, 403)
        } else if (err instanceof errors.DoesNotExist) {
          writeResponse(res, { message: err.message, error: err.name  }, 404)
        } else if (err instanceof errors.NotEnoughProofError) {
          writeResponse(res, { message: err.message, error: err.name  }, 402)
        } else {
          writeResponse(res, { message: 'Server Error' }, 500)
        }
      }
    }

    try {
      if (!asyncMutex.tryAcquire(endpoint, handleRequest)) {
        const errMsg = `Concurrent operation (delete) attempted on ${endpoint}`
        logger.error(errMsg)
        writeResponse(res, { 
          message: errMsg, 
          error: errors.ConflictError.name 
        }, 409)
      }
    } catch (err) {
      logger.error(err)
      writeResponse(res, { message: 'Server Error' }, 500)
    }

  })

  app.post(
    /^\/list-files\/([a-zA-Z0-9]+)\/?/, express.json({ limit: 4096 }),
    (req: express.Request, res: express.Response) => {
      // sanity check... should never be reached if the express json parser is working correctly
      if (parseInt(req.headers['content-length']) > 4096) {
        writeResponse(res, { message: 'Invalid JSON: too long'}, 400)
        return
      }

      const address = req.params[0]
      const requestBody = req.body
      const page = requestBody.page ? requestBody.page : null
      const stat = !!requestBody.stat

      server.handleListFiles(address, page, stat, req.headers)
        .then((files) => {
          writeResponse(res, { entries: files.entries, page: files.page }, 202)
        })
        .catch((err: any) => {
          logger.error(err)
          if (err instanceof errors.ValidationError) {
            writeResponse(res, { message: err.message, error: err.name }, 401)
          } else if (err instanceof errors.AuthTokenTimestampValidationError) {
            writeResponse(res, { message: err.message, error: err.name  }, 401)
          } else {
            writeResponse(res, { message: 'Server Error' }, 500)
          }
        })
    })

  app.post(
    /^\/revoke-all\/([a-zA-Z0-9]+)\/?/, 
    express.json({ limit: 4096 }),
    (req: express.Request, res: express.Response) => {
      // sanity check... should never be reached if the express json parser is working correctly
      if (parseInt(req.headers['content-length']) > 4096) {
        writeResponse(res, { message: 'Invalid JSON: too long'}, 400)
        return
      }

      if (!req.body || !req.body.oldestValidTimestamp) {
        writeResponse(res, { message: 'Invalid JSON: missing oldestValidTimestamp'}, 400)
        return
      }

      const address = req.params[0]
      const oldestValidTimestamp: number = parseInt(req.body.oldestValidTimestamp)

      if (!Number.isFinite(oldestValidTimestamp) || oldestValidTimestamp < 0) {
        writeResponse(res, { message: 'Invalid JSON: oldestValidTimestamp is not a valid integer'}, 400)
        return
      }

      server.handleAuthBump(address, oldestValidTimestamp, req.headers)
        .then(() => {
          writeResponse(res, { status: 'success' }, 202)
        })
        .catch((err: any) => {
          logger.error(err)
          if (err instanceof errors.ValidationError) {
            writeResponse(res, { message: err.message, error: err.name  }, 401)
          } else if (err instanceof errors.BadPathError) {
            writeResponse(res, { message: err.message, error: err.name  }, 403)
          } else {
            writeResponse(res, { message: 'Server Error' }, 500)
          }
        })
    })

  app.get('/hub_info/', (req: express.Request,
                         res: express.Response) => {
    const challengeText = getChallengeText(server.serverName)
    if (challengeText.length < 10) {
      return writeResponse(res, { message: 'Server challenge text misconfigured' }, 500)
    }
    const readURLPrefix = server.getReadURLPrefix()
    writeResponse(res, { 'challenge_text': challengeText,
                         'latest_auth_version': LATEST_AUTH_VERSION,
                         'max_file_upload_size_megabytes': server.maxFileUploadSizeMB,
                         'read_url_prefix': readURLPrefix }, 200)
  })

  // Instantiate express application
  return { app, server, driver, asyncMutex }
}
