import * as auth from '../../src/server/authentication.js'
import * as os from 'os'
import * as fs from 'fs'
import * as crypto from 'crypto'
import request from 'supertest'
import { ecPairToAddress } from 'blockstack'

import fetchMock from 'fetch-mock'
import NodeFetch from 'node-fetch'

import { makeHttpServer } from '../../src/server/http.js'
import DiskDriver from '../../src/server/drivers/diskDriver.js'
import { AZ_CONFIG_TYPE } from '../../src/server/drivers/AzDriver.js'
import { addMockFetches } from './testDrivers.test.js'
import { makeMockedAzureDriver } from './testDrivers/mockTestDrivers.js'

import { testPairs, testAddrs } from './common.js'
import InMemoryDriver from './testDrivers/InMemoryDriver.js'
import { MockAuthTimestampCache } from './MockAuthTimestampCache.js'
import { HubConfigInterface } from '../../src/server/config.js'
import { PassThrough } from 'stream';
import * as errors from '../../src/server/errors.js'
import { readStream, timeout } from '../../src/server/utils.js'

const TEST_SERVER_NAME = 'test-server'
const TEST_AUTH_CACHE_SIZE = 10


describe('test http with InMemory driver', () => {
  test('reject concurrent requests to same resource (InMemory driver)', async () => {
    const inMemoryDriver = await InMemoryDriver.spawn()
    try {
      const makeResult = makeHttpServer({ driverInstance: inMemoryDriver, serverName: TEST_SERVER_NAME, authTimestampCacheSize: TEST_AUTH_CACHE_SIZE, port: 0, driver: null })
      const app = makeResult.app
      const server = makeResult.server
      const asyncMutexScope = makeResult.asyncMutex
      server.authTimestampCache = new MockAuthTimestampCache()

      const sk = testPairs[1]
      const fileContents = sk.toWIF()
      const blob = Buffer.from(fileContents)

      const address = ecPairToAddress(sk)

      let response = await request(app)
        .get('/hub_info/')
        .expect(200)

      const challenge = JSON.parse(response.text).challenge_text
      const authPart = auth.V1Authentication.makeAuthPart(sk, challenge)
      const authorization = `bearer ${authPart}`

      const passThrough1 = new PassThrough()
      passThrough1.write("stuff", "utf8")

      const resolves: Set<() => void> = new Set()
      inMemoryDriver.onWriteMiddleware.add((args) => {
        return new Promise(resolve => {
          resolves.add(resolve)
        })
      })

      const reqPromise1 = request(app).post(`/store/${address}/helloWorld`)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .send(blob)
        .expect(202)

      const reqPromise2 = request(app).post(`/store/${address}/helloWorld`)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .send(blob)
        .expect(409)

      const reqPromise3 = request(app).delete(`/delete/${address}/helloWorld`)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .send(blob)
        .expect(409)

      const releaseRequests = (async () => {
        while (resolves.size === 0) {
          await timeout(10)
        }
        for (const release of resolves) {
          release()
        }
      })()

      // Released middleware request resolves
      await Promise.all([reqPromise2, reqPromise1, reqPromise3, releaseRequests])

      // First request (store) passes with no concurrent conflict
      await reqPromise1
      // Second request (store) fails with concurrent conflict
      await reqPromise2
      // Third request (delete) fails with concurrent conflict
      await reqPromise3

      inMemoryDriver.onWriteMiddleware.clear()

      // Fourth request (store) passes with no concurrent conflict
      await request(app).post(`/store/${address}/helloWorld`)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .send(blob)
        .expect(202)

      // Fifth request (delete) passes with no concurrent conflict
      await request(app).delete(`/delete/${address}/helloWorld`)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .send(blob)
        .expect(202)

      // Should have no open mutexes when no requests are open
      expect(asyncMutexScope.openedCount).toEqual(0)
    } finally {
      await inMemoryDriver.dispose()
    }
  });

  test('handle request (InMemory driver)', async () => {
    expect.assertions(7)
    const fetch = NodeFetch
    const inMemoryDriver = await InMemoryDriver.spawn()
    try {
      const { app, server } = makeHttpServer({
        driverInstance: inMemoryDriver,
        serverName: TEST_SERVER_NAME,
        authTimestampCacheSize: TEST_AUTH_CACHE_SIZE,
        port: 0,
        driver: null,
        // ~52 byte max limit
        maxFileUploadSize: 0.00005
      })
      const sk = testPairs[1]
      const fileContents = sk.toWIF()
      const blob = Buffer.from(fileContents)

      const address = ecPairToAddress(sk)
      const path = `/store/${address}/helloWorld`
      const listPath = `/list-files/${address}`

      // test CORs response
      let corsReq = await request(app).options(path)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type')
        .expect(204)
        .expect('Access-Control-Max-Age', '86400')

      const hubInfo = await request(app)
        .get('/hub_info/')
        .expect(200)

      const challenge = JSON.parse(hubInfo.text).challenge_text
      const authPart = auth.V1Authentication.makeAuthPart(sk, challenge)
      const authorization = `bearer ${authPart}`

      const writeResponse = await request(app).post(path)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .set('If-None-Match', '*')
        .send(blob)
        .expect(202)

      const url = JSON.parse(writeResponse.text).publicURL
      const etag = writeResponse.body.etag
      // Must return URL
      expect(url).toBeTruthy()

      const resp = await fetch(url)
      const text = await resp.text()
      const headerEtag = resp.headers.get('etag')
      // Contents returned must be correct
      expect(text).toEqual(fileContents)
      // Response headers should contain correct etag
      expect(etag).toEqual(crypto.createHash('md5').update(text).digest('hex'))

      const filesResponse = await request(app).post(listPath)
        .set('Content-Type', 'application/json')
        .set('Authorization', authorization)
        .expect(202)

      const files = JSON.parse(filesResponse.text)
      // Should return one file
      expect(files.entries.length).toEqual(1)
      // Should be helloworld
      expect(files.entries[0]).toEqual('helloWorld')
      // Response is missing a page
      expect(files.hasOwnProperty('page')).toBeTruthy()

      const updatedBlob = Buffer.from('new text')
      await request(app).post(path)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .set('If-Match', etag)
        .send(updatedBlob)
        .expect(202)

      inMemoryDriver.filesInProgress.set(`${address}/helloWorld`, null)
      await request(app).post(path)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .send(blob)
        .expect(409)

      await request(app).post(path)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .set('Content-Length', '9999999')
        .expect(413)

      await request(app).post(path)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .set('If-Match', 'bad-etag')
        .send(blob)
        .expect(412)

      await request(app).post(path)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .set('If-Match', 'both-tags')
        .set('If-None-Match', 'both-tags')
        .send(blob)
        .expect(412)

      await request(app).post(path)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .set('If-None-Match', 'not-a-wildcard')
        .send(blob)
        .expect(412)

      await request(app).post(path)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .set('If-None-Match', '*')
        .send(blob)
        .expect(412)

      // payload should have been detected as too large
      try {
        const largePayload = new PassThrough()
        largePayload.end('x'.repeat(1000))
        await server.handleRequest(address, 'helloWorld2', { 'content-type': 'application/octet-stream', 'content-length': '10', authorization: authorization}, largePayload);
      } catch (err) {
        // payload should have been detected as too large
        expect(() => { throw err }).toThrow(errors.PayloadTooLargeError)
      }

    } finally {
      await inMemoryDriver.dispose()
    }
  })

  test('handle revocation via POST', async () => {
    const inMemoryDriver = await InMemoryDriver.spawn()
    try {
      const { app } = makeHttpServer({
        driverInstance: inMemoryDriver,
        serverName: TEST_SERVER_NAME,
        authTimestampCacheSize: TEST_AUTH_CACHE_SIZE,
        port: 0, driver: null
      })
      const sk = testPairs[1]
      const fileContents = sk.toWIF()
      const blob = Buffer.from(fileContents)

      const address = ecPairToAddress(sk)
      const path = `/store/${address}/helloWorld`
      const deletePath = `/delete/${address}/helloWorld`

      const hubInfo = await request(app)
        .get('/hub_info/')
        .expect(200)

      const challenge = hubInfo.body.challenge_text
      const authPart = auth.V1Authentication.makeAuthPart(sk, challenge)
      const authorization = `bearer ${authPart}`

      await request(app).post(path)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .send(blob)
        .expect(202)

      await request(app).delete(deletePath)
        .set('Authorization', authorization)
        .send()
        .expect(202)

      await request(app).delete(`/delete/${address}/non-existent-file`)
        .set('Authorization', authorization)
        .send()
        .expect(404)

      await request(app).delete(`/delete/${address}/../traversal`)
        .set('Authorization', authorization)
        .send()
        .expect(403)

      await request(app).delete(`/delete/${testAddrs[4]}/anyfile`)
        .set('Authorization', authorization)
        .send()
        .expect(401)

      const revokeResponse = await request(app)
        .post(`/revoke-all/${address}`)
        .set('Authorization', authorization)
        .send({oldestValidTimestamp: (Date.now()/1000|0) + 3000})
        .expect(202)
      // Revoke POST request should have returned success status
      expect(revokeResponse.body.status).toEqual('success')

      const failedRevokeResponse = await request(app)
        .post(`/revoke-all/${testAddrs[2]}`)
        .set('Authorization', authorization)
        .send({oldestValidTimestamp: (Date.now()/1000|0) + 3000})
        .expect(401)
      // Revoke request should have returned correct error type
      expect(failedRevokeResponse.body.error).toEqual('ValidationError')

      await request(app)
        .post(`/revoke-all/${testAddrs[2]}`)
        .set('Authorization', authorization)
        .send({wrongField: 1234})
        .expect(400)

      await request(app)
        .post(`/revoke-all/${testAddrs[2]}`)
        .set('Authorization', authorization)
        .send({oldestValidTimestamp: "NaN"})
        .expect(400)

      await request(app)
        .post(`/revoke-all/${testAddrs[2]}`)
        .set('Authorization', authorization)
        .send({oldestValidTimestamp: -4343343})
        .expect(400)

      const failedStoreResponse = await request(app).post(path)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .send(blob)
        .expect(401)
      // Store request should have returned correct error type
      expect(failedStoreResponse.body.error).toEqual('AuthTokenTimestampValidationError')

      const listPath = `/list-files/${address}`
      const failedFilesResponse = await request(app).post(listPath)
        .set('Content-Type', 'application/json')
        .set('Authorization', authorization)
        .expect(401)
      // Store request should have returned correct error type
      expect(failedFilesResponse.body.error).toEqual('AuthTokenTimestampValidationError')

      const failedDeleteResponse = await request(app).delete(deletePath)
        .set('Authorization', authorization)
        .send()
        .expect(401)
      // Delete request should have returned correct error type
      expect(failedDeleteResponse.body.error).toEqual('AuthTokenTimestampValidationError')
    } finally {
      await inMemoryDriver.dispose()
    }
  })
})


describe('test HTTP driver option', () => {
  test('makeHttpServer "driver" config', () => {
    expect(() => makeHttpServer({
        driver: 'disk',
        readURL: 'test/',
        serverName: TEST_SERVER_NAME,
        authTimestampCacheSize: TEST_AUTH_CACHE_SIZE,
        diskSettings: {
          storageRootDirectory: os.tmpdir()
        },
        port: 0
    } as HubConfigInterface))
      .not.toThrow()
  })

  test('makeHttpServer "driverInstance" config', () => {
    const driver = new DiskDriver({
      readURL: 'test/',
      diskSettings: {
        storageRootDirectory: os.tmpdir()
      }
    })
    expect(() => makeHttpServer({
      driverInstance: driver,
      serverName: TEST_SERVER_NAME,
      authTimestampCacheSize: TEST_AUTH_CACHE_SIZE,
      port: 0,
      driver: null
    }))
      .not.toThrow()
  })

  test('makeHttpServer missing driver config', () => {
    expect(() => makeHttpServer({
      serverName: TEST_SERVER_NAME,
      authTimestampCacheSize: TEST_AUTH_CACHE_SIZE,
      port: 0,
      driver: null
    }))
      .toThrow(Error)
  })
})

jest.mock('@azure/storage-blob')

describe('test HTTP with Azure', () => {
  const azConfigPath = process.env.AZ_CONFIG_PATH
  let config : HubConfigInterface & AZ_CONFIG_TYPE = {
    'azCredentials': {
      'accountName': 'mock-azure',
      'accountKey': 'mock-azure-key'
    },
    'bucket': 'spokes',
    serverName: TEST_SERVER_NAME,
    authTimestampCacheSize: TEST_AUTH_CACHE_SIZE,
    port: 0,
    driver: null
  }
  let mockTest = true

  if (azConfigPath) {
    config = JSON.parse(fs.readFileSync(azConfigPath, {encoding: 'utf8'}))
    config.driver = 'azure'
    config.serverName = TEST_SERVER_NAME
    config.authTimestampCacheSize = TEST_AUTH_CACHE_SIZE
    mockTest = false
  }

  let dataMap: {key: string, data: string}[] = []
  if (mockTest) {
    const mockedObj = makeMockedAzureDriver()
    dataMap = mockedObj.dataMap
    config.driverClass = mockedObj.driverClass
  } else {

  }

  test('auth failure', () => {
    let { app, server } = makeHttpServer(config)
    server.authTimestampCache = new MockAuthTimestampCache()
    let sk = testPairs[1]
    let fileContents = sk.toWIF()
    let blob = Buffer.from(fileContents)

    let address = ecPairToAddress(sk)
    let path = `/store/${address}/helloWorld`
    let prefix = ''
    let authorizationHeader = ''

    request(app).get('/hub_info/')
      .expect(200)
      .then((response) => {
        prefix = JSON.parse(response.text).read_url_prefix
        const challenge = JSON.parse(response.text).challenge_text
        const authPart = auth.V1Authentication.makeAuthPart(sk, challenge + 'f')
        return `bearer ${authPart}`
      })
      .then((authorization) => {
        authorizationHeader = authorization
        return request(app).post(path)
            .set('Content-Type', 'application/octet-stream')
            .set('Authorization', authorization)
            .send(blob)
            .expect(401)
      })
      .then((response) => {
        let json = JSON.parse(response.text)
        // Must return json
        expect(json).toBeTruthy()
        // console.log(json)
      })
      .catch((err) => {
        // Unexpected err
        expect(true).toBeFalsy()
        // console.log(`Unexpected err: ${err}`)
      })
      .then(() => { fetchMock.restore(); })
  })

  test('handle request', () => {
    let fetch = fetchMock.sandbox()
    let { app, server } = makeHttpServer(config)
    server.authTimestampCache = new MockAuthTimestampCache()
    let sk = testPairs[1]
    let fileContents = sk.toWIF()
    let blob = Buffer.from(fileContents)

    let address = ecPairToAddress(sk)
    let path = `/store/${address}/helloWorld`
    let listPath = `/list-files/${address}`
    let prefix = ''
    let authorizationHeader = ''

    request(app).get('/hub_info/')
      .expect(200)
      .then((response) => {
        prefix = JSON.parse(response.text).read_url_prefix
        const challenge = JSON.parse(response.text).challenge_text
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
          addMockFetches(fetch, prefix, dataMap)
        }

        let url = JSON.parse(response.text).publicURL
        // Must return URL
        expect(url).toBeTruthy()
        // console.log(url)
        fetch(url)
          .then(resp => resp.text())
          .then(text => {
            // Contents returned must be correct
            expect(text).toEqual(fileContents)
          })
      })
      .catch((err: any) => {
        // Unexpected err: ${err}
        expect(true).toBeFalsy()
      })
      .then(() => request(app).post(listPath)
            .set('Content-Type', 'application/json')
            .set('Authorization', authorizationHeader)
            .expect(202)
      )
      .then((filesResponse) => {
        const files = JSON.parse(filesResponse.text)
        // Should return one file
        expect(files.entries.length).toEqual(1)
        // Should be helloworld
        expect(files.entries[0]).toEqual('helloWorld')
        // Response is missing a page
        expect(files.hasOwnProperty('page')).toBeTruthy()
      })
      .then(() => {
        fetch.restore()
      })
  })
})
