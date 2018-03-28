import fs from 'fs'
import { BadPathError } from '../errors'
import logger from 'winston'
import Path from 'path'

class DiskDriver {

  constructor (config) {
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

  static isPathValid(path){
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

  mkdirs(path, mode) {
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
          fs.mkdirSync(tmpPath, mode)
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

  performWrite (args) {
    const path = args.path
    const topLevelDir = args.storageTopLevel

    if (!topLevelDir) {
      return Promise.reject(new BadPathError('Invalid Path'))
    }

    const abspath = Path.join(this.storageRootDirectory, topLevelDir, path)
    if (!DiskDriver.isPathValid(abspath)) {
      return Promise.reject(new BadPathError('Invalid Path'))
    }

    // too long?
    if (abspath.length > 4096) {
      return Promise.reject(new BadPathError('Path is too long'))
    }

    const dirparts = abspath.split('/').filter((p) => p.length > 0)

    // can't be too deep
    if (dirparts.length > 100) {
      return Promise.reject(new BadPathError('Path is too deep'))
    }

    const absdirname = Path.dirname(abspath)
    this.mkdirs(absdirname)

    const writePipe = fs.createWriteStream(abspath, { mode: 0o600, flags: 'w' })
    args.stream.pipe(writePipe)

    return new Promise((resolve) => {
      resolve(`${this.readURL}${Path.join(topLevelDir, path)}`)
    })
  }
}

module.exports = DiskDriver

