'use strict';

/* global UniRecorder: true */
/**
 * Collection with recording and playing support
 * @param options {{name, socketHost, socketPort, bufferSize, targetFileFormat, serverDirectoryPath}}
 * @returns {UniRecorder}
 * @constructor
 */
UniRecorder = function(options){
    options = options || {};
    if (!(this instanceof UniRecorder)) return new UniRecorder(options);
    this._socketHost = options.socketHost || (Meteor.isClient ? location.hostname: 'localhost');
    this._socketPort = parseInt(options.socketPort || 8998);
    this._socketSSLPort = parseInt(options.socketSSLPort || 0);
    this._bufferSize = parseInt(options.bufferSize || 4096);
    this._targetFileFormat = (_.contains(['ogg','mp3'], options.targetFileFormat)? options.targetFileFormat : 'wav');
    this._targetStorage = options.serverDirectoryPath;
    var name = options.name || 'uniRecorder';
    if(UniRecorder._collections[name]){
        throw new Error('UniRecorder already exists under name:'+name);
    }
    this._collection = new UniCollection(name);
    this._collection.setDocumentPrototype(UniAudioRecord);
    var self = this;
    this._collection.helpers({getUniRecorderInstance: function(){return self}});

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
    UniRecorder._collections[name] = this;
    this._allowDownload = [];
    this._denyDownload =[];
};

UniRecorder._collections = {};

UniRecorder.prototype.allow = function(perm){
    if(_.isObject(perm) && perm.download){
        this._allowDownload.push(perm.download);
        delete perm.download;
    }
    this._collection.allow(perm);
};

UniRecorder.prototype.deny = function(perm){
    if(_.isObject(perm) && perm.download){
        this._denyDownload.push(perm.download);
        delete perm.download;
    }
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

UniRecorder.prototype.canDownload = function(token, audioDoc){
    if(this._denyDownload){
        if(_.some(this._denyDownload, function(fn){ return fn(token, audioDoc);})){
            return false;
        }
    }
    if(this._allowDownload){
        return _.some(this._allowDownload, function(fn){ return fn(token, audioDoc);});
    }
    return false;
};

UniRecorder.STATUS_UPLOADED = 200;
UniRecorder.STATUS_DONE = 0;
UniRecorder.STATUS_ERROR = 400;
UniRecorder.STATUS_RECORDING = 100;


var UniAudioRecord = UniCollection.UniDoc.extend();

UniAudioRecord.prototype.getName = function () {
    return this.name || 'uar_' + this._id;
};

UniAudioRecord.prototype.isDone = function () {
    return this.status === UniRecorder.STATUS_DONE;
};

UniAudioRecord.prototype.isUploaded = function () {
    return this.status === UniRecorder.STATUS_UPLOADED;
};

UniAudioRecord.prototype.inRecordingProcess = function () {
    return this.status === UniRecorder.STATUS_RECORDING;
};

UniAudioRecord.prototype.isError = function () {
    return this.status === UniRecorder.STATUS_ERROR;
};

UniAudioRecord.prototype.getURL = function (token) {
    if(this.isDone()){
        token = token || this.readToken;
        if(!token && Meteor.isClient){
            var user = UniUsers.getLoggedInId();
            token = user && UniUtils.get(user, 'readTokens.'+this._id);
        }
        token = token || 'public';

        return Meteor.absoluteUrl('audiorecords/get/'+this.getCollectionName()+'/'+this._id+'/'+token, {
            secure: /^https:\/\//i.test(window.location.href)
        });
    }
};

if(Meteor.isServer){
    UniAudioRecord.prototype.getAbsolutePath = function(){
        return UniRecorder.getStorageFullPath(
            this.getUniRecorderInstance()._targetStorage,
            this.getCollectionName(),
            this._id +'.'+ (this.extName || 'wav')
        );
    };
}

UniRecorder.UniAudioRecord = UniAudioRecord;
