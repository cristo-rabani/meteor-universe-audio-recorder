'use strict';

/* global UniRecorder: true */
UniRecorder = function(options){
    options = options || {};
    if (!(this instanceof UniRecorder)) return new UniRecorder(options);
    this._socketHost = options.socketHost || (Meteor.isClient ? location.hostname: 'localhost');
    this._socketPort = parseInt(options.socketPort || 8998);
    this._bufferSize = parseInt(options.bufferSize || 4096);
    this._targetStorage = /*options.collectionFS ||*/ options.serverDirectoryPath;
    this._collection = new UniCollection(options.name || 'uniRecorder');
    this.allow({
        insert: function(userId){
            return !!userId;
        }
    });
    if(Meteor.isClient){
        var _done = this._done;
        this._done = _done.bind(this);
    } else {
        this._createServer();
    }
};

UniRecorder.prototype.allow = function(perm){
    this._collection.allow(perm);
};

UniRecorder.prototype.deny = function(perm){
    this._collection.deny(perm);
};
/**
 *
 * @param selector {object}
 * @param options {object}
 */
UniRecorder.prototype.find = function(selector, options){
    return this._collection.find.apply(this._collection, arguments);
};

UniRecorder.prototype.findOne = function(selector, options){
    return this._collection.findOne.apply(this._collection, arguments);
};

UniRecorder.prototype.getCollection = function(){
    return this._collection;
};

UniRecorder.STATUS_UPLOADED = 200;
UniRecorder.STATUS_DONE = 0;
UniRecorder.STATUS_ERROR = 400;
UniRecorder.STATUS_RECORDING = 100;
