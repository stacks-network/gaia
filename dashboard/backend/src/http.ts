import express from 'express'
import expressWinston from 'express-winston'
import cors from 'cors'
import { Server } from './server.js'
import { Config, logger } from './config.js'


function writeResponse(res: express.Response, data: any, statusCode: number) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.write(JSON.stringify(data))
  res.end()
}

export function makeHttpServer(config: Config) {
  const app = express()
  const server = new Server(config)

  app.use(expressWinston.logger({
    winstonInstance: logger
  }))

  app.use(cors())

  app.post(/\/v1\/hub\/config/, express.json(), (req: express.Request, res: express.Response) => {
    const newConfig = req.body
    return server.handleSetHubConfig(newConfig).then((configStatus) => writeResponse(res, configStatus.status, configStatus.statusCode))
  })

  app.get(/\/v1\/hub\/config/, (req: express.Request, res: express.Response) => {
    void server.handleGetHubConfig().then((configStatus) => writeResponse(res, configStatus.status, configStatus.statusCode))
  })

  app.post(/\/v1\/admin\/config/, express.json(), (req: express.Request, res: express.Response) => {
    const newConfig = req.body
    return server.handleSetAdminConfig(newConfig).then((configStatus) => writeResponse(res, configStatus.status, configStatus.statusCode))
  })

  app.get(/\/v1\/admin\/config/, (req: express.Request, res: express.Response) => {
    void server.handleGetAdminConfig().then((configStatus) => writeResponse(res, configStatus.status, configStatus.statusCode))
  })

  app.post(/\/v1\/reader\/config/, express.json(), (req: express.Request, res: express.Response) => {
    const newConfig = req.body
    return server.handleSetReaderConfig(newConfig).then((configStatus) => writeResponse(res, configStatus.status, configStatus.statusCode))
  })

  app.get(/\/v1\/reader\/config/, (req: express.Request, res: express.Response) => {
    void server.handleGetReaderConfig().then((configStatus) => writeResponse(res, configStatus.status, configStatus.statusCode))
  })

  return app
}

