import fs from 'fs'
import path from 'path'
import childProcess from 'child_process'
import Ajv from 'ajv'
import { Config, logger } from './config.js'
import toml from 'toml'
import json2toml from 'json2toml'

function runSubprocess(
  cmd: string, 
  argv: Array<string>, 
  env: NodeJS.ProcessEnv, 
  uid?: number, 
  gid?: number
): Promise<{ 'status': any, 'statusCode': number }> {
  const opts: childProcess.SpawnOptions = {
    cwd: '/',
    env: env,
    stdio: [
      null,             // no stdin
      'pipe',           // send stdout to log
      'pipe'            // send stderr to log
    ],
    detached: false,    // child will die with this process, if need be
    shell: false,
    windowsHide: true
  }

  if (!!uid) {
    opts.uid = uid
  }

  if (!!gid) {
    opts.gid = gid
  }
  
  return new Promise((resolve) => {
    childProcess.spawn(cmd, argv, opts)
      .on('exit', (code: number, signal: string) => {
        if (code === 0) {
          const ret = { statusCode: 200, status: { result: 'OK' } }
          resolve(ret)
        } else {
          const ret = { 
            statusCode: 500, 
            status: { error: `Command exited with code ${code} (signal=${signal})` }
          }
          resolve(ret)
        }
      })
      .on('close', (code: number, signal: string) => {
        if (code === 0) {
          const ret = { statusCode: 200, status: { result: 'OK' } }
          resolve(ret)
        } else {
          const ret = { 
            statusCode: 500, 
            status: { error: `Command closed with code ${code} (signal=${signal})` }
          }
          resolve(ret)
        }
      })  
      .on('error', () => {
        const ret = { 
          statusCode: 500, 
          status: { error: 'Command could not be spawned, killed, or signaled' }
        }
        resolve(ret)
      })
  })
}

function readConfigFile(configFilePath: string): any {
  const configData = fs.readFileSync(configFilePath).toString()
  let config
  if (configFilePath.match(/\.json$/i)) {
    config = JSON.parse(configData)
  } else if (configFilePath.match(/\.toml$/i)) {
    config = Object.assign({}, toml.parse(configData))
  } else {
    config = JSON.parse(configData)
  }
  return config
}

function writeConfigFile(configFilePath: string, config: any) {
  let configData
  if (configFilePath.match(/\.json$/i)) {
    configData = JSON.stringify(config, null, 2)
  } else if (configFilePath.match(/\.toml$/i)) {
    configData = json2toml(config, { indent: 2, newlineAfterSection: true })
  } else {
    configData = JSON.stringify(config, null, 2)
  }
  fs.writeFileSync(configFilePath, configData)
}

// Atomically modify the config file.
// The Gaia config file is a set of key/value pairs, where each top-level key is one aspect
// of its configuration.  THis method "patches" the set of key/value pairs with `newFields`.
// The set of top-level key/value pairs in the existing config file and `newFields` will be merged,
// but if key1 === key2, then value2 overwrites value1 completely (even if value1 and value2 are
// objects with their own key/value pairs).
export function patchConfigFile(configFilePath: string, newFields: {[key: string]: any}) {
  if (!configFilePath) {
    throw new Error('Config file not given')
  }

  try {
    fs.accessSync(configFilePath, fs.constants.R_OK | fs.constants.W_OK)
  } catch (e) {
    logger.error(`Config file does not exist or cannot be read/written: ${configFilePath}`)
    throw new Error('Config file does not exist or cannot be read/written')
  }

  let config

  try {
    config = readConfigFile(configFilePath)
  } catch (e) {
    logger.error(`Failed to read config file: ${e.message}`)
    throw new Error('Failed to read config file')
  }

  config = Object.assign(config, newFields)
  // const tmpConfigPath = `${configFilePath}.new`
  const tmpConfigPath = path.join(path.dirname(configFilePath), `new.${path.basename(configFilePath)}`)

  try {
    writeConfigFile(tmpConfigPath, config)
  } catch (e) {
    logger.error(`Failed to write config file: ${e.message}`)
    throw new Error('Failed to write new config file')
  }

  try {
    fs.renameSync(tmpConfigPath, configFilePath)
  } catch (e) {
    logger.error(`Failed to rename config file: ${e.message}`)
    throw new Error('Failed to update config file')
  }
}

// get part(s) of a config file 
export function readConfigFileSections(configFilePath: string, fields: string | Array<string>): any {

  if (!configFilePath) {
    throw new Error('Config file nto given')
  }

  try {
    fs.accessSync(configFilePath, fs.constants.R_OK)
  } catch (e) {
    logger.error(`Config file does not exist or cannot be read: ${configFilePath}`)
    throw new Error('Config file does not exist or cannot be read')
  }

  let config
  const ret: {[key: string]: any} = {}

  try {
    config = readConfigFile(configFilePath)
  } catch (e) {
    logger.error(`Failed to read config file: ${e.message}`)
    throw new Error('Failed to read config file')
  }

  if (typeof fields === 'string') {
    fields = [fields]
  }

  for (let i = 0; i < fields.length; i++) {
    if (config[fields[i]] !== undefined) {
      ret[fields[i]] = config[fields[i]]
    }
  }

  return ret
}

const GAIA_CONFIG_SCHEMA = {
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

export class AdminAPI {

  config: Config

  constructor(config: Config) {
    this.config = config
  }

  checkAuthorization(authHeader: string): Promise<boolean> {
    return Promise.resolve().then(() => {
      if (!authHeader) {
        logger.error('No authorization header given')
        return false
      }
      if (!authHeader.toLowerCase().startsWith('bearer')) {
        logger.error('Malformed authorization header')
        return false
      }

      const bearer = authHeader.toLowerCase().slice('bearer '.length)
      if (!!this.config.apiKeys) {
        for (let i = 0; i < this.config.apiKeys.length; i++) {
          if (bearer === this.config.apiKeys[i]) {
            return true
          }
        }
      }

      logger.error('Invalid authorization header')
      return false
    })
  }
  
  // Reloads the Gaia hub by launching the reload subprocess
  handleReload(): Promise<{ status: any, statusCode: number }> {
    if (!this.config.reloadSettings.command) {
      // reload is not defined 
      const ret = { statusCode: 404, status: { error: 'No reload command defined' } }
      return Promise.resolve().then(() => ret)
    }

    const cmd = this.config.reloadSettings.command
    const argv = this.config.reloadSettings.argv ? this.config.reloadSettings.argv : []
    const env = this.config.reloadSettings.env ? this.config.reloadSettings.env : {}
    const uid = this.config.reloadSettings.setuid
    const gid = this.config.reloadSettings.setgid

    return runSubprocess(cmd, argv, env, uid, gid)
  }

  // don't call this from outside this class
  handleGetFields(fieldList: Array<string>): Promise<{ status: any, statusCode: number }> {
    return Promise.resolve().then(() => {
      const configPath = this.config.gaiaSettings.configPath
      return readConfigFileSections(configPath, fieldList)
    })
      .then((fields) => {
        return { statusCode: 200, status: { config: fields } }
      })
      .catch((e) => {
        return { statusCode: 500, status: { error: e.message } }
      })
  }

  // don't call this from outside this class
  handleSetFields(newFields: any, allowedFields: Array<string>): Promise<{ status: any, statusCode: number }> {
    // only allow fields in allowedFields to be written
    const fieldsToWrite: {[key: string]: any} = {}
    for (let i = 0; i < allowedFields.length; i++) {
      if (allowedFields[i] in newFields) {
        fieldsToWrite[allowedFields[i]] = newFields[allowedFields[i]]
      }
    }

    if (Object.keys(fieldsToWrite).length == 0) {
      const ret = { statusCode: 400, status: { error: 'No valid fields given' } }
      return Promise.resolve().then(() => ret)
    }

    return Promise.resolve().then(() => {
      const configPath = this.config.gaiaSettings.configPath
      return patchConfigFile(configPath, newFields)
    })
      .then(() => {
        const ret = { 
          statusCode: 200, 
          status: { 
            message: 'Config updated -- you should reload your Gaia hub now.'
          }
        }
        return ret
      })
      .catch((e) => {
        const ret = {
          statusCode: 500,
          status: {
            error: e.message
          }
        }
        return ret
      })
  }

  handleGetConfig(): Promise<{ status: any, statusCode: number }> {
    return this.handleGetFields(Object.keys(GAIA_CONFIG_SCHEMA.properties))
  }

  handleSetConfig(newConfig: any): Promise<{ status: any, statusCode: number }> {
    const ajv = new Ajv({strict: false})
    const valid = ajv.validate(GAIA_CONFIG_SCHEMA, newConfig)
    if (!valid) {
      logger.error(`Failed to validate Gaia configuration: ${JSON.stringify(ajv.errors)}`)
      const ret = { 
        statusCode: 400, 
        status: { 
          error: 'Invalid Gaia configuration',
          more: JSON.parse(JSON.stringify(ajv.errors))
        }
      }
      return Promise.resolve().then(() => ret)
    }
    return this.handleSetFields(newConfig, Object.keys(GAIA_CONFIG_SCHEMA.properties))
  }
}
