#!/usr/bin/env node
import { makeHttpServer } from './server/http'
import { getConfig } from './server/config'
import { logger } from './server/utils'

const conf = getConfig()

const { app, driver } = makeHttpServer(conf)

app.listen(conf.port,
           () => logger.warn(`Listening on port ${conf.port} in ${app.settings.env} mode`))

driver.ensureInitialized().catch(error => {
  logger.error(`Failed to initialize driver ${error})`)
  process.exit()
})
