import * as glx from 'greenlock-express'
import { Application as ExpressApp } from 'express'
import { AcmeConfigInterface } from './config'

export function createGlx(app: ExpressApp, acmeConfig: AcmeConfigInterface): glx.GreenlockExpressInstance {
  if (!acmeConfig) {
    throw new Error('`acmeConfig` must be provided')
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const glxStore: any = require('greenlock-store-fs')
  const opts: glx.GreenlockExpressOptions = {
    app: app,
    store: glxStore,
    email: acmeConfig.email,
    agreeTos: acmeConfig.agreeTos,
    configDir: acmeConfig.configDir || '~/.config/acme/',
    communityMember: acmeConfig.communityMember || false,
    securityUpdates: acmeConfig.securityUpdates,
    telemetry: acmeConfig.telemetry || false,
    servername: acmeConfig.servername,
    approveDomains: acmeConfig.approveDomains,
    server: acmeConfig.server,
    version: acmeConfig.version || 'v02',
    debug: acmeConfig.debug
  }
  return glx.create(opts)
}
