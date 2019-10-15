
import { ECPair, ECPairInterface } from 'bitcoinjs-lib'
import { ecPairToAddress } from 'blockstack'

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
export const testPairs: ECPairInterface[] = testWIFs.map(x => ECPair.fromWIF(x))
export const testAddrs: string[] = [
  '16mHK3nMEhVGjSYGbzEGA37vej7HYzJ9Xn',
  '1FjG1mM47ydAe84j237QZMgcWYnwLo8tm2',
  '1M7zX421ipgC4c4GGNGZgP2bz5qdqrrtiC',
  '1FVGapeLRYoRExwVXEGmo8EskBQ6jchAuR',
  '1B1UcJsKzLWZxMiyB8KzKF9gUfpJoTLahK',
  '1PTJRDv7LwQNuem52U4G3DXPVCiN8nFJup',
  '14LB9gXpYiKuMzwMXiqax2RKcGdz6yPM1m',
  '15RnBpE6ZRYMEY3VjJZ9aJy4qBNiPMYhTo',
  '1H6ZGu79ZGURNtPuK6moXLktpb2TkvKWws',
  '1BkyNHDAa8BuLrht155uMjJzDdJovZmcTC']

export const createTestKeys = async (count: number) => {
  const testPairs: ECPairInterface[] = [...Array(count)].map(_ => ECPair.makeRandom());
  const testAddrs: string[] = await Promise.all(testPairs.map(x => ecPairToAddress(x)));
  return { testPairs, testAddrs };
}
