/*!
 *  It based on:
 *  howler.js v.1.26 James Simpson goldfirestudios.com
 *  under MIT License
 */

UniRecorder.PLAYER_UNLOADED = undefined;
UniRecorder.PLAYER_PLAYING = 'playing';
UniRecorder.PLAYER_PAUSED = 'paused';
UniRecorder.PLAYER_STOPPED = 'stopped';

// setup
var cache = {};

// setup the audio context
var ctx = null,
    usingWebAudio = true,
    noAudio = false;
try {
    if (typeof AudioContext !== 'undefined') {
        ctx = new AudioContext();
    } else if (typeof webkitAudioContext !== 'undefined') {
        ctx = new webkitAudioContext();
    } else {
        usingWebAudio = false;
    }
} catch (e) {
    usingWebAudio = false;
}

if (!usingWebAudio) {
    if (typeof Audio !== 'undefined') {
        try {
            new Audio();
        } catch (e) {
            noAudio = true;
        }
    } else {
        noAudio = true;
    }
}

// create a master gain node
if (usingWebAudio) {
    var masterGain = (typeof ctx.createGain === 'undefined') ? ctx.createGainNode() : ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);
}

// create global controller
var AllPlayers = function (codecs) {
    this._globalVolume = 1;
    this._muted = false;
    this.usingWebAudio = usingWebAudio;
    this.ctx = ctx;
    this.noAudio = noAudio;
    this._players = [];
    this._codecs = codecs;
    this.iOSAutoEnable = true;
};
AllPlayers.prototype = {
    /**
     * Get the global volume for all audio players.
     * [Reactive source of data]
     * @return {Float} Returns current volume.
     */
    getVolume: function(){
        if(!this._volumeDeps){
            this._volumeDeps = new Tracker.Dependency;
        }
        this._volumeDeps.depend();
        return this._volume();
    },
    /**
     * Get/set the global volume for all sounds.
     * @param  {Float} level Volume from 0.0 to 1.0.
     * @return {allPlayers}     Returns self or current volume.
     */
    setVolume: function(level){
        if(this._volumeDeps){
            this._volumeDeps.changed();
        }
        return this._volume(level);
    },

    _volume: function (level) {
        var self = this;
        // make sure volume is a number
        level = parseFloat(level);

        if (level >= 0 && level <= 1) {
            self._globalVolume = level;

            if (usingWebAudio) {
                masterGain.gain.value = level;
            }

            // loop through cache and change volume of all nodes that are using HTML5 Audio
            for (var key in self._players) {
                if (self._players.hasOwnProperty(key) && self._players[key]._webAudio === false) {
                    // loop through the audio nodes
                    for (var i = 0; i < self._players[key]._audioNode.length; i++) {
                        self._players[key]._audioNode[i].volume = self._players[key]._volume * self._globalVolume;
                    }
                }
            }

            return self;
        }

        // return the current global volume
        return (usingWebAudio) ? masterGain.gain.value : self._globalVolume;
    },

    /**
     * Mute all sounds.
     * @return {allPlayers}
     */
    mute: function () {
        this._setMuted(true);

        return this;
    },

    /**
     * Unmute all sounds.
     * @return {allPlayers}
     */
    unmute: function () {
        this._setMuted(false);

        return this;
    },

    /**
     * Handle muting and unmuting globally.
     * @param  {Boolean} muted Is muted or not.
     */
    _setMuted: function (muted) {
        var self = this;

        self._muted = muted;

        if (usingWebAudio) {
            masterGain.gain.value = muted ? 0 : self._globalVolume;
        }

        for (var key in self._players) {
            if (self._players.hasOwnProperty(key) && self._players[key]._webAudio === false) {
                // loop through the audio nodes
                for (var i = 0; i < self._players[key]._audioNode.length; i++) {
                    self._players[key]._audioNode[i].muted = muted;
                }
            }
        }
        if(this._volumeDeps){
            this._volumeDeps.changed();
        }
    },

    /**
     * Check for codec support.
     * @param  {String} ext Audio file extention.
     * @return {Boolean}
     */
    codecs: function (ext) {
        return this._codecs[ext];
    },

    /**
     * iOS will only allow audio to be played after a user interaction.
     * Attempt to automatically unlock audio on the first user interaction.
     * Concept from: http://paulbakaus.com/tutorials/html5/web-audio-on-ios/
     * @return {allPlayers}
     */
    _enableiOSAudio: function () {
        var self = this;

        // only run this on iOS if audio isn't already eanbled
        if (ctx && (self._iOSEnabled || !/iPhone|iPad|iPod/i.test(navigator.userAgent))) {
            return;
        }

        self._iOSEnabled = false;

        // call this method on touch start to create and play a buffer,
        // then check if the audio actually played to determine if
        // audio has now been unlocked on iOS
        var unlock = function () {
            // create an empty buffer
            var buffer = ctx.createBuffer(1, 1, 22050);
            var source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);

            // play the empty buffer
            if (typeof source.start === 'undefined') {
                source.noteOn(0);
            } else {
                source.start(0);
            }

            // setup a timeout to check that we are unlocked on the next event loop
            Meteor.defer(function () {
                if ((source.playbackState === source.PLAYING_STATE || source.playbackState === source.FINISHED_STATE)) {
                    // update the unlocked state and prevent this check from happening again
                    self._iOSEnabled = true;
                    self.iOSAutoEnable = false;

                    // remove the touch start listener
                    window.removeEventListener('touchstart', unlock, false);
                }
            });
        };

        // setup a touch start listener to attempt an unlock in
        window.addEventListener('touchstart', unlock, false);

        return self;
    }
};

// check for browser codec support
var audioTest = null;
var codecs = {};
if (!noAudio) {
    audioTest = new Audio();
    codecs = {
        mp3: !!audioTest.canPlayType('audio/mpeg;').replace(/^no$/, ''),
        opus: !!audioTest.canPlayType('audio/ogg; codecs="opus"').replace(/^no$/, ''),
        ogg: !!audioTest.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, ''),
        wav: !!audioTest.canPlayType('audio/wav; codecs="1"').replace(/^no$/, ''),
        aac: !!audioTest.canPlayType('audio/aac;').replace(/^no$/, ''),
        m4a: !!(audioTest.canPlayType('audio/x-m4a;') || audioTest.canPlayType('audio/m4a;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
        mp4: !!(audioTest.canPlayType('audio/x-mp4;') || audioTest.canPlayType('audio/mp4;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
        weba: !!audioTest.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/, '')
    };
}

// allow access to the global audio controls
var allPlayers = new AllPlayers(codecs);

// setup the audio player object
var Player = function (audioDoc, params, cb) {
    var self = this;
    params = params || {};
    // setup the defaults
    self._audioDoc = audioDoc;
    self._autoplay = params.autoplay || false;
    self._buffer = params.buffer;
    self._duration = params.duration || 0;
    self._format = audioDoc.extName || null;
    self._loop = params.loop || false;
    self._loaded = false;
    self._fragments = audioDoc.fragments || {};
    self._src = params.src || '';
    self._pos3d = params.position3d || [0, 0, -0.5];
    self._volume = params.volume !== undefined ? params.volume : 1;
    self._urls = [audioDoc.getURL(params.token)];
    self._rate = params.rate || 1;

    // allow forcing of a specific panningModel ('equalpower' or 'HRTF'),
    // if none is specified, defaults to 'equalpower' and switches to 'HRTF'
    // if 3d sound is used
    self._model = params.model || null;

    // setup event functions
    self._onload = [_isStopped];
    if(typeof cb === 'function'){
        self._onload.push(cb);
    } else{
        cb = function (e) { e && console.error('loaderror', e); };
    }
    self._onloaderror = [cb];
    self._onend = [_isStopped];
    self._onstop = [_isStopped];

    self._onpause = [function(){
        if(self._playerStatusDeps && self._curStatus !== UniRecorder.PLAYER_PAUSED){
            self._playerStatusDeps.changed();
        }
        self._curStatus = UniRecorder.PLAYER_PAUSED;
    }];
    self._onplay = [function(){
        if(self._playerStatusDeps && self._curStatus !== UniRecorder.PLAYER_PLAYING){
            self._playerStatusDeps.changed();
        }
        self._curStatus = UniRecorder.PLAYER_PLAYING;
    }];

    self._onendTimer = [];

    // Web Audio or HTML5 Audio?
    self._webAudio = usingWebAudio && !self._buffer;

    // check if we need to fall back to HTML5 Audio
    self._audioNode = [];
    if (self._webAudio) {
        self._setupAudioNode();
    }

    // automatically try to enable audio on iOS
    if (typeof ctx !== 'undefined' && ctx && allPlayers.iOSAutoEnable) {
        allPlayers._enableiOSAudio();
    }

    // add this to an array of Player's to allow global control
    allPlayers._players.push(self);

    // load the track
    self.load();
};

var _isStopped = function(){
    if(this._playerStatusDeps && this._curStatus !== UniRecorder.PLAYER_STOPPED){
        this._playerStatusDeps.changed();
    }
    this._curStatus = UniRecorder.PLAYER_STOPPED;
};

// setup all of the methods
Player.prototype = {
    /**
     * Load an audio file.
     * @return {Player}
     */
    load: function () {
        var self = this,
            url = null;

        // if no audio is available, quit immediately
        if (noAudio) {
            self.on('loaderror', 'audio is unavailable');
            return;
        }

        // loop through source URLs and pick the first one that is compatible
        for (var i = 0; i < self._urls.length; i++) {
            var ext, urlItem;

            if (self._format) {
                // use specified audio format if available
                ext = self._format;
            } else {
                // figure out the filetype (whether an extension or base64 data)
                urlItem = self._urls[i];
                ext = /^data:audio\/([^;,]+);/i.exec(urlItem);
                if (!ext) {
                    ext = /\.([^.]+)$/.exec(urlItem.split('?', 1)[0]);
                }

                if (ext) {
                    ext = ext[1].toLowerCase();
                } else {
                    self.on('loaderror', 'extension unknown');
                    return;
                }
            }

            if (codecs[ext]) {
                url = self._urls[i];
                break;
            }
        }

        if (!url) {
            self.on('loaderror', 'no url');
            return;
        }

        self._src = url;

        if (self._webAudio) {
            loadBuffer(self, url);
        } else {
            var newNode = new Audio();

            // listen for errors with HTML5 audio (http://dev.w3.org/html5/spec-author-view/spec.html#mediaerror)
            newNode.addEventListener('error', function () {
                if (newNode.error && newNode.error.code === 4) {
                    allPlayers.noAudio = true;
                }

                self.on('loaderror', {type: newNode.error ? newNode.error.code : 0});
            }, false);

            self._audioNode.push(newNode);

            // setup the new audio node
            newNode.src = url;
            newNode._pos = 0;
            newNode.preload = 'auto';
            newNode.volume = (allPlayers._muted) ? 0 : self._volume * allPlayers._volume();

            // setup the event listener to start playing the sound
            // as soon as it has buffered enough
            var listener = function () {
                // round up the duration when using HTML5 Audio to account for the lower precision
                self._duration = Math.ceil(newNode.duration * 10) / 10;

                self._fragments._default = {timeStart: 0, timeLength: self._duration * 1000};

                if (!self._loaded) {
                    self._loaded = true;
                    self.on('load');
                }

                if (self._autoplay) {
                    self.play();
                }

                // clear the event listener
                newNode.removeEventListener('canplaythrough', listener, false);
            };
            newNode.addEventListener('canplaythrough', listener, false);
            newNode.load();
        }

        return self;
    },

    getPlayerStatus: function(){
        if(!this._playerStatusDeps){
            this._playerStatusDeps = new Tracker.Dependency;
        }
        this._playerStatusDeps.depend();
        return this._curStatus;
    },
    /**
     * Get/set the URLs to be pulled from to play in this source.
     * @param  {Array} urls  Arry of URLs to load from
     * @return {Player}        Returns self or the current URLs
     */
    urls: function (urls) {
        var self = this;

        if (urls) {
            self.stop();
            self._urls = (typeof urls === 'string') ? [urls] : urls;
            self._loaded = false;
            self.load();

            return self;
        } else {
            return self._urls;
        }
    },

    /**
     * Play a sound from the current time (0 by default).
     * @param  {String}   fragmentName   (optional) Plays from the specified position in the sound fragment definition.
     * @param  {Function} callback (optional) Returns the unique playback id for this sound instance.
     * @return {Player}
     */
    play: function (fragmentName, callback) {
        var self = this;
        // use the default fragment if none is passed
        if (!fragmentName) {
            fragmentName = '_default';
        }

        // if the sound hasn't been loaded, add it to the event queue
        if (!self._loaded) {
            self.on('load', function () {
                self.play(fragmentName, callback);
            });

            return self;
        }

        if(!self._fragments){
            self._fragments = {};
        }

        if(!self._fragments._default){
            self._fragments._default = {timeStart: 0, timeLength: self._duration * 1000};
        }

        // if the fragment doesn't exist, play nothing
        if (!self._fragments[fragmentName]) {
            console.warn('Cannot play because missing fragment:', fragmentName);
            if (typeof callback === 'function') callback();
            return self;
        }
        // to the end of _default if fragment has end === 0;
        if(self._fragments[fragmentName].timeLength === 0){
            self._fragments[fragmentName].timeLength = (self._duration * 1000) - self._fragments[fragmentName].timeStart;
        }
        // get the node to playback
        self._inactiveNode(function (node) {
            // persist the fragment being played
            node._fragments = fragmentName;

            // determine where to start playing from
            var pos = (node._pos > 0) ? node._pos : self._fragments[fragmentName].timeStart / 1000;

            // determine how long to play for
            var duration = 0;
            if (self._webAudio) {
                duration = self._fragments[fragmentName].timeLength / 1000 - node._pos;
                if (node._pos > 0) {
                    pos = self._fragments[fragmentName].timeStart / 1000 + pos;
                }
            } else {
                duration = self._fragments[fragmentName].timeLength / 1000 - (pos - self._fragments[fragmentName].timeStart / 1000);
            }

            // determine if this sound should be looped
            var loop = !!(self._loop || self._fragments[fragmentName].loop);

            // set timer to fire the 'onend' event
            var soundId = (typeof callback === 'string') ? callback : Math.round(Date.now() * Math.random()) + '',
                timerId;
            (function () {
                var data = {
                    id: soundId,
                    fragment: fragmentName,
                    loop: loop
                };
                timerId = setTimeout(function () {
                    // if looping, restart the track
                    if (!self._webAudio && loop) {
                        self.stop(data.id).play(fragmentName, data.id);
                    }

                    // set web audio node to paused at end
                    if (self._webAudio && !loop) {
                        self._nodeById(data.id).paused = true;
                        self._nodeById(data.id)._pos = 0;

                        // clear the end timer
                        self._clearEndTimer(data.id);
                    }

                    // end the track if it is HTML audio and a fragment
                    if (!self._webAudio && !loop) {
                        self.stop(data.id);
                    }

                    // fire ended event
                    self.on('end', soundId);
                }, duration * 1000);

                // store the reference to the timer
                self._onendTimer.push({timer: timerId, id: data.id});
            })();

            if (self._webAudio) {
                var loopStart = self._fragments[fragmentName].timeStart / 1000,
                    loopEnd = self._fragments[fragmentName].timeLength / 1000;

                // set the play id to this node and load into context
                node.id = soundId;
                node.paused = false;
                refreshBuffer(self, [loop, loopStart, loopEnd], soundId);
                self._playStart = ctx.currentTime;
                node.gain.value = self._volume;

                if (typeof node.bufferSource.start === 'undefined') {
                    loop ? node.bufferSource.noteGrainOn(0, pos, 86400) : node.bufferSource.noteGrainOn(0, pos, duration);
                } else {
                    loop ? node.bufferSource.start(0, pos, 86400) : node.bufferSource.start(0, pos, duration);
                }
            } else {
                if (node.readyState === 4 || !node.readyState && navigator.isCocoonJS) {
                    node.readyState = 4;
                    node.id = soundId;
                    node.currentTime = pos;
                    node.muted = allPlayers._muted || node.muted;
                    node.volume = self._volume * allPlayers._volume();
                    setTimeout(function () {
                        node.play();
                    }, 0);
                } else {
                    self._clearEndTimer(soundId);

                    (function () {
                        var sound = self,
                            playSprite = fragmentName,
                            fn = callback,
                            newNode = node;
                        var listener = function () {
                            sound.play(playSprite, fn);

                            // clear the event listener
                            newNode.removeEventListener('canplaythrough', listener, false);
                        };
                        newNode.addEventListener('canplaythrough', listener, false);
                    })();

                    return self;
                }
            }

            // fire the play event and send the soundId back in the callback
            self.on('play');
            if (typeof callback === 'function') callback(soundId);

            return self;
        });

        return self;
    },

    /**
     * Pause playback and save the current position.
     * @param {String} id (optional) The play instance ID.
     * @return {Player}
     */
    pause: function (id) {
        var self = this;

        // if the sound hasn't been loaded, add it to the event queue
        if (!self._loaded) {
            self.on('play', function () {
                self.pause(id);
            });

            return self;
        }

        // clear 'onend' timer
        self._clearEndTimer(id);

        var activeNode = (id) ? self._nodeById(id) : self._activeNode();
        if (activeNode) {
            activeNode._pos = self.position(null, id);

            if (self._webAudio) {
                // make sure the sound has been created
                if (!activeNode.bufferSource || activeNode.paused) {
                    return self;
                }

                activeNode.paused = true;
                if (typeof activeNode.bufferSource.stop === 'undefined') {
                    activeNode.bufferSource.noteOff(0);
                } else {
                    activeNode.bufferSource.stop(0);
                }
            } else {
                activeNode.pause();
            }
        }

        self.on('pause');

        return self;
    },

    /**
     * Stop playback and reset to start.
     * @param  {String} id  (optional) The play instance ID.
     * @return {Player}
     */
    stop: function (id) {
        var self = this;

        // if the sound hasn't been loaded, add it to the event queue
        if (!self._loaded) {
            self.on('play', function () {
                self.stop(id);
            });

            return self;
        }

        // clear 'onend' timer
        self._clearEndTimer(id);

        var activeNode = (id) ? self._nodeById(id) : self._activeNode();
        if (activeNode) {
            activeNode._pos = 0;

            if (self._webAudio) {
                // make sure the sound has been created
                if (!activeNode.bufferSource || activeNode.paused) {
                    return self;
                }

                activeNode.paused = true;

                if (typeof activeNode.bufferSource.stop === 'undefined') {
                    activeNode.bufferSource.noteOff(0);
                } else {
                    activeNode.bufferSource.stop(0);
                }
            } else if (!isNaN(activeNode.duration)) {
                activeNode.pause();
                activeNode.currentTime = 0;
            }
            self.on('stop')
        }

        return self;
    },

    /**
     * Mute this sound.
     * @param  {String} id (optional) The play instance ID.
     * @return {Player}
     */
    mute: function (id) {
        var self = this;

        // if the sound hasn't been loaded, add it to the event queue
        if (!self._loaded) {
            self.on('play', function () {
                self.mute(id);
            });

            return self;
        }

        var activeNode = (id) ? self._nodeById(id) : self._activeNode();
        if (activeNode) {
            if (self._webAudio) {
                activeNode.gain.value = 0;
            } else {
                activeNode.muted = true;
            }
        }

        return self;
    },

    /**
     * Unmute this sound.
     * @param  {String} id (optional) The play instance ID.
     * @return {Player}
     */
    unmute: function (id) {
        var self = this;

        // if the sound hasn't been loaded, add it to the event queue
        if (!self._loaded) {
            self.on('play', function () {
                self.unmute(id);
            });

            return self;
        }

        var activeNode = (id) ? self._nodeById(id) : self._activeNode();
        if (activeNode) {
            if (self._webAudio) {
                activeNode.gain.value = self._volume;
            } else {
                activeNode.muted = false;
            }
        }

        return self;
    },

    /**
     * Get/set volume of this sound.
     * @param  {Float}  vol Volume from 0.0 to 1.0.
     * @param  {String} id  (optional) The play instance ID.
     * @return {Player/Float}     Returns self or current volume.
     */
    volume: function (vol, id) {
        var self = this;

        // make sure volume is a number
        vol = parseFloat(vol);

        if (vol >= 0 && vol <= 1) {
            self._volume = vol;

            // if the sound hasn't been loaded, add it to the event queue
            if (!self._loaded) {
                self.on('play', function () {
                    self.volume(vol, id);
                });

                return self;
            }

            var activeNode = (id) ? self._nodeById(id) : self._activeNode();
            if (activeNode) {
                if (self._webAudio) {
                    activeNode.gain.value = vol;
                } else {
                    activeNode.volume = vol * allPlayers._volume();
                }
            }

            return self;
        } else {
            return self._volume;
        }
    },

    /**
     * Get/set whether to loop the sound.
     * @param  {Boolean} loop To loop or not to loop, that is the question.
     * @return {Player/Boolean}      Returns self or current looping value.
     */
    loop: function (loop) {
        var self = this;

        if (typeof loop === 'boolean') {
            self._loop = loop;

            return self;
        } else {
            return self._loop;
        }
    },

    /**
     * Get/set sound fragment definition.
     * @param  {Object} name Example: {spriteName: [offset, duration, loop]}
     *                @param {Integer} offset   Where to begin playback in milliseconds
     *                @param {Integer} duration How long to play in milliseconds
     *                @param {Boolean} loop     (optional) Set true to loop this fragment
     * @return {Player}        Returns current fragment sheet or self.
     */
    fragment: function (name) {
        var self = this;

        if (typeof name === 'object') {
            self._fragments = name;

            return self;
        } else {
            return self._fragments;
        }
    },

    /**
     * Get/set the position of playback.
     * @param  {Float}  pos The position to move current playback to.
     * @param  {String} id  (optional) The play instance ID.
     * @return {Player/Float}      Returns self or current playback position.
     */
    position: function (pos, id) {
        var self = this;

        // if the sound hasn't been loaded, add it to the event queue
        if (!self._loaded) {
            self.on('load', function () {
                self.position(pos);
            });

            return typeof pos === 'number' ? self : self._pos || 0;
        }

        // make sure we are dealing with a number for position
        pos = parseFloat(pos);

        var activeNode = (id) ? self._nodeById(id) : self._activeNode();
        if (activeNode) {
            if (pos >= 0) {
                self.pause(id);
                activeNode._pos = pos;
                self.play(activeNode._fragments, id);

                return self;
            } else {
                return self._webAudio ? activeNode._pos + (ctx.currentTime - self._playStart) : activeNode.currentTime;
            }
        } else if (pos >= 0) {
            return self;
        } else {
            // find the first inactive node to return the position for
            for (var i = 0; i < self._audioNode.length; i++) {
                if (self._audioNode[i].paused && self._audioNode[i].readyState === 4) {
                    return (self._webAudio) ? self._audioNode[i]._pos : self._audioNode[i].currentTime;
                }
            }
        }
    },

    /**
     * Fade a currently playing sound between two volumes.
     * @param  {Number}   from     The volume to fade from (0.0 to 1.0).
     * @param  {Number}   to       The volume to fade to (0.0 to 1.0).
     * @param  {Number}   len      Time in milliseconds to fade.
     * @param  {Function} callback (optional) Fired when the fade is complete.
     * @param  {String}   id       (optional) The play instance ID.
     * @return {Player}
     */
    fade: function (from, to, len, callback, id) {
        var self = this,
            diff = Math.abs(from - to),
            dir = from > to ? 'down' : 'up',
            steps = diff / 0.01,
            stepTime = len / steps;

        // if the sound hasn't been loaded, add it to the event queue
        if (!self._loaded) {
            self.on('load', function () {
                self.fade(from, to, len, callback, id);
            });

            return self;
        }

        // set the volume to the start position
        self.volume(from, id);

        for (var i = 1; i <= steps; i++) {
            (function () {
                var change = self._volume + (dir === 'up' ? 0.01 : -0.01) * i,
                    vol = Math.round(1000 * change) / 1000,
                    toVol = to;

                setTimeout(function () {
                    self.volume(vol, id);

                    if (vol === toVol) {
                        if (callback) callback();
                    }
                }, stepTime * i);
            })();
        }
    },

    /**
     * Get an audio node by ID.
     * @return {Player} Audio node.
     */
    _nodeById: function (id) {
        var self = this,
            node = self._audioNode[0];

        // find the node with this ID
        for (var i = 0; i < self._audioNode.length; i++) {
            if (self._audioNode[i].id === id) {
                node = self._audioNode[i];
                break;
            }
        }

        return node;
    },

    /**
     * Get the first active audio node.
     * @return {Player} Audio node.
     */
    _activeNode: function () {
        var self = this,
            node = null;

        // find the first playing node
        for (var i = 0; i < self._audioNode.length; i++) {
            if (!self._audioNode[i].paused) {
                node = self._audioNode[i];
                break;
            }
        }

        // remove excess inactive nodes
        self._drainPool();

        return node;
    },

    /**
     * Get the first inactive audio node.
     * If there is none, create a new one and add it to the pool.
     * @param  {Function} callback Function to call when the audio node is ready.
     */
    _inactiveNode: function (callback) {
        var self = this,
            node = null;

        // find first inactive node to recycle
        for (var i = 0; i < self._audioNode.length; i++) {
            if (self._audioNode[i].paused && self._audioNode[i].readyState === 4) {
                // send the node back for use by the new play instance
                callback(self._audioNode[i]);
                node = true;
                break;
            }
        }

        // remove excess inactive nodes
        self._drainPool();

        if (node) {
            return;
        }

        // create new node if there are no inactives
        var newNode;
        if (self._webAudio) {
            newNode = self._setupAudioNode();
            callback(newNode);
        } else {
            self.load();
            newNode = self._audioNode[self._audioNode.length - 1];

            // listen for the correct load event and fire the callback
            var listenerEvent = navigator.isCocoonJS ? 'canplaythrough' : 'loadedmetadata';
            var listener = function () {
                newNode.removeEventListener(listenerEvent, listener, false);
                callback(newNode);
            };
            newNode.addEventListener(listenerEvent, listener, false);
        }
    },

    /**
     * If there are more than 5 inactive audio nodes in the pool, clear out the rest.
     */
    _drainPool: function () {
        var self = this,
            inactive = 0,
            i;

        // count the number of inactive nodes
        for (i = 0; i < self._audioNode.length; i++) {
            if (self._audioNode[i].paused) {
                inactive++;
            }
        }

        // remove excess inactive nodes
        for (i = self._audioNode.length - 1; i >= 0; i--) {
            if (inactive <= 5) {
                break;
            }

            if (self._audioNode[i].paused) {
                // disconnect the audio source if using Web Audio
                if (self._webAudio) {
                    self._audioNode[i].disconnect(0);
                }

                inactive--;
                self._audioNode.splice(i, 1);
            }
        }
    },

    /**
     * Clear 'onend' timeout before it ends.
     * @param  {String} soundId  The play instance ID.
     */
    _clearEndTimer: function (soundId) {
        var self = this,
            index = 0;

        // loop through the timers to find the one associated with this sound
        for (var i = 0; i < self._onendTimer.length; i++) {
            if (self._onendTimer[i].id === soundId) {
                index = i;
                break;
            }
        }

        var timer = self._onendTimer[index];
        if (timer) {
            clearTimeout(timer.timer);
            self._onendTimer.splice(index, 1);
        }
    },

    /**
     * Setup the gain node and panner for a Web Audio instance.
     * @return {Object} The new audio node.
     */
    _setupAudioNode: function () {
        var self = this,
            node = self._audioNode,
            index = self._audioNode.length;

        // create gain node
        node[index] = (typeof ctx.createGain === 'undefined') ? ctx.createGainNode() : ctx.createGain();
        node[index].gain.value = self._volume;
        node[index].paused = true;
        node[index]._pos = 0;
        node[index].readyState = 4;
        node[index].connect(masterGain);

        // create the panner
        node[index].panner = ctx.createPanner();
        node[index].panner.panningModel = self._model || 'equalpower';
        node[index].panner.setPosition(self._pos3d[0], self._pos3d[1], self._pos3d[2]);
        node[index].panner.connect(node[index]);

        return node[index];
    },

    /**
     * Call/set custom events.
     * @param  {String}   event Event type.
     * @param  {Function} fn    Function to call.
     * @return {Player}
     */
    on: function (event, fn) {
        var self = this,
            events = self['_on' + event];

        if (typeof fn === 'function') {
            events.push(fn);
        } else {
            for (var i = 0; i < events.length; i++) {
                if (fn) {
                    events[i].call(self, fn);
                } else {
                    events[i].call(self);
                }
            }
        }

        return self;
    },

    /**
     * Remove a custom event.
     * @param  {String}   event Event type.
     * @param  {Function} fn    Listener to remove.
     * @return {Player}
     */
    off: function (event, fn) {
        var self = this,
            events = self['_on' + event],
            fnString = fn ? fn.toString() : null;

        if (fnString) {
            // loop through functions in the event for comparison
            for (var i = 0; i < events.length; i++) {
                if (fnString === events[i].toString()) {
                    events.splice(i, 1);
                    break;
                }
            }
        } else {
            self['_on' + event] = [];
        }

        return self;
    },

    /**
     * Unload and destroy the current Player object.
     * This will immediately stop all play instances attached to this sound.
     */
    unload: function () {
        var self = this;

        // stop playing any active nodes
        var nodes = self._audioNode;
        for (var i = 0; i < self._audioNode.length; i++) {
            // stop the sound if it is currently playing
            if (!nodes[i].paused) {
                self.stop(nodes[i].id);
                self.on('end', nodes[i].id);
            }

            if (!self._webAudio) {
                // remove the source if using HTML5 Audio
                nodes[i].src = '';
            } else {
                // disconnect the output from the master gain
                nodes[i].disconnect(0);
            }
        }

        // make sure all timeouts are cleared
        for (i = 0; i < self._onendTimer.length; i++) {
            clearTimeout(self._onendTimer[i].timer);
        }

        // remove the reference in the global _Player object
        var index = allPlayers._players.indexOf(self);
        if (index !== null && index >= 0) {
            allPlayers._players.splice(index, 1);
        }

        // delete this sound from the cache
        delete cache[self._src];
        if(self._audioDoc && self._audioDoc._playerStatusDeps){
            self._audioDoc._playerStatusDeps.changed();
        }
        self = null;
    }

};

// only define these functions when using WebAudio
if (usingWebAudio) {

    /**
     * Buffer a sound from URL (or from cache) and decode to audio source (Web Audio API).
     * @param  {Object} obj The Player object for the sound to load.
     * @param  {String} url The path to the sound file.
     */
    var loadBuffer = function (obj, url) {
        // check if the buffer has already been cached
        if (url in cache) {
            // set the duration from the cache
            obj._duration = cache[url].duration;

            // load the sound into this object
            loadSound(obj);
            return;
        }

        if (/^data:[^;]+;base64,/.test(url)) {
            // Decode base64 data-URIs because some browsers cannot load data-URIs with XMLHttpRequest.
            var data = atob(url.split(',')[1]);
            var dataView = new Uint8Array(data.length);
            for (var i = 0; i < data.length; ++i) {
                dataView[i] = data.charCodeAt(i);
            }

            decodeAudioData(dataView.buffer, obj, url);
        } else {
            // load the buffer from the URL
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function () {
                decodeAudioData(xhr.response, obj, url);
            };
            xhr.onerror = function () {
                // if there is an error, switch the sound to HTML Audio
                if (obj._webAudio) {
                    obj._buffer = true;
                    obj._webAudio = false;
                    obj._audioNode = [];
                    delete obj._gainNode;
                    delete cache[url];
                    obj.load();
                }
            };
            try {
                xhr.send();
            } catch (e) {
                xhr.onerror();
            }
        }
    };

    /**
     * Decode audio data from an array buffer.
     * @param  {ArrayBuffer} arraybuffer The audio data.
     * @param  {Object} obj The Player object for the sound to load.
     * @param  {String} url The path to the sound file.
     */
    var decodeAudioData = function (arraybuffer, obj, url) {
        // decode the buffer into an audio source
        ctx.decodeAudioData(
            arraybuffer,
            function (buffer) {
                if (buffer) {
                    cache[url] = buffer;
                    loadSound(obj, buffer);
                }
            },
            function (err) {
                obj.on('loaderror', err);
            }
        );
    };

    /**
     * Finishes loading the Web Audio API sound and fires the loaded event
     * @param  {Object}  obj    The Player object for the sound to load.
     * @param  {Object} buffer The decoded buffer sound source.
     */
    var loadSound = function (obj, buffer) {
        // set the duration
        obj._duration = (buffer) ? buffer.duration : obj._duration;

        // setup a fragment of full
        obj._fragments._default = {timeStart: 0, timeLength: obj._duration * 1000};

        // fire the loaded event
        if (!obj._loaded) {
            obj._loaded = true;
            obj.on('load');
        }

        if (obj._autoplay) {
            obj.play();
        }
    };

    /**
     * Load the sound back into the buffer source.
     * @param  {Object} obj   The sound to load.
     * @param  {Array}  loop  Loop boolean, position, and duration.
     * @param  {String} id    (optional) The play instance ID.
     */
    var refreshBuffer = function (obj, loop, id) {
        // determine which node to connect to
        var node = obj._nodeById(id);

        // setup the buffer source for playback
        node.bufferSource = ctx.createBufferSource();
        node.bufferSource.buffer = cache[obj._src];
        node.bufferSource.connect(node.panner);
        node.bufferSource.loop = loop[0];
        if (loop[0]) {
            node.bufferSource.loopStart = loop[1];
            node.bufferSource.loopEnd = loop[1] + loop[2];
        }
        node.bufferSource.playbackRate.value = obj._rate;
    };

}

UniRecorder.AllPlayers = allPlayers;
UniRecorder.Player = Player;
