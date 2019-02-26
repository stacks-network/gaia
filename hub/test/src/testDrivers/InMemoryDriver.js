/* @flow */

import { readStream } from '../../../src/server/utils'
import { Server } from 'http'
import express from 'express'
import { DriverModel } from '../../../src/server/driverModel'
import type { ListFilesResult, PerformWriteArgs } from '../../../src/server/driverModel'
import { BadPathError } from '../../../src/server/errors'

export class InMemoryDriver implements DriverModel {

    app: express.Application
    server: Server;
    pageSize: number
    readUrl: string
    files: Map<string, {content: Buffer, contentType: string}>
    lastWrite: PerformWriteArgs
    initPromise: Promise<void>

    constructor(config: any) {
      this.pageSize = (config && config.pageSize) ? config.pageSize : 100
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

    static isPathValid (path: string) {
      // for now, only disallow double dots.
      return (path.indexOf('..') === -1)
    }

    ensureInitialized() {
      return this.initPromise || (this.initPromise = this.start())
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
      // cancel write and return 402 if path is invalid
      if (!InMemoryDriver.isPathValid(args.path)) {
        throw new BadPathError('Invalid Path')
      }
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
      const pageNum = page ? parseInt(page) : 0
      const names = Array.from(this.files.keys())
        .filter(path => path.startsWith(storageTopLevel))
        .map(path => path.slice(storageTopLevel.length + 1))
      const entries = names.slice(pageNum * this.pageSize, (pageNum + 1) * this.pageSize)
      const pageResult = entries.length === names.length ? null : `${pageNum + 1}`
      return Promise.resolve({
        entries,
        page: pageResult
      })
    }

    async dispose() {
      if (this.server) {
        return new Promise(resolve => {
          this.server.close(() => resolve())
        })
      }
    }
  }
