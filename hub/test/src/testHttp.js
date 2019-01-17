import test  from 'tape'

import * as auth from '../../src/server/authentication'
import fs from 'fs'
import request from 'supertest'
import { ecPairToAddress } from 'blockstack'

import FetchMock from 'fetch-mock'
import * as NodeFetch from 'node-fetch'
const fetch = FetchMock.sandbox(NodeFetch)

import { makeHttpServer } from '../../src/server/http.js'
import { makeMockedAzureDriver, addMockFetches } from './testDrivers'

import { testPairs } from './common'

const azConfigPath = process.env.AZ_CONFIG_PATH

export function testHttp() {
  let config = {
    "azCredentials": {
      "accountName": "mock-azure",
      "accountKey": "mock-azure-key"
    },
    "bucket": "spokes"
  }
  let mockTest = true

  if (azConfigPath) {
    config = JSON.parse(fs.readFileSync(azConfigPath))
    config.driver = 'azure'
    mockTest = false
  }

  let dataMap = []
  let AzDriver
  const azDriverImport = '../../src/server/drivers/AzDriver'
  if (mockTest) {
    const mockedObj = makeMockedAzureDriver()
    dataMap = mockedObj.dataMap
    AzDriver = mockedObj.AzDriver
    config.driverClass = AzDriver
  } else {
    AzDriver = require(azDriverImport)
  }

  test('auth failure', (t) => {
    let app = makeHttpServer(config)
    let sk = testPairs[1]
    let fileContents = sk.toWIF()
    let blob = Buffer(fileContents)

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
    let app = makeHttpServer(config)
    let sk = testPairs[1]
    let fileContents = sk.toWIF()
    let blob = Buffer(fileContents)

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
