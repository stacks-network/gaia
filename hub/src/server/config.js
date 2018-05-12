import convict from 'convict'
import fs from 'fs'
import process from 'process'
import logger from 'winston'

convict.addFormat({
  // This format will convert a comma separated string
  // to an array so it can be set via ENV variable
  name: 'arrayOrFalse',
  validate: function(val) {
    // An array is acceptable
    if (typeof val === 'object' && Array.isArray(val)) {
      return
    }

    // false is also acceptable, everything else should throw an error
    if (val !== false) {
      throw new TypeError('must evaluate to false, be a comma separated list, or an Array')
    }
  },
  coerce: function(val) {
    if (val) {
      if (typeof val == 'string'){
        return val.replace(/\s/g, '').split(',')
      }
    }
    else {
      return false
    }
  }
})

export function getConfig() {
  const config = convict('./convict-config.json')

  const configPath = process.env.CONFIG_PATH || process.argv[2] || './config.json'

  if (fs.existsSync(configPath)) {
    config.loadFile(configPath)
  }

  config.validate({allowed: 'strict'})

  const configProperties = config.getProperties()

  logger.configure({ transports: [
    new logger.transports.Console(configProperties.argsTransport) ] })

  return configProperties
}

