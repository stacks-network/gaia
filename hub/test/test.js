var request = require('supertest');
// require = require('really-need');

describe('loading express', function () {
  var server;
  beforeEach(function () {
    server = require('../server/server.js', { bustCache: true });
  });
  it('responds to /', function testSlash(done) {
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
});
