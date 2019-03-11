import { testAuth } from './testAuth'
import { testServer } from './testServer'
import { testDrivers } from './testDrivers'
import { testHttp } from './testHttp'
import { testConfig } from './testConfig'
import { testProofChecker } from './testProofChecker'

testConfig()


testServer()
testAuth()
testDrivers()

testHttp()
testProofChecker()
