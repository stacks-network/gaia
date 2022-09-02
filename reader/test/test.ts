import * as fs from 'fs'
import * as Path from 'path'

import { ReaderServer } from '../src/server.js'
import DiskDriver from '../src/drivers/diskDriver.js'
import { getConfig } from '../src/config.js'


test('check disk driver handleGet', (done) => {

  const storageDir = `/tmp/gaia-disk-${Math.random()}`

  // store /12345/foo/bar.txt
  fs.mkdirSync(storageDir)
  fs.mkdirSync(Path.join(storageDir, '/12345'))
  fs.mkdirSync(Path.join(storageDir, '/12345/foo'))
  fs.writeFileSync(Path.join(storageDir, '/12345/foo/bar.txt'), 'hello world')

  // store /.gaia-metadata/12345/foo/bar.txt
  fs.mkdirSync(Path.join(storageDir, '.gaia-metadata'))
  fs.mkdirSync(Path.join(storageDir, '.gaia-metadata/12345'))
  fs.mkdirSync(Path.join(storageDir, '.gaia-metadata/12345/foo'))
  fs.writeFileSync(Path.join(storageDir, '.gaia-metadata/12345/foo/bar.txt'),
    JSON.stringify({'content-type': 'application/potatoes'}))    // bogus mime type for testing
  
  const driverConfig = {
    cacheControl: 'no-cache',
    driver: 'disk',
    argsTransport: {
      level: 'warn',
      handleExceptions: true,
      timestamp: true,
      colorize: true,
      json: true
    },
    regtest: false,
    testnet: false,
    port: 8008,
    diskSettings: { storageRootDirectory: storageDir }
  }

  const serverConfig = getConfig()

  let driver = new DiskDriver(driverConfig)
  const server = new ReaderServer(driver, serverConfig)

  /**
   * For now there is only GET request in reader server. So the handleGet 3rd arg removed.
   */
  // server.handleGet('12345', 'foo/bar.txt', true)
  server.handleGet('12345', 'foo/bar.txt')
    .then((result) => {
      // file exists
      expect(result.exists).toBeTruthy()
      // file has correct content type
      expect(result.contentType).toEqual('application/potatoes')

      // try with missing content-type
      fs.unlinkSync(Path.join(storageDir, '.gaia-metadata/12345/foo/bar.txt'))
      // return server.handleGet('12345', 'foo/bar.txt', true)
      return server.handleGet('12345', 'foo/bar.txt')
    })
    .then((result) => {
      // file exists
      expect(result.exists).toBeTruthy()
      // file has fall-back content type
      expect(result.contentType).toEqual('application/octet-stream')

      // try without the gaia metadata directory
      fs.rmdirSync(Path.join(storageDir, '.gaia-metadata/12345/foo'))
      fs.rmdirSync(Path.join(storageDir, '.gaia-metadata/12345'))
      fs.rmdirSync(Path.join(storageDir, '.gaia-metadata'))
      // return server.handleGet('12345', 'foo/bar.txt', true)
      return server.handleGet('12345', 'foo/bar.txt')
    })
    .then((result) => {
      // file exists
      expect(result.exists).toBeTruthy()
      // file has fall-back content type
      expect(result.contentType).toEqual('application/octet-stream')
      // close file read stream
      result.fileReadStream.destroy()
      return new Promise((resolve, reject) => {
        result.fileReadStream.on('close', () => {
          resolve('Closed File Stream')
        })
        result.fileReadStream.on('error', reject)
      })
    })
    .then((res) => {
      
      console.log('\nres: ', res)

      // // blow away the file
      fs.unlinkSync(Path.join(storageDir, '12345/foo/bar.txt'))
      fs.rmdirSync(Path.join(storageDir, '12345/foo'))
      fs.rmdirSync(Path.join(storageDir, '12345'))
      
      // return server.handleGet('12345', 'foo/bar.txt', true)
      return server.handleGet('12345', 'foo/bar.txt')
    })
    .then((result) => {
      console.log('\nres: ', result)
      // file does not exist
      expect(!result.exists).toBeTruthy()
      // file has no content type
      expect(result.contentType).toEqual(undefined)

      fs.rmdirSync(storageDir)

      done()
    })
})
