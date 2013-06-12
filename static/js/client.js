define(["jquery", "underscore", "backbone",
'collections/games',
'models/game',
'views/game-list-view', 'views/new-game-view', 'views/game-view'],
function($, _, Backbone, Games, Game, 
GameListView, NewGameView, GameView) {
   return {
      initialize: function() {
         var gameList = new Games;
         gameList.fetch({
            success: function(collection, response, options) {
               var sharedGameView = new GameView({ model: null });
               var myGameListView = new GameListView({
                  el: $('#gameList'),
                  collection: collection,
                  gameView: sharedGameView
               });
               myGameListView.render();
               new NewGameView({
                  el: $('#newGame'),
                  collection: collection,
                  gameView: sharedGameView
               });
            },
            error: function(collection, response, options) {
                      console.log(JSON.stringify(collection));
               console.log(JSON.stringify(response));
               console.log(JSON.stringify(options));
               console.error("ERROR");
            }
         });

      }
   }
});
