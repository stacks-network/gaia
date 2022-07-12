import { ProofChecker } from '../../src/server/ProofChecker.js'


describe('proof checker validation', () => {
  // This profile has 6 social proofs setup.
  // At least 1 should be valid despite bugs in stacks.js
  // social website DOM parsing or whatever else going wrong.
  test('proof checker should have at least 1 validation', async () => {
    const address = '1Nw25PemCRv24UQAcZdaj4uD11nkTCWRTE'
    const filename = 'somefile'
    const readURL = 'https://gaia.blockstack.org/hub/'
    const proofChecker = new ProofChecker({ proofsRequired: 1 })
    const isValid = await proofChecker.checkProofs(address, filename, readURL)
    expect(isValid).toBeTruthy()
  })
})

describe('proof checker not enough proofs', () => {
  // This profile has no social proofs setup.
  test("should have NotEnoughProofError + should have correct error message", async () => {
    expect.assertions(2)
    const address = '1HiCJwWuAzUxU93anq5XyBUcoWFPHMQugR'
    const filename = 'somefile'
    const readURL = 'https://gaia.blockstack.org/hub/'
    const proofChecker = new ProofChecker({ proofsRequired: 1 })
    try {
      await proofChecker.checkProofs(address, filename, readURL)
      // t.fail('profile with no social proofs setup should fail validation')
    } catch (error) {
      expect(error.name).toEqual("NotEnoughProofError")
      expect(error.message).toEqual("Not enough social proofs for gaia hub writes")
    }
  })
})

describe('proof checker unreachable read url', () => {
  test("should have NotEnoughProofError + should have correct error message", async () => {
    expect.assertions(2)
    const address = '1Nw25PemCRv24UQAcZdaj4uD11nkTCWRTE'
    const filename = 'somefile'
    const readURL = 'https://not.here.local/hub/'
    const proofChecker = new ProofChecker({ proofsRequired: 1 })
    try {
      await proofChecker.checkProofs(address, filename, readURL)
    } catch (error) {
      expect(error.name).toEqual("NotEnoughProofError")
      expect(error.message).toEqual("Error fetching and verifying social proofs")
    }
  })
})
