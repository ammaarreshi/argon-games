/**
 * Argon Tennis — Lyria 3 Soundtrack & Studio Procedural Audio Engine (`src/audio_engine.js`)
 *
 * Manages:
 * 1. Lyria 3 Generated Soundtrack (`./assets/audio/*.mp3`) with smooth crossfading,
 *    browser autoplay unlock on first user interaction, and HUD track metadata.
 * 2. Studio-grade zero-dependency Web Audio API procedural sound effects following
 *    `designing-procedural-audio` principles (mechanical friction transients +
 *    harmonic tonal bodies, multi-oscillator phase detuning, filtered feedback reverb,
 *    and smooth attack/decay envelopes).
 * 3. Umpire voice synthesis (`window.speechSynthesis`) backed by musical chime cadences.
 */

export const LYRIA_TRACKS = {
  menu_theme: {
    id: 'menu_theme',
    title: 'Argon Club Plaza Breeze (Lyria 3)',
    subtitle: 'Title & Club Select Theme',
    src: './assets/audio/menu_theme.mp3',
    loop: true,
    baseVolume: 0.42,
  },
  court_intro: {
    id: 'court_intro',
    title: 'Center Court Flyover (Lyria 3)',
    subtitle: 'Stadium Intro Fanfare',
    src: './assets/audio/court_intro.mp3',
    loop: false,
    baseVolume: 0.48,
  },
  match_rally: {
    id: 'match_rally',
    title: 'Sunny Baseline Rally (Lyria 3)',
    subtitle: 'Active Match Atmosphere',
    src: './assets/audio/match_rally.mp3',
    loop: true,
    baseVolume: 0.34,
  },
  victory_fanfare: {
    id: 'victory_fanfare',
    title: 'Grand Slam Trophy (Lyria 3)',
    subtitle: 'Match Victory Celebration',
    src: './assets/audio/victory_fanfare.mp3',
    loop: false,
    baseVolume: 0.50,
  },
};

const STATE_TO_TRACK = {
  title: 'menu_theme',
  menu: 'menu_theme',
  select: 'menu_theme',
  intro: 'court_intro',
  court_intro: 'court_intro',
  flyover: 'court_intro',
  start: 'court_intro',
  serve: 'match_rally',
  serve_wait: 'match_rally',
  serve_toss: 'match_rally',
  rally: 'match_rally',
  playing: 'match_rally',
  match: 'match_rally',
  point: 'match_rally',
  gamepoint: 'match_rally',
  replay: 'match_rally',
  victory: 'victory_fanfare',
  win: 'victory_fanfare',
  game_won: 'victory_fanfare',
  match_over: 'victory_fanfare',
  celebration: 'victory_fanfare',
  menu_theme: 'menu_theme',
  match_rally: 'match_rally',
  victory_fanfare: 'victory_fanfare',
};

export const GEMINI_TTS_CLIPS = {
  'start': './assets/audio/tts/match_start.mp3',
  'match_start': './assets/audio/tts/match_start.mp3',
  'game point': './assets/audio/tts/game_point.mp3',
  'game_point': './assets/audio/tts/game_point.mp3',
  'break point': './assets/audio/tts/break_point.mp3',
  'break_point': './assets/audio/tts/break_point.mp3',
  'match point': './assets/audio/tts/match_point.mp3',
  'match_point': './assets/audio/tts/match_point.mp3',
  'game': './assets/audio/tts/game_won.mp3',
  'game!': './assets/audio/tts/game_won.mp3',
  'game_won': './assets/audio/tts/game_won.mp3',
  'game set and match': './assets/audio/tts/game_set_match.mp3',
  'game_set_match': './assets/audio/tts/game_set_match.mp3',
  'out': './assets/audio/tts/call_out.mp3',
  'call_out': './assets/audio/tts/call_out.mp3',
  'net': './assets/audio/tts/call_net.mp3',
  'call_net': './assets/audio/tts/call_net.mp3',
  'nice shot!': './assets/audio/tts/call_nice_shot.mp3',
  'nice shot': './assets/audio/tts/call_nice_shot.mp3',
  'call_nice_shot': './assets/audio/tts/call_nice_shot.mp3',
  'power serve': './assets/audio/tts/call_power_serve.mp3',
  'power serve!': './assets/audio/tts/call_power_serve.mp3',
  'call_power_serve': './assets/audio/tts/call_power_serve.mp3',
  'smash': './assets/audio/tts/call_power_smash.mp3',
  'call_power_smash': './assets/audio/tts/call_power_smash.mp3',
  'replay': './assets/audio/tts/call_replay.mp3',
  'call_replay': './assets/audio/tts/call_replay.mp3',
  '15 - 00': './assets/audio/tts/score_15_00.mp3?v=2',
  '30 - 00': './assets/audio/tts/score_30_00.mp3?v=2',
  '40 - 00': './assets/audio/tts/score_40_00.mp3?v=2',
  '00 - 15': './assets/audio/tts/score_00_15.mp3?v=2',
  '00 - 30': './assets/audio/tts/score_00_30.mp3?v=2',
  '00 - 40': './assets/audio/tts/score_00_40.mp3?v=2',
  '15 - 15': './assets/audio/tts/score_15_15.mp3?v=2',
  '30 - 15': './assets/audio/tts/score_30_15.mp3?v=2',
  '40 - 15': './assets/audio/tts/score_40_15.mp3?v=2',
  '15 - 30': './assets/audio/tts/score_15_30.mp3?v=2',
  '30 - 30': './assets/audio/tts/score_30_30.mp3?v=2',
  '40 - 30': './assets/audio/tts/score_40_30.mp3?v=2',
  '15 - 40': './assets/audio/tts/score_15_40.mp3?v=2',
  '30 - 40': './assets/audio/tts/score_30_40.mp3?v=2',
  'deuce': './assets/audio/tts/score_deuce.mp3?v=2',
  'ad in': './assets/audio/tts/score_ad_in.mp3?v=2',
  'ad out': './assets/audio/tts/score_ad_out.mp3?v=2',
};

export class AudioEngine {
  constructor(options = {}) {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.reverbSend = null;

    this.muted = Boolean(options.muted ?? false);
    this.musicVolume = Number(options.musicVolume ?? 0.65);
    this.sfxVolume = Number(options.sfxVolume ?? 0.85);

    this.audioElements = new Map();
    this.ttsAudioElements = new Map();
    this._activeVoiceAudio = null;
    this._voiceTimers = [];
    this.currentTrackId = null;
    this.desiredTrackId = 'menu_theme';
    this.unlocked = false;
    this.onTrackChange = typeof options.onTrackChange === 'function' ? options.onTrackChange : null;

    this._noiseBuffer = null;
    this._pinkNoiseBuffer = null;
    this._fadeTimers = new Map();

    this._preloadTracks();
    this._preloadTtsClips();
    this._attachAutoplayUnlock();
  }

  _preloadTracks() {
    for (const [key, meta] of Object.entries(LYRIA_TRACKS)) {
      const audio = new Audio();
      audio.src = meta.src;
      audio.loop = meta.loop;
      audio.preload = 'auto';
      audio.volume = 0;
      audio.crossOrigin = 'anonymous';

      // When non-looping court_intro finishes, transition smoothly into match_rally
      if (key === 'court_intro') {
        audio.addEventListener('ended', () => {
          if (this.currentTrackId === 'court_intro') {
            this.playMusicForState('rally');
          }
        });
      }
      this.audioElements.set(key, audio);
    }
  }

  _preloadTtsClips() {
    const uniqueUrls = new Set(Object.values(GEMINI_TTS_CLIPS));
    for (const url of uniqueUrls) {
      const audio = new Audio();
      audio.src = url;
      audio.preload = 'auto';
      audio.volume = Math.min(1, this.sfxVolume);
      this.ttsAudioElements.set(url, audio);
    }
  }

  _attachAutoplayUnlock() {
    const unlockHandler = () => {
      this.unlock();
    };
    window.addEventListener('pointerdown', unlockHandler, { passive: true });
    window.addEventListener('keydown', unlockHandler, { passive: true });
    window.addEventListener('touchstart', unlockHandler, { passive: true });
  }

  /**
   * Lazily initializes the Web Audio API context & spatial feedback delay network.
   */
  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0.0 : 1.0;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      // Filtered feedback delay network for warm spatial stadium tail
      const delay = this.ctx.createDelay(0.5);
      delay.delayTime.value = 0.095;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.24;
      const damping = this.ctx.createBiquadFilter();
      damping.type = 'lowpass';
      damping.frequency.value = 3200;

      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0.22;

      this.reverbSend.connect(delay);
      delay.connect(damping);
      damping.connect(feedback);
      feedback.connect(delay);
      damping.connect(this.masterGain);

      this._buildNoiseBuffers();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _buildNoiseBuffers() {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const length = sr * 2; // 2-second reusable buffers

    // White noise buffer
    this._noiseBuffer = this.ctx.createBuffer(1, length, sr);
    const white = this._noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      white[i] = Math.random() * 2 - 1;
    }

    // Pink noise buffer (Paul Kellet's filtering approximation for warm crowd & turf textures)
    this._pinkNoiseBuffer = this.ctx.createBuffer(1, length, sr);
    const pink = this._pinkNoiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      pink[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.045;
      b6 = w * 0.115926;
    }
  }

  unlock() {
    this._ensureContext();
    this.unlocked = true;
    if (this.desiredTrackId && !this.muted) {
      const currentAudio = this.audioElements.get(this.currentTrackId || this.desiredTrackId);
      if (!currentAudio || currentAudio.paused) {
        this._crossfadeToTrack(this.desiredTrackId);
      }
    }
  }

  /**
   * Switches / crossfades the active Lyria 3 MP3 soundtrack based on game state.
   */
  playMusicForState(state) {
    const normalized = String(state || 'rally').toLowerCase().trim();
    const targetTrackId = STATE_TO_TRACK[normalized] || 'match_rally';
    this.desiredTrackId = targetTrackId;

    if (this.currentTrackId === targetTrackId) {
      const existing = this.audioElements.get(targetTrackId);
      if (existing && existing.paused && !this.muted) {
        existing.play().catch(() => {});
      }
      return this.getCurrentTrackInfo();
    }

    this._crossfadeToTrack(targetTrackId);
    return this.getCurrentTrackInfo();
  }

  _crossfadeToTrack(targetTrackId) {
    const prevId = this.currentTrackId;
    this.currentTrackId = targetTrackId;

    if (prevId && prevId !== targetTrackId) {
      const prevAudio = this.audioElements.get(prevId);
      if (prevAudio) {
        this._fadeAudio(prevAudio, 0, 420, true);
      }
    }

    const nextAudio = this.audioElements.get(targetTrackId);
    const meta = LYRIA_TRACKS[targetTrackId];
    if (nextAudio && meta) {
      const targetVol = this.muted ? 0 : Math.min(1, meta.baseVolume * this.musicVolume);
      if (!meta.loop) {
        try { nextAudio.currentTime = 0; } catch (_) {}
      }
      nextAudio.play().then(() => {
        this._fadeAudio(nextAudio, targetVol, 480, false);
      }).catch(() => {
        // Autoplay still blocked until first user interaction
      });
    }

    const info = this.getCurrentTrackInfo();
    this._updateHudMusicBadge(info);
    if (typeof this.onTrackChange === 'function') {
      this.onTrackChange(info);
    }
  }

  _fadeAudio(audio, targetVolume, durationMs, pauseOnZero = false) {
    if (this._fadeTimers.has(audio)) {
      clearInterval(this._fadeTimers.get(audio));
    }
    const steps = 12;
    const stepMs = Math.max(16, Math.floor(durationMs / steps));
    const startVol = audio.volume;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const t = step / steps;
      audio.volume = Math.max(0, Math.min(1, startVol + (targetVolume - startVol) * t));
      if (step >= steps) {
        clearInterval(timer);
        this._fadeTimers.delete(audio);
        audio.volume = Math.max(0, Math.min(1, targetVolume));
        if (pauseOnZero && targetVolume <= 0.001) {
          audio.pause();
        }
      }
    }, stepMs);

    this._fadeTimers.set(audio, timer);
  }

  getCurrentTrackInfo() {
    const id = this.currentTrackId || this.desiredTrackId || 'menu_theme';
    const meta = LYRIA_TRACKS[id] || LYRIA_TRACKS.menu_theme;
    return {
      ...meta,
      muted: this.muted,
      musicVolume: this.musicVolume,
    };
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
    }
    const activeAudio = this.audioElements.get(this.currentTrackId || this.desiredTrackId);
    const meta = LYRIA_TRACKS[this.currentTrackId || this.desiredTrackId];
    if (activeAudio && meta) {
      if (this.muted) {
        activeAudio.volume = 0;
      } else {
        activeAudio.volume = Math.min(1, meta.baseVolume * this.musicVolume);
        if (activeAudio.paused) activeAudio.play().catch(() => {});
      }
    }
    this._updateHudMusicBadge(this.getCurrentTrackInfo());
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  setMusicVolume(vol) {
    this.musicVolume = Math.max(0, Math.min(1, Number(vol)));
    if (!this.muted && this.currentTrackId) {
      const audio = this.audioElements.get(this.currentTrackId);
      const meta = LYRIA_TRACKS[this.currentTrackId];
      if (audio && meta) {
        audio.volume = Math.min(1, meta.baseVolume * this.musicVolume);
      }
    }
  }

  setSfxVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(vol)));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  _updateHudMusicBadge(info) {
    const label = document.getElementById('hud-music-title') || document.getElementById('music-track-label');
    if (label && info) {
      label.textContent = info.muted ? `🔇 ${info.title}` : `♪ ${info.title}`;
    }
  }

  // ============================================================================
  // STUDIO PROCEDURAL WEB AUDIO SOUND EFFECTS
  // ============================================================================

  /**
   * 1. `playSwingWhoosh(power)`:
   * Filtered noise bandpass sweep simulating the Motion Controller speaker whoosh,
   * paired with a warm detuned triangle air-displacement glide.
   */
  playSwingWhoosh(power = 1.0) {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx || !this._pinkNoiseBuffer) return;

    const now = ctx.currentTime;
    const p = Math.max(0.6, Math.min(1.8, Number(power || 1.0)));
    const duration = 0.16;

    // Layer 1: Bandpass-swept pink noise air whoosh
    const noise = ctx.createBufferSource();
    noise.buffer = this._pinkNoiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.6, now);
    filter.frequency.setValueAtTime(320 * p, now);
    filter.frequency.exponentialRampToValueAtTime(1380 * p, now + duration * 0.55);
    filter.frequency.exponentialRampToValueAtTime(420, now + duration);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.11 * Math.min(1.2, p), now + 0.025);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter).connect(nGain).connect(this.sfxGain);
    noise.start(now, Math.random() * 0.5, duration + 0.02);

    // Layer 2: Subtle tonal air body
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(175 * p, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + duration);

    oGain.gain.setValueAtTime(0.001, now);
    oGain.gain.linearRampToValueAtTime(0.055, now + 0.02);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oGain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  /**
   * 2. `playRacketHit(shotType, timingQuality)`:
   * Layered mechanical string friction transient + harmonic tonal body.
   * For `power_smash` / `smash` or `'perfect'` sweet-spot timing, triggers a
   * sparkling major-chord arpeggio chime routed into the spatial delay network!
   */
  playRacketHit(shotType = 'topspin', timingQuality = 'good') {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx || !this._noiseBuffer) return;

    const now = ctx.currentTime;
    const normShot = String(shotType || 'topspin').toLowerCase();
    const isSmash = normShot === 'smash' || normShot === 'power_smash';
    const isPerfect = timingQuality === 'perfect' || timingQuality === 'sweet_spot' || isSmash;

    // Layer 1: Mechanical String Bed Transient (0.022s high-resonance bandpass snap)
    const snap = ctx.createBufferSource();
    snap.buffer = this._noiseBuffer;

    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = 'bandpass';
    snapFilter.frequency.setValueAtTime(normShot === 'slice' ? 3600 : 2450, now);
    snapFilter.Q.setValueAtTime(1.75, now);

    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.001, now);
    snapGain.gain.linearRampToValueAtTime(isSmash ? 0.14 : 0.10, now + 0.004);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

    snap.connect(snapFilter).connect(snapGain).connect(this.sfxGain);
    snap.start(now, Math.random() * 0.5, 0.035);

    // Layer 2: Harmonic String Tonal Body (Dual phase-detuned oscillators)
    let startFreq = 320;
    let endFreq = 132;
    let bodyDur = 0.14;

    if (normShot === 'slice') {
      startFreq = 460;
      endFreq = 185;
      bodyDur = 0.16;
    } else if (normShot === 'lob') {
      startFreq = 250;
      endFreq = 165;
      bodyDur = 0.19;
    } else if (isSmash) {
      startFreq = 395;
      endFreq = 98;
      bodyDur = 0.21;
    }

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc2.detune.setValueAtTime(12, now); // +12 cents chorusing warmth

    osc1.frequency.setValueAtTime(startFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(endFreq, now + bodyDur);
    osc2.frequency.setValueAtTime(startFreq * 1.5, now);
    osc2.frequency.exponentialRampToValueAtTime(endFreq, now + bodyDur * 0.85);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.001, now);
    bodyGain.gain.linearRampToValueAtTime(isSmash ? 0.13 : 0.095, now + 0.006);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + bodyDur);

    osc1.connect(bodyGain);
    osc2.connect(bodyGain);
    bodyGain.connect(this.sfxGain);
    if (this.reverbSend) bodyGain.connect(this.reverbSend);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + bodyDur + 0.01);
    osc2.stop(now + bodyDur + 0.01);

    // Layer 3: Sparkling Major-Chord Arpeggio Chime on Sweet-Spot / Power Smash hits
    if (isPerfect) {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const t0 = now + idx * 0.026;
        const chimeA = ctx.createOscillator();
        const chimeB = ctx.createOscillator();
        chimeA.type = 'sine';
        chimeB.type = 'triangle';
        chimeB.detune.setValueAtTime(10, t0);
        chimeA.frequency.setValueAtTime(freq, t0);
        chimeB.frequency.setValueAtTime(freq, t0);

        const cGain = ctx.createGain();
        cGain.gain.setValueAtTime(0.001, t0);
        cGain.gain.linearRampToValueAtTime(0.048, t0 + 0.006);
        cGain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.24);

        chimeA.connect(cGain);
        chimeB.connect(cGain);
        cGain.connect(this.sfxGain);
        if (this.reverbSend) cGain.connect(this.reverbSend);

        chimeA.start(t0);
        chimeB.start(t0);
        chimeA.stop(t0 + 0.25);
        chimeB.stop(t0 + 0.25);
      });
    }
  }

  /**
   * 3. `playBallBounce()`:
   * Low-pass turf thump (`140Hz -> 55Hz`) + soft grass cushion brush.
   */
  playBallBounce(intensity = 1.0) {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainScale = Math.max(0.4, Math.min(1.2, Number(intensity || 1.0)));

    // Low-end grass court thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.095);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11 * gainScale, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.11);

    // Subtle filtered turf brush transient
    if (this._pinkNoiseBuffer) {
      const turf = ctx.createBufferSource();
      turf.buffer = this._pinkNoiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(950, now);
      const tGain = ctx.createGain();
      tGain.gain.setValueAtTime(0.001, now);
      tGain.gain.linearRampToValueAtTime(0.045 * gainScale, now + 0.004);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      turf.connect(lp).connect(tGain).connect(this.sfxGain);
      turf.start(now, Math.random() * 0.4, 0.05);
    }
  }

  /**
   * 4. `playNetCord()`:
   * Dull nylon cord thud (`95Hz -> 42Hz`) with damped mesh rattle.
   */
  playNetCord() {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(98, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.13);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(360, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(lp).connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);

    if (this._noiseBuffer) {
      const cord = ctx.createBufferSource();
      cord.buffer = this._noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(620, now);
      bp.Q.setValueAtTime(2.2, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(0.065, now + 0.005);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      cord.connect(bp).connect(nGain).connect(this.sfxGain);
      cord.start(now, 0.1, 0.085);
    }
  }

  /**
   * 5. `playServeToss()`:
   * Smooth rising pitch whistle/slide (`290Hz -> 680Hz`) signaling upward ball toss.
   */
  playServeToss() {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const dur = 0.22;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc2.detune.setValueAtTime(9, now);

    osc1.frequency.setValueAtTime(290, now);
    osc1.frequency.exponentialRampToValueAtTime(680, now + dur);
    osc2.frequency.setValueAtTime(290, now);
    osc2.frequency.exponentialRampToValueAtTime(680, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.01);
    osc2.stop(now + dur + 0.01);
  }

  /**
   * 6. `playCrowdReaction(type)`:
   * Multi-layered filtered pink/white noise applause + harmonic crowd cheer swell
   * (`'cheer'`, `'gasp'`, `'polite_clap'`).
   */
  playCrowdReaction(type = 'cheer') {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx || !this._pinkNoiseBuffer) return;

    const now = ctx.currentTime;
    const kind = String(type || 'cheer').toLowerCase();

    if (kind === 'gasp' || kind === 'ooh') {
      const dur = 0.55;
      const noise = ctx.createBufferSource();
      noise.buffer = this._pinkNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.setValueAtTime(2.4, now);
      bp.frequency.setValueAtTime(720, now);
      bp.frequency.exponentialRampToValueAtTime(410, now + dur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(bp).connect(gain).connect(this.sfxGain);
      if (this.reverbSend) gain.connect(this.reverbSend);
      noise.start(now, 0, dur + 0.05);
      return;
    }

    const dur = kind === 'polite_clap' ? 0.85 : 1.35;

    // Layer 1: Warm stadium roar / applause swell (filtered pink noise)
    const roar = ctx.createBufferSource();
    roar.buffer = this._pinkNoiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.1, now);
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.exponentialRampToValueAtTime(1250, now + dur * 0.35);
    filter.frequency.exponentialRampToValueAtTime(780, now + dur);

    const rGain = ctx.createGain();
    rGain.gain.setValueAtTime(0.001, now);
    rGain.gain.linearRampToValueAtTime(kind === 'polite_clap' ? 0.075 : 0.115, now + 0.14);
    rGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    roar.connect(filter).connect(rGain).connect(this.sfxGain);
    if (this.reverbSend) rGain.connect(this.reverbSend);
    roar.start(now, 0, dur + 0.05);

    // Layer 2: Individual rhythmic handclap micro-transients
    const clapCount = kind === 'polite_clap' ? 10 : 18;
    for (let i = 0; i < clapCount; i++) {
      const tOffset = now + 0.03 + (i / clapCount) * (dur * 0.78) + (Math.random() * 0.035);
      const clap = ctx.createBufferSource();
      clap.buffer = this._noiseBuffer;
      const cFilter = ctx.createBiquadFilter();
      cFilter.type = 'bandpass';
      cFilter.frequency.setValueAtTime(1400 + Math.random() * 900, tOffset);
      cFilter.Q.setValueAtTime(1.9, tOffset);

      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.001, tOffset);
      cGain.gain.linearRampToValueAtTime(0.038, tOffset + 0.003);
      cGain.gain.exponentialRampToValueAtTime(0.001, tOffset + 0.026);

      clap.connect(cFilter).connect(cGain).connect(this.sfxGain);
      clap.start(tOffset, Math.random() * 0.8, 0.03);
    }

    // Layer 3: Subtle major triad stadium horn/pad warmth on full cheers
    if (kind === 'cheer') {
      const chord = [261.63, 329.63, 392.00]; // C4, E4, G4
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.detune.setValueAtTime((idx - 1) * 11, now);
        osc.frequency.setValueAtTime(freq, now);

        const oGain = ctx.createGain();
        oGain.gain.setValueAtTime(0.001, now);
        oGain.gain.linearRampToValueAtTime(0.025, now + 0.12);
        oGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.75);

        osc.connect(oGain).connect(this.sfxGain);
        if (this.reverbSend) oGain.connect(this.reverbSend);
        osc.start(now);
        osc.stop(now + 0.78);
      });
    }
  }

  /**
   * 7. `announceScore(text, options)`:
   * Plays pre-generated Gemini 3.8 Flash TTS (`gemini-3.8-flash-tts`) umpire & announcer
   * audio clips (`./assets/audio/tts/*.mp3`) backed by a musical scoreboard chime cadence.
   */
  announceScore(text, { delayMs = 0, playChime = true } = {}) {
    if (this.muted || !text) return;
    const cleanText = String(text).trim();
    const ctx = this._ensureContext();

    // Play signature scoreboard chime cadence
    if (ctx && playChime) {
      const now = ctx.currentTime + delayMs / 1000;
      const isHighStakes = /game|match|deuce|win|nice|power|smash/i.test(cleanText);
      const notes = isHighStakes
        ? [587.33, 739.99, 880.00] // D5 -> F#5 -> A5
        : [523.25, 659.25];        // C5 -> E5

      notes.forEach((freq, idx) => {
        const t0 = now + idx * 0.065;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc2.detune.setValueAtTime(10, t0);
        osc1.frequency.setValueAtTime(freq, t0);
        osc2.frequency.setValueAtTime(freq, t0);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.055, t0 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.24);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);
        if (this.reverbSend) gain.connect(this.reverbSend);

        osc1.start(t0);
        osc2.start(t0);
        osc1.stop(t0 + 0.26);
        osc2.stop(t0 + 0.26);
      });
    }

    this.playVoiceCallout(cleanText, { delayMs, clearQueue: delayMs === 0 });
  }

  /**
   * Plays a pre-generated Gemini 3.8 Flash TTS clip by key or score string.
   */
  playVoiceCallout(keyOrText, { delayMs = 0, clearQueue = false } = {}) {
    if (this.muted || !keyOrText) return;
    const lookupKey = String(keyOrText).trim().toLowerCase();
    const clipUrl = GEMINI_TTS_CLIPS[lookupKey];

    if (clearQueue && this._voiceTimers.length > 0) {
      this._voiceTimers.forEach((t) => clearTimeout(t));
      this._voiceTimers = [];
    }

    const triggerPlayback = () => {
      if (this.muted) return;
      if (clipUrl) {
        try {
          if (this._activeVoiceAudio && !this._activeVoiceAudio.paused) {
            this._activeVoiceAudio.pause();
            this._activeVoiceAudio.currentTime = 0;
          }
          let audio = this.ttsAudioElements.get(clipUrl);
          if (!audio) {
            audio = new Audio(clipUrl);
            this.ttsAudioElements.set(clipUrl, audio);
          }
          audio.currentTime = 0;
          audio.volume = Math.min(1, this.sfxVolume * 0.98);
          this._activeVoiceAudio = audio;
          audio.play().catch(() => {});
          return;
        } catch (_) {
          // Fallback below if Audio playback fails
        }
      }

      // Fallback for any custom dynamic text
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const spoken = String(keyOrText)
            .replace(/\b00\b/g, 'Love')
            .replace(/\s*-\s*/g, ' ')
            .replace(/!/g, '');
          const utter = new SpeechSynthesisUtterance(spoken);
          utter.rate = 1.06;
          utter.pitch = 1.04;
          utter.volume = Math.min(1, this.sfxVolume * 0.9);
          window.speechSynthesis.speak(utter);
        } catch (_) {}
      }
    };

    if (delayMs > 0) {
      const timerId = setTimeout(triggerPlayback, delayMs);
      this._voiceTimers.push(timerId);
    } else {
      triggerPlayback();
    }
  }

  /**
   * Subtle UI button click feedback.
   */
  playUiClick() {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.045);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }
}

export default AudioEngine;
