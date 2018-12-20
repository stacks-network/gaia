/* @flow */

import express from 'express'
import expressWinston from 'express-winston'
import logger from 'winston'
import cors from 'cors'

import { 
  AdminAPI
} from './server'


function writeResponse(res: express.response, data: Object, statusCode: number) {
  res.writeHead(statusCode, {'Content-Type' : 'application/json'})
  res.write(JSON.stringify(data))
  res.end()
}

export function makeHttpServer(config: Object) {
  const app = express()
  const server = new AdminAPI(config)

  app.config = config

  app.use(expressWinston.logger({
    transports: logger.loggers.default.transports }))

  app.use(cors())
  
  app.post(/\/v1\/admin\/reload/, (req: express.request, res: express.response) => {
    return server.checkAuthorization(req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return { statusCode: 403, status: { error: 'forbidden' } }
        }
        
        return server.handleReload()
      })
      .then(reloadStatus => writeResponse(res, reloadStatus.status, reloadStatus.statusCode))
  })

  app.get(/\/v1\/admin\/config/, (req: express.request, res: express.response) => {
    return server.checkAuthorization(req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return { statusCode: 403, status: { error: 'forbidden' } }
        }

        return server.handleGetConfig()
      })
      .then((configData) => writeResponse(res, configData.status, configData.statusCode))
  })

  app.post(/\/v1\/admin\/config/, express.json(),
    (req: express.request, res: express.response) => {
    return server.checkAuthorization(req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return { statusCode: 403, status: { error: 'forbidden' } }
        }

        const newConfig = req.body
        return server.handleSetConfig(newConfig)
      })
      .then((configStatus) => writeResponse(res, configStatus.status, configStatus.statusCode))
  })

  return app
}

