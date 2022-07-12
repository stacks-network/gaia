

import { AuthTimestampCache } from '../../src/server/revocations.js'

export class MockAuthTimestampCache extends AuthTimestampCache {
  constructor() {
    super('none', null, 1)
  }
  async getAuthTimestamp(bucketAddress: string): Promise<number> {
    return Promise.resolve(0)
  }
}
