import {readStream} from "../../../src/server/utils";
import {createHash} from "crypto";
import {s3DataMap} from "../../../test/src/testDrivers/global";

let bucketName = ''

const S3Class = class {
  headBucket(options) {
    bucketName = options.Bucket
    return { promise: () => Promise.resolve() }
  }
  upload(options) {
    return {
      promise: async () => {
        if (options.Bucket != bucketName) {
          throw new Error(`Unexpected bucket name: ${options.Bucket}. Expected ${bucketName}`)
        }
        const buffer = await readStream(options.Body)
        const etag = createHash('md5').update(buffer).digest('hex')
        s3DataMap.push({ data: buffer.toString(), key: options.Key, etag: etag })
        return {
          ETag: etag
        }
      }
    }
  }
  headObject(options) {
    return {
      promise: () => {
        return Promise.resolve().then(() => {
          if (!s3DataMap.find((d) => d.key === options.Key)) {
            const err: any = new Error()
            err.statusCode = 404
            throw err
          }
        })
      }
    }
  }
  deleteObject(options) {
    return {
      promise: () => {
        return Promise.resolve().then(() => {
          const newDataMap = s3DataMap.filter((d) => d.key !== options.Key)
          s3DataMap.length = 0
          s3DataMap.push(...newDataMap)
        })
      }
    }
  }
  listObjectsV2(options) {
    return {
      promise: async () => {
        const contents = s3DataMap
          .filter((entry) => {
            return (entry.key.slice(0, options.Prefix.length) === options.Prefix)
          })
          .map((entry) => {
            return { Key: entry.key }
          })
        return { Contents: contents, IsTruncated: false }
      }
    }
  }
  listObjects(options) {
    return {
      promise: async () => {
        const contents = s3DataMap
          .filter((entry) => {
            return (entry.key.slice(0, options.Prefix.length) === options.Prefix)
          })
          .map((entry) => {
            return { Key: entry.key, ETag: entry.etag }
          })
        return { Contents: contents, IsTruncated: false }
      }
    }
  }
}

export default S3Class
