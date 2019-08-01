

import { validateAuthorizationHeader, getAuthenticationScopes, AuthScopeValues } from './authentication'
import { ValidationError, DoesNotExist } from './errors'
import { ProofChecker } from './ProofChecker'
import { AuthTimestampCache } from './revocations'

import { Readable } from 'stream'
import { DriverModel, PerformWriteArgs, PerformRenameArgs, PerformDeleteArgs, PerformListFilesArgs } from './driverModel'
import { HubConfigInterface } from './config'
import { logger, generateUniqueID } from './utils'

export class HubServer {
  driver: DriverModel
  proofChecker: ProofChecker
  whitelist?: Array<string>
  serverName: string
  readURL?: string
  requireCorrectHubUrl: boolean
  validHubUrls?: Array<string>
  authTimestampCache: AuthTimestampCache

  constructor(driver: DriverModel, proofChecker: ProofChecker, config: HubConfigInterface) {
    this.driver = driver
    this.proofChecker = proofChecker
    this.whitelist = config.whitelist
    this.serverName = config.serverName
    this.validHubUrls = config.validHubUrls
    this.readURL = config.readURL
    this.requireCorrectHubUrl = config.requireCorrectHubUrl || false
    this.authTimestampCache = new AuthTimestampCache(this.getReadURLPrefix(), driver, config.authTimestampCacheSize)
  }

  async handleAuthBump(address: string, oldestValidTimestamp: number, requestHeaders: { authorization?: string }) {
    this.validate(address, requestHeaders)
    await this.authTimestampCache.setAuthTimestamp(address, oldestValidTimestamp)
  }

  // throws exception on validation error
  //   otherwise returns void.
  validate(address: string, requestHeaders: { authorization?: string }, oldestValidTokenTimestamp?: number) {
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
                        page: string | undefined,
                        stat: boolean,
                        requestHeaders: { authorization?: string }) {
    const oldestValidTokenTimestamp = await this.authTimestampCache.getAuthTimestamp(address)
    const scopes = getAuthenticationScopes(requestHeaders.authorization)
    const isArchivalRestricted = this.isArchivalRestricted(scopes)

    this.validate(address, requestHeaders, oldestValidTokenTimestamp)
    const listFilesArgs: PerformListFilesArgs = {
      pathPrefix: address,
      page: page
    }
    if (stat) {
      const result = await this.driver.listFilesStat(listFilesArgs)
      if (isArchivalRestricted) {
        result.entries = result.entries.filter(entry => !this.isHistoricalFile(entry.name))
      }
      return result
    } else {
      const result = await this.driver.listFiles(listFilesArgs)
      if (isArchivalRestricted) {
        result.entries = result.entries.filter(entry => !this.isHistoricalFile(entry))
      }
      return result
    }
  }

  getReadURLPrefix() {
    if (this.readURL) {
      return this.readURL
    } else {
      return this.driver.getReadURLPrefix()
    }
  }

  getFileName(filePath: string) {
    const pathParts = filePath.split('/')
    const fileName = pathParts[pathParts.length - 1]
    return fileName
  }

  getHistoricalFileName(filePath: string) {
    const fileName = this.getFileName(filePath)
    const filePathPrefix = filePath.slice(0, filePath.length - fileName.length)
    const historicalName = `.history.${Date.now()}.${generateUniqueID()}.${fileName}`
    const historicalPath = `${filePathPrefix}${historicalName}`
    return historicalPath
  }
  
  isHistoricalFile(filePath: string) {
    const fileName = this.getFileName(filePath)
    const isHistoricalFile = fileName.startsWith('.history.')
    return isHistoricalFile
  }

  async handleDelete(
    address: string, path: string,
    requestHeaders: { authorization?: string }
  ) {
    const oldestValidTokenTimestamp = await this.authTimestampCache.getAuthTimestamp(address)
    this.validate(address, requestHeaders, oldestValidTokenTimestamp)

    // can the caller delete? if so, in what paths?
    const scopes = getAuthenticationScopes(requestHeaders.authorization)
    const isArchivalRestricted = this.checkArchivalRestrictions(address, path, scopes)

    if (scopes.deletePrefixes.length > 0 || scopes.deletePaths.length > 0) {
      // we're limited to a set of prefixes and paths.
      // does the given path match any prefixes?
      let match = !!scopes.deletePrefixes.find((p) => (path.startsWith(p)))

      if (!match) {
        // check for exact paths
        match = !!scopes.deletePaths.find((p) => (path === p))
      }

      if (!match) {
        // not authorized to write to this path
        throw new ValidationError(`Address ${address} not authorized to delete from ${path} by scopes`)
      }
    }

    await this.proofChecker.checkProofs(address, path, this.getReadURLPrefix())

    if (isArchivalRestricted){
      // if archival restricted then just rename the canonical file to the historical file
      const historicalPath = this.getHistoricalFileName(path)
      const renameCommand: PerformRenameArgs = {
        path: path,
        storageTopLevel: address,
        newPath: historicalPath
      }
      await this.driver.performRename(renameCommand)
    } else {
      const deleteCommand: PerformDeleteArgs = {
        storageTopLevel: address,
        path
      }
      await this.driver.performDelete(deleteCommand)
    }
  }

  async handleRequest(
    address: string, path: string,
    requestHeaders: {
      'content-type'?: string,
      'content-length'?: string | number,
      authorization?: string
    },
    stream: Readable
  ) {

    const oldestValidTokenTimestamp = await this.authTimestampCache.getAuthTimestamp(address)
    this.validate(address, requestHeaders, oldestValidTokenTimestamp)
    let contentType = requestHeaders['content-type']

    if (contentType === null || contentType === undefined) {
      contentType = 'application/octet-stream'
    }

    // can the caller write? if so, in what paths?
    const scopes = getAuthenticationScopes(requestHeaders.authorization)
    const isArchivalRestricted = this.checkArchivalRestrictions(address, path, scopes)

    if (scopes.writePrefixes.length > 0 || scopes.writePaths.length > 0) {
      // we're limited to a set of prefixes and paths.
      // does the given path match any prefixes?
      let match = !!scopes.writePrefixes.find((p) => (path.startsWith(p)))

      if (!match) {
        // check for exact paths
        match = !!scopes.writePaths.find((p) => (path === p))
      }

      if (!match) {
        // not authorized to write to this path
        throw new ValidationError(`Address ${address} not authorized to write to ${path} by scopes`)
      }
    }

    const writeCommand: PerformWriteArgs = {
      storageTopLevel: address,
      path, stream, contentType,
      contentLength: parseInt(requestHeaders['content-length'] as string)
    }

    await this.proofChecker.checkProofs(address, path, this.getReadURLPrefix())
    
    if (isArchivalRestricted) {
      const historicalPath = this.getHistoricalFileName(path)
      try {
        await this.driver.performRename({
          path: path,
          storageTopLevel: address,
          newPath: historicalPath
        })
      } catch (error) {
        if (error instanceof DoesNotExist) {
          // ignore
          logger.debug(
            '404 on putFileArchival rename attempt -- usually this is okay and ' + 
            'only indicates that this is the first time the file was written: ' +
            `${address}/${path}`
          )
        } else {
          logger.error(`Error performing historical file rename: ${address}/${path}`)
          logger.error(error)
          throw error
        }
      }
    }

    const readURL = await this.driver.performWrite(writeCommand)
    const driverPrefix = this.driver.getReadURLPrefix()
    const readURLPrefix = this.getReadURLPrefix()
    if (readURLPrefix !== driverPrefix && readURL.startsWith(driverPrefix)) {
      const postFix = readURL.slice(driverPrefix.length)
      return `${readURLPrefix}${postFix}`
    }
    return readURL
  }
  
  isArchivalRestricted(scopes: AuthScopeValues) {
    return scopes.writeArchivalPaths.length > 0 || scopes.writeArchivalPrefixes.length > 0
  }

  checkArchivalRestrictions(address: string, path: string, scopes: AuthScopeValues) {
    const isArchivalRestricted = this.isArchivalRestricted(scopes)
    if (isArchivalRestricted) {
      // we're limited to a set of prefixes and paths.
      // does the given path match any prefixes?
      let match = !!scopes.writeArchivalPrefixes.find((p) => (path.startsWith(p)))

      if (!match) {
        // check for exact paths
        match = !!scopes.writeArchivalPaths.find((p) => (path === p))
      }

      if (!match) {
        // not authorized to write to this path
        throw new ValidationError(`Address ${address} not authorized to modify ${path} by scopes`)
      }
    }
    return isArchivalRestricted
  }

}
