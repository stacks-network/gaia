/* @flow */

import bitcoin from 'bitcoinjs-lib'
import crypto from 'crypto'
import { decodeToken, TokenSigner, TokenVerifier } from 'jsontokens'
import { ecPairToHexString } from 'blockstack'
import { ValidationError } from './errors'
import logger from 'winston'

const DEFAULT_STORAGE_URL = 'storage.blockstack.org'
export const LATEST_AUTH_VERSION = 'v1'

function pubkeyHexToECPair (pubkeyHex) {
  const pkBuff = Buffer.from(pubkeyHex, 'hex')
  return bitcoin.ECPair.fromPublicKeyBuffer(pkBuff)
}

export class V1Authentication {
  token: string

  constructor(token: string) {
    this.token = token
  }

  static fromAuthPart(authPart: string) {
    if (!authPart.startsWith('v1:')) {
      throw new ValidationError('Authorization header should start with v1:')
    }
    const token = authPart.slice('v1:'.length)
    let decodedToken
    try {
      decodedToken = decodeToken(token)
    } catch (e) {
      throw new ValidationError('Failed to decode authentication JWT')
    }
    const publicKey = decodedToken.payload.iss
    if (!publicKey || !decodedToken) {
      throw new ValidationError('Auth token should be a JWT with at least an `iss` claim')
    }
    return new V1Authentication(token)
  }

  static makeAuthPart(secretKey: bitcoin.ECPair, challengeText: string) {
    const FOUR_MONTH_SECONDS = 60 * 60 * 24 * 31 * 4
    const publicKeyHex = secretKey.getPublicKeyBuffer().toString('hex')
    const salt = crypto.randomBytes(16).toString('hex')
    const payload = { gaiaChallenge: challengeText,
                      iss: publicKeyHex,
                      exp: FOUR_MONTH_SECONDS + (new Date()/1000),
                      salt }
    const signerKeyHex = ecPairToHexString(secretKey).slice(0, 64)
    const token = new TokenSigner('ES256K', signerKeyHex).sign(payload)
    return `v1:${token}`
  }

  isAuthenticationValid(address: string, challengeText: string,
                        options?: { throwOnFailure?: boolean }) {
    const defaults = {
      throwOnFailure: true
    }
    options = Object.assign({}, defaults, options)

    let decodedToken
    try {
      decodedToken = decodeToken(this.token)
    } catch (e) {
      throw new ValidationError('Failed to decode authentication JWT')
    }

    const publicKey = decodedToken.payload.iss
    const gaiaChallenge = decodedToken.payload.gaiaChallenge

    try {
      if (! publicKey) {
        throw new ValidationError('Must provide `iss` claim in JWT.')
      }

      const issuerAddress = pubkeyHexToECPair(publicKey).getAddress()

      if (issuerAddress !== address) {
        throw new ValidationError('Address not allowed to write on this path')
      }

      const verified = new TokenVerifier('ES256K', publicKey).verify(this.token)
      if (!verified) {
        throw new ValidationError('Failed to verify supplied authentication JWT')
      }

      if (gaiaChallenge !== challengeText) {
        throw new ValidationError(`Invalid gaiaChallenge text in supplied JWT: ${gaiaChallenge}`)
      }

      const expiresAt = decodedToken.payload.exp
      if (expiresAt && expiresAt < (new Date()/1000)) {
        throw new ValidationError(
          `Expired authentication token: expire time of ${expiresAt} (secs since epoch)`)
      }
      return true
    } catch (err) {
      if (!options.throwOnFailure) {
        return false
      } else {
        throw err
      }
    }
  }
}

export class LegacyAuthentication {
  publickey: bitcoin.ECPair
  signature: string
  constructor(publickey: bitcoin.ECPair, signature: string) {
    this.publickey = publickey
    this.signature = signature
  }

  static fromAuthPart(authPart: string) {
    const decoded = JSON.parse(Buffer.from(authPart, 'base64').toString())
    const publickey = pubkeyHexToECPair(decoded.publickey)
    const signature = bitcoin.ECSignature.fromDER(
      Buffer.from(decoded.signature, 'hex'))
    return new LegacyAuthentication(publickey, signature)
  }

  static makeAuthPart(secretKey: bitcoin.ECPair, challengeText: string) {
    const publickey = secretKey.getPublicKeyBuffer().toString('hex')
    const digest = bitcoin.crypto.sha256(challengeText)
    const signature = secretKey.sign(digest).toDER().toString('hex')

    const authObj = { publickey, signature }

    return Buffer.from(JSON.stringify(authObj)).toString('base64')
  }

  isAuthenticationValid(address: string, challengeText: string,
                        options?: { throwOnFailure?: boolean }) {
    const defaults = {
      throwOnFailure: true
    }
    options = Object.assign({}, defaults, options)

    if (this.publickey.getAddress() !== address) {
      if (options.throwOnFailure) {
        throw new ValidationError('Address not allowed to write on this path')
      }
      return false
    }

    const digest = bitcoin.crypto.sha256(challengeText)
    const valid = (this.publickey.verify(digest, this.signature) === true)

    if (options.throwOnFailure && !valid) {
      logger.debug(`Failed to validate with challenge text: ${challengeText}`)
      throw new ValidationError('Invalid signature or expired authentication token.')
    }
    return valid
  }
}

export function getChallengeText(myURL: string = DEFAULT_STORAGE_URL) {
  const header = 'gaiahub'
  const dateParts = new Date().toISOString().split('T')[0]
        .split('-')
  // for right now, access tokens are valid for the calendar year.
  const allowedSpan = dateParts[0]
  const myChallenge = 'blockstack_storage_please_sign'
  return JSON.stringify( [header, allowedSpan, myURL, myChallenge] )
}

export function parseAuthHeader(authHeader: string) {
  if (!authHeader.startsWith('bearer')) {
    throw new ValidationError('Failed to parse authentication header.')
  }
  const authPart = authHeader.slice('bearer '.length)
  const versionIndex = authPart.indexOf(':')
  if (versionIndex < 0) {
    // default to legacy authorization header
    return LegacyAuthentication.fromAuthPart(authPart)
  } else {
    const version = authPart.slice(0, versionIndex)
    if (version === 'v1') {
      return V1Authentication.fromAuthPart(authPart)
    } else {
      throw new ValidationError('Unknown authentication header version: ${version}')
    }
  }
}

export function validateAuthorizationHeader(authHeader: string, serverName: string,
                                            address: string) {
  let authObject = null
  try {
    authObject = parseAuthHeader(authHeader)
  } catch (err) {
    logger.error(err)
  }

  if (!authObject) {
    throw new ValidationError('Failed to parse authentication header.')
  }

  const challengeText = getChallengeText(serverName)
  authObject.isAuthenticationValid(address, challengeText)
}
