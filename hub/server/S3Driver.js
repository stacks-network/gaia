var logging = require('winston')
var S3 = require('aws-sdk/clients/s3')
var bitcoin = require('bitcoinjs-lib')

class StorageRequest {

  constructor (req, res, s3) {
    this.bearerHeader = "bearer"
    this.requestPath = "/store/"
    this.req = req
    this.res = res
    this.s3 = s3
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
    // TODO: Start here. Requests failing here. Begin implementation of test.js with proper headers
    if (!this.req.headers.authentication.startsWith(this.bearerHeader)) {
      return false
    }
    // Otherwise return null
    return true
  }

  writeToS3 () {

      var s3parameters = {
        Bucket: `blockstack_user_${this.req.params.address}`,
        Key: this.req.params.filename,
        Body: this.req
      }

      this.s3.upload(s3parameters, (err, data) => {
        if (err) {
          return {err: err, data: null}
        }
        return {err: null, data: data}
      })
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

class S3Driver {

  constructor () {
    this.s3 = new S3()
  }

  handleStorageRequest (req, res) {
    var sr = new StorageRequest(req, res, this.s3)

    if (!sr.valid()) {
      sr.writeResponse({message: "Bad authentication header"}, null , 401)
      return
    }

    if (!sr.sigValid()) {
      sr.writeResponse(res, {message : "Authentication check failed"}, null , 401)
      return
    }

    var write = sr.writetoS3()

    if (write.err) {
      sr.writeResponse(write.err, null, 500)
      return
    } else {
      sr.writeResponse(null, write.data, 202)
      return
    }
  }

  handleOptions (req, res){
    // TODO
  }


}

module.exports = S3Driver
