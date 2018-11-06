const test = require('tape')
const fs = require('fs')

const { AdminAPI } = require('../lib/server.js')

function testServer() {
  test('check authorization api key', (t) => {
    t.plan(5)

    const config = {
      apiKey: 'potatoes',
    }
    
    server.checkAuthorization(config, 'bearer potatoes')
      .then((result) => {
        t.equal(result, true, 'correct API key passes authorization')
        return server.checkAuthorization(config, 'bearer nopotatoes')
      })
      .then((result) => {
        t.equal(result, false, 'incorrect API key fails authorization')
        return server.checkAuthorization(config, 'nobearer potatoes')
      })
      .then((result) => {
        t.equal(result, false, 'non-bearer authorization headers fail authorization')

        const configWithoutApiKey = {}
        return server.checkAuthorization(configWithoutApiKey, 'bearer potatoes')
      })
      .then((result) => {
        t.equal(result, false, 'no API key causes authorization to fail')
      })
  })

  test('reload command', (t) => {

    const config = {
      apiKey: 'potatoes',
      reloadSettings: {
        cmd: '/bin/sh',
        argv: ["-c", "echo \"$HELLO\" > /tmp/gaia-admin-test.txt"],
        env: {
          "HELLO": "hello world"
        }
      }
    }

    try {
      fs.unlinkSync('/tmp/gaia-admin-test.txt')
    } catch (e) {
      {}
    }
     
    server.handleReload(config)
      .then((result) => {
        t.equal(result.statusCode, 200, 'reload command is launched')
        try {
          const statBuf = fs.statSync('/tmp/gaia-admin-test.txt')
          t.ok('admin test file exists')

          const data = fs.readFileSync('/tmp/gaia-admin-test.txt').toString()
          t.equal(data, 'hello world', 'admin test file contents equal environ')
        } catch (e) {
          t.fail('admin test file does NOT exist')
        }

        const configNoCommand = {
          reloadSettings: {
            cmd: '',
            argv: ['-c', "echo \"$HELLO\" > /tmp/gaia-admin-test.txt"],
            env: {
              "HELLO": "hello world"
            }
          }
        }
        return server.handleReload(config)
      })
      .then((result) => {
        t.equal(result.statusCode, 404, 'missing reload command should 404')
        
        const configFailCommand = {
          reloadSettings: {
            cmd: '/bin/false',
          }
        }
        return server.handleReload(config)
      })
      .then((result) => {
        t.equal(result.statusCode, 500, 'failed reload command should 500')
        
        const configBadCommand = {
          reloadSettings: {
            cmd: '/bin/nonexistant'
          }
        }
        return server.handleReload(config)
      })
      .then((result) => {
        t.equal(result.statusCode, 500, 'missing reload command should 500')
      })
  })
}

testServer()
