

import { Readable, Writable } from 'stream'
import { createHash } from 'crypto'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

import { readStream } from '../../../src/server/utils.js'
import { DriverModel, DriverConstructor, PerformDeleteArgs } from '../../../src/server/driverModel.js'
import { ListFilesResult, PerformWriteArgs, WriteResult } from '../../../src/server/driverModel.js'
import AzDriver from '../../../src/server/drivers/AzDriver.js'
import S3Driver from '../../../src/server/drivers/S3Driver.js'
import GcDriver from '../../../src/server/drivers/GcDriver.js'
import DiskDriver from '../../../src/server/drivers/diskDriver.js'
import {BlobServiceClient, BlockBlobUploadStreamOptions} from '@azure/storage-blob'
import {getPagedAsyncIterator} from '@azure/core-paging'
import {azDataMap, s3DataMap, gcDataMap} from "./global";

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

  const driverClass: DriverConstructor = AzDriver
  const dataMap = azDataMap

  return { driverClass, dataMap, config }
}

export function makeMockedS3Driver() {
  let config : any = {
    "bucket": "spokes"
  }

  const driverClass: DriverConstructor = S3Driver
  const dataMap = s3DataMap

  return { driverClass, dataMap, config }
}

export function makeMockedGcDriver() {
  let config = {
    "bucket": "spokes"
  }

  const driverClass: DriverConstructor = GcDriver
  const dataMap = gcDataMap

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
