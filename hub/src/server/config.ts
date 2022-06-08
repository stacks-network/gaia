import * as winston from 'winston'
import * as fs from 'fs'
import * as process from 'process'
import Ajv from 'ajv'

import { getDriverClass, logger } from './utils'
import { DriverModel, DriverConstructor } from './driverModel'

import { AZ_CONFIG_TYPE } from './drivers/AzDriver'
import { DISK_CONFIG_TYPE } from './drivers/diskDriver'
import { GC_CONFIG_TYPE } from './drivers/GcDriver'
import { S3_CONFIG_TYPE } from './drivers/S3Driver'

export type DriverName = 'aws' | 'azure' | 'disk' | 'google-cloud'

export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug'

export const enum HttpsOption {
  cert_files = 'cert_files',
  acme = 'acme' 
}

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

export interface ProofCheckerConfigInterface { 
  proofsRequired?: number;
}

// ProofCheckerConfig defaults
class ProofCheckerConfig implements ProofCheckerConfigInterface {
  /**
   * @TJS-type integer
   */
  proofsRequired? = 0
}

export interface AcmeConfigInterface {
  /**
   * The email address of the ACME user / hosting provider. 
   */
  email: string;
  /**
   * Accept Let's Encrypt(TM) v2 Agreement. You must accept the ToS as the host which handles the certs. 
   * See the subscriber agreement at https://letsencrypt.org/repository/
   */
  agreeTos: boolean;
  /**
   * Writable directory where certs will be saved.
   * @default "~/.config/acme/"
   */
  configDir?: string;
  /**
   * Join the Greenlock community to get notified of important updates. 
   * @default false
   */
  communityMember?: boolean;
  /**
   * Important and mandatory notices from Greenlock, related to security or breaking API changes.
   * @default true
   */
  securityUpdates: boolean;
  /**
   * Contribute telemetry data to the project.
   * @default false
   */
  telemetry?: boolean;
  /**
   * The default servername to use when the client doesn't specify.
   * Example: "example.com"
   */
  servername?: string;
  /**
   * Array of allowed domains such as `[ "example.com", "www.example.com" ]`
   */
  approveDomains?: string[];
  /**
   * @default "https://acme-v02.api.letsencrypt.org/directory"
   */
  server?: string;
  /**
   * The ACME version to use. `v02`/`draft-12` is for Let's Encrypt v2 otherwise known as ACME draft 12.
   * @default "v02"
   */
  version?: string;
  /**
   * @default false
   */
  debug?: boolean;
}

export interface TlsPemCert {
  /**
   * Either the path to the PEM formatted private key file, or the string content of the file. 
   * The file usually has the extension `.key` or `.pem`. 
   * If the content string is specified, it should include the escaped EOL characters, e.g. 
   * `"-----BEGIN RSA PRIVATE KEY-----\n{lines of base64 data}\n-----END RSA PRIVATE KEY-----"`. 
   */
  keyFile: string;
  /**
   * Either the path to the PEM formatted certification chain file, or the string content of the file. 
   * The file usually has the extension `.cert`, `.cer`, `.crt`, or `.pem`. 
   * If the content string is specified, it should include the escaped EOL characters, e.g. 
   * `"-----BEGIN CERTIFICATE-----\n{lines of base64 data}\n-----END CERTIFICATE-----"`. 
   */
  certFile: string;
  /**
   * The string passphrase for the key file. If provided, the passphrase is used to decrypt the file. 
   * If not provided, the key is assumed to be unencrypted. 
   */
  keyPassphrase?: string;
}

export interface TlsPfxCert {
  /**
   * Either the path to the PFX or PKCS12 encoded private key and certificate chain file, 
   * or the base64 encoded content of the file. 
   * The file usually has the extension `.pfx` or `.p12`. 
   */
  pfxFile: string;
  /**
   * The string passphrase for the key file. If provided, the passphrase is used to decrypt the file. 
   * If not provided, the key is assumed to be unencrypted. 
   */
  pfxPassphrase?: string;
}

export type TlsCertConfigInterface = TlsPemCert | TlsPfxCert | undefined;

type SubType<T, K extends keyof T> = K extends keyof T ? T[K] : never;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HubConfigInterface extends HubConfig { }


// This class is responsible for:
//  A) Specifying default config values.
//  B) Used for generating the config-schema.json file. 
// The undefined values are explicitly specified so the schema generator
// will pick them up. 
// Having the config params and their default values specified here is useful 
// for providing a single-source-of-truth for both the schema and the actual code. 
export class HubConfig {

  /**
   * Required if `driver` is `azure`
   */
  azCredentials?: SubType<AZ_CONFIG_TYPE, 'azCredentials'>

  /**
   * Required if `driver` is `disk`
   */
  diskSettings?: SubType<DISK_CONFIG_TYPE, 'diskSettings'>

  /**
   * Required if `driver` is `google-cloud`
   */
  gcCredentials?: SubType<GC_CONFIG_TYPE, 'gcCredentials'>

  /**
   * Required if `driver` is `aws`
   */
  awsCredentials?: SubType<S3_CONFIG_TYPE, 'awsCredentials'>

  argsTransport? = new LoggingConfig()
  proofsConfig? = new ProofCheckerConfig()
  requireCorrectHubUrl? = false
  /**
   * Domain name used for auth/signing challenges. 
   * If `requireCorrectHubUrl` is true then this must match the hub url in an auth payload. 
   */
  serverName? = 'gaia-0'
  bucket? = 'hub'
  /**
   * @minimum 1
   * @maximum 4096
   * @TJS-type integer
   */
  pageSize? = 100
  cacheControl? = 'no-cache'
  /**
   * The maximum allowed POST body size in megabytes. 
   * The content-size header is checked, and the POST body stream 
   * is monitoring while streaming from the client. 
   * [Recommended] Minimum 100KB (or approximately 0.1MB)
   * @minimum 0.1
   */
  maxFileUploadSize? = 20
  /**
   * @TJS-type integer
   */
  authTimestampCacheSize? = 50000

  driver = undefined as DriverName

  /**
   * @minimum 0
   * @maximum 65535
   * @TJS-type integer
   */
  port = 3000

  /**
   * Requires `enableHttps` to be set. 
   * @default 443
   * @minimum 0
   * @maximum 65535
   * @TJS-type integer
   */
  httpsPort? = 443

  /**
   * Disabled by default. 
   * If set to `cert_files` then `tlsCertConfig` must be set. 
   * If set to `acme` then `acmeConfig` must be set. 
   */
  enableHttps? = undefined as HttpsOption

  /**
   * Options for Automatic Certificate Management Environment client. 
   * Requires `enableHttps` to be set to `acme`. 
   * See https://www.npmjs.com/package/greenlock-express 
   * See https://tools.ietf.org/html/rfc8555 
   * See https://github.com/ietf-wg-acme/acme 
   */
  acmeConfig?: AcmeConfigInterface

  /**
   * Options for configuring the Node.js `https` server. 
   * Requires `enableHttps` to be set to `tlsCertConfig`. 
   * See https://nodejs.org/docs/latest-v10.x/api/https.html#https_https_createserver_options_requestlistener 
   * See https://nodejs.org/docs/latest-v10.x/api/tls.html#tls_tls_createsecurecontext_options 
   */
  tlsCertConfig?: TlsCertConfigInterface

  /**
   * List of ID addresses allowed to use this hub. Specifying this makes the hub private 
   * and only accessible to the specified addresses. Leaving this unspecified makes the hub 
   * publicly usable by any ID. 
   */
  whitelist?: string[]
  readURL?: string
  /**
   * If `requireCorrectHubUrl` is true then the hub specified in an auth payload can also be
   * contained within in array.  
   */
  validHubUrls?: string[]


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

type EnvVarTypeInfo = [string, 'list' | 'int' | 'boolean' ]
type EnvVarType = string | EnvVarTypeInfo
type EnvVarProp = EnvVarType | EnvVarObj
interface EnvVarObj {
  [key: string]: EnvVarProp
}

const globalEnvVars: EnvVarObj = { 
  whitelist: ['GAIA_WHITELIST', 'list'],
  readURL: 'GAIA_READ_URL',
  driver: 'GAIA_DRIVER',
  validHubUrls: ['GAIA_VALID_HUB_URLS', 'list'],
  requireCorrectHubUrl: ['GAIA_REQUIRE_CORRECT_HUB_URL', 'int'],
  serverName: 'GAIA_SERVER_NAME',
  bucket: 'GAIA_BUCKET_NAME',
  pageSize: ['GAIA_PAGE_SIZE', 'int'],
  cacheControl: 'GAIA_CACHE_CONTROL',
  port: ['GAIA_PORT', 'int'],
  httpsPort: ['GAIA_HTTPS_PORT', 'int'],
  enableHttps: 'GAIA_ENABLE_HTTPS',
  acmeConfig: {
    email: 'GAIA_ACME_CONFIG_EMAIL',
    agreeTos: ['GAIA_ACME_CONFIG_AGREE_TOS', 'boolean'],
    configDir: 'GAIA_ACME_CONFIG_CONFIG_DIR',
    securityUpdates: ['GAIA_ACME_CONFIG_SECURITY_UPDATES', 'boolean'],
    servername: 'GAIA_ACME_CONFIG_SERVERNAME',
    approveDomains: ['GAIA_ACME_CONFIG_APPROVE_DOMAINS', 'list']
  },
  tlsCertConfig: {
    keyFile: 'GAIA_TLS_CERT_CONFIG_KEY_FILE',
    certFile: 'GAIA_TLS_CERT_CONFIG_CERT_FILE',
    keyPassphrase: 'GAIA_TLS_CERT_CONFIG_KEY_PASSPHRASE',
    pfxFile: 'GAIA_TLS_CERT_CONFIG_PFX_FILE',
    pfxPassphrase: 'GAIA_TLS_CERT_CONFIG_PFX_PASSPHRASE'
  }
}

function getConfigEnv(envVars: EnvVarObj) {
  const configEnv: Record<string, any> = {}

  function hasTypeInfo(value: EnvVarObj | EnvVarTypeInfo): value is EnvVarTypeInfo {
    return Array.isArray(value)
  }

  const detectedEnvVars: string[] = []

  function populateObj(getTarget: () => Record<string, any>, envVarProp: EnvVarObj){
    for (const [name, value] of Object.entries(envVarProp)) {
      if (typeof value === 'string') {
        if (process.env[value]) {
          detectedEnvVars.push(value)
          getTarget()[name] = process.env[value]
        }
      } else if (hasTypeInfo(value)) {
        if (process.env[value[0]]) {
          detectedEnvVars.push(value[0])
          if (value[1] === 'int') {
            const intVar = parseInt(process.env[value[0]])
            if (isNaN(intVar)) {
              throw new Error(`Passed a non-number input to: ${value[0]}`)
            }
            getTarget()[name] = intVar
          } else if (value[1] === 'list') {
            getTarget()[name] = process.env[value[0]].split(',').map(x => x.trim())
          } else if (value[1] === 'boolean') {
            let boolVal: boolean
            const envVar = process.env[value[0]].toLowerCase().trim()
            if (envVar === 'true') {
              boolVal = true
            } else if (envVar === 'false') {
              boolVal = false
            } else {
              throw new Error(`Passed a invalid boolean input to: ${value[0]}, must be "true" or "false"`)
            }
            getTarget()[name] = boolVal
          }
        }
      } else {
        populateObj(() => {
          const innerTarget = getTarget()
          if (!innerTarget[name]) {
            innerTarget[name] = {}
          }
          return innerTarget[name]
        }, value)
      }
    }
  }
  populateObj(() => configEnv, envVars)
  if (detectedEnvVars.length > 0) {
    console.log(`Using env vars: ${detectedEnvVars.join(',')}`)
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

export function getConfigDefaults(): HubConfigInterface {
  const configDefaults = new HubConfig()

  // Remove explicit `undefined` values and empty objects
  function removeEmptyOrUndefined(obj: any) {
    Object.entries(obj).forEach(([key, val]) => {
      if (typeof val === 'undefined') {
        delete obj[key]
      } else if (typeof val === 'object' && val !== null) {
        removeEmptyOrUndefined(val)
        if (Object.keys(val).length === 0) {
          delete obj[key]
        }
      }
    })
  }
  removeEmptyOrUndefined(configDefaults)

  return configDefaults
} 

export function validateConfigSchema(
  schemaFilePath: string, 
  configObj: any, 
  warnCallback: (msg: string) => void = (msg => console.error(msg))
) {
  try {
    const ajv = new Ajv({
      allErrors: true,
      strictSchema: true,
      verbose: true
    })
    if (!fs.existsSync(schemaFilePath)) {
      warnCallback(`Could not find config schema file at ${schemaFilePath}`)
      return
    }
    let schemaJson: any
    try {
      schemaJson = JSON.parse(fs.readFileSync(schemaFilePath, { encoding: 'utf8' }))
    } catch (error) {
      warnCallback(`Error reading config schema JSON file: ${error}`)
      return
    }
    const valid = ajv.validate(schemaJson, configObj)
    if (!valid) {
      const errorText = ajv.errorsText(ajv.errors, {
        dataVar: 'config'
      })
      warnCallback(`Config schema validation warning: ${errorText}`)
    }
  } catch (error) {
    warnCallback(`Error validating config schema JSON file: ${error}`)
  }
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

  const configDefaults = getConfigDefaults()
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

