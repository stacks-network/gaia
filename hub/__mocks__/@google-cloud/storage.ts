import {Writable} from "stream";
import {createHash} from "crypto";
import {gcDataMap} from "../../test/src/testDrivers/global";

type DataMap = {key: string, data: string, etag: string}[];
let myName = ''

const file = function (filename) {
  const fileMetadata = { md5Hash: undefined as string }
  const createWriteStream = function() {
    const mockWriteStream = new MockWriteStream(gcDataMap, filename)
    mockWriteStream.addListener('finish', () => {
      fileMetadata.md5Hash = Buffer.from(mockWriteStream.etag, 'hex').toString('base64')
    })
    return mockWriteStream
  }
  return {
    createWriteStream,
    delete: () => {
      return Promise.resolve().then(() => {
        const newDataMap = gcDataMap.filter((d) => d.key !== filename)
        if (newDataMap.length === gcDataMap.length) {
          const err: any = new Error()
          err.code = 404
          throw err
        }
        gcDataMap.length = 0
        gcDataMap.push(...newDataMap)
      })
    },
    metadata: fileMetadata
  }
}
const exists = function () {
  return Promise.resolve([true])
}
const StorageClass = class {
  bucket(bucketName) {
    if (myName === '') {
      myName = bucketName
    } else {
      if (myName !== bucketName) {
        throw new Error(`Unexpected bucket name: ${bucketName}. Expected ${myName}`)
      }
    }
    return { file, exists, getFiles: this.getFiles }
  }

  getFiles(options, cb) {
    const files = gcDataMap
      .filter(entry => entry.key.startsWith(options.prefix))
      .map(entry => { return { name: entry.key, etag: entry.etag } })
    cb(null, files, null)
  }
}

class MockWriteStream extends Writable {
  dataMap: DataMap
  filename: string
  data: string
  etag: string
  constructor(dataMap: DataMap, filename: string) {
    super({})
    this.dataMap = dataMap
    this.filename = filename
    this.data = ''
  }
  _write(chunk: any, encoding: any, callback: any) {
    this.data += chunk
    callback()
    return true
  }
  _final(callback: any) {
    this.etag = createHash('md5').update(this.data).digest('hex')
    this.dataMap.push({ data: this.data, key: this.filename, etag: this.etag })
    callback()
  }
}

export { StorageClass as Storage }
