var logging = require('winston')
var bitcoin = require('bitcoinjs-lib')

class StorageRequest {

  constructor (req, res) {
    this.bearerHeader = "bearer"
    this.requestPath = "/store/"
    this.req = req
    this.res = res
  }

  pubkeyHexToECPair (pubkeyHex) {
    let pkBuff = Buffer.from(pubkeyHex, "hex")
    return bitcoin.ECPair.fromPublicKeyBuffer(pkBuff)
  }

  challengeText () {
    let header = "gaiahub"
    let date = new Date().toISOString().split("T")[0]
    let myChallenge = "blockstack_storage_please_sign"
    let myURL = "storage.blockstack.org"
    return JSON.stringify( [header, date, myURL, myChallenge] )
  }

  // This checks if the signature for a given request is valid
  sigValid () {

    // todo: what about a multisig owner?
    let sigObj = JSON.parse(this.req.headers.authentication.slice(this.bearerHeader))
    let pkObj = this.pubkeyHexToECPair(sigObj.publickey)
    if (pkObj.getAddress() !== this.req.params.address) {
      return false
    }
    let digest = bitcoin.crypto.sha256(Buffer(this.challengeText()))
    if (pkObj.verify(digest, sigObj.signed) !== true) {
      return false
    }
    return true
  }

  // This checks if the request has a formatted auth header
  valid () {
    // return error if the authHeader isn't right
    // TODO: Requests failing here. Begin implementation of test.js with proper headers
    if (!this.req.headers.authentication.startsWith(this.bearerHeader)) {
      return false
    }
    // Otherwise return null
    return true
  }

  s3Write () {
    return {
      Bucket: `blockstack_user_${this.req.params.address}`,
      Key: this.req.params.filename,
      Body: this.req
    }
  }

  writeResponse (error, data, statusCode) {
    // todo: for now, just responding in plaintext, but want
    //       to move to a json api
    this.res.writeHead(statusCode, {'Content-Type' : 'text/plain'})
    // todo: cors headers
    if (error) {
      this.res.write(error)
    } else {
      this.res.write(data)
    }
    // End the response, this finshes the request and sends the response
    this.res.end()
  }
}

module.exports = StorageRequest
