import * as Path from 'path'
import { create } from 'ipfs-http-client'
import { create as createDaemon, IPFS } from 'ipfs-core'
import { HttpApi } from 'ipfs-http-server'
import { HttpGateway } from 'ipfs-http-gateway'
import { makeECPrivateKey, getPublicKeyFromPrivate, publicKeyToAddress } from '@stacks/encryption'
import { LoremIpsum } from "lorem-ipsum";
import { v4 as uuidv4 } from 'uuid';
import { base16 } from 'multiformats/bases/base16'
import { ReaderServer } from '../src/server.js'
import IpfsDriver from '../src/drivers/IpfsDriver.js'
import { getConfig } from '../src/config.js'



describe('ipfsDriver test', () => {
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

  var IpfsNode: IPFS
  var httpApi: HttpApi
  var httpGateway: HttpGateway
  var server: ReaderServer

  beforeAll(async () => {
    // run ipfs daemon
    IpfsNode = await createDaemon()
    httpApi = new HttpApi(IpfsNode)
    httpGateway = new HttpGateway(IpfsNode)
    await httpApi.start()
    await httpGateway.start()
  })

  it('check ipfs driver handleGet', async () => {
    // create the ipfs reader driver
    const serverConfig = getConfig()
    let driver = new IpfsDriver(driverConfig)
    server = new ReaderServer(driver, serverConfig)
    
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
    await IpfsClient.files.mkdir(normalizedPath, { parents: true })
    await IpfsClient.files.write(absoluteFilePath, rndFileContent, { create: true, mode: 0o600 })
    let stat = await IpfsClient.files.stat(absoluteFilePath)

    etag = stat.cid.toV1().toString(base16)
    const metaDataDirPath = Path.dirname(metaDataFilePath)
    
    await IpfsClient.files.mkdir(metaDataDirPath)
    await IpfsClient.files.write(metaDataFilePath, JSON.stringify({ etag }), { create: true, mode: 0o600 })
    /**
    * END: mock upload file to the ipfs
    */
    let result1 = await server.handleGet(address, rndFileName)
    // file exists
    expect(result1.exists).toBeTruthy()
    // file etag to be equal
    expect(result1.etag).toEqual(etag)
    let fileContent
    if (result1.fileReadStream) {
      for await (const chunk of result1.fileReadStream) {
        fileContent = chunk.toString()
      }
      // file content to be equal ranFileContent
      expect(fileContent).toEqual(rndFileContent)
    }
    let result2 = await server.handleGet(publicKeyToAddress(getPublicKeyFromPrivate(makeECPrivateKey())), rndFileName)
    // file shouldn't exists
    expect(result2.exists).toBeFalsy()
  })

  afterAll((done) => {
    httpApi.stop()
      .then(() => httpGateway.stop())
      .then(() => IpfsNode.stop())
      .then(() => done())
  })
})
