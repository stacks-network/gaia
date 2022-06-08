import { Storage, File } from '@google-cloud/storage'

import { BadPathError, InvalidInputError, DoesNotExist } from '../errors'
import { 
  ListFilesResult, PerformWriteArgs, WriteResult, PerformDeleteArgs, PerformRenameArgs,
  StatResult, PerformStatArgs, PerformReadArgs, ReadResult, PerformListFilesArgs,
  ListFilesStatResult, ListFileStatResult, DriverStatics, DriverModel, DriverModelTestMethods 
} from '../driverModel'
import { pipelineAsync, logger, dateToUnixTimeSeconds } from '../utils'

export interface GC_CONFIG_TYPE {
  gcCredentials?: {
    email?: string,
    projectId?: string,
    keyFilename?: string,
    credentials?: {
      client_email?: string,
      private_key?: string
    }
  },
  cacheControl?: string,
  pageSize?: number,
  bucket: string,
  resumable?: boolean
}

class GcDriver implements DriverModel, DriverModelTestMethods {
  bucket: string
  storage: Storage
  pageSize: number
  cacheControl?: string
  initPromise: Promise<void>
  resumable: boolean

  supportsETagMatching = false

  static getConfigInformation() {
    const envVars: any = {}
    const gcCredentials: any = {}
    if (process.env['GAIA_GCP_EMAIL']) {
      gcCredentials['email'] = process.env['GAIA_GCP_EMAIL']
      envVars['gcCredentials'] = gcCredentials
    }
    if (process.env['GAIA_GCP_PROJECT_ID']) {
      gcCredentials['projectId'] = process.env['GAIA_GCP_PROJECT_ID']
      envVars['gcCredentials'] = gcCredentials
    }
    if (process.env['GAIA_GCP_KEY_FILENAME']) {
      gcCredentials['keyFilename'] = process.env['GAIA_GCP_KEY_FILENAME']
      envVars['gcCredentials'] = gcCredentials
    }
    if (process.env['GAIA_GCP_CLIENT_EMAIL']) {
      gcCredentials['credentials'] = {}
      gcCredentials['credentials']['client_email'] = process.env['GAIA_GCP_CLIENT_EMAIL']
      if (process.env['GAIA_GCP_CLIENT_PRIVATE_KEY']) {
        gcCredentials['credentials']['private_key'] = process.env['GAIA_GCP_CLIENT_PRIVATE_KEY']
      }
      envVars['gcCredentials'] = gcCredentials
    }

    return {
      defaults: { gcCredentials: {} },
      envVars
    }
  }


  constructor (config: GC_CONFIG_TYPE) {
    this.storage =  new Storage(config.gcCredentials)
    this.bucket = config.bucket
    this.pageSize = config.pageSize ? config.pageSize : 100
    this.cacheControl = config.cacheControl
    this.initPromise = this.createIfNeeded()
    this.resumable = config.resumable || false
  }

  ensureInitialized() {
    return this.initPromise
  }

  dispose() {
    return Promise.resolve()
  }

  static isPathValid(path: string){
    // for now, only disallow double dots.
    return !path.includes('..')
  }

  getReadURLPrefix () {
    return `https://storage.googleapis.com/${this.bucket}/`
  }

  async createIfNeeded() {
    try {
      const bucket = this.storage.bucket(this.bucket)
      const [ exists ] = await bucket.exists()
      if (!exists) {
        try {
          await this.storage.createBucket(this.bucket)
          logger.info(`initialized google cloud storage bucket: ${this.bucket}`)
        } catch (err) {
          logger.error(`failed to initialize google cloud storage bucket: ${err}`)
          throw err
        }
      }
    } catch (err) {
      logger.error(`failed to connect to google cloud storage bucket: ${err}`)
      throw err
    }
  }

  async deleteEmptyBucket() {
    const files = await this.listFiles({pathPrefix: ''})
    if (files.entries.length > 0) {
      /* istanbul ignore next */
      throw new Error('Tried deleting non-empty bucket')
    }
    await this.storage.bucket(this.bucket).delete()
  }

  async listAllObjects(prefix: string, page?: string, pageSize?: number) {
    // returns {'entries': [...], 'page': next_page}
    const opts: { prefix: string, maxResults: number, pageToken?: string } = {
      prefix: prefix,
      maxResults: pageSize || this.pageSize,
      pageToken: page || undefined
    }

    const getFilesResult = await new Promise<{files: File[], nextQuery: any}>((resolve, reject) => {
      this.storage
        .bucket(this.bucket)
        .getFiles(opts, (err, files, nextQuery) => {
          if (err) {
            reject(err)
          } else {
            resolve({files, nextQuery})
          }
        })
    })
    const fileEntries = getFilesResult.files.map(file => {
      return {
        name: file.name.slice(prefix.length + 1),
        file: file
      }
    })
    const result = {
      entries: fileEntries,
      page: (getFilesResult.nextQuery && getFilesResult.nextQuery.pageToken) || null
    }
    return result
  }

  async listFiles(args: PerformListFilesArgs): Promise<ListFilesResult> {
    // returns {'entries': [...], 'page': next_page}
    const listResult = await this.listAllObjects(args.pathPrefix, args.page)
    const result: ListFilesResult = {
      page: listResult.page,
      entries: listResult.entries.map(file => file.name)
    }
    return result
  }

  async listFilesStat(args: PerformListFilesArgs): Promise<ListFilesStatResult> {
    const listResult = await this.listAllObjects(args.pathPrefix, args.page, args.pageSize)
    const result: ListFilesStatResult = {
      page: listResult.page,
      entries: listResult.entries.map(entry => {
        const statResult = GcDriver.parseFileMetadataStat(entry.file.metadata)
        const entryResult: ListFileStatResult = {
          ...statResult,
          name: entry.name,
          exists: true
        }
        return entryResult
      })
    }
    return result
  }

  async performWrite(args: PerformWriteArgs): Promise<WriteResult> {
    if (!GcDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid Path')
    }
    if (args.contentType && args.contentType.length > 1024) {
      throw new InvalidInputError('Invalid content-type')
    }
    const filename = `${args.storageTopLevel}/${args.path}`
    const publicURL = `${this.getReadURLPrefix()}${filename}`

    const metadata: any = {}
    metadata.contentType = args.contentType
    if (this.cacheControl) {
      metadata.cacheControl = this.cacheControl
    }

    const fileDestination = this.storage
      .bucket(this.bucket)
      .file(filename)

    /*  > There is some overhead when using a resumable upload that can cause
        > noticeable performance degradation while uploading a series of small 
        > files. When uploading files less than 10MB, it is recommended that 
        > the resumable feature is disabled." 
       For details see https://github.com/googleapis/nodejs-storage/issues/312 */

    const fileWriteStream = fileDestination.createWriteStream({
      public: true,
      resumable: this.resumable,
      metadata
    })

    try {
      await pipelineAsync(args.stream, fileWriteStream)
      logger.debug(`storing ${filename} in bucket ${this.bucket}`)
      const etag = GcDriver.formatETagFromMD5(fileDestination.metadata.md5Hash)
      return { publicURL, etag }
    } catch (error) {
      logger.error(`failed to store ${filename} in bucket ${this.bucket}`)
      throw new Error('Google cloud storage failure: failed to store' +
        ` ${filename} in bucket ${this.bucket}: ${error}`)
    }
  }

  async performDelete(args: PerformDeleteArgs): Promise<void> {
    if (!GcDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid Path')
    }
    const filename = `${args.storageTopLevel}/${args.path}`
    const bucketFile = this.storage
      .bucket(this.bucket)
      .file(filename)

    try {
      await bucketFile.delete()
    } catch (error) {
      if (error.code === 404) {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      logger.error(`failed to delete ${filename} in bucket ${this.bucket}`)
      /* istanbul ignore next */
      throw new Error('Google cloud storage failure: failed to delete' +
        ` ${filename} in bucket ${this.bucket}: ${error}`)
    }
  }

  static formatETagFromMD5(md5Hash: string): string {
    const hex = Buffer.from(md5Hash, 'base64').toString('hex')
    const formatted = `"${hex}"`
    return formatted
  }

  static parseFileMetadataStat(metadata: any): StatResult {
    const lastModified = dateToUnixTimeSeconds(new Date(metadata.updated))
    const result: StatResult = {
      exists: true,
      etag: this.formatETagFromMD5(metadata.md5Hash),
      contentType: metadata.contentType,
      contentLength: parseInt(metadata.size),
      lastModifiedDate: lastModified
    }
    return result
  }

  async performRead(args: PerformReadArgs): Promise<ReadResult> {
    if (!GcDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid Path')
    }
    const filename = `${args.storageTopLevel}/${args.path}`
    const bucketFile = this.storage
      .bucket(this.bucket)
      .file(filename)
    try {
      const [getResult] = await bucketFile.get({autoCreate: false})
      const statResult = GcDriver.parseFileMetadataStat(getResult.metadata)
      const dataStream = getResult.createReadStream()
      const result: ReadResult = {
        ...statResult,
        exists: true,
        data: dataStream
      }
      return result
    } catch (error) {
      if (error.code === 404) {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      logger.error(`failed to read ${filename} in bucket ${this.bucket}`)
      /* istanbul ignore next */
      throw new Error('Google cloud storage failure: failed to read' +
        ` ${filename} in bucket ${this.bucket}: ${error}`)
    }
  }

  async performStat(args: PerformStatArgs): Promise<StatResult> {
    if (!GcDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid Path')
    }
    const filename = `${args.storageTopLevel}/${args.path}`
    const bucketFile = this.storage
      .bucket(this.bucket)
      .file(filename)
    try {
      const [metadataResult] = await bucketFile.getMetadata()
      const result = GcDriver.parseFileMetadataStat(metadataResult)
      return result
    } catch (error) {
      if (error.code === 404) {
        const result = {
          exists: false
        } as StatResult
        return result
      }
      /* istanbul ignore next */
      logger.error(`failed to stat ${filename} in bucket ${this.bucket}`)
      /* istanbul ignore next */
      throw new Error('Google cloud storage failure: failed to stat ' +
        ` ${filename} in bucket ${this.bucket}: ${error}`)
    }
  }

  async performRename(args: PerformRenameArgs): Promise<void> {
    if (!GcDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid original path')
    }
    if (!GcDriver.isPathValid(args.newPath)) {
      throw new BadPathError('Invalid new path')
    }

    const filename = `${args.storageTopLevel}/${args.path}`
    const bucketFile = this.storage
      .bucket(this.bucket)
      .file(filename)

    const newFilename = `${args.storageTopLevel}/${args.newPath}`
    const newBucketFile = this.storage
      .bucket(this.bucket)
      .file(newFilename)

    try {
      await bucketFile.move(newBucketFile)
    } catch (error) {
      if (error.code === 404) {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      logger.error(`failed to rename ${filename} to ${newFilename} in bucket ${this.bucket}`)
      /* istanbul ignore next */
      throw new Error('Google cloud storage failure: failed to rename' +
        ` ${filename} to ${newFilename} in bucket ${this.bucket}: ${error}`)
    }
  }
}

const driver: typeof GcDriver & DriverStatics = GcDriver
export default driver
