var DIRECTIONS = {LEFT: 37, RIGHT: 39, UP: 38, DOWN: 40};

var keyCodes = {
  38: DIRECTIONS.UP, 
  40: DIRECTIONS.DOWN,
  37: DIRECTIONS.LEFT,
  39: DIRECTIONS.RIGHT
}

var socket;
var playerColor = "Salmon";
var opponentColor = "DarkBlue";

var currentGame;  // the game we're currently waiting on

var pingDelay = 30000;
var pingTimer;

var ping = function() {
  if (socket.readyState === 1) {
    socket.send('ping');
    pingTimer = window.setTimeout(ping, pingDelay);
  } 
}

var waitingOnmessage = function(msg) {

  if (msg.data === "pong") {
    console.log("pong received");
    return;
  }

  if (msg.data === "startGame") {
    $("#gameList").html("<h1><a href = 'javascript:exitGame()'>Exit game</a></h1>"); 
    startGame();
    return;
  }

  var parsed = JSON.parse(msg.data);

  if (parsed.hasOwnProperty("recentWinners")) {
    updateRecentWinners(parsed.recentWinners);
  }

  if (parsed.hasOwnProperty("games")) {
    // receiving a summary of games that are currently available
    console.log("Receiving game info");

    // receiving this means that we ended a game, just connected, or had to reconnect, so we're no longer waiting for a game
    currentGame = null;
    // and we can let players change their names again
    $("#playerName").attr("disabled", false);

    var games = parsed.games;
    $("#gameList").html("");
    for (var i = games.length - 1; i >= 0; i--) {
      $("#gameList").append(createGameLink(i, games[i].name, games[i].waitingCount));
    }
  }

  if (parsed.hasOwnProperty("newCount")) {
    console.log("received new count");
    // a newCount message contains the game we're updating at [0] and the new count at [1]
    var info = parsed.newCount;
    setGameCount(info[0], info[1]);
  }
};

function socketClosed() {
  window.clearTimeout(pingTimer);
  $("#gameList").css("display", "none");
  $("#errorMessages").css("display", "table-cell");
}

function socketOpen() {
  pingTimer = window.setTimeout(ping, pingDelay);
  $("#gameList").css("display", "block");
  $("#errorMessages").css("display", "none");
}

function connect() {
  var HOST = location.origin.replace(/^http/, 'ws')
  socket = new WebSocket(HOST);
  socket.onopen = socketOpen;
  socket.onmessage = waitingOnmessage;
  socket.onclose = socketClosed;
}

$('document').ready(function() {

  $(".playerColor").css({"color": playerColor, "font-weight": "bold"});
  $(".opponentColor").css({"color": opponentColor, "font-weight": "bold"});
  connect();
});

function createGameLink(num, name, count) {
  var li = $("<li />", {
    "class": "gameListItem",
    id: "gameListItem" + num
  });

  var a = $("<a />", {
    id: "gameLink" + num,
    href: "javascript:joinGame(" + num + ")"
  });

  var nameSpan = $("<span />", {
    text: name,
    id: "gameName" + num
  });

  var countSpan = $("<span />", {
    text: count + " waiting",
    id: "gameCount" + num
  });

  li.append(nameSpan).append("<br>").append(countSpan);
  a.append(li);

  return a;
}

function setGameCount(num, count) {
  // show the user that game number num has count other users waiting to play
  $("#gameCount" + num).text(count + " waiting");  // could use an array of these instead of identifying them by id
}

function updateRecentWinners(winners) {
  // take an array of strings representing recent winners and display appropriately

  var ul = $("#recentWinners");
  ul.html("");

  winners.forEach(function(winner) { 
    ul.append($("<li />", {
      "class": "recentWinner",
      text: winner
    }));
  });

}

function joinGame(gameNum) {
  if (gameNum === currentGame) {
    // if user clicks on the join link for a game we're already waiting for, cancel waiting for that game
    socket.send("cancel");
    $("#playerName").attr("disabled", false);
    $("#gameListItem" + gameNum).removeClass("selectedGame");
    currentGame = null;

  } else {
    // otherwise, ask server to add us to the wait list for that game
    console.log("sending join");
    socket.send(JSON.stringify({ "join": gameNum, "name": $("#playerName").val() }));
    $("#gameListItem" + gameNum).addClass("selectedGame");
    $("#gameListItem" + currentGame).removeClass("selectedGame");
    currentGame = gameNum;
    $("#playerName").attr("disabled", true);
  }
}

function exitGame() {
  console.log('exitGame called');
  socket.onmessage = waitingOnmessage;
  socket.send("leave");
  window.setTimeout(ping, pingDelay);
}

function resetDisplay() {

  var canvas = $('#canvas')[0];
  var context = canvas.getContext('2d');

  // reset the gameMessages div and the canvas opacity in case we were showing a message
  // or setting the opacity 
  $("#gameMessages").text("");
  $('#canvas').css("opacity", "1");

  // fill in the canvas with white
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);

}

function startGame() {
  var globalMessage = {};

  var gameInProgress = true;

  var tickLength = 50; 

  var canvas = $('#canvas')[0];
  
  var blockWidth = 5;
  var game = new Game(blockWidth, canvas.width, canvas.height);

  var myIndex;
  var newDir;

  window.clearTimeout(pingTimer);

  resetDisplay();
  
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

    if (parsed.hasOwnProperty("newPlayers")) {
      parsed.newPlayers.forEach(function(playerData) { game.addPlayer(playerData.pieces, playerData.direction, playerData.id); });
    }

    if (parsed.hasOwnProperty("yourIndex")) {
      myIndex = parsed["yourIndex"];
      newDir = game.getPlayerById(myIndex).direction;
      
      // at this point, we have the info we need to draw the initial pieces of each player
      // (before, we didn't know which belonged to the client, so we didn't know what color to use)
      draw(game.players, canvas);

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
        socket.send(newDir);  // we might exit the game due to events in game.tick, so send our update first

        game.tick(); 
        draw(game.players, canvas);

        game.getPlayerById(myIndex).setDirection(newDir);
      }
    }
  }

  function draw(players, canvas) {
    var context = canvas.getContext('2d') 

    for (var i = players.length - 1; i >= 0; i--) {
      if (i == myIndex) {
        context.fillStyle = playerColor;
      } else {
        context.fillStyle = opponentColor;
      }
      for (var j = players[i].lastAdded.length - 1; j >= 0; j--)  {
        context.fillRect(players[i].lastAdded[j].x, players[i].lastAdded[j].y, blockWidth, blockWidth);
      } 
    }

    if (globalMessage.text) {
      // not currently using this - maybe delete
      context.font = globalMessage.font;
      context.fillStyle = globalMessage.color;
      context.fillText(globalMessage.text, globalMessage.x, globalMessage.y);
    }
  }

  function createMessage(text, color, canvas) {
    // not currently using this function - maybe delete
    var context = canvas.getContext('2d');

    var oldFont = context.font;
    var messageFont = "96px sans-serif";
    context.font = messageFont;  // need the right font so the measurement is right
    var dimensions = context.measureText(text);
    context.font = oldFont;  // I don't think I'll need this but set back to the original font just in case
    // maybe that's overkill - maybe just set the font globally, since I'm not using any other fonts

    return {
      text: text,
      color: color,
      font: messageFont,
      x: canvas.width / 2 - dimensions.width / 2, 
      y: canvas.height / 2 + 24
    };
  }

  function showMessage(text, color) {
    $("#canvas").css("opacity", "0.2");
    $("#gameMessages").text(text);
    $("#gameMessages").css("color", color);
  }

  game.onKill = function(player) {
    // when someone is killed in game, check if that causes us to win or lose
    if (player.id === myIndex) {
      //globalMessage = createMessage("You lose!", "Crimson", canvas);
      showMessage("You lose!", "Crimson");
      console.log("lost!");
      gameInProgress = false;
    }
    if (game.countLiving() <= 1) {
      //globalMessage = createMessage("You win!", "DodgerBlue", canvas);
      if (game.getPlayerById(myIndex).alive) {
        showMessage("You win!", "DodgerBlue");
        gameInProgress = false;
      }
      exitGame();
    }
  }
};

