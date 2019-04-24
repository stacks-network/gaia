

import * as azure from '@azure/storage-blob'
import { logger } from '../utils'
import { BadPathError, InvalidInputError, DoesNotExist, ConflictError } from '../errors'
import { ListFilesResult, PerformWriteArgs, PerformDeleteArgs } from '../driverModel'
import { DriverStatics, DriverModel, DriverModelTestMethods } from '../driverModel'

export interface AZ_CONFIG_TYPE {
  azCredentials: {
    accountName?: string,
    accountKey?: string
  },
  bucket: string,
  pageSize?: number,
  readURL?: string,
  cacheControl?: string
}

// The AzDriver utilized the azure nodejs sdk to write files to azure blob storage
class AzDriver implements DriverModel, DriverModelTestMethods {
  container: azure.ContainerURL
  accountName: string
  bucket: string
  pageSize: number
  readURL?: string
  cacheControl?: string
  initPromise: Promise<void>

  static getConfigInformation() {
    const envVars: any = {}
    const azCredentials: any = {}
    if (process.env['GAIA_AZURE_ACCOUNT_NAME']) {
      envVars['azCredentials'] = azCredentials
      azCredentials['accountName'] = process.env['GAIA_AZURE_ACCOUNT_NAME']
    }
    if (process.env['GAIA_AZURE_ACCOUNT_KEY']) {
      envVars['azCredentials'] = azCredentials
      azCredentials['accountKey'] = process.env['GAIA_AZURE_ACCOUNT_KEY']
    }
    return {
      defaults: {
        azCredentials: {
          accountName: <any>undefined,
          accountKey: <any>undefined
        }
      },
      envVars
    }
  }

  constructor(config: AZ_CONFIG_TYPE) {

    this.bucket = config.bucket
    this.pageSize = config.pageSize ? config.pageSize : 100
    this.accountName = config.azCredentials.accountName
    this.readURL = config.readURL
    this.cacheControl = config.cacheControl

    const sharedKeyCredential = new azure.SharedKeyCredential(
      config.azCredentials.accountName, config.azCredentials.accountKey)
    const pipeline = azure.StorageURL.newPipeline(sharedKeyCredential)
    const service = new azure.ServiceURL(this.getServiceUrl(), pipeline)
    this.container = azure.ContainerURL.fromServiceURL(service, this.bucket)

    this.initPromise = this.createContainerIfNotExists()
  }

  async createContainerIfNotExists() {
    // Check for container(bucket), create it if does not exist
    // Set permissions to 'blob' to allow public reads
    try {
      await this.container.create(azure.Aborter.none, { access: 'blob' })
      logger.info(`Create container ${this.bucket} successfully`)
    } catch (error) {
      if (error.body && error.body.Code === 'ContainerAlreadyExists') {
        logger.info('Container initialized.')
      } else {
        /* istanbul ignore next */
        logger.error(`Failed to create container: ${error}`)
        /* istanbul ignore next */
        throw error
      }
    }
  }

  async deleteEmptyBucket() {
    const prefix: any = undefined
    const files = await this.listFiles(prefix)
    if (files.entries.length > 0) {
      /* istanbul ignore next */
      throw new Error('Tried deleting non-empty bucket')
    }
    await this.container.delete(azure.Aborter.none)
  }

  ensureInitialized() {
    return this.initPromise
  }

  dispose() {
    return Promise.resolve()
  }

  static isPathValid(path: string) {
    // for now, only disallow double dots.
    return (path.indexOf('..') === -1)
  }

  getServiceUrl() {
    return `https://${this.accountName}.blob.core.windows.net`
  }

  getReadURLPrefix() {
    return `${this.getServiceUrl()}/${this.bucket}/`
  }

  async listBlobs(prefix: string, page?: string): Promise<ListFilesResult> {
    // page is the marker / continuationToken for Azure
    const blobs = await this.container.listBlobFlatSegment(
      azure.Aborter.none,
      page || undefined, {
        prefix: prefix,
        maxresults: this.pageSize
      }
    )
    const items = blobs.segment.blobItems
    const entries = items.map(e => e.name.slice(prefix.length + 1))
    return { entries, page: blobs.nextMarker || null }
  }

  async listFiles(prefix: string, page?: string) {
    try {
      return await this.listBlobs(prefix, page)
    } catch (error) {
      logger.debug(`Failed to list files: ${error}`)
      throw error
    }
  }

  async performWrite(args: PerformWriteArgs): Promise<string> {
    // cancel write and return 402 if path is invalid
    if (!AzDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid Path')
    }
    if (args.contentType && args.contentType.length > 1024) {
      throw new InvalidInputError('Invalid content-type')
    }
    // Prepend ${address}/ to filename
    const azBlob = `${args.storageTopLevel}/${args.path}`
    const blobURL = azure.BlobURL.fromContainerURL(this.container, azBlob)
    const blockBlobURL = azure.BlockBlobURL.fromBlobURL(blobURL)

    // 1MB max buffer block size
    const bufferSize = Math.min(1024 * 1024, args.contentLength)

    /** 
     * No parallelism since bottleneck would be in clients' http request
     * upload speed rather than the gaia server disk or network IO.
     * @see https://docs.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-nodejs-v10#upload-a-stream
    */
    const maxBuffers = 1

    try {
      await azure.uploadStreamToBlockBlob(
        azure.Aborter.none, args.stream,
        blockBlobURL, bufferSize, maxBuffers, {
          blobHTTPHeaders: {
            blobContentType: args.contentType,
            blobCacheControl: this.cacheControl || undefined
          }
        }
      )
    } catch (error) {
      logger.error(`failed to store ${azBlob} in ${this.bucket}: ${error}`)
      if (error.body && error.body.Code === 'InvalidBlockList') {
        throw new ConflictError('Likely failed due to concurrent PUTs to the same file')
      }
      throw new Error('Azure storage failure: failed to store' +
        ` ${azBlob} in container ${this.bucket}: ${error}`)
    }

    // Return success and url to user
    const readURL = this.getReadURLPrefix()
    const publicURL = `${readURL}${azBlob}`
    logger.debug(`Storing ${azBlob} in ${this.bucket}, URL: ${publicURL}`)
    return publicURL
  }

  async performDelete(args: PerformDeleteArgs): Promise<void> {
    // cancel write and return 402 if path is invalid
    if (!AzDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid Path')
    }
    const azBlob = `${args.storageTopLevel}/${args.path}`
    const blobURL = azure.BlobURL.fromContainerURL(this.container, azBlob)
    const blockBlobURL = azure.BlockBlobURL.fromBlobURL(blobURL)
    try {
      await blockBlobURL.delete(azure.Aborter.none)
    } catch (error) {
      if (error.statusCode === 404) {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      logger.error(`failed to delete ${azBlob} in ${this.bucket}: ${error}`)
      /* istanbul ignore next */
      throw new Error('Azure storage failure: failed to delete' +
        ` ${azBlob} in container ${this.bucket}: ${error}`)
    }
  }
}

const driver: typeof AzDriver & DriverStatics = AzDriver
export default driver
