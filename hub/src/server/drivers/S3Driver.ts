import * as S3 from 'aws-sdk/clients/s3'

import { BadPathError, InvalidInputError, DoesNotExist } from '../errors'
import { 
  ListFilesResult, PerformWriteArgs, WriteResult, PerformDeleteArgs, PerformRenameArgs,
  PerformStatArgs, StatResult, PerformReadArgs, ReadResult, PerformListFilesArgs,
  ListFilesStatResult, ListFileStatResult, DriverStatics, DriverModel, DriverModelTestMethods 
} from '../driverModel'
import { timeout, logger, dateToUnixTimeSeconds } from '../utils'

export interface S3_CONFIG_TYPE {
  awsCredentials: {
    accessKeyId?: string,
    secretAccessKey?: string,
    sessionToken?: string,
    endpoint?: string
  },
  pageSize?: number,
  cacheControl?: string,
  bucket: string
}

class S3Driver implements DriverModel, DriverModelTestMethods {
  s3: S3
  endpoint: string
  bucket: string
  pageSize: number
  cacheControl?: string
  initPromise: Promise<void>

  supportsETagMatching = false

  static getConfigInformation() {
    const envVars: any = {}
    const awsCredentials: any = {}
    if (process.env['GAIA_S3_ACCESS_KEY_ID']) {
      awsCredentials['accessKeyId'] = process.env['GAIA_S3_ACCESS_KEY_ID']
      envVars['awsCredentials'] = awsCredentials
    }
    if (process.env['GAIA_S3_SECRET_ACCESS_KEY']) {
      awsCredentials['secretAccessKey'] = process.env['GAIA_S3_SECRET_ACCESS_KEY']
      envVars['awsCredentials'] = awsCredentials
    }
    if (process.env['GAIA_S3_SESSION_TOKEN']) {
      awsCredentials['sessionToken'] = process.env['GAIA_S3_SESSION_TOKEN']
      envVars['awsCredentials'] = awsCredentials
    }

    return {
      defaults: { awsCredentials: undefined as any },
      envVars
    }
  }

  constructor (config: S3_CONFIG_TYPE) {
    if (config.awsCredentials && config.awsCredentials.endpoint) {
      this.endpoint = config.awsCredentials.endpoint
    } else {
      this.endpoint = 's3.amazonaws.com'
    }
    this.s3 = new S3(config.awsCredentials)
    this.bucket = config.bucket
    this.pageSize = config.pageSize ? config.pageSize : 100
    this.cacheControl = config.cacheControl
    this.initPromise = this.createIfNeeded()
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

  getReadURLPrefix(): string {
    return `https://${this.bucket}.${this.endpoint}/`
  }

  async createIfNeeded () {
    const bucketExists = await this.s3BucketExists()
    if (!bucketExists) {
      const params = {
        Bucket: this.bucket,
        ACL: 'public-read'
      }
      try {
        await this.s3.createBucket(params).promise()
        // Bucket creation takes a bit to propagate through AWS
        // infrastructure before it is available for use. 
        while (!(await this.s3BucketExists())) {
          await timeout(500)
        }
        logger.info(`initialized s3 bucket: ${this.bucket}`)
      } catch (error) {
        /* istanbul ignore next */
        logger.error(`failed to initialize s3 bucket: ${error}`)
        /* istanbul ignore next */
        throw error
      }
    }
  }

  async s3BucketExists() {
    try {
      await this.s3.headBucket({ Bucket: this.bucket }).promise()
      return true
    } catch (error) {
      if (['NoSuchBucket', 'NotFound'].includes(error.code)) {
        return false
      }
      /* istanbul ignore next */
      logger.error(`Unexpected error while checking if bucket exists: ${error}`)
      /* istanbul ignore next */
      throw error
    }
  }

  async deleteEmptyBucket() {
    const files = await this.listFiles({pathPrefix: ''})
    if (files.entries.length > 0) {
      /* istanbul ignore next */
      throw new Error('Tried deleting non-empty bucket')
    }
    await this.s3.deleteBucket({ Bucket: this.bucket }).promise()
  }

  async listAllKeys(prefix: string, page?: string, pageSize?: number): Promise<ListFilesStatResult> {
    // returns {'entries': [...], 'page': next_page}
    const opts: S3.ListObjectsRequest = {
      Bucket: this.bucket,
      MaxKeys: pageSize || this.pageSize,
      Prefix: prefix
    }
    if (page) {
      opts.Marker = page
    }
    const data = await this.s3.listObjects(opts).promise()
    const entries: ListFileStatResult[] = data.Contents.map((e) => {
      const fileStat = S3Driver.parseFileStat(e)
      const entry: ListFileStatResult = {
        ...fileStat,
        exists: true,
        name: e.Key.slice(prefix.length + 1)
      }
      return entry
    })

    const res: ListFilesStatResult = {
      entries: entries,
      page: data.IsTruncated ? data.NextMarker : null
    }
    /**
     * "If the response does not include the NextMarker and it is truncated, you 
     *  can use the value of the last Key in the response as the marker in the 
     *  subsequent request to get the next set of object keys."
     * @see https://docs.aws.amazon.com/AmazonS3/latest/API/RESTBucketGET.html
     */
    if (data.IsTruncated && !res.page && data.Contents.length > 0) {
      res.page = data.Contents[data.Contents.length - 1].Key
    }
    return res
  }

  async listFiles(args: PerformListFilesArgs): Promise<ListFilesResult> {
    // returns {'entries': [...], 'page': next_page}
    const listResult = await this.listAllKeys(args.pathPrefix, args.page, args.pageSize)
    return {
      entries: listResult.entries.map(e => e.name),
      page: listResult.page
    }
  }

  async listFilesStat(args: PerformListFilesArgs): Promise<ListFilesStatResult> {
    const listResult = await this.listAllKeys(args.pathPrefix, args.page, args.pageSize)
    return listResult
  }

  async performWrite(args: PerformWriteArgs): Promise<WriteResult> {
    if (args.contentType && args.contentType.length > 1024) {
      throw new InvalidInputError('Invalid content-type')
    }
    if (!S3Driver.isPathValid(args.path)){
      throw new BadPathError('Invalid Path')
    }

    const s3key = `${args.storageTopLevel}/${args.path}`
    const s3params: S3.Types.PutObjectRequest = {
      Bucket: this.bucket,
      Key: s3key,
      Body: args.stream,
      ContentType: args.contentType
    }
    if (this.cacheControl) {
      s3params.CacheControl = this.cacheControl
    }

    // Upload stream to s3
    try {
      const uploadResult = await this.s3.upload(s3params).promise()

      const publicURL = `${this.getReadURLPrefix()}${s3key}`
      logger.debug(`storing ${s3key} in bucket ${this.bucket}`)

      return {
        publicURL,
        etag: uploadResult.ETag
      }
    } catch (error) {
      logger.error(`failed to store ${s3key} in bucket ${this.bucket}`)
      throw new Error('S3 storage failure: failed to store' +
        ` ${s3key} in bucket ${this.bucket}: ${error}`)
    }
  }

  async performDelete(args: PerformDeleteArgs): Promise<void> {
    if (!S3Driver.isPathValid(args.path)){
      throw new BadPathError('Invalid Path')
    }
    const s3key = `${args.storageTopLevel}/${args.path}`
    const s3params: S3.Types.DeleteObjectRequest & S3.Types.HeadObjectRequest = {
      Bucket: this.bucket,
      Key: s3key
    }

    // S3 does not return an error if file does not exist, yet still writes a delete marker.
    // So first check if the file exists using `headObject` which throws 404. 
    // https://stackoverflow.com/a/53530749/794962
    try {
      await this.s3.headObject(s3params).promise()
      await this.s3.deleteObject(s3params).promise()
    } catch (error) {
      if (error.statusCode === 404) {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      logger.error(`failed to delete ${s3key} in bucket ${this.bucket}`)
      /* istanbul ignore next */
      throw new Error('S3 storage failure: failed to delete' +
        ` ${s3key} in bucket ${this.bucket}: ${error}`)
    }
  }

  async performRead(args: PerformReadArgs): Promise<ReadResult> {
    if (!S3Driver.isPathValid(args.path)){
      throw new BadPathError('Invalid Path')
    }
    const s3key = `${args.storageTopLevel}/${args.path}`
    const s3params: S3.Types.GetObjectRequest = {
      Bucket: this.bucket,
      Key: s3key
    }
    try {
      const headResult = await this.s3.headObject(s3params).promise()
      const dataStream = this.s3.getObject(s3params).createReadStream()
      const fileStat = S3Driver.parseFileStat(headResult)
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
      logger.error(`failed to read ${s3key} in bucket ${this.bucket}`)
      /* istanbul ignore next */
      throw new Error('S3 storage failure: failed to read' +
        ` ${s3key} in bucket ${this.bucket}: ${error}`)
    }
  }

  static parseFileStat(obj: S3.HeadObjectOutput | S3.Object): StatResult {
    let lastModified: number | undefined
    if (obj.LastModified) {
      lastModified = dateToUnixTimeSeconds(obj.LastModified)
    }
    const size = (obj as S3.HeadObjectOutput).ContentLength ?? (obj as S3.Object).Size
    const result: StatResult = {
      exists: true,
      lastModifiedDate: lastModified,
      etag: obj.ETag,
      contentLength: size,
      contentType: (obj as S3.HeadObjectOutput).ContentType
    }
    return result
  }

  async performStat(args: PerformStatArgs): Promise<StatResult> {
    if (!S3Driver.isPathValid(args.path)){
      throw new BadPathError('Invalid Path')
    }
    const s3key = `${args.storageTopLevel}/${args.path}`
    const s3params: S3.Types.HeadObjectRequest = {
      Bucket: this.bucket,
      Key: s3key
    }
    try {
      const headResult = await this.s3.headObject(s3params).promise()
      const result = S3Driver.parseFileStat(headResult)
      return result
    } catch (error) {
      if (error.statusCode === 404) {
        const result = {
          exists: false
        } as StatResult
        return result
      }
      /* istanbul ignore next */
      logger.error(`failed to stat ${s3key} in bucket ${this.bucket}`)
      /* istanbul ignore next */
      throw new Error('S3 storage failure: failed to stat' +
        ` ${s3key} in bucket ${this.bucket}: ${error}`)
    }
  }

  async performRename(args: PerformRenameArgs): Promise<void> {
    if (!S3Driver.isPathValid(args.path)){
      throw new BadPathError('Invalid original path')
    }
    if (!S3Driver.isPathValid(args.newPath)){
      throw new BadPathError('Invalid new path')
    }

    const s3KeyOrig = `${args.storageTopLevel}/${args.path}`
    const s3keyNew = `${args.storageTopLevel}/${args.newPath}`

    const s3RenameParams: S3.Types.CopyObjectRequest = {
      Bucket: this.bucket,
      Key: s3keyNew,
      CopySource: `${this.bucket}/${s3KeyOrig}`
    }
    const s3DeleteParams: S3.Types.DeleteObjectRequest = {
      Bucket: this.bucket,
      Key: s3KeyOrig
    }

    try {
      await this.s3.copyObject(s3RenameParams).promise()
      await this.s3.deleteObject(s3DeleteParams).promise()
    } catch (error) {
      if (error.statusCode === 404) {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      logger.error(`failed to rename ${s3KeyOrig} to ${s3keyNew} in bucket ${this.bucket}`)
      /* istanbul ignore next */
      throw new Error('S3 storage failure: failed to rename' +
        ` ${s3KeyOrig} to ${s3keyNew} in bucket ${this.bucket}: ${error}`)
    }
  }

}

const driver: typeof S3Driver & DriverStatics = S3Driver
export default driver
