(function() {
    Backbone.io = {
        socket: null
        , connect: function() {
            if (Backbone.io.socket !== null) {
               Backbone.io.socket.socket.reconnect();
               console.log('it was not null');
            } else {
               Backbone.io.socket = io.connect.apply(io, arguments);
               console.log('it was null');
            }
            console.log('connecting');
            Backbone.io.connected.resolve(Backbone.io.socket);
            return Backbone.io.socket;
        }
        , disconnect: function() {
            if (Backbone.io.socket !== null) {
               Backbone.io.socket.disconnect();
               delete Backbone.io.socket;
               Backbone.io.socket = null;
               Backbone.io.connected.resolved = undefined;
               Backbone.io.connected.callbacks = [];
            }
        }, connected: new Promise()
    };
    
    var origSync = Backbone.sync;

    Backbone.sync = function(method, model, options) {
        var backend = model.backend;       
        options = _.clone(options) || {};

        var error = options.error || function() {};
        var success = options.success || function() {};
        
        console.log("fart");
        if (backend) {
           console.log("poot");
            // Don't pass these to server
            delete options.error;
            delete options.success;
            delete options.collection; 
            
            // Use Socket.IO backend
            backend.ready(function() {
                var req = {
                    method: method,
                    model: model.toJSON(),
                    options: options
                };
                console.log("puff");
                
                backend.socket.emit('sync', req, function(err, resp) {
                    if (err) {
                        error(err);
                    } else {
                        success(resp);
                    }
                });
            });
        } else {
            // Call the original Backbone.sync
            return origSync(method, model, options);
        }
    };

    var Mixins = {
        // Listen for backend notifications and update the
        // collection models accordingly.
        bindBackend: function() {
            var self = this;
            var idAttribute = this.model.prototype.idAttribute;
            
            this.backend.ready(function() {
                var event = self.backend.options.event;
                
                self.bind(event + ':create', function(model) {
                    self.add(model);
                });
                self.bind(event + ':update', function(model) {
                    var item = self.get(model[idAttribute]);
                    if (item) item.set(model);
                });
                self.bind(event + ':delete', function(model) {
                    self.remove(model[idAttribute]);
                });
            });
        },
        buildBackend: function(collection) {
                         console.log("buildingbackend2");
           var ready = new Promise();
           var options = collection.backend;
           if (!options) {
              options = collection.get('backend');
           }
           
           if (typeof options === 'string') {
               var name = options;
               var channel = undefined;
           } else {
               var name = options.name;
               var channel = options.channel;
           }

           var backend = {
               name: name,
               channel: channel,
               ready: function(callback) {
                   ready.then(callback);
               }
           };

           Backbone.io.connected.then(function(socket) {
              console.log("connected");
              console.log(backend);
               backend.socket = socket.of(name);

               console.log(name);
               console.log(backend.channel);
               console.log(socket);
               backend.socket.emit('listen', backend.channel, function(options) {
                  console.log("superconnected");
                   backend.options = options;

                   backend.socket.on('synced', function(method, resp) {
                       var event = backend.options.event;

                       collection.trigger(event, method, resp);
                       collection.trigger(event + ':' + method, resp);
                   });
                   
                   ready.resolve();
               });
           });
           
           return backend;
       }
    };
    
    Backbone.Model = (function(Parent) {
        // Override the parent constructor
        var Child = function() {
            if (this.backend) {
                this.backend = Mixins.buildBackend(this);
            }
            
            Parent.apply(this, arguments);
        };
        
        // Inherit everything else from the parent
        return inherits(Parent, Child, [Mixins]);
    })(Backbone.Model);

    // Helpers
    // ---------------

    function inherits(Parent, Child, mixins) {
        var Func = function() {};
        Func.prototype = Parent.prototype;

        mixins || (mixins = [])
        _.each(mixins, function(mixin) {
            _.extend(Func.prototype, mixin);
        });

        Child.prototype = new Func();
        Child.prototype.constructor = Child;

        return _.extend(Child, Parent);
    };
    
    /*
    function buildBackend(collection) {
        var ready = new Promise();
        var options = collection.backend;
        
        if (typeof options === 'string') {
            var name = options;
            var channel = undefined;
        } else {
            var name = options.name;
            var channel = options.channel;
        }

        var backend = {
            name: name,
            channel: channel,
            ready: function(callback) {
                ready.then(callback);
            }
        };

        Backbone.io.connected.then(function(socket) {
            backend.socket = socket.of(name);

            backend.socket.emit('listen', backend.channel, function(options) {
                backend.options = options;

                backend.socket.on('synced', function(method, resp) {
                    var event = backend.options.event;

                    collection.trigger(event, method, resp);
                    collection.trigger(event + ':' + method, resp);
                });
                
                ready.resolve();
            });
        });
        
        return backend;
    };
    */

    function Promise(context) {
        this.context = context || this;
        this.callbacks = [];
        this.resolved = undefined;
    };

    Promise.prototype.then = function(callback) {
        if (this.resolved !== undefined) {
            callback.apply(this.context, this.resolved);
        } else {
            this.callbacks.push(callback);
        }
    };

    Promise.prototype.resolve = function() {
        if (this.resolved) throw new Error('Promise already resolved');

        var self = this;
        this.resolved = arguments;

        _.each(this.callbacks, function(callback) {
            callback.apply(self.context, self.resolved);
        });
    };

})();
