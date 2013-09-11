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
      , displayTime: function(timeInSeconds) {
         var time = Custom.timeDisplayStruct(Custom.secondsToStruct(timeInSeconds));

         var timeString = time.mins + ":" + time.secs;

         if (time.hours > 0) {
            timeString = time.hours + ":" + timeString;
         }

         return timeString;
      }
      , secondsToStruct: function(timeInSeconds) {
         timeInSeconds = Math.max(0, timeInSeconds);
         var hours = Math.floor(timeInSeconds / 3600);
         timeInSeconds -= hours * 3600;
         var mins = Math.floor(timeInSeconds / 60);

         var secs = Math.floor(timeInSeconds % 60);

         return {hours: hours, mins: mins, secs: secs};
      }
      , timeDisplayStruct: function(time) {
         var newTime = _.clone(time);
         if (newTime.mins < 10 && newTime.hours > 0) {
            newTime.mins = "0" + newTime.mins;
         }
         
         if (newTime.secs < 10) {
            newTime.secs = "0" + newTime.secs;
         }
         return newTime;
      }
      , timeStructToSeconds: function(time) {
         return time.hours * 3600 + time.mins * 60 + time.secs;
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
