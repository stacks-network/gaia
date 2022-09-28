import fs from 'fs-extra'
import Path from 'path'
import { DriverModel, PerformReadArgs, PerformStatArgs, ReadResult, StatResult } from '../driverModel.js'

export interface DISK_CONFIG_TYPE {
  diskSettings: {
    storageRootDirectory?: string
  }
}

class DiskDriver implements DriverModel {
  storageRootDirectory: string
  initPromise: Promise<void>
  METADATA_DIRNAME: string


  constructor (config: DISK_CONFIG_TYPE) {
    if (!config.diskSettings.storageRootDirectory) {
      throw new Error('Config is missing storageRootDirectory')
    }
    this.METADATA_DIRNAME = '.gaia-metadata'

    this.storageRootDirectory = Path.resolve(Path.normalize(config.diskSettings.storageRootDirectory))
    this.initPromise = fs.ensureDir(this.storageRootDirectory)
  }

  isPathValid(path: string) {
    // for now, only disallow double dots.
    return !path.includes('..')
  }

  async performStat(args: PerformStatArgs): Promise<StatResult> {

    if (!this.storageRootDirectory) {
      throw new Error('Misconfiguration: no storage root set')
    }

    if (!this.isPathValid(args.path)) {
      throw new Error('Invalid file name')
    }

    let stat: fs.Stats
    try {
      const filePath = Path.join(this.storageRootDirectory, args.storageTopLevel, args.path)
      stat = await fs.stat(filePath)
      const metadataPath = Path.join(this.storageRootDirectory, this.METADATA_DIRNAME, args.storageTopLevel, args.path)
      let metadata: { 'content-type'?: string, 'etag'?: string } = {}
      try {
        metadata = await fs.readJson(metadataPath)
      } catch (error) {
        metadata['content-type'] = 'application/octet-stream'
      }
      return {
        exists: true,
        lastModifiedDate: new Date(stat.mtime).getTime(),
        etag: metadata['etag'],
        contentLength: stat.size,
        contentType: metadata['content-type']
      }
    } catch (e) {
      return { exists: false }
    }
  }

  async performRead(args: PerformReadArgs): Promise<ReadResult> {
    const stat = await this.performStat(args)
    let readStream: fs.ReadStream
    try {
      const metadataPath = Path.join(this.storageRootDirectory, this.METADATA_DIRNAME, args.storageTopLevel, args.path)
      let metadata: { 'content-type'?: string, 'etag'?: string } = {}
      try {
        metadata = await fs.readJson(metadataPath)
      } catch (error) {
        metadata['content-type'] = 'application/octet-stream'
      }
      const filePath = Path.join(this.storageRootDirectory, args.storageTopLevel, args.path)
      readStream = fs.createReadStream(filePath)
      return {
        exists: true,
        contentLength: stat.contentLength,
        contentType: metadata['content-type'],
        etag: metadata['etag'],
        fileReadStream: readStream,
        lastModified: new Date(stat.lastModifiedDate)
      }
    } catch (error) {
      if (readStream) {
        readStream.close()
      }
      throw error
    }
  }

}

const driver: typeof DiskDriver = DiskDriver
export default driver
