/* @flow */

import { validateAuthorizationHeader, getAuthenticationScopes } from './authentication'
import { ValidationError } from './errors'
import { ProofChecker } from './ProofChecker'
import { AuthTimestampCache } from './revocations'

import { Readable } from 'stream'
import { DriverModel } from './driverModel'

export type HubServerConfig = {
  whitelist?: Array<string>, 
  serverName: string, 
  authTimestampCacheSize: number,
  readURL?: string, 
  requireCorrectHubUrl?: boolean, 
  validHubUrls?: Array<string> 
}

export class HubServer {
  driver: DriverModel
  proofChecker: ProofChecker
  whitelist: ?Array<string>
  serverName: string
  readURL: ?string
  requireCorrectHubUrl: boolean
  validHubUrls: ?Array<string>
  authTimestampCache: AuthTimestampCache

  constructor(driver: DriverModel, proofChecker: ProofChecker, config: HubServerConfig) {
    this.driver = driver
    this.proofChecker = proofChecker
    this.whitelist = config.whitelist
    this.serverName = config.serverName
    this.validHubUrls = config.validHubUrls
    this.readURL = config.readURL
    this.requireCorrectHubUrl = config.requireCorrectHubUrl || false
    this.authTimestampCache = new AuthTimestampCache(this.getReadURLPrefix(), driver, config.authTimestampCacheSize)
  }

  async handleAuthBump(address: string, oldestValidTimestamp: number, requestHeaders: { authorization: string }) {
    this.validate(address, requestHeaders)
    await this.authTimestampCache.setAuthTimestamp(address, oldestValidTimestamp)
  }

  // throws exception on validation error
  //   otherwise returns void.
  validate(address: string, requestHeaders: { authorization: string }, oldestValidTokenTimestamp?: number) {
    const signingAddress = validateAuthorizationHeader(requestHeaders.authorization,
                                                       this.serverName, address,
                                                       this.requireCorrectHubUrl,
                                                       this.validHubUrls, 
                                                       oldestValidTokenTimestamp)

    if (this.whitelist && !(this.whitelist.includes(signingAddress))) {
      throw new ValidationError(`Address ${signingAddress} not authorized for writes`)
    }
  }

  async handleListFiles(address: string,
                  page: ?string,
                  requestHeaders: { authorization: string }) {
    const oldestValidTokenTimestamp = await this.authTimestampCache.getAuthTimestamp(address)
    this.validate(address, requestHeaders, oldestValidTokenTimestamp)
    return await this.driver.listFiles(address, page)
  }

  getReadURLPrefix() {
    if (this.readURL) {
      return this.readURL
    } else {
      return this.driver.getReadURLPrefix()
    }
  }

  async handleRequest(address: string, path: string,
                requestHeaders: {'content-type'?: string,
                                 'content-length': string | number,
                                 authorization: string},
                stream: Readable) {

    const oldestValidTokenTimestamp = await this.authTimestampCache.getAuthTimestamp(address)
    this.validate(address, requestHeaders, oldestValidTokenTimestamp)
    let contentType = requestHeaders['content-type']

    if (contentType === null || contentType === undefined) {
      contentType = 'application/octet-stream'
    }

    // can the caller write? if so, in what paths?
    const scopes = getAuthenticationScopes(requestHeaders.authorization)
    const writePrefixes = []
    const writePaths = []
    for (let i = 0; i < scopes.length; i++) {
      if (scopes[i].scope == 'putFilePrefix') {
        writePrefixes.push(scopes[i].domain)
      } else if (scopes[i].scope == 'putFile') {
        writePaths.push(scopes[i].domain)
      }
    }

    if (writePrefixes.length > 0 || writePaths.length > 0) {
      // we're limited to a set of prefixes and paths.
      // does the given path match any prefixes?
      let match = !!writePrefixes.find((p) => (path.startsWith(p)))

      if (!match) {
        // check for exact paths
        match = !!writePaths.find((p) => (path === p))
      }

      if (!match) {
        // not authorized to write to this path
        throw new ValidationError(`Address ${address} not authorized to write to ${path} by scopes`)
      }
    }

    const writeCommand = { storageTopLevel: address,
                            path, stream, contentType,
                            contentLength: parseInt(requestHeaders['content-length']) }

    await this.proofChecker.checkProofs(address, path, this.getReadURLPrefix())
    
    const readURL = await this.driver.performWrite(writeCommand)
    const driverPrefix = this.driver.getReadURLPrefix()
    const readURLPrefix = this.getReadURLPrefix()
    if (readURLPrefix !== driverPrefix && readURL.startsWith(driverPrefix)) {
      const postFix = readURL.slice(driverPrefix.length)
      return `${readURLPrefix}${postFix}`
    }
    return readURL
  }
}
