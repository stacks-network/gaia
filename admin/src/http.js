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

  app.get(/\/v1\/admin\/whitelist/, (req: express.request, res: express.response) => {
    return server.checkAuthorization(req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return { statusCode: 403, status: { error: 'forbidden' } }
        }

        return server.handleGetWhitelist()
      })
      .then((configData) => writeResponse(res, configData.status, configData.statusCode))
  })

  app.post(/\/v1\/admin\/whitelist/, express.json(),
    (req: express.request, res: express.response) => {
    return server.checkAuthorization(req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return { statusCode: 403, status: { error: 'forbidden' } }
        }

        const newWhitelist = req.body
        return server.handleSetWhitelist(newWhitelist)
      })
      .then((configStatus) => writeResponse(res, configStatus.status, configStatus.statusCode))
  })

  app.get(/\/v1\/admin\/gaia/, (req: express.request, res: express.response) => {
    return server.checkAuthorization(req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return { statusCode: 403, status: { error: 'forbidden' } }
        }

        return server.handleGetGaiaSettings()
      })
      .then((configData) => writeResponse(res, configData.status, configData.statusCode))
  })

  app.post(/\/v1\/admin\/gaia/, express.json(), 
    (req: express.request, res: express.response) => {
    return server.checkAuthorization(req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return { statusCode: 403, status: { error: 'forbidden' } }
        }

        const newGaiaSettings = req.body
        return server.handleSetGaiaSettings(newGaiaSettings)
      })
      .then((configStatus) => writeResponse(res, configStatus.status, configStatus.statusCode))
  })

  app.get(/\/v1\/admin\/driver/, (req: express.request, res: express.response) => {
    return server.checkAuthorization(req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return { statusCode: 403, status: { error: 'forbidden' } }
        }

        return server.handleGetDriverSettings()
      })
      .then((configData) => writeResponse(res, configData.status, configData.statusCode))
  })

  app.post(/\/v1\/admin\/driver/, express.json(), 
    (req: express.request, res: express.response) => {
    return server.checkAuthorization(req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return { statusCode: 403, status: { error: 'forbidden' } }
        }

        const newDriverSettings = req.body
        return server.handleSetDriverSettings(newDriverSettings)
      })
      .then((configStatus) => writeResponse(res, configStatus.status, configStatus.statusCode))
  })

  return app
}

