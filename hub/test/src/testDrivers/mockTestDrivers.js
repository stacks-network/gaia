/* @flow */

import { Readable, Writable } from 'stream'
import os from 'os'
import path from 'path'
import fs from 'fs'
import proxyquire from 'proxyquire'

import { DriverModel } from '../../../src/server/driverModel'
import type { ListFilesResult, PerformWriteArgs } from '../../../src/server/driverModel'
import AzDriver from '../../../src/server/drivers/AzDriver'
import S3Driver from '../../../src/server/drivers/S3Driver'
import GcDriver from '../../../src/server/drivers/GcDriver'
import DiskDriver from '../../../src/server/drivers/diskDriver'


export const availableMockedDrivers: {[name: string]: () => {driverClass: Class<DriverModel>, dataMap: [], config: any}} = {
  az: () => makeMockedAzureDriver(),
  aws: () => makeMockedS3Driver(),
  gc: () => makeMockedGcDriver(),
  disk: () => makeMockedDiskDriver()
};


export function makeMockedAzureDriver() {

  let config = {
    "azCredentials": {
      "accountName": "mock-azure",
      "accountKey": "mock-azure-key"
    },
    "bucket": "spokes"
  }

  const dataMap = []
  let bucketName = ''
  const createContainerIfNotExists = function (newBucketName, options, cb) {
    bucketName = newBucketName
    cb()
  }
  const createBlockBlobFromStream = function (putBucket, blobName, streamInput, contentLength, opts, cb) {
    if (bucketName !== putBucket) {
      cb(new Error(`Unexpected bucket name: ${putBucket}. Expected ${bucketName}`))
    }
    readStream(streamInput, contentLength, (buffer) => {
      dataMap.push({ data: buffer.toString(), key: blobName })
      cb()
    })
  }
  const listBlobsSegmentedWithPrefix = function (getBucket, prefix, continuation, data, cb) {
    const outBlobs = []
    dataMap.forEach(x => {
      if (x.key.startsWith(prefix)) {
        outBlobs.push({ name: x.key })
      }
    })
    cb(null, { entries: outBlobs, continuationToken: null })
  }

  const createBlobService = function () {
    return { createContainerIfNotExists, createBlockBlobFromStream, listBlobsSegmentedWithPrefix }
  }

  const driverClass = proxyquire('../../../src/server/drivers/AzDriver', {
    'azure-storage': { createBlobService }
  }).default
  return { driverClass, dataMap, config }
}


export function makeMockedS3Driver() {
  let config : any = {
    "bucket": "spokes"
  }
  const dataMap = []
  let bucketName = ''

  const S3Class = class {
    headBucket(options, callback) {
      bucketName = options.Bucket
      callback()
    }
    upload(options, cb) {
      if (options.Bucket != bucketName) {
        cb(new Error(`Unexpected bucket name: ${options.Bucket}. Expected ${bucketName}`))
      }
      readStream(options.Body, 10000, (buffer) => {
        dataMap.push({ data: buffer.toString(), key: options.Key })
        cb()
      })
    }
    listObjectsV2(options, cb) {
      const contents = dataMap
      .filter((entry) => {
        return (entry.key.slice(0, options.Prefix.length) === options.Prefix)
      })
      .map((entry) => {
        return { Key: entry.key }
      })
      cb(null, { Contents: contents, isTruncated: false })
    }
  }

  const driverClass = proxyquire('../../../src/server/drivers/S3Driver', {
    'aws-sdk/clients/s3': S3Class
  }).default
  return { driverClass, dataMap, config }
}

export function makeMockedGcDriver() {
  let config = {
    "bucket": "spokes"
  }

  const dataMap = []
  let myName = ''

  const file = function (filename) {
    const createWriteStream = function() {
      return new MockWriteStream(dataMap, filename)
    }
    return { createWriteStream }
  }
  const exists = function () {
    return Promise.resolve([true])
  }
  const StorageClass = class {
    bucket(bucketName) {
      if (myName === '') {
        myName = bucketName
      } else {
        if (myName !== bucketName) {
          throw new Error(`Unexpected bucket name: ${bucketName}. Expected ${myName}`)
        }
      }
      return { file, exists, getFiles: this.getFiles }
    }

    getFiles(options, cb) {
      const files = dataMap
        .filter(entry => entry.key.startsWith(options.prefix))
        .map(entry => { return { name: entry.key } })
      cb(null, files, null)
    }
  }

  const driverClass = proxyquire('../../../src/server/drivers/GcDriver', {
    '@google-cloud/storage': StorageClass
  }).default
  return { driverClass, dataMap, config }
}

export function makeMockedDiskDriver() {

  const dataMap = []

  const tmpStorageDir = path.resolve(os.tmpdir(), `disktest-${Date.now()-Math.random()}`)
  fs.mkdirSync(tmpStorageDir)
  let config = { 
    bucket: "spokes", 
    readURL: "https://local/none",
    diskSettings: {
      storageRootDirectory: tmpStorageDir
    }
  }
  class DiskDriverWrapper extends DiskDriver {
    async performWrite(args: PerformWriteArgs) : Promise<string> {
      const result = await super.performWrite(args)
      const filePath = path.resolve(tmpStorageDir, args.storageTopLevel, args.path)
      const fileContent = fs.readFileSync(filePath, {encoding: 'utf8'})
      dataMap.push({ key: `${args.storageTopLevel}/${args.path}`, data: fileContent })
      return result
    }
  }

  const driverClass = DiskDriverWrapper
  return {driverClass, dataMap, config}
}

function readStream(input, contentLength, callback) {
  var bufs = []
  input.on('data', function(d){ bufs.push(d) });
  input.on('end', function(){
    var buf = Buffer.concat(bufs)
    callback(buf.slice(0, contentLength))
  })
}

class MockWriteStream extends Writable {
  dataMap: any
  filename: any
  data: any
  constructor(dataMap, filename) {
    super({})
    this.dataMap = dataMap
    this.filename = filename
    this.data = ''
  }
  _write(chunk, encoding, callback) {
    this.data += chunk
    callback()
    return true
  }
  _final(callback) {
    this.dataMap.push({ data: this.data, key: this.filename })
    callback()
  }
}
