/* @flow */

import { readStream } from '../../../src/server/utils'
import { Server } from 'http'
import express from 'express'
import type { DriverModel, ListFilesResult, PerformWriteArgs } from '../../../src/server/driverModel'

export class InMemoryDriver implements DriverModel {

    app: express.Application
    server: Server;
    readUrl: string
    files: Array<{path: string, content: Buffer, contentType: string}>
  
    constructor() {
      this.files = []
      this.app = express()
      this.app.use((req, res, next) => {
        const requestPath = req.path.slice(1)
        const matchingFile = this.files.find(file => file.path === requestPath)
        if (matchingFile) {
          res.set('Content-Type', matchingFile.contentType).send(matchingFile.content)
        } else {
          res.status(404).send('Could not return file')
        }
        next()
      })
    }
    static async spawn(): Promise<InMemoryDriver> {
      const driver = new InMemoryDriver()
      await driver.start()
      return driver
    }
    start() {
      return new Promise((resolve) => { 
        this.server = this.app.listen(0, 'localhost', () => {
          this.readUrl = `http://localhost:${this.server.address().port}/`
          resolve()
        })
      })
    }
    getReadURLPrefix() {
      return this.readUrl
    }
    async performWrite(args: PerformWriteArgs) {
      const contentBuffer = await readStream(args.stream, args.contentLength)
      this.files.push({
        path: `${args.storageTopLevel}/${args.path}`,
        content: contentBuffer,
        contentType: args.contentType
      })
      const resultUrl = `${this.readUrl}${args.storageTopLevel}/${args.path}`
      return resultUrl
    }
    listFiles(storageTopLevel: string, page: ?string): Promise<ListFilesResult> {
      const matchingEntries = this.files
        .filter(file => file.path.startsWith(storageTopLevel))
        .map(file => file.path.slice(storageTopLevel.length + 1))
      return Promise.resolve({entries: matchingEntries, page: page})
    }
    dispose() {
      this.server.close()
    }
  }
