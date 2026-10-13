// ============================================================================
// Argon Tennis — Argon Tennis Racket Kinematics & Wrist Whip Physics System
// ============================================================================
// Replaces static linear racket interpolation with a frantic, controller-driven
// angular/translational spring-damper wrist whip solver, continuous Motion Controller
// figure-8 idle micro-waggle, inertial footwork lag, automatic anticipation
// backswing coiling, non-linear explosive stroke arcs, and 45Hz impact recoil.
// ============================================================================

import * as THREE from 'three';

// Default rest pose of the right-hand racket pivot & off-hand in actor.root local space:
// In Three.js right-handed coordinates (`+X` right, `+Y` up, `+Z` forward toward net in actor.root):
//  - `local -X` (`x < 0`) is the Mii's anatomical RIGHT side (Forehand side, Screen RIGHT for near player with rotation.y = Math.PI)
//  - `local +X` (`x > 0`) is the Mii's anatomical LEFT side (Backhand side, Screen LEFT for near player with rotation.y = Math.PI)
const REST_GRIP_POS = new THREE.Vector3(-0.36, 0.90, 0.16);
const REST_GRIP_ROT = new THREE.Euler(0.36, -0.22, 0.48, 'XYZ');
const REST_OFFHAND_POS = new THREE.Vector3(0.33, 0.82, 0.14);

// Backhand ready-stance pose (two-handed backhand preparation on local +X / Screen LEFT)
const REST_GRIP_BACKHAND_POS = new THREE.Vector3(0.36, 0.89, 0.16);
const REST_GRIP_BACKHAND_ROT = new THREE.Euler(0.36, 0.22, -0.48, 'XYZ');
const REST_OFFHAND_BACKHAND_POS = new THREE.Vector3(0.30, 0.93, 0.18);

// Local coordinates along `tennis_racket.glb` mesh (Y-axis extends from butt cap to hoop tip)
const LOCAL_RACKET_THROAT = new THREE.Vector3(0.0, 0.345, 0.0);
const LOCAL_RACKET_CENTER = new THREE.Vector3(0.0, 0.545, 0.0);
const LOCAL_RACKET_TIP = new THREE.Vector3(0.0, 0.755, 0.0);
const LOCAL_RACKET_NORMAL = new THREE.Vector3(0.0, 0.0, 1.0);

// Fallback local points relative to `actor.racketPivot` when `racketMesh` is not yet attached
const PIVOT_FALLBACK_THROAT = new THREE.Vector3(0.0, 0.42, 0.08);
const PIVOT_FALLBACK_CENTER = new THREE.Vector3(0.0, 0.66, 0.12);
const PIVOT_FALLBACK_TIP = new THREE.Vector3(0.0, 0.92, 0.16);

// Reusable scratch vectors/matrices to avoid per-frame GC pressure
const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpVecC = new THREE.Vector3();
const _tmpStancePos = new THREE.Vector3();
const _tmpStanceOffPos = new THREE.Vector3();
const _tmpNormalMat = new THREE.Matrix3();

/**
 * Clamps `val` to `[min, max]`.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Smooth C2 Quintic step (`0..1`).
 */
function smootherstep(t) {
  const x = clamp(t, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

/**
 * Evaluates a quadratic Bezier curve across 3 `THREE.Vector3` control points.
 */
function evalQuadBezierVec3(out, p0, p1, p2, t) {
  const u = clamp(t, 0.0, 1.0);
  const inv = 1.0 - u;
  const b0 = inv * inv;
  const b1 = 2.0 * inv * u;
  const b2 = u * u;
  out.set(
    p0.x * b0 + p1.x * b1 + p2.x * b2,
    p0.y * b0 + p1.y * b1 + p2.y * b2,
    p0.z * b0 + p1.z * b1 + p2.z * b2
  );
  return out;
}

/**
 * Normalizes any shot type string into the canonical set:
 * `'topspin' | 'slice' | 'flat' | 'smash' | 'lob' | 'serve'`
 */
function normalizeShotType(rawShotType, isServe = false) {
  if (isServe) return 'serve';
  const s = String(rawShotType || 'topspin').trim().toLowerCase();
  if (s === 'serve') return 'serve';
  if (s === 'slice' || s === 'cut' || s === 'backspin') return 'slice';
  if (s === 'lob' || s === 'scoop') return 'lob';
  if (s === 'smash' || s === 'power' || s === 'overhead') return 'smash';
  if (s === 'flat' || s === 'drive') return 'flat';
  return 'topspin';
}

/**
 * Normalizes swing side into `'forehand' | 'backhand' | 'overhead'`.
 */
function normalizeSwingSide(rawSide, shotType = 'topspin', isServe = false) {
  if (isServe || shotType === 'serve' || shotType === 'smash') {
    const s = String(rawSide || '').trim().toLowerCase();
    if (s === 'forehand' || s === 'backhand') {
      return shotType === 'serve' ? 'overhead' : s;
    }
    return 'overhead';
  }
  const s = String(rawSide || 'forehand').trim().toLowerCase();
  if (s === 'backhand' || s === 'left' || s === 'bh') return 'backhand';
  if (s === 'overhead' || s === 'smash' || s === 'serve') return 'overhead';
  return 'forehand';
}

/**
 * Normalizes timing quality into `'early' | 'sweet' | 'late'`.
 */
function normalizeTimingQuality(rawTiming) {
  const s = String(rawTiming || 'sweet').trim().toLowerCase();
  if (s.includes('early')) return 'early';
  if (s.includes('late')) return 'late';
  return 'sweet';
}

/**
 * Stroke keyframe profiles in `actor.root` local space:
 *  - `-X`: Mii anatomical right-hand (forehand) side (Screen RIGHT for near player with rotation.y = Math.PI)
 *  - `+X`: Mii anatomical left-hand (backhand) side (Screen LEFT for near player with rotation.y = Math.PI)
 *  - `+Y`: Vertical height above ground (`0.52` knee scoop .. `1.54` trophy serve apex)
 *  - `+Z`: Forward in front of chest toward the net (`-Z` is behind the hip/back)
 *
 * Notice how `rotation.z` tilts the `+Y` racket shaft:
 *  - `rot.z > 0` (`+0.62..+0.78`) tips the `+Y` shaft toward `-X` (extending the racket head out to the Forehand / Screen-Right side!)
 *  - `rot.z < 0` (`-0.62..-0.78`) tips the `+Y` shaft toward `+X` (extending the racket head out to the Backhand / Screen-Left side!)
 */
const STROKE_PROFILES = {
  topspin: {
    forehand: {
      baseDuration: 0.33,
      peakSpeedBase: 23.5,
      windupPos: new THREE.Vector3(-0.48, 0.66, -0.22),
      apexPos: new THREE.Vector3(-0.54, 0.84, 0.24),
      contactPos: new THREE.Vector3(-0.44, 0.98, 0.48),
      carryPos: new THREE.Vector3(-0.04, 1.22, 0.50),
      followPos: new THREE.Vector3(0.36, 1.32, 0.28),
      windupRot: new THREE.Vector3(-0.48, -0.68, 0.68),
      lagRot: new THREE.Vector3(-0.62, -0.82, 0.82),
      contactRot: new THREE.Vector3(0.42, 0.24, 0.68),
      followRot: new THREE.Vector3(0.86, 1.18, -0.82),
      offHandWindup: new THREE.Vector3(0.30, 0.96, 0.32),
      offHandContact: new THREE.Vector3(0.36, 1.02, 0.24),
      offHandFollow: new THREE.Vector3(0.34, 1.18, 0.20),
      arcRot: new THREE.Euler(-Math.PI * 0.32, -0.28, 0.22, 'XYZ'),
    },
    backhand: {
      baseDuration: 0.33,
      peakSpeedBase: 23.2,
      windupPos: new THREE.Vector3(0.48, 0.68, -0.20),
      apexPos: new THREE.Vector3(0.54, 0.84, 0.24),
      contactPos: new THREE.Vector3(0.44, 0.98, 0.48),
      carryPos: new THREE.Vector3(0.04, 1.20, 0.50),
      followPos: new THREE.Vector3(-0.44, 1.28, 0.30),
      windupRot: new THREE.Vector3(-0.48, 0.68, -0.68),
      lagRot: new THREE.Vector3(-0.62, 0.82, -0.82),
      contactRot: new THREE.Vector3(0.42, -0.24, -0.68),
      followRot: new THREE.Vector3(0.86, -1.18, 0.82),
      offHandWindup: new THREE.Vector3(0.42, 0.72, -0.16),
      offHandContact: new THREE.Vector3(0.38, 0.98, 0.44),
      offHandFollow: new THREE.Vector3(0.44, 1.04, -0.18),
      arcRot: new THREE.Euler(-Math.PI * 0.32, 0.28, -0.22, 'XYZ'),
    },
  },
  slice: {
    forehand: {
      baseDuration: 0.35,
      peakSpeedBase: 21.5,
      windupPos: new THREE.Vector3(-0.46, 1.28, -0.18),
      apexPos: new THREE.Vector3(-0.50, 1.08, 0.20),
      contactPos: new THREE.Vector3(-0.42, 0.90, 0.46),
      carryPos: new THREE.Vector3(-0.04, 0.78, 0.44),
      followPos: new THREE.Vector3(0.32, 0.72, 0.36),
      windupRot: new THREE.Vector3(-0.65, -0.56, 0.62),
      lagRot: new THREE.Vector3(-0.74, -0.68, 0.72),
      contactRot: new THREE.Vector3(-0.36, 0.22, 0.66),
      followRot: new THREE.Vector3(-0.18, 1.02, -0.72),
      offHandWindup: new THREE.Vector3(0.30, 1.06, 0.24),
      offHandContact: new THREE.Vector3(0.38, 0.92, 0.14),
      offHandFollow: new THREE.Vector3(0.42, 0.84, 0.04),
      arcRot: new THREE.Euler(-Math.PI * 0.44, -0.14, -0.24, 'XYZ'),
    },
    backhand: {
      baseDuration: 0.35,
      peakSpeedBase: 21.5,
      windupPos: new THREE.Vector3(0.46, 1.28, -0.18),
      apexPos: new THREE.Vector3(0.50, 1.08, 0.20),
      contactPos: new THREE.Vector3(0.42, 0.90, 0.46),
      carryPos: new THREE.Vector3(0.04, 0.78, 0.44),
      followPos: new THREE.Vector3(-0.44, 0.72, 0.36),
      windupRot: new THREE.Vector3(-0.65, 0.56, -0.62),
      lagRot: new THREE.Vector3(-0.74, 0.68, -0.72),
      contactRot: new THREE.Vector3(-0.36, -0.22, -0.66),
      followRot: new THREE.Vector3(-0.18, -1.04, 0.72),
      offHandWindup: new THREE.Vector3(0.40, 1.22, -0.14),
      offHandContact: new THREE.Vector3(0.38, 0.96, 0.28),
      offHandFollow: new THREE.Vector3(0.46, 0.88, -0.22),
      arcRot: new THREE.Euler(-Math.PI * 0.44, 0.14, 0.24, 'XYZ'),
    },
  },
  flat: {
    forehand: {
      baseDuration: 0.28,
      peakSpeedBase: 30.5,
      windupPos: new THREE.Vector3(-0.52, 0.96, -0.24),
      apexPos: new THREE.Vector3(-0.56, 0.98, 0.24),
      contactPos: new THREE.Vector3(-0.46, 1.00, 0.52),
      carryPos: new THREE.Vector3(-0.04, 1.04, 0.48),
      followPos: new THREE.Vector3(0.36, 1.06, 0.32),
      windupRot: new THREE.Vector3(-0.32, -0.76, 0.66),
      lagRot: new THREE.Vector3(-0.46, -0.94, 0.78),
      contactRot: new THREE.Vector3(0.48, 0.30, 0.70),
      followRot: new THREE.Vector3(0.82, 1.28, -0.78),
      offHandWindup: new THREE.Vector3(0.32, 1.02, 0.34),
      offHandContact: new THREE.Vector3(0.40, 0.98, 0.22),
      offHandFollow: new THREE.Vector3(0.36, 1.04, 0.20),
      arcRot: new THREE.Euler(-Math.PI * 0.46, -0.12, 0.12, 'XYZ'),
    },
    backhand: {
      baseDuration: 0.28,
      peakSpeedBase: 30.2,
      windupPos: new THREE.Vector3(0.52, 0.96, -0.24),
      apexPos: new THREE.Vector3(0.56, 0.98, 0.24),
      contactPos: new THREE.Vector3(0.46, 1.00, 0.52),
      carryPos: new THREE.Vector3(0.04, 1.04, 0.48),
      followPos: new THREE.Vector3(-0.46, 1.06, 0.34),
      windupRot: new THREE.Vector3(-0.32, 0.76, -0.66),
      lagRot: new THREE.Vector3(-0.46, 0.94, -0.78),
      contactRot: new THREE.Vector3(0.48, -0.30, -0.70),
      followRot: new THREE.Vector3(0.82, -1.28, 0.78),
      offHandWindup: new THREE.Vector3(0.44, 0.94, -0.18),
      offHandContact: new THREE.Vector3(0.40, 0.98, 0.44),
      offHandFollow: new THREE.Vector3(0.46, 1.02, -0.18),
      arcRot: new THREE.Euler(-Math.PI * 0.46, 0.12, -0.12, 'XYZ'),
    },
    overhead: {
      baseDuration: 0.28,
      peakSpeedBase: 32.5,
      windupPos: new THREE.Vector3(-0.28, 1.52, -0.18),
      apexPos: new THREE.Vector3(-0.32, 1.58, 0.18),
      contactPos: new THREE.Vector3(-0.30, 1.48, 0.42),
      carryPos: new THREE.Vector3(-0.06, 1.16, 0.44),
      followPos: new THREE.Vector3(0.26, 0.86, 0.32),
      windupRot: new THREE.Vector3(-0.88, -0.34, 0.42),
      lagRot: new THREE.Vector3(-1.05, -0.44, 0.52),
      contactRot: new THREE.Vector3(0.28, 0.16, 0.28),
      followRot: new THREE.Vector3(0.92, 0.68, -0.58),
      offHandWindup: new THREE.Vector3(0.22, 1.42, 0.34),
      offHandContact: new THREE.Vector3(0.34, 1.06, 0.24),
      offHandFollow: new THREE.Vector3(0.38, 0.82, 0.12),
      arcRot: new THREE.Euler(-Math.PI * 0.18, -0.32, 0.42, 'XYZ'),
    },
  },
  smash: {
    overhead: {
      baseDuration: 0.28,
      peakSpeedBase: 33.0,
      windupPos: new THREE.Vector3(-0.28, 1.52, -0.18),
      apexPos: new THREE.Vector3(-0.32, 1.58, 0.18),
      contactPos: new THREE.Vector3(-0.30, 1.48, 0.42),
      carryPos: new THREE.Vector3(-0.06, 1.16, 0.44),
      followPos: new THREE.Vector3(0.26, 0.86, 0.32),
      windupRot: new THREE.Vector3(-0.88, -0.34, 0.42),
      lagRot: new THREE.Vector3(-1.05, -0.44, 0.52),
      contactRot: new THREE.Vector3(0.28, 0.16, 0.28),
      followRot: new THREE.Vector3(0.92, 0.68, -0.58),
      offHandWindup: new THREE.Vector3(0.22, 1.42, 0.34),
      offHandContact: new THREE.Vector3(0.34, 1.06, 0.24),
      offHandFollow: new THREE.Vector3(0.38, 0.82, 0.12),
      arcRot: new THREE.Euler(-Math.PI * 0.18, -0.32, 0.42, 'XYZ'),
    },
    forehand: {
      baseDuration: 0.28,
      peakSpeedBase: 31.2,
      windupPos: new THREE.Vector3(-0.46, 1.36, -0.20),
      apexPos: new THREE.Vector3(-0.50, 1.28, 0.22),
      contactPos: new THREE.Vector3(-0.42, 1.16, 0.50),
      carryPos: new THREE.Vector3(-0.02, 0.88, 0.44),
      followPos: new THREE.Vector3(0.32, 0.66, 0.30),
      windupRot: new THREE.Vector3(-0.76, -0.58, 0.56),
      lagRot: new THREE.Vector3(-0.94, -0.72, 0.68),
      contactRot: new THREE.Vector3(0.54, 0.28, 0.58),
      followRot: new THREE.Vector3(1.18, 1.04, -0.72),
      offHandWindup: new THREE.Vector3(0.26, 1.32, 0.32),
      offHandContact: new THREE.Vector3(0.38, 0.98, 0.22),
      offHandFollow: new THREE.Vector3(0.40, 0.78, 0.12),
      arcRot: new THREE.Euler(-Math.PI * 0.24, -0.26, 0.34, 'XYZ'),
    },
    backhand: {
      baseDuration: 0.28,
      peakSpeedBase: 30.8,
      windupPos: new THREE.Vector3(0.46, 1.36, -0.20),
      apexPos: new THREE.Vector3(0.50, 1.28, 0.22),
      contactPos: new THREE.Vector3(0.42, 1.16, 0.50),
      carryPos: new THREE.Vector3(0.02, 0.88, 0.44),
      followPos: new THREE.Vector3(-0.44, 0.66, 0.32),
      windupRot: new THREE.Vector3(-0.76, 0.58, -0.56),
      lagRot: new THREE.Vector3(-0.94, 0.72, -0.68),
      contactRot: new THREE.Vector3(0.54, -0.28, -0.58),
      followRot: new THREE.Vector3(1.18, -1.04, 0.72),
      offHandWindup: new THREE.Vector3(0.40, 1.28, -0.14),
      offHandContact: new THREE.Vector3(0.38, 1.10, 0.42),
      offHandFollow: new THREE.Vector3(0.44, 0.84, -0.18),
      arcRot: new THREE.Euler(-Math.PI * 0.24, 0.26, -0.34, 'XYZ'),
    },
  },
  lob: {
    forehand: {
      baseDuration: 0.38,
      peakSpeedBase: 19.8,
      windupPos: new THREE.Vector3(-0.44, 0.52, -0.18),
      apexPos: new THREE.Vector3(-0.48, 0.68, 0.22),
      contactPos: new THREE.Vector3(-0.40, 0.88, 0.46),
      carryPos: new THREE.Vector3(-0.04, 1.26, 0.46),
      followPos: new THREE.Vector3(0.28, 1.48, 0.34),
      windupRot: new THREE.Vector3(-0.78, -0.46, 0.68),
      lagRot: new THREE.Vector3(-0.92, -0.58, 0.82),
      contactRot: new THREE.Vector3(-0.42, 0.18, 0.64),
      followRot: new THREE.Vector3(0.36, 0.84, -0.62),
      offHandWindup: new THREE.Vector3(0.32, 0.78, 0.26),
      offHandContact: new THREE.Vector3(0.38, 1.02, 0.28),
      offHandFollow: new THREE.Vector3(0.34, 1.32, 0.22),
      arcRot: new THREE.Euler(-Math.PI * 0.22, -0.36, 0.38, 'XYZ'),
    },
    backhand: {
      baseDuration: 0.38,
      peakSpeedBase: 19.6,
      windupPos: new THREE.Vector3(0.44, 0.52, -0.18),
      apexPos: new THREE.Vector3(0.48, 0.68, 0.22),
      contactPos: new THREE.Vector3(0.40, 0.88, 0.46),
      carryPos: new THREE.Vector3(0.04, 1.26, 0.46),
      followPos: new THREE.Vector3(-0.38, 1.48, 0.34),
      windupRot: new THREE.Vector3(-0.78, 0.46, -0.68),
      lagRot: new THREE.Vector3(-0.92, 0.58, -0.82),
      contactRot: new THREE.Vector3(-0.42, -0.18, -0.64),
      followRot: new THREE.Vector3(0.36, -0.84, 0.62),
      offHandWindup: new THREE.Vector3(0.38, 0.56, -0.14),
      offHandContact: new THREE.Vector3(0.36, 0.88, 0.40),
      offHandFollow: new THREE.Vector3(0.42, 1.24, -0.16),
      arcRot: new THREE.Euler(-Math.PI * 0.22, 0.36, -0.38, 'XYZ'),
    },
  },
  serve: {
    overhead: {
      baseDuration: 0.36,
      peakSpeedBase: 31.8,
      windupPos: new THREE.Vector3(-0.28, 1.46, -0.16),
      apexPos: new THREE.Vector3(-0.32, 1.54, 0.16),
      contactPos: new THREE.Vector3(-0.30, 1.52, 0.42),
      carryPos: new THREE.Vector3(-0.02, 1.02, 0.44),
      followPos: new THREE.Vector3(0.30, 0.64, 0.28),
      windupRot: new THREE.Vector3(-0.88, -0.35, 0.45),
      lagRot: new THREE.Vector3(-1.14, -0.46, 0.62),
      contactRot: new THREE.Vector3(0.48, 0.18, 0.26),
      followRot: new THREE.Vector3(1.32, 0.92, -0.68),
      offHandWindup: new THREE.Vector3(0.26, 1.46, 0.36),
      offHandContact: new THREE.Vector3(0.32, 1.06, 0.24),
      offHandFollow: new THREE.Vector3(0.38, 0.78, 0.14),
      arcRot: new THREE.Euler(-Math.PI * 0.16, -0.28, 0.44, 'XYZ'),
    },
  },
};

/**
 * Resolves the stroke profile for `(shotType, side)`.
 */
function getStrokeProfile(shotType, side) {
  const family = STROKE_PROFILES[shotType] || STROKE_PROFILES.topspin;
  return family[side] || family.forehand || family.overhead || STROKE_PROFILES.topspin.forehand;
}

/**
 * Computes world-space sampling points on the racket hoop rim (`tipWorld`, `throatWorld`,
 * `centerWorld`, `normalWorld`, `whipSpeed`, `shotType`) for an actor.
 */
export function getRacketRimWorldPoints(actor) {
  if (!actor) {
    return {
      tipWorld: new THREE.Vector3(0, 1.5, 0),
      throatWorld: new THREE.Vector3(0, 1.1, 0),
      centerWorld: new THREE.Vector3(0, 1.3, 0),
      normalWorld: new THREE.Vector3(0, 0, -1),
      whipSpeed: 0,
      shotType: 'topspin',
    };
  }

  if (actor.root && typeof actor.root.updateMatrixWorld === 'function') {
    actor.root.updateMatrixWorld(true);
  }

  const rk = actor.racketKinematics;
  const tipWorld = rk?.rimPoints?.tipWorld || new THREE.Vector3();
  const throatWorld = rk?.rimPoints?.throatWorld || new THREE.Vector3();
  const centerWorld = rk?.rimPoints?.centerWorld || new THREE.Vector3();
  const normalWorld = rk?.rimPoints?.normalWorld || new THREE.Vector3(0, 0, 1);

  if (actor.racketMesh && actor.racketMesh.matrixWorld) {
    const mw = actor.racketMesh.matrixWorld;
    throatWorld.copy(LOCAL_RACKET_THROAT).applyMatrix4(mw);
    centerWorld.copy(LOCAL_RACKET_CENTER).applyMatrix4(mw);
    tipWorld.copy(LOCAL_RACKET_TIP).applyMatrix4(mw);
    _tmpNormalMat.getNormalMatrix(mw);
    normalWorld.copy(LOCAL_RACKET_NORMAL).applyMatrix3(_tmpNormalMat).normalize();
  } else if (actor.racketPivot && actor.racketPivot.matrixWorld) {
    const mw = actor.racketPivot.matrixWorld;
    throatWorld.copy(PIVOT_FALLBACK_THROAT).applyMatrix4(mw);
    centerWorld.copy(PIVOT_FALLBACK_CENTER).applyMatrix4(mw);
    tipWorld.copy(PIVOT_FALLBACK_TIP).applyMatrix4(mw);
    _tmpNormalMat.getNormalMatrix(mw);
    normalWorld.copy(LOCAL_RACKET_NORMAL).applyMatrix3(_tmpNormalMat).normalize();
  } else {
    const basePos = actor.pos || new THREE.Vector3();
    throatWorld.set(basePos.x + 0.36, basePos.y + 1.12, basePos.z);
    centerWorld.set(basePos.x + 0.36, basePos.y + 1.32, basePos.z);
    tipWorld.set(basePos.x + 0.36, basePos.y + 1.54, basePos.z);
    normalWorld.set(0, 0, actor.sideSign > 0 ? -1 : 1);
  }

  const whipSpeed = rk ? rk.currentWhipSpeed : 0;
  const shotType = rk ? rk.swingShotType : actor.swingType || 'topspin';

  const result = {
    tipWorld,
    throatWorld,
    centerWorld,
    normalWorld,
    whipSpeed,
    shotType,
  };

  if (rk) {
    rk.rimPoints = result;
  }
  return result;
}

/**
 * Argon Tennis Racket Kinematics & Wrist Whip Physics Controller.
 */
export class RacketKinematicsController {
  constructor(options = {}) {
    this.posSpringStiffness = options.posSpringStiffness ?? 195.0;
    this.posSpringDamping = options.posSpringDamping ?? 21.5;
    this.rotSpringStiffness = options.rotSpringStiffness ?? 240.0;
    this.rotSpringDamping = options.rotSpringDamping ?? 22.0;
    this.anticipationRangeMeters = options.anticipationRangeMeters ?? 8.5;
    this.recoilFrequencyHz = options.recoilFrequencyHz ?? 45.0;
    this.recoilDurationSec = options.recoilDurationSec ?? 0.11;
    this._actorCounter = 0;
  }

  /**
   * 1. Per-Actor Kinematic State (`initActor(actor)`):
   * Attaches `actor.racketKinematics` state object to an actor
   * (`player`, `playerPartner`, `opponent`, `opponentPartner`).
   */
  initActor(actor) {
    if (!actor) return null;
    if (actor.racketKinematics) return actor.racketKinematics;

    // Zero out any static mesh-level Euler offset set by game_engine.js so racketPivot rotation
    // is pure and mirror-symmetric between Forehand (+Z roll -> -X) and Backhand (-Z roll -> +X).
    if (actor.racketMesh && actor.racketMesh.rotation) {
      actor.racketMesh.rotation.set(0, 0, 0);
    }

    const roleSeed =
      actor.role === 'player'
        ? 0.0
        : actor.role === 'player_partner'
        ? 1.37
        : actor.role === 'opponent'
        ? 2.74
        : 4.11 + (this._actorCounter++ * 0.91);

    const state = {
      // Translational wrist spring-damper state (in actor.root space)
      wristSpringPos: new THREE.Vector3(0, 0, 0),
      wristSpringVel: new THREE.Vector3(0, 0, 0),

      // Rotational wrist spring-damper state (pitch, yaw, roll in radians & rad/s)
      wristSpringEuler: new THREE.Vector3(0, 0, 0),
      wristSpringOmega: new THREE.Vector3(0, 0, 0),

      // Continuous Motion Controller figure-8 idle twitch & nervous wrist-roll twirl
      idleTwitchTimer: roleSeed * 0.5,
      idleTwitchPhase: roleSeed,
      idleSpinAngle: 0.0,
      idleSpinVel: 0.0,
      idleSpinCooldown: 0.85 + (roleSeed % 1.1),
      microWaggleAmp: 1.0,

      // Dynamic two-sided ready stance & anticipation tracking
      activeStanceSide: 'forehand', // 'forehand' | 'backhand'
      stanceSideBlend: 0.0, // 0 = forehand (-X local), 1 = backhand (+X local)
      rallyTurnOriginX: actor.pos ? actor.pos.x : 0.0,
      lastBallHitter: '',
      lastVisualSwingTimestamp: 0.0,

      // Automatic Backswing Preparation (Anticipation Coil 0..1 as ball approaches within 8.5m)
      anticipationCharge: 0.0,
      anticipationSide: 'forehand', // 'forehand' | 'backhand' | 'overhead'
      anticipationHeight: 1.05,
      prepCharge: 0.0,
      prepSide: 'forehand',

      // Active Stroke Whip State
      swingActive: false,
      swingElapsed: 0.0,
      swingDuration: 0.33,
      swingProgress: 0.0,
      swingPhase: 'idle', // 'idle' | 'windup' | 'whip' | 'follow_through'
      swingShotType: 'topspin', // 'topspin' | 'slice' | 'flat' | 'smash' | 'lob' | 'serve'
      swingSide: 'forehand', // 'forehand' | 'backhand' | 'overhead'
      swingSpeedMult: 1.15,
      timingQuality: 'sweet', // 'early' | 'sweet' | 'late'
      isServe: false,
      aimDirX: 0.0,
      startChargeAtSwing: 0.0,
      whipSnapImpulseApplied: false,

      // 45Hz Impact Recoil Vibration State
      recoilTimer: 0.0,
      recoilIntensity: 0.0,
      recoilPhase: 0.0,

      // Instantaneous Racket Head Speed (m/s) for Agent 5's ribbon trail & Agent 3's body lean
      currentWhipSpeed: 1.8,
      peakWhipSpeed: 0.0,

      // Hand & Off-Hand IK / Rig Targets in actor.root local space
      handGripTargetPos: REST_GRIP_POS.clone(),
      handGripTargetRot: REST_GRIP_ROT.clone(),
      offHandTargetPos: REST_OFFHAND_POS.clone(),
      handGripOffset: new THREE.Vector3(0, 0, 0),
      offHandOffset: new THREE.Vector3(0, 0, 0),

      // Inertial Footwork Tracking & World-Space Rim Sampling
      prevActorVel: new THREE.Vector3(0, 0, 0),
      prevTipWorld: new THREE.Vector3(0, 0, 0),
      hasPrevTipWorld: false,
      lastSyncedSwingTimer: 0.0,
      rimPoints: {
        tipWorld: new THREE.Vector3(),
        throatWorld: new THREE.Vector3(),
        centerWorld: new THREE.Vector3(),
        normalWorld: new THREE.Vector3(0, 0, 1),
        whipSpeed: 0,
        shotType: 'topspin',
      },
      getRacketRimWorldPoints: () => this.getRacketRimWorldPoints(actor),
    };

    actor.racketKinematics = state;
    return state;
  }

  /**
   * Initializes multiple actors at once.
   */
  initAllActors(...actors) {
    const flat = actors.flat().filter(Boolean);
    return flat.map((a) => this.initActor(a));
  }

  /**
   * 3. Exaggerated, High-Velocity Stroke Arcs & Wrist Snap (`triggerSwing(actor, options)`):
   * `options`: `{ shotType = 'topspin', side = 'forehand', speed = 1.15, timing = 'sweet', isServe = false, dirX = 0 }`
   */
  triggerSwing(actor, options = {}) {
    if (!actor) return null;
    const rk = actor.racketKinematics || this.initActor(actor);

    if (actor.racketMesh && actor.racketMesh.rotation) {
      actor.racketMesh.rotation.set(0, 0, 0);
    }

    const isServe = Boolean(options.isServe || String(options.shotType || '').toLowerCase() === 'serve');
    const shotType = normalizeShotType(options.shotType, isServe);

    let inferredSide =
      options.side && options.side !== 'auto'
        ? options.side
        : isServe
        ? 'overhead'
        : rk.anticipationCharge > 0.12
        ? rk.anticipationSide
        : actor.swingType || rk.activeStanceSide || 'forehand';

    // In live RALLY gameplay, game_engine.js sets `actor.targetPos.x = landing.x * 1.05`, causing the actor
    // to overrun the ball slightly on lateral shots and inverting `ball.pos.x < hitter.pos.x - 0.15`.
    // Resolve the true anatomical court side from the ball's court trajectory, anticipation coil, and swing dirX.
    const engine = actor._engineRef || options.engine || null;
    if (
      !isServe &&
      shotType !== 'smash' &&
      inferredSide !== 'overhead' &&
      !options.isPracticeSwing &&
      engine &&
      engine.phase === 'RALLY' &&
      !engine.showcaseMode &&
      engine.ball &&
      engine.ball.inPlay
    ) {
      const sSign = (actor.sideSign || 1) >= 0 ? 1.0 : -1.0;
      const ballRight = engine.ball.pos.x * sSign;
      const landingRight =
        engine.ball.targetLanding && typeof engine.ball.targetLanding.x === 'number'
          ? engine.ball.targetLanding.x * sSign
          : ballRight;
      const originRight =
        (typeof rk.rallyTurnOriginX === 'number' ? rk.rallyTurnOriginX : 0.0) * sSign;
      const deltaFromOrigin = ballRight - originRight;
      const relBallRight = (engine.ball.pos.x - (actor.pos?.x || 0)) * sSign;
      const inputDirRight = Number(options.dirX ?? 0.0) * sSign;

      if (rk.anticipationCharge > 0.15 && (rk.anticipationSide === 'forehand' || rk.anticipationSide === 'backhand')) {
        inferredSide = rk.anticipationSide;
      } else if (
        ballRight < -0.22 ||
        landingRight < -0.25 ||
        deltaFromOrigin < -0.28 ||
        (Math.abs(ballRight) <= 0.25 && inputDirRight < -0.15) ||
        (Math.abs(ballRight) <= 0.25 && relBallRight < -0.04)
      ) {
        inferredSide = 'backhand';
      } else if (
        ballRight > 0.22 ||
        landingRight > 0.25 ||
        deltaFromOrigin > 0.28 ||
        (Math.abs(ballRight) <= 0.25 && inputDirRight > 0.15) ||
        (Math.abs(ballRight) <= 0.25 && relBallRight >= -0.04)
      ) {
        inferredSide = 'forehand';
      }
    }

    const side = normalizeSwingSide(inferredSide, shotType, isServe);
    const speedMult = clamp(Number(options.speed ?? 1.15), 0.78, 1.85);
    const timing = normalizeTimingQuality(options.timing);
    const profile = getStrokeProfile(shotType, side);

    // Compute stroke duration (faster speedMult compresses duration while keeping follow-through readable)
    const speedTimeScale = clamp(Math.pow(speedMult / 1.15, 0.55), 0.80, 1.32);
    const duration = clamp(profile.baseDuration / speedTimeScale, 0.22, 0.44);

    rk.swingActive = true;
    rk.swingElapsed = 0.0;
    rk.swingDuration = duration;
    rk.swingProgress = 0.0;
    rk.swingPhase = 'windup';
    rk.swingShotType = shotType;
    rk.swingSide = side;
    if (side === 'forehand' || side === 'backhand') {
      rk.activeStanceSide = side;
      rk.anticipationSide = side;
      rk.prepSide = side;
    }
    rk.swingSpeedMult = speedMult;
    rk.timingQuality = timing;
    rk.isServe = isServe;
    rk.aimDirX = clamp(Number(options.dirX ?? 0.0), -1.0, 1.0);
    rk.startChargeAtSwing = rk.anticipationCharge;
    rk.whipSnapImpulseApplied = false;
    rk.peakWhipSpeed = 0.0;

    // Reset residual spring velocities and inject fresh windup coil velocity
    // In actor.root local space:
    // Forehand (`sideSign = +1`) coils toward local -X (Screen Right) with +Z roll, then whips toward local +X with -Z/-Y angular snap.
    // Backhand (`sideSign = -1`) coils toward local +X (Screen Left) with -Z roll, then whips toward local -X with +Z/+Y angular snap.
    const sideSign = side === 'backhand' ? -1.0 : 1.0;
    rk.wristSpringPos.multiplyScalar(0.2);
    rk.wristSpringEuler.multiplyScalar(0.2);
    rk.wristSpringVel.set(-0.35 * sideSign * speedMult, 0, -1.1 * speedMult);
    rk.wristSpringOmega.set(
      -5.2 * speedMult,
      -5.8 * sideSign * speedMult,
      4.5 * sideSign * speedMult
    );

    // Keep legacy actor fields synchronized for game_engine.js and 1v1 multiplayer snapshots
    actor.swingType = isServe ? 'serve' : shotType === 'smash' || side === 'overhead' ? 'smash' : side;
    actor.swingDuration = duration;
    actor.swingTimer = duration;
    rk.lastSyncedSwingTimer = duration;
    actor.arcVisibleTimer = Math.max(actor.arcVisibleTimer || 0, duration + 0.06);
    if (actor.swingArcMesh) {
      actor.swingArcMesh.visible = true;
    }

    return rk;
  }

  /**
   * 4. Impact Recoil Vibration (`triggerImpactRecoil(actor, intensity = 1.0)`):
   * High-frequency damped wrist recoil vibration (`45 Hz` decaying over `0.11s`)
   * so ball contact feels physical and weighty.
   */
  triggerImpactRecoil(actor, intensity = 1.0) {
    if (!actor) return null;
    const rk = actor.racketKinematics || this.initActor(actor);
    const clampedIntensity = clamp(Number(intensity ?? 1.0), 0.25, 2.25);

    rk.recoilTimer = this.recoilDurationSec;
    rk.recoilIntensity = clampedIntensity;
    rk.recoilPhase = 0.0;

    // Physical string-bed shock impulse into wrist spring (opposing the stroke's forward/across whip)
    const sideSign = rk.swingSide === 'backhand' ? -1.0 : 1.0;
    rk.wristSpringVel.z -= 1.45 * clampedIntensity;
    rk.wristSpringVel.y += 0.65 * clampedIntensity;
    rk.wristSpringOmega.x -= 9.5 * clampedIntensity;
    rk.wristSpringOmega.y -= 7.2 * sideSign * clampedIntensity;
    rk.wristSpringOmega.z += 8.4 * sideSign * clampedIntensity;

    return rk;
  }

  /**
   * World-space sampling helper returning `{ tipWorld, throatWorld, centerWorld, normalWorld, whipSpeed, shotType }`.
   */
  getRacketRimWorldPoints(actor) {
    return getRacketRimWorldPoints(actor);
  }

  /**
   * Extracts normalized live controller telemetry (`tiltPitch`, `tiltRoll`, `tiltYaw`,
   * `mouseVelX`, `mouseVelY`, `accelMag`) from `context.liveInput` or `context.motionController`.
   */
  _resolveLiveInput(actor, context = {}) {
    const raw = context.liveInput || {};
    let tiltPitch = Number(raw.tiltPitch ?? raw.pitch ?? 0);
    let tiltRoll = Number(raw.tiltRoll ?? raw.roll ?? 0);
    let tiltYaw = Number(raw.tiltYaw ?? raw.yaw ?? 0);
    let mouseVelX = Number(raw.mouseVelX ?? raw.vx ?? 0);
    let mouseVelY = Number(raw.mouseVelY ?? raw.vy ?? 0);
    let accelMag = Number(raw.accelMag ?? 0);

    const mc = context.motionController;
    const isHumanActor =
      actor.role === 'player' ||
      actor.role === 'player_partner' ||
      (context.isMultiplayer && (actor.role === 'opponent' || actor.role === 'opponent_partner'));

    if (mc && isHumanActor) {
      const isP2Actor = actor.role === 'opponent' || actor.role === 'opponent_partner';
      const phoneSource = isP2Actor ? mc.p2PhoneState : mc.phoneState;
      if (phoneSource && phoneSource.connected && phoneSource.orientation) {
        if (!raw.tiltPitch) tiltPitch = Number(phoneSource.orientation.pitch || 0) * 0.01745;
        if (!raw.tiltRoll) tiltRoll = Number(phoneSource.orientation.roll || 0) * 0.01745;
        if (!raw.tiltYaw) tiltYaw = Number(phoneSource.orientation.yaw || 0) * 0.01745;
        if (!raw.accelMag) accelMag = Number(phoneSource.orientation.accelMag || 0);
      }
      if (!isP2Actor) {
        if (!raw.mouseVelX && mc.mouseTrail && mc.mouseTrail.length >= 2) {
          const n = mc.mouseTrail.length;
          const pLast = mc.mouseTrail[n - 1];
          const pPrev = mc.mouseTrail[Math.max(0, n - 3)];
          const dtMs = Math.max(8, pLast.t - pPrev.t);
          mouseVelX = ((pLast.x - pPrev.x) / dtMs) * 1.8;
          mouseVelY = ((pLast.y - pPrev.y) / dtMs) * 1.8;
        } else if (!raw.mouseVelX && mc.webcamActive && mc.motionVector) {
          mouseVelX = Number(mc.motionVector.vx || 0) * 1.6;
          mouseVelY = Number(mc.motionVector.vy || 0) * 1.6;
          accelMag = Math.max(accelMag, Number(mc.motionVector.mag || 0) * 1.5);
        }
        if (!raw.tiltYaw && typeof mc.aimBiasX === 'number') {
          tiltYaw += mc.aimBiasX * 0.35;
        }
      }
    }

    // If values were passed in degrees (> 2*PI), convert to radians
    if (Math.abs(tiltPitch) > 3.2) tiltPitch *= Math.PI / 180.0;
    if (Math.abs(tiltRoll) > 3.2) tiltRoll *= Math.PI / 180.0;
    if (Math.abs(tiltYaw) > 3.2) tiltYaw *= Math.PI / 180.0;

    return {
      tiltPitch: clamp(tiltPitch, -1.2, 1.2),
      tiltRoll: clamp(tiltRoll, -1.2, 1.2),
      tiltYaw: clamp(tiltYaw, -1.2, 1.2),
      mouseVelX: clamp(mouseVelX, -6.0, 6.0),
      mouseVelY: clamp(mouseVelY, -6.0, 6.0),
      accelMag: clamp(accelMag, 0.0, 8.0),
    };
  }

  /**
   * 2. Updates dynamic wrist whip, frantic Motion Controller idle twitch, inertial footwork lag,
   * automatic anticipation backswing coil, active non-linear swing arcs, and 45Hz impact recoil.
   */
  update(actor, rawDt, context = {}) {
    if (!actor) return null;
    const rk = actor.racketKinematics || this.initActor(actor);
    const dt = clamp(Number(rawDt || 1 / 60), 0.0005, 0.05);

    if (actor.racketMesh && actor.racketMesh.rotation) {
      actor.racketMesh.rotation.set(0, 0, 0);
    }

    const ball = context.ball || null;
    const phase = context.phase || 'RALLY';
    const isServer = Boolean(
      context.isServer ?? (context.server && context.server === actor.role)
    );
    const liveInput = this._resolveLiveInput(actor, context);

    // Track where the actor was standing when the opponent struck the ball so lateral run-overs
    // never invert Forehand vs Backhand detection.
    if (ball && ball.inPlay && ball.lastHitter !== rk.lastBallHitter) {
      rk.lastBallHitter = ball.lastHitter || '';
      if (actor.pos) {
        rk.rallyTurnOriginX = actor.pos.x;
      }
    } else if (!ball || !ball.inPlay) {
      rk.lastBallHitter = '';
      if (actor.pos) {
        rk.rallyTurnOriginX = actor.pos.x;
      }
    }

    // Trigger immediate visual Forehand/Backhand swing when the human player slashes mouse/keys/phone
    // during RALLY even before the ball enters the 2.8m contact window.
    const mc = context.motionController;
    if (
      actor.role === 'player' &&
      mc &&
      mc.lastVisualSwing &&
      mc.lastVisualSwing.timestamp > rk.lastVisualSwingTimestamp
    ) {
      rk.lastVisualSwingTimestamp = mc.lastVisualSwing.timestamp;
      if (!rk.swingActive && phase === 'RALLY') {
        const vSwing = mc.lastVisualSwing;
        const vSide =
          vSwing.type === 'backhand'
            ? 'backhand'
            : vSwing.type === 'smash'
            ? 'overhead'
            : 'forehand';
        this.triggerSwing(actor, {
          shotType: vSwing.shotType || 'topspin',
          side: vSide,
          speed: vSwing.speed || 1.18,
          dirX: vSwing.dirX || 0,
          isPracticeSwing: true,
        });
      }
    }

    // Bridge legacy swing triggers: if `actor.swingTimer` was just set externally by `game_engine.js`
    // without calling `triggerSwing`, automatically promote it into a full non-linear whip swing!
    if (
      !rk.swingActive &&
      typeof actor.swingTimer === 'number' &&
      actor.swingTimer > 0.24 &&
      actor.swingTimer > rk.lastSyncedSwingTimer + 0.04 &&
      phase !== 'REPLAY'
    ) {
      const extType = actor.swingType || 'forehand';
      const isServeSwing = extType === 'serve' || phase === 'SERVE_TOSS';
      const inferredShot =
        isServeSwing
          ? 'serve'
          : extType === 'smash'
          ? 'smash'
          : ball && ball.shotType
          ? String(ball.shotType).toLowerCase()
          : 'topspin';
      this.triggerSwing(actor, {
        shotType: inferredShot,
        side: extType === 'backhand' ? 'backhand' : extType === 'smash' ? 'overhead' : 'forehand',
        speed: ball?.isPowerShot ? 1.38 : 1.18,
        isServe: isServeSwing,
      });
    }

    // ------------------------------------------------------------------------
    // A. Inertial Lag & Braking Whip from Lateral/Depth Footwork Acceleration
    // ------------------------------------------------------------------------
    const curVel = actor.vel || _tmpVecA.set(0, 0, 0);
    const dvX = curVel.x - rk.prevActorVel.x;
    const dvZ = curVel.z - rk.prevActorVel.z;
    rk.prevActorVel.copy(curVel);

    // Transform world velocity & acceleration into actor.root local space
    // Near player (`sideSign > 0`) has `root.rotation.y = Math.PI`, so world +X is local -X and world +Z is local -Z
    const facingFlip = actor.sideSign > 0 ? -1.0 : 1.0;
    const localVelX = curVel.x * facingFlip;
    const localVelZ = curVel.z * facingFlip;
    const localAccX = clamp((dvX * facingFlip) / dt, -42.0, 42.0);
    const localAccZ = clamp((dvZ * facingFlip) / dt, -42.0, 42.0);

    // Apply inertial lag impulse to wrist spring when accelerating or braking sharply
    rk.wristSpringVel.x -= localAccX * 0.0085 * dt;
    rk.wristSpringVel.z -= localAccZ * 0.0085 * dt;
    rk.wristSpringOmega.z += localAccX * 0.068 * dt;
    rk.wristSpringOmega.x -= localAccZ * 0.062 * dt;
    rk.wristSpringOmega.y -= localAccX * 0.045 * dt;

    // ------------------------------------------------------------------------
    // B. Live Controller / Mouse / Phone Coupling into Angular & Linear Spring
    // ------------------------------------------------------------------------
    // Note: Screen Right (+mouseVelX) is World +X = Local -X for near player (`facingFlip = -1`).
    const localMouseVelX = liveInput.mouseVelX * facingFlip;
    const springTargetPos = _tmpVecA.set(
      clamp(-localVelX * 0.012 + localMouseVelX * 0.018 - liveInput.tiltRoll * 0.055, -0.09, 0.09),
      clamp(Math.abs(localVelX) * 0.008 - liveInput.mouseVelY * 0.016 + liveInput.tiltPitch * 0.05, -0.08, 0.08),
      clamp(-localVelZ * 0.012 + liveInput.accelMag * 0.015, -0.08, 0.08)
    );

    const springTargetEuler = _tmpVecB.set(
      clamp(
        liveInput.tiltPitch * 0.65 - liveInput.mouseVelY * 0.14 - localVelZ * 0.032,
        -0.58,
        0.58
      ),
      clamp(
        liveInput.tiltYaw * 0.55 + localMouseVelX * 0.16 - localVelX * 0.035,
        -0.65,
        0.65
      ),
      clamp(
        -liveInput.tiltRoll * 0.72 - localMouseVelX * 0.18 + localVelX * 0.045,
        -0.68,
        0.68
      )
    );

    // Integrate damped harmonic oscillator for translational wrist spring
    const kPos = this.posSpringStiffness;
    const cPos = this.posSpringDamping;
    rk.wristSpringVel.x += ((springTargetPos.x - rk.wristSpringPos.x) * kPos - rk.wristSpringVel.x * cPos) * dt;
    rk.wristSpringVel.y += ((springTargetPos.y - rk.wristSpringPos.y) * kPos - rk.wristSpringVel.y * cPos) * dt;
    rk.wristSpringVel.z += ((springTargetPos.z - rk.wristSpringPos.z) * kPos - rk.wristSpringVel.z * cPos) * dt;
    rk.wristSpringPos.addScaledVector(rk.wristSpringVel, dt);

    // Integrate damped harmonic oscillator for rotational wrist spring
    const kRot = this.rotSpringStiffness;
    const cRot = this.rotSpringDamping;
    rk.wristSpringOmega.x += ((springTargetEuler.x - rk.wristSpringEuler.x) * kRot - rk.wristSpringOmega.x * cRot) * dt;
    rk.wristSpringOmega.y += ((springTargetEuler.y - rk.wristSpringEuler.y) * kRot - rk.wristSpringOmega.y * cRot) * dt;
    rk.wristSpringOmega.z += ((springTargetEuler.z - rk.wristSpringEuler.z) * kRot - rk.wristSpringOmega.z * cRot) * dt;
    rk.wristSpringEuler.addScaledVector(rk.wristSpringOmega, dt);

    // ------------------------------------------------------------------------
    // C. Automatic Backswing Preparation & Dynamic Two-Sided Stance
    // ------------------------------------------------------------------------
    let targetAnticipation = 0.0;
    const sSign = (actor.sideSign || 1) >= 0 ? 1.0 : -1.0;

    if (ball && ball.inPlay && phase === 'RALLY' && !rk.swingActive) {
      const headingToNear =
        actor.sideSign > 0 && (ball.vel.z > 0.4 || ball.lastHitter === 'opponent');
      const headingToFar =
        actor.sideSign < 0 && (ball.vel.z < -0.4 || ball.lastHitter === 'player');

      if (headingToNear || headingToFar) {
        const dx = ball.pos.x - actor.pos.x;
        const dz = ball.pos.z - actor.pos.z;
        const horizDist = Math.hypot(dx, dz);

        // Determine Forehand (court right in actor facing frame) vs Backhand (court left in actor facing frame)
        const ballRight = ball.pos.x * sSign;
        const landingRight =
          ball.targetLanding && typeof ball.targetLanding.x === 'number'
            ? ball.targetLanding.x * sSign
            : ballRight;
        const originRight = rk.rallyTurnOriginX * sSign;
        const deltaFromOrigin = ballRight - originRight;
        const lateralInFacing = dx * sSign;

        if (ball.pos.y > 1.85 && horizDist < 5.5) {
          rk.anticipationSide = 'overhead';
        } else if (
          landingRight < -0.22 ||
          ballRight < -0.22 ||
          deltaFromOrigin < -0.28 ||
          (Math.abs(ballRight) <= 0.22 && lateralInFacing < -0.08)
        ) {
          rk.anticipationSide = 'backhand';
          rk.activeStanceSide = 'backhand';
        } else if (
          landingRight > 0.22 ||
          ballRight > 0.22 ||
          deltaFromOrigin > 0.28 ||
          (Math.abs(ballRight) <= 0.22 && lateralInFacing >= -0.08)
        ) {
          rk.anticipationSide = 'forehand';
          rk.activeStanceSide = 'forehand';
        }

        // Also check the ball hasn't already flown well behind this actor
        const passedDist = actor.sideSign > 0 ? dz : -dz;
        if (horizDist <= this.anticipationRangeMeters && passedDist <= 1.25) {
          rk.anticipationHeight = THREE.MathUtils.lerp(
            rk.anticipationHeight,
            clamp(ball.pos.y, 0.55, 2.2),
            1.0 - Math.exp(-12.0 * dt)
          );

          const rawProximity = 1.0 - (horizDist - 1.45) / (this.anticipationRangeMeters - 1.45);
          targetAnticipation = smootherstep(clamp(rawProximity, 0.0, 1.0));
        }
      }
    }

    // Also allow lateral footwork velocity or strong mouse slash to flip the ready stance side between Forehand and Backhand
    if (!rk.swingActive && targetAnticipation < 0.15 && phase === 'RALLY') {
      // Remember: localVelX > 0 means moving toward local +X (Screen Left = Backhand side)
      // localVelX < 0 means moving toward local -X (Screen Right = Forehand side)
      if (localVelX > 1.25 || liveInput.mouseVelX * sSign < -1.8) {
        rk.activeStanceSide = 'backhand';
      } else if (localVelX < -1.25 || liveInput.mouseVelX * sSign > 1.8) {
        rk.activeStanceSide = 'forehand';
      }
    } else if (phase === 'SERVE_STANCE' || phase === 'SERVE_TOSS') {
      rk.activeStanceSide = 'forehand';
    }

    const targetStanceBlend = rk.activeStanceSide === 'backhand' ? 1.0 : 0.0;
    rk.stanceSideBlend = THREE.MathUtils.lerp(
      rk.stanceSideBlend,
      targetStanceBlend,
      1.0 - Math.exp(-14.0 * dt)
    );

    const antRate = targetAnticipation > rk.anticipationCharge ? 11.5 : 7.5;
    rk.anticipationCharge = THREE.MathUtils.lerp(
      rk.anticipationCharge,
      targetAnticipation,
      1.0 - Math.exp(-antRate * dt)
    );
    rk.prepCharge = rk.anticipationCharge;
    rk.prepSide = rk.anticipationSide;

    // Interpolate current ready grip & off-hand rest pose between Forehand (-X local) and Backhand (+X local)
    const activeRestGripPos = _tmpVecC.lerpVectors(
      REST_GRIP_POS,
      REST_GRIP_BACKHAND_POS,
      rk.stanceSideBlend
    );
    const activeRestOffHandPos = new THREE.Vector3().lerpVectors(
      REST_OFFHAND_POS,
      REST_OFFHAND_BACKHAND_POS,
      rk.stanceSideBlend
    );
    const activeRestRotX = THREE.MathUtils.lerp(
      REST_GRIP_ROT.x,
      REST_GRIP_BACKHAND_ROT.x,
      rk.stanceSideBlend
    );
    const activeRestRotY = THREE.MathUtils.lerp(
      REST_GRIP_ROT.y,
      REST_GRIP_BACKHAND_ROT.y,
      rk.stanceSideBlend
    );
    const activeRestRotZ = THREE.MathUtils.lerp(
      REST_GRIP_ROT.z,
      REST_GRIP_BACKHAND_ROT.z,
      rk.stanceSideBlend
    );

    // ------------------------------------------------------------------------
    // D. Continuous Motion Controller Micro-Waggle & Nervous Wrist-Roll Twirl
    // ------------------------------------------------------------------------
    const footSpeed = curVel.length();
    const excitement =
      (phase === 'RALLY' && ball?.inPlay ? 1.22 : 1.0) +
      rk.anticipationCharge * 0.38 +
      clamp(footSpeed * 0.04, 0, 0.35) +
      clamp(liveInput.accelMag * 0.12, 0, 0.35);
    rk.microWaggleAmp = THREE.MathUtils.lerp(rk.microWaggleAmp, excitement, 1.0 - Math.exp(-10.0 * dt));
    rk.idleTwitchTimer += dt * (1.0 + rk.anticipationCharge * 0.28);

    // Periodic nervous racket-head wrist roll / spin waggle when waiting
    rk.idleSpinCooldown -= dt;
    if (rk.idleSpinCooldown <= 0 && !rk.swingActive) {
      rk.idleSpinCooldown = 1.25 + ((rk.idleTwitchPhase * 0.73) % 1.15);
      rk.idleSpinVel = (Math.sin(rk.idleTwitchTimer * 3.7) >= 0 ? 1 : -1) * 5.2;
    }
    rk.idleSpinVel += (-rk.idleSpinAngle * 140.0 - rk.idleSpinVel * 14.0) * dt;
    rk.idleSpinAngle += rk.idleSpinVel * dt;

    const t = rk.idleTwitchTimer;
    const ph = rk.idleTwitchPhase;
    // Required multi-frequency Motion Controller figure-8 wrist twitch: sin(t * 9.5) + 0.45 * sin(t * 17.2)
    const wagglePrimary = Math.sin(t * 9.5 + ph) + 0.45 * Math.sin(t * 17.2 + ph * 1.7);
    const waggleSecondary = Math.cos(t * 4.75 + ph * 0.85) + 0.38 * Math.sin(t * 13.4 + ph * 2.1);
    const waggleRoll = Math.sin(t * 11.8 + ph * 1.3) * 0.65 + rk.idleSpinAngle;

    // ------------------------------------------------------------------------
    // E. Evaluate Base Pose: Active Explosive Swing vs Coiled / Idle Motion Controller
    // ------------------------------------------------------------------------
    const basePos = new THREE.Vector3();
    const baseRot = new THREE.Vector3();
    const offHandPos = new THREE.Vector3();
    let analyticalWhipSpeed = 0.0;

    if (rk.swingActive) {
      rk.swingElapsed += dt;
      const p = clamp(rk.swingElapsed / Math.max(0.001, rk.swingDuration), 0.0, 1.0);
      rk.swingProgress = p;
      actor.swingTimer = Math.max(0.0, rk.swingDuration - rk.swingElapsed);
      rk.lastSyncedSwingTimer = actor.swingTimer;

      const profile = getStrokeProfile(rk.swingShotType, rk.swingSide);
      // Forehand (`sideSign = +1`): starts on local -X (Screen Right) and whips across to local +X (Screen Left).
      // Backhand (`sideSign = -1`): starts on local +X (Screen Left) and whips across to local -X (Screen Right).
      const sideSign = rk.swingSide === 'backhand' ? -1.0 : 1.0;
      const swingRestGripPos = rk.swingSide === 'backhand' ? REST_GRIP_BACKHAND_POS : REST_GRIP_POS;
      const swingRestGripRot = rk.swingSide === 'backhand' ? REST_GRIP_BACKHAND_ROT : REST_GRIP_ROT;
      const swingRestOffHandPos =
        rk.swingSide === 'backhand' ? REST_OFFHAND_BACKHAND_POS : REST_OFFHAND_POS;

      // Timing quality & aim adjustments
      const timingYawBias =
        rk.timingQuality === 'early'
          ? 0.18 * sideSign
          : rk.timingQuality === 'late'
          ? -0.18 * sideSign
          : 0.0;

      if (p < 0.18) {
        // Phase 1 (0..18%): Fast Windup Coil into loaded pocket (-X for Forehand, +X for Backhand)
        rk.swingPhase = 'windup';
        const u = smootherstep(p / 0.18);
        const startBlend = clamp(rk.startChargeAtSwing * 0.75 + u * (1.0 - rk.startChargeAtSwing * 0.75), 0.0, 1.0);

        basePos.lerpVectors(swingRestGripPos, profile.windupPos, startBlend);
        // Deepen windup pocket slightly right before the forward whip
        basePos.z -= Math.sin(u * Math.PI) * 0.05;

        baseRot.x = THREE.MathUtils.lerp(swingRestGripRot.x, profile.windupRot.x, startBlend);
        baseRot.y = THREE.MathUtils.lerp(swingRestGripRot.y, profile.windupRot.y, startBlend);
        baseRot.z = THREE.MathUtils.lerp(swingRestGripRot.z, profile.windupRot.z, startBlend);

        offHandPos.lerpVectors(swingRestOffHandPos, profile.offHandWindup, startBlend);
        analyticalWhipSpeed = (5.5 + 8.5 * u) * rk.swingSpeedMult;
      } else if (p < 0.46) {
        // Phase 2 (18..46%): Hyper-Fast Whip Snap Across Hitting Zone (Peak at p ≈ 0.34!)
        rk.swingPhase = 'whip';
        const u = clamp((p - 0.18) / 0.28, 0.0, 1.0);

        // Non-linear explosive S-curve with steepest slope right at p = 0.34 (u ≈ 0.571)
        const posCurve = clamp(Math.pow(u, 1.35) * (2.35 - 1.35 * u), 0.0, 1.0);

        // Fire explosive wrist-pronation / supination impulse right as racket crosses the hitting zone (p >= 0.30)
        // Forehand (`sideSign = +1`) whips from +Z roll (-X side) toward -Z roll (+X side), so delta-Z is negative (-sideSign).
        // Backhand (`sideSign = -1`) whips from -Z roll (+X side) toward +Z roll (-X side), so delta-Z is positive (-sideSign).
        if (!rk.whipSnapImpulseApplied && p >= 0.30) {
          rk.whipSnapImpulseApplied = true;
          rk.wristSpringOmega.x += 12.5 * rk.swingSpeedMult;
          rk.wristSpringOmega.y += 14.0 * sideSign * rk.swingSpeedMult;
          rk.wristSpringOmega.z -= 14.0 * sideSign * rk.swingSpeedMult;
        }

        if (posCurve < 0.58) {
          const segU = posCurve / 0.58;
          evalQuadBezierVec3(basePos, profile.windupPos, profile.apexPos, profile.contactPos, segU);
        } else {
          const segU = (posCurve - 0.58) / 0.42;
          evalQuadBezierVec3(basePos, profile.contactPos, profile.carryPos, profile.followPos, segU * 0.55);
        }

        // Wrist lag-to-snap rotation: stays laid back until u ≈ 0.32, then whips violently through contact at p = 0.34!
        if (u < 0.32) {
          const lagU = smootherstep(u / 0.32);
          baseRot.lerpVectors(profile.windupRot, profile.lagRot, lagU);
        } else {
          const snapU = clamp((u - 0.32) / 0.68, 0.0, 1.0);
          // Sharp whip curve peaking at u = 0.57 (p = 0.34)
          const whipSnap = 1.0 - Math.pow(1.0 - snapU, 2.65);
          baseRot.lerpVectors(profile.lagRot, profile.contactRot, clamp(whipSnap * 1.25, 0.0, 1.0));
          if (whipSnap > 0.72) {
            const followPreBlend = (whipSnap - 0.72) / 0.28;
            baseRot.lerp(profile.followRot, followPreBlend * 0.45);
          }
        }
        baseRot.y += timingYawBias + rk.aimDirX * 0.16;

        offHandPos.lerpVectors(profile.offHandWindup, profile.offHandContact, posCurve);

        // Bell-shaped velocity curve peaking at p = 0.34 (u = 0.571)
        const bell = Math.exp(-Math.pow((p - 0.34) / 0.085, 2.0));
        analyticalWhipSpeed = (10.5 + (profile.peakSpeedBase - 10.5) * bell) * rk.swingSpeedMult;
      } else {
        // Phase 3 (46..100%): Expressive Follow-Through Wrap with Spring Overshoot & Recovery
        rk.swingPhase = 'follow_through';
        const u = clamp((p - 0.46) / 0.54, 0.0, 1.0);

        if (u < 0.48) {
          // Wrap into full over-the-shoulder (+X for Forehand) or open-chest (-X for Backhand) follow-through
          const wrapU = smootherstep(u / 0.48);
          evalQuadBezierVec3(basePos, profile.contactPos, profile.carryPos, profile.followPos, 0.55 + 0.45 * wrapU);
          const overshoot = Math.sin(wrapU * Math.PI) * 0.055 * rk.swingSpeedMult;
          // Forehand (`sideSign = +1`) finishes at +X so overshoot adds +X; Backhand (`sideSign = -1`) finishes at -X so overshoot adds -X.
          basePos.x += sideSign * overshoot;
          basePos.y += overshoot * 0.65;

          baseRot.lerpVectors(profile.contactRot, profile.followRot, wrapU);
          baseRot.y += sideSign * overshoot * 2.2;
          baseRot.z -= sideSign * overshoot * 1.8;

          offHandPos.lerpVectors(profile.offHandContact, profile.offHandFollow, wrapU);
          analyticalWhipSpeed = THREE.MathUtils.lerp(profile.peakSpeedBase * 0.62, 5.2, wrapU) * rk.swingSpeedMult;
        } else {
          // Smoothly recover from follow-through wrap back to active athletic ready stance
          const recU = smootherstep((u - 0.48) / 0.52);
          basePos.lerpVectors(profile.followPos, activeRestGripPos, recU);
          baseRot.x = THREE.MathUtils.lerp(profile.followRot.x, activeRestRotX, recU);
          baseRot.y = THREE.MathUtils.lerp(profile.followRot.y, activeRestRotY, recU);
          baseRot.z = THREE.MathUtils.lerp(profile.followRot.z, activeRestRotZ, recU);
          offHandPos.lerpVectors(profile.offHandFollow, activeRestOffHandPos, recU);
          analyticalWhipSpeed = THREE.MathUtils.lerp(5.2, 2.0, recU);
        }
      }

      // Orient actor.swingArcMesh along the active stroke plane so it matches the 3D arc
      if (actor.swingArcMesh && profile.arcRot) {
        actor.swingArcMesh.rotation.copy(profile.arcRot);
      }

      if (rk.swingElapsed >= rk.swingDuration) {
        rk.swingActive = false;
        rk.swingPhase = 'idle';
        rk.swingProgress = 0.0;
        rk.anticipationCharge = 0.0;
        rk.prepCharge = 0.0;
        actor.swingTimer = 0.0;
        rk.lastSyncedSwingTimer = 0.0;
      }
    } else {
      // ----------------------------------------------------------------------
      // Non-Swing State: Continuous Motion Controller Idle Twitch + Serve Toss Trophy
      //                  + Automatic Forehand/Backhand Anticipation Coil
      // ----------------------------------------------------------------------
      rk.swingPhase = 'idle';
      const amp = rk.microWaggleAmp;

      // 1. Base Motion Controller figure-8 micro-waggle around active athletic ready stance
      basePos.copy(activeRestGripPos);
      basePos.x += waggleSecondary * 0.018 * amp;
      basePos.y += wagglePrimary * 0.024 * amp + Math.sin(this.posSpringStiffness * 0.02 + t * 4.2) * 0.012;
      basePos.z += waggleSecondary * 0.015 * amp;

      baseRot.set(
        activeRestRotX + wagglePrimary * 0.085 * amp,
        activeRestRotY + waggleSecondary * 0.095 * amp,
        activeRestRotZ + waggleRoll * 0.078 * amp
      );

      offHandPos.copy(activeRestOffHandPos);
      offHandPos.y += wagglePrimary * 0.016 * amp;
      offHandPos.z += waggleSecondary * 0.014 * amp;

      // 2. Serve Stance & Serve Toss Trophy Pose (Right hand on local -X, Left toss hand on local +X)
      if (phase === 'SERVE_STANCE' && isServer) {
        // Nervous pre-serve Motion Controller waggle in front of chest before ball toss
        const preServePulse = Math.sin(t * 7.8) + 0.35 * Math.sin(t * 15.6);
        basePos.set(-0.28, 0.94 + preServePulse * 0.032, 0.24);
        baseRot.set(0.45 + preServePulse * 0.11, -0.32, 0.28 + waggleRoll * 0.08);
        offHandPos.set(0.20, 0.92 + Math.cos(t * 7.8) * 0.025, 0.26);
      } else if (phase === 'SERVE_TOSS' && isServer) {
        // Classic Argon Tennis Trophy Pose as the ball rises toward the serve apex!
        const tossProfile = STROKE_PROFILES.serve.overhead;
        const ballApexFactor = ball ? clamp((ball.pos.y - 1.15) / 1.65, 0.0, 1.0) : 0.85;
        const trophyBlend = smootherstep(ballApexFactor);
        basePos.lerpVectors(REST_GRIP_POS, tossProfile.windupPos, trophyBlend);
        basePos.y += wagglePrimary * 0.015;
        baseRot.set(
          THREE.MathUtils.lerp(REST_GRIP_ROT.x, tossProfile.windupRot.x, trophyBlend) + wagglePrimary * 0.06,
          THREE.MathUtils.lerp(REST_GRIP_ROT.y, tossProfile.windupRot.y, trophyBlend) + waggleSecondary * 0.05,
          THREE.MathUtils.lerp(REST_GRIP_ROT.z, tossProfile.windupRot.z, trophyBlend) + waggleRoll * 0.05
        );
        offHandPos.lerpVectors(REST_OFFHAND_POS, tossProfile.offHandWindup, trophyBlend);
      } else if (rk.anticipationCharge > 0.01) {
        // 3. Automatic Backswing Preparation (Anticipation Coil as ball approaches within 8.5m)
        const antProfile = getStrokeProfile('topspin', rk.anticipationSide);
        const c = rk.anticipationCharge;
        basePos.lerp(antProfile.windupPos, c * 0.88);
        // Adjust coil height dynamically toward incoming ball height while keeping wrist cocked
        const heightBias = clamp((rk.anticipationHeight - 1.05) * 0.22, -0.14, 0.24) * c;
        basePos.y += heightBias;

        baseRot.x = THREE.MathUtils.lerp(baseRot.x, antProfile.windupRot.x, c * 0.88) + wagglePrimary * 0.065 * c;
        baseRot.y = THREE.MathUtils.lerp(baseRot.y, antProfile.windupRot.y, c * 0.88) + waggleSecondary * 0.065 * c;
        baseRot.z = THREE.MathUtils.lerp(baseRot.z, antProfile.windupRot.z, c * 0.88) + waggleRoll * 0.055 * c;

        offHandPos.lerp(antProfile.offHandWindup, c * 0.90);
      }

      analyticalWhipSpeed =
        1.65 * amp +
        rk.wristSpringVel.length() * 1.4 +
        rk.wristSpringOmega.length() * 0.65 +
        rk.anticipationCharge * 3.2;
    }

    // ------------------------------------------------------------------------
    // F. Superimpose Wrist Spring-Damper Offset & 45Hz Impact Recoil Vibration
    // ------------------------------------------------------------------------
    let recoilPosZ = 0.0;
    let recoilPosY = 0.0;
    let recoilPitch = 0.0;
    let recoilRoll = 0.0;

    if (rk.recoilTimer > 0.0) {
      rk.recoilTimer = Math.max(0.0, rk.recoilTimer - dt);
      rk.recoilPhase += dt * this.recoilFrequencyHz * Math.PI * 2.0;
      const env = Math.pow(rk.recoilTimer / this.recoilDurationSec, 1.35) * rk.recoilIntensity;
      const oscSin = Math.sin(rk.recoilPhase);
      const oscCos = Math.cos(rk.recoilPhase * 1.15);

      recoilPosZ = -Math.abs(oscSin) * 0.032 * env;
      recoilPosY = oscCos * 0.018 * env;
      recoilPitch = oscSin * 0.16 * env;
      recoilRoll = oscCos * 0.14 * env;
    }

    // Compose final target grip position & rotation in actor.root local space
    rk.handGripTargetPos.set(
      basePos.x + rk.wristSpringPos.x,
      basePos.y + rk.wristSpringPos.y + recoilPosY,
      basePos.z + rk.wristSpringPos.z + recoilPosZ
    );

    rk.handGripTargetRot.set(
      baseRot.x + rk.wristSpringEuler.x + recoilPitch,
      baseRot.y + rk.wristSpringEuler.y,
      baseRot.z + rk.wristSpringEuler.z + recoilRoll,
      'XYZ'
    );

    rk.offHandTargetPos.set(
      offHandPos.x + rk.wristSpringPos.x * 0.35,
      offHandPos.y + rk.wristSpringPos.y * 0.35,
      offHandPos.z + rk.wristSpringPos.z * 0.35
    );

    // Compute additive translational offsets relative to default rest positions
    // (remember: GLTFLoader multi-material `Hand_R` / `Hand_L` groups have baked vertices around (0,0,0),
    // so applying `handGripOffset` / `offHandOffset` around `userData.basePos` keeps wristbands attached!)
    rk.handGripOffset.subVectors(rk.handGripTargetPos, REST_GRIP_POS);
    rk.offHandOffset.subVectors(rk.offHandTargetPos, REST_OFFHAND_POS);

    rk.isSwinging = rk.swingActive;
    rk.swingType = rk.swingSide === 'backhand' ? 'backhand' : rk.swingShotType === 'smash' || rk.isServe ? 'smash' : 'forehand';

    // Apply directly to `actor.racketPivot` (and fallback `actor.parts.handR` / `handL` only when `actor.rig` is not managing `handRPivot`/`handLPivot`)
    if (context.applyToRig !== false) {
      if (actor.racketPivot) {
        actor.racketPivot.position.copy(rk.handGripTargetPos);
        actor.racketPivot.rotation.copy(rk.handGripTargetRot);
      }

      if (!actor.rig) {
        const handR = actor.parts?.handR;
        if (handR && handR.userData?.basePos) {
          handR.position.copy(handR.userData.basePos).add(rk.handGripOffset);
        }

        const handL = actor.parts?.handL;
        if (handL && handL.userData?.basePos) {
          handL.position.copy(handL.userData.basePos).add(rk.offHandOffset);
        }
      }
    }

    // ------------------------------------------------------------------------
    // G. Sample World-Space Racket Rim Points & Measure True Tip Whip Speed (m/s)
    // ------------------------------------------------------------------------
    const rim = this.getRacketRimWorldPoints(actor);
    let measuredTipSpeed = 0.0;
    if (rk.hasPrevTipWorld && (!rk.swingActive || rk.swingElapsed > dt * 1.4)) {
      const tipDisp = _tmpVecC.subVectors(rim.tipWorld, rk.prevTipWorld).length();
      // Guard against teleporting actors on point reset (displacement > 1.8m in a single frame)
      if (tipDisp < 1.8) {
        measuredTipSpeed = tipDisp / dt;
      }
    }
    rk.prevTipWorld.copy(rim.tipWorld);
    rk.hasPrevTipWorld = true;

    const rawWhipSpeed = rk.swingActive
      ? analyticalWhipSpeed * 0.72 + Math.min(measuredTipSpeed, 38.0) * 0.28
      : clamp(measuredTipSpeed * 0.65 + analyticalWhipSpeed * 0.45, 1.2, 16.0);

    rk.currentWhipSpeed = THREE.MathUtils.lerp(
      rk.currentWhipSpeed,
      rawWhipSpeed,
      rk.swingActive ? 0.75 : 0.38
    );
    if (rk.swingActive && rk.currentWhipSpeed > rk.peakWhipSpeed) {
      rk.peakWhipSpeed = rk.currentWhipSpeed;
    }
    rim.whipSpeed = rk.currentWhipSpeed;
    rim.shotType = rk.swingShotType;

    return rk;
  }

  /**
   * Convenience helper to update an array or list of actors in a single call.
   */
  updateAll(actors, dt, context = {}) {
    if (!actors) return;
    const list = Array.isArray(actors) ? actors : Object.values(actors);
    for (const actor of list) {
      if (actor) {
        this.update(actor, dt, context);
      }
    }
  }

  /**
   * Static helper forwarding to `getRacketRimWorldPoints(actor)`.
   */
  static getRacketRimWorldPoints(actor) {
    return getRacketRimWorldPoints(actor);
  }
}

export default RacketKinematicsController;
