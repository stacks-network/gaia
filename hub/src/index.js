#!/usr/bin/env node
import logger from 'winston'
import { makeHttpServer } from './server/http.js'
import { getConfig } from './server/config.js'

const conf = getConfig()
const app = makeHttpServer(conf)

app.listen(
  app.config.port,
  () => logger.warn(`server starting on port ${app.config.port} in ${app.settings.env} mode`))
