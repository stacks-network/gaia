#!/usr/bin/env node
import winston from 'winston'
import { makeHttpServer } from './server/http'
import { getConfig } from './server/config'

const conf = getConfig()

const { app, driver } = makeHttpServer(conf)

app.listen(conf.port,
           () => winston.warn(`Listening on port ${conf.port} in ${app.settings.env} mode`))

driver.ensureInitialized().catch(error => {
  winston.error(`Failed to initialize driver ${error})`)
  process.exit()
})
