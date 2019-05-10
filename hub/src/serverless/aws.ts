'use strict'

import { APIGatewayProxyEvent } from 'aws-lambda'
import { HubServer } from '../server/server'
import { getConfig } from '../server/config'
import { DriverModel } from '../server/driverModel'
import { getDriverClass } from '../server/utils'
import { ProofChecker } from '../server/ProofChecker'
import * as errors from '../server/errors'
import { Readable } from 'stream'
import { getChallengeText, LATEST_AUTH_VERSION } from '../server/authentication'

module.exports.handleRequest = async (event: APIGatewayProxyEvent) => {

  const hubServer = buildHubServer()

  // Extract address from path
  let match = event.path.match(/\/store\/([a-zA-Z0-9]+)\//)
  if (!match) {
    return writeResponse({ message: 'Unprocessable entity: address missing' }, 422)
  }
  const address = match[match.length - 1]

  // Extract filename from path
  match = event.path.match(/\/store\/[a-zA-Z0-9]+\/([^\/]+)/)
  if (!match) {
    return writeResponse({ message: 'Unprocessable entity: filename missing' }, 422)
  }
  const filename = match[match.length - 1]

  const headers = {
    contentType: event.headers['content-type'],
    contentLength: event.headers['content-length'],
    authorization: event.headers['authorization']
  }

  const buffer = new Buffer(event.body, 'base64')
  const stream = new Readable()
  stream._read = () => {}
  stream.push(buffer)
  stream.push(null)

  try {
    const publicURL = await hubServer.handleRequest(address, filename, headers, stream)
    return writeResponse({ publicURL }, 202)
  } catch (err) {
    if (err instanceof errors.ValidationError) {
      return writeResponse({ message: err.message, error: err.name }, 401)
    } else if (err instanceof errors.AuthTokenTimestampValidationError) {
      return writeResponse({ message: err.message, error: err.name  }, 401)
    } else if (err instanceof errors.BadPathError) {
      return writeResponse({ message: err.message, error: err.name  }, 403)
    } else if (err instanceof errors.NotEnoughProofError) {
      return writeResponse({ message: err.message, error: err.name  }, 402)
    } else if (err instanceof errors.ConflictError) {
      return writeResponse({ message: err.message, error: err.name  }, 409)
    } else {
      return writeResponse({ message: 'Server Error' }, 500)
    }
  }
}

module.exports.handleDelete = async (event: APIGatewayProxyEvent) => {

  const hubServer = buildHubServer()

  // Extract address from path
  let match = event.path.match(/\/delete\/([a-zA-Z0-9]+)\//)
  if (!match) {
    return writeResponse({ message: 'Unprocessable entity: address missing' }, 422)
  }
  const address = match[match.length - 1]

  // Extract filename from path
  match = event.path.match(/\/delete\/[a-zA-Z0-9]+\/([^\/]+)/)
  if (!match) {
    return writeResponse({ message: 'Unprocessable entity: filename missing' }, 422)
  }
  const filename = match[match.length - 1]

  const headers = {
    contentType: event.headers['content-type'],
    contentLength: event.headers['content-length'],
    authorization: event.headers['authorization']
  }

  // Sanity checks
  if (address === null || filename === null) {
    return writeResponse({ message: 'Unprocessable entity: address of filename missing' }, 422)
  }

  try {
    await hubServer.handleDelete(address, filename, headers)
    return writeResponse({}, 202)
  } catch (err) {
    if (err instanceof errors.ValidationError) {
      return writeResponse({ message: err.message, error: err.name }, 401)
    } else if (err instanceof errors.AuthTokenTimestampValidationError) {
      return writeResponse({ message: err.message, error: err.name  }, 401)
    } else if (err instanceof errors.BadPathError) {
      return writeResponse({ message: err.message, error: err.name  }, 400)
    } else if (err instanceof errors.DoesNotExist) {
      return writeResponse({ message: err.message, error: err.name  }, 404)
    } else if (err instanceof errors.NotEnoughProofError) {
      return writeResponse({ message: err.message, error: err.name  }, 402)
    } else {
      return writeResponse({ message: 'Server Error' }, 500)
    }
  }
}

module.exports.handleListFiles = async (event: APIGatewayProxyEvent) => {

  const hubServer = buildHubServer()

  const match = event.path.match(/^\/list-files\/([a-zA-Z0-9]+)\/?/)
  if (!match) {
    return writeResponse({ message: 'Unprocessable entity: address missing' }, 422)
  }
  const address = match[match.length - 1]

  const headers = {
    contentType: event.headers['content-type'],
    contentLength: event.headers['content-length'],
    authorization: event.headers['authorization']
  }

  const body = JSON.parse(event.body)
  const page = body && body.page ? body.page : null

  // Sanity checks
  if (parseInt(headers.contentLength) > 4096) {
    return writeResponse({ message: 'Invalid JSON: too long'}, 400)
  }

  try {
    const files = await hubServer.handleListFiles(address, page, headers)
    return writeResponse({ entries: files.entries, page: files.page }, 202)
  } catch (err) {
    if (err instanceof errors.ValidationError) {
      return writeResponse({ message: err.message, error: err.name }, 401)
    } else if (err instanceof errors.AuthTokenTimestampValidationError) {
      return writeResponse({ message: err.message, error: err.name  }, 401)
    } else {
      return writeResponse({ message: 'Server Error' }, 500)
    }
  }
}

module.exports.handleAuthBump = async (event: APIGatewayProxyEvent) => {

  const hubServer = buildHubServer()

  const headers = {
    contentType: event.headers['content-type'],
    contentLength: event.headers['content-length'],
    authorization: event.headers['authorization']
  }

  // Sanity checks
  if (parseInt(headers.contentLength) > 4096) {
    return writeResponse({ message: 'Invalid JSON: too long'}, 400)
  }

  const body = JSON.parse(event.body)

  if (!body && !body.oldestValidTimestamp) {
    return writeResponse({ message: 'Invalid JSON: missing oldestValidTimestamp'}, 400)
  }

  const match = event.path.match(/^\/list-files\/([a-zA-Z0-9]+)\/?/)
  if (!match) {
    return writeResponse({ message: 'Unprocessable entity: address missing' }, 422)
  }
  const address = match[match.length - 1]

  const oldestValidTimestamp: number = parseInt(body.oldestValidTimestamp)

  if (!Number.isFinite(oldestValidTimestamp) || oldestValidTimestamp < 0) {
    writeResponse({ message: 'Invalid JSON: oldestValidTimestamp is not a valid integer'}, 400)
    return
  }

  try {
    await hubServer.handleAuthBump(address, oldestValidTimestamp, headers)
    return writeResponse({ status: 'success' }, 202)
  } catch (err) {
    if (err instanceof errors.ValidationError) {
      return writeResponse({ message: err.message, error: err.name  }, 401)
    } else if (err instanceof errors.BadPathError) {
      return writeResponse({ message: err.message, error: err.name  }, 403)
    } else {
      return writeResponse({ message: 'Server Error' }, 500)
    }
  }
}

module.exports.handleHubInfo = async (_: APIGatewayProxyEvent) => {

  const hubServer = buildHubServer()

  const challengeText = getChallengeText(hubServer.serverName)
  if (challengeText.length < 10) {
    return writeResponse({ message: 'Server challenge text misconfigured' }, 500)
  }
  const readURLPrefix = hubServer.getReadURLPrefix()
  return writeResponse({
    'challenge_text': challengeText,
    'latest_auth_version': LATEST_AUTH_VERSION,
    'read_url_prefix': readURLPrefix }, 200)
}

const buildHubServer = (): HubServer => {
  
  const config = getConfig()

  // Handle driver configuration
  let driver: DriverModel

  if (config.driverInstance) {
    driver = config.driverInstance
  } else if (config.driverClass) {
    driver = new config.driverClass(config)
  } else if (config.driver) {
    const driverClass = getDriverClass(config.driver)
    driver = new driverClass(config)
  } else {
    throw new Error('Driver option not configured')
  }
  
  const proofChecker = new ProofChecker(config.proofsConfig)
  const server = new HubServer(driver, proofChecker, config)
  return server
}

const writeResponse = (data: any, statusCode: number) => {
  return {
    statusCode: statusCode,
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data, null, 2)  
  }
}
