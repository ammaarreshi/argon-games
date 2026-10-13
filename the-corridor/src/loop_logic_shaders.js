/**
 * @fileoverview Agent 5 — Level Logic, Narrative Loops, Corridor Engine Post-Processing Shaders & Diegetic UI
 * The Corridor (Argon Studio / Corridor Engine) Psychological Horror Game
 *
 * Exports:
 * - PTPostProcessor: Offscreen WebGLRenderTarget (samples: 0, DepthTexture) + Full-screen
 *   Corridor Engine Surveillance / 35mm Film Horror Post-Processing Shader (12-tap spiral SSAO,
 *   Filmic S-Curve Eye Adaptation, 28mm Radial Chromatic Aberration & Barrel Distortion,
 *   35mm Analog Film Grain, VHS Tracking Scanlines, and Loop 3 Red Hell Color Grading).
 * - CorridorLoopManager: State machine for the 5 Mutating The Corridor Corridor Loops (L1..L5) and
 *   the 6-Piece Torn Family Photograph Riddle ("204863").
 * - PTUIManager: Minimalist diegetic The Corridor viewport reticle, top-left Corridor Engine VHS telemetry,
 *   diegetic italic radio/ghost subtitles, 6-piece Torn Photograph inspection drawer,
 *   unified collapsible bottom control dock, and ?clean=1 screenshot mode.
 */

import * as THREE from '../assets/vendor/three.module.js';

// ============================================================================
// 1. CANONICAL LOOP DEFINITIONS & 6 TORN PHOTOGRAPH FRAGMENTS ("204863")
// ============================================================================

export const PHOTO_PIECES_DATA = [
  {
    id: 1,
    key: 'piece_1',
    digit: '2',
    title: 'Piece #1 (Foyer Pill Table)',
    shortLabel: 'Foyer Pill Table',
    caption: 'October 1977 — The prescription bottles were already empty.',
    hint: 'Near the amber pill bottles on the foyer console table.',
    position: new THREE.Vector3(-0.84, 0.86, -3.80),
    uvOffset: [0, 0], // Top-Left tile of 3x2 portrait grid
  },
  {
    id: 2,
    key: 'piece_2',
    digit: '0',
    title: 'Piece #2 (Corner Radio & 23:59 Clock)',
    shortLabel: 'Corner Radio & 23:59 Clock',
    caption: 'Do not trust the tap water. 2-0-4-8-6-3.',
    hint: 'Beside the 1970s AM radio and glowing 23:59 digital clock.',
    position: new THREE.Vector3(-0.55, 0.90, -13.52),
    uvOffset: [1, 0], // Top-Center tile
  },
  {
    id: 3,
    key: 'piece_3',
    digit: '4',
    title: 'Piece #3 (Bathroom Porcelain Sink)',
    shortLabel: 'Bathroom Porcelain Sink',
    caption: 'Ten months earlier, he lost his job and turned inward.',
    hint: 'Stuck to the bloodied rim of the bathroom pedestal sink.',
    position: new THREE.Vector3(-2.25, 0.92, -9.55),
    uvOffset: [2, 0], // Top-Right tile
  },
  {
    id: 4,
    key: 'piece_4',
    digit: '8',
    title: 'Piece #4 (Gouged Family Portrait)',
    shortLabel: 'Gouged Family Portrait',
    caption: 'Forgive me, Lisa. There is a monster inside my eyes.',
    hint: 'Tucked into the crooked frame of the gouged family portrait.',
    position: new THREE.Vector3(-0.52, 1.72, -13.94),
    uvOffset: [0, 1], // Bottom-Left tile
  },
  {
    id: 5,
    key: 'piece_5',
    digit: '6',
    title: 'Piece #5 (Swinging Refrigerator Chains)',
    shortLabel: 'Swinging Refrigerator Chains',
    caption: 'The locked basement door only opens after midnight.',
    hint: 'Beneath the rusted chains of the suspended refrigerator.',
    position: new THREE.Vector3(0.18, 1.35, -6.20),
    uvOffset: [1, 1], // Bottom-Center tile
  },
  {
    id: 6,
    key: 'piece_6',
    digit: '3',
    title: 'Piece #6 (Ringing Wall Telephone)',
    shortLabel: 'Ringing Wall Telephone',
    caption: "You've been chosen.",
    hint: 'Resting by the black wall telephone in Wing B.',
    position: new THREE.Vector3(5.40, 1.15, -13.55),
    uvOffset: [2, 1], // Bottom-Right tile
  },
];

export const CORRIDOR_LOOPS_CONFIG = {
  1: {
    id: 1,
    code: 'LOOP 01 / 05',
    name: 'THE AWAKENING',
    fullTitle: 'LOOP 01 / 05 — THE AWAKENING',
    clock: '23:59',
    description:
      'Rain pattering against the window, warm pendant lamp swaying, radio static crackling, bathroom door cracked 12°.',
    bathroomDoorAngleDeg: 12,
    bathroomDoorAngleRad: (12 * Math.PI) / 180,
    pendantLightIntensity: 1.0,
    pendantSwaySpeed: 0.85,
    redHellFactor: 0.0,
    fridgeVisible: false,
    fridgeSwingSpeed: 0.0,
    gougedPortraitsVisible: false,
    sinkFetusActive: false,
    bathroomLightFlicker: false,
    flashlightHauntedFlicker: false,
    lisaMode: 'hidden',
    telephoneRinging: false,
    exitDoorUnlocked: false,
    speedMultiplier: 1.0,
    entrySubtitle: {
      speaker: 'AM RADIO',
      text: '...Repeating the emergency broadcast from Argon County... A family of four found inside their suburban home...',
      duration: 5.0,
    },
  },
  2: {
    id: 2,
    code: 'LOOP 02 / 05',
    name: 'THE BATHROOM',
    fullTitle: 'LOOP 02 / 05 — THE BATHROOM',
    clock: '23:59',
    description:
      'Radio announces "Look behind you", bathroom door creaks ajar (52°) revealing the crying fetus in the bloodied sink, Lisa peeks from the North corner.',
    bathroomDoorAngleDeg: 52,
    bathroomDoorAngleRad: (52 * Math.PI) / 180,
    pendantLightIntensity: 0.88,
    pendantSwaySpeed: 1.15,
    redHellFactor: 0.0,
    fridgeVisible: false,
    fridgeSwingSpeed: 0.0,
    gougedPortraitsVisible: true,
    sinkFetusActive: true,
    bathroomLightFlicker: true,
    flashlightHauntedFlicker: false,
    lisaMode: 'corner_peek',
    telephoneRinging: false,
    exitDoorUnlocked: false,
    speedMultiplier: 1.0,
    entrySubtitle: {
      speaker: 'AM RADIO',
      text: 'Look behind you. I said... look behind you.',
      duration: 4.8,
    },
  },
  3: {
    id: 3,
    code: 'LOOP 03 / 05',
    name: 'RED HELL (204863)',
    fullTitle: 'LOOP 03 / 05 — RED HELL (204863)',
    clock: '23:59',
    description:
      'Entire corridor turns blood-crimson, bloody refrigerator swings violently on ceiling chains dripping blood, portraits have gouged eyes.',
    bathroomDoorAngleDeg: 52,
    bathroomDoorAngleRad: (52 * Math.PI) / 180,
    pendantLightIntensity: 1.25,
    pendantSwaySpeed: 2.2,
    redHellFactor: 1.0,
    fridgeVisible: true,
    fridgeSwingSpeed: 2.35,
    gougedPortraitsVisible: true,
    sinkFetusActive: true,
    bathroomLightFlicker: true,
    flashlightHauntedFlicker: false,
    lisaMode: 'corner_peek',
    telephoneRinging: false,
    exitDoorUnlocked: false,
    speedMultiplier: 1.22,
    entrySubtitle: {
      speaker: 'AM RADIO 204863',
      text: "Don't touch that dial now, we're just getting started. Two. Zero. Four. Eight. Six. Three.",
      duration: 5.5,
    },
  },
  4: {
    id: 4,
    code: 'LOOP 04 / 05',
    name: 'THE BLACKOUT STALKER',
    fullTitle: 'LOOP 04 / 05 — THE BLACKOUT STALKER',
    clock: '23:59',
    description:
      'Clock flashes 23:59, flashlight suffers haunted voltage blackouts with Lisa manifesting in the corridor on each flash.',
    bathroomDoorAngleDeg: 64,
    bathroomDoorAngleRad: (64 * Math.PI) / 180,
    pendantLightIntensity: 0.18,
    pendantSwaySpeed: 1.4,
    redHellFactor: 0.0,
    fridgeVisible: false,
    fridgeSwingSpeed: 0.0,
    gougedPortraitsVisible: true,
    sinkFetusActive: true,
    bathroomLightFlicker: true,
    flashlightHauntedFlicker: true,
    lisaMode: 'flicker_stalk',
    telephoneRinging: false,
    exitDoorUnlocked: false,
    speedMultiplier: 0.94,
    entrySubtitle: {
      speaker: 'LISA',
      text: 'Forgive me... I am right behind you...',
      duration: 4.5,
    },
  },
  5: {
    id: 5,
    code: 'LOOP 05 / 05',
    name: "YOU'VE BEEN CHOSEN",
    fullTitle: "LOOP 05 / 05 — YOU'VE BEEN CHOSEN",
    clock: '00:00',
    description:
      'Collecting the 6 torn photograph pieces causes the Wing B wall telephone to ring ("You\'ve been chosen."), unlocking the sealed exit door!',
    bathroomDoorAngleDeg: 52,
    bathroomDoorAngleRad: (52 * Math.PI) / 180,
    pendantLightIntensity: 0.92,
    pendantSwaySpeed: 0.75,
    redHellFactor: 0.0,
    fridgeVisible: false,
    fridgeSwingSpeed: 0.0,
    gougedPortraitsVisible: true,
    sinkFetusActive: true,
    bathroomLightFlicker: false,
    flashlightHauntedFlicker: false,
    lisaMode: 'hidden',
    telephoneRinging: true,
    exitDoorUnlocked: true,
    speedMultiplier: 1.0,
    entrySubtitle: {
      speaker: 'WALL TELEPHONE',
      text: "*RING... RING...* — \"You've been chosen.\" [The stairwell exit door has unlocked]",
      duration: 6.0,
    },
  },
};

export const PRESET_METADATA = {
  foyer_corridor: {
    index: 1,
    key: '1',
    name: 'foyer_corridor',
    label: 'Foyer Corridor',
    loopId: 1,
    photoCount: 2,
    flashlightOn: true,
  },
  corner_radio_clock: {
    index: 2,
    key: '2',
    name: 'corner_radio_clock',
    label: 'Radio & 23:59',
    loopId: 2,
    photoCount: 2,
    flashlightOn: true,
  },
  bathroom_sink_horror: {
    index: 3,
    key: '3',
    name: 'bathroom_sink_horror',
    label: 'Bathroom Sink',
    loopId: 2,
    photoCount: 3,
    flashlightOn: true,
  },
  lisa_corner_stalk: {
    index: 4,
    key: '4',
    name: 'lisa_corner_stalk',
    label: 'Lisa Stalk',
    loopId: 4,
    photoCount: 4,
    flashlightOn: true,
  },
  red_hell_fridge_loop: {
    index: 5,
    key: '5',
    name: 'red_hell_fridge_loop',
    label: 'Red Hell Fridge',
    loopId: 3,
    photoCount: 5,
    flashlightOn: false,
  },
  lisa_jumpscare_closeup: {
    index: 6,
    key: '6',
    name: 'lisa_jumpscare_closeup',
    label: 'Lisa Jump Scare',
    loopId: 4,
    photoCount: 5,
    flashlightOn: true,
  },
  free_roam: {
    index: 0,
    key: '0',
    name: 'free_roam',
    label: 'First-Person Roam',
    loopId: 2,
    photoCount: 2,
    flashlightOn: true,
  },
};

// ============================================================================
// 2. CORRIDOR ENGINE SURVEILLANCE / 35MM HORROR POST-PROCESSING SHADER
// ============================================================================

export const PRESET_POST_GRADING = {
  foyer_corridor: {
    exposure: 1.08,
    contrast: 1.18,
    saturation: 0.84,
    chromaticAberration: 0.0020,
    barrelDistortion: 0.030,
    ssaoIntensity: 0.46,
    filmGrain: 0.035,
    scanlineIntensity: 0.025,
    glitchIntensity: 0.0,
    vignette: 0.64,
    flashlightMaskStrength: 1.00,
    redHellFactor: 0.0,
    bathroomClinicalFactor: 0.0,
    stalkDesatFactor: 0.0,
    fearPulse: 0.0,
    tintRGB: [1.01, 0.98, 0.93],
  },
  corner_radio_clock: {
    exposure: 1.06,
    contrast: 1.16,
    saturation: 0.84,
    chromaticAberration: 0.0020,
    barrelDistortion: 0.030,
    ssaoIntensity: 0.46,
    filmGrain: 0.035,
    scanlineIntensity: 0.025,
    glitchIntensity: 0.0,
    vignette: 0.62,
    flashlightMaskStrength: 1.00,
    redHellFactor: 0.0,
    bathroomClinicalFactor: 0.0,
    stalkDesatFactor: 0.0,
    fearPulse: 0.0,
    tintRGB: [1.0, 0.98, 0.95],
  },
  bathroom_sink_horror: {
    exposure: 1.08,
    contrast: 1.16,
    saturation: 0.84,
    chromaticAberration: 0.0020,
    barrelDistortion: 0.030,
    ssaoIntensity: 0.44,
    filmGrain: 0.035,
    scanlineIntensity: 0.025,
    glitchIntensity: 0.0,
    vignette: 0.56,
    flashlightMaskStrength: 0.55,
    redHellFactor: 0.0,
    bathroomClinicalFactor: 0.72,
    stalkDesatFactor: 0.0,
    fearPulse: 0.0,
    tintRGB: [0.94, 1.02, 0.98],
  },
  lisa_corner_stalk: {
    exposure: 1.08,
    contrast: 1.18,
    saturation: 0.82,
    chromaticAberration: 0.0032,
    barrelDistortion: 0.030,
    ssaoIntensity: 0.46,
    filmGrain: 0.036,
    scanlineIntensity: 0.045,
    glitchIntensity: 0.12,
    vignette: 0.64,
    flashlightMaskStrength: 1.00,
    redHellFactor: 0.0,
    bathroomClinicalFactor: 0.0,
    stalkDesatFactor: 0.38,
    fearPulse: 0.0,
    tintRGB: [0.98, 0.99, 0.94],
  },
  red_hell_fridge_loop: {
    exposure: 1.06,
    contrast: 1.16,
    saturation: 0.98,
    chromaticAberration: 0.0030,
    barrelDistortion: 0.030,
    ssaoIntensity: 0.44,
    filmGrain: 0.035,
    scanlineIntensity: 0.025,
    glitchIntensity: 0.0,
    vignette: 0.58,
    flashlightMaskStrength: 0.55,
    redHellFactor: 0.92,
    bathroomClinicalFactor: 0.0,
    stalkDesatFactor: 0.0,
    fearPulse: 0.25,
    tintRGB: [1.06, 0.90, 0.88],
  },
  lisa_jumpscare_closeup: {
    exposure: 1.04,
    contrast: 1.16,
    saturation: 0.82,
    chromaticAberration: 0.0065,
    barrelDistortion: 0.065,
    ssaoIntensity: 0.44,
    filmGrain: 0.042,
    scanlineIntensity: 0.035,
    glitchIntensity: 0.12,
    vignette: 0.62,
    flashlightMaskStrength: 1.00,
    redHellFactor: 0.0,
    bathroomClinicalFactor: 0.0,
    stalkDesatFactor: 0.42,
    fearPulse: 0.0,
    tintRGB: [0.96, 0.99, 0.98],
  },
  free_roam: {
    exposure: 1.08,
    contrast: 1.18,
    saturation: 0.84,
    chromaticAberration: 0.0020,
    barrelDistortion: 0.030,
    ssaoIntensity: 0.46,
    filmGrain: 0.035,
    scanlineIntensity: 0.025,
    glitchIntensity: 0.0,
    vignette: 0.64,
    flashlightMaskStrength: 1.00,
    redHellFactor: 0.0,
    bathroomClinicalFactor: 0.0,
    stalkDesatFactor: 0.0,
    fearPulse: 0.0,
    tintRGB: [1.0, 0.98, 0.94],
  },
};

export const LOOP_POST_GRADING = {
  1: {
    exposure: 1.08,
    contrast: 1.18,
    saturation: 0.84,
    chromaticAberration: 0.0020,
    scanlineIntensity: 0.028,
    vignette: 0.64,
    flashlightMaskStrength: 1.00,
    redHellFactor: 0.0,
    stalkDesatFactor: 0.0,
    fearPulse: 0.0,
    tintRGB: [1.0, 0.98, 0.94],
  },
  2: {
    exposure: 1.08,
    contrast: 1.18,
    saturation: 0.84,
    chromaticAberration: 0.0020,
    scanlineIntensity: 0.028,
    vignette: 0.64,
    flashlightMaskStrength: 1.00,
    redHellFactor: 0.0,
    stalkDesatFactor: 0.0,
    fearPulse: 0.0,
    tintRGB: [1.0, 0.98, 0.94],
  },
  3: {
    exposure: 1.06,
    contrast: 1.16,
    saturation: 0.98,
    chromaticAberration: 0.0032,
    scanlineIntensity: 0.030,
    vignette: 0.58,
    flashlightMaskStrength: 0.55,
    redHellFactor: 0.92,
    stalkDesatFactor: 0.0,
    fearPulse: 0.25,
    tintRGB: [1.06, 0.90, 0.88],
  },
  4: {
    exposure: 1.08,
    contrast: 1.18,
    saturation: 0.82,
    chromaticAberration: 0.0034,
    scanlineIntensity: 0.045,
    vignette: 0.64,
    flashlightMaskStrength: 1.00,
    redHellFactor: 0.0,
    stalkDesatFactor: 0.35,
    fearPulse: 0.0,
    tintRGB: [0.97, 0.99, 0.95],
  },
  5: {
    exposure: 1.08,
    contrast: 1.18,
    saturation: 0.84,
    chromaticAberration: 0.0020,
    scanlineIntensity: 0.028,
    vignette: 0.64,
    flashlightMaskStrength: 1.00,
    redHellFactor: 0.0,
    stalkDesatFactor: 0.0,
    fearPulse: 0.0,
    tintRGB: [1.0, 0.98, 0.94],
  },
};

const FOX_ENGINE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FOX_ENGINE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;

  uniform vec2 uResolution;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform float uTime;

  // Optical & Tone uniforms
  uniform float uExposure;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uChromaticAberration;
  uniform float uBarrelDistortion;

  // SSAO / Crevice Darkening uniforms
  uniform float uSSAOIntensity;
  uniform float uSSAORadius;

  // Analog Film / VHS / Glitch uniforms
  uniform float uFilmGrain;
  uniform float uScanlineIntensity;
  uniform float uGlitchIntensity;
  uniform float uVignette;

  // Signature The Corridor Circular Flashlight Aperture Mask uniforms
  uniform vec2 uFlashlightCenter;
  uniform float uFlashlightPower;
  uniform float uFlashlightMaskStrength;

  // Horror / Loop Color Grading uniforms
  uniform float uRedHellFactor;
  uniform float uBathroomClinicalFactor;
  uniform float uStalkDesatFactor;
  uniform float uFearPulse;
  uniform vec3 uTintColor;

  varying vec2 vUv;

  // Convert hardware depth [0, 1] to linear eye-space depth in meters [near, far]
  float getLinearDepth(vec2 coord) {
    float fragCoordZ = texture2D(tDepth, clamp(coord, 0.001, 0.999)).x;
    float z_ndc = 2.0 * fragCoordZ - 1.0;
    return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - z_ndc * (uCameraFar - uCameraNear));
  }

  // Fast deterministic pseudo-random hash for 35mm grain and spiral jitter
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // 28mm full-frame lens subtle barrel distortion
  vec2 applyBarrelDistortion(vec2 uv, float k) {
    vec2 centered = uv - 0.5;
    float r2 = dot(centered, centered);
    vec2 distorted = centered * (1.0 + k * r2 + (k * 0.35) * r2 * r2);
    return distorted + 0.5;
  }

  // 12-tap Golden Angle Spiral Screen-Space Ambient Occlusion (Crevice Darkening)
  float computeSpiralSSAO(vec2 uv, float centerDepth) {
    // Skip SSAO on near-clipped first-person hand/flashlight rig (< 0.48m) or far void (> 18m)
    if (centerDepth < 0.48 || centerDepth > 18.5 || uSSAOIntensity <= 0.001) {
      return 1.0;
    }

    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    float radiusPixels = clamp(uSSAORadius / max(centerDepth * 0.45, 0.6), 2.0, 18.0);
    float goldenAngle = 2.39996323;
    float jitter = hash12(uv * uResolution) * 6.2831853;

    float occlusion = 0.0;
    float validWeights = 0.0;

    for (int i = 0; i < 12; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / 12.0) * radiusPixels;
      float theta = fi * goldenAngle + jitter;
      vec2 offset = vec2(cos(theta), sin(theta)) * r * texel;

      float sampleDepth = getLinearDepth(uv + offset);
      float diff = centerDepth - sampleDepth;

      // Range check prevents dark halos around foreground silhouettes
      float rangeCheck = smoothstep(0.42, 0.04, abs(diff));
      float isOccluder = step(0.008, diff) * smoothstep(0.008, 0.075, diff);

      occlusion += isOccluder * rangeCheck;
      validWeights += 1.0;
    }

    float normOcc = occlusion / max(validWeights, 1.0);
    return clamp(1.0 - normOcc * uSSAOIntensity * 1.45, 0.42, 1.0);
  }

  // Corridor Engine Filmic Tone Curve (preserves highlights while crushing peripheral shadows)
  vec3 foxFilmicCurve(vec3 x) {
    vec3 a = vec3(2.15);
    vec3 b = vec3(0.025);
    vec3 c = vec3(2.05);
    vec3 d = vec3(0.52);
    vec3 e = vec3(0.11);
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    // 1. Apply 28mm lens barrel distortion
    vec2 uv = applyBarrelDistortion(vUv, uBarrelDistortion);

    // 2. Horizontal VHS scanline tear displacement during glitches / jump scares
    // Masked out of central face region (abs(uv.x - 0.5) > 0.34) so Lisa's eyes/nose/teeth are never sliced
    if (uGlitchIntensity > 0.001 && abs(uv.x - 0.5) > 0.34) {
      float lineBucket = floor(uv.y * 190.0 + uTime * 27.0);
      float lineNoise = hash12(vec2(lineBucket, floor(uTime * 19.0)));
      if (lineNoise > 1.0 - uGlitchIntensity * 0.28) {
        float tearShift = (lineNoise - 0.5) * 0.028 * uGlitchIntensity;
        uv.x = clamp(uv.x + tearShift, 0.001, 0.999);
      }
    }

    vec2 safeUv = clamp(uv, 0.001, 0.999);
    vec2 radialVec = safeUv - 0.5;
    float radialDist = length(radialVec);

    // 3. Radial Optical Chromatic Aberration (stronger toward viewport corners & during scares)
    float caAmount = uChromaticAberration * (0.35 + radialDist * 1.95);
    vec2 caOffset = radialVec * caAmount;

    float rChan = texture2D(tDiffuse, clamp(safeUv + caOffset, 0.001, 0.999)).r;
    float gChan = texture2D(tDiffuse, safeUv).g;
    float bChan = texture2D(tDiffuse, clamp(safeUv - caOffset, 0.001, 0.999)).b;
    vec3 color = vec3(rChan, gChan, bChan);

    // Subtle vertical VHS RGB edge tracking artifact confined to outer 6% frame edges (matches ref_06)
    if (uGlitchIntensity > 0.05) {
      float edgeMask = smoothstep(0.44, 0.495, abs(safeUv.x - 0.5));
      float vStripe = sin(safeUv.x * 640.0 + uTime * 35.0) * 0.5 + 0.5;
      float trackNoise = hash12(vec2(floor(safeUv.x * 640.0), floor(safeUv.y * 360.0 + uTime * 14.0)));
      vec3 edgeArtifact = vec3(
        step(0.75, trackNoise) * 0.24,
        step(0.80, trackNoise * vStripe) * 0.32,
        step(0.78, 1.0 - trackNoise) * 0.26
      );
      color += edgeArtifact * edgeMask * uGlitchIntensity * 0.22;
    }

    // 4. High-Density 12-Tap Spiral SSAO (Crevice Darkening)
    float centerDepth = getLinearDepth(safeUv);
    float ao = computeSpiralSSAO(safeUv, centerDepth);
    // Preserve bright emissives (e.g., 23:59 red LED clock, pendant bulb, fluorescent tube)
    float emissiveProtect = smoothstep(0.55, 0.92, max(color.r, max(color.g, color.b)));
    color *= mix(ao, 1.0, emissiveProtect * 0.85);

    // 5. Exposure, Filmic Tone Mapping & Linear -> sRGB Gamma Conversion
    color = max(color, vec3(0.0)) * uExposure;
    color = foxFilmicCurve(color);
    // Convert linear scene radiance to sRGB
    color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));

    // High-contrast Filmic S-curve in sRGB space
    vec3 sCurve = smoothstep(0.0, 1.0, color);
    color = mix(color, sCurve, clamp((uContrast - 1.0) * 1.85, 0.0, 0.42));

    // 6. Preset & Loop Color Grading
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, uSaturation);
    color *= uTintColor;

    // Bathroom Clinical Sickly Green-Cyan Cast (Preset 3: ref_03)
    if (uBathroomClinicalFactor > 0.001) {
      vec3 clinicalShadows = vec3(0.84, 1.03, 0.96);
      vec3 clinicalHighlights = vec3(0.92, 1.06, 1.01);
      vec3 clinicalGraded = color * mix(clinicalShadows, clinicalHighlights, smoothstep(0.1, 0.75, luma));
      // Keep blood stains deep crimson
      float redDominance = clamp((color.r - max(color.g, color.b)) * 3.5, 0.0, 1.0);
      color = mix(color, mix(clinicalGraded, color * vec3(1.12, 0.88, 0.85), redDominance), uBathroomClinicalFactor);
    }

    // Stalk / Jump-Scare Cold Desaturated Necrotic Cast (Presets 4 & 6: ref_04, ref_06)
    if (uStalkDesatFactor > 0.001) {
      vec3 coldGrade = mix(vec3(luma), color, 0.76) * vec3(0.95, 0.99, 0.96);
      color = mix(color, coldGrade, uStalkDesatFactor);
    }

    // Loop 3 Red Hell Oppressive Crimson Grading (Preset 5: ref_05)
    // Preserves neutral dirty-white enamel highlights on the suspended refrigerator doors
    if (uRedHellFactor > 0.001) {
      float neutralHighlight = smoothstep(0.38, 0.82, luma) * smoothstep(0.45, 0.08, abs(color.r - color.g));
      vec3 crimsonGrade = vec3(
        pow(clamp(color.r * 1.28 + luma * 0.25, 0.0, 1.0), 0.90),
        mix(color.g * 0.24 + pow(luma, 2.0) * 0.14, color.g * 0.78, neutralHighlight * 0.75),
        mix(color.b * 0.20 + pow(luma, 2.2) * 0.12, color.b * 0.74, neutralHighlight * 0.75)
      );
      color = mix(color, crimsonGrade, uRedHellFactor);
    }

    // 7. Subtle Surveillance Scanlines & Analog 35mm Film Grain
    if (uScanlineIntensity > 0.001) {
      float scanline = sin(safeUv.y * uResolution.y * 1.35) * 0.5 + 0.5;
      color *= 1.0 - (scanline * uScanlineIntensity * (0.45 + 0.55 * (1.0 - luma)));
    }

    if (uFilmGrain > 0.001) {
      float grain = hash12(safeUv * uResolution + vec2(uTime * 61.7, uTime * 37.3)) - 0.5;
      // Film grain is most visible in lit dark-to-mid tones, zeroed in pitch-black shadows
      float grainMask = smoothstep(0.03, 0.28, luma) * (1.0 - smoothstep(0.65, 0.98, luma));
      color += grain * uFilmGrain * grainMask;
    }

    // 8. Softened 28mm Optical Vignette + Fear/Blood Pulse Vignette
    float vigDist = length((safeUv - 0.5) * vec2(1.08, 0.94));
    float vig = 1.0 - smoothstep(0.40, 0.95, vigDist) * (uVignette * 0.68);
    color *= vig;

    if (uFearPulse > 0.001) {
      float edgePulse = smoothstep(0.32, 0.78, vigDist) * uFearPulse;
      color = mix(color, vec3(0.28, 0.01, 0.01), edgePulse * 0.55);
    }

    // 9. Signature The Corridor Circular Flashlight Aperture Mask & Deep Shadow Toe Crush
    // Matches user_vibe_01.png & user_vibe_02.png: outer 30-35% drops into pure #000000 pitch black!
    vec2 aspectDelta = (uv - uFlashlightCenter) * vec2(uResolution.x / max(1.0, uResolution.y), 1.0);
    float beamRadius = length(aspectDelta);
    // Subtle organic lens-edge irregularity so the circular flashlight border feels optical
    float ang = atan(aspectDelta.y, aspectDelta.x);
    float edgeWarp = 0.012 * sin(ang * 5.0 + 1.2) + 0.008 * cos(ang * 9.0 - 0.7);
    float rWarped = beamRadius + edgeWarp;

    // Circular The Corridor flashlight aperture mask matching user_vibe_01.png & user_vibe_02.png:
    // Full clarity inside r < 0.44, optical penumbra falloff from 0.44 .. 0.76,
    // and pure pitch-black (#000000) outside r > 0.78!
    float innerCore = smoothstep(0.78, 0.40, rWarped);
    float opticalRing = smoothstep(0.79, 0.60, rWarped) * (1.0 - smoothstep(0.60, 0.46, rWarped)) * 0.14;
    float beamMask = clamp(innerCore + opticalRing, 0.0, 1.0);

    // Modulate by live flashlight power (so when flashlight flickers off, the beam collapses into darkness!)
    float activeBeam = beamMask * clamp(uFlashlightPower, 0.02, 1.25);
    float finalMask = mix(1.0, activeBeam, uFlashlightMaskStrength);
    color *= finalMask;

    // Crisp Shadow Toe Crush so unlit areas in the center of the hallway & outside the circular beam are true #000000
    color = max(vec3(0.0), color - vec3(0.008)) * 1.02;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

/**
 * PTPostProcessor
 * Renders the 3D scene into a single-sample WebGLRenderTarget with an attached
 * DepthTexture (`samples: 0` for instant software WebGL compatibility) and runs
 * the Corridor Engine Surveillance / 35mm Film Horror post-processing shader pass.
 */
export class PTPostProcessor {
  constructor(renderer, arg2 = null, arg3 = null, arg4 = {}) {
    this.renderer = renderer;
    this.scene = null;
    this.camera = null;
    this.flashlight = null;

    let options = {};
    let initWidth = 1280;
    let initHeight = 720;

    if (renderer && typeof renderer.getSize === 'function') {
      const size = new THREE.Vector2();
      renderer.getSize(size);
      const pr = typeof renderer.getPixelRatio === 'function' ? renderer.getPixelRatio() : 1;
      initWidth = Math.max(1, Math.floor(size.x * pr));
      initHeight = Math.max(1, Math.floor(size.y * pr));
    }

    if (arg2 && arg2.isScene) {
      this.scene = arg2;
      this.camera = arg3;
      options = arg4 || {};
    } else if (typeof arg2 === 'number' && typeof arg3 === 'number') {
      initWidth = arg2;
      initHeight = arg3;
      options = arg4 || {};
    } else if (arg2 && typeof arg2 === 'object') {
      options = arg2;
      if (options.scene) this.scene = options.scene;
      if (options.camera) this.camera = options.camera;
      if (options.flashlight) this.flashlight = options.flashlight;
      if (options.width) initWidth = options.width;
      if (options.height) initHeight = options.height;
    }

    if (options && options.flashlight) {
      this.flashlight = options.flashlight;
    }

    this.width = initWidth;
    this.height = initHeight;
    this.enabled = options.enabled !== false;
    this._projVec = new THREE.Vector3();

    // CRITICAL: samples: 0 so DepthTexture never stalls in software WebGL (headless Chrome)
    this.depthTexture = new THREE.DepthTexture(
      this.width,
      this.height,
      THREE.UnsignedIntType
    );
    this.depthTexture.format = THREE.DepthFormat;
    this.depthTexture.minFilter = THREE.NearestFilter;
    this.depthTexture.magFilter = THREE.NearestFilter;
    this.depthTexture.generateMipmaps = false;

    this.renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
    });
    this.renderTarget.depthTexture = this.depthTexture;

    this.uniforms = {
      tDiffuse: { value: this.renderTarget.texture },
      tDepth: { value: this.depthTexture },
      uResolution: { value: new THREE.Vector2(this.width, this.height) },
      uCameraNear: { value: this.camera?.near || 0.08 },
      uCameraFar: { value: this.camera?.far || 28.0 },
      uTime: { value: 0.0 },

      // Tone & Optical defaults (matching user_vibe_01.png & user_vibe_02.png)
      uExposure: { value: 1.04 },
      uContrast: { value: 1.16 },
      uSaturation: { value: 0.84 },
      uChromaticAberration: { value: 0.0020 },
      uBarrelDistortion: { value: 0.030 },

      // SSAO defaults
      uSSAOIntensity: { value: 0.46 },
      uSSAORadius: { value: 7.5 },

      // Film & VHS defaults
      uFilmGrain: { value: 0.035 },
      uScanlineIntensity: { value: 0.025 },
      uGlitchIntensity: { value: 0.0 },
      uVignette: { value: 0.62 },

      // Signature The Corridor Circular Flashlight Aperture Mask uniforms
      uFlashlightCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uFlashlightPower: { value: 1.0 },
      uFlashlightMaskStrength: { value: 0.96 },

      // Loop & Preset Grading defaults
      uRedHellFactor: { value: 0.0 },
      uBathroomClinicalFactor: { value: 0.0 },
      uStalkDesatFactor: { value: 0.0 },
      uFearPulse: { value: 0.0 },
      uTintColor: { value: new THREE.Color(1.0, 0.98, 0.94) },
    };

    // Target interpolation state for smooth transitions
    this.targetState = {
      exposure: 1.04,
      contrast: 1.16,
      saturation: 0.84,
      chromaticAberration: 0.0020,
      barrelDistortion: 0.030,
      ssaoIntensity: 0.46,
      filmGrain: 0.035,
      scanlineIntensity: 0.025,
      glitchIntensity: 0.0,
      vignette: 0.62,
      flashlightCenter: new THREE.Vector2(0.5, 0.5),
      flashlightPower: 1.0,
      flashlightMaskStrength: 0.96,
      redHellFactor: 0.0,
      bathroomClinicalFactor: 0.0,
      stalkDesatFactor: 0.0,
      fearPulse: 0.0,
      tintColor: new THREE.Color(1.0, 0.98, 0.94),
    };

    this.glitchPulseTimer = 0;
    this.glitchPulseDuration = 0;
    this.glitchPulsePeak = 0;

    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();
    this.quadMaterial = new THREE.ShaderMaterial({
      name: 'FoxEngineHorrorPostShader',
      uniforms: this.uniforms,
      vertexShader: FOX_ENGINE_VERTEX_SHADER,
      fragmentShader: FOX_ENGINE_FRAGMENT_SHADER,
      depthWrite: false,
      depthTest: false,
    });
    this.quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.quadMaterial);
    this.quadMesh.frustumCulled = false;
    this.quadScene.add(this.quadMesh);
  }

  /**
   * Resizes the offscreen render target and depth texture.
   */
  setSize(width, height) {
    const pr =
      this.renderer && typeof this.renderer.getPixelRatio === 'function'
        ? this.renderer.getPixelRatio()
        : 1;
    const w = Math.max(1, Math.floor(width * pr));
    const h = Math.max(1, Math.floor(height * pr));
    this.width = w;
    this.height = h;
    this.renderTarget.setSize(w, h);
    this.uniforms.uResolution.value.set(w, h);
  }

  resize(width, height) {
    this.setSize(width, height);
  }

  /**
   * Synchronizes `uFlashlightCenter` and `uFlashlightPower` with the live `FlashlightSystem`
   * sway and flicker state (or an explicit `beamScreenState` object).
   */
  syncFlashlightState(beamScreenState = null, immediate = false) {
    let source = beamScreenState;
    const fl =
      (source && source.spotLight ? source : null) ||
      this.flashlight ||
      (typeof window !== 'undefined' && window.__PT_HORROR__
        ? window.__PT_HORROR__.flashlight
        : null);

    if (!source && fl) {
      if (typeof fl.getBeamScreenState === 'function') {
        source = fl.getBeamScreenState(this.camera);
      } else if (fl.beamScreenState) {
        source = fl.beamScreenState;
      }
    }

    let centerX = 0.5;
    let centerY = 0.5;
    let power = 1.0;

    if (source && !source.spotLight) {
      if (source.center && typeof source.center.x === 'number') {
        centerX = source.center.x;
        centerY = source.center.y;
      } else if (typeof source.centerX === 'number' && typeof source.centerY === 'number') {
        centerX = source.centerX;
        centerY = source.centerY;
      } else if (typeof source.x === 'number' && typeof source.y === 'number') {
        centerX = source.x;
        centerY = source.y;
      }

      if (typeof source.power === 'number') {
        power = source.power;
      } else if (typeof source.intensityMultiplier === 'number') {
        power = source.intensityMultiplier;
      } else if (typeof source.isOn === 'boolean') {
        power = source.isOn ? 1.0 : 0.02;
      }

      if (typeof source.maskStrength === 'number') {
        this.targetState.flashlightMaskStrength = source.maskStrength;
      }
    } else if (fl) {
      if (typeof fl.currentPower === 'number') {
        power = fl.currentPower;
      } else if (fl.spotLight && typeof fl.baseIntensity === 'number' && fl.baseIntensity > 0.001) {
        power = fl.spotLight.intensity / fl.baseIntensity;
      } else if (fl.isOn === false) {
        power = 0.02;
      } else if (typeof fl._powerFactor === 'number') {
        power = fl._powerFactor;
      }

      const activeCam = this.camera || fl.camera;
      const aimWorld = fl._smoothTargetPos || (fl.spotTarget ? fl.spotTarget.position : null);
      if (activeCam && aimWorld) {
        this._projVec.copy(aimWorld).project(activeCam);
        if (Number.isFinite(this._projVec.x) && Number.isFinite(this._projVec.y)) {
          const rawUvX = 0.5 + this._projVec.x * 0.5;
          const rawUvY = 0.5 + this._projVec.y * 0.5;
          // Subtle optical coupling around screen center so the circular beam sways organically
          // with the flashlight while keeping the outer 30-35% border pure pitch black on all 4 sides
          centerX = 0.5 + (rawUvX - 0.5) * 0.32;
          centerY = 0.5 + (rawUvY - 0.5) * 0.32;
        }
      }
    }

    const clampedX = Math.max(0.44, Math.min(0.56, centerX));
    const clampedY = Math.max(0.45, Math.min(0.55, centerY));
    const clampedPower = Math.max(0.02, Math.min(1.25, power));

    this.targetState.flashlightCenter.set(clampedX, clampedY);
    this.targetState.flashlightPower = clampedPower;

    if (immediate) {
      this.uniforms.uFlashlightCenter.value.set(clampedX, clampedY);
      this.uniforms.uFlashlightPower.value = clampedPower;
    }
  }

  /**
   * Applies deterministic Corridor Engine post-processing parameters for each of the 6 reference presets.
   */
  setPresetGrading(presetName, immediate = true) {
    const raw = String(presetName || 'foyer_corridor').toLowerCase();
    const keyMap = {
      '1': 'foyer_corridor',
      '2': 'corner_radio_clock',
      '3': 'bathroom_sink_horror',
      '4': 'lisa_corner_stalk',
      '5': 'red_hell_fridge_loop',
      '6': 'lisa_jumpscare_closeup',
      '0': 'free_roam',
    };
    const presetKey = keyMap[raw] || raw;
    const cfg = PRESET_POST_GRADING[presetKey] || PRESET_POST_GRADING.foyer_corridor;

    this.targetState.exposure = cfg.exposure;
    this.targetState.contrast = cfg.contrast;
    this.targetState.saturation = cfg.saturation;
    this.targetState.chromaticAberration = cfg.chromaticAberration;
    this.targetState.barrelDistortion = cfg.barrelDistortion;
    this.targetState.ssaoIntensity = cfg.ssaoIntensity;
    this.targetState.filmGrain = cfg.filmGrain;
    this.targetState.scanlineIntensity = cfg.scanlineIntensity;
    this.targetState.glitchIntensity = cfg.glitchIntensity;
    this.targetState.vignette = cfg.vignette;
    this.targetState.flashlightMaskStrength = cfg.flashlightMaskStrength;
    this.targetState.redHellFactor = cfg.redHellFactor;
    this.targetState.bathroomClinicalFactor = cfg.bathroomClinicalFactor;
    this.targetState.stalkDesatFactor = cfg.stalkDesatFactor;
    this.targetState.fearPulse = cfg.fearPulse;
    this.targetState.tintColor.setRGB(
      cfg.tintRGB[0],
      cfg.tintRGB[1],
      cfg.tintRGB[2]
    );

    if (immediate) {
      this.syncFlashlightState(null, true);
      this._syncUniformsFromTarget();
    }
  }

  applyPreset(presetName, immediate = true) {
    this.setPresetGrading(presetName, immediate);
  }

  /**
   * Configures post-processing grading for Loop 1..5.
   */
  setLoopGrading(loopId, immediate = false) {
    const id = Number(loopId) || 1;
    const cfg = LOOP_POST_GRADING[id] || LOOP_POST_GRADING[1];

    this.targetState.exposure = cfg.exposure;
    this.targetState.contrast = cfg.contrast;
    this.targetState.saturation = cfg.saturation;
    this.targetState.chromaticAberration = cfg.chromaticAberration;
    this.targetState.scanlineIntensity = cfg.scanlineIntensity;
    this.targetState.vignette = cfg.vignette;
    this.targetState.flashlightMaskStrength = cfg.flashlightMaskStrength;
    this.targetState.redHellFactor = cfg.redHellFactor;
    this.targetState.stalkDesatFactor = cfg.stalkDesatFactor;
    this.targetState.fearPulse = cfg.fearPulse;
    this.targetState.tintColor.setRGB(
      cfg.tintRGB[0],
      cfg.tintRGB[1],
      cfg.tintRGB[2]
    );

    if (immediate) {
      this._syncUniformsFromTarget();
    }
  }

  /**
   * Triggers a transient VHS glitch + chromatic aberration spike (e.g., on flashlight blackout or jump scare).
   */
  triggerGlitchPulse(intensity = 0.85, duration = 0.55) {
    this.glitchPulsePeak = Math.max(0.1, Math.min(1.5, intensity));
    this.glitchPulseDuration = Math.max(0.05, duration);
    this.glitchPulseTimer = this.glitchPulseDuration;
  }

  triggerJumpScareFX(duration = 1.1) {
    this.triggerGlitchPulse(1.0, duration);
    this.targetState.fearPulse = 0.45;
  }

  triggerJumpScareGlitch(intensity = 1.0, duration = 1.5) {
    this.triggerGlitchPulse(intensity, duration);
    this.targetState.fearPulse = Math.max(this.targetState.fearPulse, 0.48);
  }

  _syncUniformsFromTarget() {
    const u = this.uniforms;
    const t = this.targetState;
    u.uExposure.value = t.exposure;
    u.uContrast.value = t.contrast;
    u.uSaturation.value = t.saturation;
    u.uChromaticAberration.value = t.chromaticAberration;
    u.uBarrelDistortion.value = t.barrelDistortion;
    u.uSSAOIntensity.value = t.ssaoIntensity;
    u.uFilmGrain.value = t.filmGrain;
    u.uScanlineIntensity.value = t.scanlineIntensity;
    u.uGlitchIntensity.value = t.glitchIntensity;
    u.uVignette.value = t.vignette;
    u.uFlashlightCenter.value.copy(t.flashlightCenter);
    u.uFlashlightPower.value = t.flashlightPower;
    u.uFlashlightMaskStrength.value = t.flashlightMaskStrength;
    u.uRedHellFactor.value = t.redHellFactor;
    u.uBathroomClinicalFactor.value = t.bathroomClinicalFactor;
    u.uStalkDesatFactor.value = t.stalkDesatFactor;
    u.uFearPulse.value = t.fearPulse;
    u.uTintColor.value.copy(t.tintColor);
  }

  /**
   * Updates post-processing shader uniforms each frame.
   */
  update(dt = 0.016, elapsed = 0, state = {}) {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.1);
    const lerpRate = Math.min(1.0, safeDt * 6.5);
    const fastLerpRate = Math.min(1.0, safeDt * 18.0);
    const u = this.uniforms;
    const t = this.targetState;

    u.uTime.value = elapsed;

    this.syncFlashlightState(state.beamScreenState || state.flashlightState || null, false);

    if (state.redHellFactor !== undefined) {
      t.redHellFactor = state.redHellFactor;
    }
    if (state.glitchIntensity !== undefined) {
      t.glitchIntensity = state.glitchIntensity;
    }
    if (state.fearLevel !== undefined) {
      t.fearPulse = state.fearLevel;
    }

    let pulseGlitch = 0;
    let pulseCA = 0;
    if (this.glitchPulseTimer > 0) {
      this.glitchPulseTimer = Math.max(0, this.glitchPulseTimer - safeDt);
      const norm = this.glitchPulseTimer / Math.max(0.001, this.glitchPulseDuration);
      pulseGlitch = this.glitchPulsePeak * norm;
      pulseCA = 0.0055 * this.glitchPulsePeak * norm;
    }

    u.uExposure.value += (t.exposure - u.uExposure.value) * lerpRate;
    u.uContrast.value += (t.contrast - u.uContrast.value) * lerpRate;
    u.uSaturation.value += (t.saturation - u.uSaturation.value) * lerpRate;
    u.uChromaticAberration.value +=
      (t.chromaticAberration + pulseCA - u.uChromaticAberration.value) * lerpRate;
    u.uBarrelDistortion.value += (t.barrelDistortion - u.uBarrelDistortion.value) * lerpRate;
    u.uSSAOIntensity.value += (t.ssaoIntensity - u.uSSAOIntensity.value) * lerpRate;
    u.uFilmGrain.value += (t.filmGrain - u.uFilmGrain.value) * lerpRate;
    u.uScanlineIntensity.value += (t.scanlineIntensity - u.uScanlineIntensity.value) * lerpRate;
    u.uGlitchIntensity.value = Math.max(
      t.glitchIntensity,
      pulseGlitch
    );
    u.uVignette.value += (t.vignette - u.uVignette.value) * lerpRate;
    u.uFlashlightCenter.value.lerp(t.flashlightCenter, fastLerpRate);
    u.uFlashlightPower.value += (t.flashlightPower - u.uFlashlightPower.value) * fastLerpRate;
    u.uFlashlightMaskStrength.value +=
      (t.flashlightMaskStrength - u.uFlashlightMaskStrength.value) * lerpRate;
    u.uRedHellFactor.value += (t.redHellFactor - u.uRedHellFactor.value) * lerpRate;
    u.uBathroomClinicalFactor.value +=
      (t.bathroomClinicalFactor - u.uBathroomClinicalFactor.value) * lerpRate;
    u.uStalkDesatFactor.value += (t.stalkDesatFactor - u.uStalkDesatFactor.value) * lerpRate;
    u.uFearPulse.value += (t.fearPulse - u.uFearPulse.value) * lerpRate;
    u.uTintColor.value.lerp(t.tintColor, lerpRate);
  }

  /**
   * Renders the scene through the Corridor Engine post-processing pipeline.
   * Supports both `render(scene, camera, dt, elapsed)` and `render(dt, elapsed)`.
   */
  render(arg1 = null, arg2 = null, dt = 0.016, elapsed = 0) {
    let activeScene = this.scene;
    let activeCamera = this.camera;

    if (arg1 && arg1.isScene) {
      activeScene = arg1;
      activeCamera = arg2 || this.camera;
    } else if (typeof arg1 === 'number') {
      dt = arg1;
      if (typeof arg2 === 'number') elapsed = arg2;
    }

    if (!this.renderer || !activeScene || !activeCamera) return;

    this.camera = activeCamera;
    this.uniforms.uCameraNear.value = activeCamera.near || 0.08;
    this.uniforms.uCameraFar.value = activeCamera.far || 28.0;

    if (!this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(activeScene, activeCamera);
      return;
    }

    // 1. Render 3D scene + depth into single-sample offscreen target
    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear(true, true, false);
    this.renderer.render(activeScene, activeCamera);

    // 2. Render full-screen Corridor Engine post-processing quad to canvas
    this.renderer.setRenderTarget(prevTarget || null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  dispose() {
    this.renderTarget.dispose();
    this.depthTexture.dispose();
    this.quadMaterial.dispose();
    this.quadMesh.geometry.dispose();
  }
}

// ============================================================================
// 3. CORRIDOR LOOP MANAGER (5 MUTATING The Corridor LOOPS & 6 PHOTO FRAGMENTS)
// ============================================================================

/**
 * CorridorLoopManager
 * Manages the 5 Mutating The Corridor Corridor Loops (L1..L5) and the 6-Piece Torn
 * Family Photograph Riddle ("204863").
 */
export class CorridorLoopManager {
  constructor(options = {}) {
    this.environment = options.environment || null;
    this.flashlight = options.flashlight || null;
    this.fpEngine = options.fpEngine || null;
    this.lisaController = options.lisaController || null;
    this.soundscape = options.soundscape || null;
    this.postProcessor = options.postProcessor || null;
    this.uiManager = options.uiManager || null;
    this.callbacks = options.callbacks || {};

    if (this.postProcessor && this.flashlight) {
      this.postProcessor.flashlight = this.flashlight;
    }

    this.currentLoop = options.initialLoop || 1;
    this.totalLoopsCompleted = 0;

    // Set of collected photo fragment IDs (1..6)
    this.photoPiecesCollected = new Set([1, 2]);
    this.riddleSolved = false;
    this.exitUnlocked = false;
    this.lastInspectedPiece = PHOTO_PIECES_DATA[1];
    this.loopPortalCooldown = 0;

    // Live loop state object consumed by PTCorridorEnvironment.update(dt, elapsed, loopState)
    this.loopState = this._buildLoopState(this.currentLoop);
  }

  /**
   * Attaches subsystem references after construction if needed.
   */
  bindSubsystems(refs = {}) {
    if (refs.environment) this.environment = refs.environment;
    if (refs.flashlight) this.flashlight = refs.flashlight;
    if (refs.fpEngine) this.fpEngine = refs.fpEngine;
    if (refs.lisaController) this.lisaController = refs.lisaController;
    if (refs.soundscape) this.soundscape = refs.soundscape;
    if (refs.postProcessor) this.postProcessor = refs.postProcessor;
    if (refs.uiManager) this.uiManager = refs.uiManager;
    if (refs.callbacks) Object.assign(this.callbacks, refs.callbacks);
    if (this.postProcessor && this.flashlight) {
      this.postProcessor.flashlight = this.flashlight;
    }
  }

  _buildLoopState(loopId) {
    const cfg = CORRIDOR_LOOPS_CONFIG[loopId] || CORRIDOR_LOOPS_CONFIG[1];
    return {
      loopId: cfg.id,
      loopNumber: cfg.id,
      code: cfg.code,
      name: cfg.name,
      fullTitle: cfg.fullTitle,
      clock: this.exitUnlocked || cfg.id === 5 ? '00:00' : cfg.clock,
      description: cfg.description,
      bathroomDoorAngleDeg: cfg.bathroomDoorAngleDeg,
      bathroomDoorAngleRad: cfg.bathroomDoorAngleRad,
      pendantLightIntensity: cfg.pendantLightIntensity,
      pendantSwaySpeed: cfg.pendantSwaySpeed,
      redHellFactor: cfg.redHellFactor,
      isRedHell: cfg.redHellFactor > 0.5,
      fridgeVisible: cfg.fridgeVisible,
      fridgeSwingSpeed: cfg.fridgeSwingSpeed,
      gougedPortraitsVisible: cfg.gougedPortraitsVisible,
      sinkFetusActive: cfg.sinkFetusActive,
      bathroomLightFlicker: cfg.bathroomLightFlicker,
      flashlightHauntedFlicker: cfg.flashlightHauntedFlicker,
      lisaMode: cfg.lisaMode,
      telephoneRinging: cfg.telephoneRinging || this.riddleSolved,
      exitDoorUnlocked: cfg.exitDoorUnlocked || this.exitUnlocked,
      speedMultiplier: cfg.speedMultiplier,
      photoPiecesCount: this.photoPiecesCollected?.size || 0,
      photoPiecesTotal: 6,
      riddleSolved: this.riddleSolved,
    };
  }

  getLoopConfig(loopId = this.currentLoop) {
    return CORRIDOR_LOOPS_CONFIG[loopId] || CORRIDOR_LOOPS_CONFIG[1];
  }

  getLoopState() {
    return this.loopState;
  }

  getPhotoPieces() {
    return PHOTO_PIECES_DATA.map((piece) => ({
      ...piece,
      collected: this.photoPiecesCollected.has(piece.id),
    }));
  }

  hasPhotoPiece(pieceId) {
    return this.photoPiecesCollected.has(Number(pieceId));
  }

  /**
   * Transitions to a specific The Corridor Corridor Loop (1..5).
   */
  setLoop(loopNumber, options = {}) {
    const clamped = Math.max(1, Math.min(5, Number(loopNumber) || 1));
    this.currentLoop = clamped;

    if (clamped === 5) {
      this.riddleSolved = true;
      this.exitUnlocked = true;
      for (let i = 1; i <= 6; i++) {
        this.photoPiecesCollected.add(i);
      }
    }

    this.loopState = this._buildLoopState(clamped);
    const cfg = this.getLoopConfig(clamped);

    // 1. Update Post-Processor grading
    if (this.postProcessor && !options.preservePresetGrading) {
      this.postProcessor.setLoopGrading(clamped, Boolean(options.immediate));
    }

    // 2. Notify Environment if it exposes setLoop / applyLoopState
    if (this.environment) {
      if (typeof this.environment.setLoopState === 'function') {
        this.environment.setLoopState(this.loopState);
      } else if (typeof this.environment.applyLoopMutation === 'function') {
        this.environment.applyLoopMutation(clamped, this.loopState);
      }
    }

    // 3. Notify Lisa AI controller
    if (this.lisaController && !options.skipLisaSync) {
      if (typeof this.lisaController.setLoopBehavior === 'function') {
        this.lisaController.setLoopBehavior(clamped, cfg.lisaMode);
      } else if (clamped === 2 || clamped === 3) {
        if (typeof this.lisaController.triggerCornerPeek === 'function') {
          this.lisaController.triggerCornerPeek('north_corner');
        }
      } else if (clamped === 4) {
        if (typeof this.lisaController.triggerFlickerStalk === 'function') {
          this.lisaController.triggerFlickerStalk(this.flashlight);
        }
      } else if (typeof this.lisaController.hide === 'function') {
        this.lisaController.hide();
      }
    }

    // 4. Notify Soundscape Engine
    if (this.soundscape && !options.silent) {
      if (typeof this.soundscape.setLoopMood === 'function') {
        this.soundscape.setLoopMood(clamped);
      } else if (typeof this.soundscape.setLoopState === 'function') {
        this.soundscape.setLoopState(clamped, this.loopState);
      }
      if (clamped === 2) {
        if (typeof this.soundscape.playDoorCreak === 'function') {
          this.soundscape.playDoorCreak(true);
        }
        if (typeof this.soundscape.triggerRadioBroadcast === 'function') {
          this.soundscape.triggerRadioBroadcast('radio_broadcast_01');
        } else if (typeof this.soundscape.playRadioBroadcast === 'function') {
          this.soundscape.playRadioBroadcast('look_behind_you');
        }
      } else if (clamped === 3) {
        if (typeof this.soundscape.triggerRadioBroadcast === 'function') {
          this.soundscape.triggerRadioBroadcast('radio_numbers_204863');
        } else if (typeof this.soundscape.playRadioBroadcast === 'function') {
          this.soundscape.playRadioBroadcast('numbers_204863');
        }
      } else if (clamped === 4) {
        if (typeof this.soundscape.playMidnightChime === 'function') {
          this.soundscape.playMidnightChime();
        }
        if (typeof this.soundscape.triggerGhostWhisper === 'function') {
          this.soundscape.triggerGhostWhisper();
        } else if (typeof this.soundscape.playLisaWhisper === 'function') {
          this.soundscape.playLisaWhisper();
        }
      } else if (clamped === 5) {
        if (typeof this.soundscape.playPhoneRing === 'function') {
          this.soundscape.playPhoneRing();
        }
        if (typeof this.soundscape.triggerPhoneChosen === 'function') {
          this.soundscape.triggerPhoneChosen();
        } else if (typeof this.soundscape.playPhoneChosen === 'function') {
          this.soundscape.playPhoneChosen();
        }
      }
    }

    // 5. Trigger Haunted Flicker on Loop 4 if requested
    if (
      clamped === 4 &&
      options.triggerFlicker !== false &&
      !options.silent &&
      this.flashlight &&
      typeof this.flashlight.triggerSuspenseFlickerSequence === 'function'
    ) {
      this.flashlight.triggerSuspenseFlickerSequence('haunted_reveal', {
        onFlashOn: (pulseIdx) => {
          if (this.postProcessor) this.postProcessor.triggerGlitchPulse(0.65, 0.25);
          if (this.lisaController && typeof this.lisaController.onFlashOn === 'function') {
            this.lisaController.onFlashOn(pulseIdx);
          } else if (this.lisaController && typeof this.lisaController.onFlickerPulse === 'function') {
            this.lisaController.onFlickerPulse(pulseIdx);
          }
        },
        onFlashOff: (pulseIdx) => {
          if (this.lisaController && typeof this.lisaController.onFlashOff === 'function') {
            this.lisaController.onFlashOff(pulseIdx);
          }
        },
        onSequenceComplete: () => {
          if (this.lisaController && typeof this.lisaController.onSequenceComplete === 'function') {
            this.lisaController.onSequenceComplete();
          }
        },
      });
    }

    // 6. Update UI telemetry & entry subtitle
    if (this.uiManager) {
      this.uiManager.updateTelemetry({
        loopId: clamped,
        loopTitle: cfg.fullTitle,
        clock: this.loopState.clock,
        photoCount: this.photoPiecesCollected.size,
        photoTotal: 6,
      });
      this.uiManager.renderPhotoPieces(this.getPhotoPieces(), this.lastInspectedPiece);

      if (!options.silent && cfg.entrySubtitle) {
        this.uiManager.showSubtitle(
          cfg.entrySubtitle.text,
          cfg.entrySubtitle.duration,
          cfg.entrySubtitle.speaker
        );
      }
    }

    if (typeof this.callbacks.onLoopChange === 'function') {
      this.callbacks.onLoopChange(clamped, this.loopState);
    }

    return this.loopState;
  }

  /**
   * Advances to the next corridor loop (1 -> 2 -> 3 -> 4 -> 5 -> 1).
   */
  advanceLoop(options = {}) {
    this.totalLoopsCompleted += 1;
    const nextLoop = this.currentLoop >= 5 ? 1 : this.currentLoop + 1;
    if (this.postProcessor) {
      this.postProcessor.triggerGlitchPulse(0.55, 0.35);
    }
    return this.setLoop(nextLoop, options);
  }

  /**
   * Synchronizes the loop state and post-processing shader to one of the 6 reference presets.
   */
  syncToCameraPreset(presetName, options = {}) {
    const key = String(presetName || 'foyer_corridor').toLowerCase();
    const meta = PRESET_METADATA[key] || PRESET_METADATA.foyer_corridor;

    // Ensure deterministic photo piece count for telemetry
    this.photoPiecesCollected.clear();
    for (let i = 1; i <= meta.photoCount; i++) {
      this.photoPiecesCollected.add(i);
    }

    this.setLoop(meta.loopId, {
      silent: options.silent !== false,
      preservePresetGrading: true,
      skipLisaSync: true,
      immediate: true,
    });

    if (this.postProcessor) {
      this.postProcessor.setPresetGrading(key, true);
    }

    if (this.uiManager) {
      this.uiManager.setActivePresetPill(key);
      this.uiManager.updateTelemetry({
        loopId: meta.loopId,
        loopTitle: this.getLoopConfig(meta.loopId).fullTitle,
        clock: this.loopState.clock,
        flashlightOn: meta.flashlightOn,
        photoCount: this.photoPiecesCollected.size,
        photoTotal: 6,
      });
    }
  }

  /**
   * Collects a specific Torn Photograph Fragment (1..6) and checks if all 6 are found.
   */
  collectPhotoPiece(pieceId, options = {}) {
    const id = Math.max(1, Math.min(6, Number(pieceId) || 1));
    const piece = PHOTO_PIECES_DATA.find((p) => p.id === id) || PHOTO_PIECES_DATA[0];
    this.photoPiecesCollected.add(id);
    this.lastInspectedPiece = piece;
    this.loopState.photoPiecesCount = this.photoPiecesCollected.size;

    if (this.soundscape && !options.silent && typeof this.soundscape.playClueCollect === 'function') {
      this.soundscape.playClueCollect();
    }

    if (id === 3 && this.lisaController && !options.silent && typeof this.lisaController.triggerMirrorApparition === 'function') {
      this.lisaController.triggerMirrorApparition();
    }

    if (this.uiManager) {
      this.uiManager.updateTelemetry({
        photoCount: this.photoPiecesCollected.size,
        photoTotal: 6,
      });
      this.uiManager.renderPhotoPieces(this.getPhotoPieces(), piece);

      if (!options.silent) {
        this.uiManager.flashPhotoWhisper(this.photoPiecesCollected.size, 6, 4.0);
        this.uiManager.showSubtitle(
          `${piece.title}: "${piece.caption}"`,
          4.8,
          `PHOTOGRAPH FRAGMENT ${this.photoPiecesCollected.size}/6`
        );
      }
    }

    // Hide collected 3D fragment mesh in environment if present
    if (this.environment && typeof this.environment.markClueCollected === 'function') {
      this.environment.markClueCollected(id);
    }

    // If all 6 pieces are collected, trigger the 204863 awakening!
    if (this.photoPiecesCollected.size >= 6 && !this.riddleSolved) {
      this.solveRiddle204863({ silent: options.silent });
    }

    if (typeof this.callbacks.onPhotoPieceCollected === 'function') {
      this.callbacks.onPhotoPieceCollected(piece, this.photoPiecesCollected.size);
    }

    return piece;
  }

  /**
   * Collects the next uncollected photograph fragment (1..6).
   */
  collectNextPhotoPiece(options = {}) {
    for (let i = 1; i <= 6; i++) {
      if (!this.photoPiecesCollected.has(i)) {
        return this.collectPhotoPiece(i, options);
      }
    }
    return this.solveRiddle204863(options);
  }

  /**
   * Solves the 6-Piece Torn Family Photograph Riddle ("204863") and triggers Loop 5.
   */
  solveRiddle204863(options = {}) {
    for (let i = 1; i <= 6; i++) {
      this.photoPiecesCollected.add(i);
    }
    this.riddleSolved = true;
    this.exitUnlocked = true;
    this.lastInspectedPiece = PHOTO_PIECES_DATA[5];

    if (this.postProcessor) {
      this.postProcessor.triggerGlitchPulse(0.75, 0.45);
    }

    this.setLoop(5, { silent: options.silent });

    if (this.uiManager && !options.silent) {
      this.uiManager.flashPhotoWhisper(6, 6, 5.0);
      this.uiManager.showSubtitle(
        '*RING... RING...* "You\'ve been chosen." — All 6 Torn Photograph Pieces Assembled (2-0-4-8-6-3).',
        6.0,
        'TELEPHONE // 204863'
      );
      this.uiManager.renderPhotoPieces(this.getPhotoPieces(), this.lastInspectedPiece);
    }

    if (typeof this.callbacks.onRiddleSolved === 'function') {
      this.callbacks.onRiddleSolved();
    }

    return this.loopState;
  }

  /**
   * Inspects an interactable prop or clue in the corridor.
   */
  inspectObject(interactable) {
    if (!interactable) return null;
    const id = String(interactable.id || interactable.name || '').toLowerCase();

    // Map corridor props to their associated Torn Photograph Fragment (1..6)
    if (id.includes('piece_1') || id.includes('pill') || id.includes('console') || id.includes('foyer')) {
      return this.collectPhotoPiece(1);
    }
    if (id.includes('piece_2') || id.includes('radio') || id.includes('clock')) {
      if (this.soundscape && typeof this.soundscape.playRadioBroadcast === 'function') {
        this.soundscape.playRadioBroadcast('numbers_204863');
      }
      return this.collectPhotoPiece(2);
    }
    if (id.includes('piece_3') || id.includes('sink') || id.includes('fetus') || id.includes('bathroom')) {
      return this.collectPhotoPiece(3);
    }
    if (id.includes('piece_4') || id.includes('portrait') || id.includes('tally')) {
      return this.collectPhotoPiece(4);
    }
    if (id.includes('piece_5') || id.includes('fridge') || id.includes('chain')) {
      return this.collectPhotoPiece(5);
    }
    if (id.includes('piece_6') || id.includes('phone') || id.includes('telephone') || id.includes('exit')) {
      if (this.soundscape && typeof this.soundscape.playPhoneChosen === 'function') {
        this.soundscape.playPhoneChosen();
      }
      return this.collectPhotoPiece(6);
    }

    // Generic clue inspection fallback
    if (interactable.pieceId) {
      return this.collectPhotoPiece(interactable.pieceId);
    }
    if (interactable.subtitle && this.uiManager) {
      this.uiManager.showSubtitle(
        interactable.subtitle,
        4.5,
        interactable.speaker || 'INSPECT'
      );
    }
    return this.collectNextPhotoPiece();
  }

  /**
   * Per-frame loop logic & seamless Wing B -> Wing A corridor loop portal check.
   */
  update(dt = 0.016, elapsed = 0, playerPosition = null) {
    if (this.loopPortalCooldown > 0) {
      this.loopPortalCooldown = Math.max(0, this.loopPortalCooldown - dt);
    }

    // Check if player walked through the far East Wing B stairwell portal (x > 8.15, z < -11.8)
    if (
      playerPosition &&
      this.loopPortalCooldown <= 0 &&
      playerPosition.x > 8.15 &&
      playerPosition.z < -11.75
    ) {
      this.loopPortalCooldown = 2.0;
      this.advanceLoop();
      // Seamlessly wrap player back to the Foyer start of Wing A looking North
      if (this.fpEngine && typeof this.fpEngine.teleportToLoopStart === 'function') {
        this.fpEngine.teleportToLoopStart();
      } else {
        playerPosition.set(0.05, 1.62, -1.65);
      }
    }

    return this.loopState;
  }
}

// ============================================================================
// 4. DIEGETIC The Corridor UI MANAGER (RETICLE, SUBTITLES, WHISPERS & PHOTO OVERLAY)
// ============================================================================

/**
 * PTUIManager
 * Manages the authentic, minimalist The Corridor diegetic HUD:
 * 1. Center The Corridor Focus Reticle (`#pt-reticle-container`) + contextual `[E] Inspect ...` prompt
 * 2. Atmospheric Diegetic The Corridor Subtitles (`#pt-subtitle-bar`)
 * 3. Subtle Diegetic Corner Control Whisper (`#pt-diegetic-hint`) that fades from 0.55 to 0.18 on movement
 * 4. Diegetic Torn Photograph Counter Whisper (`#pt-photo-whisper`) flashing for 4s on recovery + `[Tab]`/`[P]` drawer
 * 5. Opt-in Developer Simulator Dock & Telemetry (`?debug=1`, `?hud=1`, Backquote `` ` ``, or `setDebugHudVisible(true)`)
 */
export class PTUIManager {
  constructor(options = {}) {
    this.callbacks = options.callbacks || {};
    this.loopManager = options.loopManager || null;
    this.subtitleTimeout = null;
    this.photoWhisperTimeout = null;
    this.isHudHidden = false;
    this.isDebugHudVisible = false;
    this.isDrawerOpen = false;
    this.isAudioMuted = false;
    this.isFlashlightOn = true;
    this.isZoomed = false;
    this.hasPlayerMoved = false;
    this.currentPhotoCount = 2;
    this.currentPhotoTotal = 6;
    this.activePreset = 'foyer_corridor';

    this._ensureDOM();
    this._cacheElements();
    this._bindEvents();

    // Initialize clean-mode (?clean=1) and opt-in debug HUD mode (?debug=1 or ?hud=1)
    const params = new URLSearchParams(window.location.search);
    const initialClean =
      params.get('clean') === '1' ||
      params.get('clean') === 'true' ||
      params.get('hud') === '0';
    const initialDebugHud =
      Boolean(options.debugHud) ||
      params.get('debug') === '1' ||
      params.get('debug') === 'true' ||
      params.get('hud') === '1' ||
      params.get('hud') === 'true';

    this.setDebugHudVisible(initialDebugHud);
    this.setCleanMode(initialClean);

    // Expose global helpers for automated evaluation & developer toggle
    window.setCleanMode = (isClean) => this.setCleanMode(isClean);
    window.setDebugHudVisible = (visible) => this.setDebugHudVisible(visible);

    // Populate initial Torn Photograph pieces
    if (this.loopManager) {
      this.renderPhotoPieces(
        this.loopManager.getPhotoPieces(),
        this.loopManager.lastInspectedPiece
      );
    } else {
      const defaultPieces = PHOTO_PIECES_DATA.map((p) => ({
        ...p,
        collected: p.id <= 2,
      }));
      this.renderPhotoPieces(defaultPieces, PHOTO_PIECES_DATA[1]);
    }
  }

  /**
   * Ensures all required The Corridor diegetic UI DOM nodes exist in `document.body`.
   */
  _ensureDOM() {
    let root = document.getElementById('pt-ui-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'pt-ui-root';
      root.className = 'pt-hud-layer';
      root.innerHTML = `
        <!-- 1. Center Minimalist The Corridor Focus Reticle & Contextual Inspect Prompt -->
        <div id="pt-reticle-container" class="pt-reticle-container" aria-live="polite">
          <div id="pt-reticle-dot" class="pt-reticle-dot">
            <svg class="pt-reticle-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M1.5 12s4-7.5 10.5-7.5S22.5 12 22.5 12s-4 7.5-10.5 7.5S1.5 12 1.5 12z" />
              <circle cx="12" cy="12" r="3.2" />
            </svg>
          </div>
          <div id="pt-reticle-prompt" class="pt-reticle-prompt hidden">
            <span class="pt-prompt-key">[E]</span>
            <span id="pt-reticle-prompt-text">Inspect Radio — "204863"</span>
          </div>
        </div>

        <!-- 2. Atmospheric Diegetic The Corridor Subtitles (Bottom-Center) -->
        <div id="pt-subtitle-bar" class="pt-subtitle-bar hidden" role="status" aria-live="assertive">
          <span id="pt-subtitle-speaker" class="pt-subtitle-speaker">[AM RADIO]</span>
          <span id="pt-subtitle-text" class="pt-subtitle-text">"Look behind you. I said... look behind you."</span>
        </div>

        <!-- 3. Subtle Diegetic Corner Control Whisper (Bottom-Right) -->
        <div id="pt-diegetic-hint" class="pt-diegetic-hint" aria-hidden="true">
          WASD MOVE &nbsp;•&nbsp; MOUSE LOOK &nbsp;•&nbsp; [F] FLASHLIGHT &nbsp;•&nbsp; [E] INSPECT &nbsp;•&nbsp; [Z] ZOOM
        </div>

        <!-- 4. Diegetic Torn Photograph Counter Whisper (Top-Right) -->
        <div id="pt-photo-whisper" class="pt-photo-whisper hidden" aria-live="polite">
          <span id="pt-photo-whisper-text">FRAGMENT 2 / 6 RECOVERED [TAB]</span>
        </div>

        <!-- 5. Interactive Clue & 6-Piece Torn Photograph Inspection Drawer -->
        <aside id="pt-photo-drawer" class="pt-photo-drawer hidden" aria-label="Torn Family Photograph Inspection">
          <div class="pt-drawer-header">
            <div>
              <div class="pt-drawer-kicker">EVIDENCE FILE // 204863</div>
              <h2 class="pt-drawer-title">Torn Family Photograph (1977)</h2>
            </div>
            <button id="btn-close-drawer" type="button" class="pt-drawer-close" title="Close (Tab / P / Esc)">✕</button>
          </div>

          <div class="pt-portrait-assembly-frame">
            <div id="pt-portrait-grid" class="pt-portrait-grid"></div>
            <div class="pt-riddle-code-strip">
              <span class="pt-riddle-label">BROADCAST CIPHER:</span>
              <span id="pt-riddle-digits" class="pt-riddle-digits">2 - 0 - ? - ? - ? - ?</span>
            </div>
          </div>

          <div id="pt-active-clue-card" class="pt-active-clue-card">
            <div id="pt-active-clue-title" class="pt-active-clue-title">Piece #2 (Corner Radio & 23:59 Clock)</div>
            <p id="pt-active-clue-caption" class="pt-active-clue-caption">"Do not trust the tap water. 2-0-4-8-6-3."</p>
          </div>

          <ul id="pt-clue-list" class="pt-clue-list"></ul>

          <div class="pt-drawer-diegetic-footer">
            SEARCH THE CORRIDOR [E] TO RECOVER TORN FRAGMENTS &nbsp;•&nbsp; [TAB / P] CLOSE
          </div>

          <div class="pt-drawer-actions">
            <button id="btn-collect-clue" type="button" class="pt-drawer-btn">
              + Collect Next Fragment
            </button>
            <button id="btn-solve-riddle" type="button" class="pt-drawer-btn pt-drawer-btn-crimson">
              ☎ Solve 204863 Riddle
            </button>
          </div>
        </aside>

        <!-- 6. Developer Debug Telemetry Badge (Opt-in only) -->
        <header id="pt-telemetry-badge" class="pt-telemetry-badge hidden" aria-label="Corridor Engine Telemetry">
          <div class="pt-telemetry-header">
            <span class="pt-rec-dot" aria-hidden="true"></span>
            <span class="pt-engine-tag">ARGON STUDIO // CORRIDOR ENGINE</span>
            <span id="hud-clock-label" class="pt-clock-led">23:59</span>
          </div>
          <div id="hud-loop-label" class="pt-loop-title">LOOP 02 / 05 — THE BATHROOM</div>
          <div class="pt-telemetry-meta">
            <span id="hud-flashlight-label">FLASHLIGHT: ON [F] • ZOOM [Z]</span>
            <span class="pt-meta-sep">•</span>
            <button id="btn-open-photo-badge" type="button" class="pt-photo-badge-btn" title="Inspect Torn Family Photograph (Tab / P)">
              <span id="hud-photo-label">PHOTOGRAPH: 2 / 6</span>
              <span class="pt-badge-key">[TAB]</span>
            </button>
          </div>
        </header>

        <!-- 7. Developer Simulator Control Dock (Opt-in only) -->
        <nav id="pt-bottom-dock" class="pt-bottom-dock hidden" aria-label="Developer Scene Presets and Horror Controls">
          <div id="pt-dock-inner" class="pt-dock-inner">
            <div class="pt-dock-row pt-dock-presets">
              <span class="pt-dock-section-label">SCENES</span>
              <button type="button" class="pt-pill pt-preset-pill active" data-preset="foyer_corridor" data-key="1">
                <kbd>1</kbd> Foyer Corridor
              </button>
              <button type="button" class="pt-pill pt-preset-pill" data-preset="corner_radio_clock" data-key="2">
                <kbd>2</kbd> Radio &amp; 23:59
              </button>
              <button type="button" class="pt-pill pt-preset-pill" data-preset="bathroom_sink_horror" data-key="3">
                <kbd>3</kbd> Bathroom Sink
              </button>
              <button type="button" class="pt-pill pt-preset-pill" data-preset="lisa_corner_stalk" data-key="4">
                <kbd>4</kbd> Lisa Stalk
              </button>
              <button type="button" class="pt-pill pt-preset-pill" data-preset="red_hell_fridge_loop" data-key="5">
                <kbd>5</kbd> Red Hell Fridge
              </button>
              <button type="button" class="pt-pill pt-preset-pill" data-preset="lisa_jumpscare_closeup" data-key="6">
                <kbd>6</kbd> Lisa Jump Scare
              </button>
              <button type="button" class="pt-pill pt-preset-pill" data-preset="free_roam" data-key="0">
                <kbd>0</kbd> First-Person Roam
              </button>
            </div>

            <div class="pt-dock-row pt-dock-actions">
              <span class="pt-dock-section-label">LOOPS</span>
              <div class="pt-loop-pill-group">
                <button type="button" class="pt-pill pt-loop-pill" data-loop="1" title="Loop 1 — The Awakening">L1</button>
                <button type="button" class="pt-pill pt-loop-pill active" data-loop="2" title="Loop 2 — The Broadcast & The Bathroom">L2</button>
                <button type="button" class="pt-pill pt-loop-pill" data-loop="3" title="Loop 3 — Red Hell (204863)">L3</button>
                <button type="button" class="pt-pill pt-loop-pill" data-loop="4" title="Loop 4 — The Blackout Stalker">L4</button>
                <button type="button" class="pt-pill pt-loop-pill" data-loop="5" title="Loop 5 — You've Been Chosen">L5</button>
              </div>

              <span class="pt-dock-divider" aria-hidden="true"></span>

              <button id="btn-action-flashlight" type="button" class="pt-pill pt-action-pill active" data-action="flashlight">
                🔦 Flashlight <kbd>F</kbd>
              </button>
              <button id="btn-action-flicker" type="button" class="pt-pill pt-action-pill" data-action="flicker">
                ⚡ Flicker Scare <kbd>X</kbd>
              </button>
              <button id="btn-action-jumpscare" type="button" class="pt-pill pt-action-pill pt-pill-danger" data-action="jumpscare">
                💀 Jump Scare <kbd>J</kbd>
              </button>
              <button id="btn-action-radio" type="button" class="pt-pill pt-action-pill" data-action="radio">
                📻 Radio 204863 <kbd>R</kbd>
              </button>
              <button id="btn-action-clues" type="button" class="pt-pill pt-action-pill" data-action="clues">
                🧩 Photo <kbd>Tab</kbd>
              </button>
              <button id="btn-action-audio" type="button" class="pt-pill pt-action-pill" data-action="audio">
                🔊 Audio <kbd>M</kbd>
              </button>
              <button id="btn-action-hud" type="button" class="pt-pill pt-action-pill" data-action="hide_hud">
                ▾ Hide Debug <kbd>\`</kbd>
              </button>
            </div>
          </div>
          <button id="pt-dock-restore-tab" type="button" class="pt-dock-restore-tab hidden">
            ▴ Show Debug Controls <kbd>\`</kbd>
          </button>
        </nav>
      `;
      document.body.appendChild(root);
      return;
    }

    // Ensure diegetic whisper nodes exist even if #pt-ui-root came from static HTML
    if (!document.getElementById('pt-diegetic-hint')) {
      const hint = document.createElement('div');
      hint.id = 'pt-diegetic-hint';
      hint.className = 'pt-diegetic-hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.innerHTML =
        'WASD MOVE &nbsp;•&nbsp; MOUSE LOOK &nbsp;•&nbsp; [F] FLASHLIGHT &nbsp;•&nbsp; [E] INSPECT &nbsp;•&nbsp; [Z] ZOOM';
      root.appendChild(hint);
    }
    if (!document.getElementById('pt-photo-whisper')) {
      const whisper = document.createElement('div');
      whisper.id = 'pt-photo-whisper';
      whisper.className = 'pt-photo-whisper hidden';
      whisper.setAttribute('aria-live', 'polite');
      whisper.innerHTML = '<span id="pt-photo-whisper-text">FRAGMENT 2 / 6 RECOVERED [TAB]</span>';
      root.appendChild(whisper);
    }
  }

  _cacheElements() {
    this.rootEl = document.getElementById('pt-ui-root');
    this.telemetryEl = document.getElementById('pt-telemetry-badge');
    this.loopLabelEl = document.getElementById('hud-loop-label');
    this.clockLabelEl = document.getElementById('hud-clock-label');
    this.flashlightLabelEl = document.getElementById('hud-flashlight-label');
    this.photoLabelEl = document.getElementById('hud-photo-label');
    this.openPhotoBadgeBtn = document.getElementById('btn-open-photo-badge');

    this.reticleContainerEl = document.getElementById('pt-reticle-container');
    this.reticleDotEl = document.getElementById('pt-reticle-dot');
    this.reticlePromptEl = document.getElementById('pt-reticle-prompt');
    this.reticlePromptTextEl = document.getElementById('pt-reticle-prompt-text');

    this.subtitleBarEl = document.getElementById('pt-subtitle-bar');
    this.subtitleSpeakerEl = document.getElementById('pt-subtitle-speaker');
    this.subtitleTextEl = document.getElementById('pt-subtitle-text');

    this.diegeticHintEl = document.getElementById('pt-diegetic-hint');
    this.photoWhisperEl = document.getElementById('pt-photo-whisper');
    this.photoWhisperTextEl = document.getElementById('pt-photo-whisper-text');

    this.photoDrawerEl = document.getElementById('pt-photo-drawer');
    this.portraitGridEl = document.getElementById('pt-portrait-grid');
    this.riddleDigitsEl = document.getElementById('pt-riddle-digits');
    this.activeClueTitleEl = document.getElementById('pt-active-clue-title');
    this.activeClueCaptionEl = document.getElementById('pt-active-clue-caption');
    this.clueListEl = document.getElementById('pt-clue-list');
    this.closeDrawerBtn = document.getElementById('btn-close-drawer');
    this.collectClueBtn = document.getElementById('btn-collect-clue');
    this.solveRiddleBtn = document.getElementById('btn-solve-riddle');

    this.bottomDockEl = document.getElementById('pt-bottom-dock');
    this.dockInnerEl = document.getElementById('pt-dock-inner');
    this.dockRestoreTabEl = document.getElementById('pt-dock-restore-tab');

    this.presetPills = Array.from(document.querySelectorAll('.pt-preset-pill'));
    this.loopPills = Array.from(document.querySelectorAll('.pt-loop-pill'));
    this.actionPills = Array.from(document.querySelectorAll('.pt-action-pill'));
  }

  _bindEvents() {
    // 1. Preset Scene Pills (1..6, 0)
    this.presetPills.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const preset = btn.getAttribute('data-preset');
        this.triggerPreset(preset);
      });
    });

    // 2. Loop Selector Pills (L1..L5)
    this.loopPills.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const loopNum = Number(btn.getAttribute('data-loop')) || 1;
        this.triggerLoopSelect(loopNum);
      });
    });

    // 3. Action Trigger Pills
    this.actionPills.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        this.triggerAction(action);
      });
    });

    // 4. Torn Photograph Drawer controls
    if (this.openPhotoBadgeBtn) {
      this.openPhotoBadgeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePhotoDrawer();
      });
    }
    if (this.closeDrawerBtn) {
      this.closeDrawerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePhotoDrawer(false);
      });
    }
    if (this.collectClueBtn) {
      this.collectClueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.loopManager) {
          this.loopManager.collectNextPhotoPiece();
        } else if (typeof this.callbacks.onCollectClue === 'function') {
          this.callbacks.onCollectClue();
        }
      });
    }
    if (this.solveRiddleBtn) {
      this.solveRiddleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.loopManager) {
          this.loopManager.solveRiddle204863();
        } else if (typeof this.callbacks.onSolveRiddle === 'function') {
          this.callbacks.onSolveRiddle();
        }
      });
    }
    if (this.dockRestoreTabEl) {
      this.dockRestoreTabEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setDebugHudVisible(true);
        this.toggleHudVisibility(false);
      });
    }

    // 5. Global Diegetic & Developer Keyboard Shortcuts
    // - Backquote (`): Toggle opt-in Developer Simulator Dock & Telemetry Badge
    // - Tab: Open/Close Torn Photograph Inspection Overlay
    // - Escape: Close Torn Photograph Inspection Overlay if open
    // - WASD / Arrow Keys: Fade bottom-right corner control whisper from 0.55 down to 0.18
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Backquote' || e.key === '`') {
        e.preventDefault();
        this.setDebugHudVisible(!this.isDebugHudVisible);
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        this.togglePhotoDrawer();
        return;
      }

      if (e.key === 'Escape' && this.isDrawerOpen) {
        this.togglePhotoDrawer(false);
        return;
      }

      const lower = e.key.toLowerCase();
      if (
        lower === 'w' ||
        lower === 'a' ||
        lower === 's' ||
        lower === 'd' ||
        lower === 'arrowup' ||
        lower === 'arrowdown' ||
        lower === 'arrowleft' ||
        lower === 'arrowright'
      ) {
        this.setPlayerMoving(true);
      }
    });
  }

  /**
   * Fades the bottom-right diegetic control whisper (`#pt-diegetic-hint`) down to 0.18 opacity
   * once the player begins moving through the corridor.
   */
  setPlayerMoving(hasMoved = true) {
    this.hasPlayerMoved = Boolean(hasMoved);
    if (this.diegeticHintEl) {
      this.diegeticHintEl.classList.toggle('is-moving-faded', this.hasPlayerMoved);
    }
  }

  /**
   * Explicitly shows or hides the opt-in Developer Simulator Dock (`#pt-bottom-dock`)
   * and Telemetry Badge (`#pt-telemetry-badge`).
   * Hidden by default in normal gameplay unless `?debug=1`, `?hud=1`, Backquote (`` ` ``),
   * or `uiManager.setDebugHudVisible(true)` is used.
   */
  setDebugHudVisible(visible) {
    const show = Boolean(visible);
    this.isDebugHudVisible = show;

    if (document.documentElement) {
      document.documentElement.classList.toggle('debug-hud-visible', show);
    }
    if (document.body) {
      document.body.classList.toggle('debug-hud-visible', show);
    }
    if (this.telemetryEl) {
      this.telemetryEl.classList.toggle('hidden', !show);
      if (show) {
        this.telemetryEl.classList.remove('hud-minimized');
      }
    }
    if (this.bottomDockEl) {
      this.bottomDockEl.classList.toggle('hidden', !show);
    }
    if (this.dockInnerEl) {
      this.dockInnerEl.classList.toggle('hidden', !show);
    }
    if (this.dockRestoreTabEl) {
      this.dockRestoreTabEl.classList.add('hidden');
    }
    this.isHudHidden = !show;
    return show;
  }

  /**
   * Briefly flashes the subtle top-right diegetic Torn Photograph counter whisper
   * (`FRAGMENT 2 / 6 RECOVERED [TAB]`) for `durationSec` seconds (default 4.0s).
   */
  flashPhotoWhisper(
    count = this.currentPhotoCount,
    total = this.currentPhotoTotal,
    durationSec = 4.0
  ) {
    if (!this.photoWhisperEl) return;

    if (this.photoWhisperTimeout) {
      clearTimeout(this.photoWhisperTimeout);
      this.photoWhisperTimeout = null;
    }

    const safeCount = Math.max(0, Math.min(total, Number(count) ?? this.currentPhotoCount));
    this.currentPhotoCount = safeCount;
    this.currentPhotoTotal = total;

    const text =
      safeCount >= total
        ? `FRAGMENT ${safeCount} / ${total} ASSEMBLED — 204863 [TAB]`
        : `FRAGMENT ${safeCount} / ${total} RECOVERED [TAB]`;

    if (this.photoWhisperTextEl) {
      this.photoWhisperTextEl.textContent = text;
    } else {
      this.photoWhisperEl.textContent = text;
    }

    this.photoWhisperEl.classList.remove('hidden');

    if (durationSec > 0) {
      this.photoWhisperTimeout = setTimeout(() => {
        if (this.photoWhisperEl) {
          this.photoWhisperEl.classList.add('hidden');
        }
      }, durationSec * 1000);
    }
  }

  /**
   * Triggers a scene preset (`foyer_corridor` .. `lisa_jumpscare_closeup` or `free_roam`).
   */
  triggerPreset(presetName) {
    if (!presetName) return;
    this.setActivePresetPill(presetName);
    if (typeof this.callbacks.onSelectPreset === 'function') {
      this.callbacks.onSelectPreset(presetName);
    } else if (typeof window.setCameraPreset === 'function') {
      window.setCameraPreset(presetName);
    }
  }

  /**
   * Triggers a Corridor Loop selection (`1`..`5`).
   */
  triggerLoopSelect(loopNumber) {
    const num = Math.max(1, Math.min(5, Number(loopNumber) || 1));
    this.setActiveLoopPill(num);
    if (this.loopManager) {
      this.loopManager.setLoop(num);
    }
    if (typeof this.callbacks.onSelectLoop === 'function') {
      this.callbacks.onSelectLoop(num);
    }
  }

  /**
   * Triggers a bottom-dock action (`flashlight`, `flicker`, `jumpscare`, `radio`, `clues`, `audio`, `hide_hud`).
   */
  triggerAction(action) {
    switch (action) {
      case 'flashlight':
        if (typeof this.callbacks.onToggleFlashlight === 'function') {
          this.callbacks.onToggleFlashlight();
        }
        break;
      case 'flicker':
        if (typeof this.callbacks.onTriggerFlickerScare === 'function') {
          this.callbacks.onTriggerFlickerScare();
        }
        break;
      case 'jumpscare':
        if (typeof this.callbacks.onTriggerJumpScare === 'function') {
          this.callbacks.onTriggerJumpScare();
        }
        break;
      case 'radio':
        if (typeof this.callbacks.onTriggerRadio === 'function') {
          this.callbacks.onTriggerRadio();
        } else {
          this.showSubtitle(
            'Look behind you. I said... look behind you.',
            5.0,
            'AM RADIO'
          );
        }
        break;
      case 'clues':
        this.togglePhotoDrawer();
        break;
      case 'audio':
        if (typeof this.callbacks.onToggleAudio === 'function') {
          this.callbacks.onToggleAudio();
        } else {
          this.setAudioMutedState(!this.isAudioMuted);
        }
        break;
      case 'hide_hud':
        this.setDebugHudVisible(false);
        break;
      default:
        break;
    }
  }

  setActivePresetPill(presetName) {
    this.activePreset = presetName;
    this.presetPills.forEach((btn) => {
      const isMatch = btn.getAttribute('data-preset') === presetName;
      btn.classList.toggle('active', isMatch);
    });
  }

  setActiveLoopPill(loopId) {
    const idStr = String(loopId);
    this.loopPills.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-loop') === idStr);
    });
  }

  /**
   * Updates internal state and the developer Corridor Engine telemetry badge.
   */
  updateTelemetry(state = {}) {
    if (state.loopId !== undefined) {
      this.setActiveLoopPill(state.loopId);
      const cfg = CORRIDOR_LOOPS_CONFIG[state.loopId];
      if (cfg && this.loopLabelEl) {
        this.loopLabelEl.textContent = state.loopTitle || cfg.fullTitle;
      }
      if (this.telemetryEl) {
        this.telemetryEl.classList.toggle('is-red-hell', Number(state.loopId) === 3);
      }
    } else if (state.loopTitle && this.loopLabelEl) {
      this.loopLabelEl.textContent = state.loopTitle;
    }

    if (state.clock && this.clockLabelEl) {
      this.clockLabelEl.textContent = state.clock;
    }

    if (state.flashlightOn !== undefined) {
      this.isFlashlightOn = Boolean(state.flashlightOn);
    }
    if (state.isZoomed !== undefined) {
      this.isZoomed = Boolean(state.isZoomed);
    }
    if (this.flashlightLabelEl) {
      const flText = this.isFlashlightOn ? 'ON [F]' : 'OFF [F]';
      const zmText = this.isZoomed ? 'FOCUS: ACTIVE [Z]' : 'ZOOM [Z]';
      this.flashlightLabelEl.textContent = `FLASHLIGHT: ${flText} • ${zmText}`;
    }

    const flBtn = document.getElementById('btn-action-flashlight');
    if (flBtn) {
      flBtn.classList.toggle('active', this.isFlashlightOn);
    }

    if (state.photoCount !== undefined) {
      const total = state.photoTotal || 6;
      this.currentPhotoCount = state.photoCount;
      this.currentPhotoTotal = total;
      if (this.photoLabelEl) {
        this.photoLabelEl.textContent = `PHOTOGRAPH: ${state.photoCount} / ${total}`;
      }
      if (this.photoWhisperTextEl) {
        this.photoWhisperTextEl.textContent =
          state.photoCount >= total
            ? `FRAGMENT ${state.photoCount} / ${total} ASSEMBLED — 204863 [TAB]`
            : `FRAGMENT ${state.photoCount} / ${total} RECOVERED [TAB]`;
      }
    }
  }

  /**
   * Updates the center The Corridor reticle and `[E] Inspect ...` focus prompt when hovering over an interactable.
   */
  setReticleTarget(interactable = null) {
    if (!this.reticleDotEl || !this.reticlePromptEl) return;

    if (!interactable) {
      this.reticleDotEl.classList.remove('is-focused');
      this.reticlePromptEl.classList.add('hidden');
      return;
    }

    const label =
      interactable.prompt ||
      interactable.label ||
      interactable.title ||
      'Inspect Clues — "204863"';

    this.reticleDotEl.classList.add('is-focused');
    this.reticlePromptTextEl.textContent = label.replace(/^\[E\]\s*/i, '');
    this.reticlePromptEl.classList.remove('hidden');
  }

  updateReticle(interactable = null) {
    this.setReticleTarget(interactable);
  }

  /**
   * Displays an atmospheric The Corridor cinema-serif italic subtitle at the bottom-center of the screen.
   */
  showSubtitle(text, duration = 4.5, speaker = 'AM RADIO') {
    if (!this.subtitleBarEl || !this.subtitleTextEl) return;

    if (this.subtitleTimeout) {
      clearTimeout(this.subtitleTimeout);
      this.subtitleTimeout = null;
    }

    if (this.subtitleSpeakerEl) {
      this.subtitleSpeakerEl.textContent = speaker ? `[${speaker}]` : '';
    }

    // Keep iconic The Corridor broadcast line free of simulator telemetry suffixes
    const cleaned = String(text || '').replace(
      /^Look behind you\.\s*I said\.\.\.\s*look behind you\.\s*—\s*204863$/i,
      'Look behind you. I said... look behind you.'
    );
    const formatted =
      cleaned.startsWith('"') || cleaned.startsWith('*') ? cleaned : `"${cleaned}"`;
    this.subtitleTextEl.textContent = formatted;
    this.subtitleBarEl.classList.remove('hidden');

    const effectiveDuration = duration > 0 ? duration : 6.5;
    this.subtitleTimeout = setTimeout(() => {
      this.hideSubtitle();
    }, effectiveDuration * 1000);
  }

  hideSubtitle() {
    if (this.subtitleBarEl) {
      this.subtitleBarEl.classList.add('hidden');
    }
  }

  /**
   * Renders the 6-piece Torn Family Photograph grid and clue list inside the drawer.
   */
  renderPhotoPieces(pieces = [], activePiece = null) {
    if (!this.portraitGridEl || !this.clueListEl) return;

    const selected = activePiece || pieces.find((p) => p.collected) || PHOTO_PIECES_DATA[0];
    if (selected && this.activeClueTitleEl && this.activeClueCaptionEl) {
      this.activeClueTitleEl.textContent = selected.title;
      this.activeClueCaptionEl.textContent = `"${selected.caption}"`;
    }

    // Update 2-0-4-8-6-3 cipher string
    if (this.riddleDigitsEl) {
      const digits = PHOTO_PIECES_DATA.map((p) => {
        const found = pieces.some((item) => item.id === p.id && item.collected);
        return found ? p.digit : '?';
      });
      this.riddleDigitsEl.textContent = digits.join(' - ');
    }

    // Render 3x2 Torn Family Portrait tiles
    this.portraitGridEl.innerHTML = '';
    PHOTO_PIECES_DATA.forEach((meta) => {
      const item = pieces.find((p) => p.id === meta.id) || {
        ...meta,
        collected: false,
      };
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = `pt-portrait-tile ${item.collected ? 'is-collected' : 'is-missing'}`;
      const [col, row] = meta.uvOffset;
      tile.style.backgroundPosition = `${col * 50}% ${row * 100}%`;
      tile.title = item.collected ? `${meta.title}: ${meta.caption}` : `Missing — ${meta.hint}`;
      tile.innerHTML = `
        <span class="pt-tile-num">#${meta.id}</span>
        <span class="pt-tile-digit">${item.collected ? meta.digit : '?'}</span>
      `;
      tile.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.loopManager) {
          this.loopManager.collectPhotoPiece(meta.id);
        } else {
          this.activeClueTitleEl.textContent = meta.title;
          this.activeClueCaptionEl.textContent = `"${meta.caption}"`;
        }
      });
      this.portraitGridEl.appendChild(tile);
    });

    // Render 6 Clue items list
    this.clueListEl.innerHTML = '';
    PHOTO_PIECES_DATA.forEach((meta) => {
      const item = pieces.find((p) => p.id === meta.id) || {
        ...meta,
        collected: false,
      };
      const li = document.createElement('li');
      li.className = `pt-clue-item ${item.collected ? 'is-collected' : 'is-locked'}`;
      li.innerHTML = `
        <div class="pt-clue-item-head">
          <span class="pt-clue-status">${item.collected ? '✓' : '○'}</span>
          <span class="pt-clue-name">${meta.title}</span>
          <span class="pt-clue-digit-tag">[${item.collected ? meta.digit : '?'}]</span>
        </div>
        <div class="pt-clue-item-body">
          ${item.collected ? `"${meta.caption}"` : meta.hint}
        </div>
      `;
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.loopManager) {
          this.loopManager.collectPhotoPiece(meta.id);
        }
      });
      this.clueListEl.appendChild(li);
    });
  }

  /**
   * Opens or closes the Torn Family Photograph inspection drawer (`[Tab]` or `[P]`).
   */
  togglePhotoDrawer(forceState = undefined) {
    this.isDrawerOpen =
      forceState !== undefined ? Boolean(forceState) : !this.isDrawerOpen;
    if (this.photoDrawerEl) {
      this.photoDrawerEl.classList.toggle('hidden', !this.isDrawerOpen);
    }
    const cluesBtn = document.getElementById('btn-action-clues');
    if (cluesBtn) {
      cluesBtn.classList.toggle('active', this.isDrawerOpen);
    }
    return this.isDrawerOpen;
  }

  /**
   * Toggles HUD visibility (`[H]`):
   * - In normal diegetic mode, toggles the subtle corner control whisper.
   * - In opt-in debug mode, collapses or restores the developer dock.
   */
  toggleHudVisibility(forceHidden = undefined) {
    this.isHudHidden =
      forceHidden !== undefined ? Boolean(forceHidden) : !this.isHudHidden;
    if (this.diegeticHintEl) {
      this.diegeticHintEl.classList.toggle('hidden', this.isHudHidden);
    }
    if (this.isDebugHudVisible) {
      if (this.dockInnerEl && this.dockRestoreTabEl) {
        this.dockInnerEl.classList.toggle('hidden', this.isHudHidden);
        this.dockRestoreTabEl.classList.toggle('hidden', !this.isHudHidden);
      }
      if (this.telemetryEl) {
        this.telemetryEl.classList.toggle('hud-minimized', this.isHudHidden);
      }
    }
    return this.isHudHidden;
  }

  setAudioMutedState(isMuted) {
    this.isAudioMuted = Boolean(isMuted);
    const btn = document.getElementById('btn-action-audio');
    if (btn) {
      btn.innerHTML = this.isAudioMuted
        ? '🔇 Muted <kbd>M</kbd>'
        : '🔊 Audio <kbd>M</kbd>';
      btn.classList.toggle('is-muted', this.isAudioMuted);
    }
  }

  /**
   * CRITICAL: Toggles `class="clean-mode"` on BOTH `document.documentElement` AND `document.body`
   * so `shot_01`..`shot_06` are 100% pure 3D screenshots with zero HUD, while `shot_07_interactive_hud.png`
   * (`setCleanMode(false)`) and live gameplay display the pure, minimalist The Corridor diegetic HUD
   * (center reticle, cinema italic subtitle, bottom-right control whisper, and 4s top-right fragment whisper)
   * with zero simulator toolbar clutter!
   */
  setCleanMode(isClean) {
    const clean = Boolean(isClean);
    this.isCleanMode = clean;
    if (document.documentElement) {
      document.documentElement.classList.toggle('clean-mode', clean);
    }
    if (document.body) {
      document.body.classList.toggle('clean-mode', clean);
    }
    if (this.rootEl) {
      this.rootEl.style.display = clean ? 'none' : '';
    }
    if (!clean) {
      this.flashPhotoWhisper(this.currentPhotoCount || 2, this.currentPhotoTotal || 6, 4.0);
    }
    return clean;
  }
}
