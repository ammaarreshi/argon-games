/**
 * Argon Towers (Grasslands) 2.5D Three.js Engine
 * Agent 3: Enemy Waves, Spawning, Path Steering, Tower Repulsion & AI (`src/enemy_waves.js`)
 *
 * Implements:
 * 1. ENEMY_DEFS: 6 iconic Argon Towers archetypes:
 *    - grunt (Vanguard Grunt)
 *    - biker (Outrider Biker)
 *    - transport (Armored Transport — spawns 3 Grunts on death)
 *    - mech (Goliath War-Mech — heavy armor + highDamageDecal)
 *    - chopper (Skyraider Chopper — air unit bypassing ground mazes + drop shadow)
 *    - zeppelin (Dreadnought Zeppelin — boss air unit bypassing ground mazes + shark-mouth nose art)
 * 2. WAVE_SCHEDULE & getWaveDefinition(roundNumber):
 *    - Complete 1–100 tactical wave schedule + 101+ endless scaling
 *    - Signature rounds (1–3 Grunts, 4–6 Bikers, 7 Air Recon, 8–15 Transports & Round 10 Boss Mech,
 *      16 Iconic Air Blitz #1, 20 Dreadnought Zeppelin Boss, 24 Combined Arms, 32 Iconic Air Blitz #2,
 *      48 Iconic Air Blitz #3, 50/64/75/80/90/96/100 Boss Blitzes)
 * 3. EnemyUnit:
 *    - Smooth lookahead corner rounding + strict tower-footprint repulsion (`repelFromTowers(grid)`)
 *    - Instant stutter-free dynamic rerouting (`reroute(grid)`)
 *    - Air straight-line vector flight (`X = -19.5` to `X = +19.5`) with banking & ground drop shadow
 *    - Status effects (`applySlow`, `applyStun`), damage & death (`takeDamage`), sub-unit spawning
 *    - Procedural 2.5D articulated Three.js meshes, overhead health bars, and status overlays
 * 4. EnemyWaveSystem:
 *    - Wave spawning, `startNextWave()`, `jumpToRound(roundNum)`, `spawnInstantTestWave(config)`,
 *      `rerouteAllGroundEnemies(grid)`, `update(dt, grid, visuals, audio, callbacks)`, and targeting helpers.
 */

const WORLD_WEST_SPAWN_X = -19.5;
const WORLD_EAST_EXIT_X = 19.5;
const DEFAULT_AIR_LANES_Z = [-5.0, -1.5, 1.5, 5.0];

// ============================================================================
// 1. 6 ICONIC ARGON_TOWERS ENEMY ARCHETYPES (ENEMY_DEFS)
// ============================================================================

const ENEMY_DEFS = {
  grunt: {
    id: 'grunt',
    type: 'grunt',
    name: 'Vanguard Grunt',
    isAir: false,
    flyHeight: 0.0,
    baseHp: 42,
    speed: 1.75,
    bounty: 1,
    score: 50,
    livesCost: 1,
    radius: 0.45,
    scale: 1.0,
    isBoss: false,
    highDamageDecal: false,
    spawnOnDeath: null,
    // Visual & animation metadata
    primaryColor: 0xd63426,
    secondaryColor: 0x35422e,
    accentColor: 0xf0b884,
    bobSpeed: 9.5,
    bobAmplitude: 0.14,
    hitHeight: 0.65,
    healthBarHeight: 1.48,
    shadowRadius: 0.44,
    exhaustSmoke: false,
    description: 'Red military fatigues & dark helmet, comical bobbing run cycle.'
  },

  biker: {
    id: 'biker',
    type: 'biker',
    name: 'Outrider Biker',
    isAir: false,
    flyHeight: 0.0,
    baseHp: 78,
    speed: 2.85,
    bounty: 2,
    score: 100,
    livesCost: 1,
    radius: 0.55,
    scale: 1.05,
    isBoss: false,
    highDamageDecal: false,
    spawnOnDeath: null,
    // Visual & animation metadata
    primaryColor: 0x4b5838,
    secondaryColor: 0xc83224,
    accentColor: 0x8c969e,
    bobSpeed: 13.5,
    bobAmplitude: 0.05,
    hitHeight: 0.68,
    healthBarHeight: 1.56,
    shadowRadius: 0.58,
    exhaustSmoke: true,
    exhaustInterval: 0.085,
    description: 'Fast military motorcycle with leaning rider & exhaust smoke puffs.'
  },

  transport: {
    id: 'transport',
    type: 'transport',
    name: 'Armored Transport',
    isAir: false,
    flyHeight: 0.0,
    baseHp: 260,
    speed: 1.35,
    bounty: 4,
    score: 250,
    livesCost: 2,
    radius: 0.72,
    scale: 1.15,
    isBoss: false,
    highDamageDecal: false,
    spawnOnDeath: { type: 'grunt', count: 3 },
    // Visual & animation metadata
    primaryColor: 0x5c6b43,
    secondaryColor: 0x8c7a53,
    accentColor: 0x2c3028,
    bobSpeed: 7.0,
    bobAmplitude: 0.035,
    hitHeight: 0.88,
    healthBarHeight: 1.92,
    shadowRadius: 0.78,
    exhaustSmoke: true,
    exhaustInterval: 0.14,
    description: 'Heavy dieselpunk halftrack truck that deploys 3 Grunts when destroyed!'
  },

  mech: {
    id: 'mech',
    type: 'mech',
    name: 'Goliath War-Mech',
    isAir: false,
    flyHeight: 0.0,
    baseHp: 680,
    speed: 0.98,
    bounty: 10,
    score: 500,
    livesCost: 3,
    radius: 0.85,
    scale: 1.25,
    isBoss: false,
    highDamageDecal: true,
    spawnOnDeath: null,
    // Visual & animation metadata
    primaryColor: 0x48545c,
    secondaryColor: 0xb83728,
    accentColor: 0xdba832,
    bobSpeed: 4.8,
    bobAmplitude: 0.11,
    hitHeight: 1.18,
    healthBarHeight: 2.42,
    shadowRadius: 0.92,
    exhaustSmoke: true,
    exhaustInterval: 0.2,
    description: 'Heavy armored walking tank/mech with clanking joints and twin cannons.'
  },

  chopper: {
    id: 'chopper',
    type: 'chopper',
    name: 'Skyraider Chopper',
    isAir: true,
    flyHeight: 3.3,
    baseHp: 165,
    speed: 1.90,
    bounty: 5,
    score: 300,
    livesCost: 2,
    radius: 0.65,
    scale: 1.1,
    isBoss: false,
    highDamageDecal: false,
    spawnOnDeath: null,
    // Visual & animation metadata
    primaryColor: 0x4a5d46,
    secondaryColor: 0xc93b2b,
    accentColor: 0x8fd4ff,
    bobSpeed: 2.2,
    bobAmplitude: 0.12,
    hitHeight: 3.3,
    healthBarHeight: 4.35,
    shadowRadius: 0.74,
    exhaustSmoke: false,
    description: 'Rotary-blade gunship that completely ignores ground mazes, casting a dynamic drop shadow onto towers below!'
  },

  zeppelin: {
    id: 'zeppelin',
    type: 'zeppelin',
    name: 'Dreadnought Zeppelin',
    isAir: true,
    flyHeight: 4.1,
    baseHp: 1350,
    speed: 0.88,
    bounty: 20,
    score: 1200,
    livesCost: 5,
    radius: 1.1,
    scale: 1.45,
    isBoss: true,
    highDamageDecal: true,
    spawnOnDeath: null,
    // Visual & animation metadata
    primaryColor: 0x6e2620,
    secondaryColor: 0xd4a438,
    accentColor: 0x2c3238,
    bobSpeed: 1.5,
    bobAmplitude: 0.1,
    hitHeight: 4.1,
    healthBarHeight: 5.55,
    shadowRadius: 1.32,
    exhaustSmoke: true,
    exhaustInterval: 0.16,
    description: 'Colossal rigid-frame dieselpunk blimp with shark-mouth nose art that flies straight across the field ignoring all ground mazes!'
  }
};

// ============================================================================
// 2. COMPLETE 1–100+ ROUND WAVE SCHEDULE (WAVE_SCHEDULE & getWaveDefinition)
// ============================================================================

/**
 * Computes progressive HP multiplier for a given 1-based round number.
 * Ensures meaningful scaling right from Round 1 through Round 100+.
 */
function computeRoundHpMultiplier(round) {
  if (round <= 1) return 1.0;
  if (round <= 5) {
    // Rounds 2..5: 1.22, 1.44, 1.66, 1.88
    return Number((1.0 + (round - 1) * 0.22).toFixed(3));
  }
  if (round <= 15) {
    // Rounds 6..15: 2.16 -> 4.68
    return Number((1.88 + (round - 5) * 0.28).toFixed(3));
  }
  if (round <= 35) {
    // Rounds 16..35: 4.68 * 1.06^(round - 15)
    return Number((4.68 * Math.pow(1.06, round - 15)).toFixed(3));
  }
  // Rounds 36..100+
  return Number((15.0 * Math.pow(1.04, round - 35)).toFixed(3));
}

/**
 * Expands high-level group definitions into an ordered timeline of individual spawn events.
 */
function expandGroupsToSpawnEvents(groups, baseHpMultiplier, baseSpeedMultiplier = 1.0) {
  const events = [];
  let cursorTime = 0;

  for (let gIdx = 0; gIdx < groups.length; gIdx++) {
    const group = groups[gIdx];
    const type = group.type || 'grunt';
    const def = ENEMY_DEFS[type] || ENEMY_DEFS.grunt;
    const count = Math.max(1, group.count || 1);
    const rawInterval = typeof group.interval === 'number' ? group.interval : (def.isAir ? 1.6 : 1.15);
    const interval = Math.max(0.45, rawInterval * 1.55);
    const startOffset = typeof group.startTime === 'number'
      ? group.startTime
      : cursorTime + (typeof group.delay === 'number' ? group.delay : (gIdx === 0 ? 0 : 1.15));

    const lanes = Array.isArray(group.lanes) && group.lanes.length > 0
      ? group.lanes
      : (typeof group.laneZ === 'number'
        ? [group.laneZ]
        : (def.isAir ? DEFAULT_AIR_LANES_Z : [0]));

    const groupHpMult = (group.hpMultiplier || 1.0) * baseHpMultiplier;
    const groupSpeedMult = (group.speedMultiplier || 1.0) * baseSpeedMultiplier;

    for (let i = 0; i < count; i++) {
      const spawnTime = startOffset + i * interval;
      const laneZ = lanes[i % lanes.length];
      // Add slight natural lateral jitter for ground swarms when not air
      const jitterZ = def.isAir ? 0 : (((i % 3) - 1) * 0.18);
      events.push({
        time: Number(spawnTime.toFixed(3)),
        type,
        laneZ: Number((laneZ + jitterZ).toFixed(3)),
        hpMultiplier: Number(groupHpMult.toFixed(3)),
        speedMultiplier: Number(groupSpeedMult.toFixed(3)),
        isBoss: Boolean(group.isBoss || def.isBoss),
        groupIndex: gIdx
      });
    }

    cursorTime = Math.max(cursorTime, startOffset + (count - 1) * interval);
  }

  events.sort((a, b) => a.time - b.time);
  return events;
}

/**
 * Handcrafted + tactical 100-round schedule matching Argon Towers (Grasslands) rhythm.
 */
function buildWaveDefinitionForRound(round) {
  const hpMultiplier = computeRoundHpMultiplier(round);
  let speedMultiplier = 1.0 + Math.min(0.12, Math.floor((round - 1) / 20) * 0.02);
  let title = `Wave ${round}`;
  let warningBanner = null;
  let groups = [];

  // Handcrafted signature rounds & tactical milestones
  switch (round) {
    case 1:
      title = 'Reconnaissance Squad';
      warningBanner = 'INCOMING INVADERS! BUILD ARGON TOWERS TO MAZE THEM!';
      speedMultiplier = 1.0;
      groups = [
        { type: 'grunt', count: 10, interval: 1.1, delay: 0.0 }
      ];
      break;

    case 2:
      title = 'Infantry Platoon';
      speedMultiplier = 1.0;
      groups = [
        { type: 'grunt', count: 14, interval: 0.95, delay: 0.0 }
      ];
      break;

    case 3:
      title = 'Outrider Vanguard';
      warningBanner = 'FAST OUTRIDER BIKERS! EXTEND YOUR MAZE OR SLOW THEM WITH GOO!';
      speedMultiplier = 1.0;
      groups = [
        { type: 'grunt', count: 8, interval: 0.85, delay: 0.0 },
        { type: 'biker', count: 5, interval: 0.95, delay: 1.0 }
      ];
      break;

    case 4:
      title = 'Motorized Crossfire';
      groups = [
        { type: 'grunt', count: 12, interval: 0.8, delay: 0.0 },
        { type: 'biker', count: 8, interval: 0.85, delay: 0.9 }
      ];
      break;

    case 5:
      title = 'Early Air Recon';
      warningBanner = 'AIR RAID! SKYRAIDER CHOPPERS BYPASS GROUND MAZES!';
      groups = [
        { type: 'chopper', count: 3, interval: 1.4, delay: 0.0, lanes: [-3.0, 0.0, 3.0] },
        { type: 'grunt', count: 8, interval: 0.8, delay: 0.8 }
      ];
      break;

    case 6:
      title = 'Armored Halftrack Convoy';
      warningBanner = 'ARMORED TRANSPORTS! DEPLOY 3 GRUNTS WHEN DESTROYED!';
      groups = [
        { type: 'transport', count: 3, interval: 1.8, delay: 0.0 },
        { type: 'grunt', count: 10, interval: 0.75, delay: 0.8 }
      ];
      break;

    case 7:
      title = 'Air & Outrider Blitz';
      warningBanner = 'AIR & OUTRIDER BLITZ! PROTECT THE EAST EXIT!';
      groups = [
        { type: 'chopper', count: 4, interval: 1.35, delay: 0.0, lanes: [-3.5, -1.0, 1.0, 3.5] },
        { type: 'biker', count: 10, interval: 0.78, delay: 0.8 }
      ];
      break;

    case 8:
      title = 'Goliath Prototype Assault';
      warningBanner = 'HEAVY ARMOR: GOLIATH WAR-MECH DEPLOYED!';
      groups = [
        { type: 'mech', count: 1, interval: 2.2, delay: 0.0, isBoss: true },
        { type: 'grunt', count: 12, interval: 0.72, delay: 0.9 },
        { type: 'biker', count: 6, interval: 0.8, delay: 0.8 }
      ];
      break;

    case 9:
      title = 'Mechanized Air & Ground Push';
      groups = [
        { type: 'transport', count: 5, interval: 1.65, delay: 0.0 },
        { type: 'chopper', count: 4, interval: 1.3, delay: 0.9, lanes: [-4.0, -1.5, 1.5, 4.0] },
        { type: 'biker', count: 12, interval: 0.72, delay: 0.8 }
      ];
      break;

    case 10:
      title = 'Twin Goliath Assault';
      warningBanner = 'HEAVY ARMOR: TWIN GOLIATH WAR-MECHS DEPLOYED!';
      groups = [
        { type: 'mech', count: 2, interval: 2.4, delay: 0.0, isBoss: true },
        { type: 'chopper', count: 4, interval: 1.3, delay: 1.0, lanes: [-3.5, -1.2, 1.2, 3.5] },
        { type: 'grunt', count: 16, interval: 0.65, delay: 0.8 }
      ];
      break;

    case 11:
      title = 'Dust Devil Swarm';
      groups = [
        { type: 'grunt', count: 20, interval: 0.58, delay: 0.0 },
        { type: 'biker', count: 12, interval: 0.68, delay: 0.8 }
      ];
      break;

    case 12:
      title = 'Dreadnought Zeppelin Boss';
      warningBanner = 'BOSS WAVE: DREADNOUGHT ZEPPELIN INBOUND!';
      groups = [
        { type: 'zeppelin', count: 1, interval: 3.0, delay: 0.0, lanes: [0.0], isBoss: true },
        { type: 'chopper', count: 4, interval: 1.35, startTime: 1.6, lanes: [-4.5, -1.5, 1.5, 4.5] },
        { type: 'transport', count: 4, interval: 1.6, delay: 1.0 }
      ];
      break;

    case 13:
      title = 'Halftrack Battalion';
      groups = [
        { type: 'transport', count: 6, interval: 1.35, delay: 0.0 },
        { type: 'grunt', count: 18, interval: 0.55, delay: 0.8 }
      ];
      break;

    case 14:
      title = 'Twin Goliath March';
      warningBanner = 'HEAVY ARMOR: TWIN GOLIATH MECHS INBOUND!';
      groups = [
        { type: 'biker', count: 12, interval: 0.65, delay: 0.0 },
        { type: 'mech', count: 2, interval: 2.4, delay: 1.0 },
        { type: 'transport', count: 3, interval: 1.5, delay: 0.9 }
      ];
      break;

    case 15:
      title = 'Relentless Ground Surge';
      groups = [
        { type: 'grunt', count: 24, interval: 0.5, delay: 0.0 },
        { type: 'biker', count: 16, interval: 0.58, delay: 0.7 },
        { type: 'transport', count: 5, interval: 1.3, delay: 0.8 },
        { type: 'mech', count: 2, interval: 2.2, delay: 1.0 }
      ];
      break;

    case 16:
      // Iconic Air Blitz #1
      title = 'Skyraider Air Blitz I';
      warningBanner = 'AIR RAID! 8 SKYRAIDER CHOPPERS BYPASS GROUND MAZES!';
      groups = [
        { type: 'chopper', count: 8, interval: 0.92, delay: 0.0, lanes: [-5.0, -1.5, 1.5, 5.0] }
      ];
      break;

    case 20:
      // Dreadnought Zeppelin Boss escorted by Ground Transports & Bikers
      title = 'Dreadnought Sky Fortress';
      warningBanner = 'BOSS WAVE: DREADNOUGHT ZEPPELIN INBOUND!';
      groups = [
        { type: 'transport', count: 5, interval: 1.35, delay: 0.0 },
        { type: 'zeppelin', count: 1, interval: 3.0, startTime: 1.2, lanes: [0.0], isBoss: true },
        { type: 'biker', count: 14, interval: 0.55, delay: 0.8 },
        { type: 'chopper', count: 4, interval: 1.2, startTime: 3.0, lanes: [-4.5, 4.5, -2.0, 2.0] }
      ];
      break;

    case 24:
      // Combined Arms Air + Ground assault
      title = 'Combined Arms Offensive';
      warningBanner = 'COMBINED ARMS: AIR SQUADRON & HEAVY GROUND ARMOR!';
      groups = [
        { type: 'mech', count: 3, interval: 2.0, delay: 0.0 },
        { type: 'chopper', count: 6, interval: 1.0, startTime: 0.8, lanes: [-5.0, -1.5, 1.5, 5.0] },
        { type: 'transport', count: 6, interval: 1.2, delay: 0.7 },
        { type: 'biker', count: 16, interval: 0.5, delay: 0.6 }
      ];
      break;

    case 30:
      title = 'Ironclad Division';
      warningBanner = 'HEAVY ARMOR: GOLIATH MECH BATTALION DEPLOYED!';
      groups = [
        { type: 'mech', count: 5, interval: 1.75, delay: 0.0 },
        { type: 'transport', count: 8, interval: 1.1, delay: 0.7 },
        { type: 'biker', count: 18, interval: 0.45, delay: 0.5 },
        { type: 'zeppelin', count: 1, interval: 3.0, startTime: 2.0, lanes: [0.0], isBoss: true }
      ];
      break;

    case 32:
      // Iconic Air Blitz #2: Heavy Chopper & Twin Zeppelin Armada (12 Choppers + 2 Zeppelins)
      title = 'Skyraider & Zeppelin Armada';
      warningBanner = 'AIR BLITZ! 12 CHOPPERS & TWIN DREADNOUGHT ZEPPELINS!';
      groups = [
        { type: 'chopper', count: 6, interval: 0.8, startTime: 0.0, lanes: [-5.0, -1.5, 1.5, 5.0] },
        { type: 'zeppelin', count: 2, interval: 2.6, startTime: 1.2, lanes: [-2.5, 2.5], isBoss: true },
        { type: 'chopper', count: 6, interval: 0.75, startTime: 3.8, lanes: [5.0, 1.5, -1.5, -5.0] }
      ];
      break;

    case 40:
      title = 'Steel Juggernaut Wall';
      warningBanner = 'BOSS WAVE: GOLIATH MECHS & DREADNOUGHT ESCORT!';
      groups = [
        { type: 'mech', count: 7, interval: 1.5, delay: 0.0 },
        { type: 'zeppelin', count: 2, interval: 2.8, startTime: 1.0, lanes: [-2.2, 2.2], isBoss: true },
        { type: 'transport', count: 10, interval: 0.95, delay: 0.6 },
        { type: 'chopper', count: 8, interval: 0.85, startTime: 3.5, lanes: [-5.0, -1.5, 1.5, 5.0] }
      ];
      break;

    case 48:
      // Iconic Air Blitz #3: Sky Armada (16 Choppers + 3 Zeppelins) + fast Biker rush
      title = 'Sky Armada & Outrider Blitz';
      warningBanner = 'SKY ARMADA! 16 CHOPPERS, 3 ZEPPELINS & OUTRIDER RUSH!';
      groups = [
        { type: 'chopper', count: 8, interval: 0.68, startTime: 0.0, lanes: [-5.5, -2.0, 2.0, 5.5] },
        { type: 'zeppelin', count: 3, interval: 2.2, startTime: 1.0, lanes: [-3.5, 0.0, 3.5], isBoss: true },
        { type: 'biker', count: 24, interval: 0.38, startTime: 1.5 },
        { type: 'chopper', count: 8, interval: 0.65, startTime: 4.5, lanes: [5.0, 1.5, -1.5, -5.0] }
      ];
      break;

    case 50:
      title = 'Half-Century Siege Boss';
      warningBanner = 'BOSS WAVE 50: GRAND COMBINED ARMS SIEGE!';
      groups = [
        { type: 'mech', count: 8, interval: 1.35, delay: 0.0 },
        { type: 'zeppelin', count: 3, interval: 2.4, startTime: 0.8, lanes: [-3.2, 0.0, 3.2], isBoss: true },
        { type: 'transport', count: 12, interval: 0.85, delay: 0.5 },
        { type: 'chopper', count: 10, interval: 0.7, startTime: 2.5, lanes: [-5.0, -1.5, 1.5, 5.0] },
        { type: 'biker', count: 24, interval: 0.36, delay: 0.5 }
      ];
      break;

    case 64:
      title = 'Sky & Iron Hurricane';
      warningBanner = 'BOSS WAVE 64: QUAD ZEPPELIN & GOLIATH HURRICANE!';
      groups = [
        { type: 'zeppelin', count: 4, interval: 2.0, startTime: 0.4, lanes: [-4.2, -1.4, 1.4, 4.2], isBoss: true },
        { type: 'chopper', count: 16, interval: 0.58, startTime: 0.0, lanes: [-5.5, -2.0, 2.0, 5.5] },
        { type: 'mech', count: 10, interval: 1.2, delay: 0.4 },
        { type: 'transport', count: 12, interval: 0.78, delay: 0.5 }
      ];
      break;

    case 75:
      title = 'Diamond Blitzkrieg';
      warningBanner = 'BOSS WAVE 75: DIAMOND BLITZKRIEG ASSAULT!';
      groups = [
        { type: 'mech', count: 12, interval: 1.05, delay: 0.0 },
        { type: 'zeppelin', count: 4, interval: 1.9, startTime: 0.6, lanes: [-4.5, -1.5, 1.5, 4.5], isBoss: true },
        { type: 'transport', count: 15, interval: 0.72, delay: 0.4 },
        { type: 'chopper', count: 18, interval: 0.52, startTime: 2.0, lanes: [-5.0, -1.5, 1.5, 5.0] },
        { type: 'biker', count: 30, interval: 0.35, delay: 0.4 }
      ];
      break;

    case 80:
      title = 'Overlord Armored Spearhead';
      warningBanner = 'BOSS WAVE 80: OVERLORD ARMORED SPEARHEAD!';
      groups = [
        { type: 'mech', count: 14, interval: 0.98, delay: 0.0 },
        { type: 'zeppelin', count: 4, interval: 1.85, startTime: 0.8, lanes: [-4.0, -1.2, 1.2, 4.0], isBoss: true },
        { type: 'transport', count: 16, interval: 0.68, delay: 0.4 },
        { type: 'chopper', count: 16, interval: 0.5, startTime: 1.5, lanes: [-5.5, -2.0, 2.0, 5.5] }
      ];
      break;

    case 90:
      title = 'Apocalypse Vanguard';
      warningBanner = 'BOSS WAVE 90: APOCALYPSE VANGUARD INBOUND!';
      groups = [
        { type: 'mech', count: 16, interval: 0.9, delay: 0.0 },
        { type: 'zeppelin', count: 4, interval: 1.75, startTime: 0.5, lanes: [-4.5, -1.5, 1.5, 4.5], isBoss: true },
        { type: 'transport', count: 18, interval: 0.64, delay: 0.4 },
        { type: 'chopper', count: 20, interval: 0.46, startTime: 1.2, lanes: [-5.5, -2.0, 2.0, 5.5] },
        { type: 'biker', count: 32, interval: 0.32, delay: 0.4 }
      ];
      break;

    case 96:
      title = 'Total Sky Blackout';
      warningBanner = 'AIR ARMADA 96: TOTAL SKY BLACKOUT!';
      groups = [
        { type: 'zeppelin', count: 5, interval: 1.65, startTime: 0.3, lanes: [-5.0, -2.5, 0.0, 2.5, 5.0], isBoss: true },
        { type: 'chopper', count: 24, interval: 0.45, startTime: 0.0, lanes: [-5.5, -3.0, -1.0, 1.0, 3.0, 5.5] },
        { type: 'mech', count: 12, interval: 0.95, startTime: 1.0 },
        { type: 'biker', count: 30, interval: 0.32, delay: 0.4 }
      ];
      break;

    case 100:
      title = 'THE FINAL ARGON BLITZ';
      warningBanner = 'FINAL WAVE 100: THE FINAL ARGON BLITZ!';
      groups = [
        { type: 'grunt', count: 36, interval: 0.32, startTime: 0.0 },
        { type: 'biker', count: 32, interval: 0.35, startTime: 1.0 },
        { type: 'transport', count: 18, interval: 0.6, startTime: 2.0 },
        { type: 'mech', count: 18, interval: 0.82, startTime: 2.5, isBoss: true },
        { type: 'chopper', count: 24, interval: 0.45, startTime: 1.2, lanes: [-5.5, -3.0, -1.0, 1.0, 3.0, 5.5] },
        { type: 'zeppelin', count: 5, interval: 1.6, startTime: 2.0, lanes: [-5.0, -2.5, 0.0, 2.5, 5.0], isBoss: true }
      ];
      break;

    default: {
      // Tactical procedural rhythm for all intermediate rounds (17..99 and 101+)
      const cycle = round % 8;
      const tier = Math.floor(round / 10);

      if (round % 10 === 0) {
        // Every 10th round is a heavy Boss Wave
        const zepCount = Math.min(6, 1 + Math.floor(round / 25));
        const mechCount = Math.min(20, 2 + Math.floor(round / 6));
        title = `Dreadnought Siege ${Math.floor(round / 10)}`;
        warningBanner = `BOSS WAVE ${round}: DREADNOUGHT ZEPPELINS & GOLIATH MECHS!`;
        groups = [
          { type: 'mech', count: mechCount, interval: Math.max(0.85, 1.8 - tier * 0.08), delay: 0.0 },
          { type: 'zeppelin', count: zepCount, interval: 2.2, startTime: 1.0, lanes: [-3.5, 0.0, 3.5, -1.8, 1.8], isBoss: true },
          { type: 'transport', count: 5 + tier, interval: Math.max(0.65, 1.3 - tier * 0.05), delay: 0.6 },
          { type: 'chopper', count: 4 + tier, interval: Math.max(0.55, 1.0 - tier * 0.04), startTime: 2.2, lanes: DEFAULT_AIR_LANES_Z }
        ];
      } else if (cycle === 1) {
        // Infantry & Outrider swarm wave
        title = `Infantry Surge ${round}`;
        groups = [
          { type: 'grunt', count: Math.min(45, 16 + Math.floor(round * 0.45)), interval: Math.max(0.35, 0.55 - tier * 0.02), delay: 0.0 },
          { type: 'biker', count: Math.min(35, 10 + Math.floor(round * 0.32)), interval: Math.max(0.38, 0.62 - tier * 0.025), delay: 0.5 }
        ];
      } else if (cycle === 2) {
        // Armored Halftrack & Biker Escort
        title = `Armored Convoy ${round}`;
        if (round < 30) warningBanner = 'ARMORED CONVOY: TROOP TRANSPORTS INBOUND!';
        groups = [
          { type: 'transport', count: Math.min(18, 4 + Math.floor(round * 0.18)), interval: Math.max(0.68, 1.35 - tier * 0.06), delay: 0.0 },
          { type: 'biker', count: Math.min(30, 8 + Math.floor(round * 0.25)), interval: Math.max(0.38, 0.6 - tier * 0.02), delay: 0.6 },
          { type: 'grunt', count: Math.min(36, 12 + Math.floor(round * 0.3)), interval: 0.42, delay: 0.5 }
        ];
      } else if (cycle === 3) {
        // Air + Fast Ground raid
        title = `Skyraider Strike ${round}`;
        warningBanner = 'AIR RAID! SKYRAIDER CHOPPERS INBOUND!';
        groups = [
          { type: 'chopper', count: Math.min(18, 5 + Math.floor(round * 0.16)), interval: Math.max(0.55, 0.95 - tier * 0.04), startTime: 0.0, lanes: DEFAULT_AIR_LANES_Z },
          { type: 'biker', count: Math.min(28, 10 + Math.floor(round * 0.22)), interval: Math.max(0.38, 0.58 - tier * 0.02), startTime: 0.8 }
        ];
      } else if (cycle === 4) {
        // Heavy Goliath Mech & Halftrack column
        title = `Goliath Phalanx ${round}`;
        warningBanner = 'HEAVY ARMOR: GOLIATH MECHS DEPLOYED!';
        groups = [
          { type: 'mech', count: Math.min(16, 2 + Math.floor(round * 0.15)), interval: Math.max(0.9, 1.85 - tier * 0.08), delay: 0.0 },
          { type: 'transport', count: Math.min(14, 3 + Math.floor(round * 0.14)), interval: Math.max(0.75, 1.3 - tier * 0.05), delay: 0.7 },
          { type: 'grunt', count: Math.min(32, 10 + Math.floor(round * 0.25)), interval: 0.42, delay: 0.5 }
        ];
      } else if (cycle === 5) {
        // High-speed Outrider Biker blitz
        title = `Outrider Stampede ${round}`;
        groups = [
          { type: 'biker', count: Math.min(40, 14 + Math.floor(round * 0.35)), interval: Math.max(0.35, 0.52 - tier * 0.02), delay: 0.0 },
          { type: 'chopper', count: Math.min(14, 3 + Math.floor(round * 0.12)), interval: 0.8, startTime: 1.2, lanes: [-4.5, 0.0, 4.5] }
        ];
      } else if (cycle === 6) {
        // Combined Arms with Zeppelin support in mid/late rounds
        title = `Combined Assault ${round}`;
        const hasZep = round >= 26;
        if (hasZep) warningBanner = 'COMBINED ASSAULT: DREADNOUGHT & GROUND ARMOR!';
        groups = [
          { type: 'transport', count: Math.min(16, 4 + Math.floor(round * 0.16)), interval: 0.95, delay: 0.0 },
          { type: 'mech', count: Math.min(12, 2 + Math.floor(round * 0.12)), interval: 1.35, delay: 0.6 },
          ...(hasZep ? [{ type: 'zeppelin', count: Math.min(4, 1 + Math.floor((round - 20) / 25)), interval: 2.4, startTime: 1.0, lanes: [-2.5, 2.5], isBoss: true }] : []),
          { type: 'chopper', count: Math.min(14, 4 + Math.floor(round * 0.12)), interval: 0.75, startTime: 1.8, lanes: DEFAULT_AIR_LANES_Z }
        ];
      } else {
        // cycle === 7: Pre-blitz heavy swarm
        title = `Shockwave Battalion ${round}`;
        groups = [
          { type: 'grunt', count: Math.min(42, 18 + Math.floor(round * 0.35)), interval: 0.38, delay: 0.0 },
          { type: 'biker', count: Math.min(30, 12 + Math.floor(round * 0.25)), interval: 0.4, delay: 0.4 },
          { type: 'mech', count: Math.min(12, 2 + Math.floor(round * 0.12)), interval: 1.3, delay: 0.6 },
          { type: 'transport', count: Math.min(12, 3 + Math.floor(round * 0.12)), interval: 0.9, delay: 0.5 }
        ];
      }
      break;
    }
  }

  const spawnEvents = expandGroupsToSpawnEvents(groups, hpMultiplier, speedMultiplier);
  const hasChoppers = spawnEvents.some((ev) => ev.type === 'chopper');
  const hasZeppelin = spawnEvents.some((ev) => ev.type === 'zeppelin');
  const isAirWave = hasChoppers || hasZeppelin;
  const isPureAirWave = spawnEvents.length > 0 && spawnEvents.every((ev) => ENEMY_DEFS[ev.type]?.isAir);
  const isBossWave = hasZeppelin || spawnEvents.some((ev) => ev.isBoss || ENEMY_DEFS[ev.type]?.isBoss);

  // Summarize counts by enemy archetype for UI wave preview banners
  const countsByType = {};
  for (let i = 0; i < spawnEvents.length; i++) {
    const t = spawnEvents[i].type;
    countsByType[t] = (countsByType[t] || 0) + 1;
  }

  const clearBonusGold = 4 + Math.floor(round * 1.25) + (isBossWave ? 10 : 0);
  const clearBonusScore = 100 + round * 35 + (isBossWave ? 300 : 0);

  return {
    round,
    waveNumber: round,
    id: round,
    title,
    name: title,
    hpMultiplier,
    speedMultiplier: Number(speedMultiplier.toFixed(3)),
    warningBanner,
    hasChoppers,
    hasZeppelin,
    isAirWave,
    isPureAirWave,
    isBossWave,
    clearBonusGold,
    clearBonusScore,
    countsByType,
    totalUnits: spawnEvents.length,
    groups,
    spawns: groups,
    spawnEvents
  };
}

// Prebuild 1..100 into WAVE_SCHEDULE (0-indexed array of 100 waves, plus helper lookup)
const WAVE_SCHEDULE = [];
for (let r = 1; r <= 100; r++) {
  WAVE_SCHEDULE.push(buildWaveDefinitionForRound(r));
}

/**
 * Returns the wave definition for any 1-based roundNumber (1..100 from table, 101+ procedurally scaled).
 */
function getWaveDefinition(roundNumber) {
  const r = Math.max(1, Math.floor(Number(roundNumber) || 1));
  if (r <= WAVE_SCHEDULE.length) {
    return WAVE_SCHEDULE[r - 1];
  }
  return buildWaveDefinitionForRound(r);
}

// ============================================================================
// 3. PROCEDURAL 2.5D THREE.JS ENEMY MESH BUILDER (FALLBACK & ARTICULATION)
// ============================================================================

let _sharedGeometries = null;

function getSharedGeometries(THREE) {
  if (_sharedGeometries || !THREE) return _sharedGeometries;
  _sharedGeometries = {
    unitBox: new THREE.BoxGeometry(1, 1, 1),
    unitCyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
    unitSphere: new THREE.SphereGeometry(0.5, 14, 12),
    unitCone: new THREE.ConeGeometry(0.5, 1, 12),
    shadowCircle: new THREE.CircleGeometry(1, 20),
    hpPlane: new THREE.PlaneGeometry(1, 1),
    ringGeo: new THREE.RingGeometry(0.65, 0.92, 20)
  };
  return _sharedGeometries;
}

/**
 * Builds a rich, articulated 2.5D Argon Towers Three.js mesh group for an EnemyUnit.
 * Used automatically unless `visuals.createEnemyMesh` provides a custom mesh.
 */
function buildProceduralEnemyMesh(enemy, THREE) {
  if (!THREE) return null;
  const geos = getSharedGeometries(THREE);
  const def = enemy.def;
  const root = new THREE.Group();
  root.name = `Enemy_${enemy.type}_${enemy.id}`;

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'bodyGroup';
  root.add(bodyGroup);

  const animParts = {
    bodyGroup,
    legs: [],
    arms: [],
    wheels: [],
    rotors: [],
    propellers: [],
    cannons: [],
    damageDecals: [],
    flashMaterials: []
  };

  const makeMat = (colorHex, roughness = 0.55, metalness = 0.15) => {
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness,
      metalness
    });
    mat.userData.baseColorHex = colorHex;
    animParts.flashMaterials.push(mat);
    return mat;
  };

  const s = def.scale || 1.0;
  bodyGroup.scale.set(s, s, s);

  if (enemy.type === 'grunt') {
    // Vanguard Grunt: red military fatigues, olive helmet, bobbing limbs & rifle
    const matUniform = makeMat(0xd63426, 0.6, 0.08);
    const matHelmet = makeMat(0x2d3a27, 0.5, 0.2);
    const matSkin = makeMat(0xf2b882, 0.65, 0.05);
    const matBoot = makeMat(0x232323, 0.7, 0.1);
    const matGear = makeMat(0x524632, 0.7, 0.1);

    // Legs
    for (let side of [-1, 1]) {
      const legPivot = new THREE.Group();
      legPivot.position.set(0, 0.34, side * 0.13);
      const legMesh = new THREE.Mesh(geos.unitBox, matUniform);
      legMesh.scale.set(0.18, 0.28, 0.16);
      legMesh.position.y = -0.12;
      legMesh.castShadow = true;
      const bootMesh = new THREE.Mesh(geos.unitBox, matBoot);
      bootMesh.scale.set(0.22, 0.12, 0.18);
      bootMesh.position.set(0.03, -0.26, 0);
      legPivot.add(legMesh, bootMesh);
      bodyGroup.add(legPivot);
      animParts.legs.push(legPivot);
    }

    // Torso & Backpack
    const torso = new THREE.Mesh(geos.unitBox, matUniform);
    torso.scale.set(0.34, 0.42, 0.38);
    torso.position.set(0, 0.54, 0);
    torso.castShadow = true;
    bodyGroup.add(torso);

    const pack = new THREE.Mesh(geos.unitBox, matGear);
    pack.scale.set(0.18, 0.32, 0.28);
    pack.position.set(-0.22, 0.56, 0);
    pack.castShadow = true;
    bodyGroup.add(pack);

    // Head & Oversized Argon Towers Helmet
    const head = new THREE.Mesh(geos.unitSphere, matSkin);
    head.scale.set(0.36, 0.36, 0.36);
    head.position.set(0.02, 0.88, 0);
    bodyGroup.add(head);

    const helmet = new THREE.Mesh(geos.unitSphere, matHelmet);
    helmet.scale.set(0.46, 0.38, 0.46);
    helmet.position.set(0.0, 0.96, 0);
    helmet.castShadow = true;
    bodyGroup.add(helmet);

    const brim = new THREE.Mesh(geos.unitCyl, matHelmet);
    brim.scale.set(0.52, 0.06, 0.52);
    brim.position.set(0.02, 0.89, 0);
    bodyGroup.add(brim);

    // Arms & Submachine Gun
    for (let side of [-1, 1]) {
      const armPivot = new THREE.Group();
      armPivot.position.set(0.02, 0.66, side * 0.24);
      const armMesh = new THREE.Mesh(geos.unitBox, matUniform);
      armMesh.scale.set(0.26, 0.14, 0.14);
      armMesh.position.set(0.1, -0.06, 0);
      armPivot.add(armMesh);
      bodyGroup.add(armPivot);
      animParts.arms.push(armPivot);
    }

    const rifle = new THREE.Mesh(geos.unitBox, matBoot);
    rifle.scale.set(0.42, 0.09, 0.08);
    rifle.position.set(0.24, 0.56, 0.16);
    bodyGroup.add(rifle);
  } else if (enemy.type === 'biker') {
    // Outrider Biker: olive military motorcycle, spinning tires, chrome exhausts, leaning rider
    const matBike = makeMat(0x4b5d38, 0.45, 0.3);
    const matTire = makeMat(0x1f2124, 0.8, 0.1);
    const matChrome = makeMat(0xc4ccd4, 0.25, 0.75);
    const matRider = makeMat(0xd63426, 0.55, 0.1);
    const matHelmet = makeMat(0x283324, 0.45, 0.25);

    // Front & Rear Wheels
    for (let wx of [-0.38, 0.42]) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wx, 0.24, 0);
      const tire = new THREE.Mesh(geos.unitCyl, matTire);
      tire.rotation.x = Math.PI * 0.5;
      tire.scale.set(0.46, 0.18, 0.46);
      tire.castShadow = true;
      const hub = new THREE.Mesh(geos.unitBox, matChrome);
      hub.scale.set(0.32, 0.08, 0.2);
      wheelGroup.add(tire, hub);
      bodyGroup.add(wheelGroup);
      animParts.wheels.push(wheelGroup);
    }

    // Chassis & Engine block
    const chassis = new THREE.Mesh(geos.unitBox, matBike);
    chassis.scale.set(0.76, 0.26, 0.26);
    chassis.position.set(0.02, 0.36, 0);
    chassis.castShadow = true;
    bodyGroup.add(chassis);

    // Twin Exhaust pipes
    for (let side of [-1, 1]) {
      const pipe = new THREE.Mesh(geos.unitCyl, matChrome);
      pipe.rotation.z = Math.PI * 0.44;
      pipe.scale.set(0.09, 0.52, 0.09);
      pipe.position.set(-0.32, 0.28, side * 0.17);
      bodyGroup.add(pipe);
    }

    // Front fork & headlight
    const fork = new THREE.Mesh(geos.unitBox, matChrome);
    fork.scale.set(0.1, 0.46, 0.24);
    fork.position.set(0.34, 0.48, 0);
    fork.rotation.z = -0.35;
    bodyGroup.add(fork);

    // Leaning Rider
    const riderTorso = new THREE.Mesh(geos.unitBox, matRider);
    riderTorso.scale.set(0.32, 0.38, 0.3);
    riderTorso.position.set(-0.04, 0.66, 0);
    riderTorso.rotation.z = -0.42;
    riderTorso.castShadow = true;
    bodyGroup.add(riderTorso);

    const riderHead = new THREE.Mesh(geos.unitSphere, matHelmet);
    riderHead.scale.set(0.36, 0.34, 0.36);
    riderHead.position.set(0.12, 0.92, 0);
    riderHead.castShadow = true;
    bodyGroup.add(riderHead);
  } else if (enemy.type === 'transport') {
    // Armored Transport: heavy dieselpunk halftrack truck that deploys 3 Grunts on death
    const matHull = makeMat(0x55663e, 0.55, 0.25);
    const matCanopy = makeMat(0x8c7b54, 0.7, 0.08);
    const matDark = makeMat(0x252822, 0.75, 0.2);
    const matVisor = makeMat(0x9ad8ff, 0.2, 0.6);
    const matRedCross = makeMat(0xc93428, 0.5, 0.1);

    // Rear Halftrack Treads + Front Wheels
    for (let side of [-1, 1]) {
      const tread = new THREE.Mesh(geos.unitBox, matDark);
      tread.scale.set(0.68, 0.28, 0.18);
      tread.position.set(-0.28, 0.18, side * 0.42);
      tread.castShadow = true;
      bodyGroup.add(tread);

      const frontWheel = new THREE.Group();
      frontWheel.position.set(0.46, 0.2, side * 0.42);
      const tire = new THREE.Mesh(geos.unitCyl, matDark);
      tire.rotation.x = Math.PI * 0.5;
      tire.scale.set(0.38, 0.16, 0.38);
      frontWheel.add(tire);
      bodyGroup.add(frontWheel);
      animParts.wheels.push(frontWheel);
    }

    // Armored Chassis Bed & Cab
    const chassis = new THREE.Mesh(geos.unitBox, matHull);
    chassis.scale.set(1.32, 0.38, 0.78);
    chassis.position.set(0.04, 0.42, 0);
    chassis.castShadow = true;
    bodyGroup.add(chassis);

    const cab = new THREE.Mesh(geos.unitBox, matHull);
    cab.scale.set(0.52, 0.38, 0.74);
    cab.position.set(0.34, 0.74, 0);
    cab.castShadow = true;
    bodyGroup.add(cab);

    const visor = new THREE.Mesh(geos.unitBox, matVisor);
    visor.scale.set(0.08, 0.14, 0.58);
    visor.position.set(0.58, 0.78, 0);
    bodyGroup.add(visor);

    // Troop Bed Canopy with Red Stripe
    const canopy = new THREE.Mesh(geos.unitBox, matCanopy);
    canopy.scale.set(0.76, 0.48, 0.76);
    canopy.position.set(-0.26, 0.78, 0);
    canopy.castShadow = true;
    bodyGroup.add(canopy);

    const badge = new THREE.Mesh(geos.unitBox, matRedCross);
    badge.scale.set(0.34, 0.18, 0.8);
    badge.position.set(-0.26, 0.78, 0);
    bodyGroup.add(badge);
  } else if (enemy.type === 'mech') {
    // Goliath War-Mech: heavy walking tank with clanking legs, armored dome, twin cannons & damage decals
    const matArmor = makeMat(0x4a5660, 0.4, 0.45);
    const matTrim = makeMat(0xc43828, 0.45, 0.25);
    const matHazard = makeMat(0xe0a82e, 0.5, 0.2);
    const matDarkMetal = makeMat(0x262b30, 0.5, 0.6);
    const matVisor = makeMat(0xffcc33, 0.2, 0.8);

    // Articulated Heavy Stomping Legs
    for (let side of [-1, 1]) {
      const legPivot = new THREE.Group();
      legPivot.position.set(0, 0.62, side * 0.38);

      const thigh = new THREE.Mesh(geos.unitBox, matDarkMetal);
      thigh.scale.set(0.28, 0.42, 0.24);
      thigh.position.set(0, -0.2, 0);
      thigh.castShadow = true;

      const foot = new THREE.Mesh(geos.unitBox, matArmor);
      foot.scale.set(0.46, 0.18, 0.34);
      foot.position.set(0.06, -0.48, 0);
      foot.castShadow = true;

      legPivot.add(thigh, foot);
      bodyGroup.add(legPivot);
      animParts.legs.push(legPivot);
    }

    // Pelvis & Rotating Armored Torso Hull
    const pelvis = new THREE.Mesh(geos.unitBox, matDarkMetal);
    pelvis.scale.set(0.56, 0.24, 0.62);
    pelvis.position.set(0, 0.64, 0);
    bodyGroup.add(pelvis);

    const hull = new THREE.Mesh(geos.unitBox, matArmor);
    hull.scale.set(0.84, 0.66, 0.86);
    hull.position.set(0.02, 1.08, 0);
    hull.castShadow = true;
    bodyGroup.add(hull);

    const dome = new THREE.Mesh(geos.unitSphere, matTrim);
    dome.scale.set(0.68, 0.42, 0.68);
    dome.position.set(0.0, 1.44, 0);
    dome.castShadow = true;
    bodyGroup.add(dome);

    const visor = new THREE.Mesh(geos.unitBox, matVisor);
    visor.scale.set(0.12, 0.16, 0.54);
    visor.position.set(0.41, 1.16, 0);
    bodyGroup.add(visor);

    const hazardPlate = new THREE.Mesh(geos.unitBox, matHazard);
    hazardPlate.scale.set(0.14, 0.18, 0.68);
    hazardPlate.position.set(0.41, 0.9, 0);
    bodyGroup.add(hazardPlate);

    // Twin Shoulder Autocannons
    for (let side of [-1, 1]) {
      const pod = new THREE.Group();
      pod.position.set(0.08, 1.15, side * 0.56);
      const podBox = new THREE.Mesh(geos.unitBox, matTrim);
      podBox.scale.set(0.44, 0.32, 0.26);
      podBox.castShadow = true;
      const barrel = new THREE.Mesh(geos.unitCyl, matDarkMetal);
      barrel.rotation.z = Math.PI * 0.5;
      barrel.scale.set(0.14, 0.62, 0.14);
      barrel.position.set(0.36, 0, 0);
      pod.add(podBox, barrel);
      bodyGroup.add(pod);
      animParts.cannons.push(pod);
    }

    // High-damage battle scorch decal meshes (revealed when HP <= 50%)
    const scorchMat = new THREE.MeshBasicMaterial({ color: 0x181412 });
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff5511 });
    const decalGroup = new THREE.Group();
    decalGroup.visible = false;
    const scorch1 = new THREE.Mesh(geos.unitBox, scorchMat);
    scorch1.scale.set(0.42, 0.28, 0.9);
    scorch1.position.set(-0.05, 1.12, 0);
    const ember1 = new THREE.Mesh(geos.unitBox, emberMat);
    ember1.scale.set(0.24, 0.12, 0.92);
    ember1.position.set(-0.05, 1.12, 0);
    decalGroup.add(scorch1, ember1);
    bodyGroup.add(decalGroup);
    animParts.damageDecals.push(decalGroup);
  } else if (enemy.type === 'chopper') {
    // Skyraider Chopper: gunship fuselage, cockpit canopy, stub wings, spinning main & tail rotors
    const matBody = makeMat(0x485e42, 0.42, 0.32);
    const matAccent = makeMat(0xc93b2b, 0.45, 0.2);
    const matGlass = makeMat(0x88d4ff, 0.18, 0.7);
    const matRotor = makeMat(0x1e2224, 0.6, 0.4);

    // Main Fuselage & Nose
    const fuselage = new THREE.Mesh(geos.unitBox, matBody);
    fuselage.scale.set(1.05, 0.44, 0.48);
    fuselage.position.set(0.05, 0, 0);
    fuselage.castShadow = true;
    bodyGroup.add(fuselage);

    const canopy = new THREE.Mesh(geos.unitSphere, matGlass);
    canopy.scale.set(0.62, 0.36, 0.42);
    canopy.position.set(0.32, 0.06, 0);
    bodyGroup.add(canopy);

    // Stub Wings & Rocket Pods
    const wings = new THREE.Mesh(geos.unitBox, matAccent);
    wings.scale.set(0.34, 0.08, 1.16);
    wings.position.set(0.02, -0.04, 0);
    wings.castShadow = true;
    bodyGroup.add(wings);

    for (let side of [-1, 1]) {
      const pod = new THREE.Mesh(geos.unitCyl, matRotor);
      pod.rotation.z = Math.PI * 0.5;
      pod.scale.set(0.16, 0.44, 0.16);
      pod.position.set(0.06, -0.14, side * 0.42);
      bodyGroup.add(pod);
    }

    // Tail Boom & Fin
    const tailBoom = new THREE.Mesh(geos.unitBox, matBody);
    tailBoom.scale.set(0.76, 0.16, 0.16);
    tailBoom.position.set(-0.68, 0.06, 0);
    bodyGroup.add(tailBoom);

    const tailFin = new THREE.Mesh(geos.unitBox, matAccent);
    tailFin.scale.set(0.24, 0.36, 0.08);
    tailFin.position.set(-0.98, 0.18, 0);
    bodyGroup.add(tailFin);

    // Main Rotor Assembly
    const mainRotorGroup = new THREE.Group();
    mainRotorGroup.position.set(0.04, 0.3, 0);
    const blade1 = new THREE.Mesh(geos.unitBox, matRotor);
    blade1.scale.set(1.68, 0.03, 0.12);
    const blade2 = new THREE.Mesh(geos.unitBox, matRotor);
    blade2.scale.set(0.12, 0.03, 1.68);
    mainRotorGroup.add(blade1, blade2);
    bodyGroup.add(mainRotorGroup);
    animParts.rotors.push(mainRotorGroup);

    // Tail Rotor
    const tailRotorGroup = new THREE.Group();
    tailRotorGroup.position.set(-1.02, 0.2, 0.08);
    const tBlade = new THREE.Mesh(geos.unitBox, matRotor);
    tBlade.scale.set(0.38, 0.06, 0.03);
    tailRotorGroup.add(tBlade);
    bodyGroup.add(tailRotorGroup);
    animParts.propellers.push(tailRotorGroup);
  } else if (enemy.type === 'zeppelin') {
    // Dreadnought Zeppelin Boss: colossal ribbed blimp with shark-mouth nose art, tail fins, gondola & twin props
    const matHull = makeMat(0x78261e, 0.48, 0.22);
    const matBand = makeMat(0xd6a436, 0.35, 0.55);
    const matGondola = makeMat(0x2e353d, 0.5, 0.45);
    const matTeeth = makeMat(0xf5f5f0, 0.4, 0.05);
    const matEye = makeMat(0xffdd22, 0.2, 0.1);

    // Main Cigar Envelope
    const balloon = new THREE.Mesh(geos.unitSphere, matHull);
    balloon.scale.set(1.95, 0.96, 0.96);
    balloon.position.set(0, 0.12, 0);
    balloon.castShadow = true;
    bodyGroup.add(balloon);

    // Golden Rib Bands
    for (let bx of [-0.38, 0.05, 0.46]) {
      const band = new THREE.Mesh(geos.unitCyl, matBand);
      band.rotation.z = Math.PI * 0.5;
      const rScale = bx === 0.05 ? 0.99 : 0.88;
      band.scale.set(rScale, 0.08, rScale);
      band.position.set(bx, 0.12, 0);
      bodyGroup.add(band);
    }

    // Shark-Mouth Nose Art & Angry Eyes on Forward Cone
    const jaw = new THREE.Mesh(geos.unitBox, matTeeth);
    jaw.scale.set(0.36, 0.14, 0.66);
    jaw.position.set(0.72, -0.02, 0);
    bodyGroup.add(jaw);

    for (let side of [-1, 1]) {
      const eye = new THREE.Mesh(geos.unitBox, matEye);
      eye.scale.set(0.18, 0.12, 0.08);
      eye.position.set(0.68, 0.26, side * 0.34);
      eye.rotation.z = -0.25;
      bodyGroup.add(eye);
    }

    // Cruciform Tail Fins
    const vFin = new THREE.Mesh(geos.unitBox, matBand);
    vFin.scale.set(0.46, 0.92, 0.08);
    vFin.position.set(-0.82, 0.12, 0);
    const hFin = new THREE.Mesh(geos.unitBox, matBand);
    hFin.scale.set(0.46, 0.08, 0.92);
    hFin.position.set(-0.82, 0.12, 0);
    bodyGroup.add(vFin, hFin);

    // Armored Ventral Gondola & Twin Pusher Propellers
    const gondola = new THREE.Mesh(geos.unitBox, matGondola);
    gondola.scale.set(0.88, 0.28, 0.38);
    gondola.position.set(0.02, -0.44, 0);
    gondola.castShadow = true;
    bodyGroup.add(gondola);

    for (let side of [-1, 1]) {
      const propGroup = new THREE.Group();
      propGroup.position.set(-0.44, -0.42, side * 0.28);
      const blade = new THREE.Mesh(geos.unitBox, matBand);
      blade.scale.set(0.04, 0.36, 0.08);
      propGroup.add(blade);
      bodyGroup.add(propGroup);
      animParts.propellers.push(propGroup);
    }

    // High-damage scorch decals on Zeppelin hull
    const scorchGroup = new THREE.Group();
    scorchGroup.visible = false;
    const scorchMat = new THREE.MeshBasicMaterial({ color: 0x161210 });
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6611 });
    const patch = new THREE.Mesh(geos.unitBox, scorchMat);
    patch.scale.set(0.62, 0.32, 1.02);
    patch.position.set(-0.12, 0.16, 0);
    const flame = new THREE.Mesh(geos.unitBox, fireMat);
    flame.scale.set(0.32, 0.14, 1.04);
    flame.position.set(-0.12, 0.16, 0);
    scorchGroup.add(patch, flame);
    bodyGroup.add(scorchGroup);
    animParts.damageDecals.push(scorchGroup);
  }

  // Ground / Air Drop Shadow Disc (projected onto y = 0.04 in world space)
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: enemy.isAir ? 0.38 : 0.28,
    depthWrite: false
  });
  const shadowMesh = new THREE.Mesh(geos.shadowCircle, shadowMat);
  shadowMesh.rotation.x = -Math.PI * 0.5;
  const sr = def.shadowRadius || 0.5;
  shadowMesh.scale.set(sr * (enemy.isAir ? 1.35 : 1.15), sr, 1);
  shadowMesh.position.set(0, 0.04 - (enemy.isAir ? def.flyHeight : 0), 0);
  root.add(shadowMesh);
  animParts.shadowMesh = shadowMesh;

  // Status Rings (Green Goo Slow Ring & Blue Tesla Stun Ring)
  const slowRingMat = new THREE.MeshBasicMaterial({
    color: 0x4cff3b,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const slowRing = new THREE.Mesh(geos.ringGeo, slowRingMat);
  slowRing.rotation.x = -Math.PI * 0.5;
  slowRing.scale.set(def.radius * 1.15, def.radius * 1.15, 1);
  slowRing.position.set(0, 0.08, 0);
  slowRing.visible = false;
  root.add(slowRing);
  animParts.slowRing = slowRing;

  const stunRingMat = new THREE.MeshBasicMaterial({
    color: 0x55e6ff,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const stunRing = new THREE.Mesh(geos.ringGeo, stunRingMat);
  stunRing.rotation.x = -Math.PI * 0.5;
  stunRing.scale.set(def.radius * 1.25, def.radius * 1.25, 1);
  stunRing.position.set(0, 0.35, 0);
  stunRing.visible = false;
  root.add(stunRing);
  animParts.stunRing = stunRing;

  // Overhead Health Bar (Billboarded Group)
  const hpGroup = new THREE.Group();
  const barWidth = def.isBoss ? 1.55 : (def.radius * 1.85);
  const barHeight = def.isBoss ? 0.16 : 0.11;
  const localHpY = def.isAir ? (def.healthBarHeight - def.flyHeight) : def.healthBarHeight;
  hpGroup.position.set(0, localHpY, 0);

  const hpBgMat = new THREE.MeshBasicMaterial({
    color: 0x141814,
    transparent: true,
    opacity: 0.85,
    depthTest: false
  });
  const hpBg = new THREE.Mesh(geos.hpPlane, hpBgMat);
  hpBg.scale.set(barWidth + 0.06, barHeight + 0.05, 1);
  hpBg.renderOrder = 998;

  const hpFillMat = new THREE.MeshBasicMaterial({
    color: 0x3be84a,
    depthTest: false
  });
  const hpFill = new THREE.Mesh(geos.hpPlane, hpFillMat);
  hpFill.scale.set(barWidth, barHeight, 1);
  hpFill.position.set(0, 0, 0.005);
  hpFill.renderOrder = 999;

  hpGroup.add(hpBg, hpFill);
  // Hide undamaged non-boss health bars until hit (or always show for bosses)
  hpGroup.visible = Boolean(def.isBoss);
  root.add(hpGroup);

  animParts.hpGroup = hpGroup;
  animParts.hpFill = hpFill;
  animParts.hpFillMat = hpFillMat;
  animParts.hpBarWidth = barWidth;
  animParts.hpBarHeight = barHeight;

  root.userData.enemy = enemy;
  enemy.animParts = animParts;
  return root;
}

// ============================================================================
// 4. NAVIGATION, REROUTING & STATUS EFFECTS (EnemyUnit)
// ============================================================================

let _nextEnemyUid = 1;

/**
 * Normalizes any path representation returned by `grid.computePathFromWorld(x, z)`.
 */
function normalizeWaypoints(rawPath) {
  if (!rawPath) return [];
  const list = Array.isArray(rawPath)
    ? rawPath
    : (Array.isArray(rawPath.waypoints)
      ? rawPath.waypoints
      : (Array.isArray(rawPath.path) ? rawPath.path : []));

  const out = [];
  for (let i = 0; i < list.length; i++) {
    const pt = list[i];
    if (!pt) continue;
    if (Array.isArray(pt) && pt.length >= 2) {
      out.push({ x: Number(pt[0]) || 0, z: Number(pt[1]) || 0 });
    } else if (typeof pt.x === 'number' && typeof pt.z === 'number') {
      out.push({ x: pt.x, z: pt.z });
    } else if (typeof pt.col === 'number' && typeof pt.row === 'number' && typeof rawPath.gridToWorld === 'function') {
      const w = rawPath.gridToWorld(pt.col, pt.row);
      out.push({ x: w.x, z: w.z });
    }
  }
  return out;
}

class EnemyUnit {
  constructor(type = 'grunt', options = {}) {
    const def = ENEMY_DEFS[type] || ENEMY_DEFS.grunt;
    this.id = options.id || _nextEnemyUid++;
    this.uid = this.id;
    this.type = def.id;
    this.name = def.name;
    this.def = def;

    this.isAir = Boolean(def.isAir);
    this.isBoss = Boolean(options.isBoss !== undefined ? options.isBoss : def.isBoss);
    this.flyHeight = this.isAir ? (options.flyHeight ?? def.flyHeight) : 0.0;

    // Health, Speed & Rewards
    this.hpMultiplier = typeof options.hpMultiplier === 'number' ? options.hpMultiplier : 1.0;
    this.speedMultiplier = typeof options.speedMultiplier === 'number' ? options.speedMultiplier : 1.0;
    this.maxHp = Math.max(1, Math.round(def.baseHp * this.hpMultiplier));
    this.hp = this.maxHp;
    this.baseSpeed = def.speed * this.speedMultiplier;
    this.speed = this.baseSpeed;
    this.bounty = typeof options.bounty === 'number' ? options.bounty : def.bounty;
    this.score = typeof options.score === 'number' ? options.score : def.score;
    this.livesCost = typeof options.livesCost === 'number' ? options.livesCost : def.livesCost;
    this.radius = def.radius;
    this.scale = def.scale;

    // World Transform & Shadow Coordinates
    this.spawnZ = typeof options.laneZ === 'number'
      ? options.laneZ
      : (typeof options.z === 'number' ? options.z : 0.0);
    this.x = typeof options.x === 'number' ? options.x : WORLD_WEST_SPAWN_X;
    this.z = typeof options.z === 'number' ? options.z : this.spawnZ;
    this.y = this.isAir ? this.flyHeight : 0.0;

    this.exitX = typeof options.exitX === 'number' ? options.exitX : WORLD_EAST_EXIT_X;
    this.exitZ = this.isAir ? this.spawnZ : (typeof options.exitZ === 'number' ? options.exitZ : 0.0);

    // Drop Shadow coordinates on the ground/towers below
    this.shadowX = this.x;
    this.shadowZ = this.z;

    // Velocity & Orientation
    this.vx = this.baseSpeed;
    this.vz = 0;
    this.heading = 0; // 0 rad = facing +X (East)
    this.rotationY = 0;
    this.bankAngle = 0;
    this.pitchAngle = 0;

    // Sub-unit scatter burst (when Grunts pop out of destroyed Armored Transport)
    this.scatterVx = options.scatterVx || 0;
    this.scatterVz = options.scatterVz || 0;
    this.scatterTimer = options.scatterDuration || 0;
    this.scatterTotalDuration = this.scatterTimer;

    // Status Effects
    this.slowFactor = 1.0;
    this.slowTimer = 0.0;
    this.stunTimer = 0.0;
    this.hitFlashTimer = 0.0;
    this.showDamageDecal = false;

    // Lifecycle & Animation Timers
    this.age = typeof options.phaseOffset === 'number' ? options.phaseOffset : (this.id * 0.37) % 3.14;
    this.walkPhase = this.age * (def.bobSpeed || 10.0);
    this.exhaustTimer = 0.0;
    this.isDead = false;
    this.dead = false;
    this.alive = true;
    this.active = true;
    this.hasReachedExit = false;
    this.reachedExit = false;

    // Navigation & Waypoints
    this.waypoints = [];
    this.waypointIndex = 0;
    this.remainingPathDist = Math.max(0, this.exitX - this.x);
    this.remainingDist = this.remainingPathDist;
    this.distToExit = this.remainingPathDist;
    this.distanceToExit = this.remainingPathDist;
    this.pathProgress = 0;
    this.stuckTimer = 0;
    this.lastProgressDist = this.remainingPathDist;

    // Initialize path if grid or waypoints supplied
    if (Array.isArray(options.waypoints) && options.waypoints.length > 0) {
      this.setWaypoints(options.waypoints, false);
    } else if (!this.isAir && options.grid) {
      this.reroute(options.grid, true);
    }

    // 3D Mesh / Visual handle
    this.mesh = null;
    this.group = null;
    this.animParts = null;

    const THREE = (typeof window !== 'undefined' && window.THREE) || options.THREE || null;
    if (options.visuals && typeof options.visuals.createEnemyMesh === 'function') {
      this.mesh = options.visuals.createEnemyMesh(this.type, this.def, this);
    }
    if (!this.mesh && THREE) {
      this.mesh = buildProceduralEnemyMesh(this, THREE);
    }
    this.group = this.mesh;
    this.syncMeshTransform();
  }

  get isSlowed() {
    return this.slowTimer > 0 && this.slowFactor < 0.99;
  }

  set isSlowed(val) {
    if (!val) {
      this.slowTimer = 0;
      this.slowFactor = 1.0;
    } else if (this.slowTimer <= 0) {
      this.slowTimer = 1.5;
      if (this.slowFactor >= 0.99) this.slowFactor = 0.6;
    }
  }

  get isStunned() {
    return this.stunTimer > 0;
  }

  set isStunned(val) {
    if (!val) {
      this.stunTimer = 0;
    } else if (this.stunTimer <= 0) {
      this.stunTimer = 0.25;
    }
  }

  /**
   * Returns world-space hit target position (chest height for ground units, flight altitude for air units).
   */
  getTargetPosition(out = null) {
    const ty = this.isAir ? this.y : (this.y + (this.def.hitHeight || 0.65));
    if (out && typeof out.set === 'function') {
      out.set(this.x, ty, this.z);
      return out;
    }
    return { x: this.x, y: ty, z: this.z };
  }

  /**
   * Applies green Goo slow status effect.
   */
  applySlow(factor = 0.45, duration = 2.8) {
    if (this.isDead) return;
    const clampedFactor = Math.max(0.15, Math.min(1.0, Number(factor) || 0.45));
    const validDuration = Math.max(0, Number(duration) || 0);
    this.slowFactor = Math.min(this.slowFactor, clampedFactor);
    this.slowTimer = Math.max(this.slowTimer, validDuration);
  }

  /**
   * Applies Tesla / shock stun status effect.
   */
  applyStun(duration = 0.65) {
    if (this.isDead) return;
    const validDuration = Math.max(0, Number(duration) || 0);
    this.stunTimer = Math.max(this.stunTimer, validDuration);
  }

  /**
   * Assigns new waypoints without teleporting or causing backward turn-around stutter.
   */
  setWaypoints(rawWaypoints, isInitialSpawn = false) {
    const pts = normalizeWaypoints(rawWaypoints);
    if (pts.length === 0) return;

    this.waypoints = pts;
    this.waypointIndex = 0;

    if (!isInitialSpawn && pts.length >= 2) {
      // Check if unit has already progressed past pts[0] along the segment pts[0] -> pts[1]
      const p0 = pts[0];
      const p1 = pts[1];
      const segDx = p1.x - p0.x;
      const segDz = p1.z - p0.z;
      const segLenSq = segDx * segDx + segDz * segDz;
      const toUnitX = this.x - p0.x;
      const toUnitZ = this.z - p0.z;
      const distToP0 = Math.hypot(toUnitX, toUnitZ);

      if (distToP0 < 0.35) {
        this.waypointIndex = 1;
      } else if (segLenSq > 0.0001) {
        const proj = (toUnitX * segDx + toUnitZ * segDz) / segLenSq;
        if (proj > 0.08 && proj <= 1.15) {
          this.waypointIndex = 1;
        }
      }
    }

    const lastWp = pts[pts.length - 1];
    if (lastWp && lastWp.x > 10) {
      this.exitX = Math.max(lastWp.x, WORLD_EAST_EXIT_X - 1.2);
      this.exitZ = lastWp.z;
    }

    this.updateRemainingPathDist();
  }

  /**
   * Queries `grid.computePathFromWorld(this.x, this.z)` and updates waypoints smoothly.
   */
  reroute(grid, isInitialSpawn = false) {
    if (this.isAir || this.isDead || !grid) return;

    let rawPath = null;
    if (typeof grid.computePathFromWorld === 'function') {
      rawPath = grid.computePathFromWorld(this.x, this.z);
    } else if (typeof grid.findPathFromWorld === 'function') {
      rawPath = grid.findPathFromWorld(this.x, this.z);
    } else if (typeof grid.getPathFromWorld === 'function') {
      rawPath = grid.getPathFromWorld(this.x, this.z);
    } else if (typeof grid.getCurrentPath === 'function') {
      rawPath = grid.getCurrentPath();
    } else if (Array.isArray(grid.currentPath)) {
      rawPath = grid.currentPath;
    } else if (Array.isArray(grid.waypoints)) {
      rawPath = grid.waypoints;
    }

    if (rawPath) {
      this.setWaypoints(rawPath, isInitialSpawn);
    } else if (this.waypoints.length === 0) {
      this.waypoints = [{ x: this.exitX, z: 0 }];
      this.waypointIndex = 0;
      this.updateRemainingPathDist();
    }
  }

  /**
   * Computes exact remaining distance along the path to the East Exit every frame
   * so `'first'` targeting priority always selects the creep closest to escaping.
   */
  updateRemainingPathDist() {
    if (this.isAir) {
      this.remainingPathDist = Math.max(0, this.exitX - this.x);
      this.remainingDist = this.remainingPathDist;
      this.distToExit = this.remainingPathDist;
      this.distanceToExit = this.remainingPathDist;
      const totalSpan = Math.max(1, this.exitX - WORLD_WEST_SPAWN_X);
      this.pathProgress = Math.max(0, Math.min(1, 1 - this.remainingPathDist / totalSpan));
      return this.remainingPathDist;
    }

    if (!this.waypoints || this.waypoints.length === 0) {
      this.remainingPathDist = Math.max(0, Math.hypot(this.exitX - this.x, this.exitZ - this.z));
      this.remainingDist = this.remainingPathDist;
      this.distToExit = this.remainingPathDist;
      this.distanceToExit = this.remainingPathDist;
      return this.remainingPathDist;
    }

    const idx = Math.min(this.waypointIndex, this.waypoints.length - 1);
    const targetWp = this.waypoints[idx];
    let dist = Math.hypot(targetWp.x - this.x, targetWp.z - this.z);

    for (let i = idx; i < this.waypoints.length - 1; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[i + 1];
      dist += Math.hypot(b.x - a.x, b.z - a.z);
    }

    this.remainingPathDist = dist;
    this.remainingDist = dist;
    this.distToExit = dist;
    this.distanceToExit = dist;
    this.pathProgress = Math.max(0, 100 - dist);
    return dist;
  }

  /**
   * Strict tower-footprint repulsion (`repelFromTowers(grid)`):
   * Ensures ground creeps NEVER get stuck on a tile corner or clip inside a tower dome!
   */
  repelFromTowers(grid) {
    if (this.isAir || this.isDead || !grid) return;

    const tileSize = Number(grid.tileSize || grid.cellSize || 2.0);
    const towerFootprintRadius = tileSize * 0.48;
    const minAllowableDist = towerFootprintRadius + Math.min(0.42, this.radius * 0.68);

    // Collect nearby tower world positions from any supported grid interface
    const obstacleCenters = [];

    if (typeof grid.getNearbyTowerCenters === 'function') {
      const list = grid.getNearbyTowerCenters(this.x, this.z);
      if (Array.isArray(list)) {
        for (let i = 0; i < list.length; i++) obstacleCenters.push(list[i]);
      }
    } else if (typeof grid.worldToGrid === 'function' && typeof grid.gridToWorld === 'function') {
      const cell = grid.worldToGrid(this.x, this.z);
      if (cell) {
        const cCol = cell.col !== undefined ? cell.col : cell.x;
        const cRow = cell.row !== undefined ? cell.row : cell.y;
        if (typeof cCol === 'number' && typeof cRow === 'number') {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const col = cCol + dc;
              const row = cRow + dr;
              let hasTower = false;
              if (typeof grid.hasTowerAt === 'function') {
                hasTower = Boolean(grid.hasTowerAt(col, row));
              } else if (typeof grid.getTowerAt === 'function') {
                hasTower = Boolean(grid.getTowerAt(col, row));
              } else if (typeof grid.isTowerCell === 'function') {
                hasTower = Boolean(grid.isTowerCell(col, row));
              } else if (typeof grid.isCellBlocked === 'function') {
                // Only repel from interior playfield cells (avoid repelling from spawn/exit gate tunnels)
                hasTower = Boolean(grid.isCellBlocked(col, row)) && Math.abs(this.x) < 17.5;
              } else if (Array.isArray(grid.cells) && grid.cells[row] && grid.cells[row][col]) {
                const tile = grid.cells[row][col];
                hasTower = Boolean(tile.tower || tile.hasTower || tile.occupied);
              }
              if (hasTower) {
                const w = grid.gridToWorld(col, row);
                if (w && typeof w.x === 'number' && typeof w.z === 'number') {
                  obstacleCenters.push(w);
                }
              }
            }
          }
        }
      }
    } else if (Array.isArray(grid.towers)) {
      for (let i = 0; i < grid.towers.length; i++) {
        const t = grid.towers[i];
        if (t && typeof t.x === 'number' && typeof t.z === 'number') {
          if (Math.abs(t.x - this.x) <= tileSize * 1.5 && Math.abs(t.z - this.z) <= tileSize * 1.5) {
            obstacleCenters.push({ x: t.x, z: t.z });
          }
        }
      }
    }

    // Apply radial push-out & velocity slide around tower footprints
    for (let i = 0; i < obstacleCenters.length; i++) {
      const obs = obstacleCenters[i];
      let dx = this.x - obs.x;
      let dz = this.z - obs.z;
      let dist = Math.hypot(dx, dz);

      if (dist < minAllowableDist) {
        if (dist < 0.0001) {
          dx = 1;
          dz = 0;
          dist = 1;
        }
        const nx = dx / dist;
        const nz = dz / dist;
        const penetration = minAllowableDist - dist;

        // Push position cleanly outside tower footprint
        this.x += nx * penetration;
        this.z += nz * penetration;

        // Remove inward velocity component so unit glides tangentially around corner
        const vn = this.vx * nx + this.vz * nz;
        if (vn < 0) {
          this.vx -= vn * nx;
          this.vz -= vn * nz;
        }
      }
    }
  }

  /**
   * Deducts HP, triggers hit flash, and executes death routine (bounty, score, sub-unit spawnOnDeath, VFX, audio).
   * Returns `true` if this damage call killed the unit, `false` otherwise.
   */
  takeDamage(amount, sourceType = 'gatling', hitPos = null, context = null) {
    if (this.isDead) return false;
    const dmg = Math.max(0, Number(amount) || 0);
    if (dmg <= 0) return false;

    this.hp = Math.max(0, this.hp - dmg);
    this.hitFlashTimer = 0.12;

    if (this.def.highDamageDecal && this.hp <= this.maxHp * 0.5) {
      this.showDamageDecal = true;
    }

    // Reveal overhead HP bar when damaged
    if (this.animParts && this.animParts.hpGroup) {
      this.animParts.hpGroup.visible = true;
    }

    const waveSystem = context?.waveSystem || this._waveSystem || null;
    const visuals = context?.visuals || waveSystem?.visuals || null;
    const audio = context?.audio || waveSystem?.audio || null;
    const callbacks = context?.callbacks || waveSystem?.callbacks || null;

    if (visuals && typeof visuals.spawnHitEffect === 'function') {
      visuals.spawnHitEffect(
        hitPos || { x: this.x, y: this.isAir ? this.y : this.def.hitHeight, z: this.z },
        sourceType,
        this
      );
    }

    if (this.hp <= 0) {
      this.die({ sourceType, hitPos, waveSystem, visuals, audio, callbacks });
      return true;
    }

    return false;
  }

  /**
   * Handles death rewards, sub-unit `spawnOnDeath` (3 Grunts popping out of Armored Transport), VFX, and audio.
   */
  die(context = {}) {
    if (this.isDead) return;
    this.isDead = true;
    this.dead = true;
    this.alive = false;
    this.active = false;
    this.hp = 0;

    const waveSystem = context.waveSystem || this._waveSystem || null;
    const visuals = context.visuals || waveSystem?.visuals || null;
    const audio = context.audio || waveSystem?.audio || null;
    const callbacks = context.callbacks || waveSystem?.callbacks || null;
    const grid = context.grid || waveSystem?.grid || null;

    const spawnedChildren = [];

    // Spawn sub-units on death (e.g., Armored Transport deploys 3 Grunts with short scatter velocities!)
    if (this.def.spawnOnDeath && waveSystem && typeof waveSystem.spawnEnemy === 'function') {
      const childType = this.def.spawnOnDeath.type || 'grunt';
      const childCount = Math.max(1, this.def.spawnOnDeath.count || 3);
      const remainingWps = this.waypoints.slice(Math.max(0, this.waypointIndex));

      for (let i = 0; i < childCount; i++) {
        const angle = this.heading + ((i - (childCount - 1) * 0.5) * 1.05);
        const scatterSpeed = 2.6 + (i % 2) * 0.6;
        const offsetDist = 0.22;
        const child = waveSystem.spawnEnemy(childType, {
          x: this.x + Math.cos(angle) * offsetDist,
          z: this.z + Math.sin(angle) * offsetDist,
          hpMultiplier: this.hpMultiplier,
          speedMultiplier: this.speedMultiplier,
          scatterVx: Math.cos(angle) * scatterSpeed,
          scatterVz: Math.sin(angle) * scatterSpeed,
          scatterDuration: 0.28,
          waypoints: remainingWps.length > 0 ? remainingWps : undefined,
          grid,
          visuals
        });
        if (child) spawnedChildren.push(child);
      }
    }

    // Update WaveSystem stats if attached
    if (waveSystem && waveSystem.stats) {
      waveSystem.stats.totalKilled += 1;
      waveSystem.stats.totalGoldEarned += this.bounty;
      waveSystem.stats.totalScoreEarned += this.score;
    }

    // Trigger Death Visuals & Floating Gold Text
    const deathY = this.isAir ? this.y : (this.y + this.def.hitHeight);
    if (visuals) {
      if (typeof visuals.spawnDeathEffect === 'function') {
        visuals.spawnDeathEffect(this);
      } else if (typeof visuals.spawnExplosion === 'function') {
        visuals.spawnExplosion(this.x, deathY, this.z, this.def.scale, this.type);
      }
      if (typeof visuals.spawnFloatingText === 'function') {
        visuals.spawnFloatingText(`+$${this.bounty}`, this.x, deathY + 0.6, this.z, '#ffd54f');
      }
    }

    // Trigger Comic Scream / Explosion Audio
    if (audio) {
      if (typeof audio.playEnemyDeath === 'function') {
        audio.playEnemyDeath(this.type, this.isAir, this.isBoss);
      } else if (this.type === 'grunt' || this.type === 'biker') {
        if (typeof audio.playScream === 'function') audio.playScream();
        else if (typeof audio.playSfx === 'function') audio.playSfx('enemy_death');
      } else {
        if (typeof audio.playExplosion === 'function') {
          audio.playExplosion(this.isBoss ? 'large' : 'medium');
        } else if (typeof audio.playSfx === 'function') {
          audio.playSfx('explosion');
        }
      }
    }

    // Fire Reward Callbacks
    const rewardPayload = {
      enemy: this,
      id: this.id,
      type: this.type,
      name: this.name,
      bounty: this.bounty,
      gold: this.bounty,
      score: this.score,
      isAir: this.isAir,
      isBoss: this.isBoss,
      x: this.x,
      y: deathY,
      z: this.z,
      spawnedChildren
    };

    if (callbacks) {
      if (typeof callbacks.onEnemyKilled === 'function') callbacks.onEnemyKilled(this, rewardPayload);
      if (typeof callbacks.onEnemyDeath === 'function') callbacks.onEnemyDeath(this, this.bounty, this.score, rewardPayload);
      if (typeof callbacks.onGoldEarned === 'function') callbacks.onGoldEarned(this.bounty, this);
      if (typeof callbacks.onScoreEarned === 'function') callbacks.onScoreEarned(this.score, this);
    }
    if (waveSystem) {
      if (typeof waveSystem.onEnemyKilled === 'function') waveSystem.onEnemyKilled(this, rewardPayload);
      if (typeof waveSystem.onEnemyDeath === 'function') waveSystem.onEnemyDeath(this, this.bounty, this.score, rewardPayload);
    }

    this.lastDeathResult = {
      killed: true,
      bounty: this.bounty,
      score: this.score,
      spawnedChildren
    };
  }

  /**
   * Per-frame update for status timers, path/air steering, tower repulsion, and 3D animation.
   */
  update(dt, grid, visuals, audio, callbacks, waveSystem) {
    if (this.isDead || this.dead || this.hasReachedExit || this.reachedExit) return;
    const safeDt = Math.min(0.1, Math.max(0.0, Number(dt) || 0));
    if (safeDt <= 0) return;

    this.age += safeDt;

    // 1. Update Status Effect Timers
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - safeDt);
    }
    if (this.slowTimer > 0) {
      this.slowTimer = Math.max(0, this.slowTimer - safeDt);
      if (this.slowTimer <= 0) {
        this.slowFactor = 1.0;
      }
    }
    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - safeDt);
    }

    // Compute effective movement speed
    const effectiveSpeed = this.stunTimer > 0
      ? 0.0
      : this.baseSpeed * this.slowFactor;
    this.speed = effectiveSpeed;

    // 2. Movement: Air vs Ground
    if (this.isAir) {
      // Air Units: fly straight West -> East ignoring all ground mazes
      if (effectiveSpeed > 0) {
        this.vx = effectiveSpeed;
        this.vz = 0;
        this.x += this.vx * safeDt;
      }
      // Subtle sinusoidal bobbing & banking animation
      const bobOffset = Math.sin(this.age * 2.5) * 0.12;
      this.y = this.flyHeight + bobOffset;
      this.heading = 0;
      this.rotationY = 0;
      this.bankAngle = Math.sin(this.age * 2.5) * 0.12;
      this.pitchAngle = this.type === 'chopper' ? -0.14 : 0.0;

      // Crisp ground drop shadow directly beneath the air unit
      this.shadowX = this.x;
      this.shadowZ = this.z;

      this.updateRemainingPathDist();

      if (this.x >= this.exitX) {
        this.hasReachedExit = true;
        this.reachedExit = true;
      }
    } else {
      // Ground Units: handle scatter burst (if freshly spawned from Transport) + smooth corner-rounding path following
      if (this.scatterTimer > 0) {
        this.scatterTimer = Math.max(0, this.scatterTimer - safeDt);
        const scatterProgress = 1.0 - (this.scatterTimer / Math.max(0.01, this.scatterTotalDuration));
        this.x += this.scatterVx * safeDt;
        this.z += this.scatterVz * safeDt;
        this.y = Math.sin(scatterProgress * Math.PI) * 0.42;
        this.repelFromTowers(grid);
        if (this.scatterTimer <= 0) {
          this.y = 0;
          this.reroute(grid, false);
        }
      } else if (effectiveSpeed > 0) {
        this.y = 0;
        if (!this.waypoints || this.waypoints.length === 0) {
          this.reroute(grid, false);
        }

        // Advance waypoint index with lookahead corner rounding radius
        const cornerRadius = Math.min(0.62, Math.max(0.34, this.radius * 0.85));
        while (this.waypointIndex < this.waypoints.length - 1) {
          const wp = this.waypoints[this.waypointIndex];
          const d = Math.hypot(wp.x - this.x, wp.z - this.z);
          if (d <= cornerRadius) {
            this.waypointIndex += 1;
          } else {
            break;
          }
        }

        const currentWp = this.waypoints[this.waypointIndex] || { x: this.exitX, z: this.exitZ };
        let targetX = currentWp.x;
        let targetZ = currentWp.z;

        // Lookahead blend toward next segment when rounding corners
        if (this.waypointIndex < this.waypoints.length - 1) {
          const nextWp = this.waypoints[this.waypointIndex + 1];
          const distToCurr = Math.hypot(currentWp.x - this.x, currentWp.z - this.z);
          const blendZone = cornerRadius * 2.1;
          if (distToCurr < blendZone) {
            const blend = Math.max(0, Math.min(0.45, (1.0 - distToCurr / blendZone) * 0.45));
            targetX = currentWp.x + (nextWp.x - currentWp.x) * blend;
            targetZ = currentWp.z + (nextWp.z - currentWp.z) * blend;
          }
        }

        const dx = targetX - this.x;
        const dz = targetZ - this.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.001) {
          const dirX = dx / dist;
          const dirZ = dz / dist;
          const step = Math.min(dist + 0.05, effectiveSpeed * safeDt);
          this.vx = dirX * effectiveSpeed;
          this.vz = dirZ * effectiveSpeed;
          this.x += dirX * step;
          this.z += dirZ * step;

          // Smooth heading interpolation
          const desiredHeading = Math.atan2(-dirZ, dirX);
          let angleDiff = desiredHeading - this.heading;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          const turnRate = Math.min(1.0, safeDt * 14.0);
          this.heading += angleDiff * turnRate;
          this.rotationY = this.heading;
          this.bankAngle = this.type === 'biker' ? Math.max(-0.35, Math.min(0.35, -angleDiff * 0.65)) : 0;
        }

        // Strict tower-footprint repulsion so creeps never snag on corners or clip inside tower domes
        this.repelFromTowers(grid);
      }

      this.shadowX = this.x;
      this.shadowZ = this.z;

      const prevRem = this.remainingPathDist;
      this.updateRemainingPathDist();

      // Anti-stuck safeguard: if a ground unit isn't stunned and makes zero progress for 0.55s, reroute
      if (effectiveSpeed > 0.1) {
        if (Math.abs(prevRem - this.remainingPathDist) < 0.005) {
          this.stuckTimer += safeDt;
          if (this.stuckTimer > 0.55) {
            this.stuckTimer = 0;
            this.reroute(grid, false);
          }
        } else {
          this.stuckTimer = 0;
        }
      }

      // Check East Exit arrival
      const finalWp = this.waypoints[this.waypoints.length - 1];
      const distToFinal = finalWp ? Math.hypot(finalWp.x - this.x, finalWp.z - this.z) : 999;
      if (
        this.x >= this.exitX - 0.35 ||
        (this.waypointIndex >= this.waypoints.length - 1 && distToFinal <= 0.38)
      ) {
        this.hasReachedExit = true;
        this.reachedExit = true;
      }
    }

    // 3. Exhaust Smoke Puffs & High-Damage Smoke VFX
    if (this.def.exhaustSmoke && effectiveSpeed > 0) {
      this.exhaustTimer += safeDt;
      const interval = this.showDamageDecal
        ? (this.def.exhaustInterval || 0.15) * 0.55
        : (this.def.exhaustInterval || 0.15);
      if (this.exhaustTimer >= interval) {
        this.exhaustTimer = 0;
        const backX = this.x - Math.cos(this.heading) * (this.radius * 0.75);
        const backZ = this.z + Math.sin(this.heading) * (this.radius * 0.75);
        const puffY = this.isAir ? this.y - 0.2 : (this.y + this.def.hitHeight * 0.65);
        if (visuals) {
          if (typeof visuals.spawnExhaustPuff === 'function') {
            visuals.spawnExhaustPuff(backX, puffY, backZ, this.def.scale, this.showDamageDecal);
          } else if (typeof visuals.spawnSmokePuff === 'function') {
            visuals.spawnSmokePuff(backX, puffY, backZ, this.def.scale);
          }
        }
      }
    }

    // 4. Advance Walk / Rotor Animation & Sync Three.js Mesh
    if (effectiveSpeed > 0) {
      this.walkPhase += safeDt * (this.def.bobSpeed || 10.0) * (effectiveSpeed / Math.max(0.5, this.baseSpeed));
    }
    this.syncMeshTransform(safeDt);
  }

  /**
   * Synchronizes the 3D Three.js Group, articulated limbs/wheels/rotors, status overlays,
   * drop shadow, and overhead health bar.
   */
  syncMeshTransform(dt = 0.016) {
    if (!this.mesh) return;

    // Stun electric jitter offset
    const jitterX = this.stunTimer > 0 ? (Math.sin(this.age * 75.0) * 0.06) : 0;
    const jitterZ = this.stunTimer > 0 ? (Math.cos(this.age * 68.0) * 0.06) : 0;

    this.mesh.position.set(this.x + jitterX, this.y, this.z + jitterZ);

    const parts = this.animParts;
    if (!parts) {
      this.mesh.rotation.y = this.rotationY;
      return;
    }

    // Rotate bodyGroup to match heading, pitch, and bank
    if (parts.bodyGroup) {
      parts.bodyGroup.rotation.set(this.bankAngle, this.rotationY, this.pitchAngle);

      // Comical Argon Towers vertical run bob for ground units
      if (!this.isAir) {
        const bob = Math.abs(Math.sin(this.walkPhase)) * (this.def.bobAmplitude || 0.08);
        parts.bodyGroup.position.y = bob;
      } else {
        parts.bodyGroup.position.y = 0;
      }
    }

    // Articulated Legs (Grunt & Goliath Mech)
    if (parts.legs && parts.legs.length > 0) {
      const swing = Math.sin(this.walkPhase) * (this.type === 'mech' ? 0.48 : 0.72);
      for (let i = 0; i < parts.legs.length; i++) {
        parts.legs[i].rotation.z = (i % 2 === 0 ? 1 : -1) * swing;
      }
    }

    // Articulated Arms
    if (parts.arms && parts.arms.length > 0) {
      const armSwing = Math.sin(this.walkPhase) * 0.35;
      for (let i = 0; i < parts.arms.length; i++) {
        parts.arms[i].rotation.z = (i % 2 === 0 ? -1 : 1) * armSwing;
      }
    }

    // Spinning Motorcycle & Halftrack Wheels
    if (parts.wheels && parts.wheels.length > 0) {
      const wheelRot = -this.walkPhase * 1.4;
      for (let i = 0; i < parts.wheels.length; i++) {
        parts.wheels[i].rotation.z = wheelRot;
      }
    }

    // Chopper Main Rotor
    if (parts.rotors && parts.rotors.length > 0) {
      const rotorAngle = this.age * 26.0;
      for (let i = 0; i < parts.rotors.length; i++) {
        parts.rotors[i].rotation.y = rotorAngle;
      }
    }

    // Chopper Tail Rotor & Zeppelin Pusher Propellers
    if (parts.propellers && parts.propellers.length > 0) {
      const propAngle = this.age * 24.0;
      for (let i = 0; i < parts.propellers.length; i++) {
        if (this.type === 'chopper') {
          parts.propellers[i].rotation.z = propAngle;
        } else {
          parts.propellers[i].rotation.x = propAngle;
        }
      }
    }

    // Goliath Mech Cannon Recoil / Breathing
    if (parts.cannons && parts.cannons.length > 0) {
      for (let i = 0; i < parts.cannons.length; i++) {
        parts.cannons[i].position.x = 0.08 + Math.sin(this.walkPhase + i * Math.PI) * 0.04;
      }
    }

    // High-damage Battle Scorch Decals (Mech & Zeppelin)
    if (parts.damageDecals && parts.damageDecals.length > 0) {
      for (let i = 0; i < parts.damageDecals.length; i++) {
        parts.damageDecals[i].visible = Boolean(this.showDamageDecal);
      }
    }

    // Keep Ground Drop Shadow anchored at world ground level (y = 0.04) directly below `(shadowX, shadowZ)`
    if (parts.shadowMesh) {
      parts.shadowMesh.position.set(
        this.shadowX - (this.x + jitterX),
        0.04 - this.y,
        this.shadowZ - (this.z + jitterZ)
      );
    }

    // Status Rings & Hit Flash / Goo Tint
    if (parts.slowRing) {
      parts.slowRing.visible = this.isSlowed;
      if (this.isSlowed) {
        parts.slowRing.position.y = (0.08 - this.y) + (this.isAir ? this.flyHeight - 0.35 : 0);
      }
    }
    if (parts.stunRing) {
      parts.stunRing.visible = this.isStunned;
      if (this.isStunned) {
        parts.stunRing.rotation.z = this.age * 12.0;
      }
    }

    if (parts.flashMaterials && parts.flashMaterials.length > 0) {
      for (let i = 0; i < parts.flashMaterials.length; i++) {
        const mat = parts.flashMaterials[i];
        if (!mat || !mat.color) continue;
        if (this.hitFlashTimer > 0) {
          mat.color.setHex(0xffffff);
          if (mat.emissive) mat.emissive.setHex(0x664422);
        } else if (this.isStunned) {
          mat.color.setHex(0x70e8ff);
          if (mat.emissive) mat.emissive.setHex(0x114466);
        } else if (this.isSlowed) {
          mat.color.setHex(mat.userData.baseColorHex);
          if (mat.emissive) mat.emissive.setHex(0x184d12);
        } else {
          mat.color.setHex(mat.userData.baseColorHex);
          if (mat.emissive) mat.emissive.setHex(0x000000);
        }
      }
    }

    // Overhead Health Bar Scale & Color
    if (parts.hpFill && parts.hpBarWidth) {
      const ratio = Math.max(0, Math.min(1, this.hp / Math.max(1, this.maxHp)));
      parts.hpFill.scale.x = Math.max(0.001, parts.hpBarWidth * ratio);
      parts.hpFill.position.x = -parts.hpBarWidth * (1 - ratio) * 0.5;
      if (parts.hpFillMat && parts.hpFillMat.color) {
        if (ratio > 0.55) {
          parts.hpFillMat.color.setHex(0x3be84a);
        } else if (ratio > 0.25) {
          parts.hpFillMat.color.setHex(0xffc82e);
        } else {
          parts.hpFillMat.color.setHex(0xf03224);
        }
      }
      if (parts.hpGroup && (ratio < 0.999 || this.isBoss)) {
        parts.hpGroup.visible = true;
      }
    }
  }
}

// ============================================================================
// 5. ENEMY WAVE SYSTEM (EnemyWaveSystem)
// ============================================================================

class EnemyWaveSystem {
  constructor(optionsOrScene = {}, maybeGrid = null, maybeVisuals = null, maybeAudio = null, maybeCallbacks = null) {
    const isOptionsObject =
      optionsOrScene &&
      typeof optionsOrScene === 'object' &&
      !optionsOrScene.isScene &&
      typeof optionsOrScene.add !== 'function';

    const opts = isOptionsObject ? optionsOrScene : {
      scene: optionsOrScene,
      grid: maybeGrid,
      visuals: maybeVisuals,
      audio: maybeAudio,
      callbacks: maybeCallbacks
    };

    this.scene = opts.scene || opts.visuals?.scene || null;
    this.grid = opts.grid || null;
    this.visuals = opts.visuals || null;
    this.audio = opts.audio || null;
    this.callbacks = opts.callbacks || {};

    // Optional direct callback hooks
    this.onEnemyKilled = opts.onEnemyKilled || null;
    this.onEnemyDeath = opts.onEnemyDeath || null;
    this.onEnemyLeak = opts.onEnemyLeak || opts.onEnemyReachedExit || null;
    this.onWaveStart = opts.onWaveStart || null;
    this.onWaveComplete = opts.onWaveComplete || null;
    this.onWarningBanner = opts.onWarningBanner || null;

    // Three.js container group for active enemy meshes
    const THREE = (typeof window !== 'undefined' && window.THREE) || opts.THREE || null;
    this.THREE = THREE;
    this.group = THREE ? new THREE.Group() : null;
    if (this.group) {
      this.group.name = 'EnemyWaveSystemGroup';
      if (this.scene && typeof this.scene.add === 'function') {
        this.scene.add(this.group);
      }
    }

    // Active state
    this.enemies = [];
    this.spawnQueue = [];
    this.currentRound = 0;
    this.totalRounds = 100;
    this.waveActive = false;
    this.waveTimer = 0;
    this.currentWaveDef = null;

    // Warning banner state
    this.currentWarningBanner = null;
    this.warningBannerTimer = 0;

    // Auto-advance wave settings
    this.autoStartNextWave = Boolean(opts.autoStartNextWave);
    this.betweenWaveDelay = typeof opts.betweenWaveDelay === 'number' ? opts.betweenWaveDelay : 7.5;
    this.betweenWaveTimer = 0;

    // Cumulative telemetry / Critic inspection stats
    this.stats = {
      totalSpawned: 0,
      totalKilled: 0,
      totalLeaked: 0,
      totalGoldEarned: 0,
      totalScoreEarned: 0,
      wavesCleared: 0
    };
  }

  // Convenient aliases for external modules
  get activeEnemies() {
    return this.enemies;
  }

  get round() {
    return this.currentRound;
  }

  set round(val) {
    this.currentRound = val;
  }

  get waveNumber() {
    return this.currentRound;
  }

  get isWaveActive() {
    return this.waveActive;
  }

  static getWaveDefinition(roundNumber) {
    return getWaveDefinition(roundNumber);
  }

  getWaveDefinition(roundNumber) {
    return getWaveDefinition(roundNumber);
  }

  /**
   * Attaches a Three.js Scene if it was initialized after EnemyWaveSystem construction.
   */
  attachScene(scene) {
    if (!scene || typeof scene.add !== 'function') return;
    this.scene = scene;
    if (this.group && !this.group.parent) {
      this.scene.add(this.group);
    }
  }

  /**
   * Starts the next wave in sequence (`currentRound + 1`).
   */
  startNextWave(grid = null, callbacks = null) {
    const nextRound = Math.max(1, this.currentRound + 1);
    return this.startWave(nextRound, grid, callbacks);
  }

  /**
   * Starts a specific 1-based `roundNum`.
   */
  startWave(roundNum, grid = null, callbacks = null) {
    if (grid) this.grid = grid;
    if (callbacks) this.callbacks = { ...this.callbacks, ...callbacks };

    const targetRound = Math.max(1, Math.floor(Number(roundNum) || (this.currentRound + 1)));
    this.currentRound = targetRound;

    const waveDef = getWaveDefinition(targetRound);
    this.currentWaveDef = waveDef;
    this.waveActive = true;
    this.waveTimer = 0;
    this.betweenWaveTimer = 0;

    // Clone spawn events into live queue
    this.spawnQueue = waveDef.spawnEvents.map((ev) => ({ ...ev }));

    // Trigger warning banner if wave has one
    if (waveDef.warningBanner) {
      this.currentWarningBanner = waveDef.warningBanner;
      this.warningBannerTimer = 4.2;
      if (this.callbacks && typeof this.callbacks.onWarningBanner === 'function') {
        this.callbacks.onWarningBanner(waveDef.warningBanner, waveDef);
      }
      if (typeof this.onWarningBanner === 'function') {
        this.onWarningBanner(waveDef.warningBanner, waveDef);
      }
    } else {
      this.currentWarningBanner = null;
      this.warningBannerTimer = 0;
    }

    // Audio cues for wave start / air raid / boss
    if (this.audio) {
      if (typeof this.audio.playWaveStart === 'function') {
        this.audio.playWaveStart({
          round: targetRound,
          isAirWave: Boolean(waveDef.hasChoppers),
          isBossWave: Boolean(waveDef.hasZeppelin || waveDef.isBossWave),
          hasChoppers: Boolean(waveDef.hasChoppers),
          hasZeppelin: Boolean(waveDef.hasZeppelin)
        });
      } else if (waveDef.isAirWave && typeof this.audio.playAirRaidSiren === 'function') {
        this.audio.playAirRaidSiren();
      }
    }

    if (this.callbacks && typeof this.callbacks.onWaveStart === 'function') {
      this.callbacks.onWaveStart(targetRound, waveDef);
    }
    if (typeof this.onWaveStart === 'function') {
      this.onWaveStart(targetRound, waveDef);
    }

    return waveDef;
  }

  /**
   * Immediately clears active enemies & jumps directly to `roundNum`, starting that wave.
   */
  jumpToRound(roundNum, grid = null, callbacks = null) {
    this.clearAllEnemies();
    const targetRound = Math.max(1, Math.floor(Number(roundNum) || 1));
    return this.startWave(targetRound, grid, callbacks);
  }

  /**
   * Spawns a single `EnemyUnit` and registers its 3D mesh in the scene.
   */
  spawnEnemy(type = 'grunt', options = {}) {
    const activeGrid = options.grid || this.grid;
    const activeVisuals = options.visuals || this.visuals;

    if (!this.scene && activeVisuals && activeVisuals.scene) {
      this.attachScene(activeVisuals.scene);
    }

    // Determine initial world spawn coordinates
    const def = ENEMY_DEFS[type] || ENEMY_DEFS.grunt;
    let spawnX = typeof options.x === 'number' ? options.x : WORLD_WEST_SPAWN_X;
    let spawnZ = typeof options.z === 'number'
      ? options.z
      : (typeof options.laneZ === 'number' ? options.laneZ : 0.0);

    if (!def.isAir && options.x === undefined && activeGrid) {
      if (typeof activeGrid.getEntranceWorld === 'function') {
        const ent = activeGrid.getEntranceWorld();
        if (ent && typeof ent.x === 'number') {
          spawnX = ent.x;
          if (options.z === undefined && options.laneZ === undefined && typeof ent.z === 'number') {
            spawnZ = ent.z;
          }
        }
      } else if (activeGrid.entranceWorld && typeof activeGrid.entranceWorld.x === 'number') {
        spawnX = activeGrid.entranceWorld.x;
      }
    }

    const unit = new EnemyUnit(type, {
      ...options,
      x: spawnX,
      z: spawnZ,
      grid: activeGrid,
      visuals: activeVisuals,
      THREE: this.THREE
    });
    unit._waveSystem = this;

    // Ensure unit mesh is attached to scene/group
    if (unit.mesh && !unit.mesh.parent) {
      if (this.group) {
        this.group.add(unit.mesh);
      } else if (this.scene && typeof this.scene.add === 'function') {
        this.scene.add(unit.mesh);
      }
    }

    this.enemies.push(unit);
    this.stats.totalSpawned += 1;
    return unit;
  }

  /**
   * Spawns an instant wave of enemies on the battlefield for automated testing & Critic inspection.
   * Supports:
   * - `spawnInstantTestWave()` (default mixed combined-arms showcase of ground + air archetypes)
   * - `spawnInstantTestWave({ round: 16 })` (spawns units from a specific round immediately on field)
   * - `spawnInstantTestWave({ enemies: [{ type: 'chopper', x: -4, z: -2 }, ...] })`
   * - `spawnInstantTestWave(['grunt', 'biker', 'transport', 'mech', 'chopper', 'zeppelin'])`
   */
  spawnInstantTestWave(config = {}) {
    const activeGrid = config?.grid || this.grid;
    const spawned = [];

    if (config && config.clearExisting !== false && config.clearExisting === true) {
      this.clearAllEnemies();
    }

    // Obtain current ground path so test ground units can be placed directly along the active maze
    let pathPts = [];
    if (activeGrid && typeof activeGrid.computePathFromWorld === 'function') {
      pathPts = normalizeWaypoints(activeGrid.computePathFromWorld(WORLD_WEST_SPAWN_X, 0));
    }
    if (pathPts.length < 2) {
      pathPts = [
        { x: -14.0, z: 0.0 },
        { x: -8.0, z: 0.0 },
        { x: -2.0, z: 0.0 },
        { x: 4.0, z: 0.0 },
        { x: 10.0, z: 0.0 },
        { x: 18.5, z: 0.0 }
      ];
    }

    const samplePointAlongPath = (fraction) => {
      const f = Math.max(0.05, Math.min(0.85, fraction));
      const idx = Math.min(pathPts.length - 2, Math.floor(f * (pathPts.length - 1)));
      const localT = (f * (pathPts.length - 1)) - idx;
      const a = pathPts[idx];
      const b = pathPts[idx + 1] || a;
      return {
        x: a.x + (b.x - a.x) * localT,
        z: a.z + (b.z - a.z) * localT,
        remainingWaypoints: pathPts.slice(idx + 1)
      };
    };

    let specs = [];
    if (Array.isArray(config)) {
      specs = config.map((item, i) => (typeof item === 'string' ? { type: item, pathFraction: 0.15 + i * 0.11 } : item));
    } else if (Array.isArray(config?.enemies)) {
      specs = config.enemies;
    } else if (Array.isArray(config?.types)) {
      specs = config.types.map((t, i) => ({ type: t, pathFraction: 0.15 + i * 0.11 }));
    } else if (typeof config?.round === 'number') {
      const wDef = getWaveDefinition(config.round);
      this.currentRound = config.round;
      this.currentWaveDef = wDef;
      const count = Math.min(12, wDef.spawnEvents.length);
      for (let i = 0; i < count; i++) {
        const ev = wDef.spawnEvents[i];
        specs.push({
          type: ev.type,
          hpMultiplier: ev.hpMultiplier,
          speedMultiplier: ev.speedMultiplier,
          laneZ: ev.laneZ,
          pathFraction: 0.12 + (i / Math.max(1, count)) * 0.62
        });
      }
    } else {
      // Default showcase formation featuring all 6 iconic archetypes (ground maze + air bypassers)
      specs = [
        { type: 'grunt', pathFraction: 0.58 },
        { type: 'grunt', pathFraction: 0.53 },
        { type: 'biker', pathFraction: 0.46 },
        { type: 'biker', pathFraction: 0.40 },
        { type: 'transport', pathFraction: 0.33 },
        { type: 'grunt', pathFraction: 0.27 },
        { type: 'mech', pathFraction: 0.20 },
        { type: 'chopper', x: -5.5, z: -3.5 },
        { type: 'chopper', x: 1.5, z: 3.2 },
        { type: 'zeppelin', x: -2.0, z: 0.0, isBoss: true }
      ];
    }

    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      const type = spec.type || 'grunt';
      const def = ENEMY_DEFS[type] || ENEMY_DEFS.grunt;

      let spawnOpts = {
        hpMultiplier: spec.hpMultiplier || 1.0,
        speedMultiplier: spec.speedMultiplier || 1.0,
        isBoss: spec.isBoss,
        grid: activeGrid
      };

      if (def.isAir) {
        spawnOpts.x = typeof spec.x === 'number' ? spec.x : (-10.0 + (i % 5) * 4.2);
        spawnOpts.z = typeof spec.z === 'number'
          ? spec.z
          : (typeof spec.laneZ === 'number' ? spec.laneZ : DEFAULT_AIR_LANES_Z[i % DEFAULT_AIR_LANES_Z.length]);
        spawnOpts.laneZ = spawnOpts.z;
      } else if (typeof spec.x === 'number' && typeof spec.z === 'number') {
        spawnOpts.x = spec.x;
        spawnOpts.z = spec.z;
      } else {
        const frac = typeof spec.pathFraction === 'number' ? spec.pathFraction : (0.15 + (i * 0.08) % 0.65);
        const sampled = samplePointAlongPath(frac);
        spawnOpts.x = sampled.x;
        spawnOpts.z = sampled.z;
        if (sampled.remainingWaypoints && sampled.remainingWaypoints.length > 0) {
          spawnOpts.waypoints = sampled.remainingWaypoints;
        }
      }

      const unit = this.spawnEnemy(type, spawnOpts);
      spawned.push(unit);
    }

    this.waveActive = true;
    if (this.currentRound === 0) this.currentRound = 1;
    return spawned;
  }

  /**
   * Immediately updates waypoints for all active ground enemies from their current `(x, z)`
   * without teleporting or stuttering whenever a tower is placed or sold.
   */
  rerouteAllGroundEnemies(grid = null) {
    const activeGrid = grid || this.grid;
    if (!activeGrid) return;
    this.grid = activeGrid;

    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (enemy && !enemy.isDead && !enemy.isAir) {
        enemy.reroute(activeGrid, false);
      }
    }
  }

  /**
   * Removes an enemy's 3D mesh from the scene and disposes any per-instance resources.
   */
  _removeEnemyMesh(enemy) {
    if (!enemy) return;
    if (this.visuals && typeof this.visuals.removeEnemyVisual === 'function') {
      this.visuals.removeEnemyVisual(enemy);
    }
    if (enemy.mesh && enemy.mesh.parent) {
      enemy.mesh.parent.remove(enemy.mesh);
    }
  }

  /**
   * Main per-frame update loop:
   * - Spawns queued enemies according to wave timeline
   * - Updates all active Ground and Air enemies
   * - Processes East Exit leaks & death cleanup
   * - Fires wave completion rewards when all units are cleared
   */
  update(dt, grid = null, visuals = null, audio = null, callbacks = null) {
    const safeDt = Math.min(0.1, Math.max(0.0, Number(dt) || 0));
    if (grid) this.grid = grid;
    if (visuals) {
      this.visuals = visuals;
      if (!this.scene && visuals.scene) {
        this.attachScene(visuals.scene);
      }
    }
    if (audio) this.audio = audio;
    const activeCallbacks = callbacks || this.callbacks;

    // Update warning banner countdown
    if (this.warningBannerTimer > 0) {
      this.warningBannerTimer = Math.max(0, this.warningBannerTimer - safeDt);
      if (this.warningBannerTimer <= 0) {
        this.currentWarningBanner = null;
      }
    }

    // 1. Process active wave spawn schedule
    if (this.waveActive && this.spawnQueue.length > 0) {
      this.waveTimer += safeDt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].time <= this.waveTimer) {
        const ev = this.spawnQueue.shift();
        this.spawnEnemy(ev.type, {
          laneZ: ev.laneZ,
          hpMultiplier: ev.hpMultiplier,
          speedMultiplier: ev.speedMultiplier,
          isBoss: ev.isBoss,
          grid: this.grid,
          visuals: this.visuals
        });
      }
    }

    // 2. Update all active enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (!enemy.isDead && !enemy.hasReachedExit) {
        enemy.update(safeDt, this.grid, this.visuals, this.audio, activeCallbacks, this);
      }

      // Check if unit reached East Exit (leaked!)
      if (enemy.hasReachedExit && !enemy.isDead) {
        enemy.alive = false;
        this.stats.totalLeaked += 1;

        if (this.audio) {
          if (typeof this.audio.playLeak === 'function') this.audio.playLeak();
          else if (typeof this.audio.playLifeLost === 'function') this.audio.playLifeLost();
          else if (typeof this.audio.playSfx === 'function') this.audio.playSfx('life_lost');
        }

        if (activeCallbacks) {
          if (typeof activeCallbacks.onEnemyLeak === 'function') {
            activeCallbacks.onEnemyLeak(enemy, enemy.livesCost);
          } else if (typeof activeCallbacks.onEnemyReachedExit === 'function') {
            activeCallbacks.onEnemyReachedExit(enemy, enemy.livesCost);
          } else if (typeof activeCallbacks.onLivesLost === 'function') {
            activeCallbacks.onLivesLost(enemy.livesCost, enemy);
          }
        }
        if (typeof this.onEnemyLeak === 'function') {
          this.onEnemyLeak(enemy, enemy.livesCost);
        }

        this._removeEnemyMesh(enemy);
        this.enemies.splice(i, 1);
        continue;
      }

      // Remove dead enemies
      if (enemy.isDead) {
        this._removeEnemyMesh(enemy);
        this.enemies.splice(i, 1);
      }
    }

    // 3. Check Wave Completion
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      this.stats.wavesCleared += 1;
      const completedWaveDef = this.currentWaveDef || getWaveDefinition(this.currentRound);

      if (activeCallbacks) {
        if (typeof activeCallbacks.onWaveComplete === 'function') {
          activeCallbacks.onWaveComplete(this.currentRound, completedWaveDef);
        }
        if (typeof activeCallbacks.onWaveCleared === 'function') {
          activeCallbacks.onWaveCleared(this.currentRound, completedWaveDef);
        }
      }
      if (typeof this.onWaveComplete === 'function') {
        this.onWaveComplete(this.currentRound, completedWaveDef);
      }

      if (this.autoStartNextWave && this.currentRound < this.totalRounds) {
        this.betweenWaveTimer = this.betweenWaveDelay;
      }
    } else if (!this.waveActive && this.autoStartNextWave && this.betweenWaveTimer > 0) {
      this.betweenWaveTimer = Math.max(0, this.betweenWaveTimer - safeDt);
      if (this.betweenWaveTimer <= 0) {
        this.startNextWave(this.grid, activeCallbacks);
      }
    }
  }

  /**
   * Returns all living enemies within `range` of `(x, z)` matching air/ground targeting capabilities,
   * sorted by `priority` (`'first'` picks lowest `remainingPathDist` closest to East Exit).
   */
  getEnemiesInRange(x, z, range, options = {}) {
    const canTargetAir = options.canTargetAir !== undefined ? Boolean(options.canTargetAir) : true;
    const canTargetGround = options.canTargetGround !== undefined ? Boolean(options.canTargetGround) : true;
    const priority = options.priority || 'first';

    const matches = [];
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e || e.isDead || e.hasReachedExit) continue;
      if (e.isAir && !canTargetAir) continue;
      if (!e.isAir && !canTargetGround) continue;

      const d = Math.hypot(e.x - x, e.z - z);
      if (d <= range + e.radius * 0.5) {
        matches.push(e);
      }
    }

    if (matches.length <= 1) return matches;

    matches.sort((a, b) => {
      if (priority === 'strongest') return b.hp - a.hp;
      if (priority === 'weakest') return a.hp - b.hp;
      if (priority === 'closest') {
        return Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z);
      }
      if (priority === 'last') {
        return b.remainingPathDist - a.remainingPathDist;
      }
      // Default `'first'`: creep with minimum remainingPathDist to East Exit
      return a.remainingPathDist - b.remainingPathDist;
    });

    return matches;
  }

  /**
   * Finds the single best target within `range` of `(x, z)`.
   */
  findTarget(x, z, range, priority = 'first', canTargetAir = true, canTargetGround = true) {
    const list = this.getEnemiesInRange(x, z, range, {
      priority,
      canTargetAir,
      canTargetGround
    });
    return list.length > 0 ? list[0] : null;
  }

  /**
   * Applies area-of-effect splash damage (e.g., Missile / Mortar) with optional linear falloff.
   */
  applySplashDamage(x, z, splashRadius, baseDamage, sourceType = 'missile', options = {}) {
    const canTargetAir = options.canTargetAir !== undefined ? Boolean(options.canTargetAir) : true;
    const canTargetGround = options.canTargetGround !== undefined ? Boolean(options.canTargetGround) : true;
    const minFalloff = typeof options.minFalloff === 'number' ? options.minFalloff : 0.45;

    // Copy array because `takeDamage` on a Transport can spawn new Grunts into `this.enemies`
    const snapshot = this.enemies.slice();
    let hitCount = 0;

    for (let i = 0; i < snapshot.length; i++) {
      const e = snapshot[i];
      if (!e || e.isDead || e.hasReachedExit) continue;
      if (e.isAir && !canTargetAir) continue;
      if (!e.isAir && !canTargetGround) continue;

      const dist = Math.hypot(e.x - x, e.z - z);
      const effectiveRadius = splashRadius + e.radius * 0.6;
      if (dist <= effectiveRadius) {
        const t = Math.max(0, Math.min(1, 1 - dist / Math.max(0.01, effectiveRadius)));
        const factor = minFalloff + (1 - minFalloff) * t;
        e.takeDamage(baseDamage * factor, sourceType, { x: e.x, y: e.y, z: e.z }, {
          waveSystem: this,
          visuals: this.visuals,
          audio: this.audio,
          callbacks: this.callbacks
        });
        hitCount += 1;
      }
    }

    return hitCount;
  }

  /**
   * Clears all active enemies and pending spawns from the battlefield.
   */
  clearAllEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      this._removeEnemyMesh(this.enemies[i]);
    }
    this.enemies.length = 0;
    this.spawnQueue.length = 0;
    this.waveActive = false;
  }

  /**
   * Resets wave progression and telemetry back to Round 0.
   */
  reset() {
    this.clearAllEnemies();
    this.currentRound = 0;
    this.waveTimer = 0;
    this.betweenWaveTimer = 0;
    this.currentWaveDef = null;
    this.currentWarningBanner = null;
    this.warningBannerTimer = 0;
    this.stats.totalSpawned = 0;
    this.stats.totalKilled = 0;
    this.stats.totalLeaked = 0;
    this.stats.totalGoldEarned = 0;
    this.stats.totalScoreEarned = 0;
    this.stats.wavesCleared = 0;
  }
}

// Attach to window for non-module & debugging access
if (typeof window !== 'undefined') {
  window.ENEMY_DEFS = ENEMY_DEFS;
  window.WAVE_SCHEDULE = WAVE_SCHEDULE;
  window.getWaveDefinition = getWaveDefinition;
  window.EnemyUnit = EnemyUnit;
  window.EnemyWaveSystem = EnemyWaveSystem;
}

export { ENEMY_DEFS, WAVE_SCHEDULE, getWaveDefinition, EnemyUnit, EnemyWaveSystem };
export default EnemyWaveSystem;
