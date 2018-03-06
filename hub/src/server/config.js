import winston from 'winston'
import fs from 'fs'

const configDefaults = {
  argsTransport: {
    level: 'warn',
    handleExceptions: true,
    timestamp: true,
    stringify: true,
    colorize: true,
    json: true
  }
}

export function getConfig() {
  const configPath = process.env.CONFIG_PATH || './config.json'
  const config = Object.assign(
    {}, configDefaults, JSON.parse(fs.readFileSync(configPath)))

  winston.configure({ transports: [
    new winston.transports.Console(config.argsTransport) ] })

  return config
}

