// set up modules
var WebSocket = require('ws');
var WebSocketServer = require('ws').Server, 
  wss = new WebSocketServer({port: 8080});

var GameOverseer = require('./gameoverseer.js');

var potentialGames = [ 
  { name: "2 players!", targetPlayerCount: 2, waitingToPlay: [] }, 
  { name: "3 players!", targetPlayerCount: 3, waitingToPlay: [] }
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
  
  sock.send(JSON.stringify(
    { "games": potentialGames.map(gameInfoToSend) } 
  ));

}

function gameInfoToSend(game) {
  return {
    name: game.name,
    targetPlayerCount: game.targetPlayerCount,
    waitingCount: game.waitingToPlay.length
  }
}

function removeSocketFromPotentialGames(socket) {
  for (var i = potentialGames.length - 1; i >= 0; i--) {
    var index = potentialGames[i].waitingToPlay.indexOf(socket);
    if (index > -1) { 
      potentialGames[i].waitingToPlay.splice(index, 1);
      announceNewCount(i, potentialGames[i].waitingToPlay.length);  // tell everyone if we're removing someone
    }
  }
}

function announceNewCount(gameNumber, count) {
  tellSockets(JSON.stringify({ newCount: [ gameNumber, count ] }), socketsNotPlaying);
}

function tellSockets(msg, sockets) {  // use this instead of tellAllClients in gameoverseer too
  sockets.forEach(function(socket) { socket.send(msg); });
}

function respondToMsg(msg) {
  // client should tell us which of the potential games they want to join 
  var parsed = JSON.parse(msg.data);
  if (parsed.hasOwnProperty('join')) {
    console.log("join received");
    
    var gameIndex = parsed.join;  // the index of the game the socket wants to join
    var desiredGame = potentialGames[gameIndex]; // the game at that index

    removeSocketFromPotentialGames(this);  // only be in one game at a time
    desiredGame.waitingToPlay.push(this);

    announceNewCount(gameIndex, desiredGame.waitingToPlay.length);

    if (desiredGame.waitingToPlay.length == desiredGame.targetPlayerCount) {
      // if we have enough players, actually start the game
      console.log("beginning game");
      tellSockets("startGame", desiredGame.waitingToPlay);
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

  // if client joined a potential game, we should remove them from that game
  removeSocketFromPotentialGames(this);
}

function setSocketListeners(socket) {
  socket.onmessage = respondToMsg;
  socket.onclose = respondToClose;
}

console.log("ready to accept connections");
