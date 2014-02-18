var WebSocketServer = require('ws').Server, wss = new WebSocketServer({port: 8080});
var gameModule = require('./game.js');
var game = new gameModule.Game(5, 800, 600);


//Can DIRECTIONS and keyCodes be factored out?
var DIRECTIONS = {LEFT: 37, RIGHT: 39, UP: 38, DOWN: 40};

var keyCodes = {
  38: DIRECTIONS.UP, 
  40: DIRECTIONS.DOWN,
  37: DIRECTIONS.LEFT,
  39: DIRECTIONS.RIGHT
}




var counter = 0;  // When 3, tell clients to update state
var connections = [];

var currentIndex = 0;

var locations = [{x: 0, y: 0}, {x: 0, y: 0}];
var location_index = 0;
function next_location() {
  var loc = locations[location_index];  
  location_index++;
  if (location_index > locations.length - 1) location_index = 0;

  return loc;
}

function serializeData(index, locations) {
  var data = concat(index, [].concat.apply([], locations));
  return new Uint16Array(data);
}

wss.on('connection', function(ws) {
  var newIndex = currentIndex;
  currentIndex++;
  var newPieces = [locations[newIndex % locations.length]];
  var newDirection = 38;

  var connection = {sock: ws, direction: 38, index: currentIndex};
  var msg;
  
  var currentPlayer;

  var newPlayer = {newPlayer: {pieces: newPieces, direction: 38, index: newIndex}};
  game.addPlayer(newPieces, newDirection, newIndex); 

  connection.player = game.players[newIndex];

  for (var i = connections.length - 1; i >= 0; i--) {
    msg = JSON.stringify(newPlayer);
    connections[i].sock.send(msg);
    
    currentPlayer = game.players[connections[i].index];
    msg = JSON.stringify({newPlayer: {pieces: connections[i].player.pieces, index: connections[i].player.index, direction: connections[i].player.direction}});
    ws.send(msg);
  }
  
  newPlayer['newPlayer'].you = true;
  ws.send(JSON.stringify(newPlayer));

  connections.push(connection);
  tick();

  ws.on('message', function(message) {
    connection.player.direction = parseInt(message, 10); 
    tick();
  });
});

function timesUp() {
  tick();
}
setTimeout(timesUp, 50);

function tick() {
  counter++;
  if (counter > connections.length) {
    game.tick();
    updateClients();
    counter = 0;
    setTimeout(timesUp, 50);
  }
}

function updateClients() {
  var direction;
  var updates = [];
  for (var i = 0, len = connections.length; i < connections.length; i++) {  //Simplify with array constructor
    updates.push(connections[i].player.direction);
  }
  for (var i = connections.length - 1; i >= 0; i--) {
    connections[i].sock.send(JSON.stringify({updates: updates, tick: true}));
  }
}


/*
wss.on('connection', function(ws) {
  console.log('connection');
  
  var timer = setTimeout(sendState, 50);
  var left = false;


  function sendState() {
    var arr = new Uint8Array(1);
    if (left) {
      arr[0] = 39;
      left = false;
    } else {
      arr[0] = 37;
      left = true;
    }
    timer = setTimeout(sendState, 50);
    ws.send(arr, {binary: true}, function(e) {
      if (e) { 
        console.log("Error encountered"); 
        clearTimeout(timer);
      }
      });
  }

  ws.on('message', function(message) {
    var buf = new Buffer(message);
    var i = buf.readUInt8(0);
    console.log('received: %s', i);
  });
});
*/
