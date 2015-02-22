if (typeof module !== 'undefined' && module.exports)
  module.exports.Game = Game;

function Game(blockWidth, canvasWidth, canvasHeight) {

  this.DIRECTIONS = {LEFT: 37, RIGHT: 39, UP: 38, DOWN: 40};
  var DIRECTIONS = this.DIRECTIONS;

  this.initialize = function() {
    this.players = [];
    this.goals = [];
  }

  function addGoal() {
    var nx = canvasWidth / blockWidth;
    var ny = canvasHeight / blockWidth;

    goals.push({x: Math.truncate(Math.random() * nx), y: Math.truncate(Math.random() * ny)});
  }

  this.onCollision = function(collisions) {};

  this.addPlayer = function(pieces, initD, id) {
    this.players[id] = new Player(pieces, initD, id); 
    return this.players[id];
  }

  this.getPlayerById = function(id) {
    return this.players.find(function (player) { return player.id == id });
  }

  this.removePlayer = function(player) {
    this.players.splice(this.players.indexOf(player), 1);
  } 

  this.kill = function(player) {
    player.kill();
    this.onKill(player);
  }

  this.onKill = function(player) {
     
  }

  this.countLiving = function() {
    var count = 0;
    for (var i = this.players.length - 1; i >= 0; i--) {
      if (this.players[i].alive) {
        count++;
      }
    }
    return count;
  }
   
  this.tick = function() {
    /* Advance the game by one frame*/
    var i, j;
    var collider;
    var collisions = [];

    // advance each player
    for (i = this.players.length - 1; i >= 0; i--) {
      this.players[i].advance();
    }

    // check for collisions
    for (i = this.players.length - 1; i >= 0; i--) {
      if (collided = this.hasCollision(this.players[i].pieces[0])) {
        this.kill(this.players[i]);
        collisions.push({collider: this.players[i], collided: collided});
      }
    }

    if (collisions.length > 0)
      this.onCollision(collisions);
  }

  this.hasCollision = function(piece) {
    var i, j;
    var testPiece;

    for (i = this.players.length - 1; i >= 0; i--) {
      for (j = this.players[i].pieces.length - 1; j >= 0; j--) {
        testPiece = this.players[i].pieces[j];
        if (piece !== testPiece && piece.x == testPiece.x && piece.y == testPiece.y)
          return this.players[i];
      }
    }
  }

  function wrap(value, min, max) {
    /* Given value, return a new number, but ensuring it's between min and max */
    var newValue = value % max;
    
    if (newValue < min) {
      newValue += max;
    }

    return newValue;
  }

  function Player(pieces, initD, id) {

    var speed = blockWidth;

    this.alive = true;

    this.id = id;

    this.pieces = pieces;
    
    this.direction = initD;

    this.maxLen = 3;

    this.infiniteSnake = true;

    this.getData = function() {
      return {"pieces": this.pieces, "direction": this.direction, "maxLen": this.maxLen};
    };
    
    this.setDirection = function(d) {
      switch (d) {
        case DIRECTIONS.LEFT:
          if (this.direction != DIRECTIONS.RIGHT)
            this.direction = DIRECTIONS.LEFT;
          break;
        case DIRECTIONS.RIGHT:
          if (this.direction != DIRECTIONS.LEFT)
            this.direction = DIRECTIONS.RIGHT;
          break;
        case DIRECTIONS.UP:
          if (this.direction != DIRECTIONS.DOWN)
            this.direction = DIRECTIONS.UP;
          break;
        case DIRECTIONS.DOWN:
          if (this.direction != DIRECTIONS.UP)
            this.direction = DIRECTIONS.DOWN;
          break;
      }
    };

    this.advance = function() {
      if (!this.alive) return;

      var newPiece;
      var lastPiece;

      // create a new "piece" to add to the snake if it's less than max size
      if (this.pieces.length < this.maxLen || this.infiniteSnake) {
        lastPiece = this.pieces[this.pieces.length - 1];
        newPiece = {x: lastPiece.x, y: lastPiece.y};
      }

      // advance the snake's "tail" (everything but the head)
      // can this be avoided?
      for (var i = this.pieces.length - 1; i > 0; i--) {
        this.pieces[i] = {x: this.pieces[i - 1].x, y: this.pieces[i - 1].y};
      }
     
      // advance the head of the snake (the leading "piece")
      switch (this.direction) {
        case DIRECTIONS.UP:
          this.pieces[0].y -= speed; 
          break;
        case DIRECTIONS.DOWN:
          this.pieces[0].y += speed;
          break;
        case DIRECTIONS.LEFT:
          this.pieces[0].x -= speed;
          break;
        case DIRECTIONS.RIGHT:
          this.pieces[0].x += speed;
          break;
      }
      
      // if we're exceeding this height/width of the canvas, wrap around
      this.pieces[0].x = wrap(this.pieces[0].x, 0, canvasWidth);
      this.pieces[0].y = wrap(this.pieces[0].y, 0, canvasHeight);

      if (newPiece) {
        this.pieces.push(newPiece);
      }
    };

    this.kill = function() {
      this.alive = false;
    }
  } 

  this.initialize();

}

