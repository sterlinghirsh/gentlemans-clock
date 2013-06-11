requirejs.config({
   "baseUrl": "static/js",
   "paths": {
      "jquery": "lib/jquery-1.10.1.min",
      "jquery-serializeObject": "lib/jquery.serializeObject.min",
      "underscore": "lib/underscore",
      "underscore-string": "lib/underscore.string",
      "backbone": "lib/backbone",
      "text": "lib/text",
      "date-shim": "lib/date-shim",
      "json3": "lib/json3"
   },
   "shim": {
      "backbone": {
         deps: ['underscore', 'jquery', 'json3'],
         exports: 'Backbone'
      },
      "underscore": {
         exports: "_"
      },
      "underscore-string": {
         deps: ['underscore']
      },
      "bootstrap": {
         deps: ['jquery'],
         exports: '$.fn.popover'
      },
      "jquery-serializeObject": {
         deps: ['jquery']
      }
   }
});
require(['underscore', 'underscore-string',
'client', 'jquery-serializeObject', 'date-shim'], function (_, _s, client) {
   _.mixin(_.string.exports());
   client.initialize();
});
