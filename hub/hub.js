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
            callback(err, null, 500)
        }
        callback(null, data, 202)
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

function writeResponse(response, error, data, statusCode){
    // todo: for now, just responding in plaintext, but want
    //       to move to a json api
    response.writeHead(statusCode, {'Content-Type' : 'text/plain'})
    // todo: cors headers
    if (error){
        response.write(error)
    }else{
        response.write(data)
    }
    response.end()
}

function handlePostRequest(request, response){
    var path = url.parse(request.url).path
    var authHeader = request.headers.authentication
    var parsedPath = parsePath(path)

    const responseCB = function(error, data, statusCode){
        writeResponse(response, error, data, statusCode)
    }

    if (parsedPath === false){
        return responseCB({message : "No such endpoint"}, null , 404)
    }
    if (! authHeader.startsWith(BEARER_HEADER)){
        return responseCB({message : "Bad authentication header"}, null , 401)
    }
    // for now, signature <==> authHeader
    const signature = authHeader.slice(BEARER_HEADER)
    const address = parsedPath.address
    const filename = parsedPath.filename

    if (! checkSignature(signature, challengeText(), address)){
        return responseCB({message : "Authentication check failed"}, null , 401)
    }
    // pass request's POST data via ReadableStream interface
    doWrite(address, filename, request, responseCB);
}

function handleOptions(request, response){
    // TODO
}

