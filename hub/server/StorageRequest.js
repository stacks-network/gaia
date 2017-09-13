var logging = require('winston')
var bitcoin = require('bitcoinjs-lib')
var StorageAuth = require('./StorageAuthentication')

class StorageRequest {

  constructor (req, res) {
    this.req = req
    this.res = res
  }

  valid () {
    let authObject = StorageAuth.fromAuthHeader(
      this.req.headers.authentication)
    if (!authObject) {
      return false
    }
    let address = this.req.params.address
    return authObject.isAuthenticationValid(address)
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
