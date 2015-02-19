// set up modules
var WebSocket = require('ws');
var WebSocketServer = require('ws').Server, 
  wss = new WebSocketServer({port: 8080});

var GameOverseer = require('./gameoverseer.js');

var potentialGames = [ 
{ name: "2 players!", targetPlayerCount: 2, waitingToPlay: [] }, 
{ name: "3 players!", targetPlayerCount: 3, waitingToPlay: [] },
{ name: "4 players!", targetPlayerCount: 4, waitingToPlay: [] }
];

var socketsNotPlaying = [];
var targetPlayerCount = 3;

wss.on('connection', function(ws) {

  sendGameInfo(ws);
  socketsNotPlaying.push(ws);
  setSocketListeners(ws); 

});

function sendGameInfo(sock) {

  // wrap up the information we want to send about the currently available games
  var toSend = JSON.stringify({ "games": potentialGames.map(function(item) { 
    // this is confusing, make it more comprehensible
    return {
      name: item.name, 
      targetPlayerCount: item.targetPlayerCount, 
      waitingCount: item.waitingToPlay.length 
    }
  }
  )});

  sock.send(toSend);

}

function respondToMsg(msg) {
  // client should tell us which of the potential games they want to join 
  var parsed = JSON.parse(msg.data);
  if (parsed.hasOwnProperty('join')) {
    console.log("join received");
    var desiredGame = potentialGames[parsed.join];
    desiredGame.waitingToPlay.push(this);
    if (desiredGame.waitingToPlay.length == desiredGame.targetPlayerCount) {
      console.log("beginning game");
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

  // if client has requested to join a game, we should remove them from that game
  for (var i = potentialGames.length - 1; i >= 0; i--) {
    var index = potentialGames[i].waitingToPlay.indexOf(this);
    if (index > -1) { 
      potentialGames[i].waitingToPlay.splice(index, 1);
    }
  }

}

function setSocketListeners(socket) {
  socket.onmessage = respondToMsg;
  socket.onclose = respondToClose;
}

console.log("ready to accept connections");
