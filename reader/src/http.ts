import express from 'express'
import expressWinston from 'express-winston'
import cors from 'cors'
import { promisify } from 'util'
import { pipeline } from 'stream'
import { ReaderConfigInterface, logger } from './config.js'
import { ReaderServer } from './server.js'
import { DriverModel } from './driverModel.js'
import { getDriverClass } from './utils.js'

const pipelineAsync = promisify(pipeline)

export function makeHttpServer(config: ReaderConfigInterface) {
  const app: express.Application = express()
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
  const server = new ReaderServer(driver, config)

  app.use(expressWinston.logger({
    winstonInstance: logger
  }))

  app.use(cors({
    origin: '*',
    // Set the Access-Control-Max-Age header to 24 hours.
    maxAge: 86400,
    methods: 'GET,HEAD,OPTIONS',
    // Expose ETag http response header to client
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers
    exposedHeaders: 'Content-Type,ETag'
  }))

  const fileHandler = async (req: express.Request, res: express.Response) => {
    try {
      let filename = req.params[1]
      if (filename.endsWith('/')) {
        filename = filename.substring(0, filename.length - 1)
      }
      const address = req.params[0]

      if (config.cacheControl) {
        res.set('Cache-Control', config.cacheControl)
      }

      /**
       * for now only GET request is available. so will slash the next line of code and handleGet method 3rd arg
       */
      // const isGetRequest = req.method === 'GET'
      // const fileInfo = await server.handleGet(address, filename, isGetRequest)
      const fileInfo = await server.handleGet(address, filename)


      if (!fileInfo.exists) {
        return res.status(404).send('File not found')
      }

      res.set({
        'content-type': fileInfo.contentType,
        'etag': fileInfo.etag,
        'last-modified': fileInfo.lastModified.toUTCString(),
        'content-length': fileInfo.contentLength
      })
      /**
       * for now only GET request is available. so will slash the next line of case check
       */
      // if (isGetRequest) {
      await pipelineAsync(fileInfo.data, res)
      // }
      res.end()
    } catch (err) {
      logger.error(err)
      return res.status(400).send('Could not return file')
    }
  }

  const bucketFilePath = /\/([a-zA-Z0-9-_]+)\/(.+)/
  app.get(bucketFilePath, fileHandler)
  app.head(bucketFilePath, fileHandler)

  return app
}
