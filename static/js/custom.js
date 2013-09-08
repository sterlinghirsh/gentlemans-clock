define(['underscore', 'socketio', 'backbone'], function(_, io, Backbone) {
   var Custom = {
      socket: null
      , origSync: null
      , sharedGame: null
      , socketConnect: function() {
         this.socket = io.connect();
         this.origSync = Backbone.sync;
         
         Custom.socket.on('update', function(data) {
            if (Custom.sharedGame !== null) {
               Custom.sharedGame.trigger('update', data);
            }
         });

         // TODO: Better error reporting.
         Custom.socket.on('error', function(data) {
            console.error(data);
         });

         Backbone.sync = function(method, model, options) {
            options = _.clone(options) || {};

            var error = options.error || function() {};
            var success = options.success || function() {};
            // Don't pass these to server
            delete options.error;
            delete options.success;
            delete options.collection; 
            var req = {
               model: model.toJSON(),
               options: options
            };

            Custom.socket.emit(method, req, function(err, resp) {
               if (err) {
                  console.error(err);
                  error(err);
               } else {
                  success(resp);
               }
            });
         };
      }
      , socketDisconnect: function() {
         if (this.socket !== null) {
            this.socket.disconnect();
            this.socket = null;
            Backbone.sync = Custom.origSync;
         }
      }
      , displayTime: function (timeInSeconds) {
         timeInSeconds = Math.max(0, timeInSeconds);
         var hours = Math.floor(timeInSeconds / 3600);
         timeInSeconds -= hours * 3600;
         var mins = Math.floor(timeInSeconds / 60);

         if (mins < 10 && hours > 0) {
            mins = "0" + mins;
         }
         var secs = Math.floor(timeInSeconds % 60);

         if (secs < 10) {
            secs = "0" + secs;
         }

         var timeString = mins + ":" + secs;

         if (hours > 0) {
            timeString = hours + ":" + timeString;
         }

         return timeString;
      }
      , makeid: function(size, alpha) {
         var text = "";
         var possible = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";

         if (alpha) {
            possible = "abcdefghijklmnopqrstuvwxyz";
         }
         for (var i=0; i < size; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
         }

         return text;
      }
      , validColors: ['red', 'green', 'blue', 'black', 'white',
          'yellow', 'pink', 'tan', 'gray']
      , getNextUnusedColor: function(usedColors) {
         var unusedColors = _.difference(this.validColors, usedColors);
         if (unusedColors.length == 0) {
            return this.validColors[_.random(this.validColors.length - 1)];
         } else {
            return unusedColors[0];
         }
      }
   };

   _.extend(Custom, Backbone.events);
   return Custom;
});
