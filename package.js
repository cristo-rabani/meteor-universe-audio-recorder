Package.describe({
    summary: 'Meteor-based audio recording for modern web-browsers. Captures microphone and streaming it to server',
    name: 'vazco:universe-audio-recorder',
    version: '0.0.1'
});

Npm.depends({
    binaryjs: "0.2.1",
    wav: "1.0.0"
});

Package.on_use(function (api) {
    api.versionsFrom(['METEOR@1.1.0.2']);
    api.use(['cfs:file@0.1.15'], 'server');
    api.use(['vazco:universe-collection@1.2.2']);
    api.use(['tracker'], 'client');
    api.add_files('both.js', ['client', 'server']);
    api.add_files(['client/binary.js', 'client/index.js'], 'client');
    api.add_files('server.js', 'server');
    api.export('UniRecorder');
});
