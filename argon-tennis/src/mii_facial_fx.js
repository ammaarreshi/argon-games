// ============================================================================
// Argon Tennis — Argon Tennis Mii Dynamic Facial Expressions & Reactive FX
// ============================================================================
// Gives every Mii character dynamic, expressive Argon Tennis animated facial
// states ('neutral', 'focused_squint', 'effort_shout', 'wide_eyed_panic',
// 'happy_grin', 'shocked_loss', plus natural periodic blinking), 3D cartoony
// sweat-drop particle emitters, and floating emotive reaction cues.
// ============================================================================

import * as THREE from 'three';

export const FACIAL_STATES = Object.freeze({
  NEUTRAL: 'neutral',
  BLINK: 'blink',
  FOCUSED_SQUINT: 'focused_squint',
  EFFORT_SHOUT: 'effort_shout',
  WIDE_EYED_PANIC: 'wide_eyed_panic',
  HAPPY_GRIN: 'happy_grin',
  SHOCKED_LOSS: 'shocked_loss',
});

const VALID_STATES = new Set(Object.values(FACIAL_STATES));

// Helper: apply sRGB color space / encoding across Three.js revisions
function applySRGBTextureEncoding(tex) {
  if (!tex) return tex;
  if ('colorSpace' in tex && THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  } else if ('encoding' in tex && THREE.sRGBEncoding) {
    tex.encoding = THREE.sRGBEncoding;
  }
  return tex;
}

// Helper: create a 3D cartoony teardrop geometry (rounded bottom + tapered tip + specular dot)
function createTeardropGeometry() {
  const group = new THREE.Group();

  const dropColor = new THREE.Color(0x52d8ff);
  const dropMat = new THREE.MeshStandardMaterial({
    color: dropColor,
    emissive: new THREE.Color(0x1ca8e8),
    emissiveIntensity: 0.42,
    roughness: 0.16,
    metalness: 0.05,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });

  // Lower droplet bulb
  const bulbGeo = new THREE.SphereGeometry(0.036, 12, 10);
  const bulbMesh = new THREE.Mesh(bulbGeo, dropMat);
  bulbMesh.position.set(0, -0.014, 0);

  // Upper tapered teardrop cone
  const tipGeo = new THREE.ConeGeometry(0.035, 0.068, 12);
  const tipMesh = new THREE.Mesh(tipGeo, dropMat);
  tipMesh.position.set(0, 0.022, 0);

  // Crisp white cartoon specular highlight pip on the droplet
  const specMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const specGeo = new THREE.SphereGeometry(0.011, 8, 6);
  const specMesh = new THREE.Mesh(specGeo, specMat);
  specMesh.position.set(-0.012, -0.006, 0.028);

  group.add(bulbMesh, tipMesh, specMesh);
  group.renderOrder = 9;
  return { group, dropMat, specMat };
}

// Helper: create a 5-pointed 3D star mesh for 'win' emote bursts
function createGoldenStarMesh() {
  const starGroup = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffdf2b,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xfff8b8,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });

  const octGeo = new THREE.OctahedronGeometry(0.078, 0);
  const octA = new THREE.Mesh(octGeo, mat);
  octA.scale.set(1.15, 1.15, 0.45);
  const octB = new THREE.Mesh(octGeo, mat);
  octB.scale.set(1.15, 1.15, 0.45);
  octB.rotation.z = Math.PI / 4;

  const coreGeo = new THREE.SphereGeometry(0.042, 8, 8);
  const core = new THREE.Mesh(coreGeo, coreMat);

  starGroup.add(octA, octB, core);
  starGroup.renderOrder = 10;
  return { mesh: starGroup, materials: [mat, coreMat] };
}

// Helper: create a 3D musical eighth-note mesh for 'win' emote bursts
function createMusicNoteMesh() {
  const noteGroup = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x48f0ff,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });

  const headGeo = new THREE.SphereGeometry(0.036, 10, 8);
  const head = new THREE.Mesh(headGeo, mat);
  head.scale.set(1.25, 0.9, 0.6);
  head.position.set(-0.018, -0.035, 0);
  head.rotation.z = 0.32;

  const stemGeo = new THREE.BoxGeometry(0.014, 0.095, 0.014);
  const stem = new THREE.Mesh(stemGeo, mat);
  stem.position.set(0.012, 0.012, 0);

  const flagGeo = new THREE.BoxGeometry(0.042, 0.018, 0.014);
  const flag = new THREE.Mesh(flagGeo, mat);
  flag.position.set(0.03, 0.048, 0);
  flag.rotation.z = -0.35;

  noteGroup.add(head, stem, flag);
  noteGroup.renderOrder = 10;
  return { mesh: noteGroup, materials: [mat] };
}

// Helper: create dual comic exclamation / stress ticks ('!!') for 'panic' / 'close_call'
function createComicExclamationMesh() {
  const group = new THREE.Group();
  const barMat = new THREE.MeshBasicMaterial({
    color: 0xff3b28,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0xfff352,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });

  for (const xOff of [-0.028, 0.028]) {
    const stemGeo = new THREE.ConeGeometry(0.020, 0.095, 8);
    const stem = new THREE.Mesh(stemGeo, barMat);
    stem.rotation.z = Math.PI;
    stem.position.set(xOff, 0.026, 0);

    const backGeo = new THREE.ConeGeometry(0.026, 0.105, 8);
    const back = new THREE.Mesh(backGeo, outlineMat);
    back.rotation.z = Math.PI;
    back.position.set(xOff, 0.026, -0.005);

    const dotGeo = new THREE.SphereGeometry(0.017, 8, 8);
    const dot = new THREE.Mesh(dotGeo, barMat);
    dot.position.set(xOff, -0.045, 0);

    group.add(stem, back, dot);
  }
  group.renderOrder = 10;
  return { mesh: group, materials: [barMat, outlineMat] };
}

// ============================================================================
// High-Resolution 512x512 Conformal Face Canvas Painter (Dual-Layer Supplement)
// ============================================================================
function createConformalFaceCanvas() {
  if (typeof document === 'undefined' || !document.createElement) {
    // Headless Node verification fallback
    const data = new Uint8Array(64 * 64 * 4);
    const tex = new THREE.DataTexture(data, 64, 64, THREE.RGBAFormat);
    applySRGBTextureEncoding(tex);
    tex.needsUpdate = true;
    return { canvas: null, ctx: null, texture: tex };
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBTextureEncoding(texture);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return { canvas, ctx, texture };
}

function paintConformalFaceOverlay(faceCanvasObj, state, isBlinking, browHex = '#3b2314') {
  if (!faceCanvasObj || !faceCanvasObj.ctx) return;
  const { ctx, canvas, texture } = faceCanvasObj;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const effectiveState = isBlinking && state === FACIAL_STATES.NEUTRAL
    ? FACIAL_STATES.BLINK
    : state;

  // Soft rosy Mii cheek blush decals on left & right cheeks
  const blushAlpha =
    effectiveState === FACIAL_STATES.HAPPY_GRIN
      ? 0.58
      : effectiveState === FACIAL_STATES.EFFORT_SHOUT
      ? 0.42
      : effectiveState === FACIAL_STATES.NEUTRAL || effectiveState === FACIAL_STATES.BLINK
      ? 0.25
      : 0.14;

  for (const cx of [126, 386]) {
    const cy = 304;
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 46);
    grad.addColorStop(0.0, `rgba(255, 105, 120, ${blushAlpha})`);
    grad.addColorStop(0.65, `rgba(255, 120, 130, ${blushAlpha * 0.45})`);
    grad.addColorStop(1.0, 'rgba(255, 120, 130, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 46, 28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp vector anime/Mii expression accents around the 3D articulated features
  // (Note: HAPPY_GRIN '^ ^' and SHOCKED_LOSS 'X X' eyes are rendered by 3D happyArcGroup
  // and shockXGroup meshes so we do not duplicate them on the 2D conformal canvas.)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (effectiveState === FACIAL_STATES.WIDE_EYED_PANIC) {
    // Pale blue forehead anxiety shade & under-eye bags for comic panic
    const panicGrad = ctx.createLinearGradient(0, 70, 0, 185);
    panicGrad.addColorStop(0.0, 'rgba(55, 135, 235, 0.34)');
    panicGrad.addColorStop(1.0, 'rgba(55, 135, 235, 0.0)');
    ctx.fillStyle = panicGrad;
    ctx.fillRect(90, 70, 332, 115);
  } else if (effectiveState === FACIAL_STATES.FOCUSED_SQUINT) {
    // Sharp upper-lid focus crease lines
    ctx.strokeStyle = browHex;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(232, 168);
    ctx.lineTo(244, 192);
    ctx.moveTo(280, 168);
    ctx.lineTo(268, 192);
    ctx.stroke();
  }

  texture.needsUpdate = true;
}

// ============================================================================
// Main Controller: MiiFacialFXController
// ============================================================================
export class MiiFacialFXController {
  constructor(sceneOrOptions = null) {
    if (sceneOrOptions && sceneOrOptions.isObject3D) {
      this.scene = sceneOrOptions;
      this.options = {};
    } else if (sceneOrOptions && typeof sceneOrOptions === 'object') {
      this.scene = sceneOrOptions.scene || null;
      this.options = sceneOrOptions;
    } else {
      this.scene = null;
      this.options = {};
    }

    this.actors = new Set();
    this.sweatDrops = [];
    this.emoteParticles = [];
    this.elapsedTime = 0;
    this._lastPhase = null;

    if (this.scene) {
      this._ensureParticlePools(this.scene);
    }
  }

  _ensureParticlePools(scene) {
    if (!scene || this._poolsInitialized) return;
    this.scene = scene;
    this._poolsInitialized = true;

    // 1. 3D Cartoony Sweat-Drop Particle Pool (28 glossy cyan-blue teardrops)
    for (let i = 0; i < 28; i++) {
      const { group, dropMat, specMat } = createTeardropGeometry();
      group.visible = false;
      scene.add(group);
      this.sweatDrops.push({
        mesh: group,
        dropMat,
        specMat,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.62,
        active: false,
      });
    }

    // 2. Floating Emotive Burst Pool (Golden Stars, Music Notes, Comic '!!' Ticks)
    for (let i = 0; i < 18; i++) {
      const kind = i < 8 ? 'star' : i < 12 ? 'note' : 'exclamation';
      const built =
        kind === 'star'
          ? createGoldenStarMesh()
          : kind === 'note'
          ? createMusicNoteMesh()
          : createComicExclamationMesh();
      built.mesh.visible = false;
      scene.add(built.mesh);
      this.emoteParticles.push({
        kind,
        mesh: built.mesh,
        materials: built.materials,
        vel: new THREE.Vector3(),
        anchorActor: null,
        localOffset: new THREE.Vector3(),
        age: 0,
        maxAge: 0.95,
        spinSpeed: 0,
        active: false,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 1. Dynamic Animated Mii Face System (`attachFacialRig(actor)`)
  // --------------------------------------------------------------------------
  attachFacialRig(actor, options = {}) {
    if (!actor) return null;
    if (actor.facialRig && actor.facialRig.faceGroup) {
      this.actors.add(actor);
      return actor.facialRig;
    }

    const rootObj = actor.model || actor.root;
    if (!rootObj) return null;

    // Resolve scene if not passed to constructor
    if (!this.scene) {
      let p = actor.root || rootObj;
      while (p && p.parent) p = p.parent;
      if (p && p !== actor.root) {
        this._ensureParticlePools(p);
      }
    }

    if (!actor.parts) actor.parts = {};

    // Traverse actor hierarchy to ensure `actor.parts.head` (including `Head.001` / `Head001`
    // in `mii_opponent.glb`) and all sibling body parts are bound cleanly
    let headNode = actor.parts.head || null;
    rootObj.traverse((child) => {
      const n = (child.name || '').trim();
      if (/^head(\.?0*\d+)?$/i.test(n) && !child.isMesh) {
        headNode = child;
        actor.parts.head = child;
      } else if (/^head(\.?0*\d+)?$/i.test(n) && !headNode) {
        headNode = child;
        actor.parts.head = child;
      } else if (/^torso(\.?0*\d+)?$/i.test(n) && !actor.parts.torso) {
        actor.parts.torso = child;
      } else if (/^hand_l(\.?0*\d+)?$/i.test(n) && !actor.parts.handL) {
        actor.parts.handL = child;
      } else if (/^hand_r(\.?0*\d+)?$/i.test(n) && !actor.parts.handR) {
        actor.parts.handR = child;
      } else if (/^foot_l(\.?0*\d+)?$/i.test(n) && !actor.parts.footL) {
        actor.parts.footL = child;
      } else if (/^foot_r(\.?0*\d+)?$/i.test(n) && !actor.parts.footR) {
        actor.parts.footR = child;
      }
    });

    if (!headNode) {
      headNode = new THREE.Group();
      headNode.name = 'Head';
      headNode.position.set(0, 1.22, 0);
      rootObj.add(headNode);
      actor.parts.head = headNode;
    }

    // Determine exact local skull center Y inside `headNode` (in `mii_player.glb` and
    // `mii_opponent.glb`, `headNode.position.y === 1.22` and skull center is at local `y = 0.18`,
    // which equals `1.40` in Mii root coordinates; if `headNode.position.y === 0`, local `y = 1.40`)
    let skullY =
      headNode.position && Math.abs(headNode.position.y - 1.22) < 0.35
        ? 0.18
        : 1.40 - (headNode.position ? headNode.position.y : 0);
    let skinColorHex = actor.sideSign < 0 || /opponent/i.test(actor.role || '') ? 0xedb891 : 0xf7c6a0;
    let hairColorHex = actor.sideSign < 0 || /opponent/i.test(actor.role || '') ? 0x1c1817 : 0x59311a;

    // Pass 1: Find exact skullY from `*_Skin` bounding box midpoint and hide `*_EyeDark`, `*_Mouth`, `*_Tongue`
    headNode.traverse((child) => {
      if (!child.isMesh) return;
      const mat = Array.isArray(child.material) ? child.material[0] : child.material;
      const matName = (mat && mat.name) || '';
      const meshName = child.name || '';

      if (/Skin/i.test(matName) && child.geometry) {
        child.geometry.computeBoundingBox();
        const bb = child.geometry.boundingBox;
        if (bb) {
          skullY = (bb.min.y + bb.max.y) * 0.5;
        }
        if (mat && mat.color) {
          skinColorHex = mat.color.getHex();
        }
      } else if (
        /EyeDark|Mouth|Tongue/i.test(matName) ||
        /EyePupil|Smile|Mouth|Tongue/i.test(meshName)
      ) {
        child.visible = false;
      }
    });

    // Pass 2: Tuck static baked `EyebrowSeg` (in `*_Hair`) and `EyeWhite`/`EyeHighlight`/`TeethArc` (in `*_White`)
    // into `(0, skullY, 0)` so they never ghost behind dynamic expressions, while keeping the 3D hair cap,
    // hair locks/spikes, headbands, and visors 100% intact!
    headNode.traverse((child) => {
      if (!child.isMesh) return;
      const mat = Array.isArray(child.material) ? child.material[0] : child.material;
      const matName = (mat && mat.name) || '';

      if (/Hair/i.test(matName)) {
        if (mat && mat.color) {
          hairColorHex = mat.color.getHex();
        }
        if (child.geometry && !child.userData.staticBrowsTucked) {
          const geom = child.geometry.clone();
          const pos = geom.attributes.position;
          if (pos) {
            for (let i = 0; i < pos.count; i++) {
              const vx = pos.getX(i);
              const vy = pos.getY(i);
              const vz = pos.getZ(i);
              if (
                Math.abs(vx) > 0.024 &&
                Math.abs(vx) < 0.156 &&
                vy > skullY + 0.018 &&
                vy < skullY + 0.092 &&
                vz > 0.172
              ) {
                pos.setXYZ(i, 0, skullY, 0);
              }
            }
            pos.needsUpdate = true;
          }
          child.geometry = geom;
          child.userData.staticBrowsTucked = true;
        }
      } else if (/White/i.test(matName) && child.geometry && !child.userData.staticEyesTucked) {
        const geom = child.geometry.clone();
        const pos = geom.attributes.position;
        if (pos) {
          for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const vz = pos.getZ(i);
            if (vz > 0.195 && vy < skullY + 0.066 && Math.abs(vx) < 0.145) {
              pos.setXYZ(i, 0, skullY, 0);
            }
          }
          pos.needsUpdate = true;
        }
        child.geometry = geom;
        child.userData.staticEyesTucked = true;
      }
    });

    // Build `faceGroup` centered at `(0, skullY, 0)` inside `headNode`
    const faceGroup = new THREE.Group();
    faceGroup.name = 'MiiDynamicFaceGroup';
    faceGroup.position.set(0, skullY, 0);
    headNode.add(faceGroup);

    // Shared facial materials
    const scleraMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    const pupilMat = new THREE.MeshBasicMaterial({
      color: 0x121318,
    });
    const catchlightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    const browMat = new THREE.MeshStandardMaterial({
      color: hairColorHex,
      roughness: 0.45,
      metalness: 0.05,
    });
    const eyelidMat = new THREE.MeshStandardMaterial({
      color: skinColorHex,
      roughness: 0.48,
      metalness: 0.0,
    });
    const mouthDarkMat = new THREE.MeshBasicMaterial({
      color: 0x521218,
    });
    const tongueMat = new THREE.MeshBasicMaterial({
      color: 0xff6e7a,
    });
    const cheekMat = new THREE.MeshBasicMaterial({
      color: 0xff6b7b,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });

    // --- LAYER A.1: Left & Right 3D Articulated Eye Groups ---
    const buildEyeGroup = (sideSign) => {
      const eyeRoot = new THREE.Group();
      eyeRoot.name = sideSign < 0 ? 'LeftEyeGroup' : 'RightEyeGroup';
      eyeRoot.position.set(sideSign * 0.080, 0.032, 0.218);

      // 1. Open eye assembly (sclera + pupil + dual catchlights + upper eyelid)
      const openEyeNode = new THREE.Group();

      const scleraGeo = new THREE.SphereGeometry(0.038, 18, 14);
      const scleraMesh = new THREE.Mesh(scleraGeo, scleraMat);
      scleraMesh.scale.set(1.06, 1.18, 0.42);
      openEyeNode.add(scleraMesh);

      const pupilGroup = new THREE.Group();
      pupilGroup.position.set(-sideSign * 0.003, 0.0, 0.011);

      const pupilGeo = new THREE.SphereGeometry(0.026, 16, 12);
      const pupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
      pupilMesh.scale.set(0.96, 1.12, 0.38);
      pupilGroup.add(pupilMesh);

      const catchMainGeo = new THREE.SphereGeometry(0.0095, 10, 8);
      const catchMain = new THREE.Mesh(catchMainGeo, catchlightMat);
      catchMain.position.set(-0.008, 0.011, 0.010);
      pupilGroup.add(catchMain);

      const catchSubGeo = new THREE.SphereGeometry(0.005, 8, 6);
      const catchSub = new THREE.Mesh(catchSubGeo, catchlightMat);
      catchSub.position.set(0.007, -0.009, 0.010);
      pupilGroup.add(catchSub);

      openEyeNode.add(pupilGroup);

      // Upper eyelid cap for squinting & natural blinking
      const lidGeo = new THREE.SphereGeometry(0.040, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52);
      const lidMesh = new THREE.Mesh(lidGeo, eyelidMat);
      lidMesh.scale.set(1.08, 1.18, 0.46);
      lidMesh.visible = false;
      openEyeNode.add(lidMesh);

      eyeRoot.add(openEyeNode);

      // 2. Closed blink line bar (`- -`)
      const blinkBarGeo = new THREE.BoxGeometry(0.072, 0.012, 0.016);
      const blinkBarMesh = new THREE.Mesh(blinkBarGeo, pupilMat);
      blinkBarMesh.position.set(0, 0, 0.012);
      blinkBarMesh.visible = false;
      eyeRoot.add(blinkBarMesh);

      // 3. Happy crescent arch (`^ ^`) for `'happy_grin'`
      const happyArcGroup = new THREE.Group();
      happyArcGroup.position.set(0, -0.004, 0.014);
      const arcSegGeo = new THREE.TorusGeometry(0.030, 0.0075, 8, 18, Math.PI * 0.85);
      const arcMesh = new THREE.Mesh(arcSegGeo, pupilMat);
      arcMesh.rotation.z = Math.PI * 0.075;
      happyArcGroup.add(arcMesh);
      happyArcGroup.visible = false;
      eyeRoot.add(happyArcGroup);

      // 4. Shocked / Loss `'X X'` crossed bars for `'shocked_loss'`
      const shockXGroup = new THREE.Group();
      shockXGroup.position.set(0, 0.002, 0.014);
      const xBarGeo = new THREE.BoxGeometry(0.068, 0.013, 0.014);
      const xBar1 = new THREE.Mesh(xBarGeo, pupilMat);
      xBar1.rotation.z = 0.68;
      const xBar2 = new THREE.Mesh(xBarGeo, pupilMat);
      xBar2.rotation.z = -0.68;
      shockXGroup.add(xBar1, xBar2);
      shockXGroup.visible = false;
      eyeRoot.add(shockXGroup);

      faceGroup.add(eyeRoot);
      return {
        root: eyeRoot,
        openEyeNode,
        scleraMesh,
        pupilGroup,
        pupilMesh,
        lidMesh,
        blinkBarMesh,
        happyArcGroup,
        shockXGroup,
      };
    };

    const leftEye = buildEyeGroup(-1);
    const rightEye = buildEyeGroup(1);

    // --- LAYER A.2: Left & Right 3D Articulated Eyebrows ---
    const buildBrowMesh = (sideSign) => {
      const browPivot = new THREE.Group();
      browPivot.name = sideSign < 0 ? 'LeftBrowPivot' : 'RightBrowPivot';
      browPivot.position.set(sideSign * 0.082, 0.092, 0.219);

      const browGeo = new THREE.BoxGeometry(0.076, 0.018, 0.022);
      const browMesh = new THREE.Mesh(browGeo, browMat);
      browPivot.add(browMesh);
      faceGroup.add(browPivot);
      return browPivot;
    };

    const leftBrow = buildBrowMesh(-1);
    const rightBrow = buildBrowMesh(1);

    // --- LAYER A.3: 3D Articulated Multi-Shape Mouth Group ---
    const mouthGroup = new THREE.Group();
    mouthGroup.name = 'MouthGroup';
    mouthGroup.position.set(0, -0.078, 0.233);
    faceGroup.add(mouthGroup);

    // (a) Neutral cheerful Mii smile + white teeth strip
    const neutralMouth = new THREE.Group();
    const smileBox = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.024, 0.016), mouthDarkMat);
    const smileTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.011, 0.018), scleraMat);
    smileTeeth.position.set(0, 0.005, 0.002);
    neutralMouth.add(smileBox, smileTeeth);
    mouthGroup.add(neutralMouth);

    // (b) Focused squint determined clenched grimace
    const squintMouth = new THREE.Group();
    const clenchRim = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.020, 0.016), pupilMat);
    const clenchTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.012, 0.018), scleraMat);
    squintMouth.add(clenchRim, clenchTeeth);
    squintMouth.visible = false;
    mouthGroup.add(squintMouth);

    // (c) Open 'O' battle-cry / gasped mouth (used by 'effort_shout' & 'wide_eyed_panic')
    const openOMouth = new THREE.Group();
    const oRimGeo = new THREE.SphereGeometry(0.036, 16, 12);
    const oCavity = new THREE.Mesh(oRimGeo, mouthDarkMat);
    oCavity.scale.set(1.05, 1.18, 0.38);
    const oTongueGeo = new THREE.SphereGeometry(0.022, 12, 8);
    const oTongue = new THREE.Mesh(oTongueGeo, tongueMat);
    oTongue.position.set(0, -0.012, 0.005);
    oTongue.scale.set(1.1, 0.65, 0.35);
    openOMouth.add(oCavity, oTongue);
    openOMouth.visible = false;
    mouthGroup.add(openOMouth);

    // (d) Big beaming happy grin ('happy_grin'): downward-curved D-smile proud of the chin surface
    const grinMouth = new THREE.Group();
    const grinCavityGeo = new THREE.SphereGeometry(0.046, 20, 14, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
    const grinCavity = new THREE.Mesh(grinCavityGeo, mouthDarkMat);
    grinCavity.position.set(0, 0.006, 0.002);
    grinCavity.scale.set(1.12, 0.88, 0.34);
    const grinTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.012, 0.014), scleraMat);
    grinTeeth.position.set(0, -0.002, 0.006);
    const grinTongue = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), tongueMat);
    grinTongue.position.set(0, -0.022, 0.007);
    grinTongue.scale.set(1.25, 0.58, 0.32);
    grinMouth.add(grinCavity, grinTeeth, grinTongue);
    grinMouth.visible = false;
    mouthGroup.add(grinMouth);

    // (e) Wavy disappointed mouth ('shocked_loss')
    const wavyMouth = new THREE.Group();
    for (let seg = -1; seg <= 1; seg++) {
      const segMesh = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.012, 0.020), pupilMat);
      segMesh.position.set(seg * 0.026, seg === 0 ? 0.005 : -0.005, 0.002);
      segMesh.rotation.z = seg === -1 ? 0.32 : seg === 1 ? -0.32 : 0.0;
      wavyMouth.add(segMesh);
    }
    wavyMouth.visible = false;
    mouthGroup.add(wavyMouth);

    // --- LAYER A.4: 3D Rosy Cheek Blush Ovals ---
    const buildCheekMesh = (sideSign) => {
      const cheekGeo = new THREE.SphereGeometry(0.028, 12, 10);
      const cheekMesh = new THREE.Mesh(cheekGeo, cheekMat);
      cheekMesh.position.set(sideSign * 0.128, -0.024, 0.196);
      cheekMesh.scale.set(1.22, 0.78, 0.32);
      cheekMesh.renderOrder = 4;
      faceGroup.add(cheekMesh);
      return cheekMesh;
    };
    const leftCheek = buildCheekMesh(-1);
    const rightCheek = buildCheekMesh(1);

    // --- LAYER B: Curved Conformal 512x512 Front-Face Canvas Patch ---
    const faceCanvasObj = createConformalFaceCanvas();
    const patchGeo = new THREE.SphereGeometry(
      0.238,
      24,
      18,
      Math.PI * 0.25,
      Math.PI * 0.50,
      Math.PI * 0.30,
      Math.PI * 0.42
    );
    // Rotate sphere patch so the UV center faces +Z (front of Mii face)
    patchGeo.rotateY(-Math.PI * 0.5);
    const patchMat = new THREE.MeshBasicMaterial({
      map: faceCanvasObj.texture,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const conformalPatchMesh = new THREE.Mesh(patchGeo, patchMat);
    conformalPatchMesh.scale.set(0.98, 1.04, 0.975);
    conformalPatchMesh.renderOrder = 5;
    faceGroup.add(conformalPatchMesh);

    const browCssHex = '#' + new THREE.Color(hairColorHex).getHexString();

    const rig = {
      actor,
      headNode,
      faceGroup,
      skullY,
      browCssHex,
      leftEye,
      rightEye,
      leftBrow,
      rightBrow,
      mouthGroup,
      neutralMouth,
      squintMouth,
      openOMouth,
      grinMouth,
      wavyMouth,
      leftCheek,
      rightCheek,
      cheekMat,
      conformalPatchMesh,
      faceCanvasObj,
      state: FACIAL_STATES.NEUTRAL,
      stateTimer: 0,
      stateDuration: 0,
      blinkTimer: 2.6 + Math.random() * 1.6,
      blinkActiveTimer: 0,
      sweatCooldown: 0,
      panicEmoteCooldown: 0,
      lastSwingTimer: 0,
      gazeOffset: new THREE.Vector2(0, 0),
    };

    actor.facialRig = rig;
    if (actor.userData) {
      actor.userData.facialRig = rig;
    }

    this.actors.add(actor);
    this._applyStateVisuals(rig);
    return rig;
  }

  attachToAllActors(actors) {
    if (!actors) return;
    const list = Array.isArray(actors) ? actors : Object.values(actors);
    for (const a of list) {
      if (a) this.attachFacialRig(a);
    }
  }

  _resolveActor(actorOrRole) {
    if (!actorOrRole) return null;
    if (typeof actorOrRole === 'object') {
      if (!actorOrRole.facialRig && (actorOrRole.root || actorOrRole.model)) {
        this.attachFacialRig(actorOrRole);
      }
      return actorOrRole;
    }
    const roleStr = String(actorOrRole).toLowerCase();
    for (const a of this.actors) {
      if (String(a.role || '').toLowerCase() === roleStr) return a;
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // 2. 6 Expressive Facial States (`setExpression(actor, state, duration)`)
  // --------------------------------------------------------------------------
  setExpression(actorOrRole, state = FACIAL_STATES.NEUTRAL, duration = 0.65) {
    const actor = this._resolveActor(actorOrRole);
    if (!actor || !actor.facialRig) return null;

    const rig = actor.facialRig;
    const normState = String(state || FACIAL_STATES.NEUTRAL).toLowerCase().trim();
    const targetState = VALID_STATES.has(normState) ? normState : FACIAL_STATES.NEUTRAL;

    const prevState = rig.state;
    rig.state = targetState;

    if (targetState === FACIAL_STATES.NEUTRAL) {
      rig.stateTimer = 0;
      rig.stateDuration = 0;
    } else if (targetState === FACIAL_STATES.BLINK) {
      rig.blinkActiveTimer = typeof duration === 'number' && duration > 0 ? duration : 0.11;
      rig.state = FACIAL_STATES.NEUTRAL;
    } else {
      const defaultDur =
        targetState === FACIAL_STATES.EFFORT_SHOUT
          ? 0.35
          : targetState === FACIAL_STATES.HAPPY_GRIN || targetState === FACIAL_STATES.SHOCKED_LOSS
          ? 1.65
          : 0.55;
      const dur = typeof duration === 'number' ? duration : defaultDur;
      rig.stateDuration = dur;
      rig.stateTimer = dur;
    }

    // Trigger reactive sweat drops automatically when entering 'wide_eyed_panic'
    if (
      targetState === FACIAL_STATES.WIDE_EYED_PANIC &&
      prevState !== FACIAL_STATES.WIDE_EYED_PANIC &&
      rig.sweatCooldown <= 0
    ) {
      this.spawnSweatDrops(actor, 4);
      rig.sweatCooldown = 0.28;
    }

    this._applyStateVisuals(rig);
    return rig.state;
  }

  getExpression(actorOrRole) {
    const actor = this._resolveActor(actorOrRole);
    return actor?.facialRig?.state || FACIAL_STATES.NEUTRAL;
  }

  _applyStateVisuals(rig) {
    if (!rig) return;
    const state = rig.state;
    const isBlinking = rig.blinkActiveTimer > 0 && state === FACIAL_STATES.NEUTRAL;

    const {
      leftEye,
      rightEye,
      leftBrow,
      rightBrow,
      neutralMouth,
      squintMouth,
      openOMouth,
      grinMouth,
      wavyMouth,
      cheekMat,
    } = rig;

    // Reset base visibilities
    for (const eye of [leftEye, rightEye]) {
      eye.openEyeNode.visible = false;
      eye.blinkBarMesh.visible = false;
      eye.happyArcGroup.visible = false;
      eye.shockXGroup.visible = false;
      eye.lidMesh.visible = false;
      eye.openEyeNode.scale.set(1, 1, 1);
      eye.pupilGroup.scale.set(1, 1, 1);
    }

    neutralMouth.visible = false;
    squintMouth.visible = false;
    openOMouth.visible = false;
    grinMouth.visible = false;
    wavyMouth.visible = false;

    // Configure per-expression 3D articulated transforms
    if (state === FACIAL_STATES.FOCUSED_SQUINT) {
      // Determined V-tilted eyebrows (brow.rotation.z = ±0.32), narrowed focused eyes (scale.y = 0.52)
      leftBrow.position.set(-0.080, 0.082, 0.222);
      rightBrow.position.set(0.080, 0.082, 0.222);
      leftBrow.rotation.set(0, 0.12, -0.32);
      rightBrow.rotation.set(0, -0.12, 0.32);

      for (const eye of [leftEye, rightEye]) {
        eye.openEyeNode.visible = true;
        eye.openEyeNode.scale.set(1.04, 0.52, 1.0);
        eye.lidMesh.visible = true;
      }

      squintMouth.visible = true;
      cheekMat.opacity = 0.22;
    } else if (state === FACIAL_STATES.EFFORT_SHOUT) {
      // Fierce angled brows, wide intense eyes, open shouting mouth ('O' / battle cry)
      leftBrow.position.set(-0.080, 0.088, 0.224);
      rightBrow.position.set(0.080, 0.088, 0.224);
      leftBrow.rotation.set(0, 0.14, -0.36);
      rightBrow.rotation.set(0, -0.14, 0.36);

      for (const eye of [leftEye, rightEye]) {
        eye.openEyeNode.visible = true;
        eye.openEyeNode.scale.set(1.14, 1.18, 1.05);
        eye.pupilGroup.scale.set(0.92, 0.92, 1.0);
      }

      openOMouth.visible = true;
      openOMouth.scale.set(1.18, 1.25, 1.0);
      cheekMat.opacity = 0.44;
    } else if (state === FACIAL_STATES.WIDE_EYED_PANIC) {
      // Huge wide white eyes with shrunk pinpoint pupils, high raised worried brows (∓0.35), open gasped mouth
      leftBrow.position.set(-0.084, 0.108, 0.222);
      rightBrow.position.set(0.084, 0.108, 0.222);
      leftBrow.rotation.set(0, 0.10, 0.35);
      rightBrow.rotation.set(0, -0.10, -0.35);

      for (const eye of [leftEye, rightEye]) {
        eye.openEyeNode.visible = true;
        eye.openEyeNode.scale.set(1.32, 1.38, 1.08);
        eye.pupilGroup.scale.set(0.46, 0.46, 1.0);
      }

      openOMouth.visible = true;
      openOMouth.scale.set(0.95, 1.32, 1.0);
      cheekMat.opacity = 0.12;
    } else if (state === FACIAL_STATES.HAPPY_GRIN) {
      // Joyous upside-down crescent '^ ^' happy anime/Mii eyes, high cheerful brows, big open beaming grin, rosy cheeks
      leftBrow.position.set(-0.084, 0.106, 0.220);
      rightBrow.position.set(0.084, 0.106, 0.220);
      leftBrow.rotation.set(0, 0.12, 0.18);
      rightBrow.rotation.set(0, -0.12, -0.18);

      for (const eye of [leftEye, rightEye]) {
        eye.happyArcGroup.visible = true;
      }

      grinMouth.visible = true;
      cheekMat.opacity = 0.62;
    } else if (state === FACIAL_STATES.SHOCKED_LOSS) {
      // X_X wide dizzy eyes, droopy sad eyebrows, wavy disappointed mouth
      leftBrow.position.set(-0.084, 0.088, 0.220);
      rightBrow.position.set(0.084, 0.088, 0.220);
      leftBrow.rotation.set(0, 0.10, 0.38);
      rightBrow.rotation.set(0, -0.10, -0.38);

      for (const eye of [leftEye, rightEye]) {
        eye.shockXGroup.visible = true;
      }

      wavyMouth.visible = true;
      cheekMat.opacity = 0.10;
    } else {
      // 'neutral' (with natural periodic blink every 2.6-4.2s for 0.11s)
      leftBrow.position.set(-0.082, 0.094, 0.219);
      rightBrow.position.set(0.082, 0.094, 0.219);
      leftBrow.rotation.set(0, 0.12, 0.04);
      rightBrow.rotation.set(0, -0.12, -0.04);

      for (const eye of [leftEye, rightEye]) {
        if (isBlinking) {
          eye.blinkBarMesh.visible = true;
        } else {
          eye.openEyeNode.visible = true;
          eye.openEyeNode.scale.set(1.0, 1.0, 1.0);
          eye.pupilGroup.scale.set(1.0, 1.0, 1.0);
        }
      }

      neutralMouth.visible = true;
      cheekMat.opacity = 0.28;
    }

    paintConformalFaceOverlay(rig.faceCanvasObj, state, isBlinking, rig.browCssHex);
  }

  // --------------------------------------------------------------------------
  // 3. Cartoony 3D Sweat-Drop Particle Emitter (`spawnSweatDrops(actor)`)
  // --------------------------------------------------------------------------
  spawnSweatDrops(actorOrRole, count = 4) {
    const actor = this._resolveActor(actorOrRole);
    if (!actor) return 0;

    if (!this._poolsInitialized) {
      let p = actor.root || actor.model;
      while (p && p.parent) p = p.parent;
      if (p) this._ensureParticlePools(p);
    }
    if (!this.sweatDrops.length) return 0;

    const baseWorld = actor.root ? actor.root.position : actor.pos || new THREE.Vector3();
    const rotY = actor.root ? actor.root.rotation.y : 0;
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);

    let spawned = 0;
    for (let i = 0; i < this.sweatDrops.length && spawned < count; i++) {
      const drop = this.sweatDrops[i];
      if (drop.active) continue;

      const templeSign = spawned % 2 === 0 ? -1 : 1;
      // Pop dynamically out from the temples of the Mii's head (x = ±0.28, y = 1.52)
      const localX = templeSign * (0.27 + Math.random() * 0.04);
      const localY = 1.50 + Math.random() * 0.08;
      const localZ = 0.04 + (Math.random() - 0.5) * 0.08;

      const wx = baseWorld.x + localX * cosY + localZ * sinY;
      const wy = baseWorld.y + localY;
      const wz = baseWorld.z - localX * sinY + localZ * cosY;

      drop.active = true;
      drop.age = 0;
      drop.maxAge = 0.48 + Math.random() * 0.22;
      drop.mesh.position.set(wx, wy, wz);

      // Outward & upward pop velocity from temples
      const outSpeed = 1.45 + Math.random() * 0.95;
      const vxLocal = templeSign * outSpeed;
      const vzLocal = (Math.random() - 0.35) * 0.9;
      drop.vel.set(
        vxLocal * cosY + vzLocal * sinY,
        1.65 + Math.random() * 1.15,
        -vxLocal * sinY + vzLocal * cosY
      );

      drop.mesh.scale.setScalar(0.95 + Math.random() * 0.35);
      drop.dropMat.opacity = 0.96;
      drop.specMat.opacity = 0.95;
      drop.mesh.visible = true;
      spawned++;
    }
    return spawned;
  }

  // --------------------------------------------------------------------------
  // 4. Emotive Cues (`triggerEmoteBurst(actor, type)`)
  // --------------------------------------------------------------------------
  triggerEmoteBurst(actorOrRole, type = 'win') {
    const actor = this._resolveActor(actorOrRole);
    if (!actor) return 0;

    if (!this._poolsInitialized) {
      let p = actor.root || actor.model;
      while (p && p.parent) p = p.parent;
      if (p) this._ensureParticlePools(p);
    }
    if (!this.emoteParticles.length) return 0;

    const normType = String(type || 'win').toLowerCase().trim();
    const isWin = /win|happy|point_won|nice|game|victory/.test(normType);
    const isPanic = /panic|close_call|sweat|lob|shock|loss|fault|out/.test(normType);

    if (isWin) {
      this.setExpression(actor, FACIAL_STATES.HAPPY_GRIN, 1.75);
      let spawned = 0;
      const desired = 5;
      for (const p of this.emoteParticles) {
        if (spawned >= desired) break;
        if (p.active || (p.kind !== 'star' && p.kind !== 'note')) continue;

        const angle = (spawned / desired) * Math.PI * 2;
        const radius = 0.32;
        p.active = true;
        p.age = 0;
        p.maxAge = 1.05;
        p.anchorActor = actor;
        p.localOffset.set(
          Math.cos(angle) * radius,
          1.96 + (spawned % 2) * 0.08,
          Math.sin(angle) * radius
        );
        p.vel.set(Math.cos(angle) * 0.25, 0.55 + Math.random() * 0.25, Math.sin(angle) * 0.25);
        p.spinSpeed = (spawned % 2 === 0 ? 1 : -1) * 4.2;

        const basePos = actor.root ? actor.root.position : actor.pos;
        p.mesh.position.copy(basePos).add(p.localOffset);
        p.mesh.scale.setScalar(0.01);
        for (const m of p.materials) m.opacity = 1.0;
        p.mesh.visible = true;
        spawned++;
      }
      return spawned;
    }

    if (isPanic) {
      if (/loss|fault|out/.test(normType)) {
        this.setExpression(actor, FACIAL_STATES.SHOCKED_LOSS, 1.55);
      } else {
        this.setExpression(actor, FACIAL_STATES.WIDE_EYED_PANIC, 0.75);
      }
      this.spawnSweatDrops(actor, 5);

      let spawned = 0;
      for (const p of this.emoteParticles) {
        if (spawned >= 2) break;
        if (p.active || p.kind !== 'exclamation') continue;

        const side = spawned === 0 ? -1 : 1;
        p.active = true;
        p.age = 0;
        p.maxAge = 0.68;
        p.anchorActor = actor;
        p.localOffset.set(side * 0.34, 1.78, 0.08);
        p.vel.set(side * 0.35, 0.45, 0);
        p.spinSpeed = 0;

        const basePos = actor.root ? actor.root.position : actor.pos;
        p.mesh.position.copy(basePos).add(p.localOffset);
        p.mesh.rotation.set(0, 0, -side * 0.32);
        p.mesh.scale.setScalar(1.1);
        for (const m of p.materials) m.opacity = 1.0;
        p.mesh.visible = true;
        spawned++;
      }
      return spawned;
    }

    return 0;
  }

  // --------------------------------------------------------------------------
  // 5. Per-Frame Reactive Evaluation & Particle Simulation (`update(dt, ctx)`)
  // --------------------------------------------------------------------------
  update(arg1, arg2 = {}, arg3 = {}) {
    // Support both `update(dt, gameState)` and `update(actor, dt, gameState)` without NaN!
    if (arg1 && typeof arg1 === 'object') {
      const actor = arg1;
      const numericDt = Number(arg2);
      const clampedDt = Number.isFinite(numericDt) ? Math.min(Math.max(numericDt, 0), 0.1) : 0.016;
      const gameState = arg3 || {};

      const phase = gameState.phase || null;
      if (phase && phase !== this._lastPhase) {
        this._handlePhaseTransition(this._lastPhase, phase, gameState);
        this._lastPhase = phase;
      }

      this.updateActor(actor, clampedDt, gameState);

      // Step particles only once per frame (on primary player actor)
      if (!actor.role || actor.role === 'player') {
        this.elapsedTime += clampedDt;
        this._updateParticles(clampedDt);
      }
      return;
    }

    const numericDt = Number(arg1);
    const clampedDt = Number.isFinite(numericDt) ? Math.min(Math.max(numericDt, 0), 0.1) : 0.016;
    const gameState = arg2 || {};
    this.elapsedTime += clampedDt;

    // Detect phase transitions (e.g., entering POINT_OVER / MATCH_OVER)
    const phase = gameState.phase || null;
    if (phase && phase !== this._lastPhase) {
      this._handlePhaseTransition(this._lastPhase, phase, gameState);
      this._lastPhase = phase;
    }

    for (const actor of this.actors) {
      this.updateActor(actor, clampedDt, gameState);
    }

    this._updateParticles(clampedDt);
  }

  updateParticles(dt) {
    const numericDt = Number(dt);
    const clampedDt = Number.isFinite(numericDt) ? Math.min(Math.max(numericDt, 0), 0.1) : 0.016;
    this.elapsedTime += clampedDt;
    this._updateParticles(clampedDt);
  }

  _handlePhaseTransition(prevPhase, nextPhase, gameState) {
    if (nextPhase === 'POINT_OVER' || nextPhase === 'MATCH_OVER') {
      // Determine which side won the point
      const lastHitter = gameState.ball?.lastHitter || 'player';
      const bannerText = String(gameState.bannerText || gameState.lastBannerBroadcast?.subText || '');
      const isFaultOrOut = /Out|Net|Fault/i.test(bannerText);
      const winnerSide = isFaultOrOut
        ? lastHitter === 'player'
          ? 'opponent'
          : 'player'
        : lastHitter;

      for (const actor of this.actors) {
        const isPlayerTeam = actor.sideSign > 0 || /^player/i.test(actor.role || '');
        const wonPoint =
          (winnerSide === 'player' && isPlayerTeam) ||
          (winnerSide === 'opponent' && !isPlayerTeam);

        if (wonPoint) {
          this.setExpression(actor, FACIAL_STATES.HAPPY_GRIN, 1.85);
          if (actor.role === 'player' || actor.role === 'opponent') {
            this.triggerEmoteBurst(actor, 'win');
          }
        } else {
          this.setExpression(actor, FACIAL_STATES.SHOCKED_LOSS, 1.85);
        }
      }
    } else if (nextPhase === 'SERVE_STANCE') {
      for (const actor of this.actors) {
        this.setExpression(actor, FACIAL_STATES.NEUTRAL);
      }
    }
  }

  updateActor(actor, dt, gameState = {}) {
    if (!actor) return;
    const rig = actor.facialRig || this.attachFacialRig(actor);
    if (!rig) return;

    rig.sweatCooldown = Math.max(0, rig.sweatCooldown - dt);
    rig.panicEmoteCooldown = Math.max(0, rig.panicEmoteCooldown - dt);

    const ball = gameState.ball || null;
    const phase = gameState.phase || 'RALLY';
    const serverRole = gameState.server || gameState.score?.server || 'player';
    const rallyCount = Number(ball?.rallyStrokeCount || gameState.rallyCount || 0);
    const speed = actor.vel ? actor.vel.length() : 0;

    // 1. Automatic Gameplay Reactive Expression Selection
    const justStartedSwing =
      actor.swingTimer > 0 &&
      (rig.lastSwingTimer <= 0.01 || actor.swingTimer > rig.lastSwingTimer + 0.05);
    rig.lastSwingTimer = actor.swingTimer || 0;

    if (justStartedSwing || (actor.swingTimer > 0.14 && rig.state !== FACIAL_STATES.EFFORT_SHOUT)) {
      // Triggered on racket swing & power smash: 'effort_shout' for 0.35s
      this.setExpression(actor, FACIAL_STATES.EFFORT_SHOUT, 0.35);
    } else if (phase === 'SERVE_TOSS' && actor.role === serverRole && actor.swingTimer <= 0) {
      // Serve toss anticipation -> 'focused_squint'
      this.setExpression(actor, FACIAL_STATES.FOCUSED_SQUINT, 0.25);
    } else if (phase === 'RALLY' && ball && ball.inPlay && actor.swingTimer <= 0) {
      const isPlayerSide = actor.sideSign > 0;
      const ballApproaching =
        (isPlayerSide && ball.vel && ball.vel.z > 0.5) ||
        (!isPlayerSide && ball.vel && ball.vel.z < -0.5);

      const dx = ball.pos ? ball.pos.x - actor.pos.x : 0;
      const dz = ball.pos ? ball.pos.z - actor.pos.z : 0;
      const horizDist = Math.hypot(dx, dz);

      // Deep lob passing overhead
      const isOverheadLob =
        ballApproaching &&
        ball.pos &&
        ball.pos.y > 2.05 &&
        Math.abs(dz) < 4.8 &&
        (String(ball.shotType || '').toUpperCase() === 'LOB' || ball.pos.y > 2.35);

      // Stretched far from approaching ball or sprinting hard
      const isStretchedOrSprinting =
        speed > 5.2 ||
        (ballApproaching && Math.abs(dz) < 6.8 && horizDist > 2.2);

      // Right before ball contact anticipation windup
      const isPreContactWindup =
        ballApproaching && Math.abs(dz) < 3.4 && horizDist <= 2.2;

      if (isOverheadLob || isStretchedOrSprinting) {
        if (
          rig.state !== FACIAL_STATES.EFFORT_SHOUT &&
          rig.state !== FACIAL_STATES.HAPPY_GRIN &&
          rig.state !== FACIAL_STATES.SHOCKED_LOSS
        ) {
          this.setExpression(actor, FACIAL_STATES.WIDE_EYED_PANIC, 0.32);
        }
        if (isOverheadLob && rig.panicEmoteCooldown <= 0) {
          this.triggerEmoteBurst(actor, 'close_call');
          rig.panicEmoteCooldown = 1.6;
        }
      } else if (isPreContactWindup) {
        if (
          rig.state === FACIAL_STATES.NEUTRAL ||
          rig.state === FACIAL_STATES.FOCUSED_SQUINT
        ) {
          this.setExpression(actor, FACIAL_STATES.FOCUSED_SQUINT, 0.22);
        }
      }

      // Emit glossy 3D sweat drops during panic, high-speed sprint, or long rallies (rallyCount >= 4)
      if (
        (rig.state === FACIAL_STATES.WIDE_EYED_PANIC ||
          speed > 5.2 ||
          (rallyCount >= 4 && speed > 1.8)) &&
        rig.sweatCooldown <= 0
      ) {
        this.spawnSweatDrops(actor, speed > 5.2 ? 3 : 2);
        rig.sweatCooldown = speed > 5.2 ? 0.26 : 0.42;
      }
    }

    // 2. Advance timed expressions back to 'neutral'
    if (rig.state !== FACIAL_STATES.NEUTRAL && rig.stateDuration > 0) {
      rig.stateTimer -= dt;
      if (rig.stateTimer <= 0) {
        rig.state = FACIAL_STATES.NEUTRAL;
        rig.stateTimer = 0;
        rig.stateDuration = 0;
        this._applyStateVisuals(rig);
      }
    }

    // 3. Natural periodic blinking in 'neutral' (every 2.6-4.2s, 0.11s closure)
    if (rig.state === FACIAL_STATES.NEUTRAL) {
      if (rig.blinkActiveTimer > 0) {
        rig.blinkActiveTimer -= dt;
        if (rig.blinkActiveTimer <= 0) {
          rig.blinkActiveTimer = 0;
          rig.blinkTimer = 2.6 + Math.random() * 1.6;
          this._applyStateVisuals(rig);
        }
      } else {
        rig.blinkTimer -= dt;
        if (rig.blinkTimer <= 0) {
          rig.blinkActiveTimer = 0.11;
          this._applyStateVisuals(rig);
        }
      }
    }

    // 4. Subtle Pupil Gaze Tracking toward the Tennis Ball
    if (ball && ball.pos && actor.pos) {
      const worldDx = ball.pos.x - actor.pos.x;
      const worldDy = ball.pos.y - (actor.pos.y + 1.45);
      const localX = actor.sideSign > 0 ? -worldDx : worldDx;
      const gx = THREE.MathUtils.clamp(localX * 0.0018, -0.007, 0.007);
      const gy = THREE.MathUtils.clamp(worldDy * 0.0022, -0.006, 0.006);

      rig.leftEye.pupilGroup.position.x = 0.003 + gx;
      rig.leftEye.pupilGroup.position.y = gy;
      rig.rightEye.pupilGroup.position.x = -0.003 + gx;
      rig.rightEye.pupilGroup.position.y = gy;
    }
  }

  _updateParticles(dt) {
    // 1. Update 3D Teardrop Sweat Particles (gravity arc + velocity orientation + clean fade)
    const gravity = 8.6;
    for (const drop of this.sweatDrops) {
      if (!drop.active) continue;
      drop.age += dt;
      const t = drop.age / drop.maxAge;
      if (t >= 1.0) {
        drop.active = false;
        drop.mesh.visible = false;
        continue;
      }

      drop.vel.y -= gravity * dt;
      drop.mesh.position.addScaledVector(drop.vel, dt);

      // Tilt teardrop along its flight arc
      drop.mesh.rotation.z = Math.atan2(-drop.vel.x, Math.max(0.2, Math.abs(drop.vel.y))) * 0.65;
      const scalePop = t < 0.2 ? 0.5 + (t / 0.2) * 0.65 : 1.15 * (1.0 - (t - 0.2) * 0.55);
      drop.mesh.scale.setScalar(Math.max(0.1, scalePop));

      const alpha = t < 0.65 ? 0.96 : (1.0 - (t - 0.65) / 0.35) * 0.96;
      drop.dropMat.opacity = Math.max(0, alpha);
      drop.specMat.opacity = Math.max(0, alpha);
    }

    // 2. Update Floating Emote Bursts (Stars, Musical Notes, Exclamation Ticks)
    for (const p of this.emoteParticles) {
      if (!p.active) continue;
      p.age += dt;
      const t = p.age / p.maxAge;
      if (t >= 1.0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      if (p.anchorActor) {
        const basePos = p.anchorActor.root ? p.anchorActor.root.position : p.anchorActor.pos;
        if (p.kind === 'star' || p.kind === 'note') {
          // Orbiting rising halo above head
          const orbitAngle = Math.atan2(p.localOffset.z, p.localOffset.x) + dt * 2.8;
          const radius = Math.hypot(p.localOffset.x, p.localOffset.z) * (1.0 + dt * 0.25);
          p.localOffset.x = Math.cos(orbitAngle) * radius;
          p.localOffset.z = Math.sin(orbitAngle) * radius;
          p.localOffset.y += p.vel.y * dt;
          p.mesh.position.copy(basePos).add(p.localOffset);
          p.mesh.rotation.y += p.spinSpeed * dt;
        } else {
          // Comic exclamation pop near temples
          p.localOffset.addScaledVector(p.vel, dt * 0.35);
          p.mesh.position.copy(basePos).add(p.localOffset);
        }
      } else {
        p.mesh.position.addScaledVector(p.vel, dt);
      }

      const scaleCurve =
        t < 0.18
          ? (t / 0.18) * 1.25
          : t < 0.35
          ? 1.25 - ((t - 0.18) / 0.17) * 0.22
          : 1.03 * (1.0 - (t - 0.35) * 0.45);
      p.mesh.scale.setScalar(Math.max(0.05, scaleCurve));

      const opacity = t < 0.7 ? 1.0 : 1.0 - (t - 0.7) / 0.3;
      for (const m of p.materials) {
        m.opacity = Math.max(0, opacity);
      }
    }
  }
}

export default MiiFacialFXController;
