/* @flow */

import { validateAuthorizationHeader } from './authentication'
import { ValidationError } from './errors'

import type { Readable } from 'stream'
import type { DriverModel } from './driverModel'

type ConfigType = {
  whitelist: Array<string>,
  adminList?: Array<string>,
  servername: string,
  readURL?: string
}

export class HubServer {
  driver: DriverModel
  proofChecker: Object
  whitelist: Array<string>
  adminList: Array<string>
  serverName: string
  readURL: ?string
  constructor(driver: DriverModel, proofChecker: Object,
              config: ConfigType) {
    this.driver = driver
    this.proofChecker = proofChecker
    this.whitelist = config.whitelist
    this.adminList = config.adminList
    this.serverName = config.servername
    this.readURL = config.readURL
  }

  // throws exception on validation error
  //   otherwise returns void.
  validate(address: string, requestHeaders: { authorization: string }) {
    if (this.whitelist && !(this.whitelist.includes(address))) {
      // admins don't need to be whitelisted
      if (!this.adminList || !(this.adminList.includes(address))) {
        throw new ValidationError('Address not authorized for writes')
      }
    }

    validateAuthorizationHeader(requestHeaders.authorization, this.serverName, address)
  }

  handleListFiles(address: string,
                  page: ?string,
                  requestHeaders: { authorization: string }) {
    this.validate(address, requestHeaders)
    return this.driver.listFiles(address, page)
  }

  handleWhitelist(address: string,
                  newWhiteList: Array<string>,
                  requestHeaders: {'content-type': string,
                                   'content-length': string,
                                   authorization: string}) {

    this.validate(address, requestHeaders)
    if (!this.adminList || !this.adminList.includes(address)) {
      throw new ValidationError('Address is not in the admin list')
    }
    this.whitelist = newWhiteList
    return Promise.resolve()
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
