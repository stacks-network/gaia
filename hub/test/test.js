const nock = require('nock')
const test = require('tape')

let request = require('supertest')
let assert = require('assert')
let req = require('request')
let bitcoin = require('bitcoinjs-lib')
let fs = require('fs')

let StorageAuth = require('../lib/server/StorageAuthentication.js').StorageAuthentication
let ProofChecker = require('../lib/server/ProofChecker.js').ProofChecker
let HubServer = require('../lib/server/server.js').HubServer
let config = require('../lib/server/config.js')

const Readable = require('stream').Readable
const errors = require('../lib/server/errors')

let azConfigPath = process.env.AZ_CONFIG_PATH || "./config.azure.json"
let awsConfigPath = process.env.AWS_CONFIG_PATH || "./config.aws.json"


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

function testDriver(done, configObj) {
  configObj = Object.assign({}, {proofsConfig : {proofsRequired : 0}}, configObj)
  const conf = config(configObj)
  let app = new HubServer({}, {}, conf)
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
      console.log(url)
      req(JSON.parse(response.text).publicURL, { json: true }, (err, res, body) => {
        if (err) { return console.log(err); }
        assert(body, fileContents)
        done()
      });
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

function makeProofsTest(proofCount, configObj) {
  let testKey = bitcoin.ECPair.fromWIF('KyB4xpeaxFmDNCbfEfNJY846SG7LMmeueviJ4tQULq2gSP2G82Vv')
  let authHeader = StorageAuth
      .makeWithKey(testKey)
      .toAuthHeader()
  let address = testKey.getAddress()
  let blob = Buffer("Hello world!")
  let path = `/store/${address}/helloWorld`
  let goodProof = {
    '@type': 'Account',
    identifier: 'kantai',
    proofType: 'http',
    proofUrl: 'https://gist.github.com/kantai/2b8b9bcdcd4e048e02bc04e354145158',
    service: 'github'
  }
  let badProof = {
    '@type': 'Account',
    identifier: 'kantai',
    proofType: 'http',
    proofUrl: 'https://gist.github.com/kantai/5030a9ea123164eebc5bb5cacde8f9ff',
    service: 'github'
  }
  configObj = Object.assign({}, {proofsConfig : {proofsRequired : proofCount}}, configObj)
  const conf = config(configObj)
  let app = new HubServer({}, {}, conf)
  let proofHeader = ProofChecker.makeProofsHeader( [goodProof, badProof] )
  return (request(app).post(path)
          .set('Content-Type', 'application/octet-stream')
          .set('Authorization', authHeader)
          .set('X-BLOCKSTACK-SOCIALPROOFS', proofHeader)
          .send(blob))
}

function enoughProofsTest(done) {

  let proofsConfig = { proofsRequired : 2 }

  let logger = require('winston')

  let fauxDriver = { getReadURLPrefix :
                     function () { return 'https://gaia.blockstack.org/hub/' } }

  let p = new ProofChecker( proofsConfig, logger, fauxDriver )

  let r = { params : { address : '15GAGiT2j2F1EzZrvjk3B8vBCfwVEzQaZx' } }

  p.checkProofs(r)
    .then( result => {
      assert(result)
      done()
    })
    .catch( x => {
      logger.warn(x)
      assert(false)
      done()
    })

}

testServer()

/*
describe('Writing to drivers', function () {
  nock.disableNetConnect()
  azConfigObj = JSON.parse(fs.readFileSync(azConfigPath))
  awsConfigObj = JSON.parse(fs.readFileSync(awsConfigPath))
  it('handles file POST with azure driver', (done) => { testDriver(done, azConfigObj) })
  it('handles file POST with aws driver', (done) => { testDriver(done, awsConfigObj) })
  it('handles badSig POSTs with aws driver', (done) => { testBadSig(done, awsConfigObj) })
  it('handles enoughProofs', (done) => { enoughProofsTest(done) })
})
*/
