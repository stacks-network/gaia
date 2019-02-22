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

const azConfigPath = process.env.AZ_CONFIG_PATH
const awsConfigPath = process.env.AWS_CONFIG_PATH
const gcConfigPath = process.env.GC_CONFIG_PATH
const diskConfigPath = process.env.DISK_CONFIG_PATH
const driverConfigTestData = process.env.DRIVER_CONFIG_TEST_DATA

const driverConfigs = (() => {
  const configs = { };
  if (driverConfigTestData) {
    console.log('Using DRIVER_CONFIG_TEST_DATA env var for driver config')
    Object.assign(configs, JSON.parse(new Buffer(driverConfigTestData, 'base64').toString('utf8')))
  }
  const envOpts = { az: azConfigPath, aws: awsConfigPath, gc: gcConfigPath, disk: diskConfigPath };
  for (let key in envOpts) {
    if (envOpts[key])
      configs[key] = JSON.parse(fs.readFileSync(envOpts[key], {encoding: 'utf8'}))
  }
  return configs
})();

export function addMockFetches(fetchLib: any, prefix: any, dataMap: any) {
  dataMap.forEach( item => {
    fetchLib.get(`${prefix}${item.key}`, item.data)
  })
}

function readStream(input, contentLength, callback) {
  var bufs = []
  input.on('data', function(d){ bufs.push(d) });
  input.on('end', function(){
    var buf = Buffer.concat(bufs)
    callback(buf.slice(0, contentLength))
  })
}

export function makeMockedAzureDriver() {
  const dataMap = []
  let bucketName = ''
  const createContainerIfNotExists = function(newBucketName, options, cb) {
    bucketName = newBucketName
    cb()
  }
  const createBlockBlobFromStream = function(putBucket, blobName, streamInput, contentLength, opts, cb) {
    if (bucketName !== putBucket) {
      cb(new Error(`Unexpected bucket name: ${putBucket}. Expected ${bucketName}`))
    }
    readStream(streamInput, contentLength, (buffer) => {
      dataMap.push({ data: buffer.toString(), key: blobName })
      cb()
    })
  }
  const listBlobsSegmentedWithPrefix = function(getBucket, prefix, continuation, data, cb) {
    const outBlobs = []
    dataMap.forEach(x => {
      if (x.key.startsWith(prefix)) {
        outBlobs.push({name: x.key})
      }
    })
    cb(null, {entries: outBlobs, continuationToken: null})
  }

  const createBlobService = function() {
    return { createContainerIfNotExists, createBlockBlobFromStream, listBlobsSegmentedWithPrefix }
  }

  const AzDriver = proxyquire('../../src/server/drivers/AzDriver', {
    'azure-storage': { createBlobService }
  })
  return { AzDriver, dataMap }
}

function makeMockedS3Driver() {
  const dataMap = []
  let bucketName = ''

  const S3Class = class {
    headBucket(options, callback) {
      bucketName = options.Bucket
      callback()
    }
    upload(options, cb) {
      if (options.Bucket != bucketName) {
        cb(new Error(`Unexpected bucket name: ${options.Bucket}. Expected ${bucketName}`))
      }
      readStream(options.Body, 10000, (buffer) => {
        dataMap.push({ data: buffer.toString(), key: options.Key })
        cb()
      })
    }
    listObjectsV2(options, cb) {
      const contents = dataMap
      .filter((entry) => {
        return (entry.key.slice(0, options.Prefix.length) === options.Prefix)
      })
      .map((entry) => {
        return { Key: entry.key }
      })
      cb(null, { Contents: contents, isTruncated: false })
    }
  }

  const driver = proxyquire('../../src/server/drivers/S3Driver', {
    'aws-sdk/clients/s3': S3Class
  })
  return { driver, dataMap }
}

class MockWriteStream extends Writable {
  dataMap: any
  filename: any
  data: any
  constructor(dataMap, filename) {
    super({})
    this.dataMap = dataMap
    this.filename = filename
    this.data = ''
  }
  _write(chunk, encoding, callback) {
    this.data += chunk
    callback()
    return true
  }
  _final(callback) {
    this.dataMap.push({ data: this.data, key: this.filename })
    callback()
  }
}

function makeMockedGcDriver() {
  const dataMap = []
  let myName = ''

  const file = function (filename) {
    const createWriteStream = function() {
      return new MockWriteStream(dataMap, filename)
    }
    return { createWriteStream }
  }
  const exists = function () {
    return Promise.resolve([true])
  }
  const StorageClass = class {
    bucket(bucketName) {
      if (myName === '') {
        myName = bucketName
      } else {
        if (myName !== bucketName) {
          throw new Error(`Unexpected bucket name: ${bucketName}. Expected ${myName}`)
        }
      }
      return { file, exists, getFiles: this.getFiles }
    }

    getFiles(options, cb) {
      const files = dataMap.map((entry) => {
        return { name: entry.key }
      })
      cb(null, files, null)
    }
  }

  const driver = proxyquire('../../src/server/drivers/GcDriver', {
    '@google-cloud/storage': StorageClass
  })
  return { driver, dataMap }
}

function testAzDriver() {
  let config = {
    "azCredentials": {
      "accountName": "mock-azure",
      "accountKey": "mock-azure-key"
    },
    "bucket": "spokes"
  }
  let mockTest = true

  if (driverConfigs.az) {
    config = driverConfigs.az
    mockTest = false
  }

  let AzDriver, dataMap
  if (mockTest) {
    const mockedObj = makeMockedAzureDriver()
    dataMap = mockedObj.dataMap
    AzDriver = mockedObj.AzDriver
  } else {
    AzDriver = require('../../src/server/drivers/AzDriver')
  }

  test('azDriver', (t) => {
    const driver = new AzDriver(config)
    const prefix = driver.getReadURLPrefix()
    const s = new Readable()
    s.push('hello world')
    s.push(null)

    const fetch = mockTest ? FetchMock.sandbox(NodeFetch) : NodeFetch;

    const writeArgs : any = { path: '../foo.js' }
    driver.performWrite(writeArgs)
      .then(() => t.ok(false, 'Should have thrown'))
      .catch((err) => t.equal(err.message, 'Invalid Path', 'Should throw bad path'))
      .then(() => driver.performWrite(
        { path: 'foo.txt',
          storageTopLevel: '12345',
          stream: s,
          contentType: 'application/octet-stream',
          contentLength: 12 }))
      .then((readUrl) => {
        if (mockTest) {
          addMockFetches(fetch, prefix, dataMap)
        }

        t.ok(readUrl.startsWith(prefix), `${readUrl} must start with readUrlPrefix ${prefix}`)
        return fetch(readUrl)
      })
      .then((resp) => resp.text())
      .then((resptxt) => t.equal(resptxt, 'hello world', `Must get back hello world: got back: ${resptxt}`))
      .then(() => driver.listFiles('12345'))
      .then((files) => {
        t.equal(files.entries.length, 1, 'Should return one file')
        t.equal(files.entries[0], 'foo.txt', 'Should be foo.txt!')
      })
      .catch((err) => t.false(true, `Unexpected err: ${err}`))
      .then(() => {
        if (mockTest) {
          fetch.restore()
        }
        t.end() 
      })
  })
}

function testS3Driver() {
  let config : any = {
    "bucket": "spokes"
  }
  let mockTest = true

  if (driverConfigs.aws) {
    config = driverConfigs.aws
    mockTest = false
  }

  let S3Driver, dataMap
  if (mockTest) {
    const mockedObj = makeMockedS3Driver()
    dataMap = mockedObj.dataMap
    S3Driver = mockedObj.driver
  } else {
    S3Driver = require('../../src/server/drivers/S3Driver')
  }

  test('awsDriver', (t) => {
    const driver = new S3Driver(config)
    const prefix = driver.getReadURLPrefix()
    const s = new Readable()
    s.push('hello world')
    s.push(null)

    const fetch = mockTest ? FetchMock.sandbox(NodeFetch) : NodeFetch;

    const writeArgs : any = { path: '../foo.js'}

    driver.performWrite(writeArgs)
      .then(() => t.ok(false, 'Should have thrown'))
      .catch((err) => t.equal(err.message, 'Invalid Path', 'Should throw bad path'))
      .then(() => driver.performWrite(
        { path: 'foo.txt',
          storageTopLevel: '12345',
          stream: s,
          contentType: 'application/octet-stream',
          contentLength: 12 }))
      .then((readUrl) => {
        if (mockTest) {
          addMockFetches(fetch, prefix, dataMap)
        }
        t.ok(readUrl.startsWith(prefix + '12345'), `${readUrl} must start with readUrlPrefix ${prefix}12345`)
        return fetch(readUrl)
      })
      .then((resp) => resp.text())
      .then((resptxt) => t.equal(resptxt, 'hello world', `Must get back hello world: got back: ${resptxt}`))
      .then(() => driver.listFiles('12345'))
      .then((files) => {
        t.equal(files.entries.length, 1, 'Should return one file')
        t.equal(files.entries[0], 'foo.txt', 'Should be foo.txt!')
      })
      .catch((err) => t.false(true, `Unexpected err: ${err}`))
      .then(() => {
        if (mockTest) {
          fetch.restore()
        }
      })
      .catch((err) => t.false(true, `Unexpected err: ${err}`))
      .then(() => { 
        if (mockTest) {
          fetch.restore()
        }
        t.end() 
      })
  })
}

/*
 * To run this test, you should run an HTTP server on localhost:4000
 * and use the ../config.sample.disk.json config file.
 */
function testDiskDriver() {
  if (!driverConfigs.disk) {
    return
  }
  const config = driverConfigs.disk
  const DiskDriver = require('../../src/server/drivers/diskDriver')

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

function testGcDriver() {
  let config = {
    "bucket": "spokes"
  }
  let mockTest = true

  if (driverConfigs.gc) {
    config = driverConfigs.gc
    if (!config.gcCredentials.keyFilename && config.gcCredentials.keyFileJson) {
      config.gcCredentials.keyFilename = path.resolve(os.tmpdir(), `${Date.now()|0}.${Math.random()*100000|0}.json`);
      fs.writeFileSync(config.gcCredentials.keyFilename, JSON.stringify(config.gcCredentials.keyFileJson));
    }
    mockTest = false
  }

  let GcDriver, dataMap
  if (mockTest) {
    const mockedObj = makeMockedGcDriver()
    dataMap = mockedObj.dataMap
    GcDriver = mockedObj.driver
  } else {
    GcDriver = require('../../src/server/drivers/GcDriver')
  }

  test('Google Cloud Driver', (t) => {
    const driver = new GcDriver(config)
    const prefix = driver.getReadURLPrefix()
    const s = new Readable()
    s.push('hello world')
    s.push(null)

    const fetch = mockTest ? FetchMock.sandbox(NodeFetch) : NodeFetch;

    const writeArgs : any = { path: '../foo.js'}
    driver.performWrite(writeArgs)
      .then(() => t.ok(false, 'Should have thrown'))
      .catch((err) => t.equal(err.message, 'Invalid Path', 'Should throw bad path'))
      .then(() => driver.performWrite(
        { path: 'foo.txt',
          storageTopLevel: '12345',
          stream: s,
          contentType: 'application/octet-stream',
          contentLength: 12 }))
      .then((readUrl) => {
        if (mockTest) {
          addMockFetches(fetch, prefix, dataMap)
        }
        t.ok(readUrl.startsWith(prefix + '12345'), `${readUrl} must start with readUrlPrefix ${prefix}12345`)
        return fetch(readUrl)
      })
      .then((resp) => resp.text())
      .then((resptxt) => t.equal(resptxt, 'hello world', `Must get back hello world: got back: ${resptxt}`))
      .then(() => driver.listFiles('12345'))
      .then((files) => {
        t.equal(files.entries.length, 1, 'Should return one file')
        t.equal(files.entries[0], 'foo.txt', 'Should be foo.txt!')
      })
      .catch((err) => t.false(true, `Unexpected err: ${err}`))
      .then(() => {
        if (mockTest) {
          fetch.restore()
        }
        t.end() 
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
  testAzDriver()
  testS3Driver()
  testDiskDriver()
  testGcDriver()
}
