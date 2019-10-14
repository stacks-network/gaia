import test = require('tape')
import fs = require('fs')

import { AdminAPI, patchConfigFile, readConfigFileSections } from '../src/server'

function testServer() {
  test('patch config file only sets top-level fields', (t) => {
    t.plan(2)
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

    t.deepEqual(data_1, config_1, 'read complete config file')

    patchConfigFile(configPath, config_2)
    const data_2 = readConfigFileSections(configPath, ['a', 'c'])

    t.deepEqual(data_2, config_1_2, 'patched config file has different section')

    try {
      fs.unlinkSync(configPath)
    }
    catch (e) {
    }
  })

  test('check authorization api key', (t) => {
    t.plan(4)

    const config = {
      apiKeys: ['potatoes'],
    } as any

    let server = new AdminAPI(config)
    
    server.checkAuthorization('bearer potatoes')
      .then((result) => {
        t.equal(result, true, 'correct API key passes authorization')
        return server.checkAuthorization('bearer nopotatoes')
      })
      .then((result) => {
        t.equal(result, false, 'incorrect API key fails authorization')
        return server.checkAuthorization('nobearer potatoes')
      })
      .then((result) => {
        t.equal(result, false, 'non-bearer authorization headers fail authorization')

        const configWithoutApiKey = {} as any
        server = new AdminAPI(configWithoutApiKey)

        return server.checkAuthorization('bearer potatoes')
      })
      .then((result) => {
        t.equal(result, false, 'no API key causes authorization to fail')
      })
  })

  test('reload command', (t) => {
    t.plan(6)

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
        t.equal(result.statusCode, 200, 'reload command is launched')
        try {
          const statBuf = fs.statSync('/tmp/gaia-admin-test.txt')
          t.pass('admin test file exists')

          const data = fs.readFileSync('/tmp/gaia-admin-test.txt').toString()
          t.equal(data, 'hello world\n', 'admin test file contents equal environ')
        } catch (e) {
          t.fail('admin test file does NOT exist')
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
        t.equal(result.statusCode, 404, 'missing reload command should 404')
        
        const configFailCommand = {
          reloadSettings: {
            command: '/bin/false',
          }
        } as any
        let server = new AdminAPI(configFailCommand)
        return server.handleReload()
      })
      .then((result) => {
        t.equal(result.statusCode, 500, 'failed reload command should 500')
        
        const configBadCommand = {
          reloadSettings: {
            command: '/bin/nonexistant'
          }
        } as any
        let server = new AdminAPI(configBadCommand)
        return server.handleReload()
      })
      .then((result) => {
        t.equal(result.statusCode, 500, 'missing reload command should 500')
        fs.unlinkSync('/tmp/gaia-admin-test.txt')
      })
  })

  test('get/set whitelist', (t) => {
    
    t.plan(8)

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
        t.equal(result.statusCode, 200, 'handleGetWhitelist status 200')
        t.deepEqual(result.status.config.whitelist, [], 'handleGetWhitelist gives []')

        return server.handleSetConfig({whitelist: ['1MCY4XvmhxDkDxw786P3nM5hmA9XJdmjhe']})
      })
      .then((result) => {
        t.equal(result.statusCode, 200, 'handleSetWhitelist status 200')
        return server.handleGetConfig()
      })
      .then((result) => {
        t.equal(result.statusCode, 200, 'handleGetWhitelist status 200 again')
        t.deepEqual(result.status.config.whitelist, ['1MCY4XvmhxDkDxw786P3nM5hmA9XJdmjhe'], 
          'handleGetWhitelist gives back new address')

        const newConfigJSON = fs.readFileSync(gaiaConfigPathWhitelist).toString()
        const newConfig = JSON.parse(newConfigJSON)
        t.deepEqual(newConfig.whitelist, ['1MCY4XvmhxDkDxw786P3nM5hmA9XJdmjhe'],
          'Gaia config file matches new whitelist')

        return server.handleSetConfig({whitelist: ['invalid address']})
      })
      .then((result) => {
        t.equal(result.statusCode, 400, 'handleGetWhitelist status 400 on bad address')

        // config file not touched 
        const newConfigJSON = fs.readFileSync(gaiaConfigPathWhitelist).toString()
        const newConfig = JSON.parse(newConfigJSON)
        t.deepEqual(newConfig.whitelist, ['1MCY4XvmhxDkDxw786P3nM5hmA9XJdmjhe'],
          'Gaia config file matches new whitelist')
        
        fs.unlinkSync(gaiaConfigPathWhitelist)
      })
  })

  test('get/set generic Gaia settings', (t) => {
  
    t.plan(9)

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
        t.equal(result.statusCode, 200, 'handleGetGaiaSettings status 200')
        t.deepEqual(result.status.config, gaiaConfig, 'handleGetGaiaSettings matches gaia config')

        return server.handleSetConfig(newGaiaConfig)
      })
      .then((result) => {
        t.equal(result.statusCode, 200, 'handleSetGaiaSettings status 200')
        return server.handleGetConfig()
      })
      .then((result) => {
        t.equal(result.statusCode, 200, 'handleGetGaiaSettings status 200 again')
        t.deepEqual(result.status.config, newGaiaConfig)
        
        return server.handleSetConfig(badGaiaConfig)
      })
      .then((result) => {
        t.equal(result.statusCode, 400, 'handleSetGaiaSettings status 400 on invalid config values')

        // config file not touched 
        const storedConfigJSON = fs.readFileSync(gaiaConfigPath).toString()
        const storedConfig = JSON.parse(storedConfigJSON)
        t.deepEqual(storedConfig, newGaiaConfig, 'Gaia config unchanged')

        return server.handleSetConfig({not: 'a', valid: 'config', structure: '!'})
      })
      .then((result) => {
        t.equal(result.statusCode, 400, 'handleSetGaiaSettings status 400 on invalid struct')

        // config file not modified
        const storedConfigJSON = fs.readFileSync(gaiaConfigPath).toString()
        const storedConfig = JSON.parse(storedConfigJSON)
        t.deepEqual(storedConfig, newGaiaConfig, 'Gaia config unchanged')

        fs.unlinkSync(gaiaConfigPath)
      })
  })

  test('get/set driver settings', (t) => {
  
    t.plan(36)

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
          t.equal(result.statusCode, 200, 'handleGetDriverSettings status 200')
          t.deepEqual(result.status.config, gaiaConfig, 
            `handleGetDriverSettings matches driver config for ${gaiaConfig.driver}`)

          return server.handleSetConfig(newGaiaConfig)
        })
        .then((result) => {
          t.equal(result.statusCode, 200, 'handleSetDriverSettings status 200')
          return server.handleGetConfig()
        })
        .then((result) => {
          t.equal(result.statusCode, 200, 'handleGetDriverSettings status 200 again')
          t.deepEqual(result.status.config, newGaiaConfig)
          
          return server.handleSetConfig(badGaiaConfig)
        })
        .then((result) => {
          t.equal(result.statusCode, 400, 'handleSetDriverSettings status 400 on invalid config values')

          // config file not touched 
          const storedConfigJSON = fs.readFileSync(gaiaConfigPath).toString()
          const storedConfig = JSON.parse(storedConfigJSON)
          t.deepEqual(storedConfig, newGaiaConfig, 'Gaia config unchanged')

          return server.handleSetConfig({not: 'a', valid: 'config', structure: '!'})
        })
        .then((result) => {
          t.equal(result.statusCode, 400, 'handleSetDriverSettings status 400 on invalid struct')

          // config file not modified
          const storedConfigJSON = fs.readFileSync(gaiaConfigPath).toString()
          const storedConfig = JSON.parse(storedConfigJSON)
          t.deepEqual(storedConfig, newGaiaConfig, 'Driver config unchanged')

          fs.unlinkSync(gaiaConfigPath)
        })
    }
  })
}

testServer()
