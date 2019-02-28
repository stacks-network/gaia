/* @flow */

import * as azure from '@azure/storage-blob'
import logger from 'winston'
import { BadPathError } from '../errors'
import type { ListFilesResult } from '../driverModel'
import { DriverStatics, DriverModel } from '../driverModel'
import { Readable } from 'stream'

type AZ_CONFIG_TYPE = {
  azCredentials: {
    accountName: string,
    accountKey: string
  },
  bucket: string,
  pageSize?: number,
  readURL?: string,
  cacheControl?: string
}

// The AzDriver utilized the azure nodejs sdk to write files to azure blob storage
class AzDriver implements DriverModel {
  container: azure.ContainerURL
  accountName: string
  bucket: string
  pageSize: number
  readURL: ?string
  cacheControl: ?string
  initPromise: Promise<void>

  static getConfigInformation() {
    const envVars = {}
    const azCredentials = {}
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
          accountName: undefined,
          accountKey: undefined
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
      const createContainerResponse = await this.container.create(
        azure.Aborter.none, { access: 'blob' })
      logger.info(`Create container ${this.bucket} successfully: ${createContainerResponse}`)
    } catch (error) {
      if (error.body && error.body.Code === 'ContainerAlreadyExists') {
        logger.info('Container initialized.')
      } else {
        logger.error(`Failed to create container: ${error}`)
        throw error
      }
    }
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

  async listBlobs(prefix: string, page: ?string): Promise<ListFilesResult> {
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

  async listFiles(prefix: string, page: ?string) {
    try {
      return await this.listBlobs(prefix, page)
    } catch (error) {
      logger.debug(`Failed to list files: ${error}`)
      throw error
    }
  }

  async performWrite(args: {
    path: string,
    storageTopLevel: string,
    stream: Readable,
    contentLength: number,
    contentType: string
  }): Promise<string> {
    // cancel write and return 402 if path is invalid
    if (!AzDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid Path')
    }

    // Prepend ${address}/ to filename
    const azBlob = `${args.storageTopLevel}/${args.path}`
    const blobURL = azure.BlobURL.fromContainerURL(this.container, azBlob)
    const blockBlobURL = azure.BlockBlobURL.fromBlobURL(blobURL)

    // 1MB max buffer block size
    const bufferSize = Math.min(1024 * 1024, args.contentLength)
    // No parallelism since bottleneck be in clients' http request upload speed
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
      throw new Error('Azure storage failure: failed failed to store' +
        ` ${azBlob} in container ${this.bucket}: ${error}`)
    }

    // Return success and url to user
    const readURL = this.getReadURLPrefix()
    const publicURL = `${readURL}${azBlob}`
    logger.debug(`Storing ${azBlob} in ${this.bucket}, URL: ${publicURL}`)
    return publicURL
  }
}

(AzDriver: DriverStatics)

export default AzDriver
