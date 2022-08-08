import path from 'path'
import fs from 'fs-extra'
import { ReaderConfigInterface } from './config.js'
import { DriverModel } from "./driverModel";

const METADATA_DIRNAME = '.gaia-metadata'

export type GetFileInfo = { 
  exists: boolean; 
  contentType?: string;
  contentLength?: number;
  etag?: string; 
  lastModified?: Date;
  fileReadStream?: fs.ReadStream;
}

export class GaiaDiskReader {

  config: ReaderConfigInterface

  constructor(config: ReaderConfigInterface) {
    this.config = config

    // Ensure the configured storage directory exists
    fs.ensureDirSync(config.diskSettings.storageRootDirectory)

  }

  isPathValid(path: string){
    // for now, only disallow double dots.
    return !path.includes('..')
  }

  async handleGet(topLevelDir: string, filename: string, openFileStream: boolean): Promise<GetFileInfo> {
    const storageRoot = this.config.diskSettings.storageRootDirectory
    if (!storageRoot) {
      throw new Error('Misconfiguration: no storage root set')
    }

    if (!this.isPathValid(filename)) {
      throw new Error('Invalid file name')
    }

    const filePath = path.join(storageRoot, topLevelDir, filename)
    let stat: fs.Stats
    try {
      stat = await fs.stat(filePath)
    } catch (e) {
      return { exists: false }
    }

    let readStream: fs.ReadStream
    try {
      const metadataPath = path.join(storageRoot, METADATA_DIRNAME, topLevelDir, filename)
      let metadata: {'content-type'?: string, 'etag'?: string} = { }
      try {
        metadata = await fs.readJson(metadataPath)
      } catch (error) {
        metadata['content-type'] = 'application/octet-stream'
      }
      if (openFileStream) {
        readStream = fs.createReadStream(filePath)
      }
      return {
        exists: true, 
        lastModified: stat.mtime, 
        contentLength: stat.size, 
        contentType: metadata['content-type'], 
        etag: metadata['etag'],
        fileReadStream: readStream
      }
    } catch (error) {
      if (readStream) {
        readStream.close()
      }
      throw error
    }
  }
}

export class ReaderServer {
  driver: DriverModel
  config: ReaderConfigInterface

  constructor(driver: DriverModel, config: ReaderConfigInterface) {
    this.driver = driver
    this.config = config
  }

  async handleGet(topLevelDir: string, filename: string, openFileStream: boolean): Promise<GetFileInfo> {
    const statResult = await this.driver.performStat({
      path: filename,
      storageTopLevel: topLevelDir
    })
  }
}
