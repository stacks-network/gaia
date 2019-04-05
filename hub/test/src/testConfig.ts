
import test from 'tape-promise/tape'
import * as config from '../../src/server/config'


export function testConfig() {

  const configDir = `${__dirname}/../data`

  test('initial defaults', (t) => {
    const configResult = config.getConfig()
    t.deepEqual(configResult, config.getConfigDefaults())
    t.end()
  })


  test('read envvar with parseInt or parseList', (t) => {
    process.env.GAIA_PAGE_SIZE = '1003'
    let configResult = config.getConfig()
    t.deepEqual(configResult, Object.assign({}, config.getConfigDefaults(), { pageSize: 1003 }))
    process.env.GAIA_PAGE_SIZE = 'abc'
    t.throws(() => config.getConfig(), undefined, 'Should throw error on non-number input')
    delete process.env.GAIA_PAGE_SIZE

    process.env.GAIA_WHITELIST = "aaron.id, blankstein.id"
    configResult = config.getConfig()
    t.deepEqual(configResult, Object.assign({}, config.getConfigDefaults(), { whitelist: ['aaron.id', 'blankstein.id'] }))

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

    t.deepEqual(configResult, configExpected)
    process.env.CONFIG_PATH = configOriginal
    t.end()
  })

  test('load-from-js + override driver default', (t) => {
    const configOriginal = process.env.CONFIG_PATH
    process.env.CONFIG_PATH = `${configDir}/config.1.json`

    const configResult = config.getConfig()
    const configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'azure' },
                                         { azCredentials: { accountName: 'pancakes', accountKey: undefined }})

    t.deepEqual(configResult, configExpected)
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

    t.deepEqual(configResult, configExpected)

    process.env.GAIA_AZURE_ACCOUNT_NAME = 'latkes'

    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'azure' },
                                   { azCredentials: { accountName: 'latkes', accountKey: 'apples' }})


    t.deepEqual(configResult, configExpected)

    process.env.GAIA_DRIVER = 'bogusDriver'
    t.throws(() => config.getConfig(), undefined, 'Should throw error on invalid driver type config')

    process.env.CONFIG_PATH = `${configDir}/config.0.json`

    process.env.GAIA_DRIVER = 'aws'
    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'aws' },
                                   { awsCredentials: undefined })

    t.deepEqual(configResult, configExpected)

    process.env.GAIA_S3_ACCESS_KEY_ID = 'foo'
    process.env.GAIA_S3_SECRET_ACCESS_KEY = 'bar'
    process.env.GAIA_S3_SESSION_TOKEN = 'baz'

    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'aws' },
                                   { awsCredentials: {
                                     accessKeyId: 'foo',
                                     secretAccessKey: 'bar',
                                     sessionToken: 'baz' } })

    t.deepEqual(configResult, configExpected, 'S3 driver reads env vars correctly')

    process.env.GAIA_DRIVER = 'google-cloud'

    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'google-cloud' },
                                   { gcCredentials: {} })

    t.deepEqual(configResult, configExpected)

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

    t.deepEqual(configResult, configExpected, 'GCP driver reads env vars correctly')

    process.env.GAIA_DRIVER = 'disk'

    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'disk' },
                                   { diskSettings: { storageRootDirectory: undefined } })

    t.deepEqual(configResult, configExpected)

    process.env.GAIA_DISK_STORAGE_ROOT_DIR = '1'

    configResult = config.getConfig()
    configExpected = Object.assign({}, config.getConfigDefaults(), { driver: 'disk' },
                                   { diskSettings: { storageRootDirectory: '1' } })

    t.deepEqual(configResult, configExpected, 'Disk driver reads env vars correctly')

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

}
