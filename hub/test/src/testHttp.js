/* @flow */

import test  from 'tape-promise/tape'

import * as auth from '../../src/server/authentication'
import os from 'os'
import fs from 'fs'
import request from 'supertest'
import { ecPairToAddress } from 'blockstack'

import FetchMock from 'fetch-mock'
import * as NodeFetch from 'node-fetch'
const fetch = FetchMock.sandbox(NodeFetch)

import { makeHttpServer } from '../../src/server/http.js'
import DiskDriver from '../../src/server/drivers/diskDriver'
import { MakeHttpServerConfig } from '../../src/server/http.js'
import { makeMockedAzureDriver, addMockFetches } from './testDrivers'

import { testPairs } from './common'
import { InMemoryDriver } from './testDrivers/InMemoryDriver'

export function testHttpWithInMemoryDriver() {
  test('handle request (InMemory driver)', async (t) => {
    const fetch = NodeFetch
    const inMemoryDriver = await InMemoryDriver.spawn()
    try {
      const app = makeHttpServer({ driverInstance: inMemoryDriver })
      const sk = testPairs[1]
      const fileContents = sk.toWIF()
      const blob = Buffer.from(fileContents)

      const address = ecPairToAddress(sk)
      const path = `/store/${address}/helloWorld`
      const listPath = `/list-files/${address}`

      let response = await request(app)
        .get('/hub_info/')
        .expect(200)
    
      const challenge = JSON.parse(response.text).challenge_text
      const authPart = auth.V1Authentication.makeAuthPart(sk, challenge)
      const authorization = `bearer ${authPart}`

      const hubInfo = await request(app).post(path)
        .set('Content-Type', 'application/octet-stream')
        .set('Authorization', authorization)
        .send(blob)
        .expect(202)

      const url = JSON.parse(hubInfo.text).publicURL
      t.ok(url, 'Must return URL')
      console.log(url)
      const resp = await fetch(url)
      const text = await resp.text()
      t.equal(text, fileContents, 'Contents returned must be correct')

      const filesResponse = await request(app).post(listPath)
        .set('Content-Type', 'application/json')
        .set('Authorization', authorization)
        .expect(202)
      
      const files = JSON.parse(filesResponse.text)
      t.equal(files.entries.length, 1, 'Should return one file')
      t.equal(files.entries[0], 'helloWorld', 'Should be helloworld')
      t.ok(files.hasOwnProperty('page'), 'Response is missing a page')
      t.end()

    } finally {
      inMemoryDriver.dispose()
    }
  })

}

function testHttpDriverOption() {
  test('makeHttpServer "driver" config', (t) => {
    makeHttpServer({
      driver: 'disk',
      readURL: 'test/',
      diskSettings: {
        storageRootDirectory: os.tmpdir()
      }
    })
    t.end()
  })

  test('makeHttpServer "driverInstance" config', (t) => {
    const driver = new DiskDriver({
      readURL: 'test/',
      diskSettings: {
        storageRootDirectory: os.tmpdir()
      }
    })
    makeHttpServer({
      driverInstance: driver
    })
    t.end()
  })

  test('makeHttpServer missing driver config', (t) => {
    t.throws(() => makeHttpServer({}), Error, 'Should fail to create http server when no driver config is specified')
    t.end()
  })

}

function testHttpWithAzure() {
  const azConfigPath = process.env.AZ_CONFIG_PATH
  let config : MakeHttpServerConfig = {
    'azCredentials': {
      'accountName': 'mock-azure',
      'accountKey': 'mock-azure-key'
    },
    'bucket': 'spokes'
  }
  let mockTest = true

  if (azConfigPath) {
    config = JSON.parse(fs.readFileSync(azConfigPath, {encoding: 'utf8'}))
    config.driver = 'azure'
    mockTest = false
  }

  let dataMap = []
  if (mockTest) {
    const mockedObj = makeMockedAzureDriver()
    dataMap = mockedObj.dataMap
    const AzDriver = mockedObj.AzDriver
    config.driverClass = AzDriver
  } else {

  }

  test('auth failure', (t) => {
    let app = makeHttpServer(config)
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
        t.ok(json, 'Must return json')
        console.log(json)
      })
      .catch((err) => t.false(true, `Unexpected err: ${err}`))
      .then(() => { FetchMock.restore(); t.end() })
  })

  test('handle request', (t) => {
    let fetch = FetchMock.sandbox(NodeFetch)
    let app = makeHttpServer(config)
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
        t.ok(url, 'Must return URL')
        console.log(url)
        fetch(url)
          .then(resp => resp.text())
          .then(text => t.equal(text, fileContents, 'Contents returned must be correct'))
      })
      .catch((err) => t.false(true, `Unexpected err: ${err}`))
      .then(() => request(app).post(listPath)
            .set('Content-Type', 'application/json')
            .set('Authorization', authorizationHeader)
            .expect(202)
      )
      .then((filesResponse) => {
        const files = JSON.parse(filesResponse.text)
        t.equal(files.entries.length, 1, 'Should return one file')
        t.equal(files.entries[0], 'helloWorld', 'Should be helloworld')
        t.ok(files.hasOwnProperty('page'), 'Response is missing a page')
      })
      .then(() => {
        fetch.restore()
        t.end()
      })
  })
}

export function testHttp() {
  testHttpWithAzure()
  testHttpDriverOption()
  testHttpWithInMemoryDriver()
}
