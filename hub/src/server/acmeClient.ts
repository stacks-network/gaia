import * as glx from '@root/greenlock-express'
// @ts-ignore
import * as greenlock from '@root/greenlock'
import * as path from 'path'
import * as util from 'util'
import { AcmeConfigInterface } from './config'
import { getHostname } from './fqdn'


export async function createGlx(
  acmeConfig: AcmeConfigInterface, 
  packageRoot: string): Promise<glx.GreenlockExpressInstance> {
  
  if (!acmeConfig) {
    throw new Error('`acmeConfig` must be provided')
  }

  const fqdn = await getHostname()
  
  const pkg = require(path.join(packageRoot, 'package.json'))
  const packageAgent = `${pkg.name}/${pkg.version}`

  const opts: any & glx.GreenlockExpressOptions = {
    maintainerEmail: acmeConfig.email,
    agreeToTerms: acmeConfig.agreeTos,
    servername: acmeConfig.servername,
    directoryUrl: acmeConfig.directoryUrl,
    staging: acmeConfig.staging,
    debug: acmeConfig.debug,
    packageRoot: packageRoot,
    packageAgent: packageAgent
  }

  const gl = greenlock.create(opts)

  const fullConfig = await gl.manager
    .defaults({
      agreeToTerms: acmeConfig.agreeTos,
      subscriberEmail: acmeConfig.email,
      /*store: {
        module: 'greenlock-store-fs',
        basePath: path.join(process.cwd(), '.greenlock-config')
      }*/
    })

  const cTest = await gl.manager.defaults()

  const site = await gl.add({
    subject: acmeConfig.servername,
    altnames: [acmeConfig.servername],
    debug: true
  })
  console.log(`Setup site: ${util.inspect(site)}`)
  
  // const glxStoreFs = require('greenlock-store-fs')
  // opts.manager = glxStoreFs.create({})

  const initResult = glx.init(() => {
    return { greenlock: gl }
  })
  const instance = await new Promise<glx.GreenlockExpressInstance>((resolve, reject) => {
    try {
      initResult.ready(inst => resolve(inst))
    } catch (error) {
      reject(error)
    }
  })
  return instance
}
