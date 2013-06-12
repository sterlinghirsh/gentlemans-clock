define(['jquery', 'underscore', 'backbone', 'bootbox',
'text!templates/edit-player.html', 'bootstrap']
, function($, _, Backbone, bootbox, _EditPlayer) {
   return Backbone.View.extend({
      template: _.template(_EditPlayer)
      , initialize: function() {
         var that = this;
         this.form = this.$('form');
         this.validColors = ['red', 'green', 'blue', 'black', 'white',
          'yellow', 'pink', 'tan', 'gray'];
         this.$el.on('hidden', function() {
            that.undelegateEvents();
         });
         this.render();
      }
      , render: function() {
         var data = _.extend(this.model, {
            validColors: this.validColors
         });
         this.form.html(this.template(this.model));
         //this.options.gameView.undelegateEvents();
         this.$el.modal();
      }, events: {
         'click #removePlayerButton': function(ev) {
            var that = this;
            ev.preventDefault();
            this.undelegateEvents();
            bootbox.confirm("Are you sure you want to remove this player? You cannot undo this action.",
             _.bind(function(result) {
               that.delegateEvents();
               if (!result)
               return;
               var players = this.options.game.get('players');
               var keyToRemove = null;
               for (var i = 0; i < players.length; ++i) {
                  if (players[i]._id == this.model._id) {
                     keyToRemove = i;
                     break;
                  }
               }

               if (keyToRemove === null) {
                  console.error("Tried to remove null player.");
                  return;
               }

               players.splice(i, 1);
               this.options.game.set({players: players});
               if (this.options.game.get('public')) {
                  this.options.game.save();
               }
               this.$el.modal('hide');
            }, this))
         }
         , 'submit': function(ev) {
            ev.preventDefault();
            var data = this.form.serializeObject();
            var that = this;

            var players = this.options.game.get('players');
            for (var i = 0; i < players.length; ++i) {
               if (players[i]._id == that.model._id) {
                  players[i].name = data.name;
                  players[i].color= data.color;
                  break;
               }
            };

            this.options.game.set({players: players});
            if (this.options.game.get('public')) {
               this.options.game.save();
            }
            this.$el.modal('hide');
         }
      }
   });
});
