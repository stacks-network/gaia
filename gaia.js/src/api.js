/* @flow */
import fetch from 'cross-fetch'
import { publicKeyToAddress } from 'blockstack'

import { encryptECIES, decryptECIES, signECDSA, verifyECDSA } from './encryption'
import { uploadToGaiaHub } from './wire'
import { GaiaHubConfig } from './types'
import { SignatureVerificationError } from './errors'

const SIGNATURE_FILE_SUFFIX = '.sig'

function isAddress(maybeAddress: string) {
  const matches = maybeAddress.match(/^[13][a-km-zA-HJ-NP-Z0-9]{26,35}$/)
  return !!matches
}

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

function verifyContent(content: string | Buffer, verify: string, signature: string, signerPublicKey: string) {
  const testAddress = isAddress(verify)

  if (testAddress) {
    const signerAddress = publicKeyToAddress(signerPublicKey)
    if (signerAddress !== verify) {
      throw new SignatureVerificationError(`Signer pubkey address (${signerAddress}) doesn't`
                                           + ` match expected address (${verify})`)
    }
  } else {
    if (signerPublicKey !== verify) {
      throw new SignatureVerificationError(`Signer pubkey (${signerPublicKey}) doesn't`
                                           + ` match expected pubkey (${verify})`)
    }
  }

  if (!verifyECDSA(content, signerPublicKey, signature)) {
    throw new SignatureVerificationError('Contents do not match ECDSA signature on file')
  }

  // passed all checks
}

export function decryptAndVerifyContent(content: string, privateKey: string, verify: string) {
  let sigObject
  try {
    sigObject = JSON.parse(content)
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error('Failed to parse encrypted, signed content JSON. The content may not '
                      + 'be encrypted. If using getFile, try passing'
                      + ' { verify: false, decrypt: false }.')
    } else {
      throw err
    }
  }

  const signature = sigObject.signature
  const signerPublicKey = sigObject.publicKey
  const cipherText = sigObject.cipherText

  if (!signerPublicKey || !cipherText || !signature) {
    throw new SignatureVerificationError(
      'Failed to get signature verification data from file.'
    )
  }

  verifyContent(cipherText, verify, signature, signerPublicKey)
  // passed all verifications, decrypt and return.
  return decryptContent(cipherText, privateKey)
}

/* Get the gaia address used for servicing multiplayer reads for the given
 * (username, app) pair.
 * @private
 */

export function getGaiaAddressPart(bucketURL: string) {
  const matches = bucketURL.match(/([13][a-km-zA-HJ-NP-Z0-9]{26,35})/)
  if (!matches) {
    throw new Error(`Failed to parse gaia address from bucket URL: ${bucketURL}`)
  }
  return matches[matches.length - 1]
}


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

export function readAndCheckFileSignedUnencrypted(readURL: string, verify: string) {
  return Promise.all([fetch(readURL), fetch(`${readURL}${SIGNATURE_FILE_SUFFIX}`)])
    .then(([fileResp, signatureResp]) => {
      if (!fileResp.ok) {
        if (fileResp.status === 404) {
          throw new Error(`404: No such file at ${readURL}`)
        }
        throw new Error(`Received invalid response on attempted read of ${readURL}: ${fileResp.status}`)
      }
      if (!signatureResp.ok) {
        if (signatureResp.status === 404) {
          throw new Error(`404: Failed to find signature file for ${readURL}. Was this file signed?`)
        }
        throw new Error('Received invalid response on attempted read of ' +
                        `signature file ${readURL}${SIGNATURE_FILE_SUFFIX}: ${signatureResp.status}`)
      }
      let fileContentsPromise
      const contentType = fileResp.headers.get('Content-Type')
      if (contentType === null
          || contentType.startsWith('text')
          || contentType === 'application/json') {
        fileContentsPromise = fileResp.text()
      } else {
        fileContentsPromise = fileResp.arrayBuffer()
      }
      return Promise.all([fileContentsPromise, signatureResp.text()])
    })
    .then(([fileContents, signatureContents]) => {
      if (!fileContents) {
        return fileContents
      }
      if (!signatureContents || typeof signatureContents !== 'string') {
        throw new SignatureVerificationError('Failed to obtain signature for file: '
                                             + `${readURL}\n Looked in ${readURL}${SIGNATURE_FILE_SUFFIX}`)
      }
      let signature
      let publicKey
      try {
        const sigObject = JSON.parse(signatureContents)
        signature = sigObject.signature
        publicKey = sigObject.publicKey
        if (!signature || !publicKey) {
          throw new SyntaxError('publicKey or signature blank in signature object.')
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new Error('Failed to parse signature content JSON '
                          + `(path: ${readURL}${SIGNATURE_FILE_SUFFIX})`
                          + ' The content may be corrupted.')
        } else {
          throw err
        }
      }

      verifyContent(Buffer.from(fileContents), verify, signature, publicKey)

      return fileContents
    })
}

export function readFileFromPath(readURL: string,
                                 verify?: string,
                                 decrypt?: string) {
  if (!decrypt && verify) {
    readAndCheckFileSignedUnencrypted(readURL, verify)
  }
  return fetch(readURL)
    .then(resp => {
      if (!resp.ok) {
        if (resp.status === 404) {
          throw new Error(`404: No such file at ${readURL}`)
        }
        throw new Error(`Received invalid response on attempted read of ${readURL}`)
      } else {
        const forceText = !!decrypt || !!verify
        const contentType = resp.headers.get('Content-Type')
        if (forceText || contentType === null
            || contentType.startsWith('text')
            || contentType === 'application/json') {
          return resp.text()
        } else {
          return resp.arrayBuffer()
        }
      }
    })
    .then(content => {
      if (!decrypt && !verify) {
        return content
      } else if (decrypt && !verify) {
        return decryptContent(content, decrypt)
      } else if (decrypt && verify) {
        return decryptAndVerifyContent(content, decrypt, verify)
      }
    })
}

export function readFile(path: string,
                         bucketURL: string,
                         verify?: boolean | string,
                         decrypt?: string) {
  Promise.resolve().then(() => {
    let verifyWith = undefined
    if (verify) {
      verifyWith = (typeof verify === 'string') ?
        verify :
        getGaiaAddressPart(bucketURL)
    }
    return readFileFromPath(`${bucketURL}${path}`, verifyWith, decrypt)
  })
}
