({
   name: 'lib/almond',
   baseUrl: ".",
   out: "main-built.js",
   "paths": {
      "jquery": "lib/jquery-1.10.1.min",
      "jquery-serializeObject": "lib/jquery.serializeObject.min",
      "underscore": "lib/underscore",
      "underscore-string": "lib/underscore.string",
      "backbone": "lib/backbone",
      "text": "lib/text",
      "date-shim": "lib/date-shim",
      "json": "lib/json3",
      "bootstrap": "lib/bootstrap.min"
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
         exports: 'jQuery.fn.popover'
      },
      "jquery-serializeObject": {
         deps: ['jquery']
      },
      "json": {
         exports: 'JSON'
      }
   },
   include: ['main'],
   wrap: true,
   insertRequire: ['main']
   //, optimize: 'none'
})
