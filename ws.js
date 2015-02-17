// set up modules
var WebSocketServer = require('ws').Server, 
  wss = new WebSocketServer({port: 8080});

var GameOverseer = require('./gameoverseer.js');

var socketsNotPlaying = [];
var targetPlayerCount = 3;

wss.on('connection', function(ws) {
  socketsNotPlaying.push(ws);
  if (socketsNotPlaying.length === targetPlayerCount) {
    new GameOverseer.GameOverseer(socketsNotPlaying);
    socketsNotPlaying = [];
  }

  ws.on('close', function() {
    socketsNotPlaying.splice(socketsNotPlaying.indexOf(ws), 1);
  });
});

console.log("ready to accept connections");
