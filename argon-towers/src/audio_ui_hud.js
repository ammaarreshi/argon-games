/**
 * Argon Towers (Grasslands) — 2.5D Three.js Engine
 * Agent 5: Positional Web Audio Engine, Lyria 3 / Gemini TTS Playback & Authentic Diegetic HUD
 *
 * Exports:
 *   - ArgonTowersAudio
 *   - ArgonTowersHUD
 */

const DEFAULT_TOWER_DEFS = {
  gatling: {
    id: 'gatling',
    type: 'gatling',
    name: 'Gatling Tower',
    shortName: 'Gatling',
    cost: 5,
    upgradeCosts: [5, 8],
    damage: [12, 18, 27],
    range: [3.2, 3.6, 4.0],
    fireRate: [6.0, 7.5, 9.0],
    targets: 'Ground & Air',
    desc: 'Rapid-fire rotary minigun. All-around kinetic suppression.',
  },
  goo: {
    id: 'goo',
    type: 'goo',
    name: 'Goo Tower',
    shortName: 'Goo',
    cost: 10,
    upgradeCosts: [8, 10],
    damage: [4, 7, 12],
    range: [3.0, 3.4, 3.8],
    fireRate: [1.5, 1.8, 2.2],
    slowPercent: [35, 50, 65],
    targets: 'Ground & Air',
    desc: 'Sprays viscous corrosive slime that slows targets by up to 65%.',
  },
  missile: {
    id: 'missile',
    type: 'missile',
    name: 'Missile Tower',
    shortName: 'Missile',
    cost: 20,
    upgradeCosts: [18, 28],
    damage: [45, 72, 115],
    range: [4.8, 5.4, 6.2],
    fireRate: [0.85, 1.0, 1.2],
    splashRadius: [1.3, 1.6, 2.0],
    targets: 'Ground & Air (AoE)',
    desc: 'Long-range high-explosive ordnance with heavy splash damage.',
  },
  tesla: {
    id: 'tesla',
    type: 'tesla',
    name: 'Tesla Tower',
    shortName: 'Tesla',
    cost: 75,
    upgradeCosts: [60, 95],
    damage: [95, 155, 250],
    range: [3.6, 4.1, 4.6],
    fireRate: [0.95, 1.15, 1.35],
    chainTargets: [3, 4, 5],
    targets: 'Ground & Air (Chain)',
    desc: 'High-voltage arc coil that chains massive lightning across squads.',
  },
};

const TARGET_PRIORITIES = ['First', 'Strongest', 'Air First', 'Nearest', 'Unslowed'];

const AUDIO_ASSET_PATHS = {
  grasslands_march: 'assets/audio/music/grasslands_march.mp3',
  air_raid_blitz: 'assets/audio/music/air_raid_blitz.mp3',
  scream_ah: 'assets/audio/tts/scream_ah.wav',
  scream_ooh: 'assets/audio/tts/scream_ooh.wav',
  scream_ugh: 'assets/audio/tts/scream_ugh.wav',
  cmd_battle_stations: 'assets/audio/tts/cmd_battle_stations.wav',
  cmd_air_raid: 'assets/audio/tts/cmd_air_raid.wav',
  cmd_zeppelin_boss: 'assets/audio/tts/cmd_zeppelin_boss.wav',
  cmd_path_blocked: 'assets/audio/tts/cmd_path_blocked.wav',
};

/**
 * Helper to convert a base64 data URI into an ArrayBuffer without fetch()
 */
function dataUriToArrayBuffer(dataUri) {
  try {
    const commaIdx = dataUri.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUri.slice(commaIdx + 1) : dataUri;
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (_err) {
    return null;
  }
}

/* ==========================================================================
   1. POSITIONAL WEB AUDIO + LYRIA 3 & GEMINI TTS ENGINE (ArgonTowersAudio)
   ========================================================================== */

class ArgonTowersAudio {
  constructor(options = {}) {
    this.options = options;
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.ttsGain = null;
    this.compressor = null;
    this.noiseBuffer = null;

    this.muted = Boolean(options.muted);
    this.musicMuted = Boolean(options.musicMuted);
    this.masterVolume = typeof options.volume === 'number' ? options.volume : 0.85;
    this.musicVolume = typeof options.musicVolume === 'number' ? options.musicVolume : 0.36;
    this.sfxVolume = typeof options.sfxVolume === 'number' ? options.sfxVolume : 0.82;
    this.ttsVolume = typeof options.ttsVolume === 'number' ? options.ttsVolume : 0.92;

    this.buffers = new Map();
    this.rawArrayBuffers = new Map();
    this.loadingPromises = new Map();

    this.currentMusicTrack = null;
    this.activeMusicSource = null;
    this.activeMusicTrackGain = null;
    this.musicPlaying = false;
    this.isPaused = false;
    this._proceduralMarchTimer = null;
    this._marchStep = 0;

    // Anti-spam cooldown trackers (in performance.now() ms)
    this._lastScreamTime = 0;
    this._screamCooldownMs = 900; // 0.9s cooldown for subtle non-verbal procedural impact grunts
    this._lastSpokenScreamTime = 0;
    this._spokenScreamCooldownMs = 9500; // 9.5s minimum between spoken WAV screams ("My helmet!", "Medic!")
    this._lastCommanderCalloutTime = 0;
    this._screamIndex = 0;
    this._lastCalloutTimes = new Map();
    this._lastShotTime = 0;
    this._lastGooTime = 0;
    this._lastTeslaTime = 0;
    this._lastBuzzTime = 0;

    this._boundUnlock = this._unlockAudio.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this._boundUnlock, { passive: true });
      window.addEventListener('keydown', this._boundUnlock, { passive: true });
      window.addEventListener('touchstart', this._boundUnlock, { passive: true });
    }

    // Kick off raw asset prefetch immediately so buffers decode the instant AudioContext starts
    this.preloadAll();
  }

  get isMuted() {
    return this.muted;
  }

  set isMuted(val) {
    this.setMuted(Boolean(val));
  }

  /**
   * Initializes or resumes the Web Audio graph safely.
   */
  init() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
      } catch (_e) {
        return null;
      }

      // Master compressor to keep intense late-game salvos punchy and clip-free
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ttsGain = this.ctx.createGain();

      this.masterGain.gain.value = this.muted ? 0.0001 : this.masterVolume;
      this.musicGain.gain.value = this.musicMuted ? 0.0001 : this.musicVolume;
      this.sfxGain.gain.value = this.sfxVolume;
      this.ttsGain.gain.value = this.ttsVolume;

      this.musicGain.connect(this.compressor);
      this.sfxGain.connect(this.compressor);
      this.ttsGain.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this._buildNoiseBuffer();
      this._decodePendingBuffers();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  resume() {
    return this.init();
  }

  _unlockAudio() {
    const ctx = this.init();
    if (ctx && ctx.state === 'running') {
      if (this.musicPlaying && !this.activeMusicSource) {
        this._startDecodedMusicOrFallback(this.currentMusicTrack || 'grasslands_march');
      }
    }
  }

  _buildNoiseBuffer() {
    if (!this.ctx || this.noiseBuffer) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2.0;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  /**
   * Resolves inline base64 audio from window.__FR_INLINE_AUDIO__ first (for zero-CORS static web),
   * then falls back to fetching the file from assets/audio/...
   */
  async preloadAll() {
    if (typeof window === 'undefined') return;
    const entries = Object.entries(AUDIO_ASSET_PATHS);
    await Promise.allSettled(
      entries.map(([key, relPath]) => this._loadAsset(key, relPath))
    );
  }

  async _loadAsset(key, relPath) {
    if (this.buffers.has(key) || this.buffers.has(relPath)) {
      return this.buffers.get(key) || this.buffers.get(relPath);
    }
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }

    const promise = (async () => {
      let arrayBuf = null;
      const inlineMap =
        (typeof window !== 'undefined' && window.__FR_INLINE_AUDIO__) || null;

      if (inlineMap) {
        const inlineVal =
          inlineMap[relPath] ||
          inlineMap[`./${relPath}`] ||
          inlineMap[`/${relPath}`] ||
          inlineMap[key] ||
          inlineMap[relPath.split('/').pop()];
        if (typeof inlineVal === 'string') {
          arrayBuf = dataUriToArrayBuffer(inlineVal);
        } else if (inlineVal instanceof ArrayBuffer) {
          arrayBuf = inlineVal.slice(0);
        }
      }

      if (!arrayBuf && typeof fetch === 'function') {
        try {
          const resp = await fetch(relPath);
          if (resp && resp.ok) {
            arrayBuf = await resp.arrayBuffer();
          }
        } catch (_err) {
          // Graceful fallback to procedural Web Audio synthesis
        }
      }

      if (arrayBuf) {
        this.rawArrayBuffers.set(key, arrayBuf);
        this.rawArrayBuffers.set(relPath, arrayBuf);
        if (this.ctx) {
          await this._decodeSingleBuffer(key, relPath, arrayBuf);
        }
      }
      return this.buffers.get(key) || null;
    })();

    this.loadingPromises.set(key, promise);
    return promise;
  }

  async _decodePendingBuffers() {
    if (!this.ctx) return;
    for (const [key, relPath] of Object.entries(AUDIO_ASSET_PATHS)) {
      if (!this.buffers.has(key) && this.rawArrayBuffers.has(key)) {
        const raw = this.rawArrayBuffers.get(key);
        await this._decodeSingleBuffer(key, relPath, raw);
      }
    }
  }

  async _decodeSingleBuffer(key, relPath, rawBuffer) {
    if (!this.ctx || !rawBuffer) return null;
    try {
      const cloned = rawBuffer.slice(0);
      const audioBuffer = await this.ctx.decodeAudioData(cloned);
      if (audioBuffer) {
        this.buffers.set(key, audioBuffer);
        this.buffers.set(relPath, audioBuffer);
        // If this music track is currently active on the procedural fallback, crossfade into the real MP3
        if (
          this.musicPlaying &&
          !this.activeMusicSource &&
          (this.currentMusicTrack === key || this.currentMusicTrack === relPath)
        ) {
          this._startDecodedMusicOrFallback(this.currentMusicTrack);
        }
      }
      return audioBuffer;
    } catch (_err) {
      return null;
    }
  }

  /**
   * Maps worldX in [-18, +18] to StereoPannerNode.pan in [-0.85, +0.85]
   */
  worldXToPan(worldX = 0) {
    if (!Number.isFinite(worldX)) return 0;
    const normalized = Math.max(-1, Math.min(1, worldX / 18));
    return normalized * 0.85;
  }

  /**
   * Creates a positional StereoPannerNode connected to targetGain (defaults to sfxGain)
   * and executes `builderFn(pannerNode, ctx, now)`.
   */
  playPanned(worldX = 0, builderFn = null, targetBus = 'sfx') {
    if (this.muted) return null;
    const ctx = this.init();
    if (!ctx) return null;

    const busNode =
      targetBus === 'tts'
        ? this.ttsGain
        : targetBus === 'music'
          ? this.musicGain
          : this.sfxGain;

    let panner;
    if (typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(this.worldXToPan(worldX), ctx.currentTime);
      panner.connect(busNode);
    } else {
      panner = ctx.createGain();
      panner.connect(busNode);
    }

    if (typeof builderFn === 'function') {
      builderFn(panner, ctx, ctx.currentTime);
    }
    return panner;
  }

  /* ------------------------------------------------------------------------
     BACKGROUND MUSIC (Lyria 3 MP3s + Seamless Procedural Brass/Snare Fallback)
     ------------------------------------------------------------------------ */

  startMusic(track = 'grasslands_march') {
    const normalizedKey =
      track === 'air_raid_blitz' ||
      String(track).includes('air_raid') ||
      track === 'boss'
        ? 'air_raid_blitz'
        : 'grasslands_march';

    this.musicPlaying = true;
    if (this.currentMusicTrack === normalizedKey && (this.activeMusicSource || this._proceduralMarchTimer)) {
      return;
    }
    this.currentMusicTrack = normalizedKey;
    this.init();
    this._startDecodedMusicOrFallback(normalizedKey);
  }

  playMusic(track = 'grasslands_march') {
    this.startMusic(track);
  }

  switchMusic(isAirOrBoss = false) {
    const nextTrack = isAirOrBoss ? 'air_raid_blitz' : 'grasslands_march';
    if (this.currentMusicTrack !== nextTrack || !this.musicPlaying) {
      this.startMusic(nextTrack);
    }
  }

  _startDecodedMusicOrFallback(trackKey) {
    if (!this.musicPlaying) return;
    const ctx = this.ctx;
    if (!ctx) return;

    const buffer =
      this.buffers.get(trackKey) ||
      this.buffers.get(AUDIO_ASSET_PATHS[trackKey]);

    if (buffer) {
      this._stopProceduralMarch();
      this._crossfadeToBuffer(buffer);
    } else {
      // Ensure asset load is in flight and run procedural military march until decoded
      const relPath = AUDIO_ASSET_PATHS[trackKey] || AUDIO_ASSET_PATHS.grasslands_march;
      this._loadAsset(trackKey, relPath);
      this._startProceduralMarch(trackKey === 'air_raid_blitz');
    }
  }

  _crossfadeToBuffer(buffer) {
    if (!this.ctx || !buffer) return;
    const now = this.ctx.currentTime;

    if (this.activeMusicSource && this.activeMusicTrackGain) {
      const oldSource = this.activeMusicSource;
      const oldGain = this.activeMusicTrackGain;
      try {
        oldGain.gain.cancelScheduledValues(now);
        oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value), now);
        oldGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        oldSource.stop(now + 0.5);
      } catch (_e) {}
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const trackGain = this.ctx.createGain();
    trackGain.gain.setValueAtTime(0.0001, now);
    trackGain.gain.exponentialRampToValueAtTime(1.0, now + 0.55);

    source.connect(trackGain);
    trackGain.connect(this.musicGain);
    try {
      source.start(0);
      this.activeMusicSource = source;
      this.activeMusicTrackGain = trackGain;
    } catch (_e) {}
  }

  _startProceduralMarch(isAirBlitz = false) {
    if (this._proceduralMarchTimer) return;
    const stepMs = isAirBlitz ? 190 : 240;
    this._marchStep = 0;

    this._proceduralMarchTimer = setInterval(() => {
      if (!this.musicPlaying || this.muted || this.musicMuted || this.isPaused) return;
      if (this.activeMusicSource) {
        this._stopProceduralMarch();
        return;
      }
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const step = this._marchStep++ % 16;

      // Crisp military snare pattern on steps 0, 2, 3, 4, 6, 8, 10, 12, 14, 15
      if (step % 2 === 0 || step === 3 || step === 11 || step === 15) {
        this._triggerProceduralSnare(ctx, now, step % 4 === 0 ? 0.14 : 0.07);
      }

      // Warm tuba/brass bassline on beats 0, 4, 8, 12
      if (step % 4 === 0) {
        const bassNotes = isAirBlitz ? [110, 116.5, 130.8, 98] : [130.81, 98.0, 146.83, 98.0];
        const freq = bassNotes[(step / 4) % bassNotes.length];
        this._triggerProceduralBrass(ctx, now, freq, 0.2, 0.12);
      }

      // Heroic horn motif on steps 0, 3, 6, 8, 12
      const melodyMap = isAirBlitz
        ? { 0: 220, 3: 261.63, 6: 293.66, 8: 311.13, 12: 261.63 }
        : { 0: 261.63, 4: 329.63, 6: 392.0, 8: 440.0, 12: 392.0 };
      if (melodyMap[step]) {
        this._triggerProceduralBrass(ctx, now, melodyMap[step], 0.18, 0.09);
      }
    }, stepMs);
  }

  _stopProceduralMarch() {
    if (this._proceduralMarchTimer) {
      clearInterval(this._proceduralMarchTimer);
      this._proceduralMarchTimer = null;
    }
  }

  _triggerProceduralSnare(ctx, now, level) {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1650, now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(now);
    src.stop(now + 0.09);
  }

  _triggerProceduralBrass(ctx, now, freq, duration, level) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 3.2, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.6, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  stopMusic() {
    this.musicPlaying = false;
    this._stopProceduralMarch();
    if (this.activeMusicSource) {
      try {
        this.activeMusicSource.stop();
      } catch (_e) {}
      this.activeMusicSource = null;
      this.activeMusicTrackGain = null;
    }
  }

  setPaused(paused) {
    this.isPaused = Boolean(paused);
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const target = this.musicMuted
      ? 0.0001
      : this.isPaused
        ? this.musicVolume * 0.32
        : this.musicVolume;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(target, now, 0.08);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0.0001 : this.masterVolume,
        now,
        0.04
      );
    }
    return this.muted;
  }

  /* ------------------------------------------------------------------------
     TTS COMIC DEATH SCREAMS & COMMANDER CALLOUTS
     ------------------------------------------------------------------------ */

  /**
   * Plays a comic Argon Towers death scream ("Ah!", "Ooh!", "Ugh!") when allowSpokenWav is true
   * and outside the 9.5s spoken scream cooldown + 3.5s commander callout window; otherwise plays
   * a subtle, short (0.14s) non-verbal procedural comic impact grunt/pop with a 900ms cooldown.
   */
  playComicScream(worldX = 0, preferredClip = null, allowSpokenWav = false) {
    if (this.muted) return false;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const canPlaySpokenWav =
      Boolean(allowSpokenWav) &&
      nowMs - this._lastSpokenScreamTime >= this._spokenScreamCooldownMs &&
      nowMs - this._lastCommanderCalloutTime >= 3500;

    if (!canPlaySpokenWav && nowMs - this._lastScreamTime < this._screamCooldownMs) {
      return false;
    }

    this._lastScreamTime = nowMs;

    const screamKeys = ['scream_ah', 'scream_ooh', 'scream_ugh'];
    const chosenKey =
      preferredClip && screamKeys.includes(preferredClip)
        ? preferredClip
        : screamKeys[this._screamIndex++ % screamKeys.length];

    const pitchRate = 0.9 + Math.random() * 0.22; // 0.90x .. 1.12x

    if (canPlaySpokenWav) {
      this._lastSpokenScreamTime = nowMs;
      this.playPanned(
        worldX,
        (panner, ctx, now) => {
          const buf =
            this.buffers.get(chosenKey) ||
            this.buffers.get(AUDIO_ASSET_PATHS[chosenKey]);
          if (buf) {
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.playbackRate.setValueAtTime(pitchRate, now);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.76, now);
            src.connect(g);
            g.connect(panner);
            src.start(now);
          }
        },
        'tts'
      );
      return true;
    }

    // Subtle, short (0.14s) non-verbal procedural comic impact grunt/pop (86% of kills or on spoken cooldown)
    this.playPanned(
      worldX,
      (panner, ctx, now) => {
        const basePitch = 215 * pitchRate;
        const endPitch = 96 * pitchRate;

        const vocalOsc = ctx.createOscillator();
        vocalOsc.type = 'triangle';
        vocalOsc.frequency.setValueAtTime(basePitch, now);
        vocalOsc.frequency.exponentialRampToValueAtTime(endPitch, now + 0.13);

        const formant = ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.setValueAtTime(540, now);
        formant.Q.setValueAtTime(3.2, now);

        const synthGain = ctx.createGain();
        synthGain.gain.setValueAtTime(0.001, now);
        synthGain.gain.linearRampToValueAtTime(0.16, now + 0.015);
        synthGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

        vocalOsc.connect(formant);
        formant.connect(synthGain);
        synthGain.connect(panner);
        vocalOsc.start(now);
        vocalOsc.stop(now + 0.145);
      },
      'sfx'
    );

    return true;
  }

  /**
   * Plays a Commander tactical callout:
   * 'battle_stations' | 'air_raid' | 'zeppelin_boss' | 'path_blocked'
   */
  playCommanderCallout(calloutType = 'battle_stations', worldX = 0) {
    if (this.muted) return false;
    const keyMap = {
      battle_stations: 'cmd_battle_stations',
      cmd_battle_stations: 'cmd_battle_stations',
      air_raid: 'cmd_air_raid',
      cmd_air_raid: 'cmd_air_raid',
      zeppelin_boss: 'cmd_zeppelin_boss',
      cmd_zeppelin_boss: 'cmd_zeppelin_boss',
      boss: 'cmd_zeppelin_boss',
      path_blocked: 'cmd_path_blocked',
      cmd_path_blocked: 'cmd_path_blocked',
    };
    const clipKey = keyMap[calloutType] || 'cmd_battle_stations';

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const lastTime = this._lastCalloutTimes.get(clipKey) || 0;
    const minInterval = clipKey === 'cmd_path_blocked' ? 3200 : 4500;
    if (nowMs - lastTime < minInterval) return false;
    this._lastCalloutTimes.set(clipKey, nowMs);
    this._lastCommanderCalloutTime = nowMs;

    this.playPanned(
      worldX,
      (panner, ctx, now) => {
        // Walkie-talkie radio squelch chirp before commander voice
        const chirp = ctx.createOscillator();
        chirp.type = 'sine';
        chirp.frequency.setValueAtTime(1850, now);
        chirp.frequency.setValueAtTime(2420, now + 0.025);
        const chirpGain = ctx.createGain();
        chirpGain.gain.setValueAtTime(0.12, now);
        chirpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
        chirp.connect(chirpGain);
        chirpGain.connect(panner);
        chirp.start(now);
        chirp.stop(now + 0.06);

        const buf =
          this.buffers.get(clipKey) ||
          this.buffers.get(AUDIO_ASSET_PATHS[clipKey]);
        if (buf) {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.92, now + 0.05);
          src.connect(g);
          g.connect(panner);
          src.start(now + 0.05);
        } else {
          // Ensure load is triggered
          const relPath = AUDIO_ASSET_PATHS[clipKey];
          if (relPath) this._loadAsset(clipKey, relPath);
        }
      },
      'tts'
    );
    return true;
  }

  /* ------------------------------------------------------------------------
     POSITIONAL STEREO COMBAT & INTERACTION SFX
     ------------------------------------------------------------------------ */

  /**
   * Crisp, rapid percussive machine-gun chatter with metallic bolt click.
   */
  playGatlingShot(worldX = 0, tier = 1) {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this._lastShotTime < 32) return;
    this._lastShotTime = nowMs;

    this.playPanned(worldX, (panner, ctx, now) => {
      const pitchBoost = 1 + (Math.max(1, tier) - 1) * 0.12;

      // 1. Percussive muzzle pop
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(290 * pitchBoost, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + 0.048);

      const popGain = ctx.createGain();
      popGain.gain.setValueAtTime(0.32, now);
      popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.052);

      osc.connect(popGain);
      popGain.connect(panner);
      osc.start(now);
      osc.stop(now + 0.055);

      // 2. Metallic rotary bolt click & powder burst
      if (this.noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2600 * pitchBoost, now);
        bp.Q.setValueAtTime(2.4, now);

        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.26, now);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

        noise.connect(bp);
        bp.connect(ng);
        ng.connect(panner);
        noise.start(now, Math.random() * 0.5, 0.045);
      }
    });
  }

  playGatling(worldX = 0, tier = 1) {
    this.playGatlingShot(worldX, tier);
  }

  /**
   * Bubbly, viscous chemical squelch & hiss.
   */
  playGooSplat(worldX = 0, tier = 1) {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this._lastGooTime < 55) return;
    this._lastGooTime = nowMs;

    this.playPanned(worldX, (panner, ctx, now) => {
      // Viscous resonant filter sweep (squelch)
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(420 + tier * 40, now + 0.065);
      osc.frequency.exponentialRampToValueAtTime(115, now + 0.19);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(7.5, now);
      filter.frequency.setValueAtTime(340, now);
      filter.frequency.exponentialRampToValueAtTime(1280, now + 0.08);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.19);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.34, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      osc.start(now);
      osc.stop(now + 0.21);

      // Acidic hiss / bubble pop
      if (this.noiseBuffer) {
        const hiss = ctx.createBufferSource();
        hiss.buffer = this.noiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.setValueAtTime(3200, now);
        hp.Q.setValueAtTime(3.0, now);
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(0.14, now + 0.02);
        hg.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        hiss.connect(hp);
        hp.connect(hg);
        hg.connect(panner);
        hiss.start(now + 0.02, Math.random() * 0.4, 0.15);
      }
    });
  }

  playGoo(worldX = 0, tier = 1) {
    this.playGooSplat(worldX, tier);
  }

  /**
   * Hydraulic bay clank + punchy rocket whoosh.
   */
  playMissileLaunch(worldX = 0, tier = 1) {
    this.playPanned(worldX, (panner, ctx, now) => {
      // 1. Hydraulic launch rail clank
      const clank = ctx.createOscillator();
      clank.type = 'square';
      clank.frequency.setValueAtTime(520, now);
      clank.frequency.exponentialRampToValueAtTime(140, now + 0.045);

      const clankGain = ctx.createGain();
      clankGain.gain.setValueAtTime(0.24, now);
      clankGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      clank.connect(clankGain);
      clankGain.connect(panner);
      clank.start(now);
      clank.stop(now + 0.055);

      // 2. Punchy rocket motor ignition whoosh
      if (this.noiseBuffer) {
        const whoosh = ctx.createBufferSource();
        whoosh.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(1.6, now);
        filter.frequency.setValueAtTime(380, now + 0.02);
        filter.frequency.exponentialRampToValueAtTime(
          1650 + tier * 150,
          now + 0.14
        );
        filter.frequency.exponentialRampToValueAtTime(520, now + 0.36);

        const wg = ctx.createGain();
        wg.gain.setValueAtTime(0.001, now);
        wg.gain.linearRampToValueAtTime(0.38, now + 0.04);
        wg.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

        whoosh.connect(filter);
        filter.connect(wg);
        wg.connect(panner);
        whoosh.start(now, Math.random() * 0.4, 0.4);
      }
    });
  }

  playMissile(worldX = 0, tier = 1) {
    this.playMissileLaunch(worldX, tier);
  }

  /**
   * Deep bassy cartoon boom + debris crackle.
   */
  playExplosion(worldX = 0, isBig = false) {
    this.playPanned(worldX, (panner, ctx, now) => {
      const duration = isBig ? 0.68 : 0.38;
      const peakGain = isBig ? 0.56 : 0.38;

      // Sub-bass impact punch
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(isBig ? 125 : 155, now);
      sub.frequency.exponentialRampToValueAtTime(28, now + duration * 0.85);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(peakGain, now);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      sub.connect(subGain);
      subGain.connect(panner);
      sub.start(now);
      sub.stop(now + duration + 0.02);

      // Crunchy debris blast
      if (this.noiseBuffer) {
        const blast = ctx.createBufferSource();
        blast.buffer = this.noiseBuffer;

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(isBig ? 1400 : 1800, now);
        lp.frequency.exponentialRampToValueAtTime(180, now + duration);

        const bg = ctx.createGain();
        bg.gain.setValueAtTime(peakGain * 0.85, now);
        bg.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        blast.connect(lp);
        lp.connect(bg);
        bg.connect(panner);
        blast.start(now, Math.random() * 0.5, duration + 0.02);
      }
    });
  }

  /**
   * High-voltage electrostatic snap, transformer hum, and crackling arc.
   */
  playTeslaZap(worldX = 0, chainCount = 1) {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this._lastTeslaTime < 50) return;
    this._lastTeslaTime = nowMs;

    this.playPanned(worldX, (panner, ctx, now) => {
      const chains = Math.max(1, Math.min(6, chainCount));
      const zapDur = 0.16 + chains * 0.035;

      // 1. Transformer hum + high-voltage jagged FM carrier
      const carrier = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();

      carrier.type = 'sawtooth';
      carrier.frequency.setValueAtTime(920 + chains * 80, now);
      carrier.frequency.exponentialRampToValueAtTime(240, now + zapDur);

      mod.type = 'square';
      mod.frequency.setValueAtTime(118, now);
      modGain.gain.setValueAtTime(640, now);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      const zapGain = ctx.createGain();
      zapGain.gain.setValueAtTime(0.32, now);
      zapGain.gain.exponentialRampToValueAtTime(0.0001, now + zapDur);

      carrier.connect(zapGain);
      zapGain.connect(panner);
      carrier.start(now);
      mod.start(now);
      carrier.stop(now + zapDur + 0.02);
      mod.stop(now + zapDur + 0.02);

      // 2. Electrostatic snap crackle
      if (this.noiseBuffer) {
        const snap = ctx.createBufferSource();
        snap.buffer = this.noiseBuffer;

        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(2800, now);

        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.28, now);
        sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

        snap.connect(hp);
        hp.connect(sg);
        sg.connect(panner);
        snap.start(now, Math.random() * 0.6, 0.1);
      }
    });
  }

  playTesla(worldX = 0, chainCount = 1) {
    this.playTeslaZap(worldX, chainCount);
  }

  /**
   * Plays unit-specific death audio:
   * - Grunts / Bikers: comic death scream ("Ah!" / "Ooh!" / "Ugh!") + gold coin clink
   * - Transports / Choppers / Planes: metallic crash + scream + coin clink
   * - Mechs / Tanks / Zeppelins / Bosses: deep catastrophic explosion + horn + coin clink
   */
  playEnemyDeath(worldX = 0, enemyType = 'grunt') {
    if (typeof worldX === 'string') {
      enemyType = worldX;
      worldX = 0;
    }
    const t = String(enemyType || 'grunt').toLowerCase();
    const isBossOrHeavy =
      t.includes('mech') ||
      t.includes('zeppelin') ||
      t.includes('blimp') ||
      t.includes('tank') ||
      t.includes('boss');
    const isVehicleOrAir =
      t.includes('transport') ||
      t.includes('truck') ||
      t.includes('chopper') ||
      t.includes('heli') ||
      t.includes('plane') ||
      t.includes('fighter') ||
      t.includes('air');

    if (isBossOrHeavy) {
      this.playExplosion(worldX, true);
      // Catastrophic low brass horn groan
      this.playPanned(worldX, (panner, ctx, now) => {
        const horn = ctx.createOscillator();
        horn.type = 'sawtooth';
        horn.frequency.setValueAtTime(118, now);
        horn.frequency.exponentialRampToValueAtTime(52, now + 0.55);

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(420, now);

        const hg = ctx.createGain();
        hg.gain.setValueAtTime(0.32, now);
        hg.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);

        horn.connect(lp);
        lp.connect(hg);
        hg.connect(panner);
        horn.start(now);
        horn.stop(now + 0.6);
      });
    } else if (isVehicleOrAir) {
      this.playExplosion(worldX, false);
      this.playComicScream(worldX, 'scream_ooh', Math.random() < 0.14);
    } else {
      // Infantry / Grunt / Biker: 14% chance of spoken WAV scream (with 9.5s cooldown), 86% subtle non-verbal impact grunt
      this.playComicScream(worldX, null, Math.random() < 0.14);
    }

    // Subtle crisp gold coin clink on every kill
    this._playCoinClink(worldX, isBossOrHeavy ? 3 : 1);
  }

  _playCoinClink(worldX = 0, count = 1) {
    this.playPanned(worldX, (panner, ctx, now) => {
      for (let i = 0; i < count; i++) {
        const t0 = now + i * 0.055;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2150 + i * 240, t0);
        osc.frequency.setValueAtTime(2880 + i * 260, t0 + 0.035);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.11, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);

        osc.connect(gain);
        gain.connect(panner);
        osc.start(t0);
        osc.stop(t0 + 0.14);
      }
    });
  }

  /**
   * Heavy riveted steel thud + ratchet click.
   */
  playTowerPlace(worldX = 0) {
    this.playPanned(worldX, (panner, ctx, now) => {
      // Heavy steel thud
      const thud = ctx.createOscillator();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(165, now);
      thud.frequency.exponentialRampToValueAtTime(42, now + 0.14);

      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.45, now);
      tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      thud.connect(tg);
      tg.connect(panner);
      thud.start(now);
      thud.stop(now + 0.17);

      // Double mechanical ratchet click
      [0.04, 0.09].forEach((offset, idx) => {
        const click = ctx.createOscillator();
        click.type = 'triangle';
        click.frequency.setValueAtTime(880 + idx * 320, now + offset);
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.22, now + offset);
        cg.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.035);
        click.connect(cg);
        cg.connect(panner);
        click.start(now + offset);
        click.stop(now + offset + 0.04);
      });
    });
  }

  /**
   * Mechanical power-up chord + steam hiss.
   */
  playTowerUpgrade(worldX = 0, tier = 2) {
    this.playPanned(worldX, (panner, ctx, now) => {
      const notes = tier >= 3 ? [440, 554.37, 659.25, 880] : [392, 493.88, 587.33];
      notes.forEach((freq, idx) => {
        const t0 = now + idx * 0.055;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t0);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.24, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);

        osc.connect(g);
        g.connect(panner);
        osc.start(t0);
        osc.stop(t0 + 0.25);
      });

      // Pneumatic steam release hiss
      if (this.noiseBuffer) {
        const steam = ctx.createBufferSource();
        steam.buffer = this.noiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.setValueAtTime(4200, now + 0.08);
        hp.Q.setValueAtTime(2.0, now + 0.08);

        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.18, now + 0.08);
        sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

        steam.connect(hp);
        hp.connect(sg);
        sg.connect(panner);
        steam.start(now + 0.08, 0, 0.22);
      }
    });
  }

  /**
   * Wrench clank + cash register coin jingle.
   */
  playTowerSell(worldX = 0) {
    this.playPanned(worldX, (panner, ctx, now) => {
      // Metallic wrench clank
      const wrench = ctx.createOscillator();
      wrench.type = 'square';
      wrench.frequency.setValueAtTime(620, now);
      wrench.frequency.exponentialRampToValueAtTime(280, now + 0.07);

      const wg = ctx.createGain();
      wg.gain.setValueAtTime(0.22, now);
      wg.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      wrench.connect(wg);
      wg.connect(panner);
      wrench.start(now);
      wrench.stop(now + 0.09);

      // Cash register bell & coins
      [1318.5, 1760, 2637].forEach((freq, idx) => {
        const t0 = now + 0.05 + idx * 0.045;
        const bell = ctx.createOscillator();
        bell.type = 'sine';
        bell.frequency.setValueAtTime(freq, t0);

        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0.2, t0);
        bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        bell.connect(bg);
        bg.connect(panner);
        bell.start(t0);
        bell.stop(t0 + 0.19);
      });
    });
  }

  /**
   * Distinct low buzzer click.
   */
  playInvalidBuzz(worldX = 0) {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this._lastBuzzTime < 120) return;
    this._lastBuzzTime = nowMs;

    this.playPanned(worldX, (panner, ctx, now) => {
      const buzz = ctx.createOscillator();
      buzz.type = 'sawtooth';
      buzz.frequency.setValueAtTime(145, now);
      buzz.frequency.setValueAtTime(112, now + 0.07);

      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.3, now);
      bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

      buzz.connect(bg);
      bg.connect(panner);
      buzz.start(now);
      buzz.stop(now + 0.18);
    });
  }

  /**
   * Low buzzer click + rate-limited Commander "Path blocked" callout.
   */
  playInvalidPlacement(worldX = 0, isPathBlocked = true) {
    this.playInvalidBuzz(worldX);
    if (isPathBlocked) {
      this.playCommanderCallout('path_blocked', worldX);
    }
  }

  /**
   * Wave start brass horn / air-raid siren + Commander callout.
   * Supports:
   * - Options object: { round, isAirWave, isBossWave, hasChoppers, hasZeppelin }
   * - Positional with round: (round, isBossWave, isAirWave)
   * - Boolean positional: (isAirWave, isBossWave)
   */
  playWaveStartHorn(arg1 = false, arg2 = false, arg3 = false) {
    let round = 0;
    let isAirWave = false;
    let isBossWave = false;
    let hasChoppers = false;
    let hasZeppelin = false;

    if (arg1 && typeof arg1 === 'object') {
      round = typeof arg1.round === 'number' ? arg1.round : 0;
      hasChoppers = Boolean(arg1.hasChoppers ?? arg1.isAirWave);
      hasZeppelin = Boolean(arg1.hasZeppelin);
      isAirWave = Boolean(arg1.isAirWave ?? hasChoppers);
      isBossWave = Boolean(arg1.isBossWave ?? hasZeppelin);
    } else if (typeof arg1 === 'number') {
      round = arg1;
      isBossWave = Boolean(arg2);
      isAirWave = Boolean(arg3);
      hasChoppers = isAirWave;
      hasZeppelin = Boolean(isBossWave && (round >= 30 || isAirWave));
    } else {
      isAirWave = Boolean(arg1);
      isBossWave = Boolean(arg2);
      hasChoppers = isAirWave;
      hasZeppelin = isBossWave;
    }

    this.playPanned(0, (panner, ctx, now) => {
      if (isAirWave || hasChoppers) {
        // Dual-tone rising air-raid siren
        [320, 415].forEach((baseFreq) => {
          const siren = ctx.createOscillator();
          siren.type = 'sawtooth';
          siren.frequency.setValueAtTime(baseFreq, now);
          siren.frequency.exponentialRampToValueAtTime(baseFreq * 1.85, now + 0.45);
          siren.frequency.exponentialRampToValueAtTime(baseFreq * 1.15, now + 0.78);

          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(1400, now);

          const sg = ctx.createGain();
          sg.gain.setValueAtTime(0.001, now);
          sg.gain.linearRampToValueAtTime(0.22, now + 0.06);
          sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

          siren.connect(lp);
          lp.connect(sg);
          sg.connect(panner);
          siren.start(now);
          siren.stop(now + 0.82);
        });
      } else {
        // Short military brass bugle horn (0.18s, gentle gain 0.16)
        const notes = isBossWave ? [196, 261.63, 311.13] : [261.63, 329.63, 392.0];
        notes.forEach((freq, idx) => {
          const t0 = now + idx * 0.06;
          const horn = ctx.createOscillator();
          horn.type = 'sawtooth';
          horn.frequency.setValueAtTime(freq, t0);

          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(1200, t0);

          const g = ctx.createGain();
          g.gain.setValueAtTime(0.16, t0);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);

          horn.connect(lp);
          lp.connect(g);
          g.connect(panner);
          horn.start(t0);
          horn.stop(t0 + 0.19);
        });
      }
    });

    if (hasZeppelin) {
      this.playCommanderCallout('zeppelin_boss');
      this.switchMusic(true);
    } else if (hasChoppers) {
      this.playCommanderCallout('air_raid');
      this.switchMusic(true);
    } else if (round === 1) {
      this.playCommanderCallout('battle_stations');
      this.switchMusic(false);
    } else {
      // Normal ground wave (round >= 2 with no air/zeppelin): horn only, no repetitive spoken callout
      this.switchMusic(Boolean(isBossWave));
    }
  }

  playWaveStart(arg1 = false, arg2 = false, arg3 = false) {
    this.playWaveStartHorn(arg1, arg2, arg3);
  }

  /**
   * Triumphant military brass victory fanfare.
   */
  playVictoryFanfare() {
    this.playPanned(0, (panner, ctx, now) => {
      const chordSeq = [
        { freq: 261.63, t: 0.0, d: 0.14 },
        { freq: 329.63, t: 0.12, d: 0.14 },
        { freq: 392.0, t: 0.24, d: 0.14 },
        { freq: 523.25, t: 0.38, d: 0.48 },
        { freq: 392.0, t: 0.38, d: 0.48 },
      ];
      chordSeq.forEach((n) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.freq, now + n.t);

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1800, now + n.t);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.26, now + n.t);
        g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);

        osc.connect(lp);
        lp.connect(g);
        g.connect(panner);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.02);
      });
    });
  }

  playLifeLost(worldX = 14) {
    this.playPanned(worldX, (panner, ctx, now) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(88, now + 0.26);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.35, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(g);
      g.connect(panner);
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  playButtonClick() {
    this.playPanned(0, (panner, ctx, now) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.03);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
      osc.connect(g);
      g.connect(panner);
      osc.start(now);
      osc.stop(now + 0.04);
    });
  }
}

/* ==========================================================================
   2. ARGON TOWERS DIEGETIC HUD (ArgonTowersHUD)
   ========================================================================== */

class ArgonTowersHUD {
  constructor(containerOrOptions = {}, maybeCallbacks = {}) {
    let options = {};
    if (
      typeof HTMLElement !== 'undefined' &&
      containerOrOptions instanceof HTMLElement
    ) {
      options = { ...maybeCallbacks, container: containerOrOptions };
    } else if (containerOrOptions && typeof containerOrOptions === 'object') {
      options = { ...containerOrOptions, ...maybeCallbacks };
    }

    this.options = options;
    this.audio =
      options.audio ||
      (typeof window !== 'undefined' && window.argonTowersAudio) ||
      new ArgonTowersAudio();

    this.callbacks = {
      onTogglePause: options.onTogglePause || options.onPause || null,
      onSpeedChange: options.onSpeedChange || options.onToggleSpeed || null,
      onNextWave: options.onNextWave || options.onEarlyWave || null,
      onSelectTower: options.onSelectTower || options.onTowerSelect || null,
      onCancelPlacement: options.onCancelPlacement || null,
      onPlaceTowerAtScreen:
        options.onPlaceTowerAtScreen || options.onDropTower || null,
      onUpgradeTower: options.onUpgradeTower || options.onUpgrade || null,
      onSellTower: options.onSellTower || options.onSell || null,
      onCyclePriority:
        options.onCyclePriority || options.onPriorityChange || null,
      onLoadDemoMaze:
        options.onLoadDemoMaze || options.onBuildSerpentineMaze || null,
      onJumpToRound: options.onJumpToRound || options.onSelectRound || null,
      onToggleFlowField:
        options.onToggleFlowField || options.onToggleGrid || null,
      onRestart: options.onRestart || null,
      onContinueEndless: options.onContinueEndless || null,
    };

    // Merge any custom tower defs with defaults
    this.towerDefs = { ...DEFAULT_TOWER_DEFS };
    if (options.towerDefs && typeof options.towerDefs === 'object') {
      this._mergeTowerDefs(options.towerDefs);
    }

    // Live state
    this.state = {
      gold: typeof options.gold === 'number' ? options.gold : 150,
      score: typeof options.score === 'number' ? options.score : 0,
      displayedScore: typeof options.score === 'number' ? options.score : 0,
      round: typeof options.round === 'number' ? options.round : 1,
      maxRounds: typeof options.maxRounds === 'number' ? options.maxRounds : 100,
      lives: typeof options.lives === 'number' ? options.lives : 20,
      paused: Boolean(options.paused),
      speed: typeof options.speed === 'number' ? options.speed : 1,
      waveActive: Boolean(options.waveActive),
      waveCooldown: typeof options.waveCooldown === 'number' ? options.waveCooldown : 0,
      waveProgress: 0,
      buildPhase:
        options.buildPhase !== undefined ? Boolean(options.buildPhase) : !options.waveActive,
      waveStartedOnce: Boolean(options.waveStartedOnce || options.waveActive),
      showFlowField: Boolean(options.showFlowField),
      selectedTowerType: null,
      selectedTower: null,
    };

    this.camera = options.camera || null;
    this.canvas = options.canvas || null;

    this.unlockedAchievements = new Set();
    this._dragState = null;
    this._gearMenuOpen = false;
    this._bannerTimeout = null;

    this._injectStyles();
    this._buildDOM(options.container);
    this._bindEvents();
    this.update(this.state);
  }

  _mergeTowerDefs(customDefs) {
    for (const key of ['gatling', 'goo', 'missile', 'tesla']) {
      const custom =
        customDefs[key] ||
        customDefs[key.toUpperCase()] ||
        (Array.isArray(customDefs)
          ? customDefs.find((d) => String(d.id || d.type).toLowerCase() === key)
          : null);
      if (custom && typeof custom === 'object') {
        this.towerDefs[key] = {
          ...this.towerDefs[key],
          ...custom,
          cost:
            typeof custom.cost === 'number'
              ? custom.cost
              : Array.isArray(custom.costs)
                ? custom.costs[0]
                : this.towerDefs[key].cost,
        };
      }
    }
  }

  setCallbacks(newCallbacks = {}) {
    Object.assign(this.callbacks, newCallbacks);
  }

  setCamera(camera, canvas = null) {
    this.camera = camera;
    if (canvas) this.canvas = canvas;
  }

  /* ------------------------------------------------------------------------
     SELF-CONTAINED CSS INJECTION (1:1 Argon Towers Aesthetic)
     ------------------------------------------------------------------------ */

  _injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('argon-towers-hud-styles')) return;

    const style = document.createElement('style');
    style.id = 'argon-towers-hud-styles';
    style.textContent = `
      #hud-root, .fr-hud-overlay {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
        z-index: 40;
        font-family: 'Impact', 'Arial Black', 'Trebuchet MS', system-ui, sans-serif;
        overflow: hidden;
      }

      /* Outline text helper matching Argon Towers bold comic/military typography */
      .fr-outlined-text {
        color: #fffef5;
        text-shadow:
          -2px -2px 0 #141008,
           2px -2px 0 #141008,
          -2px  2px 0 #141008,
           2px  2px 0 #141008,
           0px  3px 0 #0c0904,
           0px  5px 8px rgba(0, 0, 0, 0.78);
        letter-spacing: 0.6px;
      }

      .fr-gold-text {
        background: linear-gradient(180deg, #fff89e 0%, #ffd428 48%, #d98200 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0px 2px 0px #160f03)
                drop-shadow(-1.5px -1.5px 0px #160f03)
                drop-shadow(1.5px -1.5px 0px #160f03)
                drop-shadow(-1.5px 1.5px 0px #160f03)
                drop-shadow(1.5px 1.5px 0px #160f03)
                drop-shadow(0px 4px 6px rgba(0,0,0,0.75));
      }

      /* ================= TOP BAR ================= */
      .fr-top-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding: 8px 18px 0 14px;
        pointer-events: none;
      }

      /* Top-Left Gold Readout */
      .fr-gold-cluster {
        position: relative;
        display: flex;
        align-items: center;
        gap: 6px;
        pointer-events: auto;
        transform-origin: left center;
        transition: transform 0.14s cubic-bezier(0.22, 1.4, 0.36, 1);
      }
      .fr-gold-cluster.fr-pulse-gain {
        transform: scale(1.13);
      }
      .fr-gold-cluster.fr-pulse-deny {
        animation: frShake 0.32s ease;
      }
      .fr-dollar-emblem {
        width: 40px;
        height: 46px;
        flex-shrink: 0;
        filter: drop-shadow(0 3px 5px rgba(0,0,0,0.75));
      }
      .fr-gold-value {
        font-size: 32px;
        font-weight: 900;
        line-height: 1;
        margin-top: -2px;
      }
      .fr-gold-deltas {
        position: absolute;
        left: 46px;
        top: 38px;
        pointer-events: none;
      }
      .fr-gold-delta-item {
        position: absolute;
        left: 0;
        top: 0;
        font-size: 20px;
        font-weight: 900;
        white-space: nowrap;
        animation: frFloatDelta 0.95s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .fr-gold-delta-item.positive {
        color: #6bff4f;
        text-shadow: -2px -2px 0 #0d2606, 2px -2px 0 #0d2606, -2px 2px 0 #0d2606, 2px 2px 0 #0d2606, 0 3px 6px rgba(0,0,0,0.8);
      }
      .fr-gold-delta-item.negative {
        color: #ff5656;
        text-shadow: -2px -2px 0 #2b0505, 2px -2px 0 #2b0505, -2px 2px 0 #2b0505, 2px 2px 0 #2b0505, 0 3px 6px rgba(0,0,0,0.8);
      }

      /* Top-Center Score & Round / PAUSED Readout */
      .fr-center-cluster {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        margin-top: -1px;
        pointer-events: none;
      }
      .fr-score-value {
        font-size: 30px;
        font-weight: 900;
        line-height: 1.02;
        letter-spacing: 1px;
      }
      .fr-round-label {
        font-size: 25px;
        font-weight: 900;
        line-height: 1.05;
        margin-top: 1px;
      }
      .fr-round-label.is-paused {
        color: #ffbe26;
        letter-spacing: 2.2px;
        text-shadow:
          -2px -2px 0 #1f1200,
           2px -2px 0 #1f1200,
          -2px  2px 0 #1f1200,
           2px  2px 0 #1f1200,
           0px  3px 8px rgba(255, 168, 0, 0.55);
        animation: frPausePulse 1.2s ease-in-out infinite alternate;
      }
      .fr-wave-progress-wrap {
        width: 126px;
        height: 5px;
        background: rgba(15, 18, 12, 0.72);
        border: 1.5px solid rgba(255, 230, 140, 0.45);
        border-radius: 999px;
        margin-top: 4px;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0,0,0,0.6);
      }
      .fr-wave-progress-bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #80e818 0%, #ffd426 100%);
        transition: width 0.2s ease;
      }

      /* Top-Right Lives & Ruby Heart */
      .fr-lives-cluster {
        display: flex;
        align-items: center;
        gap: 7px;
        pointer-events: auto;
        transform-origin: right center;
      }
      .fr-lives-cluster.fr-life-lost {
        animation: frHeartDamage 0.48s cubic-bezier(0.36, 0.07, 0.19, 0.97);
      }
      .fr-lives-value {
        font-size: 31px;
        font-weight: 900;
        line-height: 1;
      }
      .fr-heart-icon {
        width: 40px;
        height: 38px;
        filter: drop-shadow(0 3px 5px rgba(0,0,0,0.78));
      }

      /* ================= BOTTOM-LEFT CONTROL CLUSTER ================= */
      .fr-bottom-left-controls {
        position: absolute;
        left: 14px;
        bottom: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        pointer-events: auto;
      }

      .fr-ctrl-btn {
        position: relative;
        width: 52px;
        height: 52px;
        border: none;
        background: transparent;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 3px 5px rgba(0,0,0,0.82));
        transition: transform 0.12s ease, filter 0.15s ease;
      }
      .fr-ctrl-btn:hover {
        transform: scale(1.1) translateY(-1px);
        filter: drop-shadow(0 0 10px rgba(255, 200, 45, 0.65)) drop-shadow(0 4px 6px rgba(0,0,0,0.85));
      }
      .fr-ctrl-btn:active {
        transform: scale(0.94);
      }
      .fr-ctrl-btn.is-active {
        filter: drop-shadow(0 0 12px rgba(255, 214, 40, 0.9)) drop-shadow(0 3px 5px rgba(0,0,0,0.85));
      }
      .fr-ctrl-badge {
        position: absolute;
        bottom: -2px;
        right: -3px;
        background: linear-gradient(180deg, #ffe66d 0%, #f59e0b 100%);
        color: #1c1202;
        border: 2px solid #1c1202;
        border-radius: 9px;
        font-size: 11px;
        font-weight: 900;
        padding: 0px 5px;
        line-height: 1.25;
        box-shadow: 0 2px 4px rgba(0,0,0,0.65);
      }

      /* Early Wave Call Button */
      .fr-wave-call-btn {
        height: 44px;
        padding: 0 13px;
        border-radius: 22px;
        border: 3px solid #1e1505;
        background: linear-gradient(180deg, #ffd84a 0%, #f59e0b 55%, #b86200 100%);
        color: #1f1300;
        font-family: inherit;
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 0.7px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        box-shadow: inset 0 2px 1px rgba(255,255,255,0.65), 0 4px 8px rgba(0,0,0,0.75);
        transition: transform 0.12s ease, filter 0.15s ease;
      }
      .fr-wave-call-btn:hover {
        transform: scale(1.06) translateY(-1px);
        filter: brightness(1.08);
      }
      .fr-wave-call-btn:active {
        transform: scale(0.95);
      }
      .fr-wave-call-btn.cooldown-ready {
        animation: frWaveCallPulse 1.1s ease-in-out infinite alternate;
      }
      .fr-wave-bonus-tag {
        background: #22540f;
        color: #9eff47;
        border: 1.5px solid #102905;
        border-radius: 8px;
        padding: 1px 5px;
        font-size: 11px;
        font-weight: 900;
      }

      /* Tactical Gear Popover Menu */
      .fr-gear-popover {
        position: absolute;
        left: 14px;
        bottom: 72px;
        width: 276px;
        background: linear-gradient(180deg, #2b3024 0%, #1a1e16 100%);
        border: 3px solid #c89d3c;
        border-radius: 14px;
        padding: 12px;
        box-shadow: 0 12px 28px rgba(0,0,0,0.88), inset 0 1px 0 rgba(255,235,160,0.28);
        pointer-events: auto;
        display: none;
        flex-direction: column;
        gap: 8px;
        z-index: 60;
      }
      .fr-gear-popover.is-open {
        display: flex;
        animation: frPopIn 0.16s cubic-bezier(0.2, 1.3, 0.4, 1);
      }
      .fr-gear-title {
        font-size: 13px;
        font-weight: 900;
        color: #ffd644;
        letter-spacing: 1.1px;
        text-transform: uppercase;
        border-bottom: 1.5px solid rgba(200, 157, 60, 0.35);
        padding-bottom: 5px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .fr-gear-btn {
        width: 100%;
        padding: 7px 10px;
        border-radius: 8px;
        border: 2px solid #141810;
        background: linear-gradient(180deg, #475239 0%, #2d3523 100%);
        color: #f6f7eb;
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 800;
        text-align: left;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
        transition: background 0.12s ease, transform 0.1s ease;
      }
      .fr-gear-btn:hover {
        background: linear-gradient(180deg, #5c6b49 0%, #3b462e 100%);
        transform: translateX(2px);
      }
      .fr-gear-btn.accent {
        background: linear-gradient(180deg, #76b81b 0%, #467509 100%);
        color: #fff;
      }
      .fr-gear-rounds-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
      }

      /* ================= BOTTOM-RIGHT TOWER DOCK ================= */
      .fr-tower-dock {
        position: absolute;
        right: 14px;
        bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        pointer-events: auto;
      }

      .fr-tower-btn {
        position: relative;
        width: 76px;
        height: 76px;
        border-radius: 50%;
        border: 3.5px solid #1a2112;
        background: radial-gradient(circle at 36% 28%, #dcff5c 0%, #92e600 48%, #4da300 84%, #2c6100 100%);
        box-shadow:
          inset 0 3px 4px rgba(255, 255, 255, 0.68),
          inset 0 -4px 6px rgba(18, 42, 0, 0.75),
          0 5px 10px rgba(0, 0, 0, 0.82);
        cursor: grab;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.14s cubic-bezier(0.22, 1.4, 0.36, 1), filter 0.15s ease, box-shadow 0.15s ease;
        touch-action: none;
      }
      .fr-tower-btn::before {
        content: '';
        position: absolute;
        inset: 2px;
        border-radius: 50%;
        border: 1.5px solid rgba(255, 255, 255, 0.42);
        pointer-events: none;
      }
      .fr-tower-btn:hover:not(.is-unaffordable) {
        transform: translateY(-4px) scale(1.06);
        filter: brightness(1.06);
      }
      .fr-tower-btn:active:not(.is-unaffordable) {
        transform: translateY(0px) scale(0.96);
        cursor: grabbing;
      }
      .fr-tower-btn.is-selected {
        transform: translateY(-6px) scale(1.09);
        border-color: #ffe853;
        box-shadow:
          0 0 0 3px #1a2112,
          0 0 18px rgba(255, 230, 64, 0.95),
          inset 0 3px 4px rgba(255, 255, 255, 0.8);
      }
      .fr-tower-btn.is-unaffordable {
        filter: grayscale(0.88) brightness(0.68) contrast(0.92);
        cursor: not-allowed;
      }
      .fr-tower-svg {
        width: 66px;
        height: 66px;
        pointer-events: none;
        overflow: visible;
      }

      /* Iconic Yellow Pill Price Tag tucked into Bottom-Right of each circle */
      .fr-price-pill {
        position: absolute;
        right: -4px;
        bottom: -2px;
        min-width: 38px;
        height: 22px;
        padding: 0 6px;
        border-radius: 11px;
        border: 2.2px solid #1b1404;
        background: linear-gradient(180deg, #fff375 0%, #ffd01c 55%, #e09000 100%);
        color: #181102;
        font-size: 14.5px;
        font-weight: 900;
        line-height: 18px;
        text-align: center;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.75);
        pointer-events: none;
      }
      .fr-tower-btn.is-unaffordable .fr-price-pill {
        background: linear-gradient(180deg, #b8bca8 0%, #7d8270 100%);
        color: #262822;
      }

      /* Tower Dock Hover Tooltip & Active Placement Hint */
      .fr-dock-tooltip {
        position: absolute;
        right: 16px;
        bottom: 92px;
        background: rgba(20, 25, 16, 0.94);
        border: 2px solid #a8d930;
        border-radius: 10px;
        padding: 7px 12px;
        color: #f4f7ec;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 12px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.8);
        pointer-events: none;
        display: none;
        max-width: 280px;
      }
      .fr-dock-tooltip.is-visible {
        display: block;
      }
      .fr-dock-tooltip-title {
        font-weight: 800;
        color: #b8ff3c;
        font-size: 13px;
        margin-bottom: 2px;
      }

      /* Drag / Placement Cursor Ghost */
      .fr-drag-ghost {
        position: fixed;
        left: 0;
        top: 0;
        width: 68px;
        height: 68px;
        margin-left: -34px;
        margin-top: -34px;
        border-radius: 50%;
        border: 2.5px dashed #bdf53c;
        background: radial-gradient(circle, rgba(164, 240, 32, 0.35) 0%, rgba(70, 140, 10, 0.12) 100%);
        pointer-events: none;
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 80;
        filter: drop-shadow(0 6px 10px rgba(0,0,0,0.65));
      }
      .fr-drag-ghost.is-active {
        display: flex;
      }

      /* ================= RADIAL TOWER INTERACTION RING ================= */
      .fr-radial-ring {
        position: absolute;
        left: 0;
        top: 0;
        width: 176px;
        height: 176px;
        margin-left: -88px;
        margin-top: -88px;
        border-radius: 50%;
        border: 3px dashed rgba(212, 255, 94, 0.85);
        box-shadow:
          0 0 0 2px rgba(20, 28, 12, 0.75),
          inset 0 0 22px rgba(166, 240, 40, 0.22);
        pointer-events: none;
        display: none;
        z-index: 55;
      }
      .fr-radial-ring.is-open {
        display: block;
        animation: frRingPop 0.15s cubic-bezier(0.22, 1.4, 0.36, 1);
      }

      .fr-radial-bubble {
        position: absolute;
        width: 58px;
        height: 58px;
        border-radius: 50%;
        border: 3px solid #182010;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        pointer-events: auto;
        box-shadow: 0 5px 12px rgba(0,0,0,0.85), inset 0 2px 2px rgba(255,255,255,0.6);
        transition: transform 0.12s ease, filter 0.12s ease;
        padding: 0;
        font-family: inherit;
      }
      .fr-radial-bubble:hover {
        transform: scale(1.12);
        filter: brightness(1.08);
      }
      .fr-radial-bubble:active {
        transform: scale(0.95);
      }

      /* Left Bubble: Upgrade */
      .fr-radial-upgrade {
        left: -26px;
        top: 56px;
        background: radial-gradient(circle at 35% 30%, #dcff5c 0%, #86df00 55%, #3d8800 100%);
        color: #141c06;
      }
      .fr-radial-upgrade.is-max {
        background: radial-gradient(circle at 35% 30%, #ffe875 0%, #d49400 75%, #7a5200 100%);
        cursor: default;
      }
      .fr-radial-upgrade.is-unaffordable {
        filter: grayscale(0.85) brightness(0.7);
        cursor: not-allowed;
      }

      /* Right Bubble: Sell */
      .fr-radial-sell {
        right: -26px;
        top: 56px;
        background: radial-gradient(circle at 35% 30%, #ffe268 0%, #f59e0b 55%, #b35300 100%);
        color: #1f1102;
      }

      .fr-radial-bubble-label {
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.4px;
        line-height: 1;
        margin-top: 1px;
      }
      .fr-radial-bubble-price {
        position: absolute;
        bottom: -7px;
        background: #1b1608;
        color: #ffe34d;
        border: 1.5px solid #ffd230;
        border-radius: 8px;
        padding: 0 5px;
        font-size: 11.5px;
        font-weight: 900;
        line-height: 1.25;
      }

      /* Bottom Pill: Target Priority + Tower Tier & Kills */
      .fr-radial-bottom-pill {
        position: absolute;
        left: 50%;
        bottom: -36px;
        transform: translateX(-50%);
        min-width: 172px;
        background: linear-gradient(180deg, #2b3322 0%, #171c12 100%);
        border: 2.5px solid #a9dc38;
        border-radius: 14px;
        padding: 4px 10px;
        color: #f6f8ef;
        pointer-events: auto;
        cursor: pointer;
        box-shadow: 0 6px 14px rgba(0,0,0,0.85);
        text-align: center;
      }
      .fr-radial-bottom-pill:hover {
        border-color: #ffe252;
      }
      .fr-radial-tower-header {
        font-size: 11.5px;
        font-weight: 900;
        color: #d8ff66;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .fr-radial-priority-row {
        font-family: system-ui, sans-serif;
        font-size: 11px;
        font-weight: 700;
        color: #ffd54a;
        margin-top: 1px;
      }
      .fr-radial-stat-preview {
        position: absolute;
        left: 50%;
        top: -34px;
        transform: translateX(-50%);
        white-space: nowrap;
        background: rgba(18, 24, 12, 0.94);
        border: 1.5px solid #ffd438;
        border-radius: 8px;
        padding: 3px 8px;
        color: #b8ff4a;
        font-family: system-ui, sans-serif;
        font-size: 11px;
        font-weight: 700;
        pointer-events: none;
        display: none;
      }
      .fr-radial-stat-preview.is-visible {
        display: block;
      }

      /* ================= DIEGETIC WAVE BANNER & ACHIEVEMENTS ================= */
      .fr-wave-banner {
        position: absolute;
        top: 66px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        min-width: 320px;
        max-width: 520px;
        background: linear-gradient(180deg, rgba(42, 48, 36, 0.95) 0%, rgba(22, 26, 18, 0.96) 100%);
        border: 3px solid #d4a438;
        border-radius: 12px;
        padding: 8px 20px;
        text-align: center;
        box-shadow: 0 10px 24px rgba(0,0,0,0.85);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.22, 1.35, 0.36, 1);
      }
      .fr-wave-banner.is-visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      .fr-wave-banner.is-air-warning {
        border-color: #ff4d3d;
        background: linear-gradient(180deg, rgba(72, 18, 14, 0.95) 0%, rgba(36, 10, 8, 0.96) 100%);
      }
      .fr-wave-banner-title {
        font-size: 20px;
        font-weight: 900;
        color: #ffe259;
        letter-spacing: 1.2px;
        text-transform: uppercase;
      }
      .fr-wave-banner.is-air-warning .fr-wave-banner-title {
        color: #ff6e59;
      }
      .fr-wave-banner-sub {
        font-family: system-ui, sans-serif;
        font-size: 12.5px;
        font-weight: 800;
        color: #f3f5ea;
        margin-top: 2px;
      }

      /* Achievement Medal Toast */
      .fr-achievement-stack {
        position: absolute;
        top: 64px;
        right: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
        z-index: 65;
      }
      .fr-achievement-toast {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 268px;
        background: linear-gradient(180deg, #3a311b 0%, #211b0d 100%);
        border: 2.5px solid #ffd23f;
        border-radius: 12px;
        padding: 8px 12px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.85);
        animation: frToastSlideIn 0.28s cubic-bezier(0.2, 1.3, 0.4, 1);
      }
      .fr-achievement-medal {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #fff48f 0%, #f5b100 65%, #995c00 100%);
        border: 2px solid #1c1302;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      .fr-achievement-title {
        font-size: 13px;
        font-weight: 900;
        color: #ffe047;
        letter-spacing: 0.6px;
      }
      .fr-achievement-desc {
        font-family: system-ui, sans-serif;
        font-size: 11px;
        font-weight: 600;
        color: #e8e6d5;
      }

      /* Floating World/Screen Callouts */
      .fr-floating-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
      }
      .fr-floating-callout {
        position: absolute;
        transform: translate(-50%, -50%);
        font-size: 17px;
        font-weight: 900;
        white-space: nowrap;
        animation: frFloatingCallout 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      /* Game Over / Victory Modal */
      .fr-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(8, 12, 6, 0.76);
        backdrop-filter: blur(4px);
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        z-index: 90;
      }
      .fr-modal-backdrop.is-open {
        display: flex;
      }
      .fr-modal-card {
        width: 400px;
        max-width: 92vw;
        background: linear-gradient(180deg, #313828 0%, #1b2016 100%);
        border: 4px solid #d4a638;
        border-radius: 18px;
        padding: 22px 24px;
        text-align: center;
        color: #f7f8f0;
        box-shadow: 0 20px 50px rgba(0,0,0,0.92);
      }
      .fr-modal-heading {
        font-size: 34px;
        font-weight: 900;
        letter-spacing: 1.5px;
        margin: 0 0 6px 0;
      }
      .fr-modal-stats {
        margin: 14px 0 18px;
        background: rgba(12, 16, 9, 0.65);
        border: 1.5px solid rgba(212, 166, 56, 0.4);
        border-radius: 12px;
        padding: 10px 14px;
        font-family: system-ui, sans-serif;
        font-size: 13.5px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .fr-modal-stat-row {
        display: flex;
        justify-content: space-between;
        font-weight: 700;
      }
      .fr-modal-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
      }
      .fr-modal-btn {
        padding: 10px 18px;
        border-radius: 12px;
        border: 3px solid #181f0e;
        background: linear-gradient(180deg, #a6ef22 0%, #58a600 100%);
        color: #131c05;
        font-family: inherit;
        font-size: 16px;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.75);
      }
      .fr-modal-btn.secondary {
        background: linear-gradient(180deg, #ffd84d 0%, #d48800 100%);
      }

      @keyframes frFloatDelta {
        0% { opacity: 1; transform: translateY(0) scale(0.9); }
        25% { opacity: 1; transform: translateY(-8px) scale(1.08); }
        100% { opacity: 0; transform: translateY(-28px) scale(0.96); }
      }
      @keyframes frFloatingCallout {
        0% { opacity: 1; transform: translate(-50%, -50%) scale(0.85); }
        20% { opacity: 1; transform: translate(-50%, -70%) scale(1.08); }
        100% { opacity: 0; transform: translate(-50%, -135%) scale(0.95); }
      }
      @keyframes frShake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-6px); }
        50% { transform: translateX(6px); }
        75% { transform: translateX(-4px); }
      }
      @keyframes frHeartDamage {
        0%, 100% { transform: scale(1); }
        25% { transform: scale(1.28) rotate(-8deg); filter: brightness(1.5); }
        55% { transform: scale(0.86) rotate(6deg); }
      }
      @keyframes frPausePulse {
        0% { transform: scale(0.98); opacity: 0.88; }
        100% { transform: scale(1.04); opacity: 1; }
      }
      @keyframes frWaveCallPulse {
        0% { box-shadow: 0 0 0 0 rgba(255, 214, 46, 0.7), 0 4px 8px rgba(0,0,0,0.75); }
        100% { box-shadow: 0 0 16px 4px rgba(255, 214, 46, 0.85), 0 4px 8px rgba(0,0,0,0.75); }
      }
      @keyframes frRingPop {
        0% { transform: scale(0.65); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes frPopIn {
        0% { transform: translateY(8px) scale(0.95); opacity: 0; }
        100% { transform: translateY(0) scale(1); opacity: 1; }
      }
      @keyframes frToastSlideIn {
        0% { transform: translateX(40px); opacity: 0; }
        100% { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------------
     DOM CONSTRUCTION (1:1 Match with Argon Towers Reference)
     ------------------------------------------------------------------------ */

  _buildDOM(customContainer = null) {
    if (typeof document === 'undefined') return;

    let root =
      customContainer ||
      document.getElementById('hud-root') ||
      document.querySelector('.fr-hud-overlay');

    if (!root) {
      root = document.createElement('div');
      root.id = 'hud-root';
      document.body.appendChild(root);
    }
    root.classList.add('fr-hud-overlay');
    this.root = root;

    this.root.innerHTML = `
      <!-- TOP BAR -->
      <div class="fr-top-bar">
        <!-- Top-Left: 3D Metallic Gold $ Emblem + Gold Counter -->
        <div class="fr-gold-cluster" id="fr-hud-gold-cluster" title="Available Gold">
          ${this._getDollarEmblemSVG()}
          <span class="fr-gold-value fr-outlined-text" id="fr-hud-gold-value">150</span>
          <div class="fr-gold-deltas" id="fr-hud-gold-deltas"></div>
        </div>

        <!-- Top-Center: Score & Round / PAUSED -->
        <div class="fr-center-cluster">
          <div class="fr-score-value fr-outlined-text" id="fr-hud-score-value">0</div>
          <div class="fr-round-label fr-outlined-text" id="fr-hud-round-label">Round 1</div>
          <div class="fr-wave-progress-wrap" title="Wave Progress">
            <div class="fr-wave-progress-bar" id="fr-hud-wave-bar"></div>
          </div>
        </div>

        <!-- Top-Right: Lives Count + Glossy Ruby-Red 3D Heart -->
        <div class="fr-lives-cluster" id="fr-hud-lives-cluster" title="Base Lives Remaining">
          <span class="fr-lives-value fr-outlined-text" id="fr-hud-lives-value">20</span>
          ${this._getHeartSVG()}
        </div>
      </div>

      <!-- DIEGETIC WAVE BANNER -->
      <div class="fr-wave-banner" id="fr-hud-wave-banner">
        <div class="fr-wave-banner-title fr-outlined-text" id="fr-hud-banner-title">ROUND 1</div>
        <div class="fr-wave-banner-sub" id="fr-hud-banner-sub">Infantry Reconnaissance Squad Incoming</div>
      </div>

      <!-- ACHIEVEMENT TOAST STACK -->
      <div class="fr-achievement-stack" id="fr-hud-achievement-stack"></div>

      <!-- FLOATING CALLOUTS LAYER -->
      <div class="fr-floating-layer" id="fr-hud-floating-layer"></div>

      <!-- RADIAL TOWER INTERACTION RING -->
      <div class="fr-radial-ring" id="fr-hud-radial-ring">
        <div class="fr-radial-stat-preview" id="fr-hud-radial-preview"></div>

        <button type="button" class="fr-radial-bubble fr-radial-upgrade" id="fr-hud-btn-upgrade" title="Upgrade Tower (U)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 3L4 12H9V20H15V12H20L12 3Z" fill="#fffef0" stroke="#141c06" stroke-width="2.2" stroke-linejoin="round"/>
          </svg>
          <span class="fr-radial-bubble-label">UPGRADE</span>
          <span class="fr-radial-bubble-price" id="fr-hud-upgrade-cost">$4</span>
        </button>

        <button type="button" class="fr-radial-bubble fr-radial-sell" id="fr-hud-btn-sell" title="Sell Tower for 70% Refund (S)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" fill="#fff7d6" stroke="#1f1102" stroke-width="2" stroke-linejoin="round"/>
          </svg>
          <span class="fr-radial-bubble-label">SELL</span>
          <span class="fr-radial-bubble-price" id="fr-hud-sell-value">+$3</span>
        </button>

        <div class="fr-radial-bottom-pill" id="fr-hud-btn-priority" title="Click to Cycle Target Priority">
          <div class="fr-radial-tower-header">
            <span id="fr-hud-radial-name">Gatling ★☆☆</span>
            <span id="fr-hud-radial-kills">🎯 0</span>
          </div>
          <div class="fr-radial-priority-row" id="fr-hud-radial-priority">Priority: First ⟳</div>
        </div>
      </div>

      <!-- TACTICAL GEAR POPOVER -->
      <div class="fr-gear-popover" id="fr-hud-gear-popover">
        <div class="fr-gear-title">
          <span>⚙ Tactical Command</span>
          <span style="font-size:11px;color:#b8c2a8;cursor:pointer;" id="fr-hud-gear-close">✕</span>
        </div>
        <button type="button" class="fr-gear-btn accent" id="fr-hud-cmd-demo-maze">
          <span>🧱 Build Serpentine Maze</span>
          <span>PRESET</span>
        </button>
        <button type="button" class="fr-gear-btn" id="fr-hud-cmd-flow-toggle">
          <span>🧭 Toggle Grid / Flow-Field</span>
          <span id="fr-hud-flow-state">OFF</span>
        </button>
        <div style="font-size:11px;color:#d6c48a;font-weight:800;margin-top:2px;">Jump to Iconic Round:</div>
        <div class="fr-gear-rounds-grid">
          <button type="button" class="fr-gear-btn" data-jump-round="1">Round 1</button>
          <button type="button" class="fr-gear-btn" data-jump-round="16">R16 Air Blitz</button>
          <button type="button" class="fr-gear-btn" data-jump-round="32">R32 Zeppelin</button>
          <button type="button" class="fr-gear-btn" data-jump-round="50">Round 50</button>
          <button type="button" class="fr-gear-btn" data-jump-round="89">R89 Dense Maze</button>
          <button type="button" class="fr-gear-btn" data-jump-round="100">R100 Final Blitz</button>
        </div>
      </div>

      <!-- BOTTOM-LEFT CONTROL CLUSTER -->
      <div class="fr-bottom-left-controls">
        <button type="button" class="fr-ctrl-btn" id="fr-hud-btn-pause" title="Pause / Resume (Space)">
          <span id="fr-hud-pause-icon">${this._getPauseIconSVG(false)}</span>
        </button>

        <button type="button" class="fr-ctrl-btn" id="fr-hud-btn-speed" title="Fast-Forward Game Speed (F)">
          ${this._getFastForwardSVG()}
          <span class="fr-ctrl-badge" id="fr-hud-speed-badge">1x</span>
        </button>

        <button type="button" class="fr-ctrl-btn" id="fr-hud-btn-gear" title="Tactical Gear Menu">
          ${this._getGearIconSVG()}
        </button>

        <button type="button" class="fr-ctrl-btn" id="fr-hud-btn-mute" title="Mute / Unmute Audio (M)">
          <span id="fr-hud-mute-icon">${this._getSpeakerIconSVG(false)}</span>
        </button>

        <button type="button" class="fr-wave-call-btn" id="fr-hud-btn-wave" title="Start / Call Next Wave (N)">
          <span id="fr-hud-wave-label">START WAVE 1 ▶</span>
          <span class="fr-wave-bonus-tag" id="fr-hud-wave-bonus" style="display:none;">+$5</span>
        </button>
      </div>

      <!-- BOTTOM-RIGHT TOWER DOCK (4 Iconic Circular Lime-Green Buttons) -->
      <div class="fr-dock-tooltip" id="fr-hud-dock-tooltip"></div>

      <div class="fr-tower-dock" id="fr-hud-tower-dock">
        <button type="button" class="fr-tower-btn" data-tower-type="gatling" id="fr-tower-btn-gatling" aria-label="Gatling Tower">
          ${this._getGatlingTowerSVG()}
          <span class="fr-price-pill" id="fr-price-gatling">$${this.towerDefs.gatling.cost}</span>
        </button>

        <button type="button" class="fr-tower-btn" data-tower-type="goo" id="fr-tower-btn-goo" aria-label="Goo Tower">
          ${this._getGooTowerSVG()}
          <span class="fr-price-pill" id="fr-price-goo">$${this.towerDefs.goo.cost}</span>
        </button>

        <button type="button" class="fr-tower-btn" data-tower-type="missile" id="fr-tower-btn-missile" aria-label="Missile Tower">
          ${this._getMissileTowerSVG()}
          <span class="fr-price-pill" id="fr-price-missile">$${this.towerDefs.missile.cost}</span>
        </button>

        <button type="button" class="fr-tower-btn" data-tower-type="tesla" id="fr-tower-btn-tesla" aria-label="Tesla Tower">
          ${this._getTeslaTowerSVG()}
          <span class="fr-price-pill" id="fr-price-tesla">$${this.towerDefs.tesla.cost}</span>
        </button>
      </div>

      <!-- DRAG-AND-DROP GHOST -->
      <div class="fr-drag-ghost" id="fr-hud-drag-ghost"></div>

      <!-- GAME OVER / VICTORY MODAL -->
      <div class="fr-modal-backdrop" id="fr-hud-modal">
        <div class="fr-modal-card">
          <h2 class="fr-modal-heading fr-gold-text" id="fr-hud-modal-title">VICTORY!</h2>
          <div style="font-family:system-ui,sans-serif;font-size:13px;color:#d6dec8;" id="fr-hud-modal-sub">
            Grasslands Sector Secured
          </div>
          <div class="fr-modal-stats" id="fr-hud-modal-stats"></div>
          <div class="fr-modal-actions" id="fr-hud-modal-actions"></div>
        </div>
      </div>
    `;

    // Cache frequently updated DOM nodes
    this.elGoldCluster = this.root.querySelector('#fr-hud-gold-cluster');
    this.elGoldValue = this.root.querySelector('#fr-hud-gold-value');
    this.elGoldDeltas = this.root.querySelector('#fr-hud-gold-deltas');
    this.elScoreValue = this.root.querySelector('#fr-hud-score-value');
    this.elRoundLabel = this.root.querySelector('#fr-hud-round-label');
    this.elWaveBar = this.root.querySelector('#fr-hud-wave-bar');
    this.elLivesCluster = this.root.querySelector('#fr-hud-lives-cluster');
    this.elLivesValue = this.root.querySelector('#fr-hud-lives-value');

    this.elWaveBanner = this.root.querySelector('#fr-hud-wave-banner');
    this.elBannerTitle = this.root.querySelector('#fr-hud-banner-title');
    this.elBannerSub = this.root.querySelector('#fr-hud-banner-sub');
    this.elAchievementStack = this.root.querySelector('#fr-hud-achievement-stack');
    this.elFloatingLayer = this.root.querySelector('#fr-hud-floating-layer');

    this.elRadialRing = this.root.querySelector('#fr-hud-radial-ring');
    this.elRadialPreview = this.root.querySelector('#fr-hud-radial-preview');
    this.elBtnUpgrade = this.root.querySelector('#fr-hud-btn-upgrade');
    this.elUpgradeCost = this.root.querySelector('#fr-hud-upgrade-cost');
    this.elBtnSell = this.root.querySelector('#fr-hud-btn-sell');
    this.elSellValue = this.root.querySelector('#fr-hud-sell-value');
    this.elBtnPriority = this.root.querySelector('#fr-hud-btn-priority');
    this.elRadialName = this.root.querySelector('#fr-hud-radial-name');
    this.elRadialKills = this.root.querySelector('#fr-hud-radial-kills');
    this.elRadialPriority = this.root.querySelector('#fr-hud-radial-priority');

    this.elGearPopover = this.root.querySelector('#fr-hud-gear-popover');
    this.elFlowState = this.root.querySelector('#fr-hud-flow-state');
    this.elBtnPause = this.root.querySelector('#fr-hud-btn-pause');
    this.elPauseIcon = this.root.querySelector('#fr-hud-pause-icon');
    this.elBtnSpeed = this.root.querySelector('#fr-hud-btn-speed');
    this.elSpeedBadge = this.root.querySelector('#fr-hud-speed-badge');
    this.elBtnGear = this.root.querySelector('#fr-hud-btn-gear');
    this.elBtnMute = this.root.querySelector('#fr-hud-btn-mute');
    this.elMuteIcon = this.root.querySelector('#fr-hud-mute-icon');
    this.elBtnWave = this.root.querySelector('#fr-hud-btn-wave');
    this.elWaveLabel = this.root.querySelector('#fr-hud-wave-label');
    this.elWaveBonus = this.root.querySelector('#fr-hud-wave-bonus');

    this.elDockTooltip = this.root.querySelector('#fr-hud-dock-tooltip');
    this.elTowerDock = this.root.querySelector('#fr-hud-tower-dock');
    this.elDragGhost = this.root.querySelector('#fr-hud-drag-ghost');
    this.elModal = this.root.querySelector('#fr-hud-modal');
    this.elModalTitle = this.root.querySelector('#fr-hud-modal-title');
    this.elModalSub = this.root.querySelector('#fr-hud-modal-sub');
    this.elModalStats = this.root.querySelector('#fr-hud-modal-stats');
    this.elModalActions = this.root.querySelector('#fr-hud-modal-actions');

    this.towerButtons = {
      gatling: this.root.querySelector('#fr-tower-btn-gatling'),
      goo: this.root.querySelector('#fr-tower-btn-goo'),
      missile: this.root.querySelector('#fr-tower-btn-missile'),
      tesla: this.root.querySelector('#fr-tower-btn-tesla'),
    };
  }

  /* ------------------------------------------------------------------------
     EVENT BINDINGS (Click-to-Select, Drag-and-Drop, Radial Ring, Hotkeys)
     ------------------------------------------------------------------------ */

  _bindEvents() {
    if (!this.root) return;

    // 1. Play / Pause Toggle
    this.elBtnPause.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.playButtonClick();
      const nextPaused = !this.state.paused;
      this.setPaused(nextPaused);
      if (typeof this.callbacks.onTogglePause === 'function') {
        this.callbacks.onTogglePause(nextPaused);
      }
    });

    // 2. Fast-Forward Speed Toggle (1x -> 2x -> 3x)
    this.elBtnSpeed.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.playButtonClick();
      const nextSpeed = this.state.speed === 1 ? 2 : this.state.speed === 2 ? 3 : 1;
      this.setSpeed(nextSpeed);
      if (typeof this.callbacks.onSpeedChange === 'function') {
        this.callbacks.onSpeedChange(nextSpeed);
      }
    });

    // 3. Mute Toggle
    this.elBtnMute.addEventListener('click', (e) => {
      e.stopPropagation();
      const muted = this.audio.toggleMute();
      this.elMuteIcon.innerHTML = this._getSpeakerIconSVG(muted);
    });

    // 4. Early Wave Call Button
    this.elBtnWave.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.playButtonClick();
      if (typeof this.callbacks.onNextWave === 'function') {
        this.callbacks.onNextWave();
      }
    });

    // 5. Tactical Gear Popover
    this.elBtnGear.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.playButtonClick();
      this._gearMenuOpen = !this._gearMenuOpen;
      this.elGearPopover.classList.toggle('is-open', this._gearMenuOpen);
    });

    this.root.querySelector('#fr-hud-gear-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._gearMenuOpen = false;
      this.elGearPopover.classList.remove('is-open');
    });

    this.root.querySelector('#fr-hud-cmd-demo-maze')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.playTowerPlace(0);
      this._gearMenuOpen = false;
      this.elGearPopover.classList.remove('is-open');
      if (typeof this.callbacks.onLoadDemoMaze === 'function') {
        this.callbacks.onLoadDemoMaze();
      }
    });

    this.root.querySelector('#fr-hud-cmd-flow-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.playButtonClick();
      this.state.showFlowField = !this.state.showFlowField;
      this.elFlowState.textContent = this.state.showFlowField ? 'ON' : 'OFF';
      if (typeof this.callbacks.onToggleFlowField === 'function') {
        this.callbacks.onToggleFlowField(this.state.showFlowField);
      }
    });

    this.elGearPopover.querySelectorAll('[data-jump-round]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetRound = parseInt(btn.getAttribute('data-jump-round'), 10) || 1;
        this.audio.playButtonClick();
        this._gearMenuOpen = false;
        this.elGearPopover.classList.remove('is-open');
        if (typeof this.callbacks.onJumpToRound === 'function') {
          this.callbacks.onJumpToRound(targetRound);
        }
      });
    });

    // 6. Tower Dock Buttons: BOTH Click-to-Select AND Drag-and-Drop
    Object.entries(this.towerButtons).forEach(([towerType, btn]) => {
      if (!btn) return;

      btn.addEventListener('pointerenter', () => {
        this._showDockTooltip(towerType);
      });
      btn.addEventListener('pointerleave', () => {
        if (!this.state.selectedTowerType) {
          this.elDockTooltip.classList.remove('is-visible');
        } else {
          this._showDockTooltip(this.state.selectedTowerType, true);
        }
      });

      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.stopPropagation();
        const def = this.towerDefs[towerType];
        if (!def || this.state.gold < def.cost) {
          this.audio.playInvalidBuzz(12);
          this._flashGoldInsufficient();
          return;
        }

        this.audio.playButtonClick();
        this.closeTowerRing();

        // Toggle off if already selected and clicked again without dragging
        const wasAlreadySelected = this.state.selectedTowerType === towerType;
        this.selectTowerType(towerType);

        this._dragState = {
          towerType,
          startX: e.clientX,
          startY: e.clientY,
          isDragging: false,
          wasAlreadySelected,
        };
      });
    });

    if (typeof window !== 'undefined') {
      this._boundPointerMove = (e) => {
        if (!this._dragState) return;
        const dx = e.clientX - this._dragState.startX;
        const dy = e.clientY - this._dragState.startY;
        if (!this._dragState.isDragging && Math.hypot(dx, dy) > 6) {
          this._dragState.isDragging = true;
          this.elDragGhost.innerHTML = this._getTowerSVGByType(
            this._dragState.towerType
          );
          this.elDragGhost.classList.add('is-active');
        }
        if (this._dragState.isDragging) {
          this.elDragGhost.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        }
      };

      this._boundPointerUp = (e) => {
        if (!this._dragState) return;
        const drag = this._dragState;
        this._dragState = null;
        this.elDragGhost.classList.remove('is-active');

        if (drag.isDragging) {
          // Check if released over the tower dock (cancel) or over the battlefield (place)
          const dockRect = this.elTowerDock.getBoundingClientRect();
          const overDock =
            e.clientX >= dockRect.left - 8 &&
            e.clientX <= dockRect.right + 8 &&
            e.clientY >= dockRect.top - 8 &&
            e.clientY <= dockRect.bottom + 8;

          if (overDock) {
            this.cancelPlacement();
          } else {
            if (typeof this.callbacks.onPlaceTowerAtScreen === 'function') {
              this.callbacks.onPlaceTowerAtScreen(
                drag.towerType,
                e.clientX,
                e.clientY
              );
            } else {
              // Dispatch a synthetic click/pointerup on the underlying canvas at (clientX, clientY)
              const targetCanvas =
                this.canvas || document.querySelector('canvas');
              if (targetCanvas) {
                targetCanvas.dispatchEvent(
                  new MouseEvent('click', {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    bubbles: true,
                  })
                );
              }
            }
          }
        } else if (drag.wasAlreadySelected) {
          // Clicking an already-selected tower button toggles selection off
          this.cancelPlacement();
        }
      };

      this._boundContextMenu = (e) => {
        if (this.state.selectedTowerType || this.state.selectedTower) {
          e.preventDefault();
          this.cancelPlacement();
          this.closeTowerRing();
        }
      };

      this._boundKeyDown = (e) => {
        if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
        if (e.key === 'Escape') {
          this.cancelPlacement();
          this.closeTowerRing();
          this._gearMenuOpen = false;
          this.elGearPopover.classList.remove('is-open');
        } else if (e.key === '1') {
          this._hotkeySelectTower('gatling');
        } else if (e.key === '2') {
          this._hotkeySelectTower('goo');
        } else if (e.key === '3') {
          this._hotkeySelectTower('missile');
        } else if (e.key === '4') {
          this._hotkeySelectTower('tesla');
        } else if (e.key === ' ') {
          e.preventDefault();
          this.elBtnPause.click();
        } else if (e.key === 'f' || e.key === 'F') {
          this.elBtnSpeed.click();
        } else if (e.key === 'm' || e.key === 'M') {
          this.elBtnMute.click();
        } else if ((e.key === 'u' || e.key === 'U') && this.state.selectedTower) {
          this.elBtnUpgrade.click();
        } else if (
          (e.key === 's' || e.key === 'S' || e.key === 'Backspace') &&
          this.state.selectedTower
        ) {
          this.elBtnSell.click();
        }
      };

      window.addEventListener('pointermove', this._boundPointerMove, { passive: true });
      window.addEventListener('pointerup', this._boundPointerUp, { passive: true });
      window.addEventListener('contextmenu', this._boundContextMenu);
      window.addEventListener('keydown', this._boundKeyDown);
    }

    // 7. Radial Tower Ring Actions (Upgrade, Sell, Target Priority)
    this.elBtnUpgrade.addEventListener('pointerenter', () => {
      if (this.state.selectedTower) {
        this._updateRadialUpgradePreview(this.state.selectedTower, true);
      }
    });
    this.elBtnUpgrade.addEventListener('pointerleave', () => {
      this.elRadialPreview.classList.remove('is-visible');
    });

    this.elBtnUpgrade.addEventListener('click', (e) => {
      e.stopPropagation();
      const tower = this.state.selectedTower;
      if (!tower) return;
      const tier = tower.tier || tower.level || 1;
      if (tier >= 3) {
        this.audio.playInvalidBuzz(tower.x || 0);
        return;
      }
      const upgradeCost = this._getTowerUpgradeCost(tower);
      if (this.state.gold < upgradeCost) {
        this.audio.playInvalidBuzz(tower.x || 0);
        this._flashGoldInsufficient();
        return;
      }
      if (typeof this.callbacks.onUpgradeTower === 'function') {
        this.callbacks.onUpgradeTower(tower);
      }
      this.refreshTowerRing();
    });

    this.elBtnSell.addEventListener('click', (e) => {
      e.stopPropagation();
      const tower = this.state.selectedTower;
      if (!tower) return;
      if (typeof this.callbacks.onSellTower === 'function') {
        this.callbacks.onSellTower(tower);
      }
      this.closeTowerRing();
    });

    this.elBtnPriority.addEventListener('click', (e) => {
      e.stopPropagation();
      const tower = this.state.selectedTower;
      if (!tower) return;
      this.audio.playButtonClick();
      const currentPrio = tower.priority || tower.targetPriority || 'First';
      const idx = TARGET_PRIORITIES.indexOf(currentPrio);
      const nextPrio = TARGET_PRIORITIES[(idx + 1) % TARGET_PRIORITIES.length];
      tower.priority = nextPrio;
      tower.targetPriority = nextPrio;
      if (typeof this.callbacks.onCyclePriority === 'function') {
        this.callbacks.onCyclePriority(tower, nextPrio);
      }
      this.refreshTowerRing();
    });
  }

  _hotkeySelectTower(towerType) {
    const def = this.towerDefs[towerType];
    if (!def || this.state.gold < def.cost) {
      this.audio.playInvalidBuzz(10);
      this._flashGoldInsufficient();
      return;
    }
    this.audio.playButtonClick();
    if (this.state.selectedTowerType === towerType) {
      this.cancelPlacement();
    } else {
      this.selectTowerType(towerType);
    }
  }

  /* ------------------------------------------------------------------------
     TOWER SELECTION & PLACEMENT API
     ------------------------------------------------------------------------ */

  selectTowerType(towerType) {
    const normalized = towerType ? String(towerType).toLowerCase() : null;
    this.state.selectedTowerType = normalized;
    Object.entries(this.towerButtons).forEach(([key, btn]) => {
      if (btn) btn.classList.toggle('is-selected', key === normalized);
    });
    if (normalized) {
      this._showDockTooltip(normalized, true);
      if (typeof this.callbacks.onSelectTower === 'function') {
        this.callbacks.onSelectTower(normalized);
      }
    } else {
      this.elDockTooltip.classList.remove('is-visible');
    }
  }

  cancelPlacement() {
    if (!this.state.selectedTowerType) return;
    this.state.selectedTowerType = null;
    Object.values(this.towerButtons).forEach((btn) =>
      btn?.classList.remove('is-selected')
    );
    this.elDockTooltip.classList.remove('is-visible');
    this.elDragGhost.classList.remove('is-active');
    if (typeof this.callbacks.onCancelPlacement === 'function') {
      this.callbacks.onCancelPlacement();
    } else if (typeof this.callbacks.onSelectTower === 'function') {
      this.callbacks.onSelectTower(null);
    }
  }

  _showDockTooltip(towerType, isSelected = false) {
    const def = this.towerDefs[towerType];
    if (!def || !this.elDockTooltip) return;
    const hint = isSelected
      ? `<div style="color:#ffd84d;font-weight:700;margin-top:3px;">Click tile to build • Right-Click / ESC to cancel</div>`
      : '';
    this.elDockTooltip.innerHTML = `
      <div class="fr-dock-tooltip-title">${def.name} — $${def.cost}</div>
      <div>${def.desc}</div>
      <div style="color:#b8d49c;margin-top:2px;">DMG: ${def.damage[0]} • RNG: ${def.range[0]} • Targets: ${def.targets}</div>
      ${hint}
    `;
    this.elDockTooltip.classList.add('is-visible');
  }

  _flashGoldInsufficient() {
    if (!this.elGoldCluster) return;
    this.elGoldCluster.classList.remove('fr-pulse-deny');
    void this.elGoldCluster.offsetWidth;
    this.elGoldCluster.classList.add('fr-pulse-deny');
  }

  /* ------------------------------------------------------------------------
     RADIAL TOWER INTERACTION RING (3D World -> 2D Screen Projection)
     ------------------------------------------------------------------------ */

  /**
   * Projects 3D world coordinates (x, y, z) into 2D viewport pixel coordinates.
   */
  projectWorldToScreen(x, y = 0.6, z = 0, camera = null) {
    const cam = camera || this.camera;
    const rect = (
      this.canvas ||
      (typeof document !== 'undefined' && document.querySelector('canvas')) ||
      document.body
    ).getBoundingClientRect();

    if (
      cam &&
      typeof window !== 'undefined' &&
      window.THREE &&
      typeof window.THREE.Vector3 === 'function'
    ) {
      const vec = new window.THREE.Vector3(x, y, z);
      vec.project(cam);
      const screenX = rect.left + (vec.x * 0.5 + 0.5) * rect.width;
      const screenY = rect.top + (-vec.y * 0.5 + 0.5) * rect.height;
      return { x: screenX, y: screenY };
    }

    // Fallback projection if camera has projectionMatrix/matrixWorldInverse
    return {
      x: rect.left + rect.width * 0.5 + (x / 18) * (rect.width * 0.42),
      y: rect.top + rect.height * 0.5 + (z / 12) * (rect.height * 0.42),
    };
  }

  openTowerRing(tower, camera = null) {
    if (!tower) {
      this.closeTowerRing();
      return;
    }
    if (camera) this.camera = camera;
    this.state.selectedTower = tower;
    this.refreshTowerRing();
    this.elRadialRing.classList.add('is-open');
    this.updateTowerRingPosition(this.camera);
  }

  selectTower(tower, camera = null) {
    this.openTowerRing(tower, camera);
  }

  closeTowerRing() {
    this.state.selectedTower = null;
    if (this.elRadialRing) {
      this.elRadialRing.classList.remove('is-open');
    }
    if (this.elRadialPreview) {
      this.elRadialPreview.classList.remove('is-visible');
    }
  }

  refreshTowerRing() {
    const tower = this.state.selectedTower;
    if (!tower || !this.elRadialRing) return;

    const typeKey = String(tower.type || tower.id || 'gatling').toLowerCase();
    const def = this.towerDefs[typeKey] || this.towerDefs.gatling;
    const tier = Math.max(1, Math.min(3, tower.tier || tower.level || 1));
    const stars = '★'.repeat(tier) + '☆'.repeat(3 - tier);
    const kills = tower.kills || 0;
    const priority = tower.priority || tower.targetPriority || 'First';

    this.elRadialName.textContent = `${def.shortName} ${stars}`;
    this.elRadialKills.textContent = `🎯 ${kills}`;
    this.elRadialPriority.textContent = `Priority: ${priority} ⟳`;

    if (tier >= 3) {
      this.elBtnUpgrade.classList.add('is-max');
      this.elBtnUpgrade.classList.remove('is-unaffordable');
      this.elUpgradeCost.textContent = 'MAX T3';
    } else {
      const upgCost = this._getTowerUpgradeCost(tower);
      this.elBtnUpgrade.classList.remove('is-max');
      this.elBtnUpgrade.classList.toggle(
        'is-unaffordable',
        this.state.gold < upgCost
      );
      this.elUpgradeCost.textContent = `$${upgCost}`;
    }

    const sellVal = this._getTowerSellValue(tower);
    this.elSellValue.textContent = `+$${sellVal}`;
  }

  _getTowerUpgradeCost(tower) {
    if (typeof tower.upgradeCost === 'number') return tower.upgradeCost;
    if (typeof tower.getUpgradeCost === 'function') return tower.getUpgradeCost();
    const typeKey = String(tower.type || tower.id || 'gatling').toLowerCase();
    const def = this.towerDefs[typeKey] || this.towerDefs.gatling;
    const tier = Math.max(1, Math.min(3, tower.tier || tower.level || 1));
    if (tier >= 3) return 0;
    return def.upgradeCosts?.[tier - 1] || Math.round(def.cost * 0.85 * tier);
  }

  _getTowerSellValue(tower) {
    if (typeof tower.sellValue === 'number') return tower.sellValue;
    if (typeof tower.getSellValue === 'function') return tower.getSellValue();
    const typeKey = String(tower.type || tower.id || 'gatling').toLowerCase();
    const def = this.towerDefs[typeKey] || this.towerDefs.gatling;
    const tier = Math.max(1, Math.min(3, tower.tier || tower.level || 1));
    let totalInvested = tower.totalInvested || def.cost;
    if (!tower.totalInvested && tier > 1) {
      for (let i = 0; i < tier - 1; i++) {
        totalInvested += def.upgradeCosts?.[i] || 0;
      }
    }
    return Math.max(1, Math.round(totalInvested * 0.7));
  }

  _updateRadialUpgradePreview(tower, show) {
    if (!show || !tower || !this.elRadialPreview) {
      this.elRadialPreview?.classList.remove('is-visible');
      return;
    }
    const typeKey = String(tower.type || tower.id || 'gatling').toLowerCase();
    const def = this.towerDefs[typeKey] || this.towerDefs.gatling;
    const tier = Math.max(1, Math.min(3, tower.tier || tower.level || 1));
    if (tier >= 3) {
      this.elRadialPreview.textContent = '★ MAXIMUM TIER 3 REACHED ★';
    } else {
      const curDmg = def.damage[tier - 1];
      const nextDmg = def.damage[tier];
      const curRng = def.range[tier - 1];
      const nextRng = def.range[tier];
      this.elRadialPreview.textContent = `Tier ${tier} → ${tier + 1}: DMG ${curDmg}→${nextDmg} • RNG ${curRng}→${nextRng}`;
    }
    this.elRadialPreview.classList.add('is-visible');
  }

  updateTowerRingPosition(camera = null) {
    const tower = this.state.selectedTower;
    if (!tower || !this.elRadialRing) return;
    const wx =
      typeof tower.x === 'number'
        ? tower.x
        : tower.position?.x || tower.worldX || 0;
    const wy =
      typeof tower.y === 'number'
        ? tower.y
        : tower.position?.y || 0.7;
    const wz =
      typeof tower.z === 'number'
        ? tower.z
        : tower.position?.z || tower.worldZ || 0;

    const pt = this.projectWorldToScreen(wx, wy, wz, camera || this.camera);
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
    const clampedX = Math.max(115, Math.min(vw - 115, pt.x));
    const clampedY = Math.max(105, Math.min(vh - 125, pt.y));

    this.elRadialRing.style.left = `${clampedX}px`;
    this.elRadialRing.style.top = `${clampedY}px`;
  }

  /* ------------------------------------------------------------------------
     LIVE STATE UPDATE & JUICY DELTAS
     ------------------------------------------------------------------------ */

  update(newState = {}, camera = null) {
    if (camera) this.camera = camera;
    if (newState.towerDefs) {
      this._mergeTowerDefs(newState.towerDefs);
    }

    // 1. Gold & Floating +/- Deltas
    if (typeof newState.gold === 'number' && newState.gold !== this.state.gold) {
      const delta = Math.round(newState.gold - this.state.gold);
      this.state.gold = Math.max(0, Math.round(newState.gold));
      this.elGoldValue.textContent = String(this.state.gold);
      if (delta !== 0) {
        this._spawnGoldDelta(delta);
      }
    } else if (typeof newState.gold === 'number') {
      this.elGoldValue.textContent = String(Math.round(newState.gold));
    }

    // Update affordability on all 4 tower dock buttons
    Object.entries(this.towerButtons).forEach(([typeKey, btn]) => {
      const def = this.towerDefs[typeKey];
      if (!btn || !def) return;
      const priceEl = btn.querySelector('.fr-price-pill');
      if (priceEl) priceEl.textContent = `$${def.cost}`;
      btn.classList.toggle('is-unaffordable', this.state.gold < def.cost);
    });

    // 2. Score (smooth interpolation)
    if (typeof newState.score === 'number') {
      this.state.score = Math.max(0, Math.round(newState.score));
    }
    if (this.state.displayedScore !== this.state.score) {
      const diff = this.state.score - this.state.displayedScore;
      const step = Math.abs(diff) > 20 ? Math.ceil(diff * 0.28) : diff;
      this.state.displayedScore += step;
      this.elScoreValue.textContent = String(this.state.displayedScore);
    }

    // 3. Pause / Round Label
    if (typeof newState.paused === 'boolean') {
      this.state.paused = newState.paused;
    }
    if (typeof newState.round === 'number') {
      this.state.round = Math.max(1, newState.round);
    }
    this._syncRoundAndPauseLabel();

    // 4. Wave Progress & Early Call / Pre-Game Build Phase state
    if (typeof newState.waveProgress === 'number') {
      this.state.waveProgress = Math.max(0, Math.min(1, newState.waveProgress));
      this.elWaveBar.style.width = `${Math.round(this.state.waveProgress * 100)}%`;
    }
    if (typeof newState.waveActive === 'boolean') {
      this.state.waveActive = newState.waveActive;
    }
    if (typeof newState.waveCooldown === 'number') {
      this.state.waveCooldown = newState.waveCooldown;
    }
    if (typeof newState.buildPhase === 'boolean') {
      this.state.buildPhase = newState.buildPhase;
    }
    if (typeof newState.waveStartedOnce === 'boolean') {
      this.state.waveStartedOnce = newState.waveStartedOnce;
    }
    if (this.state.waveActive || this.state.round > 1) {
      this.state.waveStartedOnce = true;
      if (newState.buildPhase === undefined) {
        this.state.buildPhase = false;
      }
    }

    const inInitialBuildPhase =
      newState.buildPhase !== undefined
        ? Boolean(newState.buildPhase && this.state.round === 1 && !this.state.waveActive)
        : this.state.round === 1 && !this.state.waveActive && !this.state.waveStartedOnce;

    const canEarlyCall = !this.state.waveActive || this.state.waveCooldown > 0;
    this.elBtnWave.classList.toggle('cooldown-ready', canEarlyCall || inInitialBuildPhase);

    if (this.elWaveLabel) {
      this.elWaveLabel.textContent = inInitialBuildPhase
        ? 'START WAVE 1 ▶'
        : 'WAVE ▶';
    }
    if (this.elWaveBonus) {
      const showEarlyBonus = canEarlyCall && !inInitialBuildPhase && (this.state.round >= 2 || this.state.waveStartedOnce);
      this.elWaveBonus.style.display = showEarlyBonus ? 'inline-block' : 'none';
    }

    // 5. Speed Badge
    if (typeof newState.speed === 'number' && newState.speed !== this.state.speed) {
      this.setSpeed(newState.speed);
    }

    // 6. Lives & Ruby Heart Pulse
    if (typeof newState.lives === 'number') {
      const roundedLives = Math.max(0, Math.round(newState.lives));
      if (roundedLives < this.state.lives) {
        this._triggerHeartDamage();
      }
      this.state.lives = roundedLives;
      this.elLivesValue.textContent = String(this.state.lives);
    }

    // 7. Keep Radial Ring locked onto selected 3D tower
    if (this.state.selectedTower) {
      this.refreshTowerRing();
      this.updateTowerRingPosition(this.camera);
    }
  }

  setPaused(paused) {
    this.state.paused = Boolean(paused);
    this.audio.setPaused(this.state.paused);
    this._syncRoundAndPauseLabel();
  }

  _syncRoundAndPauseLabel() {
    if (!this.elRoundLabel || !this.elPauseIcon) return;
    this.elPauseIcon.innerHTML = this._getPauseIconSVG(this.state.paused);
    if (this.state.paused) {
      this.elRoundLabel.textContent = 'PAUSED';
      this.elRoundLabel.classList.add('is-paused');
    } else {
      this.elRoundLabel.textContent = `Round ${this.state.round}`;
      this.elRoundLabel.classList.remove('is-paused');
    }
  }

  setSpeed(speed) {
    this.state.speed = speed;
    if (this.elSpeedBadge) {
      this.elSpeedBadge.textContent = `${speed}x`;
    }
    if (this.elBtnSpeed) {
      this.elBtnSpeed.classList.toggle('is-active', speed > 1);
    }
  }

  clearTransientUI(resetAchievements = false) {
    if (this._bannerTimeout) {
      clearTimeout(this._bannerTimeout);
      this._bannerTimeout = null;
    }
    if (this.elWaveBanner) {
      this.elWaveBanner.classList.remove('is-visible', 'is-air-warning');
    }
    if (this.elGoldDeltas) {
      this.elGoldDeltas.innerHTML = '';
    }
    if (this.elAchievementStack) {
      this.elAchievementStack.innerHTML = '';
    }
    if (this.elFloatingLayer) {
      this.elFloatingLayer.innerHTML = '';
    }
    if (resetAchievements) {
      if (this.unlockedAchievements) {
        this.unlockedAchievements.clear();
      }
      this.state.waveStartedOnce = false;
      this.state.buildPhase = true;
      if (this.elWaveLabel) {
        this.elWaveLabel.textContent = 'START WAVE 1 ▶';
      }
      if (this.elWaveBonus) {
        this.elWaveBonus.style.display = 'none';
      }
    }
    this.state.displayedScore = this.state.score;
    if (this.elScoreValue) {
      this.elScoreValue.textContent = String(this.state.score);
    }
  }

  _spawnGoldDelta(delta) {
    if (!this.elGoldDeltas || this.suppressTransientUI) return;
    const item = document.createElement('div');
    item.className = `fr-gold-delta-item ${delta > 0 ? 'positive' : 'negative'}`;
    item.textContent = delta > 0 ? `+$${delta}` : `-$${Math.abs(delta)}`;
    this.elGoldDeltas.appendChild(item);

    if (delta > 0 && this.elGoldCluster) {
      this.elGoldCluster.classList.remove('fr-pulse-gain');
      void this.elGoldCluster.offsetWidth;
      this.elGoldCluster.classList.add('fr-pulse-gain');
      setTimeout(() => this.elGoldCluster?.classList.remove('fr-pulse-gain'), 160);
    }

    setTimeout(() => item.remove(), 950);
  }

  _triggerHeartDamage() {
    if (!this.elLivesCluster || this.suppressTransientUI) return;
    this.elLivesCluster.classList.remove('fr-life-lost');
    void this.elLivesCluster.offsetWidth;
    this.elLivesCluster.classList.add('fr-life-lost');
  }

  /* ------------------------------------------------------------------------
     BANNERS, FLOATING COMBAT TEXT, ACHIEVEMENTS & MODALS
     ------------------------------------------------------------------------ */

  showWaveBanner(
    round = 1,
    title = '',
    subtitle = '',
    isAirWarning = false
  ) {
    if (!this.elWaveBanner || this.suppressTransientUI) return;
    this.elBannerTitle.textContent =
      title ||
      (isAirWarning
        ? `⚠ ROUND ${round} — AIR RAID!`
        : `ROUND ${round}`);
    this.elBannerSub.textContent =
      subtitle ||
      (isAirWarning
        ? '⚠ AIR UNITS INCOMING — BYPASSES GROUND MAZE!'
        : 'Invaders advancing from the western woods!');

    this.elWaveBanner.classList.toggle('is-air-warning', Boolean(isAirWarning));
    this.elWaveBanner.classList.add('is-visible');

    if (this._bannerTimeout) clearTimeout(this._bannerTimeout);
    this._bannerTimeout = setTimeout(() => {
      this.elWaveBanner?.classList.remove('is-visible');
    }, 2600);
  }

  unlockAchievement(id, title = 'ACHIEVEMENT UNLOCKED', desc = '') {
    if (!id || this.unlockedAchievements.has(id)) return false;
    this.unlockedAchievements.add(id);

    if (!this.elAchievementStack || this.suppressTransientUI) return true;
    // Limit visible achievement toasts to 1 at a time so they never stack over the battlefield
    this.elAchievementStack.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = 'fr-achievement-toast';
    toast.innerHTML = `
      <div class="fr-achievement-medal">★</div>
      <div>
        <div class="fr-achievement-title">${title}</div>
        <div class="fr-achievement-desc">${desc}</div>
      </div>
    `;
    this.elAchievementStack.appendChild(toast);
    this.audio.playTowerUpgrade(0, 3);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      setTimeout(() => toast.remove(), 320);
    }, 2500);
    return true;
  }

  showFloatingText(
    text,
    worldOrScreenPos = { x: 0, y: 0.8, z: 0 },
    color = '#ffe24d',
    camera = null
  ) {
    if (!this.elFloatingLayer || this.suppressTransientUI) return;
    let sx = 640;
    let sy = 360;
    if (
      typeof worldOrScreenPos.screenX === 'number' &&
      typeof worldOrScreenPos.screenY === 'number'
    ) {
      sx = worldOrScreenPos.screenX;
      sy = worldOrScreenPos.screenY;
    } else if (typeof worldOrScreenPos.z === 'number') {
      const pt = this.projectWorldToScreen(
        worldOrScreenPos.x || 0,
        worldOrScreenPos.y || 0.8,
        worldOrScreenPos.z || 0,
        camera || this.camera
      );
      sx = pt.x;
      sy = pt.y;
    } else {
      sx = worldOrScreenPos.x || 640;
      sy = worldOrScreenPos.y || 360;
    }

    const el = document.createElement('div');
    el.className = 'fr-floating-callout fr-outlined-text';
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    el.style.color = color;
    el.textContent = text;
    this.elFloatingLayer.appendChild(el);
    setTimeout(() => el.remove(), 920);
  }

  showGameOverModal(stats = {}, onRestart = null) {
    this._renderEndModal({
      title: 'DEFEAT',
      subtitle: 'Enemy Forces Overran Your Perimeter!',
      stats,
      isVictory: false,
      onRestart: onRestart || this.callbacks.onRestart,
    });
  }

  showVictoryModal(stats = {}, onContinueEndless = null, onRestart = null) {
    this.audio.playVictoryFanfare();
    this._renderEndModal({
      title: 'VICTORY!',
      subtitle: 'Grasslands Blitzkrieg Repelled!',
      stats,
      isVictory: true,
      onContinueEndless: onContinueEndless || this.callbacks.onContinueEndless,
      onRestart: onRestart || this.callbacks.onRestart,
    });
  }

  hideModal() {
    this.elModal?.classList.remove('is-open');
  }

  _renderEndModal({
    title,
    subtitle,
    stats = {},
    isVictory = false,
    onContinueEndless = null,
    onRestart = null,
  }) {
    if (!this.elModal) return;
    this.elModalTitle.textContent = title;
    this.elModalSub.textContent = subtitle;

    const score = stats.score ?? this.state.score;
    const round = stats.round ?? this.state.round;
    const kills = stats.kills ?? stats.enemiesKilled ?? 0;
    const towers = stats.towersBuilt ?? stats.towers ?? 0;

    this.elModalStats.innerHTML = `
      <div class="fr-modal-stat-row"><span>Final Score</span><span style="color:#ffd84d;">${score}</span></div>
      <div class="fr-modal-stat-row"><span>Round Reached</span><span>Round ${round}</span></div>
      <div class="fr-modal-stat-row"><span>Invaders Defeated</span><span>${kills}</span></div>
      <div class="fr-modal-stat-row"><span>Towers Deployed</span><span>${towers}</span></div>
      <div class="fr-modal-stat-row"><span>Medals Earned</span><span>${this.unlockedAchievements.size}</span></div>
    `;

    this.elModalActions.innerHTML = '';
    if (isVictory && typeof onContinueEndless === 'function') {
      const endlessBtn = document.createElement('button');
      endlessBtn.type = 'button';
      endlessBtn.className = 'fr-modal-btn';
      endlessBtn.textContent = 'CONTINUE ENDLESS';
      endlessBtn.addEventListener('click', () => {
        this.audio.playButtonClick();
        this.hideModal();
        onContinueEndless();
      });
      this.elModalActions.appendChild(endlessBtn);
    }

    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = `fr-modal-btn ${isVictory ? 'secondary' : ''}`;
    restartBtn.textContent = 'PLAY AGAIN';
    restartBtn.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.hideModal();
      if (typeof onRestart === 'function') onRestart();
    });
    this.elModalActions.appendChild(restartBtn);

    this.elModal.classList.add('is-open');
  }

  /* ------------------------------------------------------------------------
     AUTHENTIC BESPOKE SVG ILLUSTRATIONS (1:1 Match with Reference Captures)
     ------------------------------------------------------------------------ */

  _getDollarEmblemSVG() {
    return `
      <svg class="fr-dollar-emblem" viewBox="0 0 44 50" fill="none">
        <defs>
          <linearGradient id="frDollarGrad" x1="0" y1="4" x2="0" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fff89c"/>
            <stop offset="42%" stop-color="#ffd018"/>
            <stop offset="100%" stop-color="#b86200"/>
          </linearGradient>
        </defs>
        <path d="M20 2V48M25 2V48" stroke="#181002" stroke-width="7.5" stroke-linecap="round"/>
        <path d="M33 13C31 8.5 26.5 6.5 21 6.5C13.5 6.5 9.5 10.5 9.5 15.8C9.5 21.5 14.5 23.5 22.5 25.2C30.5 26.9 34.5 29.2 34.5 35.2C34.5 41 29.5 44.5 21.5 44.5C14.5 44.5 9.8 41.5 8 36.5"
              stroke="#181002" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 3V47M25 3V47" stroke="url(#frDollarGrad)" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M33 13C31 8.5 26.5 6.5 21 6.5C13.5 6.5 9.5 10.5 9.5 15.8C9.5 21.5 14.5 23.5 22.5 25.2C30.5 26.9 34.5 29.2 34.5 35.2C34.5 41 29.5 44.5 21.5 44.5C14.5 44.5 9.8 41.5 8 36.5"
              stroke="url(#frDollarGrad)" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  _getHeartSVG() {
    return `
      <svg class="fr-heart-icon" viewBox="0 0 44 40" fill="none">
        <defs>
          <radialGradient id="frHeartGrad" cx="35%" cy="28%" r="70%">
            <stop offset="0%" stop-color="#ff7a85"/>
            <stop offset="45%" stop-color="#e81025"/>
            <stop offset="100%" stop-color="#78000b"/>
          </radialGradient>
        </defs>
        <path d="M22 36.5C22 36.5 4 25.2 4 12.8C4 6.2 9.2 2.5 14.8 2.5C18.5 2.5 21.1 4.6 22 6.8C22.9 4.6 25.5 2.5 29.2 2.5C34.8 2.5 40 6.2 40 12.8C40 25.2 22 36.5 22 36.5Z"
              fill="url(#frHeartGrad)" stroke="#1c080a" stroke-width="3.4" stroke-linejoin="round"/>
        <path d="M10.5 11.5C10.5 8.5 13 6.8 15.8 6.8" stroke="rgba(255,255,255,0.75)" stroke-width="2.6" stroke-linecap="round"/>
      </svg>
    `;
  }

  _getPauseIconSVG(isPaused) {
    if (isPaused) {
      return `
        <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
          <defs>
            <linearGradient id="frGoldBtn" x1="0" y1="6" x2="0" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#fff078"/>
              <stop offset="55%" stop-color="#f5a800"/>
              <stop offset="100%" stop-color="#b85d00"/>
            </linearGradient>
          </defs>
          <path d="M12 8L38 23L12 38V8Z" fill="url(#frGoldBtn)" stroke="#1a1102" stroke-width="3.6" stroke-linejoin="round"/>
        </svg>
      `;
    }
    return `
      <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
        <defs>
          <linearGradient id="frGoldPause" x1="0" y1="6" x2="0" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fff078"/>
            <stop offset="55%" stop-color="#f5a800"/>
            <stop offset="100%" stop-color="#b85d00"/>
          </linearGradient>
        </defs>
        <rect x="10" y="8" width="10" height="30" rx="2.5" fill="url(#frGoldPause)" stroke="#1a1102" stroke-width="3.5"/>
        <rect x="26" y="8" width="10" height="30" rx="2.5" fill="url(#frGoldPause)" stroke="#1a1102" stroke-width="3.5"/>
      </svg>
    `;
  }

  _getFastForwardSVG() {
    return `
      <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
        <defs>
          <linearGradient id="frGoldFF" x1="0" y1="8" x2="0" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fff078"/>
            <stop offset="55%" stop-color="#f5a800"/>
            <stop offset="100%" stop-color="#b85d00"/>
          </linearGradient>
        </defs>
        <path d="M7 10L24 23L7 36V10Z" fill="url(#frGoldFF)" stroke="#1a1102" stroke-width="3.4" stroke-linejoin="round"/>
        <path d="M23 10L40 23L23 36V10Z" fill="url(#frGoldFF)" stroke="#1a1102" stroke-width="3.4" stroke-linejoin="round"/>
      </svg>
    `;
  }

  _getGearIconSVG() {
    return `
      <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
        <defs>
          <linearGradient id="frGoldGear" x1="0" y1="6" x2="0" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fff078"/>
            <stop offset="55%" stop-color="#f5a800"/>
            <stop offset="100%" stop-color="#b85d00"/>
          </linearGradient>
        </defs>
        <path d="M19.5 5H26.5L27.8 9.8C29.1 10.3 30.3 11 31.4 11.9L36.1 10.2L40.1 16.2L36.4 19.7C36.7 20.8 36.9 21.9 36.9 23C36.9 24.1 36.7 25.2 36.4 26.3L40.1 29.8L36.1 35.8L31.4 34.1C30.3 35 29.1 35.7 27.8 36.2L26.5 41H19.5L18.2 36.2C16.9 35.7 15.7 35 14.6 34.1L9.9 35.8L5.9 29.8L9.6 26.3C9.3 25.2 9.1 24.1 9.1 23C9.1 21.9 9.3 20.8 9.6 19.7L5.9 16.2L9.9 10.2L14.6 11.9C15.7 11 16.9 10.3 18.2 9.8L19.5 5Z"
              fill="url(#frGoldGear)" stroke="#1a1102" stroke-width="3.3" stroke-linejoin="round"/>
        <circle cx="23" cy="23" r="6.5" fill="#1f1708" stroke="#1a1102" stroke-width="2.5"/>
      </svg>
    `;
  }

  _getSpeakerIconSVG(isMuted) {
    return `
      <svg width="44" height="44" viewBox="0 0 46 46" fill="none">
        <path d="M9 17H16L26 9V37L16 29H9V17Z" fill="#ffd23f" stroke="#1a1102" stroke-width="3.3" stroke-linejoin="round"/>
        ${
          isMuted
            ? `<path d="M31 17L40 29M40 17L31 29" stroke="#ff4d4d" stroke-width="4" stroke-linecap="round"/>`
            : `<path d="M31 16C34 19 34 27 31 30M35.5 11.5C40.5 16.5 40.5 29.5 35.5 34.5" stroke="#ffd23f" stroke-width="3.2" stroke-linecap="round"/>`
        }
      </svg>
    `;
  }

  _getTowerSVGByType(type) {
    switch (type) {
      case 'goo':
        return this._getGooTowerSVG();
      case 'missile':
        return this._getMissileTowerSVG();
      case 'tesla':
        return this._getTeslaTowerSVG();
      default:
        return this._getGatlingTowerSVG();
    }
  }

  /**
   * 1. Gatling ($5): Dark tilted 6-barrel rotary minigun with glowing red barrel tips & brass ammo belt.
   */
  _getGatlingTowerSVG() {
    return `
      <svg class="fr-tower-svg" viewBox="0 0 68 68" fill="none">
        <!-- Curved Brass Ammo Belt feeding from bottom-left -->
        <path d="M12 56C14 47 20 42 28 40" stroke="#1b1405" stroke-width="9" stroke-linecap="round"/>
        <path d="M12 56C14 47 20 42 28 40" stroke="#f5b818" stroke-width="5.5" stroke-dasharray="3.2 2.6" stroke-linecap="round"/>
        <!-- Tilted Gunmetal Minigun Receiver & Clamp Bands -->
        <g transform="rotate(-38 34 34)">
          <rect x="13" y="24" width="24" height="20" rx="5" fill="#3a424a" stroke="#14181c" stroke-width="2.8"/>
          <rect x="28" y="25" width="18" height="18" rx="3" fill="#525c66" stroke="#14181c" stroke-width="2.6"/>
          <!-- 6 Rotary Barrels -->
          <line x1="34" y1="27" x2="54" y2="27" stroke="#22272c" stroke-width="3.2"/>
          <line x1="34" y1="31" x2="56" y2="31" stroke="#2f363d" stroke-width="3.2"/>
          <line x1="34" y1="35" x2="56" y2="35" stroke="#22272c" stroke-width="3.2"/>
          <line x1="34" y1="39" x2="54" y2="39" stroke="#2f363d" stroke-width="3.2"/>
          <rect x="44" y="24.5" width="4.5" height="19" rx="1.5" fill="#6b7785" stroke="#14181c" stroke-width="2"/>
          <!-- Glowing Red-Hot Barrel Tips Cluster -->
          <circle cx="55" cy="27.5" r="3.1" fill="#ff3b1f" stroke="#1a0804" stroke-width="1.6"/>
          <circle cx="57" cy="33.5" r="3.3" fill="#ff5926" stroke="#1a0804" stroke-width="1.6"/>
          <circle cx="55" cy="39.5" r="3.1" fill="#ff2a14" stroke="#1a0804" stroke-width="1.6"/>
          <circle cx="51.5" cy="30.5" r="2.8" fill="#ff7338" stroke="#1a0804" stroke-width="1.5"/>
          <circle cx="51.5" cy="36.5" r="2.8" fill="#ff4824" stroke="#1a0804" stroke-width="1.5"/>
        </g>
      </svg>
    `;
  }

  /**
   * 2. Goo ($10): Pressurized nozzle spraying a dynamic splash of neon-green slime.
   */
  _getGooTowerSVG() {
    return `
      <svg class="fr-tower-svg" viewBox="0 0 68 68" fill="none">
        <!-- Pressurized Nozzle in Bottom-Left -->
        <path d="M9 56L17 44L25 52L14 60Z" fill="#3a4338" stroke="#141a12" stroke-width="2.6" stroke-linejoin="round"/>
        <!-- Dynamic Arching Neon-Green Slime Splash -->
        <path d="M18 47C21 31 32 17 50 15C56 14.5 59 18 55 21.5C49 25 44 26 53 27.5C59 28.5 60 34 53 36C45 38 41 39 48 42.5C52 44.5 49 49 42 48.5C32 48 25 50 18 47Z"
              fill="#38b800" stroke="#122b04" stroke-width="2.8" stroke-linejoin="round"/>
        <path d="M20 45C24 32 34 21 49 18.5C53 18 53 21 47 24C41 26.5 41 29 49 30.5C54 31.5 53 35 46 36.5C38 38 33 42 20 45Z"
              fill="#9cff2e"/>
        <!-- Flying Slime Droplets -->
        <circle cx="28" cy="15" r="3.2" fill="#88f516" stroke="#122b04" stroke-width="2"/>
        <circle cx="57" cy="22" r="2.8" fill="#88f516" stroke="#122b04" stroke-width="1.8"/>
        <circle cx="56" cy="41" r="3.4" fill="#6be000" stroke="#122b04" stroke-width="2"/>
      </svg>
    `;
  }

  /**
   * 3. Missile ($20): Silver-grey rocket with bright red nosecone, red fins, and cartoon smoke puffs.
   */
  _getMissileTowerSVG() {
    return `
      <svg class="fr-tower-svg" viewBox="0 0 68 68" fill="none">
        <!-- Cartoon Launch Smoke Puffs at Bottom-Left -->
        <circle cx="15" cy="48" r="7.5" fill="#fff6eb" stroke="#1a1612" stroke-width="2.5"/>
        <circle cx="23" cy="54" r="6.8" fill="#ffe3c2" stroke="#1a1612" stroke-width="2.5"/>
        <circle cx="11" cy="39" r="5.5" fill="#ffffff" stroke="#1a1612" stroke-width="2.4"/>
        <!-- Plump Tilted Silver-Grey Rocket with Red Nosecone & Red Fins -->
        <g transform="rotate(-40 36 32)">
          <!-- Red Tail Fins -->
          <path d="M16 25L9 19L22 21Z" fill="#e61c1c" stroke="#1a0d0d" stroke-width="2.4" stroke-linejoin="round"/>
          <path d="M16 39L9 45L22 43Z" fill="#e61c1c" stroke="#1a0d0d" stroke-width="2.4" stroke-linejoin="round"/>
          <!-- Rocket Fuselage -->
          <path d="M15 24C24 20 38 20 48 25L48 39C38 44 24 44 15 40Z"
                fill="#9aa4b0" stroke="#171b20" stroke-width="2.8" stroke-linejoin="round"/>
          <path d="M18 26.5C26 23.5 37 23.5 45 27" stroke="#dce4ed" stroke-width="3" stroke-linecap="round"/>
          <!-- Bright Red Nosecone -->
          <path d="M45 24C53 26.5 58 29.5 59 32C58 34.5 53 37.5 45 40Z"
                fill="#ff2424" stroke="#1a0d0d" stroke-width="2.8" stroke-linejoin="round"/>
          <!-- Center Red Fin -->
          <rect x="13" y="30.5" width="9" height="3.2" rx="1.5" fill="#ff2e2e" stroke="#1a0d0d" stroke-width="1.8"/>
        </g>
      </svg>
    `;
  }

  /**
   * 4. Tesla ($120): High-voltage metallic electrode sphere shooting jagged cyan-blue lightning bolts.
   */
  _getTeslaTowerSVG() {
    return `
      <svg class="fr-tower-svg" viewBox="0 0 68 68" fill="none">
        <!-- Jagged Cyan-Blue Lightning Bolts -->
        <path d="M21 31L31 19L28 27L42 13L37 26L56 18L41 33L30 30L21 31Z"
              fill="#63f2ff" stroke="#0c2636" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M22 35L36 37L32 44L52 47L35 53L27 44L22 35Z"
              fill="#42dfff" stroke="#0c2636" stroke-width="2.3" stroke-linejoin="round"/>
        <!-- Metallic Electrode Coil Post on Left -->
        <path d="M12 58L16 37H22L26 58Z" fill="#46525e" stroke="#141a20" stroke-width="2.6" stroke-linejoin="round"/>
        <rect x="13" y="42" width="12" height="3.5" rx="1.5" fill="#8fa0b0" stroke="#141a20" stroke-width="1.8"/>
        <rect x="12" y="48" width="14" height="3.5" rx="1.5" fill="#8fa0b0" stroke="#141a20" stroke-width="1.8"/>
        <!-- High-Voltage Electrode Sphere -->
        <circle cx="19" cy="33" r="6.8" fill="#708090" stroke="#141a20" stroke-width="2.6"/>
        <circle cx="17.5" cy="31.2" r="2.4" fill="#d8f8ff"/>
      </svg>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.ArgonTowersAudio = ArgonTowersAudio;
  window.ArgonTowersHUD = ArgonTowersHUD;
}

export { ArgonTowersAudio, ArgonTowersHUD };
export default { ArgonTowersAudio, ArgonTowersHUD };
