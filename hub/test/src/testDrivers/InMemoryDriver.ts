

import { readStream } from '../../../src/server/utils'
import { Server } from 'http'
import express from 'express'
import { DriverModel, DriverStatics, PerformDeleteArgs, PerformRenameArgs, PerformStatArgs, StatResult, PerformReadArgs, ReadResult } from '../../../src/server/driverModel'
import { ListFilesResult, PerformWriteArgs } from '../../../src/server/driverModel'
import { BadPathError, InvalidInputError, DoesNotExist, ConflictError } from '../../../src/server/errors'
import { PassThrough } from 'stream';

export class InMemoryDriver implements DriverModel {

  app: express.Application
  server: Server;
  pageSize: number
  readUrl: string
  files: Map<string, { content: Buffer, contentType: string, lastModified: Date }>
  filesInProgress: Map<string, object> = new Map<string, object>()
  lastWrite: PerformWriteArgs
  initPromise: Promise<void>

  onWriteMiddleware: Set<((PerformWriteArgs) => Promise<void>)> = new Set()

  constructor(config: any) {
    this.pageSize = (config && config.pageSize) ? config.pageSize : 100
    this.files = new Map<string, { content: Buffer, contentType: string, lastModified: Date }>()
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

    for (const middleware of this.onWriteMiddleware) {
      await middleware(args)
    }

    // cancel write and return 402 if path is invalid
    if (!InMemoryDriver.isPathValid(args.path)) {
      throw new BadPathError('Invalid Path')
    }
    if (args.contentType.length > 1024) {
      throw new InvalidInputError('Invalid content-type')
    }
    this.lastWrite = args
    const filePath = `${args.storageTopLevel}/${args.path}`
    if (this.filesInProgress.has(filePath)) {
      throw new ConflictError('Concurrent writes to same file')
    }
    this.filesInProgress.set(filePath, null)
    const contentBuffer = await readStream(args.stream)
    this.filesInProgress.delete(filePath)
    this.files.set(filePath, {
      content: contentBuffer,
      contentType: args.contentType,
      lastModified: new Date()
    })
    const resultUrl = `${this.readUrl}${args.storageTopLevel}/${args.path}`
    return resultUrl
  }

  performDelete(args: PerformDeleteArgs): Promise<void> {
    return Promise.resolve().then(() => {
      if (!InMemoryDriver.isPathValid(args.path)) {
        throw new BadPathError('Invalid Path')
      }
      if (!this.files.has(`${args.storageTopLevel}/${args.path}`)) {
        throw new DoesNotExist('File does not exist')
      }
      this.files.delete(`${args.storageTopLevel}/${args.path}`)
    })
  }

  performRead(args: PerformReadArgs): Promise<ReadResult> {
    return Promise.resolve().then(() => {
      if (!InMemoryDriver.isPathValid(args.path)) {
        throw new BadPathError('Invalid Path')
      }
      if (!this.files.has(`${args.storageTopLevel}/${args.path}`)) {
        throw new DoesNotExist('File does not exist')
      }
      const file = this.files.get(`${args.storageTopLevel}/${args.path}`)
      const lastModified = Math.round(file.lastModified.getTime() / 1000)

      const dataStream = new PassThrough()
      dataStream.end(file.content)

      const result: ReadResult = {
        exists: true,
        contentLength: file.content.byteLength,
        contentType: file.contentType,
        lastModifiedDate: lastModified,
        data: dataStream
      }
      return result;
    })
  }

  performStat(args: PerformStatArgs): Promise<StatResult> {
    return Promise.resolve().then(() => {
      if (!InMemoryDriver.isPathValid(args.path)) {
        throw new BadPathError('Invalid Path')
      }
      if (!this.files.has(`${args.storageTopLevel}/${args.path}`)) {
        const result: StatResult = {
          exists: false
        }
        return result
      } else {
        const file = this.files.get(`${args.storageTopLevel}/${args.path}`)
        const lastModified = Math.round(file.lastModified.getTime() / 1000)
        const result: StatResult = {
          exists: true,
          contentLength: file.content.byteLength,
          contentType: file.contentType,
          lastModifiedDate: lastModified
        }
        return result;
      }
    })
  }

  performRename(args: PerformRenameArgs): Promise<void> {
    return Promise.resolve().then(() => {
      if (!InMemoryDriver.isPathValid(args.path)) {
        throw new BadPathError('Invalid original path')
      }
      if (!InMemoryDriver.isPathValid(args.newPath)) {
        throw new BadPathError('Invalid new path')
      }
      if (!this.files.has(`${args.storageTopLevel}/${args.path}`)) {
        throw new DoesNotExist('File does not exist')
      }
      const entry = this.files.get(`${args.storageTopLevel}/${args.path}`)
      this.files.set(`${args.newStorageTopLevel}/${args.newPath}`, entry)
      this.files.delete(`${args.storageTopLevel}/${args.path}`)
    })
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
