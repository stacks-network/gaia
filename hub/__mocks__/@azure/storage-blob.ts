import {createHash} from "crypto";
import {getPagedAsyncIterator} from "@azure/core-paging";
import {
  BlobGetPropertiesHeaders,
  BlobProperties,
  StorageSharedKeyCredential,
  newPipeline,
  BlockBlobUploadStreamOptions,
  BlobItem
} from '../../node_modules/@azure/storage-blob'
import {readStream} from "../../src/server/utils";
import {azDataMap} from "../../test/src/testDrivers/global";


export class ContainerClient {
  create = () => null
  getBlockBlobClient = (blobName) => new BlockBlobClient(blobName)
  listBlobsFlat = ({ prefix }) => {
    const items = azDataMap
      .filter(x => x.key.startsWith(prefix))
      .map(x => { return {
        name: x.key,
        properties: {
          lastModified: new Date(),
          etag: x.etag,
          contentLength: x.data.length,
          contentType: "?"
        }
      }})

    return getPagedAsyncIterator({
      firstPageLink: "0",
      getPage: (pageLink, maxPageSize) => {
        return new Promise<{page, nextPageLink}>((resolve => {
          const start = Number(pageLink)
          const end = start + maxPageSize
          const blobItems = end ? items.slice(start, end) : items.slice(start)
          const page = {
            segment: {
              blobItems: blobItems
            },
            continuationToken: end
          }
          resolve({ page: page, nextPageLink: String(end) })
        }))
      }
    })
  }
}

export class BlockBlobClient {
  blobName: string

  constructor(blobName) {
    this.blobName = blobName
  }
  uploadStream = async (stream, bufferSize, maxBuffers, options) => {
    const buffer = await readStream(stream)
    const etag = createHash('md5').update(buffer).digest('hex')
    azDataMap.push({data: buffer.toString(), key: this.blobName, etag: etag })
    return { etag: etag }
  }
  delete = () => {
    return Promise.resolve().then(() => {
      const newDataMap = azDataMap.filter((d) => d.key !== this.blobName)
      if (newDataMap.length === azDataMap.length) {
        const err: any = new Error()
        err.statusCode = 404
        throw err
      }
      azDataMap.length = 0
      azDataMap.push(...newDataMap)
    })
  }
}

export class BlobServiceClient {
  getContainerClient = () => new ContainerClient()
}

export {
  BlobGetPropertiesHeaders,
  BlobProperties,
  StorageSharedKeyCredential,
  newPipeline,
  BlockBlobUploadStreamOptions,
  BlobItem
}
