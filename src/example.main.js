
const engine = require('engine.system');

module.exports.loop = function () {
    // removing (not registering) a feature will also clear its memory
    // add more features here...
    engine.registerFeature("sample", {
        // optionally set feature parameters
        INITIAL_COUNTER: 500
    });
    // call engine.run(true) to enable profiler
    engine.run();
};
