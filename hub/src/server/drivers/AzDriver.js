const azure = require('azure-storage')
const logger = require('winston')

// The AzDriver utilized the azure nodejs sdk to write files to azure blob storage
class AzDriver {

  constructor (config) {
    this.blobService = azure.createBlobService(config.azCredentials.accountName,config.azCredentials.accountKey)
    this.bucket = config.bucket
    this.accountName = config.azCredentials.accountName
    this.readURL = config.readURL
    this.cacheControl = config.cacheControl

    // Check for container(bucket), create it if does not exist
    // Set permissions to 'blob' to allow public reads
    this.blobService.createContainerIfNotExists(
      config.bucket, { publicAccessLevel: 'blob' },
      (error, result, response) => {
        if (error) {
          logger.error(`failed to initialize azure container: ${error}`)
          process.exit()
        }
        logger.info(`container initialized: ${result}`)
      })
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
    if (! AzDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid Path')
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

    return new Promise((resolve, reject) => {
      this.blobService.createBlockBlobFromStream(
        this.bucket, azBlob, args.stream, args.contentLength, azOpts,
        (error, result, response) => {
          // log error, reject promise.
          if (error) {
            logger.error(`failed to store ${azBlob} in container ${this.bucket}: ${error}`)
            return reject(new Error('Azure storage failure: failed failed to store' +
                                    ` ${azBlob} in container ${this.bucket}: ${error}`))
          }

          // Return success and url to user
          const readURL = this.getReadURLPrefix()
          const publicURL = `${readURL}${azBlob}`
          logger.debug(`Storing ${azBlob} in container ${this.bucket}, URL: ${publicURL}`)
          resolve(publicURL)
        })
    })
  }
}

module.exports = AzDriver
