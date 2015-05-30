'use strict';

//Audio
var session = {
    audio: true,
    video: false
};
window.URL = window.URL || window.webkitURL;
navigator.getUserMedia = navigator.getUserMedia ||
navigator.webkitGetUserMedia ||
navigator.mozGetUserMedia ||
navigator.msGetUserMedia;

UniRecorder.prototype.isRecordingSupported = function(){
    return !!navigator.getUserMedia;
};

UniRecorder.prototype.ready = function(){
    if(!this.isRecordingSupported()){
        return false;
    }
    if(!this._readyDeps){
        this._readyDeps = new Tracker.Dependency;
    }
    this._readyDeps.depend();
    return this._isInUse;
};

UniRecorder.prototype._done = function(err, res){
    this._isInUse = false;
    this._cb = (this._cb && _.isFunction(this._cb))? this._cb : function(err){ err && console.error(err); };
    this._cb(err, res);
    this._cb = undefined;
    if(this._stream){
        this._stream.end();
        this._stream = null;
    }
    if(this._recorder){
        this._recorder.onaudioprocess = null;
    }
    if(this._audioStream){ this._audioStream.stop(); }
    if(this._audioInput) { this._audioInput.disconnect() }
    this._readyDeps && this._readyDeps.changed();
};

UniRecorder.prototype.start = function(meta, cb){
    if (!this.isRecordingSupported) {
        throw new Error('getUserMedia not supported');
    }
    meta = meta || {};
    if(_.isFunction(cb)){
        this._cb = cb;
    }
    if(this._isInUse){
        throw new Error('UniRecorder in use!');
    }
    this._isInUse = true;
    this._lastId = undefined;
    var uniRec = this;
    var token = _.random(1000000000, 9999999999999999).toString(36);
    var defaultData = {ownerId: Meteor.userId(), _writeToken: token, createdAt: new Date()};
    this._collection.insert(_.extend(meta, defaultData), function(err, id){
        if(err){
            return uniRec._done(err);
        }
        navigator.getUserMedia(session, function (streamAudio) {
            var client = new BinaryClient('ws://'+uniRec._socketHost+':'+uniRec._socketPort);
            var audioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;
            var context = new audioContext();
            var audioInput = context.createMediaStreamSource(streamAudio);
            // create a javascript node ///createJavaScriptNode
            var recorder = context.createScriptProcessor(uniRec._bufferSize, 1, 1);
            uniRec._audioStream = streamAudio;
            client.on('open', function() {
                uniRec._lastId = id;
                var streamSoc = client.createStream({
                    _sampleRate: audioInput.context.sampleRate,
                    _token: token,
                    _id: id,
                    _collectionName: uniRec._collection._name
                });
                // specify the processing function
                recorder.onaudioprocess = function(e) {
                    var left = e.inputBuffer.getChannelData(0);
                    streamSoc.write(convertFloat32ToInt16(left));
                };
                // connect stream to our recorder
                audioInput.connect(recorder);
                // connect our recorder to the previous destination
                recorder.connect(context.destination);
                uniRec._audioInput = audioInput;
                uniRec._recorder = recorder;
                uniRec._stream = streamSoc;
                uniRec._readyDeps && uniRec._readyDeps.changed();
            });

        }, uniRec._done);
    });

};

UniRecorder.prototype.stop = function(){
    if(this._isInUse){
        this._done(null, this._lastId);
    }
};

var _l, _buf;
function convertFloat32ToInt16(buffer) {
    _l = buffer.length;
    _buf = new Int16Array(_l);
    while (_l--) {
        _buf[_l] = Math.min(1, buffer[_l])*0x7FFF;
    }
    return _buf.buffer;
}

