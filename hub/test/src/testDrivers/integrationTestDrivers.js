/* @flow */

import fs from 'fs'
import path from 'path'

import { DriverModel } from '../../../src/server/driverModel'
import AzDriver from '../../../src/server/drivers/AzDriver'
import S3Driver from '../../../src/server/drivers/S3Driver'
import GcDriver from '../../../src/server/drivers/GcDriver'
import DiskDriver from '../../../src/server/drivers/diskDriver'

/**
 * Either a:
 *  - file path to a json file (must end in `.json`)
 *  - json string
 *  - base64 encoded json string
 */
const driverConfigTestData = process.env.DRIVER_CONFIG_TEST_DATA

const envConfigPaths = { 
  az: process.env.AZ_CONFIG_PATH, 
  aws: process.env.AWS_CONFIG_PATH, 
  gc: process.env.GC_CONFIG_PATH, 
  disk: process.env.DISK_CONFIG_PATH 
};

export const driverConfigs = {
  az: undefined,
  aws: undefined,
  gc: undefined,
  disk: undefined
};

if (driverConfigTestData) {
    let jsonStr;
    if (driverConfigTestData.endsWith('.json')) {
        console.log('Using DRIVER_CONFIG_TEST_DATA env var as json file for driver config')
        jsonStr = fs.readFileSync(driverConfigTestData, {encoding: 'utf8'})
    } else if (/^\s*{/.test(driverConfigTestData)) {
        console.log('Using DRIVER_CONFIG_TEST_DATA env var as json blob for driver config')
        jsonStr = driverConfigTestData
    } else {
        console.log('Using DRIVER_CONFIG_TEST_DATA env var as b64 encoded json blob for driver config')
        jsonStr = new Buffer(driverConfigTestData, 'base64').toString('utf8')
    }
    Object.assign(driverConfigs, JSON.parse(jsonStr))
}

Object.entries(envConfigPaths)
  .filter(([key, val]) => val)
  .forEach(([key, val]) => driverConfigs[key] = JSON.parse(fs.readFileSync((val: any), {encoding: 'utf8'})));

  
export const availableDrivers: { [name: string]: (config?: Object) => DriverModel } = { 
  az: config => new AzDriver({...driverConfigs.az, ...config}),
  aws: config => new S3Driver({...driverConfigs.aws, ...config}),
  gc: config => new GcDriver({...driverConfigs.gc, ...config}),
  disk: config => new DiskDriver({...driverConfigs.disk, ...config})
};


// Delete from available drivers where there is no provided config
for (const key of Object.keys(availableDrivers)) {
  if (!driverConfigs[key]) {
    delete availableDrivers[key];
  }
}
