var blockstack = require('blockstack')

class ProofChecker {

  constructor ( proofsConfig, logger ){
    if (proofsConfig.hasOwnProperty('apiServer'))
      this.apiServer = proofsConfig.apiServer
    else
      this.apiserver =  'https://core.blockstack.org'
    this.proofsRequired = proofsConfig.proofsRequired
    this.logger = logger
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

  validEnough ( validProofs ) {
    this.logger.debug(validProofs)
    return (validProofs.length >= this.proofsRequired)
  }

  checkProofs ( req ) {
    // returns indices of valid proofs
    return new Promise((resolve) => {
      // get headers from req
      if (this.proofsRequired == 0) {
        resolve(true)
      }
      if (! 'x-blockstack-socialproofs' in req.headers){
        resolve(false)
      }
      let address = req.params.address
      // 0. check if we cached the social proof

      // 1. parse out proofs
      let proofHeader = req.headers['x-blockstack-socialproofs']
      let socialProofObj = ProofChecker.proofObjectFromHeader(proofHeader)
      // 2. lookup name if supplied
      new Promise((resolve) => {
        if ( socialProofObj.hasOwnProperty('name') ) {
          const url = `${this.apiserver}/v1/names/${socialProofObj.name}`
          fetch( url )
            .then(response => response.text())
            .then(responseText => JSON.parse(responseText))
            .then(responseJSON => {
              if (! 'address' in responseJSON ) {
                resolve(null)
              } else {
                if (responseJSON.address == address){
                  resolve(name)
                }else{
                  resolve(null)
                }
              }
            })
            .catch(() => {resolve(null)})
              } else {
                resolve(null)
              }})
        .then( (name) => {
          let account = socialProofObj.proofs
          let mockProfile = { account }
          blockstack.validateProofs(mockProfile, address, name)
            .then( ( proofs ) => {
              let validProofs = proofs.filter(
                ( p ) => { return p.valid } )
              resolve( this.validEnough( validProofs ) )
            }) })
    })
  }

}


module.exports = ProofChecker
