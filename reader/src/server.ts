import Path from 'path'
import fs from 'fs-extra'
import { DiskReaderConfig } from './config'

const METADATA_DIRNAME = '.gaia-metadata'

export class GaiaDiskReader {

  config: DiskReaderConfig

  constructor(config: DiskReaderConfig) {
    this.config = config

    // Ensure the configured storage directory exists
    fs.ensureDirSync(config.diskSettings.storageRootDirectory)

  }

  isPathValid(path: string){
    // for now, only disallow double dots.
    return (path.indexOf('..') === -1)
  }

  handleGet(topLevelDir: string, filename: string): Promise<{ exists: boolean, contentType?: string }> {
    const storageRoot = this.config.diskSettings.storageRootDirectory
    if (!storageRoot) {
      throw new Error('Misconfiguration: no storage root set')
    }

    if (!this.isPathValid(filename)) {
      throw new Error('Invalid file name')
    }

    const filePath = Path.join(storageRoot, topLevelDir, filename)
    try {
      fs.statSync(filePath)
    } catch (e) {
      const ret = { exists: false, contentType: <string>undefined }
      return Promise.resolve().then(() => ret)
    }

    const metadataPath = Path.join(storageRoot, METADATA_DIRNAME, topLevelDir, filename)
    try {
      const metadataJSON = fs.readFileSync(metadataPath).toString()
      const metadata = JSON.parse(metadataJSON)
      const ret = { exists: true, contentType: metadata['content-type'] }
      return Promise.resolve().then(() => ret)
    } catch (e) {
      const ret = { exists: true, contentType: 'application/octet-stream' }
      return Promise.resolve().then(() => ret)
    }
  }
}
