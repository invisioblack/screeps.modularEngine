
let mod = {};
module.exports = mod;

// installer.inject keeps overridden functions in module.baseOf['<namespace>']['<functionName>']
const KEEP_OVERRIDEN_BASE_FUNCTION = false;
// allow to run features with missing dependencies
const TRY_RUN_MISSING_DEPENDENCIES = true;
// consider curent node bad when profiler wrap takes more than this amount of cpu
const BAD_NODE_CPU = 5;

const profiler = require('engine.profiler');
const memory = require('engine.memory');

// DEPLOYMENT will be set during grunt deployment in /dist only
mod.DEPLOYMENT = 0;

let features = [];
let settings = {};

function Feature(name, setting){
    let that = this;
    this.name = name;
    this.settings = setting;
    this.files = {};
    this.requiresMemory = false;
    this.memory = null;
    this.logScopes = null;  
    // additional partitions
    this.memoryPartitions = [];

    this.setContext = function(){
        global.context = that;
    };
    this.releaseContext = function(){
        global.context = null;
    };
    this.load = function(file){
        this.files[file] = require(`features.${this.name}.${file}`);
        return this.files[file];
    };
    this.inject = function(base, file) {
        let alien = require(`features.${this.name}.${file}`);
        let keys = _.keys(alien);
        for (const key of keys) {
            if (typeof alien[key] === "function") {
                /*
                if( namespace ){
                    let original = base[key];
                    if( !base.baseOf ) base.baseOf = {};
                    if( !base.baseOf[this.name] ) base.baseOf[this.name] = {};
                    if( !base.baseOf[this.name][key] ) base.baseOf[this.name][key] = original;
                }
                */
                base[key] = alien[key].bind(base);
            } else {
                base[key] = alien[key];
            }
        }
        if( alien.extend !== undefined && typeof alien.extend === "function" ){
            base.extend();
        }
    };
    this.flush = new LiteEvent(false);
    this.flush.preCall = this.setContext;
    this.flush.postCall = this.releaseContext;
    this.initialize = new LiteEvent(false);
    this.initialize.preCall = this.setContext;
    this.initialize.postCall = this.releaseContext;
    this.analyze = new LiteEvent(false);
    this.analyze.preCall = this.setContext;
    this.analyze.postCall = this.releaseContext;
    this.execute = new LiteEvent(false);
    this.execute.preCall = this.setContext;
    this.execute.postCall = this.releaseContext;
    this.cleanup = new LiteEvent(false);
    this.cleanup.preCall = this.setContext;
    this.cleanup.postCall = this.releaseContext;
    this.initMemory = function(){
        if( this.requiresMemory === true ){
            this.memory = memory.get(name);
        }
        this.memoryPartitions.forEach(m => memory.get(m));
    };
    this.saveMemory = function(){
        if( this.requiresMemory === true ){
            memory.set(name);
        }        
        this.memoryPartitions.forEach(m => memory.set(m));
    };
    this.defaultValue = function(parameter, value){
        if( this.settings[parameter] === undefined ) 
            this.settings[parameter] = value;
    };
};

const globalExtension = {
    CRAYON: {
        error: '#e79da7',
        warning: { color: 'yellow' }, 
        ok: { color: 'green', 'font-weight': 'bold' },
        information: '#82a1d6',
        verbose: '#999',
        system: { color: '#999', 'font-size': '10px' },
        death: { color: 'black', 'font-weight': 'bold' },
        birth: '#e6de99',
    },
    SEVERITY: {
        none: 0,
        error: 1, 
        warning: 2, 
        ok: 3, 
        information: 4,
        verbose: 5
    },
    LOG_SCOPE: {
        none: {severity: 'verbose', promptSign: '#999'}, // gray
        core: {severity: 'information', promptSign: 'red'}, 
        military: {severity: 'information', promptSign: 'black'}, 
        PathFinding: {severity: 'information', promptSign: '#e6de99'}, // light yellow
        RoadConstruction: {severity: 'information', promptSign: 'yellow'}, 
        market: {severity: 'information', promptSign: 'orange'}, 
        census: {severity: 'warning', promptSign: '#82a1d6'}, // light blue
        remoteMining: {severity: 'information', promptSign: '#006400'}, // dark green
        CreepAction: {severity: 'information', promptSign: '#fff'}, // white
        Memory: {severity: 'information', promptSign: 'firebrick'}, // red
    },
    isObj: function(val){
        if (val === null) { return false;}
        return ( (typeof val === 'function') || (typeof val === 'object') );
    },
    // used to log something meaningful instead of numbers
    translateErrorCode: function(code){
        let codes = {
            0: 'OK',
            1: 'ERR_NOT_OWNER',
            2: 'ERR_NO_PATH',
            3: 'ERR_NAME_EXISTS',
            4: 'ERR_BUSY',
            5: 'ERR_NOT_FOUND',
            6: 'ERR_NOT_ENOUGH_RESOURCES',
            7: 'ERR_INVALID_TARGET',
            8: 'ERR_FULL',
            9: 'ERR_NOT_IN_RANGE',
            10: 'ERR_INVALID_ARGS',
            11: 'ERR_TIRED',
            12: 'ERR_NO_BODYPART',
            14: 'ERR_RCL_NOT_ENOUGH',
            15: 'ERR_GCL_NOT_ENOUGH'};
        return codes[code*-1];
    },
    dye: function(style, text){
        if( isObj(style) ) {
            let css = "";
            let format = key => css += key + ":" + style[key] + ";";
            _.forEach(Object.keys(style), format);
            return('<font style="' + css + '">' + text + '</font>');
        }
        if( style )
            return('<font style="color:' + style + '">' + text + '</font>');
        else return text;
    },
    roomLink: function(room, crayon){
        let name = ( room instanceof Room ) ? room.name : room;
        if( crayon ) return dye(crayon, `<a href="/a/#!/room/${name}">${dye(crayon, name)}</a>`);
        else return `<a href="/a/#!/room/${name}">${name}</a>`;
    },
    objToString: function(obj){
        if( !obj ) return "null";
        return JSON.stringify(obj)
            .replace(/"/g,'')
            .replace(/{/g,'<div style="margin-left: 20px;">')
            .replace(/},|}/g,'</div>')
            .replace(/,/g,',<br/>');
    },
    // base class for events
    // if (collect), triggers will not call handlers immediately but upon release() instead
    LiteEvent: function(collect = true) {
        // registered subscribers
        this.handlers = [];
        // collected calls
        this.triggers = [];
        // additional routine before calling handlers
        this.preCall = null;
        // additional routine after calling handlers
        this.postCall = null;
        // register a new subscriber
        this.on = function(handler) {
            this.handlers.push(handler);
        };
        // remove a registered subscriber
        this.off = function(handler) {
            this.handlers = this.handlers.filter(h => h !== handler);
        };
        // call all registered subscribers
        this.trigger = function(data) {
            if( collect ) this.triggers.push(data == null ? 'nullEvent' : data);
            else this.call(data);
        };
        this.call = function(data){
            if( this.preCall != null ) this.preCall();
            try{
                if( data === 'nullEvent' ) data = null;
                this.handlers.slice(0).forEach(h => h(data));
            } catch(e){
                log('Error in LiteEvent.trigger!', {
                    scope: 'core', 
                    severity: 'error'
                }, e);
            }
            if( this.postCall != null ) this.postCall();
        };
        this.release = function(collectAgain = false){
            collect = collectAgain;
            let that = this;
            this.triggers.forEach(d => that.call(d));
            let response = this.triggers;
            this.triggers = [];
            return response;
        };
    },
    // options: {severity, scope, crayon}
    log: function(text, options, data){
        if( !options ) options = {};
        options.scope = options.scope || 'none';
        options.severity = options.severity || 'none';
        let logConfig = LOG_SCOPE[options.scope] || LOG_SCOPE.none;
        if( global.context && global.context.logScopes && global.context.logScopes[options.scope] )
            _.assign(logConfig, global.context.logScopes[options.scope]);
        let configSeverityValue = SEVERITY[logConfig.severity] || 5;
        let severityValue = SEVERITY[options.severity] || 0;
        if( severityValue <= configSeverityValue ){
            let crayon = options.crayon ? options.crayon : CRAYON[options.severity];
            let promptSignColor = logConfig.promptSign;
            if(crayon) text = dye(crayon, text);
            if( data != null ){
                text += '</br>';
                let subText = null;
                if( data instanceof Error ) {
                } else if (typeof data === 'number' ) {
                    let error = translateErrorCode(data);
                    if( error ) subText = error;
                    else subText = data;
                } else if (typeof data === 'string' ) {
                    subText = data;
                } else {
                    subText = objToString(data);
                }
                if( subText != null ) text += dye(CRAYON.verbose, subText);
            }
            let promptSign = dye(promptSignColor, '&gt;');
            if( options.roomName ) {
                console.log( roomLink(options.roomName, CRAYON.system), promptSign, "<div style='display:inline-block;vertical-align:top;white-space:normal;'>", text, "</div>");
            }
            else console.log( promptSign, "<div style='display:inline-block;vertical-align:top;white-space:normal;'>", text, "</div>" );
            if( data instanceof Error ) {
                console.log(data.stack);
                Game.notify(text);
                Game.notify(data.stack);
            }
        }
    }
};

const system = {
    bootstrap(enableProfiler){
        global.state = {};
        const startCpu = Game.cpu.getUsed();
        global.state.isBadNode = startCpu > BAD_NODE_CPU;
        global.state.isNewNode = global.cacheTime !== (Game.time-1) || global.lastNodeSwitch === undefined;
        global.state.bucketLevel = Game.cpu.bucket == null ? 1 : Game.cpu.bucket / 10000;
        const requiresInstall = global.installedVersion !== mod.DEPLOYMENT;
        global.cacheTime = Game.time;
        if( global.state.isNewNode ) global.lastNodeSwitch = Game.time;
        let isNewDeployment = false;

        // load modules
        if( requiresInstall ){
            let systemSegment = RawMemory.segments[0];
            if( systemSegment != null && systemSegment.length !== 0 ) global.system = JSON.parse(systemSegment);
            isNewDeployment = global.system == null || global.system.version !== mod.DEPLOYMENT;

            if( isNewDeployment ){
                if( global.system == null ) global.system = {};
                global.system.version = mod.DEPLOYMENT;
                global.sysMemUpdate = true;
                console.log(`<span style="color:green;font-weight:bold">v${mod.DEPLOYMENT} arrived!</span>`);
            }

            _.assign(global, globalExtension);
            global.feature = {};
            features.forEach(this.installFeature);
            global.installedVersion = mod.DEPLOYMENT;
        }
        // setup memory
        memory.init();
        _.invoke(global.feature, 'initMemory');
        let active = [0,2]; // 0 = system, 1 = profiler, 2 = commandBuffer
        if( enableProfiler ) active.push(1);
        RawMemory.setActiveSegments(active); 
    },
    shutdown(enableProfiler){
        // execute buffered command
        const command = RawMemory.segments[2];
        if(command != null && command !== '') {
            try{
                console.log('Executing buffered command<br>', command);
                console.log(eval(command));
            }catch(e){
                console.log(e);
            }
            RawMemory.segments[2] = '';
        }

        _.invoke(global.feature, 'saveMemory');
        memory.save();

        if( global.sysMemUpdate === true ) {
            if( global.system == null ) RawMemory.segments[0] = '';
            else RawMemory.segments[0] = JSON.stringify(global.system);
            global.sysMemUpdate = false;
        }
        if( enableProfiler ) profiler.save();
    },
    installFeature(name){
        let featureIndex;
        try{
            featureIndex = require(`features.${name}.index`);
        } catch(e) {
            if( e.message && e.message.indexOf('Unknown module') > -1 ){
                log(`Unable to find feature index file for "${name}"!`, {
                    severity: 'error', 
                    scope: 'core'
                });
            } else {
                log(`Error loading feature index "${name}"!`, {
                    severity: 'error', 
                    scope: 'core'
                }, e);
            }
            featureIndex = null;
        }

        if( featureIndex.dependencies != null ){
            const notRegistered = f => !features.includes(f);
            const missing = featureIndex.dependencies.find(notRegistered);
            if( missing != null && missing.length !== 0  ){
                log(`Feature "${name}" has missing dependencies!`, {
                    severity: 'warning', 
                    scope: 'core'
                }, missing);
                if( TRY_RUN_MISSING_DEPENDENCIES !== true ) return;
            }
        }

        if( featureIndex != null && featureIndex.install != null ){
            const feature = new Feature(name, settings[name]);
            feature.setContext();
            try{
                featureIndex.install();
                global.feature[name] = feature;
            }catch(e) {
                log(`Error installing feature "${name}"!`, {
                    severity: 'error', 
                    scope: 'core'
                }, e);
            }
            feature.releaseContext();
        }
    }
};

mod.registerFeature = function(name, setting){
    features.push(name);
    settings[name] = setting || {};
};
mod.run = function(enableProfiler = false){
    if( enableProfiler ) profiler.enable();
    profiler.wrap(function() {
        system.bootstrap(enableProfiler);
        _.forEach(global.feature, f => f.flush.trigger());
        _.forEach(global.feature, f => f.initialize.trigger());
        _.forEach(global.feature, f => f.analyze.trigger());
        let limit = global.state.isBadNode ? 0.8 : 0.3;
        if( global.state.bucketLevel > limit )
            _.forEach(global.feature, f => f.execute.trigger());
        else{
            log('Skipping execution phase!', {
                scope: 'core', 
                severity: 'warning'
            }, global.state);
        }
        _.forEach(global.feature, f => f.cleanup.trigger());
        global.context = null;
        system.shutdown(enableProfiler);
    });
};
