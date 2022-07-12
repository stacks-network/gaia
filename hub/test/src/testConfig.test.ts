import * as config from '../../src/server/config.js'
import * as path from 'path'

const configDir = `${__dirname}/../data`
const schemaFilePath = path.normalize(`${__dirname}/../../config-schema.json`)


test('initial defaults', () => {
  const configResult = config.getConfig()
  expect(configResult).toEqual(config.getConfigDefaults())
})

describe('config schema does not warn on valid config', () => {
  let msg = ''
  const configObj = {
    driver: 'azure',
    port: 12345
  }
  config.validateConfigSchema(schemaFilePath, configObj, warning => {
    msg += warning
  })
  it('Should have correct schema warning', () => {
    expect(msg).toEqual('')
  })
})

describe('config schema warning for required params', () => {
  let msg = ''
  config.validateConfigSchema(schemaFilePath, {}, warning => {
    msg += warning
  })
  it('Should have correct schema warning', () => {
    expect(msg).toEqual('Config schema validation warning: config must have required property \'driver\', config must have required property \'port\'')
  })
})

describe('config schema warning for extra unused param', () => {
  let msg = ''
  const configObj = {
    driver: 'azure',
    port: 12345,
    typo: 'asdf'
  }
  config.validateConfigSchema(schemaFilePath, configObj, warning => {
    msg += warning
  })
  it('Should have correct schema warning', () => {
    expect(msg).toEqual('Config schema validation warning: config must NOT have additional properties')
  })
})

describe('config schema warning for missing schema file', () => {
  let msg = ''
  config.validateConfigSchema('missing-schema-file.json', {}, warning => {
    msg += warning
  })
  it('Should have correct schema warning', () => {
    expect(msg).toEqual('Could not find config schema file at missing-schema-file.json')
  })
})

describe('config schema warning for invalid schema json file', () => {
  let msg = ''
  config.validateConfigSchema(__filename, {}, warning => {
    msg += warning
  })
  it('Should have correct schema warning', () => {
    expect(msg).toEqual('Error reading config schema JSON file: SyntaxError: Unexpected token i in JSON at position 0')
  })
})

describe('config schema warning for invalid schema definition file', () => {
  let msg = ''
  const invalidSchemaDefFile = path.normalize(`${configDir}/invalid-schema-def.json`)
  config.validateConfigSchema(invalidSchemaDefFile, {}, warning => {
    msg += warning
  })
  it('Should have correct schema warning', () => {
    expect(msg).toEqual('Error validating config schema JSON file: Error: schema is invalid: data/additionalProperties must be object,boolean')
  })
})

test('read envvar with parseInt or parseList', () => {
  let configResult;

  process.env.GAIA_PAGE_SIZE = '1003'
  configResult = config.getConfig()
  expect(configResult).toEqual(Object.assign({}, config.getConfigDefaults(), { pageSize: 1003 }))
  delete process.env.GAIA_PAGE_SIZE

  // Should throw error on non-number input
  process.env.GAIA_PAGE_SIZE = 'abc'
  expect(() => config.getConfig())
    .toThrow()
  delete process.env.GAIA_PAGE_SIZE

  process.env.GAIA_WHITELIST = "aaron.id, blankstein.id"
  configResult = config.getConfig()
  expect(configResult).toEqual(Object.assign({}, config.getConfigDefaults(), { whitelist: ['aaron.id', 'blankstein.id'] }))
  delete process.env.GAIA_WHITELIST
})

test('load-from-js + use driver default', () => {
  const configOriginal = process.env.CONFIG_PATH
  process.env.CONFIG_PATH = `${configDir}/config.0.json`

  const configResult = config.getConfig()
  const configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'azure' },
    { azCredentials: { accountName: undefined,
        accountKey: undefined }})

  expect(configResult).toEqual(configExpected)
  process.env.CONFIG_PATH = configOriginal
})

test('load-from-js + override driver default', () => {
  const configOriginal = process.env.CONFIG_PATH
  process.env.CONFIG_PATH = `${configDir}/config.1.json`

  const configResult = config.getConfig()
  const configExpected = Object.assign({}, config.getConfigDefaults(), {driver: 'azure'},
    {azCredentials: {accountName: 'pancakes', accountKey: undefined}})

  expect(configResult).toEqual(configExpected)
  process.env.CONFIG_PATH = configOriginal
})

test('load-from-js + override driver default + override with env vars', () => {
  let configOriginal;
  let configResult;
  let configExpected;

  configOriginal = process.env.CONFIG_PATH
  process.env.CONFIG_PATH = `${configDir}/config.1.json`
  process.env.GAIA_AZURE_ACCOUNT_KEY = 'apples'

  configResult = config.getConfig()
  configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'azure' },
    { azCredentials: { accountName: 'pancakes',
        accountKey: 'apples' }})

  expect(configResult).toEqual(configExpected)

  process.env.GAIA_AZURE_ACCOUNT_NAME = 'latkes'

  configResult = config.getConfig()
  configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'azure' },
    { azCredentials: { accountName: 'latkes', accountKey: 'apples' }})

  expect(configResult).toEqual(configExpected)

  // Should throw error on invalid driver type config
  process.env.GAIA_DRIVER = 'bogusDriver'

  expect(() => config.getConfig()).toThrow()

  process.env.CONFIG_PATH = `${configDir}/config.0.json`
  process.env.GAIA_DRIVER = 'aws'

  configResult = config.getConfig()
  configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'aws' },
                                 { awsCredentials: undefined })

  expect(configResult).toEqual(configExpected)

  // S3 driver reads env vars correctly
  process.env.GAIA_S3_ACCESS_KEY_ID = 'foo'
  process.env.GAIA_S3_SECRET_ACCESS_KEY = 'bar'
  process.env.GAIA_S3_SESSION_TOKEN = 'baz'

  configResult = config.getConfig()
  configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'aws' },
                                 { awsCredentials: {
                                   accessKeyId: 'foo',
                                   secretAccessKey: 'bar',
                                   sessionToken: 'baz' } })

  expect(configResult).toEqual(configExpected)

  process.env.GAIA_DRIVER = 'google-cloud'

  configResult = config.getConfig()
  configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'google-cloud' },
                                 { gcCredentials: {} })

  expect(configResult).toEqual(configExpected)

  // GCP driver reads env vars correctly
  process.env.GAIA_GCP_EMAIL        = '1'
  process.env.GAIA_GCP_PROJECT_ID   = '2'
  process.env.GAIA_GCP_KEY_FILENAME = '3'
  process.env.GAIA_GCP_CLIENT_EMAIL = '4'
  process.env.GAIA_GCP_CLIENT_PRIVATE_KEY = '5'

  configResult = config.getConfig()
  configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'google-cloud' },
                                 { gcCredentials: {
                                   email: '1', projectId: '2', keyFilename: '3', credentials: { client_email: '4', private_key: '5' }
                                 } })

  expect(configResult).toEqual(configExpected)

  process.env.GAIA_DRIVER = 'disk'

  configResult = config.getConfig()
  configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'disk' },
                                 { diskSettings: { storageRootDirectory: undefined } })

  expect(configResult).toEqual(configExpected)

  // Disk driver reads env vars correctly
  process.env.GAIA_DISK_STORAGE_ROOT_DIR = '1'

  configResult = config.getConfig()
  configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'disk' },
                                 { diskSettings: { storageRootDirectory: '1' } })

  expect(configResult).toEqual(configExpected)

  delete process.env.GAIA_DISK_STORAGE_ROOT_DIR

  delete process.env.GAIA_GCP_EMAIL
  delete process.env.GAIA_GCP_PROJECT_ID
  delete process.env.GAIA_GCP_KEY_FILENAME
  delete process.env.GAIA_GCP_CLIENT_EMAIL
  delete process.env.GAIA_GCP_CLIENT_PRIVATE_KEY

  delete process.env.GAIA_AZURE_ACCOUNT_NAME
  delete process.env.GAIA_AZURE_ACCOUNT_KEY
  delete process.env.GAIA_DRIVER

  delete process.env.GAIA_S3_ACCESS_KEY_ID
  delete process.env.GAIA_S3_SECRET_ACCESS_KEY
  delete process.env.GAIA_S3_SESSION_TOKEN

  process.env.CONFIG_PATH = configOriginal
})

describe('test https env var config', () => {
  it('tls config contains envvar values', () => {
    process.env.GAIA_HTTPS_PORT = '455'
    process.env.GAIA_ENABLE_HTTPS = 'acme'
    process.env.GAIA_ACME_CONFIG_EMAIL = 'test@example.com'
    process.env.GAIA_ACME_CONFIG_AGREE_TOS = 'true'
    process.env.GAIA_ACME_CONFIG_CONFIG_DIR = './test/config/dir'
    process.env.GAIA_ACME_CONFIG_SECURITY_UPDATES = 'false'
    process.env.GAIA_ACME_CONFIG_SERVERNAME = 'test.example.com'
    process.env.GAIA_ACME_CONFIG_APPROVE_DOMAINS = 'other.example.com'
    process.env.GAIA_TLS_CERT_CONFIG_KEY_FILE = '/test/cert/key.pem'
    process.env.GAIA_TLS_CERT_CONFIG_CERT_FILE = '/test/cert/cert.pem'
    process.env.GAIA_TLS_CERT_CONFIG_KEY_PASSPHRASE = 'test-pem-password'
    process.env.GAIA_TLS_CERT_CONFIG_PFX_FILE = '/test/cert/server.pfx'
    process.env.GAIA_TLS_CERT_CONFIG_PFX_PASSPHRASE = 'test-pfx-password'

    try {
      let configResult = config.getConfig()
      const expected = Object.assign({}, config.getConfigDefaults(), {
        httpsPort: 455,
        enableHttps: 'acme',
        acmeConfig: {
          email: 'test@example.com',
          agreeTos: true,
          configDir: './test/config/dir',
          securityUpdates: false,
          servername: 'test.example.com',
          approveDomains: ['other.example.com']
        },
        tlsCertConfig: {
          keyFile: '/test/cert/key.pem',
          certFile: '/test/cert/cert.pem',
          keyPassphrase: 'test-pem-password',
          pfxFile: '/test/cert/server.pfx',
          pfxPassphrase: 'test-pfx-password'
        }
      })
      expect(configResult).toEqual(expected)
    } finally {
      delete process.env.GAIA_HTTPS_PORT
      delete process.env.GAIA_ENABLE_HTTPS
      delete process.env.GAIA_ACME_CONFIG_EMAIL
      delete process.env.GAIA_ACME_CONFIG_AGREE_TOS
      delete process.env.GAIA_ACME_CONFIG_CONFIG_DIR
      delete process.env.GAIA_ACME_CONFIG_SECURITY_UPDATES
      delete process.env.GAIA_ACME_CONFIG_SERVERNAME
      delete process.env.GAIA_ACME_CONFIG_APPROVE_DOMAINS
      delete process.env.GAIA_TLS_CERT_CONFIG_KEY_FILE
      delete process.env.GAIA_TLS_CERT_CONFIG_CERT_FILE
      delete process.env.GAIA_TLS_CERT_CONFIG_KEY_PASSPHRASE
      delete process.env.GAIA_TLS_CERT_CONFIG_PFX_FILE
      delete process.env.GAIA_TLS_CERT_CONFIG_PFX_PASSPHRASE
    }
  })
})
