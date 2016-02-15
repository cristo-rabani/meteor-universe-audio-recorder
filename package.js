Package.describe({
    summary: 'Audio recording and playing. Captures microphone and streaming to meteor server. wav ogg mp3',
    name: 'universe:audio-recorder',
    version: '1.1.1'
});

Npm.depends({
    binaryjs: 'https://github.com/binaryjs/binaryjs/tarball/79f51d6431e32226ab16e1b17bf7048e9a7e8cd9',
    wav: '1.0.0',
    shelljs: '0.6.0'
});

Package.onUse(function (api) {
    api.versionsFrom(['METEOR@1.2']);
    api.use(['underscore', 'universe:utilities', 'universe:collection', 'webapp', 'ecmascript']);
    api.use(['tracker'], 'client');

    api.addFiles(['UniRecorder.js'], ['client', 'server']);
    api.addFiles(['.npm/package/node_modules/binaryjs/dist/binary.js', 'client/recording.js', 'client/playing.js', 'client/player.js'], 'client');
    api.addFiles(['server/convert.js', 'server/saveAudio.js', 'server/getRecord.js'], 'server');

    api.export('UniRecorder');
});
