
// TODO: Create global status object (bucket level, bad node...)

// installer.inject keeps overridden functions in module.baseOf['<namespace>']['<functionName>']
const KEEP_OVERRIDEN_BASE_FUNCTION = false;
const BAD_NODE_CPU = 6;

let mod = {};
module.exports = mod;

const profiler = require('engine.profiler');
const memory = require('engine.memory');

const phase = {
    flush(elem){
        if(elem.flush !== undefined) elem.flush();
    },
    register(elem){
        if(elem.register !== undefined) elem.register();
    },
    analyze(elem){
        if(elem.analyze !== undefined) elem.analyze();
    },
    execute(elem){
        if(elem.execute !== undefined) elem.execute();
    },
    cleanup(elem){
        if(elem.cleanup !== undefined) elem.cleanup();
    },
};

const Feature = function(name){
    this.name = name;
    this.files = {};
    this.requiresMemory = false;
    this.memory = null;
    this.logScopes = null;
    this.load = function(file){
        this.files[file] = require(`features.${this.name}.${file}`);
    };
    this.flush = function(){
        global.currentContext = this;
        _.forEach(this.files, phase.flush);
    };
    this.register = function(){
        global.currentContext = this;
        _.forEach(this.files, phase.register);
    };
    this.analyze = function(){
        global.currentContext = this;
        _.forEach(this.files, phase.analyze);
    };
    this.execute = function(){
        global.currentContext = this;
        _.forEach(this.files, phase.execute);
    };
    this.cleanup = function(){
        global.currentContext = this;
        _.forEach(this.files, phase.cleanup);
    };
    this.initMemory = function(){
        if( this.requiresMemory === true ){
            this.memory = memory.get(name);
        }
    };
    this.saveMemory = function(){
        if( this.requiresMemory === true && feature.memory != null && feature.memory.changed === true ){
            memory.set(name);
        }
    };
};

const globalExtend = {
    CRAYON: {
        error: '#e79da7',
        warning: { color: 'yellow', 'font-weight': 'bold' },
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
            try{
                if( data === 'nullEvent' ) data = null;
                this.handlers.slice(0).forEach(h => h(data));
            } catch(e){
                console.log(`Error in LiteEvent.trigger ${data}`, e);
            }
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
        if( global.currentContext && global.currentContext.logScopes && global.currentContext.logScopes[options.scope] )
            _.assign(logConfig, global.currentContext.logScopes[options.scope]);
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
}

const system = {
    bootstrap(enableProfiler){
        const startCpu = Game.cpu.getUsed();
        const isBadNode = startCpu > BAD_NODE_CPU;
        const isNewServer = global.cacheTime !== (Game.time-1) || global.lastServerSwitch === undefined;
        const requiresInstall = global.installedVersion !== mod.DEPLOYMENT;
        global.cacheTime = Game.time;
        if( isNewServer ) global.lastServerSwitch = Game.time;
        let isNewDeployment = false;

        // load modules
        if( requiresInstall ){
            let systemSegment = RawMemory.segments[0];
            if( systemSegment != null && systemSegment.length !== 0 ) global.system = JSON.parse(systemSegment);
            isNewDeployment = global.system == null || global.system.version !== mod.DEPLOYMENT;

            if(isNewDeployment){
                if( global.system == null ) global.system = {};
                global.system.version = mod.DEPLOYMENT;
                global.sysMemUpdate = true;
            }

            _.assign(global, globalExtend);
            global.feature = {};
            mod.features.forEach(this.installFeature);
            global.installedVersion = mod.DEPLOYMENT;
        }

        if( isNewDeployment ) console.log(`<span style="color:green;font-weight:bold">v${mod.DEPLOYMENT} arrived!</span>`);

        // setup memory
        memory.init();
        _.invoke(global.feature, 'initMemory');
        let active = [0,2]; // 0 = modules, 1 = profiler, 2 = commandBuffer
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
                console.log(`Unable to find feature index file for "${name}"!`);
            } else {
                console.log(`Error loading feature index "${name}"!<br/>${e.toString()}`);
            }
            featureIndex = null;
        }
        if( featureIndex != null && featureIndex.install != null ){
            const feature = new Feature(name);
            try{
                featureIndex.install(feature);
                global.feature[name] = feature;
            }catch(e) {
                console.log(`Error installing feature "${name}"!<br/>${e.toString()}`);
            }
        }
    }
};

mod.features = [];
mod.registerFeature = function(name){
    mod.features.push(name);
};
mod.DEPLOYMENT = 0;
mod.run = function(enableProfiler = false){
    if( enableProfiler ) profiler.enable();
    profiler.wrap(function() {
        system.bootstrap(enableProfiler);
        _.forEach(global.feature, phase.flush);
        _.forEach(global.feature, phase.register);
        _.forEach(global.feature, phase.analyze);
        _.forEach(global.feature, phase.execute);
        _.forEach(global.feature, phase.cleanup);
        global.currentContext = null;
        system.shutdown(enableProfiler);
    });
};
