'use strict';
UniRecorder._serversOnPorts = {};

var BinaryServer = Npm.require('binaryjs').BinaryServer;

var wav = Npm.require('wav');
var fs = Npm.require('fs') ;
var os = Npm.require('os');
var path = Npm.require('path');
var Fiber = Npm.require('fibers');
//var Future = Npm.require('fibers/future');

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
            console.log('stream', meta);
            if (checkAccess(meta)) {
                filePath = path.join(os.tmpDir(), meta._id + '.wav');
                console.log('stream to file', filePath);
                var fileWriter = new wav.FileWriter(filePath, {
                    channels: 1,
                    sampleRate: meta._sampleRate,
                    bitDepth: 16
                });
                stream.pipe(fileWriter);
                var onEnd = Fiber(function () {
                    console.warn('end', filePath);
                    fileWriter.end();
                    setStatus(meta._collectionName, meta._id, UniRecorder.STATUS_UPLOADED, filePath);
                    saveToTarget(filePath, meta._id, meta._collectionName);

                });
                stream.on('end', function(){
                    onEnd.run();
                });
            } else{
                console.error('access deny for recorder id: ', meta._id);
            }
        });
        client.on('stream', function(stream, meta){
            onStream.run({stream: stream, meta: meta});
        });
        //client.on('stream', function (stream, meta) {
        //    metaInfo = meta;
        //    console.log('stream', meta);
        //    if (checkAccess(meta)) {
        //        filePath = path.join(os.tmpDir(), meta._id + '.wav');
        //        console.log('stream to file', filePath);
        //        var fileWriter = new wav.FileWriter(filePath, {
        //            channels: 1,
        //            sampleRate: meta._sampleRate,
        //            bitDepth: 16
        //        });
        //        stream.pipe(fileWriter);
        //        stream.on('end', function () {
        //            console.warn('end', filePath);
        //            fileWriter.end();
        //            saveToTarget(filePath, meta._id, meta._collectionName);
        //            setStatus(meta._collectionName, meta._id, UniRecorder.STATUS_DONE, filePath);
        //        });
        //    } else{
        //        console.log('gggggggggggg');
        //    }
        //});
        var onClose = Fiber(function () {
            console.warn('close', filePath);
            if (fileWriter != null) {
                fileWriter.end();
                setStatus(metaInfo._collectionName, metaInfo._id, UniRecorder.STATUS_UPLOADED, filePath);
                saveToTarget(filePath, metaInfo._id, metaInfo._collectionName);
            }
        });
        client.on('close', function(){
            onClose.run();
        });

        var onError = Fiber(function (e) {
            if (fileWriter != null) {
                console.warn('error', e, filePath);
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
                    var mod = {status: status};
                    if (pathToFile) {
                        mod.path = pathToFile;
                    }
                    if(message){
                        mod.logMessage = message;
                    }
                    console.log('mod',mod);
                    coll.update(id, {$set: mod}, function (err, res) {
                        if (err) {
                            console.error(err.message || err);
                        }
                        if ((err || !res) && pathToFile) {
                            fs.unlink(pathToFile, function (err) {
                                console.warn(err);
                                filePath = null;
                            });
                        }
                    });
                }
                metaInfo = null;
        };

        var checkAccess = function (meta) {
                var coll = UniCollection._uniCollections[meta._collectionName];
                if (coll && meta._id && meta._token) {
                        var res = coll.findOne({_id: meta._id, _token: meta._token}, {fields: {_id: 1}});
                        console.log('f', res);
                        return res;
                }

            return false;
        };

        var saveToTarget = function(pathToFile, id, collName){
                var newPath = getStorageFullPath(uniRec._targetStorage, collName, id + '.wav');
                try {
                    fs.renameSync(pathToFile, newPath);
                    setStatus(collName, id, UniRecorder.STATUS_DONE, newPath);
                    console.log('newPath', newPath);
                } catch(e){
                    setStatus(collName, id, UniRecorder.STATUS_ERROR);
                }
            //if(_.isObject(uniRec._targetStorage)){
            //    var cfs = uniRec._targetStorage;
            //        var fileData = fs.readFileSync(pathToFile);
            //        var fsFile = new FS.File(pathToFile);
            //        var type = fsFile.original.type;
            //        fsFile.type = type;
            //        fsFile.metadata = {recordedDocId: id, recordedCollName: collName};
            //        fsFile.encoding = 'binary';
            //        cfs.insert(cfs);
            //}
        };
        //copy of logic from cfs
        var getStorageFullPath = function(pathname, collName, name){
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

    });


};

