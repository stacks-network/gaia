/* @flow */

import LRUCache from 'lru-cache'
import { readStream } from './utils'

const MAX_AUTH_FILE_BYTES = 1024

function readAuthNumber(bucketAddress: string, driver: Object): Promise<number> {
  driver.readFile(`${bucketAddress}-auth/authNumber`)
    .then((readable, readSize) => readStream(readable, readSize))
    .then(data => {
      const dataText = data.toString()
      const authNumber = parseInt(dataText)
      return authNumber
    })
    .catch(err => {
      if (err.name === 'NoSuchFileError') {
        return 0
      } else {
        throw err
      }
    })
}

class AuthNumberCache {

  getAuthNumber(bucketAddress: string): Promise<number> {
    const authNumber = this.cache.get(bucketAddress)
    if (authNumber) {
      return Promise.resolve(authNumber)
    }
    return readAuthNumber(bucketAddress, this.driver)
      .then((authNumber) => {
        this.cache.set(bucketAddress, authNumber)
        return authNumber
      })
  }

  bumpAuthNumber(bucketAddress: string): Promise<*> {
    this.getAuthNumber(bucketAddress)
      .then((authNumber) => {
        const nextAuthNumber = authNumber + 1
        return writeAuthNumber(bucketAddress, driver)
          .then(() => this.cache.del(bucketAddress))
      })
  }
}
