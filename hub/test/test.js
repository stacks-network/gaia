var request = require('supertest')
var StorageAuth = require('../server/StorageAuthentication.js')
var bitcoin = require('bitcoinjs-lib')

describe('loading express', function () {
  var server
  beforeEach(function () {
    server = require('../server/server.js', { bustCache: true });
  })
  it('handles file POST', function testBasicWrite(done) {
    let blob = Buffer("Hello Blockstack Shared Storage")
    let sk = bitcoin.ECPair.makeRandom()
    let authHeader = StorageAuth
        .makeWithKey(sk)
        .toAuthHeader()
    let address = sk.getAddress()
    let path = `/store/${address}/helloWorld`
    request(server).post(path)
      .set('Content-Type', 'application/octet-stream')
      .set('Authentication', authHeader)
      .send(blob)
      .expect(202, done)
  })
/*  it('responds to /', function testSlash(done) {
    request(server)
      .get('/')
      .expect(200, done);
  });
  it('404 everything else', function testPath(done) {
    console.log('test 404')
    request(server)
      .get('/foo/bar')
      .expect(404, done);
  });
*/
});
