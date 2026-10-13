import * as THREE from '../assets/vendor/three.module.js';

/**
 * The Corridor (Argon Studio / Corridor Engine) — Agent 3: Horror AI, The Possessed Entity ("Lisa") & Jump-Scare Engine
 * Owns:
 *   - LisaEntityController:
 *       * High-detail sculpted 3D anatomical character mesh of Lisa (1.92m tall gaunt silhouette)
 *       * 1024x1024 procedural Necrotic Corpse Skin Texture + Bump/Roughness maps
 *       * Asymmetric Uncanny Eyes (Bulging milky-white cataract right eye + sunken hollow left socket)
 *       * Hinged screaming lower jaw with 12 upper + 12 lower sculpted stained 3D teeth & dark gums
 *       * 56 sculpted curved 3D wet stringy black hair ribbons/locks framing forehead, cheeks, and shoulders
 *       * 1024x1024 procedural Filthy Blood-Stained Beige Nightgown with vertical pleats & jagged torn hem
 *       * Gaunt veined arms, 10 articulated bony fingers with dark nails, and bare corpse feet
 *       * Towering hallway shadow backdrop silhouette + dedicated preset rim/key illumination
 *       * 10Hz quantized stop-motion skeletal twitch & stalk animation + Haunting State Machine
 *       * Deterministic Scene Presets ('lisa_corner_stalk' -> ref_04, 'lisa_jumpscare_closeup' -> ref_06)
 */

export const LISA_STATES = Object.freeze({
  HIDDEN: 'hidden',
  CORNER_PEEK: 'corner_peek',
  FLICKER_STALK: 'flicker_stalk',
  BEHIND_PLAYER_STALK: 'behind_player_stalk',
  MIRROR_APPARITION: 'mirror_apparition',
  JUMPSCARE_LUNGE: 'jumpscare_lunge',
});

// Deterministic PRNG for repeatable procedural textures & vertex sculpting
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash1D(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export class LisaEntityController {
  /**
   * @param {THREE.Scene|Object} [sceneOrOptions]
   * @param {Object} [options]
   */
  constructor(sceneOrOptions = null, options = {}) {
    let scene = null;
    let opts = options || {};

    if (sceneOrOptions && sceneOrOptions.isObject3D) {
      scene = sceneOrOptions;
    } else if (sceneOrOptions && typeof sceneOrOptions === 'object') {
      opts = sceneOrOptions;
      scene = opts.scene || null;
    }

    this.scene = scene;
    this.camera = opts.camera || null;
    this.flashlightSystem = opts.flashlightSystem || null;
    this.soundscape = opts.soundscape || opts.audio || null;
    this.postProcessor = opts.postProcessor || null;
    this.firstPersonEngine = opts.firstPersonEngine || opts.fpEngine || null;
    this.captureMode = Boolean(opts.captureMode || (options && options.captureMode));

    // Callbacks
    this.onJumpScareCallback = opts.onJumpScare || null;
    this.onWhisperCallback = opts.onWhisper || null;

    // Haunting state machine
    this.state = LISA_STATES.HIDDEN;
    this.activePreset = null;
    this.presetLockTimer = 0;
    this.loopNumber = 1;
    this.stateTimer = 0;
    this.explorationTimer = 0;
    this.hauntStage = 0; // 0 = doorway/corner peek, 1 = corridor flicker stalk, 2 = behind-player stalk
    this.hauntCycleCount = 0;
    this.flashlightAimTimer = 0;
    this.peekLocation = 'bathroom_door'; // 'north_corner' | 'bathroom_door'
    this.peekFactor = 1.0; // 1 = peeking out, 0 = retracted behind wall
    this.flickerPulseIndex = 0;
    this._usingExternalFlickerCallbacks = false;
    this.jumpScareTimer = 0;
    this.jumpScareDuration = 1.75;
    this.jumpScareCompleteCallback = null;
    this.tensionLevel = 0;
    this.cooldownTimer = 1.2;

    // Base world transform trackers for smooth gliding vs quantized pose twitching
    this.basePosition = new THREE.Vector3(-0.12, 0.0, -9.15);
    this.baseRotationY = 0;

    // Joint dictionary for convenient external inspection
    this.joints = {};

    // Build procedural textures, materials, and the full articulated 3D character mesh
    this.textures = {};
    this.materials = {};
    this.buildLisaMesh();

    if (this.scene) {
      this.scene.add(this.root);
    }

    // Start hidden until triggered or set to a preset
    this.setPresetPose('foyer_corridor', this.camera);
  }

  // ============================================================================
  // 1. PROCEDURAL TEXTURES & PBR MATERIALS (1024x1024)
  // ============================================================================

  /**
   * High-resolution 1024x1024 procedural Necrotic Corpse Skin Texture + matching Bump/Normal map.
   * Pale ash-grey corpse complexion (#b2b5b2 / #7d827e), branching dark purple-black subcutaneous
   * veins across forehead, nose bridge, and cheeks, deep nasolabial folds, dark bruised periorbital
   * eye rings, and damp cold-sweat specular sheen.
   */
  createLisaFaceTexture() {
    if (typeof document === 'undefined') {
      return { map: null, bumpMap: null, roughnessMap: null };
    }

    const size = 1024;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d');

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d');

    const rng = mulberry32(778004);

    // 1. Base necrotic pale ash-grey corpse skin gradient
    const baseGrad = ctx.createRadialGradient(
      size * 0.5,
      size * 0.44,
      size * 0.06,
      size * 0.5,
      size * 0.5,
      size * 0.62
    );
    baseGrad.addColorStop(0.0, '#bfc4c2');
    baseGrad.addColorStop(0.38, '#a5aba8');
    baseGrad.addColorStop(0.72, '#7d827e');
    baseGrad.addColorStop(1.0, '#585c5a');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, size, size);

    // Neutral bump & damp skin roughness base
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    rCtx.fillStyle = '#686868';
    rCtx.fillRect(0, 0, size, size);

    // 2. Mottled livor mortis / corpse skin blotches (pores, ash-grey/slate patches)
    for (let i = 0; i < 1400; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 4 + rng() * 38;
      const isDark = rng() > 0.45;
      const alpha = 0.025 + rng() * 0.06;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      if (isDark) {
        grad.addColorStop(0, `rgba(52, 56, 58, ${alpha})`);
        grad.addColorStop(1, 'rgba(52, 56, 58, 0)');
      } else {
        grad.addColorStop(0, `rgba(205, 212, 210, ${alpha})`);
        grad.addColorStop(1, 'rgba(205, 212, 210, 0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine skin pore & dermal roughness grain
    for (let i = 0; i < 9000; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const ps = 1 + rng() * 2.4;
      const v = rng() > 0.5 ? 105 : 150;
      bCtx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.16)`;
      bCtx.fillRect(x, y, ps, ps);
      if (i % 3 === 0) {
        const rv = 55 + Math.floor(rng() * 75);
        rCtx.fillStyle = `rgba(${rv}, ${rv}, ${rv}, 0.14)`;
        rCtx.fillRect(x, y, ps * 2, ps * 2);
      }
    }

    // 3. Anatomical facial contours (forehead highlight, temple hollows, cheek hollows, nose bridge)
    // Forehead & nose bridge pale highlight (catches flashlight harshly in ref_06)
    const foreheadHighlight = ctx.createRadialGradient(
      size * 0.5,
      size * 0.28,
      size * 0.02,
      size * 0.5,
      size * 0.28,
      size * 0.22
    );
    foreheadHighlight.addColorStop(0, 'rgba(222, 227, 225, 0.55)');
    foreheadHighlight.addColorStop(1, 'rgba(222, 227, 225, 0)');
    ctx.fillStyle = foreheadHighlight;
    ctx.fillRect(0, 0, size, size);

    // Damp sweat sheen on forehead, nose bridge, and cheekbones (darker in roughness map = glossier)
    const sweatZones = [
      { x: 0.5, y: 0.27, rx: 0.18, ry: 0.11 },
      { x: 0.5, y: 0.49, rx: 0.05, ry: 0.12 },
      { x: 0.34, y: 0.52, rx: 0.09, ry: 0.07 },
      { x: 0.66, y: 0.52, rx: 0.09, ry: 0.07 },
    ];
    for (const z of sweatZones) {
      const sg = rCtx.createRadialGradient(
        z.x * size,
        z.y * size,
        4,
        z.x * size,
        z.y * size,
        Math.max(z.rx, z.ry) * size
      );
      sg.addColorStop(0, 'rgba(28, 28, 28, 0.75)');
      sg.addColorStop(1, 'rgba(90, 90, 90, 0)');
      rCtx.fillStyle = sg;
      rCtx.beginPath();
      rCtx.arc(z.x * size, z.y * size, Math.max(z.rx, z.ry) * size, 0, Math.PI * 2);
      rCtx.fill();
    }

    // Sunken gaunt cheek hollows (below cheekbones)
    const cheekHollows = [
      { x: 0.29, y: 0.63, r: 0.13 },
      { x: 0.71, y: 0.63, r: 0.13 },
      { x: 0.23, y: 0.36, r: 0.11 }, // Left temple
      { x: 0.77, y: 0.36, r: 0.11 }, // Right temple
    ];
    for (const ch of cheekHollows) {
      const cg = ctx.createRadialGradient(
        ch.x * size,
        ch.y * size,
        4,
        ch.x * size,
        ch.y * size,
        ch.r * size
      );
      cg.addColorStop(0, 'rgba(34, 38, 40, 0.68)');
      cg.addColorStop(0.6, 'rgba(55, 60, 62, 0.32)');
      cg.addColorStop(1, 'rgba(55, 60, 62, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(ch.x * size, ch.y * size, ch.r * size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Deep dark bruised periorbital eye rings (asymmetric: right eye socket dark & bruised, left eye socket pitch-black rotten void)
    // Right Eye (Viewer's Left, u ~ 0.36, v ~ 0.41)
    const rightEyeRing = ctx.createRadialGradient(
      size * 0.365,
      size * 0.415,
      size * 0.015,
      size * 0.365,
      size * 0.415,
      size * 0.105
    );
    rightEyeRing.addColorStop(0.0, 'rgba(18, 12, 16, 0.92)');
    rightEyeRing.addColorStop(0.45, 'rgba(38, 24, 30, 0.78)');
    rightEyeRing.addColorStop(0.75, 'rgba(65, 52, 58, 0.42)');
    rightEyeRing.addColorStop(1.0, 'rgba(65, 52, 58, 0)');
    ctx.fillStyle = rightEyeRing;
    ctx.beginPath();
    ctx.arc(size * 0.365, size * 0.415, size * 0.105, 0, Math.PI * 2);
    ctx.fill();

    // Left Eye (Viewer's Right, u ~ 0.635, v ~ 0.415) — deeper, wider blackened rot
    const leftEyeVoid = ctx.createRadialGradient(
      size * 0.635,
      size * 0.418,
      size * 0.02,
      size * 0.635,
      size * 0.418,
      size * 0.125
    );
    leftEyeVoid.addColorStop(0.0, 'rgba(4, 4, 6, 0.98)');
    leftEyeVoid.addColorStop(0.42, 'rgba(12, 11, 15, 0.92)');
    leftEyeVoid.addColorStop(0.72, 'rgba(36, 32, 38, 0.62)');
    leftEyeVoid.addColorStop(1.0, 'rgba(36, 32, 38, 0)');
    ctx.fillStyle = leftEyeVoid;
    ctx.beginPath();
    ctx.arc(size * 0.635, size * 0.418, size * 0.125, 0, Math.PI * 2);
    ctx.fill();

    // 5. Forehead horizontal creases, glabellar frown furrows, and deep nasolabial folds
    const drawSkinCrease = (points, width, darkness, bumpDepth) => {
      ctx.save();
      ctx.strokeStyle = `rgba(26, 28, 30, ${darkness})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p[0] * size, p[1] * size);
        else ctx.lineTo(p[0] * size, p[1] * size);
      });
      ctx.stroke();

      // Highlight edge next to crease
      ctx.strokeStyle = `rgba(215, 220, 218, ${darkness * 0.45})`;
      ctx.lineWidth = width * 0.65;
      ctx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p[0] * size, (p[1] - 0.004) * size);
        else ctx.lineTo(p[0] * size, (p[1] - 0.004) * size);
      });
      ctx.stroke();
      ctx.restore();

      // Bump trench
      bCtx.save();
      bCtx.strokeStyle = `rgba(30, 30, 30, ${bumpDepth})`;
      bCtx.lineWidth = width * 1.15;
      bCtx.lineCap = 'round';
      bCtx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) bCtx.moveTo(p[0] * size, p[1] * size);
        else bCtx.lineTo(p[0] * size, p[1] * size);
      });
      bCtx.stroke();
      bCtx.restore();
    };

    // Forehead horizontal lines
    drawSkinCrease([[0.36, 0.22], [0.5, 0.23], [0.64, 0.22]], 3.5, 0.42, 0.65);
    drawSkinCrease([[0.34, 0.26], [0.5, 0.275], [0.66, 0.26]], 4.2, 0.48, 0.72);
    drawSkinCrease([[0.38, 0.30], [0.5, 0.312], [0.62, 0.30]], 3.8, 0.44, 0.65);

    // Vertical glabellar frown lines between eyebrows (prominent in ref_06)
    drawSkinCrease([[0.475, 0.32], [0.48, 0.365], [0.478, 0.40]], 4.8, 0.62, 0.82);
    drawSkinCrease([[0.525, 0.32], [0.52, 0.365], [0.522, 0.40]], 4.8, 0.62, 0.82);
    drawSkinCrease([[0.50, 0.33], [0.50, 0.39]], 3.4, 0.52, 0.7);

    // Deep nasolabial folds (from sides of nostrils down past mouth corners — super sharp in ref_06!)
    drawSkinCrease(
      [[0.435, 0.535], [0.395, 0.595], [0.38, 0.675], [0.395, 0.755]],
      6.5,
      0.72,
      0.9
    );
    drawSkinCrease(
      [[0.565, 0.535], [0.605, 0.595], [0.62, 0.675], [0.605, 0.755]],
      6.5,
      0.72,
      0.9
    );
    // Secondary gaunt cheek creases
    drawSkinCrease([[0.34, 0.51], [0.32, 0.58], [0.34, 0.68]], 4.2, 0.52, 0.75);
    drawSkinCrease([[0.66, 0.51], [0.68, 0.58], [0.66, 0.68]], 4.2, 0.52, 0.75);

    // Dark nostril cavities & philtrum shadow
    ctx.fillStyle = 'rgba(10, 8, 10, 0.92)';
    ctx.beginPath();
    ctx.ellipse(size * 0.472, size * 0.548, size * 0.016, size * 0.01, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.528, size * 0.548, size * 0.016, size * 0.01, 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Darkened necrotic upper/lower lip rim zone
    const mouthDark = ctx.createRadialGradient(
      size * 0.5,
      size * 0.68,
      size * 0.02,
      size * 0.5,
      size * 0.68,
      size * 0.13
    );
    mouthDark.addColorStop(0.0, 'rgba(18, 12, 14, 0.88)');
    mouthDark.addColorStop(0.65, 'rgba(38, 28, 30, 0.58)');
    mouthDark.addColorStop(1.0, 'rgba(38, 28, 30, 0)');
    ctx.fillStyle = mouthDark;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.68, size * 0.13, 0, Math.PI * 2);
    ctx.fill();

    // 6. Branching dark purple-black subcutaneous necrotic veins across forehead, temples, nose bridge, and cheeks
    const drawNecroticVeinBranch = (x, y, angle, length, width, depth) => {
      if (depth <= 0 || width < 0.35) return;
      const steps = 10;
      const stepLen = length / steps;
      let cx = x;
      let cy = y;
      let curAngle = angle;

      ctx.save();
      ctx.strokeStyle =
        depth > 2
          ? 'rgba(28, 20, 32, 0.55)'
          : 'rgba(42, 28, 44, 0.38)';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);

      bCtx.save();
      bCtx.strokeStyle = 'rgba(165, 165, 165, 0.35)';
      bCtx.lineWidth = width * 1.2;
      bCtx.beginPath();
      bCtx.moveTo(cx, cy);

      for (let s = 0; s < steps; s++) {
        curAngle += (rng() - 0.5) * 0.55;
        cx += Math.cos(curAngle) * stepLen;
        cy += Math.sin(curAngle) * stepLen;
        ctx.lineTo(cx, cy);
        bCtx.lineTo(cx, cy);

        if (s === 4 || s === 7) {
          const branchSign = rng() > 0.5 ? 1 : -1;
          drawNecroticVeinBranch(
            cx,
            cy,
            curAngle + branchSign * (0.45 + rng() * 0.45),
            length * (0.55 + rng() * 0.2),
            width * 0.65,
            depth - 1
          );
        }
      }
      ctx.stroke();
      ctx.restore();
      bCtx.stroke();
      bCtx.restore();
    };

    const veinRoots = [
      // Forehead & temples
      [0.42 * size, 0.18 * size, Math.PI * 0.55, 110, 2.8, 4],
      [0.58 * size, 0.18 * size, Math.PI * 0.45, 110, 2.8, 4],
      [0.32 * size, 0.28 * size, Math.PI * 0.35, 95, 2.4, 3],
      [0.68 * size, 0.28 * size, Math.PI * 0.65, 95, 2.4, 3],
      // Under eyes & across cheekbones
      [0.35 * size, 0.47 * size, Math.PI * 0.6, 105, 2.6, 4],
      [0.65 * size, 0.47 * size, Math.PI * 0.4, 105, 2.6, 4],
      [0.28 * size, 0.54 * size, Math.PI * 0.45, 95, 2.2, 3],
      [0.72 * size, 0.54 * size, Math.PI * 0.55, 95, 2.2, 3],
      // Nose bridge & jaw/chin
      [0.49 * size, 0.38 * size, Math.PI * 0.52, 85, 2.0, 3],
      [0.43 * size, 0.72 * size, Math.PI * 0.48, 80, 2.3, 3],
      [0.57 * size, 0.72 * size, Math.PI * 0.52, 80, 2.3, 3],
    ];
    for (const [vx, vy, va, vl, vw, vd] of veinRoots) {
      drawNecroticVeinBranch(vx, vy, va, vl, vw, vd);
    }

    // Subtle dried blood smear near left corner of mouth / chin (visible in ref_06)
    const bloodSmear = ctx.createRadialGradient(
      size * 0.58,
      size * 0.77,
      4,
      size * 0.58,
      size * 0.77,
      size * 0.065
    );
    bloodSmear.addColorStop(0, 'rgba(72, 12, 14, 0.65)');
    bloodSmear.addColorStop(1, 'rgba(72, 12, 14, 0)');
    ctx.fillStyle = bloodSmear;
    ctx.beginPath();
    ctx.arc(size * 0.58, size * 0.77, size * 0.065, 0, Math.PI * 2);
    ctx.fill();

    // 7. Organic ragged hair-root border along top crown (y < 0.14 * size) with irregular wet root wisps
    // so the forehead hairline reads as natural wet hair roots rather than a flat geometric bar
    const topHairGrad = ctx.createLinearGradient(0, 0, 0, size * 0.135);
    topHairGrad.addColorStop(0.0, 'rgba(3, 4, 5, 0.98)');
    topHairGrad.addColorStop(0.55, 'rgba(6, 7, 9, 0.82)');
    topHairGrad.addColorStop(1.0, 'rgba(8, 10, 12, 0.0)');
    ctx.fillStyle = topHairGrad;
    ctx.fillRect(0, 0, size, size * 0.135);

    // Fine irregular wet black root wisps descending from the hairline across the upper forehead (y = 0..0.19 * size)
    for (let i = 0; i < 68; i++) {
      const wx = (0.08 + (i / 68) * 0.84 + (rng() - 0.5) * 0.015) * size;
      const wLen = (0.095 + rng() * 0.085) * size;
      const wGrad = ctx.createLinearGradient(wx, 0, wx, wLen);
      wGrad.addColorStop(0.0, 'rgba(3, 4, 5, 0.92)');
      wGrad.addColorStop(0.65, 'rgba(6, 7, 9, 0.55)');
      wGrad.addColorStop(1.0, 'rgba(6, 7, 9, 0.0)');
      ctx.strokeStyle = wGrad;
      ctx.lineWidth = 1.2 + rng() * 2.4;
      ctx.beginPath();
      ctx.moveTo(wx, 0);
      ctx.quadraticCurveTo(
        wx + (rng() - 0.5) * 14,
        wLen * 0.55,
        wx + (rng() - 0.5) * 22,
        wLen
      );
      ctx.stroke();
    }

    const leftTempleGrad = ctx.createLinearGradient(0, 0, size * 0.10, 0);
    leftTempleGrad.addColorStop(0.0, 'rgba(3, 4, 5, 0.96)');
    leftTempleGrad.addColorStop(0.7, 'rgba(6, 7, 9, 0.68)');
    leftTempleGrad.addColorStop(1.0, 'rgba(6, 7, 9, 0.0)');
    ctx.fillStyle = leftTempleGrad;
    ctx.fillRect(0, 0, size * 0.10, size);

    const rightTempleGrad = ctx.createLinearGradient(size, 0, size * 0.90, 0);
    rightTempleGrad.addColorStop(0.0, 'rgba(3, 4, 5, 0.96)');
    rightTempleGrad.addColorStop(0.7, 'rgba(6, 7, 9, 0.68)');
    rightTempleGrad.addColorStop(1.0, 'rgba(6, 7, 9, 0.0)');
    ctx.fillStyle = rightTempleGrad;
    ctx.fillRect(size * 0.90, 0, size * 0.10, size);

    const map = new THREE.CanvasTexture(colorCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.needsUpdate = true;

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.needsUpdate = true;

    this.textures.faceMap = map;
    this.textures.faceBumpMap = bumpMap;
    this.textures.faceRoughnessMap = roughnessMap;

    return { map, bumpMap, roughnessMap };
  }

  /**
   * Dedicated 512x512 Seamless Pale Ash-Grey Veined Corpse Body/Neck/Limb Skin Material
   * with deep sternocleidomastoid tendon shadows and a dark grime/blood-stained lower transition
   * so neckMesh and chestSkinMesh blend seamlessly into the soiled nightgown neckline without a white bib.
   */
  createBodySkinMaterial(isLimb = false) {
    const cacheKey = isLimb ? 'limbSkin' : 'bodySkin';
    if (this.materials[cacheKey]) return this.materials[cacheKey];

    let map = this.textures.bodySkinMap || null;
    let bumpMap = this.textures.bodySkinBump || null;
    let roughnessMap = this.textures.bodySkinRoughness || null;

    if (!map && typeof document !== 'undefined') {
      const size = 512;
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = size;
      colorCanvas.height = size;
      const ctx = colorCanvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d');

      const roughCanvas = document.createElement('canvas');
      roughCanvas.width = size;
      roughCanvas.height = size;
      const rCtx = roughCanvas.getContext('2d');

      const rng = mulberry32(319871);

      // 1. Subdued necrotic ash-grey corpse skin tone (prevents blown-out white chest blob under close flashlight)
      const baseGrad = ctx.createLinearGradient(0, 0, 0, size);
      baseGrad.addColorStop(0.0, '#727671');
      baseGrad.addColorStop(0.35, '#7e827d');
      baseGrad.addColorStop(0.68, '#6d716c');
      baseGrad.addColorStop(1.0, '#4a3d38');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);

      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      rCtx.fillStyle = '#9c9c9c';
      rCtx.fillRect(0, 0, size, size);

      // 2. Vertical sternocleidomastoid tendon & tracheal hollow shadows
      for (let t = 0; t < 8; t++) {
        const tx = (0.12 + (t / 7) * 0.76) * size;
        const tWidth = (0.045 + (t % 2) * 0.025) * size;
        const tGrad = ctx.createLinearGradient(tx - tWidth, 0, tx + tWidth, 0);
        tGrad.addColorStop(0.0, 'rgba(38, 40, 38, 0.0)');
        tGrad.addColorStop(0.5, 'rgba(36, 38, 36, 0.34)');
        tGrad.addColorStop(1.0, 'rgba(38, 40, 38, 0.0)');
        ctx.fillStyle = tGrad;
        ctx.fillRect(tx - tWidth, 0, tWidth * 2, size);
      }

      // 3. Mottled post-mortem lividity & necrotic grime blotches
      for (let i = 0; i < 210; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 10 + rng() * 44;
        const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
        if (rng() > 0.38) {
          g.addColorStop(0, `rgba(48, 52, 54, ${0.10 + rng() * 0.18})`);
          g.addColorStop(1, 'rgba(48, 52, 54, 0)');
        } else {
          g.addColorStop(0, `rgba(142, 146, 142, ${0.06 + rng() * 0.10})`);
          g.addColorStop(1, 'rgba(142, 146, 142, 0)');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Branching dark purple-grey subcutaneous veins across throat, collarbones, and forearms
      for (let i = 0; i < 38; i++) {
        const x = (0.06 + rng() * 0.88) * size;
        const y = rng() * size;
        const len = 48 + rng() * 95;
        const angle = Math.PI * (0.44 + (rng() - 0.5) * 0.28);
        ctx.strokeStyle = `rgba(38, 28, 42, ${0.24 + rng() * 0.26})`;
        ctx.lineWidth = 1.1 + rng() * 1.9;
        ctx.beginPath();
        let cx = x;
        let cy = y;
        ctx.moveTo(cx, cy);
        for (let s = 0; s < 6; s++) {
          cx += Math.cos(angle + (rng() - 0.5) * 0.45) * (len / 6);
          cy += Math.sin(angle + (rng() - 0.5) * 0.45) * (len / 6);
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }

      // 5. Dried brownish-crimson blood & collar grime shadow along lower 32% (blends chestSkinMesh into nightgown V-neck)
      const collarShadowGrad = ctx.createLinearGradient(0, size * 0.65, 0, size);
      collarShadowGrad.addColorStop(0.0, 'rgba(46, 32, 28, 0.0)');
      collarShadowGrad.addColorStop(0.55, 'rgba(48, 26, 22, 0.58)');
      collarShadowGrad.addColorStop(1.0, 'rgba(34, 18, 15, 0.88)');
      ctx.fillStyle = collarShadowGrad;
      ctx.fillRect(0, size * 0.65, size, size * 0.35);

      // 6. Fine dermal pore grain
      for (let i = 0; i < 3400; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const v = rng() > 0.5 ? 98 : 152;
        bCtx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.18)`;
        bCtx.fillRect(x, y, 1.8, 1.8);
      }

      map = new THREE.CanvasTexture(colorCanvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.ClampToEdgeWrapping;
      map.needsUpdate = true;

      bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.ClampToEdgeWrapping;
      bumpMap.needsUpdate = true;

      roughnessMap = new THREE.CanvasTexture(roughCanvas);
      roughnessMap.wrapS = THREE.RepeatWrapping;
      roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
      roughnessMap.needsUpdate = true;

      this.textures.bodySkinMap = map;
      this.textures.bodySkinBump = bumpMap;
      this.textures.bodySkinRoughness = roughnessMap;
    }

    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(isLimb ? 0x7c807b : 0x8a8e88),
      map,
      bumpMap,
      bumpScale: isLimb ? 0.007 : 0.009,
      roughnessMap,
      roughness: 0.68,
      metalness: 0.01,
      clearcoat: 0.06,
      clearcoatRoughness: 0.54,
      sheen: 0.08,
      sheenColor: new THREE.Color(0x68706c),
    });

    this.materials[cacheKey] = mat;
    return mat;
  }

  /**
   * Procedural 512x512 Bulging Milky-White Cataract Eyeball Texture (Right Eye in ref_04 & ref_06).
   */
  createCataractEyeTexture() {
    if (typeof document === 'undefined') return null;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const rng = mulberry32(99102);

    // Base bloodshot scleral background
    ctx.fillStyle = '#c8b4b4';
    ctx.fillRect(0, 0, size, size);

    // Polar UV mapping or front-facing sphere mapping:
    // In Three.js SphereGeometry, the +Z pole is at u = 0.5, v = 0.5 when rotated so seam is at -Z!
    const cx = size * 0.5;
    const cy = size * 0.5;

    // Outer bloodshot crimson/pink sclera gradient
    const scleraGrad = ctx.createRadialGradient(cx, cy, size * 0.05, cx, cy, size * 0.36);
    scleraGrad.addColorStop(0.0, '#eef2f4');
    scleraGrad.addColorStop(0.24, '#e2e7ea');
    scleraGrad.addColorStop(0.45, '#d4b8b8');
    scleraGrad.addColorStop(0.72, '#9e4e52');
    scleraGrad.addColorStop(1.0, '#5a1e22');
    ctx.fillStyle = scleraGrad;
    ctx.fillRect(0, 0, size, size);

    // Bloodshot capillaries radiating inward toward center
    for (let i = 0; i < 65; i++) {
      const angle = (i / 65) * Math.PI * 2 + (rng() - 0.5) * 0.1;
      const startR = size * (0.34 + rng() * 0.12);
      const endR = size * (0.11 + rng() * 0.07);
      ctx.strokeStyle = `rgba(128, 22, 28, ${0.28 + rng() * 0.35})`;
      ctx.lineWidth = 1.0 + rng() * 1.8;
      ctx.beginPath();
      let r = startR;
      let a = angle;
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      for (let s = 0; s < 6; s++) {
        r -= (startR - endR) / 6;
        a += (rng() - 0.5) * 0.09;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.stroke();
    }

    // Milky-white / pale-pink cataract corneal haze & pinpoint pupil (matching ref_06!)
    const irisGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.115);
    irisGrad.addColorStop(0.0, '#c8969a'); // Pinpoint pale reddish-grey cataract core
    irisGrad.addColorStop(0.28, '#e5eaed'); // Bright milky cataract ring
    irisGrad.addColorStop(0.68, '#d8dfe3');
    irisGrad.addColorStop(0.92, 'rgba(185, 145, 148, 0.7)');
    irisGrad.addColorStop(1.0, 'rgba(185, 145, 148, 0)');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.115, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this.textures.eyeMap = tex;
    return tex;
  }

  /**
   * High-res 1024x1024 procedural Filthy Beige-Linen Nightgown Material (createNightgownMaterial()).
   * Dirty yellowing-beige pleated fabric (#9c8a6e / #6e5d45) covered in vertical pleats, grime,
   * damp water stains, and jagged vertical soaked dark-crimson blood smears across the chest and shoulders (ref_04, ref_06).
   */
  createNightgownMaterial() {
    if (this.materials.nightgown) return this.materials.nightgown;

    let map = null;
    let bumpMap = null;
    let roughnessMap = null;

    if (typeof document !== 'undefined') {
      const size = 1024;
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = size;
      colorCanvas.height = size;
      const ctx = colorCanvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d');

      const roughCanvas = document.createElement('canvas');
      roughCanvas.width = size;
      roughCanvas.height = size;
      const rCtx = roughCanvas.getContext('2d');

      const rng = mulberry32(204863);

      // 1. Base dirty yellowing-beige linen gradient (darker & muddier toward hem)
      const baseGrad = ctx.createLinearGradient(0, 0, 0, size);
      baseGrad.addColorStop(0.0, '#968264');
      baseGrad.addColorStop(0.25, '#a28d6e');
      baseGrad.addColorStop(0.58, '#857053');
      baseGrad.addColorStop(0.84, '#615039');
      baseGrad.addColorStop(1.0, '#32271b');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);

      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      rCtx.fillStyle = '#b8b8b8';
      rCtx.fillRect(0, 0, size, size);

      // 2. Deep vertical gathered pleats & grimy fabric fold shadows across the gown
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const pleat1 = Math.sin(u * Math.PI * 48);
        const pleat2 = Math.sin(u * Math.PI * 20 + 0.7);
        const finePleat = Math.sin(u * Math.PI * 116);
        const combined = pleat1 * 0.52 + pleat2 * 0.34 + finePleat * 0.14;

        if (combined < 0) {
          ctx.fillStyle = `rgba(30, 21, 13, ${Math.abs(combined) * 0.48})`;
        } else {
          ctx.fillStyle = `rgba(214, 194, 160, ${combined * 0.20})`;
        }
        ctx.fillRect(x, 0, 1, size);

        const bv = Math.floor(128 + combined * 82);
        bCtx.fillStyle = `rgb(${bv}, ${bv}, ${bv})`;
        bCtx.fillRect(x, 0, 1, size);
      }

      // 3. Horizontal linen weave cross-threads
      for (let y = 0; y < size; y += 2) {
        const v = (y % 4 === 0) ? 145 : 112;
        bCtx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.18)`;
        bCtx.fillRect(0, y, size, 1);
      }

      // 4. Irregular vertical damp grime & sweat streaks (no uniform circles)
      for (let i = 0; i < 240; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const w = 8 + rng() * 36;
        const h = 45 + rng() * 165;
        const isBottom = y > size * 0.62;
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        if (isBottom || rng() > 0.42) {
          grad.addColorStop(0.0, 'rgba(38, 28, 17, 0)');
          grad.addColorStop(0.35, `rgba(38, 28, 17, ${0.10 + rng() * 0.18})`);
          grad.addColorStop(0.75, `rgba(48, 36, 22, ${0.08 + rng() * 0.14})`);
          grad.addColorStop(1.0, 'rgba(38, 28, 17, 0)');
        } else {
          grad.addColorStop(0.0, 'rgba(176, 156, 122, 0)');
          grad.addColorStop(0.5, `rgba(176, 156, 122, ${0.05 + rng() * 0.10})`);
          grad.addColorStop(1.0, 'rgba(176, 156, 122, 0)');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(x - w * 0.5, y, w, h);
      }

      // 5. Jagged, multi-stroke vertical soaked fabric blood smears & irregular coagulated dark-crimson stains (#320303, #540606)
      // Helper that paints a ragged vertical soaked blood curtain following the linen pleats (NEVER a circular polka-dot!)
      const drawJaggedBloodSmear = (cxNorm, topYNorm, widthNorm, heightNorm, intensity) => {
        const cx = cxNorm * size;
        const topY = topYNorm * size;
        const w = widthNorm * size;
        const h = heightNorm * size;
        const strips = 14 + Math.floor(rng() * 10);

        for (let s = 0; s < strips; s++) {
          const sFrac = (s / (strips - 1)) - 0.5; // -0.5 .. +0.5
          const sx = cx + sFrac * w + (rng() - 0.5) * 10;
          const sy = topY + Math.abs(sFrac) * h * 0.22 + (rng() - 0.5) * 14;
          const sh = h * (0.45 + (1.0 - Math.abs(sFrac) * 1.4) * 0.55 + rng() * 0.35);
          const sw = (w / strips) * (1.2 + rng() * 1.4);

          const vGrad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
          const alpha = Math.max(0.15, intensity * (1.0 - Math.abs(sFrac) * 0.9));
          vGrad.addColorStop(0.0, 'rgba(50, 3, 3, 0.0)');
          vGrad.addColorStop(0.12, `rgba(50, 3, 3, ${alpha * 0.92})`);
          vGrad.addColorStop(0.42, `rgba(84, 6, 6, ${alpha * 0.85})`);
          vGrad.addColorStop(0.76, `rgba(96, 18, 14, ${alpha * 0.48})`);
          vGrad.addColorStop(1.0, 'rgba(72, 12, 10, 0.0)');

          ctx.save();
          ctx.fillStyle = vGrad;
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.5, sy);
          const steps = 8;
          for (let k = 1; k <= steps; k++) {
            const ky = sy + (k / steps) * sh;
            const jagX = (rng() - 0.5) * sw * 0.9;
            ctx.lineTo(sx - sw * 0.45 + jagX, ky);
          }
          for (let k = steps; k >= 0; k--) {
            const ky = sy + (k / steps) * sh;
            const jagX = (rng() - 0.5) * sw * 0.9;
            ctx.lineTo(sx + sw * 0.45 + jagX, ky);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Dark coagulated core vein along pleat groove
          if (rng() > 0.35) {
            ctx.save();
            ctx.strokeStyle = rng() > 0.5 ? '#320303' : '#540606';
            ctx.globalAlpha = alpha * 0.78;
            ctx.lineWidth = 1.2 + rng() * 3.2;
            ctx.beginPath();
            let lx = sx;
            let ly = sy + sh * 0.08;
            ctx.moveTo(lx, ly);
            for (let k = 1; k <= 6; k++) {
              lx += (rng() - 0.5) * 5.0;
              ly += (sh * 0.82) / 6;
              ctx.lineTo(lx, ly);
            }
            ctx.stroke();
            ctx.restore();
          }
        }

        // Wet coagulated roughness sheen along vertical smear
        const rg = rCtx.createLinearGradient(cx, topY, cx, topY + h);
        rg.addColorStop(0, 'rgba(40, 40, 40, 0)');
        rg.addColorStop(0.3, 'rgba(32, 32, 32, 0.68)');
        rg.addColorStop(0.8, 'rgba(48, 48, 48, 0.45)');
        rg.addColorStop(1, 'rgba(180, 180, 180, 0)');
        rCtx.fillStyle = rg;
        rCtx.fillRect(cx - w * 0.45, topY, w * 0.9, h);
      };

      // Soaked collar, right shoulder, and chest vertical blood smears (matching ref_06 & ref_04)
      drawJaggedBloodSmear(0.49, 0.04, 0.16, 0.26, 0.84); // Center-collar & upper sternum soak
      drawJaggedBloodSmear(0.56, 0.10, 0.14, 0.30, 0.80); // Upper-left chest pleat soak
      drawJaggedBloodSmear(0.41, 0.11, 0.13, 0.28, 0.76); // Upper-right chest pleat soak
      drawJaggedBloodSmear(0.28, 0.05, 0.14, 0.24, 0.72); // Right shoulder bloodstain (ref_06 viewer's left)
      drawJaggedBloodSmear(0.72, 0.07, 0.11, 0.22, 0.64); // Left shoulder bloodstain
      // Midriff & lower skirt vertical blood runs (ref_04)
      drawJaggedBloodSmear(0.52, 0.32, 0.15, 0.32, 0.58);
      drawJaggedBloodSmear(0.44, 0.42, 0.12, 0.34, 0.54);
      drawJaggedBloodSmear(0.58, 0.56, 0.16, 0.36, 0.62);
      drawJaggedBloodSmear(0.38, 0.66, 0.14, 0.30, 0.58);

      // Irregular directional blood spatter streaks (non-circular jagged strokes) across collar & chest
      for (let s = 0; s < 140; s++) {
        const sx = (0.22 + rng() * 0.56) * size;
        const sy = (0.04 + rng() * 0.44) * size;
        const sLen = 4 + rng() * 22;
        const sW = 1.0 + rng() * 2.8;
        ctx.strokeStyle = rng() > 0.45 ? `rgba(50, 3, 3, ${0.42 + rng() * 0.45})` : `rgba(84, 6, 6, ${0.38 + rng() * 0.45})`;
        ctx.lineWidth = sW;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (rng() - 0.5) * 4, sy + sLen);
        ctx.stroke();
      }

      map = new THREE.CanvasTexture(colorCanvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.ClampToEdgeWrapping;
      map.needsUpdate = true;

      bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.ClampToEdgeWrapping;
      bumpMap.needsUpdate = true;

      roughnessMap = new THREE.CanvasTexture(roughCanvas);
      roughnessMap.wrapS = THREE.RepeatWrapping;
      roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
      roughnessMap.needsUpdate = true;

      this.textures.nightgownMap = map;
      this.textures.nightgownBump = bumpMap;
      this.textures.nightgownRoughness = roughnessMap;
    }

    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xc4b092),
      map,
      bumpMap,
      bumpScale: 0.015,
      roughnessMap,
      roughness: 0.68,
      metalness: 0.02,
      clearcoat: 0.22,
      clearcoatRoughness: 0.45,
      sheen: 0.35,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(0x9c8a6e),
      side: THREE.DoubleSide,
    });

    this.materials.nightgown = mat;
    return mat;
  }

  /**
   * Procedural Stained Yellowing-Brown Teeth Texture & Material (matching ref_06).
   */
  createTeethMaterial() {
    if (this.materials.teeth) return this.materials.teeth;

    let map = null;
    let bumpMap = null;
    if (typeof document !== 'undefined') {
      const w = 256;
      const h = 256;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const rng = mulberry32(44109);

      // Vertical gradient: dark rotted brown at gumline (top & bottom edges) -> yellow-ochre -> stained ivory tip
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0.0, '#2a1808');
      grad.addColorStop(0.18, '#6e4e1e');
      grad.addColorStop(0.45, '#b89648');
      grad.addColorStop(0.78, '#c8a95e');
      grad.addColorStop(0.92, '#9e7d3b');
      grad.addColorStop(1.0, '#3d2610');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Vertical enamel striations & plaque stains
      for (let i = 0; i < 160; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const r = 3 + rng() * 18;
        ctx.fillStyle =
          rng() > 0.4
            ? `rgba(58, 36, 12, ${0.12 + rng() * 0.25})`
            : `rgba(215, 190, 125, ${0.1 + rng() * 0.18})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
      bumpMap = map;
    }

    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xe0c070),
      map,
      bumpMap,
      bumpScale: 0.003,
      roughness: 0.16,
      metalness: 0.02,
      clearcoat: 0.92,
      clearcoatRoughness: 0.08,
      emissive: new THREE.Color(0x523a14),
      emissiveIntensity: 0.48,
    });

    this.materials.teeth = mat;
    return mat;
  }

  /**
   * Wet Jet-Black Stringy Hair Material with anisotropic-style wet strand sheen.
   */
  createHairMaterial() {
    if (this.materials.hair) return this.materials.hair;

    let map = null;
    let bumpMap = null;
    if (typeof document !== 'undefined') {
      const w = 256;
      const h = 512;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const rng = mulberry32(88312);

      ctx.fillStyle = '#020304';
      ctx.fillRect(0, 0, w, h);

      // Subtle dark vertical hair fiber streaks (never bright grey or silver spokes)
      for (let i = 0; i < 200; i++) {
        const x = rng() * w;
        const v = 3 + Math.floor(rng() * 6);
        ctx.strokeStyle = `rgb(${v}, ${v + 1}, ${v + 2})`;
        ctx.lineWidth = 0.8 + rng() * 1.8;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (rng() - 0.5) * 6, h);
        ctx.stroke();
      }

      map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
      bumpMap = map;
    }

    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x020304),
      map,
      bumpMap,
      bumpScale: 0.002,
      roughness: 0.58,
      metalness: 0.0,
      clearcoat: 0.06,
      clearcoatRoughness: 0.52,
      side: THREE.DoubleSide,
    });

    this.materials.hair = mat;
    return mat;
  }

  // ============================================================================
  // 2. HYPER-DETAILED SCULPTED 3D CHARACTER MODEL OF LISA (buildLisaMesh())
  // ============================================================================

  buildLisaMesh() {
    const faceTex = this.createLisaFaceTexture();
    const eyeTex = this.createCataractEyeTexture();
    const nightgownMat = this.createNightgownMaterial();
    const teethMat = this.createTeethMaterial();
    const hairMat = this.createHairMaterial();

    // Necrotic corpse skin material (damp cold-sweat sheen)
    const skinMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xb6bcba),
      map: faceTex.map,
      bumpMap: faceTex.bumpMap,
      bumpScale: 0.009,
      roughnessMap: faceTex.roughnessMap,
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.22,
      clearcoatRoughness: 0.30,
      sheen: 0.14,
      sheenColor: new THREE.Color(0x889490),
    });
    this.materials.skin = skinMat;

    // Dedicated body/neck/collarbone and limb corpse skin materials (zero black hair border stripes!)
    const bodySkinMat = this.createBodySkinMaterial(false);
    const limbSkinMat = this.createBodySkinMaterial(true);

    // Dark necrotic gums material
    const gumMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x3a1012),
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    });
    this.materials.gum = gumMat;

    // Pitch-black inner mouth cavity material
    const mouthCavityMat = new THREE.MeshBasicMaterial({
      color: 0x020102,
      side: THREE.DoubleSide,
    });
    this.materials.mouthCavity = mouthCavityMat;

    // Root Hierarchy
    this.root = new THREE.Group();
    this.root.name = 'LisaEntityRoot';
    this.rootGroup = this.root;
    this.group = this.root;
    this.mesh = this.root;

    // Hierarchical Skeletal Joints (Total height ~ 1.92m)
    this.pelvis = new THREE.Group();
    this.pelvis.name = 'pelvis';
    this.pelvis.position.set(0, 0.96, 0);
    this.root.add(this.pelvis);

    this.spine = new THREE.Group();
    this.spine.name = 'spine';
    this.spine.position.set(0, 0.02, 0);
    this.pelvis.add(this.spine);

    this.chest = new THREE.Group();
    this.chest.name = 'chest';
    this.chest.position.set(0, 0.32, 0);
    this.spine.add(this.chest);
    this.torsoGroup = this.chest;

    this.neck = new THREE.Group();
    this.neck.name = 'neck';
    this.neck.position.set(0, 0.26, 0.01);
    this.chest.add(this.neck);
    this.neckGroup = this.neck;

    // Head tilt & headGroup (placed at top of neck so y = 0.96 + 0.02 + 0.32 + 0.26 + 0.14 = 1.70m)
    this.headTiltOffset = new THREE.Group();
    this.headTiltOffset.name = 'headTiltOffset';
    this.headTiltOffset.position.set(0, 0.14, 0.015);
    this.neck.add(this.headTiltOffset);

    this.head = new THREE.Group();
    this.head.name = 'headGroup';
    this.headTiltOffset.add(this.head);
    this.headGroup = this.head;

    // Build Upper Cranium & Sculpted Face
    this._buildSculptedHeadAndFace(skinMat, eyeTex, gumMat, teethMat, mouthCavityMat);

    // Build 56 Wet Stringy Black Hair Strands
    this._buildWetStringyHair(hairMat);

    // Build Gaunt Neck, Collarbones, Nightgown Torso, Pleated Skirt & Jagged Torn Hem
    this._buildNeckTorsoAndNightgown(bodySkinMat, nightgownMat);

    // Build Gaunt Arms, Veined Forearms, Bony Hands & 10 Articulated Twitching Fingers
    this._buildGauntArmsAndHands(limbSkinMat, nightgownMat);

    // Build Gaunt Legs & Bare Corpse Feet
    this._buildLegsAndBareFeet(limbSkinMat);

    // Build Towering Hallway Shadow Backdrop Silhouette + Dedicated Preset Key/Rim Lights
    this._buildShadowBackdropAndLights();

    // Ensure every mesh casts and receives shadows
    this.root.traverse((obj) => {
      if (obj.isMesh) {
        if (!obj.userData.noCastShadow) {
          obj.castShadow = true;
        }
        obj.receiveShadow = true;
      }
    });

    // Populate joints lookup
    this.joints = {
      root: this.root,
      pelvis: this.pelvis,
      spine: this.spine,
      chest: this.chest,
      neck: this.neck,
      head: this.head,
      jaw: this.jaw,
      leftEye: this.leftEye,
      rightEye: this.rightEye,
      shoulderL: this.shoulderL,
      elbowL: this.elbowL,
      wristL: this.wristL,
      shoulderR: this.shoulderR,
      elbowR: this.elbowR,
      wristR: this.wristR,
      hipL: this.hipL,
      kneeL: this.kneeL,
      ankleL: this.ankleL,
      hipR: this.hipR,
      kneeR: this.kneeR,
      ankleR: this.ankleR,
      hairGroup: this.hairGroup,
      dressHem: this.dressHem,
    };

    return this.root;
  }

  /**
   * Builds the sculpted gaunt cranium, sunken cheekbones, brow ridge, nose,
   * asymmetric eyes, cavernous mouth, and articulated hinged screaming lower jaw with 24 3D teeth.
   */
  _buildSculptedHeadAndFace(skinMat, eyeTex, gumMat, teethMat, mouthCavityMat) {
    // 1. Sculpted Upper Cranium & Upper Face Geometry
    const headGeo = new THREE.SphereGeometry(0.104, 64, 64);
    const pos = headGeo.attributes.position;
    const uv = headGeo.attributes.uv;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // Normalize coordinates relative to radius 0.104
      const nx = v.x / 0.104;
      const ny = v.y / 0.104;
      const nz = v.z / 0.104;

      // Elongate cranium vertically, narrow gaunt sides
      v.y *= 1.24;
      v.x *= 0.88 - Math.max(0, -ny) * 0.14;
      v.z *= 0.96;

      // Flatten back of skull slightly, expand parietal crown
      if (nz < 0) {
        v.z *= 0.92;
        if (ny > 0.2) v.x *= 1.04;
      }

      // Sculpt front facial features (nz > 0)
      if (nz > 0.05) {
        const ax = Math.abs(v.x);

        // Sunken Temporal Fossae (temples)
        if (ny > 0.08 && ny < 0.55 && ax > 0.058) {
          const tFactor = Math.sin(((ny - 0.08) / 0.47) * Math.PI);
          v.x *= 1.0 - tFactor * 0.11;
          v.z -= tFactor * 0.008;
        }

        // Prominent Furrowed Supraorbital Brow Ridge (y ~ 0.032..0.058)
        if (v.y > 0.026 && v.y < 0.062 && ax < 0.068) {
          const browArch = Math.sin(((v.y - 0.026) / 0.036) * Math.PI);
          const glabellaDip = Math.exp(-Math.pow(ax / 0.012, 2)) * 0.006;
          v.z += browArch * 0.014 - glabellaDip;
        }

        // Deeply Sunken Orbital Eye Sockets (Right Eye at x = -0.034, Left Eye at x = +0.034, y = 0.014)
        const dRightEye = Math.hypot((v.x + 0.034) * 1.15, (v.y - 0.015) * 1.45);
        const dLeftEye = Math.hypot((v.x - 0.034) * 1.10, (v.y - 0.015) * 1.38);
        if (dRightEye < 0.032) {
          const socketDepth = Math.cos((dRightEye / 0.032) * (Math.PI * 0.5));
          v.z -= socketDepth * 0.024;
        }
        if (dLeftEye < 0.035) {
          // Left eye socket (Viewer's Right) is a deeper blackened hollow cavity
          const socketDepth = Math.cos((dLeftEye / 0.035) * (Math.PI * 0.5));
          v.z -= socketDepth * 0.038;
        }

        // Sharp Protruding Zygomatic Cheekbones (y ~ -0.022..0.006, ax ~ 0.042..0.078)
        if (v.y > -0.028 && v.y < 0.010 && ax > 0.036 && ax < 0.082) {
          const zygoY = Math.sin(((v.y + 0.028) / 0.038) * Math.PI);
          const zygoX = Math.sin(((ax - 0.036) / 0.046) * Math.PI);
          v.z += zygoY * zygoX * 0.015;
          v.x += Math.sign(v.x) * zygoY * zygoX * 0.008;
        }

        // Deep Sunken Gaunt Buccal/Cheek Hollows below Cheekbones (y ~ -0.082..-0.024)
        if (v.y > -0.088 && v.y < -0.020 && ax > 0.030 && ax < 0.078) {
          const hollowY = Math.sin(((v.y + 0.088) / 0.068) * Math.PI);
          const hollowX = Math.sin(((ax - 0.030) / 0.048) * Math.PI);
          v.x -= Math.sign(v.x) * hollowY * hollowX * 0.016;
          v.z -= hollowY * hollowX * 0.014;
        }

        // Sculpted Nasal Bridge, Dorsum, Tip & Alar Nostrils (ax < 0.024, y ~ -0.038..0.032)
        if (v.y > -0.038 && v.y < 0.034 && ax < 0.025) {
          const noseT = (0.034 - v.y) / 0.072; // 0 at bridge, 1 at tip
          const noseProfile = Math.sin(Math.pow(noseT, 0.75) * Math.PI * 0.88);
          const noseWidth = 0.011 + Math.pow(noseT, 1.6) * 0.011;
          if (ax < noseWidth) {
            const ridgeX = Math.cos((ax / noseWidth) * (Math.PI * 0.5));
            v.z += ridgeX * noseProfile * 0.031;
          }
          // Flared nostril wings near bottom of nose
          if (noseT > 0.72 && ax > 0.008 && ax < 0.022) {
            v.z += 0.008;
            v.x += Math.sign(v.x) * 0.003;
          }
        }

        // Carve Open Upper Mouth Arch at bottom of upper cranium (y < -0.046, ax < 0.038, z > 0.03)
        // So when the hinged lower jaw opens, there is a true 3D mouth opening!
        if (v.y < -0.045 && ax < 0.038 && v.z > 0.025) {
          const mouthW = Math.cos((ax / 0.038) * (Math.PI * 0.5));
          const archCeiling = -0.046 - (1.0 - mouthW) * 0.014;
          if (v.y < archCeiling) {
            v.y = archCeiling;
            v.z -= 0.012 * mouthW;
          }
        }
      }

      // Trim bottom of back/side skull where the hinged jaw & neck attach
      if (v.y < -0.058 && v.z > -0.02) {
        const frontFactor = Math.max(0, Math.min(1, (v.z + 0.02) / 0.06));
        v.y = v.y * (1.0 - frontFactor * 0.35);
      }

      // Map front hemisphere UVs cleanly onto our 1024x1024 face canvas
      // (Note: CanvasTexture flipY = true, so vCoord = 0.52 + (v.y / 0.135) * 0.42 aligns eyes with canvas y = 0.42)
      const uCoord = 0.5 + (v.x / 0.105) * 0.38;
      const vCoord = 0.52 + (v.y / 0.135) * 0.42;
      uv.setXY(i, Math.max(0.11, Math.min(0.89, uCoord)), Math.max(0.12, Math.min(0.95, vCoord)));

      pos.setXYZ(i, v.x, v.y, v.z);
    }
    headGeo.computeVertexNormals();

    const craniumMesh = new THREE.Mesh(headGeo, skinMat);
    craniumMesh.name = 'craniumMesh';
    this.head.add(craniumMesh);

    // 2. Dark Cavernous Inner Mouth / Throat Enclosure (blocks any light leak inside the open mouth)
    const throatGeo = new THREE.SphereGeometry(0.064, 24, 24);
    throatGeo.scale(0.76, 0.85, 0.85);
    const throatMesh = new THREE.Mesh(throatGeo, mouthCavityMat);
    throatMesh.position.set(0, -0.048, 0.028);
    throatMesh.userData.noCastShadow = true;
    this.head.add(throatMesh);

    // 3. Asymmetric Uncanny Eyes (Right Eye = Viewer's Left; Left Eye = Viewer's Right)
    // Right Eye (x = -0.034, y = 0.014, z = 0.082): Bulging milky-white cataract eyeball with pinpoint catchlight
    this.rightEye = new THREE.Group();
    this.rightEye.name = 'rightEye';
    this.rightEye.position.set(-0.034, 0.014, 0.082);
    this.head.add(this.rightEye);

    const rightEyeballGeo = new THREE.SphereGeometry(0.0168, 32, 32);
    // Rotate sphere so UV pole or center faces +Z
    rightEyeballGeo.rotateY(-Math.PI * 0.5);
    const rightEyeballMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf0f4f7),
      map: eyeTex,
      roughness: 0.03,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      reflectivity: 1.0,
      emissive: new THREE.Color(0xdbe3e8),
      emissiveIntensity: 0.42,
    });
    this.materials.rightEyeball = rightEyeballMat;

    const rightEyeballMesh = new THREE.Mesh(rightEyeballGeo, rightEyeballMat);
    this.rightEye.add(rightEyeballMesh);

    // Pinpoint specular corneal catchlight dot (guarantees eerie eye glint in ref_04 & ref_06)
    const catchlightGeo = new THREE.SphereGeometry(0.0024, 12, 12);
    const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const catchlightMesh = new THREE.Mesh(catchlightGeo, catchlightMat);
    catchlightMesh.position.set(-0.002, 0.002, 0.0162);
    catchlightMesh.userData.noCastShadow = true;
    this.rightEye.add(catchlightMesh);

    // Swollen dark bruised eyelid rims around right eye
    const eyelidMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x22161a),
      roughness: 0.32,
      clearcoat: 0.65,
    });
    const upperLidGeo = new THREE.TorusGeometry(0.0172, 0.0032, 10, 24, Math.PI * 1.08);
    const upperLidR = new THREE.Mesh(upperLidGeo, eyelidMat);
    upperLidR.rotation.set(0.22, 0.14, -0.05);
    upperLidR.position.set(0, 0.001, 0.003);
    this.rightEye.add(upperLidR);

    const lowerLidGeo = new THREE.TorusGeometry(0.0172, 0.0028, 10, 24, Math.PI * 1.05);
    const lowerLidR = new THREE.Mesh(lowerLidGeo, eyelidMat);
    lowerLidR.rotation.set(-0.25, 0.14, Math.PI + 0.05);
    lowerLidR.position.set(0, -0.001, 0.002);
    this.rightEye.add(lowerLidR);

    // Left Eye Socket (x = +0.034, y = 0.014, z = 0.068, Viewer's Right in ref_04 & ref_06):
    // Deeply recessed, blackened hollow eye socket with faint shadowy ruptured sclera deep inside
    this.leftEye = new THREE.Group();
    this.leftEye.name = 'leftEyeSocket';
    this.leftEye.position.set(0.034, 0.014, 0.068);
    this.head.add(this.leftEye);
    this.leftEyeSocket = this.leftEye;
    this.leftSocketGroup = this.leftEye;

    const hollowVoidGeo = new THREE.SphereGeometry(0.0195, 24, 24);
    hollowVoidGeo.scale(1.05, 0.92, 0.75);
    const hollowVoidMat = new THREE.MeshBasicMaterial({ color: 0x030305 });
    const hollowVoidMesh = new THREE.Mesh(hollowVoidGeo, hollowVoidMat);
    hollowVoidMesh.position.set(0, 0, -0.004);
    this.leftEye.add(hollowVoidMesh);

    // Ruptured dark wet remnant deep inside left socket (catches a faint wet glint in ref_06)
    const rupturedScleraGeo = new THREE.SphereGeometry(0.0115, 20, 20);
    const rupturedScleraMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x16181c),
      roughness: 0.08,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      emissive: new THREE.Color(0x090a0d),
      emissiveIntensity: 0.25,
    });
    const rupturedScleraMesh = new THREE.Mesh(rupturedScleraGeo, rupturedScleraMat);
    rupturedScleraMesh.position.set(0.001, -0.001, 0.002);
    this.leftEye.add(rupturedScleraMesh);

    const leftUpperLid = new THREE.Mesh(upperLidGeo, eyelidMat);
    leftUpperLid.rotation.set(0.32, -0.14, 0.06);
    leftUpperLid.position.set(0, 0.001, 0.006);
    this.leftEye.add(leftUpperLid);

    // 4. Upper Dental Arch (Dark Crimson Gums + 12 Sculpted Stained 3D Upper Teeth)
    this.upperDentalGroup = new THREE.Group();
    this.upperDentalGroup.name = 'upperDentalGroup';
    this.upperDentalGroup.position.set(0, -0.045, 0.068);
    this.head.add(this.upperDentalGroup);

    const gumArchGeo = new THREE.TorusGeometry(0.026, 0.0065, 12, 28, Math.PI);
    gumArchGeo.rotateX(Math.PI * 0.5);
    const upperGumMesh = new THREE.Mesh(gumArchGeo, gumMat);
    upperGumMesh.position.set(0, 0.003, -0.002);
    this.upperDentalGroup.add(upperGumMesh);

    this.upperTeeth = this._buildDentalRow(12, true, teethMat, gumMat);
    this.upperTeeth.scale.set(1.25, 1.35, 1.25);
    this.upperDentalGroup.add(this.upperTeeth);

    // 5. Articulated Hinged Lower Jaw (jawGroup) + Lower Dental Arch (12 Sculpted Stained 3D Lower Teeth)
    this.jaw = new THREE.Group();
    this.jaw.name = 'jawGroup';
    // TMJ hinge pivot below temples/cheeks
    this.jaw.position.set(0, -0.036, 0.022);
    this.head.add(this.jaw);
    this.jawGroup = this.jaw;

    // Sculpted Lower Mandible, Chin & Stretched Dark Lower Lip
    const jawGeo = new THREE.SphereGeometry(0.068, 48, 36);
    const jPos = jawGeo.attributes.position;
    const jUv = jawGeo.attributes.uv;
    const jv = new THREE.Vector3();

    for (let i = 0; i < jPos.count; i++) {
      jv.fromBufferAttribute(jPos, i);
      const ny = jv.y / 0.068;
      const ax = Math.abs(jv.x);

      // Shape into U-shaped lower mandible & gaunt pointed chin extending from hinge to front
      jv.x *= 0.88 - Math.max(0, -ny) * 0.26;
      jv.y *= 0.82;
      jv.z = jv.z * 0.95 + 0.034;

      // Carve hollow top of mandible for the open mouth & lower dental arch
      if (jv.y > -0.012) {
        const rimDist = Math.hypot(jv.x / 0.036, (jv.z - 0.044) / 0.038);
        if (rimDist < 0.88) {
          // Deep oral floor inside jaw
          jv.y = -0.024 - (0.88 - rimDist) * 0.018;
        } else {
          jv.y = Math.min(jv.y, -0.008);
        }
      }

      // Prominent bony chin tip at bottom-front
      if (jv.y < -0.025 && jv.z > 0.045 && ax < 0.028) {
        jv.z += 0.008 * Math.cos((ax / 0.028) * (Math.PI * 0.5));
        jv.y -= 0.006;
      }

      // Map mandible UVs to clean pale lower-face skin region (never touching side hair borders!)
      const uCoord = 0.5 + (jv.x / 0.085) * 0.30;
      const vCoord = 0.24 + (jv.y / 0.085) * 0.14;
      jUv.setXY(i, Math.max(0.18, Math.min(0.82, uCoord)), Math.max(0.10, Math.min(0.32, vCoord)));
      jPos.setXYZ(i, jv.x, jv.y, jv.z);
    }
    jawGeo.computeVertexNormals();

    const mandibleMesh = new THREE.Mesh(jawGeo, skinMat);
    mandibleMesh.name = 'mandibleMesh';
    this.jaw.add(mandibleMesh);

    // Dark desiccated lower lip rim
    const lipRimGeo = new THREE.TorusGeometry(0.028, 0.0042, 10, 28, Math.PI * 0.96);
    lipRimGeo.rotateX(Math.PI * 0.52);
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x1e1416),
      roughness: 0.28,
      clearcoat: 0.75,
    });
    const lowerLipMesh = new THREE.Mesh(lipRimGeo, lipMat);
    lowerLipMesh.position.set(0, -0.022, 0.056);
    this.jaw.add(lowerLipMesh);

    const upperLipMesh = new THREE.Mesh(lipRimGeo, lipMat);
    upperLipMesh.position.set(0, -0.043, 0.064);
    this.head.add(upperLipMesh);

    // Lower Dental Arch (Dark Gums + 12 Sculpted Stained 3D Lower Teeth)
    // Positioned above lowerLipMesh and angled upward (-0.54 rad) so all 12 lower teeth read clearly when jaw opens!
    this.lowerDentalGroup = new THREE.Group();
    this.lowerDentalGroup.name = 'lowerDentalGroup';
    this.lowerDentalGroup.position.set(0, -0.014, 0.056);
    this.lowerDentalGroup.rotation.x = -0.54;
    this.jaw.add(this.lowerDentalGroup);

    const lowerGumMesh = new THREE.Mesh(gumArchGeo, gumMat);
    lowerGumMesh.position.set(0, -0.003, -0.002);
    this.lowerDentalGroup.add(lowerGumMesh);

    this.lowerTeeth = this._buildDentalRow(12, false, teethMat, gumMat);
    this.lowerTeeth.scale.set(1.25, 1.35, 1.25);
    this.lowerDentalGroup.add(this.lowerTeeth);

    // Dark wet tongue inside lower jaw
    const tongueGeo = new THREE.SphereGeometry(0.020, 18, 16);
    tongueGeo.scale(0.85, 0.42, 1.35);
    const tongueMesh = new THREE.Mesh(tongueGeo, gumMat);
    tongueMesh.position.set(0, -0.021, 0.028);
    this.jaw.add(tongueMesh);
  }

  /**
   * Builds a horseshoe arch of 12 individually sculpted 3D stained teeth (incisors, canines, premolars, molars).
   */
  _buildDentalRow(count, isUpper, teethMat, gumMat) {
    const rowGroup = new THREE.Group();
    const archWidth = isUpper ? 0.0255 : 0.0235;
    const archDepth = isUpper ? 0.027 : 0.025;
    const dirY = isUpper ? -1 : 1;

    // Symmetric pairs from center outward: index 0..5 left/right
    // Angles along the front horseshoe (-0.42*PI to +0.42*PI)
    for (let i = 0; i < count; i++) {
      // Map i (0..11) from left molar (-5.5) to right molar (+5.5)
      const slot = i - (count - 1) * 0.5; // -5.5, -4.5, ..., -0.5, +0.5, ..., +5.5
      const absSlot = Math.abs(slot);
      const t = (slot / 5.8) * (Math.PI * 0.44);

      // Tooth anatomical dimensions based on dental position (central incisor, lateral, canine, premolar, molar)
      let toothW = 0.0042;
      let toothThick = 0.0034;
      let toothH = 0.0135;
      if (absSlot < 1.0) {
        // Central incisors (prominent in ref_06!)
        toothW = isUpper ? 0.0046 : 0.0038;
        toothThick = 0.0030;
        toothH = isUpper ? 0.0155 : 0.0138;
      } else if (absSlot < 2.0) {
        // Lateral incisors
        toothW = isUpper ? 0.0040 : 0.0036;
        toothThick = 0.0029;
        toothH = isUpper ? 0.0142 : 0.0132;
      } else if (absSlot < 3.0) {
        // Canines (slightly longer & sharper)
        toothW = 0.0041;
        toothThick = 0.0034;
        toothH = isUpper ? 0.0164 : 0.0148;
      } else {
        // Premolars & Molars
        toothW = 0.0044;
        toothThick = 0.0042;
        toothH = 0.0122;
      }

      // Sculpt individual tooth geometry with slight root taper & chisel/cusp crown
      const tGeo = new THREE.CylinderGeometry(
        isUpper ? toothW * 0.78 : toothW * 0.92,
        isUpper ? toothW * 0.92 : toothW * 0.78,
        toothH,
        12,
        4
      );
      tGeo.scale(1.0, 1.0, toothThick / toothW);

      const toothMesh = new THREE.Mesh(tGeo, teethMat);
      const x = Math.sin(t) * archWidth;
      const z = Math.cos(t) * archDepth - archDepth * 0.42;
      const y = dirY * (toothH * 0.46);

      toothMesh.position.set(x, y, z);
      // Orient tooth along dental arch tangent + slight decaying crookedness
      const jitter = (hash1D(i * 17.3 + (isUpper ? 1 : 99)) - 0.5) * 0.09;
      toothMesh.rotation.set(
        dirY * 0.06 + jitter * 0.5,
        t + jitter,
        jitter * 0.6
      );
      rowGroup.add(toothMesh);

      // Dark root collar ring at gumline for extra contrast (ref_06)
      const rootCollarGeo = new THREE.TorusGeometry(toothW * 0.82, 0.0011, 6, 12);
      rootCollarGeo.rotateX(Math.PI * 0.5);
      const rootCollar = new THREE.Mesh(rootCollarGeo, gumMat);
      rootCollar.position.set(x, dirY * 0.0015, z);
      rowGroup.add(rootCollar);
    }

    return rowGroup;
  }

  /**
   * Builds 56 sculpted curved 3D wet stringy black hair ribbons/locks (`hairGroup`)
   * with sculpted crown/back-of-skull scalp cap (recessed above forehead hairline so Lisa's face
   * is 100% unobstructed!), delicate parted forehead wisps outside the eyes, and wide overlapping
   * wet black hair curtains framing both sides of her face and shoulders (`ref_04`, `ref_06`).
   */
  _buildWetStringyHair(hairMat) {
    this.hairGroup = new THREE.Group();
    this.hairGroup.name = 'hairGroup';
    this.head.add(this.hairGroup);

    // 1. Sculpted matte dark-root scalp cap covering ONLY the top crown and back of skull
    // Front hemisphere vertices (sv.z > -0.01) below y = 0.078 are pushed up above the forehead hairline
    // and recessed behind craniumMesh (sv.z *= 0.90), with rotation.x = -0.18 (tilted backward!)
    const scalpGeo = new THREE.SphereGeometry(0.1065, 32, 28, 0, Math.PI * 2, 0, Math.PI * 0.68);
    const sPos = scalpGeo.attributes.position;
    const sv = new THREE.Vector3();
    for (let i = 0; i < sPos.count; i++) {
      sv.fromBufferAttribute(sPos, i);
      if (sv.z > -0.035) {
        const frontBlend = Math.min(1.0, (sv.z + 0.035) / 0.025);
        const minFrontY = 0.078 - Math.pow(Math.abs(sv.x) / 0.09, 2) * 0.035;
        if (sv.y < minFrontY) {
          sv.y = sv.y * (1.0 - frontBlend) + Math.max(sv.y, minFrontY) * frontBlend;
        }
        if (sv.z > -0.01) {
          sv.z *= 0.90;
        }
      }
      sPos.setXYZ(i, sv.x, sv.y, sv.z);
    }
    scalpGeo.computeVertexNormals();

    const scalpMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x060607),
      roughness: 0.92,
      metalness: 0.02,
      clearcoat: 0.0,
      side: THREE.DoubleSide,
    });
    const scalpMesh = new THREE.Mesh(scalpGeo, scalpMat);
    scalpMesh.scale.set(0.88, 1.22, 0.94);
    scalpMesh.position.set(0, 0.018, -0.008);
    scalpMesh.rotation.x = -0.18;
    this.hairGroup.add(scalpMesh);

    this.hairStrands = [];
    const totalStrands = 56;

    for (let i = 0; i < totalStrands; i++) {
      const side = i % 2 === 0 ? -1 : 1; // -1 = Right side (Viewer's Left), +1 = Left side (Viewer's Right)
      const idxOnSide = Math.floor(i / 2); // 0..27

      // Classify strands:
      // idxOnSide < 2 (4 strands total): Thin parted temple/forehead wisps that sweep outward (Math.abs(x) > 0.056 when y < 0.055)
      // so both eyes (rightEye at x = -0.034 and leftEye at x = +0.034), forehead, and nose are 100% unobstructed!
      // idxOnSide >= 2 (52 strands total): Wide, overlapping wet black hair curtains framing outer temples, cheeks, jaw, and shoulders!
      const isForeheadWisp = idxOnSide < 2;
      const isSideCurtain = idxOnSide >= 2 && idxOnSide < 18;

      let curvePoints = [];
      let baseRadius = 0.013;
      let ribbonFlatten = 4.2;

      if (isForeheadWisp) {
        const wispIdx = idxOnSide; // 0 or 1
        const startX = side * (0.012 + wispIdx * 0.016);
        const startY = 0.122 - wispIdx * 0.005;
        const startZ = 0.038;

        // Sweep cleanly outward past the eyebrows so abs(x) >= 0.058 everywhere below y = 0.055!
        const browX = side * (0.056 + wispIdx * 0.010);
        const templeX = side * (0.068 + wispIdx * 0.010);
        const cheekX = side * (0.072 + wispIdx * 0.012);
        const bottomY = -0.095 - wispIdx * 0.045;

        curvePoints = [
          new THREE.Vector3(startX, startY, startZ),
          new THREE.Vector3(side * (0.028 + wispIdx * 0.014), 0.094, 0.076),
          new THREE.Vector3(browX, 0.054, 0.084),
          new THREE.Vector3(templeX, 0.014, 0.080),
          new THREE.Vector3(cheekX, -0.038, 0.074),
          new THREE.Vector3(cheekX * 1.05, bottomY, 0.062),
        ];
        baseRadius = 0.0022 + wispIdx * 0.0007;
        ribbonFlatten = 2.6;
      } else if (isSideCurtain) {
        // Wide overlapping wet black hair curtains framing upper forehead corners, outer temples, cheeks, jaw, and collarbones
        const sT = (idxOnSide - 2) / 15.0; // 0 = front temple curtain, 1 = mid-ear/shoulder curtain
        const startX = side * (0.018 + sT * 0.046);
        const startY = 0.126 - sT * 0.016;
        const startZ = 0.034 - sT * 0.082;

        // Curve fuller across the upper forehead corner at y = 0.092 before sweeping around temples (abs(x) >= 0.080 at y = 0.018)
        // so the hairline forms a natural curved wet drape rather than a sharp geometric inverted-V!
        const upperForeheadX = side * (0.032 + sT * 0.038 + Math.sin(i * 2.3) * 0.004);
        const templeX = side * (0.080 + sT * 0.024);
        const cheekX = side * (0.086 + sT * 0.028 + Math.sin(i * 1.9) * 0.004);
        const shoulderX = side * (0.096 + sT * 0.052);
        const endY = -0.22 - (i % 5) * 0.028;
        const endZ = 0.048 - sT * 0.068;

        curvePoints = [
          new THREE.Vector3(startX, startY, startZ),
          new THREE.Vector3(upperForeheadX, 0.092, startZ + 0.028),
          new THREE.Vector3(templeX, 0.018, startZ + 0.022),
          new THREE.Vector3(cheekX, -0.065, endZ + 0.014),
          new THREE.Vector3(shoulderX * 0.94, -0.145, endZ + 0.008),
          new THREE.Vector3(shoulderX, endY, endZ),
        ];
        baseRadius = 0.012 + (i % 3) * 0.0035;
        ribbonFlatten = 4.2;
      } else {
        // Back & shoulder locks (idxOnSide 18..27)
        const bT = (idxOnSide - 18) / 9.0;
        const angle = (0.48 + bT * 0.48) * Math.PI * side;
        const rTop = 0.084;
        const rMid = 0.106;
        const rBot = 0.122 + bT * 0.024;
        const endY = -0.24 - (i % 4) * 0.03;

        curvePoints = [
          new THREE.Vector3(Math.sin(angle) * 0.034, 0.124, Math.cos(angle) * 0.038),
          new THREE.Vector3(Math.sin(angle) * rTop, 0.075, Math.cos(angle) * rTop),
          new THREE.Vector3(Math.sin(angle) * rMid, -0.015, Math.cos(angle) * rMid),
          new THREE.Vector3(Math.sin(angle) * rMid * 1.05, -0.11, Math.cos(angle) * rMid),
          new THREE.Vector3(Math.sin(angle) * rBot, endY, Math.cos(angle) * rBot * 0.85),
        ];
        baseRadius = 0.013 + (i % 3) * 0.004;
        ribbonFlatten = 4.2;
      }

      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const tubularSegments = 20;
      const radialSegments = 6;
      const tubeGeo = new THREE.TubeGeometry(curve, tubularSegments, baseRadius, radialSegments, false);

      // Taper & flatten each hair tube into a sculpted wet ribbon lock with pointed tip
      const tPos = tubeGeo.attributes.position;
      const tv = new THREE.Vector3();
      const centerPt = new THREE.Vector3();
      const ringSize = radialSegments + 1;

      for (let s = 0; s <= tubularSegments; s++) {
        const u = s / tubularSegments;
        curve.getPointAt(u, centerPt);
        // Wide in middle, tapered at root and pointed at wet tip
        const taper = u < 0.15 ? 0.55 + (u / 0.15) * 0.45 : Math.pow(1.0 - (u - 0.15) / 0.85, 0.72);
        for (let r = 0; r < ringSize; r++) {
          const vIdx = s * ringSize + r;
          tv.fromBufferAttribute(tPos, vIdx);
          tv.sub(centerPt);
          // Flatten radial cross-section into a ribbon
          if (r % 2 === 0) {
            tv.multiplyScalar(taper * 1.15);
          } else {
            tv.multiplyScalar(taper / ribbonFlatten);
          }
          tv.add(centerPt);
          tPos.setXYZ(vIdx, tv.x, tv.y, tv.z);
        }
      }
      tubeGeo.computeVertexNormals();

      const strandPivot = new THREE.Group();
      const strandMesh = new THREE.Mesh(tubeGeo, hairMat);
      strandPivot.add(strandMesh);
      this.hairGroup.add(strandPivot);
      this.hairStrands.push({
        group: strandPivot,
        side,
        isForeheadWisp,
        phase: i * 0.73,
      });
    }

    // Short, irregular, ragged wet root-fringe wisps across the upper forehead (y = 0.122 down to y = 0.074..0.092)
    // Breaks up the central hairline parting into an organic ragged wet fringe without touching the eyebrows or eyes!
    const fringeCount = 10;
    for (let f = 0; f < fringeCount; f++) {
      const fNorm = (f / (fringeCount - 1)) * 2.0 - 1.0; // -1.0 .. +1.0
      const fSide = fNorm < 0 ? -1 : 1;
      const rootX = fNorm * 0.054 + Math.sin(f * 3.7) * 0.004;
      const midX = rootX + fSide * (0.005 + (f % 3) * 0.003);
      const tipX = midX + fSide * (0.006 + (f % 2) * 0.004);
      const tipY = 0.075 + ((f * 7) % 4) * 0.0045; // Strictly above eyebrows (y = 0.048) and eyes (y = 0.014)

      const fCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(rootX * 0.75, 0.122, 0.040),
        new THREE.Vector3(midX, 0.102, 0.072),
        new THREE.Vector3(tipX, tipY, 0.084),
      ]);
      const fSegs = 10;
      const fRadSegs = 5;
      const fGeo = new THREE.TubeGeometry(fCurve, fSegs, 0.0024 + (f % 3) * 0.0007, fRadSegs, false);
      const fPos = fGeo.attributes.position;
      const fv = new THREE.Vector3();
      const fCenter = new THREE.Vector3();
      const fRing = fRadSegs + 1;
      for (let s = 0; s <= fSegs; s++) {
        const u = s / fSegs;
        fCurve.getPointAt(u, fCenter);
        const taper = Math.pow(1.0 - u, 0.65);
        for (let r = 0; r < fRing; r++) {
          const idx = s * fRing + r;
          fv.fromBufferAttribute(fPos, idx).sub(fCenter);
          fv.multiplyScalar(taper);
          fv.add(fCenter);
          fPos.setXYZ(idx, fv.x, fv.y, fv.z);
        }
      }
      fGeo.computeVertexNormals();
      const fMesh = new THREE.Mesh(fGeo, hairMat);
      this.hairGroup.add(fMesh);
    }
  }

  /**
   * Builds Lisa's gaunt neck with tendons, prominent clavicles, and her filthy blood-stained
   * beige-linen nightgown with vertical pleats and a jagged multi-strip torn hem.
   */
  _buildNeckTorsoAndNightgown(bodySkinMat, nightgownMat) {
    // 1. Gaunt Neck & Clavicles (visible inside scoop neckline in ref_04 and ref_06)
    const neckGeo = new THREE.CylinderGeometry(0.044, 0.056, 0.175, 28, 12);
    const nPos = neckGeo.attributes.position;
    const nv = new THREE.Vector3();
    for (let i = 0; i < nPos.count; i++) {
      nv.fromBufferAttribute(nPos, i);
      const angle = Math.atan2(nv.x, nv.z);
      // Prominent sternocleidomastoid tendons & tracheal hollow at front of neck
      const tendon = Math.cos(angle * 4.0) * 0.0042;
      const throatHollow = nv.z > 0.02 && Math.abs(nv.x) < 0.016 ? -0.006 : 0;
      nv.x += Math.sin(angle) * tendon;
      nv.z += Math.cos(angle) * tendon + throatHollow;
      nPos.setXYZ(i, nv.x, nv.y, nv.z);
    }
    neckGeo.computeVertexNormals();
    const neckMesh = new THREE.Mesh(neckGeo, bodySkinMat);
    neckMesh.position.set(0, 0.065, 0.005);
    this.neck.add(neckMesh);

    // Sculpted Upper Chest & Protruding Collarbones (Clavicles) inside neckline
    // Uses full [0..1] UVs so the dark crimson-brown grime gradient along the bottom 35% of bodySkinMap
    // blends the lower chest seamlessly into the soiled V-neck collar without forming a bright white oval bib!
    const chestSkinGeo = new THREE.SphereGeometry(0.106, 32, 24);
    chestSkinGeo.scale(1.16, 0.66, 0.60);
    const csPos = chestSkinGeo.attributes.position;
    const csv = new THREE.Vector3();
    for (let i = 0; i < csPos.count; i++) {
      csv.fromBufferAttribute(csPos, i);
      // Carve suprasternal notch & accentuate clavicle ridges
      if (csv.z > 0.015 && csv.y > -0.01 && csv.y < 0.055) {
        const notch = Math.exp(-Math.pow(csv.x / 0.026, 2)) * 0.015;
        const clavicle = Math.exp(-Math.pow((csv.y - 0.028) / 0.011, 2)) * 0.012;
        csv.z += clavicle - notch;
      }
      csPos.setXYZ(i, csv.x, csv.y, csv.z);
    }
    chestSkinGeo.computeVertexNormals();
    const chestSkinMesh = new THREE.Mesh(chestSkinGeo, bodySkinMat);
    chestSkinMesh.position.set(0, 0.20, 0.006);
    this.chest.add(chestSkinMesh);

    // 2. Filthy Beige-Linen Nightgown (dressGroup)
    this.dressGroup = new THREE.Group();
    this.dressGroup.name = 'dressGroup';
    this.spine.add(this.dressGroup);

    // Sculpted Nightgown Bodice & Pleated Skirt (spans from shoulders down to tattered hem)
    const dressHeight = 1.16;
    const radialSegs = 64;
    const heightSegs = 48;
    const dressGeo = new THREE.CylinderGeometry(0.172, 0.245, dressHeight, radialSegs, heightSegs, true);
    const dPos = dressGeo.attributes.position;
    const dUv = dressGeo.attributes.uv;
    const dv = new THREE.Vector3();

    for (let i = 0; i < dPos.count; i++) {
      dv.fromBufferAttribute(dPos, i);
      // t = 0 at top (shoulders y = +0.58), t = 1 at bottom hem (y = -0.58)
      const t = (dressHeight * 0.5 - dv.y) / dressHeight;
      const angle = Math.atan2(dv.x, dv.z);

      // Anatomical silhouette profile along t (covers shoulder joints cleanly while clinging to gaunt torso):
      let widthScale = 1.0;
      let depthScale = 0.68;
      if (t < 0.14) {
        // Broad enough at top collar/shoulder seam (~0.155m half-width) to fully enclose ±0.132m shoulder joints
        const cT = t / 0.14;
        widthScale = 0.90 + Math.sin(cT * Math.PI * 0.5) * 0.24;
        depthScale = 0.56 + cT * 0.12;
      } else if (t < 0.38) {
        const wT = (t - 0.14) / 0.24;
        widthScale = 1.14 - Math.sin(wT * Math.PI) * 0.14;
        depthScale = 0.68 + Math.sin(wT * Math.PI * 0.5) * 0.06;
      } else {
        const sT = (t - 0.38) / 0.62;
        widthScale = 0.96 + sT * 0.18;
        depthScale = 0.70 + sT * 0.14;
      }

      dv.x *= widthScale;
      dv.z *= depthScale;

      // Deepened front scoop neckline cutout (exposes gaunt veined neck, tendons, and collarbones in ref_06 & ref_04!)
      if (t < 0.22 && dv.z > 0) {
        const frontW = Math.max(0, 1.0 - Math.abs(dv.x) / 0.115);
        dv.y -= frontW * (1.0 - t / 0.22) * 0.082;
      }

      // Subtle bust drape & forward hunch
      if (t > 0.12 && t < 0.34 && dv.z > 0) {
        const bustFactor = Math.sin(((t - 0.12) / 0.22) * Math.PI);
        dv.z += bustFactor * 0.022 * Math.cos(dv.x * 8.0);
      }

      // 3D Vertical Gathered Pleats & Cloth Folds (strengthening from chest down to hem)
      const pleatAmp = (0.005 + Math.pow(t, 0.85) * 0.018);
      const pleatWave =
        Math.sin(angle * 18.0) * 0.55 +
        Math.sin(angle * 9.0 + 1.2) * 0.32 +
        Math.cos(angle * 31.0) * 0.13;
      const radialDirX = Math.sin(angle);
      const radialDirZ = Math.cos(angle);
      dv.x += radialDirX * pleatWave * pleatAmp;
      dv.z += radialDirZ * pleatWave * pleatAmp;

      // Jagged, tattered bottom hem along the lower edge (t > 0.86)
      if (t > 0.86) {
        const hemT = (t - 0.86) / 0.14;
        const jag =
          Math.abs(Math.sin(angle * 13.0 + 0.5)) * 0.055 +
          Math.sin(angle * 23.0) * 0.032 +
          Math.cos(angle * 7.0) * 0.025;
        dv.y -= hemT * jag;
      }

      dUv.setXY(i, (angle / (Math.PI * 2)) + 0.5, 1.0 - t);
      dPos.setXYZ(i, dv.x, dv.y, dv.z);
    }
    dressGeo.computeVertexNormals();

    const dressMesh = new THREE.Mesh(dressGeo, nightgownMat);
    dressMesh.name = 'nightgownMesh';
    dressMesh.position.set(0, -0.03, 0.008);
    this.dressGroup.add(dressMesh);

    // 3. Gathered Collar Trim & Jagged Torn Hem Strips (dressHem)
    this.dressHem = new THREE.Group();
    this.dressHem.name = 'dressHem';
    this.dressHem.position.set(0, -0.58, 0);
    this.dressGroup.add(this.dressHem);

    this.hemStrips = [];
    const stripCount = 28;
    for (let i = 0; i < stripCount; i++) {
      const angle = (i / stripCount) * Math.PI * 2;
      const stripLen = 0.075 + hash1D(i * 19.1) * 0.115;
      const stripW = 0.024 + hash1D(i * 7.3) * 0.018;

      const sGeo = new THREE.PlaneGeometry(stripW, stripLen, 2, 5);
      const sPos = sGeo.attributes.position;
      for (let k = 0; k < sPos.count; k++) {
        const py = sPos.getY(k);
        // Pointed/ragged tip at bottom of each strip
        const vNorm = (stripLen * 0.5 - py) / stripLen;
        const taper = 1.0 - Math.pow(vNorm, 1.8) * 0.78;
        sPos.setX(k, sPos.getX(k) * taper + Math.sin(vNorm * 4.0 + i) * 0.004);
        sPos.setZ(k, Math.sin(vNorm * Math.PI) * 0.008);
      }
      sGeo.computeVertexNormals();

      const stripMesh = new THREE.Mesh(sGeo, nightgownMat);
      const rx = Math.sin(angle) * 0.245;
      const rz = Math.cos(angle) * 0.205;
      stripMesh.position.set(rx, -stripLen * 0.38, rz);
      stripMesh.rotation.y = angle;
      this.dressHem.add(stripMesh);
      this.hemStrips.push(stripMesh);
    }
  }

  /**
   * Builds Lisa's gaunt shoulders, 3/4 tattered nightgown sleeves, veined grey forearms,
   * and elongated bony hands with 10 individual twitching fingers and dark fingernails.
   */
  _buildGauntArmsAndHands(limbSkinMat, nightgownMat) {
    const buildArmSide = (isLeft) => {
      const side = isLeft ? 1 : -1; // +1 = Left arm (+X), -1 = Right arm (-X)

      const shoulder = new THREE.Group();
      shoulder.name = isLeft ? 'shoulderL' : 'shoulderR';
      // Tucked cleanly inside the nightgown's ±0.155m shoulder width so no white cylinder cap ever protrudes!
      shoulder.position.set(side * 0.132, 0.15, -0.015);
      this.chest.add(shoulder);

      // Loose 3/4 Nightgown Sleeve covering upper arm & elbow (strongly tapered at top so it nests inside shoulder!)
      const sleeveLen = 0.34;
      const sleeveGeo = new THREE.CylinderGeometry(0.048, 0.068, sleeveLen, 24, 12, true);
      const slPos = sleeveGeo.attributes.position;
      const slUv = sleeveGeo.attributes.uv;
      for (let i = 0; i < slPos.count; i++) {
        let sx = slPos.getX(i);
        const sy = slPos.getY(i);
        let sz = slPos.getZ(i);
        const ang = Math.atan2(sx, sz);
        const t = (sleeveLen * 0.5 - sy) / sleeveLen;
        if (t < 0.35) {
          const topTaper = 0.22 + 0.78 * (t / 0.35);
          sx *= topTaper;
          sz *= topTaper;
        }
        const fold = Math.sin(ang * 8.0) * 0.005 * t;
        const jag = t > 0.82 ? Math.sin(ang * 7.0) * 0.018 * ((t - 0.82) / 0.18) : 0;
        slPos.setXYZ(i, sx + Math.sin(ang) * fold, sy - jag, sz + Math.cos(ang) * fold);
        if (slUv) {
          slUv.setY(i, slUv.getY(i) * 0.82);
        }
      }
      sleeveGeo.computeVertexNormals();
      const sleeveMesh = new THREE.Mesh(sleeveGeo, nightgownMat);
      sleeveMesh.position.set(side * -0.008, -sleeveLen * 0.52, 0);
      shoulder.add(sleeveMesh);

      // Inner gaunt upper arm bone/flesh
      const upperArmGeo = new THREE.CylinderGeometry(0.032, 0.026, 0.29, 16, 6);
      const upperArmMesh = new THREE.Mesh(upperArmGeo, limbSkinMat);
      upperArmMesh.position.set(0, -0.145, 0);
      shoulder.add(upperArmMesh);

      // Elbow Joint
      const elbow = new THREE.Group();
      elbow.name = isLeft ? 'elbowL' : 'elbowR';
      elbow.position.set(0, -0.285, 0);
      shoulder.add(elbow);

      // Gaunt Veined Forearm (exposed below tattered sleeve cuff in ref_04 & ref_06)
      const forearmLen = 0.275;
      const forearmGeo = new THREE.CylinderGeometry(0.027, 0.019, forearmLen, 20, 8);
      const faPos = forearmGeo.attributes.position;
      for (let i = 0; i < faPos.count; i++) {
        const fx = faPos.getX(i);
        const fy = faPos.getY(i);
        const fz = faPos.getZ(i);
        const ang = Math.atan2(fx, fz);
        // Sinewy forearm tendons
        const sinew = Math.cos(ang * 4.0) * 0.0022;
        faPos.setXYZ(i, fx + Math.sin(ang) * sinew, fy, fz + Math.cos(ang) * sinew);
      }
      forearmGeo.computeVertexNormals();
      const forearmMesh = new THREE.Mesh(forearmGeo, limbSkinMat);
      forearmMesh.position.set(0, -forearmLen * 0.5, 0);
      elbow.add(forearmMesh);

      // Wrist & Elongated Bony Hand
      const wrist = new THREE.Group();
      wrist.name = isLeft ? 'wristL' : 'wristR';
      wrist.position.set(0, -forearmLen, 0);
      elbow.add(wrist);

      // Gaunt Palm with dorsal tendons
      const palmGeo = new THREE.BoxGeometry(0.044, 0.072, 0.016, 6, 6, 3);
      const palmMesh = new THREE.Mesh(palmGeo, limbSkinMat);
      palmMesh.position.set(0, -0.034, 0);
      wrist.add(palmMesh);

      // 5 Long Bony Twitching Fingers with Dark Necrotic Fingernails
      const nailMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x181214),
        roughness: 0.25,
        clearcoat: 0.8,
      });

      const fingerSpecs = [
        { name: 'thumb', x: side * -0.022, y: -0.028, z: 0.008, len: 0.048, r: 0.0046, splay: side * -0.38 },
        { name: 'index', x: side * -0.015, y: -0.068, z: 0.002, len: 0.066, r: 0.0042, splay: side * -0.08 },
        { name: 'middle', x: side * -0.004, y: -0.071, z: 0.002, len: 0.074, r: 0.0043, splay: 0.0 },
        { name: 'ring', x: side * 0.007, y: -0.069, z: 0.001, len: 0.068, r: 0.0040, splay: side * 0.07 },
        { name: 'pinky', x: side * 0.017, y: -0.064, z: 0.0, len: 0.055, r: 0.0036, splay: side * 0.15 },
      ];

      const fingers = [];
      for (const f of fingerSpecs) {
        const fingerGroup = new THREE.Group();
        fingerGroup.position.set(f.x, f.y, f.z);
        fingerGroup.rotation.z = f.splay;

        // Proximal phalanx
        const p1Len = f.len * 0.54;
        const p1Geo = new THREE.CylinderGeometry(f.r, f.r * 0.84, p1Len, 10, 2);
        const p1Mesh = new THREE.Mesh(p1Geo, limbSkinMat);
        p1Mesh.position.set(0, -p1Len * 0.5, 0);
        fingerGroup.add(p1Mesh);

        // Distal knuckle + claw tip
        const knuckle = new THREE.Group();
        knuckle.position.set(0, -p1Len, 0);
        knuckle.rotation.x = 0.28; // Natural eerie inward curl
        fingerGroup.add(knuckle);

        const p2Len = f.len * 0.48;
        const p2Geo = new THREE.CylinderGeometry(f.r * 0.82, f.r * 0.52, p2Len, 10, 2);
        const p2Mesh = new THREE.Mesh(p2Geo, limbSkinMat);
        p2Mesh.position.set(0, -p2Len * 0.5, 0);
        knuckle.add(p2Mesh);

        // Dark claw fingernail
        const nailGeo = new THREE.ConeGeometry(f.r * 0.54, 0.011, 8);
        nailGeo.rotateX(Math.PI);
        const nailMesh = new THREE.Mesh(nailGeo, nailMat);
        nailMesh.position.set(0, -p2Len - 0.003, 0.001);
        knuckle.add(nailMesh);

        wrist.add(fingerGroup);
        fingers.push({ root: fingerGroup, knuckle });
      }

      return { shoulder, elbow, wrist, fingers };
    };

    const leftArm = buildArmSide(true);
    const rightArm = buildArmSide(false);

    this.shoulderL = leftArm.shoulder;
    this.elbowL = leftArm.elbow;
    this.wristL = leftArm.wrist;
    this.fingersL = leftArm.fingers;
    this.armL = this.shoulderL;
    this.handL = this.wristL;

    this.shoulderR = rightArm.shoulder;
    this.elbowR = rightArm.elbow;
    this.wristR = rightArm.wrist;
    this.fingersR = rightArm.fingers;
    this.armR = this.shoulderR;
    this.handR = this.wristR;
  }

  /**
   * Builds Lisa's gaunt shins, ankles, and dirty ash-grey bare corpse feet visible beneath the tattered dress hem (ref_04).
   */
  _buildLegsAndBareFeet(limbSkinMat) {
    const buildLegSide = (isLeft) => {
      const side = isLeft ? 1 : -1;

      const hip = new THREE.Group();
      hip.name = isLeft ? 'hipL' : 'hipR';
      hip.position.set(side * 0.088, 0, 0);
      this.pelvis.add(hip);

      const knee = new THREE.Group();
      knee.name = isLeft ? 'kneeL' : 'kneeR';
      knee.position.set(0, -0.46, 0);
      hip.add(knee);

      // Gaunt Lower Shin & Ankle (visible below hem y = 0.36m down to floor y = 0.0)
      const shinLen = 0.44;
      const shinGeo = new THREE.CylinderGeometry(0.036, 0.023, shinLen, 18, 6);
      const shinMesh = new THREE.Mesh(shinGeo, limbSkinMat);
      shinMesh.position.set(0, -shinLen * 0.5, 0);
      knee.add(shinMesh);

      const ankle = new THREE.Group();
      ankle.name = isLeft ? 'ankleL' : 'ankleR';
      ankle.position.set(0, -shinLen, 0);
      knee.add(ankle);

      // Sculpted Bare Corpse Foot with 5 distinct toes resting on the floor
      const footGeo = new THREE.BoxGeometry(0.064, 0.034, 0.165, 6, 4, 8);
      const fPos = footGeo.attributes.position;
      for (let i = 0; i < fPos.count; i++) {
        let fx = fPos.getX(i);
        let fy = fPos.getY(i);
        let fz = fPos.getZ(i);
        // Taper heel and slope instep down toward toes (+Z)
        if (fz > 0.02 && fy > 0) {
          fy *= 1.0 - ((fz - 0.02) / 0.07) * 0.55;
        }
        if (fz < -0.02) {
          fx *= 0.76;
        }
        fPos.setXYZ(i, fx, fy, fz);
      }
      footGeo.computeVertexNormals();
      const footMesh = new THREE.Mesh(footGeo, limbSkinMat);
      footMesh.position.set(0, -0.032, 0.042);
      ankle.add(footMesh);

      // 5 Bare Toes
      for (let t = 0; t < 5; t++) {
        const toeOffset = (t - 2) * 0.0115 * side;
        const toeR = t === 0 ? 0.0062 : 0.0044;
        const toeLen = 0.026 - t * 0.0022;
        const toeGeo = new THREE.CylinderGeometry(toeR * 0.8, toeR, toeLen, 8);
        toeGeo.rotateX(Math.PI * 0.5);
        const toeMesh = new THREE.Mesh(toeGeo, limbSkinMat);
        toeMesh.position.set(-toeOffset, -0.041, 0.125 - t * 0.003);
        ankle.add(toeMesh);
      }

      return { hip, knee, ankle };
    };

    const leftLeg = buildLegSide(true);
    const rightLeg = buildLegSide(false);

    this.hipL = leftLeg.hip;
    this.kneeL = leftLeg.knee;
    this.ankleL = leftLeg.ankle;
    this.footL = this.ankleL;

    this.hipR = rightLeg.hip;
    this.kneeR = rightLeg.knee;
    this.ankleR = rightLeg.ankle;
    this.footR = this.ankleR;
  }

  /**
   * Builds:
   * 1. Towering Hallway Shadow Backdrop Silhouette behind Lisa for `lisa_corner_stalk` (`ref_04`)
   * 2. Dedicated scene-accurate flashlight rim/key lights for `lisa_corner_stalk` and `lisa_jumpscare_closeup`
   */
  _buildShadowBackdropAndLights() {
    this.shadowBackdropGroup = new THREE.Group();
    this.shadowBackdropGroup.name = 'shadowBackdropGroup';
    this.root.add(this.shadowBackdropGroup);

    // Procedural soft-edged towering black shadow silhouette texture (looms behind Lisa on right/back wall in ref_04)
    if (typeof document !== 'undefined') {
      const sw = 512;
      const sh = 512;
      const sCanvas = document.createElement('canvas');
      sCanvas.width = sw;
      sCanvas.height = sh;
      const sCtx = sCanvas.getContext('2d');

      sCtx.clearRect(0, 0, sw, sh);

      // Towering head & shoulders shadow silhouette with soft penumbra falloff
      const drawShadowBlob = (cx, cy, rx, ry, alpha) => {
        sCtx.save();
        sCtx.translate(cx * sw, cy * sh);
        sCtx.scale(rx / ry, 1.0);
        const g = sCtx.createRadialGradient(0, 0, ry * sh * 0.15, 0, 0, ry * sh);
        g.addColorStop(0.0, `rgba(2, 2, 3, ${alpha})`);
        g.addColorStop(0.62, `rgba(2, 2, 3, ${alpha * 0.82})`);
        g.addColorStop(0.88, `rgba(2, 2, 3, ${alpha * 0.32})`);
        g.addColorStop(1.0, 'rgba(2, 2, 3, 0)');
        sCtx.fillStyle = g;
        sCtx.beginPath();
        sCtx.arc(0, 0, ry * sh, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.restore();
      };

      // Tilted head shadow, wide looming shoulders, and long body shadow cast upward & right
      drawShadowBlob(0.46, 0.22, 0.22, 0.18, 0.94);
      drawShadowBlob(0.54, 0.46, 0.34, 0.28, 0.96);
      drawShadowBlob(0.56, 0.74, 0.32, 0.28, 0.92);

      const shadowTex = new THREE.CanvasTexture(sCanvas);
      shadowTex.needsUpdate = true;

      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      // Looming shadow plane positioned behind Lisa & slightly right (+X, -Z) matching ref_04
      const shadowPlaneGeo = new THREE.PlaneGeometry(1.15, 2.35);
      this.toweringShadowMesh = new THREE.Mesh(shadowPlaneGeo, shadowMat);
      this.toweringShadowMesh.position.set(0.28, 1.28, -0.38);
      this.toweringShadowMesh.rotation.y = -0.18;
      this.toweringShadowMesh.userData.noCastShadow = true;
      this.shadowBackdropGroup.add(this.toweringShadowMesh);

      // Ground contact & trailing floor shadow pool under her feet
      const floorShadowGeo = new THREE.PlaneGeometry(0.95, 1.35);
      floorShadowGeo.rotateX(-Math.PI * 0.5);
      const floorShadowMesh = new THREE.Mesh(floorShadowGeo, shadowMat);
      floorShadowMesh.position.set(0.14, 0.008, -0.22);
      floorShadowMesh.userData.noCastShadow = true;
      this.shadowBackdropGroup.add(floorShadowMesh);
    }

    // Dedicated Lighting Rig for Preset 4 (lisa_corner_stalk) & Preset 6 (lisa_jumpscare_closeup)
    // Added directly to this.scene (with .visible = true always!) so hiding this.root never changes active light count!
    this.lightRig = new THREE.Group();
    this.lightRig.name = 'lisaDedicatedLightRig';
    this.lightRig.visible = true;
    if (this.scene) {
      this.scene.add(this.lightRig);
    } else {
      this.root.add(this.lightRig);
    }

    // 1. Corner Stalk Cold Eerie The Corridor Hallway Alcove Rim/Top Light (matching user_vibe_01.png)
    // Relative to root at (-0.08, 0.0, -8.85), local (-0.27, 2.35, 0.20) places light at world (-0.35, 2.35, -8.65)
    this.stalkKeyLight = new THREE.PointLight(0x88a4be, 0.0, 4.2, 1.5);
    this.stalkKeyLight.position.set(-0.27, 2.35, 0.20);
    this.stalkKeyLight.castShadow = false;
    this.stalkKeyLight.visible = true;
    this.lightRig.add(this.stalkKeyLight);

    // Subtle cool pale face/eye rim fill at world (-0.22, 1.68, -8.35) -> local (-0.14, 1.68, 0.50)
    // Rims only Lisa's gaunt face, milky cataract eye, and left dress folds while keeping her right side in deep shadow!
    this.stalkFaceFill = new THREE.PointLight(0xa8bccf, 0.0, 2.0, 1.6);
    this.stalkFaceFill.position.set(-0.14, 1.68, 0.50);
    this.stalkFaceFill.castShadow = false;
    this.stalkFaceFill.visible = true;
    this.lightRig.add(this.stalkFaceFill);

    // 2. Jumpscare Closeup Harsh Upward Flashlight Key Light (from bottom-right handheld flashlight in ref_06!)
    this.jumpscareKeyLight = new THREE.SpotLight(0xedece4, 0.0, 1.9, 0.76, 0.65, 1.8);
    this.jumpscareKeyLight.position.set(0.22, 1.18, 0.82);
    this.jumpscareKeyTarget = new THREE.Object3D();
    this.jumpscareKeyTarget.position.set(-0.02, 1.68, 0.05);
    this.lightRig.add(this.jumpscareKeyTarget);
    this.jumpscareKeyLight.target = this.jumpscareKeyTarget;
    this.jumpscareKeyLight.castShadow = false;
    this.jumpscareKeyLight.visible = true;
    this.lightRig.add(this.jumpscareKeyLight);
    this.jumpscareUpLight = this.jumpscareKeyLight;

    // Subtle lower-chest/shoulder fill from the flashlight cone in ref_06
    this.jumpscareChestLight = new THREE.PointLight(0xedece4, 0.0, 1.2, 1.8);
    this.jumpscareChestLight.position.set(0.12, 1.32, 0.48);
    this.jumpscareChestLight.castShadow = false;
    this.jumpscareChestLight.visible = true;
    this.lightRig.add(this.jumpscareChestLight);

    // Mouth & Teeth Cavity Fill Light for ref_06 so the 24 stained yellow-brown teeth pop unmistakably inside the open jaw!
    this.jumpscareMouthLight = new THREE.PointLight(0xffdca8, 0.0, 0.35, 1.5);
    this.jumpscareMouthLight.position.set(0.0, 1.60, 0.18);
    this.jumpscareMouthLight.castShadow = false;
    this.jumpscareMouthLight.visible = true;
    this.lightRig.add(this.jumpscareMouthLight);

    // Background light kept at 0 intensity during jumpscare so background stays pitch-black
    this.jumpscareBgLight = new THREE.PointLight(0x88a4be, 0.0, 4.0, 1.5);
    this.jumpscareBgLight.position.set(0.0, 1.65, -1.35);
    this.jumpscareBgLight.castShadow = false;
    this.jumpscareBgLight.visible = true;
    this.lightRig.add(this.jumpscareBgLight);
  }

  _syncLightRigTransform() {
    if (!this.lightRig || !this.root) return;
    this.lightRig.visible = true;
    this.lightRig.position.copy(this.root.position);
    this.lightRig.rotation.copy(this.root.rotation);
    this.lightRig.updateMatrixWorld(true);
  }

  // ============================================================================
  // 3. DETERMINISTIC SCENE PRESETS (setPresetPose(presetName, camera))
  // ============================================================================

  /**
   * Deterministically positions and poses Lisa for the 6 reference presets or 'free_roam'.
   * @param {string} presetName
   * @param {THREE.Camera} [camera]
   */
  setPresetPose(presetName, camera = null) {
    if (camera) this.camera = camera;

    // Reset all joint rotations to neutral first
    this._resetNeutralPose();

    if (presetName === 'lisa_corner_stalk' || presetName === 'preset_4') {
      // ========================================================================
      // PRESET 4: user_vibe_01.png & ref_04_lisa_corner_stalk.jpg
      // Standing down the dark corridor at (-0.08, 0.0, -8.85) barely illuminated
      // by cold, eerie pale-blue/slate grazing rim light (0x88a4be, intensity 1.45, dist 4.2)
      // at world (-0.35, 2.35, -8.65) and subtle face fill (0xa8bccf, intensity 0.48, dist 2.0)
      // at world (-0.22, 1.68, -8.35), leaving her right side and surrounding walls in deep shadow!
      // ========================================================================
      this.activePreset = presetName;
      this.presetLockTimer = 0.5;
      this.state = LISA_STATES.FLICKER_STALK;
      this.stateTimer = 0.0;
      this.flickerPulseIndex = 0;
      this._usingExternalFlickerCallbacks = false;
      this.root.visible = true;
      this.root.position.set(-0.08, 0.0, -8.85);
      this.basePosition.copy(this.root.position);

      // Face camera at (0.08, 1.58, -5.2)
      const camX = this.camera ? this.camera.position.x : 0.08;
      const camZ = this.camera ? this.camera.position.z : -5.2;
      this.baseRotationY = Math.atan2(camX - this.root.position.x, camZ - this.root.position.z);
      this.root.rotation.set(0, this.baseRotationY, 0);
      this._syncLightRigTransform();

      // Slight eerie hunched posture
      this.spine.rotation.set(0.06, 0.0, -0.03);
      this.chest.rotation.set(0.05, 0.0, -0.02);

      // Signature The Corridor head tilt:
      this.neck.rotation.set(0.04, 0.0, 0.04);
      this.headTiltOffset.rotation.set(0.0, 0.0, 1.22);
      this.headGroup.rotation.set(0.08, 0.0, -0.58);

      // Slightly parted dead grimace jaw
      this.jawGroup.rotation.set(0.14, 0, 0);

      // Arms dangling loosely & unnaturally at her sides
      this.shoulderL.rotation.set(-0.08, 0.0, -0.05);
      this.elbowL.rotation.set(-0.14, 0.0, -0.03);
      this.wristL.rotation.set(0.08, 0.0, 0.06);

      this.shoulderR.rotation.set(-0.08, 0.0, 0.05);
      this.elbowR.rotation.set(-0.16, 0.0, 0.03);
      this.wristR.rotation.set(0.08, 0.0, -0.06);

      // Subtle asymmetric stance
      this.hipL.rotation.set(-0.02, 0.03, 0.015);
      this.hipR.rotation.set(0.02, -0.04, -0.015);

      // Place cold blue-grey rim light BEHIND Lisa (z = -0.55 local -> -9.40 world) so her front dress/torso is a dark silhouette against the cold alcove glow (user_vibe_01.png)
      if (this.shadowBackdropGroup) this.shadowBackdropGroup.visible = false;
      if (this.stalkKeyLight) {
        this.stalkKeyLight.color.setHex(0x9ab8d4);
        this.stalkKeyLight.position.set(-0.18, 2.25, -0.55); // world (-0.26, 2.25, -9.40) behind Lisa!
        this.stalkKeyLight.distance = 4.8;
        this.stalkKeyLight.decay = 1.6;
        this.stalkKeyLight.intensity = 2.40;
      }
      if (this.stalkFaceFill) {
        this.stalkFaceFill.color.setHex(0x9eb8d0);
        this.stalkFaceFill.position.set(-0.12, 1.66, 0.36); // subtle front face catchlight only (distance 0.85m so it doesn't light the dress)
        this.stalkFaceFill.distance = 0.85;
        this.stalkFaceFill.decay = 2.2;
        this.stalkFaceFill.intensity = 0.38;
      }
      if (this.jumpscareKeyLight) this.jumpscareKeyLight.intensity = 0.0;
      if (this.jumpscareChestLight) this.jumpscareChestLight.intensity = 0.0;
      if (this.jumpscareMouthLight) this.jumpscareMouthLight.intensity = 0.0;
      if (this.jumpscareBgLight) this.jumpscareBgLight.intensity = 0.0;

      return;
    }

    if (presetName === 'lisa_jumpscare_closeup' || presetName === 'preset_6') {
      // ========================================================================
      // PRESET 6: ref_06_lisa_jumpscare_closeup.jpg
      // Places Lisa at (0.0, -0.18, -6.76) facing camera at (0.0, 1.56, -6.0) (0.76m away!)
      // Leaning forward (spine.rotation.x = 0.18), head centered filling the frame,
      // jaw wrenched wide open (jawGroup.rotation.x = 0.74) showing 24 stained 3D teeth & dark gums,
      // right eye bulging milky-white and left eye socket dark/hollow, lit harshly from below
      // against a pitch-black background!
      // ========================================================================
      this.activePreset = presetName;
      this.presetLockTimer = 0.5;
      this.state = LISA_STATES.JUMPSCARE_LUNGE;
      this.jumpScareTimer = 0.0;
      this.root.visible = true;
      this.root.position.set(0.0, -0.18, -6.76);
      this.basePosition.copy(this.root.position);
      this.baseRotationY = 0.0;
      this.root.rotation.set(0, 0, 0);
      this._syncLightRigTransform();

      // Leaning forward toward the lens while chest stays aligned inside dressGroup
      this.spine.rotation.set(0.18, 0.0, 0.0);
      this.chest.rotation.set(0.0, 0.0, 0.0);
      this.neck.rotation.set(-0.08, 0.0, 0.0);
      this.headTiltOffset.rotation.set(0.0, 0.0, 0.0);
      // Slight counter-pitch on head so face looks straight into camera lens while torso leans forward
      this.headGroup.rotation.set(-0.10, 0.0, -0.02);

      // Wrench lower jaw wide open in an agonizing shriek (0.74 rad)
      this.jawGroup.rotation.set(0.74, 0, 0);

      // Bulge milky-white right eye slightly forward for extreme closeup impact
      this.rightEye.scale.setScalar(1.08);
      this.rightEye.rotation.set(-0.04, 0.05, 0);

      // Counter-pitch shoulders (-0.22 rad) against spine.rotation.x (+0.18 rad) so sleeves hang straight down
      // inside the nightgown and never jut upward beside her neck or shoulder in shot_06!
      this.shoulderR.rotation.set(-0.22, 0.0, 0.04);
      this.elbowR.rotation.set(-0.12, 0.0, 0.04);
      this.wristR.rotation.set(0.04, 0.0, -0.06);

      this.shoulderL.rotation.set(-0.22, 0.0, -0.04);
      this.elbowL.rotation.set(-0.12, 0.0, -0.04);
      this.wristL.rotation.set(0.04, 0.0, 0.06);

      // High-contrast upward flashlight illumination (jumpscareUpLight.intensity = 2.8, color = 0xedece4) and pitch-black background
      if (this.shadowBackdropGroup) this.shadowBackdropGroup.visible = false;
      if (this.stalkKeyLight) this.stalkKeyLight.intensity = 0.0;
      if (this.stalkFaceFill) this.stalkFaceFill.intensity = 0.0;
      if (this.jumpscareUpLight) {
        this.jumpscareUpLight.color.setHex(0xedece4);
        this.jumpscareUpLight.intensity = 2.8;
      }
      if (this.jumpscareChestLight) this.jumpscareChestLight.intensity = 0.08;
      if (this.jumpscareMouthLight) this.jumpscareMouthLight.intensity = 1.65;
      if (this.jumpscareBgLight) this.jumpscareBgLight.intensity = 0.0;

      return;
    }

    if (
      presetName === 'foyer_corridor' ||
      presetName === 'corner_radio_clock' ||
      presetName === 'bathroom_sink_horror' ||
      presetName === 'red_hell_fridge_loop' ||
      presetName === 'preset_1' ||
      presetName === 'preset_2' ||
      presetName === 'preset_3' ||
      presetName === 'preset_5'
    ) {
      // Only lock activePreset in captureMode; in live play, keep activePreset null so update() runs the haunting AI!
      this.activePreset = this.captureMode ? presetName : null;
      this.presetLockTimer = 0.0;
      this.state = LISA_STATES.HIDDEN;
      this.root.visible = false;
      this.cooldownTimer = Math.max(this.cooldownTimer, 1.2);
      this._disablePresetLights();
      return;
    }

    if (presetName === 'free_roam' || presetName === 'roam' || !presetName) {
      this.activePreset = null;
      this.presetLockTimer = 0.0;
      this.state = LISA_STATES.HIDDEN;
      this.root.visible = false;
      this._disablePresetLights();
    }
  }

  // Convenience aliases for preset setting
  setPreset(presetName, camera) {
    return this.setPresetPose(presetName, camera);
  }

  applyPreset(presetName, camera) {
    return this.setPresetPose(presetName, camera);
  }

  _resetNeutralPose() {
    this.pelvis.position.set(0, 0.96, 0);
    this.pelvis.rotation.set(0, 0, 0);
    this.spine.rotation.set(0, 0, 0);
    this.chest.rotation.set(0, 0, 0);
    this.neck.rotation.set(0, 0, 0);
    this.headTiltOffset.rotation.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);
    this.jawGroup.rotation.set(0.12, 0, 0);
    this.rightEye.scale.setScalar(1.0);
    this.rightEye.rotation.set(0, 0, 0);

    this.shoulderL.rotation.set(0, 0, -0.06);
    this.elbowL.rotation.set(-0.12, 0, 0);
    this.wristL.rotation.set(0, 0, 0);

    this.shoulderR.rotation.set(0, 0, 0.06);
    this.elbowR.rotation.set(-0.12, 0, 0);
    this.wristR.rotation.set(0, 0, 0);

    this.hipL.rotation.set(0, 0, 0);
    this.kneeL.rotation.set(0, 0, 0);
    this.ankleL.rotation.set(0, 0, 0);

    this.hipR.rotation.set(0, 0, 0);
    this.kneeR.rotation.set(0, 0, 0);
    this.ankleR.rotation.set(0, 0, 0);
  }

  _disablePresetLights() {
    if (this.shadowBackdropGroup) this.shadowBackdropGroup.visible = false;
    if (this.stalkKeyLight) this.stalkKeyLight.intensity = 0.0;
    if (this.stalkFaceFill) this.stalkFaceFill.intensity = 0.0;
    if (this.jumpscareKeyLight) this.jumpscareKeyLight.intensity = 0.0;
    if (this.jumpscareChestLight) this.jumpscareChestLight.intensity = 0.0;
    if (this.jumpscareMouthLight) this.jumpscareMouthLight.intensity = 0.0;
    if (this.jumpscareBgLight) this.jumpscareBgLight.intensity = 0.0;
  }

  // ============================================================================
  // 4. HAUNTING TRIGGERS & FLICKER / JUMP-SCARE SEQUENCES
  // ============================================================================

  /**
   * Triggers a corner peek apparition at either 'bathroom_door' (x = -1.18, z = -8.38) or 'north_corner' (z = -12.85).
   * Bathed only in the faint cold 0x88a4be rim light (intensity = 0.95) so the player barely catches her dark silhouette.
   */
  triggerCornerPeek(location = 'bathroom_door') {
    if (this.captureMode && this.activePreset && this.activePreset !== 'free_roam') return;
    this.activePreset = null;
    this.state = LISA_STATES.CORNER_PEEK;
    this.peekLocation = location;
    this.peekFactor = 1.0;
    this.flashlightAimTimer = 0.0;
    this.stateTimer = 0.0;
    this.root.visible = true;
    this._resetNeutralPose();
    this._disablePresetLights();

    if (location === 'bathroom_door') {
      this.basePosition.set(-1.18, 0.0, -8.38);
      this.baseRotationY = Math.PI * 0.36;
    } else {
      // North corner at z = -12.85
      this.basePosition.set(-0.68, 0.0, -12.55);
      this.baseRotationY = 0.12;
    }
    this.root.position.copy(this.basePosition);
    this.root.rotation.set(0, this.baseRotationY, 0);

    // Faint cold 0x88a4be rim light (intensity = 0.95) so the player barely catches her dark twitching silhouette
    if (this.stalkKeyLight) {
      this.stalkKeyLight.color.setHex(0x88a4be);
      this.stalkKeyLight.position.set(-0.27, 2.35, 0.20);
      this.stalkKeyLight.distance = 4.2;
      this.stalkKeyLight.decay = 1.5;
      this.stalkKeyLight.intensity = 0.95;
    }
    if (this.stalkFaceFill) {
      this.stalkFaceFill.color.setHex(0xa8bccf);
      this.stalkFaceFill.position.set(-0.14, 1.68, 0.50);
      this.stalkFaceFill.distance = 2.0;
      this.stalkFaceFill.decay = 1.6;
      this.stalkFaceFill.intensity = 0.35;
    }
    this._syncLightRigTransform();
  }

  /**
   * Coordinates Lisa's multi-pulse teleportation with FlashlightSystem.triggerSuspenseFlickerSequence:
   *   - Pulse 1: Manifests quietly in the dim distance at (-0.08, 0.0, -8.85) with 38° tilted head & cold 0x88a4be rim light (user_vibe_01).
   *   - Blackout 1: Teleports silently forward to (0.0, 0.0, -6.2).
   *   - Pulse 2: Revealed standing right under the swinging pendant lamp twitching in cold shadow!
   *   - Sequence End: Vanishes into thin air with a whisper behind the player's ear (or triggers 'jumpscare_lunge').
   */
  triggerFlickerStalk(flashlightSystem = null, camera = null, options = {}) {
    if (this.captureMode && this.activePreset && this.activePreset !== 'free_roam') return;
    this.activePreset = null;
    const fl = flashlightSystem || this.flashlightSystem;
    if (camera) this.camera = camera;

    this.state = LISA_STATES.FLICKER_STALK;
    this.stateTimer = 0.0;
    this.flickerPulseIndex = 0;
    this.shouldLungeAtEnd = Boolean(options.lungeAtEnd);
    this._usingExternalFlickerCallbacks = false;

    // Position for Pulse 1: (-0.08, 0.0, -8.85) with signature 38° tilted head & faint cold rim light
    this._applyFlickerPulsePose(0);

    // If FlashlightSystem provides triggerSuspenseFlickerSequence, register our callbacks
    if (fl && typeof fl.triggerSuspenseFlickerSequence === 'function') {
      this._usingExternalFlickerCallbacks = true;
      fl.triggerSuspenseFlickerSequence('haunted_reveal', {
        onFlashOn: (pulseIndex) => this.onFlashOn(pulseIndex),
        onFlashOff: (pulseIndex) => this.onFlashOff(pulseIndex),
        onSequenceComplete: () => this.onSequenceComplete(),
      });
    }
  }

  onFlashOn(pulseIndex = 0) {
    if (this.captureMode && this.activePreset && this.activePreset !== 'free_roam') return;
    if (this.state === LISA_STATES.JUMPSCARE_LUNGE) return;
    this.state = LISA_STATES.FLICKER_STALK;
    this.flickerPulseIndex = pulseIndex;
    this._applyFlickerPulsePose(pulseIndex);
  }

  onFlashOff(pulseIndex = 0) {
    if (this.captureMode && this.activePreset && this.activePreset !== 'free_roam') return;
    if (this.state === LISA_STATES.JUMPSCARE_LUNGE) return;
    if (pulseIndex === 0) {
      // Blackout 1: Teleport silently forward to (0.0, 0.0, -6.2) under the pendant lamp!
      this.basePosition.set(0.0, 0.0, -6.2);
      this.root.position.copy(this.basePosition);
      this._syncLightRigTransform();
    } else {
      this.root.visible = false;
    }
  }

  onSequenceComplete() {
    if (this.captureMode && this.activePreset && this.activePreset !== 'free_roam') return;
    if (this.state === LISA_STATES.JUMPSCARE_LUNGE) return;
    if (this.shouldLungeAtEnd) {
      this.triggerJumpScare(this.camera);
    } else {
      // Vanish into thin air and trigger whisper behind player's ear
      this.hide();
      this.cooldownTimer = 2.5;
      if (this.soundscape && typeof this.soundscape.playWhisperBehind === 'function') {
        this.soundscape.playWhisperBehind();
      }
      if (typeof this.onWhisperCallback === 'function') {
        this.onWhisperCallback();
      }
    }
  }

  _applyFlickerPulsePose(pulseIndex) {
    this.root.visible = true;
    this._resetNeutralPose();

    const rimIntensity = this.captureMode ? 1.45 : 0.95;
    const faceIntensity = this.captureMode ? 0.48 : 0.38;

    if (pulseIndex <= 0) {
      // Pulse 1: (-0.08, 0.0, -8.85) with 38° tilted head & cold pale-blue grazing rim light (user_vibe_01)
      this.basePosition.set(-0.08, 0.0, -8.85);
      this.root.position.copy(this.basePosition);
      this.spine.rotation.set(0.06, 0.0, -0.03);
      this.chest.rotation.set(0.05, 0.0, -0.02);
      this.neck.rotation.set(0.04, 0.0, 0.04);
      this.headTiltOffset.rotation.set(0.0, 0.0, 1.22);
      this.headGroup.rotation.set(0.08, 0.0, -0.58);
      this.jawGroup.rotation.set(0.14, 0, 0);
    } else {
      // Pulse 2: Standing right under the swinging pendant lamp at (0.0, 0.0, -6.2) twitching in the dark!
      this.basePosition.set(0.0, 0.0, -6.2);
      this.root.position.copy(this.basePosition);
      this.spine.rotation.x = 0.12;
      this.headTiltOffset.rotation.z = -0.78;
      this.headGroup.rotation.set(0.14, 0.0, 0.35);
      this.jawGroup.rotation.x = 0.42;
    }

    if (this.shadowBackdropGroup) this.shadowBackdropGroup.visible = true;
    if (this.stalkKeyLight) {
      this.stalkKeyLight.color.setHex(0x88a4be);
      this.stalkKeyLight.position.set(-0.27, 2.35, 0.20);
      this.stalkKeyLight.distance = 4.2;
      this.stalkKeyLight.decay = 1.5;
      this.stalkKeyLight.intensity = rimIntensity;
    }
    if (this.stalkFaceFill) {
      this.stalkFaceFill.color.setHex(0xa8bccf);
      this.stalkFaceFill.position.set(-0.14, 1.68, 0.50);
      this.stalkFaceFill.distance = 2.0;
      this.stalkFaceFill.decay = 1.6;
      this.stalkFaceFill.intensity = faceIntensity;
    }

    if (this.camera) {
      this.baseRotationY = Math.atan2(
        this.camera.position.x - this.root.position.x,
        this.camera.position.z - this.root.position.z
      );
      this.root.rotation.y = this.baseRotationY;
    }
    this._syncLightRigTransform();
  }

  /**
   * Places Lisa 1.9m directly behind the player (camera.position - forwardFlat * 1.9)
   * facing the back of the player's neck. The moment the player turns around to look behind them
   * (camForward.dot(toLisa) > 0.68), she immediately lunges into triggerJumpScare(camera)!
   */
  triggerBehindPlayerStalk(camera = null) {
    if (this.captureMode && this.activePreset && this.activePreset !== 'free_roam') return;
    this.activePreset = null;
    if (camera) this.camera = camera;
    const cam = this.camera;

    this.state = LISA_STATES.BEHIND_PLAYER_STALK;
    this.stateTimer = 0.0;
    this.root.visible = true;
    this._resetNeutralPose();
    this._disablePresetLights();

    if (cam) {
      const forwardFlat = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      forwardFlat.y = 0;
      if (forwardFlat.lengthSq() < 1e-5) forwardFlat.set(0, 0, -1);
      forwardFlat.normalize();

      const behindPos = cam.position.clone().addScaledVector(forwardFlat, -1.9);
      behindPos.y = 0.0;
      // Clamp within Wing A corridor width if in Wing A
      behindPos.x = Math.max(-0.85, Math.min(0.85, behindPos.x));

      this.basePosition.copy(behindPos);
      this.root.position.copy(behindPos);
      this.baseRotationY = Math.atan2(
        cam.position.x - behindPos.x,
        cam.position.z - behindPos.z
      );
      this.root.rotation.set(0, this.baseRotationY, 0);
    }

    this.spine.rotation.set(0.10, 0.0, -0.03);
    this.chest.rotation.set(0.06, 0.0, -0.02);
    this.headTiltOffset.rotation.set(0.0, 0.0, 1.22);
    this.headGroup.rotation.set(0.08, 0.0, -0.58);
    this.jawGroup.rotation.set(0.28, 0.0, 0.0);

    if (this.shadowBackdropGroup) this.shadowBackdropGroup.visible = true;
    if (this.stalkKeyLight) {
      this.stalkKeyLight.color.setHex(0x88a4be);
      this.stalkKeyLight.position.set(-0.27, 2.35, 0.20);
      this.stalkKeyLight.distance = 4.2;
      this.stalkKeyLight.decay = 1.5;
      this.stalkKeyLight.intensity = 0.95;
    }
    if (this.stalkFaceFill) {
      this.stalkFaceFill.color.setHex(0xa8bccf);
      this.stalkFaceFill.position.set(-0.14, 1.68, 0.50);
      this.stalkFaceFill.distance = 2.0;
      this.stalkFaceFill.decay = 1.6;
      this.stalkFaceFill.intensity = 0.38;
    }
    this._syncLightRigTransform();

    if (this.soundscape && typeof this.soundscape.playWhisperBehind === 'function') {
      this.soundscape.playWhisperBehind();
    }
    if (typeof this.onWhisperCallback === 'function') {
      this.onWhisperCallback();
    }
  }

  /**
   * Triggers the Bathroom Mirror Apparition when the player inspects the sink.
   */
  triggerMirrorApparition(camera = null) {
    if (this.captureMode && this.activePreset && this.activePreset !== 'free_roam') return;
    this.activePreset = null;
    if (camera) this.camera = camera;
    this.state = LISA_STATES.MIRROR_APPARITION;
    this.stateTimer = 0.0;
    this.root.visible = true;
    this._resetNeutralPose();
    this._disablePresetLights();

    // Stand directly behind the player in the bathroom facing the mirror at z = -9.88
    this.basePosition.set(-2.35, 0.0, -8.55);
    this.baseRotationY = Math.PI;
    this.root.position.copy(this.basePosition);
    this.root.rotation.set(0, this.baseRotationY, 0);
    this.headTiltOffset.rotation.z = 0.64;
    this.jawGroup.rotation.x = 0.18;
    if (this.stalkFaceFill) {
      this.stalkFaceFill.color.setHex(0xa8bccf);
      this.stalkFaceFill.intensity = 0.45;
    }
    this._syncLightRigTransform();
  }

  /**
   * Triggers the full-screen Lisa Jump-Scare Lunge (`ref_06`):
   * Locks Lisa 0.76m directly in front of the camera lens, wrenches her jaw wide open (0.74 rad),
   * bulges her milky-white right eye, violently shakes her head/shoulders at 24Hz, and triggers
   * camera flinch + VHS glitch + scream audio!
   */
  triggerJumpScare(camera = null, onComplete = null) {
    if (camera) this.camera = camera;
    this.activePreset = null; // Allow active 24Hz thrashing
    this.presetLockTimer = 0.0;
    this.state = LISA_STATES.JUMPSCARE_LUNGE;
    this.jumpScareTimer = 0.0;
    this.jumpScareCompleteCallback = onComplete || null;
    this.root.visible = true;

    this._resetNeutralPose();
    this.spine.rotation.set(0.18, 0, 0);
    this.chest.rotation.set(0.0, 0, 0);
    this.neck.rotation.set(-0.08, 0, 0);
    this.headGroup.rotation.set(-0.10, 0, -0.02);
    this.jawGroup.rotation.set(0.74, 0, 0);
    this.rightEye.scale.setScalar(1.08);

    // Counter-pitch shoulders (-0.22 rad) so sleeves hang straight down at sides
    this.shoulderL.rotation.set(-0.22, 0.0, -0.04);
    this.elbowL.rotation.set(-0.12, 0.0, -0.04);
    this.wristL.rotation.set(0.04, 0.0, 0.06);

    this.shoulderR.rotation.set(-0.22, 0.0, 0.04);
    this.elbowR.rotation.set(-0.12, 0.0, 0.04);
    this.wristR.rotation.set(0.04, 0.0, -0.06);

    // High-contrast upward flashlight jump-scare lighting (jumpscareUpLight.intensity = 2.8, color = 0xedece4) and pitch-black background
    if (this.shadowBackdropGroup) this.shadowBackdropGroup.visible = false;
    if (this.stalkKeyLight) this.stalkKeyLight.intensity = 0.0;
    if (this.stalkFaceFill) this.stalkFaceFill.intensity = 0.0;
    if (this.jumpscareUpLight) {
      this.jumpscareUpLight.color.setHex(0xedece4);
      this.jumpscareUpLight.intensity = 2.8;
    }
    if (this.jumpscareChestLight) this.jumpscareChestLight.intensity = 0.08;
    if (this.jumpscareMouthLight) this.jumpscareMouthLight.intensity = 1.65;
    if (this.jumpscareBgLight) this.jumpscareBgLight.intensity = 0.0;

    this._lockInFrontOfCamera(this.camera, 0.76);

    // Trigger external subsystems (Camera flinch, VHS glitch, Audio shriek stinger)
    if (this.firstPersonEngine && typeof this.firstPersonEngine.triggerCameraFlinch === 'function') {
      this.firstPersonEngine.triggerCameraFlinch(1.0, 1.4);
    }
    if (this.soundscape && typeof this.soundscape.playJumpScareStinger === 'function') {
      this.soundscape.playJumpScareStinger();
    }
    if (this.postProcessor) {
      if (typeof this.postProcessor.triggerJumpScareGlitch === 'function') {
        this.postProcessor.triggerJumpScareGlitch(1.0, 1.5);
      } else if (this.postProcessor.uniforms && this.postProcessor.uniforms.uGlitchIntensity) {
        this.postProcessor.uniforms.uGlitchIntensity.value = 0.85;
      }
    }
    if (typeof this.onJumpScareCallback === 'function') {
      this.onJumpScareCallback();
    }
  }

  _lockInFrontOfCamera(camera, distance = 0.78) {
    if (!camera) return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 1e-5) forward.set(0, 0, -1);
    forward.normalize();

    const targetPos = camera.position.clone().addScaledVector(forward, distance);
    // Align Lisa's head height (local ~1.72m) with camera lens height (camera.position.y - 0.02)
    targetPos.y = camera.position.y - 1.74;

    this.root.position.copy(targetPos);
    this.basePosition.copy(targetPos);
    this.baseRotationY = Math.atan2(
      camera.position.x - targetPos.x,
      camera.position.z - targetPos.z
    );
    this.root.rotation.set(0, this.baseRotationY, 0);
    this._syncLightRigTransform();
  }

  hide() {
    this.state = LISA_STATES.HIDDEN;
    this.root.visible = false;
    this._disablePresetLights();
  }

  reset() {
    this.activePreset = null;
    this.presetLockTimer = 0.0;
    this.explorationTimer = 0.0;
    this.hauntStage = 0;
    this.hide();
    this._resetNeutralPose();
  }

  isJumpScareActive() {
    return this.state === LISA_STATES.JUMPSCARE_LUNGE;
  }

  getTensionLevel() {
    return this.tensionLevel;
  }

  // ============================================================================
  // 5. STOP-MOTION TWITCH & STALK ANIMATION UPDATE LOOP
  // ============================================================================

  /**
   * Updates Lisa's 10Hz quantized stop-motion skeletal twitching, spatial haunting AI,
   * and jump-scare thrashing.
   *
   * Supports both positional args:
   *   update(dt, elapsed, playerPos, camera, flashlightSystem, loopNumber)
   * and context object:
   *   update(dt, elapsed, { playerPos, camera, flashlightSystem, loopNumber })
   */
  update(dt = 0.016, elapsed = 0, playerPos = null, camera = null, flashlightSystem = null, loopNumber = 1) {
    // Unpack if third argument is a context object
    if (
      playerPos &&
      typeof playerPos === 'object' &&
      !playerPos.isVector3 &&
      ('camera' in playerPos || 'playerPos' in playerPos || 'loopNumber' in playerPos)
    ) {
      const ctx = playerPos;
      camera = ctx.camera || camera || this.camera;
      flashlightSystem = ctx.flashlightSystem || flashlightSystem || this.flashlightSystem;
      loopNumber = ctx.loopNumber ?? ctx.loopState?.loopNumber ?? loopNumber;
      playerPos = ctx.playerPos || (camera ? camera.position : null);
    }

    if (camera) this.camera = camera;
    if (flashlightSystem) this.flashlightSystem = flashlightSystem;
    if (loopNumber !== undefined && loopNumber !== null) this.loopNumber = loopNumber;

    const cam = this.camera;
    const pPos = playerPos || (cam ? cam.position : null);

    // --------------------------------------------------------------------------
    // A. Deterministic Scene Preset Mode (Locked only in captureMode or first 0.5s of Preset 4 / 6)
    // --------------------------------------------------------------------------
    if (this.activePreset && this.activePreset !== 'free_roam') {
      const isLisaShowcasePreset =
        this.activePreset === 'lisa_corner_stalk' ||
        this.activePreset === 'preset_4' ||
        this.activePreset === 'lisa_jumpscare_closeup' ||
        this.activePreset === 'preset_6';

      if (this.captureMode || (isLisaShowcasePreset && this.presetLockTimer > 0)) {
        if (!this.captureMode) {
          this.presetLockTimer = Math.max(0, this.presetLockTimer - dt);
        }
        if (this.activePreset === 'lisa_corner_stalk' || this.activePreset === 'preset_4') {
          // Subtle 10Hz micro-breathing & finger/hair tremor while preserving exact reference pose
          const qTime = Math.floor(elapsed * 10) / 10;
          const microSnap = Math.sin(qTime * 37.0) > 0.96 ? (hash1D(qTime * 19.0) - 0.5) * 0.06 : 0;
          this.headGroup.rotation.z = -0.58 + microSnap;
          this.headGroup.rotation.x = 0.08 + Math.sin(qTime * 6.3) * 0.012;
          this.jawGroup.rotation.x = 0.14 + Math.abs(Math.sin(qTime * 11.0)) * 0.025;
          this._animateFingersAndHem(qTime, 0.35);
        } else if (this.activePreset === 'lisa_jumpscare_closeup' || this.activePreset === 'preset_6') {
          // Keep exact ref_06 framing with subtle jaw/finger tension tremor
          const qTime = Math.floor(elapsed * 10) / 10;
          this.jawGroup.rotation.x = 0.74 + Math.sin(qTime * 19.0) * 0.015;
          this._animateFingersAndHem(qTime, 0.45);
        }
        return;
      } else {
        // Release preset lock in live browser play so the live haunting state machine always runs!
        this.activePreset = null;
      }
    }

    // --------------------------------------------------------------------------
    // B. Quantized 10fps Uncanny Stop-Motion Timer
    // --------------------------------------------------------------------------
    const qTime = Math.floor(elapsed * 10) / 10;
    this.stateTimer += dt;

    // 15ms spasmodic neck micro-snap detector
    const snapWindow = (elapsed % 1.35) < 0.018;
    const snapAngle = snapWindow ? (hash1D(qTime * 43.7) - 0.5) * 0.52 : 0;

    // --------------------------------------------------------------------------
    // C. Haunting State Machine Execution
    // --------------------------------------------------------------------------
    switch (this.state) {
      case LISA_STATES.HIDDEN: {
        this.root.visible = false;
        this.tensionLevel = Math.max(0, this.tensionLevel - dt * 0.25);
        this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
        this.explorationTimer += dt;

        // Relentless autonomous haunting triggers in live play (active from Loop 1 onward!)
        if (pPos && this.cooldownTimer <= 0) {
          const inBathroomPeekZone = pPos.z <= -3.8 && pPos.z >= -7.2;
          const inStalkerManifestZone = pPos.z <= -4.2 && pPos.z >= -6.8;

          if (this.hauntStage === 0 && inBathroomPeekZone) {
            // 1. Bathroom Doorway / North Corner Peek as player walks down Wing A
            const peekLoc = this.hauntCycleCount % 2 === 0 ? 'bathroom_door' : 'north_corner';
            this.triggerCornerPeek(peekLoc);
            this.hauntStage = 1;
            this.explorationTimer = 0;
            this.cooldownTimer = 3.5;
          } else if (
            (this.hauntStage === 1 && inStalkerManifestZone) ||
            this.explorationTimer >= 9.0
          ) {
            // 2. Corridor Stalker Manifestation (z in [-4.2, -6.8] or after 9s of exploration)
            this.triggerFlickerStalk(this.flashlightSystem, cam);
            this.hauntStage = 2;
            this.explorationTimer = 0;
            this.cooldownTimer = 4.0;
          } else if (this.hauntStage === 2 && (pPos.z <= -4.0 || this.explorationTimer >= 5.5)) {
            // 3. Behind-Player Stalk (places Lisa 1.9m behind player waiting for them to turn around)
            this.triggerBehindPlayerStalk(cam);
            this.hauntStage = 0;
            this.hauntCycleCount++;
            this.explorationTimer = 0;
            this.cooldownTimer = 8.0;
          } else if (pPos.z < -7.2 && pPos.z > -11.5 && Math.abs(pPos.x) < 0.95) {
            // Deep corridor north corner peek
            this.triggerCornerPeek('north_corner');
            this.hauntStage = 1;
            this.explorationTimer = 0;
            this.cooldownTimer = 5.0;
          }
        }
        break;
      }

      case LISA_STATES.CORNER_PEEK: {
        this.root.visible = true;
        this.tensionLevel = Math.min(1.0, this.tensionLevel + dt * 0.4);

        // Proximity Jump-Scare Trigger: player walks within 1.65m of Lisa (distSq < 2.72)
        if (pPos) {
          const dx = pPos.x - this.root.position.x;
          const dz = pPos.z - this.root.position.z;
          const distSq = dx * dx + dz * dz;
          if (distSq < 2.72) {
            this.triggerJumpScare(cam);
            break;
          }
        }

        // Check if player aims flashlight directly at Lisa (dot > 0.95 for 0.6s) or peek times out
        if (cam) {
          const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
          const lisaHeadWorld = new THREE.Vector3();
          this.headGroup.getWorldPosition(lisaHeadWorld);
          const toLisa = lisaHeadWorld.sub(cam.position).normalize();
          const dot = camDir.dot(toLisa);

          if (dot > 0.95) {
            this.flashlightAimTimer += dt;
          } else {
            this.flashlightAimTimer = Math.max(0, this.flashlightAimTimer - dt * 0.5);
          }

          if (this.flashlightAimTimer >= 0.6 || this.stateTimer >= 4.8) {
            // Smoothly pull back behind the corner into darkness
            this.peekFactor = Math.max(0, this.peekFactor - dt * 2.4);
            if (this.peekFactor <= 0.02) {
              this.hide();
              this.cooldownTimer = 2.5;
              break;
            }
          }
        }

        // Apply leaning peek offset + quantized 10Hz stop-motion head twitch
        const leanSign = this.peekLocation === 'bathroom_door' ? 1 : 1;
        const retractOffset = (1.0 - this.peekFactor) * 0.58;
        if (this.peekLocation === 'bathroom_door') {
          this.root.position.set(
            this.basePosition.x - retractOffset,
            0.0,
            this.basePosition.z
          );
        } else {
          this.root.position.set(
            this.basePosition.x - retractOffset,
            0.0,
            this.basePosition.z - retractOffset * 0.4
          );
        }

        this.spine.rotation.z = -0.32 * this.peekFactor * leanSign;
        this.headTiltOffset.rotation.z = 0.68 * this.peekFactor + snapAngle;
        this.headGroup.rotation.z = -0.24 + (hash1D(qTime * 13.1) - 0.5) * 0.14;
        this.jawGroup.rotation.x = 0.16 + hash1D(qTime * 29.3) * 0.08;
        this._animateFingersAndHem(qTime, 0.6);
        this._syncLightRigTransform();
        break;
      }

      case LISA_STATES.FLICKER_STALK: {
        this.root.visible = true;
        this.tensionLevel = 0.85;

        // Proximity Jump-Scare Trigger: player walks within 1.65m of Lisa (distSq < 2.72)
        if (pPos) {
          const dx = pPos.x - this.root.position.x;
          const dz = pPos.z - this.root.position.z;
          const distSq = dx * dx + dz * dz;
          if (distSq < 2.72) {
            this.triggerJumpScare(cam);
            break;
          }
        }

        // Fallback internal multi-pulse progression if FlashlightSystem did not drive callbacks
        if (!this._usingExternalFlickerCallbacks) {
          if (this.flickerPulseIndex === 0 && this.stateTimer >= 1.25) {
            this.onFlashOff(0);
            this.onFlashOn(1);
          } else if (this.stateTimer >= 2.85) {
            this.onSequenceComplete();
            break;
          }
        } else if (this.stateTimer >= 5.2) {
          this.onSequenceComplete();
          break;
        }

        // Face player smoothly while body twitches at 10Hz
        if (cam) {
          this.baseRotationY = Math.atan2(
            cam.position.x - this.root.position.x,
            cam.position.z - this.root.position.z
          );
          this.root.rotation.y = this.baseRotationY;
        }

        const intensity = this.flickerPulseIndex > 0 ? 1.0 : 0.45;
        const qJitterZ = (hash1D(qTime * 17.7) - 0.5) * 0.22 * intensity + snapAngle;
        const qJitterX = (hash1D(qTime * 31.3) - 0.5) * 0.14 * intensity;
        const qShoulder = (hash1D(qTime * 23.9) - 0.5) * 0.12 * intensity;

        this.headTiltOffset.rotation.z = 1.22;
        this.headGroup.rotation.set(0.08 + qJitterX, (hash1D(qTime * 7.1) - 0.5) * 0.12, -0.58 + qJitterZ);
        this.chest.rotation.z = qShoulder;
        this.jawGroup.rotation.x = 0.14 + hash1D(qTime * 41.2) * 0.26 * intensity;

        this._animateFingersAndHem(qTime, 0.75 * intensity);
        this._syncLightRigTransform();
        break;
      }

      case LISA_STATES.BEHIND_PLAYER_STALK: {
        this.root.visible = true;
        this.tensionLevel = 0.92;

        if (cam) {
          const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
          camForward.y = 0;
          if (camForward.lengthSq() < 1e-5) camForward.set(0, 0, -1);
          camForward.normalize();

          const toLisa = new THREE.Vector3(
            this.root.position.x - cam.position.x,
            0,
            this.root.position.z - cam.position.z
          );
          const distSq = toLisa.lengthSq();
          if (distSq > 1e-5) toLisa.normalize();

          // Turn-Around & Proximity Jump-Scare Trigger:
          // The moment the player turns around to look behind them (camForward.dot(toLisa) > 0.68)
          // or walks within 1.65m (distSq < 2.72), she immediately lunges into triggerJumpScare!
          if (camForward.dot(toLisa) > 0.68 || distSq < 2.72) {
            this.triggerJumpScare(cam);
            break;
          }

          // Keep facing the back of the player's neck
          this.baseRotationY = Math.atan2(
            cam.position.x - this.root.position.x,
            cam.position.z - this.root.position.z
          );
          this.root.rotation.y = this.baseRotationY;
        }

        // Quantized 10Hz stop-motion head & shoulder twitching behind the player
        const qJitterZ = (hash1D(qTime * 19.1) - 0.5) * 0.18 + snapAngle;
        const qJitterX = (hash1D(qTime * 29.7) - 0.5) * 0.12;
        this.headTiltOffset.rotation.z = 1.22;
        this.headGroup.rotation.set(0.08 + qJitterX, 0, -0.58 + qJitterZ);
        this.jawGroup.rotation.x = 0.24 + hash1D(qTime * 37.3) * 0.18;
        this._animateFingersAndHem(qTime, 0.7);
        this._syncLightRigTransform();

        if (this.stateTimer >= 8.5) {
          this.hide();
          this.cooldownTimer = 5.0;
        }
        break;
      }

      case LISA_STATES.MIRROR_APPARITION: {
        this.root.visible = true;
        this.tensionLevel = 0.75;
        this.headGroup.rotation.z = -0.45 + (hash1D(qTime * 19.3) - 0.5) * 0.18 + snapAngle;
        this.jawGroup.rotation.x = 0.22 + hash1D(qTime * 27.1) * 0.12;
        this._animateFingersAndHem(qTime, 0.5);
        this._syncLightRigTransform();

        // Vanish if player turns around to look directly at her
        if (cam && this.stateTimer > 0.8) {
          const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
          const toLisa = this.root.position.clone().sub(cam.position).normalize();
          if (camDir.dot(toLisa) > 0.65 || this.stateTimer > 6.5) {
            this.hide();
          }
        }
        break;
      }

      case LISA_STATES.JUMPSCARE_LUNGE: {
        this.root.visible = true;
        this.tensionLevel = 1.0;
        this.jumpScareTimer += dt;

        // Lock 0.78m directly in front of camera lens
        this._lockInFrontOfCamera(cam, 0.76);

        // Violent 24Hz head, jaw, shoulder, and claw thrashing!
        const q24 = Math.floor(elapsed * 24) / 24;
        const shakeX = Math.sin(q24 * 68.0) * 0.11;
        const shakeY = Math.cos(q24 * 54.0) * 0.09;
        const shakeZ = Math.sin(q24 * 82.0) * 0.18;

        this.spine.rotation.set(0.18 + shakeX * 0.35, shakeY * 0.25, shakeZ * 0.25);
        this.chest.rotation.set(0, 0, shakeZ * 0.15);
        this.headTiltOffset.rotation.set(0, 0, shakeZ * 0.65);
        this.headGroup.rotation.set(-0.10 + shakeX, shakeY, -0.02 + shakeZ * 0.5);

        // Wrench jaw wide open (0.74 rad) with violent shriek vibration
        this.jawGroup.rotation.x = 0.74 + Math.sin(q24 * 95.0) * 0.05;

        // Bulge milky-white right eye
        this.rightEye.scale.setScalar(1.08 + Math.sin(q24 * 70.0) * 0.04);

        // Keep shoulders counter-pitched (-0.22 rad) with violent 24Hz tremor so sleeves stay cleanly draped
        this.shoulderL.rotation.set(-0.22 + shakeX * 0.3, shakeY * 0.2, -0.04 + shakeZ * 0.2);
        this.shoulderR.rotation.set(-0.22 - shakeX * 0.3, -shakeY * 0.2, 0.04 - shakeZ * 0.2);
        this._animateFingersAndHem(q24, 1.35);

        if (this.jumpScareTimer >= this.jumpScareDuration) {
          const cb = this.jumpScareCompleteCallback;
          this.jumpScareCompleteCallback = null;
          this.hide();
          this.cooldownTimer = 6.0;
          if (this.postProcessor && this.postProcessor.uniforms && this.postProcessor.uniforms.uGlitchIntensity) {
            this.postProcessor.uniforms.uGlitchIntensity.value = 0.0;
          }
          if (typeof cb === 'function') cb();
        }
        break;
      }
    }
  }

  /**
   * Animates quantized finger twitching, hair lock sway, and tattered dress hem strips.
   */
  _animateFingersAndHem(qTime, intensity = 0.5) {
    // Twitch 10 bony fingers
    if (this.fingersL && this.fingersR) {
      for (let i = 0; i < 5; i++) {
        const curlL = 0.28 + Math.sin(qTime * 14.0 + i * 1.7) * 0.24 * intensity;
        const curlR = 0.28 + Math.cos(qTime * 15.3 + i * 2.1) * 0.24 * intensity;
        this.fingersL[i].knuckle.rotation.x = curlL;
        this.fingersR[i].knuckle.rotation.x = curlR;
      }
    }

    // Subtle wet hair strand shudder
    if (this.hairStrands) {
      for (let i = 0; i < this.hairStrands.length; i++) {
        const hs = this.hairStrands[i];
        hs.group.rotation.z = Math.sin(qTime * 9.0 + hs.phase) * 0.018 * intensity;
      }
    }

    // Tattered hem strips sway
    if (this.hemStrips) {
      for (let i = 0; i < this.hemStrips.length; i++) {
        this.hemStrips[i].rotation.x = Math.sin(qTime * 7.5 + i * 0.9) * 0.04 * intensity;
      }
    }
  }
}

export default LisaEntityController;
