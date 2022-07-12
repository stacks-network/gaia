import * as fs from 'fs'
import * as Path from 'path'

import { GaiaDiskReader } from '../src/server.js'

test('check handleGet', (done) => {
  expect.assertions(8)

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

  const config = {
    diskSettings: {
      storageRootDirectory: storageDir
    }
  }

  const server = new GaiaDiskReader(config)
  server.handleGet('12345', 'foo/bar.txt', true)
    .then((result) => {
      // file exists
      expect(result.exists).toBeTruthy()
      // file has correct content type
      expect(result.contentType).toEqual('application/potatoes')

      // try with missing content-type
      fs.unlinkSync(Path.join(storageDir, '.gaia-metadata/12345/foo/bar.txt'))
      return server.handleGet('12345', 'foo/bar.txt', true)
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
      return server.handleGet('12345', 'foo/bar.txt', true)
    })
    .then((result) => {
      // file exists
      expect(result.exists).toBeTruthy()
      // file has fall-back content type
      expect(result.contentType).toEqual('application/octet-stream')

      // close file read stream
      result.fileReadStream.close()
      return new Promise((resolve, reject) => {
        result.fileReadStream.on('close', resolve)
        result.fileReadStream.on('error', reject)
      })
    })
    .then(() => {
      // blow away the file
      fs.unlinkSync(Path.join(storageDir, '12345/foo/bar.txt'))
      fs.rmdirSync(Path.join(storageDir, '12345/foo'))
      fs.rmdirSync(Path.join(storageDir, '12345'))

      return server.handleGet('12345', 'foo/bar.txt', true)
    })
    .then((result) => {
      // file does not exist
      expect(!result.exists).toBeTruthy()
      // file has no content type
      expect(result.contentType).toEqual(undefined)

      fs.rmdirSync(storageDir)

      done()
    })
})

