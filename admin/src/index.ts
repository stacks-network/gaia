#!/usr/bin/env node
import { makeHttpServer } from './http.js'
import { getConfig, logger } from './config.js'

const conf = getConfig()
const app = makeHttpServer(conf)

app.listen(
  conf.port,
  () => logger.warn(`server starting on port ${conf.port} in ${app.settings.env} mode`))
