/* @flow */

import { readStream } from '../../../src/server/utils'
import { Server } from 'http'
import express from 'express'
import type { DriverModel, ListFilesResult, PerformWriteArgs } from '../../../src/server/driverModel'

export class InMemoryDriver implements DriverModel {

    app: express.Application
    server: Server;
    readUrl: string
    files: Map<string, {content: Buffer, contentType: string}>
    lastWrite: PerformWriteArgs

    constructor() {
      this.files = new Map<string, {content: Buffer, contentType: string}>()
      this.app = express()
      this.app.use((req, res, next) => {
        const requestPath = req.path.slice(1)
        const matchingFile = this.files.get(requestPath)
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
      this.lastWrite = args
      const contentBuffer = await readStream(args.stream, args.contentLength)
      this.files.set(`${args.storageTopLevel}/${args.path}`, {
        content: contentBuffer,
        contentType: args.contentType
      })
      const resultUrl = `${this.readUrl}${args.storageTopLevel}/${args.path}`
      return resultUrl
    }
    listFiles(storageTopLevel: string, page: ?string): Promise<ListFilesResult> {
      const matchingEntries = Array.from(this.files.keys())
        .filter(path => path.startsWith(storageTopLevel))
        .map(path => path.slice(storageTopLevel.length + 1))
      return Promise.resolve({entries: matchingEntries, page: page})
    }
    dispose() {
      this.server.close()
    }
  }
