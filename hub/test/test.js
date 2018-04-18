const nock = require('nock')
const test = require('tape')

let request = require('supertest')
let assert = require('assert')
let req = require('request')
let bitcoin = require('bitcoinjs-lib')
let fs = require('fs')
const Readable = require('stream').Readable

let StorageAuth = require('../lib/server/StorageAuthentication.js').StorageAuthentication
let ProofChecker = require('../lib/server/ProofChecker.js').ProofChecker
let HubServer = require('../lib/server/server.js').HubServer
let config = require('../lib/server/config.js')

const makeHttpServer = require('../lib/server/http.js').makeHttpServer
const AzDriver = require('../lib/server/drivers/AzDriver.js')
const S3Driver = require('../lib/server/drivers/S3Driver.js')
const DiskDriver = require('../lib/server/drivers/diskDriver.js')
const GcDriver = require('../lib/server/drivers/GcDriver.js')

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

function setupAwsNocks() {
}


class MockDriver {
  constructor() {
    this.lastWrite = null
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
  test('storage validation', (t) => {
    t.plan(5)
    const authorization = StorageAuth.makeWithKey(testPairs[0]).toAuthHeader()
    const authenticator = StorageAuth.fromAuthHeader(authorization)
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], true),
             errors.ValidationError, 'Wrong address must throw')
    t.ok(!authenticator.isAuthenticationValid(testAddrs[1], false), 'Wrong address must fail')
    t.ok(authenticator.isAuthenticationValid(testAddrs[0], true), 'Good signature must pass')

    const pkBad = bitcoin.ECPair.fromPublicKeyBuffer(testPairs[1].getPublicKeyBuffer())
    const authBad = new StorageAuth(pkBad, authenticator.signature)

    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], true, 'Bad signature must throw'))
    t.ok(!authenticator.isAuthenticationValid(testAddrs[1], false), 'Bad signature must fail')
  })
}

function testAzDriver() {
  if (!azConfigPath) {
    return
  }
  const config = JSON.parse(fs.readFileSync(azConfigPath))

  test('azDriver', (t) => {
    t.plan(3)
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
        t.ok(readUrl.startsWith(prefix), `${readUrl} must start with readUrlPrefix ${prefix}`)
        return fetch(readUrl)
      })
      .then((resp) => resp.text())
      .then((resptxt) => t.equal(resptxt, 'hello world', `Must get back hello world: got back: ${resptxt}`))
  })
}

function testS3Driver() {
  if (!awsConfigPath) {
    return
  }
  const config = JSON.parse(fs.readFileSync(awsConfigPath))

  test('awsDriver', (t) => {
    t.plan(3)
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
        t.ok(readUrl.startsWith(prefix + '12345'), `${readUrl} must start with readUrlPrefix ${prefix}12345`)
        return fetch(readUrl)
      })
      .then((resp) => resp.text())
      .then((resptxt) => t.equal(resptxt, 'hello world', `Must get back hello world: got back: ${resptxt}`))
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

  test('diskDriver', (t) => {
    t.plan(3)
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
        return fetch(readUrl)
      })
      .then((resp) => resp.text())
      .then((resptxt) => t.equal(resptxt, 'hello world', `Must get back hello world: got back: ${resptxt}`))
  })
}

function testGcDriver() {
  if (!gcConfigPath) {
    return
  }
  const config = JSON.parse(fs.readFileSync(gcConfigPath))

  test('awsDriver', (t) => {
    t.plan(3)
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
        t.ok(readUrl.startsWith(prefix + '12345'), `${readUrl} must start with readUrlPrefix ${prefix}12345`)
        return fetch(readUrl)
      })
      .then((resp) => resp.text())
      .then((resptxt) => t.equal(resptxt, 'hello world', `Must get back hello world: got back: ${resptxt}`))
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

    const authorization = StorageAuth.makeWithKey(testPairs[0]).toAuthHeader()
    try {
      server.validate(testAddrs[0], { authorization })
      t.pass('White-listed address with good auth header should pass')
    } catch (err) {
      t.fail('White-listed address with good auth header should pass')
    }
  })

  test('handle request', (t) => {
    t.plan(8)
    const mockDriver = new MockDriver()
    const server = new HubServer(mockDriver, new MockProofs(),
                                 { whitelist: [testAddrs[0]] })
    const authorization = StorageAuth.makeWithKey(testPairs[0]).toAuthHeader()

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
  if (!azConfigPath) {
    console.log('eliding test, you must set AZ_CONFIG_PATH to run this test.')
    return
  }

  test('handle request', (t) => {
    t.plan(2)
    const config = JSON.parse(fs.readFileSync(azConfigPath))
    Object.assign(config, { driver: 'azure' })

    let app = makeHttpServer(config)
    let sk = bitcoin.ECPair.makeRandom()
    let fileContents = sk.toWIF()
    let blob = Buffer(fileContents)
    let authHeader = StorageAuth
        .makeWithKey(sk)
        .toAuthHeader()
    let address = sk.getAddress()
    let path = `/store/${address}/helloWorld`
    request(app).post(path)
      .set('Content-Type', 'application/octet-stream')
      .set('Authorization', authHeader)
      .send(blob)
      .expect(202)
      .then((response) => {
        let url = JSON.parse(response.text).publicURL
        t.ok(url, 'Must return URL')
        console.log(url)
        fetch(url)
          .then(resp => resp.text())
          .then(text => t.equal(text, fileContents))
      })
  })
}

function testBadSig(done, configObj) {
  configObj = Object.assign({}, {proofsConfig : {proofsRequired : 0}}, configObj)
  const conf = config(configObj)

  let app = new HubServer({}, {}, conf)
  let sk = bitcoin.ECPair.makeRandom()
  let fileContents = sk.toWIF()
  let blob = Buffer(fileContents)
  let authHeader = StorageAuth
      .makeWithKey(sk)
      .toAuthHeader()
  let address = bitcoin.ECPair.makeRandom().getAddress()
  let path = `/store/${address}/helloWorld`
  request(app).post(path)
    .set('Content-Type', 'application/octet-stream')
    .set('Authorization', authHeader)
    .send(blob)
    .expect(401)
    .then((response) => {
      done()
    })
}

testServer()
testAuth()
testAzDriver()
testS3Driver()
testDiskDriver()
testGcDriver()
testHttpPost()
