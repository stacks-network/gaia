import winston from 'winston'
import fs from 'fs'
import process from 'process'
import { ConsoleTransportOptions } from 'winston/lib/winston/transports'
import { getErrorMessage, notEmpty } from './utils';

interface LoggingConfig {
  timestamp: boolean;
  colorize: boolean;
  json: boolean;
}

export interface ModuleSettings {
  configPath: string;
  reloadCommandLine: {
    command: string;
    argv: string[];
    env: NodeJS.ProcessEnv;
    setuid: number;
    setgid: number;
  }
}

export interface Config {
  argsTransport: ConsoleTransportOptions & LoggingConfig;
  port: number;
  hubSettings: ModuleSettings;
  adminSettings: ModuleSettings;
  readerSettings: ModuleSettings;
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
  hubSettings: {
    configPath: '/tmp/hub-config.json',
    reloadCommandLine: {
      command: '',
      argv: [],
      env: {},
      setuid: 1000,
      setgid: 1000
    }
  },
  adminSettings: {
    configPath: '/tmp/admin-config.json',
    reloadCommandLine: {
      command: '',
      argv: [],
      env: {},
      setuid: 1000,
      setgid: 1000
    }
  },
  readerSettings: {
    configPath: '/tmp/reader-config.json',
    reloadCommandLine: {
      command: '',
      argv: [],
      env: {},
      setuid: 1000,
      setgid: 1000
    }
  },
}

export const hubConfigSchema = {
	type: 'object',
	properties: {
		// generic gaia settings
		validHubUrls: {
			type: 'array',
			items: { type: 'string', pattern: '^http://.+|https://.+$' }
		},
		requireCorrectHubUrl: { type: 'boolean' },
		serverName: { type: 'string', pattern: '.+' },
		port: { type: 'integer', minimum: 1024, maximum: 65534 },
		proofsConfig: {
			proofsRequired: { type: 'integer', minimum: 0 }
		},

		// whitelist
		whitelist: {
			type: 'array',
			items: {
				type: 'string',
				pattern: '^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$'
			}
		},

		// driver settings & credentials
		driver: { type: 'string', pattern: '.+' },
		readURL: { type: 'string', pattern: '^http://.+$|https://.+$' },
		pageSize: { type: 'integer', minimum: 1 },
		bucket: { type: 'string', pattern: '.+' },
		cacheControl: { type: 'string', pattern: '.+' },
		azCredentials: {
			accountName: { type: 'string', pattern: '.+' },
			accountKey: { type: 'string', pattern: '.+' }
		},
		diskSettings: {
			storageRootDirectory: { type: 'string' }
		},
		gcCredentials: {
			email: { type: 'string' },
			projectId: { type: 'string' },
			keyFilename: { type: 'string' },
			credentials: {
				type: 'object',
				properties: {
					/* eslint-disable-next-line camelcase */
					client_email: { type: 'string' },
					/* eslint-disable-next-line camelcase */
					private_key: { type: 'string' }
				}
			}
		},
		awsCredentials: {
			accessKeyId: { type: 'string' },
			secretAccessKey: { type: 'string' },
			sessionToken: { type: 'string' }
		}
	}
}

export const adminConfigSchema = {
  type: 'object',
	properties: {
    port: { type: 'integer', minimum: 1024, maximum: 65534 },
    apiKeys: {
			type: 'array',
			items: { type: 'string', pattern: '.+' }
		},
    gaiaSettings: {
      type: 'object',
      properties: {
        configPath: { type: 'string' }
      }
    },
    reloadSettings: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        argv: {
          type: 'array',
          items: { type: 'string' }
        },
        env: { type: 'object' },
        setuid: { type: 'integer' },
        setgid: { type: 'integer' }
      }
    }
  }
}

export const readerConfigSchema = {
  type: 'object',
	properties: {
    port: { type: 'integer', minimum: 1024, maximum: 65534 },
    cacheControl: { type: 'string' },
    diskSettings: {
      type: 'object',
      properties: {
        storageRootDirectory: { type: 'string' }
      }
    },
    regtest: { type: 'boolean' },
    testnet: { type: 'boolean' }
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
    console.error(`Error reading config "${configPath}": ${getErrorMessage(e)}`)
    config = Object.assign({}, configDefaults)
  }

  const formats = [
    config.argsTransport.colorize ? winston.format.colorize() : null,
    config.argsTransport.timestamp ?
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }) : null,
    config.argsTransport.json ? winston.format.json() : winston.format.simple()
  ].filter(notEmpty)
  const format = formats.length ? winston.format.combine(...formats) : undefined

  logger.configure({
    format: format, 
    transports: [new winston.transports.Console(config.argsTransport)]
  })

  return config
}
