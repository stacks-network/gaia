/* @flow */

import LRUCache from 'lru-cache'
import type { DriverModel } from './driverModel'
import fetch from 'node-fetch'
import { Readable } from 'stream'

const MAX_AUTH_FILE_BYTES = 1024
const AUTH_NUMBER_FILE_NAME = 'authNumber'

export class AuthTimestampCache {

  cache: LRUCache;
  driver: DriverModel;

  constructor(driver: DriverModel) {
    // TODO: configure cache settings..
    this.cache = new LRUCache()
    this.driver = driver
  }

  getAuthTimestampFileDir(bucketAddress: string) {
    return `${bucketAddress}-auth`
  }

  async readAuthTimestamp(bucketAddress: string): Promise<number> {

    const readUrlPrefix = this.driver.getReadURLPrefix()
    const authNumberDir = this.getAuthTimestampFileDir(bucketAddress)
    
    // Check if an auth number file exists
    // TODO: Is the error for "file not exists" consistent enough to depend upon instead of doing this?
    const bucketFileList = await this.driver.listFiles(authNumberDir, null)
    if (!bucketFileList.entries.includes(AUTH_NUMBER_FILE_NAME)) {
      return 0
    }

    try {
      const authNumberFileUrl = `${readUrlPrefix}${authNumberDir}/${AUTH_NUMBER_FILE_NAME}`
      const fetchResult = await fetch(authNumberFileUrl)
      const authNumberText = await fetchResult.text()
      const authNumber = parseInt(authNumberText)
      return authNumber
    } catch (err) {
      // TODO: If error indicates file does not exit then return 0 (indicates no auth number setup).
      throw new Error('Unimplemented')
    }
  }

  async getAuthTimestamp(bucketAddress: string): Promise<number> {
    // First perform fast check if auth number exists in cache..
    let authTimestamp = this.cache.get(bucketAddress)
    if (authTimestamp) {
      return authTimestamp
    }

    // Nothing in cache, perform slower driver read.
    authTimestamp = await this.readAuthTimestamp(bucketAddress)

    // Cache result for fast lookup later.
    this.cache.set(bucketAddress, authTimestamp)

    return authTimestamp
  }

  async writeAuthTimestamp(bucketAddress: string, timestamp: number) : Promise<void> {
    this.cache.set(bucketAddress, timestamp)
    const authNumberFileDir = this.getAuthTimestampFileDir(bucketAddress)
    
    // Convert our number to a Buffer.
    const contentBuffer = Buffer.from(timestamp.toString(), 'utf8')

    // Wrap the buffer in a stream for driver consumption.
    const contentStream = new Readable()
    contentStream.push(contentBuffer, 'utf8')
    contentStream.push(null) // Mark EOF

    const contentLength = contentBuffer.length

    // Content size sanity check.
    if (contentLength > MAX_AUTH_FILE_BYTES) {
      throw new Error(`Auth number file content size is ${contentLength}, it should never be greater than ${MAX_AUTH_FILE_BYTES}`)
    }
    
    await this.driver.performWrite({
      storageTopLevel: authNumberFileDir, 
      path: AUTH_NUMBER_FILE_NAME,
      stream: contentStream,
      contentLength: contentBuffer.length,
      contentType: 'text/plain; charset=UTF-8'
    })
  }

  async setAuthTimestamp(bucketAddress: string, timestamp: number): Promise<void> {
    await this.writeAuthTimestamp(bucketAddress, (timestamp | 0))
  }

}
