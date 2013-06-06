requirejs.config({
   "baseUrl": "static/js",
   "paths": {
      "jquery": "lib/jquery-2.0.2.min",
      "jquery-serializeObject": "lib/jquery.serializeObject.min",
      "underscore": "lib/underscore",
      "underscore-string": "lib/underscore.string",
      "backbone": "lib/backbone",
      "text": "lib/text"
   },
   "shim": {
      "backbone": {
         deps: ['underscore', 'jquery'],
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
'client', 'jquery-serializeObject'], function (_, _s, client) {
   _.mixin(_.string.exports());
   client.initialize();
});
