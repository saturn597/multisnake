What this is
=====================
This is a multiplayer game of Snake using websockets. You can see it in action [here](https://multiuser-snake.herokuapp.com/).


How to play
=====================

Select the number of players that you want to compete against by clicking the appropriate button. Once enough others have requested a game with that number of players, the game will begin. 

Your snake will appear red and your opponents' snakes dark blue. Use the arrow keys to change direction. 

Try to force your opponents to collide while avoiding running into anything yourself. If you collide with your snake or with one of your opponents' snakes, your snake dies and you are out of the game. You win if all of your opponents die while you are still alive. If you click "Exit Game" while the game is in progress, you forfeit the game (and one of your opponents will win by default if they are the only ones left).

If you lose, but more than one player is still alive, you can watch the rest of the game play out as it happens.

Players can select a name for themselves. The names of the last 10 winners will be displayed to other players.


How to serve the game
=====================
You'll need [Node.js](https://nodejs.org/en/) to serve the game, and [npm](https://www.npmjs.com/) will help manage the dependencies.

Once you have those, obtain the files in this repository. For example:

`git clone https://github.com/saturn597/multisnake.git`

Change to the directory containing package.json and type:

`npm install`

Then just type:

`node server.js`

or

`npm start`

This starts up a webserver running on port 3000, which serves up the game files. Just navigate a web browser to your local ip address at port 3000 and you'll be able to play the game.
