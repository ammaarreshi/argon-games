import * as THREE from '../assets/vendor/three.module.js';
import { PointerLockControls } from '../assets/vendor/PointerLockControls.js';

/**
 * Authoritative Ground-Truth Camera & Flashlight Presets for the 6 Reference Frames
 * (`ref_01_foyer_corridor.jpg` .. `ref_06_lisa_jumpscare_closeup.jpg`) + `'free_roam'`.
 */
export const CAMERA_PRESETS = {
  foyer_corridor: {
    id: 'foyer_corridor',
    index: 1,
    title: 'Preset 1: Foyer Corridor (Wing A)',
    position: new THREE.Vector3(0.05, 1.56, -1.65),
    target: new THREE.Vector3(0.0, 1.48, -9.50),
    fov: 65,
    handPlacement: 'hidden',
    flashlightTarget: new THREE.Vector3(-0.08, 1.48, -4.80),
    aimTarget: [-0.08, 1.48, -4.80],
    flashlightColor: 0xedece4,
    color: 0xedece4,
    flashlightIntensity: 24.0,
    flashlightAngle: 0.80,
    flashlightPenumbra: 0.42,
    flashlightDistance: 6.2,
    distance: 6.2,
    flashlightDecay: 1.65,
    decay: 1.65,
    bounceIntensity: 3.60,
    nearIntensity: 5.80,
    coneOpacity: 0.0,
    dustOpacity: 0.04,
    loopIndex: 1,
  },
  corner_radio_clock: {
    id: 'corner_radio_clock',
    index: 2,
    title: 'Preset 2: Corner Radio, 23:59 Clock & Gouged Portrait',
    position: new THREE.Vector3(0.32, 1.50, -9.35),
    target: new THREE.Vector3(-0.38, 1.32, -11.45),
    fov: 65,
    handPlacement: 'hidden',
    flashlightTarget: new THREE.Vector3(-0.56, 1.42, -11.30),
    aimTarget: [-0.56, 1.42, -11.30],
    flashlightColor: 0xedece4,
    color: 0xedece4,
    flashlightIntensity: 18.5,
    flashlightAngle: 0.68,
    flashlightPenumbra: 0.38,
    flashlightDistance: 6.8,
    distance: 6.8,
    flashlightDecay: 1.85,
    decay: 1.85,
    bounceIntensity: 1.45,
    nearIntensity: 2.25,
    coneOpacity: 0.0,
    dustOpacity: 0.06,
    loopIndex: 2,
  },
  bathroom_sink_horror: {
    id: 'bathroom_sink_horror',
    index: 3,
    title: 'Preset 3: Bathroom Sink Horror Specimen',
    position: new THREE.Vector3(-2.12, 1.36, -8.56),
    target: new THREE.Vector3(-1.52, 0.96, -9.48),
    fov: 62,
    handPlacement: 'hidden',
    flashlightTarget: new THREE.Vector3(-1.54, 0.90, -9.44),
    aimTarget: [-1.54, 0.90, -9.44],
    flashlightColor: 0xeef2ee,
    color: 0xeef2ee,
    flashlightIntensity: 6.5,
    flashlightAngle: 0.50,
    flashlightPenumbra: 0.38,
    flashlightDistance: 5.5,
    distance: 5.5,
    flashlightDecay: 2.15,
    decay: 2.15,
    bounceIntensity: 0.12,
    nearIntensity: 0.06,
    coneOpacity: 0.0,
    dustOpacity: 0.0,
    loopIndex: 2,
  },
  lisa_corner_stalk: {
    id: 'lisa_corner_stalk',
    index: 4,
    title: 'Preset 4: Lisa Stalking in the Corridor',
    position: new THREE.Vector3(0.08, 1.56, -5.20),
    target: new THREE.Vector3(-0.08, 1.46, -9.15),
    fov: 62,
    handPlacement: 'hidden',
    flashlightTarget: new THREE.Vector3(-0.18, 1.48, -7.25),
    aimTarget: [-0.18, 1.48, -7.25],
    flashlightColor: 0xedece4,
    color: 0xedece4,
    flashlightIntensity: 20.0,
    flashlightAngle: 0.78,
    flashlightPenumbra: 0.42,
    flashlightDistance: 3.55,
    distance: 3.55,
    flashlightDecay: 2.05,
    decay: 2.05,
    bounceIntensity: 2.20,
    nearIntensity: 4.60,
    coneOpacity: 0.0,
    dustOpacity: 0.05,
    loopIndex: 4,
  },
  red_hell_fridge_loop: {
    id: 'red_hell_fridge_loop',
    index: 5,
    title: 'Preset 5: Loop 3 Red Hell & Swinging Refrigerator',
    position: new THREE.Vector3(-0.08, 1.48, -2.55),
    target: new THREE.Vector3(0.10, 1.42, -6.50),
    fov: 65,
    handPlacement: 'hidden',
    flashlightTarget: new THREE.Vector3(0.10, 1.45, -5.80),
    aimTarget: [0.10, 1.45, -5.80],
    flashlightColor: 0xff8877,
    color: 0xff8877,
    flashlightIntensity: 12.5,
    flashlightAngle: 0.62,
    flashlightPenumbra: 0.40,
    flashlightDistance: 7.4,
    distance: 7.4,
    flashlightDecay: 1.95,
    decay: 1.95,
    bounceIntensity: 0.45,
    nearIntensity: 0.65,
    coneOpacity: 0.0,
    dustOpacity: 0.0,
    loopIndex: 3,
  },
  lisa_jumpscare_closeup: {
    id: 'lisa_jumpscare_closeup',
    index: 6,
    title: 'Preset 6: Lisa Lunge Jump Scare Close-Up',
    position: new THREE.Vector3(0.0, 1.56, -6.00),
    target: new THREE.Vector3(0.0, 1.53, -6.76),
    fov: 58,
    handPlacement: 'hidden',
    flashlightTarget: new THREE.Vector3(-0.02, 1.54, -6.76),
    aimTarget: [-0.02, 1.54, -6.76],
    flashlightColor: 0xedece4,
    color: 0xedece4,
    flashlightIntensity: 3.2,
    flashlightAngle: 0.44,
    flashlightPenumbra: 0.36,
    flashlightDistance: 3.4,
    distance: 3.4,
    flashlightDecay: 2.15,
    decay: 2.15,
    bounceIntensity: 0.04,
    nearIntensity: 0.02,
    coneOpacity: 0.0,
    dustOpacity: 0.0,
    loopIndex: 4,
  },
  free_roam: {
    id: 'free_roam',
    index: 0,
    title: 'Free Roam (First-Person Interactive)',
    position: new THREE.Vector3(0.0, 1.56, -1.65),
    target: new THREE.Vector3(0.0, 1.46, -8.50),
    fov: 65,
    handPlacement: 'hidden',
    flashlightTarget: null,
    aimTarget: null,
    flashlightColor: 0xedece4,
    color: 0xedece4,
    flashlightIntensity: 24.0,
    flashlightAngle: 0.80,
    flashlightPenumbra: 0.42,
    flashlightDistance: 6.2,
    distance: 6.2,
    flashlightDecay: 1.65,
    decay: 1.65,
    bounceIntensity: 3.60,
    nearIntensity: 5.80,
    coneOpacity: 0.0,
    dustOpacity: 0.04,
    loopIndex: 1,
  },
};

export const PRESET_FLASHLIGHT_CONFIG = CAMERA_PRESETS;

export const PRESET_NAMES = [
  'foyer_corridor',
  'corner_radio_clock',
  'bathroom_sink_horror',
  'lisa_corner_stalk',
  'red_hell_fridge_loop',
  'lisa_jumpscare_closeup',
];

/**
 * Authoritative L-Shaped Corridor & Bathroom Walkable Regions and Prop Colliders.
 */
export const CORRIDOR_BOUNDS = {
  wingA: { minX: -0.82, maxX: 0.82, minZ: -13.62, maxZ: -0.55 },
  wingB: { minX: -0.82, maxX: 9.05, minZ: -13.62, maxZ: -12.05 },
  bathroomDoorway: { minX: -1.45, maxX: -0.82, minZ: -8.95, maxZ: -7.85 },
  bathroomInterior: { minX: -3.90, maxX: -1.25, minZ: -9.85, maxZ: -7.10 },
  loopThreshold: { minX: 8.65, minZ: -13.6, maxZ: -12.0 },
  loopSpawnPosition: new THREE.Vector3(0.0, 1.62, -1.20),
  propColliders: [
    // Foyer console table along left wall of Wing A
    { id: 'console_table', minX: -1.16, maxX: -0.52, minZ: -4.42, maxZ: -3.18 },
    // Cast-iron steam radiator along left wall of Wing A
    { id: 'steam_radiator', minX: -1.16, maxX: -0.72, minZ: -5.92, maxZ: -4.88 },
    // Left-wall corner walnut sideboard dresser holding radio & 23:59 clock (Wing A before North archway)
    { id: 'left_corner_dresser', minX: -1.16, maxX: -0.56, minZ: -11.60, maxZ: -10.30 },
    // North corner walnut sideboard dresser holding radio & 23:59 clock
    { id: 'corner_dresser', minX: -1.02, maxX: -0.06, minZ: -13.98, maxZ: -13.14 },
    // Bathroom porcelain pedestal sink
    { id: 'bathroom_sink', minX: -2.25, maxX: -1.35, minZ: -9.85, maxZ: -9.05 },
    // Bathroom bathtub along West wall
    { id: 'bathroom_tub', minX: -4.15, maxX: -3.05, minZ: -9.95, maxZ: -7.85 },
  ],
};

/**
 * Deterministic pseudo-random helper for procedural textures and dust layouts.
 */
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates a 512x512 CanvasTexture (`SRGBColorSpace`) producing the high-contrast
 * circular The Corridor flashlight beam profile matching `user_vibe_01.png` and `user_vibe_02.png`:
 * - Strong, clear circular beam core from `r = 0.0` to `r = 0.58`
 * - Distinct optical lens ring step at `r = 0.58..0.74` with subtle lens grime/dust
 * - Steep cutoff to pure `#000000` black from `r = 0.74` to `r = 0.86` so outside the
 *   circular beam cone the corridor falls into total darkness.
 */
export function createFlashlightCookieTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size * 0.5;
  const rand = seededRandom(204863);

  // Base pitch-black background so edges never leak
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  // 1. High-contrast circular flashlight beam profile (`r = 0..0.58` core, `0.58..0.74` lens ring, `0.74..0.86` steep black cutoff)
  const baseGrad = ctx.createRadialGradient(half, half, 0, half, half, half);
  baseGrad.addColorStop(0.00, 'rgba(252, 251, 245, 1.0)');
  baseGrad.addColorStop(0.26, 'rgba(246, 244, 236, 0.98)');
  baseGrad.addColorStop(0.46, 'rgba(232, 229, 218, 0.90)');
  baseGrad.addColorStop(0.58, 'rgba(205, 202, 190, 0.78)');
  // Slight optical dip before outer parabolic lens ring step (`0.58..0.74`)
  baseGrad.addColorStop(0.63, 'rgba(165, 162, 152, 0.62)');
  baseGrad.addColorStop(0.69, 'rgba(210, 206, 194, 0.72)');
  baseGrad.addColorStop(0.74, 'rgba(148, 145, 135, 0.48)');
  // Steep cutoff to pure black (`0.74..0.86`) matching `user_vibe_01.png` & `user_vibe_02.png`
  baseGrad.addColorStop(0.80, 'rgba(38, 36, 32, 0.12)');
  baseGrad.addColorStop(0.86, 'rgba(0, 0, 0, 0.0)');
  baseGrad.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // 2. Subtle off-center filament astigmatism lobes inside the circular core
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.35;
    const ox = half + Math.cos(angle) * (size * 0.025);
    const oy = half + Math.sin(angle) * (size * 0.025);
    const lobeGrad = ctx.createRadialGradient(ox, oy, size * 0.01, ox, oy, size * 0.22);
    lobeGrad.addColorStop(0.0, 'rgba(250, 248, 240, 0.14)');
    lobeGrad.addColorStop(0.6, 'rgba(230, 226, 214, 0.05)');
    lobeGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = lobeGrad;
    ctx.beginPath();
    ctx.arc(ox, oy, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Fine concentric lens grinding micro-rings within `r < 0.74`
  ctx.save();
  for (let r = 0.18; r < 0.74; r += 0.045 + rand() * 0.025) {
    const radius = half * r;
    ctx.beginPath();
    ctx.arc(half, half, radius, 0, Math.PI * 2);
    const isBrightRing = rand() > 0.45;
    ctx.strokeStyle = isBrightRing
      ? `rgba(250, 248, 238, ${(0.025 + rand() * 0.035).toFixed(3)})`
      : `rgba(14, 14, 12, ${(0.045 + rand() * 0.065).toFixed(3)})`;
    ctx.lineWidth = 1.0 + rand() * 2.4;
    ctx.stroke();
  }
  ctx.restore();

  // 4. Subtle lens grime & smudges near the `0.50..0.72` ring
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const theta = rand() * Math.PI * 2;
    const dist = half * (0.22 + rand() * 0.48);
    const sx = half + Math.cos(theta) * dist;
    const sy = half + Math.sin(theta) * dist;
    const rx = size * (0.03 + rand() * 0.07);
    const ry = size * (0.016 + rand() * 0.04);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(theta + (rand() - 0.5) * 0.8);
    const smudgeGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    smudgeGrad.addColorStop(0.0, `rgba(10, 10, 9, ${(0.11 + rand() * 0.14).toFixed(3)})`);
    smudgeGrad.addColorStop(0.65, `rgba(15, 14, 12, ${(0.05 + rand() * 0.07).toFixed(3)})`);
    smudgeGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = smudgeGrad;
    ctx.scale(1.0, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 5. Microscopic dust specks on the glass lens (`r < 0.72`)
  ctx.save();
  for (let i = 0; i < 80; i++) {
    const theta = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * half * 0.72;
    const dx = half + Math.cos(theta) * dist;
    const dy = half + Math.sin(theta) * dist;
    const speckRadius = 0.7 + rand() * 2.0;
    const alpha = 0.10 + rand() * 0.22;
    ctx.fillStyle = `rgba(8, 8, 7, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(dx, dy, speckRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 6. Guaranteed steep black outer cutoff mask (`r = 0.72 -> 0.86`)
  const maskGrad = ctx.createRadialGradient(half, half, half * 0.70, half, half, half * 0.86);
  maskGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
  maskGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.65)');
  maskGrad.addColorStop(0.92, 'rgba(0, 0, 0, 0.98)');
  maskGrad.addColorStop(1.0, 'rgba(0, 0, 0, 1.0)');
  ctx.fillStyle = maskGrad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a high-resolution 512x512 procedural CNC-machined diamond-knurled
 * black anodized aluminum texture & bump map for the tactical flashlight barrel and head.
 */
function createKnurledMetalTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(77801);

  // Deep black-charcoal anodized aluminum base
  ctx.fillStyle = '#14161a';
  ctx.fillRect(0, 0, size, size);

  // Subtle brushed circumferential metal grain across the whole shell
  for (let y = 0; y < size; y += 2) {
    const shade = 18 + Math.floor(rand() * 10);
    ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
    ctx.fillRect(0, y, size, 1);
  }

  // Precision diamond knurling band across the central grip section (y ∈ [0.22..0.78])
  const knurlTop = Math.floor(size * 0.22);
  const knurlBot = Math.floor(size * 0.78);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, knurlTop, size, knurlBot - knurlTop);
  ctx.clip();

  const step = 6;
  ctx.strokeStyle = '#2d323a';
  ctx.lineWidth = 1.35;
  for (let i = -size; i < size * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, knurlTop);
    ctx.lineTo(i + (knurlBot - knurlTop), knurlBot);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i, knurlBot);
    ctx.lineTo(i + (knurlBot - knurlTop), knurlTop);
    ctx.stroke();
  }

  // Dark recessed diamond pits for crisp normal/bump relief
  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = 0.8;
  for (let i = -size + 3; i < size * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, knurlTop);
    ctx.lineTo(i + (knurlBot - knurlTop), knurlBot);
    ctx.stroke();
  }
  ctx.restore();

  // CNC machined cooling grooves & O-ring channels above and below knurling
  const grooveY = [
    knurlTop - 16,
    knurlTop - 8,
    knurlTop,
    knurlBot,
    knurlBot + 8,
    knurlBot + 16,
  ];
  for (let g = 0; g < grooveY.length; g++) {
    const gy = grooveY[g];
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, gy - 2, size, 4);
    ctx.fillStyle = '#343a44';
    ctx.fillRect(0, gy + 2, size, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a 512x512 deeply shadowed realistic human skin & knuckle micro-pore texture
 * tuned for low-key The Corridor corridor silhouette lighting (`ref_01`, `ref_02`, `ref_04`, `ref_06`).
 */
function createHandSkinTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(7780);

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0.0, '#4a3326');
  grad.addColorStop(0.55, '#38251b');
  grad.addColorStop(1.0, '#241710');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle skin pores and organic Epidermal grain
  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.5 + rand() * 1.5;
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(22, 12, 8, 0.14)' : 'rgba(110, 78, 58, 0.08)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle tendon & skin crease micro-lines
  ctx.strokeStyle = 'rgba(18, 10, 6, 0.18)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    const y = (i / 18) * size + rand() * 8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(size * 0.5, y + (rand() - 0.5) * 12, size, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * `FlashlightSystem` — Builds and controls the The Corridor (Corridor Engine) optical flashlight rig:
 * - Primary `THREE.SpotLight` with 512x512 optical lens-dirt cookie texture & soft shadows
 * - Dynamic indirect `bounceLight` (`THREE.PointLight`) tracking the beam hit point
 * - Close-range fill `nearLight` (`THREE.PointLight`) preventing near-plane crush
 * - Translucent forward-locked volumetric cone (`ShaderMaterial`) + 220 airborne dust motes (`THREE.Points`)
 * - AAA CNC-machined black anodized-aluminum tactical flashlight & low-profile shadowed grip (`handRig`)
 * - Multi-stage suspenseful flicker & blackout sequence engine
 * - Deterministic capture support (`setPresetState(presetName)`)
 */
export class FlashlightSystem {
  constructor(scene, camera, renderer = null) {
    // Support flexible argument order in case caller passes (camera, scene, renderer)
    if (scene && scene.isCamera && camera && camera.isScene) {
      this.camera = scene;
      this.scene = camera;
    } else {
      this.scene = scene;
      this.camera = camera;
    }
    this.renderer = renderer;

    const urlParams =
      typeof window !== 'undefined' && window.location
        ? new URLSearchParams(window.location.search)
        : null;
    this.captureMode = Boolean(
      urlParams && (urlParams.get('capture') === '1' || urlParams.get('capture') === 'true')
    );

    this.isOn = true;
    this.baseIntensity = 13.5;
    this.baseBounceIntensity = 0.05;
    this.baseNearIntensity = 0.02;
    this.baseConeOpacity = 0.0;
    this.baseDustOpacity = 0.32;
    this.baseColor = new THREE.Color(0xedece4);

    this.handPlacement = 'hidden';
    this.deterministicMode = false;
    this.currentPreset = 'free_roam';

    // Live screen-space circular beam state read by PTPostProcessor
    this.beamScreenState = {
      centerX: 0.5,
      centerY: 0.5,
      power: 1.0,
      radius: 0.54,
    };
    this._hoverOffsetX = 0.0;
    this._hoverOffsetY = 0.0;

    // Warmup / cooldown filament transition state
    this._powerFactor = 1.0;
    this._targetPowerFactor = 1.0;
    this._lastToggleTimeMs = 0;
    this._lastUpdateElapsed = -1;
    this._needsImmediateAimSync = true;

    // Suspense flicker sequence state
    this.flickerState = {
      active: false,
      mode: 'haunted_reveal',
      elapsed: 0,
      duration: 2.65,
      stage: 0,
      firedFlash1: false,
      firedBlackout1: false,
      firedFlash2: false,
      firedBlackout2: false,
      callbacks: {},
      multiplier: 1.0,
    };

    // Audio / event callback hook
    this.onAudioEvent = null;

    // Internal reusable math objects
    this._camWorldPos = new THREE.Vector3();
    this._camWorldQuat = new THREE.Quaternion();
    this._camForward = new THREE.Vector3(0, 0, -1);
    this._camRight = new THREE.Vector3(1, 0, 0);
    this._camUp = new THREE.Vector3(0, 1, 0);
    this._bezelWorldPos = new THREE.Vector3();
    this._targetWorldPos = new THREE.Vector3(0, 1.5, -5.0);
    this._smoothTargetPos = new THREE.Vector3(0, 1.5, -5.0);
    this._beamDir = new THREE.Vector3(0, 0, -1);
    this._bounceWorldPos = new THREE.Vector3();
    this._tempVec = new THREE.Vector3();
    this._presetAimTarget = null;
    this._presetPosition = null;
    this._raycaster = new THREE.Raycaster();
    this._raycaster.near = 0.25;
    this._raycaster.far = 9.0;

    // Root container in world space so spotLight, target, bounceLight, and dust work seamlessly
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'PT_FlashlightSystem_Root';
    if (this.scene) {
      this.scene.add(this.rootGroup);
    }

    // 1. Procedural 512x512 High-Contrast Circular Flashlight Cookie Texture
    this.cookieTexture = this.createFlashlightCookieTexture(512);

    // 2. Primary THREE.SpotLight (high-contrast circular The Corridor beam with steep distance falloff)
    this.spotLight = new THREE.SpotLight(0xedece4, 13.5, 7.4, 0.52, 0.36, 2.15);
    this.spotLight.name = 'Flashlight_PrimarySpotLight';
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.shadow.camera.near = 0.12;
    this.spotLight.shadow.camera.far = 9.0;
    this.spotLight.shadow.focus = 1.0;
    this.spotLight.shadow.bias = -0.0003;
    this.spotLight.shadow.normalBias = 0.015;
    this.spotLight.shadow.radius = 2.0;
    this.spotLight.map = this.cookieTexture;

    this.spotTarget = new THREE.Object3D();
    this.spotTarget.name = 'Flashlight_SpotTarget';
    this.spotTarget.position.set(0, 1.5, -5.0);
    this.spotLight.target = this.spotTarget;

    this.rootGroup.add(this.spotLight);
    this.rootGroup.add(this.spotTarget);

    // 3. Foreground-Mid Corridor Bounce Light (`bounceLight`, illuminates walls & frames 2.0m-4.6m ahead inside the circular beam)
    this.bounceLight = new THREE.PointLight(0xe4e2d8, 3.60, 4.6, 1.75);
    this.bounceLight.name = 'Flashlight_BounceLight';
    this.bounceLight.castShadow = false;
    this.rootGroup.add(this.bounceLight);

    // 4. Foreground Grazing Fill Light (`nearLight`, illuminates walls, ceiling & floor 1.2m-4.2m ahead inside the circular beam)
    this.nearLight = new THREE.PointLight(0xedece4, 5.80, 4.3, 1.75);
    this.nearLight.name = 'Flashlight_NearFillLight';
    this.nearLight.castShadow = false;
    this.rootGroup.add(this.nearLight);

    // 5. Tactical Flashlight & Low-Profile Grip (`handRig`, hidden by default for pure The Corridor chest-light framing)
    this.handRig = this._buildHandAndFlashlightRig();
    this.rootGroup.add(this.handRig);

    // 6. Volumetric Light Cone (`volumetricCone`, opacity 0.0 by default so center corridor stays pitch-black)
    this.volumetricCone = this._buildVolumetricCone();
    this.rootGroup.add(this.volumetricCone);

    // 7. Airborne Dust Motes (`dustParticles`, 220 particles glinting inside the circular beam)
    this.dustCount = 220;
    this.dustParticles = this._buildDustMotes(this.dustCount);
    this.rootGroup.add(this.dustParticles);

    // Perform initial transform sync
    this.setHandPlacement(this.handPlacement);
    this.update(0.016, 0.0);
  }

  /**
   * Instance method delegating to `createFlashlightCookieTexture` as specified in requirements.
   */
  createFlashlightCookieTexture(size = 512) {
    return createFlashlightCookieTexture(size);
  }

  /**
   * Builds the AAA PS5 Corridor Engine First-Person Tactical Flashlight & Low-Profile Shadowed Grip (`handRig`)
   * visible in the bottom corner of the viewport (`ref_01`, `ref_02`, `ref_04`, `ref_06`).
   * Uses a continuous 64-segment CNC-machined `LatheGeometry` profile for the anodized-aluminum
   * tactical torch, flared fluted anti-roll bezel, deep parabolic chrome reflector, and a smooth,
   * deeply shadowed low-profile anatomical grip & coat sleeve cuff at the bottom outer edge.
   */
  _buildHandAndFlashlightRig() {
    const rig = new THREE.Group();
    rig.name = 'FirstPerson_HandFlashlightRig';

    const mirrorGroup = new THREE.Group();
    mirrorGroup.name = 'HandFlashlight_MirrorGroup';
    rig.add(mirrorGroup);
    this._handMirrorGroup = mirrorGroup;

    const knurlTex = createKnurledMetalTexture(512);
    const skinTex = createHandSkinTexture(512);

    const anodizedMat = new THREE.MeshPhysicalMaterial({
      color: 0x101216,
      map: knurlTex,
      bumpMap: knurlTex,
      bumpScale: 0.0022,
      metalness: 0.82,
      roughness: 0.32,
      clearcoat: 0.22,
      clearcoatRoughness: 0.32,
      side: THREE.DoubleSide,
    });

    const bezelMat = new THREE.MeshPhysicalMaterial({
      color: 0x0c0e12,
      metalness: 0.85,
      roughness: 0.28,
      clearcoat: 0.24,
      clearcoatRoughness: 0.25,
      side: THREE.DoubleSide,
    });

    const chromeReflectorMat = new THREE.MeshStandardMaterial({
      color: 0xd8dfe8,
      metalness: 0.92,
      roughness: 0.14,
    });

    this.lensEmissiveMat = new THREE.MeshBasicMaterial({
      color: 0xffebb8,
    });

    const lensGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffe8b8,
      transparent: true,
      opacity: 0.45,
      roughness: 0.12,
      metalness: 0.04,
      clearcoat: 0.8,
      emissive: new THREE.Color(0xffd27d),
      emissiveIntensity: 0.45,
    });
    this._lensGlassMat = lensGlassMat;

    const skinMat = new THREE.MeshPhysicalMaterial({
      color: 0x261a14,
      map: skinTex,
      bumpMap: skinTex,
      bumpScale: 0.0008,
      roughness: 0.68,
      metalness: 0.02,
      clearcoat: 0.04,
      clearcoatRoughness: 0.52,
      sheen: 0.05,
      sheenColor: new THREE.Color(0x3d2a1f),
    });

    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x0c0b0d,
      roughness: 0.90,
      metalness: 0.04,
    });

    // --- 1. Seamless CNC-Machined Tactical Flashlight Assembly (aligned along local -Z) ---
    const torchGroup = new THREE.Group();
    torchGroup.name = 'TacticalFlashlight_Mesh';
    mirrorGroup.add(torchGroup);
    this._torchGroup = torchGroup;

    // Continuous 2D lathe profile with Y strictly INCREASING from front bezel (-0.191) to rear tailcap (+0.152)
    // so Three.js LatheGeometry generates outward-facing exterior vertex normals!
    // After rotateX(+PI / 2), lathe Y maps to +Z: y = -0.191 -> z = -0.191 (front bezel pointing away),
    // and y = +0.152 -> z = +0.152 (rear tailcap near wrist).
    const lathePoints = [
      new THREE.Vector2(0.0000, -0.184), // Solid sealed front head bulkhead center
      new THREE.Vector2(0.0350, -0.184), // Lens seat recess floor
      new THREE.Vector2(0.0355, -0.191), // Inner bezel step
      new THREE.Vector2(0.0395, -0.191), // Front bezel rim tip
      new THREE.Vector2(0.0425, -0.188), // Front anti-roll crown lip
      new THREE.Vector2(0.0415, -0.184), // Flared head cylindrical shell front
      new THREE.Vector2(0.0410, -0.142), // Flared head rear bevel
      new THREE.Vector2(0.0385, -0.134), // Flared tactical head transition
      new THREE.Vector2(0.0285, -0.106), // Tapered neck
      new THREE.Vector2(0.0258, -0.094), // Switch collar front
      new THREE.Vector2(0.0258, -0.086), // Cooling fin 3 crest
      new THREE.Vector2(0.0218, -0.082), // Fin groove 2
      new THREE.Vector2(0.0252, -0.079), // Cooling fin 2 front
      new THREE.Vector2(0.0252, -0.072), // Cooling fin 2 crest
      new THREE.Vector2(0.0215, -0.068), // Fin groove 1
      new THREE.Vector2(0.0248, -0.065), // Cooling fin 1 crest
      new THREE.Vector2(0.0248, -0.058), // Cooling fin 1 rear
      new THREE.Vector2(0.0218, -0.052), // Diamond-knurled grip barrel front
      new THREE.Vector2(0.0220,  0.114), // Barrel rear collar
      new THREE.Vector2(0.0205,  0.118), // Tailcap O-ring groove
      new THREE.Vector2(0.0225,  0.122), // Tailcap body
      new THREE.Vector2(0.0225,  0.146), // Tailcap outer rim
      new THREE.Vector2(0.0190,  0.152), // Tailcap chamfer inner
      new THREE.Vector2(0.0000,  0.152), // Rear tailcap center (closed)
    ];
    const bodyLatheGeo = new THREE.LatheGeometry(lathePoints, 64);
    bodyLatheGeo.rotateX(Math.PI * 0.5);
    bodyLatheGeo.computeVertexNormals();
    const bodyLatheMesh = new THREE.Mesh(bodyLatheGeo, anodizedMat);
    torchGroup.add(bodyLatheMesh);

    // 12 CNC-machined longitudinal anti-roll flutes & ribs around the flared tactical head
    for (let r = 0; r < 12; r++) {
      const ang = (r / 12) * Math.PI * 2;
      const ribGeo = new THREE.BoxGeometry(0.0048, 0.0032, 0.040);
      const ribMesh = new THREE.Mesh(ribGeo, bezelMat);
      ribMesh.position.set(
        Math.cos(ang) * 0.0410,
        Math.sin(ang) * 0.0410,
        -0.163
      );
      ribMesh.rotation.z = ang;
      torchGroup.add(ribMesh);
    }

    // 8 subtle crenellated tactical strike bezel scallops around the front rim (`z = -0.190`)
    for (let c = 0; c < 8; c++) {
      const ang = (c / 8) * Math.PI * 2 + Math.PI / 8;
      const toothGeo = new THREE.BoxGeometry(0.0060, 0.0028, 0.0045);
      const toothMesh = new THREE.Mesh(toothGeo, bezelMat);
      toothMesh.position.set(
        Math.cos(ang) * 0.0385,
        Math.sin(ang) * 0.0385,
        -0.1912
      );
      toothMesh.rotation.z = ang;
      torchGroup.add(toothMesh);
    }

    // Low-profile rubberized tactical push-button switch pad near the front collar
    const switchGeo = new THREE.CylinderGeometry(0.0065, 0.0075, 0.0045, 20);
    const switchMat = new THREE.MeshStandardMaterial({
      color: 0x08090b,
      roughness: 0.78,
      metalness: 0.12,
    });
    const switchMesh = new THREE.Mesh(switchGeo, switchMat);
    switchMesh.position.set(-0.011, 0.0235, -0.088);
    switchMesh.rotation.z = 0.44;
    torchGroup.add(switchMesh);

    // Front anti-reflective tempered glass lens disk (strictly single-sided facing -Z away from camera)
    const lensGeo = new THREE.CircleGeometry(0.0345, 48);
    const lensMesh = new THREE.Mesh(lensGeo, lensGlassMat);
    lensMesh.position.set(0, 0, -0.1895);
    lensMesh.rotation.y = Math.PI;
    torchGroup.add(lensMesh);

    // Bezel origin anchor at the exact front of the flashlight lens (`z = -0.194`)
    this.bezelAnchor = new THREE.Object3D();
    this.bezelAnchor.position.set(0, 0, -0.194);
    torchGroup.add(this.bezelAnchor);

    // --- 2. Continuous Low-Profile Shadowed Grip & Dark Sleeve Cuff ---
    // Kept strictly below the top barrel ridge (`y <= +0.006`) so the sleek anodized
    // flashlight cylinder and flared bezel silhouette remain 100% clean, with a natural
    // dark-shadowed thumb/palm web & coat cuff at the very bottom-outer corner (`ref_01`, `ref_02`).
    const handGroup = new THREE.Group();
    handGroup.name = 'SculptedHumanHand';
    mirrorGroup.add(handGroup);
    this._handMeshGroup = handGroup;

    // Continuous sculpted palm & dorsal thumb-web arch hugging the lower-outer rear barrel
    const palmArchGeo = new THREE.CapsuleGeometry(0.023, 0.095, 16, 28);
    palmArchGeo.rotateX(Math.PI * 0.5);
    const palmArchMesh = new THREE.Mesh(palmArchGeo, skinMat);
    palmArchMesh.position.set(0.018, -0.011, 0.048);
    palmArchMesh.rotation.set(0.09, -0.14, -0.22);
    palmArchMesh.scale.set(0.96, 0.76, 1.08);
    handGroup.add(palmArchMesh);

    // Smooth continuous thumb resting naturally along the outer-side of the barrel (`y <= +0.005`)
    const thumbSweepGeo = new THREE.CapsuleGeometry(0.0115, 0.064, 14, 24);
    thumbSweepGeo.rotateX(Math.PI * 0.5);
    const thumbSweepMesh = new THREE.Mesh(thumbSweepGeo, skinMat);
    thumbSweepMesh.position.set(0.021, -0.002, -0.012);
    thumbSweepMesh.rotation.set(0.04, 0.08, -0.15);
    thumbSweepMesh.scale.set(0.92, 0.84, 1.0);
    handGroup.add(thumbSweepMesh);

    // Low-profile under-barrel finger grip silhouette tucked strictly beneath the barrel (`y = -0.024`)
    const underGripGeo = new THREE.CapsuleGeometry(0.018, 0.078, 14, 24);
    underGripGeo.rotateX(Math.PI * 0.5);
    const underGripMesh = new THREE.Mesh(underGripGeo, skinMat);
    underGripMesh.position.set(0.004, -0.023, 0.006);
    underGripMesh.rotation.set(0.05, -0.04, 0.15);
    underGripMesh.scale.set(1.05, 0.68, 1.0);
    handGroup.add(underGripMesh);

    // Dark wool/leather coat sleeve cuff entering from the lower-outer viewport edge
    const sleeveCuffGeo = new THREE.CylinderGeometry(0.036, 0.044, 0.16, 28);
    sleeveCuffGeo.rotateX(Math.PI * 0.5);
    const sleeveCuffMesh = new THREE.Mesh(sleeveCuffGeo, sleeveMat);
    sleeveCuffMesh.position.set(0.032, -0.028, 0.155);
    sleeveCuffMesh.rotation.set(0.14, -0.18, -0.14);
    sleeveCuffMesh.scale.set(1.06, 0.82, 1.0);
    handGroup.add(sleeveCuffMesh);

    // Ultra-subtle grazing rim light (`intensity = 0.012`) so the black anodized aluminum flutes
    // catch a realistic Corridor Engine specular edge without overexposing the hand in dark silhouette
    this.handKeyLight = new THREE.PointLight(0xffe2be, 0.012, 0.48, 2.0);
    this.handKeyLight.position.set(0.0, 0.11, -0.08);
    this.handKeyLight.castShadow = false;
    mirrorGroup.add(this.handKeyLight);

    return rig;
  }

  /**
   * Builds the translucent forward-locked volumetric beam frustum (`CylinderGeometry` + custom `ShaderMaterial`)
   * whose narrow lens end (`r = 0.033m`) starts at `(0, 0, 0)` and expands along **+Z** (`z ∈ [0, +5.4]`).
   * Because `THREE.Mesh.lookAt(target)` aligns a Mesh's **+Z** axis with `target - position`,
   * extending the cone along **+Z** guarantees the volumetric beam ALWAYS projects strictly FORWARD
   * from the flashlight bezel into the corridor ahead and NEVER backwards over the hand!
   */
  _buildVolumetricCone() {
    const length = 5.4;
    const bezelRadius = 0.033;
    const farRadius = 1.48;
    // Open-ended frustum cone with 48 radial & 28 height segments for smooth interpolation
    const geo = new THREE.CylinderGeometry(bezelRadius, farRadius, length, 48, 28, true);
    // CylinderGeometry default has top (bezelRadius) at +Y (length/2) and bottom (farRadius) at -Y (-length/2).
    // Rotate -PI/2 around X so top (bezelRadius) is at -Z (-length/2) and bottom (farRadius) is at +Z (+length/2),
    // then translate +Z by length/2 so bezel apex is at (0, 0, 0) and far base is at (0, 0, +length)!
    geo.rotateX(-Math.PI * 0.5);
    geo.translate(0, 0, length * 0.5);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xfff1d4) },
        uOpacity: { value: this.baseConeOpacity },
        uTime: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        varying vec3 vLocalPos;

        void main() {
          vUv = uv;
          vLocalPos = position;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPosition.xyz;
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uTime;

        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        varying vec3 vLocalPos;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise2D(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          // Axial coordinate along +Z cone: 0.0 at flashlight bezel lens -> 1.0 at far base (+5.4m)
          float axial = clamp(vLocalPos.z / 5.4, 0.0, 1.0);

          // Soft ramp-in right at bezel lens and exponential falloff along beam distance
          float axialFade = smoothstep(0.0, 0.028, axial) * pow(1.0 - axial, 2.05);

          // View-angle Fresnel attenuation so cone silhouette edges are velvety soft
          vec3 viewDir = normalize(vViewPos);
          float ndotv = abs(dot(normalize(vNormalView), viewDir));
          float fresnel = pow(ndotv, 1.65);

          // Subtle animated dusty air currents & radial optical shaft variation
          float angle = atan(vLocalPos.y, vLocalPos.x);
          float shaftNoise = noise2D(vec2(angle * 3.5 + uTime * 0.08, axial * 2.5 - uTime * 0.14));
          float dustTurb = 0.78 + 0.34 * shaftNoise;

          // Focused optical scatter right in front of the flashlight lens bezel (first 0.75m)
          float bezelGlow = exp(-axial * 6.0) * 0.42 * smoothstep(0.0, 0.015, axial);

          float alpha = uOpacity * (axialFade * fresnel * dustTurb + bezelGlow * fresnel);
          if (alpha < 0.001) discard;

          gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 0.78));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'Flashlight_VolumetricCone';
    mesh.renderOrder = 10;
    return mesh;
  }

  /**
   * Builds 220 floating 3D airborne dust motes (`THREE.Points`) with golden-white bokeh glow
   * that drift lazily on air currents and sparkle brightly when inside the flashlight cone.
   */
  _buildDustMotes(count = 220) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    const velocities = new Float32Array(count * 3);
    const coneAnchored = new Float32Array(count);

    const rand = seededRandom(99412);
    for (let i = 0; i < count; i++) {
      // First 160 particles live directly within the flashlight beam frustum so the beam
      // always has rich visible floating dust motes (`ref_01`, `ref_02`, `ref_04`),
      // while the remaining 60 drift through the surrounding corridor volume.
      const inBeam = i < 160 ? 1.0 : 0.0;
      coneAnchored[i] = inBeam;

      if (inBeam > 0.5) {
        const distFrac = Math.pow(rand(), 0.78);
        const radFrac = Math.sqrt(rand()) * 0.92;
        const theta = rand() * Math.PI * 2;
        positions[i * 3 + 0] = Math.cos(theta) * radFrac;
        positions[i * 3 + 1] = Math.sin(theta) * radFrac;
        positions[i * 3 + 2] = distFrac;
      } else {
        positions[i * 3 + 0] = (rand() - 0.5) * 2.2;
        positions[i * 3 + 1] = 0.25 + rand() * 2.4;
        positions[i * 3 + 2] = -0.6 - rand() * 12.5;
      }

      scales[i] = 0.55 + Math.pow(rand(), 1.6) * 1.45;
      phases[i] = rand() * Math.PI * 2;

      velocities[i * 3 + 0] = (rand() - 0.5) * 0.06;
      velocities[i * 3 + 1] = 0.015 + (rand() - 0.45) * 0.04;
      velocities[i * 3 + 2] = (rand() - 0.5) * 0.06;
    }

    this._dustBaseData = {
      basePositions: new Float32Array(positions),
      velocities,
      phases,
      coneAnchored,
    };

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aInBeam', new THREE.BufferAttribute(coneAnchored, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xffe7b2) },
        uOpacity: { value: this.baseDustOpacity },
        uTime: { value: 0.0 },
        uBeamOrigin: { value: new THREE.Vector3(0, 1.4, -1.6) },
        uBeamDir: { value: new THREE.Vector3(0, 0, -1) },
        uBeamCosHalfAngle: { value: Math.cos(0.42 * 0.75) },
      },
      vertexShader: /* glsl */ `
        attribute float aScale;
        attribute float aPhase;
        attribute float aInBeam;

        uniform float uTime;
        uniform vec3 uBeamOrigin;
        uniform vec3 uBeamDir;
        uniform float uBeamCosHalfAngle;

        varying float vAlpha;
        varying float vSparkle;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float distToCam = max(0.25, -mvPosition.z);

          // Check how strongly this dust mote is illuminated by the forward flashlight cone
          vec3 toParticle = position - uBeamOrigin;
          float beamDist = length(toParticle);
          vec3 dirToParticle = beamDist > 0.001 ? (toParticle / beamDist) : uBeamDir;
          float cosAng = dot(dirToParticle, uBeamDir);

          float coneFactor = smoothstep(uBeamCosHalfAngle - 0.14, uBeamCosHalfAngle + 0.08, cosAng);
          coneFactor = max(coneFactor, aInBeam * 0.88);
          // Strictly zero out any particle behind the bezel (cosAng < 0)
          coneFactor *= smoothstep(0.05, 0.25, cosAng);
          float distAtten = smoothstep(0.08, 0.35, beamDist) * (1.0 - smoothstep(1.2, 6.2, beamDist));

          // Organic twinkle as the dust speck tumbles in the air
          float twinkle = 0.62 + 0.38 * sin(uTime * 2.8 + aPhase * 6.2831);
          vSparkle = twinkle;
          vAlpha = clamp((0.04 + coneFactor * 0.96) * distAtten * twinkle, 0.0, 1.0);

          gl_PointSize = clamp((4.2 * aScale) / distToCam, 1.0, 3.4);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;

        varying float vAlpha;
        varying float vSparkle;

        void main() {
          vec2 cxy = 2.0 * gl_PointCoord - 1.0;
          float r2 = dot(cxy, cxy);
          if (r2 > 1.0) discard;

          // Crisp pinpoint dust mote rather than wide blurry disc
          float r = sqrt(r2);
          float intensity = exp(-r * 4.2);

          vec3 col = mix(uColor, vec3(1.0, 0.98, 0.92), intensity * 0.65 * vSparkle);
          float finalAlpha = vAlpha * uOpacity * intensity;
          if (finalAlpha < 0.004) discard;

          gl_FragColor = vec4(col, finalAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.name = 'Flashlight_AirborneDustMotes';
    points.frustumCulled = false;
    points.renderOrder = 12;
    return points;
  }

  /**
   * Updates world-space positions of the 220 airborne dust motes so the forward beam cone
   * is always populated with floating dust specks (`ref_01`, `ref_02`, `ref_04`).
   */
  _updateDustParticles(elapsed) {
    if (!this.dustParticles || !this._dustBaseData) return;

    const posAttr = this.dustParticles.geometry.getAttribute('position');
    const arr = posAttr.array;
    const { basePositions, velocities, phases, coneAnchored } = this._dustBaseData;

    // Build orthonormal basis around forward `this._beamDir`
    const forward = this._beamDir;
    const upRef = Math.abs(forward.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = this._camRight.crossVectors(forward, upRef).normalize();
    const up = this._camUp.crossVectors(right, forward).normalize();

    const isLisaStalk = this.currentPreset === 'lisa_corner_stalk';
    const driftT = this.captureMode && this.deterministicMode ? 1.25 : elapsed;

    for (let i = 0; i < this.dustCount; i++) {
      const phase = phases[i];
      if (coneAnchored[i] > 0.5 || (this.captureMode && this.deterministicMode)) {
        const bx = basePositions[i * 3 + 0];
        const by = basePositions[i * 3 + 1];
        const bz = Math.abs(basePositions[i * 3 + 2]) % 1.0;

        // Gentle drift along air currents within near/mid forward flashlight cone
        const dFrac = (bz + driftT * 0.025 + Math.sin(driftT * 0.4 + phase) * 0.02) % 1.0;
        const dist = 0.26 + dFrac * 2.25;
        const coneRadiusAtDist = 0.035 + dFrac * 0.42;

        let rx = bx * coneRadiusAtDist + Math.sin(driftT * 0.7 + phase) * 0.025;
        const ry = by * coneRadiusAtDist + Math.cos(driftT * 0.55 + phase * 1.3) * 0.025;

        if (isLisaStalk) {
          rx -= 0.10;
        }

        arr[i * 3 + 0] =
          this._bezelWorldPos.x + forward.x * dist + right.x * rx + up.x * ry;
        arr[i * 3 + 1] =
          this._bezelWorldPos.y + forward.y * dist + right.y * rx + up.y * ry;
        arr[i * 3 + 2] =
          this._bezelWorldPos.z + forward.z * dist + right.z * rx + up.z * ry;
      } else {
        const ox = basePositions[i * 3 + 0] + Math.sin(driftT * 0.35 + phase) * 0.18 + velocities[i * 3 + 0] * driftT;
        const oy = basePositions[i * 3 + 1] + Math.cos(driftT * 0.28 + phase) * 0.12;
        const oz = basePositions[i * 3 + 2] + Math.sin(driftT * 0.30 + phase * 0.7) * 0.18;

        arr[i * 3 + 0] = this._camWorldPos.x + ((ox + 1.1) % 2.2) - 1.1;
        arr[i * 3 + 1] = Math.max(0.15, Math.min(2.95, oy));
        arr[i * 3 + 2] = oz;
      }
    }

    posAttr.needsUpdate = true;

    const uniforms = this.dustParticles.material.uniforms;
    uniforms.uTime.value = this.captureMode && this.deterministicMode ? 1.85 : elapsed;
    uniforms.uBeamOrigin.value.copy(this._bezelWorldPos);
    uniforms.uBeamDir.value.copy(this._beamDir);
    uniforms.uBeamCosHalfAngle.value = Math.cos(this.spotLight.angle * 0.75);
  }

  /**
   * Configures first-person hand & tactical flashlight viewport placement:
   * - `'bottom_right'` (default, `ref_02`, `ref_06`)
   * - `'bottom_left'` (`ref_01`, `ref_04`)
   * - `'hidden'` (`ref_03`, `ref_05`)
   */
  setHandPlacement(mode = 'bottom_right') {
    const normalized = String(mode || 'bottom_right').toLowerCase();
    this.handRig.visible = true;
    if (normalized === 'hidden' || normalized === 'none' || normalized === 'shoulder') {
      this.handPlacement = 'hidden';
      if (this._torchGroup) this._torchGroup.visible = false;
      if (this._handMeshGroup) this._handMeshGroup.visible = false;
      if (this.handKeyLight) this.handKeyLight.intensity = 0.0;
      return;
    }

    if (this._torchGroup) this._torchGroup.visible = true;
    if (this._handMeshGroup) this._handMeshGroup.visible = true;
    if (normalized === 'bottom_left' || normalized === 'left') {
      this.handPlacement = 'bottom_left';
      // Flip X scale so grip & sleeve sit on the outer bottom-left edge (`ref_01`, `ref_04`)
      this._handMirrorGroup.scale.set(-1, 1, 1);
    } else {
      this.handPlacement = 'bottom_right';
      this._handMirrorGroup.scale.set(1, 1, 1);
    }
  }

  /**
   * Toggles the flashlight ON or OFF (`F` key) with a realistic filament warm-up/cool-down curve.
   */
  toggle(forceState) {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (typeof forceState !== 'boolean' && nowMs - this._lastToggleTimeMs < 60) {
      return this.isOn;
    }
    this._lastToggleTimeMs = nowMs;

    const nextState = typeof forceState === 'boolean' ? forceState : !this.isOn;
    this.isOn = nextState;
    this._targetPowerFactor = this.isOn ? 1.0 : 0.0;
    if (this.captureMode && this.deterministicMode) {
      this._powerFactor = this._targetPowerFactor;
    }
    if (typeof this.onAudioEvent === 'function') {
      this.onAudioEvent('flashlight_toggle', { isOn: this.isOn });
    }
    return this.isOn;
  }

  setEnabled(state) {
    return this.toggle(Boolean(state));
  }

  /**
   * Executes the multi-stage The Corridor suspenseful flashlight flicker & blackout sequence (`~2.65s`):
   * - Stage 1 (`0.00s..0.45s`): Rapid nervous voltage stutter -> Blackout OFF (`0.45s..0.85s`)
   * - Stage 2 (`0.85s..1.35s`): Sudden bright flash ON — invokes `callbacks.onFlashOn?.(1)`
   * - Stage 3 (`1.35s..1.85s`): Total pitch-black dropout — invokes `callbacks.onBlackout?.(1)`
   * - Stage 4 (`1.85s..2.25s`): Second desperate flicker flash ON — invokes `callbacks.onFlashOn?.(2)`
   * - Stage 5 (`2.25s..2.65s`): Final brief snap OFF and recovery ON — invokes `callbacks.onSequenceComplete?.()`
   */
  triggerSuspenseFlickerSequence(mode = 'haunted_reveal', callbacks = {}) {
    this.deterministicMode = false;
    this.isOn = true;
    this._powerFactor = 1.0;
    this._targetPowerFactor = 1.0;

    let duration = 2.65;
    if (mode === 'dying_battery') duration = 1.85;
    else if (mode === 'micro_flicker') duration = 0.75;

    this.flickerState = {
      active: true,
      mode,
      elapsed: 0.0,
      duration,
      stage: 1,
      firedFlash1: false,
      firedBlackout1: false,
      firedFlash2: false,
      firedBlackout2: false,
      callbacks: callbacks || {},
      multiplier: 1.0,
    };

    if (typeof this.onAudioEvent === 'function') {
      this.onAudioEvent('flashlight_flicker_start', { mode });
    }
  }

  /**
   * Evaluates the active suspense flicker sequence and returns the intensity multiplier `[0..1.35]`.
   */
  _evaluateFlickerMultiplier(dt) {
    const fs = this.flickerState;
    if (!fs.active) return 1.0;

    fs.elapsed += dt;
    const t = fs.elapsed;
    const cb = fs.callbacks || {};

    if (fs.mode === 'micro_flicker') {
      if (t >= fs.duration) {
        fs.active = false;
        cb.onSequenceComplete?.();
        return 1.0;
      }
      return 0.55 + 0.45 * Math.sin(t * 62.0) * Math.cos(t * 27.0);
    }

    if (fs.mode === 'dying_battery') {
      if (t >= fs.duration) {
        fs.active = false;
        cb.onSequenceComplete?.();
        return 1.0;
      }
      const wave = Math.sin(t * 48.0) + Math.cos(t * 83.0);
      return wave > 0.15 ? 0.85 : 0.06;
    }

    // Default `'haunted_reveal'` 5-stage sequence (2.65s)
    if (t < 0.45) {
      // Stage 1a: Rapid nervous voltage stutter (0.0s .. 0.45s)
      fs.stage = 1;
      const jitter = Math.sin(t * 95.0) * Math.cos(t * 43.0);
      return jitter > -0.15 ? 0.35 + 0.75 * Math.abs(jitter) : 0.04;
    } else if (t < 0.85) {
      // Stage 1b: Blackout OFF (0.45s .. 0.85s)
      return 0.0;
    } else if (t < 1.35) {
      // Stage 2: Sudden bright flash ON (0.85s .. 1.35s)
      fs.stage = 2;
      if (!fs.firedFlash1) {
        fs.firedFlash1 = true;
        cb.onFlashOn?.(1);
      }
      const pulseAge = t - 0.85;
      const surge = pulseAge < 0.08 ? 1.28 : 1.05;
      const hum = 0.92 + 0.12 * Math.sin(t * 58.0);
      return surge * hum;
    } else if (t < 1.85) {
      // Stage 3: Total pitch-black dropout (1.35s .. 1.85s)
      fs.stage = 3;
      if (!fs.firedBlackout1) {
        fs.firedBlackout1 = true;
        cb.onBlackout?.(1);
      }
      return 0.0;
    } else if (t < 2.25) {
      // Stage 4: Second desperate flicker flash ON (1.85s .. 2.25s)
      fs.stage = 4;
      if (!fs.firedFlash2) {
        fs.firedFlash2 = true;
        cb.onFlashOn?.(2);
      }
      const stutter = Math.sin(t * 78.0) > -0.35 ? 1.12 : 0.25;
      return stutter;
    } else if (t < 2.65) {
      // Stage 5: Final brief snap OFF (2.25s .. 2.42s) and recovery ON (2.42s .. 2.65s)
      fs.stage = 5;
      if (!fs.firedBlackout2) {
        fs.firedBlackout2 = true;
        cb.onBlackout?.(2);
      }
      if (t < 2.42) {
        return 0.0;
      }
      const recoverFrac = (t - 2.42) / (2.65 - 2.42);
      return 0.35 + 0.65 * Math.min(1.0, recoverFrac);
    } else {
      fs.active = false;
      fs.stage = 0;
      cb.onSequenceComplete?.();
      return 1.0;
    }
  }

  /**
   * Configures flashlight intensity, color, dust visibility, hand placement,
   * and target aim point for all 6 reference scenes (`foyer_corridor` .. `lisa_jumpscare_closeup`)
   * plus `'free_roam'`.
   * Note: `this.deterministicMode` is only enabled when `this.captureMode === true` (`?capture=1`),
   * ensuring live browser sessions ALWAYS have responsive forward beam tracking and animated dust/sway!
   */
  setPresetState(presetName = 'free_roam') {
    const key = this._resolvePresetKey(presetName);
    const preset = CAMERA_PRESETS[key] || CAMERA_PRESETS.free_roam;

    this.currentPreset = preset.id;
    this.deterministicMode = Boolean(this.captureMode && preset.id !== 'free_roam');
    this.isOn = true;
    this._powerFactor = 1.0;
    this._targetPowerFactor = 1.0;
    this.flickerState.active = false;
    this._needsImmediateAimSync = true;

    this.baseColor.setHex(preset.flashlightColor);
    this.baseIntensity = preset.flashlightIntensity;
    this.baseBounceIntensity = preset.bounceIntensity;
    this.baseNearIntensity = preset.nearIntensity;
    this.baseConeOpacity = preset.coneOpacity;
    this.baseDustOpacity = preset.dustOpacity;

    this.spotLight.color.copy(this.baseColor);
    this.spotLight.intensity = this.baseIntensity;
    this.spotLight.angle = preset.flashlightAngle;
    this.spotLight.penumbra = preset.flashlightPenumbra;
    this.spotLight.distance = preset.flashlightDistance;
    this.spotLight.decay = preset.flashlightDecay || 2.15;
    if (this.spotLight.shadow && this.spotLight.shadow.camera) {
      this.spotLight.shadow.camera.far = Math.max(4.5, (preset.flashlightDistance || 7.4) + 1.5);
      this.spotLight.shadow.camera.updateProjectionMatrix();
    }

    this.setHandPlacement(preset.handPlacement || 'hidden');

    this._presetPosition = preset.position ? preset.position.clone() : null;
    if (this.captureMode && preset.flashlightTarget) {
      this._presetAimTarget = preset.flashlightTarget.clone();
      this._smoothTargetPos.copy(this._presetAimTarget);
    } else {
      this._presetAimTarget = null;
      if (preset.target) {
        this._smoothTargetPos.copy(preset.target);
      }
    }

    // Configure dust color warmth per preset (`ref_04` has golden dust motes, `ref_02` has warm white dust)
    if (this.dustParticles && this.dustParticles.material.uniforms) {
      if (preset.id === 'lisa_corner_stalk') {
        this.dustParticles.material.uniforms.uColor.value.setHex(0xffdf94);
      } else if (preset.id === 'red_hell_fridge_loop') {
        this.dustParticles.material.uniforms.uColor.value.setHex(0xff9988);
      } else {
        this.dustParticles.material.uniforms.uColor.value.setHex(0xfff0cc);
      }
      this.dustParticles.material.uniforms.uOpacity.value = this.baseDustOpacity;
    }

    this.update(0.016, 1.85);
    return preset;
  }

  _resolvePresetKey(presetName) {
    if (typeof presetName === 'number') {
      if (presetName >= 1 && presetName <= 6) return PRESET_NAMES[presetName - 1];
      return 'free_roam';
    }
    const clean = String(presetName || 'free_roam').trim().toLowerCase();
    if (CAMERA_PRESETS[clean]) return clean;
    const matchNum = clean.match(/([1-6])/);
    if (matchNum) {
      return PRESET_NAMES[parseInt(matchNum[1], 10) - 1];
    }
    return 'free_roam';
  }

  /**
   * Per-frame update for the flashlight rig, hand model inertia, forward-locked volumetric cone,
   * dynamic bounce light, airborne dust motes, and battery voltage fluctuation.
   */
  update(dt = 0.016, elapsed = 0.0, raycastMeshes = null) {
    if (!this.camera) return;

    // Guard against duplicate per-frame calls (e.g. from both fpEngine.update and main.js)
    const isDuplicateTick =
      !this.deterministicMode &&
      this._lastUpdateElapsed >= 0 &&
      Math.abs(elapsed - this._lastUpdateElapsed) < 0.00005;
    this._lastUpdateElapsed = elapsed;
    const effectiveDt = isDuplicateTick ? 0.0 : dt;

    this.camera.updateMatrixWorld(true);
    this.camera.getWorldPosition(this._camWorldPos);
    this.camera.getWorldQuaternion(this._camWorldQuat);

    this._camForward.set(0, 0, -1).applyQuaternion(this._camWorldQuat).normalize();
    this._camRight.set(1, 0, 0).applyQuaternion(this._camWorldQuat).normalize();
    this._camUp.set(0, 1, 0).applyQuaternion(this._camWorldQuat).normalize();

    const isDetCapture = Boolean(this.captureMode && this.deterministicMode);

    // 1. Filament warm-up / cool-down curve
    if (isDetCapture) {
      this._powerFactor = this.isOn ? 1.0 : 0.0;
    } else if (effectiveDt > 0) {
      const rate = this._targetPowerFactor > this._powerFactor ? 11.0 : 14.0;
      this._powerFactor +=
        (this._targetPowerFactor - this._powerFactor) * Math.min(1.0, effectiveDt * rate);
    }

    // 2. Battery voltage micro-hum (±2% organic fluctuation) + suspense flicker sequence
    let voltageHum = 1.0;
    if (!isDetCapture) {
      voltageHum =
        1.0 +
        0.013 * Math.sin(elapsed * 17.3) +
        0.007 * Math.cos(elapsed * 31.7);
    }
    const flickerMult = this._evaluateFlickerMultiplier(effectiveDt);
    const totalMult = this._powerFactor * voltageHum * flickerMult;

    // Update screen-space beam state (`beamScreenState`) for `PTPostProcessor` circular vignette lock
    if (this.beamScreenState) {
      this.beamScreenState.power = totalMult;
      const swayScreenX = isDetCapture
        ? 0.0
        : Math.sin(elapsed * 1.65) * 0.004 + (this._hoverOffsetX || 0.0) * 0.025;
      const swayScreenY = isDetCapture
        ? 0.0
        : Math.cos(elapsed * 3.30) * 0.003 + (this._hoverOffsetY || 0.0) * 0.020;
      this.beamScreenState.centerX = 0.5 + swayScreenX;
      this.beamScreenState.centerY = 0.5 + swayScreenY;
      this.beamScreenState.radius =
        this.currentPreset === 'lisa_jumpscare_closeup' ? 0.50 : 0.54;
    }

    // 3. Position & orient the First-Person Hand & Tactical Flashlight (`handRig`) in viewport corner
    const swayX = isDetCapture ? 0.0 : Math.sin(elapsed * 1.65) * 0.0035;
    const swayY = isDetCapture ? 0.0 : Math.cos(elapsed * 3.30) * 0.0030;

    let handOffsetRight = 0.255;
    let handOffsetUp = -0.245;
    let handOffsetForward = 0.38;
    let yawInward = 0.22;
    let pitchUp = 0.14;
    let rollAngle = -0.12;

    if (this.handPlacement === 'bottom_left') {
      handOffsetRight = -0.26;
      handOffsetUp = -0.25;
      handOffsetForward = 0.38;
      yawInward = -0.20;
      pitchUp = 0.15;
      rollAngle = 0.12;

      if (this.currentPreset === 'lisa_corner_stalk') {
        yawInward = -0.22;
        pitchUp = 0.16;
      }
    } else if (this.handPlacement === 'bottom_right') {
      if (this.currentPreset === 'corner_radio_clock') {
        handOffsetRight = 0.25;
        handOffsetUp = -0.24;
        handOffsetForward = 0.38;
        yawInward = 0.26;
        pitchUp = 0.16;
      } else if (this.currentPreset === 'lisa_jumpscare_closeup') {
        handOffsetRight = 0.225;
        handOffsetUp = -0.235;
        handOffsetForward = 0.36;
        yawInward = 0.24;
        pitchUp = 0.22;
      }
    }

    this.handRig.position
      .copy(this._camWorldPos)
      .addScaledVector(this._camRight, handOffsetRight + swayX)
      .addScaledVector(this._camUp, handOffsetUp + swayY)
      .addScaledVector(this._camForward, handOffsetForward);

    this.handRig.quaternion.copy(this._camWorldQuat);
    this.handRig.rotateY(yawInward);
    this.handRig.rotateX(pitchUp);
    this.handRig.rotateZ(rollAngle);
    this.handRig.updateMatrixWorld(true);

    // Get world position of the flashlight bezel lens (`bezelAnchor` at front of torch).
    // When `handPlacement === 'hidden'` (authentic The Corridor chest/shirt-pocket flashlight),
    // place the bezel origin near the camera center so the projected circular beam is centered in the corridor.
    if (this.handPlacement !== 'hidden' && this.bezelAnchor) {
      this.bezelAnchor.getWorldPosition(this._bezelWorldPos);
    } else {
      this._bezelWorldPos
        .copy(this._camWorldPos)
        .addScaledVector(this._camRight, 0.02 + swayX * 0.5)
        .addScaledVector(this._camUp, -0.06 + swayY * 0.5)
        .addScaledVector(this._camForward, 0.06);
    }

    // 4. Compute Forward-Locked Flashlight Aim Target
    let usePresetAim = false;
    if (isDetCapture && this._presetAimTarget) {
      const toPreset = this._tempVec.subVectors(this._presetAimTarget, this._camWorldPos);
      const dist = toPreset.length();
      if (dist > 0.2) {
        toPreset.divideScalar(dist);
        const forwardDot = toPreset.dot(this._camForward);
        const movedDist = this._presetPosition
          ? this._camWorldPos.distanceTo(this._presetPosition)
          : 0.0;
        if (forwardDot > 0.55 && movedDist < 0.15) {
          usePresetAim = true;
        } else {
          this._presetAimTarget = null;
          this.deterministicMode = false;
        }
      }
    } else if (!this.captureMode) {
      this.deterministicMode = false;
      this._presetAimTarget = null;
    }

    if (usePresetAim && this._presetAimTarget) {
      this._targetWorldPos.copy(this._presetAimTarget);
      this._smoothTargetPos.copy(this._presetAimTarget);
    } else {
      this._targetWorldPos
        .copy(this._camWorldPos)
        .addScaledVector(this._camForward, 7.0);

      if (this._needsImmediateAimSync) {
        this._smoothTargetPos.copy(this._targetWorldPos);
        this._needsImmediateAimSync = false;
      } else if (effectiveDt > 0) {
        const lerpAlpha = Math.min(1.0, effectiveDt * 18.0);
        this._smoothTargetPos.lerp(this._targetWorldPos, lerpAlpha);
      }

      // Safety guard: never allow `_smoothTargetPos` to lag behind or sideways to the camera
      // (e.g. after a loop teleport or rapid turn)
      const toSmooth = this._tempVec.subVectors(this._smoothTargetPos, this._camWorldPos);
      const smoothDistSq = toSmooth.lengthSq();
      if (smoothDistSq < 0.25 || toSmooth.divideScalar(Math.sqrt(smoothDistSq)).dot(this._camForward) < 0.45) {
        this._smoothTargetPos.copy(this._targetWorldPos);
      }
    }

    this._beamDir
      .subVectors(this._smoothTargetPos, this._bezelWorldPos)
      .normalize();

    // Ensure `_beamDir` always points into the forward hemisphere of the camera
    if (this._beamDir.dot(this._camForward) < 0.25) {
      this._beamDir.copy(this._camForward);
      this._smoothTargetPos
        .copy(this._bezelWorldPos)
        .addScaledVector(this._beamDir, 6.5);
    }

    // 5. Position Primary SpotLight & SpotTarget AT the front bezel lens (never behind `handRig`!)
    if (this.currentPreset === 'lisa_jumpscare_closeup') {
      this.spotLight.position
        .copy(this._camWorldPos)
        .addScaledVector(this._camRight, 0.04)
        .addScaledVector(this._camUp, -0.10)
        .addScaledVector(this._camForward, 0.10);
    } else {
      this.spotLight.position
        .copy(this._bezelWorldPos)
        .addScaledVector(this._beamDir, 0.02);
    }

    this.spotTarget.position.copy(this._smoothTargetPos);
    this.spotTarget.updateMatrixWorld(true);

    // Apply intensity & subtle filament redness on low voltage
    this.spotLight.intensity = this.baseIntensity * totalMult;
    if (totalMult < 0.65 && totalMult > 0.01) {
      const warmShift = 1.0 - totalMult / 0.65;
      this.spotLight.color
        .copy(this.baseColor)
        .lerp(new THREE.Color(0xff9944), warmShift * 0.55);
    } else {
      this.spotLight.color.copy(this.baseColor);
    }

    // Update lens bulb glow on the handheld flashlight model
    if (this._lensGlassMat) {
      this._lensGlassMat.emissiveIntensity = 0.72 * Math.min(1.2, totalMult);
    }
    if (this.handKeyLight) {
      this.handKeyLight.intensity =
        this.handPlacement === 'hidden'
          ? 0.0
          : 0.012 * Math.max(0.25, Math.min(1.1, totalMult));
    }

    // 6. Position Close-Range Grazing Fill Light (`nearLight`) ahead along the beam
    let nearDist = 1.75;
    if (this.currentPreset === 'lisa_jumpscare_closeup') {
      nearDist = 0.55;
      this.nearLight.distance = 2.2;
    } else if (this.currentPreset === 'lisa_corner_stalk') {
      nearDist = 1.25;
      this.nearLight.distance = 2.25;
    } else {
      this.nearLight.distance = 4.3;
    }
    this.nearLight.position
      .copy(this._bezelWorldPos)
      .addScaledVector(this._beamDir, nearDist);
    this.nearLight.intensity = this.baseNearIntensity * Math.max(0.15, totalMult);

    // 7. Position Dynamic Bounce Light (`bounceLight`) ahead along the forward beam vector
    let bounceDist = 2.85;
    if (this.currentPreset === 'lisa_jumpscare_closeup') {
      bounceDist = 0.65;
      this.bounceLight.distance = 2.2;
    } else if (this.currentPreset === 'lisa_corner_stalk') {
      bounceDist = 1.65;
      this.bounceLight.distance = 1.85;
    } else {
      this.bounceLight.distance = 4.6;
      if (usePresetAim && this._presetAimTarget) {
        const aimDist = this._camWorldPos.distanceTo(this._presetAimTarget);
        bounceDist = Math.max(1.45, Math.min(3.15, aimDist - 0.35));
      } else if (Array.isArray(raycastMeshes) && raycastMeshes.length > 0) {
        this._raycaster.set(this._camWorldPos, this._camForward);
        const hits = this._raycaster.intersectObjects(raycastMeshes, true);
        if (hits.length > 0 && hits[0].distance < 4.5) {
          bounceDist = Math.max(0.85, hits[0].distance - 0.35);
        }
      }
    }
    this._bounceWorldPos
      .copy(this._bezelWorldPos)
      .addScaledVector(this._beamDir, bounceDist);
    if (isDetCapture) {
      this.bounceLight.position.copy(this._bounceWorldPos);
    } else if (effectiveDt > 0) {
      this.bounceLight.position.lerp(this._bounceWorldPos, Math.min(1.0, effectiveDt * 12.0));
    }
    this.bounceLight.intensity = this.baseBounceIntensity * totalMult;

    // 8. Position & orient Volumetric Light Cone (`volumetricCone`) from bezel along +Z toward `_smoothTargetPos`
    if (this.volumetricCone) {
      this.volumetricCone.position.copy(this._bezelWorldPos);
      this.volumetricCone.lookAt(this._smoothTargetPos);
      const coneUniforms = this.volumetricCone.material.uniforms;
      coneUniforms.uTime.value = isDetCapture ? 1.85 : elapsed;
      coneUniforms.uOpacity.value = this.baseConeOpacity * totalMult;
      coneUniforms.uColor.value.copy(this.spotLight.color);
      this.volumetricCone.visible = totalMult > 0.01 && this.baseConeOpacity > 0.005;
    }

    // 9. Update Airborne Dust Motes (`dustParticles`)
    if (this.dustParticles) {
      this.dustParticles.material.uniforms.uOpacity.value =
        this.baseDustOpacity * Math.min(1.2, totalMult);
      this.dustParticles.visible = totalMult > 0.01 && this.baseDustOpacity > 0.01;
      this._updateDustParticles(elapsed);
    }
  }
}

/**
 * `FirstPersonEngine` — Manages claustrophobic The Corridor camera controls, collision resolution,
 * organic breathing/footstep head-bob, jump-scare flinch trauma, interactable raycasting,
 * immediate mouse-hover / drag / pointer-lock look, and deterministic reference camera presets.
 */
export class FirstPersonEngine {
  constructor(camera, domElement, scene, options = {}) {
    this.camera = camera;
    this.domElement = domElement || (typeof document !== 'undefined' ? document.body : null);
    this.scene = scene;
    this.options = options || {};

    const urlParams =
      typeof window !== 'undefined' && window.location
        ? new URLSearchParams(window.location.search)
        : null;
    this.captureMode = Boolean(
      this.options.captureMode ||
        (urlParams && (urlParams.get('capture') === '1' || urlParams.get('capture') === 'true'))
    );

    // Accept either `options.flashlight` or `options.flashlightSystem`
    this.flashlight = this.options.flashlight || this.options.flashlightSystem || null;

    // Tight claustrophobic FOV (65° default, zooms smoothly to 42° when holding Z or Right Mouse Button)
    this.baseFov = this.options.baseFov || 65;
    this.zoomFov = this.options.zoomFov || 42;
    this.isZooming = false;

    if (this.camera) {
      this.camera.fov = this.baseFov;
      this.camera.near = 0.06; // Small near plane so the first-person hand & close-up Lisa never clip
      this.camera.far = 35.0;
      this.camera.updateProjectionMatrix();
    }

    // PointerLockControls instance (with internal mousemove disconnected so our YXZ Euler
    // + breathing sway + head-bob never fight PointerLockControls's direct quaternion writes)
    this.controls = new PointerLockControls(this.camera, this.domElement);
    this.controls.disconnect();
    this.controls.pointerSpeed = 0.85;
    this.controls.minPolarAngle = Math.PI * 0.14;
    this.controls.maxPolarAngle = Math.PI * 0.86;

    // Logical player position (feet / eye anchor before head-bob & breathing offset)
    this.eyeHeight = 1.62;
    this.playerPosition = new THREE.Vector3(0.05, this.eyeHeight, -1.65);
    this.velocity = new THREE.Vector3();

    // Smooth rotational inertia state (YXZ Euler order)
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.targetYaw = 0.0;
    this.targetPitch = 0.0;
    this.currentYaw = 0.0;
    this.currentPitch = 0.0;

    // Free-hover cursor aim offsets (active immediately on mouse move even before clicking to lock)
    this._hoverYaw = 0.0;
    this._hoverPitch = 0.0;
    this._targetHoverYaw = 0.0;
    this._targetHoverPitch = 0.0;
    this._cursorNormX = 0.0;
    this._cursorNormY = 0.0;
    this._hasHoverCursor = false;

    // Movement & pace constants
    this.walkSpeed = 1.95;
    this.cautiousSpeed = 1.20;
    this.sprintSpeed = 2.75;
    this.collisionRadius = 0.32;

    // Input key state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      turnLeft: false,
      turnRight: false,
      shift: false,
      zoom: false,
    };

    // Mouse-drag fallback state when pointer lock is not active
    this._isDragging = false;
    this._lastPointerX = 0;
    this._lastPointerY = 0;
    this._pointerDownPos = { x: 0, y: 0 };

    // Organic camera rig state (0.26Hz breathing sway + weighted footstep head-bob + flinch trauma)
    this.breathingFreq = 0.26;
    this.bobPhase = 0.0;
    this.bobWeight = 0.0;
    this.stepCount = 0;
    this._lastStepHalfCycle = 0;

    this.flinchState = {
      active: false,
      intensity: 0.0,
      duration: 0.45,
      elapsed: 0.0,
    };

    this.cameraLockState = {
      active: false,
      target: new THREE.Vector3(),
      duration: 0.0,
      elapsed: 0.0,
    };

    // Bathroom door state & corridor loop counter
    this.bathroomDoorOpen = true;
    this.bathroomDoorAngleDeg = 52;
    this.loopCount = 1;
    this._loopCooldown = 0.0;

    // Interactive raycaster state
    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0.1;
    this.raycaster.far = 2.8;
    this.maxInteractDistance = 2.8;
    this.hoveredInteractable = null;
    this._prevHoveredEntry = null;
    this.lastHitResult = {
      hit: false,
      interactable: null,
      distance: Infinity,
      point: null,
      id: null,
      label: null,
    };

    // Deterministic preset tracking (only true when `this.captureMode === true`)
    this.currentPreset = 'foyer_corridor';
    this.isDeterministicPreset = false;

    this._bindEvents();
    this.setCameraPreset(this.options.initialPreset || 'foyer_corridor');
  }

  get isLocked() {
    if (typeof document !== 'undefined' && this.domElement) {
      if (document.pointerLockElement === this.domElement) return true;
    }
    return Boolean(this.controls && this.controls.isLocked);
  }

  setFlashlight(flashlightSystem) {
    this.flashlight = flashlightSystem;
  }

  /**
   * Updates whether the bathroom door is open/ajar enough for the player to enter (`angle >= 25°`).
   */
  setBathroomDoorState(openOrAngle) {
    if (typeof openOrAngle === 'number') {
      this.bathroomDoorAngleDeg = openOrAngle;
      this.bathroomDoorOpen = openOrAngle >= 25;
    } else {
      this.bathroomDoorOpen = Boolean(openOrAngle);
      this.bathroomDoorAngleDeg = this.bathroomDoorOpen ? 52 : 12;
    }
  }

  _isBathroomAccessible() {
    if (typeof this.options.isBathroomOpen === 'function') {
      return Boolean(this.options.isBathroomOpen());
    }
    if (typeof this.options.getBathroomDoorAngle === 'function') {
      const ang = this.options.getBathroomDoorAngle();
      return Math.abs(ang) >= 0.42; // ~24 degrees
    }
    return this.bathroomDoorOpen;
  }

  _bindEvents() {
    if (typeof window === 'undefined') return;

    this._onPointerLockChange = () => {
      const locked = Boolean(
        typeof document !== 'undefined' &&
          this.domElement &&
          document.pointerLockElement === this.domElement
      );
      if (this.controls) {
        this.controls.isLocked = locked;
      }
      if (locked) {
        // Fold any active free-hover aim offset smoothly into targetYaw / targetPitch
        this.targetYaw += this._hoverYaw;
        this.currentYaw += this._hoverYaw;
        this.targetPitch = Math.max(
          -Math.PI * 0.38,
          Math.min(Math.PI * 0.38, this.targetPitch + this._hoverPitch)
        );
        this.currentPitch = this.targetPitch;
        this._hoverYaw = 0.0;
        this._hoverPitch = 0.0;
        this._targetHoverYaw = 0.0;
        this._targetHoverPitch = 0.0;
        this._hasHoverCursor = false;
      }
    };

    this._onKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          this._exitDeterministicOnInput();
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          this._exitDeterministicOnInput();
          break;
        case 'KeyA':
          this.keys.left = true;
          this._exitDeterministicOnInput();
          break;
        case 'KeyD':
          this.keys.right = true;
          this._exitDeterministicOnInput();
          break;
        case 'ArrowLeft':
        case 'KeyQ':
          this.keys.turnLeft = true;
          this._exitDeterministicOnInput();
          break;
        case 'ArrowRight':
          this.keys.turnRight = true;
          this._exitDeterministicOnInput();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.shift = true;
          break;
        case 'KeyZ':
          this.keys.zoom = true;
          if (!this.isZooming) {
            this.isZooming = true;
            this.options.onZoomChange?.(true);
          }
          break;
        case 'KeyF':
          if (
            this.flashlight &&
            !this.options.disableBuiltInFlashlightKey &&
            !(typeof window !== 'undefined' && window.__PT_HORROR__)
          ) {
            this.flashlight.deterministicMode = false;
            const isOn = this.flashlight.toggle();
            this.options.onFlashlightToggle?.(isOn);
            this.options.onToggleFlashlight?.(isOn);
          }
          break;
        case 'KeyE':
          this.triggerInteract();
          break;
        default:
          break;
      }
    };

    this._onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
          this.keys.left = false;
          break;
        case 'KeyD':
          this.keys.right = false;
          break;
        case 'ArrowLeft':
        case 'KeyQ':
          this.keys.turnLeft = false;
          break;
        case 'ArrowRight':
          this.keys.turnRight = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.shift = false;
          break;
        case 'KeyZ':
          this.keys.zoom = false;
          if (this.isZooming) {
            this.isZooming = false;
            this.options.onZoomChange?.(false);
          }
          break;
        default:
          break;
      }
    };

    this._onPointerDown = (e) => {
      if (e.button === 2) {
        // Right mouse button holds The Corridor R3 zoom focus
        if (!this.isZooming) {
          this.isZooming = true;
          this.options.onZoomChange?.(true);
        }
        return;
      }
      if (e.button !== 0) return;

      this._pointerDownPos.x = e.clientX;
      this._pointerDownPos.y = e.clientY;

      if (!this.isLocked) {
        this._isDragging = true;
        this._lastPointerX = e.clientX;
        this._lastPointerY = e.clientY;
      }
    };

    this._onPointerMove = (e) => {
      if (this.isLocked) {
        const mx = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
        const my = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
        if (mx === 0 && my === 0) return;

        this._exitDeterministicOnInput();
        const sensitivity = 0.0022;
        this.targetYaw -= mx * sensitivity;
        this.targetPitch = Math.max(
          -Math.PI * 0.38,
          Math.min(Math.PI * 0.38, this.targetPitch - my * sensitivity)
        );
        return;
      }

      if (this._isDragging) {
        const dx = e.clientX - this._lastPointerX;
        const dy = e.clientY - this._lastPointerY;
        this._lastPointerX = e.clientX;
        this._lastPointerY = e.clientY;

        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          this._exitDeterministicOnInput();
        }

        const sensitivity = 0.0032;
        this.targetYaw -= dx * sensitivity;
        this.targetPitch = Math.max(
          -Math.PI * 0.38,
          Math.min(Math.PI * 0.38, this.targetPitch - dy * sensitivity)
        );
        return;
      }

      // Immediate free-look cursor hover mode (works as soon as the user moves the mouse over the page!)
      if (!this.captureMode) {
        const w = Math.max(1, window.innerWidth || 1280);
        const h = Math.max(1, window.innerHeight || 720);
        const nx = Math.max(-1.0, Math.min(1.0, (e.clientX / w) * 2.0 - 1.0));
        const ny = Math.max(-1.0, Math.min(1.0, (e.clientY / h) * 2.0 - 1.0));
        this._cursorNormX = nx;
        this._cursorNormY = ny;
        this._hasHoverCursor = true;
        this._exitDeterministicOnInput();

        this._targetHoverYaw = -nx * 0.45;
        this._targetHoverPitch = -ny * 0.25;
      }
    };

    this._onPointerUp = (e) => {
      if (e.button === 2) {
        const nextZoom = Boolean(this.keys.zoom);
        if (this.isZooming !== nextZoom) {
          this.isZooming = nextZoom;
          this.options.onZoomChange?.(nextZoom);
        }
        return;
      }
      if (e.button === 0) {
        const moveDist = Math.hypot(
          e.clientX - this._pointerDownPos.x,
          e.clientY - this._pointerDownPos.y
        );
        this._isDragging = false;
        if (moveDist < 6) {
          this.triggerInteract();
          // Also request pointer lock when clicking directly on the 3D canvas in live mode
          if (!this.captureMode && !this.isLocked && this.controls && e.target === this.domElement) {
            this.controls.lock();
          }
        }
      }
    };

    this._onContextMenu = (e) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerlockchange', this._onPointerLockChange);
    }

    const targetEl = this.domElement || window;
    targetEl.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    targetEl.addEventListener('contextmenu', this._onContextMenu);
  }

  _exitDeterministicOnInput() {
    if (this.isDeterministicPreset) {
      this.isDeterministicPreset = false;
      this.currentPreset = 'free_roam';
    }
    if (this.flashlight && !this.captureMode) {
      this.flashlight.deterministicMode = false;
      this.flashlight._presetAimTarget = null;
    }
  }

  /**
   * Triggers interaction with the currently hovered interactable object (`E` key or click).
   */
  triggerInteract() {
    if (!this.lastHitResult || !this.lastHitResult.hit || !this.lastHitResult.interactable) {
      return false;
    }
    const item = this.lastHitResult.interactable;
    if (typeof item.onInteract === 'function') {
      item.onInteract(item, this.lastHitResult);
    } else if (item.userData && typeof item.userData.onInteract === 'function') {
      item.userData.onInteract(item, this.lastHitResult);
    }
    if (typeof this.options.onInteract === 'function') {
      this.options.onInteract(item, this.lastHitResult);
    }
    return true;
  }

  /**
   * Checks whether a 2D point `(x, z)` is inside any walkable corridor or bathroom zone.
   */
  _isPointInWalkableZones(x, z, pad = 0.0) {
    const b = CORRIDOR_BOUNDS;
    // Wing A: x ∈ [-0.82, +0.82], z ∈ [-13.62, -0.55]
    if (
      x >= b.wingA.minX + pad &&
      x <= b.wingA.maxX - pad &&
      z >= b.wingA.minZ + pad &&
      z <= b.wingA.maxZ - pad
    ) {
      return true;
    }
    // Wing B: x ∈ [-0.82, +9.05], z ∈ [-13.62, -12.05]
    if (
      x >= b.wingB.minX + pad &&
      x <= b.wingB.maxX - pad &&
      z >= b.wingB.minZ + pad &&
      z <= b.wingB.maxZ - pad
    ) {
      return true;
    }
    // Bathroom doorway + interior (when bathroom door is ajar)
    if (this._isBathroomAccessible()) {
      if (
        x >= b.bathroomDoorway.minX + pad &&
        x <= b.bathroomDoorway.maxX + 0.05 &&
        z >= b.bathroomDoorway.minZ + pad &&
        z <= b.bathroomDoorway.maxZ - pad
      ) {
        return true;
      }
      if (
        x >= b.bathroomInterior.minX + pad &&
        x <= b.bathroomInterior.maxX - pad &&
        z >= b.bathroomInterior.minZ + pad &&
        z <= b.bathroomInterior.maxZ - pad
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks whether `(x, z)` with player `radius` collides with any solid corridor prop AABB.
   */
  _collidesWithProps(x, z, radius = 0.24) {
    const props = CORRIDOR_BOUNDS.propColliders;
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (
        x + radius > p.minX &&
        x - radius < p.maxX &&
        z + radius > p.minZ &&
        z - radius < p.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * L-Shaped Corridor & Bathroom Collision Solver (`resolveCollision(oldPos, newPos, radius = 0.32)`):
   * - Enforces exact walkable bounds across Wing A, Wing B, and the Bathroom (when ajar).
   * - Slides smoothly along walls and prop colliders on X and Z axes independently.
   * - Detects End Loop Threshold (`x > 8.65, z ∈ [-13.6, -12.0]`) and triggers
   *   `options.onLoopThresholdReached?.()` to seamlessly loop the player back to `(0.0, 1.62, -1.2)`.
   */
  resolveCollision(oldPos, newPos, radius = 0.32) {
    const resolved = oldPos.clone();
    resolved.y = newPos.y;

    const wallPad = Math.max(0.0, (radius - 0.32) * 0.5);
    const propPad = Math.min(0.24, radius * 0.72);

    // 1. Try full (newX, newZ) move first
    if (
      this._isPointInWalkableZones(newPos.x, newPos.z, wallPad) &&
      !this._collidesWithProps(newPos.x, newPos.z, propPad)
    ) {
      resolved.x = newPos.x;
      resolved.z = newPos.z;
    } else {
      // 2. Try sliding along X axis only
      if (
        this._isPointInWalkableZones(newPos.x, oldPos.z, wallPad) &&
        !this._collidesWithProps(newPos.x, oldPos.z, propPad)
      ) {
        resolved.x = newPos.x;
      }
      // 3. Try sliding along Z axis only
      if (
        this._isPointInWalkableZones(resolved.x, newPos.z, wallPad) &&
        !this._collidesWithProps(resolved.x, newPos.z, propPad)
      ) {
        resolved.z = newPos.z;
      }
    }

    // 4. Clamp safely if oldPos started slightly outside a boundary
    if (!this._isPointInWalkableZones(resolved.x, resolved.z, 0.0)) {
      if (resolved.z < -11.95 && resolved.x > 0.82) {
        // Clamp to Wing B
        resolved.x = Math.max(-0.82, Math.min(9.05, resolved.x));
        resolved.z = Math.max(-13.62, Math.min(-12.05, resolved.z));
      } else if (this._isBathroomAccessible() && resolved.x < -0.82) {
        if (resolved.x > -1.25) {
          resolved.z = Math.max(-8.95, Math.min(-7.85, resolved.z));
        } else {
          resolved.x = Math.max(-3.90, Math.min(-1.25, resolved.x));
          resolved.z = Math.max(-9.85, Math.min(-7.10, resolved.z));
        }
      } else {
        // Clamp to Wing A
        resolved.x = Math.max(-0.82, Math.min(0.82, resolved.x));
        resolved.z = Math.max(-13.62, Math.min(-0.55, resolved.z));
      }
    }

    // 5. End Loop Threshold check: x > 8.65, z ∈ [-13.6, -12.0]
    const lt = CORRIDOR_BOUNDS.loopThreshold;
    if (
      resolved.x > lt.minX &&
      resolved.z >= lt.minZ &&
      resolved.z <= lt.maxZ &&
      this._loopCooldown <= 0.0
    ) {
      this._loopCooldown = 1.0;
      this.loopCount += 1;

      // Seamless The Corridor teleport back to foyer start (0.0, 1.62, -1.2) facing North (-Z)
      resolved.copy(CORRIDOR_BOUNDS.loopSpawnPosition);
      this.playerPosition.copy(resolved);
      this.targetYaw = 0.0;
      this.currentYaw = 0.0;
      this.targetPitch = -0.02;
      this.currentPitch = -0.02;
      this._hoverYaw = 0.0;
      this._hoverPitch = 0.0;
      this._targetHoverYaw = 0.0;
      this._targetHoverPitch = 0.0;
      this.euler.set(this.currentPitch, this.currentYaw, 0, 'YXZ');
      if (this.camera) {
        this.camera.quaternion.setFromEuler(this.euler);
      }
      if (this.flashlight) {
        this.flashlight._needsImmediateAimSync = true;
      }

      if (typeof this.options.onLoopThresholdReached === 'function') {
        this.options.onLoopThresholdReached(this.loopCount);
      }
    }

    return resolved;
  }

  /**
   * Triggers a sudden camera flinch / trauma shake (e.g. during Lisa's jump scare or loud bangs).
   */
  triggerCameraFlinch(intensity = 1.0, duration = 0.45) {
    this.isDeterministicPreset = false;
    this.flinchState.active = true;
    this.flinchState.intensity = Math.max(0.1, intensity);
    this.flinchState.duration = Math.max(0.08, duration);
    this.flinchState.elapsed = 0.0;
  }

  /**
   * Smoothly locks the camera view toward a world-space target (e.g. Lisa's screaming face during jump scare).
   */
  lockCameraToTarget(worldTargetPos, duration = 1.2) {
    if (!worldTargetPos) return;
    this.isDeterministicPreset = false;
    this.cameraLockState.active = true;
    this.cameraLockState.target.copy(worldTargetPos);
    this.cameraLockState.duration = duration;
    this.cameraLockState.elapsed = 0.0;
  }

  releaseCameraLock() {
    this.cameraLockState.active = false;
  }

  /**
   * Casts a ray from the camera center (`maxDist = 2.8m`) against the `interactables` array
   * from Agent 2 (`radio`, `alarm_clock`, `bathroom_door`, `bathroom_sink`, `gouged_portrait`,
   * `pill_bottles`, `telephone`, `photo_fragment_1..6`, `loop_door`), returning
   * `{ hit, interactable, distance, point, id, label }` for the UI reticle and `E` / Click inspection.
   */
  checkInteractables(interactables = []) {
    const emptyResult = {
      hit: false,
      interactable: null,
      distance: Infinity,
      point: null,
      id: null,
      label: null,
    };

    if (!this.camera || !Array.isArray(interactables) || interactables.length === 0) {
      if (this._prevHoveredEntry !== null) {
        this._prevHoveredEntry = null;
        this.options.onHoverInteractable?.(null, emptyResult);
      }
      this.hoveredInteractable = null;
      this.lastHitResult = emptyResult;
      return emptyResult;
    }

    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this.raycaster.far = this.maxInteractDistance;

    // Collect candidate Object3Ds and map them back to their interactable entry
    const meshToEntry = new Map();
    const candidateObjects = [];

    for (let i = 0; i < interactables.length; i++) {
      const entry = interactables[i];
      if (!entry || entry.enabled === false || entry.collected === true) continue;

      const obj = entry.isObject3D
        ? entry
        : entry.mesh || entry.object || entry.group || entry.target || null;

      if (obj && obj.isObject3D && obj.visible !== false) {
        candidateObjects.push(obj);
        obj.traverse((child) => {
          meshToEntry.set(child, entry);
        });
      }
    }

    let bestHit = null;
    let bestEntry = null;
    let bestDist = this.maxInteractDistance;

    if (candidateObjects.length > 0) {
      const intersects = this.raycaster.intersectObjects(candidateObjects, true);
      for (let i = 0; i < intersects.length; i++) {
        const hit = intersects[i];
        if (hit.distance <= this.maxInteractDistance) {
          let curr = hit.object;
          let matchedEntry = meshToEntry.get(curr);
          while (!matchedEntry && curr.parent) {
            curr = curr.parent;
            matchedEntry = meshToEntry.get(curr);
          }
          if (matchedEntry) {
            bestHit = hit;
            bestEntry = matchedEntry;
            bestDist = hit.distance;
            break;
          }
        }
      }
    }

    // Fallback angular cone + bounding sphere check so small props/fragments are easy to focus
    if (!bestEntry) {
      const camPos = this.raycaster.ray.origin;
      const camDir = this.raycaster.ray.direction;
      const tempPos = new THREE.Vector3();

      for (let i = 0; i < interactables.length; i++) {
        const entry = interactables[i];
        if (!entry || entry.enabled === false || entry.collected === true) continue;

        let hasPos = false;
        if (entry.position && entry.position.isVector3) {
          tempPos.copy(entry.position);
          hasPos = true;
        } else {
          const obj = entry.isObject3D
            ? entry
            : entry.mesh || entry.object || entry.group || null;
          if (obj && obj.isObject3D && obj.visible !== false) {
            obj.getWorldPosition(tempPos);
            hasPos = true;
          }
        }

        if (!hasPos) continue;

        const toItem = tempPos.clone().sub(camPos);
        const dist = toItem.length();
        const maxD = entry.maxDistance || this.maxInteractDistance;
        if (dist > maxD || dist < 0.12) continue;

        const dir = toItem.clone().divideScalar(dist);
        const cosAngle = camDir.dot(dir);
        const hitRadius = entry.radius || 0.36;
        const minCos = Math.cos(Math.atan2(hitRadius, dist));

        if (cosAngle >= Math.min(0.96, minCos) && dist < bestDist) {
          bestEntry = entry;
          bestDist = dist;
          bestHit = { point: tempPos.clone(), distance: dist };
        }
      }
    }

    if (bestEntry) {
      const id =
        bestEntry.id ||
        bestEntry.name ||
        (bestEntry.userData && (bestEntry.userData.id || bestEntry.userData.type)) ||
        'interactable';
      const label =
        bestEntry.label ||
        bestEntry.prompt ||
        bestEntry.title ||
        (bestEntry.userData && (bestEntry.userData.label || bestEntry.userData.prompt)) ||
        id;

      const result = {
        hit: true,
        interactable: bestEntry,
        distance: bestDist,
        point: bestHit ? bestHit.point : null,
        id,
        label,
      };
      this.hoveredInteractable = bestEntry;
      this.lastHitResult = result;
      if (bestEntry !== this._prevHoveredEntry) {
        this._prevHoveredEntry = bestEntry;
        this.options.onHoverInteractable?.(bestEntry, result);
      }
      return result;
    }

    if (this._prevHoveredEntry !== null) {
      this._prevHoveredEntry = null;
      this.options.onHoverInteractable?.(null, emptyResult);
    }
    this.hoveredInteractable = null;
    this.lastHitResult = emptyResult;
    return emptyResult;
  }

  /**
   * Sets camera position, lookAt target, FOV, and flashlight preset state
   * for all 6 reference scenes (`'foyer_corridor'`, `'corner_radio_clock'`, `'bathroom_sink_horror'`,
   * `'lisa_corner_stalk'`, `'red_hell_fridge_loop'`, `'lisa_jumpscare_closeup'`) plus `'free_roam'`.
   * Only locks `isDeterministicPreset = true` when `this.captureMode === true` (`?capture=1`),
   * so in live browser sessions the player can immediately look around and walk from any preset!
   */
  setCameraPreset(presetName = 'foyer_corridor') {
    const key = this._resolvePresetKey(presetName);
    const preset = CAMERA_PRESETS[key] || CAMERA_PRESETS.foyer_corridor;

    this.currentPreset = preset.id;
    this.isDeterministicPreset = Boolean(this.captureMode && preset.id !== 'free_roam');

    // Reset transient camera trauma, hover offsets & bob offsets
    this.flinchState.active = false;
    this.cameraLockState.active = false;
    this.bobWeight = 0.0;
    this.bobPhase = 0.0;
    this.isZooming = false;
    this._hoverYaw = 0.0;
    this._hoverPitch = 0.0;
    this._targetHoverYaw = 0.0;
    this._targetHoverPitch = 0.0;
    this._hasHoverCursor = false;

    this.playerPosition.copy(preset.position);
    this.eyeHeight = preset.position.y;

    if (this.camera) {
      this.camera.position.copy(preset.position);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(preset.target);
      this.camera.fov = preset.fov || this.baseFov;
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld(true);

      // Extract exact YXZ Euler angles so free-roam look continues seamlessly from preset pose
      this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.targetYaw = this.euler.y;
      this.targetPitch = this.euler.x;
      this.currentYaw = this.euler.y;
      this.currentPitch = this.euler.x;
    }

    if (this.flashlight && typeof this.flashlight.setPresetState === 'function') {
      this.flashlight.setPresetState(preset.id);
    }

    return preset;
  }

  _resolvePresetKey(presetName) {
    if (typeof presetName === 'number') {
      if (presetName >= 1 && presetName <= 6) return PRESET_NAMES[presetName - 1];
      return 'free_roam';
    }
    const clean = String(presetName || 'foyer_corridor').trim().toLowerCase();
    if (CAMERA_PRESETS[clean]) return clean;
    const matchNum = clean.match(/([1-6])/);
    if (matchNum) {
      return PRESET_NAMES[parseInt(matchNum[1], 10) - 1];
    }
    return 'free_roam';
  }

  /**
   * Determines the floor surface material under `(x, z)` for footstep audio synthesis.
   */
  _getSurfaceTypeAt(x, z) {
    if (x < -1.10) {
      return 'tile';
    }
    // Damp water / blood puddle zones in Wing A (`ref_01`, `ref_05`)
    if ((z >= -4.8 && z <= -2.1) || (z >= -7.0 && z <= -5.4)) {
      return 'wet_wood';
    }
    return 'wood';
  }

  /**
   * Per-frame update for `FirstPersonEngine`:
   * - Updates FOV zoom interpolation (`65° <-> 42°`)
   * - Processes WASD / Arrow movement, smooth keyboard turning, & collision resolution
   * - Applies 0.26Hz breathing sway, weighted footstep head-bob (emitting `onFootstep`),
   *   rotational mouse-look inertia (pointer lock, drag, or immediate free-hover), and flinch trauma.
   */
  update(dt = 0.016, elapsed = 0.0, interactables = null) {
    if (!this.camera) return;

    const clampedDt = Math.min(0.1, Math.max(0.0001, dt));
    if (this._loopCooldown > 0.0) {
      this._loopCooldown = Math.max(0.0, this._loopCooldown - clampedDt);
    }

    // Only lock camera when running automated screenshot capture (`?capture=1`)
    if (
      this.captureMode &&
      this.isDeterministicPreset &&
      !this.flinchState.active &&
      !this.cameraLockState.active
    ) {
      const preset = CAMERA_PRESETS[this.currentPreset];
      if (preset) {
        this.camera.position.copy(preset.position);
        this.camera.lookAt(preset.target);
        if (Math.abs(this.camera.fov - preset.fov) > 0.01) {
          this.camera.fov = preset.fov;
          this.camera.updateProjectionMatrix();
        }
        this.camera.updateMatrixWorld(true);
      }
      if (this.flashlight) {
        this.flashlight.update(clampedDt, elapsed);
      }
      if (Array.isArray(interactables)) {
        this.checkInteractables(interactables);
      }
      return;
    }

    // 1. Smooth FOV zoom transition (65° default -> 42° when holding Z or Right Mouse Button)
    const desiredFov = this.isZooming ? this.zoomFov : this.baseFov;
    if (Math.abs(this.camera.fov - desiredFov) > 0.02) {
      this.camera.fov += (desiredFov - this.camera.fov) * Math.min(1.0, clampedDt * 9.5);
      this.camera.updateProjectionMatrix();
    }

    // 2. Camera target lock override (e.g. during Lisa jump-scare lunge)
    if (this.cameraLockState.active) {
      this.cameraLockState.elapsed += clampedDt;
      const toTarget = this.cameraLockState.target.clone().sub(this.camera.position);
      const horizDist = Math.hypot(toTarget.x, toTarget.z);
      const desiredYaw = Math.atan2(-toTarget.x, -toTarget.z);
      const desiredPitch = Math.atan2(toTarget.y, Math.max(0.01, horizDist));
      this.targetYaw = desiredYaw;
      this.targetPitch = desiredPitch;
      this._targetHoverYaw = 0.0;
      this._targetHoverPitch = 0.0;
      if (
        this.cameraLockState.duration > 0 &&
        this.cameraLockState.elapsed >= this.cameraLockState.duration
      ) {
        this.cameraLockState.active = false;
      }
    } else {
      // Smooth keyboard yaw turning (`ArrowLeft` / `Q` and `ArrowRight`)
      const turnDir = (this.keys.turnLeft ? 1 : 0) - (this.keys.turnRight ? 1 : 0);
      if (turnDir !== 0) {
        this.targetYaw += turnDir * 1.75 * clampedDt;
      }

      // Gentle continuous yaw turn when hovering cursor near left/right 18% viewport edges
      if (
        !this.isLocked &&
        !this._isDragging &&
        this._hasHoverCursor &&
        Math.abs(this._cursorNormX) > 0.82 &&
        Math.abs(this._cursorNormY) < 0.72
      ) {
        const edgeStrength = (Math.abs(this._cursorNormX) - 0.82) / 0.18;
        const edgeSign = this._cursorNormX > 0 ? -1.0 : 1.0;
        this.targetYaw += edgeSign * edgeStrength * 1.15 * clampedDt;
      }
    }

    // 3. Rotational mouse-look inertia + smooth free-hover cursor tracking
    const lookLerp = Math.min(1.0, clampedDt * 18.0);
    this.currentYaw += (this.targetYaw - this.currentYaw) * lookLerp;
    this.currentPitch += (this.targetPitch - this.currentPitch) * lookLerp;

    const hoverLerp = Math.min(1.0, clampedDt * 10.0);
    this._hoverYaw += (this._targetHoverYaw - this._hoverYaw) * hoverLerp;
    this._hoverPitch += (this._targetHoverPitch - this._hoverPitch) * hoverLerp;

    const effectiveYaw = this.currentYaw + this._hoverYaw;
    const effectivePitch = Math.max(
      -Math.PI * 0.38,
      Math.min(Math.PI * 0.38, this.currentPitch + this._hoverPitch)
    );

    // 4. WASD / Arrow movement & collision resolution
    const moveZ = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 1 : 0);
    const moveX = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const isMoving = moveZ !== 0 || moveX !== 0;

    if (isMoving && !this.cameraLockState.active) {
      const speed = this.keys.shift ? this.sprintSpeed : this.walkSpeed;
      const forwardFlat = new THREE.Vector3(
        -Math.sin(effectiveYaw),
        0,
        -Math.cos(effectiveYaw)
      ).normalize();
      const rightFlat = new THREE.Vector3(
        Math.cos(effectiveYaw),
        0,
        -Math.sin(effectiveYaw)
      ).normalize();

      const moveVec = new THREE.Vector3()
        .addScaledVector(forwardFlat, moveZ)
        .addScaledVector(rightFlat, moveX);
      if (moveVec.lengthSq() > 0.0001) {
        moveVec.normalize().multiplyScalar(speed * clampedDt);
      }

      const candidatePos = this.playerPosition.clone().add(moveVec);
      const resolvedPos = this.resolveCollision(
        this.playerPosition,
        candidatePos,
        this.collisionRadius
      );
      this.playerPosition.copy(resolvedPos);

      // Advance weighted footstep head-bob phase
      const strideFreq = this.keys.shift ? 2.25 : 1.68; // steps per second
      this.bobPhase += clampedDt * strideFreq * Math.PI;
      this.bobWeight = Math.min(1.0, this.bobWeight + clampedDt * 7.5);

      // Fire footstep callback at each step trough
      const halfCycle = Math.floor((this.bobPhase + Math.PI * 0.5) / Math.PI);
      if (halfCycle > this._lastStepHalfCycle) {
        this._lastStepHalfCycle = halfCycle;
        this.stepCount += 1;
        const surface = this._getSurfaceTypeAt(
          this.playerPosition.x,
          this.playerPosition.z
        );
        if (typeof this.options.onFootstep === 'function') {
          this.options.onFootstep(surface, this.stepCount, this.keys.shift);
        }
      }
    } else {
      this.bobWeight = Math.max(0.0, this.bobWeight - clampedDt * 6.5);
    }

    // 5. Compute 0.26Hz breathing sway + weighted footstep head-bob + camera flinch trauma
    const breathOmega = elapsed * Math.PI * 2.0 * this.breathingFreq;
    const breathY = Math.sin(breathOmega) * 0.0085;
    const breathPitch = Math.cos(breathOmega) * 0.0028;
    const breathRoll = Math.sin(breathOmega * 0.5) * 0.0018;

    // Footstep head-bob: vertical bounce at 2x stride phase, lateral & roll sway at 1x stride phase
    const bobVert = -Math.abs(Math.cos(this.bobPhase)) * 0.032 * this.bobWeight;
    const bobLat = Math.sin(this.bobPhase) * 0.018 * this.bobWeight;
    const bobRoll = -Math.sin(this.bobPhase) * 0.0085 * this.bobWeight;
    const bobPitch = Math.sin(this.bobPhase * 2.0) * 0.0045 * this.bobWeight;

    // Jump-scare / impact camera flinch trauma
    let flinchPitch = 0.0;
    let flinchYaw = 0.0;
    let flinchRoll = 0.0;
    let flinchY = 0.0;
    if (this.flinchState.active) {
      this.flinchState.elapsed += clampedDt;
      const u = this.flinchState.elapsed / this.flinchState.duration;
      if (u >= 1.0) {
        this.flinchState.active = false;
      } else {
        const decay = Math.pow(1.0 - u, 2.0) * this.flinchState.intensity;
        flinchPitch = Math.sin(u * 55.0) * 0.045 * decay;
        flinchYaw = Math.cos(u * 68.0) * 0.035 * decay;
        flinchRoll = Math.sin(u * 42.0 + 0.8) * 0.065 * decay;
        flinchY = -Math.sin(u * Math.PI) * 0.04 * decay;
      }
    }

    // Apply final camera world position & quaternion
    const rightVec = new THREE.Vector3(
      Math.cos(effectiveYaw),
      0,
      -Math.sin(effectiveYaw)
    );
    this.camera.position
      .copy(this.playerPosition)
      .addScaledVector(rightVec, bobLat);
    this.camera.position.y = this.eyeHeight + breathY + bobVert + flinchY;

    this.euler.set(
      effectivePitch + breathPitch + bobPitch + flinchPitch,
      effectiveYaw + flinchYaw,
      breathRoll + bobRoll + flinchRoll,
      'YXZ'
    );
    this.camera.quaternion.setFromEuler(this.euler);
    this.camera.updateMatrixWorld(true);

    // 6. Sync attached FlashlightSystem if linked
    if (this.flashlight) {
      this.flashlight._hoverOffsetX = this._hoverOffsetX || 0.0;
      this.flashlight._hoverOffsetY = this._hoverOffsetY || 0.0;
      this.flashlight.update(clampedDt, elapsed);
    }

    // 7. Update interactable raycast if array was provided
    if (Array.isArray(interactables)) {
      this.checkInteractables(interactables);
    }
  }

  dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      window.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('pointerup', this._onPointerUp);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    }
    if (this.domElement) {
      this.domElement.removeEventListener('pointerdown', this._onPointerDown);
      this.domElement.removeEventListener('contextmenu', this._onContextMenu);
    }
    if (this.controls) {
      this.controls.dispose();
    }
  }
}
