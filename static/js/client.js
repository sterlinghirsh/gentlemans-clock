define(["jquery", "underscore", "backbone",
'collections/games',
'models/game',
'views/game-list-view', 'views/new-game-view', 'views/game-view',
'views/main-menu'],
function($, _, Backbone, Games, Game, 
GameListView, NewGameView, GameView,
MainMenuView) {
   return {
      initialize: function() {
         var sharedGameView = null;
         var AppRouter = Backbone.Router.extend({
            routes: {
               'startGame': function() {
                  $('#main > div').addClass('hidden');
                  $('#newGame').removeClass('hidden');
               }
               , 'joinGame': function() {
                  $('#main > div').addClass('hidden');
                  $('#joinGameView').removeClass('hidden');
                  $('#joinCodeInput').focus();
               }
               , 'game/:join_code': function(join_code) {
                  var that = this;
                  if (join_code == 'new' && (sharedGameView === null || sharedGameView.model === null)) {
                     return this.navigate('startGame', {trigger: true});
                  }

                  if (join_code != 'new') {
                     // Load the game.
                     var newModel = new Game({
                        join_code: join_code
                     });
                     newModel.fetch({
                        success: function() {
                           sharedGameView.setModel(newModel);
                        }
                        , error: function() {
                           return that.navigate('joinError', {trigger: true});
                        }
                     });
                  }
                  $('#main > div').addClass('hidden');
                  $('#gameDetail').removeClass('hidden');
               }
               , 'joinError': function() {
                  $('#main > div').addClass('hidden');
                  $('#joinError').removeClass('hidden');
               }
               , '*path': function() {
                  $('#main > div').addClass('hidden');
                  $('#mainMenu').removeClass('hidden');
               }
            }
         });

         var app_router = new AppRouter;

         Backbone.history.start();

         var mainMenuView = new MainMenuView({
            el: $('#main')
         });

         if (sharedGameView === null) {
            sharedGameView = new GameView({
               el: $('#gameDetail')
               , model: null
               , router: app_router
            });
         }

         var newGameView = new NewGameView({
            el: $('#newGame'),
            //collection: collection,
            gameView: sharedGameView,
            router: app_router
         });

         $('#joinGameForm').submit(function(ev) {
            ev.preventDefault();
            var join_code = $('#joinCodeInput').val();
            app_router.navigate('/game/' + join_code, {trigger: true});
         });

         /*
         var gameList = new Games;
         gameList.fetch({
            success: function(collection, response, options) {
               var myGameListView = new GameListView({
                  el: $('#gameList'),
                  collection: collection,
                  gameView: sharedGameView
               });
               myGameListView.render();
            },
            error: function(collection, response, options) {
                      console.log(JSON.stringify(collection));
               console.log(JSON.stringify(response));
               console.log(JSON.stringify(options));
               console.error("ERROR");
            }
         });
         */

      }
   }
});
