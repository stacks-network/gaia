/* @flow */

import S3 from 'aws-sdk/clients/s3'
import logger from 'winston'

import { BadPathError } from '../errors'
import type { ListFilesResult, PerformWriteArgs } from '../driverModel'
import { DriverStatics, DriverModel, DriverModelTestMethods } from '../driverModel'

type S3_CONFIG_TYPE = { awsCredentials: {
                          accessKeyId?: string,
                          secretAccessKey?: string,
                          sessionToken?: string
                        },
                        pageSize?: number,
                        cacheControl?: string,
                        bucket: string }

class S3Driver implements DriverModel, DriverModelTestMethods {
  s3: S3
  bucket: string
  pageSize: number
  cacheControl: ?string
  initPromise: Promise<void>

  static getConfigInformation() {
    const envVars = {}
    const awsCredentials = {}
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
      defaults: { awsCredentials: undefined },
      envVars
    }
  }

  constructor (config: S3_CONFIG_TYPE) {
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
    return (path.indexOf('..') === -1)
  }

  getReadURLPrefix(): string {
    return `https://${this.bucket}.s3.amazonaws.com/`
  }

  async createIfNeeded () {
    try {
      await this.s3.headBucket({ Bucket: this.bucket }).promise()
      logger.info(`connected to s3 bucket: ${this.bucket}`)
    } catch (error) {
      if (error.code === 'NotFound') { // try to create
        const params = {
          Bucket: this.bucket,
          ACL: 'public-read'
        }
        try {
          await this.s3.createBucket(params).promise()
          logger.info(`initialized s3 bucket: ${this.bucket}`)
        } catch (error) {
          logger.error(`failed to initialize s3 bucket: ${error}`)
          throw error
        }
      } else {
        logger.error(`failed to connect to s3 bucket: ${error}`)
        throw error
      }
    }
  }

  async deleteEmptyBucket() {
    const files = await this.listFiles('')
    if (files.entries.length > 0) {
      throw new Error('Tried deleting non-empty bucket')
    }
    await this.s3.deleteBucket({ Bucket: this.bucket }).promise()
  }

  listAllKeys(prefix: string, page: ?string) : Promise<ListFilesResult> {
    // returns {'entries': [...], 'page': next_page}
    const opts : { Bucket: string, MaxKeys: number, Prefix: string, ContinuationToken?: string } = {
      Bucket: this.bucket,
      MaxKeys: this.pageSize,
      Prefix: prefix
    }
    if (page) {
      opts.ContinuationToken = page
    }
    return new Promise((resolve, reject) => {
      this.s3.listObjectsV2(opts, (err, data) => {
        if (err) {
          return reject(err)
        }
        const res : ListFilesResult = {
          entries: data.Contents.map((e) => e.Key.slice(prefix.length + 1)),
          page: data.IsTruncated ? data.NextContinuationToken : null
        }
        return resolve(res)
      })
    })
  }

  listFiles(prefix: string, page: ?string) {
    // returns {'entries': [...], 'page': next_page}
    return this.listAllKeys(prefix, page)
  }

  async performWrite(args: PerformWriteArgs) : Promise<string> {
    const s3key = `${args.storageTopLevel}/${args.path}`
    const s3params = Object.assign({}, {
      Bucket: this.bucket,
      Key: s3key,
      Body: args.stream,
      ContentType: args.contentType,
      ACL: 'public-read'
    })
    if (this.cacheControl) {
      s3params.CacheControl = this.cacheControl
    }

    if (!S3Driver.isPathValid(args.path)){
      throw new BadPathError('Invalid Path')
    }

    // Upload stream to s3
    try {
      await new Promise((resolve, reject) => this.s3.upload(s3params, (error) => 
        error ? reject(error) : resolve()
      ))
    } catch (error) {
      logger.error(`failed to store ${s3key} in bucket ${this.bucket}`)
      throw new Error('S3 storage failure: failed to store' +
        ` ${s3key} in bucket ${this.bucket}: ${error}`)
    }

    const publicURL = `${this.getReadURLPrefix()}${s3key}`
    logger.debug(`storing ${s3key} in bucket ${this.bucket}`)
    return publicURL
  }
}

(S3Driver: DriverStatics)

export default S3Driver
