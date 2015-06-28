Package.describe({
    summary: 'Audio recording and playing. Captures microphone and streaming to meteor server. wav ogg mp3',
    name: 'universe:audio-recorder',
    version: '1.0.0'
});

Npm.depends({
    binaryjs: '0.2.1',
    wav: '1.0.0',
    shelljs: '0.5.0'
});

Package.onUse(function (api) {
    api.versionsFrom(['METEOR@1.1.0.2']);
    api.use(['underscore', 'vazco:universe-collection@1.2.2']);
    api.use(['tracker'], 'client');
    //In future, we add default route for flow router
    api.use('iron:router@1.0.7 || 0.9.4', ['client', 'server']);

    api.addFiles(['UniRecorder.js'], ['client', 'server']);
    api.addFiles(['client/binary.js', 'client/recording.js', 'client/playing.js', 'client/player.js'], 'client');
    api.addFiles(['server/convert.js', 'server/saveAudio.js', 'server/getRecord.js'], 'server');

    api.export('UniRecorder');
});
