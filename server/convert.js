'use strict';
var fs = Npm.require('fs');
var os = Npm.require('os');
var path = Npm.require('path');
var shell = Npm.require('shelljs');

console.log('======== Universe Audio Recorder ========');
if (!shell.which('sox') || shell.exec('sox --version').code !== 0) {
    console.warn('This package needs an cross-platform SoX utility, without SoX only .wav will be supported');
    console.warn('TIP: Install on ubuntu: sudo apt-get install sox');
} else {
    UniRecorder._isSox = true;
    UniRecorder._convertOnMultiThreaded = true;
    //Override an (incorrect) audio length given in an audio file’s header
    UniRecorder._convertIgnoreLength = true;
    UniRecorder._mp3Quality = 192;
    UniRecorder._oggQuality = 6;
    UniRecorder._soxVerbosityLevel = 3;
}

UniRecorder._convertSync = function(fromPath, toPath, toFormat, cb){
    cb = cb || function(){};
    if(!UniRecorder._isSox){
        var e = new Error('Missing sox!');
        e.code = 404;
        cb(e);
        return;
    }
    console.log('UAR: Start conversion to "'+toFormat+'", input: ', fromPath, ' output:', toPath);
    var quality = (toFormat === 'ogg'? UniRecorder._oggQuality : UniRecorder._mp3Quality);

    var parms = '-V'+(UniRecorder._soxVerbosityLevel ||  0)+' ';

    if(UniRecorder._convertOnMultiThreaded){
        parms += '--multi-threaded ';
    }

    if(UniRecorder._convertIgnoreLength){
        parms += '--ignore-length ';
    }

    shell.exec('sox '+parms+'--type wav \''+fromPath+'\' --compression '+quality+' --type '+toFormat+' \''+toPath+'\'',
        function(code, output){
            if(code !== 0){
                console.error('UAR: Error '+code+' while converting file: ', fromPath);
                console.error(output);
                var e = new Error(output);
                e.code = code;
                return cb(e);
            }
            cb(null, output);
    });


};
