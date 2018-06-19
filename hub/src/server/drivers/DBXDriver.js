/* @flow */

import type { DriverModel } from '../driverModel'
import { Dropbox } from 'dropbox'
import { Readable } from 'stream'
import { BadPathError } from '../errors'

type DBX_CONFIG_TYPE = {
  accessToken: string,
  storageRootDirectory: string,
  readURL?: string
}

class DBXDriver implements DriverModel {
  dbx: Dropbox
  overwrite: ?Boolean
  storageRootDirectory: ?string

  constructor (config: DBX_CONFIG_TYPE) {
    const {accessToken, storageRootDirectory, overwrite} = config.dropbox
    this.overwrite = overwrite || false
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

  static isPathValid (path: string) {
    if (path.indexOf('..') !== -1) {
      return false
    }
    return path.slice(-1) !== '/'
  }

  getReadURLPrefix (): string {
    //TODO (djs): check how to return file/content
    return `https://www.dropbox.com/home`
  }

  performWrite (args: {
    path: string,
    storageTopLevel: string,
    stream: Readable,
    contentLength: number,
    contentType: string
  }): Promise<string> {
    const {stream, path, storageTopLevel} = args
    const directoryPath = `${this.storageRootDirectory}${storageTopLevel}/${path}`

    return new Promise((resolve, reject) => {
      const dbxParams = {
        contents: stream,
        path: directoryPath
      }

      if (this.overwrite) {
        dbxParams.mode = 'overwrite'
      } else {
        dbxParams.autorename = true
      }

      // TODO (djs):
      // Do not use this to upload a file larger than 150 MB.
      // Instead, create an upload session with uploadSessionStart().
      this.dbx.filesUpload(dbxParams)
        .then(data => {
          return resolve(data.path_display)
        })
        .catch(err => {
          return reject(new Error('Dropbox storage failure: failed to store file ' +
            `${path} in ${directoryPath}: ${JSON.stringify(err)}`))
        })
    })
  }
}

module.exports = DBXDriver

