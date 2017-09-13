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
    return (path.indexOf("..") === -1)
  }

  performWrite (toplevel, path, stream, cb) {
    if (! S3Driver.isPathValid(path)){
      cb( {"message": "Invalid path"}, null, 402)
      return
    }
    let s3key = `${S3Driver.toplevel_names(toplevel)}/${path}`
    let s3params = {
      Bucket: this.bucket,
      Key: s3key,
      Body: stream,
      ACL: "public-read"
    }
    this.s3.upload(s3params, (err, data) => {
      if (err){
        cb(err, data)
      }else{
        let publicURL = data.Location
        cb(err, { publicURL : publicURL })
      }
    })
  }

}

module.exports = S3Driver
