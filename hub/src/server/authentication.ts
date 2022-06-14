import * as bitcoinjs from 'bitcoinjs-lib'
import ECPairFactory, { ECPairInterface } from 'ecpair'
import * as ecc from 'tiny-secp256k1'
import * as crypto from 'crypto'
import { decodeToken, TokenSigner, TokenVerifier } from 'jsontokens'
import { ecPairToHexString, ecPairToAddress } from 'blockstack'
import { ValidationError, AuthTokenTimestampValidationError } from './errors'
import { logger } from './utils'

export const LATEST_AUTH_VERSION = 'v1'
const DEFAULT_STORAGE_URL = 'storage.blockstack.org'
const ECPair = ECPairFactory(ecc)

function pubkeyHexToECPair (pubkeyHex: string) {
  const pkBuff = Buffer.from(pubkeyHex, 'hex')
  return ECPair.fromPublicKey(pkBuff)
}

export interface AuthScopeEntry {
  scope: string
  domain: string
}

export interface TokenPayloadType {
  gaiaChallenge: string
  iss: string
  exp: number
  iat?: number
  salt: string
  hubUrl?: string
  associationToken?: string
  scopes?: AuthScopeEntry[]
  childToAssociate?: string
}

export class AuthScopeValues {

  writePrefixes: string[] = []
  writePaths: string[] = []
  deletePrefixes: string[] = []
  deletePaths: string[] = []
  writeArchivalPrefixes: string[] = []
  writeArchivalPaths: string[] = []

  static parseEntries(scopes: AuthScopeEntry[]) {
    const scopeTypes = new AuthScopeValues()
    scopes.forEach(entry => {
      switch (entry.scope) {
      case AuthScopesTypes.putFilePrefix: return scopeTypes.writePrefixes.push(entry.domain)
      case AuthScopesTypes.putFile: return scopeTypes.writePaths.push(entry.domain)
      case AuthScopesTypes.putFileArchival: return scopeTypes.writeArchivalPaths.push(entry.domain)
      case AuthScopesTypes.putFileArchivalPrefix: return scopeTypes.writeArchivalPrefixes.push(entry.domain)
      case AuthScopesTypes.deleteFilePrefix: return scopeTypes.deletePrefixes.push(entry.domain)
      case AuthScopesTypes.deleteFile: return scopeTypes.deletePaths.push(entry.domain)
      }
    })
    return scopeTypes
  }
}

export class AuthScopesTypes {
  static readonly putFile = 'putFile'
  static readonly putFilePrefix = 'putFilePrefix'
  static readonly deleteFile = 'deleteFile'
  static readonly deleteFilePrefix = 'deleteFilePrefix'
  static readonly putFileArchival = 'putFileArchival'
  static readonly putFileArchivalPrefix = 'putFileArchivalPrefix'
}

export const AuthScopeTypeArray: string[] = Object.values(AuthScopesTypes).filter(val => typeof val === 'string')

export function getTokenPayload(token: import('jsontokens/lib/decode').TokenInterface) {
  if (typeof token.payload === 'string') {
    throw new Error('Unexpected token payload type of string')
  }
  return token.payload
}

export function decodeTokenForPayload(opts: { 
  encodedToken: string; 
  validationErrorMsg: string;
}) {
  try {
    return getTokenPayload(decodeToken(opts.encodedToken))
  } catch (e) {
    logger.error(`${opts.validationErrorMsg}, ${e}`)
    logger.error(opts.encodedToken)
    throw new ValidationError(opts.validationErrorMsg)
  }
}

export interface AuthenticationInterface {
  checkAssociationToken(token: string, bearerAddress: string): void
  getAuthenticationScopes(): AuthScopeEntry[]
  isAuthenticationValid(
    address: string, 
    challengeTexts: string[],
    options?: { 
      requireCorrectHubUrl?: boolean,
      validHubUrls?: string[],
      oldestValidTokenTimestamp?: number 
    }
  ): string
  parseAuthScopes(): AuthScopeValues
}

export class V1Authentication implements AuthenticationInterface {
  token: string

  constructor(token: string) {
    this.token = token
  }

  static fromAuthPart(authPart: string) {
    if (!authPart.startsWith('v1:')) {
      throw new ValidationError('Authorization header should start with v1:')
    }
    const token = authPart.slice('v1:'.length)
    const payload = decodeTokenForPayload({
      encodedToken: token,
      validationErrorMsg: 'fromAuthPart: Failed to decode authentication JWT'
    })

    const publicKey = payload.iss
    if (!publicKey) {
      throw new ValidationError('Auth token should be a JWT with at least an `iss` claim')
    }
    const scopes = payload.scopes
    if (scopes) {
      validateScopes(scopes as any)
    }
    return new V1Authentication(token)
  }

  static makeAuthPart(secretKey: ECPairInterface, challengeText: string,
                      associationToken?: string, hubUrl?: string, scopes?: AuthScopeEntry[],
                      issuedAtDate?: number) {

    const FOUR_MONTH_SECONDS = 60 * 60 * 24 * 31 * 4
    const publicKeyHex = secretKey.publicKey.toString('hex')
    const salt = crypto.randomBytes(16).toString('hex')

    if (scopes) {
      validateScopes(scopes)
    }

    const payloadIssuedAtDate = issuedAtDate || (Date.now()/1000|0)

    const payload: TokenPayloadType = {
      gaiaChallenge: challengeText,
      iss: publicKeyHex,
      exp: FOUR_MONTH_SECONDS + (Date.now() / 1000),
      iat: payloadIssuedAtDate,
      associationToken,
      hubUrl, salt, scopes
    }

    const signerKeyHex = ecPairToHexString(secretKey).slice(0, 64)
    const token = new TokenSigner('ES256K', signerKeyHex).sign(payload as any)
    return `v1:${token}`
  }

  static makeAssociationToken(secretKey: ECPairInterface, childPublicKey: string) {
    const FOUR_MONTH_SECONDS = 60 * 60 * 24 * 31 * 4
    const publicKeyHex = secretKey.publicKey.toString('hex')
    const salt = crypto.randomBytes(16).toString('hex')
    const payload: TokenPayloadType = {
      childToAssociate: childPublicKey,
      iss: publicKeyHex,
      exp: FOUR_MONTH_SECONDS + (Date.now() / 1000),
      iat: (Date.now() / 1000 | 0),
      gaiaChallenge: String(undefined),
      salt
    }

    const signerKeyHex = ecPairToHexString(secretKey).slice(0, 64)
    const token = new TokenSigner('ES256K', signerKeyHex).sign(payload as any)
    return token
  }

  checkAssociationToken(token: string, bearerAddress: string) {
    // a JWT can have an `associationToken` that was signed by one of the
    // whitelisted addresses on this server.  This method checks a given
    // associationToken and verifies that it authorizes the "outer"
    // JWT's address (`bearerAddress`)

    const payload = decodeTokenForPayload({
      encodedToken: token, 
      validationErrorMsg: 'checkAssociationToken: Failed to decode association token in JWT'
    })

    // publicKey (the issuer of the association token)
    // will be the whitelisted address (i.e. the identity address)
    const publicKey = payload.iss
    const childPublicKey = payload.childToAssociate
    const expiresAt = payload.exp

    if (! publicKey) {
      throw new ValidationError('Must provide `iss` claim in association JWT.')
    }

    if (! childPublicKey) {
      throw new ValidationError('Must provide `childToAssociate` claim in association JWT.')
    }

    if (! expiresAt) {
      throw new ValidationError('Must provide `exp` claim in association JWT.')
    }

    const verified = new TokenVerifier('ES256K', publicKey).verify(token)
    if (!verified) {
      throw new ValidationError('Failed to verify association JWT: invalid issuer')
    }

    if (expiresAt < (Date.now()/1000)) {
      throw new ValidationError(
        `Expired association token: expire time of ${expiresAt} (secs since epoch)`)
    }

    // the bearer of the association token must have authorized the bearer
    const childAddress = ecPairToAddress(pubkeyHexToECPair(childPublicKey as string))
    if (childAddress !== bearerAddress) {
      throw new ValidationError(
        `Association token child key ${childPublicKey} does not match ${bearerAddress}`)
    }

    const signerAddress = ecPairToAddress(pubkeyHexToECPair(publicKey))
    return signerAddress

  }

  parseAuthScopes() {
    const scopes = this.getAuthenticationScopes()
    return AuthScopeValues.parseEntries(scopes)
  }

  /*
   * Get the authentication token's association token's scopes.
   * Does not validate the authentication token or the association token
   * (do that with isAuthenticationValid first).
   *
   * Returns the scopes, if there are any given.
   * Returns [] if there is no association token, or if the association token has no scopes
   */
  getAuthenticationScopes() {

    const payload = decodeTokenForPayload({
      encodedToken: this.token, 
      validationErrorMsg: 'getAuthenticationScopes: Failed to decode authentication JWT'
    })

    if (!payload['scopes']) {
      // not given
      return []
    }

    // unambiguously convert to AuthScope
    const scopes: AuthScopeEntry[] = (payload.scopes as any).map((s: any) => {
      const r = {
        scope: String(s.scope),
        domain: String(s.domain)
      }
      return r
    })

    return scopes
  }

  /*
   * Determine if the authentication token is valid:
   * * must have signed the given `challengeText`
   * * must not be expired
   * * if it contains an associationToken, then the associationToken must
   *   authorize the given address.
   *
   * Returns the address that signed off on this token, which will be
   * checked against the server's whitelist.
   * * If this token has an associationToken, then the signing address
   *   is the address that signed the associationToken.
   * * Otherwise, the signing address is the given address.
   *
   * this throws a ValidationError if the authentication is invalid
   */
  isAuthenticationValid(address: string, challengeTexts: Array<string>,
                        options?: { requireCorrectHubUrl?: boolean,
                                    validHubUrls?: Array<string>,
                                    oldestValidTokenTimestamp?: number }): string {
    const payload = decodeTokenForPayload({
      encodedToken: this.token,
      validationErrorMsg: 'isAuthenticationValid: Failed to decode authentication JWT'
    })

    const publicKey = payload.iss
    const gaiaChallenge = payload.gaiaChallenge
    const scopes = payload.scopes

    if (!publicKey) {
      throw new ValidationError('Must provide `iss` claim in JWT.')
    }

    // check for revocations
    if (options && options.oldestValidTokenTimestamp && options.oldestValidTokenTimestamp > 0) {
      const tokenIssuedAtDate = payload.iat
      const oldestValidTokenTimestamp: number = options.oldestValidTokenTimestamp
      if (!tokenIssuedAtDate) {
        const message = `Gaia bucket requires auth token issued after ${oldestValidTokenTimestamp}` +
              ' but this token has no creation timestamp. This token may have been revoked by the user.'
        throw new AuthTokenTimestampValidationError(message, oldestValidTokenTimestamp)
      }
      if (tokenIssuedAtDate < options.oldestValidTokenTimestamp) {
        const message = `Gaia bucket requires auth token issued after ${oldestValidTokenTimestamp}` +
              ` but this token was issued ${tokenIssuedAtDate}.` +
              ' This token may have been revoked by the user.'
        throw new AuthTokenTimestampValidationError(message, oldestValidTokenTimestamp)
      }
    }

    const issuerAddress = ecPairToAddress(pubkeyHexToECPair(publicKey))

    if (issuerAddress !== address) {
      throw new ValidationError('Address not allowed to write on this path')
    }

    if (options && options.requireCorrectHubUrl) {
      let claimedHub = payload.hubUrl as string
      if (!claimedHub) {
        throw new ValidationError(
          'Authentication must provide a claimed hub. You may need to update stacks.js.')
      }
      if (claimedHub.endsWith('/')) {
        claimedHub = claimedHub.slice(0, -1)
      }
      const validHubUrls = options.validHubUrls
      if (!validHubUrls) {
        throw new ValidationError(
          'Configuration error on the gaia hub. validHubUrls must be supplied.')
      }
      if (!validHubUrls.includes(claimedHub)) {
        throw new ValidationError(
          `Auth token's claimed hub url '${claimedHub}' not found` +
            ` in this hubs set: ${JSON.stringify(validHubUrls)}`)
      }
    }

    if (scopes) {
      validateScopes(scopes as any)
    }

    let verified
    try {
      verified = new TokenVerifier('ES256K', publicKey).verify(this.token)
    } catch (err) {
      throw new ValidationError('Failed to verify supplied authentication JWT')
    }

    if (!verified) {
      throw new ValidationError('Failed to verify supplied authentication JWT')
    }

    if (!challengeTexts.includes(gaiaChallenge as string)) {
      throw new ValidationError(`Invalid gaiaChallenge text in supplied JWT: "${gaiaChallenge}"` +
                                ` not found in ${JSON.stringify(challengeTexts)}`)
    }

    const expiresAt = payload.exp
    if (expiresAt && expiresAt < (Date.now()/1000)) {
      throw new ValidationError(
        `Expired authentication token: expire time of ${expiresAt} (secs since epoch)`)
    }

    if ('associationToken' in payload &&
        payload.associationToken) {
      return this.checkAssociationToken(
        payload.associationToken as string, address)
    } else {
      return address
    }
  }
}

export class LegacyAuthentication implements AuthenticationInterface {

  checkAssociationToken(_token: string, _bearerAddress: string): void {
    throw new Error('Method not implemented.')
  }

  parseAuthScopes(): AuthScopeValues {
    return new AuthScopeValues()
  }

  publickey: ECPairInterface
  signature: string
  constructor(publickey: ECPairInterface, signature: string) {
    this.publickey = publickey
    this.signature = signature
  }

  static fromAuthPart(authPart: string) {
    const decoded = JSON.parse(Buffer.from(authPart, 'base64').toString())
    const publickey = pubkeyHexToECPair(decoded.publickey)
    const hashType = Buffer.from([bitcoinjs.Transaction.SIGHASH_NONE])
    const signatureBuffer = Buffer.concat([Buffer.from(decoded.signature, 'hex'), hashType])
    const signature = bitcoinjs.script.signature.decode(signatureBuffer).signature.toString('hex')
    return new LegacyAuthentication(publickey, signature)
  }

  static makeAuthPart(secretKey: ECPairInterface, challengeText: string) {
    const publickey = secretKey.publicKey.toString('hex')
    const digest = bitcoinjs.crypto.sha256(Buffer.from(challengeText))
    const signatureBuffer = secretKey.sign(digest)
    const signatureWithHash = bitcoinjs.script.signature.encode(signatureBuffer, bitcoinjs.Transaction.SIGHASH_NONE)
    
    // We only want the DER encoding so remove the sighash version byte at the end.
    // See: https://github.com/bitcoinjs/bitcoinjs-lib/issues/1241#issuecomment-428062912
    const signature = signatureWithHash.toString('hex').slice(0, -2)

    const authObj = { publickey, signature }

    return Buffer.from(JSON.stringify(authObj)).toString('base64')
  }

  getAuthenticationScopes(): AuthScopeEntry[] {
    // no scopes supported in this version
    return []
  }

  isAuthenticationValid(address: string, challengeTexts: Array<string>,
                        options? : Record<string, unknown>) { //  eslint-disable-line @typescript-eslint/no-unused-vars
    if (ecPairToAddress(this.publickey) !== address) {
      throw new ValidationError('Address not allowed to write on this path')
    }

    for (const challengeText of challengeTexts) {
      const digest = bitcoinjs.crypto.sha256(Buffer.from(challengeText))
      const valid = (this.publickey.verify(digest, Buffer.from(this.signature, 'hex')) === true)

      if (valid) {
        return address
      }
    }
    logger.debug(`Failed to validate with challenge text: ${JSON.stringify(challengeTexts)}`)
    throw new ValidationError('Invalid signature or expired authentication token.')
  }
}

export function getChallengeText(myURL: string = DEFAULT_STORAGE_URL) {
  const header = 'gaiahub'
  const allowedSpan = '0'
  const myChallenge = 'blockstack_storage_please_sign'
  return JSON.stringify( [header, allowedSpan, myURL, myChallenge] )
}

export function getLegacyChallengeTexts(myURL: string = DEFAULT_STORAGE_URL): Array<string> {
  // make legacy challenge texts
  const header = 'gaiahub'
  const myChallenge = 'blockstack_storage_please_sign'
  const legacyYears = ['2018', '2019']
  return legacyYears.map(year => JSON.stringify(
    [header, year, myURL, myChallenge]))
}

export function parseAuthHeader(authHeader: string): AuthenticationInterface {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer')) {
    throw new ValidationError('Failed to parse authentication header.')
  }
  const authPart = authHeader.slice('bearer '.length)
  const versionIndex = authPart.indexOf(':')
  if (versionIndex < 0) {
    // default to legacy authorization header
    return LegacyAuthentication.fromAuthPart(authPart)
  } else {
    const version = authPart.slice(0, versionIndex)
    if (version === 'v1') {
      return V1Authentication.fromAuthPart(authPart)
    } else {
      throw new ValidationError('Unknown authentication header version: ${version}')
    }
  }
}

export function validateAuthorizationHeader(authHeader: string, serverName: string,
                                            address: string, requireCorrectHubUrl: boolean = false,
                                            validHubUrls: Array<string> = null,
                                            oldestValidTokenTimestamp?: number): string {
  const serverNameHubUrl = `https://${serverName}`
  if (!validHubUrls) {
    validHubUrls = [ serverNameHubUrl ]
  } else if (!validHubUrls.includes(serverNameHubUrl)) {
    validHubUrls.push(serverNameHubUrl)
  }

  let authObject = null
  try {
    authObject = parseAuthHeader(authHeader)
  } catch (err) {
    logger.error(err)
  }

  if (!authObject) {
    throw new ValidationError('Failed to parse authentication header.')
  }

  const challengeTexts = []
  challengeTexts.push(getChallengeText(serverName))
  getLegacyChallengeTexts(serverName).forEach(challengeText => challengeTexts.push(challengeText))

  return authObject.isAuthenticationValid(address, challengeTexts, { validHubUrls, requireCorrectHubUrl, oldestValidTokenTimestamp })
}


/*
 * Get the authentication scopes from the authorization header.
 * Does not check the authorization header or its association token
 * (do that with validateAuthorizationHeader first).
 *
 * Returns the scopes on success
 * Throws on malformed auth header
 */
export function getAuthenticationScopes(authHeader: string) {
  const authObject = parseAuthHeader(authHeader)
  return authObject.parseAuthScopes()
}

/*
 * Validate authentication scopes.  They must be well-formed,
 * and there can't be too many of them.
 * Return true if valid.
 * Throw ValidationError on error
 */
function validateScopes(scopes: AuthScopeEntry[]) {
  if (scopes.length > 8) {
    throw new ValidationError('Too many authentication scopes')
  }

  for (let i = 0; i < scopes.length; i++) {
    const scope = scopes[i]

    // valid scope?
    const found = AuthScopeTypeArray.find((s) => (s === scope.scope))
    if (!found) {
      throw new ValidationError(`Unrecognized scope ${scope.scope}`)
    }
  }

  return true
}
