import { Storage, File } from '@google-cloud/storage'

import { BadPathError, InvalidInputError, DoesNotExist } from '../errors'
import { ListFilesResult, PerformWriteArgs, PerformDeleteArgs } from '../driverModel'
import { DriverStatics, DriverModel, DriverModelTestMethods } from '../driverModel'
import { pipeline, logger } from '../utils'

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
    return (path.indexOf('..') === -1)
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
    const files = await this.listFiles('')
    if (files.entries.length > 0) {
      /* istanbul ignore next */
      throw new Error('Tried deleting non-empty bucket')
    }
    await this.storage.bucket(this.bucket).delete()
  }

  async listAllObjects(prefix: string, page?: string) {
    // returns {'entries': [...], 'page': next_page}
    const opts: { prefix: string, maxResults: number, pageToken?: string } = {
      prefix: prefix,
      maxResults: this.pageSize,
      pageToken: page || undefined
    }

    const result: any = await new Promise((resolve, reject) => {
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

    const files: File[] = result.files
    const nextQuery: any = result.nextQuery

    const fileNames = files.map(file => file.name.slice(prefix.length + 1))
    const ret: ListFilesResult = {
      entries: fileNames,
      page: (nextQuery && nextQuery.pageToken) || null
    }
    return ret
  }

  listFiles(prefix: string, page?: string) {
    // returns {'entries': [...], 'page': next_page}
    return this.listAllObjects(prefix, page)
  }

  async performWrite(args: PerformWriteArgs): Promise<string> {
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

    /* Note: Current latest version of google-cloud/storage@2.4.2 implements
       something that keeps a socket retry pool or something similar open for 
       several minutes in the event of a stream pipe failure. Only happens 
       when `resumable` is disabled. We enable `resumable` in unit tests so
       they complete on time, but want `resumable` disabled in production uses:
        > There is some overhead when using a resumable upload that can cause
        > noticeable performance degradation while uploading a series of small 
        > files. When uploading files less than 10MB, it is recommended that 
        > the resumable feature is disabled." 
       For details see https://github.com/googleapis/nodejs-storage/issues/312
    */

    const fileWriteStream = fileDestination.createWriteStream({
      public: true,
      resumable: this.resumable,
      metadata
    })

    try {
      await pipeline(args.stream, fileWriteStream)
      logger.debug(`storing ${filename} in bucket ${this.bucket}`)
    } catch (error) {
      logger.error(`failed to store ${filename} in bucket ${this.bucket}`)
      throw new Error('Google cloud storage failure: failed to store' +
        ` ${filename} in bucket ${this.bucket}: ${error}`)
    }

    return publicURL
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
  
}

const driver: typeof GcDriver & DriverStatics = GcDriver
export default driver
