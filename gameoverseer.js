var gameModule = require('./game.js');

if (typeof module !== 'undefined' && module.exports)
  module.exports.GameOverseer = GameOverseer;

function Connection(sock, player) {
  // associate a socket with a player's status in the game

  // basic info
  this.sock = sock;
  this.player = player;

  // for convenience
  this.index = player.index;
  this.send = function(msg, callback) {
    this.sock.send(msg, callback);
  }
  this.close = function() {
    this.sock.close();
  }

  // whether we're waiting on this connection to give us information
  this.waiting = false;  

}


function GameOverseer(sockets) {
  
  // set up our game
  var game = new gameModule.Game(5, 800, 600);
  game.onCollision = handleCollision;

  // some useful constants
  var initStates = [{x: 0, y: 0, d: game.DIRECTIONS.RIGHT}, {x: 400, y: 295, d: game.DIRECTIONS.LEFT},
      {x: 200, y: 295, d: game.DIRECTIONS.UP}];  // snakes added to the game will be placed in these initial states

  // and some state to keep track of
  var connections = [];
  var timer;  // timer for the delay between frames
  var gameInProgress = true,
      time = false;  // whether enough time has passed since the last frame to go to the next one


  function handleCollision(collisions) {
    console.log("handle collisions");

    for (var i = collisions.length - 1; i >= 0; i--) {
      //removeFromGame(connections[game.players.indexOf(collisions[i].collider)]);
    }
    if (game.countLiving() <= 1) endGame();

  }

  
  function endGame() {
    gameInProgress = false;
    clearTimeout(timer);
    time = false;
    console.log("in end game");
    for (var i = connections.length - 1; i >= 0; i--)
      removeFromGame(connections[i]);
    game.initialize();
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
    var updates = connections.map(function(connection) { return [ connection.index, connection.player.direction ] } );
    for (var i = connections.length - 1; i >= 0; i--) {
      connections[i].send(JSON.stringify( {updates: updates, tick: true} ), function(e) {});
      connections[i].waiting = true;
    }
  }


  function tellAllClients(msg) {
    for (var i = connections.length - 1; i >= 0; i--) {
      connections[i].send(msg, function(e) {});
    }
  }


  function addPlayer() {
    // Adds a new player to our game

    var newIndex = connections.length,
        newState = initStates[newIndex % initStates.length];

    return game.addPlayer([{ x: newState.x, y: newState.y }], newState.d, newIndex);
  }


  function getPlayerData(index) {
    var player = connections[index].player;
    return { pieces: player.pieces, index: index, direction: player.direction };
  }
  

  function setConnectionListeners(connection) {
    // sets the right listeners on the socket

    // setting onmessage and onclose rather than just adding an event listener for now, since
    // I don't think I'll need to listen to other events while a game is going on
    
    connection.sock.onmessage = function(message) {
      // Messages we get from clients will tell us the direction they've most recently set their snake to move in
      connection.player.setDirection(parseInt(message.data, 10));
      connection.waiting = false;

      // We might be ready to advance a frame, if we've now received status updates from every player
      tickIfReady();
    };

    connection.sock.onclose = function() {
      removeFromGame(connection);
    };
  } 

  var _this = this;  // do something better about this
  function removeFromGame(connection) {
    var index = connections.indexOf(connection);  
    console.log(index);
    if (index > -1) {  // do I need this check?

      connections.splice(connections.indexOf(connection), 1);
      game.getPlayer(connection.index).kill();

      if (connections.length === 0) {
        clearTimeout(timer);
        gameInProgress = false;
      }

      // If we lose the connection to someone, we need to tell everyone they are no longer in the game -
      // but don't bother if the game is over anyway
      if (gameInProgress) tellAllClients(JSON.stringify({ "kill": [index] }));


      _this.onRemoveFromGame(connection.sock);

      // We might be ready to advance a frame, if we were waiting only on the client that just disconnected
      tickIfReady();
    }  
  }

  this.onRemoveFromGame = function(socket) {
     
  }

  // create our Connection objects
  for (var socketNum = sockets.length - 1; socketNum >= 0; socketNum--) {
    var connection = new Connection(sockets[socketNum], addPlayer());
    setConnectionListeners(connection);
    connections.push(connection);
  }

  // tell clients about each other
  for (var i = connections.length - 1; i >= 0; i--) {
    var playerData = getPlayerData(i);
    tellAllClients(JSON.stringify({ "newPlayer": playerData }));
  }

  // tell clients their own identity - clients must get this after they know their own initial state
  // TODO: remove that requirement
  for (var i = connections.length - 1; i >= 0; i--) {
    connections[i].send(JSON.stringify({ "yourIndex": connections[i].index }));
  }

  gameInProgress = true;
  timer = setTimeout(timesUp, 50);

}
