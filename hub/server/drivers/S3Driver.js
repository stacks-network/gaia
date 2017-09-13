let S3 = require('aws-sdk/clients/s3')

class S3Driver {

  constructor (config) {
    this.s3 = new S3(config.awsOptions)
    this.bucket = config.bucket
    this.logger = config.logger

    let params = {
      Bucket: config.bucket,
      ACL: "public-read",
    };

    this.s3.createBucket(params, function(error, data) {
      if (error) {
        config.logger.error(`failed to initialize s3 bucket: ${err}`)
        process.exit()
      }
      config.logger.info(`bucket initialized: ${data}`)
    });
  }

  static toplevel_names(address){
    return `user_${address}`
  }

  static isPathValid(path){
    // for now, only disallow double dots.
    return (path.indexOf("..") === -1)
  }

  performWrite (args) {

    let s3key = `${S3Driver.toplevel_names(args.storageToplevel)}/${args.path}`
    let s3params = {
      Bucket: this.bucket,
      Key: s3key,
      Body: args.stream,
      ACL: "public-read"
    }

    if (!S3Driver.isPathValid(args.path)){
      this.logger.error(`failed to store ${s3key} in bucket ${this.bucket}, invalid path`)
      args.sr.callback( {"message": "Invalid path"}, null, 402)
      return
    }

    // Upload stream to s3
    this.s3.upload(s3params, (err, data) => {
      if (err) {
        this.logger.error(`failed to store ${s3key} in bucket ${this.bucket}`)
        args.sr.callback(err, data, 500)
        return
      }
      let publicURL = data.Location
      this.logger.info(`storing ${s3key} in bucket ${this.bucket}`)
      args.sr.callback(err, { publicURL }, 202)
    })
  }

}

module.exports = S3Driver
