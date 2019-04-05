import winston from 'winston'
import fs from 'fs'
import process from 'process'

import { getDriverClass, logger } from './utils'
import { DriverModel, DriverConstructor } from './driverModel'

import { AZ_CONFIG_TYPE } from './drivers/AzDriver'
import { DISK_CONFIG_TYPE } from './drivers/diskDriver'
import { GC_CONFIG_TYPE } from './drivers/GcDriver'
import { S3_CONFIG_TYPE } from './drivers/S3Driver'

export type DriverName = 'aws' | 'azure' | 'disk' | 'google-cloud'

export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug'

export interface LoggingConfig {
  timestamp?: boolean;
  colorize?: boolean;
  json?: boolean;
  level?: LogLevel;
  handleExceptions?: boolean;
}

export interface ProofCheckerConfig { 
  /**
   * @TJS-type integer
   */
  proofsRequired?: number;
}

export interface HubConfigInterface {
  whitelist?: string[];
  serverName: string;
  authTimestampCacheSize?: number;
  readURL?: string;
  requireCorrectHubUrl?: boolean;
  validHubUrls?: string[];
  port?: number;
  bucket?: string;
  pageSize?: number;
  cacheControl?: string;
  argsTransport?: LoggingConfig;
  proofsConfig?: ProofCheckerConfig;
  driver?: DriverName;

  /**
   * Only used in tests
   * @private
   * @ignore
   */
  driverInstance?: DriverModel;

  /**
   * Only used in tests
   * @private
   * @ignore
   */
  driverClass?: DriverConstructor;
}

// Class responsible for specifying default config values,
// as well as used for generating the config-schema.json file. 
class HubConfig implements HubConfigInterface, AZ_CONFIG_TYPE, DISK_CONFIG_TYPE, GC_CONFIG_TYPE, S3_CONFIG_TYPE {
  argsTransport = {
    /**
     * @default warn
     */
    level: 'warn' as LogLevel,
    handleExceptions: true,
    timestamp: true,
    colorize: true,
    json: false
  };
  proofsConfig = {
    proofsRequired: undefined as number
  };
  requireCorrectHubUrl = false;
  serverName = 'gaia-0';
  bucket = 'hub';
  /**
   * @minimum 1
   * @maximum 4096
   * @TJS-type integer
   */
  pageSize = 100;
  cacheControl = 'public, max-age=1';
  /**
   * @minimum 0
   * @maximum 65535
   * @TJS-type integer
   */
  port = 3000;
  /**
   * @TJS-type integer
   */
  authTimestampCacheSize = 50000;

  driver = undefined as DriverName;

  // --- Optional values with unused defaults
  whitelist = undefined as string[]
  readURL = undefined as string;
  validHubUrls = undefined as string[];
  // ---

  /**
   * Required if `driver` is `azure`
   */
  azCredentials = {
    accountName: undefined as string,
    accountKey: undefined as string
  };

  /**
   * Required if `driver` is `disk`
   */
  diskSettings = {
    storageRootDirectory: undefined as string 
  };

  /**
   * Required if `driver` is `google-cloud`
   */
  gcCredentials = {
    projectId: undefined as string,
    credentials: {
      private_key: undefined as string,
      client_email: undefined as string
    }
  };

  /**
   * Required if `driver` is `aws`
   */
  awsCredentials = {
    endpoint: undefined as string,
    accessKeyId: undefined as string,
    secretAccessKey: undefined as string
  };
}


export const configDefaults: HubConfigInterface = new HubConfig()


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

function getConfigEnv(envVars: {[key: string]: string}) {
  const configEnv: {[key: string]: any} = {}
  for (const name in envVars) {
    const envVar = envVars[name]
    if (process.env[envVar]) {
      console.log(process.env[envVar])
      configEnv[name] = process.env[envVar]
      if (parseInts.indexOf(name) >= 0) {
        configEnv[name] = parseInt(configEnv[name])
        if (isNaN(configEnv[name])) {
          throw new Error(`Passed a non-number input to: ${envVar}`)
        }
      } else if (parseLists.indexOf(name) >= 0) {
        configEnv[name] = (<string>configEnv[name]).split(',').map(x => x.trim())
      }
    }
  }
  return configEnv
}

// we deep merge so that if someone sets { field: {subfield: foo} }, it doesn't remove
//                                       { field: {subfieldOther: bar} }
function deepMerge<T>(target: T, ...sources: T[]): T {
  function isObject(item: any) {
    return (item && typeof item === 'object' && !Array.isArray(item))
  }

  if (sources.length === 0) {
    return target
  }

  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} })
        deepMerge(target[key], source[key])
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return deepMerge(target, ...sources)
}

export function getConfig() {
  const configPath = process.env.CONFIG_PATH || process.argv[2] || './config.json'
  let configJSON
  try {
    configJSON = JSON.parse(fs.readFileSync(configPath, { encoding: 'utf8' }))
  } catch (err) {
    configJSON = {}
  }

  if (configJSON.servername) {
    if (!configJSON.serverName) {
      configJSON.serverName = configJSON.servername
    }
    delete configJSON.servername
  }

  const configENV = getConfigEnv(globalEnvVars) as any

  const configGlobal = deepMerge<HubConfigInterface>({} as any, configDefaults, configJSON, configENV)

  let config = configGlobal
  if (config.driver) {
    const driverClass = getDriverClass(config.driver)
    const driverConfigInfo = driverClass.getConfigInformation()
    config = deepMerge<HubConfigInterface>({} as any, driverConfigInfo.defaults, configGlobal, driverConfigInfo.envVars)
  }

  const formats = [
    config.argsTransport.colorize ? winston.format.colorize() : null,
    config.argsTransport.timestamp ?
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }) : null,
    config.argsTransport.json ? winston.format.json() : winston.format.simple()
  ].filter(f => f !== null)
  const format = formats.length ? winston.format.combine(...formats) : null

  logger.configure({
    format: format,
    transports: [new winston.transports.Console(config.argsTransport)]
  })

  return config
}

