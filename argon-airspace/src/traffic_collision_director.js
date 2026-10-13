/**
 * @fileoverview Agent 4 — Traffic Director & Spatial Collision Engine
 * Authentic Three.js Orthographic Remake of Argon Airspace (2009).
 *
 * Coordinate System Contract:
 * - Orthographic world space: X in [-480, +480] (width 960), Y in [-320, +320] (height 640).
 * - Heading 0 rad points East (+X), +Math.PI / 2 points North (+Y).
 * - Exports `MAP_DEFINITIONS` and `TrafficAndCollisionDirector` (and attaches both to `window`).
 */

export const WORLD_HALF_WIDTH = 480;
export const WORLD_HALF_HEIGHT = 320;
export const PERIMETER_SPAWN_X = 462;
export const PERIMETER_SPAWN_Y = 302;
export const BADGE_CLAMP_X = 442;
export const BADGE_CLAMP_Y = 282;

export const WARNING_RADIUS = 64;
export const COLLISION_RADIUS = 22;
export const PERIMETER_LEAD_TIME = 3.0;
export const MIN_SPAWN_SEPARATION = 135;

/**
 * Fallback aircraft class specifications matching Agent 3 (`AIRCRAFT_CLASSES` in `flight_kinematics.js`).
 */
export const DEFAULT_CLASS_SPECS = {
  jet_red: {
    id: 'jet_red',
    name: 'Clipper Heavy Jet',
    runwayColor: 'red',
    spriteKey: 'plane_jet_red',
    speed: 76,
    maxTurnRate: 1.95,
    maxBankRad: 0.58,
    scale: 1.24,
    shadowBaseOffset: 16,
    hasPropeller: false,
    hasRotor: false,
    colorHex: 0xff3b30,
    colorCss: '#ff3b30',
  },
  seaplane_green: {
    id: 'seaplane_green',
    name: 'Catalina Seaplane',
    runwayColor: 'green',
    spriteKey: 'plane_seaplane_green',
    speed: 62,
    maxTurnRate: 2.40,
    maxBankRad: 0.50,
    scale: 1.06,
    shadowBaseOffset: 14,
    hasPropeller: true,
    hasRotor: false,
    colorHex: 0x2ee6a8,
    colorCss: '#2ee6a8',
  },
  prop_yellow: {
    id: 'prop_yellow',
    name: 'Sunbird Monoplane',
    runwayColor: 'yellow',
    spriteKey: 'plane_prop_yellow',
    speed: 52,
    maxTurnRate: 2.95,
    maxBankRad: 0.52,
    scale: 0.94,
    shadowBaseOffset: 12,
    hasPropeller: true,
    hasRotor: false,
    colorHex: 0xffd60a,
    colorCss: '#ffd60a',
  },
  prop_blue: {
    id: 'prop_blue',
    name: 'Skylark Commuter',
    runwayColor: 'blue',
    spriteKey: 'plane_prop_blue',
    speed: 46,
    maxTurnRate: 3.15,
    maxBankRad: 0.48,
    scale: 0.90,
    shadowBaseOffset: 11,
    hasPropeller: true,
    hasRotor: false,
    colorHex: 0x2ac3ff,
    colorCss: '#2ac3ff',
  },
  heli_blue: {
    id: 'heli_blue',
    name: 'Rescue Chopper',
    runwayColor: 'blue_heli',
    spriteKey: 'plane_heli_blue',
    speed: 35,
    maxTurnRate: 4.10,
    maxBankRad: 0.36,
    scale: 0.95,
    shadowBaseOffset: 10,
    hasPropeller: false,
    hasRotor: true,
    colorHex: 0x38bdf8,
    colorCss: '#38bdf8',
  },
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function hexToCss(hex) {
  return '#' + (hex >>> 0).toString(16).padStart(6, '0');
}

function buildLinearRunway({
  id,
  label,
  colorKey,
  colorHex,
  thresholdX,
  thresholdY,
  endX,
  endY,
  width = 28,
  snapRadius = 44,
  isWaterRunway = false,
  allowedClasses = [],
}) {
  const dx = endX - thresholdX;
  const dy = endY - thresholdY;
  const length = Math.hypot(dx, dy);
  const heading = Math.atan2(dy, dx);
  const centerX = (thresholdX + endX) * 0.5;
  const centerY = (thresholdY + endY) * 0.5;
  return {
    id,
    label,
    type: isWaterRunway ? 'water' : 'runway',
    colorKey,
    colorHex,
    colorCss: hexToCss(colorHex),
    isHelipad: false,
    isWaterRunway: Boolean(isWaterRunway),
    thresholdX,
    thresholdY,
    endX,
    endY,
    x: centerX,
    y: centerY,
    centerX,
    centerY,
    width,
    length,
    heading,
    snapRadius,
    allowedClasses: [...allowedClasses],
  };
}

function buildHelipad({
  id,
  label,
  colorKey = 'blue_heli',
  colorHex = 0x38bdf8,
  x,
  y,
  width = 44,
  snapRadius = 40,
  allowedClasses = ['heli_blue'],
}) {
  return {
    id,
    label,
    type: 'helipad',
    colorKey,
    colorHex,
    colorCss: hexToCss(colorHex),
    isHelipad: true,
    isWaterRunway: false,
    thresholdX: x,
    thresholdY: y,
    endX: x,
    endY: y,
    x,
    y,
    centerX: x,
    centerY: y,
    width,
    length: width,
    radius: width * 0.5,
    heading: 0,
    snapRadius,
    allowedClasses: [...allowedClasses],
  };
}

/**
 * 3 Complete Airfield Map Definitions (`MAP_DEFINITIONS`) modeled on Argon's Argon Airspace.
 */
export const MAP_DEFINITIONS = {
  classic_outback: {
    id: 'classic_outback',
    name: 'Classic Outback Airfield',
    shortName: 'Outback',
    tabLabel: 'Outback',
    subtitle: 'Sun-Baked Red Earth & Central Apron Crosswind Strips',
    textureKey: 'map_classic_outback',
    texturePath: 'assets/textures/map_classic_outback.png',
    hostessKey: 'hostess_wendy',
    hostessName: 'Stewardess Wendy',
    themeColors: {
      groundPrimary: 0x6ba83e,
      groundSecondary: 0x589130,
      soilAccent: 0xc87d4b,
      apronLight: 0xe8dcc4,
      apronDark: 0xdfd1b5,
      apronBorder: 0xc4b08b,
      asphaltColor: 0x484644,
      waterColor: 0x38bdf8,
      ambientTint: 0xfff8eb,
    },
    windsockPos: { x: 0, y: 5 },
    apronZones: [
      { x: -15, y: -15, width: 470, height: 260, rotation: 0, cornerRadius: 28 },
      { x: -215, y: 15, width: 120, height: 84, rotation: 0, cornerRadius: 18 },
      { x: 205, y: -25, width: 110, height: 84, rotation: 0, cornerRadius: 18 },
    ],
    hangars: [
      {
        id: 'hangar_outback_tower',
        type: 'tower',
        label: 'Outback Control Tower',
        x: 68,
        y: -35,
        width: 34,
        depth: 34,
        height: 28,
        rotation: -0.25,
        roofColor: 0xd9cbb0,
        wallColor: 0xf4ead5,
      },
      {
        id: 'hangar_outback_main',
        type: 'hangar',
        label: 'Clipper Maintenance Hangar',
        x: 118,
        y: -48,
        width: 54,
        depth: 36,
        height: 18,
        rotation: 0,
        roofColor: 0xcab99b,
        wallColor: 0xede0c8,
      },
      {
        id: 'hangar_outback_west',
        type: 'hangar',
        label: 'Bush Pilot Shed',
        x: -142,
        y: 62,
        width: 46,
        depth: 32,
        height: 16,
        rotation: 0.65,
        roofColor: 0xd1c1a5,
        wallColor: 0xefe3cc,
      },
      {
        id: 'hangar_outback_south',
        type: 'terminal',
        label: 'Regional Passenger Terminal',
        x: -115,
        y: -172,
        width: 58,
        depth: 28,
        height: 15,
        rotation: 0,
        roofColor: 0xc7b597,
        wallColor: 0xf2e6d0,
      },
    ],
    runways: [
      buildLinearRunway({
        id: 'runway_jet_main',
        label: 'RWY 23 RED JET',
        colorKey: 'red',
        colorHex: 0xff3b30,
        thresholdX: 150,
        thresholdY: 95,
        endX: -30,
        endY: -145,
        width: 34,
        snapRadius: 48,
        allowedClasses: ['jet_red'],
      }),
      buildLinearRunway({
        id: 'runway_prop_south',
        label: 'RWY 27 YELLOW PROP',
        colorKey: 'yellow',
        colorHex: 0xffd60a,
        thresholdX: 192,
        thresholdY: -132,
        endX: -2,
        endY: -132,
        width: 26,
        snapRadius: 44,
        allowedClasses: ['prop_yellow', 'prop_blue'],
      }),
      buildLinearRunway({
        id: 'runway_prop_west',
        label: 'RWY 22 BLUE PROP',
        colorKey: 'blue',
        colorHex: 0x2ac3ff,
        thresholdX: 10,
        thresholdY: 125,
        endX: -185,
        endY: -110,
        width: 26,
        snapRadius: 44,
        allowedClasses: ['prop_blue', 'prop_yellow'],
      }),
      buildHelipad({
        id: 'helipad_west',
        label: 'HELIPAD H1 WEST',
        colorKey: 'blue_heli',
        colorHex: 0x38bdf8,
        x: -250,
        y: 15,
        width: 44,
        snapRadius: 40,
        allowedClasses: ['heli_blue'],
      }),
      buildHelipad({
        id: 'helipad_east',
        label: 'HELIPAD H2 EAST',
        colorKey: 'blue_heli',
        colorHex: 0x38bdf8,
        x: 235,
        y: -25,
        width: 44,
        snapRadius: 40,
        allowedClasses: ['heli_blue'],
      }),
    ],
  },

  tropical_island: {
    id: 'tropical_island',
    name: 'Paradise Beach Resort',
    shortName: 'Paradise Beach',
    tabLabel: 'Paradise Beach',
    subtitle: 'Turquoise Coral Lagoon, Mainland Strip & Seaplane Buoys',
    textureKey: 'map_tropical_island',
    texturePath: 'assets/textures/map_tropical_island.png',
    hostessKey: 'hostess_hawaii',
    hostessName: 'Island Hostess Leilani',
    themeColors: {
      groundPrimary: 0x5ca944,
      groundSecondary: 0xe8d29b,
      soilAccent: 0xf3e1b3,
      apronLight: 0xece1ca,
      apronDark: 0xe0d2b6,
      apronBorder: 0xcab896,
      asphaltColor: 0x464543,
      waterColor: 0x1ca3c8,
      lagoonColor: 0x2ee6a8,
      ambientTint: 0xf7fcff,
    },
    windsockPos: { x: -195, y: -35 },
    apronZones: [
      { x: -245, y: -25, width: 165, height: 295, rotation: 0, cornerRadius: 24 },
      { x: 180, y: -18, width: 205, height: 140, rotation: -0.18, cornerRadius: 24 },
    ],
    hangars: [
      {
        id: 'hangar_beach_tower',
        type: 'tower',
        label: 'Coastline Resort Tower',
        x: -180,
        y: 35,
        width: 32,
        depth: 32,
        height: 26,
        rotation: 0,
        roofColor: 0xdccbb0,
        wallColor: 0xf7eedc,
      },
      {
        id: 'hangar_beach_west',
        type: 'hangar',
        label: 'Mainland Jet Pavilion',
        x: -182,
        y: -95,
        width: 48,
        depth: 32,
        height: 17,
        rotation: 0,
        roofColor: 0xcebba0,
        wallColor: 0xf2e6d0,
      },
      {
        id: 'hangar_island_cabana',
        type: 'terminal',
        label: 'Atoll Charter Terminal',
        x: 132,
        y: -52,
        width: 44,
        depth: 28,
        height: 15,
        rotation: -0.22,
        roofColor: 0xd8c6a8,
        wallColor: 0xf6ecda,
      },
      {
        id: 'hangar_seaplane_dock',
        type: 'dock',
        label: 'Lagoon Seaplane Pier',
        x: 145,
        y: 52,
        width: 36,
        depth: 22,
        height: 10,
        rotation: -0.25,
        roofColor: 0xc79d6b,
        wallColor: 0xe5c89e,
      },
    ],
    runways: [
      buildLinearRunway({
        id: 'runway_jet_beach',
        label: 'RWY 18 MAINLAND JET',
        colorKey: 'red',
        colorHex: 0xff3b30,
        thresholdX: -235,
        thresholdY: 115,
        endX: -235,
        endY: -155,
        width: 34,
        snapRadius: 48,
        allowedClasses: ['jet_red'],
      }),
      buildLinearRunway({
        id: 'runway_prop_beach',
        label: 'RWY 14 BEACH PROP',
        colorKey: 'yellow',
        colorHex: 0xffd60a,
        thresholdX: -305,
        thresholdY: -55,
        endX: -220,
        endY: -150,
        width: 25,
        snapRadius: 44,
        allowedClasses: ['prop_yellow', 'prop_blue'],
      }),
      buildLinearRunway({
        id: 'runway_prop_island',
        label: 'RWY 28 ATOLL PROP',
        colorKey: 'blue',
        colorHex: 0x2ac3ff,
        thresholdX: 125,
        thresholdY: -28,
        endX: -35,
        endY: 12,
        width: 26,
        snapRadius: 44,
        allowedClasses: ['prop_blue', 'prop_yellow'],
      }),
      buildLinearRunway({
        id: 'runway_water_channel',
        label: 'LAGOON SEAPLANE CHANNEL',
        colorKey: 'green',
        colorHex: 0x2ee6a8,
        thresholdX: 268,
        thresholdY: 68,
        endX: 418,
        endY: 8,
        width: 30,
        snapRadius: 46,
        isWaterRunway: true,
        allowedClasses: ['seaplane_green'],
      }),
      buildHelipad({
        id: 'helipad_island',
        label: 'RESORT HELIPAD H1',
        colorKey: 'blue_heli',
        colorHex: 0x38bdf8,
        x: 72,
        y: -62,
        width: 44,
        snapRadius: 40,
        allowedClasses: ['heli_blue'],
      }),
    ],
  },

  alpine_winter: {
    id: 'alpine_winter',
    name: 'Alpine Glacier & Peak',
    shortName: 'Alpine Snow',
    tabLabel: 'Alpine Snow',
    subtitle: 'High-Altitude Snowpack, Crosswind Strips & Glacial Fjord',
    textureKey: 'map_alpine_winter',
    texturePath: 'assets/textures/map_alpine_winter.png',
    hostessKey: 'hostess_alpine',
    hostessName: 'Chalet Stewardess Ingrid',
    themeColors: {
      groundPrimary: 0xe5eff7,
      groundSecondary: 0xcbe0f0,
      soilAccent: 0x8ea9be,
      apronLight: 0xdce4ec,
      apronDark: 0xcfd9e3,
      apronBorder: 0xaabac9,
      asphaltColor: 0x3f4347,
      waterColor: 0x1c6e8c,
      lagoonColor: 0x2ee6a8,
      ambientTint: 0xf2f8ff,
    },
    windsockPos: { x: -10, y: 40 },
    apronZones: [
      { x: 15, y: 12, width: 430, height: 245, rotation: 0, cornerRadius: 28 },
      { x: 225, y: 45, width: 105, height: 90, rotation: 0, cornerRadius: 20 },
    ],
    hangars: [
      {
        id: 'hangar_alpine_tower',
        type: 'tower',
        label: 'Glacier Peak Radar Tower',
        x: -55,
        y: 92,
        width: 34,
        depth: 34,
        height: 29,
        rotation: 0.2,
        roofColor: 0xb8c8d8,
        wallColor: 0xeaf1f8,
      },
      {
        id: 'hangar_alpine_east',
        type: 'hangar',
        label: 'Snowcat & De-Icing Hangar',
        x: 195,
        y: -25,
        width: 54,
        depth: 34,
        height: 18,
        rotation: -0.45,
        roofColor: 0xaec0d2,
        wallColor: 0xe3ecf5,
      },
      {
        id: 'hangar_alpine_chalet',
        type: 'terminal',
        label: 'Summit Rescue Chalet',
        x: -165,
        y: -25,
        width: 50,
        depth: 32,
        height: 17,
        rotation: 0.35,
        roofColor: 0x9fb3c7,
        wallColor: 0xe7eff7,
      },
      {
        id: 'hangar_fjord_boathouse',
        type: 'dock',
        label: 'Glacial Fjord Floatplane Dock',
        x: -235,
        y: -145,
        width: 40,
        depth: 24,
        height: 12,
        rotation: -0.24,
        roofColor: 0x8ea4b8,
        wallColor: 0xdce6f0,
      },
    ],
    runways: [
      buildLinearRunway({
        id: 'runway_jet_alpine',
        label: 'RWY 12 GLACIER JET',
        colorKey: 'red',
        colorHex: 0xff3b30,
        thresholdX: -180,
        thresholdY: 95,
        endX: 160,
        endY: -85,
        width: 34,
        snapRadius: 48,
        allowedClasses: ['jet_red'],
      }),
      buildLinearRunway({
        id: 'runway_prop_alpine',
        label: 'RWY 22 CROSSWIND PROP',
        colorKey: 'yellow',
        colorHex: 0xffd60a,
        thresholdX: 145,
        thresholdY: 120,
        endX: -95,
        endY: -110,
        width: 26,
        snapRadius: 44,
        allowedClasses: ['prop_yellow', 'prop_blue'],
      }),
      buildLinearRunway({
        id: 'runway_seaplane_fjord',
        label: 'RWY 11 GREEN SKI STRIP',
        colorKey: 'green',
        colorHex: 0x2ee6a8,
        thresholdX: -285,
        thresholdY: -120,
        endX: -95,
        endY: -200,
        width: 28,
        snapRadius: 46,
        isWaterRunway: false,
        allowedClasses: ['seaplane_green'],
      }),
      buildHelipad({
        id: 'helipad_alpine',
        label: 'ALPINE RESCUE PAD H1',
        colorKey: 'blue_heli',
        colorHex: 0x38bdf8,
        x: 230,
        y: 45,
        width: 44,
        snapRadius: 40,
        allowedClasses: ['heli_blue'],
      }),
    ],
  },
};

// Attach non-enumerable array-like helpers to MAP_DEFINITIONS so callers can use
// either `MAP_DEFINITIONS.classic_outback`, `Object.values(MAP_DEFINITIONS)`,
// `MAP_DEFINITIONS[0]`, `for (const m of MAP_DEFINITIONS)`, or `MAP_DEFINITIONS.find(...)`.
const ORDERED_MAPS = [
  MAP_DEFINITIONS.classic_outback,
  MAP_DEFINITIONS.tropical_island,
  MAP_DEFINITIONS.alpine_winter,
];

Object.defineProperties(MAP_DEFINITIONS, {
  0: { value: ORDERED_MAPS[0], enumerable: false },
  1: { value: ORDERED_MAPS[1], enumerable: false },
  2: { value: ORDERED_MAPS[2], enumerable: false },
  length: { value: ORDERED_MAPS.length, enumerable: false },
  [Symbol.iterator]: {
    value: function* () {
      yield* ORDERED_MAPS;
    },
    enumerable: false,
  },
  find: {
    value: (...args) => ORDERED_MAPS.find(...args),
    enumerable: false,
  },
  map: {
    value: (...args) => ORDERED_MAPS.map(...args),
    enumerable: false,
  },
  forEach: {
    value: (...args) => ORDERED_MAPS.forEach(...args),
    enumerable: false,
  },
  filter: {
    value: (...args) => ORDERED_MAPS.filter(...args),
    enumerable: false,
  },
  get: {
    value: (id) => MAP_DEFINITIONS[id] || ORDERED_MAPS.find((m) => m.id === id) || ORDERED_MAPS[0],
    enumerable: false,
  },
});

/**
 * Traffic Director & Two-Stage Spatial Collision Engine.
 */
export class TrafficAndCollisionDirector {
  static WARNING_RADIUS = WARNING_RADIUS;
  static COLLISION_RADIUS = COLLISION_RADIUS;
  static PERIMETER_LEAD_TIME = PERIMETER_LEAD_TIME;
  static MIN_SPAWN_SEPARATION = MIN_SPAWN_SEPARATION;

  constructor(options = {}, maybeCallbacks = null) {
    let opts = {};
    if (typeof options === 'string') {
      opts = { mapId: options, ...(maybeCallbacks || {}) };
    } else if (options && typeof options === 'object') {
      opts = { ...options };
      if (maybeCallbacks && typeof maybeCallbacks === 'object') {
        opts.callbacks = { ...(opts.callbacks || {}), ...maybeCallbacks };
      }
    }

    this.WARNING_RADIUS = WARNING_RADIUS;
    this.COLLISION_RADIUS = COLLISION_RADIUS;
    this.PERIMETER_LEAD_TIME = PERIMETER_LEAD_TIME;
    this.MIN_SPAWN_SEPARATION = MIN_SPAWN_SEPARATION;

    this.callbacks = {
      onAircraftSpawned: opts.onAircraftSpawned || opts.callbacks?.onAircraftSpawned || null,
      onMidAirCollision: opts.onMidAirCollision || opts.callbacks?.onMidAirCollision || null,
      onProximityWarning: opts.onProximityWarning || opts.callbacks?.onProximityWarning || null,
      onConflictResolved: opts.onConflictResolved || opts.callbacks?.onConflictResolved || null,
      onPerimeterWarningAdded:
        opts.onPerimeterWarningAdded || opts.callbacks?.onPerimeterWarningAdded || null,
    };

    this.aircraftFactory =
      opts.aircraftFactory ||
      opts.createAircraft ||
      opts.callbacks?.createAircraft ||
      null;

    this.currentMapId = opts.mapId && MAP_DEFINITIONS[opts.mapId] ? opts.mapId : 'classic_outback';
    this.currentMap = MAP_DEFINITIONS[this.currentMapId];

    this.activePlanes = Array.isArray(opts.activePlanes) ? opts.activePlanes : [];
    this.pendingSpawns = [];
    this.activeConflicts = [];
    this.activeConflictKeys = new Set();
    this.activeConflictCount = 0;

    this.landedCount = 0;
    this.roundNumber = 1;
    this.elapsedTime = 0;
    this.spawnTimer = 4.2;
    this.fastForwardActive = false;
    this.isGameOver = false;
    this.lastCrashEvent = null;

    this._nextSpawnSeq = 1;
    this._nextPlaneSeq = 1;
    this._lastSpawnedClassId = null;
  }

  /**
   * Updates or merges event callbacks at runtime.
   */
  setCallbacks(callbacks = {}) {
    if (!callbacks || typeof callbacks !== 'object') return;
    Object.assign(this.callbacks, callbacks);
  }

  /**
   * Returns a map definition by ID (defaults to `classic_outback`).
   */
  getMapDefinition(mapId = this.currentMapId) {
    if (mapId && typeof mapId === 'object' && mapId.id && Array.isArray(mapId.runways)) {
      return mapId;
    }
    return MAP_DEFINITIONS[mapId] || MAP_DEFINITIONS.classic_outback;
  }

  /**
   * Returns the active map definition.
   */
  getCurrentMap() {
    return this.currentMap;
  }

  /**
   * Returns the active map's runway definitions.
   */
  getRunways() {
    return this.currentMap?.runways || [];
  }

  /**
   * Resolves the aircraft class dictionary from `window.AIRCRAFT_CLASSES` or fallback specs.
   */
  getAircraftClassSpecs() {
    if (typeof window !== 'undefined' && window.AIRCRAFT_CLASSES) {
      return window.AIRCRAFT_CLASSES;
    }
    return DEFAULT_CLASS_SPECS;
  }

  /**
   * Returns the list of distinct aircraft class IDs supported by the current map's runways.
   */
  getAllowedClassesForMap(mapDef = this.currentMap) {
    const allowedSet = new Set();
    const specs = this.getAircraftClassSpecs();
    for (const runway of mapDef?.runways || []) {
      for (const cls of runway.allowedClasses || []) {
        if (specs[cls] || DEFAULT_CLASS_SPECS[cls]) {
          allowedSet.add(cls);
        }
      }
    }
    if (allowedSet.size === 0) {
      return ['jet_red', 'prop_yellow', 'heli_blue'];
    }
    return Array.from(allowedSet);
  }

  /**
   * Resets director state for the specified map and spawns:
   * - 2 initial aircraft already flying in well-separated quadrants with gentle inward vectors
   * - 1 perimeter `!` warning (`timer: 3.0s`)
   * so the airspace is immediately alive, readable, and fun from frame 1.
   */
  resetForMap(mapId = 'classic_outback', options = {}) {
    const resolvedMap = this.getMapDefinition(mapId);
    this.currentMapId = resolvedMap.id;
    this.currentMap = resolvedMap;

    if (Array.isArray(options)) {
      this.activePlanes = options;
      this.activePlanes.length = 0;
      options = {};
    } else if (Array.isArray(options?.activePlanes)) {
      this.activePlanes = options.activePlanes;
      this.activePlanes.length = 0;
    } else if (Array.isArray(this.activePlanes)) {
      this.activePlanes.length = 0;
    } else {
      this.activePlanes = [];
    }

    this.pendingSpawns = [];
    this.activeConflicts = [];
    this.activeConflictKeys.clear();
    this.activeConflictCount = 0;

    this.landedCount = 0;
    this.roundNumber = 1;
    this.elapsedTime = 0;
    this.spawnTimer = 4.6;
    this.fastForwardActive = false;
    this.isGameOver = false;
    this.lastCrashEvent = null;
    this._lastSpawnedClassId = null;

    if (!options?.skipInitialSpawn) {
      this._spawnInitialBootTraffic();
    }

    return {
      map: this.currentMap,
      activePlanes: this.activePlanes,
      pendingSpawns: this.pendingSpawns,
    };
  }

  /**
   * Alias for `resetForMap` if called as `setMap(mapId)` or `startMap(mapId)`.
   */
  setMap(mapId, options = {}) {
    return this.resetForMap(mapId, options);
  }

  /**
   * Spawns the 2 initial flying aircraft in well-separated quadrants + 1 perimeter `!` warning.
   * Safe and idempotent if called immediately after `resetForMap`.
   */
  spawnInitialTraffic() {
    if (this.activePlanes.length === 0 && this.pendingSpawns.length === 0) {
      this._spawnInitialBootTraffic();
    }
    return {
      activePlanes: this.activePlanes,
      pendingSpawns: this.pendingSpawns,
    };
  }

  _spawnInitialBootTraffic() {
    const mapId = this.currentMapId;

    // Carefully chosen initial quadrant placements per map so neither plane starts
    // inside a runway threshold capture zone, while both are >420 world units apart
    // and cruising smoothly inward across the airspace.
    let initialConfigs;
    if (mapId === 'tropical_island') {
      initialConfigs = [
        {
          classId: 'jet_red',
          x: -355,
          y: 185,
          heading: Math.atan2(-20 - 185, -60 - -355),
        },
        {
          classId: 'seaplane_green',
          x: 325,
          y: 175,
          heading: Math.atan2(45 - 175, 40 - 325),
        },
      ];
    } else if (mapId === 'alpine_winter') {
      initialConfigs = [
        {
          classId: 'jet_red',
          x: -340,
          y: 180,
          heading: Math.atan2(20 - 180, -30 - -340),
        },
        {
          classId: 'prop_yellow',
          x: 315,
          y: -165,
          heading: Math.atan2(25 - -165, 35 - 315),
        },
      ];
    } else {
      // classic_outback
      initialConfigs = [
        {
          classId: 'jet_red',
          x: -325,
          y: 175,
          heading: Math.atan2(35 - 175, -20 - -325),
        },
        {
          classId: 'prop_yellow',
          x: 315,
          y: 165,
          heading: Math.atan2(-35 - 165, 35 - 315),
        },
      ];
    }

    for (const cfg of initialConfigs) {
      const plane = this._instantiateAircraft(cfg.classId, cfg.x, cfg.y, cfg.heading, {
        hasEnteredAirspace: true,
        isInitialSpawn: true,
      });
      if (!this.activePlanes.includes(plane)) {
        this.activePlanes.push(plane);
      }
      if (typeof this.callbacks.onAircraftSpawned === 'function') {
        this.callbacks.onAircraftSpawned(plane, { initialInFlight: true });
      }
    }

    // Schedule 1 initial perimeter `!` warning (`timer: 3.0s`) on a well-separated edge
    const thirdClass =
      mapId === 'tropical_island'
        ? 'prop_yellow'
        : mapId === 'alpine_winter'
        ? 'seaplane_green'
        : 'prop_blue';
    this.schedulePerimeterSpawn({
      classId: thirdClass,
      timer: PERIMETER_LEAD_TIME,
      preferredEdge: 'BOTTOM',
    });
  }

  /**
   * Instantiates an aircraft entity compatible with `FlightKinematicsSystem` (`AircraftEntity`)
   * and `FlightRenderEngine`.
   */
  _instantiateAircraft(classId, x, y, heading, extraProps = {}) {
    const specs = this.getAircraftClassSpecs();
    const classSpec = specs[classId] || DEFAULT_CLASS_SPECS[classId] || DEFAULT_CLASS_SPECS.prop_yellow;
    const resolvedClassId = classSpec.id || classId;
    const planeId = extraProps.id || `plane_${this._nextPlaneSeq++}`;

    // Determine primary runwayColor and whether the active map shares a yellow/blue prop strip
    let runwayColor = classSpec.runwayColor;
    const mapRunways = this.currentMap?.runways || [];
    const hasExactColorRunway = mapRunways.some((r) => r.colorKey === runwayColor);
    const compatibleRunways = mapRunways.filter(
      (r) =>
        r.colorKey === runwayColor ||
        (Array.isArray(r.allowedClasses) && r.allowedClasses.includes(resolvedClassId))
    );
    if (!hasExactColorRunway && compatibleRunways.length > 0) {
      // e.g. `prop_blue` on `alpine_winter` where `runway_prop_alpine` is yellow
      runwayColor = compatibleRunways[0].colorKey;
    }

    let plane = null;

    const GlobalAircraftCtor =
      (typeof window !== 'undefined' && typeof window.AircraftEntity === 'function'
        ? window.AircraftEntity
        : null) ||
      (typeof globalThis !== 'undefined' && typeof globalThis.AircraftEntity === 'function'
        ? globalThis.AircraftEntity
        : null);

    if (typeof this.aircraftFactory === 'function') {
      plane = this.aircraftFactory({
        id: planeId,
        classId: resolvedClassId,
        x,
        y,
        heading,
        ...classSpec,
        runwayColor,
        ...extraProps,
      });
    } else if (typeof GlobalAircraftCtor === 'function') {
      try {
        const candidate = new GlobalAircraftCtor({
          id: planeId,
          classId: resolvedClassId,
          type: resolvedClassId,
          x,
          y,
          heading,
          ...classSpec,
          runwayColor,
          ...extraProps,
        });
        if (candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y)) {
          plane = candidate;
        } else {
          plane = new GlobalAircraftCtor(resolvedClassId, x, y, heading, planeId);
        }
      } catch (_err) {
        plane = new GlobalAircraftCtor(resolvedClassId, x, y, heading, planeId);
      }
    }

    if (!plane || typeof plane !== 'object') {
      plane = {};
    }

    // Guarantee all required kinematic, pathing, collision, and visual fields exist
    plane.id = plane.id || planeId;
    plane.classId = resolvedClassId;
    plane.type = resolvedClassId;
    plane.aircraftClass = resolvedClassId;
    plane.name = plane.name || classSpec.name;
    plane.runwayColor = runwayColor;
    plane.originalRunwayColor = classSpec.runwayColor;
    plane.compatibleRunwayIds = compatibleRunways.map((r) => r.id);
    plane.spriteKey = plane.spriteKey || classSpec.spriteKey;
    plane.baseSpeed = Number.isFinite(plane.baseSpeed) ? plane.baseSpeed : classSpec.speed;
    plane.speed = Number.isFinite(plane.speed) ? plane.speed : classSpec.speed;
    plane.maxTurnRate = Number.isFinite(plane.maxTurnRate) ? plane.maxTurnRate : classSpec.maxTurnRate;
    plane.maxBankRad = Number.isFinite(plane.maxBankRad) ? plane.maxBankRad : classSpec.maxBankRad;
    plane.scale = Number.isFinite(plane.scale) ? plane.scale : classSpec.scale;
    plane.baseScale = Number.isFinite(plane.baseScale) ? plane.baseScale : plane.scale;
    plane.shadowBaseOffset = Number.isFinite(plane.shadowBaseOffset)
      ? plane.shadowBaseOffset
      : classSpec.shadowBaseOffset;
    plane.hasPropeller = Boolean(plane.hasPropeller ?? classSpec.hasPropeller);
    plane.hasRotor = Boolean(plane.hasRotor ?? classSpec.hasRotor);
    plane.colorHex = plane.colorHex ?? classSpec.colorHex;
    plane.colorCss = plane.colorCss || hexToCss(plane.colorHex);

    plane.x = Number(x);
    plane.y = Number(y);
    plane.heading = normalizeAngle(Number(heading));
    plane.desiredHeading = plane.heading;
    plane.vx = Math.cos(plane.heading) * plane.speed;
    plane.vy = Math.sin(plane.heading) * plane.speed;
    plane.turnRate = Number.isFinite(plane.turnRate) ? plane.turnRate : 0;
    plane.bankAngle = Number.isFinite(plane.bankAngle) ? plane.bankAngle : 0;
    plane.altitude = Number.isFinite(plane.altitude) ? plane.altitude : 1.0;
    plane.visualScale = Number.isFinite(plane.visualScale) ? plane.visualScale : 1.0;
    plane.opacity = Number.isFinite(plane.opacity) ? plane.opacity : 1.0;
    plane.shadowOffsetX = Number.isFinite(plane.shadowOffsetX)
      ? plane.shadowOffsetX
      : plane.shadowBaseOffset;
    plane.shadowOffsetY = Number.isFinite(plane.shadowOffsetY)
      ? plane.shadowOffsetY
      : -plane.shadowBaseOffset;
    plane.propAngle = Number.isFinite(plane.propAngle) ? plane.propAngle : 0;
    plane.flightTime = Number.isFinite(plane.flightTime) ? plane.flightTime : 0;

    plane.state = plane.state || 'FLYING';
    plane.pathWaypoints = Array.isArray(plane.pathWaypoints) ? plane.pathWaypoints : [];
    plane.isLockedToRunway = Boolean(plane.isLockedToRunway);
    plane.lockedRunwayId = plane.lockedRunwayId || null;
    plane.landingRunway = plane.landingRunway || null;
    plane.landingProgress = Number.isFinite(plane.landingProgress) ? plane.landingProgress : 0;
    plane.landingDuration = Number.isFinite(plane.landingDuration) ? plane.landingDuration : 1.65;
    plane.touchdownStartX = plane.x;
    plane.touchdownStartY = plane.y;
    plane.touchdownStartHeading = plane.heading;
    plane.isSelected = Boolean(plane.isSelected);
    plane.isHovered = Boolean(plane.isHovered);
    plane.invalidApproachFlash = Number.isFinite(plane.invalidApproachFlash)
      ? plane.invalidApproachFlash
      : 0;

    plane.inProximityWarning = false;
    plane.conflictPartners = [];
    plane.closestConflictDist = Infinity;
    plane.proximitySeverity = 0;
    plane.isCrashed = false;

    const insidePlayfield = Math.abs(plane.x) <= 445 && Math.abs(plane.y) <= 285;
    plane.hasEnteredAirspace = Boolean(extraProps.hasEnteredAirspace ?? insidePlayfield);
    plane.isTurningBackFromEdge = Boolean(plane.isTurningBackFromEdge);

    // Ensure helper methods exist even if constructed without AircraftEntity
    if (typeof plane.getShadowOffset !== 'function') {
      plane.getShadowOffset = function () {
        const alt = clamp(this.altitude, 0, 1);
        const dist = 1.5 + (this.shadowBaseOffset - 1.5) * alt;
        return { x: dist, y: -dist, distance: dist };
      };
    }
    if (typeof plane.getEffectiveScale !== 'function') {
      plane.getEffectiveScale = function () {
        return this.scale * this.visualScale;
      };
    }
    if (typeof plane.setPath !== 'function') {
      plane.setPath = function (waypoints, isLocked = false, lockedRunwayId = null) {
        if (this.state !== 'FLYING') return;
        this.pathWaypoints = Array.isArray(waypoints)
          ? waypoints.map((pt) => ({ x: Number(pt.x), y: Number(pt.y) }))
          : [];
        this.isLockedToRunway = Boolean(isLocked);
        this.lockedRunwayId = isLocked ? lockedRunwayId : null;
      };
    }
    if (typeof plane.clearPath !== 'function') {
      plane.clearPath = function () {
        this.pathWaypoints = [];
        this.isLockedToRunway = false;
        this.lockedRunwayId = null;
      };
    }

    return plane;
  }

  /**
   * Selects an aircraft class supported by the active map's runways, weighting early rounds
   * toward friendly props/jets and introducing mixed-speed overtakes as `landedCount` and
   * `roundNumber` increase.
   */
  pickSpawnClassId(activePlanes = this.activePlanes) {
    const allowed = this.getAllowedClassesForMap(this.currentMap);
    if (allowed.length === 0) return 'jet_red';

    // Count currently active + pending per class to avoid starving any runway
    const counts = {};
    for (const cls of allowed) counts[cls] = 0;
    for (const p of activePlanes || []) {
      if (p && p.state === 'FLYING' && counts[p.classId] !== undefined) {
        counts[p.classId] += 1;
      }
    }
    for (const sp of this.pendingSpawns) {
      if (counts[sp.classId] !== undefined) {
        counts[sp.classId] += 1;
      }
    }

    const isEarlyRound = this.landedCount < 5 && this.roundNumber <= 2;

    // Check if a slower aircraft recently entered so we can introduce a classic
    // mixed-speed overtake (`jet_red` or `seaplane_green` behind `prop_yellow` / `heli_blue`)
    const hasSlowPlaneInAir = (activePlanes || []).some(
      (p) =>
        p &&
        p.state === 'FLYING' &&
        (p.classId === 'heli_blue' || p.classId === 'prop_blue' || p.classId === 'prop_yellow')
    );

    const weights = allowed.map((cls) => {
      let w = 1.0;
      if (isEarlyRound) {
        if (cls === 'prop_yellow' || cls === 'jet_red' || cls === 'seaplane_green') w = 1.9;
        else if (cls === 'prop_blue') w = 1.4;
        else if (cls === 'heli_blue') w = 0.75;
      } else {
        // Later rounds: boost mixed-speed overtake pairs (fast jets + nimble slow rotorcraft)
        if (cls === 'jet_red') {
          w = hasSlowPlaneInAir ? 2.2 : 1.5;
        } else if (cls === 'heli_blue') {
          w = 1.35;
        } else if (cls === 'seaplane_green') {
          w = 1.45;
        } else {
          w = 1.25;
        }
      }

      // On alpine_winter, runway_prop_alpine is yellow so weight prop_yellow higher than prop_blue
      if (this.currentMapId === 'alpine_winter' && cls === 'prop_blue') {
        w *= 0.45;
      }

      // Gently penalize over-represented classes so traffic stays varied
      w /= 1 + counts[cls] * 0.45;

      // Avoid repeating the exact same class 3 times in a row when other classes exist
      if (allowed.length > 1 && cls === this._lastSpawnedClassId) {
        w *= 0.62;
      }

      return Math.max(0.1, w);
    });

    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let r = Math.random() * totalWeight;
    for (let i = 0; i < allowed.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        this._lastSpawnedClassId = allowed[i];
        return allowed[i];
      }
    }
    const chosen = allowed[allowed.length - 1];
    this._lastSpawnedClassId = chosen;
    return chosen;
  }

  /**
   * Computes minimum Euclidean distance from `(x, y)` to any active flying aircraft
   * or pending perimeter spawn marker.
   */
  _getMinSeparationFromTraffic(x, y, activePlanes = this.activePlanes) {
    let minDist = Infinity;

    for (const plane of activePlanes || []) {
      if (!plane || plane.state === 'LANDED') continue;
      const d = Math.hypot(plane.x - x, plane.y - y);
      if (d < minDist) minDist = d;
    }

    for (const pending of this.pendingSpawns) {
      const dSpawn = Math.hypot(pending.spawnX - x, pending.spawnY - y);
      const dEdge = Math.hypot(pending.edgeX - x, pending.edgeY - y);
      const d = Math.min(dSpawn, dEdge);
      if (d < minDist) minDist = d;
    }

    return minDist;
  }

  /**
   * Picks a safe perimeter entry point along the 4 edges (`x = ±462` or `y = ±302`)
   * that is at least `135` world units (`MIN_SPAWN_SEPARATION`) away from any active
   * flying aircraft or pending spawn marker, with `entryHeading` aimed roughly inward
   * toward a randomized interior point `(±160, ±100)`.
   */
  pickSafePerimeterEntry(activePlanes = this.activePlanes, options = {}) {
    const edges = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];
    const preferredEdge = options.preferredEdge;
    const classId = options.classId || 'jet_red';

    // In later rounds, if spawning a fast `jet_red`, see if we can align behind a slower plane
    // for an exciting mixed-speed overtake (while still maintaining >= 135 units separation!)
    let overtakeTarget = null;
    if (
      (this.roundNumber >= 2 || this.landedCount >= 5) &&
      classId === 'jet_red' &&
      Math.random() < 0.38
    ) {
      const slowPlanes = (activePlanes || []).filter(
        (p) =>
          p &&
          p.state === 'FLYING' &&
          p.speed < 60 &&
          Math.hypot(p.x, p.y) > 120 &&
          Math.hypot(p.x, p.y) < 330
      );
      if (slowPlanes.length > 0) {
        overtakeTarget = slowPlanes[Math.floor(Math.random() * slowPlanes.length)];
      }
    }

    let bestCandidate = null;
    let bestScore = -Infinity;

    const totalCandidates = 52;
    for (let attempt = 0; attempt < totalCandidates; attempt++) {
      let edge;
      if (attempt < 8 && preferredEdge && edges.includes(preferredEdge)) {
        edge = preferredEdge;
      } else {
        edge = edges[attempt % edges.length];
      }

      let spawnX = 0;
      let spawnY = 0;
      if (edge === 'TOP') {
        spawnX = (Math.random() * 2 - 1) * 405;
        spawnY = PERIMETER_SPAWN_Y;
      } else if (edge === 'BOTTOM') {
        spawnX = (Math.random() * 2 - 1) * 405;
        spawnY = -PERIMETER_SPAWN_Y;
      } else if (edge === 'LEFT') {
        spawnX = -PERIMETER_SPAWN_X;
        spawnY = (Math.random() * 2 - 1) * 255;
      } else {
        spawnX = PERIMETER_SPAWN_X;
        spawnY = (Math.random() * 2 - 1) * 255;
      }

      const minTrafficDist = this._getMinSeparationFromTraffic(spawnX, spawnY, activePlanes);

      // Measure distance to closest runway threshold so we don't spawn right on top of a threshold
      let minThresholdDist = Infinity;
      for (const rwy of this.currentMap?.runways || []) {
        const dRwy = Math.hypot(rwy.thresholdX - spawnX, rwy.thresholdY - spawnY);
        if (dRwy < minThresholdDist) minThresholdDist = dRwy;
      }

      // Aim inward toward a randomized interior point (±160, ±100)
      let targetX = (Math.random() * 2 - 1) * 160;
      let targetY = (Math.random() * 2 - 1) * 100;

      if (overtakeTarget && minTrafficDist >= MIN_SPAWN_SEPARATION) {
        const distToSlow = Math.hypot(overtakeTarget.x - spawnX, overtakeTarget.y - spawnY);
        if (distToSlow >= MIN_SPAWN_SEPARATION && distToSlow <= 265) {
          targetX = clamp(overtakeTarget.x + Math.cos(overtakeTarget.heading) * 90, -160, 160);
          targetY = clamp(overtakeTarget.y + Math.sin(overtakeTarget.heading) * 90, -100, 100);
        }
      }

      const entryHeading = Math.atan2(targetY - spawnY, targetX - spawnX);

      // Score candidate: strongly require minTrafficDist >= MIN_SPAWN_SEPARATION (135 units)
      let score = minTrafficDist;
      if (minTrafficDist < MIN_SPAWN_SEPARATION) {
        score -= (MIN_SPAWN_SEPARATION - minTrafficDist) * 10;
      }
      if (minThresholdDist < 95) {
        score -= (95 - minThresholdDist) * 3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = {
          edge,
          spawnX,
          spawnY,
          edgeX: clamp(spawnX, -BADGE_CLAMP_X, BADGE_CLAMP_X),
          edgeY: clamp(spawnY, -BADGE_CLAMP_Y, BADGE_CLAMP_Y),
          entryHeading,
          targetX,
          targetY,
          minTrafficDist,
        };
      }

      // Early accept if well-separated (>= 210 units from all traffic and >= 110 from thresholds)
      if (minTrafficDist >= 210 && minThresholdDist >= 110 && attempt >= 6) {
        break;
      }
    }

    return bestCandidate;
  }

  /**
   * Schedules a new perimeter warning (`!`) entry with 3.0s lead time (`PERIMETER_LEAD_TIME`).
   */
  schedulePerimeterSpawn(options = {}) {
    const classId = options.classId || this.pickSpawnClassId(this.activePlanes);
    const specs = this.getAircraftClassSpecs();
    const classSpec = specs[classId] || DEFAULT_CLASS_SPECS[classId] || DEFAULT_CLASS_SPECS.prop_yellow;

    const entry = this.pickSafePerimeterEntry(this.activePlanes, {
      classId,
      preferredEdge: options.preferredEdge,
    });

    if (!entry) return null;

    // Require strict 135-unit separation unless forced (e.g. stress test)
    if (!options.allowCrowded && entry.minTrafficDist < MIN_SPAWN_SEPARATION && this.activePlanes.length > 0) {
      return null;
    }

    const maxTimer = Number.isFinite(options.timer) ? Math.max(0.05, options.timer) : PERIMETER_LEAD_TIME;
    const spawnEntry = {
      id: `warn_${this._nextSpawnSeq++}`,
      classId,
      aircraftClass: classId,
      edge: entry.edge,
      edgeX: entry.edgeX,
      edgeY: entry.edgeY,
      badgeX: entry.edgeX,
      badgeY: entry.edgeY,
      x: entry.edgeX,
      y: entry.edgeY,
      spawnX: entry.spawnX,
      spawnY: entry.spawnY,
      entryHeading: entry.entryHeading,
      heading: entry.entryHeading,
      targetX: entry.targetX,
      targetY: entry.targetY,
      timer: maxTimer,
      maxTimer,
      progress: 0,
      urgency: 0,
      colorHex: classSpec.colorHex ?? 0xff3b30,
      colorCss: hexToCss(classSpec.colorHex ?? 0xff3b30),
      runwayColor: classSpec.runwayColor || 'red',
    };

    this.pendingSpawns.push(spawnEntry);

    if (typeof this.callbacks.onPerimeterWarningAdded === 'function') {
      this.callbacks.onPerimeterWarningAdded(spawnEntry);
    }

    return spawnEntry;
  }

  /**
   * Spawns a pending perimeter entry into an active flying aircraft and invokes `onAircraftSpawned`.
   */
  _commitPendingSpawn(pending) {
    const plane = this._instantiateAircraft(
      pending.classId,
      pending.spawnX,
      pending.spawnY,
      pending.entryHeading,
      {
        hasEnteredAirspace: false,
        spawnId: pending.id,
      }
    );

    if (!this.activePlanes.includes(plane)) {
      this.activePlanes.push(plane);
    }

    if (typeof this.callbacks.onAircraftSpawned === 'function') {
      this.callbacks.onAircraftSpawned(plane, pending);
    }

    return plane;
  }

  /**
   * Debug / Rush Wave helper (`spawnRushWave(count)`) to stress-test up to 15+ simultaneous
   * aircraft and trigger the high-density Big-Band Swing state cleanly without spawning
   * planes on top of each other.
   */
  spawnRushWave(count = 6, options = {}) {
    const total = clamp(Math.floor(Number(count) || 6), 1, 20);
    const spawnedPlanes = [];
    const scheduledWarnings = [];

    const warningsOnly = Boolean(options.warningsOnly);
    const immediateOnly = Boolean(options.immediate);

    // By default, spawn ~65% immediately along well-separated perimeter ring positions
    // and ~35% as rapid perimeter `!` warnings so both active plane count (15+) and
    // perimeter warning badges are immediately active.
    const immediateCount = warningsOnly
      ? 0
      : immediateOnly
      ? total
      : Math.ceil(total * 0.65);

    for (let i = 0; i < total; i++) {
      const classId = this.pickSpawnClassId(this.activePlanes);
      const entry = this.pickSafePerimeterEntry(this.activePlanes, { classId });
      if (!entry) continue;

      if (i < immediateCount) {
        // Place slightly inside the perimeter so the aircraft is immediately visible in flight
        const inset = 22 + (i % 3) * 14;
        const x = clamp(
          entry.spawnX + Math.cos(entry.entryHeading) * inset,
          -PERIMETER_SPAWN_X + 8,
          PERIMETER_SPAWN_X - 8
        );
        const y = clamp(
          entry.spawnY + Math.sin(entry.entryHeading) * inset,
          -PERIMETER_SPAWN_Y + 8,
          PERIMETER_SPAWN_Y - 8
        );
        const plane = this._instantiateAircraft(classId, x, y, entry.entryHeading, {
          hasEnteredAirspace: Math.abs(x) <= 445 && Math.abs(y) <= 285,
          isRushWave: true,
        });
        if (!this.activePlanes.includes(plane)) {
          this.activePlanes.push(plane);
        }
        if (typeof this.callbacks.onAircraftSpawned === 'function') {
          this.callbacks.onAircraftSpawned(plane, { isRushWave: true });
        }
        spawnedPlanes.push(plane);
      } else {
        const staggerTimer = clamp(0.6 + (i - immediateCount) * 0.35, 0.4, PERIMETER_LEAD_TIME);
        const warn = this.schedulePerimeterSpawn({
          classId,
          timer: staggerTimer,
          allowCrowded: true,
        });
        if (warn) scheduledWarnings.push(warn);
      }
    }

    return {
      spawnedPlanes,
      scheduledWarnings,
      totalActive: this.activePlanes.length,
      totalPending: this.pendingSpawns.length,
    };
  }

  /**
   * Records a completed landing and advances round pacing escalation.
   */
  recordLanding(plane = null, runway = null) {
    this.landedCount += 1;
    this.roundNumber = 1 + Math.floor(this.landedCount / 5) + Math.floor(this.elapsedTime / 45);
    return this.landedCount;
  }

  /**
   * Alias for `recordLanding`.
   */
  onAircraftLanded(plane = null, runway = null) {
    return this.recordLanding(plane, runway);
  }

  /**
   * Sets `fastForwardActive` state (`>>` button).
   */
  setFastForward(active) {
    this.fastForwardActive = Boolean(active);
  }

  /**
   * High-Density / Big-Band Swing Trigger:
   * Returns true when `activePlanes.length >= 7` or `fastForwardActive` or
   * `activeConflictCount > 0` or `activePlanes.length >= 15`.
   */
  isHighDensityAirspace(activePlanes = this.activePlanes) {
    const planes = Array.isArray(activePlanes) ? activePlanes : this.activePlanes;
    const flyingCount = planes.filter((p) => p && (!p.state || p.state === 'FLYING')).length;
    return (
      flyingCount >= 7 ||
      planes.length >= 7 ||
      planes.length >= 15 ||
      Boolean(this.fastForwardActive) ||
      this.activeConflictCount > 0
    );
  }

  /**
   * Computes current target concurrent aircraft cap and spawn interval (in seconds)
   * based on `landedCount` and `roundNumber`.
   */
  _getPacingTargets() {
    this.roundNumber = 1 + Math.floor(this.landedCount / 5) + Math.floor(this.elapsedTime / 45);
    const targetCap = clamp(3 + Math.floor(this.landedCount / 3) + Math.floor(this.roundNumber * 0.7), 3, 14);
    const baseInterval = clamp(
      5.8 - this.landedCount * 0.11 - (this.roundNumber - 1) * 0.35,
      2.0,
      5.8
    );
    return { targetCap, baseInterval };
  }

  /**
   * Two-Stage Spatial Collision Engine (`WARNING_RADIUS = 64`, `COLLISION_RADIUS = 22`).
   * Evaluates all pairs `(planeA, planeB)` where BOTH have `state === 'FLYING'`.
   * Aircraft in `state === 'LANDING'` on the runway glide-slope are safe from mid-air collisions.
   */
  evaluateCollisions(activePlanes = this.activePlanes) {
    const planes = Array.isArray(activePlanes) ? activePlanes : this.activePlanes;

    // 1. Reset per-aircraft proximity warning state every frame
    for (let i = 0; i < planes.length; i++) {
      const plane = planes[i];
      if (!plane) continue;
      plane.inProximityWarning = false;
      plane.conflictPartners = [];
      plane.closestConflictDist = Infinity;
      plane.proximitySeverity = 0;
    }

    // 2. Collect all eligible `FLYING` aircraft
    const flyingPlanes = [];
    for (let i = 0; i < planes.length; i++) {
      const p = planes[i];
      if (p && p.state === 'FLYING' && !p.isCrashed) {
        flyingPlanes.push(p);
      }
    }

    const currentConflicts = [];
    const currentConflictKeys = new Set();
    const newConflicts = [];
    let crashEvent = null;

    // 3. Pairwise Euclidean distance evaluation
    for (let i = 0; i < flyingPlanes.length; i++) {
      const planeA = flyingPlanes[i];
      for (let j = i + 1; j < flyingPlanes.length; j++) {
        const planeB = flyingPlanes[j];
        const dist = Math.hypot(planeA.x - planeB.x, planeA.y - planeB.y);

        if (dist < planeA.closestConflictDist) planeA.closestConflictDist = dist;
        if (dist < planeB.closestConflictDist) planeB.closestConflictDist = dist;

        // Stage 2 — Fatal Mid-Air Collision (`dist <= 22` world units)
        if (dist <= COLLISION_RADIUS) {
          planeA.isCrashed = true;
          planeB.isCrashed = true;
          planeA.inProximityWarning = true;
          planeB.inProximityWarning = true;
          planeA.proximitySeverity = 1.0;
          planeB.proximitySeverity = 1.0;
          planeA.conflictPartners.push(planeB);
          planeB.conflictPartners.push(planeA);

          const crashX = (planeA.x + planeB.x) * 0.5;
          const crashY = (planeA.y + planeB.y) * 0.5;
          crashEvent = {
            x: crashX,
            y: crashY,
            midX: crashX,
            midY: crashY,
            dist,
            planeA,
            planeB,
            mapId: this.currentMapId,
            timestamp: this.elapsedTime,
          };
          this.isGameOver = true;
          this.lastCrashEvent = crashEvent;

          if (typeof this.callbacks.onMidAirCollision === 'function') {
            this.callbacks.onMidAirCollision(crashEvent);
          }
          break;
        }

        // Stage 1 — Proximity Hazard Warning (`22 < dist <= 64` world units)
        if (dist > COLLISION_RADIUS && dist <= WARNING_RADIUS) {
          planeA.inProximityWarning = true;
          planeB.inProximityWarning = true;
          planeA.conflictPartners.push(planeB);
          planeB.conflictPartners.push(planeA);

          const severity = clamp(1 - (dist - COLLISION_RADIUS) / (WARNING_RADIUS - COLLISION_RADIUS), 0, 1);
          if (severity > planeA.proximitySeverity) planeA.proximitySeverity = severity;
          if (severity > planeB.proximitySeverity) planeB.proximitySeverity = severity;

          const midX = (planeA.x + planeB.x) * 0.5;
          const midY = (planeA.y + planeB.y) * 0.5;
          const idA = String(planeA.id || i);
          const idB = String(planeB.id || j);
          const pairKey = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
          const isNew = !this.activeConflictKeys.has(pairKey);

          const conflict = {
            id: pairKey,
            key: pairKey,
            planeA,
            planeB,
            dist,
            distance: dist,
            midX,
            midY,
            x: midX,
            y: midY,
            severity,
            isNew,
          };

          currentConflicts.push(conflict);
          currentConflictKeys.add(pairKey);
          if (isNew) {
            newConflicts.push(conflict);
          }
        }
      }

      if (crashEvent) break;
    }

    // Sort conflicts so the closest/most urgent pair is first
    currentConflicts.sort((a, b) => a.dist - b.dist);

    const hadConflictsBefore = this.activeConflictKeys.size > 0;
    this.activeConflicts = currentConflicts;
    this.activeConflictKeys = currentConflictKeys;
    this.activeConflictCount = currentConflicts.length;

    if (!crashEvent && newConflicts.length > 0 && typeof this.callbacks.onProximityWarning === 'function') {
      this.callbacks.onProximityWarning(this.activeConflicts, newConflicts);
    } else if (
      !crashEvent &&
      hadConflictsBefore &&
      currentConflicts.length === 0 &&
      typeof this.callbacks.onConflictResolved === 'function'
    ) {
      this.callbacks.onConflictResolved();
    }

    return {
      crashEvent,
      activeConflicts: this.activeConflicts,
      newConflicts,
      isHighDensity: this.isHighDensityAirspace(planes),
    };
  }

  /**
   * Main per-frame update step.
   * Supports both `update(dt, activePlanes, options)` and `update(activePlanes, dt, options)`.
   */
  update(arg1, arg2 = null, arg3 = {}) {
    let dt = 0.016;
    let activePlanes = null;
    let options = {};

    if (Array.isArray(arg1)) {
      activePlanes = arg1;
      if (typeof arg2 === 'number') {
        dt = arg2;
        options = arg3 && typeof arg3 === 'object' ? arg3 : {};
      } else if (arg2 && typeof arg2 === 'object') {
        options = arg2;
      }
    } else {
      dt = Number(arg1) || 0;
      if (Array.isArray(arg2)) {
        activePlanes = arg2;
        options = arg3 && typeof arg3 === 'object' ? arg3 : {};
      } else if (arg2 && typeof arg2 === 'object') {
        options = arg2;
      }
    }

    if (Array.isArray(activePlanes) && activePlanes !== this.activePlanes) {
      this.activePlanes = activePlanes;
    }
    if (options && typeof options === 'object') {
      if (typeof options.fastForwardActive === 'boolean') {
        this.fastForwardActive = options.fastForwardActive;
      }
      if (Number.isFinite(options.landedCount)) {
        this.landedCount = options.landedCount;
      }
    }

    const safeDt = clamp(Number(dt) || 0, 0, 10.0);
    if (this.isGameOver) {
      return {
        crashEvent: this.lastCrashEvent,
        activeConflicts: this.activeConflicts,
        pendingSpawns: this.pendingSpawns,
        isHighDensity: this.isHighDensityAirspace(this.activePlanes),
      };
    }

    this.elapsedTime += safeDt;

    // Prune completed `LANDED` aircraft if requested (`options.autoPruneLanded === true`)
    if (options?.autoPruneLanded === true) {
      for (let i = this.activePlanes.length - 1; i >= 0; i--) {
        if (this.activePlanes[i]?.state === 'LANDED') {
          this.activePlanes.splice(i, 1);
        }
      }
    }

    // 1. Update pending perimeter `!` spawns
    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const pending = this.pendingSpawns[i];
      pending.timer -= safeDt;
      const maxT = Math.max(0.001, pending.maxTimer || PERIMETER_LEAD_TIME);
      pending.progress = clamp(1 - pending.timer / maxT, 0, 1);
      pending.urgency = pending.progress;

      if (pending.timer <= 1e-6) {
        this.pendingSpawns.splice(i, 1);
        this._commitPendingSpawn(pending);
      }
    }

    // 2. Organic traffic pacing & perimeter warning scheduling
    const { targetCap, baseInterval } = this._getPacingTargets();
    const flyingOrLandingCount = this.activePlanes.filter(
      (p) => p && p.state !== 'LANDED'
    ).length;
    const totalCommittedTraffic = flyingOrLandingCount + this.pendingSpawns.length;

    this.spawnTimer -= safeDt;

    // Keep at least 2 aircraft/warnings active at all times so the sky never goes dead
    if (totalCommittedTraffic < 2 && this.spawnTimer > 0.55) {
      this.spawnTimer = 0.55;
    }

    if (this.spawnTimer <= 0) {
      if (totalCommittedTraffic < targetCap) {
        const scheduled = this.schedulePerimeterSpawn();
        if (scheduled) {
          // Occasional double-entry wave in higher rounds
          if (
            this.roundNumber >= 3 &&
            totalCommittedTraffic + 1 < targetCap &&
            Math.random() < 0.28
          ) {
            this.schedulePerimeterSpawn();
          }
          this.spawnTimer = baseInterval * (0.85 + Math.random() * 0.3);
        } else {
          // Airspace perimeter was too crowded to satisfy >=135 separation; retry shortly
          this.spawnTimer = 0.75;
        }
      } else {
        this.spawnTimer = 1.1;
      }
    }

    // 3. Evaluate Two-Stage Spatial Collision Engine
    const collisionResult = this.evaluateCollisions(this.activePlanes);

    return {
      ...collisionResult,
      pendingSpawns: this.pendingSpawns,
      roundNumber: this.roundNumber,
      landedCount: this.landedCount,
    };
  }
}

if (typeof window !== 'undefined') {
  window.MAP_DEFINITIONS = MAP_DEFINITIONS;
  window.TrafficAndCollisionDirector = TrafficAndCollisionDirector;
  window.WARNING_RADIUS = WARNING_RADIUS;
  window.COLLISION_RADIUS = COLLISION_RADIUS;
}
if (typeof globalThis !== 'undefined') {
  globalThis.MAP_DEFINITIONS = MAP_DEFINITIONS;
  globalThis.TrafficAndCollisionDirector = TrafficAndCollisionDirector;
}

export default TrafficAndCollisionDirector;
