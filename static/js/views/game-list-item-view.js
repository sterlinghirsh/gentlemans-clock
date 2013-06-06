define(['jquery', 'underscore', 'backbone',
'views/game-view',
'text!templates/game-list-item.html']
, function($, _, Backbone, GameView, _GameListItem) {
   return Backbone.View.extend({
      tagName: "li"
      , className: "game-list-item"
      , template: _.template(_GameListItem)
      , events: {
         'click': 'showGame'
      }
      , initialize: function() {
         this.model.on('change', this.render, this);
         this.render();
      }
      , render: function() {
         this.$el.html(this.template(this.model.toJSON()));
         this.delegateEvents();
      }
      , showGame: function() {
         this.options.gameView.setModel(this.model);
         this.delegateEvents();
      }
   });
});

