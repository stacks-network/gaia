/* @flow */

import Path from 'path'
import fs from 'fs'

const METADATA_DIRNAME = '.gaia-metadata'

export class GaiaDiskReader {

  constructor(config: Object) {
    this.config = config
  }

  handleGet(topLevelDir: string, filename: string) : Promise<*> {
    const storageRoot = this.config.diskSettings.storageRootDirectory
    if (!storageRoot) {
      throw new Error('Misconfiguration: no storage root set')
    }

    const filePath = Path.join(storageRoot, topLevelDir, filename)
    try {
      fs.statSync(filePath)
    } catch (e) {
      const ret = { exist: false, contentType: undefined }
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
