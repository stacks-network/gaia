import { ReaderConfigInterface } from './config.js'
import { DriverModel } from './driverModel'
import { Readable } from 'stream'

export type GetFileInfo = {
  exists: boolean;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
  fileReadStream?: Readable;
}

export class ReaderServer {
  driver: DriverModel
  config: ReaderConfigInterface

  constructor(driver: DriverModel, config: ReaderConfigInterface) {
    this.driver = driver
    this.config = config
  }

  async handleGet(topLevelDir: string, filename: string): Promise<GetFileInfo> {
    const statResult = await this.driver.performStat({
      path: filename,
      storageTopLevel: topLevelDir
    })

    if (statResult.exists) {
      const result = await this.driver.performRead({
        path: filename,
        storageTopLevel: topLevelDir
      })

      return { ...result }
    } else {
      return {
        exists: false
      }
    }
  }
}
