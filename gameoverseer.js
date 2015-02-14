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
  var initStates = [{x: 0, y: 0, d: game.DIRECTIONS.RIGHT}, {x: 800, y: 595, d: game.DIRECTIONS.LEFT}],
    minPlayers = 2,
    maxPlayers = 2;

  // and some state to keep track of
  var connections = [];
  var timer;  // timer for the delay between frames
  var gameInProcess = true,
      time = false;  // whether enough time has passed since the last frame to go to the next one


  function handleCollision() {
    gameInProcess = false;  // game ends on collision
    init();
  }


  function init() {
    clearTimeout(timer);
    for (var i = connections.length - 1; i >= 0; i--)
      connections[i].sock.close();
    time = false;
    timer = void(0);
    game.initialize();
  }


  function timesUp() {
    time = true;
    tickIfReady();
  }


  function tickIfReady() {
    // Advance the state of the game by one frame and notify our clients ONLY IF
    //
    // 1) we have sufficient players, 
    // 2) we've received updated states from ALL clients (so we know whether players have changed direction) 
    // 3) sufficient time has passed since the last update

    if (connections.length < minPlayers)
      return;
  
    for (var i = connections.length - 1; i >= 0; i--) {
      if (connections[i].waiting) 
        return;
    }
  
    if (!time)
      return;

    game.tick();
    updateClients();

    if (!gameInProcess) return;  // calling game.tick() might have ended the game

    // restart the timer
    time = false;
    timer = setTimeout(timesUp, 50);
  }


  function updateClients() {
    var direction;
    var updates = [];
    for (var i = 0, len = connections.length; i < connections.length; i++) {
      updates.push(connections[i].player.direction);
    }
    for (var i = connections.length - 1; i >= 0; i--) {
      connections[i].send(JSON.stringify({updates: updates, tick: true}), function(e) {});
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
    var player = game.players[index];
    return { pieces: player.pieces, index: index, direction: player.direction };
  }
  
  function initializeConnection(ws) {

    var newPlayer = addPlayer();

    var connection = new Connection(ws, newPlayer);
    
    if (connections.length === 0) {
      gameInProcess = true;
      timer = setTimeout(timesUp, 50);
    }

    // Tell everyone about the new player and tell the new player about everyone
    for (var i = connections.length - 1; i >= 0; i--) {
      connections[i].send(JSON.stringify({ newPlayer: newPlayer }),
          function() {});
      
      ws.send(JSON.stringify({ newPlayer: getPlayerData(i) }));
    }

    // tell the new player about themselves  
    ws.send(JSON.stringify({ newPlayer: newPlayer }));
    ws.send(JSON.stringify({ yourIndex: newPlayer.index }));

    connections.push(connection);

    tickIfReady();

    ws.on('message', function(message) {
      // Messages we get from clients will tell us the direction they've most recently set their snake to move in
      connection.player.setDirection(parseInt(message, 10));
      connection.waiting = false;

      // We might be ready to advance a frame, if we've now received status updates from every player
      tickIfReady();
    });

    ws.on('close', function() {
      // If we lose the connection to someone, we need to tell everyone they are no longer in the game
      tellAllClients(JSON.stringify({"toDelete": [connections.indexOf(connection)]})); //Can probably make this not a list
      connections.splice(connections.indexOf(connection), 1); 
      game.players.splice(game.players.indexOf(connection.player), 1);
    
      if (connections.length === 0) {
        clearTimeout(timer);
        timer = void(0);
        time = false;
        game.initialize();
      }

      // We might now be ready to advance a frame, if we were waiting only on the client that just disconnected
      tickIfReady();
    });
  } 

  for (var socketNum = sockets.length - 1; socketNum >= 0; socketNum--) {
    initializeConnection(sockets[socketNum]);
  }
}


