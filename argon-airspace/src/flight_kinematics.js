/**
 * @fileoverview Flight Kinematics, Realistic Banking & Touchdown Sequences
 * for Argon Airspace Three.js Orthographic Remake (Agent 3).
 *
 * Coordinate System Contract:
 * - World X in [-480, +480], World Y in [-320, +320]
 * - Heading 0 rad points East (+X), +Math.PI / 2 points North (+Y)
 */

const TWO_PI = Math.PI * 2;

/**
 * Normalizes an angle in radians to the interval [-Math.PI, +Math.PI].
 * @param {number} angle
 * @return {number}
 */
export function normalizeAngle(angle) {
  if (!Number.isFinite(angle)) return 0;
  let a = (angle + Math.PI) % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a - Math.PI;
}

/**
 * Clamps a numeric value to [min, max].
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @return {number}
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Linear interpolation between a and b.
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @return {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Shortest-arc angular interpolation between angles a and b.
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @return {number}
 */
export function lerpAngle(a, b, t) {
  const diff = normalizeAngle(b - a);
  return normalizeAngle(a + diff * clamp(t, 0, 1));
}

/**
 * Quadratic ease-out curve.
 * @param {number} t
 * @return {number}
 */
function easeOutQuad(t) {
  const c = clamp(t, 0, 1);
  return 1 - (1 - c) * (1 - c);
}

/**
 * Cubic smoothstep curve.
 * @param {number} t
 * @return {number}
 */
function smoothstep01(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/**
 * Authentic Aussie / Argon landing praise callouts.
 */
export const AUSSIE_PRAISE_STRINGS = Object.freeze([
  'YOU BEWDY!',
  'SWEET!',
  'RAD!',
  'NICE LINES!',
  "STYLIN'!",
  'COMMENDABLE',
  'BONZA!',
  'RIPPER!',
  'FAIR DINKUM!',
]);

/**
 * Per-Class Aircraft Specifications with authentic speeds, turn rates,
 * banking limits, drop-shadow offsets, and runway compatibility.
 */
export const AIRCRAFT_CLASSES = Object.freeze({
  jet_red: Object.freeze({
    id: 'jet_red',
    name: 'Clipper Heavy Jet',
    runwayColor: 'red',
    spriteKey: 'plane_jet_red',
    speed: 74,
    maxTurnRate: 2.55,
    maxBankRad: 0.58,
    scale: 1.24,
    shadowBaseOffset: 16,
    hasPropeller: false,
    hasRotor: false,
    colorHex: 0xff3b30,
    colorCss: '#ff3b30',
  }),
  seaplane_green: Object.freeze({
    id: 'seaplane_green',
    name: 'Catalina Seaplane',
    runwayColor: 'green',
    spriteKey: 'plane_seaplane_green',
    speed: 60,
    maxTurnRate: 2.85,
    maxBankRad: 0.50,
    scale: 1.06,
    shadowBaseOffset: 14,
    hasPropeller: true,
    hasRotor: false,
    colorHex: 0x2ee6a8,
    colorCss: '#2ee6a8',
  }),
  prop_yellow: Object.freeze({
    id: 'prop_yellow',
    name: 'Sunbird Monoplane',
    runwayColor: 'yellow',
    spriteKey: 'plane_prop_yellow',
    speed: 52,
    maxTurnRate: 3.30,
    maxBankRad: 0.52,
    scale: 0.94,
    shadowBaseOffset: 12,
    hasPropeller: true,
    hasRotor: false,
    colorHex: 0xffd60a,
    colorCss: '#ffd60a',
  }),
  prop_blue: Object.freeze({
    id: 'prop_blue',
    name: 'Skylark Commuter',
    runwayColor: 'blue',
    spriteKey: 'plane_prop_blue',
    speed: 46,
    maxTurnRate: 3.50,
    maxBankRad: 0.48,
    scale: 0.90,
    shadowBaseOffset: 11,
    hasPropeller: true,
    hasRotor: false,
    colorHex: 0x2ac3ff,
    colorCss: '#2ac3ff',
  }),
  heli_blue: Object.freeze({
    id: 'heli_blue',
    name: 'Rescue Chopper',
    runwayColor: 'blue_heli',
    spriteKey: 'plane_heli_blue',
    speed: 35,
    maxTurnRate: 4.50,
    maxBankRad: 0.36,
    scale: 0.95,
    shadowBaseOffset: 10,
    hasPropeller: false,
    hasRotor: true,
    colorHex: 0x38bdf8,
    colorCss: '#38bdf8',
  }),
});

let nextAircraftUid = 1;

/**
 * Represents a single aircraft in the orthographic airspace.
 */
export class AircraftEntity {
  /**
   * @param {Object|string} configOrClassId Either a configuration object
   *     `{ id, classId, x, y, heading, ... }` or a `classId` string.
   * @param {number=} xOpt
   * @param {number=} yOpt
   * @param {number=} headingOpt
   * @param {string|number=} idOpt
   */
  constructor(configOrClassId = {}, xOpt = 0, yOpt = 0, headingOpt = 0, idOpt = undefined) {
    const opts =
      typeof configOrClassId === 'string'
        ? {
            classId: configOrClassId,
            x: xOpt,
            y: yOpt,
            heading: headingOpt,
            id: idOpt,
          }
        : configOrClassId || {};

    const classKey =
      opts.classId || opts.type || opts.aircraftClassId || 'prop_yellow';
    const spec = AIRCRAFT_CLASSES[classKey] || AIRCRAFT_CLASSES.prop_yellow;

    this.id = opts.id !== undefined && opts.id !== null ? opts.id : `aircraft_${nextAircraftUid++}`;
    this.classId = spec.id;
    this.type = spec.id;
    this.spec = spec;
    this.name = opts.name || spec.name;
    this.runwayColor = opts.runwayColor || spec.runwayColor;
    this.spriteKey = opts.spriteKey || spec.spriteKey;

    // Kinematic capabilities
    this.baseSpeed = Number.isFinite(opts.speed) ? opts.speed : spec.speed;
    this.speed = this.baseSpeed;
    this.maxTurnRate = Number.isFinite(opts.maxTurnRate)
      ? opts.maxTurnRate
      : spec.maxTurnRate;
    this.maxBankRad = Number.isFinite(opts.maxBankRad)
      ? opts.maxBankRad
      : spec.maxBankRad;

    // Visual & rigging attributes
    this.scale = Number.isFinite(opts.scale) ? opts.scale : spec.scale;
    this.baseScale = this.scale;
    this.visualScale = Number.isFinite(opts.visualScale) ? opts.visualScale : 1.0;
    this.shadowBaseOffset = Number.isFinite(opts.shadowBaseOffset)
      ? opts.shadowBaseOffset
      : spec.shadowBaseOffset;
    this.hasPropeller =
      opts.hasPropeller !== undefined ? Boolean(opts.hasPropeller) : spec.hasPropeller;
    this.hasRotor =
      opts.hasRotor !== undefined ? Boolean(opts.hasRotor) : spec.hasRotor;
    this.colorHex = opts.colorHex !== undefined ? opts.colorHex : spec.colorHex;
    this.colorCss = opts.colorCss || spec.colorCss;

    // Spatial state
    this.x = Number.isFinite(opts.x) ? opts.x : 0;
    this.y = Number.isFinite(opts.y) ? opts.y : 0;
    this.heading = normalizeAngle(
      Number.isFinite(opts.heading)
        ? opts.heading
        : Number.isFinite(opts.entryHeading)
          ? opts.entryHeading
          : 0
    );
    this.desiredHeading = this.heading;
    this.vx = Math.cos(this.heading) * this.speed;
    this.vy = Math.sin(this.heading) * this.speed;
    this.turnRate = 0;
    this.bankAngle = 0;

    // 2.5D altitude, shadow & opacity state
    this.altitude = Number.isFinite(opts.altitude) ? opts.altitude : 1.0;
    this.opacity = Number.isFinite(opts.opacity) ? opts.opacity : 1.0;
    this.shadowOffsetX = this.shadowBaseOffset;
    this.shadowOffsetY = -this.shadowBaseOffset;
    this.propAngle = Math.random() * TWO_PI;
    this.flightTime = 0;

    // Path & selection state
    this.pathWaypoints = Array.isArray(opts.pathWaypoints)
      ? opts.pathWaypoints.map((pt) => ({ x: Number(pt.x), y: Number(pt.y) }))
      : [];
    this.isSelected = Boolean(opts.isSelected);
    this.isHovered = false;
    this.isLockedToRunway = Boolean(opts.isLockedToRunway);
    this.lockedRunwayId = opts.lockedRunwayId || null;
    this.invalidApproachFlash = 0;

    // Airspace entry & boundary reflection state
    this.hasEnteredAirspace =
      opts.hasEnteredAirspace !== undefined
        ? Boolean(opts.hasEnteredAirspace)
        : Math.abs(this.x) <= 445 && Math.abs(this.y) <= 285;
    this.isTurningBackFromEdge = false;

    // Flight lifecycle & touchdown state ('FLYING' | 'LANDING' | 'LANDED' | 'CRASHED')
    this.state = opts.state || 'FLYING';
    this.landingRunway = opts.landingRunway || null;
    this.landingProgress = Number.isFinite(opts.landingProgress)
      ? opts.landingProgress
      : 0;
    this.landingDuration = Number.isFinite(opts.landingDuration)
      ? opts.landingDuration
      : 1.65;
    this.touchdownStartX = this.x;
    this.touchdownStartY = this.y;
    this.touchdownStartHeading = this.heading;
    this.praiseText = null;

    // Proximity & collision flags (used by TrafficAndCollisionDirector & FlightRenderEngine)
    this.inProximityWarning = false;
    this.conflictPartners = [];
    this.closestConflictDist = Infinity;
    this.isCrashed = false;
  }

  /**
   * Returns current 2.5D drop-shadow offset in world units.
   * Shrinks from `shadowBaseOffset` at altitude 1.0 down to `1.5` px directly
   * under the wheels at touchdown (altitude 0.0).
   * @return {{x: number, y: number, distance: number}}
   */
  getShadowOffset() {
    const dist = lerp(1.5, this.shadowBaseOffset, clamp(this.altitude, 0, 1));
    return {
      x: dist,
      y: -dist,
      distance: dist,
    };
  }

  /**
   * Returns combined class scale and landing descent scale.
   * @return {number}
   */
  getEffectiveScale() {
    return this.scale * this.visualScale;
  }

  /**
   * Replaces current flight path waypoints.
   * @param {Array<{x: number, y: number}>} waypoints
   * @param {boolean=} isLocked
   * @param {string|null=} lockedRunwayId
   */
  setPath(waypoints, isLocked = false, lockedRunwayId = null) {
    if (this.state !== 'FLYING') return;
    this.pathWaypoints = Array.isArray(waypoints)
      ? waypoints.map((pt) => ({ x: Number(pt.x), y: Number(pt.y) }))
      : [];
    this.isLockedToRunway = Boolean(isLocked);
    this.lockedRunwayId = isLocked ? lockedRunwayId : null;
  }

  /**
   * Clears all active flight path waypoints and runway lock state.
   */
  clearPath() {
    this.pathWaypoints = [];
    this.isLockedToRunway = false;
    this.lockedRunwayId = null;
  }
}

/**
 * Manages aircraft movement, look-ahead spline tracking, turn-rate clamping,
 * realistic banking, screen-edge turnback, and runway glide-slope touchdown sequences.
 */
export class FlightKinematicsSystem {
  /**
   * @param {Object=} options
   */
  constructor(options = {}) {
    this.callbacks = {
      onTouchdownStart:
        options.onTouchdownStart ||
        (options.callbacks && options.callbacks.onTouchdownStart) ||
        null,
      onLandingComplete:
        options.onLandingComplete ||
        (options.callbacks && options.callbacks.onLandingComplete) ||
        null,
    };
    this.getRunways = options.getRunways || null;
    this._praiseIndex = 0;
  }

  /**
   * Updates or merges lifecycle callbacks.
   * @param {Object} callbacks
   */
  setCallbacks(callbacks = {}) {
    if (typeof callbacks.onTouchdownStart === 'function') {
      this.callbacks.onTouchdownStart = callbacks.onTouchdownStart;
    }
    if (typeof callbacks.onLandingComplete === 'function') {
      this.callbacks.onLandingComplete = callbacks.onLandingComplete;
    }
  }

  /**
   * Instantiates a new AircraftEntity.
   * @param {Object|string} configOrClassId
   * @param {number=} x
   * @param {number=} y
   * @param {number=} heading
   * @param {string|number=} id
   * @return {!AircraftEntity}
   */
  createAircraft(configOrClassId, x, y, heading, id) {
    return new AircraftEntity(configOrClassId, x, y, heading, id);
  }

  /**
   * Selects the next authentic Aussie / Argon landing praise string.
   * @return {string}
   */
  nextPraiseText() {
    const text =
      AUSSIE_PRAISE_STRINGS[this._praiseIndex % AUSSIE_PRAISE_STRINGS.length];
    this._praiseIndex = (this._praiseIndex + 1) % AUSSIE_PRAISE_STRINGS.length;
    return text;
  }

  /**
   * Steps all aircraft forward by `dt` seconds.
   * Supports flexible argument ordering:
   * - `update(planes, runways, dt, callbacks)`
   * - `update(planes, dt, runways, callbacks)`
   * - `update(dt, planes, runways, callbacks)`
   *
   * @param {Array<!AircraftEntity>|number} arg1
   * @param {Array<Object>|number=} arg2
   * @param {number|Array<Object>=} arg3
   * @param {Object=} callbacksOverride
   */
  update(arg1, arg2, arg3, callbacksOverride) {
    let planes = [];
    let runways = [];
    let dt = 1 / 60;

    if (typeof arg1 === 'number') {
      dt = arg1;
      planes = Array.isArray(arg2) ? arg2 : [];
      runways = Array.isArray(arg3)
        ? arg3
        : typeof this.getRunways === 'function'
          ? this.getRunways()
          : [];
    } else if (Array.isArray(arg1)) {
      planes = arg1;
      if (typeof arg2 === 'number') {
        dt = arg2;
        runways = Array.isArray(arg3)
          ? arg3
          : typeof this.getRunways === 'function'
            ? this.getRunways()
            : [];
      } else {
        runways = Array.isArray(arg2)
          ? arg2
          : typeof this.getRunways === 'function'
            ? this.getRunways()
            : [];
        dt = typeof arg3 === 'number' ? arg3 : 1 / 60;
      }
    }

    const clampedDt = clamp(Number.isFinite(dt) ? dt : 1 / 60, 0.0001, 0.1);
    const activeCallbacks = callbacksOverride
      ? { ...this.callbacks, ...callbacksOverride }
      : this.callbacks;

    for (let i = 0; i < planes.length; i++) {
      const plane = planes[i];
      if (!plane || plane.state === 'LANDED' || plane.isCrashed || plane.state === 'CRASHED') {
        continue;
      }
      this.updateAircraft(plane, runways, clampedDt, activeCallbacks);
    }
  }

  /**
   * Updates a single aircraft entity for one frame (`dt` seconds).
   * @param {!AircraftEntity} plane
   * @param {Array<Object>} runways
   * @param {number} dt
   * @param {Object=} callbacks
   */
  updateAircraft(plane, runways = [], dt = 1 / 60, callbacks = this.callbacks) {
    plane.flightTime = (plane.flightTime || 0) + dt;

    if (plane.invalidApproachFlash > 0) {
      plane.invalidApproachFlash = Math.max(0, plane.invalidApproachFlash - dt);
    }

    // Advance propeller / rotor visual spin angle
    const spinRate = plane.hasRotor ? 26.0 : plane.hasPropeller ? 38.0 : 0.0;
    if (spinRate > 0) {
      const speedFactor =
        plane.state === 'LANDING'
          ? Math.max(0.35, 1.0 - plane.landingProgress * 0.65)
          : 1.0;
      plane.propAngle = (plane.propAngle + spinRate * speedFactor * dt) % TWO_PI;
    }

    if (plane.state === 'LANDING') {
      this.updateLandingRollout(plane, dt, callbacks);
      return;
    }

    if (plane.state !== 'FLYING') {
      return;
    }

    // 1. Check if aircraft has crossed into the active airspace interior
    if (
      !plane.hasEnteredAirspace &&
      Math.abs(plane.x) <= 445 &&
      Math.abs(plane.y) <= 285
    ) {
      plane.hasEnteredAirspace = true;
    }

    // 2. Check for Runway / Helipad Touchdown Capture before stepping
    if (this.checkRunwayTouchdown(plane, runways, callbacks)) {
      this.updateLandingRollout(plane, dt, callbacks);
      return;
    }

    // 3. Follow pathWaypoints with look-ahead carrot or maintain linear vector
    let desiredHeading = plane.heading;
    let hasGuidanceTarget = false;

    if (Array.isArray(plane.pathWaypoints) && plane.pathWaypoints.length > 0) {
      const targetPt = this._computeLookAheadCarrot(plane);
      if (targetPt) {
        const dx = targetPt.x - plane.x;
        const dy = targetPt.y - plane.y;
        if (dx * dx + dy * dy > 1e-4) {
          desiredHeading = Math.atan2(dy, dx);
          hasGuidanceTarget = true;
        }
      }
    }

    // 4. Airspace Boundary Reflection (Safe Screen-Edge Turnback)
    // Once inside the active playfield, if an aircraft approaches the screen boundary
    // (|x| > 442 or |y| > 282) with an outward velocity component, latch a smooth
    // recovery turn back toward the airfield interior and clear all active waypoints
    // so it never gets trapped in a corner or edge loop.
    const cosH = Math.cos(plane.heading);
    const sinH = Math.sin(plane.heading);
    const breachingX =
      plane.hasEnteredAirspace &&
      Math.abs(plane.x) > 442 &&
      plane.x * cosH > -10;
    const breachingY =
      plane.hasEnteredAirspace &&
      Math.abs(plane.y) > 282 &&
      plane.y * sinH > -10;

    if (breachingX || breachingY) {
      if (!plane.isTurningBackFromEdge) {
        plane.isTurningBackFromEdge = true;
        // Aim toward an interior point slightly offset from center
        plane.edgeTurnbackHeading = Math.atan2(-plane.y * 0.72, -plane.x * 0.72);
      }
      // Clear any active path waypoints so the plane isn't pulled back into the wall
      if (Array.isArray(plane.pathWaypoints) && plane.pathWaypoints.length > 0) {
        plane.pathWaypoints.length = 0;
        plane.isLockedToRunway = false;
        plane.lockedRunwayId = null;
        plane.lockedRunway = null;
      }
    }

    if (plane.isTurningBackFromEdge) {
      const recoveryHeading = Number.isFinite(plane.edgeTurnbackHeading)
        ? plane.edgeTurnbackHeading
        : Math.atan2(-plane.y * 0.72, -plane.x * 0.72);
      const headingErr = Math.abs(normalizeAngle(recoveryHeading - plane.heading));
      const safelyInside = Math.abs(plane.x) <= 430 && Math.abs(plane.y) <= 270;
      if (safelyInside && headingErr <= 0.32) {
        plane.isTurningBackFromEdge = false;
      } else {
        desiredHeading = recoveryHeading;
        hasGuidanceTarget = true;
      }
    }

    plane.desiredHeading = desiredHeading;

    // 5. Kinematic Turn Constraint & Realistic Exponentially Damped Banking
    const bankSmoothAlpha = 1 - Math.exp(-10 * dt);
    if (hasGuidanceTarget) {
      const angleDiff = normalizeAngle(desiredHeading - plane.heading);
      const effectiveTurnRate = plane.isTurningBackFromEdge
        ? Math.max(plane.maxTurnRate * 1.4, 3.2)
        : plane.maxTurnRate;
      const maxDelta = effectiveTurnRate * dt;
      const actualDelta = clamp(angleDiff, -maxDelta, maxDelta);
      plane.heading = normalizeAngle(plane.heading + actualDelta);

      const turnRate = actualDelta / Math.max(dt, 0.0001);
      plane.turnRate = turnRate;
      const targetBank =
        clamp(turnRate / plane.maxTurnRate, -1, 1) * plane.maxBankRad;
      plane.bankAngle += (targetBank - plane.bankAngle) * bankSmoothAlpha;
    } else {
      plane.turnRate = 0;
      plane.bankAngle += (0 - plane.bankAngle) * bankSmoothAlpha;
      if (Math.abs(plane.bankAngle) < 0.001) {
        plane.bankAngle = 0;
      }
    }

    // 6. Advance position along current heading
    plane.speed = plane.baseSpeed;
    plane.vx = Math.cos(plane.heading) * plane.speed;
    plane.vy = Math.sin(plane.heading) * plane.speed;
    plane.x += plane.vx * dt;
    plane.y += plane.vy * dt;

    // Hard safety clamp for aircraft that have already entered the airspace
    if (plane.hasEnteredAirspace) {
      plane.x = clamp(plane.x, -468, 468);
      plane.y = clamp(plane.y, -308, 308);
    }

    // Keep airborne altitude, scale, and shadow offsets synced
    plane.altitude = 1.0;
    plane.visualScale = 1.0;
    plane.opacity = 1.0;
    const shadow = plane.getShadowOffset();
    plane.shadowOffsetX = shadow.x;
    plane.shadowOffsetY = shadow.y;

    // 7. Re-check touchdown after position step so fast jets don't skip past thresholds
    this.checkRunwayTouchdown(plane, runways, callbacks);
  }

  /**
   * Prunes passed or Dubins-unreachable waypoints inside the aircraft's turning
   * circle and advances a look-ahead carrot along `plane.pathWaypoints`.
   * Guarantees zero circular orbiting loops even when the user drags a path
   * 180 degrees opposite the aircraft's initial heading.
   *
   * @param {!AircraftEntity} plane
   * @return {{x: number, y: number}|null}
   * @private
   */
  _computeLookAheadCarrot(plane) {
    const waypoints = plane.pathWaypoints;
    if (!Array.isArray(waypoints) || waypoints.length === 0) {
      return null;
    }

    // Strip any temporary visual nose anchor prepended by FlightPathInputSystem
    while (waypoints.length > 0 && waypoints[0] && waypoints[0].isNoseAnchor) {
      waypoints.shift();
    }
    if (waypoints.length === 0) {
      return null;
    }

    const px = plane.x;
    const py = plane.y;
    const cosH = Math.cos(plane.heading);
    const sinH = Math.sin(plane.heading);

    // Minimum turning radius R_min = speed / maxTurnRate
    const minTurnRadius =
      (plane.speed || 52) / Math.max(0.8, plane.maxTurnRate || 2.8);
    // Centers of the left and right minimum turning circles tangent to plane heading
    const leftCircleX = px - sinH * minTurnRadius;
    const leftCircleY = py + cosH * minTurnRadius;
    const rightCircleX = px + sinH * minTurnRadius;
    const rightCircleY = py - cosH * minTurnRadius;

    const directCaptureRadius = Math.max(16.0, minTurnRadius * 0.58);

    // 1. If the aircraft is already close to a slightly later waypoint along the initial
    // turn arc (up to 10 waypoints ahead), jump forward to that waypoint so it never
    // loops back to chase the tail of its own spline.
    const maxScan = Math.min(waypoints.length - 1, 10);
    let jumpIdx = 0;
    for (let k = 1; k <= maxScan; k++) {
      const wk = waypoints[k];
      const dk = Math.hypot(wk.x - px, wk.y - py);
      if (dk <= directCaptureRadius) {
        jumpIdx = k;
      }
    }
    if (jumpIdx > 0) {
      waypoints.splice(0, jumpIdx);
    }

    // 2. Prune passed waypoints and any intermediate waypoints trapped inside the
    // aircraft's left/right Dubins turning circles or rear hemisphere (which would otherwise cause an orbit loop).
    while (waypoints.length > 0) {
      const wp0 = waypoints[0];
      const dx0 = wp0.x - px;
      const dy0 = wp0.y - py;
      const d0 = Math.hypot(dx0, dy0);
      const fwdDot0 = dx0 * cosH + dy0 * sinH;

      // Check if wp0 is inside either minimum turning circle or behind the wing
      const dLeft = Math.hypot(wp0.x - leftCircleX, wp0.y - leftCircleY);
      const dRight = Math.hypot(wp0.x - rightCircleX, wp0.y - rightCircleY);
      const insideTurningCircle =
        Math.min(dLeft, dRight) < minTurnRadius * 1.12 &&
        fwdDot0 < minTurnRadius * 0.75;
      const behindAircraft = fwdDot0 < 3.0 && d0 <= minTurnRadius * 1.48;

      if (waypoints.length > 1) {
        // Also check projection onto segment wp0 -> wp1
        const wp1 = waypoints[1];
        const segDx = wp1.x - wp0.x;
        const segDy = wp1.y - wp0.y;
        const segLenSq = segDx * segDx + segDy * segDy;
        const passedSegment =
          segLenSq > 1e-4 &&
          (px - wp0.x) * segDx + (py - wp0.y) * segDy >= segLenSq * 0.45 &&
          d0 <= minTurnRadius * 1.45;

        if (d0 <= directCaptureRadius || insideTurningCircle || behindAircraft || passedSegment) {
          waypoints.shift();
          continue;
        }
        break;
      } else {
        // Final waypoint (waypoints.length === 1)
        if (plane.isLockedToRunway) {
          // For a runway-locked aircraft, keep the final threshold waypoint unless we've
          // already passed right over it (< 6 units) or blown past it into the rear hemisphere
          if (d0 <= 6.0 || (d0 <= minTurnRadius * 1.35 && fwdDot0 < -6.0)) {
            waypoints.length = 0;
            plane.isLockedToRunway = false;
            plane.lockedRunwayId = null;
          }
          break;
        } else {
          // For an unlocked path, finish cleanly as soon as the final waypoint is reached
          // or slips behind the wing inside the turning circle
          if (
            d0 <= directCaptureRadius ||
            (insideTurningCircle && fwdDot0 < 5.0) ||
            (d0 <= minTurnRadius * 1.48 && fwdDot0 < 0.0)
          ) {
            waypoints.length = 0;
          }
          break;
        }
      }
    }

    if (waypoints.length === 0) {
      return null;
    }

    const lookAheadDist = Math.max(20, plane.speed * 0.34);
    let remaining = lookAheadDist;
    let prevX = px;
    let prevY = py;

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const segDx = wp.x - prevX;
      const segDy = wp.y - prevY;
      const segLen = Math.hypot(segDx, segDy);

      if (segLen < 1e-4) {
        continue;
      }

      if (segLen >= remaining) {
        const t = remaining / segLen;
        return {
          x: prevX + segDx * t,
          y: prevY + segDy * t,
        };
      }

      remaining -= segLen;
      prevX = wp.x;
      prevY = wp.y;
    }

    const lastWp = waypoints[waypoints.length - 1];
    return { x: lastWp.x, y: lastWp.y };
  }

  /**
   * Determines whether `plane` is compatible with `runway`.
   * Checks `plane.runwayColor === runway.colorKey` or shared blue/yellow prop
   * runway fallback.
   *
   * @param {!AircraftEntity} plane
   * @param {!Object} runway
   * @param {Array<Object>=} allRunways
   * @return {boolean}
   */
  isRunwayCompatible(plane, runway, allRunways = []) {
    if (!plane || !runway) return false;

    // Explicit lock to this runway from FlightPathInputSystem
    if (plane.isLockedToRunway && plane.lockedRunwayId === runway.id) {
      return true;
    }

    // Direct colorKey match ('red', 'green', 'yellow', 'blue', 'blue_heli')
    if (plane.runwayColor && runway.colorKey && plane.runwayColor === runway.colorKey) {
      return true;
    }

    // Allowed classes list on the runway definition
    if (
      Array.isArray(runway.allowedClasses) &&
      runway.allowedClasses.includes(plane.classId)
    ) {
      // If a map has a dedicated runway matching plane.runwayColor, prefer exact color match
      // unless the plane was locked or no exact-color runway exists on this map
      const hasExactColorRunway =
        Array.isArray(allRunways) &&
        allRunways.some((r) => r && r.colorKey === plane.runwayColor);
      if (!hasExactColorRunway) {
        return true;
      }
      // Shared blue/yellow prop compatibility when aligned with threshold
      if (
        (plane.classId === 'prop_yellow' || plane.classId === 'prop_blue') &&
        (runway.colorKey === 'yellow' || runway.colorKey === 'blue')
      ) {
        return true;
      }
    }

    // Fallback when a map shares a single blue/yellow prop runway
    const isPropPlane =
      plane.classId === 'prop_yellow' ||
      plane.classId === 'prop_blue' ||
      plane.runwayColor === 'yellow' ||
      plane.runwayColor === 'blue';
    const isPropRunway =
      !runway.isHelipad &&
      !runway.isWaterRunway &&
      (runway.colorKey === 'yellow' || runway.colorKey === 'blue');

    if (isPropPlane && isPropRunway) {
      const hasExactColorRunway =
        Array.isArray(allRunways) &&
        allRunways.some((r) => r && r.colorKey === plane.runwayColor);
      if (!hasExactColorRunway) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks a `FLYING` aircraft against all compatible runways and triggers
   * the `LANDING` touchdown sequence when within the threshold capture zone.
   *
   * @param {!AircraftEntity} plane
   * @param {Array<Object>} runways
   * @param {Object=} callbacks
   * @return {boolean} True if touchdown was triggered.
   */
  checkRunwayTouchdown(plane, runways = [], callbacks = this.callbacks) {
    if (!plane || plane.state !== 'FLYING' || !Array.isArray(runways)) {
      return false;
    }

    for (let i = 0; i < runways.length; i++) {
      const runway = runways[i];
      if (!runway || !this.isRunwayCompatible(plane, runway, runways)) {
        continue;
      }

      const thresholdX = Number.isFinite(runway.thresholdX)
        ? runway.thresholdX
        : Number(runway.x) || 0;
      const thresholdY = Number.isFinite(runway.thresholdY)
        ? runway.thresholdY
        : Number(runway.y) || 0;
      const distToThreshold = Math.hypot(
        plane.x - thresholdX,
        plane.y - thresholdY
      );

      const isLockedToThisRunway =
        Boolean(plane.isLockedToRunway) && plane.lockedRunwayId === runway.id;
      const captureRadius = isLockedToThisRunway ? 42 : 34;

      if (distToThreshold > captureRadius) {
        continue;
      }

      const isHelipadCapture = Boolean(runway.isHelipad) && distToThreshold <= 32;

      let isLinearAligned = false;
      if (!runway.isHelipad) {
        const rHeading = Number.isFinite(runway.heading)
          ? runway.heading
          : Math.atan2(
              (runway.endY ?? thresholdY) - thresholdY,
              (runway.endX ?? thresholdX + 100) - thresholdX
            );
        const headingDiff = Math.abs(normalizeAngle(plane.heading - rHeading));
        isLinearAligned = headingDiff <= 0.72;
      }

      if (isLockedToThisRunway || isHelipadCapture || isLinearAligned) {
        this._beginTouchdown(plane, runway, callbacks);
        return true;
      }
    }

    return false;
  }

  /**
   * Transitions `plane` into `state = 'LANDING'` and fires `onTouchdownStart`.
   * @param {!AircraftEntity} plane
   * @param {!Object} runway
   * @param {Object=} callbacks
   * @private
   */
  _beginTouchdown(plane, runway, callbacks = this.callbacks) {
    plane.state = 'LANDING';
    plane.landingRunway = runway;
    plane.landingProgress = 0;
    plane.landingDuration = 1.65;
    plane.touchdownStartX = plane.x;
    plane.touchdownStartY = plane.y;
    plane.touchdownStartHeading = plane.heading;
    plane.pathWaypoints = [];
    plane.isSelected = false;
    plane.inProximityWarning = false;
    plane.conflictPartners = [];
    plane.closestConflictDist = Infinity;

    const praiseText = this.nextPraiseText();
    plane.praiseText = praiseText;

    const cb =
      (callbacks && callbacks.onTouchdownStart) ||
      this.callbacks.onTouchdownStart;
    if (typeof cb === 'function') {
      cb(plane, runway, praiseText);
    }
  }

  /**
   * Updates an aircraft in `state === 'LANDING'` along its 1.65s glide-slope
   * descent, centerline alignment, deceleration, scale reduction, shadow
   * convergence, and final 30% opacity fade-out.
   *
   * @param {!AircraftEntity} plane
   * @param {number} dt
   * @param {Object=} callbacks
   */
  updateLandingRollout(plane, dt, callbacks = this.callbacks) {
    if (!plane || plane.state !== 'LANDING') return;

    const runway = plane.landingRunway || {};
    const duration = plane.landingDuration || 1.65;
    plane.landingProgress = clamp(plane.landingProgress + dt / duration, 0, 1);
    const p = plane.landingProgress;

    const thresholdX = Number.isFinite(runway.thresholdX)
      ? runway.thresholdX
      : plane.touchdownStartX;
    const thresholdY = Number.isFinite(runway.thresholdY)
      ? runway.thresholdY
      : plane.touchdownStartY;

    if (runway.isHelipad) {
      // Helipad vertical spiral/settle onto (thresholdX, thresholdY)
      const settleT = smoothstep01(Math.min(1, p / 0.68));
      const initialOffsetDist = Math.min(
        20,
        Math.hypot(
          plane.touchdownStartX - thresholdX,
          plane.touchdownStartY - thresholdY
        )
      );
      const spiralRadius = (1 - settleT) * initialOffsetDist * 0.35;
      const spiralAngle = plane.touchdownStartHeading + p * 2.4;

      plane.x =
        lerp(plane.touchdownStartX, thresholdX, settleT) +
        Math.cos(spiralAngle) * spiralRadius;
      plane.y =
        lerp(plane.touchdownStartY, thresholdY, settleT) +
        Math.sin(spiralAngle) * spiralRadius;

      // Gentle yaw settle and level bank
      plane.heading = normalizeAngle(plane.heading + (1 - settleT) * 0.6 * dt);
      plane.bankAngle *= Math.exp(-12 * dt);
      plane.turnRate = 0;

      // Lower altitude 1.0 -> 0.0 and shrink visualScale 1.0 -> 0.62
      plane.altitude = clamp(1.0 - smoothstep01(Math.min(1, p / 0.72)), 0, 1);
      plane.visualScale = lerp(1.0, 0.62, easeOutQuad(p));
      plane.speed = plane.baseSpeed * Math.max(0, 1.0 - p * 1.25);
    } else {
      // Linear runway centerline rollout from (thresholdX, thresholdY) toward (endX, endY)
      const rHeading = Number.isFinite(runway.heading)
        ? runway.heading
        : Math.atan2(
            (runway.endY ?? thresholdY) - thresholdY,
            (runway.endX ?? thresholdX + 180) - thresholdX
          );
      const endX = Number.isFinite(runway.endX)
        ? runway.endX
        : thresholdX + Math.cos(rHeading) * (runway.length || 180);
      const endY = Number.isFinite(runway.endY)
        ? runway.endY
        : thresholdY + Math.sin(rHeading) * (runway.length || 180);

      // Decelerating rollout distance along centerline (0 -> 88% of runway length)
      const rolloutS = (1 - Math.pow(1 - p, 2.2)) * 0.88;
      const centerX = lerp(thresholdX, endX, rolloutS);
      const centerY = lerp(thresholdY, endY, rolloutS);

      // Smoothly pull initial threshold offset onto the exact runway centerline over first 28%
      const alignT = smoothstep01(Math.min(1, p / 0.28));
      const startOffsetX = plane.touchdownStartX - thresholdX;
      const startOffsetY = plane.touchdownStartY - thresholdY;

      plane.x = centerX + startOffsetX * (1 - alignT);
      plane.y = centerY + startOffsetY * (1 - alignT);

      // Align heading to runway heading and level wings (bankAngle -> 0)
      plane.heading = lerpAngle(plane.heading, rHeading, 1 - Math.exp(-12 * dt));
      plane.bankAngle *= Math.exp(-14 * dt);
      plane.turnRate = 0;

      // Lower altitude from 1.0 to 0.0 (shrinking shadow offset down to 1.5 px under wheels)
      plane.altitude = clamp(1.0 - smoothstep01(Math.min(1, p / 0.60)), 0, 1);

      // Scale visualScale from 1.0 down to 0.58
      plane.visualScale = lerp(1.0, 0.58, easeOutQuad(p));

      // Smoothly decelerate speed
      plane.speed = plane.baseSpeed * Math.max(0.06, (1 - p) * (1 - p));
    }

    plane.vx = Math.cos(plane.heading) * plane.speed;
    plane.vy = Math.sin(plane.heading) * plane.speed;

    // Update drop-shadow offset from shadowBaseOffset down to 1.5 px directly under wheels
    const shadow = plane.getShadowOffset();
    plane.shadowOffsetX = shadow.x;
    plane.shadowOffsetY = shadow.y;

    // Fade opacity to 0.0 over the final 30% of rollout (p in [0.70, 1.0])
    if (p < 0.70) {
      plane.opacity = 1.0;
    } else {
      plane.opacity = clamp(1.0 - (p - 0.70) / 0.30, 0.0, 1.0);
    }

    // Complete landing when landingProgress >= 1.0
    if (plane.landingProgress >= 1.0) {
      plane.state = 'LANDED';
      plane.altitude = 0.0;
      plane.opacity = 0.0;
      plane.speed = 0.0;
      plane.vx = 0.0;
      plane.vy = 0.0;
      plane.bankAngle = 0.0;

      const cb =
        (callbacks && callbacks.onLandingComplete) ||
        this.callbacks.onLandingComplete;
      if (typeof cb === 'function') {
        cb(plane, runway);
      }
    }
  }
}

// Attach exports to window for global access in bundled / browser environments
if (typeof window !== 'undefined') {
  window.AIRCRAFT_CLASSES = AIRCRAFT_CLASSES;
  window.AUSSIE_PRAISE_STRINGS = AUSSIE_PRAISE_STRINGS;
  window.AircraftEntity = AircraftEntity;
  window.FlightKinematicsSystem = FlightKinematicsSystem;
  window.normalizeAngle = normalizeAngle;
}
