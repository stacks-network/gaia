/* @flow */

import bitcoin from 'bitcoinjs-lib'

import { ValidationError } from './errors'
import logger from 'winston'

const DEFAULT_STORAGE_URL = 'storage.blockstack.org'

function pubkeyHexToECPair (pubkeyHex) {
  const pkBuff = Buffer.from(pubkeyHex, 'hex')
  return bitcoin.ECPair.fromPublicKeyBuffer(pkBuff)
}

export class StorageAuthentication {
  publickey: bitcoin.ECPair
  signature: bitcoin.ECSignature
  myURL: string
  constructor (publickey: bitcoin.ECPair, signature: bitcoin.ECSignature,
               myURL: string = DEFAULT_STORAGE_URL) {
    this.publickey = publickey
    this.signature = signature
    this.myURL = myURL
  }

  static challengeText (myURL: string = DEFAULT_STORAGE_URL) {
    const header = 'gaiahub'
    const dateParts = new Date().toISOString().split('T')[0]
          .split('-')
    // for right now, access tokens are valid for the calendar year.
    const allowedSpan = dateParts[0]
    const myChallenge = 'blockstack_storage_please_sign'
    return JSON.stringify( [header, allowedSpan, myURL, myChallenge] )
  }

  static makeWithKey (secretKey: bitcoin.ECPair, myURL: string = DEFAULT_STORAGE_URL) {
    const publickey = bitcoin.ECPair.fromPublicKeyBuffer(
      secretKey.getPublicKeyBuffer()) // I hate you bitcoinjs-lib.
    const rawText = StorageAuthentication.challengeText(myURL)
    const digest = bitcoin.crypto.sha256(rawText)
    const signature = secretKey.sign(digest)
    return new StorageAuthentication(publickey, signature, myURL)
  }

  static fromAuthHeader (authHeader: string, myURL: string = DEFAULT_STORAGE_URL) {
    if (!authHeader.startsWith('bearer')) {
      return false
    }

    const authPart = authHeader.slice('bearer '.length)
    const decoded = JSON.parse(Buffer.from(authPart, 'base64').toString())
    const publickey = pubkeyHexToECPair(decoded.publickey)
    const signature = bitcoin.ECSignature.fromDER(
      Buffer.from(decoded.signature, 'hex'))
    return new StorageAuthentication(publickey, signature, myURL)
  }

  toAuthHeader () {
    const authObj = {
      publickey : this.publickey.getPublicKeyBuffer().toString('hex'),
      signature : this.signature.toDER().toString('hex')
    }
    // I realize that I'm b64 encoding hex encodings, but
    //  this keeps the formats from getting hateful.
    const authToken = Buffer.from(JSON.stringify(authObj)).toString('base64')
    return `bearer ${authToken}`
  }

  isAuthenticationValid (address: string, throwFailure: boolean) {
    if (this.publickey.getAddress() !== address) {
      if (throwFailure) {
        throw new ValidationError('Address not allowed to write on this path')
      }
      return false
    }
    const rawText = StorageAuthentication.challengeText(this.myURL)

    const digest = bitcoin.crypto.sha256(rawText)
    const valid = (this.publickey.verify(digest, this.signature) === true)

    if (throwFailure && !valid) {
      logger.debug(`Failed to validate with challenge text: ${rawText}`)
      throw new ValidationError('Invalid signature or expired authentication token.')
    }
    return valid
  }
}
