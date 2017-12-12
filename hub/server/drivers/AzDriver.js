let azure = require('azure-storage');

// The AzDriver utilized the azure nodejs sdk to write files to azure blob storage
class AzDriver {

  constructor (config) {
    this.blobService = azure.createBlobService(config.azCredentials.accountName,config.azCredentials.accountKey)
    this.bucket = config.bucket
    this.logger = config.logger
    this.accountName = config.azCredentials.accountName
    this.readURL = config.readURL
    this.cacheControl = config.cacheControl

    // Check for container(bucket), create it if does not exist
    // Set permissions to 'blob' to allow public reads
    this.blobService.createContainerIfNotExists(config.bucket, { publicAccessLevel: 'blob' }, (error, result, response) => {
      if (error) {
        config.logger.error(`failed to initialize azure container: ${error}`)
        process.exit()
      }
      config.logger.info(`container initialized: ${result}`)
    });
  }

  static isPathValid (path) {
    // for now, only disallow double dots.
    return (path.indexOf("..") === -1)
  }

  getReadURLPrefix () {
    if (this.readURL) {
      return `https://${this.readURL}/${this.bucket}/`
    }
    return `https://${this.accountName}.blob.core.windows.net/${this.bucket}/`
  }

  performWrite (args) {
    // cancel write and return 402 if path is invalid
    if (! AzDriver.isPathValid(args.path)){
      args.sr.callback({"message": "Invalid path"}, null, 402)
      return
    }

    // Prepend ${address}/ to filename
    let azBlob = `${args.storageToplevel}/${args.path}`
    let azOpts = {}

    if (this.cacheControl) {
      azOpts.contentSettings = { 'cacheControl' : this.cacheControl }
    } else {
      azOpts.contentSettings = {}
    }

    azOpts.contentSettings.contentType = args.contentType

    this.blobService.createBlockBlobFromStream(this.bucket, azBlob, (args.stream), args.contentLength, azOpts, (error, result, response) => {

      // return error to user, and log on error
      if (error) {
        this.logger.error(`failed to store ${azBlob} in container ${this.bucket}: ${error}`)
        args.sr.callback(error, response, 500)
        return
      }

      // Return success and url to user
      let readURL = this.getReadURLPrefix()
      let publicURL = `${readURL}${azBlob}`
      this.logger.info(`storing ${azBlob} in container ${this.bucket}, URL: ${publicURL}`)
      args.sr.callback(error, { publicURL }, 202)
    });
  }

}

module.exports = AzDriver
