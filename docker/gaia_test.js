const bsk = require('blockstack')
const privateKey = bsk.makeECPrivateKey()
const publicKey = bsk.getPublicKeyFromPrivate(privateKey)
const address = bsk.publicKeyToAddress(publicKey)

const hubUrl = 'http://localhost:80'

bsk.connectToGaiaHub(hubUrl, privateKey)
  .then((hubConfig) => {
    return bsk.uploadToGaiaHub('foo.txt', 'hello world!', hubConfig)
      .then((writtenFile) => {
        console.log(`Upload to gaia hub thinks it can read from: ${writtenFile}`)
        console.log(`Hub info thinks it can read from: ${hubConfig.url_prefix}${hubConfig.address}/foo.txt`)
        return fetch(`${hubConfig.url_prefix}${hubConfig.address}/foo.txt`)
          .then(resp => resp.text())
          .then(x => console.log(`Contents of file: ${x}`))
      })
  })

