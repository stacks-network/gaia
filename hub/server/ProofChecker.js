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

  validEnough ( validProofs ) {
    this.logger.debug(validProofs)
    return (validProofs.length >= this.proofsRequired)
  }

  checkProofs ( req ) {
    return new Promise((resolve) => {
      // 1: if we're writing the profile or don't need proofs, let it pass.
      if (this.proofsRequired == 0 || req.params.filename == '0/profile.json') {
        resolve(true)
      }else{
        let address = req.params.address
        // 0: check if we cached the social proofs
        // 1: fetch the profile.json
        this.fetchProfile( address )
          .then( profile =>
                 blockstack.validateProofs(profile, address, undefined) )
          .then( proofs => {
            let validProofs = proofs.filter(
              ( p ) => { return p.valid } )
            resolve( this.validEnough( validProofs ) )
          })
          .catch( x => {
            this.logger.error(x)
            resolve( false )
          })
      }
    })
  }


module.exports = ProofChecker
