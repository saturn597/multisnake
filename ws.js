// set up modules
var WebSocket = require('ws');
var WebSocketServer = require('ws').Server, 
  wss = new WebSocketServer({port: 8080});

var GameOverseer = require('./gameoverseer.js');

var potentialGames = [ { targetPlayerCount: 3, waitingToPlay: [] } ];

var socketsNotPlaying = [];
var targetPlayerCount = 3;

wss.on('connection', function(ws) {

  socketsNotPlaying.push(ws);
  setSocketListeners(ws); 

});

function respondToMsg(msg) {
  // client should tell us which of the potential games they want to join 
  var parsed = JSON.parse(msg.data);
  if (parsed.hasOwnProperty('join')) {
    console.log("join received");
    var desiredGame = potentialGames[parsed.join];
    desiredGame.waitingToPlay.push(this);
    if (desiredGame.waitingToPlay.length == desiredGame.targetPlayerCount) {
      var gameOverseer = new GameOverseer.GameOverseer(desiredGame.waitingToPlay);

      gameOverseer.onRemoveFromGame = function (socket) {
        console.log("calling onRemoveFromGame");
        // if a socket that's still connected gets removed from the game,
        // we'll want to set its socket listeners again so they can start
        // a new game
        if (socket.readyState == WebSocket.OPEN) setSocketListeners(socket);
      };

      desiredGame.waitingToPlay = [];
    }
  }
}

function respondToClose() {
  socketsNotPlaying.splice(socketsNotPlaying.indexOf(this), 1);
}

function setSocketListeners(socket) {
  socket.onmessage = respondToMsg;
  socket.onclose = respondToClose;
}

console.log("ready to accept connections");
