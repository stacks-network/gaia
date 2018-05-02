/* @flow */
import fs from 'fs'
import { BadPathError } from '../errors'
import logger from 'winston'
import Path from 'path'

import type { DriverModel } from '../driverModel'
import type { Readable } from 'stream'

type DISK_CONFIG_TYPE = { diskSettings: { storageRootDirectory?: string },
                          readURL?: string }

class DiskDriver implements DriverModel {
  storageRootDirectory: string
  readURL: string

  constructor (config: DISK_CONFIG_TYPE) {
    if (!config.readURL) {
      throw new Error('Config is missing readURL')
    }
    if (!config.diskSettings.storageRootDirectory) {
      throw new Error('Config is missing storageRootDirectory')
    }

    this.storageRootDirectory = config.diskSettings.storageRootDirectory
    this.readURL = config.readURL
    if (this.readURL.slice(-1) !== '/') {
      // must end in /
      this.readURL = `${this.readURL}/`
    }

    this.mkdirs(this.storageRootDirectory)
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

  mkdirs(path: string) {
    const pathParts = path.replace(/^\//, '').split('/')
    let tmpPath = '/'
    for (let i = 0; i <= pathParts.length; i++) {
      try {
        const statInfo = fs.lstatSync(tmpPath)
        if ((statInfo.mode & fs.constants.S_IFDIR) === 0) {
          throw new Error(`Not a directory: ${tmpPath}`)
        }
      }
      catch (e) {
        if (e.code === 'ENOENT') {
          // need to create
          logger.debug(`mkdir ${tmpPath}`)
          fs.mkdirSync(tmpPath)
        }
        else {
          throw e
        }
      }
      if (i === pathParts.length) {
        break
      }
      tmpPath = `${tmpPath}/${pathParts[i]}`
    }
  }

  performWrite(args: { path: string,
                       storageTopLevel: string,
                       stream: Readable,
                       contentLength: number,
                       contentType: string }) : Promise<string> {
    return Promise.resolve()
    .then(() => {
      const path = args.path
      const topLevelDir = args.storageTopLevel

      if (!topLevelDir) {
        throw new BadPathError('Invalid Path')
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
      this.mkdirs(absdirname)

      const writePipe = fs.createWriteStream(abspath, { mode: 0o600, flags: 'w' })
      args.stream.pipe(writePipe)

      return `${this.readURL}${Path.join(topLevelDir, path)}`
    })
  }
}

module.exports = DiskDriver

