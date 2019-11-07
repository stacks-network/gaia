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

function logHttpListen() {
  logger.warn(`Http server listening on port ${conf.port} in ${app.settings.env} mode`)
}

function logHttpsListen() {
  logger.warn(`Https server listening on port ${conf.httpsPort} in ${app.settings.env} mode`)
}

if (conf.enableHttps === HttpsOption.acme) {
  // Start Express app server using ACME with greenlock-express middleware.
  logger.warn('Setting up https server with ACME')
  const server = acme.createGlx(app, conf.acmeConfig)
  server.listen(conf.port, conf.httpsPort, () => logHttpListen(), () => logHttpsListen())
} else if (conf.enableHttps === HttpsOption.cert_files) {
  logger.warn('Setting up https server with provided cert files')
  // Start Express app server with Node.js `https` and `http` modules.
  tlsServer.createHttpsServer(app, conf.tlsCertConfig).listen(conf.httpsPort, () => logHttpsListen())
  http.createServer(app).listen(conf.port, () => logHttpListen())
} else {
  logger.warn('Setting up an http server (https is not configured)')
  // Start Express app server with only `http`.
  http.createServer(app).listen(conf.port, () => logHttpListen())
}

driver.ensureInitialized().catch(error => {
  logger.error(`Failed to initialize driver ${error})`)
  process.exit()
})
