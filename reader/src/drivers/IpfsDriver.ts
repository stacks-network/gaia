import { create, IPFSHTTPClient } from 'ipfs-http-client'
import { StatResult as IpfsStatResult } from 'ipfs-core-types/src/files/index.js'
import * as Path from 'path'
import { Readable } from 'stream'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'

import { DriverModel, PerformReadArgs, PerformStatArgs, ReadResult, StatResult } from '../driverModel.js'
import { BadPathError, DoesNotExist } from '../errors.js'


export interface IPFS_CONFIG_TYPE {
  ipfsSettings: {
    apiAddress?: string,
    storageRootDirectory?: string
  }
}

const METADATA_DIRNAME = '.gaia-metadata'

class IpfsDriver implements DriverModel {
  client: IPFSHTTPClient
  storageRootDirectory: string
  readURL: string
  initPromise: Promise<void>

  supportsETagMatching = false

  constructor(config: IPFS_CONFIG_TYPE) {
    if (!config.ipfsSettings.storageRootDirectory) {
      throw new Error('Config is missing storageRootDirectory')
    }
    this.client = create({ url: config.ipfsSettings.apiAddress })
    this.storageRootDirectory = Path.normalize(config.ipfsSettings.storageRootDirectory)
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


  static parseFileStat(stat: IpfsStatResult, metaData: string): StatResult {
    const metaDataJson = JSON.parse(metaData)
    const contentType = metaDataJson['content-type']
    const etag = metaDataJson['etag']
    /*
      need to be resolved.
      There isn't last modified data in the ipfs because it's immutable. Need to be resolve in the feature by adding created date to the metadata
    */
    // const lastModified = stat.mtime.secs
    const lastModified = 0

    const result: StatResult = {
      exists: true,
      etag,
      contentLength: stat.size,
      contentType,
      lastModifiedDate: lastModified
    }
    return result
  }

  getFullFilePathInfo(args: { storageTopLevel: string, path: string }) {
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

  async readMetaDataFile(filePath: string) {
    const chunks = []
    for await (const chunk of this.client.files.read(filePath)) {
      chunks.push(chunk)
    }
    return uint8ArrayConcat(chunks).toString()
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

  async performRead(args: PerformReadArgs): Promise<ReadResult> {
    const { absoluteFilePath, metaDataFilePath } = this.getFullFilePathInfo(args)
    let stat: IpfsStatResult
    try {
      stat = await this.client.files.stat(absoluteFilePath)
    } catch (error) {
      if (error.name === 'HTTPError' && error.message === 'file does not exist') {
        throw new DoesNotExist('File does not exist')
      }
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
      fileReadStream: Readable.from(dataStream),
      lastModified: new Date('1970-01-01')
    }
    return result
  }
}

const driver: typeof IpfsDriver = IpfsDriver
export default driver
