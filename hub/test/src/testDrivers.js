/* @flow */
import test from 'tape-promise/tape'
import proxyquire from 'proxyquire'
import FetchMock from 'fetch-mock'
import * as NodeFetch from 'node-fetch'

import fs from 'fs'
import path from 'path'
import os from 'os'

import { Readable, Writable } from 'stream'
import { InMemoryDriver } from './testDrivers/InMemoryDriver'
import { DriverModel } from '../../src/server/driverModel'
import type { ListFilesResult } from '../../src/server/driverModel'

import DiskDriver from '../../src/server/drivers/diskDriver'

import * as mockTestDrivers from './testDrivers/mockTestDrivers'
import * as integrationTestDrivers from './testDrivers/integrationTestDrivers'

export function addMockFetches(fetchLib: any, prefix: any, dataMap: any) {
  dataMap.forEach( item => {
    fetchLib.get(`${prefix}${item.key}`, item.data)
  })
}


function testDriver(testName: string, mockTest: boolean, dataMap: [], createDriver: () => DriverModel) {

  test(testName, async (t) => {
    const driver = createDriver()
    try {
      await driver.ensureInitialized()
      const prefix = driver.getReadURLPrefix()

      const sampleData = new Buffer('hello world')
      const sampleDataStream = new Readable()
      sampleDataStream.push(sampleData)
      sampleDataStream.push(null)

      const fetch = mockTest ? FetchMock.sandbox(NodeFetch) : NodeFetch;
      const writeArgs : any = { path: '../foo.js'}

      try {
        await driver.performWrite(writeArgs)
        t.ok(false, 'Should have thrown')
      }
      catch (err) {
        t.equal(err.message, 'Invalid Path', 'Should throw bad path')
      }
      
      const readUrl = await driver.performWrite({
        path: 'foo.txt',
        storageTopLevel: '12345',
        stream: sampleDataStream,
        contentType: 'application/octet-stream',
        contentLength: sampleData.byteLength
      });
      t.ok(readUrl.startsWith(prefix + '12345'), `${readUrl} must start with readUrlPrefix ${prefix}12345`)

      if (mockTest) {
        addMockFetches(fetch, prefix, dataMap)
      }

      const resp = await fetch(readUrl)
      const resptxt = await resp.text()
      t.equal(resptxt, 'hello world', `Must get back hello world: got back: ${resptxt}`)

      const files = await driver.listFiles('12345')
      t.equal(files.entries.length, 1, 'Should return one file')
      t.equal(files.entries[0], 'foo.txt', 'Should be foo.txt!')

      if (mockTest) {
        fetch.restore()
      }
    }
    finally {
      await driver.dispose();
    }

  });
}

function testMockCloudDrivers() {
  for (const name in mockTestDrivers.availableMockedDrivers) {
    const testName = `mock test for driver: ${name}`
    const mockTest = true
    const { driverClass, dataMap, config } = mockTestDrivers.availableMockedDrivers[name]();
    testDriver(testName, mockTest, dataMap, () => new driverClass(config))
  }
}

function testRealCloudDrivers() {
  for (const name in integrationTestDrivers.availableDrivers) {
    const create = integrationTestDrivers.availableDrivers[name];
    const testName = `integration test for driver: ${name}`
    const mockTest = false
    testDriver(testName, mockTest, [], () => create())
  }
}

/*
 * To run this test, you should run an HTTP server on localhost:4000
 * and use the ../config.sample.disk.json config file.
 */
function testDiskDriver() {
  const config = integrationTestDrivers.driverConfigs.disk
  if (!config) {
    return
  }
  const DiskDriver: any = require('../../src/server/drivers/diskDriver')

  test('diskDriver', (t) => {
    t.plan(5)
    const driver = new DiskDriver(config)
    const prefix = driver.getReadURLPrefix()
    const storageDir = driver.storageRootDirectory
    const s = new Readable()
    s.push('hello world')
    s.push(null)

    const writeArgs : any = { path: '../foo.js'}
    driver.performWrite(writeArgs)
      .then(() => t.ok(false, 'Should have thrown'))
      .catch((err) => t.equal(err.message, 'Invalid Path', 'Should throw bad path'))
      .then(() => driver.performWrite(
        { path: 'foo/bar.txt',
          storageTopLevel: '12345',
          stream: s,
          contentType: 'application/octet-stream',
          contentLength: 12 }))
      .then((readUrl) => {
        const metadataPath = path.join(storageDir, '.gaia-metadata', '12345', 'foo/bar.txt')
        t.ok(readUrl.startsWith(prefix + '12345'), `${readUrl} must start with readUrlPrefix ${prefix}12345`)
        t.equal(JSON.parse(fs.readFileSync(metadataPath).toString())['content-type'], 'application/octet-stream',
          'Content-type metadata was written')
      })
      .then(() => driver.listFiles('12345'))
      .then((files) => {
        t.equal(files.entries.length, 1, 'Should return one file')
        t.equal(files.entries[0], 'foo/bar.txt', 'Should be foo.txt!')
      })
  })
}

function testInMemoryDriver() {
  test('InMemory Driver', async (t) => {
    const driver = await InMemoryDriver.spawn()
    try {
      const fetch = require('node-fetch')

      const prefix = driver.getReadURLPrefix()
      const getSampleData = () => {
        const contentBuff = Buffer.from('hello world')
        const s = new Readable()
        s.push(contentBuff)
        s.push(null)
        return { stream: s, contentLength: contentBuff.length }
      }

      // Test binary data content-type
      let sampleData = getSampleData();
      let readUrl = await driver.performWrite(
          { path: 'foo.bin',
            storageTopLevel: '12345',
            stream: sampleData.stream,
            contentType: 'application/octet-stream',
            contentLength: sampleData.contentLength })

      t.ok(readUrl.startsWith(prefix + '12345'), `${readUrl} must start with readUrlPrefix ${prefix}12345`)
      let resp = await fetch(readUrl)
      let resptxt = await resp.text()
      t.equal(resp.headers.get('content-type'), 'application/octet-stream', 'Read-end point response should contain correct content-type')
      t.equal(resptxt, 'hello world', `Must get back hello world: got back: ${resptxt}`)
      let files = await driver.listFiles('12345')
      t.equal(files.entries.length, 1, 'Should return one file')
      t.equal(files.entries[0], 'foo.bin', 'Should be foo.bin!')


      // Test a text content-type that has implicit charset set
      sampleData = getSampleData();
      readUrl = await driver.performWrite(
          { path: 'foo.txt',
            storageTopLevel: '12345',
            stream: sampleData.stream,
            contentType: 'text/plain',
            contentLength: sampleData.contentLength })

      t.ok(readUrl.startsWith(prefix + '12345'), `${readUrl} must start with readUrlPrefix ${prefix}12345`)
      resp = await fetch(readUrl)
      t.equal(resp.headers.get('content-type'), 'text/plain; charset=utf-8', 'Read-end point response should contain correct content-type')

    } finally{
      driver.dispose()
    }
  })
}

export function testDrivers() {
  testInMemoryDriver()
  testDiskDriver()
  testMockCloudDrivers()
  testRealCloudDrivers()
}
