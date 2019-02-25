/* @flow */
import fs from 'fs-extra'
import stream from 'stream'
import { promisify } from 'util'
import { BadPathError, InvalidInputError } from '../errors'
import logger from 'winston'
import Path from 'path'
import type { ListFilesResult, PerformWriteArgs } from '../driverModel'
import { DriverStatics, DriverModel } from '../driverModel'

type DISK_CONFIG_TYPE = { diskSettings: { storageRootDirectory?: string },
                          bucket?: string,
                          pageSize?: number,
                          readURL?: string }

const METADATA_DIRNAME = '.gaia-metadata'

// Flow sucks. It is unaware of this Node.js API (stream.pipeline)
const pipelinePromise = promisify((stream: any).pipeline)

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

    this.storageRootDirectory = config.diskSettings.storageRootDirectory
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

  findAllFiles(listPath: string) : Array<string> {
    // returns a list of files prefixed by listPath
    const names = fs.readdirSync(listPath)
    const fileNames = []
    for (let i = 0; i < names.length; i++) {
      const fileOrDir = `${listPath}/${names[i]}`
      const stat = fs.statSync(fileOrDir)
      if (stat.isDirectory()) {
        const childNames = this.findAllFiles(fileOrDir)
        for (let j = 0; j < childNames.length; j++) {
          fileNames.push(childNames[j])
        }
      } else {
        fileNames.push(fileOrDir)
      }
    }
    return fileNames
  }

  listFilesInDirectory(listPath: string, pageNum: number) : Promise<ListFilesResult> {
    const names = this.findAllFiles(listPath).map(
      (fileName) => fileName.slice(listPath.length + 1))
    return Promise.resolve().then(() => ({
      entries: names.slice(pageNum * this.pageSize, (pageNum + 1) * this.pageSize),
      page: `${pageNum + 1}`
    }))
  }

  listFiles(prefix: string, page: ?string) {
    // returns {'entries': [...], 'page': next_page}
    let pageNum
    const listPath = `${this.storageRootDirectory}/${prefix}`
    const emptyResponse : ListFilesResult = {
      entries: [],
      page: `${page + 1}`
    }

    if (!fs.existsSync(listPath)) {
      // nope 
      return Promise.resolve().then(() => emptyResponse)
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
      const stat = fs.statSync(listPath)
      if (!stat.isDirectory()) {
        // nope 
        return Promise.resolve().then(() => emptyResponse)
      }
    } catch(e) {
      throw new Error('Invalid arguments: invalid page or not a directory')
    }

    return this.listFilesInDirectory(listPath, pageNum)
  }

  async performWrite(args: PerformWriteArgs) : Promise<string> {

      const path = args.path
      const topLevelDir = args.storageTopLevel
      const contentType = args.contentType

      if (!topLevelDir) {
        throw new BadPathError('Invalid Path')
      }

      if (contentType.length > 255) {
        // no way this is valid 
        throw new InvalidInputError('Invalid content-type')
      }

      const abspath = Path.join(this.storageRootDirectory, topLevelDir, path)
      if (!DiskDriver.isPathValid(abspath)) {
        throw new BadPathError('Invalid Path')
      }

      // too long?
      if (abspath.length > 4096) {
        throw new BadPathError('Path is too long')
      }

      const dirparts = abspath.split('/').filter((p) => p.length > 0)

      // can't be too deep
      if (dirparts.length > 100) {
        throw new BadPathError('Path is too deep')
      }

      const absdirname = Path.dirname(abspath)
      await this.mkdirs(absdirname)

      const writePipe = fs.createWriteStream(abspath, { mode: 0o600, flags: 'w' })
      await pipelinePromise(args.stream, writePipe)

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

