import test = require('tape-promise/tape')
import * as express from 'express'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as tlsServer from '../../src/server/tlsServer'
import { TlsPemCert, TlsPfxCert } from '../../src/server/config'
import { AddressInfo } from 'net'
import { RequestOptions } from 'https'
import { IncomingMessage } from 'http'
import { readStream } from '../../src/server/utils'


export function testTls() {

  const keyPemFile = path.resolve(__dirname, '../data/tls_certs/key.pem')
  const keyPemBuffer = fs.readFileSync(keyPemFile)

  const keyCertFile = path.resolve(__dirname, '../data/tls_certs/cert.pem')
  const keyCertBuffer = fs.readFileSync(keyCertFile)

  const keyPemUnencryptedFile = path.resolve(__dirname, '../data/tls_certs/key_unencrypted.pem')
  const keyPemUnencryptedBuffer = fs.readFileSync(keyPemUnencryptedFile)

  const pfxFile = path.resolve(__dirname, '../data/tls_certs/server.pfx')
  const pfxBuffer = fs.readFileSync(pfxFile)

  const pfxUnencryptedFile = path.resolve(__dirname, '../data/tls_certs/server_unencrypted.pfx')
  const pfxUnencryptedBuffer = fs.readFileSync(pfxUnencryptedFile)

  const testPassphrase = 'hunter2'

  test('test tls - unencrypted pfx string', async t => {
    const certData: TlsPfxCert = {
      pfxFile: pfxUnencryptedBuffer.toString('base64')
    }

    const app = express()
    app.get('/', (req, res) => res.send('OKAY'))

    const server = tlsServer.createHttpsServer(app, certData)

    try {
      await new Promise<void>((resolve, reject) => {
        server.on('error', error => reject(error))
        server.listen(0, '127.0.0.1', () => resolve())
      })
      t.pass('created https server from unencrypted pfx string')

      const addr = server.address() as AddressInfo
      const endpoint = `https://${addr.address}:${addr.port}`

      // prevent self-signed cert from being rejected
      const requestOpts: RequestOptions = {
        rejectUnauthorized: false,
      }

      const res = await new Promise<IncomingMessage>((resolve, reject) => {
        https.get(endpoint, requestOpts, res => resolve(res))
          .on('error', error => reject(error))
      })
      t.pass('valid https client request to server')

      const resBuffer = await readStream(res)
      const resString = resBuffer.toString()
      t.equal(resString, 'OKAY')
    } finally {
      server.close()
      server.unref()
    }
  })

  test('test tls - encrypted pfx string', async t => {
    const certData: TlsPfxCert = {
      pfxFile: pfxBuffer.toString('base64'),
      pfxPassphrase: testPassphrase
    }

    const app = express()
    app.get('/', (req, res) => res.send('OKAY'))

    const server = tlsServer.createHttpsServer(app, certData)

    try {
      await new Promise<void>((resolve, reject) => {
        server.on('error', error => reject(error))
        server.listen(0, '127.0.0.1', () => resolve())
      })
      t.pass('created https server from encrypted pfx string')

      const addr = server.address() as AddressInfo
      const endpoint = `https://${addr.address}:${addr.port}`

      // prevent self-signed cert from being rejected
      const requestOpts: RequestOptions = {
        rejectUnauthorized: false,
      }

      const res = await new Promise<IncomingMessage>((resolve, reject) => {
        https.get(endpoint, requestOpts, res => resolve(res))
          .on('error', error => reject(error))
      })
      t.pass('valid https client request to server')

      const resBuffer = await readStream(res)
      const resString = resBuffer.toString()
      t.equal(resString, 'OKAY')
    } finally {
      server.close()
      server.unref()
    }
  })

  test('test tls - encrypted pfx file', async t => {
    const certData: TlsPfxCert = {
      pfxFile: pfxFile,
      pfxPassphrase: testPassphrase
    }

    const app = express()
    app.get('/', (req, res) => res.send('OKAY'))

    const server = tlsServer.createHttpsServer(app, certData)

    try {
      await new Promise<void>((resolve, reject) => {
        server.on('error', error => reject(error))
        server.listen(0, '127.0.0.1', () => resolve())
      })
      t.pass('created https server from encrypted pfx file')

      const addr = server.address() as AddressInfo
      const endpoint = `https://${addr.address}:${addr.port}`

      // prevent self-signed cert from being rejected
      const requestOpts: RequestOptions = {
        rejectUnauthorized: false,
      }

      const res = await new Promise<IncomingMessage>((resolve, reject) => {
        https.get(endpoint, requestOpts, res => resolve(res))
          .on('error', error => reject(error))
      })
      t.pass('valid https client request to server')

      const resBuffer = await readStream(res)
      const resString = resBuffer.toString()
      t.equal(resString, 'OKAY')
    } finally {
      server.close()
      server.unref()
    }
  })

  test('test tls - unencrypted pem strings', async t => {
    const certData: TlsPemCert = {
      keyFile: keyPemUnencryptedBuffer.toString(),
      certFile: keyCertBuffer.toString()
    }

    const app = express()
    app.get('/', (req, res) => res.send('OKAY'))

    const server = tlsServer.createHttpsServer(app, certData)

    try {
      await new Promise<void>((resolve, reject) => {
        server.on('error', error => reject(error))
        server.listen(0, '127.0.0.1', () => resolve())
      })
      t.pass('created https server from unencrypted pem key string')

      const addr = server.address() as AddressInfo
      const endpoint = `https://${addr.address}:${addr.port}`

      // prevent self-signed cert from being rejected
      const requestOpts: RequestOptions = {
        rejectUnauthorized: false,
      }

      const res = await new Promise<IncomingMessage>((resolve, reject) => {
        https.get(endpoint, requestOpts, res => resolve(res))
          .on('error', error => reject(error))
      })
      t.pass('valid https client request to server')

      const resBuffer = await readStream(res)
      const resString = resBuffer.toString()
      t.equal(resString, 'OKAY')
    } finally {
      server.close()
      server.unref()
    }
  })

  test('test tls - encrypted pem strings', async t => {
    const certData: TlsPemCert = {
      keyFile: keyPemBuffer.toString(),
      certFile: keyCertBuffer.toString(),
      keyPassphrase: testPassphrase
    }

    const app = express()
    app.get('/', (req, res) => res.send('OKAY'))

    const server = tlsServer.createHttpsServer(app, certData)

    try {
      await new Promise<void>((resolve, reject) => {
        server.on('error', error => reject(error))
        server.listen(0, '127.0.0.1', () => resolve())
      })
      t.pass('created https server from encrypted pem key string')

      const addr = server.address() as AddressInfo
      const endpoint = `https://${addr.address}:${addr.port}`

      // prevent self-signed cert from being rejected
      const requestOpts: RequestOptions = {
        rejectUnauthorized: false,
      }

      const res = await new Promise<IncomingMessage>((resolve, reject) => {
        https.get(endpoint, requestOpts, res => resolve(res))
          .on('error', error => reject(error))
      })
      t.pass('valid https client request to server')

      const resBuffer = await readStream(res)
      const resString = resBuffer.toString()
      t.equal(resString, 'OKAY')
    } finally {
      server.close()
      server.unref()
    }
  })

  test('test tls - encrypted pem files', async t => {
    const certData: TlsPemCert = {
      keyFile: keyPemFile,
      certFile: keyCertFile,
      keyPassphrase: testPassphrase
    }

    const app = express()
    app.get('/', (req, res) => res.send('OKAY'))

    const server = tlsServer.createHttpsServer(app, certData)

    try {
      await new Promise<void>((resolve, reject) => {
        server.on('error', error => reject(error))
        server.listen(0, '127.0.0.1', () => resolve())
      })
      t.pass('created https server from encrypted pem key file')

      const addr = server.address() as AddressInfo
      const endpoint = `https://${addr.address}:${addr.port}`

      // prevent self-signed cert from being rejected
      const requestOpts: RequestOptions = {
        rejectUnauthorized: false,
      }

      const res = await new Promise<IncomingMessage>((resolve, reject) => {
        https.get(endpoint, requestOpts, res => resolve(res))
          .on('error', error => reject(error))
      })
      t.pass('valid https client request to server')

      const resBuffer = await readStream(res)
      const resString = resBuffer.toString()
      t.equal(resString, 'OKAY')
    } finally {
      server.close()
      server.unref()
    }
  })
}
