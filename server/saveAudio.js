'use strict';
//all instances
UniRecorder._serversOnPorts = {};
//Binary socket
var BinaryServer = Npm.require('binaryjs').BinaryServer;

var wav = Npm.require('wav');
var fs = Npm.require('fs') ;
var os = Npm.require('os');
var path = Npm.require('path');
var Fiber = Npm.require('fibers');

UniRecorder.prototype._createServer = function() {
    if(UniRecorder._serversOnPorts[this._socketPort]){
        throw new Meteor.Error('Port '+this._socketPort+' is in used by other instance of UniRecorder');
    }
    var uniRec = this;
    this._server = BinaryServer({port: this._socketPort});
    this._server.on('connection', function (client) {
        var filePath, fileWriter = null, metaInfo = null;

        var onStream = Fiber(function(data){
            var stream = data.stream;
            var meta = data.meta;
            metaInfo = meta;
            if (checkAccess(meta)) {
                filePath = path.join(os.tmpDir(), meta._id + '.wav');
                console.log('UAR: stream to file:', filePath);
                var fileWriter = new wav.FileWriter(filePath, {
                    channels: 1,
                    sampleRate: meta._sampleRate,
                    bitDepth: 16
                });
                stream.pipe(fileWriter);
                var onEnd = Fiber(function () {
                    fileWriter.end();
                    setStatus(meta._collectionName, meta._id, UniRecorder.STATUS_UPLOADED, filePath);
                    saveToTarget(filePath, meta._id, meta._collectionName);

                });
                stream.on('end', function(){
                    onEnd.run();
                });
            } else{
                console.error('UAR: Access deny for recorder id: ', meta._id);
            }
        });
        client.on('stream', function(stream, meta){
            onStream.run({stream: stream, meta: meta});
        });
        var onClose = Fiber(function () {
            console.warn('UAR: Disconnected from client:', filePath);
            if (fileWriter != null) {
                fileWriter.end();
                setStatus(metaInfo._collectionName, metaInfo._id, UniRecorder.STATUS_UPLOADED, filePath, 'Disconnected');
                saveToTarget(filePath, metaInfo._id, metaInfo._collectionName);
            }
        });
        client.on('close', function(){
            onClose.run();
        });

        var onError = Fiber(function (e) {
            if (fileWriter != null) {
                console.warn('UAR: binary socket terror', e, filePath);
                fileWriter.end();
                setStatus(metaInfo._collectionName, metaInfo._id, UniRecorder.STATUS_ERROR, filePath);
            }
        });

        client.on('error', function(e){
            onError.run(e);
        });

        var setStatus = function (collectionName, id, status, pathToFile, message) {
                var coll = UniCollection._uniCollections[collectionName];
                if (coll || status) {
                    var mod = {$set:{status: status}};
                    if (pathToFile) {
                        if(status !== UniRecorder.STATUS_DONE){
                            mod.$set.path = pathToFile;
                        } else {
                            var stat = fs.statSync(pathToFile);
                            if(stat){
                                mod.$set.size = stat.size;
                            }
                        }
                        mod.$set.extName = path.extname(pathToFile);
                        if(mod.$set.extName[0] === '.'){
                            mod.$set.extName = mod.$set.extName.slice(1);
                        }
                    }
                    if(message){
                        mod.$set.logMessage = message;
                    }
                    if(status === UniRecorder.STATUS_DONE){
                        //removing unused write token and temporary path
                        mod.$unset = {_writeToken: '', path: ''};
                    }
                    coll.update(id, mod, function (err) {
                        if (err) {
                            console.error(err.message || err);
                        }
                    });
                }
                metaInfo = null;
        };

        var checkAccess = function (meta) {
                var coll = UniCollection._uniCollections[meta._collectionName];
                if (coll && meta._id && meta._token) {
                        var res = coll.findOne({_id: meta._id, _writeToken: meta._token}, {fields: {_id: 1}});
                        return res;
                }

            return false;
        };

        var saveToTarget = function(pathToFile, id, collName){
                var newPath = UniRecorder.getStorageFullPath(uniRec._targetStorage, collName, id);
                try {
                    if(uniRec._targetFileFormat === 'wav'){
                        newPath += '.wav';
                        fs.renameSync(pathToFile, newPath);
                        setStatus(collName, id, UniRecorder.STATUS_DONE, newPath);
                        console.log('UAR: Done. ', newPath);
                    } else{
                        newPath += '.'+uniRec._targetFileFormat;
                        UniRecorder._convertSync(pathToFile, newPath, uniRec._targetFileFormat,function(err, log){
                            Fiber(function(){
                                if(err){
                                   return setStatus(collName, id, UniRecorder.STATUS_ERROR, null, log);
                                }
                                setStatus(collName, id, UniRecorder.STATUS_DONE, newPath, log);
                                fs.unlink(pathToFile, function (ero) {
                                    if (ero){
                                        console.error(ero.message);
                                    }
                                });
                            }).run();
                        });

                    }

                } catch(e){
                    console.error(e.message || e);
                    setStatus(collName, id, UniRecorder.STATUS_ERROR, null, e.message);
                }
        };

    });

};


// inspired of the collection fs
UniRecorder.getStorageFullPath = function(pathname, collName, name){
    if (!pathname && __meteor_bootstrap__ && __meteor_bootstrap__.serverDir) {
        pathname = path.join(__meteor_bootstrap__.serverDir, '../../../uniRecorder/'+collName+'/' + name);
    }

    // Check if we have '~/foo/bar'
    if (pathname.split(path.sep)[0] === '~') {
        var homepath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
        if (homepath) {
            pathname = pathname.replace('~', homepath);
        } else {
            throw new Error('UniRecorder unable to resolve "~" in path');
        }
    }
    var dirPath = path.dirname(pathname);
    var birPath = path.dirname(dirPath);
    if (!fs.existsSync(birPath)){
        fs.mkdirSync(birPath);
    }
    if (!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath);
    }
    return pathname;
};

