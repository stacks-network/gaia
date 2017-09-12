// step 1: validate the write
//         writes require a signature of
// step 2: perform write, return address

var app = require('./server/server.js')

app.listen(3000, function(){
  console.log("express-winston demo listening on port %d in %s mode", this.address().port, app.settings.env);
});
