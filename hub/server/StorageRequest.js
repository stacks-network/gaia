var bitcoin = require('bitcoinjs-lib')
var StorageAuth = require('./StorageAuthentication')

class StorageRequest {

  constructor (req, res, proofChecker, logger) {
    this.req = req
    this.res = res
    this.proofChecker = proofChecker
    this.logger = logger
  }

  callback (err, data) {
    if (err) {
      this.writeResponse(err, data, 500)
      return
    }
    this.writeResponse(err, data, 202)
  }

  writeResponse (error, data, statusCode) {
    // todo: for now, just responding in plaintext, but want
    //       to move to a json api
    this.res.writeHead(statusCode, {'Content-Type' : 'text/plain'})
    // todo: cors header
    if (error) {
      this.logger.error(error)
      this.res.write(JSON.stringify(error))
    } else {
      this.logger.info(data)
      this.res.write(JSON.stringify(data))
    }
    // End the response, this finshes the request and sends the response
    this.res.end()
  }

  valid () {
    let authObject = StorageAuth.fromAuthHeader(
      this.req.headers.authorization)
    if (!authObject) {
      return false
    }
    let address = this.req.params.address
    return authObject.isAuthenticationValid(address)
  }

  handle (driver) {
    if (!this.valid()) {
      this.writeResponse({message : "Authentication check failed"}, null , 403)
      return
    }
    let write = {
      storageToplevel: this.req.params.address,
      path: this.req.params.filename,
      stream: this.req,
      sr: this,
      contentLength: this.req.headers["content-length"]
    }
    this.proofChecker.checkProofs(this.req)
      .then( ( proofsValid ) => {
             if (proofsValid) {
               driver.performWrite(write)
             } else {
               this.writeResponse({message : "Social proofs invalid"}, null, 403)
             } } )
      .catch( (error) => {
        this.logger.error( error )
        this.writeResponse({message : "Server error"}, null, 500)
      })
  }
}

module.exports = StorageRequest
