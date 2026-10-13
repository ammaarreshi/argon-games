import * as THREE from 'three';

/**
 * FlightRenderEngine — Three.js Orthographic 2.5D Render Engine, Shaders & 1950s Argon Airways UI
 * for Argon Airspace remake.
 *
 * World Coordinate System:
 *   OrthographicCamera(-480, 480, 320, -320, 0.1, 500) at (0, 0, 200) looking at (0, 0, 0).
 *   X in [-480, +480] (width 960), Y in [-320, +320] (height 640).
 */

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 640;
const HALF_W = 480;
const HALF_H = 320;

function setSRGB(texture) {
  if (!texture) return texture;
  if ('colorSpace' in texture && THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else if ('encoding' in texture && THREE.sRGBEncoding) {
    texture.encoding = THREE.sRGBEncoding;
  }
  return texture;
}

function resolveAssetUrl(relPath) {
  if (typeof window !== 'undefined' && window.__FC_INLINE_TEXTURES__) {
    const inline = window.__FC_INLINE_TEXTURES__[relPath] ||
      window.__FC_INLINE_TEXTURES__[relPath.replace(/^\.\//, '')];
    if (inline) return inline;
  }
  return relPath;
}

function hexToCss(hex, fallback = '#ff3b30') {
  if (typeof hex === 'string') return hex;
  if (typeof hex === 'number' && Number.isFinite(hex)) {
    return '#' + (hex & 0xffffff).toString(16).padStart(6, '0');
  }
  return fallback;
}

export class FlightRenderEngine {
  constructor(options = {}) {
    const opts = (typeof Element !== 'undefined' && options instanceof Element)
      ? (options.tagName === 'CANVAS' ? { canvas: options } : { container: options })
      : (options || {});

    this.options = opts;
    this.callbacks = {
      onSelectMap: opts.onSelectMap || null,
      onToggleFastForward: opts.onToggleFastForward || null,
      onTogglePause: opts.onTogglePause || null,
      onToggleMute: opts.onToggleMute || null,
      onRestartGame: opts.onRestartGame || null,
      onResumeGame: opts.onResumeGame || null,
      onTriggerRushWave: opts.onTriggerRushWave || null,
    };

    this.time = 0;
    this.shakeTimer = 0;
    this.shakeDuration = 0.45;
    this.shakeIntensity = 0;

    this.currentMapDef = null;
    this.currentMapId = 'classic_outback';
    this.fastForwardActive = false;
    this.isPaused = false;
    this.isMuted = false;
    this.lastLandedDigits = '00000';
    this.lastHighDigits = '00000';

    // Three.js Scene & Orthographic Camera
    this.scene = opts.scene || new THREE.Scene();
    this.scene.background = new THREE.Color(0x2d4c2b);

    this.camera = opts.camera || new THREE.OrthographicCamera(
      -HALF_W,
      HALF_W,
      HALF_H,
      -HALF_H,
      0.1,
      500
    );
    this.camera.position.set(0, 0, 200);
    this.camera.lookAt(0, 0, 0);

    // Ensure DOM bezel & canvas structure exists
    this._initDOMStructure(opts);

    // WebGLRenderer
    this.renderer = opts.renderer || new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    if ('outputColorSpace' in this.renderer && THREE.SRGBColorSpace) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ('outputEncoding' in this.renderer && THREE.sRGBEncoding) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.domElement = this.renderer.domElement;

    // Texture Loader & caches
    this.textureLoader = new THREE.TextureLoader();
    this.loadedImages = new Map();
    this.aircraftTextures = new Map();
    this.aircraftShadowTextures = new Map();
    this.propBlurTexture = this._createPropBlurTexture();
    this.rotorBlurTexture = this._createRotorBlurTexture();
    this.windsockTexture = this._createWindsockTexture();
    this.warningBadgeTexture = this._createWarningBadgeBaseTexture();
    this.selectionRingTexture = this._createSelectionRingTexture();
    this.hazardRingMaterial = this._createHazardRingShaderMaterial();
    this.waterShaderMaterial = this._createWaterSurfaceShaderMaterial();

    // Layered Z-ordered groups
    this.mapGroup = new THREE.Group();
    this.mapGroup.name = 'MapLayer';
    this.scene.add(this.mapGroup);

    this.shadowGroup = new THREE.Group();
    this.shadowGroup.name = 'AircraftShadows';
    this.scene.add(this.shadowGroup);

    this.pathLayerGroup = new THREE.Group();
    this.pathLayerGroup.name = 'FlightPathsHost';
    this.scene.add(this.pathLayerGroup);

    this.selectionGroup = new THREE.Group();
    this.selectionGroup.name = 'SelectionBeacons';
    this.scene.add(this.selectionGroup);

    this.hazardGroup = new THREE.Group();
    this.hazardGroup.name = 'ProximityHazardRings';
    this.scene.add(this.hazardGroup);

    this.aircraftGroup = new THREE.Group();
    this.aircraftGroup.name = 'AircraftBodies';
    this.scene.add(this.aircraftGroup);

    this.perimeterGroup = new THREE.Group();
    this.perimeterGroup.name = 'PerimeterWarnings';
    this.scene.add(this.perimeterGroup);

    this.vfxGroup = new THREE.Group();
    this.vfxGroup.name = 'CrashVFX';
    this.scene.add(this.vfxGroup);

    this.floaterGroup = new THREE.Group();
    this.floaterGroup.name = 'PraiseFloaters';
    this.scene.add(this.floaterGroup);

    // State maps for active entities
    this.aircraftRigs = new Map();
    this.perimeterBadges = new Map();
    this.activeExplosions = [];
    this.activeFloaters = [];
    this.runwayStrobeGroups = [];
    this.runwayWarningMeshes = new Map();
    this.waterRippleMeshes = [];
    this.windsockRig = null;

    // Pre-build high-DPI aircraft textures & preload Nano Banana PNGs
    this._preloadAircraftTextures();

    // Responsive resize listener
    this._onResizeBound = () => this.resize();
    window.addEventListener('resize', this._onResizeBound);
    this.resize();
  }

  setCallbacks(cb = {}) {
    Object.assign(this.callbacks, cb);
  }

  attachPathGroup(pathGroup) {
    if (!pathGroup) return;
    if (pathGroup.parent && pathGroup.parent !== this.pathLayerGroup) {
      pathGroup.parent.remove(pathGroup);
    }
    this.pathLayerGroup.add(pathGroup);
  }

  // ===========================================================================
  // 1. ZERO-DISTORTION ORTHOGRAPHIC AIRFIELD & 2.5D TERRAIN (buildMapScene)
  // ===========================================================================

  setMap(mapDefOrId) {
    return this.buildMapScene(mapDefOrId);
  }

  loadMap(mapDefOrId) {
    return this.buildMapScene(mapDefOrId);
  }

  buildMapScene(mapDefOrId) {
    let mapDef = mapDefOrId;
    if (typeof mapDefOrId === 'string') {
      const globalMaps = (typeof window !== 'undefined' && window.MAP_DEFINITIONS) || {};
      mapDef = globalMaps[mapDefOrId] || this._getFallbackMapDef(mapDefOrId);
    }
    if (!mapDef) {
      mapDef = this._getFallbackMapDef('classic_outback');
    }

    this.currentMapDef = mapDef;
    this.currentMapId = mapDef.id || 'classic_outback';
    this._updateActiveMapPillUI(this.currentMapId);

    // Clear previous map meshes
    while (this.mapGroup.children.length > 0) {
      const child = this.mapGroup.children.pop();
      this.mapGroup.remove(child);
    }
    while (this.floaterGroup && this.floaterGroup.children.length > 0) {
      const child = this.floaterGroup.children.pop();
      this.floaterGroup.remove(child);
    }
    while (this.vfxGroup && this.vfxGroup.children.length > 0) {
      const child = this.vfxGroup.children.pop();
      this.vfxGroup.remove(child);
    }
    this.activeFloaters = [];
    this.activeExplosions = [];
    this.runwayStrobeGroups = [];
    this.runwayWarningMeshes.clear();
    this.waterRippleMeshes = [];
    this.windsockRig = null;

    // Layer 0 (z = 0): 960x640 Ground Terrain Plane with immediate high-res canvas fallback
    // + Nano Banana background texture composite
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 1920;
    groundCanvas.height = 1280;
    this._drawProceduralTerrainCanvas(groundCanvas, mapDef, null);

    const groundTex = setSRGB(new THREE.CanvasTexture(groundCanvas));
    groundTex.minFilter = THREE.LinearFilter;
    groundTex.magFilter = THREE.LinearFilter;

    const groundGeo = new THREE.PlaneGeometry(WORLD_WIDTH + 64, WORLD_HEIGHT + 64);
    const groundMat = new THREE.MeshBasicMaterial({ map: groundTex, depthWrite: false });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, 0, 0);
    groundMesh.name = 'TerrainGroundMesh';
    this.mapGroup.add(groundMesh);

    // Layer 0.5 (z = 0.14): Real-Time Animated WebGL Water & Shoreline Surf Overlay
    // Replaces static painted water & static shoreline foam with living Gerstner waves,
    // animated dual-layer underwater caustics, rolling shoreline surf, and aircraft wakes!
    const waterMaskCanvas = document.createElement('canvas');
    waterMaskCanvas.width = 480;
    waterMaskCanvas.height = 320;
    this._updateWaterMaskCanvas(waterMaskCanvas, groundCanvas, mapDef);

    const waterMaskTex = new THREE.CanvasTexture(waterMaskCanvas);
    waterMaskTex.minFilter = THREE.LinearFilter;
    waterMaskTex.magFilter = THREE.LinearFilter;
    waterMaskTex.wrapS = THREE.ClampToEdgeWrapping;
    waterMaskTex.wrapT = THREE.ClampToEdgeWrapping;

    if (this.waterShaderMaterial && this.waterShaderMaterial.uniforms) {
      this.waterShaderMaterial.uniforms.uGroundTex.value = groundTex;
      this.waterShaderMaterial.uniforms.uWaterMask.value = waterMaskTex;
      this.waterShaderMaterial.uniforms.uMapMode.value =
        this.currentMapId === 'tropical_island' ? 1.0 : (this.currentMapId === 'alpine_winter' ? 2.0 : 0.0);
    }

    const waterSurfaceMesh = new THREE.Mesh(groundGeo, this.waterShaderMaterial);
    waterSurfaceMesh.position.set(0, 0, 0.14);
    waterSurfaceMesh.name = 'AnimatedWaterSurfaceMesh';
    this.mapGroup.add(waterSurfaceMesh);

    // Load Nano Banana background texture (.png or .jpg) and composite onto groundTex + waterMaskTex
    const texStem = mapDef.textureKey || `map_${this.currentMapId}`;
    const targetMapId = this.currentMapId;
    this._loadNanoBananaImage(
      [`./assets/textures/${texStem}.png`, `./assets/textures/${texStem}.jpg`],
      (img) => {
        if (this.currentMapId !== targetMapId) return;
        this._drawProceduralTerrainCanvas(groundCanvas, mapDef, img);
        groundTex.needsUpdate = true;
        this._updateWaterMaskCanvas(waterMaskCanvas, groundCanvas, mapDef);
        waterMaskTex.needsUpdate = true;
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      }
    );

    // Layer 1 (z = 0.25): Connected Argon Checkerboard Concrete Apron Slab + Perimeter Trees/Props
    const apronCanvas = document.createElement('canvas');
    apronCanvas.width = 1920;
    apronCanvas.height = 1280;
    this._drawAirfieldApronAndFoliageCanvas(apronCanvas, mapDef);

    const apronTex = setSRGB(new THREE.CanvasTexture(apronCanvas));
    apronTex.minFilter = THREE.LinearFilter;
    apronTex.magFilter = THREE.LinearFilter;
    const apronMat = new THREE.MeshBasicMaterial({
      map: apronTex,
      transparent: true,
      depthWrite: false,
    });
    const apronMesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_HEIGHT), apronMat);
    apronMesh.position.set(0, 0, 0.25);
    apronMesh.name = 'AirfieldApronOverlay';
    this.mapGroup.add(apronMesh);

    // Layer 2 (z = 0.45 .. 0.85): Individual Runways, Threshold Strobes & Helipads
    const runways = Array.isArray(mapDef.runways) ? mapDef.runways : [];
    for (const rwy of runways) {
      if (rwy.isHelipad) {
        this._buildHelipadMesh(rwy);
      } else if (rwy.isWaterRunway) {
        this._buildWaterChannelRunway(rwy);
      } else {
        this._buildPavedRunwayMesh(rwy);
      }
    }

    // Layer 3 (z = 0.90 .. 1.25): 3D Low-Poly Airfield Control Tower & Corrugated Hangars
    this._buildAirfieldBuildings(mapDef);

    // Layer 4 (z = 0.95 .. 1.35): Center Circular Windsock Pad & Animated 3D Windsock
    const wsPos = mapDef.windsockPos || { x: 0, y: 5 };
    this._buildAnimatedWindsock(wsPos.x, wsPos.y);
  }

  _drawProceduralTerrainCanvas(canvas, mapDef, nanoBananaImg) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const mapId = mapDef.id || 'classic_outback';

    const w2cX = (wx) => ((wx + HALF_W) / WORLD_WIDTH) * w;
    const w2cY = (wy) => ((HALF_H - wy) / WORLD_HEIGHT) * h;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Once the pre-generated Nano Banana map texture loads, render it at 100% full-bleed fidelity!
    if (nanoBananaImg) {
      ctx.drawImage(nanoBananaImg, 0, 0, w, h);
      ctx.restore();
      return;
    }

    if (mapId === 'tropical_island') {
      // Base lush tropical turf on left, golden beach down middle, turquoise ocean on right
      const oceanGrad = ctx.createLinearGradient(w * 0.35, 0, w, h);
      oceanGrad.addColorStop(0, '#3be2f5');
      oceanGrad.addColorStop(0.55, '#26c8ec');
      oceanGrad.addColorStop(1, '#18a8d8');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, w, h);

      if (nanoBananaImg) {
        ctx.save();
        ctx.globalAlpha = 0.58;
        ctx.drawImage(nanoBananaImg, 0, 0, w, h);
        ctx.restore();
      }

      // Stylized ocean wave swirls on right
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 28;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const cx = w * (0.62 + (i % 2) * 0.18);
        const cy = h * (0.18 + i * 0.14);
        ctx.beginPath();
        ctx.arc(cx, cy, 78 + (i % 3) * 18, 0.2, Math.PI * 1.45);
        ctx.stroke();
      }
      ctx.restore();

      // Golden sandy beach shoreline curve (matching Screenshot 2)
      const drawIslandShape = (offsetR) => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w * 0.46 + offsetR, 0);
        ctx.bezierCurveTo(
          w * 0.46 + offsetR, h * 0.32,
          w * 0.62 + offsetR, h * 0.44,
          w * 0.86 + offsetR, h * 0.54
        );
        ctx.bezierCurveTo(
          w * 0.96 + offsetR, h * 0.60,
          w * 0.92 + offsetR, h * 0.78,
          w * 0.74 + offsetR, h * 0.85
        );
        ctx.bezierCurveTo(
          w * 0.68 + offsetR, h * 0.88,
          w * 0.69 + offsetR, h * 0.95,
          w * 0.72 + offsetR, h
        );
        ctx.lineTo(0, h);
        ctx.closePath();
      };

      // Shallow turquoise reef glow
      drawIslandShape(34);
      ctx.fillStyle = 'rgba(130, 248, 255, 0.55)';
      ctx.fill();

      // Golden sandy beach border
      drawIslandShape(0);
      ctx.fillStyle = '#fae79c';
      ctx.fill();

      // Inner green island turf
      drawIslandShape(-44);
      ctx.fillStyle = '#73c64a';
      ctx.fill();

      // Diamond-mowed grass pattern clipped to island turf
      ctx.save();
      drawIslandShape(-46);
      ctx.clip();
      if (nanoBananaImg) {
        ctx.globalAlpha = 0.26;
        ctx.drawImage(nanoBananaImg, 0, 0, w, h);
        ctx.globalAlpha = 1.0;
      }
      this._drawDiamondMowedPattern(ctx, w, h, 'rgba(92, 178, 52, 0.34)', 'rgba(138, 218, 92, 0.20)');
      ctx.restore();
    } else if (mapId === 'alpine_winter') {
      // Crisp powder snowdrifts & icy alpine meadow
      const snowGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 80, w * 0.5, h * 0.5, w * 0.72);
      snowGrad.addColorStop(0, '#eef6fb');
      snowGrad.addColorStop(0.65, '#d9eaf5');
      snowGrad.addColorStop(1, '#bdd6e8');
      ctx.fillStyle = snowGrad;
      ctx.fillRect(0, 0, w, h);

      if (nanoBananaImg) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.drawImage(nanoBananaImg, 0, 0, w, h);
        ctx.restore();
      }

      this._drawDiamondMowedPattern(ctx, w, h, 'rgba(175, 206, 228, 0.28)', 'rgba(255, 255, 255, 0.34)');

      // Glacial stream channels in bottom-left & bottom-right corners matching map_alpine_winter.png
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(w2cX(-490), w2cY(-225));
      ctx.quadraticCurveTo(w2cX(-380), w2cY(-275), w2cX(-265), w2cY(-335));
      ctx.moveTo(w2cX(235), w2cY(-335));
      ctx.quadraticCurveTo(w2cX(365), w2cY(-275), w2cX(490), w2cY(-215));
      ctx.lineWidth = 84;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.lineWidth = 64;
      ctx.strokeStyle = '#29b6d8';
      ctx.stroke();
      ctx.restore();
    } else {
      // Map 1: classic_outback — Argon Classic Grass & Outback Airfield (Screenshot 1 & 4)
      const grassGrad = ctx.createRadialGradient(w * 0.5, h * 0.48, 90, w * 0.5, h * 0.5, w * 0.72);
      grassGrad.addColorStop(0, '#62a86c');
      grassGrad.addColorStop(0.62, '#53995e');
      grassGrad.addColorStop(1, '#468851');
      ctx.fillStyle = grassGrad;
      ctx.fillRect(0, 0, w, h);

      // Blend Nano Banana terrain texture so authentic pre-generated texture detail enriches the grass
      if (nanoBananaImg) {
        ctx.save();
        ctx.globalAlpha = 0.44;
        ctx.drawImage(nanoBananaImg, 0, 0, w, h);
        ctx.restore();
      }

      // Organic lighter/darker turf patches like Screenshot 1
      ctx.save();
      ctx.fillStyle = 'rgba(116, 184, 118, 0.32)';
      ctx.beginPath();
      ctx.ellipse(w * 0.50, h * 0.48, w * 0.36, h * 0.34, -0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(62, 128, 74, 0.28)';
      ctx.beginPath();
      ctx.ellipse(w * 0.14, h * 0.25, w * 0.18, h * 0.28, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.86, h * 0.28, w * 0.16, h * 0.25, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Signature Argon diamond-mowed checkerboard grass pattern + fine stipple grain
      this._drawDiamondMowedPattern(ctx, w, h, 'rgba(66, 134, 76, 0.28)', 'rgba(118, 188, 118, 0.22)');

      // Winding turquoise rivers with frothy white foam banks at bottom-left and bottom-right (Screenshot 1)
      const drawRiver = (pts) => {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(w2cX(pts[0][0]), w2cY(pts[0][1]));
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(w2cX(pts[i][0]), w2cY(pts[i][1]));
        }
        // Outer subtle wet bank shadow
        ctx.lineWidth = 148;
        ctx.strokeStyle = 'rgba(42, 92, 54, 0.38)';
        ctx.stroke();
        // Thick frothy white shoreline foam
        ctx.lineWidth = 136;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        // Turquoise river water core
        ctx.lineWidth = 92;
        ctx.strokeStyle = '#3ec6e0';
        ctx.stroke();
        // Inner lighter aqua current highlight
        ctx.lineWidth = 38;
        ctx.strokeStyle = '#62daf0';
        ctx.stroke();
        ctx.restore();
      };

      drawRiver([
        [-500, -142],
        [-415, -182],
        [-340, -238],
        [-255, -285],
        [-180, -340],
      ]);
      drawRiver([
        [150, -340],
        [240, -275],
        [335, -210],
        [425, -152],
        [505, -120],
      ]);
    }

    // Subtle decorative edge swirls (like Screenshot 2 & 4 corners)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(w * 0.06, h * 0.86, 68, -0.5, Math.PI * 1.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.94, h * 0.14, 62, 0.5, Math.PI * 1.75);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  _drawDiamondMowedPattern(ctx, w, h, darkColor, lightColor) {
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.rotate(0.42);
    const tile = 130;
    const cols = Math.ceil((w * 1.5) / tile);
    const rows = Math.ceil((h * 1.5) / tile);
    for (let r = -rows; r <= rows; r++) {
      for (let c = -cols; c <= cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? darkColor : lightColor;
        ctx.fillRect(c * tile, r * tile, tile, tile);
      }
    }
    ctx.restore();
  }

  _drawAirfieldApronAndFoliageCanvas(canvas, mapDef) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const mapId = mapDef.id || 'classic_outback';
    const scale = w / WORLD_WIDTH; // 2.0 px per world unit

    const w2cX = (wx) => ((wx + HALF_W) / WORLD_WIDTH) * w;
    const w2cY = (wy) => ((HALF_H - wy) / WORLD_HEIGHT) * h;

    ctx.clearRect(0, 0, w, h);

    // Create subtle cream/tan concrete checkerboard pattern (matching Screenshot 1 & 4)
    const patCanvas = document.createElement('canvas');
    patCanvas.width = 48;
    patCanvas.height = 48;
    const pctx = patCanvas.getContext('2d');
    pctx.fillStyle = '#e8dcc4';
    pctx.fillRect(0, 0, 48, 48);
    pctx.fillStyle = '#dfd1b5';
    pctx.fillRect(0, 0, 24, 24);
    pctx.fillRect(24, 24, 24, 24);
    const apronPattern = ctx.createPattern(patCanvas, 'repeat');

    const runways = Array.isArray(mapDef.runways) ? mapDef.runways : [];
    const wsPos = mapDef.windsockPos || { x: 0, y: 5 };

    // Helper that fills each connected concrete apron pad & runway collar individually
    // so overlapping shapes union cleanly without nonzero winding cutout holes!
    const fillApronShapes = (expandPx = 0) => {
      // 1. Linear runway concrete collars & helipad pads
      for (const rwy of runways) {
        if (rwy.isHelipad) {
          const hx = w2cX(rwy.thresholdX);
          const hy = w2cY(rwy.thresholdY);
          const padHalf = 37 * scale + expandPx;
          ctx.beginPath();
          this._traceRoundedRect(ctx, hx - padHalf, hy - padHalf, padHalf * 2, padHalf * 2, 16 * scale + expandPx);
          ctx.fill();
        } else if (!rwy.isWaterRunway) {
          ctx.beginPath();
          this._traceOrientedRunwayCollar(
            ctx,
            w2cX(rwy.thresholdX),
            w2cY(rwy.thresholdY),
            w2cX(rwy.endX),
            w2cY(rwy.endY),
            ((rwy.width || 30) * 0.5 + 11) * scale + expandPx,
            18 * scale + expandPx,
            12 * scale + expandPx
          );
          ctx.fill();
        }
      }

      // 2. Map-specific connected apron plazas & secondary taxiway stubs (matching Screenshots 1, 2, 4)
      if (mapId === 'classic_outback') {
        // Upper-west horizontal stub runway/taxiway + control tower apron plaza (Screenshot 1)
        ctx.beginPath();
        this._traceRoundedRect(
          ctx,
          w2cX(-225) - expandPx,
          w2cY(118) - expandPx,
          (235 * scale) + expandPx * 2,
          (42 * scale) + expandPx * 2,
          14 * scale + expandPx
        );
        ctx.fill();

        ctx.beginPath();
        this._traceRoundedRect(
          ctx,
          w2cX(-160) - expandPx,
          w2cY(174) - expandPx,
          (176 * scale) + expandPx * 2,
          (68 * scale) + expandPx * 2,
          18 * scale + expandPx
        );
        ctx.fill();

        // Bottom hangar apron block under yellow runway
        ctx.beginPath();
        this._traceRoundedRect(
          ctx,
          w2cX(-58) - expandPx,
          w2cY(-108) - expandPx,
          (132 * scale) + expandPx * 2,
          (72 * scale) + expandPx * 2,
          16 * scale + expandPx
        );
        ctx.fill();
      } else if (mapId === 'tropical_island') {
        // West mainland apron connecting red & yellow runways + helipad + hangars (Screenshot 2)
        ctx.beginPath();
        this._traceRoundedRect(
          ctx,
          w2cX(-252) - expandPx,
          w2cY(22) - expandPx,
          (74 * scale) + expandPx * 2,
          (165 * scale) + expandPx * 2,
          18 * scale + expandPx
        );
        ctx.fill();

        // East beachfront apron connecting blue prop runway + island helipad
        ctx.beginPath();
        this._traceRoundedRect(
          ctx,
          w2cX(32) - expandPx,
          w2cY(-6) - expandPx,
          (78 * scale) + expandPx * 2,
          (86 * scale) + expandPx * 2,
          16 * scale + expandPx
        );
        ctx.fill();
      } else if (mapId === 'alpine_winter') {
        // Central alpine apron plaza
        ctx.beginPath();
        this._traceRoundedRect(
          ctx,
          w2cX(-70) - expandPx,
          w2cY(68) - expandPx,
          (140 * scale) + expandPx * 2,
          (95 * scale) + expandPx * 2,
          18 * scale + expandPx
        );
        ctx.fill();
      }

      // 3. Center circular windsock pad
      const wx = w2cX(wsPos.x);
      const wy = w2cY(wsPos.y);
      const wsR = 29 * scale + expandPx;
      ctx.beginPath();
      ctx.arc(wx, wy, wsR, 0, Math.PI * 2);
      ctx.fill();
    };

    // Draw soft dark drop-shadow under entire apron slab via offscreen layer so overlapping shadows don't double-darken
    const shCanvas = document.createElement('canvas');
    shCanvas.width = w;
    shCanvas.height = h;
    const sctx = shCanvas.getContext('2d');
    sctx.fillStyle = '#142016';
    const origCtx = ctx;
    // Draw unioned shapes for shadow, curb, and pattern
    ctx.save();
    ctx.translate(6, 7);
    ctx.fillStyle = 'rgba(20, 32, 22, 0.24)';
    fillApronShapes(4);
    ctx.restore();
    void shCanvas;
    void sctx;
    void origCtx;

    // Draw warm cream outer curb border
    ctx.save();
    ctx.fillStyle = '#f3ead6';
    fillApronShapes(4);
    ctx.restore();

    // Draw inner checkerboard concrete fill
    ctx.save();
    ctx.fillStyle = apronPattern;
    fillApronShapes(0);
    ctx.restore();

    // On classic_outback, also draw the decorative upper-west horizontal crosswind stub strip (Screenshot 1)
    if (mapId === 'classic_outback') {
      this._drawDecorativeStubStrip(ctx, w2cX(-212), w2cY(97), w2cX(-2), w2cY(97), 22 * scale);
    }

    // Scatter tiny white field flower specks on interior grass (preserving 100% of Nano Banana perimeter trees/rivers)
    this._drawPerimeterFoliageAndFlowers(ctx, mapId, w2cX, w2cY, scale);
  }

  _traceRoundedRect(ctx, x, y, w, h, r) {
    const cr = Math.min(r, w * 0.5, h * 0.5);
    ctx.moveTo(x + cr, y);
    ctx.lineTo(x + w - cr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + cr);
    ctx.lineTo(x + w, y + h - cr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - cr, y + h);
    ctx.lineTo(x + cr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - cr);
    ctx.lineTo(x, y + cr);
    ctx.quadraticCurveTo(x, y, x + cr, y);
  }

  _traceOrientedRunwayCollar(ctx, x1, y1, x2, y2, halfWidth, padEnds, cornerR) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const sx = x1 - ux * padEnds;
    const sy = y1 - uy * padEnds;
    const ex = x2 + ux * padEnds;
    const ey = y2 + uy * padEnds;

    const p0x = sx + nx * halfWidth;
    const p0y = sy + ny * halfWidth;
    const p1x = ex + nx * halfWidth;
    const p1y = ey + ny * halfWidth;
    const p2x = ex - nx * halfWidth;
    const p2y = ey - ny * halfWidth;
    const p3x = sx - nx * halfWidth;
    const p3y = sy - ny * halfWidth;

    ctx.moveTo(p0x, p0y);
    ctx.lineTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.lineTo(p3x, p3y);
    ctx.closePath();
    void cornerR;
  }

  _drawDecorativeStubStrip(ctx, x1, y1, x2, y2, widthPx) {
    ctx.save();
    const h = widthPx;
    ctx.fillStyle = '#55514e';
    ctx.fillRect(x1, y1 - h * 0.5, x2 - x1, h);
    ctx.strokeStyle = '#ece6dc';
    ctx.lineWidth = 3;
    ctx.strokeRect(x1 + 3, y1 - h * 0.5 + 3, (x2 - x1) - 6, h - 6);

    // Left 'X' marker & white diamond marker (exact detail from Screenshot 1!)
    ctx.strokeStyle = '#dcd6cc';
    ctx.lineWidth = 3.5;
    const cx = x1 + 26;
    ctx.beginPath();
    ctx.moveTo(cx - 12, y1 - 11);
    ctx.lineTo(cx + 12, y1 + 11);
    ctx.moveTo(cx + 12, y1 - 11);
    ctx.lineTo(cx - 12, y1 + 11);
    ctx.stroke();

    // Small white diamond
    const dx = x1 + 78;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(dx, y1 - 7);
    ctx.lineTo(dx + 7, y1);
    ctx.lineTo(dx, y1 + 7);
    ctx.lineTo(dx - 7, y1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawPerimeterFoliageAndFlowers(ctx, mapId, w2cX, w2cY, scale) {
    // Tiny white daisy/flower diamonds scattered on interior grass (Screenshot 1)
    if (mapId !== 'alpine_winter') {
      const specks = [
        [-325, 185, 4.5], [-365, -4, 4.0], [308, 195, 3.5], [275, 145, 3.5],
        [-210, 210, 3.5], [140, 220, 3.5], [-340, 120, 4.0], [295, -90, 3.5],
      ];
      ctx.fillStyle = '#ffffff';
      for (const [fx, fy, r] of specks) {
        if (mapId === 'tropical_island' && fx > 160) continue;
        const cx = w2cX(fx);
        const cy = w2cY(fy);
        const sr = r * scale;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI * 0.25);
        ctx.fillRect(-sr * 0.5, -sr * 0.5, sr, sr);
        ctx.restore();
      }
    }
  }

  _drawScallopedBush(ctx, cx, cy, r, fillStyle, strokeStyle) {
    const lobes = 10;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= lobes * 8; i++) {
      const a = (i / (lobes * 8)) * Math.PI * 2;
      const wave = 1 + 0.08 * Math.abs(Math.sin(a * lobes * 0.5));
      const px = cx + Math.cos(a) * r * wave;
      const py = cy + Math.sin(a) * r * wave;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (strokeStyle) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = strokeStyle;
      ctx.stroke();
    }
    ctx.restore();
  }

  _buildPavedRunwayMesh(rwy) {
    const dx = rwy.endX - rwy.thresholdX;
    const dy = rwy.endY - rwy.thresholdY;
    const coreLength = Math.hypot(dx, dy) || 200;
    const heading = (typeof rwy.heading === 'number') ? rwy.heading : Math.atan2(dy, dx);
    const width = rwy.width || 30;
    const overrun = 16;
    const totalLen = coreLength + overrun * 2;
    const midX = (rwy.thresholdX + rwy.endX) * 0.5;
    const midY = (rwy.thresholdY + rwy.endY) * 0.5;

    // High-DPI CanvasTexture for razor-sharp Argon asphalt, white outer lines,
    // colored inner sidelines, piano-key threshold bars, and far-end 'X'
    const cW = Math.max(512, Math.round(totalLen * 4));
    const cH = Math.max(128, Math.round(width * 4));
    const canvas = document.createElement('canvas');
    canvas.width = cW;
    canvas.height = cH;
    const ctx = canvas.getContext('2d');

    const colorCss = hexToCss(
      rwy.colorHex,
      rwy.colorKey === 'yellow'
        ? '#ffd60a'
        : rwy.colorKey === 'blue'
          ? '#2ac3ff'
          : rwy.colorKey === 'green'
            ? '#2ee6a8'
            : '#ff3b30'
    );

    // Dark weathered charcoal asphalt base (#484644)
    ctx.fillStyle = '#484644';
    ctx.fillRect(0, 0, cW, cH);

    // Subtle tire skid wear along centerline
    const skidGrad = ctx.createLinearGradient(0, 0, cW, 0);
    skidGrad.addColorStop(0, 'rgba(30, 28, 27, 0.35)');
    skidGrad.addColorStop(0.5, 'rgba(30, 28, 27, 0.18)');
    skidGrad.addColorStop(1, 'rgba(30, 28, 27, 0.05)');
    ctx.fillStyle = skidGrad;
    ctx.fillRect(20, cH * 0.28, cW - 40, cH * 0.44);

    // Crisp white outer boundary rectangle
    const pad = 8;
    ctx.strokeStyle = '#f2ede4';
    ctx.lineWidth = 6;
    ctx.strokeRect(pad, pad, cW - pad * 2, cH - pad * 2);

    // Colored inner sidelines running along the runway length (matching Screenshot 1 & 4)
    const innerY = pad + 13;
    ctx.strokeStyle = colorCss;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(pad + 14, innerY);
    ctx.lineTo(cW - pad - 14, innerY);
    ctx.moveTo(pad + 14, cH - innerY);
    ctx.lineTo(cW - pad - 14, cH - innerY);
    ctx.stroke();

    // Colored piano-key threshold stripes (||||) at the landing threshold (left side, x = 0..threshold)
    ctx.strokeStyle = colorCss;
    ctx.lineWidth = 7;
    const stripeStartX = pad + 24;
    const stripeSpacing = 18;
    for (let i = 0; i < 4; i++) {
      const sx = stripeStartX + i * stripeSpacing;
      ctx.beginPath();
      ctx.moveTo(sx, innerY + 8);
      ctx.lineTo(sx, cH - innerY - 8);
      ctx.stroke();
    }

    // White 'X' closed-end marker at the far rollout end (right side, endX, endY)
    const xCenter = cW - pad - 44;
    const xHalfW = 24;
    const xHalfH = cH * 0.27;
    ctx.strokeStyle = '#e5dfd5';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(xCenter - xHalfW, cH * 0.5 - xHalfH);
    ctx.lineTo(xCenter + xHalfW, cH * 0.5 + xHalfH);
    ctx.moveTo(xCenter + xHalfW, cH * 0.5 - xHalfH);
    ctx.lineTo(xCenter - xHalfW, cH * 0.5 + xHalfH);
    ctx.stroke();

    const rwyTex = setSRGB(new THREE.CanvasTexture(canvas));
    rwyTex.minFilter = THREE.LinearFilter;
    rwyTex.magFilter = THREE.LinearFilter;

    const rwyGroup = new THREE.Group();
    rwyGroup.position.set(midX, midY, 0.50);
    rwyGroup.rotation.z = heading;

    const stripMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(totalLen, width),
      new THREE.MeshBasicMaterial({ map: rwyTex, transparent: true, depthWrite: false })
    );
    rwyGroup.add(stripMesh);

    // Pulsing Approach Strobe Lights ("Rabbit" Lights) kept cleanly inside the paved threshold collar
    const strobeGroup = new THREE.Group();
    strobeGroup.position.set(-coreLength * 0.5, 0, 0.15);
    const strobeDots = [];
    for (let i = 0; i < 4; i++) {
      const dotGeo = new THREE.CircleGeometry(1.5, 12);
      const dotMat = new THREE.MeshBasicMaterial({
        color: rwy.colorHex || 0xff3b30,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.set(-13 + i * 3.2, 0, 0.05);
      strobeGroup.add(dotMesh);
      strobeDots.push(dotMesh);
    }
    rwyGroup.add(strobeGroup);
    this.runwayStrobeGroups.push({ id: rwy.id, dots: strobeDots, colorHex: rwy.colorHex || 0xff3b30 });

    // Invalid approach flash chevron overlay at threshold (hidden unless player drags from wrong angle)
    const warnMat = new THREE.MeshBasicMaterial({
      color: 0xff1e1e,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const warnRing = new THREE.Mesh(new THREE.RingGeometry(width * 0.55, width * 0.78, 24), warnMat);
    warnRing.position.set(-coreLength * 0.5, 0, 0.25);
    rwyGroup.add(warnRing);
    this.runwayWarningMeshes.set(rwy.id, warnRing);

    this.mapGroup.add(rwyGroup);
  }

  _buildWaterChannelRunway(rwy) {
    const dx = rwy.endX - rwy.thresholdX;
    const dy = rwy.endY - rwy.thresholdY;
    const coreLength = Math.hypot(dx, dy) || 155;
    const heading = (typeof rwy.heading === 'number') ? rwy.heading : Math.atan2(dy, dx);
    const width = rwy.width || 30;
    const midX = (rwy.thresholdX + rwy.endX) * 0.5;
    const midY = (rwy.thresholdY + rwy.endY) * 0.5;

    const group = new THREE.Group();
    group.position.set(midX, midY, 0.48);
    group.rotation.z = heading;

    // Note: On alpine_winter, AnimatedWaterSurfaceMesh (z = 0.14) renders the live glacial fjord
    // water basin, caustics, and snowy shoreline surf directly under the green buoy channel!

    // Floating green/teal buoy channel for Seaplane (matching Screenshot 2!)
    const cW = 640;
    const cH = 160;
    const canvas = document.createElement('canvas');
    canvas.width = cW;
    canvas.height = cH;
    const ctx = canvas.getContext('2d');

    // Subtle translucent water lane guide tint so animated caustics & waves shine through
    ctx.fillStyle = 'rgba(14, 118, 148, 0.12)';
    ctx.fillRect(16, 22, cW - 32, cH - 44);

    // Dual floating emerald-green & white buoy lines along both sides
    const numSegments = 10;
    const segW = (cW - 44) / numSegments;
    for (let i = 0; i < numSegments; i++) {
      const bx = 22 + i * segW;
      ctx.fillStyle = i % 2 === 0 ? '#1fd68a' : '#bcfce2';
      ctx.strokeStyle = '#0d6848';
      ctx.lineWidth = 3;
      for (const by of [20, cH - 28]) {
        ctx.fillRect(bx, by, segW - 6, 8);
        ctx.strokeRect(bx, by, segW - 6, 8);
      }
    }

    // 4 floating green threshold bars at entry (left side)
    ctx.fillStyle = '#2ee6a8';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(28 + i * 16, 36, 8, cH - 72);
    }

    const tex = setSRGB(new THREE.CanvasTexture(canvas));
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(coreLength + 24, width + 10),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    group.add(mesh);
    this.mapGroup.add(group);
    this.waterRippleMeshes.push(mesh);
  }

  _buildHelipadMesh(rwy) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size * 0.5;

    // Dark charcoal circle (#545250) matching Screenshot 1
    ctx.beginPath();
    ctx.arc(c, c, 98, 0, Math.PI * 2);
    ctx.fillStyle = '#545250';
    ctx.fill();

    // Crisp white outer circle ring
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#f2ede4';
    ctx.stroke();

    // Colored inner ring (sky-blue or amber/cyan)
    const ringColor = hexToCss(rwy.colorHex, '#7dd3fc');
    ctx.beginPath();
    ctx.arc(c, c, 84, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = ringColor;
    ctx.stroke();

    // Bold geometric 'H' in the center
    ctx.fillStyle = ringColor;
    const hW = 54;
    const hH = 64;
    const bar = 15;
    // Left vertical bar
    ctx.fillRect(c - hW * 0.5, c - hH * 0.5, bar, hH);
    // Right vertical bar
    ctx.fillRect(c + hW * 0.5 - bar, c - hH * 0.5, bar, hH);
    // Crossbar
    ctx.fillRect(c - hW * 0.5, c - bar * 0.5, hW, bar);

    const tex = setSRGB(new THREE.CanvasTexture(canvas));
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    const padMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(58, 58),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    padMesh.position.set(rwy.thresholdX, rwy.thresholdY, 0.52);
    this.mapGroup.add(padMesh);

    const warnMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const warnRing = new THREE.Mesh(new THREE.RingGeometry(28, 34, 28), warnMat);
    warnRing.position.set(rwy.thresholdX, rwy.thresholdY, 0.58);
    this.mapGroup.add(warnRing);
    this.runwayWarningMeshes.set(rwy.id, warnRing);
  }

  _buildAirfieldBuildings(mapDef) {
    const mapId = mapDef.id || 'classic_outback';
    let buildings = [];
    if (mapId === 'classic_outback') {
      // Exact building positions from Screenshot 1 & 4!
      buildings = [
        { type: 'tower_pentagon', x: -134, y: 146, radius: 22 },
        { type: 'shed', x: -88, y: 152, w: 20, h: 14, rot: 0 },
        { type: 'shed', x: -62, y: 152, w: 20, h: 14, rot: 0 },
        { type: 'shed', x: -36, y: 152, w: 20, h: 14, rot: 0 },
        { type: 'shed', x: -6, y: -158, w: 18, h: 14, rot: 0 },
        { type: 'hangar_corrugated', x: 26, y: -156, w: 38, h: 26, rot: 0 },
      ];
    } else if (mapId === 'tropical_island') {
      buildings = [
        { type: 'tower_pentagon', x: -198, y: 8, radius: 16 },
        { type: 'shed', x: -198, y: -68, w: 18, h: 14, rot: Math.PI * 0.5 },
        { type: 'shed', x: -198, y: -92, w: 18, h: 14, rot: Math.PI * 0.5 },
        { type: 'shed', x: -198, y: -116, w: 18, h: 14, rot: Math.PI * 0.5 },
        { type: 'tower_pentagon', x: 52, y: -26, radius: 14 },
        { type: 'shed', x: 80, y: -30, w: 16, h: 14, rot: -0.25 },
      ];
    } else {
      buildings = [
        { type: 'tower_pentagon', x: -35, y: 38, radius: 20 },
        { type: 'hangar_corrugated', x: 18, y: 42, w: 36, h: 24, rot: 0 },
        { type: 'shed', x: 54, y: 42, w: 20, h: 15, rot: 0 },
      ];
    }

    for (const b of buildings) {
      if (b.type === 'tower_pentagon') {
        this._createPentagonTower3D(b.x, b.y, b.radius || 20);
      } else {
        this._createHangarRoof3D(b.x, b.y, b.w || 24, b.h || 16, b.rot || 0, b.type === 'hangar_corrugated');
      }
    }
  }

  _createPentagonTower3D(x, y, radius) {
    // Soft downward-right drop shadow
    const shadowGeo = new THREE.CircleGeometry(radius * 1.04, 5);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x2a241b,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(x + 4.5, y - 4.5, 0.85);
    shadow.rotation.z = Math.PI * 0.5;
    this.mapGroup.add(shadow);

    // 5-faceted cream pyramid roof canvas texture (matching Screenshot 1 upper-left apron building)
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size * 0.5;
    const r = size * 0.44;
    const shades = ['#f5ebd8', '#ede1ca', '#dfcfb3', '#d5c4a6', '#efe4ce'];

    for (let i = 0; i < 5; i++) {
      const a0 = -Math.PI * 0.5 + (i * Math.PI * 2) / 5;
      const a1 = -Math.PI * 0.5 + ((i + 1) * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + Math.cos(a0) * r, c + Math.sin(a0) * r);
      ctx.lineTo(c + Math.cos(a1) * r, c + Math.sin(a1) * r);
      ctx.closePath();
      ctx.fillStyle = shades[i];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#c5b496';
      ctx.stroke();
    }

    const tex = setSRGB(new THREE.CanvasTexture(canvas));
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2.1, radius * 2.1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    mesh.position.set(x, y, 0.95);
    this.mapGroup.add(mesh);
  }

  _createHangarRoof3D(x, y, w, h, rot, isCorrugated) {
    const group = new THREE.Group();
    group.position.set(x, y, 0.92);
    group.rotation.z = rot;

    // Soft downward-right drop shadow
    const shMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 2, h + 2),
      new THREE.MeshBasicMaterial({ color: 0x2a241b, transparent: true, opacity: 0.24, depthWrite: false })
    );
    shMesh.position.set(3.5, -3.5, -0.05);
    group.add(shMesh);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    // Cream/tan roof with 3D ridge shading
    const grad = ctx.createLinearGradient(0, 0, 0, 96);
    grad.addColorStop(0, '#f4ebd8');
    grad.addColorStop(0.5, '#eae0ca');
    grad.addColorStop(0.52, '#d8c8ab');
    grad.addColorStop(1, '#dfd1b6');
    ctx.fillStyle = grad;
    ctx.fillRect(4, 4, 120, 88);

    if (isCorrugated) {
      ctx.strokeStyle = 'rgba(165, 148, 120, 0.55)';
      ctx.lineWidth = 3;
      for (let rx = 18; rx < 114; rx += 16) {
        ctx.beginPath();
        ctx.moveTo(rx, 8);
        ctx.lineTo(rx, 88);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = '#bfae90';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 120, 88);

    const tex = setSRGB(new THREE.CanvasTexture(canvas));
    const roofMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    group.add(roofMesh);
    this.mapGroup.add(group);
  }

  _buildAnimatedWindsock(x, y) {
    const rig = new THREE.Group();
    rig.position.set(x, y, 1.15);

    // Shadow under windsock cone
    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 16),
      new THREE.MeshBasicMaterial({
        map: this.windsockTexture,
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      })
    );
    shadowMesh.position.set(17, -4, -0.1);
    rig.add(shadowMesh);

    // Pivot group that sways in the breeze
    const swayPivot = new THREE.Group();
    swayPivot.position.set(0, 0, 0.1);

    const coneMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 15, 8, 1),
      new THREE.MeshBasicMaterial({
        map: this.windsockTexture,
        transparent: true,
        depthWrite: false,
      })
    );
    coneMesh.position.set(16, 0, 0);
    swayPivot.add(coneMesh);
    rig.add(swayPivot);

    // White mast pole cap at origin
    const mastCap = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false })
    );
    mastCap.position.set(0, 0, 0.2);
    rig.add(mastCap);

    this.mapGroup.add(rig);
    this.windsockRig = {
      rig,
      swayPivot,
      shadowMesh,
      coneGeo: coneMesh.geometry,
      basePositions: Float32Array.from(coneMesh.geometry.attributes.position.array),
    };
  }

  _updateAnimatedMapProps(time) {
    // 1. Animate windsock sway and cloth ripple
    if (this.windsockRig) {
      const { swayPivot, shadowMesh, coneGeo, basePositions } = this.windsockRig;
      const swayAngle = 0.06 + Math.sin(time * 2.8) * 0.14 + Math.cos(time * 4.3) * 0.05;
      swayPivot.rotation.z = swayAngle;
      shadowMesh.rotation.z = swayAngle;

      const posAttr = coneGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const t = (bx + 17) / 34; // 0 at mast, 1 at tail tip
        const ripple = Math.sin(time * 6.5 - t * 4.2) * (2.2 * t);
        posAttr.setY(i, by + ripple);
      }
      posAttr.needsUpdate = true;
    }

    // 2. Sequential approach strobe "rabbit" lights at runway thresholds
    for (const strobe of this.runwayStrobeGroups) {
      const cycle = (time * 4.5) % 4;
      for (let i = 0; i < strobe.dots.length; i++) {
        const dist = Math.abs(cycle - i);
        const pulse = Math.max(0.25, 1.0 - dist * 0.55);
        strobe.dots[i].material.opacity = pulse;
        const s = 0.85 + pulse * 0.45;
        strobe.dots[i].scale.set(s, s, 1);
      }
    }

    // 3. Subtle water channel buoyancy
    for (const wm of this.waterRippleMeshes) {
      const s = 1.0 + Math.sin(time * 2.4) * 0.015;
      wm.scale.set(1, s, 1);
    }
  }

  // ===========================================================================
  // 2. AIRCRAFT 2.5D RIG, DYNAMIC DROP-SHADOWS, HAZARD RINGS & SPINNING ROTORS
  // ===========================================================================

  syncAircraft(activePlanes, dt) {
    return this.updateAircraft(activePlanes, dt, this.time);
  }

  updateAircraft(activePlanes = [], dt = 0.016, time = this.time) {
    const seenIds = new Set();

    // Decay runway invalid approach flashes
    for (const [, warnMesh] of this.runwayWarningMeshes.entries()) {
      if (warnMesh.material.opacity > 0) {
        warnMesh.material.opacity = Math.max(0, warnMesh.material.opacity - dt * 2.2);
      }
    }

    for (const plane of activePlanes) {
      if (!plane || plane.state === 'LANDED' || plane.opacity <= 0.01) continue;
      const id = plane.id || plane.uid || `${plane.classId}_${plane.spawnTime || 0}`;
      seenIds.add(id);

      let rig = this.aircraftRigs.get(id);
      if (!rig) {
        rig = this._createAircraftRig(plane);
        this.aircraftRigs.set(id, rig);
      }

      const altitude = (typeof plane.altitude === 'number') ? THREE.MathUtils.clamp(plane.altitude, 0, 1) : 1.0;
      const visualScale = (typeof plane.visualScale === 'number') ? plane.visualScale : 1.0;
      const classScale = (typeof plane.scale === 'number') ? plane.scale : 1.0;
      const totalScale = classScale * visualScale;
      const opacity = (typeof plane.opacity === 'number') ? THREE.MathUtils.clamp(plane.opacity, 0, 1) : 1.0;
      const heading = plane.heading || 0;
      const bankAngle = plane.bankAngle || 0;

      // 1. Dynamic Drop-Shadow (z = 1.4)
      // Shrinks and slides directly underneath the wheels as altitude drops from 1.0 -> 0.0
      const baseOff = plane.shadowBaseOffset || 13;
      const shadowOffset = 1.4 + (baseOff - 1.4) * altitude;
      rig.shadowMesh.position.set(plane.x + shadowOffset, plane.y - shadowOffset, 1.4);
      rig.shadowMesh.rotation.z = heading;
      const shScale = totalScale * (0.86 + 0.14 * altitude);
      rig.shadowMesh.scale.set(shScale, shScale * Math.cos(bankAngle * 0.55), 1);
      rig.shadowMat.opacity = 0.36 * opacity;

      // 2. Selection Beacon Reticle (z = 3.2)
      const showBeacon = Boolean(plane.isSelected || plane.isHovered);
      rig.selectionMesh.visible = showBeacon;
      if (showBeacon) {
        rig.selectionMesh.position.set(plane.x, plane.y, 3.2);
        const pulse = 1.0 + 0.10 * Math.sin(time * 11.0);
        rig.selectionMesh.scale.set(totalScale * pulse, totalScale * pulse, 1);
        rig.selectionMesh.rotation.z = time * 1.4;
      }

      // 3. Stage 1 Proximity Hazard Rings (z = 3.5 — Exact Match to Screenshot 4!)
      const inHazard = Boolean(plane.inProximityWarning);
      rig.hazardMesh.visible = inHazard;
      if (inHazard) {
        rig.hazardMesh.position.set(plane.x, plane.y, 3.5);
        const hazardPulse = 1.0 + 0.14 * Math.sin(time * 18.0);
        rig.hazardMesh.scale.set(hazardPulse, hazardPulse, 1);
        rig.hazardMesh.rotation.z = time * 2.2;
      }

      // 4. Aircraft Body (z = 4.0 + altitude * 2.0) with 3D Banking Tilt & Spinning Prop/Rotor
      const bodyZ = 4.0 + altitude * 2.0;
      rig.bodyRoot.position.set(plane.x, plane.y, bodyZ);
      rig.bodyRoot.rotation.z = heading;

      // Apply realistic banking tilt around flight axis (local X) + subtle wing foreshortening
      rig.bankGroup.rotation.x = bankAngle;
      const wingForeshorten = Math.cos(bankAngle * 0.65);
      rig.bodyRoot.scale.set(totalScale, totalScale * wingForeshorten, totalScale);
      rig.bodyMat.opacity = opacity;

      // Spin nose propeller or top helicopter rotor
      if (rig.propMesh) {
        rig.propMesh.rotation.z += dt * 42.0;
        rig.propMesh.material.opacity = 0.85 * opacity;
      }
      if (rig.rotorMesh) {
        rig.rotorMesh.rotation.z += dt * 26.0;
        rig.rotorBladesMesh.rotation.z += dt * 26.0;
        rig.rotorMesh.material.opacity = 0.68 * opacity;
        rig.rotorBladesMesh.material.opacity = 0.92 * opacity;
      }

      // Trigger invalid approach flash on runway if set
      if (plane.invalidApproachFlash && plane.invalidApproachFlash > 0) {
        plane.invalidApproachFlash = Math.max(0, plane.invalidApproachFlash - dt);
        for (const [, warnMesh] of this.runwayWarningMeshes.entries()) {
          warnMesh.material.opacity = Math.max(warnMesh.material.opacity, 0.75);
        }
      }
    }

    // Clean up rigs for landed/removed aircraft
    for (const [id, rig] of this.aircraftRigs.entries()) {
      if (!seenIds.has(id)) {
        this.shadowGroup.remove(rig.shadowMesh);
        this.selectionGroup.remove(rig.selectionMesh);
        this.hazardGroup.remove(rig.hazardMesh);
        this.aircraftGroup.remove(rig.bodyRoot);
        this.aircraftRigs.delete(id);
      }
    }

    // Feed up to 6 active aircraft / seaplane vectors into the real-time water shader for Kelvin wakes!
    if (this.waterShaderMaterial && this.waterShaderMaterial.uniforms) {
      const wakeUniforms = this.waterShaderMaterial.uniforms.uWakeActors.value;
      // Prioritize seaplanes and low-altitude landing/flying aircraft
      const candidates = [];
      for (const p of activePlanes) {
        if (!p || p.state === 'LANDED' || p.opacity <= 0.05) continue;
        const isSeaplane = p.classId === 'seaplane_green' ? 1 : 0;
        const alt = typeof p.altitude === 'number' ? p.altitude : 1.0;
        const priority = isSeaplane * 10.0 + (1.2 - alt);
        candidates.push({ p, priority });
      }
      candidates.sort((a, b) => b.priority - a.priority);
      const count = Math.min(6, candidates.length);
      this.waterShaderMaterial.uniforms.uWakeCount.value = count;
      for (let i = 0; i < 6; i++) {
        if (i < count) {
          const pl = candidates[i].p;
          const spd = (typeof pl.currentSpeed === 'number' ? pl.currentSpeed : (pl.speed || 55));
          const vx = typeof pl.vx === 'number' ? pl.vx : Math.cos(pl.heading || 0) * spd;
          const vy = typeof pl.vy === 'number' ? pl.vy : Math.sin(pl.heading || 0) * spd;
          wakeUniforms[i].set(pl.x, pl.y, vx, vy);
        } else {
          wakeUniforms[i].set(9999.0, 9999.0, 0.0, 0.0);
        }
      }
    }
  }

  _createAircraftRig(plane) {
    const classId = plane.classId || plane.type || 'jet_red';
    const tex = this.aircraftTextures.get(classId) || this.aircraftTextures.get('jet_red');
    const shTex = this.aircraftShadowTextures.get(classId) || this.aircraftShadowTextures.get('jet_red');

    const baseSize = classId === 'jet_red' ? 54 : (classId === 'seaplane_green' || classId === 'heli_blue' ? 46 : 42);

    // 1. Dynamic Drop-Shadow Mesh (z = 1.4)
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shTex,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(baseSize, baseSize), shadowMat);
    this.shadowGroup.add(shadowMesh);

    // 2. Selection Beacon Mesh (z = 3.2)
    const selMat = new THREE.MeshBasicMaterial({
      map: this.selectionRingTexture,
      color: plane.colorHex || 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const selectionMesh = new THREE.Mesh(new THREE.PlaneGeometry(baseSize * 1.38, baseSize * 1.38), selMat);
    selectionMesh.visible = false;
    this.selectionGroup.add(selectionMesh);

    // 3. Stage 1 Proximity Hazard Ring Mesh (z = 3.5 — Screenshot 4 dual red arcs + radial ticks)
    const hazardMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      this.hazardRingMaterial
    );
    hazardMesh.visible = false;
    this.hazardGroup.add(hazardMesh);

    // 4. Aircraft Body Root & 3D Bank Group (z = 4.0 + altitude * 2.0)
    const bodyRoot = new THREE.Group();
    const bankGroup = new THREE.Group();
    bodyRoot.add(bankGroup);

    const bodyMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
    const bodyMesh = new THREE.Mesh(new THREE.PlaneGeometry(baseSize, baseSize), bodyMat);
    bankGroup.add(bodyMesh);

    // Nose propeller blur or top helicopter rotor
    let propMesh = null;
    let rotorMesh = null;
    let rotorBladesMesh = null;

    if (plane.hasPropeller || classId.startsWith('prop_') || classId === 'seaplane_green') {
      const propMat = new THREE.MeshBasicMaterial({
        map: this.propBlurTexture,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      propMesh = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), propMat);
      propMesh.position.set(baseSize * 0.28, 0, 0.15);
      bankGroup.add(propMesh);
    }

    if (plane.hasRotor || classId === 'heli_blue') {
      const rotorMat = new THREE.MeshBasicMaterial({
        map: this.rotorBlurTexture.disc,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
      });
      rotorMesh = new THREE.Mesh(new THREE.PlaneGeometry(baseSize * 1.05, baseSize * 1.05), rotorMat);
      rotorMesh.position.set(2, 0, 0.22);
      bankGroup.add(rotorMesh);

      const bladesMat = new THREE.MeshBasicMaterial({
        map: this.rotorBlurTexture.blades,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      rotorBladesMesh = new THREE.Mesh(new THREE.PlaneGeometry(baseSize * 1.05, baseSize * 1.05), bladesMat);
      rotorBladesMesh.position.set(2, 0, 0.28);
      bankGroup.add(rotorBladesMesh);
    }

    this.aircraftGroup.add(bodyRoot);

    return {
      id: plane.id,
      classId,
      shadowMesh,
      shadowMat,
      selectionMesh,
      hazardMesh,
      bodyRoot,
      bankGroup,
      bodyMesh,
      bodyMat,
      propMesh,
      rotorMesh,
      rotorBladesMesh,
    };
  }

  _createHazardRingShaderMaterial() {
    // Custom GLSL shader rendering Screenshot 4's exact Stage 1 Proximity Hazard Rings:
    // Two opposing bright red alert arcs (#ff1e1e) with 12 radial compass tick marks + pulsing inner strobe!
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          float r = length(vUv);
          if (r > 1.0) discard;

          float angle = atan(vUv.y, vUv.x);
          // Two opposing 108-degree arcs: cos(2 * angle) > -0.25
          float sym = cos(angle * 2.0);
          float arcMask = smoothstep(-0.30, -0.18, sym);

          // Outer thick red arc band (r in [0.68, 0.90])
          float outerBand = smoothstep(0.66, 0.70, r) * (1.0 - smoothstep(0.88, 0.92, r));
          float mainArc = outerBand * arcMask;

          // Inner radial compass tick marks (16 ticks around circle in r [0.54, 0.68])
          float tickWave = abs(sin(angle * 8.0));
          float tickMask = smoothstep(0.84, 0.93, tickWave);
          float tickBand = smoothstep(0.53, 0.56, r) * (1.0 - smoothstep(0.67, 0.70, r));
          float ticks = tickBand * tickMask * arcMask;

          // Subtle pulsing inner red radar fill
          float strobe = 0.5 + 0.5 * sin(uTime * 16.0);
          float innerGlow = (1.0 - smoothstep(0.0, 0.70, r)) * 0.22 * strobe;

          float alpha = clamp(mainArc * 0.95 + ticks * 0.85 + innerGlow, 0.0, 1.0);
          if (alpha < 0.02) discard;

          vec3 redAlert = mix(vec3(1.0, 0.12, 0.08), vec3(1.0, 0.38, 0.22), ticks * 0.5);
          gl_FragColor = vec4(redAlert, alpha);
        }
      `,
    });
  }

  _updateWaterMaskCanvas(maskCanvas, groundCanvas, mapDef) {
    const w = maskCanvas.width;
    const h = maskCanvas.height;
    const ctx = maskCanvas.getContext('2d');
    ctx.drawImage(groundCanvas, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const mapId = (mapDef && mapDef.id) || this.currentMapId || 'classic_outback';
    const total = w * h;

    const rawWater = new Uint8Array(total);
    const staticFoam = new Uint8Array(total);

    const meshW = WORLD_WIDTH + 64;
    const meshH = WORLD_HEIGHT + 64;

    // Collect non-water runways & helipads so water can NEVER cover any paved runway
    const pavedRunways = ((mapDef && mapDef.runways) || []).filter((r) => !r.isWaterRunway);

    // 1. Classify candidate land vs water pixels
    const isCandidateLand = new Uint8Array(total);
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      const worldY = (0.5 - ny) * meshH;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const worldX = (nx - 0.5) * meshW;
        const idx = y * w + x;
        const p = idx * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];

        // Unconditional exclusion around all paved runways and helipads
        let onPavedRunway = false;
        for (let rwIdx = 0; rwIdx < pavedRunways.length; rwIdx++) {
          const rw = pavedRunways[rwIdx];
          if (rw.isHelipad) {
            if (Math.hypot(worldX - rw.thresholdX, worldY - rw.thresholdY) <= 46.0) {
              onPavedRunway = true;
              break;
            }
          } else {
            const ax = rw.thresholdX;
            const ay = rw.thresholdY;
            const bx = rw.endX;
            const by = rw.endY;
            const abx = bx - ax;
            const aby = by - ay;
            const lenSq = Math.max(1.0, abx * abx + aby * aby);
            const tProj = Math.max(-0.15, Math.min(1.15, ((worldX - ax) * abx + (worldY - ay) * aby) / lenSq));
            const cx = ax + tProj * abx;
            const cy = ay + tProj * aby;
            if (Math.hypot(worldX - cx, worldY - cy) <= (rw.width || 30) * 0.5 + 24.0) {
              onPavedRunway = true;
              break;
            }
          }
        }

        if (onPavedRunway) {
          isCandidateLand[idx] = 1;
          continue;
        }

        if (mapId === 'classic_outback') {
          const inRiverZone = (nx < 0.28 && ny > 0.58) || (nx > 0.72 && ny > 0.54);
          if (!inRiverZone) {
            isCandidateLand[idx] = 1;
          } else {
            // Terracotta red clay bank has R > B + 8; eucalyptus/grass has G > B + 22 && R < 145
            const isBankOrScrub = r > b + 8 || (g > b + 22 && r < 145);
            if (isBankOrScrub) {
              isCandidateLand[idx] = 1;
            } else if (r > 135 && g > 165 && b > 150) {
              staticFoam[idx] = 1;
            }
          }
        } else if (mapId === 'tropical_island') {
          if (nx <= 0.42) {
            isCandidateLand[idx] = 1;
          } else {
            // Golden beach sand has R > B + 10 and B < 188; island grass has G > B + 22
            const isBeachOrGrass = (r > b + 10 && b < 188) || (g > b + 22 && r < 150);
            if (isBeachOrGrass) {
              isCandidateLand[idx] = 1;
            } else if (r > 135 && g > 168 && b > 155) {
              staticFoam[idx] = 1;
            }
          }
        } else {
          // Alpine Winter: animate only the actual glacial stream channels in the bottom corners
          const inCornerStreamZone =
            (nx < 0.27 && ny > 0.72 && nx + (1.0 - ny) < 0.30) ||
            (nx > 0.69 && ny > 0.70 && (1.0 - nx) + (1.0 - ny) < 0.33);
          if (!inCornerStreamZone) {
            isCandidateLand[idx] = 1;
          } else {
            const isSnowOrRock = (b - r) <= 24 || r >= 162 || g <= 105;
            if (isSnowOrRock) {
              isCandidateLand[idx] = 1;
            } else if (r > 130 && g > 175 && b > 195) {
              staticFoam[idx] = 1;
            }
          }
        }
      }
    }

    // 2. Flood-fill connected mainland (starting from airfield center) so that any isolated
    // wave swirl or compression speck inside the ocean/river is guaranteed NOT to be land
    // (100% eliminating interior islands or concentric foam rings inside the water!).
    const isTrueLand = new Uint8Array(total);
    const queue = new Int32Array(total);
    let qHead = 0;
    let qTail = 0;

    const seedIdx = Math.floor(h * 0.5) * w + Math.floor(w * 0.5);
    isTrueLand[seedIdx] = 1;
    queue[qTail++] = seedIdx;

    while (qHead < qTail) {
      const curr = queue[qHead++];
      const cx = curr % w;
      const cy = (curr - cx) / w;

      if (cx > 0) {
        const ni = curr - 1;
        if (isCandidateLand[ni] && !isTrueLand[ni]) {
          isTrueLand[ni] = 1;
          queue[qTail++] = ni;
        }
      }
      if (cx < w - 1) {
        const ni = curr + 1;
        if (isCandidateLand[ni] && !isTrueLand[ni]) {
          isTrueLand[ni] = 1;
          queue[qTail++] = ni;
        }
      }
      if (cy > 0) {
        const ni = curr - w;
        if (isCandidateLand[ni] && !isTrueLand[ni]) {
          isTrueLand[ni] = 1;
          queue[qTail++] = ni;
        }
      }
      if (cy < h - 1) {
        const ni = curr + w;
        if (isCandidateLand[ni] && !isTrueLand[ni]) {
          isTrueLand[ni] = 1;
          queue[qTail++] = ni;
        }
      }
    }

    const isWater = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      isWater[i] = isTrueLand[i] ? 0 : 1;
    }

    // 3. 2-Pass Chamfer Distance Transform from Land into Water (distToLand = 0 on land, > 0 in water)
    const INF = 1e4;
    const distToLand = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      distToLand[i] = isWater[i] ? INF : 0.0;
    }
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        let d = distToLand[i];
        if (d === 0) continue;
        if (x > 0) d = Math.min(d, distToLand[i - 1] + 1.0);
        if (y > 0) d = Math.min(d, distToLand[i - w] + 1.0);
        if (x > 0 && y > 0) d = Math.min(d, distToLand[i - w - 1] + 1.414);
        if (x < w - 1 && y > 0) d = Math.min(d, distToLand[i - w + 1] + 1.414);
        distToLand[i] = d;
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      const row = y * w;
      for (let x = w - 1; x >= 0; x--) {
        const i = row + x;
        let d = distToLand[i];
        if (d === 0) continue;
        if (x < w - 1) d = Math.min(d, distToLand[i + 1] + 1.0);
        if (y < h - 1) d = Math.min(d, distToLand[i + w] + 1.0);
        if (x < w - 1 && y < h - 1) d = Math.min(d, distToLand[i + w + 1] + 1.414);
        if (x > 0 && y < h - 1) d = Math.min(d, distToLand[i + w - 1] + 1.414);
        distToLand[i] = d;
      }
    }

    // 4. Encode into RGBA (keep A = 255 to prevent HTML5 Canvas 2D premultiplied alpha quantization!):
    // R = smoothed waterPresence (0..255)
    // G = normalized waterDepth (distToLand / 44.0 -> 0..255)
    // B = staticFoamAbsorption flag (so shader replaces static white shoreline with turquoise reef water)
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        const p = i * 4;
        const dLand = distToLand[i];
        let neighborSum = isWater[i] * 2.0;
        if (x > 0) neighborSum += isWater[i - 1];
        if (x < w - 1) neighborSum += isWater[i + 1];
        if (y > 0) neighborSum += isWater[i - w];
        if (y < h - 1) neighborSum += isWater[i + w];
        const presence = Math.min(1.0, Math.max(dLand > 0 ? 0.45 : 0.0, neighborSum / 6.0));
        const depthNorm = Math.min(1.0, dLand / 44.0);

        data[p] = Math.round(presence * 255);
        data[p + 1] = Math.round(depthNorm * 255);
        data[p + 2] = staticFoam[i] ? 255 : 0;
        data[p + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  _createWaterSurfaceShaderMaterial() {
    const emptyWakeArray = [];
    for (let i = 0; i < 6; i++) {
      emptyWakeArray.push(new THREE.Vector4(9999.0, 9999.0, 0.0, 0.0));
    }

    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0.0 },
        uGroundTex: { value: null },
        uWaterMask: { value: null },
        uMapMode: { value: 0.0 },
        uWorldSize: { value: new THREE.Vector2(WORLD_WIDTH + 64, WORLD_HEIGHT + 64) },
        uWakeActors: { value: emptyWakeArray },
        uWakeCount: { value: 0 },
      },
      vertexShader: `
        uniform vec2 uWorldSize;
        varying vec2 vUv;
        varying vec2 vWorldPos;
        void main() {
          vUv = uv;
          vWorldPos = (uv - 0.5) * uWorldSize;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uGroundTex;
        uniform sampler2D uWaterMask;
        uniform float uMapMode;
        uniform vec4 uWakeActors[6];
        uniform int uWakeCount;

        varying vec2 vUv;
        varying vec2 vWorldPos;

        // 2D hash & smooth value noise for organic foam breakup and wave turbulence
        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float valueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm2(vec2 p) {
          float v = 0.0;
          v += 0.60 * valueNoise(p);
          v += 0.40 * valueNoise(p * 2.13 + vec2(3.7, 1.9));
          return v;
        }

        // Dual-layer intersecting underwater caustic light web
        float computeCaustics(vec2 wp, float t) {
          vec2 p1 = wp * 0.068 + vec2(t * 0.42, -t * 0.31);
          vec2 p2 = wp * 0.074 + vec2(-t * 0.36, t * 0.48);

          float w1 = sin(p1.x + sin(p1.y * 1.3 + t * 0.7)) * cos(p1.y + cos(p1.x * 1.2 - t * 0.5));
          float w2 = sin(p2.x * 1.15 - cos(p2.y * 1.25 - t * 0.6)) * cos(p2.y * 1.1 + sin(p2.x * 1.3 + t * 0.8));

          float netA = 1.0 - abs(w1);
          float netB = 1.0 - abs(w2);
          float ridge = pow(clamp(netA * netB, 0.0, 1.0), 2.4);
          return ridge;
        }

        void main() {
          vec4 mask = texture2D(uWaterMask, vUv);
          float presence = mask.r;
          if (presence < 0.02) discard;

          float depth = mask.g; // 0.0 at shoreline -> 1.0 at ~88 world units offshore
          float wasStaticFoam = mask.b;
          vec2 wp = vWorldPos;
          float t = uTime;

          // 1. Multi-Directional Gerstner & Swell Wave Field
          vec2 flowDir1 = normalize(vec2(-0.82, 0.57));
          vec2 flowDir2 = normalize(vec2(-0.55, -0.83));
          vec2 flowDir3 = normalize(vec2(0.74, 0.67));
          vec2 flowDir4 = normalize(vec2(-0.95, 0.31));

          float phase1 = dot(wp, flowDir1) * 0.13 + t * 2.15;
          float phase2 = dot(wp, flowDir2) * 0.19 - t * 1.75;
          float phase3 = dot(wp, flowDir3) * 0.29 + t * 2.65;
          float phase4 = dot(wp, flowDir4) * 0.41 + t * 3.20;

          float waveH =
            0.40 * sin(phase1) +
            0.28 * sin(phase2) +
            0.19 * cos(phase3) +
            0.13 * sin(phase4);

          vec2 waveGrad =
            0.40 * 0.13 * cos(phase1) * flowDir1 +
            0.28 * 0.19 * cos(phase2) * flowDir2 -
            0.19 * 0.29 * sin(phase3) * flowDir3 +
            0.13 * 0.41 * cos(phase4) * flowDir4;

          // 2. Interactive Aircraft & Seaplane Kelvin Bow Wakes + Stern Ripples
          float wakeFoam = 0.0;
          for (int i = 0; i < 6; i++) {
            if (i >= uWakeCount) break;
            vec4 actor = uWakeActors[i];
            vec2 rel = wp - actor.xy;
            float dist = length(rel);
            if (dist < 85.0) {
              float spd = length(actor.zw);
              vec2 fwd = spd > 1.0 ? (actor.zw / spd) : vec2(1.0, 0.0);
              vec2 side = vec2(-fwd.y, fwd.x);
              float along = dot(rel, -fwd);
              float across = abs(dot(rel, side));

              float inWakeCone = smoothstep(-8.0, 4.0, along) * smoothstep(78.0, 6.0, along);
              float coneHalfWidth = 4.0 + along * 0.46;
              float vArm = exp(-pow((across - coneHalfWidth * 0.72) / 4.2, 2.0)) * inWakeCone;
              float wakeRipple = sin((across - along * 0.38) * 0.85 - t * 9.5) * vArm;

              float radialRing = sin(dist * 0.55 - t * 8.0) * exp(-dist * 0.048);
              waveH += (wakeRipple * 0.45 + radialRing * 0.28);
              waveGrad += normalize(rel + vec2(0.001)) * (wakeRipple * 0.12 + radialRing * 0.08);
              wakeFoam += clamp(vArm * 0.75 + max(0.0, radialRing) * 0.45, 0.0, 1.0) * exp(-dist * 0.025);
            }
          }

          // 3. Refracted Subsurface Terrain Sample + Rich Depth-Graded Water Palette
          vec2 refractUv = clamp(vUv + waveGrad * 0.0038, 0.001, 0.999);
          vec3 groundSample = texture2D(uGroundTex, refractUv).rgb;

          vec3 shallowCol;
          vec3 midCol;
          vec3 deepCol;
          if (uMapMode > 1.5) {
            // Alpine Winter: crystalline icy cyan shallows -> deep glacier fjord blue
            shallowCol = vec3(0.32, 0.82, 0.93);
            midCol     = vec3(0.11, 0.58, 0.78);
            deepCol    = vec3(0.05, 0.39, 0.60);
          } else if (uMapMode > 0.5) {
            // Tropical Island (Paradise Beach): luminous aquamarine reef -> rich turquoise lagoon -> cobalt ocean
            shallowCol = vec3(0.24, 0.87, 0.84);
            midCol     = vec3(0.08, 0.69, 0.79);
            deepCol    = vec3(0.04, 0.48, 0.67);
          } else {
            // Classic Outback: sunlit turquoise billabong river shallows -> deep cool river channel
            shallowCol = vec3(0.22, 0.81, 0.86);
            midCol     = vec3(0.10, 0.64, 0.78);
            deepCol    = vec3(0.05, 0.46, 0.64);
          }

          float dMid = smoothstep(0.03, 0.36, depth);
          float dDeep = smoothstep(0.30, 0.86, depth);
          vec3 waterBase = mix(shallowCol, midCol, dMid);
          waterBase = mix(waterBase, deepCol, dDeep);

          // Blend subtle refracted bathymetry only in deeper water where static foam wasn't painted
          float keepGroundTint = (1.0 - wasStaticFoam) * smoothstep(0.08, 0.25, depth) * 0.18;
          waterBase = mix(waterBase, groundSample, keepGroundTint);

          // 4. Animated Underwater Caustics + Wave Crest Shading
          float caustics = computeCaustics(wp + waveGrad * 9.0, t);
          float causticMask = smoothstep(0.02, 0.14, depth) * (1.0 - 0.32 * dDeep);
          vec3 waterColor = waterBase + vec3(0.20, 0.34, 0.36) * caustics * causticMask * 0.85;

          // Subtle wave crest illumination & trough deepening
          waterColor += vec3(0.06, 0.11, 0.13) * waveH;

          // 5. Natural Single-Crest Shoreline Lapping Surf & Offshore Whitecaps
          float noiseWarp = fbm2(wp * 0.048 + vec2(t * 0.24, -t * 0.19));
          float shoreDist = depth * 44.0; // in mask pixels (1 mask px = 2 world units)

          // Organic lapping swash right along the beach/riverbank edge
          float swashWave = 1.15 + 0.75 * sin(t * 2.35 + wp.x * 0.038 - wp.y * 0.042 + noiseWarp * 3.4);
          float swashEdge = (1.0 - smoothstep(0.35, swashWave + 1.1, shoreDist)) * smoothstep(0.0, 0.32, shoreDist);

          // Gentle incoming translucent surf ripple moving toward shore
          float surfPhase = fract(shoreDist * 0.095 + t * 0.38 + noiseWarp * 0.42);
          float surfCrest = smoothstep(0.06, 0.18, surfPhase) * (1.0 - smoothstep(0.18, 0.42, surfPhase));
          float surfEnvelope = smoothstep(0.8, 2.2, shoreDist) * (1.0 - smoothstep(4.5, 10.5, shoreDist));
          float laceBreakup = smoothstep(0.28, 0.72, fbm2(wp * 0.12 - vec2(t * 0.45, t * 0.28)));

          // Offshore wind-blown whitecaps on high wave crests
          float offshoreWhitecap = smoothstep(0.66, 0.94, waveH + noiseWarp * 0.26) * smoothstep(6.0, 16.0, shoreDist) * 0.35;

          float totalFoam = clamp(
            swashEdge * 0.82 +
            surfCrest * surfEnvelope * laceBreakup * 0.44 +
            offshoreWhitecap +
            wakeFoam * 0.85,
            0.0,
            1.0
          );

          vec3 foamColor = vec3(0.95, 0.99, 1.0);
          waterColor = mix(waterColor, foamColor, totalFoam);

          // 6. Sun-Dappled Specular Sparkles
          vec3 N = normalize(vec3(-waveGrad.x * 2.6, -waveGrad.y * 2.6, 1.0));
          vec3 L = normalize(vec3(-0.45, 0.52, 0.72));
          vec3 V = vec3(0.0, 0.0, 1.0);
          vec3 H = normalize(L + V);
          float spec = pow(max(0.0, dot(N, H)), 52.0);
          float sparkle = smoothstep(0.76, 0.96, valueNoise(wp * 0.28 + vec2(t * 1.9, -t * 1.5)));
          waterColor += vec3(1.0, 0.98, 0.90) * (spec * 0.65 + sparkle * 0.22 * smoothstep(0.2, 0.8, waveH + 0.5));

          // Smooth shoreline feathering onto wet sand / clay / snow bank
          float edgeAlpha = smoothstep(0.02, 0.38, presence) * smoothstep(0.0, 0.75, shoreDist + 0.35);
          gl_FragColor = vec4(waterColor, clamp(edgeAlpha, 0.0, 0.98));
        }
      `,
    });
  }

  _preloadAircraftTextures() {
    const specs = [
      { id: 'jet_red', file: 'plane_jet_red.png', accent: '#ff3b30', trim: '#f5a623' },
      { id: 'prop_yellow', file: 'plane_prop_yellow.png', accent: '#ffd60a', trim: '#d97706' },
      { id: 'prop_blue', file: 'plane_prop_blue.png', accent: '#2ac3ff', trim: '#1d4ed8' },
      { id: 'heli_blue', file: 'plane_heli_blue.png', accent: '#38bdf8', trim: '#0284c7' },
      { id: 'seaplane_green', file: 'plane_seaplane_green.png', accent: '#2ee6a8', trim: '#059669' },
    ];

    for (const spec of specs) {
      const bodyCanvas = document.createElement('canvas');
      bodyCanvas.width = 512;
      bodyCanvas.height = 512;
      this._drawCrispVectorAircraft(bodyCanvas, spec, null);

      const bodyTex = setSRGB(new THREE.CanvasTexture(bodyCanvas));
      bodyTex.minFilter = THREE.LinearMipmapLinearFilter;
      bodyTex.magFilter = THREE.LinearFilter;
      this.aircraftTextures.set(spec.id, bodyTex);
      this.aircraftTextures.set(spec.file.replace('.png', ''), bodyTex);

      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = 256;
      shadowCanvas.height = 256;
      this._buildSilhouetteFromCanvas(bodyCanvas, shadowCanvas);
      const shadowTex = new THREE.CanvasTexture(shadowCanvas);
      this.aircraftShadowTextures.set(spec.id, shadowTex);
      this.aircraftShadowTextures.set(spec.file.replace('.png', ''), shadowTex);

      // Also load pre-generated Nano Banana sprite and blend texture detail inside the crisp vector mask
      this._loadNanoBananaImage([`./assets/textures/${spec.file}`], (img) => {
        this._drawCrispVectorAircraft(bodyCanvas, spec, img);
        bodyTex.needsUpdate = true;
        this._buildSilhouetteFromCanvas(bodyCanvas, shadowCanvas);
        shadowTex.needsUpdate = true;
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      });
    }

    // Preload all 3 Nano Banana terrain maps at startup so switching maps is instant
    for (const mapStem of ['map_classic_outback', 'map_tropical_island', 'map_alpine_winter']) {
      this._loadNanoBananaImage(
        [`./assets/textures/${mapStem}.png`, `./assets/textures/${mapStem}.jpg`],
        () => {}
      );
    }
  }

  _drawCrispVectorAircraft(canvas, spec, nanoImg) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;

    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // Once the pre-generated Nano Banana top-down aircraft sprite loads, draw it at 100% full-bleed fidelity!
    if (nanoImg) {
      ctx.drawImage(nanoImg, 12, 12, w - 24, h - 24);
      ctx.restore();
      return;
    }

    // All aircraft face RIGHT (+X, 0 radians) in local texture space
    if (spec.id === 'jet_red') {
      // Swept-wing 1950s/1960s Commercial Jetliner (exact match to Screenshot 1 & 4 white/orange/red jet!)
      const drawAirframePath = () => {
        ctx.beginPath();
        // Nose at (+210, 0)
        ctx.moveTo(cx + 210, cy);
        // Upper fuselage to wing root
        ctx.quadraticCurveTo(cx + 185, cy - 32, cx + 65, cy - 34);
        // Swept left wing leading edge
        ctx.lineTo(cx - 55, cy - 215);
        ctx.quadraticCurveTo(cx - 82, cy - 222, cx - 95, cy - 198);
        // Left wing trailing edge back to fuselage
        ctx.lineTo(cx - 42, cy - 32);
        // Rear fuselage taper to swept tailplane
        ctx.lineTo(cx - 135, cy - 22);
        ctx.lineTo(cx - 195, cy - 92);
        ctx.lineTo(cx - 218, cy - 82);
        ctx.lineTo(cx - 185, cy - 14);
        ctx.lineTo(cx - 215, cy);
        // Mirror lower half (right wing)
        ctx.lineTo(cx - 185, cy + 14);
        ctx.lineTo(cx - 218, cy + 82);
        ctx.lineTo(cx - 195, cy + 92);
        ctx.lineTo(cx - 135, cy + 22);
        ctx.lineTo(cx - 42, cy + 32);
        ctx.lineTo(cx - 95, cy + 198);
        ctx.quadraticCurveTo(cx - 82, cy + 222, cx - 55, cy + 215);
        ctx.lineTo(cx + 65, cy + 34);
        ctx.quadraticCurveTo(cx + 185, cy + 32, cx + 210, cy);
        ctx.closePath();
      };

      // Under-wing twin engine nacelles
      ctx.fillStyle = '#33363b';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.roundRect(cx - 5, cy + s * 98 - 16, 68, 32, 10);
        ctx.fill();
        ctx.fillStyle = '#e8ecf2';
        ctx.beginPath();
        ctx.roundRect(cx + 2, cy + s * 98 - 12, 54, 24, 8);
        ctx.fill();
        ctx.fillStyle = '#ff6b1a';
        ctx.fillRect(cx + 42, cy + s * 98 - 10, 12, 20);
        ctx.fillStyle = '#33363b';
      }

      // Dark charcoal comic outline
      drawAirframePath();
      ctx.lineWidth = 22;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#32353a';
      ctx.stroke();

      // Glossy 3D shaded white airframe fill
      const bodyGrad = ctx.createLinearGradient(0, cy - 180, 0, cy + 180);
      bodyGrad.addColorStop(0, '#ffffff');
      bodyGrad.addColorStop(0.5, '#f4f6f9');
      bodyGrad.addColorStop(1, '#d6dce4');
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Clip inside airframe to blend Nano Banana texture + crisp wing tips & tail stripe
      ctx.save();
      drawAirframePath();
      ctx.clip();
      if (nanoImg) {
        ctx.globalAlpha = 0.25;
        ctx.drawImage(nanoImg, 0, 0, w, h);
        ctx.globalAlpha = 1.0;
      }
      // Red/orange wingtip & tail fin accents (matching Screenshot 1 & 4)
      ctx.fillStyle = '#ff453a';
      ctx.fillRect(cx - 110, cy - 230, 70, 52);
      ctx.fillRect(cx - 110, cy + 178, 70, 52);
      ctx.fillStyle = '#ff9f0a';
      ctx.fillRect(cx - 220, cy - 95, 45, 25);
      ctx.fillRect(cx - 220, cy + 70, 45, 25);
      ctx.restore();

      // Vertical tail stabilizer fin ridge with golden/red stripe
      ctx.fillStyle = '#ff9f0a';
      ctx.beginPath();
      ctx.roundRect(cx - 205, cy - 7, 82, 14, 7);
      ctx.fill();

      // Wrap-around dark cockpit windshield
      ctx.fillStyle = '#252a34';
      ctx.beginPath();
      ctx.moveTo(cx + 162, cy - 18);
      ctx.quadraticCurveTo(cx + 188, cy, cx + 162, cy + 18);
      ctx.lineTo(cx + 138, cy + 13);
      ctx.quadraticCurveTo(cx + 154, cy, cx + 138, cy - 13);
      ctx.closePath();
      ctx.fill();
    } else if (spec.id === 'heli_blue') {
      // Vintage Rescue / Transport Helicopter (matching Screenshot 1 top-left blue chopper!)
      // Landing skids
      ctx.strokeStyle = '#32353a';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx - 35, cy + s * 68);
        ctx.lineTo(cx + 85, cy + s * 68);
        ctx.stroke();
        // Struts
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy + s * 35);
        ctx.lineTo(cx - 10, cy + s * 68);
        ctx.moveTo(cx + 45, cy + s * 35);
        ctx.lineTo(cx + 45, cy + s * 68);
        ctx.stroke();
      }

      const drawHeliBody = () => {
        ctx.beginPath();
        // Tail boom (-185 to -35) + horizontal stabilizer
        ctx.moveTo(cx - 185, cy - 6);
        ctx.lineTo(cx - 145, cy - 8);
        ctx.lineTo(cx - 145, cy - 48);
        ctx.lineTo(cx - 122, cy - 48);
        ctx.lineTo(cx - 118, cy - 10);
        ctx.lineTo(cx - 35, cy - 16);
        // Rounded bubble cabin
        ctx.bezierCurveTo(cx - 10, cy - 66, cx + 95, cy - 66, cx + 125, cy);
        ctx.bezierCurveTo(cx + 95, cy + 66, cx - 10, cy + 66, cx - 35, cy + 16);
        ctx.lineTo(cx - 118, cy + 10);
        ctx.lineTo(cx - 122, cy + 48);
        ctx.lineTo(cx - 145, cy + 48);
        ctx.lineTo(cx - 145, cy + 8);
        ctx.lineTo(cx - 185, cy + 6);
        ctx.closePath();
      };

      drawHeliBody();
      ctx.lineWidth = 20;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2d333b';
      ctx.stroke();

      const heliGrad = ctx.createLinearGradient(0, cy - 65, 0, cy + 65);
      heliGrad.addColorStop(0, '#9bd5f5');
      heliGrad.addColorStop(0.5, '#72bce8');
      heliGrad.addColorStop(1, '#4ea0d4');
      ctx.fillStyle = heliGrad;
      ctx.fill();

      ctx.save();
      drawHeliBody();
      ctx.clip();
      if (nanoImg) {
        ctx.globalAlpha = 0.25;
        ctx.drawImage(nanoImg, 0, 0, w, h);
        ctx.globalAlpha = 1.0;
      }
      // White cabin stripe & glass canopy
      ctx.fillStyle = '#e8f4fc';
      ctx.fillRect(cx - 30, cy - 14, 110, 28);
      ctx.fillStyle = '#263545';
      ctx.beginPath();
      ctx.arc(cx + 78, cy, 38, -Math.PI * 0.42, Math.PI * 0.42);
      ctx.fill();
      ctx.restore();
    } else {
      // Vintage Monoplanes (prop_yellow, prop_blue) & Twin-Float Seaplane (seaplane_green)
      const isSeaplane = spec.id === 'seaplane_green';

      if (isSeaplane) {
        // Twin amphibious pontoons underneath wings
        for (const s of [-1, 1]) {
          ctx.fillStyle = '#2b3238';
          ctx.beginPath();
          ctx.roundRect(cx - 65, cy + s * 88 - 16, 175, 32, 14);
          ctx.fill();
          ctx.fillStyle = '#f2ede2';
          ctx.beginPath();
          ctx.roundRect(cx - 59, cy + s * 88 - 11, 163, 22, 10);
          ctx.fill();
        }
      }

      const drawPropPath = () => {
        ctx.beginPath();
        // Nose spinner at (+165, 0)
        ctx.moveTo(cx + 170, cy);
        ctx.quadraticCurveTo(cx + 155, cy - 26, cx + 65, cy - 28);
        // Straight high wing (Screenshot 1 & 4 style)
        ctx.lineTo(cx + 58, cy - 195);
        ctx.quadraticCurveTo(cx + 55, cy - 212, cx + 32, cy - 212);
        ctx.lineTo(cx - 22, cy - 212);
        ctx.quadraticCurveTo(cx - 42, cy - 212, cx - 42, cy - 192);
        ctx.lineTo(cx - 38, cy - 26);
        // Rear fuselage to tailplane
        ctx.lineTo(cx - 135, cy - 16);
        ctx.lineTo(cx - 155, cy - 78);
        ctx.lineTo(cx - 185, cy - 72);
        ctx.lineTo(cx - 175, cy - 12);
        ctx.lineTo(cx - 192, cy);
        // Lower half mirror
        ctx.lineTo(cx - 175, cy + 12);
        ctx.lineTo(cx - 185, cy + 72);
        ctx.lineTo(cx - 155, cy + 78);
        ctx.lineTo(cx - 135, cy + 16);
        ctx.lineTo(cx - 38, cy + 26);
        ctx.lineTo(cx - 42, cy + 192);
        ctx.quadraticCurveTo(cx - 42, cy + 212, cx - 22, cy + 212);
        ctx.lineTo(cx + 32, cy + 212);
        ctx.quadraticCurveTo(cx + 55, cy + 212, cx + 58, cy + 195);
        ctx.lineTo(cx + 65, cy + 28);
        ctx.quadraticCurveTo(cx + 155, cy + 26, cx + 170, cy);
        ctx.closePath();
      };

      drawPropPath();
      ctx.lineWidth = 22;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#32353a';
      ctx.stroke();

      const bodyGrad = ctx.createLinearGradient(0, cy - 190, 0, cy + 190);
      bodyGrad.addColorStop(0, '#ffffff');
      bodyGrad.addColorStop(0.5, '#f2f4f7');
      bodyGrad.addColorStop(1, '#d5dbe3');
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      ctx.save();
      drawPropPath();
      ctx.clip();
      if (nanoImg) {
        ctx.globalAlpha = 0.25;
        ctx.drawImage(nanoImg, 0, 0, w, h);
        ctx.globalAlpha = 1.0;
      }

      // Colored wingtips, leading-edge stripe & tail fin (exact Argon readability!)
      ctx.fillStyle = spec.accent;
      ctx.fillRect(cx - 50, cy - 220, 115, 48);
      ctx.fillRect(cx - 50, cy + 172, 115, 48);
      ctx.fillRect(cx + 32, cy - 215, 28, 430);
      ctx.fillRect(cx - 190, cy - 82, 42, 164);
      ctx.restore();

      // Cockpit glass & nose cone
      ctx.fillStyle = '#252a34';
      ctx.beginPath();
      ctx.roundRect(cx + 52, cy - 17, 36, 34, 10);
      ctx.fill();

      ctx.fillStyle = spec.accent;
      ctx.beginPath();
      ctx.arc(cx + 158, cy, 18, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();
    }

    ctx.restore();
  }

  _buildSilhouetteFromCanvas(srcCanvas, dstCanvas) {
    const dctx = dstCanvas.getContext('2d');
    const w = dstCanvas.width;
    const h = dstCanvas.height;
    dctx.clearRect(0, 0, w, h);
    dctx.save();
    dctx.drawImage(srcCanvas, 0, 0, w, h);
    dctx.globalCompositeOperation = 'source-in';
    dctx.fillStyle = '#0c140e';
    dctx.fillRect(0, 0, w, h);
    dctx.restore();
  }

  _createPropBlurTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size * 0.5;

    const grad = ctx.createRadialGradient(c, c, 2, c, c, c * 0.85);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
    grad.addColorStop(0.55, 'rgba(220, 235, 255, 0.14)');
    grad.addColorStop(1, 'rgba(220, 235, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.85, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(40, 45, 52, 0.62)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c, 16);
    ctx.lineTo(c, size - 16);
    ctx.stroke();

    return setSRGB(new THREE.CanvasTexture(canvas));
  }

  _createRotorBlurTexture() {
    const size = 256;
    const discCanvas = document.createElement('canvas');
    discCanvas.width = size;
    discCanvas.height = size;
    const dctx = discCanvas.getContext('2d');
    const c = size * 0.5;

    const grad = dctx.createRadialGradient(c, c, 8, c, c, c * 0.94);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    grad.addColorStop(0.75, 'rgba(210, 235, 255, 0.28)');
    grad.addColorStop(0.92, 'rgba(255, 255, 255, 0.55)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    dctx.fillStyle = grad;
    dctx.beginPath();
    dctx.arc(c, c, c * 0.94, 0, Math.PI * 2);
    dctx.fill();

    const bladesCanvas = document.createElement('canvas');
    bladesCanvas.width = size;
    bladesCanvas.height = size;
    const bctx = bladesCanvas.getContext('2d');

    bctx.strokeStyle = 'rgba(38, 44, 52, 0.88)';
    bctx.lineWidth = 10;
    bctx.lineCap = 'round';
    bctx.beginPath();
    bctx.moveTo(14, c);
    bctx.lineTo(size - 14, c);
    bctx.moveTo(c, 14);
    bctx.lineTo(c, size - 14);
    bctx.stroke();

    // Yellow safety tips on rotor blades (like Screenshot 1 helicopter!)
    bctx.strokeStyle = '#ffd60a';
    bctx.lineWidth = 10;
    for (const [x1, y1, x2, y2] of [
      [14, c, 28, c],
      [size - 28, c, size - 14, c],
      [c, 14, c, 28],
      [c, size - 28, c, size - 14],
    ]) {
      bctx.beginPath();
      bctx.moveTo(x1, y1);
      bctx.lineTo(x2, y2);
      bctx.stroke();
    }

    bctx.fillStyle = '#32363d';
    bctx.beginPath();
    bctx.arc(c, c, 14, 0, Math.PI * 2);
    bctx.fill();

    return {
      disc: setSRGB(new THREE.CanvasTexture(discCanvas)),
      blades: setSRGB(new THREE.CanvasTexture(bladesCanvas)),
    };
  }

  _createWindsockTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const cY = 64;

    // Tapered windsock cone with 5 alternating orange & white bands (Screenshot 1 center!)
    const bands = 5;
    const startX = 12;
    const endX = 242;
    const totalW = endX - startX;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(startX, cY - 40);
    ctx.lineTo(endX, cY - 14);
    ctx.quadraticCurveTo(endX + 8, cY, endX, cY + 14);
    ctx.lineTo(startX, cY + 40);
    ctx.closePath();
    ctx.clip();

    for (let i = 0; i < bands; i++) {
      const bx = startX + (i * totalW) / bands;
      const bw = totalW / bands + 2;
      ctx.fillStyle = i % 2 === 0 ? '#ff6a1a' : '#fffdf8';
      ctx.fillRect(bx, 0, bw, 128);
    }

    // Top/bottom cylindrical shading
    const shGrad = ctx.createLinearGradient(0, cY - 42, 0, cY + 42);
    shGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    shGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.0)');
    shGrad.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    ctx.fillStyle = shGrad;
    ctx.fillRect(0, 0, 256, 128);
    ctx.restore();

    // Crisp outline
    ctx.beginPath();
    ctx.moveTo(startX, cY - 40);
    ctx.lineTo(endX, cY - 14);
    ctx.quadraticCurveTo(endX + 8, cY, endX, cY + 14);
    ctx.lineTo(startX, cY + 40);
    ctx.closePath();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#6e3212';
    ctx.stroke();

    return setSRGB(new THREE.CanvasTexture(canvas));
  }

  _createSelectionRingTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size * 0.5;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 6;
    ctx.setLineDash([16, 10]);
    ctx.beginPath();
    ctx.arc(c, c, 52, 0, Math.PI * 2);
    ctx.stroke();

    return setSRGB(new THREE.CanvasTexture(canvas));
  }

  // ===========================================================================
  // 3. PERIMETER WARNING '!' BADGES, EXPLOSION VFX & FLOATING PRAISE TEXT
  // ===========================================================================

  syncPerimeterWarnings(pendingSpawns, dt) {
    return this.updatePerimeterWarnings(pendingSpawns, dt, this.time);
  }

  updatePerimeterWarnings(pendingSpawns = [], dt = 0.016, time = this.time) {
    void dt;
    const seenIds = new Set();

    for (const spawn of pendingSpawns) {
      if (!spawn) continue;
      const id = spawn.id || `${spawn.classId}_${spawn.spawnX}_${spawn.spawnY}`;
      seenIds.add(id);

      let badge = this.perimeterBadges.get(id);
      if (!badge) {
        badge = this._createPerimeterWarningBadge(spawn);
        this.perimeterBadges.set(id, badge);
      }

      // Clamp position cleanly inside bezel edge (x in [-442..442], y in [-282..282])
      const rawX = (typeof spawn.edgeX === 'number') ? spawn.edgeX : (spawn.spawnX || 0);
      const rawY = (typeof spawn.edgeY === 'number') ? spawn.edgeY : (spawn.spawnY || 0);
      const bx = THREE.MathUtils.clamp(rawX, -442, 442);
      const by = THREE.MathUtils.clamp(rawY, -282, 282);
      badge.root.position.set(bx, by, 7.0);

      // Urgency pulse accelerates as timer approaches 0
      const timer = (typeof spawn.timer === 'number') ? spawn.timer : 1.5;
      const maxTimer = spawn.maxTimer || 3.0;
      const urgency = 1.0 - THREE.MathUtils.clamp(timer / maxTimer, 0, 1);
      const freq = 9.0 + urgency * 18.0;
      const isHeavyJet = spawn.classId === 'jet_red';
      const baseScale = isHeavyJet ? 1.18 : 1.0;
      const pulse = baseScale * (1.0 + (0.12 + urgency * 0.14) * Math.sin(time * freq));
      badge.root.scale.set(pulse, pulse, 1);

      // Rotate directional arrow toward entryHeading
      if (typeof spawn.entryHeading === 'number') {
        badge.arrowRing.rotation.z = spawn.entryHeading;
      }
    }

    for (const [id, badge] of this.perimeterBadges.entries()) {
      if (!seenIds.has(id)) {
        this.perimeterGroup.remove(badge.root);
        this.perimeterBadges.delete(id);
      }
    }
  }

  _createWarningBadgeBaseTexture() {
    // Iconic Argon Red Circular Exclamation Badge (!) with crisp white border (Screenshots 1, 2, 3)
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size * 0.5;

    // Drop shadow
    ctx.beginPath();
    ctx.arc(c + 3, c + 4, 48, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Outer white ring
    ctx.beginPath();
    ctx.arc(c, c, 48, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Vivid crimson red interior (#d61c1c)
    const redGrad = ctx.createRadialGradient(c - 10, c - 12, 6, c, c, 43);
    redGrad.addColorStop(0, '#f22e2e');
    redGrad.addColorStop(1, '#c41212');
    ctx.beginPath();
    ctx.arc(c, c, 42, 0, Math.PI * 2);
    ctx.fillStyle = redGrad;
    ctx.fill();

    // Bold italic white '!' exclamation mark
    ctx.save();
    ctx.translate(c + 2, c);
    ctx.transform(1, 0, -0.16, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-7, -27, 13, 33, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-0.5, 19, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    return setSRGB(new THREE.CanvasTexture(canvas));
  }

  _createPerimeterWarningBadge(spawn) {
    const root = new THREE.Group();

    const badgeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 38),
      new THREE.MeshBasicMaterial({
        map: this.warningBadgeTexture,
        transparent: true,
        depthWrite: false,
      })
    );
    root.add(badgeMesh);

    // Directional entry chevron + aircraft class color pip
    const arrowRing = new THREE.Group();
    const pipColor = spawn.colorHex || (spawn.classId === 'prop_yellow' ? 0xffd60a : (spawn.classId === 'prop_blue' ? 0x2ac3ff : 0xff3b30));
    const coneGeo = new THREE.ConeGeometry(5.5, 10, 3);
    const coneMat = new THREE.MeshBasicMaterial({ color: pipColor, depthWrite: false });
    const arrowMesh = new THREE.Mesh(coneGeo, coneMat);
    arrowMesh.rotation.z = -Math.PI * 0.5;
    arrowMesh.position.set(22, 0, 0.1);
    arrowRing.add(arrowMesh);
    root.add(arrowRing);

    this.perimeterGroup.add(root);
    return { root, badgeMesh, arrowRing };
  }

  spawnExplosion(x, y, planeA, planeB) {
    return this.triggerCrashVFX({ x, y, planeA, planeB });
  }

  _getComicBlastTexture() {
    if (this._comicBlastTex) return this._comicBlastTex;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size * 0.5;

    const traceScallopedCloud = (baseR, amp, lobes, phase = 0) => {
      ctx.beginPath();
      const steps = lobes * 12;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const r = baseR + amp * Math.abs(Math.sin(a * lobes * 0.5 + phase));
        const px = c + Math.cos(a) * r;
        const py = c + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    // Outer dark charcoal comic ink outline + crimson-orange blast cloud
    traceScallopedCloud(76, 26, 9, 0.2);
    ctx.fillStyle = '#ff4b1f';
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#26211e';
    ctx.stroke();

    // Middle golden-orange scalloped cloud
    traceScallopedCloud(54, 20, 8, 0.7);
    ctx.fillStyle = '#ffa818';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#c82812';
    ctx.stroke();

    // Inner spiked yellow-white comic star
    ctx.beginPath();
    const spikes = 12;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 52 : 24;
      const px = c + Math.cos(a) * r;
      const py = c + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#fff566';
    ctx.fill();

    this._comicBlastTex = setSRGB(new THREE.CanvasTexture(canvas));
    return this._comicBlastTex;
  }

  triggerCrashVFX(crashEvent = {}) {
    const x = typeof crashEvent.x === 'number' ? crashEvent.x : 0;
    const y = typeof crashEvent.y === 'number' ? crashEvent.y : 0;

    // Trigger 0.45s screen shake
    this.shakeDuration = 0.45;
    this.shakeTimer = 0.45;
    this.shakeIntensity = 12.0;

    const root = new THREE.Group();
    root.position.set(x, y, 8.0);
    this.vfxGroup.add(root);

    const particles = [];

    // 1. Expanding Shockwave Ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfff3b0,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(18, 24, 32), ringMat);
    root.add(ringMesh);

    // 2. Illustrated Scalloped Comic-Strip Blast Cloud
    const blastTex = this._getComicBlastTexture();
    const flashMat = new THREE.MeshBasicMaterial({
      map: blastTex,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
    const flashMesh = new THREE.Mesh(new THREE.PlaneGeometry(88, 88), flashMat);
    flashMesh.position.z = 0.28;
    root.add(flashMesh);

    // 3. Billowing Comic Smoke Puffs & Secondary Scalloped Fireballs
    for (let i = 0; i < 16; i++) {
      const isSmoke = i >= 9;
      const rad = isSmoke ? (26 + Math.random() * 14) : (32 + Math.random() * 16);
      const mat = new THREE.MeshBasicMaterial({
        map: blastTex,
        color: isSmoke ? 0x5c5552 : 0xffffff,
        transparent: true,
        opacity: isSmoke ? 0.85 : 0.96,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(rad, rad), mat);
      const ang = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const spd = (isSmoke ? 40 : 64) + Math.random() * 48;
      mesh.position.set(Math.cos(ang) * 5, Math.sin(ang) * 5, isSmoke ? 0.08 : 0.22);
      mesh.rotation.z = Math.random() * Math.PI * 2;
      root.add(mesh);
      particles.push({
        mesh,
        mat,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        vRot: (Math.random() - 0.5) * 3.5,
        scaleRate: isSmoke ? 1.4 : 0.95,
        fadeDelay: isSmoke ? 0.42 : 0.18,
        maxLife: isSmoke ? 1.55 : 0.92,
      });
    }

    // 4. 18 Spinning Metallic Aircraft Debris Shards
    const colA = crashEvent.planeA?.colorHex || 0xff3b30;
    const colB = crashEvent.planeB?.colorHex || 0xffd60a;
    const shardColors = [colA, colB, 0xffffff, 0xd8dee9, 0x3b4252];
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: shardColors[i % shardColors.length],
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
      });
      const w = 5.5 + Math.random() * 7;
      const h = 2.8 + Math.random() * 4;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      const ang = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const spd = 95 + Math.random() * 135;
      mesh.position.set(0, 0, 0.35);
      mesh.rotation.z = Math.random() * Math.PI * 2;
      root.add(mesh);
      particles.push({
        mesh,
        mat,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        vRot: (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 12),
        scaleRate: -0.25,
        fadeDelay: 0.45,
        maxLife: 1.35,
      });
    }

    this.activeExplosions.push({
      root,
      ringMesh,
      ringMat,
      flashMesh,
      flashMat,
      particles,
      age: 0,
      duration: 1.65,
    });
  }

  _updateExplosions(dt) {
    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      const ex = this.activeExplosions[i];
      ex.age += dt;

      // Shockwave ring expansion
      const ringT = Math.min(1, ex.age / 0.55);
      const rScale = 0.5 + ringT * 3.8;
      ex.ringMesh.scale.set(rScale, rScale, 1);
      ex.ringMat.opacity = Math.max(0, 1.0 - ringT);

      // Core comic blast cloud expansion
      const flashT = Math.min(1, ex.age / 0.65);
      const fScale = 0.85 + Math.sin(Math.min(1, ex.age / 0.25) * Math.PI * 0.5) * 0.55;
      ex.flashMesh.scale.set(fScale, fScale, 1);
      ex.flashMesh.rotation.z = ex.age * 0.8;
      ex.flashMat.opacity = Math.max(0, 1.0 - Math.max(0, (flashT - 0.35) / 0.65));

      // Fireballs, smoke & spinning shards
      for (const p of ex.particles) {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.vx *= Math.pow(0.18, dt);
        p.vy *= Math.pow(0.18, dt);
        p.mesh.rotation.z += p.vRot * dt;
        const s = Math.max(0.1, p.mesh.scale.x + p.scaleRate * dt);
        p.mesh.scale.set(s, s, 1);
        if (ex.age > p.fadeDelay) {
          const fadeT = (ex.age - p.fadeDelay) / Math.max(0.1, p.maxLife - p.fadeDelay);
          p.mat.opacity = Math.max(0, 1.0 - fadeT);
        }
      }

      if (ex.age >= ex.duration) {
        this.vfxGroup.remove(ex.root);
        this.activeExplosions.splice(i, 1);
      }
    }
  }

  showPraiseFloater(x, y, text, colorHex) {
    return this.spawnPraiseFloater(x, y, text, colorHex);
  }

  spawnPraiseFloater(x = 0, y = 0, text = 'YOU BEWDY!', colorHex = 0xffffff) {
    // Exact match to Screenshot 3 ("COMMENDABLE" bold condensed tilted retro display text!)
    // Enhanced with a crisp dark charcoal outline + drop shadow so it pops over snow and cream concrete!
    const label = String(text || 'YOU BEWDY!').toUpperCase();
    const cW = 640;
    const cH = 140;
    const canvas = document.createElement('canvas');
    canvas.width = cW;
    canvas.height = cH;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.translate(cW * 0.5, cH * 0.55);
    ctx.font = 'italic 900 66px "Arial Narrow", "Impact", "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    // Deep dark drop-shadow
    ctx.fillStyle = 'rgba(12, 20, 30, 0.68)';
    ctx.fillText(label, 5, 6);

    // High-contrast dark charcoal/navy outer stroke so white lettering pops on snow & concrete
    ctx.strokeStyle = 'rgba(18, 28, 40, 0.90)';
    ctx.lineWidth = 10;
    ctx.strokeText(label, 0, 0);

    // Subtle colored inner rim accent if non-white
    if (colorHex && colorHex !== 0xffffff) {
      ctx.strokeStyle = hexToCss(colorHex, '#ffd60a');
      ctx.lineWidth = 4;
      ctx.strokeText(label, 0, 0);
    }

    // Crisp warm white main lettering (Screenshot 3)
    ctx.fillStyle = '#fffdf8';
    ctx.fillText(label, 0, 0);
    ctx.restore();

    const tex = setSRGB(new THREE.CanvasTexture(canvas));
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(240, 52), mat);
    const clampedX = THREE.MathUtils.clamp(x, -310, 310);
    const clampedY = THREE.MathUtils.clamp(y + 18, -230, 230);
    mesh.position.set(clampedX, clampedY, 9.0);
    // Tilted ~7 degrees counter-clockwise like Screenshot 3
    mesh.rotation.z = 0.12;
    mesh.scale.set(0.01, 0.01, 1);

    this.floaterGroup.add(mesh);
    this.activeFloaters.push({
      mesh,
      mat,
      tex,
      age: 0,
      duration: 1.45,
      vy: 24,
    });
  }

  _updatePraiseFloaters(dt) {
    for (let i = this.activeFloaters.length - 1; i >= 0; i--) {
      const fl = this.activeFloaters[i];
      fl.age += dt;
      fl.mesh.position.y += fl.vy * dt;

      // Elastic spring bounce pop-in over first 0.24s
      let scale = 1.0;
      if (fl.age < 0.24) {
        const t = fl.age / 0.24;
        scale = 1.0 + Math.sin(t * Math.PI * 1.35) * 0.22 * (1 - t * 0.3) * t;
        scale = Math.max(0.1, t * 1.15);
      } else if (fl.age < 0.34) {
        const t = (fl.age - 0.24) / 0.10;
        scale = 1.15 - 0.15 * t;
      }
      fl.mesh.scale.set(scale, scale, 1);

      if (fl.age > 0.85) {
        const fade = (fl.age - 0.85) / (fl.duration - 0.85);
        fl.mat.opacity = Math.max(0, 1.0 - fade);
      }

      if (fl.age >= fl.duration) {
        this.floaterGroup.remove(fl.mesh);
        fl.tex.dispose();
        fl.mat.dispose();
        this.activeFloaters.splice(i, 1);
      }
    }
  }

  // ===========================================================================
  // 4. AUTHENTIC ARGON BEZEL HUD, WENDY TOASTS & 1950S ARGON AIRWAYS CLIPBOARD UI
  // ===========================================================================

  _initDOMStructure(opts) {
    this._injectStylesheet();

    // Find or create outer bezel frame container
    this.container = opts.container ||
      document.getElementById('flight-control-app') ||
      document.getElementById('game-container') ||
      document.getElementById('app') ||
      document.body;

    let bezelEl = document.getElementById('fc-bezel-frame');
    if (!bezelEl) {
      bezelEl = document.createElement('div');
      bezelEl.id = 'fc-bezel-frame';
      bezelEl.className = 'fc-bezel-frame';
      this.container.appendChild(bezelEl);
    }
    this.bezelEl = bezelEl;

    // Inner viewport holding the Three.js canvas + HUD overlay
    let viewportEl = document.getElementById('fc-viewport');
    if (!viewportEl) {
      viewportEl = document.createElement('div');
      viewportEl.id = 'fc-viewport';
      viewportEl.className = 'fc-viewport';
      bezelEl.appendChild(viewportEl);
    }
    this.viewportEl = viewportEl;

    // Canvas
    let canvas = opts.canvas || document.getElementById('game-canvas') || document.getElementById('fc-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'fc-canvas';
      viewportEl.appendChild(canvas);
    } else if (canvas.parentElement !== viewportEl) {
      viewportEl.appendChild(canvas);
    }
    this.canvas = canvas;
    this.canvas.classList.add('fc-webgl-canvas');

    // Build Top HUD Bar, Bottom Corner Tabs, Wendy Toast & Argon Airways Clipboard Modal
    let hudRoot = document.getElementById('fc-hud-overlay');
    if (!hudRoot) {
      hudRoot = document.createElement('div');
      hudRoot.id = 'fc-hud-overlay';
      hudRoot.className = 'fc-hud-overlay';
      hudRoot.innerHTML = `
        <!-- Top Argon Split-Flap Score Bar & Map Switcher -->
        <div class="fc-top-bar">
          <div class="fc-score-group" id="fc-landed-group">
            <span class="fc-score-label">AIRCRAFT LANDED:</span>
            <div class="fc-odometer" id="fc-landed-odometer" aria-label="Aircraft Landed">
              ${this._renderFlapDigitsHTML('00000')}
            </div>
          </div>

          <div class="fc-center-controls">
            <div class="fc-map-pills" role="tablist" aria-label="Select Airfield Map">
              <button type="button" class="fc-map-pill active" data-map-id="classic_outback" title="Classic Outback Airfield">Outback</button>
              <button type="button" class="fc-map-pill" data-map-id="tropical_island" title="Paradise Beach Resort">Paradise Beach</button>
              <button type="button" class="fc-map-pill" data-map-id="alpine_winter" title="Alpine Glacier & Peak">Alpine Snow</button>
            </div>
            <button type="button" class="fc-icon-btn" id="fc-rush-btn" title="Spawn Rush Wave (+Traffic)">+WAVE</button>
            <button type="button" class="fc-icon-btn" id="fc-mute-btn" title="Toggle Lounge Audio" aria-label="Toggle Audio">
              <svg viewBox="0 0 18 16" width="13" height="12" aria-hidden="true" style="vertical-align: -1px;">
                <polygon points="1,5 5,5 10,1 10,15 5,11 1,11" fill="currentColor"/>
                <path d="M12.5,4.2 C14.0,5.6 14.0,10.4 12.5,11.8 M14.8,2.0 C17.3,4.5 17.3,11.5 14.8,14.0" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="fc-score-group" id="fc-hiscore-group">
            <span class="fc-score-label">HI SCORE:</span>
            <div class="fc-odometer" id="fc-hiscore-odometer" aria-label="High Score">
              ${this._renderFlapDigitsHTML('00000')}
            </div>
          </div>
        </div>

        <!-- Wendy the Stewardess / ATC Vintage Airmail Callout Toast -->
        <div class="fc-wendy-toast hidden" id="fc-wendy-toast" role="status" aria-live="polite">
          <div class="fc-wendy-airmail-strip"></div>
          <div class="fc-wendy-toast-body">
            <div class="fc-wendy-portrait-wrap">
              <img id="fc-wendy-toast-img" src="${resolveAssetUrl('./assets/textures/hostess_wendy.png')}" alt="Stewardess Wendy" />
            </div>
            <div class="fc-wendy-speech">
              <div class="fc-wendy-speaker" id="fc-wendy-speaker">WENDY • ARGON CABIN PA</div>
              <div class="fc-wendy-text" id="fc-wendy-text">"Welcome aboard, guest! Clear skies ahead at the airfield."</div>
            </div>
          </div>
        </div>

        <!-- Bottom-Left Brushed Metallic Fast-Forward Tab (>>) -->
        <button type="button" class="fc-corner-tab fc-corner-left" id="fc-ff-btn" title="Fast Forward (2x Airspace Speed)" aria-label="Fast Forward">
          <svg viewBox="0 0 38 24" width="28" height="18" aria-hidden="true">
            <polygon points="3,2 19,12 3,22" fill="currentColor"/>
            <polygon points="19,2 35,12 19,22" fill="currentColor"/>
          </svg>
          <span class="fc-ff-badge" id="fc-ff-badge">2X</span>
        </button>

        <!-- Bottom-Right Brushed Metallic Pause Tab (||) -->
        <button type="button" class="fc-corner-tab fc-corner-right" id="fc-pause-btn" title="Pause / Flight Log Clipboard" aria-label="Pause Game">
          <svg viewBox="0 0 28 24" width="22" height="18" aria-hidden="true">
            <rect x="4" y="2" width="6.5" height="20" rx="2" fill="currentColor"/>
            <rect x="17.5" y="2" width="6.5" height="20" rx="2" fill="currentColor"/>
          </svg>
        </button>

        <!-- 1950s Argon Airways Vintage Clipboard Scorecard Modal (Game Over / Pause / Briefing) -->
        <div class="fc-clipboard-backdrop hidden" id="fc-clipboard-modal" role="dialog" aria-modal="true">
          <div class="fc-clipboard-wood-desk">
            <div class="fc-clipboard-sheet">
              <div class="fc-clipboard-metal-clip">
                <div class="fc-clip-rivet"></div>
                <span>ARGON AIRWAYS • OFFICIAL FLIGHT LOG</span>
                <div class="fc-clip-rivet"></div>
              </div>
              <div class="fc-airmail-border-inner">
                <div class="fc-clipboard-header">
                  <div class="fc-clipboard-portrait-frame">
                    <img id="fc-modal-hostess-img" src="${resolveAssetUrl('./assets/textures/hostess_wendy.png')}" alt="Hostess Wendy" />
                  </div>
                  <div class="fc-clipboard-title-block">
                    <div class="fc-clipboard-kicker" id="fc-modal-kicker">DEPARTMENT OF CIVIL AVIATION • 1958</div>
                    <h2 class="fc-clipboard-title" id="fc-modal-title">ARGON AIRSPACE LOG</h2>
                    <p class="fc-clipboard-quote" id="fc-modal-quote">"Guide each aircraft safely to its matching colored runway or helipad!"</p>
                  </div>
                </div>

                <!-- Animated Red Ink Rubber Stamp -->
                <div class="fc-rubber-stamp" id="fc-modal-stamp">FLIGHT LOG TERMINATED — MID-AIR COLLISION</div>

                <!-- Score Summary Ledger -->
                <div class="fc-ledger-grid">
                  <div class="fc-ledger-cell">
                    <span class="fc-ledger-label">AIRCRAFT LANDED</span>
                    <span class="fc-ledger-value" id="fc-modal-landed">00000</span>
                  </div>
                  <div class="fc-ledger-cell">
                    <span class="fc-ledger-label">PERSONAL BEST</span>
                    <span class="fc-ledger-value" id="fc-modal-hiscore">00000</span>
                  </div>
                  <div class="fc-ledger-cell">
                    <span class="fc-ledger-label">ACTIVE SECTOR</span>
                    <span class="fc-ledger-value fc-ledger-sector" id="fc-modal-sector">Classic Outback</span>
                  </div>
                </div>

                <!-- Airfield Sector Selection Cards inside Clipboard -->
                <div class="fc-modal-map-row">
                  <button type="button" class="fc-sector-card active" data-sector-id="classic_outback">
                    <span class="fc-sector-name">Classic Outback</span>
                    <span class="fc-sector-meta">3 Runways • 2 Helipads</span>
                  </button>
                  <button type="button" class="fc-sector-card" data-sector-id="tropical_island">
                    <span class="fc-sector-name">Paradise Beach</span>
                    <span class="fc-sector-meta">Seaplanes • Island Resort</span>
                  </button>
                  <button type="button" class="fc-sector-card" data-sector-id="alpine_winter">
                    <span class="fc-sector-name">Alpine Glacier</span>
                    <span class="fc-sector-meta">Snow Runways • Fjord</span>
                  </button>
                </div>

                <!-- Action Buttons -->
                <div class="fc-clipboard-actions">
                  <button type="button" class="fc-btn-secondary hidden" id="fc-modal-resume-btn">RESUME FLIGHT ▶</button>
                  <button type="button" class="fc-btn-primary" id="fc-modal-restart-btn">FLY AGAIN ✈</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      viewportEl.appendChild(hudRoot);
    }
    this.hudRoot = hudRoot;

    this._bindHUDListeners();
    this._applyVintageUITextures();
  }

  _renderFlapDigitsHTML(digitsStr) {
    const padded = String(digitsStr).padStart(5, '0').slice(-5);
    return padded
      .split('')
      .map(
        (d, idx) => `
        <span class="fc-flap-card" data-digit-idx="${idx}">
          <span class="fc-flap-val">${d}</span>
          <span class="fc-flap-split"></span>
        </span>`
      )
      .join('');
  }

  _bindHUDListeners() {
    // Map switcher pills
    const pills = this.hudRoot.querySelectorAll('.fc-map-pill');
    pills.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mapId = btn.getAttribute('data-map-id');
        if (mapId && this.callbacks.onSelectMap) {
          this.callbacks.onSelectMap(mapId);
        } else if (mapId) {
          this.buildMapScene(mapId);
        }
      });
    });

    // Clipboard sector cards
    const sectorCards = this.hudRoot.querySelectorAll('.fc-sector-card');
    sectorCards.forEach((card) => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const mapId = card.getAttribute('data-sector-id');
        if (!mapId) return;
        this._updateActiveMapPillUI(mapId);
        if (this.callbacks.onSelectMap) {
          this.callbacks.onSelectMap(mapId);
        } else {
          this.buildMapScene(mapId);
        }
      });
    });

    // Fast-Forward button (>>)
    const ffBtn = document.getElementById('fc-ff-btn');
    if (ffBtn) {
      ffBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onToggleFastForward) {
          this.callbacks.onToggleFastForward();
        } else {
          this.setFastForwardState(!this.fastForwardActive);
        }
      });
    }

    // Pause button (||)
    const pauseBtn = document.getElementById('fc-pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onTogglePause) {
          this.callbacks.onTogglePause();
        }
      });
    }

    // Mute toggle button
    const muteBtn = document.getElementById('fc-mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onToggleMute) {
          this.callbacks.onToggleMute();
        } else {
          this.setMuteState(!this.isMuted);
        }
      });
    }

    // Rush wave button
    const rushBtn = document.getElementById('fc-rush-btn');
    if (rushBtn) {
      rushBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onTriggerRushWave) {
          this.callbacks.onTriggerRushWave();
        }
      });
    }

    // Modal Restart / Resume buttons
    const restartBtn = document.getElementById('fc-modal-restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideClipboardModal();
        if (this.callbacks.onRestartGame) {
          this.callbacks.onRestartGame(this.currentMapId);
        }
      });
    }

    const resumeBtn = document.getElementById('fc-modal-resume-btn');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideClipboardModal();
        if (this.callbacks.onResumeGame) {
          this.callbacks.onResumeGame();
        } else if (this.callbacks.onTogglePause) {
          this.callbacks.onTogglePause();
        }
      });
    }
  }

  _applyVintageUITextures() {
    const desk = this.hudRoot.querySelector('.fc-clipboard-wood-desk');
    const sheet = this.hudRoot.querySelector('.fc-clipboard-sheet');
    if (desk) {
      const woodUrl = resolveAssetUrl('./assets/textures/ui_wood_tabletop.png');
      desk.style.backgroundImage = `linear-gradient(rgba(36, 20, 10, 0.45), rgba(24, 12, 6, 0.65)), url("${woodUrl}")`;
    }
    if (sheet) {
      const parchUrl = resolveAssetUrl('./assets/textures/ui_parchment_clipboard.png');
      sheet.style.backgroundImage = `linear-gradient(rgba(251, 244, 228, 0.90), rgba(242, 231, 206, 0.92)), url("${parchUrl}")`;
    }

    // Fallback portrait canvas if hostess PNG hasn't finished generating yet
    const fallbackDataUrl = this._createFallbackWendyPortraitDataURL();
    for (const imgId of ['fc-wendy-toast-img', 'fc-modal-hostess-img']) {
      const imgEl = document.getElementById(imgId);
      if (imgEl) {
        imgEl.onerror = () => {
          imgEl.onerror = null;
          imgEl.src = fallbackDataUrl;
        };
      }
    }
  }

  _createFallbackWendyPortraitDataURL() {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 160;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d8ecf8';
    ctx.fillRect(0, 0, 160, 160);
    // Warm vintage Argon Airways stewardess silhouette in pillbox hat
    ctx.fillStyle = '#1b365d';
    ctx.beginPath();
    ctx.ellipse(80, 145, 52, 34, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(64, 112);
    ctx.lineTo(80, 136);
    ctx.lineTo(96, 112);
    ctx.fill();
    ctx.fillStyle = '#f9d4b4';
    ctx.beginPath();
    ctx.arc(80, 78, 28, 0, Math.PI * 2);
    ctx.fill();
    // Navy pillbox hat with gold wing pin
    ctx.fillStyle = '#1b365d';
    ctx.beginPath();
    ctx.roundRect(52, 36, 56, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.arc(80, 47, 5, 0, Math.PI * 2);
    ctx.fill();
    return c.toDataURL('image/png');
  }

  setScore(landedCount, highScore) {
    this.updateHUD({ landedCount, highScore });
  }

  updateHUD(state = {}) {
    if (typeof state.landedCount === 'number') {
      const nextLanded = String(Math.max(0, Math.floor(state.landedCount))).padStart(5, '0').slice(-5);
      if (nextLanded !== this.lastLandedDigits) {
        this._animateOdometer('fc-landed-odometer', this.lastLandedDigits, nextLanded);
        this.lastLandedDigits = nextLanded;
      }
    }
    if (typeof state.highScore === 'number') {
      const nextHigh = String(Math.max(0, Math.floor(state.highScore))).padStart(5, '0').slice(-5);
      if (nextHigh !== this.lastHighDigits) {
        this._animateOdometer('fc-hiscore-odometer', this.lastHighDigits, nextHigh);
        this.lastHighDigits = nextHigh;
      }
    }
    if (typeof state.mapId === 'string' && state.mapId !== this.currentMapId) {
      this._updateActiveMapPillUI(state.mapId);
    }
    if (typeof state.fastForward === 'boolean') {
      this.setFastForwardState(state.fastForward);
    }
    if (typeof state.isPaused === 'boolean') {
      this.isPaused = state.isPaused;
    }
    if (typeof state.isMuted === 'boolean') {
      this.setMuteState(state.isMuted);
    }
  }

  _animateOdometer(containerId, prevStr, nextStr) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const cards = el.querySelectorAll('.fc-flap-card');
    for (let i = 0; i < 5; i++) {
      const card = cards[i];
      if (!card) continue;
      const valSpan = card.querySelector('.fc-flap-val');
      if (valSpan && prevStr[i] !== nextStr[i]) {
        valSpan.textContent = nextStr[i];
        card.classList.remove('flipping');
        void card.offsetWidth;
        card.classList.add('flipping');
      }
    }
  }

  _updateActiveMapPillUI(mapId) {
    if (!this.hudRoot) return;
    const pills = this.hudRoot.querySelectorAll('.fc-map-pill');
    pills.forEach((p) => {
      p.classList.toggle('active', p.getAttribute('data-map-id') === mapId);
    });
    const cards = this.hudRoot.querySelectorAll('.fc-sector-card');
    cards.forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-sector-id') === mapId);
    });
  }

  setFastForwardState(active) {
    this.fastForwardActive = Boolean(active);
    const ffBtn = document.getElementById('fc-ff-btn');
    if (ffBtn) {
      ffBtn.classList.toggle('active', this.fastForwardActive);
    }
  }

  setMuteState(muted) {
    this.isMuted = Boolean(muted);
    const muteBtn = document.getElementById('fc-mute-btn');
    if (muteBtn) {
      muteBtn.innerHTML = this.isMuted
        ? `<svg viewBox="0 0 18 16" width="13" height="12" aria-hidden="true" style="vertical-align: -1px;"><polygon points="1,5 5,5 10,1 10,15 5,11 1,11" fill="currentColor"/><path d="M12.5,5.0 L16.8,11.0 M16.8,5.0 L12.5,11.0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`
        : `<svg viewBox="0 0 18 16" width="13" height="12" aria-hidden="true" style="vertical-align: -1px;"><polygon points="1,5 5,5 10,1 10,15 5,11 1,11" fill="currentColor"/><path d="M12.5,4.2 C14.0,5.6 14.0,10.4 12.5,11.8 M14.8,2.0 C17.3,4.5 17.3,11.5 14.8,14.0" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
      muteBtn.classList.toggle('muted', this.isMuted);
    }
  }

  onVoiceSubtitle(speaker, text, hostessKey) {
    this.showWendyToast(speaker, text, hostessKey);
  }

  showVoiceToast(speaker, text, hostessKey, durationMs = 4200) {
    this.showWendyToast(speaker, text, hostessKey, durationMs);
  }

  showWendyToast(speaker = 'WENDY • ARGON STEWARDESS', text = '', hostessKey = null, durationMs = 4200) {
    const toast = document.getElementById('fc-wendy-toast');
    const speakerEl = document.getElementById('fc-wendy-speaker');
    const textEl = document.getElementById('fc-wendy-text');
    const imgEl = document.getElementById('fc-wendy-toast-img');
    if (!toast || !text) return;

    const portraitKey = hostessKey || this.currentMapDef?.hostessKey || 'hostess_wendy';
    if (imgEl) {
      imgEl.src = resolveAssetUrl(`./assets/textures/${portraitKey}.png`);
    }
    if (speakerEl) {
      speakerEl.textContent = String(speaker || 'WENDY • ARGON STEWARDESS').toUpperCase();
    }
    if (textEl) {
      textEl.textContent = `"${String(text).replace(/^["']|["']$/g, '')}"`;
    }

    toast.classList.remove('hidden');
    if (this._wendyToastTimer) {
      clearTimeout(this._wendyToastTimer);
    }
    this._wendyToastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, durationMs);
  }

  _getCaptainPortraitForClass(classId) {
    if (classId === 'jet_red') return 'captain_jet';
    if (classId === 'seaplane_green') return 'captain_seaplane';
    if (classId === 'heli_blue') return 'captain_chopper';
    if (classId === 'prop_yellow' || classId === 'prop_blue') return 'captain_bush';
    return 'captain_jet';
  }

  showGameOverModal(info = {}) {
    const landed = info.landedCount ?? parseInt(this.lastLandedDigits, 10) ?? 0;
    const high = Math.max(landed, info.highScore ?? parseInt(this.lastHighDigits, 10) ?? 0);
    const isNewRecord = Boolean(info.isNewRecord || (landed > 0 && landed >= high));
    const crashClassId =
      info.crashEvent?.planeA?.classId ||
      info.crashEvent?.planeB?.classId ||
      'jet_red';
    const portraitKey =
      info.portraitKey || this._getCaptainPortraitForClass(crashClassId);

    this.showClipboardModal({
      mode: 'gameover',
      kicker: 'CIVIL AVIATION INCIDENT REPORT • FORM 1958-A',
      title: 'FLIGHT LOG TERMINATED',
      quote: isNewRecord
        ? '"Crikey! We had a mid-air tangle, Captain, but you set a brand-new airfield record!"'
        : '"Mind those separation minimums in the holding pattern, Captain! Ready to take the tower again?"',
      stampText: isNewRecord
        ? 'NEW AIRFIELD RECORD! — MID-AIR COLLISION'
        : 'FLIGHT LOG TERMINATED — MID-AIR COLLISION',
      landedCount: landed,
      highScore: high,
      mapDef: info.mapDef || this.currentMapDef,
      portraitKey,
      showResume: false,
      primaryLabel: 'FLY AGAIN ✈',
    });
  }

  showPauseModal(info = {}) {
    const landed = info.landedCount ?? parseInt(this.lastLandedDigits, 10) ?? 0;
    const high = info.highScore ?? parseInt(this.lastHighDigits, 10) ?? 0;
    this.showClipboardModal({
      mode: 'pause',
      kicker: 'ARGON AIRWAYS • TOWER BRIEFING CLIPBOARD',
      title: 'FLIGHT OPERATIONS PAUSED',
      quote: '"Please enjoy a refreshing beverage while flight operations are holding, Captain!"',
      stampText: 'HOLDING PATTERN — TOWER STANDBY',
      landedCount: landed,
      highScore: high,
      mapDef: info.mapDef || this.currentMapDef,
      portraitKey: info.portraitKey || null,
      showResume: true,
      primaryLabel: 'RESTART SECTOR ↻',
    });
  }

  showBriefingModal(info = {}) {
    const high = info.highScore ?? parseInt(this.lastHighDigits, 10) ?? 0;
    this.showClipboardModal({
      mode: 'briefing',
      kicker: 'WELCOME ABOARD • 1950S AIRSPACE MANAGEMENT',
      title: 'ARGON AIRSPACE BRIEFING',
      quote: '"Drag from any aircraft to its matching colored runway threshold or helipad. Keep planes separated!"',
      stampText: 'CLEARED FOR TAKEOFF & APPROACH',
      landedCount: 0,
      highScore: high,
      mapDef: info.mapDef || this.currentMapDef,
      portraitKey: info.portraitKey || null,
      showResume: true,
      primaryLabel: 'TAKE THE TOWER ✈',
    });
  }

  showClipboardModal(cfg = {}) {
    const modal = document.getElementById('fc-clipboard-modal');
    if (!modal) return;

    const mapDef = cfg.mapDef || this.currentMapDef || {};
    const portraitKey =
      cfg.portraitKey ||
      mapDef.hostessKey ||
      (this.currentMapId === 'tropical_island'
        ? 'hostess_hawaii'
        : this.currentMapId === 'alpine_winter'
          ? 'hostess_alpine'
          : 'hostess_wendy');

    const imgEl = document.getElementById('fc-modal-hostess-img');
    if (imgEl) imgEl.src = resolveAssetUrl(`./assets/textures/${portraitKey}.png`);

    const kickerEl = document.getElementById('fc-modal-kicker');
    if (kickerEl) kickerEl.textContent = cfg.kicker || 'ARGON FLIGHT LOG';

    const titleEl = document.getElementById('fc-modal-title');
    if (titleEl) titleEl.textContent = cfg.title || 'ARGON AIRSPACE LOG';

    const quoteEl = document.getElementById('fc-modal-quote');
    if (quoteEl) quoteEl.textContent = cfg.quote || '';

    const stampEl = document.getElementById('fc-modal-stamp');
    if (stampEl) {
      stampEl.textContent = cfg.stampText || 'FLIGHT LOG TERMINATED';
      stampEl.classList.remove('stamped');
      void stampEl.offsetWidth;
      stampEl.classList.add('stamped');
    }

    const landedEl = document.getElementById('fc-modal-landed');
    if (landedEl) landedEl.textContent = String(cfg.landedCount ?? 0).padStart(5, '0');

    const highEl = document.getElementById('fc-modal-hiscore');
    if (highEl) highEl.textContent = String(cfg.highScore ?? 0).padStart(5, '0');

    const sectorEl = document.getElementById('fc-modal-sector');
    if (sectorEl) sectorEl.textContent = mapDef.name || 'Classic Outback';

    const resumeBtn = document.getElementById('fc-modal-resume-btn');
    if (resumeBtn) {
      resumeBtn.classList.toggle('hidden', !cfg.showResume);
    }

    const restartBtn = document.getElementById('fc-modal-restart-btn');
    if (restartBtn) {
      restartBtn.textContent = cfg.primaryLabel || 'FLY AGAIN ✈';
    }

    modal.classList.remove('hidden');
  }

  hideClipboardModal() {
    const modal = document.getElementById('fc-clipboard-modal');
    if (modal) modal.classList.add('hidden');
  }

  hideModal() {
    this.hideClipboardModal();
  }

  // ===========================================================================
  // 5. COORDINATE CONVERSION, RESIZE & MAIN RENDER LOOP
  // ===========================================================================

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { x: 0, y: 0 };
    }
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    return {
      x: nx * HALF_W,
      y: ny * HALF_H,
    };
  }

  worldToScreen(worldX, worldY) {
    const rect = this.canvas.getBoundingClientRect();
    const u = (worldX + HALF_W) / WORLD_WIDTH;
    const v = (HALF_H - worldY) / WORLD_HEIGHT;
    return {
      x: rect.left + u * rect.width,
      y: rect.top + v * rect.height,
    };
  }

  resize() {
    if (!this.viewportEl || !this.renderer) return;
    const rect = this.viewportEl.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width || window.innerWidth));
    const h = Math.max(240, Math.floor(rect.height || window.innerHeight));
    this.renderer.setSize(w, h, false);
    this.camera.left = -HALF_W;
    this.camera.right = HALF_W;
    this.camera.top = HALF_H;
    this.camera.bottom = -HALF_H;
    this.camera.updateProjectionMatrix();
  }

  update(dt = 0.016, state = null) {
    return this.render(dt, state);
  }

  render(dt = 0.016, state = null) {
    const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.1);
    this.time += safeDt;

    if (this.hazardRingMaterial && this.hazardRingMaterial.uniforms) {
      this.hazardRingMaterial.uniforms.uTime.value = this.time;
    }
    if (this.waterShaderMaterial && this.waterShaderMaterial.uniforms) {
      this.waterShaderMaterial.uniforms.uTime.value = this.time;
    }

    // Update map animated props (windsock, approach rabbit strobes, water channel)
    this._updateAnimatedMapProps(this.time);

    // Optional state sync if passed directly to render(dt, state)
    if (state) {
      if (Array.isArray(state.activePlanes || state.planes)) {
        this.updateAircraft(state.activePlanes || state.planes, safeDt, this.time);
      }
      const pending = state.pendingSpawns || state.director?.pendingSpawns;
      if (Array.isArray(pending)) {
        this.updatePerimeterWarnings(pending, safeDt, this.time);
      }
      if (typeof state.landedCount === 'number' || typeof state.highScore === 'number') {
        this.updateHUD(state);
      }
    }

    // Update active explosion VFX & floating praise banners
    this._updateExplosions(safeDt);
    this._updatePraiseFloaters(safeDt);

    // Apply camera screen shake during crash sequence
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - safeDt);
      const decay = this.shakeTimer / Math.max(0.01, this.shakeDuration);
      const sx = (Math.random() * 2 - 1) * this.shakeIntensity * decay;
      const sy = (Math.random() * 2 - 1) * this.shakeIntensity * decay;
      this.camera.position.set(sx, sy, 200);
      this.camera.lookAt(sx, sy, 0);
    } else {
      this.camera.position.set(0, 0, 200);
      this.camera.lookAt(0, 0, 0);
    }

    this.renderer.render(this.scene, this.camera);
  }

  _loadNanoBananaImage(urls, onSuccess) {
    const tryIndex = (idx) => {
      if (idx >= urls.length) return;
      const rawUrl = urls[idx];
      const resolved = resolveAssetUrl(rawUrl);
      if (this.loadedImages.has(rawUrl)) {
        onSuccess(this.loadedImages.get(rawUrl));
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (img.width > 16 && img.height > 16) {
          this.loadedImages.set(rawUrl, img);
          onSuccess(img);
        } else {
          tryIndex(idx + 1);
        }
      };
      img.onerror = () => tryIndex(idx + 1);
      img.src = resolved;
    };
    tryIndex(0);
  }

  _getFallbackMapDef(mapId) {
    if (mapId === 'tropical_island') {
      return {
        id: 'tropical_island',
        name: 'Paradise Beach Resort',
        textureKey: 'map_tropical_island',
        hostessKey: 'hostess_hawaii',
        windsockPos: { x: -195, y: -35 },
        runways: [
          { id: 'runway_jet_beach', colorKey: 'red', colorHex: 0xff3b30, isHelipad: false, thresholdX: -235, thresholdY: 115, endX: -235, endY: -155, width: 34, heading: -Math.PI / 2 },
          { id: 'runway_prop_beach', colorKey: 'yellow', colorHex: 0xffd60a, isHelipad: false, thresholdX: -305, thresholdY: -55, endX: -220, endY: -150, width: 25, heading: Math.atan2(-95, 85) },
          { id: 'runway_prop_island', colorKey: 'blue', colorHex: 0x2ac3ff, isHelipad: false, thresholdX: 255, thresholdY: -25, endX: 95, endY: 15, width: 26, heading: Math.atan2(40, -160) },
          { id: 'runway_water_channel', colorKey: 'green', colorHex: 0x2ee6a8, isWaterRunway: true, thresholdX: 175, thresholdY: 48, endX: 330, endY: 8, width: 30, heading: Math.atan2(-40, 155) },
          { id: 'helipad_island', colorKey: 'blue_heli', colorHex: 0x38bdf8, isHelipad: true, thresholdX: 180, thresholdY: -58 },
        ],
      };
    }
    if (mapId === 'alpine_winter') {
      return {
        id: 'alpine_winter',
        name: 'Alpine Glacier & Peak',
        textureKey: 'map_alpine_winter',
        hostessKey: 'hostess_alpine',
        windsockPos: { x: -10, y: 40 },
        runways: [
          { id: 'runway_jet_alpine', colorKey: 'red', colorHex: 0xff3b30, isHelipad: false, thresholdX: -180, thresholdY: 95, endX: 160, endY: -85, width: 34, heading: Math.atan2(-180, 340) },
          { id: 'runway_prop_alpine', colorKey: 'yellow', colorHex: 0xffd60a, isHelipad: false, thresholdX: 145, thresholdY: 120, endX: -95, endY: -110, width: 26, heading: Math.atan2(-230, -240) },
          { id: 'runway_seaplane_fjord', colorKey: 'green', colorHex: 0x2ee6a8, isWaterRunway: false, thresholdX: -285, thresholdY: -120, endX: -95, endY: -200, width: 28, heading: Math.atan2(-80, 190) },
          { id: 'helipad_alpine', colorKey: 'blue_heli', colorHex: 0x38bdf8, isHelipad: true, thresholdX: 230, thresholdY: 45 },
        ],
      };
    }
    return {
      id: 'classic_outback',
      name: 'Classic Outback Airfield',
      textureKey: 'map_classic_outback',
      hostessKey: 'hostess_wendy',
      windsockPos: { x: 0, y: 5 },
      runways: [
        { id: 'runway_jet_main', colorKey: 'red', colorHex: 0xff3b30, isHelipad: false, thresholdX: 150, thresholdY: 95, endX: -30, endY: -145, width: 34, heading: Math.atan2(-240, -180) },
        { id: 'runway_prop_south', colorKey: 'yellow', colorHex: 0xffd60a, isHelipad: false, thresholdX: 185, thresholdY: -130, endX: -35, endY: -130, width: 26, heading: Math.PI },
        { id: 'runway_prop_west', colorKey: 'blue', colorHex: 0x2ac3ff, isHelipad: false, thresholdX: 10, thresholdY: 125, endX: -185, endY: -110, width: 26, heading: Math.atan2(-235, -195) },
        { id: 'helipad_west', colorKey: 'blue_heli', colorHex: 0x38bdf8, isHelipad: true, thresholdX: -250, thresholdY: 15 },
        { id: 'helipad_east', colorKey: 'blue_heli', colorHex: 0x38bdf8, isHelipad: true, thresholdX: 235, thresholdY: -25 },
      ],
    };
  }

  _injectStylesheet() {
    if (typeof document === 'undefined' || document.getElementById('fc-render-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'fc-render-ui-styles';
    style.textContent = `
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #1d150e;
        font-family: "Trebuchet MS", "Arial Narrow", "Helvetica Neue", Arial, sans-serif;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }

      /* Brushed Metallic Argon Outer Bezel (Screenshots 1-4) */
      .fc-bezel-frame {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px),
          linear-gradient(180deg, #989895 0%, #7d7d7a 50%, #646461 100%);
        padding: 12px;
        box-sizing: border-box;
      }

      .fc-viewport {
        position: relative;
        width: min(100%, calc((100vh - 24px) * 1.5));
        height: min(100%, calc((100vw - 24px) / 1.5));
        aspect-ratio: 3 / 2;
        border-radius: 26px;
        overflow: hidden;
        box-shadow:
          inset 0 0 0 3px #3b3b38,
          inset 0 4px 14px rgba(0, 0, 0, 0.48),
          0 2px 0 rgba(255, 255, 255, 0.45);
        background: #4e8f58;
      }

      .fc-webgl-canvas {
        width: 100%;
        height: 100%;
        display: block;
        touch-action: none;
        cursor: crosshair;
      }

      .fc-hud-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 10;
      }

      /* Top Score Bar & Split-Flap Odometer Digits */
      .fc-top-bar {
        position: absolute;
        top: 10px;
        left: 28px;
        right: 28px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .fc-score-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .fc-score-label {
        font-family: "Arial Narrow", "Impact", "Trebuchet MS", sans-serif;
        font-style: italic;
        font-weight: 900;
        font-size: clamp(15px, 2.0vw, 22px);
        letter-spacing: 0.04em;
        color: #fdfaf2;
        -webkit-text-stroke: 1.2px #142218;
        text-shadow:
          0 2px 3px rgba(0, 0, 0, 0.72),
          0 0 6px rgba(12, 24, 16, 0.55);
      }

      .fc-odometer {
        display: inline-flex;
        gap: 3px;
        padding: 2px 4px;
        background: rgba(28, 30, 32, 0.55);
        border-radius: 5px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.35);
      }

      .fc-flap-card {
        position: relative;
        width: clamp(18px, 2.1vw, 24px);
        height: clamp(24px, 2.8vw, 31px);
        background: linear-gradient(180deg, #4b4d50 0%, #37393c 49%, #26282a 51%, #3d3f42 100%);
        border: 1px solid #6e7073;
        border-radius: 3px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-family: "Arial Narrow", "Trebuchet MS", monospace;
        font-weight: 900;
        font-size: clamp(16px, 2.1vw, 22px);
        line-height: 1;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 2px rgba(0,0,0,0.5);
        transform-origin: center center;
      }

      .fc-flap-split {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 1px;
        background: rgba(15, 16, 18, 0.78);
        pointer-events: none;
      }

      .fc-flap-card.flipping {
        animation: fcFlapFlip 0.26s cubic-bezier(0.22, 1, 0.36, 1);
      }

      @keyframes fcFlapFlip {
        0% { transform: scaleY(0.25); filter: brightness(1.5); }
        60% { transform: scaleY(1.12); }
        100% { transform: scaleY(1.0); filter: brightness(1.0); }
      }

      /* Center Map Switcher Pills & Audio Controls */
      .fc-center-controls {
        display: flex;
        align-items: center;
        gap: 6px;
        pointer-events: auto;
        background: rgba(34, 42, 36, 0.62);
        backdrop-filter: blur(4px);
        padding: 3px 6px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.28);
      }

      .fc-map-pills {
        display: flex;
        gap: 3px;
      }

      .fc-map-pill {
        border: none;
        background: transparent;
        color: #e9f2ec;
        font-size: 11.5px;
        font-weight: 800;
        letter-spacing: 0.03em;
        padding: 4px 10px;
        border-radius: 999px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .fc-map-pill:hover {
        background: rgba(255, 255, 255, 0.16);
      }

      .fc-map-pill.active {
        background: #f5ebd6;
        color: #1c2820;
        box-shadow: 0 1px 4px rgba(0,0,0,0.35);
      }

      .fc-icon-btn {
        border: 1px solid rgba(255,255,255,0.28);
        background: rgba(255,255,255,0.14);
        color: #ffffff;
        font-size: 11px;
        font-weight: 800;
        padding: 4px 8px;
        border-radius: 999px;
        cursor: pointer;
      }

      .fc-icon-btn:hover {
        background: rgba(255,255,255,0.28);
      }

      /* Bottom Metallic Corner Tabs (>> Fast Forward & || Pause — Screenshots 1-4) */
      .fc-corner-tab {
        position: absolute;
        bottom: -2px;
        width: 58px;
        height: 52px;
        pointer-events: auto;
        border: 3px solid #484845;
        background:
          repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px),
          linear-gradient(180deg, #8e8e8b 0%, #6f6f6c 100%);
        color: #f4f4f0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 -2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.45);
        transition: transform 0.12s ease, background 0.15s ease;
      }

      .fc-corner-left {
        left: -2px;
        border-top-right-radius: 18px;
      }

      .fc-corner-right {
        right: -2px;
        border-top-left-radius: 18px;
      }

      .fc-corner-tab:hover {
        filter: brightness(1.08);
      }

      .fc-corner-tab.active {
        background: linear-gradient(180deg, #ff7b1a 0%, #d9381e 100%);
        border-color: #fff2d6;
        color: #ffffff;
      }

      .fc-ff-badge {
        position: absolute;
        top: 4px;
        right: 6px;
        font-size: 9px;
        font-weight: 900;
        opacity: 0;
      }

      .fc-corner-tab.active .fc-ff-badge {
        opacity: 1;
      }

      /* Wendy the Stewardess Illustrated Airmail Toast */
      .fc-wendy-toast {
        position: absolute;
        top: 52px;
        left: 22px;
        max-width: 350px;
        background: #fbf4e3;
        border: 2px solid #2b3a4a;
        border-radius: 12px;
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
        overflow: hidden;
        pointer-events: none;
        transition: opacity 0.25s ease, transform 0.25s ease;
      }

      .fc-wendy-toast.hidden {
        opacity: 0;
        transform: translateY(-10px);
      }

      .fc-wendy-airmail-strip {
        height: 6px;
        background: repeating-linear-gradient(
          -45deg,
          #d92b2b 0px,
          #d92b2b 10px,
          #fbf4e3 10px,
          #fbf4e3 18px,
          #1d4ed8 18px,
          #1d4ed8 28px,
          #fbf4e3 28px,
          #fbf4e3 36px
        );
      }

      .fc-wendy-toast-body {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
      }

      .fc-wendy-portrait-wrap {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        border: 2px solid #1b365d;
        overflow: hidden;
        flex-shrink: 0;
        background: #d8ecf8;
      }

      .fc-wendy-portrait-wrap img {
        width: 100%;
        height: 100%;
        display: block;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        object-position: center center;
        transform: none;
      }

      .fc-wendy-speaker {
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.08em;
        color: #b91c1c;
        margin-bottom: 2px;
      }

      .fc-wendy-text {
        font-size: 12.5px;
        font-weight: 700;
        color: #1e293b;
        line-height: 1.25;
      }

      /* 1950s Argon Airways Vintage Clipboard Scorecard Modal */
      .fc-clipboard-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 18, 22, 0.62);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        z-index: 40;
      }

      .fc-clipboard-backdrop.hidden {
        display: none;
      }

      .fc-clipboard-wood-desk {
        width: min(90%, 540px);
        padding: 18px;
        border-radius: 20px;
        background-color: #4a2c18;
        background-size: cover;
        background-position: center;
        box-shadow: 0 22px 50px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.25);
        border: 3px solid #2b180c;
      }

      .fc-clipboard-sheet {
        position: relative;
        background-color: #f9f1de;
        background-size: cover;
        border-radius: 12px;
        padding: 8px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.38);
      }

      .fc-clipboard-metal-clip {
        margin: -18px auto 8px auto;
        width: 72%;
        height: 28px;
        background: linear-gradient(180deg, #d8dce0 0%, #8f959c 48%, #6c7278 100%);
        border: 2px solid #3f444a;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        color: #1f2428;
        font-size: 10.5px;
        font-weight: 900;
        letter-spacing: 0.1em;
        box-shadow: 0 4px 8px rgba(0,0,0,0.35);
      }

      .fc-clip-rivet {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #494e54;
        box-shadow: inset 0 1px 1px rgba(0,0,0,0.6);
      }

      .fc-airmail-border-inner {
        border: 6px solid transparent;
        border-image: repeating-linear-gradient(
          -45deg,
          #d92b2b 0,
          #d92b2b 12px,
          #fbf4e3 12px,
          #fbf4e3 20px,
          #1d4ed8 20px,
          #1d4ed8 32px,
          #fbf4e3 32px,
          #fbf4e3 40px
        ) 8;
        padding: 14px 16px;
        background: rgba(251, 244, 228, 0.94);
      }

      .fc-clipboard-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 10px;
      }

      .fc-clipboard-portrait-frame {
        width: 76px;
        height: 76px;
        border-radius: 12px;
        border: 3px solid #1b365d;
        overflow: hidden;
        flex-shrink: 0;
        background: #d8ecf8;
        box-shadow: 0 4px 10px rgba(0,0,0,0.22);
      }

      .fc-clipboard-portrait-frame img {
        width: 100%;
        height: 100%;
        display: block;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        object-position: center center;
        transform: none;
      }

      .fc-clipboard-kicker {
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.1em;
        color: #991b1b;
      }

      .fc-clipboard-title {
        margin: 2px 0 4px 0;
        font-size: 22px;
        font-weight: 900;
        letter-spacing: 0.03em;
        color: #172536;
      }

      .fc-clipboard-quote {
        margin: 0;
        font-size: 12.5px;
        font-style: italic;
        color: #334155;
      }

      /* Animated Red Ink Rubber Stamp */
      .fc-rubber-stamp {
        margin: 8px auto 12px auto;
        padding: 5px 12px;
        border: 3px double #c81e1e;
        border-radius: 4px;
        color: #c81e1e;
        font-family: "Courier New", "Impact", monospace;
        font-weight: 900;
        font-size: 13px;
        letter-spacing: 0.08em;
        text-align: center;
        text-transform: uppercase;
        transform: rotate(-2.2deg);
        background: rgba(200, 30, 30, 0.06);
      }

      .fc-rubber-stamp.stamped {
        animation: fcStampSlam 0.34s cubic-bezier(0.18, 0.89, 0.32, 1.28);
      }

      @keyframes fcStampSlam {
        0% { transform: scale(2.1) rotate(-8deg); opacity: 0; }
        70% { transform: scale(0.94) rotate(-1.5deg); opacity: 1; }
        100% { transform: scale(1.0) rotate(-2.2deg); opacity: 1; }
      }

      .fc-ledger-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-bottom: 12px;
      }

      .fc-ledger-cell {
        background: #efe3c8;
        border: 1px solid #cbb894;
        border-radius: 8px;
        padding: 7px 8px;
        text-align: center;
      }

      .fc-ledger-label {
        display: block;
        font-size: 9.5px;
        font-weight: 800;
        letter-spacing: 0.07em;
        color: #645338;
        margin-bottom: 3px;
      }

      .fc-ledger-value {
        font-family: "Courier New", monospace;
        font-size: 20px;
        font-weight: 900;
        color: #172536;
      }

      .fc-ledger-sector {
        font-family: "Trebuchet MS", sans-serif;
        font-size: 13px;
      }

      .fc-modal-map-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        margin-bottom: 12px;
      }

      .fc-sector-card {
        border: 2px solid #cbb894;
        background: #f5ebd6;
        border-radius: 8px;
        padding: 6px;
        cursor: pointer;
        text-align: left;
        transition: all 0.14s ease;
      }

      .fc-sector-card.active {
        border-color: #1d4ed8;
        background: #e0edff;
      }

      .fc-sector-name {
        display: block;
        font-size: 11.5px;
        font-weight: 900;
        color: #172536;
      }

      .fc-sector-meta {
        display: block;
        font-size: 9.5px;
        color: #475569;
      }

      .fc-clipboard-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .fc-btn-primary, .fc-btn-secondary {
        border: none;
        border-radius: 8px;
        padding: 10px 18px;
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 0.05em;
        cursor: pointer;
        box-shadow: 0 3px 0 rgba(0,0,0,0.32);
      }

      .fc-btn-primary {
        background: linear-gradient(180deg, #e03131 0%, #b91c1c 100%);
        color: #ffffff;
      }

      .fc-btn-secondary {
        background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
      }

      .fc-btn-primary.hidden, .fc-btn-secondary.hidden {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }
}

if (typeof window !== 'undefined') {
  window.FlightRenderEngine = FlightRenderEngine;
}

export default FlightRenderEngine;
