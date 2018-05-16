/* @flow */

import bitcoin from 'bitcoinjs-lib'

import { ValidationError } from './errors'
import logger from 'winston'

const DEFAULT_STORAGE_URL = 'storage.blockstack.org'

function pubkeyHexToECPair (pubkeyHex) {
  const pkBuff = Buffer.from(pubkeyHex, 'hex')
  return bitcoin.ECPair.fromPublicKeyBuffer(pkBuff)
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
    const authData = authPart.slice(versionIndex)
    if (version === 'v1') {
      return { version, authData }
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
