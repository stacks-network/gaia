#!/usr/bin/env node

import winston from 'winston'
import { makeHttpServer } from './http.js'
import { getConfig } from './config.js'

const conf = getConfig()
const app = makeHttpServer(conf)

app.listen(
  conf.port,
  () => winston.warn(`server starting on port ${conf.port} in ${app.settings.env} mode`))

