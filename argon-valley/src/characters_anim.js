import * as THREE from '../assets/vendor/three.module.js';
import { applyWorldCurveToHierarchy } from './world_curve_engine.js';

// ============================================================================
// PROCEDURAL CANVAS TEXTURE GENERATORS (SRGBColorSpace)
// ============================================================================

function createProceduralCanvasTexture(width, height, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return { texture, canvas, ctx };
}

function createGinghamTexture(primaryHex = '#d62828', midHex = '#f07878', lightHex = '#fff8f2') {
  const { texture } = createProceduralCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = lightHex;
    ctx.fillRect(0, 0, w, h);
    const cell = 32;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const ix = (x / cell) % 2;
        const iy = (y / cell) % 2;
        if (ix === 1 && iy === 1) {
          ctx.fillStyle = primaryHex;
          ctx.fillRect(x, y, cell, cell);
        } else if (ix === 1 || iy === 1) {
          ctx.fillStyle = midHex;
          ctx.fillRect(x, y, cell, cell);
        }
      }
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createGardenDressTexture() {
  const { texture } = createProceduralCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#843be6';
    ctx.fillRect(0, 0, w, h);

    const drawZigZagBand = (yCenter, amplitude, bandHeight, color, period = 32) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let x = 0; x <= w; x += period / 2) {
        const isPeak = ((x / (period / 2)) % 2) === 0;
        const py = yCenter + (isPeak ? -amplitude : amplitude);
        if (x === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      for (let x = w; x >= 0; x -= period / 2) {
        const isPeak = ((x / (period / 2)) % 2) === 0;
        const py = yCenter + bandHeight + (isPeak ? -amplitude : amplitude);
        ctx.lineTo(x, py);
      }
      ctx.closePath();
      ctx.fill();
    };

    ctx.fillStyle = '#2cc0e6';
    ctx.fillRect(0, 0, w, 28);
    ctx.fillStyle = '#d9328e';
    ctx.fillRect(0, 28, w, 14);

    drawZigZagBand(64, 14, 22, '#2fd0eb', 32);
    drawZigZagBand(92, 14, 18, '#de3592', 32);
    drawZigZagBand(126, 16, 24, '#a264f5', 32);
    drawZigZagBand(158, 16, 22, '#2fd0eb', 32);
    drawZigZagBand(188, 14, 20, '#de3592', 32);

    ctx.fillStyle = '#4ad8f0';
    ctx.fillRect(0, h - 26, w, 14);
    ctx.fillStyle = '#f2b8dc';
    ctx.fillRect(0, h - 12, w, 12);
  });
  return texture;
}

function createSailorPulloverTexture() {
  const { texture } = createProceduralCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f5f7fc';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(170, 182, 205, 0.25)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    ctx.strokeStyle = '#222d4f';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, 0);
    ctx.lineTo(w * 0.50, h * 0.46);
    ctx.lineTo(w * 0.72, 0);
    ctx.stroke();

    ctx.strokeStyle = '#8299cf';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.32, 0);
    ctx.lineTo(w * 0.50, h * 0.40);
    ctx.lineTo(w * 0.68, 0);
    ctx.stroke();

    ctx.fillStyle = '#222d4f';
    ctx.fillRect(0, h - 14, w, 9);
  });
  return texture;
}

function createCliffTunicTexture() {
  const { texture } = createProceduralCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d49252';
    ctx.fillRect(0, 0, w, h * 0.54);
    ctx.fillStyle = '#f2ca2e';
    ctx.fillRect(0, h * 0.54, w, h * 0.46);

    ctx.strokeStyle = '#fff8ea';
    ctx.lineWidth = 6.5;
    for (const yRow of [26, h * 0.52]) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const py = yRow + ((x / 16) % 2 === 0 ? -7 : 7);
        if (x === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();
    }
  });
  return texture;
}

function createHardHatLeafTexture() {
  const { texture } = createProceduralCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.5;

    ctx.fillStyle = '#4eb346';
    ctx.beginPath();
    ctx.arc(cx, cy, 88, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f6faf5';
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy + 6, 48, 38, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#f6faf5';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + 28, cy - 18);
    ctx.quadraticCurveTo(cx + 48, cy - 38, cx + 38, cy - 54);
    ctx.stroke();

    ctx.fillStyle = '#4eb346';
    ctx.beginPath();
    ctx.arc(cx + 26, cy + 20, 17, 0, Math.PI * 2);
    ctx.fill();
  });
  return texture;
}

function createStarShirtTexture() {
  const { texture } = createProceduralCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6822c9';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.52;
    const outerR = 56;
    const innerR = 25;
    ctx.fillStyle = '#fad022';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  });
  return texture;
}

function createGreenPlaidTexture() {
  const { texture } = createProceduralCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4ea842';
    ctx.fillRect(0, 0, w, h);

    const step = 42;
    for (let i = 0; i < w; i += step) {
      ctx.fillStyle = 'rgba(248, 222, 64, 0.68)';
      ctx.fillRect(i, 0, 16, h);
      ctx.fillRect(0, i, w, 16);

      ctx.fillStyle = 'rgba(28, 98, 36, 0.48)';
      ctx.fillRect(i + 20, 0, 8, h);
      ctx.fillRect(0, i + 20, w, 8);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
      ctx.fillRect(i + 14, 0, 3, h);
      ctx.fillRect(0, i + 14, w, 3);
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ============================================================================
// CUSTOM GEOMETRY HELPERS (CHIBI HEAD & CONFORMING FACE SHELL)
// ============================================================================

function deformChibiHeadPoint(x, y, z) {
  let sx = x * 1.06;
  let sy = y * 0.96;
  let sz = z * 0.98;
  const cheekBand = Math.exp(-Math.pow((y + 0.11) / 0.17, 2));
  const frontBias = Math.max(0, (z + 0.15) / 0.55);
  const bulge = 1.0 + 0.085 * cheekBand * (0.55 + 0.45 * frontBias);
  sx *= bulge;
  sz *= 1.0 + 0.045 * cheekBand;
  return [sx, sy, sz];
}

function createChibiHeadGeometry(radius = 0.42) {
  const geo = new THREE.SphereGeometry(radius, 36, 28);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [nx, ny, nz] = deformChibiHeadPoint(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, nx, ny, nz);
  }
  geo.computeVertexNormals();
  return geo;
}

function createConformingFacePatchGeometry(radius = 0.422, lonSpan = 1.38, latSpan = 1.12) {
  const segX = 28;
  const segY = 24;
  const geo = new THREE.PlaneGeometry(1, 1, segX, segY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const lon = (u - 0.5) * lonSpan;
    const lat = (v - 0.5) * latSpan;

    const rawX = radius * Math.sin(lon) * Math.cos(lat);
    const rawY = radius * Math.sin(lat);
    const rawZ = radius * Math.cos(lon) * Math.cos(lat);

    const [dx, dy, dz] = deformChibiHeadPoint(rawX, rawY, rawZ);
    pos.setXYZ(i, dx * 1.006, dy * 1.006, dz * 1.006 + 0.002);
  }
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// PLAYER AVATAR CLASS
// ============================================================================

export class PlayerAvatar {
  constructor(gridSystem, materialFactory) {
    this.gridSystem = gridSystem;
    this.materialFactory = materialFactory;

    this.group = new THREE.Group();
    this.group.name = 'PlayerAvatar';
    this.mesh = this.group;
    this.root = this.group;

    // State & physics
    this.outfitName = 'beach_gingham';
    this.toolName = 'none';
    this.poseName = 'idle';
    this.expressionStyle = 'bright_blue';
    this.walkSpeed = 3.6;
    this.runSpeed = 6.0;
    this.movePhase = 0;
    this.squash = 0;
    this.squashVel = 0;
    this.actionTimer = 0;
    this.actionDuration = 0.65;
    this.blinkTimer = 2.8;
    this.blinkAmount = 0;
    this.isBlinking = false;
    this.lastRenderedBlink = -1;
    this.lastRenderedExpression = '';

    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      shift: false
    };
    this.targetPos = null;
    this.manualControlActive = false;

    this._initMaterials();
    this._buildCharacterHierarchy();
    this._bindKeyboardControls();

    this.setOutfit('beach_gingham');
    this.setTool('none');
  }

  get position() {
    return this.group.position;
  }

  get rotation() {
    return this.group.rotation;
  }

  _initMaterials() {
    this.skinMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffcfb3,
      roughness: 0.62,
      metalness: 0.0,
      sheen: 0.35,
      sheenColor: new THREE.Color('#ff9e80'),
      clearcoat: 0.05,
      clearcoatRoughness: 0.6
    });

    this.noseMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xeb5e3e,
      roughness: 0.48,
      metalness: 0.0,
      sheen: 0.3,
      sheenColor: new THREE.Color('#ff9478')
    });

    this.solePinkMaterial = new THREE.MeshStandardMaterial({
      color: 0xf29382,
      roughness: 0.65
    });

    // Dynamic 512x512 face canvas texture
    const faceCanvasObj = createProceduralCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
    });
    this.faceCanvas = faceCanvasObj.canvas;
    this.faceCtx = faceCanvasObj.ctx;
    this.faceTexture = faceCanvasObj.texture;
    this.faceMaterial = new THREE.MeshBasicMaterial({
      map: this.faceTexture,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false
    });

    // Hair materials
    this.gingerHairMat = new THREE.MeshPhysicalMaterial({
      color: 0xe05516,
      roughness: 0.38,
      metalness: 0.0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
      sheen: 0.35,
      sheenColor: new THREE.Color('#ff984f')
    });

    this.darkBobHairMat = new THREE.MeshPhysicalMaterial({
      color: 0x201d22,
      roughness: 0.34,
      metalness: 0.02,
      clearcoat: 0.42,
      clearcoatRoughness: 0.24,
      sheen: 0.28,
      sheenColor: new THREE.Color('#4f4a5c')
    });

    this.tealHairMat = new THREE.MeshPhysicalMaterial({
      color: 0x209e82,
      roughness: 0.38,
      clearcoat: 0.32,
      sheen: 0.3,
      sheenColor: new THREE.Color('#66e3c4')
    });

    // Outfit textures & materials
    this.ginghamTex = createGinghamTexture('#d62828', '#f07878', '#fff8f2');
    this.ginghamMat = new THREE.MeshPhysicalMaterial({
      map: this.ginghamTex,
      roughness: 0.68,
      sheen: 0.35,
      sheenColor: new THREE.Color('#ffcccc')
    });

    this.gardenDressTex = createGardenDressTexture();
    this.gardenDressMat = new THREE.MeshPhysicalMaterial({
      map: this.gardenDressTex,
      roughness: 0.64,
      sheen: 0.35,
      sheenColor: new THREE.Color('#e0b8ff')
    });

    this.sailorTopTex = createSailorPulloverTexture();
    this.sailorTopMat = new THREE.MeshPhysicalMaterial({
      map: this.sailorTopTex,
      roughness: 0.65,
      sheen: 0.3,
      sheenColor: new THREE.Color('#ffffff')
    });

    this.cliffTunicTex = createCliffTunicTexture();
    this.cliffTunicMat = new THREE.MeshPhysicalMaterial({
      map: this.cliffTunicTex,
      roughness: 0.66,
      sheen: 0.3,
      sheenColor: new THREE.Color('#ffe89e')
    });

    this.denimOverallMat = new THREE.MeshPhysicalMaterial({
      color: 0x2550a0,
      roughness: 0.72,
      sheen: 0.28,
      sheenColor: new THREE.Color('#5a8ae0')
    });

    this.jeansMat = new THREE.MeshPhysicalMaterial({
      color: 0x3570c2,
      roughness: 0.7,
      sheen: 0.25,
      sheenColor: new THREE.Color('#6ca2eb')
    });

    this.beigeShortsMat = new THREE.MeshStandardMaterial({
      color: 0xe2ccb0,
      roughness: 0.72
    });

    this.yellowBootsMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2c61d,
      roughness: 0.24,
      clearcoat: 0.55,
      clearcoatRoughness: 0.2
    });

    this.blueSneakerMat = new THREE.MeshStandardMaterial({
      color: 0x2252b2,
      roughness: 0.48
    });

    this.whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf5f7fc,
      roughness: 0.45
    });
  }

  _drawDynamicFace(expressionStyle = 'bright_blue', blinkAmount = 0) {
    const ctx = this.faceCtx;
    const w = this.faceCanvas.width;
    const h = this.faceCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Bold rosy pink oval cheek blushes (#f58882, alpha = 0.82)
    for (const cx of [122, 390]) {
      const cy = 310;
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 44);
      grad.addColorStop(0, 'rgba(245, 112, 112, 0.84)');
      grad.addColorStop(0.65, 'rgba(245, 132, 126, 0.44)');
      grad.addColorStop(1, 'rgba(245, 132, 126, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 44, 27, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Expressive eyebrows above eyes
    ctx.strokeStyle = expressionStyle === 'bright_blue' ? '#9e3910' : '#261b18';
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const ex = 256 + side * 86;
      ctx.beginPath();
      ctx.arc(ex, 184, 32, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
    }

    // 3. Large expressive Argon Valley eyes (rx = 36, ry = 46, spaced at 256 ± 86)
    const isBlinked = blinkAmount > 0.55;
    if (isBlinked || expressionStyle === 'happy_crescent') {
      ctx.strokeStyle = '#261712';
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        const ex = 256 + side * 86;
        const ey = 242;
        ctx.beginPath();
        if (expressionStyle === 'happy_crescent') {
          ctx.arc(ex, ey + 12, 33, Math.PI * 1.15, Math.PI * 1.85);
        } else {
          ctx.arc(ex, ey - 10, 33, Math.PI * 0.18, Math.PI * 0.82);
        }
        ctx.stroke();
      }
    } else if (expressionStyle === 'serene_lidded') {
      // Half-lidded serene eyes matching ref_03_flower_garden_river.jpg
      for (const side of [-1, 1]) {
        const ex = 256 + side * 84;
        const ey = 242;
        const rx = 35;
        const ry = 42;

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = '#f4f6fa';
        ctx.fillRect(ex - rx, ey - ry, rx * 2, ry * 2);

        ctx.fillStyle = '#5c7898';
        ctx.beginPath();
        ctx.ellipse(ex, ey + 5, 26, 30, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#18202c';
        ctx.beginPath();
        ctx.ellipse(ex, ey + 5, 14, 17, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 9, ey + 1, 7.5, 0, Math.PI * 2);
        ctx.fill();

        // Warm tan upper eyelid covering top half of eye
        ctx.fillStyle = '#d6966c';
        ctx.fillRect(ex - rx - 2, ey - ry - 2, rx * 2 + 4, ry * 1.02);
        ctx.restore();

        ctx.strokeStyle = '#201818';
        ctx.lineWidth = 9.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - rx + 1, ey);
        ctx.quadraticCurveTo(ex, ey - 4, ex + rx - 1, ey + 1);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(65, 38, 28, 0.6)';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(ex, ey + 2, rx, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
      }
    } else {
      // Bold wide oval Argon Valley eyes (bright_blue for ref_01/02, explorer_dark for ref_04, builder_green for ref_06)
      let irisTop = '#0c3888';
      let irisBot = '#2672eb';
      if (expressionStyle === 'explorer_dark') {
        irisTop = '#18100e';
        irisBot = '#3b241f';
      } else if (expressionStyle === 'builder_green') {
        irisTop = '#1a6334';
        irisBot = '#48bf62';
      }

      for (const side of [-1, 1]) {
        const ex = 256 + side * 86;
        const ey = 242;
        const rx = 36;
        const ry = 46;

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
        ctx.clip();

        const grad = ctx.createLinearGradient(ex, ey - ry, ex, ey + ry);
        grad.addColorStop(0, irisTop);
        grad.addColorStop(1, irisBot);
        ctx.fillStyle = grad;
        ctx.fillRect(ex - rx, ey - ry, rx * 2, ry * 2);

        // Deep pupil center
        ctx.fillStyle = '#081020';
        ctx.beginPath();
        ctx.ellipse(ex, ey + 2, rx * 0.55, ry * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();

        // Crisp white upper-left catchlight + lower-right glint
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ex - 11, ey - 14, 11, 13.5, -0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(ex + 10, ey + 15, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Thick dark upper eyelash arch with cute outer flick
        ctx.strokeStyle = '#1c1210';
        ctx.lineWidth = 10.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(ex, ey + 4, rx + 1, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();

        ctx.lineWidth = 7.5;
        ctx.beginPath();
        ctx.moveTo(ex + side * (rx - 2), ey - 12);
        ctx.lineTo(ex + side * (rx + 11), ey - 20);
        ctx.stroke();
      }
    }

    // 4. Bold curved smile mouth below the 3D orange button nose
    ctx.strokeStyle = '#481d14';
    ctx.lineWidth = 8.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (expressionStyle === 'happy_crescent') {
      ctx.fillStyle = '#d9545c';
      ctx.arc(256, 324, 26, 0.08 * Math.PI, 0.92 * Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.arc(256, 322, 25, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }

    this.faceTexture.needsUpdate = true;
    this.lastRenderedBlink = isBlinked ? 1 : 0;
    this.lastRenderedExpression = expressionStyle;
  }

  _buildCharacterHierarchy() {
    this.contactShadow = this._createContactShadow(0.42, 0.38, 0.36);
    this.contactShadow.position.set(0, 0.02, 0);
    this.group.add(this.contactShadow);

    this.bodyPivot = new THREE.Group();
    this.group.add(this.bodyPivot);

    this.spinePivot = new THREE.Group();
    this.spinePivot.position.set(0, 0.34, 0);
    this.bodyPivot.add(this.spinePivot);

    // ------------------------------------------------------------------------
    // 1. HEAD GROUP
    // ------------------------------------------------------------------------
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.56, 0);
    this.spinePivot.add(this.headGroup);

    const headGeo = createChibiHeadGeometry(0.42);
    this.headMesh = new THREE.Mesh(headGeo, this.skinMaterial);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.headGroup.add(this.headMesh);

    const facePatchGeo = createConformingFacePatchGeometry(0.421, 1.38, 1.12);
    this.faceMesh = new THREE.Mesh(facePatchGeo, this.faceMaterial);
    this.headGroup.add(this.faceMesh);

    const earGeo = new THREE.SphereGeometry(0.095, 16, 14);
    earGeo.scale(0.65, 1.0, 0.82);
    this.leftEar = new THREE.Mesh(earGeo, this.skinMaterial);
    this.leftEar.position.set(-0.43, -0.04, 0.01);
    this.leftEar.castShadow = true;
    this.rightEar = new THREE.Mesh(earGeo, this.skinMaterial);
    this.rightEar.position.set(0.43, -0.04, 0.01);
    this.rightEar.castShadow = true;
    this.headGroup.add(this.leftEar, this.rightEar);

    // Iconic 3D rounded-triangle orange-coral button nose (#eb5e3e) in center of face
    const noseGeo = new THREE.ConeGeometry(0.052, 0.078, 18);
    noseGeo.scale(1.15, 1.0, 0.96);
    this.noseMesh = new THREE.Mesh(noseGeo, this.noseMaterial);
    this.noseMesh.position.set(0, -0.015, 0.436);
    this.noseMesh.rotation.x = Math.PI * 0.42;
    this.noseMesh.castShadow = true;
    this.headGroup.add(this.noseMesh);

    this._buildHairAndHeadgearVariants();
    this._buildTorsoAndOutfits();
    this._buildLimbsAndFootwear();
    this._buildToolsAndWorkProps();
  }

  _buildHairAndHeadgearVariants() {
    // ------------------------------------------------------------------------
    // Variant A: Ginger-Orange Hair with High Forehead Bangs & Plump Top-Bun (ref_01, ref_02)
    // ------------------------------------------------------------------------
    this.gingerHairGroup = new THREE.Group();
    this.headGroup.add(this.gingerHairGroup);

    // Back/upper hair dome tilted back (-0.45) so face is 100% open and unobstructed
    const hairCapGeo = new THREE.SphereGeometry(0.448, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.60);
    hairCapGeo.scale(1.06, 0.97, 1.0);
    const hairCap = new THREE.Mesh(hairCapGeo, this.gingerHairMat);
    hairCap.rotation.x = -0.45;
    hairCap.position.set(0, 0.03, -0.02);
    hairCap.castShadow = true;
    this.gingerHairGroup.add(hairCap);

    // High curved front bangs above the eyebrows with signature center V-part notch (ref_01)
    const bangPieceGeo = new THREE.SphereGeometry(0.21, 20, 16);
    bangPieceGeo.scale(1.12, 0.50, 0.50);
    const leftBang = new THREE.Mesh(bangPieceGeo, this.gingerHairMat);
    leftBang.position.set(-0.15, 0.31, 0.31);
    leftBang.rotation.set(0.18, -0.22, 0.12);
    leftBang.castShadow = true;

    const rightBang = new THREE.Mesh(bangPieceGeo, this.gingerHairMat);
    rightBang.position.set(0.15, 0.31, 0.31);
    rightBang.rotation.set(0.18, 0.22, -0.12);
    rightBang.castShadow = true;

    const centerBang = new THREE.Mesh(bangPieceGeo, this.gingerHairMat);
    centerBang.scale.set(0.72, 0.48, 0.48);
    centerBang.position.set(0, 0.33, 0.32);
    centerBang.rotation.set(0.20, 0, 0);
    centerBang.castShadow = true;

    // Plump round top-bun on crown of head (ref_01, ref_02)
    const topBunGeo = new THREE.SphereGeometry(0.17, 24, 20);
    topBunGeo.scale(1.14, 0.92, 1.08);
    const topBun = new THREE.Mesh(topBunGeo, this.gingerHairMat);
    topBun.position.set(0, 0.46, -0.05);
    topBun.castShadow = true;

    this.gingerHairGroup.add(leftBang, rightBang, centerBang, topBun);

    // ------------------------------------------------------------------------
    // Variant B: Sleek Dark-Brown Bob Hair + Red Hibiscus Flower (ref_03)
    // ------------------------------------------------------------------------
    this.darkBobHairGroup = new THREE.Group();
    this.headGroup.add(this.darkBobHairGroup);

    const bobCapGeo = new THREE.SphereGeometry(0.452, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.60);
    bobCapGeo.scale(1.07, 0.98, 1.02);
    const bobCap = new THREE.Mesh(bobCapGeo, this.darkBobHairMat);
    bobCap.rotation.x = -0.60;
    bobCap.position.set(0, 0.03, -0.02);
    bobCap.castShadow = true;
    this.darkBobHairGroup.add(bobCap);

    // High side-swept sleek front bang across top of forehead (ref_03)
    const sweepGeo = new THREE.SphereGeometry(0.28, 24, 18);
    sweepGeo.scale(1.20, 0.36, 0.44);
    const frontSweep = new THREE.Mesh(sweepGeo, this.darkBobHairMat);
    frontSweep.position.set(0.04, 0.34, 0.31);
    frontSweep.rotation.set(0.12, 0.12, -0.12);
    frontSweep.castShadow = true;
    this.darkBobHairGroup.add(frontSweep);

    const bobSideGeo = new THREE.CapsuleGeometry(0.11, 0.24, 10, 14);
    for (const side of [-1, 1]) {
      const bobSide = new THREE.Mesh(bobSideGeo, this.darkBobHairMat);
      bobSide.position.set(side * 0.37, -0.06, -0.10);
      bobSide.rotation.set(0.15, 0, side * -0.18);
      bobSide.castShadow = true;
      this.darkBobHairGroup.add(bobSide);
    }

    // Vibrant Red Hibiscus Flower on left-top temple (ref_03)
    const flowerGroup = new THREE.Group();
    flowerGroup.position.set(-0.34, 0.31, 0.22);
    flowerGroup.rotation.set(-0.2, -0.65, 0.45);
    const petalMat = new THREE.MeshPhysicalMaterial({
      color: 0xe62828,
      roughness: 0.45,
      sheen: 0.4,
      sheenColor: new THREE.Color('#ff8080')
    });
    const petalGeo = new THREE.SphereGeometry(0.055, 12, 10);
    petalGeo.scale(1.1, 0.35, 1.45);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.position.set(Math.cos(a) * 0.055, 0, Math.sin(a) * 0.055);
      petal.rotation.y = -a + Math.PI / 2;
      flowerGroup.add(petal);
    }
    const stamenMat = new THREE.MeshStandardMaterial({ color: 0xfadb38, roughness: 0.4 });
    const stamen = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), stamenMat);
    stamen.position.y = 0.015;
    flowerGroup.add(stamen);
    this.darkBobHairGroup.add(flowerGroup);

    // ------------------------------------------------------------------------
    // Variant C: Orange & Teal Bucket Hat + Peaked Dark Bangs (ref_04)
    // ------------------------------------------------------------------------
    this.bucketHatGroup = new THREE.Group();
    this.headGroup.add(this.bucketHatGroup);

    // Peaked dark bangs peeking under bucket hat brim
    for (let i = -2; i <= 2; i++) {
      const spikeGeo = new THREE.ConeGeometry(0.054, 0.12, 10);
      const spike = new THREE.Mesh(spikeGeo, this.darkBobHairMat);
      spike.position.set(i * 0.085, 0.26, 0.36 - Math.abs(i) * 0.02);
      spike.rotation.set(Math.PI * 0.88, 0, i * -0.12);
      this.bucketHatGroup.add(spike);
    }

    // Tilted back (-0.28) with compact 0.48 brim so face is 100% visible from elevated camera
    const hatTiltGroup = new THREE.Group();
    hatTiltGroup.position.set(0, 0.24, -0.04);
    hatTiltGroup.rotation.x = -0.28;
    this.bucketHatGroup.add(hatTiltGroup);

    const bucketOrangeMat = new THREE.MeshPhysicalMaterial({
      color: 0xf26422,
      roughness: 0.55,
      sheen: 0.35,
      sheenColor: new THREE.Color('#ff9c6b')
    });
    const bucketTealMat = new THREE.MeshPhysicalMaterial({
      color: 0x22b0a4,
      roughness: 0.52,
      sheen: 0.3,
      sheenColor: new THREE.Color('#7cebe0')
    });
    const bucketSkyTrimMat = new THREE.MeshStandardMaterial({
      color: 0x9be0f2,
      roughness: 0.48
    });

    const crownMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.41, 0.22, 32), bucketOrangeMat);
    crownMesh.position.y = 0.13;
    crownMesh.castShadow = true;
    hatTiltGroup.add(crownMesh);

    const crownCapGeo = new THREE.SphereGeometry(0.36, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
    crownCapGeo.scale(1.0, 0.22, 1.0);
    const crownCap = new THREE.Mesh(crownCapGeo, bucketOrangeMat);
    crownCap.position.y = 0.24;
    crownCap.castShadow = true;
    hatTiltGroup.add(crownCap);

    const tealBand = new THREE.Mesh(new THREE.CylinderGeometry(0.408, 0.425, 0.095, 32), bucketTealMat);
    tealBand.position.y = 0.045;
    tealBand.castShadow = true;
    hatTiltGroup.add(tealBand);

    const brimMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.085, 36), bucketOrangeMat);
    brimMesh.position.y = -0.035;
    brimMesh.castShadow = true;
    hatTiltGroup.add(brimMesh);

    const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(0.478, 0.020, 12, 36), bucketSkyTrimMat);
    rimTorus.rotation.x = Math.PI / 2;
    rimTorus.position.y = -0.075;
    hatTiltGroup.add(rimTorus);

    // ------------------------------------------------------------------------
    // Variant D: White Island Designer Hard Hat with Green Leaf Logo (ref_06)
    // ------------------------------------------------------------------------
    this.hardHatGroup = new THREE.Group();
    this.headGroup.add(this.hardHatGroup);

    const sideHairGeo = new THREE.SphereGeometry(0.13, 14, 12);
    sideHairGeo.scale(0.65, 1.1, 0.95);
    for (const side of [-1, 1]) {
      const lock = new THREE.Mesh(sideHairGeo, this.tealHairMat);
      lock.position.set(side * 0.41, 0.06, 0.06);
      this.hardHatGroup.add(lock);
    }

    const hardHatWhiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xf7f9fc,
      roughness: 0.28,
      metalness: 0.02,
      clearcoat: 0.55,
      clearcoatRoughness: 0.2
    });

    const helmetPivot = new THREE.Group();
    helmetPivot.position.set(0, 0.16, -0.02);
    helmetPivot.rotation.x = -0.18;
    this.hardHatGroup.add(helmetPivot);

    const domeGeo = new THREE.SphereGeometry(0.46, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
    domeGeo.scale(1.04, 0.90, 1.06);
    const domeMesh = new THREE.Mesh(domeGeo, hardHatWhiteMat);
    domeMesh.castShadow = true;
    helmetPivot.add(domeMesh);

    const ridgeGeo = new THREE.BoxGeometry(0.11, 0.07, 0.70);
    const ridgeMesh = new THREE.Mesh(ridgeGeo, hardHatWhiteMat);
    ridgeMesh.position.set(0, 0.39, 0.0);
    helmetPivot.add(ridgeMesh);

    const visorGeo = new THREE.CylinderGeometry(0.45, 0.50, 0.042, 32);
    visorGeo.scale(1.0, 1.0, 1.12);
    const visorMesh = new THREE.Mesh(visorGeo, hardHatWhiteMat);
    visorMesh.position.set(0, 0.02, 0.04);
    visorMesh.castShadow = true;
    helmetPivot.add(visorMesh);

    const leafTex = createHardHatLeafTexture();
    const leafBadgeMat = new THREE.MeshBasicMaterial({
      map: leafTex,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false
    });
    const badgeGeo = new THREE.PlaneGeometry(0.24, 0.24);
    const badgeMesh = new THREE.Mesh(badgeGeo, leafBadgeMat);
    badgeMesh.position.set(0, 0.19, 0.485);
    badgeMesh.rotation.x = -0.26;
    helmetPivot.add(badgeMesh);
  }

  _buildTorsoAndOutfits() {
    this.torsoGroup = new THREE.Group();
    this.spinePivot.add(this.torsoGroup);

    const torsoGeo = new THREE.CylinderGeometry(0.155, 0.235, 0.36, 28);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.ginghamMat);
    this.torsoMesh.position.set(0, 0.18, 0);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.torsoGroup.add(this.torsoMesh);

    const collarGeo = new THREE.TorusGeometry(0.155, 0.026, 10, 24);
    this.collarMesh = new THREE.Mesh(collarGeo, this.ginghamMat);
    this.collarMesh.rotation.x = Math.PI / 2;
    this.collarMesh.position.set(0, 0.35, 0.01);
    this.torsoGroup.add(this.collarMesh);

    // 1. Overalls Bib & Straps (for 'yard_overalls' - ref_02)
    this.overallsAddonGroup = new THREE.Group();
    this.torsoGroup.add(this.overallsAddonGroup);

    const bibOverlayGeo = new THREE.CylinderGeometry(0.162, 0.242, 0.28, 28);
    const bibOverlay = new THREE.Mesh(bibOverlayGeo, this.denimOverallMat);
    bibOverlay.position.set(0, 0.14, 0);
    bibOverlay.castShadow = true;
    this.overallsAddonGroup.add(bibOverlay);

    const buttonMat = new THREE.MeshStandardMaterial({ color: 0xfad448, metalness: 0.6, roughness: 0.3 });
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.26), this.denimOverallMat);
      strap.position.set(side * 0.095, 0.30, 0);
      this.overallsAddonGroup.add(strap);

      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), buttonMat);
      btn.position.set(side * 0.095, 0.24, 0.185);
      this.overallsAddonGroup.add(btn);
    }

    // 2. Long Maxi Dress Skirt (for 'garden_dress' - ref_03)
    const maxiSkirtGeo = new THREE.CylinderGeometry(0.21, 0.32, 0.32, 28);
    this.maxiSkirtMesh = new THREE.Mesh(maxiSkirtGeo, this.gardenDressMat);
    this.maxiSkirtMesh.position.set(0, -0.10, 0);
    this.maxiSkirtMesh.castShadow = true;
    this.maxiSkirtMesh.receiveShadow = true;
    this.torsoGroup.add(this.maxiSkirtMesh);

    // 3. Flared Yellow Boho Skirt (for 'cliff_builder' - ref_06)
    const yellowSkirtGeo = new THREE.CylinderGeometry(0.21, 0.31, 0.22, 28);
    const yellowSkirtMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2ca2e,
      roughness: 0.62,
      sheen: 0.3,
      sheenColor: new THREE.Color('#fff0a8')
    });
    this.yellowSkirtMesh = new THREE.Mesh(yellowSkirtGeo, yellowSkirtMat);
    this.yellowSkirtMesh.position.set(0, -0.05, 0);
    this.yellowSkirtMesh.castShadow = true;
    this.torsoGroup.add(this.yellowSkirtMesh);
  }

  _buildLimbsAndFootwear() {
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.19, 0.31, 0);
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.19, 0.31, 0);
    this.spinePivot.add(this.leftArmPivot, this.rightArmPivot);

    const sleeveGeo = new THREE.CapsuleGeometry(0.058, 0.15, 10, 14);
    this.leftSleeveMesh = new THREE.Mesh(sleeveGeo, this.ginghamMat);
    this.leftSleeveMesh.position.set(0, -0.10, 0);
    this.leftSleeveMesh.castShadow = true;

    this.rightSleeveMesh = new THREE.Mesh(sleeveGeo, this.ginghamMat);
    this.rightSleeveMesh.position.set(0, -0.10, 0);
    this.rightSleeveMesh.castShadow = true;

    const handGeo = new THREE.SphereGeometry(0.064, 16, 14);
    this.leftHandMesh = new THREE.Mesh(handGeo, this.skinMaterial);
    this.leftHandMesh.position.set(0, -0.22, 0);
    this.leftHandMesh.castShadow = true;

    this.rightHandMesh = new THREE.Mesh(handGeo, this.skinMaterial);
    this.rightHandMesh.position.set(0, -0.22, 0);
    this.rightHandMesh.castShadow = true;

    this.leftHandSocket = new THREE.Group();
    this.leftHandSocket.position.set(0, -0.22, 0.03);
    this.rightHandSocket = new THREE.Group();
    this.rightHandSocket.position.set(0, -0.22, 0.03);

    this.leftArmPivot.add(this.leftSleeveMesh, this.leftHandMesh, this.leftHandSocket);
    this.rightArmPivot.add(this.rightSleeveMesh, this.rightHandMesh, this.rightHandSocket);

    // Legs & footwear
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.105, 0.34, 0);
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.105, 0.34, 0);
    this.bodyPivot.add(this.leftLegPivot, this.rightLegPivot);

    const upperLegGeo = new THREE.CylinderGeometry(0.082, 0.072, 0.16, 16);
    const lowerLegGeo = new THREE.CylinderGeometry(0.068, 0.058, 0.16, 16);

    this.leftUpperLeg = new THREE.Mesh(upperLegGeo, this.beigeShortsMat);
    this.leftUpperLeg.position.set(0, -0.08, 0);
    this.leftUpperLeg.castShadow = true;
    this.rightUpperLeg = new THREE.Mesh(upperLegGeo, this.beigeShortsMat);
    this.rightUpperLeg.position.set(0, -0.08, 0);
    this.rightUpperLeg.castShadow = true;

    this.leftLowerLeg = new THREE.Mesh(lowerLegGeo, this.skinMaterial);
    this.leftLowerLeg.position.set(0, -0.21, 0);
    this.leftLowerLeg.castShadow = true;
    this.rightLowerLeg = new THREE.Mesh(lowerLegGeo, this.skinMaterial);
    this.rightLowerLeg.position.set(0, -0.21, 0);
    this.rightLowerLeg.castShadow = true;

    this.leftLegPivot.add(this.leftUpperLeg, this.leftLowerLeg);
    this.rightLegPivot.add(this.rightUpperLeg, this.rightLowerLeg);

    this.bareFeetNodes = [];
    this.yellowBootNodes = [];
    this.sneakerNodes = [];

    for (const [legIdx, legPivot] of [[0, this.leftLegPivot], [1, this.rightLegPivot]]) {
      const side = legIdx === 0 ? -1 : 1;

      // 1. Bare foot with cute toes & rosy sole pad (for 'beach_gingham' ref_01)
      const bareFootGroup = new THREE.Group();
      bareFootGroup.position.set(0, -0.29, 0.04);
      const footMainGeo = new THREE.SphereGeometry(0.068, 16, 14);
      footMainGeo.scale(1.0, 0.72, 1.38);
      const footMain = new THREE.Mesh(footMainGeo, this.skinMaterial);
      footMain.castShadow = true;
      bareFootGroup.add(footMain);

      const solePad = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 10), this.solePinkMaterial);
      solePad.scale.set(0.85, 0.95, 0.35);
      solePad.position.set(0, -0.005, 0.078);
      bareFootGroup.add(solePad);

      for (let t = -1.5; t <= 1.5; t += 1.0) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), this.skinMaterial);
        toe.position.set(t * 0.022 * -side, 0.028, 0.082 - Math.abs(t) * 0.006);
        bareFootGroup.add(toe);
      }
      legPivot.add(bareFootGroup);
      this.bareFeetNodes.push(bareFootGroup);

      // 2. Bright Yellow Rain Boots (for 'yard_overalls' ref_02)
      const bootGroup = new THREE.Group();
      bootGroup.position.set(0, -0.28, 0.03);
      const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.072, 0.14, 16), this.yellowBootsMat);
      bootShaft.position.set(0, 0.05, -0.02);
      bootShaft.castShadow = true;
      const bootToe = new THREE.Mesh(new THREE.SphereGeometry(0.076, 16, 14), this.yellowBootsMat);
      bootToe.scale.set(1.0, 0.75, 1.38);
      bootToe.position.set(0, -0.01, 0.025);
      bootToe.castShadow = true;
      bootGroup.add(bootShaft, bootToe);
      legPivot.add(bootGroup);
      this.yellowBootNodes.push(bootGroup);

      // 3. Blue & White Sneakers
      const sneakerGroup = new THREE.Group();
      sneakerGroup.position.set(0, -0.29, 0.035);
      const shoeUpper = new THREE.Mesh(new THREE.SphereGeometry(0.074, 16, 12), this.blueSneakerMat);
      shoeUpper.scale.set(1.0, 0.74, 1.36);
      shoeUpper.castShadow = true;
      const shoeSole = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.078, 0.032, 16), this.whiteMat);
      shoeSole.scale.set(1.0, 1.0, 1.38);
      shoeSole.position.y = -0.032;
      sneakerGroup.add(shoeUpper, shoeSole);
      legPivot.add(sneakerGroup);
      this.sneakerNodes.push(sneakerGroup);
    }
  }

  _buildToolsAndWorkProps() {
    // 1. WATERING CAN (Silver galvanized tin can + animated droplet spray - ref_03)
    this.wateringCanGroup = new THREE.Group();
    this.rightHandSocket.add(this.wateringCanGroup);

    const tinMat = new THREE.MeshPhysicalMaterial({
      color: 0xbac6d4,
      metalness: 0.58,
      roughness: 0.34,
      clearcoat: 0.25
    });
    const tinDarkMat = new THREE.MeshStandardMaterial({
      color: 0x6c7a89,
      metalness: 0.5,
      roughness: 0.45
    });

    const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.22, 20), tinMat);
    canBody.position.set(0, -0.04, 0.12);
    canBody.rotation.x = 0.35;
    canBody.castShadow = true;
    this.wateringCanGroup.add(canBody);

    const canHandle = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.016, 10, 20), tinMat);
    canHandle.position.set(0, 0.04, 0.06);
    canHandle.rotation.y = Math.PI / 2;
    this.wateringCanGroup.add(canHandle);

    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, 0.24, 14), tinMat);
    spout.position.set(0, 0.02, 0.26);
    spout.rotation.x = 1.05;
    spout.castShadow = true;
    this.wateringCanGroup.add(spout);

    const roseHead = new THREE.Mesh(new THREE.ConeGeometry(0.064, 0.065, 16), tinDarkMat);
    roseHead.position.set(0, 0.08, 0.37);
    roseHead.rotation.x = -Math.PI * 0.65;
    this.wateringCanGroup.add(roseHead);

    this.waterSprayGroup = new THREE.Group();
    this.waterSprayGroup.position.set(0, 0.08, 0.40);
    this.wateringCanGroup.add(this.waterSprayGroup);

    this.waterDroplets = [];
    const dropMat = new THREE.MeshBasicMaterial({
      color: 0xeafaff,
      transparent: true,
      opacity: 0.92
    });
    const dropGeo = new THREE.SphereGeometry(0.019, 8, 8);
    dropGeo.scale(0.8, 1.4, 0.8);
    for (let i = 0; i < 28; i++) {
      const mesh = new THREE.Mesh(dropGeo, dropMat);
      const laneAngle = ((i % 7) - 3) * 0.14;
      const spreadRadius = 0.12 + (i % 4) * 0.04;
      this.waterSprayGroup.add(mesh);
      this.waterDroplets.push({
        mesh,
        phaseOffset: i / 28,
        laneAngle,
        spreadRadius
      });
    }

    // 2. PATH TROWEL & MORTAR BOARD + FRESH DIRT PATCH (ref_02_house_yard.png)
    this.trowelRightGroup = new THREE.Group();
    this.rightHandSocket.add(this.trowelRightGroup);

    const trowelHandleMat = new THREE.MeshStandardMaterial({ color: 0x62a4e8, roughness: 0.4 });
    const trowelBladeMat = new THREE.MeshStandardMaterial({ color: 0xcfd8e2, metalness: 0.55, roughness: 0.32 });

    const trowelGrip = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.08, 8, 10), trowelHandleMat);
    trowelGrip.position.set(0, 0.02, 0.06);
    trowelGrip.rotation.x = Math.PI / 2;
    const trowelBlade = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.20, 4), trowelBladeMat);
    trowelBlade.scale.set(1.0, 1.0, 0.18);
    trowelBlade.position.set(0, -0.05, 0.14);
    trowelBlade.rotation.x = Math.PI * 0.48;
    trowelBlade.castShadow = true;
    this.trowelRightGroup.add(trowelGrip, trowelBlade);

    this.mortarBoardLeftGroup = new THREE.Group();
    this.leftHandSocket.add(this.mortarBoardLeftGroup);

    const boardMat = new THREE.MeshStandardMaterial({ color: 0x828894, roughness: 0.6 });
    const dirtPasteMat = new THREE.MeshStandardMaterial({ color: 0xc28a52, roughness: 0.85 });
    const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.028), boardMat);
    boardMesh.position.set(-0.04, -0.02, 0.06);
    boardMesh.rotation.set(0.3, 0.4, 0.2);
    boardMesh.castShadow = true;
    const dirtPaste = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 10), dirtPasteMat);
    dirtPaste.scale.set(1.1, 0.9, 0.35);
    dirtPaste.position.set(0, 0, 0.02);
    boardMesh.add(dirtPaste);
    this.mortarBoardLeftGroup.add(boardMesh);

    this.trowelGroundPatch = new THREE.Group();
    this.trowelGroundPatch.position.set(0.08, 0.02, 0.54);
    this.group.add(this.trowelGroundPatch);

    const freshDirtMat = new THREE.MeshStandardMaterial({ color: 0xd4a468, roughness: 0.88 });
    const freshDirtRimMat = new THREE.MeshStandardMaterial({ color: 0xc28e52, roughness: 0.9 });
    const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.40, 0.045, 24), freshDirtRimMat);
    baseDisc.scale.set(1.12, 1.0, 0.95);
    baseDisc.receiveShadow = true;
    const topMound = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), freshDirtMat);
    topMound.scale.set(1.15, 0.26, 0.95);
    topMound.position.set(0.03, 0.03, -0.02);
    topMound.castShadow = true;
    topMound.receiveShadow = true;
    const pebble1 = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), freshDirtMat);
    pebble1.position.set(-0.36, 0.02, 0.16);
    this.trowelGroundPatch.add(baseDisc, topMound, pebble1);

    // 3. SILVER SQUARE-BLADE SHOVEL + DIG CLOD BURST (ref_06_cliff_waterfall.png)
    this.shovelGroup = new THREE.Group();
    this.rightHandSocket.add(this.shovelGroup);

    const shovelBlueMat = new THREE.MeshStandardMaterial({ color: 0x2654b8, roughness: 0.42 });
    const shovelShaftMat = new THREE.MeshStandardMaterial({ color: 0x3b4d6e, roughness: 0.45 });
    const shovelBladeMat = new THREE.MeshPhysicalMaterial({
      color: 0xd6dee8,
      metalness: 0.62,
      roughness: 0.28,
      clearcoat: 0.3
    });

    const shovelShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.58, 12), shovelShaftMat);
    shovelShaft.position.set(0, 0.04, 0);
    shovelShaft.castShadow = true;

    const dHandle = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.018, 10, 18), shovelBlueMat);
    dHandle.position.set(0, 0.35, 0);
    dHandle.castShadow = true;

    const bladeGroup = new THREE.Group();
    bladeGroup.position.set(0, -0.32, 0.02);
    const bladePlate = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.32, 0.024), shovelBladeMat);
    bladePlate.castShadow = true;
    const leftFlange = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.32, 0.055), shovelBladeMat);
    leftFlange.position.set(-0.125, 0, 0.018);
    const rightFlange = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.32, 0.055), shovelBladeMat);
    rightFlange.position.set(0.125, 0, 0.018);
    const centerSocket = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.16, 10), shovelBladeMat);
    centerSocket.rotation.x = Math.PI;
    centerSocket.position.set(0, 0.06, 0.018);
    bladeGroup.add(bladePlate, leftFlange, rightFlange, centerSocket);

    this.shovelGroup.add(shovelShaft, dHandle, bladeGroup);

    this.shovelDirtBurstGroup = new THREE.Group();
    this.shovelDirtBurstGroup.position.set(0.02, 0.04, 0.56);
    this.group.add(this.shovelDirtBurstGroup);

    const clodDarkMat = new THREE.MeshStandardMaterial({ color: 0x8f663c, roughness: 0.92 });
    const clodMidMat = new THREE.MeshStandardMaterial({ color: 0xa87c4f, roughness: 0.88 });
    const clodOffsets = [
      [-0.12, 0.08, 0.04, 0.095],
      [0.08, 0.06, 0.08, 0.09],
      [-0.02, 0.18, -0.02, 0.082],
      [-0.15, 0.20, -0.04, 0.068],
      [0.12, 0.22, -0.02, 0.064],
      [0.01, 0.31, -0.06, 0.058],
      [-0.08, 0.12, 0.14, 0.062],
      [0.14, 0.11, 0.12, 0.058]
    ];
    this.dirtClodMeshes = [];
    for (let i = 0; i < clodOffsets.length; i++) {
      const [cx, cy, cz, cr] = clodOffsets[i];
      const clodGeo = new THREE.SphereGeometry(cr, 12, 10);
      clodGeo.scale(1.12, 0.82, 0.95);
      const clod = new THREE.Mesh(clodGeo, i % 2 === 0 ? clodDarkMat : clodMidMat);
      clod.position.set(cx, cy, cz);
      clod.rotation.set(i * 0.7, i * 1.1, i * 0.4);
      clod.castShadow = true;
      this.shovelDirtBurstGroup.add(clod);
      this.dirtClodMeshes.push({ mesh: clod, baseY: cy, phase: i * 0.8 });
    }

    // 4. BAMBOO FISHING ROD + RED/WHITE BOBBER IN WATER (ref_05)
    this.fishingRodGroup = new THREE.Group();
    this.rightHandSocket.add(this.fishingRodGroup);

    const bambooMat = new THREE.MeshStandardMaterial({ color: 0xc89646, roughness: 0.55 });
    const rodPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.028, 1.45, 10), bambooMat);
    rodPole.position.set(0, 0.0, 0.68);
    rodPole.rotation.x = Math.PI * 0.42;
    rodPole.castShadow = true;
    this.fishingRodGroup.add(rodPole);

    this.bobberAssembly = new THREE.Group();
    this.bobberAssembly.position.set(0, -0.58, 2.15);
    this.fishingRodGroup.add(this.bobberAssembly);

    const bobberRed = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xe62e2d, roughness: 0.3 })
    );
    const bobberWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      this.whiteMat
    );
    const rippleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.14, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    rippleRing.rotation.x = -Math.PI / 2;
    rippleRing.position.y = -0.01;
    this.bobberAssembly.add(bobberRed, bobberWhite, rippleRing);

    const linePoints = [
      new THREE.Vector3(0, 0.18, 1.38),
      new THREE.Vector3(0, -0.15, 1.82),
      new THREE.Vector3(0, -0.52, 2.15)
    ];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const fishingLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xeef6ff, transparent: true, opacity: 0.75 })
    );
    this.fishingRodGroup.add(fishingLine);

    // 5. BUG NET
    this.bugNetGroup = new THREE.Group();
    this.rightHandSocket.add(this.bugNetGroup);

    const netShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.85, 10), bambooMat);
    netShaft.position.set(0, 0, 0.38);
    netShaft.rotation.x = Math.PI / 2;
    const netHoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.015, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0x556070, metalness: 0.5 })
    );
    netHoop.rotation.x = Math.PI / 2;
    netHoop.position.set(0, 0, 0.98);
    const netBag = new THREE.Mesh(
      new THREE.ConeGeometry(0.19, 0.38, 18, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xf4f8ff,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
        roughness: 0.8
      })
    );
    netBag.position.set(0, -0.19, 0.98);
    netBag.rotation.x = Math.PI;
    this.bugNetGroup.add(netShaft, netHoop, netBag);
  }

  _createContactShadow(radiusX = 0.42, radiusZ = 0.38, opacity = 0.36) {
    if (this.materialFactory && typeof this.materialFactory.createContactShadowDisc === 'function') {
      try {
        const disc = this.materialFactory.createContactShadowDisc(radiusX, radiusZ, opacity);
        if (disc) return disc;
      } catch (_err) {
        // Fallback below
      }
    }
    const { texture } = createProceduralCanvasTexture(128, 128, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      grad.addColorStop(0, `rgba(18, 28, 18, ${opacity})`);
      grad.addColorStop(0.6, `rgba(18, 28, 18, ${opacity * 0.45})`);
      grad.addColorStop(1, 'rgba(18, 28, 18, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });
    const geo = new THREE.PlaneGeometry(radiusX * 2.2, radiusZ * 2.2);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    });
    return new THREE.Mesh(geo, mat);
  }

  setOutfit(outfitName) {
    this.outfitName = outfitName;

    this.gingerHairGroup.visible = false;
    this.darkBobHairGroup.visible = false;
    this.bucketHatGroup.visible = false;
    this.hardHatGroup.visible = false;

    this.overallsAddonGroup.visible = false;
    this.maxiSkirtMesh.visible = false;
    this.yellowSkirtMesh.visible = false;
    this.collarMesh.visible = false;

    for (let i = 0; i < 2; i++) {
      this.bareFeetNodes[i].visible = false;
      this.yellowBootNodes[i].visible = false;
      this.sneakerNodes[i].visible = false;
      this.leftLowerLeg.visible = true;
      this.rightLowerLeg.visible = true;
    }

    this.skinMaterial.color.setHex(0xffcfb3);

    switch (outfitName) {
      case 'beach_gingham': {
        this.gingerHairGroup.visible = true;
        this.expressionStyle = 'bright_blue';
        this.torsoMesh.material = this.ginghamMat;
        this.collarMesh.material = this.ginghamMat;
        this.collarMesh.visible = true;
        this.leftSleeveMesh.material = this.ginghamMat;
        this.rightSleeveMesh.material = this.ginghamMat;
        this.leftUpperLeg.material = this.beigeShortsMat;
        this.rightUpperLeg.material = this.beigeShortsMat;
        this.leftLowerLeg.material = this.skinMaterial;
        this.rightLowerLeg.material = this.skinMaterial;
        this.bareFeetNodes[0].visible = true;
        this.bareFeetNodes[1].visible = true;
        break;
      }

      case 'yard_overalls': {
        this.gingerHairGroup.visible = true;
        this.expressionStyle = 'bright_blue';
        this.torsoMesh.material = this.ginghamMat;
        this.overallsAddonGroup.visible = true;
        this.leftSleeveMesh.material = this.ginghamMat;
        this.rightSleeveMesh.material = this.ginghamMat;
        this.leftUpperLeg.material = this.denimOverallMat;
        this.rightUpperLeg.material = this.denimOverallMat;
        this.leftLowerLeg.material = this.denimOverallMat;
        this.rightLowerLeg.material = this.denimOverallMat;
        this.yellowBootNodes[0].visible = true;
        this.yellowBootNodes[1].visible = true;
        break;
      }

      case 'garden_dress': {
        this.darkBobHairGroup.visible = true;
        this.skinMaterial.color.setHex(0xe5ab82);
        this.expressionStyle = 'serene_lidded';
        this.torsoMesh.material = this.gardenDressMat;
        this.maxiSkirtMesh.visible = true;
        this.leftSleeveMesh.material = this.skinMaterial;
        this.rightSleeveMesh.material = this.skinMaterial;
        this.leftUpperLeg.material = this.skinMaterial;
        this.rightUpperLeg.material = this.skinMaterial;
        this.leftLowerLeg.material = this.skinMaterial;
        this.rightLowerLeg.material = this.skinMaterial;
        this.sneakerNodes[0].visible = true;
        this.sneakerNodes[1].visible = true;
        break;
      }

      case 'tent_explorer': {
        this.bucketHatGroup.visible = true;
        this.expressionStyle = 'explorer_dark';
        this.torsoMesh.material = this.sailorTopMat;
        this.leftSleeveMesh.material = this.sailorTopMat;
        this.rightSleeveMesh.material = this.sailorTopMat;
        this.leftUpperLeg.material = this.jeansMat;
        this.rightUpperLeg.material = this.jeansMat;
        this.leftLowerLeg.material = this.jeansMat;
        this.rightLowerLeg.material = this.jeansMat;
        this.sneakerNodes[0].visible = true;
        this.sneakerNodes[1].visible = true;
        break;
      }

      case 'cliff_builder':
      default: {
        this.hardHatGroup.visible = true;
        this.expressionStyle = 'builder_green';
        this.torsoMesh.material = this.cliffTunicMat;
        this.yellowSkirtMesh.visible = true;
        this.leftSleeveMesh.material = this.cliffTunicMat;
        this.rightSleeveMesh.material = this.cliffTunicMat;
        this.leftUpperLeg.material = this.whiteMat;
        this.rightUpperLeg.material = this.whiteMat;
        this.leftLowerLeg.material = this.whiteMat;
        this.rightLowerLeg.material = this.whiteMat;
        this.sneakerNodes[0].visible = true;
        this.sneakerNodes[1].visible = true;
        break;
      }
    }

    this._drawDynamicFace(this.expressionStyle, 0);
  }

  cycleOutfit() {
    const order = [
      'beach_gingham',
      'yard_overalls',
      'garden_dress',
      'tent_explorer',
      'cliff_builder'
    ];
    const idx = order.indexOf(this.outfitName);
    const next = order[(idx + 1) % order.length];
    this.setOutfit(next);
    return next;
  }

  get currentTool() {
    return this.toolName;
  }

  set currentTool(val) {
    this.setTool(val);
  }

  setTool(toolName) {
    const normalized = toolName === 'net' ? 'bug_net' : (toolName || 'none');
    this.toolName = normalized;

    this.wateringCanGroup.visible = normalized === 'watering_can';
    this.trowelRightGroup.visible = normalized === 'trowel';
    this.mortarBoardLeftGroup.visible = normalized === 'trowel';
    this.shovelGroup.visible = normalized === 'shovel';
    this.fishingRodGroup.visible = normalized === 'fishing_rod';
    this.bugNetGroup.visible = normalized === 'bug_net';

    this.trowelGroundPatch.visible = normalized === 'trowel' && this.poseName === 'trowel_pat';
    this.shovelDirtBurstGroup.visible = normalized === 'shovel' && this.poseName === 'shovel_dig';
    this.waterSprayGroup.visible = normalized === 'watering_can' && (this.poseName === 'watering' || this.actionTimer > 0);
  }

  equipTool(toolName) {
    this.setTool(toolName);
  }

  cycleTool() {
    const tools = ['none', 'watering_can', 'shovel', 'trowel', 'fishing_rod', 'bug_net'];
    const idx = tools.indexOf(this.toolName);
    const next = tools[(idx + 1) % tools.length];
    this.setTool(next);
    return next;
  }

  setPose(poseName) {
    this.poseName = poseName || 'idle';
    this.trowelGroundPatch.visible = this.toolName === 'trowel' && this.poseName === 'trowel_pat';
    this.shovelDirtBurstGroup.visible = this.toolName === 'shovel' && this.poseName === 'shovel_dig';
    this.waterSprayGroup.visible = this.toolName === 'watering_can' && (this.poseName === 'watering' || this.actionTimer > 0);
  }

  standUpFromSeat() {
    if (this.poseName !== 'sit' && !this.seatedOn) return false;
    const seat = this.seatedOn;
    this.seatedOn = null;
    this.setPose('idle');

    // Step slightly forward in current facing direction so player is outside the seat collider
    const stepDist = seat ? (seat.radius || 0.45) + 0.25 : 0.55;
    const fx = this.group.position.x + Math.sin(this.group.rotation.y) * stepDist;
    const fz = this.group.position.z + Math.cos(this.group.rotation.y) * stepDist;
    this.group.position.x = fx;
    this.group.position.z = fz;
    this.group.position.y = this._queryGroundHeight(fx, fz);
    this.squashVel = 2.4;
    return true;
  }

  triggerToolAction() {
    if (this.poseName === 'sit') {
      this.standUpFromSeat();
    }
    this.actionTimer = this.actionDuration;
    this.squashVel = -3.2;
    this.setPose(this.poseName);
  }

  setTargetPosition(x, z, onArrive = null) {
    if (this.poseName === 'sit') {
      this.standUpFromSeat();
    }
    this.targetPos = new THREE.Vector3(x, 0, z);
    this.onTargetArrive = typeof onArrive === 'function' ? onArrive : null;
    this.manualControlActive = true;
  }

  moveTo(x, z, onArrive = null) {
    this.setTargetPosition(x, z, onArrive);
  }

  _bindKeyboardControls() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          this.manualControlActive = true;
          this.targetPos = null;
          this.onTargetArrive = null;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          this.manualControlActive = true;
          this.targetPos = null;
          this.onTargetArrive = null;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          this.manualControlActive = true;
          this.targetPos = null;
          this.onTargetArrive = null;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          this.manualControlActive = true;
          this.targetPos = null;
          this.onTargetArrive = null;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.shift = true;
          break;
        default:
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
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
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.shift = false;
          break;
        default:
          break;
      }
    });
  }

  _queryGroundHeight(x, z) {
    if (this.gridSystem && typeof this.gridSystem.getTerrainHeight === 'function') {
      const h = this.gridSystem.getTerrainHeight(x, z);
      if (Number.isFinite(h)) return h;
    }
    if (z < -14) return 3.2;
    if (z > 14) {
      const t = Math.min(1, Math.max(0, (z - 14) / 12));
      return 0.6 - t * 1.0;
    }
    return 0.6;
  }

  update(dt, elapsed) {
    const safeDt = Math.min(dt || 0.016, 0.1);

    this.blinkTimer -= safeDt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 3.4 + (Math.sin(elapsed * 1.7) * 0.5 + 0.5) * 2.2;
      this.isBlinking = true;
      this.blinkAmount = 1.0;
    }
    if (this.isBlinking) {
      this.blinkAmount -= safeDt * 6.5;
      if (this.blinkAmount <= 0) {
        this.blinkAmount = 0;
        this.isBlinking = false;
      }
    }
    const blinkState = this.blinkAmount > 0.55 ? 1 : 0;
    if (blinkState !== this.lastRenderedBlink || this.expressionStyle !== this.lastRenderedExpression) {
      this._drawDynamicFace(this.expressionStyle, this.blinkAmount);
    }

    let moveX = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    let moveZ = (this.keys.backward ? 1 : 0) - (this.keys.forward ? 1 : 0);

    if ((moveX !== 0 || moveZ !== 0) && this.poseName === 'sit') {
      this.standUpFromSeat();
    }

    if (moveX === 0 && moveZ === 0 && this.targetPos) {
      const dx = this.targetPos.x - this.group.position.x;
      const dz = this.targetPos.z - this.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.18) {
        moveX = dx / dist;
        moveZ = dz / dist;
      } else {
        this.targetPos = null;
        if (typeof this.onTargetArrive === 'function') {
          const cb = this.onTargetArrive;
          this.onTargetArrive = null;
          cb();
        }
      }
    }

    const isMoving = Math.hypot(moveX, moveZ) > 0.01;
    if (isMoving) {
      const len = Math.hypot(moveX, moveZ);
      moveX /= len;
      moveZ /= len;

      if (this.poseName !== 'idle') {
        this.setPose('idle');
      }

      const speed = this.keys.shift ? this.runSpeed : this.walkSpeed;
      const desiredX = this.group.position.x + moveX * speed * safeDt;
      const desiredZ = this.group.position.z + moveZ * speed * safeDt;

      if (this.gridSystem && typeof this.gridSystem.resolveMovement === 'function') {
        const resolved = this.gridSystem.resolveMovement(
          this.group.position.x,
          this.group.position.z,
          desiredX,
          desiredZ,
          0.34
        );
        if (resolved && Number.isFinite(resolved.x) && Number.isFinite(resolved.z)) {
          const stoppedByCollider =
            this.targetPos &&
            resolved.collided &&
            Math.hypot(resolved.x - this.group.position.x, resolved.z - this.group.position.z) < 0.002;
          this.group.position.x = resolved.x;
          this.group.position.z = resolved.z;
          if (stoppedByCollider) {
            const remDist = this.targetPos
              ? Math.hypot(this.targetPos.x - this.group.position.x, this.targetPos.z - this.group.position.z)
              : Infinity;
            this.targetPos = null;
            if (remDist < 1.8 && typeof this.onTargetArrive === 'function') {
              const cb = this.onTargetArrive;
              this.onTargetArrive = null;
              cb();
            } else {
              this.onTargetArrive = null;
            }
          }
        } else {
          this.group.position.x = desiredX;
          this.group.position.z = desiredZ;
        }
      } else {
        this.group.position.x = desiredX;
        this.group.position.z = desiredZ;
      }

      this.group.position.y = this._queryGroundHeight(this.group.position.x, this.group.position.z);

      const targetAngle = Math.atan2(moveX, moveZ);
      let diff = targetAngle - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, safeDt * 12);

      const freq = this.keys.shift ? 11.0 : 8.0;
      this.movePhase += safeDt * freq * Math.PI * 2;
    } else if (this.poseName !== 'sit') {
      // Always keep standing player grounded on terrain height so they never sink!
      this.group.position.y = this._queryGroundHeight(this.group.position.x, this.group.position.z);
    }

    const targetSquash = isMoving ? Math.sin(this.movePhase * 2) * 0.038 : 0;
    const springForce = (targetSquash - this.squash) * 140 - this.squashVel * 16;
    this.squashVel += springForce * safeDt;
    this.squash += this.squashVel * safeDt;

    if (this.actionTimer > 0) {
      this.actionTimer = Math.max(0, this.actionTimer - safeDt);
    }

    this._applyPoseAndLimbAnimation(elapsed, isMoving);
  }

  _applyPoseAndLimbAnimation(elapsed, isMoving) {
    this.bodyPivot.position.set(0, 0, 0);
    this.bodyPivot.scale.set(1 + this.squash, 1 - this.squash, 1 + this.squash);
    this.spinePivot.rotation.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);
    this.leftArmPivot.position.set(-0.19, 0.31, 0);
    this.rightArmPivot.position.set(0.19, 0.31, 0);
    this.leftArmPivot.rotation.set(0, 0, 0.24);
    this.rightArmPivot.rotation.set(0, 0, -0.24);
    this.leftLegPivot.rotation.set(0, 0, 0);
    this.rightLegPivot.rotation.set(0, 0, 0);
    this.leftLegPivot.position.set(-0.105, 0.34, 0);
    this.rightLegPivot.position.set(0.105, 0.34, 0);
    this.contactShadow.visible = true;

    const breathe = Math.sin(elapsed * 2.4) * 0.014;

    if (isMoving) {
      const swing = Math.sin(this.movePhase) * 0.65;
      const bounce = Math.abs(Math.sin(this.movePhase)) * 0.075;
      this.bodyPivot.position.y = bounce;
      this.spinePivot.rotation.x = 0.08;
      this.spinePivot.rotation.z = Math.cos(this.movePhase) * 0.04;
      this.leftLegPivot.rotation.x = swing;
      this.rightLegPivot.rotation.x = -swing;
      this.leftArmPivot.rotation.x = -swing * 0.85;
      this.rightArmPivot.rotation.x = swing * 0.85;
      return;
    }

    switch (this.poseName) {
      case 'sit': {
        // ref_01_beach_sunset.png: Sitting flush on the y = 0.62 wooden log stump top
        this.contactShadow.visible = false;
        this.bodyPivot.position.set(0, -0.02 + breathe * 0.4, 0.06);
        this.spinePivot.rotation.x = -0.04;
        this.headGroup.rotation.x = -0.06 + Math.sin(elapsed * 1.4) * 0.015;

        this.leftLegPivot.position.set(-0.10, 0.32, 0.06);
        this.rightLegPivot.position.set(0.10, 0.32, 0.06);
        this.leftLegPivot.rotation.set(-Math.PI * 0.48, 0.06, 0);
        this.rightLegPivot.rotation.set(-Math.PI * 0.48, -0.06, 0);

        this.leftArmPivot.rotation.set(-0.62, 0.35, -0.22);
        this.rightArmPivot.rotation.set(-0.62, -0.35, 0.22);
        break;
      }

      case 'trowel_pat': {
        // ref_02_house_yard.png: Three-quarter stance showing overalls, yellow rain boots, left mortar board & right trowel
        const patWave = Math.sin(elapsed * 5.5);
        this.spinePivot.rotation.x = 0.28 + patWave * 0.03;
        this.headGroup.rotation.x = -0.32;
        this.headGroup.rotation.y = -0.14;

        this.leftLegPivot.position.set(-0.12, 0.34, -0.04);
        this.rightLegPivot.position.set(0.12, 0.34, 0.06);
        this.leftLegPivot.rotation.set(-0.18, 0, 0.12);
        this.rightLegPivot.rotation.set(0.16, 0, -0.12);

        this.leftArmPivot.position.set(-0.23, 0.31, 0.04);
        this.leftArmPivot.rotation.set(-0.32, -0.25, 0.72);
        this.rightArmPivot.position.set(0.22, 0.30, 0.08);
        this.rightArmPivot.rotation.set(-0.92 + patWave * 0.14, 0.16, -0.30);
        this.trowelRightGroup.rotation.set(0.35, 0, 0);
        this.trowelGroundPatch.position.set(0.08, 0.02, 0.50);
        this.trowelGroundPatch.visible = true;
        break;
      }

      case 'watering': {
        // ref_03_flower_garden_river.jpg: Pouring water onto tulips with head tilted up (-0.30) so serene face & dress show clearly!
        this.spinePivot.rotation.x = 0.08 + breathe;
        this.headGroup.rotation.x = -0.30;
        this.headGroup.rotation.y = -0.04;

        this.leftArmPivot.position.set(-0.22, 0.31, 0.02);
        this.leftArmPivot.rotation.set(-0.08, 0, 0.56);
        this.rightArmPivot.position.set(0.21, 0.31, 0.04);
        this.rightArmPivot.rotation.set(-0.88 + Math.sin(elapsed * 2.8) * 0.04, 0.22, -0.14);
        this.wateringCanGroup.rotation.set(0.28, -0.15, 0);
        this.waterSprayGroup.visible = true;

        for (const d of this.waterDroplets) {
          const t = (elapsed * 1.85 + d.phaseOffset) % 1.0;
          const forwardDist = t * 0.62;
          const sideDist = Math.sin(d.laneAngle) * forwardDist * 1.3;
          const dropY = -t * 0.22 - t * t * 0.52;
          d.mesh.position.set(sideDist, dropY, forwardDist);
          const scale = (1.0 - t * 0.35) * (0.85 + 0.3 * Math.sin(elapsed * 12 + d.phaseOffset * 10));
          d.mesh.scale.setScalar(scale);
        }
        break;
      }

      case 'idle_happy': {
        // ref_04_yellow_tent_horizon.jpg: Outstretched chibi arms/sleeves & hands clearly visible outside head silhouette
        this.bodyPivot.position.y = Math.abs(Math.sin(elapsed * 1.8)) * 0.015;
        this.spinePivot.rotation.x = breathe * 0.5;
        this.headGroup.rotation.x = -0.16;
        this.headGroup.rotation.z = Math.sin(elapsed * 1.4) * 0.025;
        this.leftArmPivot.position.set(-0.22, 0.31, 0.02);
        this.rightArmPivot.position.set(0.22, 0.31, 0.02);
        this.leftArmPivot.rotation.set(-0.18, 0, 0.56 + Math.sin(elapsed * 2.0) * 0.03);
        this.rightArmPivot.rotation.set(-0.18, 0, -0.56 - Math.sin(elapsed * 2.0) * 0.03);
        break;
      }

      case 'fishing': {
        // ref_05_beach_bridge_villagers.png: Holding bamboo fishing rod over water with bobber on water surface
        this.spinePivot.rotation.x = 0.08;
        this.headGroup.rotation.x = -0.14;
        this.rightArmPivot.rotation.set(-0.78, 0.15, -0.12);
        this.leftArmPivot.rotation.set(-0.68, -0.25, 0.18);
        this.fishingRodGroup.rotation.set(-0.18 + Math.sin(elapsed * 2.2) * 0.03, 0, 0);
        this.bobberAssembly.position.set(-0.08, -0.68 + Math.sin(elapsed * 3.8) * 0.025, 2.15);
        this.bobberAssembly.rotation.set(0.88, 0, 0);
        break;
      }

      case 'wave': {
        this.spinePivot.rotation.z = -0.05;
        this.headGroup.rotation.x = -0.14;
        this.rightArmPivot.rotation.set(-2.35, 0, -0.35 + Math.sin(elapsed * 8.0) * 0.28);
        this.leftArmPivot.rotation.set(0, 0, 0.32);
        break;
      }

      case 'shovel_dig': {
        // ref_06_cliff_waterfall.png: Gripping silver square-blade shovel beside freshly dug dirt clods, head tilted up (-0.28)
        const digPulse = Math.sin(elapsed * 3.2) * 0.035;
        this.spinePivot.rotation.x = 0.14 + digPulse;
        this.headGroup.rotation.x = -0.28;

        this.leftLegPivot.rotation.set(-0.12, 0, 0.14);
        this.rightLegPivot.rotation.set(0.14, 0, -0.14);

        this.leftArmPivot.rotation.set(-0.72, 0.38, -0.18);
        this.rightArmPivot.rotation.set(-0.95, -0.12, -0.22);

        this.shovelGroup.position.set(-0.04, -0.02, 0.16);
        this.shovelGroup.rotation.set(0.72 + digPulse, -0.12, -0.14);
        this.shovelDirtBurstGroup.visible = true;

        for (const item of this.dirtClodMeshes) {
          item.mesh.position.y = item.baseY + Math.abs(Math.sin(elapsed * 3.2 + item.phase)) * 0.025;
        }
        break;
      }

      default: {
        this.spinePivot.rotation.x = breathe;
        this.headGroup.rotation.x = -0.12;
        if (this.actionTimer > 0) {
          const p = 1.0 - this.actionTimer / this.actionDuration;
          const swingArc = Math.sin(p * Math.PI);
          this.rightArmPivot.rotation.x = -1.35 * swingArc;
          this.spinePivot.rotation.x = 0.28 * swingArc;
          if (this.toolName === 'watering_can') {
            this.waterSprayGroup.visible = true;
          }
        }
        break;
      }
    }
  }
}

// ============================================================================
// BELOVED ARGON VALLEY VILLAGER NPCs (BARNABY, CLOVER, MILO + BEACH FRIENDS)
// ============================================================================

class VillagerNPC {
  constructor(config, materialFactory) {
    this.id = config.id;
    this.name = config.name;
    this.species = config.species;
    this.personality = config.personality;
    this.dialogueLines = config.dialogueLines || [];
    this.giftLines = config.giftLines || [
      `Wait—is this fresh island fruit for me?! You're the best! Here, take 300 Coins!`
    ];
    this.dialogueIndex = 0;
    this.materialFactory = materialFactory;

    this.group = new THREE.Group();
    this.group.name = `Villager_${this.name}`;
    this.mesh = this.group;
    this.root = this.group;

    this.homeX = config.x || 0;
    this.homeY = config.y || 0.6;
    this.homeZ = config.z || 0;
    this.baseRotY = config.rotY || 0;
    this.baseHeadPitch = config.baseHeadPitch || -0.18;
    this.group.position.set(this.homeX, this.homeY, this.homeZ);
    this.group.rotation.y = this.baseRotY;

    this.bodyPivot = new THREE.Group();
    this.group.add(this.bodyPivot);

    this.waterDroplets = [];
    this.talkBounceTimer = 0;
    this.targetRotY = null;

    if (config.builderFn) {
      config.builderFn(this);
    }
  }

  get position() {
    return this.group.position;
  }

  get rotation() {
    return this.group.rotation;
  }

  faceToward(x, z) {
    const dx = x - this.group.position.x;
    const dz = z - this.group.position.z;
    if (Math.hypot(dx, dz) > 0.05) {
      this.targetRotY = Math.atan2(dx, dz);
    }
    this.talkBounceTimer = 0.95;
  }

  getNextDialogue() {
    this.talkBounceTimer = 0.85;
    if (!this.dialogueLines.length) return `Hiya! Lovely weather on the island today!`;
    const line = this.dialogueLines[this.dialogueIndex % this.dialogueLines.length];
    this.dialogueIndex++;
    return line;
  }

  getGiftDialogue() {
    this.talkBounceTimer = 1.1;
    return this.giftLines[this.dialogueIndex % this.giftLines.length];
  }

  update(dt, elapsed, playerPos) {
    if (!this.group.visible) return;
    const breathe = Math.sin(elapsed * 2.6 + this.baseRotY) * 0.016;
    let bounceY = 0;
    if (this.talkBounceTimer > 0) {
      this.talkBounceTimer = Math.max(0, this.talkBounceTimer - dt);
      bounceY = Math.abs(Math.sin(elapsed * 14)) * 0.068;
    }
    this.bodyPivot.position.y = bounceY;
    this.bodyPivot.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);

    if (this.targetRotY !== null) {
      let diff = this.targetRotY - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, dt * 8);
      if (playerPos && Math.hypot(playerPos.x - this.group.position.x, playerPos.z - this.group.position.z) > 3.8) {
        this.targetRotY = null;
      }
    }

    if (this.headGroup) {
      this.headGroup.rotation.x = this.baseHeadPitch;
      this.headGroup.rotation.z = Math.sin(elapsed * 1.8 + this.baseRotY) * 0.035;
      if (playerPos) {
        const dx = playerPos.x - this.group.position.x;
        const dz = playerPos.z - this.group.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3.6 && dist > 0.2) {
          const angleToPlayer = Math.atan2(dx, dz);
          let relAngle = angleToPlayer - this.group.rotation.y;
          while (relAngle > Math.PI) relAngle -= Math.PI * 2;
          while (relAngle < -Math.PI) relAngle += Math.PI * 2;
          const clamped = Math.max(-0.45, Math.min(0.45, relAngle * 0.55));
          this.headGroup.rotation.y += (clamped - this.headGroup.rotation.y) * Math.min(1, dt * 6);
        } else {
          this.headGroup.rotation.y *= Math.max(0, 1 - dt * 5);
        }
      }
    }

    if (this.leftEarPivot && this.rightEarPivot) {
      const twitch = Math.pow(Math.max(0, Math.sin(elapsed * 3.1 + this.baseRotY)), 8) * 0.14;
      this.leftEarPivot.rotation.z = 0.12 + twitch;
      this.rightEarPivot.rotation.z = -0.12 - twitch;
    }

    if (this.waterDroplets.length > 0) {
      for (const d of this.waterDroplets) {
        const t = (elapsed * 1.9 + d.phaseOffset) % 1.0;
        const forward = t * 0.58;
        const side = Math.sin(d.laneAngle) * forward * 1.25;
        const dropY = -t * 0.18 - t * t * 0.48;
        d.mesh.position.set(side, dropY, forward);
        d.mesh.scale.setScalar((1.0 - t * 0.3) * 0.95);
      }
    }
  }
}

function buildBarnabyVillager(npc) {
  const shadow = npc.materialFactory?.createContactShadowDisc
    ? npc.materialFactory.createContactShadowDisc(0.38, 0.36, 0.35)
    : null;
  if (shadow) {
    shadow.position.y = 0.02;
    npc.group.add(shadow);
  }

  // Deep golden-amber fur (#e0881e) & warm cream cheek mask texture (ref_02_house_yard.png)
  const { texture: barnabyHeadTex } = createProceduralCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e0881e';
    ctx.fillRect(0, 0, w, h);

    // Wide cream-white lower cheek/muzzle mask (#fff0d2) curving up between the eyes
    ctx.fillStyle = '#fff0d2';
    ctx.beginPath();
    ctx.moveTo(w * 0.06, h * 0.98);
    ctx.quadraticCurveTo(w * 0.10, h * 0.46, w * 0.34, h * 0.50);
    ctx.quadraticCurveTo(w * 0.50, h * 0.32, w * 0.66, h * 0.50);
    ctx.quadraticCurveTo(w * 0.90, h * 0.46, w * 0.94, h * 0.98);
    ctx.closePath();
    ctx.fill();

    // Expressive arched eyebrows
    ctx.strokeStyle = '#5c2d0c';
    ctx.lineWidth = 8.0;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(256 + side * 74, 194, 24, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    // Large glossy dark-brown oval bead eyes (rx = 26, ry = 34) with bright white catchlights
    for (const side of [-1, 1]) {
      const ex = 256 + side * 74;
      const ey = 240;
      ctx.fillStyle = '#1c100b';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 26, 34, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 7, ey - 9, 8.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rosy cheek blushes
    for (const cx of [118, 394]) {
      ctx.fillStyle = 'rgba(242, 122, 118, 0.55)';
      ctx.beginPath();
      ctx.ellipse(cx, 294, 30, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bold pink triangle nose (#e8586c)
    ctx.fillStyle = '#e8586c';
    ctx.beginPath();
    ctx.moveTo(256, 290);
    ctx.lineTo(240, 270);
    ctx.lineTo(272, 270);
    ctx.closePath();
    ctx.fill();

    // Cheerful open hamster smile (#c84252)
    ctx.fillStyle = '#c84252';
    ctx.strokeStyle = '#421a10';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.arc(256, 302, 27, 0.08 * Math.PI, 0.92 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  const goldFurMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0881e,
    roughness: 0.64,
    sheen: 0.4,
    sheenColor: new THREE.Color('#f5b858')
  });
  const skyBlueEarMat = new THREE.MeshStandardMaterial({
    color: 0x48a8e2,
    roughness: 0.55
  });
  const starShirtMat = new THREE.MeshPhysicalMaterial({
    map: createStarShirtTexture(),
    roughness: 0.66,
    sheen: 0.35,
    sheenColor: new THREE.Color('#b088ff')
  });

  const bodyGeo = new THREE.SphereGeometry(0.30, 28, 22);
  bodyGeo.scale(1.16, 1.02, 1.08);
  const bodyMesh = new THREE.Mesh(bodyGeo, starShirtMat);
  bodyMesh.position.set(0, 0.36, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  npc.bodyPivot.add(bodyMesh);

  const footGeo = new THREE.SphereGeometry(0.085, 14, 12);
  footGeo.scale(1.0, 0.65, 1.25);
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(footGeo, goldFurMat);
    foot.position.set(side * 0.13, 0.07, 0.04);
    foot.castShadow = true;
    npc.bodyPivot.add(foot);
  }

  npc.baseHeadPitch = -0.24;
  npc.headGroup = new THREE.Group();
  npc.headGroup.position.set(0, 0.76, 0.02);
  npc.headGroup.rotation.x = npc.baseHeadPitch;
  npc.bodyPivot.add(npc.headGroup);

  const headGeo = createChibiHeadGeometry(0.35);
  headGeo.scale(1.12, 0.96, 1.04);
  const headMesh = new THREE.Mesh(headGeo, goldFurMat);
  headMesh.castShadow = true;
  npc.headGroup.add(headMesh);

  const facePatch = new THREE.Mesh(
    createConformingFacePatchGeometry(0.352, 1.52, 1.20),
    new THREE.MeshBasicMaterial({ map: barnabyHeadTex, transparent: true, depthWrite: false })
  );
  facePatch.scale.set(1.12, 0.96, 1.04);
  npc.headGroup.add(facePatch);

  npc.leftEarPivot = new THREE.Group();
  npc.leftEarPivot.position.set(-0.27, 0.27, -0.02);
  npc.rightEarPivot = new THREE.Group();
  npc.rightEarPivot.position.set(0.27, 0.27, -0.02);
  npc.headGroup.add(npc.leftEarPivot, npc.rightEarPivot);

  for (const earPivot of [npc.leftEarPivot, npc.rightEarPivot]) {
    const outerEar = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 14), goldFurMat);
    outerEar.scale.set(1.0, 1.0, 0.62);
    outerEar.castShadow = true;
    const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 12), skyBlueEarMat);
    innerEar.scale.set(1.0, 1.0, 0.45);
    innerEar.position.set(0, 0, 0.042);
    earPivot.add(outerEar, innerEar);
  }

  const armGeo = new THREE.CapsuleGeometry(0.062, 0.12, 10, 12);
  const leftArm = new THREE.Mesh(armGeo, goldFurMat);
  leftArm.position.set(-0.32, 0.40, 0.06);
  leftArm.rotation.set(-0.2, 0, 0.55);
  leftArm.castShadow = true;

  const rightArm = new THREE.Mesh(armGeo, goldFurMat);
  rightArm.position.set(0.30, 0.42, 0.14);
  rightArm.rotation.set(-0.85, -0.2, -0.35);
  rightArm.castShadow = true;
  npc.bodyPivot.add(leftArm, rightArm);

  const canGroup = new THREE.Group();
  canGroup.position.set(0.26, 0.38, 0.34);
  canGroup.rotation.set(0.32, -0.25, 0);
  npc.bodyPivot.add(canGroup);

  const tinMat = new THREE.MeshPhysicalMaterial({ color: 0xbac6d4, metalness: 0.55, roughness: 0.35 });
  const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.18, 16), tinMat);
  canBody.rotation.x = 0.35;
  canBody.castShadow = true;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.18, 12), tinMat);
  spout.position.set(0, 0.02, 0.16);
  spout.rotation.x = 1.05;
  const rose = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.05, 14), tinMat);
  rose.position.set(0, 0.06, 0.25);
  rose.rotation.x = -Math.PI * 0.65;
  canGroup.add(canBody, spout, rose);

  const sprayRoot = new THREE.Group();
  sprayRoot.position.set(0, 0.06, 0.27);
  canGroup.add(sprayRoot);

  const dropMat = new THREE.MeshBasicMaterial({ color: 0xeefcff, transparent: true, opacity: 0.92 });
  const dropGeo = new THREE.SphereGeometry(0.017, 8, 8);
  dropGeo.scale(0.8, 1.35, 0.8);
  for (let i = 0; i < 24; i++) {
    const mesh = new THREE.Mesh(dropGeo, dropMat);
    sprayRoot.add(mesh);
    npc.waterDroplets.push({
      mesh,
      phaseOffset: i / 24,
      laneAngle: ((i % 6) - 2.5) * 0.15
    });
  }
}

function buildCloverVillager(npc) {
  const shadow = npc.materialFactory?.createContactShadowDisc
    ? npc.materialFactory.createContactShadowDisc(0.38, 0.36, 0.35)
    : null;
  if (shadow) {
    shadow.position.y = 0.02;
    npc.group.add(shadow);
  }

  // Peppy Red-Orange & Wide Butter-Yellow Rabbit Face Texture (ref_03_flower_garden_river.jpg)
  const { texture: cloverFaceTex } = createProceduralCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e84324';
    ctx.fillRect(0, 0, w, h);

    // Wide butter-yellow two-lobed lower face & eye mask (#fae264) covering full front hemisphere
    ctx.fillStyle = '#fae264';
    ctx.beginPath();
    ctx.arc(166, 248, 138, Math.PI * 0.92, Math.PI * 2.08);
    ctx.arc(346, 248, 138, Math.PI * 0.92, Math.PI * 2.08);
    ctx.lineTo(484, 500);
    ctx.lineTo(28, 500);
    ctx.closePath();
    ctx.fill();

    // Bold rosy pink oval cheek blushes (#f576a2)
    for (const cx of [112, 400]) {
      ctx.fillStyle = 'rgba(245, 112, 158, 0.85)';
      ctx.beginPath();
      ctx.ellipse(cx, 310, 42, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Large glossy dark eyes (rx = 34, ry = 44) with outer eyelashes and white upper catchlights
    for (const side of [-1, 1]) {
      const ex = 256 + side * 84;
      const ey = 240;
      ctx.fillStyle = '#1c100e';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 34, 44, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#1c100e';
      ctx.lineWidth = 8.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex + side * 28, ey - 18);
      ctx.lineTo(ex + side * 44, ey - 28);
      ctx.moveTo(ex + side * 32, ey - 4);
      ctx.lineTo(ex + side * 46, ey - 9);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex - 8, ey - 13, 12, 15, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cute brown triangle nose
    ctx.fillStyle = '#522214';
    ctx.beginPath();
    ctx.moveTo(256, 294);
    ctx.lineTo(243, 278);
    ctx.lineTo(269, 278);
    ctx.closePath();
    ctx.fill();

    // Wide cheerful curved smile
    ctx.strokeStyle = '#421a12';
    ctx.lineWidth = 8.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(256, 302, 34, 0.14 * Math.PI, 0.86 * Math.PI);
    ctx.stroke();
  });

  const vermilionMat = new THREE.MeshPhysicalMaterial({
    color: 0xe84324,
    roughness: 0.58,
    sheen: 0.35,
    sheenColor: new THREE.Color('#ff9478')
  });
  const yellowFurMat = new THREE.MeshPhysicalMaterial({
    color: 0xfae264,
    roughness: 0.6,
    sheen: 0.35,
    sheenColor: new THREE.Color('#fff4b8')
  });
  const earInnerMat = new THREE.MeshStandardMaterial({
    color: 0xfae264,
    roughness: 0.58
  });
  const plaidDressMat = new THREE.MeshPhysicalMaterial({
    map: createGreenPlaidTexture(),
    roughness: 0.65,
    sheen: 0.3
  });

  const dressGeo = new THREE.CylinderGeometry(0.16, 0.28, 0.36, 24);
  const dressMesh = new THREE.Mesh(dressGeo, plaidDressMat);
  dressMesh.position.set(0, 0.20, 0);
  dressMesh.castShadow = true;
  npc.bodyPivot.add(dressMesh);

  for (const side of [-1, 1]) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.11, 0.09, 0.18);
    legGroup.rotation.y = side * -0.15;
    const legUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.058, 0.18, 14), yellowFurMat);
    legUpper.rotation.x = Math.PI / 2;
    const footTip = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 12), vermilionMat);
    footTip.position.set(0, 0, 0.10);
    legGroup.add(legUpper, footTip);
    npc.bodyPivot.add(legGroup);
  }

  npc.baseHeadPitch = -0.18;
  npc.headGroup = new THREE.Group();
  npc.headGroup.position.set(0, 0.62, 0.02);
  npc.headGroup.rotation.x = npc.baseHeadPitch;
  npc.bodyPivot.add(npc.headGroup);

  const headGeo = createChibiHeadGeometry(0.36);
  const headMesh = new THREE.Mesh(headGeo, vermilionMat);
  headMesh.castShadow = true;
  npc.headGroup.add(headMesh);

  const facePatch = new THREE.Mesh(
    createConformingFacePatchGeometry(0.362, 1.62, 1.24),
    new THREE.MeshBasicMaterial({ map: cloverFaceTex, transparent: true, depthWrite: false })
  );
  npc.headGroup.add(facePatch);

  npc.leftEarPivot = new THREE.Group();
  npc.leftEarPivot.position.set(-0.15, 0.32, 0.0);
  npc.rightEarPivot = new THREE.Group();
  npc.rightEarPivot.position.set(0.15, 0.32, 0.0);
  npc.headGroup.add(npc.leftEarPivot, npc.rightEarPivot);

  for (const earPivot of [npc.leftEarPivot, npc.rightEarPivot]) {
    const earOuter = new THREE.Mesh(new THREE.CapsuleGeometry(0.084, 0.32, 12, 16), vermilionMat);
    earOuter.scale.set(1.0, 1.0, 0.55);
    earOuter.position.y = 0.19;
    earOuter.castShadow = true;

    const earInner = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.25, 10, 14), earInnerMat);
    earInner.scale.set(1.0, 1.0, 0.35);
    earInner.position.set(0, 0.18, 0.034);
    earPivot.add(earOuter, earInner);
  }

  const armGeo = new THREE.CapsuleGeometry(0.052, 0.14, 10, 12);
  const leftArm = new THREE.Mesh(armGeo, yellowFurMat);
  leftArm.position.set(-0.22, 0.24, 0.08);
  leftArm.rotation.set(-0.35, 0, 0.45);

  const rightArm = new THREE.Mesh(armGeo, yellowFurMat);
  rightArm.position.set(0.22, 0.26, 0.12);
  rightArm.rotation.set(-0.75, 0.2, -0.35);
  npc.bodyPivot.add(leftArm, rightArm);

  const popsicleGroup = new THREE.Group();
  popsicleGroup.position.set(-0.24, 0.28, 0.24);
  popsicleGroup.rotation.set(0.18, 0.15, -0.12);
  const stick = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.08, 0.012),
    new THREE.MeshStandardMaterial({ color: 0xd8b078, roughness: 0.7 })
  );
  const chocoBar = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.038, 0.075, 10, 12),
    new THREE.MeshPhysicalMaterial({ color: 0x4a2616, roughness: 0.38, clearcoat: 0.3 })
  );
  chocoBar.scale.set(1.0, 1.0, 0.55);
  chocoBar.position.y = 0.075;
  popsicleGroup.add(stick, chocoBar);
  npc.bodyPivot.add(popsicleGroup);
}

function buildMiloVillager(npc) {
  const shadow = npc.materialFactory?.createContactShadowDisc
    ? npc.materialFactory.createContactShadowDisc(0.36, 0.34, 0.34)
    : null;
  if (shadow) {
    shadow.position.y = 0.02;
    npc.group.add(shadow);
  }

  const { texture: miloFaceTex } = createProceduralCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#faf6ee';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#c89258';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, 155);
    ctx.quadraticCurveTo(w * 0.62, 195, w * 0.44, 135);
    ctx.quadraticCurveTo(w * 0.24, 185, 0, 150);
    ctx.closePath();
    ctx.fill();

    for (const cx of [122, 390]) {
      ctx.fillStyle = 'rgba(242, 114, 144, 0.85)';
      ctx.beginPath();
      ctx.arc(cx, 306, 32, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const side of [-1, 1]) {
      const ex = 256 + side * 80;
      const ey = 246;
      ctx.fillStyle = '#1b1414';
      ctx.beginPath();
      ctx.arc(ex, ey, 28, 0, Math.PI);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#1b1414';
      ctx.lineWidth = 8.5;
      ctx.beginPath();
      ctx.moveTo(ex - 32, ey);
      ctx.lineTo(ex + 32, ey);
      ctx.stroke();
    }

    ctx.strokeStyle = '#4a2820';
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(240, 302, 16, 0.1 * Math.PI, 0.95 * Math.PI);
    ctx.arc(272, 302, 16, 0.05 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  });

  const creamFurMat = new THREE.MeshPhysicalMaterial({
    color: 0xfaf6ee,
    roughness: 0.62,
    sheen: 0.4,
    sheenColor: new THREE.Color('#ffffff')
  });
  const denimVestMat = new THREE.MeshPhysicalMaterial({
    color: 0x3862a8,
    roughness: 0.68
  });
  const pinkEarMat = new THREE.MeshStandardMaterial({ color: 0xe86b8c, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.34, 20), denimVestMat);
  torso.position.set(0, 0.34, 0);
  torso.castShadow = true;
  npc.bodyPivot.add(torso);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.12, 8, 12), creamFurMat);
    leg.position.set(side * 0.09, 0.11, 0);
    leg.castShadow = true;
    npc.bodyPivot.add(leg);
  }

  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.34, -0.22);
  const tailMain = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 18), creamFurMat);
  tailMain.scale.set(0.78, 1.35, 1.15);
  tailMain.position.set(0, 0.18, -0.08);
  tailMain.rotation.x = -0.35;
  tailMain.castShadow = true;
  tailGroup.add(tailMain);
  npc.bodyPivot.add(tailGroup);

  npc.baseHeadPitch = -0.16;
  npc.headGroup = new THREE.Group();
  npc.headGroup.position.set(0, 0.72, 0.02);
  npc.headGroup.rotation.x = npc.baseHeadPitch;
  npc.bodyPivot.add(npc.headGroup);

  const headMesh = new THREE.Mesh(createChibiHeadGeometry(0.34), creamFurMat);
  headMesh.castShadow = true;
  npc.headGroup.add(headMesh);

  const facePatch = new THREE.Mesh(
    createConformingFacePatchGeometry(0.342, 1.48, 1.18),
    new THREE.MeshBasicMaterial({ map: miloFaceTex, transparent: true, depthWrite: false })
  );
  npc.headGroup.add(facePatch);

  npc.leftEarPivot = new THREE.Group();
  npc.leftEarPivot.position.set(-0.24, 0.25, 0);
  npc.rightEarPivot = new THREE.Group();
  npc.rightEarPivot.position.set(0.24, 0.25, 0);
  npc.headGroup.add(npc.leftEarPivot, npc.rightEarPivot);

  for (const earPivot of [npc.leftEarPivot, npc.rightEarPivot]) {
    const earOuter = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.20, 14), creamFurMat);
    earOuter.scale.set(1.0, 1.0, 0.55);
    earOuter.position.y = 0.08;
    const earInner = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.14, 12), pinkEarMat);
    earInner.scale.set(1.0, 1.0, 0.4);
    earInner.position.set(0, 0.07, 0.028);
    earPivot.add(earOuter, earInner);
  }

  const armGeo = new THREE.CapsuleGeometry(0.05, 0.14, 8, 10);
  const leftArm = new THREE.Mesh(armGeo, creamFurMat);
  leftArm.position.set(-0.21, 0.34, 0);
  leftArm.rotation.z = 0.38;
  const rightArm = new THREE.Mesh(armGeo, creamFurMat);
  rightArm.position.set(0.22, 0.44, 0.06);
  rightArm.rotation.set(-0.4, 0, -2.2);
  npc.bodyPivot.add(leftArm, rightArm);
}

// ============================================================================
// AMBIENT CRITTERS (BANDED DRAGONFLY + FLUTTERING BUTTERFLIES)
// ============================================================================

function createDragonflyWingTexture() {
  const { texture } = createProceduralCanvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(225, 242, 245, 0.52)';
    ctx.strokeStyle = 'rgba(28, 36, 28, 0.88)';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.ellipse(w * 0.52, h * 0.5, w * 0.45, h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.5);
    ctx.lineTo(w * 0.95, h * 0.5);
    for (let x = 0.2; x <= 0.85; x += 0.13) {
      ctx.moveTo(w * x, h * 0.18);
      ctx.lineTo(w * (x + 0.04), h * 0.82);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(24, 32, 22, 0.9)';
    ctx.fillRect(w * 0.72, h * 0.22, w * 0.14, h * 0.16);
  });
  return texture;
}

function createButterflyWingTexture(primaryHex = '#fad82c', accentHex = '#221e1d') {
  const { texture } = createProceduralCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = primaryHex;
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 10;

    ctx.beginPath();
    ctx.ellipse(w * 0.52, h * 0.36, w * 0.42, h * 0.28, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(w * 0.46, h * 0.68, w * 0.34, h * 0.24, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.28);
    ctx.lineTo(w * 0.68, h * 0.42);
    ctx.moveTo(w * 0.24, h * 0.58);
    ctx.lineTo(w * 0.62, h * 0.72);
    ctx.stroke();
  });
  return texture;
}

function createBandedDragonfly(anchorX, anchorY, anchorZ) {
  const group = new THREE.Group();
  group.name = 'Critter_BandedDragonfly';
  group.position.set(anchorX, anchorY, anchorZ);

  const bodyRoot = new THREE.Group();
  bodyRoot.rotation.set(0.38, -0.85, 0.28);
  group.add(bodyRoot);

  const thoraxMat = new THREE.MeshStandardMaterial({ color: 0x3a6b2c, roughness: 0.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x1e261a, roughness: 0.45 });
  const bandYellowMat = new THREE.MeshStandardMaterial({ color: 0xe8c838, roughness: 0.45 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), thoraxMat);
  head.position.set(0, 0, 0.14);
  const thorax = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.10, 10, 12), thoraxMat);
  thorax.rotation.x = Math.PI / 2;
  thorax.position.set(0, 0, 0.04);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.015, 0.38, 10), tailMat);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0, -0.18);
  bodyRoot.add(head, thorax, tail);

  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.025, 0.028, 10), bandYellowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0, -0.06 - i * 0.075);
    bodyRoot.add(ring);
  }

  const wingMat = new THREE.MeshBasicMaterial({
    map: createDragonflyWingTexture(),
    transparent: true,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const wingGeo = new THREE.PlaneGeometry(0.28, 0.095);
  wingGeo.translate(0.14, 0, 0);

  const wings = [];
  const wingConfigs = [
    { z: 0.06, side: 1, baseRoll: 0.36, yaw: 0.18 },
    { z: 0.06, side: -1, baseRoll: -0.36, yaw: -0.18 },
    { z: 0.01, side: 1, baseRoll: -0.28, yaw: -0.16 },
    { z: 0.01, side: -1, baseRoll: 0.28, yaw: 0.16 }
  ];

  for (const cfg of wingConfigs) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.02, cfg.z);
    pivot.rotation.y = cfg.side === 1 ? cfg.yaw : Math.PI + cfg.yaw;
    const mesh = new THREE.Mesh(wingGeo, wingMat);
    pivot.add(mesh);
    bodyRoot.add(pivot);
    wings.push({ pivot, side: cfg.side, baseRoll: cfg.baseRoll });
  }

  return {
    id: 'banded_dragonfly',
    name: 'Banded Dragonfly',
    type: 'dragonfly',
    group,
    mesh: group,
    anchor: new THREE.Vector3(anchorX, anchorY, anchorZ),
    lockedForPreset: false,
    update(dt, elapsed) {
      if (!group.visible) return;
      const flutter = Math.sin(elapsed * 42.0) * 0.22;
      for (const w of wings) {
        w.pivot.rotation.z = w.baseRoll + flutter * w.side;
      }
      if (this.lockedForPreset) {
        group.position.set(
          this.anchor.x + Math.sin(elapsed * 2.2) * 0.04,
          this.anchor.y + Math.cos(elapsed * 3.1) * 0.03,
          this.anchor.z
        );
      } else {
        group.position.set(
          this.anchor.x + Math.sin(elapsed * 1.1) * 0.75,
          this.anchor.y + Math.sin(elapsed * 2.6) * 0.12,
          this.anchor.z + Math.sin(elapsed * 2.2) * 0.45
        );
      }
    }
  };
}

function createButterflyCritter(id, anchorX, anchorY, anchorZ, primaryHex, accentHex, phase = 0) {
  const group = new THREE.Group();
  group.name = `Critter_${id}`;
  group.position.set(anchorX, anchorY, anchorZ);

  const wingMat = new THREE.MeshBasicMaterial({
    map: createButterflyWingTexture(primaryHex, accentHex),
    transparent: true,
    alphaTest: 0.05,
    side: THREE.DoubleSide
  });

  const wingGeo = new THREE.PlaneGeometry(0.16, 0.20);
  wingGeo.rotateX(-Math.PI / 2);
  wingGeo.translate(0.08, 0, 0);

  const leftWingPivot = new THREE.Group();
  leftWingPivot.rotation.y = Math.PI;
  leftWingPivot.add(new THREE.Mesh(wingGeo, wingMat));

  const rightWingPivot = new THREE.Group();
  rightWingPivot.add(new THREE.Mesh(wingGeo, wingMat));

  group.add(leftWingPivot, rightWingPivot);

  return {
    id,
    name: 'Tiger Butterfly',
    type: 'butterfly',
    group,
    mesh: group,
    anchor: new THREE.Vector3(anchorX, anchorY, anchorZ),
    phase,
    update(dt, elapsed) {
      if (!group.visible) return;
      const t = elapsed * 1.4 + this.phase;
      const flap = Math.sin(elapsed * 14.0 + this.phase) * 0.68;
      leftWingPivot.rotation.z = -flap;
      rightWingPivot.rotation.z = flap;

      const nx = this.anchor.x + Math.sin(t) * 0.55;
      const nz = this.anchor.z + Math.sin(t * 2.0) * 0.35;
      const ny = this.anchor.y + Math.sin(elapsed * 3.8 + this.phase) * 0.10;
      const dx = nx - group.position.x;
      const dz = nz - group.position.z;
      if (Math.hypot(dx, dz) > 0.001) {
        group.rotation.y = Math.atan2(dx, dz);
      }
      group.position.set(nx, ny, nz);
    }
  };
}

// ============================================================================
// EXPRESSIVE BEACH PARTY FRIENDS FOR REF_05 ('bridge_plaza')
// ============================================================================

function createBeachFriendFaceTexture(eyeColorHex = '#1a4a9c', happyCrescent = false) {
  const { texture } = createProceduralCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    // Rosy cheek blushes
    for (const cx of [62, 194]) {
      ctx.fillStyle = 'rgba(245, 118, 122, 0.78)';
      ctx.beginPath();
      ctx.ellipse(cx, 156, 22, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Expressive eyes
    for (const side of [-1, 1]) {
      const ex = 128 + side * 42;
      const ey = 122;
      if (happyCrescent) {
        ctx.strokeStyle = '#241612';
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(ex, ey + 6, 16, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else {
        ctx.fillStyle = eyeColorHex;
        ctx.beginPath();
        ctx.ellipse(ex, ey, 17, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0c101c';
        ctx.beginPath();
        ctx.ellipse(ex, ey + 1, 10, 13, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 5, ey - 6, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Smile
    ctx.strokeStyle = '#481d14';
    ctx.lineWidth = 5.0;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(128, 162, 13, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  });
  return texture;
}

function createSimpleBeachFriend(config, materialFactory) {
  const group = new THREE.Group();
  group.position.set(config.x, config.y, config.z);
  group.rotation.y = config.rotY || 0;

  if (materialFactory?.createContactShadowDisc && !config.isSitting) {
    const shadow = materialFactory.createContactShadowDisc(0.36, 0.34, 0.32);
    if (shadow) {
      shadow.position.y = 0.02;
      group.add(shadow);
    }
  }

  const skinMat = new THREE.MeshPhysicalMaterial({ color: config.skinHex, roughness: 0.62 });
  const hairMat = new THREE.MeshPhysicalMaterial({ color: config.hairHex, roughness: 0.4, clearcoat: 0.3 });
  const topMat = new THREE.MeshPhysicalMaterial({ color: config.topHex, roughness: 0.65 });
  const bottomMat = new THREE.MeshStandardMaterial({ color: config.bottomHex, roughness: 0.7 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xeb5e3e, roughness: 0.5 });

  const bodyOffsetY = config.isSitting ? -0.10 : 0.0;

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.38, 20), topMat);
  torso.position.y = 0.44 + bodyOffsetY;
  torso.castShadow = true;
  group.add(torso);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.16, 8, 12), bottomMat);
    if (config.isSitting) {
      leg.position.set(side * 0.095, 0.20, 0.18);
      leg.rotation.x = -Math.PI * 0.46;
    } else {
      leg.position.set(side * 0.095, 0.16, 0);
    }
    leg.castShadow = true;
    group.add(leg);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.16, 8, 12), skinMat);
    arm.position.set(side * 0.22, 0.46 + bodyOffsetY, 0.02);
    arm.rotation.z = side * -0.48;
    arm.castShadow = true;
    group.add(arm);
  }

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.86 + bodyOffsetY, 0);
  headGroup.rotation.x = -0.16;
  group.add(headGroup);

  const head = new THREE.Mesh(createChibiHeadGeometry(0.36), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const faceTex = createBeachFriendFaceTexture(config.eyeHex || '#1a4a9c', !!config.happyCrescent);
  const facePatch = new THREE.Mesh(
    createConformingFacePatchGeometry(0.362, 1.38, 1.12),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false })
  );
  headGroup.add(facePatch);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.068, 14), noseMat);
  nose.position.set(0, -0.01, 0.375);
  nose.rotation.x = Math.PI * 0.42;
  headGroup.add(nose);

  if (config.hasNoseBandage) {
    const bandage = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.032, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xf7f5eb, roughness: 0.6 })
    );
    bandage.position.set(-0.08, -0.04, 0.37);
    bandage.rotation.z = 0.25;
    headGroup.add(bandage);
  }

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.385, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.54),
    hairMat
  );
  hairCap.position.set(0, 0.03, -0.01);
  hairCap.rotation.x = -0.48;
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  if (config.hasTopBun) {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 14), hairMat);
    bun.position.set(0, 0.40, -0.02);
    headGroup.add(bun);
  }

  return group;
}

// ============================================================================
// MAIN MANAGER: CharactersAndAnimManager
// ============================================================================

export class CharactersAndAnimManager {
  constructor(scene, gridSystem, materialFactory) {
    this.scene = scene;
    this.gridSystem = gridSystem;
    this.materialFactory = materialFactory;

    this.root = new THREE.Group();
    this.root.name = 'CharactersAndAnimRoot';
    if (this.scene && typeof this.scene.add === 'function') {
      this.scene.add(this.root);
    }

    // 1. Chibi Player Avatar
    this.player = new PlayerAvatar(this.gridSystem, this.materialFactory);
    this.root.add(this.player.group);

    // 2. Beloved Argon Valley Villager NPCs
    this.villagers = this._buildVillagers();
    for (const v of this.villagers) {
      this.root.add(v.group);
    }

    // Expressive beach party companions + water-level fishing bobber for ref_05 ('bridge_plaza')
    this.beachFriendsGroup = this._buildBeachPartyFriends();
    this.beachFriendsGroup.visible = false;
    this.root.add(this.beachFriendsGroup);

    // 3. Ambient Critters (Banded Dragonfly + 4 Fluttering Butterflies)
    this.critters = this._buildCritters();
    for (const c of this.critters) {
      this.root.add(c.group);
    }

    // 4. Apply curved-horizon vertex deformation & curved shadow depth materials across all character meshes
    applyWorldCurveToHierarchy(this.root);

    this.currentPreset = 'free_roam';
    this.setScenePosePreset('free_roam');
  }

  _getGroundY(x, z, fallbackY = 0.6) {
    if (this.gridSystem && typeof this.gridSystem.getTerrainHeight === 'function') {
      const h = this.gridSystem.getTerrainHeight(x, z);
      if (Number.isFinite(h)) return h;
    }
    return fallbackY;
  }

  _buildVillagers() {
    // 1. Barnaby the Chubby Golden Hamster Villager (ref_02_house_yard.png)
    const barnabyY = this._getGroundY(0.45, -7.25, 0.60);
    const barnaby = new VillagerNPC(
      {
        id: 'barnaby',
        name: 'Barnaby',
        species: 'hamster',
        personality: 'Jock',
        x: 0.45,
        y: barnabyY,
        z: -7.25,
        rotY: -0.35,
        baseHeadPitch: -0.24,
        builderFn: buildBarnabyVillager,
        dialogueLines: [
          'Hey there, hammie! Nothing builds bicep power like watering every single tulip in the yard!',
          'Did you see your new dirt path? That trowel footwork is championship-tier cardio, hammie!',
          'Once these red and yellow tulips bloom, our island is gonna win the gold medal in coziness!'
        ],
        giftLines: [
          'WHOA, a fresh island fruit for post-workout protein?! Thanks, hammie! Take these 300 Coins!'
        ]
      },
      this.materialFactory
    );

    // 2. Clover the Peppy Rabbit Villager (ref_03_flower_garden_river.jpg)
    const cloverY = this._getGroundY(-5.1, -1.65, 0.60);
    const clover = new VillagerNPC(
      {
        id: 'clover',
        name: 'Clover',
        species: 'rabbit',
        personality: 'Peppy',
        x: -5.1,
        y: cloverY,
        z: -1.65,
        rotY: 0.42,
        baseHeadPitch: -0.18,
        builderFn: buildCloverVillager,
        dialogueLines: [
          'Tee-hee! Sitting by the sparkly river with a chocolate popsicle is peak island superstar life!',
          'Your purple chevron garden dress is SO fab! Those tulips practically glow when you water them!',
          'Listen to the waterfall babbling up north—it sounds like our very own pop concert, tee-hee!'
        ],
        giftLines: [
          'OMG tee-hee!! A glossy island fruit for me?! You are officially my #1 bestie! Here is 300 Coins!'
        ]
      },
      this.materialFactory
    );

    // 3. Milo the Smug Squirrel Villager (ref_05_beach_bridge_villagers.png)
    const miloY = this._getGroundY(3.5, 17.5, 0.35);
    const milo = new VillagerNPC(
      {
        id: 'milo',
        name: 'Milo',
        species: 'squirrel',
        personality: 'Smug',
        x: 3.5,
        y: miloY,
        z: 17.5,
        rotY: 0.15,
        baseHeadPitch: -0.16,
        builderFn: buildMiloVillager,
        dialogueLines: [
          'Sulky! Between the stone arch bridge and the ocean breeze, this shoreline has impeccable taste.',
          'Care for a freshly brewed espresso by the campfire later? Only the finest beans on this island.',
          'That fishing cast over the river mouth looked effortlessly cinematic, my friend. Sulky!'
        ],
        giftLines: [
          'Magnifique, sulky! Artisan orchard fruit pairs exquisitely with my espresso. Please accept 300 Coins!'
        ]
      },
      this.materialFactory
    );

    return [barnaby, clover, milo];
  }

  _buildBeachPartyFriends() {
    const group = new THREE.Group();
    group.name = 'BeachPartyFriends_Ref05';

    // Spread across the sandy beach point matching ref_05_beach_bridge_villagers.png
    const specs = [
      {
        x: 2.6,
        y: this._getGroundY(2.6, 19.2, 0.28),
        z: 19.2,
        rotY: 0.12,
        skinHex: 0xf5c3a6,
        hairHex: 0x623a28,
        topHex: 0xfad838,
        bottomHex: 0x3882d8,
        eyeHex: '#1a4a9c',
        hasTopBun: false,
        isSitting: false
      },
      {
        // Seated ON TOP of the horizontal beach log bench at (4.2, 18.18) (+0.38m bench seat height!)
        x: 4.2,
        y: this._getGroundY(4.2, 18.18, 0.35) + 0.38,
        z: 18.18,
        rotY: 0.05,
        skinHex: 0xd99b72,
        hairHex: 0xd8d6d2,
        topHex: 0xd92b2b,
        bottomHex: 0xd92b2b,
        eyeHex: '#241814',
        happyCrescent: true,
        hasTopBun: false,
        isSitting: true
      },
      {
        // Foreground beach character in white tee & blue shorts with nose bandage near surf edge (ref_05)
        x: 4.8,
        y: this._getGroundY(4.8, 19.85, 0.18),
        z: 19.85,
        rotY: 0.06,
        skinHex: 0x8c583a,
        hairHex: 0x454042,
        topHex: 0xf6f8fc,
        bottomHex: 0x3882d8,
        eyeHex: '#1f1410',
        hasNoseBandage: true,
        hasTopBun: false,
        isSitting: false
      },
      {
        x: 5.4,
        y: this._getGroundY(5.4, 18.5, 0.35),
        z: 18.5,
        rotY: -0.08,
        skinHex: 0xffcfb3,
        hairHex: 0x2ec4a2,
        topHex: 0xd99a5b,
        bottomHex: 0xf5d84c,
        eyeHex: '#1e6e5c',
        hasTopBun: true,
        isSitting: false
      },
      {
        x: 6.6,
        y: this._getGroundY(6.6, 18.6, 0.32),
        z: 18.6,
        rotY: -0.18,
        skinHex: 0x855238,
        hairHex: 0x26853c,
        topHex: 0xf2c824,
        bottomHex: 0x323642,
        eyeHex: '#241612',
        hasTopBun: false,
        isSitting: false
      }
    ];
    for (const s of specs) {
      group.add(createSimpleBeachFriend(s, this.materialFactory));
    }

    // Water-level red-and-white fishing bobber + concentric white ripple rings at (9.5, 0.18, 20.1) for ref_05
    const waterBobber = new THREE.Group();
    waterBobber.position.set(9.5, 0.18, 20.1);
    const bobRed = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xe62e2d, roughness: 0.3 })
    );
    const bobWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88
    });
    const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.16, 24), ringMat);
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = 0.01;
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.20, 0.24, 24), ringMat);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.01;
    waterBobber.add(bobRed, bobWhite, ring1, ring2);
    group.add(waterBobber);

    return group;
  }

  _buildCritters() {
    const dragonfly = createBandedDragonfly(0.85, 1.85, 19.3);
    dragonfly.speciesName = 'Banded Dragonfly';
    dragonfly.bellValue = 4500;
    dragonfly.icon = '蜻';

    const bf1 = createButterflyCritter('butterfly_river_stool', -6.3, 1.05, -2.0, '#f7d82a', '#1f1c18', 0.0);
    bf1.speciesName = 'Tiger Butterfly';
    bf1.bellValue = 240;
    bf1.icon = '🦋';

    const bf2 = createButterflyCritter('butterfly_tulips', -2.8, 1.25, -1.5, '#fae03c', '#24201c', 1.7);
    bf2.speciesName = 'Yellow Butterfly';
    bf2.bellValue = 160;
    bf2.icon = '🦋';

    const bf3 = createButterflyCritter('butterfly_yard', -0.4, 1.28, -7.0, '#ffea52', '#26201c', 3.1);
    bf3.speciesName = 'Yellow Butterfly';
    bf3.bellValue = 160;
    bf3.icon = '🦋';

    const bf4 = createButterflyCritter('butterfly_plaza', 4.2, 1.40, -9.2, '#4ae0eb', '#1b2430', 4.6);
    bf4.speciesName = 'Emperor Butterfly';
    bf4.bellValue = 4000;
    bf4.icon = '🦋';

    return [dragonfly, bf1, bf2, bf3, bf4];
  }

  // --------------------------------------------------------------------------
  // DETERMINISTIC SCENE POSE PRESETS & DEFAULT FREE-ROAM GAMEPLAY
  // --------------------------------------------------------------------------

  setScenePosePreset(presetName) {
    const aliasMap = {
      ref_01: 'beach_sunset',
      ref_02: 'house_yard',
      ref_03: 'flower_river',
      ref_04: 'tent_horizon',
      ref_05: 'bridge_plaza',
      ref_06: 'cliff_waterfall'
    };
    const preset = aliasMap[presetName] || presetName || 'free_roam';
    this.currentPreset = preset;

    this.player.targetPos = null;
    this.player.manualControlActive = false;
    this.player.seatedOn = null;

    const dragonfly = this.critters[0];
    const [barnaby, clover, milo] = this.villagers;

    // Default clean visibility per preset so off-scene villagers never photobomb deterministic reference shots
    this.beachFriendsGroup.visible = false;
    dragonfly.lockedForPreset = false;
    dragonfly.group.visible = false;
    barnaby.group.visible = false;
    clover.group.visible = false;
    milo.group.visible = false;

    for (let i = 1; i < this.critters.length; i++) {
      this.critters[i].group.visible = false;
    }

    switch (preset) {
      case 'beach_sunset': {
        // ref_01_beach_sunset.png:
        // Player sitting flush on the y = 0.62 log stump top at (0.0, 0.30, 19.5)
        this.player.group.position.set(0.0, 0.30, 19.5);
        this.player.group.rotation.y = 0.0;
        this.player.setOutfit('beach_gingham');
        this.player.setTool('none');
        this.player.setPose('sit');

        dragonfly.group.visible = true;
        dragonfly.anchor.set(0.85, 1.85, 19.3);
        dragonfly.group.position.set(0.85, 1.85, 19.3);
        dragonfly.lockedForPreset = true;
        break;
      }

      case 'house_yard': {
        // ref_02_house_yard.png:
        // Player at (-2.0, 0.60, -6.35) with rotY = 0.62 (three-quarter view showing overalls, yellow boots, mortar board & trowel);
        // Barnaby at (0.45, 0.60, -7.25) watering tulips
        const py = this._getGroundY(-2.0, -6.35, 0.60);
        this.player.group.position.set(-2.0, py, -6.35);
        this.player.group.rotation.y = 0.62;
        this.player.setOutfit('yard_overalls');
        this.player.setTool('trowel');
        this.player.setPose('trowel_pat');

        const hy = this._getGroundY(0.45, -7.25, 0.60);
        barnaby.group.visible = true;
        barnaby.group.position.set(0.45, hy, -7.25);
        barnaby.group.rotation.y = -0.35;
        break;
      }

      case 'flower_river': {
        // ref_03_flower_garden_river.jpg:
        // Player at (-3.2, 0.60, -0.8) watering tulips; Clover seated at (-5.1, 0.60, -1.65); Barnaby hidden!
        const py = this._getGroundY(-3.2, -0.8, 0.60);
        this.player.group.position.set(-3.2, py, -0.8);
        this.player.group.rotation.y = -0.32;
        this.player.setOutfit('garden_dress');
        this.player.setTool('watering_can');
        this.player.setPose('watering');

        const by = this._getGroundY(-5.1, -1.65, 0.60);
        clover.group.visible = true;
        clover.group.position.set(-5.1, by, -1.65);
        clover.group.rotation.y = 0.42;

        // Tiger butterfly beside the riverbank log stool (ref_03)
        this.critters[1].group.visible = true;
        break;
      }

      case 'tent_horizon': {
        // ref_04_yellow_tent_horizon.jpg:
        // Player at (9.6, 0.60, -6.5) beside yellow tent & dropped apples
        const py = this._getGroundY(9.6, -6.5, 0.60);
        this.player.group.position.set(9.6, py, -6.5);
        this.player.group.rotation.y = 0.38;
        this.player.setOutfit('tent_explorer');
        this.player.setTool('none');
        this.player.setPose('idle_happy');
        break;
      }

      case 'bridge_plaza': {
        // ref_05_beach_bridge_villagers.png:
        // Player fishing at (7.8, 0.30, 18.4) casting into river mouth; Milo & beach friends spread across sand
        const py = this._getGroundY(7.8, 18.4, 0.30);
        this.player.group.position.set(7.8, py, 18.4);
        this.player.group.rotation.y = 0.95;
        this.player.setOutfit('beach_gingham');
        this.player.setTool('fishing_rod');
        this.player.setPose('fishing');

        const my = this._getGroundY(3.5, 17.5, 0.35);
        milo.group.visible = true;
        milo.group.position.set(3.5, my, 17.5);
        milo.group.rotation.y = 0.15;
        this.beachFriendsGroup.visible = true;
        break;
      }

      case 'cliff_waterfall': {
        // ref_06_cliff_waterfall.png:
        // Player at (-7.6, 0.60, -8.8) digging with silver shovel beside orange tree & waterfall
        const py = this._getGroundY(-7.6, -8.8, 0.60);
        this.player.group.position.set(-7.6, py, -8.8);
        this.player.group.rotation.y = 0.12;
        this.player.setOutfit('cliff_builder');
        this.player.setTool('shovel');
        this.player.setPose('shovel_dig');
        break;
      }

      default: {
        // 'free_roam' / 'follow_player':
        // Player starts grounded in the central Cottage Yard, ready to walk anywhere on the island!
        const py = this._getGroundY(-2.2, -6.2, 0.60);
        this.player.group.position.set(-2.2, py, -6.2);
        this.player.group.rotation.y = 0.25;
        this.player.setOutfit('yard_overalls');
        this.player.setTool('watering_can');
        this.player.setPose('idle');

        const hy = this._getGroundY(0.45, -7.25, 0.60);
        barnaby.group.visible = true;
        barnaby.group.position.set(0.45, hy, -7.25);
        barnaby.group.rotation.y = -0.35;

        const by = this._getGroundY(-5.1, -1.65, 0.60);
        clover.group.visible = true;
        clover.group.position.set(-5.1, by, -1.65);
        clover.group.rotation.y = 0.42;

        const my = this._getGroundY(3.5, 17.5, 0.35);
        milo.group.visible = true;
        milo.group.position.set(3.5, my, 17.5);
        milo.group.rotation.y = 0.15;

        this.beachFriendsGroup.visible = true;
        dragonfly.group.visible = true;
        dragonfly.lockedForPreset = false;
        dragonfly.anchor.set(0.85, 1.85, 19.3);
        for (const c of this.critters) {
          c.group.visible = true;
          c.caughtTimer = 0;
        }
        break;
      }
    }

    this.player._applyPoseAndLimbAnimation(0, false);
  }

  setScenePreset(presetName) {
    this.setScenePosePreset(presetName);
  }

  setPreset(presetName) {
    this.setScenePosePreset(presetName);
  }

  triggerToolAction() {
    this.player.triggerToolAction();
  }

  cycleOutfit() {
    return this.player.cycleOutfit();
  }

  setOutfit(outfitName) {
    this.player.setOutfit(outfitName);
  }

  setTool(toolName) {
    this.player.setTool(toolName);
  }

  cycleTool() {
    return this.player.cycleTool();
  }

  getClosestVillager(x, z, maxDist = 2.8, fallbackToFirst = false) {
    let qx = x;
    let qz = z;
    if (x && typeof x === 'object' && Number.isFinite(x.x)) {
      qx = x.x;
      qz = x.z;
    } else if (!Number.isFinite(qx) || !Number.isFinite(qz)) {
      qx = this.player.group.position.x;
      qz = this.player.group.position.z;
    }

    let closest = null;
    let bestDist = maxDist;
    for (const v of this.villagers) {
      if (!v.group.visible) continue;
      const d = Math.hypot(v.group.position.x - qx, v.group.position.z - qz);
      if (d <= bestDist) {
        bestDist = d;
        closest = v;
      }
    }
    return closest || (fallbackToFirst ? this.villagers[0] : null);
  }

  getClosestCritter(x, z, maxDist = 2.5) {
    let best = null;
    let bestDist = maxDist;
    for (const c of this.critters) {
      if (!c.group.visible || c.caughtTimer > 0) continue;
      const d = Math.hypot(c.group.position.x - x, c.group.position.z - z);
      if (d <= bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  catchNearestCritter(x, z, maxDist = 2.5) {
    const critter = this.getClosestCritter(x, z, maxDist);
    if (!critter) return { caught: false };
    const pos = critter.group.position.clone();
    critter.group.visible = false;
    critter.caughtTimer = 16.0;
    return {
      caught: true,
      critter,
      speciesName: critter.speciesName || 'Yellow Butterfly',
      bellValue: critter.bellValue || 200,
      position: pos
    };
  }

  update(dt, elapsed) {
    const safeElapsed = Number.isFinite(elapsed) ? elapsed : performance.now() * 0.001;
    this.player.update(dt, safeElapsed);

    const playerPos = this.player.group.position;
    for (const v of this.villagers) {
      v.update(dt, safeElapsed, playerPos);
    }
    for (const c of this.critters) {
      if (c.caughtTimer && c.caughtTimer > 0) {
        c.caughtTimer -= dt;
        if (c.caughtTimer <= 0) {
          c.caughtTimer = 0;
          if (this.currentPreset === 'free_roam' || this.currentPreset === 'follow_player') {
            c.group.visible = true;
          }
        }
        continue;
      }
      c.update(dt, safeElapsed);
    }
  }
}
