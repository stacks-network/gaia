import test = require('tape-promise/tape')
import { TokenSigner } from 'jsontokens'

import * as auth from '../../src/server/authentication'
import * as errors from '../../src/server/errors'


import { testPairs, testAddrs} from './common'
import { ECPairInterface } from 'ecpair'

export function testAuth() {
  test('authentication legacy/regression', (t) => {
    const legacyPart = {
      wif: 'Kzp44Hhp6SFUXMuMi6MUDTqyfcNyyjntrphEHVMsiitRrjMyoV4p',
      addr: '1AotVNASQouiNiBtfxv49WWvSNcQUzGYuU',
      serverName: 'storage.blockstack.org',
      legacyAuth: 'eyJwdWJsaWNrZXkiOiIwMjQxYTViMDQ2Mjg1ZjVlMjgwMDRmOTJjY2M0MjNmY2RkODYyZmYzY' +
        'jgwODUwNzE4MDY4MGIyNDA3ZTIyOWE3NzgiLCJzaWduYXR1cmUiOiIzMDQ0MDIyMDY5ODUwNmNjYjg3MDg1Zm' +
        'Y5ZGI3ZTc4MTIwYTVmMjY1YzExZmY0ODc4OTBlNDQ1MWZjYWM3NjA4NTkyMDhjZWMwMjIwNTZkY2I0OGUyYzE' +
        '4Y2YwZjQ1NDZiMmQ3M2I2MDY4MWM5ODEyMzQyMmIzOTRlZjRkMWI2MjE3NTYyODQ4MzUwNCJ9' }
    t.doesNotThrow(() => auth.validateAuthorizationHeader(`bearer ${legacyPart.legacyAuth}`,
                                                          legacyPart.serverName,
                                                          legacyPart.addr),
                   'legacy authentication token should work')
    t.end()
  })

  test('authentication legacy/regression with multi-case bearer', (t) => {
    const legacyPart = {
      wif: 'Kzp44Hhp6SFUXMuMi6MUDTqyfcNyyjntrphEHVMsiitRrjMyoV4p',
      addr: '1AotVNASQouiNiBtfxv49WWvSNcQUzGYuU',
      serverName: 'storage.blockstack.org',
      legacyAuth: 'eyJwdWJsaWNrZXkiOiIwMjQxYTViMDQ2Mjg1ZjVlMjgwMDRmOTJjY2M0MjNmY2RkODYyZmYzY' +
        'jgwODUwNzE4MDY4MGIyNDA3ZTIyOWE3NzgiLCJzaWduYXR1cmUiOiIzMDQ0MDIyMDY5ODUwNmNjYjg3MDg1Zm' +
        'Y5ZGI3ZTc4MTIwYTVmMjY1YzExZmY0ODc4OTBlNDQ1MWZjYWM3NjA4NTkyMDhjZWMwMjIwNTZkY2I0OGUyYzE' +
        '4Y2YwZjQ1NDZiMmQ3M2I2MDY4MWM5ODEyMzQyMmIzOTRlZjRkMWI2MjE3NTYyODQ4MzUwNCJ9' }
    t.doesNotThrow(() => auth.validateAuthorizationHeader(`BeArEr ${legacyPart.legacyAuth}`,
                                                          legacyPart.serverName,
                                                          legacyPart.addr),
                   'legacy authentication token should work')
    t.end()
  })

  test('storage validation', (t) => {
    const challengeText = auth.getChallengeText()
    const authPart = auth.LegacyAuthentication.makeAuthPart(testPairs[0], challengeText)
    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Wrong address must throw')
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos']),
             errors.ValidationError, 'Wrong challenge text must throw')
    t.ok(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]),
         'Good signature must pass')

    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]),
             'Bad signature must throw')
    t.end()
  })

  test('v1 storage validation', (t) => {
    const challengeText = 'bananas are tasty'
    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText)
    console.log(`V1 storage validation: ${authPart}`)
    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Wrong address must throw')
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']),
             errors.ValidationError, 'Wrong challenge text must throw')
    t.ok(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]),
         'Good signature must pass')

    // signer address was from the v1 token
    t.equal(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]), testAddrs[0])

    const signerKeyHex = testPairs[0].privateKey.toString('hex')
    const tokenWithoutIssuer = new TokenSigner('ES256K', signerKeyHex).sign(
      { garbage: 'in' })
    const goodTokenWithoutExp = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[0].publicKey.toString('hex') })
    const expiredToken = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[0].publicKey.toString('hex'), exp: 1 })
    const wrongIssuerToken = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[1].publicKey.toString('hex'), exp: 1 })
    t.throws(() => new auth.V1Authentication(tokenWithoutIssuer).isAuthenticationValid(testAddrs[0], [challengeText]),
             errors.ValidationError, 'No `iss`, should fail')
    t.throws(() => new auth.V1Authentication(expiredToken).isAuthenticationValid(testAddrs[0], [challengeText]),
             errors.ValidationError, 'Expired token should fail')
    t.throws(() => new auth.V1Authentication(wrongIssuerToken).isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Invalid signature')
    t.ok(new auth.V1Authentication(goodTokenWithoutExp).isAuthenticationValid(testAddrs[0], [challengeText]),
         'Valid token without expiration should pass')

    t.end()
  })

  test('v1 storage validation with hubUrls required', (t) => {
    const challengeText = 'bananas are tasty'
    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText)
    console.log(`V1 storage validation: ${authPart}`)
    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Wrong address must throw')
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']),
             errors.ValidationError, 'Wrong challenge text must throw')
    t.ok(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]),
         'Good signature must pass')

    // signer address was from the v1 token
    t.equal(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]), testAddrs[0])

    const signerKeyHex = testPairs[0].privateKey.toString('hex')
    const tokenWithoutIssuer = new TokenSigner('ES256K', signerKeyHex).sign(
      { garbage: 'in' })
    const goodTokenWithoutExp = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[0].publicKey.toString('hex') })
    const expiredToken = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[0].publicKey.toString('hex'), exp: 1 })
    const wrongIssuerToken = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[1].publicKey.toString('hex'), exp: 1 })
    t.throws(() => new auth.V1Authentication(tokenWithoutIssuer).isAuthenticationValid(testAddrs[0], [challengeText]),
             errors.ValidationError, 'No `iss`, should fail')
    t.throws(() => new auth.V1Authentication(expiredToken).isAuthenticationValid(testAddrs[0], [challengeText]),
             errors.ValidationError, 'Expired token should fail')
    t.throws(() => new auth.V1Authentication(wrongIssuerToken).isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Invalid signature')
    t.ok(new auth.V1Authentication(goodTokenWithoutExp).isAuthenticationValid(testAddrs[0], [challengeText]),
         'Valid token without expiration should pass')

    t.end()
  })

  test('v1 storage validation with association token', (t) => {
    const challengeText = 'bananas are tasty'
    const associationToken = auth.V1Authentication.makeAssociationToken(testPairs[1], testPairs[0].publicKey.toString('hex'))
    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, associationToken)
    console.log(`V1 storage validation: ${authPart}`)
    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Wrong address must throw')
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']),
             errors.ValidationError, 'Wrong challenge text must throw')
    t.ok(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]),
         'Good signature must pass')

    // signer address was from the association token
    t.equal(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]), testAddrs[1])

    // failures should work the same if the outer JWT is invalid
    const signerKeyHex = testPairs[0].privateKey.toString('hex')
    const tokenWithoutIssuer = new TokenSigner('ES256K', signerKeyHex).sign(
      { garbage: 'in' })
    const goodTokenWithoutExp = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[0].publicKey.toString('hex') })
    const expiredToken = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[0].publicKey.toString('hex'), exp: 1 })
    const wrongIssuerToken = new TokenSigner('ES256K', signerKeyHex).sign(
      { gaiaChallenge: challengeText, iss: testPairs[1].publicKey.toString('hex'), exp: 1 })
    t.throws(() => new auth.V1Authentication(tokenWithoutIssuer).isAuthenticationValid(testAddrs[0], [challengeText]),
             errors.ValidationError, 'No `iss`, should fail')
    t.throws(() => new auth.V1Authentication(expiredToken).isAuthenticationValid(testAddrs[0], [challengeText]),
             errors.ValidationError, 'Expired token should fail')
    t.throws(() => new auth.V1Authentication(wrongIssuerToken).isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Invalid signature')
    t.ok(new auth.V1Authentication(goodTokenWithoutExp).isAuthenticationValid(testAddrs[0], [challengeText]),
         'Valid token without expiration should pass')

    // invalid associationTokens should cause a well-formed outer JWT to fail authentication
    const ownerKeyHex = testPairs[0].privateKey.toString('hex')
    const associationTokenWithoutIssuer = new TokenSigner('ES256K', ownerKeyHex).sign(
      { garbage: 'in' })
    const associationTokenWithoutExp = new TokenSigner('ES256K', ownerKeyHex).sign(
      { childToAssociate: testPairs[1].publicKey.toString('hex'), iss: testPairs[0].publicKey.toString('hex') })
    const expiredAssociationToken = new TokenSigner('ES256K', ownerKeyHex).sign(
      { childToAssociate: testPairs[1].publicKey.toString('hex'), iss: testPairs[0].publicKey.toString('hex'), exp: 1 })
    const wrongIssuerAssociationToken = new TokenSigner('ES256K', ownerKeyHex).sign(
      { childToAssociate: testPairs[1].publicKey.toString('hex'), iss: testPairs[1].publicKey.toString('hex'), exp: (Date.now()/1000) * 2 })
    const wrongBearerAddressAssociationToken = new TokenSigner('ES256K', ownerKeyHex).sign(
      { childToAssociate: testPairs[0].publicKey.toString('hex'), iss: testPairs[0].publicKey.toString('hex'), exp: (Date.now()/1000) * 2 })

    function makeAssocAuthToken(keypair: ECPairInterface, ct: string, assocJWT: string) {
      return new auth.V1Authentication(auth.V1Authentication.fromAuthPart(auth.V1Authentication.makeAuthPart(keypair, ct, assocJWT)).token)
    }

    t.throws(() => makeAssocAuthToken(testPairs[1], challengeText, associationTokenWithoutIssuer).isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'No `iss` in association token, should fail')
    t.throws(() => makeAssocAuthToken(testPairs[1], challengeText, associationTokenWithoutExp).isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Association token without exp should fail')
    t.throws(() => makeAssocAuthToken(testPairs[1], challengeText, expiredAssociationToken).isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Expired association token should fail')
    t.throws(() => makeAssocAuthToken(testPairs[1], challengeText, wrongIssuerAssociationToken).isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Wrong association token issuer, should fail')
    t.throws(() => makeAssocAuthToken(testPairs[1], challengeText, wrongBearerAddressAssociationToken).isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Wrong bearer address for association token, should fail')

    t.end()
  })

  test('v1 storage validation with scoped authentication token', (t) => {
    const challengeText = 'bananas are tasty'
    const writeScopes = [
      {
        scope: 'putFile',
        domain: '/foo/bar',
      },
      {
        scope: 'putFile',
        domain: '/baz'
      }
    ]

    const writeScopesInvalid = [
      {
        scope: 'invalid',
        domain: 'nope',
      }
    ]

    const writeScopesTooLong = [
      {
        scope: 'putFile',
        domain: '/0',
      },
      {
        scope: 'putFile',
        domain: '/1'
      },
      {
        scope: 'putFile',
        domain: '/2'
      },
      {
        scope: 'putFile',
        domain: '/3'
      },
      {
        scope: 'putFile',
        domain: '/4'
      },
      {
        scope: 'putFile',
        domain: '/5'
      },
      {
        scope: 'putFile',
        domain: '/6'
      },
      {
        scope: 'putFile',
        domain: '/7'
      },
      {
        scope: 'putFile',
        domain: '/8'
      }
    ]

    const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined, writeScopes)
    console.log(`V1 storage validation: ${authPart}`)

    const authorization = `bearer ${authPart}`
    const authenticator = auth.parseAuthHeader(authorization)
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]),
             errors.ValidationError, 'Wrong address must throw')
    t.throws(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']),
             errors.ValidationError, 'Wrong challenge text must throw')
    t.ok(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]),
         'Good signature must pass')

    // scopes must be present
    const authScopes = authenticator.getAuthenticationScopes()
    t.equal(authScopes[0].scope, 'putFile', 'scope 0 is putfile')
    t.equal(authScopes[0].domain, '/foo/bar', 'scope 0 is for /foo/bar')
    t.equal(authScopes[1].scope, 'putFile', 'scope 1 is putfile')
    t.equal(authScopes[1].domain, '/baz', 'scope 1 is for /baz')

    // invalid scopes must not be allowed
    t.throws(() => auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined, writeScopesTooLong),
      errors.ValidationError, 'Too many scopes must throw')

    t.throws(() => auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined, writeScopesInvalid),
      errors.ValidationError, 'Invalid scopes must throw')

    t.end()
  })
}
