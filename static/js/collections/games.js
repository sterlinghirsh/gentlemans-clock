define(['jquery', 'underscore', 'backbone',
 'models/game'],
function($, _, Backbone, Game) {
   return Backbone.Collection.extend({
      url: '/api/games',
      model: Game
   });
});
