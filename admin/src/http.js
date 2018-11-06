/* @flow */

import express from 'express'
import expressWinston from 'express-winston'
import logger from 'winston'
import cors from 'cors'
import Path from 'path'

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
  const server = new AdminAPI()

  app.config = config

  app.use(expressWinston.logger({
    transports: logger.loggers.default.transports }))

  app.use(cors())
  
  app.post(/\/v1\/admin\/reload/, (req: express.request, res: express.response) => {
    return server.checkAuthorization(config, req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return writeResponse(res, { 'error': 'forbidden' }, 403)
        }
        
        return server.handleReload(config)
      })
      .then(reloadStatus => writeResponse(res, reloadStatus.status, reloadStatus.statusCode))
  })

  return app
}

