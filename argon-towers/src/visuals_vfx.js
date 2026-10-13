/**
 * Argon Towers (Grasslands) — 2.5D Hand-Painted Visuals, Models, Shaders & VFX Engine
 *
 * Responsibilities:
 * 1. Hand-Painted Grasslands Environment (`buildEnvironment()`):
 *    - 2048x1024 procedural CanvasTexture (`THREE.SRGBColorSpace`) with lush yellow-green
 *      painterly grass meadow, concentric-ring sandy dirt patches, and curling brown root/vine
 *      scrollwork on the West entry path.
 *    - North & South industrial beveled concrete retaining walls with crack details, pipes,
 *      and angled crimson-red military buttresses (`#b81e24`) + yellow/black hazard stripes.
 *    - East Exit concrete trench bunker walls, yellow chevron threshold plate, and the iconic
 *      yellow-and-black concentric Bullseye Target Sign (`O`).
 *    - Whimsical sculpted cartoon forest trees along West, North-West & South-West borders
 *      with hollow knotholes, curling roots, and concentric-ring green foliage canopies.
 * 2. Stylized 3-Tier Tower Models (`createTowerVisual`, `updateTowerVisual`, `upgradeTowerVisual`):
 *    - Gatling (Tiers 1-3): Glossy metallic ice-blue/silver rounded dome + brass collars + rotary barrels.
 *    - Goo (Tiers 1-3): Ribbed neon-green & cobalt-blue beetle bio-carapace + pressurized slime nozzles.
 *    - Missile (Tiers 1-3): Slatted gunmetal hydraulic launcher rack + red-nosed silver rockets with reload animation.
 *    - Tesla (Tiers 1-3): Deep cobalt transformer box + cyan capacitor rings + 4-pronged glowing cyan-white horns.
 * 3. 6 Iconic Enemy Models & Run/Flight Animations (`createEnemyVisual`, `updateEnemyVisual`):
 *    - Grunt, Biker, Armored Transport, Goliath Mech, Skyraider Chopper (with ground shadow),
 *      and Dreadnought Zeppelin Boss (shark-mouth nose art + large elliptical ground shadow).
 * 4. High-Impact Cartoon VFX (`updateVFX`):
 *    - Zero dynamic PointLight allocation (prevents Three.js shader recompilation stalls).
 *    - Muzzle flashes + bouncing brass shells, pulsing Goo slime streams + persistent puddles,
 *      helical corkscrew missile smoke puffs, pop-art fireballs + scorched craters,
 *      multi-layered branching 3D Tesla lightning arcs, and floating comic callout texts.
 */

const THREE = (typeof window !== 'undefined' && window.THREE) ? window.THREE : null;

function applySRGB(texture) {
  if (!texture || !THREE) return texture;
  if (THREE.SRGBColorSpace !== undefined) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else if (THREE.sRGBEncoding !== undefined) {
    texture.encoding = THREE.sRGBEncoding;
  }
  texture.needsUpdate = true;
  return texture;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

class ArgonTowersVisuals {
  constructor(scene, camera, renderer) {
    this.scene = scene || null;
    this.camera = camera || null;
    this.renderer = renderer || null;

    this.environmentGroup = THREE ? new THREE.Group() : null;
    this.decalGroup = THREE ? new THREE.Group() : null;
    this.towersGroup = THREE ? new THREE.Group() : null;
    this.enemiesGroup = THREE ? new THREE.Group() : null;
    this.projectilesGroup = THREE ? new THREE.Group() : null;
    this.vfxGroup = THREE ? new THREE.Group() : null;

    if (this.scene && THREE) {
      this.environmentGroup.name = 'FR_EnvironmentGroup';
      this.decalGroup.name = 'FR_DecalGroup';
      this.towersGroup.name = 'FR_TowersGroup';
      this.enemiesGroup.name = 'FR_EnemiesGroup';
      this.projectilesGroup.name = 'FR_ProjectilesGroup';
      this.vfxGroup.name = 'FR_VFXGroup';

      this.scene.add(this.environmentGroup);
      this.scene.add(this.decalGroup);
      this.scene.add(this.towersGroup);
      this.scene.add(this.enemiesGroup);
      this.scene.add(this.projectilesGroup);
      this.scene.add(this.vfxGroup);
    }

    this.textures = {};
    this.materials = {};
    this.geometries = {};
    this.floatingTextCache = new Map();

    // Active VFX lists
    this.particles = [];
    this.shellCasings = [];
    this.decals = [];
    this.gooStreams = [];
    this.lightningArcs = [];
    this.floatingTexts = [];
    this.shockwaves = [];

    // Tracked visual maps
    this.towerVisuals = new Map();
    this.enemyVisuals = new Map();
    this.projectileVisuals = new Map();

    this._time = 0;

    if (THREE && typeof document !== 'undefined') {
      this._initSharedAssets();
    }
  }

  // ============================================================================
  // 1. SHARED PROCEDURAL HAND-PAINTED TEXTURES, MATERIALS & GEOMETRIES
  // ============================================================================

  _initSharedAssets() {
    if (this._assetsInitialized) return;
    this._assetsInitialized = true;

    this.textures.grasslands = this._createGrasslandsCanvasTexture();
    this.textures.treeCanopy = this._createTreeCanopyTexture();
    this.textures.treeBark = this._createTreeBarkTexture();
    this.textures.gatlingDome = this._createGatlingDomeTexture();
    this.textures.gooCarapace = this._createGooCarapaceTexture();
    this.textures.hazardStripes = this._createHazardStripeTexture();
    this.textures.bullseye = this._createBullseyeTexture();
    this.textures.exitTrench = this._createExitTrenchTexture();
    this.textures.zeppelinHull = this._createZeppelinSharkTexture();
    this.textures.dropShadow = this._createSoftShadowTexture();
    this.textures.craterDecal = this._createCraterDecalTexture();
    this.textures.gooDecal = this._createGooDecalTexture();
    this.textures.muzzleStar = this._createMuzzleStarTexture();
    this.textures.smokePuff = this._createSmokePuffTexture();

    // Shared Materials
    this.materials.dropShadow = new THREE.MeshBasicMaterial({
      map: this.textures.dropShadow,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    this.materials.airDropShadow = new THREE.MeshBasicMaterial({
      map: this.textures.dropShadow,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });

    this.materials.gatlingDome = new THREE.MeshStandardMaterial({
      map: this.textures.gatlingDome,
      color: 0xf6fbff,
      emissive: 0x3b6088,
      emissiveIntensity: 0.36,
      roughness: 0.22,
      metalness: 0.08,
    });

    this.materials.gunmetalDark = new THREE.MeshStandardMaterial({
      color: 0x384454,
      emissive: 0x0e141d,
      emissiveIntensity: 0.20,
      roughness: 0.38,
      metalness: 0.16,
    });

    this.materials.gunmetalMid = new THREE.MeshStandardMaterial({
      color: 0x687e99,
      emissive: 0x1a2636,
      emissiveIntensity: 0.24,
      roughness: 0.30,
      metalness: 0.14,
    });

    this.materials.steelSilver = new THREE.MeshStandardMaterial({
      color: 0xe8f2fc,
      emissive: 0x2c3c4f,
      emissiveIntensity: 0.28,
      roughness: 0.22,
      metalness: 0.12,
    });

    this.materials.brassGold = new THREE.MeshStandardMaterial({
      color: 0xf2ba42,
      emissive: 0x4a3000,
      emissiveIntensity: 0.38,
      roughness: 0.25,
      metalness: 0.24,
    });

    this.materials.gooCarapace = new THREE.MeshStandardMaterial({
      map: this.textures.gooCarapace,
      emissive: 0x1b4d08,
      emissiveIntensity: 0.24,
      roughness: 0.24,
      metalness: 0.08,
    });

    this.materials.gooSlimeGlow = new THREE.MeshStandardMaterial({
      color: 0x80ff33,
      emissive: 0x48d612,
      emissiveIntensity: 0.72,
      roughness: 0.16,
      metalness: 0.04,
    });

    this.materials.gooCobaltShell = new THREE.MeshStandardMaterial({
      color: 0x5c92e8,
      emissive: 0x183468,
      emissiveIntensity: 0.28,
      roughness: 0.26,
      metalness: 0.14,
    });

    this.materials.missileRed = new THREE.MeshStandardMaterial({
      color: 0xf5252c,
      emissive: 0x4a0808,
      emissiveIntensity: 0.32,
      roughness: 0.26,
      metalness: 0.12,
    });

    this.materials.missileBody = new THREE.MeshStandardMaterial({
      color: 0xf2f7fc,
      emissive: 0x2e3b4a,
      emissiveIntensity: 0.28,
      roughness: 0.22,
      metalness: 0.12,
    });

    this.materials.hazardTrim = new THREE.MeshStandardMaterial({
      map: this.textures.hazardStripes,
      roughness: 0.42,
      metalness: 0.12,
    });

    this.materials.teslaCobalt = new THREE.MeshStandardMaterial({
      color: 0x2962bd,
      emissive: 0x0d2859,
      emissiveIntensity: 0.38,
      roughness: 0.28,
      metalness: 0.18,
    });

    this.materials.teslaHornGlow = new THREE.MeshStandardMaterial({
      color: 0xaaf8ff,
      emissive: 0x00e1ff,
      emissiveIntensity: 0.96,
      roughness: 0.14,
      metalness: 0.12,
    });

    this.materials.teslaCoreWhite = new THREE.MeshBasicMaterial({
      color: 0xf2ffff,
    });

    // Enemy shared materials
    this.materials.gruntRed = new THREE.MeshStandardMaterial({
      color: 0xd9232a,
      roughness: 0.55,
      metalness: 0.08,
    });
    this.materials.gruntHelmet = new THREE.MeshStandardMaterial({
      color: 0x3c3733,
      roughness: 0.45,
      metalness: 0.25,
    });
    this.materials.gruntSkin = new THREE.MeshStandardMaterial({
      color: 0xf2b88c,
      roughness: 0.6,
      metalness: 0.05,
    });
    this.materials.gruntBoots = new THREE.MeshStandardMaterial({
      color: 0x242629,
      roughness: 0.65,
      metalness: 0.15,
    });
    this.materials.bikerLime = new THREE.MeshStandardMaterial({
      color: 0x8be026,
      emissive: 0x1c3600,
      emissiveIntensity: 0.2,
      roughness: 0.32,
      metalness: 0.35,
    });
    this.materials.oliveArmor = new THREE.MeshStandardMaterial({
      color: 0x56693a,
      roughness: 0.48,
      metalness: 0.35,
    });
    this.materials.oliveDark = new THREE.MeshStandardMaterial({
      color: 0x374524,
      roughness: 0.55,
      metalness: 0.3,
    });
    this.materials.mechBronze = new THREE.MeshStandardMaterial({
      color: 0xba8732,
      roughness: 0.36,
      metalness: 0.62,
    });
    this.materials.visorGlow = new THREE.MeshBasicMaterial({
      color: 0xffd026,
    });
    this.materials.zeppelinHull = new THREE.MeshStandardMaterial({
      map: this.textures.zeppelinHull,
      roughness: 0.38,
      metalness: 0.28,
    });

    // Shared VFX materials
    this.materials.muzzleFlash = new THREE.MeshBasicMaterial({
      map: this.textures.muzzleStar,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.materials.lightningOuter = new THREE.MeshBasicMaterial({
      color: 0x0066ff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.materials.lightningMid = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.materials.lightningCore = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });

    // Shared Geometries
    this.geometries.unitQuadXZ = new THREE.PlaneGeometry(1, 1);
    this.geometries.unitQuadXZ.rotateX(-Math.PI / 2);

    this.geometries.unitCircleXZ = new THREE.CircleGeometry(1, 24);
    this.geometries.unitCircleXZ.rotateX(-Math.PI / 2);

    this.geometries.unitRingXZ = new THREE.RingGeometry(0.72, 1.0, 28);
    this.geometries.unitRingXZ.rotateX(-Math.PI / 2);

    this.geometries.sphereLow = new THREE.SphereGeometry(1, 12, 10);
    this.geometries.sphereMed = new THREE.SphereGeometry(1, 18, 14);
    this.geometries.boxUnit = new THREE.BoxGeometry(1, 1, 1);
    this.geometries.cylUnit = new THREE.CylinderGeometry(1, 1, 1, 12);
    this.geometries.coneUnit = new THREE.ConeGeometry(1, 1, 12);
  }

  // ============================================================================
  // 2. HAND-PAINTED PROCEDURAL CANVAS TEXTURES
  // ============================================================================

  _createGrasslandsCanvasTexture() {
    const W = 2048;
    const H = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Coordinate mapping: terrain mesh spans X in [-24, +24] (width 48), Z in [-14, +14] (height 28)
    const worldW = 48.0;
    const worldH = 28.0;
    const toPxX = (wx) => ((wx + worldW * 0.5) / worldW) * W;
    const toPxY = (wz) => ((wz + worldH * 0.5) / worldH) * H;
    const scaleX = W / worldW;
    const scaleY = H / worldH;

    // 1. Base rich yellow-green Argon Towers meadow gradient
    const baseGrad = ctx.createRadialGradient(
      W * 0.48, H * 0.5, W * 0.05,
      W * 0.5, H * 0.5, W * 0.65
    );
    baseGrad.addColorStop(0.0, '#82cd3b');
    baseGrad.addColorStop(0.55, '#72bd2d');
    baseGrad.addColorStop(0.85, '#5ea621');
    baseGrad.addColorStop(1.0, '#447d15');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Subtle organic painterly grass patches (seeded deterministic PRNG)
    let seed = 133742;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 420; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const rx = 28 + rand() * 85;
      const ry = 20 + rand() * 65;
      const bright = rand() > 0.45;
      const g = ctx.createRadialGradient(x, y, 2, x, y, Math.max(rx, ry));
      if (bright) {
        g.addColorStop(0, 'rgba(150, 224, 68, 0.16)');
        g.addColorStop(1, 'rgba(150, 224, 68, 0)');
      } else {
        g.addColorStop(0, 'rgba(80, 148, 24, 0.16)');
        g.addColorStop(1, 'rgba(80, 148, 24, 0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Subtle hand-painted vertical/diagonal lawn brush strokes across the playable field
    ctx.save();
    for (let i = 0; i < 3200; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const len = 8 + rand() * 18;
      const angle = -Math.PI * 0.48 + (rand() - 0.5) * 0.35;
      ctx.strokeStyle = rand() > 0.5
        ? 'rgba(162, 232, 76, 0.18)'
        : 'rgba(78, 142, 22, 0.16)';
      ctx.lineWidth = 1.5 + rand() * 2.0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Helper for authentic Argon Towers concentric-ring sandy dirt patches
    const drawConcentricDirtPatch = (wx, wz, rxWorld, rzWorld, rot = 0, rings = 4, heartSpiral = false) => {
      const cx = toPxX(wx);
      const cy = toPxY(wz);
      const rx = rxWorld * scaleX;
      const ry = rzWorld * scaleY;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);

      // Outer grass-dirt dark olive halo
      ctx.fillStyle = 'rgba(84, 136, 26, 0.55)';
      this._traceWarpedOval(ctx, 0, 0, rx * 1.12, ry * 1.12, wx * 7 + wz * 13);
      ctx.fill();

      const ringColors = [
        { fill: '#be924b', stroke: '#9e7332' },
        { fill: '#cca25c', stroke: '#ad823e' },
        { fill: '#d8b26e', stroke: '#b88e4c' },
        { fill: '#e2c180', stroke: '#c29856' },
      ];

      for (let r = 0; r < rings; r++) {
        const frac = 1.0 - r * (0.68 / rings);
        const col = ringColors[Math.min(r, ringColors.length - 1)];
        ctx.fillStyle = col.fill;
        ctx.strokeStyle = col.stroke;
        ctx.lineWidth = 2.2;
        this._traceWarpedOval(ctx, r * 2.5, -r * 1.5, rx * frac, ry * frac, wx * 11 + wz * 19 + r * 5);
        ctx.fill();
        ctx.stroke();
      }

      if (heartSpiral) {
        ctx.strokeStyle = '#ad823e';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 3.2; a += 0.15) {
          const sr = (a / (Math.PI * 3.2)) * Math.min(rx, ry) * 0.35;
          const sx = Math.cos(a) * sr;
          const sy = Math.sin(a) * sr;
          if (a === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    // 5. Paint the exact worn dirt patches from the reference screenshots:
    // Upper-Right oval dirt patch (ref_paused_midgame.jpg)
    drawConcentricDirtPatch(11.6, -4.6, 2.55, 2.15, -0.2, 4, true);
    // Center-Right dirt patch
    drawConcentricDirtPatch(6.3, -2.5, 1.85, 1.35, 0.15, 3, false);
    // Lower-Center dual-lobed dirt patch
    drawConcentricDirtPatch(-0.5, 4.1, 2.2, 1.65, 0.25, 4, false);
    drawConcentricDirtPatch(0.7, 5.2, 1.55, 1.25, -0.3, 3, true);
    // Lower-Right dirt patch (under missile towers in ref_paused_midgame & ref_early_tesla_zoom)
    drawConcentricDirtPatch(7.4, 4.7, 2.5, 1.85, 0.08, 4, false);
    // North wall start dirt patch with root curls (top-center-left in ref_paused_midgame.jpg)
    drawConcentricDirtPatch(-1.6, -9.2, 2.7, 1.35, 0.05, 3, false);
    // South wall start dirt patch
    drawConcentricDirtPatch(-1.8, 9.3, 2.2, 1.1, -0.05, 3, false);

    // 6. West Entry Dirt Road & Apron (X = -24 to -14.2, Z = -2.4 to +2.4)
    drawConcentricDirtPatch(-19.5, 0.0, 5.2, 2.65, 0.0, 4, false);
    drawConcentricDirtPatch(-16.2, 0.15, 2.6, 2.25, 0.12, 4, false);

    // 7. East Exit Dirt Apron & Concrete Wall Border Dirt Strip
    // Dirt strip running along base of North wall, East wall, and South wall
    ctx.save();
    // North wall dirt lip (X = -2.5 to +19.0, Z = -10.5 to -9.0)
    const nwX0 = toPxX(-2.5);
    const nwX1 = toPxX(19.2);
    const nwY0 = toPxY(-10.8);
    const nwY1 = toPxY(-8.9);
    const nwGrad = ctx.createLinearGradient(0, nwY0, 0, nwY1);
    nwGrad.addColorStop(0, '#b58842');
    nwGrad.addColorStop(0.65, '#cfa35c');
    nwGrad.addColorStop(1, 'rgba(207, 163, 92, 0)');
    ctx.fillStyle = nwGrad;
    ctx.fillRect(nwX0, nwY0, nwX1 - nwX0, nwY1 - nwY0);

    // South wall dirt lip (X = -2.5 to +19.0, Z = +8.9 to +10.8)
    const swY0 = toPxY(8.9);
    const swY1 = toPxY(10.8);
    const swGrad = ctx.createLinearGradient(0, swY1, 0, swY0);
    swGrad.addColorStop(0, '#b58842');
    swGrad.addColorStop(0.65, '#cfa35c');
    swGrad.addColorStop(1, 'rgba(207, 163, 92, 0)');
    ctx.fillStyle = swGrad;
    ctx.fillRect(nwX0, swY0, nwX1 - nwX0, swY1 - swY0);

    // East wall dirt apron (X = +15.8 to +20.5, Z = -10.4 to +10.4)
    const ewX0 = toPxX(15.6);
    const ewX1 = toPxX(21.0);
    const ewGrad = ctx.createLinearGradient(ewX1, 0, ewX0, 0);
    ewGrad.addColorStop(0, '#b88b44');
    ewGrad.addColorStop(0.6, '#d4ab65');
    ewGrad.addColorStop(1, 'rgba(212, 171, 101, 0)');
    ctx.fillStyle = ewGrad;
    ctx.fillRect(ewX0, toPxY(-10.4), ewX1 - ewX0, toPxY(10.4) - toPxY(-10.4));
    ctx.restore();

    // East Exit funnel concentric dirt apron (X = +16.8, Z = 0.0)
    drawConcentricDirtPatch(17.4, 0.0, 2.7, 2.55, 0.0, 4, false);

    // 8. Iconic Curling Brown Vine / Root Scrollwork on the West Entry Dirt Path & Tree Borders!
    const drawCurlingVine = (startWX, startWZ, ctrl1WX, ctrl1WZ, endWX, endWZ, curlDir = 1, thickness = 4.5) => {
      const sx = toPxX(startWX);
      const sy = toPxY(startWZ);
      const c1x = toPxX(ctrl1WX);
      const c1y = toPxY(ctrl1WZ);
      const ex = toPxX(endWX);
      const ey = toPxY(endWZ);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Soft warm highlight halo
      ctx.strokeStyle = 'rgba(235, 200, 138, 0.45)';
      ctx.lineWidth = thickness + 3.0;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(c1x, c1y, ex, ey);
      ctx.stroke();

      // Main dark brown root/vine stroke
      ctx.strokeStyle = '#633915';
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(c1x, c1y, ex, ey);

      // Spiral curl at tip
      const tangentAngle = Math.atan2(ey - c1y, ex - c1x);
      let curX = ex;
      let curY = ey;
      let curA = tangentAngle;
      let stepR = 12.0;
      for (let i = 0; i < 16; i++) {
        curA += curlDir * 0.36;
        stepR *= 0.88;
        curX += Math.cos(curA) * stepR * 0.42;
        curY += Math.sin(curA) * stepR * 0.42;
        ctx.lineTo(curX, curY);
      }
      ctx.stroke();
      ctx.restore();
    };

    // West entry road decorative vine scrollwork (matching ref_paused_midgame.jpg & ref_early_tesla_zoom.png)
    drawCurlingVine(-20.8, -1.5, -18.2, -1.2, -16.2, -0.5, 1, 4.2);
    drawCurlingVine(-19.5, -0.3, -17.4, -0.9, -15.4, -1.3, -1, 3.6);
    drawCurlingVine(-20.6, 1.5, -18.0, 1.3, -15.8, 0.6, -1, 4.2);
    drawCurlingVine(-19.2, 0.5, -17.3, 1.2, -16.4, 1.65, 1, 3.5);
    drawCurlingVine(-18.2, 2.2, -17.2, 1.1, -16.8, 0.2, -1, 3.2);
    // North wall start root curls
    drawCurlingVine(-2.8, -10.2, -2.1, -9.1, -1.4, -8.5, 1, 3.5);
    drawCurlingVine(-1.4, -10.2, -1.0, -9.2, -0.4, -8.7, -1, 3.2);

    // 9. Hand-painted small field stones / pebbles & tiny flowers
    const drawPebbleCluster = (wx, wz) => {
      const px = toPxX(wx);
      const py = toPxY(wz);
      const offsets = [
        { dx: 0, dy: 0, rx: 9, ry: 7, c: '#7a7d68' },
        { dx: 11, dy: 5, rx: 6, ry: 5, c: '#8e917b' },
        { dx: -8, dy: 6, rx: 5, ry: 4, c: '#686b57' },
      ];
      offsets.forEach((o) => {
        ctx.fillStyle = 'rgba(35, 55, 12, 0.45)';
        ctx.beginPath();
        ctx.ellipse(px + o.dx + 2, py + o.dy + 3, o.rx, o.ry, 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = o.c;
        ctx.strokeStyle = '#3f4234';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(px + o.dx, py + o.dy, o.rx, o.ry, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    };

    drawPebbleCluster(-9.5, -4.4);
    drawPebbleCluster(1.8, 3.5);
    drawPebbleCluster(-6.8, 6.2);

    // Tiny red/yellow wildflowers near the tree borders
    const flowerCoords = [
      [-15.2, -8.4, '#ff3b3b'],
      [-12.4, -8.8, '#ffdd3b'],
      [-8.5, -9.1, '#ff4747'],
      [-16.8, -3.4, '#ff4747'],
      [-16.5, 3.6, '#ffdd3b'],
      [-14.2, 8.6, '#ff4747'],
    ];
    flowerCoords.forEach(([fx, fz, col]) => {
      const px = toPxX(fx);
      const py = toPxY(fz);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff59d';
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 10. Soft forest canopy border ambient shadow along West, NW, SW edges
    const drawBorderShadow = (wx, wz, rWorld) => {
      const px = toPxX(wx);
      const py = toPxY(wz);
      const r = rWorld * scaleX;
      const g = ctx.createRadialGradient(px, py, r * 0.2, px, py, r);
      g.addColorStop(0, 'rgba(22, 48, 8, 0.45)');
      g.addColorStop(1, 'rgba(22, 48, 8, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (let x = -22; x <= -4; x += 3.0) {
      drawBorderShadow(x, -10.8, 3.2);
      drawBorderShadow(x, 10.8, 3.2);
    }
    for (let z = -9; z <= 9; z += 3.0) {
      if (Math.abs(z) > 2.2) {
        drawBorderShadow(-18.8, z, 2.8);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return applySRGB(tex);
  }

  _traceWarpedOval(ctx, cx, cy, rx, ry, phase = 0) {
    ctx.beginPath();
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const warp = 1.0
        + 0.06 * Math.sin(a * 3 + phase)
        + 0.04 * Math.cos(a * 5 - phase * 0.7);
      const x = cx + Math.cos(a) * rx * warp;
      const y = cy + Math.sin(a) * ry * warp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /**
   * Iconic Argon Towers Concentric-Ring Scalloped Cartoon Tree Canopy Texture
   * Matches the concentric rings of forest green (#235e14), emerald (#479c21),
   * lime (#76cc2f), and bright chartreuse highlight (#9be846) in the reference images.
   */
  _createTreeCanopyTexture() {
    const S = 512;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    const cx = S * 0.5;
    const cy = S * 0.5;

    // Base dark forest green fill
    ctx.fillStyle = '#1d5210';
    ctx.fillRect(0, 0, S, S);

    const drawScallopedRing = (ox, oy, radius, lobes, amp, fillStyle, strokeStyle) => {
      ctx.beginPath();
      const steps = 120;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const scallop = 1.0 + amp * Math.abs(Math.cos(a * lobes * 0.5));
        const r = radius * scallop;
        const x = ox + Math.cos(a) * r;
        const y = oy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 4.0;
        ctx.stroke();
      }
    };

    // Ring 1 (Outer scalloped dark-forest rim)
    drawScallopedRing(cx, cy, S * 0.45, 14, 0.045, '#256614', '#16400b');
    // Ring 2 (Rich mid-forest green)
    drawScallopedRing(cx - 8, cy - 8, S * 0.37, 12, 0.04, '#38851c', '#235910');
    // Ring 3 (Vibrant emerald green)
    drawScallopedRing(cx - 16, cy - 16, S * 0.285, 10, 0.038, '#52ab26', '#337517');
    // Ring 4 (Bright lime green)
    drawScallopedRing(cx - 24, cy - 24, S * 0.195, 8, 0.032, '#74cc33', '#4e9c21');
    // Ring 5 (Sunny chartreuse-lime crown highlight)
    drawScallopedRing(cx - 32, cy - 32, S * 0.105, 6, 0.025, '#9ce848', '#6ec22b');

    // Bright center specular dot
    ctx.fillStyle = 'rgba(196, 255, 110, 0.55)';
    ctx.beginPath();
    ctx.arc(cx - 38, cy - 38, S * 0.045, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  _createTreeBarkTexture() {
    const W = 256;
    const H = 256;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0.0, '#4d290e');
    g.addColorStop(0.35, '#8a5022');
    g.addColorStop(0.7, '#6e3d18');
    g.addColorStop(1.0, '#3d1f09');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Vertical bark ridges
    ctx.strokeStyle = 'rgba(42, 20, 5, 0.55)';
    ctx.lineWidth = 3;
    for (let x = 12; x < W; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 8, H * 0.33, x - 8, H * 0.66, x + 3, H);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  /**
   * Iconic Glossy Metallic Ice-Blue / Silver Gatling Dome Texture
   * Matches the rounded ice-blue/silver domes in ref_early_tesla_zoom.png & ref_round89_dense_maze.png.
   */
  _createGatlingDomeTexture() {
    const S = 512;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    const cx = S * 0.5;
    const cy = S * 0.5;

    // Luminous pearlescent ice-blue / silver radial gradient matching ref_round89_dense_maze.png
    const grad = ctx.createRadialGradient(
      cx - S * 0.14, cy - S * 0.14, S * 0.04,
      cx, cy, S * 0.49
    );
    grad.addColorStop(0.0, '#ffffff');
    grad.addColorStop(0.28, '#f0f9ff');
    grad.addColorStop(0.56, '#c2e2ff');
    grad.addColorStop(0.82, '#86b8e6');
    grad.addColorStop(1.0, '#4f7ea8');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);

    // Bright cartoon specular oval highlight on top-left crown
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.ellipse(cx - S * 0.13, cy - S * 0.13, S * 0.14, S * 0.09, -0.55, 0, Math.PI * 2);
    ctx.fill();

    // Subtle armor seam ring & rivets
    ctx.strokeStyle = 'rgba(46, 78, 112, 0.42)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.36, 0, Math.PI * 2);
    ctx.stroke();

    // Rivet dots around perimeter
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rx = cx + Math.cos(a) * (S * 0.41);
      const ry = cy + Math.sin(a) * (S * 0.41);
      ctx.fillStyle = '#385c82';
      ctx.beginPath();
      ctx.arc(rx, ry, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2faff';
      ctx.beginPath();
      ctx.arc(rx - 1.5, ry - 1.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  /**
   * Iconic Segmented Neon-Green & Cobalt-Blue Goo Bio-Carapace Texture
   */
  _createGooCarapaceTexture() {
    const S = 512;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // Base vibrant neon-lime gradient
    const g = ctx.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0.0, '#2a8510');
    g.addColorStop(0.2, '#62e629');
    g.addColorStop(0.5, '#a8ff66');
    g.addColorStop(0.8, '#62e629');
    g.addColorStop(1.0, '#2a8510');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Transverse bright cream-green ribs across the abdomen
    for (let y = 32; y < S; y += 56) {
      ctx.fillStyle = 'rgba(230, 255, 195, 0.78)';
      ctx.fillRect(0, y, S, 16);
      ctx.fillStyle = 'rgba(28, 92, 10, 0.65)';
      ctx.fillRect(0, y + 16, S, 8);
    }

    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  _createHazardStripeTexture() {
    const W = 256;
    const H = 64;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f5b800';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1c1e22';
    const stripeW = 24;
    for (let x = -H; x < W + H; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW - H * 0.7, H);
      ctx.lineTo(x - H * 0.7, H);
      ctx.closePath();
      ctx.fill();
    }

    // Metallic border trim top & bottom
    ctx.fillStyle = '#4a4e54';
    ctx.fillRect(0, 0, W, 5);
    ctx.fillRect(0, H - 5, W, 5);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return applySRGB(tex);
  }

  _createBullseyeTexture() {
    const S = 256;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    const cx = S * 0.5;
    const cy = S * 0.5;

    // Outer dark iron rim
    ctx.fillStyle = '#1b1d20';
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.48, 0, Math.PI * 2);
    ctx.fill();

    // Bright yellow outer target ring
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.40, 0, Math.PI * 2);
    ctx.fill();

    // Black middle ring
    ctx.fillStyle = '#1b1d20';
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Bright yellow bullseye center
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.11, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  _createExitTrenchTexture() {
    const W = 256;
    const H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Dark recessed steel trench floor
    ctx.fillStyle = '#383e45';
    ctx.fillRect(0, 0, W, H);

    // Subtle horizontal grating lines
    ctx.strokeStyle = 'rgba(24, 28, 33, 0.65)';
    ctx.lineWidth = 3;
    for (let y = 16; y < H; y += 20) {
      ctx.beginPath();
      ctx.moveTo(14, y);
      ctx.lineTo(W - 14, y);
      ctx.stroke();
    }

    // Beveled metallic frame border
    ctx.strokeStyle = '#6f7882';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, W - 10, H - 10);

    // Iconic bright yellow chevron arrow (◀) on the right side (matching ref_paused_midgame.jpg)
    ctx.fillStyle = '#ffcc00';
    ctx.strokeStyle = '#2b2200';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W * 0.86, H * 0.34);
    ctx.lineTo(W * 0.38, H * 0.50);
    ctx.lineTo(W * 0.86, H * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  _createZeppelinSharkTexture() {
    const W = 1024;
    const H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Crimson & dark steel dirigible panels
    ctx.fillStyle = '#b81d24';
    ctx.fillRect(0, 0, W, H);

    // Longitudinal dark steel & gold ribs
    for (let y = 0; y < H; y += 64) {
      ctx.fillStyle = 'rgba(30, 35, 42, 0.38)';
      ctx.fillRect(0, y, W, 10);
      ctx.fillStyle = 'rgba(240, 190, 60, 0.45)';
      ctx.fillRect(0, y + 10, W, 4);
    }

    // Gold vertical hull bands
    ctx.fillStyle = '#d9a12b';
    ctx.fillRect(W * 0.28, 0, 18, H);
    ctx.fillRect(W * 0.68, 0, 18, H);

    // Ferocious cartoon shark-mouth grin near the nosecone (top/right of UV)
    const drawSharkSide = (cy) => {
      // Mouth interior
      ctx.fillStyle = '#1a0505';
      ctx.beginPath();
      ctx.ellipse(W * 0.80, cy, 95, 42, 0, 0, Math.PI * 2);
      ctx.fill();

      // White jagged teeth
      ctx.fillStyle = '#ffffff';
      for (let i = -4; i <= 4; i++) {
        const tx = W * 0.80 + i * 18;
        // Upper tooth
        ctx.beginPath();
        ctx.moveTo(tx - 8, cy - 28);
        ctx.lineTo(tx, cy - 4);
        ctx.lineTo(tx + 8, cy - 28);
        ctx.closePath();
        ctx.fill();
        // Lower tooth
        ctx.beginPath();
        ctx.moveTo(tx - 8, cy + 28);
        ctx.lineTo(tx, cy + 6);
        ctx.lineTo(tx + 8, cy + 28);
        ctx.closePath();
        ctx.fill();
      }

      // Angry cartoon eye
      ctx.fillStyle = '#ffdd33';
      ctx.beginPath();
      ctx.arc(W * 0.84, cy - 52, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(W * 0.85, cy - 52, 9, 0, Math.PI * 2);
      ctx.fill();
      // Angry brow slash
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(W * 0.81, cy - 72);
      ctx.lineTo(W * 0.88, cy - 58);
      ctx.stroke();
    };

    drawSharkSide(H * 0.25);
    drawSharkSide(H * 0.75);

    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  _createSoftShadowTexture() {
    const S = 128;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.08, S * 0.5, S * 0.5, S * 0.48);
    g.addColorStop(0.0, 'rgba(12, 22, 6, 0.78)');
    g.addColorStop(0.65, 'rgba(12, 22, 6, 0.35)');
    g.addColorStop(1.0, 'rgba(12, 22, 6, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  _createCraterDecalTexture() {
    const S = 256;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    const cx = S * 0.5;
    const cy = S * 0.5;

    // Soft warm earthy-brown soot smudge matching ref_round89_dense_maze.png
    const g = ctx.createRadialGradient(cx, cy, S * 0.04, cx, cy, S * 0.44);
    g.addColorStop(0.0, 'rgba(54, 42, 28, 0.72)');
    g.addColorStop(0.42, 'rgba(68, 52, 34, 0.45)');
    g.addColorStop(0.75, 'rgba(84, 65, 42, 0.16)');
    g.addColorStop(1.0, 'rgba(84, 65, 42, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.44, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  _createGooDecalTexture() {
    const S = 256;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    const cx = S * 0.5;
    const cy = S * 0.5;

    // Bubbly cartoon green slime splat
    ctx.fillStyle = '#38b814';
    ctx.beginPath();
    const lobes = 9;
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const r = S * (0.33 + 0.08 * Math.sin(a * lobes) + 0.04 * Math.cos(a * 4));
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Bright neon inner slime pool
    ctx.fillStyle = '#7bff38';
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 6, S * 0.24, 0, Math.PI * 2);
    ctx.fill();

    // Glossy white slime bubble highlights
    const bubbles = [
      [-28, -22, 14],
      [24, -14, 10],
      [-10, 26, 12],
      [32, 22, 7],
    ];
    bubbles.forEach(([bx, by, br]) => {
      ctx.fillStyle = '#bfff80';
      ctx.beginPath();
      ctx.arc(cx + bx, cy + by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + bx - br * 0.3, cy + by - br * 0.3, br * 0.35, 0, Math.PI * 2);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  _createMuzzleStarTexture() {
    const S = 128;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    const cx = S * 0.5;
    const cy = S * 0.5;

    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, S * 0.48);
    g.addColorStop(0.0, '#ffffff');
    g.addColorStop(0.35, '#fff176');
    g.addColorStop(0.7, '#ff9800');
    g.addColorStop(1.0, 'rgba(255, 87, 34, 0)');

    ctx.fillStyle = g;
    ctx.beginPath();
    const spikes = 8;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = (i % 2 === 0) ? S * 0.48 : S * 0.18;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  _createSmokePuffTexture() {
    const S = 128;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    const cx = S * 0.5;
    const cy = S * 0.5;
    const g = ctx.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, S * 0.46);
    g.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
    g.addColorStop(0.55, 'rgba(220, 226, 232, 0.75)');
    g.addColorStop(0.85, 'rgba(160, 168, 176, 0.25)');
    g.addColorStop(1.0, 'rgba(160, 168, 176, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const tex = new THREE.CanvasTexture(canvas);
    return applySRGB(tex);
  }

  // ============================================================================
  // 3. GRASSLANDS ENVIRONMENT BUILDER (`buildEnvironment()`)
  // ============================================================================

  buildEnvironment() {
    if (!THREE || !this.environmentGroup) return null;
    this._initSharedAssets();

    // Clear any previous environment children
    while (this.environmentGroup.children.length > 0) {
      this.environmentGroup.remove(this.environmentGroup.children[0]);
    }

    // Ensure scene has crisp warm sunlight + sky/grass hemisphere lighting if not yet added
    this._ensureSceneLighting();

    // 1. Hand-Painted Grasslands Battlefield Ground Plane (48 x 28 world units)
    const groundGeo = new THREE.PlaneGeometry(48.0, 28.0, 1, 1);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.textures.grasslands,
      roughness: 0.88,
      metalness: 0.02,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, 0, 0);
    groundMesh.receiveShadow = true;
    groundMesh.name = 'GrasslandsGround';
    this.environmentGroup.add(groundMesh);

    // Outer dark framing skirt beyond the 48x28 map so camera edges never show void
    const skirtGeo = new THREE.PlaneGeometry(90, 60);
    skirtGeo.rotateX(-Math.PI / 2);
    const skirtMat = new THREE.MeshBasicMaterial({ color: 0x1a3b0b });
    const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    skirtMesh.position.set(0, -0.05, 0);
    this.environmentGroup.add(skirtMesh);

    // 2. Top (North) & Bottom (South) Industrial Concrete Retaining Walls + Crimson Buttresses
    this._buildNorthAndSouthWalls();

    // 3. Right (East) Exit Concrete Bunker Walls, Chevron Threshold & Bullseye Target Sign
    this._buildEastExitBunkerAndSign();

    // 4. Whimsical Sculpted Cartoon Forest Trees (West, North-West & South-West Borders)
    this._buildGrasslandsForestBorders();

    return this.environmentGroup;
  }

  _ensureSceneLighting() {
    if (!this.scene || !THREE) return;
    let hasDirLight = false;
    this.scene.traverse((obj) => {
      if (obj.isDirectionalLight) hasDirLight = true;
    });
    if (!hasDirLight) {
      const hemi = new THREE.HemisphereLight(0xf4ffde, 0x3d6e18, 0.85);
      hemi.position.set(0, 25, 0);
      this.scene.add(hemi);

      const sun = new THREE.DirectionalLight(0xfff7e0, 1.15);
      sun.position.set(-12, 26, -10);
      this.scene.add(sun);
    }
  }

  _buildNorthAndSouthWalls() {
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x62696e,
      roughness: 0.78,
      metalness: 0.18,
    });
    const copingLightMat = new THREE.MeshStandardMaterial({
      color: 0x9aa3ab,
      roughness: 0.62,
      metalness: 0.22,
    });
    const darkSeamMat = new THREE.MeshStandardMaterial({
      color: 0x2d3136,
      roughness: 0.85,
      metalness: 0.2,
    });
    const crimsonButtressMat = new THREE.MeshStandardMaterial({
      color: 0xc41e24,
      emissive: 0x2a0305,
      emissiveIntensity: 0.22,
      roughness: 0.38,
      metalness: 0.35,
    });

    // Helper for angled crimson military buttress with yellow-and-black hazard stripe base
    const createCrimsonButtress = (x, z, facingSignZ = 1, rotY = 0) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;

      // Sloped crimson steel wedge body
      const bodyGeo = new THREE.BoxGeometry(1.35, 1.85, 1.45);
      const body = new THREE.Mesh(bodyGeo, crimsonButtressMat);
      body.position.set(0, 0.85, facingSignZ * 0.25);
      body.rotation.x = facingSignZ * 0.28;
      g.add(body);

      // Top dark steel cap plate
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.22, 0.95), darkSeamMat);
      cap.position.set(0, 1.72, -facingSignZ * 0.1);
      g.add(cap);

      // Side metallic flange ribs
      for (const sx of [-0.62, 0.62]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.75, 1.5), crimsonButtressMat);
        rib.position.set(sx, 0.85, facingSignZ * 0.28);
        rib.rotation.x = facingSignZ * 0.28;
        g.add(rib);
      }

      // Yellow-and-black hazard stripe bumper along the base!
      const hazardBase = new THREE.Mesh(
        new THREE.BoxGeometry(1.48, 0.34, 0.42),
        this.materials.hazardTrim
      );
      hazardBase.position.set(0, 0.18, facingSignZ * 0.92);
      g.add(hazardBase);

      return g;
    };

    // --- NORTH RETAINING WALL (X = -3.2 to +19.5, Z = -10.9) ---
    const northWallGroup = new THREE.Group();
    const wallLen = 22.8;
    const wallCenterX = -3.2 + wallLen * 0.5;

    // Main concrete wall block
    const nWall = new THREE.Mesh(new THREE.BoxGeometry(wallLen, 1.65, 1.35), concreteMat);
    nWall.position.set(wallCenterX, 0.82, -11.05);
    northWallGroup.add(nWall);

    // Beveled light-grey top concrete coping
    const nCoping = new THREE.Mesh(new THREE.BoxGeometry(wallLen, 0.28, 1.52), copingLightMat);
    nCoping.position.set(wallCenterX, 1.68, -11.05);
    northWallGroup.add(nCoping);

    // Angled West concrete wing wall (X = -3.2 to -5.1, angling toward North-West trees)
    const nWing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.55, 1.15), copingLightMat);
    nWing.position.set(-4.1, 0.77, -10.55);
    nWing.rotation.y = 0.48;
    northWallGroup.add(nWing);

    // Concrete expansion joints / crack lines
    for (const cx of [-0.5, 5.8, 11.8, 16.5]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.72, 1.56), darkSeamMat);
      seam.position.set(cx, 0.85, -11.05);
      northWallGroup.add(seam);
    }

    // Industrial pipe & hatch detail on North-East wall section (X = +14.0 to +17.2)
    const hatchPanel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.95, 0.18), darkSeamMat);
    hatchPanel.position.set(15.2, 0.72, -10.32);
    northWallGroup.add(hatchPanel);

    const pipeHoriz = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.8, 10), this.materials.gunmetalMid);
    pipeHoriz.rotation.z = Math.PI / 2;
    pipeHoriz.position.set(15.3, 0.78, -10.18);
    northWallGroup.add(pipeHoriz);

    // Two North Crimson Buttresses (X = +2.8 and X = +9.2, matching ref_paused_midgame.jpg)
    northWallGroup.add(createCrimsonButtress(2.8, -10.55, 1, 0));
    northWallGroup.add(createCrimsonButtress(9.2, -10.55, 1, 0));

    this.environmentGroup.add(northWallGroup);

    // --- SOUTH RETAINING WALL (X = -3.2 to +19.5, Z = +10.9) ---
    const southWallGroup = new THREE.Group();
    const sWall = new THREE.Mesh(new THREE.BoxGeometry(wallLen, 1.65, 1.35), concreteMat);
    sWall.position.set(wallCenterX, 0.82, 11.05);
    southWallGroup.add(sWall);

    const sCoping = new THREE.Mesh(new THREE.BoxGeometry(wallLen, 0.28, 1.52), copingLightMat);
    sCoping.position.set(wallCenterX, 1.68, 11.05);
    southWallGroup.add(sCoping);

    // Angled South-West concrete wing wall
    const sWing = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.55, 1.15), copingLightMat);
    sWing.position.set(-4.2, 0.77, 10.55);
    sWing.rotation.y = -0.45;
    southWallGroup.add(sWing);

    for (const cx of [0.2, 6.2, 12.6, 16.8]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.72, 1.56), darkSeamMat);
      seam.position.set(cx, 0.85, 11.05);
      southWallGroup.add(seam);
    }

    // Two South Crimson Buttresses (X = +2.8 and X = +9.8)
    southWallGroup.add(createCrimsonButtress(2.8, 10.55, -1, 0));
    southWallGroup.add(createCrimsonButtress(9.8, 10.55, -1, 0));

    this.environmentGroup.add(southWallGroup);

    // Save helper for East wall buttresses
    this._createCrimsonButtress = createCrimsonButtress;
  }

  _buildEastExitBunkerAndSign() {
    const bunkerGroup = new THREE.Group();

    const bunkerWallMat = new THREE.MeshStandardMaterial({
      color: 0x555c63,
      roughness: 0.72,
      metalness: 0.25,
    });
    const roofDeckMat = new THREE.MeshStandardMaterial({
      color: 0x3b4147,
      roughness: 0.65,
      metalness: 0.38,
    });
    const trimLightMat = new THREE.MeshStandardMaterial({
      color: 0x8d969e,
      roughness: 0.55,
      metalness: 0.28,
    });

    // Upper East Bunker Wall (Z = -11.5 to -2.1, X = +18.8 to +22.5)
    const upperLenZ = 9.4;
    const upperCenterZ = -2.1 - upperLenZ * 0.5;
    const upperBunker = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.75, upperLenZ), bunkerWallMat);
    upperBunker.position.set(20.4, 0.87, upperCenterZ);
    bunkerGroup.add(upperBunker);

    const upperRoof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, upperLenZ - 0.3), roofDeckMat);
    upperRoof.position.set(20.5, 1.82, upperCenterZ);
    bunkerGroup.add(upperRoof);

    const upperLip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.85, upperLenZ + 0.1), trimLightMat);
    upperLip.position.set(18.65, 0.92, upperCenterZ);
    bunkerGroup.add(upperLip);

    // Lower East Bunker Wall (Z = +2.1 to +11.5, X = +18.8 to +22.5)
    const lowerCenterZ = 2.1 + upperLenZ * 0.5;
    const lowerBunker = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.75, upperLenZ), bunkerWallMat);
    lowerBunker.position.set(20.4, 0.87, lowerCenterZ);
    bunkerGroup.add(lowerBunker);

    const lowerRoof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, upperLenZ - 0.3), roofDeckMat);
    lowerRoof.position.set(20.5, 1.82, lowerCenterZ);
    bunkerGroup.add(lowerRoof);

    const lowerLip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.85, upperLenZ + 0.1), trimLightMat);
    lowerLip.position.set(18.65, 0.92, lowerCenterZ);
    bunkerGroup.add(lowerLip);

    // 4 Angled Crimson-Red Buttresses along the East Wall (facing West `-X`)
    if (this._createCrimsonButtress) {
      bunkerGroup.add(this._createCrimsonButtress(18.35, -8.3, 1, -Math.PI / 2));
      bunkerGroup.add(this._createCrimsonButtress(18.35, -3.1, 1, -Math.PI / 2));
      bunkerGroup.add(this._createCrimsonButtress(18.35, 3.1, 1, -Math.PI / 2));
      bunkerGroup.add(this._createCrimsonButtress(18.35, 8.3, 1, -Math.PI / 2));
    }

    // East Exit Threshold Plate & Yellow Chevron (`X = +19.2, Z = 0.0`, spanning `Z = -2.1..+2.1`)
    const trenchGeo = new THREE.PlaneGeometry(2.6, 4.2);
    trenchGeo.rotateX(-Math.PI / 2);
    const trenchMat = new THREE.MeshStandardMaterial({
      map: this.textures.exitTrench,
      roughness: 0.55,
      metalness: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const trenchPlate = new THREE.Mesh(trenchGeo, trenchMat);
    trenchPlate.position.set(19.35, 0.03, 0.0);
    bunkerGroup.add(trenchPlate);

    // Iconic Yellow-and-Black Concentric Bullseye Target Sign (`O`) at `(X = +17.75, Z = -2.25)`
    const signGroup = new THREE.Group();
    signGroup.position.set(17.75, 0.0, -2.25);

    // Dark iron post tilted slightly
    const postMat = new THREE.MeshStandardMaterial({ color: 0x26221e, roughness: 0.6, metalness: 0.5 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.45, 8), postMat);
    post.position.set(0, 0.7, 0);
    post.rotation.z = 0.08;
    signGroup.add(post);

    // Disc sign tilted toward camera so the bullseye rings read clearly
    const discGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 24);
    discGeo.rotateX(Math.PI / 2);
    const discMat = new THREE.MeshStandardMaterial({
      map: this.textures.bullseye,
      roughness: 0.35,
      metalness: 0.15,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(0.04, 1.48, 0.08);
    disc.rotation.x = -0.55;
    disc.rotation.y = -0.22;
    signGroup.add(disc);

    bunkerGroup.add(signGroup);
    this.environmentGroup.add(bunkerGroup);
  }

  _buildGrasslandsForestBorders() {
    const forestGroup = new THREE.Group();

    const canopyMat = new THREE.MeshStandardMaterial({
      map: this.textures.treeCanopy,
      roughness: 0.72,
      metalness: 0.02,
    });
    const barkMat = new THREE.MeshStandardMaterial({
      map: this.textures.treeBark,
      roughness: 0.85,
      metalness: 0.04,
    });
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x1a0c04 });
    const holeRimMat = new THREE.MeshStandardMaterial({ color: 0x9e5e28, roughness: 0.75 });
    const bushMat = new THREE.MeshStandardMaterial({
      map: this.textures.treeCanopy,
      roughness: 0.76,
      metalness: 0.02,
    });

    // Build custom UV-projected dome/sphere geometry so top-down concentric rings map cleanly!
    const canopyGeo = new THREE.SphereGeometry(1.0, 22, 16);
    const posAttr = canopyGeo.attributes.position;
    const uvAttr = canopyGeo.attributes.uv;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      // Plump flattened cartoon dome shape with gentle 7-lobe scalloped skirt
      const angle = Math.atan2(vz, vx);
      const horizR = Math.hypot(vx, vz);
      const scallop = 1.0 + 0.055 * Math.cos(angle * 7) * horizR;
      posAttr.setX(i, vx * scallop);
      posAttr.setY(i, vy * 0.76 + (vy < 0 ? 0.12 : 0));
      posAttr.setZ(i, vz * scallop);

      // Top-down planar UV projection so concentric green rings are always centered on the crown!
      const u = clamp(0.5 + (vx * scallop) * 0.46, 0.02, 0.98);
      const v = clamp(0.5 + (vz * scallop) * 0.46, 0.02, 0.98);
      uvAttr.setXY(i, u, v);
    }
    canopyGeo.computeVertexNormals();

    const createCartoonTree = (wx, wz, scale = 1.0, hasKnothole = false, knotholeAngle = 0.3) => {
      const tree = new THREE.Group();
      tree.position.set(wx, 0, wz);

      // Soft ground shadow
      const sh = new THREE.Mesh(this.geometries.unitQuadXZ, this.materials.dropShadow);
      sh.scale.set(3.4 * scale, 1, 3.4 * scale);
      sh.position.set(0.25, 0.02, 0.25);
      tree.add(sh);

      // Sculpted brown trunk flaring at the base
      const trunkH = 2.05 * scale;
      const trunkGeo = new THREE.CylinderGeometry(0.34 * scale, 0.56 * scale, trunkH, 10);
      const trunk = new THREE.Mesh(trunkGeo, barkMat);
      trunk.position.set(0, trunkH * 0.48, 0);
      tree.add(trunk);

      // 4 flared curling root buttresses gripping the ground
      for (let r = 0; r < 4; r++) {
        const ra = (r / 4) * Math.PI * 2 + (wx * 0.3);
        const rootGeo = new THREE.ConeGeometry(0.22 * scale, 0.95 * scale, 7);
        const root = new THREE.Mesh(rootGeo, barkMat);
        root.position.set(Math.cos(ra) * 0.48 * scale, 0.22 * scale, Math.sin(ra) * 0.48 * scale);
        root.rotation.z = -Math.cos(ra) * 0.65;
        root.rotation.x = Math.sin(ra) * 0.65;
        tree.add(root);
      }

      // Optional iconic dark hollow knothole on prominent border trunks (like ref_paused_midgame.jpg!)
      if (hasKnothole) {
        const khGroup = new THREE.Group();
        const khDist = 0.44 * scale;
        khGroup.position.set(
          Math.cos(knotholeAngle) * khDist,
          0.95 * scale,
          Math.sin(knotholeAngle) * khDist
        );
        khGroup.rotation.y = -knotholeAngle + Math.PI / 2;

        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22 * scale, 0.06 * scale, 8, 14), holeRimMat);
        rim.scale.set(0.85, 1.25, 1.0);
        khGroup.add(rim);

        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.2 * scale, 12), holeMat);
        hole.scale.set(0.82, 1.2, 1.0);
        hole.position.z = 0.02;
        khGroup.add(hole);

        tree.add(khGroup);
      }

      // Primary plump concentric-ring foliage crown
      const mainCrown = new THREE.Mesh(canopyGeo, canopyMat);
      const crownRadius = 1.65 * scale;
      mainCrown.scale.set(crownRadius, crownRadius, crownRadius);
      mainCrown.position.set(0, trunkH + 0.55 * scale, 0);
      mainCrown.rotation.y = (wx * 1.7 + wz * 0.9) % (Math.PI * 2);
      tree.add(mainCrown);

      // Secondary lower scalloped foliage tier for lush layered Argon Towers volume
      const subCrown = new THREE.Mesh(canopyGeo, canopyMat);
      const subRadius = 1.92 * scale;
      subCrown.scale.set(subRadius, subRadius * 0.72, subRadius);
      subCrown.position.set(0.08 * scale, trunkH + 0.15 * scale, 0.08 * scale);
      subCrown.rotation.y = mainCrown.rotation.y + 0.5;
      tree.add(subCrown);

      return tree;
    };

    // --- 1. WEST ENTRY ROAD FLANKING TREES (with prominent knotholes & roots!) ---
    // Upper-West Entry guardian trees (Z < -2.3)
    forestGroup.add(createCartoonTree(-18.6, -3.1, 1.18, true, 0.45));
    forestGroup.add(createCartoonTree(-18.8, -5.8, 1.25, true, 0.35));
    forestGroup.add(createCartoonTree(-19.5, -8.5, 1.22, false, 0));
    forestGroup.add(createCartoonTree(-21.6, -4.4, 1.32, false, 0));
    forestGroup.add(createCartoonTree(-21.8, -7.4, 1.35, false, 0));

    // Lower-West Entry guardian trees (Z > +2.3)
    forestGroup.add(createCartoonTree(-17.8, 3.3, 1.16, true, -0.35));
    forestGroup.add(createCartoonTree(-19.2, 5.4, 1.24, false, 0));
    forestGroup.add(createCartoonTree(-18.6, 8.2, 1.22, true, -0.25));
    forestGroup.add(createCartoonTree(-21.5, 3.8, 1.30, false, 0));
    forestGroup.add(createCartoonTree(-21.6, 7.0, 1.35, false, 0));

    // --- 2. NORTH-WEST & NORTH WOODS (X = -22 to -4.2, Z = -10.5 to -14.0) ---
    const nwTrees = [
      [-16.4, -10.4, 1.18, true, 1.2],
      [-13.5, -10.6, 1.14, false, 0],
      [-10.4, -10.4, 1.20, true, 1.4],
      [-7.2, -10.5, 1.18, true, 1.3],
      [-4.6, -11.6, 1.12, false, 0],
      [-18.0, -12.6, 1.32, false, 0],
      [-14.8, -12.8, 1.35, false, 0],
      [-11.6, -12.7, 1.30, false, 0],
      [-8.4, -12.8, 1.28, false, 0],
      // Background canopies peeking behind the North concrete wall (matching ref_paused_midgame.jpg)
      [5.5, -13.0, 1.25, false, 0],
      [8.6, -13.2, 1.18, false, 0],
      [11.8, -12.9, 1.28, false, 0],
      [14.8, -13.1, 1.22, false, 0],
      [17.8, -12.8, 1.30, false, 0],
    ];
    nwTrees.forEach(([tx, tz, sc, kh, kha]) => {
      forestGroup.add(createCartoonTree(tx, tz, sc, kh, kha));
    });

    // --- 3. SOUTH-WEST & SOUTH WOODS (X = -22 to -4.2, Z = +10.5 to +14.0) ---
    const swTrees = [
      [-16.2, 10.4, 1.22, false, 0],
      [-13.0, 10.6, 1.26, false, 0],
      [-9.8, 10.5, 1.18, false, 0],
      [-6.8, 10.8, 1.20, false, 0],
      [-18.2, 12.6, 1.35, false, 0],
      [-14.6, 12.8, 1.32, false, 0],
      [-11.2, 12.7, 1.30, false, 0],
      [-7.8, 12.9, 1.28, false, 0],
      // Background canopies peeking behind the South-East concrete wall (bottom-right of ref_paused_midgame.jpg)
      [12.2, 13.0, 1.22, false, 0],
      [15.2, 13.1, 1.25, false, 0],
      [18.0, 12.9, 1.20, false, 0],
    ];
    swTrees.forEach(([tx, tz, sc, kh, kha]) => {
      forestGroup.add(createCartoonTree(tx, tz, sc, kh, kha));
    });

    // --- 4. Decorative Plump Concentric Shrubs / Ferns tucked around tree bases ---
    const shrubCoords = [
      [-17.2, -2.5, 0.55],
      [-17.4, -7.2, 0.62],
      [-15.0, -9.6, 0.58],
      [-8.8, -9.7, 0.52],
      [-17.0, 2.5, 0.52],
      [-17.2, 6.8, 0.60],
      [-14.5, 9.5, 0.58],
      [-11.2, 9.6, 0.54],
    ];
    shrubCoords.forEach(([bx, bz, bScale]) => {
      const shrub = new THREE.Mesh(canopyGeo, bushMat);
      shrub.scale.set(bScale, bScale * 0.75, bScale);
      shrub.position.set(bx, bScale * 0.42, bz);
      forestGroup.add(shrub);
    });

    this.environmentGroup.add(forestGroup);
  }

  // ============================================================================
  // 4. STYLIZED 3-TIER TOWER MODELS (`createTowerVisual` & `updateTowerVisual`)
  // ============================================================================

  createTowerVisual(tower) {
    if (!THREE || !tower) return null;
    this._initSharedAssets();

    // Remove old visual if recreating
    if (tower.meshGroup && tower.meshGroup.parent) {
      tower.meshGroup.parent.remove(tower.meshGroup);
    }

    const root = new THREE.Group();
    root.name = `Tower_${tower.type}_${tower.id || ''}`;
    root.position.set(tower.x || 0, 0, tower.z || 0);

    // Attach userData on root and children for raycasting selection
    root.userData = { towerId: tower.id, tower };

    // Soft ambient ground shadow decal
    const shadowMesh = new THREE.Mesh(this.geometries.unitQuadXZ, this.materials.dropShadow);
    shadowMesh.scale.set(2.25, 1, 2.25);
    shadowMesh.position.set(0.08, 0.018, 0.10);
    root.add(shadowMesh);

    // Pedestal base group (non-rotating) and Turret head group (rotates toward target)
    const baseGroup = new THREE.Group();
    const headGroup = new THREE.Group();
    root.add(baseGroup);
    root.add(headGroup);

    tower.meshGroup = root;
    tower.visualGroup = root;
    tower._baseGroup = baseGroup;
    tower._headGroup = headGroup;
    tower._builtTier = 0;
    tower._spawnPopTimer = 0.28; // Snappy elastic placement pop-in

    this._rebuildTowerTierMeshes(tower);

    if (this.towersGroup) {
      this.towersGroup.add(root);
    } else if (this.scene) {
      this.scene.add(root);
    }

    this.towerVisuals.set(tower.id || tower, root);
    return root;
  }

  upgradeTowerVisual(tower) {
    if (!tower) return;
    tower._spawnPopTimer = 0.32;
    this._rebuildTowerTierMeshes(tower);
    // Celebratory golden upgrade shockwave ring
    this._spawnShockwaveRing(tower.x || 0, 0.12, tower.z || 0, 1.8, 0xffd740, 0.38);
  }

  removeTowerVisual(tower) {
    if (!tower) return;
    const grp = tower.meshGroup || this.towerVisuals.get(tower.id || tower);
    if (grp && grp.parent) {
      grp.parent.remove(grp);
    }
    this.towerVisuals.delete(tower.id || tower);
  }

  _rebuildTowerTierMeshes(tower) {
    if (!THREE || !tower || !tower._baseGroup || !tower._headGroup) return;
    const tier = clamp(tower.tier || 1, 1, 3);
    tower._builtTier = tier;

    const baseGroup = tower._baseGroup;
    const headGroup = tower._headGroup;

    while (baseGroup.children.length > 0) baseGroup.remove(baseGroup.children[0]);
    while (headGroup.children.length > 0) headGroup.remove(headGroup.children[0]);

    tower._spinBarrels = [];
    tower._recoilParts = [];
    tower._loadedMissiles = [];
    tower._teslaRings = [];
    tower._teslaArcLine = null;
    tower._gooPulseVats = [];

    const type = (tower.type || 'gatling').toLowerCase();
    if (type === 'gatling') {
      this._buildGatlingTierMesh(tower, tier, baseGroup, headGroup);
    } else if (type === 'goo') {
      this._buildGooTierMesh(tower, tier, baseGroup, headGroup);
    } else if (type === 'missile') {
      this._buildMissileTierMesh(tower, tier, baseGroup, headGroup);
    } else if (type === 'tesla') {
      this._buildTeslaTierMesh(tower, tier, baseGroup, headGroup);
    } else {
      this._buildGatlingTierMesh(tower, tier, baseGroup, headGroup);
    }

    // Tag all child meshes with tower reference for raycasting
    tower.meshGroup.traverse((child) => {
      child.userData = { ...(child.userData || {}), towerId: tower.id, tower };
    });
  }

  /**
   * 1. GATLING TOWER (`gatling`, Tiers 1-3)
   * Note: Forward axis in `headGroup` is `+Z` local (`rotation.y = Math.atan2(dx, dz)`).
   */
  _buildGatlingTierMesh(tower, tier, baseGroup, headGroup) {
    // Dark gunmetal riveted circular base collar
    const baseOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 0.96, 0.28, 20),
      this.materials.gunmetalDark
    );
    baseOuter.position.y = 0.14;
    baseGroup.add(baseOuter);

    const baseTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.80, 0.84, 0.16, 20),
      this.materials.gunmetalMid
    );
    baseTrim.position.y = 0.30;
    baseGroup.add(baseTrim);

    // Rivet studs on base collar
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stud = new THREE.Mesh(this.geometries.sphereLow, this.materials.steelSilver);
      stud.scale.set(0.06, 0.05, 0.06);
      stud.position.set(Math.cos(a) * 0.86, 0.27, Math.sin(a) * 0.86);
      baseGroup.add(stud);
    }

    // Iconic Glossy Metallic Ice-Blue / Silver Rounded Dome
    const domeRadius = 0.74 + (tier - 1) * 0.045;
    const domeGeo = new THREE.SphereGeometry(domeRadius, 24, 18);
    // Planar top-down UV mapping so our custom radial specular highlight & rivets map onto the dome
    const pos = domeGeo.attributes.position;
    const uv = domeGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i) / domeRadius;
      const vz = pos.getZ(i) / domeRadius;
      uv.setXY(i, clamp(0.5 + vx * 0.45, 0.02, 0.98), clamp(0.5 + vz * 0.45, 0.02, 0.98));
    }
    const dome = new THREE.Mesh(domeGeo, this.materials.gatlingDome);
    dome.scale.set(1.0, 0.86, 1.0);
    dome.position.y = 0.68;
    headGroup.add(dome);

    // Twin dark angled optical slits / vents on the front face (matching ref_early_tesla_zoom.png!)
    for (const sx of [-0.24, 0.24]) {
      const slit = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.11, 0.12),
        this.materials.gunmetalDark
      );
      slit.position.set(sx, 0.72, domeRadius * 0.86);
      slit.rotation.z = sx < 0 ? -0.22 : 0.22;
      slit.rotation.y = sx * 0.32;
      headGroup.add(slit);
    }

    // Golden-brass front shield & muzzle collar (`#e0a838`)
    const recoilGroup = new THREE.Group();
    headGroup.add(recoilGroup);
    tower._recoilParts.push(recoilGroup);

    const brassShield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 0.24, 14),
      this.materials.brassGold
    );
    brassShield.rotation.x = Math.PI / 2;
    brassShield.position.set(0, 0.58, domeRadius * 0.85);
    recoilGroup.add(brassShield);

    // Helper to build a multi-barrel rotary gatling cluster
    const createRotaryBarrelCluster = (ox, oy, oz, length = 0.65, scale = 1.0) => {
      const cluster = new THREE.Group();
      cluster.position.set(ox, oy, oz);

      // Brass muzzle collar
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16 * scale, 0.16 * scale, 0.12, 12),
        this.materials.brassGold
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.z = length * 0.72;
      cluster.add(collar);

      // 4 individual gunmetal barrels around the spin axis
      for (let b = 0; b < 4; b++) {
        const ba = (b / 4) * Math.PI * 2;
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.042 * scale, 0.042 * scale, length, 8),
          this.materials.gunmetalDark
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(
          Math.cos(ba) * 0.075 * scale,
          Math.sin(ba) * 0.075 * scale,
          length * 0.45
        );
        cluster.add(barrel);
      }

      tower._spinBarrels.push(cluster);
      return cluster;
    };

    if (tier === 1) {
      // Tier 1: Twin side-by-side brass-collared rotary barrels protruding from front shield
      recoilGroup.add(createRotaryBarrelCluster(-0.14, 0.58, domeRadius * 0.88, 0.58, 0.85));
      recoilGroup.add(createRotaryBarrelCluster(0.14, 0.58, domeRadius * 0.88, 0.58, 0.85));
    } else if (tier === 2) {
      // Tier 2: Front twin barrels + top-mounted heavy dual-minigun pods & gold ammo chutes
      recoilGroup.add(createRotaryBarrelCluster(-0.16, 0.56, domeRadius * 0.88, 0.64, 0.90));
      recoilGroup.add(createRotaryBarrelCluster(0.16, 0.56, domeRadius * 0.88, 0.64, 0.90));

      // Top dual minigun pods (matching Tier 2/3 gatlings in ref_early_tesla_zoom.png)
      for (const sx of [-0.42, 0.42]) {
        const podHousing = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.24, 0.52),
          this.materials.gunmetalMid
        );
        podHousing.position.set(sx, 1.12, 0.05);
        recoilGroup.add(podHousing);

        // Gold ammo feed chute
        const chute = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.28, 0.18),
          this.materials.brassGold
        );
        chute.position.set(sx * 0.82, 0.96, 0.0);
        recoilGroup.add(chute);

        recoilGroup.add(createRotaryBarrelCluster(sx, 1.12, 0.28, 0.55, 0.82));
      }
    } else {
      // Tier 3: Massive reinforced command dome with quad rotary vulcan pods & glowing brass shields
      const dorsalCrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.25, 0.78),
        this.materials.brassGold
      );
      dorsalCrest.position.set(0, 1.24, -0.05);
      headGroup.add(dorsalCrest);

      // Front twin heavy barrels
      recoilGroup.add(createRotaryBarrelCluster(-0.18, 0.56, domeRadius * 0.88, 0.72, 0.96));
      recoilGroup.add(createRotaryBarrelCluster(0.18, 0.56, domeRadius * 0.88, 0.72, 0.96));

      // Upper shoulder rotary vulcan pods
      for (const sx of [-0.48, 0.48]) {
        const pod = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.26, 0.58),
          this.materials.gunmetalMid
        );
        pod.position.set(sx, 1.12, 0.08);
        recoilGroup.add(pod);

        const shield = new THREE.Mesh(
          new THREE.CylinderGeometry(0.17, 0.19, 0.18, 12),
          this.materials.brassGold
        );
        shield.rotation.x = Math.PI / 2;
        shield.position.set(sx, 1.12, 0.36);
        recoilGroup.add(shield);

        recoilGroup.add(createRotaryBarrelCluster(sx, 1.12, 0.36, 0.65, 0.92));
      }
    }
  }

  /**
   * 2. GOO TOWER (`goo`, Tiers 1-3)
   * Iconic segmented neon-green & cobalt-blue beetle bio-carapace + pressurized slime nozzles.
   */
  _buildGooTierMesh(tower, tier, baseGroup, headGroup) {
    // Heavy dark blue-grey chemical pedestal with 4 mechanical claw stabilizers
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.92, 0.30, 16),
      this.materials.gunmetalDark
    );
    ped.position.y = 0.15;
    baseGroup.add(ped);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const claw = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.24, 0.48),
        this.materials.gooCobaltShell
      );
      claw.position.set(Math.cos(a) * 0.78, 0.18, Math.sin(a) * 0.78);
      claw.rotation.y = -a + Math.PI / 2;
      baseGroup.add(claw);
    }

    // Segmented neon-green ribbed abdomen/vat (`this.materials.gooCarapace`) tilted along firing axis
    const vatScale = 1.0 + (tier - 1) * 0.10;
    const carapace = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 20, 16),
      this.materials.gooCarapace
    );
    carapace.scale.set(0.88 * vatScale, 0.78 * vatScale, 1.24 * vatScale);
    carapace.position.set(0, 0.68, -0.06);
    carapace.rotation.x = 0.24;
    headGroup.add(carapace);
    tower._gooPulseVats.push(carapace);

    // Twin metallic cobalt-blue wing-shells flanking the ribbed green abdomen
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.SphereGeometry(0.56, 16, 12),
        this.materials.gooCobaltShell
      );
      wing.scale.set(0.44 * vatScale, 0.70 * vatScale, 1.16 * vatScale);
      wing.position.set(sx * 0.50 * vatScale, 0.66, -0.04);
      wing.rotation.z = -sx * 0.28;
      wing.rotation.y = sx * 0.18;
      headGroup.add(wing);
    }

    // Glowing pressurized green slime reservoir dome at rear/top
    const tank = new THREE.Mesh(
      new THREE.SphereGeometry(0.32 * vatScale, 14, 12),
      this.materials.gooSlimeGlow
    );
    tank.position.set(0, 0.92, -0.32);
    headGroup.add(tank);
    tower._gooPulseVats.push(tank);

    // Forward chemical sprayer nozzle(s): 1 at Tier 1, 2 at Tier 2, 3 at Tier 3
    const recoilGroup = new THREE.Group();
    headGroup.add(recoilGroup);
    tower._recoilParts.push(recoilGroup);

    const createNozzle = (ox, oy, oz, yawOffset = 0, len = 0.78) => {
      const nGrp = new THREE.Group();
      nGrp.position.set(ox, oy, oz);
      nGrp.rotation.y = yawOffset;

      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.18, len, 12),
        this.materials.gooCobaltShell
      );
      tube.rotation.x = Math.PI / 2;
      tube.position.z = len * 0.5;
      nGrp.add(tube);

      const tipRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.12, 0.16, 12),
        this.materials.gooSlimeGlow
      );
      tipRing.rotation.x = Math.PI / 2;
      tipRing.position.z = len;
      nGrp.add(tipRing);

      return nGrp;
    };

    if (tier === 1) {
      recoilGroup.add(createNozzle(0, 0.62, 0.35, 0, 0.78));
    } else if (tier === 2) {
      recoilGroup.add(createNozzle(-0.20, 0.62, 0.32, -0.06, 0.82));
      recoilGroup.add(createNozzle(0.20, 0.62, 0.32, 0.06, 0.82));
    } else {
      recoilGroup.add(createNozzle(0, 0.66, 0.38, 0, 0.90));
      recoilGroup.add(createNozzle(-0.28, 0.60, 0.30, -0.14, 0.82));
      recoilGroup.add(createNozzle(0.28, 0.60, 0.30, 0.14, 0.82));

      // Side pressurized slime canisters on Tier 3
      for (const sx of [-0.66, 0.66]) {
        const canister = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 0.62, 10),
          this.materials.gooSlimeGlow
        );
        canister.rotation.x = Math.PI / 2;
        canister.position.set(sx, 0.58, -0.12);
        headGroup.add(canister);
      }
    }
  }

  /**
   * 3. MISSILE TOWER (`missile`, Tiers 1-3)
   * Heavy octagonal steel base + open-frame steel-blue hydraulic launcher rack + large red-nosed silver rockets.
   */
  _buildMissileTierMesh(tower, tier, baseGroup, headGroup) {
    // Heavy octagonal steel base platform
    const baseOct = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 0.96, 0.26, 8),
      this.materials.gunmetalDark
    );
    baseOct.position.y = 0.13;
    baseGroup.add(baseOct);

    // Subtle steel-blue base collar
    const collarRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.80, 0.84, 0.14, 12),
      this.materials.gunmetalMid
    );
    collarRing.position.y = 0.27;
    baseGroup.add(collarRing);

    // Curved steel-blue side armor cheeks (matching ref_early_tesla_zoom.png & ref_round89_dense_maze.png)
    for (const sx of [-0.58, 0.58]) {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.58, 0.98),
        this.materials.gunmetalMid
      );
      cheek.position.set(sx, 0.60, -0.05);
      cheek.rotation.z = -sx * 0.20;
      headGroup.add(cheek);
    }

    // Angled open-frame hydraulic launcher rack tilted upward at 35 degrees
    const rackGroup = new THREE.Group();
    rackGroup.position.set(0, 0.66, -0.04);
    rackGroup.rotation.x = -0.61; // Tilts `+Z` forward nose upward at 35°!
    headGroup.add(rackGroup);

    const rackWidth = tier === 1 ? 0.74 : (tier === 2 ? 0.96 : 1.12);
    const rackBed = new THREE.Mesh(
      new THREE.BoxGeometry(rackWidth, 0.16, 1.08),
      this.materials.gunmetalMid
    );
    rackGroup.add(rackBed);

    // Horizontal silver guide slats/rails across the launcher rack
    for (let s = -0.38; s <= 0.42; s += 0.26) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(rackWidth + 0.06, 0.05, 0.06),
        this.materials.steelSilver
      );
      slat.position.set(0, 0.09, s);
      rackGroup.add(slat);
    }

    // Helper to build a plump cartoon silver-white missile with bright crimson-red nosecone & tailfins
    const createRocketModel = (scale = 1.0) => {
      const rocket = new THREE.Group();

      // Silver-white fuselage cylinder aligned along +Z
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.175 * scale, 0.185 * scale, 0.68 * scale, 14),
        this.materials.missileBody
      );
      body.rotation.x = Math.PI / 2;
      rocket.add(body);

      // Bright crimson-red nosecone at +Z
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.185 * scale, 0.40 * scale, 14),
        this.materials.missileRed
      );
      nose.rotation.x = Math.PI / 2;
      nose.position.z = 0.54 * scale;
      rocket.add(nose);

      // 4 crimson-red tailfins at -Z
      for (let f = 0; f < 4; f++) {
        const fa = (f / 4) * Math.PI * 2 + Math.PI * 0.25;
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(0.045 * scale, 0.25 * scale, 0.24 * scale),
          this.materials.missileRed
        );
        fin.position.set(
          Math.cos(fa) * 0.16 * scale,
          Math.sin(fa) * 0.16 * scale,
          -0.26 * scale
        );
        fin.rotation.z = fa;
        rocket.add(fin);
      }

      return rocket;
    };

    // Populate visible missiles inside the rack according to tier:
    // Tier 1: 1 large center missile
    // Tier 2: 2 twin side-by-side missiles
    // Tier 3: 4 quad-pack multi-silo missiles
    const slots = tier === 1
      ? [[0, 0.26, 0.08, 1.22]]
      : (tier === 2
        ? [[-0.26, 0.25, 0.08, 1.06], [0.26, 0.25, 0.08, 1.06]]
        : [
            [-0.29, 0.22, -0.02, 0.92],
            [0.29, 0.22, -0.02, 0.92],
            [-0.29, 0.52, 0.10, 0.92],
            [0.29, 0.52, 0.10, 0.92],
          ]);

    slots.forEach(([mx, my, mz, mScale]) => {
      const mMesh = createRocketModel(mScale);
      mMesh.position.set(mx, my, mz);
      mMesh.userData.restPos = { x: mx, y: my, z: mz };
      rackGroup.add(mMesh);
      tower._loadedMissiles.push(mMesh);
    });
  }

  /**
   * 4. TESLA TOWER (`tesla`, Tiers 1-3)
   * Deep cobalt-blue transformer box + stacked cyan capacitor rings + branching 4-pronged cyan-white horns.
   */
  _buildTeslaTierMesh(tower, tier, baseGroup, headGroup) {
    // Deep cobalt-blue octagonal high-voltage transformer pedestal (`#1e4c94`)
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.88, 0.68, 8),
      this.materials.teslaCobalt
    );
    ped.position.y = 0.34;
    baseGroup.add(ped);

    // 4 glowing cyan energy vents around the cobalt base (matching ref_early_tesla_zoom.png)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.42, 0.14),
        this.materials.teslaHornGlow
      );
      vent.position.set(Math.cos(a) * 0.76, 0.34, Math.sin(a) * 0.76);
      vent.rotation.y = -a + Math.PI / 2;
      baseGroup.add(vent);

      const buttress = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.56, 0.26),
        this.materials.gunmetalMid
      );
      const ba = a + Math.PI * 0.25;
      buttress.position.set(Math.cos(ba) * 0.78, 0.28, Math.sin(ba) * 0.78);
      buttress.rotation.y = -ba + Math.PI / 2;
      baseGroup.add(buttress);
    }

    // Central metallic insulator column
    const spireHeight = 1.35 + (tier - 1) * 0.22;
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.32, spireHeight, 14),
      this.materials.steelSilver
    );
    column.position.y = 0.65 + spireHeight * 0.5;
    headGroup.add(column);

    // Stacked glowing cyan capacitor rings
    const ringCount = tier + 1;
    for (let r = 0; r < ringCount; r++) {
      const ry = 0.85 + r * (spireHeight * 0.68 / ringCount);
      const capRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.38 - r * 0.03, 0.065, 10, 20),
        this.materials.teslaHornGlow
      );
      capRing.rotation.x = Math.PI / 2;
      capRing.position.y = ry;
      headGroup.add(capRing);
      tower._teslaRings.push(capRing);
    }

    // Iconic Branching V-Shaped / 4-Pronged Glowing Cyan-White Crystal/Metal Discharge Horns!
    const crownY = 0.68 + spireHeight;
    const hornCount = tier === 1 ? 2 : 4;
    for (let h = 0; h < hornCount; h++) {
      const ha = (h / hornCount) * Math.PI * 2 + Math.PI * 0.25;
      const hornGroup = new THREE.Group();
      hornGroup.position.set(0, crownY, 0);
      hornGroup.rotation.y = ha;

      // Primary flared cyan-white wing horn
      const hornBlade = new THREE.Mesh(
        new THREE.ConeGeometry(0.20, 1.15 + (tier - 1) * 0.15, 6),
        this.materials.teslaHornGlow
      );
      hornBlade.position.set(0.45, 0.42, 0);
      hornBlade.rotation.z = -0.68;
      hornBlade.scale.set(0.65, 1.0, 1.35);
      hornGroup.add(hornBlade);

      // Inner pure-white crystal core spine
      const innerSpine = new THREE.Mesh(
        new THREE.ConeGeometry(0.10, 0.95, 5),
        this.materials.teslaCoreWhite
      );
      innerSpine.position.set(0.38, 0.38, 0);
      innerSpine.rotation.z = -0.68;
      hornGroup.add(innerSpine);

      headGroup.add(hornGroup);
    }

    // Central vertical lightning rod & glowing white plasma orb at the apex
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.09, 0.75, 10),
      this.materials.steelSilver
    );
    rod.position.set(0, crownY + 0.35, 0);
    headGroup.add(rod);

    const apexOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 + (tier - 1) * 0.04, 14, 12),
      this.materials.teslaCoreWhite
    );
    apexOrb.position.set(0, crownY + 0.75, 0);
    headGroup.add(apexOrb);
    tower._teslaApexOrb = apexOrb;

    // Tier 2 & 3 side spherical generators
    if (tier >= 2) {
      for (const sx of [-0.56, 0.56]) {
        const genSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 12, 10),
          this.materials.teslaHornGlow
        );
        genSphere.position.set(sx, 0.92, 0);
        headGroup.add(genSphere);
        tower._teslaRings.push(genSphere);
      }
    }

    // Miniature continuous crackling arc line between the top horns
    const arcPts = [];
    for (let i = 0; i < 7; i++) {
      arcPts.push(new THREE.Vector3(0, crownY + 0.55, 0));
    }
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
    const arcMat = new THREE.LineBasicMaterial({ color: 0xd8ffff });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    headGroup.add(arcLine);
    tower._teslaArcLine = arcLine;
    tower._teslaCrownY = crownY;
  }

  /**
   * Updates a Tower's 3D visual state (turret yaw, barrel spin, recoil, missile reload, Tesla crackle).
   */
  updateTowerVisual(tower, dt = 0.016, time = this._time) {
    if (!tower) return;
    if (!tower.meshGroup) {
      this.createTowerVisual(tower);
    }
    if (tower._builtTier !== (tower.tier || 1)) {
      this._rebuildTowerTierMeshes(tower);
    }

    const root = tower.meshGroup;
    const head = tower._headGroup;
    if (!root || !head) return;

    root.position.set(tower.x || 0, 0, tower.z || 0);

    // Elastic placement/upgrade scale pop animation
    if (tower._spawnPopTimer > 0) {
      tower._spawnPopTimer = Math.max(0, tower._spawnPopTimer - dt);
      const p = 1.0 - tower._spawnPopTimer / 0.30;
      const s = 1.0 + Math.sin(p * Math.PI) * 0.22;
      root.scale.set(s, s, s);
    } else {
      root.scale.set(1, 1, 1);
    }

    // Resolve turret heading so `+Z` local on `headGroup` ALWAYS points directly at target!
    const targetObj = tower.target || tower.currentTarget || (tower.activeGooBeamTargets && tower.activeGooBeamTargets[0]);
    if (targetObj && typeof targetObj.x === 'number' && typeof targetObj.z === 'number') {
      const dx = targetObj.x - (tower.x || 0);
      const dz = targetObj.z - (tower.z || 0);
      if (dx * dx + dz * dz > 0.001) {
        const desiredRotY = Math.atan2(dx, dz);
        // Smoothly interpolate head rotation toward target
        let diff = desiredRotY - head.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        head.rotation.y += diff * Math.min(1.0, dt * 16.0);
        tower._lastResolvedYaw = head.rotation.y;
      }
    } else if (typeof tower.turretYaw === 'number') {
      // `tower_system.js` computes `tower.turretYaw = Math.atan2(dx, dz)` which matches `+Z` local forward
      head.rotation.y = tower.turretYaw;
    }

    // Recoil kickback along `-Z` local
    const recoil = clamp(tower.recoilOffset || 0, 0, 1.0);
    if (tower._recoilParts && tower._recoilParts.length > 0) {
      for (const rp of tower._recoilParts) {
        rp.position.z = -recoil * 0.22;
      }
    }

    // Gatling rotary barrel spin
    if (tower._spinBarrels && tower._spinBarrels.length > 0) {
      const spinAngle = (tower.barrelSpinAngle !== undefined)
        ? tower.barrelSpinAngle
        : (time * 12.0);
      for (const bCluster of tower._spinBarrels) {
        bCluster.rotation.z = spinAngle;
      }
    }

    // Goo vat breathing pulse
    if (tower._gooPulseVats && tower._gooPulseVats.length > 0) {
      const pulse = 1.0 + Math.sin(time * 6.5 + (tower.x || 0)) * 0.05;
      const vatScale = 1.0 + ((tower.tier || 1) - 1) * 0.10;
      const mainVat = tower._gooPulseVats[0];
      if (mainVat) {
        mainVat.scale.set(0.88 * vatScale * pulse, 0.75 * vatScale / pulse, 1.18 * vatScale * pulse);
      }
    }

    // Missile reload bay animation (`tower.reloadProgress` in `0..1`)
    if (tower._loadedMissiles && tower._loadedMissiles.length > 0) {
      let prog = tower.reloadProgress;
      if (typeof prog !== 'number') {
        prog = tower.cooldown > 0 ? clamp(1.0 - tower.cooldown / 1.1, 0, 1) : 1.0;
      }
      const count = tower._loadedMissiles.length;
      for (let i = 0; i < count; i++) {
        const mMesh = tower._loadedMissiles[i];
        const rest = mMesh.userData.restPos;
        const slotThreshold = (i + 0.15) / count;
        if (prog < 0.08) {
          mMesh.visible = false;
        } else {
          mMesh.visible = true;
          const localT = clamp((prog - slotThreshold * 0.5) / (1.0 - slotThreshold * 0.5), 0.0, 1.0);
          mMesh.scale.setScalar(0.25 + 0.75 * localT);
          mMesh.position.set(
            rest.x,
            rest.y - (1.0 - localT) * 0.18,
            rest.z - (1.0 - localT) * 0.32
          );
        }
      }
    }

    // Tesla Tower continuous horn crackle & capacitor pulse
    if (tower._teslaArcLine) {
      const posAttr = tower._teslaArcLine.geometry.attributes.position;
      const cy = tower._teslaCrownY || 2.0;
      const spread = 0.65;
      for (let i = 0; i < posAttr.count; i++) {
        const u = (i / (posAttr.count - 1)) * 2 - 1; // -1 to +1
        const jitterY = (i === 0 || i === posAttr.count - 1) ? 0 : (Math.random() - 0.5) * 0.26;
        const jitterZ = (i === 0 || i === posAttr.count - 1) ? 0 : (Math.random() - 0.5) * 0.26;
        posAttr.setXYZ(i, u * spread, cy + 0.55 + Math.abs(u) * 0.15 + jitterY, jitterZ);
      }
      posAttr.needsUpdate = true;
    }
  }

  // Aliases for `TowerSystem` (`tower_system.js`)
  createTowerMesh(tower) {
    return this.createTowerVisual(tower);
  }

  updateTowerMesh(tower, dt, time) {
    return this.updateTowerVisual(tower, dt, time);
  }

  upgradeTowerMesh(tower) {
    return this.upgradeTowerVisual(tower);
  }

  removeTowerMesh(tower) {
    return this.removeTowerVisual(tower);
  }

  // ============================================================================
  // 5. ENEMY MODELS & ANIMATIONS (`createEnemyVisual` & `updateEnemyVisual`)
  // ============================================================================

  createEnemyVisual(enemy) {
    if (!THREE || !enemy) return null;
    this._initSharedAssets();

    if (enemy.meshGroup && enemy.meshGroup.parent) {
      enemy.meshGroup.parent.remove(enemy.meshGroup);
    }

    const root = new THREE.Group();
    root.name = `Enemy_${enemy.type}_${enemy.id || ''}`;
    const startY = enemy.isAir ? (enemy.flyHeight || 3.3) : 0;
    root.position.set(enemy.x || -19.5, startY, enemy.z || 0);

    // Body group that rotates toward movement heading (`+Z` local forward, defaulting to `+X` East)
    const bodyGroup = new THREE.Group();
    bodyGroup.rotation.y = Math.PI * 0.5;
    root.add(bodyGroup);

    const type = (enemy.type || 'grunt').toLowerCase();
    const animParts = {};

    if (type === 'grunt') {
      this._buildGruntMesh(bodyGroup, animParts);
    } else if (type === 'biker') {
      this._buildBikerMesh(bodyGroup, animParts);
    } else if (type === 'transport') {
      this._buildTransportMesh(bodyGroup, animParts);
    } else if (type === 'mech') {
      this._buildMechMesh(bodyGroup, animParts);
    } else if (type === 'chopper') {
      this._buildChopperMesh(root, bodyGroup, animParts, enemy);
    } else if (type === 'zeppelin') {
      this._buildZeppelinMesh(root, bodyGroup, animParts, enemy);
    } else {
      this._buildGruntMesh(bodyGroup, animParts);
    }

    // Scale adjustment
    const sc = enemy.scale || 1.0;
    bodyGroup.scale.setScalar(sc);

    // Ground drop shadow (for ground units, sits right under feet; for Air units, sits on battlefield Y=0.04!)
    if (!enemy.isAir) {
      const groundShadow = new THREE.Mesh(this.geometries.unitQuadXZ, this.materials.dropShadow);
      const r = (enemy.radius || 0.5) * 2.2;
      groundShadow.scale.set(r, 1, r * 1.15);
      groundShadow.position.set(0, 0.02, 0);
      root.add(groundShadow);
      animParts.groundShadow = groundShadow;
    }

    // Slowed green slime ring + dripping aura (hidden until `enemy.slowTimer > 0`)
    const slowRing = new THREE.Mesh(
      this.geometries.unitQuadXZ,
      new THREE.MeshBasicMaterial({
        map: this.textures.gooDecal,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    const sr = (enemy.radius || 0.5) * 2.5;
    slowRing.scale.set(sr, 1, sr);
    slowRing.position.set(0, enemy.isAir ? -0.25 : 0.03, 0);
    slowRing.visible = false;
    root.add(slowRing);
    animParts.slowRing = slowRing;

    // Electric stun shock cage (hidden until `enemy.stunTimer > 0`)
    const stunRing = new THREE.Mesh(
      new THREE.TorusGeometry((enemy.radius || 0.5) * 1.15, 0.05, 6, 10),
      this.materials.lightningMid
    );
    stunRing.rotation.x = Math.PI / 2;
    stunRing.position.set(0, 0.55, 0);
    stunRing.visible = false;
    root.add(stunRing);
    animParts.stunRing = stunRing;

    // Crisp Floating Health Bar above each enemy (matching ref_paused_midgame.jpg!)
    const hpBarGroup = new THREE.Group();
    const hpHeight = type === 'zeppelin' ? 1.85 : (type === 'mech' ? 1.75 : (type === 'transport' ? 1.38 : 1.25));
    hpBarGroup.position.set(0, hpHeight, 0);

    const barW = type === 'zeppelin' ? 2.2 : (type === 'mech' ? 1.45 : (type === 'transport' ? 1.25 : 0.92));
    const barH = type === 'zeppelin' ? 0.20 : 0.13;

    // Dark border backing
    const bgBack = new THREE.Mesh(
      new THREE.PlaneGeometry(barW + 0.06, barH + 0.05),
      new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false })
    );
    bgBack.renderOrder = 20;
    hpBarGroup.add(bgBack);

    // Crimson missing-health background bar
    const missingBar = new THREE.Mesh(
      new THREE.PlaneGeometry(barW, barH),
      new THREE.MeshBasicMaterial({ color: 0xd91b24, depthTest: false })
    );
    missingBar.position.z = 0.005;
    missingBar.renderOrder = 21;
    hpBarGroup.add(missingBar);

    // Bright green remaining-health fill bar
    const fillGeo = new THREE.PlaneGeometry(barW, barH);
    fillGeo.translate(barW * 0.5, 0, 0); // Anchor at left edge!
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, depthTest: false });
    const fillBar = new THREE.Mesh(fillGeo, fillMat);
    fillBar.position.set(-barW * 0.5, 0, 0.01);
    fillBar.renderOrder = 22;
    hpBarGroup.add(fillBar);

    root.add(hpBarGroup);
    animParts.hpBarGroup = hpBarGroup;
    animParts.hpFillBar = fillBar;
    animParts.hpFillMat = fillMat;

    enemy.mesh = root;
    enemy.group = root;
    enemy.meshGroup = root;
    enemy.visualGroup = root;
    enemy._bodyGroup = bodyGroup;
    enemy._animParts = animParts;
    enemy._lastVisualX = enemy.x || -19.5;
    enemy._lastVisualZ = enemy.z || 0;
    enemy._walkPhase = Math.random() * Math.PI * 2;
    enemy.syncMeshTransform = (dt) => this.updateEnemyVisual(enemy, dt, this._time);

    if (this.enemiesGroup) {
      this.enemiesGroup.add(root);
    } else if (this.scene) {
      this.scene.add(root);
    }

    this.enemyVisuals.set(enemy.id || enemy, root);
    return root;
  }

  // Aliases for `EnemyWaveSystem` (`enemy_waves.js`)
  createEnemyMesh(arg0, arg1, arg2) {
    // Supports both `createEnemyMesh(enemy)` and `createEnemyMesh(type, def, enemy)`
    const enemy = (arg2 && typeof arg2 === 'object')
      ? arg2
      : ((arg0 && typeof arg0 === 'object') ? arg0 : { type: arg0 || 'grunt', ...(arg1 || {}) });
    return this.createEnemyVisual(enemy);
  }

  updateEnemyMesh(enemy, dt, time) {
    return this.updateEnemyVisual(enemy, dt, time);
  }

  removeEnemyMesh(enemy) {
    return this.removeEnemyVisual(enemy);
  }

  removeEnemyVisual(enemy) {
    if (!enemy) return;
    if (enemy._animParts && enemy._animParts.airGroundShadow && enemy._animParts.airGroundShadow.parent) {
      enemy._animParts.airGroundShadow.parent.remove(enemy._animParts.airGroundShadow);
    }
    const grp = enemy.meshGroup || enemy.mesh || this.enemyVisuals.get(enemy.id || enemy);
    if (grp && grp.parent) {
      grp.parent.remove(grp);
    }
    this.enemyVisuals.delete(enemy.id || enemy);
  }

  /**
   * 1. GRUNT (`grunt`): Crimson-red military coat, dark trousers/boots, dark charcoal helmet, bobbing run cycle.
   */
  _buildGruntMesh(bodyGroup, animParts) {
    // Torso in bright crimson-red uniform coat (`#d9232a`)
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.23, 0.44, 10),
      this.materials.gruntRed
    );
    torso.position.set(0, 0.48, 0);
    bodyGroup.add(torso);
    animParts.torso = torso;

    // Dark utility belt
    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.225, 0.225, 0.07, 10),
      this.materials.gruntBoots
    );
    belt.position.set(0, 0.34, 0);
    bodyGroup.add(belt);

    // Head + oversized rounded dark olive/charcoal Brodie/kettle helmet (`#3c3733`)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.80, 0.03);

    const face = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      this.materials.gruntSkin
    );
    headGroup.add(face);

    const helmetDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 12),
      this.materials.gruntHelmet
    );
    helmetDome.scale.set(1.05, 0.88, 1.12);
    helmetDome.position.set(0, 0.06, -0.02);
    headGroup.add(helmetDome);

    const helmetBrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.28, 0.05, 14),
      this.materials.gruntHelmet
    );
    helmetBrim.position.set(0, 0.02, 0.0);
    helmetBrim.rotation.x = -0.12;
    headGroup.add(helmetBrim);

    bodyGroup.add(headGroup);
    animParts.headGroup = headGroup;

    // Swinging Arms (`armL`, `armR`) in red sleeves
    const createArm = (sx) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.24, 0.62, 0);
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.055, 0.32, 8),
        this.materials.gruntRed
      );
      arm.position.set(0, -0.13, 0.04);
      arm.rotation.x = -0.35;
      pivot.add(arm);

      const hand = new THREE.Mesh(this.geometries.sphereLow, this.materials.gruntSkin);
      hand.scale.setScalar(0.065);
      hand.position.set(0, -0.27, 0.09);
      pivot.add(hand);
      return pivot;
    };
    animParts.armL = createArm(-1);
    animParts.armR = createArm(1);
    bodyGroup.add(animParts.armL);
    bodyGroup.add(animParts.armR);

    // Swinging Legs (`legL`, `legR`) in dark boots
    const createLeg = (sx) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.11, 0.30, 0);
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.065, 0.26, 8),
        this.materials.gruntBoots
      );
      leg.position.set(0, -0.13, 0);
      pivot.add(leg);

      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.10, 0.20),
        this.materials.gruntBoots
      );
      boot.position.set(0, -0.25, 0.04);
      pivot.add(boot);
      return pivot;
    };
    animParts.legL = createLeg(-1);
    animParts.legR = createLeg(1);
    bodyGroup.add(animParts.legL);
    bodyGroup.add(animParts.legR);
  }

  /**
   * 2. BIKER (`biker`): Lime-green & yellow dieselpunk military motorcycle with leaning red-uniformed rider.
   */
  _buildBikerMesh(bodyGroup, animParts) {
    const bikeGroup = new THREE.Group();
    bodyGroup.add(bikeGroup);
    animParts.bikeGroup = bikeGroup;

    // Front & Rear chunky black tires (`rotation.y = Math.PI/2` so torus sits in YZ plane)
    const createWheel = (zPos, radius = 0.24) => {
      const wGrp = new THREE.Group();
      wGrp.position.set(0, radius, zPos);
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.72, radius * 0.32, 10, 16),
        this.materials.gruntBoots
      );
      tire.rotation.y = Math.PI / 2;
      wGrp.add(tire);

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, 0.14, 10),
        this.materials.steelSilver
      );
      hub.rotation.z = Math.PI / 2;
      wGrp.add(hub);
      return wGrp;
    };

    animParts.wheelFront = createWheel(0.42, 0.24);
    animParts.wheelRear = createWheel(-0.42, 0.25);
    bikeGroup.add(animParts.wheelFront);
    bikeGroup.add(animParts.wheelRear);

    // Lime-green & yellow dieselpunk motorcycle chassis fairing (`#8be026`)
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.26, 0.82),
      this.materials.bikerLime
    );
    frame.position.set(0, 0.36, 0.0);
    bikeGroup.add(frame);

    const frontCowl = new THREE.Mesh(
      new THREE.ConeGeometry(0.20, 0.42, 10),
      this.materials.bikerLime
    );
    frontCowl.rotation.x = Math.PI / 2;
    frontCowl.position.set(0, 0.46, 0.38);
    bikeGroup.add(frontCowl);

    // Bright yellow headlight
    const headlight = new THREE.Mesh(this.geometries.sphereLow, this.materials.visorGlow);
    headlight.scale.set(0.09, 0.09, 0.06);
    headlight.position.set(0, 0.48, 0.56);
    bikeGroup.add(headlight);

    // Twin chrome exhaust pipes on rear sides
    for (const sx of [-0.17, 0.17]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.06, 0.55, 8),
        this.materials.steelSilver
      );
      pipe.rotation.x = Math.PI / 2 - 0.25;
      pipe.position.set(sx, 0.34, -0.34);
      bikeGroup.add(pipe);
    }

    // Red-uniformed Rider leaning forward gripping handlebars
    const riderTorso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 0.38, 10),
      this.materials.gruntRed
    );
    riderTorso.position.set(0, 0.64, -0.08);
    riderTorso.rotation.x = 0.48;
    bikeGroup.add(riderTorso);

    const riderHelmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 12, 10),
      this.materials.gruntHelmet
    );
    riderHelmet.position.set(0, 0.88, 0.06);
    bikeGroup.add(riderHelmet);
  }

  /**
   * 3. ARMORED TRANSPORT (`transport`): Chunky riveted olive/steel halftrack APC with troop bed & exhaust stacks.
   */
  _buildTransportMesh(bodyGroup, animParts) {
    const chassis = new THREE.Group();
    bodyGroup.add(chassis);
    animParts.chassis = chassis;

    // Lower steel hull & rear halftrack treads
    for (const sx of [-0.46, 0.46]) {
      const tread = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.26, 0.82),
        this.materials.gruntBoots
      );
      tread.position.set(sx, 0.14, -0.22);
      chassis.add(tread);

      const frontWheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.16, 12),
        this.materials.gruntBoots
      );
      frontWheel.rotation.z = Math.PI / 2;
      frontWheel.position.set(sx, 0.18, 0.45);
      chassis.add(frontWheel);
    }

    // Armored olive-green truck cab & troop bed
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.46, 1.38),
      this.materials.oliveArmor
    );
    bed.position.set(0, 0.44, -0.04);
    chassis.add(bed);

    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.36, 0.56),
      this.materials.oliveDark
    );
    cab.position.set(0, 0.76, 0.30);
    chassis.add(cab);

    // Armored windshield slit & front bumper grille
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.12, 0.08),
      this.materials.visorGlow
    );
    visor.position.set(0, 0.78, 0.58);
    chassis.add(visor);

    const bumper = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.20, 0.16),
      this.materials.hazardTrim
    );
    bumper.position.set(0, 0.24, 0.68);
    chassis.add(bumper);

    // 3 Grunt helmets peeking out of the open rear troop bay (since it spawns 3 Grunts on death!)
    for (let i = -1; i <= 1; i++) {
      const h = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 10, 8),
        this.materials.gruntHelmet
      );
      h.position.set(i * 0.24, 0.74, -0.36);
      chassis.add(h);
    }

    // Twin vertical chugging exhaust stacks
    for (const sx of [-0.46, 0.46]) {
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, 0.62, 8),
        this.materials.gunmetalDark
      );
      stack.position.set(sx, 0.72, 0.04);
      chassis.add(stack);
    }
  }

  /**
   * 4. GOLIATH MECH (`mech`): Heavy walking dieselpunk robot/tank with stomping legs & twin shoulder cannons.
   */
  _buildMechMesh(bodyGroup, animParts) {
    // Articulated stomping legs (`legL`, `legR`)
    const createMechLeg = (sx) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(sx * 0.38, 0.55, 0);

      const thigh = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.38, 0.28),
        this.materials.gunmetalMid
      );
      thigh.position.set(0, -0.18, 0);
      legPivot.add(thigh);

      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.16, 0.48),
        this.materials.gunmetalDark
      );
      foot.position.set(0, -0.45, 0.06);
      legPivot.add(foot);

      return legPivot;
    };

    animParts.legL = createMechLeg(-1);
    animParts.legR = createMechLeg(1);
    bodyGroup.add(animParts.legL);
    bodyGroup.add(animParts.legR);

    // Heavy armored upper torso hull
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.88, 0);
    bodyGroup.add(torsoGroup);
    animParts.torso = torsoGroup;

    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.48, 0.68, 12),
      this.materials.mechBronze
    );
    torsoGroup.add(hull);

    const domeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.54, 14, 10),
      this.materials.gunmetalMid
    );
    domeCap.scale.set(1, 0.6, 1);
    domeCap.position.y = 0.32;
    torsoGroup.add(domeCap);

    // Glowing yellow cockpit visor & hazard belt
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.16, 0.22),
      this.materials.visorGlow
    );
    visor.position.set(0, 0.14, 0.48);
    torsoGroup.add(visor);

    const hazardChest = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.18, 0.22),
      this.materials.hazardTrim
    );
    hazardChest.position.set(0, -0.18, 0.44);
    torsoGroup.add(hazardChest);

    // Twin heavy shoulder rotary cannons
    for (const sx of [-0.66, 0.66]) {
      const pod = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.30, 0.62),
        this.materials.gunmetalDark
      );
      pod.position.set(sx, 0.18, 0.08);
      torsoGroup.add(pod);

      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.10, 0.56, 10),
        this.materials.steelSilver
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(sx, 0.18, 0.52);
      torsoGroup.add(barrel);
    }
  }

  /**
   * 5. SKYRAIDER CHOPPER (`chopper` — Air Unit):
   * Olive & crimson military gunship with stub-wing rocket pods, spinning main & tail rotors, skids, and crisp ground drop shadow!
   */
  _buildChopperMesh(root, bodyGroup, animParts, enemy) {
    // Fuselage cabin aligned along +Z forward
    const cabinWrap = new THREE.Group();
    cabinWrap.scale.set(0.86, 0.76, 1.48);
    const cabin = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 16, 12),
      this.materials.oliveArmor
    );
    cabinWrap.add(cabin);
    bodyGroup.add(cabinWrap);

    // Crimson nose shark stripe & tinted glass canopy at +Z forward
    const noseWrap = new THREE.Group();
    noseWrap.position.set(0, -0.04, 0.36);
    noseWrap.scale.set(0.80, 0.66, 0.96);
    const noseStripe = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 12, 10),
      this.materials.gruntRed
    );
    noseWrap.add(noseStripe);
    bodyGroup.add(noseWrap);

    const glassWrap = new THREE.Group();
    glassWrap.position.set(0, 0.12, 0.34);
    glassWrap.scale.set(0.76, 0.54, 0.86);
    const cockpitGlass = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 10),
      this.materials.visorGlow
    );
    glassWrap.add(cockpitGlass);
    bodyGroup.add(glassWrap);

    // Stub wings + under-wing rocket pods
    const stubWings = new THREE.Mesh(
      new THREE.BoxGeometry(1.22, 0.07, 0.32),
      this.materials.gruntRed
    );
    stubWings.position.set(0, -0.04, 0.04);
    bodyGroup.add(stubWings);

    for (const sx of [-0.46, 0.46]) {
      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.46, 10),
        this.materials.gunmetalDark
      );
      pod.rotation.x = Math.PI / 2;
      pod.position.set(sx, -0.14, 0.08);
      bodyGroup.add(pod);
    }

    // Tail boom + vertical tail fin + tail rotor at -Z rear
    const tailBoom = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 1.08, 10),
      this.materials.oliveDark
    );
    tailBoom.rotation.x = -Math.PI / 2;
    tailBoom.position.set(0, 0.08, -0.94);
    bodyGroup.add(tailBoom);

    const tailFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.42, 0.28),
      this.materials.gruntRed
    );
    tailFin.position.set(0, 0.22, -1.36);
    bodyGroup.add(tailFin);

    // Landing skids
    for (const sx of [-0.32, 0.32]) {
      const skid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8),
        this.materials.gunmetalDark
      );
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, -0.40, 0.05);
      bodyGroup.add(skid);
    }

    // Fast-spinning Main Rotor Disc + Cross Blades
    const rotorPivot = new THREE.Group();
    rotorPivot.position.set(0, 0.44, 0.0);
    bodyGroup.add(rotorPivot);
    animParts.mainRotor = rotorPivot;

    const blade1 = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.025, 0.14),
      this.materials.gunmetalDark
    );
    const blade2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.025, 1.95),
      this.materials.gunmetalDark
    );
    rotorPivot.add(blade1);
    rotorPivot.add(blade2);

    const blurDisc = new THREE.Mesh(
      this.geometries.unitCircleXZ,
      new THREE.MeshBasicMaterial({
        color: 0xdbe6f0,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      })
    );
    blurDisc.scale.set(0.98, 1, 0.98);
    rotorPivot.add(blurDisc);

    // Crisp dark ground drop-shadow mesh at Y = 0.04 on the battlefield below!
    const airShadow = new THREE.Mesh(this.geometries.unitQuadXZ, this.materials.airDropShadow);
    airShadow.scale.set(1.95, 1, 1.35);
    airShadow.position.set(0.35, 0.04 - (enemy.flyHeight || 3.3), 0.45);
    root.add(airShadow);
    animParts.airGroundShadow = airShadow;
  }

  /**
   * 6. DREADNOUGHT ZEPPELIN (`zeppelin` — Boss Air Unit):
   * Colossal ribbed crimson/steel/gold dirigible blimp with shark-mouth grin pointing East (+X),
   * sleek cruciform rear tailfins (-X), ventral armored gondola (-Y), and giant shadow!
   */
  _buildZeppelinMesh(root, bodyGroup, animParts, enemy) {
    // Wrap the sphere in `hullWrap` BEFORE scaling Z so `hull.rotation.y = -Math.PI/2` rotates UV only
    // and `hullWrap.scale.set(0.88, 0.85, 2.25)` elongates strictly along `bodyGroup`'s `+Z` forward axis!
    const hullWrap = new THREE.Group();
    hullWrap.scale.set(0.88, 0.85, 2.25);
    const hullGeo = new THREE.SphereGeometry(0.95, 24, 18);
    const hull = new THREE.Mesh(hullGeo, this.materials.zeppelinHull);
    hull.rotation.y = -Math.PI / 2; // Align shark-mouth nose art with `+Z` forward!
    hullWrap.add(hull);
    bodyGroup.add(hullWrap);

    // Golden nosecone cap at `+Z` forward (pointing East `+X` in world space)
    const noseCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.42, 14),
      this.materials.brassGold
    );
    noseCone.rotation.x = Math.PI / 2;
    noseCone.position.set(0, 0, 2.15);
    bodyGroup.add(noseCone);

    // Rear tail cone cap at `-Z`
    const tailCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.38, 12),
      this.materials.brassGold
    );
    tailCone.rotation.x = -Math.PI / 2;
    tailCone.position.set(0, 0, -2.12);
    bodyGroup.add(tailCone);

    // 4 sleek cruciform crimson & gold stabilizing tailfins at `-Z` rear
    for (let f = 0; f < 4; f++) {
      const fa = (f / 4) * Math.PI * 2;
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.48, 0.58),
        this.materials.missileRed
      );
      fin.position.set(Math.cos(fa) * 0.54, Math.sin(fa) * 0.54, -1.62);
      fin.rotation.z = fa;
      bodyGroup.add(fin);

      const finTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.50, 0.10),
        this.materials.brassGold
      );
      finTrim.position.set(Math.cos(fa) * 0.55, Math.sin(fa) * 0.55, -1.88);
      finTrim.rotation.z = fa;
      bodyGroup.add(finTrim);
    }

    // Underside armored steel gondola tucked cleanly underneath the belly (`-Y`)
    const gondola = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.34, 1.32),
      this.materials.gunmetalDark
    );
    gondola.position.set(0, -0.82, 0.05);
    bodyGroup.add(gondola);

    animParts.propellers = [];
    for (const sx of [-0.82, 0.82]) {
      const nacelle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.12, 0.56, 10),
        this.materials.brassGold
      );
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(sx, -0.34, -0.05);
      bodyGroup.add(nacelle);

      const prop = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.07, 0.04),
        this.materials.steelSilver
      );
      prop.position.set(sx, -0.34, -0.36);
      bodyGroup.add(prop);
      animParts.propellers.push(prop);
    }

    // Large ominous elliptical ground drop-shadow at Y = 0.04 sliding across the towers below!
    const airShadow = new THREE.Mesh(this.geometries.unitQuadXZ, this.materials.airDropShadow);
    airShadow.scale.set(4.1, 1, 2.0);
    airShadow.position.set(0.45, 0.04 - (enemy.flyHeight || 4.1), 0.55);
    root.add(airShadow);
    animParts.airGroundShadow = airShadow;
  }

  /**
   * Updates an Enemy's 3D visual state (position, heading, run/flight cycle, health bar, slow/stun overlays).
   */
  updateEnemyVisual(enemy, dt = 0.016, time = this._time) {
    if (!enemy) return;
    if (enemy.dead || enemy.isDead || enemy.hp <= 0) {
      this.removeEnemyVisual(enemy);
      return;
    }
    if (!enemy.meshGroup) {
      this.createEnemyVisual(enemy);
    }

    const root = enemy.meshGroup;
    const body = enemy._bodyGroup;
    const parts = enemy._animParts || {};
    if (!root || !body) return;

    const ex = enemy.x !== undefined ? enemy.x : -19.5;
    const ez = enemy.z !== undefined ? enemy.z : 0;
    const baseY = enemy.isAir
      ? (enemy.y !== undefined && enemy.y > 0.5 ? enemy.y : (enemy.flyHeight || 3.3))
      : 0;

    // Compute exact movement vector for smooth heading orientation
    const dx = ex - (enemy._lastVisualX ?? ex);
    const dz = ez - (enemy._lastVisualZ ?? ez);
    const moveDist = Math.hypot(dx, dz);
    enemy._lastVisualX = ex;
    enemy._lastVisualZ = ez;

    if (enemy.isAir) {
      // Air units fly strictly West-to-East (`+X`), so `+Z` local forward is always `Math.PI * 0.5`!
      body.rotation.y = Math.PI * 0.5;
    } else if (moveDist > 0.0002) {
      const targetRotY = Math.atan2(dx, dz);
      let diff = targetRotY - body.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      body.rotation.y += diff * Math.min(1.0, dt * 16.0);
    } else if (typeof enemy.vx === 'number' && typeof enemy.vz === 'number' && Math.hypot(enemy.vx, enemy.vz) > 0.01) {
      body.rotation.y = Math.atan2(enemy.vx, enemy.vz);
    }

    // Advance walk/run phase proportional to distance traveled
    const speedFactor = (enemy.slowTimer > 0) ? (enemy.slowFactor || 0.5) : 1.0;
    const stunJitterX = (enemy.stunTimer > 0) ? (Math.random() - 0.5) * 0.14 : 0;
    const stunJitterZ = (enemy.stunTimer > 0) ? (Math.random() - 0.5) * 0.14 : 0;

    if (enemy.stunTimer <= 0) {
      enemy._walkPhase = (enemy._walkPhase || 0) + dt * (enemy.speed || 3.5) * speedFactor * 4.2;
    }
    const wp = enemy._walkPhase || 0;
    const type = (enemy.type || 'grunt').toLowerCase();

    if (type === 'grunt') {
      const swing = Math.sin(wp) * 0.75;
      if (parts.legL) parts.legL.rotation.x = swing;
      if (parts.legR) parts.legR.rotation.x = -swing;
      if (parts.armL) parts.armL.rotation.x = -swing * 0.85;
      if (parts.armR) parts.armR.rotation.x = swing * 0.85;
      if (parts.headGroup) {
        parts.headGroup.position.y = 0.80 + Math.abs(Math.sin(wp)) * 0.05;
        parts.headGroup.rotation.z = Math.cos(wp) * 0.08;
      }
      body.position.y = Math.abs(Math.sin(wp)) * 0.08;
    } else if (type === 'biker') {
      if (parts.wheelFront) parts.wheelFront.rotation.x += dt * 14.0 * speedFactor;
      if (parts.wheelRear) parts.wheelRear.rotation.x += dt * 14.0 * speedFactor;
      body.position.y = Math.abs(Math.sin(wp * 2.0)) * 0.035;
    } else if (type === 'transport') {
      if (parts.chassis) {
        parts.chassis.position.y = Math.sin(wp * 2.5) * 0.025;
        parts.chassis.rotation.z = Math.cos(wp * 1.8) * 0.025;
      }
    } else if (type === 'mech') {
      const stomp = Math.sin(wp * 0.75) * 0.55;
      if (parts.legL) parts.legL.rotation.x = stomp;
      if (parts.legR) parts.legR.rotation.x = -stomp;
      if (parts.torso) {
        parts.torso.position.y = 0.88 + Math.abs(Math.cos(wp * 0.75)) * 0.07;
        parts.torso.rotation.z = Math.sin(wp * 0.75) * 0.06;
      }
    } else if (type === 'chopper') {
      if (parts.mainRotor) parts.mainRotor.rotation.y += dt * 28.0;
      body.rotation.x = 0.14; // Forward gunship pitch!
      body.position.y = Math.sin(time * 3.8 + (enemy.id || 0)) * 0.10;
      if (parts.airGroundShadow) {
        parts.airGroundShadow.position.set(0.35, 0.04 - baseY, 0.45);
        parts.airGroundShadow.rotation.y = 0;
      }
    } else if (type === 'zeppelin') {
      body.position.y = Math.sin(time * 1.8 + (enemy.id || 0)) * 0.08;
      body.rotation.z = Math.sin(time * 1.2) * 0.025;
      if (parts.propellers) {
        for (const p of parts.propellers) p.rotation.z += dt * 22.0;
      }
      if (parts.airGroundShadow) {
        parts.airGroundShadow.position.set(0.45, 0.04 - baseY, 0.55);
        parts.airGroundShadow.rotation.y = 0;
      }
    }

    root.rotation.set(0, 0, 0);
    root.position.set(ex + stunJitterX, baseY, ez + stunJitterZ);

    // Status overlays: Goo Slow (`slowTimer > 0`) & Tesla Stun (`stunTimer > 0`)
    if (parts.slowRing) {
      parts.slowRing.visible = (enemy.slowTimer || 0) > 0;
      if (parts.slowRing.visible) {
        parts.slowRing.rotation.y = time * 1.5;
      }
    }
    if (parts.stunRing) {
      parts.stunRing.visible = (enemy.stunTimer || 0) > 0;
      if (parts.stunRing.visible) {
        parts.stunRing.rotation.x = Math.random() * Math.PI;
        parts.stunRing.rotation.y = Math.random() * Math.PI;
      }
    }

    // Update Floating Health Bar (billboarded toward camera)
    if (parts.hpBarGroup && parts.hpFillBar) {
      const maxHp = Math.max(1, enemy.maxHp || 26);
      const curHp = clamp(enemy.hp ?? maxHp, 0, maxHp);
      const ratio = clamp(curHp / maxHp, 0.001, 1.0);
      parts.hpFillBar.scale.x = ratio;

      if (parts.hpFillMat) {
        if (ratio > 0.55) {
          parts.hpFillMat.color.setHex(0x39ff14); // Crisp Argon Towers neon green
        } else if (ratio > 0.25) {
          parts.hpFillMat.color.setHex(0xffd600); // Warning yellow
        } else {
          parts.hpFillMat.color.setHex(0xff3d00); // Critical orange-red
        }
      }

      if (this.camera) {
        parts.hpBarGroup.quaternion.copy(this.camera.quaternion);
      }
    }
  }

  // ============================================================================
  // 6. PROJECTILE VISUALS (`syncProjectiles`, `createProjectileVisual`, etc.)
  // ============================================================================

  syncProjectiles(projectiles = [], dt = 0.016, time = this._time) {
    if (!THREE || !Array.isArray(projectiles)) return;
    const activeSet = new Set();

    for (const proj of projectiles) {
      if (!proj || proj.dead) continue;
      const key = proj.id || proj;
      activeSet.add(key);

      let mesh = proj.mesh || this.projectileVisuals.get(key);
      if (!mesh) {
        mesh = this.createProjectileVisual(proj);
      }
      this.updateProjectileVisual(proj, dt, time);
    }

    // Clean up expired projectiles
    for (const [key, mesh] of this.projectileVisuals.entries()) {
      if (!activeSet.has(key)) {
        if (mesh && mesh.parent) mesh.parent.remove(mesh);
        this.projectileVisuals.delete(key);
      }
    }
  }

  createProjectileVisual(proj) {
    if (!THREE || !proj) return null;
    this._initSharedAssets();

    const pType = (proj.type || 'gatling').toLowerCase();
    const grp = new THREE.Group();

    if (pType === 'missile') {
      // Flying red-nosed silver rocket with fiery exhaust core
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.12, 0.48, 10),
        this.materials.missileBody
      );
      body.rotation.x = Math.PI / 2;
      grp.add(body);

      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.115, 0.26, 10),
        this.materials.missileRed
      );
      nose.rotation.x = Math.PI / 2;
      nose.position.z = 0.36;
      grp.add(nose);

      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.10, 0.32, 8),
        new THREE.MeshBasicMaterial({ color: 0xffb300 })
      );
      flame.rotation.x = -Math.PI / 2;
      flame.position.z = -0.36;
      grp.add(flame);
    } else if (pType === 'goo') {
      const glob = new THREE.Mesh(
        this.geometries.sphereLow,
        this.materials.gooSlimeGlow
      );
      glob.scale.set(0.20, 0.18, 0.28);
      grp.add(glob);
    } else {
      // Bright yellow-gold Gatling tracer streak
      const tracer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.035, 0.55, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe54c })
      );
      tracer.rotation.x = Math.PI / 2;
      grp.add(tracer);
    }

    grp.position.set(proj.x || 0, proj.y || 0.8, proj.z || 0);
    proj.mesh = grp;

    if (this.projectilesGroup) {
      this.projectilesGroup.add(grp);
    }
    this.projectileVisuals.set(proj.id || proj, grp);
    return grp;
  }

  updateProjectileVisual(proj, dt = 0.016, time = this._time) {
    if (!proj || !proj.mesh) return;
    const mesh = proj.mesh;
    const px = proj.x ?? 0;
    const py = proj.y ?? 0.85;
    const pz = proj.z ?? 0;
    mesh.position.set(px, py, pz);

    if (typeof proj.vx === 'number' && typeof proj.vz === 'number') {
      mesh.rotation.y = Math.atan2(proj.vx, proj.vz);
    } else if (proj.target && typeof proj.target.x === 'number') {
      mesh.rotation.y = Math.atan2(proj.target.x - px, proj.target.z - pz);
    }
  }

  removeProjectileVisual(proj) {
    if (!proj) return;
    const key = proj.id || proj;
    const mesh = proj.mesh || this.projectileVisuals.get(key);
    if (mesh && mesh.parent) mesh.parent.remove(mesh);
    this.projectileVisuals.delete(key);
  }

  // ============================================================================
  // 7. HIGH-IMPACT CARTOON VFX & SHADERS (`spawn*` & `updateVFX`)
  // ============================================================================

  /**
   * 1. `spawnMuzzleFlash(x, y, z, angle, scale)`
   * Multi-point bright yellow-orange cartoon star flash + smoke puff + bouncing brass shell casing.
   */
  spawnMuzzleFlash(arg0, arg1, arg2, arg3 = 0, arg4 = 1.0) {
    if (!THREE || !this.vfxGroup) return;
    this._initSharedAssets();

    let x, y, z, angle, scale;
    if (arg0 && typeof arg0 === 'object') {
      x = arg0.x || 0;
      y = arg0.y ?? 0.85;
      z = arg0.z || 0;
      angle = typeof arg1 === 'number' ? arg1 : 0;
      scale = typeof arg2 === 'number' ? arg2 : 1.0;
    } else {
      x = arg0 || 0;
      y = arg1 ?? 0.85;
      z = arg2 || 0;
      angle = arg3 || 0;
      scale = arg4 || 1.0;
    }

    // Pop-art starburst flash quad
    const starMesh = new THREE.Mesh(this.geometries.unitQuadXZ, this.materials.muzzleFlash);
    const sz = (0.75 + Math.random() * 0.35) * scale;
    starMesh.scale.set(sz, 1, sz);
    starMesh.position.set(x, y, z);
    starMesh.rotation.y = Math.random() * Math.PI * 2;
    this.vfxGroup.add(starMesh);

    this.particles.push({
      mesh: starMesh,
      vx: 0,
      vy: 0.2,
      vz: 0,
      age: 0,
      life: 0.085,
      startScale: sz,
      endScale: sz * 1.45,
    });

    // Bouncing brass shell casing ejected sideways
    if (this.shellCasings.length < 48) {
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.11, 6),
        this.materials.brassGold
      );
      shell.position.set(x, y, z);
      const ejectAngle = angle + Math.PI * 0.5 + (Math.random() - 0.5) * 0.5;
      const spd = 2.2 + Math.random() * 1.6;
      this.vfxGroup.add(shell);
      this.shellCasings.push({
        mesh: shell,
        vx: Math.cos(ejectAngle) * spd,
        vy: 3.4 + Math.random() * 1.5,
        vz: Math.sin(ejectAngle) * spd,
        rx: (Math.random() - 0.5) * 18,
        rz: (Math.random() - 0.5) * 18,
        age: 0,
        life: 0.65,
      });
    }
  }

  /**
   * 2. `spawnGooStream(fromPos, toPos, tier)` & `spawnGooSplat(x, z, radius)`
   * Pulsing neon-green slime beam + bubbly splash particles + persistent green slime puddle decal on grass.
   */
  spawnGooStream(fromPos, toPos, tier = 1) {
    if (!THREE || !this.vfxGroup || !fromPos || !toPos) return;
    this._initSharedAssets();

    const fx = fromPos.x || 0;
    const fy = fromPos.y ?? 0.85;
    const fz = fromPos.z || 0;
    const tx = toPos.x || 0;
    const ty = toPos.y ?? (toPos.isAir ? (toPos.flyHeight || 3.2) : 0.55);
    const tz = toPos.z || 0;

    const start = new THREE.Vector3(fx, fy, fz);
    const end = new THREE.Vector3(tx, ty, tz);
    const dist = start.distanceTo(end);
    if (dist < 0.05) return;

    const mid = start.clone().lerp(end, 0.5);
    const thickness = 0.08 + (tier - 1) * 0.025;
    const beamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(thickness * 0.85, thickness * 1.25, dist, 8),
      this.materials.gooSlimeGlow
    );
    beamMesh.position.copy(mid);
    beamMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize()
    );
    this.vfxGroup.add(beamMesh);

    this.gooStreams.push({
      mesh: beamMesh,
      age: 0,
      life: 0.11,
    });

    // Bubbly green splash droplet at target
    if (Math.random() < 0.45 && this.particles.length < 180) {
      const drop = new THREE.Mesh(this.geometries.sphereLow, this.materials.gooSlimeGlow);
      const r = 0.10 + Math.random() * 0.08;
      drop.scale.setScalar(r);
      drop.position.set(tx, ty, tz);
      this.vfxGroup.add(drop);
      this.particles.push({
        mesh: drop,
        vx: (Math.random() - 0.5) * 3.2,
        vy: 1.8 + Math.random() * 2.2,
        vz: (Math.random() - 0.5) * 3.2,
        gravity: 9.8,
        age: 0,
        life: 0.32,
        startScale: r,
        endScale: 0.02,
      });
    }
  }

  spawnGooGlob(fromPos, toPos, tier = 1) {
    this.spawnGooStream(fromPos, toPos, tier);
  }

  spawnGooSplat(arg0, arg1, arg2, arg3) {
    if (!THREE || !this.decalGroup) return;
    this._initSharedAssets();

    let x, z, radius;
    if (arg0 && typeof arg0 === 'object') {
      x = arg0.x || 0;
      z = arg0.z || 0;
      radius = typeof arg1 === 'number' ? arg1 : 1.5;
    } else if (arguments.length >= 4) {
      x = arg0 || 0;
      z = arg2 || 0;
      radius = arg3 || 1.5;
    } else {
      x = arg0 || 0;
      z = arg1 || 0;
      radius = arg2 || 1.5;
    }

    // Cap active decals for smooth performance
    if (this.decals.length > 55) {
      const oldest = this.decals.shift();
      if (oldest && oldest.mesh && oldest.mesh.parent) {
        oldest.mesh.parent.remove(oldest.mesh);
      }
    }

    const mat = new THREE.MeshBasicMaterial({
      map: this.textures.gooDecal,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const puddle = new THREE.Mesh(this.geometries.unitQuadXZ, mat);
    const sz = clamp(radius * 1.25, 1.2, 3.4);
    puddle.scale.set(sz, 1, sz);
    puddle.position.set(x, 0.025, z);
    puddle.rotation.y = Math.random() * Math.PI * 2;
    this.decalGroup.add(puddle);

    this.decals.push({
      mesh: puddle,
      mat,
      age: 0,
      life: 5.0,
      baseOpacity: 0.85,
    });
  }

  /**
   * 3. `spawnMissileSmokeTrail(x, y, z, vx, vz, phase)`
   * Corkscrew white/grey cartoon smoke puffs arranged in a tight helix behind flying rockets!
   */
  spawnMissileSmokeTrail(arg0, arg1, arg2, vx = 0, vz = 0, phase = 0) {
    if (!THREE || !this.vfxGroup || this.particles.length > 220) return;
    this._initSharedAssets();

    let x, y, z;
    if (arg0 && typeof arg0 === 'object') {
      x = arg0.x || 0;
      y = arg0.y ?? 1.0;
      z = arg0.z || 0;
      phase = typeof arg1 === 'number' ? arg1 : this._time * 18.0;
    } else {
      x = arg0 || 0;
      y = arg1 ?? 1.0;
      z = arg2 || 0;
    }

    const helixR = 0.11;
    const ox = Math.cos(phase) * helixR;
    const oy = Math.sin(phase) * helixR;

    const puffMat = new THREE.MeshBasicMaterial({
      color: 0xf4f8fc,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(this.geometries.sphereLow, puffMat);
    const r = 0.07 + Math.random() * 0.03;
    puff.scale.setScalar(r);
    puff.position.set(x + ox, Math.max(0.15, y + oy), z);
    this.vfxGroup.add(puff);

    this.particles.push({
      mesh: puff,
      mat: puffMat,
      vx: (Math.random() - 0.5) * 0.28,
      vy: 0.22 + Math.random() * 0.2,
      vz: (Math.random() - 0.5) * 0.28,
      age: 0,
      life: 0.28,
      startScale: r,
      endScale: r * 1.65,
    });
  }

  /**
   * 4. `spawnExplosion(x, y, z, radius, leaveCrater = true)`
   * Iconic Argon Towers pop-art explosion: expanding yellow/orange fireball core, puffy dark-grey
   * cartoon smoke cloud rings, flying metallic debris chunks, shockwave ring, and scorched crater decal!
   */
  spawnExplosion(arg0, arg1, arg2, arg3 = 2.5, arg4 = true) {
    if (!THREE || !this.vfxGroup) return;
    this._initSharedAssets();

    let x, y, z, radius, leaveCrater;
    if (arg0 && typeof arg0 === 'object') {
      x = arg0.x || 0;
      y = arg0.y ?? 0.6;
      z = arg0.z || 0;
      radius = typeof arg1 === 'number' ? arg1 : 2.5;
      leaveCrater = arg2 !== undefined ? Boolean(arg2) : true;
    } else {
      x = arg0 || 0;
      y = arg1 ?? 0.6;
      z = arg2 || 0;
      radius = typeof arg3 === 'number' ? arg3 : 2.5;
      leaveCrater = arg4 !== undefined ? Boolean(arg4) : true;
    }

    const scale = clamp(radius / 2.5, 0.55, 1.45);

    // 1. Bright yellow-white core fireball sphere
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfff36b,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(this.geometries.sphereMed, coreMat);
    coreMesh.position.set(x, Math.max(0.45, y), z);
    this.vfxGroup.add(coreMesh);
    this.particles.push({
      mesh: coreMesh,
      mat: coreMat,
      vx: 0,
      vy: 0.45,
      vz: 0,
      age: 0,
      life: 0.22,
      startScale: 0.28 * scale,
      endScale: 0.92 * scale,
    });

    // 2. Fiery orange-red secondary blast lobes (matching the explosions in ref_round89_dense_maze.png!)
    const lobeColors = [0xff8c00, 0xff4500, 0xffb300, 0xd9381e];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.random() * 0.4;
      const lobeMat = new THREE.MeshBasicMaterial({
        color: lobeColors[i % lobeColors.length],
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const lobe = new THREE.Mesh(this.geometries.sphereLow, lobeMat);
      lobe.position.set(
        x + Math.cos(a) * 0.22 * scale,
        Math.max(0.35, y) + (Math.random() - 0.3) * 0.2,
        z + Math.sin(a) * 0.22 * scale
      );
      this.vfxGroup.add(lobe);
      this.particles.push({
        mesh: lobe,
        mat: lobeMat,
        vx: Math.cos(a) * (1.5 + Math.random() * 1.1) * scale,
        vy: 0.9 + Math.random() * 1.2,
        vz: Math.sin(a) * (1.5 + Math.random() * 1.1) * scale,
        age: 0,
        life: 0.26 + Math.random() * 0.08,
        startScale: 0.22 * scale,
        endScale: 0.54 * scale,
      });
    }

    // 3. Compact warm-grey cartoon smoke puffs
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
      const smokeMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x625a52 : 0x7c7268,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      });
      const smoke = new THREE.Mesh(this.geometries.sphereLow, smokeMat);
      smoke.position.set(
        x + Math.cos(a) * 0.3 * scale,
        Math.max(0.3, y),
        z + Math.sin(a) * 0.3 * scale
      );
      this.vfxGroup.add(smoke);
      this.particles.push({
        mesh: smoke,
        mat: smokeMat,
        vx: Math.cos(a) * 1.8 * scale,
        vy: 1.1 + Math.random() * 0.9,
        vz: Math.sin(a) * 1.8 * scale,
        age: 0,
        life: 0.30 + Math.random() * 0.1,
        startScale: 0.18 * scale,
        endScale: 0.42 * scale,
      });
    }

    // 4. Expanding ground shockwave ring (`scale.set(r, 1, r)` on pre-rotated XZ RingGeometry)
    this._spawnShockwaveRing(x, Math.max(0.08, y * 0.2), z, radius * 0.85, 0xffa726, 0.26);

    // 5. Subtle Scorched-Earth Soot Decal on the grass (if on or near the ground)
    if (leaveCrater && y < 2.2 && this.decalGroup) {
      while (this.decals.length >= 18) {
        const oldest = this.decals.shift();
        if (oldest && oldest.mesh && oldest.mesh.parent) {
          oldest.mesh.parent.remove(oldest.mesh);
        }
      }
      const craterMat = new THREE.MeshBasicMaterial({
        map: this.textures.craterDecal,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const crater = new THREE.Mesh(this.geometries.unitQuadXZ, craterMat);
      const cSize = clamp(radius * 0.32, 0.48, 0.85);
      crater.scale.set(cSize, 1, cSize);
      crater.position.set(x, 0.022, z);
      crater.rotation.y = Math.random() * Math.PI * 2;
      this.decalGroup.add(crater);

      this.decals.push({
        mesh: crater,
        mat: craterMat,
        age: 0,
        life: 6.5,
        baseOpacity: 0.26,
      });
    }
  }

  _spawnShockwaveRing(x, y, z, maxRadius, colorHex = 0xffa726, duration = 0.32) {
    if (!THREE || !this.vfxGroup) return;
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.geometries.unitRingXZ, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(0.2, 1.0, 0.2);
    this.vfxGroup.add(mesh);

    this.shockwaves.push({
      mesh,
      mat,
      maxRadius,
      age: 0,
      life: duration,
    });
  }

  /**
   * 5. `spawnTeslaArc(startPos, targetPositions, tier)`
   * High-contrast branching jagged 3D lightning bolts (`cobalt #0066ff outer + cyan #00e5ff mid + white #ffffff core`)
   * jumping from the Tesla horns through every chained enemy with electric spark bursts at each node!
   */
  spawnTeslaArc(startPos, targetPositions, tier = 1) {
    if (!THREE || !this.vfxGroup || !startPos) return;
    this._initSharedAssets();

    const targets = Array.isArray(targetPositions)
      ? targetPositions
      : (targetPositions ? [targetPositions] : []);
    if (targets.length === 0) return;

    const nodes = [
      new THREE.Vector3(
        startPos.x || 0,
        startPos.y ?? 2.35,
        startPos.z || 0
      ),
    ];

    for (const t of targets) {
      if (!t) continue;
      const ty = t.y !== undefined && t.y > 0.2
        ? t.y
        : (t.isAir ? (t.flyHeight || 3.3) : 0.65);
      nodes.push(new THREE.Vector3(t.x || 0, ty, t.z || 0));
    }

    const arcGroup = new THREE.Group();

    const buildJaggedSegment = (pA, pB, radiusOuter, radiusCore) => {
      const dist = pA.distanceTo(pB);
      const steps = Math.max(4, Math.min(10, Math.floor(dist * 2.2)));
      const pts = [pA.clone()];
      for (let i = 1; i < steps; i++) {
        const f = i / steps;
        const pt = pA.clone().lerp(pB, f);
        const jitter = (1.0 - Math.abs(f - 0.5) * 1.6) * 0.42;
        pt.x += (Math.random() - 0.5) * jitter;
        pt.y += (Math.random() - 0.5) * jitter * 0.8;
        pt.z += (Math.random() - 0.5) * jitter;
        pts.push(pt);
      }
      pts.push(pB.clone());

      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const segLen = a.distanceTo(b);
        if (segLen < 0.01) continue;
        const mid = a.clone().lerp(b, 0.5);
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          b.clone().sub(a).normalize()
        );

        // Outer glowing cyan/cobalt sheath
        const outerSeg = new THREE.Mesh(
          this.geometries.cylUnit,
          this.materials.lightningMid
        );
        outerSeg.position.copy(mid);
        outerSeg.quaternion.copy(quat);
        outerSeg.scale.set(radiusOuter, segLen, radiusOuter);
        arcGroup.add(outerSeg);

        // Inner pure-white core bolt
        const coreSeg = new THREE.Mesh(
          this.geometries.cylUnit,
          this.materials.lightningCore
        );
        coreSeg.position.copy(mid);
        coreSeg.quaternion.copy(quat);
        coreSeg.scale.set(radiusCore, segLen, radiusCore);
        arcGroup.add(coreSeg);
      }
    };

    const rOuter = 0.085 + (tier - 1) * 0.018;
    const rCore = 0.036 + (tier - 1) * 0.008;

    for (let n = 0; n < nodes.length - 1; n++) {
      buildJaggedSegment(nodes[n], nodes[n + 1], rOuter, rCore);
      // Secondary fork strand for iconic Argon Towers double-bolt look (ref_early_tesla_zoom.png)
      buildJaggedSegment(nodes[n], nodes[n + 1], rOuter * 0.65, rCore * 0.55);

      // Electric impact burst sphere at each chained enemy node
      const sparkOrb = new THREE.Mesh(this.geometries.sphereLow, this.materials.lightningMid);
      sparkOrb.scale.setScalar(0.32);
      sparkOrb.position.copy(nodes[n + 1]);
      arcGroup.add(sparkOrb);
    }

    this.vfxGroup.add(arcGroup);
    this.lightningArcs.push({
      group: arcGroup,
      age: 0,
      life: 0.16,
    });
  }

  /**
   * 6. `spawnFloatingText(x, y, z, text, color)` & `spawnFloatingText(text, x, y, z, color)`
   * Crisp billboarded pop-art floating callouts (`+$1`, `+$18`, `POW!`, `ZAP!`, `BOOM!`).
   */
  spawnFloatingText(arg0, arg1, arg2, arg3 = '+$1', arg4 = '#ffd740') {
    if (!THREE || !this.vfxGroup || typeof document === 'undefined') return;

    let x, y, z, text, color;
    if (typeof arg0 === 'string') {
      // Called as `spawnFloatingText(text, x, y, z, color)` (e.g., `enemy_waves.js`)
      text = arg0;
      x = typeof arg1 === 'number' ? arg1 : 0;
      y = typeof arg2 === 'number' ? arg2 : 1.4;
      z = typeof arg3 === 'number' ? arg3 : 0;
      color = String(arg4 || '#ffd740');
    } else if (arg0 && typeof arg0 === 'object') {
      x = arg0.x || 0;
      y = arg0.y ?? 1.4;
      z = arg0.z || 0;
      text = String(arg1 || '+$1');
      color = String(arg2 || '#ffd740');
    } else {
      x = arg0 || 0;
      y = arg1 ?? 1.4;
      z = arg2 || 0;
      text = String(arg3 || '+$1');
      color = String(arg4 || '#ffd740');
    }

    const cacheKey = `${text}_${color}_512`;
    let tex = this.floatingTextCache.get(cacheKey);
    if (!tex) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      ctx.font = '900 42px "Impact", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Heavy comic black outline + drop shadow
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#14100a';
      ctx.strokeText(text, 256, 50);

      ctx.fillStyle = color;
      ctx.fillText(text, 256, 48);

      tex = applySRGB(new THREE.CanvasTexture(canvas));
      if (this.floatingTextCache.size > 64) {
        const firstKey = this.floatingTextCache.keys().next().value;
        this.floatingTextCache.delete(firstKey);
      }
      this.floatingTextCache.set(cacheKey, tex);
    }

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, Math.max(1.2, y), z);
    sprite.scale.set(3.4, 0.64, 1.0);
    sprite.renderOrder = 30;
    this.vfxGroup.add(sprite);

    this.floatingTexts.push({
      sprite,
      mat,
      age: 0,
      life: 0.85,
      vy: 1.65,
    });
  }

  clearFloatingTexts() {
    if (!this.floatingTexts) return;
    while (this.floatingTexts.length > 0) {
      const item = this.floatingTexts.pop();
      if (item && item.sprite && item.sprite.parent) {
        item.sprite.parent.remove(item.sprite);
      }
    }
  }

  // Additional VFX hooks & aliases called by `tower_system.js` and `enemy_waves.js`
  spawnBuildEffect(posVec, tower) {
    const x = (posVec && posVec.x) ?? (tower && tower.x) ?? 0;
    const z = (posVec && posVec.z) ?? (tower && tower.z) ?? 0;
    this._spawnShockwaveRing(x, 0.12, z, 1.45, 0x8cff42, 0.30);
  }

  spawnUpgradeEffect(posVec, tower) {
    const x = (posVec && posVec.x) ?? (tower && tower.x) ?? 0;
    const z = (posVec && posVec.z) ?? (tower && tower.z) ?? 0;
    this._spawnShockwaveRing(x, 0.14, z, 1.85, 0xffd740, 0.36);
  }

  spawnSellEffect(posVec, tower, refund) {
    const x = (posVec && posVec.x) ?? (tower && tower.x) ?? 0;
    const z = (posVec && posVec.z) ?? (tower && tower.z) ?? 0;
    this._spawnShockwaveRing(x, 0.12, z, 1.55, 0xffca28, 0.32);
    if (refund !== undefined) {
      this.spawnFloatingText(x, 1.5, z, `+$${refund}`, '#ffd740');
    }
  }

  spawnShellCasing(ejectPos, turretYaw = 0) {
    if (!THREE || !this.vfxGroup || this.shellCasings.length >= 48) return;
    const x = (ejectPos && ejectPos.x) || 0;
    const y = (ejectPos && ejectPos.y) ?? 0.85;
    const z = (ejectPos && ejectPos.z) || 0;
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.11, 6),
      this.materials.brassGold
    );
    shell.position.set(x, y, z);
    const ejectAngle = turretYaw + Math.PI * 0.5 + (Math.random() - 0.5) * 0.4;
    const spd = 2.0 + Math.random() * 1.4;
    this.vfxGroup.add(shell);
    this.shellCasings.push({
      mesh: shell,
      vx: Math.cos(ejectAngle) * spd,
      vy: 3.2 + Math.random() * 1.4,
      vz: Math.sin(ejectAngle) * spd,
      rx: (Math.random() - 0.5) * 18,
      rz: (Math.random() - 0.5) * 18,
      age: 0,
      life: 0.65,
    });
  }

  spawnBrassCasing(ejectPos, dir, tower) {
    return this.spawnShellCasing(ejectPos, (tower && tower.turretYaw) || 0);
  }

  spawnBulletImpact(impactPos) {
    if (!impactPos) return;
    this.spawnMuzzleFlash(impactPos.x || 0, impactPos.y ?? 0.65, impactPos.z || 0, 0, 0.55);
  }

  spawnHitEffect(impactPos) {
    return this.spawnBulletImpact(impactPos);
  }

  spawnGooSplatter(groundPos, splashRadius = 1.5) {
    return this.spawnGooSplat(groundPos, splashRadius);
  }

  spawnGooDecal(groundPos, splashRadius = 1.5) {
    return this.spawnGooSplat(groundPos, splashRadius);
  }

  spawnGooPool(groundPos, splashRadius = 1.5) {
    return this.spawnGooSplat(groundPos, splashRadius);
  }

  spawnScorchDecal(groundPos, splashRadius = 2.2) {
    if (!THREE || !this.decalGroup || !groundPos) return;
    this._initSharedAssets();
    while (this.decals.length >= 18) {
      const oldest = this.decals.shift();
      if (oldest && oldest.mesh && oldest.mesh.parent) {
        oldest.mesh.parent.remove(oldest.mesh);
      }
    }
    const x = groundPos.x || 0;
    const z = groundPos.z || 0;
    const craterMat = new THREE.MeshBasicMaterial({
      map: this.textures.craterDecal,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const crater = new THREE.Mesh(this.geometries.unitQuadXZ, craterMat);
    const cSize = clamp(splashRadius * 0.32, 0.48, 0.85);
    crater.scale.set(cSize, 1, cSize);
    crater.position.set(x, 0.022, z);
    crater.rotation.y = Math.random() * Math.PI * 2;
    this.decalGroup.add(crater);
    this.decals.push({
      mesh: crater,
      mat: craterMat,
      age: 0,
      life: 6.5,
      baseOpacity: 0.26,
    });
  }

  spawnScorchedEarthDecal(groundPos, splashRadius = 2.2) {
    return this.spawnScorchDecal(groundPos, splashRadius);
  }

  spawnLightningArc(fromPos, chainPositions, tier = 1) {
    return this.spawnTeslaArc(fromPos, chainPositions, tier);
  }

  spawnDeathEffect(enemy) {
    if (!enemy) return;
    const ex = enemy.x || 0;
    const ey = enemy.isAir ? (enemy.y || enemy.flyHeight || 3.3) : 0.55;
    const ez = enemy.z || 0;
    const isVehicle = enemy.type === 'mech' || enemy.type === 'transport' || enemy.type === 'chopper' || enemy.type === 'zeppelin' || enemy.type === 'biker';
    const radius = enemy.type === 'zeppelin' ? 3.8 : (isVehicle ? 2.4 : 1.35);
    this.spawnExplosion(ex, ey, ez, radius, !enemy.isAir && isVehicle);
  }

  spawnExhaustPuff(x = 0, y = 0.6, z = 0, scale = 1.0, isDamaged = false) {
    if (!THREE || !this.vfxGroup || this.particles.length > 220) return;
    const puffMat = new THREE.MeshBasicMaterial({
      color: isDamaged ? 0x3b3835 : 0xdbe2e8,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(this.geometries.sphereLow, puffMat);
    const r = (0.10 + Math.random() * 0.05) * scale;
    puff.scale.setScalar(r);
    puff.position.set(x, y, z);
    this.vfxGroup.add(puff);
    this.particles.push({
      mesh: puff,
      mat: puffMat,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 0.6 + Math.random() * 0.4,
      vz: (Math.random() - 0.5) * 0.4,
      age: 0,
      life: 0.38,
      startScale: r,
      endScale: r * 2.1,
    });
  }

  spawnSmokePuff(x, y, z, scale = 1.0) {
    return this.spawnExhaustPuff(x, y, z, scale, false);
  }

  /**
   * Master per-frame VFX tick (`updateVFX(dt, time)` and alias `update(dt, time)`).
   */
  updateVFX(dt = 0.016, time = null) {
    this._time = (typeof time === 'number') ? time : (this._time + dt);

    // 1. Update particles (muzzle flashes, explosion fireballs, smoke puffs, goo droplets)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      const t = p.age / p.life;
      if (p.gravity) {
        p.vy -= p.gravity * dt;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      const s = lerp(p.startScale, p.endScale, t);
      if (p.mesh.geometry === this.geometries.unitQuadXZ) {
        p.mesh.scale.set(s, 1, s);
      } else {
        p.mesh.scale.setScalar(s);
      }

      if (p.mat) {
        p.mat.opacity = clamp((1.0 - t) * 1.15, 0, 1);
      }
    }

    // 2. Update bouncing brass shell casings
    for (let i = this.shellCasings.length - 1; i >= 0; i--) {
      const c = this.shellCasings[i];
      c.age += dt;
      if (c.age >= c.life) {
        if (c.mesh && c.mesh.parent) c.mesh.parent.remove(c.mesh);
        this.shellCasings.splice(i, 1);
        continue;
      }
      c.vy -= 14.0 * dt;
      c.mesh.position.x += c.vx * dt;
      c.mesh.position.y += c.vy * dt;
      c.mesh.position.z += c.vz * dt;
      if (c.mesh.position.y < 0.05) {
        c.mesh.position.y = 0.05;
        c.vy = Math.abs(c.vy) * 0.42;
        c.vx *= 0.65;
        c.vz *= 0.65;
      }
      c.mesh.rotation.x += c.rx * dt;
      c.mesh.rotation.z += c.rz * dt;
    }

    // 3. Update Goo streams
    for (let i = this.gooStreams.length - 1; i >= 0; i--) {
      const gs = this.gooStreams[i];
      gs.age += dt;
      if (gs.age >= gs.life) {
        if (gs.mesh && gs.mesh.parent) gs.mesh.parent.remove(gs.mesh);
        this.gooStreams.splice(i, 1);
      }
    }

    // 4. Update Tesla lightning arcs
    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      const la = this.lightningArcs[i];
      la.age += dt;
      if (la.age >= la.life) {
        if (la.group && la.group.parent) la.group.parent.remove(la.group);
        this.lightningArcs.splice(i, 1);
      } else {
        la.group.visible = (Math.floor(la.age * 60) % 2 === 0) || la.age < 0.06;
      }
    }

    // 5. Update expanding ground shockwave rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.age += dt;
      if (sw.age >= sw.life) {
        if (sw.mesh && sw.mesh.parent) sw.mesh.parent.remove(sw.mesh);
        this.shockwaves.splice(i, 1);
        continue;
      }
      const t = sw.age / sw.life;
      const r = lerp(0.25, sw.maxRadius, 1.0 - Math.pow(1.0 - t, 2));
      sw.mesh.scale.set(r, 1.0, r);
      sw.mat.opacity = (1.0 - t) * 0.85;
    }

    // 6. Update persistent ground decals (Goo puddles & scorched explosion craters)
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.age += dt;
      if (d.age >= d.life) {
        if (d.mesh && d.mesh.parent) d.mesh.parent.remove(d.mesh);
        this.decals.splice(i, 1);
        continue;
      }
      const fadeStart = d.life * 0.65;
      if (d.age > fadeStart && d.mat) {
        const ft = (d.age - fadeStart) / (d.life - fadeStart);
        d.mat.opacity = d.baseOpacity * (1.0 - ft);
      }
    }

    // 7. Update floating callout texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += dt;
      if (ft.age >= ft.life) {
        if (ft.sprite && ft.sprite.parent) ft.sprite.parent.remove(ft.sprite);
        this.floatingTexts.splice(i, 1);
        continue;
      }
      const t = ft.age / ft.life;
      ft.sprite.position.y += ft.vy * (1.0 - t * 0.5) * dt;
      ft.mat.opacity = t < 0.65 ? 1.0 : (1.0 - (t - 0.65) / 0.35);
    }
  }

  update(dt, time) {
    this.updateVFX(dt, time);
  }

  clearAll() {
    for (const [, grp] of this.towerVisuals) {
      if (grp && grp.parent) grp.parent.remove(grp);
    }
    this.towerVisuals.clear();

    for (const [, grp] of this.enemyVisuals) {
      if (grp && grp.parent) grp.parent.remove(grp);
    }
    this.enemyVisuals.clear();

    for (const [, grp] of this.projectileVisuals) {
      if (grp && grp.parent) grp.parent.remove(grp);
    }
    this.projectileVisuals.clear();

    if (this.decalGroup) {
      while (this.decalGroup.children.length > 0) {
        this.decalGroup.remove(this.decalGroup.children[0]);
      }
    }
    if (this.vfxGroup) {
      while (this.vfxGroup.children.length > 0) {
        this.vfxGroup.remove(this.vfxGroup.children[0]);
      }
    }
    this.particles.length = 0;
    this.shellCasings.length = 0;
    this.decals.length = 0;
    this.gooStreams.length = 0;
    this.lightningArcs.length = 0;
    this.floatingTexts.length = 0;
    this.shockwaves.length = 0;
  }
}

if (typeof window !== 'undefined') {
  window.ArgonTowersVisuals = ArgonTowersVisuals;
}

export { ArgonTowersVisuals };
