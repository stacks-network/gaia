import winston from 'winston'
import fs from 'fs'
import process from 'process'
import { ConsoleTransportOptions } from 'winston/lib/winston/transports'

interface LoggingConfig {
  timestamp: boolean;
  colorize: boolean;
  json: boolean;
}

export interface Config {
  [key: string]: any;
  apiKeys: string[];
  argsTransport: ConsoleTransportOptions & LoggingConfig;
  reloadSettings: {
    command: string;
    argv: string[];
    env: NodeJS.ProcessEnv;
    setuid: number;
    setgid: number;
  }
}

const configDefaults: Config = {
  argsTransport: {
    level: 'debug',
    handleExceptions: true,
    timestamp: true,
    colorize: true,
    json: true
  },
  port: 8009,
  apiKeys: [],
  gaiaSettings: {
    configPath: '/tmp/gaia-config.json'
  },
  reloadSettings: {
    command: '',
    argv: [],
    env: {},
    setuid: 1000,
    setgid: 1000
  }
}

export const logger = winston.createLogger()

export function getConfig() {

  const configPath = process.env.CONFIG_PATH || process.argv[2] || './config.json'
  let config: Config
  try {
    config = Object.assign(
      {}, configDefaults, JSON.parse(fs.readFileSync(configPath).toString()))
  } catch (e) {
    console.error(`Error reading config "${configPath}": ${e}`)
    config = Object.assign({}, configDefaults)
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

