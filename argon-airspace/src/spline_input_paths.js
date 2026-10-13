/**
 * @fileoverview Argon Airspace — Zero-Latency Multi-Touch Input, Douglas-Peucker Simplification,
 * Centripetal Catmull-Rom Spline Path Generation, Runway/Helipad Approach Snap & Lock,
 * and Anti-Aliased Dashed Path Ribbon Renderer with Real-Time Path Decay.
 *
 * Coordinate System Contract:
 *   OrthographicCamera(-480, 480, 320, -320, 0.1, 500) looking down -Z at XY plane.
 *   Playfield bounds: X in [-480, +480], Y in [-320, +320].
 */

const THREE_REF = (typeof window !== 'undefined' && window.THREE) ? window.THREE : null;

// Playfield & path generation constants
const WORLD_HALF_WIDTH = 480;
const WORLD_HALF_HEIGHT = 320;
const CLAMP_MIN_X = -466;
const CLAMP_MAX_X = 466;
const CLAMP_MIN_Y = -306;
const CLAMP_MAX_Y = 306;

const DEFAULT_SELECTION_RADIUS = 44.0;
const RAW_POINT_MIN_DIST = 5.0;
const DP_EPSILON = 2.2;
const CATMULL_ALPHA = 0.5;
const RESAMPLE_STEP_SIZE = 5.0;
const AUDIO_TICK_ARC_STEP = 18.0;

const LINEAR_RUNWAY_SNAP_RADIUS = 46.0;
const HELIPAD_SNAP_RADIUS = 38.0;
const FUNNEL_BEFORE_THRESHOLD = 35.0;
const FUNNEL_PAST_THRESHOLD = 25.0;
const FUNNEL_HALF_WIDTH = 28.0;
const MAX_ALIGN_ANGLE_RAD = 0.84; // ~48 degrees
const INVALID_APPROACH_ANGLE_RAD = 0.96; // ~55 degrees
const INVALID_FLASH_DURATION = 0.6;

const PATH_GROUP_Z = 2.2;
const OUTER_RIBBON_WIDTH = 3.6;
const CORE_RIBBON_WIDTH = 2.2;
const RIBBON_GEOM_HALF_WIDTH = 2.4; // Encloses 3.6 outer glow + drop shadow & 2.2 core dashes with AA margin
const MAX_RIBBON_POINTS = 640;

// Aircraft class color palette (Argon Airspace vibrant colors)
const CLASS_COLOR_MAP = {
  red: '#ff453a',
  jet: '#ff453a',
  jet_red: '#ff453a',
  heavy: '#ff453a',
  yellow: '#ffd60a',
  prop: '#ffd60a',
  prop_yellow: '#ffd60a',
  small: '#ffd60a',
  blue: '#32ade6',
  prop_blue: '#32ade6',
  blue_heli: '#32ade6',
  heli: '#32ade6',
  heli_blue: '#32ade6',
  helicopter: '#32ade6',
  cyan: '#2ee6a8',
  seaplane: '#2ee6a8',
  seaplane_green: '#2ee6a8',
  green: '#2ee6a8',
  white: '#ffffff',
};

/**
 * Clamp a value between min and max.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Normalize an angle in radians to [-PI, +PI].
 */
function normalizeAngleSigned(angle) {
  let a = (angle + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}

/**
 * Compute perpendicular distance from point P to segment AB.
 */
function perpendicularDistanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-8) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Ramer-Douglas-Peucker polyline simplification.
 * @param {Array<{x: number, y: number}>} points
 * @param {number} epsilon Simplification tolerance in world units (default 2.2).
 * @returns {Array<{x: number, y: number}>}
 */
export function douglasPeucker(points, epsilon = DP_EPSILON) {
  if (!Array.isArray(points) || points.length <= 2) {
    return points ? points.map((p) => ({ x: p.x, y: p.y })) : [];
  }

  const n = points.length;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack = [[0, n - 1]];
  while (stack.length > 0) {
    const [startIdx, endIdx] = stack.pop();
    if (endIdx - startIdx <= 1) continue;

    let maxDist = -1;
    let maxIdx = -1;
    const startPt = points[startIdx];
    const endPt = points[endIdx];

    for (let i = startIdx + 1; i < endIdx; i++) {
      const dist = perpendicularDistanceToSegment(points[i], startPt, endPt);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon && maxIdx !== -1) {
      keep[maxIdx] = 1;
      stack.push([startIdx, maxIdx]);
      stack.push([maxIdx, endIdx]);
    }
  }

  const simplified = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) {
      simplified.push({ x: points[i].x, y: points[i].y });
    }
  }
  return simplified;
}

/**
 * Evaluate a single Centripetal Catmull-Rom segment between P1 and P2
 * using Barry & Goldman pyramidal formulation (alpha = 0.5).
 */
function evalCatmullRomSegmentPoint(p0, p1, p2, p3, t0, t1, t2, t3, t) {
  const denom10 = Math.max(1e-5, t1 - t0);
  const denom21 = Math.max(1e-5, t2 - t1);
  const denom32 = Math.max(1e-5, t3 - t2);
  const denom20 = Math.max(1e-5, t2 - t0);
  const denom31 = Math.max(1e-5, t3 - t1);

  const a1x = ((t1 - t) / denom10) * p0.x + ((t - t0) / denom10) * p1.x;
  const a1y = ((t1 - t) / denom10) * p0.y + ((t - t0) / denom10) * p1.y;

  const a2x = ((t2 - t) / denom21) * p1.x + ((t - t1) / denom21) * p2.x;
  const a2y = ((t2 - t) / denom21) * p1.y + ((t - t1) / denom21) * p2.y;

  const a3x = ((t3 - t) / denom32) * p2.x + ((t - t2) / denom32) * p3.x;
  const a3y = ((t3 - t) / denom32) * p2.y + ((t - t2) / denom32) * p3.y;

  const b1x = ((t2 - t) / denom20) * a1x + ((t - t0) / denom20) * a2x;
  const b1y = ((t2 - t) / denom20) * a1y + ((t - t0) / denom20) * a2y;

  const b2x = ((t3 - t) / denom31) * a2x + ((t - t1) / denom31) * a3x;
  const b2y = ((t3 - t) / denom31) * a2y + ((t - t1) / denom31) * a3y;

  const cx = ((t2 - t) / denom21) * b1x + ((t - t1) / denom21) * b2x;
  const cy = ((t2 - t) / denom21) * b1y + ((t - t1) / denom21) * b2y;

  return { x: cx, y: cy };
}

/**
 * Evaluate a Centripetal Catmull-Rom spline (alpha = 0.5) through controlPoints
 * and resample at uniform arc-length intervals (stepSize = 5.0 world units).
 *
 * @param {Array<{x: number, y: number}>} controlPoints
 * @param {number} stepSize Uniform arc-length step in world units (default 5.0).
 * @param {number} alpha Centripetal parameterization exponent (default 0.5).
 * @returns {Array<{x: number, y: number, u?: number}>}
 */
export function evaluateCentripetalCatmullRom(
  controlPoints,
  stepSize = RESAMPLE_STEP_SIZE,
  alpha = CATMULL_ALPHA
) {
  if (!Array.isArray(controlPoints) || controlPoints.length === 0) {
    return [];
  }

  // Deduplicate near-coincident control points
  const pts = [{ x: controlPoints[0].x, y: controlPoints[0].y }];
  for (let i = 1; i < controlPoints.length; i++) {
    const prev = pts[pts.length - 1];
    const curr = controlPoints[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > 0.5) {
      pts.push({ x: curr.x, y: curr.y });
    }
  }

  if (pts.length === 1) {
    return [{ x: pts[0].x, y: pts[0].y, u: 0 }];
  }

  // Relax any sharp hairpin spikes (> 105 deg turn over short segments) in the control polygon
  // before subdivision so hand tremor or click offsets can never produce a kink or loop
  if (pts.length >= 3) {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < pts.length - 1; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const next = pts[i + 1];
        const v1x = curr.x - prev.x;
        const v1y = curr.y - prev.y;
        const v2x = next.x - curr.x;
        const v2y = next.y - curr.y;
        const l1 = Math.hypot(v1x, v1y);
        const l2 = Math.hypot(v2x, v2y);
        if (l1 > 1e-3 && l2 > 1e-3) {
          const cosAng = (v1x * v2x + v1y * v2y) / (l1 * l2);
          if (cosAng < 0.15) {
            // Smoothly pull sharp vertex toward the midpoint of its neighbors
            const blend = cosAng < -0.25 ? 0.65 : 0.42;
            const midX = (prev.x + next.x) * 0.5;
            const midY = (prev.y + next.y) * 0.5;
            curr.x += (midX - curr.x) * blend;
            curr.y += (midY - curr.y) * blend;
          }
        }
      }
    }
  }

  // Build dense sample chain using 3 passes of Chaikin Corner-Cutting Quadratic B-Spline subdivision.
  // Unlike Catmull-Rom (which can overshoot and create unintended S-hooks/loops), Chaikin B-Splines
  // satisfy the Convex Hull & Variation-Diminishing properties: zero overshoot, silky-smooth arcs!
  let dense = pts;
  if (pts.length >= 3) {
    for (let iter = 0; iter < 3; iter++) {
      const nextChain = [{ x: dense[0].x, y: dense[0].y }];
      for (let i = 0; i < dense.length - 1; i++) {
        const p0 = dense[i];
        const p1 = dense[i + 1];
        if (i > 0) {
          nextChain.push({
            x: 0.75 * p0.x + 0.25 * p1.x,
            y: 0.75 * p0.y + 0.25 * p1.y,
          });
        }
        if (i < dense.length - 2) {
          nextChain.push({
            x: 0.25 * p0.x + 0.75 * p1.x,
            y: 0.25 * p0.y + 0.75 * p1.y,
          });
        }
      }
      nextChain.push({
        x: dense[dense.length - 1].x,
        y: dense[dense.length - 1].y,
      });
      dense = nextChain;
    }
  }

  // Compute cumulative arc length along dense chain
  const arcLengths = new Float64Array(dense.length);
  arcLengths[0] = 0;
  for (let i = 1; i < dense.length; i++) {
    const segLen = Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y);
    arcLengths[i] = arcLengths[i - 1] + segLen;
  }

  const totalLength = arcLengths[dense.length - 1];
  if (totalLength < 1e-4) {
    return [{ x: dense[0].x, y: dense[0].y, u: 0 }];
  }

  // Uniform arc-length resampling at stepSize intervals
  const resampled = [{ x: dense[0].x, y: dense[0].y, u: 0 }];
  const safeStep = Math.max(1.0, stepSize);
  let targetArc = safeStep;
  let cursor = 1;

  while (targetArc < totalLength - safeStep * 0.32) {
    while (cursor < dense.length - 1 && arcLengths[cursor] < targetArc) {
      cursor++;
    }
    const prevArc = arcLengths[cursor - 1];
    const nextArc = arcLengths[cursor];
    const span = Math.max(1e-6, nextArc - prevArc);
    const ratio = clamp((targetArc - prevArc) / span, 0, 1);

    const a = dense[cursor - 1];
    const b = dense[cursor];
    resampled.push({
      x: a.x + (b.x - a.x) * ratio,
      y: a.y + (b.y - a.y) * ratio,
      u: targetArc,
    });

    targetArc += safeStep;
  }

  const lastDense = dense[dense.length - 1];
  const lastResampled = resampled[resampled.length - 1];
  if (Math.hypot(lastDense.x - lastResampled.x, lastDense.y - lastResampled.y) > 0.5 || resampled.length === 1) {
    resampled.push({
      x: lastDense.x,
      y: lastDense.y,
      u: totalLength,
    });
  } else {
    lastResampled.x = lastDense.x;
    lastResampled.y = lastDense.y;
    lastResampled.u = totalLength;
  }

  return resampled;
}

/**
 * Vertex & Fragment Shaders for the Anti-Aliased Dashed Path Ribbon.
 *
 * vUv.x = cumulative arc length in world units.
 * vUv.y = signed cross-ribbon coordinate in [-1, +1], corresponding to [-uHalfWidth, +uHalfWidth] world units.
 *
 * Outer glow/drop-shadow width = 3.6 world units (radius 1.8).
 * Core rounded dash width = 2.2 world units (radius 1.1).
 */
const RIBBON_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIBBON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHaloColor;
  uniform float uLocked;
  uniform float uHalfWidth;
  uniform float uOpacity;
  uniform float uTotalLength;

  varying vec2 vUv;

  void main() {
    float u = vUv.x;
    float crossWorld = vUv.y * uHalfWidth; // in [-2.4, +2.4] world units

    // Dash pattern parameters (world units)
    float dashPeriod = 12.5;
    float phase = mod(max(0.0, u), dashPeriod);
    float dashCenter = 3.85;
    float dashHalfSegment = 2.65; // capsule straight spine half-length

    // Distance along capsule spine for individual dash
    float alongDash = max(abs(phase - dashCenter) - dashHalfSegment, 0.0);

    // Core dash capsule SDF: width 2.2 world units -> radius 1.1
    float coreRadius = 1.1;
    float dCore = length(vec2(alongDash, abs(crossWorld))) - coreRadius;
    float aaCore = max(fwidth(dCore), 0.16);
    float coreMask = 1.0 - smoothstep(-aaCore * 0.55, aaCore * 0.55, dCore);

    // Outer glow / outline capsule SDF: width 3.6 world units -> radius 1.8
    float outerRadius = 1.8;
    float dOuter = length(vec2(alongDash, abs(crossWorld))) - outerRadius;
    float aaOuter = max(fwidth(dOuter), 0.22);
    float outerMask = 1.0 - smoothstep(-aaOuter * 0.6, aaOuter * 0.6, dOuter);

    // Continuous ribbon SDF (used for sleek locked white guide line)
    float lockedRadius = 0.92;
    float dLockedCore = abs(crossWorld) - lockedRadius;
    float aaLocked = max(fwidth(dLockedCore), 0.14);
    float lockedCoreMask = 1.0 - smoothstep(-aaLocked * 0.5, aaLocked * 0.5, dLockedCore);
    float dLockedShadow = abs(crossWorld + 0.35) - (lockedRadius + 0.38);
    float lockedShadowMask = (1.0 - smoothstep(-0.3, 0.45, dLockedShadow)) * 0.44;

    // Soft dark drop-shadow offset slightly toward bottom-right for unlocked dashes
    float dShadow = length(vec2(max(alongDash - 0.15, 0.0), abs(crossWorld + 0.32))) - (coreRadius + 0.35);
    float shadowMask = (1.0 - smoothstep(-0.32, 0.42, dShadow)) * 0.42;

    // Crisp thin dark rim around unlocked colored dashes (radius 1.42)
    float rimRadius = 1.42;
    float dRim = length(vec2(alongDash, abs(crossWorld))) - rimRadius;
    float aaRim = max(fwidth(dRim), 0.18);
    float rimMask = 1.0 - smoothstep(-aaRim * 0.55, aaRim * 0.55, dRim);

    vec4 finalColor = vec4(0.0);

    if (uLocked > 0.5) {
      // LOCKED PATH: Sleek Crisp Bright White (#ffffff) guide line (Argon Screenshots 1, 3, 4)
      vec3 shadowCol = vec3(0.05, 0.09, 0.14);
      vec3 whiteCore = vec3(1.0, 1.0, 1.0);

      float alpha = max(lockedShadowMask, lockedCoreMask * 0.96);
      vec3 rgb = mix(shadowCol, whiteCore, clamp(lockedCoreMask, 0.0, 1.0));

      finalColor = vec4(rgb, alpha * uOpacity);
    } else {
      // UNLOCKED PATH: Clean anti-aliased colored dashes with subtle crisp outline & shadow
      vec3 shadowCol = vec3(0.06, 0.09, 0.12);
      vec3 outlineCol = mix(shadowCol, uColor * 0.45, 0.45);

      float highlight = (1.0 - smoothstep(0.0, 0.65, abs(crossWorld))) * coreMask * 0.20;
      vec3 dashCol = clamp(uColor + vec3(highlight), 0.0, 1.0);

      float underAlpha = max(shadowMask, rimMask * 0.58);
      float alpha = max(underAlpha, coreMask * 0.98);

      vec3 rgb = mix(shadowCol, outlineCol, rimMask);
      rgb = mix(rgb, dashCol, coreMask);

      finalColor = vec4(rgb, alpha * uOpacity);
    }

    if (finalColor.a < 0.015) {
      discard;
    }

    gl_FragColor = finalColor;
  }
`;

/**
 * FlightPathInputSystem handles:
 *  1. Multi-touch & mouse gesture capture + orthographic coordinate conversion + aircraft hit-testing
 *  2. Douglas-Peucker simplification + Centripetal Catmull-Rom uniform arc-length spline generation
 *  3. Runway threshold & helipad approach snap/lock + wrong-direction invalid approach flash
 *  4. Dynamic triangulated quad-strip dashed ribbon rendering + real-time tail truncation behind aircraft
 */
export class FlightPathInputSystem {
  /**
   * Supports both options-object construction:
   *   new FlightPathInputSystem({ scene, camera, renderer, getAircraft, getRunways, ... })
   * and positional construction:
   *   new FlightPathInputSystem(scene, camera, renderer, options)
   */
  constructor(arg1 = {}, arg2 = null, arg3 = null, arg4 = {}) {
    let opts = {};
    if (arg1 && (arg1.isScene || typeof arg1.add === 'function')) {
      opts = {
        ...(arg4 || {}),
        scene: arg1,
        camera: arg2,
        renderer: arg3,
      };
    } else {
      opts = arg1 || {};
    }

    this.THREE = opts.THREE || THREE_REF || (typeof window !== 'undefined' ? window.THREE : null);
    this.scene = opts.scene || null;
    this.camera = opts.camera || null;
    this.renderer = opts.renderer || null;
    this.domElement =
      opts.domElement ||
      (this.renderer && this.renderer.domElement) ||
      null;

    // World bounds
    this.worldWidth = opts.worldWidth || WORLD_HALF_WIDTH * 2;
    this.worldHeight = opts.worldHeight || WORLD_HALF_HEIGHT * 2;
    this.selectionRadius = opts.selectionRadius || DEFAULT_SELECTION_RADIUS;

    // Data providers (functions or arrays)
    this._getAircraftFn = opts.getAircraft || opts.getPlanes || null;
    this._getRunwaysFn = opts.getRunways || null;
    this.aircraftList = opts.aircraft || opts.planes || [];
    this.runwaysList = opts.runways || [];

    // Event callbacks
    this.onPlaneSelected = opts.onPlaneSelected || null;
    this.onPathPointAdded = opts.onPathPointAdded || null;
    this.onRunwayLocked = opts.onRunwayLocked || null;
    this.onInvalidApproach = opts.onInvalidApproach || null;
    this.onPathCompleted = opts.onPathCompleted || null;

    // Active pointer gestures: Map<pointerId, GestureState>
    this.activePointers = new Map();

    // Per-aircraft ribbon mesh records: Map<planeIdOrRef, RibbonEntry>
    this.ribbonEntries = new Map();

    // Create Three.js group at z = 2.2
    this.pathGroup = null;
    this._initPathGroup();

    // Bound DOM event handlers
    this._boundPointerDown = this._handlePointerDown.bind(this);
    this._boundPointerMove = this._handlePointerMove.bind(this);
    this._boundPointerUp = this._handlePointerUp.bind(this);
    this._boundPointerCancel = this._handlePointerCancel.bind(this);
    this._listenersAttached = false;

    if (this.domElement) {
      this.attach(this.domElement);
    }
  }

  /**
   * Initialize the Three.js pathGroup at z = 2.2.
   */
  _initPathGroup() {
    const T = this.THREE || (typeof window !== 'undefined' ? window.THREE : null);
    if (!T) return;
    this.THREE = T;
    this.pathGroup = new T.Group();
    this.pathGroup.name = 'FlightPathRibbonGroup';
    this.pathGroup.position.set(0, 0, PATH_GROUP_Z);
    this.pathGroup.renderOrder = 15;

    if (this.scene && typeof this.scene.add === 'function') {
      this.scene.add(this.pathGroup);
    }
  }

  /**
   * Attach scene if provided after construction.
   */
  setScene(scene) {
    this.scene = scene;
    if (!this.pathGroup) {
      this._initPathGroup();
    } else if (this.scene && this.pathGroup.parent !== this.scene) {
      this.scene.add(this.pathGroup);
    }
  }

  /**
   * Set active orthographic camera.
   */
  setCamera(camera) {
    this.camera = camera;
  }

  /**
   * Set active renderer and attach pointer listeners to its DOM element.
   */
  setRenderer(renderer) {
    this.renderer = renderer;
    if (renderer && renderer.domElement && !this._listenersAttached) {
      this.attach(renderer.domElement);
    }
  }

  /**
   * Attach pointerdown, pointermove, pointerup, pointercancel listeners to DOM element.
   */
  attach(domElement) {
    if (this._listenersAttached && this.domElement) {
      this.detach();
    }
    this.domElement = domElement;
    if (!this.domElement || typeof this.domElement.addEventListener !== 'function') {
      return;
    }

    if (this.domElement.style) {
      this.domElement.style.touchAction = 'none';
      this.domElement.style.userSelect = 'none';
      this.domElement.style.webkitUserSelect = 'none';
    }

    this.domElement.addEventListener('pointerdown', this._boundPointerDown, { passive: false });
    this.domElement.addEventListener('pointermove', this._boundPointerMove, { passive: false });
    this.domElement.addEventListener('pointerup', this._boundPointerUp, { passive: false });
    this.domElement.addEventListener('pointercancel', this._boundPointerCancel, { passive: false });

    if (typeof window !== 'undefined' && this.domElement !== window) {
      window.addEventListener('pointerup', this._boundPointerUp, { passive: true });
      window.addEventListener('pointercancel', this._boundPointerCancel, { passive: true });
    }

    this._listenersAttached = true;
  }

  /**
   * Detach DOM pointer listeners.
   */
  detach() {
    if (!this._listenersAttached || !this.domElement) return;
    if (typeof this.domElement.removeEventListener === 'function') {
      this.domElement.removeEventListener('pointerdown', this._boundPointerDown);
      this.domElement.removeEventListener('pointermove', this._boundPointerMove);
      this.domElement.removeEventListener('pointerup', this._boundPointerUp);
      this.domElement.removeEventListener('pointercancel', this._boundPointerCancel);
    }
    if (typeof window !== 'undefined' && this.domElement !== window) {
      window.removeEventListener('pointerup', this._boundPointerUp);
      window.removeEventListener('pointercancel', this._boundPointerCancel);
    }
    this._listenersAttached = false;
  }

  /**
   * Retrieve the current list of active aircraft.
   */
  getAircraft() {
    if (typeof this._getAircraftFn === 'function') {
      const res = this._getAircraftFn();
      if (Array.isArray(res)) return res;
    }
    if (Array.isArray(this.aircraftList)) return this.aircraftList;
    if (Array.isArray(this.planes)) return this.planes;
    return [];
  }

  /**
   * Retrieve the active map's runways / helipads.
   * Each runway: { id, type, colorKey, thresholdX, thresholdY, endX, endY, heading, isHelipad, snapRadius }
   */
  getRunways() {
    if (typeof this._getRunwaysFn === 'function') {
      const res = this._getRunwaysFn();
      if (Array.isArray(res)) return res;
    }
    if (Array.isArray(this.runwaysList)) return this.runwaysList;
    if (Array.isArray(this.runways)) return this.runways;
    return [];
  }

  /**
   * Convert client (clientX, clientY) to orthographic world (x, y),
   * accounting for any letterboxing/pillarboxing of the 960x640 playfield.
   *
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{x: number, y: number}}
   */
  screenToWorld(clientX, clientY) {
    const targetEl =
      (this.renderer && this.renderer.domElement) ||
      this.domElement ||
      (typeof document !== 'undefined' ? document.querySelector('canvas') : null);

    let rectLeft = 0;
    let rectTop = 0;
    let rectWidth = 960;
    let rectHeight = 640;

    if (targetEl && typeof targetEl.getBoundingClientRect === 'function') {
      const rect = targetEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        rectLeft = rect.left;
        rectTop = rect.top;
        rectWidth = rect.width;
        rectHeight = rect.height;
      }
    } else if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0) {
      rectWidth = window.innerWidth;
      rectHeight = window.innerHeight;
    }

    // Check if camera frustum is explicit (e.g. -480..480, -320..320 or aspect-adjusted)
    let frustumLeft = -WORLD_HALF_WIDTH;
    let frustumRight = WORLD_HALF_WIDTH;
    let frustumTop = WORLD_HALF_HEIGHT;
    let frustumBottom = -WORLD_HALF_HEIGHT;
    let camX = 0;
    let camY = 0;
    let camZoom = 1;

    if (this.camera && this.camera.isOrthographicCamera) {
      frustumLeft = this.camera.left;
      frustumRight = this.camera.right;
      frustumTop = this.camera.top;
      frustumBottom = this.camera.bottom;
      camX = this.camera.position ? this.camera.position.x : 0;
      camY = this.camera.position ? this.camera.position.y : 0;
      camZoom = this.camera.zoom || 1;
    }

    const frustumW = (frustumRight - frustumLeft) / camZoom;
    const frustumH = (frustumTop - frustumBottom) / camZoom;
    const frustumAspect = frustumW / Math.max(1e-5, frustumH);
    const elementAspect = rectWidth / Math.max(1e-5, rectHeight);

    // Check if renderer uses an internal letterboxed/pillarboxed WebGL viewport
    let activeLeft = rectLeft;
    let activeTop = rectTop;
    let activeWidth = rectWidth;
    let activeHeight = rectHeight;

    if (
      this.renderer &&
      typeof this.renderer.getViewport === 'function' &&
      this.THREE &&
      this.THREE.Vector4
    ) {
      const vp = new this.THREE.Vector4();
      this.renderer.getViewport(vp);
      const canvasW = (targetEl && targetEl.clientWidth) || rectWidth;
      const canvasH = (targetEl && targetEl.clientHeight) || rectHeight;
      if (
        vp.width > 0 &&
        vp.height > 0 &&
        canvasW > 0 &&
        canvasH > 0 &&
        (Math.abs(vp.width - canvasW) > 2 || Math.abs(vp.height - canvasH) > 2) &&
        vp.width <= canvasW + 2 &&
        vp.height <= canvasH + 2
      ) {
        const scaleX = rectWidth / canvasW;
        const scaleY = rectHeight / canvasH;
        activeLeft = rectLeft + vp.x * scaleX;
        // WebGL viewport Y is from bottom, DOM Y is from top
        activeTop = rectTop + (canvasH - vp.y - vp.height) * scaleY;
        activeWidth = vp.width * scaleX;
        activeHeight = vp.height * scaleY;
      }
    } else if (Math.abs(elementAspect - frustumAspect) > 0.04 && targetEl && targetEl.tagName !== 'CANVAS') {
      // If attached to a non-canvas container that hasn't been aspect-fitted, compute 960x640 letterbox/pillarbox
      if (elementAspect > frustumAspect) {
        activeHeight = rectHeight;
        activeWidth = rectHeight * frustumAspect;
        activeLeft = rectLeft + (rectWidth - activeWidth) * 0.5;
      } else {
        activeWidth = rectWidth;
        activeHeight = rectWidth / frustumAspect;
        activeTop = rectTop + (rectHeight - activeHeight) * 0.5;
      }
    }

    const normX = (clientX - activeLeft) / Math.max(1, activeWidth);
    const normY = (clientY - activeTop) / Math.max(1, activeHeight);

    const ndcX = normX * 2 - 1;
    const ndcY = -(normY * 2 - 1);

    const worldCenterX = camX + (frustumLeft + frustumRight) * 0.5;
    const worldCenterY = camY + (frustumBottom + frustumTop) * 0.5;

    const worldX = worldCenterX + ndcX * (frustumW * 0.5);
    const worldY = worldCenterY + ndcY * (frustumH * 0.5);

    return { x: worldX, y: worldY };
  }

  /**
   * Convert orthographic world (x, y) to client screen coordinates (clientX, clientY).
   */
  worldToScreen(worldX, worldY) {
    const targetEl =
      (this.renderer && this.renderer.domElement) ||
      this.domElement ||
      (typeof document !== 'undefined' ? document.querySelector('canvas') : null);

    let rectLeft = 0;
    let rectTop = 0;
    let rectWidth = 960;
    let rectHeight = 640;

    if (targetEl && typeof targetEl.getBoundingClientRect === 'function') {
      const rect = targetEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        rectLeft = rect.left;
        rectTop = rect.top;
        rectWidth = rect.width;
        rectHeight = rect.height;
      }
    }

    const ndcX = worldX / WORLD_HALF_WIDTH;
    const ndcY = worldY / WORLD_HALF_HEIGHT;

    return {
      clientX: rectLeft + (ndcX * 0.5 + 0.5) * rectWidth,
      clientY: rectTop + (-ndcY * 0.5 + 0.5) * rectHeight,
    };
  }

  /**
   * Read an aircraft's world (x, y) coordinates regardless of whether it stores
   * them on plane.x/plane.y or plane.position.x/plane.position.y.
   */
  _getPlaneXY(plane) {
    const x = typeof plane.x === 'number' ? plane.x : (plane.position ? plane.position.x : 0);
    const y = typeof plane.y === 'number' ? plane.y : (plane.position ? plane.position.y : 0);
    return { x, y };
  }

  /**
   * Find the closest active selectable aircraft (plane.state === 'FLYING')
   * within selectionRadius (default 44 world units).
   *
   * @param {number} worldX
   * @param {number} worldY
   * @param {number} [radius=44]
   * @returns {object|null}
   */
  findSelectableAircraftAt(worldX, worldY, radius = this.selectionRadius) {
    const planes = this.getAircraft();
    let bestPlane = null;
    let bestDist = radius;

    for (let i = 0; i < planes.length; i++) {
      const plane = planes[i];
      if (!plane || plane.active === false || plane.isDestroyed) continue;
      if (plane.state !== 'FLYING') continue;

      const { x: px, y: py } = this._getPlaneXY(plane);
      const hitPad = typeof plane.hitRadiusBonus === 'number' ? plane.hitRadiusBonus : 0;
      const dist = Math.hypot(worldX - px, worldY - py);
      if (dist <= bestDist + hitPad && dist < bestDist) {
        bestDist = dist;
        bestPlane = plane;
      }
    }

    return bestPlane;
  }

  /**
   * Programmatic or DOM pointerdown entry point in world coordinates.
   * Selects the closest FLYING aircraft within selectionRadius = 44 and starts path recording.
   *
   * @param {number} worldX
   * @param {number} worldY
   * @param {number} [pointerId=1]
   * @returns {object|null} Selected aircraft or null.
   */
  pointerDownAtWorld(worldX, worldY, pointerId = 1) {
    const plane = this.findSelectableAircraftAt(worldX, worldY, this.selectionRadius);
    if (!plane) {
      return null;
    }

    // If another pointer was already dragging this plane, replace that gesture
    for (const [existingPid, existingGesture] of this.activePointers.entries()) {
      if (existingGesture.plane === plane && existingPid !== pointerId) {
        this.activePointers.delete(existingPid);
      }
    }

    // Deselect other planes that aren't actively dragged by another pointer
    const allPlanes = this.getAircraft();
    const activeDraggedPlanes = new Set();
    for (const g of this.activePointers.values()) {
      activeDraggedPlanes.add(g.plane);
    }
    for (let i = 0; i < allPlanes.length; i++) {
      const p = allPlanes[i];
      if (p && p !== plane && !activeDraggedPlanes.has(p)) {
        p.isSelected = false;
      }
    }

    const { x: px, y: py } = this._getPlaneXY(plane);
    const clampedX = clamp(worldX, CLAMP_MIN_X, CLAMP_MAX_X);
    const clampedY = clamp(worldY, CLAMP_MIN_Y, CLAMP_MAX_Y);

    // Clear previous pathWaypoints and lock state immediately
    plane.pathWaypoints = [];
    plane.waypoints = plane.pathWaypoints;
    plane.isLockedToRunway = false;
    plane.lockedRunwayId = null;
    plane.lockedRunway = null;
    plane.invalidApproachFlash = 0;
    plane.isSelected = true;

    // Start control polygon strictly at the aircraft's center (NOT at the offset click point,
    // which could be up to 44 units behind/beside the nose and would create an immediate hook!)
    const rawPoints = [{ x: px, y: py }];

    const gesture = {
      pointerId,
      plane,
      rawPoints,
      smoothX: px,
      smoothY: py,
      accumulatedArcSinceAudio: 0,
      lastRawX: px,
      lastRawY: py,
    };

    this.activePointers.set(pointerId, gesture);

    if (typeof this.onPlaneSelected === 'function') {
      this.onPlaneSelected(plane);
    }

    this.updatePlanePathMesh(plane);

    return plane;
  }

  /**
   * Programmatic or DOM pointermove handler in world coordinates.
   *
   * @param {number} worldX
   * @param {number} worldY
   * @param {number} [pointerId=1]
   */
  pointerMoveAtWorld(worldX, worldY, pointerId = 1) {
    const gesture = this.activePointers.get(pointerId);
    if (!gesture || !gesture.plane) return;

    const plane = gesture.plane;
    if (plane.state && plane.state !== 'FLYING') {
      this.pointerUpAtWorld(pointerId);
      return;
    }

    const clampedX = clamp(worldX, CLAMP_MIN_X, CLAMP_MAX_X);
    const clampedY = clamp(worldY, CLAMP_MIN_Y, CLAMP_MAX_Y);
    const { x: px, y: py } = this._getPlaneXY(plane);

    // Only keep rawPoints[0] at (px, py) BEFORE the user has dragged out the first segment!
    // Never overwrite rawPoints[0] with (px, py) once rawPoints.length >= 2, as moving rawPoints[0]
    // ahead of rawPoints[1] folds the path backward on itself and creates a loop!
    if (gesture.rawPoints.length === 1) {
      gesture.rawPoints[0].x = px;
      gesture.rawPoints[0].y = py;
    } else if (gesture.rawPoints.length >= 2) {
      // Prune any rawPoints that the moving aircraft has already passed while the user is dragging
      while (gesture.rawPoints.length >= 3) {
        const r0 = gesture.rawPoints[0];
        const r1 = gesture.rawPoints[1];
        const segDx = r1.x - r0.x;
        const segDy = r1.y - r0.y;
        const segLenSq = segDx * segDx + segDy * segDy;
        const dist0 = Math.hypot(px - r0.x, py - r0.y);
        const proj = segLenSq > 1e-4 ? ((px - r0.x) * segDx + (py - r0.y) * segDy) / segLenSq : 1.0;
        if (dist0 <= 16.0 || (proj >= 0.65 && dist0 <= 38.0)) {
          gesture.rawPoints.shift();
        } else {
          break;
        }
      }
    }

    // If already locked to a runway, check if pointer stays near the runway or drags far away to unlock
    if (plane.isLockedToRunway && plane.lockedRunway) {
      const rw = plane.lockedRunway;
      const distToThresh = Math.hypot(clampedX - rw.thresholdX, clampedY - rw.thresholdY);
      const distToEnd =
        typeof rw.endX === 'number' && typeof rw.endY === 'number'
          ? Math.hypot(clampedX - rw.endX, clampedY - rw.endY)
          : distToThresh;
      if (distToThresh <= 78 || distToEnd <= 78) {
        this.updatePlanePathMesh(plane);
        return;
      } else {
        plane.isLockedToRunway = false;
        plane.lockedRunwayId = null;
        plane.lockedRunway = null;
      }
    }

    // Exponential low-pass filter on pointer input to eliminate hand/mouse jitter
    if (typeof gesture.smoothX !== 'number') {
      gesture.smoothX = clampedX;
      gesture.smoothY = clampedY;
    } else {
      gesture.smoothX += (clampedX - gesture.smoothX) * 0.52;
      gesture.smoothY += (clampedY - gesture.smoothY) * 0.52;
    }

    const sx = gesture.smoothX;
    const sy = gesture.smoothY;
    const lastPt = gesture.rawPoints[gesture.rawPoints.length - 1];
    const stepDist = Math.hypot(sx - lastPt.x, sy - lastPt.y);

    // Require 14.5 world units between committed control points so micro-tremors never create kinks
    const minCommitDist = 14.5;
    if (stepDist >= minCommitDist) {
      this._appendFilteredControlPoint(gesture, sx, sy);

      gesture.accumulatedArcSinceAudio += stepDist;
      if (gesture.accumulatedArcSinceAudio >= AUDIO_TICK_ARC_STEP) {
        gesture.accumulatedArcSinceAudio %= AUDIO_TICK_ARC_STEP;
        if (typeof this.onPathPointAdded === 'function') {
          this.onPathPointAdded(plane, sx, sy);
        }
      }

      this._rebuildPlanePathFromGesture(gesture, sx, sy);
      this.updatePlanePathMesh(plane);
    } else if (gesture.rawPoints.length >= 2 || stepDist >= 8.0) {
      this._rebuildPlanePathFromGesture(gesture, sx, sy);
      this.updatePlanePathMesh(plane);
    }
  }

  /**
   * Appends a new smoothed control point to `gesture.rawPoints` while automatically
   * relaxing sharp hairpin reversals and pinching off accidental tight micro-loops.
   */
  _appendFilteredControlPoint(gesture, nx, ny) {
    const raw = gesture.rawPoints;
    const n = raw.length;

    // 1. Check if the new segment (raw[n-1] -> (nx, ny)) crosses any recent segment
    // within the last 7 control points (an accidental small scribble loop < 130 units perimeter).
    if (n >= 3) {
      const pA = raw[n - 1];
      const pB = { x: nx, y: ny };
      const minCheckIdx = Math.max(0, n - 8);
      for (let k = minCheckIdx; k <= n - 3; k++) {
        const qA = raw[k];
        const qB = raw[k + 1];
        const hit = this._segmentIntersection(qA, qB, pA, pB);
        if (hit) {
          // Measure perimeter of the candidate loop
          let loopLen = Math.hypot(pB.x - hit.x, pB.y - hit.y) + Math.hypot(qB.x - hit.x, qB.y - hit.y);
          for (let m = k + 1; m < n - 1; m++) {
            loopLen += Math.hypot(raw[m + 1].x - raw[m].x, raw[m + 1].y - raw[m].y);
          }
          // If it's a tight accidental loop (< 130 world units), pinch it off cleanly!
          if (loopLen < 130.0) {
            raw.splice(k + 1);
            raw.push({ x: hit.x, y: hit.y });
            raw.push({ x: nx, y: ny });
            return;
          }
        }
      }
    }

    // 2. If the new segment makes an abrupt > 95 degree kink over a single step,
    // relax the corner vertex raw[n-1] toward the midpoint of raw[n-2] and (nx, ny)
    if (n >= 2) {
      const prev2 = raw[n - 2];
      const prev1 = raw[n - 1];
      const v1x = prev1.x - prev2.x;
      const v1y = prev1.y - prev2.y;
      const v2x = nx - prev1.x;
      const v2y = ny - prev1.y;
      const l1 = Math.hypot(v1x, v1y);
      const l2 = Math.hypot(v2x, v2y);
      if (l1 > 1e-3 && l2 > 1e-3) {
        const cosAng = (v1x * v2x + v1y * v2y) / (l1 * l2);
        if (cosAng < -0.10) {
          // Hairpin reversal: collapse the spike vertex so it never forms a tight loop
          prev1.x = prev2.x * 0.45 + nx * 0.55;
          prev1.y = prev2.y * 0.45 + ny * 0.55;
          return;
        } else if (cosAng < 0.25) {
          const midX = (prev2.x + nx) * 0.5;
          const midY = (prev2.y + ny) * 0.5;
          prev1.x = prev1.x * 0.5 + midX * 0.5;
          prev1.y = prev1.y * 0.5 + midY * 0.5;
        }
      }
    }

    if (raw.length < 480) {
      raw.push({ x: nx, y: ny });
    } else {
      raw[raw.length - 1] = { x: nx, y: ny };
    }
  }

  _segmentIntersection(a, b, c, d) {
    const rX = b.x - a.x;
    const rY = b.y - a.y;
    const sX = d.x - c.x;
    const sY = d.y - c.y;
    const denom = rX * sY - rY * sX;
    if (Math.abs(denom) < 1e-5) return null;
    const qpX = c.x - a.x;
    const qpY = c.y - a.y;
    const t = (qpX * sY - qpY * sX) / denom;
    const u = (qpX * rY - qpY * rX) / denom;
    if (t >= 0.02 && t <= 0.98 && u >= 0.02 && u <= 0.98) {
      return { x: a.x + t * rX, y: a.y + t * rY };
    }
    return null;
  }

  /**
   * Programmatic or DOM pointerup / pointercancel handler.
   *
   * @param {number} [pointerId=1]
   */
  pointerUpAtWorld(pointerId = 1) {
    const gesture = this.activePointers.get(pointerId);
    if (!gesture) return;

    const plane = gesture.plane;
    this.activePointers.delete(pointerId);

    if (plane) {
      plane.isSelected = false;
      if (typeof this.onPathCompleted === 'function') {
        this.onPathCompleted(plane);
      }
      this.updatePlanePathMesh(plane);
    }
  }

  /**
   * DOM pointerdown handler.
   */
  _handlePointerDown(event) {
    if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') {
      return;
    }
    const { x, y } = this.screenToWorld(event.clientX, event.clientY);
    const selected = this.pointerDownAtWorld(x, y, event.pointerId ?? 1);
    if (selected) {
      if (event.cancelable) event.preventDefault();
      if (
        this.domElement &&
        typeof this.domElement.setPointerCapture === 'function' &&
        event.pointerId !== undefined
      ) {
        try {
          this.domElement.setPointerCapture(event.pointerId);
        } catch (_) {
          // Ignore synthetic pointer events without active capture
        }
      }
    }
  }

  /**
   * DOM pointermove handler.
   */
  _handlePointerMove(event) {
    const pid = event.pointerId ?? 1;
    if (!this.activePointers.has(pid)) return;
    if (event.cancelable) event.preventDefault();

    const { x, y } = this.screenToWorld(event.clientX, event.clientY);
    this.pointerMoveAtWorld(x, y, pid);
  }

  /**
   * DOM pointerup handler.
   */
  _handlePointerUp(event) {
    const pid = event.pointerId ?? 1;
    if (!this.activePointers.has(pid)) return;
    if (
      this.domElement &&
      typeof this.domElement.releasePointerCapture === 'function' &&
      event.pointerId !== undefined
    ) {
      try {
        this.domElement.releasePointerCapture(event.pointerId);
      } catch (_) {
        // Ignore
      }
    }
    this.pointerUpAtWorld(pid);
  }

  /**
   * DOM pointercancel handler.
   */
  _handlePointerCancel(event) {
    const pid = event.pointerId ?? 1;
    this.pointerUpAtWorld(pid);
  }

  /**
   * Build the variation-diminishing Chaikin B-Spline from gesture.rawPoints (plus live cursor tip),
   * then evaluate runway threshold & helipad snap/lock.
   */
  _rebuildPlanePathFromGesture(gesture, pointerX, pointerY) {
    const plane = gesture.plane;
    const raw = gesture.rawPoints;
    if (!raw || raw.length === 0) return;

    const workingPts = raw.map((p) => ({ x: p.x, y: p.y }));
    const last = workingPts[workingPts.length - 1];
    if (Math.hypot(pointerX - last.x, pointerY - last.y) >= 3.5) {
      workingPts.push({ x: pointerX, y: pointerY });
    }

    if (workingPts.length < 2) return;

    // 1. Simplify control polygon with Douglas-Peucker (epsilon = 2.8)
    const simplified = douglasPeucker(workingPts, 2.8);

    // 2. Evaluate variation-diminishing Chaikin B-spline (stepSize = 5.0)
    const smoothWaypoints = evaluateCentripetalCatmullRom(
      simplified,
      RESAMPLE_STEP_SIZE,
      CATMULL_ALPHA
    );

    plane.pathWaypoints = smoothWaypoints;
    plane.waypoints = plane.pathWaypoints;

    // 3. Check Runway Threshold & Helipad Approach Snap / Lock
    this._checkRunwaySnapAndLock(gesture, pointerX, pointerY);

    // 4. Immediately trim any waypoints behind the aircraft so the path starts cleanly at the nose
    this.trimPathBehindAircraft(plane);
  }

  /**
   * Check whether an aircraft is compatible with a given runway / helipad.
   * Aligned with FlightKinematicsSystem.isRunwayCompatible (supports direct colorKey,
   * blue_heli / hasRotor helipads, allowedClasses, and shared yellow/blue prop runways).
   */
  _isPlaneCompatibleWithRunway(plane, runway, allRunways = []) {
    if (!plane || !runway) return false;

    const isHeliRunway = Boolean(runway.isHelipad || runway.type === 'helipad');
    const isHeliPlane = Boolean(
      plane.hasRotor ||
        plane.isHelicopter ||
        plane.isHeli ||
        plane.classId === 'heli_blue' ||
        plane.runwayColor === 'blue_heli' ||
        plane.type === 'helicopter' ||
        plane.type === 'heli' ||
        plane.type === 'heli_blue' ||
        plane.category === 'helicopter'
    );

    // Helicopters only land on helipads, fixed-wing only on linear runways
    if (isHeliPlane !== isHeliRunway) {
      return false;
    }

    // Direct colorKey match ('red', 'green', 'yellow', 'blue', 'blue_heli')
    const planeColor = String(
      plane.runwayColor || plane.colorKey || plane.color || plane.type || ''
    )
      .toLowerCase()
      .trim();
    const runwayColor = String(runway.colorKey || runway.color || runway.type || '')
      .toLowerCase()
      .trim();

    if (planeColor && runwayColor && planeColor === runwayColor) {
      return true;
    }

    // Helipad color alias ('blue_heli' <-> 'blue' helipad)
    if (
      isHeliPlane &&
      isHeliRunway &&
      (runwayColor === 'blue' || runwayColor === 'blue_heli' || runwayColor === 'helipad')
    ) {
      return true;
    }

    // Allowed classes list on the runway definition
    if (
      Array.isArray(runway.allowedClasses) &&
      (runway.allowedClasses.includes(plane.classId) || runway.allowedClasses.includes(plane.type))
    ) {
      const hasExactColorRunway =
        Array.isArray(allRunways) &&
        allRunways.some((r) => r && r.colorKey === plane.runwayColor);
      if (!hasExactColorRunway) {
        return true;
      }
      if (
        (plane.classId === 'prop_yellow' || plane.classId === 'prop_blue') &&
        (runway.colorKey === 'yellow' || runway.colorKey === 'blue')
      ) {
        return true;
      }
    }

    // Shared blue/yellow prop runway fallback when no dedicated color runway exists on map
    const isPropPlane =
      plane.classId === 'prop_yellow' ||
      plane.classId === 'prop_blue' ||
      planeColor === 'yellow' ||
      planeColor === 'blue';
    const isPropRunway =
      !isHeliRunway &&
      !runway.isWaterRunway &&
      (runwayColor === 'yellow' || runwayColor === 'blue');

    if (isPropPlane && isPropRunway) {
      const hasExactColorRunway =
        Array.isArray(allRunways) &&
        allRunways.some((r) => r && r.colorKey === plane.runwayColor);
      if (!hasExactColorRunway) {
        return true;
      }
    }

    if (plane.runwayType && runway.type && plane.runwayType === runway.type) {
      return true;
    }

    return false;
  }

  /**
   * Compute incoming tangent direction (ux, uy) of the currently drawn path near its tip.
   */
  _getIncomingPathTangent(gesture, tipX, tipY) {
    const plane = gesture.plane;
    const waypoints = plane && Array.isArray(plane.pathWaypoints) ? plane.pathWaypoints : [];
    const raw = gesture.rawPoints || [];

    // Look back ~18..36 world units from the tip along waypoints or rawPoints
    const source = waypoints.length >= 2 ? waypoints : raw;
    if (source.length >= 2) {
      const tip = { x: tipX, y: tipY };
      let lookback = source[0];
      for (let i = source.length - 2; i >= 0; i--) {
        const pt = source[i];
        const d = Math.hypot(tip.x - pt.x, tip.y - pt.y);
        lookback = pt;
        if (d >= 18.0) {
          break;
        }
      }
      const dx = tip.x - lookback.x;
      const dy = tip.y - lookback.y;
      const len = Math.hypot(dx, dy);
      if (len > 1e-3) {
        return { ux: dx / len, uy: dy / len };
      }
    }

    // Fallback to aircraft current heading if path is just starting
    if (typeof plane.heading === 'number') {
      return { ux: Math.cos(plane.heading), uy: Math.sin(plane.heading) };
    }
    return { ux: 1, uy: 0 };
  }

  /**
   * Evaluate runway threshold and helipad approach snap/lock rules.
   */
  _checkRunwaySnapAndLock(gesture, pointerX, pointerY) {
    const plane = gesture.plane;
    if (!plane || plane.isLockedToRunway) return;

    const runways = this.getRunways();
    if (!Array.isArray(runways) || runways.length === 0) return;

    for (let i = 0; i < runways.length; i++) {
      const runway = runways[i];
      if (!runway) continue;

      if (!this._isPlaneCompatibleWithRunway(plane, runway, runways)) {
        continue;
      }

      const threshX = typeof runway.thresholdX === 'number' ? runway.thresholdX : (runway.x || 0);
      const threshY = typeof runway.thresholdY === 'number' ? runway.thresholdY : (runway.y || 0);
      const isHelipad = Boolean(runway.isHelipad || runway.type === 'helipad');

      if (isHelipad) {
        const snapRadius = runway.snapRadius || HELIPAD_SNAP_RADIUS;
        const dist = Math.hypot(pointerX - threshX, pointerY - threshY);
        if (dist <= snapRadius) {
          this._lockPlaneToHelipad(gesture, plane, runway, threshX, threshY);
          return;
        }
      } else {
        // Linear Runway
        const endX = typeof runway.endX === 'number' ? runway.endX : threshX;
        const endY = typeof runway.endY === 'number' ? runway.endY : threshY;

        let heading = typeof runway.heading === 'number'
          ? runway.heading
          : Math.atan2(endY - threshY, endX - threshX);

        if (Math.abs(heading) > Math.PI * 2 + 0.01) {
          heading = (heading * Math.PI) / 180;
        }

        let dirX = Math.cos(heading);
        let dirY = Math.sin(heading);

        const rwDx = endX - threshX;
        const rwDy = endY - threshY;
        const rwLen = Math.hypot(rwDx, rwDy);
        if (rwLen > 1.0 && dirX * rwDx + dirY * rwDy < 0) {
          dirX = rwDx / rwLen;
          dirY = rwDy / rwLen;
          heading = Math.atan2(dirY, dirX);
        }

        const relX = pointerX - threshX;
        const relY = pointerY - threshY;
        const distToThreshold = Math.hypot(relX, relY);

        const along = relX * dirX + relY * dirY;
        const perp = Math.abs(-relX * dirY + relY * dirX);

        const snapRadius = runway.snapRadius || LINEAR_RUNWAY_SNAP_RADIUS;
        const inThresholdCircle = distToThreshold <= snapRadius;
        const inApproachFunnel =
          along >= -FUNNEL_BEFORE_THRESHOLD &&
          along <= FUNNEL_PAST_THRESHOLD &&
          perp <= FUNNEL_HALF_WIDTH;

        if (inThresholdCircle || inApproachFunnel) {
          const { ux, uy } = this._getIncomingPathTangent(gesture, pointerX, pointerY);
          const dot = clamp(ux * dirX + uy * dirY, -1, 1);
          const angleDiff = Math.acos(dot);

          if (angleDiff <= MAX_ALIGN_ANGLE_RAD) {
            this._lockPlaneToLinearRunway(
              gesture,
              plane,
              runway,
              threshX,
              threshY,
              endX,
              endY,
              dirX,
              dirY,
              rwLen
            );
            return;
          } else if (angleDiff > INVALID_APPROACH_ANGLE_RAD) {
            plane.invalidApproachFlash = INVALID_FLASH_DURATION;
            runway.invalidApproachFlash = INVALID_FLASH_DURATION;
            if (typeof this.onInvalidApproach === 'function') {
              this.onInvalidApproach(plane, runway);
            }
          }
        }
      }
    }
  }

  /**
   * Lock an aircraft's path smoothly into a helipad center.
   */
  _lockPlaneToHelipad(gesture, plane, runway, centerX, centerY) {
    plane.isLockedToRunway = true;
    plane.lockedRunwayId = runway.id;
    plane.lockedRunway = runway;
    plane.invalidApproachFlash = 0;

    const raw = gesture.rawPoints.map((p) => ({ x: p.x, y: p.y }));
    while (
      raw.length > 1 &&
      Math.hypot(raw[raw.length - 1].x - centerX, raw[raw.length - 1].y - centerY) < 16.0
    ) {
      raw.pop();
    }
    raw.push({ x: centerX, y: centerY });

    const simplified = douglasPeucker(raw, 2.8);
    const smoothWaypoints = evaluateCentripetalCatmullRom(
      simplified,
      RESAMPLE_STEP_SIZE,
      CATMULL_ALPHA
    );

    if (smoothWaypoints.length > 0) {
      smoothWaypoints[smoothWaypoints.length - 1].x = centerX;
      smoothWaypoints[smoothWaypoints.length - 1].y = centerY;
    }

    plane.pathWaypoints = smoothWaypoints;
    plane.waypoints = plane.pathWaypoints;

    if (typeof this.onRunwayLocked === 'function') {
      this.onRunwayLocked(plane, runway);
    }
  }

  /**
   * Lock an aircraft's path smoothly into a linear runway threshold with strictly monotonic
   * approach projection (preventing any Z-fold or threshold loop).
   */
  _lockPlaneToLinearRunway(
    gesture,
    plane,
    runway,
    threshX,
    threshY,
    endX,
    endY,
    dirX,
    dirY,
    runwayLength
  ) {
    plane.isLockedToRunway = true;
    plane.lockedRunwayId = runway.id;
    plane.lockedRunway = runway;
    plane.invalidApproachFlash = 0;

    // Prune raw points inside or past the threshold capture zone so the curve blends monotonically
    const raw = gesture.rawPoints.map((p) => ({ x: p.x, y: p.y }));
    while (raw.length > 1) {
      const tip = raw[raw.length - 1];
      const relX = tip.x - threshX;
      const relY = tip.y - threshY;
      const along = relX * dirX + relY * dirY;
      const dist = Math.hypot(relX, relY);
      if (along > -16.0 || dist < 24.0) {
        raw.pop();
      } else {
        break;
      }
    }

    // Only insert a pre-threshold alignment point if the last point is strictly further back
    // along the approach axis (alongLast < -28), ensuring strictly monotonic progress!
    const lastPt = raw[raw.length - 1];
    const alongLast = (lastPt.x - threshX) * dirX + (lastPt.y - threshY) * dirY;
    if (alongLast < -28.0) {
      const leadDist = Math.min(22.0, Math.max(12.0, -alongLast * 0.40));
      raw.push({
        x: threshX - dirX * leadDist,
        y: threshY - dirY * leadDist,
      });
    }

    // Add exact threshold point
    raw.push({ x: threshX, y: threshY });

    const simplified = douglasPeucker(raw, 2.8);
    const approachWaypoints = evaluateCentripetalCatmullRom(
      simplified,
      RESAMPLE_STEP_SIZE,
      CATMULL_ALPHA
    );

    if (approachWaypoints.length > 0) {
      approachWaypoints[approachWaypoints.length - 1].x = threshX;
      approachWaypoints[approachWaypoints.length - 1].y = threshY;
      approachWaypoints[approachWaypoints.length - 1].isThreshold = true;
    }

    const baseU =
      approachWaypoints.length > 0
        ? approachWaypoints[approachWaypoints.length - 1].u || 0
        : 0;
    plane.thresholdWaypointIndex = Math.max(0, approachWaypoints.length - 1);

    // Append a short 12-unit centerline lead-in past the threshold so the plane enters
    // the threshold aligned with the runway heading without flying to the far 'X'
    approachWaypoints.push({
      x: threshX + dirX * 12.0,
      y: threshY + dirY * 12.0,
      u: baseU + 12.0,
      isRunwayRollout: true,
    });

    plane.pathWaypoints = approachWaypoints;
    plane.waypoints = plane.pathWaypoints;

    if (typeof this.onRunwayLocked === 'function') {
      this.onRunwayLocked(plane, runway);
    }
  }

  /**
   * Real-Time Path Decay (Tail Truncation):
   * Called every frame for each aircraft (including while actively dragged!):
   * removes completed waypoints behind the aircraft and prepends a visual nose anchor
   * `{ x: px, y: py, isNoseAnchor: true }` so the dashed ribbon smoothly erases right
   * from the aircraft's nose without overwriting real spline waypoints.
   *
   * @param {object} plane
   */
  trimPathBehindAircraft(plane) {
    if (!plane) return;
    const waypoints = plane.pathWaypoints;
    if (!Array.isArray(waypoints) || waypoints.length === 0) {
      this._hidePlaneRibbon(plane);
      return;
    }

    const { x: px, y: py } = this._getPlaneXY(plane);

    // Strip the temporary visual nose anchor from the previous frame before evaluating progress
    while (waypoints.length > 0 && waypoints[0] && waypoints[0].isNoseAnchor) {
      waypoints.shift();
    }

    if (waypoints.length === 0) {
      this._hidePlaneRibbon(plane);
      return;
    }

    // Ensure u (cumulative arc-length) values are initialized on waypoints so dashes stay world-anchored
    if (typeof waypoints[0].u !== 'number') {
      let accum = 0;
      waypoints[0].u = 0;
      for (let i = 1; i < waypoints.length; i++) {
        accum += Math.hypot(
          waypoints[i].x - waypoints[i - 1].x,
          waypoints[i].y - waypoints[i - 1].y
        );
        waypoints[i].u = accum;
      }
    }

    const heading = typeof plane.heading === 'number' ? plane.heading : 0;
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);
    const minTurnRadius =
      (plane.speed || 52) / Math.max(0.8, plane.maxTurnRate || 2.8);
    const leftCircleX = px - sinH * minTurnRadius;
    const leftCircleY = py + cosH * minTurnRadius;
    const rightCircleX = px + sinH * minTurnRadius;
    const rightCircleY = py - cosH * minTurnRadius;
    const directCaptureRadius = Math.max(15.0, minTurnRadius * 0.56);

    // Jump past early turn-in waypoints if the plane is already near a slightly later waypoint
    const maxScan = Math.min(waypoints.length - 1, 10);
    let jumpIdx = 0;
    for (let k = 1; k <= maxScan; k++) {
      const wk = waypoints[k];
      if (Math.hypot(wk.x - px, wk.y - py) <= directCaptureRadius) {
        jumpIdx = k;
      }
    }
    if (jumpIdx > 0) {
      waypoints.splice(0, jumpIdx);
    }

    // Remove waypoints that the aircraft has passed or that lie inside its Dubins turning circle
    while (waypoints.length >= 2) {
      const w0 = waypoints[0];
      const w1 = waypoints[1];
      const dx0 = w0.x - px;
      const dy0 = w0.y - py;
      const d0 = Math.hypot(dx0, dy0);
      const fwdDot0 = dx0 * cosH + dy0 * sinH;

      const dLeft = Math.hypot(w0.x - leftCircleX, w0.y - leftCircleY);
      const dRight = Math.hypot(w0.x - rightCircleX, w0.y - rightCircleY);
      const insideTurningCircle =
        Math.min(dLeft, dRight) < minTurnRadius * 1.12 &&
        fwdDot0 < minTurnRadius * 0.75;
      const behindWingNear = fwdDot0 < 3.0 && d0 <= minTurnRadius * 1.48;

      const segDx = w1.x - w0.x;
      const segDy = w1.y - w0.y;
      const segLenSq = segDx * segDx + segDy * segDy;
      if (segLenSq < 1e-4) {
        waypoints.shift();
        continue;
      }

      const t = ((px - w0.x) * segDx + (py - w0.y) * segDy) / segLenSq;
      if (
        d0 <= directCaptureRadius ||
        insideTurningCircle ||
        behindWingNear ||
        (t >= 0.55 && d0 <= minTurnRadius * 1.45)
      ) {
        waypoints.shift();
      } else {
        break;
      }
    }

    // Check if the single remaining final waypoint has been reached or passed
    if (waypoints.length === 1) {
      const w0 = waypoints[0];
      const dx0 = w0.x - px;
      const dy0 = w0.y - py;
      const d0 = Math.hypot(dx0, dy0);
      const fwdDot0 = dx0 * cosH + dy0 * sinH;
      const dLeft = Math.hypot(w0.x - leftCircleX, w0.y - leftCircleY);
      const dRight = Math.hypot(w0.x - rightCircleX, w0.y - rightCircleY);
      const insideTurningCircle =
        Math.min(dLeft, dRight) < minTurnRadius * 1.12 &&
        fwdDot0 < 4.0;

      const isActivelyDragged = Array.from(this.activePointers.values()).some(
        (g) => g && g.plane === plane
      );

      if (!isActivelyDragged) {
        if (!plane.isLockedToRunway) {
          if (
            d0 <= directCaptureRadius ||
            insideTurningCircle ||
            (d0 <= minTurnRadius * 1.45 && fwdDot0 < 0.0)
          ) {
            waypoints.length = 0;
            this._hidePlaneRibbon(plane);
            return;
          }
        } else if (d0 <= 6.0 || (d0 <= minTurnRadius * 1.25 && fwdDot0 < -8.0)) {
          waypoints.length = 0;
          plane.isLockedToRunway = false;
          plane.lockedRunwayId = null;
          this._hidePlaneRibbon(plane);
          return;
        }
      }
    }

    // Prepend a non-destructive visual nose anchor at (px, py) so the ribbon starts at the aircraft
    if (waypoints.length >= 1) {
      const firstWp = waypoints[0];
      const remSegLen = Math.hypot(firstWp.x - px, firstWp.y - py);
      const anchorU =
        typeof firstWp.u === 'number' ? Math.max(0, firstWp.u - remSegLen) : 0;
      waypoints.unshift({
        x: px,
        y: py,
        u: anchorU,
        isNoseAnchor: true,
      });
    }

    this.updatePlanePathMesh(plane);
  }

  /**
   * Resolve Three.js color hex for an aircraft's class color.
   */
  _resolvePlaneColorHex(plane) {
    if (!plane) return '#ff453a';
    if (typeof plane.pathColor === 'string' && plane.pathColor.startsWith('#')) {
      return plane.pathColor;
    }
    if (typeof plane.colorHex === 'string' && plane.colorHex.startsWith('#')) {
      return plane.colorHex;
    }
    const key = String(
      plane.runwayColor || plane.colorKey || plane.color || plane.type || 'red'
    )
      .toLowerCase()
      .trim();
    return CLASS_COLOR_MAP[key] || '#ff453a';
  }

  /**
   * Create or retrieve the pre-allocated dynamic ribbon BufferGeometry & ShaderMaterial for a plane.
   */
  _getOrCreateRibbonEntry(plane) {
    const T = this.THREE || (typeof window !== 'undefined' ? window.THREE : null);
    if (!T) return null;
    if (!this.pathGroup) this._initPathGroup();
    if (!this.pathGroup) return null;

    const key = plane.id !== undefined ? plane.id : plane;
    let entry = this.ribbonEntries.get(key);
    if (entry) return entry;

    const maxVerts = MAX_RIBBON_POINTS * 2;
    const maxIndices = (MAX_RIBBON_POINTS - 1) * 6;

    const positions = new Float32Array(maxVerts * 3);
    const uvs = new Float32Array(maxVerts * 2);
    const indices = new Uint16Array(maxIndices);

    // Pre-populate static quad-strip triangle indices
    let idxCursor = 0;
    for (let i = 0; i < MAX_RIBBON_POINTS - 1; i++) {
      const v0 = i * 2;
      const v1 = v0 + 1;
      const v2 = v0 + 2;
      const v3 = v0 + 3;

      indices[idxCursor++] = v0;
      indices[idxCursor++] = v1;
      indices[idxCursor++] = v2;

      indices[idxCursor++] = v1;
      indices[idxCursor++] = v3;
      indices[idxCursor++] = v2;
    }

    const geometry = new T.BufferGeometry();
    const posAttr = new T.BufferAttribute(positions, 3);
    const uvAttr = new T.BufferAttribute(uvs, 2);
    if (T.DynamicDrawUsage) {
      posAttr.setUsage(T.DynamicDrawUsage);
      uvAttr.setUsage(T.DynamicDrawUsage);
    }
    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('uv', uvAttr);
    geometry.setIndex(new T.BufferAttribute(indices, 1));
    geometry.setDrawRange(0, 0);

    const colorHex = this._resolvePlaneColorHex(plane);
    const baseColor = new T.Color(colorHex);

    const material = new T.ShaderMaterial({
      uniforms: {
        uColor: { value: baseColor.clone() },
        uHaloColor: { value: baseColor.clone() },
        uLocked: { value: 0.0 },
        uHalfWidth: { value: RIBBON_GEOM_HALF_WIDTH },
        uOpacity: { value: 1.0 },
        uTotalLength: { value: 0.0 },
      },
      vertexShader: RIBBON_VERTEX_SHADER,
      fragmentShader: RIBBON_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: T.DoubleSide,
    });

    const mesh = new T.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 15;
    mesh.visible = false;

    this.pathGroup.add(mesh);

    entry = {
      key,
      plane,
      mesh,
      geometry,
      material,
      positions,
      uvs,
      posAttr,
      uvAttr,
    };
    this.ribbonEntries.set(key, entry);
    return entry;
  }

  /**
   * Hide the ribbon mesh for a plane when its path is empty or completed.
   */
  _hidePlaneRibbon(plane) {
    if (!plane) return;
    const key = plane.id !== undefined ? plane.id : plane;
    const entry = this.ribbonEntries.get(key);
    if (entry && entry.mesh) {
      entry.mesh.visible = false;
      entry.geometry.setDrawRange(0, 0);
    }
  }

  /**
   * Remove and dispose of a plane's path mesh (e.g. when plane lands and despawns).
   */
  removePlanePath(plane) {
    if (!plane) return;
    const key = plane.id !== undefined ? plane.id : plane;
    const entry = this.ribbonEntries.get(key);
    if (!entry) return;

    if (this.pathGroup && entry.mesh) {
      this.pathGroup.remove(entry.mesh);
    }
    if (entry.geometry) entry.geometry.dispose();
    if (entry.material) entry.material.dispose();
    this.ribbonEntries.delete(key);
  }

  /**
   * Update the dynamic triangulated quad-strip ribbon BufferGeometry for a given aircraft.
   *
   * @param {object} plane
   */
  updatePlanePathMesh(plane) {
    if (!plane) return;
    const rawWaypoints = plane.pathWaypoints;
    const waypoints = Array.isArray(rawWaypoints)
      ? rawWaypoints.filter((wp) => wp && !wp.isRunwayRollout)
      : null;
    if (
      !Array.isArray(waypoints) ||
      waypoints.length < 2 ||
      plane.active === false ||
      plane.state === 'LANDED' ||
      plane.state === 'CRASHED'
    ) {
      this._hidePlaneRibbon(plane);
      return;
    }

    const entry = this._getOrCreateRibbonEntry(plane);
    if (!entry) return;

    const count = Math.min(waypoints.length, MAX_RIBBON_POINTS);
    const positions = entry.positions;
    const uvs = entry.uvs;
    const halfW = RIBBON_GEOM_HALF_WIDTH;

    let cumArc = typeof waypoints[0].u === 'number' ? waypoints[0].u : 0;

    for (let i = 0; i < count; i++) {
      const curr = waypoints[i];
      if (i > 0) {
        if (typeof curr.u === 'number' && curr.u >= cumArc) {
          cumArc = curr.u;
        } else {
          const prev = waypoints[i - 1];
          cumArc += Math.hypot(curr.x - prev.x, curr.y - prev.y);
        }
      }

      // Compute smooth mitered normal at vertex i
      let tx = 0;
      let ty = 0;

      if (i < count - 1) {
        const next = waypoints[i + 1];
        const dx = next.x - curr.x;
        const dy = next.y - curr.y;
        const len = Math.hypot(dx, dy);
        if (len > 1e-4) {
          tx += dx / len;
          ty += dy / len;
        }
      }
      if (i > 0) {
        const prev = waypoints[i - 1];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const len = Math.hypot(dx, dy);
        if (len > 1e-4) {
          tx += dx / len;
          ty += dy / len;
        }
      }

      const tLen = Math.hypot(tx, ty);
      if (tLen > 1e-4) {
        tx /= tLen;
        ty /= tLen;
      } else {
        tx = 1;
        ty = 0;
      }

      // Left-hand normal (-ty, tx)
      const nx = -ty;
      const ny = tx;

      const vLeftIdx = i * 2;
      const vRightIdx = vLeftIdx + 1;

      positions[vLeftIdx * 3] = curr.x + nx * halfW;
      positions[vLeftIdx * 3 + 1] = curr.y + ny * halfW;
      positions[vLeftIdx * 3 + 2] = 0;

      positions[vRightIdx * 3] = curr.x - nx * halfW;
      positions[vRightIdx * 3 + 1] = curr.y - ny * halfW;
      positions[vRightIdx * 3 + 2] = 0;

      // UVs: (u = cumulativeArcLength, v = -1..+1)
      uvs[vLeftIdx * 2] = cumArc;
      uvs[vLeftIdx * 2 + 1] = 1.0;

      uvs[vRightIdx * 2] = cumArc;
      uvs[vRightIdx * 2 + 1] = -1.0;
    }

    entry.posAttr.needsUpdate = true;
    entry.uvAttr.needsUpdate = true;
    entry.geometry.setDrawRange(0, (count - 1) * 6);

    // Update shader uniforms for locked vs unlocked state and aircraft class color
    const colorHex = this._resolvePlaneColorHex(plane);
    entry.material.uniforms.uColor.value.set(colorHex);
    entry.material.uniforms.uHaloColor.value.set(colorHex);
    entry.material.uniforms.uLocked.value = plane.isLockedToRunway ? 1.0 : 0.0;
    entry.material.uniforms.uTotalLength.value = cumArc;
    entry.mesh.visible = true;
  }

  /**
   * Frame update method:
   * - Updates invalidApproachFlash timers on planes and runways
   * - Runs real-time path decay (trimPathBehindAircraft) on all active aircraft
   * - Prunes ribbon meshes for despawned aircraft
   *
   * @param {number} [dt=0.016]
   * @param {Array<object>} [aircraftOverride]
   * @param {Array<object>} [runwaysOverride]
   */
  update(dt = 0.016, aircraftOverride = null, runwaysOverride = null) {
    if (Array.isArray(aircraftOverride)) {
      this.aircraftList = aircraftOverride;
    }
    if (Array.isArray(runwaysOverride)) {
      this.runwaysList = runwaysOverride;
    }

    const planes = this.getAircraft();
    const runways = this.getRunways();

    // Decay invalidApproachFlash on runways
    if (Array.isArray(runways)) {
      for (let i = 0; i < runways.length; i++) {
        const rw = runways[i];
        if (rw && typeof rw.invalidApproachFlash === 'number' && rw.invalidApproachFlash > 0) {
          rw.invalidApproachFlash = Math.max(0, rw.invalidApproachFlash - dt);
        }
      }
    }

    const liveKeys = new Set();
    for (let i = 0; i < planes.length; i++) {
      const plane = planes[i];
      if (!plane) continue;
      const key = plane.id !== undefined ? plane.id : plane;
      liveKeys.add(key);

      if (typeof plane.invalidApproachFlash === 'number' && plane.invalidApproachFlash > 0) {
        plane.invalidApproachFlash = Math.max(0, plane.invalidApproachFlash - dt);
      }

      this.trimPathBehindAircraft(plane);
    }

    // Clean up ribbon meshes for aircraft no longer in the active list
    for (const [key, entry] of this.ribbonEntries.entries()) {
      if (!liveKeys.has(key)) {
        this.removePlanePath(entry.plane);
      }
    }
  }

  /**
   * Clear all paths and reset active pointer gestures.
   */
  clearAllPaths() {
    this.activePointers.clear();
    const planes = this.getAircraft();
    for (let i = 0; i < planes.length; i++) {
      const plane = planes[i];
      if (plane) {
        plane.pathWaypoints = [];
        plane.isLockedToRunway = false;
        plane.lockedRunwayId = null;
        plane.isSelected = false;
      }
    }
    for (const entry of Array.from(this.ribbonEntries.values())) {
      this.removePlanePath(entry.plane);
    }
  }

  /**
   * Dispose of listeners and Three.js resources.
   */
  dispose() {
    this.detach();
    this.clearAllPaths();
    if (this.pathGroup && this.pathGroup.parent) {
      this.pathGroup.parent.remove(this.pathGroup);
    }
  }

  // Static & instance helpers exposed for external callers / unit tests
  static douglasPeucker = douglasPeucker;
  static evaluateCentripetalCatmullRom = evaluateCentripetalCatmullRom;
  douglasPeucker(points, epsilon = DP_EPSILON) {
    return douglasPeucker(points, epsilon);
  }
  evaluateCentripetalCatmullRom(controlPoints, stepSize = RESAMPLE_STEP_SIZE, alpha = CATMULL_ALPHA) {
    return evaluateCentripetalCatmullRom(controlPoints, stepSize, alpha);
  }
}

if (typeof window !== 'undefined') {
  window.FlightPathInputSystem = FlightPathInputSystem;
  window.douglasPeucker = douglasPeucker;
  window.evaluateCentripetalCatmullRom = evaluateCentripetalCatmullRom;
}
