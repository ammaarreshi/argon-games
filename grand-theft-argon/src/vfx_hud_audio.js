import * as THREE from '../assets/vendor/three.module.js';

/**
 * Grand Theft Argon: Argon City Stories / Grand Theft Argon — 3D Cel-Shaded VFX, Comic HUD & Spatial Audio Engine
 * Three.js r160 ES Module
 *
 * Implements:
 * 1. Grand Theft Argon + Argon City Comic HUD Overlay (Canvas2D + Interactive Hit Regions):
 *    - Top-Right HUD Cluster:
 *      a) Yellow Pager Envelope Icon with bold black comic outline & unread badge count ('59')
 *      b) Day & 24h Clock ('Tue 02:01') + Cash Counter ('$25,400')
 *      c) 5 Golden 6-Pointed Sheriff/Police Wanted Stars with pulsing glow
 *      d) Police Cruiser Silhouette Takedown Row directly below Wanted Stars with Crimson Red 'X' stamps
 *      e) Dual Weapon & Throwable Cluster (Grenade/Molotov + 9 custom comic weapon illustrations & ammo '580-0')
 *    - 1980s Neon Radial Weapon Wheel (Hold Q or click Weapon icon)
 *    - Bottom-Left Circular Radar Minimap (168x168px) with crimson city blocks (#d82236), charcoal streets (#23262e),
 *      teal water (#134b5f), Green Health left arc, Cyan Armor right arc, orbiting 'N' North badge,
 *      Safehouse house icon, Cyan Gas Pump icon, 'K' Dealer markers, Rampage skulls, Police blips & Player arrow
 *    - Top-Left Arcade Callout Feed ('NEAR MISS', 'COP TAKEDOWN!', 'DRIFT BONUS!', '2X CHAIN!')
 *    - Bottom-Right District Stencil Banner ('OCEAN BEACH', etc.) & Neon Radio Station Ticker ('♪ WAVE 103')
 *    - Responsive Touch / Mobile Virtual Controls (Left stick, Right aim/fire pad, Comic action buttons)
 * 2. Pre-Allocated Zero-Stall 3D Cel-Shaded VFX & Particle Pools (Zero dynamic PointLights):
 *    - Multi-lobed cel-shaded fireball explosions, flat shockwave ground rings, flying debris & 'KABOOM!' popups
 *    - 4x4 Molotov expanding neon-orange ground fire grid with burn damage query API
 *    - Comic star muzzle flashes, bright yellow-orange gun tracers, crimson blood decals & collision sparks
 * 3. Spatial Web Audio Engine (ViceAudioEngine):
 *    - Loads static pre-generated Lyria 3 radio tracks & Gemini TTS voice clips with static web inline data-URI support
 *    - Web Audio police radio bandpass/squelch filter + synthesized 80s fallback loop & procedural SFX
 */

// ============================================================================
// WEAPON & RADIO CATALOG DEFINITIONS
// ============================================================================

export const WEAPON_CATALOG = [
  {
    id: 'fists',
    aliases: ['fists', 'unarmed', 'brass_knuckles', 'knuckles', 'melee', 'fist'],
    name: 'BRASS KNUCKLES',
    shortName: 'KNUCKLES',
    defaultAmmo: '∞',
    slot: 0,
    sfx: 'melee',
  },
  {
    id: 'katana',
    aliases: ['katana', 'sword', 'blade'],
    name: 'ARGON KATANA',
    shortName: 'KATANA',
    defaultAmmo: '∞',
    slot: 1,
    sfx: 'katana',
  },
  {
    id: 'stun_baton',
    aliases: ['stun_baton', 'baton', 'taser', 'shock_baton'],
    name: 'NEON SHOCK BATON',
    shortName: 'SHOCK BATON',
    defaultAmmo: '∞',
    slot: 2,
    sfx: 'stun_baton',
  },
  {
    id: 'revolver',
    aliases: ['revolver', 'pistol', 'python', 'colt', 'handgun', 'magnum'],
    name: 'COLT PYTHON .357',
    shortName: 'PYTHON .357',
    defaultAmmo: '144-6',
    slot: 3,
    sfx: 'revolver',
  },
  {
    id: 'mac10',
    aliases: ['mac10', 'smg', 'uzi', 'micro_smg', 'mac-10', 'submachine'],
    name: 'MAC-10 MICRO-SMG',
    shortName: 'MAC-10',
    defaultAmmo: '580-0',
    slot: 4,
    sfx: 'mac10',
  },
  {
    id: 'shotgun',
    aliases: ['shotgun', 'stubby', 'pump', 'sawed_off'],
    name: 'STUBBY SHOTGUN',
    shortName: 'SHOTGUN',
    defaultAmmo: '64-2',
    slot: 5,
    sfx: 'shotgun',
  },
  {
    id: 'm16',
    aliases: ['m16', 'rifle', 'assault_rifle', 'ar15', 'carbine'],
    name: 'M16 ASSAULT RIFLE',
    shortName: 'M16 RIFLE',
    defaultAmmo: '601-2',
    slot: 6,
    sfx: 'm16',
  },
  {
    id: 'flamethrower',
    aliases: ['flamethrower', 'flame', 'burner'],
    name: 'FLAMETHROWER',
    shortName: 'FLAMER',
    defaultAmmo: '250-0',
    slot: 7,
    sfx: 'flamethrower',
  },
  {
    id: 'rpg',
    aliases: ['rpg', 'rocket', 'rocket_launcher', 'bazooka', 'RPG'],
    name: 'RPG-7 LAUNCHER',
    shortName: 'RPG-7',
    defaultAmmo: '12-1',
    slot: 8,
    sfx: 'rpg',
  },
];

export const RADIO_STATIONS = [
  {
    id: 'wave_103',
    name: 'WAVE 103',
    genre: '80s Synth-Pop & New Wave',
    src: './assets/audio/radio/wave_103.mp3',
    djIntro: 'dj_wave_intro',
    color: '#00f0ff',
    bpm: 118,
    rootNote: 220, // A3
    chordProg: [0, 8, 3, 10], // Am - F - C - G
  },
  {
    id: 'flash_fm',
    name: 'FLASH FM',
    genre: 'Upbeat 80s Dance Pop',
    src: './assets/audio/radio/flash_fm.mp3',
    djIntro: 'dj_flash_intro',
    color: '#ff2a85',
    bpm: 126,
    rootNote: 261.63, // C4
    chordProg: [0, 5, 9, 7], // C - F - Am - G
  },
  {
    id: 'emotion_983',
    name: 'EMOTION 98.3',
    genre: 'Sunset Power Ballads',
    src: './assets/audio/radio/emotion_983.mp3',
    djIntro: null,
    color: '#ffb800',
    bpm: 92,
    rootNote: 196.0, // G3
    chordProg: [0, 9, 5, 7], // G - Em - C - D
  },
  {
    id: 'v_rock',
    name: 'V-ROCK',
    genre: 'Hard Rock & Heavy Metal',
    src: './assets/audio/radio/v_rock.mp3',
    djIntro: null,
    color: '#ff3b30',
    bpm: 142,
    rootNote: 164.81, // E3
    chordProg: [0, 3, 5, 7], // E5 - G5 - A5 - B5
  },
  {
    id: 'off',
    name: 'RADIO OFF',
    genre: 'ACPD Scanner Only',
    src: null,
    djIntro: null,
    color: '#8e99ad',
    bpm: 0,
    rootNote: 0,
    chordProg: [0],
  },
];

export const VOICE_CLIPS = {
  protag_carjack: {
    file: 'protag_carjack_01',
    speaker: 'RICO',
    subtitle: 'Step out of the car, pal. I need these keys more than you do.',
    isDispatch: false,
    category: 'protag',
  },
  protag_carjack_01: {
    file: 'protag_carjack_01',
    speaker: 'RICO',
    subtitle: 'Step out of the car, pal. I need these keys more than you do.',
    isDispatch: false,
    category: 'protag',
  },
  protag_carjack_02: {
    file: 'protag_carjack_02',
    speaker: 'RICO',
    subtitle: 'Nice ride. Take a walk down Ocean Drive while I borrow the wheel.',
    isDispatch: false,
    category: 'protag',
  },
  protag_carjack_03: {
    file: 'protag_carjack_03',
    speaker: 'RICO',
    subtitle: "Don't play hero. Step onto the curb and nobody gets hurt.",
    isDispatch: false,
    category: 'protag',
  },
  protag_carjack_04: {
    file: 'protag_carjack_04',
    speaker: 'RICO',
    subtitle: 'Consider this vehicle requisitioned for Argon City business.',
    isDispatch: false,
    category: 'protag',
  },
  protag_takedown: {
    file: 'protag_takedown_01',
    speaker: 'RICO',
    subtitle: "That's one less ACPD cruiser on my tail.",
    isDispatch: false,
    category: 'protag',
  },
  protag_takedown_01: {
    file: 'protag_takedown_01',
    speaker: 'RICO',
    subtitle: "That's one less ACPD cruiser on my tail.",
    isDispatch: false,
    category: 'protag',
  },
  protag_takedown_02: {
    file: 'protag_takedown_02',
    speaker: 'RICO',
    subtitle: 'Tell Metro Squad to send a tow truck to Ocean Beach.',
    isDispatch: false,
    category: 'protag',
  },
  protag_takedown_03: {
    file: 'protag_takedown_03',
    speaker: 'RICO',
    subtitle: "Cops can't hold a line in the corners. Stay in the rearview.",
    isDispatch: false,
    category: 'protag',
  },
  protag_takedown_04: {
    file: 'protag_takedown_04',
    speaker: 'RICO',
    subtitle: 'Scrap metal. Keep sending patrol cars if you want the fleet wrecked.',
    isDispatch: false,
    category: 'protag',
  },
  protag_escape: {
    file: 'protag_escape_01',
    speaker: 'RICO',
    subtitle: "Lost 'em in the neon. Heat's off, back to business.",
    isDispatch: false,
    category: 'protag',
  },
  protag_escape_01: {
    file: 'protag_escape_01',
    speaker: 'RICO',
    subtitle: "Lost 'em in the neon. Heat's off, back to business.",
    isDispatch: false,
    category: 'protag',
  },
  protag_escape_02: {
    file: 'protag_escape_02',
    speaker: 'RICO',
    subtitle: 'ACPD is chasing ghosts now. Clear roads ahead.',
    isDispatch: false,
    category: 'protag',
  },
  protag_deal: {
    file: 'protag_deal_01',
    speaker: 'RICO',
    subtitle: 'Pure Starfish Island merchandise. Count the bills and keep it quiet.',
    isDispatch: false,
    category: 'protag',
  },
  protag_deal_01: {
    file: 'protag_deal_01',
    speaker: 'RICO',
    subtitle: 'Pure Starfish Island merchandise. Count the bills and keep it quiet.',
    isDispatch: false,
    category: 'protag',
  },
  protag_deal_02: {
    file: 'protag_deal_02',
    speaker: 'RICO',
    subtitle: 'Clean weight, clean cash. Pleasure doing business in Argon City.',
    isDispatch: false,
    category: 'protag',
  },
  protag_rampage: {
    file: 'protag_rampage_01',
    speaker: 'RICO',
    subtitle: 'You picked the wrong boulevard to start a war.',
    isDispatch: false,
    category: 'protag',
  },
  protag_rampage_01: {
    file: 'protag_rampage_01',
    speaker: 'RICO',
    subtitle: 'You picked the wrong boulevard to start a war.',
    isDispatch: false,
    category: 'protag',
  },
  protag_rampage_02: {
    file: 'protag_rampage_02',
    speaker: 'RICO',
    subtitle: "Lock and load. Let's clear out this turf once and for all.",
    isDispatch: false,
    category: 'protag',
  },
  cartel_taunt: {
    file: 'cartel_taunt',
    speaker: 'CARTEL',
    subtitle: 'You stepped on Diaz turf! Light him up!',
    isDispatch: false,
  },
  dispatch_ocean_drive: {
    file: 'dispatch_ocean_drive',
    speaker: 'ACPD DISPATCH',
    subtitle: '[10-31] All units: suspect tearing down Ocean Drive!',
    isDispatch: true,
  },
  dispatch_swat: {
    file: 'dispatch_swat',
    speaker: 'ACPD DISPATCH',
    subtitle: '[CODE 3] Deploy ACPD Enforcers & roadblocks immediately!',
    isDispatch: true,
  },
  dispatch_boat: {
    file: 'dispatch_boat',
    speaker: 'ACPD DISPATCH',
    subtitle: '[MARINE 1] Suspect watercraft high-speed in Argon Bay!',
    isDispatch: true,
  },
  dj_flash_intro: {
    file: 'dj_flash_intro',
    speaker: 'TONI (FLASH FM)',
    subtitle: '♪ You are locked into Flash FM — music for the 80s generation!',
    isDispatch: false,
  },
  dj_wave_intro: {
    file: 'dj_wave_intro',
    speaker: 'ADAM FIRST (WAVE 103)',
    subtitle: '♪ Wave 103 — where Argon City catches the new wave!',
    isDispatch: false,
  },
  // Ambient Pass-By Street Chatter (ped_chat_01..ped_chat_06 + alias ped_chat)
  ped_chat: {
    file: 'ped_chat_01',
    speaker: 'WALL ST YUPPIE',
    subtitle: "Buy synthetic, dump savings and loans! Look pal, I'm closing a million-dollar condo on my Motorola brick phone!",
    isDispatch: false,
    category: 'ped_chat',
  },
  ped_chat_01: {
    file: 'ped_chat_01',
    speaker: 'WALL ST YUPPIE',
    subtitle: "Buy synthetic, dump savings and loans! Look pal, I'm closing a million-dollar condo on my Motorola brick phone!",
    isDispatch: false,
    category: 'ped_chat',
  },
  ped_chat_02: {
    file: 'ped_chat_02',
    speaker: 'MIAMI LOCAL',
    subtitle: "Everyone who's anyone is heading to the Malibu Club tonight. If you're not wearing pastel linen, don't even bother!",
    isDispatch: false,
    category: 'ped_chat',
  },
  ped_chat_03: {
    file: 'ped_chat_03',
    speaker: 'MIAMI LOCAL',
    subtitle: 'Two cafecitos and a crate of Cohibas, hermano. Best afternoon on Ocean Drive if the Metro Squad stays away.',
    isDispatch: false,
    category: 'ped_chat',
  },
  ped_chat_04: {
    file: 'ped_chat_04',
    speaker: 'BEACH SKATER',
    subtitle: "Fresh batteries in the Walkman and Flash FM on the dial—nobody's ruining my Ocean Beach groove today!",
    isDispatch: false,
    category: 'ped_chat',
  },
  ped_chat_05: {
    file: 'ped_chat_05',
    speaker: 'MIAMI LOCAL',
    subtitle: "Another day in paradise... eighty-eight degrees in the shade and every tourist thinks they're on Argon Nights.",
    isDispatch: false,
    category: 'ped_chat',
  },
  ped_chat_06: {
    file: 'ped_chat_06',
    speaker: 'WALL ST YUPPIE',
    subtitle: 'My husband parked his yacht at the Marina and bought two Italian sports cars before breakfast. Only in Argon City!',
    isDispatch: false,
    category: 'ped_chat',
  },
  // Startled / Sidewalk Dodge (ped_panic_01..ped_panic_03 + alias ped_panic)
  ped_panic: {
    file: 'ped_panic_01',
    speaker: 'BEACH SKATER',
    subtitle: 'Watch the sidewalk, maniac! You almost clipped my neon rollerblades!',
    isDispatch: false,
    category: 'ped_panic',
  },
  ped_panic_01: {
    file: 'ped_panic_01',
    speaker: 'BEACH SKATER',
    subtitle: 'Watch the sidewalk, maniac! You almost clipped my neon rollerblades!',
    isDispatch: false,
    category: 'ped_panic',
  },
  ped_panic_02: {
    file: 'ped_panic_02',
    speaker: 'MIAMI LOCAL',
    subtitle: 'Are you out of your mind?! This is an Art Deco promenade, not the Daytona Five Hundred!',
    isDispatch: false,
    category: 'ped_panic',
  },
  ped_panic_03: {
    file: 'ped_panic_03',
    speaker: 'WALL ST YUPPIE',
    subtitle: 'Easy on the throttle, pal! Somebody call ACPD before he flattens the whole boulevard!',
    isDispatch: false,
    category: 'ped_panic',
  },
  // Bumped / Carjacked / Insult (ped_insult_01..ped_insult_03 + alias ped_insult)
  ped_insult: {
    file: 'ped_insult_01',
    speaker: 'WALL ST YUPPIE',
    subtitle: 'Hey! Watch the Italian linen suit, pal! Do you have any idea what dry cleaning costs on Ocean Beach?!',
    isDispatch: false,
    category: 'ped_insult',
  },
  ped_insult_01: {
    file: 'ped_insult_01',
    speaker: 'WALL ST YUPPIE',
    subtitle: 'Hey! Watch the Italian linen suit, pal! Do you have any idea what dry cleaning costs on Ocean Beach?!',
    isDispatch: false,
    category: 'ped_insult',
  },
  ped_insult_02: {
    file: 'ped_insult_02',
    speaker: 'MIAMI LOCAL',
    subtitle: "Hey, watch the paint job, amigo! That's a classic V8 you're messing with!",
    isDispatch: false,
    category: 'ped_insult',
  },
  ped_insult_03: {
    file: 'ped_insult_03',
    speaker: 'WALL ST YUPPIE',
    subtitle: 'He just yanked me right out of my leased convertible! My designer sunglasses are still on the dash!',
    isDispatch: false,
    category: 'ped_insult',
  },
};

export const VOICE_CATEGORY_POOLS = {
  protag_carjack: ['protag_carjack_01', 'protag_carjack_02', 'protag_carjack_03', 'protag_carjack_04'],
  protag_takedown: ['protag_takedown_01', 'protag_takedown_02', 'protag_takedown_03', 'protag_takedown_04'],
  protag_escape: ['protag_escape_01', 'protag_escape_02'],
  protag_deal: ['protag_deal_01', 'protag_deal_02'],
  protag_rampage: ['protag_rampage_01', 'protag_rampage_02'],
  ped_chat: ['ped_chat_01', 'ped_chat_02', 'ped_chat_03', 'ped_chat_04', 'ped_chat_05', 'ped_chat_06'],
  ped_panic: ['ped_panic_01', 'ped_panic_02', 'ped_panic_03'],
  ped_insult: ['ped_insult_01', 'ped_insult_02', 'ped_insult_03'],
};

// Default Argon City map layout for the Grand Theft Argon circular radar minimap
const DEFAULT_CITY_BLOCKS = [
  // Ocean Beach (East Island)
  { x: 68, z: -135, w: 32, d: 44, district: 'OCEAN BEACH' },
  { x: 68, z: -75, w: 32, d: 46, district: 'OCEAN BEACH' },
  { x: 68, z: -15, w: 32, d: 46, district: 'OCEAN BEACH' },
  { x: 68, z: 45, w: 32, d: 46, district: 'OCEAN BEACH' },
  { x: 68, z: 105, w: 32, d: 46, district: 'OCEAN BEACH' },
  { x: 24, z: -135, w: 30, d: 44, district: 'WASHINGTON BEACH' },
  { x: 24, z: -75, w: 30, d: 46, district: 'WASHINGTON BEACH' },
  { x: 24, z: -15, w: 30, d: 46, district: 'OCEAN BEACH' },
  { x: 24, z: 45, w: 30, d: 46, district: 'OCEAN BEACH' },
  { x: 24, z: 105, w: 30, d: 46, district: 'OCEAN BEACH' },
  // Starfish Island (Center Mansion Island)
  { x: -25, z: -20, w: 34, d: 28, district: 'STARFISH ISLAND' },
  { x: -25, z: 22, w: 34, d: 26, district: 'STARFISH ISLAND' },
  // Little Haiti & Argon Port Marina (West Mainland)
  { x: -78, z: -135, w: 34, d: 44, district: 'LITTLE HAITI' },
  { x: -78, z: -75, w: 34, d: 46, district: 'LITTLE HAITI' },
  { x: -78, z: -15, w: 34, d: 46, district: 'LITTLE HAITI' },
  { x: -78, z: 45, w: 34, d: 46, district: 'ARGON PORT MARINA' },
  { x: -78, z: 105, w: 34, d: 46, district: 'ARGON PORT MARINA' },
  { x: -124, z: -135, w: 34, d: 44, district: 'LITTLE HAITI' },
  { x: -124, z: -75, w: 34, d: 46, district: 'LITTLE HAITI' },
  { x: -124, z: -15, w: 34, d: 46, district: 'LITTLE HAITI' },
  { x: -124, z: 45, w: 34, d: 46, district: 'ARGON PORT MARINA' },
  { x: -124, z: 105, w: 34, d: 46, district: 'ARGON PORT MARINA' },
];

const DEFAULT_BRIDGES = [
  { x: -2, z: 0, w: 24, d: 14 },
  { x: -51, z: 0, w: 24, d: 14 },
  { x: -26, z: -95, w: 68, d: 12 },
  { x: -26, z: 95, w: 68, d: 12 },
];

const DEFAULT_POIS = {
  safehouses: [
    { x: 74, z: 48, label: 'Ocean View Safehouse' },
    { x: -25, z: -18, label: 'Starfish Estate' },
  ],
  gasStations: [
    { x: 26, z: -18, label: 'Ocean Gas & Pay-Spray' },
    { x: -76, z: 42, label: 'Little Haiti Fuel' },
  ],
  dealers: [
    { x: 32, z: -68, label: 'Kurt (Synth Runner)' },
    { x: 62, z: 98, label: 'Rico (Pier Contact)' },
    { x: -22, z: 24, label: 'Marco (Island Dealer)' },
    { x: -82, z: -64, label: 'Zoe (Haiti Contact)' },
  ],
  rampages: [
    { x: 84, z: -12, label: 'Ocean Drive Rampage' },
    { x: -72, z: -12, label: 'Boulevard Rampage' },
  ],
};

// ============================================================================
// SPATIAL WEB AUDIO ENGINE (STATIC PRE-GENERATED ASSETS + SYNTH FALLBACKS)
// ============================================================================

export class ViceAudioEngine {
  constructor(onSubtitleCallback = null) {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.voiceGain = null;
    this.dispatchFilter = null;
    this.dispatchShaper = null;

    this.unlocked = false;
    this.muted = false;
    this.onSubtitle = onSubtitleCallback;

    // Radio state
    this.stationIndex = 0; // Default: WAVE 103
    this.radioElements = new Map();
    this.currentRadioAudio = null;
    this.synthRadioTimer = 0;
    this.synthStepIndex = 0;

    // Voice buffers / elements cache & strict anti-repetition cooldowns
    this.voiceBuffers = new Map();
    this.voiceElements = new Map();
    this.lastVoiceTime = -999;
    this.voiceCooldown = 1.6;
    this.lastProtagVoiceTime = -999;
    this.lastPedVoiceTime = -999;
    this.lastPedChatVoiceTime = -999;
    this.lastDispatchVoiceTime = -999;
    this.poolCursors = new Map();
    this.poolHistory = new Map();
    this.recentProtagClips = [];
    this.recentPedClips = [];
    this.lastResolvedClip = null;
    this.activeVoiceAudio = null;

    // Continuous procedural vehicle & siren nodes
    this.engineOsc = null;
    this.engineSubOsc = null;
    this.engineGain = null;
    this.screechGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;

    this._setupUnlockListeners();
    this._preloadStaticAudioCatalog();
  }

  _setupUnlockListeners() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (!this.unlocked && this.ctx && this.ctx.state === 'running') {
        this.unlocked = true;
        this._startRadioPlaybackForCurrentStation();
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  ensureContext() {
    if (this.ctx || typeof window === 'undefined') return this.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.36;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.65;
      this.sfxGain.connect(this.masterGain);

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = 0.92;
      this.voiceGain.connect(this.masterGain);

      // Police Dispatch Bandpass + Radio Overdrive chain
      this.dispatchFilter = this.ctx.createBiquadFilter();
      this.dispatchFilter.type = 'bandpass';
      this.dispatchFilter.frequency.value = 1450;
      this.dispatchFilter.Q.value = 2.4;

      this.dispatchShaper = this.ctx.createWaveShaper();
      this.dispatchShaper.curve = this._makeRadioDistortionCurve(35);
      this.dispatchShaper.oversample = '2x';

      this.dispatchFilter.connect(this.dispatchShaper);
      this.dispatchShaper.connect(this.voiceGain);

      this._initContinuousLoops();
    } catch (_) {
      this.ctx = null;
    }
    return this.ctx;
  }

  _makeRadioDistortionCurve(amount = 30) {
    const samples = 256;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  _initContinuousLoops() {
    if (!this.ctx) return;

    // 1. Car Engine dual-oscillator loop
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0001;

    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 340;

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 58;

    this.engineSubOsc = this.ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.value = 29;

    this.engineOsc.connect(engineFilter);
    this.engineSubOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc.start();
    this.engineSubOsc.start();

    // 2. Police Siren continuous oscillator
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0001;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 680;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.sfxGain);
    this.sirenOsc.start();
  }

  _preloadStaticAudioCatalog() {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    const inlineMap = window.__VC_INLINE_AUDIO__ || {};

    // Preload Radio MP3s
    for (const station of RADIO_STATIONS) {
      if (!station.src) continue;
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.loop = true;
        audio.volume = 0.42;
        audio.src = inlineMap[station.id] || station.src;
        audio.addEventListener('error', () => {
          audio.__vcLoadFailed = true;
        });
        this.radioElements.set(station.id, audio);
      } catch (_) {
        // Ignore offline/CORS restriction; synth fallback handles seamlessly
      }
    }

    // Preload Voice Clips (.wav with .mp3 / inline fallback)
    for (const key of Object.keys(VOICE_CLIPS)) {
      const clip = VOICE_CLIPS[key];
      const inlineUri = inlineMap[key] || inlineMap[clip.file];
      const wavSrc = inlineUri || `./assets/audio/voice/${clip.file}.wav`;
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = wavSrc;
        audio.addEventListener(
          'error',
          () => {
            if (!audio.__vcTriedMp3 && !inlineUri) {
              audio.__vcTriedMp3 = true;
              audio.src = `./assets/audio/voice/${clip.file}.mp3`;
            } else {
              audio.__vcLoadFailed = true;
            }
          },
          { passive: true }
        );
        this.voiceElements.set(key, audio);
      } catch (_) {}
    }
  }

  getCurrentRadioStation() {
    return RADIO_STATIONS[this.stationIndex] || RADIO_STATIONS[0];
  }

  cycleRadioStation() {
    const nextIndex = (this.stationIndex + 1) % RADIO_STATIONS.length;
    return this.setRadioStation(nextIndex);
  }

  setRadioStation(stationIdOrIndex) {
    let idx = 0;
    if (typeof stationIdOrIndex === 'number') {
      idx = ((stationIdOrIndex % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    } else if (typeof stationIdOrIndex === 'string') {
      const normalized = stationIdOrIndex.toLowerCase().replace(/[\s.-]+/g, '_');
      const found = RADIO_STATIONS.findIndex(
        (s) => s.id === normalized || s.name.toLowerCase().replace(/[\s.-]+/g, '_') === normalized
      );
      if (found >= 0) idx = found;
    }

    this.stationIndex = idx;
    const station = RADIO_STATIONS[this.stationIndex];

    // Play FM tuning static burst
    this.playSFX('radio_tune');

    // Stop any previous HTMLAudioElement radio stream
    if (this.currentRadioAudio) {
      try {
        this.currentRadioAudio.pause();
      } catch (_) {}
      this.currentRadioAudio = null;
    }

    this._startRadioPlaybackForCurrentStation();

    // Trigger DJ intro voiceover if station has one
    if (station.djIntro) {
      this.playVoice(station.djIntro, { force: true });
    }

    return station;
  }

  _startRadioPlaybackForCurrentStation() {
    const station = RADIO_STATIONS[this.stationIndex];
    if (!station || !station.src || this.muted) return;

    const audio = this.radioElements.get(station.id);
    if (audio && !audio.__vcLoadFailed) {
      this.currentRadioAudio = audio;
      try {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } catch (_) {}
    }
  }

  /**
   * Plays a pre-generated Gemini 3.8 Flash TTS clip with strict per-speaker cooldowns,
   * non-repeating shuffle pools for protagonist lines, and Web Audio bandpass/squelch
   * filtering on ACPD police dispatch calls.
   */
  playVoice(clipId, options = {}) {
    if (this.muted || !clipId) return false;

    const rawId = String(clipId);
    const isProtag = rawId.startsWith('protag_');
    const isPed = rawId.startsWith('ped_');
    const isPedChat = rawId.startsWith('ped_chat');
    const isDispatch = rawId.startsWith('dispatch_');

    const now = typeof performance !== 'undefined' ? performance.now() * 0.001 : 0;

    if (!options.force) {
      if (isProtag && now - this.lastProtagVoiceTime < 16.0) {
        return false;
      }
      if (isPed) {
        const pedCooldown = isPedChat ? 9.5 : 11.0;
        if (now - this.lastPedVoiceTime < pedCooldown) {
          return false;
        }
      }
      if (isDispatch && now - this.lastDispatchVoiceTime < 11.0) {
        return false;
      }
      if (now - this.lastVoiceTime < this.voiceCooldown) {
        return false;
      }
    }

    // Resolve category pool to a non-repeating clip variation (3-clip history buffer per pool)
    let resolvedKey = rawId;
    const pool = VOICE_CATEGORY_POOLS[rawId];
    if (Array.isArray(pool) && pool.length > 0) {
      let cursor = this.poolCursors.get(rawId) || 0;
      const poolHist = this.poolHistory.get(rawId) || [];
      const blockLimit = Math.min(3, Math.max(1, pool.length - 1));
      const recentSlice = poolHist.slice(-blockLimit);
      let chosen = pool[cursor % pool.length];
      for (let attempt = 0; attempt < pool.length; attempt++) {
        const candidate = pool[(cursor + attempt) % pool.length];
        if (!recentSlice.includes(candidate)) {
          chosen = candidate;
          cursor = (cursor + attempt + 1) % pool.length;
          break;
        }
      }
      this.poolCursors.set(rawId, cursor);
      poolHist.push(chosen);
      if (poolHist.length > 3) {
        poolHist.shift();
      }
      this.poolHistory.set(rawId, poolHist);
      resolvedKey = chosen;
    }

    if (isProtag) {
      this.lastProtagVoiceTime = now;
      this.recentProtagClips.push(resolvedKey);
      if (this.recentProtagClips.length > 3) {
        this.recentProtagClips.shift();
      }
    } else if (isPed) {
      this.lastPedVoiceTime = now;
      if (isPedChat) {
        this.lastPedChatVoiceTime = now;
      }
      this.recentPedClips.push(resolvedKey);
      if (this.recentPedClips.length > 3) {
        this.recentPedClips.shift();
      }
    } else if (isDispatch) {
      this.lastDispatchVoiceTime = now;
    }
    this.lastVoiceTime = now;

    const clip = VOICE_CLIPS[resolvedKey] || VOICE_CLIPS[rawId] || {
      file: resolvedKey,
      speaker: isProtag ? 'RICO' : isPed ? 'MIAMI LOCAL' : 'RADIO',
      subtitle: resolvedKey.replace(/_/g, ' ').toUpperCase(),
      isDispatch,
    };
    this.lastResolvedClip = clip;

    this.ensureContext();

    // Stop any currently playing voice audio element so two voices never overlap
    if (this.activeVoiceAudio) {
      try {
        this.activeVoiceAudio.pause();
        this.activeVoiceAudio.currentTime = 0;
      } catch (_) {}
      this.activeVoiceAudio = null;
    }

    if (clip.isDispatch) {
      this._playDispatchSquelch(true);
    }

    if (this.onSubtitle && clip.subtitle) {
      this.onSubtitle(clip.speaker, clip.subtitle, clip.isDispatch);
    }

    let audioEl = this.voiceElements.get(resolvedKey);
    if (!audioEl || audioEl.__vcLoadFailed) {
      audioEl = this.voiceElements.get(rawId);
    }

    if (audioEl && !audioEl.__vcLoadFailed) {
      try {
        // Connect through dispatch bandpass filter if Web Audio MediaElementSource is not yet bound
        if (clip.isDispatch && this.ctx && !audioEl.__vcSourceConnected && !audioEl.src.startsWith('http')) {
          try {
            const source = this.ctx.createMediaElementSource(audioEl);
            source.connect(this.dispatchFilter);
            audioEl.__vcSourceConnected = true;
          } catch (_) {}
        }
        audioEl.currentTime = 0;
        audioEl.volume = clip.isDispatch ? 0.95 : 0.9;
        this.activeVoiceAudio = audioEl;
        const p = audioEl.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            this._playSynthesizedVoiceCadence(clip);
          });
        }
        if (clip.isDispatch) {
          setTimeout(() => this._playDispatchSquelch(false), 1800);
        }
        return true;
      } catch (_) {}
    }

    // Fallback synthesized radio cadence if file is still decoding or offline
    this._playSynthesizedVoiceCadence(clip);
    return true;
  }

  _playDispatchSquelch(isStart = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Crisp police walkie-talkie beep + static burst
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isStart ? 1850 : 1420, t);
    osc.frequency.setValueAtTime(isStart ? 2350 : 1120, t + 0.04);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(this.dispatchFilter || this.sfxGain);
    gain.connect(this.sfxGain);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.095);
    this._playNoiseBurst(0.06, 1600, 0.12);
  }

  _playSynthesizedVoiceCadence(clip) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const syllables = clip.isDispatch ? 6 : 4;
    const baseFreq = clip.isDispatch ? 480 : 105; // Deep 105Hz baritone for non-dispatch
    for (let i = 0; i < syllables; i++) {
      const start = t + i * 0.095;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = clip.isDispatch ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq + ((i * 23) % 45), start);
      osc.frequency.linearRampToValueAtTime(baseFreq + ((i * 17) % 30), start + 0.075);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
      osc.connect(gain);
      gain.connect(clip.isDispatch && this.dispatchFilter ? this.dispatchFilter : this.voiceGain);
      osc.start(start);
      osc.stop(start + 0.085);
    }
  }

  _playNoiseBurst(duration = 0.12, filterFreq = 1200, volume = 0.25, filterType = 'bandpass') {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 1.35);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.4;

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    src.start(now);
    src.stop(now + duration);
  }

  /**
   * Procedural & Spatial SFX synthesizer for weapons, explosions, cars, cash & UI
   */
  playSFX(sfxId, options = {}) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const id = String(sfxId || 'gunshot').toLowerCase();
    const vol = Math.min(1.0, Math.max(0.05, options.volume ?? 1.0));

    if (id === 'mac10' || id === 'smg' || id === 'uzi' || id === 'gunshot') {
      // Rapid punchy SMG pop + metallic bolt click
      this._playNoiseBurst(0.075, 1650, 0.32 * vol, 'bandpass');
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.065);
      g.gain.setValueAtTime(0.28 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.072);
    } else if (id === 'revolver' || id === 'pistol' || id === 'python') {
      // Heavy .357 Magnum crack
      this._playNoiseBurst(0.14, 1200, 0.44 * vol, 'bandpass');
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.13);
      g.gain.setValueAtTime(0.38 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.135);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.14);
    } else if (id === 'shotgun') {
      // Deep booming 12-gauge blast
      this._playNoiseBurst(0.24, 720, 0.58 * vol, 'lowpass');
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(175, t);
      osc.frequency.exponentialRampToValueAtTime(34, t + 0.22);
      g.gain.setValueAtTime(0.45 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.24);
    } else if (id === 'm16' || id === 'rifle') {
      // Sharp high-velocity rifle crack
      this._playNoiseBurst(0.095, 2200, 0.38 * vol, 'bandpass');
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(390, t);
      osc.frequency.exponentialRampToValueAtTime(68, t + 0.085);
      g.gain.setValueAtTime(0.28 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.095);
    } else if (id === 'stun_baton' || id === 'baton') {
      // Crisp 1980s high-voltage neon stun baton electric zap
      this._playNoiseBurst(0.09, 3200, 0.22 * vol, 'bandpass');
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(640, t);
      osc.frequency.linearRampToValueAtTime(1180, t + 0.05);
      osc.frequency.linearRampToValueAtTime(420, t + 0.12);
      g.gain.setValueAtTime(0.22 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
    } else if (id === 'flamethrower' || id === 'fire' || id === 'molotov') {
      // Roaring flame whoosh
      this._playNoiseBurst(0.32, 540, 0.36 * vol, 'bandpass');
    } else if (id === 'rpg' || id === 'rocket') {
      // Rocket launch whoosh + ignition thump
      this._playNoiseBurst(0.38, 950, 0.45 * vol, 'bandpass');
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.28);
      g.gain.setValueAtTime(0.4 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.31);
    } else if (id === 'katana' || id === 'melee' || id === 'fists' || id === 'punch') {
      // Crisp blade slash / impact thwack
      this._playNoiseBurst(0.08, 2800, 0.28 * vol, 'highpass');
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(95, t + 0.08);
      g.gain.setValueAtTime(0.24 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.09);
    } else if (id === 'explosion' || id === 'kaboom') {
      // Massive sub-bass detonation + debris crackle
      this._playNoiseBurst(0.75, 380, 0.72 * vol, 'lowpass');
      this._playNoiseBurst(0.45, 1450, 0.38 * vol, 'bandpass');
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(125, t);
      osc.frequency.exponentialRampToValueAtTime(22, t + 0.65);
      g.gain.setValueAtTime(0.68 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.68);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.7);
    } else if (id === 'car_crash' || id === 'crash' || id === 'sparks') {
      // Metallic crunch + high spark ping
      this._playNoiseBurst(0.22, 1100, 0.42 * vol, 'bandpass');
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(195, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.16);
      g.gain.setValueAtTime(0.32 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.19);
    } else if (id === 'cop_takedown' || id === 'takedown') {
      // Arcade brass/synth power chord stinger + crash
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const start = t + idx * 0.055;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.2 * vol, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    } else if (id === 'cash' || id === 'pickup' || id === 'deal') {
      // Crisp 80s arcade register chime
      const notes = [987.77, 1318.51];
      notes.forEach((freq, idx) => {
        const start = t + idx * 0.07;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.22 * vol, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(start);
        osc.stop(start + 0.19);
      });
    } else if (id === 'pager' || id === 'beep' || id === 'ui_click' || id === 'near_miss') {
      // Classic 80s Motorola pager two-tone beep
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(id === 'near_miss' ? 880 : 2048, t);
      osc.frequency.setValueAtTime(id === 'near_miss' ? 1174.66 : 2560, t + 0.06);
      g.gain.setValueAtTime(0.14 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.14);
    } else if (id === 'radio_tune') {
      this._playNoiseBurst(0.11, 2400, 0.18 * vol, 'bandpass');
    }
  }

  /**
   * Updates continuous vehicle RPM, drift tire screech, police wail siren, and
   * warm 80s synthesized fallback loop if static MP3 is still loading.
   */
  update(dt, gameState = {}) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;

    const now = this.ctx.currentTime;
    const inVehicle = Boolean(gameState.inVehicle || gameState.driving || gameState.currentVehicle);
    const inAircraft = Boolean(
      gameState.inAircraft ||
        gameState.currentVehicle?.isAircraft ||
        gameState.playerState?.currentVehicle?.isAircraft
    );
    const speed = Math.abs(
      gameState.speed ??
        gameState.vehicleSpeed ??
        gameState.currentVehicle?.speed ??
        0
    );
    const isDrifting = Boolean(
      gameState.drifting ||
        gameState.isDrifting ||
        gameState.currentVehicle?.drifting
    );

    // 1. Continuous Car Engine RPM or 14Hz Aircraft Rotor/Propeller Modulation
    if (this.engineOsc && this.engineSubOsc && this.engineGain) {
      if (inAircraft) {
        this._rotorPhase = ((this._rotorPhase || 0) + dt * 14) % 1;
        const bladePulse = Math.sin(this._rotorPhase * Math.PI * 2);
        const vehType = String(gameState.currentVehicle?.type || '').toLowerCase();
        const isHeli = vehType.includes('heli') || vehType.includes('maverick');
        const rpmRatio = Math.min(1.0, speed / 48);
        const baseFreq = isHeli
          ? 44 + rpmRatio * 36 + bladePulse * 15
          : 68 + rpmRatio * 84 + bladePulse * 12;
        this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.025);
        this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5 + bladePulse * 6, now, 0.025);
        const thrumGain = 0.085 + rpmRatio * 0.065 + Math.max(0, bladePulse) * 0.045;
        this.engineGain.gain.setTargetAtTime(thrumGain, now, 0.03);
      } else if (inVehicle) {
        const rpmRatio = Math.min(1.0, speed / 38);
        const gearMod = (speed % 11) / 11;
        const baseFreq = 52 + rpmRatio * 95 + gearMod * 28;
        this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
        this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
        this.engineGain.gain.setTargetAtTime(0.07 + rpmRatio * 0.08, now, 0.06);
      } else {
        this.engineGain.gain.setTargetAtTime(0.0001, now, 0.08);
      }
    }

    // 2. Drift tire screech burst (ground vehicles only)
    if (inVehicle && !inAircraft && isDrifting && speed > 6) {
      this._screechCooldown = (this._screechCooldown || 0) - dt;
      if (this._screechCooldown <= 0) {
        this._screechCooldown = 0.09;
        this._playNoiseBurst(0.11, 2900, 0.11, 'bandpass');
      }
    }

    // 3. Police Wail / Yelp Siren modulation based on wanted level & closest cop
    const wanted = Number(gameState.wantedLevel ?? gameState.wantedStars ?? 0);
    if (this.sirenOsc && this.sirenGain) {
      if (wanted > 0) {
        this.sirenPhase += dt * (wanted >= 3 ? 4.8 : 2.2);
        const sweep = Math.sin(this.sirenPhase * Math.PI * 2);
        const freq = 760 + sweep * 260;
        this.sirenOsc.frequency.setTargetAtTime(freq, now, 0.03);
        const targetGain = Math.min(0.11, 0.035 + wanted * 0.015);
        this.sirenGain.gain.setTargetAtTime(targetGain, now, 0.08);
      } else {
        this.sirenGain.gain.setTargetAtTime(0.0001, now, 0.1);
      }
    }

    // 4. Warm 80s synthesized fallback groove if radio station is active & HTMLAudioElement is paused/decoding
    const station = RADIO_STATIONS[this.stationIndex];
    const htmlRadioPlaying =
      this.currentRadioAudio &&
      !this.currentRadioAudio.paused &&
      !this.currentRadioAudio.__vcLoadFailed &&
      this.currentRadioAudio.currentTime > 0;

    if (station && station.bpm > 0 && !htmlRadioPlaying) {
      const stepDuration = 60 / station.bpm / 2; // 8th notes
      this.synthRadioTimer += dt;
      if (this.synthRadioTimer >= stepDuration) {
        this.synthRadioTimer %= stepDuration;
        this._triggerSynthRadioStep(station, this.synthStepIndex++);
      }
    }
  }

  _triggerSynthRadioStep(station, step) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const barStep = step % 8;
    const chordIdx = Math.floor(step / 8) % station.chordProg.length;
    const semitoneOffset = station.chordProg[chordIdx];
    const arpOffsets = [0, 7, 12, 7, 3, 7, 10, 12];
    const noteSemis = semitoneOffset + arpOffsets[barStep];
    const freq = station.rootNote * Math.pow(2, noteSemis / 12);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = station.id === 'v_rock' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(barStep % 2 === 0 ? freq * 0.5 : freq, t);

    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

// ============================================================================
// MAIN VFX, COMIC HUD & SPATIAL AUDIO SYSTEM
// ============================================================================

export class VFXHudAndAudioSystem {
  constructor(scene, camera, world = null, callbacks = {}) {
    // Support both (scene, camera, world, callbacks) and options object
    if (scene && !scene.isScene && scene.scene) {
      this.scene = scene.scene;
      this.camera = scene.camera;
      this.world = scene.world || null;
      this.callbacks = scene.callbacks || {};
    } else {
      this.scene = scene;
      this.camera = camera;
      if (world && typeof world === 'object' && !world.isObject3D && !world.cityBlocks && (world.onOpenPager || world.onSelectWeapon)) {
        this.world = null;
        this.callbacks = world;
      } else {
        this.world = world;
        this.callbacks = callbacks || {};
      }
    }

    this.elapsedTime = 0;

    // Audio engine
    this.audio = new ViceAudioEngine((speaker, text, isDispatch) => {
      this.activeSubtitle = {
        speaker,
        text,
        isDispatch,
        remaining: 3.4,
      };
    });

    // HUD State (with authentic Grand Theft Argon + Argon City defaults matching screenshots)
    this.hudState = {
      unreadCount: 59,
      dayName: 'Tue',
      clockTime: '02:01',
      timeHours: 2.02,
      cash: 25400,
      health: 100,
      maxHealth: 100,
      armor: 100,
      maxArmor: 100,
      wantedLevel: 0,
      copsRequired: 0,
      copsWrecked: 0,
      isEvading: false,
      escapeProgress: 0,
      weaponId: 'mac10',
      ammoText: '580-0',
      throwableType: 'grenade', // 'grenade' or 'molotov'
      throwableCount: 98,
      district: 'OCEAN BEACH',
      districtBannerTimer: 3.5,
      weaponWheelOpen: false,
      hoveredWheelSlot: 4,
      pagerModalOpen: false,
      playerX: 52,
      playerZ: 28,
      chunkX: 0,
      chunkZ: 0,
      isOuterChunk: false,
      playerHeading: 0,
      cameraYaw: 0,
      isAircraft: false,
      aircraftName: '',
      altitude: 0,
      vehicleSpeed: 0,
      tikiCollected: 0,
      tikiTotal: 10,
    };

    // Callout feed (seeded with a crisp initial arcade callout so it's immediately verifiable)
    this.callouts = [
      {
        text: 'GRAND THEFT ARGON',
        subtext: 'OCEAN DRIVE PATROL',
        color: '#ffffff',
        accent: '#00f0ff',
        age: 0,
        duration: 4.2,
      },
    ];

    this.activeSubtitle = null;
    this.speechBubbles = [];
    this._speechSpeakerCycle = 0;

    // Interactive HUD hit-regions (in logical CSS pixels)
    this.hitRegions = {
      pager: { x: 0, y: 0, w: 0, h: 0 },
      throwable: { x: 0, y: 0, w: 0, h: 0 },
      weapon: { x: 0, y: 0, w: 0, h: 0 },
      radio: { x: 0, y: 0, w: 0, h: 0 },
    };

    // Touch / Mobile Virtual Controls State
    this.isTouchVisible =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
        window.location?.search?.includes('touch=1'));

    this.touchState = {
      moveX: 0,
      moveY: 0,
      aimX: 0,
      aimY: 0,
      firing: false,
      driving: false,
      drifting: false,
      throwable: false,
      weaponWheel: false,
      pda: false,
      _leftStickOrigin: null,
      _leftStickCurrent: null,
      _rightPadOrigin: null,
      _rightPadCurrent: null,
    };

    // Pre-allocated 3D Cel-Shaded VFX Pools (Zero dynamic PointLights!)
    this.vfxRoot = new THREE.Group();
    this.vfxRoot.name = 'ViceCityCelShadedVFXPool';
    if (this.scene && typeof this.scene.add === 'function') {
      this.scene.add(this.vfxRoot);
    }

    this.explosionPool = [];
    this.shockwavePool = [];
    this.debrisPool = [];
    this.popupPool = [];
    this.fireGridPool = [];
    this.muzzleFlashPool = [];
    this.tracerPool = [];
    this.bloodDecalPool = [];
    this.sparkPool = [];

    this.bloodDecalCursor = 0;

    this._initPreAllocatedVFXPools();
    this._initComicHudOverlay();
  }

  // ==========================================================================
  // 3D CEL-SHADED VFX POOLS INITIALIZATION (ZERO POINTLIGHTS!)
  // ==========================================================================

  _initPreAllocatedVFXPools() {
    // Shared Geometries
    this.sharedSphereGeo = new THREE.IcosahedronGeometry(1, 1);
    this.sharedOutlineSphereGeo = new THREE.IcosahedronGeometry(1.09, 1);

    // Shockwave Ground Ring: rotated flat in geometry, scaled via mesh.scale.set(r, 1, r)
    this.sharedShockwaveGeo = new THREE.RingGeometry(0.68, 1.0, 32);
    this.sharedShockwaveGeo.rotateX(-Math.PI / 2);

    this.sharedDebrisGeo = new THREE.DodecahedronGeometry(0.28, 0);

    // Flame cone geometry for 4x4 Molotov Fire Grids
    this.sharedFlameConeGeo = new THREE.ConeGeometry(0.36, 1.35, 6);
    this.sharedFlameConeGeo.translate(0, 0.675, 0);

    this.sharedFlameCoreGeo = new THREE.ConeGeometry(0.2, 0.9, 5);
    this.sharedFlameCoreGeo.translate(0, 0.45, 0);

    this.sharedGroundDiscGeo = new THREE.CircleGeometry(1.0, 20);
    this.sharedGroundDiscGeo.rotateX(-Math.PI / 2);

    // Star-shaped muzzle flash geometry
    this.sharedMuzzleStarGeo = this._createStarBurstGeometry(1.15, 0.38, 6);

    // Unit tracer beam geometry (oriented along +Z from 0 to 1, wide enough for top-down visibility)
    this.sharedTracerGeo = new THREE.BoxGeometry(0.24, 0.14, 1.0);
    this.sharedTracerGeo.translate(0, 0, 0.5);

    // Shared Cel-Shaded Basic Materials (Unlit -> zero shader recompilation!)
    this.inkOutlineMat = new THREE.MeshBasicMaterial({
      color: 0x08080c,
      side: THREE.BackSide,
    });

    // 1. Pre-allocate 10 Multi-Lobed Fireball Explosions
    const lobeColors = [0xffffff, 0xffee33, 0xff7700, 0xff2200, 0x26242e, 0xffaa00];
    for (let i = 0; i < 10; i++) {
      const group = new THREE.Group();
      group.visible = false;
      const lobes = [];
      for (let j = 0; j < 6; j++) {
        const lobeGroup = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({
          color: lobeColors[j % lobeColors.length],
          transparent: true,
          opacity: 1.0,
        });
        const coreMesh = new THREE.Mesh(this.sharedSphereGeo, mat);
        const outlineMesh = new THREE.Mesh(this.sharedOutlineSphereGeo, this.inkOutlineMat);
        lobeGroup.add(coreMesh);
        lobeGroup.add(outlineMesh);
        group.add(lobeGroup);
        lobes.push({
          group: lobeGroup,
          mat,
          vx: 0,
          vy: 0,
          vz: 0,
          baseScale: 1,
        });
      }
      this.vfxRoot.add(group);
      this.explosionPool.push({
        active: false,
        group,
        lobes,
        age: 0,
        duration: 0.85,
        scale: 1.0,
      });
    }

    // 2. Pre-allocate 10 Shockwave Ground Rings
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.sharedShockwaveGeo, mat);
      mesh.visible = false;
      this.vfxRoot.add(mesh);
      this.shockwavePool.push({
        active: false,
        mesh,
        mat,
        age: 0,
        duration: 0.6,
        maxRadius: 8.5,
      });
    }

    // 3. Pre-allocate 48 Flying Debris Chunks
    const debrisColors = [0x1c1e26, 0xff6600, 0xffcc00, 0x444854];
    for (let i = 0; i < 48; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: debrisColors[i % debrisColors.length],
      });
      const mesh = new THREE.Mesh(this.sharedDebrisGeo, mat);
      mesh.visible = false;
      this.vfxRoot.add(mesh);
      this.debrisPool.push({
        active: false,
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        age: 0,
        duration: 1.1,
      });
    }

    // 4. Pre-allocate Comic 'KABOOM!' / 'CRASH!' / 'BLAM!' Pop-Up Sprites
    this.comicPopupTextures = this._createComicPopupTextures();
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.comicPopupTextures[i % this.comicPopupTextures.length],
        transparent: true,
        opacity: 1.0,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 999;
      this.vfxRoot.add(sprite);
      this.popupPool.push({
        active: false,
        sprite,
        mat,
        age: 0,
        duration: 0.95,
        baseScale: 3.8,
      });
    }

    // 5. Pre-allocate 6 Molotov 4x4 Expanding Ground Fire Grids
    const scorchTex = this._createScorchEmberTexture();
    const outerFlameMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xffee22 });

    for (let i = 0; i < 6; i++) {
      const group = new THREE.Group();
      group.visible = false;

      const emberMat = new THREE.MeshBasicMaterial({
        map: scorchTex,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const emberDecal = new THREE.Mesh(this.sharedGroundDiscGeo, emberMat);
      emberDecal.position.y = 0.04;
      emberDecal.scale.set(3.4, 1, 3.4);
      group.add(emberDecal);

      // 4x4 grid of comic flame tongues
      const cells = [];
      for (let gx = 0; gx < 4; gx++) {
        for (let gz = 0; gz < 4; gz++) {
          const cellGroup = new THREE.Group();
          const ox = (gx - 1.5) * 1.25 + (Math.random() - 0.5) * 0.28;
          const oz = (gz - 1.5) * 1.25 + (Math.random() - 0.5) * 0.28;
          cellGroup.position.set(ox, 0.02, oz);

          const outerCone = new THREE.Mesh(this.sharedFlameConeGeo, outerFlameMat);
          const innerCone = new THREE.Mesh(this.sharedFlameCoreGeo, innerFlameMat);
          innerCone.position.y = 0.05;
          cellGroup.add(outerCone);
          cellGroup.add(innerCone);
          group.add(cellGroup);

          cells.push({
            mesh: cellGroup,
            phase: (gx * 4 + gz) * 0.65,
            baseScale: 0.75 + ((gx + gz) % 3) * 0.2,
          });
        }
      }

      this.vfxRoot.add(group);
      this.fireGridPool.push({
        active: false,
        group,
        emberMat,
        cells,
        x: 0,
        z: 0,
        radius: 3.4,
        age: 0,
        duration: 6.5,
      });
    }

    // 6. Pre-allocate 18 Comic Star Muzzle Flashes & Bright Yellow-Orange Bullet Tracers
    for (let i = 0; i < 18; i++) {
      const flashMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffffaa : 0xffcc22,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0,
      });
      const flashMesh = new THREE.Mesh(this.sharedMuzzleStarGeo, flashMat);
      flashMesh.visible = false;
      this.vfxRoot.add(flashMesh);
      this.muzzleFlashPool.push({
        active: false,
        mesh: flashMesh,
        mat: flashMat,
        age: 0,
        duration: 0.075,
      });

      const tracerMat = new THREE.MeshBasicMaterial({
        color: 0xffcc22,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      });
      const tracerMesh = new THREE.Mesh(this.sharedTracerGeo, tracerMat);
      tracerMesh.visible = false;
      this.vfxRoot.add(tracerMesh);
      this.tracerPool.push({
        active: false,
        mesh: tracerMesh,
        mat: tracerMat,
        age: 0,
        duration: 0.11,
      });
    }

    // 7. Pre-allocate 28 Stylized Crimson Comic Blood Splatter Ground Decals
    const bloodTex = this._createComicBloodTexture();
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: bloodTex,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.sharedGroundDiscGeo, mat);
      mesh.visible = false;
      this.vfxRoot.add(mesh);
      this.bloodDecalPool.push({
        active: false,
        mesh,
        mat,
        age: 0,
        duration: 16.0,
      });
    }

    // 8. Pre-allocate 48 High-Velocity Collision Sparks
    const sparkGeo = new THREE.BoxGeometry(0.07, 0.07, 0.42);
    for (let i = 0; i < 48; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0x00f0ff : i % 2 === 0 ? 0xffee44 : 0xff7700,
      });
      const mesh = new THREE.Mesh(sparkGeo, mat);
      mesh.visible = false;
      this.vfxRoot.add(mesh);
      this.sparkPool.push({
        active: false,
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        duration: 0.35,
      });
    }
  }

  _createStarBurstGeometry(outerRadius = 0.65, innerRadius = 0.22, points = 6) {
    const shape = new THREE.Shape();
    const totalVerts = points * 2;
    for (let i = 0; i < totalVerts; i++) {
      const angle = (i / totalVerts) * Math.PI * 2;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }

  _createComicPopupTextures() {
    const words = [
      { text: 'KABOOM!', fill: '#ffee22', burst: '#ff3b1f' },
      { text: 'CRASH!', fill: '#00f0ff', burst: '#ff2a85' },
      { text: 'BLAM!', fill: '#ffaa00', burst: '#d81b3a' },
    ];
    if (typeof document === 'undefined') return [null, null, null];

    return words.map((item) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      // Jagged comic starburst polygon
      ctx.save();
      ctx.translate(128, 64);
      ctx.beginPath();
      const spikes = 14;
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2;
        const rx = i % 2 === 0 ? 116 : 74;
        const ry = i % 2 === 0 ? 54 : 32;
        const px = Math.cos(a) * rx;
        const py = Math.sin(a) * ry;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = item.burst;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      // Comic text
      ctx.font = 'italic 900 38px Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(item.text, 0, 2);
      ctx.fillStyle = item.fill;
      ctx.fillText(item.text, 0, 2);
      ctx.restore();

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    });
  }

  _createScorchEmberTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(255, 220, 40, 0.95)');
    grad.addColorStop(0.45, 'rgba(255, 75, 0, 0.85)');
    grad.addColorStop(0.8, 'rgba(20, 12, 12, 0.78)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  _createComicBloodTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Comic ink outline blob + crimson inner fill
    const blobs = [
      { x: 64, y: 64, r: 34 },
      { x: 40, y: 52, r: 16 },
      { x: 88, y: 56, r: 18 },
      { x: 52, y: 90, r: 14 },
      { x: 84, y: 84, r: 12 },
      { x: 30, y: 78, r: 8 },
      { x: 98, y: 36, r: 7 },
    ];
    ctx.fillStyle = '#090002';
    blobs.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#b80d24';
    blobs.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#ff1e3c';
    ctx.beginPath();
    ctx.arc(58, 58, 14, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  // ==========================================================================
  // PUBLIC 3D VFX SPAWN METHODS
  // ==========================================================================

  /**
   * Spawns a cel-shaded multi-lobed fireball explosion, shockwave ground ring,
   * flying debris chunks, and floating comic 'KABOOM!' pop-up.
   */
  spawnExplosion(x, y = 0.5, z = 0, scale = 1.0) {
    if (x && typeof x === 'object') {
      scale = typeof y === 'number' ? y : 1.0;
      z = x.z ?? 0;
      y = x.y ?? 0.5;
      x = x.x ?? 0;
    }

    const s = Math.max(0.4, Number(scale) || 1.0);
    this.audio.playSFX('explosion', { volume: Math.min(1.0, 0.65 * s) });

    // 1. Multi-lobed fireball
    const exp = this._acquireFromPool(this.explosionPool);
    if (exp) {
      exp.active = true;
      exp.age = 0;
      exp.duration = 0.78 * Math.sqrt(s);
      exp.scale = s;
      exp.group.position.set(x, Math.max(0.4, y), z);
      exp.group.visible = true;

      exp.lobes.forEach((lobe, idx) => {
        const angle = (idx / exp.lobes.length) * Math.PI * 2 + Math.random() * 0.4;
        const speed = idx === 0 ? 0.2 : (2.2 + Math.random() * 2.5) * s;
        lobe.vx = Math.cos(angle) * speed;
        lobe.vy = (1.6 + Math.random() * 3.0) * s;
        lobe.vz = Math.sin(angle) * speed;
        lobe.baseScale = (idx === 0 ? 1.55 : 0.95 + Math.random() * 0.5) * s;
        lobe.group.position.set(0, 0, 0);
        lobe.group.scale.setScalar(0.2 * lobe.baseScale);
        lobe.mat.opacity = 1.0;
      });
    }

    // 2. Flat ground shockwave ring (scaled strictly via mesh.scale.set(r, 1, r))
    const ring = this._acquireFromPool(this.shockwavePool);
    if (ring) {
      ring.active = true;
      ring.age = 0;
      ring.duration = 0.55 * Math.sqrt(s);
      ring.maxRadius = 7.5 * s;
      ring.mesh.position.set(x, 0.08, z);
      ring.mesh.scale.set(0.5, 1, 0.5);
      ring.mat.opacity = 0.95;
      ring.mesh.visible = true;
    }

    // 3. Flying debris chunks
    const chunkCount = Math.min(12, Math.round(8 * s));
    for (let i = 0; i < chunkCount; i++) {
      const deb = this._acquireFromPool(this.debrisPool);
      if (!deb) break;
      deb.active = true;
      deb.age = 0;
      deb.duration = 0.85 + Math.random() * 0.45;
      deb.mesh.position.set(x, Math.max(0.4, y + 0.3), z);
      const a = Math.random() * Math.PI * 2;
      const spd = (5 + Math.random() * 9) * s;
      deb.vx = Math.cos(a) * spd;
      deb.vy = (6 + Math.random() * 8) * s;
      deb.vz = Math.sin(a) * spd;
      deb.rx = (Math.random() - 0.5) * 14;
      deb.ry = (Math.random() - 0.5) * 14;
      deb.mesh.scale.setScalar((0.7 + Math.random() * 0.7) * Math.min(1.6, s));
      deb.mesh.visible = true;
    }

    // 4. Floating Comic 'KABOOM!' / 'CRASH!' pop-up sprite
    const pop = this._acquireFromPool(this.popupPool);
    if (pop) {
      pop.active = true;
      pop.age = 0;
      pop.duration = 0.95;
      pop.baseScale = 3.6 * Math.min(1.5, Math.max(0.85, s));
      if (this.comicPopupTextures[0]) {
        const texIdx = Math.floor(Math.random() * this.comicPopupTextures.length);
        pop.mat.map = this.comicPopupTextures[texIdx];
      }
      pop.mat.opacity = 1.0;
      pop.sprite.position.set(x, Math.max(1.8, y + 1.8), z);
      pop.sprite.scale.set(pop.baseScale, pop.baseScale * 0.5, 1);
      pop.sprite.visible = true;
    }
  }

  /**
   * Creates a 4x4 grid of animated neon-orange/yellow comic flame tongues and
   * glowing ember decals on the asphalt that damage nearby NPCs & vehicles.
   */
  spawnFireGrid(x, z, duration = 6.5) {
    if (x && typeof x === 'object') {
      duration = typeof z === 'number' ? z : 6.5;
      z = x.z ?? 0;
      x = x.x ?? 0;
    } else if (arguments.length >= 4) {
      // Called as (x, y, z, duration)
      z = arguments[2];
      duration = arguments[3] ?? 6.5;
    }

    this.audio.playSFX('molotov');

    const grid = this._acquireFromPool(this.fireGridPool);
    if (!grid) return null;

    grid.active = true;
    grid.x = Number(x) || 0;
    grid.z = Number(z) || 0;
    grid.radius = 3.4;
    grid.age = 0.28;
    grid.duration = Math.max(1.5, Number(duration) || 6.5);
    grid.group.position.set(grid.x, 0.22, grid.z);
    grid.emberMat.opacity = 0.95;
    grid.group.visible = true;
    for (let c = 0; c < grid.cells.length; c++) {
      const cell = grid.cells[c];
      cell.mesh.scale.set(cell.baseScale * 1.35, cell.baseScale * 1.55, cell.baseScale * 1.35);
    }

    return {
      x: grid.x,
      z: grid.z,
      radius: grid.radius,
      remaining: grid.duration,
    };
  }

  /**
   * Returns active Molotov fire grids so combat/vehicle loops can apply burn damage.
   */
  getActiveFireGrids() {
    const result = [];
    for (let i = 0; i < this.fireGridPool.length; i++) {
      const g = this.fireGridPool[i];
      if (g.active) {
        result.push({
          x: g.x,
          z: g.z,
          radius: g.radius,
          remaining: Math.max(0, g.duration - g.age),
        });
      }
    }
    return result;
  }

  /**
   * Spawns a bright yellow-white star-shaped comic muzzle flash at the gun barrel
   * AND a crisp glowing yellow-orange tracer line to the target (matching screenshot 2!).
   * Supports flexible signatures:
   * - spawnMuzzleFlash(x, y, z, targetX, targetY, targetZ)
   * - spawnMuzzleFlash(x, y, z, dirX, dirZ, targetX, targetZ)
   * - spawnMuzzleFlash(originVec, targetVec)
   */
  spawnMuzzleFlash(x, y, z, a, b, c, d) {
    let ox = 0;
    let oy = 1.25;
    let oz = 0;
    let tx = 0;
    let ty = 1.25;
    let tz = 15;

    if (x && typeof x === 'object') {
      ox = x.x ?? 0;
      oy = x.y ?? 1.25;
      oz = x.z ?? 0;
      if (y && typeof y === 'object') {
        tx = y.x ?? ox;
        ty = y.y ?? oy;
        tz = y.z ?? oz + 18;
      } else {
        tx = ox;
        ty = oy;
        tz = oz + 18;
      }
    } else {
      ox = Number(x) || 0;
      oy = Number(y) || 1.25;
      oz = Number(z) || 0;

      if (arguments.length >= 7 && d !== undefined) {
        // (x, y, z, dirX, dirZ, targetX, targetZ)
        tx = Number(c);
        ty = oy;
        tz = Number(d);
        if (!Number.isFinite(tx) || !Number.isFinite(tz)) {
          tx = ox + (Number(a) || 0) * 22;
          tz = oz + (Number(b) || 0) * 22;
        }
      } else if (arguments.length === 6 && c !== undefined) {
        // Either (x, y, z, targetX, targetY, targetZ) or normalized (x, y, z, dirX, dirY, dirZ)
        const na = Number(a) || 0;
        const nb = Number(b) || 0;
        const nc = Number(c) || 0;
        const mag = Math.hypot(na, nb, nc);
        if (mag > 0.01 && mag <= 1.35 && Math.hypot(ox, oz) > 2.0) {
          tx = ox + na * 22;
          ty = oy + nb * 22;
          tz = oz + nc * 22;
        } else {
          tx = na;
          ty = nb;
          tz = nc;
        }
      } else if (arguments.length === 5 && b !== undefined) {
        // (x, y, z, dirX, dirZ)
        const na = Number(a) || 0;
        const nb = Number(b) || 0;
        if (Math.hypot(na, nb) <= 1.5) {
          tx = ox + na * 22;
          ty = oy;
          tz = oz + nb * 22;
        } else {
          tx = na;
          ty = oy;
          tz = nb;
        }
      } else {
        tx = ox + Math.sin(this.hudState.playerHeading) * 20;
        ty = oy;
        tz = oz + Math.cos(this.hudState.playerHeading) * 20;
      }
    }

    // 1. Star-shaped muzzle flash at gun barrel
    const flash = this._acquireFromPool(this.muzzleFlashPool);
    if (flash) {
      flash.active = true;
      flash.age = 0;
      flash.duration = 0.28;
      flash.mesh.position.set(ox, oy, oz);
      if (this.camera) {
        flash.mesh.quaternion.copy(this.camera.quaternion);
      }
      flash.mesh.rotateZ(Math.random() * Math.PI * 2);
      flash.mesh.scale.setScalar(1.15 + Math.random() * 0.45);
      flash.mat.opacity = 1.0;
      flash.mesh.visible = true;
    }

    // 2. Bright yellow-orange gun tracer beam from barrel to target
    const tracer = this._acquireFromPool(this.tracerPool);
    if (tracer) {
      const dx = tx - ox;
      const dy = ty - oy;
      const dz = tz - oz;
      const dist = Math.max(0.5, Math.hypot(dx, dy, dz));
      tracer.active = true;
      tracer.age = 0;
      tracer.duration = 0.34;
      tracer.mesh.position.set(ox, oy, oz);
      tracer.mesh.lookAt(tx, ty, tz);
      tracer.mesh.scale.set(1.0, 1.0, dist);
      tracer.mat.opacity = 1.0;
      tracer.mesh.visible = true;
    }

    // 3. Impact spark burst at target point
    this.spawnSparks(tx, ty, tz, 6);
  }

  /**
   * Places a stylized comic crimson blood splatter decal on the ground.
   */
  spawnBloodSplatter(x, z) {
    if (x && typeof x === 'object') {
      z = x.z ?? 0;
      x = x.x ?? 0;
    } else if (arguments.length >= 3) {
      z = arguments[2];
    }

    const decal = this.bloodDecalPool[this.bloodDecalCursor % this.bloodDecalPool.length];
    this.bloodDecalCursor++;
    if (!decal) return;

    decal.active = true;
    decal.age = 0;
    decal.duration = 16.0;
    decal.mesh.position.set(Number(x) || 0, 0.04, Number(z) || 0);
    decal.mesh.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.65 + Math.random() * 0.65;
    decal.mesh.scale.set(s, 1, s);
    decal.mat.opacity = 0.92;
    decal.mesh.visible = true;
  }

  /**
   * Spawns high-velocity orange/cyan metal collision sparks when cars ram each other.
   */
  spawnSparks(x, y = 0.8, z = 0, count = 12) {
    if (x && typeof x === 'object') {
      count = typeof y === 'number' ? y : 12;
      z = x.z ?? 0;
      y = x.y ?? 0.8;
      x = x.x ?? 0;
    }

    const n = Math.min(24, Math.max(1, Number(count) || 12));
    for (let i = 0; i < n; i++) {
      const sp = this._acquireFromPool(this.sparkPool);
      if (!sp) break;
      sp.active = true;
      sp.age = 0;
      sp.duration = 0.25 + Math.random() * 0.22;
      sp.mesh.position.set(x, Math.max(0.25, y), z);
      const angle = Math.random() * Math.PI * 2;
      const spd = 6 + Math.random() * 12;
      sp.vx = Math.cos(angle) * spd;
      sp.vy = 3.5 + Math.random() * 7.5;
      sp.vz = Math.sin(angle) * spd;
      sp.mesh.lookAt(x + sp.vx, y + sp.vy, z + sp.vz);
      sp.mesh.visible = true;
    }
  }

  _acquireFromPool(pool) {
    if (!pool || pool.length === 0) return null;
    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].active) return pool[i];
    }
    // Recycle oldest active entry
    let oldest = pool[0];
    for (let i = 1; i < pool.length; i++) {
      if (pool[i].age > oldest.age) oldest = pool[i];
    }
    return oldest;
  }

  _update3DVFXPools(dt) {
    // 1. Update Explosions
    for (let i = 0; i < this.explosionPool.length; i++) {
      const exp = this.explosionPool[i];
      if (!exp.active) continue;
      exp.age += dt;
      const t = exp.age / exp.duration;
      if (t >= 1) {
        exp.active = false;
        exp.group.visible = false;
        continue;
      }
      const expand = Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5);
      for (let j = 0; j < exp.lobes.length; j++) {
        const lobe = exp.lobes[j];
        lobe.group.position.x += lobe.vx * dt;
        lobe.group.position.y += lobe.vy * dt;
        lobe.group.position.z += lobe.vz * dt;
        const sc = lobe.baseScale * (0.35 + expand * 0.95) * (1 - t * 0.25);
        lobe.group.scale.setScalar(Math.max(0.05, sc));
        lobe.mat.opacity = Math.max(0, 1 - Math.pow(t, 1.8));
      }
    }

    // 2. Update Shockwave Ground Rings (scaled strictly via mesh.scale.set(r, 1, r))
    for (let i = 0; i < this.shockwavePool.length; i++) {
      const ring = this.shockwavePool[i];
      if (!ring.active) continue;
      ring.age += dt;
      const t = ring.age / ring.duration;
      if (t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const r = 0.6 + ring.maxRadius * (1 - Math.pow(1 - t, 2.2));
      ring.mesh.scale.set(r, 1, r);
      ring.mat.opacity = Math.max(0, (1 - t) * 0.92);
    }

    // 3. Update Flying Debris Chunks
    for (let i = 0; i < this.debrisPool.length; i++) {
      const deb = this.debrisPool[i];
      if (!deb.active) continue;
      deb.age += dt;
      if (deb.age >= deb.duration) {
        deb.active = false;
        deb.mesh.visible = false;
        continue;
      }
      deb.vy -= 22.0 * dt;
      deb.mesh.position.x += deb.vx * dt;
      deb.mesh.position.y += deb.vy * dt;
      deb.mesh.position.z += deb.vz * dt;
      if (deb.mesh.position.y < 0.14) {
        deb.mesh.position.y = 0.14;
        deb.vy = Math.abs(deb.vy) * 0.42;
        deb.vx *= 0.75;
        deb.vz *= 0.75;
      }
      deb.mesh.rotation.x += deb.rx * dt;
      deb.mesh.rotation.y += deb.ry * dt;
    }

    // 4. Update Floating Comic 'KABOOM!' Popups
    for (let i = 0; i < this.popupPool.length; i++) {
      const pop = this.popupPool[i];
      if (!pop.active) continue;
      pop.age += dt;
      const t = pop.age / pop.duration;
      if (t >= 1) {
        pop.active = false;
        pop.sprite.visible = false;
        continue;
      }
      pop.sprite.position.y += dt * 2.1;
      const punch = t < 0.2 ? 0.5 + (t / 0.2) * 0.7 : 1.2 - (t - 0.2) * 0.25;
      const w = pop.baseScale * punch;
      pop.sprite.scale.set(w, w * 0.5, 1);
      pop.mat.opacity = t > 0.65 ? Math.max(0, 1 - (t - 0.65) / 0.35) : 1.0;
    }

    // 5. Update 4x4 Molotov Expanding Fire Grids
    for (let i = 0; i < this.fireGridPool.length; i++) {
      const grid = this.fireGridPool[i];
      if (!grid.active) continue;
      grid.age += dt;
      if (grid.age >= grid.duration) {
        grid.active = false;
        grid.group.visible = false;
        continue;
      }
      const remRatio = Math.min(1, (grid.duration - grid.age) / 1.2);
      const expandIn = Math.min(1, grid.age / 0.35);
      grid.emberMat.opacity = 0.88 * remRatio * expandIn;

      for (let c = 0; c < grid.cells.length; c++) {
        const cell = grid.cells[c];
        const flicker = 0.72 + 0.38 * Math.sin(this.elapsedTime * 15.0 + cell.phase);
        const sy = cell.baseScale * flicker * remRatio * expandIn;
        const sxz = cell.baseScale * (0.85 + 0.15 * flicker) * expandIn;
        cell.mesh.scale.set(sxz, Math.max(0.05, sy), sxz);
        cell.mesh.rotation.y = this.elapsedTime * 2.5 + cell.phase;
      }
    }

    // 6. Update Muzzle Flashes & Bullet Tracers
    for (let i = 0; i < this.muzzleFlashPool.length; i++) {
      const mf = this.muzzleFlashPool[i];
      if (mf.active) {
        mf.age += dt;
        if (mf.age >= mf.duration) {
          mf.active = false;
          mf.mesh.visible = false;
        } else {
          mf.mat.opacity = 1 - mf.age / mf.duration;
        }
      }
      const tr = this.tracerPool[i];
      if (tr.active) {
        tr.age += dt;
        if (tr.age >= tr.duration) {
          tr.active = false;
          tr.mesh.visible = false;
        } else {
          tr.mat.opacity = 1 - tr.age / tr.duration;
        }
      }
    }

    // 7. Update Blood Splatter Decals
    for (let i = 0; i < this.bloodDecalPool.length; i++) {
      const bd = this.bloodDecalPool[i];
      if (!bd.active) continue;
      bd.age += dt;
      if (bd.age >= bd.duration) {
        bd.active = false;
        bd.mesh.visible = false;
      } else if (bd.age > bd.duration - 2.0) {
        bd.mat.opacity = Math.max(0, ((bd.duration - bd.age) / 2.0) * 0.92);
      }
    }

    // 8. Update Collision Sparks
    for (let i = 0; i < this.sparkPool.length; i++) {
      const sp = this.sparkPool[i];
      if (!sp.active) continue;
      sp.age += dt;
      if (sp.age >= sp.duration) {
        sp.active = false;
        sp.mesh.visible = false;
        continue;
      }
      sp.vy -= 18.0 * dt;
      sp.mesh.position.x += sp.vx * dt;
      sp.mesh.position.y += sp.vy * dt;
      sp.mesh.position.z += sp.vz * dt;
    }
  }

  // ==========================================================================
  // PUBLIC HUD & AUDIO API METHODS
  // ==========================================================================

  /**
   * Adds a bold comic-outlined arcade callout in the Top-Left Callout Feed
   * (matching 'NEAR MISS' in top-left of screenshot 2).
   */
  addCallout(text, subtext = '', color = '#ffffff') {
    if (!text) return;
    // If caller passed a hex color string as the 2nd argument, route it to color
    if (typeof subtext === 'string' && /^#[0-9a-f]{3,8}$/i.test(subtext.trim())) {
      color = subtext.trim();
      subtext = '';
    }
    const upper = String(text).toUpperCase();
    // Deduplicate identical active callout across the stack
    const existing = this.callouts.find((c) => c.text === upper);
    if (existing) {
      existing.subtext = subtext ? String(subtext).toUpperCase() : existing.subtext;
      existing.color = color || existing.color;
      existing.age = 0;
      return;
    }

    this.callouts.unshift({
      text: upper,
      subtext: subtext ? String(subtext).toUpperCase() : '',
      color: color || '#ffffff',
      accent: '#ff2a85',
      age: 0,
      duration: 2.8,
    });
    if (this.callouts.length > 4) {
      this.callouts.length = 4;
    }
  }

  /**
   * Triggers the Bottom-Right District Stencil Banner ('OCEAN BEACH', etc.)
   * styled like 'HOVE BEACH' in the bottom-right of screenshot 1.
   */
  showDistrictBanner(districtName) {
    if (!districtName) return;
    const clean = String(districtName).toUpperCase();
    if (this.hudState.district !== clean) {
      this.hudState.district = clean;
      this.hudState.districtBannerTimer = 4.0;
    } else {
      this.hudState.districtBannerTimer = Math.max(this.hudState.districtBannerTimer, 2.5);
    }
  }

  cycleRadioStation() {
    const station = this.audio.cycleRadioStation();
    this.callbacks.onCycleRadio?.(station);
    return station;
  }

  setRadioStation(stationId) {
    return this.audio.setRadioStation(stationId);
  }

  getCurrentRadioStation() {
    return this.audio.getCurrentRadioStation();
  }

  playVoice(clipId, options = {}) {
    const played = this.audio.playVoice(clipId, options);
    if (played && String(clipId).startsWith('ped_') && options && options.spawnBubble !== false) {
      const pos = options.position || (typeof options.x === 'number' ? options : null);
      if (pos && typeof pos.x === 'number' && typeof pos.z === 'number') {
        const raw = String(clipId);
        const style = raw.includes('panic') ? 'panic' : raw.includes('insult') ? 'insult' : 'chat';
        const clip = this.audio.lastResolvedClip || VOICE_CLIPS[raw];
        this.spawnSpeechBubble(
          pos.x,
          typeof pos.y === 'number' ? pos.y : 2.4,
          pos.z,
          clip ? clip.subtitle : raw,
          style,
          clip ? clip.speaker : null
        );
      }
    }
    return played;
  }

  /**
   * Spawns a Grand Theft Argon graphic-novel floating speech balloon above a 3D world anchor (x, y, z).
   * Max 2 active bubbles on screen at once, duration 3.8s.
   * Styles: 'chat' (#fffdf5 cream-white), 'panic' (#fff176 neon-yellow), 'insult' (#ffd0e6 flamingo-pink).
   */
  spawnSpeechBubble(x, y, z, text, style = 'chat', speakerOverride = null) {
    let wx = x;
    let wy = y;
    let wz = z;
    let rawText = text;
    let rawStyle = style;
    let rawSpeaker = speakerOverride;

    // Support passing a Vector3 / {x, y, z} object as first argument
    if (x && typeof x === 'object') {
      wx = Number(x.x) || 0;
      wy = typeof x.y === 'number' ? x.y : 2.4;
      wz = Number(x.z) || 0;
      rawText = y;
      rawStyle = z || 'chat';
      rawSpeaker = text || null;
    } else {
      wx = Number(x) || 0;
      wy = typeof y === 'number' ? y : 2.4;
      wz = Number(z) || 0;
    }

    const normStyle = String(rawStyle || 'chat').toLowerCase().includes('panic')
      ? 'panic'
      : String(rawStyle || 'chat').toLowerCase().includes('insult')
      ? 'insult'
      : 'chat';

    // Resolve text if a VOICE_CLIPS key or category key was passed, or fallback to lastResolvedClip
    let finalText = typeof rawText === 'string' ? rawText.trim() : '';
    let resolvedClip = null;
    if (finalText && VOICE_CLIPS[finalText]) {
      resolvedClip = VOICE_CLIPS[finalText];
      finalText = resolvedClip.subtitle;
    } else if (!finalText && this.audio?.lastResolvedClip?.subtitle) {
      resolvedClip = this.audio.lastResolvedClip;
      finalText = resolvedClip.subtitle;
    }
    if (!finalText) {
      finalText =
        normStyle === 'panic'
          ? 'Watch the sidewalk, maniac! You almost clipped my neon rollerblades!'
          : normStyle === 'insult'
          ? 'Hey! Watch the Italian linen suit, pal!'
          : "Another day in paradise... eighty-eight degrees in the shade on Ocean Drive!";
    }

    // Determine authentic speaker tag badge ('MIAMI LOCAL', 'BEACH SKATER', 'WALL ST YUPPIE')
    const validTags = ['MIAMI LOCAL', 'BEACH SKATER', 'WALL ST YUPPIE'];
    let speakerTag = rawSpeaker || resolvedClip?.speaker || null;
    if (!speakerTag || !validTags.includes(speakerTag)) {
      const lower = finalText.toLowerCase();
      if (
        lower.includes('synthetic') ||
        lower.includes('motorola') ||
        lower.includes('suit') ||
        lower.includes('yacht') ||
        lower.includes('convertible') ||
        lower.includes('throttle')
      ) {
        speakerTag = 'WALL ST YUPPIE';
      } else if (
        lower.includes('rollerblades') ||
        lower.includes('walkman') ||
        lower.includes('groove')
      ) {
        speakerTag = 'BEACH SKATER';
      } else if (
        lower.includes('malibu') ||
        lower.includes('cafecitos') ||
        lower.includes('paradise') ||
        lower.includes('art deco') ||
        lower.includes('paint job')
      ) {
        speakerTag = 'MIAMI LOCAL';
      } else {
        speakerTag = validTags[this._speechSpeakerCycle % validTags.length];
        this._speechSpeakerCycle++;
      }
    }

    // Deduplicate if an identical/nearby bubble was just spawned within 0.15s
    const lastBubble = this.speechBubbles[this.speechBubbles.length - 1];
    if (
      lastBubble &&
      lastBubble.age < 0.15 &&
      Math.hypot(lastBubble.x - wx, lastBubble.z - wz) < 2.5
    ) {
      lastBubble.x = wx;
      lastBubble.y = wy;
      lastBubble.z = wz;
      lastBubble.text = finalText;
      lastBubble.style = normStyle;
      lastBubble.speaker = speakerTag;
      lastBubble.age = 0;
      lastBubble.duration = 3.8;
      return lastBubble;
    }

    // Enforce max 2 active bubbles on screen at once
    while (this.speechBubbles.length >= 2) {
      this.speechBubbles.shift();
    }

    const bubble = {
      x: wx,
      y: wy,
      z: wz,
      text: finalText,
      style: normStyle,
      speaker: speakerTag,
      age: 0,
      duration: 3.8,
    };
    this.speechBubbles.push(bubble);
    return bubble;
  }

  playSFX(sfxId, options = {}) {
    this.audio.playSFX(sfxId, options);
  }

  getTouchInput() {
    return this.touchState;
  }

  // ==========================================================================
  // GRAND THEFT ARGON + ARGON CITY COMIC HUD OVERLAY (CANVAS2D + INTERACTIVE DOM)
  // ==========================================================================

  _initComicHudOverlay() {
    if (typeof document === 'undefined') return;

    // Remove any stale overlay if re-instantiated
    const existing = document.getElementById('vc-comic-hud-canvas');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.id = 'vc-comic-hud-canvas';
    Object.assign(this.hudCanvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '20',
      userSelect: 'none',
      webkitUserSelect: 'none',
    });
    document.body.appendChild(this.hudCanvas);
    this.hudCtx = this.hudCanvas.getContext('2d');

    this._resizeHudCanvas();
    this._bindHudInteractionListeners();
  }

  _resizeHudCanvas() {
    if (!this.hudCanvas || typeof window === 'undefined') return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    if (this.hudCanvas.width !== Math.floor(w * dpr) || this.hudCanvas.height !== Math.floor(h * dpr)) {
      this.hudCanvas.width = Math.floor(w * dpr);
      this.hudCanvas.height = Math.floor(h * dpr);
    }
    this.hudDpr = dpr;
    this.hudWidth = w;
    this.hudHeight = h;
  }

  _bindHudInteractionListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener(
      'resize',
      () => {
        this._resizeHudCanvas();
        this._renderComicHud(this._lastGameState || {});
      },
      { passive: true }
    );

    // Keyboard shortcuts: Q for Neon Weapon Wheel, R for Radio Station
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyQ' && !e.repeat) {
        this.hudState.weaponWheelOpen = true;
        this.audio.playSFX('ui_click', { volume: 0.4 });
      } else if (e.code === 'KeyR' && !e.repeat) {
        // Only cycle here if caller didn't disable internal R binding
        if (this.callbacks.handleRadioKey !== false) {
          const st = this.cycleRadioStation();
          this.addCallout(`♪ ${st.name}`, st.genre, st.color);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyQ' && this.hudState.weaponWheelOpen) {
        this.hudState.weaponWheelOpen = false;
        const chosen = WEAPON_CATALOG[this.hudState.hoveredWheelSlot] || WEAPON_CATALOG[4];
        this._selectWeaponFromWheel(chosen);
      }
    });

    window.addEventListener(
      'pointermove',
      (e) => {
        if (this.hudState.weaponWheelOpen) {
          this._updateWeaponWheelHover(e.clientX, e.clientY);
        }
      },
      { passive: true }
    );

    window.addEventListener('pointerdown', (e) => {
      const x = e.clientX;
      const y = e.clientY;

      // Check if Neon Radial Weapon Wheel is open
      if (this.hudState.weaponWheelOpen) {
        const cx = this.hudWidth * 0.5;
        const cy = this.hudHeight * 0.5;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= 195) {
          this._updateWeaponWheelHover(x, y);
          const chosen = WEAPON_CATALOG[this.hudState.hoveredWheelSlot];
          if (chosen) this._selectWeaponFromWheel(chosen);
        }
        this.hudState.weaponWheelOpen = false;
        return;
      }

      // Check Top-Right Pager Envelope click
      if (this._pointInRect(x, y, this.hitRegions.pager)) {
        this.audio.playSFX('pager');
        if (typeof this.callbacks.onOpenPager === 'function') {
          this.callbacks.onOpenPager();
        } else if (typeof this.callbacks.onTogglePager === 'function') {
          this.callbacks.onTogglePager();
        } else {
          this.hudState.pagerModalOpen = !this.hudState.pagerModalOpen;
        }
        return;
      }

      // Check Top-Right Throwable Icon click
      if (this._pointInRect(x, y, this.hitRegions.throwable)) {
        this.hudState.throwableType =
          this.hudState.throwableType === 'grenade' ? 'molotov' : 'grenade';
        this.audio.playSFX('ui_click');
        this.callbacks.onCycleThrowable?.(this.hudState.throwableType);
        return;
      }

      // Check Top-Right Weapon Icon click -> opens 1980s Neon Radial Weapon Wheel!
      if (this._pointInRect(x, y, this.hitRegions.weapon)) {
        this.hudState.weaponWheelOpen = !this.hudState.weaponWheelOpen;
        this.audio.playSFX('ui_click');
        return;
      }

      // Check Bottom-Right Radio Ticker Pill click
      if (this._pointInRect(x, y, this.hitRegions.radio)) {
        const st = this.cycleRadioStation();
        this.addCallout(`♪ ${st.name}`, st.genre, st.color);
        return;
      }
    });

    // Touch / Mobile Virtual Controls handlers
    window.addEventListener(
      'touchstart',
      (e) => {
        this.isTouchVisible = true;
        this._handleTouchEvents(e);
      },
      { passive: true }
    );
    window.addEventListener('touchmove', (e) => this._handleTouchEvents(e), { passive: true });
    window.addEventListener('touchend', (e) => this._handleTouchEvents(e), { passive: true });
    window.addEventListener('touchcancel', (e) => this._handleTouchEvents(e), { passive: true });
  }

  _pointInRect(x, y, r) {
    return Boolean(r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  _updateWeaponWheelHover(mx, my) {
    const cx = this.hudWidth * 0.5;
    const cy = this.hudHeight * 0.5;
    const dx = mx - cx;
    const dy = my - cy;
    if (Math.hypot(dx, dy) < 28) return;
    let angle = Math.atan2(dy, dx) + Math.PI * 0.5;
    if (angle < 0) angle += Math.PI * 2;
    const sector = Math.floor((angle / (Math.PI * 2)) * WEAPON_CATALOG.length) % WEAPON_CATALOG.length;
    this.hudState.hoveredWheelSlot = sector;
  }

  _selectWeaponFromWheel(weaponDef) {
    if (!weaponDef) return;
    this.hudState.weaponId = weaponDef.id;
    this.hudState.ammoText = weaponDef.defaultAmmo;
    this.audio.playSFX('ui_click');
    this.addCallout(`EQUIPPED ${weaponDef.shortName}`, '', '#00f0ff');
    this.callbacks.onSelectWeapon?.(weaponDef.id, weaponDef.slot);
  }

  _handleTouchEvents(e) {
    const w = this.hudWidth || 1280;
    const h = this.hudHeight || 720;
    this.touchState.moveX = 0;
    this.touchState.moveY = 0;
    this.touchState.firing = false;
    this.touchState._leftStickCurrent = null;
    this.touchState._rightPadCurrent = null;

    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      const tx = t.clientX;
      const ty = t.clientY;

      // Left virtual thumbstick zone (above radar or bottom-left quadrant)
      if (tx < w * 0.42 && ty > h * 0.35) {
        const origin = this.touchState._leftStickOrigin || { x: 240, y: h - 110 };
        this.touchState._leftStickOrigin = origin;
        const dx = tx - origin.x;
        const dy = ty - origin.y;
        const maxR = 54;
        const d = Math.min(maxR, Math.hypot(dx, dy));
        const ang = Math.atan2(dy, dx);
        this.touchState.moveX = (Math.cos(ang) * d) / maxR;
        this.touchState.moveY = (Math.sin(ang) * d) / maxR;
        this.touchState._leftStickCurrent = {
          x: origin.x + Math.cos(ang) * d,
          y: origin.y + Math.sin(ang) * d,
        };
      } else if (tx > w * 0.55 && ty > h * 0.35) {
        // Right virtual aim / fire zone
        const origin = this.touchState._rightPadOrigin || { x: w - 155, y: h - 135 };
        this.touchState._rightPadOrigin = origin;
        const dx = tx - origin.x;
        const dy = ty - origin.y;
        const maxR = 54;
        const d = Math.min(maxR, Math.hypot(dx, dy));
        const ang = Math.atan2(dy, dx);
        this.touchState.aimX = Math.cos(ang);
        this.touchState.aimY = Math.sin(ang);
        this.touchState.firing = true;
        this.touchState._rightPadCurrent = {
          x: origin.x + Math.cos(ang) * d,
          y: origin.y + Math.sin(ang) * d,
        };
      }
    }

    if (e.touches.length === 0) {
      this.touchState._leftStickOrigin = null;
      this.touchState._rightPadOrigin = null;
    }

    this.callbacks.onTouchInput?.(this.touchState);
  }

  // ==========================================================================
  // MAIN FRAME UPDATE (CALLED EVERY FRAME BY GAME LOOP)
  // ==========================================================================

  update(dt, gameState = {}) {
    const safeDt = Math.min(0.1, Math.max(0.001, Number(dt) || 0.016));
    this.elapsedTime += safeDt;
    this._lastGameState = gameState;

    // 1. Sync HUD state from gameState
    this._syncHudState(safeDt, gameState);

    // 2. Update 3D Cel-Shaded VFX & Particle pools
    this._update3DVFXPools(safeDt);

    // 3. Update Spatial Web Audio Engine
    this.audio.update(safeDt, gameState);

    // 4. Render Grand Theft Argon + Argon City Comic HUD Overlay
    this._renderComicHud(gameState);
  }

  _syncHudState(dt, gs = {}) {
    const hs = this.hudState;
    const pState = gs.playerState || gs.player || gs;
    const wState = gs.wantedState || gs.wanted || gs;
    const eState = gs.economyState || gs.economy || gs;

    // Player coordinates & heading
    if (gs.playerPos) {
      hs.playerX = Number(gs.playerPos.x) || 0;
      hs.playerZ = Number(gs.playerPos.z) || 0;
    } else if (pState?.position) {
      hs.playerX = Number(pState.position.x) || 0;
      hs.playerZ = Number(pState.position.z) || 0;
    } else if (typeof pState.x === 'number' && typeof pState.z === 'number') {
      hs.playerX = pState.x;
      hs.playerZ = pState.z;
    }

    const cx = Math.round(hs.playerX / 120);
    const cz = Math.round(hs.playerZ / 120);
    hs.chunkX = cx;
    hs.chunkZ = cz;
    hs.isOuterChunk = Math.abs(cx) > 1 || Math.abs(cz) > 1;

    if (typeof gs.playerHeading === 'number') {
      hs.playerHeading = gs.playerHeading;
    } else if (typeof pState.rotationY === 'number') {
      hs.playerHeading = pState.rotationY;
    } else if (typeof gs.playerRotation === 'number') {
      hs.playerHeading = gs.playerRotation;
    } else if (typeof gs.heading === 'number') {
      hs.playerHeading = gs.heading;
    } else if (pState?.rotation) {
      hs.playerHeading = pState.rotation.y || 0;
    }

    // Camera yaw for North 'N' indicator on radar rim
    if (typeof gs.cameraYaw === 'number') {
      hs.cameraYaw = gs.cameraYaw;
    } else if (this.camera && typeof this.camera.getWorldDirection === 'function') {
      this._tmpCamDir = this._tmpCamDir || new THREE.Vector3();
      this.camera.getWorldDirection(this._tmpCamDir);
      hs.cameraYaw = Math.atan2(this._tmpCamDir.x, -this._tmpCamDir.z);
    }

    // Health & Armor
    if (typeof pState.health === 'number') hs.health = Math.max(0, Math.min(100, pState.health));
    if (typeof pState.maxHealth === 'number') hs.maxHealth = Math.max(1, pState.maxHealth);
    if (typeof pState.armor === 'number') hs.armor = Math.max(0, Math.min(100, pState.armor));
    if (typeof pState.maxArmor === 'number') hs.maxArmor = Math.max(1, pState.maxArmor);

    // Cash & Pager Unread Count
    if (typeof pState.cash === 'number') hs.cash = Math.max(0, Math.floor(pState.cash));
    else if (typeof gs.money === 'number') hs.cash = Math.max(0, Math.floor(gs.money));

    if (typeof eState.unreadTipsCount === 'number') hs.unreadCount = eState.unreadTipsCount;
    else if (typeof gs.unreadMessages === 'number') hs.unreadCount = gs.unreadMessages;
    else if (typeof gs.pagerCount === 'number') hs.unreadCount = gs.pagerCount;

    // Clock & Day
    if (typeof gs.dayName === 'string') hs.dayName = gs.dayName;
    if (typeof gs.clock === 'string') {
      hs.clockTime = gs.clock;
    } else if (typeof gs.timeString === 'string') {
      hs.clockTime = gs.timeString;
    } else {
      hs.timeHours = (hs.timeHours + dt * 0.025) % 24;
      const worldTod =
        typeof gs.timeOfDay === 'number'
          ? gs.timeOfDay
          : typeof this.world?.getTimeOfDay === 'function'
          ? this.world.getTimeOfDay()
          : hs.timeHours;
      const hrs = ((worldTod % 24) + 24) % 24;
      const hh = String(Math.floor(hrs)).padStart(2, '0');
      const mm = String(Math.floor((hrs % 1) * 60)).padStart(2, '0');
      hs.clockTime = `${hh}:${mm}`;
    }

    // Wanted Stars, Escape Progress & Police Cruiser Silhouette Takedown Row
    const rawStars = wState.wantedLevel ?? wState.wantedStars ?? wState.stars;
    if (typeof rawStars === 'number') {
      hs.wantedLevel = Math.max(0, Math.min(5, Math.floor(rawStars)));
    }

    hs.isEvading = Boolean(wState.isEvading ?? gs.isEvading);
    hs.escapeProgress = Math.max(
      0,
      Math.min(1, Number(wState.escapeProgress ?? gs.escapeProgress ?? 0))
    );

    if (typeof wState.copsWrecked === 'number') {
      hs.copsWrecked = Math.max(0, Math.floor(wState.copsWrecked));
    }
    if (hs.wantedLevel === 0) {
      hs.copsRequired =
        typeof wState.copsRequired === 'number' && wState.copsRequired > 0
          ? Math.max(0, Math.min(5, Math.floor(wState.copsRequired)))
          : 0;
    } else if (typeof wState.copsRequired === 'number' && wState.copsRequired > 0) {
      hs.copsRequired = Math.max(1, Math.min(5, Math.floor(wState.copsRequired)));
    } else {
      hs.copsRequired = Math.min(5, Math.max(1, hs.wantedLevel));
    }

    // Weapon & Ammo
    const rawWep = pState.currentWeapon ?? pState.weapon ?? pState.weaponId;
    if (rawWep !== undefined && rawWep !== null) {
      const resolved = this._resolveWeaponDef(rawWep);
      if (resolved) hs.weaponId = resolved.id;
      if (typeof rawWep === 'object') {
        if (typeof rawWep.ammoText === 'string') hs.ammoText = rawWep.ammoText;
        else if (typeof rawWep.reserve === 'number' && typeof rawWep.clip === 'number') {
          hs.ammoText = `${rawWep.reserve}-${rawWep.clip}`;
        } else if (typeof rawWep.ammo === 'number') {
          hs.ammoText = `${rawWep.ammo}-0`;
        }
      }
    }
    if (typeof gs.ammoText === 'string') {
      hs.ammoText = gs.ammoText;
    } else if (typeof gs.ammo === 'number' && typeof gs.clipAmmo === 'number') {
      hs.ammoText = `${gs.ammo}-${gs.clipAmmo}`;
    } else if (typeof gs.ammo === 'string') {
      hs.ammoText = gs.ammo;
    }

    // Throwable slot
    const rawThrow = pState.throwable ?? gs.throwableType ?? gs.currentThrowable;
    if (rawThrow && typeof rawThrow === 'object') {
      const thId = String(rawThrow.id || rawThrow.name || '').toLowerCase();
      hs.throwableType = thId.includes('molotov') ? 'molotov' : 'grenade';
      if (typeof rawThrow.count === 'number') hs.throwableCount = rawThrow.count;
    } else if (typeof rawThrow === 'string') {
      hs.throwableType = rawThrow.toLowerCase().includes('molotov') ? 'molotov' : 'grenade';
    }
    if (typeof gs.throwableCount === 'number') hs.throwableCount = gs.throwableCount;
    else if (typeof gs.molotovCount === 'number') hs.throwableCount = gs.molotovCount;
    else if (typeof gs.grenadeCount === 'number') hs.throwableCount = gs.grenadeCount;

    // Flight Altimeter, Airspeed & Hidden Tiki Collectibles
    hs.isAircraft = Boolean(
      gs.inAircraft || gs.currentVehicle?.isAircraft || pState?.currentVehicle?.isAircraft
    );
    hs.aircraftName =
      pState?.currentVehicle?.name || gs.currentVehicle?.name || '';
    hs.altitude = Math.max(
      0,
      Number(pState?.y ?? pState?.position?.y ?? gs.currentVehicle?.y ?? 0)
    );
    hs.vehicleSpeed = Math.abs(
      Number(
        pState?.currentVehicle?.speed ||
          pState?.currentVehicle?.forwardSpeed ||
          gs.currentVehicle?.speed ||
          gs.currentVehicle?.forwardSpeed ||
          gs.vehicleSpeed ||
          gs.speed ||
          0
      )
    );
    hs.tikiCollected = Number(eState?.tikiCollected ?? gs.tikiCollected ?? 0);
    hs.tikiTotal = Number(eState?.tikiTotal ?? gs.tikiTotal ?? 10);

    // Auto-detect District from world.getDistrictAt(x, z) first
    const detectedDistrict =
      gs.district ||
      gs.districtName ||
      (typeof this.world?.getDistrictAt === 'function'
        ? this.world.getDistrictAt(hs.playerX, hs.playerZ)
        : null) ||
      eState.activeDistrict ||
      this._detectDistrictFromCoords(hs.playerX, hs.playerZ);
    if (detectedDistrict && String(detectedDistrict).toUpperCase() !== hs.district) {
      this.showDistrictBanner(detectedDistrict);
    }
    if (hs.districtBannerTimer > 0) {
      hs.districtBannerTimer = Math.max(0, hs.districtBannerTimer - dt);
    }

    // Update Callout timers
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      this.callouts[i].age += dt;
      if (this.callouts[i].age >= this.callouts[i].duration) {
        this.callouts.splice(i, 1);
      }
    }

    // Update Subtitle timer
    if (this.activeSubtitle) {
      this.activeSubtitle.remaining -= dt;
      if (this.activeSubtitle.remaining <= 0) {
        this.activeSubtitle = null;
      }
    }

    // Update Grand Theft Argon Floating Speech Bubbles (max 2 active, 3.8s duration)
    for (let i = this.speechBubbles.length - 1; i >= 0; i--) {
      this.speechBubbles[i].age += dt;
      if (this.speechBubbles[i].age >= this.speechBubbles[i].duration) {
        this.speechBubbles.splice(i, 1);
      }
    }
  }

  _resolveWeaponDef(input) {
    if (typeof input === 'number') {
      return WEAPON_CATALOG[Math.max(0, Math.min(WEAPON_CATALOG.length - 1, input))];
    }
    const key = String(typeof input === 'object' ? input.id || input.name || 'mac10' : input)
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    return (
      WEAPON_CATALOG.find((w) => w.id === key || w.aliases.includes(key)) ||
      WEAPON_CATALOG[4] // Default: MAC-10 Micro-SMG
    );
  }

  _detectDistrictFromCoords(x, z) {
    if (x > 95 && z < -15) return 'OCEAN BEACH PIER';
    if (x < -100 && z > 65) return 'ESCOBAR AIRPORT';
    if (x < -120 && z <= 15) return 'DOWNTOWN METROPOLIS';
    if (x >= -100 && x <= -35 && z > -25) return 'PALM SPRINGS SUBURBS';
    if (x < -100 && z > 15 && z <= 65) return 'LITTLE HAVANA';
    if (x > 55) return z < -45 ? 'WASHINGTON BEACH' : 'OCEAN DRIVE';
    if (x > 5) return z < -45 ? 'WASHINGTON BEACH' : 'OCEAN BEACH';
    if (x > -50 && Math.abs(z) < 55) return 'STARFISH ISLAND';
    if (x <= -50) return z > 20 ? 'ARGON PORT MARINA' : 'LITTLE HAITI';
    return 'OCEAN BEACH';
  }

  // ==========================================================================
  // GRAND THEFT ARGON + ARGON CITY COMIC HUD CANVAS2D RENDERING
  // ==========================================================================

  _renderHUD(dt, gameState = {}) {
    if (typeof dt === 'number' && dt > 0) {
      for (let i = this.speechBubbles.length - 1; i >= 0; i--) {
        this.speechBubbles[i].age += dt;
        if (this.speechBubbles[i].age >= this.speechBubbles[i].duration) {
          this.speechBubbles.splice(i, 1);
        }
      }
    }
    this._renderComicHud(gameState);
  }

  _renderComicHud(gameState = {}) {
    if (!this.hudCtx || !this.hudCanvas) return;
    this._resizeHudCanvas();

    const ctx = this.hudCtx;
    const dpr = this.hudDpr || 1;
    const W = this.hudWidth;
    const H = this.hudHeight;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // 0. Grand Theft Argon 3D-Projected Floating Comic Speech Balloons above Pedestrians
    if (this.speechBubbles.length > 0) {
      this._drawFloatingSpeechBubbles(ctx, W, H);
    }

    // 1. Top-Right HUD Cluster (Pager, Clock/Cash, Tiki Counter, 5 Wanted Stars, Police Cruiser Takedown Row, Throwable & Weapon)
    this._drawTopRightHudCluster(ctx, W, H);

    // 2. Bottom-Left Circular Radar Minimap (168x168px with crimson blocks, Health/Armor arcs, 'N', Aircraft/Stunt/Tiki Blips)
    this._drawBottomLeftRadarMinimap(ctx, W, H, gameState);

    // 3. Top-Left Arcade Callout Feed ('NEAR MISS', 'COP TAKEDOWN!', 'DRIFT BONUS!')
    this._drawTopLeftArcadeCallouts(ctx, W, H);

    // 4. Bottom-Right District Stencil Banner ('OCEAN BEACH') & Neon Radio Ticker ('♪ WAVE 103')
    this._drawBottomRightDistrictAndRadio(ctx, W, H);

    // 4b. Flight Altimeter, Airspeed & Controls Badge when piloting Aircraft
    if (this.hudState.isAircraft) {
      this._drawFlightHudBadge(ctx, W, H);
    }

    // 5. Police Scanner / Character Subtitle Toast (bottom-center when voice plays)
    if (this.activeSubtitle) {
      this._drawVoiceSubtitleBanner(ctx, W, H, this.activeSubtitle);
    }

    // 6. 1980s Neon Radial Weapon Wheel (when Q held or Weapon icon clicked)
    if (this.hudState.weaponWheelOpen) {
      this._drawNeonRadialWeaponWheel(ctx, W, H);
    }

    // 7. Touch / Mobile Virtual Controls (when on touch device or ?touch=1)
    if (this.isTouchVisible) {
      this._drawVirtualTouchControls(ctx, W, H);
    }

    ctx.restore();
  }

  /**
   * Draws the complete Top-Right HUD Cluster matching the two Grand Theft Argon reference screenshots:
   * Row 1: Yellow Pager Envelope Icon ('59') + Day & 24h Clock ('Tue 02:01') + Cash Counter ('$25,400') + Tiki Counter ('🗿 X/10')
   * Row 2: 5 Golden 6-Pointed Sheriff/Police Stars (pulsing Gold/Cyan when evading ACPD)
   * Row 3: Police Cruiser Silhouette Takedown Row (with bold Crimson Red 'X' across wrecked cruisers) + EVADING ACPD bar
   * Row 4: Dual Weapon & Throwable Cluster (Grenade/Molotov '98' + Primary Weapon Comic Illustration '580-0')
   */
  _drawTopRightHudCluster(ctx, W, H) {
    const hs = this.hudState;
    const rightMargin = 20;
    const topY = 16;

    // --- ROW 1: Pager Envelope ('59') + Clock ('Tue 02:01') + Cash ('$25,400') ---
    const row1Right = W - rightMargin;
    const cashStr = `$${Number(hs.cash || 0).toLocaleString('en-US')}`;
    const clockStr = `${hs.dayName} ${hs.clockTime}`;

    ctx.save();
    ctx.font = '900 22px Impact, "Arial Black", sans-serif';
    const clockWidth = ctx.measureText(clockStr).width;
    const pagerX = row1Right - clockWidth - 96;
    const pagerY = topY + 2;

    // Record Pager hit region
    this.hitRegions.pager = { x: pagerX - 6, y: pagerY - 4, w: 84, h: 36 };

    // Draw Yellow Comic Pager Envelope Icon
    ctx.save();
    ctx.translate(pagerX + 18, pagerY + 14);
    ctx.rotate(-0.07);
    this._drawRoundedComicRect(ctx, -18, -12, 36, 24, 3, '#ffd93b', '#000000', 3.5);
    // Envelope V-flap lines
    ctx.beginPath();
    ctx.moveTo(-16, -10);
    ctx.lineTo(0, 3);
    ctx.lineTo(16, -10);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.restore();

    // Unread badge count ('59') right beside envelope
    this._drawComicText(ctx, String(hs.unreadCount), pagerX + 42, pagerY + 22, {
      font: '900 21px Impact, "Arial Black", sans-serif',
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 5,
      align: 'left',
    });

    // Day & 24h Clock ('Tue 02:01')
    this._drawComicText(ctx, clockStr, row1Right, pagerY + 22, {
      font: '900 23px Impact, "Arial Black", sans-serif',
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 5.5,
      align: 'right',
    });

    // Cash Counter ('$25,400') tucked neatly beside/below clock
    this._drawComicText(ctx, cashStr, pagerX - 14, pagerY + 22, {
      font: '900 21px Impact, "Arial Black", sans-serif',
      fill: '#4dff88',
      stroke: '#000000',
      strokeWidth: 5,
      align: 'right',
    });

    // Compact Tiki Secret Counter Badge ('🗿 X/10') next to top-right cash/pager row when tikiCollected > 0
    if (hs.tikiCollected > 0) {
      ctx.font = '900 21px Impact, "Arial Black", sans-serif';
      const cashWidth = ctx.measureText(cashStr).width;
      const tikiStr = `🗿 ${hs.tikiCollected}/${hs.tikiTotal || 10}`;
      ctx.font = '900 15px Impact, "Arial Black", sans-serif';
      const tikiW = Math.ceil(ctx.measureText(tikiStr).width + 18);
      const tikiX = pagerX - 14 - cashWidth - 12 - tikiW;
      const tikiY = pagerY + 1;
      this._drawRoundedComicRect(
        ctx,
        tikiX,
        tikiY,
        tikiW,
        26,
        7,
        'rgba(10, 32, 22, 0.92)',
        '#000000',
        3
      );
      this._drawComicText(ctx, tikiStr, tikiX + tikiW * 0.5, tikiY + 19, {
        font: '900 15px Impact, "Arial Black", sans-serif',
        fill: '#39ff14',
        stroke: '#000000',
        strokeWidth: 4,
        align: 'center',
      });
    }
    ctx.restore();

    // --- ROW 2: 5 Golden 6-Pointed Sheriff/Police Wanted Stars ---
    const starsY = topY + 46;
    const starSpacing = 31;
    const evadingActive = hs.wantedLevel > 0 && hs.isEvading && hs.escapeProgress > 0.05;
    for (let i = 0; i < 5; i++) {
      const starIndex = i;
      const sx = row1Right - (4 - i) * starSpacing - 14;
      const isActive = starIndex < hs.wantedLevel;
      this._drawSixPointSheriffStar(
        ctx,
        sx,
        starsY,
        13.5,
        isActive,
        this.elapsedTime,
        i,
        evadingActive
      );
    }

    // --- ROW 3: Police Cruiser Silhouette Takedown Row (Directly below Wanted Stars!) ---
    const cruiserRowY = starsY + 29;
    const numCruisers =
      hs.wantedLevel > 0
        ? Math.max(1, Math.min(5, Math.max(hs.copsRequired, hs.wantedLevel)))
        : Math.max(0, Math.min(5, hs.copsRequired));
    const cruiserSpacing = 38;
    for (let i = 0; i < numCruisers; i++) {
      const cx = row1Right - (numCruisers - 1 - i) * cruiserSpacing - 20;
      const isWrecked = i < hs.copsWrecked;
      const isPursuing = hs.wantedLevel > 0;
      this._drawPoliceCruiserSilhouette(ctx, cx, cruiserRowY, isWrecked, isPursuing, this.elapsedTime + i);
    }

    // Sleek comic-outlined 'EVADING ACPD' progress bar right below the police cruiser silhouettes row
    let evadingOffset = 0;
    if (evadingActive) {
      const barW = 182;
      const barH = 18;
      const barX = row1Right - barW;
      const barY = (numCruisers > 0 ? cruiserRowY + 14 : starsY + 18);
      this._drawRoundedComicRect(
        ctx,
        barX,
        barY,
        barW,
        barH,
        7,
        'rgba(10, 18, 28, 0.9)',
        '#000000',
        3
      );
      const fillW = Math.max(8, (barW - 6) * Math.min(1, hs.escapeProgress));
      this._drawRoundedComicRect(
        ctx,
        barX + 3,
        barY + 3,
        fillW,
        barH - 6,
        4,
        '#00f0ff',
        null,
        0
      );
      this._drawComicText(ctx, 'EVADING ACPD...', barX + barW * 0.5, barY + 13.5, {
        font: '900 11px Impact, "Arial Black", sans-serif',
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 3.2,
        align: 'center',
      });
      evadingOffset = 22;
    }

    // --- ROW 4: Dual Weapon & Throwable Cluster (Directly below Police Car Silhouettes!) ---
    const clusterTopY = (numCruisers > 0 ? cruiserRowY + 20 : starsY + 22) + evadingOffset;
    const weaponBoxW = 104;
    const weaponBoxH = 62;
    const weaponBoxX = row1Right - weaponBoxW;

    const throwBoxW = 68;
    const throwBoxH = 62;
    const throwBoxX = weaponBoxX - throwBoxW - 10;

    this.hitRegions.throwable = { x: throwBoxX, y: clusterTopY, w: throwBoxW, h: throwBoxH };
    this.hitRegions.weapon = { x: weaponBoxX, y: clusterTopY, w: weaponBoxW, h: weaponBoxH };

    // Left Box: Throwable Icon (Frag Grenade or Flaming Molotov) + Count ('98')
    this._drawRoundedComicRect(
      ctx,
      throwBoxX,
      clusterTopY,
      throwBoxW,
      throwBoxH,
      6,
      'rgba(18, 22, 32, 0.84)',
      '#000000',
      3.5
    );
    this._drawThrowableComicIcon(
      ctx,
      throwBoxX + throwBoxW * 0.5,
      clusterTopY + 24,
      hs.throwableType,
      this.elapsedTime
    );
    this._drawComicText(ctx, String(hs.throwableCount), throwBoxX + throwBoxW * 0.5, clusterTopY + 55, {
      font: '900 18px Impact, "Arial Black", sans-serif',
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 4.5,
      align: 'center',
    });

    // Right Box: Primary Weapon Comic Illustration + Ammo Counter ('580-0')
    this._drawRoundedComicRect(
      ctx,
      weaponBoxX,
      clusterTopY,
      weaponBoxW,
      weaponBoxH,
      6,
      'rgba(18, 22, 32, 0.88)',
      '#000000',
      3.5
    );
    const wepDef = this._resolveWeaponDef(hs.weaponId);
    this._drawWeaponComicIllustration(
      ctx,
      weaponBoxX + weaponBoxW * 0.5,
      clusterTopY + 24,
      wepDef.id
    );
    this._drawComicText(
      ctx,
      hs.ammoText || wepDef.defaultAmmo,
      weaponBoxX + weaponBoxW * 0.5,
      clusterTopY + 55,
      {
        font: '900 18px Impact, "Arial Black", sans-serif',
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 4.5,
        align: 'center',
      }
    );
  }

  /**
   * Draws a 6-pointed Sheriff/Police Star with bold black comic outline.
   * Pulses between Gold (#ffd700) and Electric Cyan (#00f0ff) when evading ACPD.
   */
  _drawSixPointSheriffStar(ctx, cx, cy, radius, active, time, index, isEvading = false) {
    ctx.save();
    ctx.translate(cx, cy);

    const useCyanPulse = active && isEvading && Math.sin(time * 10 + index * 0.7) > 0;

    if (active) {
      const pulse = 1 + 0.08 * Math.sin(time * 7 + index);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = useCyanPulse ? '#00f0ff' : '#ffae00';
      ctx.shadowBlur = 10;
    }

    const points = 6;
    const innerR = radius * 0.48;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI * 0.5;
      const r = i % 2 === 0 ? radius : innerR;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    if (active) {
      const grad = ctx.createRadialGradient(0, -3, 1, 0, 0, radius);
      if (useCyanPulse) {
        grad.addColorStop(0, '#c8ffff');
        grad.addColorStop(0.6, '#00f0ff');
        grad.addColorStop(1, '#0088cc');
      } else {
        grad.addColorStop(0, '#fff380');
        grad.addColorStop(0.6, '#ffd700');
        grad.addColorStop(1, '#e68a00');
      }
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = 'rgba(20, 24, 34, 0.72)';
    }

    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Sheriff star center pin dot
    if (active) {
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draws a side-profile comic-outlined ACPD police car silhouette directly below the Wanted Stars,
   * and stamps a bold Crimson Red 'X' across it when wrecked!
   */
  _drawPoliceCruiserSilhouette(ctx, cx, cy, isWrecked, isPursuing, time) {
    ctx.save();
    ctx.translate(cx, cy);

    // Side-profile police car body path
    ctx.beginPath();
    ctx.moveTo(-15, 5);
    ctx.lineTo(-15, 0);
    ctx.lineTo(-9, -1);
    ctx.lineTo(-5, -6);
    ctx.lineTo(5, -6);
    ctx.lineTo(9, -1);
    ctx.lineTo(15, 0);
    ctx.lineTo(15, 5);
    ctx.closePath();

    ctx.fillStyle = isWrecked ? '#2a1820' : isPursuing ? '#d8e4f0' : 'rgba(55, 64, 78, 0.82)';
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // ACPD green/black side panel stripe
    ctx.fillStyle = isWrecked ? '#382229' : '#1b4d3e';
    ctx.fillRect(-7, 0.5, 14, 3.2);

    // Roof siren lightbar
    const flashRed = Math.sin(time * 14) > 0;
    ctx.fillStyle = isWrecked ? '#333' : isPursuing ? (flashRed ? '#ff1e38' : '#00aaff') : '#667';
    ctx.fillRect(-2.5, -8.5, 5, 2.5);
    ctx.strokeRect(-2.5, -8.5, 5, 2.5);

    // Front & rear wheels
    [-9, 9].forEach((wx) => {
      ctx.beginPath();
      ctx.arc(wx, 5.5, 3.3, 0, Math.PI * 2);
      ctx.fillStyle = '#111318';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    });

    // Bold Crimson Red 'X' stamped across wrecked police cruiser silhouette!
    if (isWrecked) {
      ctx.beginPath();
      ctx.moveTo(-13, -8);
      ctx.lineTo(13, 8);
      ctx.moveTo(13, -8);
      ctx.lineTo(-13, 8);
      ctx.lineCap = 'round';
      ctx.lineWidth = 6.5;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
      ctx.lineWidth = 3.8;
      ctx.strokeStyle = '#ff1834';
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draws custom comic-outlined Throwable icon (Green Frag Grenade or Flaming Molotov Bottle).
   */
  _drawThrowableComicIcon(ctx, cx, cy, type, time) {
    ctx.save();
    ctx.translate(cx, cy);

    if (type === 'molotov') {
      // Flaming Molotov Cocktail Bottle
      ctx.rotate(0.22);
      this._drawRoundedComicRect(ctx, -6, -3, 12, 17, 3, '#d96b1f', '#000000', 2.8);
      this._drawRoundedComicRect(ctx, -3, -10, 6, 8, 1.5, '#e89b54', '#000000', 2.5);
      // Animated neon flame wick
      const flick = Math.sin(time * 16) * 2;
      ctx.beginPath();
      ctx.moveTo(-2, -10);
      ctx.quadraticCurveTo(-7, -18, 1 + flick, -21);
      ctx.quadraticCurveTo(7, -16, 2, -10);
      ctx.closePath();
      ctx.fillStyle = '#ffee22';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#ff3b00';
      ctx.stroke();
    } else {
      // Green Fragmentation Pineapple Grenade (matching Grand Theft Argon screenshots!)
      ctx.beginPath();
      ctx.ellipse(0, 2, 10, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#53a63b';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      // Pineapple grid lines
      ctx.beginPath();
      ctx.moveTo(-8, -2);
      ctx.lineTo(8, -2);
      ctx.moveTo(-9, 4);
      ctx.lineTo(9, 4);
      ctx.moveTo(0, -9);
      ctx.lineTo(0, 13);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#183610';
      ctx.stroke();

      // Fuse neck & pull pin ring
      ctx.fillStyle = '#9aa5b4';
      ctx.fillRect(-3.5, -13, 7, 4);
      ctx.strokeRect(-3.5, -13, 7, 4);
      ctx.beginPath();
      ctx.arc(-6, -11, 3.5, 0, Math.PI * 2);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#ffd700';
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draws custom crisp comic-outlined illustrations for all 9 weapons.
   */
  _drawWeaponComicIllustration(ctx, cx, cy, weaponId) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (weaponId) {
      case 'mac10': {
        // Silver/Steel MAC-10 Micro-SMG matching Screenshot 2
        // Extended vertical magazine
        this._drawRoundedComicRect(ctx, -3, 2, 7, 15, 1, '#586270', '#000000', 2.8);
        // Pistol grip
        this._drawRoundedComicRect(ctx, 8, 1, 7, 13, 1.5, '#303640', '#000000', 2.8);
        // Boxy upper steel receiver
        this._drawRoundedComicRect(ctx, -18, -9, 36, 12, 2, '#cfd8e3', '#000000', 3.2);
        // Receiver metallic highlight & ejection port
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-15, -7, 30, 3);
        ctx.fillStyle = '#222832';
        ctx.fillRect(-4, -5, 8, 3.5);
        // Barrel & suppressor shroud at left
        this._drawRoundedComicRect(ctx, -32, -6, 15, 6, 1.5, '#7f8a99', '#000000', 2.8);
        // Rear wire stock folded
        ctx.beginPath();
        ctx.moveTo(18, -4);
        ctx.lineTo(28, -4);
        ctx.lineTo(28, 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        break;
      }

      case 'm16': {
        // M16 Assault Rifle matching Screenshot 1
        ctx.beginPath();
        // Stock
        ctx.moveTo(22, -2);
        ctx.lineTo(35, -5);
        ctx.lineTo(35, 6);
        ctx.lineTo(20, 3);
        ctx.closePath();
        ctx.fillStyle = '#2b303a';
        ctx.fill();
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        // Curved magazine
        this._drawRoundedComicRect(ctx, -4, 1, 7, 14, 1.5, '#596373', '#000000', 2.6);
        // Receiver + barrel handguard
        this._drawRoundedComicRect(ctx, -24, -6, 46, 8, 2, '#495261', '#000000', 3.0);
        // Front barrel & sight
        ctx.beginPath();
        ctx.moveTo(-24, -3);
        ctx.lineTo(-37, -3);
        ctx.moveTo(-31, -3);
        ctx.lineTo(-29, -9);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        break;
      }

      case 'shotgun': {
        // Sawed-off Stubby Shotgun
        // Wood stock grip
        this._drawRoundedComicRect(ctx, 12, -1, 18, 9, 3, '#a85c27', '#000000', 2.8);
        // Dual steel barrels
        this._drawRoundedComicRect(ctx, -28, -6, 42, 7, 2, '#99a5b5', '#000000', 3.0);
        // Wood pump forend
        this._drawRoundedComicRect(ctx, -16, 0, 18, 6, 2, '#c77234', '#000000', 2.6);
        break;
      }

      case 'revolver': {
        // Chrome Colt Python .357 Revolver
        this._drawRoundedComicRect(ctx, 9, 0, 9, 13, 2, '#9e5424', '#000000', 2.8);
        this._drawRoundedComicRect(ctx, -24, -7, 36, 7, 1.5, '#dfe7f2', '#000000', 3.0);
        this._drawRoundedComicRect(ctx, -2, -4, 12, 8, 2, '#b8c4d4', '#000000', 2.6);
        break;
      }

      case 'katana': {
        // Gleaming Curved Argon Katana
        ctx.rotate(-0.22);
        // Blade
        ctx.beginPath();
        ctx.moveTo(-36, -2);
        ctx.quadraticCurveTo(-8, -6, 14, -2);
        ctx.lineTo(14, 3);
        ctx.quadraticCurveTo(-8, 0, -32, 3);
        ctx.closePath();
        ctx.fillStyle = '#e8f4ff';
        ctx.fill();
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        // Gold guard (tsuba)
        this._drawRoundedComicRect(ctx, 13, -7, 4, 14, 1, '#ffd700', '#000000', 2.5);
        // Wrapped crimson handle
        this._drawRoundedComicRect(ctx, 17, -3, 18, 6, 1.5, '#d81b3a', '#000000', 2.8);
        break;
      }

      case 'stun_baton': {
        // 1980s Neon Shock Baton with glowing electric cyan arc prongs
        this._drawRoundedComicRect(ctx, 4, -4, 22, 8, 3, '#1e2430', '#000000', 3.0);
        this._drawRoundedComicRect(ctx, -26, -3, 30, 6, 2, '#00e5ff', '#000000', 2.8);
        ctx.fillStyle = '#ff2a85';
        ctx.fillRect(-32, -5, 6, 3);
        ctx.fillRect(-32, 2, 6, 3);
        break;
      }

      case 'flamethrower': {
        // Flamethrower with neon orange pilot flame
        this._drawRoundedComicRect(ctx, -20, -5, 42, 8, 2, '#5c6b73', '#000000', 3.0);
        this._drawRoundedComicRect(ctx, 2, 2, 16, 10, 3, '#ff6600', '#000000', 2.8);
        ctx.beginPath();
        ctx.arc(-27, -1, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffee22';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ff3300';
        ctx.stroke();
        break;
      }

      case 'rpg': {
        // RPG-7 Rocket Launcher
        this._drawRoundedComicRect(ctx, -18, -4, 46, 7, 2, '#5a6e47', '#000000', 3.0);
        // Conical warhead on left
        ctx.beginPath();
        ctx.moveTo(-35, 0);
        ctx.lineTo(-22, -8);
        ctx.lineTo(-17, -3);
        ctx.lineTo(-17, 3);
        ctx.lineTo(-22, 8);
        ctx.closePath();
        ctx.fillStyle = '#b84a27';
        ctx.fill();
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        break;
      }

      case 'fists':
      default: {
        // Golden Spiked Brass Knuckles
        this._drawRoundedComicRect(ctx, -20, -7, 40, 15, 5, '#ffd700', '#000000', 3.2);
        for (let i = -12; i <= 12; i += 8) {
          ctx.beginPath();
          ctx.arc(i, -1, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = '#181c26';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#000000';
          ctx.stroke();
        }
        break;
      }
    }

    ctx.restore();
  }

  /**
   * Draws the Bottom-Left Circular Radar Minimap (168px x 168px) matching the Grand Theft Argon
   * reference screenshots:
   * - Dark charcoal streets (#23262e), vibrant crimson/coral city blocks (#d82236), deep teal water (#134b5f)
   * - Outer circular rim split into Green Health Arc (left) and Cyan Armor Arc (right)
   * - Orbiting black circle 'N' North indicator
   * - Safehouse house icon, Cyan Gas Station Pump icon, 'K' Dealer markers, Rampage skulls,
   *   Stunt Ramp chevrons, Hidden Tiki emeralds, Aircraft radar icons,
   *   flashing ACPD blips, and center White Triangular Player Arrow with bold black comic outline.
   */
  _drawBottomLeftRadarMinimap(ctx, W, H, gameState = {}) {
    const hs = this.hudState;
    const size = 168;
    const radius = size * 0.5;
    const cx = 24 + radius;
    const cy = H - 24 - radius;
    const worldToRadarScale = 0.62; // 1m in world = 0.62px on radar

    ctx.save();

    // 1. Clipped Circular Interior Map
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 7, 0, Math.PI * 2);
    ctx.clip();

    // Deep teal water background (#134b5f)
    ctx.fillStyle = '#134b5f';
    ctx.fillRect(cx - radius, cy - radius, size, size);

    // Translate to center & convert world coords relative to player
    ctx.save();
    ctx.translate(cx, cy);
    // Rotate map by cameraYaw so 'up' on radar matches camera view (or North-up if cameraYaw === 0)
    ctx.rotate(-hs.cameraYaw);

    const px = hs.playerX;
    const pz = hs.playerZ;

    // Draw East Island (Ocean Beach) land mass & pale sand beach strip
    ctx.fillStyle = '#23262e'; // Dark charcoal streets asphalt base
    ctx.fillRect((2 - px) * worldToRadarScale, (-180 - pz) * worldToRadarScale, 92 * worldToRadarScale, 360 * worldToRadarScale);
    // Pale sand beach strip along eastern Ocean Beach
    ctx.fillStyle = '#e5cf9e';
    ctx.fillRect((88 - px) * worldToRadarScale, (-180 - pz) * worldToRadarScale, 28 * worldToRadarScale, 360 * worldToRadarScale);

    // Draw Starfish Island land mass
    ctx.fillStyle = '#23262e';
    ctx.fillRect((-46 - px) * worldToRadarScale, (-42 - pz) * worldToRadarScale, 42 * worldToRadarScale, 84 * worldToRadarScale);

    // Draw West Mainland (Little Haiti & Argon Port Marina) land mass
    ctx.fillStyle = '#23262e';
    ctx.fillRect((-155 - px) * worldToRadarScale, (-180 - pz) * worldToRadarScale, 102 * worldToRadarScale, 360 * worldToRadarScale);

    // Draw Bridges connecting islands
    const bridges = gameState.bridges || this.world?.bridges || DEFAULT_BRIDGES;
    ctx.fillStyle = '#323642';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < bridges.length; i++) {
      const b = bridges[i];
      const bx = (b.x - b.w * 0.5 - px) * worldToRadarScale;
      const bz = (b.z - b.d * 0.5 - pz) * worldToRadarScale;
      const bw = b.w * worldToRadarScale;
      const bd = b.d * worldToRadarScale;
      ctx.fillRect(bx, bz, bw, bd);
      ctx.strokeRect(bx, bz, bw, bd);
    }

    // Draw Infinite Procedural Outer Chunks (landmasses, sandy beach perimeters & N-S / E-W causeways)
    const rawActiveChunks =
      gameState.activeChunks ||
      (typeof this.world?.getActiveChunks === 'function' ? this.world.getActiveChunks() : null) ||
      this.world?.activeChunks ||
      [];
    const activeChunks = Array.isArray(rawActiveChunks)
      ? rawActiveChunks
      : rawActiveChunks instanceof Map
      ? Array.from(rawActiveChunks.values())
      : [];
    for (let i = 0; i < activeChunks.length; i++) {
      const ch = activeChunks[i];
      if (!ch) continue;
      const chCenterX =
        typeof ch.centerX === 'number'
          ? ch.centerX
          : typeof ch.cx === 'number'
          ? ch.cx * 120
          : 0;
      const chCenterZ =
        typeof ch.centerZ === 'number'
          ? ch.centerZ
          : typeof ch.cz === 'number'
          ? ch.cz * 120
          : 0;
      const lr = ch.landRect || {
        minX: chCenterX - 46,
        maxX: chCenterX + 46,
        minZ: chCenterZ - 46,
        maxZ: chCenterZ + 46,
      };
      const br = ch.beachRect;

      // If beachRect is a sandy perimeter around the island, draw it first in #e5cf9e
      const beachIsPerimeter =
        br &&
        br.maxX - br.minX >= lr.maxX - lr.minX &&
        br.maxZ - br.minZ >= lr.maxZ - lr.minZ;
      if (br && beachIsPerimeter) {
        ctx.fillStyle = '#e5cf9e';
        ctx.fillRect(
          (br.minX - px) * worldToRadarScale,
          (br.minZ - pz) * worldToRadarScale,
          (br.maxX - br.minX) * worldToRadarScale,
          (br.maxZ - br.minZ) * worldToRadarScale
        );
      }

      // Draw chunk island/urban base landmass in dark charcoal (#23262e)
      if (lr && typeof lr.minX === 'number') {
        ctx.fillStyle = '#23262e';
        ctx.fillRect(
          (lr.minX - px) * worldToRadarScale,
          (lr.minZ - pz) * worldToRadarScale,
          (lr.maxX - lr.minX) * worldToRadarScale,
          (lr.maxZ - lr.minZ) * worldToRadarScale
        );
      }

      // If beachRect is a coastal beach strip on one side of landRect, draw it on top in #e5cf9e
      if (br && !beachIsPerimeter && typeof br.minX === 'number') {
        ctx.fillStyle = '#e5cf9e';
        ctx.fillRect(
          (br.minX - px) * worldToRadarScale,
          (br.minZ - pz) * worldToRadarScale,
          (br.maxX - br.minX) * worldToRadarScale,
          (br.maxZ - br.minZ) * worldToRadarScale
        );
      }

      // Draw chunk N-S and E-W arterial causeway bridges (#323642 with #000000 border)
      const chunkBridges =
        Array.isArray(ch.bridges) && ch.bridges.length > 0
          ? ch.bridges
          : [
              { x: chCenterX, z: chCenterZ, w: 14, d: 120 },
              { x: chCenterX, z: chCenterZ, w: 120, d: 14 },
            ];
      ctx.fillStyle = '#323642';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.6;
      for (let j = 0; j < chunkBridges.length; j++) {
        const cb = chunkBridges[j];
        if (!cb) continue;
        const cbx =
          cb.minX !== undefined
            ? (cb.minX - px) * worldToRadarScale
            : ((cb.x ?? chCenterX) - (cb.w ?? 14) * 0.5 - px) * worldToRadarScale;
        const cbz =
          cb.minZ !== undefined
            ? (cb.minZ - pz) * worldToRadarScale
            : ((cb.z ?? chCenterZ) - (cb.d ?? 14) * 0.5 - pz) * worldToRadarScale;
        const cbw =
          (cb.minX !== undefined ? cb.maxX - cb.minX : cb.w ?? 14) * worldToRadarScale;
        const cbd =
          (cb.minZ !== undefined ? cb.maxZ - cb.minZ : cb.d ?? 14) * worldToRadarScale;
        ctx.fillRect(cbx, cbz, cbw, cbd);
        ctx.strokeRect(cbx, cbz, cbw, cbd);
      }
    }

    // Draw Vibrant Crimson/Coral City Block Footprints (#d82236) matching Grand Theft Argon minimap!
    const blocks =
      gameState.cityBlocks ||
      this.world?.cityBlocks ||
      (typeof this.world?.getBuildingColliders === 'function'
        ? this.world.getBuildingColliders()
        : null) ||
      DEFAULT_CITY_BLOCKS;
    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      const wVal = blk.w || blk.width || (blk.maxX !== undefined && blk.minX !== undefined ? blk.maxX - blk.minX : 30);
      const dVal = blk.d || blk.depth || (blk.maxZ !== undefined && blk.minZ !== undefined ? blk.maxZ - blk.minZ : 44);
      const cxBlk = blk.x !== undefined ? blk.x : (blk.minX + blk.maxX) * 0.5;
      const czBlk = blk.z !== undefined ? blk.z : (blk.minZ + blk.maxZ) * 0.5;
      const bw = wVal * worldToRadarScale;
      const bd = dVal * worldToRadarScale;
      const bx = (cxBlk - wVal * 0.5 - px) * worldToRadarScale;
      const bz = (czBlk - dVal * 0.5 - pz) * worldToRadarScale;

      // 3D dark crimson extrusion bevel
      ctx.fillStyle = '#80101e';
      ctx.fillRect(bx + 2, bz + 2, bw, bd);

      // Vibrant crimson/coral rooftop footprint (#d82236) or suburban green-lawn / terracotta accent
      const isSuburban = blk.zone === 'suburban' || (blk.name && String(blk.name).toLowerCase().includes('suburb'));
      ctx.fillStyle = isSuburban ? '#e6673d' : '#d82236';
      ctx.fillRect(bx, bz, bw, bd);

      // Crisp black comic outline
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(bx, bz, bw, bd);
    }

    ctx.restore(); // End rotated map layer

    // 2. Draw Radar Blips (clamped to radar edge if far away)
    const maxBlipR = radius - 17;
    const projectBlip = (wx, wz) => {
      const dx = (wx - px) * worldToRadarScale;
      const dz = (wz - pz) * worldToRadarScale;
      const cos = Math.cos(-hs.cameraYaw);
      const sin = Math.sin(-hs.cameraYaw);
      let rx = dx * cos - dz * sin;
      let ry = dx * sin + dz * cos;
      const dist = Math.hypot(rx, ry);
      if (dist > maxBlipR) {
        rx = (rx / dist) * maxBlipR;
        ry = (ry / dist) * maxBlipR;
      }
      return { x: cx + rx, y: cy + ry, clamped: dist > maxBlipR };
    };

    // Safehouse Green House Icon
    const safehouses = gameState.safehouses || this.world?.safehouses || DEFAULT_POIS.safehouses;
    safehouses.forEach((sh) => {
      const pt = projectBlip(sh.x, sh.z);
      this._drawSafehouseRadarIcon(ctx, pt.x, pt.y);
    });

    // Cyan Gas Station Pump Icon (matching Screenshot 1!)
    const gasStations = gameState.gasStations || this.world?.gasStations || DEFAULT_POIS.gasStations;
    gasStations.forEach((gsPoi) => {
      const pt = projectBlip(gsPoi.x, gsPoi.z);
      this._drawGasPumpRadarIcon(ctx, pt.x, pt.y);
    });

    // Yellow 'K' / Dealer Markers
    const dealers = gameState.dealers || this.world?.dealers || DEFAULT_POIS.dealers;
    dealers.forEach((dl) => {
      const pt = projectBlip(dl.x, dl.z);
      this._drawDealerRadarIcon(ctx, pt.x, pt.y);
    });

    // Magenta Rampage Skull Markers
    const rampages = gameState.rampages || this.world?.rampages || DEFAULT_POIS.rampages;
    rampages.forEach((rm) => {
      const pt = projectBlip(rm.x, rm.z);
      this._drawRampageRadarIcon(ctx, pt.x, pt.y);
    });

    // Yellow/Orange Chevron Stunt Ramp Blips (#ffd600)
    const stuntRamps =
      gameState.stuntRamps ||
      (typeof this.world?.getStuntRamps === 'function' ? this.world.getStuntRamps() : null) ||
      this.world?.stuntRamps ||
      [];
    if (Array.isArray(stuntRamps)) {
      for (let i = 0; i < stuntRamps.length; i++) {
        const sr = stuntRamps[i];
        if (!sr) continue;
        const sx = sr.x ?? sr.position?.x;
        const sz = sr.z ?? sr.position?.z;
        if (typeof sx === 'number' && typeof sz === 'number') {
          const pt = projectBlip(sx, sz);
          this._drawStuntRampRadarIcon(ctx, pt.x, pt.y);
        }
      }
    }

    // Glowing Emerald-Gold Diamond / Tiki Blips (#39ff14 with black comic outline)
    const interactables =
      gameState.interactables ||
      (typeof this.world?.getInteractables === 'function' ? this.world.getInteractables() : null) ||
      [];
    if (Array.isArray(interactables)) {
      for (let i = 0; i < interactables.length; i++) {
        const item = interactables[i];
        if (!item || item.collected) continue;
        if (item.type === 'tiki') {
          const ix = item.x ?? item.position?.x;
          const iz = item.z ?? item.position?.z;
          if (typeof ix === 'number' && typeof iz === 'number') {
            const pt = projectBlip(ix, iz);
            this._drawTikiRadarIcon(ctx, pt.x, pt.y);
          }
        }
      }
    }

    // Nearby Jackable Parked Exotic Cars & Non-Exploded Flyable Aircraft Blips
    const allVehicles =
      (Array.isArray(gameState.vehicles) ? gameState.vehicles : null) ||
      (typeof this.trafficSystem?.getVehicles === 'function' ? this.trafficSystem.getVehicles() : null) ||
      (typeof gameState.trafficSystem?.getVehicles === 'function' ? gameState.trafficSystem.getVehicles() : []);
    if (Array.isArray(allVehicles) && allVehicles.length > 0) {
      const parkedCars = allVehicles.filter(
        (v) =>
          v &&
          !v.isPolice &&
          !v.isWrecked &&
          !v.isExploded &&
          v.isParked &&
          !v.isAircraft &&
          v.type !== 'skimmer_plane' &&
          v.type !== 'maverick_heli'
      );
      for (let i = 0; i < parkedCars.length; i++) {
        const v = parkedCars[i];
        const vx = v.x ?? v.position?.x;
        const vz = v.z ?? v.position?.z;
        if (typeof vx === 'number' && typeof vz === 'number') {
          const worldDist = Math.hypot(vx - px, vz - pz);
          // Show parked cars within nearby radar range (~160m) so the player can easily spot jackable exotics
          if (worldDist <= 165) {
            const pt = projectBlip(vx, vz);
            const isPink = v.type === 'infernus' || v.colorHex === '#ff2a85' || i % 2 === 1;
            ctx.save();
            ctx.translate(pt.x, pt.y);
            ctx.beginPath();
            ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
            ctx.fillStyle = isPink ? '#ff4da6' : '#00f0ff';
            ctx.fill();
            ctx.lineWidth = 1.6;
            ctx.strokeStyle = '#000000';
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // Draw Neon-Cyan / Gold Airplane or Helicopter Radar Icon for any non-exploded aircraft
      const aircraftList = allVehicles.filter(
        (v) =>
          v &&
          !v.isWrecked &&
          !v.isExploded &&
          (v.isAircraft || v.type === 'skimmer_plane' || v.type === 'maverick_heli')
      );
      for (let i = 0; i < aircraftList.length; i++) {
        const ac = aircraftList[i];
        const ax = ac.x ?? ac.position?.x;
        const az = ac.z ?? ac.position?.z;
        if (typeof ax === 'number' && typeof az === 'number') {
          const pt = projectBlip(ax, az);
          this._drawAircraftRadarIcon(ctx, pt.x, pt.y, ac.type);
        }
      }
    }

    // Flashing Red/Blue ACPD Police Blips
    const cops =
      gameState.policeCars ||
      gameState.cops ||
      gameState.pursuers ||
      (Array.isArray(allVehicles)
        ? allVehicles.filter((v) => v && v.isPolice && !v.isWrecked && !v.isExploded)
        : []);
    const copFlash = Math.sin(this.elapsedTime * 16) > 0;
    cops.forEach((cop) => {
      const cxPos = cop.x ?? cop.position?.x;
      const czPos = cop.z ?? cop.position?.z;
      if (typeof cxPos === 'number' && typeof czPos === 'number') {
        const pt = projectBlip(cxPos, czPos);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5.2, 0, Math.PI * 2);
        ctx.fillStyle = copFlash ? '#ff1e38' : '#0099ff';
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
      }
    });

    ctx.restore(); // End clipped circular interior

    // 3. Outer Circular Rim: Thick Black Comic Border + Green Health Arc (Left) + Cyan Armor Arc (Right)
    // Dark rim track
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 3.5, 0, Math.PI * 2);
    ctx.lineWidth = 11;
    ctx.strokeStyle = '#0c0e14';
    ctx.stroke();

    // Left Half Arc: Green Health Bar (from bottom Math.PI*0.5 clockwise to top Math.PI*1.5)
    const healthRatio = Math.max(0, Math.min(1, hs.health / Math.max(1, hs.maxHealth)));
    if (healthRatio > 0) {
      const startAngle = Math.PI * 0.52;
      const fullSpan = Math.PI * 0.96;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 3.5, startAngle, startAngle + fullSpan * healthRatio, false);
      ctx.lineWidth = 6.5;
      ctx.strokeStyle = healthRatio < 0.25 && Math.sin(this.elapsedTime * 12) > 0 ? '#ff2a3c' : '#2ee866';
      ctx.stroke();
    }

    // Right Half Arc: Cyan Armor Bar (from bottom Math.PI*0.48 counter-clockwise to top -Math.PI*0.48)
    const armorRatio = Math.max(0, Math.min(1, hs.armor / Math.max(1, hs.maxArmor)));
    if (armorRatio > 0) {
      const startAngle = Math.PI * 0.48;
      const fullSpan = Math.PI * 0.96;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 3.5, startAngle, startAngle - fullSpan * armorRatio, true);
      ctx.lineWidth = 6.5;
      ctx.strokeStyle = '#29d8ff';
      ctx.stroke();
    }

    // Inner & Outer crisp comic black ring borders
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 7.5, 0, Math.PI * 2);
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // 4. Orbiting Black Circle 'N' North Indicator on Radar Rim
    const northAngle = -Math.PI * 0.5 - hs.cameraYaw;
    const nx = cx + Math.cos(northAngle) * (radius - 2);
    const ny = cy + Math.sin(northAngle) * (radius - 2);
    ctx.beginPath();
    ctx.arc(nx, ny, 10.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0d1017';
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    this._drawComicText(ctx, 'N', nx, ny + 4.5, {
      font: '900 13px Impact, "Arial Black", sans-serif',
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 3,
      align: 'center',
    });

    // 5. Center White Triangular Player Arrow with bold black comic outline
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(hs.playerHeading - hs.cameraYaw);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7.5, 8);
    ctx.lineTo(0, 4.5);
    ctx.lineTo(-7.5, 8);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  _drawSafehouseRadarIcon(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(7, -1);
    ctx.lineTo(5, -1);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.lineTo(-5, -1);
    ctx.lineTo(-7, -1);
    ctx.closePath();
    ctx.fillStyle = '#2ee866';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.restore();
  }

  _drawGasPumpRadarIcon(ctx, x, y) {
    // Cyan Gas Station Pump Icon matching Screenshot 1!
    ctx.save();
    ctx.translate(x, y);
    this._drawRoundedComicRect(ctx, -5, -6, 9, 12, 1.5, '#29e2ff', '#000000', 2.2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3, -4, 5, 4);
    // Nozzle hose loop on right
    ctx.beginPath();
    ctx.moveTo(4, -2);
    ctx.quadraticCurveTo(8, -2, 7, 4);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.restore();
  }

  _drawDealerRadarIcon(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    this._drawRoundedComicRect(ctx, -6, -6, 12, 12, 2.5, '#ffd700', '#000000', 2.2);
    this._drawComicText(ctx, 'K', 0, 4, {
      font: '900 10px Impact, "Arial Black", sans-serif',
      fill: '#000000',
      stroke: '#ffffff',
      strokeWidth: 0,
      align: 'center',
    });
    ctx.restore();
  }

  _drawRampageRadarIcon(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ff2a85';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2.5, -2, 2, 2);
    ctx.fillRect(0.5, -2, 2, 2);
    ctx.restore();
  }

  _drawAircraftRadarIcon(ctx, x, y, type) {
    ctx.save();
    ctx.translate(x, y);
    const isHeli = String(type || '').toLowerCase().includes('heli');
    if (isHeli) {
      // Gold & Cyan Helicopter Chopper Radar Icon
      ctx.beginPath();
      ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd700';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
      // Spinning / crossed 4-blade rotor silhouette
      const spin = this.elapsedTime * 7;
      ctx.save();
      ctx.rotate(spin);
      ctx.beginPath();
      ctx.moveTo(-7.5, 0);
      ctx.lineTo(7.5, 0);
      ctx.moveTo(0, -7.5);
      ctx.lineTo(0, 7.5);
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#00f0ff';
      ctx.stroke();
      ctx.restore();
    } else {
      // Neon-Cyan Dodo Skimmer Seaplane Radar Icon
      ctx.beginPath();
      ctx.moveTo(0, -7.5);
      ctx.lineTo(2.2, -2);
      ctx.lineTo(7.5, 1);
      ctx.lineTo(7.5, 3);
      ctx.lineTo(2, 1.5);
      ctx.lineTo(1.8, 5.5);
      ctx.lineTo(4, 7);
      ctx.lineTo(-4, 7);
      ctx.lineTo(-1.8, 5.5);
      ctx.lineTo(-2, 1.5);
      ctx.lineTo(-7.5, 3);
      ctx.lineTo(-7.5, 1);
      ctx.lineTo(-2.2, -2);
      ctx.closePath();
      ctx.fillStyle = '#00f0ff';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawTikiRadarIcon(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -5.5);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 5.5);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fillStyle = '#39ff14';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.restore();
  }

  _drawStuntRampRadarIcon(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(5, 3);
    ctx.lineTo(2, 3);
    ctx.lineTo(0, 0);
    ctx.lineTo(-2, 3);
    ctx.lineTo(-5, 3);
    ctx.closePath();
    ctx.fillStyle = '#ffd600';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draws a Grand Theft Argon comic-outlined Avionics Flight Altimeter & Airspeed Pill
   * at the top-center of the HUD when piloting an aircraft or airborne.
   */
  _drawFlightHudBadge(ctx, W, H) {
    const hs = this.hudState;
    const altFeet = Math.round(hs.altitude * 8.5 + 12);
    const knots = Math.round(hs.vehicleSpeed * 3.2);
    const titleStr = `✈️ ${(hs.aircraftName || 'ARGON AVIATION').toUpperCase()} • ALT: ${altFeet} FT • SPD: ${knots} KTS`;
    const subStr = '[WASD] FLY DIRECTION • [SPACE] CLIMB • [SHIFT] DESCEND • [F] EXIT';

    ctx.save();
    ctx.font = '900 16px Impact, "Arial Black", sans-serif';
    const titleW = ctx.measureText(titleStr).width;
    ctx.font = '800 11.5px "Arial Black", Impact, sans-serif';
    const subW = ctx.measureText(subStr).width;
    const pillW = Math.max(330, Math.ceil(Math.max(titleW, subW) + 34));
    const pillH = 48;
    const pillX = (W - pillW) * 0.5;
    const pillY = 16;

    this._drawRoundedComicRect(
      ctx,
      pillX,
      pillY,
      pillW,
      pillH,
      10,
      'rgba(10, 18, 30, 0.9)',
      '#000000',
      3.5
    );

    // Top neon-cyan cockpit accent stripe
    this._drawRoundedComicRect(
      ctx,
      pillX + 10,
      pillY + 4,
      pillW - 20,
      3,
      1.5,
      '#00f0ff',
      null,
      0
    );

    this._drawComicText(ctx, titleStr, W * 0.5, pillY + 23, {
      font: '900 15.5px Impact, "Arial Black", sans-serif',
      fill: '#00f0ff',
      stroke: '#000000',
      strokeWidth: 4,
      align: 'center',
    });

    this._drawComicText(ctx, subStr, W * 0.5, pillY + 40, {
      font: '800 11px Impact, "Arial Black", sans-serif',
      fill: '#ffd700',
      stroke: '#000000',
      strokeWidth: 3.2,
      align: 'center',
    });

    ctx.restore();
  }

  /**
   * Draws the Top-Left Arcade Callout Feed matching 'NEAR MISS' in Screenshot 2.
   */
  _drawTopLeftArcadeCallouts(ctx, W, H) {
    if (this.callouts.length === 0) return;

    const startX = 26;
    let curY = 44;

    for (let i = 0; i < this.callouts.length; i++) {
      const c = this.callouts[i];
      const t = c.age / c.duration;
      const alpha = t > 0.75 ? Math.max(0, 1 - (t - 0.75) / 0.25) : 1.0;
      const popScale = c.age < 0.14 ? 0.78 + (c.age / 0.14) * 0.28 : 1.0;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(startX, curY);
      ctx.scale(popScale, popScale);
      ctx.rotate(-0.025);

      this._drawComicText(ctx, c.text, 0, 0, {
        font: 'italic 900 28px Impact, "Arial Black", sans-serif',
        fill: c.color || '#ffffff',
        stroke: '#000000',
        strokeWidth: 6.5,
        align: 'left',
      });

      if (c.subtext) {
        this._drawComicText(ctx, c.subtext, 4, 21, {
          font: 'italic 900 15px Impact, "Arial Black", sans-serif',
          fill: '#ffd700',
          stroke: '#000000',
          strokeWidth: 4.5,
          align: 'left',
        });
        curY += 54;
      } else {
        curY += 38;
      }
      ctx.restore();
    }
  }

  /**
   * Draws the Bottom-Right District Stencil Banner ('OCEAN BEACH', styled like 'HOVE BEACH'
   * in Screenshot 1) and the clickable Neon Radio Station Pill ('♪ WAVE 103').
   */
  _drawBottomRightDistrictAndRadio(ctx, W, H) {
    const hs = this.hudState;
    const rightX = W - 24;
    const bottomY = H - 24;

    // 1. District Stencil Banner ('OCEAN BEACH')
    ctx.save();
    const bannerSlide = hs.districtBannerTimer > 3.6 ? (hs.districtBannerTimer - 3.6) * 40 : 0;
    this._drawComicText(ctx, hs.district || 'OCEAN BEACH', rightX + bannerSlide, bottomY, {
      font: 'italic 900 30px Impact, "Arial Black", sans-serif',
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 7,
      align: 'right',
    });

    // Subtle neon underline accent matching Argon City 80s + Grand Theft Argon stencil
    ctx.font = 'italic 900 30px Impact, "Arial Black", sans-serif';
    const distW = Math.min(260, ctx.measureText(hs.district || 'OCEAN BEACH').width);
    this._drawRoundedComicRect(
      ctx,
      rightX - distW,
      bottomY + 6,
      distW,
      5,
      2,
      '#ff2a85',
      '#000000',
      2
    );
    ctx.restore();

    // 2. Compact Neon Radio Station Pill right above the District Banner
    const station = this.audio.getCurrentRadioStation();
    const pillW = 166;
    const pillH = 30;
    const pillX = rightX - pillW;
    const pillY = bottomY - 64;

    this.hitRegions.radio = { x: pillX, y: pillY, w: pillW, h: pillH };

    this._drawRoundedComicRect(
      ctx,
      pillX,
      pillY,
      pillW,
      pillH,
      15,
      'rgba(14, 18, 28, 0.88)',
      '#000000',
      3.2
    );

    // Animated equalizer bars inside pill
    for (let b = 0; b < 3; b++) {
      const bh =
        station.id === 'off'
          ? 3
          : 5 + Math.abs(Math.sin(this.elapsedTime * (8 + b * 3) + b)) * 12;
      ctx.fillStyle = station.color || '#00f0ff';
      ctx.fillRect(pillX + 13 + b * 5, pillY + 21 - bh, 3.5, bh);
    }

    this._drawComicText(ctx, `♪ ${station.name}`, pillX + 34, pillY + 21, {
      font: '900 15px Impact, "Arial Black", sans-serif',
      fill: station.color || '#00f0ff',
      stroke: '#000000',
      strokeWidth: 4,
      align: 'left',
    });

    // 3. Compact Comic-Outlined World Chunk Sector Pill right above the Radio Pill
    const cx = typeof hs.chunkX === 'number' ? hs.chunkX : Math.round((hs.playerX || 0) / 120);
    const cz = typeof hs.chunkZ === 'number' ? hs.chunkZ : Math.round((hs.playerZ || 0) / 120);
    const isOuter = Boolean(hs.isOuterChunk ?? (Math.abs(cx) > 1 || Math.abs(cz) > 1));
    const chunkText = isOuter
      ? `🌐 PROCEDURAL CHUNK (${cx}, ${cz}) • INFINITE WORLD`
      : `🌐 CHUNK (${cx}, ${cz}) • ARGON CORE`;

    ctx.save();
    ctx.font = '900 12px Impact, "Arial Black", sans-serif';
    const chunkTextW = ctx.measureText(chunkText).width;
    const chunkPillW = Math.max(166, Math.ceil(chunkTextW + 24));
    const chunkPillH = 25;
    const chunkPillX = rightX - chunkPillW;
    const chunkPillY = pillY - chunkPillH - 7;

    this._drawRoundedComicRect(
      ctx,
      chunkPillX,
      chunkPillY,
      chunkPillW,
      chunkPillH,
      12,
      isOuter ? 'rgba(8, 28, 34, 0.92)' : 'rgba(14, 18, 28, 0.86)',
      isOuter ? '#00f0ff' : '#000000',
      2.8
    );

    const pulseCyanGreen =
      isOuter && Math.sin(this.elapsedTime * 6) > 0 ? '#39ff14' : '#00f0ff';
    this._drawComicText(ctx, chunkText, chunkPillX + chunkPillW * 0.5, chunkPillY + 17.5, {
      font: '900 12px Impact, "Arial Black", sans-serif',
      fill: isOuter ? pulseCyanGreen : '#00f0ff',
      stroke: '#000000',
      strokeWidth: 3.6,
      align: 'center',
    });
    ctx.restore();
  }

  _drawVoiceSubtitleBanner(ctx, W, H, sub) {
    ctx.save();
    const text = `${sub.speaker}: "${sub.text}"`;
    ctx.font = '700 16px "Arial Black", sans-serif';
    const tw = Math.min(W - 420, ctx.measureText(text).width + 36);
    const bx = (W - tw) * 0.5;
    const by = H - 56;

    this._drawRoundedComicRect(
      ctx,
      bx,
      by,
      tw,
      34,
      8,
      sub.isDispatch ? 'rgba(10, 26, 42, 0.9)' : 'rgba(20, 14, 28, 0.9)',
      sub.isDispatch ? '#00f0ff' : '#ff2a85',
      2.8
    );

    this._drawComicText(ctx, text, W * 0.5, by + 23, {
      font: '700 15px Impact, "Arial Black", sans-serif',
      fill: sub.isDispatch ? '#80f8ff' : '#ffffff',
      stroke: '#000000',
      strokeWidth: 4,
      align: 'center',
    });
    ctx.restore();
  }

  /**
   * Projects active 3D pedestrian speech bubbles onto the 2D HUD canvas and draws
   * authentic Grand Theft Argon graphic-novel speech balloons (#fffdf5 chat, #fff176 panic,
   * #ffd0e6 insult) with a bold 3px black ink border, 4px black drop shadow, triangular
   * pointer tail, speaker tag badge ('MIAMI LOCAL', 'BEACH SKATER', 'WALL ST YUPPIE'),
   * and bold dark comic-lettered dialogue text.
   */
  _drawFloatingSpeechBubbles(ctx, W, H) {
    if (!this.camera || !Array.isArray(this.speechBubbles) || this.speechBubbles.length === 0) {
      return;
    }

    for (let i = 0; i < this.speechBubbles.length; i++) {
      const b = this.speechBubbles[i];
      if (!b || !b.text) continue;

      const v = new THREE.Vector3(b.x, b.y, b.z).project(this.camera);
      if (!(v.z < 1 && v.z > -1)) continue;

      const rawSx = (v.x * 0.5 + 0.5) * W;
      const rawSy = (-v.y * 0.5 + 0.5) * H;
      if (rawSx < -120 || rawSx > W + 120 || rawSy < -120 || rawSy > H + 120) continue;

      // Pop-in & fade-out envelope over 3.8s lifetime
      const t = b.age / Math.max(0.1, b.duration || 3.8);
      const popScale = b.age < 0.14 ? 0.72 + (b.age / 0.14) * 0.28 : 1.0;
      const alpha = t > 0.82 ? Math.max(0, 1 - (t - 0.82) / 0.18) : 1.0;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Word-wrap comic dialogue into 1-3 lines (max width ~248px)
      ctx.font = '800 12.5px "Arial Black", Impact, sans-serif';
      const maxLineW = 246;
      const words = String(b.text).split(/\s+/);
      const lines = [];
      let currentLine = '';
      for (let w = 0; w < words.length; w++) {
        const testLine = currentLine ? `${currentLine} ${words[w]}` : words[w];
        if (ctx.measureText(testLine).width > maxLineW && currentLine) {
          lines.push(currentLine);
          currentLine = words[w];
          if (lines.length >= 2) {
            // Append remaining words to line 3 with ellipsis if very long
            const rest = words.slice(w).join(' ');
            currentLine = rest.length > 44 ? `${rest.slice(0, 41)}...` : rest;
            break;
          }
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      let maxMeasuredW = 140;
      for (let l = 0; l < lines.length; l++) {
        maxMeasuredW = Math.max(maxMeasuredW, ctx.measureText(lines[l]).width);
      }

      const padX = 14;
      const padTop = 16;
      const lineH = 16;
      const boxW = Math.min(284, Math.ceil(maxMeasuredW + padX * 2));
      const boxH = Math.ceil(padTop + lines.length * lineH + 9);
      const tailH = 12;

      // Clamp balloon horizontally & vertically so it remains readable on screen
      // and avoids overlapping another active speech bubble
      let anchorX = Math.max(boxW * 0.5 + 18, Math.min(W - boxW * 0.5 - 18, rawSx));
      let anchorY = Math.max(boxH + tailH + 28, Math.min(H - 90, rawSy - i * 18));

      ctx.translate(anchorX, anchorY);
      ctx.scale(popScale, popScale);

      const bx = -boxW * 0.5;
      const by = -boxH - tailH;
      const tailTipX = Math.max(bx + 18, Math.min(bx + boxW - 18, rawSx - anchorX));
      const radius = 10;

      // Helper to trace rounded comic speech balloon + triangular pointer tail path
      const traceBalloonPath = (ox, oy) => {
        const x0 = bx + ox;
        const y0 = by + oy;
        const x1 = x0 + boxW;
        const y1 = y0 + boxH;
        const r = radius;
        const tLeft = Math.max(x0 + r + 4, Math.min(x1 - r - 20, tailTipX - 8 + ox));
        const tRight = Math.min(x1 - r - 4, tLeft + 16);

        ctx.beginPath();
        ctx.moveTo(x0 + r, y0);
        ctx.lineTo(x1 - r, y0);
        ctx.quadraticCurveTo(x1, y0, x1, y0 + r);
        ctx.lineTo(x1, y1 - r);
        ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
        // Bottom edge with triangular comic pointer tail pointing down at speaker
        ctx.lineTo(tRight, y1);
        ctx.lineTo(tailTipX + ox, oy);
        ctx.lineTo(tLeft, y1);
        ctx.lineTo(x0 + r, y1);
        ctx.quadraticCurveTo(x0, y1, x0, y1 - r);
        ctx.lineTo(x0, y0 + r);
        ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
        ctx.closePath();
      };

      // 1. 4px Black Comic Drop Shadow
      traceBalloonPath(4, 4);
      ctx.fillStyle = '#000000';
      ctx.fill();

      // 2. Comic Balloon Fill (#fffdf5 chat, #fff176 panic, #ffd0e6 insult) + Bold 3px Black Ink Border
      const fillBg =
        b.style === 'panic' ? '#fff176' : b.style === 'insult' ? '#ffd0e6' : '#fffdf5';
      traceBalloonPath(0, 0);
      ctx.fillStyle = fillBg;
      ctx.fill();
      ctx.lineWidth = 3.0;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      // 3. Speaker Tag Badge ('MIAMI LOCAL', 'BEACH SKATER', 'WALL ST YUPPIE')
      const speakerTag = String(b.speaker || 'MIAMI LOCAL').toUpperCase();
      ctx.font = '900 10px Impact, "Arial Black", sans-serif';
      const badgeW = Math.ceil(ctx.measureText(speakerTag).width + 16);
      const badgeH = 16;
      const badgeX = bx + 10;
      const badgeY = by - 9;
      const badgeFill =
        b.style === 'panic' ? '#ff2a3c' : b.style === 'insult' ? '#ff2a85' : '#00e5ff';
      const badgeTextColor = b.style === 'chat' ? '#080b12' : '#ffffff';

      this._drawRoundedComicRect(
        ctx,
        badgeX + 2,
        badgeY + 2,
        badgeW,
        badgeH,
        4,
        '#000000',
        '#000000',
        1
      );
      this._drawRoundedComicRect(
        ctx,
        badgeX,
        badgeY,
        badgeW,
        badgeH,
        4,
        badgeFill,
        '#000000',
        2.2
      );
      ctx.fillStyle = badgeTextColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(speakerTag, badgeX + 8, badgeY + badgeH * 0.5 + 0.5);

      // 4. Bold Dark Comic-Lettered Dialogue Text
      ctx.font = '800 12.5px "Arial Black", Impact, sans-serif';
      ctx.fillStyle = '#101218';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      for (let l = 0; l < lines.length; l++) {
        ctx.fillText(lines[l], bx + padX, by + padTop + 10 + l * lineH);
      }

      ctx.restore();
    }
  }

  /**
   * Draws the 1980s Neon Radial Weapon Wheel when holding Q or clicking the Weapon HUD icon.
   */
  _drawNeonRadialWeaponWheel(ctx, W, H) {
    const cx = W * 0.5;
    const cy = H * 0.5;
    const outerR = 178;
    const innerR = 64;
    const count = WEAPON_CATALOG.length;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 18, 0.55)';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < count; i++) {
      const wep = WEAPON_CATALOG[i];
      const startA = (i / count) * Math.PI * 2 - Math.PI * 0.5 - Math.PI / count;
      const endA = startA + (Math.PI * 2) / count;
      const midA = (startA + endA) * 0.5;
      const isHovered = i === this.hudState.hoveredWheelSlot;
      const isEquipped = wep.id === this.hudState.weaponId;

      ctx.beginPath();
      ctx.arc(cx, cy, isHovered ? outerR + 10 : outerR, startA + 0.02, endA - 0.02);
      ctx.arc(cx, cy, innerR, endA - 0.02, startA + 0.02, true);
      ctx.closePath();

      ctx.fillStyle = isHovered
        ? 'rgba(255, 42, 133, 0.88)'
        : isEquipped
        ? 'rgba(0, 240, 255, 0.45)'
        : 'rgba(18, 22, 34, 0.88)';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = isHovered ? '#ffee22' : '#000000';
      ctx.stroke();

      // Draw custom weapon icon in sector
      const iconR = (outerR + innerR) * 0.52;
      const ix = cx + Math.cos(midA) * iconR;
      const iy = cy + Math.sin(midA) * iconR;
      ctx.save();
      ctx.translate(ix, iy);
      ctx.scale(0.75, 0.75);
      this._drawWeaponComicIllustration(ctx, 0, 0, wep.id);
      ctx.restore();
    }

    // Center hub showing hovered weapon name & ammo
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 6, 0, Math.PI * 2);
    ctx.fillStyle = '#121622';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#00f0ff';
    ctx.stroke();

    const hoveredWep = WEAPON_CATALOG[this.hudState.hoveredWheelSlot] || WEAPON_CATALOG[4];
    this._drawComicText(ctx, hoveredWep.shortName, cx, cy - 2, {
      font: '900 16px Impact, "Arial Black", sans-serif',
      fill: '#ffee22',
      stroke: '#000000',
      strokeWidth: 4,
      align: 'center',
    });
    this._drawComicText(ctx, hoveredWep.defaultAmmo, cx, cy + 18, {
      font: '900 14px Impact, "Arial Black", sans-serif',
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 3.5,
      align: 'center',
    });

    ctx.restore();
  }

  /**
   * Draws responsive Virtual Touch Controls on touch devices or when ?touch=1 is set.
   */
  _drawVirtualTouchControls(ctx, W, H) {
    ctx.save();
    // Left thumbstick ring (placed to the right of the radar minimap)
    const lx = this.touchState._leftStickOrigin?.x || 245;
    const ly = this.touchState._leftStickOrigin?.y || H - 96;
    ctx.beginPath();
    ctx.arc(lx, ly, 46, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18, 22, 34, 0.45)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
    ctx.stroke();

    const kx = this.touchState._leftStickCurrent?.x || lx;
    const ky = this.touchState._leftStickCurrent?.y || ly;
    ctx.beginPath();
    ctx.arc(kx, ky, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Right aim/fire pad
    const rx = this.touchState._rightPadOrigin?.x || W - 235;
    const ry = this.touchState._rightPadOrigin?.y || H - 96;
    ctx.beginPath();
    ctx.arc(rx, ry, 44, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34, 14, 26, 0.48)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 42, 133, 0.8)';
    ctx.stroke();
    this._drawComicText(ctx, 'FIRE', rx, ry + 6, {
      font: '900 15px Impact, "Arial Black", sans-serif',
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 3.5,
      align: 'center',
    });
    ctx.restore();
  }

  // ==========================================================================
  // LOW-LEVEL COMIC VECTOR DRAWING HELPERS
  // ==========================================================================

  _drawRoundedComicRect(ctx, x, y, w, h, r, fill, stroke = '#000000', lineWidth = 3) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (lineWidth > 0 && stroke) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  _drawComicText(ctx, text, x, y, opts = {}) {
    ctx.save();
    ctx.font = opts.font || '900 20px Impact, "Arial Black", sans-serif';
    ctx.textAlign = opts.align || 'left';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    if ((opts.strokeWidth ?? 4) > 0) {
      ctx.lineWidth = opts.strokeWidth ?? 4;
      ctx.strokeStyle = opts.stroke || '#000000';
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = opts.fill || '#ffffff';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}

export default VFXHudAndAudioSystem;
