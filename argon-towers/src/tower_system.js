/**
 * Argon Towers (Grasslands) 2.5D Tower System
 * Manages the 4 foundational Argon Towers towers (Gatling, Goo, Missile, Tesla),
 * 3-tier upgrade trees, targeting priority state machines, ballistic & hitscan
 * weapon delivery, corkscrew missile physics, chain lightning, and 3D miniature meshes.
 */

const PRIORITY_ORDER = [
  'first',
  'strongest',
  'weakest',
  'nearest',
  'air_first',
  'unslowed_first',
];

const TOWER_DEFS = {
  gatling: {
    id: 'gatling',
    type: 'gatling',
    name: 'Gatling Tower',
    shortName: 'Gatling',
    hotkey: '1',
    cost: 5,
    upgradeCosts: [5, 8], // Tier 1: $5, Tier 2: +$5 = $10, Tier 3: +$8 = $18
    targetsAir: true,
    targetsGround: true,
    defaultPriority: 'first',
    color: 0xd99b26,
    accentColor: 0xffd25a,
    tiers: [
      {
        tier: 1,
        damage: 4,
        fireRate: 3.2,
        range: 5.0,
        projectileSpeed: 19,
        barrels: 2,
        description: 'Twin-barrel rotary gun. Steady single-target kinetic fire.',
      },
      {
        tier: 2,
        damage: 7,
        fireRate: 3.8,
        range: 5.6,
        projectileSpeed: 22,
        barrels: 4,
        description: 'Reinforced dual miniguns with high-velocity rounds.',
      },
      {
        tier: 3,
        damage: 12,
        fireRate: 4.5,
        range: 6.2,
        projectileSpeed: 25,
        barrels: 6,
        description: 'Quad vulcan Shredder with heavy barrel recoil.',
      },
    ],
  },

  goo: {
    id: 'goo',
    type: 'goo',
    name: 'Goo Tower',
    shortName: 'Goo',
    hotkey: '2',
    cost: 10,
    upgradeCosts: [8, 12], // Tier 1: $10, Tier 2: +$8 = $18, Tier 3: +$12 = $30
    targetsAir: true,
    targetsGround: true,
    defaultPriority: 'unslowed_first',
    color: 0x52d62a,
    accentColor: 0x9cff57,
    tiers: [
      {
        tier: 1,
        damage: 2,
        fireRate: 1.4,
        range: 5.4,
        slowFactor: 0.58,
        slowDuration: 3.2,
        splashRadius: 1.5,
        beamCount: 1,
        projectileSpeed: 15,
        description: 'Pressurized slime vat. Slows enemies by 42%.',
      },
      {
        tier: 2,
        damage: 4,
        fireRate: 1.8,
        range: 6.0,
        slowFactor: 0.45,
        slowDuration: 4.0,
        splashRadius: 2.1,
        beamCount: 2,
        projectileSpeed: 17,
        description: 'Dual chemical nozzles. Slows enemies by 55% in a wider splash.',
      },
      {
        tier: 3,
        damage: 8,
        fireRate: 2.2,
        range: 6.6,
        slowFactor: 0.32,
        slowDuration: 4.8,
        splashRadius: 2.7,
        beamCount: 3,
        projectileSpeed: 19,
        description: 'Multi-target corrosive bio-slime stream. Slows by 68% and leaves goo pools.',
      },
    ],
  },

  missile: {
    id: 'missile',
    type: 'missile',
    name: 'Missile Tower',
    shortName: 'Missile',
    hotkey: '3',
    cost: 20,
    upgradeCosts: [18, 28], // Tier 1: $20, Tier 2: +$18 = $38, Tier 3: +$28 = $66
    targetsAir: true,
    targetsGround: true,
    defaultPriority: 'air_first',
    antiAirBonus: 1.25,
    color: 0xe04836,
    accentColor: 0xff8c42,
    tiers: [
      {
        tier: 1,
        damage: 24,
        fireRate: 0.62,
        range: 8.8,
        splashRadius: 2.5,
        salvoCount: 1,
        projectileSpeed: 11.5,
        description: 'Heavy hydraulic rocket launcher. Long range & explosive AoE splash.',
      },
      {
        tier: 2,
        damage: 22,
        fireRate: 0.72,
        range: 10.0,
        splashRadius: 2.9,
        salvoCount: 2,
        projectileSpeed: 13.0,
        description: 'Quad-pack launcher firing 2-rocket salvos with corkscrew smoke.',
      },
      {
        tier: 3,
        damage: 28,
        fireRate: 0.85,
        range: 11.2,
        splashRadius: 3.4,
        salvoCount: 3,
        projectileSpeed: 14.5,
        description: 'Multi-silo barrage battery launching 3 corkscrew warheads per salvo.',
      },
    ],
  },

  tesla: {
    id: 'tesla',
    type: 'tesla',
    name: 'Tesla Tower',
    shortName: 'Tesla',
    hotkey: '4',
    cost: 75,
    upgradeCosts: [60, 95], // Tier 1: $75, Tier 2: +$60 = $135, Tier 3: +$95 = $230
    targetsAir: true,
    targetsGround: true,
    defaultPriority: 'strongest',
    color: 0x38b6ff,
    accentColor: 0xa6ecff,
    tiers: [
      {
        tier: 1,
        damage: 65,
        fireRate: 0.70,
        range: 6.0,
        chainCount: 2,
        chainRange: 3.8,
        chainFalloff: 0.72,
        stunDuration: 0.15,
        description: 'High-voltage copper coil. Arcs lightning across up to 3 targets.',
      },
      {
        tier: 2,
        damage: 115,
        fireRate: 0.85,
        range: 6.8,
        chainCount: 3,
        chainRange: 4.4,
        chainFalloff: 0.76,
        stunDuration: 0.20,
        description: 'Dual spherical generators. Massive chain lightning across 4 targets.',
      },
      {
        tier: 3,
        damage: 195,
        fireRate: 1.00,
        range: 7.5,
        chainCount: 5,
        chainRange: 5.0,
        chainFalloff: 0.80,
        stunDuration: 0.25,
        description: 'Overcharged plasma storm spire jumping across 6 targets.',
      },
    ],
  },
};

/**
 * Helper to create a THREE.Vector3 when window.THREE is available, or a
 * compatible vector object in headless environments.
 */
function makeVec3(x = 0, y = 0, z = 0) {
  const THREE = typeof window !== 'undefined' ? window.THREE : null;
  if (THREE && THREE.Vector3) {
    return new THREE.Vector3(x, y, z);
  }
  return {
    x,
    y,
    z,
    set(nx, ny, nz) {
      this.x = nx;
      this.y = ny;
      this.z = nz;
      return this;
    },
     copy(v) {
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
      return this;
    },
    clone() {
      return makeVec3(this.x, this.y, this.z);
    },
    distanceTo(v) {
      return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z);
    },
  };
}

/**
 * Shortest signed angular difference from angle `a` to angle `b` in [-PI, PI].
 */
function shortestAngleDelta(a, b) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Extracts world coordinates and state from an enemy instance regardless of property conventions.
 */
function getEnemyX(e) {
  if (typeof e.x === 'number') return e.x;
  if (e.position && typeof e.position.x === 'number') return e.position.x;
  if (e.mesh && e.mesh.position) return e.mesh.position.x;
  return 0;
}

function getEnemyY(e) {
  if (typeof e.y === 'number') return e.y;
  if (e.position && typeof e.position.y === 'number') return e.position.y;
  if (e.mesh && e.mesh.position) return e.mesh.position.y;
  return isAirEnemy(e) ? 2.4 : 0.65;
}

function getEnemyZ(e) {
  if (typeof e.z === 'number') return e.z;
  if (e.position && typeof e.position.z === 'number') return e.position.z;
  if (e.mesh && e.mesh.position) return e.mesh.position.z;
  return 0;
}

function getEnemyCenterVec(e) {
  const yOffset = isAirEnemy(e) ? 0.15 : 0.55;
  return makeVec3(getEnemyX(e), getEnemyY(e) + yOffset, getEnemyZ(e));
}

function isAirEnemy(e) {
  if (!e) return false;
  if (typeof e.isAir === 'boolean') return e.isAir;
  if (typeof e.flying === 'boolean') return e.flying;
  if (typeof e.isFlying === 'boolean') return e.isFlying;
  const t = String(e.type || e.kind || '').toLowerCase();
  return t.includes('chopper') || t.includes('heli') || t.includes('zeppelin') || t.includes('blimp') || t.includes('air');
}

function isEnemyAlive(e) {
  if (!e) return false;
  if (e.dead || e.isDead || e.reachedExit || e.removed || e.active === false) return false;
  if (typeof e.hp === 'number' && e.hp <= 0) return false;
  return true;
}

function getRemainingPathDist(e) {
  if (typeof e.remainingPathDist === 'number') return e.remainingPathDist;
  if (typeof e.remainingDist === 'number') return e.remainingDist;
  if (typeof e.distToExit === 'number') return e.distToExit;
  if (typeof e.pathProgress === 'number') return 1000 - e.pathProgress;
  return 999999;
}

/**
 * Inflicts damage on an enemy, updates tower telemetry, and invokes onEnemyKilled exactly once per kill.
 */
function applyDamageToEnemy(enemy, rawDamage, tower, onEnemyKilled) {
  if (!isEnemyAlive(enemy) || rawDamage <= 0) return false;

  const hpBefore = typeof enemy.hp === 'number' ? enemy.hp : rawDamage;
  const effectiveDamage = Math.max(0, rawDamage);

  if (typeof enemy.takeDamage === 'function') {
    enemy.takeDamage(effectiveDamage, tower ? tower.type : 'tower', tower);
  } else if (typeof enemy.applyDamage === 'function') {
    enemy.applyDamage(effectiveDamage, tower ? tower.type : 'tower', tower);
  } else if (typeof enemy.hp === 'number') {
    enemy.hp = Math.max(0, enemy.hp - effectiveDamage);
    if (enemy.hp <= 0) {
      enemy.dead = true;
      enemy.isDead = true;
    }
  }

  if (tower) {
    const dealt = Math.min(hpBefore > 0 ? hpBefore : effectiveDamage, effectiveDamage);
    tower.totalDamageDealt += dealt;
  }

  const diedNow = !isEnemyAlive(enemy) || (typeof enemy.hp === 'number' && enemy.hp <= 0);
  if (diedNow) {
    enemy.dead = true;
    enemy.isDead = true;
    if (!enemy._killCountedByTower) {
      enemy._killCountedByTower = true;
      if (tower) {
        tower.kills += 1;
      }
      if (typeof onEnemyKilled === 'function') {
        onEnemyKilled(enemy, tower);
      }
      return true;
    }
  }
  return false;
}

function applySlowToEnemy(enemy, slowFactor, slowDuration) {
  if (!isEnemyAlive(enemy)) return;
  if (typeof enemy.applySlow === 'function') {
    enemy.applySlow(slowFactor, slowDuration);
  }
  // Ensure slowTimer & slowFactor properties are always updated for targeting priority checks
  const currentFactor = typeof enemy.slowFactor === 'number' ? enemy.slowFactor : 1.0;
  enemy.slowFactor = Math.min(currentFactor, slowFactor);
  enemy.slowTimer = Math.max(typeof enemy.slowTimer === 'number' ? enemy.slowTimer : 0, slowDuration);
  enemy.isSlowed = true;
}

function applyStunToEnemy(enemy, stunDuration) {
  if (!isEnemyAlive(enemy)) return;
  if (typeof enemy.applyStun === 'function') {
    enemy.applyStun(stunDuration);
  }
  enemy.stunTimer = Math.max(typeof enemy.stunTimer === 'number' ? enemy.stunTimer : 0, stunDuration);
  enemy.isStunned = true;
}

/**
 * Dispatches tower SFX across whatever audio manager interface is active.
 */
function triggerAudio(audio, eventType, tower, extra = null) {
  if (!audio) return;
  const tier = tower ? tower.tier : 1;
  const type = tower ? tower.type : '';
  const wx = tower && typeof tower.x === 'number' ? tower.x : 0;

  switch (eventType) {
    case 'gatling_fire':
      if (typeof audio.playGatlingShot === 'function') audio.playGatlingShot(wx, tier);
      else if (typeof audio.playGatling === 'function') audio.playGatling(wx, tier);
      else if (typeof audio.playMachineGun === 'function') audio.playMachineGun(tier);
      else if (typeof audio.playTowerShoot === 'function') audio.playTowerShoot('gatling', tier);
      else if (typeof audio.playShoot === 'function') audio.playShoot('gatling', tier);
      else if (typeof audio.playSfx === 'function') audio.playSfx('gatling', tier);
      else if (typeof audio.play === 'function') audio.play('gatling');
      break;

    case 'goo_fire':
      if (typeof audio.playGooSplat === 'function') audio.playGooSplat(wx, tier);
      else if (typeof audio.playGoo === 'function') audio.playGoo(wx, tier);
      else if (typeof audio.playGooShot === 'function') audio.playGooShot(tier);
      else if (typeof audio.playGooSplatter === 'function') audio.playGooSplatter(tier);
      else if (typeof audio.playTowerShoot === 'function') audio.playTowerShoot('goo', tier);
      else if (typeof audio.playShoot === 'function') audio.playShoot('goo', tier);
      else if (typeof audio.playSfx === 'function') audio.playSfx('goo', tier);
      else if (typeof audio.play === 'function') audio.play('goo');
      break;

    case 'missile_launch':
      if (typeof audio.playMissileLaunch === 'function') audio.playMissileLaunch(wx, tier);
      else if (typeof audio.playRocketLaunch === 'function') audio.playRocketLaunch(tier);
      else if (typeof audio.playMissile === 'function') audio.playMissile(wx, tier);
      else if (typeof audio.playTowerShoot === 'function') audio.playTowerShoot('missile', tier);
      else if (typeof audio.playShoot === 'function') audio.playShoot('missile', tier);
      else if (typeof audio.playSfx === 'function') audio.playSfx('missile_launch', tier);
      else if (typeof audio.play === 'function') audio.play('missile_launch');
      break;

    case 'missile_impact':
      if (typeof audio.playExplosion === 'function') audio.playExplosion(wx, Boolean(extra && extra > 3.0));
      else if (typeof audio.playMissileExplosion === 'function') audio.playMissileExplosion(extra);
      else if (typeof audio.playMissileThud === 'function') audio.playMissileThud(extra);
      else if (typeof audio.playSfx === 'function') audio.playSfx('explosion', extra);
      else if (typeof audio.play === 'function') audio.play('explosion');
      break;

    case 'tesla_fire':
      if (typeof audio.playTeslaZap === 'function') audio.playTeslaZap(wx, extra || 1);
      else if (typeof audio.playTesla === 'function') audio.playTesla(wx, extra || 1);
      else if (typeof audio.playLightning === 'function') audio.playLightning(tier, extra);
      else if (typeof audio.playTowerShoot === 'function') audio.playTowerShoot('tesla', tier);
      else if (typeof audio.playShoot === 'function') audio.playShoot('tesla', tier);
      else if (typeof audio.playSfx === 'function') audio.playSfx('tesla', tier);
      else if (typeof audio.play === 'function') audio.play('tesla');
      break;

    case 'tower_build':
      if (typeof audio.playTowerPlace === 'function') audio.playTowerPlace(wx);
      else if (typeof audio.playBuild === 'function') audio.playBuild(type);
      else if (typeof audio.playSfx === 'function') audio.playSfx('build');
      else if (typeof audio.play === 'function') audio.play('build');
      break;

    case 'tower_upgrade':
      if (typeof audio.playTowerUpgrade === 'function') audio.playTowerUpgrade(wx, tier);
      else if (typeof audio.playUpgrade === 'function') audio.playUpgrade(tier, type);
      else if (typeof audio.playSfx === 'function') audio.playSfx('upgrade');
      else if (typeof audio.play === 'function') audio.play('upgrade');
      break;

    case 'tower_sell':
      if (typeof audio.playTowerSell === 'function') audio.playTowerSell(wx);
      else if (typeof audio.playSell === 'function') audio.playSell(type);
      else if (typeof audio.playSfx === 'function') audio.playSfx('sell');
      else if (typeof audio.play === 'function') audio.play('sell');
      break;

    default:
      break;
  }
}

/**
 * Individual Tower Instance representing a placed Argon Towers turret on the grid.
 */
class TowerInstance {
  constructor(id, type, col, row, wx, wz) {
    const normType = String(type || 'gatling').toLowerCase().trim();
    const def = TOWER_DEFS[normType];
    if (!def) {
      throw new Error(`Unknown tower type: "${type}"`);
    }

    this.id = id;
    this.type = normType;
    this.def = def;
    this.name = def.name;
    this.col = col;
    this.row = row;
    this.x = wx;
    this.y = 0;
    this.z = wz;

    this.tier = 1;
    this.totalInvested = def.cost;
    this.priority = def.defaultPriority || 'first';

    // Turret orientation & mechanical animation state
    this.turretYaw = 0;
    this.targetYaw = 0;
    this.barrelSpinAngle = 0;
    this.barrelSpinSpeed = 0;
    this.recoilOffset = 0;
    this.bayDoorOpen = 0;
    this.chargeGlow = 0;
    this.gooPulsePhase = Math.random() * Math.PI * 2;
    this.activeBarrelIndex = 0;

    // Firing timer & reload state
    this.cooldown = 0;
    this.reloadProgress = 1.0;

    // Active targets & combat telemetry
    this.currentTarget = null;
    this.activeGooBeamTargets = [];
    this.kills = 0;
    this.totalDamageDealt = 0;
    this.shotsFired = 0;

    // Placement / upgrade visual timers
    this.buildAnimProgress = 0;
    this.upgradeFlashTimer = 0;
    this.muzzleFlashTimer = 0;

    // 3D scene representation
    this.meshGroup = null;
    this._meshParts = null;
  }

  /**
   * Returns the tier configuration object for the current (or specified) 1-based tier.
   */
  getTierStats(tier = this.tier) {
    const idx = Math.max(0, Math.min(this.def.tiers.length - 1, tier - 1));
    return this.def.tiers[idx];
  }

  get tierStats() {
    return this.getTierStats(this.tier);
  }

  get stats() {
    return this.getTierStats(this.tier);
  }

  get range() {
    return this.tierStats.range;
  }

  get damage() {
    return this.tierStats.damage;
  }

  get fireRate() {
    return this.tierStats.fireRate;
  }

  get splashRadius() {
    return this.tierStats.splashRadius || 0;
  }

  /**
   * Returns the stats object for the next upgrade tier, or null if at max tier (3).
   */
  getNextTierStats() {
    if (this.tier >= 3) return null;
    return this.def.tiers[this.tier];
  }

  /**
   * Returns the dollar cost for upgrading to the next tier, or null if tier >= 3.
   */
  getUpgradeCost() {
    if (this.tier >= 3) return null;
    return this.def.upgradeCosts[this.tier - 1] ?? null;
  }

  canUpgrade() {
    return this.tier < 3;
  }

  /**
   * Returns exact 70% scrap value refund rounded to nearest integer.
   */
  getSellValue() {
    return Math.round(this.totalInvested * 0.70);
  }

  /**
   * Upgrades this tower to the next tier (up to Tier 3).
   */
  upgrade() {
    if (this.tier >= 3) return false;
    const cost = this.getUpgradeCost();
    if (cost === null) return false;

    this.totalInvested += cost;
    this.tier += 1;
    this.upgradeFlashTimer = 0.7;
    this.buildAnimProgress = 0.35;
    return true;
  }

  /**
   * Sets or cycles the targeting priority mode.
   */
  setPriority(priority) {
    if (PRIORITY_ORDER.includes(priority)) {
      this.priority = priority;
    }
    return this.priority;
  }

  cyclePriority(step = 1) {
    const idx = PRIORITY_ORDER.indexOf(this.priority);
    const nextIdx = (idx + step + PRIORITY_ORDER.length) % PRIORITY_ORDER.length;
    this.priority = PRIORITY_ORDER[nextIdx];
    return this.priority;
  }

  /**
   * Evaluates whether an enemy is alive, targetable by this tower's domain (air/ground),
   * and within 2D horizontal range.
   */
  isValidTarget(enemy, rangeOverride = null) {
    if (!isEnemyAlive(enemy)) return false;

    const air = isAirEnemy(enemy);
    if (air && !this.def.targetsAir) return false;
    if (!air && !this.def.targetsGround) return false;

    const maxRange = rangeOverride !== null ? rangeOverride : this.tierStats.range;
    const dist = Math.hypot(getEnemyX(enemy) - this.x, getEnemyZ(enemy) - this.z);
    return dist <= maxRange;
  }

  /**
   * Compares two candidate enemies according to this tower's active targeting priority.
   * Returns < 0 if `a` is higher priority than `b`.
   */
  compareTargets(a, b) {
    const remA = getRemainingPathDist(a);
    const remB = getRemainingPathDist(b);

    switch (this.priority) {
      case 'unslowed_first': {
        const unslowedA = (typeof a.slowTimer === 'number' ? a.slowTimer : 0) <= 0.2;
        const unslowedB = (typeof b.slowTimer === 'number' ? b.slowTimer : 0) <= 0.2;
        if (unslowedA !== unslowedB) {
          return unslowedA ? -1 : 1;
        }
        return remA - remB;
      }

      case 'air_first': {
        const airA = isAirEnemy(a);
        const airB = isAirEnemy(b);
        if (airA !== airB) {
          return airA ? -1 : 1;
        }
        return remA - remB;
      }

      case 'strongest': {
        const hpA = typeof a.hp === 'number' ? a.hp : 0;
        const hpB = typeof b.hp === 'number' ? b.hp : 0;
        if (Math.abs(hpB - hpA) > 0.001) {
          return hpB - hpA;
        }
        return remA - remB;
      }

      case 'weakest': {
        const hpA = typeof a.hp === 'number' ? a.hp : 0;
        const hpB = typeof b.hp === 'number' ? b.hp : 0;
        if (Math.abs(hpA - hpB) > 0.001) {
          return hpA - hpB;
        }
        return remA - remB;
      }

      case 'nearest': {
        const distA = Math.hypot(getEnemyX(a) - this.x, getEnemyZ(a) - this.z);
        const distB = Math.hypot(getEnemyX(b) - this.x, getEnemyZ(b) - this.z);
        if (Math.abs(distA - distB) > 0.001) {
          return distA - distB;
        }
        return remA - remB;
      }

      case 'first':
      default:
        return remA - remB;
    }
  }

  /**
   * Acquires up to `maxCount` valid enemies within range sorted by targeting priority.
   */
  acquireTargets(enemies, maxCount = 1) {
    if (!enemies || !enemies.length || maxCount <= 0) return [];
    const range = this.tierStats.range;
    const candidates = [];

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (this.isValidTarget(e, range)) {
        candidates.push(e);
      }
    }

    if (candidates.length === 0) return [];
    candidates.sort((a, b) => this.compareTargets(a, b));
    return candidates.slice(0, maxCount);
  }

  /**
   * Acquires the single highest-priority valid enemy within range, or null if none.
   */
  acquireTarget(enemies) {
    if (!enemies || !enemies.length) return null;
    const range = this.tierStats.range;
    let best = null;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!this.isValidTarget(e, range)) continue;
      if (best === null || this.compareTargets(e, best) < 0) {
        best = e;
      }
    }
    return best;
  }

  /**
   * World position of the turret's muzzle / emitter tip.
   */
  getMuzzlePosition(barrelOffsetIndex = 0, totalBarrels = 1) {
    const forwardDist = this.type === 'tesla' ? 0.0 : 0.72;
    const baseHeight =
      this.type === 'tesla'
        ? 1.75 + (this.tier - 1) * 0.22
        : this.type === 'missile'
          ? 1.08 + (this.tier - 1) * 0.08
          : 0.92 + (this.tier - 1) * 0.06;

    const sinYaw = Math.sin(this.turretYaw);
    const cosYaw = Math.cos(this.turretYaw);

    // Lateral spread for multi-barrel / multi-silo salvos
    let lateral = 0;
    if (totalBarrels > 1) {
      const norm = barrelOffsetIndex / (totalBarrels - 1) - 0.5;
      lateral = norm * 0.42;
    }

    const mx = this.x + sinYaw * forwardDist + cosYaw * lateral;
    const mz = this.z + cosYaw * forwardDist - sinYaw * lateral;
    return makeVec3(mx, this.y + baseHeight, mz);
  }
}

/**
 * Builds or updates the procedural 2.5D Three.js miniature mesh for a TowerInstance.
 */
function buildProceduralTowerMesh(tower) {
  const THREE = typeof window !== 'undefined' ? window.THREE : null;
  if (!THREE) return null;

  const root = tower.meshGroup || new THREE.Group();
  root.name = `Tower_${tower.type}_${tower.id}`;
  root.position.set(tower.x, tower.y, tower.z);

  // Clear previous children when rebuilding on upgrade
  while (root.children.length > 0) {
    const child = root.children.pop();
    root.remove(child);
  }

  const tier = tower.tier;
  const tierScale = 1 + (tier - 1) * 0.07;

  // Shared tactical materials
  const baseDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2c333a,
    roughness: 0.65,
    metalness: 0.45,
  });
  const basePlateMat = new THREE.MeshStandardMaterial({
    color: 0x434c56,
    roughness: 0.55,
    metalness: 0.5,
  });
  const primaryMat = new THREE.MeshStandardMaterial({
    color: tower.def.color,
    roughness: 0.4,
    metalness: 0.35,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: tower.def.accentColor,
    roughness: 0.3,
    metalness: 0.5,
    emissive: tower.def.color,
    emissiveIntensity: 0.15 * tier,
  });
  const gunMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e2227,
    roughness: 0.35,
    metalness: 0.8,
  });

  // 1. Octagonal Foundation Plinth
  const plinthGeo = new THREE.CylinderGeometry(0.76, 0.86, 0.24, 8);
  const plinthMesh = new THREE.Mesh(plinthGeo, baseDarkMat);
  plinthMesh.position.y = 0.12;
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  root.add(plinthMesh);

  // Tier ring trim around base
  const trimRingGeo = new THREE.CylinderGeometry(0.68, 0.72, 0.1, 16);
  const trimRing = new THREE.Mesh(trimRingGeo, tier >= 2 ? accentMat : basePlateMat);
  trimRing.position.y = 0.26;
  trimRing.castShadow = true;
  root.add(trimRing);

  // Tier pips on front edge of plinth
  for (let p = 0; p < tier; p++) {
    const pipGeo = new THREE.BoxGeometry(0.14, 0.08, 0.14);
    const pip = new THREE.Mesh(pipGeo, accentMat);
    const spread = (p - (tier - 1) * 0.5) * 0.22;
    pip.position.set(spread, 0.26, 0.68);
    root.add(pip);
  }

  // Rotatable Turret Pivot
  const turretPivot = new THREE.Group();
  turretPivot.position.y = 0.32;
  turretPivot.rotation.y = tower.turretYaw;
  root.add(turretPivot);

  // Recoil Carriage Group inside Turret Pivot
  const recoilGroup = new THREE.Group();
  turretPivot.add(recoilGroup);

  const parts = {
    turretPivot,
    recoilGroup,
    barrelGroup: null,
    muzzleFlashMesh: null,
    leftDoor: null,
    rightDoor: null,
    warheadTips: [],
    capacitorRings: [],
    coronaSphere: null,
    gooCoreMesh: null,
    gooBeams: [],
  };

  if (tower.type === 'gatling') {
    // Armored gun house
    const bodyGeo = new THREE.BoxGeometry(0.68 * tierScale, 0.44 * tierScale, 0.68 * tierScale);
    const bodyMesh = new THREE.Mesh(bodyGeo, primaryMat);
    bodyMesh.position.y = 0.36;
    bodyMesh.castShadow = true;
    recoilGroup.add(bodyMesh);

    // Side ammo drums for Tier 2 & 3
    if (tier >= 2) {
      const drumGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.36, 12);
      drumGeo.rotateZ(Math.PI * 0.5);
      const leftDrum = new THREE.Mesh(drumGeo, accentMat);
      leftDrum.position.set(-0.44, 0.36, -0.05);
      const rightDrum = new THREE.Mesh(drumGeo, accentMat);
      rightDrum.position.set(0.44, 0.36, -0.05);
      recoilGroup.add(leftDrum, rightDrum);
    }

    // Rotary Barrel Assembly
    const barrelGroup = new THREE.Group();
    barrelGroup.position.set(0, 0.38, 0.34);
    recoilGroup.add(barrelGroup);
    parts.barrelGroup = barrelGroup;

    const barrelCount = tower.tierStats.barrels || 2;
    const ringRadius = barrelCount <= 2 ? 0.11 : 0.15;
    const barrelLen = 0.65 + (tier - 1) * 0.1;

    for (let b = 0; b < barrelCount; b++) {
      const angle = (b / barrelCount) * Math.PI * 2;
      const bGeo = new THREE.CylinderGeometry(0.042, 0.048, barrelLen, 8);
      bGeo.rotateX(Math.PI * 0.5);
      const bMesh = new THREE.Mesh(bGeo, gunMetalMat);
      bMesh.position.set(
        Math.cos(angle) * ringRadius,
        Math.sin(angle) * ringRadius,
        barrelLen * 0.5
      );
      bMesh.castShadow = true;
      barrelGroup.add(bMesh);
    }

    // Barrel clamp collar
    const collarGeo = new THREE.CylinderGeometry(ringRadius + 0.07, ringRadius + 0.07, 0.09, 12);
    collarGeo.rotateX(Math.PI * 0.5);
    const collarMesh = new THREE.Mesh(collarGeo, accentMat);
    collarMesh.position.z = barrelLen * 0.72;
    barrelGroup.add(collarMesh);

    // Muzzle flash star cone
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffe866,
      transparent: true,
      opacity: 0.0,
    });
    const flashGeo = new THREE.ConeGeometry(0.22, 0.45, 7);
    flashGeo.rotateX(Math.PI * 0.5);
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.set(0, 0.38, 0.38 + barrelLen + 0.18);
    recoilGroup.add(flashMesh);
    parts.muzzleFlashMesh = flashMesh;
  } else if (tower.type === 'goo') {
    // Pressurized transparent bio-slime tank
    const vatOuterMat = new THREE.MeshStandardMaterial({
      color: 0xaaffaa,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.48,
    });
    const vatGeo = new THREE.CylinderGeometry(0.46 * tierScale, 0.5 * tierScale, 0.58 * tierScale, 14);
    const vatMesh = new THREE.Mesh(vatGeo, vatOuterMat);
    vatMesh.position.y = 0.34;
    recoilGroup.add(vatMesh);

    // Glowing inner slime core
    const slimeCoreMat = new THREE.MeshStandardMaterial({
      color: 0x44ee11,
      emissive: 0x2ea80a,
      emissiveIntensity: 0.65,
      roughness: 0.25,
    });
    const coreGeo = new THREE.CylinderGeometry(0.38 * tierScale, 0.42 * tierScale, 0.46 * tierScale, 12);
    const coreMesh = new THREE.Mesh(coreGeo, slimeCoreMat);
    coreMesh.position.y = 0.32;
    recoilGroup.add(coreMesh);
    parts.gooCoreMesh = coreMesh;

    // Top pressure cap
    const capGeo = new THREE.CylinderGeometry(0.34 * tierScale, 0.48 * tierScale, 0.14, 12);
    const capMesh = new THREE.Mesh(capGeo, basePlateMat);
    capMesh.position.y = 0.66 * tierScale;
    recoilGroup.add(capMesh);

    // 1, 2, or 3 chemical sprayer nozzles based on beamCount
    const nozzleCount = tower.tierStats.beamCount || 1;
    for (let n = 0; n < nozzleCount; n++) {
      const spreadAngle = (n - (nozzleCount - 1) * 0.5) * 0.28;
      const nozzleGroup = new THREE.Group();
      nozzleGroup.position.set(Math.sin(spreadAngle) * 0.25, 0.44, 0.32);
      nozzleGroup.rotation.y = spreadAngle * 0.4;

      const pipeGeo = new THREE.CylinderGeometry(0.075, 0.11, 0.52, 10);
      pipeGeo.rotateX(Math.PI * 0.5);
      const pipeMesh = new THREE.Mesh(pipeGeo, gunMetalMat);
      pipeMesh.position.z = 0.22;
      nozzleGroup.add(pipeMesh);

      const tipGeo = new THREE.SphereGeometry(0.1, 10, 10);
      const tipMesh = new THREE.Mesh(tipGeo, accentMat);
      tipMesh.position.z = 0.48;
      nozzleGroup.add(tipMesh);

      recoilGroup.add(nozzleGroup);
    }
  } else if (tower.type === 'missile') {
    // Heavy sloped missile silo launcher box
    const rackWidth = 0.72 + (tier - 1) * 0.12;
    const rackGeo = new THREE.BoxGeometry(rackWidth, 0.54, 0.74);
    const rackMesh = new THREE.Mesh(rackGeo, primaryMat);
    rackMesh.position.set(0, 0.42, -0.04);
    rackMesh.rotation.x = -0.22; // Elevated launch angle
    rackMesh.castShadow = true;
    recoilGroup.add(rackMesh);

    // Articulated hydraulic bay doors (left & right)
    const doorGeo = new THREE.BoxGeometry(rackWidth * 0.48, 0.06, 0.66);
    const leftDoor = new THREE.Mesh(doorGeo, basePlateMat);
    leftDoor.position.set(-rackWidth * 0.26, 0.72, -0.02);
    const rightDoor = new THREE.Mesh(doorGeo, basePlateMat);
    rightDoor.position.set(rackWidth * 0.26, 0.72, -0.02);
    recoilGroup.add(leftDoor, rightDoor);
    parts.leftDoor = leftDoor;
    parts.rightDoor = rightDoor;

    // Salvo launch tubes & visible warhead nosecones
    const salvoCount = tower.tierStats.salvoCount || 1;
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xff3311,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });

    for (let s = 0; s < salvoCount; s++) {
      const xOff = salvoCount === 1 ? 0 : (s / (salvoCount - 1) - 0.5) * (rackWidth * 0.62);
      const tubeGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.78, 10);
      tubeGeo.rotateX(Math.PI * 0.5 - 0.22);
      const tubeMesh = new THREE.Mesh(tubeGeo, gunMetalMat);
      tubeMesh.position.set(xOff, 0.46, 0.08);
      recoilGroup.add(tubeMesh);

      const coneGeo = new THREE.ConeGeometry(0.095, 0.24, 10);
      coneGeo.rotateX(Math.PI * 0.5 - 0.22);
      const coneMesh = new THREE.Mesh(coneGeo, noseMat);
      coneMesh.position.set(xOff, 0.54, 0.44);
      recoilGroup.add(coneMesh);
      parts.warheadTips.push(coneMesh);
    }
  } else if (tower.type === 'tesla') {
    // Copper-wound high-voltage spire
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xd4743b,
      roughness: 0.3,
      metalness: 0.85,
    });
    const spireHeight = 1.25 + (tier - 1) * 0.22;
    const spireGeo = new THREE.CylinderGeometry(0.14, 0.34, spireHeight, 12);
    const spireMesh = new THREE.Mesh(spireGeo, copperMat);
    spireMesh.position.y = spireHeight * 0.5 + 0.1;
    spireMesh.castShadow = true;
    turretPivot.add(spireMesh);

    // Floating toroidal capacitor rings (1, 2, or 3 rings by tier)
    const ringCount = tier + 1;
    for (let r = 0; r < ringCount; r++) {
      const frac = (r + 1) / (ringCount + 1);
      const ringRadius = 0.44 - frac * 0.14;
      const torusGeo = new THREE.TorusGeometry(ringRadius, 0.045, 8, 20);
      torusGeo.rotateX(Math.PI * 0.5);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x38b6ff,
        emissive: 0x1a9fff,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.7,
      });
      const ringMesh = new THREE.Mesh(torusGeo, ringMat);
      ringMesh.position.y = 0.25 + frac * spireHeight;
      turretPivot.add(ringMesh);
      parts.capacitorRings.push(ringMesh);
    }

    // Top plasma corona discharge sphere
    const coronaMat = new THREE.MeshStandardMaterial({
      color: 0xb8f2ff,
      emissive: 0x38b6ff,
      emissiveIntensity: 0.85,
      roughness: 0.1,
      metalness: 0.2,
    });
    const coronaGeo = new THREE.SphereGeometry(0.24 + (tier - 1) * 0.04, 16, 16);
    const coronaSphere = new THREE.Mesh(coronaGeo, coronaMat);
    coronaSphere.position.y = spireHeight + 0.22;
    turretPivot.add(coronaSphere);
    parts.coronaSphere = coronaSphere;
  }

  root.userData = {
    towerId: tower.id,
    towerType: tower.type,
    tier: tower.tier,
    tower,
    parts,
  };

  tower.meshGroup = root;
  tower._meshParts = parts;
  return root;
}

/**
 * Animates a TowerInstance's procedural 3D mesh group each frame.
 */
function updateProceduralTowerMesh(tower, dt) {
  if (!tower.meshGroup || !tower._meshParts) return;
  const parts = tower._meshParts;

  // Pop-in build / upgrade elastic scale
  if (tower.buildAnimProgress < 1) {
    tower.buildAnimProgress = Math.min(1, tower.buildAnimProgress + dt * 4.5);
    const t = tower.buildAnimProgress;
    const overshoot = 1 + Math.sin(t * Math.PI) * 0.18 * (1 - t);
    const s = Math.max(0.01, t * overshoot);
    tower.meshGroup.scale.set(s, s, s);
  } else {
    tower.meshGroup.scale.set(1, 1, 1);
  }

  // Sync turret rotation yaw
  if (parts.turretPivot) {
    parts.turretPivot.rotation.y = tower.turretYaw;
  }

  // Recoil kickback displacement along -Z in turret space
  if (parts.recoilGroup) {
    parts.recoilGroup.position.z = -tower.recoilOffset * 0.14;
  }

  // Gatling rotary barrels & muzzle flash
  if (parts.barrelGroup) {
    parts.barrelGroup.rotation.z = tower.barrelSpinAngle;
  }
  if (parts.muzzleFlashMesh) {
    if (tower.muzzleFlashTimer > 0) {
      parts.muzzleFlashMesh.material.opacity = Math.min(1, tower.muzzleFlashTimer * 18);
      parts.muzzleFlashMesh.rotation.z = tower.barrelSpinAngle * 1.7;
      const fScale = 0.85 + Math.random() * 0.35;
      parts.muzzleFlashMesh.scale.set(fScale, fScale, fScale);
    } else {
      parts.muzzleFlashMesh.material.opacity = 0;
    }
  }

  // Goo bubbling inner core pulse
  if (parts.gooCoreMesh) {
    const pulse = 1 + Math.sin(tower.gooPulsePhase) * 0.06;
    parts.gooCoreMesh.scale.set(pulse, 1 + Math.cos(tower.gooPulsePhase * 1.3) * 0.05, pulse);
  }

  // Missile hydraulic bay doors & warhead visibility during reload
  if (parts.leftDoor && parts.rightDoor) {
    const openAngle = tower.bayDoorOpen * 0.95;
    parts.leftDoor.rotation.z = openAngle;
    parts.rightDoor.rotation.z = -openAngle;
  }
  if (parts.warheadTips && parts.warheadTips.length > 0) {
    const showWarhead = tower.reloadProgress > 0.55;
    const popScale = showWarhead ? Math.min(1, (tower.reloadProgress - 0.55) / 0.45) : 0.001;
    for (let i = 0; i < parts.warheadTips.length; i++) {
      parts.warheadTips[i].visible = showWarhead;
      parts.warheadTips[i].scale.set(popScale, popScale, popScale);
    }
  }

  // Tesla capacitor rings & corona glow
  if (parts.capacitorRings && parts.capacitorRings.length > 0) {
    for (let i = 0; i < parts.capacitorRings.length; i++) {
      const ring = parts.capacitorRings[i];
      const dir = i % 2 === 0 ? 1 : -1;
      ring.rotation.y += dt * (1.8 + tower.chargeGlow * 4.5) * dir;
      if (ring.material) {
        ring.material.emissiveIntensity = 0.3 + tower.chargeGlow * 1.4;
      }
    }
  }
  if (parts.coronaSphere && parts.coronaSphere.material) {
    const s = 1 + tower.chargeGlow * 0.22;
    parts.coronaSphere.scale.set(s, s, s);
    parts.coronaSphere.material.emissiveIntensity = 0.65 + tower.chargeGlow * 1.6;
  }
}

/**
 * Master Tower System managing tower placement, upgrades, selling, target acquisition,
 * projectile ballistics, continuous Goo beams, corkscrew Missiles, and Tesla chain lightning.
 */
class TowerSystem {
  constructor(sceneOrOptions = null, visuals = null, audio = null) {
    this.scene = null;
    this.visuals = visuals;
    this.audio = audio;

    if (sceneOrOptions) {
      if (typeof sceneOrOptions.add === 'function') {
        this.scene = sceneOrOptions;
      } else if (typeof sceneOrOptions === 'object') {
        this.scene = sceneOrOptions.scene || null;
        this.visuals = sceneOrOptions.visuals || visuals;
        this.audio = sceneOrOptions.audio || audio;
      }
    }

    this.towers = [];
    this.towerMap = new Map();
    this.gridMap = new Map();
    this.projectiles = [];
    this.gooPools = [];
    this._nextTowerId = 1;
    this._nextProjId = 1;
    this.totalKills = 0;

    const THREE = typeof window !== 'undefined' ? window.THREE : null;
    this.towerGroup = THREE ? new THREE.Group() : null;
    this.projectileGroup = THREE ? new THREE.Group() : null;
    if (this.towerGroup) this.towerGroup.name = 'TowerSystem_Towers';
    if (this.projectileGroup) this.projectileGroup.name = 'TowerSystem_Projectiles';

    if (this.scene) {
      if (this.towerGroup) this.scene.add(this.towerGroup);
      if (this.projectileGroup) this.scene.add(this.projectileGroup);
    }
  }

  /**
   * Attaches a Three.js scene after construction if not passed to constructor.
   */
  setScene(scene) {
    this.scene = scene;
    if (this.scene) {
      if (this.towerGroup && !this.towerGroup.parent) {
        this.scene.add(this.towerGroup);
      }
      if (this.projectileGroup && !this.projectileGroup.parent) {
        this.scene.add(this.projectileGroup);
      }
    }
  }

  _gridKey(col, row) {
    return `${col},${row}`;
  }

  /**
   * Creates and registers a new tower at grid cell (col, row) and world coordinates (wx, wz).
   */
  createTower(type, col, row, wx = col, wz = row) {
    const key = this._gridKey(col, row);
    const existing = this.gridMap.get(key);
    if (existing) {
      return existing;
    }

    const id = `tower_${this._nextTowerId++}`;
    const tower = new TowerInstance(id, type, col, row, wx, wz);

    // Build 3D mesh group via external visuals factory if provided, or internal procedural builder
    if (this.visuals && typeof this.visuals.createTowerMesh === 'function') {
      const customMesh = this.visuals.createTowerMesh(tower);
      if (customMesh) {
        tower.meshGroup = customMesh;
      }
    }
    if (!tower.meshGroup) {
      buildProceduralTowerMesh(tower);
    }

    if (tower.meshGroup && !tower.meshGroup.parent) {
      if (this.towerGroup) {
        this.towerGroup.add(tower.meshGroup);
      } else if (this.scene && typeof this.scene.add === 'function') {
        this.scene.add(tower.meshGroup);
      }
    }

    this.towers.push(tower);
    this.towerMap.set(String(tower.id), tower);
    this.gridMap.set(key, tower);

    if (this.visuals && typeof this.visuals.spawnBuildEffect === 'function') {
      this.visuals.spawnBuildEffect(makeVec3(tower.x, tower.y, tower.z), tower);
    }
    triggerAudio(this.audio, 'tower_build', tower);

    return tower;
  }

  placeTower(type, col, row, wx, wz) {
    return this.createTower(type, col, row, wx, wz);
  }

  /**
   * Looks up a tower at grid coordinates (col, row).
   */
  getTowerAt(col, row) {
    return this.gridMap.get(this._gridKey(col, row)) || null;
  }

  /**
   * Looks up a tower by its ID (accepts string ID, numeric ID, or TowerInstance).
   */
  getTowerById(towerId) {
    if (!towerId && towerId !== 0) return null;
    if (towerId instanceof TowerInstance) return towerId;
    if (typeof towerId === 'object' && towerId.id) {
      return this.towerMap.get(String(towerId.id)) || null;
    }
    const direct = this.towerMap.get(String(towerId));
    if (direct) return direct;
    const prefixed = this.towerMap.get(`tower_${towerId}`);
    return prefixed || null;
  }

  /**
   * Upgrades the specified tower to the next tier (up to Tier 3).
   * Returns the upgraded TowerInstance on success, or null if invalid / already max tier.
   */
  upgradeTower(towerId) {
    const tower = this.getTowerById(towerId);
    if (!tower || !tower.canUpgrade()) return null;

    const ok = tower.upgrade();
    if (!ok) return null;

    if (this.visuals && typeof this.visuals.upgradeTowerMesh === 'function') {
      this.visuals.upgradeTowerMesh(tower);
    } else if (tower._meshParts || !tower.meshGroup) {
      buildProceduralTowerMesh(tower);
    }

    if (this.visuals && typeof this.visuals.spawnUpgradeEffect === 'function') {
      this.visuals.spawnUpgradeEffect(makeVec3(tower.x, tower.y + 0.5, tower.z), tower);
    }
    triggerAudio(this.audio, 'tower_upgrade', tower);

    return tower;
  }

  /**
   * Sells and removes the specified tower from the battlefield.
   * Returns the integer 70% scrap refund value (or 0 if tower not found).
   */
  sellTower(towerId) {
    const tower = this.getTowerById(towerId);
    if (!tower) return 0;

    const refund = tower.getSellValue();

    if (this.visuals && typeof this.visuals.spawnSellEffect === 'function') {
      this.visuals.spawnSellEffect(makeVec3(tower.x, tower.y + 0.4, tower.z), tower, refund);
    }
    triggerAudio(this.audio, 'tower_sell', tower);

    this._disposeTowerMesh(tower);

    this.towerMap.delete(String(tower.id));
    this.gridMap.delete(this._gridKey(tower.col, tower.row));
    const idx = this.towers.indexOf(tower);
    if (idx !== -1) {
      this.towers.splice(idx, 1);
    }

    return refund;
  }

  _disposeTowerMesh(tower) {
    if (!tower || !tower.meshGroup) return;
    if (this.visuals && typeof this.visuals.removeTowerMesh === 'function') {
      this.visuals.removeTowerMesh(tower);
    }
    if (tower.meshGroup.parent) {
      tower.meshGroup.parent.remove(tower.meshGroup);
    }
    tower.meshGroup = null;
    tower._meshParts = null;
  }

  /**
   * Removes all towers, active projectiles, and ground goo pools.
   */
  clearAll() {
    for (let i = 0; i < this.towers.length; i++) {
      this._disposeTowerMesh(this.towers[i]);
    }
    this.towers.length = 0;
    this.towerMap.clear();
    this.gridMap.clear();

    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (p.mesh && p.mesh.parent) {
        p.mesh.parent.remove(p.mesh);
      }
    }
    this.projectiles.length = 0;
    this.gooPools.length = 0;
    this.totalKills = 0;
  }

  /**
   * Main per-frame update for all towers, continuous beams, goo pools, and projectiles.
   */
  update(dt, enemies = [], visuals = this.visuals, audio = this.audio, onEnemyKilled = null) {
    const clampedDt = Math.min(Math.max(dt || 0, 0), 0.1);
    if (clampedDt <= 0) return;

    const activeVisuals = visuals || this.visuals;
    const activeAudio = audio || this.audio;

    // 1. Update each placed tower
    for (let i = 0; i < this.towers.length; i++) {
      const tower = this.towers[i];
      this._updateSingleTower(tower, clampedDt, enemies, activeVisuals, activeAudio, onEnemyKilled);
    }

    // 2. Update active ballistic & homing projectiles (Gatling, Goo globs, Corkscrew Missiles)
    this._updateProjectiles(clampedDt, enemies, activeVisuals, activeAudio, onEnemyKilled);

    // 3. Update Tier 3 corrosive Goo Pools on the ground
    this._updateGooPools(clampedDt, enemies, activeVisuals, onEnemyKilled);
  }

  _updateSingleTower(tower, dt, enemies, visuals, audio, onEnemyKilled) {
    const stats = tower.tierStats;
    const fireInterval = 1.0 / Math.max(0.05, stats.fireRate);

    // Decay transient visual timers
    if (tower.cooldown > 0) {
      tower.cooldown = Math.max(0, tower.cooldown - dt);
    }
    tower.reloadProgress = Math.min(1.0, Math.max(0.0, 1.0 - tower.cooldown / fireInterval));

    if (tower.recoilOffset > 0) {
      tower.recoilOffset = Math.max(0, tower.recoilOffset - dt * 6.5);
    }
    if (tower.upgradeFlashTimer > 0) {
      tower.upgradeFlashTimer = Math.max(0, tower.upgradeFlashTimer - dt);
    }
    if (tower.muzzleFlashTimer > 0) {
      tower.muzzleFlashTimer = Math.max(0, tower.muzzleFlashTimer - dt);
    }
    tower.gooPulsePhase = (tower.gooPulsePhase + dt * 5.0) % (Math.PI * 2);

    // Acquire primary target (and multi-targets for Goo Tower)
    let primaryTarget = null;
    if (tower.type === 'goo') {
      const beamTargets = tower.acquireTargets(enemies, stats.beamCount || 1);
      tower.activeGooBeamTargets = beamTargets;
      primaryTarget = beamTargets.length > 0 ? beamTargets[0] : null;
    } else {
      tower.activeGooBeamTargets = [];
      primaryTarget = tower.acquireTarget(enemies);
    }
    tower.currentTarget = primaryTarget;

    // Smoothly track turret yaw toward primary target
    let aimError = 0;
    if (primaryTarget) {
      const dx = getEnemyX(primaryTarget) - tower.x;
      const dz = getEnemyZ(primaryTarget) - tower.z;
      tower.targetYaw = Math.atan2(dx, dz);
      const deltaYaw = shortestAngleDelta(tower.turretYaw, tower.targetYaw);
      const turnSpeed = tower.type === 'gatling' ? 14.0 : tower.type === 'missile' ? 8.5 : 11.0;
      const maxStep = turnSpeed * dt;
      if (Math.abs(deltaYaw) <= maxStep) {
        tower.turretYaw = tower.targetYaw;
      } else {
        tower.turretYaw += Math.sign(deltaYaw) * maxStep;
      }
      aimError = Math.abs(shortestAngleDelta(tower.turretYaw, tower.targetYaw));
    }

    // Tower-specific mechanical state & continuous effects
    if (tower.type === 'gatling') {
      const targetSpin = primaryTarget ? 18.0 + tower.tier * 5.0 : 0.0;
      tower.barrelSpinSpeed += (targetSpin - tower.barrelSpinSpeed) * Math.min(1, dt * 8.0);
      tower.barrelSpinAngle = (tower.barrelSpinAngle + tower.barrelSpinSpeed * dt) % (Math.PI * 2);
    } else if (tower.type === 'goo') {
      // Maintain pulsing continuous green slime beam to up to beamCount targets in range
      for (let b = 0; b < tower.activeGooBeamTargets.length; b++) {
        const beamTarget = tower.activeGooBeamTargets[b];
        if (!isEnemyAlive(beamTarget)) continue;

        applySlowToEnemy(beamTarget, stats.slowFactor, stats.slowDuration);

        if (visuals) {
          const fromPos = tower.getMuzzlePosition(b, tower.activeGooBeamTargets.length);
          const toPos = getEnemyCenterVec(beamTarget);
          if (typeof visuals.spawnGooStream === 'function') {
            visuals.spawnGooStream(fromPos, toPos, tower.tier, beamTarget, tower, dt);
          }
        }
      }
    } else if (tower.type === 'missile') {
      const desiredDoor = primaryTarget || tower.reloadProgress > 0.65 ? 1.0 : 0.0;
      tower.bayDoorOpen += (desiredDoor - tower.bayDoorOpen) * Math.min(1, dt * 7.0);
    } else if (tower.type === 'tesla') {
      const baseCharge = tower.reloadProgress * (primaryTarget ? 1.0 : 0.45);
      tower.chargeGlow += (baseCharge - tower.chargeGlow) * Math.min(1, dt * 9.0);
    }

    // Fire weapon when cooldown reaches 0 and target is acquired
    if (primaryTarget && tower.cooldown <= 0 && (tower.type === 'tesla' || aimError < 0.48)) {
      this._fireTowerWeapon(tower, primaryTarget, enemies, visuals, audio, onEnemyKilled);
      tower.cooldown = fireInterval;
      tower.reloadProgress = 0.0;
      tower.shotsFired += 1;
    }

    // Animate 3D mesh
    if (visuals && typeof visuals.updateTowerMesh === 'function') {
      visuals.updateTowerMesh(tower, dt);
    }
    updateProceduralTowerMesh(tower, dt);
  }

  _fireTowerWeapon(tower, primaryTarget, enemies, visuals, audio, onEnemyKilled) {
    const stats = tower.tierStats;

    if (tower.type === 'gatling') {
      const barrels = stats.barrels || 2;
      const barrelIdx = tower.activeBarrelIndex % barrels;
      tower.activeBarrelIndex += 1;

      tower.recoilOffset = 1.0;
      tower.muzzleFlashTimer = 0.075;
      tower.barrelSpinSpeed = 24.0 + tower.tier * 6.0;

      const muzzlePos = tower.getMuzzlePosition(barrelIdx, Math.min(barrels, 2));
      const targetPos = getEnemyCenterVec(primaryTarget);
      const dirVec = makeVec3(
        targetPos.x - muzzlePos.x,
        targetPos.y - muzzlePos.y,
        targetPos.z - muzzlePos.z
      );

      this._spawnProjectile({
        type: 'gatling',
        tower,
        tier: tower.tier,
        startPos: muzzlePos,
        target: primaryTarget,
        targetPos,
        speed: stats.projectileSpeed || 28,
        damage: stats.damage,
        splashRadius: 0,
      });

      if (visuals) {
        if (typeof visuals.spawnMuzzleFlash === 'function') {
          visuals.spawnMuzzleFlash(muzzlePos, dirVec, tower);
        }
        const ejectPos = makeVec3(
          tower.x + Math.cos(tower.turretYaw) * 0.32,
          tower.y + 0.78,
          tower.z - Math.sin(tower.turretYaw) * 0.32
        );
        if (typeof visuals.spawnShellCasing === 'function') {
          visuals.spawnShellCasing(ejectPos, tower.turretYaw, tower);
        } else if (typeof visuals.spawnBrassCasing === 'function') {
          visuals.spawnBrassCasing(ejectPos, tower.turretYaw, tower);
        }
      }

      triggerAudio(audio, 'gatling_fire', tower);
    } else if (tower.type === 'goo') {
      const targets =
        tower.activeGooBeamTargets.length > 0 ? tower.activeGooBeamTargets : [primaryTarget];
      tower.recoilOffset = 0.9;

      for (let i = 0; i < targets.length; i++) {
        const tgt = targets[i];
        if (!isEnemyAlive(tgt)) continue;

        const muzzlePos = tower.getMuzzlePosition(i, targets.length);
        const targetPos = getEnemyCenterVec(tgt);

        this._spawnProjectile({
          type: 'goo',
          tower,
          tier: tower.tier,
          startPos: muzzlePos,
          target: tgt,
          targetPos,
          speed: stats.projectileSpeed || 20,
          damage: stats.damage,
          splashRadius: stats.splashRadius || 1.5,
          slowFactor: stats.slowFactor,
          slowDuration: stats.slowDuration,
          leaveGooPool: tower.tier >= 3,
        });

        if (visuals) {
          if (typeof visuals.spawnGooGlob === 'function') {
            visuals.spawnGooGlob(muzzlePos, targetPos, tower.tier, tgt, tower);
          }
          if (typeof visuals.spawnGooStream === 'function') {
            visuals.spawnGooStream(muzzlePos, targetPos, tower.tier, tgt, tower);
          }
        }
      }

      triggerAudio(audio, 'goo_fire', tower);
    } else if (tower.type === 'missile') {
      const salvoCount = stats.salvoCount || 1;
      const nearbyTargets = tower.acquireTargets(enemies, salvoCount);
      tower.recoilOffset = 1.0;
      tower.bayDoorOpen = 1.0;

      for (let s = 0; s < salvoCount; s++) {
        const assignedTarget =
          nearbyTargets.length > 0 ? nearbyTargets[s % nearbyTargets.length] : primaryTarget;
        const muzzlePos = tower.getMuzzlePosition(s, salvoCount);
        const targetPos = getEnemyCenterVec(assignedTarget);

        this._spawnProjectile({
          type: 'missile',
          tower,
          tier: tower.tier,
          startPos: muzzlePos,
          target: assignedTarget,
          targetPos,
          speed: stats.projectileSpeed || 16,
          damage: stats.damage,
          splashRadius: stats.splashRadius || 2.7,
          antiAirBonus: tower.def.antiAirBonus || 1.25,
          corkscrewPhase: (s / salvoCount) * Math.PI * 2,
          corkscrewRadius: 0.26 + s * 0.05,
          corkscrewFreq: 12.5,
          salvoIndex: s,
        });

        if (visuals && typeof visuals.spawnMuzzleFlash === 'function') {
          const dirVec = makeVec3(
            targetPos.x - muzzlePos.x,
            targetPos.y - muzzlePos.y,
            targetPos.z - muzzlePos.z
          );
          visuals.spawnMuzzleFlash(muzzlePos, dirVec, tower);
        }
      }

      triggerAudio(audio, 'missile_launch', tower);
    } else if (tower.type === 'tesla') {
      // Instant hitscan branching chain lightning
      tower.chargeGlow = 1.0;
      tower.recoilOffset = 0.5;

      const emitterY = 1.75 + (tower.tier - 1) * 0.22;
      const fromPos = makeVec3(tower.x, tower.y + emitterY, tower.z);
      const chainPositions = [];
      const hitSet = new Set();

      // Hit primary target for 100% damage + electric jitter stun
      hitSet.add(primaryTarget);
      const primaryPos = getEnemyCenterVec(primaryTarget);
      chainPositions.push(primaryPos);

      applyStunToEnemy(primaryTarget, stats.stunDuration);
      applyDamageToEnemy(primaryTarget, stats.damage, tower, onEnemyKilled);

      // Sequentially hop to up to chainCount closest unhit enemies within chainRange
      let currentSource = primaryTarget;
      const maxHops = stats.chainCount || 2;
      const chainRange = stats.chainRange || 3.8;
      const chainFalloff = stats.chainFalloff || 0.72;

      for (let hop = 1; hop <= maxHops; hop++) {
        const sx = getEnemyX(currentSource);
        const sz = getEnemyZ(currentSource);
        let closestEnemy = null;
        let closestDist = chainRange;

        for (let i = 0; i < enemies.length; i++) {
          const candidate = enemies[i];
          if (hitSet.has(candidate) || !isEnemyAlive(candidate)) continue;
          const d = Math.hypot(getEnemyX(candidate) - sx, getEnemyZ(candidate) - sz);
          if (d <= closestDist) {
            closestDist = d;
            closestEnemy = candidate;
          }
        }

        if (!closestEnemy) break;

        hitSet.add(closestEnemy);
        chainPositions.push(getEnemyCenterVec(closestEnemy));

        const hopDamage = stats.damage * Math.pow(chainFalloff, hop);
        applyStunToEnemy(closestEnemy, stats.stunDuration);
        applyDamageToEnemy(closestEnemy, hopDamage, tower, onEnemyKilled);

        currentSource = closestEnemy;
      }

      if (visuals) {
        if (typeof visuals.spawnTeslaArc === 'function') {
          visuals.spawnTeslaArc(fromPos, chainPositions, tower.tier, tower);
        } else if (typeof visuals.spawnLightningArc === 'function') {
          visuals.spawnLightningArc(fromPos, chainPositions, tower.tier, tower);
        }
      }

      triggerAudio(audio, 'tesla_fire', tower, chainPositions.length);
    }
  }

  _spawnProjectile(cfg) {
    const startX = cfg.startPos.x;
    const startY = cfg.startPos.y;
    const startZ = cfg.startPos.z;
    const targetX = cfg.targetPos.x;
    const targetY = cfg.targetPos.y;
    const targetZ = cfg.targetPos.z;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dz = targetZ - startZ;
    const dist = Math.max(0.001, Math.hypot(dx, dy, dz));
    const speed = cfg.speed || 20;

    const proj = {
      id: `proj_${this._nextProjId++}`,
      type: cfg.type,
      tower: cfg.tower,
      towerId: cfg.tower ? cfg.tower.id : null,
      tier: cfg.tier || 1,
      x: startX,
      y: startY,
      z: startZ,
      prevX: startX,
      prevY: startY,
      prevZ: startZ,
      startX,
      startY,
      startZ,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      vz: (dz / dist) * speed,
      speed,
      damage: cfg.damage || 5,
      splashRadius: cfg.splashRadius || 0,
      slowFactor: cfg.slowFactor || 1.0,
      slowDuration: cfg.slowDuration || 0,
      leaveGooPool: Boolean(cfg.leaveGooPool),
      antiAirBonus: cfg.antiAirBonus || 1.25,
      target: cfg.target || null,
      targetX,
      targetY,
      targetZ,
      corkscrewPhase: cfg.corkscrewPhase || 0,
      corkscrewRadius: cfg.corkscrewRadius || 0.28,
      corkscrewFreq: cfg.corkscrewFreq || 12.0,
      age: 0,
      maxLife: 4.5,
      hit: false,
      mesh: null,
    };

    // Build lightweight 3D projectile mesh if Three.js scene is attached
    const THREE = typeof window !== 'undefined' ? window.THREE : null;
    if (THREE && this.projectileGroup) {
      let mesh = null;
      if (proj.type === 'gatling') {
        const geo = new THREE.BoxGeometry(0.06, 0.06, 0.36);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffe566 });
        mesh = new THREE.Mesh(geo, mat);
      } else if (proj.type === 'goo') {
        const geo = new THREE.SphereGeometry(0.14 + (proj.tier - 1) * 0.03, 8, 8);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x52ff22,
          emissive: 0x29a30b,
          emissiveIntensity: 0.6,
          roughness: 0.2,
        });
        mesh = new THREE.Mesh(geo, mat);
      } else if (proj.type === 'missile') {
        mesh = new THREE.Group();
        const bodyGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.42, 8);
        bodyGeo.rotateX(Math.PI * 0.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);

        const noseGeo = new THREE.ConeGeometry(0.068, 0.16, 8);
        noseGeo.rotateX(Math.PI * 0.5);
        const noseMat = new THREE.MeshBasicMaterial({ color: 0xff3b28 });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.z = 0.28;

        mesh.add(body, nose);
      }

      if (mesh) {
        mesh.position.set(proj.x, proj.y, proj.z);
        this.projectileGroup.add(mesh);
        proj.mesh = mesh;
      }
    }

    this.projectiles.push(proj);
    return proj;
  }

  _updateProjectiles(dt, enemies, visuals, audio, onEnemyKilled) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.age += dt;
      proj.prevX = proj.x;
      proj.prevY = proj.y;
      proj.prevZ = proj.z;

      // Update homing coordinates if target is still alive, or retarget for missiles
      if (proj.target && isEnemyAlive(proj.target)) {
        const c = getEnemyCenterVec(proj.target);
        proj.targetX = c.x;
        proj.targetY = c.y;
        proj.targetZ = c.z;
      } else if (proj.type === 'missile' && enemies && enemies.length > 0) {
        // Homing missile acquires closest alive enemy near its trajectory
        let bestCandidate = null;
        let bestDist = 4.2;
        for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
          const cand = enemies[eIdx];
          if (!isEnemyAlive(cand)) continue;
          const d = Math.hypot(getEnemyX(cand) - proj.x, getEnemyZ(cand) - proj.z);
          if (d < bestDist) {
            bestDist = d;
            bestCandidate = cand;
          }
        }
        if (bestCandidate) {
          proj.target = bestCandidate;
          const c = getEnemyCenterVec(bestCandidate);
          proj.targetX = c.x;
          proj.targetY = c.y;
          proj.targetZ = c.z;
        }
      }

      const dx = proj.targetX - proj.x;
      const dy = proj.targetY - proj.y;
      const dz = proj.targetZ - proj.z;
      const distToTarget = Math.hypot(dx, dy, dz);
      const stepDist = proj.speed * dt;

      if (distToTarget <= stepDist + 0.22 || proj.age >= proj.maxLife) {
        // Projectile reached impact point
        proj.x = proj.targetX;
        proj.y = proj.targetY;
        proj.z = proj.targetZ;
        this._resolveProjectileImpact(proj, enemies, visuals, audio, onEnemyKilled);

        if (proj.mesh && proj.mesh.parent) {
          proj.mesh.parent.remove(proj.mesh);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      // Advance base guiding position toward target
      const invDist = 1.0 / Math.max(0.0001, distToTarget);
      const dirX = dx * invDist;
      const dirY = dy * invDist;
      const dirZ = dz * invDist;

      proj.vx = dirX * proj.speed;
      proj.vy = dirY * proj.speed;
      proj.vz = dirZ * proj.speed;

      let nextX = proj.x + proj.vx * dt;
      let nextY = proj.y + proj.vy * dt;
      let nextZ = proj.z + proj.vz * dt;

      if (proj.type === 'missile') {
        // Helical corkscrew oscillation perpendicular to flight vector
        proj.corkscrewPhase += proj.corkscrewFreq * dt;
        const totalFlightDist = Math.max(
          0.5,
          Math.hypot(proj.targetX - proj.startX, proj.targetZ - proj.startZ)
        );
        const progress = Math.min(1, Math.max(0, 1 - distToTarget / totalFlightDist));
        const envelope = Math.sin(progress * Math.PI);
        const radius = proj.corkscrewRadius * envelope;

        // Orthonormal basis in horizontal plane perpendicular to (dirX, dirZ)
        const horizLen = Math.max(0.001, Math.hypot(dirX, dirZ));
        const rightX = -dirZ / horizLen;
        const rightZ = dirX / horizLen;

        const offsetRight = Math.cos(proj.corkscrewPhase) * radius;
        const offsetUp = Math.sin(proj.corkscrewPhase) * radius + Math.sin(progress * Math.PI) * 0.45 * dt;

        nextX += rightX * offsetRight * dt * 6.5;
        nextZ += rightZ * offsetRight * dt * 6.5;
        nextY = Math.max(0.25, nextY + offsetUp);

        if (visuals) {
          const currVec = makeVec3(nextX, nextY, nextZ);
          const prevVec = makeVec3(proj.prevX, proj.prevY, proj.prevZ);
          if (typeof visuals.spawnMissileSmokeTrail === 'function') {
            visuals.spawnMissileSmokeTrail(currVec, prevVec, proj);
          } else if (typeof visuals.spawnSmokePuff === 'function') {
            visuals.spawnSmokePuff(currVec, 0.25);
          }
        }
      } else if (proj.type === 'goo') {
        // Slight lobbing arc for viscous slime globules
        const totalDist = Math.max(0.5, Math.hypot(proj.targetX - proj.startX, proj.targetZ - proj.startZ));
        const progress = Math.min(1, Math.max(0, 1 - distToTarget / totalDist));
        nextY += Math.sin(progress * Math.PI) * 0.15 * dt * 8.0;
      }

      proj.x = nextX;
      proj.y = nextY;
      proj.z = nextZ;

      if (proj.mesh) {
        proj.mesh.position.set(proj.x, proj.y, proj.z);
        if (typeof proj.mesh.lookAt === 'function') {
          proj.mesh.lookAt(proj.targetX, proj.targetY, proj.targetZ);
        }
      }
    }
  }

  _resolveProjectileImpact(proj, enemies, visuals, audio, onEnemyKilled) {
    const impactPos = makeVec3(proj.x, proj.y, proj.z);
    const groundPos = makeVec3(proj.x, 0.05, proj.z);

    if (proj.type === 'gatling') {
      if (proj.target && isEnemyAlive(proj.target)) {
        applyDamageToEnemy(proj.target, proj.damage, proj.tower, onEnemyKilled);
      }
      if (visuals) {
        if (typeof visuals.spawnBulletImpact === 'function') {
          visuals.spawnBulletImpact(impactPos, proj.target);
        } else if (typeof visuals.spawnHitSpark === 'function') {
          visuals.spawnHitSpark(impactPos, 0xffe066);
        }
      }
    } else if (proj.type === 'goo') {
      // Direct + splash slow and bio-slime damage
      const splashRadius = proj.splashRadius || 1.5;
      if (proj.target && isEnemyAlive(proj.target)) {
        applySlowToEnemy(proj.target, proj.slowFactor, proj.slowDuration);
        applyDamageToEnemy(proj.target, proj.damage, proj.tower, onEnemyKilled);
      }

      if (enemies && enemies.length > 0) {
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          if (!isEnemyAlive(e)) continue;
          const d = Math.hypot(getEnemyX(e) - proj.x, getEnemyZ(e) - proj.z);
          if (d <= splashRadius) {
            applySlowToEnemy(e, proj.slowFactor, proj.slowDuration);
            if (e !== proj.target) {
              const falloff = 1.0 - 0.4 * (d / splashRadius);
              applyDamageToEnemy(e, proj.damage * falloff, proj.tower, onEnemyKilled);
            }
          }
        }
      }

      // Persistent green slime splatter decal under slowed units
      if (visuals) {
        if (typeof visuals.spawnGooSplatter === 'function') {
          visuals.spawnGooSplatter(groundPos, splashRadius, proj.tier);
        } else if (typeof visuals.spawnGooDecal === 'function') {
          visuals.spawnGooDecal(groundPos, splashRadius, proj.tier);
        }
      }

      // Tier 3 Goo Tower leaves persistent corrosive goo pools
      if (proj.leaveGooPool) {
        this.gooPools.push({
          x: proj.x,
          z: proj.z,
          radius: splashRadius,
          slowFactor: proj.slowFactor,
          slowDuration: proj.slowDuration,
          dps: proj.damage * 0.45,
          remainingLife: 3.5,
          tower: proj.tower,
        });
        if (visuals && typeof visuals.spawnGooPool === 'function') {
          visuals.spawnGooPool(groundPos, splashRadius, 3.5, proj.tier);
        }
      }
    } else if (proj.type === 'missile') {
      // Explosive AoE splash across all enemies within splashRadius (100% center to 50% edge)
      // + 1.25x anti-air damage bonus against Choppers / Zeppelins
      const splashRadius = Math.max(0.5, proj.splashRadius || 2.7);
      if (enemies && enemies.length > 0) {
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          if (!isEnemyAlive(e)) continue;
          const d = Math.hypot(getEnemyX(e) - proj.x, getEnemyZ(e) - proj.z);
          if (d <= splashRadius) {
            const normDist = Math.min(1.0, Math.max(0.0, d / splashRadius));
            const radialFalloff = 1.0 - 0.5 * normDist; // 100% at center, 50% at edge
            const airMultiplier = isAirEnemy(e) ? (proj.antiAirBonus || 1.25) : 1.0;
            const finalDamage = proj.damage * radialFalloff * airMultiplier;
            applyDamageToEnemy(e, finalDamage, proj.tower, onEnemyKilled);
          }
        }
      }

      if (visuals) {
        if (typeof visuals.spawnExplosion === 'function') {
          visuals.spawnExplosion(impactPos, splashRadius, proj.tier);
        } else if (typeof visuals.spawnFireball === 'function') {
          visuals.spawnFireball(impactPos, splashRadius, proj.tier);
        }
        if (typeof visuals.spawnScorchDecal === 'function') {
          visuals.spawnScorchDecal(groundPos, splashRadius);
        } else if (typeof visuals.spawnScorchedEarthDecal === 'function') {
          visuals.spawnScorchedEarthDecal(groundPos, splashRadius);
        }
      }

      triggerAudio(audio, 'missile_impact', proj.tower, splashRadius);
    }
  }

  _updateGooPools(dt, enemies, visuals, onEnemyKilled) {
    for (let i = this.gooPools.length - 1; i >= 0; i--) {
      const pool = this.gooPools[i];
      pool.remainingLife -= dt;
      if (pool.remainingLife <= 0) {
        this.gooPools.splice(i, 1);
        continue;
      }

      if (!enemies || enemies.length === 0) continue;
      for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
        const e = enemies[eIdx];
        if (!isEnemyAlive(e) || isAirEnemy(e)) continue;
        const d = Math.hypot(getEnemyX(e) - pool.x, getEnemyZ(e) - pool.z);
        if (d <= pool.radius) {
          applySlowToEnemy(e, pool.slowFactor, pool.slowDuration);
          applyDamageToEnemy(e, pool.dps * dt, pool.tower, onEnemyKilled);
        }
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.TOWER_DEFS = TOWER_DEFS;
  window.TowerInstance = TowerInstance;
  window.TowerSystem = TowerSystem;
}

export { TOWER_DEFS, TowerInstance, TowerSystem };
