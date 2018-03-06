import winston from 'winston'
import { makeHttpServer } from './server/http.js'
import { getConfig } from './server/config.js'

const conf = getConfig()
const app = makeHttpServer(conf)

app.listen(
  app.config.port,
  () => winston.warn(`server starting on port ${app.config.port} in ${app.settings.env} mode`))
