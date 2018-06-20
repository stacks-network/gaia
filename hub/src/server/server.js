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
  constructor(driver: DriverModel, proofChecker: Object,
              config: { whitelist: Array<string>, servername: string }) {
    this.driver = driver
    this.proofChecker = proofChecker
    this.whitelist = config.whitelist
    this.serverName = config.servername
  }

  // throws exception on validation error
  //   otherwise returns void.
  validate(address: string, requestHeaders: { authorization: string }) {
    if (this.whitelist && !(this.whitelist.includes(address))) {
      throw new ValidationError('Address not authorized for writes')
    }

    validateAuthorizationHeader(requestHeaders.authorization, this.serverName, address)
  }

  handleRequest(address: string, path: string,
                requestHeaders: {'content-type': string,
                                 'content-length': string,
                                 'authorization': string},
                stream: Readable) {
    this.validate(address, requestHeaders)

    let contentType = requestHeaders['content-type']

    if (contentType === null || contentType === undefined) {
      contentType = 'application/octet-stream'
    }

    const writeCommand = { storageTopLevel: address,
                           path, stream, contentType,
                           contentLength: parseInt(requestHeaders['content-length']) }

    return this.proofChecker.checkProofs(address, path)
      .then(() => this.driver.performWrite(writeCommand))
  }

  handleGetFileRequest(address: string, path: string) {
    // TODO (djs): should think about authorization
    // this.validate(address, requestHeaders)
    const readCommand = { storageTopLevel: address, path}

    return this.proofChecker.checkProofs(address, path)
      .then(() => this.driver.performRead(readCommand))
  }
}
