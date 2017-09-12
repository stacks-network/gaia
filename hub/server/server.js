var express = require('express');
var expressWinston = require('express-winston');
var winston = require('winston'); // for transports.Console
var bodyParser = require('body-parser'); // for transports.Console
var StorageRequest = require('./StorageRequest.js')
var app = express();

app.use(bodyParser.json());

app.use(expressWinston.logger({
  transports: [
    new winston.transports.Console({
      json: true,
      colorize: true
    })
  ]
}));

app.get('/', function(req, res, next) {
  res.write('Hello Blockstack');
  res.end();
});

module.exports = app;
