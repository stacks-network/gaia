import * as Path from 'path'
import { create } from 'ipfs-http-client'
import { create as createDaemon } from 'ipfs-core'
import { HttpApi } from 'ipfs-http-server'
import { HttpGateway } from 'ipfs-http-gateway'
import { makeECPrivateKey, getPublicKeyFromPrivate, publicKeyToAddress } from '@stacks/encryption'
import { LoremIpsum } from "lorem-ipsum";
import { v4 as uuidv4 } from 'uuid';
import { base16 } from 'multiformats/bases/base16'
import { ReaderServer } from '../src/server.js'
import IpfsDriver from '../src/drivers/IpfsDriver.js'
import { getConfig } from '../src/config.js'

test('check ipfs driver handleGet', (done) => {
  const driverConfig = {
    cacheControl: 'no-cache',
    driver: 'ipfs',
    argsTransport: {
      level: 'warn',
      handleExceptions: true,
      timestamp: true,
      colorize: true,
      json: true
    },
    regtest: false,
    testnet: false,
    port: 8008,
    ipfsSettings: {
      'isIpfsAlready': false,
      'storageRootDirectory': '/gaia-ipfs',
      'apiAddress': '/ip4/127.0.0.1/tcp/5002'
    }
  }
  const lorem = new LoremIpsum({
    sentencesPerParagraph: {
      max: 8,
      min: 4
    },
    wordsPerSentence: {
      max: 16,
      min: 4
    }
  });

  createDaemon()
    .then(ipfs => {
      const httpApi = new HttpApi(ipfs)
      const httpGateway = new HttpGateway(ipfs)
      return Promise.all([httpApi.start(), httpGateway.start()])
    })
    .then(() => {
      // run ipfs daemon
      // create the ipfs reader driver
      const serverConfig = getConfig()
      let driver = new IpfsDriver(driverConfig)
      const server = new ReaderServer(driver, serverConfig)



      /**
       * START: mock upload file to the ipfs
       */
      const IpfsClient = create({ url: driverConfig.ipfsSettings.apiAddress })
      const privateKey = makeECPrivateKey();
      const publicKey = getPublicKeyFromPrivate(privateKey);
      const address = publicKeyToAddress(publicKey);
      const rndFileName = `${uuidv4()}.txt`
      const rndFileContent = lorem.generateSentences(5)
      const METADATA_DIRNAME = '.gaia-metadata'
      let etag = ''

      const absoluteFilePath = Path.join(driverConfig.ipfsSettings.storageRootDirectory, address, rndFileName)
      const metaDataFilePath = Path.join(driverConfig.ipfsSettings.storageRootDirectory, METADATA_DIRNAME, address, rndFileName)

      const absdirname = Path.dirname(absoluteFilePath)
      const normalizedPath = Path.normalize(absdirname)
      // Ensures that the directory exists. If the directory structure does not exist, it is created. Like mkdir -p.
      IpfsClient.files.mkdir(normalizedPath, { parents: true })
        .then(() => {
          return IpfsClient.files.write(absoluteFilePath, rndFileContent, { create: true, mode: 0o600 })
        })
        .then(() => {
          return IpfsClient.files.stat(absoluteFilePath)
        })
        .then((stat) => {
          etag = stat.cid.toV1().toString(base16)
          const metaDataDirPath = Path.dirname(metaDataFilePath)
          return IpfsClient.files.mkdir(metaDataDirPath)
        })
        .then(() => {
          return IpfsClient.files.write(metaDataFilePath, JSON.stringify({ etag }), { create: true, mode: 0o600 })
        })
        .then(() => {
          /**
          * END: mock upload file to the ipfs
          */
          server.handleGet(address, rndFileName)
            .then(async (result) => {
              // file exists
              expect(result.exists).toBeTruthy()
              // file etag to be equal
              expect(result.etag).toEqual(etag)
              let fileContent
              if(result.fileReadStream) {
                for await (const chunk of result.fileReadStream) {
                  fileContent = chunk.toString()
                }
                // file content to be equal ranFileContent
                expect(fileContent).toEqual(rndFileContent)
              }
              return server.handleGet(publicKeyToAddress(getPublicKeyFromPrivate(makeECPrivateKey())), rndFileName)
            })
            .then((result) => {
              
              // file shouldn't exists
              expect(result.exists).toBeFalsy()
              done()
            })
        })
    })
})

