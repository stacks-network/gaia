var logging = require('winston')
var S3 = require('aws-sdk/clients/s3')

class S3Driver {

  constructor (bucket, awsOptions) {
    this.s3 = new S3(awsOptions)
    this.bucket = bucket
  }

  static toplevel_names(address){
    return `user_${address}`
  }

  static isPathValid(path){
    // for now, only disallow double dots.
    return (! path.contains("..") )
  }

  performWrite (toplevel, path, stream, cb) {
    if (! isPathValid(path)){
      cb( {"message": "Invalid path"}, null, 402)
      return
    }
    let s3key = `{S3Driver.toplevel_names(toplevel)}/${path}`
    let s3params = {
      Bucket: this.bucket,
      Key: s3key,
      Body: stream
    }
    this.s3.upload(s3params, cb)
  }

}

module.exports = S3Driver
