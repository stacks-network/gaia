/* @flow */

import S3 from 'aws-sdk/clients/s3'
import logger from 'winston'

import { BadPathError } from '../errors'

import type { DriverModel } from '../driverModel'
import type { Readable } from 'stream'

type S3_CONFIG_TYPE = { awsCredentials: Object,
                        bucket: string,
                        readURL?: string }

class S3Driver implements DriverModel {
  s3: S3
  bucket: string
  readURL: ?string

  constructor (config: S3_CONFIG_TYPE) {
    this.s3 = new S3(config.awsCredentials)
    this.bucket = config.bucket
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
    return `https://${this.bucket}.s3.amazonaws.com/`
  }

  createIfNeeded () {
    this.s3.headBucket( { Bucket: this.bucket }, (error) => {
      if (error && error.code === 'NotFound') { // try to create
        const params = {
          Bucket: this.bucket,
          ACL: 'public-read'
        }
        this.s3.createBucket(params, (error) => {
          if (error) {
            logger.error(`failed to initialize s3 bucket: ${error}`)
            process.exit()
          }else{
            logger.info(`initialized s3 bucket: ${this.bucket}`)
          }
        })
      } else if (error) {
        logger.error(`failed to connect to s3 bucket: ${error}`)
        process.exit()
      } else {
        logger.info(`connected to s3 bucket: ${this.bucket}`)
      }
    })
  }

  performWrite(args: { path: string,
                       storageTopLevel: string,
                       stream: Readable,
                       contentLength: number,
                       contentType: string }) : Promise<string> {
    const s3key = `${args.storageTopLevel}/${args.path}`
    const s3params = {
      Bucket: this.bucket,
      Key: s3key,
      Body: args.stream,
      ContentType: args.contentType,
      ACL: 'public-read'
    }

    if (!S3Driver.isPathValid(args.path)){
      return Promise.reject(new BadPathError('Invalid Path'))
    }

    // Upload stream to s3
    return new Promise((resolve, reject) => {
      this.s3.upload(s3params, (err) => {
        if (err) {
          logger.error(`failed to store ${s3key} in bucket ${this.bucket}`)
          return reject(new Error('S3 storage failure: failed to store' +
                                  ` ${s3key} in bucket ${this.bucket}: ${err}`))
        }
        const publicURL = `${this.getReadURLPrefix()}${s3key}`
        logger.debug(`storing ${s3key} in bucket ${this.bucket}`)
        return resolve(publicURL)
      })
    })
  }
}

module.exports = S3Driver
