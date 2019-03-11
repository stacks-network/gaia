import winston from 'winston'
import fs from 'fs'
import process from 'process'

export interface Config {
  [key: string]: any,
  apiKeys: string[],
  argsTransport: {
    level: string,
    handleExceptions: boolean,
    timestamp: boolean,
    stringify: boolean,
    colorize: boolean,
    json: boolean
  },
  reloadSettings: {
    command: string,
    argv: string[],
    env: NodeJS.ProcessEnv,
    setuid: number,
    setgid: number
  }
}

const configDefaults: Config = {
  argsTransport: {
    level: 'debug',
    handleExceptions: true,
    timestamp: true,
    stringify: true,
    colorize: true,
    json: true
  },
  port: 8009,
  apiKeys: [],
  authTimestampCacheSize: 50000,
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
    // TODO: log with winston
    console.error(`Error reading config "${configPath}": ${e}`)
    config = Object.assign({}, configDefaults)
  }
  logger.configure({
    transports: [
      new winston.transports.Console(config.argsTransport)]
  })
  return config
}

