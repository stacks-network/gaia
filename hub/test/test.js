const test = require('tape')

const proxyquire = require('proxyquire')
const FetchMock = require('fetch-mock')

let request = require('supertest')
let bitcoin = require('bitcoinjs-lib')
let fs = require('fs')

const { Readable, Writable } = require('stream');

const auth = require('../lib/server/authentication.js')
const config = require('../lib/server/config.js')

const { ProofChecker } = require('../lib/server/ProofChecker.js')
const { HubServer } = require('../lib/server/server.js')
const { makeHttpServer } = require('../lib/server/http.js')
const { TokenSigner } = require('jsontokens')

const errors = require('../lib/server/errors')

let azConfigPath = process.env.AZ_CONFIG_PATH
let awsConfigPath = process.env.AWS_CONFIG_PATH
let diskConfigPath = process.env.DISK_CONFIG_PATH
let gcConfigPath = process.env.GC_CONFIG_PATH

const testWIFs = [
  'L4kMoaVivcd1FMPPwRU9XT2PdKHPob3oo6YmgTBHrnBHMmo7GcCf',
  'L3W7EzxYNdG3kBjtQmhKEq2iiZAwpiKEwMobXdaY9xueSUFPkQeH',
  'KwzzsbVzMekdj9myzxojsgT6DQ6yRQKbWqSXQgo1YKsJcvFJhtRr',
  'KxYYiJg9mJpCDHcyYMMvSfY4SWGwMofqavxG2ZyDNcXuY7ShBknK']
const testPairs = testWIFs.map(x => bitcoin.ECPair.fromWIF(x))
const testAddrs = testPairs.map(x => x.getAddress())

function addMockFetches(prefix, dataMap) {
  dataMap.forEach( item => {
    FetchMock.get(`${prefix}${item.key}`, item.data)
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

function makeMockedAzureDriver() {
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

  AzDriver = proxyquire('../lib/server/drivers/AzDriver', {
    'azure-storage': { createBlobService }
  })
  return { AzDriver, dataMap }
}

function makeMockedS3Driver() {
  const dataMap = []
  let bucketName = ''

  S3Class = class {
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

  driver = proxyquire('../lib/server/drivers/S3Driver', {
    'aws-sdk/clients/s3': S3Class
  })
  return { driver, dataMap }
}

class MockWriteStream extends Writable {
  constructor(dataMap, filename) {
    super({})
    this.dataMap = dataMap
    this.filename = filename
    this.data = ''
  }
  _write(chunk, encoding, callback) {
    this.data += chunk
    callback()
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
  StorageClass = class {
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

  driver = proxyquire('../lib/server/drivers/GcDriver', {
    '@google-cloud/storage': StorageClass
  })
  return { driver, dataMap }
}

class MockDriver {
  constructor() {
    this.lastWrite = null
  }
  getReadURLPrefix() {
    return 'http://test.com/'
  }
  performWrite(write) {
    this.lastWrite = write
    return Promise.resolve(`http://test.com/${write.storageTopLevel}/${write.path}`)
  }
}

class MockProofs {
  checkProofs() {
    return Promise.resolve()
  }
}

function testAuth() {
  test('authentication legacy/regression', (t) => {
    const legacyPart = {
      wif: 'Kzp44Hhp6SFUXMuMi6MUDTqyfcNyyjntrphEHVMsiitRrjMyoV4p',
      addr: '1AotVNASQouiNiBtfxv49WWvSNcQUzGYuU',
      serverName: 'storage.blockstack.org',
      legacyAuth: 'eyJwdWJsaWNrZXkiOiIwMjQxYTViMDQ2Mjg1ZjVlMjgwMDRmOTJjY2M0MjNmY2RkODYyZmYzY' +
        'jgwODUwNzE4MDY4MGIyNDA3ZTIyOWE3NzgiLCJzaWduYXR1cmUiOiIzMDQ0MDIyMDY5ODUwNmNjYjg3MDg1Zm' +
        'Y5ZGI3ZTc4MTIwYTVmMjY1YzExZmY0ODc4OTBlNDQ1MWZjYWM3NjA4NTkyMDhjZWMwMjIwNTZkY2I0OGUyYzE' +
        '4Y2YwZjQ1NDZiMmQ3M2I2MDY4MWM5ODEyMzQyMmIzOTRlZjRkMWI2MjE3NTYyODQ4MzUwNCJ9' }
    t.doesNotThrow(() => auth.validateAuthorizationHeader(`bearer ${legacyPart.legacyAuth}`,
                                                          legacyPart.serverName,
                                                          legacyPart.addr),
                   'legacy authentication token should work')
    t.end()
  })

  test('storage validation', (t) => {
    const challengeText = auth.getChallengeText()
    const authPart = auth.LegacyAuthentication.makeAuthPart(testPairs[0], challengeText)
    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], challengeText),
             errors.ValidationError, 'Wrong address must throw')
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[0], 'potatos'),
             errors.ValidationError, 'Wrong challenge text must throw')
    t.ok(!authenticator.isAuthenticationValid(testAddrs[1], challengeText, { throwOnFailure: false }),
         'Wrong address must fail')
    t.ok(authenticator.isAuthenticationValid(testAddrs[0], challengeText, { throwOnFailure: false }),
         'Good signature must pass')

    const pkBad = bitcoin.ECPair.fromPublicKeyBuffer(testPairs[1].getPublicKeyBuffer())
    const authBad = new auth.LegacyAuthentication(pkBad, authenticator.signature)

    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], challengeText),
             'Bad signature must throw')
    t.ok(!authenticator.isAuthenticationValid(testAddrs[1], challengeText, { throwOnFailure: false }),
         'Bad signature must fail')
    t.end()
  })

  test('v1 storage validation', (t) => {
    const challengeText = 'bananas are tasty'
    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText)
    console.log(`V1 storage validation: ${authPart}`)
    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], challengeText),
             errors.ValidationError, 'Wrong address must throw')
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[0], 'potatos are tasty'),
             errors.ValidationError, 'Wrong challenge text must throw')
    t.ok(!authenticator.isAuthenticationValid(testAddrs[1], challengeText, { throwOnFailure: false }),
         'Wrong address must fail')
    t.ok(authenticator.isAuthenticationValid(testAddrs[0], challengeText, { throwOnFailure: false }),
         'Good signature must pass')

    const signerKeyHex = testPairs[0].d.toHex()
    const tokenWithoutIssuer = new TokenSigner('ES256K', signerKeyHex).sign(
      { garbage: 'in' })
    const goodTokenWithoutExp = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[0].getPublicKeyBuffer().toString('hex') })
    const expiredToken = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[0].getPublicKeyBuffer().toString('hex'), exp: 1 })
    const wrongIssuerToken = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[1].getPublicKeyBuffer().toString('hex'), exp: 1 })
    t.throws(() => new auth.V1Authentication(tokenWithoutIssuer).isAuthenticationValid(testAddrs[0], challengeText),
             errors.ValidationError, 'No `iss`, should fail')
    t.throws(() => new auth.V1Authentication(expiredToken).isAuthenticationValid(testAddrs[0], challengeText),
             errors.ValidationError, 'Expired token should fail')
    t.throws(() => new auth.V1Authentication(wrongIssuerToken).isAuthenticationValid(testAddrs[1], challengeText),
             errors.ValidationError, 'Invalid signature')
    t.ok(new auth.V1Authentication(goodTokenWithoutExp).isAuthenticationValid(testAddrs[0], challengeText),
         'Valid token without expiration should pass')

    t.end()
  })
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
    config = JSON.parse(fs.readFileSync(azConfigPath))
    mockTest = false
  }

  let AzDriver, dataMap
  const azDriverImport = '../lib/server/drivers/AzDriver'
  if (mockTest) {
    mockedObj = makeMockedAzureDriver()
    dataMap = mockedObj.dataMap
    AzDriver = mockedObj.AzDriver
  } else {
    AzDriver = require(azDriverImport)
  }

  test('azDriver', (t) => {
    const driver = new AzDriver(config)
    const prefix = driver.getReadURLPrefix()
    const s = new Readable()
    s._read = function noop() {}
    s.push('hello world')
    s.push(null)

    driver.performWrite(
      { path: '../foo.js'})
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
          addMockFetches(prefix, dataMap)
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
      .then(() => { FetchMock.restore(); t.end() })
  })
}

function testS3Driver() {
  let config = {
    "bucket": "spokes"
  }
  let mockTest = true

  if (awsConfigPath) {
    config = JSON.parse(fs.readFileSync(awsConfigPath))
    mockTest = false
  }

  let S3Driver, dataMap
  const S3DriverImport = '../lib/server/drivers/S3Driver'
  if (mockTest) {
    mockedObj = makeMockedS3Driver()
    dataMap = mockedObj.dataMap
    S3Driver = mockedObj.driver
  } else {
    S3Driver = require(S3DriverImport)
  }

  test('awsDriver', (t) => {
    const driver = new S3Driver(config)
    const prefix = driver.getReadURLPrefix()
    const s = new Readable()
    s._read = function noop() {}
    s.push('hello world')
    s.push(null)

    driver.performWrite(
      { path: '../foo.js'})
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
          addMockFetches(prefix, dataMap)
        }
        else {
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
      .then(() => { FetchMock.restore(); })
      .catch(() => t.false(true, `Unexpected err: ${err}`))
      .then(() => { FetchMock.restore(); t.end() })
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
  const config = JSON.parse(fs.readFileSync(diskConfigPath))
  const diskDriverImport = '../lib/server/drivers/diskDriver'
  const DiskDriver = require(diskDriverImport)

  test('diskDriver', (t) => {
    t.plan(4)
    const driver = new DiskDriver(config)
    const prefix = driver.getReadURLPrefix()
    const s = new Readable()
    s._read = function noop() {}
    s.push('hello world')
    s.push(null)

    driver.performWrite(
      { path: '../foo.js'})
      .then(() => t.ok(false, 'Should have thrown'))
      .catch((err) => t.equal(err.message, 'Invalid Path', 'Should throw bad path'))
      .then(() => driver.performWrite(
        { path: 'foo.txt',
          storageTopLevel: '12345',
          stream: s,
          contentType: 'application/octet-stream',
          contentLength: 12 }))
      .then((readUrl) => {
        t.ok(readUrl.startsWith(prefix + '12345'), `${readUrl} must start with readUrlPrefix ${prefix}12345`)
      })
      .then(() => driver.listFiles('12345'))
      .then((files) => {
        t.equal(files.entries.length, 1, 'Should return one file')
        t.equal(files.entries[0], 'foo.txt', 'Should be foo.txt!')
      })
  })
}

function testGcDriver() {
  let config = {
    "bucket": "spokes"
  }
  let mockTest = true

  if (gcConfigPath) {
    config = JSON.parse(fs.readFileSync(gcConfigPath))
    mockTest = false
  }

  let GcDriver, dataMap
  const GcDriverImport = '../lib/server/drivers/GcDriver'
  if (mockTest) {
    mockedObj = makeMockedGcDriver()
    dataMap = mockedObj.dataMap
    GcDriver = mockedObj.driver
  } else {
    GcDriver = require(GcDriverImport)
  }

  test('Google Cloud Driver', (t) => {
    const driver = new GcDriver(config)
    const prefix = driver.getReadURLPrefix()
    const s = new Readable()
    s._read = function noop() {}
    s.push('hello world')
    s.push(null)

    driver.performWrite(
      { path: '../foo.js'})
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
          addMockFetches(prefix, dataMap)
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
      .then(() => { FetchMock.restore(); t.end() })
  })
}


function testServer() {
  test('validation tests', (t) => {
    t.plan(3)
    const server = new HubServer(new MockDriver(), new MockProofs(),
                                 { whitelist: [testAddrs[0]] })
    t.throws(() => server.validate(testAddrs[1], {}),
             errors.ValidationError, 'Non-whitelisted address should fail validation')
    t.throws(() => server.validate(testAddrs[0], {}),
             errors.ValidationError, 'Bad request headers should fail validation')

    const challengeText = auth.getChallengeText()
    const authPart = auth.LegacyAuthentication.makeAuthPart(testPairs[0], challengeText)
    const authorization = `bearer ${authPart}`
    try {
      server.validate(testAddrs[0], { authorization })
      t.pass('White-listed address with good auth header should pass')
    } catch (err) {
      t.fail('White-listed address with good auth header should pass')
    }
  })

  test('handle request with readURL', (t) => {
    t.plan(8)
    const mockDriver = new MockDriver()
    const server = new HubServer(mockDriver, new MockProofs(),
                                 { whitelist: [testAddrs[0]], readURL: 'http://potato.com/' })
    const challengeText = auth.getChallengeText()
    const authPart = auth.LegacyAuthentication.makeAuthPart(testPairs[0], challengeText)
    const authorization = `bearer ${authPart}`

    const s = new Readable()
    s._read = function noop() {}
    s.push('hello world')
    s.push(null)
    const s2 = new Readable()
    s2._read = function noop() {}
    s2.push('hello world')
    s2.push(null)

    server.handleRequest(testAddrs[0], 'foo.txt',
                         { 'content-type' : 'text/text',
                           'content-length': 4,
                           authorization }, s)
      .then(path => {
        t.equal(path, `http://potato.com/${testAddrs[0]}/foo.txt`)
        t.equal(mockDriver.lastWrite.path, 'foo.txt')
        t.equal(mockDriver.lastWrite.storageTopLevel, testAddrs[0])
        t.equal(mockDriver.lastWrite.contentType, 'text/text')
      })
      .then(() => server.handleRequest(testAddrs[0], 'foo.txt',
                         { 'content-length': 4,
                           authorization }, s2))
      .then(path => {
        t.equal(path, `http://potato.com/${testAddrs[0]}/foo.txt`)
        t.equal(mockDriver.lastWrite.path, 'foo.txt')
        t.equal(mockDriver.lastWrite.storageTopLevel, testAddrs[0])
        t.equal(mockDriver.lastWrite.contentType, 'application/octet-stream')
      })
  })

  test('handle request', (t) => {
    t.plan(8)
    const mockDriver = new MockDriver()
    const server = new HubServer(mockDriver, new MockProofs(),
                                 { whitelist: [testAddrs[0]] })
    const challengeText = auth.getChallengeText()
    const authPart = auth.LegacyAuthentication.makeAuthPart(testPairs[0], challengeText)
    const authorization = `bearer ${authPart}`

    const s = new Readable()
    s._read = function noop() {}
    s.push('hello world')
    s.push(null)
    const s2 = new Readable()
    s2._read = function noop() {}
    s2.push('hello world')
    s2.push(null)

    server.handleRequest(testAddrs[0], 'foo.txt',
                         { 'content-type' : 'text/text',
                           'content-length': 4,
                           authorization }, s)
      .then(path => {
        t.equal(path, `http://test.com/${testAddrs[0]}/foo.txt`)
        t.equal(mockDriver.lastWrite.path, 'foo.txt')
        t.equal(mockDriver.lastWrite.storageTopLevel, testAddrs[0])
        t.equal(mockDriver.lastWrite.contentType, 'text/text')
      })
      .then(() => server.handleRequest(testAddrs[0], 'foo.txt',
                         { 'content-length': 4,
                           authorization }, s2))
      .then(path => {
        t.equal(path, `http://test.com/${testAddrs[0]}/foo.txt`)
        t.equal(mockDriver.lastWrite.path, 'foo.txt')
        t.equal(mockDriver.lastWrite.storageTopLevel, testAddrs[0])
        t.equal(mockDriver.lastWrite.contentType, 'application/octet-stream')
      })
  })
}

function testHttpPost() {
  let config = {
    "azCredentials": {
      "accountName": "mock-azure",
      "accountKey": "mock-azure-key"
    },
    "bucket": "spokes"
  }
  let mockTest = true

  if (azConfigPath) {
    config = JSON.parse(fs.readFileSync(azConfigPath))
    config.driver = 'azure'
    mockTest = false
  }

  let dataMap = []
  let AzDriver
  const azDriverImport = '../lib/server/drivers/AzDriver'
  if (mockTest) {
    mockedObj = makeMockedAzureDriver()
    dataMap = mockedObj.dataMap
    AzDriver = mockedObj.AzDriver
    config.driverClass = AzDriver
  } else {
    AzDriver = require(azDriverImport)
  }

  test('handle request', (t) => {
    let app = makeHttpServer(config)
    let sk = testPairs[1]
    let fileContents = sk.toWIF()
    let blob = Buffer(fileContents)

    let address = sk.getAddress()
    let path = `/store/${address}/helloWorld`
    let listPath = `/list-files/${address}`
    let prefix = ''
    let authorizationHeader = ''

    request(app).get('/hub_info/')
      .expect(200)
      .then((response) => {
        prefix = JSON.parse(response.text).read_url_prefix
        challenge = JSON.parse(response.text).challenge_text
        const authPart = auth.V1Authentication.makeAuthPart(sk, challenge)
        return `bearer ${authPart}`
      })
      .then((authorization) => {
        authorizationHeader = authorization
        return request(app).post(path)
            .set('Content-Type', 'application/octet-stream')
            .set('Authorization', authorization)
            .send(blob)
            .expect(202)
      })
      .then((response) => {
        if (mockTest) {
          addMockFetches(prefix, dataMap)
        }

        let url = JSON.parse(response.text).publicURL
        t.ok(url, 'Must return URL')
        console.log(url)
        fetch(url)
          .then(resp => resp.text())
          .then(text => t.equal(text, fileContents, 'Contents returned must be correct'))
      })
      .catch(() => t.false(true, `Unexpected err: ${err}`))
      .then(() => request(app).post(listPath)
            .set('Content-Type', 'application/json')
            .set('Authorization', authorizationHeader)
            .expect(202)
      )
      .then((filesResponse) => {
        const files = JSON.parse(filesResponse.text)
        t.equal(files.entries.length, 1, 'Should return one file')
        t.equal(files.entries[0], 'helloWorld', 'Should be helloworld')
        t.ok(files.hasOwnProperty('page'), 'Response is missing a page')
      })
      .then(() => { FetchMock.restore(); t.end() })
  })
}


testServer()
testAuth()
testAzDriver()
testS3Driver()
testDiskDriver()
testGcDriver()
testHttpPost()
