const blockstack = require('blockstack')
const jsontokens = require('jsontokens')

class ProofChecker {

  constructor ( proofsConfig, logger, storageDriver ){
    this.proofsRequired = proofsConfig.proofsRequired
    this.logger = logger
    this.storageDriver = storageDriver
  }

  static makeProofsHeader ( proofs, name = false ){
    let socialProofObj = { proofs }
    if ( name !== false ) {
      socialProofObj.name = name
    }
    return Buffer(JSON.stringify(socialProofObj)).toString('base64')
  }

  static proofObjectFromHeader ( proofHeader ){
    return JSON.parse(Buffer(proofHeader, 'base64').toString())
  }

  fetchProfile ( address ) {
    let filename = `${address}/0/profile.json`
    let readURL = this.storageDriver.getReadURLPrefix()
    const url = `${readURL}${filename}`

    return fetch( url )
      .then(x => x.json())
      .then(x => x[0])
      .then(x => [jsontokens.decodeToken(x.token).payload, x.token])
      .then(pieces => {
        let x = pieces[0]
        let token = pieces[1]
        let verifier = new jsontokens.TokenVerifier('ES256k', x.subject.publicKey)
        let verified = verifier.verify(token)
        if (verified) {
          return x.claim
        } else {
          return false
        }
      })

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
        let validProofs = proofs.filter(p => p.valid)
        if(this.validEnough(validProofs)) {
          return true
        } else {
          throw new NotEnoughProofError('Not enough social proofs for gaia hub writes')
        }
      })
  }
}

module.exports = ProofChecker
