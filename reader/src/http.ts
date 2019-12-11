import * as express from 'express'
import * as expressWinston from 'express-winston'
import * as cors from 'cors'
import * as Path from 'path'
import { Config, logger } from './config'
import { GaiaDiskReader } from './server'

export function makeHttpServer(config: Config) {
  const app = express()
  const server = new GaiaDiskReader(config)

  app.use(expressWinston.logger({
    winstonInstance: logger
  }))

  app.use(cors())

  app.get(/\/([a-zA-Z0-9-_]+)\/(.+)/, (req, res) => {
    let filename = req.params[1]
    if (filename.endsWith('/')) {
      filename = filename.substring(0, filename.length - 1)
    }
    const address = req.params[0]

    if (config.cacheControl) {
      res.set('Cache-Control', config.cacheControl)
    }

    return server.handleGet(address, filename)
      .then((fileInfo) => {
        const exists = fileInfo.exists
        const contentType = fileInfo.contentType
        const etag = fileInfo.etag

        if (!exists) {
          return res.status(404).send('File not found')
        }

        const opts = {
          root: config.diskSettings.storageRootDirectory,
          headers: {
            'content-type': contentType,
            'etag': etag
          }
        }
        const path = Path.join(address, filename)

        return res.sendFile(path, opts)
      })
      .catch((err) => {
        logger.error(err)
        return res.status(400).send('Could not return file')
      })
  })

  return app
}

