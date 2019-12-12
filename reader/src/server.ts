import * as path from 'path'
import * as fs from 'fs-extra'
import { promisify } from 'util'
import { pipeline } from 'stream'
import { createHash } from 'crypto'
import { DiskReaderConfig } from './config'

const pipelineAsync = promisify(pipeline)

const METADATA_DIRNAME = '.gaia-metadata'

export type GetFileInfo = { 
  exists: boolean; 
  contentType?: string;
  contentLength?: number;
  etag?: string; 
  lastModified?: Date;
  fileReadStream?: fs.ReadStream;
}

async function getFileMd5(filePath: string): Promise<string> {
  const hash = createHash('md5')
  let md5Hex = ''
  hash.on('readable', () => {
    const data = hash.read() as Buffer
    if (data) {
      md5Hex += data.toString('hex')
    }
  })
  await pipelineAsync(fs.createReadStream(filePath), hash)
  hash.end()
  return md5Hex
}

export class GaiaDiskReader {

  config: DiskReaderConfig

  constructor(config: DiskReaderConfig) {
    this.config = config

    // Ensure the configured storage directory exists
    fs.ensureDirSync(config.diskSettings.storageRootDirectory)

  }

  isPathValid(path: string){
    // for now, only disallow double dots.
    return !path.includes('..')
  }

  async handleGet(topLevelDir: string, filename: string, openRead: boolean): Promise<GetFileInfo> {
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
      if (!metadata['etag']) {
        metadata['etag'] = await getFileMd5(filePath)
        try {
          fs.writeJsonSync(filePath, metadata, {})
        } catch (error) {
          console.error(error)
          console.error(`Error creating md5 etag metadata for file ${filePath}`)
        }
      }
      if (openRead) {
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
