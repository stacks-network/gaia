import blockstack from 'blockstack'
import logger from 'winston'
import fetch from 'node-fetch'

import { NotEnoughProofError } from './errors'

export class ProofChecker {

  constructor(proofsConfig, storageDriver) {
    if (!proofsConfig) {
      this.proofsRequired = 0
    } else {
      this.proofsRequired = proofsConfig.proofsRequired
    }
    this.storageDriver = storageDriver
  }

  static makeProofsHeader(proofs, name = false) {
    const socialProofObj = { proofs }
    if ( name !== false ) {
      socialProofObj.name = name
    }
    return Buffer.from(JSON.stringify(socialProofObj)).toString('base64')
  }

  static proofObjectFromHeader(proofHeader) {
    return JSON.parse(Buffer.from(proofHeader, 'base64').toString())
  }

  fetchProfile(address) {
    const filename = `${address}/profile.json`
    const readURL = this.storageDriver.getReadURLPrefix()
    const url = `${readURL}${filename}`

    return fetch(url)
      .then(x => x.json())
      .then(x => x[0].token)
      .then(token => blockstack.verifyProfileToken(token, address))
      .then(verified => verified.payload.claim)
  }

  validEnough(validProofs) {
    logger.debug(`Found ${validProofs.length} valid proofs for user.`)
    return (validProofs.length >= this.proofsRequired)
  }

  checkProofs(address: string, filename: string) {
    if (this.proofsRequired == 0 || filename.endsWith('/profile.json')) {
      return Promise.resolve(true)
    }
    return this.fetchProfile(address)
      .then(profile =>
            blockstack.validateProofs(profile, address, undefined) )
      .catch(error => {
        logger.error(error)
        throw new NotEnoughProofError('Error fetching and verifying social proofs')
      })
      .then(proofs => {
        const validProofs = proofs.filter(p => p.valid)
        if(this.validEnough(validProofs)) {
          return true
        } else {
          throw new NotEnoughProofError('Not enough social proofs for gaia hub writes')
        }
      })
  }
}
