var logging = require('winston')
var S3 = require('aws-sdk/clients/s3')
var bitcoinjs = require('bitcoinjs-lib')

class StorageRequest {
  constructor (address,publickeyHex) {
    this.address = address,
    this.publickeyHex = publickeyHex
  }
  // addressToBucket takes and address and returns the
  // folder in the S3 bucket assigned to that address
  addressToBucket (address) {
    return `blockstack_user_${address}`
  }

  // pubkeyHexToECPair takes a publickeyHex and does some stuff to it
  pubkeyHexToECPair (pubkeyHex) {
    const pkBuff = Buffer.from(pubkeyHex, "hex")
    return bitcoin.ECPair.fromPublicKeyBuffer(pkBuff)
  }

  // checkSignature makes sure a signature is valid given signature, rawtext, and address
  checkSignature (signature, rawtext, address) {
    // todo: what about a multisig owner?
    const sigObj = JSON.parse(signature)
    const pkObj = pubkeyHexToECPair(sigObj.publickey)
    if (pkObj.getAddress() !== address){
        return false;
    }
    const digest = bitcoin.crypto.sha256(Buffer(rawtext))
    return pkObj.verify(digest, sigObj.signed)
  }

  // challengeText returns an error message to unsigned requests
  challengeText () {
    const date = new Date().toISOString().split("T")[0]
    const myChallenge = "blockstack_storage_please_sign"
    const myURL = "storage.blockstack.org"
    return JSON.stringify( [date, myURL, myChallenge] )
  }

  doWrite (address, filename, blob, callback) {
    var s3parameters = {
      Body: blob,
      Bucket: addressToBucket(address),
      Key: filename,
    }
    S3.putObject(s3parameters, function(err, data){
      if(err){
        logError(err)
        callback(err, null)
      }
      callback(null, data)
    })
  }

}

module.exports = StorageRequest
