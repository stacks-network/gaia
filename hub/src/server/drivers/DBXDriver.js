/* @flow */

import type {DriverModel} from '../driverModel'
import {Dropbox} from 'dropbox'
import {Readable} from 'stream'
import {BadPathError} from '../errors'
import logger from 'winston'

type DBX_CONFIG_TYPE = {
  accessToken: string,
  storageRootDirectory: string,
  readURL?: string
}

class DBXDriver implements DriverModel {
  dbx: Dropbox
  storageRootDirectory: ?string
  readURL: string

  constructor(config: DBX_CONFIG_TYPE) {
    const {accessToken, storageRootDirectory} = config.dropbox
    this.dbx = new Dropbox({accessToken})

    if (!accessToken) {
      throw new Error('Config is missing accessToken')
    }

    if (storageRootDirectory) {
      if (DBXDriver.isPathValid(storageRootDirectory)) {
        throw new BadPathError('Invalid Path')
      }

      this.storageRootDirectory = storageRootDirectory

      if (!this.storageRootDirectory.startsWith('/')) {
        this.storageRootDirectory = `/${this.storageRootDirectory}`
      }
    } else {
      this.storageRootDirectory = '/'
    }

    this.readURL = config.readURL
  }

  static isPathValid(path: string) {
    if (path.indexOf('..') !== -1) {
      return false
    }
    return path.slice(-1) === '/'
  }

  getReadURLPrefix(): string {
    return `http://${this.readURL}/read/`
  }

  performRead(args: {
    path: string,
    storageTopLevel: string
  }): Promise<Buffer> {
    const {path, storageTopLevel} = args
    const filePath = `${this.storageRootDirectory}/${storageTopLevel}/${path}`

    return new Promise((resolve, reject) => {
      this.dbx.filesDownload({path: filePath}).then(file => {
        return resolve(file.fileBinary)
      }).catch(error => {
        return reject(
          new Error('Dropbox storage failure: failed to read file ' +
            `${path} in ${filePath}: ${JSON.stringify(error)}`))
      })
    })
  }

  performWrite(args: {
    path: string,
    storageTopLevel: string,
    stream: Readable,
    contentLength: number,
    contentType: string
  }): Promise<string> {
    const {stream, path, storageTopLevel} = args
    const directoryPath = `${this.storageRootDirectory}/${storageTopLevel}/${path}`

    return new Promise((resolve, reject) => {
      const dbxParams = {
        contents: stream,
        path: directoryPath,
        mode: 'overwrite'
      }

      // TODO (djs): copy-paste from documentation:
      // Do not use this to upload a file larger than 150 MB.
      // Instead, create an upload session with uploadSessionStart().
      this.dbx.filesUpload(dbxParams).then(response => {
        logger.debug(
          `dropbox: stored file ${response.name} into ${response.path_display}`)
        return resolve(this.getReadURLPrefix() + `${storageTopLevel}/${path}`)
      }).catch(err => {
        return reject(
          new Error('Dropbox storage failure: failed to store file ' +
            `${path} in ${directoryPath}: ${JSON.stringify(err)}`))
      })
    })
  }
}

module.exports = DBXDriver

