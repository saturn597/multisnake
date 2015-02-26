var gameModule = require('./game.js');

if (typeof module !== 'undefined' && module.exports)
  module.exports.GameOverseer = GameOverseer;

function Connection(sock, player) {
  // associate a socket with a player's status in the game

  // basic info
  this.sock = sock;
  this.player = player;

  // for convenience
  this.id = player.id;

  this.send = function(msg) {
    this.sock.send(msg, function(e) { 
      if (e) { 
        console.log("ERROR: ran into problem sending message");
        console.log("The error was this: " + e); 
      }
    });
  }

  this.close = function() {
    this.sock.close();
  }

  // whether we're waiting on this connection to give us information
  this.waiting = false;  

  this.getPlayerData = function() {
    return { pieces: this.player.pieces, id: this.player.id, direction: this.player.direction };
  }

}


function GameOverseer(sockets) {
  var theOverseer = this;  // us
    
  // set up our game
  var game = new gameModule.Game(5, 800, 600);

  game.onKill = function() {
    if (game.countLiving() <= 1) {
      clearTimeout(timer);
      time = false;
      gameInProgress = false;
    }
  }

  // some useful constants
  var initStates = [{x: 0, y: 0, d: game.DIRECTIONS.RIGHT}, {x: 400, y: 295, d: game.DIRECTIONS.LEFT},
      {x: 200, y: 295, d: game.DIRECTIONS.UP}];  // snakes added to the game will be placed in these initial states

  // and some state to keep track of
  var connections = [];
  var timer;  // timer for the delay between frames
  var gameInProgress = true,
      time = false;  // whether enough time has passed since the last frame to go to the next one

  function endGame() {
  }

  function timesUp() {
    time = true;
    tickIfReady();
  }


  function tickIfReady() {
    // Advance the state of the game by one frame and notify our clients ONLY IF
    //
    // 1) we've received updated states from ALL clients (so we know whether players have changed direction) 
    // 2) sufficient time has passed since the last update

  
    for (var i = connections.length - 1; i >= 0; i--) {
      if (connections[i].waiting) 
        return;
    }
  
    if (!time)
      return;

    updateClients();  // currently updateClients must be done before game.tick
    game.tick();      // since collisions during game.tick can remove clients

    if (!gameInProgress) return;  // calling game.tick() might have ended the game

    // if the game didn't end, restart the timer
    time = false;
    timer = setTimeout(timesUp, 50);
  }


  function updateClients() {
    var direction;
    var updates = connections.map(function(connection) { return [ connection.id, connection.player.direction ] } );
    for (var i = connections.length - 1; i >= 0; i--) {
      connections[i].send(JSON.stringify( {updates: updates, tick: true} ));
      connections[i].waiting = true;
    }
  }


  function tellAllClients(msg) {
    for (var i = connections.length - 1; i >= 0; i--) {
      connections[i].send(msg);
    }
  }


  function addPlayer() {
    // Adds a new player to our game

    var newIndex = connections.length,
        newState = initStates[newIndex % initStates.length];

    return game.addPlayer([{ x: newState.x, y: newState.y }], newState.d, newIndex);
  }  

  function setConnectionListeners(connection) {
    // sets the right listeners on the socket

    // setting onmessage and onclose rather than just adding an event listener for now, since
    // I don't think I'll need to listen to other events while a game is going on
    
    connection.sock.onmessage = function(message) {
      // we expect either an integer representing the player's direction for the next frame, or a 
      // request to leave the game
      
      if (message.data === "leave") {
        connections.splice(connections.indexOf(connection), 1);
        kill(connection); 
        theOverseer.onLeftGame(connection.sock);
        tickIfReady();
        return;
      }
     
      // make sure the string we represents an integer in the format we expect
      // if not, kill this connection
      if (!/^\d+$/.test(message.data)) {
        console.log("ERROR: Received a message we didn't understand during a game");
        console.log("This was the message: " + message.data);
        this.onmessage = function() {}; 
        kill(connection);
        connection.close();
      }

      // now get that integer and set the player's direction accordingly
      connection.player.setDirection(parseInt(message.data, 10));
      connection.waiting = false;

      // We might be ready to advance a frame, if we've now received status updates from every player
      tickIfReady();
    };

    connection.sock.onclose = function() {
      connections.splice(connections.indexOf(connection), 1);
      kill(connection);
      // We might be ready to advance a frame, if we were waiting only on the client that just disconnected
      tickIfReady();
    };
  } 

  function kill(connection) {

    game.kill(connection.player);

    tellAllClients(JSON.stringify({ "kill": [connection.id] }));

    if (game.countLiving() <= 1 && gameInProgress) endGame();

  }

  this.onLeftGame = function(socket) {
     
  }

  // create our Connection objects
  for (var socketNum = sockets.length - 1; socketNum >= 0; socketNum--) {
    var connection = new Connection(sockets[socketNum], addPlayer());
    setConnectionListeners(connection);
    connections.push(connection);
  }

  // tell clients about each other
  for (var i = connections.length - 1; i >= 0; i--) {
    var data = connections.map(function(connection) { return connection.getPlayerData(); });
    tellAllClients(JSON.stringify({ "newPlayers": data }));
  }

  // tell clients their own identity - clients must get this after they know their own initial state
  // TODO: remove that requirement
  for (var i = connections.length - 1; i >= 0; i--) {
    connections[i].send(JSON.stringify({ "yourIndex": connections[i].id }));
  }

  gameInProgress = true;
  timer = setTimeout(timesUp, 50);

}
