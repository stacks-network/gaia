/* @flow */
import oss from 'ali-oss'
import logger from 'winston'

import { BadPathError } from '../errors'

import type { DriverModel } from '../driverModel'
import type { Readable } from 'stream'

type AC_CONFIG_TYPE = { acCredentials: Object,
                        bucket: string,
                        readURL?: string }

class AcDriver implements DriverModel {
  store: oss
  bucket: string
  region: string
  readURL: ?string

  constructor (config: AC_CONFIG_TYPE) {
    this.store = oss(config.acCredentials)
    this.bucket = config.bucket
    this.region = config.acCredentials.region
    this.readURL = config.readURL

    this.createIfNeeded()
  }

  static isPathValid(path: string){
    // for now, only disallow double dots.
    return (path.indexOf('..') === -1)
  }

  getReadURLPrefix(): string {
    if (this.readURL) {
      return `https://${this.readURL}/`
    }
    return `https://${this.bucket}.${this.region}.aliyuncs.com`
  }

  createIfNeeded () {
    this.store.getBucketACL(this.bucket, this.region)
      .then(async result => {
        if (result.status === 200) {
          this.store.useBucket(this.bucket, this.region)
          logger.info(`connected to alibaba cloud oss bucket: ${this.bucket}`)
        }
        if (result.status !== 200) {
          await this.store.putBucket(this.bucket, this.region)
          this.store.useBucket(this.bucket, this.region)
          logger.info(`initialized alibaba cloud oss bucket: ${this.bucket}`)
        }
      })
      .catch(err => {
        logger.error(`failed to initialize alibaba cloud oss bucket: ${err}`)
        process.exit()
      })
  }

  performWrite(args: { path: string,
                       storageTopLevel: string,
                       stream: Readable,
                       contentLength: number,
                       contentType: string }) : Promise<string> {

    const filename = `${args.storageTopLevel}/${args.path}`
    if (!AcDriver.isPathValid(args.path)){
      return Promise.reject(new BadPathError('Invalid Path'))
    }

    // Upload stream to alibaba cloud oss
    return new Promise((resolve, reject) => {
      this.store.put(filename, args.stream, {contentLength: args.contentLength})
        .then(result => {
          logger.debug(`storing ${filename} in bucket ${this.bucket}`)
          resolve(result.url)
        })
        .catch(err => {
          logger.error(`failed to store ${filename} in bucket ${this.bucket}`)
          return reject(new Error('Alibaba cloud OSS failure: failed to store' +
                                  ` ${filename} in bucket ${this.bucket}: ${err}`))
        })
    })
  }
}

module.exports = AcDriver
