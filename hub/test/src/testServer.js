import test  from 'tape'

import * as auth from '../../src/server/authentication'
import * as errors from '../../src/server/errors'
import { HubServer }  from '../../src/server/server'
import { Readable } from 'stream'

import { testPairs, testAddrs} from './common'

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

export function testServer() {
  test('validation tests', (t) => {
    t.plan(4)
    const server = new HubServer(new MockDriver(), new MockProofs(),
                                 { whitelist: [testAddrs[0]] })
    const challengeText = auth.getChallengeText()
    const authPart0 = auth.LegacyAuthentication.makeAuthPart(testPairs[1], challengeText)
    const auth0 = `bearer ${authPart0}`

    t.throws(() => server.validate(testAddrs[1], { authorization: auth0 }),
             errors.ValidationError, 'Non-whitelisted address should fail validation')
    t.throws(() => server.validate(testAddrs[0], {}),
             errors.ValidationError, 'Bad request headers should fail validation')

    const authPart = auth.LegacyAuthentication.makeAuthPart(testPairs[0], challengeText)
    const authorization = `bearer ${authPart}`
    try {
      server.validate(testAddrs[0], { authorization })
      t.pass('White-listed address with good auth header should pass')
    } catch (err) {
      t.fail('White-listed address with good auth header should pass')
    }
    
    try {
      server.validate(testAddrs[1], { authorization })
      t.fail('Non white-listed address with good auth header should fail')
    } catch (err) {
      t.pass('Non white-listed address with good auth header should fail')
    }
  })

  test('validation with huburl tests', (t) => {
    t.plan(4)
    const server = new HubServer(new MockDriver(), new MockProofs(),
                                 { whitelist: [testAddrs[0]], requireCorrectHubUrl: true,
                                   validHubUrls: ['https://testserver.com'] })

    const challengeText = auth.getChallengeText()

    const authPartGood1 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, 'https://testserver.com/')
    const authPartGood2 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, 'https://testserver.com')
    const authPartBad1 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined)
    const authPartBad2 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, 'testserver.com')

    t.throws(() => server.validate(testAddrs[0], { authorization: `bearer ${authPartBad1}` }),
             errors.ValidationError, 'Auth must include a hubUrl')
    t.throws(() => server.validate(testAddrs[0], { authorization: `bearer ${authPartBad2}` }),
             errors.ValidationError, 'Auth must include correct hubUrl')

    try {
      server.validate(testAddrs[0], { authorization: `bearer ${authPartGood1}` })
      t.pass('Address with good auth header should pass')
    } catch (err) {
      t.fail('Address with good auth header should pass')
    }
    try {
      server.validate(testAddrs[0], { authorization: `bearer ${authPartGood2}` })
      t.pass('Address with good auth header should pass')
    } catch (err) {
      t.fail('Address with good auth header should pass')
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

  test('handle scoped writes', (t) => {

    const writeScopes = [
      {
        scope: 'putFile',
        domain: '/foo/bar'
      },
      {
        scope: 'putFilePrefix',
        domain: 'baz'
      }
    ]

    const mockDriver = new MockDriver()
    const server = new HubServer(mockDriver, new MockProofs(),
                                 { whitelist: [testAddrs[0]] })
    const challengeText = auth.getChallengeText()

    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined, writeScopes)

    console.log(`V1 storage validation: ${authPart}`)

    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], challengeText),
             errors.ValidationError, 'Wrong address must throw')
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[0], 'potatos are tasty'),
             errors.ValidationError, 'Wrong challenge text must throw')
    t.ok(authenticator.isAuthenticationValid(testAddrs[0], challengeText),
         'Good signature must pass')

    // scopes must be present
    const authScopes = authenticator.getAuthenticationScopes()
    t.equal(authScopes[0].scope, 'putFile', 'scope 0 is putfile')
    t.equal(authScopes[0].domain, '/foo/bar', 'scope 0 is for /foo/bar')
    t.equal(authScopes[1].scope, 'putFilePrefix', 'scope 1 is putFilePrefix')
    t.equal(authScopes[1].domain, 'baz', 'scope 1 is for baz')

    // write to /foo/bar or /baz will succeed
    const s = new Readable()
    s._read = function noop() {}
    s.push('hello world')
    s.push(null)
    const s2 = new Readable()
    s2._read = function noop() {}
    s2.push('hello world')
    s2.push(null)
    const s3 = new Readable()
    s3._read = function noop() {}
    s3.push('hello world')
    s3.push(null)
    const s4 = new Readable()
    s4._read = function noop() {}
    s4.push('hello world')
    s4.push(null)

    server.handleRequest(testAddrs[0], '/foo/bar',
                         { 'content-type' : 'text/text',
                           'content-length': 4,
                           authorization }, s)
      .then(path => {
        // NOTE: the double-/ is *expected*
        t.equal(path, `http://test.com/${testAddrs[0]}//foo/bar`)
        t.equal(mockDriver.lastWrite.path, '/foo/bar')
        t.equal(mockDriver.lastWrite.storageTopLevel, testAddrs[0])
        t.equal(mockDriver.lastWrite.contentType, 'text/text')
      })
      .then(() => server.handleRequest(testAddrs[0], 'baz/foo.txt',
                         { 'content-length': 4,
                           authorization }, s2))
      .then(path => {
        t.equal(path, `http://test.com/${testAddrs[0]}/baz/foo.txt`)
        t.equal(mockDriver.lastWrite.path, 'baz/foo.txt')
        t.equal(mockDriver.lastWrite.storageTopLevel, testAddrs[0])
        t.equal(mockDriver.lastWrite.contentType, 'application/octet-stream')
      })
      .then(() => server.handleRequest(testAddrs[0], '/nope/foo.txt',
                         { 'content-length': 4,
                           authorization }, s3))
      .catch((e) => {
        t.throws(() => { 
          throw e 
        }, errors.ValidationError, 'invalid path prefix should fail')
      })
      .then(() => server.handleRequest(testAddrs[0], '/foo/bar/nope.txt',
                                      { 'content-length': 4,
                                      authorization }, s4))
      .catch((e) => {
        t.throws(() => { 
          throw e 
        }, errors.ValidationError, 'putFile does not allow prefixes')
        t.end()
      })
  })

  test('handle scoped writes with association tokens', (t) => {

    const writeScopes = [
      {
        scope: 'putFile',
        domain: '/foo/bar'
      },
      {
        scope: 'putFilePrefix',
        domain: 'baz'
      }
    ]

    const mockDriver = new MockDriver()
    const server = new HubServer(mockDriver, new MockProofs(),
                                 { whitelist: [testAddrs[1]] })
    const challengeText = auth.getChallengeText()

    const associationToken = auth.V1Authentication.makeAssociationToken(testPairs[1], testPairs[0].getPublicKeyBuffer().toString('hex'))
    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, associationToken, undefined, writeScopes)

    console.log(`V1 storage validation: ${authPart}`)

    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], challengeText),
             errors.ValidationError, 'Wrong address must throw')
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[0], 'potatos are tasty'),
             errors.ValidationError, 'Wrong challenge text must throw')
    t.ok(authenticator.isAuthenticationValid(testAddrs[0], challengeText),
         'Good signature must pass')

    // write to /foo/bar or baz will succeed
    const s = new Readable()
    s._read = function noop() {}
    s.push('hello world')
    s.push(null)
    const s2 = new Readable()
    s2._read = function noop() {}
    s2.push('hello world')
    s2.push(null)
    const s3 = new Readable()
    s3._read = function noop() {}
    s3.push('hello world')
    s3.push(null)
    const s4 = new Readable()
    s4._read = function noop() {}
    s4.push('hello world')
    s4.push(null)

    server.handleRequest(testAddrs[0], '/foo/bar',
                         { 'content-type' : 'text/text',
                           'content-length': 4,
                           authorization }, s)
      .then(path => {
        // NOTE: the double-/ is *expected*
        t.equal(path, `http://test.com/${testAddrs[0]}//foo/bar`)
        t.equal(mockDriver.lastWrite.path, '/foo/bar')
        t.equal(mockDriver.lastWrite.storageTopLevel, testAddrs[0])
        t.equal(mockDriver.lastWrite.contentType, 'text/text')
      })
      .then(() => server.handleRequest(testAddrs[0], 'baz/foo.txt',
                         { 'content-length': 4,
                           authorization }, s2))
      .then(path => {
        t.equal(path, `http://test.com/${testAddrs[0]}/baz/foo.txt`)
        t.equal(mockDriver.lastWrite.path, 'baz/foo.txt')
        t.equal(mockDriver.lastWrite.storageTopLevel, testAddrs[0])
        t.equal(mockDriver.lastWrite.contentType, 'application/octet-stream')
      })
      .then(() => server.handleRequest(testAddrs[0], '/nope/foo.txt',
                         { 'content-length': 4,
                           authorization }, s3))
      .catch((e) => {
        t.throws(() => { 
          throw e 
        }, errors.ValidationError, 'invalid prefix should fail')
      })
      .then(() => server.handleRequest(testAddrs[0], '/foo/bar/nope.txt',
                        { 'content-length': 4,
                          authorization }, s4 ))
      .catch((e) => {
        t.throws(() => { 
          throw e 
        }, errors.ValidationError, 'putFile does not permit prefixes')
        t.end()
      })
  })
}
