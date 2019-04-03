

import fs from 'fs'
import os from 'os'
import path from 'path'
import http from 'http'
import express from 'express'

import { DriverModel, DriverConstructor } from '../../../src/server/driverModel'
import AzDriver from '../../../src/server/drivers/AzDriver'
import S3Driver from '../../../src/server/drivers/S3Driver'
import GcDriver from '../../../src/server/drivers/GcDriver'
import DiskDriver from '../../../src/server/drivers/diskDriver'
import InMemoryDriver from './InMemoryDriver'
import * as gaiaReader from '../../../../reader/src/http'

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
  .forEach(([key, val]) => driverConfigs[key] = JSON.parse(fs.readFileSync(val, {encoding: 'utf8'})));


export const availableDrivers: { [name: string]: { class: DriverConstructor, create: (config?: Object) => DriverModel } } = { 
  az: {
    class: AzDriver,
    create: config => new AzDriver({...driverConfigs.az, ...config}) 
  },
  aws: { 
    class: S3Driver,
    create: config => new S3Driver({...driverConfigs.aws, ...config}) 
  },
  gc: { 
    class: GcDriver,
    create: config => new GcDriver({resumable: true, ...driverConfigs.gc, ...config}) 
  },
  disk: { 
    class: DiskDriver,
    create: config => new DiskDriver({...driverConfigs.disk, ...config})
  }
};


// Delete from available drivers where there is no provided config
for (const key of Object.keys(availableDrivers)) {
  if (!driverConfigs[key]) {
    delete availableDrivers[key];
  }
}

// Add integration test for DiskDriver (hard-coded; does not require external config)
availableDrivers.diskSelfHosted = {
  class: DiskDriver,
  create: config => {
    const tmpStorageDir = path.resolve(os.tmpdir(), `disktest-${Date.now()-Math.random()}`)
    fs.mkdirSync(tmpStorageDir)
    const selfHostedConfig  = {
      bucket: "spokes", 
      readURL: "not yet initialized",
      diskSettings: {
        storageRootDirectory: tmpStorageDir
      },
      ...config
    };

    const app = gaiaReader.makeHttpServer(<any>selfHostedConfig);
    const serverPromise = new Promise<http.Server>((res, rej) => {
      const server = app.listen(0, 'localhost', err => err ? rej(err) : res(server));
    });

    return new class SelfHostedDiskDriver extends DiskDriver { 
      async ensureInitialized() {
        // Start the gaia-reader server when driver is initialized.
        await super.ensureInitialized();
        const server = await serverPromise;
        const addrInfo: any = server.address();
        this.readURL = selfHostedConfig.readURL = `http://localhost:${addrInfo.port}/`;
      }
      async dispose() {
        await super.dispose();
        const server = await serverPromise;
        await new Promise((res, rej) => server.close(err => err ? rej(err): res()));
      }
    }(selfHostedConfig);
  }
};


// Add integration test for InMemoryDriver (hard-coded; does not require external config)
availableDrivers.inMemoryDriver = {
  class: InMemoryDriver,
  create: config => {
    return new InMemoryDriver({ ...config });
  }
}
