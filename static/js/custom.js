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
            timeString = hours + ":" + player.gameTimeString;
         }

         return timeString;
      }
   }
});
