define(['underscore'], function(_) {
   return {
      displayTime: function (timeInSeconds) {
         timeInSeconds = _.max([0, timeInSeconds]);
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
      , makeid: function(size) {
         var text = "";
         var possible = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
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
   }
});
