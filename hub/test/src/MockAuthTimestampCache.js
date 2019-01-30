/* @flow */

import { AuthTimestampCache } from '../../src/server/revocations'

export class MockAuthTimestampCache extends AuthTimestampCache {
  constructor() {
    super('none', (null: any), 1)
  }
  async getAuthTimestamp(bucketAddress: string): Promise<number> {
    return Promise.resolve(0)
  }
}
