import winston from 'winston'
import fs from 'fs'
import process from 'process'
import type { HubServerConfig } from './server'

const configDefaults : HubServerConfig = {
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

export function getConfig(): HubServerConfig {
  const configPath = process.env.CONFIG_PATH || process.argv[2] || './config.json'
  let config: HubServerConfig
  try {
    config = Object.assign(
      {}, configDefaults, JSON.parse(fs.readFileSync(configPath).toString()))
  } catch (e) {
    config = Object.assign({}, configDefaults)
  }

  winston.configure({ transports: [
    new winston.transports.Console(config.argsTransport) ] })

  return config
}

