var blockstack = require('blockstack')

class ProofChecker {

  constructor ( proofsConfig, logger ){
    if (proofsConfig.hasOwnProperty('apiServer'))
      this.apiServer = proofsConfig.apiServer
    else
      this.apiserver =  'https://core.blockstack.org'
  }

  checkProofs ( req, res ) {
    // returns indices of valid proofs
    return new Promise((resolve) => {
      // get headers from req
      if (! "X-BLOCKSTACK-SOCIALPROOFS" in req.headers){
        resolve([]);
      }
      let address = req.params.address
      // 0. check if we cached the social proof

      // 1. parse out proofs
      let socialProofObj = JSON.parse(
        Buffer(req.headers["X-BLOCKSTACK-SOCIALPROOFS"], 'base64').toString())
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
              proofs.filter( ( p ) => { p.valid })
              resolve( proofs )
            }) })
    })
  }
