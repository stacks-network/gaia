var express = require('express');
var expressWinston = require('express-winston');
var winston = require('winston'); // for transports.Console
var S3Driver = require('./S3Driver.js')
var StorageRequest = require('./StorageRequest.js')
var app = express()

var config = require('./config')

let driver = false
if (config.driver === "aws"){
  driver = S3Driver(config.awsCredentials)
}

app.use(expressWinston.logger({
  transports: [
    new winston.transports.Console({
      json: true,
      colorize: true
    })
  ]
}))

app.post('/store/:address/:filename', function(req, res, next) {
  let sr = new StorageRequest(req, res)
  // note: we need to handle CORS and OPTIONS -- does express do that for us?
  sr.handle(driver)
})

module.exports = app
