import { DriverModel, PerformReadArgs, PerformStatArgs, ReadResult, StatResult } from '../driverModel.js'

export interface IPFS_CONFIG_TYPE {
  ipfsSettings: {
    apiAddress?: string,
    storageRootDirectory?: string
  }
}

const METADATA_DIRNAME = '.gaia-metadata'

class IpfsDriver implements DriverModel {
  performStat(args: PerformStatArgs): Promise<StatResult> {
    return Promise.resolve(undefined);
  }

  performRead(args: PerformReadArgs): Promise<ReadResult> {
    return Promise.resolve(undefined);
  }
}

const driver: typeof IpfsDriver = IpfsDriver
export default driver
