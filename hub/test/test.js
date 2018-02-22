const nock = require('nock')

let request = require('supertest')
let assert = require('assert')
let req = require('request')
let bitcoin = require('bitcoinjs-lib')
let fs = require('fs')

let StorageAuth = require('../lib/server/StorageAuthentication.js')
let ProofChecker = require('../lib/server/ProofChecker.js')
let HubServer = require('../lib/server/server.js').HubServer
let config = require('../lib/server/config.js')

let azConfigPath = process.env.AZ_CONFIG_PATH || "./config.azure.json"
let awsConfigPath = process.env.AWS_CONFIG_PATH || "./config.aws.json"


function setupAwsNocks() {
  
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

describe('Writing to drivers', function () {
  nock.disableNetConnect()
  azConfigObj = JSON.parse(fs.readFileSync(azConfigPath))
  awsConfigObj = JSON.parse(fs.readFileSync(awsConfigPath))
  it('handles file POST with azure driver', (done) => { testDriver(done, azConfigObj) })
  it('handles file POST with aws driver', (done) => { testDriver(done, awsConfigObj) })
  it('handles badSig POSTs with aws driver', (done) => { testBadSig(done, awsConfigObj) })
  it('handles enoughProofs', (done) => { enoughProofsTest(done) })
})
