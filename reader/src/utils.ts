import { DriverName } from './config.js'
import { DriverConstructor } from './driverModel.js'
import DiskDriver from './drivers/diskDriver.js'
import IpfsDriver from './drivers/IpfsDriver.js'


export function getDriverClass(driver: DriverName): DriverConstructor {
  if (driver === 'disk') {
    return DiskDriver
  } else if (driver === 'ipfs') {
    return IpfsDriver
  } else {
    throw new Error(`Failed to load driver: driver was set to ${driver}`)
  }
}
