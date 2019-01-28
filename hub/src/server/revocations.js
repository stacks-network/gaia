/* @flow */

import LRUCache from 'lru-cache'
import type { DriverModel } from './driverModel'
import fetch from 'node-fetch'
import logger from 'winston'
import { Readable } from 'stream'

const MAX_AUTH_FILE_BYTES = 1024
const AUTH_TIMESTAMP_FILE_NAME = 'authTimestamp'

export class AuthTimestampCache {

  cache: LRUCache<string, number>
  driver: DriverModel
  currentCacheEvictions: number

  constructor(driver: DriverModel, maxCacheSize: number) {
    this.currentCacheEvictions = 0
    this.cache = new LRUCache<string, number>({ 
      max: maxCacheSize, 
      dispose: () => {
        this.currentCacheEvictions++
      }
    })
    this.driver = driver

    // Check cache evictions every 10 minutes
    const tenMinutes = 1000 * 60 * 10
    this.setupCacheEvictionLogger(tenMinutes)
  }

  setupCacheEvictionLogger(timerInterval: number) {
    const evictionLogTimeout: any = setInterval(() => this.handleCacheEvictions(), timerInterval)
    evictionLogTimeout.unref()
  }

  handleCacheEvictions() {
    if (this.currentCacheEvictions > 0) {
      logger.warn(`Gaia authentication token timestamp cache evicted ${this.currentCacheEvictions} entries in the last 10 minutes. Consider increasing 'authTimestampCacheSize'.`)
      this.currentCacheEvictions = 0
    }
  }

  getAuthTimestampFileDir(bucketAddress: string) {
    return `${bucketAddress}-auth`
  }

  async readAuthTimestamp(bucketAddress: string): Promise<number> {

    const readUrlPrefix = this.driver.getReadURLPrefix()
    const authTimestampDir = this.getAuthTimestampFileDir(bucketAddress)
    
    // Check if an auth number file exists
    // TODO: Is the error for "file not exists" consistent enough to depend upon instead of doing this?
    const bucketFileList = await this.driver.listFiles(authTimestampDir, null)
    if (!bucketFileList.entries.includes(AUTH_TIMESTAMP_FILE_NAME)) {
      return 0
    }

    try {
      const authNumberFileUrl = `${readUrlPrefix}${authTimestampDir}/${AUTH_TIMESTAMP_FILE_NAME}`
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
    const authTimestampFileDir = this.getAuthTimestampFileDir(bucketAddress)
    
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
      storageTopLevel: authTimestampFileDir, 
      path: AUTH_TIMESTAMP_FILE_NAME,
      stream: contentStream,
      contentLength: contentBuffer.length,
      contentType: 'text/plain; charset=UTF-8'
    })
  }

  async setAuthTimestamp(bucketAddress: string, timestamp: number): Promise<void> {
    await this.writeAuthTimestamp(bucketAddress, (timestamp | 0))
  }

}
