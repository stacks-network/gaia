const test = require('tape')
const fs = require('fs')

const { AdminAPI } = require('../lib/server.js')

function testServer() {
  test('check authorization api key', (t) => {
    t.plan(4)

    const config = {
      apiKey: 'potatoes',
    }

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

        const configWithoutApiKey = {}
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
      apiKey: 'potatoes',
      reloadSettings: {
        command: '/bin/sh',
        argv: ["-c", "echo \"$HELLO\" > /tmp/gaia-admin-test.txt"],
        env: {
          "HELLO": "hello world"
        }
      }
    }

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
          t.ok('admin test file exists')

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
        }
        let server = new AdminAPI(configNoCommand)
        return server.handleReload()
      })
      .then((result) => {
        t.equal(result.statusCode, 404, 'missing reload command should 404')
        
        const configFailCommand = {
          reloadSettings: {
            command: '/bin/false',
          }
        }
        let server = new AdminAPI(configFailCommand)
        return server.handleReload()
      })
      .then((result) => {
        t.equal(result.statusCode, 500, 'failed reload command should 500')
        
        const configBadCommand = {
          reloadSettings: {
            command: '/bin/nonexistant'
          }
        }
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
      whitelist: []
    }

    const gaiaConfigPathWhitelist = `/tmp/gaia-config-whitelist-${Math.random()}`
    fs.writeFileSync(gaiaConfigPathWhitelist, JSON.stringify(gaiaConfig))

    const config = {
      gaiaSettings: {
        configPath: gaiaConfigPathWhitelist
      }
    }

    let server = new AdminAPI(config)
    server.handleGetWhitelist()
      .then((result) => {
        t.equal(result.statusCode, 200, 'handleGetWhitelist status 200')
        t.deepEqual(result.status.config.whitelist, [], 'handleGetWhitelist gives []')

        return server.handleSetWhitelist(['1MCY4XvmhxDkDxw786P3nM5hmA9XJdmjhe'])
      })
      .then((result) => {
        t.equal(result.statusCode, 200, 'handleSetWhitelist status 200')
        return server.handleGetWhitelist()
      })
      .then((result) => {
        t.equal(result.statusCode, 200, 'handleGetWhitelist status 200 again')
        t.deepEqual(result.status.config.whitelist, ['1MCY4XvmhxDkDxw786P3nM5hmA9XJdmjhe'], 
          'handleGetWhitelist gives back new address')

        const newConfigJSON = fs.readFileSync(gaiaConfigPathWhitelist).toString()
        const newConfig = JSON.parse(newConfigJSON)
        t.deepEqual(newConfig.whitelist, ['1MCY4XvmhxDkDxw786P3nM5hmA9XJdmjhe'],
          'Gaia config file matches new whitelist')

        return server.handleSetWhitelist(['invalid address'])
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

  test('get/set Gaia settings', (t) => {
  
    t.plan(9)

    const gaiaConfig = {
      validHubUrls: [],
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
    }

    let server = new AdminAPI(config)
    server.handleGetGaiaSettings()
      .then((result) => {
        t.equal(result.statusCode, 200, 'handleGetGaiaSettings status 200')
        t.deepEqual(result.status.config, gaiaConfig, 'handleGetGaiaSettings matches gaia config')

        return server.handleSetGaiaSettings(newGaiaConfig)
      })
      .then((result) => {
        t.equal(result.statusCode, 200, 'handleSetGaiaSettings status 200')
        return server.handleGetGaiaSettings()
      })
      .then((result) => {
        t.equal(result.statusCode, 200, 'handleGetGaiaSettings status 200 again')
        t.deepEqual(result.status.config, newGaiaConfig)
        
        return server.handleSetGaiaSettings(badGaiaConfig)
      })
      .then((result) => {
        t.equal(result.statusCode, 400, 'handleSetGaiaSettings status 400 on invalid config values')

        // config file not touched 
        const storedConfigJSON = fs.readFileSync(gaiaConfigPath).toString()
        const storedConfig = JSON.parse(storedConfigJSON)
        t.deepEqual(storedConfig, newGaiaConfig, 'Gaia config unchanged')

        return server.handleSetGaiaSettings({not: 'a', valid: 'config', structure: '!'})
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
      }

      let server = new AdminAPI(config)
      server.handleGetDriverSettings()
        .then((result) => {
          t.equal(result.statusCode, 200, 'handleGetDriverSettings status 200')
          t.deepEqual(result.status.config, gaiaConfig, 
            `handleGetDriverSettings matches driver config for ${gaiaConfig.driver}`)

          return server.handleSetDriverSettings(newGaiaConfig)
        })
        .then((result) => {
          t.equal(result.statusCode, 200, 'handleSetDriverSettings status 200')
          return server.handleGetDriverSettings()
        })
        .then((result) => {
          t.equal(result.statusCode, 200, 'handleGetDriverSettings status 200 again')
          t.deepEqual(result.status.config, newGaiaConfig)
          
          return server.handleSetDriverSettings(badGaiaConfig)
        })
        .then((result) => {
          t.equal(result.statusCode, 400, 'handleSetDriverSettings status 400 on invalid config values')

          // config file not touched 
          const storedConfigJSON = fs.readFileSync(gaiaConfigPath).toString()
          const storedConfig = JSON.parse(storedConfigJSON)
          t.deepEqual(storedConfig, newGaiaConfig, 'Gaia config unchanged')

          return server.handleSetDriverSettings({not: 'a', valid: 'config', structure: '!'})
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
