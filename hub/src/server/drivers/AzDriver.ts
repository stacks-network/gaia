

import * as azure from '@azure/storage-blob'
import { logger, dateToUnixTimeSeconds } from '../utils'
import { BadPathError, InvalidInputError, DoesNotExist, ConflictError, PreconditionFailedError } from '../errors'
import { 
  PerformWriteArgs, WriteResult, PerformDeleteArgs, PerformRenameArgs, PerformStatArgs,
  StatResult, PerformReadArgs, ReadResult, PerformListFilesArgs, ListFilesStatResult,
  ListFileStatResult, DriverStatics, DriverModel, DriverModelTestMethods
} from '../driverModel'
import { Readable } from 'stream'
import { BlobGetPropertiesHeaders, BlobProperties } from '@azure/storage-blob/typings/src/generated/src/models'

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

  supportsETagMatching = true

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
          accountName: undefined as any,
          accountKey: undefined as any
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
    const files = await this.listFiles({pathPrefix: undefined as string})
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
    return !path.includes('..')
  }

  getServiceUrl() {
    return `https://${this.accountName}.blob.core.windows.net`
  }

  getReadURLPrefix() {
    return `${this.getServiceUrl()}/${this.bucket}/`
  }

  async listBlobs(prefix: string, page?: string, pageSize?: number): Promise<ListFilesStatResult> {
    // page is the marker / continuationToken for Azure
    const blobs = await this.container.listBlobFlatSegment(
      azure.Aborter.none,
      page || undefined, {
        prefix: prefix,
        maxresults: pageSize || this.pageSize
      }
    )
    const items = blobs.segment.blobItems
    const entries: ListFileStatResult[] = items.map(e => {
      const fileStat = AzDriver.parseFileStat(e.properties)
      const result: ListFileStatResult = {
        ...fileStat,
        exists: true,
        name: e.name.slice(prefix.length + 1)
      }
      return result
    })
    return { entries, page: blobs.nextMarker || null }
  }

  async listFiles(args: PerformListFilesArgs) {
    try {
      const files = await this.listBlobs(args.pathPrefix, args.page, args.pageSize)
      return { 
        entries: files.entries.map(f => f.name),
        page: files.page
      }
    } catch (error) {
      logger.debug(`Failed to list files: ${error}`)
      throw error
    }
  }

  async listFilesStat(args: PerformListFilesArgs): Promise<ListFilesStatResult> {
    try {
      return await this.listBlobs(args.pathPrefix, args.page, args.pageSize)
    } catch (error) {
      logger.debug(`Failed to list files: ${error}`)
      throw error
    }
  }

  async performWrite(args: PerformWriteArgs): Promise<WriteResult> {
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
    const defaultBufferSize = 1024 * 1024
    const bufferSize = Math.min(defaultBufferSize, args.contentLength) || defaultBufferSize

    /** 
     * No parallelism since bottleneck would be in clients' http request
     * upload speed rather than the gaia server disk or network IO.
     * @see https://docs.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-nodejs-v10#upload-a-stream
    */
    const maxBuffers = 1

    const options: azure.IUploadStreamToBlockBlobOptions = {
      blobHTTPHeaders: {
        blobContentType: args.contentType,
        blobCacheControl: this.cacheControl || undefined
      },
      accessConditions: {
        modifiedAccessConditions: {
          ifMatch: args.ifMatch,
          ifNoneMatch: args.ifNoneMatch
        }
      }
    }

    try {
      const uploadResult = await azure.uploadStreamToBlockBlob(
        azure.Aborter.none, args.stream, blockBlobURL, bufferSize, maxBuffers, options
      )

      // Return success and url to user
      const readURL = this.getReadURLPrefix()
      const publicURL = `${readURL}${azBlob}`
      logger.debug(`Storing ${azBlob} in ${this.bucket}, URL: ${publicURL}`)
      return {
        publicURL,
        etag: uploadResult.eTag.replace(/^"|"$/g, '')
      }
    } catch (error) {
      logger.error(`failed to store ${azBlob} in ${this.bucket}: ${error}`)
      if (error.body && error.body.Code === 'ConditionNotMet') {
        throw new PreconditionFailedError('The provided ETag does not match that of the resource on the server')
      }
      if (error.body && error.body.Code === 'BlobAlreadyExists') {
        throw new PreconditionFailedError('The entity you are trying to create already exists')
      }
      if (error.body && error.body.Code === 'InvalidBlockList') {
        throw new ConflictError('Likely failed due to concurrent PUTs to the same file')
      }
      throw new Error('Azure storage failure: failed to store' +
        ` ${azBlob} in container ${this.bucket}: ${error}`)
    }
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
  
  async performRead(args: PerformReadArgs): Promise<ReadResult> {
    if (!AzDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid Path')
    }
    const azBlob = `${args.storageTopLevel}/${args.path}`
    const blobURL = azure.BlobURL.fromContainerURL(this.container, azBlob)
    const blockBlobURL = azure.BlockBlobURL.fromBlobURL(blobURL)

    try {
      const offset = 0
      const downloadResult = await blockBlobURL.download(azure.Aborter.none, offset)
      const dataStream = downloadResult.readableStreamBody as Readable
      const fileStat = AzDriver.parseFileStat(downloadResult)
      const result: ReadResult = {
        ...fileStat,
        exists: true,
        data: dataStream
      }
      return result
    } catch (error) {
      if (error.statusCode === 404) {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      logger.error(`failed to read ${azBlob} in ${this.bucket}: ${error}`)
      /* istanbul ignore next */
      throw new Error('Azure storage failure: failed to read' +
        ` ${azBlob} in container ${this.bucket}: ${error}`)
    }
  }

  static parseFileStat(properties: BlobGetPropertiesHeaders | BlobProperties) {
    let lastModified: number | undefined
    if (properties.lastModified) {
      lastModified = dateToUnixTimeSeconds(properties.lastModified)
    }
    let etag = (properties as BlobProperties).etag || (properties as BlobGetPropertiesHeaders).eTag
    etag = etag.replace(/^"|"$/g, '')
    const result: StatResult = {
      exists: true,
      etag,
      contentLength: properties.contentLength,
      contentType: properties.contentType,
      lastModifiedDate: lastModified
    }
    return result
  }

  async performStat(args: PerformStatArgs): Promise<StatResult> {
    if (!AzDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid Path')
    }
    const azBlob = `${args.storageTopLevel}/${args.path}`
    const blobURL = azure.BlobURL.fromContainerURL(this.container, azBlob)
    const blockBlobURL = azure.BlockBlobURL.fromBlobURL(blobURL)
    try {
      const propertiesResult = await blockBlobURL.getProperties(azure.Aborter.none)
      const result = AzDriver.parseFileStat(propertiesResult)
      return result
    } catch (error) {
      if (error.statusCode === 404) {
        const result = {
          exists: false
        } as StatResult
        return result
      }
      /* istanbul ignore next */
      logger.error(`failed to stat ${azBlob} in ${this.bucket}: ${error}`)
      /* istanbul ignore next */
      throw new Error('Azure storage failure: failed to stat' +
        ` ${azBlob} in container ${this.bucket}: ${error}`)
    }
  }

  async performRename(args: PerformRenameArgs): Promise<void> {
    if (!AzDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid original path')
    }
    if (!AzDriver.isPathValid(args.newPath)) {
      throw new BadPathError('Invalid new path')
    }

    const origAzBlob = `${args.storageTopLevel}/${args.path}`
    const origBlobUrl = azure.BlobURL.fromContainerURL(this.container, origAzBlob)
    const origBlockBlobURL = azure.BlockBlobURL.fromBlobURL(origBlobUrl)

    const newAzBlob = `${args.storageTopLevel}/${args.newPath}`
    const newBlobURL = azure.BlobURL.fromContainerURL(this.container, newAzBlob)
    const newBlockBlobURL = azure.BlockBlobURL.fromBlobURL(newBlobURL)

    try {
      const copyResult = await newBlockBlobURL.startCopyFromURL(azure.Aborter.none, origBlockBlobURL.url)
      if (copyResult.copyStatus !== 'success') {
        throw new Error(`Expected copy status to be success, got ${copyResult.copyStatus}`)
      }
      await origBlockBlobURL.delete(azure.Aborter.none)
    } catch (error) {
      if (error.statusCode === 404) {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      logger.error(`failed to rename ${origAzBlob} to ${newAzBlob} in ${this.bucket}: ${error}`)
      /* istanbul ignore next */
      throw new Error('Azure storage failure: failed to rename' +
        ` ${origAzBlob} to ${newAzBlob} in container ${this.bucket}: ${error}`)
    }
  }
}

const driver: typeof AzDriver & DriverStatics = AzDriver
export default driver
