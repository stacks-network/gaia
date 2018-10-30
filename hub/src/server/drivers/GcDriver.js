/* @flow */

import Storage from '@google-cloud/storage'
import logger from 'winston'

import { BadPathError } from '../errors'

import type { DriverModel } from '../driverModel'
import type { Readable } from 'stream'

type GC_CONFIG_TYPE = { gcCredentials?: {
                          email?: string,
                          projectId?: string,
                          keyFilename?: string,
                          credentials?: {
                            client_email?: string,
                            private_key?: string
                          }
                        },
                        pageSize?: number,
                        bucket: string }

class GcDriver implements DriverModel {
  bucket: string
  storage: Storage
  pageSize: number

  constructor (config: GC_CONFIG_TYPE) {
    this.storage =  new Storage(config.gcCredentials)
    this.bucket = config.bucket
    this.pageSize = config.pageSize ? config.pageSize : 100

    this.createIfNeeded()
  }

  static isPathValid(path: string){
    // for now, only disallow double dots.
    return (path.indexOf('..') === -1)
  }

  getReadURLPrefix () {
    return `https://storage.googleapis.com/${this.bucket}/`
  }

  createIfNeeded () {
    const bucket = this.storage.bucket(this.bucket)

    bucket.exists()
    .then(data => {
      const exists = data[0]
      if (!exists) {
        this.storage
          .createBucket(this.bucket)
          .then(() => {
            logger.info(`initialized google cloud storage bucket: ${this.bucket}`)
          })
          .catch(err => {
            logger.error(`failed to initialize google cloud storage bucket: ${err}`)
            process.exit()
          })
      }
    })
    .catch(err => {
      logger.error(`failed to connect to google cloud storage bucket: ${err}`)
      process.exit()
    })
  }

  listAllObjects(prefix: string, page: ?string) {
    // returns {'entries': [...], 'page': next_page}
    const opts : { prefix: string, maxResults: number, pageToken?: string } = {
      prefix: prefix,
      maxResults: this.pageSize
    }
    if (page) {
      opts.pageToken = page
    }
    return new Promise((resolve, reject) => {
      return this.storage.bucket(this.bucket).getFiles(opts, (err, files, nextQuery) => {
        if (err) {
          return reject(err)
        }
        const fileNames = []
        files.forEach(file => {
          fileNames.push(file.name.slice(prefix.length + 1))
        })
        const ret = {
          entries: fileNames,
          page: null
        }
        if (nextQuery && nextQuery.pageToken) {
          ret.page = nextQuery.pageToken
        }
        return resolve(ret)
      })
    })
  }

  listFiles(prefix: string, page: ?string) {
    // returns {'entries': [...], 'page': next_page}
    return this.listAllObjects(prefix, page)
  }

  performWrite(args: { path: string,
                       storageTopLevel: string,
                       stream: Readable,
                       contentLength: number,
                       contentType: string }) : Promise<string> {
    if (!GcDriver.isPathValid(args.path)){
      return Promise.reject(new BadPathError('Invalid Path'))
    }

    const filename = `${args.storageTopLevel}/${args.path}`
    const publicURL = `${this.getReadURLPrefix()}${filename}`

    return new Promise((resolve, reject) => {
      const fileDestination = this.storage
            .bucket(this.bucket)
            .file(filename)
      args.stream
        .pipe(fileDestination.createWriteStream({ public: true,
                                                  resumable: false,
                                                  contentType: args.contentType }))
        .on('error', (err) => {
          logger.error(`failed to store ${filename} in bucket ${this.bucket}`)
          reject(new Error('Google cloud storage failure: failed to store' +
                           ` ${filename} in bucket ${this.bucket}: ${err}`))
        })
        .on('finish', () => {
          logger.debug(`storing ${filename} in bucket ${this.bucket}`)
          resolve(publicURL)
        })
    })
  }
}

module.exports = GcDriver
