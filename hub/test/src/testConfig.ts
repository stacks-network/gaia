
import test = require('tape-promise/tape')
import * as config from '../../src/server/config'
import * as path from 'path'


export function testConfig() {

  const configDir = `${__dirname}/../data`
  const schemaFilePath = path.normalize(`${__dirname}/../../config-schema.json`)

  test('initial defaults', (t) => {
    const configResult = config.getConfig()
    t.deepLooseEqual(configResult, config.getConfigDefaults())
    t.end()
  })

  test('config schema does not warn on valid config', (t) => {
    let msg = ''
    const configObj = {
      driver: 'azure',
      port: 12345
    }
    config.validateConfigSchema(schemaFilePath, configObj, warning => {
      msg += warning
    })
    t.equals(msg, '', 'Should have correct schema warning')
    t.end()
  })

  test('config schema warning for required params', (t) => {
    let msg = ''
    config.validateConfigSchema(schemaFilePath, {}, warning => {
      msg += warning
    })
    t.equals(msg, 
      'Config schema validation warning: config must have required property \'driver\', config must have required property \'port\'',
      'Should have correct schema warning')
    t.end()
  })

  test('config schema warning for extra unused param', (t) => {
    let msg = ''
    const configObj = {
      driver: 'azure',
      port: 12345,
      typo: 'asdf'
    }
    config.validateConfigSchema(schemaFilePath, configObj, warning => {
      msg += warning
    })
    t.equals(msg, 
      'Config schema validation warning: config must NOT have additional properties',
      'Should have correct schema warning')
    t.end()
  })

  test('config schema warning for missing schema file', (t) => {
    let msg = ''
    config.validateConfigSchema('missing-schema-file.json', {}, warning => {
      msg += warning
    })
    t.equals(msg, 
      'Could not find config schema file at missing-schema-file.json', 
      'Should have correct schema warning')
    t.end()
  })

  test('config schema warning for invalid schema json file', (t) => {
    let msg = ''
    config.validateConfigSchema(__filename, {}, warning => {
      msg += warning
    })
    t.equals(msg, 
      'Error reading config schema JSON file: SyntaxError: Unexpected token i in JSON at position 1', 
      'Should have correct schema warning')
    t.end()
  })

  test('config schema warning for invalid schema definition file', (t) => {
    let msg = ''
    const invalidSchemaDefFile = path.normalize(`${configDir}/invalid-schema-def.json`)
    config.validateConfigSchema(invalidSchemaDefFile, {}, warning => {
      msg += warning
    })
    t.equals(msg, 
      'Error validating config schema JSON file: Error: schema is invalid: data/additionalProperties must be object,boolean',
      'Should have correct schema warning')
    t.end()
  })

  test('read envvar with parseInt or parseList', (t) => {
    process.env.GAIA_PAGE_SIZE = '1003'
    let configResult = config.getConfig()
    t.deepLooseEqual(configResult, Object.assign({}, config.getConfigDefaults(), { pageSize: 1003 }))
    process.env.GAIA_PAGE_SIZE = 'abc'
    t.throws(() => config.getConfig(), undefined, 'Should throw error on non-number input')
    delete process.env.GAIA_PAGE_SIZE

    process.env.GAIA_WHITELIST = "aaron.id, blankstein.id"
    configResult = config.getConfig()
    t.deepLooseEqual(configResult, Object.assign({}, config.getConfigDefaults(), { whitelist: ['aaron.id', 'blankstein.id'] }))

    delete process.env.GAIA_WHITELIST

    t.end()
  })

  test('load-from-js + use driver default', (t) => {
    const configOriginal = process.env.CONFIG_PATH
    process.env.CONFIG_PATH = `${configDir}/config.0.json`

    const configResult = config.getConfig()
    const configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'azure' },
                                         { azCredentials: { accountName: undefined,
                                                            accountKey: undefined }})

    t.deepLooseEqual(configResult, configExpected)
    process.env.CONFIG_PATH = configOriginal
    t.end()
  })

  test('load-from-js + override driver default', (t) => {
    const configOriginal = process.env.CONFIG_PATH
    process.env.CONFIG_PATH = `${configDir}/config.1.json`

    const configResult = config.getConfig()
    const configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'azure' },
                                         { azCredentials: { accountName: 'pancakes', accountKey: undefined }})

    t.deepLooseEqual(configResult, configExpected)
    process.env.CONFIG_PATH = configOriginal
    t.end()
  })

  test('load-from-js + override driver default + override with env vars', (t) => {
    const configOriginal = process.env.CONFIG_PATH
    process.env.CONFIG_PATH = `${configDir}/config.1.json`


    process.env.GAIA_AZURE_ACCOUNT_KEY = 'apples'


    let configResult = config.getConfig()
    let configExpected: any = Object.assign({}, config.getConfigDefaults(), { driver: 'azure' },
                                   { azCredentials: { accountName: 'pancakes',
                                                      accountKey: 'apples' }})

    t.deepLooseEqual(configResult, configExpected)

    process.env.GAIA_AZURE_ACCOUNT_NAME = 'latkes'

    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'azure' },
                                   { azCredentials: { accountName: 'latkes', accountKey: 'apples' }})


    t.deepLooseEqual(configResult, configExpected)

    process.env.GAIA_DRIVER = 'bogusDriver'
    t.throws(() => config.getConfig(), undefined, 'Should throw error on invalid driver type config')

    process.env.CONFIG_PATH = `${configDir}/config.0.json`

    process.env.GAIA_DRIVER = 'aws'
    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'aws' },
                                   { awsCredentials: undefined })

    t.deepLooseEqual(configResult, configExpected)

    process.env.GAIA_S3_ACCESS_KEY_ID = 'foo'
    process.env.GAIA_S3_SECRET_ACCESS_KEY = 'bar'
    process.env.GAIA_S3_SESSION_TOKEN = 'baz'

    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'aws' },
                                   { awsCredentials: {
                                     accessKeyId: 'foo',
                                     secretAccessKey: 'bar',
                                     sessionToken: 'baz' } })

    t.deepLooseEqual(configResult, configExpected, 'S3 driver reads env vars correctly')

    process.env.GAIA_DRIVER = 'google-cloud'

    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'google-cloud' },
                                   { gcCredentials: {} })

    t.deepLooseEqual(configResult, configExpected)

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

    t.deepLooseEqual(configResult, configExpected, 'GCP driver reads env vars correctly')

    process.env.GAIA_DRIVER = 'disk'

    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'disk' },
                                   { diskSettings: { storageRootDirectory: undefined } })

    t.deepLooseEqual(configResult, configExpected)

    process.env.GAIA_DISK_STORAGE_ROOT_DIR = '1'

    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'disk' },
                                   { diskSettings: { storageRootDirectory: '1' } })

    t.deepLooseEqual(configResult, configExpected, 'Disk driver reads env vars correctly')

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
    t.end()
  })

  test('test https env var config', t => {
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
      t.deepLooseEqual(configResult, expected, 'tls config contains envvar values')
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

    t.end()
  })

}
