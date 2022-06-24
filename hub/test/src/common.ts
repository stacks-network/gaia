
import * as ecpair from 'ecpair'
import * as ecc from 'tiny-secp256k1';
import { ecPairToAddress } from 'blockstack'

const ECPair = ecpair.ECPairFactory(ecc);

export const testWIFs = [
  'L4kMoaVivcd1FMPPwRU9XT2PdKHPob3oo6YmgTBHrnBHMmo7GcCf',
  'L3W7EzxYNdG3kBjtQmhKEq2iiZAwpiKEwMobXdaY9xueSUFPkQeH',
  'KwzzsbVzMekdj9myzxojsgT6DQ6yRQKbWqSXQgo1YKsJcvFJhtRr',
  'KxYYiJg9mJpCDHcyYMMvSfY4SWGwMofqavxG2ZyDNcXuY7ShBknK',
  'L2mpAaeCZ32mfpYc23skt8FSAdsMU23UEqrjTMu1LDYuJCtUNcKr',
  'L5UMhqaS6BJdE3vXrRGeeo6hENDuukPKtRjy9nCSoHUiZy2CCpj3',
  'L3bZ1P8m135CiNd9LAHHUJwZkwzXBQ2iP7QJKtzfsKhk8gydjLYd',
  'L58yVu1P1GwHkV9jeuPSJYpSYoUgcHJRWzQpT1RRHQq6WX4vu6kh',
  'L4axr2vJzeb3JcsF2gRFApmBUscuEujcCCf335bnA4oTtGUKeLAc',
  'L1zYdjKVhU9yrzeptfdqsffGQ1GLp6ypdCCbBdLT2KdMDX5P2aLK']
export const testPairs: ecpair.ECPairInterface[] = testWIFs.map(x => ECPair.fromWIF(x))
export const testAddrs: string[] = testPairs.map(x => ecPairToAddress(x))

export const createTestKeys = (count: number) => {
  const testPairs: ecpair.ECPairInterface[] = [...Array(count)].map(_ => ECPair.makeRandom());
  const testAddrs: string[] = testPairs.map(x => ecPairToAddress(x));
  return { testPairs, testAddrs };
}
