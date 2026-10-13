// ============================================================================
// Argon Tennis — Argon Tennis Kinetic Swing VFX & Ball Impact Polish
// ============================================================================
// Implements:
//   1. Generative Curved 3D Racket Hoop Ribbon Trails (RacketRibbonTrail)
//      with 4x Sub-Frame Catmull-Rom Spline Interpolation (N = 36 slices)
//      and custom ShaderMaterial shot-type palettes.
//   2. 2-Frame Hit-Stop (hitStopTimer: 0.034s sweet-spot / 0.048s power smash)
//      & Racket String Recoil Micro-Shimmer (consumeHitStop(rawDt)).
//   3. Ball Squash-and-Stretch Damped Harmonic Oscillator (freq = 42 rad/s,
//      damping = 14, duration = 0.18s) on Racket Contact & Turf Bounce.
//   4. Cartoony Argon Tennis 5-Pointed 3D Stars, Radial Spark Streaks, and
//      Expanding 3D Impact Shockwave Flash Rings (0.12m -> 0.95m in 0.16s).
// ============================================================================

import * as THREE from 'three';

const BASE_BALL_SCALE = 1.65;
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const LOCAL_HOOP_THROAT = new THREE.Vector3(0, 0.22, 0);
const LOCAL_HOOP_TIP = new THREE.Vector3(0, 0.68, 0);
const LOCAL_HOOP_CENTER = new THREE.Vector3(0, 0.45, 0);

// ----------------------------------------------------------------------------
// Shot-Type Color Palettes for Racket Ribbon Trails & Impact Bursts
// ----------------------------------------------------------------------------
export const SHOT_VFX_PALETTES = {
  TOPSPIN: {
    leadColor: new THREE.Color('#fff8d6'),
    trailColor: new THREE.Color('#ffaa18'),
    rimColor: new THREE.Color('#ff7b00'),
    ringColor: new THREE.Color('#ffe066'),
    starColors: [0xffea28, 0xffaa18, 0xfff8d6, 0xffffff],
    additive: false,
    widthScale: 1.05,
  },
  SLICE: {
    leadColor: new THREE.Color('#e8ffff'),
    trailColor: new THREE.Color('#38e8ff'),
    rimColor: new THREE.Color('#00b8ff'),
    ringColor: new THREE.Color('#70f3ff'),
    starColors: [0x38e8ff, 0x9ef8ff, 0xffffff, 0xffea28],
    additive: false,
    widthScale: 1.0,
  },
  SMASH: {
    leadColor: new THREE.Color('#ffffff'),
    trailColor: new THREE.Color('#ffea28'),
    rimColor: new THREE.Color('#00d8ff'),
    ringColor: new THREE.Color('#ffea28'),
    starColors: [0xffea28, 0x38f2ff, 0xffffff, 0xffaa18],
    additive: false,
    widthScale: 1.0,
  },
  POWER: {
    leadColor: new THREE.Color('#ffffff'),
    trailColor: new THREE.Color('#ffea28'),
    rimColor: new THREE.Color('#00d8ff'),
    ringColor: new THREE.Color('#ffea28'),
    starColors: [0xffea28, 0x38f2ff, 0xffffff, 0xffaa18],
    additive: false,
    widthScale: 1.0,
  },
  LOB: {
    leadColor: new THREE.Color('#ffffff'),
    trailColor: new THREE.Color('#cbeeff'),
    rimColor: new THREE.Color('#8cd6ff'),
    ringColor: new THREE.Color('#e2f6ff'),
    starColors: [0xffffff, 0xcbeeff, 0xffea28],
    additive: false,
    widthScale: 0.96,
  },
  FLAT: {
    leadColor: new THREE.Color('#ffffff'),
    trailColor: new THREE.Color('#cbeeff'),
    rimColor: new THREE.Color('#7ce0ff'),
    ringColor: new THREE.Color('#ffffff'),
    starColors: [0xffffff, 0xffea28, 0x52e5ff],
    additive: false,
    widthScale: 1.0,
  },
};

export function getShotPalette(shotType = 'TOPSPIN', isPower = false) {
  const key = String(shotType || '').trim().toUpperCase();
  if (SHOT_VFX_PALETTES[key]) return SHOT_VFX_PALETTES[key];
  if (isPower) return SHOT_VFX_PALETTES.POWER;
  return SHOT_VFX_PALETTES.TOPSPIN;
}

// ----------------------------------------------------------------------------
// Catmull-Rom 3D Vector Interpolation Helper
// ----------------------------------------------------------------------------
function evalCatmullRomVec3(p0, p1, p2, p3, t, out = new THREE.Vector3()) {
  const t2 = t * t;
  const t3 = t2 * t;

  const c0 = -0.5 * t3 + t2 - 0.5 * t;
  const c1 = 1.5 * t3 - 2.5 * t2 + 1.0;
  const c2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
  const c3 = 0.5 * t3 - 0.5 * t2;

  out.set(
    p0.x * c0 + p1.x * c1 + p2.x * c2 + p3.x * c3,
    p0.y * c0 + p1.y * c1 + p2.y * c2 + p3.y * c3,
    p0.z * c0 + p1.z * c1 + p2.z * c2 + p3.z * c3
  );
  return out;
}

// ----------------------------------------------------------------------------
// Helper: Extract World-Space Racket Rim Points (Tip & Throat) from Actor
// ----------------------------------------------------------------------------
export function sampleActorRacketRimWorldPoints(
  actor,
  outTip = new THREE.Vector3(),
  outThroat = new THREE.Vector3(),
  outCenter = new THREE.Vector3()
) {
  if (!actor) return false;

  // 1. Prefer actor.racketKinematics.getRacketRimWorldPoints(actor) if available
  const rk = actor.racketKinematics || actor.kinematics || null;
  if (rk && typeof rk.getRacketRimWorldPoints === 'function') {
    const pts = rk.getRacketRimWorldPoints(actor);
    if (pts) {
      const tipSrc = pts.tipWorld || pts.tip || (Array.isArray(pts) ? pts[0] : null);
      const throatSrc =
        pts.throatWorld || pts.throat || pts.innerWorld || pts.inner || (Array.isArray(pts) ? pts[1] : null);
      if (tipSrc && throatSrc) {
        outTip.copy(tipSrc);
        outThroat.copy(throatSrc);
        if (pts.centerWorld || pts.center) {
          outCenter.copy(pts.centerWorld || pts.center);
        } else {
          outCenter.lerpVectors(outThroat, outTip, 0.5);
        }
        return true;
      }
    }
  }

  // 2. Fallback: Compute directly from actor.racketMesh.matrixWorld
  //    where local hoop inner/throat is (0, 0.22, 0) and local hoop tip is (0, 0.68, 0)
  if (actor.root && typeof actor.root.updateMatrixWorld === 'function') {
    actor.root.updateMatrixWorld(true);
  }
  if (actor.racketMesh && actor.racketMesh.matrixWorld) {
    actor.racketMesh.updateMatrixWorld(true);
    outThroat.copy(LOCAL_HOOP_THROAT).applyMatrix4(actor.racketMesh.matrixWorld);
    outTip.copy(LOCAL_HOOP_TIP).applyMatrix4(actor.racketMesh.matrixWorld);
    outCenter.copy(LOCAL_HOOP_CENTER).applyMatrix4(actor.racketMesh.matrixWorld);
    return true;
  }

  // 3. Fallback if racketMesh not yet attached: use racketPivot or actor.pos
  if (actor.racketPivot && actor.racketPivot.matrixWorld) {
    actor.racketPivot.updateMatrixWorld(true);
    outThroat.copy(LOCAL_HOOP_THROAT).applyMatrix4(actor.racketPivot.matrixWorld);
    outTip.copy(LOCAL_HOOP_TIP).applyMatrix4(actor.racketPivot.matrixWorld);
    outCenter.lerpVectors(outThroat, outTip, 0.5);
    return true;
  }

  if (actor.pos) {
    const side = actor.sideSign || 1;
    outThroat.set(actor.pos.x + 0.36 * side, actor.pos.y + 1.05, actor.pos.z - 0.14 * side);
    outTip.set(actor.pos.x + 0.68 * side, actor.pos.y + 1.42, actor.pos.z - 0.24 * side);
    outCenter.lerpVectors(outThroat, outTip, 0.5);
    return true;
  }

  return false;
}

// ----------------------------------------------------------------------------
// 1. Generative Curved 3D Racket Hoop Ribbon Trail (RacketRibbonTrail)
// ----------------------------------------------------------------------------
const RACKET_RIBBON_VERTEX_SHADER = /* glsl */ `
  attribute float aAlpha;
  varying vec2 vUv;
  varying float vSliceAlpha;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    vSliceAlpha = aAlpha;
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RACKET_RIBBON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uLeadColor;
  uniform vec3 uTrailColor;
  uniform vec3 uRimColor;
  uniform float uOpacity;
  uniform float uWhipBoost;

  varying vec2 vUv;
  varying float vSliceAlpha;
  varying vec3 vColor;

  void main() {
    // vUv.x: 0.0 at leading racket edge -> 1.0 at trailing tail
    // vUv.y: 0.0 at inner throat -> 1.0 at outer racket tip
    float headToTail = clamp(1.0 - vUv.x, 0.0, 1.0);
    float radial = clamp(vUv.y, 0.0, 1.0);

    // Smooth longitudinal fade from 0.88 at leading edge to 0.0 at tail
    float longFade = pow(headToTail, 1.35) * smoothstep(0.0, 0.08, headToTail);

    // Radial profile: fuller & brighter toward outer tip (radial 0.35..0.95),
    // soft feathering at throat (0.0..0.14) and extreme outer rim (0.94..1.0)
    float innerFeather = smoothstep(0.0, 0.15, radial);
    float outerFeather = 1.0 - smoothstep(0.92, 1.0, radial);
    float tipWeight = mix(0.42, 1.0, pow(radial, 0.65));
    float radialMask = innerFeather * outerFeather * tipWeight;

    // Subtle speed-streak highlight band near the outer hoop rim (radial ~ 0.78)
    float streakBand = exp(-pow((radial - 0.78) / 0.14, 2.0)) * 0.38 * uWhipBoost;

    vec3 gradColor = mix(uTrailColor, uLeadColor, pow(headToTail, 0.75));
    gradColor = mix(gradColor, uRimColor, (1.0 - headToTail) * 0.35 * (1.0 - radial));
    gradColor = mix(gradColor, vColor, 0.35);
    gradColor += vec3(streakBand);

    float alpha = clamp(longFade * radialMask * vSliceAlpha * uOpacity, 0.0, 0.92);
    if (alpha < 0.008) discard;

    gl_FragColor = vec4(gradColor, alpha);
  }
`;

export class RacketRibbonTrail {
  /**
   * @param {THREE.Scene} scene
   * @param {object} [options]
   * @param {number} [options.maxSlices=36] - Total ribbon cross-section slices (N = 36)
   * @param {number} [options.subSteps=4] - Catmull-Rom sub-steps per frame sample
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.maxSlices = options.maxSlices || 36;
    this.subSteps = options.subSteps || 4;

    // Raw frame keyframes (up to 8 control nodes) for Catmull-Rom interpolation
    this.rawSamples = [];
    // Subdivided smooth ribbon slices (up to maxSlices = 36): { tip, throat, alpha, whip }
    this.slices = [];

    this.shotType = 'TOPSPIN';
    this.isPower = false;
    this.whipSpeed = 1.0;
    this.fadeTimer = 0;
    this.maxFadeDuration = 0.38;
    this.activeSwing = false;

    const vertexCount = this.maxSlices * 2;
    this.positions = new Float32Array(vertexCount * 3);
    this.colors = new Float32Array(vertexCount * 3);
    this.uvs = new Float32Array(vertexCount * 2);
    this.alphas = new Float32Array(vertexCount);

    // Explicit triangle index buffer (r128+ safe: 2 triangles = 6 indices per quad segment)
    const indices = [];
    for (let i = 0; i < this.maxSlices - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }

    for (let i = 0; i < this.maxSlices; i++) {
      const u = i / Math.max(1, this.maxSlices - 1);
      const v0 = i * 2;
      const v1 = v0 + 1;
      this.uvs[v0 * 2 + 0] = u;
      this.uvs[v0 * 2 + 1] = 0.0;
      this.uvs[v1 * 2 + 0] = u;
      this.uvs[v1 * 2 + 1] = 1.0;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setIndex(indices);

    const initPalette = getShotPalette('TOPSPIN', false);
    this.uniforms = {
      uLeadColor: { value: initPalette.leadColor.clone() },
      uTrailColor: { value: initPalette.trailColor.clone() },
      uRimColor: { value: initPalette.rimColor.clone() },
      uOpacity: { value: 0.88 },
      uWhipBoost: { value: 1.0 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: RACKET_RIBBON_VERTEX_SHADER,
      fragmentShader: RACKET_RIBBON_FRAGMENT_SHADER,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = options.name || 'RacketRibbonTrail';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;

    if (this.scene) {
      this.scene.add(this.mesh);
    }

    this._tmpTip = new THREE.Vector3();
    this._tmpThroat = new THREE.Vector3();
    this._tmpCenter = new THREE.Vector3();
    this._tmpSpan = new THREE.Vector3();
    this._tmpColor = new THREE.Color();
  }

  /**
   * Configures the ribbon's shot-type color palette and whip intensity.
   */
  setStyle(shotType = 'TOPSPIN', isPower = false, whipSpeed = 1.15) {
    this.shotType = String(shotType || 'TOPSPIN').toUpperCase();
    this.isPower = Boolean(isPower);
    this.whipSpeed = THREE.MathUtils.clamp(Number(whipSpeed || 1.15), 0.65, 2.2);

    const palette = getShotPalette(this.shotType, this.isPower);
    this.uniforms.uLeadColor.value.copy(palette.leadColor);
    this.uniforms.uTrailColor.value.copy(palette.trailColor);
    this.uniforms.uRimColor.value.copy(palette.rimColor);
    this.uniforms.uWhipBoost.value = THREE.MathUtils.clamp(
      this.whipSpeed * palette.widthScale,
      0.75,
      1.85
    );
    this.material.blending = palette.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  }

  /**
   * Clears all ribbon samples and hides the trail mesh.
   */
  clear() {
    this.rawSamples.length = 0;
    this.slices.length = 0;
    this.fadeTimer = 0;
    this.activeSwing = false;
    this.mesh.visible = false;
  }

  /**
   * Pushes a raw world-space `(tipWorld, throatWorld)` pair and generates
   * `this.subSteps` (4) smooth Catmull-Rom interpolated sub-slices so fast
   * 140° swings in 0.12s render as a silky-smooth curved arc.
   */
  pushRimSample(tipWorld, throatWorld, whipSpeed = this.whipSpeed) {
    if (!tipWorld || !throatWorld) return;

    // Ignore duplicate stationary samples
    if (this.rawSamples.length > 0) {
      const prev = this.rawSamples[0];
      const tipDistSq = prev.tip.distanceToSquared(tipWorld);
      const throatDistSq = prev.throat.distanceToSquared(throatWorld);
      if (tipDistSq < 1e-5 && throatDistSq < 1e-5) {
        return;
      }
    }

    const sample = {
      tip: tipWorld.clone(),
      throat: throatWorld.clone(),
      whip: THREE.MathUtils.clamp(Number(whipSpeed || this.whipSpeed || 1.0), 0.65, 2.2),
    };

    this.rawSamples.unshift(sample);
    if (this.rawSamples.length > 8) {
      this.rawSamples.pop();
    }

    if (this.rawSamples.length === 1) {
      this._unshiftSlice(sample.tip, sample.throat, sample.whip);
    } else {
      // Raw samples are ordered newest-first:
      // s0 = newest (current), s1 = previous, s2 = two frames ago, s3 = three frames ago.
      // Interpolate forward in time from s1 -> s0 in `subSteps` (4) increments!
      const s0 = this.rawSamples[0];
      const s1 = this.rawSamples[1];
      const s2 = this.rawSamples[2] || s1;
      const s3 = this.rawSamples[3] || s2;

      // Extrapolate phantom future control point p3 beyond s0 for smooth leading tangent
      const p0Tip = s2.tip;
      const p1Tip = s1.tip;
      const p2Tip = s0.tip;
      const p3Tip = this._tmpTip.copy(s0.tip).multiplyScalar(2).sub(s1.tip);

      const p0Throat = s2.throat;
      const p1Throat = s1.throat;
      const p2Throat = s0.throat;
      const p3Throat = this._tmpThroat.copy(s0.throat).multiplyScalar(2).sub(s1.throat);

      for (let step = 1; step <= this.subSteps; step++) {
        const u = step / this.subSteps;
        const subTip = evalCatmullRomVec3(p0Tip, p1Tip, p2Tip, p3Tip, u, new THREE.Vector3());
        const subThroat = evalCatmullRomVec3(
          p0Throat,
          p1Throat,
          p2Throat,
          p3Throat,
          u,
          new THREE.Vector3()
        );
        const subWhip = THREE.MathUtils.lerp(s1.whip, s0.whip, u);
        this._unshiftSlice(subTip, subThroat, subWhip);
      }
    }

    this.fadeTimer = this.maxFadeDuration;
    this.activeSwing = true;
    this._rebuildBufferAttributes();
  }

  _unshiftSlice(tipVec, throatVec, whip) {
    this.slices.unshift({
      tip: tipVec,
      throat: throatVec,
      whip,
      age: 0,
    });
    if (this.slices.length > this.maxSlices) {
      this.slices.length = this.maxSlices;
    }
  }

  /**
   * Seeds an immediate 36-slice smooth 3D swing arc welded at Slice 0 to the actor's
   * live racketMesh hoop and sweeping backward along a true circular shoulder arc in
   * actor.root local space (respecting actor.root.rotation.y and position).
   */
  seedSwingArcFromActor(actor, options = {}) {
    if (!actor) return;
    const rk = actor.racketKinematics;
    const shotType = options.shotType || (rk && rk.swingShotType) || actor.shotType || this.shotType || 'TOPSPIN';
    const isPower = Boolean(options.isPower ?? this.isPower);
    const rawWhip = Number(options.whipSpeed) || (rk && rk.currentWhipSpeed) || 1.15;
    const normWhip = rawWhip > 3.0 ? THREE.MathUtils.clamp(rawWhip / 24.0, 0.88, 1.25) : THREE.MathUtils.clamp(rawWhip, 0.85, 1.25);
    this.setStyle(shotType, isPower, normWhip);

    const swingType = String(
      options.swingType || (rk && (rk.swingSide || rk.swingType)) || actor.swingType || 'forehand'
    ).toLowerCase();
    const isBackhand = swingType === 'backhand';
    const isOverhead = swingType === 'serve' || swingType === 'smash' || swingType === 'overhead';

    if (actor.root) {
      actor.root.updateMatrixWorld(true);
    }

    // Sample the exact live world-space tip and throat of `actor.racketMesh`
    const hasLiveHoop = sampleActorRacketRimWorldPoints(
      actor,
      this._tmpTip,
      this._tmpThroat,
      this._tmpCenter
    );

    const rootObj = actor.root || null;
    // In `actor.root` local space:
    // `local -X` is Forehand side (Screen Right for near player)
    // `local +X` is Backhand side (Screen Left for near player)
    const shoulderLocal = new THREE.Vector3(
      isBackhand ? 0.22 : -0.24,
      isOverhead ? 1.28 : 1.02,
      0.08
    );

    let tipLocal0;
    let throatLocal0;
    if (hasLiveHoop && rootObj) {
      tipLocal0 = rootObj.worldToLocal(this._tmpTip.clone());
      throatLocal0 = rootObj.worldToLocal(this._tmpThroat.clone());
    } else {
      tipLocal0 = new THREE.Vector3(isBackhand ? -0.42 : 0.18, isOverhead ? 1.65 : 1.28, 0.58);
      throatLocal0 = new THREE.Vector3(isBackhand ? -0.24 : -0.08, isOverhead ? 1.38 : 1.08, 0.34);
    }

    // Vectors from shoulder pivot to live racket tip and throat at Slice 0
    const vTip0 = tipLocal0.clone().sub(shoulderLocal);
    const vThroat0 = throatLocal0.clone().sub(shoulderLocal);

    // Ensure healthy hoop span so inner and outer edges never cross
    const tipR = Math.max(0.58, vTip0.length());
    const throatR = THREE.MathUtils.clamp(vThroat0.length(), 0.22, tipR - 0.34);
    const u0 = vTip0.clone().normalize();
    vTip0.copy(u0).multiplyScalar(tipR);
    vThroat0.copy(u0).multiplyScalar(throatR);

    // Windup direction in `actor.root` local space (+Z = toward net, -X = Forehand/Screen Right, +X = Backhand/Screen Left)
    const windupDirLocal = isOverhead
      ? new THREE.Vector3(-0.34, 0.65, -0.68).normalize()
      : isBackhand
      ? new THREE.Vector3(0.68, -0.18, -0.45).normalize()
      : new THREE.Vector3(-0.68, -0.26, -0.48).normalize();

    const swingAxisLocal = new THREE.Vector3().crossVectors(u0, windupDirLocal);
    if (swingAxisLocal.lengthSq() < 1e-4) {
      swingAxisLocal.set(0, 1, 0);
    } else {
      swingAxisLocal.normalize();
    }

    const totalAngle = Math.min(Math.PI * 0.72, Math.max(0.85, u0.angleTo(windupDirLocal)));
    const arcSpanRad = options.arcSpanRad || totalAngle;

    this.rawSamples.length = 0;
    this.slices.length = 0;

    // Populate N = 36 slices from head (i = 0, exact live racket hoop) to tail (i = 35, windup)
    for (let i = 0; i < this.maxSlices; i++) {
      const frac = i / Math.max(1, this.maxSlices - 1); // 0 = leading edge at racket hoop, 1 = tail
      const theta = frac * arcSpanRad;

      const rotTipLocal = vTip0.clone().applyAxisAngle(swingAxisLocal, theta).add(shoulderLocal);
      const rotThroatLocal = vThroat0.clone().applyAxisAngle(swingAxisLocal, theta).add(shoulderLocal);

      const tipWorld = rootObj ? rootObj.localToWorld(rotTipLocal) : rotTipLocal.add(actor.pos || new THREE.Vector3());
      const throatWorld = rootObj ? rootObj.localToWorld(rotThroatLocal) : rotThroatLocal.add(actor.pos || new THREE.Vector3());

      this.slices.push({
        tip: tipWorld,
        throat: throatWorld,
        whip: normWhip * (1.0 - frac * 0.22),
        age: frac * 0.16,
      });
    }

    if (this.slices.length >= 2) {
      this.rawSamples.push(
        {
          tip: this.slices[0].tip.clone(),
          throat: this.slices[0].throat.clone(),
          whip: normWhip,
        },
        {
          tip: this.slices[4]?.tip.clone() || this.slices[1].tip.clone(),
          throat: this.slices[4]?.throat.clone() || this.slices[1].throat.clone(),
          whip: normWhip,
        }
      );
    }

    this.fadeTimer = options.duration || 0.45;
    this.activeSwing = true;
    this._lastSwingSide = swingType;
    this._rebuildBufferAttributes();
  }

  /**
   * Samples the actor's racket tip & throat in world space and advances the ribbon.
   */
  updateForActor(actor, dt) {
    if (!actor) return;

    const rk = actor.racketKinematics;
    const isSwinging =
      (actor.swingTimer && actor.swingTimer > 0) ||
      (actor.arcVisibleTimer && actor.arcVisibleTimer > 0) ||
      (rk &&
        (rk.swingActive ||
          rk.isSwinging ||
          (rk.swingPhase && rk.swingPhase !== 'idle' && rk.swingPhase !== 'IDLE') ||
          (rk.phase && rk.phase !== 'idle' && rk.phase !== 'IDLE')));

    const currentSwingSide = String(
      (rk && (rk.swingSide || rk.swingType)) || actor.swingType || 'forehand'
    ).toLowerCase();

    // If a fresh swing started or switched between Forehand and Backhand, clear old samples
    // so the ribbon trail never bridges across opposite sides of the Mii's body.
    if (isSwinging) {
      const elapsed = rk && typeof rk.swingElapsed === 'number' ? rk.swingElapsed : 0;
      if (
        (this._lastSwingSide && this._lastSwingSide !== currentSwingSide) ||
        (rk && rk.swingActive && elapsed < dt * 2.2 && (this._lastSwingElapsed || 0) > elapsed)
      ) {
        this.rawSamples.length = 0;
        this.slices.length = 0;
      }
      this._lastSwingSide = currentSwingSide;
      this._lastSwingElapsed = elapsed;
    }

    const hasSample = sampleActorRacketRimWorldPoints(
      actor,
      this._tmpTip,
      this._tmpThroat,
      this._tmpCenter
    );

    if (hasSample && isSwinging) {
      // Estimate instantaneous whip speed from tip displacement
      let whip = this.whipSpeed;
      if (this.rawSamples.length > 0 && dt > 1e-4) {
        const tipVel = this._tmpTip.distanceTo(this.rawSamples[0].tip) / dt;
        whip = THREE.MathUtils.clamp(0.85 + tipVel * 0.025, 0.85, 1.25);
      }
      if (rk && rk.swingShotType && this.slices.length === 0) {
        this.setStyle(rk.swingShotType, this.isPower, whip);
      }

      if (this.slices.length < 4 && actor.arcVisibleTimer > 0.45) {
        this.seedSwingArcFromActor(actor, {
          shotType: this.shotType,
          swingType: currentSwingSide,
          isPower: this.isPower,
          whipSpeed: whip,
        });
      } else {
        this.pushRimSample(this._tmpTip, this._tmpThroat, whip);
      }
    } else if (this.fadeTimer > 0) {
      this.fadeTimer = Math.max(0, this.fadeTimer - dt);
      for (let i = 0; i < this.slices.length; i++) {
        this.slices[i].age += dt;
      }
      if (this.fadeTimer <= 0) {
        this.clear();
        return;
      }
      this._rebuildBufferAttributes();
    } else {
      this.mesh.visible = false;
    }

    // Hide original static ring mesh if present so only the generative 3D ribbon is shown
    if (actor.swingArcMesh && this.mesh.visible) {
      actor.swingArcMesh.visible = false;
    }
  }

  _rebuildBufferAttributes() {
    const count = this.slices.length;
    if (count < 2) {
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;
    const palette = getShotPalette(this.shotType, this.isPower);
    const fadeRatio = THREE.MathUtils.clamp(this.fadeTimer / this.maxFadeDuration, 0.0, 1.0);
    this.uniforms.uOpacity.value = 0.88 * Math.pow(fadeRatio, 0.55);

    for (let i = 0; i < this.maxSlices; i++) {
      const idx = Math.min(i, count - 1);
      const slice = this.slices[idx];
      const frac = idx / Math.max(1, count - 1); // 0 at leading racket edge, 1 at trailing tail
      const headWeight = 1.0 - frac;

      // Normalize whip multiplier so passing m/s (25..34) never pushes widthScale > 1.02
      // (which would push the inner throat edge past the pivot center into a cone pinch!)
      const normWhip = slice.whip > 3.0 ? slice.whip / 24.0 : slice.whip;
      const widthScale = THREE.MathUtils.clamp(
        palette.widthScale *
          THREE.MathUtils.clamp(normWhip, 0.85, 1.05) *
          (0.42 + 0.58 * Math.pow(headWeight, 0.55)),
        0.38,
        1.02
      );

      this._tmpSpan.subVectors(slice.tip, slice.throat);
      const throatX = slice.tip.x - this._tmpSpan.x * widthScale;
      const throatY = slice.tip.y - this._tmpSpan.y * widthScale;
      const throatZ = slice.tip.z - this._tmpSpan.z * widthScale;

      const v0 = i * 2;
      const v1 = v0 + 1;

      this.positions[v0 * 3 + 0] = throatX;
      this.positions[v0 * 3 + 1] = throatY;
      this.positions[v0 * 3 + 2] = throatZ;

      this.positions[v1 * 3 + 0] = slice.tip.x;
      this.positions[v1 * 3 + 1] = slice.tip.y;
      this.positions[v1 * 3 + 2] = slice.tip.z;

      this._tmpColor.copy(palette.leadColor).lerp(palette.trailColor, frac * 0.85);

      this.colors[v0 * 3 + 0] = this._tmpColor.r;
      this.colors[v0 * 3 + 1] = this._tmpColor.g;
      this.colors[v0 * 3 + 2] = this._tmpColor.b;

      this.colors[v1 * 3 + 0] = this._tmpColor.r;
      this.colors[v1 * 3 + 1] = this._tmpColor.g;
      this.colors[v1 * 3 + 2] = this._tmpColor.b;

      const ageFade = Math.max(0.0, 1.0 - slice.age * 2.6);
      const sliceAlpha = headWeight * ageFade;
      this.alphas[v0] = sliceAlpha * 0.55;
      this.alphas[v1] = sliceAlpha;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

// ----------------------------------------------------------------------------
// 4a. Cartoony 5-Pointed 3D Star Geometry (createCartoonStarGeometry)
// ----------------------------------------------------------------------------
export function createCartoonStarGeometry(
  outerRadius = 0.105,
  innerRadius = 0.045,
  halfThickness = 0.028
) {
  const points = 5;
  const ringCount = points * 2; // 10 perimeter vertices alternating outer / inner
  // Vertices: 0..9 perimeter, 10 = front center apex (+Z), 11 = back center apex (-Z)
  const positions = new Float32Array((ringCount + 2) * 3);
  const uvs = new Float32Array((ringCount + 2) * 2);

  for (let i = 0; i < ringCount; i++) {
    const angle = (i / ringCount) * Math.PI * 2 + Math.PI * 0.5;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = 0;

    uvs[i * 2 + 0] = (x / outerRadius) * 0.5 + 0.5;
    uvs[i * 2 + 1] = (y / outerRadius) * 0.5 + 0.5;
  }

  // Front apex (index 10)
  positions[10 * 3 + 0] = 0;
  positions[10 * 3 + 1] = 0;
  positions[10 * 3 + 2] = halfThickness;
  uvs[10 * 2 + 0] = 0.5;
  uvs[10 * 2 + 1] = 0.5;

  // Back apex (index 11)
  positions[11 * 3 + 0] = 0;
  positions[11 * 3 + 1] = 0;
  positions[11 * 3 + 2] = -halfThickness;
  uvs[11 * 2 + 0] = 0.5;
  uvs[11 * 2 + 1] = 0.5;

  const indices = [];
  for (let i = 0; i < ringCount; i++) {
    const next = (i + 1) % ringCount;
    // Front face triangle
    indices.push(10, i, next);
    // Back face triangle
    indices.push(11, next, i);
  }

  const rawGeom = new THREE.BufferGeometry();
  rawGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  rawGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  rawGeom.setIndex(indices);
  const geom = rawGeom.toNonIndexed();
  geom.computeVertexNormals();
  return geom;
}

// ----------------------------------------------------------------------------
// 4b. Radial Spark Streak Geometry (Elongated 3D Diamond Streak)
// ----------------------------------------------------------------------------
function createSparkStreakGeometry(length = 0.28, radius = 0.024) {
  const geom = new THREE.ConeGeometry(radius, length, 4, 1);
  // Orient along +Y by default so quaternion.setFromUnitVectors(UP_AXIS, velDir) aligns streak with velocity
  geom.computeVertexNormals();
  return geom;
}

// ----------------------------------------------------------------------------
// Main SwingVFXManager Class
// ----------------------------------------------------------------------------
export class SwingVFXManager {
  /**
   * @param {THREE.Scene | object} sceneOrConfig
   * @param {object} [options]
   */
  constructor(sceneOrConfig, options = {}) {
    if (sceneOrConfig && sceneOrConfig.isScene) {
      this.scene = sceneOrConfig;
      this.options = options;
    } else if (sceneOrConfig && sceneOrConfig.scene) {
      this.scene = sceneOrConfig.scene;
      this.options = sceneOrConfig;
    } else {
      this.scene = null;
      this.options = sceneOrConfig || {};
    }

    this.camera = this.options.camera || null;

    // 1. Generative 3D Racket Hoop Ribbon Trails (1 per actor, 4 actors total)
    this.racketTrails = new Map();
    this.actorsByRole = new Map();

    // 2. 2-Frame Hit-Stop & Impact Freeze Controller
    this.hitStopTimer = 0;
    this.hitStopDuration = 0;
    this.hitStopIntensity = 0;
    this._hitStopConsumedThisFrame = false;
    this.recoilStates = new Map(); // actor -> { timer, duration, intensity, baseRotZ }

    // 3. Ball Squash-and-Stretch Harmonic Oscillator State
    //    freq = 42 rad/s, damping = 14, duration = 0.18s, base scale = (1.65, 1.65, 1.65)
    this.ballDeformation = {
      active: false,
      ballRef: null,
      type: 'racket_hit',
      age: 0,
      duration: 0.18,
      freq: 42.0,
      damping: 14.0,
      baseScale: BASE_BALL_SCALE,
      initialSquashY: 0.62,
      initialExpandXZ: 1.42,
      axis: new THREE.Vector3(0, 0, -1),
      quat: new THREE.Quaternion(),
      invQuat: new THREE.Quaternion(),
    };

    // 4. Object Pools for Impact Shockwave Rings, 5-Pointed Cartoon Stars, Spark Streaks & Turf Rings
    this.impactRings = [];
    this.starParticles = [];
    this.sparkStreaks = [];
    this.turfBounceRings = [];

    this._tmpVecA = new THREE.Vector3();
    this._tmpVecB = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();

    if (this.scene) {
      this._initPools();
    }

    if (Array.isArray(this.options.actors)) {
      this.options.actors.forEach((a) => this.registerActor(a));
    }
  }

  _initPools() {
    // Pool A: 3D Expanding Impact Flash Rings (crisp shockwave ring around contact point)
    // Unit outer radius = 1.0 so mesh.scale.setScalar(r) equals exact world radius in meters!
    const ringGeo = new THREE.RingGeometry(0.84, 1.0, 32);
    const coreGeo = new THREE.CircleGeometry(0.32, 24);

    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group();
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffea28,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      group.add(ringMesh);
      group.add(coreMesh);
      group.visible = false;
      group.renderOrder = 8;
      this.scene.add(group);

      this.impactRings.push({
        group,
        ringMesh,
        coreMesh,
        ringMat,
        coreMat,
        active: false,
        age: 0,
        duration: 0.16,
        startRadius: 0.08,
        endRadius: 0.36,
      });
    }

    // Pool B: Cartoony 5-Pointed 3D Stars (48 pooled meshes)
    const starGeo = createCartoonStarGeometry(0.105, 0.045, 0.028);
    const defaultStarPalette = [0xffea28, 0x38e8ff, 0xffffff, 0xffaa18];

    for (let i = 0; i < 48; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: defaultStarPalette[i % defaultStarPalette.length],
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(starGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 8;
      this.scene.add(mesh);

      this.starParticles.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.38,
        baseScale: 1.0,
        gravity: 6.8,
        active: false,
      });
    }

    // Pool C: Radially Stretched Spark Streaks (36 pooled meshes)
    const streakGeo = createSparkStreakGeometry(0.32, 0.022);
    for (let i = 0; i < 36; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffffff : 0xffea28,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(streakGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 8;
      this.scene.add(mesh);

      this.sparkStreaks.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.24,
        baseScale: 1.0,
        active: false,
      });
    }

    // Pool D: Court Turf Bounce Rings (8 pooled meshes)
    const bounceGeo = new THREE.RingGeometry(0.12, 0.25, 32);
    bounceGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(bounceGeo, mat);
      mesh.visible = false;
      mesh.position.y = 0.024;
      mesh.renderOrder = 3;
      this.scene.add(mesh);

      this.turfBounceRings.push({
        mesh,
        mat,
        active: false,
        age: 0,
        duration: 0.46,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 1. Actor & Racket Ribbon Trail Management
  // --------------------------------------------------------------------------
  registerActor(actor) {
    if (!actor) return null;
    const key = actor.role || actor;
    if (this.racketTrails.has(key)) {
      this.actorsByRole.set(key, actor);
      return this.racketTrails.get(key);
    }
    const trail = new RacketRibbonTrail(this.scene, {
      maxSlices: 36,
      subSteps: 4,
      name: `RacketRibbonTrail_${String(actor.role || 'actor')}`,
    });
    this.racketTrails.set(key, trail);
    this.actorsByRole.set(key, actor);
    actor.racketRibbonTrail = trail;
    return trail;
  }

  getRacketTrail(actorOrRole) {
    if (!actorOrRole) return null;
    const key = typeof actorOrRole === 'string' ? actorOrRole : actorOrRole.role || actorOrRole;
    if (this.racketTrails.has(key)) {
      return this.racketTrails.get(key);
    }
    if (typeof actorOrRole === 'object') {
      return this.registerActor(actorOrRole);
    }
    return null;
  }

  /**
   * Starts or refreshes an actor's 3D curved racket ribbon trail on swing initiation.
   */
  startActorSwing(actor, { shotType = 'TOPSPIN', isPower = false, whipSpeed = 1.2, clearPrevious = true } = {}) {
    const trail = this.getRacketTrail(actor);
    if (!trail) return null;
    if (clearPrevious) {
      trail.clear();
    }
    trail.setStyle(shotType, isPower, whipSpeed);
    trail.fadeTimer = trail.maxFadeDuration;
    trail.activeSwing = true;

    // Immediately sample the current racket rim so the first frame of the swing is captured
    if (sampleActorRacketRimWorldPoints(actor, this._tmpVecA, this._tmpVecB)) {
      trail.pushRimSample(this._tmpVecA, this._tmpVecB, whipSpeed);
    }
    return trail;
  }

  /**
   * Seeds a complete 36-slice smooth Catmull-Rom 3D swing arc for an actor
   * (ideal for showcase boot states or replay freeze-frames).
   */
  seedActorSwingArc(actor, options = {}) {
    const trail = this.getRacketTrail(actor);
    if (!trail) return null;
    trail.seedSwingArcFromActor(actor, options);
    return trail;
  }

  clearAllTrails() {
    for (const trail of this.racketTrails.values()) {
      trail.clear();
    }
  }

  // --------------------------------------------------------------------------
  // 2. 2-Frame Hit-Stop (hitStopTimer) & Impact Juice Controller
  // --------------------------------------------------------------------------
  /**
   * Triggers a 2-frame Hit-Stop (`0.034s` for sweet-spot hits, or `0.048s` for
   * POWER SMASH / POWER SERVE) and attaches racket recoil vibration to the hitter.
   */
  triggerHitStop(durationOrPreset = 0.034, options = {}) {
    let duration = 0.034;
    if (typeof durationOrPreset === 'number') {
      duration = durationOrPreset;
    } else if (typeof durationOrPreset === 'string') {
      const p = durationOrPreset.toUpperCase();
      duration = p.includes('POWER') || p.includes('SMASH') ? 0.048 : 0.034;
    } else if (durationOrPreset && typeof durationOrPreset === 'object') {
      options = durationOrPreset;
    }

    if (options.isPower || options.isPowerServe || /^(SMASH|POWER)$/i.test(String(options.shotType || ''))) {
      duration = Math.max(duration, 0.048);
    }

    this.hitStopTimer = Math.max(this.hitStopTimer, duration);
    this.hitStopDuration = Math.max(0.001, this.hitStopTimer);
    this.hitStopIntensity = options.isPower ? 1.35 : 1.0;

    if (options.actor) {
      this.triggerRacketRecoil(options.actor, this.hitStopIntensity);
    }
    return this.hitStopTimer;
  }

  /**
   * Adds high-frequency string-recoil shimmer to the hitting actor's racket mesh
   * that vibrates at full speed even while `hitStopTimer` freezes world physics.
   */
  triggerRacketRecoil(actor, intensity = 1.0) {
    if (!actor) return;
    this.recoilStates.set(actor, {
      timer: 0.11,
      duration: 0.11,
      intensity: THREE.MathUtils.clamp(intensity, 0.5, 2.0),
      phase: 0,
    });
  }

  /**
   * Consumes `rawDt` against the active `hitStopTimer`.
   * Returns `0` while frozen so ball & character physics pause, or `rawDt` normally.
   * Usage in `game_engine.js`: `const dt = this.swingVfx.consumeHitStop(rawDt);`
   */
  consumeHitStop(rawDt) {
    const safeDt = Math.max(0, Number(rawDt) || 0);
    this._hitStopConsumedThisFrame = true;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - safeDt);
      return 0;
    }
    return safeDt;
  }

  isHitStopped() {
    return this.hitStopTimer > 0;
  }

  // --------------------------------------------------------------------------
  // 3. Ball Squash-and-Stretch Physics (Racket Contact & Turf Bounce)
  // --------------------------------------------------------------------------
  /**
   * Triggers damped harmonic squash-and-stretch deformation on the tennis ball.
   * - `'racket_hit'`: Compresses to `scale.set(1.42, 0.62, 1.42)` (relative to base
   *   scale `1.65`) oriented along velocity/normal, then springs back to `(1.65, 1.65, 1.65)`
   *   with `freq = 42 rad/s, damping = 14` over `0.18s`.
   * - `'court_bounce'`: Flattens vertically on the turf (`scale.set(1.32, 0.68, 1.32)`
   *   relative to base scale `1.65`) and springs back as it rises.
   */
  triggerBallDeformation(ball, type = 'racket_hit', normalVec = null, speed = 1.0) {
    if (!ball) return;
    const mesh = ball.mesh || (ball.isObject3D ? ball : null);
    const normType = String(type || 'racket_hit').toLowerCase();
    const isBounce = normType.includes('bounce') || normType.includes('turf') || normType.includes('court');

    const def = this.ballDeformation;
    def.active = true;
    def.ballRef = ball;
    def.type = isBounce ? 'court_bounce' : 'racket_hit';
    def.age = 0;
    def.duration = 0.18;
    def.freq = 42.0;
    def.damping = 14.0;
    def.baseScale = ball.baseScale || BASE_BALL_SCALE;

    const speedFactor = THREE.MathUtils.clamp(Number(speed || 1.0), 0.75, 1.45);

    if (isBounce) {
      // Flatten vertically on the grass: relative (1.32, 0.68, 1.32)
      def.initialSquashY = 0.68;
      def.initialExpandXZ = 1.32;
      def.axis.set(0, 1, 0);
    } else {
      // Compress against strings: relative (1.42, 0.62, 1.42)
      def.initialSquashY = THREE.MathUtils.clamp(1.0 - 0.38 * speedFactor, 0.54, 0.72);
      def.initialExpandXZ = THREE.MathUtils.clamp(1.0 + 0.42 * speedFactor, 1.28, 1.54);

      if (normalVec && normalVec.isVector3 && normalVec.lengthSq() > 1e-5) {
        def.axis.copy(normalVec).normalize();
      } else if (ball.vel && ball.vel.lengthSq() > 1e-5) {
        def.axis.copy(ball.vel).normalize();
      } else {
        def.axis.set(0, 0, -1);
      }
    }

    def.quat.setFromUnitVectors(UP_AXIS, def.axis);

    // Apply immediate t = 0 contact compression so the very first rendered frame
    // (including during the 2-frame hit-stop!) shows the ball flattened on the strings/turf.
    if (mesh) {
      const sY = def.baseScale * (isBounce ? 0.68 : 0.62);
      const sXZ = def.baseScale * (isBounce ? 1.32 : 1.42);
      mesh.scale.set(sXZ, sY, sXZ);
      if (!isBounce && def.axis.lengthSq() > 1e-4) {
        mesh.quaternion.copy(def.quat);
      }
    }

    ball.relativeDeformation = {
      x: isBounce ? 1.32 : 1.42,
      y: isBounce ? 0.68 : 0.62,
      z: isBounce ? 1.32 : 1.42,
    };
  }

  _updateBallDeformation(rawDt) {
    const def = this.ballDeformation;
    if (!def.active || !def.ballRef) return;

    const mesh = def.ballRef.mesh || (def.ballRef.isObject3D ? def.ballRef : null);
    def.age += rawDt;

    if (def.age >= def.duration) {
      def.active = false;
      if (mesh) {
        mesh.scale.set(def.baseScale, def.baseScale, def.baseScale);
      }
      def.ballRef.relativeDeformation = { x: 1.0, y: 1.0, z: 1.0 };
      return;
    }

    // Damped harmonic oscillator:
    // At t = 0: cos(0) = +1 -> ball is compressed (scaleY = initialSquashY, scaleXZ = initialExpandXZ).
    // At t ~ 0.075s: cos(pi) = -1 -> ball elongates along velocity vector as it launches!
    // By t = 0.18s: envelope exp(-14 * t) settles cleanly back to baseScale (1.65).
    const t = def.age;
    const envelope = Math.exp(-def.damping * t);
    const osc = Math.cos(def.freq * t);

    const ampY = 1.0 - def.initialSquashY; // e.g. 0.38 on racket_hit, 0.32 on court_bounce
    const ampXZ = def.initialExpandXZ - 1.0; // e.g. 0.42 on racket_hit, 0.32 on court_bounce

    const relY = 1.0 - ampY * envelope * osc;
    const relXZ = 1.0 + ampXZ * envelope * osc;

    if (mesh) {
      mesh.scale.set(def.baseScale * relXZ, def.baseScale * relY, def.baseScale * relXZ);
      if (def.type === 'racket_hit' && def.ballRef.vel && def.ballRef.vel.lengthSq() > 0.25) {
        this._tmpVecA.copy(def.ballRef.vel).normalize();
        this._tmpQuat.setFromUnitVectors(UP_AXIS, this._tmpVecA);
        mesh.quaternion.copy(this._tmpQuat);
      }
    }

    def.ballRef.relativeDeformation = { x: relXZ, y: relY, z: relXZ };
  }

  // --------------------------------------------------------------------------
  // 4. Cartoony Star / Spark Burst & Expanding Impact Shockwave Ring
  // --------------------------------------------------------------------------
  /**
   * Spawns at `worldPos`:
   *  - 1 Expanding 3D Impact Flash Ring (`0.12m -> 0.95m` in `0.16s`)
   *  - `12–24` 3D 5-Pointed Cartoon Stars (`createCartoonStarGeometry()`)
   *  - Radially stretched 3D Spark Streaks bursting outward with spin & gravity decay
   */
  spawnImpactBurst(worldPos, options = {}) {
    if (!worldPos || !this.scene) return;

    const opts = typeof options === 'number' ? { count: options } : options || {};
    const isPower = Boolean(opts.isPower);
    const shotType = String(opts.shotType || (isPower ? 'POWER' : 'TOPSPIN')).toUpperCase();
    const palette = getShotPalette(shotType, isPower);

    // 1. Spawn Expanding 3D Impact Shockwave Flash Ring (0.08m -> 0.36..0.45m in 0.16s)
    const ringSlot = this.impactRings.find((r) => !r.active) || this.impactRings[0];
    if (ringSlot) {
      ringSlot.active = true;
      ringSlot.age = 0;
      ringSlot.duration = opts.ringDuration || 0.16;
      ringSlot.startRadius = opts.startRadius || 0.08;
      ringSlot.endRadius = opts.endRadius || (isPower ? 0.45 : 0.36);

      ringSlot.group.position.copy(worldPos);
      ringSlot.group.scale.setScalar(ringSlot.startRadius);

      if (opts.normal && opts.normal.isVector3 && opts.normal.lengthSq() > 1e-4) {
        this._tmpVecA.copy(worldPos).add(opts.normal);
        ringSlot.group.lookAt(this._tmpVecA);
      } else if (this.camera) {
        ringSlot.group.lookAt(this.camera.position);
      } else {
        ringSlot.group.rotation.set(0, 0, 0);
      }

      ringSlot.ringMat.color.copy(palette.ringColor);
      ringSlot.ringMat.opacity = 0.55;
      ringSlot.coreMat.color.setHex(0xffffff);
      ringSlot.coreMat.opacity = 0.42;
      ringSlot.group.visible = true;
    }

    // 2. Spawn 12–24 3D 5-Pointed Cartoon Stars
    const requestedCount = opts.count ?? (isPower ? 20 : 14);
    const starCount = THREE.MathUtils.clamp(requestedCount, 12, 24);
    const starColors = palette.starColors;

    const baseDir =
      opts.normal && opts.normal.isVector3 && opts.normal.lengthSq() > 1e-4
        ? this._tmpVecA.copy(opts.normal).normalize()
        : this._tmpVecA.set(0, 0.25, -1).normalize();

    let starsSpawned = 0;
    for (let i = 0; i < this.starParticles.length && starsSpawned < starCount; i++) {
      const s = this.starParticles[i];
      if (s.active && i < this.starParticles.length - starCount) continue;

      s.active = true;
      s.age = 0;
      s.maxAge = (isPower ? 0.36 : 0.30) + Math.random() * 0.18;
      s.baseScale = (isPower ? 1.05 : 0.88) + Math.random() * 0.52;
      s.gravity = 6.2 + Math.random() * 2.4;

      const angle = (starsSpawned / starCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const radialSpeed = (isPower ? 2.8 : 2.1) + Math.random() * 2.6;
      const forwardBoost = (isPower ? 1.8 : 1.1) + Math.random() * 1.4;

      s.vel.set(
        Math.cos(angle) * radialSpeed + baseDir.x * forwardBoost,
        Math.sin(angle) * radialSpeed * 0.85 + 1.15 + Math.random() * 1.4,
        (Math.random() - 0.5) * radialSpeed + baseDir.z * forwardBoost * 0.65
      );

      s.rotVel.set(
        (Math.random() - 0.5) * 14.0,
        (Math.random() - 0.5) * 16.0,
        (Math.random() - 0.5) * 18.0
      );

      s.mesh.position.copy(worldPos);
      s.mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      s.mesh.scale.setScalar(s.baseScale);
      s.mat.color.setHex(starColors[starsSpawned % starColors.length]);
      s.mat.opacity = 1.0;
      s.mesh.visible = true;
      starsSpawned++;
    }

    // 3. Spawn Radial Spark Streaks (8–14 fast elongated streaks aligned with velocity)
    const streakCount = isPower ? 14 : 9;
    let streaksSpawned = 0;
    for (let i = 0; i < this.sparkStreaks.length && streaksSpawned < streakCount; i++) {
      const st = this.sparkStreaks[i];
      if (st.active && i < this.sparkStreaks.length - streakCount) continue;

      st.active = true;
      st.age = 0;
      st.maxAge = 0.16 + Math.random() * 0.10;
      st.baseScale = (isPower ? 1.25 : 0.95) + Math.random() * 0.45;

      const theta = (streaksSpawned / streakCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const spd = (isPower ? 5.2 : 3.8) + Math.random() * 3.2;

      st.vel.set(
        Math.cos(theta) * spd + baseDir.x * 1.6,
        Math.sin(theta) * spd * 0.85 + 0.6,
        (Math.random() - 0.5) * spd * 0.7 + baseDir.z * 1.2
      );

      st.mesh.position.copy(worldPos);
      this._tmpVecB.copy(st.vel).normalize();
      st.mesh.quaternion.setFromUnitVectors(UP_AXIS, this._tmpVecB);
      st.mesh.scale.set(st.baseScale, st.baseScale * 1.35, st.baseScale);

      st.mat.color.setHex(
        streaksSpawned % 2 === 0 ? 0xffffff : starColors[streaksSpawned % starColors.length]
      );
      st.mat.opacity = 0.98;
      st.mesh.visible = true;
      streaksSpawned++;
    }
  }

  /**
   * Drop-in alias for `_spawnStarBurst(pos, count)`.
   */
  spawnStarBurst(worldPos, count = 14, options = {}) {
    this.spawnImpactBurst(worldPos, { ...options, count });
  }

  /**
   * Spawns an expanding white turf ring on ball bounce and optionally triggers
   * `'court_bounce'` vertical ball squash-and-stretch.
   */
  spawnTurfBounce(x, z, ball = null, impactSpeed = 1.0) {
    const slot = this.turfBounceRings.find((r) => !r.active) || this.turfBounceRings[0];
    if (slot) {
      slot.active = true;
      slot.age = 0;
      slot.mesh.position.set(x, 0.025, z);
      slot.mesh.scale.setScalar(0.58);
      slot.mat.opacity = 0.92;
      slot.mesh.visible = true;
    }

    if (ball) {
      this.triggerBallDeformation(ball, 'court_bounce', UP_AXIS, impactSpeed);
    }
  }

  /**
   * Unified Racket-Ball Contact handler that triggers all 4 polish layers in one call:
   *  1. Updates hitter's `RacketRibbonTrail` shot palette & whip boost
   *  2. Triggers 2-frame Hit-Stop (`0.034s` sweet-spot / `0.048s` power smash/serve) + racket recoil
   *  3. Triggers `'racket_hit'` ball squash-and-stretch (`(1.42, 0.62, 1.42)` -> `(1.65, 1.65, 1.65)`)
   *  4. Spawns expanding 3D impact shockwave ring (`0.12m -> 0.95m`) + `12–24` 5-pointed stars & spark streaks
   */
  onRacketContact({
    actor = null,
    ball = null,
    contactPos = null,
    shotType = 'TOPSPIN',
    timingClass = 'PERFECT',
    isPower = false,
    whipSpeed = 1.25,
    normalVec = null,
  } = {}) {
    const pos = contactPos || (ball && ball.pos) || (actor && actor.pos) || null;
    const isSweetSpot =
      isPower ||
      timingClass === 'PERFECT' ||
      /^(SMASH|POWER)$/i.test(String(shotType || ''));

    // 1. Style & boost actor's curved 3D racket ribbon trail
    if (actor) {
      const trail = this.getRacketTrail(actor);
      if (trail) {
        trail.setStyle(shotType, isPower, whipSpeed);
        trail.fadeTimer = trail.maxFadeDuration;
      }
      this.triggerRacketRecoil(actor, isPower ? 1.4 : 1.0);
    }

    // 2. Trigger 2-Frame Hit-Stop for sweet-spot hits, power serves, and smashes
    if (isSweetSpot) {
      const freezeSec = isPower || /^(SMASH|POWER)$/i.test(String(shotType || '')) ? 0.048 : 0.034;
      this.triggerHitStop(freezeSec, { actor, shotType, isPower });
    }

    // 3. Ball Squash-and-Stretch along launch velocity / contact normal
    if (ball) {
      const dir = normalVec || (ball.vel && ball.vel.lengthSq() > 0.01 ? ball.vel : null);
      this.triggerBallDeformation(ball, 'racket_hit', dir, isPower ? 1.25 : 1.0);
    }

    // 4. Expanding Impact Flash Ring + 5-Pointed Cartoon Stars + Radial Spark Streaks
    if (pos) {
      this.spawnImpactBurst(pos, {
        shotType,
        isPower,
        count: isPower ? 22 : isSweetSpot ? 16 : 12,
        normal: normalVec || (ball && ball.vel ? ball.vel : null),
      });
    }
  }

  // --------------------------------------------------------------------------
  // Frame Update Loop (advances trails, shockwave rings, stars, streaks & ball spring)
  // --------------------------------------------------------------------------
  update(rawDt, context = {}) {
    const dt = Math.max(0, Number(rawDt) || 0);
    if (context.camera) {
      this.camera = context.camera;
    }

    // If caller did not invoke consumeHitStop(rawDt) separately this frame,
    // decrement hitStopTimer here so it can never get stuck.
    if (!this._hitStopConsumedThisFrame && this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
    }
    this._hitStopConsumedThisFrame = false;

    // 1. Update all registered actors' curved 3D racket ribbon trails
    if (Array.isArray(context.actors)) {
      for (const actor of context.actors) {
        if (actor && !this.racketTrails.has(actor.role || actor)) {
          this.registerActor(actor);
        }
      }
    }
    for (const [key, trail] of this.racketTrails.entries()) {
      const actor = this.actorsByRole.get(key);
      if (actor) {
        trail.updateForActor(actor, dt);
      }
    }

    // 2. Update Racket String Recoil Micro-Shimmer (runs at full speed during hit-stop!)
    for (const [actor, rec] of this.recoilStates.entries()) {
      rec.timer -= dt;
      if (rec.timer <= 0) {
        if (actor.racketMesh) {
          actor.racketMesh.rotation.z = 0.0;
        }
        this.recoilStates.delete(actor);
      } else if (actor.racketMesh) {
        rec.phase += dt * 190.0; // High-frequency string vibration
        const decay = rec.timer / rec.duration;
        const shimmer = Math.sin(rec.phase) * 0.085 * rec.intensity * decay;
        actor.racketMesh.rotation.z = shimmer;
      }
    }

    // 3. Update Ball Squash-and-Stretch Damped Harmonic Oscillator
    if (context.ball && !this.ballDeformation.ballRef) {
      this.ballDeformation.ballRef = context.ball;
    }
    this._updateBallDeformation(dt);

    // 4a. Update 3D Expanding Impact Flash Rings (0.12m -> 0.95m in 0.16s)
    for (let i = 0; i < this.impactRings.length; i++) {
      const r = this.impactRings[i];
      if (!r.active) continue;
      r.age += dt;
      const u = r.age / r.duration;
      if (u >= 1.0) {
        r.active = false;
        r.group.visible = false;
      } else {
        // Fast ease-out expansion
        const ease = 1.0 - Math.pow(1.0 - u, 2.2);
        const radius = THREE.MathUtils.lerp(r.startRadius, r.endRadius, ease);
        r.group.scale.setScalar(radius);
        if (this.camera) {
          r.group.lookAt(this.camera.position);
        }
        r.ringMat.opacity = (1.0 - u) * 0.55;
        r.coreMat.opacity = Math.max(0, 1.0 - u * 2.5) * 0.42;
      }
    }

    // 4b. Update 3D 5-Pointed Cartoon Stars (with spin & gravity decay)
    for (let i = 0; i < this.starParticles.length; i++) {
      const s = this.starParticles[i];
      if (!s.active) continue;
      s.age += dt;
      const u = s.age / s.maxAge;
      if (u >= 1.0) {
        s.active = false;
        s.mesh.visible = false;
      } else {
        s.vel.y -= s.gravity * dt;
        s.vel.multiplyScalar(Math.max(0, 1.0 - 1.8 * dt));
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.rotation.x += s.rotVel.x * dt;
        s.mesh.rotation.y += s.rotVel.y * dt;
        s.mesh.rotation.z += s.rotVel.z * dt;

        // Pop-in then smooth shrink
        const popScale = u < 0.15 ? 0.7 + (u / 0.15) * 0.45 : 1.15 * (1.0 - (u - 0.15) * 0.78);
        s.mesh.scale.setScalar(Math.max(0.05, s.baseScale * popScale));
        s.mat.opacity = 1.0 - Math.pow(u, 1.4);
      }
    }

    // 4c. Update Radial Spark Streaks
    for (let i = 0; i < this.sparkStreaks.length; i++) {
      const st = this.sparkStreaks[i];
      if (!st.active) continue;
      st.age += dt;
      const u = st.age / st.maxAge;
      if (u >= 1.0) {
        st.active = false;
        st.mesh.visible = false;
      } else {
        st.vel.y -= 3.5 * dt;
        st.mesh.position.addScaledVector(st.vel, dt);
        if (st.vel.lengthSq() > 1e-4) {
          this._tmpVecB.copy(st.vel).normalize();
          st.mesh.quaternion.setFromUnitVectors(UP_AXIS, this._tmpVecB);
        }
        const stretch = (1.0 - u * 0.65) * st.baseScale;
        st.mesh.scale.set(stretch * 0.7, stretch * 1.45, stretch * 0.7);
        st.mat.opacity = (1.0 - u) * 0.95;
      }
    }

    // 4d. Update Court Turf Bounce Rings
    for (let i = 0; i < this.turfBounceRings.length; i++) {
      const b = this.turfBounceRings[i];
      if (!b.active) continue;
      b.age += dt;
      const u = b.age / b.duration;
      if (u >= 1.0) {
        b.active = false;
        b.mesh.visible = false;
      } else {
        b.mesh.scale.setScalar(0.58 + u * 2.45);
        b.mat.opacity = (1.0 - u) * 0.88;
      }
    }
  }
}

export default SwingVFXManager;
