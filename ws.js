// set up modules
var WebSocketServer = require('ws').Server, 
  wss = new WebSocketServer({port: 8080});

var gameModule = require('./game.js'),
  game = new gameModule.Game(5, 800, 600);

// some useful "constants"
var initStates = [{x: 0, y: 0, d: game.DIRECTIONS.RIGHT}, {x: 800, y: 595, d: game.DIRECTIONS.LEFT}],
  minPlayers = 2,
  maxPlayers = 2;

// and some state to keep track of
var connections = [];
var timer;
var gameInProcess = true,
  time = false;

function handleCollision() {
  gameInProcess = false;  // game ends on collision
  init();
}

game.onCollision = handleCollision;


function init() {
  console.log("init called");
  clearTimeout(timer);
  for (var i = connections.length - 1; i >= 0; i--)
    connections[i].sock.close();
  time = false;
  timer = void(0);
  game.initialize();
}


function getPlayerData(index) {
  var player = game.players[index];
  return {pieces: player.pieces, index: index, direction: player.direction};
}


function addPlayer() {
  var newIndex = connections.length,
      newState = initStates[newIndex % initStates.length];

  return game.addPlayer([{ x: newState.x, y: newState.y }], newState.d, newIndex);
}


function startGame(sockets) {
  for (var i = sockets.length - 1; i >= 0; i--) {
    ws = sockets[i]; 

  } 
}

wss.on('connection', function(ws) {
  // Callback for someone connecting to our server

  if (connections.length >= maxPlayers)
    return;

  var newPlayer = addPlayer();

  var connection = {sock: ws, index: newPlayer.index, player: newPlayer, replied: true};
  
  if (connections.length === 0) {
    gameInProcess = true;
    console.log("game over now false");
    timer = setTimeout(timesUp, 50);
  }

  // Tell everyone about the new player and tell the new player about everyone
  for (var i = connections.length - 1; i >= 0; i--) {
    connections[i].sock.send(JSON.stringify({ newPlayer: newPlayer }),
        function() {});
    
    ws.send(JSON.stringify({ newPlayer: getPlayerData(i) }));
  }
  
  newPlayer.you = true;
  ws.send(JSON.stringify({newPlayer: newPlayer}));
  connections.push(connection);
  newPlayer.you = false;

  tickIfReady();

  ws.on('message', function(message) {
    // Messages we get from clients will tell us the direction they've most recently set their snake to move in
    connection.player.setDirection(parseInt(message, 10));
    connection.replied = true;

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
});


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

  for (var i = connections.length - 1; i >= 0; i--)
    if (!connections[i].replied) 
      return;

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
    connections[i].sock.send(JSON.stringify({updates: updates, tick: true}), function(e) {});
    connections[i].replied = false;
  }
}


function tellAllClients(msg) {
  for (var i = connections.length - 1; i >= 0; i--) {
    connections[i].sock.send(msg, function(e) {});
  }
}

