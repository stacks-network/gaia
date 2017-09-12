// step 1: validate the write
//         writes require a signature of
// step 2: perform write, return address

const logging = require('winston')
const S3 = require('aws-sdk/clients/s3')

function addressToBucket(address){
    return `blockstack_user_${address}`
}

function checkSignature(signature, rawtext, address){
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
