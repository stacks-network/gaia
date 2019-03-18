

import stream from 'stream'
import { DriverConstructor, DriverStatics } from './driverModel'
import S3Driver from './drivers/S3Driver'
import AzDriver from './drivers/AzDriver'
import GcDriver from './drivers/GcDriver'
import DiskDriver from './drivers/diskDriver'
import { promisify } from 'util'
import winston from 'winston'

//$FlowFixMe - Flow is unaware of the stream.pipeline Node API
import { pipeline as _pipline } from 'stream'
import { DriverName } from './config'

export const pipeline = promisify(_pipline)

export const logger = winston.createLogger()

export function getDriverClass(driver: DriverName): DriverConstructor & DriverStatics {
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


class MemoryStream extends stream.Writable {
  buffers: Buffer[]
  constructor(opts?: stream.WritableOptions) {
    super(opts)
    this.buffers = []
  }
  _write(chunk: any, encoding: string, callback: (error?: Error | null) => void): void {
    this.buffers.push(Buffer.from(chunk, encoding))
    callback(null)
  }
  getData() {
    if (this.buffers.length === 1) {
      return this.buffers[0]
    }
    return Buffer.concat(this.buffers)
  }
}

export async function readStream(stream: stream.Readable): Promise<Buffer> {
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
