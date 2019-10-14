import * as path from 'path'
import { makeHttpServer } from './server/http'
import { getConfig, validateConfigSchema } from './server/config'
import { logger } from './server/utils'

const appRootDir = path.dirname(path.resolve(__dirname))
const schemaFilePath = path.join(appRootDir, 'config-schema.json')

const conf = getConfig()
validateConfigSchema(schemaFilePath, conf)

const { app, driver } = makeHttpServer(conf)

app.listen(conf.port,
           () => logger.warn(`Listening on port ${conf.port} in ${app.settings.env} mode`))

driver.ensureInitialized().catch(error => {
  logger.error(`Failed to initialize driver ${error})`)
  process.exit()
})
