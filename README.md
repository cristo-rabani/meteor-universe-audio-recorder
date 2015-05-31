# Universe Audio Recorder
This package provides API for recording and playing recorded sound.
All works as a collection and documents with special methods like collection.startRecording()
or doc.play() // Audio file is represented by document //

## Recorder

- Features
- - Live streaming voice from microphone to server via binary socket.
- - Supported target formats wav, ogg, mp3
- - Fully integrated with collection and the records are represented by documents
- - Any number of collections of audio records

###  Creation a recorder collection

```
    mySoundCollection = new UniRecorder({
        name: 'soundsCollection',
        targetFileFormat: 'ogg'
    });
```

Access management by allow/deny, but instead user you should check read token:

```
    mySoundCollection.allow({
        // download & play
        download: function(token, audioDoc) {
            return true;
        },
        update: function(userId, doc){
            return true;
        }
    });
```

You can make publication and subscription like for other collections.

New record:
```
    mySoundCollection.startRecording(metaData[, callback(err, id)]);
```

When you done, just call:

```
    mySoundCollection.stopRecording();
```

In this moment the server converts your streamed sound, and after that you will be can play it!

You must know that collection can recording one file at once.
To check if collection is ready you can use method:

```
    mySoundCollection.ready()
```

And this is reactive source of data.




If you want use feature conversion of records you must have installed SoX a command line utility.
Additionally if you want make a conversion to mp3, it requires also plugin or special version SoX with codecs for mp3, because mp3 isn't free

You can install SoX from linux packages:

```
sudo apt-get install sox

or

sudo yum install sox
```

but also Sox is available on Mac OS X and Windows


## Player audio

- Features
- - Support Web Audio API
- - Falls back to HTML5 Audio
- - Marking the ranges (offset + duration) and save it to future playing
- - Automatic caching for Web Audio API/HTML5 Audio
- - Global mute/unmute and volume control
- - Full integration of universe documents ( play, pause, stop on audio document )

### Methods on document

- getPlayerStatus ( reactive method ) returns value of (one of)
- - UniRecorder.PLAYER_UNLOADED
- - UniRecorder.PLAYER_PLAYING
- - UniRecorder.PLAYER_PAUSED
- - UniRecorder.PLAYER_STOPPED

- doc.initPlayer(parameters, callback)
- - initialize parameters
- - - token for authentication (read token) if content is public then token is "public" ( and even optional )
- - - buffer: Boolean (false by default, but for files > 25mb is true) Set to true to force HTML5 Audio. This should be used for large audio files.
- - - autoplay: Boolean (false by default) Set to true to automatically start playback when sound is loaded.

- doc.destroyPlayer()

- doc.play() Starts playing
- doc.pause() Pausing audio
- doc.stop() Stops audio

- doc.setFragment(name, offset, duration, cb) Marks the part of audio in range (offset + duration)
- doc.getFragment(name) Marks the part of audio in range (offset + duration)


### Controlling players globally:
- - mute: mutes all sounds for all players.
- - unmute: Unmutes all sounds and restores them to their previous volume.
- - getVolume: Get/set the global volume for all sounds. ( reactive source of data )
- - setVolume: Number from 0.0 to 1.0.

### There is more stuff, but not yet documented.