//@ts-ignore
import testPromise from 'tape-promise/tape'
import testOrig from 'tape'

interface TestObj { 
  rejects(...args: any[]): Promise<any>
}
interface TestCb { (t: testOrig.Test & TestObj): Promise<any> }
interface TestPromise { (name: string, cb: TestCb): any }

interface TestRegular { (name: string, cb: testOrig.TestCase): void; }

export const test: TestPromise & TestRegular = testPromise
