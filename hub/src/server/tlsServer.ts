import { Application as ExpressApp } from 'express'
import * as https from 'https'
import * as fs from 'fs'
import { TlsCertConfigInterface, TlsPfxCert, TlsPemCert } from './config'

function tryDecodeBase64(content: string): Buffer | false {
  try {
    const buffer = Buffer.from(content, 'base64')
    if (buffer.toString('base64') === content) {
      return buffer
    } else {
      return false
    }
  } catch (error) {
    return false
  }
}

const PEM_PREFIX = '-----BEGIN '

function isTlsPfxCert(tlsConfig: TlsCertConfigInterface): tlsConfig is TlsPfxCert {
  return !!(tlsConfig as TlsPfxCert).pfxFile
}

function isTlsPemCert(tlsConfig: TlsCertConfigInterface): tlsConfig is TlsPemCert {
  return !!(tlsConfig as TlsPemCert).keyFile
}

export function loadPemCert(tlsConfig: TlsPemCert, opts: https.ServerOptions) {
  if (tlsConfig.keyFile.trimLeft().startsWith(PEM_PREFIX)) {
    opts.key = tlsConfig.keyFile
  } else {
    try {
      opts.key = fs.readFileSync(tlsConfig.keyFile)
    } catch (error) {
      console.error(`Error reading keyFile ${tlsConfig.keyFile}`)
      throw error
    }
  }
  if (tlsConfig.certFile.trimLeft().startsWith(PEM_PREFIX)) {
    opts.cert = tlsConfig.certFile
  } else {
    try {
      opts.cert = fs.readFileSync(tlsConfig.certFile)
    } catch (error) {
      console.error(`Error reading certFile ${tlsConfig.certFile}`)
      throw error
    }
  }
  if (tlsConfig.keyPassphrase !== undefined) {
    opts.passphrase = tlsConfig.keyPassphrase
  }
}

export function loadPfxCert(tlsConfig: TlsPfxCert, opts: https.ServerOptions) {
  let fileExists = false
  try {
    fileExists = fs.statSync(tlsConfig.pfxFile).isFile()
  } catch (error) {
    // ignore
  }

  if (fileExists) {
    try {
      opts.pfx = fs.readFileSync(tlsConfig.pfxFile)
    } catch (error) {
      console.error(`Error reading pfxFile ${tlsConfig.pfxFile}`)
      throw error
    }
  } else {
    const pfxData = tryDecodeBase64(tlsConfig.pfxFile)
    if (pfxData) {
      opts.pfx = pfxData
    } else {
      throw new Error(`Invalid pfxFile config. The value ${tlsConfig.pfxFile} is not a readable file path or base64 string`)
    }
  }
  if (tlsConfig.pfxPassphrase !== undefined) {
    opts.passphrase = tlsConfig.pfxPassphrase
  }
}

export function createHttpsServer(app: ExpressApp, tlsConfig: TlsCertConfigInterface): https.Server {
  if (!tlsConfig) {
    throw new Error('`tlsCertConfig` must be provided')
  }
  const opts: https.ServerOptions = { }
  if (isTlsPfxCert(tlsConfig)) {
    loadPfxCert(tlsConfig, opts)
  } else if (isTlsPemCert(tlsConfig)) {
    loadPemCert(tlsConfig, opts)
  } else {
    throw new Error('The `tlsCertConfig` must specify either a `keyFile` or a `pfxFile` property')
  }
  
  return https.createServer(opts, app)
}
