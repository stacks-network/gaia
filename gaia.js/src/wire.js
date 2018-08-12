/* @flow */

import fetch from 'cross-fetch'
import { TokenSigner } from 'jsontokens'
import { hexStringToECPair, getPublicKeyFromPrivate, publicKeyToAddress } from 'blockstack'

const FOUR_MONTH_SECONDS = 60 * 60 * 24 * 31 * 4

export type GaiaHubConfig = {
  address: string,
  url_prefix: string,
  token: string,
  server: string
}

export type HubInfo = {
  challenge_text: string,
  latest_auth_version?: string,
  read_url_prefix: string
}

function makeLegacyAuthPart(challengeText: string, secretKey: string): string {
  // only sign specific legacy auth challenges.
  secretKey = secretKey.slice(0, 64)

  let parsedChallenge
  try {
    parsedChallenge = JSON.parse(challengeText)
  } catch (err) {
    throw new Error('Failed in parsing legacy challenge text from the gaia hub.')
  }
  if (parsedChallenge[0] === 'gaiahub'
      && parsedChallenge[3] === 'blockstack_storage_please_sign') {
    const signer = hexStringToECPair(signerKeyHex + '01')
    const digest = bitcoin.crypto.sha256(challengeText)
    const signature = signer.sign(digest).toDER().toString('hex')
    const publickey = getPublicKeyFromPrivate(signerKeyHex)
    const token = Buffer.from(JSON.stringify(
      { publickey, signature }
    )).toString('base64')
    return token
  } else {
    throw new Error('Failed to connect to legacy gaia hub. If you operate this hub, please update.')
  }
}

export function makeAuthPart(secretKey: string, challengeText: string,
                             associationToken?: string, hubUrl?: string) {
  // the following blockstack.js functions _always_ return compressed pubkeys
  //   _and_ error if you give them a 33-byte length secret key indicated the pubkey
  //  should be compressed.
  //
  //   BOLD OPINION:
  //      we should  default compressed everywhere.
  //
  secretKey = secretKey.slice(0, 64)
  const publicKeyHex = getPublicKeyFromPrivate(secretKey)
  const salt = crypto.randomBytes(16).toString('hex')
  const payload = { gaiaChallenge: challengeText,
                    iss: publicKeyHex,
                    exp: FOUR_MONTH_SECONDS + (new Date()/1000),
                    associationToken,
                    hubUrl, salt }
  const token = new TokenSigner('ES256K', secretKey).sign(payload)
  return `v1:${token}`
}


export function makeAssociationToken(secretKey: string, childPublicKey: string) {
  secretKey = secretKey.slice(0, 64)
  const publicKeyHex = getPublicKeyFromPrivate(secretKey)
  const salt = crypto.randomBytes(16).toString('hex')
  const payload = { childToAssociate: childPublicKey,
                    iss: publicKeyHex,
                    exp: FOUR_MONTH_SECONDS + (new Date()/1000),
                    salt }
  const token = new TokenSigner('ES256K', secretKey).sign(payload)
  return token
}

export function connectToGaiaHub(gaiaHubUrl: string, secretKey: string): Promise<GaiaHubConfig> {
  secretKey = secretKey.slice(0, 64)
  return fetch(`${gaiaHubUrl}/hub_info`)
    .then(response => response.json())
    .then((hubInfo: HubInfo) => {
      const readURL = hubInfo.read_url_prefix
      const token = makeV1GaiaAuthToken(hubInfo, secretKey, gaiaHubUrl)
      const address = publicKeyToAddress(getPublicKeyFromPrivate(secretKey))
      return {
        url_prefix: readURL,
        address,
        token,
        server: gaiaHubUrl
      }
    })
}

/**
 * @returns {Promise} that resolves to the readUrl for the stored content.
 */
export function uploadToGaiaHub(filename: string, contents: string | Buffer,
                                hubConfig: GaiaHubConfig,
                                contentType: string = 'application/octet-stream'): Promise<string> {
  return fetch(`${hubConfig.server}/store/${hubConfig.address}/${filename}`,
               { method: 'POST',
                 headers: {
                   'Content-Type': contentType,
                   Authorization: `bearer ${hubConfig.token}`
                 },
                 body: contents })
    .then(response => {
      if (response.ok) {
        return response.json()
      } else {
        return response.text()
          .then(textResponse => {
                throw new Error(`Failed to upload to Gaia hub:\n${textResponse}`)})
      }
    })
    .then(responseJSON => responseJSON.publicURL)
}

export function getBucketUrl(secretKey: string, gaiaHubUrl?: string,
                             hubConfig?: string): Promise<string> {
  try {
    const isValid = bitcoin.ECPair.fromPrivateKey(Buffer.from(secretKey, 'hex'))
  } catch (e) {
    return Promise.reject(e)
  }

  const address = publicKeyToAddress(getPublicKeyFromPrivate(
    secretKey))

  if (hubConfig) {
    const readURL = hubConfig.url_prefix
    return Promise.resolve(`${readURL}${address}/`)
  } else if (!gaiaHubUrl) {
    return Promise.reject(new Error('Must supply either hubConfig or gaiaHubUrl'))
  }

  return fetch(`${gaiaHubUrl}/hub_info`)
    .then(response => response.json())
    .then((responseJSON) => {
      const readURL = responseJSON.read_url_prefix
      return `${readURL}${address}/`
    })
}
