let request = require('supertest')
let bitcoin = require('bitcoinjs-lib')
let fs = require('fs')

let StorageAuth = require('../server/StorageAuthentication.js')
let server = require('../server/server.js')
let config = require('../server/config.js')

describe('loading express', function () {
  // beforeEach(function () {
  //   server = require('../server/server.js', { bustCache: true });
  // })
  it('handles file POST with azure driver', function testBasicWrite(done) {
    const conf = config(JSON.parse(fs.readFileSync("./config.azure.json")))
    let app = server(conf)

    let blob = Buffer("Hello Blockstack Shared Storage")
    let sk = bitcoin.ECPair.makeRandom()
    let authHeader = StorageAuth
        .makeWithKey(sk)
        .toAuthHeader()
    let address = sk.getAddress()
    let path = `/store/${address}/helloWorld`
    request(app).post(path)
      .set('Content-Type', 'application/octet-stream')
      .set('Authentication', authHeader)
      .send(blob)
      .expect(202, done)
  })
  it('handles file POST with aws driver', function testBasicWrite(done) {
    const conf = config(JSON.parse(fs.readFileSync("./config.aws.json")))
    let app = server(conf)

    let blob = Buffer("Hello Blockstack Shared Storage")
    let sk = bitcoin.ECPair.makeRandom()
    let authHeader = StorageAuth
        .makeWithKey(sk)
        .toAuthHeader()
    let address = sk.getAddress()
    let path = `/store/${address}/helloWorld`
    request(app).post(path)
      .set('Content-Type', 'application/octet-stream')
      .set('Authentication', authHeader)
      .send(blob)
      .expect(202, done)
  })
});
