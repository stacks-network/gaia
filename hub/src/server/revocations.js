/* @flow */

import LRUCache from 'lru-cache'
import type { DriverModel } from './driverModel'
import fetch from 'node-fetch'
import { Readable } from 'stream'

const MAX_AUTH_FILE_BYTES = 1024
const AUTH_NUMBER_FILE_NAME = 'authNumber'

export class AuthNumberCache {

  cache: LRUCache;
  driver: DriverModel;

  constructor(driver: DriverModel) {
    // TODO: configure cache settings..
    this.cache = new LRUCache()
    this.driver = driver
  }

  getAuthNumberFileDir(bucketAddress: string) {
    return `${bucketAddress}-auth`
  }

  async readAuthNumber(bucketAddress: string): Promise<number> {

    const readUrlPrefix = this.driver.getReadURLPrefix()
    const authNumberDir = this.getAuthNumberFileDir(bucketAddress)
    
    // Check if an auth number file exists
    // TODO: Is the error for "file not exists" consistent enough to depend upon instead of doing this?
    const bucketFileList = await this.driver.listFiles(authNumberDir, null)
    if (!bucketFileList.entries.includes(AUTH_NUMBER_FILE_NAME)) {
      return 0
    }

    try {
      const authNumberFileUrl = `${readUrlPrefix}${authNumberDir}/${AUTH_NUMBER_FILE_NAME}`
      const fetchResult = await fetch(authNumberFileUrl)
      const authNumberText = fetchResult.text()
      const authNumber = parseInt(authNumberText)
      return authNumber
    } catch (err) {
      // TODO: If error indicates file does not exit then return 0 (indicates no auth number setup).
      throw new Error('Unimplemented')
    }
  }

  async getAuthNumber(bucketAddress: string): Promise<number> {
    // First perform fast check if auth number exists in cache..
    let authNumber = this.cache.get(bucketAddress)
    if (authNumber) {
      return authNumber
    }

    // Nothing in cache, perform slower driver read.
    authNumber = await this.readAuthNumber(bucketAddress)

    // Cache result for fast lookup later.
    this.cache.set(bucketAddress, authNumber)

    return authNumber
  }

  async writeAuthNumber(bucketAddress: string, authNumber: number) : Promise<void> {
    this.cache.set(bucketAddress, authNumber)
    const authNumberFileDir = this.getAuthNumberFileDir(bucketAddress)
    
    // Convert our number to a Buffer.
    const contentBuffer = Buffer.from(authNumber.toString(), 'utf8')

    // Wrap the buffer in a stream for driver consumption.
    const contentStream = new Readable({encoding: 'utf8'})
    contentStream.push(contentBuffer)
    contentStream.push(null) // Mark EOF

    const contentLength = contentBuffer.length

    // Content size sanity check.
    if (contentLength > MAX_AUTH_FILE_BYTES) {
      throw new Error(`Auth number file content size is ${contentLength}, it should never be greater than ${MAX_AUTH_FILE_BYTES}`)
    }
    
    const writeResult = await this.driver.performWrite({
      storageTopLevel: authNumberFileDir, 
      path: AUTH_NUMBER_FILE_NAME,
      stream: contentStream,
      contentLength: contentBuffer.length,
      contentType: 'text/plain; charset=UTF-8'
    })

    // TODO: check result?
    if (writeResult || true) {
      throw new Error('unimplemented')
    }
  }

  async bumpAuthNumber(bucketAddress: string): Promise<void> {
    const authNumber = await this.getAuthNumber(bucketAddress)
    const nextAuthNumber = authNumber + 1
    await this.writeAuthNumber(bucketAddress, nextAuthNumber)
  }

}
