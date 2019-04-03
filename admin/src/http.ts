import express from 'express'
import expressWinston from 'express-winston'
import cors from 'cors'
import { AdminAPI } from './server'
import { Config, logger } from './config'


function writeResponse(res: express.Response, data: any, statusCode: number) {
  res.writeHead(statusCode, {'Content-Type' : 'application/json'})
  res.write(JSON.stringify(data))
  res.end()
}

export function makeHttpServer(config: Config) {
  const app = express()
  const server = new AdminAPI(config)

  app.use(expressWinston.logger({
    winstonInstance: logger
  }))

  app.use(cors())
  
  app.post(/\/v1\/admin\/reload/, (req: express.Request, res: express.Response) => {
    return server.checkAuthorization(req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return { statusCode: 403, status: { error: 'forbidden' } }
        }
        
        return server.handleReload()
      })
      .then(reloadStatus => writeResponse(res, reloadStatus.status, reloadStatus.statusCode))
  })

  app.get(/\/v1\/admin\/config/, (req: express.Request, res: express.Response) => {
    return server.checkAuthorization(req.headers['authorization'])
      .then((authResult) => {
        if (!authResult) {
          return { statusCode: 403, status: { error: 'forbidden' } }
        }

        return server.handleGetConfig()
      })
      .then((configData) => writeResponse(res, configData.status, configData.statusCode))
  })

  app.post(
    /\/v1\/admin\/config/, express.json(),
    (req: express.Request, res: express.Response) => {
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

