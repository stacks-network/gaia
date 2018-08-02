/* @flow */

import { validateAuthorizationHeader } from './authentication'
import { ValidationError } from './errors'

import type { Readable } from 'stream'
import type { DriverModel } from './driverModel'

export class HubServer {
  driver: DriverModel
  proofChecker: Object
  whitelist: Array<string>
  serverName: string
  readURL: ?string
  requireCorrectHubUrl: boolean
  validHubUrls: ?Array<string>
  constructor(driver: DriverModel, proofChecker: Object,
              config: { whitelist: Array<string>, servername: string,
                        readURL?: string, requireCorrectHubUrl?: boolean,
                        validHubUrls?: Array<string> }) {
    this.driver = driver
    this.proofChecker = proofChecker
    this.whitelist = config.whitelist
    this.serverName = config.servername
    this.validHubUrls = config.validHubUrls
    this.readURL = config.readURL
    this.requireCorrectHubUrl = config.requireCorrectHubUrl || false
  }

  // throws exception on validation error
  //   otherwise returns void.
  validate(address: string, requestHeaders: { authorization: string }) {
    const signingAddress = validateAuthorizationHeader(requestHeaders.authorization,
                                                       this.serverName, address,
                                                       this.requireCorrectHubUrl,
                                                       this.validHubUrls)

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

  handleRequest(address: string, path: string,
                requestHeaders: {'content-type': string,
                                 'content-length': string,
                                 authorization: string},
                stream: Readable) {
    this.validate(address, requestHeaders)

    let contentType = requestHeaders['content-type']

    if (contentType === null || contentType === undefined) {
      contentType = 'application/octet-stream'
    }

    const writeCommand = { storageTopLevel: address,
                           path, stream, contentType,
                           contentLength: parseInt(requestHeaders['content-length']) }

    return this.proofChecker.checkProofs(address, path, this.getReadURLPrefix())
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
