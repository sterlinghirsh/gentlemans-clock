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
               var myGameListView = new GameListView({
                  el: $('#gameList'),
                  collection: collection,
                  gameView: new GameView({ model: null })
               });
               myGameListView.render();
               new NewGameView({
                  el: $('#newGame'),
                  collection: collection
               });
            },
            error: function(collection, response, options) {
               console.error("ERROR");
            }
         });

      }
   }
});
