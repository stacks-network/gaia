import fs from 'fs-extra'
import Path from 'path'
import { DriverModel, PerformReadArgs, PerformStatArgs, ReadResult, StatResult } from '../driverModel.js'

export interface DISK_CONFIG_TYPE {
  diskSettings: {
    storageRootDirectory?: string
  }
}

class DiskDriver implements DriverModel {
  storageRootDirectory: string
  initPromise: Promise<void>

  constructor (config: DISK_CONFIG_TYPE) {
    if (!config.diskSettings.storageRootDirectory) {
      throw new Error('Config is missing storageRootDirectory')
    }

    this.storageRootDirectory = Path.resolve(Path.normalize(config.diskSettings.storageRootDirectory))
    this.initPromise = fs.ensureDir(this.storageRootDirectory)
  }

  performStat(args: PerformStatArgs): Promise<StatResult> {
    return Promise.resolve(undefined);
  }

  performRead(args: PerformReadArgs): Promise<ReadResult> {
    return Promise.resolve(undefined);
  }

}

const driver: typeof DiskDriver = DiskDriver
export default driver
