/* @flow */

import { Readable, Writable } from 'stream'
import os from 'os'
import path from 'path'
import fs from 'fs'
import proxyquire from 'proxyquire'

import { readStream } from '../../../src/server/utils'
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
  const uploadStreamToBlockBlob = async (aborter, stream, blockBlobURL, bufferSize, maxBuffers, options) => {
    const buffer = await readStream(stream)
    dataMap.push({data: buffer.toString(), key: blockBlobURL })
  }

  const listBlobFlatSegment = (_, __, { prefix }) => {
    const items = dataMap
      .map(x => x.key)
      .filter(key => key.startsWith(prefix))
      .map(key => { return {
        name: key
      }})
    return { segment: { blobItems: items } }
  }

  const ContainerURL = {
    fromServiceURL: () => {
      return {
        create: () => null,
        listBlobFlatSegment: listBlobFlatSegment,
      }
    }
  }
  
  const driverClass = proxyquire('../../../src/server/drivers/AzDriver', {
    '@azure/storage-blob': {
      SharedKeyCredential: class { },
      ContainerURL: ContainerURL,
      StorageURL: { newPipeline: () => null },
      ServiceURL: class { },
      BlobURL: { fromContainerURL: (_, blobName) => blobName },
      BlockBlobURL: { fromBlobURL: (blobName) => blobName },
      Aborter: { none: null },
      uploadStreamToBlockBlob: uploadStreamToBlockBlob
    }
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
    headBucket(options) {
      bucketName = options.Bucket
      return { promise: () => Promise.resolve() }
    }
    upload(options, cb) {
      if (options.Bucket != bucketName) {
        cb(new Error(`Unexpected bucket name: ${options.Bucket}. Expected ${bucketName}`))
      }
      readStream(options.Body).then((buffer) => {
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
    '@google-cloud/storage': { Storage: StorageClass }
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
