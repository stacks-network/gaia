

import { Readable, Writable } from 'stream'
import { createHash } from 'crypto'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { load as proxyquire } from 'proxyquire'

import { readStream } from '../../../src/server/utils'
import { DriverModel, DriverConstructor, PerformDeleteArgs } from '../../../src/server/driverModel'
import { ListFilesResult, PerformWriteArgs, WriteResult } from '../../../src/server/driverModel'
import AzDriver from '../../../src/server/drivers/AzDriver'
import S3Driver from '../../../src/server/drivers/S3Driver'
import GcDriver from '../../../src/server/drivers/GcDriver'
import DiskDriver from '../../../src/server/drivers/diskDriver'
import {BlobServiceClient, BlockBlobUploadStreamOptions} from '@azure/storage-blob'
import {getPagedAsyncIterator} from '@azure/core-paging'

type DataMap = {key: string, data: string, etag: string}[];

export const availableMockedDrivers: {[name: string]: () => {driverClass: DriverConstructor, dataMap: DataMap, config: any}} = {
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

  const dataMap: DataMap = []

  class ContainerClient {
    create = () => null
    getBlockBlobClient = (blobName) => new BlockBlobClient(blobName)
    listBlobsFlat = ({ prefix }) => {
      const items = dataMap
        .filter(x => x.key.startsWith(prefix))
        .map(x => { return {
          name: x.key,
          properties: {
            lastModified: new Date(),
            etag: x.etag,
            contentLength: x.data.length,
            contentType: "?"
          }
        }})

      return getPagedAsyncIterator({
        firstPageLink: "0",
        getPage: (pageLink, maxPageSize) => {
          return new Promise<{page, nextPageLink}>((resolve => {
            const start = Number(pageLink)
            const end = start + maxPageSize
            const blobItems = end ? items.slice(start, end) : items.slice(start)
            const page = {
              segment: {
                blobItems: blobItems
              },
              continuationToken: end
            }
            resolve({ page: page, nextPageLink: String(end) })
          }))
        }
      })
    }
  }

  class BlockBlobClient {
    blobName: string

    constructor(blobName) {
      this.blobName = blobName
    }
    uploadStream = async (stream, bufferSize, maxBuffers, options) => {
      const buffer = await readStream(stream)
      const etag = createHash('md5').update(buffer).digest('hex')
      dataMap.push({data: buffer.toString(), key: this.blobName, etag: etag })
      return { etag: etag }
    }
    delete = () => {
      return Promise.resolve().then(() => {
        const newDataMap = dataMap.filter((d) => d.key !== this.blobName)
        if (newDataMap.length === dataMap.length) {
          const err: any = new Error()
          err.statusCode = 404
          throw err
        }
        dataMap.length = 0
        dataMap.push(...newDataMap)
      })
    }
  }

  class BlobServiceClient {
    getContainerClient = () => new ContainerClient()
  }

  const driverClass = proxyquire('../../../src/server/drivers/AzDriver', {
    '@azure/storage-blob': {
      BlobServiceClient: BlobServiceClient,
      ContainerClient: ContainerClient,
      BlockBlobClient: BlockBlobClient
    }
  }).default
  return { driverClass, dataMap, config }
}


export function makeMockedS3Driver() {
  let config : any = {
    "bucket": "spokes"
  }
  const dataMap: DataMap = []
  let bucketName = ''

  const S3Class = class {
    headBucket(options) {
      bucketName = options.Bucket
      return { promise: () => Promise.resolve() }
    }
    upload(options) {
      return {
        promise: async () => {
          if (options.Bucket != bucketName) {
            throw new Error(`Unexpected bucket name: ${options.Bucket}. Expected ${bucketName}`)
          }
          const buffer = await readStream(options.Body)
          const etag = createHash('md5').update(buffer).digest('hex')
          dataMap.push({ data: buffer.toString(), key: options.Key, etag: etag })
          return { 
            ETag: etag
          }
        }
      }
    }
    headObject(options) {
      return {
        promise: () => {
          return Promise.resolve().then(() => {
            if (!dataMap.find((d) => d.key === options.Key)) {
              const err: any = new Error()
              err.statusCode = 404
              throw err
            }
          })
        }
      }
    }
    deleteObject(options) {
      return {
        promise: () => {
          return Promise.resolve().then(() => {
            const newDataMap = dataMap.filter((d) => d.key !== options.Key)
            dataMap.length = 0
            dataMap.push(...newDataMap)
          })
        }
      }
    }
    listObjectsV2(options) {
      return {
        promise: async () => {
          const contents = dataMap
            .filter((entry) => {
              return (entry.key.slice(0, options.Prefix.length) === options.Prefix)
            })
            .map((entry) => {
              return { Key: entry.key }
            })
          return { Contents: contents, IsTruncated: false }
        }
      }
    }
    listObjects(options) {
      return {
        promise: async () => {
          const contents = dataMap
            .filter((entry) => {
              return (entry.key.slice(0, options.Prefix.length) === options.Prefix)
            })
            .map((entry) => {
              return { Key: entry.key, ETag: entry.etag }
            })
          return { Contents: contents, IsTruncated: false }
        }
      }
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

  const dataMap: DataMap = []
  let myName = ''

  const file = function (filename) {
    const fileMetadata = { md5Hash: undefined as string }
    const createWriteStream = function() {
      const mockWriteStream = new MockWriteStream(dataMap, filename)
      mockWriteStream.addListener('finish', () => {
        fileMetadata.md5Hash = Buffer.from(mockWriteStream.etag, 'hex').toString('base64') 
      })
      return mockWriteStream
    }
    return { 
      createWriteStream, 
      delete: () => {
        return Promise.resolve().then(() => {
          const newDataMap = dataMap.filter((d) => d.key !== filename)
          if (newDataMap.length === dataMap.length) {
            const err: any = new Error()
            err.code = 404
            throw err
          }
          dataMap.length = 0
          dataMap.push(...newDataMap)
        })
      },
      metadata: fileMetadata
    }
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
        .map(entry => { return { name: entry.key, etag: entry.etag } })
      cb(null, files, null)
    }
  }

  const driverClass = proxyquire('../../../src/server/drivers/GcDriver', {
    '@google-cloud/storage': { Storage: StorageClass }
  }).default
  return { driverClass, dataMap, config }
}

export function makeMockedDiskDriver() {

  const dataMap: DataMap = []

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
    supportsETagMatching = false;

    async performWrite(args: PerformWriteArgs) : Promise<WriteResult> {
      const result = await super.performWrite(args)
      const filePath = path.resolve(tmpStorageDir, args.storageTopLevel, args.path)
      const fileContent = fs.readFileSync(filePath, {encoding: 'utf8'})
      const etag = createHash('md5').update(fileContent).digest('hex')
      dataMap.push({ key: `${args.storageTopLevel}/${args.path}`, data: fileContent, etag: etag })
      return result
    }
    async performDelete(args: PerformDeleteArgs): Promise<void> {
      await super.performDelete(args)
      const key = `${args.storageTopLevel}/${args.path}`
      const newDataMap = dataMap.filter((d) => d.key !== key)
      dataMap.length = 0
      dataMap.push(...newDataMap)
    }
  }

  const driverClass: DriverConstructor = DiskDriverWrapper
  return {driverClass, dataMap, config}
}

class MockWriteStream extends Writable {
  dataMap: DataMap
  filename: string
  data: string
  etag: string
  constructor(dataMap: DataMap, filename: string) {
    super({})
    this.dataMap = dataMap
    this.filename = filename
    this.data = ''
  }
  _write(chunk: any, encoding: any, callback: any) {
    this.data += chunk
    callback()
    return true
  }
  _final(callback: any) {
    this.etag = createHash('md5').update(this.data).digest('hex')
    this.dataMap.push({ data: this.data, key: this.filename, etag: this.etag })
    callback()
  }
}
