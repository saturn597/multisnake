// set up modules
var express = require('express');
var path = require('path');

var PORT = process.env.PORT || 3000;
var PUBLIC = path.join(__dirname, 'public');

var server = express()
    .use((express.static(PUBLIC)))
    .listen(PORT, () => console.log(`Listening on ${ PORT }`));

var WebSocket = require('ws');
var WebSocketServer = require('ws').Server, 
  wss = new WebSocketServer({ server });

var GameOverseer = require('./gameoverseer.js');

var potentialGames = [
  { name: "1 player game", targetCount: 1, waitingToPlay: [] },
  { name: "2 player game", targetCount: 2, waitingToPlay: [] }, 
  { name: "3 player game", targetCount: 3, waitingToPlay: [] }
];

var connections = [];
var recentWinners = [];

function Connection(socket) {
  // could also add info on which game we're trying to join, if any

  this.socket = socket;
  this.name = "Anon";

  this.send = function(msg) { this.socket.send(msg); };
  this.close = function() { this.socket.close(); };

  this.bail = function() {
    // stop responding to this socket's messages and close
    console.log("Bailing on socket due to an error");
    this.socket.onmessage = function() {};
    this.socket.close();
  }
}

function setSocketListeners(connection) {
  connection.socket.onmessage = getOnMessage(connection);
  connection.socket.onclose = getOnClose(connection);
  connection.socket.onerror = getOnError(connection);
}

function addConnection(socket) {
  // we have a new socket to keep track of
  var newConnection = new Connection(socket);
  connections.push(newConnection);
  sendGameInfo(socket);
  sendRecentWinners(socket);
  setSocketListeners(newConnection);
}

wss.on('connection', addConnection);

function removeConnection(connection) {
  // TODO: Note asymmetry with addConnection (connection versus socket) - can this be fixed?
  var snpindex = connections.indexOf(connection);

  if (snpindex === -1) {
    console.log("ERROR: attempted to remove connection we didn't have!");
    return;
  }

  connections.splice(snpindex, 1);
}

function gameInfoToSend(game) {
  return {
    name: game.name,
    targetCount: game.targetCount,
    waitingCount: game.waitingToPlay.length
  }
}

function sendGameInfo(sock) {
  // send socket sock a JSON string describing the games they can try to join

  sock.send(JSON.stringify(
    { "games": potentialGames.map(gameInfoToSend) } 
  ));

}

function sendRecentWinners(sock) {
  console.log("Sending recent winners");
  sock.send(JSON.stringify( { "recentWinners": recentWinners }));
}

function tellConnections(msg, connections) {  // TODO: use this instead of tellAllClients in gameoverseer too
  connections.forEach(function(connection) { connection.send(msg); });
}

function announceNewCount(gameNumber, count) {
  tellConnections(JSON.stringify({ newCount: [ gameNumber, count ] }), connections);
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

function getOnMessage(connection) {
  // return an onmessage handler for a given connection
  return function(msg) {

    if (msg.data === "cancel") {
      // client was waiting to join a game but changed their mind
      removeConnectionFromPotentialGames(connection);
      return;
    }

    if (msg.data === "ping") {
      connection.send("pong");
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
      // client wants to set their name
      // require that name be a nonempty string
      
      if (typeof(parsed.name) != "string") {
        console.log("ERROR: client sent a name that wasn't a string.");
        connection.bail();
        return;
      }

      connection.name = parsed.name.slice(0, 20);  // Prevent really long names

      // if the player left their name blank, set it to a default
      if (parsed.name == "") connection.name = "Anon";
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

console.log("ready to accept connections");
