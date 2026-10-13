import * as THREE from '../assets/vendor/three.module.js';

/**
 * Agent 3: Combat Engine, Twin-Stick Lock-On Targeting, 9-Weapon 1980s Arsenal & Argon City NPCs
 * Grand Theft Argon 3D Action Engine (Three.js r160)
 */
export class CombatWeaponsSystem {
  constructor(scene, world, vehicleSystem, callbacks = {}) {
    this.scene = scene;
    this.world = world;
    this.vehicleSystem = vehicleSystem;
    this.callbacks = callbacks || {};

    // Core groups
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'CombatWeaponsSystemRoot';
    this.scene.add(this.rootGroup);

    this.npcGroup = new THREE.Group();
    this.npcGroup.name = 'ViceCityNPCs';
    this.rootGroup.add(this.npcGroup);

    this.fxGroup = new THREE.Group();
    this.fxGroup.name = 'CombatFXPool';
    this.rootGroup.add(this.fxGroup);

    this.pickupGroup = new THREE.Group();
    this.pickupGroup.name = 'CombatPickups';
    this.rootGroup.add(this.pickupGroup);

    // Shared comic outline material (never recompiles shaders)
    this.inkLineMat = new THREE.LineBasicMaterial({
      color: 0x050508,
      transparent: true,
      opacity: 0.92,
    });

    // Player spatial & combat state
    this.x = 74.0;
    this.z = -36.0;
    this.y = this._sampleGroundY(this.x, this.z);
    this.vx = 0;
    this.vz = 0;
    this.rotationY = 0;
    this.aimRotationY = 0;

    this.playerPosition = new THREE.Vector3(this.x, this.y, this.z);
    this.playerVelocity = new THREE.Vector3(0, 0, 0);

    this.health = 100;
    this.maxHealth = 100;
    this.armor = 100;
    this.maxArmor = 100;
    this.cash = 25400; // Matches $25,400 HUD default

    this.inVehicle = false;
    this.currentVehicle = null;
    this.isSwimming = false;
    this.isRolling = false;
    this.isSprinting = false;
    this.isCombat = false;
    this.combatTimer = 0;

    // Evasive combat roll state (0.42s invincible somersault dash)
    this.rollTimer = 0;
    this.rollDuration = 0.42;
    this.rollCooldown = 0;
    this.rollDirX = 0;
    this.rollDirZ = -1;

    // Animation & dialogue timers
    this.walkCycle = 0;
    this.swimCycle = 0;
    this.swimRippleTimer = 0;
    this.meleeSwingTimer = 0;
    this.meleeComboStep = 0;
    this.fireCooldown = 0;
    this.reloadTimer = 0;
    this.throwCooldown = 0;
    this.voiceCooldown = 0;
    this.ambientChatCooldown = 1.5; // Ready quickly so pass-by banter triggers naturally on Ocean Drive
    this.panicVoiceCooldown = 0;
    this.insultVoiceCooldown = 0;
    this.chatRotateIdx = 0;
    this.panicRotateIdx = 0;
    this.insultRotateIdx = 0;
    this.playerHitFlash = 0;
    this.outfitStyle = 'hawaiian'; // 'hawaiian' | 'miami_blazer'

    // Curated 1986 Argon City Pedestrian Street Dialogue Bank
    this.pedDialogueBank = {
      chat: [
        {
          id: 'ped_chat_01',
          text: "Closing a million-dollar condo on my Motorola brick phone!",
        },
        {
          id: 'ped_chat_02',
          text: "Heading to the Malibu Club tonight—wear pastel linen!",
        },
        {
          id: 'ped_chat_03',
          text: 'Two cafecitos and a crate of Cohibas, hermano!',
        },
        {
          id: 'ped_chat_04',
          text: 'Fresh batteries in the Walkman and Flash FM on the dial!',
        },
        {
          id: 'ped_chat_05',
          text: "88 degrees in the shade—every tourist thinks they're on Argon Nights!",
        },
        {
          id: 'ped_chat_06',
          text: 'Two Italian sports cars before breakfast—only in Argon City!',
        },
      ],
      panic: [
        {
          id: 'ped_panic_01',
          text: 'Watch the sidewalk, maniac! My neon rollerblades!',
        },
        {
          id: 'ped_panic_02',
          text: 'This is an Art Deco promenade, not the Daytona 500!',
        },
        {
          id: 'ped_panic_03',
          text: 'Easy on the throttle! Somebody call ACPD!',
        },
      ],
      insult: [
        {
          id: 'ped_insult_01',
          text: 'Hey! Watch the Italian linen suit, pal!',
        },
        {
          id: 'ped_insult_02',
          text: "Hey, watch the paint job, amigo! That's a classic V8!",
        },
        {
          id: 'ped_insult_03',
          text: 'He just yanked me out of my leased convertible!',
        },
      ],
    };

    // Complete 9-Weapon 1980s Argon City Arsenal
    this.weapons = [
      {
        id: 'fists',
        name: 'Street Brawler Fists',
        clip: Infinity,
        maxClip: 0,
        reserve: Infinity,
        isInfinite: true,
        fireRate: 0.24,
        range: 2.9,
        damage: 34,
        pellets: 1,
        spread: 0.35,
        knockback: 6.5,
        isMelee: true,
        canDriveBy: false,
        iconType: 'fists',
        unlocked: true,
      },
      {
        id: 'katana',
        name: '1980s Argon Katana',
        clip: Infinity,
        maxClip: 0,
        reserve: Infinity,
        isInfinite: true,
        fireRate: 0.34,
        range: 3.8,
        damage: 90,
        pellets: 1,
        spread: 0.85,
        knockback: 8.5,
        isMelee: true,
        canDriveBy: false,
        iconType: 'katana',
        unlocked: true,
      },
      {
        id: 'revolver',
        name: '.357 Colt Python',
        clip: 6,
        maxClip: 6,
        reserve: 120,
        isInfinite: false,
        fireRate: 0.38,
        range: 27.0,
        damage: 95,
        pellets: 1,
        spread: 0.018,
        knockback: 9.0,
        isMelee: false,
        canDriveBy: true,
        iconType: 'revolver',
        unlocked: true,
      },
      {
        id: 'shotgun',
        name: 'Stubby Sawed-Off Shotgun',
        clip: 8,
        maxClip: 8,
        reserve: 96,
        isInfinite: false,
        fireRate: 0.62,
        range: 17.5,
        damage: 30,
        pellets: 6,
        spread: 0.22,
        knockback: 12.0,
        isMelee: false,
        canDriveBy: true,
        iconType: 'shotgun',
        unlocked: true,
      },
      {
        id: 'mac10',
        name: 'Ingram MAC-10 Micro-SMG',
        clip: 50,
        maxClip: 50,
        reserve: 580, // Matches 580-0 in Grand Theft Argon screenshot
        isInfinite: false,
        fireRate: 0.075,
        range: 24.5,
        damage: 24,
        pellets: 1,
        spread: 0.065,
        knockback: 3.2,
        isMelee: false,
        canDriveBy: true,
        iconType: 'mac10',
        unlocked: true,
      },
      {
        id: 'm16',
        name: 'M16A1 Assault Rifle',
        clip: 30,
        maxClip: 30,
        reserve: 300,
        isInfinite: false,
        fireRate: 0.095,
        range: 28.0,
        damage: 38,
        pellets: 1,
        spread: 0.03,
        knockback: 4.5,
        isMelee: false,
        canDriveBy: false,
        iconType: 'm16',
        unlocked: true,
      },
      {
        id: 'stun_baton',
        name: '80s Neon Shock Baton',
        clip: Infinity,
        maxClip: 0,
        reserve: Infinity,
        isInfinite: true,
        fireRate: 0.22,
        range: 3.4,
        damage: 45,
        pellets: 1,
        spread: 0.5,
        knockback: 7.5,
        isMelee: true,
        canDriveBy: false,
        iconType: 'stun_baton',
        unlocked: true,
      },
      {
        id: 'flamethrower',
        name: 'Napalm Flamethrower',
        clip: 100,
        maxClip: 100,
        reserve: 300,
        isInfinite: false,
        fireRate: 0.07,
        range: 14.5,
        damage: 18,
        pellets: 1,
        spread: 0.12,
        knockback: 1.5,
        isMelee: false,
        canDriveBy: false,
        iconType: 'flamethrower',
        unlocked: true,
      },
      {
        id: 'rpg',
        name: 'RPG-7 Rocket Launcher',
        clip: 1,
        maxClip: 1,
        reserve: 15,
        isInfinite: false,
        fireRate: 1.15,
        range: 32.0,
        damage: 250,
        pellets: 1,
        spread: 0.01,
        knockback: 18.0,
        isMelee: false,
        canDriveBy: false,
        iconType: 'rpg',
        unlocked: true,
      },
    ];

    // Default equipped weapon: MAC-10 Micro-SMG (index 4, matching reference screenshots)
    this.currentWeaponIndex = 4;

    // Secondary throwable slot (Molotov Cocktail & Frag Grenade, starting count 98 matching screenshot)
    this.throwables = [
      { id: 'molotov', name: 'Molotov Cocktail', count: 98, iconType: 'molotov' },
      { id: 'grenade', name: 'Frag Grenade', count: 98, iconType: 'grenade' },
    ];
    this.currentThrowableIndex = 0;

    // Targeting & Lock-On state
    this.maxLockRange = 28.0;
    this.lockedTarget = null;
    this.manualTargetIndex = 0;
    this.aimWorldPoint = new THREE.Vector3(this.x, this.y, this.z - 8);
    this.hasAimPoint = false;

    // Active projectiles, fire grids, tracers, pickups, and NPCs
    this.npcs = [];
    this.npcIdCounter = 1;
    this.lobbedProjectiles = [];
    this.rockets = [];
    this.flameParticles = [];
    this.localFireGrids = [];
    this.pickups = [];
    this.waterRipples = [];
    this.tracerPool = [];
    this.bloodDecals = [];
    this._npcOutfitTexCache = {};

    // Build procedural textures, player 3D rig, weapon viewmodels, lock-on reticle, and FX pools
    this.hawaiianTex = this._createHawaiianShirtTexture();
    this.blazerTex = this._createMiamiBlazerTexture();
    this._buildPlayerRig();
    this._buildLockOnReticle();
    this._buildFXPools();
    this._spawnInitialDistrictNPCs();
  }

  // ============================================================================
  // PROCEDURAL 1980s TEXTURES & COMIC OUTLINE HELPER
  // ============================================================================

  _addOutline(mesh, thresholdAngle = 24) {
    if (!mesh || !mesh.geometry) return;
    if (this.world && typeof this.world.addComicOutline === 'function') {
      this.world.addComicOutline(mesh, 1.02, thresholdAngle);
      return;
    }
    const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
    const line = new THREE.LineSegments(edges, this.inkLineMat);
    line.renderOrder = 2;
    mesh.add(line);
  }

  _createHawaiianShirtTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Vibrant 1980s Argon City turquoise cyan base
    ctx.fillStyle = '#00cbe6';
    ctx.fillRect(0, 0, 128, 128);

    // Tropical diagonal gradient sheen
    const grad = ctx.createLinearGradient(0, 0, 128, 128);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
    grad.addColorStop(1, 'rgba(0, 140, 185, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    // Deep teal palm fronds
    ctx.strokeStyle = '#005b6e';
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const px = (i * 37 + 15) % 116;
      const py = (i * 53 + 18) % 116;
      for (let f = -2; f <= 2; f++) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + f * 8, py - 14, px + f * 14, py - 6);
        ctx.stroke();
      }
    }

    // Flamingo pink & sunset yellow tropical hibiscus blooms
    const flowerCoords = [
      [24, 28], [88, 36], [52, 68], [104, 92], [30, 102], [74, 18],
    ];
    for (const [fx, fy] of flowerCoords) {
      ctx.fillStyle = '#ff2a85';
      for (let a = 0; a < 5; a++) {
        const ang = (a * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(ang) * 6, fy + Math.sin(ang) * 6, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffee55';
      ctx.beginPath();
      ctx.arc(fx, fy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // White V-neck undershirt + gold chain glint + dark comic collar lapels
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(44, 0);
    ctx.lineTo(84, 0);
    ctx.lineTo(64, 42);
    ctx.closePath();
    ctx.fill();

    // Gold chain necklace across V-neck
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(64, 8, 16, 0.25, Math.PI - 0.25);
    ctx.stroke();

    // Crisp comic lapels & button placket
    ctx.strokeStyle = '#071b24';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(42, 0);
    ctx.lineTo(64, 42);
    ctx.lineTo(86, 0);
    ctx.moveTo(64, 40);
    ctx.lineTo(64, 128);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  _createMiamiBlazerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Pastel white/cream Crockett blazer with neon pink graphic tee underneath
    ctx.fillStyle = '#f4f0f8';
    ctx.fillRect(0, 0, 128, 128);

    // Subtle shoulder seam & pocket detail
    ctx.fillStyle = '#e5dff0';
    ctx.fillRect(0, 0, 128, 18);

    // Neon flamingo pink tee center panel with cyan horizontal sunset stripes
    ctx.fillStyle = '#ff2a85';
    ctx.fillRect(42, 0, 44, 128);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(44, 38, 40, 6);
    ctx.fillRect(44, 50, 40, 4);

    // Cyan pocket square on left chest
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(20, 42);
    ctx.lineTo(32, 34);
    ctx.lineTo(34, 44);
    ctx.closePath();
    ctx.fill();

    // Bold black comic lapel lines & jacket edges
    ctx.strokeStyle = '#111118';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(24, 52);
    ctx.lineTo(42, 64);
    ctx.lineTo(42, 128);
    ctx.moveTo(94, 0);
    ctx.lineTo(104, 52);
    ctx.lineTo(86, 64);
    ctx.lineTo(86, 128);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  _getNPCOutfitTexture(type, faction, baseColorHex) {
    const cacheKey = `${type}_${faction}_${baseColorHex}`;
    if (this._npcOutfitTexCache[cacheKey]) {
      return this._npcOutfitTexCache[cacheKey];
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const hexStr = '#' + new THREE.Color(baseColorHex).getHexString();

    ctx.fillStyle = hexStr;
    ctx.fillRect(0, 0, 128, 128);

    if (faction === 'acpd' || type === 'acpd') {
      // Khaki-green ACPD tactical uniform shirt, dark shoulder epaulets, gold shield badge & utility belt
      ctx.fillStyle = '#1b2822';
      ctx.fillRect(8, 0, 32, 16);
      ctx.fillRect(88, 0, 32, 16);
      // Black uniform tie
      ctx.fillRect(58, 16, 12, 82);
      // Gold 5-point police badge on chest
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(36, 42, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111118';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Nameplate on right chest
      ctx.fillStyle = '#f0f4f8';
      ctx.fillRect(78, 38, 24, 7);
      // Utility belt with gold buckle at bottom
      ctx.fillStyle = '#111518';
      ctx.fillRect(0, 106, 128, 22);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(54, 108, 20, 16);
    } else if (faction === 'cartel' || type === 'cartel') {
      // Flamingo pink/coral pleated Cuban guayabera with tropical palm embroidery & gold medallion
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(46, 0);
      ctx.lineTo(82, 0);
      ctx.lineTo(64, 38);
      ctx.closePath();
      ctx.fill();
      // Vertical guayabera pleat stripes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(32, 12);
      ctx.lineTo(32, 124);
      ctx.moveTo(96, 12);
      ctx.lineTo(96, 124);
      ctx.stroke();
      // Gold medallion
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(64, 24, 5, 0, Math.PI * 2);
      ctx.fill();
      // Dark comic collar & placket
      ctx.strokeStyle = '#180814';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(44, 0);
      ctx.lineTo(64, 38);
      ctx.lineTo(84, 0);
      ctx.moveTo(64, 38);
      ctx.lineTo(64, 128);
      ctx.stroke();
    } else if (faction === 'cubans' || type === 'cubans') {
      // Open yellow Cuban vest over crisp white ribbed tank top + diagonal bandolier strap
      ctx.fillStyle = '#f7f8fc';
      ctx.fillRect(42, 0, 44, 128);
      ctx.strokeStyle = '#1a1412';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(42, 0);
      ctx.lineTo(42, 128);
      ctx.moveTo(86, 0);
      ctx.lineTo(86, 128);
      ctx.moveTo(22, 0);
      ctx.lineTo(98, 128);
      ctx.stroke();
    } else if (faction === 'sharks' || type === 'sharks') {
      // Electric purple leather vest over charcoal tee with neon cyan shark dorsal emblem
      ctx.fillStyle = '#161822';
      ctx.fillRect(44, 0, 40, 128);
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(64, 26);
      ctx.lineTo(82, 64);
      ctx.lineTo(46, 64);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#090a10';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 120, 120);
    } else if (type === 'miami_businessman') {
      // Open pastel mint Argon Nights blazer over coral tee with black comic lapels
      ctx.fillStyle = '#ff4488';
      ctx.fillRect(44, 0, 40, 128);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(44, 36, 40, 8);
      ctx.strokeStyle = '#12161f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(36, 0);
      ctx.lineTo(28, 48);
      ctx.lineTo(44, 62);
      ctx.lineTo(44, 128);
      ctx.moveTo(92, 0);
      ctx.lineTo(100, 48);
      ctx.lineTo(84, 62);
      ctx.lineTo(84, 128);
      ctx.stroke();
    } else if (type === 'beach_skater') {
      // Neon roller-skater tank top with electric cyan & yellow retro 1986 chevrons
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(0, 32);
      ctx.lineTo(64, 72);
      ctx.lineTo(128, 32);
      ctx.lineTo(128, 54);
      ctx.lineTo(64, 94);
      ctx.lineTo(0, 54);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffee33';
      ctx.fillRect(0, 0, 128, 12);
    } else {
      // Tropical tourist palm-print resort shirt with camera strap
      ctx.strokeStyle = 'rgba(255, 255, 220, 0.55)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 5; i++) {
        const px = 22 + i * 22;
        const py = 28 + ((i * 37) % 70);
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.strokeStyle = '#1a1612';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(34, 0);
      ctx.lineTo(92, 118);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this._npcOutfitTexCache[cacheKey] = tex;
    return tex;
  }

  // ============================================================================
  // PLAYER 3D CEL-SHADED PROTAGONIST RIG + 9 WEAPON VIEWMODELS
  // ============================================================================

  _buildPlayerRig() {
    this.playerMesh = new THREE.Group();
    this.playerMesh.name = 'ViceCityProtagonist';
    // Scaled slightly bold (1.25x) for crisp overhead Grand Theft Argon readability
    this.playerMesh.scale.setScalar(1.25);

    // Ground drop-shadow disc right beneath shoes so character is firmly grounded
    const shadowGeo = new THREE.CircleGeometry(0.62, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x05050a,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    this.playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.playerShadow.position.y = 0.03;
    this.playerMesh.add(this.playerShadow);

    const footRingGeo = new THREE.RingGeometry(0.50, 0.60, 24);
    footRingGeo.rotateX(-Math.PI / 2);
    const footRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.playerFootRing = new THREE.Mesh(footRingGeo, footRingMat);
    this.playerFootRing.position.y = 0.035;
    this.playerMesh.add(this.playerFootRing);

    // Materials
    this.playerShirtMat = new THREE.MeshLambertMaterial({ map: this.hawaiianTex });
    const jeansMat = new THREE.MeshLambertMaterial({ color: 0x1e4d8c });
    const sneakerMat = new THREE.MeshLambertMaterial({ color: 0xf7f9fc });
    const sneakerStripeMat = new THREE.MeshBasicMaterial({ color: 0xff2a85 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xe5ac83 });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x181311 });
    const shadesFrameMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const shadesLensMat = new THREE.MeshBasicMaterial({ color: 0x0b1020 });
    const beltMat = new THREE.MeshLambertMaterial({ color: 0x1a1512 });

    // Body root group (pivots for swimming and rolling)
    this.bodyPivot = new THREE.Group();
    this.bodyPivot.position.y = 0.85;
    this.playerMesh.add(this.bodyPivot);

    // Torso (broad 1980s shoulders, tapered waist)
    const torsoGeo = new THREE.BoxGeometry(0.60, 0.64, 0.35);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.playerShirtMat);
    this.torsoMesh.position.y = 0.24;
    this.torsoMesh.castShadow = true;
    this._addOutline(this.torsoMesh);
    this.bodyPivot.add(this.torsoMesh);

    // Popped 1980s collar & gold chain accent
    const collarGeo = new THREE.BoxGeometry(0.44, 0.11, 0.37);
    const collarMesh = new THREE.Mesh(collarGeo, this.playerShirtMat);
    collarMesh.position.set(0, 0.56, -0.01);
    this._addOutline(collarMesh);
    this.bodyPivot.add(collarMesh);

    const goldChainGeo = new THREE.TorusGeometry(0.11, 0.018, 6, 12, Math.PI);
    const goldChainMesh = new THREE.Mesh(goldChainGeo, shadesFrameMat);
    goldChainMesh.rotation.x = Math.PI * 0.55;
    goldChainMesh.position.set(0, 0.52, 0.16);
    this.bodyPivot.add(goldChainMesh);

    // Waist belt with gold buckle
    const beltGeo = new THREE.BoxGeometry(0.58, 0.1, 0.36);
    const beltMesh = new THREE.Mesh(beltGeo, beltMat);
    beltMesh.position.set(0, -0.09, 0);
    this._addOutline(beltMesh);
    this.bodyPivot.add(beltMesh);

    // Sculpted Head + 80s Feathered Hair Crown + Wrap-Around Aviator Sunglasses
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.62, 0);
    this.bodyPivot.add(this.headGroup);

    const headGeo = new THREE.BoxGeometry(0.36, 0.38, 0.36);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.y = 0.18;
    headMesh.castShadow = true;
    this._addOutline(headMesh);
    this.headGroup.add(headMesh);

    // 1980s voluminous swept-back dark hair cap + sculpted top crown + pompadour front
    const hairTopGeo = new THREE.BoxGeometry(0.41, 0.16, 0.43);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 0.36, -0.02);
    this._addOutline(hairTop);
    this.headGroup.add(hairTop);

    const hairCrownGeo = new THREE.SphereGeometry(0.21, 10, 8);
    hairCrownGeo.scale(1.0, 0.55, 1.08);
    const hairCrown = new THREE.Mesh(hairCrownGeo, hairMat);
    hairCrown.position.set(0, 0.41, -0.01);
    this.headGroup.add(hairCrown);

    const hairBackGeo = new THREE.BoxGeometry(0.39, 0.28, 0.15);
    const hairBack = new THREE.Mesh(hairBackGeo, hairMat);
    hairBack.position.set(0, 0.22, -0.16);
    this._addOutline(hairBack);
    this.headGroup.add(hairBack);

    const shadesFrameGeo = new THREE.BoxGeometry(0.40, 0.11, 0.08);
    const shadesFrame = new THREE.Mesh(shadesFrameGeo, shadesFrameMat);
    shadesFrame.position.set(0, 0.22, 0.17);
    this.headGroup.add(shadesFrame);

    const shadesLensGeo = new THREE.BoxGeometry(0.38, 0.085, 0.09);
    const shadesLens = new THREE.Mesh(shadesLensGeo, shadesLensMat);
    shadesLens.position.set(0, 0.22, 0.175);
    this.headGroup.add(shadesLens);

    // Articulated Left & Right Arms with Rounded Shoulder Caps
    const shoulderCapGeo = new THREE.SphereGeometry(0.118, 10, 8);
    const sleeveGeo = new THREE.BoxGeometry(0.19, 0.24, 0.19);
    const forearmGeo = new THREE.BoxGeometry(0.145, 0.34, 0.145);

    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.38, 0.48, 0);
    this.bodyPivot.add(this.leftArmPivot);

    const leftShoulderCap = new THREE.Mesh(shoulderCapGeo, this.playerShirtMat);
    leftShoulderCap.position.set(0, 0.03, 0);
    this.leftArmPivot.add(leftShoulderCap);

    const leftSleeve = new THREE.Mesh(sleeveGeo, this.playerShirtMat);
    leftSleeve.position.y = -0.08;
    this._addOutline(leftSleeve);
    this.leftArmPivot.add(leftSleeve);

    const leftForearm = new THREE.Mesh(forearmGeo, skinMat);
    leftForearm.position.set(0, -0.32, 0.04);
    this._addOutline(leftForearm);
    this.leftArmPivot.add(leftForearm);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.38, 0.48, 0);
    this.bodyPivot.add(this.rightArmPivot);

    const rightShoulderCap = new THREE.Mesh(shoulderCapGeo, this.playerShirtMat);
    rightShoulderCap.position.set(0, 0.03, 0);
    this.rightArmPivot.add(rightShoulderCap);

    const rightSleeve = new THREE.Mesh(sleeveGeo, this.playerShirtMat);
    rightSleeve.position.y = -0.08;
    this._addOutline(rightSleeve);
    this.rightArmPivot.add(rightSleeve);

    const rightForearm = new THREE.Mesh(forearmGeo, skinMat);
    rightForearm.position.set(0, -0.32, 0.06);
    this._addOutline(rightForearm);
    this.rightArmPivot.add(rightForearm);

    // Weapon Mount at right hand (+Z forward)
    this.weaponMount = new THREE.Group();
    this.weaponMount.position.set(0, -0.44, 0.18);
    this.rightArmPivot.add(this.weaponMount);

    // Build all 9 3D weapon viewmodels attached to weaponMount
    this._buildWeaponViewmodels();

    // Articulated Left & Right Legs
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.15, -0.12, 0);
    this.bodyPivot.add(this.leftLegPivot);

    const legGeo = new THREE.BoxGeometry(0.21, 0.56, 0.22);
    const leftLeg = new THREE.Mesh(legGeo, jeansMat);
    leftLeg.position.y = -0.28;
    leftLeg.castShadow = true;
    this._addOutline(leftLeg);
    this.leftLegPivot.add(leftLeg);

    const shoeGeo = new THREE.BoxGeometry(0.22, 0.14, 0.32);
    const leftShoe = new THREE.Mesh(shoeGeo, sneakerMat);
    leftShoe.position.set(0, -0.60, 0.05);
    this._addOutline(leftShoe);
    this.leftLegPivot.add(leftShoe);

    const stripeGeo = new THREE.BoxGeometry(0.23, 0.04, 0.18);
    const leftStripe = new THREE.Mesh(stripeGeo, sneakerStripeMat);
    leftStripe.position.set(0, -0.59, 0.04);
    this.leftLegPivot.add(leftStripe);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.15, -0.12, 0);
    this.bodyPivot.add(this.rightLegPivot);

    const rightLeg = new THREE.Mesh(legGeo, jeansMat);
    rightLeg.position.y = -0.28;
    rightLeg.castShadow = true;
    this._addOutline(rightLeg);
    this.rightLegPivot.add(rightLeg);

    const rightShoe = new THREE.Mesh(shoeGeo, sneakerMat);
    rightShoe.position.set(0, -0.60, 0.05);
    this._addOutline(rightShoe);
    this.rightLegPivot.add(rightShoe);

    const rightStripe = new THREE.Mesh(stripeGeo, sneakerStripeMat);
    rightStripe.position.set(0, -0.59, 0.04);
    this.rightLegPivot.add(rightStripe);

    // Sweeping Katana / Melee Slash Arc Mesh (hidden until slash)
    const slashArcGeo = new THREE.RingGeometry(0.8, 2.5, 18, 1, -Math.PI * 0.42, Math.PI * 0.84);
    slashArcGeo.rotateX(-Math.PI / 2);
    slashArcGeo.rotateY(Math.PI / 2);
    const slashArcMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.slashArcMesh = new THREE.Mesh(slashArcGeo, slashArcMat);
    this.slashArcMesh.position.set(0, 0.25, 0.4);
    this.bodyPivot.add(this.slashArcMesh);

    this.playerMesh.position.set(this.x, this.y, this.z);
    this.rootGroup.add(this.playerMesh);
    this._syncWeaponViewmodelVisibility();
  }

  _buildWeaponViewmodels() {
    this.weaponModels = {};

    const darkSteelMat = new THREE.MeshLambertMaterial({ color: 0x222630 });
    const chromeMat = new THREE.MeshLambertMaterial({ color: 0xd8e2ec });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x6e3b1e });
    const yellowMat = new THREE.MeshLambertMaterial({ color: 0xffd000 });
    const oliveMat = new THREE.MeshLambertMaterial({ color: 0x3b4d2e });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const flameOrangeMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });

    // 1. FISTS (Gold Brass Knuckles)
    const fistsGroup = new THREE.Group();
    const knuckleBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.12), yellowMat);
    knuckleBar.position.set(0, 0, 0.08);
    this._addOutline(knuckleBar);
    fistsGroup.add(knuckleBar);
    this.weaponModels.fists = fistsGroup;

    // 2. KATANA (Black Tsuka Grip + Gold Tsuba + Gleaming Curved Blade + Neon Cyan Edge)
    const katanaGroup = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.32), darkSteelMat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.03), yellowMat);
    guard.position.set(0, 0, 0.16);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 1.05), chromeMat);
    blade.position.set(0, 0.02, 0.68);
    const bladeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 1.05), neonCyanMat);
    bladeEdge.position.set(0, 0.055, 0.68);
    this._addOutline(blade);
    katanaGroup.add(handle, guard, blade, bladeEdge);
    this.weaponModels.katana = katanaGroup;

    // 3. REVOLVER (.357 Colt Python Chrome Magnum)
    const revGroup = new THREE.Group();
    const revGrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.20, 0.12), woodMat);
    revGrip.position.set(0, -0.05, 0.02);
    const revCylinder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.16), chromeMat);
    revCylinder.position.set(0, 0.06, 0.14);
    const revBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.38), chromeMat);
    revBarrel.position.set(0, 0.07, 0.36);
    this._addOutline(revBarrel);
    revGroup.add(revGrip, revCylinder, revBarrel);
    this.weaponModels.revolver = revGroup;

    // 4. SHOTGUN (Stubby Sawed-Off Twin Barrel)
    const sgGroup = new THREE.Group();
    const sgStock = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.16, 0.28), woodMat);
    sgStock.position.set(0, -0.02, 0.05);
    const sgBarrels = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.56), darkSteelMat);
    sgBarrels.position.set(0, 0.05, 0.38);
    const sgPump = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.24), woodMat);
    sgPump.position.set(0, -0.01, 0.34);
    this._addOutline(sgBarrels);
    sgGroup.add(sgStock, sgBarrels, sgPump);
    this.weaponModels.shotgun = sgGroup;

    // 5. MAC-10 (Iconic Boxy Silver/Steel 1980s Micro-SMG + Suppressor Barrel + Long Mag)
    const macGroup = new THREE.Group();
    const macReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.38), chromeMat);
    macReceiver.position.set(0, 0.06, 0.18);
    const macMag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.32, 0.10), darkSteelMat);
    macMag.position.set(0, -0.12, 0.12);
    const macSuppressor = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.28), darkSteelMat);
    macSuppressor.position.set(0, 0.06, 0.48);
    this._addOutline(macReceiver);
    this._addOutline(macSuppressor);
    macGroup.add(macReceiver, macMag, macSuppressor);
    this.weaponModels.mac10 = macGroup;

    // 6. M16A1 (Matte Black 1980s Assault Rifle)
    const m16Group = new THREE.Group();
    const m16Stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.32), darkSteelMat);
    m16Stock.position.set(0, 0.0, -0.04);
    const m16Body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.20, 0.44), darkSteelMat);
    m16Body.position.set(0, 0.05, 0.26);
    const m16Mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.11), chromeMat);
    m16Mag.position.set(0, -0.10, 0.30);
    const m16Barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.52), darkSteelMat);
    m16Barrel.position.set(0, 0.06, 0.68);
    this._addOutline(m16Body);
    m16Group.add(m16Stock, m16Body, m16Mag, m16Barrel);
    this.weaponModels.m16 = m16Group;

    // 7. STUN BATON (80s Neon Shock Baton — Matte-Black & Chrome Baton + Electric-Cyan Neon Core + Gold Handguard)
    const batonGroup = new THREE.Group();
    const batonGrip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.28), darkSteelMat);
    batonGrip.position.set(0, 0, 0.10);
    const batonGuard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.04), yellowMat);
    batonGuard.position.set(0, 0, 0.24);
    const batonShaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.62), chromeMat);
    batonShaft.position.set(0, 0.01, 0.56);
    const batonCore = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.56), neonCyanMat);
    batonCore.position.set(0, 0.04, 0.58);
    const batonTip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.08), neonCyanMat);
    batonTip.position.set(0, 0.01, 0.88);
    this._addOutline(batonGuard);
    this._addOutline(batonShaft);
    batonGroup.add(batonGrip, batonGuard, batonShaft, batonCore, batonTip);
    this.weaponModels.stun_baton = batonGroup;

    // 8. FLAMETHROWER (Olive/Yellow Tank + Igniter Nozzle)
    const ftGroup = new THREE.Group();
    const ftBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.20, 0.46), oliveMat);
    ftBody.position.set(0, 0.02, 0.22);
    const ftTank = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.24), yellowMat);
    ftTank.position.set(0, -0.06, 0.18);
    const ftNozzle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.44), darkSteelMat);
    ftNozzle.position.set(0, 0.05, 0.62);
    const ftPilot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.10), flameOrangeMat);
    ftPilot.position.set(0, 0.05, 0.86);
    this._addOutline(ftBody);
    ftGroup.add(ftBody, ftTank, ftNozzle, ftPilot);
    this.weaponModels.flamethrower = ftGroup;

    // 9. RPG-7 (Shoulder Tube + Wood Shield + Conical Green Warhead)
    const rpgGroup = new THREE.Group();
    const rpgTube = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.96), oliveMat);
    rpgTube.position.set(0, 0.10, 0.24);
    const rpgWood = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.32), woodMat);
    rpgWood.position.set(0, 0.10, 0.16);
    const rpgWarhead = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 8), oliveMat);
    rpgWarhead.rotation.x = Math.PI / 2;
    rpgWarhead.position.set(0, 0.10, 0.84);
    this._addOutline(rpgTube);
    this._addOutline(rpgWarhead);
    rpgGroup.add(rpgTube, rpgWood, rpgWarhead);
    this.weaponModels.rpg = rpgGroup;

    for (const key of Object.keys(this.weaponModels)) {
      this.weaponMount.add(this.weaponModels[key]);
    }
    this.weaponModels.chainsaw = this.weaponModels.stun_baton;
  }

  _syncWeaponViewmodelVisibility() {
    const activeWeapon = this.weapons[this.currentWeaponIndex];
    for (const key of Object.keys(this.weaponModels)) {
      this.weaponModels[key].visible = false;
    }
    if (activeWeapon && this.weaponModels[activeWeapon.id]) {
      this.weaponModels[activeWeapon.id].visible = true;
    }
    if (this.rightArmPivot && this.leftArmPivot) {
      if (activeWeapon.id === 'fists') {
        this.rightArmPivot.rotation.x = -Math.PI * 0.32;
        this.leftArmPivot.rotation.x = -Math.PI * 0.28;
      } else if (activeWeapon.isMelee) {
        this.rightArmPivot.rotation.x = -Math.PI * 0.38;
        this.leftArmPivot.rotation.x = -Math.PI * 0.2;
      } else {
        this.rightArmPivot.rotation.x = -Math.PI * 0.46;
        this.leftArmPivot.rotation.x = -Math.PI * 0.42;
      }
    }
  }

  toggleOutfit() {
    this.outfitStyle = this.outfitStyle === 'hawaiian' ? 'miami_blazer' : 'hawaiian';
    if (this.playerShirtMat) {
      this.playerShirtMat.map = this.outfitStyle === 'hawaiian' ? this.hawaiianTex : this.blazerTex;
      this.playerShirtMat.needsUpdate = true;
    }
    return this.outfitStyle;
  }

  // ============================================================================
  // GRAND THEFT ARGON SEGMENTED LOCK-ON RETICLE
  // ============================================================================

  _buildLockOnReticle() {
    this.reticleGroup = new THREE.Group();
    this.reticleGroup.name = 'ChinatownWarsLockReticle';
    this.reticleGroup.visible = false;

    this.reticleMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.reticleOutlineMat = new THREE.MeshBasicMaterial({
      color: 0x050508,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Inner pulsing ring (pre-rotated into XZ plane, scaled via scale.set(r, 1, r))
    const innerRingGeo = new THREE.RingGeometry(0.85, 1.05, 28);
    innerRingGeo.rotateX(-Math.PI / 2);
    this.reticleInnerRing = new THREE.Mesh(innerRingGeo, this.reticleMat);
    this.reticleInnerRing.position.y = 0.08;
    this.reticleGroup.add(this.reticleInnerRing);

    // 4 Segmented rotating corner bracket arcs
    this.reticleBracketsGroup = new THREE.Group();
    this.reticleBracketsGroup.position.y = 0.09;
    this.reticleGroup.add(this.reticleBracketsGroup);

    for (let i = 0; i < 4; i++) {
      const startAngle = i * (Math.PI / 2) + 0.22;
      const arcLength = Math.PI / 2 - 0.44;

      const backArcGeo = new THREE.RingGeometry(1.22, 1.56, 10, 1, startAngle - 0.04, arcLength + 0.08);
      backArcGeo.rotateX(-Math.PI / 2);
      const backArc = new THREE.Mesh(backArcGeo, this.reticleOutlineMat);
      this.reticleBracketsGroup.add(backArc);

      const arcGeo = new THREE.RingGeometry(1.28, 1.48, 10, 1, startAngle, arcLength);
      arcGeo.rotateX(-Math.PI / 2);
      const arcMesh = new THREE.Mesh(arcGeo, this.reticleMat);
      arcMesh.position.y = 0.01;
      this.reticleBracketsGroup.add(arcMesh);
    }

    // Overhead floating target diamond above locked target
    const diamondGeo = new THREE.OctahedronGeometry(0.28, 0);
    this.reticleDiamond = new THREE.Mesh(diamondGeo, this.reticleMat);
    this.reticleDiamond.position.y = 2.65;
    this._addOutline(this.reticleDiamond);
    this.reticleGroup.add(this.reticleDiamond);

    this.rootGroup.add(this.reticleGroup);
  }

  // ============================================================================
  // PRE-ALLOCATED VISUAL FX POOLS (TRACERS, BLOOD, RIPPLES, FIRE GRIDS, PICKUPS)
  // ============================================================================

  _buildFXPools() {
    // 1. Bullet Tracer & Muzzle Flash Pool (16 reusable beams + star flashes)
    const tracerGeo = new THREE.BoxGeometry(0.09, 0.09, 1.0);
    tracerGeo.translate(0, 0, 0.5); // Extends from 0 to +1 along +Z for lookAt()
    const flashGeo = new THREE.OctahedronGeometry(0.38, 0);

    for (let i = 0; i < 16; i++) {
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffbb22,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const beam = new THREE.Mesh(tracerGeo, beamMat);
      beam.visible = false;
      this.fxGroup.add(beam);

      const flashMat = new THREE.MeshBasicMaterial({
        color: 0xfff5aa,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const flash = new THREE.Mesh(flashGeo, flashMat);
      flash.visible = false;
      this.fxGroup.add(flash);

      this.tracerPool.push({ beam, flash, timer: 0, maxTimer: 0.09 });
    }

    // 2. Water Swim Ripple Rings Pool (8 rings in XZ plane)
    const rippleGeo = new THREE.RingGeometry(0.35, 0.48, 20);
    rippleGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xe0ffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(rippleGeo, mat);
      mesh.visible = false;
      this.fxGroup.add(mesh);
      this.waterRipples.push({ mesh, active: false, age: 0, maxAge: 0.9 });
    }

    // 3. Comic Impact Star / Dust Ring Pool (18 non-gory comic impact bursts on asphalt)
    const impactRingGeo = new THREE.RingGeometry(0.24, 0.56, 8);
    impactRingGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffaa00 : 0x222630,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(impactRingGeo, mat);
      mesh.visible = false;
      this.fxGroup.add(mesh);
      this.bloodDecals.push({ mesh, active: false, timer: 0 });
    }
  }

  _spawnTracerAndMuzzleFlash(startX, startY, startZ, endX, endY, endZ, colorHex = 0xffbb22) {
    let slot = this.tracerPool.find((t) => t.timer <= 0);
    if (!slot) slot = this.tracerPool[0];

    const dx = endX - startX;
    const dy = endY - startY;
    const dz = endZ - startZ;
    const dist = Math.max(0.2, Math.hypot(dx, dy, dz));

    slot.beam.visible = true;
    slot.beam.position.set(startX, startY, startZ);
    slot.beam.lookAt(endX, endY, endZ);
    slot.beam.scale.set(1.2, 1.2, dist);
    slot.beam.material.color.setHex(colorHex);
    slot.beam.material.opacity = 0.95;

    slot.flash.visible = true;
    slot.flash.position.set(startX, startY, startZ);
    slot.flash.scale.set(1.35, 0.9, 1.85);
    slot.flash.rotation.y = Math.atan2(dx, dz);
    slot.flash.material.opacity = 0.98;

    slot.timer = slot.maxTimer;

    if (typeof this.callbacks.onMuzzleFlash === 'function') {
      this.callbacks.onMuzzleFlash(startX, startY, startZ, endX, endY, endZ);
    }
  }

  _spawnLocalBloodDecal(x, z) {
    let slot = this.bloodDecals.find((b) => !b.active);
    if (!slot) slot = this.bloodDecals[0];

    const gy = this._sampleGroundY(x, z) + 0.035;
    slot.active = true;
    slot.timer = 1.6;
    slot.mesh.visible = true;
    slot.mesh.position.set(x, gy, z);
    slot.mesh.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.75 + Math.random() * 0.45;
    slot.mesh.scale.set(s, 1.0, s);
    slot.mesh.material.color.setHex(Math.random() > 0.35 ? 0xffaa00 : 0x222630);
    slot.mesh.material.opacity = 0.72;
  }

  _spawnWaterRipple(x, z) {
    const slot = this.waterRipples.find((r) => !r.active);
    if (!slot) return;
    slot.active = true;
    slot.age = 0;
    slot.mesh.visible = true;
    slot.mesh.position.set(x, -0.32, z);
    slot.mesh.scale.set(0.5, 1.0, 0.5);
    slot.mesh.material.opacity = 0.82;
  }

  // ============================================================================
  // 1980s ARGON CITY PEDESTRIANS, RIVAL CARTEL, GANGS & POLICE FOOT PATROLS
  // ============================================================================

  _spawnInitialDistrictNPCs() {
    // 1. Ocean Beach Civilians & Sunbathers & Skaters (14 NPCs — all on sidewalks/promenade/sand, never in road lanes!)
    const oceanBeachSpawns = [
      { type: 'beach_skater', faction: 'civilian', x: 88.5, z: -20, isHostile: false },
      { type: 'beach_skater', faction: 'civilian', x: 88.5, z: -55, isHostile: false },
      { type: 'beach_skater', faction: 'civilian', x: 88.5, z: 25, isHostile: false },
      { type: 'sunbather', faction: 'civilian', x: 106, z: -15, isHostile: false },
      { type: 'sunbather', faction: 'civilian', x: 112, z: -48, isHostile: false },
      { type: 'sunbather', faction: 'civilian', x: 108, z: 18, isHostile: false },
      { type: 'sunbather', faction: 'civilian', x: 114, z: 52, isHostile: false },
      { type: 'miami_businessman', faction: 'civilian', x: 71.5, z: -14, isHostile: false },
      { type: 'miami_businessman', faction: 'civilian', x: 71.5, z: 32, isHostile: false },
      { type: 'miami_businessman', faction: 'civilian', x: 48.0, z: -30, isHostile: false },
      { type: 'tourist', faction: 'civilian', x: 71.5, z: -68, isHostile: false },
      { type: 'tourist', faction: 'civilian', x: 71.5, z: 64, isHostile: false },
      { type: 'acpd', faction: 'acpd', x: 71.5, z: -48, isHostile: false, provoked: false, weaponId: 'revolver' },
      { type: 'acpd', faction: 'acpd', x: 48.0, z: 12, isHostile: false, provoked: false, weaponId: 'shotgun' },
    ];

    // 2. Starfish Island Cartel Guards & Mansion Staff (10 NPCs — peaceful until provoked by gunfire/attack/Rampage!)
    const starfishSpawns = [
      { type: 'cartel', faction: 'cartel', x: -18, z: -10, isHostile: false, provoked: false, weaponId: 'mac10' },
      { type: 'cartel', faction: 'cartel', x: -42, z: -10, isHostile: false, provoked: false, weaponId: 'm16' },
      { type: 'cartel', faction: 'cartel', x: -25, z: -16, isHostile: false, provoked: false, weaponId: 'mac10' },
      { type: 'cartel', faction: 'cartel', x: -36, z: -16, isHostile: false, provoked: false, weaponId: 'm16' },
      { type: 'cartel', faction: 'cartel', x: -10, z: 10, isHostile: false, provoked: false, weaponId: 'mac10' },
      { type: 'cartel', faction: 'cartel', x: -52, z: 12, isHostile: false, provoked: false, weaponId: 'shotgun' },
      { type: 'cartel', faction: 'cartel', x: 52, z: -26, isHostile: false, provoked: false, weaponId: 'mac10' },
      { type: 'cartel', faction: 'cartel', x: 56, z: -32, isHostile: false, provoked: false, weaponId: 'revolver' },
      { type: 'sunbather', faction: 'civilian', x: -26, z: -38, isHostile: false },
      { type: 'miami_businessman', faction: 'civilian', x: -34, z: 10, isHostile: false },
    ];

    // 3. Little Haiti Cuban Los Cabrones & Pedestrians (8 NPCs — peaceful until provoked!)
    const haitiSpawns = [
      { type: 'cubans', faction: 'cubans', x: -106.5, z: -18, isHostile: false, provoked: false, weaponId: 'revolver' },
      { type: 'cubans', faction: 'cubans', x: -123.5, z: -24, isHostile: false, provoked: false, weaponId: 'shotgun' },
      { type: 'cubans', faction: 'cubans', x: -106.5, z: -48, isHostile: false, provoked: false, weaponId: 'mac10' },
      { type: 'cubans', faction: 'cubans', x: -124.0, z: 14, isHostile: false, provoked: false, weaponId: 'revolver' },
      { type: 'cubans', faction: 'cubans', x: -106.0, z: -72, isHostile: false, provoked: false, weaponId: 'shotgun' },
      { type: 'tourist', faction: 'civilian', x: -106.5, z: 10, isHostile: false },
      { type: 'miami_businessman', faction: 'civilian', x: -123.5, z: -60, isHostile: false },
      { type: 'acpd', faction: 'acpd', x: -106.5, z: -35, isHostile: false, provoked: false, weaponId: 'revolver' },
    ];

    // 4. Argon Port Marina & North Beach Sharks Street Gang (8 NPCs — peaceful until provoked!)
    const marinaSpawns = [
      { type: 'sharks', faction: 'sharks', x: 18, z: 104, isHostile: false, provoked: false, weaponId: 'mac10' },
      { type: 'sharks', faction: 'sharks', x: 8, z: 106, isHostile: false, provoked: false, weaponId: 'katana' },
      { type: 'sharks', faction: 'sharks', x: -48, z: 104, isHostile: false, provoked: false, weaponId: 'shotgun' },
      { type: 'sharks', faction: 'sharks', x: -58, z: 104, isHostile: false, provoked: false, weaponId: 'mac10' },
      { type: 'sharks', faction: 'sharks', x: 64, z: -80, isHostile: false, provoked: false, weaponId: 'mac10' },
      { type: 'sharks', faction: 'sharks', x: 54, z: -80, isHostile: false, provoked: false, weaponId: 'katana' },
      { type: 'tourist', faction: 'civilian', x: 24, z: 86, isHostile: false },
      { type: 'acpd', faction: 'acpd', x: 48, z: 86, isHostile: false, provoked: false, weaponId: 'shotgun' },
    ];

    const allSpawns = [
      ...oceanBeachSpawns,
      ...starfishSpawns,
      ...haitiSpawns,
      ...marinaSpawns,
    ];

    for (const cfg of allSpawns) {
      this._createNPC(cfg);
    }
  }

  _getNPCPalette(type, faction) {
    if (faction === 'cartel' || type === 'cartel') {
      return {
        shirt: 0xff2a85, // Flamingo pink guayabera
        pants: 0xf4f4f8, // White linen trousers
        skin: 0xd99b72,
        hair: 0x181412,
        hat: null,
        shades: true,
      };
    }
    if (faction === 'cubans' || type === 'cubans') {
      return {
        shirt: 0xffcc00, // Yellow Cuban vest
        pants: 0x24487a, // Blue jeans
        skin: 0xd6966b,
        hair: 0x1a1412,
        hat: 0xd91b2e, // Red bandana
        shades: true,
      };
    }
    if (faction === 'sharks' || type === 'sharks') {
      return {
        shirt: 0x8a2be2, // Purple leather gang vest
        pants: 0x181c26,
        skin: 0xc88860,
        hair: 0x00f0ff, // Neon cyan punk mohawk/headband
        hat: 0x00f0ff,
        shades: true,
      };
    }
    if (faction === 'acpd' || type === 'acpd') {
      return {
        shirt: 0x2d6b4f, // ACPD green/khaki uniform
        pants: 0x1b2822,
        skin: 0xe0a67d,
        hair: 0x221a15,
        hat: 0x1b2822, // Police peaked cap
        shades: true,
      };
    }
    if (type === 'beach_skater') {
      return {
        shirt: 0xff3399, // Neon pink crop top
        pants: 0x00e5ff, // Electric cyan shorts
        skin: 0xe6ad84,
        hair: 0xf5d042, // Blonde 80s hair
        hat: 0xff2a85, // Neon sun visor
        shades: false,
        skates: true,
      };
    }
    if (type === 'sunbather') {
      return {
        shirt: 0xe6ad84, // Sun-tanned beachwear
        pants: 0xff5500, // Bright coral swimwear
        skin: 0xe6ad84,
        hair: 0x4a2c18,
        hat: null,
        shades: true,
      };
    }
    if (type === 'miami_businessman') {
      return {
        shirt: 0xaef5e8, // Pastel mint Miami suit
        pants: 0xf5f5fa,
        skin: 0xdfa278,
        hair: 0x2b2018,
        hat: null,
        shades: true,
      };
    }
    // Tourist default
    return {
      shirt: 0xff8844,
      pants: 0xe8dec8,
      skin: 0xe5ac83,
      hair: 0x332218,
      hat: 0xf2d894,
      shades: false,
    };
  }

  _createNPC(cfg) {
    const id = `npc_${this.npcIdCounter++}`;
    const palette = this._getNPCPalette(cfg.type, cfg.faction);

    const group = new THREE.Group();
    group.scale.setScalar(1.18);

    // Soft dark ground drop-shadow disc right beneath shoes so characters never float
    const shadowGeo = new THREE.CircleGeometry(0.62, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x05050a,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.03;
    group.add(shadow);

    // Hostile faction indicator ring on ground (hidden while peaceful, shown when provoked/hostile)
    let hostileRing = null;
    if (cfg.faction && cfg.faction !== 'civilian') {
      const ringGeo = new THREE.RingGeometry(0.46, 0.56, 18);
      ringGeo.rotateX(-Math.PI / 2);
      const ringColor =
        cfg.faction === 'cartel'
          ? 0xff2a85
          : cfg.faction === 'cubans'
          ? 0xffbb00
          : cfg.faction === 'acpd'
          ? 0x00d8ff
          : 0xaa33ff;
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      hostileRing = new THREE.Mesh(ringGeo, ringMat);
      hostileRing.position.y = 0.035;
      hostileRing.visible = Boolean(cfg.isHostile);
      group.add(hostileRing);
    }

    const bodyPivot = new THREE.Group();
    bodyPivot.position.y = 0.82;
    group.add(bodyPivot);

    const outfitTex = this._getNPCOutfitTexture(cfg.type, cfg.faction, palette.shirt);
    const shirtMat = new THREE.MeshLambertMaterial({ map: outfitTex });
    const sleeveMat = new THREE.MeshLambertMaterial({ color: palette.shirt });
    const pantsMat = new THREE.MeshLambertMaterial({ color: palette.pants });
    const skinMat = new THREE.MeshLambertMaterial({ color: palette.skin });
    const hairMat = new THREE.MeshLambertMaterial({ color: palette.hair });
    const shoeMat = new THREE.MeshLambertMaterial({
      color: cfg.type === 'beach_skater' ? 0xf7f9fc : 0x1a1c24,
    });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.58, 0.31), shirtMat);
    torso.position.y = 0.22;
    torso.castShadow = true;
    this._addOutline(torso);
    bodyPivot.add(torso);

    // Popped collar / lapel detail on torso top for overhead silhouette clarity
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.33), sleeveMat);
    collar.position.set(0, 0.51, -0.01);
    bodyPivot.add(collar);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skinMat);
    head.position.y = 0.72;
    head.castShadow = true;
    this._addOutline(head);
    bodyPivot.add(head);

    // Sculpted hair cap + rounded top crown
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.37), hairMat);
    hair.position.set(0, 0.88, -0.02);
    bodyPivot.add(hair);

    const hairCrownGeo = new THREE.SphereGeometry(0.18, 8, 6);
    hairCrownGeo.scale(1.0, 0.52, 1.05);
    const hairCrown = new THREE.Mesh(hairCrownGeo, hairMat);
    hairCrown.position.set(0, 0.93, -0.01);
    bodyPivot.add(hairCrown);

    if (palette.hat) {
      const hatMat = new THREE.MeshLambertMaterial({ color: palette.hat });
      const hat = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.10, 0.44), hatMat);
      hat.position.set(0, 0.90, 0.03);
      this._addOutline(hat);
      bodyPivot.add(hat);
    }

    if (palette.shades) {
      const shades = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.085, 0.07),
        new THREE.MeshBasicMaterial({ color: 0x0a0d16 })
      );
      shades.position.set(0, 0.74, 0.16);
      bodyPivot.add(shades);
    }

    // Articulated Arms with Rounded Shoulder Caps
    const shoulderCapGeo = new THREE.SphereGeometry(0.105, 8, 8);
    const armGeo = new THREE.BoxGeometry(0.145, 0.46, 0.145);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.34, 0.44, 0);
    const lShoulder = new THREE.Mesh(shoulderCapGeo, sleeveMat);
    lShoulder.position.set(0, 0.02, 0);
    leftArm.add(lShoulder);
    const lArmMesh = new THREE.Mesh(armGeo, skinMat);
    lArmMesh.position.y = -0.20;
    this._addOutline(lArmMesh);
    leftArm.add(lArmMesh);
    bodyPivot.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.34, 0.44, 0);
    const rShoulder = new THREE.Mesh(shoulderCapGeo, sleeveMat);
    rShoulder.position.set(0, 0.02, 0);
    rightArm.add(rShoulder);
    const rArmMesh = new THREE.Mesh(armGeo, skinMat);
    rArmMesh.position.y = -0.20;
    this._addOutline(rArmMesh);
    rightArm.add(rArmMesh);
    bodyPivot.add(rightArm);

    // Optional NPC weapon mesh in right hand (held at side when peaceful, raised when hostile)
    let gunMesh = null;
    if (cfg.weaponId || cfg.faction !== 'civilian') {
      gunMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.12, 0.38),
        new THREE.MeshLambertMaterial({ color: 0x222630 })
      );
      gunMesh.position.set(0, -0.38, 0.16);
      this._addOutline(gunMesh);
      rightArm.add(gunMesh);
      rightArm.rotation.x = cfg.isHostile ? -Math.PI * 0.4 : 0;
    }

    // Articulated Legs + Shoes / Roller-Skates
    const legGeo = new THREE.BoxGeometry(0.18, 0.54, 0.18);
    const shoeGeo = new THREE.BoxGeometry(0.19, 0.12, 0.27);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.13, -0.10, 0);
    const lLegMesh = new THREE.Mesh(legGeo, pantsMat);
    lLegMesh.position.y = -0.27;
    this._addOutline(lLegMesh);
    leftLeg.add(lLegMesh);
    const lShoeMesh = new THREE.Mesh(shoeGeo, shoeMat);
    lShoeMesh.position.set(0, -0.56, 0.04);
    leftLeg.add(lShoeMesh);
    bodyPivot.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.13, -0.10, 0);
    const rLegMesh = new THREE.Mesh(legGeo, pantsMat);
    rLegMesh.position.y = -0.27;
    this._addOutline(rLegMesh);
    rightLeg.add(rLegMesh);
    const rShoeMesh = new THREE.Mesh(shoeGeo, shoeMat);
    rShoeMesh.position.set(0, -0.56, 0.04);
    rightLeg.add(rShoeMesh);
    bodyPivot.add(rightLeg);

    const y = this._sampleGroundY(cfg.x, cfg.z);
    group.position.set(cfg.x, y, cfg.z);
    this.npcGroup.add(group);

    const isInitiallyHostile = Boolean(cfg.isHostile);
    const npc = {
      id,
      type: cfg.type || 'civilian',
      faction: cfg.faction || 'civilian',
      x: cfg.x,
      y,
      z: cfg.z,
      spawnX: cfg.x,
      spawnZ: cfg.z,
      patrolA: { x: cfg.x, z: cfg.z - 12 },
      patrolB: { x: cfg.x, z: cfg.z + 12 },
      vx: 0,
      vz: 0,
      vy: 0,
      rotationY: Math.random() * Math.PI * 2,
      health: cfg.faction && cfg.faction !== 'civilian' ? 85 : 55,
      maxHealth: cfg.faction && cfg.faction !== 'civilian' ? 85 : 55,
      isHostile: isInitiallyHostile,
      provoked: Boolean(cfg.provoked || isInitiallyHostile),
      _injuredHeatApplied: false,
      isDead: false,
      isPanicking: false,
      panicTimer: 0,
      respawnTimer: 0,
      speechCooldown: 0,
      activeSpeech: null,
      isRampageTarget: Boolean(cfg.isRampageTarget),
      weaponId: cfg.weaponId || (cfg.faction && cfg.faction !== 'civilian' ? 'mac10' : null),
      shootCooldown: 0.8 + Math.random() * 1.2,
      walkPhase: Math.random() * Math.PI * 2,
      wanderTimer: 1.5 + Math.random() * 3.0,
      hitFlash: 0,
      mesh: group,
      hostileRing,
      gunMesh,
      bodyPivot,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      torso,
    };

    this.npcs.push(npc);
    return npc;
  }

  get player() {
    return this;
  }

  _isWater(x, z) {
    return Boolean(
      this.world && typeof this.world.isWaterAt === 'function' && this.world.isWaterAt(x, z)
    );
  }

  _triggerPedestrianSpeech(npc, category = 'chat', preferredClipId = null) {
    if (!npc || npc.isDead) return null;
    const bank = this.pedDialogueBank[category] || this.pedDialogueBank.chat;
    if (!bank || bank.length === 0) return null;

    let entry = null;
    if (preferredClipId) {
      entry = bank.find((item) => item.id === preferredClipId) || null;
    }
    if (!entry) {
      if (category === 'chat') {
        entry = bank[this.chatRotateIdx % bank.length];
        this.chatRotateIdx++;
      } else if (category === 'panic') {
        entry = bank[this.panicRotateIdx % bank.length];
        this.panicRotateIdx++;
      } else {
        entry = bank[this.insultRotateIdx % bank.length];
        this.insultRotateIdx++;
      }
    }

    npc.speechCooldown = category === 'chat' ? 18.0 : 12.0;
    npc.activeSpeech = {
      clipId: entry.id,
      text: entry.text,
      style: category,
      timer: 4.0,
    };

    if (typeof this.callbacks.onPlayVoice === 'function') {
      this.callbacks.onPlayVoice(entry.id);
    }
    const payload = {
      npc,
      x: npc.x,
      y: (npc.y || 0) + 2.15,
      z: npc.z,
      text: entry.text,
      style: category,
      clipId: entry.id,
    };
    if (typeof this.callbacks.onPedestrianSpeak === 'function') {
      this.callbacks.onPedestrianSpeak(payload);
    } else if (typeof this.callbacks.onPedestrianBubble === 'function') {
      this.callbacks.onPedestrianBubble(npc, entry.text, category);
    }
    return payload;
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  selectWeapon(weaponIdOrIndex) {
    if (typeof weaponIdOrIndex === 'number') {
      const idx = ((weaponIdOrIndex % this.weapons.length) + this.weapons.length) % this.weapons.length;
      this.currentWeaponIndex = idx;
    } else if (typeof weaponIdOrIndex === 'string') {
      const targetId = weaponIdOrIndex === 'chainsaw' ? 'stun_baton' : weaponIdOrIndex;
      const idx = this.weapons.findIndex((w) => w.id === targetId);
      if (idx !== -1) this.currentWeaponIndex = idx;
    }
    this._syncWeaponViewmodelVisibility();
    return this.weapons[this.currentWeaponIndex];
  }

  cycleWeapon(dir = 1) {
    const step = dir >= 0 ? 1 : -1;
    this.currentWeaponIndex =
      (this.currentWeaponIndex + step + this.weapons.length) % this.weapons.length;
    this._syncWeaponViewmodelVisibility();
    if (typeof this.callbacks.onPlaySFX === 'function') {
      this.callbacks.onPlaySFX('weapon_switch');
    }
    return this.weapons[this.currentWeaponIndex];
  }

  cycleThrowable() {
    this.currentThrowableIndex = (this.currentThrowableIndex + 1) % this.throwables.length;
    return this.getThrowableState();
  }

  selectThrowable(throwableId) {
    const idx = this.throwables.findIndex((t) => t.id === throwableId);
    if (idx !== -1) this.currentThrowableIndex = idx;
    return this.getThrowableState();
  }

  addAmmo(weaponId, amount = 50) {
    const targetId = weaponId === 'chainsaw' ? 'stun_baton' : weaponId;
    const w = this.weapons.find((item) => item.id === targetId);
    if (!w) return false;
    w.unlocked = true;
    if (!w.isInfinite) {
      w.reserve = Math.min(999, w.reserve + amount);
      if (w.clip <= 0) {
        const refill = Math.min(w.maxClip, w.reserve);
        w.clip += refill;
        w.reserve -= refill;
      }
    }
    return true;
  }

  addMolotovs(count = 6) {
    const m = this.throwables.find((t) => t.id === 'molotov');
    if (m) m.count = Math.min(99, m.count + count);
    return m ? m.count : 0;
  }

  addGrenades(count = 6) {
    const g = this.throwables.find((t) => t.id === 'grenade');
    if (g) g.count = Math.min(99, g.count + count);
    return g ? g.count : 0;
  }

  addCash(amount) {
    this.cash = Math.max(0, Math.round(this.cash + amount));
    if (typeof this.callbacks.onCashPickup === 'function' && amount > 0) {
      this.callbacks.onCashPickup(amount, this.cash);
    }
    return this.cash;
  }

  setCash(amount) {
    this.cash = Math.max(0, Math.round(amount));
    return this.cash;
  }

  healPlayer(healthAmount = 100, armorAmount = 0) {
    this.health = Math.min(this.maxHealth, this.health + healthAmount);
    this.armor = Math.min(this.maxArmor, this.armor + armorAmount);
  }

  damagePlayer(amount, source = 'enemy') {
    if (this.isRolling) return; // Invincible during 0.42s evasive combat roll
    let remaining = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, remaining * 0.65);
      this.armor = Math.max(0, this.armor - absorbed);
      remaining -= absorbed;
    }
    this.health = Math.max(0, this.health - remaining);
    this.playerHitFlash = 0.18;
    this.isCombat = true;
    this.combatTimer = 4.5;

    if (this.health <= 0) {
      // Respawn at Starfish Mansion or Ocean View Hotel with restored health
      this.health = this.maxHealth;
      this.armor = 50;
      if (typeof this.callbacks.onCallout === 'function') {
        this.callbacks.onCallout('PATCHED UP AT OCEAN VIEW', '-$250 MEDICAL BILL', '#ff2a85');
      }
      this.cash = Math.max(0, this.cash - 250);
    }
  }

  enterVehicle(vehicle) {
    if (!vehicle) return;
    this.inVehicle = true;
    this.currentVehicle = vehicle;
    this.isSwimming = false;
    this.isRolling = false;
    this.x = vehicle.x;
    this.z = vehicle.z;
    this.y = vehicle.y || 0;
    this.rotationY = vehicle.rotationY || 0;
    this.playerMesh.visible = Boolean(vehicle.isBoat || vehicle.type === 'pcj600');
  }

  exitVehicle() {
    if (!this.inVehicle || !this.currentVehicle) return;
    const v = this.currentVehicle;
    const exitOffset = 2.6;
    const exitX = v.x - Math.cos(v.rotationY || 0) * exitOffset;
    const exitZ = v.z + Math.sin(v.rotationY || 0) * exitOffset;

    this.inVehicle = false;
    this.currentVehicle = null;
    const worldRes = this._resolveCircleWorldCollision(exitX, exitZ, 0.55);
    const vehRes = this._resolveCharacterVehicleCollisions(worldRes.x, worldRes.z, 0.52);
    this.x = vehRes.x;
    this.z = vehRes.z;
    this.y = this._sampleGroundY(this.x, this.z);
    this.vx = 0;
    this.vz = 0;
    this.playerMesh.visible = true;
    this.playerMesh.scale.setScalar(1.25);
  }

  spawnCarjackedDriver(vehicle) {
    if (!vehicle) return null;
    const yaw = vehicle.rotationY || 0;
    const doorOffset = 2.2;
    const doorX = vehicle.x - Math.cos(yaw) * doorOffset;
    const doorZ = vehicle.z + Math.sin(yaw) * doorOffset;
    const worldRes = this._resolveCircleWorldCollision(doorX, doorZ, 0.48);
    const resolved = this._resolveCharacterVehicleCollisions(worldRes.x, worldRes.z, 0.48);

    // Reuse an existing far-away civilian or spawn a new startled driver if under cap
    let driver = null;
    if (this.npcs.length >= 48) {
      driver = this.npcs.find(
        (n) =>
          n.faction === 'civilian' &&
          !n.isRampageTarget &&
          Math.hypot(n.x - this.x, n.z - this.z) > 45.0
      );
    }

    if (driver) {
      driver.isDead = false;
      driver.health = driver.maxHealth;
      driver._injuredHeatApplied = false;
      driver.x = resolved.x;
      driver.z = resolved.z;
      driver.y = this._sampleGroundY(resolved.x, resolved.z);
      driver.bodyPivot.position.y = 0.82;
      driver.bodyPivot.rotation.x = 0;
    } else {
      driver = this._createNPC({
        type: vehicle.isPolice ? 'acpd' : 'miami_businessman',
        faction: vehicle.isPolice ? 'acpd' : 'civilian',
        x: resolved.x,
        z: resolved.z,
        isHostile: Boolean(vehicle.isPolice),
        provoked: Boolean(vehicle.isPolice),
        weaponId: vehicle.isPolice ? 'revolver' : null,
      });
    }

    // Brief stumble/knockback away from the car door and panic flee
    const awayX = -Math.cos(yaw);
    const awayZ = Math.sin(yaw);
    driver.vx = awayX * 5.5;
    driver.vz = awayZ * 5.5;
    driver.rotationY = Math.atan2(awayX, awayZ);
    if (!driver.isHostile) {
      driver.isPanicking = true;
      driver.panicTimer = 8.0;
    }
    driver.mesh.position.set(driver.x, driver.y, driver.z);
    driver.mesh.rotation.y = driver.rotationY;

    // Trigger carjacked driver insult voice & comic speech bubble
    this._triggerPedestrianSpeech(driver, 'insult');
    return driver;
  }

  getPlayerState() {
    const activeWeapon = this.weapons[this.currentWeaponIndex];
    const activeThrowable = this.throwables[this.currentThrowableIndex];

    this.playerPosition.set(this.x, this.y, this.z);
    this.playerVelocity.set(this.vx, 0, this.vz);
    const speed = Math.hypot(this.vx, this.vz);
    const driftFactor =
      this.inVehicle && this.currentVehicle ? this.currentVehicle.driftFactor || 0 : 0;

    return {
      x: this.x,
      y: this.y,
      z: this.z,
      position: this.playerPosition,
      vx: this.vx,
      vz: this.vz,
      velocity: this.playerVelocity,
      speed,
      rotationY: this.rotationY,
      driftFactor,
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      armor: Math.round(this.armor),
      maxArmor: this.maxArmor,
      cash: this.cash,
      inVehicle: this.inVehicle,
      currentVehicle: this.currentVehicle,
      isSwimming: this.isSwimming,
      isRolling: this.isRolling,
      isSprinting: this.isSprinting,
      isCombat: this.isCombat || this.combatTimer > 0,
      weapon: {
        id: activeWeapon.id,
        name: activeWeapon.name,
        clip: activeWeapon.clip,
        maxClip: activeWeapon.maxClip,
        reserve: activeWeapon.reserve,
        isInfinite: activeWeapon.isInfinite,
        iconType: activeWeapon.iconType,
        unlocked: activeWeapon.unlocked,
        ammoText: activeWeapon.isInfinite
          ? '∞'
          : `${activeWeapon.reserve}-${activeWeapon.clip}`,
      },
      throwable: {
        id: activeThrowable.id,
        name: activeThrowable.name,
        count: activeThrowable.count,
        iconType: activeThrowable.iconType,
      },
      lockedTarget: this.lockedTarget
        ? {
            id: this.lockedTarget.id,
            type: this.lockedTarget.type,
            faction: this.lockedTarget.faction || 'hostile',
            x: this.lockedTarget.x,
            y: this.lockedTarget.y || 0,
            z: this.lockedTarget.z,
            health: this.lockedTarget.health,
            maxHealth: this.lockedTarget.maxHealth || 100,
            isVehicle: Boolean(this.lockedTarget.isVehicle),
          }
        : null,
    };
  }

  getWeaponsList() {
    return this.weapons.map((w, idx) => ({
      index: idx,
      id: w.id,
      name: w.name,
      clip: w.clip,
      maxClip: w.maxClip,
      reserve: w.reserve,
      isInfinite: w.isInfinite,
      iconType: w.iconType,
      unlocked: w.unlocked,
      isCurrent: idx === this.currentWeaponIndex,
      ammoText: w.isInfinite ? '∞' : `${w.reserve}-${w.clip}`,
    }));
  }

  getThrowableState() {
    const t = this.throwables[this.currentThrowableIndex];
    return {
      id: t.id,
      name: t.name,
      count: t.count,
      iconType: t.iconType,
      molotovCount: this.throwables[0].count,
      grenadeCount: this.throwables[1].count,
    };
  }

  getNPCs() {
    return this.npcs;
  }

  spawnRampageWave(faction = 'cartel', count = 12, aroundX = null, aroundZ = null) {
    const cx = aroundX !== null ? aroundX : this.x;
    const cz = aroundZ !== null ? aroundZ : this.z;
    const spawned = [];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const dist = 9.5 + (i % 3) * 3.8;
      let sx = cx + Math.cos(angle) * dist;
      let sz = cz + Math.sin(angle) * dist;
      const resolved = this._resolveCircleWorldCollision(sx, sz, 0.55);
      sx = resolved.x;
      sz = resolved.z;

      const npc = this._createNPC({
        type: faction,
        faction,
        x: sx,
        z: sz,
        isHostile: true,
        provoked: true,
        isRampageTarget: true,
        weaponId: i % 2 === 0 ? 'mac10' : 'shotgun',
      });
      spawned.push(npc);
    }

    if (typeof this.callbacks.onPlayVoice === 'function') {
      this.callbacks.onPlayVoice('cartel_taunt');
    }
    return spawned;
  }

  // ============================================================================
  // SECONDARY THROWABLES: MOLOTOV COCKTAIL & FRAG GRENADE PARABOLIC PHYSICS
  // ============================================================================

  throwSecondary(targetPoint = null) {
    if (this.throwCooldown > 0) return false;
    const throwable = this.throwables[this.currentThrowableIndex];
    if (!throwable || throwable.count <= 0) return false;

    throwable.count = Math.max(0, throwable.count - 1);
    this.throwCooldown = 0.65;
    this.isCombat = true;
    this.combatTimer = 5.0;

    // Determine target landing coordinates
    let tx = this.x + Math.sin(this.aimRotationY) * 11.5;
    let tz = this.z + Math.cos(this.aimRotationY) * 11.5;
    if (targetPoint && Number.isFinite(targetPoint.x) && Number.isFinite(targetPoint.z)) {
      tx = targetPoint.x;
      tz = targetPoint.z;
    } else if (this.lockedTarget) {
      tx = this.lockedTarget.x;
      tz = this.lockedTarget.z;
    } else if (this.hasAimPoint) {
      const dx = this.aimWorldPoint.x - this.x;
      const dz = this.aimWorldPoint.z - this.z;
      const d = Math.min(16.0, Math.max(4.0, Math.hypot(dx, dz)));
      const ang = Math.atan2(dx, dz);
      tx = this.x + Math.sin(ang) * d;
      tz = this.z + Math.cos(ang) * d;
    }

    // Build 3D lobbed projectile mesh
    const projGroup = new THREE.Group();
    if (throwable.id === 'molotov') {
      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.14, 0.42, 8),
        new THREE.MeshLambertMaterial({ color: 0xd96b16 })
      );
      const wick = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff5500 })
      );
      wick.position.y = 0.26;
      this._addOutline(bottle);
      projGroup.add(bottle, wick);
    } else {
      const gren = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.18, 0),
        new THREE.MeshLambertMaterial({ color: 0x3b5928 })
      );
      const fuse = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2222 })
      );
      fuse.position.y = 0.18;
      this._addOutline(gren);
      projGroup.add(gren, fuse);
    }

    const startY = this.y + 1.45;
    projGroup.position.set(this.x, startY, this.z);
    this.fxGroup.add(projGroup);

    const flightDuration = 0.68;
    this.lobbedProjectiles.push({
      type: throwable.id,
      mesh: projGroup,
      startX: this.x,
      startY,
      startZ: this.z,
      targetX: tx,
      targetY: this._sampleGroundY(tx, tz) + 0.08,
      targetZ: tz,
      elapsed: 0,
      duration: flightDuration,
      arcHeight: 4.4,
    });

    if (typeof this.callbacks.onPlaySFX === 'function') {
      this.callbacks.onPlaySFX('throw');
    }
    return true;
  }

  _detonateThrowable(proj) {
    const { targetX: x, targetY: y, targetZ: z, type } = proj;
    if (type === 'molotov') {
      // Spawn Expanding Neon-Orange Ground Fire Grid (4x4 comic flame tiles burning for 6.5s)
      this._spawnLocalFireGrid(x, z, 6.5);
      if (typeof this.callbacks.onFireGrid === 'function') {
        this.callbacks.onFireGrid(x, z, 6.5);
      }
      if (typeof this.callbacks.onPlaySFX === 'function') {
        this.callbacks.onPlaySFX('molotov_shatter');
      }
      // Immediate splash ignition damage from player
      this.applyExplosionDamageAt(x, z, 4.8, 65, true, true);
    } else {
      // Frag Grenade explosion from player
      if (typeof this.callbacks.onExplosion === 'function') {
        this.callbacks.onExplosion(x, y, z, 1.25);
      }
      if (typeof this.callbacks.onPlaySFX === 'function') {
        this.callbacks.onPlaySFX('explosion');
      }
      if (this.world && typeof this.world.addCameraShake === 'function') {
        this.world.addCameraShake(0.65);
      }
      this.applyExplosionDamageAt(x, z, 7.5, 180, false, true);
    }
  }

  _spawnLocalFireGrid(cx, cz, duration = 6.5) {
    const gridGroup = new THREE.Group();
    const gy = this._sampleGroundY(cx, cz) + 0.04;
    gridGroup.position.set(cx, gy, cz);

    // Glowing base ember mat
    const baseGeo = new THREE.CircleGeometry(3.8, 20);
    baseGeo.rotateX(-Math.PI / 2);
    const baseMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const baseDisc = new THREE.Mesh(baseGeo, baseMat);
    gridGroup.add(baseDisc);

    // 4x4 Neon-Orange & Yellow Comic Flame Tiles
    const tiles = [];
    const coneGeo = new THREE.ConeGeometry(0.38, 1.25, 6);
    coneGeo.translate(0, 0.62, 0);

    for (let gx = -1.5; gx <= 1.5; gx += 1.0) {
      for (let gz = -1.5; gz <= 1.5; gz += 1.0) {
        const isInner = Math.abs(gx) < 1 && Math.abs(gz) < 1;
        const mat = new THREE.MeshBasicMaterial({
          color: isInner ? 0xffdd22 : 0xff5500,
          transparent: true,
          opacity: 0.9,
        });
        const flame = new THREE.Mesh(coneGeo, mat);
        flame.position.set(
          gx * 1.15 + (Math.random() - 0.5) * 0.25,
          0,
          gz * 1.15 + (Math.random() - 0.5) * 0.25
        );
        this._addOutline(flame);
        gridGroup.add(flame);
        tiles.push({ mesh: flame, phase: Math.random() * Math.PI * 2 });
      }
    }

    this.fxGroup.add(gridGroup);
    this.localFireGrids.push({
      x: cx,
      z: cz,
      radius: 4.2,
      remaining: duration,
      maxDuration: duration,
      group: gridGroup,
      baseDisc,
      tiles,
    });
  }

  // ============================================================================
  // PRIMARY WEAPON FIRING, MELEE CLEAVE, FLAMETHROWER, RPG & DRIVE-BY SHOOTING
  // ============================================================================

  triggerShoot(targetOverride = null) {
    if (this.fireCooldown > 0 || this.isRolling || this.isSwimming) return false;

    // If inside a vehicle, perform Drive-By Shooting with MAC-10 (or current drive-by weapon)
    let weapon = this.weapons[this.currentWeaponIndex];
    if (this.inVehicle) {
      if (!weapon.canDriveBy) {
        const macIdx = this.weapons.findIndex((w) => w.id === 'mac10');
        if (macIdx !== -1) {
          this.currentWeaponIndex = macIdx;
          weapon = this.weapons[macIdx];
        }
      }
    }

    // Check ammo & auto-reload from reserve
    if (!weapon.isInfinite) {
      if (weapon.clip <= 0) {
        if (weapon.reserve > 0) {
          const loadCount = Math.min(weapon.maxClip, weapon.reserve);
          weapon.clip += loadCount;
          weapon.reserve -= loadCount;
          this.fireCooldown = 0.45;
          if (typeof this.callbacks.onPlaySFX === 'function') {
            this.callbacks.onPlaySFX('reload');
          }
          return false;
        }
        return false;
      }
      weapon.clip--;
    }

    this.fireCooldown = weapon.fireRate;
    this.isCombat = true;
    this.combatTimer = 5.0;

    // Determine aim direction
    let aimAngle = this.aimRotationY;
    let targetEntity = targetOverride || this.lockedTarget;
    if (targetEntity) {
      aimAngle = Math.atan2(targetEntity.x - this.x, targetEntity.z - this.z);
      this.aimRotationY = aimAngle;
      if (!this.inVehicle) this.rotationY = aimAngle;
    }

    // Trigger Civilian Panic & nearby gang provocation within 20m
    this._triggerPanicAround(this.x, this.z, weapon.isMelee ? 9.0 : 20.0);

    // 1. MELEE WEAPONS (Fists, Katana, Stun Baton)
    if (weapon.isMelee) {
      return this._executeMeleeAttack(weapon, aimAngle);
    }

    // 2. FLAMETHROWER (Stream of Expanding Neon-Orange Fire Spheres)
    if (weapon.id === 'flamethrower') {
      return this._executeFlamethrowerStream(weapon, aimAngle);
    }

    // 3. RPG-7 ROCKET LAUNCHER (3D Rocket Projectile with Smoke Trail)
    if (weapon.id === 'rpg') {
      return this._executeRPGLaunch(weapon, aimAngle, targetEntity);
    }

    // 4. BALLISTIC FIREARMS (Colt Python Revolver, Sawed-Off Shotgun, MAC-10, M16A1)
    return this._executeBallisticShot(weapon, aimAngle, targetEntity);
  }

  _executeMeleeAttack(weapon, aimAngle) {
    this.meleeSwingTimer = 0.24;
    this.meleeComboStep = (this.meleeComboStep + 1) % 3;

    // Show sweeping neon slash arc for Katana & Neon Shock Baton
    if (this.slashArcMesh) {
      this.slashArcMesh.material.color.setHex(
        weapon.id === 'katana' ? 0x00f0ff : weapon.id === 'stun_baton' ? 0x00f0ff : 0xffffff
      );
      this.slashArcMesh.material.opacity = 0.88;
      this.slashArcMesh.rotation.z = this.meleeComboStep % 2 === 0 ? 0.15 : -0.15;
    }

    if (typeof this.callbacks.onPlaySFX === 'function') {
      this.callbacks.onPlaySFX(weapon.id);
    }

    // Cleave all NPCs and vehicles within melee arc
    const dirX = Math.sin(aimAngle);
    const dirZ = Math.cos(aimAngle);

    for (const npc of this.npcs) {
      if (npc.isDead) continue;
      const dx = npc.x - this.x;
      const dz = npc.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= weapon.range) {
        const dot = (dx * dirX + dz * dirZ) / Math.max(0.001, dist);
        if (dot > 0.25 || dist < 1.35) {
          this._damageNPC(npc, weapon.damage, dirX * weapon.knockback, dirZ * weapon.knockback, weapon, true);
        }
      }
    }

    // Also check nearby vehicles
    const vehicles = this._getActiveVehicles();
    for (const v of vehicles) {
      if (v === this.currentVehicle || v.isWrecked) continue;
      const dist = Math.hypot(v.x - this.x, v.z - this.z);
      if (dist <= weapon.range + 1.4) {
        this._damageVehicleTarget(v, weapon.damage * 0.45, true);
      }
    }

    return true;
  }

  _executeFlamethrowerStream(weapon, aimAngle) {
    const startX = this.x + Math.sin(aimAngle) * 1.1;
    const startY = this.y + 1.15;
    const startZ = this.z + Math.cos(aimAngle) * 1.1;

    const spreadAngle = aimAngle + (Math.random() - 0.5) * weapon.spread;
    const speed = 18.5;

    const fireMesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({
        color: Math.random() > 0.4 ? 0xff6600 : 0xffdd22,
        transparent: true,
        opacity: 0.92,
      })
    );
    fireMesh.position.set(startX, startY, startZ);
    this.fxGroup.add(fireMesh);

    this.flameParticles.push({
      mesh: fireMesh,
      x: startX,
      y: startY,
      z: startZ,
      vx: Math.sin(spreadAngle) * speed,
      vz: Math.cos(spreadAngle) * speed,
      age: 0,
      maxAge: 0.65,
      damage: weapon.damage,
      weapon,
    });

    if (typeof this.callbacks.onPlaySFX === 'function') {
      this.callbacks.onPlaySFX('flamethrower');
    }
    return true;
  }

  _executeRPGLaunch(weapon, aimAngle, targetEntity) {
    const startX = this.x + Math.sin(aimAngle) * 1.25;
    const startY = this.y + 1.25;
    const startZ = this.z + Math.cos(aimAngle) * 1.25;

    const rocketGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.65, 8),
      new THREE.MeshLambertMaterial({ color: 0x3b4d2e })
    );
    body.rotation.x = Math.PI / 2;
    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.45, 8),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    );
    plume.rotation.x = -Math.PI / 2;
    plume.position.z = -0.45;
    this._addOutline(body);
    rocketGroup.add(body, plume);

    rocketGroup.position.set(startX, startY, startZ);
    rocketGroup.rotation.y = aimAngle;
    this.fxGroup.add(rocketGroup);

    const speed = 32.0;
    this.rockets.push({
      mesh: rocketGroup,
      x: startX,
      y: startY,
      z: startZ,
      vx: Math.sin(aimAngle) * speed,
      vz: Math.cos(aimAngle) * speed,
      age: 0,
      maxAge: 1.4,
      weapon,
    });

    if (typeof this.callbacks.onPlaySFX === 'function') {
      this.callbacks.onPlaySFX('rpg_fire');
    }
    if (this.world && typeof this.world.addCameraShake === 'function') {
      this.world.addCameraShake(0.28);
    }
    return true;
  }

  _executeBallisticShot(weapon, aimAngle, targetEntity) {
    // Muzzle origin (from car window during Drive-By, or from player's right hand gun barrel)
    let muzzleX = this.x + Math.sin(aimAngle) * 0.95 + Math.cos(aimAngle) * 0.28;
    let muzzleY = this.y + (this.inVehicle ? 1.05 : 1.18);
    let muzzleZ = this.z + Math.cos(aimAngle) * 0.95 - Math.sin(aimAngle) * 0.28;

    if (typeof this.callbacks.onPlaySFX === 'function') {
      this.callbacks.onPlaySFX(weapon.id);
    }

    for (let p = 0; p < weapon.pellets; p++) {
      const pelletSpread = (Math.random() - 0.5) * weapon.spread;
      const shotAngle = aimAngle + pelletSpread;
      const dirX = Math.sin(shotAngle);
      const dirZ = Math.cos(shotAngle);

      let hitDist = weapon.range;
      let hitNPC = null;
      let hitVehicle = null;

      // 1. Check locked target first if single-pellet or close to shot ray
      if (targetEntity && p === 0 && Math.random() < 0.88) {
        const tdx = targetEntity.x - muzzleX;
        const tdz = targetEntity.z - muzzleZ;
        const tDist = Math.hypot(tdx, tdz);
        if (tDist <= weapon.range + 2.0) {
          hitDist = tDist;
          if (targetEntity.isVehicle) {
            hitVehicle = targetEntity.vehicleRef;
          } else {
            hitNPC = targetEntity.npcRef;
          }
        }
      }

      // 2. Ray-circle check against all live NPCs
      if (!hitNPC && !hitVehicle) {
        for (const npc of this.npcs) {
          if (npc.isDead) continue;
          const toX = npc.x - muzzleX;
          const toZ = npc.z - muzzleZ;
          const proj = toX * dirX + toZ * dirZ;
          if (proj > 0 && proj < hitDist) {
            const perpSq = toX * toX + toZ * toZ - proj * proj;
            if (perpSq <= 0.85 * 0.85) {
              hitDist = proj;
              hitNPC = npc;
              hitVehicle = null;
            }
          }
        }

        // 3. Ray-circle check against vehicles
        const vehicles = this._getActiveVehicles();
        for (const v of vehicles) {
          if (v === this.currentVehicle || v.isWrecked) continue;
          const toX = v.x - muzzleX;
          const toZ = v.z - muzzleZ;
          const proj = toX * dirX + toZ * toZ > 0 ? toX * dirX + toZ * dirZ : -1;
          if (proj > 0 && proj < hitDist) {
            const perpSq = toX * toX + toZ * toZ - proj * proj;
            if (perpSq <= 2.1 * 2.1) {
              hitDist = proj;
              hitVehicle = v;
              hitNPC = null;
            }
          }
        }
      }

      const endX = muzzleX + dirX * hitDist;
      const endY = muzzleY - 0.08;
      const endZ = muzzleZ + dirZ * hitDist;

      // Spawn bright yellow-orange tracer beam & star muzzle flash (matching Grand Theft Argon screenshot 2!)
      this._spawnTracerAndMuzzleFlash(
        muzzleX,
        muzzleY,
        muzzleZ,
        endX,
        endY,
        endZ,
        weapon.id === 'revolver' ? 0xffee55 : 0xffaa11
      );

      if (hitNPC) {
        this._damageNPC(
          hitNPC,
          weapon.damage,
          dirX * weapon.knockback,
          dirZ * weapon.knockback,
          weapon,
          true
        );
      } else if (hitVehicle) {
        this._damageVehicleTarget(hitVehicle, weapon.damage, true);
      }
    }

    return true;
  }

  // ============================================================================
  // DAMAGE, EXPLOSION & KNOCKBACK HANDLERS
  // ============================================================================

  _damageNPC(npc, amount, knockX = 0, knockZ = 0, weapon = null, fromPlayer = true) {
    if (!npc || npc.isDead) return;
    npc.health -= amount;
    npc.hitFlash = 0.16;

    if (fromPlayer) {
      // Provoke gang/police faction when attacked by player
      if (npc.faction !== 'civilian') {
        npc.isHostile = true;
        npc.provoked = true;
        if (npc.hostileRing) npc.hostileRing.visible = true;
        if (npc.rightArm) npc.rightArm.rotation.x = -Math.PI * 0.4;
        // Alert nearby same-faction gang members within 20m
        for (const ally of this.npcs) {
          if (!ally.isDead && ally.faction === npc.faction && Math.hypot(ally.x - npc.x, ally.z - npc.z) <= 20.0) {
            ally.isHostile = true;
            ally.provoked = true;
            if (ally.hostileRing) ally.hostileRing.visible = true;
          }
        }
      } else {
        npc.isPanicking = true;
        npc.panicTimer = 8.0;
        if (npc.health > 0 && this.insultVoiceCooldown <= 0) {
          this.insultVoiceCooldown = 8.0;
          this._triggerPedestrianSpeech(npc, 'insult');
        }
      }
    } else if (npc.faction === 'civilian') {
      npc.isPanicking = true;
      npc.panicTimer = 6.0;
    }

    this._spawnLocalBloodDecal(npc.x, npc.z);

    if (npc.health <= 0) {
      npc.health = 0;
      npc.isDead = true;
      npc.respawnTimer = 11.0;
      npc.vx = knockX;
      npc.vz = knockZ;
      npc.vy = 4.2;
      if (npc.hostileRing) npc.hostileRing.visible = false;

      // Spawn rotating Green Neon Cash Bundle (+$150..$350) or Weapon Pickup
      this._spawnLootPickup(npc.x, npc.z, npc.faction);

      // Only attribute Wanted heat and kill callbacks when damaged by the player
      if (fromPlayer) {
        if (typeof this.callbacks.onKillNPC === 'function') {
          this.callbacks.onKillNPC(npc, weapon || this.weapons[this.currentWeaponIndex]);
        } else if (
          this.vehicleSystem &&
          typeof this.vehicleSystem.addWantedHeat === 'function'
        ) {
          this.vehicleSystem.addWantedHeat(npc.faction === 'acpd' ? 100 : 45);
        }
      }

      if (this.lockedTarget && this.lockedTarget.id === npc.id) {
        this.lockedTarget = null;
      }
    } else {
      npc.x += knockX * 0.06;
      npc.z += knockZ * 0.06;
      // Add balanced injury heat (18 for civilian/gang, 100 for attacking a ACPD officer) once per NPC
      if (
        fromPlayer &&
        !npc._injuredHeatApplied &&
        this.vehicleSystem &&
        typeof this.vehicleSystem.addWantedHeat === 'function'
      ) {
        npc._injuredHeatApplied = true;
        this.vehicleSystem.addWantedHeat(npc.faction === 'acpd' ? 100 : 18);
      }
    }
  }

  _damageVehicleTarget(vehicle, amount, fromPlayer = true) {
    if (!vehicle) return;
    if (this.vehicleSystem && typeof this.vehicleSystem.damageVehicle === 'function') {
      this.vehicleSystem.damageVehicle(vehicle, amount, fromPlayer ? 'player' : 'world');
    } else if (typeof vehicle.health === 'number') {
      vehicle.health = Math.max(0, vehicle.health - amount);
    }
  }

  applyExplosionDamageAt(cx, cz, radius = 7.5, maxDamage = 180, isFire = false, fromPlayer = false) {
    for (const npc of this.npcs) {
      if (npc.isDead) continue;
      const dx = npc.x - cx;
      const dz = npc.z - cz;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius) {
        const falloff = 1 - (dist / radius) * 0.65;
        const nx = dist > 0.01 ? dx / dist : 1;
        const nz = dist > 0.01 ? dz / dist : 0;
        this._damageNPC(
          npc,
          maxDamage * falloff,
          nx * (isFire ? 4 : 14),
          nz * (isFire ? 4 : 14),
          { id: isFire ? 'molotov' : 'rpg' },
          fromPlayer
        );
      }
    }

    const vehicles = this._getActiveVehicles();
    for (const v of vehicles) {
      if (v.isWrecked) continue;
      const dist = Math.hypot(v.x - cx, v.z - cz);
      if (dist <= radius + 1.5) {
        const falloff = Math.max(0.25, 1 - (dist / (radius + 1.5)) * 0.65);
        this._damageVehicleTarget(v, maxDamage * falloff, fromPlayer);
      }
    }
  }

  _spawnLootPickup(x, z, faction = 'civilian') {
    const gy = this._sampleGroundY(x, z) + 0.28;
    const isAmmoDrop = faction !== 'civilian' && Math.random() < 0.35;

    const group = new THREE.Group();
    group.position.set(x, gy, z);

    // Glowing ground ring (rotated into XZ plane, scaled via scale.set(r, 1, r))
    const ringGeo = new THREE.RingGeometry(0.42, 0.56, 18);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: isAmmoDrop ? 0x00f0ff : 0x00ff66,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.24;
    group.add(ring);

    if (isAmmoDrop) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.28, 0.30),
        new THREE.MeshLambertMaterial({ color: 0x00d8ff })
      );
      this._addOutline(box);
      group.add(box);
    } else {
      // Iconic Green Neon Cash Bundle wrapped in a gold strap
      const bills = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.16, 0.26),
        new THREE.MeshBasicMaterial({ color: 0x00e65b })
      );
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.17, 0.28),
        new THREE.MeshBasicMaterial({ color: 0xffd700 })
      );
      this._addOutline(bills);
      group.add(bills, band);
    }

    this.pickupGroup.add(group);
    this.pickups.push({
      type: isAmmoDrop ? 'ammo' : 'cash',
      amount: isAmmoDrop ? 60 : faction === 'cartel' ? 350 : 150,
      x,
      y: gy,
      z,
      age: 0,
      maxAge: 20.0,
      mesh: group,
    });
  }

  _triggerPanicAround(cx, cz, radius = 20.0) {
    let closestPanickedCiv = null;
    let closestDist = Infinity;

    for (const npc of this.npcs) {
      if (npc.isDead) continue;
      const dist = Math.hypot(npc.x - cx, npc.z - cz);
      if (dist <= radius) {
        if (npc.faction === 'civilian') {
          npc.isPanicking = true;
          npc.panicTimer = 7.5;
          if (dist < closestDist) {
            closestDist = dist;
            closestPanickedCiv = npc;
          }
        } else if (npc.faction !== 'acpd') {
          // Gang members within 20m of gunfire become provoked
          npc.isHostile = true;
          npc.provoked = true;
          if (npc.hostileRing) npc.hostileRing.visible = true;
        }
      }
    }

    if (closestPanickedCiv && this.panicVoiceCooldown <= 0) {
      this.panicVoiceCooldown = 12.0;
      this._triggerPedestrianSpeech(closestPanickedCiv, 'panic');
    }
  }

  // ============================================================================
  // DYNAMIC TWIN-STICK / MOUSE LOCK-ON TARGET EVALUATION
  // ============================================================================

  _updateLockOnTargeting(dt, inputState) {
    const candidates = [];
    const activeWeapon = this.weapons[this.currentWeaponIndex];
    const lockRadius = Math.max(12.0, Math.min(this.maxLockRange, activeWeapon.range + 4.0));

    // 1. Gather hostile / provoked / Rampage NPCs within range (never lock onto peaceful unprovoked NPCs!)
    for (const npc of this.npcs) {
      if (npc.isDead) continue;
      const dx = npc.x - this.x;
      const dz = npc.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= lockRadius) {
        const isPriority = Boolean(npc.isHostile || npc.provoked || npc.isRampageTarget);
        if (isPriority) {
          candidates.push({
            id: npc.id,
            type: npc.type,
            faction: npc.faction,
            x: npc.x,
            y: npc.y,
            z: npc.z,
            health: npc.health,
            maxHealth: npc.maxHealth,
            dist,
            priority: npc.isRampageTarget ? 3 : npc.isHostile ? 2 : 1,
            isVehicle: false,
            npcRef: npc,
          });
        }
      }
    }

    // 2. Gather pursuing ACPD police cars when player is Wanted
    const wantedStars =
      this.vehicleSystem && typeof this.vehicleSystem.getWantedHUDState === 'function'
        ? this.vehicleSystem.getWantedHUDState().stars || 0
        : 0;
    const vehicles = this._getActiveVehicles();
    for (const v of vehicles) {
      if (v === this.currentVehicle || v.isWrecked) continue;
      const dx = v.x - this.x;
      const dz = v.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= lockRadius && v.isPolice && wantedStars > 0) {
        candidates.push({
          id: v.id || `veh_${v.type}`,
          type: v.type,
          faction: 'acpd',
          x: v.x,
          y: v.y || 0,
          z: v.z,
          health: v.health || 100,
          maxHealth: v.maxHealth || 100,
          dist,
          priority: 2,
          isVehicle: true,
          vehicleRef: v,
        });
      }
    }

    if (candidates.length === 0) {
      this.lockedTarget = null;
      this.reticleGroup.visible = false;
      return;
    }

    // Sort by priority (highest first) then proximity + alignment with aim
    const aimDirX = Math.sin(this.aimRotationY);
    const aimDirZ = Math.cos(this.aimRotationY);
    candidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const dotA = ((a.x - this.x) * aimDirX + (a.z - this.z) * aimDirZ) / Math.max(0.1, a.dist);
      const dotB = ((b.x - this.x) * aimDirX + (b.z - this.z) * aimDirZ) / Math.max(0.1, b.dist);
      const scoreA = a.dist - dotA * 4.5;
      const scoreB = b.dist - dotB * 4.5;
      return scoreA - scoreB;
    });

    if (inputState && (inputState.cycleTarget || inputState.tabJustPressed)) {
      this.manualTargetIndex = (this.manualTargetIndex + 1) % candidates.length;
    }

    const chosenIdx = this.manualTargetIndex < candidates.length ? this.manualTargetIndex : 0;
    this.lockedTarget = candidates[chosenIdx];

    // Update Grand Theft Argon Segmented Lock-On Reticle transform & health color
    const t = this.lockedTarget;
    this.reticleGroup.visible = true;
    this.reticleGroup.position.set(t.x, (t.y || 0) + 0.04, t.z);

    // Rotate 4 corner brackets & pulse inner ring
    this.reticleBracketsGroup.rotation.y += dt * 2.6;
    const pulse = (t.isVehicle ? 1.85 : 1.0) * (1.0 + Math.sin(performance.now() * 0.012) * 0.08);
    this.reticleInnerRing.scale.set(pulse, 1.0, pulse);
    this.reticleBracketsGroup.scale.set(pulse, 1.0, pulse);
    this.reticleDiamond.rotation.y += dt * 4.0;
    this.reticleDiamond.position.y = (t.isVehicle ? 2.8 : 2.55) + Math.sin(performance.now() * 0.01) * 0.12;

    // Color shift: Neon Green (full) -> Amber Yellow (damaged) -> Crimson Red (critical)
    const hpRatio = Math.max(0, Math.min(1, t.health / Math.max(1, t.maxHealth)));
    if (hpRatio > 0.65) {
      this.reticleMat.color.setHex(0x00ff66); // Neon Green
    } else if (hpRatio > 0.30) {
      this.reticleMat.color.setHex(0xffbb00); // Amber Yellow
    } else {
      this.reticleMat.color.setHex(0xff1744); // Crimson Red
    }
  }

  // ============================================================================
  // MAIN FRAME UPDATE LOOP
  // ============================================================================

  update(dt, inputState = {}) {
    const clampedDt = Math.min(0.1, Math.max(0.001, dt || 0.016));

    // Cooldowns
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - clampedDt);
    if (this.throwCooldown > 0) this.throwCooldown = Math.max(0, this.throwCooldown - clampedDt);
    if (this.rollCooldown > 0) this.rollCooldown = Math.max(0, this.rollCooldown - clampedDt);
    if (this.voiceCooldown > 0) this.voiceCooldown = Math.max(0, this.voiceCooldown - clampedDt);
    if (this.ambientChatCooldown > 0) {
      this.ambientChatCooldown = Math.max(0, this.ambientChatCooldown - clampedDt);
    }
    if (this.panicVoiceCooldown > 0) {
      this.panicVoiceCooldown = Math.max(0, this.panicVoiceCooldown - clampedDt);
    }
    if (this.insultVoiceCooldown > 0) {
      this.insultVoiceCooldown = Math.max(0, this.insultVoiceCooldown - clampedDt);
    }
    if (this.combatTimer > 0) {
      this.combatTimer = Math.max(0, this.combatTimer - clampedDt);
      if (this.combatTimer <= 0) this.isCombat = false;
    }

    // Sync vehicle state if vehicleSystem updated player's vehicle state
    if (this.inVehicle && this.currentVehicle) {
      if (this.currentVehicle.isWrecked) {
        this.exitVehicle();
      } else {
        this.x = this.currentVehicle.x;
        this.z = this.currentVehicle.z;
        this.y = this.currentVehicle.y || 0;
        this.vx = this.currentVehicle.vx || 0;
        this.vz = this.currentVehicle.vz || 0;
        this.rotationY = this.currentVehicle.rotationY || 0;
        this.playerMesh.position.set(this.x, this.y + 0.35, this.z);
        this.playerMesh.rotation.y = this.rotationY;
      }
    } else {
      this._updateOnFootAndSwimmingMovement(clampedDt, inputState);
    }

    // Handle aim direction from mouse world point or twin-stick
    if (inputState && Number.isFinite(inputState.aimWorldX) && Number.isFinite(inputState.aimWorldZ)) {
      this.aimWorldPoint.set(inputState.aimWorldX, this.y, inputState.aimWorldZ);
      this.hasAimPoint = true;
      this.aimRotationY = Math.atan2(
        inputState.aimWorldX - this.x,
        inputState.aimWorldZ - this.z
      );
    } else if (
      inputState &&
      (Math.abs(inputState.aimDirX || 0) > 0.1 || Math.abs(inputState.aimDirZ || 0) > 0.1)
    ) {
      this.aimRotationY = Math.atan2(inputState.aimDirX, inputState.aimDirZ);
      this.hasAimPoint = false;
    } else if (!this.lockedTarget) {
      this.aimRotationY = this.rotationY;
    }

    // Update lock-on targeting reticle
    this._updateLockOnTargeting(clampedDt, inputState);

    // Handle weapon cycling & selection shortcuts from inputState
    if (inputState) {
      if (inputState.nextWeapon) this.cycleWeapon(1);
      if (inputState.prevWeapon) this.cycleWeapon(-1);
      if (typeof inputState.selectWeaponIndex === 'number') {
        this.selectWeapon(inputState.selectWeaponIndex);
      }
      if (inputState.cycleThrowable) this.cycleThrowable();
      if (inputState.throwSecondary || inputState.grenadePressed) {
        this.throwSecondary();
      }
      if (inputState.fire || inputState.shoot || inputState.mouseDown) {
        this.triggerShoot();
      }
    }

    // Update all NPCs, projectiles, fire grids, pickups, and FX pools
    this._updateNPCs(clampedDt);
    this._updateProjectilesAndFireGrids(clampedDt);
    this._updatePickups(clampedDt);
    this._updateFXPools(clampedDt);
  }

  _updateOnFootAndSwimmingMovement(dt, inputState) {
    // Parse WASD / Arrow / Stick input
    let moveX = Number(inputState.moveX || inputState.axisX || 0);
    let moveZ = Number(inputState.moveZ || inputState.axisY || 0);

    if (inputState.left || inputState.a) moveX -= 1;
    if (inputState.right || inputState.d) moveX += 1;
    if (inputState.up || inputState.w || inputState.forward) moveZ -= 1;
    if (inputState.down || inputState.s || inputState.backward) moveZ += 1;

    const mag = Math.hypot(moveX, moveZ);
    if (mag > 1.0) {
      moveX /= mag;
      moveZ /= mag;
    }

    // Check water state
    const inDeepWater = Boolean(this.world && typeof this.world.isWaterAt === 'function' && this.world.isWaterAt(this.x, this.z));
    this.isSwimming = inDeepWater;

    // Trigger Evasive Combat Roll / Dive on Spacebar when on foot
    const wantsRoll = Boolean(inputState.roll || inputState.spaceJustPressed || inputState.dodge);
    if (wantsRoll && !this.isRolling && !this.isSwimming && this.rollCooldown <= 0) {
      this.isRolling = true;
      this.rollTimer = this.rollDuration;
      this.rollCooldown = 0.72;
      if (mag > 0.1) {
        this.rollDirX = moveX;
        this.rollDirZ = moveZ;
      } else {
        this.rollDirX = Math.sin(this.rotationY);
        this.rollDirZ = Math.cos(this.rotationY);
      }
      this.rotationY = Math.atan2(this.rollDirX, this.rollDirZ);
      if (typeof this.callbacks.onPlaySFX === 'function') {
        this.callbacks.onPlaySFX('combat_roll');
      }
    }

    this.isSprinting = Boolean(inputState.sprint || inputState.shift) && mag > 0.1 && !this.isRolling;

    // Compute velocity
    if (this.isRolling) {
      this.rollTimer -= dt;
      const rollSpeed = 16.8;
      this.vx = this.rollDirX * rollSpeed;
      this.vz = this.rollDirZ * rollSpeed;
      if (this.rollTimer <= 0) {
        this.isRolling = false;
        this.bodyPivot.rotation.x = 0;
      }
    } else {
      const baseSpeed = this.isSwimming ? 6.8 : this.isSprinting ? 13.0 : 8.6;
      const targetVx = moveX * baseSpeed;
      const targetVz = moveZ * baseSpeed;
      const accel = Math.min(1.0, dt * 14.0);
      this.vx += (targetVx - this.vx) * accel;
      this.vz += (targetVz - this.vz) * accel;
    }

    // Apply displacement + Building & Palm Collider resolution
    const nextX = this.x + this.vx * dt;
    const nextZ = this.z + this.vz * dt;
    const resolved = this._resolveCircleWorldCollision(nextX, nextZ, 0.55);
    this.x = resolved.x;
    this.z = resolved.z;

    // Resolve Oriented Bounding Box (OBB) collisions against all active vehicles so player never walks through cars
    if (!this.isSwimming) {
      const vehRes = this._resolveCharacterVehicleCollisions(this.x, this.z, 0.52);
      this.x = vehRes.x;
      this.z = vehRes.z;
      if (vehRes.hitVehicle) {
        const vn = this.vx * vehRes.nx + this.vz * vehRes.nz;
        if (vn < 0) {
          this.vx -= vn * vehRes.nx;
          this.vz -= vn * vehRes.nz;
        }
      }

      // Resolve circle-vs-circle separation against all live NPCs (minDist = 0.88)
      const minPedDist = 0.88;
      for (let i = 0; i < this.npcs.length; i++) {
        const npc = this.npcs[i];
        if (!npc || npc.isDead) continue;
        const pdx = this.x - npc.x;
        const pdz = this.z - npc.z;
        const pDistSq = pdx * pdx + pdz * pdz;
        if (pDistSq < minPedDist * minPedDist && pDistSq > 0.0001) {
          const pDist = Math.sqrt(pDistSq);
          const overlap = minPedDist - pDist;
          const pnx = pdx / pDist;
          const pnz = pdz / pDist;
          this.x += pnx * overlap * 0.35;
          this.z += pnz * overlap * 0.35;
          npc.x -= pnx * overlap * 0.65;
          npc.z -= pnz * overlap * 0.65;
          npc.mesh.position.x = npc.x;
          npc.mesh.position.z = npc.z;
        }
      }
    }

    // Vertical height & swimming vs land pose
    if (this.isSwimming) {
      this.y = -0.35;
      this.swimCycle += dt * (mag > 0.1 ? 9.5 : 4.0);
      this.swimRippleTimer -= dt;
      if (this.swimRippleTimer <= 0) {
        this.swimRippleTimer = mag > 0.1 ? 0.22 : 0.48;
        this._spawnWaterRipple(this.x, this.z);
        if (this.world && typeof this.world.addWaterWake === 'function') {
          this.world.addWaterWake(this.x, this.z, this.vx, this.vz);
        }
      }

      // Breaststroke / Freestyle horizontal swim pose
      this.bodyPivot.position.y = 0.22 + Math.sin(this.swimCycle) * 0.05;
      this.bodyPivot.rotation.x = Math.PI * 0.42;
      this.leftArmPivot.rotation.x = -Math.PI * 0.5 + Math.sin(this.swimCycle) * 0.85;
      this.rightArmPivot.rotation.x = -Math.PI * 0.5 + Math.cos(this.swimCycle) * 0.85;
      this.leftLegPivot.rotation.x = Math.sin(this.swimCycle * 1.5) * 0.45;
      this.rightLegPivot.rotation.x = -Math.sin(this.swimCycle * 1.5) * 0.45;
      this.weaponMount.visible = false;
    } else {
      this.y = this._sampleGroundY(this.x, this.z);
      this.weaponMount.visible = true;

      if (this.isRolling) {
        // 360-degree forward somersault tilt during evasive roll
        const progress = 1.0 - this.rollTimer / this.rollDuration;
        this.bodyPivot.position.y = 0.65 + Math.sin(progress * Math.PI) * 0.35;
        this.bodyPivot.rotation.x = progress * Math.PI * 2;
      } else {
        this.bodyPivot.rotation.x = 0;
        const speed = Math.hypot(this.vx, this.vz);
        if (speed > 0.4) {
          this.walkCycle += dt * (this.isSprinting ? 14.5 : 10.5);
          this.bodyPivot.position.y = 0.85 + Math.abs(Math.sin(this.walkCycle)) * 0.06;
          this.leftLegPivot.rotation.x = Math.sin(this.walkCycle) * 0.62;
          this.rightLegPivot.rotation.x = -Math.sin(this.walkCycle) * 0.62;
        } else {
          this.bodyPivot.position.y = 0.85;
          this.leftLegPivot.rotation.x *= 0.8;
          this.rightLegPivot.rotation.x *= 0.8;
        }
      }

      // Melee swing or Neon Shock Baton hum on right arm
      const activeWeapon = this.weapons[this.currentWeaponIndex];
      if (this.meleeSwingTimer > 0) {
        this.meleeSwingTimer = Math.max(0, this.meleeSwingTimer - dt);
        const swingWave = Math.sin((this.meleeSwingTimer / 0.24) * Math.PI);
        this.rightArmPivot.rotation.x = -Math.PI * 0.45 - swingWave * 0.95;
        this.rightArmPivot.rotation.z = (this.meleeComboStep % 2 === 0 ? -1 : 1) * swingWave * 0.65;
        if (this.slashArcMesh) {
          this.slashArcMesh.material.opacity = swingWave * 0.88;
        }
      } else {
        this.rightArmPivot.rotation.z = 0;
        if (this.slashArcMesh) this.slashArcMesh.material.opacity = 0;
        if (activeWeapon.id === 'stun_baton') {
          this.weaponMount.position.x = (Math.random() - 0.5) * 0.012;
          this.weaponMount.position.y = -0.44 + (Math.random() - 0.5) * 0.012;
        } else {
          this.weaponMount.position.x = 0;
          this.weaponMount.position.y = -0.44;
        }
      }
    }

    // Update facing rotation
    if (!this.isRolling) {
      if (this.lockedTarget && !this.isSwimming) {
        this.rotationY = Math.atan2(this.lockedTarget.x - this.x, this.lockedTarget.z - this.z);
      } else if (mag > 0.1) {
        const targetYaw = Math.atan2(moveX, moveZ);
        let diff = targetYaw - this.rotationY;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.rotationY += diff * Math.min(1.0, dt * 14.0);
      }
    }

    this.playerMesh.position.set(this.x, this.y, this.z);
    this.playerMesh.rotation.y = this.rotationY;
  }

  _updateNPCs(dt) {
    const wantedStars =
      this.vehicleSystem && typeof this.vehicleSystem.getWantedHUDState === 'function'
        ? this.vehicleSystem.getWantedHUDState().stars || 0
        : 0;
    const vehicles = this._getActiveVehicles();
    const playerSpeed = Math.hypot(this.vx, this.vz);
    const px = this.player?.x ?? 0;
    const pz = this.player?.z ?? 0;

    for (const npc of this.npcs) {
      if (npc.speechCooldown > 0) {
        npc.speechCooldown = Math.max(0, npc.speechCooldown - dt);
      }
      if (npc.activeSpeech) {
        npc.activeSpeech.timer -= dt;
        if (npc.activeSpeech.timer <= 0) {
          npc.activeSpeech = null;
        }
      }

      if (npc.hitFlash > 0) {
        npc.hitFlash = Math.max(0, npc.hitFlash - dt);
        npc.torso.material.emissive?.setHex(npc.hitFlash > 0 ? 0xff2244 : 0x000000);
      }

      // Infinite World Pedestrian Streaming: recycle non-dead NPCs > 175m from player onto a nearby sidewalk
      if (!npc.isDead && Math.hypot(npc.x - px, npc.z - pz) > 175) {
        const cx = Math.round(px / 120);
        const cz = Math.round(pz / 120);
        const side = Math.random() < 0.5 ? -8.5 : 8.5;
        let rx;
        let rz;
        if (Math.random() < 0.5) {
          rx = cx * 120 + side;
          rz = pz + (Math.random() < 0.5 ? 1 : -1) * (35 + Math.random() * 50);
        } else {
          rz = cz * 120 + side;
          rx = px + (Math.random() < 0.5 ? 1 : -1) * (35 + Math.random() * 50);
        }
        if (!this._isWater(rx, rz)) {
          npc.x = rx;
          npc.z = rz;
          npc.spawnX = rx;
          npc.spawnZ = rz;
          npc.y = this._sampleGroundY(rx, rz);
          npc.patrolA = { x: rx, z: rz - 12 };
          npc.patrolB = { x: rx, z: rz + 12 };
          npc.isHostile = false;
          npc.isPanicking = false;
          npc.provoked = false;
          npc._injuredHeatApplied = false;
          npc.health = npc.maxHealth;
          if (npc.hostileRing) npc.hostileRing.visible = false;
          if (npc.mesh) npc.mesh.position.set(npc.x, npc.y, npc.z);
        }
      }

      // Dead NPC tumble & respawn lifecycle
      if (npc.isDead) {
        if (npc.y > this._sampleGroundY(npc.x, npc.z) || npc.vy > 0) {
          npc.x += npc.vx * dt;
          npc.z += npc.vz * dt;
          npc.y += npc.vy * dt;
          npc.vy -= 18.0 * dt;
          const gy = this._sampleGroundY(npc.x, npc.z);
          if (npc.y <= gy) {
            npc.y = gy;
            npc.vy = 0;
            npc.vx = 0;
            npc.vz = 0;
          }
        }
        npc.bodyPivot.position.y = 0.24;
        npc.bodyPivot.rotation.x = -Math.PI / 2;
        npc.mesh.position.set(npc.x, npc.y, npc.z);

        npc.respawnTimer -= dt;
        if (npc.respawnTimer <= 0) {
          npc.isDead = false;
          npc.health = npc.maxHealth;
          npc._injuredHeatApplied = false;
          npc.isPanicking = false;
          npc.isHostile = Boolean(npc.isRampageTarget);
          npc.provoked = Boolean(npc.isRampageTarget);
          if (npc.hostileRing) npc.hostileRing.visible = npc.isHostile;
          if (Math.hypot(npc.spawnX - px, npc.spawnZ - pz) > 175) {
            const cx = Math.round(px / 120);
            const cz = Math.round(pz / 120);
            const side = Math.random() < 0.5 ? -8.5 : 8.5;
            const rx = Math.random() < 0.5
              ? cx * 120 + side
              : px + (Math.random() < 0.5 ? 1 : -1) * (35 + Math.random() * 50);
            const rz = rx === cx * 120 + side
              ? pz + (Math.random() < 0.5 ? 1 : -1) * (35 + Math.random() * 50)
              : cz * 120 + side;
            if (!this._isWater(rx, rz)) {
              npc.spawnX = rx;
              npc.spawnZ = rz;
              npc.patrolA = { x: rx, z: rz - 12 };
              npc.patrolB = { x: rx, z: rz + 12 };
            }
          }
          npc.x = npc.spawnX;
          npc.z = npc.spawnZ;
          npc.y = this._sampleGroundY(npc.x, npc.z);
          npc.bodyPivot.position.y = 0.82;
          npc.bodyPivot.rotation.x = 0;
          npc.mesh.position.set(npc.x, npc.y, npc.z);
        }
        continue;
      }

      // Check vehicle run-over / sidewalk panic:
      // CRITICAL: ONLY the player's currently driven vehicle can run over NPCs and add Wanted heat!
      for (const v of vehicles) {
        const vSpeed = Math.hypot(v.vx || 0, v.vz || 0) || Math.abs(v.speed || 0);
        if (vSpeed < 2.5) continue;
        const d = Math.hypot(v.x - npc.x, v.z - npc.z);
        const isPlayerCar = Boolean(this.inVehicle && this.currentVehicle && v === this.currentVehicle);

        if (isPlayerCar) {
          if (d < 1.85 && vSpeed > 8.5) {
            const dirX = (npc.x - v.x) / Math.max(0.1, d);
            const dirZ = (npc.z - v.z) / Math.max(0.1, d);
            this._damageNPC(npc, 95, dirX * 12, dirZ * 12, { id: 'vehicle' }, true);
            break;
          } else if (d < 5.8 && vSpeed > 10.5 && npc.faction === 'civilian') {
            npc.isPanicking = true;
            npc.panicTimer = 5.5;
            if (this.panicVoiceCooldown <= 0 && npc.speechCooldown <= 0) {
              this.panicVoiceCooldown = 12.0;
              this._triggerPedestrianSpeech(npc, 'panic');
            }
          }
        } else if (d < 3.0) {
          // AI traffic car: gently nudge NPC toward the sidewalk without hurting them or blaming the player
          const dirX = (npc.x - v.x) / Math.max(0.1, d);
          const dirZ = (npc.z - v.z) / Math.max(0.1, d);
          npc.x += dirX * 1.4;
          npc.z += dirZ * 1.4;
        }
      }
      if (npc.isDead) continue;

      // ACPD officers only turn hostile when player has Wanted stars or directly provoked them
      if (npc.faction === 'acpd') {
        if (wantedStars === 0) {
          npc.provoked = false;
          npc.isHostile = false;
        } else {
          npc.isHostile = true;
        }
      } else if (npc.faction !== 'civilian') {
        npc.isHostile = Boolean(npc.provoked || npc.isRampageTarget);
      }
      if (npc.hostileRing) {
        npc.hostileRing.visible = Boolean(npc.isHostile);
      }

      const distToPlayer = Math.hypot(this.x - npc.x, this.z - npc.z);

      // Shoulder-bump reaction when player sprints into a pedestrian on foot
      if (
        !this.inVehicle &&
        !npc.isHostile &&
        distToPlayer < 1.35 &&
        playerSpeed > 4.5 &&
        this.insultVoiceCooldown <= 0 &&
        npc.speechCooldown <= 0
      ) {
        this.insultVoiceCooldown = 9.0;
        this._triggerPedestrianSpeech(npc, 'insult');
      }

      // Hostile Gang / Cartel / ACPD AI (only when provoked or Wanted!)
      if (npc.isHostile && distToPlayer < 24.0) {
        const angleToPlayer = Math.atan2(this.x - npc.x, this.z - npc.z);
        npc.rotationY = angleToPlayer;
        npc.rightArm.rotation.x = -Math.PI * 0.4;

        if (distToPlayer > 11.0 || npc.weaponId === 'katana') {
          const chaseSpeed = npc.weaponId === 'katana' ? 6.8 : 4.2;
          npc.vx = Math.sin(angleToPlayer) * chaseSpeed;
          npc.vz = Math.cos(angleToPlayer) * chaseSpeed;
        } else {
          // Tactical strafe
          const strafeSign = parseInt(npc.id.slice(4), 10) % 2 === 0 ? 1 : -1;
          npc.vx = Math.cos(angleToPlayer) * 2.2 * strafeSign;
          npc.vz = -Math.sin(angleToPlayer) * 2.2 * strafeSign;
        }

        // Shoot at player
        npc.shootCooldown -= dt;
        if (npc.shootCooldown <= 0 && distToPlayer < 21.0) {
          npc.shootCooldown = npc.faction === 'cartel' ? 0.95 : 1.35;
          if (npc.weaponId === 'katana') {
            if (distToPlayer < 2.6) {
              this.damagePlayer(14, npc.faction);
            }
          } else {
            const spread = (Math.random() - 0.5) * 0.22;
            const shotAng = angleToPlayer + spread;
            const endX = npc.x + Math.sin(shotAng) * Math.min(distToPlayer + 1.5, 19.0);
            const endZ = npc.z + Math.cos(shotAng) * Math.min(distToPlayer + 1.5, 19.0);
            this._spawnTracerAndMuzzleFlash(
              npc.x + Math.sin(angleToPlayer) * 0.6,
              npc.y + 1.1,
              npc.z + Math.cos(angleToPlayer) * 0.6,
              endX,
              this.y + 0.9,
              endZ,
              0xffaa22
            );
            if (Math.abs(spread) < 0.09) {
              if (this.inVehicle && this.currentVehicle) {
                this._damageVehicleTarget(this.currentVehicle, 4.5, false);
              } else {
                this.damagePlayer(6.0, npc.faction);
              }
            }
          }
        }
      } else if (npc.isPanicking && npc.panicTimer > 0) {
        // Panic & flee away from player
        npc.panicTimer -= dt;
        if (npc.panicTimer <= 0) npc.isPanicking = false;
        const fleeAngle = Math.atan2(npc.x - this.x, npc.z - this.z);
        npc.rotationY = fleeAngle;
        npc.vx = Math.sin(fleeAngle) * 7.2;
        npc.vz = Math.cos(fleeAngle) * 7.2;
        npc.leftArm.rotation.x = -Math.PI * 0.85;
        npc.rightArm.rotation.x = -Math.PI * 0.85;
      } else {
        // Ambient sidewalk stroll / sunbathing + 1986 Argon City pass-by street banter!
        if (
          wantedStars === 0 &&
          !this.isCombat &&
          distToPlayer <= 8.5 &&
          distToPlayer >= 1.3 &&
          playerSpeed < 13.0 &&
          this.ambientChatCooldown <= 0 &&
          npc.speechCooldown <= 0
        ) {
          this.ambientChatCooldown = 8.5;
          this._triggerPedestrianSpeech(npc, 'chat');
        }

        npc.wanderTimer -= dt;
        if (npc.wanderTimer <= 0) {
          npc.wanderTimer = 3.0 + Math.random() * 4.5;
          // Prefer North/South strolling along sidewalks
          npc.rotationY = Math.random() < 0.5 ? 0 : Math.PI;
        }
        const strollSpeed =
          npc.type === 'sunbather' ? 0.0 : npc.type === 'beach_skater' ? 4.8 : 2.1;
        npc.vx = Math.sin(npc.rotationY) * strollSpeed;
        npc.vz = Math.cos(npc.rotationY) * strollSpeed;
        if (!npc.isHostile) {
          npc.leftArm.rotation.x = 0;
          npc.rightArm.rotation.x = 0;
        }
      }

      // Move & keep on land + off asphalt road carriageways when peacefully strolling
      let nx = npc.x + npc.vx * dt;
      let nz = npc.z + npc.vz * dt;

      if (!npc.isHostile && !npc.isPanicking) {
        const inCore = Math.abs(nx) <= 180 && Math.abs(nz) <= 180;
        const inNSRoad = inCore
          ? Math.abs(nx - 80) < 6.4 || Math.abs(nx - 40) < 6.4 || Math.abs(nx - -115) < 6.4
          : Math.abs(nx - Math.round(nx / 120) * 120) < 6.4;
        const inEWRoad = inCore
          ? Math.abs(nz) < 6.2 || Math.abs(nz - -90) < 6.2 || Math.abs(nz - 95) < 6.2
          : Math.abs(nz - Math.round(nz / 120) * 120) < 6.2;
        if (inNSRoad || inEWRoad) {
          nx = npc.x;
          nz = npc.z;
          npc.rotationY = inNSRoad
            ? Math.cos(npc.rotationY) >= 0
              ? 0
              : Math.PI
            : Math.sin(npc.rotationY) >= 0
              ? Math.PI / 2
              : -Math.PI / 2;
        }
      }

      const isWater = this._isWater(nx, nz);
      if (isWater) {
        npc.rotationY += Math.PI * 0.85;
        npc.vx = 0;
        npc.vz = 0;
      } else {
        const res = this._resolveCircleWorldCollision(nx, nz, 0.48);
        npc.x = res.x;
        npc.z = res.z;
      }

      // Solid OBB vehicle collision resolution for every live NPC (even when vehicles are parked or stopped)
      const vehRes = this._resolveCharacterVehicleCollisions(npc.x, npc.z, 0.48);
      if (vehRes.hitVehicle) {
        npc.x = vehRes.x;
        npc.z = vehRes.z;
        const tanX = -vehRes.nz;
        const tanZ = vehRes.nx;
        const curDirX = Math.sin(npc.rotationY);
        const curDirZ = Math.cos(npc.rotationY);
        const sign = curDirX * tanX + curDirZ * tanZ >= 0 ? 1 : -1;
        npc.rotationY = Math.atan2(tanX * sign, tanZ * sign);
      }

      // NPC-vs-Player separation (!this.inVehicle, minDist = 0.88)
      if (!this.inVehicle && !this.isSwimming) {
        const pdx = npc.x - this.x;
        const pdz = npc.z - this.z;
        const pDistSq = pdx * pdx + pdz * pdz;
        const minPlayerDist = 0.88;
        if (pDistSq < minPlayerDist * minPlayerDist && pDistSq > 0.0001) {
          const pDist = Math.sqrt(pDistSq);
          const overlap = minPlayerDist - pDist;
          const pnx = pdx / pDist;
          const pnz = pdz / pDist;
          npc.x += pnx * overlap * 0.65;
          npc.z += pnz * overlap * 0.65;
          this.x -= pnx * overlap * 0.35;
          this.z -= pnz * overlap * 0.35;
          this.playerMesh.position.x = this.x;
          this.playerMesh.position.z = this.z;
        }
      }

      // NPC-vs-NPC circle separation (minDist = 0.82)
      const minNpcDist = 0.82;
      for (let j = 0; j < this.npcs.length; j++) {
        const other = this.npcs[j];
        if (!other || other === npc || other.isDead) continue;
        const odx = npc.x - other.x;
        const odz = npc.z - other.z;
        const oDistSq = odx * odx + odz * odz;
        if (oDistSq < minNpcDist * minNpcDist && oDistSq > 0.0001) {
          const oDist = Math.sqrt(oDistSq);
          const overlap = (minNpcDist - oDist) * 0.5;
          const onx = odx / oDist;
          const onz = odz / oDist;
          npc.x += onx * overlap;
          npc.z += onz * overlap;
          other.x -= onx * overlap;
          other.z -= onz * overlap;
          other.mesh.position.x = other.x;
          other.mesh.position.z = other.z;
        }
      }

      npc.y = this._sampleGroundY(npc.x, npc.z);
      const speed = Math.hypot(npc.vx, npc.vz);
      if (speed > 0.25) {
        npc.walkPhase += dt * (npc.isPanicking ? 14.0 : 8.5);
        npc.leftLeg.rotation.x = Math.sin(npc.walkPhase) * 0.55;
        npc.rightLeg.rotation.x = -Math.sin(npc.walkPhase) * 0.55;
      } else {
        npc.leftLeg.rotation.x = 0;
        npc.rightLeg.rotation.x = 0;
      }

      npc.mesh.position.set(npc.x, npc.y, npc.z);
      npc.mesh.rotation.y = npc.rotationY;
    }
  }

  _updateProjectilesAndFireGrids(dt) {
    // 1. Parabolic lobbed throwables (Molotovs & Grenades)
    for (let i = this.lobbedProjectiles.length - 1; i >= 0; i--) {
      const p = this.lobbedProjectiles[i];
      p.elapsed += dt;
      const t = Math.min(1.0, p.elapsed / p.duration);
      const x = p.startX + (p.targetX - p.startX) * t;
      const z = p.startZ + (p.targetZ - p.startZ) * t;
      const linearY = p.startY + (p.targetY - p.startY) * t;
      const arcY = 4.0 * p.arcHeight * t * (1.0 - t);

      p.mesh.position.set(x, linearY + arcY, z);
      p.mesh.rotation.x += dt * 11.0;
      p.mesh.rotation.z += dt * 7.0;

      if (t >= 1.0) {
        this.fxGroup.remove(p.mesh);
        this.lobbedProjectiles.splice(i, 1);
        this._detonateThrowable(p);
      }
    }

    // 2. RPG-7 Rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.age += dt;
      r.x += r.vx * dt;
      r.z += r.vz * dt;
      r.mesh.position.set(r.x, r.y, r.z);

      let hit = r.age >= r.maxAge;
      if (!hit) {
        // Check building collision
        const resolved = this._resolveCircleWorldCollision(r.x, r.z, 0.35);
        if (Math.hypot(resolved.x - r.x, resolved.z - r.z) > 0.05) hit = true;
      }
      if (!hit) {
        for (const npc of this.npcs) {
          if (!npc.isDead && Math.hypot(npc.x - r.x, npc.z - r.z) < 1.35) {
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (const v of this._getActiveVehicles()) {
          if (v !== this.currentVehicle && !v.isWrecked && Math.hypot(v.x - r.x, v.z - r.z) < 2.4) {
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        this.fxGroup.remove(r.mesh);
        this.rockets.splice(i, 1);
        if (typeof this.callbacks.onExplosion === 'function') {
          this.callbacks.onExplosion(r.x, r.y, r.z, 1.45);
        }
        if (this.world && typeof this.world.addCameraShake === 'function') {
          this.world.addCameraShake(0.8);
        }
        this.applyExplosionDamageAt(r.x, r.z, 8.5, 250, false, true);
      }
    }

    // 3. Flamethrower Fire Spheres
    for (let i = this.flameParticles.length - 1; i >= 0; i--) {
      const fp = this.flameParticles[i];
      fp.age += dt;
      fp.x += fp.vx * dt;
      fp.z += fp.vz * dt;
      const s = 1.0 + (fp.age / fp.maxAge) * 2.8;
      fp.mesh.position.set(fp.x, fp.y, fp.z);
      fp.mesh.scale.setScalar(s);
      fp.mesh.material.opacity = Math.max(0, 1.0 - fp.age / fp.maxAge);

      for (const npc of this.npcs) {
        if (!npc.isDead && Math.hypot(npc.x - fp.x, npc.z - fp.z) < 1.5) {
          this._damageNPC(npc, fp.damage, 0, 0, fp.weapon, true);
        }
      }
      for (const v of this._getActiveVehicles()) {
        if (v !== this.currentVehicle && !v.isWrecked && Math.hypot(v.x - fp.x, v.z - fp.z) < 2.4) {
          this._damageVehicleTarget(v, fp.damage * 0.6, true);
        }
      }

      if (fp.age >= fp.maxAge) {
        this.fxGroup.remove(fp.mesh);
        this.flameParticles.splice(i, 1);
      }
    }

    // 4. Molotov Expanding Neon-Orange Ground Fire Grids
    for (let i = this.localFireGrids.length - 1; i >= 0; i--) {
      const fg = this.localFireGrids[i];
      fg.remaining -= dt;
      const lifeRatio = Math.max(0, Math.min(1, fg.remaining / fg.maxDuration));
      fg.baseDisc.material.opacity = 0.48 * lifeRatio;

      for (const tile of fg.tiles) {
        tile.phase += dt * 14.0;
        const flicker = 0.75 + Math.sin(tile.phase) * 0.35;
        tile.mesh.scale.set(1.0, flicker * lifeRatio, 1.0);
      }

      // Burn NPCs and vehicles standing on the 4x4 fire grid
      for (const npc of this.npcs) {
        if (!npc.isDead && Math.hypot(npc.x - fg.x, npc.z - fg.z) <= fg.radius) {
          this._damageNPC(npc, 28 * dt, 0, 0, { id: 'molotov' }, true);
        }
      }
      for (const v of this._getActiveVehicles()) {
        if (!v.isWrecked && Math.hypot(v.x - fg.x, v.z - fg.z) <= fg.radius + 1.2) {
          this._damageVehicleTarget(v, 32 * dt, true);
        }
      }

      if (fg.remaining <= 0) {
        this.fxGroup.remove(fg.group);
        this.localFireGrids.splice(i, 1);
      }
    }
  }

  _updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.age += dt;
      p.mesh.rotation.y += dt * 3.2;
      p.mesh.position.y = p.y + Math.sin(p.age * 5.0) * 0.08;

      const dist = Math.hypot(this.x - p.x, this.z - p.z);
      if (dist <= 2.2) {
        if (p.type === 'cash') {
          this.addCash(p.amount);
          if (typeof this.callbacks.onCallout === 'function') {
            this.callbacks.onCallout(`+$${p.amount} CASH`, 'STREET DROP', '#00ff66');
          }
        } else {
          this.addAmmo('mac10', p.amount);
          this.addAmmo('shotgun', 16);
          if (typeof this.callbacks.onCallout === 'function') {
            this.callbacks.onCallout(`+${p.amount} AMMO`, 'MAC-10 & SHOTGUN', '#00f0ff');
          }
        }
        if (typeof this.callbacks.onPlaySFX === 'function') {
          this.callbacks.onPlaySFX('cash_pickup');
        }
        this.pickupGroup.remove(p.mesh);
        this.pickups.splice(i, 1);
        continue;
      }

      if (p.age >= p.maxAge) {
        this.pickupGroup.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  _updateFXPools(dt) {
    for (const t of this.tracerPool) {
      if (t.timer > 0) {
        t.timer -= dt;
        const ratio = Math.max(0, t.timer / t.maxTimer);
        t.beam.material.opacity = ratio;
        t.flash.material.opacity = ratio;
        if (t.timer <= 0) {
          t.beam.visible = false;
          t.flash.visible = false;
        }
      }
    }

    for (const r of this.waterRipples) {
      if (r.active) {
        r.age += dt;
        const p = r.age / r.maxAge;
        const rad = 0.55 + p * 2.1;
        r.mesh.scale.set(rad, 1.0, rad);
        r.mesh.material.opacity = Math.max(0, (1.0 - p) * 0.78);
        if (r.age >= r.maxAge) {
          r.active = false;
          r.mesh.visible = false;
        }
      }
    }

    for (const b of this.bloodDecals) {
      if (b.active) {
        b.timer -= dt;
        const fadeRatio = Math.max(0, Math.min(1, b.timer / 1.6));
        b.mesh.material.opacity = fadeRatio * 0.72;
        if (b.timer <= 0) {
          b.active = false;
          b.mesh.visible = false;
        }
      }
    }
  }

  // ============================================================================
  // WORLD COLLISION & SPATIAL HELPERS
  // ============================================================================

  _sampleGroundY(x, z) {
    if (this.world && typeof this.world.getGroundHeightAt === 'function') {
      return this.world.getGroundHeightAt(x, z);
    }
    return 0.0;
  }

  _getActiveVehicles() {
    if (this.vehicleSystem && typeof this.vehicleSystem.getVehicles === 'function') {
      return this.vehicleSystem.getVehicles() || [];
    }
    return [];
  }

  _resolveCharacterVehicleCollisions(x, z, radius = 0.52, options = {}) {
    let rx = x;
    let rz = z;
    let hitVehicle = null;
    let hitNx = 0;
    let hitNz = 0;
    const ignoreVehicle = options.ignoreVehicle || null;
    const vehicles = this._getActiveVehicles();

    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (!v || v === ignoreVehicle || v.isExploded || (v.y || 0) > 2.2) continue;

      const dx = rx - v.x;
      const dz = rz - v.z;
      const yaw = v.rotationY || 0;
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;

      const halfW = ((v.spec && v.spec.width) || 2.1) * 0.52;
      const halfL = ((v.spec && v.spec.length) || 4.6) * 0.52;

      if (Math.abs(localX) >= halfW + radius || Math.abs(localZ) >= halfL + radius) continue;

      const cx = Math.max(-halfW, Math.min(halfW, localX));
      const cz = Math.max(-halfL, Math.min(halfL, localZ));
      const odx = localX - cx;
      const odz = localZ - cz;
      const distSq = odx * odx + odz * odz;

      if (distSq < radius * radius) {
        let newLocalX = localX;
        let newLocalZ = localZ;
        let localNx = 0;
        let localNz = 1;

        if (distSq > 0.0001) {
          const d = Math.sqrt(distSq);
          localNx = odx / d;
          localNz = odz / d;
          newLocalX = cx + localNx * (radius + 0.03);
          newLocalZ = cz + localNz * (radius + 0.03);
        } else {
          const penX = halfW - Math.abs(localX);
          const penZ = halfL - Math.abs(localZ);
          if (penX <= penZ) {
            localNx = localX >= 0 ? 1 : -1;
            localNz = 0;
            newLocalX = localNx * (halfW + radius + 0.03);
          } else {
            localNx = 0;
            localNz = localZ >= 0 ? 1 : -1;
            newLocalZ = localNz * (halfL + radius + 0.03);
          }
        }

        rx = v.x + newLocalX * cos + newLocalZ * sin;
        rz = v.z - newLocalX * sin + newLocalZ * cos;
        hitNx = localNx * cos + localNz * sin;
        hitNz = -localNx * sin + localNz * cos;
        hitVehicle = v;
      }
    }

    return { x: rx, z: rz, hitVehicle, nx: hitNx, nz: hitNz };
  }

  _resolveCircleWorldCollision(x, z, radius = 0.55) {
    let rx = x;
    let rz = z;

    // Resolve against building & prop AABB colliders (smooth closest-point circle-vs-AABB)
    if (this.world && typeof this.world.getBuildingColliders === 'function') {
      const boxes = this.world.getBuildingColliders() || [];
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (rx + radius <= b.minX || rx - radius >= b.maxX || rz + radius <= b.minZ || rz - radius >= b.maxZ) {
          continue;
        }
        const cx = Math.max(b.minX, Math.min(b.maxX, rx));
        const cz = Math.max(b.minZ, Math.min(b.maxZ, rz));
        const dx = rx - cx;
        const dz = rz - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq < radius * radius) {
          if (distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            rx = cx + (dx / dist) * (radius + 0.02);
            rz = cz + (dz / dist) * (radius + 0.02);
          } else {
            const overlapLeft = rx + radius - b.minX;
            const overlapRight = b.maxX - (rx - radius);
            const overlapTop = rz + radius - b.minZ;
            const overlapBottom = b.maxZ - (rz - radius);
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
            if (minOverlap === overlapLeft) rx = b.minX - radius - 0.02;
            else if (minOverlap === overlapRight) rx = b.maxX + radius + 0.02;
            else if (minOverlap === overlapTop) rz = b.minZ - radius - 0.02;
            else rz = b.maxZ + radius + 0.02;
          }
        }
      }
    }

    // Resolve against palm tree circle colliders
    if (this.world && typeof this.world.getPalmColliders === 'function') {
      const palms = this.world.getPalmColliders() || [];
      for (let i = 0; i < palms.length; i++) {
        const p = palms[i];
        const minDist = radius + (p.radius || 0.45);
        const dx = rx - p.x;
        const dz = rz - p.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          rx = p.x + (dx / dist) * minDist;
          rz = p.z + (dz / dist) * minDist;
        }
      }
    }

    // Resolve against stunt ramps when on foot (this.y < 1.0) so characters walk around solid ramp wedges
    if ((this.y || 0) < 1.0 && this.world) {
      const ramps =
        (typeof this.world.getStuntRamps === 'function' ? this.world.getStuntRamps() : this.world.stuntRamps) || [];
      for (let i = 0; i < ramps.length; i++) {
        const r = ramps[i];
        if (!r) continue;
        if (r.dirX !== undefined && r.dirZ !== undefined) {
          const dx = rx - r.x;
          const dz = rz - r.z;
          const along = dx * r.dirX + dz * r.dirZ;
          const perp = -dx * r.dirZ + dz * r.dirX;
          const halfL = (r.length || 8.0) * 0.5;
          const halfW = (r.width || 4.2) * 0.5;
          if (Math.abs(along) < halfL + radius && Math.abs(perp) < halfW + radius) {
            const penAlong = halfL + radius - Math.abs(along);
            const penPerp = halfW + radius - Math.abs(perp);
            if (penPerp <= penAlong) {
              const newPerp = (perp >= 0 ? 1 : -1) * (halfW + radius + 0.02);
              rx = r.x + along * r.dirX - newPerp * r.dirZ;
              rz = r.z + along * r.dirZ + newPerp * r.dirX;
            } else {
              const newAlong = (along >= 0 ? 1 : -1) * (halfL + radius + 0.02);
              rx = r.x + newAlong * r.dirX - perp * r.dirZ;
              rz = r.z + newAlong * r.dirZ + perp * r.dirX;
            }
          }
        } else if (r.minX !== undefined && r.maxX !== undefined) {
          if (rx + radius > r.minX && rx - radius < r.maxX && rz + radius > r.minZ && rz - radius < r.maxZ) {
            const overlapLeft = rx + radius - r.minX;
            const overlapRight = r.maxX - (rx - radius);
            const overlapTop = rz + radius - r.minZ;
            const overlapBottom = r.maxZ - (rz - radius);
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
            if (minOverlap === overlapLeft) rx = r.minX - radius;
            else if (minOverlap === overlapRight) rx = r.maxX + radius;
            else if (minOverlap === overlapTop) rz = r.minZ - radius;
            else rz = r.maxZ + radius;
          }
        }
      }
    }

    return { x: rx, z: rz };
  }
}

export default CombatWeaponsSystem;
