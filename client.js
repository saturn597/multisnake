var DIRECTIONS = {LEFT: 37, RIGHT: 39, UP: 38, DOWN: 40};

var keyCodes = {
  38: DIRECTIONS.UP, 
  40: DIRECTIONS.DOWN,
  37: DIRECTIONS.LEFT,
  39: DIRECTIONS.RIGHT
}

var socket;

var waitingOnmessage = function(msg) {
  if (msg.data == "startGame") {
    $("#gameList").css("visibility", "hidden"); 
    startGame();
    return;
  }
  console.log(msg.data);
  var parsed = JSON.parse(msg.data);
  if (parsed.hasOwnProperty("games")) {
    // receiving a summary of games that are currently available
    console.log("Receiving game info");
    var games = parsed.games;
    $("#gameList").html("");
    for (var i = games.length - 1; i >= 0; i--) {
      $("#gameList").append(createGameLink(i, games[i].name, games[i].waitingCount));
      $("#gameList").append($("<br> /"));
    }
  }
  if (parsed.hasOwnProperty("newCount")) {
    console.log("received new count");
    // a newCount message contains the game we're updating at [0] and the new count at [1]
    var info = parsed.newCount;
    setGameCount(info[0], info[1]);
  }
};


$('document').ready(function() {
  socket = new WebSocket("ws://localhost:8080/");
  socket.onmessage = waitingOnmessage;
});

function createGameLink(num, name, count) {
  var a = $("<a />", {
    id: "gameLink" + num,
    href: "javascript:joinGame(" + num + ")"
  });

  var nameSpan =$("<span />", {
    text: name + ": ",
    "id": "gameName" + num
  });

  var countSpan = $("<span />", {
    text: count,
    "id": "gameCount" + num
  });

  a.append(nameSpan).append(countSpan);

  return a;
}

function setGameCount(num, count) {
  $("#gameCount" + num).text(count);  // maybe use an array of these instead of identifying them by id
}

function joinGame(gameNum) {
  console.log("sending join");
  socket.send(JSON.stringify({"join": gameNum}));
}

function endGame() {
  socket.onmessage = waitingOnmessage;
  socket.send("leave");
  $("#gameList").css("visibility", "visible"); 
}

function startGame() {

  var gameInProgress = true;

  var tickLength = 50; 

  var canvas = $('#canvas')[0];
  
  var blockWidth = 5;
  var game = new Game(blockWidth, canvas.width, canvas.height);

  var myIndex;
  var newDir;
 
  socket.onmessage = function(msg) {
    var parsed = JSON.parse(msg.data); 
    if (parsed.hasOwnProperty("toDelete")) {
      var toDelete = parsed["toDelete"];
      for (var i = toDelete.length - 1; i >= 0; i--) {
        game.players.splice(toDelete[i], 1);
      }
    }

    if (parsed.hasOwnProperty("kill")) {
      var toKill = parsed.kill;
      game.kill(game.getPlayerById(toKill));
    }

    if (parsed.hasOwnProperty("newPlayer")) {
      game.addPlayer(parsed["newPlayer"].pieces, parsed["newPlayer"].direction, parsed["newPlayer"].id);
    }

    if (parsed.hasOwnProperty("yourIndex")) {
      myIndex = parsed["yourIndex"];
      newDir = game.getPlayerById(myIndex).direction;
      $(document).keydown(function(e) {
        var dir = keyCodes[e.which];
        if (dir) {
          e.preventDefault();
          newDir = dir;
        }
      });
    }

    if (parsed.hasOwnProperty("updates")) {
      for (var i = parsed.updates.length - 1; i >= 0; i--) {
        var id = parsed.updates[i][0];
        var direction = parsed.updates[i][1];
        if (myIndex != id) {
          game.getPlayerById(id).setDirection(direction);
        }
      }
    }

    if (parsed.hasOwnProperty("tick")) {
      if (parsed["tick"]) {
        game.tick(); 
        draw(game.players, canvas);
        game.getPlayerById(myIndex).setDirection(newDir);
        socket.send(game.getPlayerById(myIndex).direction);
      }
    }
  }

  function draw(players, canvas) {
    // change this up to only draw the changed pieces?
    var context = canvas.getContext('2d')
    context.beginPath();
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = players.length - 1; i >= 0; i--) {
      if (i == myIndex) {
        context.fillStyle = "#FF0000";
      } else {
        context.fillStyle = "#000000";
      }
      for (var j = players[i].pieces.length - 1; j >= 0; j--)  {
        context.fillRect(players[i].pieces[j].x, players[i].pieces[j].y, blockWidth, blockWidth);
      } 
    }
    context.stroke();
  }

  game.onKill = function(player) {
    // when someone is killed in game, check if that causes us to win or lose
    if (player.id === myIndex) {
      gameInProgress = false;
      console.log("You lose!");
    } else if (game.countLiving() === 1 && game.getPlayerById(myIndex).alive) {
        console.log("You win!"); 
        gameInProgress = false;
    }
  }
};

