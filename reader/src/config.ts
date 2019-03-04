import winston from 'winston'
import fs from 'fs'
import process from 'process'

const configDefaults = {
  argsTransport: {
    level: 'debug',
    handleExceptions: true,
    timestamp: true,
    stringify: true,
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

export function getConfig() {
  const configPath = process.env.CONFIG_PATH || process.argv[2] || './config.json'
  let config = { ...configDefaults }
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(configPath).toString()) }
  } catch (e) {
    console.error(`Failed to read config: ${e}`)
  }

  if (process.env['GAIA_DISK_STORAGE_ROOT_DIR']) {
    config.diskSettings.storageRootDirectory = process.env['GAIA_DISK_STORAGE_ROOT_DIR']
  }

  winston.configure({ transports: [
    new winston.transports.Console(config.argsTransport) ] })

  return config
}

