import * as auth from '../../src/server/authentication.js'
import * as errors from '../../src/server/errors.js'
import { HubServer }  from '../../src/server/server.js'
import { ProofChecker } from '../../src/server/ProofChecker.js'
import { Readable, PassThrough } from 'stream'
import { DriverModel, ListFilesResult, ListFilesStatResult } from '../../src/server/driverModel.js'
import { InMemoryDriver } from './testDrivers/InMemoryDriver.js'
import { testPairs, testAddrs, createTestKeys } from './common.js'
import { MockAuthTimestampCache } from './MockAuthTimestampCache.js'
import * as integrationTestDrivers from './testDrivers/integrationTestDrivers.js'
import { timeout } from '../../src/server/utils.js'

const TEST_SERVER_NAME = 'test-server'
const TEST_AUTH_CACHE_SIZE = 10

class MockProofs extends ProofChecker {
  checkProofs() {
    return Promise.resolve(true)
  }
}

async function usingIntegrationDrivers(func: (driver: DriverModel, name: string) => Promise<any> | void) {
  for (const name in integrationTestDrivers.availableDrivers) {
    const driverInfo = integrationTestDrivers.availableDrivers[name];
    const driver = driverInfo.create();
    try {
      await driver.ensureInitialized();
      await func(driver, name);
    }
    finally {
      await driver.dispose();
    }
  }
}

async function usingMemoryDriver(func: (driver: InMemoryDriver) => Promise<any> | void) {
  const driver = await InMemoryDriver.spawn()
  try {
    await func(driver)
  } finally {
    await driver.dispose()
  }
}

test('validation tests', async () => {
  await usingIntegrationDrivers((mockDriver, name) => {
    // testing driver: ${name}

    const { testPairs, testAddrs } = createTestKeys(2);
    const server = new HubServer(mockDriver, new MockProofs(),
                                { serverName: TEST_SERVER_NAME, whitelist: [testAddrs[0]],
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null })
    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)
    const authPart0 = auth.LegacyAuthentication.makeAuthPart(testPairs[1], challengeText)
    const auth0 = `bearer ${authPart0}`

    // Non-whitelisted address should fail validation
    expect(() => server.validate(testAddrs[1], { authorization: auth0 }))
      .toThrow(errors.ValidationError)
    // Bad request headers should fail validation
    expect(() => server.validate(testAddrs[0], {}))
      .toThrow(errors.ValidationError)

    const authPart = auth.LegacyAuthentication.makeAuthPart(testPairs[0], challengeText)
    const authorization = `bearer ${authPart}`
    // White-listed address with good auth header should pass
    expect(() => server.validate(testAddrs[0], { authorization }))
      .not.toThrow()
    // Non white-listed address with good auth header should fail
    expect(() => server.validate(testAddrs[1], { authorization }))
      .toThrow()
  })
})

test('validation with huburl tests', async () => {
  await usingIntegrationDrivers((mockDriver, name) => {
    // testing driver: ${name}

    const { testPairs, testAddrs } = createTestKeys(2);
    const server = new HubServer(mockDriver, new MockProofs(),
                                { whitelist: [testAddrs[0]], requireCorrectHubUrl: true,
                                  serverName: TEST_SERVER_NAME, validHubUrls: ['https://testserver.com'],
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null })

    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)

    const authPartGood1 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, 'https://testserver.com/')
    const authPartGood2 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, 'https://testserver.com')
    const authPartBad1 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined)
    const authPartBad2 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, 'testserver.com')

    // Auth must include a hubUrl
    expect(() => server.validate(testAddrs[0], { authorization: `bearer ${authPartBad1}` }))
      .toThrow(errors.ValidationError)
    // Auth must include correct hubUrl
    expect(() => server.validate(testAddrs[0], { authorization: `bearer ${authPartBad2}` }))
      .toThrow(errors.ValidationError)

    // Address with good auth header should pass
    expect(() => server.validate(testAddrs[0], { authorization: `bearer ${authPartGood1}` }))
      .not.toThrow()
    // Address with good auth header should pass
    expect(() => server.validate(testAddrs[0], { authorization: `bearer ${authPartGood2}` }))
      .not.toThrow()
  })

})

test('validation with 2018 challenge texts', async () => {
  expect.assertions(5)
  await usingMemoryDriver(mockDriver => {
    const server = new HubServer(mockDriver, new MockProofs(),
                                { whitelist: [testAddrs[0]], requireCorrectHubUrl: true,
                                  serverName: TEST_SERVER_NAME, validHubUrls: ['https://testserver.com'],
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null })

    const challengeTexts = []
    challengeTexts.push(auth.getChallengeText(TEST_SERVER_NAME))
    auth.getLegacyChallengeTexts(TEST_SERVER_NAME).forEach(challengeText => challengeTexts.push(challengeText))

    const challenge2018 = challengeTexts.find(x => x.indexOf('2018') > 0)
    // Should find a valid 2018 challenge text
    expect(challenge2018).toBeTruthy()

    const authPartGood1 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeTexts[1], undefined, 'https://testserver.com/')
    const authPartGood2 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeTexts[1], undefined, 'https://testserver.com')
    const authPartBad1 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeTexts[1], undefined, undefined)
    const authPartBad2 = auth.V1Authentication.makeAuthPart(testPairs[0], challengeTexts[1], undefined, 'testserver.com')

    // Auth must include a hubUrl
    expect(() => server.validate(testAddrs[0], { authorization: `bearer ${authPartBad1}` }))
      .toThrow(errors.ValidationError)
    // Auth must include correct hubUrl
    expect(() => server.validate(testAddrs[0], { authorization: `bearer ${authPartBad2}` }))
      .toThrow(errors.ValidationError)

    // Address with good auth header should pass
    expect(() => server.validate(testAddrs[0], { authorization: `bearer ${authPartGood1}` }))
      .not.toThrow()
    // Address with good auth header should pass
    expect(() => server.validate(testAddrs[0], { authorization: `bearer ${authPartGood2}` }))
      .not.toThrow()
  })
})

test('handle request with readURL', async () => {
  expect.assertions(8)
  await usingMemoryDriver(mockDriver => {
    const server = new HubServer(mockDriver, new MockProofs(),
                                { whitelist: [testAddrs[0]], readURL: 'http://potato.com/',
                                  serverName: TEST_SERVER_NAME, authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null })
    server.authTimestampCache = new MockAuthTimestampCache()
    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)
    const authPart = auth.LegacyAuthentication.makeAuthPart(testPairs[0], challengeText)
    const authorization = `bearer ${authPart}`

    const s = new Readable()
    s.push('hello world')
    s.push(null)
    const s2 = new Readable()
    s2.push('hello world')
    s2.push(null)

    return server.handleRequest(testAddrs[0], 'foo.txt',
                        { 'content-type' : 'text/text',
                          'content-length': 400,
                          authorization }, s)
      .then(path => {
        expect(path.publicURL).toEqual(`http://potato.com/${testAddrs[0]}/foo.txt`)
        expect(mockDriver.lastWrite.path).toEqual('foo.txt')
        expect(mockDriver.lastWrite.storageTopLevel).toEqual(testAddrs[0])
        expect(mockDriver.lastWrite.contentType).toEqual('text/text')
      })
      .then(() => server.handleRequest(testAddrs[0], 'foo.txt',
                        { 'content-length': 400,
                          authorization }, s2))
      .then(path => {
        expect(path.publicURL).toEqual(`http://potato.com/${testAddrs[0]}/foo.txt`)
        expect(mockDriver.lastWrite.path).toEqual('foo.txt')
        expect(mockDriver.lastWrite.storageTopLevel).toEqual(testAddrs[0])
        expect(mockDriver.lastWrite.contentType).toEqual('application/octet-stream')
      })
  })
})

test('handle request', async () => {
  await usingMemoryDriver(async (mockDriver) => {
    const server = new HubServer(mockDriver, new MockProofs(),
                                { whitelist: [testAddrs[0]], serverName: TEST_SERVER_NAME,
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null })
    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)
    const authPart = auth.LegacyAuthentication.makeAuthPart(testPairs[0], challengeText)
    const authorization = `bearer ${authPart}`

    const s = new Readable()
    s.push('hello world')
    s.push(null)
    const s2 = new Readable()
    s2.push('hello world')
    s2.push(null)

    await server.handleRequest(testAddrs[0], 'foo.txt',
                        { 'content-type' : 'text/text',
                          'content-length': 400,
                          authorization }, s)
      .then(path => {
        expect(path.publicURL).toEqual(`${mockDriver.readUrl}${testAddrs[0]}/foo.txt`)
        expect(mockDriver.lastWrite.path).toEqual('foo.txt')
        expect(mockDriver.lastWrite.storageTopLevel).toEqual(testAddrs[0])
        expect(mockDriver.lastWrite.contentType).toEqual('text/text')
      })
      .then(() => server.handleRequest(testAddrs[0], 'foo.txt',
                        { 'content-length': 400,
                          authorization }, s2))
      .then(path => {
        expect(path.publicURL).toEqual(`${mockDriver.readUrl}${testAddrs[0]}/foo.txt`)
        expect(mockDriver.lastWrite.path).toEqual('foo.txt')
        expect(mockDriver.lastWrite.storageTopLevel).toEqual(testAddrs[0])
        expect(mockDriver.lastWrite.contentType).toEqual('application/octet-stream')
      })

    await server.handleDelete(testAddrs[0], 'foo.txt', { authorization })
      .then(() => {
        expect(true).toBeTruthy()
      })
  })
})

test('auth token timeout cache monitoring', async () => {
  await usingMemoryDriver(async (mockDriver) => {
    const server = new HubServer(mockDriver, new MockProofs(), {
                                  serverName: TEST_SERVER_NAME,
                                  authTimestampCacheSize: 4, port: 0, driver: null})
    const getJunkData = () => {
      const s = new Readable()
      s.push('hello world')
      s.push(null)
      return s
    }

    for (let i = 0; i < 10; i++) {
      const challengeText = auth.getChallengeText(TEST_SERVER_NAME)
      let authPart = auth.V1Authentication.makeAuthPart(testPairs[i], challengeText)
      let authorization = `bearer ${authPart}`
      for (let f = 0; f < 3; f++) {
        await server.handleRequest(testAddrs[i], '/foo/bar',
                                  { 'content-type' : 'text/text',
                                    'content-length': 400,
                                    authorization }, getJunkData())
      }
    }

    // Auth cache should have correct number of evictions
    expect(server.authTimestampCache.currentCacheEvictions).toEqual(6)
    // Auth cache should have correct item count
    expect(server.authTimestampCache.cache.size).toEqual(4)
    server.authTimestampCache.setupCacheEvictionLogger(1)
    await new Promise<void>((res) => setTimeout(() => res(), 10))
    // Auth cache eviction count should have been cleared by logger
    expect(server.authTimestampCache.currentCacheEvictions).toEqual(0)
  })
})

test('fail writes with auth token fetch errors', async () => {
  await usingMemoryDriver(async (driver) => {

    const testPath = `/${Date.now()}/${Math.random()}`;
    const { testPairs, testAddrs } = createTestKeys(2);

    const server = new HubServer(driver, new MockProofs(), {
                                  serverName: TEST_SERVER_NAME,
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null})
    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)
    let authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText)
    let authorization = `bearer ${authPart}`

    const getJunkData = () => {
      const s = new Readable()
      s.push('hello world')
      s.push(null)
      return s
    }

    // simulate a hub driver endpoint being offline during the auth token fetch
    server.authTimestampCache.readUrlPrefix = 'http://unreachable.local/'

    // no revocation timestamp has been set, but the write should still fail
    // since the revocation token cannot be retrieved (or 404ed) from the driver
    // read endpoint.
    // write with auth token failing to fetch should fail
    await expect(() => server.handleRequest(testAddrs[0], testPath, {
        'content-type': 'text/text',
        'content-length': 400,
        authorization
      }, getJunkData()))
      .rejects.toThrow(errors.ValidationError)

  })
})

test('fail writes with revoked auth token', async () => {
  await usingIntegrationDrivers(async (mockDriver, name) => {
    // testing driver: ${name}

    const testPath = `/${Date.now()}/${Math.random()}`;
    const { testPairs, testAddrs } = createTestKeys(2);

    const server = new HubServer(mockDriver, new MockProofs(), {
                                  serverName: TEST_SERVER_NAME,
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null})
    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)
    let authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText)
    let authorization = `bearer ${authPart}`

    const getJunkData = () => {
      const s = new Readable()
      s.push('hello world')
      s.push(null)
      return s
    }

    // no revocation timestamp has been set, write request should succeed
    await server.handleRequest(testAddrs[0], testPath,
                              { 'content-type' : 'text/text',
                                'content-length': 400,
                                authorization }, getJunkData())

    // revoke the auth token (setting oldest valid date into the future)
    const futureDate = (Date.now()/1000|0) + 10000
    await server.handleAuthBump(testAddrs[0], futureDate, { authorization })

    // write should fail with auth token creation date older than the revocation date
    // write with revoked auth token should fail
    await expect(() => server.handleRequest(testAddrs[0], testPath, { 'content-type' : 'text/text',
        'content-length': 400,
        authorization }, getJunkData()))
      .rejects.toThrow(errors.AuthTokenTimestampValidationError)

    // simulate auth token being dropped from cache and ensure it gets re-fetched
    // write with revoked auth token should fail if not in cache
    server.authTimestampCache.cache.reset()
    await expect(() => server.handleRequest(testAddrs[0], testPath, {
        'content-type' : 'text/text',
        'content-length': 400,
        authorization }, getJunkData()))
      .rejects.toThrow(errors.AuthTokenTimestampValidationError)

    // create a auth token with iat forced further into the future
    authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined, undefined, futureDate + 10000)
    authorization = `bearer ${authPart}`

    // request should succeed with a token iat newer than the revocation date
    await server.handleRequest(testAddrs[0], testPath,
                              { 'content-type' : 'text/text',
                                'content-length': 400,
                                authorization }, getJunkData())

    // simulate auth token being dropped from cache and ensure it gets re-fetched
    server.authTimestampCache.cache.reset()

    // request should still succeed after re-fetching to populate cache
    await server.handleRequest(testAddrs[0], testPath,
      { 'content-type' : 'text/text',
        'content-length': 400,
        authorization }, getJunkData())
  })
})

test('non-whitelisted address can bump revocation if bearing valid association token', async () => {
  await usingIntegrationDrivers(async (mockDriver, name) => {
    // testing driver: ${name}

    const testPath = `/${Date.now()}/${Math.random()}`;
    const { testPairs, testAddrs } = createTestKeys(2);

    const server = new HubServer(mockDriver, new MockProofs(), {
                                  serverName: TEST_SERVER_NAME,
                                  whitelist: [testAddrs[1]],
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null})

    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)
    const associationToken = auth.V1Authentication.makeAssociationToken(testPairs[1], testPairs[0].publicKey.toString('hex'))
    let authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, associationToken)
    let authorization = `bearer ${authPart}`

    const getJunkData = () => {
      const s = new Readable()
      s.push('hello world')
      s.push(null)
      return s
    }

    // no revocation timestamp has been set, write request should succeed
    await server.handleRequest(testAddrs[0], testPath,
                              { 'content-type' : 'text/text',
                                'content-length': 400,
                                authorization }, getJunkData())

    // revoke the auth token (setting oldest valid date into the future)
    const futureDate = (Date.now()/1000|0) + 10000
    await server.handleAuthBump(testAddrs[0], futureDate, { authorization })

    // write should fail with auth token creation date older than the revocation date
    // write with revoked auth token should fail
    await expect(() => server.handleRequest(testAddrs[0], testPath, {
        'content-type' : 'text/text',
        'content-length': 400,
        authorization }, getJunkData()))
      .rejects.toThrow(errors.AuthTokenTimestampValidationError)

    // sanity test to make sure writing to any given address still fails from a regular validation error
    await expect(() => server.handleRequest(testAddrs[4], testPath, {
        'content-type' : 'text/text',
        'content-length': 400,
        authorization }, getJunkData()))
      .rejects.toThrow(errors.ValidationError)

    // create a auth token with iat forced further into the future
    authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, associationToken, undefined, undefined, futureDate + 10000)
    authorization = `bearer ${authPart}`

    // request should succeed with a token iat newer than the revocation date
    await server.handleRequest(testAddrs[0], testPath,
                              { 'content-type' : 'text/text',
                                'content-length': 400,
                                authorization }, getJunkData())
  })
})

test('auth token bearer can only bump the address of its signer', async () => {

  await usingIntegrationDrivers(async (mockDriver, name) => {

    // testing driver: ${name}

    const testPath = `/${Date.now()}/${Math.random()}`;
    const { testPairs, testAddrs } = createTestKeys(2);

    const server = new HubServer(mockDriver, new MockProofs(), {
                                  serverName: TEST_SERVER_NAME,
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE,
                                  port: 0, driver: null})
    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)
    let authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText)
    let authorization = `bearer ${authPart}`

    const getJunkData = () => {
      const s = new Readable()
      s.push('hello world')
      s.push(null)
      return s
    }

    // no revocation timestamp has been set, write request should succeed
    await server.handleRequest(testAddrs[0], testPath,
                              { 'content-type' : 'text/text',
                                'content-length': 400,
                                authorization }, getJunkData())

    // attempting to bump an address other than the signer should fail
    // auth token bearer should only be able to bump the address of its signer
    await expect(() => server.handleAuthBump(testAddrs[1], (Date.now()/1000|0) + 10000, { authorization }))
      .rejects.toThrow(errors.ValidationError)

    // confirm that bump failed and that write still succeeds
    await server.handleRequest(testAddrs[0], testPath,
                              { 'content-type' : 'text/text',
                                'content-length': 400,
                                authorization }, getJunkData())
  })
})

test('handle archival writes', async () => {
  await usingMemoryDriver(async (mockDriver) => {
    const scopes = [
      {
        scope: 'putFileArchival',
        domain: '/foo/bar',
      },
      {
        scope: 'putFileArchivalPrefix',
        domain: 'baz'
      }
    ]

    const server = new HubServer(mockDriver, new MockProofs(),
                                { whitelist: [testAddrs[0]], serverName: TEST_SERVER_NAME,
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null })
    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)

    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined, scopes)

    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    // Wrong address must throw
    expect(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
    // Wrong challenge text must throw
    expect(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']))
      .toThrow(errors.ValidationError)
    // Good signature must pass
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText])).toBeTruthy()

    // scopes must be present
    const authScopes = authenticator.getAuthenticationScopes()
    // scope 0 is putFileArchival
    expect(authScopes[0].scope).toEqual('putFileArchival')
    // scope 0 is for /foo/bar
    expect(authScopes[0].domain).toEqual('/foo/bar')
    // scope 1 is putFileArchivalPrefix
    expect(authScopes[1].scope).toEqual('putFileArchivalPrefix')
    // scope 1 is for baz
    expect(authScopes[1].domain).toEqual('baz')

    const getDataStream = () => {
      const s = new PassThrough()
      s.end('hello world')
      return s
    }

    await server.handleRequest(testAddrs[0], 'baz/foo.txt', {
      'content-length': 400,
      authorization }, getDataStream())
    await timeout(1)
    expect(mockDriver.files.has(`${testAddrs[0]}/baz/foo.txt`)).toEqual(true)
    expect(mockDriver.files.size).toEqual(1)

    await server.handleRequest(testAddrs[0], 'baz/foo.txt', {
      'content-length': 400,
      authorization }, getDataStream())
    await timeout(1)
    expect(mockDriver.files.size).toEqual(2)
    const historyEntries = [...mockDriver.files.keys()].filter(k => k.match(RegExp(`${testAddrs[0]}/baz/.history.[0-9]+.[A-Za-z0-9]+.foo.txt`)))
    expect(historyEntries.length === 1).toEqual(true)


    await server.handleRequest(testAddrs[0], 'baz/foo.txt', {
      'content-length': 400,
      authorization }, getDataStream())
    await timeout(1)
    expect(mockDriver.files.size).toEqual(3)
    const historyEntries2 = [...mockDriver.files.keys()].filter(k => k.match(RegExp(`${testAddrs[0]}/baz/.history.[0-9]+.[A-Za-z0-9]+.foo.txt`)))
    expect(historyEntries2.length === 2).toEqual(true)

    await server.handleRequest(testAddrs[0], '/foo/bar', {
      'content-type' : 'text/text',
      'content-length': 400,
      authorization }, getDataStream())
    await timeout(1)
    expect(mockDriver.files.size).toEqual(4)

    await server.handleRequest(testAddrs[0], '/foo/bar',{
      'content-type' : 'text/text',
      'content-length': 400,
      authorization }, getDataStream())
    await timeout(1)
    expect(mockDriver.files.size).toEqual(5)
    expect(mockDriver.files.has(`${testAddrs[0]}//foo/bar`)).toEqual(true)
    const historyEntries3 = [...mockDriver.files.keys()].filter(k => k.match(RegExp(`${testAddrs[0]}//foo/.history.[0-9]+.[A-Za-z0-9]+.bar`)))
    expect(historyEntries3.length === 1).toEqual(true)

    await server.handleDelete(testAddrs[0], '/foo/bar', { authorization })
    await timeout(1)
    expect(mockDriver.files.size).toEqual(5)
    expect(mockDriver.files.has(`${testAddrs[0]}//foo/bar`)).toEqual(false)
    const historyEntries4 = [...mockDriver.files.keys()].filter(k => k.match(RegExp(`${testAddrs[0]}//foo/.history.[0-9]+.[A-Za-z0-9]+.bar`)))
    expect(historyEntries4.length === 2).toEqual(true)

    await server.handleDelete(testAddrs[0], 'baz/foo.txt', { authorization })
    await timeout(1)
    expect(mockDriver.files.size).toEqual(5)
    expect(mockDriver.files.has(`${testAddrs[0]}/baz/foo.txt`)).toEqual(false)
    const historyEntries5 = [...mockDriver.files.keys()].filter(k => k.match(RegExp(`${testAddrs[0]}/baz/.history.[0-9]+.[A-Za-z0-9]+.foo.txt`)))
    expect(historyEntries5.length === 3).toEqual(true)

    await server.handleRequest(testAddrs[0], 'baz/foo.txt', {
      'content-length': 400,
      authorization }, getDataStream())
    await timeout(1)
    expect(mockDriver.files.size).toEqual(6)
    expect(mockDriver.files.has(`${testAddrs[0]}/baz/foo.txt`)).toEqual(true)
    const historyEntries6 = [...mockDriver.files.keys()].filter(k => k.match(RegExp(`${testAddrs[0]}/baz/.history.[0-9]+.[A-Za-z0-9]+.foo.txt`)))
    expect(historyEntries6.length === 3).toEqual(true)

    const listFilesHistorical1 = await server.handleListFiles(testAddrs[0], null as string, false, { authorization }) as ListFilesResult
    const listFilesHistorical1Ok = !listFilesHistorical1.entries.find(k => k.includes('.history.'))
    // list files with putFileArchival should not include historical files
    expect(listFilesHistorical1Ok).toEqual(true)

    const listFilesHistorical2 = await server.handleListFiles(testAddrs[0], null as string, true, { authorization }) as ListFilesStatResult
    const listFilesHistorical2Ok = !listFilesHistorical2.entries.find(k => k.name.includes('.history.'))
    // list files stat with putFileArchival should not include historical files
    expect(listFilesHistorical2Ok).toEqual(true)

    // test historical file pagination
    for (let i = 0; i < 10; i++) {
      await server.handleRequest(testAddrs[0], `baz/foo_page_test_${i}.txt`, {
        'content-length': 400,
        authorization }, getDataStream())
      await timeout(1)
    }
    const allFiles = await server.handleListFiles(testAddrs[0], null as string, false, { authorization }) as ListFilesResult
    for (const entry of allFiles.entries) {
      await server.handleDelete(testAddrs[0], entry, { authorization })
    }
    await server.handleRequest(testAddrs[0], `baz/foo_page_test_last.txt`, {
      'content-length': 400,
      authorization }, getDataStream())
    await timeout(1)

    mockDriver.pageSize = 2
    const listFilesEmpty = await server.handleListFiles(testAddrs[0], null as string, false, { authorization })
    // list files with all filtered entries should return a single entry
    expect(listFilesEmpty.entries.length).toEqual(1)
    // list files with all filtered entries should have null as the single entry
    expect(listFilesEmpty.entries[0]).toEqual(null)

    const listFilesEmpty2 = await server.handleListFiles(testAddrs[0], null as string, true, { authorization })
    // list files with all filtered entries should return a single entry
    expect(listFilesEmpty2.entries.length).toEqual(1)
    // list files with all filtered entries should have null as the single entry
    expect(listFilesEmpty2.entries[0]).toEqual(null)

    // invalid path prefix should fail delete
    await expect(async () => await server.handleDelete(testAddrs[0], '/nope/foo.txt', { authorization }))
      .rejects.toThrow(errors.ValidationError)
    // deleteFile does not allow prefixes
    await expect(async () => await server.handleDelete(testAddrs[0], '/foo/bar/nope.txt', { authorization }))
      .rejects.toThrow(errors.ValidationError)
  })
})

test('handle scoped deletes', async () => {
  await usingMemoryDriver(mockDriver => {
    const scopes = [
      {
        scope: 'deleteFile',
        domain: '/foo/bar',
      },
      {
        scope: 'deleteFilePrefix',
        domain: 'baz'
      },
      {
        scope: 'putFile',
        domain: '/foo/bar',
      },
      {
        scope: 'putFilePrefix',
        domain: 'baz'
      }
    ]

    const server = new HubServer(mockDriver, new MockProofs(),
                                { whitelist: [testAddrs[0]], serverName: TEST_SERVER_NAME,
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null })
    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)

    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined, scopes)

    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    // Wrong address must throw
    expect(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
    // Wrong challenge text must throw
    expect(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']))
      .toThrow(errors.ValidationError)
    // Good signature must pass
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText])).toBeTruthy()

    // scopes must be present
    const authScopes = authenticator.getAuthenticationScopes()
    // scope 0 is deletefile
    expect(authScopes[0].scope).toEqual('deleteFile')
    // scope 0 is for /foo/bar
    expect(authScopes[0].domain).toEqual('/foo/bar')
    // scope 1 is deleteFilePrefix
    expect(authScopes[1].scope).toEqual('deleteFilePrefix')
    // scope 1 is for baz
    expect(authScopes[1].domain).toEqual('baz')

    const s = new Readable()
    s.push('hello world')
    s.push(null)
    const s2 = new Readable()
    s2.push('hello world')
    s2.push(null)
    const s3 = new Readable()
    s3.push('hello world')
    s3.push(null)
    const s4 = new Readable()
    s4.push('hello world')
    s4.push(null)

    return server.handleRequest(testAddrs[0], '/foo/bar',
                        { 'content-type' : 'text/text',
                          'content-length': 400,
                          authorization }, s)
      .then(() => server.handleDelete(testAddrs[0], '/foo/bar', { authorization }))
      .then(() => server.handleRequest(testAddrs[0], 'baz/foo.txt',
                        { 'content-length': 400,
                          authorization }, s2))
      .then(() => server.handleDelete(testAddrs[0], '/nope/foo.txt', { authorization }))
      .catch((e) => {
        // invalid path prefix should fail
        expect(() => { throw e }).toThrow(errors.ValidationError)
      })
      .then(() => server.handleDelete(testAddrs[0], '/foo/bar/nope.txt', { authorization }))
      .catch((e) => {
        // deleteFile does not allow prefixes
        expect(() => { throw e }).toThrow(errors.ValidationError)
      })
  })
})

test('handle scoped writes', async () => {
  await usingMemoryDriver(mockDriver => {
    const writeScopes = [
      {
        scope: 'putFile',
        domain: '/foo/bar',
      },
      {
        scope: 'putFilePrefix',
        domain: 'baz'
      }
    ]

    const server = new HubServer(mockDriver, new MockProofs(),
                                { whitelist: [testAddrs[0]], serverName: TEST_SERVER_NAME,
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null })
    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)

    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined, writeScopes)

    console.log(`V1 storage validation: ${authPart}`)

    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    // Wrong address must throw
    expect(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
    // Wrong challenge text must throw
    expect(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']))
      .toThrow(errors.ValidationError)
    // Good signature must pass
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText])).toBeTruthy()

    // scopes must be present
    const authScopes = authenticator.getAuthenticationScopes()
    // scope 0 is putfile
    expect(authScopes[0].scope).toEqual('putFile')
    // scope 0 is for /foo/bar
    expect(authScopes[0].domain).toEqual('/foo/bar')
    // scope 1 is putFilePrefix
    expect(authScopes[1].scope).toEqual('putFilePrefix')
    // scope 1 is for baz
    expect(authScopes[1].domain).toEqual('baz')

    // write to /foo/bar or /baz will succeed
    const s = new Readable()
    s.push('hello world')
    s.push(null)
    const s2 = new Readable()
    s2.push('hello world')
    s2.push(null)
    const s3 = new Readable()
    s3.push('hello world')
    s3.push(null)
    const s4 = new Readable()
    s4.push('hello world')
    s4.push(null)

    return server.handleRequest(testAddrs[0], '/foo/bar',
                        { 'content-type' : 'text/text',
                          'content-length': 400,
                          authorization }, s)
      .then(path => {
        // NOTE: the double-/ is *expected*
        expect(path.publicURL).toEqual(`${mockDriver.readUrl}${testAddrs[0]}//foo/bar`)
        expect(mockDriver.lastWrite.path).toEqual('/foo/bar')
        expect(mockDriver.lastWrite.storageTopLevel).toEqual(testAddrs[0])
        expect(mockDriver.lastWrite.contentType).toEqual('text/text')
      })
      .then(() => server.handleRequest(testAddrs[0], 'baz/foo.txt',
                        { 'content-length': 400,
                          authorization }, s2))
      .then(path => {
        expect(path.publicURL).toEqual(`${mockDriver.readUrl}${testAddrs[0]}/baz/foo.txt`)
        expect(mockDriver.lastWrite.path).toEqual('baz/foo.txt')
        expect(mockDriver.lastWrite.storageTopLevel).toEqual(testAddrs[0])
        expect(mockDriver.lastWrite.contentType).toEqual('application/octet-stream')
      })
      .then(() => server.handleRequest(testAddrs[0], '/nope/foo.txt',
                        { 'content-length': 400,
                          authorization }, s3))
      .catch((e) => {
        // invalid path prefix should fail
        expect(() => { throw e }).toThrow(errors.ValidationError)
      })
      .then(() => server.handleRequest(testAddrs[0], '/foo/bar/nope.txt',
                                      { 'content-length': 400,
                                      authorization }, s4))
      .catch((e) => {
        // putFile does not allow prefixes
        expect(() => { throw e }).toThrow(errors.ValidationError)
      })
  })
})


test('handle scoped deletes with association tokens', async () => {
  await usingMemoryDriver(mockDriver => {
    const scopes = [
      {
        scope: 'deleteFile',
        domain: '/foo/bar',
      },
      {
        scope: 'deleteFilePrefix',
        domain: 'baz'
      },
      {
        scope: 'putFile',
        domain: '/foo/bar',
      },
      {
        scope: 'putFilePrefix',
        domain: 'baz'
      }
    ]

    const server = new HubServer(mockDriver, new MockProofs(),
                                { whitelist: [testAddrs[1]], serverName: TEST_SERVER_NAME,
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null })
    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)

    const associationToken = auth.V1Authentication.makeAssociationToken(testPairs[1], testPairs[0].publicKey.toString('hex'))
    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, associationToken, undefined, scopes)

    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    // Wrong address must throw
    expect(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
    // Wrong challenge text must throw
    expect(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']))
      .toThrow(errors.ValidationError)
    // Good signature must pass
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText])).toBeTruthy()

    // write to /foo/bar or baz will succeed
    const s = new Readable()
    s.push('hello world')
    s.push(null)
    const s2 = new Readable()
    s2.push('hello world')
    s2.push(null)
    const s3 = new Readable()
    s3.push('hello world')
    s3.push(null)
    const s4 = new Readable()
    s4.push('hello world')
    s4.push(null)

    return server.handleRequest(testAddrs[0], '/foo/bar',
                        { 'content-type' : 'text/text',
                          'content-length': 400,
                          authorization }, s)
      .then(() => server.handleDelete(testAddrs[0], '/foo/bar', { authorization }))
      .then(() => server.handleRequest(testAddrs[0], 'baz/foo.txt',
                        { 'content-length': 400,
                          authorization }, s2))
      .then(() => server.handleDelete(testAddrs[0], 'baz/foo.txt', { authorization }))
      .then(() => server.handleDelete(testAddrs[0], '/nope/foo.txt', { authorization }))
      .catch((e: any) => {
        // invalid prefix should fail
        expect(() => { throw e }).toThrow(errors.ValidationError)
      })
      .then(() => server.handleDelete(testAddrs[0], '/foo/bar/nope.txt', { authorization }))
      .catch((e: any) => {
        // deleteFile does not permit prefixes
        expect(() => { throw e }).toThrow(errors.ValidationError)
      })
    })
})

test('handle scoped writes with association tokens', async () => {
  await usingMemoryDriver(mockDriver => {
    const writeScopes = [
      {
        scope: 'putFile',
        domain: '/foo/bar',
      },
      {
        scope: 'putFilePrefix',
        domain: 'baz'
      }
    ]

    const server = new HubServer(mockDriver, new MockProofs(),
                                { whitelist: [testAddrs[1]], serverName: TEST_SERVER_NAME,
                                  authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null })
    const challengeText = auth.getChallengeText(TEST_SERVER_NAME)

    const associationToken = auth.V1Authentication.makeAssociationToken(testPairs[1], testPairs[0].publicKey.toString('hex'))
    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, associationToken, undefined, writeScopes)

    console.log(`V1 storage validation: ${authPart}`)

    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    // Wrong address must throw
    expect(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
    // Wrong challenge text must throw
    expect(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']))
      .toThrow(errors.ValidationError)
    // Good signature must pass
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText])).toBeTruthy()

    // write to /foo/bar or baz will succeed
    const s = new Readable()
    s.push('hello world')
    s.push(null)
    const s2 = new Readable()
    s2.push('hello world')
    s2.push(null)
    const s3 = new Readable()
    s3.push('hello world')
    s3.push(null)
    const s4 = new Readable()
    s4.push('hello world')
    s4.push(null)

    return server.handleRequest(testAddrs[0], '/foo/bar',
                        { 'content-type' : 'text/text',
                          'content-length': 400,
                          authorization }, s)
      .then(path => {
        // NOTE: the double-/ is *expected*
        expect(path.publicURL).toEqual(`${mockDriver.readUrl}${testAddrs[0]}//foo/bar`)
        expect(mockDriver.lastWrite.path).toEqual('/foo/bar')
        expect(mockDriver.lastWrite.storageTopLevel).toEqual(testAddrs[0])
        expect(mockDriver.lastWrite.contentType).toEqual('text/text')
      })
      .then(() => server.handleRequest(testAddrs[0], 'baz/foo.txt',
                        { 'content-length': 400,
                          authorization }, s2))
      .then(path => {
        expect(path.publicURL).toEqual(`${mockDriver.readUrl}${testAddrs[0]}/baz/foo.txt`)
        expect(mockDriver.lastWrite.path).toEqual('baz/foo.txt')
        expect(mockDriver.lastWrite.storageTopLevel).toEqual(testAddrs[0])
        expect(mockDriver.lastWrite.contentType).toEqual('application/octet-stream')
      })
      .then(() => server.handleRequest(testAddrs[0], '/nope/foo.txt',
                        { 'content-length': 400,
                          authorization }, s3))
      .catch((e: any) => {
        // invalid prefix should fail
        expect(() => { throw e }).toThrow(errors.ValidationError)
      })
      .then(() => server.handleRequest(testAddrs[0], '/foo/bar/nope.txt',
                        { 'content-length': 400,
                          authorization }, s4 ))
      .catch((e: any) => {
        // putFile does not permit prefixes
        expect(() => { throw e }).toThrow(errors.ValidationError)
      })
    })
})
