import convict from 'convict'
import fs from 'fs'
import process from 'process'
import logger from 'winston'

convict.addFormat({
  // This format will accept an array, convert a comma
  // delimited string to an acceptable array, or convert
  // anything falsy to false.
  name: 'stringArrayOrFalse',
  validate: function(val) {
    if (Array.isArray(val) || val === false) {
      return
    }
    else {
      throw new TypeError('must evaluate to false, be a comma separated list, or an Array')
    }
  },
  coerce: function(val) {
    if (!val) {
      return false
    }

    if (typeof val === 'string'){
      return val.split(',').map(item => item.trim())
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

