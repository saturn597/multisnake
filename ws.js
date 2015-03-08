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

var recentWinners = [];

function Connection(socket) {
  // could also add info on which game we're trying to join, if any

  this.socket = socket;
  this.name = "";

  this.send = function(msg) { this.socket.send(msg); };
  this.close = function() { this.socket.close(); };

  this.bail = function() {
    // stop responding to this socket's messages and close
    console.log("Bailing on socket due to an error");
    this.socket.onmessage = function() {};
    this.socket.close();
  }
}

var connectionData = [];  // data associated with each socket that's not yet playing a game

function addConnection(socket) {
  // we have a new socket to keep track of
  var newConnection = new Connection(socket);
  connectionData.push(newConnection);
  sendGameInfo(socket);
  sendRecentWinners(socket);
  setSocketListeners(newConnection);
}

wss.on('connection', addConnection);

function removeConnection(connection) {
  // TODO: Note asymmetry with addConnection - can this be fixed?
  var snpindex = connectionData.indexOf(connection);

  if (snpindex === -1) {
    console.log("ERROR: attempted to remove connection we didn't have!");
    return;
  }

  connectionData.splice(snpindex, 1);
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

function sendRecentWinners(sock) {
  console.log("Sending recent winners");
  sock.send(JSON.stringify( { "recentWinners": recentWinners }));
}

function removeConnectionFromPotentialGames(connection) {
  for (var i = potentialGames.length - 1; i >= 0; i--) {
    var index = potentialGames[i].waitingToPlay.indexOf(connection);
    if (index > -1) { 
      potentialGames[i].waitingToPlay.splice(index, 1);
      announceNewCount(i, potentialGames[i].waitingToPlay.length);  // tell everyone if we're removing someone
    }
  }
}

function announceNewCount(gameNumber, count) {
  tellConnections(JSON.stringify({ newCount: [ gameNumber, count ] }), connectionData);
}

function tellConnections(msg, connections) {  // use this instead of tellAllClients in gameoverseer too
  connections.forEach(function(connection) { connection.send(msg); });
}

function getOnMessage(connection) {
  // return an onmessage handler for a given connection
  return function(msg) {

    if (msg.data === "cancel") {
      // client was waiting to join a game but changed their mind
      removeConnectionFromPotentialGames(connection);
      return;
    }

    try {
      var parsed = JSON.parse(msg.data);
    } catch (e) {
      // we probably got invalid JSON
      console.log("ERROR: problem parsing JSON.");
      console.log("The error was this: " + e);
      console.log("This was the message we tried to parse: " + msg.data);

      connection.bail();
      return;
    }
   
    if (parsed.hasOwnProperty('name')) {
      connection.name = parsed.name;  
    }

    if (parsed.hasOwnProperty('join')) {
      // client should tell us which of the potential games they want to join
      console.log("join received from " + connection.name);
   
      var gameIndex = parsed.join;  // the index of the game the player wants to join
      var desiredGame = potentialGames[gameIndex]; // the game at that index

      removeConnectionFromPotentialGames(connection);  // only wait for one game at a time
      desiredGame.waitingToPlay.push(connection);

      if (desiredGame.waitingToPlay.length == desiredGame.targetCount) {
        // if we have enough players, actually start the game
        
        console.log("beginning game");
        tellConnections("startGame", desiredGame.waitingToPlay);
        desiredGame.waitingToPlay.forEach(function(connection) { removeConnection(connection); });
        var gameOverseer = new GameOverseer.GameOverseer(desiredGame.waitingToPlay);
        gameOverseer.onLeftGame = function (socket) {
          // if a socket left the game but is still connected, set it up again so it can start a new game

          if (socket.readyState == WebSocket.OPEN) {
            addConnection(socket);
          }
        };

        gameOverseer.onVictory = function(winner) {
          recentWinners.push(winner.name);
          if (recentWinners.length > 10) {
            recentWinners.shift();
          } 
          console.log(winner.name + " WON!");
        }
        desiredGame.waitingToPlay = [];
      }

      announceNewCount(gameIndex, desiredGame.waitingToPlay.length);
      return;
    }

    // shouldn't get here if the client is behaving
    console.log("ERROR: We received a message we didn't know what to do with.");
    console.log("This was the message: " + msg.data);
    connection.bail();
  }
}

function getOnClose(connection) {
  return function() {
    removeConnection(connection);

    // if client joined a potential game, we should remove them from that game
    removeConnectionFromPotentialGames(connection);
    console.log("close happened");
  }
}

function getOnError(connection) {
  return function(e) {
    console.log("ERROR: a socket error occurred");
    console.log("The error was this: " + e);
    connection.bail();
  }
}

function setSocketListeners(connection) {
  connection.socket.onmessage = getOnMessage(connection);
  connection.socket.onclose = getOnClose(connection);
  connection.socket.onerror = getOnError(connection);
}

console.log("ready to accept connections");
