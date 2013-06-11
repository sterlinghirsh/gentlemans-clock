define(['jquery', 'underscore', 'backbone',
'models/game', 'collections/games']
, function($, _, Backbone, Game, Games) {
   return Backbone.View.extend({
      events: {
         'submit form': function(ev) {
            var that = this;
            ev.preventDefault();
            var form = $(ev.currentTarget);
            var data = form.serializeObject();
            var model = new Game(data);
            model.save(null, {success: function() {
               that.collection.add(model);
               that.options.gameView.setModel(model);
            }});
         }
      }
   });
});

