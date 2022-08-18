import { createLogger, transports, Logger, format } from 'winston'
import fs from 'fs'
import toml from 'toml'
import process from 'process'

import { DriverModel, DriverConstructor } from './driverModel.js'

import { DISK_CONFIG_TYPE } from './drivers/diskDriver.js'
import { IPFS_CONFIG_TYPE } from './drivers/IpfsDriver.js'

export type DriverName = 'disk' | 'ipfs'

export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug'

export interface LoggingConfigInterface {
  timestamp?: boolean;
  colorize?: boolean;
  json?: boolean;
  level?: LogLevel;
  handleExceptions?: boolean;
}

// LoggingConfig defaults
class LoggingConfig implements LoggingConfigInterface {
  /**
   * @default warn
   */
  level? = 'warn' as LogLevel
  handleExceptions? = true
  timestamp? = true
  colorize? = true
  json? = false
}

type SubType<T, K extends keyof T> = K extends keyof T ? T[K] : never;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ReaderConfigInterface extends ReaderConfig { }

export class ReaderConfig {
  /**
   * Required if `driver` is `disk`
   */
  diskSettings?: SubType<DISK_CONFIG_TYPE, 'diskSettings'>

  /**
   * Required if `driver` is `ipfs`
   */
  ipfsSettings?: SubType<IPFS_CONFIG_TYPE, 'ipfsSettings'>

  argsTransport? = new LoggingConfig()
  regtest = false
  testnet = false

  driver = undefined as DriverName

  /**
   * @minimum 0
   * @maximum 65535
   * @TJS-type integer
   */
  port = 8008
  cacheControl? = 'no-cache'

  /**
   * Only used in tests
   * @private
   * @ignore
   */
  driverInstance?: DriverModel

  /**
   * Only used in tests
   * @private
   * @ignore
   */
  driverClass?: DriverConstructor
}

const configDefaults: ReaderConfig = {
  cacheControl: 'no-cache',
  driver: 'disk',
  argsTransport: {
    level: 'debug',
    handleExceptions: true,
    timestamp: true,
    colorize: true,
    json: true
  },
  regtest: false,
  testnet: false,
  port: 8008,
  diskSettings: {
    storageRootDirectory: '/tmp/gaia-disk'
  }
}

export const logger: Logger = createLogger()

function getConfigJSON(configPath: string) {
  let configJSON
  try {
    const fileContent = fs.readFileSync(configPath, { encoding: 'utf8' })
    if (configPath.match(/\.json$/i)) {
      configJSON = JSON.parse(fileContent)
    } else if (configPath.match(/\.toml$/i)) {
      configJSON = toml.parse(fileContent)
    } else {
      configJSON = {}
    }
  } catch (err) {
    configJSON = {}
  }
  return configJSON
}

export function getConfig() {
  const configPath = process.env.CONFIG_PATH || process.argv[2] || './config.json'
  let config: ReaderConfig
  try {
    config = { ...configDefaults, ...configJSON }
  } catch (e) {
    console.error(`Failed to read config: ${e}`)
    config = { ...configDefaults }
  }

  if (process.env['GAIA_DISK_STORAGE_ROOT_DIR']) {
    config.diskSettings.storageRootDirectory = process.env['GAIA_DISK_STORAGE_ROOT_DIR']
  }

  const formats = [
    config.argsTransport.colorize ? format.colorize() : null,
    config.argsTransport.timestamp ?
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }) : null,
    config.argsTransport.json ? format.json() : format.simple()
  ].filter(f => f !== null)
  const formatResult = formats.length ? format.combine(...formats) : null

  logger.configure({
    format: formatResult,
    transports: [new transports.Console(config.argsTransport)]
  })

  return config
}

