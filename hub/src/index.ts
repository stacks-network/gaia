import * as path from 'path'
import { makeHttpServer } from './server/http'
import { getConfig, validateConfigSchema, HttpsOption } from './server/config'
import { logger } from './server/utils'
import * as http from 'http'
import * as tlsServer from './server/tlsServer'
import * as acme from './server/acmeClient'

const appRootDir = path.dirname(path.resolve(__dirname))
const schemaFilePath = path.join(appRootDir, 'config-schema.json')

const conf = getConfig()
validateConfigSchema(schemaFilePath, conf)

const { app, driver } = makeHttpServer(conf)

if (conf.enableHttps === HttpsOption.acme) {
  const server = acme.createGlx(app, conf.acmeConfig)
  server.listen(conf.port, conf.httpsPort, () => {
    logger.warn(`Http server listening on port ${conf.port} in ${app.settings.env} mode`)
  }, () => {
    logger.warn(`Https server listening on port ${conf.httpsPort} in ${app.settings.env} mode`)
  })
} else if (conf.enableHttps === HttpsOption.cert_files) {
  tlsServer.createHttpsServer(app, conf.tlsCertConfig).listen(conf.httpsPort, () => {
    logger.warn(`Https server listening on port ${conf.httpsPort} in ${app.settings.env} mode`)
  })
  http.createServer(app).listen(conf.port, () => {
    logger.warn(`Http server listening on port ${conf.port} in ${app.settings.env} mode`)
  })
} else {
  http.createServer(app).listen(conf.port, () => {
    logger.warn(`Http server listening on port ${conf.port} in ${app.settings.env} mode`)
  })
}

driver.ensureInitialized().catch(error => {
  logger.error(`Failed to initialize driver ${error})`)
  process.exit()
})
