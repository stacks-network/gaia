var logging = require('winston')
var S3 = require('aws-sdk/clients/s3')

class S3Driver {

  constructor () {
    this.S3 = new S3()
  }

  static address_to_bucket(address){
    return `blockstack_user_${address}`
  }

  initializeIfNeeded (toplevel) {
    // TODO
  }

  performWrite (toplevel, path, stream, cb) {
    let s3params = {
      Bucket: S3Driver.address_to_bucket(toplevel),
      Key: path,
      Body: stream
    }
    this.S3.upload(s3params, cb)
  }

}

module.exports = S3Driver
