/* @flow */
import fs from 'fs-extra'
import { BadPathError, InvalidInputError } from '../errors'
import logger from 'winston'
import Path from 'path'
import type { ListFilesResult, PerformWriteArgs } from '../driverModel'
import { DriverStatics, DriverModel } from '../driverModel'
import { pipeline } from '../utils'

type DISK_CONFIG_TYPE = { diskSettings: { storageRootDirectory: string },
                          bucket?: string,
                          pageSize?: number,
                          readURL: string }

const METADATA_DIRNAME = '.gaia-metadata'


class DiskDriver implements DriverModel {
  storageRootDirectory: string
  readURL: string
  pageSize: number


  static getConfigInformation() {
    const envVars = {}
    if (process.env['GAIA_DISK_STORAGE_ROOT_DIR']) {
      const diskSettings = { storageRootDirectory: process.env['GAIA_DISK_STORAGE_ROOT_DIR'] }
      envVars['diskSettings'] = diskSettings
    }

    return {
      defaults: { diskSettings: { storageRootDirectory: undefined } },
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
    if (this.readURL.slice(-1) !== '/') {
      // must end in /
      this.readURL = `${this.readURL}/`
    }

    this.pageSize = config.pageSize ? config.pageSize : 100
    fs.ensureDirSync(this.storageRootDirectory)
  }

  ensureInitialized() {
    return Promise.resolve()
  }

  dispose() {
    return Promise.resolve()
  }

  static isPathValid(path: string){
    if (path.indexOf('..') !== -1) {
      return false
    }
    if (path.slice(-1) === '/') {
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
      const wasCreated = await fs.ensureDir(normalizedPath)
      if (wasCreated) {
        logger.debug(`mkdir ${normalizedPath}`)
      }
    } catch (error) {
      logger.error(`Error ensuring directory exists: ${error}`)
      throw error
    }
  }

  async findAllFiles(listPath: string) : Promise<string[]> {
    // returns a list of files prefixed by listPath
    const dirEntries: fs.Dirent[] = await fs.readdir(listPath, { withFileTypes: true })
    const fileNames = []
    for (const dirEntry of dirEntries) {
      const fileOrDir = `${listPath}${Path.sep}${dirEntry.name}`
      if (dirEntry.isDirectory()) {
        const childNames = await this.findAllFiles(fileOrDir)
        fileNames.push(...childNames)
      } else {
        fileNames.push(Path.posix.normalize(fileOrDir))
      }
    }
    return fileNames
  }

  async listFilesInDirectory(listPath: string, pageNum: number) : Promise<ListFilesResult> {
    const files = await this.findAllFiles(listPath)
    const names = files.map(fileName => fileName.slice(listPath.length + 1))
    const entries = names.slice(pageNum * this.pageSize, (pageNum + 1) * this.pageSize)
    const page = entries.length === names.length ? null : `${pageNum + 1}`
    return {
      entries,
      page
    }
  }

  async listFiles(prefix: string, page: ?string) {
    // returns {'entries': [...], 'page': next_page}
    let pageNum
    const listPath = Path.normalize(`${this.storageRootDirectory}/${prefix}`)
    const emptyResponse : ListFilesResult = {
      entries: [],
      page: null
    }

    if (!(await fs.exists(listPath))) {
      // nope 
      return emptyResponse
    }
      
    try {
      if (page) {
        if (!page.match(/^[0-9]+$/)) {
          throw new Error('Invalid page number')
        }
        pageNum = parseInt(page)
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

    return await this.listFilesInDirectory(listPath, pageNum)
  }

  async performWrite(args: PerformWriteArgs): Promise<string> {

      const path = args.path
      const topLevelDir = args.storageTopLevel
      const contentType = args.contentType

      if (!topLevelDir) {
        throw new BadPathError('Invalid Path')
      }

      if (contentType && contentType.length > 1024) {
        // no way this is valid 
        throw new InvalidInputError('Invalid content-type')
      }

      if (!DiskDriver.isPathValid(path) || !DiskDriver.isPathValid(topLevelDir)) {
        throw new BadPathError('Invalid Path')
      }

      const abspath = Path.join(this.storageRootDirectory, topLevelDir, path)

      // too long?
      if (abspath.length > 4096) {
        throw new BadPathError('Path is too long')
      }

      const dirparts = abspath.split(Path.sep).filter((p) => p.length > 0)

      // can't be too deep
      if (dirparts.length > 100) {
        throw new BadPathError('Path is too deep')
      }

      const absdirname = Path.dirname(abspath)
      await this.mkdirs(absdirname)

      const writePipe = fs.createWriteStream(abspath, { mode: 0o600, flags: 'w' })
      await pipeline(args.stream, writePipe)

      // remember content type in $storageRootDir/.gaia-metadata/$address/$path
      // (i.e. these files are outside the address bucket, and are thus hidden)
      const contentTypePath = Path.join(
        this.storageRootDirectory, METADATA_DIRNAME, topLevelDir, path)

      const contentTypeDirPath = Path.dirname(contentTypePath)
      await this.mkdirs(contentTypeDirPath)
      await fs.writeFile(contentTypePath, 
        JSON.stringify({ 'content-type': contentType }), { mode: 0o600 })

      return `${this.readURL}${topLevelDir}/${path}`
      
  }
}

(DiskDriver: DriverStatics)

export default DiskDriver

