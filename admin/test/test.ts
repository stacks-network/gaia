import fs from 'fs'

import { AdminAPI, patchConfigFile, readConfigFileSections } from '../src/server.js'

test('patch config file only sets top-level fields', () => {
  expect.assertions(2)
  const config_1 = {
    a: 'b',
    c: {
      d: 'e',
      f: 'g'
    }
  }

  const config_2 = {
    c: {
      h: 'i'
    }
  }

  // config 1 + config 2
  const config_1_2 = {
    a: 'b',
    c: {
      h: 'i'
    }
  }

  const configPath = '/tmp/test-gaia-admin-config.json'
  try {
    fs.unlinkSync(configPath)
  }
  catch (e) {
  }

  fs.writeFileSync(configPath, '{}')

  patchConfigFile(configPath, config_1)
  const data_1 = readConfigFileSections(configPath, ['a', 'c'])

  // read complete config file
  expect(data_1).toEqual(config_1)

  patchConfigFile(configPath, config_2)
  const data_2 = readConfigFileSections(configPath, ['a', 'c'])

  // patched config file has different section
  expect(data_2).toEqual(config_1_2)

  try {
    fs.unlinkSync(configPath)
  }
  catch (e) {
  }
})

test('check authorization api key', () => {
  expect.assertions(4)

  const config = {
    apiKeys: ['potatoes'],
  } as any

  let server = new AdminAPI(config)

  server.checkAuthorization('bearer potatoes')
    .then((result) => {
      // correct API key passes authorization
      expect(result).toEqual(true)
      return server.checkAuthorization('bearer nopotatoes')
    })
    .then((result) => {
      // incorrect API key fails authorization
      expect(result).toEqual(false)
      return server.checkAuthorization('nobearer potatoes')
    })
    .then((result) => {
      // non-bearer authorization headers fail authorization
      expect(result).toEqual(false)

      const configWithoutApiKey = {} as any
      server = new AdminAPI(configWithoutApiKey)

      return server.checkAuthorization('bearer potatoes')
    })
    .then((result) => {
      // no API key causes authorization to fail
      expect(result).toEqual(false)
    })
})

test('reload command', (done) => {
  expect.assertions(5)

  const config = {
    apiKeys: ['potatoes'],
    reloadSettings: {
      command: '/bin/sh',
      argv: ["-c", "echo \"$HELLO\" > /tmp/gaia-admin-test.txt"],
      env: {
        "HELLO": "hello world"
      }
    }
  } as any

  let server = new AdminAPI(config)

  try {
    fs.unlinkSync('/tmp/gaia-admin-test.txt')
  } catch (e) {
    {}
  }

  server.handleReload()
    .then((result) => {
      // reload command is launched
      expect(result.statusCode).toEqual(200)
      try {
        const statBuf = fs.statSync('/tmp/gaia-admin-test.txt')
        // admin test file exists

        const data = fs.readFileSync('/tmp/gaia-admin-test.txt').toString()
        // admin test file contents equal environ
        expect(data).toEqual('hello world\n')
      } catch (e) {
        // admin test file does NOT exist
      }

      const configNoCommand = {
        reloadSettings: {
          command: '',
          argv: ['-c', "echo \"$HELLO\" > /tmp/gaia-admin-test.txt"],
          env: {
            "HELLO": "hello world"
          }
        }
      } as any
      let server = new AdminAPI(configNoCommand)
      return server.handleReload()
    })
    .then((result) => {
      // missing reload command should 404
      expect(result.statusCode).toEqual(404)

      const configFailCommand = {
        reloadSettings: {
          command: '/bin/false',
        }
      } as any
      let server = new AdminAPI(configFailCommand)
      return server.handleReload()
    })
    .then((result) => {
      // failed reload command should 500
      expect(result.statusCode).toEqual(500)

      const configBadCommand = {
        reloadSettings: {
          command: '/bin/nonexistant'
        }
      } as any
      let server = new AdminAPI(configBadCommand)
      return server.handleReload()
    })
    .then((result) => {
      // missing reload command should 500
      expect(result.statusCode).toEqual(500)
      fs.unlinkSync('/tmp/gaia-admin-test.txt')

      done()
    })
})

test('get/set whitelist', (done) => {
  expect.assertions(8)

  const gaiaConfig = {
    whitelist: [] as string[]
  }

  const gaiaConfigPathWhitelist = `/tmp/gaia-config-whitelist-${Math.random()}`
  fs.writeFileSync(gaiaConfigPathWhitelist, JSON.stringify(gaiaConfig))

  const config = {
    gaiaSettings: {
      configPath: gaiaConfigPathWhitelist
    }
  } as any

  let server = new AdminAPI(config)
  server.handleGetConfig()
    .then((result) => {
      // handleGetWhitelist status 200
      expect(result.statusCode).toEqual(200)
      // handleGetWhitelist gives []
      expect(result.status.config.whitelist).toStrictEqual([])

      return server.handleSetConfig({whitelist: ['1MCY4XvmhxDkDxw786P3nM5hmA9XJdmjhe']})
    })
    .then((result) => {
      // handleSetWhitelist status 200
      expect(result.statusCode).toEqual(200)
      return server.handleGetConfig()
    })
    .then((result) => {
      // handleGetWhitelist status 200 again
      expect(result.statusCode).toEqual(200)
      // handleGetWhitelist gives back new address
      expect(result.status.config.whitelist).toStrictEqual(['1MCY4XvmhxDkDxw786P3nM5hmA9XJdmjhe'])

      const newConfigJSON = fs.readFileSync(gaiaConfigPathWhitelist).toString()
      const newConfig = JSON.parse(newConfigJSON)
      // Gaia config file matches new whitelist
      expect(newConfig.whitelist).toStrictEqual(['1MCY4XvmhxDkDxw786P3nM5hmA9XJdmjhe'])

      return server.handleSetConfig({whitelist: ['invalid address']})
    })
    .then((result) => {
      // handleGetWhitelist status 400 on bad address
      expect(result.statusCode).toEqual(400)

      // config file not touched
      const newConfigJSON = fs.readFileSync(gaiaConfigPathWhitelist).toString()
      const newConfig = JSON.parse(newConfigJSON)
      // Gaia config file matches new whitelist
      expect(newConfig.whitelist).toEqual(['1MCY4XvmhxDkDxw786P3nM5hmA9XJdmjhe'])

      fs.unlinkSync(gaiaConfigPathWhitelist)

      done()
    })
})

test('get/set generic Gaia settings', (done) => {
  expect.assertions(9)

  const gaiaConfig = {
    validHubUrls: [] as string[],
    requireCorrectHubUrl: false,
    serverName: 'gaia-0',
    port: 3000,
    proofsConfig: 0
  }

  const newGaiaConfig = {
    validHubUrls: ['http://new.hub'],
    requireCorrectHubUrl: true,
    serverName: 'gaia-1',
    port: 3001,
    proofsConfig: 1
  }

  // bad values
  const badGaiaConfig = {
    validHubUrls: ['invalid.url'],
    requireCorrectHubUrl: true,
    serverName: '',
    port: 123456,
    proofsConfig: -1
  }

  const gaiaConfigPath = `/tmp/gaia-config-gaia-${Math.random()}`
  fs.writeFileSync(gaiaConfigPath, JSON.stringify(gaiaConfig))

  const config = {
    gaiaSettings: {
      configPath: gaiaConfigPath
    }
  } as any

  let server = new AdminAPI(config)
  server.handleGetConfig()
    .then((result) => {
      // handleGetGaiaSettings status 200
      expect(result.statusCode).toEqual(200)
      // handleGetGaiaSettings matches gaia config
      expect(result.status.config).toStrictEqual(gaiaConfig)

      return server.handleSetConfig(newGaiaConfig)
    })
    .then((result) => {
      // handleSetGaiaSettings status 200
      expect(result.statusCode).toEqual(200)
      return server.handleGetConfig()
    })
    .then((result) => {
      // handleGetGaiaSettings status 200 again
      expect(result.statusCode).toEqual(200)
      expect(result.status.config).toStrictEqual(newGaiaConfig)

      return server.handleSetConfig(badGaiaConfig)
    })
    .then((result) => {
      // handleSetGaiaSettings status 400 on invalid config values
      expect(result.statusCode).toEqual(400)

      // config file not touched
      const storedConfigJSON = fs.readFileSync(gaiaConfigPath).toString()
      const storedConfig = JSON.parse(storedConfigJSON)
      // Gaia config unchanged
      expect(storedConfig).toStrictEqual(newGaiaConfig)

      return server.handleSetConfig({not: 'a', valid: 'config', structure: '!'})
    })
    .then((result) => {
      // handleSetGaiaSettings status 400 on invalid struct
      expect(result.statusCode).toEqual(400)

      // config file not modified
      const storedConfigJSON = fs.readFileSync(gaiaConfigPath).toString()
      const storedConfig = JSON.parse(storedConfigJSON)
      // Gaia config unchanged
      expect(storedConfig).toStrictEqual(newGaiaConfig)

      fs.unlinkSync(gaiaConfigPath)

      done()
    })
})

describe('get/set driver settings', () => {
  expect.assertions(36)

  const azCredentials = {
    accountName: 'potatoes',
    accountKey: 'are_delicious'
  }

  const diskSettings = {
    storageRootDirectory: '/foo/bar/baz'
  }

  const gcCredentials = {
    email: 'hello@blockstack.com',
    projectId: 'decentralize-the-internet',
    keyFilename: '/foo/bar/baz',
    credentials: {
      client_email: 'service@blockstack.com',
      private_key: 'lol no'
    }
  }

  const awsCredentials = {
    accessKeyId: 'asdf',
    secretAccessKey: 'jkl;',
    sessionToken: 'qwerty'
  }

  const azDriverSettings = {
    driver: 'azure',
    readURL: 'https://gaia.blockstack.org/hub',
    pageSize: 100,
    cacheControl: 'Max-Age 30',
    azCredentials
  }

  const diskDriverSettings = {
    driver: 'disk',
    readURL: 'https://my.gaia.hub/hub',
    pageSize: 100,
    cacheControl: 'Max-Age 30',
    diskSettings
  }

  const gcDriverSettings = {
    driver: 'google-cloud',
    readURL: 'https://blockstack-gaia.google.com/hub',
    pageSize: 100,
    cacheControl: 'Max-Age 30',
    gcCredentials
  }

  const awsDriverSettings = {
    driver: 'aws',
    readURL: 'https://blockstack-gaia.s3.amazonaws.com',
    pageSize: 100,
    cacheControl: 'Max-Age 30',
    awsCredentials
  }

  const driverSettings = [
    azDriverSettings,
    diskDriverSettings,
    gcDriverSettings,
    awsDriverSettings
  ]

  for (let i = 0; i < driverSettings.length; i++) {
    const gaiaConfig = driverSettings[i]

    test(`get/set ${gaiaConfig.driver} driver settings`, (done) => {
      const newGaiaConfig = Object.assign({}, gaiaConfig)
      newGaiaConfig.driver = `${newGaiaConfig.driver}-new`
      newGaiaConfig.readURL = `${newGaiaConfig.readURL}-new`
      newGaiaConfig.pageSize = 101
      newGaiaConfig.cacheControl = 'Max-Age 5'

      const badGaiaConfig = Object.assign({}, gaiaConfig)
      badGaiaConfig.readURL = ''

      const gaiaConfigPath = `/tmp/gaia-config-gaia-${Math.random()}`
      fs.writeFileSync(gaiaConfigPath, JSON.stringify(gaiaConfig))

      const config = {
        gaiaSettings: {
          configPath: gaiaConfigPath
        }
      } as any

      let server = new AdminAPI(config)
      server.handleGetConfig()
        .then((result) => {
          // handleGetDriverSettings status 200
          expect(result.statusCode).toEqual(200)
          // handleGetDriverSettings matches driver config for ${gaiaConfig.driver}
          expect(result.status.config).toStrictEqual(gaiaConfig)

          return server.handleSetConfig(newGaiaConfig)
        })
        .then((result) => {
          // handleSetDriverSettings status 200
          expect(result.statusCode).toEqual(200)
          return server.handleGetConfig()
        })
        .then((result) => {
          // handleGetDriverSettings status 200 again
          expect(result.statusCode).toEqual(200)
          expect(result.status.config).toStrictEqual(newGaiaConfig)

          return server.handleSetConfig(badGaiaConfig)
        })
        .then((result) => {
          // handleSetDriverSettings status 400 on invalid config values
          expect(result.statusCode).toEqual(400)

          // config file not touched
          const storedConfigJSON = fs.readFileSync(gaiaConfigPath).toString()
          const storedConfig = JSON.parse(storedConfigJSON)
          // Gaia config unchanged
          expect(storedConfig).toStrictEqual(newGaiaConfig)

          return server.handleSetConfig({not: 'a', valid: 'config', structure: '!'})
        })
        .then((result) => {
          // handleSetDriverSettings status 400 on invalid struct
          expect(result.statusCode).toEqual(400)

          // config file not modified
          const storedConfigJSON = fs.readFileSync(gaiaConfigPath).toString()
          const storedConfig = JSON.parse(storedConfigJSON)
          // Driver config unchanged
          expect(storedConfig).toStrictEqual(newGaiaConfig)

          fs.unlinkSync(gaiaConfigPath)

          done()
        })
    })
  }
})
