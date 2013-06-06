define(['jquery', 'underscore', 'backbone',
'views/game-list-item-view']
, function($, _, Backbone, GameListItemView) {
   return Backbone.View.extend({
      initialize: function() {
         this.collection.on('change add', this.render, this);
      }
      , tagName: "ul"
      , className: "gameList"
      , render: function() {
         this.$el.empty();
         var that = this;
         this.collection.each(function (model) {
            that.$el.append(new GameListItemView({
               model: model,
               gameView: that.options.gameView
            }).el);
         });
         this.delegateEvents();
      }
   });
});

