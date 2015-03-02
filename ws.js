// set up modules
var WebSocket = require('ws');
var WebSocketServer = require('ws').Server, 
  wss = new WebSocketServer({ port: 8080 });

var GameOverseer = require('./gameoverseer.js');

var potentialGames = [
  { name: "1 player game", targetCount: 1, waitingToPlay: [] },
  { name: "2 player game", targetCount: 2, waitingToPlay: [] }, 
  { name: "3 player game", targetCount: 3, waitingToPlay: [] }
];

function SocketData(socket) {
  // could also add info on which game we're trying to join, if any
  this.socket = socket;
  this.name = "";
}

var socketData = [];  // data associated with each socket that's not yet playing a game
var socketsNotPlaying = [];  // socketsNotPlaying and socketData can probably be merged

function addSocket(socket) {
  // we just got a new socket that isn't yet playing a game
  sendGameInfo(socket);
  socketsNotPlaying.push(socket);
  addSocketData(socket);
  setSocketListeners(socket);
}

wss.on('connection', addSocket);

function removeSocket(socket) {
  var snpindex = socketsNotPlaying.indexOf(socket);

  if (snpindex === -1) {
    console.log("ERROR: attempted to remove socket we didn't have?");
    return;
  }

  removeSocketData(socket);
  socketsNotPlaying.splice(socketsNotPlaying.indexOf(socket), 1);
}

function getSocketIndex(socket) {
  // get the index of the socket in the socketData array
  for (var i = socketData.length - 1; i >= 0; i--) {
    if (socketData[i].socket == socket) return i;
  }
}

function getSocketData(socket) {
  return socketData[getSocketIndex(socket)]; 
}

function removeSocketData(socket) {
  socketData.splice(getSocketIndex(socket), 1); 
}

function addSocketData(socket) {
  socketData.push(new SocketData(socket));
}

function setSocketName(socket, name) {
  socketData[getSocketIndex(socket)].name = name;
}

function sendGameInfo(sock) {
  // wrap up the information we want to send about the currently available games
  
  sock.send(JSON.stringify(
    { "games": potentialGames.map(gameInfoToSend) } 
  ));

}

function gameInfoToSend(game) {
  return {
    name: game.name,
    targetCount: game.targetCount,
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

  if (msg.data === "cancel") {
    // client was waiting to join a game but changed their mind
    removeSocketFromPotentialGames(this);
    return;
  }

  try {
    var parsed = JSON.parse(msg.data);
  } catch (e) {
    // we probably got invalid JSON
    console.log("ERROR: problem parsing JSON.");
    console.log("The error was this: " + e);
    console.log("This was the message we tried to parse: " + msg.data);

    bail(this);
    return;
  }
 
  if (parsed.hasOwnProperty('name')) {
    setSocketName(this, parsed.name);  
  }

  if (parsed.hasOwnProperty('join')) {
    // client should tell us which of the potential games they want to join
    console.log("join received from " + getSocketData(this).name);
 
    var gameIndex = parsed.join;  // the index of the game the socket wants to join
    var desiredGame = potentialGames[gameIndex]; // the game at that index

    removeSocketFromPotentialGames(this);  // only be in one game at a time
    desiredGame.waitingToPlay.push(this);

    if (desiredGame.waitingToPlay.length == desiredGame.targetCount) {
      // if we have enough players, actually start the game
      
      console.log("beginning game");
      tellSockets("startGame", desiredGame.waitingToPlay);
      desiredGame.waitingToPlay.forEach(function(socket) { removeSocket(socket); });
      var gameOverseer = new GameOverseer.GameOverseer(desiredGame.waitingToPlay);
      gameOverseer.onLeftGame = function (socket) {
        // if a socket is removed from the game but is still connected, set it up again so it can start a new game

        if (socket.readyState == WebSocket.OPEN) {
          addSocket(socket);
        }
      };
      desiredGame.waitingToPlay = [];
    }

    announceNewCount(gameIndex, desiredGame.waitingToPlay.length);
    return;
  }

  // shouldn't get here if the client is behaving
  console.log("ERROR: We received a message we didn't know what to do with.");
  console.log("This was the message: " + msg.data);
  bail(this);
}

function respondToClose() {
  removeSocket(this);

  // if client joined a potential game, we should remove them from that game
  removeSocketFromPotentialGames(this);
  console.log("close happened");
}

function respondToError(e) {
  console.log("ERROR: a socket error occurred");
  console.log("The error was this: " + e);
  bail(this);
}

function bail(socket) {
  // stop responding to this socket's messages and close
  console("Bailing on socket due to an error");
  this.onmessage = function() {};
  this.close();
}

function setSocketListeners(socket) {
  socket.onmessage = respondToMsg;
  socket.onclose = respondToClose;
  socket.onerror = respondToError;
}

console.log("ready to accept connections");
