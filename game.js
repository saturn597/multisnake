if (typeof module !== 'undefined' && module.exports)
  module.exports.Game = Game;

var DIRECTIONS = {LEFT: 37, RIGHT: 39, UP: 38, DOWN: 40};

var keyCodes = {
38: DIRECTIONS.UP, 
40: DIRECTIONS.DOWN,
37: DIRECTIONS.LEFT,
39: DIRECTIONS.RIGHT
}


function Game(blockWidth, canvasWidth, canvasHeight) {
  this.players = [];

  this.addPlayer = function(pieces, initD, index) {
    this.players[index] = new Player(pieces, initD, index); 
  } 
  
  this.tick = function() {
    /* Advance the game by one frame*/
    for (var i = this.players.length - 1; i >= 0; i--) {
      this.players[i].advance();
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

  function Player(pieces, initD, index) {
    var speed = blockWidth;

    this.index = index;

    this.pieces = pieces;
    
    this.direction = initD;

    this.maxLen = 3;

    this.getData = function() {
      return {"pieces": this.pieces, "direction": this.direction, "maxLen": this.maxLen};
    };
      
    this.advance = function() {
      var newPiece;
      var lastPiece;

      if (this.pieces.length < this.maxLen) {
        lastPiece = this.pieces[this.pieces.length - 1];
        newPiece = {x: lastPiece.x, y: lastPiece.y};
      }

      for (var i = this.pieces.length - 1; i > 0; i--) {
        this.pieces[i] = {x: this.pieces[i - 1].x, y: this.pieces[i - 1].y};
      }
      
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

      this.pieces[0].x = wrap(this.pieces[0].x, 0, canvasWidth);
      this.pieces[0].y = wrap(this.pieces[0].y, 0, canvasHeight);

      if (newPiece) {
        this.pieces.push(newPiece);
      }
    };
  } 
}

