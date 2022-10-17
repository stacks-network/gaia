import fs from 'fs'
import { getConfig } from '../config'

describe('test getConfig function', () => {
  it('should read configuration from conf file', () => {
    const config = {
      port: 5555,
      hubSettings: {
        configPath: '/tmp/test-hub-config.json'
      },
      adminSettings: {
        configPath: '/tmp/test-admin-config.json'
      },
      readerSettings: {
        configPath: '/tmp/test-reader-config.json'
      }
    }

    const configPath = '/tmp/test-config.json'
    fs.writeFileSync(configPath, JSON.stringify(config))

    process.env.CONFIG_PATH = configPath
    const newConfig = getConfig()

    expect(config.port).toEqual(newConfig.port)
    expect(config.hubSettings.configPath).toEqual(newConfig.hubSettings.configPath)
    expect(config.adminSettings.configPath).toEqual(newConfig.adminSettings.configPath)
    expect(config.readerSettings.configPath).toEqual(newConfig.readerSettings.configPath)
  
    fs.unlinkSync(configPath)
  })

  it('should read default configuration for invalid conf file', () => {
    const invalidConfig = '{\n\tport: 5555'

    const invalidConfigPath = '/tmp/invalid-test-config.json'
    fs.writeFileSync(invalidConfigPath, invalidConfig)

    process.env.CONFIG_PATH = invalidConfigPath
    const newConfig = getConfig()

    const defaultPort = 5000
    const defaultHubConfigPath = '/tmp/hub-config.json'
    const defaultAdminConfigPath = '/tmp/admin-config.json'
    const defaultReaderConfigPath = '/tmp/reader-config.json'

    expect(newConfig.port).toEqual(defaultPort)
    expect(newConfig.hubSettings.configPath).toEqual(defaultHubConfigPath)
    expect(newConfig.adminSettings.configPath).toEqual(defaultAdminConfigPath)
    expect(newConfig.readerSettings.configPath).toEqual(defaultReaderConfigPath)

    fs.unlinkSync(invalidConfigPath)
  })
})
