import express from 'express'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as tlsServer from '../../src/server/tlsServer.js'
import { TlsPemCert, TlsPfxCert } from '../../src/server/config.js'
import { AddressInfo } from 'net'
import { RequestOptions } from 'https'
import { IncomingMessage } from 'http'
import { readStream } from '../../src/server/utils.js'


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


describe('test tls - unencrypted pfx string', () => {
  const certData: TlsPfxCert = {
    pfxFile: pfxUnencryptedBuffer.toString('base64')
  }

  const app = express()
  app.get('/', (req, res) => res.send('OKAY'))

  const server = tlsServer.createHttpsServer(app, certData)

  it('create https server + valid https client request', async () => {
    await new Promise<void>((resolve, reject) => {
      server.on('error', error => reject(error))
      server.listen(0, '127.0.0.1', () => resolve())
    })

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

    const resBuffer = await readStream(res)
    const resString = resBuffer.toString()
    expect(resString).toEqual('OKAY')
  })

  afterAll(() => {
    server.close()
    server.unref()
  })
})

describe('test tls - encrypted pfx string', () => {
  const certData: TlsPfxCert = {
    pfxFile: pfxBuffer.toString('base64'),
    pfxPassphrase: testPassphrase
  }

  const app = express()
  app.get('/', (req, res) => res.send('OKAY'))

  const server = tlsServer.createHttpsServer(app, certData)

  it('create https server + valid https client request', async () => {
    await new Promise<void>((resolve, reject) => {
      server.on('error', error => reject(error))
      server.listen(0, '127.0.0.1', () => resolve())
    })

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

    const resBuffer = await readStream(res)
    const resString = resBuffer.toString()
    expect(resString).toEqual('OKAY')
  })

  afterAll(() => {
    server.close()
    server.unref()
  })
})

describe('test tls - encrypted pfx file', () => {
  const certData: TlsPfxCert = {
    pfxFile: pfxFile,
    pfxPassphrase: testPassphrase
  }

  const app = express()
  app.get('/', (req, res) => res.send('OKAY'))

  const server = tlsServer.createHttpsServer(app, certData)

  it('create https server + valid https client request', async () => {
    await new Promise<void>((resolve, reject) => {
      server.on('error', error => reject(error))
      server.listen(0, '127.0.0.1', () => resolve())
    })

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

    const resBuffer = await readStream(res)
    const resString = resBuffer.toString()
    expect(resString).toEqual('OKAY')
  })

  afterAll(() => {
    server.close()
    server.unref()
  })
})

describe('test tls - unencrypted pem strings', () => {
  const certData: TlsPemCert = {
    keyFile: keyPemUnencryptedBuffer.toString(),
    certFile: keyCertBuffer.toString()
  }

  const app = express()
  app.get('/', (req, res) => res.send('OKAY'))

  const server = tlsServer.createHttpsServer(app, certData)

  it('create https server + valid https client request', async () => {
    await new Promise<void>((resolve, reject) => {
      server.on('error', error => reject(error))
      server.listen(0, '127.0.0.1', () => resolve())
    })

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

    const resBuffer = await readStream(res)
    const resString = resBuffer.toString()
    expect(resString).toEqual('OKAY')
  })

  afterAll(() => {
    server.close()
    server.unref()
  })
})

describe('test tls - encrypted pem strings', () => {
  const certData: TlsPemCert = {
    keyFile: keyPemBuffer.toString(),
    certFile: keyCertBuffer.toString(),
    keyPassphrase: testPassphrase
  }

  const app = express()
  app.get('/', (req, res) => res.send('OKAY'))

  const server = tlsServer.createHttpsServer(app, certData)

  it('create https server + valid https client request', async () => {
    await new Promise<void>((resolve, reject) => {
      server.on('error', error => reject(error))
      server.listen(0, '127.0.0.1', () => resolve())
    })

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

    const resBuffer = await readStream(res)
    const resString = resBuffer.toString()
    expect(resString).toEqual('OKAY')
  })

  afterAll(() => {
    server.close()
    server.unref()
  })
})

describe('test tls - encrypted pem files', () => {
  const certData: TlsPemCert = {
    keyFile: keyPemFile,
    certFile: keyCertFile,
    keyPassphrase: testPassphrase
  }

  const app = express()
  app.get('/', (req, res) => res.send('OKAY'))

  const server = tlsServer.createHttpsServer(app, certData)

  it('create https server + valid https client request', async () => {
    await new Promise<void>((resolve, reject) => {
      server.on('error', error => reject(error))
      server.listen(0, '127.0.0.1', () => resolve())
    })

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

    const resBuffer = await readStream(res)
    const resString = resBuffer.toString()
    expect(resString).toEqual('OKAY')
  })

  afterAll(() => {
    server.close()
    server.unref()
  })
})
