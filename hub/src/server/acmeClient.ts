import * as glx from 'greenlock-express'
import { Application as ExpressApp } from 'express'
import { AcmeConfigInterface } from './config'

export function createGlx(app: ExpressApp, acmeConfig: AcmeConfigInterface): glx.GreenlockExpressInstance {
  if (!acmeConfig) {
    throw new Error('`acmeConfig` must be provided')
  }
  const opts: glx.GreenlockExpressOptions = {
    app: app,
    email: acmeConfig.email,
    agreeTos: acmeConfig.agreeTos,
    configDir: acmeConfig.configDir || '~/.config/acme/',
    communityMember: acmeConfig.communityMember || false,
    securityUpdates: acmeConfig.securityUpdates,
    telemetry: acmeConfig.telemetry || false,
    servername: acmeConfig.servername,
    approveDomains: acmeConfig.approveDomains,
    server: acmeConfig.server
  }
  return glx.create(opts)
}
