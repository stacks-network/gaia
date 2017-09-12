// step 1: validate the write
//         writes require a signature of
// step 2: perform write, return address

const url = require('url')
const logging = require('winston')
const S3 = require('aws-sdk/clients/s3')
const bitcoinjs = require('bitcoinjs-lib')

const BEARER_HEADER = "bearer "
const REQUEST_PATH = "/store/"

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
    const header = "gaiahub"
    const date = new Date().toISOString().split("T")[0]
    const myChallenge = "blockstack_storage_please_sign"
    const myURL = "storage.blockstack.org"
    return JSON.stringify( [header, date, myURL, myChallenge] )
}

function doWrite(address, filename, readableStream, callback){
    var s3parameters = {
        Bucket: addressToBucket(address),
        Key: filename,
    }
    S3.upload(s3parameters, function(err, data){
        if(err){
            logError(err)
            callback(err, null)
        }
        callback(null, data)
    })
}

function parsePath(path){
    if (! path.startswith(REQUEST_PATH)){
        return false
    }
    path = path.slice(REQUEST_PATH.length)
    if (path.endswith("/")){
        path = path.slice(0, -1)
    }
    const firstPathPart = path.indexOf("/")
    if (firstPathPart === -1){
        return false
    }
    var address = path.slice(0, firstPathPart)
    var filename = path.slice(firstPathPart + 1)
    return { address : address,
             filename : filename }
}

function handlePostRequest(request){
    var path = url.parse(request.url).path
    var authHeader = request.headers.authentication
    var parsedPath = parsePath(path)

    if (parsedPath === false){
        // todo: error path 404
    }
    if (! authHeader.startsWith(BEARER_HEADER)){
        // todo: error path 401
        return false
    }
    // for now, signature <==> authHeader
    const signature = authHeader.slice(BEARER_HEADER)
    const address = parsedPath.address
    const filename = parsedPath.filename

    if (! checkSignature(signature, challengeText(), address)){
        // todo: auth failure path
        return false
    }
    // pass request's POST data via ReadableStream interface
    doWrite(address, filename, request,
            responseCB);
}
