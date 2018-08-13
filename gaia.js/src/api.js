/* @flow */

import { encryptECIES, decryptECIES, signECDSA } from './encryption'
import { uploadToGaiaHub } from './wire'
import { GaiaHubConfig } from './types'

const SIGNATURE_FILE_SUFFIX = '.sig'

/**
 * Encrypts the data provided with the app public key.
 * @param {String|Buffer} content - data to encrypt
 * @param {String} publicKey - the hex string of the ECDSA public
 * key to use for encryption. If not provided, will use user's appPrivateKey.
 * @param {Object} [options=null] - options object.
 * @param {String} encoding - the encoding to use for the ciphertext, default is 'hex'
 * @return {String} Stringified ciphertext object
 */
export function encryptContent(content: string | Buffer, publicKey: string,
                               options?: { encoding?: buffer$Encoding } = {}) {
  const cipherObject = encryptECIES(publicKey, content, options.encoding)
  return JSON.stringify(cipherObject)
}

/**
 * Decrypts data encrypted with `encryptContent` with the
 * transit private key.
 * @param {String|Buffer} content - encrypted content.
 * @param {String} privateKey - the hex string of the ECDSA private
 * key to use for decryption. If not provided, will use user's appPrivateKey.
 * @return {String|Buffer} decrypted content.
 */
export function decryptContent(content: string, privateKey: string) {
  try {
    const cipherObject = JSON.parse(content)
    return decryptECIES(privateKey, cipherObject)
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error('Failed to parse encrypted content JSON. The content may not '
                      + 'be encrypted. If using getFile, try passing { decrypt: false }.')
    } else {
      throw err
    }
  }
}

/* Get the gaia address used for servicing multiplayer reads for the given
 * (username, app) pair.
 * @private
 */
/*
export function getGaiaAddress(app: string, username: ?string, zoneFileLookupURL: ?string) {
  return Promise.resolve()
    .then(() => {
      if (username) {
        return getUserAppFileUrl('/', username, app, zoneFileLookupURL)
      } else {
        return getOrSetLocalGaiaHubConnection()
          .then(gaiaHubConfig => getFullReadUrl('/', gaiaHubConfig))
      }
    })
    .then((fileUrl) => {
      const matches = fileUrl.match(/([13][a-km-zA-HJ-NP-Z0-9]{26,35})/)
      if (!matches) {
        throw new Error('Failed to parse gaia address')
      }
      return matches[matches.length - 1]
    })
}
*/

/**
 * Stores the data provided in the app's data store to to the file specified.
 * @param {String} path - the path to store the data in
 * @param {String|Buffer} content - the data to store in the file
 * @param {GaiaHubConfig} hubConfig - the config object for communicating with the write-gaia hub.
 * @param {Object} [options=null] - options object
 * @param {String} [options.encryptPublicKey=null] - if provided, encrypt data with the public key
 * @param {String} [options.signSecretKey=null] - if provided, sign the data using ECDSA on
 *      SHA256 hashes with the given private key
 * @return {Promise} that resolves if the operation succeed and rejects
 * if it failed
 */
export function putFile(path: string, content: string | Buffer, hubConfig: GaiaHubConfig,
                        options?: {
                          encryptPublicKey?: string,
                          signSecretKey?: string,
                          contentType?: string
                        } = {}) : Promise<string> {

  const signSecretKey = options.signSecretKey
  const encryptPublicKey = options.encryptPublicKey
  let contentType = options.contentType
  if (!contentType) {
    contentType = 'text/plain'
    if (typeof (content) !== 'string') {
      contentType = 'application/octet-stream'
    }
  }

  // In the case of signing, but *not* encrypting,
  //   we perform two uploads.
  if (!encryptPublicKey && signSecretKey) {
    const signatureObject = signECDSA(signSecretKey, content)
    const signatureContent = JSON.stringify(signatureObject)
    return Promise.all([
      uploadToGaiaHub(path, content, hubConfig, contentType),
      uploadToGaiaHub(`${path}${SIGNATURE_FILE_SUFFIX}`,
                      signatureContent, hubConfig, 'application/json')])
      .then(fileUrls => fileUrls[0])
  }

  // In all other cases, we only need one upload.
  if (encryptPublicKey && !signSecretKey) {
    content = encryptContent(content, encryptPublicKey)
    contentType = 'application/json'
  } else if (encryptPublicKey && signSecretKey) {
    const cipherText = encryptContent(content, encryptPublicKey)
    const signatureObject = signECDSA(signSecretKey, cipherText)
    const signedCipherObject = {
      signature: signatureObject.signature,
      publicKey: signatureObject.publicKey,
      cipherText
    }
    content = JSON.stringify(signedCipherObject)
    contentType = 'application/json'
  }
  return uploadToGaiaHub(path, content, hubConfig, contentType)
}
