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

  handle (driver) {
    if (!this.valid()) {
      this.writeResponse(res, {message : "Authentication check failed"}, null , 401)
      return
    }

    let storage_toplevel = this.req.params.address
    let path = this.req.params.filename
    let stream = this.req

    driver.initializeIfNeeded(storage_toplevel)
    driver.performWrite(storage_toplevel, path, stream, (err, data) => {
      let statusCode = 202
      if (err) {
        statusCode = 500
      }
      this.writeResponse(err, data, statusCode)
    })

  }

  writeResponse (error, data, statusCode) {
    // todo: for now, just responding in plaintext, but want
    //       to move to a json api
    this.res.writeHead(statusCode, {'Content-Type' : 'text/plain'})
    // todo: cors headers
    if (error) {
      logging.error(error)
      this.res.write(JSON.stringify(error))
    } else {
      this.res.write(JSON.stringify(data))
    }
    // End the response, this finshes the request and sends the response
    this.res.end()
  }
}

module.exports = StorageRequest
