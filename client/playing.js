'use strict';

_.extend(UniRecorder.UniAudioRecord.prototype, {
    /**
     *
     * @param options {{token, buffer, autoplay, loop, volume}=}
     * @param cb {Function=} callback after load or if error
     * @memberOf UniRecorder.UniAudioRecord
     * @returns {boolean}
     */
    initPlayer: function(options, cb){
        if(!this.isDone()){
            console.error('Audio file not ready!');
            return false;
        }
        if(typeof options === 'string'){
            options = {token: options};
        }
        if(this._player){
           this.destroyPlayer();
        }
        this._player = new UniRecorder.Player(this, options, cb);
        return this._player;
    },
    /**
     * This will immediately stop this sound and remove it from the cache.
     * @memberOf UniRecorder.UniAudioRecord
     */
    destroyPlayer: function(){
        if(this._player){
            this._player.unload();
        }
        this._player = null;
    },
    /**
     * Begins playback of sound. Will continue from previous point if sound has been previously paused.
     * (initPlayer will be called If not be called before.)
     * @param fragmentName {String=} Plays from the defined fragments.
     * @param token {String|Object=} If it's first call, you can pass read token
     * (if public content then "public") or options for init.
     * @memberOf UniRecorder.UniAudioRecord
     */
    play: function(fragmentName, token){
        if(!this._player){
            this.initPlayer(token);
        }
        this._player.play(fragmentName);
    },
    pause: function(){
        this._player && this._player.pause();
    },
    stop: function(){
        this._player && this._player.stop();
    },
    /**
     * Returns current status (playing paused ...)
     * [Reactive source of data]
     * @memberOf UniRecorder.UniAudioRecord
     * @returns {String|undefined} return const UniRecorder.PLAYER_*
     */
    getPlayerStatus: function(){
        if(!this._playerStatusDeps){
            this._playerStatusDeps = new Tracker.Dependency;
        }
        this._playerStatusDeps.depend();
        if(!this._player){
            return UniRecorder.PLAYER_UNLOADED;
        }
        return this._player._curStatus;
    },
    /**
     * Marks the part of audio in range (offset + duration)
     * @param name
     * @param offset
     * @param duration
     * @param cb
     * @memberOf UniRecorder.UniAudioRecord
     */
    setFragment: function(name, offset, duration, cb){
        var toSet = {};
        cb = _.isFunction(cb) ? cb : function(){};
        toSet['fragments.'+name] = [offset, duration];
        var self = this;
        this.update({$set: toSet}, function(err){
            if(err){
                return cb(err, self);
            }
            if(self._player){
                self.fragments[name] = toSet['fragments.'+name];
                self._player.fragment(self.fragments);
            }
            cb(null, self);
        });
    },
    /**
     * Gets marked range of fragment
     * @param name
     * @memberOf UniRecorder.UniAudioRecord
     * @returns {[offset, duration]}
     */
    getFragment: function(name){
        return this.fragments && this.fragments[name];
    }
});

