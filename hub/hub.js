// step 1: validate the write
//         writes require a signature of
// step 2: perform write, return address

const logging = require('winston')
const S3 = require('aws-sdk/clients/s3')

function addressToBucket(address){
    return `blockstack_user_${address}`
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
