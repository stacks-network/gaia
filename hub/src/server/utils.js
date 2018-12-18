/* @flow */

export function getDriverClass(driver: string) {
  if (driver === 'aws') {
    return require('./drivers/S3Driver')
  } else if (driver === 'azure') {
    return require('./drivers/AzDriver')
  } else if (driver === 'disk') {
    return require('./drivers/diskDriver')
  } else if (driver === 'google-cloud') {
    return require('./drivers/GcDriver')
  } else {
    throw new Error(`Failed to load driver: driver was set to ${driver}`)
  }
}

