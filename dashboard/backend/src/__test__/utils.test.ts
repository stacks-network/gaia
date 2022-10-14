import fs from 'fs'
import { patchConfigFile, readConfigFileSections, runSubprocess } from '../utils'

describe('test runSubprocess function', () => {
  it('should run file write command', () => {
    const testFilePath = '/tmp/test-command.txt'
    const command = '/bin/sh'
    const argv = ['-c', `echo "$HELLO" > ${testFilePath}`]
    const env = { HELLO: 'hello world' }

    runSubprocess(command, argv, env)
      .then(() => {
        const fileExists = fs.existsSync(testFilePath)
        expect(fileExists).toEqual(true)

        const fileContent = fs.readFileSync(testFilePath).toString()
        expect(fileContent).toEqual('hello world\n')

        fs.unlinkSync(testFilePath)
      })
      .catch(() => {
        fs.unlinkSync(testFilePath)
      })
  })
})

describe('test patchConfigFile/readConfigFileSections function', () => {
  it('should patch config file only sets top-level fields', () => {
    const config_1 = {
      a: 'b',
      c: {
        d: 'e',
        f: 'g'
      }
    }

    const config_2 = {
      c: {
        h: 'i'
      }
    }

    // config 1 + config 2
    const config_1_2 = {
      a: 'b',
      c: {
        h: 'i'
      }
    }

    const configPath = '/tmp/test-patch-config.json'
    fs.writeFileSync(configPath, '{}')

    patchConfigFile(configPath, config_1)
    const data_1 = readConfigFileSections(configPath, ['a', 'c'])

    expect(data_1).toEqual(config_1)

    patchConfigFile(configPath, config_2)
    const data_2 = readConfigFileSections(configPath, ['a', 'c'])

    expect(data_2).toEqual(config_1_2)

    fs.unlinkSync(configPath)
  })
})
