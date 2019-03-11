
import test from 'tape-promise/tape'
import proxyquire from 'proxyquire'
import FetchMock from 'fetch-mock'
import * as NodeFetch from 'node-fetch'

import fs from 'fs'
import path from 'path'
import os from 'os'

import { Readable, Writable } from 'stream'
import { InMemoryDriver } from './testDrivers/InMemoryDriver'
import { DriverModel, DriverModelTestMethods } from '../../src/server/driverModel'
import { ListFilesResult } from '../../src/server/driverModel'

import DiskDriver from '../../src/server/drivers/diskDriver'

import * as mockTestDrivers from './testDrivers/mockTestDrivers'
import * as integrationTestDrivers from './testDrivers/integrationTestDrivers'

export function addMockFetches(fetchLib: any, prefix: any, dataMap: any[]) {
  dataMap.forEach(item => {
    fetchLib.get(`${prefix}${item.key}`, item.data, { overwriteRoutes: true })
  })
}


function testDriver(testName: string, mockTest: boolean, dataMap: any[], createDriver: (config?: Object) => DriverModel) {

  test(testName, async (t) => {
    const topLevelStorage = `${Date.now()}r${Math.random()*1e6|0}`
    const cacheControlOpt = 'no-cache, no-store, must-revalidate'
    const driver = createDriver({
      pageSize: 3,
      cacheControl: cacheControlOpt
    })
    try {
      await driver.ensureInitialized()
      const prefix = driver.getReadURLPrefix()
      const sampleDataString = 'hello world'
      const getSampleData = () => {
        const contentBuff = Buffer.from(sampleDataString)
        const s = new Readable()
        s.push(contentBuff)
        s.push(null)
        return { stream: s, contentLength: contentBuff.length }
      }

      const fetch = mockTest ? (<any>FetchMock.sandbox)(NodeFetch) : NodeFetch;

      try {
        const writeArgs : any = { path: '../foo.js'}
        await driver.performWrite(writeArgs)
        t.fail('Should have thrown')
      }
      catch (err) {
        t.equal(err.message, 'Invalid Path', 'Should throw bad path')
      }

      // Test binary data content-type
      const binFileName = 'somedir/foo.bin';
      let sampleData = getSampleData();
      let readUrl = await driver.performWrite({
        path: binFileName,
        storageTopLevel: topLevelStorage,
        stream: sampleData.stream,
        contentType: 'application/octet-stream',
        contentLength: sampleData.contentLength
      });
      t.ok(readUrl.startsWith(`${prefix}${topLevelStorage}`), `${readUrl} must start with readUrlPrefix ${prefix}${topLevelStorage}`)

      if (mockTest) {
        addMockFetches(fetch, prefix, dataMap)
      }

      let resp = await fetch(readUrl)
      t.ok(resp.ok, 'fetch should return 2xx OK status code')
      let resptxt = await resp.text()
      t.equal(resptxt, sampleDataString, `Must get back ${sampleDataString}: got back: ${resptxt}`)
      if (!mockTest) {
        t.equal(resp.headers.get('content-type'), 'application/octet-stream', 'Read-end point response should contain correct content-type')
        t.equal(resp.headers.get('cache-control'), cacheControlOpt, 'cacheControl not respected in response headers')
      }

      let files = await driver.listFiles(topLevelStorage)
      t.equal(files.entries.length, 1, 'Should return one file')
      t.equal(files.entries[0], binFileName, `Should be ${binFileName}!`)
      t.ok(!files.page, 'list files for 1 result should not have returned a page')

      // Test a text content-type that has implicit charset set
      const txtFileName = 'somedir/foo_text.txt';
      sampleData = getSampleData();
      readUrl = await driver.performWrite(
          { path: txtFileName,
            storageTopLevel: topLevelStorage,
            stream: sampleData.stream,
            contentType: 'text/plain; charset=utf-8',
            contentLength: sampleData.contentLength })
      t.ok(readUrl.startsWith(`${prefix}${topLevelStorage}`), `${readUrl} must start with readUrlPrefix ${prefix}${topLevelStorage}`)
      if (mockTest) {
        addMockFetches(fetch, prefix, dataMap)
      }

      resp = await fetch(readUrl)
      t.ok(resp.ok, 'fetch should return 2xx OK status code')
      resptxt = await resp.text()
      t.equal(resptxt, sampleDataString, `Must get back ${sampleDataString}: got back: ${resptxt}`)
      if (!mockTest) {
        t.equal(resp.headers.get('content-type'), 'text/plain; charset=utf-8', 'Read-end point response should contain correct content-type')
      }

      files = await driver.listFiles(topLevelStorage)
      t.equal(files.entries.length, 2, 'Should return two files')
      t.ok(files.entries.includes(txtFileName), `Should include ${txtFileName}`)

      files = await driver.listFiles(`${Date.now()}r${Math.random()*1e6|0}`)
      t.equal(files.entries.length, 0, 'List files for empty directory should return zero entries')

      files = await driver.listFiles(`${topLevelStorage}/${txtFileName}`)
      t.equal(files.entries.length, 1, 'List files on a file rather than directory should return a single entry')
      t.equal(files.entries[0], '', 'List files on a file rather than directory should return a single empty entry')
      t.strictEqual(files.page, null, 'List files page result should be null')

      if (!mockTest) {
        sampleData = getSampleData();
        const bogusContentType = 'x'.repeat(3000)
        try {
          await driver.performWrite(
            { path: 'bogusContentTypeFile',
              storageTopLevel: topLevelStorage,
              stream: sampleData.stream,
              contentType: bogusContentType,
              contentLength: sampleData.contentLength })
          t.fail('Extremely large content-type headers should fail to write')
        } catch (error) {
          t.pass('Extremely large content-type headers should fail to write')
        }
      }

      try {
        const invalidFileName = `../../your_password`;
        let sampleData = getSampleData();
        await driver.performWrite({
          path: invalidFileName,
          storageTopLevel: topLevelStorage,
          stream: sampleData.stream,
          contentType: 'application/octet-stream',
          contentLength: sampleData.contentLength
        });
        t.fail('File write with a filename containing path traversal should have been rejected')
      } catch (error) {
        t.pass('File write with a filename containing path traversal should have been rejected')
      }

      if (!mockTest) {
        const pageTestDir = 'page_test_dir'
        for (var i = 0; i < 5; i++) {
          const binFileName = `${pageTestDir}/foo_${i}.bin`;
          let sampleData = getSampleData();
          await driver.performWrite({
            path: binFileName,
            storageTopLevel: topLevelStorage,
            stream: sampleData.stream,
            contentType: 'application/octet-stream',
            contentLength: sampleData.contentLength
          });
        }
        const pagedFiles = await driver.listFiles(`${topLevelStorage}/${pageTestDir}`)
        t.equal(pagedFiles.entries.length, 3, 'List files with no pagination and maxPage size specified should have returned 3 entries')
        const remainingFiles = await driver.listFiles(`${topLevelStorage}/${pageTestDir}`, pagedFiles.page)
        t.equal(remainingFiles.entries.length, 2, 'List files with pagination should have returned 2 remaining entries')

        try {
          await driver.listFiles(`${topLevelStorage}/${pageTestDir}`, "bogus page data")
          t.fail('List files with invalid page data should have failed')
        } catch (error) {
          t.pass('List files with invalid page data should have failed')
        }

        try {
          const brokenUploadStream = new BrokenReadableStream()
          await driver.performWrite({
            path: 'broken_upload_stream_test',
            storageTopLevel: topLevelStorage,
            stream: brokenUploadStream,
            contentType: 'application/octet-stream',
            contentLength: 100
          });
          t.fail('Perform write with broken upload stream should have failed')
        } catch (error) {
          t.pass('Perform write with broken upload stream should have failed')
        }
        
      }

      if (mockTest) {
        fetch.restore()
      }
    }
    finally {
      await driver.dispose();
    }

  });
}

function testDriverBucketCreation(driverName: string, createDriver: (config?: Object) => DriverModelTestMethods) {

  test(`bucket creation for driver: ${driverName}`, async (t) => {
    const topLevelStorage = `test-buckets-creation${Date.now()}r${Math.random()*1e6|0}`
    const driver = createDriver({ bucket: topLevelStorage })
    try {
      await driver.ensureInitialized()
      t.pass('Successfully initialized driver with creation of a new bucket')
    } catch (error) {
      t.fail(`Could not initialize driver with creation of a new bucket: ${error}`)
    } finally {
      try {
        await driver.deleteEmptyBucket()
      } catch (error) {
        t.fail(`Error trying to cleanup bucket: ${error}`)
      }
      await driver.dispose()
    }
  })
}

/** 
 * Readable stream that simulates an interrupted http upload/POST request.
 * Outputs some data then errors unexpectedly .
 */
class BrokenReadableStream extends Readable {
  readCount: number
  sampleData: Buffer
  constructor(options?: any) {
    super(options)
    this.readCount = 0
    this.sampleData = Buffer.from('hello world sample data')
  }
  _read(size: number): void {
    if (this.readCount === 0) {
      super.push(this.sampleData)
    } else if (this.readCount === 1) {
      // cause the stream to break/error
      super.destroy(new Error('example stream read failure'))
    }
    this.readCount++
  }
}

function performDriverMockTests() {
  for (const name in mockTestDrivers.availableMockedDrivers) {
    const testName = `mock test for driver: ${name}`
    const mockTest = true
    const { driverClass, dataMap, config } = mockTestDrivers.availableMockedDrivers[name]();
    testDriver(testName, mockTest, dataMap, testConfig => new driverClass({...config, ...testConfig}))
  }
}

function performDriverIntegrationTests() {
  for (const name in integrationTestDrivers.availableDrivers) {
    const driverInfo = integrationTestDrivers.availableDrivers[name];
    const testName = `integration test for driver: ${name}`
    const mockTest = false
    testDriver(testName, mockTest, [], testConfig => driverInfo.create(testConfig))
  }
}

function performDriverBucketCreationTests() {
  // Test driver initialization that require the creation of a new bucket,
  // only on configured driver that implement the `deleteEmptyBucket` method
  // so as not to exceed cloud provider max bucket/container limits.
  for (const name in integrationTestDrivers.availableDrivers) {
    const driverInfo = integrationTestDrivers.availableDrivers[name];
    const classPrototype: any = driverInfo.class.prototype
    if (classPrototype.deleteEmptyBucket) {
      testDriverBucketCreation(name, testConfig => <any>driverInfo.create(testConfig)) 
    }
  }
}

export function testDrivers() {
  performDriverMockTests()
  performDriverIntegrationTests()
  performDriverBucketCreationTests()
}
