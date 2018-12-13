/* @flow */

import { validateAuthorizationHeader, getAuthenticationScopes } from './authentication'
import { ValidationError } from './errors'
import { ProofChecker } from './ProofChecker'
import { AuthNumberCache } from './revocations'

import type { Readable } from 'stream'
import type { DriverModel } from './driverModel'

export class HubServer {
  driver: DriverModel
  proofChecker: ProofChecker
  whitelist: Array<string>
  serverName: string
  readURL: ?string
  requireCorrectHubUrl: boolean
  validHubUrls: ?Array<string>
  authNumberCache: AuthNumberCache

  constructor(driver: DriverModel, proofChecker: ProofChecker,
              config: { whitelist: Array<string>, serverName: string,
                        readURL?: string, requireCorrectHubUrl?: boolean,
                        validHubUrls?: Array<string> }) {
    this.driver = driver
    this.proofChecker = proofChecker
    this.whitelist = config.whitelist
    this.serverName = config.serverName
    this.validHubUrls = config.validHubUrls
    this.readURL = config.readURL
    this.requireCorrectHubUrl = config.requireCorrectHubUrl || false
    this.authNumberCache = new AuthNumberCache(driver)
  }

  // throws exception on validation error
  //   otherwise returns void.
  validate(address: string, requestHeaders: { authorization: string }, requiredAuthTokenNumber?: number) {
    const signingAddress = validateAuthorizationHeader(requestHeaders.authorization,
                                                       this.serverName, address,
                                                       this.requireCorrectHubUrl,
                                                       this.validHubUrls,
                                                       requiredAuthTokenNumber)

    if (this.whitelist && !(this.whitelist.includes(signingAddress))) {
      throw new ValidationError(`Address ${signingAddress} not authorized for writes`)
    }
  }

  handleListFiles(address: string,
                  page: ?string,
                  requestHeaders: { authorization: string }) {
    this.validate(address, requestHeaders)
    return this.driver.listFiles(address, page)
  }

  getReadURLPrefix() {
    if (this.readURL) {
      return this.readURL
    } else {
      return this.driver.getReadURLPrefix()
    }
  }

  async handleRequest(address: string, path: string,
                requestHeaders: {'content-type': string,
                                 'content-length': string,
                                 authorization: string},
                stream: Readable) {

    const requiredAuthNumber = await this.authNumberCache.getAuthNumber(address)
    await this.validate(address, requestHeaders, requiredAuthNumber)

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

    return await this.proofChecker.checkProofs(address, path, this.getReadURLPrefix())
      .then(() => this.driver.performWrite(writeCommand))
      .then((readURL) => {
        const driverPrefix = this.driver.getReadURLPrefix()
        const readURLPrefix = this.getReadURLPrefix()
        if (readURLPrefix !== driverPrefix && readURL.startsWith(driverPrefix)) {
          const postFix = readURL.slice(driverPrefix.length)
          return `${readURLPrefix}${postFix}`
        }
        return readURL
      })
  }
}
