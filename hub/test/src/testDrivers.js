/* @flow */
import test from 'tape'
import proxyquire from 'proxyquire'
import FetchMock from 'fetch-mock'
import * as NodeFetch from 'node-fetch'
const fetch = FetchMock.sandbox(NodeFetch)

import fs from 'fs'
import path from 'path'

import { Readable, Writable } from 'stream'
import { InMemoryDriver } from './testDrivers/InMemoryDriver'

const azConfigPath = process.env.AZ_CONFIG_PATH
const awsConfigPath = process.env.AWS_CONFIG_PATH
const diskConfigPath = process.env.DISK_CONFIG_PATH
const gcConfigPath = process.env.GC_CONFIG_PATH

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

  if (azConfigPath) {
    config = JSON.parse(fs.readFileSync(azConfigPath, {encoding: 'utf8'}))
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
        fetch.restore()
        t.end() 
      })
  })
}

function testS3Driver() {
  let config : any = {
    "bucket": "spokes"
  }
  let mockTest = true

  if (awsConfigPath) {
    config = JSON.parse(fs.readFileSync(awsConfigPath, {encoding: 'utf8'}))
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
      .then(() => fetch.restore())
      .catch((err) => t.false(true, `Unexpected err: ${err}`))
      .then(() => { 
        fetch.restore()
        t.end() 
      })
  })
}

/*
 * To run this test, you should run an HTTP server on localhost:4000
 * and use the ../config.sample.disk.json config file.
 */
function testDiskDriver() {
  if (!diskConfigPath) {
    return
  }
  const config = JSON.parse(fs.readFileSync(diskConfigPath, {encoding: 'utf8'}))
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

  if (gcConfigPath) {
    config = JSON.parse(fs.readFileSync(gcConfigPath, {encoding: 'utf8'}))
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
        fetch.restore()
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
      const contentBuff = Buffer.from('hello world')
      const s = new Readable()
      s.push(contentBuff)
      s.push(null)

      const readUrl = await driver.performWrite(
          { path: 'foo.txt',
            storageTopLevel: '12345',
            stream: s,
            contentType: 'application/octet-stream',
            contentLength: contentBuff.length })

      t.ok(readUrl.startsWith(prefix + '12345'), `${readUrl} must start with readUrlPrefix ${prefix}12345`)
      const resp = await fetch(readUrl)
      const resptxt = await resp.text()
      t.equal(resptxt, 'hello world', `Must get back hello world: got back: ${resptxt}`)
      const files = await driver.listFiles('12345')
      t.equal(files.entries.length, 1, 'Should return one file')
      t.equal(files.entries[0], 'foo.txt', 'Should be foo.txt!')
      t.end()
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
