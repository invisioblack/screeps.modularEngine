
// Every feature must have an index.js at root, exporting an install() function

let mod = {};
module.exports = mod;

// other required features (names) to get this one running
mod.dependencies = [];

// configuration & load modules
mod.install = function(){
    // will create a dedicated memory partition utilizing RawMemory. See helloWorld.js for usage.
    context.requiresMemory = true;
    // You can specify additional memory partitions, using context.memoryPartitions
    // context.memoryPartitions = ['someName1'];
    // Those partitions are accessible using global.partition['someName1']

    // setting parameter default values (may get overridden in main.js feature registration)
    context.defaultValue('INITIAL_COUNTER', 0);

    // context log scopes will be merged (only when logging from within the feature) with global log scope configuration
    // in this sample we are extending logging severity for 'census' log-context to 'verbose' (global is set to 'warning')
    context.logScopes = {
        census: {severity: 'verbose'}
    };
    // load hello world sample feature module
    context.load('helloWorld');

    // You can call context.inject(base, file) to extend game objects. 
    // if the overriding module exports an extend() function, it will be called automatically
    // context.inject(Room, 'extension.room');
};
