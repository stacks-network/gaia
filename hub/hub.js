// step 1: validate the write
//         writes require a signature of
// step 2: perform write, return address

const logging = require('winston')
const S3 = require('aws-sdk/clients/s3')
const bitcoinjs = require('bitcoinjs-lib')

function addressToBucket(address){
    return `blockstack_user_${address}`
}

function pubkeyHexToECPair(pubkeyHex){
    const pkBuff = Buffer.from(pubkeyHex, "hex")
    return bitcoin.ECPair.fromPublicKeyBuffer(pkBuff)
}

function checkSignature(signature, rawtext, address){
    // todo: what about a multisig owner?
    const sigObj = JSON.parse(signature)
    const pkObj = pubkeyHexToECPair(sigObj.publickey)
    if (pkObj.getAddress() !== address){
        return false;
    }
    const digest = bitcoin.crypto.sha256(Buffer(rawtext))
    return pkObj.verify(digest, sigObj.signed)
}

function challengeText(){
    const date = new Date().toISOString().split("T")[0]
    const myChallenge = "blockstack_storage_please_sign"
    const myURL = "storage.blockstack.org"
    return JSON.stringify( [date, myURL, myChallenge] )
}

function doWrite(address, filename, blob, callback){
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
