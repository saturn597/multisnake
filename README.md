What this is
=====================
This is a multiplayer game of Snake using websockets. The websockets server relies on node.js and the node module [ws](https://github.com/websockets/ws). 


How to serve the game
=====================
Obtain the files in this repository (e.g., by using `git clone`). Then, run an HTTP server to serve up index.html, client.js, game.js, and game.css. With node and the [ws](https://github.com/websockets/ws) module installed, run `node server.js` to start up the websocket server. 


How to play
=====================

Once the HTTP and websocket servers are running, players who access index.html will be able to play the game. 

You simply select the number of players that you want to compete against by clicking the appropriate button. Once enough others have requested a game with that number of players, the game will begin. 

Your snake will appear red and your opponents' snakes dark blue. Use the arrow keys to change direction. 

Try to force your opponents to collide while avoiding running into anything yourself. If you collide with your snake or with one of your opponents' snakes, your snake dies and you are out of the game. You win if all of your opponents die while you are still alive. If you click "Exit Game" while the game is in progress, you forfeit the game (and one of your opponents will win by default if they are the only ones left).

If you lose, but more than one player is still alive, you can watch the rest of the game play out as it happens.

Players can select a name for themselves. The names of the last 10 winners will be displayed to other players. Note: names are not authenticated in any way.
