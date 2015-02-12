var WebSocketServer = require('ws').Server, 
  wss = new WebSocketServer({port: 8080}),
  gameModule = require('./game.js'),
  game = new gameModule.Game(5, 800, 600),
   
  connections = [],
  initStates = [{x: 0, y: 0, d: game.DIRECTIONS.RIGHT}, {x: 800, y: 595, d: game.DIRECTIONS.LEFT}],
  time = false,
  timer,
  minPlayers = 2,
  maxPlayers = 2,
  
  endGame = false;
  game.onCollision = function () {endGame = true};

function init() {
  console.log(connections);
  for (var i = connections.length - 1; i >= 0; i--)
    connections[i].sock.close();
  connections = [];
  time = false;
  timer = void(0);

  game = new gameModule.Game(5, 800, 600),
  endGame = false;
}

function getPlayerInit(ind) {
  var player = game.players[ind];
  return {pieces: player.pieces, index: ind, direction: player.direction};
}

wss.on('connection', function(ws) {
  if (connections.length >= maxPlayers)
    return;

  var newIndex = connections.length,
    newState = initStates[newIndex % initStates.length],
    newPlayer = game.addPlayer([{x: newState.x, y: newState.y}], newState.d, newIndex);

  var connection = {sock: ws, index: newIndex, player: newPlayer, replied: true};
  var msg;
  
  if (connections.length === 0) {
    timer = setTimeout(timesUp, 50);
  }

  for (var i = connections.length - 1; i >= 0; i--) {
    msg = JSON.stringify({newPlayer: newPlayer});
    connections[i].sock.send(msg, function() {});
    
    msg = JSON.stringify({newPlayer: getPlayerInit(i)});
    ws.send(msg);
  }
  
  newPlayer.you = true;
  ws.send(JSON.stringify({newPlayer: newPlayer}));
  connections.push(connection);
  newPlayer.you = false;
  tick();

  ws.on('message', function(message) {
    connection.player.setDirection(parseInt(message, 10));
    connection.replied = true;
    tick();
  });

  ws.on('close', function() {
    tellAllClients(JSON.stringify({"toDelete": [connections.indexOf(connection)]})); //Can probably make this not a list
    connections.splice(connections.indexOf(connection), 1); 
    game.players.splice(game.players.indexOf(connection.player), 1);
    if (connections.length === 0) {
      clearTimeout(timer);
      init();
    }
    tick();
  });
});


function timesUp() {
  time = true;
  tick();
}

function tick() {
  if (connections.length < minPlayers)
    return;
  if (connections.length == 0) return;
  for (var i = connections.length - 1; i >= 0; i--)
    if (!connections[i].replied) 
      return;
  if (!time)
    return;
  game.tick();
  updateClients();
  time = false;
  if (!endGame) timer = setTimeout(timesUp, 50);
  else init(); 
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

