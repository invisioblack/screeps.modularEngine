
// Sample feature
// Will log a dummy message each tick if bucket level > 50%

let mod = {};
module.exports = mod;

// copy locally to have at hand for later calls (from different feature context) (not required for this example...)
const INITIAL_COUNTER = context.settings.INITIAL_COUNTER;

function initialize(){
    // access feature memory using context.memory.getObject(key, createIfNull=true) 
    // omitting the second argument or setting to true will create an empty object {}, if 'key' is not found. setting false returns null instead.
    let tick = context.memory.getObject('tick', false); 
    if( tick == null ) tick = INITIAL_COUNTER;
    else tick++;
    // you need to call setObject to write back. 
    context.memory.setObject('tick', tick);
}
function execute(){
    // skip on low bucket
    if( global.state.bucketLevel > 0.5 ){ 
        // log is a custom log function. 
        // param 1: log text
        // param 2: Classification (scope & severity). Logging can be configured to show / don't show messages, regarding these values...
        // param 3: additional data to show below message. may be an object.
        log('Hello World!', {
            scope: 'census', 
            severity: 'verbose'
        }, context.memory.getObject('tick'));
    }
}

// register local functions to context events
context.initialize.on(initialize);
context.execute.on(execute);

// available events are (triggered in that order): 
// - flush
// - initialize
// - analyze
// - execute
// - cleanup
