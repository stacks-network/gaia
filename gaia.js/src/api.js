/**
 * Encrypts the data provided with the app public key.
 * @param {String|Buffer} content - data to encrypt
 * @param {Object} [options=null] - options object
 * @param {String} options.publicKey - the hex string of the ECDSA public
 * key to use for encryption. If not provided, will use user's appPrivateKey.
 * @return {String} Stringified ciphertext object
 */
export function encryptContent(content: string | Buffer, publicKey: string, options?: {encoding?: string} = {}) {
  const cipherObject = encryptECIES(publicKey, content, options.encoding)
  return JSON.stringify(cipherObject)
}

/**
 * Decrypts data encrypted with `encryptContent` with the
 * transit private key.
 * @param {String|Buffer} content - encrypted content.
 * @param {Object} [options=null] - options object
 * @param {String} options.privateKey - the hex string of the ECDSA private
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
function getGaiaAddress(app: string, username: ?string, zoneFileLookupURL: ?string) {
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

/**
 * Stores the data provided in the app's data store to to the file specified.
 * @param {String} path - the path to store the data in
 * @param {String|Buffer} content - the data to store in the file
 * @param {Object} [options=null] - options object
 * @param {Boolean|String} [options.encrypt=true] - encrypt the data with the app private key
 *                                                  or the provided public key
 * @param {Boolean} [options.sign=false] - sign the data using ECDSA on SHA256 hashes with
 *                                         the app private key
 * @return {Promise} that resolves if the operation succeed and rejects
 * if it failed
 */
export function putFile(path: string, content: string | Buffer, privateKey: string,
                        options?: {
                          encrypt?: boolean | string,
                          sign?: boolean | string,
                          contentType?: string
                        }) {
  const defaults = {
    encrypt: true,
    sign: false,
    contentType: undefined
  }

  const opt = Object.assign({}, defaults, options)

  let contentType = opt.contentType
  if (!contentType) {
    contentType = 'text/plain'
    if (typeof (content) !== 'string') {
      contentType = 'application/octet-stream'
    }
  }

  // First, let's figure out if we need to get public/private keys,
  //  or if they were passed in

  let publicKey = ''
  if (opt.encrypt) {
    if (typeof (opt.encrypt) === 'string') {
      publicKey = opt.encrypt
    } else {
      publicKey = getPublicKeyFromPrivate(privateKey)
    }
  }

  // In the case of signing, but *not* encrypting,
  //   we perform two uploads. So the control-flow
  //   here will return there.
  if (!opt.encrypt && opt.sign) {
    const signingKey = (typeof (opt.sign) === 'string') ? opt.sign : privateKey

    const signatureObject = signECDSA(signingKey, content)
    const signatureContent = JSON.stringify(signatureObject)
    return getOrSetLocalGaiaHubConnection()
      .then(gaiaHubConfig => Promise.all([
        uploadToGaiaHub(path, content, gaiaHubConfig, contentType),
        uploadToGaiaHub(`${path}${SIGNATURE_FILE_SUFFIX}`,
                        signatureContent, gaiaHubConfig, 'application/json')]))
      .then(fileUrls => fileUrls[0])
  }

  // In all other cases, we only need one upload.
  if (opt.encrypt && !opt.sign) {
    content = encryptContent(content, { publicKey })
    contentType = 'application/json'
  } else if (opt.encrypt && opt.sign) {
    const cipherText = encryptContent(content, { publicKey })
    const signatureObject = signECDSA(privateKey, cipherText)
    const signedCipherObject = {
      signature: signatureObject.signature,
      publicKey: signatureObject.publicKey,
      cipherText
    }
    content = JSON.stringify(signedCipherObject)
    contentType = 'application/json'
  }
  return getOrSetLocalGaiaHubConnection()
    .then(gaiaHubConfig => uploadToGaiaHub(path, content, gaiaHubConfig, contentType))
}
