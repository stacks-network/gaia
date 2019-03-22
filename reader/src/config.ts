import winston from 'winston'
import fs from 'fs'
import process from 'process'
import { ConsoleTransportOptions } from 'winston/lib/winston/transports'


interface LoggingConfig {
  timestamp: boolean;
  colorize: boolean;
  json: boolean;
}

export interface DiskReaderConfig { 
  diskSettings: {
    storageRootDirectory: string
  };
}

export interface Config extends DiskReaderConfig {
  argsTransport: ConsoleTransportOptions & LoggingConfig;
  regtest: boolean;
  testnet: boolean;
  port: number;
  cacheControl?: string;
  diskSettings: {
    storageRootDirectory: string
  };
}

const configDefaults: Config = {
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

export const logger = winston.createLogger()

export function getConfig() {
  const configPath = process.env.CONFIG_PATH || process.argv[2] || './config.json'
  let config: Config
  try {
    config = { ...configDefaults, ...JSON.parse(fs.readFileSync(configPath).toString()) }
  } catch (e) {
    console.error(`Failed to read config: ${e}`)
    config = { ...configDefaults }
  }

  if (process.env['GAIA_DISK_STORAGE_ROOT_DIR']) {
    config.diskSettings.storageRootDirectory = process.env['GAIA_DISK_STORAGE_ROOT_DIR']
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

