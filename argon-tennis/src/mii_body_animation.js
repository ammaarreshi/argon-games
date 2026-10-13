// ============================================================================
// Argon Tennis — Articulated Mii Hierarchical Rig, Spring-Damper Body Physics,
// Comedic Hop-Shuffle Footwork, Secondary Bobblehead Oscillation & Hand Tracking
// ============================================================================

import * as THREE from 'three';

// Anatomical joint pivots in `actor.model` (miiScene) local space.
// In `mii_player.glb` and `mii_opponent.glb`, all mesh vertex coordinates are
// baked around character root space (0, 0, 0) between the shoes.
// By placing each `pivotGroup` at `P` and shifting its child `partNode` by `-P`,
// `pivotGroup.position + partNode.position === (0, 0, 0)` at rest (zero visual
// displacement or multi-material primitive separation), while rotations of
// `pivotGroup` articulate cleanly around the true anatomical joint `P`.
export const MII_RIG_PIVOTS = Object.freeze({
  HIP: new THREE.Vector3(0.0, 0.56, 0.0),
  NECK_WORLD: new THREE.Vector3(0.0, 1.18, 0.0),
  NECK_RELATIVE_TO_HIP: new THREE.Vector3(0.0, 1.18 - 0.56, 0.0), // (0, 0.62, 0)
  FOOT_L: new THREE.Vector3(-0.105, 0.08, 0.01),
  FOOT_R: new THREE.Vector3(0.105, 0.08, 0.01),
  HAND_L: new THREE.Vector3(-0.33, 0.80, 0.10),
  HAND_R: new THREE.Vector3(0.33, 0.82, 0.14),
});

const SPRING_CONFIG = Object.freeze({
  TORSO_STIFFNESS: 140.0,
  TORSO_DAMPING: 11.0,
  SPINE_TWIST_STIFFNESS: 165.0,
  SPINE_TWIST_DAMPING: 11.8,
  HEAD_BOUNCE_STIFFNESS: 245.0,
  HEAD_BOUNCE_DAMPING: 9.2,
  SQUASH_STIFFNESS: 210.0,
  SQUASH_DAMPING: 13.5,
  MAX_SUBSTEP_DT: 1 / 120,
});

// Reusable scratch math objects to avoid per-frame GC pressure
const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpVecC = new THREE.Vector3();
const _tmpQuatA = new THREE.Quaternion();
const _tmpEulerA = new THREE.Euler();

/**
 * Finds exact top-level named Mii body part groups/nodes (`Head`, `Torso`,
 * `Hand_L`, `Hand_R`, `Foot_L`, `Foot_R`) without matching multi-material
 * child primitive meshes (`Head_1`, `Torso_2`, etc.).
 */
function resolveMiiParts(actor) {
  if (!actor || !actor.model) return {};
  actor.parts = actor.parts || {};

  actor.model.traverse((child) => {
    if (child === actor.model) return;
    const n = (child.name || '').trim();
    if (!n || /^MiiRig_/i.test(n)) return;

    if (!child.userData.basePos) {
      child.userData.basePos = child.position.clone();
    }
    if (!child.userData.baseRot) {
      child.userData.baseRot = child.rotation.clone();
    }

    if (/^head(\.?0*\d+)?$/i.test(n) && (!actor.parts.head || !child.isMesh)) actor.parts.head = child;
    else if (/^torso(\.?0*\d+)?$/i.test(n) && (!actor.parts.torso || !child.isMesh)) actor.parts.torso = child;
    else if (/^hand_l(\.?0*\d+)?$/i.test(n) && (!actor.parts.handL || !child.isMesh)) actor.parts.handL = child;
    else if (/^hand_r(\.?0*\d+)?$/i.test(n) && (!actor.parts.handR || !child.isMesh)) actor.parts.handR = child;
    else if (/^foot_l(\.?0*\d+)?$/i.test(n) && (!actor.parts.footL || !child.isMesh)) actor.parts.footL = child;
    else if (/^foot_r(\.?0*\d+)?$/i.test(n) && (!actor.parts.footR || !child.isMesh)) actor.parts.footR = child;
  });

  return actor.parts;
}

/**
 * Wraps `Torso`, `Head`, `Hand_L`, `Hand_R`, `Foot_L`, and `Foot_R` in
 * pivot-corrected hierarchical `THREE.Group` joints inside `actor.model`
 * without separating any multi-material child primitives (`_1`, `_2`, etc.).
 *
 * Kinematic chain inside `actor.model`:
 * - `hipPivot` at `(0, 0.56, 0)` -> contains `Torso` shifted by `(0, -0.56, 0)`
 *   - `neckPivot` at `(0, 0.62, 0)` (child of `hipPivot`, world `(0, 1.18, 0)`)
 *     - `headBounceGroup` at `(0, 0, 0)` -> contains `Head` shifted by `(0, -1.18, 0)`
 * - `footLPivot` at `(-0.15, 0.08, 0.02)` -> contains `Foot_L` shifted by `(+0.15, -0.08, -0.02)`
 * - `footRPivot` at `(+0.15, 0.08, 0.02)` -> contains `Foot_R` shifted by `(-0.15, -0.08, -0.02)`
 * - `handLPivot` at `(-0.34, 0.85, 0.14)` -> contains `Hand_L` shifted by `(+0.34, -0.85, -0.14)`
 * - `handRPivot` at `(+0.36, 0.88, 0.16)` -> contains `Hand_R` shifted by `(-0.36, -0.88, -0.16)`
 *
 * @param {object} actor - Court Mii actor state object
 * @returns {object|null} Initialized `actor.rig` state
 */
export function setupArticulatedMiiRig(actor) {
  if (!actor || !actor.model) return null;
  if (actor.rig && actor.rig.initialized && actor.rig.modelRef === actor.model) {
    return actor.rig;
  }

  const parts = resolveMiiParts(actor);
  const { torso, head, footL, footR, handL, handR } = parts;

  // Check if `actor.model` was cloned from an already-rigged scene
  let hipPivot = actor.model.getObjectByName('MiiRig_HipPivot');
  let neckPivot = actor.model.getObjectByName('MiiRig_NeckPivot');
  let headBounceGroup = actor.model.getObjectByName('MiiRig_HeadBounce');
  let footLPivot = actor.model.getObjectByName('MiiRig_FootLPivot');
  let footRPivot = actor.model.getObjectByName('MiiRig_FootRPivot');
  let handLPivot = actor.model.getObjectByName('MiiRig_HandLPivot');
  let handRPivot = actor.model.getObjectByName('MiiRig_HandRPivot');

  if (!hipPivot) {
    hipPivot = new THREE.Group();
    hipPivot.name = 'MiiRig_HipPivot';
    hipPivot.position.copy(MII_RIG_PIVOTS.HIP);
    actor.model.add(hipPivot);
  }

  if (!neckPivot) {
    neckPivot = new THREE.Group();
    neckPivot.name = 'MiiRig_NeckPivot';
    neckPivot.position.copy(MII_RIG_PIVOTS.NECK_RELATIVE_TO_HIP);
    hipPivot.add(neckPivot);
  } else if (neckPivot.parent !== hipPivot) {
    hipPivot.add(neckPivot);
    neckPivot.position.copy(MII_RIG_PIVOTS.NECK_RELATIVE_TO_HIP);
  }

  if (!headBounceGroup) {
    headBounceGroup = new THREE.Group();
    headBounceGroup.name = 'MiiRig_HeadBounce';
    headBounceGroup.position.set(0, 0, 0);
    neckPivot.add(headBounceGroup);
  } else if (headBounceGroup.parent !== neckPivot) {
    neckPivot.add(headBounceGroup);
    headBounceGroup.position.set(0, 0, 0);
  }

  if (!footLPivot) {
    footLPivot = new THREE.Group();
    footLPivot.name = 'MiiRig_FootLPivot';
    footLPivot.position.copy(MII_RIG_PIVOTS.FOOT_L);
    actor.model.add(footLPivot);
  }

  if (!footRPivot) {
    footRPivot = new THREE.Group();
    footRPivot.name = 'MiiRig_FootRPivot';
    footRPivot.position.copy(MII_RIG_PIVOTS.FOOT_R);
    actor.model.add(footRPivot);
  }

  if (!handLPivot) {
    handLPivot = new THREE.Group();
    handLPivot.name = 'MiiRig_HandLPivot';
    handLPivot.position.copy(MII_RIG_PIVOTS.HAND_L);
    actor.model.add(handLPivot);
  }

  if (!handRPivot) {
    handRPivot = new THREE.Group();
    handRPivot.name = 'MiiRig_HandRPivot';
    handRPivot.position.copy(MII_RIG_PIVOTS.HAND_R);
    actor.model.add(handRPivot);
  }

  // Helper to reparent a multi-material part group into its anatomical pivot
  // with exact negative offset so `pivot.position + part.position === basePos`
  const attachPartToPivot = (partNode, pivotGroup, worldPivotVec) => {
    if (!partNode) return new THREE.Vector3();
    const basePos = partNode.userData.basePos
      ? partNode.userData.basePos.clone()
      : new THREE.Vector3(0, 0, 0);
    const baseRot = partNode.userData.baseRot
      ? partNode.userData.baseRot.clone()
      : new THREE.Euler(0, 0, 0);
    const localOffset = new THREE.Vector3(
      basePos.x - worldPivotVec.x,
      basePos.y - worldPivotVec.y,
      basePos.z - worldPivotVec.z
    );
    if (partNode.parent !== pivotGroup) {
      pivotGroup.add(partNode);
    }
    partNode.position.copy(localOffset);
    partNode.rotation.copy(baseRot);
    partNode.scale.set(1, 1, 1);
    partNode.userData.rigLocalOffset = localOffset.clone();
    return localOffset;
  };

  const torsoOffset = attachPartToPivot(torso, hipPivot, MII_RIG_PIVOTS.HIP);
  const headOffset = attachPartToPivot(head, headBounceGroup, MII_RIG_PIVOTS.NECK_WORLD);
  const footLOffset = attachPartToPivot(footL, footLPivot, MII_RIG_PIVOTS.FOOT_L);
  const footROffset = attachPartToPivot(footR, footRPivot, MII_RIG_PIVOTS.FOOT_R);
  const handLOffset = attachPartToPivot(handL, handLPivot, MII_RIG_PIVOTS.HAND_L);
  const handROffset = attachPartToPivot(handR, handRPivot, MII_RIG_PIVOTS.HAND_R);

  // Place handLPivot on local +X (Screen Left for near player) and handRPivot on local -X (Screen Right) from frame 0
  handLPivot.position.set(0.28, 0.80, 0.14);
  handRPivot.position.set(-0.31, 0.82, 0.14);

  const baseModelScale = actor.model.scale.clone();
  if (baseModelScale.lengthSq() < 1e-4) {
    baseModelScale.setScalar(1.16);
  }

  const roleHash =
    String(actor.role || 'player')
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 0.37;

  actor.rig = {
    initialized: true,
    modelRef: actor.model,
    baseModelScale,
    phaseSeed: roleHash,
    elapsedTime: 0,

    // Joint Pivot Groups
    hipPivot,
    neckPivot,
    headBounceGroup,
    footLPivot,
    footRPivot,
    handLPivot,
    handRPivot,

    // Rest Pivot Positions in `actor.model` space
    basePivots: {
      hip: MII_RIG_PIVOTS.HIP.clone(),
      neck: MII_RIG_PIVOTS.NECK_RELATIVE_TO_HIP.clone(),
      footL: MII_RIG_PIVOTS.FOOT_L.clone(),
      footR: MII_RIG_PIVOTS.FOOT_R.clone(),
      handL: MII_RIG_PIVOTS.HAND_L.clone(),
      handR: MII_RIG_PIVOTS.HAND_R.clone(),
    },

    // Exact negative offsets keeping vertices at (0,0,0) in rest pose
    partOffsets: {
      torso: torsoOffset,
      head: headOffset,
      footL: footLOffset,
      footR: footROffset,
      handL: handLOffset,
      handR: handROffset,
    },

    // Footwork & Hop-Shuffle State
    hopPhase: (actor.stridePhase || 0) + (roleHash % Math.PI),
    prevHopSin: 0,
    prevHopDerivative: 0,
    verticalHopOffset: 0,
    squashY: 1.0,
    squashYVel: 0.0,
    prevLocalVelX: 0,
    prevLocalVelZ: 0,
    wasMoving: false,

    // 2D/3D Underdamped Torso & Spine Spring-Damper State
    leanPitch: 0,
    leanRoll: 0,
    leanPitchVel: 0,
    leanRollVel: 0,
    spineTwistY: 0,
    spineTwistVel: 0,

    // Secondary Head / Hair / Visor Oscillator State
    headBouncePitch: 0,
    headBouncePitchVel: 0,
    headBounceRoll: 0,
    headBounceRollVel: 0,
    headScaleBounce: 0,
    headScaleBounceVel: 0,
    headLookYaw: 0,
    headLookPitch: 0,

    // Swing & Shot Anticipation Tracking
    wasSwinging: false,
    lastSwingType: 'forehand',
    anticipationCharge: 0,
    coiledSide: 'forehand',

    // Celebration / Dejection Point Reaction State
    reaction: {
      active: false,
      type: null, // 'win' | 'loss'
      timer: 0,
      duration: 1.65,
    },
  };

  // Convenience alias on `actor.joints`
  actor.joints = {
    hipPivot,
    neckPivot,
    headBounceGroup,
    footLPivot,
    footRPivot,
    handLPivot,
    handRPivot,
  };

  return actor.rig;
}

/**
 * Triggers a joyous celebration ('win') or comedic dejection ('loss') point reaction
 * on the specified Mii actor.
 *
 * @param {object} actor - Court Mii actor state object
 * @param {'win'|'loss'|string|boolean} reactionType - 'win' or 'loss'
 * @param {object} [options] - Optional duration or intensity overrides
 */
export function triggerPointReaction(actor, reactionType = 'win', options = {}) {
  if (!actor) return;
  const rig = actor.rig || setupArticulatedMiiRig(actor);
  if (!rig) return;

  const norm =
    reactionType === true
      ? 'win'
      : reactionType === false
      ? 'loss'
      : String(reactionType || 'win').toLowerCase();
  const isWin =
    norm === 'win' || norm === 'won' || norm === 'victory' || norm === 'cheer' || norm === 'nice';

  rig.reaction.active = true;
  rig.reaction.type = isWin ? 'win' : 'loss';
  rig.reaction.timer = 0;
  rig.reaction.duration = Number(options.duration) || (isWin ? 1.72 : 1.68);

  if (isWin) {
    // Upward celebration pop + happy head bounce impulse
    rig.squashYVel += 2.2;
    rig.leanPitchVel -= 2.4;
    rig.headBouncePitchVel -= 4.8;
    rig.headScaleBounceVel += 1.6;
  } else {
    // Exasperated initial mini-pop before heavy shoulder slump
    rig.squashYVel -= 1.5;
    rig.leanPitchVel += 2.8;
    rig.headBouncePitchVel += 4.2;
    rig.headBounceRollVel += (actor.sideSign || 1) * 2.5;
  }
}

/**
 * Locks each multi-material part node (`Torso`, `Head`, `Foot_L`, `Foot_R`,
 * `Hand_L`, `Hand_R`) to its exact negative pivot offset so no external code
 * or legacy translation can ever separate multi-material primitives.
 */
function enforcePartOffsets(actor, rig) {
  const { torso, head, footL, footR, handL, handR } = actor.parts || {};
  if (torso) {
    torso.position.copy(rig.partOffsets.torso);
    if (torso.userData.baseRot) torso.rotation.copy(torso.userData.baseRot);
  }
  if (head) {
    head.position.copy(rig.partOffsets.head);
    if (head.userData.baseRot) head.rotation.copy(head.userData.baseRot);
  }
  if (footL) {
    footL.position.copy(rig.partOffsets.footL);
    if (footL.userData.baseRot) footL.rotation.copy(footL.userData.baseRot);
  }
  if (footR) {
    footR.position.copy(rig.partOffsets.footR);
    if (footR.userData.baseRot) footR.rotation.copy(footR.userData.baseRot);
  }
  if (handL) {
    handL.position.copy(rig.partOffsets.handL);
    if (handL.userData.baseRot) handL.rotation.copy(handL.userData.baseRot);
  }
  if (handR) {
    handR.position.copy(rig.partOffsets.handR);
    if (handR.userData.baseRot) handR.rotation.copy(handR.userData.baseRot);
  }
}

/**
 * Computes anticipation charge `[0..1]` and preparation side (`'forehand'|'backhand'`)
 * when a live rally ball is approaching this Mii's court half, or reads from
 * `actor.racketKinematics` / `actor.anticipationCharge` if provided externally.
 */
function computeShotAnticipation(actor, rig, context) {
  // 1. Check explicit kinematics / charge properties first
  const rk = actor.racketKinematics;
  if (rk && typeof rk.anticipationCharge === 'number' && rk.anticipationCharge > 0.01) {
    const rawSide =
      rk.anticipationSide ||
      rk.prepSide ||
      rk.activeStanceSide ||
      rk.swingSide ||
      rk.swingType ||
      actor.swingType ||
      'forehand';
    const side = rawSide === 'overhead' ? 'smash' : rawSide;
    rig.coiledSide = side;
    return {
      charge: THREE.MathUtils.clamp(rk.anticipationCharge, 0, 1),
      side,
    };
  }
  if (typeof actor.anticipationCharge === 'number' && actor.anticipationCharge > 0.01) {
    return {
      charge: THREE.MathUtils.clamp(actor.anticipationCharge, 0, 1),
      side: actor.swingType || 'forehand',
    };
  }

  // 2. Derive anticipation automatically from approaching ball trajectory
  const ball = context?.ball || actor.ball;
  const phase = context?.phase || 'RALLY';
  if (!ball || !ball.inPlay || phase !== 'RALLY') {
    return { charge: 0, side: rig.coiledSide || 'forehand' };
  }

  const sideSign = actor.sideSign || 1;
  // Near court (`sideSign > 0`) receives balls with `vel.z > 0`;
  // Far court (`sideSign < 0`) receives balls with `vel.z < 0`.
  const ballApproachingSide = sideSign > 0 ? ball.vel.z > 0.5 : ball.vel.z < -0.5;
  if (!ballApproachingSide) {
    return { charge: 0, side: rig.coiledSide || 'forehand' };
  }

  const dz = Math.abs(actor.pos.z - ball.pos.z);
  const dx = Math.abs(actor.pos.x - ball.pos.x);

  // Only coil if this actor is the primary defender in range (not a partner 8m away)
  if (dz > 9.5 || dx > 4.6) {
    return { charge: 0, side: rig.coiledSide || 'forehand' };
  }

  // Determine forehand vs backhand in character's facing frame:
  // Near player (`sideSign = +1`, facing -Z): right side of court (`x > 0`) is forehand, left side (`x < 0`) is backhand.
  // Far opponent (`sideSign = -1`, facing +Z): right side of facing frame (`x < 0`) is forehand, left side (`x > 0`) is backhand.
  const ballRight = ball.pos.x * sideSign;
  const landingRight =
    ball.targetLanding && typeof ball.targetLanding.x === 'number'
      ? ball.targetLanding.x * sideSign
      : ballRight;
  const relBallX = (ball.pos.x - actor.pos.x) * sideSign;
  const isOverhead = ball.pos.y > 1.72 && dz < 4.5;
  const isBackhand =
    landingRight < -0.22 ||
    ballRight < -0.22 ||
    (Math.abs(ballRight) <= 0.22 && relBallX < -0.08);
  const side = isOverhead ? 'smash' : isBackhand ? 'backhand' : 'forehand';
  rig.coiledSide = side;

  // Ramp anticipation charge smoothly as ball closes from 8.5m down to 1.2m
  const rawCharge = THREE.MathUtils.clamp(1.0 - (dz - 1.1) / 7.2, 0, 1);
  const proximityBoost = dx < 2.8 ? 1.0 : THREE.MathUtils.clamp(1.0 - (dx - 2.8) / 1.8, 0.25, 1.0);
  return {
    charge: rawCharge * proximityBoost,
    side,
  };
}

/**
 * Updates the articulated Mii rig for a single frame:
 * 1. Comedic bouncy footwork & rapid hop-shuffles (`freq ≈ 14–18 rad/s`) + landing squash
 * 2. 2D/3D underdamped spring-damper torso lean, braking inertia & shot coil/uncoil twist
 * 3. Target-locked head ball tracking + high-frequency secondary head/hair/visor bounce
 * 4. Dynamic right-hand racket grip tracking & expressive left-hand toss/coil/counter-balance
 * 5. Joyous win jump-spin & comedic loss shoulder-slump reactions
 *
 * @param {object} actor - Court Mii actor state object
 * @param {number} dt - Frame delta time in seconds
 * @param {object} [context] - Optional engine/match state (`{ ball, phase, score, elapsedTime }`)
 */
export function updateMiiBodyAnimation(actor, dt, context = {}) {
  if (!actor || !actor.model) return;
  if (context && context.ball && typeof context.phase === 'string') {
    actor._engineRef = context;
  }
  const rig = actor.rig && actor.rig.initialized ? actor.rig : setupArticulatedMiiRig(actor);
  if (!rig) return;

  const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.08) : 1 / 60;
  rig.elapsedTime += safeDt;
  const t = Number.isFinite(context?.elapsedTime) ? context.elapsedTime : rig.elapsedTime;

  // Ensure multi-material child meshes stay locked to their exact pivot offsets
  enforcePartOffsets(actor, rig);

  const sideSign = actor.sideSign || 1;
  const phase = context?.phase || actor.phase || 'RALLY';
  const score = context?.score || actor.score || null;
  const ball = context?.ball || actor.ball || null;
  const isServer = Boolean(score && score.server === actor.role);

  // Auto-detect transition into POINT_OVER / MATCH_OVER if reaction wasn't manually triggered
  const prevPhase = rig.prevPhase || phase;
  rig.prevPhase = phase;
  if ((phase === 'POINT_OVER' || phase === 'MATCH_OVER') && context?.lastPointWinner) {
    const actorTeam = String(actor.role || '').startsWith('opponent') ? 'opponent' : 'player';
    if (!rig.reaction.active) {
      triggerPointReaction(actor, context.lastPointWinner === actorTeam ? 'win' : 'loss');
    }
  } else if (
    rig.reaction.active &&
    prevPhase === 'POINT_OVER' &&
    phase === 'SERVE_STANCE' &&
    rig.reaction.timer > 0.25
  ) {
    rig.reaction.active = false;
  }

  // --------------------------------------------------------------------------
  // 1. Velocity, Local-Frame Kinematics & Braking Inertia Detection
  // --------------------------------------------------------------------------
  // Transform world velocity into character-local frame:
  // When `sideSign > 0` (`root.rotation.y = Math.PI`), character local +X is world -X,
  // and character local +Z (forward toward net) is world -Z.
  // When `sideSign < 0` (`root.rotation.y = 0`), character local +X is world +X,
  // and character local +Z (forward toward net) is world +Z.
  const worldVx = actor.vel ? actor.vel.x : 0;
  const worldVz = actor.vel ? actor.vel.z : 0;
  const speed = Math.hypot(worldVx, worldVz);
  const isMoving = speed > 0.25;

  const localVelX = worldVx * -sideSign;
  const localVelZ = worldVz * -sideSign;

  const accelX = (localVelX - rig.prevLocalVelX) / Math.max(0.004, safeDt);
  const accelZ = (localVelZ - rig.prevLocalVelZ) / Math.max(0.004, safeDt);

  // Detect sudden braking or sharp cutback for comedic inertial overshoot
  const prevSpeed = Math.hypot(rig.prevLocalVelX, rig.prevLocalVelZ);
  if (prevSpeed > 1.8 && speed < prevSpeed * 0.55) {
    // Braking impulse carries torso velocity forward in the previous travel direction!
    const brakeImpulseX = THREE.MathUtils.clamp(rig.prevLocalVelX * 0.42, -3.2, 3.2);
    const brakeImpulseZ = THREE.MathUtils.clamp(rig.prevLocalVelZ * 0.42, -3.2, 3.2);
    rig.leanRollVel += -brakeImpulseX;
    rig.leanPitchVel += brakeImpulseZ;
    rig.headBouncePitchVel += brakeImpulseZ * 1.35;
    rig.headBounceRollVel += -brakeImpulseX * 1.35;
    rig.squashYVel -= 1.15;
  }

  rig.prevLocalVelX = localVelX;
  rig.prevLocalVelZ = localVelZ;
  rig.wasMoving = isMoving;

  // --------------------------------------------------------------------------
  // 2. Comedic Bouncy Footwork, Hop-Shuffles & Idle Split-Step Rhythm
  // --------------------------------------------------------------------------
  let targetRootHopY = 0;
  let targetSquashY = 1.0;
  let hipShiftX = 0;
  let hipShiftY = 0;
  let hipShiftZ = 0;

  // Reset foot pivots to rest before applying stride/hop offsets
  rig.footLPivot.position.copy(rig.basePivots.footL);
  rig.footRPivot.position.copy(rig.basePivots.footR);
  rig.footLPivot.rotation.set(0, 0, 0);
  rig.footRPivot.rotation.set(0, 0, 0);

  if (isMoving) {
    // Rapid, energetic Argon Tennis hop-shuffle cadence (14–18 rad/s)
    const hopFreq = THREE.MathUtils.clamp(14.2 + speed * 0.42, 14.0, 18.2);
    rig.hopPhase += safeDt * hopFreq;
    actor.stridePhase = rig.hopPhase;

    const rawSin = Math.sin(rig.hopPhase);
    const rawCos = Math.cos(rig.hopPhase);
    const hopAbsSin = Math.abs(rawSin);

    // Detect foot-plant minimum (when `|sin(hopPhase)|` bounces through 0)
    const hopDeriv = rawSin * rawCos;
    if (rig.prevHopDerivative < 0 && hopDeriv >= 0 && hopAbsSin < 0.35) {
      // Foot impact! Trigger soft landing squash & secondary head/hair bounce
      const impactStrength = THREE.MathUtils.clamp(speed / 8.5, 0.35, 1.15);
      rig.squashYVel -= 1.65 * impactStrength;
      rig.headBouncePitchVel += 2.6 * impactStrength;
      rig.headBounceRollVel += (rawSin >= 0 ? 1 : -1) * 1.45 * impactStrength;
      rig.headScaleBounceVel -= 1.2 * impactStrength;
    }
    rig.prevHopSin = hopAbsSin;
    rig.prevHopDerivative = hopDeriv;

    // Snappy airborne hop pop: shaped `pow(abs(sin), 0.78)`
    const speedNorm = THREE.MathUtils.clamp(speed / (actor.maxSpeed || 9.0), 0.25, 1.15);
    targetRootHopY = Math.pow(hopAbsSin, 0.78) * (0.068 + 0.036 * speedNorm);

    // Landing squash (`scale.y = 0.95, scale.x = scale.z = 1.03` on foot plant)
    // vs slight airborne stretch at hop apex
    if (hopAbsSin < 0.28) {
      targetSquashY = 0.945;
    } else if (hopAbsSin > 0.76) {
      targetSquashY = 1.032;
    } else {
      targetSquashY = 1.0;
    }

    const isPrimarilyLateral = Math.abs(localVelX) > Math.abs(localVelZ) * 1.05;
    if (isPrimarilyLateral) {
      // Rapid Lateral Side-Shuffle Hops:
      // Feet spread/gather rapidly with ankles pitching and rolling into the lateral step
      const latSign = Math.sign(localVelX) || 1;
      const shuffleWave = rawSin;
      const leadLift = Math.max(0, rawSin);
      const trailLift = Math.max(0, -rawSin);

      rig.footLPivot.position.x =
        rig.basePivots.footL.x + (shuffleWave * 0.065 - 0.018 * latSign) * speedNorm;
      rig.footRPivot.position.x =
        rig.basePivots.footR.x + (-shuffleWave * 0.065 + 0.018 * latSign) * speedNorm;

      rig.footLPivot.position.y = rig.basePivots.footL.y + leadLift * 0.078 * speedNorm;
      rig.footRPivot.position.y = rig.basePivots.footR.y + trailLift * 0.078 * speedNorm;

      rig.footLPivot.position.z = rig.basePivots.footL.z + rawCos * 0.045 * speedNorm;
      rig.footRPivot.position.z = rig.basePivots.footR.z - rawCos * 0.045 * speedNorm;

      // Ankles roll & pitch into the shuffle step
      rig.footLPivot.rotation.z = (-latSign * 0.22 - shuffleWave * 0.18) * speedNorm;
      rig.footRPivot.rotation.z = (-latSign * 0.22 + shuffleWave * 0.18) * speedNorm;
      rig.footLPivot.rotation.x = (leadLift * 0.36 - 0.08) * speedNorm;
      rig.footRPivot.rotation.x = (trailLift * 0.36 - 0.08) * speedNorm;

      // Subtle lateral hip counter-sway during side-shuffle
      hipShiftX = latSign * 0.025 * speedNorm + shuffleWave * 0.018;
      hipShiftY = -0.022 * speedNorm;
    } else {
      // Forward / Backward High-Knee Comedic Mii Strides
      const strideSin = rawSin;
      const fwdSign = Math.sign(localVelZ) || 1;
      const liftL = Math.max(0, strideSin);
      const liftR = Math.max(0, -strideSin);

      rig.footLPivot.position.z = rig.basePivots.footL.z + strideSin * 0.165 * speedNorm * fwdSign;
      rig.footRPivot.position.z = rig.basePivots.footR.z - strideSin * 0.165 * speedNorm * fwdSign;

      rig.footLPivot.position.y = rig.basePivots.footL.y + liftL * 0.092 * speedNorm;
      rig.footRPivot.position.y = rig.basePivots.footR.y + liftR * 0.092 * speedNorm;

      // High-knee ankle pitch (`footLPivot.rotation.x`, `footRPivot.rotation.x`)
      rig.footLPivot.rotation.x = (-strideSin * 0.68 * fwdSign + liftL * 0.24) * speedNorm;
      rig.footRPivot.rotation.x = (strideSin * 0.68 * fwdSign + liftR * 0.24) * speedNorm;
      rig.footLPivot.rotation.z = strideSin * 0.08 * speedNorm;
      rig.footRPivot.rotation.z = strideSin * 0.08 * speedNorm;

      hipShiftZ = 0.02 * fwdSign * speedNorm;
    }
  } else {
    // Athletic Idle Split-Step / Rhythmic Knee-Bounce (`sin(t * 5.2)`)
    // with gentle left-to-right weight transfer so the Mii always looks alert and alive!
    const splitWave = Math.sin(t * 5.2 + rig.phaseSeed);
    const weightWave = Math.sin(t * 2.6 + rig.phaseSeed * 0.7);
    const bounceAbs = Math.abs(splitWave);

    targetRootHopY = bounceAbs * 0.026;
    targetSquashY = 1.0 - (1.0 - bounceAbs) * 0.022;

    hipShiftX = weightWave * 0.026;
    hipShiftY = -0.018 * (1.0 - bounceAbs);

    // Subtle alternating toe tap / split-step ankle roll in ready stance
    rig.footLPivot.position.x = rig.basePivots.footL.x - 0.012;
    rig.footRPivot.position.x = rig.basePivots.footR.x + 0.012;
    rig.footLPivot.position.y = rig.basePivots.footL.y + Math.max(0, weightWave) * 0.014;
    rig.footRPivot.position.y = rig.basePivots.footR.y + Math.max(0, -weightWave) * 0.014;
    rig.footLPivot.rotation.z = -weightWave * 0.08;
    rig.footRPivot.rotation.z = -weightWave * 0.08;
    rig.footLPivot.rotation.x = (1.0 - bounceAbs) * 0.07;
    rig.footRPivot.rotation.x = (1.0 - bounceAbs) * 0.07;
  }

  // --------------------------------------------------------------------------
  // 3. Shot Coil, Active Swing Uncoil & Point Reaction Targets
  // --------------------------------------------------------------------------
  const { charge: anticipationCharge, side: prepSide } = computeShotAnticipation(
    actor,
    rig,
    context
  );
  rig.anticipationCharge = THREE.MathUtils.lerp(
    rig.anticipationCharge,
    anticipationCharge,
    Math.min(1, safeDt * 12.0)
  );

  const rk = actor.racketKinematics;
  const isSwinging = Boolean(actor.swingTimer > 0 || (rk && (rk.swingActive || rk.isSwinging)));
  const rawSwingType =
    (rk && (rk.swingSide === 'backhand' ? 'backhand' : rk.swingType)) ||
    actor.swingType ||
    prepSide ||
    'forehand';
  const swingType = String(rawSwingType).toLowerCase();

  let swingProgress = 0;
  if (rk && typeof rk.swingProgress === 'number' && (rk.swingActive || rk.isSwinging)) {
    swingProgress = THREE.MathUtils.clamp(rk.swingProgress, 0, 1);
  } else if (actor.swingTimer > 0) {
    const dur = Math.max(0.18, actor.swingDuration || 0.36);
    swingProgress = THREE.MathUtils.clamp(1.0 - actor.swingTimer / dur, 0, 1);
  }

  // Detect fresh swing initiation (or side flip) to inject kinetic uncoil & bobblehead impulse
  if (isSwinging && (!rig.wasSwinging || rig.lastSwingType !== swingType)) {
    rig.lastSwingType = swingType;
    if (swingType === 'backhand') {
      // Backhand uncoils from +Y twist (Screen Left) toward -Y twist (Screen Right)
      rig.spineTwistVel -= 6.8;
      rig.leanPitchVel += 1.4;
      rig.headBounceRollVel -= 2.8;
    } else if (swingType === 'serve' || swingType === 'smash') {
      rig.spineTwistVel += 5.8;
      rig.leanPitchVel += 3.6;
      rig.headBouncePitchVel += 4.2;
      rig.squashYVel += 1.4;
    } else {
      // Forehand uncoils from -Y twist (Screen Right) toward +Y twist (Screen Left)
      rig.spineTwistVel += 6.8;
      rig.leanPitchVel += 1.6;
      rig.headBounceRollVel += 2.8;
    }
  }
  rig.wasSwinging = isSwinging;

  // Target Torso Lean (`targetLeanPitch`, `targetLeanRoll`) & Spine Twist (`targetSpineTwistY`)
  // 3a. Base movement lean + acceleration tilt
  let targetLeanPitch = THREE.MathUtils.clamp(
    localVelZ * 0.034 + accelZ * 0.0045,
    -0.28,
    0.32
  );
  let targetLeanRoll = THREE.MathUtils.clamp(
    -localVelX * 0.038 - accelX * 0.005,
    -0.30,
    0.30
  );
  let targetSpineTwistY =
    rk && typeof rk.stanceSideBlend === 'number'
      ? THREE.MathUtils.lerp(-0.08, 0.12, rk.stanceSideBlend)
      : -0.06;

  // 3b. Serve Toss Trophy Arch vs Anticipation Coil vs Active Swing Uncoil
  if (phase === 'SERVE_TOSS' && isServer && !isSwinging) {
    const tossHeightNorm = ball
      ? THREE.MathUtils.clamp((ball.pos.y - 1.1) / 2.1, 0, 1)
      : 0.65;
    targetSpineTwistY = -0.38 * tossHeightNorm;
    targetLeanPitch -= 0.18 * tossHeightNorm;
    targetLeanRoll -= 0.08 * tossHeightNorm;
    hipShiftY += 0.025 * tossHeightNorm;
  } else if (isSwinging) {
    // Active Swing Uncoil:
    // - Forehand follow-through: coils from -0.44 rad (Screen Right) and uncoils to +0.54 rad (Screen Left)
    // - Backhand follow-through: coils from +0.46 rad (Screen Left) and uncoils to -0.52 rad (Screen Right)
    // - Serve / Smash: uncoils to +0.44 rad and pitches torso forward (+0.28 rad)
    const uncoilAlpha = THREE.MathUtils.smoothstep(swingProgress, 0.0, 0.65);
    const impactPulse = Math.sin(swingProgress * Math.PI);

    if (swingType === 'backhand') {
      targetSpineTwistY = THREE.MathUtils.lerp(0.46, -0.52, uncoilAlpha);
      targetLeanPitch += 0.14 * impactPulse;
      targetLeanRoll += -0.12 * impactPulse;
      hipShiftX += -0.035 * impactPulse;
      hipShiftZ += 0.048 * impactPulse;
    } else if (swingType === 'serve' || swingType === 'smash') {
      targetSpineTwistY = THREE.MathUtils.lerp(-0.38, 0.44, uncoilAlpha);
      targetLeanPitch += THREE.MathUtils.lerp(-0.14, 0.28, uncoilAlpha);
      targetLeanRoll += 0.12 * impactPulse;
      targetRootHopY += 0.11 * impactPulse;
      hipShiftZ += 0.06 * impactPulse;
    } else {
      // Forehand drive / slice / lob
      targetSpineTwistY = THREE.MathUtils.lerp(-0.44, 0.54, uncoilAlpha);
      targetLeanPitch += 0.16 * impactPulse;
      targetLeanRoll += 0.12 * impactPulse;
      hipShiftX += 0.035 * impactPulse;
      hipShiftZ += 0.048 * impactPulse;
    }
  } else if (rig.anticipationCharge > 0.02) {
    // Shot Preparation Unit-Turn Coil (`-0.44 rad` forehand on Screen Right, `+0.46 rad` backhand on Screen Left)
    const c = rig.anticipationCharge;
    if (prepSide === 'backhand') {
      targetSpineTwistY = 0.46 * c;
      targetLeanRoll -= 0.08 * c;
      hipShiftX += 0.028 * c;
    } else if (prepSide === 'smash') {
      targetSpineTwistY = -0.38 * c;
      targetLeanPitch -= 0.14 * c;
    } else {
      targetSpineTwistY = -0.44 * c;
      targetLeanRoll += 0.08 * c;
      hipShiftX -= 0.028 * c;
    }
    // Lean knees/waist slightly back during unit turn
    targetLeanPitch -= 0.075 * c;
    hipShiftY -= 0.036 * c;
    hipShiftZ -= 0.028 * c;
  }

  // 3c. Point Celebration ('win') & Dejection ('loss') Pose Overrides
  let reactionSpinY = 0;
  if (rig.reaction.active) {
    rig.reaction.timer += safeDt;
    const rt = rig.reaction.timer;
    const normT = THREE.MathUtils.clamp(rt / rig.reaction.duration, 0, 1);

    if (rig.reaction.type === 'win') {
      // Joyous bouncy jump / fist-pump with upward head tilt!
      const jumpWave = Math.abs(Math.sin(rt * 9.2));
      const envelope = Math.pow(1.0 - normT * 0.55, 0.8);
      targetRootHopY = jumpWave * 0.16 * envelope;
      targetSquashY = jumpWave > 0.35 ? 1.04 : 0.94;
      reactionSpinY = Math.sin(rt * 9.2) * 0.16 * envelope;
      targetLeanPitch = -0.14 * envelope;
      targetLeanRoll = Math.sin(rt * 9.2) * 0.12 * envelope;
      targetSpineTwistY = Math.sin(rt * 9.2) * 0.22 * envelope;

      // Happy kicking heels in midair
      rig.footLPivot.rotation.x = jumpWave * 0.48;
      rig.footRPivot.rotation.x = -jumpWave * 0.32;

      if (actor.racketPivot) {
        actor.racketPivot.position.set(-0.36, 1.12 + jumpWave * 0.14, 0.18);
        actor.racketPivot.rotation.set(-0.42 + jumpWave * 0.22, -0.22, 0.18);
      }
    } else {
      // Comedic exasperated hop followed by slumped shoulders & head-drop
      if (rt < 0.24) {
        const frustrateHop = Math.sin((rt / 0.24) * Math.PI);
        targetRootHopY = frustrateHop * 0.11;
        targetLeanPitch = -0.12 * frustrateHop;
      } else {
        const slumpProgress = THREE.MathUtils.smoothstep(rt, 0.24, 0.65);
        targetRootHopY = 0;
        targetSquashY = 1.0 - 0.045 * slumpProgress;
        hipShiftY -= 0.065 * slumpProgress;
        targetLeanPitch = 0.34 * slumpProgress;
        targetLeanRoll = Math.sin(rt * 4.5) * 0.08 * slumpProgress;
        targetSpineTwistY = Math.sin(rt * 5.5) * 0.12 * slumpProgress;
      }
      if (actor.racketPivot) {
        actor.racketPivot.position.set(-0.32, 0.68, 0.12);
        actor.racketPivot.rotation.set(0.85, -0.12, 0.55);
      }
    }

    if (rt >= rig.reaction.duration && phase !== 'POINT_OVER' && phase !== 'MATCH_OVER') {
      rig.reaction.active = false;
    }
  }

  // --------------------------------------------------------------------------
  // 4. Sub-Stepped Underdamped Spring-Damper Integration
  // --------------------------------------------------------------------------
  const numSteps = Math.max(1, Math.ceil(safeDt / SPRING_CONFIG.MAX_SUBSTEP_DT));
  const subDt = safeDt / numSteps;

  for (let i = 0; i < numSteps; i++) {
    // Torso Pitch & Roll spring (`stiffness = 140, damping = 11`)
    const pitchForce =
      (targetLeanPitch - rig.leanPitch) * SPRING_CONFIG.TORSO_STIFFNESS -
      rig.leanPitchVel * SPRING_CONFIG.TORSO_DAMPING;
    rig.leanPitchVel += pitchForce * subDt;
    rig.leanPitch += rig.leanPitchVel * subDt;

    const rollForce =
      (targetLeanRoll - rig.leanRoll) * SPRING_CONFIG.TORSO_STIFFNESS -
      rig.leanRollVel * SPRING_CONFIG.TORSO_DAMPING;
    rig.leanRollVel += rollForce * subDt;
    rig.leanRoll += rig.leanRollVel * subDt;

    // Spine Twist Y spring (`stiffness = 165, damping = 11.8`)
    const twistForce =
      (targetSpineTwistY - rig.spineTwistY) * SPRING_CONFIG.SPINE_TWIST_STIFFNESS -
      rig.spineTwistVel * SPRING_CONFIG.SPINE_TWIST_DAMPING;
    rig.spineTwistVel += twistForce * subDt;
    rig.spineTwistY += rig.spineTwistVel * subDt;

    // Secondary Head / Hair / Visor Bounce Oscillator (`stiffness = 245, damping = 9.2`)
    const hbPitchForce =
      -rig.headBouncePitch * SPRING_CONFIG.HEAD_BOUNCE_STIFFNESS -
      rig.headBouncePitchVel * SPRING_CONFIG.HEAD_BOUNCE_DAMPING;
    rig.headBouncePitchVel += hbPitchForce * subDt;
    rig.headBouncePitch += rig.headBouncePitchVel * subDt;

    const hbRollForce =
      -rig.headBounceRoll * SPRING_CONFIG.HEAD_BOUNCE_STIFFNESS -
      rig.headBounceRollVel * SPRING_CONFIG.HEAD_BOUNCE_DAMPING;
    rig.headBounceRollVel += hbRollForce * subDt;
    rig.headBounceRoll += rig.headBounceRollVel * subDt;

    const hbScaleForce =
      -rig.headScaleBounce * SPRING_CONFIG.HEAD_BOUNCE_STIFFNESS -
      rig.headScaleBounceVel * SPRING_CONFIG.HEAD_BOUNCE_DAMPING;
    rig.headScaleBounceVel += hbScaleForce * subDt;
    rig.headScaleBounce += rig.headScaleBounceVel * subDt;

    // Vertical Hop Squash-and-Stretch spring
    const squashForce =
      (targetSquashY - rig.squashY) * SPRING_CONFIG.SQUASH_STIFFNESS -
      rig.squashYVel * SPRING_CONFIG.SQUASH_DAMPING;
    rig.squashYVel += squashForce * subDt;
    rig.squashY += rig.squashYVel * subDt;
  }

  rig.leanPitch = THREE.MathUtils.clamp(rig.leanPitch, -0.52, 0.55);
  rig.leanRoll = THREE.MathUtils.clamp(rig.leanRoll, -0.48, 0.48);
  rig.spineTwistY = THREE.MathUtils.clamp(rig.spineTwistY, -0.78, 0.78);
  rig.headBouncePitch = THREE.MathUtils.clamp(rig.headBouncePitch, -0.35, 0.35);
  rig.headBounceRoll = THREE.MathUtils.clamp(rig.headBounceRoll, -0.35, 0.35);
  rig.squashY = THREE.MathUtils.clamp(rig.squashY, 0.88, 1.12);

  // Apply Root Vertical Hop & Volume-Preserving Squash/Stretch
  rig.verticalHopOffset = targetRootHopY;
  actor.root.position.set(
    actor.pos.x,
    actor.pos.y + rig.verticalHopOffset,
    actor.pos.z
  );

  // Preserve `actor.model` base scale (1.16) while applying volume-preserving squash/stretch
  // (`scale.y = 0.95 -> scale.x = scale.z = 1.03`)
  const sy = rig.squashY;
  const sxz = 1.0 + (1.0 - sy) * 0.6;
  actor.model.scale.set(
    rig.baseModelScale.x * sxz,
    rig.baseModelScale.y * sy,
    rig.baseModelScale.z * sxz
  );
  actor.model.rotation.y = reactionSpinY;

  // Update ground contact blob shadow position & subtle airborne scale response
  if (actor.shadowBlob) {
    actor.shadowBlob.position.x = actor.pos.x;
    actor.shadowBlob.position.z = actor.pos.z;
    const shadowScale = THREE.MathUtils.clamp(1.0 - rig.verticalHopOffset * 0.85, 0.72, 1.06);
    actor.shadowBlob.scale.setScalar(shadowScale);
  }

  // Apply `hipPivot` Position & Spring-Damper Rotation
  rig.hipPivot.position.set(
    rig.basePivots.hip.x + hipShiftX,
    rig.basePivots.hip.y + hipShiftY,
    rig.basePivots.hip.z + hipShiftZ
  );
  rig.hipPivot.rotation.set(rig.leanPitch, rig.spineTwistY, rig.leanRoll);

  // --------------------------------------------------------------------------
  // 5. Head Target-Locked Ball Tracking & Secondary Hair/Visor Bounce
  // --------------------------------------------------------------------------
  let desiredLookYaw = 0;
  let desiredLookPitch = 0;

  if (rig.reaction.active) {
    if (rig.reaction.type === 'win') {
      desiredLookPitch = -0.32;
      desiredLookYaw = Math.sin(rig.reaction.timer * 8.0) * 0.18;
    } else {
      // Comedic slumped head-drop + exasperated head shake
      desiredLookPitch = 0.42;
      desiredLookYaw = Math.sin(rig.reaction.timer * 7.5) * 0.22;
    }
  } else if (ball && ball.pos) {
    // Compute vector from Mii head world position to tennis ball
    const headWorldY = actor.pos.y + 1.48;
    const dxWorld = ball.pos.x - actor.pos.x;
    const dyWorld = ball.pos.y - headWorldY;
    const dzWorld = ball.pos.z - actor.pos.z;

    // Transform into character's facing coordinate system (`+Z` = facing net)
    const localBallX = dxWorld * -sideSign;
    const localBallZ = Math.max(0.35, dzWorld * -sideSign);
    const horizDist = Math.hypot(localBallX, localBallZ);

    desiredLookYaw = THREE.MathUtils.clamp(Math.atan2(localBallX, localBallZ) * 0.78, -0.62, 0.62);
    desiredLookPitch = THREE.MathUtils.clamp(-Math.atan2(dyWorld, horizDist) * 0.72, -0.48, 0.36);
  }

  rig.headLookYaw = THREE.MathUtils.lerp(
    rig.headLookYaw,
    desiredLookYaw,
    Math.min(1, safeDt * 14.0)
  );
  rig.headLookPitch = THREE.MathUtils.lerp(
    rig.headLookPitch,
    desiredLookPitch,
    Math.min(1, safeDt * 14.0)
  );

  // `neckPivot` is a child of `hipPivot`, so it counter-rotates partially against
  // `spineTwistY` and `leanPitch` to keep the Mii's face locked onto the ball!
  const neckYaw = THREE.MathUtils.clamp(rig.headLookYaw - rig.spineTwistY * 0.68, -0.75, 0.75);
  const neckPitch = THREE.MathUtils.clamp(rig.headLookPitch - rig.leanPitch * 0.52, -0.52, 0.48);
  const neckRoll = THREE.MathUtils.clamp(-rig.leanRoll * 0.45 + rig.headLookYaw * 0.12, -0.32, 0.32);

  rig.neckPivot.position.copy(rig.basePivots.neck);
  rig.neckPivot.rotation.set(neckPitch, neckYaw, neckRoll);

  // High-frequency secondary bounce on `headBounceGroup` (oversized bobblehead / visor / hair)
  rig.headBounceGroup.rotation.set(
    rig.headBouncePitch,
    rig.headBounceRoll * 0.35,
    rig.headBounceRoll
  );
  const headScaleY = THREE.MathUtils.clamp(1.0 + rig.headScaleBounce * 0.08, 0.93, 1.08);
  const headScaleXZ = 1.0 - (headScaleY - 1.0) * 0.45;
  rig.headBounceGroup.scale.set(headScaleXZ, headScaleY, headScaleXZ);

  // --------------------------------------------------------------------------
  // 6. Racket Kinematics Fallback (if not already driven externally) &
  //    Dynamic Floating Right & Left Hand Articulation
  // --------------------------------------------------------------------------
  const externalRacketDriven = Boolean(
    actor.racketKinematics || (actor.userData && actor.userData.externalRacketKinematics)
  );

  if (!externalRacketDriven && actor.racketPivot) {
    updateFallbackRacketPivot(actor, rig, safeDt, t, {
      isSwinging,
      swingType,
      swingProgress,
      phase,
      isServer,
    });
  }

  // 6a. Right Hand (`handRPivot`):
  // Dynamically tracks and wraps around the live racket handle grip (`actor.racketPivot`),
  // sliding slightly up/down the grip and flexing wrist rotation during forehands,
  // backhands, slices, serves, and smashes so hand and racket move as one unit!
  updateRightHandGrip(actor, rig, {
    isSwinging,
    swingType,
    swingProgress,
    phase,
    isServer,
  });

  // 6b. Left Hand (`handLPivot`):
  // - Serve Toss: lifts upward (`y: 0.85 -> 1.48`) releasing ball on local +X (Screen Left), then trophy balance pose
  // - Backhand Coil & Swing: slides onto racket handle on local +X (two-handed coil),
  //   then extends out behind left hip (+X) as a counter-balance wing on follow-through
  // - Forehand: reaches forward/across as balance arm, then tucks at left ribcage (+X) on follow-through
  updateLeftHandArticulation(actor, rig, t, {
    isSwinging,
    swingType,
    swingProgress,
    prepSide,
    phase,
    isServer,
    ball,
    isMoving,
  });
}

/**
 * Provides expressive racket pivot animation when `actor.racketKinematics` is not
 * externally driving `actor.racketPivot`, ensuring full standalone compatibility.
 * Note: In `actor.root` local space, `local -X` is Forehand (Screen Right for near player)
 * and `local +X` is Backhand (Screen Left for near player).
 */
function updateFallbackRacketPivot(
  actor,
  rig,
  dt,
  t,
  { isSwinging, swingType, swingProgress, phase, isServer }
) {
  if (actor.racketMesh && actor.racketMesh.rotation) {
    actor.racketMesh.rotation.set(0, 0, 0);
  }
  if (actor.swingTimer > 0) {
    actor.swingTimer = Math.max(0, actor.swingTimer - dt);
  }
  if (actor.arcVisibleTimer > 0 && actor.swingArcMesh) {
    actor.arcVisibleTimer = Math.max(0, actor.arcVisibleTimer - dt);
    actor.swingArcMesh.visible = true;
    if (actor.swingArcMesh.material) {
      actor.swingArcMesh.material.opacity = Math.min(
        0.88,
        (actor.arcVisibleTimer / 0.3) * 0.85
      );
    }
  }

  if (rig.reaction.active) {
    if (rig.reaction.type === 'win') {
      const pump = Math.abs(Math.sin(rig.reaction.timer * 9.2));
      actor.racketPivot.position.set(-0.38, 1.24 + pump * 0.18, 0.18);
      actor.racketPivot.rotation.set(-0.45 + pump * 0.25, -0.22, 0.18);
    } else {
      actor.racketPivot.position.set(-0.32, 0.68, 0.12);
      actor.racketPivot.rotation.set(0.85, -0.12, 0.55);
    }
    return;
  }

  if (isSwinging) {
    const p = swingProgress;
    const swingCurve = Math.sin(p * Math.PI);
    const followWrap = THREE.MathUtils.smoothstep(p, 0.35, 1.0);

    if (swingType === 'serve' || swingType === 'smash') {
      actor.racketPivot.position.set(
        -0.34 + followWrap * 0.52,
        1.14 + swingCurve * 0.28 - followWrap * 0.22,
        0.14 + swingCurve * 0.22
      );
      actor.racketPivot.rotation.set(
        -0.85 + p * 1.65,
        -0.18 + followWrap * 0.65,
        0.28 - followWrap * 0.85
      );
    } else if (swingType === 'backhand') {
      // Backhand sweeps from local +X (Screen Left) across the front to local -X (Screen Right)
      const xArc = THREE.MathUtils.lerp(0.46, -0.44, THREE.MathUtils.smoothstep(p, 0.0, 0.78));
      actor.racketPivot.position.set(
        xArc,
        0.88 + swingCurve * 0.10,
        0.16 + swingCurve * 0.18
      );
      actor.racketPivot.rotation.set(
        0.28 + swingCurve * 0.24,
        0.55 - p * 1.45,
        -0.88 + p * 2.05
      );
    } else {
      // Forehand drive sweeping from local -X (Screen Right) across to local +X (Screen Left)
      const xArc = THREE.MathUtils.lerp(-0.46, 0.38, THREE.MathUtils.smoothstep(p, 0.0, 0.78));
      actor.racketPivot.position.set(
        xArc,
        0.90 + swingCurve * 0.12 + followWrap * 0.06,
        0.14 + swingCurve * 0.18
      );
      actor.racketPivot.rotation.set(
        0.30 + swingCurve * 0.22,
        -0.55 + p * 1.45,
        0.88 - p * 2.05
      );
    }
    return;
  }

  if (phase === 'SERVE_TOSS' && isServer) {
    // Trophy pose racket cocked high behind right shoulder (local -X)
    actor.racketPivot.position.set(-0.36, 1.18, 0.04);
    actor.racketPivot.rotation.set(-0.72, -0.28, 0.42);
    return;
  }

  if (rig.anticipationCharge > 0.03) {
    const c = rig.anticipationCharge;
    if (rig.coiledSide === 'backhand') {
      actor.racketPivot.position.set(
        THREE.MathUtils.lerp(-0.36, 0.44, c),
        0.88,
        THREE.MathUtils.lerp(0.14, 0.06, c)
      );
      actor.racketPivot.rotation.set(0.32, THREE.MathUtils.lerp(-0.18, 0.78, c), THREE.MathUtils.lerp(0.42, -0.86, c));
    } else {
      actor.racketPivot.position.set(
        THREE.MathUtils.lerp(-0.36, -0.45, c),
        0.92 + 0.04 * c,
        THREE.MathUtils.lerp(0.14, 0.04, c)
      );
      actor.racketPivot.rotation.set(0.32, THREE.MathUtils.lerp(-0.18, -0.78, c), THREE.MathUtils.lerp(0.42, 0.86, c));
    }
    return;
  }

  const sway = Math.sin(t * 3.6 + (actor.sideSign || 1)) * 0.04;
  actor.racketPivot.position.set(-0.36, 0.90 + sway * 0.3, 0.16);
  actor.racketPivot.rotation.set(0.36 + sway, -0.22, 0.48);
}

/**
 * Updates `handRPivot` so the detached Mii right hand + wristband wraps cleanly
 * around the live racket handle grip (`actor.racketPivot`), sliding subtly along
 * the handle axis and flexing its wrist rotation during swings.
 */
function updateRightHandGrip(actor, rig, { isSwinging, swingType, swingProgress, phase, isServer }) {
  const baseR = rig.basePivots.handR;

  if (!actor.racketPivot) {
    rig.handRPivot.position.copy(baseR);
    rig.handRPivot.rotation.set(0, 0, 0);
    return;
  }

  const rpRot = actor.racketPivot.rotation;

  // Slide slightly up/down the grip depending on shot type & swing phase:
  // - Choke up slightly (+0.025m) on volleys/slices/backhands
  // - Drop down toward butt cap (-0.022m) on serves/smashes for maximum whip leverage
  let gripSlide = 0.0;
  if (isSwinging) {
    const whip = Math.sin(swingProgress * Math.PI);
    if (swingType === 'serve' || swingType === 'smash') {
      gripSlide = -0.022 * whip;
    } else if (swingType === 'slice') {
      gripSlide = 0.024 * whip;
    } else {
      gripSlide = 0.015 * whip;
    }
  } else if (phase === 'SERVE_TOSS' && isServer) {
    gripSlide = -0.018;
  }

  // Transform exact black grip center (0, 0.08 + gripSlide, 0) in `actor.racketMesh`
  // into `actor.model` local space so `handRPivot` accounts for both `racketPivot`
  // AND `racketMesh.rotation`/`scale` and never drifts off the handle!
  if (actor.root && actor.racketMesh && actor.model) {
    actor.root.updateMatrixWorld(true);
    _tmpVecA.set(0, 0.08 + gripSlide, 0);
    actor.racketMesh.localToWorld(_tmpVecA);
    actor.model.worldToLocal(_tmpVecA);
    rig.handRPivot.position.copy(_tmpVecA);
  } else {
    const rpPos = actor.racketPivot.position;
    _tmpEulerA.set(rpRot.x, rpRot.y, rpRot.z, rpRot.order || 'XYZ');
    _tmpQuatA.setFromEuler(_tmpEulerA);
    _tmpVecA.set(0, 0.085 + gripSlide, 0).applyQuaternion(_tmpQuatA);
    const scaleX = Math.max(0.5, actor.model?.scale?.x || rig.baseModelScale.x || 1.16);
    const scaleY = Math.max(0.5, actor.model?.scale?.y || rig.baseModelScale.y || 1.16);
    const scaleZ = Math.max(0.5, actor.model?.scale?.z || rig.baseModelScale.z || 1.16);
    rig.handRPivot.position.set(
      (rpPos.x + _tmpVecA.x) / scaleX,
      (rpPos.y + _tmpVecA.y) / scaleY,
      (rpPos.z + _tmpVecA.z) / scaleZ
    );
  }

  // Flex wrist orientation (`handRPivot.rotation`) symmetrically with the racket handle + wrist snap
  const wristSnap = isSwinging ? Math.sin(swingProgress * Math.PI * 2.0) * 0.28 : 0;
  rig.handRPivot.rotation.set(
    THREE.MathUtils.clamp((rpRot.x - 0.36) * 0.65 + wristSnap, -0.95, 0.95),
    THREE.MathUtils.clamp(rpRot.y * 0.65, -0.95, 0.95),
    THREE.MathUtils.clamp(rpRot.z * 0.65, -0.95, 0.95)
  );
}

/**
 * Updates `handLPivot` for:
 * - Serve Toss (`y: 0.85 -> 1.48` releasing ball skyward on local +X / Screen Left, then trophy balance pose)
 * - Backhand Preparation & Swing (two-handed coil on racket handle at local +X -> rear wing extension)
 * - Forehand Preparation & Swing (forward balance arm -> chest tuck on follow-through)
 * - Celebration / Dejection & Locomotion arm pump
 */
function updateLeftHandArticulation(
  actor,
  rig,
  t,
  { isSwinging, swingType, swingProgress, prepSide, phase, isServer, ball, isMoving }
) {
  // In actor.model space, local +X (+0.29) is the character's off-hand / left side (Screen Left for near player).
  const offHandBaseX = 0.29;
  const offHandBaseY = rig.basePivots.handL.y; // 0.80
  const offHandBaseZ = rig.basePivots.handL.z; // 0.10
  let targetX = offHandBaseX;
  let targetY = offHandBaseY;
  let targetZ = offHandBaseZ;
  let rotX = 0;
  let rotY = 0;
  let rotZ = 0;

  if (rig.reaction.active) {
    if (rig.reaction.type === 'win') {
      // Joyous fist-pump toward the sky!
      const pump = Math.abs(Math.sin(rig.reaction.timer * 9.2 + 0.5));
      targetX = 0.28;
      targetY = 1.26 + pump * 0.18;
      targetZ = 0.20;
      rotX = -0.75;
      rotZ = -0.25;
    } else {
      // Slumped dejection drooping by left knee
      targetX = 0.28;
      targetY = 0.64;
      targetZ = 0.18;
      rotX = 0.55;
      rotZ = 0.18;
    }
  } else if (phase === 'SERVE_TOSS' && isServer) {
    // Serve Toss: smoothly lifts upward (`y: 0.85 -> 1.48`) on local +X (Screen Left, matching ball toss at handOffset = -0.32)
    // releasing the ball toward the sky, then drops into a graceful trophy balance pose
    const ballRise = ball
      ? THREE.MathUtils.clamp((ball.pos.y - 1.12) / 1.95, 0, 1)
      : 0.75;
    const isFalling = ball && ball.vel && ball.vel.y < -0.15;
    const tossArc = isFalling ? THREE.MathUtils.lerp(1.0, 0.58, 1.0 - ballRise) : ballRise;

    targetX = THREE.MathUtils.lerp(0.24, 0.26, tossArc);
    targetY = THREE.MathUtils.lerp(offHandBaseY, 1.48, tossArc);
    targetZ = THREE.MathUtils.lerp(offHandBaseZ, 0.28, tossArc);
    rotX = -0.82 * tossArc;
    rotY = -0.18 * tossArc;
    rotZ = 0.15 * tossArc;
  } else if (phase === 'SERVE_STANCE' && isServer) {
    // Cradling the tennis ball near the racket throat on local +X before the toss
    const bounce = Math.sin(t * 4.2 + rig.phaseSeed) * 0.025;
    targetX = 0.20;
    targetY = 0.86 + bounce;
    targetZ = 0.26;
    rotX = -0.28;
    rotY = -0.35;
  } else if (isSwinging) {
    const p = swingProgress;
    const swingCurve = Math.sin(p * Math.PI);

    if (swingType === 'backhand') {
      if (p < 0.42) {
        // Two-handed backhand coil & initial drive on local +X (Screen Left): left hand grips handle above `handRPivot`
        const gripBlend = 1.0 - p / 0.42;
        targetX = THREE.MathUtils.lerp(0.32, rig.handRPivot.position.x + 0.04, gripBlend);
        targetY = THREE.MathUtils.lerp(0.92, rig.handRPivot.position.y + 0.04, gripBlend);
        targetZ = THREE.MathUtils.lerp(0.10, rig.handRPivot.position.z + 0.02, gripBlend);
        rotY = -0.45 * gripBlend;
        rotZ = 0.25 * gripBlend;
      } else {
        // Follow-through: extends out behind the left hip (local +X, -Z) as a counter-balance wing while racket whips to -X!
        const wingAlpha = THREE.MathUtils.smoothstep(p, 0.42, 0.92);
        targetX = THREE.MathUtils.lerp(0.32, 0.44, wingAlpha);
        targetY = THREE.MathUtils.lerp(0.90, 0.96, wingAlpha);
        targetZ = THREE.MathUtils.lerp(0.10, -0.24, wingAlpha);
        rotX = 0.28 * wingAlpha;
        rotY = 0.52 * wingAlpha;
        rotZ = -0.46 * wingAlpha;
      }
    } else if (swingType === 'serve' || swingType === 'smash') {
      // Drops from high sighting arm into a clean left-waist tuck as right shoulder comes over
      targetX = THREE.MathUtils.lerp(0.22, 0.32, p);
      targetY = THREE.MathUtils.lerp(1.36, 0.82, THREE.MathUtils.smoothstep(p, 0.1, 0.85));
      targetZ = THREE.MathUtils.lerp(0.24, 0.08, p);
      rotX = THREE.MathUtils.lerp(-0.65, 0.25, p);
    } else {
      // Forehand: reaches forward/across as balance arm, then tucks at left chest (+X) on follow-through
      const tuckAlpha = THREE.MathUtils.smoothstep(p, 0.35, 0.95);
      targetX = THREE.MathUtils.lerp(0.16, 0.30, tuckAlpha);
      targetY = 0.92 + swingCurve * 0.06;
      targetZ = THREE.MathUtils.lerp(0.32, 0.18, tuckAlpha);
      rotX = -0.35 + tuckAlpha * 0.22;
      rotY = THREE.MathUtils.lerp(-0.28, 0.48, tuckAlpha);
      rotZ = 0.28 * tuckAlpha;
    }
  } else if (rig.anticipationCharge > 0.03) {
    const c = rig.anticipationCharge;
    if (prepSide === 'backhand') {
      // Two-handed backhand coil on local +X: slides onto racket handle above `handRPivot`
      targetX = THREE.MathUtils.lerp(offHandBaseX, rig.handRPivot.position.x + 0.04, c);
      targetY = THREE.MathUtils.lerp(offHandBaseY, rig.handRPivot.position.y + 0.04, c);
      targetZ = THREE.MathUtils.lerp(offHandBaseZ, rig.handRPivot.position.z + 0.02, c);
      rotY = -0.48 * c;
      rotZ = 0.28 * c;
    } else if (prepSide === 'smash') {
      // Points upward toward descending lob
      targetX = THREE.MathUtils.lerp(offHandBaseX, 0.22, c);
      targetY = THREE.MathUtils.lerp(offHandBaseY, 1.32, c);
      targetZ = THREE.MathUtils.lerp(offHandBaseZ, 0.24, c);
      rotX = -0.62 * c;
    } else {
      // Forehand preparation: reaches forward/across as expressive balance & tracking arm
      targetX = THREE.MathUtils.lerp(offHandBaseX, 0.14, c);
      targetY = THREE.MathUtils.lerp(offHandBaseY, 0.95, c);
      targetZ = THREE.MathUtils.lerp(offHandBaseZ, 0.30, c);
      rotX = -0.32 * c;
      rotY = -0.34 * c;
    }
  } else if (isMoving) {
    // Energetic opposite arm pump synchronized with `hopPhase`
    const armWave = Math.sin(rig.hopPhase);
    targetX = offHandBaseX - Math.cos(rig.hopPhase) * 0.025;
    targetY = offHandBaseY + Math.abs(armWave) * 0.065;
    targetZ = offHandBaseZ - armWave * 0.12;
    rotX = armWave * 0.42;
    rotZ = -0.12;
  } else {
    // Athletic ready stance sway on local +X (Screen Left)
    const idleSway = Math.sin(t * 5.2 + rig.phaseSeed);
    targetX = offHandBaseX - 0.01;
    targetY = offHandBaseY + Math.abs(idleSway) * 0.025;
    targetZ = offHandBaseZ + 0.04;
    rotX = -0.14;
    rotY = -0.16;
  }

  rig.handLPivot.position.lerp(_tmpVecB.set(targetX, targetY, targetZ), 0.42);
  rig.handLPivot.rotation.set(rotX, rotY, rotZ);
}

/**
 * High-level stateful coordinator class for procedural Mii body animation across
 * all court actors (`player`, `playerPartner`, `opponent`, `opponentPartner`).
 */
export class MiiBodyAnimator {
  constructor(options = {}) {
    this.options = { ...options };
    this.actors = new Set();
  }

  /**
   * Wraps an actor's `Head`, `Torso`, `Hand_L`, `Hand_R`, `Foot_L`, and `Foot_R`
   * in pivot-corrected hierarchical `THREE.Group` joints.
   */
  setupArticulatedMiiRig(actor) {
    if (!actor) return null;
    this.actors.add(actor);
    return setupArticulatedMiiRig(actor);
  }

  /**
   * Alias for `setupArticulatedMiiRig(actor)`.
   */
  setupRig(actor) {
    return this.setupArticulatedMiiRig(actor);
  }

  /**
   * Updates procedural Mii footwork, spring-damper torso lean/twist, head tracking,
   * secondary bobblehead bounce, and floating hand articulation for `actor`.
   */
  updateMiiBodyAnimation(actor, dt, context = {}) {
    if (!actor) return;
    this.actors.add(actor);
    updateMiiBodyAnimation(actor, dt, context);
  }

  /**
   * Alias for `updateMiiBodyAnimation(actor, dt, context)`.
   */
  update(actor, dt, context = {}) {
    this.updateMiiBodyAnimation(actor, dt, context);
  }

  /**
   * Updates an array or list of actors in a single call.
   */
  updateAll(actors, dt, context = {}) {
    const list = Array.isArray(actors) ? actors : Array.from(this.actors);
    for (const actor of list) {
      if (actor) {
        updateMiiBodyAnimation(actor, dt, context);
      }
    }
  }

  /**
   * Triggers a point celebration (`'win'`) or dejection (`'loss'`) pose on `actor`.
   */
  triggerPointReaction(actor, outcome = 'win', options = {}) {
    triggerPointReaction(actor, outcome, options);
  }
}

export default MiiBodyAnimator;
