// set up modules
var WebSocketServer = require('ws').Server, 
  wss = new WebSocketServer({port: 8080});

var GameOverseer = require('./gameoverseer.js');

var socketsNotPlaying = [];
var targetPlayerCount = 2;

wss.on('connection', function(ws) {
  // Callback for someone connecting to our server
  socketsNotPlaying.push(ws);
  if (socketsNotPlaying.length === targetPlayerCount) {
    new GameOverseer.GameOverseer(socketsNotPlaying);
    socketsNotPlaying = [];
  }
});

console.log("ready");
