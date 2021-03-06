define(["jquery", "underscore", "backbone", 'custom',
'collections/games',
'models/game',
'views/game-list-view', 'views/new-game-view', 'views/game-view',
'views/main-menu'],
function($, _, Backbone, Custom, 
Games, Game, 
GameListView, NewGameView, GameView,
MainMenuView) {
   return {
      initialize: function() {
         var sharedGameView = null;
         var AppRouter = Backbone.Router.extend({
            routes: {
               'game/:join_code': function(join_code) {
                  var that = this;
                  if (join_code == 'new' && (sharedGameView === null || sharedGameView.model === null)) {
                     if (localStorage[Custom.localGameKey]) {
                        try {
                           Custom.sharedGame = new Game();
                           Custom.sharedGame.fetch();
                           sharedGameView.setModel(Custom.sharedGame);
                        } catch (ex) {
                           console.error(ex);
                           localStorage.removeItem(Custom.localGameKey);
                           $('#newGame').removeClass('hidden').modal();
                           return;
                        }
                     } else {
                        $('#newGame').removeClass('hidden').modal();
                        return
                     }
                  }

                  if (join_code != 'new') {
                     join_code = join_code.toLowerCase();
                     // Load the game.
                     Custom.sharedGame = new Game({
                        join_code: join_code
                        , public: true
                     });
                     Custom.socketConnect();

                     // TODO: Add a loading spinner.
                     Custom.sharedGame.fetch({
                        success: function() {
                           sharedGameView.setModel(Custom.sharedGame);
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

         var mainMenuView = new MainMenuView({
            el: $('#main')
         });

         sharedGameView = new GameView({
            el: $('#gameDetail')
            , model: null
            , router: app_router
         });

         var newGameView = new NewGameView({
            el: $('#newGame'),
            gameView: sharedGameView,
            router: app_router
         });

         $('#joinGameForm').submit(function(ev) {
            ev.preventDefault();
            var join_code = $('#joinCodeInput').val();
            if (join_code.length == 5) {
               app_router.navigate('/game/' + join_code, {trigger: true});
            } else {
               bootbox.alert("Join codes must be 5 characters.");
            }
         });

         $('.startGame').click(function(ev) {
            ev.preventDefault();
            $('#newGame').removeClass('hidden').modal();
         });

         Backbone.history.start();
      }
   }
});
