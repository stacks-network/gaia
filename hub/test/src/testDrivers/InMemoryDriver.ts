

import { readStream } from '../../../src/server/utils'
import { Server } from 'http'
import express from 'express'
import { DriverModel, DriverStatics } from '../../../src/server/driverModel'
import { ListFilesResult, PerformWriteArgs } from '../../../src/server/driverModel'
import { BadPathError, InvalidInputError } from '../../../src/server/errors'

export class InMemoryDriver implements DriverModel {

  app: express.Application
  server: Server;
  pageSize: number
  readUrl: string
  files: Map<string, { content: Buffer, contentType: string }>
  lastWrite: PerformWriteArgs
  initPromise: Promise<void>

  constructor(config: any) {
    this.pageSize = (config && config.pageSize) ? config.pageSize : 100
    this.files = new Map<string, { content: Buffer, contentType: string }>()
    this.app = express()
    this.app.use((req, res, next) => {
      const requestPath = req.path.slice(1)
      const matchingFile = this.files.get(requestPath)
      if (matchingFile) {
        res.set({
          'Content-Type': matchingFile.contentType,
          'Cache-Control': (config || {}).cacheControl
        }).send(matchingFile.content)
      } else {
        res.status(404).send('Could not return file')
      }
      next()
    })
  }

  static getConfigInformation() {
    return { defaults: {}, envVars: {} }
  }

  static isPathValid(path: string) {
    // for now, only disallow double dots.
    return (path.indexOf('..') === -1)
  }

  ensureInitialized() {
    return this.initPromise || (this.initPromise = this.start())
  }

  static async spawn(): Promise<InMemoryDriver> {
    const driver = new InMemoryDriver(null)
    await driver.start()
    return driver
  }
  start() {
    return new Promise<void>((resolve) => {
      this.server = this.app.listen(0, 'localhost', () => {
        const addrInfo: any = this.server.address();
        this.readUrl = `http://localhost:${addrInfo.port}/`
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
    if (args.contentType.length > 1024) {
      throw new InvalidInputError('Invalid content-type')
    }
    this.lastWrite = args
    const contentBuffer = await readStream(args.stream)
    this.files.set(`${args.storageTopLevel}/${args.path}`, {
      content: contentBuffer,
      contentType: args.contentType
    })
    const resultUrl = `${this.readUrl}${args.storageTopLevel}/${args.path}`
    return resultUrl
  }

  listFiles(storageTopLevel: string, page?: string): Promise<ListFilesResult> {
    if (page && !page.match(/^[0-9]+$/)) {
      throw new Error('Invalid page number')
    }
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
      return new Promise<void>(resolve => {
        this.server.close(() => resolve())
      })
    }
  }
}

const driver: typeof InMemoryDriver & DriverStatics = InMemoryDriver
export default driver
