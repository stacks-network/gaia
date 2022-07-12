import { TokenSigner } from 'jsontokens'

import * as auth from '../../src/server/authentication.js'
import * as errors from '../../src/server/errors.js'


import { testPairs, testAddrs } from './common.js'
import { ECPairInterface } from 'ecpair'


describe('authentication legacy/regression', () => {
  const legacyPart = {
    wif: 'Kzp44Hhp6SFUXMuMi6MUDTqyfcNyyjntrphEHVMsiitRrjMyoV4p',
    addr: '1AotVNASQouiNiBtfxv49WWvSNcQUzGYuU',
    serverName: 'storage.blockstack.org',
    legacyAuth: 'eyJwdWJsaWNrZXkiOiIwMjQxYTViMDQ2Mjg1ZjVlMjgwMDRmOTJjY2M0MjNmY2RkODYyZmYzY' +
      'jgwODUwNzE4MDY4MGIyNDA3ZTIyOWE3NzgiLCJzaWduYXR1cmUiOiIzMDQ0MDIyMDY5ODUwNmNjYjg3MDg1Zm' +
      'Y5ZGI3ZTc4MTIwYTVmMjY1YzExZmY0ODc4OTBlNDQ1MWZjYWM3NjA4NTkyMDhjZWMwMjIwNTZkY2I0OGUyYzE' +
      '4Y2YwZjQ1NDZiMmQ3M2I2MDY4MWM5ODEyMzQyMmIzOTRlZjRkMWI2MjE3NTYyODQ4MzUwNCJ9'
  }
  it('legacy authentication token should work', () => {
    expect(() => auth.validateAuthorizationHeader(`bearer ${legacyPart.legacyAuth}`,
      legacyPart.serverName,
      legacyPart.addr)
    ).not.toThrow()
  });
})

describe('authentication legacy/regression with multi-case bearer', () => {
  const legacyPart = {
    wif: 'Kzp44Hhp6SFUXMuMi6MUDTqyfcNyyjntrphEHVMsiitRrjMyoV4p',
    addr: '1AotVNASQouiNiBtfxv49WWvSNcQUzGYuU',
    serverName: 'storage.blockstack.org',
    legacyAuth: 'eyJwdWJsaWNrZXkiOiIwMjQxYTViMDQ2Mjg1ZjVlMjgwMDRmOTJjY2M0MjNmY2RkODYyZmYzY' +
      'jgwODUwNzE4MDY4MGIyNDA3ZTIyOWE3NzgiLCJzaWduYXR1cmUiOiIzMDQ0MDIyMDY5ODUwNmNjYjg3MDg1Zm' +
      'Y5ZGI3ZTc4MTIwYTVmMjY1YzExZmY0ODc4OTBlNDQ1MWZjYWM3NjA4NTkyMDhjZWMwMjIwNTZkY2I0OGUyYzE' +
      '4Y2YwZjQ1NDZiMmQ3M2I2MDY4MWM5ODEyMzQyMmIzOTRlZjRkMWI2MjE3NTYyODQ4MzUwNCJ9' }
  it('legacy authentication token should work', () => {
    expect(() => auth.validateAuthorizationHeader(`BeArEr ${legacyPart.legacyAuth}`,
      legacyPart.serverName,
      legacyPart.addr)
    ).not.toThrow()
  })
})

describe('storage validation', () => {
  const challengeText = auth.getChallengeText()
  const authPart = auth.LegacyAuthentication.makeAuthPart(testPairs[0], challengeText)
  const authorization = `bearer ${authPart}`
  const authenticator = auth.parseAuthHeader(authorization)
  it('Wrong address must throw', () => {
    expect(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Wrong challenge text must throw', () => {
    expect(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos']))
      .toThrow(errors.ValidationError)
  })
  it('Good signature must pass', () => {
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]))
      .toBeTruthy()
  })
  it('Bad signature must throw', () => {
    expect(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow()
  })
})

describe('v1 storage validation', () => {
  const challengeText = 'bananas are tasty'
  const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText)
  console.log(`V1 storage validation: ${authPart}`)
  const authorization = `bearer ${authPart}`
  const authenticator = auth.parseAuthHeader(authorization)

  it('Wrong address must throw', () => {
    expect(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Wrong challenge text must throw', () => {
    expect(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']))
      .toThrow(errors.ValidationError)
  })
  it('Good signature must pass', () => {
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]))
      .toBeTruthy()

    // signer address was from the v1 token
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText])).toEqual(testAddrs[0])
  })

  const signerKeyHex = testPairs[0].privateKey.toString('hex')
  const tokenWithoutIssuer = new TokenSigner('ES256K', signerKeyHex).sign(
    { garbage: 'in' })
  const goodTokenWithoutExp = new TokenSigner('ES256K', signerKeyHex).sign(
    { gaiaChallenge: challengeText, iss: testPairs[0].publicKey.toString('hex') })
  const expiredToken = new TokenSigner('ES256K', signerKeyHex).sign(
    { gaiaChallenge: challengeText, iss: testPairs[0].publicKey.toString('hex'), exp: 1 })
  const wrongIssuerToken = new TokenSigner('ES256K', signerKeyHex).sign(
    { gaiaChallenge: challengeText, iss: testPairs[1].publicKey.toString('hex'), exp: 1 })
  it('No `iss`, should fail', () => {
    expect(() => new auth.V1Authentication(tokenWithoutIssuer).isAuthenticationValid(testAddrs[0], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Expired token should fail', () => {
    expect(() => new auth.V1Authentication(expiredToken).isAuthenticationValid(testAddrs[0], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Invalid signature', () => {
    expect(() => new auth.V1Authentication(wrongIssuerToken).isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Valid token without expiration should pass', () => {
    expect(new auth.V1Authentication(goodTokenWithoutExp).isAuthenticationValid(testAddrs[0], [challengeText]))
      .toBeTruthy()
  })
})

describe('v1 storage validation with hubUrls required', () => {
  const challengeText = 'bananas are tasty'
  const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText)
  console.log(`V1 storage validation: ${authPart}`)
  const authorization = `bearer ${authPart}`
  const authenticator = auth.parseAuthHeader(authorization)
  it('Wrong address must throw', () => {
    expect(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Wrong challenge text must throw', () => {
    expect(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']))
      .toThrow(errors.ValidationError)
  })
  it('Good signature must pass', () => {
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]))
      .toBeTruthy()

    // signer address was from the v1 token
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText])).toEqual(testAddrs[0])
  })

  const signerKeyHex = testPairs[0].privateKey.toString('hex')
  const tokenWithoutIssuer = new TokenSigner('ES256K', signerKeyHex).sign(
    { garbage: 'in' })
  const goodTokenWithoutExp = new TokenSigner('ES256K', signerKeyHex).sign(
    { gaiaChallenge: challengeText, iss: testPairs[0].publicKey.toString('hex') })
  const expiredToken = new TokenSigner('ES256K', signerKeyHex).sign(
    { gaiaChallenge: challengeText, iss: testPairs[0].publicKey.toString('hex'), exp: 1 })
  const wrongIssuerToken = new TokenSigner('ES256K', signerKeyHex).sign(
    { gaiaChallenge: challengeText, iss: testPairs[1].publicKey.toString('hex'), exp: 1 })
  it('No `iss`, should fail', () => {
    expect(() => new auth.V1Authentication(tokenWithoutIssuer).isAuthenticationValid(testAddrs[0], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Expired token should fail', () => {
    expect(() => new auth.V1Authentication(expiredToken).isAuthenticationValid(testAddrs[0], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Invalid signature', () => {
    expect(() => new auth.V1Authentication(wrongIssuerToken).isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Valid token without expiration should pass', () => {
    expect(new auth.V1Authentication(goodTokenWithoutExp).isAuthenticationValid(testAddrs[0], [challengeText]))
      .toBeTruthy()
  })
})

describe('v1 storage validation with association token', () => {
  const challengeText = 'bananas are tasty'
  const associationToken = auth.V1Authentication.makeAssociationToken(testPairs[1], testPairs[0].publicKey.toString('hex'))
  const authPart = auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, associationToken)
  console.log(`V1 storage validation: ${authPart}`)
  const authorization = `bearer ${authPart}`
  const authenticator = auth.parseAuthHeader(authorization)
  it('Wrong address must throw', () => {
    expect(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  });
  it('Wrong challenge text must throw', () => {
    expect(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']))
      .toThrow(errors.ValidationError)
  })
  it('Good signature must pass', () => {
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText]))
      .toBeTruthy()

    // signer address was from the association token
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText])).toEqual(testAddrs[1])
  })

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
  it('No `iss`, should fail', () => {
    expect(() => new auth.V1Authentication(tokenWithoutIssuer).isAuthenticationValid(testAddrs[0], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Expired token should fail', () => {
    expect(() => new auth.V1Authentication(expiredToken).isAuthenticationValid(testAddrs[0], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Invalid signature', () => {
    expect(() => new auth.V1Authentication(wrongIssuerToken).isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Valid token without expiration should pass', () => {
    expect(new auth.V1Authentication(goodTokenWithoutExp).isAuthenticationValid(testAddrs[0], [challengeText]))
      .toBeTruthy()
  })

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

  it('No `iss` in association token, should fail', () => {
    expect(() => makeAssocAuthToken(testPairs[1], challengeText, associationTokenWithoutIssuer).isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Association token without exp should fail', () => {
    expect(() => makeAssocAuthToken(testPairs[1], challengeText, associationTokenWithoutExp).isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Expired association token should fail', () => {
    expect(() => makeAssocAuthToken(testPairs[1], challengeText, expiredAssociationToken).isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Wrong association token issuer, should fail', () => {
    expect(() => makeAssocAuthToken(testPairs[1], challengeText, wrongIssuerAssociationToken).isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Wrong bearer address for association token, should fail', () => {
    expect(() => makeAssocAuthToken(testPairs[1], challengeText, wrongBearerAddressAssociationToken).isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
})

describe('v1 storage validation with scoped authentication token', () => {
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
  it('Wrong address must throw', () => {
    expect(() => authenticator.isAuthenticationValid(testAddrs[1], [challengeText]))
      .toThrow(errors.ValidationError)
  })
  it('Wrong challenge text must throw', () => {
    expect(() => authenticator.isAuthenticationValid(testAddrs[0], ['potatos are tasty']))
      .toThrow(errors.ValidationError)
  })
  it('Good signature must pass', () => {
    expect(authenticator.isAuthenticationValid(testAddrs[0], [challengeText])).toBeTruthy()
  })

  // scopes must be present
  const authScopes = authenticator.getAuthenticationScopes()
  it('scope 0 is putfile', () => {
    expect(authScopes[0].scope).toEqual('putFile')
  })
  it('scope 0 is for /foo/bar', () => {
    expect(authScopes[0].domain).toEqual('/foo/bar')
  })
  it('scope 1 is putfile', () => {
    expect(authScopes[1].scope).toEqual('putFile')
  })
  it('scope 1 is for /baz', () => {
    expect(authScopes[1].domain).toEqual('/baz')
  })

  // invalid scopes must not be allowed
  it('Too many scopes must throw', () => {
    expect(() => auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined, writeScopesTooLong))
      .toThrow(errors.ValidationError)
  })
  it('Invalid scopes must throw', () => {
    expect(() => auth.V1Authentication.makeAuthPart(testPairs[0], challengeText, undefined, undefined, writeScopesInvalid))
      .toThrow(errors.ValidationError)
  })
})
