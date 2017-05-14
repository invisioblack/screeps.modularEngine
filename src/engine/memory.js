
let mod = {};
module.exports = mod;

const SPLITTER = '³';

let rawPartitions = [];
global.partition = {};
let allNames = [];
let used = [];

function trimName(name){
    if( name != null && name.length > 10 ) return name.substr(0, 10);
    return name;
};

function initialize(raw, index) {
    const name = raw.substr(0,10).trim();
    if( name === '' ) return;
    allNames.push(name);
    const persistedTick = parseInt(raw.substr(10,10));

    if( global.partition[name] == null || global.partition[name].tick != persistedTick ){
        log(`Loading memory partition ${name}!`, {
            severity: 'verbose', 
            scope: 'Memory'
        });
        global.partition[name] = new Partition(index, name, persistedTick, raw.length);
    } // else keep existing instance
    else {
        global.partition[name].index = index;
    }
    return name;
};

function newPartition(name){
    log(`Setting up new memory partition ${name}!`, {
        severity: 'information', 
        scope: 'Memory', 
    });
    const index = rawPartitions.length;
    rawPartitions.push('{}');
    global.partition[name] = new Partition(index, name, Game.time, 0);
    global.partition[name].changed = true;
    return global.partition[name];
};

function Partition(index, name, tick, size) {
    this.index = index;
    this.name = name;
    this.tick = tick;
    this.size = size;
    this.changed = false;
    let _loaded = false;
    let _data = null;

    function load(){
        let deserialized = mod.deserialize(rawPartitions[index]);
        if( deserialized === null )
            _data = {};
        else 
            _data = deserialized; //deserialized.data;
        _loaded = true;
    }
    
    Object.defineProperty(this, 'data', {
        configurable: true,
        get: function() {
            if( _loaded !== true ) load();
            return _data;
        },
        set: function(value) {
            _data = value;
            this.changed = true;
        }
    });

    this.set = function(handler){
        if( _loaded !== true ) load();
        handler(_data);
        this.changed = true;
    };    
    this.getObject = function(key, createIfNull = true){
        if( _loaded !== true ) load();
        if( _data[key] == null && createIfNull ){
            _data[key] = {};
            this.changed = true;
        }
        return _data[key];
    };
    this.setObject = function(key, value){
        if( _loaded !== true ) load();
        _data[key] = value;
        this.changed = true;
    };
};

function cleanUp(name){
    if(used.includes(name) === false){
        // delete partition
        let partition = global.partition[name];
        if( partition != null ){
            log(`Removing memory partition ${name}!`, {
                severity: 'information', 
                scope: 'Memory', 
            });
            rawPartitions.splice(partition.index,1);
            delete global.partition[name];
        }
    }
}

mod.deserialize = function(raw){
    try{
        if( raw != null && raw.length !== 0 ) {
            /*
            return {
                name: rawSegment.substr(0,10).trim(), 
                tick: rawSegment.substr(10,10).trim(), 
                data: rawSegment.length > 20 ? JSON.parse(rawSegment.substr(20)) : {}
            }
            */
            return raw.length > 20 ? JSON.parse(raw.substr(20)) : {};
        }
    }
    catch(e){
        log(`Error deserializing memory partition!`, {
            severity: 'error', 
            scope: 'Memory'
        }, e);
    }
    return null;
};

mod.serialize = function(partition){
    let serialized = null;
    try{
        const name = (partition.name + '          ').substr(0, 10);
        const tick = ('000000000' + partition.tick.toString()).slice(-10);
        const serializedData = JSON.stringify(partition.data);
        serialized = name + tick + serializedData;
    }
    catch(e){
        log(`Error serializing memory partition ${name}!`, {
            severity: 'error', 
            scope: 'Memory', 
        }, e);
    }
    return serialized;
};

mod.get = function(name){
    name = trimName(name);
    let partition = global.partition[name] || newPartition(name);
    used.push(name);
    return partition;
};

mod.set = function(name){
    name = trimName(name);

    let partition = global.partition[name];
    if( partition != null && partition.changed === true ){
        log(`Saving memory partition ${partition.name}!`, {
            severity: 'verbose', 
            scope: 'Memory', 
        }, {
            size: partition.size
        });
        partition.tick = Game.time;
        rawPartitions[partition.index] = mod.serialize(partition);
        partition.size = rawPartitions[partition.index].length;
        partition.changed = false;
    }
};

mod.init = function(){
    allNames = [];
    used = [];
    rawPartitions = RawMemory.get().split(SPLITTER);
    rawPartitions.forEach(initialize);
};

mod.save = function(){
    used.forEach(mod.set);
    allNames.forEach(cleanUp);

    if( used.length === 0 ) RawMemory.set(' ');
    else {
        RawMemory.set(rawPartitions.join(SPLITTER));
    }
};
