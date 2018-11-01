import winston from 'winston'
import fs from 'fs'
import process from 'process'

import { getDriverClass } from './utils'

const configDefaults = {
  argsTransport: {
    level: 'warn',
    handleExceptions: true,
    timestamp: true,
    stringify: true,
    colorize: true,
    json: false
  },
  whitelist: null,
  readURL: null,
  driver: undefined,
  validHubUrls: undefined,
  requireCorrectHubUrl: false,
  serverName: 'gaia-0',
  bucket: 'hub',
  pageSize: 100,
  cacheControl: 'public, max-age=1',
  port: 3000,
  proofsConfig: 0
}

const globalEnvVars = { whitelist: 'GAIA_WHITELIST',
                        readURL: 'GAIA_READ_URL',
                        driver: 'GAIA_DRIVER',
                        validHubUrls: 'GAIA_VALID_HUB_URLS',
                        requireCorrectHubUrl: 'GAIA_REQUIRE_CORRECT_HUB_URL',
                        serverName: 'GAIA_SERVER_NAME',
                        bucket: 'GAIA_BUCKET_NAME',
                        pageSize: 'GAIA_PAGE_SIZE',
                        cacheControl: 'GAIA_CACHE_CONTROL',
                        port: 'GAIA_PORT' }

const parseInts = [ 'port', 'pageSize', 'requireCorrectHubUrl' ]
const parseLists = [ 'validHubUrls', 'whitelist' ]

function getConfigEnv(envVars) {

  const configEnv = {}
  for (const name in envVars) {
    const envVar = envVars[name]
    if (process.env[envVar]) {
      configEnv[name] = process.env[envVar]
      if (parseInts.indexOf(name) >= 0) {
        configEnv[name] = parseInt(configEnv[name])
        if (isNaN(configEnv[name])) {
          throw new Error(`Passed a non-number input to: ${envVar}`)
        }
      } else if (parseLists.indexOf(name) >= 0) {
        configEnv[name] = configEnv[name].split(',').map(x => x.trim())
      }
    }
  }
  return configEnv
}

export function getConfig() {
  const configPath = process.env.CONFIG_PATH || process.argv[2] || './config.json'
  let configJSON
  try {
    configJSON = JSON.parse(fs.readFileSync(configPath))
  } catch (err) {
    configJSON = {}
  }

  if (configJSON.servername) {
    if (!configJSON.serverName) {
      configJSON.serverName = configJSON.servername
    }
    delete configJSON.servername
  }

  const configENV = getConfigEnv(globalEnvVars)

  const configGlobal = Object.assign({}, configDefaults, configJSON, configENV)

  let config = configGlobal
  if (config.driver) {
    const driverClass = getDriverClass(config.driver)
    const driverConfigInfo = driverClass.getConfigInformation()
    config = Object.assign({}, driverConfigInfo.defaults, configGlobal, driverConfigInfo.envVars)
  }

  winston.configure({ transports: [
    new winston.transports.Console(config.argsTransport) ] })

  return config
}

