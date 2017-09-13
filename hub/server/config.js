var secrets = require('./secrets')

config = {}

config.servername = "storage.blockstack.org"

config.driver = "aws"

Object.assign(config, secrets)

module.exports = config
