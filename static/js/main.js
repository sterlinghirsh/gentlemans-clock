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
      "json": "lib/json3",
      "bootbox": "lib/bootbox.min",
      "bootstrap": "lib/bootstrap.min",
      "socketio": "lib/socket.io",
      "backboneio": "lib/backbone.io"
   },
   "shim": {
      "jquery": {
         deps: ['json']
      },
      "backbone": {
         deps: ['json', 'underscore', 'jquery'],
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
      "bootbox": {
         deps: ['bootstrap', 'jquery'],
         exports: 'bootbox'
      },
      "json": {
         exports: 'JSON'
      },
      "backboneio": {
         deps: ['backbone', 'socketio']
      }
   }
});
require(['underscore', 'underscore-string',
'client', 
'jquery-serializeObject', 'date-shim'], function (_, _s, client) {
   _.mixin(_.string.exports());
   client.initialize();
});
