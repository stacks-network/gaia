var bitcoin = require('bitcoinjs-lib')

function pubkeyHexToECPair (pubkeyHex) {
  let pkBuff = Buffer.from(pubkeyHex, "hex")
  return bitcoin.ECPair.fromPublicKeyBuffer(pkBuff)
}

class StorageAuthentication {
  constructor (publickey, signature) {
    this.publickey = publickey
    this.signature = signature
  }

  static challengeText () {
    let header = "gaiahub"
    let date = new Date().toISOString().split("T")[0]
    let myChallenge = "blockstack_storage_please_sign"
    let myURL = "storage.blockstack.org"
    return JSON.stringify( [header, date, myURL, myChallenge] )
  }

  static makeWithKey (secretKey) {
    let publickey = bitcoin.ECPair.fromPublicKeyBuffer(
      secretKey.getPublicKeyBuffer()) // I hate you bitcoinjs-lib.
    let rawText = StorageAuthentication.challengeText()
    let digest = bitcoin.crypto.sha256(rawText)
    let signature = secretKey.sign(digest)
    return new StorageAuthentication(publickey, signature)
  }

  static fromAuthHeader (authHeader) {
    if (!authHeader.startsWith("bearer")) {
      return false
    }

    let authPart = authHeader.slice("bearer".length + 1)
    let decoded = JSON.parse(Buffer(authPart, 'base64').toString())
    let publickey = pubkeyHexToECPair(decoded.publickey)
    let signature = bitcoin.ECSignature.fromDER(
      new Buffer(decoded.signature, 'hex'))
    return new StorageAuthentication(publickey, signature)
  }

  toAuthHeader () {
    let authObj = {
      publickey : this.publickey.getPublicKeyBuffer().toString('hex'),
      signature : this.signature.toDER().toString('hex')
    }
    // I realize that I'm b64 encoding hex encodings, but
    //  this keeps the formats from getting hateful.
    let authToken = Buffer( JSON.stringify( authObj ) ).toString('base64')
    return `bearer ${authToken}`
  }

  isAuthenticationValid (address) {
    if (this.publickey.getAddress() !== address) {
      return false
    }
    let rawText = StorageAuthentication.challengeText()
    let digest = bitcoin.crypto.sha256(rawText)
    return (this.publickey.verify(digest, this.signature) === true)
  }
}

module.exports = StorageAuthentication
