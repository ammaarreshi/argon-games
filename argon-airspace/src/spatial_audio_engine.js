/**
 * Argon Airspace (1950s Air Traffic Edition)
 * Module 5: Spatial 2D Web Audio Engine, Lyria 3 Lounge Jazz Cross-Fader & Wendy/ATC Voice Manager
 *
 * Capabilities:
 * 1. Pre-Generated Lyria 3 Lounge Jazz Music Manager (`./assets/audio/music/`):
 *    - `main_menu_bossa.mp3` (Main Menu / Briefing Bossa Nova)
 *    - `inflight_lounge_relaxed.mp3` (Relaxed 1950s In-Flight Lounge Jazz for normal traffic)
 *    - `inflight_bigband_swing.mp3` (Uptempo Big-Band Swing for high-density airspace / rush waves)
 *    - `victory_stinger.mp3` (Celebratory High-Score / Milestone Brass Stinger)
 *    - Smooth Web Audio `GainNode` cross-fading (`crossfadeDuration = 1.8s`) between
 *      `inflight_lounge_relaxed` and `inflight_bigband_swing` when `setHighDensityMode(isHighDensity)` changes.
 *    - Auto-unlocks `AudioContext` on first pointer/key interaction (`musicGain = 0.34`, ducking to `0.18`
 *      during Wendy or ATC voice callouts).
 *
 * 2. Stewardess Wendy & Crackly ATC Radio Voice Manager (`./assets/audio/voice/`):
 *    - Registry for Wendy (`wendy_welcome`, `wendy_seatbelts`, `wendy_beverage`, `wendy_look_out`,
 *      `wendy_personal_best`), ATC (`atc_cleared_29`, `atc_helipad_clear`, `atc_go_around`), and
 *      Aussie Praise (`praise_you_bewdy`, `praise_onya_mate`, `praise_no_worries`, `praise_fair_dinkum`,
 *      `praise_ripper`).
 *    - Strict anti-spam & priority cooldown guardrails (`minVoiceIntervalMs = 5500` ms for regular lines,
 *      `3200` ms preemption for urgent `wendy_look_out` / `atc_go_around`, zero overlapping voices).
 *    - Ducks background music by ~45% (`0.34 -> 0.18`) while speaking and fires
 *      `onVoiceSubtitle(speaker, text, hostessKey, clipId)` for the HUD vintage callout toast.
 *
 * 3. Spatial 2D Airspace Sound Effects (`pan = clamp(worldX / 480, -0.85, 0.85)`):
 *    - Touchdown Brass Bell (`playLandingBell(worldX, landedCount)`)
 *    - Stage 1 Proximity Hazard Klaxon (`updateProximityAlarm(activeConflicts, dt)`)
 *    - Runway Approach Lock Chime (`playRunwayLock(worldX, runway)`)
 *    - Spline Drawing Tactile Tick (`playPathDrawTick(worldX)`)
 *    - Mid-Air Collision Explosion & Rubber Stamp (`playCrashExplosion(worldX)`)
 */

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export const MUSIC_TRACK_REGISTRY = {
  main_menu_bossa: {
    id: 'main_menu_bossa',
    title: 'Argon Terminal Bossa Nova',
    urlMp3: './assets/audio/music/main_menu_bossa.mp3',
    urlOgg: './assets/audio/music/main_menu_bossa.ogg',
    loop: true,
  },
  inflight_lounge_relaxed: {
    id: 'inflight_lounge_relaxed',
    title: 'Skyline Lounge Vibraphone Jazz',
    urlMp3: './assets/audio/music/inflight_lounge_relaxed.mp3',
    urlOgg: './assets/audio/music/inflight_lounge_relaxed.ogg',
    loop: true,
  },
  inflight_bigband_swing: {
    id: 'inflight_bigband_swing',
    title: 'Control Tower Rush Hour Big-Band Swing',
    urlMp3: './assets/audio/music/inflight_bigband_swing.mp3',
    urlOgg: './assets/audio/music/inflight_bigband_swing.ogg',
    loop: true,
  },
  victory_stinger: {
    id: 'victory_stinger',
    title: 'Golden Wings Brass Fanfare',
    urlMp3: './assets/audio/music/victory_stinger.mp3',
    urlOgg: './assets/audio/music/victory_stinger.ogg',
    loop: false,
  },
};

export const VOICE_CLIP_REGISTRY = {
  // Stewardess Wendy (1950s Argon Airways Cabin PA)
  wendy_welcome: {
    id: 'wendy_welcome',
    category: 'wendy',
    speaker: 'WENDY • CHIEF STEWARDESS',
    text: 'Welcome aboard, guest! Clear skies ahead at the airfield.',
    hostessKey: 'hostess_wendy',
    priority: 2,
    durationEstSec: 3.4,
    urlMp3: './assets/audio/voice/wendy_welcome.mp3',
    urlOgg: './assets/audio/voice/wendy_welcome.ogg',
    urlWav: './assets/audio/voice/wendy_welcome.wav',
  },
  wendy_seatbelts: {
    id: 'wendy_seatbelts',
    category: 'wendy',
    speaker: 'WENDY • CABIN PA',
    text: 'Fasten your seatbelts, things are getting busy in the pattern!',
    hostessKey: 'hostess_wendy',
    priority: 2,
    durationEstSec: 3.5,
    urlMp3: './assets/audio/voice/wendy_seatbelts.mp3',
    urlOgg: './assets/audio/voice/wendy_seatbelts.ogg',
    urlWav: './assets/audio/voice/wendy_seatbelts.wav',
  },
  wendy_beverage: {
    id: 'wendy_beverage',
    category: 'wendy',
    speaker: 'WENDY • IN-FLIGHT SERVICE',
    text: 'Please enjoy this refreshing beverage while you guide our flights!',
    hostessKey: 'hostess_wendy',
    priority: 1,
    durationEstSec: 3.6,
    urlMp3: './assets/audio/voice/wendy_beverage.mp3',
    urlOgg: './assets/audio/voice/wendy_beverage.ogg',
    urlWav: './assets/audio/voice/wendy_beverage.wav',
  },
  wendy_look_out: {
    id: 'wendy_look_out',
    category: 'wendy_urgent',
    speaker: 'WENDY • PROXIMITY ALERT',
    text: 'Crikey, look out! Keep those aircraft separated!',
    hostessKey: 'hostess_nurse',
    priority: 3,
    urgent: true,
    durationEstSec: 3.0,
    urlMp3: './assets/audio/voice/wendy_look_out.mp3',
    urlOgg: './assets/audio/voice/wendy_look_out.ogg',
    urlWav: './assets/audio/voice/wendy_look_out.wav',
  },
  wendy_personal_best: {
    id: 'wendy_personal_best',
    category: 'wendy_milestone',
    speaker: 'WENDY • FLIGHT RECORD',
    text: 'New personal best, congratulations Captain!',
    hostessKey: 'hostess_wendy',
    priority: 3,
    milestone: true,
    durationEstSec: 3.2,
    urlMp3: './assets/audio/voice/wendy_personal_best.mp3',
    urlOgg: './assets/audio/voice/wendy_personal_best.ogg',
    urlWav: './assets/audio/voice/wendy_personal_best.wav',
  },

  // Crackly VHF ATC Radio Transmissions
  atc_cleared_29: {
    id: 'atc_cleared_29',
    category: 'atc',
    speaker: 'CAPT. HANK • CLIPPER HEAVY',
    text: 'Tower, Clipper Heavy cleared to land, runway two-niner.',
    hostessKey: 'captain_jet',
    priority: 1,
    isRadio: true,
    durationEstSec: 3.2,
    urlMp3: './assets/audio/voice/atc_cleared_29.mp3',
    urlOgg: './assets/audio/voice/atc_cleared_29.ogg',
    urlWav: './assets/audio/voice/atc_cleared_29.wav',
  },
  atc_helipad_clear: {
    id: 'atc_helipad_clear',
    category: 'atc',
    speaker: 'CAPT. MAC • RESCUE CHOPPER',
    text: 'Rescue Chopper One, helipad is clear for approach.',
    hostessKey: 'captain_chopper',
    priority: 1,
    isRadio: true,
    durationEstSec: 3.0,
    urlMp3: './assets/audio/voice/atc_helipad_clear.mp3',
    urlOgg: './assets/audio/voice/atc_helipad_clear.ogg',
    urlWav: './assets/audio/voice/atc_helipad_clear.wav',
  },
  atc_go_around: {
    id: 'atc_go_around',
    category: 'atc_urgent',
    speaker: 'ATC TOWER • TRAFFIC ALERT',
    text: 'Go around! Traffic conflict on final approach!',
    hostessKey: 'hostess_nurse',
    priority: 3,
    urgent: true,
    isRadio: true,
    durationEstSec: 2.9,
    urlMp3: './assets/audio/voice/atc_go_around.mp3',
    urlOgg: './assets/audio/voice/atc_go_around.ogg',
    urlWav: './assets/audio/voice/atc_go_around.wav',
  },

  // Aussie Bush Pilot & Captain Praise Callouts
  praise_you_bewdy: {
    id: 'praise_you_bewdy',
    category: 'praise',
    speaker: 'CAPT. BRUCE • TOUCHDOWN',
    text: 'You bewdy!',
    matchTag: 'YOU BEWDY',
    hostessKey: 'captain_bush',
    priority: 1,
    durationEstSec: 1.6,
    urlMp3: './assets/audio/voice/praise_you_bewdy.mp3',
    urlOgg: './assets/audio/voice/praise_you_bewdy.ogg',
    urlWav: './assets/audio/voice/praise_you_bewdy.wav',
  },
  praise_onya_mate: {
    id: 'praise_onya_mate',
    category: 'praise',
    speaker: 'CAPT. BRUCE • TOUCHDOWN',
    text: 'Onya mate!',
    matchTag: 'ONYA MATE',
    hostessKey: 'captain_bush',
    priority: 1,
    durationEstSec: 1.6,
    urlMp3: './assets/audio/voice/praise_onya_mate.mp3',
    urlOgg: './assets/audio/voice/praise_onya_mate.ogg',
    urlWav: './assets/audio/voice/praise_onya_mate.wav',
  },
  praise_no_worries: {
    id: 'praise_no_worries',
    category: 'praise',
    speaker: 'CAPT. KAHALE • TOUCHDOWN',
    text: 'No worries!',
    matchTag: 'NO WORRIES',
    hostessKey: 'captain_seaplane',
    priority: 1,
    durationEstSec: 1.6,
    urlMp3: './assets/audio/voice/praise_no_worries.mp3',
    urlOgg: './assets/audio/voice/praise_no_worries.ogg',
    urlWav: './assets/audio/voice/praise_no_worries.wav',
  },
  praise_fair_dinkum: {
    id: 'praise_fair_dinkum',
    category: 'praise',
    speaker: 'CAPT. HANK • TOUCHDOWN',
    text: 'Fair dinkum!',
    matchTag: 'FAIR DINKUM',
    hostessKey: 'captain_jet',
    priority: 1,
    durationEstSec: 1.7,
    urlMp3: './assets/audio/voice/praise_fair_dinkum.mp3',
    urlOgg: './assets/audio/voice/praise_fair_dinkum.ogg',
    urlWav: './assets/audio/voice/praise_fair_dinkum.wav',
  },
  praise_ripper: {
    id: 'praise_ripper',
    category: 'praise',
    speaker: 'CAPT. MAC • TOUCHDOWN',
    text: 'Ripper landing!',
    matchTag: 'RIPPER',
    hostessKey: 'captain_chopper',
    priority: 1,
    durationEstSec: 1.8,
    urlMp3: './assets/audio/voice/praise_ripper.mp3',
    urlOgg: './assets/audio/voice/praise_ripper.ogg',
    urlWav: './assets/audio/voice/praise_ripper.wav',
  },
};

export const SFX_CLIP_REGISTRY = {
  bell_ding: {
    id: 'bell_ding',
    urlMp3: './assets/audio/sfx/bell_ding.mp3',
    urlOgg: './assets/audio/sfx/bell_ding.ogg',
    urlWav: './assets/audio/sfx/bell_ding.wav',
  },
  proximity_alarm: {
    id: 'proximity_alarm',
    urlMp3: './assets/audio/sfx/proximity_alarm.mp3',
    urlOgg: './assets/audio/sfx/proximity_alarm.ogg',
    urlWav: './assets/audio/sfx/proximity_alarm.wav',
  },
  crash_explosion: {
    id: 'crash_explosion',
    urlMp3: './assets/audio/sfx/crash_explosion.mp3',
    urlOgg: './assets/audio/sfx/crash_explosion.ogg',
    urlWav: './assets/audio/sfx/crash_explosion.wav',
  },
  path_draw_tick: {
    id: 'path_draw_tick',
    urlMp3: './assets/audio/sfx/path_draw_tick.mp3',
    urlOgg: './assets/audio/sfx/path_draw_tick.ogg',
    urlWav: './assets/audio/sfx/path_draw_tick.wav',
  },
  route_lock: {
    id: 'route_lock',
    urlMp3: './assets/audio/sfx/route_lock.mp3',
    urlOgg: './assets/audio/sfx/route_lock.ogg',
    urlWav: './assets/audio/sfx/route_lock.wav',
  },
  stamp_thud: {
    id: 'stamp_thud',
    urlMp3: './assets/audio/sfx/stamp_thud.mp3',
    urlOgg: './assets/audio/sfx/stamp_thud.ogg',
    urlWav: './assets/audio/sfx/stamp_thud.wav',
  },
};

const PRAISE_CLIP_KEYS = [
  'praise_you_bewdy',
  'praise_onya_mate',
  'praise_no_worries',
  'praise_fair_dinkum',
  'praise_ripper',
];

export class FlightAudioEngine {
  constructor(options = {}) {
    this.options = options || {};
    this.ctx = null;
    this.isUnlocked = false;
    this.isMuted = Boolean(options.muted);

    // Mix levels & cross-fade timings mandated by architecture spec
    this.baseMusicGain = typeof options.musicGain === 'number' ? options.musicGain : 0.34;
    this.duckedMusicGain = typeof options.duckedMusicGain === 'number' ? options.duckedMusicGain : 0.18;
    this.crossfadeDuration = typeof options.crossfadeDuration === 'number' ? options.crossfadeDuration : 1.8;

    // Voice cooldown guardrails
    this.minVoiceIntervalMs = typeof options.minVoiceIntervalMs === 'number' ? options.minVoiceIntervalMs : 5500;
    this.urgentVoiceIntervalMs =
      typeof options.urgentVoiceIntervalMs === 'number' ? options.urgentVoiceIntervalMs : 3200;

    // Subtitle / HUD Toast callback
    this.onVoiceSubtitle =
      options.onVoiceSubtitle ||
      (options.callbacks && options.callbacks.onVoiceSubtitle) ||
      null;

    // Active map hostess portrait key (defaults to Wendy)
    this.activeHostessKey = options.hostessKey || 'hostess_wendy';
    this.activeMapId = options.mapId || 'classic_outback';

    // Web Audio Bus Graph
    this.compressor = null;
    this.masterGain = null;
    this.musicBusGain = null;
    this.voiceBusGain = null;
    this.sfxBusGain = null;

    // Individual Music Track Gain Nodes & Sources for seamless 1.8s cross-fading
    this.musicNodes = {
      main_menu_bossa: { gainNode: null, source: null, playing: false },
      inflight_lounge_relaxed: { gainNode: null, source: null, playing: false },
      inflight_bigband_swing: { gainNode: null, source: null, playing: false },
    };
    this.musicMode = 'inflight'; // 'menu' | 'inflight' | 'stopped'
    this.isHighDensity = false;
    this.isFastForward = false;
    this.hasStartedMusic = false;

    // Decoded AudioBuffer caches & loading flags
    this.musicBuffers = new Map();
    this.voiceBuffers = new Map();
    this.sfxBuffers = new Map();
    this.loadingPromises = new Map();
    this.assetsPreloadStarted = false;

    // Procedural Noise Buffers (White, Pink, Brown)
    this.whiteNoiseBuffer = null;
    this.pinkNoiseBuffer = null;
    this.brownNoiseBuffer = null;

    // Procedural Lounge Jazz fallback state (plays gently only before MP3 buffers finish decoding)
    this._procJazzTimer = 0;
    this._procJazzStep = 0;

    // Voice playback & anti-spam tracking
    this.isVoicePlaying = false;
    this.activeVoicePriority = 0;
    this.activeVoiceClipId = null;
    this.activeVoiceSource = null;
    this.activeVoiceAudioEl = null;
    this.voiceEndTimer = null;
    this.lastVoiceTriggerMs = -99999;
    this.lastUrgentVoiceMs = -99999;
    this.lastPraiseIndex = -1;
    this.urgentAlternator = 0;
    this.personalBestAnnouncedThisRound = false;

    // Proximity Hazard Klaxon state
    this.proximityPulseTimer = 0;
    this.proximityPhaseToggle = 0;
    this.inConflictEpisode = false;
    this.conflictClearTimer = 0;

    // Spline path drawing tactile tick rate-limiter
    this.lastPathTickMs = 0;
    this.lastSelectBeepMs = 0;
    this.lastRunwayLockVoiceMs = -99999;
    this.crashStampTimeout = null;

    this._bindAutoUnlockListeners();
  }

  /**
   * Registers or updates the HUD subtitle toast callback:
   * `fn(speaker, text, hostessKey, clipId)`
   */
  setVoiceSubtitleCallback(fn) {
    this.onVoiceSubtitle = fn;
  }

  /**
   * Updates the active map and default hostess portrait key used for voice callout toasts.
   */
  setMapTheme(mapId, hostessKey) {
    if (mapId) this.activeMapId = mapId;
    if (hostessKey) {
      this.activeHostessKey = hostessKey;
    } else if (mapId === 'tropical_island') {
      this.activeHostessKey = 'hostess_hawaii';
    } else if (mapId === 'alpine_winter') {
      this.activeHostessKey = 'hostess_alpine';
    } else {
      this.activeHostessKey = 'hostess_wendy';
    }
  }

  setHostessKey(hostessKey) {
    if (hostessKey) this.activeHostessKey = hostessKey;
  }

  /**
   * Computes stereo pan value in `[-0.85, +0.85]` from orthographic `worldX` in `[-480, +480]`.
   */
  computePan(worldX = 0) {
    const x = Number.isFinite(worldX) ? worldX : 0;
    return clamp(x / 480, -0.85, 0.85);
  }

  /**
   * Attaches one-time capture listeners on `window` / `document` so the first pointer or key
   * interaction unlocks the Web Audio `AudioContext` and starts the lounge jazz music.
   */
  _bindAutoUnlockListeners() {
    if (typeof window === 'undefined') return;
    this._unlockHandler = () => {
      this.unlock();
    };
    const events = ['pointerdown', 'mousedown', 'touchstart', 'keydown'];
    for (const evt of events) {
      window.addEventListener(evt, this._unlockHandler, { capture: true, passive: true });
    }
  }

  _removeAutoUnlockListeners() {
    if (typeof window === 'undefined' || !this._unlockHandler) return;
    const events = ['pointerdown', 'mousedown', 'touchstart', 'keydown'];
    for (const evt of events) {
      window.removeEventListener(evt, this._unlockHandler, { capture: true });
    }
  }

  /**
   * Initializes the Web Audio API graph, procedural noise buffers, and static asset decoding.
   */
  ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      this.ctx = new AudioCtx();
    } catch (_e) {
      return null;
    }

    const now = this.ctx.currentTime;

    // Master dynamics compressor for cohesive broadcast lounge glue
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-14, now);
    this.compressor.knee.setValueAtTime(18, now);
    this.compressor.ratio.setValueAtTime(3.5, now);
    this.compressor.attack.setValueAtTime(0.004, now);
    this.compressor.release.setValueAtTime(0.18, now);

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0001 : 1.0, now);

    // Sub-buses: Music (0.34, ducks to 0.18), Voice (0.96), SFX (0.88)
    this.musicBusGain = this.ctx.createGain();
    this.musicBusGain.gain.setValueAtTime(this.baseMusicGain, now);

    this.voiceBusGain = this.ctx.createGain();
    this.voiceBusGain.gain.setValueAtTime(0.96, now);

    this.sfxBusGain = this.ctx.createGain();
    this.sfxBusGain.gain.setValueAtTime(0.88, now);

    this.musicBusGain.connect(this.compressor);
    this.voiceBusGain.connect(this.compressor);
    this.sfxBusGain.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Individual Music Track GainNodes for smooth 1.8s cross-fading
    for (const trackId of Object.keys(this.musicNodes)) {
      const g = this.ctx.createGain();
      let initialGain = 0.0001;
      if (this.musicMode === 'menu' && trackId === 'main_menu_bossa') {
        initialGain = 1.0;
      } else if (this.musicMode === 'inflight') {
        if (!this.isHighDensity && trackId === 'inflight_lounge_relaxed') initialGain = 1.0;
        if (this.isHighDensity && trackId === 'inflight_bigband_swing') initialGain = 1.0;
      }
      g.gain.setValueAtTime(initialGain, now);
      g.connect(this.musicBusGain);
      this.musicNodes[trackId].gainNode = g;
    }

    this._buildProceduralNoiseBuffers();
    this.preloadAllAssets();

    return this.ctx;
  }

  /**
   * Unlocks `AudioContext` on user gesture and starts the background music mix.
   */
  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        this.isUnlocked = true;
        if (!this.hasStartedMusic && this.musicMode !== 'stopped') {
          this.startMusic(this.musicMode);
        }
      }).catch(() => {});
    } else {
      this.isUnlocked = true;
    }

    if (!this.hasStartedMusic && this.musicMode !== 'stopped') {
      this.startMusic(this.musicMode);
    }

    if (ctx.state === 'running') {
      this._removeAutoUnlockListeners();
    }
  }

  init() {
    this.ensureContext();
    return this;
  }

  resume() {
    this.unlock();
  }

  /**
   * Creates a stereo routing node panned to `worldX` (`pan = clamp(worldX / 480, -0.85, 0.85)`).
   */
  _createSpatialOut(worldX = 0, targetBus = null) {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    const bus = targetBus || this.sfxBusGain || ctx.destination;
    const pan = this.computePan(worldX);

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, ctx.currentTime);
      panner.connect(bus);
      return panner;
    }
    return bus;
  }

  /**
   * Builds 2-second White, Pink, and Brownian noise `AudioBuffer`s for physical SFX synthesis.
   */
  _buildProceduralNoiseBuffers() {
    if (!this.ctx || this.whiteNoiseBuffer) return;
    const sr = this.ctx.sampleRate;
    const length = sr * 2;

    this.whiteNoiseBuffer = this.ctx.createBuffer(1, length, sr);
    this.pinkNoiseBuffer = this.ctx.createBuffer(1, length, sr);
    this.brownNoiseBuffer = this.ctx.createBuffer(1, length, sr);

    const white = this.whiteNoiseBuffer.getChannelData(0);
    const pink = this.pinkNoiseBuffer.getChannelData(0);
    const brown = this.brownNoiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let lastBrown = 0;

    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      white[i] = w;

      // Paul Kellet's pink noise filter
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      pink[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;

      // Brownian / red noise integration for deep concussive explosions
      lastBrown = (lastBrown + 0.02 * w) / 1.02;
      brown[i] = clamp(lastBrown * 3.5, -1, 1);
    }
  }

  // ===========================================================================
  // STATIC AUDIO DECODING & `window.__FC_INLINE_AUDIO__` SUPPORT
  // ===========================================================================

  /**
   * Resolves a static audio file into an `ArrayBuffer`, checking `window.__FC_INLINE_AUDIO__`
   * base64 data-URIs first (for zero-CORS `static web` hosting) before falling back to `fetch()`.
   */
  async _fetchAudioArrayBuffer(candidates) {
    const inlineMap =
      typeof window !== 'undefined' && window.__FC_INLINE_AUDIO__
        ? window.__FC_INLINE_AUDIO__
        : null;

    if (inlineMap) {
      for (const candidate of candidates) {
        if (!candidate) continue;
        const dataUri = inlineMap[candidate];
        if (typeof dataUri === 'string' && dataUri.startsWith('data:')) {
          const commaIdx = dataUri.indexOf(',');
          if (commaIdx !== -1) {
            try {
              const b64 = dataUri.slice(commaIdx + 1);
              const binStr = atob(b64);
              const len = binStr.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binStr.charCodeAt(i);
              }
              return bytes.buffer;
            } catch (_err) {
              // Fall through to fetch if base64 parse fails
            }
          }
        }
      }
    }

    if (typeof fetch !== 'function') return null;

    for (const url of candidates) {
      if (!url || !url.includes('/')) continue;
      try {
        const resp = await fetch(url);
        if (resp && resp.ok) {
          const buf = await resp.arrayBuffer();
          if (buf && buf.byteLength > 256) {
            return buf;
          }
        }
      } catch (_err) {
        // Try next candidate extension (.mp3 -> .ogg -> .wav)
      }
    }
    return null;
  }

  async _loadAndDecodeClip(cacheMap, id, candidates) {
    if (cacheMap.has(id)) return cacheMap.get(id);
    const cacheKey = `${id}`;
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    const promise = (async () => {
      const ctx = this.ensureContext();
      if (!ctx) return null;
      const rawBuf = await this._fetchAudioArrayBuffer(candidates);
      if (!rawBuf) return null;
      try {
        const audioBuf = await ctx.decodeAudioData(rawBuf.slice(0));
        if (audioBuf) {
          cacheMap.set(id, audioBuf);
          return audioBuf;
        }
      } catch (_err) {
        return null;
      }
      return null;
    })();

    this.loadingPromises.set(cacheKey, promise);
    const res = await promise;
    this.loadingPromises.delete(cacheKey);
    return res;
  }

  /**
   * Preloads and decodes all static music tracks, Wendy/ATC voice clips, and SFX files.
   */
  preloadAllAssets() {
    if (this.assetsPreloadStarted) return;
    this.assetsPreloadStarted = true;

    // 1. Preload Music Tracks
    for (const track of Object.values(MUSIC_TRACK_REGISTRY)) {
      this._loadAndDecodeClip(this.musicBuffers, track.id, [
        track.id,
        track.urlMp3,
        track.urlOgg,
      ]).then((buf) => {
        if (buf && this.musicNodes[track.id] && this.musicMode !== 'stopped') {
          this._ensureLoopingTrackSource(track.id);
        }
      });
    }

    // 2. Preload SFX Clips
    for (const sfx of Object.values(SFX_CLIP_REGISTRY)) {
      this._loadAndDecodeClip(this.sfxBuffers, sfx.id, [
        sfx.id,
        sfx.urlMp3,
        sfx.urlOgg,
        sfx.urlWav,
      ]);
    }

    // 3. Preload Wendy, ATC & Aussie Praise Voice Clips
    for (const clip of Object.values(VOICE_CLIP_REGISTRY)) {
      this._loadAndDecodeClip(this.voiceBuffers, clip.id, [
        clip.id,
        clip.urlMp3,
        clip.urlOgg,
        clip.urlWav,
      ]);
    }
  }

  // ===========================================================================
  // 1. LYRIA 3 LOUNGE JAZZ MUSIC MANAGER & 1.8s DYNAMIC CROSS-FADING
  // ===========================================================================

  /**
   * Starts or switches the background music mode (`'inflight'` or `'menu'`).
   */
  startMusic(mode = 'inflight') {
    this.musicMode = mode === 'menu' ? 'menu' : 'inflight';
    this.hasStartedMusic = true;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this._ensureLoopingTrackSource('main_menu_bossa');
    this._ensureLoopingTrackSource('inflight_lounge_relaxed');
    this._ensureLoopingTrackSource('inflight_bigband_swing');

    this._applyMusicTrackCrossfade(1.0);
  }

  playInflightMusic() {
    this.startMusic('inflight');
  }

  playMenuMusic() {
    this.startMusic('menu');
  }

  stopMusic() {
    this.musicMode = 'stopped';
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const nodeEntry of Object.values(this.musicNodes)) {
      if (nodeEntry.gainNode) {
        nodeEntry.gainNode.gain.cancelScheduledValues(now);
        nodeEntry.gainNode.gain.setValueAtTime(nodeEntry.gainNode.gain.value, now);
        nodeEntry.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.35);
      }
    }
  }

  /**
   * Ensures a looping `AudioBufferSourceNode` is running for the given music track ID.
   */
  _ensureLoopingTrackSource(trackId) {
    if (!this.ctx) return;
    const entry = this.musicNodes[trackId];
    const buf = this.musicBuffers.get(trackId);
    if (!entry || !entry.gainNode || !buf || entry.playing) return;

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.setValueAtTime(this.isFastForward ? 1.07 : 1.0, this.ctx.currentTime);
      src.connect(entry.gainNode);
      src.start(0);
      entry.source = src;
      entry.playing = true;
      src.onended = () => {
        entry.playing = false;
        entry.source = null;
      };
    } catch (_err) {
      // Ignore if context is closing
    }
  }

  /**
   * Smoothly cross-fades (`crossfadeDuration = 1.8s`) between `inflight_lounge_relaxed`
   * and `inflight_bigband_swing` when `setHighDensityMode(isHighDensity)` changes!
   */
  setHighDensityMode(isHighDensity, triggerCallout = true) {
    const nextState = Boolean(isHighDensity);
    if (this.isHighDensity === nextState) return;
    const wasRelaxed = !this.isHighDensity;
    this.isHighDensity = nextState;

    this._applyMusicTrackCrossfade(this.crossfadeDuration);

    // When escalating into high-density traffic, let Wendy announce seatbelt sign if cooldown allows
    if (nextState && wasRelaxed && triggerCallout && !this.inConflictEpisode) {
      this.playVoice('wendy_seatbelts');
    }
  }

  _applyMusicTrackCrossfade(durationSec = 1.8) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = Math.max(0.08, durationSec);

    const targets = {
      main_menu_bossa: 0.0001,
      inflight_lounge_relaxed: 0.0001,
      inflight_bigband_swing: 0.0001,
    };

    if (this.musicMode === 'menu') {
      targets.main_menu_bossa = 1.0;
    } else if (this.musicMode === 'inflight') {
      if (this.isHighDensity) {
        targets.inflight_bigband_swing = 1.0;
      } else {
        targets.inflight_lounge_relaxed = 1.0;
      }
    }

    for (const [trackId, targetGain] of Object.entries(targets)) {
      const entry = this.musicNodes[trackId];
      if (entry && entry.gainNode) {
        const g = entry.gainNode.gain;
        const currentVal = Math.max(0.0001, g.value || 0.0001);
        g.cancelScheduledValues(now);
        g.setValueAtTime(currentVal, now);
        g.linearRampToValueAtTime(targetGain, now + dur);
      }
    }
  }

  /**
   * Ducks or restores the background music bus (`0.34` normal -> `0.18` when Wendy or ATC speaks).
   */
  _setMusicDucked(isDucked) {
    if (!this.ctx || !this.musicBusGain) return;
    const now = this.ctx.currentTime;
    const target = isDucked ? this.duckedMusicGain : this.baseMusicGain;
    const rampDur = isDucked ? 0.12 : 0.45;
    const g = this.musicBusGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value || this.baseMusicGain), now);
    g.linearRampToValueAtTime(target, now + rampDur);
  }

  /**
   * Plays `victory_stinger.mp3` (Celebratory High-Score / Milestone Brass Stinger)
   * layered with a warm 1950s vibraphone & brass triad glissando.
   */
  playVictoryStinger(worldX = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    this._setMusicDucked(true);
    setTimeout(() => {
      if (!this.isVoicePlaying) this._setMusicDucked(false);
    }, 2400);

    const out = this._createSpatialOut(worldX, this.sfxBusGain);
    const stingerBuf = this.musicBuffers.get('victory_stinger');
    if (stingerBuf) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = stingerBuf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.65, ctx.currentTime);
        src.connect(g);
        g.connect(out);
        src.start(0);
      } catch (_e) {
        // Fallback below still runs
      }
    } else {
      this._loadAndDecodeClip(this.musicBuffers, 'victory_stinger', [
        'victory_stinger',
        MUSIC_TRACK_REGISTRY.victory_stinger.urlMp3,
        MUSIC_TRACK_REGISTRY.victory_stinger.urlOgg,
      ]);
    }

    // Crisp 1950s Argon Airways Vibraphone & Brass Major-9th Fanfare Arpeggio (F5 - A5 - C6 - E6 - G6)
    const notes = [698.46, 880.0, 1046.5, 1318.51, 1567.98];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const t0 = now + idx * 0.075;
      const dur = idx === notes.length - 1 ? 0.85 : 0.36;
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq * 2, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.14, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(gain);
      sub.connect(gain);
      gain.connect(out);
      osc.start(t0);
      sub.start(t0);
      osc.stop(t0 + dur + 0.02);
      sub.stop(t0 + dur + 0.02);
    });
  }

  playMilestoneStinger(worldX = 0) {
    this.playVictoryStinger(worldX);
  }

  // ===========================================================================
  // 2. STEWARDESS WENDY & CRACKLY ATC RADIO VOICE MANAGER
  // ===========================================================================

  /**
   * Triggers a voice clip from `VOICE_CLIP_REGISTRY` while strictly enforcing:
   * - Zero overlapping voice lines
   * - Global cooldown (`5500ms` regular, `3200ms` urgent preemption, milestone support)
   * - 45% background music ducking (`0.34 -> 0.18`)
   * - `onVoiceSubtitle(speaker, text, hostessKey, clipId)` callback for HUD toast
   */
  playVoice(clipId, options = {}) {
    const clip = VOICE_CLIP_REGISTRY[clipId];
    if (!clip) return false;

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const force = Boolean(options.force);
    const isUrgent = Boolean(clip.urgent);
    const isMilestone = Boolean(clip.milestone);
    const priority = clip.priority || 1;

    // 1. Check overlap & cooldown guardrails
    if (this.isVoicePlaying && !force) {
      if (isUrgent || isMilestone) {
        const elapsedSinceStart = nowMs - this.lastVoiceTriggerMs;
        if (
          this.activeVoicePriority >= priority ||
          elapsedSinceStart < this.urgentVoiceIntervalMs
        ) {
          return false;
        }
        // Preempt lower-priority voice cleanly so two voices NEVER overlap
        this._stopActiveVoicePlayback();
      } else {
        return false;
      }
    } else if (!force) {
      const elapsed = nowMs - this.lastVoiceTriggerMs;
      if (isUrgent) {
        if (
          elapsed < this.urgentVoiceIntervalMs ||
          nowMs - this.lastUrgentVoiceMs < this.urgentVoiceIntervalMs
        ) {
          return false;
        }
      } else if (isMilestone) {
        if (elapsed < 2200) return false;
      } else if (elapsed < this.minVoiceIntervalMs) {
        return false;
      }
    } else if (this.isVoicePlaying) {
      this._stopActiveVoicePlayback();
    }

    // 2. Mark voice state active & duck background music by ~45% (0.34 -> 0.18)
    this.isVoicePlaying = true;
    this.activeVoicePriority = priority;
    this.activeVoiceClipId = clip.id;
    this.lastVoiceTriggerMs = nowMs;
    if (isUrgent) {
      this.lastUrgentVoiceMs = nowMs;
    }
    this._setMusicDucked(true);

    // 3. Resolve character/captain portrait key & notify HUD toast immediately
    const isSpecificCharacterClip =
      clip.category === 'praise' ||
      clip.category === 'atc' ||
      clip.category === 'atc_urgent' ||
      clip.category === 'wendy_urgent';
    const resolvedHostessKey =
      options.hostessKey ||
      (isSpecificCharacterClip
        ? clip.hostessKey
        : this.activeHostessKey || clip.hostessKey || 'hostess_wendy');
    const resolvedSpeaker = options.speaker || clip.speaker;

    if (typeof this.onVoiceSubtitle === 'function') {
      try {
        this.onVoiceSubtitle(resolvedSpeaker, clip.text, resolvedHostessKey, clip.id);
      } catch (_err) {
        // Ignore HUD callback errors
      }
    }

    const ctx = this.ensureContext();
    const pan = this.computePan(options.worldX || 0);

    // 4. Play authentic cabin PA chime (for Wendy) or VHF radio squelch click (for ATC)
    if (ctx) {
      if (clip.isRadio) {
        this._playVhfSquelchClick(pan, true);
      } else if (clip.category && clip.category.startsWith('wendy')) {
        this._playCabinPaChime(pan);
      }
    }

    // 5. Play decoded AudioBuffer (or decode/HTMLAudio fallback)
    const preDecoded = this.voiceBuffers.get(clip.id);
    if (ctx && preDecoded) {
      this._startVoiceBufferSource(clip, preDecoded, pan);
    } else {
      // Attempt immediate async decode or HTMLAudioElement playback
      this._loadAndDecodeClip(this.voiceBuffers, clip.id, [
        clip.id,
        clip.urlMp3,
        clip.urlOgg,
        clip.urlWav,
      ]).then((decodedBuf) => {
        if (this.activeVoiceClipId !== clip.id) return;
        if (ctx && decodedBuf) {
          this._startVoiceBufferSource(clip, decodedBuf, pan);
        } else {
          this._startVoiceElementFallback(clip);
        }
      });

      // Safety fallback timer in case buffer is still generating offline
      this._scheduleVoiceRelease(clip.id, (clip.durationEstSec || 3.0) * 1000 + 350, clip.isRadio, pan);
    }

    return true;
  }

  triggerVoiceLine(clipId, options = {}) {
    return this.playVoice(clipId, options);
  }

  _startVoiceBufferSource(clip, audioBuffer, pan = 0) {
    if (!this.ctx) return;
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.onended = null;
        this.activeVoiceSource.stop();
      } catch (_e) {}
      this.activeVoiceSource = null;
    }

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = audioBuffer;

      const out = this._createSpatialOut(pan * 480, this.voiceBusGain);
      const leadDelay = clip.category && clip.category.startsWith('wendy') ? 0.16 : 0.05;
      const startAt = this.ctx.currentTime + leadDelay;

      src.connect(out);
      src.start(startAt);
      this.activeVoiceSource = src;

      const totalMs = (leadDelay + audioBuffer.duration) * 1000 + 120;
      this._scheduleVoiceRelease(clip.id, totalMs, clip.isRadio, pan);

      src.onended = () => {
        if (this.activeVoiceSource === src) {
          this.activeVoiceSource = null;
        }
      };
    } catch (_err) {
      this._scheduleVoiceRelease(clip.id, (clip.durationEstSec || 2.8) * 1000, clip.isRadio, pan);
    }
  }

  _startVoiceElementFallback(clip) {
    if (typeof window === 'undefined' || typeof window.Audio !== 'function') return;
    try {
      const audioEl = new window.Audio(clip.urlMp3);
      audioEl.volume = this.isMuted ? 0 : 0.92;
      this.activeVoiceAudioEl = audioEl;
      audioEl.play().catch(() => {});
    } catch (_err) {}
  }

  _scheduleVoiceRelease(clipId, durationMs, isRadio = false, pan = 0) {
    if (this.voiceEndTimer) {
      clearTimeout(this.voiceEndTimer);
    }
    this.voiceEndTimer = setTimeout(() => {
      if (this.activeVoiceClipId === clipId) {
        if (isRadio && this.ctx) {
          this._playVhfSquelchClick(pan, false);
        }
        this.isVoicePlaying = false;
        this.activeVoicePriority = 0;
        this.activeVoiceClipId = null;
        this.activeVoiceSource = null;
        this.activeVoiceAudioEl = null;
        this._setMusicDucked(false);
      }
    }, Math.max(400, durationMs));
  }

  _stopActiveVoicePlayback() {
    if (this.voiceEndTimer) {
      clearTimeout(this.voiceEndTimer);
      this.voiceEndTimer = null;
    }
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.onended = null;
        this.activeVoiceSource.stop();
      } catch (_e) {}
      this.activeVoiceSource = null;
    }
    if (this.activeVoiceAudioEl) {
      try {
        this.activeVoiceAudioEl.pause();
      } catch (_e) {}
      this.activeVoiceAudioEl = null;
    }
    this.isVoicePlaying = false;
    this.activeVoicePriority = 0;
    this.activeVoiceClipId = null;
  }

  /**
   * Authentic 1950s Argon Airways Cabin PA two-note chime (`A5 -> F5` warm tubular bell) before Wendy speaks.
   */
  _playCabinPaChime(pan = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const out = this._createSpatialOut(pan * 480, this.sfxBusGain);

    const freqs = [880.0, 698.46];
    freqs.forEach((f, idx) => {
      const t0 = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.11, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t0);
      osc.stop(t0 + 0.26);
    });
  }

  /**
   * Crisp aviation VHF radio PTT squelch click & bandpass static burst for ATC transmissions.
   */
  _playVhfSquelchClick(pan = 0, isStart = true) {
    if (!this.ctx || !this.whiteNoiseBuffer) return;
    const now = this.ctx.currentTime;
    const out = this._createSpatialOut(pan * 480, this.sfxBusGain);

    // Bandpass noise burst (450Hz - 2800Hz VHF voice band)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.whiteNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1450, now);
    bp.Q.setValueAtTime(2.2, now);

    const g = this.ctx.createGain();
    const dur = isStart ? 0.045 : 0.065;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.09, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    noise.connect(bp);
    bp.connect(g);
    g.connect(out);
    noise.start(now, Math.random() * 0.8, dur + 0.01);

    // Subtle carrier squelch chirp (1950Hz -> 1300Hz)
    const chirp = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    chirp.type = 'triangle';
    chirp.frequency.setValueAtTime(isStart ? 1850 : 1420, now);
    chirp.frequency.exponentialRampToValueAtTime(isStart ? 1320 : 980, now + 0.03);
    cg.gain.setValueAtTime(0.05, now);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    chirp.connect(cg);
    cg.connect(out);
    chirp.start(now);
    chirp.stop(now + 0.035);
  }

  /**
   * Convenience Voice Trigger Helpers
   */
  playWelcomeVoice(hostessKey = null) {
    return this.playVoice('wendy_welcome', { hostessKey });
  }

  playSeatbeltsVoice(hostessKey = null) {
    return this.playVoice('wendy_seatbelts', { hostessKey });
  }

  playBeverageVoice(hostessKey = null) {
    return this.playVoice('wendy_beverage', { hostessKey });
  }

  playPersonalBestVoice(hostessKey = null, worldX = 0) {
    if (this.personalBestAnnouncedThisRound) return false;
    this.personalBestAnnouncedThisRound = true;
    this.playVictoryStinger(worldX);
    return this.playVoice('wendy_personal_best', { hostessKey, worldX });
  }

  resetRoundVoiceFlags() {
    this.personalBestAnnouncedThisRound = false;
    this.inConflictEpisode = false;
    this.proximityPulseTimer = 0;
  }

  /**
   * Selects and triggers an Aussie Praise voice line (`praise_you_bewdy`, `praise_onya_mate`,
   * `praise_no_worries`, `praise_fair_dinkum`, `praise_ripper`) when voice cooldown permits.
   */
  playRandomPraiseVoice(preferredText = null, worldX = 0, hostessKey = null, speaker = null) {
    let chosenKey = null;
    if (typeof preferredText === 'string' && preferredText.trim()) {
      const upper = preferredText.toUpperCase();
      for (const k of PRAISE_CLIP_KEYS) {
        const entry = VOICE_CLIP_REGISTRY[k];
        if (entry && entry.matchTag && upper.includes(entry.matchTag)) {
          chosenKey = k;
          break;
        }
      }
    }

    if (!chosenKey) {
      let nextIdx = Math.floor(Math.random() * PRAISE_CLIP_KEYS.length);
      if ( nextIdx === this.lastPraiseIndex ) {
        nextIdx = (nextIdx + 1) % PRAISE_CLIP_KEYS.length;
      }
      this.lastPraiseIndex = nextIdx;
      chosenKey = PRAISE_CLIP_KEYS[nextIdx];
    }

    return this.playVoice(chosenKey, { worldX, hostessKey, speaker });
  }

  // ===========================================================================
  // 3. SPATIAL 2D AIRSPACE SOUND EFFECTS (`pan = clamp(worldX / 480, -0.85, 0.85)`)
  // ===========================================================================

  /**
   * Helper to play a decoded static SFX `AudioBuffer` layered with procedural synthesis.
   */
  _playSfxBuffer(sfxId, outNode, gainVal = 0.65, playbackRate = 1.0, delaySec = 0) {
    if (!this.ctx || !outNode) return false;
    const buf = this.sfxBuffers.get(sfxId);
    if (!buf) {
      const meta = SFX_CLIP_REGISTRY[sfxId];
      if (meta) {
        this._loadAndDecodeClip(this.sfxBuffers, sfxId, [
          meta.id,
          meta.urlMp3,
          meta.urlOgg,
          meta.urlWav,
        ]);
      }
      return false;
    }

    try {
      const now = this.ctx.currentTime + delaySec;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(playbackRate, now);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gainVal, now);

      src.connect(g);
      g.connect(outNode);
      src.start(now);
      return true;
    } catch (_err) {
      return false;
    }
  }

  /**
   * 3.1 Touchdown Brass Bell (`playLandingBell(worldX, landedCount, praiseText, captainPortraitKey, captainSpeaker)`):
   * - Plays `assets/audio/sfx/bell_ding.mp3` layered with a warm harmonic Web Audio brass
   *   service bell chime (`F6 -> C7` shimmer) panned to the runway's `worldX` position!
   * - Triggers an Aussie Praise voice line (`praise_you_bewdy`, `praise_onya_mate`,
   *   `praise_no_worries`, `praise_fair_dinkum`, `praise_ripper`) with the landed aircraft's
   *   distinct Captain portrait when the voice cooldown (`5500ms`) permits!
   */
  playLandingBell(worldX = 0, landedCount = 1, praiseText = null, captainPortraitKey = null, captainSpeaker = null) {
    const ctx = this.ensureContext();
    if (ctx) {
      const out = this._createSpatialOut(worldX, this.sfxBusGain);
      const now = ctx.currentTime;
      const pitchJitter = 1.0 + (Math.random() * 0.03 - 0.015);

      // Layer 1: Pre-generated static `bell_ding.mp3` buffer
      this._playSfxBuffer('bell_ding', out, 0.72, pitchJitter);

      // Layer 2: Warm harmonic Web Audio brass service bell chime (`F6 -> C7` shimmer)
      // Fundamental F6 (1396.91 Hz) -> C7 (2093.00 Hz) with classic brass bell partials (1.0, 2.0, 2.756)
      const bellNotes = [
        { freq: 1396.91 * pitchJitter, delay: 0.0, dur: 0.58, amp: 0.22 },
        { freq: 2093.00 * pitchJitter, delay: 0.065, dur: 0.78, amp: 0.26 },
      ];

      for (const note of bellNotes) {
        const t0 = now + note.delay;
        const partials = [
          { ratio: 1.0, weight: 1.0, decay: note.dur },
          { ratio: 2.0, weight: 0.42, decay: note.dur * 0.65 },
          { ratio: 2.756, weight: 0.22, decay: note.dur * 0.45 },
        ];

        for (const p of partials) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = p.ratio === 1.0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(note.freq * p.ratio, t0);

          const peak = note.amp * p.weight;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(peak, t0 + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay);

          osc.connect(g);
          g.connect(out);
          osc.start(t0);
          osc.stop(t0 + p.decay + 0.02);
        }
      }

      // Layer 3: Crisp brass striker contact ping (0 - 18ms)
      if (this.whiteNoiseBuffer) {
        const striker = ctx.createBufferSource();
        striker.buffer = this.whiteNoiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.setValueAtTime(4200, now);
        hp.Q.setValueAtTime(4.5, now);

        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.12, now);
        sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

        striker.connect(hp);
        hp.connect(sg);
        sg.connect(out);
        striker.start(now, 0, 0.022);
      }
    }

    // Trigger milestone beverage service (map hostess) or Captain Praise voice line when cooldown permits
    if (landedCount > 0 && landedCount % 12 === 0) {
      if (!this.playVoice('wendy_beverage', { worldX, hostessKey: this.activeHostessKey })) {
        this.playRandomPraiseVoice(praiseText, worldX, captainPortraitKey, captainSpeaker);
      }
    } else {
      this.playRandomPraiseVoice(praiseText, worldX, captainPortraitKey, captainSpeaker);
    }
  }

  playTouchdownBell(worldX = 0, landedCount = 1, praiseText = null, captainPortraitKey = null, captainSpeaker = null) {
    this.playLandingBell(worldX, landedCount, praiseText, captainPortraitKey, captainSpeaker);
  }

  /**
   * 3.2 Stage 1 Proximity Hazard Klaxon (`updateProximityAlarm(activeConflicts, dt)`):
   * - When `activeConflicts.length > 0`, pulses an urgent, authentic Argon two-tone ATC
   *   proximity warning alarm (`880Hz / 1175Hz` rhythmic beep-beep strobe panned to the
   *   conflict midpoint `midX`, with pulse rate accelerating as `closestDist` shrinks from
   *   `64` toward `22`!) + triggers `wendy_look_out` or `atc_go_around` once per conflict episode!
   */
  updateProximityAlarm(activeConflicts, dt = 0.016) {
    const conflicts = Array.isArray(activeConflicts) ? activeConflicts : [];
    const safeDt = clamp(Number(dt) || 0.016, 0.001, 0.25);

    if (conflicts.length === 0) {
      this.proximityPulseTimer = 0;
      if (this.inConflictEpisode) {
        this.conflictClearTimer += safeDt;
        if (this.conflictClearTimer >= 1.35) {
          this.inConflictEpisode = false;
          this.conflictClearTimer = 0;
        }
      }
      return;
    }

    this.conflictClearTimer = 0;

    // Locate the most urgent (closest) conflict pair
    let closestDist = 64;
    let midX = 0;
    for (const c of conflicts) {
      const d = typeof c.dist === 'number' ? c.dist : 54;
      if (d < closestDist) {
        closestDist = d;
      }
      if (typeof c.midX === 'number') {
        midX = c.midX;
      } else if (c.planeA && c.planeB) {
        midX = (c.planeA.x + c.planeB.x) * 0.5;
      }
    }

    // Trigger `wendy_look_out` or `atc_go_around` once per conflict episode!
    if (!this.inConflictEpisode) {
      this.inConflictEpisode = true;
      this.proximityPulseTimer = 0; // Immediate first klaxon pulse
      const urgentKey = this.urgentAlternator % 2 === 0 ? 'wendy_look_out' : 'atc_go_around';
      this.urgentAlternator++;
      this.playVoice(urgentKey, { worldX: midX });
    }

    // Pulse interval shrinks smoothly from 0.42s (at dist = 64) down to 0.15s (at dist = 22)
    const severity = clamp((64 - closestDist) / (64 - 22), 0, 1);
    const pulseInterval = 0.42 - severity * 0.27;

    this.proximityPulseTimer -= safeDt;
    if (this.proximityPulseTimer <= 0) {
      this.proximityPulseTimer = pulseInterval;
      this._playProximityKlaxonBeep(midX, severity);
    }
  }

  /**
   * Direct event callback for `director.callbacks.onProximityWarning(activeConflicts)`.
   */
  triggerProximityWarning(activeConflicts) {
    this.updateProximityAlarm(activeConflicts, 0.016);
  }

  /**
   * Synthesizes a single two-tone `880Hz / 1175Hz` ATC proximity warning beep-beep strobe
   * panned to `midX`.
   */
  _playProximityKlaxonBeep(midX = 0, severity = 0.5) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const out = this._createSpatialOut(midX, this.sfxBusGain);
    const now = ctx.currentTime;

    // Subtle static proximity_alarm transient layer
    this._playSfxBuffer('proximity_alarm', out, 0.22 + severity * 0.14, 1.0 + severity * 0.08);

    // Authentic Argon two-tone ATC proximity warning alarm (880Hz A5 -> 1175Hz D6)
    const toneDur = 0.055;
    const gap = 0.062;
    const peakGain = 0.14 + severity * 0.08;
    const freqs = this.proximityPhaseToggle % 2 === 0 ? [880, 1175] : [1175, 880];
    this.proximityPhaseToggle++;

    freqs.forEach((freq, idx) => {
      const t0 = now + idx * gap;
      const osc = ctx.createOscillator();
      const harm = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t0);
      harm.type = 'triangle';
      harm.frequency.setValueAtTime(freq * 2, t0);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2800 + severity * 1200, t0);
      lp.Q.setValueAtTime(2.5, t0);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peakGain, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + toneDur);

      osc.connect(lp);
      harm.connect(lp);
      lp.connect(g);
      g.connect(out);

      osc.start(t0);
      harm.start(t0);
      osc.stop(t0 + toneDur + 0.01);
      harm.stop(t0 + toneDur + 0.01);
    });
  }

  /**
   * 3.3 Runway Approach Lock Chime (`playRunwayLock(worldX, runway)`):
   * - Plays a crisp, tactile two-note vibraphone chime (`C6 -> G6`) + `route_lock.mp3`
   *   panned to `worldX`.
   * - Optional ATC radio clearance (`atc_cleared_29` or `atc_helipad_clear` if cooldown permits).
   */
  playRunwayLock(worldX = 0, runway = null) {
    const ctx = this.ensureContext();
    if (ctx) {
      const out = this._createSpatialOut(worldX, this.sfxBusGain);
      const now = ctx.currentTime;

      // Static `route_lock.mp3` layer
      this._playSfxBuffer('route_lock', out, 0.58, 1.0);

      // Two-note 1950s vibraphone/marimba lock chime (C6 = 1046.5Hz -> G6 = 1567.98Hz)
      const isHelipad = Boolean(runway && runway.isHelipad);
      const notes = isHelipad ? [1174.66, 1760.0] : [1046.5, 1567.98];

      notes.forEach((freq, idx) => {
        const t0 = now + idx * 0.055;
        const dur = idx === 1 ? 0.28 : 0.16;

        const osc = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const g = ctx.createGain();
        const og = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0);

        // Vibraphone 4:1 harmonic overtone for warm wooden-bar mallet attack
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 4, t0);

        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.18, t0 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        og.gain.setValueAtTime(0.05, t0);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);

        osc.connect(g);
        overtone.connect(og);
        og.connect(g);
        g.connect(out);

        osc.start(t0);
        overtone.start(t0);
        osc.stop(t0 + dur + 0.015);
        overtone.stop(t0 + 0.045);
      });
    }

    // Trigger ATC clearance radio callout when cooldown permits (and not spamming every lock)
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastRunwayLockVoiceMs >= 11000 && !this.inConflictEpisode) {
      const isHelipad = Boolean(runway && runway.isHelipad);
      const clipId = isHelipad ? 'atc_helipad_clear' : 'atc_cleared_29';
      if (this.playVoice(clipId, { worldX })) {
        this.lastRunwayLockVoiceMs = nowMs;
      }
    }
  }

  playRouteLock(worldX = 0, runway = null) {
    this.playRunwayLock(worldX, runway);
  }

  /**
   * 3.4 Spline Drawing Tactile Tick (`playPathDrawTick(worldX)`):
   * - Subtle, ultra-soft pencil/chalk click panned to `worldX` while drawing paths.
   */
  playPathDrawTick(worldX = 0) {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastPathTickMs < 38) return;
    this.lastPathTickMs = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const out = this._createSpatialOut(worldX, this.sfxBusGain);
    const now = ctx.currentTime;
    const vary = 0.94 + Math.random() * 0.12;

    // Subtle static `path_draw_tick.mp3` layer
    this._playSfxBuffer('path_draw_tick', out, 0.24, vary);

    // Ultra-soft tactile chalk/pencil transient (short triangle + bandpass noise grain)
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1280 * vary, now);
    osc.frequency.exponentialRampToValueAtTime(520 * vary, now + 0.016);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.065, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.02);

    if (this.pinkNoiseBuffer) {
      const grain = ctx.createBufferSource();
      grain.buffer = this.pinkNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1650 * vary, now);
      bp.Q.setValueAtTime(3.2, now);

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.045, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);

      grain.connect(bp);
      bp.connect(ng);
      ng.connect(out);
      grain.start(now, Math.random() * 1.2, 0.016);
    }
  }

  /**
   * Crisp 1950s radar/transponder selection ping when clicking an aircraft.
   */
  playPlaneSelect(worldX = 0, _plane = null) {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastSelectBeepMs < 60) return;
    this.lastSelectBeepMs = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const out = this._createSpatialOut(worldX, this.sfxBusGain);
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.065); // B5

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.13, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.105);
  }

  playAircraftSelect(worldX = 0, plane = null) {
    this.playPlaneSelect(worldX, plane);
  }

  /**
   * Subtle perimeter `!` warning badge sonar blip when a new aircraft approaches the boundary.
   */
  playSpawnWarning(worldX = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const out = this._createSpatialOut(worldX, this.sfxBusGain);
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(783.99, now); // G5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.075, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * 3.5 Mid-Air Collision Explosion & Rubber Stamp (`playCrashExplosion(worldX)`):
   * - Plays `assets/audio/sfx/crash_explosion.mp3` + low-end impact boom + metallic debris scatter,
   *   followed `450ms` later by `stamp_thud.mp3` when the Game Over clipboard stamps onto the screen!
   */
  playCrashExplosion(worldX = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    this._stopActiveVoicePlayback();
    this._setMusicDucked(true);

    const out = this._createSpatialOut(worldX, this.sfxBusGain);
    const now = ctx.currentTime;

    // Layer 1: Static `crash_explosion.mp3` buffer
    this._playSfxBuffer('crash_explosion', out, 0.85, 1.0);

    // Layer 2: Zero-attack sub-bass kinetic shockwave drop (155Hz -> 26Hz over 0.65s)
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(155, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.62);

    subGain.gain.setValueAtTime(0.42, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);
    sub.connect(subGain);
    subGain.connect(out);
    sub.start(now);
    sub.stop(now + 0.7);

    // Layer 3: Brownian noise blast body with 700Hz tin-drum notch filter + 1600Hz lowpass
    if (this.brownNoiseBuffer) {
      const blast = ctx.createBufferSource();
      blast.buffer = this.brownNoiseBuffer;

      const notch = ctx.createBiquadFilter();
      notch.type = 'notch';
      notch.frequency.setValueAtTime(720, now);
      notch.Q.setValueAtTime(1.8, now);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1650, now);
      lp.frequency.exponentialRampToValueAtTime(190, now + 1.15);

      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, now);
      bg.gain.linearRampToValueAtTime(0.38, now + 0.012);
      bg.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      blast.connect(notch);
      notch.connect(lp);
      lp.connect(bg);
      bg.connect(out);
      blast.start(now, 0, 1.25);
    }

    // Layer 4: 12-grain inharmonic metallic fuselage debris scatter (40ms - 380ms)
    const metalFreqs = [1180, 1660, 2340, 3120, 3890];
    for (let i = 0; i < 12; i++) {
      const delay = 0.035 + i * 0.026 + Math.random() * 0.018;
      const t0 = now + delay;
      const f = metalFreqs[i % metalFreqs.length] * (0.9 + Math.random() * 0.22);

      const shard = ctx.createOscillator();
      const sg = ctx.createGain();
      shard.type = i % 2 === 0 ? 'triangle' : 'sawtooth';
      shard.frequency.setValueAtTime(f, t0);
      shard.frequency.exponentialRampToValueAtTime(f * 0.58, t0 + 0.065);

      sg.gain.setValueAtTime(0.065, t0);
      sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);

      shard.connect(sg);
      sg.connect(out);
      shard.start(t0);
      shard.stop(t0 + 0.075);
    }

    // Schedule `stamp_thud.mp3` 450ms later when the Game Over clipboard stamps onto the screen!
    if (this.crashStampTimeout) {
      clearTimeout(this.crashStampTimeout);
    }
    this.crashStampTimeout = setTimeout(() => {
      this.playStampThud(0);
    }, 450);
  }

  /**
   * Plays `assets/audio/sfx/stamp_thud.mp3` + dual-impulse mechanical vintage rubber stamp ink thud.
   */
  playStampThud(worldX = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const out = this._createSpatialOut(worldX, this.sfxBusGain);
    const now = ctx.currentTime;

    // Layer 1: Static `stamp_thud.mp3` buffer
    this._playSfxBuffer('stamp_thud', out, 0.78, 1.0);

    // Layer 2: Dual-Impulse "CHA-CHUNK" Rubber Stamp (0ms spring unlatch click -> 48ms heavy desk ink thud)
    // Impulse A: Spring handle click (0ms)
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1450, now);
    clickOsc.frequency.exponentialRampToValueAtTime(420, now + 0.022);
    clickGain.gain.setValueAtTime(0.11, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    clickOsc.connect(clickGain);
    clickGain.connect(out);
    clickOsc.start(now);
    clickOsc.stop(now + 0.028);

    // Impulse B: Heavy wooden clipboard / rubber ink pad seating thud (+45ms)
    const tImpact = now + 0.045;
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(148, tImpact);
    thudOsc.frequency.exponentialRampToValueAtTime(38, tImpact + 0.14);
    thudGain.gain.setValueAtTime(0.34, tImpact);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, tImpact + 0.16);
    thudOsc.connect(thudGain);
    thudGain.connect(out);
    thudOsc.start(tImpact);
    thudOsc.stop(tImpact + 0.17);

    if (this.pinkNoiseBuffer) {
      const paperSlap = ctx.createBufferSource();
      paperSlap.buffer = this.pinkNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(680, tImpact);
      bp.Q.setValueAtTime(1.8, tImpact);

      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.18, tImpact);
      pg.gain.exponentialRampToValueAtTime(0.0001, tImpact + 0.055);

      paperSlap.connect(bp);
      bp.connect(pg);
      pg.connect(out);
      paperSlap.start(tImpact, 0.2, 0.065);
    }
  }

  /**
   * Crisp mechanical split-flap / metallic bezel button click.
   */
  playUiClick(worldX = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const out = this._createSpatialOut(worldX, this.sfxBusGain);
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1120, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.025);

    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  /**
   * Adjusts music tempo slightly during Fast-Forward (`>>`) mode and plays a mechanical toggle click.
   */
  setFastForward(isFastForward) {
    const next = Boolean(isFastForward);
    if (this.isFastForward === next) return;
    this.isFastForward = next;
    this.playUiClick(-360);

    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const rate = next ? 1.07 : 1.0;
    for (const entry of Object.values(this.musicNodes)) {
      if (entry.source && entry.source.playbackRate) {
        try {
          entry.source.playbackRate.setTargetAtTime(rate, now, 0.08);
        } catch (_e) {}
      }
    }
  }

  /**
   * Mute / Unmute Controls
   */
  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0.0001 : 1.0, now + 0.06);
    }
    if (this.activeVoiceAudioEl) {
      this.activeVoiceAudioEl.volume = this.isMuted ? 0 : 0.92;
    }
    return this.isMuted;
  }

  toggleMute() {
    return this.setMuted(!this.isMuted);
  }

  /**
   * Gentle procedural 1950s lounge vibraphone & walking bass fallback pulse
   * that plays ONLY if the Lyria 3 MP3 buffers have not finished decoding yet.
   */
  _updateProceduralJazzFallback(dt) {
    if (!this.ctx || this.ctx.state !== 'running' || this.musicMode === 'stopped' || this.isMuted) {
      return;
    }
    // Once any real Lyria 3 music track is decoded and playing, silence procedural fallback
    const anyRealTrackPlaying =
      this.musicNodes.main_menu_bossa.playing ||
      this.musicNodes.inflight_lounge_relaxed.playing ||
      this.musicNodes.inflight_bigband_swing.playing;
    if (anyRealTrackPlaying) return;

    const stepInterval = this.isHighDensity ? 0.34 : 0.48;
    this._procJazzTimer += dt;
    if (this._procJazzTimer < stepInterval) return;
    this._procJazzTimer -= stepInterval;

    const bassWalk = [174.61, 220.0, 261.63, 293.66, 329.63, 293.66, 261.63, 220.0]; // F3 major 6th walk
    const vibeChords = [
      [523.25, 659.25, 783.99],
      [587.33, 698.46, 880.0],
    ];
    const step = this._procJazzStep++;
    const now = this.ctx.currentTime;

    // Soft upright walking bass pluck
    const bassFreq = bassWalk[step % bassWalk.length];
    const bOsc = this.ctx.createOscillator();
    const bGain = this.ctx.createGain();
    bOsc.type = 'sine';
    bOsc.frequency.setValueAtTime(bassFreq, now);
    bGain.gain.setValueAtTime(0.0001, now);
    bGain.gain.linearRampToValueAtTime(0.09, now + 0.015);
    bGain.gain.exponentialRampToValueAtTime(0.0001, now + stepInterval * 0.85);
    bOsc.connect(bGain);
    bGain.connect(this.musicBusGain);
    bOsc.start(now);
    bOsc.stop(now + stepInterval * 0.9);

    // Warm vibraphone chord comp on beat 0 and 4
    if (step % 4 === 0) {
      const chord = vibeChords[(step >> 2) % vibeChords.length];
      for (const f of chord) {
        const vOsc = this.ctx.createOscillator();
        const vGain = this.ctx.createGain();
        vOsc.type = 'triangle';
        vOsc.frequency.setValueAtTime(f, now);
        vGain.gain.setValueAtTime(0.0001, now);
        vGain.gain.linearRampToValueAtTime(0.032, now + 0.02);
        vGain.gain.exponentialRampToValueAtTime(0.0001, now + stepInterval * 1.8);
        vOsc.connect(vGain);
        vGain.connect(this.musicBusGain);
        vOsc.start(now);
        vOsc.stop(now + stepInterval * 1.85);
      }
    }
  }

  /**
   * Optional per-frame update hook (`audioEngine.update(dt, { activeConflicts, isHighDensity })`).
   */
  update(dt = 0.016, state = {}) {
    const safeDt = clamp(Number(dt) || 0.016, 0.001, 0.25);
    if (state && typeof state.isHighDensity === 'boolean') {
      this.setHighDensityMode(state.isHighDensity);
    }
    if (state && Array.isArray(state.activeConflicts)) {
      this.updateProximityAlarm(state.activeConflicts, safeDt);
    }
    this._updateProceduralJazzFallback(safeDt);
  }
}

if (typeof window !== 'undefined') {
  window.MUSIC_TRACK_REGISTRY = MUSIC_TRACK_REGISTRY;
  window.VOICE_CLIP_REGISTRY = VOICE_CLIP_REGISTRY;
  window.SFX_CLIP_REGISTRY = SFX_CLIP_REGISTRY;
  window.FlightAudioEngine = FlightAudioEngine;
}

export default FlightAudioEngine;
