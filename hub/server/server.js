var express = require('express');
var expressWinston = require('express-winston');
var winston = require('winston'); // for transports.Console
var S3Driver = require('./S3Driver.js')
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

app.get('/:address/:filename', function(req, res, next) {
  driver.handleStorageRequest(req,res)
});

module.exports = app;
