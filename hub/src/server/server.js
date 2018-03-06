import { StorageAuthentication as StorageAuth } from './StorageAuthentication'
import { ValidationError } from './errors'
import logger from 'winston'

export class HubServer {
  constructor(driver: Object, proofChecker: Object,
              config: { whitelist: Array<string> }) {
    this.driver = driver
    this.proofChecker = proofChecker
    this.whitelist = config.whitelist
  }

  // throws exception on validation error
  //   otherwise returns void.
  validate(address: string, requestHeaders: { authorization: string }) {
    if (this.whitelist && !(this.whitelist.includes(address))) {
      throw new ValidationError('Address not authorized for writes')
    }

    let authObject = null
    try {
      authObject = StorageAuth.fromAuthHeader(requestHeaders.authorization)
    } catch (err) {
      logger.error(err)
    }

    if (!authObject) {
      throw new ValidationError('Failed to parse authentication header.')
    }

    authObject.isAuthenticationValid(address, true)
  }

  handleRequest(address: string, path: string,
                requestHeaders: {},
                stream: stream.Readable) {
    this.validate(address, requestHeaders)

    let contentType = requestHeaders['content-type']

    if (contentType === null || contentType === undefined) {
      contentType = 'application/octet-stream'
    }

    const writeCommand = { storageTopLevel: address,
                           path, stream, contentType,
                           contentLength: requestHeaders['content-length'] }

    return this.proofChecker.checkProofs(this.req)
      .then(() => this.driver.performWrite(writeCommand))
  }
}
