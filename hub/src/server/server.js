const StorageAuth = require('./StorageAuthentication')

export class HubServer {
  constructor(driver: Object, proofChecker: Object,
              config: { whitelist: Array<string> }) {
    this.driver = driver
    this.proofChecker = proofChecker
    this.whitelist = config.whitelist
  }

  /**
   * throws exception on validation error
   *   otherwise returns void.
   */
  validate(address: string, filename: string, requestHeaders: {}) {
    if (this.whitelist && !(address in this.whitelist)) {
      throw new ValidationError('Address not authorized for writes')
      return this.writeResponse({ message: "Address not authorized for writes" },
                                null, 401)
    }

    const authObject = StorageAuth.fromAuthHeader(requestHeaders.authorization)

    if (!authObject) {
      throw new ValidationError('Failed to parse authentication header.')
    }

    authObject.isAuthenticationValid(address, true)
  }

  handleRequest(address: string, filename: string,
                requestHeaders: {},
                stream: stream.Readable) {
    this.validate(address, filename)

    let contentType = requestHeaders['content-type']

    if (contentType === null || contentType === undefined) {
      contentType = 'application/octet-stream'
    }

    const writeCommand = { storageToplevel: address,
                           path, stream, contentType,
                           contentLength: requestHeaders["content-length"] }

    return this.proofChecker.checkProofs(this.req)
      .then(() => this.driver.performWrite(write))
  }
}
