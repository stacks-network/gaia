#!/usr/bin/env node
import winston from 'winston'
import { makeHttpServer } from './server/http.js'
import { getConfig } from './server/config.js'

const conf = getConfig()

const app = makeHttpServer(conf)

app.listen(conf.port,
           () => winston.warn(`Listening on port ${conf.port} in ${app.settings.env} mode`))
