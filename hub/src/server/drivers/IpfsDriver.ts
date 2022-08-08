import { create, IPFSHTTPClient } from 'ipfs-http-client'
import { StatResult as IpfsStatResult } from 'ipfs-core-types/src/files/index.js'

import { Readable } from 'stream'
import { BadPathError, InvalidInputError, DoesNotExist } from '../errors.js'
import * as Path from 'path'
import { base16 } from 'multiformats/bases/base16'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import {
  ListFilesResult, PerformWriteArgs, WriteResult, PerformDeleteArgs, PerformRenameArgs,
  PerformStatArgs, StatResult, PerformReadArgs, ReadResult, PerformListFilesArgs,
  ListFilesStatResult, ListFileStatResult, DriverStatics, DriverModel
} from '../driverModel.js'
import { logger } from '../utils.js'

export interface IPFS_CONFIG_TYPE {
  ipfsSettings: {
    apiAddress?: string,
    storageRootDirectory?: string
  },
  bucket?: string,
  pageSize?: number,
  readURL: string
}

const METADATA_DIRNAME = '.gaia-metadata'

class IpfsDriver implements DriverModel {
  client: IPFSHTTPClient
  storageRootDirectory: string
  readURL: string
  pageSize: number
  initPromise: Promise<void>

  supportsETagMatching = false

  static getConfigInformation() {
    const envVars: any = {}
    const ipfsSettings: any = {}
    if (process.env['GAIA_IPFS_API_ADDRESS']) {
      envVars['ipfsSettings'] = ipfsSettings
      ipfsSettings['apiAddress'] = process.env['GAIA_IPFS_API_ADDRESS']
    }
    if (process.env['GAIA_IPFS_STORAGE_ROOT_DIR']) {
      envVars['ipfsSettings'] = ipfsSettings
      ipfsSettings['storageRootDirectory'] = process.env['GAIA_IPFS_STORAGE_ROOT_DIR']
    }
    return {
      defaults: {
        ipfsSettings: {
          apiAddress: undefined as any,
          storageRootDirectory: undefined as any
        }
      },
      envVars
    }
  }

  constructor (config: IPFS_CONFIG_TYPE) {
    if (!config.readURL) {
      throw new Error('Config is missing readURL')
    }
    if (!config.ipfsSettings.storageRootDirectory) {
      throw new Error('Config is missing storageRootDirectory')
    }
    if (config.bucket) {
      logger.warn(`The disk driver does not use the "config.bucket" variable. It is set to ${config.bucket}`)
    }
    this.client = create({ url: config.ipfsSettings.apiAddress })
    this.readURL = config.readURL
    if (!this.readURL.endsWith('/')) {
      // must end in /
      this.readURL = `${this.readURL}/`
    }

    this.storageRootDirectory = Path.normalize(config.ipfsSettings.storageRootDirectory)
    this.pageSize = config.pageSize ? config.pageSize : 100
    this.initPromise = this.client.files.mkdir(this.storageRootDirectory, { parents: true })
  }

  ensureInitialized() {
    return this.initPromise
  }

  dispose() {
    return Promise.resolve()
  }

  static isPathValid(path: string) {
    if (path.includes('..')) {
      return false
    }
    if (path.endsWith('/')) {
      return false
    }
    return true
  }

  getReadURLPrefix () {
    return this.readURL
  }

  async mkdirs(path: string) {
    const normalizedPath = Path.normalize(path)
    try {
      // Ensures that the directory exists. If the directory structure does not exist, it is created. Like mkdir -p.
      const wasCreated: any = await this.client.files.mkdir(normalizedPath, { parents: true })
      if (wasCreated) {
        logger.debug(`mkdir ${normalizedPath}`)
      }
    } catch (error) {
      logger.error(`Error ensuring directory exists: ${error}`)
      throw error
    }
  }

  async findAllFiles(listPath: string): Promise<string[]> {
    // returns a list of files prefixed by listPath
    const fileNames: string[] = []
    for await (const dirEntry of this.client.files.ls(listPath)) {
      const fileOrDir = `${listPath}${Path.sep}${dirEntry.name}`
      if (dirEntry.type === 'directory') {
        const childEntries = await this.findAllFiles(fileOrDir)
        fileNames.push(...childEntries)
      } else {
        fileNames.push(Path.posix.normalize(fileOrDir))
      }
    }
    return fileNames
  }

  async listFilesInDirectory(listPath: string, pageNum: number, pageSize?: number): Promise<ListFilesResult> {
    pageSize = pageSize || this.pageSize
    const files = await this.findAllFiles(listPath)
    const entries = files.map(file => file.slice(listPath.length + 1))
    const sliced = entries.slice(pageNum * pageSize, (pageNum + 1) * pageSize)
    const page = sliced.length === entries.length ? null : `${pageNum + 1}`
    return {
      entries: sliced,
      page: page
    }
  }

  async listFilesInternal(args: PerformListFilesArgs): Promise<ListFilesResult> {
    // returns {'entries': [...], 'page': next_page}
    let pageNum
    const listPath = Path.normalize(`${this.storageRootDirectory}/${args.pathPrefix}`)

    try {
      await this.client.files.stat(listPath)
    } catch (error) {
      if (error.name === 'HTTPError' && error.message === 'file does not exist') {
        // nope
        const emptyResponse: ListFilesResult = {
          entries: [],
          page: null
        }
        return emptyResponse
      }
      /* istanbul ignore next */
      throw error
    }

    try {
      if (args.page) {
        if (!(/^[0-9]+$/.exec(args.page))) {
          throw new Error('Invalid page number')
        }
        pageNum = parseInt(args.page)
      } else {
        pageNum = 0
      }
      // const stat = await fs.stat(listPath)
      const stat = await this.client.files.stat(listPath)
      if (stat.type !== 'directory') {
        // All the cloud drivers return a single empty entry in this situation
        return { entries: [''], page: null }
      }
    } catch(e) {
      throw new Error('Invalid arguments: invalid page or not a directory')
    }

    const listResult = await this.listFilesInDirectory(listPath, pageNum, args.pageSize)
    return listResult
  }

  async listFiles(args: PerformListFilesArgs): Promise<ListFilesResult> {
    return await this.listFilesInternal(args)
  }

  async listFilesStat(args: PerformListFilesArgs): Promise<ListFilesStatResult> {
    const filePathResult = await this.listFilesInternal(args)
    const fileStats: ListFileStatResult[] = []
    for (const file of filePathResult.entries) {
      const fileStat = await this.performStat({storageTopLevel: args.pathPrefix, path: file})
      fileStats.push({
        ...fileStat,
        name: file,
        exists: true
      })
    }
    return {
      page: filePathResult.page,
      entries: fileStats
    }
  }

  getFullFilePathInfo(args: {storageTopLevel: string, path: string} ) {
    if (!args.storageTopLevel) {
      throw new BadPathError('Invalid Path')
    }

    if (!IpfsDriver.isPathValid(args.path) || !IpfsDriver.isPathValid(args.storageTopLevel)) {
      throw new BadPathError('Invalid Path')
    }

    const abspath = Path.join(this.storageRootDirectory, args.storageTopLevel, args.path)

    // too long?
    if (abspath.length > 4096) {
      throw new BadPathError('Path is too long')
    }

    const dirparts = abspath.split(Path.sep).filter((p) => p.length > 0)

    // can't be too deep
    if (dirparts.length > 100) {
      throw new BadPathError('Path is too deep')
    }

    // remember content type in $storageRootDir/.gaia-metadata/$address/$path
    // (i.e. these files are outside the address bucket, and are thus hidden)
    const metaDataFilePath = Path.join(
      this.storageRootDirectory, METADATA_DIRNAME, args.storageTopLevel, args.path)

    return { absoluteFilePath: abspath, metaDataFilePath }
  }

  async performWrite(args: PerformWriteArgs): Promise<WriteResult> {

    const contentType = args.contentType

    if (contentType && contentType.length > 1024) {
      // no way this is valid
      throw new InvalidInputError('Invalid content-type')
    }

    const { absoluteFilePath, metaDataFilePath } = this.getFullFilePathInfo(args)

    const absdirname = Path.dirname(absoluteFilePath)
    await this.mkdirs(absdirname)

    await this.client.files.write(absoluteFilePath, args.stream, { create: true, mode: 0o600 })

    const stat = await this.client.files.stat(absoluteFilePath)
    const etag = stat.cid.toV1().toString(base16)

    const metaDataDirPath = Path.dirname(metaDataFilePath)
    await this.mkdirs(metaDataDirPath)

    await this.client.files.write(metaDataFilePath, JSON.stringify({ 'content-type': contentType, etag }), { create: true, mode: 0o600 })

    return {
      publicURL: `${this.readURL}${args.storageTopLevel}/${args.path}`,
      etag
    }

  }

  async performDelete(args: PerformDeleteArgs): Promise<void> {
    const { absoluteFilePath, metaDataFilePath } = this.getFullFilePathInfo(args)
    let stat: IpfsStatResult
    try {
      stat = await this.client.files.stat(absoluteFilePath)
    } catch (error) {
      if (error.name === 'HTTPError' && error.message === 'file does not exist') {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      throw error
    }

    if (stat.type !== 'file') {
      // Disk driver is special here in that it mirrors the behavior of cloud storage APIs.
      // Directories are not first-class objects in blob storages, and so they will
      // simply return 404s for the blob name even if the name happens to be a prefix
      // (pseudo-directory) of existing blobs.
      throw new DoesNotExist('Path is not a file')
    }
    await this.client.files.rm(absoluteFilePath)
    await this.client.files.rm(metaDataFilePath)
  }

  static parseFileStat(stat: IpfsStatResult, metaData: string): StatResult {
    const metaDataJson = JSON.parse(metaData)
    const contentType = metaDataJson['content-type']
    const etag = metaDataJson['etag']
    const lastModified = stat.mtime.secs

    const result: StatResult = {
      exists: true,
      etag,
      contentLength: stat.size,
      contentType,
      lastModifiedDate: lastModified
    }
    return result
  }

  async readMetaDataFile(filePath: string) {
    const chunks = []
    for await (const chunk of this.client.files.read(filePath)) {
      chunks.push(chunk)
    }
    return uint8ArrayConcat(chunks).toString()
  }

  async performRead(args: PerformReadArgs): Promise<ReadResult> {
    const { absoluteFilePath, metaDataFilePath } = this.getFullFilePathInfo(args)
    let stat: IpfsStatResult
    try {
      stat = await this.client.files.stat(absoluteFilePath)
    } catch (error) {
      if (error.name === 'HTTPError' && error.message === 'file does not exist') {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      throw error
    }
    if (stat.type !== 'file') {
      // Disk driver is special here in that it mirrors the behavior of cloud storage APIs.
      // Directories are not first-class objects in blob storages, and so they will
      // simply return 404s for the blob name even if the name happens to be a prefix
      // (pseudo-directory) of existing blobs.
      throw new DoesNotExist('File does not exist')
    }
    const metaData = await this.readMetaDataFile(metaDataFilePath)
    const fileStat = IpfsDriver.parseFileStat(stat, metaData)
    const dataStream = this.client.files.read(absoluteFilePath)
    const result: ReadResult = {
      ...fileStat,
      exists: true,
      data: Readable.from(dataStream)
    }
    return result
  }

  async performStat(args: PerformStatArgs): Promise<StatResult> {
    const { absoluteFilePath, metaDataFilePath } = this.getFullFilePathInfo(args)
    let stat: IpfsStatResult
    try {
      stat = await this.client.files.stat(absoluteFilePath)
    } catch (error) {
      if (error.name === 'HTTPError' && error.message === 'file does not exist') {
        const result = {
          exists: false
        } as StatResult
        return result
      }
      /* istanbul ignore next */
      throw error
    }
    if (stat.type !== 'file') {
      // Disk driver is special here in that it mirrors the behavior of cloud storage APIs.
      // Directories are not first-class objects in blob storages, and so they will
      // simply return 404s for the blob name even if the name happens to be a prefix
      // (pseudo-directory) of existing blobs.
      const result = {
        exists: false
      } as StatResult
      return result
    }
    const metaData = await this.readMetaDataFile(metaDataFilePath)
    const result = IpfsDriver.parseFileStat(stat, metaData)
    return result
  }

  async performRename(args: PerformRenameArgs): Promise<void> {
    const pathsOrig = this.getFullFilePathInfo(args)
    const pathsNew = this.getFullFilePathInfo({
      storageTopLevel: args.storageTopLevel,
      path: args.newPath
    })

    let statOrig: IpfsStatResult
    try {
      statOrig = await this.client.files.stat(pathsOrig.absoluteFilePath)
    } catch (error) {
      if (error.name === 'HTTPError' && error.message === 'file does not exist') {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      throw error
    }
    if (statOrig.type !== 'file') {
      throw new DoesNotExist('Path is not a file')
    }

    let statNew: IpfsStatResult
    try {
      statNew = await this.client.files.stat(pathsNew.absoluteFilePath)
    } catch (error) {
      if (error.name !== 'HTTPError' || error.message !== 'file does not exist') {
        throw new Error(`Unexpected new file location stat error: ${error}`)
      }
    }
    if (statNew.type !== 'file') {
      throw new DoesNotExist('New path exists and is not a file')
    }

    await this.client.files.mv(pathsOrig.absoluteFilePath, pathsNew.absoluteFilePath)
    await this.client.files.mv(pathsOrig.metaDataFilePath, pathsNew.metaDataFilePath)
  }

}

const driver: typeof IpfsDriver & DriverStatics = IpfsDriver
export default driver

