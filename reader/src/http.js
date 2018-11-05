/* @flow */

import express from 'express'
import expressWinston from 'express-winston'
import logger from 'winston'
import cors from 'cors'
import Path from 'path'

import { 
  GaiaDiskReader
} from './server'

export function makeHttpServer(config: Object) {
  const app = express()
  const server = new GaiaDiskReader()

  app.config = config

  app.use(expressWinston.logger({
    transports: logger.loggers.default.transports }))

  app.use(cors())

  app.get(/\/([a-zA-Z0-9]+)\/(.+)/, (req: express.request, res: express.response) => {
    let filename = req.params[1]
    if (filename.endsWith('/')) {
      filename = filename.substring(0, filename.length - 1)
    }
    const address = req.params[0]

    return server.handleGet(config.storageRootDirectory, address, filename)
      .then((fileInfo) => {
        const exists = fileInfo.exists
        const contentType = fileInfo.contentType

        if (!exists) {
          return res.status(404).send('File not found')
        }

        const opts = {
          root: config.storageRootDirectory,
          headers: {
            'content-type': contentType
          }
        }
        const path = Path.join(address, filename)

        return res.sendFile(path, opts)
      })
  })

  return app
}

