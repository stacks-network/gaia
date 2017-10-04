var bitcoin = require('bitcoinjs-lib')
var StorageAuth = require('./StorageAuthentication')

class StorageRequest {

  constructor (req, res, config) {
    this.req = req
    this.res = res
    this.logger = config.logger
    this.whitelist = config.whitelist
  }

  callback (err, data) {
    if (err) {
      this.writeResponse(err, data, 500)
      return
    }
    this.writeResponse(err, data, 202)
  }

  writeResponse (error, data, statusCode) {
    this.res.writeHead(statusCode, {'Content-Type' : 'application/json'})
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
    if (this.whitelist && !(this.req.params.address in this.whitelist)) {
      return this.writeResponse({ message: "Address not authorized for writes" },
                                null, 401)
    }
    if (!this.valid()) {
      return this.writeResponse({message : "Authentication check failed"}, null , 401)
    }
    let write = {
      storageToplevel: this.req.params.address,
      path: this.req.params.filename,
      stream: this.req,
      sr: this,
      contentLength: this.req.headers["content-length"]
    }

    driver.performWrite(write)

  }

}

module.exports = StorageRequest
