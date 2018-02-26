import winston from 'winston'
import server from './server/server.js'
import { getConfig } from './server/config.js'

const conf = getConfig()
const app = server(conf)

app.listen(
  app.config.port,
  () => winston.warn(`server starting on port ${app.config.port} in ${app.settings.env} mode`))
