import * as THREE from '../assets/vendor/three.module.js';

/**
 * Grand Theft Argon: Argon City Stories / Grand Theft Argon — Vehicle Physics, Traffic & ACPD Pursuit AI
 * Three.js r160 ES Module
 *
 * Features:
 * - 9 iconic 1980s cel-shaded vehicles & speedboats with comic-book black ink outlines
 *   (cheetah, infernus, vcpd_cruiser, vcpd_cheetah, swat_enforcer, cuban_hermes,
 *    kaufman_cab, pcj600, cigarette_boat)
 * - Abundant curbside parked jackable vehicles & polite two-way lane traffic along
 *   Ocean Drive, Washington Ave, Starfish Causeway, Little Haiti Blvd & Argon Port
 * - Traffic AI yields/stops when player is in front or walks up to carjack a ride
 * - Arcade top-down handling with Spacebar handbrake power-slide drifting, dual tire
 *   skidmark ribbons, burnout smoke, and "DRIFT BONUS!" callouts
 * - Marine speedboat physics on water (bow pitch, turn banking, wave bounce, V-wake foam)
 * - High-speed Near Miss detection ("NEAR MISS +$100")
 * - Exotic car hotwire hook (onRequestHotwire) & NPC driver ejection hook (onCarjackVehicle)
 * - 4-stage progressive vehicle damage (<65% steam, <35% black smoke, <15% hood fire
 *   with 4.5s fuse, <=0% cel-shaded comic fireball detonation & scorched chassis)
 * - Crime-only Grand Theft Argon Cop-Takedown Wanted System (0..5 Stars, copsRequired vs
 *   copsWrecked, 3.0x player-to-cop ramming damage + wall-slam takedowns, floating 3D
 *   Red X marker over wrecked police cars, full Pursuit Escape / Evasion cooldown timer,
 *   4-star spike-strip roadblocks, 5-star ACPD Helicopter)
 * - Zero dynamic PointLights (constant shader count via emissive sirens + additive ground discs)
 */

const VEHICLE_SPECS = {
  cheetah: {
    name: 'Cheetah GT',
    maxSpeed: 44,
    reverseSpeed: 16,
    accel: 30,
    brake: 38,
    turnSpeed: 3.4,
    driftGrip: 0.92,
    maxHealth: 160,
    mass: 1.25,
    width: 2.1,
    length: 4.5,
    height: 1.22,
    isPolice: false,
    isBoat: false,
    exotic: true,
    palette: ['#e6192e', '#ff2a85', '#00e5ff', '#ffd600'],
  },
  infernus: {
    name: 'Infernus V12',
    maxSpeed: 45,
    reverseSpeed: 16,
    accel: 31,
    brake: 38,
    turnSpeed: 3.25,
    driftGrip: 0.91,
    maxHealth: 145,
    mass: 1.3,
    width: 2.15,
    length: 4.6,
    height: 1.2,
    isPolice: false,
    isBoat: false,
    exotic: true,
    palette: ['#f5f7fa', '#00b0ff', '#ff6d00', '#e040fb'],
  },
  vcpd_cruiser: {
    name: 'ACPD Patrol Cruiser',
    maxSpeed: 38,
    reverseSpeed: 15,
    accel: 26,
    brake: 34,
    turnSpeed: 3.15,
    driftGrip: 0.93,
    maxHealth: 100,
    mass: 1.35,
    width: 2.05,
    length: 4.65,
    height: 1.48,
    isPolice: true,
    isBoat: false,
    exotic: false,
    palette: ['#1b7a43'],
  },
  vcpd_cheetah: {
    name: 'ACPD Metro Squad Cheetah',
    maxSpeed: 44,
    reverseSpeed: 16,
    accel: 30,
    brake: 38,
    turnSpeed: 3.5,
    driftGrip: 0.92,
    maxHealth: 110,
    mass: 1.3,
    width: 2.1,
    length: 4.5,
    height: 1.25,
    isPolice: true,
    isBoat: false,
    exotic: true,
    palette: ['#00bfa5', '#1a237e'],
  },
  swat_enforcer: {
    name: 'ACPD SWAT Enforcer',
    maxSpeed: 31,
    reverseSpeed: 12,
    accel: 21,
    brake: 32,
    turnSpeed: 2.45,
    driftGrip: 0.95,
    maxHealth: 160,
    mass: 2.5,
    width: 2.35,
    length: 5.4,
    height: 2.15,
    isPolice: true,
    isBoat: false,
    exotic: false,
    palette: ['#102542'],
  },
  cuban_hermes: {
    name: 'Cuban Hermes',
    maxSpeed: 35,
    reverseSpeed: 14,
    accel: 23,
    brake: 32,
    turnSpeed: 2.95,
    driftGrip: 0.9,
    maxHealth: 120,
    mass: 1.45,
    width: 2.05,
    length: 4.7,
    height: 1.42,
    isPolice: false,
    isBoat: false,
    exotic: false,
    palette: ['#b71c1c', '#311b92', '#1b5e20'],
  },
  kaufman_cab: {
    name: 'Kaufman Cab',
    maxSpeed: 34,
    reverseSpeed: 14,
    accel: 22,
    brake: 33,
    turnSpeed: 3.05,
    driftGrip: 0.92,
    maxHealth: 105,
    mass: 1.3,
    width: 2.0,
    length: 4.55,
    height: 1.48,
    isPolice: false,
    isBoat: false,
    exotic: false,
    palette: ['#ffca00'],
  },
  pcj600: {
    name: 'PCJ-600 Superbike',
    maxSpeed: 46,
    reverseSpeed: 12,
    accel: 35,
    brake: 40,
    turnSpeed: 4.1,
    driftGrip: 0.9,
    maxHealth: 90,
    mass: 0.65,
    width: 0.95,
    length: 2.35,
    height: 1.18,
    isPolice: false,
    isBoat: false,
    exotic: false,
    palette: ['#ff1744', '#00e5ff', '#ffd600', '#ffffff'],
  },
  cigarette_boat: {
    name: 'Argon Nights Cigarette 38',
    maxSpeed: 48,
    reverseSpeed: 14,
    accel: 29,
    brake: 26,
    turnSpeed: 2.85,
    driftGrip: 0.94,
    maxHealth: 150,
    mass: 1.6,
    width: 2.5,
    length: 7.4,
    height: 1.45,
    isPolice: false,
    isBoat: true,
    exotic: true,
    palette: ['#ffffff'],
  },
  skimmer_plane: {
    name: 'Dodo Skimmer Seaplane',
    maxSpeed: 54,
    reverseSpeed: 12,
    accel: 32,
    brake: 28,
    turnSpeed: 2.6,
    driftGrip: 0.96,
    maxHealth: 180,
    mass: 1.5,
    width: 3.2,
    length: 5.6,
    height: 1.85,
    isPolice: false,
    isBoat: false,
    isAircraft: true,
    aircraftType: 'plane',
    exotic: true,
    palette: ['#ffffff', '#ff2a85', '#00e5ff'],
  },
  maverick_heli: {
    name: 'Argon Maverick Chopper',
    maxSpeed: 50,
    reverseSpeed: 16,
    accel: 30,
    brake: 30,
    turnSpeed: 3.1,
    driftGrip: 0.95,
    maxHealth: 180,
    mass: 1.6,
    width: 2.6,
    length: 5.4,
    height: 2.1,
    isPolice: false,
    isBoat: false,
    isAircraft: true,
    aircraftType: 'heli',
    exotic: true,
    palette: ['#ffffff', '#00e5ff', '#ff2a85'],
  },
  deluxo: {
    name: "Deluxo '86 Gullwing",
    maxSpeed: 46,
    reverseSpeed: 16,
    accel: 33,
    brake: 39,
    turnSpeed: 3.45,
    driftGrip: 0.92,
    maxHealth: 165,
    mass: 1.3,
    width: 2.1,
    length: 4.55,
    height: 1.22,
    isPolice: false,
    isBoat: false,
    isAircraft: false,
    exotic: true,
    palette: ['#cfd8dc', '#00e5ff'],
  },
  sabre_turbo: {
    name: 'Sabre Turbo V8',
    maxSpeed: 44,
    reverseSpeed: 16,
    accel: 32,
    brake: 36,
    turnSpeed: 3.3,
    driftGrip: 0.9,
    maxHealth: 165,
    mass: 1.45,
    width: 2.1,
    length: 4.7,
    height: 1.36,
    isPolice: false,
    isBoat: false,
    isAircraft: false,
    exotic: false,
    palette: ['#d50000', '#1a237e', '#ffab00'],
  },
  mr_whoopee: {
    name: 'Cherry Popper Ice Cream Van',
    maxSpeed: 33,
    reverseSpeed: 13,
    accel: 22,
    brake: 30,
    turnSpeed: 2.65,
    driftGrip: 0.94,
    maxHealth: 155,
    mass: 2.1,
    width: 2.25,
    length: 5.1,
    height: 2.05,
    isPolice: false,
    isBoat: false,
    isAircraft: false,
    exotic: false,
    palette: ['#ff80ab'],
  },
};

const TRAFFIC_ROSTER = [
  'kaufman_cab',
  'cuban_hermes',
  'cheetah',
  'deluxo',
  'sabre_turbo',
  'kaufman_cab',
  'infernus',
  'pcj600',
  'mr_whoopee',
  'cuban_hermes',
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function lerpAngle(a, b, t) {
  const diff = wrapAngle(b - a);
  return wrapAngle(a + diff * t);
}

/**
 * Builds a 4-band cel-shading gradient DataTexture (works in browser & headless Node)
 */
function createCelGradientTexture() {
  const data = new Uint8Array([
    144, 140, 158, 255,
    198, 196, 212, 255,
    240, 238, 248, 255,
    255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a soft radial glow RGBA DataTexture for additive ground discs & light cones
 */
function createRadialGlowTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = Math.max(0, 1 - dist);
      const falloff = Math.pow(alpha, 1.85);
      const idx = (y * size + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.round(falloff * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a soft elliptical dark contact shadow RGBA DataTexture under vehicles
 */
function createShadowBlobTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / (half * 0.88);
      const dy = (y - half) / (half * 0.94);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = clamp(1 - Math.pow(dist, 2.2), 0, 1);
      const idx = (y * size + x) * 4;
      data[idx] = 6;
      data[idx + 1] = 8;
      data[idx + 2] = 14;
      data[idx + 3] = Math.round(alpha * 195);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a high-contrast Grand Theft Argon cabin glass texture (#0f1722 dark navy
 * with black rubber gasket border and sharp diagonal cyan-white reflection slash)
 */
function createCabinGlassTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const border = x < 4 || x >= size - 4 || y < 4 || y >= size - 4;
      const diag = x + y;
      if (border) {
        data[idx] = 8;
        data[idx + 1] = 10;
        data[idx + 2] = 16;
        data[idx + 3] = 255;
      } else if (diag >= 42 && diag <= 50) {
        data[idx] = 185;
        data[idx + 1] = 248;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      } else if (diag >= 54 && diag <= 57) {
        data[idx] = 90;
        data[idx + 1] = 215;
        data[idx + 2] = 245;
        data[idx + 3] = 255;
      } else {
        data[idx] = 15;
        data[idx + 1] = 23;
        data[idx + 2] = 34;
        data[idx + 3] = 255;
      }
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export class VehicleTrafficPoliceSystem {
  constructor(scene, world, callbacks = {}) {
    this.scene = scene;
    this.world = world;
    this.callbacks = {
      onExplosion: callbacks.onExplosion || null,
      onVehicleExplode: callbacks.onVehicleExplode || null,
      onSpark: callbacks.onSpark || null,
      onCallout: callbacks.onCallout || null,
      onCopTakedown: callbacks.onCopTakedown || null,
      onWantedChange: callbacks.onWantedChange || null,
      onRequestHotwire: callbacks.onRequestHotwire || null,
      onCarjackVehicle: callbacks.onCarjackVehicle || null,
      onPursuitEscaped: callbacks.onPursuitEscaped || null,
      onPlaySound: callbacks.onPlaySound || null,
    };

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'VehicleTrafficPoliceRoot';
    if (this.scene) {
      this.scene.add(this.rootGroup);
    }

    this.celGradient = createCelGradientTexture();
    this.glowTexture = createRadialGlowTexture(64);
    this.shadowTexture = createShadowBlobTexture(64);
    this.cabinGlassTexture = createCabinGlassTexture(64);
    this.topTextureCache = new Map();

    // Shared materials for performance
    this.inkMaterial = new THREE.LineBasicMaterial({
      color: 0x090a10,
      transparent: false,
    });
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      map: this.shadowTexture,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.tireMaterial = new THREE.MeshToonMaterial({
      color: 0x14161b,
      gradientMap: this.celGradient,
    });
    this.rimMaterial = new THREE.MeshToonMaterial({
      color: 0xe5e9f0,
      gradientMap: this.celGradient,
    });
    this.chromeMaterial = new THREE.MeshToonMaterial({
      color: 0xeceff4,
      gradientMap: this.celGradient,
    });
    this.darkTrimMaterial = new THREE.MeshToonMaterial({
      color: 0x181b22,
      gradientMap: this.celGradient,
    });
    this.cabinGlassMaterial = new THREE.MeshToonMaterial({
      color: 0xffffff,
      map: this.cabinGlassTexture,
      gradientMap: this.celGradient,
    });
    this.glassMaterial = new THREE.MeshToonMaterial({
      color: 0x1a2636,
      transparent: true,
      opacity: 0.86,
      gradientMap: this.celGradient,
    });
    this.headlightMat = new THREE.MeshBasicMaterial({
      color: 0xfff8c4,
    });
    this.amberSignalMat = new THREE.MeshBasicMaterial({
      color: 0xffab00,
    });
    this.headlightConeMat = new THREE.MeshBasicMaterial({
      color: 0xfff3b0,
      map: this.glowTexture,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.taillightMat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
    });
    this.scorchMaterial = new THREE.MeshToonMaterial({
      color: 0x1f1f24,
      gradientMap: this.celGradient,
    });

    // State containers
    this.vehicles = [];
    this.nextVehicleId = 1;
    this.playerVehicle = null;
    this.time = 0;

    // Skidmark & Wake & Particle FX pools
    this.skidMarks = [];
    this.waterWakes = [];
    this.particles = [];
    this.roadblocks = [];
    this.heliTracers = [];

    this.fxGroup = new THREE.Group();
    this.fxGroup.name = 'VehicleFXGroup';
    this.rootGroup.add(this.fxGroup);

    // Grand Theft Argon Wanted, Cop-Takedown & Escape State (0..5 Stars)
    this.wantedStars = 0;
    this.wantedHeat = 0;
    this.copsRequired = 0;
    this.copsWrecked = 0;
    this.totalCopsWrecked = 0;
    this.pursuitSpawnTimer = 0;
    this.roadblockSpawnTimer = 0;
    this.copsSpawnedForCurrentStar = 0;

    // Pursuit Evasion / Escape Cooldown State
    this.escapeTimer = 0;
    this.escapeDuration = 5.5;
    this.escapeProgress = 0;
    this.isEvading = false;
    this.timeSinceLastCrime = 999;
    this.pursuitSpawnGraceTimer = 0;

    // 5-Star ACPD Police Helicopter (pre-allocated, toggled visible at 5 stars)
    this.policeHeli = this._createPoliceHelicopter();
    this.policeHeli.group.visible = false;
    this.rootGroup.add(this.policeHeli.group);

    // Populate initial curbside jackable cars, moored speedboats & orderly two-way road traffic
    this._spawnInitialWorldVehicles();
  }

  // ============================================================================
  // INITIAL WORLD VEHICLES (CURBSIDE JACKABLE RIDES, SPEEDBOATS & LANE TRAFFIC)
  // ============================================================================

  _spawnInitialWorldVehicles() {
    // 1. Curbside Parked Jackable Vehicles along Ocean Drive, Washington Ave, Starfish & Little Haiti
    // Specifically placed around player's starting spot on Ocean Drive (x = 80, z = -26):
    const parkedSpawns = [
      // Right on Ocean Drive near player spawn (x = 80, z = -26), aligned cleanly along the West/East curbs
      {
        type: 'cheetah',
        x: 73.6,
        z: -24,
        rotationY: 0,
        colorHex: '#e6192e',
        striped: true,
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 220,
      },
      {
        type: 'infernus',
        x: 73.6,
        z: -15,
        rotationY: 0,
        colorHex: '#ff2a85',
        requiresHotwire: true,
        isHotwired: false,
        maxHealth: 180,
      },
      {
        type: 'cheetah',
        x: 86.2,
        z: -20,
        rotationY: Math.PI,
        colorHex: '#00e5ff',
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 200,
      },
      {
        type: 'kaufman_cab',
        x: 73.6,
        z: -34,
        rotationY: 0,
        requiresHotwire: false,
        isHotwired: true,
      },
      {
        type: 'cuban_hermes',
        x: 86.2,
        z: -8,
        rotationY: Math.PI,
        colorHex: '#b71c1c',
        requiresHotwire: false,
        isHotwired: true,
      },
      {
        type: 'pcj600',
        x: 86.2,
        z: -38,
        rotationY: Math.PI,
        colorHex: '#00e5ff',
        requiresHotwire: false,
        isHotwired: true,
      },
      {
        type: 'cheetah',
        x: 73.6,
        z: 8,
        rotationY: 0,
        colorHex: '#ffd600',
        requiresHotwire: true,
        isHotwired: false,
      },
      {
        type: 'infernus',
        x: 86.2,
        z: 24,
        rotationY: Math.PI,
        colorHex: '#f5f7fa',
        requiresHotwire: false,
        isHotwired: true,
      },
      // Argon Gas '86 forecourt (x = 61, z = -34) & North/South Ocean Drive
      {
        type: 'cuban_hermes',
        x: 61.0,
        z: -34,
        rotationY: 0,
        colorHex: '#311b92',
        requiresHotwire: false,
        isHotwired: true,
      },
      {
        type: 'kaufman_cab',
        x: 73.6,
        z: 48,
        rotationY: 0,
        requiresHotwire: false,
        isHotwired: true,
      },
      {
        type: 'infernus',
        x: 86.2,
        z: -64,
        rotationY: Math.PI,
        colorHex: '#ff6d00',
        requiresHotwire: false,
        isHotwired: true,
      },
      // Washington Ave (x = 33.8 and x = 46.2)
      {
        type: 'cheetah',
        x: 46.2,
        z: -22,
        rotationY: Math.PI,
        colorHex: '#ff2a85',
        requiresHotwire: false,
        isHotwired: true,
      },
      {
        type: 'kaufman_cab',
        x: 33.8,
        z: 15,
        rotationY: 0,
        requiresHotwire: false,
        isHotwired: true,
      },
      // Starfish Island Mansion & Boulevard
      {
        type: 'infernus',
        x: -22,
        z: -12,
        rotationY: Math.PI * 0.5,
        colorHex: '#00b0ff',
        requiresHotwire: true,
        isHotwired: false,
      },
      {
        type: 'pcj600',
        x: -36,
        z: -14,
        rotationY: 0,
        colorHex: '#ff1744',
        requiresHotwire: false,
        isHotwired: true,
      },
      // Little Haiti & Argon Port
      {
        type: 'cuban_hermes',
        x: -108.5,
        z: -24,
        rotationY: Math.PI,
        colorHex: '#1b5e20',
        requiresHotwire: false,
        isHotwired: true,
      },
      {
        type: 'kaufman_cab',
        x: -121.5,
        z: 10,
        rotationY: 0,
        requiresHotwire: false,
        isHotwired: true,
      },
      {
        type: 'cheetah',
        x: 22,
        z: 92,
        rotationY: Math.PI * 0.5,
        colorHex: '#00e5ff',
        requiresHotwire: false,
        isHotwired: true,
      },
      // Flyable Aircraft (Dodo Skimmer Seaplanes & Argon Maverick Helicopters — all facing North Math.PI in wide-open takeoff zones)
      {
        type: 'skimmer_plane',
        x: 112.0,
        z: -26.0,
        rotationY: Math.PI,
        colorHex: '#ffffff',
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 220,
      },
      {
        type: 'skimmer_plane',
        x: 15.0,
        z: 136.0,
        rotationY: Math.PI,
        colorHex: '#ffffff',
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 220,
      },
      {
        type: 'skimmer_plane',
        x: -152.0,
        z: 115.0,
        rotationY: Math.PI,
        colorHex: '#ffffff',
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 220,
      },
      {
        type: 'maverick_heli',
        x: 90.2,
        z: -16.0,
        rotationY: Math.PI,
        colorHex: '#ffffff',
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 220,
      },
      {
        type: 'maverick_heli',
        x: -30.0,
        z: -54.0,
        rotationY: Math.PI,
        colorHex: '#00e5ff',
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 220,
      },
      // New Classic Argon City Vehicles (Deluxo, Sabre Turbo, Mr. Whoopee)
      {
        type: 'deluxo',
        x: 73.6,
        z: -28.0,
        rotationY: 0,
        colorHex: '#cfd8dc',
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 190,
      },
      {
        type: 'sabre_turbo',
        x: 46.2,
        z: 115.0,
        rotationY: Math.PI,
        colorHex: '#d50000',
        striped: true,
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 190,
      },
      {
        type: 'sabre_turbo',
        x: 86.2,
        z: 14.0,
        rotationY: Math.PI,
        colorHex: '#1a237e',
        striped: true,
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 190,
      },
      {
        type: 'mr_whoopee',
        x: -121.5,
        z: -78.0,
        rotationY: 0,
        colorHex: '#ff80ab',
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 185,
      },
      {
        type: 'mr_whoopee',
        x: 86.2,
        z: -48.0,
        rotationY: Math.PI,
        colorHex: '#ff80ab',
        requiresHotwire: false,
        isHotwired: true,
        maxHealth: 185,
      },
    ];

    for (const ps of parkedSpawns) {
      this.spawnVehicle(ps.type, ps.x, ps.z, ps.rotationY, {
        colorHex: ps.colorHex,
        striped: ps.striped,
        isParked: true,
        requiresHotwire: ps.requiresHotwire,
        isHotwired: ps.isHotwired,
        maxHealth: ps.maxHealth,
      });
    }

    // 2. Moored Argon Nights Cigarette 38 Speedboats at Marina piers & Ocean Beach waters
    const boatSpawns = this._getInitialBoatSpawns();
    for (const bs of boatSpawns) {
      this.spawnVehicle('cigarette_boat', bs.x, bs.z, bs.rotationY, {
        isParked: true,
        requiresHotwire: false,
        isHotwired: true,
      });
    }

    // 3. Orderly two-way ambient traffic vehicles distributed along true Argon City lanes
    const roadLanes = this._getTrafficLanes();
    const numTraffic = 22;
    for (let i = 0; i < numTraffic; i++) {
      const lane = roadLanes[i % roadLanes.length];
      const type = TRAFFIC_ROSTER[i % TRAFFIC_ROSTER.length];
      const minC = lane.minCoord ?? -135;
      const maxC = lane.maxCoord ?? 135;
      const span = maxC - minC;
      const frac = ((i * 0.29 + 0.13) % 1.0);
      const travelCoord = minC + frac * span;

      const x = lane.axis === 'z' ? lane.coord : travelCoord;
      const z = lane.axis === 'z' ? travelCoord : lane.coord;

      // Keep at least 16m clear of player start (80, -26) so no traffic car spawns on top of player
      if (Math.hypot(x - 80, z - -26) < 16) continue;
      if (this._isWaterAt(x, z)) continue;

      this.spawnVehicle(type, x, z, lane.rotationY, {
        isTraffic: true,
        targetSpeed: 10.5 + (i % 3) * 1.0,
        laneAxis: lane.axis,
        laneCoord: lane.coord,
        pairCoord: lane.pairCoord ?? lane.coord,
        minRoadCoord: minC,
        maxRoadCoord: maxC,
        laneRotationY: lane.rotationY,
      });
    }
  }

  _getInitialBoatSpawns() {
    if (this.world && Array.isArray(this.world.boatSpawns) && this.world.boatSpawns.length > 0) {
      return this.world.boatSpawns;
    }
    return [
      { x: 23.5, z: 116, rotationY: 0 },
      { x: -46.5, z: 118, rotationY: 0 },
      { x: 142, z: -18, rotationY: Math.PI },
    ];
  }

  _getTrafficLanes() {
    if (this.world && Array.isArray(this.world.trafficLanes) && this.world.trafficLanes.length > 0) {
      return this.world.trafficLanes;
    }
    // Exact ViceCityWorld road network lanes:
    // - Ocean Drive (x = 80): Southbound x = 76.8 (rot = 0), Northbound x = 83.2 (rot = PI)
    // - Washington Ave (x = 40): Southbound x = 36.8 (rot = 0), Northbound x = 43.2 (rot = PI)
    // - Starfish Island Blvd (x = -30): Southbound x = -32.8 (rot = 0), Northbound x = -27.2 (rot = PI)
    // - Little Haiti Blvd (x = -115): Southbound x = -118.2 (rot = 0), Northbound x = -111.8 (rot = PI)
    // - Starfish Causeway (z = 0): Eastbound z = 3.2 (rot = PI/2), Westbound z = -3.2 (rot = -PI/2)
    // - North Beach Crossway (z = -90): Eastbound z = -86.8 (rot = PI/2), Westbound z = -93.2 (rot = -PI/2)
    // - Argon Port Highway (z = 95): Eastbound z = 98.2 (rot = PI/2), Westbound z = 91.8 (rot = -PI/2)
    return [
      { axis: 'z', coord: 76.8, pairCoord: 83.2, minCoord: -145, maxCoord: 145, rotationY: 0 },
      { axis: 'z', coord: 83.2, pairCoord: 76.8, minCoord: -145, maxCoord: 145, rotationY: Math.PI },
      { axis: 'z', coord: 36.8, pairCoord: 43.2, minCoord: -145, maxCoord: 145, rotationY: 0 },
      { axis: 'z', coord: 43.2, pairCoord: 36.8, minCoord: -145, maxCoord: 145, rotationY: Math.PI },
      { axis: 'z', coord: -32.8, pairCoord: -27.2, minCoord: -52, maxCoord: 52, rotationY: 0 },
      { axis: 'z', coord: -27.2, pairCoord: -32.8, minCoord: -52, maxCoord: 52, rotationY: Math.PI },
      { axis: 'z', coord: -118.2, pairCoord: -111.8, minCoord: -142, maxCoord: 132, rotationY: 0 },
      { axis: 'z', coord: -111.8, pairCoord: -118.2, minCoord: -142, maxCoord: 132, rotationY: Math.PI },
      { axis: 'x', coord: 3.2, pairCoord: -3.2, minCoord: -142, maxCoord: 82, rotationY: Math.PI * 0.5 },
      { axis: 'x', coord: -3.2, pairCoord: 3.2, minCoord: -142, maxCoord: 82, rotationY: -Math.PI * 0.5 },
      { axis: 'x', coord: -86.8, pairCoord: -93.2, minCoord: -142, maxCoord: 82, rotationY: Math.PI * 0.5 },
      { axis: 'x', coord: -93.2, pairCoord: -86.8, minCoord: -142, maxCoord: 82, rotationY: -Math.PI * 0.5 },
      { axis: 'x', coord: 98.2, pairCoord: 91.8, minCoord: -142, maxCoord: 82, rotationY: Math.PI * 0.5 },
      { axis: 'x', coord: 91.8, pairCoord: 98.2, minCoord: -142, maxCoord: 82, rotationY: -Math.PI * 0.5 },
    ];
  }

  _getDynamicRoadLanesNear(px, pz) {
    const lanes = [];
    if (Math.abs(px) <= 180 && Math.abs(pz) <= 180) {
      lanes.push(...this._getTrafficLanes());
    }
    const cx = Math.round(px / 120);
    const cz = Math.round(pz / 120);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const ncx = cx + dx;
        const ncz = cz + dz;
        // Core map [-180, 180] already uses _getTrafficLanes()
        if (Math.abs(ncx) <= 1 && Math.abs(ncz) <= 1 && lanes.length > 0) {
          continue;
        }
        const roadX = ncx * 120;
        const roadZ = ncz * 120;
        lanes.push(
          {
            axis: 'z',
            coord: roadX - 3.2,
            pairCoord: roadX + 3.2,
            minCoord: roadZ - 180,
            maxCoord: roadZ + 180,
            rotationY: 0,
          },
          {
            axis: 'z',
            coord: roadX + 3.2,
            pairCoord: roadX - 3.2,
            minCoord: roadZ - 180,
            maxCoord: roadZ + 180,
            rotationY: Math.PI,
          },
          {
            axis: 'x',
            coord: roadZ + 3.2,
            pairCoord: roadZ - 3.2,
            minCoord: roadX - 180,
            maxCoord: roadX + 180,
            rotationY: Math.PI * 0.5,
          },
          {
            axis: 'x',
            coord: roadZ - 3.2,
            pairCoord: roadZ + 3.2,
            minCoord: roadX - 180,
            maxCoord: roadX + 180,
            rotationY: -Math.PI * 0.5,
          }
        );
      }
    }
    return lanes;
  }

  // ============================================================================
  // PUBLIC API: SPAWNING, CARJACKING & QUERYING VEHICLES
  // ============================================================================

  spawnVehicle(type, x = 0, z = 0, rotationY = 0, options = {}) {
    const cleanType = VEHICLE_SPECS[type] ? type : 'cheetah';
    const spec = VEHICLE_SPECS[cleanType];

    const palette = spec.palette;
    const colorHex =
      options.colorHex ||
      palette[(this.nextVehicleId - 1) % palette.length] ||
      '#ff2a85';

    const striped =
      options.striped !== undefined
        ? Boolean(options.striped)
        : (cleanType === 'cheetah' && colorHex === '#e6192e') || cleanType === 'sabre_turbo';

    const built = this._buildVehicleMesh(cleanType, spec, colorHex, striped);
    const inWater = this._isWaterAt(x, z);
    const spawnY = spec.isBoat
      ? this._getWaterSurfaceY(x, z)
      : spec.isAircraft && inWater
        ? this._getWaterSurfaceY(x, z) + 0.15
        : this._getGroundY(x, z);

    built.root.position.set(x, spawnY, z);
    built.root.rotation.y = rotationY;
    this.rootGroup.add(built.root);

    const maxHealth = options.maxHealth || spec.maxHealth;
    const requiresHotwire =
      options.requiresHotwire !== undefined
        ? Boolean(options.requiresHotwire)
        : false;

    const vehicle = {
      id: `veh_${this.nextVehicleId++}`,
      type: cleanType,
      name: spec.name,
      spec,
      mesh: built.root,
      bodyGroup: built.bodyGroup,
      shadowMesh: built.shadowMesh,
      hoodMesh: built.hoodMesh,
      wheels: built.wheels,
      outboards: built.outboards,
      propellerMesh: built.propellerMesh || null,
      mainRotorMesh: built.mainRotorMesh || null,
      tailRotorMesh: built.tailRotorMesh || null,
      headlightCones: built.headlightCones,
      taillightMeshes: built.taillightMeshes,
      sirenParts: built.sirenParts,
      bodyMaterials: built.bodyMaterials,
      x,
      y: spawnY,
      z,
      homeX: x,
      homeZ: z,
      homeRotationY: rotationY,
      vx: 0,
      vz: 0,
      vy: 0,
      speed: 0,
      forwardSpeed: 0,
      rotationY,
      steerAngle: 0,
      driftAngle: 0,
      driftTimer: 0,
      pitchAngle: 0,
      rollAngle: 0,
      angularVelY: 0,
      health: maxHealth,
      maxHealth,
      isPolice: Boolean(spec.isPolice || options.isPolice),
      isWrecked: false,
      isExploded: false,
      isBoat: Boolean(spec.isBoat),
      isAircraft: Boolean(spec.isAircraft),
      aircraftType: spec.aircraftType || null,
      isAirborne: false,
      stuntStartX: x,
      stuntStartZ: z,
      stuntPeakY: 0,
      isParked: Boolean(options.isParked),
      isTraffic: Boolean(options.isTraffic),
      isPursuitCop: Boolean(options.isPursuitCop && this.wantedStars > 0),
      colorHex,
      striped,
      requiresHotwire,
      isHotwired: options.isHotwired !== undefined ? Boolean(options.isHotwired) : !requiresHotwire,
      awaitingHotwire: false,
      tiresPopped: false,
      targetSpeed: options.targetSpeed || 11.5,
      laneAxis: options.laneAxis || null,
      laneCoord: options.laneCoord !== undefined ? options.laneCoord : null,
      pairCoord: options.pairCoord !== undefined ? options.pairCoord : null,
      minRoadCoord: options.minRoadCoord ?? -145,
      maxRoadCoord: options.maxRoadCoord ?? 145,
      laneRotationY: options.laneRotationY !== undefined ? options.laneRotationY : rotationY,
      nearMissCooldown: 0,
      rammedByPlayerTimer: 0,
      fireFuseTimer: 4.5,
      particleTimer: 0,
      skidTimer: 0,
      contrailTimer: 0,
      sirenPhase: Math.random() * 10,
      aiSteerBias: (Math.random() - 0.5) * 0.35,
      redXMarker: null,
    };

    vehicle.unlockHotwire = () => {
      vehicle.isHotwired = true;
      vehicle.requiresHotwire = false;
      vehicle.awaitingHotwire = false;
    };

    this.vehicles.push(vehicle);
    return vehicle;
  }

  _despawnVehicle(vehicle) {
    if (!vehicle || vehicle === this.playerVehicle) return;
    if (vehicle.mesh && vehicle.mesh.parent) {
      vehicle.mesh.parent.remove(vehicle.mesh);
    }
    const idx = this.vehicles.indexOf(vehicle);
    if (idx !== -1) {
      this.vehicles.splice(idx, 1);
    }
  }

  getVehicles() {
    return this.vehicles;
  }

  getPlayerVehicle() {
    return this.playerVehicle;
  }

  findNearestInteractableVehicle(x, z, maxDist = 7.5, excludeVehicle = null) {
    let best = null;
    let bestDist = maxDist;
    for (const v of this.vehicles) {
      if (v === excludeVehicle) continue;
      if (v.isExploded || v.isWrecked) continue;
      if (v.isAircraft && v.y >= 4.5) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      const allowedDist = v.isAircraft ? Math.max(bestDist, Math.min(maxDist + 1.5, 9.0)) : bestDist;
      if (d <= allowedDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  enterVehicle(vehicle, playerState) {
    if (!vehicle || vehicle.isExploded) return false;

    const wasOccupiedTraffic = Boolean(vehicle.isTraffic && !vehicle.isParked);
    const wasPoliceCar = Boolean(vehicle.isPolice && !vehicle.isParked);

    this.playerVehicle = vehicle;
    vehicle.isParked = false;
    vehicle.isTraffic = false;
    vehicle.isPursuitCop = false;

    // Zero out AI momentum so the player takes clean stationary control immediately without auto-acceleration
    vehicle.vx = 0;
    vehicle.vz = 0;
    vehicle.vy = 0;
    vehicle.forwardSpeed = 0;
    vehicle.speed = 0;

    // Generous player hero vehicle durability boost
    if (vehicle.maxHealth < 160 && !vehicle.isPolice) {
      const ratio = vehicle.health / vehicle.maxHealth;
      vehicle.maxHealth = 160;
      vehicle.health = Math.round(160 * ratio);
    }

    if (playerState) {
      playerState.inVehicle = true;
      playerState.currentVehicle = vehicle;
      playerState.vehicle = vehicle;
      playerState.x = vehicle.x;
      playerState.y = vehicle.y;
      playerState.z = vehicle.z;
      playerState.rotationY = vehicle.rotationY;
      if (playerState.position && typeof playerState.position.set === 'function') {
        playerState.position.set(vehicle.x, vehicle.y, vehicle.z);
      }
      if (playerState.mesh) {
        playerState.mesh.visible = Boolean(vehicle.type === 'pcj600' || vehicle.isBoat);
      }
    }

    // Notify main engine if player carjacked an occupied traffic or police vehicle (ejects NPC driver!)
    if (wasOccupiedTraffic || wasPoliceCar) {
      this.callbacks.onCarjackVehicle?.(vehicle, { wasOccupiedTraffic, wasPoliceCar });
    }

    // Only add Wanted Heat on carjacking if stealing a police vehicle OR if an active cop is within 36m witnessing it
    let copWitnessNearby = false;
    for (const other of this.vehicles) {
      if (other !== vehicle && other.isPolice && !other.isWrecked && !other.isExploded) {
        if (Math.hypot(other.x - vehicle.x, other.z - vehicle.z) < 36) {
          copWitnessNearby = true;
          break;
        }
      }
    }
    if (vehicle.isPolice) {
      if (this.wantedStars === 0) {
        this.setWantedStars(1);
      } else {
        this.addWantedHeat(35);
      }
    } else if (wasOccupiedTraffic && copWitnessNearby) {
      this.addWantedHeat(55);
    }

    // Trigger Hotwire mini-game hook if locked exotic supercar
    if (vehicle.requiresHotwire && !vehicle.isHotwired) {
      vehicle.awaitingHotwire = true;
      if (this.callbacks.onRequestHotwire) {
        this.callbacks.onRequestHotwire(vehicle, () => {
          vehicle.isHotwired = true;
          vehicle.requiresHotwire = false;
          vehicle.awaitingHotwire = false;
          this.callbacks.onCallout?.('HOTWIRE COMPLETE!', 'ENGINE IGNITED', '#00e5ff');
        });
      } else {
        vehicle.isHotwired = true;
        vehicle.requiresHotwire = false;
        vehicle.awaitingHotwire = false;
      }
    } else {
      vehicle.awaitingHotwire = false;
    }

    this.callbacks.onPlaySound?.('car_door');
    this.callbacks.onCallout?.(
      wasOccupiedTraffic ? `CARJACKED ${vehicle.name.toUpperCase()}!` : vehicle.name.toUpperCase(),
      vehicle.isAircraft
        ? 'HOLD [W] OR [SPACE] TO FLY • [S/SHIFT] DESCEND'
        : wasOccupiedTraffic
          ? 'STEP ON IT!'
          : 'CRUISING ARGON CITY',
      '#ffd600'
    );
    return true;
  }

  exitVehicle(playerState) {
    const vehicle = this.playerVehicle || playerState?.currentVehicle || playerState?.vehicle;
    if (!vehicle) return null;

    this.playerVehicle = null;
    vehicle.awaitingHotwire = false;
    vehicle.isParked = true;

    // Place player safely to the left door (or dry land if bailing out near shore)
    const sideAngle = vehicle.rotationY - Math.PI * 0.5;
    const exitOffset = vehicle.isBoat || vehicle.isAircraft ? 3.2 : 2.35;
    let exitX = vehicle.x + Math.sin(sideAngle) * exitOffset;
    let exitZ = vehicle.z + Math.cos(sideAngle) * exitOffset;

    // Prefer a non-water exit spot if one is within reach (dock/shoreline/causeway)
    const candidates = [
      { x: exitX, z: exitZ },
      { x: vehicle.x - Math.sin(sideAngle) * exitOffset, z: vehicle.z - Math.cos(sideAngle) * exitOffset },
      { x: vehicle.x - 4.5, z: vehicle.z },
      { x: vehicle.x + 4.5, z: vehicle.z },
      { x: vehicle.x, z: vehicle.z - 4.5 },
      { x: vehicle.x, z: vehicle.z + 4.5 },
    ];
    for (const c of candidates) {
      if (!this._isWaterAt(c.x, c.z)) {
        exitX = c.x;
        exitZ = c.z;
        break;
      }
    }

    const groundY = this._getGroundY(exitX, exitZ);
    if (playerState) {
      playerState.inVehicle = false;
      playerState.currentVehicle = null;
      playerState.vehicle = null;
      playerState.x = exitX;
      playerState.y = groundY;
      playerState.z = exitZ;
      playerState.vx = 0;
      playerState.vz = 0;
      playerState.speed = 0;
      if (playerState.position && typeof playerState.position.set === 'function') {
        playerState.position.set(exitX, groundY, exitZ);
      }
      if (playerState.mesh) {
        playerState.mesh.visible = true;
        playerState.mesh.position.set(exitX, groundY, exitZ);
      }
    }

    this.callbacks.onPlaySound?.('car_door');
    return vehicle;
  }

  // ============================================================================
  // GRAND THEFT ARGON WANTED LEVEL, COP-TAKEDOWN & PURSUIT ESCAPE SYSTEM (0..5 STARS)
  // ============================================================================

  _heatToStars(heat) {
    if (heat < 100) return 0;
    if (heat < 220) return 1;
    if (heat < 360) return 2;
    if (heat < 520) return 3;
    if (heat < 700) return 4;
    return 5;
  }

  addWantedHeat(amount = 35) {
    if (amount <= 0) return this.wantedStars;

    // Support both fractional callers (main.js passes 0.08, 0.35, 0.45, 0.85)
    // and integer heat callers (25, 35, 100) so minor offenses don't trigger instant 1-star chaos!
    const scaledAmount = amount <= 2.0 ? amount * 38 : amount;
    this.wantedHeat = clamp(this.wantedHeat + scaledAmount, 0, 900);

    const targetStars = this._heatToStars(this.wantedHeat);
    if (targetStars > 0) {
      this.timeSinceLastCrime = 0;
      this.escapeTimer = 0;
      this.escapeProgress = 0;
      this.isEvading = false;
      this.pursuitSpawnGraceTimer = 2.0;
    }

    if (targetStars > this.wantedStars) {
      this.setWantedStars(targetStars);
    } else if (this.wantedStars > 0) {
      // Re-engage any existing nearby police units on new crime
      for (const v of this.vehicles) {
        if (v.isPolice && !v.isWrecked && !v.isExploded && v !== this.playerVehicle) {
          v.isPursuitCop = true;
        }
      }
    }
    return this.wantedStars;
  }

  setWantedStars(stars) {
    const clamped = clamp(Math.round(stars), 0, 5);
    const prev = this.wantedStars;
    this.wantedStars = clamped;

    if (clamped === 0) {
      this.wantedHeat = 0;
      this.copsRequired = 0;
      this.copsWrecked = 0;
      this.copsSpawnedForCurrentStar = 0;
      this.escapeTimer = 0;
      this.escapeProgress = 0;
      this.isEvading = false;
      this.policeHeli.group.visible = false;
      this._clearRoadblocks();
      for (const v of this.vehicles) {
        if (v.isPolice && v !== this.playerVehicle) {
          v.isPursuitCop = false;
        }
      }
    } else {
      const heatFloors = [0, 110, 230, 370, 530, 710];
      this.wantedHeat = Math.max(this.wantedHeat, heatFloors[clamped]);
      this.copsRequired = clamped;
      this.escapeDuration = clamped <= 1 ? 5.5 : clamped === 2 ? 7.0 : 8.5;
      this.escapeTimer = 0;
      this.escapeProgress = 0;
      this.isEvading = false;
      this.timeSinceLastCrime = 0;
      if (clamped !== prev) {
        this.copsWrecked = clamp(this.copsWrecked, 0, Math.max(0, this.copsRequired - 1));
        this.copsSpawnedForCurrentStar = 0;
      }
      this.policeHeli.group.visible = clamped >= 5;
      for (const v of this.vehicles) {
        if (v.isPolice && !v.isWrecked && !v.isExploded && v !== this.playerVehicle) {
          v.isPursuitCop = true;
        }
      }
    }

    if (clamped !== prev) {
      this.callbacks.onWantedChange?.(this.getWantedHUDState());
      if (clamped > prev) {
        this.callbacks.onPlaySound?.('police_siren');
      }
    }
    return this.getWantedHUDState();
  }

  clearWanted(reason = 'cleared') {
    const hadStars = this.wantedStars > 0;
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.isPolice && v !== this.playerVehicle) {
        v.isPursuitCop = false;
      }
    }
    const state = this.setWantedStars(0);
    if (hadStars && reason === 'escaped') {
      this.callbacks.onCallout?.('PURSUIT ESCAPED!', 'HEAT CLEARED', '#00e5ff');
      this.callbacks.onPursuitEscaped?.(state);
    }
    return state;
  }

  getWantedHUDState() {
    let activeCopsCount = 0;
    for (const v of this.vehicles) {
      if (v.isPolice && !v.isWrecked && !v.isExploded && v !== this.playerVehicle && this.wantedStars > 0) {
        activeCopsCount++;
      }
    }
    return {
      stars: this.wantedStars,
      copsRequired: this.copsRequired,
      copsWrecked: this.copsWrecked,
      totalCopsWrecked: this.totalCopsWrecked,
      activeCopsCount,
      heliActive: Boolean(this.wantedStars >= 5 && this.policeHeli.group.visible),
      isEvading: Boolean(this.wantedStars > 0 && this.isEvading),
      escapeProgress: this.wantedStars > 0 ? clamp(this.escapeTimer / this.escapeDuration, 0, 1) : 0,
    };
  }

  /**
   * Creates the iconic Grand Theft Argon floating 3D Red 'X' marker over a wrecked cop car
   */
  createRedXMarker() {
    const group = new THREE.Group();
    group.name = 'WreckedCopRedXMarker';

    // Tilted badge pivot facing the overhead Grand Theft Argon camera (~55 deg tilt up)
    const xBadge = new THREE.Group();
    xBadge.rotation.x = -0.96;

    const blackMat = new THREE.MeshBasicMaterial({ color: 0x08080c });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff1128 });

    // Thick black comic border plate behind the X
    const blackGeo = new THREE.BoxGeometry(2.55, 0.68, 0.14);
    for (const rotZ of [Math.PI * 0.25, -Math.PI * 0.25]) {
      const bMesh = new THREE.Mesh(blackGeo, blackMat);
      bMesh.rotation.z = rotZ;
      bMesh.position.z = -0.10;
      xBadge.add(bMesh);
    }

    // Crisp white comic keyline layer
    const whiteGeo = new THREE.BoxGeometry(2.36, 0.52, 0.18);
    for (const rotZ of [Math.PI * 0.25, -Math.PI * 0.25]) {
      const wMesh = new THREE.Mesh(whiteGeo, whiteMat);
      wMesh.rotation.z = rotZ;
      wMesh.position.z = -0.04;
      xBadge.add(wMesh);
    }

    // Vibrant Crimson Red X foreground bars
    const barGeo = new THREE.BoxGeometry(2.18, 0.38, 0.24);
    const bar1 = new THREE.Mesh(barGeo, redMat);
    bar1.rotation.z = Math.PI * 0.25;
    this._addInkOutline(bar1);

    const bar2 = new THREE.Mesh(barGeo, redMat);
    bar2.rotation.z = -Math.PI * 0.25;
    this._addInkOutline(bar2);

    xBadge.add(bar1, bar2);
    group.add(xBadge);

    // Persistent billowing black comic smoke clouds rising from the wrecked hood
    const smokeMat = new THREE.MeshToonMaterial({
      color: 0x1b1c24,
      gradientMap: this.celGradient,
      transparent: true,
      opacity: 0.88,
    });
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6d00 });
    const smokePuffs = [
      { x: 0.0, y: -1.05, z: 1.35, r: 0.58 },
      { x: -0.35, y: -0.55, z: 1.15, r: 0.72 },
      { x: 0.28, y: 0.05, z: 0.95, r: 0.84 },
      { x: -0.15, y: 0.65, z: 0.75, r: 0.65 },
    ];
    for (let i = 0; i < smokePuffs.length; i++) {
      const sp = smokePuffs[i];
      const puff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(sp.r, 1),
        i === 0 ? emberMat : smokeMat
      );
      puff.position.set(sp.x, sp.y, sp.z);
      this._addInkOutline(puff, 28);
      group.add(puff);
    }

    group.position.set(0, 2.25, 0);
    return group;
  }

  _wreckPoliceVehicle(cop, reason = 'COP TAKEDOWN!') {
    if (!cop || !cop.isPolice || cop.isWrecked) return false;

    cop.isWrecked = true;
    cop.isPursuitCop = false;
    cop.health = Math.min(cop.health, 28);

    // Pop/tilt hood and fenders for dramatic wreck silhouette
    if (cop.hoodMesh) {
      cop.hoodMesh.rotation.x = -0.42;
      cop.hoodMesh.rotation.z = 0.16;
    }
    cop.bodyGroup.rotation.z = (Math.random() < 0.5 ? 1 : -1) * 0.14;

    // Attach floating Red 'X' marker directly above roof
    if (!cop.redXMarker) {
      cop.redXMarker = this.createRedXMarker();
      cop.mesh.add(cop.redXMarker);
    }

    // Update Grand Theft Argon Cop-Takedown counters
    if (this.wantedStars === 0) {
      this.setWantedStars(1);
    }
    this.copsWrecked += 1;
    this.totalCopsWrecked += 1;

    // Burst of sparks + smoke on takedown
    this._spawnSparkBurst(cop.x, cop.y + 0.9, cop.z, 18);
    this._spawnSmokePuff(cop.x, cop.y + 1.1, cop.z, 'black');

    this.callbacks.onCallout?.(reason, 'ACPD UNIT WRECKED', '#ff1744');
    this.callbacks.onPlaySound?.('cop_takedown');

    // Check if player wrecked enough cops to shed wanted heat!
    if (this.copsWrecked >= this.copsRequired && this.wantedStars > 0) {
      const nextStars = Math.max(0, this.wantedStars - 1);
      if (nextStars === 0) {
        this.wantedStars = 0;
        this.wantedHeat = 0;
        this.copsRequired = 0;
        this.copsWrecked = 0;
        this.escapeTimer = 0;
        this.escapeProgress = 0;
        this.isEvading = false;
        this.policeHeli.group.visible = false;
        this._clearRoadblocks();
        for (const v of this.vehicles) {
          if (v.isPolice && v !== this.playerVehicle) {
            v.isPursuitCop = false;
          }
        }
        this.callbacks.onCallout?.('PURSUIT EVADED!', 'HEAT CLEARED', '#00e5ff');
      } else {
        const heatFloors = [0, 110, 230, 370, 530, 710];
        this.wantedStars = nextStars;
        this.wantedHeat = heatFloors[nextStars];
        this.copsRequired = nextStars;
        this.escapeDuration = nextStars <= 1 ? 5.5 : nextStars === 2 ? 7.0 : 8.5;
        this.copsWrecked = 0;
        this.copsSpawnedForCurrentStar = 0;
        if (nextStars < 5) this.policeHeli.group.visible = false;
        this.callbacks.onCallout?.('COP TAKEDOWN!', 'HEAT REDUCED', '#ffd600');
      }
    }

    const hudState = this.getWantedHUDState();
    this.callbacks.onCopTakedown?.({
      vehicle: cop,
      copsWrecked: this.copsWrecked,
      copsRequired: this.copsRequired,
      totalCopsWrecked: this.totalCopsWrecked,
      wantedStars: this.wantedStars,
      hudState,
    });
    this.callbacks.onWantedChange?.(hudState);
    return true;
  }

  /**
   * Helper for testing / critic verification of Grand Theft Argon Cop Takedown:
   * Ensures wanted level is active, positions/finds the nearest pursuing cop, and wrecks it
   * with the floating Red 'X' marker and HUD silhouette cross-out.
   */
  forceWreckNearestCop(playerState) {
    const px = this.playerVehicle ? this.playerVehicle.x : (playerState?.x ?? 80);
    const pz = this.playerVehicle ? this.playerVehicle.z : (playerState?.z ?? -26);
    const pRot = this.playerVehicle ? this.playerVehicle.rotationY : (playerState?.rotationY ?? 0);

    // Ensure at least 2 stars if currently 0 or 1 so HUD shows active stars + 1 crossed-out cop silhouette
    if (this.wantedStars === 0) {
      this.setWantedStars(2);
    } else if (this.wantedStars === 1 && this.copsWrecked === 0) {
      this.setWantedStars(2);
    }

    let nearestCop = null;
    let bestDist = Infinity;
    for (const v of this.vehicles) {
      if (v.isPolice && !v.isWrecked && !v.isExploded && v !== this.playerVehicle) {
        const d = Math.hypot(v.x - px, v.z - pz);
        if (d < bestDist) {
          bestDist = d;
          nearestCop = v;
        }
      }
    }

    // Spawn a ACPD cruiser right in front of the player if none is nearby
    if (!nearestCop || bestDist > 18) {
      const spawnX = px + Math.sin(pRot) * 7.5 + Math.cos(pRot) * 2.2;
      const spawnZ = pz + Math.cos(pRot) * 7.5 - Math.sin(pRot) * 2.2;
      if (!nearestCop) {
        nearestCop = this.spawnVehicle('vcpd_cruiser', spawnX, spawnZ, pRot + Math.PI * 0.75, {
          isPursuitCop: true,
        });
      } else {
        nearestCop.x = spawnX;
        nearestCop.z = spawnZ;
        nearestCop.rotationY = pRot + Math.PI * 0.75;
        nearestCop.mesh.position.set(spawnX, nearestCop.y, spawnZ);
        nearestCop.mesh.rotation.y = nearestCop.rotationY;
      }
    }

    this._wreckPoliceVehicle(nearestCop, 'COP TAKEDOWN!');
    return nearestCop;
  }

  // ============================================================================
  // VEHICLE DAMAGE & DESTRUCTION
  // ============================================================================

  damageVehicle(vehicle, amount, attackerType = 'player') {
    if (!vehicle || vehicle.isExploded || amount <= 0) return 0;

    let finalDamage = amount;
    if (attackerType === 'player_ram' && vehicle.isPolice && !vehicle.isWrecked) {
      finalDamage = amount * 3.0; // Generous 3.0x player-to-cop ramming multiplier!
    }

    // Prevent chain-reaction traffic explosions from ordinary fender-benders:
    // Non-police ambient vehicles never drop below 36% HP from 'collision' or 'environment' bumps alone!
    const isCollisionOnly = attackerType === 'collision' || attackerType === 'environment';
    if (isCollisionOnly && !vehicle.isPolice && vehicle !== this.playerVehicle) {
      const minTrafficHp = Math.ceil(vehicle.maxHealth * 0.36);
      vehicle.health = Math.max(minTrafficHp, vehicle.health - finalDamage);
    } else if (isCollisionOnly && vehicle === this.playerVehicle) {
      // Player vehicle is also forgiving on minor traffic scrapes
      vehicle.health = Math.max(0, vehicle.health - finalDamage * 0.65);
    } else {
      vehicle.health = Math.max(0, vehicle.health - finalDamage);
    }

    // Visual hood & fender deformation as HP drops
    const hpRatio = vehicle.health / vehicle.maxHealth;
    if (vehicle.hoodMesh && hpRatio < 0.8) {
      vehicle.hoodMesh.rotation.x = -Math.min(0.45, (1 - hpRatio) * 0.48);
      vehicle.hoodMesh.rotation.z = Math.sin(vehicle.x + vehicle.z) * (1 - hpRatio) * 0.16;
    }

    // Attacking a police vehicle raises wanted level
    if (
      (attackerType === 'player' || attackerType === 'player_ram') &&
      vehicle.isPolice &&
      !vehicle.isWrecked
    ) {
      this.timeSinceLastCrime = 0;
      this.escapeTimer = 0;
      if (this.wantedStars === 0) {
        this.setWantedStars(1);
      }
      // Wreck police car once health drops <= 25%
      if (vehicle.health <= vehicle.maxHealth * 0.25 && vehicle.health > 0) {
        this._wreckPoliceVehicle(vehicle, 'COP TAKEDOWN!');
      }
    }

    if (vehicle.health <= 0) {
      if (vehicle.isPolice && !vehicle.isWrecked) {
        this._wreckPoliceVehicle(vehicle, 'COP TAKEDOWN!');
      }
      this._explodeVehicle(vehicle, attackerType);
    }

    return vehicle.health;
  }

  _explodeVehicle(vehicle, attackerType = 'player') {
    if (!vehicle || vehicle.isExploded) return;
    vehicle.isExploded = true;
    vehicle.isWrecked = true;
    vehicle.health = 0;

    // Launch scorched chassis upward with angular impulse
    vehicle.vy = 11.5;
    vehicle.angularVelY = (Math.random() < 0.5 ? 1 : -1) * 3.2;
    vehicle.pitchAngle = -0.38;
    vehicle.rollAngle = (Math.random() < 0.5 ? 1 : -1) * 0.32;

    // Scorch all body panels dark charcoal
    if (Array.isArray(vehicle.bodyMaterials)) {
      for (const mat of vehicle.bodyMaterials) {
        mat.color.setHex(0x1f1f24);
      }
    }

    // Turn off headlight cones & sirens
    for (const cone of vehicle.headlightCones) {
      cone.visible = false;
    }
    if (vehicle.sirenParts) {
      vehicle.sirenParts.glowRed.visible = false;
      vehicle.sirenParts.glowBlue.visible = false;
    }

    // Spawn cel-shaded comic fireball & flying sparks
    this._spawnExplosionFireball(vehicle.x, vehicle.y + 1.0, vehicle.z);
    this._spawnSparkBurst(vehicle.x, vehicle.y + 1.2, vehicle.z, 28);

    this.callbacks.onExplosion?.(vehicle.x, vehicle.y + 0.8, vehicle.z, 1.35);
    this.callbacks.onVehicleExplode?.(vehicle);
    this.callbacks.onPlaySound?.('explosion');
    this.callbacks.onCallout?.('VEHICLE DESTROYED!', 'EXPLOSIVE WRECK', '#ff6d00');

    // Chain-damage nearby vehicles within 7.5m blast radius (gentle on ambient traffic so whole streets don't chain-explode)
    for (const other of this.vehicles) {
      if (other === vehicle || other.isExploded) continue;
      const dist = Math.hypot(other.x - vehicle.x, other.z - vehicle.z);
      if (dist < 7.5) {
        const falloff = 1 - dist / 7.5;
        const pushAngle = Math.atan2(other.x - vehicle.x, other.z - vehicle.z);
        other.vx += Math.sin(pushAngle) * falloff * 12;
        other.vz += Math.cos(pushAngle) * falloff * 12;
        const blastDmg = other.isPolice ? Math.round(falloff * 95) : Math.round(falloff * 48);
        this.damageVehicle(other, blastDmg, 'explosion');
      }
    }
  }

  // ============================================================================
  // MAIN FRAME UPDATE: PLAYER DRIVING, DRIFTING, BOATS, TRAFFIC & ACPD PURSUIT
  // ============================================================================

  update(dt, playerState, inputState) {
    const safeDt = clamp(dt || 0.016, 0.001, 0.05);
    this.time += safeDt;

    // Sync playerVehicle if playerState changed it externally
    if (playerState?.inVehicle && playerState.currentVehicle && !this.playerVehicle) {
      this.playerVehicle = playerState.currentVehicle;
    } else if (playerState && playerState.inVehicle === false && this.playerVehicle) {
      this.playerVehicle = null;
    }

    const input = this._readInput(inputState);
    const isNight = this._isNightTime();

    // 1. Update player-driven vehicle or speedboat
    if (this.playerVehicle) {
      if (this.playerVehicle.isExploded) {
        this.exitVehicle(playerState);
      } else {
        this._updatePlayerVehicle(safeDt, this.playerVehicle, playerState, input);
      }
    }

    // 2. Manage Crime-Only Wanted Pursuit, Escape Cooldown, 4-Star Roadblocks & 5-Star Helicopter
    this._updateWantedPursuitManager(safeDt, playerState);

    // 3. Stream & Update AI vehicles (Infinite Chunk Lane Traffic, Parked Cars & ACPD Pursuit Cops) + Damage States
    this._updateTrafficAndPoliceAI(safeDt, playerState);

    // 4. Vehicle-to-Vehicle Collisions & Near Miss Detection
    this._handleVehicleInteractions(safeDt, playerState);

    // 5. Roadblock Spike Strip checks
    this._updateRoadblocks(safeDt, playerState);

    // 6. Final 3D transform sync after all vehicle interactions/collisions are resolved
    for (let i = 0; i < this.vehicles.length; i++) {
      this._syncVehicleMeshTransform(this.vehicles[i], safeDt);
    }

    // 7. Update Skidmarks, Water Wakes & Particle FX
    this._updateFXPools(safeDt);
  }

  _updateTrafficAndPoliceAI(dt, playerState) {
    const isNight = this._isNightTime();
    const px = this.playerVehicle ? this.playerVehicle.x : (playerState?.x ?? 80);
    const pz = this.playerVehicle ? this.playerVehicle.z : (playerState?.z ?? -26);
    const dynamicLanes = this._getDynamicRoadLanesNear(px, pz);
    const nearLanes = dynamicLanes.filter((lane) =>
      lane.axis === 'z' ? Math.abs(lane.coord - px) <= 145 : Math.abs(lane.coord - pz) <= 145
    );
    const candidateLanes = nearLanes.length > 0 ? nearLanes : dynamicLanes;

    // Count non-aircraft, non-boat parked cars currently near the player when out in procedural chunks
    const inProceduralWorld = Math.hypot(px, pz) > 190 || Math.abs(px) > 180 || Math.abs(pz) > 180;
    let nearbyParkedCount = 0;
    if (inProceduralWorld) {
      for (const v of this.vehicles) {
        if (
          v.isParked &&
          !v.isAircraft &&
          !v.isBoat &&
          v !== this.playerVehicle &&
          !v.isExploded &&
          Math.hypot(v.x - px, v.z - pz) <= 145
        ) {
          nearbyParkedCount++;
        }
      }
    }

    const cx = Math.round(px / 120);
    const cz = Math.round(pz / 120);

    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.nearMissCooldown > 0) v.nearMissCooldown -= dt;
      if (v.rammedByPlayerTimer > 0) v.rammedByPlayerTimer -= dt;

      // Headlights at night (or always on for player / pursuing police)
      const lightsOn =
        isNight || v === this.playerVehicle || (v.isPolice && this.wantedStars > 0 && !v.isWrecked);
      for (const cone of v.headlightCones) {
        cone.visible = Boolean(lightsOn && !v.isExploded);
      }

      // Police siren alternating red/blue strobes + road glow disc (zero PointLights!)
      if (v.isPolice && v.sirenParts) {
        this._updatePoliceSirens(v, dt);
      }

      if (v !== this.playerVehicle) {
        const distToPlayer = Math.hypot(v.x - px, v.z - pz);

        // Recycle distant AI traffic vehicles (> 210m from player) onto dynamic road lanes 55m..110m around (px, pz)
        if (
          v.isTraffic &&
          !v.isParked &&
          (distToPlayer > 210 || ((v.isExploded || v.isWrecked) && distToPlayer > 135)) &&
          candidateLanes.length > 0
        ) {
          for (let attempt = 0; attempt < 8; attempt++) {
            const lane = candidateLanes[(i + attempt) % candidateLanes.length];
            const dirSign = attempt % 2 === 0 ? 1 : -1;
            const distOffset = 55 + ((i * 17 + attempt * 23) % 55);
            const rawTravel = (lane.axis === 'z' ? pz : px) + dirSign * distOffset;
            const travelCoord = clamp(
              rawTravel,
              lane.minCoord ?? rawTravel - 120,
              lane.maxCoord ?? rawTravel + 120
            );
            const nx = lane.axis === 'z' ? lane.coord : travelCoord;
            const nz = lane.axis === 'z' ? travelCoord : lane.coord;

            if (this._isWaterAt(nx, nz)) continue;
            if (Math.hypot(nx - px, nz - pz) < 38) continue;

            let clearSpot = true;
            for (const other of this.vehicles) {
              if (other !== v && Math.hypot(other.x - nx, other.z - nz) < 9.5) {
                clearSpot = false;
                break;
              }
            }
            if (!clearSpot) continue;

            v.x = nx;
            v.z = nz;
            v.y = this._getGroundY(nx, nz);
            v.vx = 0;
            v.vz = 0;
            v.vy = 0;
            v.speed = v.targetSpeed * 0.65;
            v.forwardSpeed = v.speed;
            v.laneAxis = lane.axis;
            v.laneCoord = lane.coord;
            v.pairCoord = lane.pairCoord ?? lane.coord;
            v.minRoadCoord = lane.minCoord ?? -180;
            v.maxRoadCoord = lane.maxCoord ?? 180;
            v.laneRotationY = lane.rotationY;
            v.rotationY = lane.rotationY;
            v.health = v.maxHealth;
            v.isWrecked = false;
            v.isExploded = false;
            v.isSinking = false;
            v.sinkTimer = 0;
            v.fireFuseTimer = 4.5;
            v.pitchAngle = 0;
            v.rollAngle = 0;
            v.driftAngle = 0;
            if (v.hoodMesh) {
              v.hoodMesh.rotation.x = 0;
              v.hoodMesh.rotation.z = 0;
            }
            break;
          }
        } else if (
          v.isParked &&
          !v.isAircraft &&
          !v.isBoat &&
          inProceduralWorld &&
          nearbyParkedCount < 6 &&
          distToPlayer > 240
        ) {
          // Stream up to 6 parked carjackable cars onto the curb (cx * 120 ± 6.4 or cz * 120 ± 6.4) of the current procedural chunk
          for (let attempt = 0; attempt < 6; attempt++) {
            const alongNS = (i + attempt) % 2 === 0;
            const sideSign = (i + attempt) % 4 < 2 ? -1 : 1;
            const offsetAlong = (attempt % 2 === 0 ? 1 : -1) * (24 + ((i * 13 + attempt * 19) % 48));
            let nx = alongNS ? cx * 120 + sideSign * 6.4 : cx * 120 + offsetAlong;
            let nz = alongNS ? cz * 120 + offsetAlong : cz * 120 + sideSign * 6.4;

            // Keep curb spot clear of the central intersection
            if (alongNS && Math.abs(nz - cz * 120) < 11) {
              nz += nz >= cz * 120 ? 12 : -12;
            } else if (!alongNS && Math.abs(nx - cx * 120) < 11) {
              nx += nx >= cx * 120 ? 12 : -12;
            }

            if (this._isWaterAt(nx, nz)) continue;

            let clearSpot = true;
            for (const other of this.vehicles) {
              if (other !== v && Math.hypot(other.x - nx, other.z - nz) < 9.5) {
                clearSpot = false;
                break;
              }
            }
            if (!clearSpot) continue;

            v.x = nx;
            v.z = nz;
            v.y = this._getGroundY(nx, nz);
            v.vx = 0;
            v.vz = 0;
            v.vy = 0;
            v.speed = 0;
            v.forwardSpeed = 0;
            v.rotationY = alongNS
              ? sideSign < 0
                ? 0
                : Math.PI
              : sideSign > 0
                ? Math.PI * 0.5
                : -Math.PI * 0.5;
            v.health = v.maxHealth;
            v.isWrecked = false;
            v.isExploded = false;
            v.isSinking = false;
            v.sinkTimer = 0;
            v.fireFuseTimer = 4.5;
            v.pitchAngle = 0;
            v.rollAngle = 0;
            v.driftAngle = 0;
            nearbyParkedCount++;
            break;
          }
        } else if (
          v.isParked &&
          !v.isAircraft &&
          !v.isBoat &&
          !inProceduralWorld &&
          distToPlayer > 240 &&
          v.homeX !== undefined &&
          Math.hypot(v.x - v.homeX, v.z - v.homeZ) > 20
        ) {
          // Restore recycled parked car back to its core Argon City curb spot when player returns to core map
          v.x = v.homeX;
          v.z = v.homeZ;
          v.y = this._getGroundY(v.homeX, v.homeZ);
          v.vx = 0;
          v.vz = 0;
          v.vy = 0;
          v.rotationY = v.homeRotationY ?? 0;
          v.health = v.maxHealth;
          v.isWrecked = false;
          v.isExploded = false;
          v.isSinking = false;
        }

        if (v.isExploded || v.isWrecked) {
          this._updateWreckedOrExplodedPhysics(v, dt);
        } else if (v.isPolice && v.isPursuitCop && this.wantedStars > 0) {
          this._updatePursuitCopAI(v, dt, playerState);
        } else if (v.isPolice && this.wantedStars === 0 && !v.isParked) {
          // At 0 Wanted Stars, any leftover police car never chases the player; despawn when far
          v.isPursuitCop = false;
          if (Math.hypot(v.x - px, v.z - pz) > 65) {
            this._despawnVehicle(v);
            continue;
          }
          this._updateTrafficAI(v, dt, playerState);
        } else if (v.isTraffic && !v.isParked) {
          this._updateTrafficAI(v, dt, playerState);
        } else {
          // Parked vehicle damping (and gentle settling for unoccupied aircraft)
          v.vx *= Math.pow(0.05, dt);
          v.vz *= Math.pow(0.05, dt);
          v.x += v.vx * dt;
          v.z += v.vz * dt;
          v.speed = Math.hypot(v.vx, v.vz);
          if (v.isAircraft) {
            v.isSinking = false;
            const onWater = this._isWaterAt(v.x, v.z);
            const surfY = onWater
              ? this._getWaterSurfaceY(v.x, v.z) + 0.15
              : Math.max(this._getGroundY(v.x, v.z), this._getBuildingRoofYAt(v.x, v.z, v.y));
            if (v.y > surfY) {
              v.y = Math.max(surfY, v.y - 6.5 * dt);
            } else {
              v.y = surfY;
            }
            v.pitchAngle *= Math.pow(0.05, dt);
            v.rollAngle *= Math.pow(0.05, dt);
          }
        }
      }

      // Animate floating Red 'X' marker over wrecked police vehicles (face-on to oblique camera)
      if (v.redXMarker) {
        v.redXMarker.position.y = 2.25 + Math.sin(this.time * 6.0 + i) * 0.14;
        const camYaw =
          this.world?.currentHeadingYaw !== undefined ? this.world.currentHeadingYaw : -0.50;
        v.redXMarker.rotation.y = -v.rotationY + camYaw;
      }

      // Progressive vehicle damage states (<65% steam, <35% black smoke, <15% fire fuse)
      this._updateVehicleDamageEffects(v, dt);

      // Sync 3D transform & wheel rotation
      this._syncVehicleMeshTransform(v, dt);
    }
  }

  _readInput(inputState) {
    if (!inputState) {
      return {
        throttle: 0,
        steer: 0,
        handbrake: false,
        descend: false,
        fwd: false,
        bwd: false,
        left: false,
        right: false,
        moveX: 0,
        moveZ: 0,
        moveMag: 0,
      };
    }
    const keys = inputState.keys || inputState;

    const dirUp = Boolean(
      inputState.forward ||
      inputState.up ||
      inputState.moveForward ||
      keys.KeyW ||
      keys.ArrowUp ||
      keys.w ||
      keys.W
    );
    const dirDown = Boolean(
      inputState.backward ||
      inputState.down ||
      inputState.moveBackward ||
      inputState.brake ||
      keys.KeyS ||
      keys.ArrowDown ||
      keys.s ||
      keys.S
    );
    const dirLeft = Boolean(
      inputState.left ||
      inputState.moveLeft ||
      keys.KeyA ||
      keys.ArrowLeft ||
      keys.a ||
      keys.A
    );
    const dirRight = Boolean(
      inputState.right ||
      inputState.moveRight ||
      keys.KeyD ||
      keys.ArrowRight ||
      keys.d ||
      keys.D
    );

    const fwd = Boolean(
      dirUp || (typeof inputState.throttle === 'number' && inputState.throttle > 0.05)
    );
    const bwd = Boolean(
      dirDown || (typeof inputState.throttle === 'number' && inputState.throttle < -0.05)
    );
    const left = Boolean(
      dirLeft || (typeof inputState.steer === 'number' && inputState.steer > 0.05)
    );
    const right = Boolean(
      dirRight || (typeof inputState.steer === 'number' && inputState.steer < -0.05)
    );
    const handbrake = Boolean(
      inputState.handbrake ||
      inputState.drift ||
      inputState.space ||
      inputState.jump ||
      keys.Space ||
      keys[' ']
    );
    const descend = Boolean(
      inputState.descend ||
      inputState.crouch ||
      inputState.shift ||
      inputState.sprint ||
      keys.ShiftLeft ||
      keys.ShiftRight ||
      keys.Shift ||
      keys.ControlLeft ||
      keys.ControlRight ||
      keys.KeyZ ||
      keys.z ||
      keys.Z
    );

    let throttle = 0;
    if (typeof inputState.throttle === 'number' && Math.abs(inputState.throttle) > 0.01) {
      throttle = clamp(inputState.throttle, -1, 1);
    } else {
      if (fwd) throttle += 1;
      if (bwd) throttle -= 1;
    }

    let steer = 0;
    if (typeof inputState.steer === 'number' && Math.abs(inputState.steer) > 0.01) {
      steer = clamp(inputState.steer, -1, 1);
    } else {
      if (left) steer += 1;
      if (right) steer -= 1;
    }

    // Compute screen-aligned directional movement vector for intuitive overhead flight controls:
    // W / Up -> North (-Z), S / Down -> South (+Z), A / Left -> West (-X), D / Right -> East (+X)
    let moveX = Number(inputState.moveX || 0);
    let moveZ = Number(inputState.moveZ || 0);
    if (dirLeft || dirRight || dirUp || dirDown) {
      moveX = (dirRight ? 1 : 0) - (dirLeft ? 1 : 0);
      moveZ = (dirDown ? 1 : 0) - (dirUp ? 1 : 0);
    }
    const moveMag = Math.hypot(moveX, moveZ);
    if (moveMag > 1.0) {
      moveX /= moveMag;
      moveZ /= moveMag;
    }

    return {
      throttle,
      steer,
      handbrake,
      descend,
      fwd,
      bwd,
      left,
      right,
      moveX,
      moveZ,
      moveMag: Math.min(1.0, moveMag),
    };
  }

  _updatePlayerVehicle(dt, v, playerState, input) {
    // Check if hotwire state unlocked externally
    if (v.awaitingHotwire && (v.isHotwired || !v.requiresHotwire)) {
      v.awaitingHotwire = false;
    }

    // If hotwire modal explicitly locked ignition via v.hotwireIgnitionLocked, wait
    if (v.hotwireIgnitionLocked && !v.isHotwired) {
      return;
    }

    const spec = v.spec;
    const poppedFactor = v.tiresPopped ? 0.62 : 1.0;
    const maxFwdSpeed = spec.maxSpeed * poppedFactor;
    const maxRevSpeed = spec.reverseSpeed * 1.42 * poppedFactor;

    if (typeof v.forwardSpeed !== 'number') {
      v.forwardSpeed = 0;
    }
    let forwardSpeed = v.forwardSpeed;

    // 1. Ground & Marine Throttle / Braking / Reverse (Aircraft handle thrust & direction in Section 3 below)
    if (!v.isAircraft) {
      if (input.throttle > 0) {
        if (forwardSpeed < 0 && forwardSpeed > -3.2) {
          forwardSpeed = 2.2;
        }
        const accelRate = forwardSpeed < 0 ? spec.brake * 1.35 : spec.accel;
        forwardSpeed = Math.min(maxFwdSpeed, forwardSpeed + input.throttle * accelRate * dt);
      } else if (input.throttle < 0) {
        if (forwardSpeed > 0 && forwardSpeed < 3.5) {
          forwardSpeed = -2.8;
        }
        const decelRate = forwardSpeed > 0.5 ? spec.brake * 1.35 : spec.accel * 1.48;
        forwardSpeed = Math.max(-maxRevSpeed, forwardSpeed + input.throttle * decelRate * dt);
      } else {
        // Natural coasting drag down to 0 (never auto-accelerates)
        const drag = v.isBoat ? 4.5 : 8.5;
        if (Math.abs(forwardSpeed) <= drag * dt) {
          forwardSpeed = 0;
        } else {
          forwardSpeed -= Math.sign(forwardSpeed) * drag * dt;
        }
      }

      // Handbrake emergency decel when not holding throttle, or slight drift trim when power-sliding
      if (input.handbrake && !v.isBoat) {
        if (input.throttle <= 0) {
          const hbDecel = spec.brake * 0.85 * dt;
          if (Math.abs(forwardSpeed) <= hbDecel) {
            forwardSpeed = 0;
          } else {
            forwardSpeed -= Math.sign(forwardSpeed) * hbDecel;
          }
        } else {
          forwardSpeed *= Math.pow(0.92, dt);
        }
      }
      v.forwardSpeed = forwardSpeed;

      // 2. Speed-Sensitive Steering for Ground Cars & Boats
      const speedAbs = Math.abs(forwardSpeed);
      const hasMotion = speedAbs > 0.12 || Math.abs(input.throttle) > 0.05;
      const steerAuthority =
        Math.max(0.82, clamp(speedAbs / 2.0, 0, 1)) * (1 - clamp(speedAbs / 110, 0, 0.22));
      // Only invert steering sign when genuinely moving in reverse (prevents mid-braking steering flip!)
      const reverseSign =
        forwardSpeed < -0.25 || (forwardSpeed <= 0.05 && input.throttle < -0.05) ? -1 : 1;
      const driftTurnMultiplier = input.handbrake && !v.isBoat ? 1.45 : 1.0;

      v.steerAngle = input.steer * 0.46;
      if (hasMotion && Math.abs(input.steer) > 0.01) {
        v.rotationY = wrapAngle(
          v.rotationY +
            input.steer * reverseSign * spec.turnSpeed * driftTurnMultiplier * steerAuthority * dt
        );
      }
    }

    const speedAbs = Math.abs(v.forwardSpeed || 0);

    // 3. Flyable Aircraft Physics vs Marine Speedboat Physics vs Land Car / Stunt Jump / Beach / Water Sinking Physics
    if (v.isAircraft) {
      v.isSinking = false;
      const onWater = this._isWaterAt(v.x, v.z);
      const waterY = this._getWaterSurfaceY(v.x, v.z);
      const groundY = this._getGroundY(v.x, v.z);
      const roofY = this._getBuildingRoofYAt(v.x, v.z, v.y);
      const baseSurfaceY = onWater ? waterY + 0.15 : groundY;
      const surfaceY = Math.max(baseSurfaceY, roofY);

      // Determine whether player is actively commanding directional movement (WASD / Arrows)
      // or legacy raw throttle/steer from an external test harness
      const hasDirInput = (input.moveMag || 0) > 0.05;
      const hasRawThrottle = !hasDirInput && Math.abs(input.throttle || 0) > 0.05;
      const isPlane = v.spec.aircraftType === 'plane';
      let visualTurnBank = 0;

      if (hasDirInput) {
        // Screen-aligned directional control:
        // W = North (-Z, up-screen), S = South (+Z, down-screen), A = West (-X, left-screen), D = East (+X, right-screen).
        // Smoothly rotate aircraft nose toward desiredYaw and accelerate in the pressed direction!
        const desiredYaw = Math.atan2(input.moveX, input.moveZ);
        const angleDiff = wrapAngle(desiredYaw - v.rotationY);
        const turnRate = isPlane ? 5.6 : 8.2;
        const maxStep = turnRate * dt;
        if (Math.abs(angleDiff) <= maxStep) {
          v.rotationY = desiredYaw;
        } else {
          v.rotationY = wrapAngle(v.rotationY + Math.sign(angleDiff) * maxStep);
        }
        visualTurnBank = clamp(angleDiff * 0.75, -1, 1);

        // Smooth acceleration (no jarring 1-frame snap to 21 m/s, and no reverse flight)
        const accelRate = isPlane ? 36.0 : 34.0;
        if (forwardSpeed < 0) forwardSpeed = 0;
        forwardSpeed = Math.min(maxFwdSpeed, forwardSpeed + accelRate * input.moveMag * dt);

        // Blend velocity directly toward pressed direction so aircraft NEVER shoots off in the wrong direction while turning!
        const noseWeight = Math.max(0, Math.cos(angleDiff));
        const dirVx =
          (input.moveX * (1 - noseWeight * 0.5) + Math.sin(v.rotationY) * (noseWeight * 0.5)) *
          forwardSpeed;
        const dirVz =
          (input.moveZ * (1 - noseWeight * 0.5) + Math.cos(v.rotationY) * (noseWeight * 0.5)) *
          forwardSpeed;
        const blendRate = isPlane ? 11.0 : 10.0;
        v.vx += (dirVx - v.vx) * Math.min(1, blendRate * dt);
        v.vz += (dirVz - v.vz) * Math.min(1, blendRate * dt);
      } else if (hasRawThrottle) {
        // Fallback for programmatic test callers passing raw { throttle, steer }
        if (Math.abs(input.steer) > 0.01) {
          v.rotationY = wrapAngle(v.rotationY + input.steer * spec.turnSpeed * dt);
          visualTurnBank = input.steer;
        }
        if (input.throttle > 0) {
          if (forwardSpeed < 0) forwardSpeed = 0;
          forwardSpeed = Math.min(maxFwdSpeed, forwardSpeed + 36.0 * input.throttle * dt);
        } else {
          forwardSpeed = Math.max(0, forwardSpeed - spec.brake * 1.35 * dt);
        }
        const targetVx = Math.sin(v.rotationY) * forwardSpeed;
        const targetVz = Math.cos(v.rotationY) * forwardSpeed;
        v.vx += (targetVx - v.vx) * Math.min(1, 10.0 * dt);
        v.vz += (targetVz - v.vz) * Math.min(1, 10.0 * dt);
      } else {
        // NO movement keys pressed: ZERO auto-acceleration!
        // Smoothly decelerate forwardSpeed and horizontal velocity down to 0.
        if (Math.abs(input.steer) > 0.01) {
          v.rotationY = wrapAngle(v.rotationY + input.steer * spec.turnSpeed * dt);
          visualTurnBank = input.steer;
        }
        const idleDrag = isPlane ? 14.0 : 16.0;
        forwardSpeed = Math.max(0, forwardSpeed - idleDrag * dt);
        v.vx *= Math.pow(0.03, dt);
        v.vz *= Math.pow(0.03, dt);
        if (Math.hypot(v.vx, v.vz) < 0.08) {
          v.vx = 0;
          v.vz = 0;
        }
      }

      v.forwardSpeed = forwardSpeed;
      v.x += v.vx * dt;
      v.z += v.vz * dt;
      v.speed = Math.hypot(v.vx, v.vz);

      const activelyFlying = hasDirInput || (hasRawThrottle && input.throttle > 0);

      if (isPlane) {
        // Dodo Skimmer Seaplane Altitude & Amphibious Physics:
        // - Space climbs up to 36m
        // - Shift / Ctrl / Z descends to land
        // - Holding WASD climbs smoothly once speed > 8.5 m/s up to cruise altitude (18m)
        // - Releasing all keys decelerates and gently glides down to land (never auto-accelerates!)
        let targetVy = 0;
        if (input.descend) {
          targetVy = v.y > surfaceY + 0.05 ? -8.5 : 0;
        } else if (input.handbrake) {
          targetVy = v.y < 36.0 ? 10.5 : 0;
          if (v.y < 36.0) v.vy = Math.max(v.vy, 5.0);
        } else if (activelyFlying) {
          if (forwardSpeed >= 8.0 || v.y > surfaceY + 1.0) {
            targetVy = v.y < 18.0 ? clamp((18.5 - v.y) * 1.15, 4.5, 9.5) : 0;
            if (v.y < 14.0 && forwardSpeed >= 9.5) {
              v.vy = Math.max(v.vy, 4.5);
            }
          }
        } else {
          // Coasting with no keys pressed: gentle glide descent when airspeed drops
          if (v.y > surfaceY + 0.05) {
            targetVy = forwardSpeed > 15.0 ? -1.5 : -5.5;
          } else {
            targetVy = 0;
          }
        }

        v.vy += (targetVy - v.vy) * Math.min(1, 6.5 * dt);
        v.y += v.vy * dt;

        if (v.y <= surfaceY + 0.02) {
          const waveBob =
            onWater ? Math.sin(this.time * 6.0 + v.x * 0.15 + v.z * 0.15) * 0.035 : 0;
          v.y = surfaceY + waveBob;
          if (v.vy < 0) v.vy = 0;
          v.isAirborne = false;
        } else {
          v.y = Math.min(36.0, v.y);
          v.isAirborne = v.y > surfaceY + 0.5;
        }

        // Banking & Nose Pitch
        const targetRoll = -visualTurnBank * (v.y > surfaceY + 0.6 ? 0.46 : 0.12);
        v.rollAngle += (targetRoll - v.rollAngle) * Math.min(1, 7.5 * dt);
        v.pitchAngle = clamp(-v.vy * 0.032, -0.32, 0.32);
        v.driftAngle = -visualTurnBank * 0.08;

        // Amphibious water wake foam ribbons when skimming across water
        if (onWater && v.y <= waterY + 0.35 && v.speed > 3.0) {
          v.skidTimer += dt;
          if (v.skidTimer >= 0.055) {
            v.skidTimer = 0;
            const sternX = v.x - Math.sin(v.rotationY) * 2.2;
            const sternZ = v.z - Math.cos(v.rotationY) * 2.2;
            this._spawnWaterWake(sternX, waterY + 0.05, sternZ, v.rotationY, v.speed);
            this.world?.addWaterWake?.(sternX, sternZ, v.rotationY, v.speed);
          }
        } else if (
          !onWater &&
          v.y <= groundY + 0.3 &&
          this._isBeachSandAt(v.x, v.z) &&
          v.speed > 2.0
        ) {
          v.sandTrailTimer = (v.sandTrailTimer || 0) + dt;
          if (v.sandTrailTimer >= 0.045) {
            v.sandTrailTimer = 0;
            this._spawnBeachSandTrail(v);
          }
        }

        // Wingtip contrail puffs when airborne
        if (v.y > groundY + 3.0 && v.speed > 14.0) {
          v.contrailTimer = (v.contrailTimer || 0) + dt;
          if (v.contrailTimer >= 0.045) {
            v.contrailTimer = 0;
            this._spawnWingtipContrail(v);
          }
        }

        // Height-aware building collision ONLY (bypasses bridge parapets & seawalls via isAircraft = true!)
        const col = this._resolveWorldCollision(v.x, v.z, v.spec.width * 0.45, false, v.y, true);
        if (col.hit) {
          v.x = col.x + (col.nx || 0) * 0.05;
          v.z = col.z + (col.nz || 0) * 0.05;
          const vn = v.vx * (col.nx || 0) + v.vz * (col.nz || 0);
          if (vn < 0) {
            v.vx -= (col.nx || 0) * vn * 1.05;
            v.vz -= (col.nz || 0) * vn * 1.05;
          }
        }
      } else {
        // Argon Maverick Helicopter VTOL & Stationary Hover Physics:
        // - WASD flies in any screen direction (and lifts off to 18m cruise altitude)
        // - Releasing WASD stops horizontal motion in a stable stationary hover!
        // - Space climbs up to 36m; Shift / Ctrl / Z descends smoothly to land!
        let targetVy = 0;
        if (input.descend) {
          targetVy = v.y > surfaceY + 0.05 ? -8.5 : 0;
        } else if (input.handbrake) {
          targetVy = v.y < 36.0 ? 11.0 : 0;
          if (v.y < 36.0) v.vy = Math.max(v.vy, 5.5);
        } else if (activelyFlying) {
          if (v.y < 18.0) {
            targetVy = clamp((18.5 - v.y) * 1.25, 5.0, 10.5);
            v.vy = Math.max(v.vy, 4.5);
          } else {
            targetVy = Math.cos(this.time * 2.8) * 0.2;
          }
        } else {
          // Stationary hover when airborne, or parked when on surface
          if (v.y > surfaceY + 1.0) {
            targetVy = Math.cos(this.time * 2.8) * 0.2;
          } else {
            targetVy = -2.5;
          }
        }

        v.vy += (targetVy - v.vy) * Math.min(1, 6.0 * dt);
        v.y += v.vy * dt;

        if (v.y <= surfaceY + 0.02) {
          v.y = surfaceY;
          if (v.vy < 0) v.vy = 0;
          v.isAirborne = false;
        } else {
          v.y = Math.min(36.0, v.y);
          v.isAirborne = v.y > surfaceY + 0.4;
        }

        const targetRoll = -visualTurnBank * (v.y > surfaceY + 0.4 ? 0.36 : 0.05);
        v.rollAngle += (targetRoll - v.rollAngle) * Math.min(1, 7.0 * dt);
        const targetPitch =
          v.y > surfaceY + 0.4
            ? clamp(forwardSpeed * 0.0055 - v.vy * 0.012, -0.26, 0.26)
            : 0;
        v.pitchAngle += (targetPitch - v.pitchAngle) * Math.min(1, 7.0 * dt);
        v.driftAngle = 0;

        const col = this._resolveWorldCollision(v.x, v.z, v.spec.width * 0.48, false, v.y, true);
        if (col.hit) {
          v.x = col.x + (col.nx || 0) * 0.05;
          v.z = col.z + (col.nz || 0) * 0.05;
        }
      }
    } else if (v.isBoat) {
      const onWater = this._isWaterAt(v.x, v.z);
      const waterFactor = onWater ? 1.0 : 0.22;
      const targetVx = Math.sin(v.rotationY) * forwardSpeed * waterFactor;
      const targetVz = Math.cos(v.rotationY) * forwardSpeed * waterFactor;

      v.vx += (targetVx - v.vx) * Math.min(1, 8.5 * dt);
      v.vz += (targetVz - v.vz) * Math.min(1, 8.5 * dt);
      v.x += v.vx * dt;
      v.z += v.vz * dt;
      v.speed = Math.hypot(v.vx, v.vz);

      // Bow pitch upward with speed + wave bounce + turn banking roll
      const waveBounce = Math.sin(this.time * 7.2 + v.x * 0.18 + v.z * 0.18);
      v.y = this._getWaterSurfaceY(v.x, v.z) + waveBounce * (0.04 + clamp(v.speed / 280, 0, 0.12));
      v.pitchAngle = -clamp(v.speed / 145, 0, 0.24) + waveBounce * 0.035;
      v.rollAngle = -input.steer * clamp(v.speed / 85, 0, 0.3);
      v.driftAngle = -input.steer * clamp(v.speed / 120, 0, 0.18);

      // Spawn continuous white V-shaped wake foam ribbons behind twin outboards
      if (onWater && v.speed > 3.5) {
        v.skidTimer += dt;
        if (v.skidTimer >= 0.055) {
          v.skidTimer = 0;
          const sternX = v.x - Math.sin(v.rotationY) * 3.3;
          const sternZ = v.z - Math.cos(v.rotationY) * 3.3;
          this._spawnWaterWake(sternX, v.y + 0.05, sternZ, v.rotationY, v.speed);
          this.world?.addWaterWake?.(sternX, sternZ, v.rotationY, v.speed);
        }
      }
    } else {
      const onBeachSand = !v.isSinking && !v.isAirborne && this._isBeachSandAt(v.x, v.z);

      // Asphalt car / superbike physics with Spacebar handbrake power-slide drift
      const isDrifting =
        !v.isSinking &&
        !v.isAirborne &&
        ((input.handbrake && speedAbs > 6.5 && Math.abs(input.steer) > 0.05) ||
          (v.tiresPopped && speedAbs > 10 && Math.abs(input.steer) > 0.05));

      if (isDrifting) {
        const targetDrift = -input.steer * 0.54;
        v.driftAngle += (targetDrift - v.driftAngle) * Math.min(1, 9.5 * dt);
        v.driftTimer += dt;
        v.rollAngle = input.steer * 0.095;

        // Dual rear tire dark asphalt skidmark ribbons (or sand trails on beach) + smoke/sand puffs
        v.skidTimer += dt;
        if (v.skidTimer >= 0.038) {
          v.skidTimer = 0;
          if (onBeachSand) {
            this._spawnBeachSandTrail(v);
            this._spawnSandSprayPuff(v);
          } else {
            this._spawnDualTireSkids(v);
            this._spawnTireSmokePuff(v);
          }
        }

        // Award DRIFT BONUS callout for sustained power-slides
        if (v.driftTimer >= 0.55) {
          v.driftTimer = -0.5;
          if (playerState && typeof playerState.cash === 'number') {
            playerState.cash += 150;
          }
          this.callbacks.onCallout?.('DRIFT BONUS! +$150', 'STYLISH POWER-SLIDE', '#ff2a85');
          this.callbacks.onPlaySound?.('tire_screech');
        }
      } else if (!v.isSinking) {
        if (onBeachSand && Math.abs(input.steer) > 0.05 && speedAbs > 4.5) {
          // Subtle loose beach-sand tail slip when carving across the dunes
          const sandSlip = -input.steer * 0.22;
          v.driftAngle += (sandSlip - v.driftAngle) * Math.min(1, 7.5 * dt);
        } else {
          v.driftAngle *= Math.pow(0.02, dt);
        }
        v.driftTimer = Math.max(0, v.driftTimer - dt * 2);
        v.rollAngle = -input.steer * clamp(speedAbs / 180, 0, 0.06);
      }

      // Continuous Beach Sand Tire Trail & Golden Rooster-Tail Spray whenever driving on the beach!
      if (onBeachSand && speedAbs > 1.0 && !isDrifting) {
        v.sandTrailTimer = (v.sandTrailTimer || 0) + dt;
        const interval = clamp(0.42 / Math.max(2.5, speedAbs), 0.022, 0.055);
        if (v.sandTrailTimer >= interval) {
          v.sandTrailTimer = 0;
          this._spawnBeachSandTrail(v);
          if (speedAbs > 3.2) {
            this._spawnSandSprayPuff(v);
          }
        }
      }

      // Blend velocity vector with heading for controllable arcade drift slide
      const gripRate = v.isAirborne ? 3.5 : isDrifting ? 5.2 : onBeachSand ? 10.5 : 16.0;
      const targetVx = Math.sin(v.rotationY) * forwardSpeed;
      const targetVz = Math.cos(v.rotationY) * forwardSpeed;
      v.vx += (targetVx - v.vx) * Math.min(1, gripRate * dt);
      v.vz += (targetVz - v.vz) * Math.min(1, gripRate * dt);

      v.x += v.vx * dt;
      v.z += v.vz * dt;

      // Check 3D Unique Stunt Jump Ramps before obstacle collision!
      if (!v.isSinking && !v.isAirborne && speedAbs > 12.5) {
        const ramps = this._getStuntRamps();
        for (const r of ramps) {
          const rw = (r.width || 5.0) * 0.65;
          const rl = (r.length || 8.0) * 0.65;
          if (Math.abs(v.x - r.x) <= rw && Math.abs(v.z - r.z) <= rl) {
            v.isAirborne = true;
            v.vy = Math.min(21.0, Math.max(11.5, speedAbs * 0.52));
            v.stuntStartX = v.x;
            v.stuntStartZ = v.z;
            v.stuntPeakY = v.y;
            this.callbacks.onCallout?.(
              'STUNT JUMP LAUNCH!',
              r.name?.toUpperCase() || 'AIRBORNE!',
              '#ffd600'
            );
            this.callbacks.onPlaySound?.('stunt_launch');
            break;
          }
        }
      }

      // World building & bridge guardrail collision with SMOOTH TANGENTIAL WALL-SLIDING
      // (Bypasses low obstacles while airborne at v.y > 2.2!)
      if (!v.isSinking && (!v.isAirborne || v.y <= 2.2)) {
        const col = this._resolveWorldCollision(v.x, v.z, v.spec.width * 0.52, false, v.y);
        if (col.hit) {
          let nx = col.nx || 0;
          let nz = col.nz || 0;
          if (nx === 0 && nz === 0) {
            const dx = col.x - v.x;
            const dz = col.z - v.z;
            const d = Math.hypot(dx, dz) || 1;
            nx = dx / d;
            nz = dz / d;
          }
          v.x = col.x + nx * 0.03;
          v.z = col.z + nz * 0.03;

          const impactSpeed = Math.hypot(v.vx, v.vz);
          const vn = v.vx * nx + v.vz * nz;

          // Strip inward normal velocity so the car slides cleanly along the wall tangent
          if (vn < 0) {
            v.vx -= nx * vn * 1.04;
            v.vz -= nz * vn * 1.04;
          }

          // Determine actual travel direction sign from velocity (NEVER flip sign when braking!)
          const fwdX = Math.sin(v.rotationY);
          const fwdZ = Math.cos(v.rotationY);
          const moveSign =
            Math.abs(forwardSpeed) > 0.25
              ? Math.sign(forwardSpeed)
              : input.throttle < -0.05
                ? -1
                : 1;
          const dirX = fwdX * moveSign;
          const dirZ = fwdZ * moveSign;
          const headDotN = dirX * nx + dirZ * nz;

          // Only gently guide heading on glancing wall contact when throttle matches travel direction
          if (headDotN < -0.15 && headDotN > -0.82 && input.throttle * moveSign > 0.05) {
            const t1x = -nz;
            const t1z = nx;
            const dotT = dirX * t1x + dirZ * t1z;
            if (Math.abs(dotT) > 0.18) {
              const tangSign = Math.sign(dotT);
              const tx = t1x * tangSign;
              const tz = t1z * tangSign;
              const desiredMoveYaw = Math.atan2(tx, tz);
              const desiredRotY = moveSign > 0 ? desiredMoveYaw : wrapAngle(desiredMoveYaw + Math.PI);
              v.rotationY = lerpAngle(v.rotationY, desiredRotY, Math.min(1, 3.8 * dt));
            }
          }

          // Never auto-accelerate or invert speed on wall contact; clamp to projected slide speed
          const slideSpeed = Math.hypot(v.vx, v.vz);
          v.forwardSpeed = moveSign * Math.min(Math.abs(v.forwardSpeed), slideSpeed);

          if (impactSpeed > 13 && Math.abs(vn) > 7.5 && (!v.sparkCooldown || v.sparkCooldown <= 0)) {
            v.sparkCooldown = 0.25;
            this._spawnSparkBurst(col.contactX, v.y + 0.6, col.contactZ, 10);
            this.callbacks.onSpark?.(col.contactX, v.y + 0.6, col.contactZ, 10);
            this.damageVehicle(v, (Math.abs(vn) - 6) * 0.35, 'environment');
          }
        }
      }
      if (v.sparkCooldown > 0) v.sparkCooldown -= dt;

      const groundY = this._getGroundY(v.x, v.z);

      // 3D Unique Stunt Jump Airborne Trajectory & Landing Bonus
      if (!v.isSinking && (v.isAirborne || v.y > groundY + 0.15 || v.vy > 0)) {
        v.isAirborne = true;
        v.y += v.vy * dt;
        v.vy -= 22.0 * dt;
        v.stuntPeakY = Math.max(v.stuntPeakY || 0, v.y);
        v.pitchAngle = clamp(-v.vy * 0.028, -0.38, 0.38);
        v.speed = Math.hypot(v.vx, v.vz);

        if (v.y <= groundY) {
          v.y = groundY;
          v.vy = 0;
          v.pitchAngle = 0;
          v.isAirborne = false;
          const jumpDist = Math.round(
            Math.hypot(v.x - (v.stuntStartX ?? v.x), v.z - (v.stuntStartZ ?? v.z))
          );
          const airFeet = Math.round((v.stuntPeakY || 3) * 3.28);
          this._spawnSparkBurst(v.x, v.y + 0.35, v.z, 16);
          this.callbacks.onSpark?.(v.x, v.y + 0.35, v.z, 16);
          if (playerState && typeof playerState.cash === 'number') {
            playerState.cash += 2000;
          }
          this.callbacks.onCallout?.(
            'INSANE STUNT BONUS! +$2,000',
            `${jumpDist}M JUMP • ${airFeet}FT AIR`,
            '#00e5ff'
          );
          this.callbacks.onPlaySound?.('stunt_bonus');
          v.stuntPeakY = 0;
        }
      } else {
        // Progressive Water Sinking Sequence: when driving towards/into water, let the car splash in
        // and visibly sink nose-down into the waves before bailing out the player to swim!
        const inWaterNow = this._isWaterAt(v.x, v.z);
        if (inWaterNow || v.isSinking) {
          const waterY = this._getWaterSurfaceY(v.x, v.z);
          if (!v.isSinking) {
            v.isSinking = true;
            v.sinkTimer = 0;
            v.sinkBubbleTimer = 0;
            this._spawnWaterSplash(v.x, waterY + 0.05, v.z);
            this.world?.addWaterWake?.(v.x, v.z, v.vx, v.vz);
            this._spawnSmokePuff(v.x, waterY + 0.25, v.z, 'steam');
            this.callbacks.onCallout?.(
              'SINKING IN WATER!',
              'ENGINE FLOODED — CAR SINKING...',
              '#00f0ff'
            );
            this.callbacks.onPlaySound?.('splash');
          }

          v.sinkTimer = (v.sinkTimer || 0) + dt;
          v.sinkBubbleTimer = (v.sinkBubbleTimer || 0) + dt;

          // Hydrodynamic water drag slows the car as it glides into the surf and sinks
          const waterDrag = Math.pow(0.18, dt);
          v.forwardSpeed *= waterDrag;
          v.vx *= waterDrag;
          v.vz *= waterDrag;
          v.speed = Math.hypot(v.vx, v.vz);

          const sinkProgress = clamp(v.sinkTimer / 2.1, 0, 1);
          const easeSink = sinkProgress * (0.45 + 0.55 * sinkProgress);
          v.y = waterY - 0.04 - easeSink * 1.42;
          v.pitchAngle = 0.08 + sinkProgress * 0.38;
          v.rollAngle = Math.sin(v.sinkTimer * 4.5) * 0.07 + sinkProgress * 0.14;

          // Continuous bubbling water rings & white radiator steam as the chassis submerges
          if (v.sinkBubbleTimer >= 0.11) {
            v.sinkBubbleTimer = 0;
            this._spawnWaterBubbleRing(v.x, waterY + 0.03, v.z);
            this.world?.addWaterWake?.(v.x, v.z, v.vx * 0.2, v.vz * 0.2);
            if (sinkProgress < 0.85) {
              const hoodX = v.x + Math.sin(v.rotationY) * (v.spec.length * 0.32);
              const hoodZ = v.z + Math.cos(v.rotationY) * (v.spec.length * 0.32);
              this._spawnSmokePuff(hoodX, waterY + 0.15, hoodZ, 'steam');
            }
          }

          // Once submerged up to the roof (~1.75s), mark wrecked and eject player to swim!
          if (v.sinkTimer >= 1.75) {
            v.isWrecked = true;
            v.vx = 0;
            v.vz = 0;
            v.forwardSpeed = 0;
            v.speed = 0;
            this.callbacks.onCallout?.(
              'VEHICLE SUBMERGED!',
              'BAILING OUT TO SWIM [WASD]',
              '#00f0ff'
            );
            this._syncVehicleMeshTransform(v, dt);
            this.exitVehicle(playerState);
            return;
          }
        } else {
          v.y = groundY;
          v.speed = Math.hypot(v.vx, v.vz);
          v.pitchAngle = -clamp((input.throttle * v.speed) / 420, -0.04, 0.04);
        }
      }
    }

    // Brake light glow intensity
    const braking = input.throttle < -0.1 || (input.handbrake && !v.isAircraft);
    for (const tl of v.taillightMeshes) {
      tl.material.color.setHex(braking ? 0xff5252 : 0xd50000);
    }

    // Sync playerState coordinates with vehicle
    if (playerState) {
      playerState.x = v.x;
      playerState.y = v.y;
      playerState.z = v.z;
      playerState.vx = v.vx;
      playerState.vz = v.vz;
      playerState.speed = v.speed;
      playerState.rotationY = v.rotationY;
      if (playerState.position && typeof playerState.position.set === 'function') {
        playerState.position.set(v.x, v.y, v.z);
      }
      if (playerState.mesh && playerState.mesh.visible) {
        playerState.mesh.position.set(v.x, v.y + 0.45, v.z);
        playerState.mesh.rotation.y = v.rotationY;
      }
    }
  }

  // ============================================================================
  // AI TRAFFIC & ESCALATING ACPD PURSUIT AI + ESCAPE COOLDOWN (1..5 STARS)
  // ============================================================================

  _updateWantedPursuitManager(dt, playerState) {
    if (this.wantedStars <= 0) {
      // Passively cool down sub-1-star minor heat when not wanted
      if (this.wantedHeat > 0) {
        this.wantedHeat = Math.max(0, this.wantedHeat - 18 * dt);
      }
      this.policeHeli.group.visible = false;
      this.escapeTimer = 0;
      this.escapeProgress = 0;
      this.isEvading = false;
      return;
    }

    this.timeSinceLastCrime += dt;
    if (this.pursuitSpawnGraceTimer > 0) {
      this.pursuitSpawnGraceTimer -= dt;
    }

    this.escapeDuration = this.wantedStars <= 1 ? 5.5 : this.wantedStars === 2 ? 7.0 : 8.5;

    const px = this.playerVehicle ? this.playerVehicle.x : (playerState?.x ?? 80);
    const pz = this.playerVehicle ? this.playerVehicle.z : (playerState?.z ?? -26);
    const pRot = this.playerVehicle ? this.playerVehicle.rotationY : (playerState?.rotationY ?? 0);
    const playerSpeed = this.playerVehicle
      ? this.playerVehicle.speed
      : Math.hypot(playerState?.vx ?? 0, playerState?.vz ?? 0);

    // Count active non-wrecked police pursuers & check closest cop distance + line of sight
    let activeCops = 0;
    let minCopDist = Infinity;
    let anyCopHasCloseLOS = false;

    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.isPolice && !v.isWrecked && !v.isExploded && v !== this.playerVehicle) {
        const dist = Math.hypot(v.x - px, v.z - pz);
        // Let the player genuinely outrun distant cops (> 105m behind) instead of teleporting them!
        if (dist > 105) {
          this._despawnVehicle(v);
          continue;
        }
        activeCops++;
        if (dist < minCopDist) {
          minCopDist = dist;
        }
        if (dist <= 24) {
          anyCopHasCloseLOS = true;
        } else if (dist <= 44 && !this._isLineOccludedByBuilding(v.x, v.z, px, pz)) {
          anyCopHasCloseLOS = true;
        }
      }
    }

    // Balanced pursuing units by Wanted Star level so 1-Star is fun & manageable:
    // 1 Star: 1 Patrol Cruiser
    // 2 Stars: 2 Patrol Cruisers
    // 3 Stars: 3 units (Cruisers + ACPD Cheetah Interceptors)
    // 4 Stars: 4 units (Cruisers + Cheetahs + SWAT Enforcers) + Spike Strip Roadblocks
    // 5 Stars: 4 units + ACPD Police Helicopter overhead
    const maxCopsByStar = [0, 1, 2, 3, 4, 4];
    const desiredCops = maxCopsByStar[this.wantedStars] || 1;
    this.pursuitSpawnTimer -= dt;

    // Only spawn the initial pursuit wave for the current star level (never endlessly respawn in front of an evading player!)
    if (
      activeCops < desiredCops &&
      this.copsSpawnedForCurrentStar < desiredCops &&
      !this.isEvading &&
      this.pursuitSpawnTimer <= 0
    ) {
      this.pursuitSpawnTimer = 4.5;
      let copType = 'vcpd_cruiser';
      if (this.wantedStars >= 4 && Math.random() < 0.45) {
        copType = 'swat_enforcer';
      } else if (this.wantedStars >= 3 && Math.random() < 0.55) {
        copType = 'vcpd_cheetah';
      }

      // Spawn pursuing unit on a clear road lane behind/away from player (42m..56m away)
      const roadLanes = this._getDynamicRoadLanesNear(px, pz);
      let sx = px;
      let sz = pz - 46;
      let bestLaneDist = Infinity;
      for (const lane of roadLanes) {
        if (lane.axis === 'z') {
          const d = Math.abs(px - lane.coord);
          if (d < bestLaneDist) {
            bestLaneDist = d;
            sx = lane.coord;
            const dirSign = Math.cos(pRot) >= 0 ? -1 : 1;
            sz = clamp(
              pz + dirSign * (42 + Math.random() * 12),
              lane.minCoord ?? pz - 160,
              lane.maxCoord ?? pz + 160
            );
          }
        } else if (lane.axis === 'x') {
          const d = Math.abs(pz - lane.coord);
          if (d < bestLaneDist) {
            bestLaneDist = d;
            sz = lane.coord;
            const dirSign = Math.sin(pRot) >= 0 ? -1 : 1;
            sx = clamp(
              px + dirSign * (42 + Math.random() * 12),
              lane.minCoord ?? px - 160,
              lane.maxCoord ?? px + 160
            );
          }
        }
      }
      // Ensure spawn spot is not on top of another vehicle
      for (const other of this.vehicles) {
        if (Math.hypot(other.x - sx, other.z - sz) < 8.5) {
          sz -= 10;
        }
      }
      if (!this._isWaterAt(sx, sz)) {
        const faceAngle = Math.atan2(px - sx, pz - sz);
        this.spawnVehicle(copType, sx, sz, faceAngle, { isPursuitCop: true });
        this.copsSpawnedForCurrentStar++;
        activeCops++;
      }
    }

    // Pursuit Escape / Evasion Cooldown Progression:
    // 1. Out of close cop sight (minCopDist > 44m or occluded by buildings at > 24m)
    // 2. Or no new crime for > 4.2s while moving fast (playerSpeed > 14) or ducking into alleys
    const prevEvading = this.isEvading;
    if (this.pursuitSpawnGraceTimer <= 0) {
      if (!anyCopHasCloseLOS || minCopDist > 44) {
        this.isEvading = true;
        this.escapeTimer += dt;
      } else if (this.timeSinceLastCrime > 4.2 && playerSpeed > 14) {
        this.isEvading = true;
        this.escapeTimer += dt * 0.9;
      } else if (this.timeSinceLastCrime > 5.5 && minCopDist > 16) {
        this.isEvading = true;
        this.escapeTimer += dt * 0.72;
      } else {
        this.isEvading = false;
        this.escapeTimer = Math.max(0, this.escapeTimer - dt * 0.35);
      }
    }

    this.escapeProgress = clamp(this.escapeTimer / this.escapeDuration, 0, 1);

    if (this.isEvading !== prevEvading) {
      this.callbacks.onWantedChange?.(this.getWantedHUDState());
    }

    if (this.escapeTimer >= this.escapeDuration) {
      this.clearWanted('escaped');
      return;
    }

    // 4+ Stars: Spawn SWAT Roadblock with Spike Strip ahead of player
    if (this.wantedStars >= 4 && !this.isEvading) {
      this.roadblockSpawnTimer -= dt;
      if (this.roadblockSpawnTimer <= 0 && this.roadblocks.length < 2) {
        this.roadblockSpawnTimer = 11.0;
        const rbX = px + Math.sin(pRot) * 48;
        const rbZ = pz + Math.cos(pRot) * 48;
        if (!this._isWaterAt(rbX, rbZ)) {
          this._spawnSpikeStripRoadblock(rbX, rbZ, pRot);
        }
      }
    }

    // 5 Stars: Update ACPD Police Helicopter at Y = 22m
    if (this.wantedStars >= 5) {
      this.policeHeli.group.visible = true;
      this._updatePoliceHelicopter(dt, px, pz, playerState);
    } else {
      this.policeHeli.group.visible = false;
    }
  }

  _updatePursuitCopAI(cop, dt, playerState) {
    if (this.wantedStars <= 0) {
      cop.isPursuitCop = false;
      return;
    }

    const px = this.playerVehicle ? this.playerVehicle.x : (playerState?.x ?? 80);
    const pz = this.playerVehicle ? this.playerVehicle.z : (playerState?.z ?? -26);
    const pvx = this.playerVehicle ? this.playerVehicle.vx : (playerState?.vx ?? 0);
    const pvz = this.playerVehicle ? this.playerVehicle.vz : (playerState?.vz ?? 0);
    const pRot = this.playerVehicle ? this.playerVehicle.rotationY : (playerState?.rotationY ?? 0);

    // If recently rammed by the player, let knockback momentum carry the cop into walls/trees!
    if (cop.rammedByPlayerTimer > 1.25) {
      const prevX = cop.x;
      const prevZ = cop.z;
      cop.x += cop.vx * dt;
      cop.z += cop.vz * dt;
      if (this._isWaterAt(cop.x, cop.z)) {
        cop.x = prevX;
        cop.z = prevZ;
        this._wreckPoliceVehicle(cop, 'COP TAKEDOWN!');
        return;
      }
      const col = this._resolveWorldCollision(cop.x, cop.z, cop.spec.width * 0.55, false);
      if (col.hit) {
        // Wall or palm tree slam immediately wrecks the rammed cop!
        this._spawnSparkBurst(col.contactX, cop.y + 0.8, col.contactZ, 20);
        this._wreckPoliceVehicle(cop, 'COP SLAM TAKEDOWN!');
      }
      cop.y = this._getGroundY(cop.x, cop.z);
      cop.speed = Math.hypot(cop.vx, cop.vz);
      return;
    }

    // At 2+ Stars, aim for the rear quarter panel of the player's car for a PIT maneuver
    let aimX = px + pvx * 0.35;
    let aimZ = pz + pvz * 0.35;
    if (this.wantedStars >= 2 && this.playerVehicle) {
      const flankSign = cop.aiSteerBias >= 0 ? 1 : -1;
      aimX += -Math.sin(pRot) * 1.9 + Math.cos(pRot) * flankSign * 1.35;
      aimZ += -Math.cos(pRot) * 1.9 - Math.sin(pRot) * flankSign * 1.35;
    }

    const desiredAngle = Math.atan2(aimX - cop.x, aimZ - cop.z);
    const angleDiff = wrapAngle(desiredAngle - cop.rotationY);
    const turnRate = cop.spec.turnSpeed * (0.95 + this.wantedStars * 0.06);
    cop.rotationY = wrapAngle(cop.rotationY + clamp(angleDiff, -turnRate * dt, turnRate * dt));
    cop.steerAngle = clamp(angleDiff, -0.42, 0.42);

    // Balanced pursuit top speed by star level so 1-2 star pursuits are easily outrunnable
    const starSpeedCaps = [0, 18.5, 21.5, 25.0, 28.5, 31.0];
    const baseCap = starSpeedCaps[this.wantedStars] || 18.5;
    const getawayFalloff = this.isEvading ? 0.72 : 1.0;
    const chaseSpeed = Math.min(cop.spec.maxSpeed * 0.85, baseCap) * getawayFalloff;
    const targetVx = Math.sin(cop.rotationY) * chaseSpeed;
    const targetVz = Math.cos(cop.rotationY) * chaseSpeed;

    cop.vx += (targetVx - cop.vx) * Math.min(1, 5.0 * dt);
    cop.vz += (targetVz - cop.vz) * Math.min(1, 5.0 * dt);

    const prevX = cop.x;
    const prevZ = cop.z;
    cop.x += cop.vx * dt;
    cop.z += cop.vz * dt;

    // Prevent pursuit cops from driving into water or onto deep beach surf
    const frontX = cop.x + Math.sin(cop.rotationY) * 2.4;
    const frontZ = cop.z + Math.cos(cop.rotationY) * 2.4;
    if (
      this._isWaterAt(cop.x, cop.z) ||
      this._isWaterAt(frontX, frontZ)
    ) {
      cop.x = prevX;
      cop.z = prevZ;
      const inCore = Math.abs(cop.x) <= 180 && Math.abs(cop.z) <= 180;
      const safeRoadX = inCore ? (cop.x >= 0 ? 76.8 : -32.8) : Math.round(cop.x / 120) * 120;
      const safeRoadZ = inCore ? 0 : Math.round(cop.z / 120) * 120;
      cop.rotationY = Math.atan2(safeRoadX - cop.x, safeRoadZ - cop.z);
      cop.vx *= -0.25;
      cop.vz *= -0.25;
    }

    const col = this._resolveWorldCollision(cop.x, cop.z, cop.spec.width * 0.55, false);
    if (col.hit) {
      cop.x = col.x;
      cop.z = col.z;
      if (cop.rammedByPlayerTimer > 0) {
        this._wreckPoliceVehicle(cop, 'COP TAKEDOWN!');
      } else {
        cop.rotationY = wrapAngle(cop.rotationY + 0.85);
        cop.vx *= -0.3;
        cop.vz *= -0.3;
      }
    }

    cop.y = this._getGroundY(cop.x, cop.z);
    cop.speed = Math.hypot(cop.vx, cop.vz);
  }

  _updateTrafficAI(v, dt, playerState) {
    // Keep traffic car aligned to its lane heading & lane center coordinate
    if (v.laneRotationY !== undefined && v.laneRotationY !== null) {
      v.rotationY = lerpAngle(v.rotationY, v.laneRotationY, Math.min(1, 6.0 * dt));
    }
    if (v.laneAxis === 'z' && v.laneCoord !== null) {
      if (Math.abs(v.laneCoord - v.x) < 0.02) {
        v.x = v.laneCoord;
      } else {
        v.x += (v.laneCoord - v.x) * Math.min(1, 6.0 * dt);
      }
    } else if (v.laneAxis === 'x' && v.laneCoord !== null) {
      if (Math.abs(v.laneCoord - v.z) < 0.02) {
        v.z = v.laneCoord;
      } else {
        v.z += (v.laneCoord - v.z) * Math.min(1, 6.0 * dt);
      }
    }

    const fwdX = Math.sin(v.rotationY);
    const fwdZ = Math.cos(v.rotationY);

    let blockedAhead = false;

    // 1. Yield to the player!
    // - If player (on foot OR in a vehicle) is ahead within 16m in the lane
    // - OR if player is on foot within 6.5m of the traffic car (trying to carjack it!)
    if (playerState) {
      const px = this.playerVehicle ? this.playerVehicle.x : (playerState.x ?? 80);
      const pz = this.playerVehicle ? this.playerVehicle.z : (playerState.z ?? -26);
      const dxP = px - v.x;
      const dzP = pz - v.z;
      const distToPlayer = Math.hypot(dxP, dzP);
      const fwdDistP = dxP * fwdX + dzP * fwdZ;
      const latDistP = Math.abs(dxP * fwdZ - dzP * fwdX);
      const playerOnFoot = !this.playerVehicle && !playerState.inVehicle;

      if (fwdDistP > -1.0 && fwdDistP < 16.0 && latDistP < 4.5) {
        blockedAhead = true;
      } else if (playerOnFoot && distToPlayer < 6.5) {
        blockedAhead = true;
      }
    }

    // 2. Check if another moving vehicle is directly ahead in the SAME lane (13.5m calm lookahead).
    // Ignore curbside parked vehicles unless player-driven so passing parked cars never causes stuttering!
    if (!blockedAhead) {
      for (const other of this.vehicles) {
        if (other === v || other.isExploded) continue;
        if (other.isParked && other !== this.playerVehicle) continue;
        const dx = other.x - v.x;
        const dz = other.z - v.z;
        const fwdDist = dx * fwdX + dz * fwdZ;
        const latDist = Math.abs(dx * fwdZ - dz * fwdX);
        if (fwdDist > 0 && fwdDist < 13.5 && latDist < 2.0) {
          blockedAhead = true;
          break;
        }
      }
    }

    const desiredSpeed = blockedAhead ? 0 : v.targetSpeed;
    const accelRate = blockedAhead ? 10.5 : 4.0;
    v.speed += (desiredSpeed - v.speed) * Math.min(1, accelRate * dt);
    if (blockedAhead && v.speed < 0.25) {
      v.speed = 0;
    }

    // Illuminate brake lights when yielding/stopped
    for (const tl of v.taillightMeshes) {
      tl.material.color.setHex(blockedAhead ? 0xff5252 : 0xd50000);
    }

    const prevX = v.x;
    const prevZ = v.z;
    v.vx = fwdX * v.speed;
    v.vz = fwdZ * v.speed;
    v.x += v.vx * dt;
    v.z += v.vz * dt;

    // Prevent ambient traffic from ever entering water
    if (this._isWaterAt(v.x, v.z)) {
      v.x = prevX;
      v.z = prevZ;
      v.laneRotationY = wrapAngle((v.laneRotationY ?? v.rotationY) + Math.PI);
      v.rotationY = v.laneRotationY;
    }

    // 3. Smoothly U-turn onto the paired opposite lane at road ends (never drive wrong-way!)
    if (v.laneAxis === 'z') {
      const goingSouth = Math.cos(v.laneRotationY) > 0;
      if ((goingSouth && v.z > v.maxRoadCoord) || (!goingSouth && v.z < v.minRoadCoord)) {
        const oldCoord = v.laneCoord;
        v.laneCoord = v.pairCoord ?? oldCoord;
        v.pairCoord = oldCoord;
        v.x = v.laneCoord;
        v.laneRotationY = wrapAngle(v.laneRotationY + Math.PI);
        v.rotationY = v.laneRotationY;
      }
    } else if (v.laneAxis === 'x') {
      const goingEast = Math.sin(v.laneRotationY) > 0;
      if ((goingEast && v.x > v.maxRoadCoord) || (!goingEast && v.x < v.minRoadCoord)) {
        const oldCoord = v.laneCoord;
        v.laneCoord = v.pairCoord ?? oldCoord;
        v.pairCoord = oldCoord;
        v.z = v.laneCoord;
        v.laneRotationY = wrapAngle(v.laneRotationY + Math.PI);
        v.rotationY = v.laneRotationY;
      }
    } else if (
      this._isWaterAt(v.x + fwdX * 7, v.z + fwdZ * 7)
    ) {
      v.rotationY = wrapAngle(v.rotationY + Math.PI);
      v.laneRotationY = v.rotationY;
    }

    v.y = this._getGroundY(v.x, v.z);
  }

  _updateWreckedOrExplodedPhysics(v, dt) {
    if (
      !v.isBoat &&
      !v.isAircraft &&
      (v.isSinking || this._isWaterAt(v.x, v.z))
    ) {
      v.isSinking = true;
      v.sinkTimer = (v.sinkTimer || 0) + dt;
      v.sinkBubbleTimer = (v.sinkBubbleTimer || 0) + dt;
      v.vx *= Math.pow(0.15, dt);
      v.vz *= Math.pow(0.15, dt);
      v.x += v.vx * dt;
      v.z += v.vz * dt;
      const waterY = this._getWaterSurfaceY(v.x, v.z);
      const sinkProgress = clamp(v.sinkTimer / 2.1, 0, 1);
      const easeSink = sinkProgress * (0.45 + 0.55 * sinkProgress);
      v.y = waterY - 0.04 - easeSink * 1.45;
      v.pitchAngle = 0.08 + sinkProgress * 0.38;
      v.rollAngle = Math.sin(v.sinkTimer * 3.5) * 0.04 + sinkProgress * 0.14;
      if (v.sinkTimer < 4.5 && v.sinkBubbleTimer >= 0.22) {
        v.sinkBubbleTimer = 0;
        this._spawnWaterBubbleRing(v.x, waterY + 0.03, v.z);
      }
      v.speed = Math.hypot(v.vx, v.vz);
      return;
    }

    v.vx *= Math.pow(0.08, dt);
    v.vz *= Math.pow(0.08, dt);
    v.x += v.vx * dt;
    v.z += v.vz * dt;

    const groundY = v.isBoat ? this._getWaterSurfaceY(v.x, v.z) : this._getGroundY(v.x, v.z);
    if (v.y > groundY || v.vy !== 0) {
      v.vy -= 26.0 * dt;
      v.y += v.vy * dt;
      v.rotationY = wrapAngle(v.rotationY + v.angularVelY * dt);
      if (v.y <= groundY) {
        v.y = groundY;
        if (Math.abs(v.vy) > 3.0) {
          v.vy = -v.vy * 0.28;
          v.angularVelY *= 0.4;
          this._spawnSparkBurst(v.x, v.y + 0.4, v.z, 8);
        } else {
          v.vy = 0;
          v.angularVelY = 0;
        }
      }
    }
    v.speed = Math.hypot(v.vx, v.vz);
  }

  // ============================================================================
  // VEHICLE-TO-VEHICLE COLLISIONS, RAMMING TAKEDOWNS & NEAR MISS DETECTION
  // ============================================================================

  _handleVehicleInteractions(dt, playerState) {
    const count = this.vehicles.length;
    for (let i = 0; i < count; i++) {
      const a = this.vehicles[i];
      if (a.isExploded) continue;

      for (let j = i + 1; j < count; j++) {
        const b = this.vehicles[j];
        if (b.isExploded) continue;

        // Player-driven or airborne aircraft never get blocked or wedged by street traffic cars on bridges or avenues
        if (
          (a.isAircraft || b.isAircraft) &&
          (a === this.playerVehicle || b === this.playerVehicle || (a.y || 0) > 0.8 || (b.y || 0) > 0.8)
        ) {
          continue;
        }

        // Airborne aircraft or stunt-jumping cars pass cleanly over street traffic
        if (Math.abs((a.y || 0) - (b.y || 0)) > 2.8) continue;

        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 10.0) continue;

        // Oriented elliptical separation: use vehicle width for side-by-side passing (~2.0m)
        // and vehicle length for front-to-back contact (~4.2m) so passing parked cars never pushes traffic sideways!
        const refYaw = a.isParked && !b.isParked ? b.rotationY : a.rotationY;
        const fwdX = Math.sin(refYaw || 0);
        const fwdZ = Math.cos(refYaw || 0);
        const ux = dist > 0.001 ? dx / dist : 0;
        const uz = dist > 0.001 ? dz / dist : 1;
        const lonFactor = Math.abs(ux * fwdX + uz * fwdZ);
        const latSep = (a.spec.width + b.spec.width) * 0.48;
        const lonSep = (a.spec.length + b.spec.length) * 0.46;
        const minSep = latSep + (lonSep - latSep) * (lonFactor * lonFactor);

        const involvesPlayer = a === this.playerVehicle || b === this.playerVehicle;
        const involvesRammedCop =
          (a.isPolice && a.rammedByPlayerTimer > 0) || (b.isPolice && b.rammedByPlayerTimer > 0);

        // Near Miss check when player passes within 3.2m of traffic at high speed without colliding
        if (involvesPlayer && dist >= minSep && dist <= minSep + 3.2) {
          const pv = a === this.playerVehicle ? a : b;
          const other = a === this.playerVehicle ? b : a;
          if (
            pv.speed > 17 &&
            !other.isParked &&
            !other.isWrecked &&
            other.nearMissCooldown <= 0
          ) {
            other.nearMissCooldown = 4.5;
            if (playerState && typeof playerState.cash === 'number') {
              playerState.cash += 100;
            }
            this.callbacks.onCallout?.('NEAR MISS +$100', 'HIGH-SPEED THREAD', '#00e5ff');
            this.callbacks.onPlaySound?.('near_miss');
          }
        }

        // Physical Collision & Grand Theft Argon Cop Ramming
        if (dist < minSep && dist > 0.001) {
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = minSep - dist;

          // If neither vehicle is player-driven or a player-rammed cop:
          // Never push ambient lane-following AI traffic laterally off its laneCoord (which caused a 60Hz tug-of-war shake)!
          if (!involvesPlayer && !involvesRammedCop) {
            if (!a.isPolice && a.laneAxis && !b.isPolice) {
              continue;
            }
            if (!b.isPolice && b.laneAxis && !a.isPolice) {
              continue;
            }
            if (a.isParked && !b.isParked) {
              b.x += nx * overlap;
              b.z += nz * overlap;
            } else if (b.isParked && !a.isParked) {
              a.x -= nx * overlap;
              a.z -= nz * overlap;
            } else if (!a.isParked && !b.isParked) {
              a.x -= nx * overlap * 0.5;
              a.z -= nz * overlap * 0.5;
              b.x += nx * overlap * 0.5;
              b.z += nz * overlap * 0.5;
            }
            continue;
          }

          // Give player vehicle dominant push priority (80% pushed onto the other car) so player never gets wedged!
          const aShare = a === this.playerVehicle ? 0.2 : b === this.playerVehicle ? 0.8 : b.spec.mass / (a.spec.mass + b.spec.mass);
          const bShare = 1.0 - aShare;
          a.x -= nx * overlap * aShare;
          a.z -= nz * overlap * aShare;
          b.x += nx * overlap * bShare;
          b.z += nz * overlap * bShare;

          const rvx = b.vx - a.vx;
          const rvz = b.vz - a.vz;
          const relNormalVel = rvx * nx + rvz * nz;
          const impactSpeed = Math.hypot(rvx, rvz);

          if (relNormalVel < 0) {
            const impulse = -(1.38 * relNormalVel) / (1 / a.spec.mass + 1 / b.spec.mass);
            a.vx -= (impulse / a.spec.mass) * nx * (a === this.playerVehicle ? 0.45 : 1.15);
            a.vz -= (impulse / a.spec.mass) * nz * (a === this.playerVehicle ? 0.45 : 1.15);
            b.vx += (impulse / b.spec.mass) * nx * (b === this.playerVehicle ? 0.45 : 1.15);
            b.vz += (impulse / b.spec.mass) * nz * (b === this.playerVehicle ? 0.45 : 1.15);
            if (involvesPlayer && this.playerVehicle && !this.playerVehicle.isAircraft) {
              const pv = this.playerVehicle;
              pv.forwardSpeed =
                pv.vx * Math.sin(pv.rotationY) + pv.vz * Math.cos(pv.rotationY);
              pv.speed = Math.hypot(pv.vx, pv.vz);
            }
          }

          if (impactSpeed > 5.0) {
            const cx = (a.x + b.x) * 0.5;
            const cz = (a.z + b.z) * 0.5;
            this._spawnSparkBurst(cx, Math.max(a.y, b.y) + 0.7, cz, 12);
            this.callbacks.onSpark?.(cx, Math.max(a.y, b.y) + 0.7, cz, 12);
            this.callbacks.onPlaySound?.('crash');

            // Player ramming a police vehicle: 3.0x damage + strong lateral knockback!
            if (a === this.playerVehicle && b.isPolice && !b.isWrecked) {
              b.vx += nx * Math.max(18, a.speed * 0.85);
              b.vz += nz * Math.max(18, a.speed * 0.85);
              b.rammedByPlayerTimer = 2.0;
              this.damageVehicle(b, impactSpeed * 1.35, 'player_ram');
              this.damageVehicle(a, impactSpeed * 0.15, 'collision');
            } else if (b === this.playerVehicle && a.isPolice && !a.isWrecked) {
              a.vx -= nx * Math.max(18, b.speed * 0.85);
              a.vz -= nz * Math.max(18, b.speed * 0.85);
              a.rammedByPlayerTimer = 2.0;
              this.damageVehicle(a, impactSpeed * 1.35, 'player_ram');
              this.damageVehicle(b, impactSpeed * 0.15, 'collision');
            } else {
              // If a cop rammed by the player slams into traffic, wreck the cop!
              if (a.isPolice && !a.isWrecked && a.rammedByPlayerTimer > 0) {
                this._wreckPoliceVehicle(a, 'COP TRAFFIC TAKEDOWN!');
              }
              if (b.isPolice && !b.isWrecked && b.rammedByPlayerTimer > 0) {
                this._wreckPoliceVehicle(b, 'COP TRAFFIC TAKEDOWN!');
              }
              this.damageVehicle(a, impactSpeed * 0.25, 'collision');
              this.damageVehicle(b, impactSpeed * 0.25, 'collision');
            }
          }
        }
      }
    }
  }

  // ============================================================================
  // PROGRESSIVE DAMAGE STATES (<65% STEAM, <35% BLACK SMOKE, <15% ENGINE FIRE)
  // ============================================================================

  _updateVehicleDamageEffects(v, dt) {
    if (v.isExploded) return;
    const hpPct = (v.health / v.maxHealth) * 100;
    if (hpPct >= 65) return;

    v.particleTimer -= dt;
    const hoodX = v.x + Math.sin(v.rotationY) * (v.spec.length * 0.34);
    const hoodZ = v.z + Math.cos(v.rotationY) * (v.spec.length * 0.34);
    const hoodY = v.y + 0.85;

    if (hpPct < 15) {
      // Active flickering orange/red engine fire on the hood (4.5s fuse)
      v.fireFuseTimer -= dt;
      if (v.particleTimer <= 0) {
        v.particleTimer = 0.06;
        this._spawnSmokePuff(hoodX, hoodY, hoodZ, 'fire');
        this._spawnSmokePuff(hoodX, hoodY + 0.3, hoodZ, 'black');
      }
      if (v.fireFuseTimer <= 0) {
        this.damageVehicle(v, v.health + 10, 'fire_fuse');
      }
    } else if (hpPct < 35) {
      // Dense black billowing smoke rising from the engine bay
      if (v.particleTimer <= 0) {
        v.particleTimer = 0.11;
        this._spawnSmokePuff(hoodX, hoodY, hoodZ, 'black');
      }
    } else if (hpPct < 65) {
      // White radiator steam rising from the front hood
      if (v.particleTimer <= 0) {
        v.particleTimer = 0.18;
        this._spawnSmokePuff(hoodX, hoodY, hoodZ, 'steam');
      }
    }
  }

  // ============================================================================
  // 4-STAR ROADBLOCKS WITH TIRE-POPPING SPIKE STRIPS & 5-STAR POLICE HELICOPTER
  // ============================================================================

  _spawnSpikeStripRoadblock(x, z, roadAngle) {
    const group = new THREE.Group();
    const y = this._getGroundY(x, z);
    group.position.set(x, y, z);
    group.rotation.y = roadAngle;

    // Metallic spike strip belt across the avenue
    const stripGeo = new THREE.BoxGeometry(7.2, 0.12, 0.55);
    const stripMat = new THREE.MeshToonMaterial({
      color: 0x37474f,
      gradientMap: this.celGradient,
    });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.y = 0.06;
    this._addInkOutline(strip);
    group.add(strip);

    // Chrome spikes along strip
    const spikeGeo = new THREE.ConeGeometry(0.08, 0.26, 4);
    for (let sx = -3.2; sx <= 3.2; sx += 0.45) {
      const spike = new THREE.Mesh(spikeGeo, this.chromeMaterial);
      spike.position.set(sx, 0.2, 0);
      group.add(spike);
    }

    // Two flanking police wooden/steel saw-horse barricades
    const barGeo = new THREE.BoxGeometry(2.1, 0.9, 0.35);
    const barMat = new THREE.MeshToonMaterial({
      color: 0xff6d00,
      gradientMap: this.celGradient,
    });
    const leftBar = new THREE.Mesh(barGeo, barMat);
    leftBar.position.set(-4.6, 0.45, 0);
    this._addInkOutline(leftBar);
    const rightBar = new THREE.Mesh(barGeo, barMat);
    rightBar.position.set(4.6, 0.45, 0);
    this._addInkOutline(rightBar);
    group.add(leftBar, rightBar);

    this.fxGroup.add(group);
    this.roadblocks.push({ group, x, y, z, rotationY: roadAngle, ttl: 28 });
  }

  _updateRoadblocks(dt, playerState) {
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      rb.ttl -= dt;
      if (rb.ttl <= 0) {
        this.fxGroup.remove(rb.group);
        this.roadblocks.splice(i, 1);
        continue;
      }

      // Check if player vehicle drives over spike strip
      if (this.playerVehicle && !this.playerVehicle.isBoat && !this.playerVehicle.tiresPopped) {
        const d = Math.hypot(this.playerVehicle.x - rb.x, this.playerVehicle.z - rb.z);
        if (d < 3.8) {
          this.playerVehicle.tiresPopped = true;
          this._spawnSparkBurst(
            this.playerVehicle.x,
            this.playerVehicle.y + 0.3,
            this.playerVehicle.z,
            16
          );
          this.callbacks.onCallout?.('SPIKE STRIP! TIRES POPPED!', '#ff1744');
          this.callbacks.onPlaySound?.('tire_pop');
        }
      }
    }
  }

  _clearRoadblocks() {
    for (const rb of this.roadblocks) {
      this.fxGroup.remove(rb.group);
    }
    this.roadblocks.length = 0;
  }

  _createPoliceHelicopter() {
    const group = new THREE.Group();
    group.name = 'ACPDPoliceHelicopter';
    group.position.set(80, 22, -26);

    const greenMat = new THREE.MeshToonMaterial({
      color: 0x1b7a43,
      gradientMap: this.celGradient,
    });
    const whiteMat = new THREE.MeshToonMaterial({
      color: 0xf4f6f8,
      gradientMap: this.celGradient,
    });

    // Fuselage cabin
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.85, 4.4), greenMat);
    this._addInkOutline(body);
    group.add(body);

    const doorStripe = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.9, 2.2), whiteMat);
    doorStripe.position.set(0, -0.1, 0.2);
    group.add(doorStripe);

    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.25, 1.8), this.glassMaterial);
    cockpit.position.set(0, 0.1, 1.65);
    this._addInkOutline(cockpit);
    group.add(cockpit);

    // Tail boom
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 4.2), greenMat);
    tail.position.set(0, 0.25, -4.0);
    this._addInkOutline(tail);
    group.add(tail);

    // Landing skids
    const skidGeo = new THREE.BoxGeometry(0.18, 0.18, 3.8);
    const leftSkid = new THREE.Mesh(skidGeo, this.darkTrimMaterial);
    leftSkid.position.set(-1.15, -1.25, 0.2);
    const rightSkid = new THREE.Mesh(skidGeo, this.darkTrimMaterial);
    rightSkid.position.set(1.15, -1.25, 0.2);
    group.add(leftSkid, rightSkid);

    // Spinning Main & Tail Rotors
    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 1.15, 0);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.08, 0.38), this.darkTrimMaterial);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 8.8), this.darkTrimMaterial);
    mainRotor.add(blade1, blade2);
    group.add(mainRotor);

    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.65, 0.24), this.darkTrimMaterial);
    tailRotor.position.set(0.42, 0.35, -5.85);
    group.add(tailRotor);

    // Translucent cyan/white searchlight cone sweeping down onto the street (Y = 22m -> ground)
    const coneGeo = new THREE.ConeGeometry(4.6, 22, 20, 1, true);
    coneGeo.translate(0, -11, 0);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xb2ebf2,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const searchlightCone = new THREE.Mesh(coneGeo, coneMat);
    searchlightCone.position.set(0, -0.8, 1.4);
    group.add(searchlightCone);

    // Ground searchlight spotlight disc
    const spotGeo = new THREE.PlaneGeometry(9.2, 9.2);
    const spotMat = new THREE.MeshBasicMaterial({
      color: 0xe0f7fa,
      map: this.glowTexture,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const groundSpot = new THREE.Mesh(spotGeo, spotMat);
    groundSpot.rotation.x = -Math.PI * 0.5;
    groundSpot.position.set(0, -21.85, 3.2);
    group.add(groundSpot);

    return {
      group,
      mainRotor,
      tailRotor,
      searchlightCone,
      groundSpot,
      burstCooldown: 0,
    };
  }

  _updatePoliceHelicopter(dt, targetX, targetZ, playerState) {
    const heli = this.policeHeli;
    const orbitX = targetX + Math.sin(this.time * 0.9) * 8.5;
    const orbitZ = targetZ + Math.cos(this.time * 0.9) * 8.5;

    heli.group.position.x += (orbitX - heli.group.position.x) * Math.min(1, 3.2 * dt);
    heli.group.position.z += (orbitZ - heli.group.position.z) * Math.min(1, 3.2 * dt);
    heli.group.position.y = 22 + Math.sin(this.time * 3.2) * 0.45;

    const lookAngle = Math.atan2(targetX - heli.group.position.x, targetZ - heli.group.position.z);
    heli.group.rotation.y = lerpAngle(heli.group.rotation.y, lookAngle, Math.min(1, 4.0 * dt));

    // Spin rotor blades rapidly
    heli.mainRotor.rotation.y += 28 * dt;
    heli.tailRotor.rotation.x += 34 * dt;

    // Sweep searchlight cone
    heli.searchlightCone.rotation.z = Math.sin(this.time * 2.2) * 0.14;
    heli.searchlightCone.rotation.x = 0.12 + Math.cos(this.time * 1.7) * 0.08;

    // Periodic burst tracer fire from helicopter
    heli.burstCooldown -= dt;
    if (heli.burstCooldown <= 0) {
      heli.burstCooldown = 1.35;
      this._spawnHeliTracer(
        heli.group.position.x,
        heli.group.position.y - 1.0,
        heli.group.position.z,
        targetX + (Math.random() - 0.5) * 4.5,
        0.5,
        targetZ + (Math.random() - 0.5) * 4.5
      );
    }
  }

  // ============================================================================
  // 3D CEL-SHADED VEHICLE & SPEEDBOAT MESH BUILDER (DEEP GRAPHICS REV)
  // ============================================================================

  _addInkOutline(mesh, thresholdAngle = 20) {
    const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
    const line = new THREE.LineSegments(edges, this.inkMaterial);
    mesh.add(line);
  }

  /**
   * Generates a 256x512 procedural top-down hood/roof/engine-deck livery texture
   * (CanvasTexture in browser with DataTexture fallback in headless Node)
   */
  _createVehicleTopTexture(type, colorHex, striped) {
    const cacheKey = `${type}_${colorHex}_${striped ? '1' : '0'}`;
    if (this.topTextureCache.has(cacheKey)) {
      return this.topTextureCache.get(cacheKey);
    }

    const isWedge =
      type === 'cheetah' || type === 'infernus' || type === 'vcpd_cheetah' || type === 'deluxo';

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // 1. Base paint coat
        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 256, 512);

        // ACPD Cruiser white roof & door top section
        if (type === 'vcpd_cruiser') {
          ctx.fillStyle = '#f4f6f8';
          ctx.fillRect(14, 168, 228, 186);
        } else if (type === 'mr_whoopee') {
          ctx.fillStyle = '#fffdf7';
          ctx.fillRect(18, 162, 220, 326);
        }

        // 2. Subtle center highlight sheen
        const grad = ctx.createLinearGradient(0, 0, 256, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0.18)');
        grad.addColorStop(0.22, 'rgba(255,255,255,0.08)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.16)');
        grad.addColorStop(0.78, 'rgba(255,255,255,0.08)');
        grad.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 512);

        // 3. Cuban Hermes classic hot-rod flame scallops on hood & fenders
        if (type === 'cuban_hermes') {
          ctx.fillStyle = '#ffab00';
          ctx.strokeStyle = '#ff1744';
          ctx.lineWidth = 4;
          const flamePts = [
            [26, 20, 48, 155, 74, 65],
            [74, 65, 98, 175, 128, 55],
            [128, 55, 158, 175, 182, 65],
            [182, 65, 208, 155, 230, 20],
          ];
          ctx.beginPath();
          ctx.moveTo(26, 18);
          for (const fp of flamePts) {
            ctx.quadraticCurveTo(fp[0], fp[1], fp[2], fp[3]);
            ctx.lineTo(fp[4], fp[5]);
          }
          ctx.lineTo(230, 18);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // 4. Twin White Racing Stripes with crisp black ink keylines
        if (striped) {
          for (const sx of [78, 146]) {
            ctx.fillStyle = '#090a10';
            ctx.fillRect(sx - 3, 8, 38, 496);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx, 8, 32, 496);
          }
        }

        // Deluxo gullwing roof T-panel & neon cyan flux lines
        if (type === 'deluxo') {
          ctx.strokeStyle = '#090a10';
          ctx.lineWidth = 4;
          ctx.strokeRect(46, 188, 76, 142);
          ctx.strokeRect(134, 188, 76, 142);
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(28, 14, 200, 8);
          ctx.fillRect(28, 488, 200, 8);
        }

        // 5. Kaufman Cab iconic black-and-white checkered racing borders
        if (type === 'kaufman_cab') {
          const sq = 16;
          for (let y = 24; y < 488; y += sq) {
            const odd = Math.floor(y / sq) % 2 === 0;
            // Left checker strip
            ctx.fillStyle = odd ? '#090a10' : '#ffffff';
            ctx.fillRect(14, y, sq, sq);
            ctx.fillStyle = odd ? '#ffffff' : '#090a10';
            ctx.fillRect(14 + sq, y, sq, sq);
            // Right checker strip
            ctx.fillStyle = odd ? '#090a10' : '#ffffff';
            ctx.fillRect(256 - 14 - sq * 2, y, sq, sq);
            ctx.fillStyle = odd ? '#ffffff' : '#090a10';
            ctx.fillRect(256 - 14 - sq, y, sq, sq);
          }
        }

        // 6. Comic-book black ink panel gap lines (hood, doors, sunroof, trunk)
        ctx.strokeStyle = '#090a10';
        ctx.lineWidth = 4;
        ctx.strokeRect(22, 22, 212, 132); // Front hood panel seam
        ctx.strokeRect(26, 178, 204, 166); // Roof panel seam
        ctx.strokeRect(22, 362, 212, 126); // Rear decklid / trunk seam

        // Front hood NACA vents / power bulge lines
        ctx.fillStyle = '#12151e';
        ctx.fillRect(54, 52, 26, 48);
        ctx.fillRect(176, 52, 26, 48);
        ctx.strokeStyle = '#090a10';
        ctx.lineWidth = 3;
        ctx.strokeRect(54, 52, 26, 48);
        ctx.strokeRect(176, 52, 26, 48);

        // 7. Exotic Supercar Rear Mid-Engine Louvers & V12 Intake Plenum
        if (isWedge) {
          ctx.fillStyle = '#10131a';
          ctx.fillRect(44, 374, 168, 98);
          // Silver V12 manifold visible under central glass/meshbay
          ctx.fillStyle = '#cfd8dc';
          ctx.fillRect(96, 384, 64, 76);
          ctx.fillStyle = '#37474f';
          ctx.fillRect(114, 388, 28, 68);
          // 6 horizontal black engine bay louver slats
          ctx.fillStyle = '#08090e';
          for (let ly = 378; ly <= 460; ly += 14) {
            ctx.fillRect(46, ly, 164, 7);
          }
        } else {
          // Tinted sunroof inset for sedans/cruisers
          ctx.fillStyle = '#101824';
          ctx.fillRect(52, 198, 152, 62);
          ctx.strokeStyle = '#090a10';
          ctx.lineWidth = 3;
          ctx.strokeRect(52, 198, 152, 62);
        }

        // 8. ACPD Police Roof Identification Markings ("ACPD 86") & Gold Hood Shield
        if (type === 'vcpd_cruiser' || type === 'vcpd_cheetah' || type === 'swat_enforcer') {
          // Gold 6-point star badge on front hood
          ctx.fillStyle = '#ffd600';
          ctx.strokeStyle = '#090a10';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(128, 112, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Bold roof aerial markings
          ctx.fillStyle = type === 'vcpd_cruiser' ? '#102542' : '#ffffff';
          ctx.font = 'bold 34px Impact, Arial Black, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('ACPD', 128, 256);
          ctx.font = 'bold 42px Impact, Arial Black, sans-serif';
          ctx.fillText('86', 128, 308);
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        this.topTextureCache.set(cacheKey, tex);
        return tex;
      }
    }

    // Headless Node fallback DataTexture (64x128) with stripes, panel gaps & louvers
    const w = 64;
    const h = 128;
    const data = new Uint8Array(w * h * 4);
    const baseCol = new THREE.Color(colorHex);
    const br = Math.round(baseCol.r * 255);
    const bg = Math.round(baseCol.g * 255);
    const bb = Math.round(baseCol.b * 255);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        let r = br;
        let g = bg;
        let b = bb;

        const isPanelGap =
          x === 5 || x === w - 6 || y === 6 || y === 38 || y === 88 || y === h - 6;
        const isStripe = striped && ((x >= 19 && x <= 26) || (x >= 37 && x <= 44));
        const isLouver = isWedge && y >= 94 && y <= 116 && x >= 12 && x <= 51 && y % 4 < 2;

        if (isPanelGap || isLouver) {
          r = 10;
          g = 12;
          b = 18;
        } else if (isStripe) {
          r = 250;
          g = 252;
          b = 255;
        } else if (type === 'vcpd_cruiser' && y >= 42 && y <= 86) {
          r = 244;
          g = 246;
          b = 248;
        }

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    const fallbackTex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    fallbackTex.minFilter = THREE.LinearFilter;
    fallbackTex.magFilter = THREE.LinearFilter;
    fallbackTex.needsUpdate = true;
    this.topTextureCache.set(cacheKey, fallbackTex);
    return fallbackTex;
  }

  _buildVehicleMesh(type, spec, colorHex, striped) {
    const root = new THREE.Group();
    root.name = `Vehicle_${type}`;

    // Soft elliptical dark ground contact shadow underneath every vehicle
    const shadowGeo = new THREE.PlaneGeometry(spec.width * 1.38, spec.length * 1.26);
    const shadowMesh = new THREE.Mesh(shadowGeo, this.shadowMaterial);
    shadowMesh.rotation.x = -Math.PI * 0.5;
    shadowMesh.position.set(0, 0.03, 0);
    root.add(shadowMesh);

    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    const bodyMaterials = [];
    const makePaintMat = (hex) => {
      const m = new THREE.MeshToonMaterial({
        color: new THREE.Color(hex),
        gradientMap: this.celGradient,
      });
      bodyMaterials.push(m);
      return m;
    };

    const mainPaint = makePaintMat(colorHex);
    const wheels = [];
    const outboards = [];
    const headlightCones = [];
    const taillightMeshes = [];
    let hoodMesh = null;
    let sirenParts = null;
    let propellerMesh = null;
    let mainRotorMesh = null;
    let tailRotorMesh = null;

    if (type === 'skimmer_plane') {
      // Dodo Skimmer Seaplane: white cel-shaded fuselage with flamingo-pink & turquoise stripes,
      // 7.4m high overhead monoplane wing with diagonal struts, spinning 3-blade nose propeller,
      // and twin amphibious pontoons/floats underneath with small landing gear wheels!
      const whiteMat = makePaintMat('#ffffff');
      const pinkMat = makePaintMat('#ff2a85');
      const cyanMat = makePaintMat('#00e5ff');

      // 1. Twin Amphibious Pontoons / Floats + Retractable-style Landing Wheels
      for (const px of [-1.06, 1.06]) {
        const pontoon = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 4.35), whiteMat);
        pontoon.position.set(px, 0.28, 0.15);
        this._addInkOutline(pontoon);
        bodyGroup.add(pontoon);

        const pontoonStripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 4.15), cyanMat);
        pontoonStripe.position.set(px, 0.36, 0.15);
        bodyGroup.add(pontoonStripe);

        const floatBow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.72), pinkMat);
        floatBow.position.set(px, 0.28, 2.52);
        floatBow.rotation.x = -0.25;
        this._addInkOutline(floatBow);
        bodyGroup.add(floatBow);

        // Pontoon struts connecting floats to fuselage belly
        for (const sz of [0.95, -0.95]) {
          const strut = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.68, 0.14),
            this.darkTrimMaterial
          );
          strut.position.set(px * 0.72, 0.68, sz);
          strut.rotation.z = px < 0 ? -0.42 : 0.42;
          bodyGroup.add(strut);
        }

        // Small amphibious wheels tucked under each pontoon for runway/street taxiing
        for (const wz of [1.25, -1.05]) {
          const wMesh = this._createWheelMesh(0.22, 0.16);
          wMesh.position.set(px, 0.22, wz);
          bodyGroup.add(wMesh);
          wheels.push({ mesh: wMesh, isFront: wz > 0 });
        }
      }

      // 2. Main Streamlined Fuselage & Cabin
      const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.32, 1.08, 3.65), whiteMat);
      fuselage.position.set(0, 1.12, 0.25);
      this._addInkOutline(fuselage);
      bodyGroup.add(fuselage);

      const pinkCheatline = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.22, 3.55), pinkMat);
      pinkCheatline.position.set(0, 1.08, 0.25);
      bodyGroup.add(pinkCheatline);

      const cyanCheatline = new THREE.Mesh(new THREE.BoxGeometry(1.37, 0.12, 3.55), cyanMat);
      cyanCheatline.position.set(0, 0.92, 0.25);
      bodyGroup.add(cyanCheatline);

      // Nose engine cowling
      const cowling = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.88, 1.05), whiteMat);
      cowling.position.set(0, 1.06, 2.38);
      this._addInkOutline(cowling);
      bodyGroup.add(cowling);
      hoodMesh = cowling;

      // Tinted cockpit windshield & side cabin windows
      const cockpitGlass = new THREE.Mesh(
        new THREE.BoxGeometry(1.22, 0.56, 1.15),
        this.cabinGlassMaterial
      );
      cockpitGlass.position.set(0, 1.48, 1.15);
      cockpitGlass.rotation.x = -0.36;
      this._addInkOutline(cockpitGlass);
      bodyGroup.add(cockpitGlass);

      const sideWindows = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.44, 1.65),
        this.cabinGlassMaterial
      );
      sideWindows.position.set(0, 1.38, 0.1);
      bodyGroup.add(sideWindows);

      // Tapered rear tail cone, vertical stabilizer fin & horizontal elevator
      const tailCone = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.72, 1.95), whiteMat);
      tailCone.position.set(0, 1.14, -2.15);
      this._addInkOutline(tailCone);
      bodyGroup.add(tailCone);

      const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.28, 1.12), whiteMat);
      tailFin.position.set(0, 1.82, -2.65);
      tailFin.rotation.x = 0.18;
      this._addInkOutline(tailFin);
      bodyGroup.add(tailFin);

      const tailFinStripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.92), pinkMat);
      tailFinStripe.position.set(0, 2.02, -2.68);
      tailFinStripe.rotation.x = 0.18;
      bodyGroup.add(tailFinStripe);

      const elevator = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.12, 0.76), cyanMat);
      elevator.position.set(0, 1.26, -2.65);
      this._addInkOutline(elevator);
      bodyGroup.add(elevator);

      // 3. High Overhead Monoplane Wing (span = 7.4m) with twin diagonal wing struts & wingtip strobes
      const mainWing = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.14, 1.38), whiteMat);
      mainWing.position.set(0, 1.82, 0.32);
      this._addInkOutline(mainWing);
      bodyGroup.add(mainWing);

      for (const wx of [-2.85, 2.85]) {
        const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 1.39), pinkMat);
        wingStripe.position.set(wx, 1.82, 0.32);
        bodyGroup.add(wingStripe);
      }

      // Twin diagonal wing struts
      for (const sx of [-1.45, 1.45]) {
        const wingStrut = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 1.45, 0.14),
          this.chromeMaterial
        );
        wingStrut.position.set(sx, 1.32, 0.35);
        wingStrut.rotation.z = sx < 0 ? 0.78 : -0.78;
        this._addInkOutline(wingStrut);
        bodyGroup.add(wingStrut);
      }

      // Red (Port) & Green (Starboard) wingtip navigation strobes
      const redNav = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.28),
        new THREE.MeshBasicMaterial({ color: 0xff1744 })
      );
      redNav.position.set(-3.68, 1.85, 0.35);
      const greenNav = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.28),
        new THREE.MeshBasicMaterial({ color: 0x00e676 })
      );
      greenNav.position.set(3.68, 1.85, 0.35);
      bodyGroup.add(redNav, greenNav);

      // 4. Spinning 3-Blade Nose Propeller
      propellerMesh = new THREE.Group();
      propellerMesh.position.set(0, 1.06, 2.96);
      const spinnerGeo = new THREE.ConeGeometry(0.24, 0.42, 10);
      spinnerGeo.rotateX(Math.PI * 0.5);
      const spinner = new THREE.Mesh(spinnerGeo, this.chromeMaterial);
      this._addInkOutline(spinner);
      propellerMesh.add(spinner);

      for (let b = 0; b < 3; b++) {
        const bladeGroup = new THREE.Group();
        bladeGroup.rotation.z = (b * Math.PI * 2) / 3;
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.92, 0.05),
          this.darkTrimMaterial
        );
        blade.position.y = 0.52;
        const tip = new THREE.Mesh(
          new THREE.BoxGeometry(0.17, 0.16, 0.06),
          new THREE.MeshBasicMaterial({ color: 0xffd600 })
        );
        tip.position.y = 0.9;
        bladeGroup.add(blade, tip);
        propellerMesh.add(bladeGroup);
      }
      bodyGroup.add(propellerMesh);
    } else if (type === 'maverick_heli') {
      // Argon Maverick Chopper: streamlined executive 1980s Miami helicopter cabin,
      // wrap-around tinted cockpit glass, twin landing skids, tail boom with spinning tail rotor,
      // and large 4-blade overhead main rotor!
      const whiteMat = makePaintMat(colorHex || '#ffffff');
      const cyanMat = makePaintMat('#00e5ff');
      const pinkMat = makePaintMat('#ff2a85');

      // 1. Twin Tubular Landing Skids & Struts
      for (const sx of [-1.05, 1.05]) {
        const skid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 3.65), this.darkTrimMaterial);
        skid.position.set(sx, 0.12, 0.35);
        this._addInkOutline(skid);
        bodyGroup.add(skid);

        for (const sz of [1.1, -0.55]) {
          const strut = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.72, 0.12),
            this.darkTrimMaterial
          );
          strut.position.set(sx * 0.82, 0.42, sz);
          strut.rotation.z = sx < 0 ? -0.32 : 0.32;
          bodyGroup.add(strut);
        }
      }

      // 2. Streamlined Executive Helicopter Cabin & Nose
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.98, 1.32, 3.15), whiteMat);
      cabin.position.set(0, 1.06, 0.35);
      this._addInkOutline(cabin);
      bodyGroup.add(cabin);

      const cyanStripe = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.22, 3.08), cyanMat);
      cyanStripe.position.set(0, 0.96, 0.35);
      bodyGroup.add(cyanStripe);

      const pinkStripe = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.12, 3.08), pinkMat);
      pinkStripe.position.set(0, 0.78, 0.35);
      bodyGroup.add(pinkStripe);

      const nose = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.78, 1.05), whiteMat);
      nose.position.set(0, 0.84, 2.18);
      nose.rotation.x = 0.18;
      this._addInkOutline(nose);
      bodyGroup.add(nose);
      hoodMesh = nose;

      // Wrap-around tinted cockpit glass greenhouse
      const cockpit = new THREE.Mesh(
        new THREE.BoxGeometry(1.84, 0.88, 1.48),
        this.cabinGlassMaterial
      );
      cockpit.position.set(0, 1.24, 1.48);
      cockpit.rotation.x = -0.28;
      this._addInkOutline(cockpit);
      bodyGroup.add(cockpit);

      const sideWindows = new THREE.Mesh(
        new THREE.BoxGeometry(2.02, 0.56, 1.55),
        this.cabinGlassMaterial
      );
      sideWindows.position.set(0, 1.26, 0.15);
      bodyGroup.add(sideWindows);

      // Top turbine cowling
      const turbine = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.44, 1.85), cyanMat);
      turbine.position.set(0, 1.86, 0.05);
      this._addInkOutline(turbine);
      bodyGroup.add(turbine);

      // 3. Tail Boom & Vertical Stabilizer Fin
      const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.58, 3.15), whiteMat);
      tailBoom.position.set(0, 1.22, -2.35);
      this._addInkOutline(tailBoom);
      bodyGroup.add(tailBoom);

      const boomStripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 3.05), pinkMat);
      boomStripe.position.set(0, 1.22, -2.35);
      bodyGroup.add(boomStripe);

      const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.18, 0.86), cyanMat);
      tailFin.position.set(0, 1.58, -3.65);
      tailFin.rotation.x = 0.22;
      this._addInkOutline(tailFin);
      bodyGroup.add(tailFin);

      // 4. Large 4-Blade Overhead Main Rotor & Spinning Tail Rotor
      mainRotorMesh = new THREE.Group();
      mainRotorMesh.position.set(0, 2.22, 0.1);
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.26, 10),
        this.chromeMaterial
      );
      mainRotorMesh.add(hub);
      const mainBlade1 = new THREE.Mesh(
        new THREE.BoxGeometry(8.4, 0.07, 0.34),
        this.darkTrimMaterial
      );
      const mainBlade2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.07, 8.4),
        this.darkTrimMaterial
      );
      this._addInkOutline(mainBlade1);
      this._addInkOutline(mainBlade2);
      mainRotorMesh.add(mainBlade1, mainBlade2);
      bodyGroup.add(mainRotorMesh);

      tailRotorMesh = new THREE.Group();
      tailRotorMesh.position.set(0.36, 1.62, -3.72);
      const tr1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.48, 0.18), this.darkTrimMaterial);
      const tr2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 1.48), this.darkTrimMaterial);
      tailRotorMesh.add(tr1, tr2);
      bodyGroup.add(tailRotorMesh);
    } else if (type === 'cigarette_boat') {
      // Sleek 1980s Argon Nights twin-outboard Cigarette 38 racing speedboat
      const hullMat = makePaintMat('#ffffff');
      const turquoiseMat = makePaintMat('#00e5ff');
      const pinkMat = makePaintMat('#ff2a85');

      // Deep-V lower hull & upper gunwale deck
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.78, 5.4), hullMat);
      hull.position.set(0, 0.35, -0.4);
      this._addInkOutline(hull);
      bodyGroup.add(hull);

      const bowGeo = new THREE.ConeGeometry(1.68, 2.9, 4);
      bowGeo.rotateY(Math.PI * 0.25);
      bowGeo.rotateX(Math.PI * 0.5);
      const bow = new THREE.Mesh(bowGeo, hullMat);
      bow.scale.set(1.0, 0.46, 1.0);
      bow.position.set(0, 0.38, 3.65);
      this._addInkOutline(bow);
      bodyGroup.add(bow);

      // Argon Nights Turquoise & Flamingo Pink racing stripes along hull sides & foredeck
      const deckStripe = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.09, 5.6), turquoiseMat);
      deckStripe.position.set(0, 0.76, 0.25);
      this._addInkOutline(deckStripe);
      bodyGroup.add(deckStripe);

      const pinkStripe = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.22, 4.85), pinkMat);
      pinkStripe.position.set(0, 0.48, -0.3);
      bodyGroup.add(pinkStripe);

      // Wrap-around dark comic cabin glass windshield & bolster seats
      const windshield = new THREE.Mesh(
        new THREE.BoxGeometry(1.98, 0.48, 1.15),
        this.cabinGlassMaterial
      );
      windshield.position.set(0, 0.92, 0.55);
      windshield.rotation.x = -0.3;
      this._addInkOutline(windshield);
      bodyGroup.add(windshield);

      const seatMat = makePaintMat('#f8bbd0');
      const seatL = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.55, 0.65), seatMat);
      seatL.position.set(-0.5, 0.82, -0.45);
      this._addInkOutline(seatL);
      const seatR = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.55, 0.65), seatMat);
      seatR.position.set(0.5, 0.82, -0.45);
      this._addInkOutline(seatR);
      bodyGroup.add(seatL, seatR);

      // Twin rear outboard motors with chrome prop housings
      for (const ox of [-0.62, 0.62]) {
        const motor = new THREE.Mesh(
          new THREE.BoxGeometry(0.44, 0.98, 0.64),
          this.darkTrimMaterial
        );
        motor.position.set(ox, 0.48, -3.35);
        this._addInkOutline(motor);
        bodyGroup.add(motor);
        outboards.push(motor);
      }

      hoodMesh = deckStripe;
    } else if (type === 'pcj600') {
      // 1980s sport motorcycle / superbike with sculpted tank, twin exhausts & clip-on bars
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 1.75), mainPaint);
      frame.position.set(0, 0.65, 0);
      this._addInkOutline(frame);
      bodyGroup.add(frame);

      const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.54, 0.76), mainPaint);
      fairing.position.set(0, 0.88, 0.62);
      fairing.rotation.x = 0.26;
      this._addInkOutline(fairing);
      bodyGroup.add(fairing);
      hoodMesh = fairing;

      const windscreen = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.34, 0.44),
        this.cabinGlassMaterial
      );
      windscreen.position.set(0, 1.14, 0.58);
      windscreen.rotation.x = -0.45;
      this._addInkOutline(windscreen);
      bodyGroup.add(windscreen);

      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 0.82), this.darkTrimMaterial);
      seat.position.set(0, 0.96, -0.28);
      this._addInkOutline(seat);
      bodyGroup.add(seat);

      // Twin chrome upswept exhaust pipes
      for (const ex of [-0.26, 0.26]) {
        const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.95), this.chromeMaterial);
        pipe.position.set(ex, 0.52, -0.58);
        pipe.rotation.x = 0.18;
        bodyGroup.add(pipe);
      }

      // 2 rotating motorcycle wheels
      for (const wz of [0.82, -0.82]) {
        const wGroup = this._createWheelMesh(0.38, 0.22);
        wGroup.position.set(0, 0.38, wz);
        bodyGroup.add(wGroup);
        wheels.push({ mesh: wGroup, isFront: wz > 0 });
      }
    } else {
      // 4-Wheel 1980s Cars, Wedge Supercars, Gullwing Deluxo, Sabre Turbo V8, Ice Cream Vans & Police Cruisers
      const w = spec.width;
      const l = spec.length;
      const h = spec.height;
      const isWedge =
        type === 'cheetah' || type === 'infernus' || type === 'vcpd_cheetah' || type === 'deluxo';
      const isVan = type === 'swat_enforcer' || type === 'mr_whoopee';

      const topTex = this._createVehicleTopTexture(type, colorHex, striped);
      const topLiveryMat = new THREE.MeshToonMaterial({
        color: 0xffffff,
        map: topTex,
        gradientMap: this.celGradient,
      });
      bodyMaterials.push(topLiveryMat);

      // 1. Dark lower rocker sill / ground skirt
      const skirt = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.96, 0.16, l * 0.94),
        this.darkTrimMaterial
      );
      skirt.position.set(0, 0.28, 0);
      bodyGroup.add(skirt);

      // 2. Main sculpted lower chassis body
      const chassisH = isVan ? h * 0.62 : isWedge ? 0.52 : 0.62;
      const chassisY = 0.34 + chassisH * 0.5;
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, chassisH, l), mainPaint);
      chassis.position.set(0, chassisY, 0);
      this._addInkOutline(chassis);
      bodyGroup.add(chassis);

      // 3. Flared 1980s widebody wheel-arch fenders & side air intakes
      const fenderW = w + 0.12;
      const fenderH = chassisH * 0.68;
      const frontFender = new THREE.Mesh(
        new THREE.BoxGeometry(fenderW, fenderH, l * 0.28),
        mainPaint
      );
      frontFender.position.set(0, chassisY - 0.04, l * 0.3);
      this._addInkOutline(frontFender);

      const rearFender = new THREE.Mesh(
        new THREE.BoxGeometry(fenderW, fenderH, l * 0.3),
        mainPaint
      );
      rearFender.position.set(0, chassisY - 0.02, -l * 0.3);
      this._addInkOutline(rearFender);
      bodyGroup.add(frontFender, rearFender);

      // Testarossa / Countach side strake air intakes on exotic supercars
      if (isWedge) {
        const intakeSlot = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.06, chassisH * 0.42, l * 0.32),
          this.darkTrimMaterial
        );
        intakeSlot.position.set(0, chassisY - 0.02, -l * 0.05);
        bodyGroup.add(intakeSlot);
      }

      // 4. Pivoted front hood mesh (with procedural top livery decal & collision deformation)
      const hoodLen = l * 0.33;
      const hoodGeo = new THREE.BoxGeometry(w * 0.92, 0.11, hoodLen);
      hoodGeo.translate(0, 0, hoodLen * 0.5);
      hoodMesh = new THREE.Mesh(hoodGeo, topLiveryMat);
      hoodMesh.position.set(0, 0.34 + chassisH, l * 0.14);
      if (isWedge) hoodMesh.rotation.x = 0.09;
      this._addInkOutline(hoodMesh);
      bodyGroup.add(hoodMesh);

      // Full-length upper deck livery panel (hood + rear engine bay/trunk)
      const deckTop = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.94, l * 0.96),
        topLiveryMat
      );
      deckTop.rotation.x = -Math.PI * 0.5;
      deckTop.position.set(0, 0.34 + chassisH + 0.065, 0);
      bodyGroup.add(deckTop);

      // 5. Cabin / Greenhouse with angled windshields & comic cyan-white reflection slash
      const cabinLen = isVan ? l * 0.78 : isWedge ? l * 0.44 : l * 0.48;
      const cabinH = isVan ? h * 0.45 : isWedge ? 0.46 : 0.54;
      const cabinZ = isVan ? -l * 0.06 : -l * 0.06;
      const cabinY = 0.34 + chassisH + cabinH * 0.5;
      const cabinMat =
        type === 'vcpd_cruiser'
          ? makePaintMat('#f4f6f8')
          : type === 'mr_whoopee'
            ? makePaintMat('#fffdf7')
            : mainPaint;

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, cabinH, cabinLen), cabinMat);
      cabin.position.set(0, cabinY, cabinZ);
      this._addInkOutline(cabin);
      bodyGroup.add(cabin);

      // Roof top decal plane (shows ACPD 86, racing stripes, or sunroof)
      const roofTop = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.82, cabinLen * 0.92),
        topLiveryMat
      );
      roofTop.rotation.x = -Math.PI * 0.5;
      roofTop.position.set(0, 0.34 + chassisH + cabinH + 0.015, cabinZ);
      bodyGroup.add(roofTop);

      // High-contrast side window band
      const glassBand = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.87, cabinH * 0.74, cabinLen * 0.84),
        this.cabinGlassMaterial
      );
      glassBand.position.set(0, cabinY, cabinZ);
      bodyGroup.add(glassBand);

      // Sloped Front Windshield & Rear Window with comic diagonal reflection slash
      const frontWindshield = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.8, cabinH * 0.86, 0.12),
        this.cabinGlassMaterial
      );
      frontWindshield.position.set(0, cabinY - 0.02, cabinZ + cabinLen * 0.5 + 0.04);
      frontWindshield.rotation.x = isWedge ? -0.58 : -0.42;
      this._addInkOutline(frontWindshield);
      bodyGroup.add(frontWindshield);

      const rearWindow = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.78, cabinH * 0.82, 0.12),
        this.cabinGlassMaterial
      );
      rearWindow.position.set(0, cabinY - 0.02, cabinZ - cabinLen * 0.5 - 0.04);
      rearWindow.rotation.x = isWedge ? 0.52 : 0.38;
      this._addInkOutline(rearWindow);
      bodyGroup.add(rearWindow);

      // Left & Right Side Wing Mirrors
      for (const mx of [-w * 0.49, w * 0.49]) {
        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.14), mainPaint);
        mirror.position.set(mx, cabinY - 0.06, cabinZ + cabinLen * 0.38);
        this._addInkOutline(mirror);
        bodyGroup.add(mirror);
      }

      // 6. Twin White Racing Stripes on front/rear bumpers & roof
      if (striped) {
        const stripeMat = makePaintMat('#ffffff');
        for (const sx of [-0.26, 0.26]) {
          const bodyStripe = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, chassisH + 0.03, l + 0.03),
            stripeMat
          );
          bodyStripe.position.set(sx, chassisY + 0.01, 0);
          bodyGroup.add(bodyStripe);
        }
      }

      // 7. Exotic supercar rear spoiler wing & twin struts
      if (isWedge && type !== 'deluxo') {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.1, 0.44), mainPaint);
        wing.position.set(0, 0.38 + chassisH + 0.3, -l * 0.44);
        this._addInkOutline(wing);
        const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.28), this.darkTrimMaterial);
        strutL.position.set(-w * 0.38, 0.38 + chassisH + 0.15, -l * 0.44);
        const strutR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.28), this.darkTrimMaterial);
        strutR.position.set(w * 0.38, 0.38 + chassisH + 0.15, -l * 0.44);
        bodyGroup.add(wing, strutL, strutR);
      }

      // 7b. Deluxo '86 Gullwing: Rear black louvers & glowing neon-cyan time-circuit bumper vents
      if (type === 'deluxo') {
        const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
        for (let sl = 0; sl < 5; sl++) {
          const louver = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.78, 0.05, 0.22),
            this.darkTrimMaterial
          );
          louver.position.set(
            0,
            0.38 + chassisH + 0.38 - sl * 0.075,
            cabinZ - cabinLen * 0.46 - sl * 0.18
          );
          louver.rotation.x = 0.25;
          this._addInkOutline(louver);
          bodyGroup.add(louver);
        }
        // Glowing neon-cyan time-circuit vents on front/rear bumpers & side flux bands
        for (const bz of [l * 0.5 + 0.11, -l * 0.5 - 0.11]) {
          const vent = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.12, 0.06), neonCyanMat);
          vent.position.set(0, 0.38, bz);
          this._addInkOutline(vent);
          bodyGroup.add(vent);
        }
        const sideFlux = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.08, 0.07, l * 0.92),
          neonCyanMat
        );
        sideFlux.position.set(0, chassisY + 0.06, 0);
        bodyGroup.add(sideFlux);
      }

      // 7c. Sabre Turbo V8: Chrome supercharger blower scoop protruding through the hood!
      if (type === 'sabre_turbo') {
        const blowerGroup = new THREE.Group();
        blowerGroup.position.set(0, 0.34 + chassisH + 0.14, l * 0.22);
        const blowerBase = new THREE.Mesh(
          new THREE.BoxGeometry(0.54, 0.24, 0.62),
          this.chromeMaterial
        );
        this._addInkOutline(blowerBase);
        const scoopTop = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.2, 0.52),
          this.chromeMaterial
        );
        scoopTop.position.set(0, 0.18, 0.04);
        this._addInkOutline(scoopTop);
        const intakeFlap = new THREE.Mesh(
          new THREE.BoxGeometry(0.48, 0.14, 0.06),
          new THREE.MeshBasicMaterial({ color: 0xff1744 })
        );
        intakeFlap.position.set(0, 0.18, 0.31);
        blowerGroup.add(blowerBase, scoopTop, intakeFlap);
        bodyGroup.add(blowerGroup);
      }

      // 7d. Mr. Whoopee ("Cherry Popper Ice Cream Van"): giant 3D pink/white swirled ice cream cone on roof!
      if (type === 'mr_whoopee') {
        const creamMat = makePaintMat('#fff8e1');
        const cherryPinkMat = makePaintMat('#ff4081');
        const waffleMat = makePaintMat('#e6b068');

        // Side ice cream serving window panel & awning
        const servicePanel = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.06, cabinH * 0.68, cabinLen * 0.56),
          creamMat
        );
        servicePanel.position.set(0, cabinY - 0.04, cabinZ - 0.25);
        this._addInkOutline(servicePanel);
        const awning = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.22, 0.12, cabinLen * 0.58),
          cherryPinkMat
        );
        awning.position.set(0, cabinY + cabinH * 0.36, cabinZ - 0.25);
        this._addInkOutline(awning);
        bodyGroup.add(servicePanel, awning);

        // Giant 3D rooftop ice cream cone sculpture
        const coneGroup = new THREE.Group();
        const roofY = 0.34 + chassisH + cabinH;
        coneGroup.position.set(0, roofY + 0.52, cabinZ + 0.15);
        coneGroup.rotation.x = 0.26;

        const waffleGeo = new THREE.ConeGeometry(0.46, 0.96, 12);
        waffleGeo.rotateX(Math.PI);
        const waffleCone = new THREE.Mesh(waffleGeo, waffleMat);
        waffleCone.position.y = -0.18;
        this._addInkOutline(waffleCone, 28);
        coneGroup.add(waffleCone);

        const scoop1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 1), mainPaint);
        scoop1.position.y = 0.32;
        this._addInkOutline(scoop1, 28);
        const scoop2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 1), creamMat);
        scoop2.position.y = 0.68;
        this._addInkOutline(scoop2, 28);
        const scoop3 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.44, 10), cherryPinkMat);
        scoop3.position.y = 1.02;
        this._addInkOutline(scoop3, 28);
        const cherry = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.15, 1),
          new THREE.MeshBasicMaterial({ color: 0xff1744 })
        );
        cherry.position.set(0, 1.28, 0.05);
        coneGroup.add(scoop1, scoop2, scoop3, cherry);
        bodyGroup.add(coneGroup);
      }

      // 8. ACPD Cruiser white doors & gold side shield stripe
      if (type === 'vcpd_cruiser') {
        const doorWhite = makePaintMat('#f4f6f8');
        const doors = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.04, chassisH * 0.92, l * 0.42),
          doorWhite
        );
        doors.position.set(0, chassisY, 0);
        this._addInkOutline(doors);
        bodyGroup.add(doors);
      }

      if (spec.isPolice) {
        // Heavy-duty front steel ramming push-bar with vertical bull-bars
        const pushBar = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.74, 0.48, 0.22),
          this.darkTrimMaterial
        );
        pushBar.position.set(0, 0.48, l * 0.5 + 0.12);
        this._addInkOutline(pushBar);
        bodyGroup.add(pushBar);

        // Roof lightbar with alternating red/blue lenses + additive road glow discs
        const roofY = 0.34 + chassisH + cabinH + 0.12;
        const barBase = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.66, 0.12, 0.3),
          this.chromeMaterial
        );
        barBase.position.set(0, roofY, cabinZ);
        this._addInkOutline(barBase);

        const redLensMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
        const blueLensMat = new THREE.MeshBasicMaterial({ color: 0x00b0ff });
        const redLens = new THREE.Mesh(new THREE.BoxGeometry(w * 0.28, 0.17, 0.28), redLensMat);
        redLens.position.set(-w * 0.17, roofY + 0.06, cabinZ);
        this._addInkOutline(redLens);
        const blueLens = new THREE.Mesh(new THREE.BoxGeometry(w * 0.28, 0.17, 0.28), blueLensMat);
        blueLens.position.set(w * 0.17, roofY + 0.06, cabinZ);
        this._addInkOutline(blueLens);
        bodyGroup.add(barBase, redLens, blueLens);

        // Additive road siren glow discs (NO PointLights!)
        const glowGeo = new THREE.PlaneGeometry(7.5, 7.5);
        const glowRedMat = new THREE.MeshBasicMaterial({
          color: 0xff1744,
          map: this.glowTexture,
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const glowBlueMat = new THREE.MeshBasicMaterial({
          color: 0x00b0ff,
          map: this.glowTexture,
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const glowRed = new THREE.Mesh(glowGeo, glowRedMat);
        glowRed.rotation.x = -Math.PI * 0.5;
        glowRed.position.set(-1.1, 0.06, 0);
        const glowBlue = new THREE.Mesh(glowGeo, glowBlueMat);
        glowBlue.rotation.x = -Math.PI * 0.5;
        glowBlue.position.set(1.1, 0.06, 0);
        root.add(glowRed, glowBlue);

        sirenParts = { redLens, blueLens, glowRed, glowBlue };
      }

      // Kaufman Cab roof "TAXI" glowing sign & side checker trim
      if (type === 'kaufman_cab') {
        const taxiSignMat = new THREE.MeshBasicMaterial({ color: 0xffee58 });
        const taxiSign = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.26, 0.34), taxiSignMat);
        taxiSign.position.set(0, 0.34 + chassisH + cabinH + 0.13, cabinZ);
        this._addInkOutline(taxiSign);
        const sideCheck = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.04, 0.14, l * 0.88),
          this.darkTrimMaterial
        );
        sideCheck.position.set(0, chassisY + 0.05, 0);
        bodyGroup.add(taxiSign, sideCheck);
      }

      // Cuban Hermes flame/gold side scallop trim
      if (type === 'cuban_hermes') {
        const flameMat = makePaintMat('#ff9100');
        const flameTrim = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.04, 0.18, l * 0.72),
          flameMat
        );
        flameTrim.position.set(0, chassisY, 0.25);
        bodyGroup.add(flameTrim);
      }

      // 9. Front black slatted radiator grille, chrome bumpers & twin exhaust tips
      const grille = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.56, 0.2, 0.08),
        this.darkTrimMaterial
      );
      grille.position.set(0, 0.52, l * 0.5 + 0.01);
      bodyGroup.add(grille);

      const bumperGeo = new THREE.BoxGeometry(w * 0.98, 0.18, 0.2);
      const frontBumper = new THREE.Mesh(bumperGeo, this.chromeMaterial);
      frontBumper.position.set(0, 0.34, l * 0.5);
      this._addInkOutline(frontBumper);
      const rearBumper = new THREE.Mesh(bumperGeo, this.chromeMaterial);
      rearBumper.position.set(0, 0.34, -l * 0.5);
      this._addInkOutline(rearBumper);
      bodyGroup.add(frontBumper, rearBumper);

      for (const ex of [-w * 0.28, w * 0.28]) {
        const exhaust = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.1, 0.22),
          this.chromeMaterial
        );
        exhaust.position.set(ex, 0.25, -l * 0.5 - 0.06);
        bodyGroup.add(exhaust);
      }

      // 10. 4 independent rotating wheel meshes with 5-spoke metallic alloy rims
      const wheelPositions = [
        { x: -w * 0.49, z: l * 0.31, isFront: true },
        { x: w * 0.49, z: l * 0.31, isFront: true },
        { x: -w * 0.49, z: -l * 0.31, isFront: false },
        { x: w * 0.49, z: -l * 0.31, isFront: false },
      ];
      for (const wp of wheelPositions) {
        const wMesh = this._createWheelMesh(0.37, 0.28);
        wMesh.position.set(wp.x, 0.37, wp.z);
        bodyGroup.add(wMesh);
        wheels.push({ mesh: wMesh, isFront: wp.isFront });
      }
    }

    // Quad headlights + amber turn signals + night additive light-cone beams + quad red taillights
    const hlOffsets =
      type === 'pcj600' || type === 'skimmer_plane' || type === 'maverick_heli'
        ? [0]
        : [-spec.width * 0.34, spec.width * 0.34];
    const coneGeo = new THREE.PlaneGeometry(2.6, 8.2);
    coneGeo.translate(0, 4.1, 0);

    for (const hx of hlOffsets) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.1), this.headlightMat);
      hl.position.set(hx, 0.54, spec.length * 0.5 + 0.02);
      bodyGroup.add(hl);

      if (type !== 'pcj600' && !spec.isAircraft) {
        const signX = hx < 0 ? hx - 0.2 : hx + 0.2;
        const blinker = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.14, 0.1),
          this.amberSignalMat
        );
        blinker.position.set(signX, 0.54, spec.length * 0.5 + 0.01);
        bodyGroup.add(blinker);
      }

      const cone = new THREE.Mesh(coneGeo, this.headlightConeMat);
      cone.rotation.x = -Math.PI * 0.5;
      cone.position.set(hx, 0.07, spec.length * 0.5);
      root.add(cone);
      headlightCones.push(cone);

      const tlMat = this.taillightMat.clone();
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.17, 0.1), tlMat);
      tl.position.set(hx, 0.55, -spec.length * 0.5 - 0.02);
      bodyGroup.add(tl);
      taillightMeshes.push(tl);
    }

    return {
      root,
      bodyGroup,
      shadowMesh,
      hoodMesh,
      wheels,
      outboards,
      propellerMesh,
      mainRotorMesh,
      tailRotorMesh,
      headlightCones,
      taillightMeshes,
      sirenParts,
      bodyMaterials,
    };
  }

  _createWheelMesh(radius, width) {
    const group = new THREE.Group();
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 14);
    tireGeo.rotateZ(Math.PI * 0.5);
    const tire = new THREE.Mesh(tireGeo, this.tireMaterial);
    this._addInkOutline(tire, 35);

    const rimGroup = new THREE.Group();
    const rimGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.02, 10);
    rimGeo.rotateZ(Math.PI * 0.5);
    const rim = new THREE.Mesh(rimGeo, this.rimMaterial);
    rimGroup.add(rim);

    // 5-spoke metallic alloy star bars on wheel hub
    const spokeGeo = new THREE.BoxGeometry(width + 0.04, radius * 1.1, radius * 0.18);
    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.Mesh(spokeGeo, this.chromeMaterial);
      spoke.rotation.x = (s * Math.PI) / 3;
      rimGroup.add(spoke);
    }

    group.add(tire, rimGroup);
    return group;
  }

  _updatePoliceSirens(v, dt) {
    const sp = v.sirenParts;
    if (!sp) return;
    if (v.isExploded) {
      sp.glowRed.visible = false;
      sp.glowBlue.visible = false;
      return;
    }

    const sirensActive = Boolean(this.wantedStars > 0 || v === this.playerVehicle);
    if (!sirensActive) {
      sp.redLens.material.color.setHex(0x4a0e17);
      sp.blueLens.material.color.setHex(0x0a2942);
      sp.glowRed.visible = false;
      sp.glowBlue.visible = false;
      return;
    }

    v.sirenPhase += dt * (v.isWrecked ? 4.0 : 12.0);
    const redActive = Math.sin(v.sirenPhase) >= 0;
    sp.redLens.material.color.setHex(redActive ? 0xff1744 : 0x4a0e17);
    sp.blueLens.material.color.setHex(!redActive ? 0x00b0ff : 0x0a2942);
    sp.glowRed.visible = redActive;
    sp.glowBlue.visible = !redActive;
  }

  _syncVehicleMeshTransform(v, dt) {
    v.mesh.position.set(v.x, v.y, v.z);
    v.mesh.rotation.y = v.rotationY;

    if (v.shadowMesh) {
      const groundY =
        v.isBoat || (v.isAircraft && this._isWaterAt(v.x, v.z))
          ? this._getWaterSurfaceY(v.x, v.z)
          : this._getGroundY(v.x, v.z);
      v.shadowMesh.position.y = Math.max(0.03, groundY - v.y + 0.03);
    }

    v.bodyGroup.rotation.y = v.driftAngle;
    v.bodyGroup.rotation.x = v.pitchAngle;
    v.bodyGroup.rotation.z = v.rollAngle;

    // Spin wheels & steer front wheels
    const wheelSpin = (v.speed / 0.36) * dt;
    for (const w of v.wheels) {
      if (w.isFront) {
        w.mesh.rotation.y = v.steerAngle;
      }
      w.mesh.children[0].rotation.x += wheelSpin;
      w.mesh.children[1].rotation.x += wheelSpin;
    }

    // Pivot twin outboard motors on speedboats
    for (const ob of v.outboards) {
      ob.rotation.y = -v.steerAngle * 0.85;
    }

    // Spin aircraft propellers & helicopter rotors
    if (v.propellerMesh && !v.isExploded) {
      const propSpeed =
        v === this.playerVehicle || v.speed > 0.5 || v.y > 0.8 ? 30.0 + v.speed * 0.45 : 7.5;
      v.propellerMesh.rotation.z += propSpeed * dt;
    }
    if (v.mainRotorMesh && !v.isExploded) {
      const rotorSpeed = v === this.playerVehicle || v.speed > 0.5 || v.y > 0.8 ? 28.0 : 6.0;
      v.mainRotorMesh.rotation.y += rotorSpeed * dt;
    }
    if (v.tailRotorMesh && !v.isExploded) {
      const tailSpeed = v === this.playerVehicle || v.speed > 0.5 || v.y > 0.8 ? 34.0 : 8.0;
      v.tailRotorMesh.rotation.x += tailSpeed * dt;
    }
  }

  // ============================================================================
  // FX POOLS: DUAL TIRE SKIDMARKS, WATER WAKE FOAM, SMOKE, SPARKS & FIREBALLS
  // ============================================================================

  _spawnWingtipContrail(v) {
    const cos = Math.cos(v.rotationY);
    const sin = Math.sin(v.rotationY);
    const wingZ = 0.1;
    const halfSpan = 3.65;

    for (const side of [-halfSpan, halfSpan]) {
      const wx = v.x + sin * wingZ + cos * side;
      const wz = v.z + cos * wingZ - sin * side;
      const wy = v.y + 1.82 + (side < 0 ? 1 : -1) * Math.sin(v.rollAngle || 0) * halfSpan;

      const mat = new THREE.MeshBasicMaterial({
        color: 0xf4fbff,
        transparent: true,
        opacity: 0.68,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.55), mat);
      mesh.position.set(wx, wy, wz);
      mesh.rotation.y = v.rotationY;
      this.fxGroup.add(mesh);

      this.particles.push({
        mesh,
        mat,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.3,
        vz: (Math.random() - 0.5) * 0.4,
        grow: 0.95,
        ttl: 0.55,
        maxTtl: 0.55,
      });
    }
  }

  _spawnDualTireSkids(v) {
    const cos = Math.cos(v.rotationY);
    const sin = Math.sin(v.rotationY);
    const rearZ = -v.spec.length * 0.32;
    const halfW = v.spec.width * 0.42;

    for (const side of [-halfW, halfW]) {
      const sx = v.x + sin * rearZ + cos * side;
      const sz = v.z + cos * rearZ - sin * side;
      const geo = new THREE.PlaneGeometry(0.28, 1.05);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x101216,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI * 0.5;
      mesh.rotation.z = -v.rotationY - v.driftAngle;
      mesh.position.set(sx, v.y + 0.04, sz);
      this.fxGroup.add(mesh);
      this.skidMarks.push({ mesh, mat, ttl: 5.5, maxTtl: 5.5, baseOpacity: 0.75 });
    }

    while (this.skidMarks.length > 280) {
      const old = this.skidMarks.shift();
      this.fxGroup.remove(old.mesh);
    }
  }

  /**
   * Spawns warm indented wet-sand dual tire tracks with raised golden sand berms when driving on Ocean Beach.
   */
  _spawnBeachSandTrail(v) {
    const cos = Math.cos(v.rotationY);
    const sin = Math.sin(v.rotationY);
    const rearZ = -v.spec.length * 0.30;
    const halfW = v.spec.width * 0.42;
    const groundY = this._getGroundY(v.x, v.z);

    for (const side of [-halfW, halfW]) {
      const sx = v.x + sin * rearZ + cos * side;
      const sz = v.z + cos * rearZ - sin * side;

      const rutGroup = new THREE.Group();
      rutGroup.position.set(sx, groundY + 0.035, sz);
      rutGroup.rotation.y = v.rotationY + (v.driftAngle || 0) * 0.6;

      // Outer displaced golden sand berm
      const bermGeo = new THREE.PlaneGeometry(0.46, 1.25);
      const bermMat = new THREE.MeshBasicMaterial({
        color: 0xe6c37a,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const bermMesh = new THREE.Mesh(bermGeo, bermMat);
      bermMesh.rotation.x = -Math.PI * 0.5;
      rutGroup.add(bermMesh);

      // Inner indented dark warm wet-sand tire rut
      const rutGeo = new THREE.PlaneGeometry(0.28, 1.22);
      const rutMat = new THREE.MeshBasicMaterial({
        color: 0x9b6d34,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const rutMesh = new THREE.Mesh(rutGeo, rutMat);
      rutMesh.rotation.x = -Math.PI * 0.5;
      rutMesh.position.y = 0.004;
      rutGroup.add(rutMesh);

      this.fxGroup.add(rutGroup);
      this.skidMarks.push({
        mesh: rutGroup,
        mat: rutMat,
        extraMat: bermMat,
        ttl: 11.0,
        maxTtl: 11.0,
        baseOpacity: 0.88,
      });
    }

    while (this.skidMarks.length > 280) {
      const old = this.skidMarks.shift();
      this.fxGroup.remove(old.mesh);
    }
  }

  /**
   * Kicks up warm golden-tan sand rooster-tail spray particles behind the rear wheels on the beach.
   */
  _spawnSandSprayPuff(v) {
    const cos = Math.cos(v.rotationY);
    const sin = Math.sin(v.rotationY);
    const rearZ = -v.spec.length * 0.42;
    const halfW = v.spec.width * 0.42;
    const moveSign = v.forwardSpeed < -0.2 ? -1 : 1;

    for (const side of [-halfW, halfW]) {
      const sx = v.x + sin * rearZ + cos * side;
      const sz = v.z + cos * rearZ - sin * side;
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.55 ? 0xe8c47c : 0xc9964c,
        transparent: true,
        opacity: 0.88,
      });
      const size = 0.24 + Math.random() * 0.16;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
      mesh.position.set(
        sx + (Math.random() - 0.5) * 0.25,
        v.y + 0.18,
        sz + (Math.random() - 0.5) * 0.25
      );
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.fxGroup.add(mesh);

      const sprayBackSpeed = clamp(Math.abs(v.forwardSpeed) * 0.32, 2.2, 7.5);
      this.particles.push({
        mesh,
        mat,
        vx: -sin * moveSign * sprayBackSpeed + (Math.random() - 0.5) * 2.2,
        vy: 2.4 + Math.random() * 2.4,
        vz: -cos * moveSign * sprayBackSpeed + (Math.random() - 0.5) * 2.2,
        gravity: 11.5,
        grow: 1.15,
        ttl: 0.52,
        maxTtl: 0.52,
      });
    }
  }

  /**
   * Spawns a turquoise & white water splash burst when a vehicle plunges into the ocean or bay.
   */
  _spawnWaterSplash(x, y, z) {
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xf0ffff : 0x26c6da,
        transparent: true,
        opacity: 0.92,
      });
      const size = 0.26 + (i % 3) * 0.12;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size * 1.3, size), mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 1.8,
        y + 0.15,
        z + (Math.random() - 0.5) * 1.8
      );
      this.fxGroup.add(mesh);

      const angle = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const spd = 3.2 + Math.random() * 5.0;
      this.particles.push({
        mesh,
        mat,
        vx: Math.sin(angle) * spd,
        vy: 4.2 + Math.random() * 4.8,
        vz: Math.cos(angle) * spd,
        gravity: 15.0,
        grow: 0.6,
        ttl: 0.68,
        maxTtl: 0.68,
      });
    }
    this._spawnWaterBubbleRing(x, y + 0.03, z);
  }

  /**
   * Spawns an expanding white water foam / air bubble ring above a sinking vehicle.
   */
  _spawnWaterBubbleRing(x, y, z) {
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f7fa,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringGeo = new THREE.RingGeometry(0.65, 1.35, 14);
    ringGeo.rotateX(-Math.PI * 0.5);
    const mesh = new THREE.Mesh(ringGeo, foamMat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.45,
      y,
      z + (Math.random() - 0.5) * 0.45
    );
    this.fxGroup.add(mesh);
    this.waterWakes.push({
      mesh,
      mat: foamMat,
      ttl: 1.35,
      maxTtl: 1.35,
      expandRate: 1.9,
    });

    while (this.waterWakes.length > 90) {
      const old = this.waterWakes.shift();
      this.fxGroup.remove(old.mesh);
    }
  }

  _spawnWaterWake(x, y, z, rotationY, speed) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotationY;

    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f7fa,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const armGeo = new THREE.PlaneGeometry(0.55, 2.4);
    const leftArm = new THREE.Mesh(armGeo, foamMat);
    leftArm.rotation.x = -Math.PI * 0.5;
    leftArm.rotation.z = 0.34;
    leftArm.position.set(-0.9, 0, -0.8);

    const rightArm = new THREE.Mesh(armGeo, foamMat);
    rightArm.rotation.x = -Math.PI * 0.5;
    rightArm.rotation.z = -0.34;
    rightArm.position.set(0.9, 0, -0.8);

    group.add(leftArm, rightArm);
    this.fxGroup.add(group);
    this.waterWakes.push({
      mesh: group,
      mat: foamMat,
      ttl: 1.8,
      maxTtl: 1.8,
      expandRate: clamp(speed / 18, 0.8, 2.4),
    });

    while (this.waterWakes.length > 90) {
      const old = this.waterWakes.shift();
      this.fxGroup.remove(old.mesh);
    }
  }

  _spawnTireSmokePuff(v) {
    const rearX = v.x - Math.sin(v.rotationY) * (v.spec.length * 0.38);
    const rearZ = v.z - Math.cos(v.rotationY) * (v.spec.length * 0.38);
    this._spawnSmokePuff(rearX, v.y + 0.3, rearZ, 'burnout');
  }

  _spawnSmokePuff(x, y, z, kind = 'steam') {
    let color = 0xf5f7fa;
    let size = 0.42;
    let opacity = 0.65;
    if (kind === 'black') {
      color = 0x22252b;
      size = 0.55;
      opacity = 0.82;
    } else if (kind === 'fire') {
      color = Math.random() < 0.5 ? 0xff6d00 : 0xff1744;
      size = 0.48;
      opacity = 0.92;
    } else if (kind === 'burnout') {
      color = 0xebeff5;
      size = 0.46;
      opacity = 0.72;
    }

    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.6,
      y,
      z + (Math.random() - 0.5) * 0.6
    );
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    this.fxGroup.add(mesh);

    this.particles.push({
      mesh,
      mat,
      vx: (Math.random() - 0.5) * 1.4,
      vy: 2.2 + Math.random() * 1.6,
      vz: (Math.random() - 0.5) * 1.4,
      grow: 1.45,
      ttl: 0.75,
      maxTtl: 0.75,
    });
  }

  _spawnSparkBurst(x, y, z, count = 12) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffd600 : 0xff6d00,
        transparent: true,
        opacity: 1.0,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.42), mat);
      mesh.position.set(x, y, z);
      const angle = Math.random() * Math.PI * 2;
      const spd = 6 + Math.random() * 11;
      mesh.rotation.y = angle;
      this.fxGroup.add(mesh);

      this.particles.push({
        mesh,
        mat,
        vx: Math.sin(angle) * spd,
        vy: 3.5 + Math.random() * 5.5,
        vz: Math.cos(angle) * spd,
        gravity: 18,
        grow: 0,
        ttl: 0.42,
        maxTtl: 0.42,
      });
    }
  }

  _spawnExplosionFireball(x, y, z) {
    const colors = [0xfff176, 0xff9100, 0xff1744, 0x262930];
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.95,
      });
      const radius = 0.8 + (i % 3) * 0.45;
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 2.2,
        y + Math.random() * 1.4,
        z + (Math.random() - 0.5) * 2.2
      );
      this.fxGroup.add(mesh);

      this.particles.push({
        mesh,
        mat,
        vx: (Math.random() - 0.5) * 7.5,
        vy: 4.5 + Math.random() * 6.5,
        vz: (Math.random() - 0.5) * 7.5,
        grow: 2.6,
        ttl: 0.85,
        maxTtl: 0.85,
      });
    }
  }

  _spawnHeliTracer(x0, y0, z0, x1, y1, z1) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff59d,
      transparent: true,
      opacity: 0.9,
    });
    const dist = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const geo = new THREE.BoxGeometry(0.08, 0.08, dist);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
    mesh.lookAt(x1, y1, z1);
    this.fxGroup.add(mesh);
    this.heliTracers.push({ mesh, mat, ttl: 0.14 });
  }

  _updateFXPools(dt) {
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      const s = this.skidMarks[i];
      s.ttl -= dt;
      if (s.ttl <= 0) {
        this.fxGroup.remove(s.mesh);
        this.skidMarks.splice(i, 1);
      } else {
        const op = (s.ttl / s.maxTtl) * (s.baseOpacity || 0.72);
        s.mat.opacity = op;
        if (s.extraMat) s.extraMat.opacity = op;
      }
    }

    for (let i = this.waterWakes.length - 1; i >= 0; i--) {
      const w = this.waterWakes[i];
      w.ttl -= dt;
      if (w.ttl <= 0) {
        this.fxGroup.remove(w.mesh);
        this.waterWakes.splice(i, 1);
      } else {
        w.mesh.scale.x += w.expandRate * dt;
        w.mesh.scale.z += w.expandRate * 0.4 * dt;
        w.mat.opacity = (w.ttl / w.maxTtl) * 0.75;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.ttl -= dt;
      if (p.ttl <= 0) {
        this.fxGroup.remove(p.mesh);
        this.particles.splice(i, 1);
      } else {
        if (p.gravity) p.vy -= p.gravity * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        if (p.grow) {
          p.mesh.scale.addScalar(p.grow * dt);
        }
        p.mat.opacity = clamp(p.ttl / p.maxTtl, 0, 1);
      }
    }

    for (let i = this.heliTracers.length - 1; i >= 0; i--) {
      const t = this.heliTracers[i];
      t.ttl -= dt;
      if (t.ttl <= 0) {
        this.fxGroup.remove(t.mesh);
        this.heliTracers.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // WORLD ENVIRONMENT HELPERS (WATER, BEACH SAND, ELEVATION, NIGHT & COLLISIONS)
  // ============================================================================

  _getStuntRamps() {
    if (this.world && typeof this.world.getStuntRamps === 'function') {
      const ramps = this.world.getStuntRamps();
      if (Array.isArray(ramps) && ramps.length > 0) return ramps;
    }
    if (this.world && Array.isArray(this.world.stuntRamps) && this.world.stuntRamps.length > 0) {
      return this.world.stuntRamps;
    }
    return [
      { id: 'ramp_ocean_drive', name: 'Ocean Drive Promenade Jump', x: 83.2, z: -42.0, width: 5.5, length: 9.0 },
      { id: 'ramp_causeway', name: 'Starfish Causeway Jump', x: 18.0, z: 3.2, width: 6.0, length: 9.5 },
      { id: 'ramp_marina', name: 'Ocean Beach Marina Jump', x: 96.0, z: 32.0, width: 5.5, length: 9.0 },
      { id: 'ramp_airport', name: 'Escobar Runway Jump', x: -145.0, z: 85.0, width: 6.5, length: 10.0 },
    ];
  }

  _getBuildingRoofYAt(x, z, currentY = 0) {
    if (currentY < 2.5) return 0;
    const colliders =
      this.world?.buildingColliders || this.world?.colliders || this.world?.buildings || null;
    if (!Array.isArray(colliders)) return 0;

    let maxRoof = 0;
    for (const box of colliders) {
      const minX = box.minX !== undefined ? box.minX : box.x - (box.width || box.w || 8) * 0.5;
      const maxX = box.maxX !== undefined ? box.maxX : box.x + (box.width || box.w || 8) * 0.5;
      const minZ = box.minZ !== undefined ? box.minZ : box.z - (box.depth || box.d || 8) * 0.5;
      const maxZ = box.maxZ !== undefined ? box.maxZ : box.z + (box.depth || box.d || 8) * 0.5;
      const h = box.height || box.h || box.maxY || 14.0;
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ && currentY >= h - 1.2) {
        if (h > maxRoof) maxRoof = h;
      }
    }
    return maxRoof;
  }

  _isBeachSandAt(x, z) {
    if (this.world && typeof this.world.isBeachSandAt === 'function') {
      return Boolean(this.world.isBeachSandAt(x, z));
    }
    return x >= 93.2 && x <= 129.2 && z >= -166.0 && z <= 166.0;
  }

  _isWaterAt(x, z) {
    if (this.world && typeof this.world.isWaterAt === 'function') {
      return Boolean(this.world.isWaterAt(x, z));
    }
    if (Math.abs(x) > 180 || Math.abs(z) > 180) {
      return false;
    }
    // Fallback ViceCityWorld core water zones:
    // Atlantic Ocean east of beach (x > 130) & South Marina (z > 110)
    if (x > 130 || z > 110) return true;
    // Biscayne Bay (-100 < x < 30), excluding causeways & Starfish Island
    if (x > -100 && x < 30) {
      if (Math.abs(z) < 9 || Math.abs(z - -90) < 8 || Math.abs(z - 95) < 8) return false;
      if (x >= -64 && x <= 0 && z >= -58 && z <= 58) return false;
      return true;
    }
    return false;
  }

  _getGroundY(x, z) {
    if (this.world && typeof this.world.getGroundHeight === 'function') {
      return this.world.getGroundHeight(x, z);
    }
    if (this.world && typeof this.world.getHeightAt === 'function') {
      return this.world.getHeightAt(x, z);
    }
    return 0;
  }

  _getWaterSurfaceY(x, z) {
    if (this.world && typeof this.world.getWaterHeight === 'function') {
      return this.world.getWaterHeight(x, z);
    }
    return -0.22;
  }

  _isNightTime() {
    if (this.world) {
      if (typeof this.world.isNight === 'boolean') return this.world.isNight;
      if (typeof this.world.isNightTime === 'function') return Boolean(this.world.isNightTime());
      if (typeof this.world.timeOfDay === 'number') {
        return this.world.timeOfDay < 6.5 || this.world.timeOfDay > 18.5;
      }
    }
    return true;
  }

  _isLineOccludedByBuilding(x0, z0, x1, z1) {
    const colliders =
      this.world?.buildingColliders || this.world?.colliders || this.world?.buildings || null;
    if (!Array.isArray(colliders)) return false;

    const steps = 6;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const sx = x0 + (x1 - x0) * t;
      const sz = z0 + (z1 - z0) * t;
      for (const box of colliders) {
        const minX = box.minX !== undefined ? box.minX : box.x - (box.width || box.w || 8) * 0.5;
        const maxX = box.maxX !== undefined ? box.maxX : box.x + (box.width || box.w || 8) * 0.5;
        const minZ = box.minZ !== undefined ? box.minZ : box.z - (box.depth || box.d || 8) * 0.5;
        const maxZ = box.maxZ !== undefined ? box.maxZ : box.z + (box.depth || box.d || 8) * 0.5;
        if (sx >= minX && sx <= maxX && sz >= minZ && sz <= maxZ) {
          return true;
        }
      }
    }
    return false;
  }

  _resolveWorldCollision(x, z, radius, isBoat = false, vehicleY = 0, isAircraft = false) {
    if (this.world) {
      if (!isAircraft && vehicleY <= 3.0 && typeof this.world.resolveCircleCollision === 'function') {
        const res = this.world.resolveCircleCollision(x, z, radius, isBoat);
        if (res && res.hit) {
          return {
            hit: true,
            x: res.x ?? x,
            z: res.z ?? z,
            nx: res.nx ?? 0,
            nz: res.nz ?? 0,
            contactX: res.contactX ?? x,
            contactZ: res.contactZ ?? z,
          };
        }
      }
      const colliders =
        this.world.buildingColliders ||
        this.world.colliders ||
        this.world.buildings ||
        null;
      if (Array.isArray(colliders)) {
        for (const box of colliders) {
          const boxHeight = box.height || box.h || box.maxY || 14.0;
          if (isAircraft && boxHeight <= 6.0) continue;
          if (vehicleY >= boxHeight) continue;

          const minX = box.minX !== undefined ? box.minX : box.x - (box.width || box.w || 8) * 0.5;
          const maxX = box.maxX !== undefined ? box.maxX : box.x + (box.width || box.w || 8) * 0.5;
          const minZ = box.minZ !== undefined ? box.minZ : box.z - (box.depth || box.d || 8) * 0.5;
          const maxZ = box.maxZ !== undefined ? box.maxZ : box.z + (box.depth || box.d || 8) * 0.5;

          const cx = clamp(x, minX, maxX);
          const cz = clamp(z, minZ, maxZ);
          const dx = x - cx;
          const dz = z - cz;
          const dSq = dx * dx + dz * dz;
          if (dSq < radius * radius) {
            const d = Math.sqrt(dSq) || 0.001;
            const nx = dx / d;
            const nz = dz / d;
            return {
              hit: true,
              x: cx + nx * radius,
              z: cz + nz * radius,
              nx,
              nz,
              contactX: cx,
              contactZ: cz,
            };
          }
        }
      }
    }
    return { hit: false, x, z, nx: 0, nz: 0, contactX: x, contactZ: z };
  }
}
