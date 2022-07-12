import fs from 'fs-extra'
import { readdir } from 'fs'
import { PassThrough } from 'stream'
import { BadPathError, InvalidInputError, DoesNotExist } from '../errors.js'
import * as Path from 'path'
import * as crypto from 'crypto'
import { 
  ListFilesResult, PerformWriteArgs, WriteResult, PerformDeleteArgs, PerformRenameArgs,
  PerformStatArgs, StatResult, PerformReadArgs, ReadResult, PerformListFilesArgs,
  ListFilesStatResult, ListFileStatResult, DriverStatics, DriverModel 
} from '../driverModel.js'
import { pipelineAsync, logger, dateToUnixTimeSeconds } from '../utils.js'

export interface DISK_CONFIG_TYPE { 
  diskSettings: { storageRootDirectory?: string },
  bucket?: string,
  pageSize?: number,
  readURL: string 
}

const METADATA_DIRNAME = '.gaia-metadata'

class DiskDriver implements DriverModel {
  storageRootDirectory: string
  readURL: string
  pageSize: number
  initPromise: Promise<void>

  supportsETagMatching = false

  static getConfigInformation() {
    const envVars: any = {}
    if (process.env['GAIA_DISK_STORAGE_ROOT_DIR']) {
      const diskSettings = { storageRootDirectory: process.env['GAIA_DISK_STORAGE_ROOT_DIR'] }
      envVars['diskSettings'] = diskSettings
    }

    return {
      defaults: { diskSettings: { storageRootDirectory: undefined as any } },
      envVars
    }
  }

  constructor (config: DISK_CONFIG_TYPE) {
    if (!config.readURL) {
      throw new Error('Config is missing readURL')
    }
    if (!config.diskSettings.storageRootDirectory) {
      throw new Error('Config is missing storageRootDirectory')
    }
    if (config.bucket) {
      logger.warn(`The disk driver does not use the "config.bucket" variable. It is set to ${config.bucket}`)
    }

    this.storageRootDirectory = Path.resolve(Path.normalize(config.diskSettings.storageRootDirectory))
    this.readURL = config.readURL
    if (!this.readURL.endsWith('/')) {
      // must end in /
      this.readURL = `${this.readURL}/`
    }

    this.pageSize = config.pageSize ? config.pageSize : 100
    this.initPromise = fs.ensureDir(this.storageRootDirectory)
  }

  ensureInitialized() {
    return this.initPromise
  }

  dispose() {
    return Promise.resolve()
  }

  static isPathValid(path: string){
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
      const wasCreated: any = await fs.ensureDir(normalizedPath)
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
    const dirEntries: fs.Dirent[] = await new Promise((resolve, reject) => {
      readdir(listPath, {withFileTypes: true}, (err, files) => {
        if (err) {
          reject(err)
        } else {
          resolve(files)
        }
      })
    })

    const fileNames: string[] = []
    for (const dirEntry of dirEntries) {
      const fileOrDir = `${listPath}${Path.sep}${dirEntry.name}`
      if (dirEntry.isDirectory()) {
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

    if (!await fs.pathExists(listPath)) {
      // nope 
      const emptyResponse: ListFilesResult = {
        entries: [],
        page: null
      }
      return emptyResponse
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
      const stat = await fs.stat(listPath)
      if (!stat.isDirectory()) {
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

    if (!DiskDriver.isPathValid(args.path) || !DiskDriver.isPathValid(args.storageTopLevel)) {
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

    const hash = crypto.createHash('md5')
    const hashMonitoredStream = new PassThrough({
      transform: (chunk: Buffer, _encoding, callback) => {
        hash.update(chunk)
        // Pass the chunk Buffer through, untouched. This takes the fast 
        // path through the stream pipe lib. 
        callback(null, chunk)
      }
    })

    const hashMonitorPipeline = pipelineAsync(args.stream, hashMonitoredStream)

    const writePipe = fs.createWriteStream(absoluteFilePath, { mode: 0o600, flags: 'w' })
    const fileStreamPipeline = pipelineAsync(hashMonitoredStream, writePipe)

    await Promise.all([hashMonitorPipeline, fileStreamPipeline])

    const etag = hash.digest('hex')

    const metaDataDirPath = Path.dirname(metaDataFilePath)
    await this.mkdirs(metaDataDirPath)
    await fs.writeFile(
      metaDataFilePath, 
      JSON.stringify({ 'content-type': contentType, etag }), { mode: 0o600 })

    return {
      publicURL: `${this.readURL}${args.storageTopLevel}/${args.path}`,
      etag
    }
    
  }

  async performDelete(args: PerformDeleteArgs): Promise<void> {
    const { absoluteFilePath, metaDataFilePath } = this.getFullFilePathInfo(args)
    let stat: fs.Stats
    try {
      stat = await fs.stat(absoluteFilePath)
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      throw error
    }
    if (!stat.isFile()) {
      // Disk driver is special here in that it mirrors the behavior of cloud storage APIs. 
      // Directories are not first-class objects in blob storages, and so they will 
      // simply return 404s for the blob name even if the name happens to be a prefix
      // (pseudo-directory) of existing blobs.
      throw new DoesNotExist('Path is not a file')
    }
    await fs.unlink(absoluteFilePath)
    await fs.unlink(metaDataFilePath)
  }

  static async parseFileStat(stat: fs.Stats, metaDataFilePath: string): Promise<StatResult> {
    const metaDataJsonStr = await fs.readFile(metaDataFilePath, 'utf8')
    const metaDataJson = JSON.parse(metaDataJsonStr)
    const contentType = metaDataJson['content-type']
    const etag = metaDataJson['etag']
    const lastModified = dateToUnixTimeSeconds(stat.mtime)

    const result: StatResult = {
      exists: true,
      etag,
      contentLength: stat.size,
      contentType,
      lastModifiedDate: lastModified
    }
    return result
  }

  async performRead(args: PerformReadArgs): Promise<ReadResult> {
    const { absoluteFilePath, metaDataFilePath } = this.getFullFilePathInfo(args)
    let stat: fs.Stats
    try {
      stat = await fs.stat(absoluteFilePath)
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      throw error
    }
    if (!stat.isFile()) {
      // Disk driver is special here in that it mirrors the behavior of cloud storage APIs. 
      // Directories are not first-class objects in blob storages, and so they will 
      // simply return 404s for the blob name even if the name happens to be a prefix
      // (pseudo-directory) of existing blobs.
      throw new DoesNotExist('File does not exist')
    }
    const fileStat = await DiskDriver.parseFileStat(stat, metaDataFilePath)
    const dataStream = fs.createReadStream(absoluteFilePath)
    const result: ReadResult = {
      ...fileStat,
      exists: true,
      data: dataStream
    }
    return result
  }

  async performStat(args: PerformStatArgs): Promise<StatResult> {
    const { absoluteFilePath, metaDataFilePath } = this.getFullFilePathInfo(args)
    let stat: fs.Stats
    try {
      stat = await fs.stat(absoluteFilePath)
    } catch (error) {
      if (error.code === 'ENOENT') {
        const result = {
          exists: false
        } as StatResult
        return result
      }
      /* istanbul ignore next */
      throw error
    }
    if (!stat.isFile()) {
      // Disk driver is special here in that it mirrors the behavior of cloud storage APIs. 
      // Directories are not first-class objects in blob storages, and so they will 
      // simply return 404s for the blob name even if the name happens to be a prefix
      // (pseudo-directory) of existing blobs.
      const result = {
        exists: false
      } as StatResult
      return result
    }
    const result = await DiskDriver.parseFileStat(stat, metaDataFilePath)
    return result
  }

  async performRename(args: PerformRenameArgs): Promise<void> {
    const pathsOrig = this.getFullFilePathInfo(args)
    const pathsNew = this.getFullFilePathInfo({
      storageTopLevel: args.storageTopLevel, 
      path: args.newPath
    })

    let statOrig: fs.Stats
    try {
      statOrig = await fs.stat(pathsOrig.absoluteFilePath)
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new DoesNotExist('File does not exist')
      }
      /* istanbul ignore next */
      throw error
    }
    if (!statOrig.isFile()) {
      throw new DoesNotExist('Path is not a file')
    }

    let statNew: fs.Stats
    try {
      statNew = await fs.stat(pathsNew.absoluteFilePath)
      if (!statNew.isFile()) {
        throw new DoesNotExist('New path exists and is not a file')
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Unexpected new file location stat error: ${error}`)
      }
    }

    await fs.move(pathsOrig.absoluteFilePath, pathsNew.absoluteFilePath, {overwrite: true})
    await fs.move(pathsOrig.metaDataFilePath, pathsNew.metaDataFilePath, {overwrite: true})
  }

}

const driver: typeof DiskDriver & DriverStatics = DiskDriver
export default driver

