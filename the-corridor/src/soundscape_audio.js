// ============================================================================
// The Corridor (Argon Studio / Corridor Engine) — 3D Spatial Soundscape Engine
// Owns: PTSoundscapeEngine (src/soundscape_audio.js)
// - Web Audio API 3D HRTF PannerNodes + AudioListener synced to First-Person Camera
// - Sole Ambient Background Track: User-provided horror-ambient-bg-music.mp3
// - Visceral Creaking Floorboards, Binaural Neck Breathing & Jump Scare Stinger:
//   * horror-character-walking-floor-creak.mp3 (every footstep, door creak, &
//     autonomous 3D HRTF dark-hallway floorboard weight-shifts every 2.6-4.5s)
//   * horror-character-breathing.mp3 (binaural 0.28m behind player's neck)
//   * horror-jumpscare.mp3 (full visceral jump-scare stinger)
// - Pre-generated Gemini 3.8 Flash TTS Radio & Ghost Whispers:
//   * radio_broadcast_01.wav ("Look behind you. I said... look behind you.")
//   * radio_numbers_204863.wav ("Don't touch that dial now... Two. Zero. Four. Eight. Six. Three.")
//   * lisa_whisper_behind.wav ("Forgive me... I'm right behind you...")
//   * phone_chosen.wav ("You've been chosen.")
// - Supports window.__PT_INLINE_AUDIO__ base64 Data URIs for 100% CORS-free
//   playback inside static web's Origin: null sandbox + procedural Web Audio layers
// ============================================================================

const MUSIC_ASSET_MANIFEST = {
  horror_ambient_bg: {
    url: './assets/audio/sfx/horror-ambient-bg-music.mp3',
    baseVolume: 0.72,
    alwaysActive: true,
  },
};

const SFX_ASSET_MANIFEST = {
  character_breathing: {
    url: './assets/audio/sfx/horror-character-breathing.mp3',
    baseVolume: 0.85,
  },
  walking_floor_creak: {
    url: './assets/audio/sfx/horror-character-walking-floor-creak.mp3',
    baseVolume: 0.95,
  },
  horror_jumpscare: {
    url: './assets/audio/sfx/horror-jumpscare.mp3',
    baseVolume: 1.0,
  },
};

const TTS_ASSET_MANIFEST = {
  radio_broadcast_01: {
    url: './assets/audio/tts/radio_broadcast_01.wav',
    subtitle: 'RADIO: "Look behind you... I said, look behind you."',
    durationEstimate: 5.2,
  },
  radio_numbers_204863: {
    url: './assets/audio/tts/radio_numbers_204863.wav',
    subtitle:
      'RADIO: "Don\'t touch that dial now, we\'re just getting started... 2 - 0 - 4 - 8 - 6 - 3."',
    durationEstimate: 7.4,
  },
  lisa_whisper_behind: {
    url: './assets/audio/tts/lisa_whisper_behind.wav',
    subtitle: '[WHISPER BEHIND YOU]: "Forgive me... I\'m right behind you..."',
    durationEstimate: 4.5,
  },
  phone_chosen: {
    url: './assets/audio/tts/phone_chosen.wav',
    subtitle: 'TELEPHONE: "You\'ve been chosen."',
    durationEstimate: 2.8,
  },
};

// Spatial Emitter World Coordinates (matching ARCHITECTURE.md & Reference Frames)
const EMITTER_COORDS = {
  radio: { x: -0.70, y: 0.96, z: -13.48 },
  bathroomSink: { x: -1.92, y: 0.92, z: -8.85 },
  bathroomBallast: { x: -1.24, y: 2.22, z: -8.85 },
  bathroomDoorway: { x: -1.35, y: 0.25, z: -8.40 },
  ceilingLamp: { x: 0.0, y: 2.48, z: -6.0 },
  fridgeBloodDrip: { x: 0.18, y: 0.08, z: -6.2 },
  wingBPhone: { x: 4.2, y: 1.02, z: -12.85 },
};

// 6 distinct slice ratios across horror-character-walking-floor-creak.mp3
const FLOOR_CREAK_SLICE_RATIOS = [0.0, 0.16, 0.33, 0.50, 0.67, 0.82];

export class PTSoundscapeEngine {
  constructor(options = {}) {
    this.options = options || {};
    this.onSubtitle =
      typeof options.onSubtitle === 'function' ? options.onSubtitle : null;

    this.ctx = null;
    this.isInitialized = false;
    this.isMuted = Boolean(options.muted ?? false);
    this.isPlaying = false;

    this.currentLoop = 1;
    this.tensionLevel = 0.35; // 0.0 .. 1.0

    // Master & Submix Gain Nodes
    this.masterGain = null;
    this.musicGain = null;
    this.spatialBusGain = null;
    this.sfxGain = null;

    // 3D HRTF Spatial PannerNodes
    this.radioPanner = null;
    this.radioFilterIn = null;
    this.bathroomSinkPanner = null;
    this.bathroomBallastPanner = null;
    this.binauralBreathPanner = null;
    this.ghostCreakPanner = null;
    this.ceilingChainPanner = null;
    this.bloodDripPanner = null;
    this.phonePanner = null;

    // Continuous Procedural Generator References
    this._whiteNoiseBuffer = null;
    this._pinkNoiseBuffer = null;
    this._droneNodes = null;
    this._radioStaticNodes = null;
    this._ballastNodes = null;

    // Sole User-Provided Ambient Background Music Track (Web Audio Buffer + HTMLAudio fallback)
    this.lyriaTracks = new Map();
    this.activeLyriaKey = 'horror_ambient_bg';
    this.lyriaMusicActive = false;
    this.musicAudioBuffer = null;
    this.musicBufferSource = null;

    // Pre-generated Gemini 3.8 Flash TTS & User SFX Decoded AudioBuffers & HTMLAudio Fallbacks
    this.ttsAudioBuffers = new Map();
    this.ttsElements = new Map();
    this.sfxAudioBuffers = new Map();
    this.sfxElements = new Map();
    this._activeTtsSource = null;
    this._footstepSliceIndex = 0;
    this._ghostCreakSpotIndex = 0;

    // Periodic Psychological Audio Event Timers
    this._breathTimer = 0.8;
    this._breathPhase = 0; // 0 = inhale, 1 = exhale
    this._deepBreathSampleTimer = 2.4; // Triggers horror-character-breathing.mp3 every 4.5-6.8s
    this._ghostCreakTimer = 1.9; // Triggers 3D HRTF floorboard creaks in the dark every 2.6-4.5s
    this._fetusCryTimer = 2.2;
    this._waterDripTimer = 0.6;
    this._chainCreakLastSign = 0;
    this._bloodDripTimer = 0.45;
    this._autoRadioTimer = 9.0;
    this._autoWhisperCooldown = 0.0;
    this._heartbeatTimer = 0.0;

    // Cached player head transform for binaural neck & ghost creak positioning
    this._playerPos = { x: 0.05, y: 1.62, z: -1.65 };
    this._playerForward = { x: 0.0, y: 0.0, z: -1.0 };
    this._playerUp = { x: 0.0, y: 1.0, z: 0.0 };
    this._playerRight = { x: 1.0, y: 0.0, z: 0.0 };

    this._preloadAudioAssets();
    this._bindUnlockListeners();
  }

  // --------------------------------------------------------------------------
  // Inline Base64 Audio Resolution (for static web Origin: null Sandbox & Local)
  // --------------------------------------------------------------------------
  _resolveAudioUrl(key, fallbackUrl) {
    if (typeof window !== 'undefined' && window.__PT_INLINE_AUDIO__) {
      const map = window.__PT_INLINE_AUDIO__;
      if (map[key]) return map[key];
      if (fallbackUrl) {
        if (map[fallbackUrl]) return map[fallbackUrl];
        const noDot = fallbackUrl.replace(/^\.\//, '');
        if (map[noDot]) return map[noDot];
        if (map['/' + noDot]) return map['/' + noDot];
        const baseName = fallbackUrl.split('/').pop();
        if (baseName && map[baseName]) return map[baseName];
      }
    }
    return fallbackUrl;
  }

  _base64DataUriToArrayBuffer(dataUri) {
    if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
      return null;
    }
    try {
      const commaIdx = dataUri.indexOf(',');
      if (commaIdx < 0) return null;
      const b64 = dataUri.slice(commaIdx + 1);
      if (typeof atob === 'function') {
        const binary = atob(b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
      }
    } catch (e) {}
    return null;
  }

  async _loadAudioBuffer(key, fallbackUrl) {
    if (!this.ctx) return null;
    try {
      const resolved = this._resolveAudioUrl(key, fallbackUrl);
      let arrayBuf = null;
      if (resolved && resolved.startsWith('data:')) {
        arrayBuf = this._base64DataUriToArrayBuffer(resolved);
      } else if (typeof fetch === 'function' && resolved) {
        const resp = await fetch(resolved);
        if (resp.ok) {
          arrayBuf = await resp.arrayBuffer();
        }
      }
      if (arrayBuf && arrayBuf.byteLength > 0) {
        return await this.ctx.decodeAudioData(arrayBuf.slice(0));
      }
    } catch (e) {}
    return null;
  }

  // --------------------------------------------------------------------------
  // Preload User Ambient Track, Horror SFX MP3s, and Gemini TTS WAVs
  // --------------------------------------------------------------------------
  _preloadAudioAssets() {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    if (
      window.location &&
      window.location.search &&
      (window.location.search.includes('capture=1') ||
        window.location.search.includes('capture=true'))
    ) {
      return;
    }

    for (const [key, cfg] of Object.entries(MUSIC_ASSET_MANIFEST)) {
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.loop = true;
        audio.volume = cfg.baseVolume;
        audio.src = this._resolveAudioUrl(key, cfg.url);
        this.lyriaTracks.set(key, audio);
      } catch (e) {}
    }

    for (const [key, cfg] of Object.entries(SFX_ASSET_MANIFEST)) {
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = cfg.baseVolume;
        audio.src = this._resolveAudioUrl(key, cfg.url);
        this.sfxElements.set(key, audio);
      } catch (e) {}
    }

    for (const [key, cfg] of Object.entries(TTS_ASSET_MANIFEST)) {
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = 0.92;
        audio.src = this._resolveAudioUrl(key, cfg.url);
        this.ttsElements.set(key, audio);
      } catch (e) {}
    }
  }

  async _decodeAllBuffersIntoWebAudio() {
    if (!this.ctx) return;

    // 1. Decode horror_ambient_bg into Web Audio AudioBuffer for gapless looping
    const bgCfg = MUSIC_ASSET_MANIFEST.horror_ambient_bg;
    if (bgCfg && !this.musicAudioBuffer) {
      const decodedBg = await this._loadAudioBuffer('horror_ambient_bg', bgCfg.url);
      if (decodedBg) {
        this.musicAudioBuffer = decodedBg;
        if (!this.isMuted) {
          this._startWebAudioAmbientMusicLoop();
        }
      }
    }

    // 2. Decode user-provided SFX (creaking floorboards, breathing, jumpscare) first
    for (const [key, cfg] of Object.entries(SFX_ASSET_MANIFEST)) {
      if (this.sfxAudioBuffers.has(key)) continue;
      const decoded = await this._loadAudioBuffer(key, cfg.url);
      if (decoded) {
        this.sfxAudioBuffers.set(key, decoded);
      }
    }

    // 3. Decode Gemini TTS radio & ghost whisper clips
    for (const [key, cfg] of Object.entries(TTS_ASSET_MANIFEST)) {
      if (this.ttsAudioBuffers.has(key)) continue;
      const decoded = await this._loadAudioBuffer(key, cfg.url);
      if (decoded) {
        this.ttsAudioBuffers.set(key, decoded);
      }
    }
  }

  _startWebAudioAmbientMusicLoop() {
    if (!this.ctx || !this.musicAudioBuffer || !this.musicGain || this.isMuted) {
      return;
    }
    if (this.musicBufferSource) {
      return; // Already looping via Web Audio BufferSource
    }
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.musicAudioBuffer;
      src.loop = true;

      const bgGain = this.ctx.createGain();
      bgGain.gain.value = MUSIC_ASSET_MANIFEST.horror_ambient_bg.baseVolume;

      src.connect(bgGain);
      bgGain.connect(this.musicGain);
      src.start(0);
      this.musicBufferSource = src;
      this.lyriaMusicActive = true;

      // Mute synthetic oscillator drone completely so horror-ambient-bg-music.mp3 is crystal clear
      if (this._droneNodes && this._droneNodes.droneGain) {
        this._droneNodes.droneGain.gain.setTargetAtTime(
          0.0,
          this.ctx.currentTime,
          0.15
        );
      }

      // Pause HTMLAudio fallback for horror_ambient_bg to avoid double-playing out of phase
      const htmlTrack = this.lyriaTracks.get('horror_ambient_bg');
      if (htmlTrack && !htmlTrack.paused) {
        try {
          htmlTrack.pause();
        } catch (e) {}
      }
    } catch (e) {}
  }

  _stopWebAudioAmbientMusicLoop() {
    if (this.musicBufferSource) {
      try {
        this.musicBufferSource.stop();
        this.musicBufferSource.disconnect();
      } catch (e) {}
      this.musicBufferSource = null;
    }
  }

  _bindUnlockListeners() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      if (!this.isInitialized && !this.isMuted) {
        this.init();
      } else if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
        this.ctx.resume().catch(() => {});
      }
      if (!this.isMuted && !this.lyriaMusicActive) {
        this._syncLyriaPlayback();
      }
    };
    const events = ['pointerdown', 'keydown', 'mousemove', 'wheel', 'touchstart'];
    events.forEach((evt) => {
      window.addEventListener(evt, unlock, { passive: true });
    });
  }

  // --------------------------------------------------------------------------
  // Core Lifecycle: init(), resume(), toggleMute(), setLoopMood()
  // --------------------------------------------------------------------------
  init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
        this.ctx.resume().catch(() => {});
      }
      if (!this.isMuted) {
        this._syncLyriaPlayback();
      }
      return true;
    }

    try {
      const AudioCtx =
        (typeof window !== 'undefined' &&
          (window.AudioContext || window.webkitAudioContext)) ||
        null;
      if (!AudioCtx) return false;

      this.ctx = new AudioCtx();

      // Master compressor/limiter to keep creaks, breathing, and ambient music rich and punchy
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -8;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.16;
      this.compressor.connect(this.ctx.destination);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0.0 : 0.92;
      this.masterGain.connect(this.compressor);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.72;
      this.musicGain.connect(this.masterGain);

      this.spatialBusGain = this.ctx.createGain();
      this.spatialBusGain.gain.value = 0.92;
      this.spatialBusGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.95;
      this.sfxGain.connect(this.masterGain);

      this._buildNoiseBuffers();
      this._buildSpatialPanners();
      this._startProceduralRoomDrone();
      this._startRadioStaticEmitter();
      this._startBathroomFluorescentBallast();

      this.isInitialized = true;
      this.isPlaying = !this.isMuted;

      this._decodeAllBuffersIntoWebAudio();
      if (!this.isMuted) {
        this._syncLyriaPlayback();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
      this.ctx.resume().catch(() => {});
    }
    if (!this.isMuted) {
      this._syncLyriaPlayback();
    }
  }

  toggleMute() {
    if (!this.isInitialized) {
      this.isMuted = false;
      this.init();
      return this.isMuted;
    }
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0.0 : 0.92,
        now,
        0.05
      );
      if (!this.isMuted && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
    if (this.isMuted) {
      this._stopWebAudioAmbientMusicLoop();
      for (const track of this.lyriaTracks.values()) {
        try {
          track.pause();
        } catch (e) {}
      }
      for (const el of this.ttsElements.values()) {
        try {
          el.pause();
        } catch (e) {}
      }
      for (const el of this.sfxElements.values()) {
        try {
          el.pause();
        } catch (e) {}
      }
      this.lyriaMusicActive = false;
    } else {
      this._syncLyriaPlayback();
    }
    this.isPlaying = !this.isMuted;
  }

  setTension(level = 0.35) {
    this.tensionLevel = Math.max(0.0, Math.min(1.0, Number(level) || 0.0));
    if (this.ctx && this._droneNodes && !this.musicBufferSource) {
      const now = this.ctx.currentTime;
      const targetFilter = 75 + this.tensionLevel * 140;
      this._droneNodes.filter.frequency.setTargetAtTime(targetFilter, now, 0.25);
    }
  }

  setLoopMood(loopNumber = 1) {
    const loop = Math.max(1, Math.min(5, Number(loopNumber) || 1));
    const prevLoop = this.currentLoop;
    this.currentLoop = loop;

    // Always use the user-provided horror_ambient_bg track across all loops
    this.activeLyriaKey = 'horror_ambient_bg';

    // Tension scaling by loop
    const loopTensionMap = {
      1: 0.28,
      2: 0.50,
      3: 0.92,
      4: 0.82,
      5: 0.60,
    };
    this.setTension(loopTensionMap[loop] ?? 0.35);

    if (!this.isMuted && this.isInitialized) {
      this._syncLyriaPlayback();

      // Trigger signature loop audio cues on loop transition
      if (prevLoop !== loop) {
        // Immediate ominous floorboard groan on loop shift
        this.playAutonomousFloorCreak();
        if (loop === 2) {
          this.triggerRadioBroadcast('radio_broadcast_01', this.onSubtitle);
        } else if (loop === 3) {
          this.triggerRadioBroadcast('radio_numbers_204863', this.onSubtitle);
        } else if (loop === 4) {
          this.playMidnightChime();
          setTimeout(() => {
            if (!this.isMuted && this.currentLoop === 4) {
              this.triggerGhostWhisper(this.onSubtitle);
            }
          }, 1800);
        } else if (loop === 5) {
          this.triggerPhoneCall(this.onSubtitle);
        }
      }
    }
  }

  _syncLyriaPlayback() {
    if (this.isMuted) return;

    // Prefer gapless Web Audio BufferSource playback of horror-ambient-bg-music.mp3
    if (this.musicAudioBuffer && this.ctx) {
      this._startWebAudioAmbientMusicLoop();
      return;
    }

    // Fallback to HTMLAudioElement while AudioBuffer is decoding
    const track = this.lyriaTracks.get('horror_ambient_bg');
    if (track) {
      const cfg = MUSIC_ASSET_MANIFEST.horror_ambient_bg;
      const resolvedSrc = this._resolveAudioUrl('horror_ambient_bg', cfg.url);
      if (track.src !== resolvedSrc && resolvedSrc.startsWith('data:')) {
        track.src = resolvedSrc;
      }
      track.volume = cfg.baseVolume;
      if (track.paused) {
        track
          .play()
          .then(() => {
            this.lyriaMusicActive = true;
          })
          .catch(() => {});
      }
    }
  }

  // --------------------------------------------------------------------------
  // Noise Buffers & Vintage Radio Distortion Curve
  // --------------------------------------------------------------------------
  _buildNoiseBuffers() {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const len = sr * 4;

    // 1. White Noise Buffer (with occasional vinyl/AM static pops)
    const whiteBuf = this.ctx.createBuffer(1, len, sr);
    const wData = whiteBuf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      let sample = (Math.random() * 2 - 1) * 0.35;
      if (Math.random() < 0.0018) {
        sample = (Math.random() > 0.5 ? 1 : -1) * (0.75 + Math.random() * 0.25);
      }
      wData[i] = sample;
    }
    this._whiteNoiseBuffer = whiteBuf;

    // 2. Pink Noise Buffer (for damp breath, room air, water splash, footsteps)
    const pinkBuf = this.ctx.createBuffer(1, len, sr);
    const pData = pinkBuf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }
    this._pinkNoiseBuffer = pinkBuf;
  }

  _makeVintageRadioWaveShaper(drive = 28) {
    const shaper = this.ctx.createWaveShaper();
    const n = 2048;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      const asym = x + 0.08 * x * x;
      curve[i] =
        ((3 + drive) * asym * 20 * deg) / (Math.PI + drive * Math.abs(asym));
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    return shaper;
  }

  // --------------------------------------------------------------------------
  // 3D HRTF Spatial Panner Setup
  // --------------------------------------------------------------------------
  _createHRTFPanner(coords, refDistance = 1.2, maxDistance = 22.0, rolloff = 1.35) {
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = refDistance;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = rolloff;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.coneOuterGain = 1.0;
    this._setPannerPosition(panner, coords.x, coords.y, coords.z);
    panner.connect(this.spatialBusGain);
    return panner;
  }

  _setPannerPosition(panner, x, y, z) {
    if (!panner || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (panner.positionX) {
      panner.positionX.setTargetAtTime(x, now, 0.02);
      panner.positionY.setTargetAtTime(y, now, 0.02);
      panner.positionZ.setTargetAtTime(z, now, 0.02);
    } else if (typeof panner.setPosition === 'function') {
      panner.setPosition(x, y, z);
    }
  }

  _buildSpatialPanners() {
    if (!this.ctx) return;

    // 1. 1970s Tabletop Radio Emitter at (-0.70, 0.96, -13.48)
    this.radioPanner = this._createHRTFPanner(EMITTER_COORDS.radio, 1.35, 24.0, 1.25);

    // Vintage AM Radio Speaker Filter Chain (400Hz - 2800Hz bandpass + waveshaper)
    const radioHP = this.ctx.createBiquadFilter();
    radioHP.type = 'highpass';
    radioHP.frequency.value = 400;
    radioHP.Q.value = 0.85;

    const radioMidPeak = this.ctx.createBiquadFilter();
    radioMidPeak.type = 'peaking';
    radioMidPeak.frequency.value = 1280;
    radioMidPeak.Q.value = 2.2;
    radioMidPeak.gain.value = 5.5;

    const radioLP = this.ctx.createBiquadFilter();
    radioLP.type = 'lowpass';
    radioLP.frequency.value = 2800;
    radioLP.Q.value = 1.1;

    const radioShaper = this._makeVintageRadioWaveShaper(24);

    radioHP.connect(radioMidPeak);
    radioMidPeak.connect(radioShaper);
    radioShaper.connect(radioLP);
    radioLP.connect(this.radioPanner);
    this.radioFilterIn = radioHP;

    // 2. Bathroom Sink Specimen Emitter at (-1.92, 0.92, -8.85)
    this.bathroomSinkPanner = this._createHRTFPanner(
      EMITTER_COORDS.bathroomSink,
      0.95,
      14.0,
      1.6
    );

    // 3. Bathroom Flickering Fluorescent Ballast Buzz at (-1.24, 2.22, -8.85)
    this.bathroomBallastPanner = this._createHRTFPanner(
      EMITTER_COORDS.bathroomBallast,
      0.85,
      11.0,
      1.8
    );

    // 4. Binaural Ghost Breathing Behind the Player's Neck (0.28m behind head)
    this.binauralBreathPanner = this._createHRTFPanner(
      { x: 0.05, y: 1.58, z: -1.37 },
      0.25,
      4.5,
      2.0
    );

    // 5. Autonomous 3D Ghost Floorboard Creak Panner (shifts around player in dark hallway)
    this.ghostCreakPanner = this._createHRTFPanner(
      { x: -0.25, y: 0.05, z: -4.2 },
      1.15,
      18.0,
      1.2
    );

    // 6. Swinging Ceiling Lamp & Loop 3 Refrigerator Chain Emitter at (0.0, 2.48, -6.0)
    this.ceilingChainPanner = this._createHRTFPanner(
      EMITTER_COORDS.ceilingLamp,
      1.2,
      16.0,
      1.4
    );

    // 7. Loop 3 Refrigerator Blood Drip Puddle Emitter at (0.18, 0.08, -6.2)
    this.bloodDripPanner = this._createHRTFPanner(
      EMITTER_COORDS.fridgeBloodDrip,
      1.0,
      14.0,
      1.5
    );

    // 8. Wing B Telephone Emitter at (4.2, 1.02, -12.85)
    this.phonePanner = this._createHRTFPanner(
      EMITTER_COORDS.wingBPhone,
      1.3,
      20.0,
      1.3
    );
  }

  // --------------------------------------------------------------------------
  // Continuous Ambient Layers:
  // 1. Subtle 0.02 Sub-Bass Room Pressure (auto-mutes when horror-ambient-bg-music plays)
  // 2. 1970s Tabletop Radio Static + 60Hz Mains Hum
  // 3. Bathroom 120Hz Fluorescent Ballast Hum
  // --------------------------------------------------------------------------
  _startProceduralRoomDrone() {
    if (!this.ctx) return;
    try {
      const subOsc = this.ctx.createOscillator();
      const fifthOsc = this.ctx.createOscillator();

      subOsc.type = 'sine';
      fifthOsc.type = 'triangle';

      subOsc.frequency.value = 43.65;
      fifthOsc.frequency.value = 65.41;

      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.15;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 10.0;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 90.0;
      filter.Q.value = 1.5;

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // Keep synthetic oscillator drone at 0.02 so user's horror-ambient-bg-music.mp3 dominates cleanly
      const droneGain = this.ctx.createGain();
      droneGain.gain.value = 0.02;

      subOsc.connect(filter);
      fifthOsc.connect(filter);
      filter.connect(droneGain);
      droneGain.connect(this.musicGain);

      subOsc.start();
      fifthOsc.start();
      lfo.start();

      this._droneNodes = { subOsc, fifthOsc, lfo, filter, droneGain };
    } catch (e) {}
  }

  _startRadioStaticEmitter() {
    if (!this.ctx || !this._whiteNoiseBuffer || !this.radioFilterIn) return;
    try {
      const staticSrc = this.ctx.createBufferSource();
      staticSrc.buffer = this._whiteNoiseBuffer;
      staticSrc.loop = true;

      const staticGain = this.ctx.createGain();
      staticGain.gain.value = 0.095;

      const hum60 = this.ctx.createOscillator();
      hum60.type = 'sine';
      hum60.frequency.value = 60.0;
      const hum60Gain = this.ctx.createGain();
      hum60Gain.gain.value = 0.025;

      const hum120 = this.ctx.createOscillator();
      hum120.type = 'sawtooth';
      hum120.frequency.value = 120.0;
      const hum120Gain = this.ctx.createGain();
      hum120Gain.gain.value = 0.011;

      staticSrc.connect(staticGain);
      staticGain.connect(this.radioFilterIn);

      hum60.connect(hum60Gain);
      hum60Gain.connect(this.radioPanner);

      hum120.connect(hum120Gain);
      hum120Gain.connect(this.radioFilterIn);

      staticSrc.start();
      hum60.start();
      hum120.start();

      this._radioStaticNodes = { staticSrc, staticGain, hum60, hum120 };
    } catch (e) {}
  }

  _startBathroomFluorescentBallast() {
    if (!this.ctx || !this.bathroomBallastPanner) return;
    try {
      const buzz120 = this.ctx.createOscillator();
      buzz120.type = 'sawtooth';
      buzz120.frequency.value = 120.0;

      const buzz240 = this.ctx.createOscillator();
      buzz240.type = 'square';
      buzz240.frequency.value = 240.0;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 360.0;
      bp.Q.value = 1.8;

      const ballastGain = this.ctx.createGain();
      ballastGain.gain.value = 0.038;

      buzz120.connect(bp);
      buzz240.connect(bp);
      bp.connect(ballastGain);
      ballastGain.connect(this.bathroomBallastPanner);

      buzz120.start();
      buzz240.start();

      this._ballastNodes = { buzz120, buzz240, ballastGain };
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Spatialized Procedural + Sampled Emitters:
  // - Autonomous 3D HRTF Floorboard Creaking in the Dark (playAutonomousFloorCreak)
  // - Binaural Ghost Breathing Behind the Player's Neck (0.28m behind head)
  // - Bathroom Sink Fetus Whimper & Wet Organic Squelch + Water Drip
  // - Swinging Lamp / Loop 3 Refrigerator Chain Creak & Blood Drip
  // --------------------------------------------------------------------------
  playAutonomousFloorCreak(customWorldPos = null) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    const panner = this.ghostCreakPanner || this.sfxGain;

    try {
      // Position the 3D floorboard creak at unsettling locations in the dark around the player:
      // Spot 0: 2.4m ahead in the dark corridor
      // Spot 1: 1.3m directly behind the player's back (as if someone is following you!)
      // Spot 2: 1.6m inside the ajar bathroom doorway (-1.35, 0.15, -8.40)
      // Spot 3: 1.9m ahead-left along the old wainscoting floorboards
      if (this.ghostCreakPanner) {
        let cx = this._playerPos.x;
        let cy = 0.08;
        let cz = this._playerPos.z;

        if (customWorldPos && typeof customWorldPos.x === 'number') {
          cx = customWorldPos.x;
          cy = customWorldPos.y ?? 0.08;
          cz = customWorldPos.z;
        } else {
          const spot = this._ghostCreakSpotIndex++ % 4;
          const fx = this._playerForward.x;
          const fz = this._playerForward.z;
          const rx = this._playerRight.x;
          const rz = this._playerRight.z;

          if (spot === 0) {
            // 2.4m ahead in the dark hallway
            cx += fx * 2.4 + rx * (Math.random() * 0.5 - 0.25);
            cz += fz * 2.4 + rz * (Math.random() * 0.5 - 0.25);
          } else if (spot === 1) {
            // 1.3m right behind the player's heels!
            cx -= fx * 1.3 + rx * (Math.random() * 0.4 - 0.2);
            cz -= fz * 1.3 + rz * (Math.random() * 0.4 - 0.2);
          } else if (spot === 2) {
            // Inside the dark bathroom doorway
            cx = EMITTER_COORDS.bathroomDoorway.x;
            cy = EMITTER_COORDS.bathroomDoorway.y;
            cz = EMITTER_COORDS.bathroomDoorway.z;
          } else {
            // 1.8m off to the side/behind
            const side = Math.random() < 0.5 ? -0.75 : 0.75;
            cx += fx * 1.6 + rx * side;
            cz += fz * 1.6 + rz * side;
          }
        }
        this._setPannerPosition(this.ghostCreakPanner, cx, cy, cz);
      }

      // Play a slow, heavy, terrifying slice of horror-character-walking-floor-creak.mp3
      const creakBuf = this.sfxAudioBuffers.get('walking_floor_creak');
      const sliceRatio =
        FLOOR_CREAK_SLICE_RATIOS[
          this._footstepSliceIndex++ % FLOOR_CREAK_SLICE_RATIOS.length
        ];
      const sliceOffset = creakBuf
        ? sliceRatio * Math.max(0, creakBuf.duration - 1.15)
        : sliceRatio * 2.4;

      const rate = 0.72 + Math.random() * 0.22; // Slow, heavy weight shift on old timber
      const creakGain = Math.min(1.0, 0.84 + this.tensionLevel * 0.14);

      this._playSfxSlice('walking_floor_creak', panner, {
        offset: sliceOffset,
        duration: 0.95 + Math.random() * 0.35,
        gain: creakGain,
        playbackRate: rate,
      });

      // Layer a deep procedural slip-stick hardwood joist groan for tactile sub-bass wood resonance
      this._playProceduralWoodCreak(panner, {
        duration: 0.65 + Math.random() * 0.35,
        gain: 0.24,
        pitchScale: 0.78 + Math.random() * 0.18,
      });
    } catch (e) {}
  }

  _playProceduralWoodCreak(
    destinationNode,
    { duration = 0.35, gain = 0.24, pitchScale = 1.0 } = {}
  ) {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const out = destinationNode || this.sfxGain;

      // Dual-oscillator FM slip-stick hardwood plank groan (220Hz -> 135Hz) + timber pop
      const boardOsc = this.ctx.createOscillator();
      const subWoodOsc = this.ctx.createOscillator();
      const stickMod = this.ctx.createOscillator();
      const stickGain = this.ctx.createGain();

      boardOsc.type = 'sawtooth';
      subWoodOsc.type = 'triangle';
      stickMod.type = 'sawtooth';

      const fStart = (220 + Math.random() * 35) * pitchScale;
      const fMid = (135 + Math.random() * 20) * pitchScale;
      const fEnd = (165 + Math.random() * 25) * pitchScale;

      boardOsc.frequency.setValueAtTime(fStart, now);
      boardOsc.frequency.exponentialRampToValueAtTime(fMid, now + duration * 0.55);
      boardOsc.frequency.linearRampToValueAtTime(fEnd, now + duration);

      subWoodOsc.frequency.setValueAtTime(fStart * 0.5, now);
      subWoodOsc.frequency.exponentialRampToValueAtTime(fMid * 0.5, now + duration);

      stickMod.frequency.setValueAtTime(24 + Math.random() * 18, now);
      stickMod.frequency.linearRampToValueAtTime(14 + Math.random() * 10, now + duration);
      stickGain.gain.value = 52 * pitchScale;

      stickMod.connect(stickGain);
      stickGain.connect(boardOsc.frequency);

      // Resonant wooden cavity formant filters
      const woodBP1 = this.ctx.createBiquadFilter();
      woodBP1.type = 'bandpass';
      woodBP1.frequency.value = 460 * pitchScale;
      woodBP1.Q.value = 3.8;

      const woodBP2 = this.ctx.createBiquadFilter();
      woodBP2.type = 'peaking';
      woodBP2.frequency.value = 1180 * pitchScale;
      woodBP2.Q.value = 2.5;
      woodBP2.gain.value = 6.0;

      const creakGain = this.ctx.createGain();
      creakGain.gain.setValueAtTime(0.0005, now);
      creakGain.gain.linearRampToValueAtTime(gain, now + 0.025);
      creakGain.gain.setValueAtTime(gain * 0.85, now + duration * 0.68);
      creakGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

      boardOsc.connect(woodBP1);
      subWoodOsc.connect(woodBP1);
      woodBP1.connect(woodBP2);
      woodBP2.connect(creakGain);
      creakGain.connect(out);

      boardOsc.start(now);
      subWoodOsc.start(now);
      stickMod.start(now);
      boardOsc.stop(now + duration + 0.02);
      subWoodOsc.stop(now + duration + 0.02);
      stickMod.stop(now + duration + 0.02);
    } catch (e) {}
  }

  playBathroomFetusCry() {
    if (!this.isInitialized || !this.ctx || this.isMuted || !this.bathroomSinkPanner) return;
    try {
      const now = this.ctx.currentTime;
      const dur = 0.95 + Math.random() * 0.45;

      const carrier = this.ctx.createOscillator();
      carrier.type = 'sawtooth';
      const basePitch = 510 + Math.random() * 85;
      carrier.frequency.setValueAtTime(basePitch * 0.88, now);
      carrier.frequency.linearRampToValueAtTime(basePitch * 1.24, now + dur * 0.32);
      carrier.frequency.exponentialRampToValueAtTime(basePitch * 0.74, now + dur);

      const vibrato = this.ctx.createOscillator();
      vibrato.type = 'sine';
      vibrato.frequency.value = 6.8 + Math.random() * 2.5;
      const vibGain = this.ctx.createGain();
      vibGain.gain.value = 16.0;
      vibrato.connect(vibGain);
      vibGain.connect(carrier.frequency);

      const formant1 = this.ctx.createBiquadFilter();
      formant1.type = 'bandpass';
      formant1.frequency.setValueAtTime(720, now);
      formant1.frequency.linearRampToValueAtTime(890, now + dur * 0.4);
      formant1.Q.value = 4.5;

      const formant2 = this.ctx.createBiquadFilter();
      formant2.type = 'bandpass';
      formant2.frequency.setValueAtTime(2150, now);
      formant2.frequency.linearRampToValueAtTime(2480, now + dur * 0.4);
      formant2.Q.value = 5.2;

      const cryEnv = this.ctx.createGain();
      const peakVol = this.currentLoop >= 2 ? 0.16 : 0.08;
      cryEnv.gain.setValueAtTime(0.0001, now);
      cryEnv.gain.linearRampToValueAtTime(peakVol, now + 0.08);
      cryEnv.gain.setValueAtTime(peakVol * 0.75, now + dur * 0.55);
      cryEnv.gain.exponentialRampToValueAtTime(0.0005, now + dur);

      carrier.connect(formant1);
      carrier.connect(formant2);
      formant1.connect(cryEnv);
      formant2.connect(cryEnv);
      cryEnv.connect(this.bathroomSinkPanner);

      carrier.start(now);
      vibrato.start(now);
      carrier.stop(now + dur + 0.03);
      vibrato.stop(now + dur + 0.03);

      this._playWetOrganicSquelch(now + 0.12);
    } catch (e) {}
  }

  _playWetOrganicSquelch(startTime = null) {
    if (!this.ctx || !this._pinkNoiseBuffer || !this.bathroomSinkPanner) return;
    try {
      const t = startTime || this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this._pinkNoiseBuffer;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(420, t);
      bp.frequency.exponentialRampToValueAtTime(1650, t + 0.14);
      bp.Q.value = 6.5;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      src.connect(bp);
      bp.connect(g);
      g.connect(this.bathroomSinkPanner);
      src.start(t, Math.random() * 2.0, 0.18);
    } catch (e) {}
  }

  _playWaterDripImpulse(pannerNode, baseFreq = 1350, volume = 0.14) {
    if (!this.ctx || this.isMuted || !pannerNode) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const f0 = baseFreq * (0.9 + Math.random() * 0.22);
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.95, now + 0.042);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.055);

      osc.connect(gain);
      gain.connect(pannerNode);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  _playSfxSlice(
    sfxKey,
    destinationNode = null,
    {
      offset = 0,
      duration = 0,
      gain = 0.9,
      playbackRate = 1.0,
    } = {}
  ) {
    if (!this.ctx || this.isMuted) return false;
    const out = destinationNode || this.sfxGain;
    const buf = this.sfxAudioBuffers.get(sfxKey);

    if (buf && out) {
      try {
        const now = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = playbackRate;

        const safeOffset = Math.max(
          0,
          Math.min(offset, Math.max(0, buf.duration - 0.15))
        );
        const playDur =
          duration > 0
            ? Math.min(duration, Math.max(0.08, buf.duration - safeOffset))
            : Math.max(0.08, buf.duration - safeOffset);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(gain, now + 0.012);
        g.gain.setValueAtTime(gain, now + Math.max(0.02, playDur - 0.04));
        g.gain.exponentialRampToValueAtTime(0.0008, now + playDur);

        src.connect(g);
        g.connect(out);
        src.start(now, safeOffset, playDur + 0.01);
        return true;
      } catch (e) {}
    }

    const baseEl = this.sfxElements.get(sfxKey);
    if (baseEl) {
      try {
        const clone = baseEl.cloneNode();
        clone.volume = Math.max(0, Math.min(1, gain));
        clone.playbackRate = playbackRate;
        if (offset > 0) {
          try {
            clone.currentTime = offset;
          } catch (e) {}
        }
        clone.play().catch(() => {});
        if (duration > 0) {
          setTimeout(() => {
            try {
              clone.pause();
            } catch (e) {}
          }, duration * 1000);
        }
        return true;
      } catch (e) {}
    }
    return false;
  }

  _playBinauralBreathCycle(isInhale = true) {
    if (
      !this.ctx ||
      this.isMuted ||
      !this._pinkNoiseBuffer ||
      !this.binauralBreathPanner
    ) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      const dur = isInhale ? 0.92 : 1.22;

      const loopBoost =
        this.currentLoop === 4 || this.currentLoop === 2 ? 1.35 : 1.0;

      // Prominently layer user-provided horror-character-breathing.mp3 right behind the player's neck!
      const breathBuf = this.sfxAudioBuffers.get('character_breathing');
      const maxOffset = breathBuf
        ? Math.max(0, breathBuf.duration - dur - 0.25)
        : 2.5;
      const sliceOffset = isInhale
        ? (this._breathPhase * 1.4) % Math.max(0.5, maxOffset)
        : (0.95 + Math.random() * 0.75) % Math.max(0.5, maxOffset);
      this._playSfxSlice('character_breathing', this.binauralBreathPanner, {
        offset: sliceOffset,
        duration: dur + 0.15,
        gain: Math.min(1.0, (0.68 + this.tensionLevel * 0.22) * loopBoost),
        playbackRate: isInhale ? 0.98 : 0.91,
      });

      const src = this.ctx.createBufferSource();
      src.buffer = this._pinkNoiseBuffer;

      const throatFilter = this.ctx.createBiquadFilter();
      throatFilter.type = 'bandpass';
      const centerFreq = isInhale ? 1120 : 840;
      throatFilter.frequency.setValueAtTime(centerFreq * 0.85, now);
      throatFilter.frequency.linearRampToValueAtTime(
        centerFreq * 1.18,
        now + dur * 0.45
      );
      throatFilter.frequency.linearRampToValueAtTime(
        centerFreq * 0.78,
        now + dur
      );
      throatFilter.Q.value = 3.6;

      const wheezeOsc = this.ctx.createOscillator();
      wheezeOsc.type = 'triangle';
      wheezeOsc.frequency.setValueAtTime(isInhale ? 395 : 310, now);
      wheezeOsc.frequency.linearRampToValueAtTime(
        isInhale ? 430 : 265,
        now + dur
      );
      const wheezeGain = this.ctx.createGain();
      wheezeGain.gain.value = 0.045;

      const breathGain = this.ctx.createGain();
      const peak =
        (0.055 + this.tensionLevel * 0.12) *
        loopBoost *
        (isInhale ? 1.0 : 0.82);

      breathGain.gain.setValueAtTime(0.0005, now);
      breathGain.gain.linearRampToValueAtTime(peak, now + dur * 0.32);
      breathGain.gain.exponentialRampToValueAtTime(0.0005, now + dur);

      src.connect(throatFilter);
      wheezeOsc.connect(wheezeGain);
      wheezeGain.connect(throatFilter);
      throatFilter.connect(breathGain);
      breathGain.connect(this.binauralBreathPanner);

      src.start(now, Math.random() * 1.8, dur + 0.05);
      wheezeOsc.start(now);
      wheezeOsc.stop(now + dur + 0.04);
    } catch (e) {}
  }

  _playChainCreakImpulse(isHeavyFridge = false) {
    if (!this.ctx || this.isMuted || !this.ceilingChainPanner) return;
    try {
      const now = this.ctx.currentTime;
      const dur = isHeavyFridge ? 0.38 : 0.22;

      const carrier = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();

      carrier.type = 'sawtooth';
      mod.type = 'sine';

      const baseFreq = isHeavyFridge
        ? 420 + Math.random() * 140
        : 680 + Math.random() * 220;
      carrier.frequency.setValueAtTime(baseFreq, now);
      carrier.frequency.exponentialRampToValueAtTime(
        baseFreq * (isHeavyFridge ? 0.72 : 1.28),
        now + dur
      );

      mod.frequency.value = isHeavyFridge ? 34 : 52;
      modGain.gain.value = isHeavyFridge ? 140 : 85;
      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      const metallicBP = this.ctx.createBiquadFilter();
      metallicBP.type = 'bandpass';
      metallicBP.frequency.value = isHeavyFridge ? 1150 : 1850;
      metallicBP.Q.value = 5.5;

      const env = this.ctx.createGain();
      const peak = isHeavyFridge ? 0.16 : 0.075;
      env.gain.setValueAtTime(0.0005, now);
      env.gain.linearRampToValueAtTime(peak, now + 0.025);
      env.gain.exponentialRampToValueAtTime(0.0005, now + dur);

      carrier.connect(metallicBP);
      metallicBP.connect(env);
      env.connect(this.ceilingChainPanner);

      carrier.start(now);
      mod.start(now);
      carrier.stop(now + dur + 0.02);
      mod.stop(now + dur + 0.02);
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Pre-Generated Gemini 3.8 Flash TTS Triggers:
  // - triggerRadioBroadcast(clipName, onSubtitle)
  // - triggerGhostWhisper(onSubtitle)
  // - triggerPhoneCall(onSubtitle)
  // --------------------------------------------------------------------------
  triggerRadioBroadcast(clipName = 'radio_broadcast_01', onSubtitle = null) {
    if (!this.isInitialized) this.init();
    if (this.isMuted) return;

    let resolvedKey = 'radio_broadcast_01';
    const norm = String(clipName || '').toLowerCase();
    if (norm.includes('204863') || norm.includes('number') || norm.includes('dial')) {
      resolvedKey = 'radio_numbers_204863';
    } else if (norm.includes('chosen') || norm.includes('phone')) {
      resolvedKey = 'phone_chosen';
    } else if (norm.includes('whisper') || norm.includes('lisa') || norm.includes('forgive')) {
      resolvedKey = 'lisa_whisper_behind';
    }

    const meta = TTS_ASSET_MANIFEST[resolvedKey] || TTS_ASSET_MANIFEST.radio_broadcast_01;
    const subtitleCb =
      typeof onSubtitle === 'function' ? onSubtitle : this.onSubtitle;
    if (subtitleCb) {
      subtitleCb(meta.subtitle, meta.durationEstimate);
    }

    this.playRadioStaticBurst(0.65, 0.28);

    const targetNode =
      resolvedKey === 'phone_chosen'
        ? this.phonePanner
        : resolvedKey === 'lisa_whisper_behind'
          ? this.binauralBreathPanner
          : this.radioFilterIn || this.radioPanner;

    this._playTtsClipSpatialOrFallback(resolvedKey, targetNode, 1.15);
  }

  triggerGhostWhisper(onSubtitle = null) {
    if (!this.isInitialized) this.init();
    if (this.isMuted) return;

    const meta = TTS_ASSET_MANIFEST.lisa_whisper_behind;
    const subtitleCb =
      typeof onSubtitle === 'function' ? onSubtitle : this.onSubtitle;
    if (subtitleCb) {
      subtitleCb(meta.subtitle, meta.durationEstimate);
    }

    this._playBinauralBreathCycle(true);
    this._playTtsClipSpatialOrFallback(
      'lisa_whisper_behind',
      this.binauralBreathPanner,
      1.35
    );
  }

  triggerPhoneCall(onSubtitle = null) {
    if (!this.isInitialized) this.init();
    if (this.isMuted) return;

    this.playPhoneRing();
    setTimeout(() => {
      if (this.isMuted) return;
      const meta = TTS_ASSET_MANIFEST.phone_chosen;
      const subtitleCb =
        typeof onSubtitle === 'function' ? onSubtitle : this.onSubtitle;
      if (subtitleCb) {
        subtitleCb(meta.subtitle, meta.durationEstimate);
      }
      this._playTtsClipSpatialOrFallback('phone_chosen', this.phonePanner, 1.25);
    }, 1100);
  }

  _playTtsClipSpatialOrFallback(clipKey, destinationNode, gainValue = 1.0) {
    if (!this.ctx || this.isMuted) return;

    if (this._activeTtsSource) {
      try {
        this._activeTtsSource.stop();
      } catch (e) {}
      this._activeTtsSource = null;
    }

    const decodedBuf = this.ttsAudioBuffers.get(clipKey);
    if (decodedBuf && destinationNode) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = decodedBuf;
        const g = this.ctx.createGain();
        g.gain.value = gainValue;
        src.connect(g);
        g.connect(destinationNode);
        this._activeTtsSource = src;
        src.start(this.ctx.currentTime + 0.05);
        return;
      } catch (e) {}
    }

    const el = this.ttsElements.get(clipKey);
    if (el) {
      try {
        el.currentTime = 0;
        el.volume = Math.min(1.0, gainValue * 0.85);
        el.play().catch(() => {
          this._synthesizeProceduralVoiceFallback(clipKey, destinationNode);
        });
        return;
      } catch (e) {}
    }

    this._synthesizeProceduralVoiceFallback(clipKey, destinationNode);
  }

  _synthesizeProceduralVoiceFallback(clipKey, destinationNode) {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const out = destinationNode || this.sfxGain;
      const isWhisper = clipKey === 'lisa_whisper_behind';
      const syllables = isWhisper ? 6 : 8;

      for (let i = 0; i < syllables; i++) {
        const t = now + i * 0.24;
        if (isWhisper && this._pinkNoiseBuffer) {
          const nSrc = this.ctx.createBufferSource();
          nSrc.buffer = this._pinkNoiseBuffer;
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 950 + (i % 3) * 320;
          bp.Q.value = 4.0;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(0.18, t + 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          nSrc.connect(bp);
          bp.connect(g);
          g.connect(out);
          nSrc.start(t, (i * 0.3) % 2.0, 0.22);
        } else {
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(105 + (i % 3) * 12, t);
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 650 + (i % 4) * 240;
          bp.Q.value = 3.5;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(0.14, t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
          osc.connect(bp);
          bp.connect(g);
          g.connect(out);
          osc.start(t);
          osc.stop(t + 0.2);
        }
      }
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Procedural + Sampled Sound Effects (SFX):
  // - playFootstep(surface = 'wood', isRunning = false)
  // - playFlashlightClick(isOn = true)
  // - playFlashlightFlickerBuzz(intensity = 0.5)
  // - playDoorCreak(isBathroom = true)
  // - playMidnightChime()
  // - playClueCollect()
  // - playJumpScareStinger()
  // --------------------------------------------------------------------------
  playFootstep(surface = 'wood', isRunning = false) {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const surf = String(surface || 'wood').toLowerCase();
      const isWet =
        surf.includes('wet') ||
        surf.includes('puddle') ||
        surf.includes('blood') ||
        surf.includes('tile') ||
        surf.includes('bath') ||
        this.currentLoop === 3;
      const isTile = surf.includes('tile') || surf.includes('bath');

      const velScale = isRunning ? 1.25 : 1.0;

      // 0. Prominent user-provided horror-character-walking-floor-creak.mp3 slice on EVERY footstep!
      // Cycles through 6 distinct slice offsets so the floorboards groan, pop, and creak terrifyingly
      const creakBuf = this.sfxAudioBuffers.get('walking_floor_creak');
      const sliceRatio =
        FLOOR_CREAK_SLICE_RATIOS[
          this._footstepSliceIndex++ % FLOOR_CREAK_SLICE_RATIOS.length
        ];
      const stepOff = creakBuf
        ? sliceRatio * Math.max(0, creakBuf.duration - 0.85)
        : sliceRatio * 2.2;
      const creakRate = 0.82 + Math.random() * 0.28;
      const creakGain = Math.min(
        1.0,
        (isTile ? 0.65 : 0.92 + Math.random() * 0.12) * velScale
      );

      this._playSfxSlice('walking_floor_creak', this.sfxGain, {
        offset: stepOff,
        duration: isRunning ? 0.58 : 0.78,
        gain: creakGain,
        playbackRate: creakRate,
      });

      // 1. Low-Frequency Heel Impact (65Hz damped structural thump)
      const heelOsc = this.ctx.createOscillator();
      heelOsc.type = 'sine';
      const startFreq = isTile ? 115 : 82;
      const endFreq = isTile ? 58 : 40;
      heelOsc.frequency.setValueAtTime(
        startFreq * (0.94 + Math.random() * 0.12),
        now
      );
      heelOsc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.095);

      const heelGain = this.ctx.createGain();
      heelGain.gain.setValueAtTime(0.001, now);
      heelGain.gain.linearRampToValueAtTime(0.38 * velScale, now + 0.006);
      heelGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.11);

      heelOsc.connect(heelGain);
      heelGain.connect(this.sfxGain);
      heelOsc.start(now);
      heelOsc.stop(now + 0.12);

      // 2. Leather Sole Scuff Transient
      if (this._pinkNoiseBuffer) {
        const scuffSrc = this.ctx.createBufferSource();
        scuffSrc.buffer = this._pinkNoiseBuffer;
        const scuffBP = this.ctx.createBiquadFilter();
        scuffBP.type = 'bandpass';
        scuffBP.frequency.value = isTile ? 2100 : 1150;
        scuffBP.Q.value = 1.8;

        const scuffGain = this.ctx.createGain();
        scuffGain.gain.setValueAtTime(0.001, now + 0.015);
        scuffGain.gain.linearRampToValueAtTime(0.16 * velScale, now + 0.028);
        scuffGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);

        scuffSrc.connect(scuffBP);
        scuffBP.connect(scuffGain);
        scuffGain.connect(this.sfxGain);
        scuffSrc.start(now + 0.015, Math.random() * 2.0, 0.09);
      }

      // 3. Visceral Creaking Hardwood Board FM Groan on EVERY wood step (guarantees instant creak even before buffer decode)
      if (!isTile) {
        this._playProceduralWoodCreak(this.sfxGain, {
          duration: 0.24 + Math.random() * 0.16,
          gain: 0.26 * velScale,
          pitchScale: 0.9 + Math.random() * 0.22,
        });
      }

      // 4. Wet Puddle / Bathroom Tile / Blood Pool Splash Layer
      if (isWet && this._whiteNoiseBuffer) {
        const splashTime = now + 0.018;
        const splashSrc = this.ctx.createBufferSource();
        splashSrc.buffer = this._whiteNoiseBuffer;

        const splashBP = this.ctx.createBiquadFilter();
        splashBP.type = 'bandpass';
        splashBP.frequency.setValueAtTime(1650, splashTime);
        splashBP.frequency.exponentialRampToValueAtTime(2950, splashTime + 0.11);
        splashBP.Q.value = 2.8;

        const splashGain = this.ctx.createGain();
        splashGain.gain.setValueAtTime(0.001, splashTime);
        splashGain.gain.linearRampToValueAtTime(0.14 * velScale, splashTime + 0.012);
        splashGain.gain.exponentialRampToValueAtTime(0.0008, splashTime + 0.13);

        splashSrc.connect(splashBP);
        splashBP.connect(splashGain);
        splashGain.connect(this.sfxGain);
        splashSrc.start(splashTime, Math.random() * 2.0, 0.14);
      }
    } catch (e) {}
  }

  playFlashlightClick(isOn = true) {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;

      const click1 = this.ctx.createOscillator();
      click1.type = 'triangle';
      click1.frequency.setValueAtTime(isOn ? 1950 : 1620, now);
      click1.frequency.exponentialRampToValueAtTime(420, now + 0.018);

      const click2 = this.ctx.createOscillator();
      click2.type = 'square';
      click2.frequency.setValueAtTime(isOn ? 3450 : 2750, now + 0.012);
      click2.frequency.exponentialRampToValueAtTime(880, now + 0.028);

      const clickGain = this.ctx.createGain();
      clickGain.gain.setValueAtTime(0.28, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

      click1.connect(clickGain);
      click2.connect(clickGain);
      clickGain.connect(this.sfxGain);

      click1.start(now);
      click1.stop(now + 0.02);
      click2.start(now + 0.012);
      click2.stop(now + 0.032);

      const capOsc = this.ctx.createOscillator();
      capOsc.type = 'sine';
      if (isOn) {
        capOsc.frequency.setValueAtTime(6400, now + 0.02);
        capOsc.frequency.exponentialRampToValueAtTime(10800, now + 0.28);
      } else {
        capOsc.frequency.setValueAtTime(9200, now + 0.02);
        capOsc.frequency.exponentialRampToValueAtTime(3800, now + 0.22);
      }

      const capGain = this.ctx.createGain();
      capGain.gain.setValueAtTime(0.0005, now + 0.02);
      capGain.gain.linearRampToValueAtTime(0.032, now + 0.045);
      capGain.gain.exponentialRampToValueAtTime(0.0002, now + 0.3);

      capOsc.connect(capGain);
      capGain.connect(this.sfxGain);
      capOsc.start(now + 0.02);
      capOsc.stop(now + 0.32);
    } catch (e) {}
  }

  playFlashlightFlickerBuzz(intensity = 0.6) {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const lvl = Math.max(0.1, Math.min(1.0, Number(intensity) || 0.6));
      const dur = 0.07 + Math.random() * 0.08;

      const arcOsc = this.ctx.createOscillator();
      arcOsc.type = 'sawtooth';
      arcOsc.frequency.setValueAtTime(120, now);
      arcOsc.frequency.linearRampToValueAtTime(85, now + dur);

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2400;
      bp.Q.value = 3.0;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.16 * lvl, now + 0.008);
      env.gain.exponentialRampToValueAtTime(0.001, now + dur);

      arcOsc.connect(bp);
      if (this._whiteNoiseBuffer) {
        const nSrc = this.ctx.createBufferSource();
        nSrc.buffer = this._whiteNoiseBuffer;
        nSrc.connect(bp);
        nSrc.start(now, Math.random() * 2.0, dur);
      }
      bp.connect(env);
      env.connect(this.sfxGain);

      arcOsc.start(now);
      arcOsc.stop(now + dur + 0.01);
    } catch (e) {}
  }

  playDoorCreak(isBathroom = true) {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const dur = isBathroom ? 1.25 : 1.05;

      // Layer a long, low-pitched 0.68x slice of horror-character-walking-floor-creak.mp3
      this._playSfxSlice(
        'walking_floor_creak',
        isBathroom && this.bathroomSinkPanner
          ? this.bathroomSinkPanner
          : this.sfxGain,
        {
          offset: 0.12,
          duration: dur + 0.25,
          gain: 0.95,
          playbackRate: 0.68,
        }
      );

      // Long eerie wooden door hinge groan (FM slip-stick synthesis)
      const carrier = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();

      carrier.type = 'sawtooth';
      mod.type = 'triangle';

      carrier.frequency.setValueAtTime(isBathroom ? 195 : 160, now);
      carrier.frequency.linearRampToValueAtTime(
        isBathroom ? 128 : 112,
        now + dur * 0.45
      );
      carrier.frequency.linearRampToValueAtTime(
        isBathroom ? 174 : 142,
        now + dur * 0.82
      );
      carrier.frequency.exponentialRampToValueAtTime(92, now + dur);

      mod.frequency.setValueAtTime(22, now);
      mod.frequency.linearRampToValueAtTime(38, now + dur);
      modGain.gain.value = 48;

      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      const woodResonance = this.ctx.createBiquadFilter();
      woodResonance.type = 'bandpass';
      woodResonance.frequency.value = isBathroom ? 540 : 420;
      woodResonance.Q.value = 4.2;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0005, now);
      env.gain.linearRampToValueAtTime(0.28, now + 0.09);
      env.gain.setValueAtTime(0.24, now + dur * 0.7);
      env.gain.exponentialRampToValueAtTime(0.0005, now + dur);

      carrier.connect(woodResonance);
      woodResonance.connect(env);
      if (isBathroom && this.bathroomSinkPanner) {
        env.connect(this.bathroomSinkPanner);
      } else {
        env.connect(this.sfxGain);
      }

      carrier.start(now);
      mod.start(now);
      carrier.stop(now + dur + 0.03);
      mod.stop(now + dur + 0.03);
    } catch (e) {}
  }

  playMidnightChime() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const partials = [
        { freq: 110.0, amp: 0.32, decay: 3.4 },
        { freq: 220.0, amp: 0.24, decay: 2.8 },
        { freq: 261.63, amp: 0.22, decay: 2.5 },
        { freq: 349.23, amp: 0.16, decay: 2.1 },
        { freq: 518.0, amp: 0.12, decay: 1.6 },
        { freq: 784.0, amp: 0.07, decay: 1.1 },
      ];

      partials.forEach((p) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.freq, now);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0005, now);
        g.gain.linearRampToValueAtTime(p.amp, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0004, now + p.decay);

        osc.connect(g);
        if (this.radioPanner) {
          g.connect(this.radioPanner);
        } else {
          g.connect(this.sfxGain);
        }

        osc.start(now);
        osc.stop(now + p.decay + 0.05);
      });
    } catch (e) {}
  }

  playClueCollect() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [392.0, 466.16, 587.33, 740.0];
      notes.forEach((freq, idx) => {
        const t = now + idx * 0.045;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 0.985, t);
        osc.frequency.linearRampToValueAtTime(freq, t + 0.42);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0005, t);
        g.gain.exponentialRampToValueAtTime(0.11, t + 0.36);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 0.52);

        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.55);
      });

      if (this._whiteNoiseBuffer) {
        const paperSrc = this.ctx.createBufferSource();
        paperSrc.buffer = this._whiteNoiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 3200;
        const pg = this.ctx.createGain();
        pg.gain.setValueAtTime(0.001, now);
        pg.gain.linearRampToValueAtTime(0.12, now + 0.025);
        pg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        paperSrc.connect(hp);
        hp.connect(pg);
        pg.connect(this.sfxGain);
        paperSrc.start(now, 0.5, 0.15);
      }
    } catch (e) {}
  }

  playJumpScareStinger(onSubtitle = null) {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const dur = 1.65;

      // 0. Trigger user-provided horror-jumpscare.mp3 at full visceral impact!
      this._playSfxSlice('horror_jumpscare', this.sfxGain, {
        offset: 0,
        duration: 0,
        gain: 1.0,
        playbackRate: 1.0,
      });

      // Layer violent floorboard lunge creak as Lisa lunges at the camera
      this._playSfxSlice('walking_floor_creak', this.sfxGain, {
        offset: 0,
        duration: 0.9,
        gain: 0.95,
        playbackRate: 1.12,
      });

      // 1. 40Hz Sub-Bass Chest Slam
      const subSlam = this.ctx.createOscillator();
      subSlam.type = 'sine';
      subSlam.frequency.setValueAtTime(92, now);
      subSlam.frequency.exponentialRampToValueAtTime(36, now + 0.18);
      subSlam.frequency.exponentialRampToValueAtTime(28, now + dur);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.88, now + 0.008);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      subSlam.connect(subGain);
      subGain.connect(this.sfxGain);
      subSlam.start(now);
      subSlam.stop(now + dur + 0.05);

      // 2. Dissonant Shrieking String / Formant Horror Cluster + High Metallic Screech
      const shriekFreqs = [587.33, 622.25, 830.61, 1174.66, 1661.22, 2489.02];
      const shaper = this._makeVintageRadioWaveShaper(42);
      const clusterGain = this.ctx.createGain();
      clusterGain.gain.setValueAtTime(0.001, now);
      clusterGain.gain.linearRampToValueAtTime(0.42, now + 0.015);
      clusterGain.gain.setValueAtTime(0.36, now + 0.45);
      clusterGain.gain.exponentialRampToValueAtTime(0.0008, now + dur);

      shaper.connect(clusterGain);
      clusterGain.connect(this.sfxGain);

      shriekFreqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        osc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(f * (0.97 + Math.random() * 0.06), now);
        osc.frequency.linearRampToValueAtTime(
          f * (idx % 2 === 0 ? 1.18 : 0.86),
          now + dur * 0.75
        );
        const oscG = this.ctx.createGain();
        oscG.gain.value = 0.18;
        osc.connect(oscG);
        oscG.connect(shaper);
        osc.start(now);
        osc.stop(now + dur + 0.04);
      });

      // 3. Female Vocal Scream Formant Sweeps + Static Tear
      if (this._whiteNoiseBuffer) {
        const screamNoise = this.ctx.createBufferSource();
        screamNoise.buffer = this._whiteNoiseBuffer;
        const formant = this.ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.setValueAtTime(2650, now);
        formant.frequency.exponentialRampToValueAtTime(1450, now + dur);
        formant.Q.value = 4.8;

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.52, now + 0.02);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);

        screamNoise.connect(formant);
        formant.connect(nGain);
        nGain.connect(this.sfxGain);
        screamNoise.start(now, 0, dur);
      }

      // 4. Layer Lisa's Ghostly Voice / Whisper right into the binaural channel
      this._playTtsClipSpatialOrFallback(
        'lisa_whisper_behind',
        this.binauralBreathPanner,
        1.45
      );
      if (typeof onSubtitle === 'function') {
        onSubtitle(TTS_ASSET_MANIFEST.lisa_whisper_behind.subtitle, 3.2);
      }
    } catch (e) {}
  }

  playRadioStaticBurst(intensity = 0.7, duration = 0.3) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    if (!this._whiteNoiseBuffer) return;

    try {
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this._whiteNoiseBuffer;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.28 * intensity, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + duration);

      const whistle = this.ctx.createOscillator();
      whistle.type = 'sine';
      whistle.frequency.setValueAtTime(1950, now);
      whistle.frequency.exponentialRampToValueAtTime(920, now + duration);
      const wGain = this.ctx.createGain();
      wGain.gain.setValueAtTime(0.05 * intensity, now);
      wGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

      const out = this.radioFilterIn || this.radioPanner || this.sfxGain;
      src.connect(g);
      g.connect(out);
      whistle.connect(wGain);
      wGain.connect(out);

      src.start(now, Math.random() * 2.0, duration + 0.02);
      whistle.start(now);
      whistle.stop(now + duration + 0.02);
    } catch (e) {}
  }

  playPhoneRing() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const dur = 0.85;

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;

      const ringerMod = this.ctx.createOscillator();
      ringerMod.type = 'square';
      ringerMod.frequency.value = 20;

      const modGain = this.ctx.createGain();
      modGain.gain.value = 0.16;
      ringerMod.connect(modGain.gain);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.26, now + 0.02);
      env.gain.setValueAtTime(0.24, now + dur - 0.05);
      env.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc1.connect(modGain);
      osc2.connect(modGain);
      modGain.connect(env);
      env.connect(this.phonePanner || this.sfxGain);

      osc1.start(now);
      osc2.start(now);
      ringerMod.start(now);
      osc1.stop(now + dur + 0.02);
      osc2.stop(now + dur + 0.02);
      ringerMod.stop(now + dur + 0.02);
    } catch (e) {}
  }

  playHeartbeat(intensity = 0.6) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      [0.0, 0.21].forEach((offset, idx) => {
        const t = now + offset;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? 58 : 48, t);
        osc.frequency.exponentialRampToValueAtTime(28, t + 0.14);

        const g = this.ctx.createGain();
        const peak = (idx === 0 ? 0.28 : 0.2) * intensity;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);

        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.17);
      });
    } catch (e) {}
  }

  playUIClick() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.025);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Frame Update Loop:
  // - Syncs Web Audio AudioListener to Three.js Camera
  // - Updates Binaural Ghost Breathing Panner 0.28m behind & ±0.12m left/right of player's neck
  // - Autonomous 3D HRTF Creaking Floorboards Director (every 2.6-4.5s in the dark around you)
  // - Autonomous 3D Binaural Breathing Director (horror-character-breathing.mp3 every 4.5-6.8s)
  // - Drives Bathroom Sink Fetus Whimpers, Swinging Chain Creaks, and Blood Drips
  // --------------------------------------------------------------------------
  _extractCameraTransform(camera) {
    if (!camera) return;

    if (camera.position) {
      this._playerPos.x = Number(camera.position.x) || 0;
      this._playerPos.y = Number(camera.position.y) || 1.62;
      this._playerPos.z = Number(camera.position.z) || 0;
    }

    if (
      (camera.matrixWorld && Array.isArray(camera.matrixWorld.elements)) ||
      camera.matrixWorld?.elements
    ) {
      const e = camera.matrixWorld.elements;
      const rx = e[0],
        ry = e[1],
        rz = e[2];
      const ux = e[4],
        uy = e[5],
        uz = e[6];
      const bx = e[8],
        by = e[9],
        bz = e[10];

      const fLen = Math.hypot(bx, by, bz) || 1;
      this._playerForward.x = -bx / fLen;
      this._playerForward.y = -by / fLen;
      this._playerForward.z = -bz / fLen;

      const uLen = Math.hypot(ux, uy, uz) || 1;
      this._playerUp.x = ux / uLen;
      this._playerUp.y = uy / uLen;
      this._playerUp.z = uz / uLen;

      const rLen = Math.hypot(rx, ry, rz) || 1;
      this._playerRight.x = rx / rLen;
      this._playerRight.y = ry / rLen;
      this._playerRight.z = rz / rLen;
    } else if (camera.rotation) {
      const yaw = Number(camera.rotation.y) || 0;
      this._playerForward.x = -Math.sin(yaw);
      this._playerForward.y = 0;
      this._playerForward.z = -Math.cos(yaw);
      this._playerRight.x = Math.cos(yaw);
      this._playerRight.y = 0;
      this._playerRight.z = -Math.sin(yaw);
      this._playerUp.x = 0;
      this._playerUp.y = 1;
      this._playerUp.z = 0;
    }
  }

  _syncAudioListenerAndNeckPanner(elapsed = 0) {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    const now = this.ctx.currentTime;
    const { x, y, z } = this._playerPos;
    const fx = this._playerForward.x,
      fy = this._playerForward.y,
      fz = this._playerForward.z;
    const ux = this._playerUp.x,
      uy = this._playerUp.y,
      uz = this._playerUp.z;
    const rx = this._playerRight.x,
      ry = this._playerRight.y,
      rz = this._playerRight.z;

    if (listener) {
      if (listener.positionX) {
        listener.positionX.setTargetAtTime(x, now, 0.015);
        listener.positionY.setTargetAtTime(y, now, 0.015);
        listener.positionZ.setTargetAtTime(z, now, 0.015);
        listener.forwardX.setTargetAtTime(fx, now, 0.015);
        listener.forwardY.setTargetAtTime(fy, now, 0.015);
        listener.forwardZ.setTargetAtTime(fz, now, 0.015);
        listener.upX.setTargetAtTime(ux, now, 0.015);
        listener.upY.setTargetAtTime(uy, now, 0.015);
        listener.upZ.setTargetAtTime(uz, now, 0.015);
      } else if (typeof listener.setPosition === 'function') {
        listener.setPosition(x, y, z);
        if (typeof listener.setOrientation === 'function') {
          listener.setOrientation(fx, fy, fz, ux, uy, uz);
        }
      }
    }

    // Position binauralBreathPanner 0.28m directly behind the player's neck
    // and oscillating ±0.12m left/right so it creeps between the listener's ears!
    if (this.binauralBreathPanner) {
      const lateralSway = 0.12 * Math.sin(elapsed * 0.55);
      const bx = x - fx * 0.28 + rx * lateralSway;
      const by = y - 0.04;
      const bz = z - fz * 0.28 + rz * lateralSway;
      this._setPannerPosition(this.binauralBreathPanner, bx, by, bz);
    }
  }

  update(dt = 0.016, elapsed = 0, camera = null, loopNumber = null) {
    const safeDt = Math.min(Math.max(Number(dt) || 0.016, 0.001), 0.1);

    if (loopNumber !== null && loopNumber !== undefined) {
      const parsedLoop = Number(loopNumber) || 1;
      if (parsedLoop !== this.currentLoop) {
        this.setLoopMood(parsedLoop);
      }
    }

    if (camera) {
      this._extractCameraTransform(camera);
    }

    // Never create AudioContext inside update() before a user gesture
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    if (this.ctx.state !== 'running') return;

    // Ensure Web Audio ambient music loop is active once buffer is decoded
    if (this.musicAudioBuffer && !this.musicBufferSource) {
      this._startWebAudioAmbientMusicLoop();
    }

    this._syncAudioListenerAndNeckPanner(elapsed);

    // 1. Autonomous 3D HRTF Floorboard Creaking Director (every 2.6 - 4.5s)
    // Makes the dark hallway feel alive with unseen weight shifting on the floorboards near you!
    this._ghostCreakTimer -= safeDt;
    if (this._ghostCreakTimer <= 0) {
      this.playAutonomousFloorCreak();
      this._ghostCreakTimer = 2.6 + Math.random() * 1.9;
    }

    // 2. Binaural Ghost Breathing Behind the Player's Neck (0.28m behind neck)
    this._breathTimer -= safeDt;
    if (this._breathTimer <= 0) {
      const isInhale = this._breathPhase === 0;
      this._playBinauralBreathCycle(isInhale);
      this._breathPhase = isInhale ? 1 : 0;
      const rateScale =
        this.currentLoop === 4 || this.currentLoop === 3 ? 0.72 : 1.0;
      this._breathTimer = (isInhale ? 1.05 : 1.55) * rateScale;
    }

    // Dedicated full-presence horror-character-breathing.mp3 phrases every 4.5 - 6.8s
    this._deepBreathSampleTimer -= safeDt;
    if (this._deepBreathSampleTimer <= 0) {
      const breathBuf = this.sfxAudioBuffers.get('character_breathing');
      const maxOff = breathBuf ? Math.max(0, breathBuf.duration - 2.4) : 1.5;
      this._playSfxSlice('character_breathing', this.binauralBreathPanner, {
        offset: Math.random() * maxOff,
        duration: 2.2,
        gain: 0.85,
        playbackRate: 0.92 + Math.random() * 0.12,
      });
      this._deepBreathSampleTimer = 4.5 + Math.random() * 2.3;
    }

    // 3. Bathroom Sink Fetus Whimper & Dripping Faucet Impulses
    this._fetusCryTimer -= safeDt;
    if (this._fetusCryTimer <= 0) {
      this.playBathroomFetusCry();
      this._fetusCryTimer =
        this.currentLoop >= 2
          ? 3.2 + Math.random() * 2.8
          : 5.5 + Math.random() * 3.5;
    }

    this._waterDripTimer -= safeDt;
    if (this._waterDripTimer <= 0) {
      this._playWaterDripImpulse(this.bathroomSinkPanner, 1380, 0.12);
      this._waterDripTimer = 0.75 + Math.random() * 0.65;
    }

    // 4. Swinging Ceiling Lamp & Loop 3 Refrigerator Chain Creak (synced to pendulum phase)
    const swingFreq = this.currentLoop === 3 ? 2.15 : 1.15;
    const swingPhase = Math.sin(elapsed * swingFreq);
    const currentSign = swingPhase >= 0 ? 1 : -1;
    if (currentSign !== this._chainCreakLastSign && this._chainCreakLastSign !== 0) {
      this._playChainCreakImpulse(this.currentLoop === 3);
    }
    this._chainCreakLastSign = currentSign;

    // 5. Loop 3 Red Hell: Rapid Wet Blood Drip Plops beneath the Hanging Refrigerator
    if (this.currentLoop === 3) {
      this._bloodDripTimer -= safeDt;
      if (this._bloodDripTimer <= 0) {
        this._playWaterDripImpulse(this.bloodDripPanner, 920, 0.17);
        this._bloodDripTimer = 0.22 + Math.random() * 0.28;
      }
    }

    // 6. Periodic Radio Broadcasts when near the Corner Radio or during Loops 2/3/4
    this._autoRadioTimer -= safeDt;
    if (this._autoRadioTimer <= 0) {
      const distToRadio = Math.hypot(
        this._playerPos.x - EMITTER_COORDS.radio.x,
        this._playerPos.z - EMITTER_COORDS.radio.z
      );
      if (distToRadio < 6.5 || this.currentLoop >= 2) {
        const clip =
          this.currentLoop === 3
            ? 'radio_numbers_204863'
            : Math.random() < 0.55
              ? 'radio_broadcast_01'
              : 'radio_numbers_204863';
        this.triggerRadioBroadcast(clip, this.onSubtitle);
        this._autoRadioTimer = 18.0 + Math.random() * 10.0;
      } else {
        this.playRadioStaticBurst(0.45, 0.22);
        this._autoRadioTimer = 7.5 + Math.random() * 5.0;
      }
    }

    // 7. High-Tension Heartbeat Pulse (Loop 3 & Loop 4)
    if (this.tensionLevel > 0.65 || this.currentLoop === 3 || this.currentLoop === 4) {
      this._heartbeatTimer -= safeDt;
      if (this._heartbeatTimer <= 0) {
        this.playHeartbeat(0.45 + this.tensionLevel * 0.35);
        this._heartbeatTimer = 0.72;
      }
    }
  }
}

export default PTSoundscapeEngine;
