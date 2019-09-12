import test = require('tape-promise/tape')
import { ProofChecker } from '../../src/server/ProofChecker'

export function testProofChecker() {

  test('proof checker validation', async (t) => {
    // This profile has 6 social proofs setup.
    // At least 1 should be valid despite bugs in blockstack.js
    // social website DOM parsing or whatever else going wrong. 
    const address = '1Nw25PemCRv24UQAcZdaj4uD11nkTCWRTE'
    const filename = 'somefile'
    const readURL = 'https://gaia.blockstack.org/hub/'
    const proofChecker = new ProofChecker({ proofsRequired: 1 })
    const isValid = await proofChecker.checkProofs(address, filename, readURL)
    t.ok(isValid, 'proof checker should have at least 1 validation')
  })

  test('proof checker not enough proofs', async (t) => {
    // This profile has no social proofs setup. 
    const address = '1HiCJwWuAzUxU93anq5XyBUcoWFPHMQugR'
    const filename = 'somefile'
    const readURL = 'https://gaia.blockstack.org/hub/'
    const proofChecker = new ProofChecker({ proofsRequired: 1 })
    try {
      await proofChecker.checkProofs(address, filename, readURL)
      t.fail('profile with no social proofs setup should fail validation')
    } catch (error) {
      t.equal(error.name, "NotEnoughProofError", "should have NotEnoughProofError")
      t.equal(error.message, "Not enough social proofs for gaia hub writes", "should have correct error message")
    }
  })

  test('proof checker unreachable read url', async (t) => {
    const address = '1Nw25PemCRv24UQAcZdaj4uD11nkTCWRTE'
    const filename = 'somefile'
    const readURL = 'https://not.here.local/hub/'
    const proofChecker = new ProofChecker({ proofsRequired: 1 })
    try {
      await proofChecker.checkProofs(address, filename, readURL)
      t.fail('profile with no social proofs setup should fail validation')
    } catch (error) {
      t.equal(error.name, "NotEnoughProofError", "should have NotEnoughProofError")
      t.equal(error.message, "Error fetching and verifying social proofs", "should have correct error message")
    }
  })

}
