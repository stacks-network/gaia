var logging = require('winston')
var S3 = require('aws-sdk/clients/s3')
var StorageRequest = require('./StorageRequest.js')

class S3Driver {

  constructor () {
    this.s3 = new S3()
  }

  handleStorageRequest (req, res) {
    var sr = new StorageRequest(req, res)

    if (!sr.valid()) {
      sr.writeResponse(res, {message : "Authentication check failed"}, null , 401)
      return
    }

    // If the request is valid then write it to s3
    this.s3.upload(sr.s3Write(), (err, data) => {
      if (err) {
        sr.writeResponse(err, null, 500)
        return
      }
      sr.writeResponse(null, data, 202)
      return
    })
  }

  handleOptions (req, res){
    // TODO
  }

}

module.exports = S3Driver
