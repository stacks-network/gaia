var express = require('express');
var expressWinston = require('express-winston');
var winston = require('winston'); // for transports.Console
var S3Driver = require('./S3Driver.js')
var StorageRequest = require('./StorageRequest.js')
var app = express();

let driver = new S3Driver()

app.use(expressWinston.logger({
  transports: [
    new winston.transports.Console({
      json: true,
      colorize: true
    })
  ]
}));

app.post('/store/:address/:filename', function(req, res, next) {
  let sr = new StorageRequest(req, res)
  // note: we need to handle CORS and OPTIONS -- does express do that for us?
  sr.handle(driver)
});

module.exports = app;
