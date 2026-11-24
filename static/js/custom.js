define(['underscore', 'socketio', 'backbone'], function(_, io, Backbone) {
   var Custom = {
      socket: null
      , origSync: null
      , sharedGame: null
      , localGameKey: 'localGame'
      , socketConnect: function() {
         // The realtime server: the build writes window.GC_SERVER (its origin); without it, this page's origin.
         this.socket = io(window.GC_SERVER || undefined, {path: '/ws', addTrailingSlash: false});
         this.origSync = Backbone.sync;

         // Clock skew (local - server), measured at each connect from the round trip's midpoint.
         Custom.socket.on('connect', function() {
            var sent = Date.now();
            Custom.socket.emit('time', function(err, serverNow) {
               if (!err && typeof serverNow === 'number') {
                  var now = Date.now();
                  window.serverTimeDiff = Math.round((sent + now) / 2 - serverNow);
               }
            });
         });
         
         Custom.socket.on('update', function(data) {
            if (Custom.sharedGame !== null) {
               Custom.sharedGame.trigger('update', data);
            }
         });

         // TODO: Better error reporting.
         Custom.socket.on('error', function(data) {
            console.error(data);
         });
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
