let request = require('supertest')
let assert = require('assert')
let req = require('request')
let bitcoin = require('bitcoinjs-lib')
let fs = require('fs')

let StorageAuth = require('../server/StorageAuthentication.js')
let server = require('../server/server.js')
let config = require('../server/config.js')

let azConfigPath = process.env.AZ_CONFIG_PATH || "./config.azure.json"
let awsConfigPath = process.env.AWS_CONFIG_PATH || "./config.aws.json"

function testDriver(done, driverConfig) {
  const conf = config(JSON.parse(fs.readFileSync(driverConfig)))
  let app = server(conf)
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

describe('Writing to drivers', function () {
  it('handles file POST with azure driver', (done) => { testDriver(done, azConfigPath) })
  it('handles file POST with aws driver', (done) => { testDriver(done, awsConfigPath) })
});
