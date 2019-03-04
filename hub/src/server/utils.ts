

import { Readable, Writable } from 'stream'
import { DriverModel, DriverConstructor } from './driverModel'
import S3Driver from './drivers/S3Driver'
import AzDriver from './drivers/AzDriver'
import GcDriver from './drivers/GcDriver'
import DiskDriver from './drivers/diskDriver'
import { promisify } from 'util'

//$FlowFixMe - Flow is unaware of the stream.pipeline Node API
import { pipeline as _pipline } from 'stream'

export const pipeline = promisify(_pipline)

export function getDriverClass(driver: string) : DriverConstructor {
  if (driver === 'aws') {
    return S3Driver
  } else if (driver === 'azure') {
    return AzDriver
  } else if (driver === 'disk') {
    return DiskDriver
  } else if (driver === 'google-cloud') {
    return GcDriver
  } else {
    throw new Error(`Failed to load driver: driver was set to ${driver}`)
  }
}


class MemoryStream extends Writable {
  buffers: Buffer[]
  constructor(opts?: any) {
    super(opts)
    this.buffers = []
  }
  _write(chunk: any, encoding: any, callback: any) {
    this.buffers.push(Buffer.from(chunk, encoding))
    callback(null)
    return true
  }
  getData() {
    return Buffer.concat(this.buffers)
  }
}

export async function readStream(stream: Readable): Promise<Buffer> {
  const memStream = new MemoryStream()
  await pipeline(stream, memStream)
  return memStream.getData()
}

export function timeout(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, milliseconds)
  })
}
