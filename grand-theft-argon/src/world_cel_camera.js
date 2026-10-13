import * as THREE from '../assets/vendor/three.module.js';

/**
 * Grand Theft Argon: Argon City Stories / Grand Theft Argon — 3D World, Neon-Pastel Cel-Shading & Camera Rig
 * Three.js r160 ES Module
 *
 * Implements:
 * 1. Custom WebGLRenderTarget (samples: 0 + DepthTexture) fullscreen post-processing pipeline:
 *    - Sobel depth + normal/luminance edge detection for crisp comic-book ink silhouettes
 *    - Three-tone stepped cel-shading & 1980s Argon City neon-pastel color grading LUT
 *    - Daytime/heatwave asphalt shimmer (uHeatHaze) & neon rain wet reflection boost
 * 2. Helper `addComicOutline(mesh, thickness, edgeThreshold)` for geometric ink linework
 * 3. 360m x 360m Argon City Open-World Map with 4 Distinct Districts:
 *    - OCEAN BEACH (Art Deco Hotels, Neon Blade Signs, Argon Gas '86 Station, Beach & Umbrellas)
 *    - STARFISH ISLAND (Vercetti Estate Mansion, Pool, Safehouse Marker, Luxury Villas, Bridges)
 *    - LITTLE HAITI (Weathered Storefronts, Graffiti Murals, Kaufman Cabs Depot, Dumpsters)
 *    - ARGON PORT MARINA (Concrete/Timber Yacht Piers, Shipping Containers, Gantry Cranes)
 * 4. 130+ Royal Palm Trees with animated tropical wind sway + Twin-Arm Deco Streetlamps
 * 5. Custom Tropical Water Shader with Voronoï/sine caustics, shoreline surf foam & wake trails
 * 6. Full 24h Day/Night & Weather Cycle (Golden Sunset 16.5, Neon Night 22.5, Sunny Day 14.0)
 * 7. Dynamic Grand Theft Argon Overhead 3D Tracking Camera with velocity look-ahead, drift roll & combat zoom
 */

// Shared material cache for comic ink edges to minimize draw state changes
const SHARED_INK_LINE_MAT = new THREE.LineBasicMaterial({
  color: 0x120b1d,
  transparent: true,
  opacity: 0.88,
  depthWrite: false,
});

/**
 * Attaches crisp Grand Theft Argon graphic-novel black ink edge linework to a Mesh or Group.
 * @param {THREE.Object3D} rootObj
 * @param {number} thickness
 * @param {number} edgeThreshold
 * @return {THREE.Object3D}
 */
export function addComicOutline(rootObj, thickness = 1.03, edgeThreshold = 22) {
  if (!rootObj) return rootObj;

  const attachToMesh = (mesh) => {
    if (!mesh.isMesh || !mesh.geometry || mesh.userData.hasComicOutline) return;
    mesh.userData.hasComicOutline = true;
    try {
      const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, edgeThreshold);
      const lineSegs = new THREE.LineSegments(edgesGeo, SHARED_INK_LINE_MAT);
      if (thickness !== 1.0) {
        lineSegs.scale.setScalar(1.0 + (thickness - 1.0) * 0.12);
      }
      lineSegs.renderOrder = 2;
      lineSegs.raycast = () => {}; // Do not interfere with raycasts
      mesh.add(lineSegs);
    } catch (_err) {
      // Ignore degenerate geometries
    }
  };

  if (rootObj.isMesh) {
    attachToMesh(rootObj);
  } else {
    rootObj.traverse((child) => {
      if (child.isMesh) attachToMesh(child);
    });
  }
  return rootObj;
}

export class ViceCityWorld {
  constructor(renderer) {
    this.renderer = renderer || null;

    // Core Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x28153d);
    this.scene.fog = new THREE.FogExp2(0x3a1c4e, 0.0018);

    const initW = (renderer && renderer.domElement && renderer.domElement.width) || window.innerWidth || 1280;
    const initH = (renderer && renderer.domElement && renderer.domElement.height) || window.innerHeight || 720;

    this.camera = new THREE.PerspectiveCamera(44, initW / Math.max(1, initH), 1.0, 1400.0);
    this.camera.position.set(80, 26, 28);
    this.camera.lookAt(80, 0, 12);

    // Camera Tracking State
    this.cameraMode = 'chinatown_high'; // 'chinatown_high' | 'cinematic_angled' | 'street_chase'
    this.cameraFocus = new THREE.Vector3(80, 0, 12);
    this.cameraLookAhead = new THREE.Vector3(0, 0, 0);
    this.cameraCurrentPos = new THREE.Vector3(80, 26, 28);
    this.cameraShakeAmount = 0;
    this.cameraShakeTime = 0;
    this.currentZoomHeight = 26.0;
    this.currentDriftRoll = 0.0;
    this.currentHeadingYaw = 0.0;

    // World Collections for Physics, AI & Gameplay
    this.buildingColliders = [];
    this.palmColliders = [];
    this.interactables = [];
    this.roadWaypoints = [];
    this.palmCrownMeshes = [];
    this.neonMaterials = [];
    this.windowMaterials = [];
    this.streetLampPools = [];
    this.streetLampBulbs = [];
    this.accentPointLights = [];
    this.interactableVisuals = [];
    this.waterWakes = [];
    this.stuntRamps = [];
    this.easterEggs = [];
    this.animatedLandmarkProps = [];
    this.lighthouseBeam = null;
    this.aerodromeBeacon = null;
    this.airportWindsock = null;

    // Seeded Procedural City State (Major City / Downtown Metropolis vs. Suburban Neighborhoods)
    const urlParams =
      typeof window !== 'undefined' && window.location
        ? new URLSearchParams(window.location.search)
        : null;
    const urlSeed = urlParams ? parseInt(urlParams.get('seed'), 10) : NaN;
    const isCapture = urlParams && urlParams.get('capture') === '1';
    this.citySeed = Number.isFinite(urlSeed) && urlSeed > 0
      ? urlSeed
      : isCapture
        ? 1986
        : Math.floor(Math.random() * 900000) + 100000;
    this.proceduralCityGroup = new THREE.Group();
    this.proceduralBlockFootprints = [];
    this.proceduralWindowMaterials = [];
    this.proceduralNeonMaterials = [];
    this.proceduralPalmMeshes = [];
    this.staticBuildingColliders = [];

    // Minecraft-Style Infinite Procedural Chunk Streaming State (120m x 120m chunks)
    this.chunkSize = 120;
    this.chunkLoadRadius = 2; // 5x5 chunks = 600m x 600m loaded around player
    this.activeChunks = new Map();
    this.infiniteChunksGroup = new THREE.Group();
    this._lastPlayerChunkX = null;
    this._lastPlayerChunkZ = null;

    // Time of Day & Weather State
    this.timeOfDay = 16.5; // Default: 16.5 Golden Sunset / Neon Twilight
    this.weather = 'clear'; // 'clear' | 'neon_rain' | 'heatwave'
    this.elapsedTime = 0;

    // Stepped Toon Gradient Map (3-tone crisp cel-shading ramp)
    this.toonGradientMap = this._createToonGradientTexture();

    // Configure Renderer Shadow Settings safely (SwiftShader compliant)
    if (this.renderer) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // Build Pipelines & World Geometry
    this._initPostProcessing(initW, initH);
    this._initLightingAndSky();
    this._buildWaterAndShorelines();
    this._buildLandmassesAndBeaches();
    this._buildRoadNetworkAndBridges();
    this._buildOceanBeachDistrict();
    this._buildStarfishIslandDistrict();
    this._buildLittleHaitiDistrict();
    this._buildVicePortDistrict();
    this._buildExpandedCityLandmarks();
    this._buildStuntRamps();
    this._buildEasterEggs();
    this._buildPalmTreesAndStreetlamps();
    this._buildInteractableMarkers();
    this._buildWeatherParticles();

    // Snapshot base static colliders and generate Seeded Procedural City (Downtown Skyscrapers + Suburban Homes)
    this.scene.add(this.proceduralCityGroup);
    this.scene.add(this.infiniteChunksGroup);
    this.staticBuildingColliders = [...this.buildingColliders];
    this.regenerateProceduralCity(this.citySeed);
    this.updateInfiniteChunks(80, -26);

    // Apply initial Time of Day
    this.setTimeOfDay(this.timeOfDay);
  }

  // Static & instance helper exposure
  static addComicOutline(mesh, thickness = 1.03, edgeThreshold = 22) {
    return addComicOutline(mesh, thickness, edgeThreshold);
  }

  addComicOutline(mesh, thickness = 1.03, edgeThreshold = 22) {
    return addComicOutline(mesh, thickness, edgeThreshold);
  }

  // ============================================================================
  // 1. TOON RAMP & PROCEDURAL CANVAS TEXTURES
  // ============================================================================

  _createToonGradientTexture() {
    const data = new Uint8Array([
      165, 160, 185, 255,   // Shadow tone (bright readable comic shade)
      224, 220, 234, 255, // Midtone
      255, 253, 250, 255, // Warm highlight tone
    ]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  _createToonMaterial(colorHex, opts = {}) {
    const mat = new THREE.MeshToonMaterial({
      color: colorHex,
      gradientMap: this.toonGradientMap,
      ...opts,
    });
    return mat;
  }

  _createWindowGridTexture(bgColor = '#221833', litColor1 = '#00f0ff', litColor2 = '#ff55aa', cols = 4, rows = 8) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle architectural stucco/masonry horizontal coursing lines & vertical pilasters
    ctx.fillStyle = 'rgba(18, 10, 30, 0.22)';
    for (let y = 0; y < canvas.height; y += 8) {
      ctx.fillRect(0, y, canvas.width, 1.5);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.fillRect(0, 0, 12, canvas.height);
    ctx.fillRect(canvas.width - 12, 0, 12, canvas.height);

    const padX = 22;
    const padY = 18;
    const cellW = (canvas.width - padX * 2) / cols;
    const cellH = (canvas.height - padY * 2) / rows;

    for (let r = 0; r < rows; r++) {
      // Ornate Art Deco spandrel frieze & neon racing band between floors
      ctx.fillStyle = '#160d26';
      ctx.fillRect(0, padY + r * cellH - 6, canvas.width, 7);
      ctx.fillStyle = r % 2 === 0 ? litColor1 : litColor2;
      ctx.fillRect(0, padY + r * cellH - 4, canvas.width, 3.5);

      for (let c = 0; c < cols; c++) {
        const x = padX + c * cellW + 8;
        const y = padY + r * cellH + 7;
        const w = cellW - 16;
        const h = cellH - 15;

        // Outer stone lintel & recessed dark comic window casing
        ctx.fillStyle = 'rgba(255, 252, 245, 0.28)';
        ctx.fillRect(x - 4, y - 4, w + 8, 4);
        ctx.fillStyle = '#0e0818';
        ctx.fillRect(x - 3, y - 2, w + 6, h + 5);

        // Lit or dark window pane
        const hash = Math.sin(r * 17.3 + c * 31.7) * 43758.5453;
        const frac = hash - Math.floor(hash);
        if (frac > 0.24) {
          const grad = ctx.createLinearGradient(x, y, x, y + h);
          if (frac > 0.62) {
            grad.addColorStop(0, '#fff6d6');
            grad.addColorStop(1, litColor2);
          } else {
            grad.addColorStop(0, '#e6ffff');
            grad.addColorStop(1, litColor1);
          }
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = '#232842';
        }
        ctx.fillRect(x, y, w, h);

        // Double-hung window muntin crossbars
        ctx.fillStyle = '#120b1e';
        ctx.fillRect(x, y + h * 0.48, w, 2.5);
        ctx.fillRect(x + w * 0.48, y, 2.0, h);

        // Venetian blinds horizontal slats
        ctx.fillStyle = 'rgba(18, 11, 30, 0.32)';
        for (let s = 4; s < h; s += 5) {
          ctx.fillRect(x, y + s, w, 1.4);
        }

        // Projecting stone window sill at bottom
        ctx.fillStyle = '#ded6ce';
        ctx.fillRect(x - 4, y + h + 1, w + 8, 3);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createAwningTexture(stripeHex1 = '#1e2230', stripeHex2 = '#ff2a85', accentHex = '#00f0ff') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const stripes = 8;
    const sw = canvas.width / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? stripeHex1 : stripeHex2;
      ctx.fillRect(i * sw, 0, sw, canvas.height);
    }

    // Bottom scalloped valance border & gold/cyan trim line
    ctx.fillStyle = '#100a1c';
    ctx.fillRect(0, canvas.height - 18, canvas.width, 18);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, canvas.height - 22, canvas.width, 4);

    // Comic ink border
    ctx.strokeStyle = '#0e0718';
    ctx.lineWidth = 5;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createRooftopTexture(baseHex = '#585666') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    // Rolled tar-and-gravel seam grid
    ctx.strokeStyle = 'rgba(24, 20, 34, 0.45)';
    ctx.lineWidth = 3;
    for (let y = 32; y < 256; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    for (let x = 48; x < 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }

    // Gravel stipple & weathered tar patches
    for (let i = 0; i < 320; i++) {
      const gx = (i * 73) % 254;
      const gy = (i * 139) % 254;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(220, 215, 230, 0.22)' : 'rgba(25, 20, 35, 0.26)';
      ctx.fillRect(gx, gy, 3, 3);
    }

    // Perimeter flashing border
    ctx.strokeStyle = 'rgba(30, 24, 42, 0.65)';
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, 244, 244);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createSidewalkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Warm Grand Theft Argon sandstone-beige concrete base
    ctx.fillStyle = '#dfd2be';
    ctx.fillRect(0, 0, 256, 256);

    // Subtle concrete pebble/stipple grain
    for (let i = 0; i < 280; i++) {
      const px = (i * 67) % 254;
      const py = (i * 113) % 254;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(110, 95, 80, 0.16)' : 'rgba(255, 250, 240, 0.24)';
      ctx.fillRect(px, py, 3, 3);
    }

    // Subtle weathered slab tint variation
    ctx.fillStyle = 'rgba(165, 148, 128, 0.16)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);

    // Crisp comic-inked paving flagstone joints (4x4 slabs per tile)
    ctx.strokeStyle = '#786b5c';
    ctx.lineWidth = 3;
    for (let g = 0; g <= 256; g += 64) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, 256);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(256, g);
      ctx.stroke();
    }

    // Light bevel highlight along slab edges
    ctx.strokeStyle = 'rgba(255, 250, 242, 0.55)';
    ctx.lineWidth = 2;
    for (let g = 3; g < 256; g += 64) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, 256);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(256, g);
      ctx.stroke();
    }

    // Curb stone border blocks on outer edges
    ctx.fillStyle = '#c8baa4';
    ctx.fillRect(0, 0, 18, 256);
    ctx.fillRect(238, 0, 18, 256);
    ctx.strokeStyle = '#5c5044';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, 17, 254);
    ctx.strokeRect(238, 1, 17, 254);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Rich botanical olive-emerald lawn base (replaces flat neon green!)
    ctx.fillStyle = '#3b8c44';
    ctx.fillRect(0, 0, 256, 256);

    // Organic shaded & sunlit turf patches
    for (let i = 0; i < 48; i++) {
      const cx = (i * 53) % 256;
      const cy = (i * 97) % 256;
      const r = 14 + (i % 4) * 6;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(36, 98, 44, 0.38)' : 'rgba(92, 184, 88, 0.34)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hand-inked comic grass blade clusters & botanical stippling
    for (let i = 0; i < 220; i++) {
      const gx = (i * 41) % 248;
      const gy = (i * 83) % 248;
      ctx.fillStyle = i % 5 === 0 ? '#1e4d24' : '#62c468';
      ctx.fillRect(gx, gy, 2.5, 6);
      ctx.fillRect(gx + 3, gy + 1, 2.5, 5);
    }

    // Tropical bougainvillea / hibiscus flowerbed border accents
    const flowerColors = ['#ff2a85', '#ffaa22', '#00f0ff', '#fff066'];
    for (let i = 0; i < 28; i++) {
      const fx = i % 2 === 0 ? 16 + (i % 3) * 6 : 240 - (i % 3) * 6;
      const fy = (i * 29) % 248;
      ctx.fillStyle = '#1f5226';
      ctx.beginPath();
      ctx.arc(fx, fy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createSandTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f2da9c';
    ctx.fillRect(0, 0, 256, 256);

    // Wind-rippled sand dune bands
    for (let y = 0; y < 256; y += 16) {
      ctx.fillStyle = y % 32 === 0 ? 'rgba(214, 182, 118, 0.36)' : 'rgba(255, 245, 210, 0.35)';
      ctx.fillRect(0, y, 256, 6);
    }

    // Coral shell & pebble speckles
    for (let i = 0; i < 240; i++) {
      const sx = (i * 61) % 254;
      const sy = (i * 107) % 254;
      ctx.fillStyle = i % 4 === 0 ? 'rgba(255, 140, 165, 0.35)' : 'rgba(168, 136, 82, 0.28)';
      ctx.fillRect(sx, sy, 3, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createPalmFrondTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Rich 2-tone tropical emerald/lime base
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0.0, '#166938');
    grad.addColorStop(0.46, '#38c864');
    grad.addColorStop(0.50, '#a8f068'); // Central rachis midrib
    grad.addColorStop(0.54, '#2eb858');
    grad.addColorStop(1.0, '#12542c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    // Individual angled palm feather leaflets & dark comic ink ribs
    ctx.strokeStyle = '#0c2e18';
    ctx.lineWidth = 4;
    for (let y = 12; y < 504; y += 20) {
      // Left leaflet rib
      ctx.beginPath();
      ctx.moveTo(128, y);
      ctx.lineTo(8, y - 18);
      ctx.stroke();

      // Right leaflet rib
      ctx.beginPath();
      ctx.moveTo(128, y);
      ctx.lineTo(248, y - 18);
      ctx.stroke();

      // Sunlit highlight stroke on each leaflet
      ctx.strokeStyle = 'rgba(180, 255, 130, 0.42)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(124, y + 4);
      ctx.lineTo(16, y - 12);
      ctx.moveTo(132, y + 4);
      ctx.lineTo(240, y - 12);
      ctx.stroke();
      ctx.strokeStyle = '#0c2e18';
      ctx.lineWidth = 4;
    }

    // Central golden-green rachis spine
    ctx.fillStyle = '#8ce058';
    ctx.fillRect(122, 0, 12, 512);
    ctx.strokeStyle = '#0c2e18';
    ctx.lineWidth = 3;
    ctx.strokeRect(122, 0, 12, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  _createFoliageClusterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#389844';
    ctx.fillRect(0, 0, 256, 256);

    // Comic-book leaf cluster arcs (matching the leafy street tree in Reference Screenshot 2!)
    for (let i = 0; i < 95; i++) {
      const lx = (i * 47) % 240 + 8;
      const ly = (i * 89) % 240 + 8;
      const r = 10 + (i % 3) * 5;
      ctx.fillStyle = i % 3 === 0 ? '#5cd466' : i % 3 === 1 ? '#287233' : '#46b050';
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#113318';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0.2, Math.PI * 1.15);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createNeonSignTexture(text, bgHex = '#1a092b', borderHex = '#00f0ff', textHex = '#ff2a85', vertical = false) {
    const canvas = document.createElement('canvas');
    canvas.width = vertical ? 128 : 512;
    canvas.height = vertical ? 512 : 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Double neon tube border
    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.save();
    ctx.fillStyle = textHex;
    ctx.shadowColor = textHex;
    ctx.shadowBlur = 14;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (vertical) {
      const chars = text.split('');
      const step = (canvas.height - 48) / Math.max(1, chars.length);
      ctx.font = '900 42px "Arial Black", Impact, sans-serif';
      chars.forEach((ch, idx) => {
        const cy = 24 + step * (idx + 0.5);
        ctx.fillStyle = textHex;
        ctx.fillText(ch, canvas.width / 2, cy);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ch, canvas.width / 2, cy);
      });
    } else {
      ctx.font = 'italic 900 54px "Arial Black", Impact, sans-serif';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createIntersectionBoxTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Warm comic-book medium grey asphalt matching Grand Theft Argon reference screenshots
    ctx.fillStyle = '#707682';
    ctx.fillRect(0, 0, 512, 512);

    // Asphalt grain speckle
    for (let i = 0; i < 600; i++) {
      const gx = (i * 79) % 510;
      const gy = (i * 131) % 510;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(55, 60, 70, 0.28)' : 'rgba(150, 158, 172, 0.22)';
      ctx.fillRect(gx, gy, 3, 3);
    }

    // White outer crosswalk bars on 4 sides with dark comic drop-outline
    for (let i = 56; i < 456; i += 40) {
      ctx.fillStyle = '#2b2f38';
      ctx.fillRect(i + 2, 10, 22, 44);
      ctx.fillRect(i + 2, 462, 22, 44);
      ctx.fillRect(10, i + 2, 44, 22);
      ctx.fillRect(462, i + 2, 44, 22);

      ctx.fillStyle = '#f2f5fa';
      ctx.fillRect(i, 8, 22, 44);
      ctx.fillRect(i, 460, 22, 44);
      ctx.fillRect(8, i, 44, 22);
      ctx.fillRect(460, i, 44, 22);
    }

    // Inner Grand Theft Argon cross-hatched intersection box
    const boxMin = 68;
    const boxSize = 376;
    ctx.save();
    ctx.beginPath();
    ctx.rect(boxMin, boxMin, boxSize, boxSize);
    ctx.clip();

    ctx.strokeStyle = '#e6ebf2';
    ctx.lineWidth = 7;
    ctx.strokeRect(boxMin + 4, boxMin + 4, boxSize - 8, boxSize - 8);

    ctx.lineWidth = 5;
    for (let d = -512; d < 1024; d += 52) {
      ctx.beginPath();
      ctx.moveTo(d, boxMin);
      ctx.lineTo(d + boxSize, boxMin + boxSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(d + boxSize, boxMin);
      ctx.lineTo(d, boxMin + boxSize);
      ctx.stroke();
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createRoadSegmentTexture(lanes = 4) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Warm comic-book medium grey asphalt (matches Grand Theft Argon Reference Screenshot 2)
    ctx.fillStyle = '#707682';
    ctx.fillRect(0, 0, 512, 512);

    // Fine asphalt aggregate grain & stippling
    for (let i = 0; i < 900; i++) {
      const ax = (i * 97) % 510;
      const ay = (i * 151) % 510;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(48, 52, 62, 0.30)' : 'rgba(155, 162, 175, 0.22)';
      ctx.fillRect(ax, ay, 3, 3);
    }

    // Darker oil-stained dual wheel-rut wear tracks inside each lane
    const laneCenters = [68, 192, 320, 444];
    for (const lc of laneCenters) {
      ctx.fillStyle = 'rgba(46, 50, 60, 0.34)';
      ctx.fillRect(lc - 26, 0, 16, 512);
      ctx.fillRect(lc + 10, 0, 16, 512);
      // Center oil drip streak
      ctx.fillStyle = 'rgba(34, 37, 46, 0.22)';
      ctx.fillRect(lc - 4, 0, 8, 512);
    }

    // Subtle weathered tar crack repair seams
    ctx.strokeStyle = 'rgba(36, 39, 48, 0.48)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(18, 110);
    ctx.lineTo(145, 124);
    ctx.lineTo(240, 116);
    ctx.moveTo(265, 380);
    ctx.lineTo(395, 392);
    ctx.lineTo(492, 376);
    ctx.stroke();

    // Curb edge lines (crisp light concrete gutter + dark shadow seam)
    ctx.fillStyle = '#323640';
    ctx.fillRect(0, 0, 8, 512);
    ctx.fillRect(504, 0, 8, 512);
    ctx.fillStyle = '#c4ccd8';
    ctx.fillRect(8, 0, 8, 512);
    ctx.fillRect(496, 0, 8, 512);

    // Curbside cast-iron Storm Drain Grates in the gutter
    for (const gy of [120, 380]) {
      for (const gx of [10, 484]) {
        ctx.fillStyle = '#1e2128';
        ctx.fillRect(gx, gy, 18, 34);
        ctx.fillStyle = '#5c6270';
        for (let b = 4; b < 32; b += 5) {
          ctx.fillRect(gx + 2, gy + b, 14, 2);
        }
      }
    }

    // Cast-iron Municipal Manhole Cover with waffle cross-hatch
    const mhX = 212;
    const mhY = 290;
    ctx.fillStyle = '#252830';
    ctx.beginPath();
    ctx.arc(mhX, mhY, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#565c68';
    ctx.beginPath();
    ctx.arc(mhX, mhY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e2128';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mhX, mhY, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Double centre divider line
    ctx.fillStyle = '#2c303a';
    ctx.fillRect(246, 0, 20, 512);
    ctx.fillStyle = '#f0f4fa';
    ctx.fillRect(247, 0, 7, 512);
    ctx.fillRect(258, 0, 7, 512);

    // Dashed white lane dividers + Grand Theft Argon "LANE", diamond HOV & directional arrows
    if (lanes >= 4) {
      for (let y = 28; y < 512; y += 128) {
        ctx.fillStyle = '#2c303a';
        ctx.fillRect(128, y + 2, 10, 68);
        ctx.fillRect(376, y + 2, 10, 68);
        ctx.fillStyle = '#f4f7fc';
        ctx.fillRect(126, y, 10, 68);
        ctx.fillRect(374, y, 10, 68);
      }

      ctx.save();
      ctx.fillStyle = 'rgba(244, 248, 255, 0.88)';
      ctx.font = '900 34px "Arial Black", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LANE', 192, 172);
      ctx.fillText('ONLY', 68, 392);
      ctx.fillText('BUS', 68, 432);

      // White HOV diamond in right lane
      ctx.strokeStyle = 'rgba(244, 248, 255, 0.90)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(316, 304);
      ctx.lineTo(340, 344);
      ctx.lineTo(316, 384);
      ctx.lineTo(292, 344);
      ctx.closePath();
      ctx.stroke();

      // Crisp directional straight arrow in right outer lane
      ctx.fillRect(432, 140, 12, 72);
      ctx.beginPath();
      ctx.moveTo(438, 108);
      ctx.lineTo(460, 148);
      ctx.lineTo(416, 148);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createGraffitiTexture(title, bgHex = '#c89d7c', color1 = '#ff2a85', color2 = '#00f0ff') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 256, 128);

    // Stucco weathering lines
    ctx.fillStyle = 'rgba(40, 25, 20, 0.16)';
    for (let i = 0; i < 18; i++) {
      ctx.fillRect((i * 37) % 240, (i * 23) % 110, 28, 4);
    }

    // Spray paint splash backdrop
    ctx.fillStyle = color2;
    ctx.beginPath();
    ctx.arc(75, 64, 42, 0, Math.PI * 2);
    ctx.arc(135, 58, 48, 0, Math.PI * 2);
    ctx.arc(185, 68, 38, 0, Math.PI * 2);
    ctx.fill();

    // Bold graffiti tag
    ctx.font = 'italic 900 40px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#12081c';
    ctx.strokeText(title, 128, 66);
    ctx.fillStyle = color1;
    ctx.fillText(title, 128, 66);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createRadialGlowTexture(innerHex = '#ffaa44', outerHex = 'rgba(255, 60, 140, 0)') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, innerHex);
    grad.addColorStop(0.45, innerHex);
    grad.addColorStop(1, outerHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // ============================================================================
  // 2. FULLSCREEN CEL-SHADING & COMIC OUTLINE POST-PROCESSING PIPELINE
  // ============================================================================

  _initPostProcessing(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));

    // CRITICAL: samples: 0 for SwiftShader/WebGL depth texture compatibility
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;

    this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      samples: 0,
      depthBuffer: true,
      depthTexture: depthTexture,
    });

    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new THREE.Scene();

    this.postMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.renderTarget.texture },
        tDepth: { value: this.renderTarget.depthTexture },
        uResolution: { value: new THREE.Vector2(w, h) },
        uCameraNear: { value: this.camera.near },
        uCameraFar: { value: this.camera.far },
        uOutlineStrength: { value: 0.92 },
        uTime: { value: 0.0 },
        uHeatHaze: { value: 0.22 },
        uSunsetFactor: { value: 0.85 },
        uNightFactor: { value: 0.25 },
        uRainFactor: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        #include <packing>
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform vec2 uResolution;
        uniform float uCameraNear;
        uniform float uCameraFar;
        uniform float uOutlineStrength;
        uniform float uTime;
        uniform float uHeatHaze;
        uniform float uSunsetFactor;
        uniform float uNightFactor;
        uniform float uRainFactor;
        varying vec2 vUv;

        float getLinearDepth(vec2 coord) {
          float fragCoordZ = texture2D(tDepth, clamp(coord, 0.001, 0.999)).x;
          float viewZ = perspectiveDepthToViewZ(fragCoordZ, uCameraNear, uCameraFar);
          return viewZToOrthographicDepth(viewZ, uCameraNear, uCameraFar);
        }

        float getLuma(vec3 c) {
          return dot(c, vec3(0.299, 0.587, 0.114));
        }

        void main() {
          vec2 texel = 1.0 / max(uResolution, vec2(1.0));

          // Subtle daytime / sunset heat-haze distortion near screen horizon/edges
          vec2 sampleUv = vUv;
          if (uHeatHaze > 0.01) {
            float wave = sin(vUv.y * 55.0 + uTime * 3.8) * cos(vUv.x * 40.0 - uTime * 2.4);
            sampleUv.x += wave * 0.00055 * uHeatHaze;
          }

          vec4 baseSample = texture2D(tDiffuse, sampleUv);
          // Convert offscreen WebGLRenderTarget Linear RGB to sRGB so midtones (roads, sidewalks, buildings) never crush to black!
          vec3 col = pow(max(baseSample.rgb, vec3(0.0)), vec3(1.0 / 2.1));

          // Sobel 3x3 Depth & Luminance Edge Detection
          float dC  = getLinearDepth(sampleUv);
          float dTL = getLinearDepth(sampleUv + texel * vec2(-1.0,  1.0));
          float dT  = getLinearDepth(sampleUv + texel * vec2( 0.0,  1.0));
          float dTR = getLinearDepth(sampleUv + texel * vec2( 1.0,  1.0));
          float dL  = getLinearDepth(sampleUv + texel * vec2(-1.0,  0.0));
          float dR  = getLinearDepth(sampleUv + texel * vec2( 1.0,  0.0));
          float dBL = getLinearDepth(sampleUv + texel * vec2(-1.0, -1.0));
          float dB  = getLinearDepth(sampleUv + texel * vec2( 0.0, -1.0));
          float dBR = getLinearDepth(sampleUv + texel * vec2( 1.0, -1.0));

          float gxD = -dTL - 2.0 * dL - dBL + dTR + 2.0 * dR + dBR;
          float gyD = -dTL - 2.0 * dT - dTR + dBL + 2.0 * dB + dBR;
          // Compare against expected planar gradient so flat asphalt doesn't false-trigger
          float distOutlineFade = 1.0 - smoothstep(0.068, 0.165, dC);
          float depthGrad = length(vec2(gxD, gyD)) * (uCameraFar / 420.0);
          float depthEdge = smoothstep(0.0042, 0.0135, depthGrad) * distOutlineFade;

          // Color Luminance Sobel for crisp architectural & vehicle graphic-novel ink lines
          float lTL = getLuma(pow(max(texture2D(tDiffuse, sampleUv + texel * vec2(-1.0,  1.0)).rgb, vec3(0.0)), vec3(1.0 / 2.1)));
          float lT  = getLuma(pow(max(texture2D(tDiffuse, sampleUv + texel * vec2( 0.0,  1.0)).rgb, vec3(0.0)), vec3(1.0 / 2.1)));
          float lTR = getLuma(pow(max(texture2D(tDiffuse, sampleUv + texel * vec2( 1.0,  1.0)).rgb, vec3(0.0)), vec3(1.0 / 2.1)));
          float lL  = getLuma(pow(max(texture2D(tDiffuse, sampleUv + texel * vec2(-1.0,  0.0)).rgb, vec3(0.0)), vec3(1.0 / 2.1)));
          float lR  = getLuma(pow(max(texture2D(tDiffuse, sampleUv + texel * vec2( 1.0,  0.0)).rgb, vec3(0.0)), vec3(1.0 / 2.1)));
          float lBL = getLuma(pow(max(texture2D(tDiffuse, sampleUv + texel * vec2(-1.0, -1.0)).rgb, vec3(0.0)), vec3(1.0 / 2.1)));
          float lB  = getLuma(pow(max(texture2D(tDiffuse, sampleUv + texel * vec2( 0.0, -1.0)).rgb, vec3(0.0)), vec3(1.0 / 2.1)));
          float lBR = getLuma(pow(max(texture2D(tDiffuse, sampleUv + texel * vec2( 1.0, -1.0)).rgb, vec3(0.0)), vec3(1.0 / 2.1)));

          float gxL = -lTL - 2.0 * lL - lBL + lTR + 2.0 * lR + lBR;
          float gyL = -lTL - 2.0 * lT - lTR + lBL + 2.0 * lB + lBR;
          float lumaGrad = length(vec2(gxL, gyL));
          float lumaEdge = smoothstep(0.45, 0.88, lumaGrad) * 0.58 * distOutlineFade;

          float edge = clamp(max(depthEdge, lumaEdge) * uOutlineStrength, 0.0, 1.0);

          // Soft 3-Tone Cel-Shading Posterization + Neon Glow Preservation
          float luma = getLuma(col);
          float steppedLuma = mix(luma, floor(luma * 6.5 + 0.45) / 6.5, 0.18 * (1.0 - smoothstep(0.72, 0.98, luma)));
          col *= (steppedLuma / max(luma, 0.001));

          // 1980s Argon City Color Grading LUT (Balanced so medium-grey roads & turquoise ocean stay crisp)
          vec3 shadowTint = mix(vec3(0.12, 0.10, 0.22), vec3(0.08, 0.08, 0.18), uNightFactor);
          vec3 midTint    = mix(vec3(1.01, 0.99, 1.00), vec3(1.04, 0.95, 0.99), uSunsetFactor * 0.25);
          vec3 highTint   = mix(vec3(1.02, 1.01, 0.98), vec3(1.05, 0.96, 0.92), uSunsetFactor * 0.28);

          col = mix(col + shadowTint * 0.04, col * midTint, smoothstep(0.06, 0.52, luma));
          col = mix(col, col * highTint, smoothstep(0.52, 0.95, luma));

          // Boost signature Argon City saturation moderately
          vec3 gray = vec3(getLuma(col));
          float viceBoost = 1.12 + uSunsetFactor * 0.06 + uRainFactor * 0.08;
          col = mix(gray, col, viceBoost);

          // Apply crisp comic-book dark ink silhouette outline
          vec3 inkColor = vec3(0.04, 0.02, 0.08);
          col = mix(col, inkColor, edge);

          // Subtle Grand Theft Argon graphic vignette
          vec2 vigUv = vUv * (1.0 - vUv.yx);
          float vig = pow( clamp(vigUv.x * vigUv.y * 16.0, 0.0, 1.0), 0.14 );
          col *= mix(0.84, 1.0, vig);

          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
      `,
      depthWrite: false,
      depthTest: false,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    this.postScene.add(quad);
  }

  // ============================================================================
  // 3. LIGHTING, SKY DOME & ATMOSPHERE (NO LIGHT.VISIBLE TOGGLING!)
  // ============================================================================

  _initLightingAndSky() {
    // Hemisphere Light (Tropical Cyan Sky / Warm Pastel Ground Bounce)
    this.hemiLight = new THREE.HemisphereLight(0xffb8e0, 0x6c6682, 1.35);
    this.hemiLight.position.set(0, 120, 0);
    this.scene.add(this.hemiLight);

    // Ambient Fill Light so roads, buildings, and vehicles stay bright & readable
    this.ambientLight = new THREE.AmbientLight(0x9088a8, 0.85);
    this.scene.add(this.ambientLight);

    // Main Sun / Moon Directional Light (ONLY light that casts shadows)
    this.sunLight = new THREE.DirectionalLight(0xfff4dc, 1.95);
    this.sunLight.position.set(-95, 78, -45);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 260;
    const frustum = 78;
    this.sunLight.shadow.camera.left = -frustum;
    this.sunLight.shadow.camera.right = frustum;
    this.sunLight.shadow.camera.top = frustum;
    this.sunLight.shadow.camera.bottom = -frustum;
    this.sunLight.shadow.bias = -0.0006;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Secondary Neon Rim Directional Light (castShadow = false, always visible = true)
    this.rimLight = new THREE.DirectionalLight(0x00f0ff, 0.45);
    this.rimLight.position.set(90, 45, 65);
    this.rimLight.castShadow = false;
    this.scene.add(this.rimLight);

    // Pre-allocate hero Neon PointLights (NEVER toggle visible, only modulate intensity)
    const accentConfigs = [
      { x: 68, y: 8, z: 22, color: 0xff2a85, dist: 38 },   // Ocean View Hotel Neon
      { x: 68, y: 8, z: 68, color: 0x00f0ff, dist: 38 },   // The Carlyle Neon
      { x: 68, y: 8, z: -20, color: 0xff2a85, dist: 38 },  // Beacon Hotel Neon
      { x: 62, y: 6, z: -42, color: 0xff7722, dist: 34 },  // Argon Gas '86 Canopy
      { x: 66, y: 8, z: -115, color: 0xff00aa, dist: 40 }, // The Malibu Club
      { x: -30, y: 9, z: -15, color: 0xffaa66, dist: 42 }, // Vercetti Estate Mansion
      { x: -130, y: 7, z: -55, color: 0xffcc00, dist: 34 },// Kaufman Cabs Depot
      { x: 15, y: 6, z: 112, color: 0x00f0ff, dist: 35 },  // Argon Port Yacht Pier
    ];
    for (const cfg of accentConfigs) {
      const pl = new THREE.PointLight(cfg.color, 1.4, cfg.dist, 1.6);
      pl.position.set(cfg.x, cfg.y, cfg.z);
      pl.castShadow = false;
      pl.visible = true;
      this.scene.add(pl);
      this.accentPointLights.push({ light: pl, baseIntensity: 1.5 });
    }

    // 1980s Argon City Gradient Sky Dome with Sunset Bands, Stars & Synthwave Sun Disc
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color(0x1b0c38) },
      uMidColor: { value: new THREE.Color(0xb82572) },
      uHorizonColor: { value: new THREE.Color(0xff9254) },
      uSunDir: { value: new THREE.Vector3(-0.6, 0.35, -0.4).normalize() },
      uNightFactor: { value: 0.25 },
      uTime: { value: 0.0 },
    };

    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = position;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform float uNightFactor;
        uniform float uTime;
        varying vec3 vWorldPos;

        void main() {
          vec3 dir = normalize(vWorldPos);
          float y = clamp(dir.y, 0.0, 1.0);

          vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.28, y));
          col = mix(col, uTopColor, smoothstep(0.24, 0.82, y));

          if (dir.y < 0.0) {
            vec3 deepOceanTeal = vec3(0.04, 0.42, 0.56) * mix(1.0, 0.52, uNightFactor);
            col = mix(col, deepOceanTeal, smoothstep(0.0, -0.08, dir.y));
          }

          // Synthwave / Argon City Striped Setting Sun Disc
          float sunCos = dot(dir, uSunDir);
          if (sunCos > 0.965 && dir.y >= -0.02) {
            float sunMask = smoothstep(0.965, 0.972, sunCos);
            float stripeWave = sin(dir.y * 180.0);
            float stripeCut = step(-0.25, stripeWave + (dir.y - uSunDir.y) * 22.0);
            vec3 sunCol = mix(vec3(1.0, 0.18, 0.55), vec3(1.0, 0.92, 0.45), clamp((dir.y - uSunDir.y) * 18.0 + 0.5, 0.0, 1.0));
            col = mix(col, sunCol, sunMask * stripeCut);
          } else if (sunCos > 0.82 && dir.y >= -0.04) {
            float halo = pow((sunCos - 0.82) / 0.145, 2.0);
            col += vec3(1.0, 0.35, 0.55) * halo * 0.42;
          }

          // Night stars
          if (uNightFactor > 0.15 && y > 0.15) {
            vec3 p = floor(dir * 260.0);
            float h = fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
            if (h > 0.994) {
              float twinkle = 0.65 + 0.35 * sin(uTime * 3.0 + h * 100.0);
              col += vec3(0.95, 0.92, 1.0) * uNightFactor * twinkle * smoothstep(0.15, 0.4, y);
            }
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 20), skyMat);
    this.scene.add(this.skyDome);
  }

  // ============================================================================
  // 4. TROPICAL WATER SHADER, SHORELINE FOAM & WAKE RIBBONS
  // ============================================================================

  _buildWaterAndShorelines() {
    this.waterUniforms = {
      uTime: { value: 0.0 },
      uCameraXZ: { value: new THREE.Vector2(80, -26) },
      uShallowColor: { value: new THREE.Color(0x18d8ec) },
      uDeepColor: { value: new THREE.Color(0x0a84a8) },
      uFoamColor: { value: new THREE.Color(0xf4ffff) },
      uSunsetTint: { value: new THREE.Color(0x70f4ff) },
      uSunsetFactor: { value: 0.35 },
      uNightFactor: { value: 0.25 },
    };

    const waterMat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: false,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vWorldXZ;
        varying float vWave;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldXZ = wp.xz;
          float w1 = sin(wp.x * 0.18 + uTime * 2.1) * cos(wp.z * 0.14 + uTime * 1.6);
          float w2 = sin((wp.x + wp.z) * 0.27 - uTime * 2.8) * 0.5;
          vWave = w1 + w2;
          wp.y += vWave * 0.055;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec2 uCameraXZ;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform vec3 uFoamColor;
        uniform vec3 uSunsetTint;
        uniform float uSunsetFactor;
        uniform float uNightFactor;
        varying vec2 vWorldXZ;
        varying float vWave;

        // Procedural cellular caustic pattern
        float causticPattern(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float minDist = 1.0;
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 neighbor = vec2(float(x), float(y));
              vec2 cell = i + neighbor;
              float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
              vec2 pt = neighbor + 0.5 + 0.38 * sin(uTime * 1.7 + 6.2831 * h + vec2(0.0, 1.57));
              float d = length(pt - f);
              minDist = min(minDist, d);
            }
          }
          return smoothstep(0.32, 0.58, minDist);
        }

        void main() {
          // Determine proximity to shorelines for shallow turquoise glow + white surf foam
          float dBeach = abs(vWorldXZ.x - 137.5);
          float dEastWall = abs(vWorldXZ.x - 34.0);
          float dWestWall = abs(vWorldXZ.x - (-100.0));
          vec2 sfRel = abs(vWorldXZ - vec2(-30.0, 0.0)) - vec2(42.0, 68.0);
          float dStarfish = length(max(sfRel, 0.0)) + min(max(sfRel.x, sfRel.y), 0.0);

          float minShoreDist = min(min(dBeach, dEastWall), min(dWestWall, abs(dStarfish)));
          if (abs(vWorldXZ.x) > 180.0 || abs(vWorldXZ.y) > 180.0) {
            vec2 cRel = abs(mod(vWorldXZ + 60.0, 120.0) - 60.0);
            float dChunkEdge = abs(max(cRel.x, cRel.y) - 52.0);
            minShoreDist = min(minShoreDist, dChunkEdge);
          }
          float shallowMask = 1.0 - smoothstep(0.0, 26.0, minShoreDist);

          float camDist = length(vWorldXZ - uCameraXZ);
          float causticFade = 1.0 - smoothstep(85.0, 195.0, camDist);

          // Always preserve vibrant tropical Argon Bay turquoise-cyan!
          vec3 waterCol = mix(uDeepColor, uShallowColor, shallowMask * 0.72 + 0.28);

          // Gentle night darkening while staying distinctly teal/turquoise
          waterCol *= mix(1.0, 0.52, uNightFactor);

          // Dual-layer animated caustics
          float c1 = causticPattern(vWorldXZ * 0.22 + vec2(uTime * 0.14, -uTime * 0.11));
          float c2 = causticPattern(vWorldXZ * 0.34 - vec2(uTime * 0.18, uTime * 0.12));
          float caustics = pow(max(c1, c2), 2.0);

          // Stepped cel-shaded wave highlights & aqua/white glints (faded smoothly at horizon to prevent Moiré)
          float glint = step(0.65, caustics + vWave * 0.16) * causticFade;
          vec3 glintCol = vec3(0.82, 0.99, 1.0);
          waterCol = mix(waterCol, glintCol, glint * 0.42);
          waterCol += uShallowColor * mix(0.08, step(0.45, caustics) * 0.16, causticFade);

          // Animated White Shoreline Surf Foam
          float surfWave = sin(minShoreDist * 1.4 - uTime * 3.6 + sin(vWorldXZ.y * 0.18) * 2.0);
          float surfBand = (1.0 - smoothstep(0.0, 5.2, minShoreDist)) * step(0.12, surfWave);
          float contactFoam = 1.0 - smoothstep(0.0, 1.5, minShoreDist);
          float totalFoam = clamp(max(surfBand * 0.88, contactFoam), 0.0, 1.0) * causticFade;

          waterCol = mix(waterCol, uFoamColor, totalFoam);

          gl_FragColor = vec4(waterCol, 1.0);
        }
      `,
    });

    const waterGeo = new THREE.PlaneGeometry(1600, 1600, 96, 96);
    waterGeo.rotateX(-Math.PI / 2);
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.y = -0.35;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);

    // Pre-allocate Pool of 64 Boat/Vehicle Water Wake Foam V-Trails
    const wakeGeo = new THREE.RingGeometry(0.35, 1.15, 12);
    wakeGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xf4ffff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(wakeGeo, mat);
      mesh.position.set(0, -0.31, 0);
      this.scene.add(mesh);
      this.waterWakes.push({
        mesh,
        mat,
        active: false,
        age: 0,
        maxAge: 1.6,
        vx: 0,
        vz: 0,
      });
    }
    this._wakeCursor = 0;
  }

  /**
   * Spawns/updates a white surf wake ripple on the water surface at (x, z).
   */
  addWaterWake(x, z, vx = 0, vz = 0) {
    const w = this.waterWakes[this._wakeCursor];
    this._wakeCursor = (this._wakeCursor + 1) % this.waterWakes.length;
    w.active = true;
    w.age = 0;
    w.maxAge = 1.35 + Math.random() * 0.45;
    w.vx = vx * 0.12;
    w.vz = vz * 0.12;
    w.mesh.position.set(x + (Math.random() - 0.5) * 0.6, -0.31, z + (Math.random() - 0.5) * 0.6);
    w.mesh.scale.setScalar(0.65);
    w.mat.opacity = 0.82;
  }

  // ============================================================================
  // 5. LANDMASSES, SEAWALLS & GOLDEN OCEAN BEACH SAND
  // ============================================================================

  _buildLandmassesAndBeaches() {
    const landGroup = new THREE.Group();

    const grassBaseTex = this._createGrassTexture();
    const parkGrassTex = grassBaseTex.clone();
    parkGrassTex.needsUpdate = true;
    parkGrassTex.repeat.set(2, 68);

    const sfGrassTex = grassBaseTex.clone();
    sfGrassTex.needsUpdate = true;
    sfGrassTex.repeat.set(18, 28);

    const sandBaseTex = this._createSandTexture();
    const mainSandTex = sandBaseTex.clone();
    mainSandTex.needsUpdate = true;
    mainSandTex.repeat.set(8, 64);

    const urbanGroundMat = this._createToonMaterial(0x424052);
    const grassMat = new THREE.MeshToonMaterial({
      color: 0xffffff,
      map: parkGrassTex,
      gradientMap: this.toonGradientMap,
    });
    const lushLawnMat = new THREE.MeshToonMaterial({
      color: 0xffffff,
      map: sfGrassTex,
      gradientMap: this.toonGradientMap,
    });
    const sandMat = new THREE.MeshToonMaterial({
      color: 0xffffff,
      map: mainSandTex,
      gradientMap: this.toonGradientMap,
    });
    const wetSandMat = this._createToonMaterial(0xd4b072);
    const seawallMat = this._createToonMaterial(0xeae2dc);
    const pinkDecoWallMat = this._createToonMaterial(0xff94b8);
    const cyanDecoTrimMat = this._createToonMaterial(0x4be8e0);

    // 1. EAST MAINLAND (OCEAN BEACH URBAN BASE): x in [34, 95], z in [-168, 168]
    const eastLandGeo = new THREE.BoxGeometry(61, 1.2, 336);
    const eastLand = new THREE.Mesh(eastLandGeo, urbanGroundMat);
    eastLand.position.set(64.5, -0.6, 0);
    eastLand.receiveShadow = true;
    landGroup.add(eastLand);

    // East Mainland Bay Seawall along x = 34
    const eastSeawall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 336), seawallMat);
    eastSeawall.position.set(34.2, -0.35, 0);
    addComicOutline(eastSeawall);
    landGroup.add(eastSeawall);

    // Lush Botanical Tropical Grass Park Strip between Ocean Drive (x=80) and Beach Promenade (x=93.8)
    const beachParkStrip = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.28, 326), grassMat);
    beachParkStrip.position.set(90.2, 0.01, 0);
    beachParkStrip.receiveShadow = true;
    addComicOutline(beachParkStrip);
    landGroup.add(beachParkStrip);

    // Art Deco Serpentine Beach Seawall along x = 93.8
    for (let z = -155; z <= 155; z += 24) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.78, 18.5), z % 48 === 0 ? pinkDecoWallMat : seawallMat);
      seg.position.set(93.8, 0.39, z);
      seg.castShadow = true;
      seg.receiveShadow = true;
      addComicOutline(seg);
      landGroup.add(seg);

      // Turquoise Art Deco coping cap
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.16, 18.8), cyanDecoTrimMat);
      cap.position.set(93.8, 0.82, z);
      addComicOutline(cap);
      landGroup.add(cap);
    }

    // 2. OCEAN BEACH GOLDEN SAND: x in [94, 130], z in [-168, 168]
    const sandGeo = new THREE.BoxGeometry(36, 1.1, 334);
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.position.set(112, -0.54, 0);
    sandMesh.receiveShadow = true;
    landGroup.add(sandMesh);

    // Sloped Wet Shoreline Sand Strip: x in [126, 133]
    const wetSandGeo = new THREE.BoxGeometry(7.5, 0.9, 334);
    const wetSand = new THREE.Mesh(wetSandGeo, wetSandMat);
    wetSand.position.set(129.5, -0.68, 0);
    wetSand.rotation.z = -0.045;
    wetSand.receiveShadow = true;
    landGroup.add(wetSand);

    // 3. STARFISH ISLAND: x in [-72, 12], z in [-68, 68]
    const sfBase = new THREE.Mesh(new THREE.BoxGeometry(84, 1.25, 136), lushLawnMat);
    sfBase.position.set(-30, -0.61, 0);
    sfBase.receiveShadow = true;
    addComicOutline(sfBase);
    landGroup.add(sfBase);

    // Starfish Island Perimeter Stone Seawall Coping
    const sfWallN = new THREE.Mesh(new THREE.BoxGeometry(85.2, 0.62, 1.2), seawallMat);
    sfWallN.position.set(-30, 0.16, -68);
    const sfWallS = sfWallN.clone();
    sfWallS.position.set(-30, 0.16, 68);
    addComicOutline(sfWallN);
    addComicOutline(sfWallS);
    landGroup.add(sfWallN, sfWallS);

    // 4. WEST MAINLAND (LITTLE HAITI & WEST ARGON PORT): x in [-170, -100], z in [-168, 160]
    const westLand = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 328), urbanGroundMat);
    westLand.position.set(-135, -0.6, -4);
    westLand.receiveShadow = true;
    landGroup.add(westLand);

    const westSeawall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 328), seawallMat);
    westSeawall.position.set(-100.2, -0.35, -4);
    addComicOutline(westSeawall);
    landGroup.add(westSeawall);

    // 5. DOWNTOWN METROPOLIS WATERFRONT TERRACE: x in [15, 34], z in [-164, -12]
    const dtTerrace = new THREE.Mesh(new THREE.BoxGeometry(19.5, 1.2, 152), urbanGroundMat);
    dtTerrace.position.set(24.75, -0.6, -88);
    dtTerrace.receiveShadow = true;
    addComicOutline(dtTerrace);
    landGroup.add(dtTerrace);

    const dtSeawall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 152.5), seawallMat);
    dtSeawall.position.set(15.2, -0.32, -88);
    addComicOutline(dtSeawall);
    landGroup.add(dtSeawall);

    // 6. PALM SPRINGS & BAYSHORE ESTATES SUBURBAN PENINSULA: x in [-100, -75]
    // North Peninsula (z in [-164, -10]) & South Peninsula (z in [10, 86])
    const subLandN = new THREE.Mesh(new THREE.BoxGeometry(25, 1.22, 154), lushLawnMat);
    subLandN.position.set(-87.5, -0.6, -87);
    subLandN.receiveShadow = true;
    addComicOutline(subLandN);
    landGroup.add(subLandN);

    const subWallN = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.45, 154.4), seawallMat);
    subWallN.position.set(-75.2, -0.32, -87);
    addComicOutline(subWallN);
    landGroup.add(subWallN);

    const subLandS = new THREE.Mesh(new THREE.BoxGeometry(25, 1.22, 76), lushLawnMat);
    subLandS.position.set(-87.5, -0.6, 48);
    subLandS.receiveShadow = true;
    addComicOutline(subLandS);
    landGroup.add(subLandS);

    const subWallS = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.45, 76.4), seawallMat);
    subWallS.position.set(-75.2, -0.32, 48);
    addComicOutline(subWallS);
    landGroup.add(subWallS);

    this.scene.add(landGroup);
  }

  // ============================================================================
  // 6. MULTI-LANE ROAD NETWORK, CROSSWALKS, HATCH BOXES, SIDEWALKS & BRIDGES
  // ============================================================================

  _buildRoadNetworkAndBridges() {
    this.roadGroup = new THREE.Group();

    const roadTex4 = this._createRoadSegmentTexture(4);
    const intersectionTex = this._createIntersectionBoxTexture();
    const sidewalkBaseTex = this._createSidewalkTexture();

    const intersectionMat = new THREE.MeshToonMaterial({
      map: intersectionTex,
      gradientMap: this.toonGradientMap,
    });

    const bridgeDeckMat = this._createToonMaterial(0x4a4c5e);
    const bridgeRailMat = this._createToonMaterial(0xff80b0);
    const bridgePillarMat = this._createToonMaterial(0xe5ddd5);

    const addRoadStrip = (x, z, width, length, isEastWest = false, y = 0.02, withSidewalks = true) => {
      const tex = roadTex4.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, Math.max(1, Math.round(length / 18)));
      const mat = new THREE.MeshToonMaterial({
        map: tex,
        gradientMap: this.toonGradientMap,
      });

      const geo = new THREE.PlaneGeometry(width, length);
      geo.rotateX(-Math.PI / 2);
      if (isEastWest) {
        geo.rotateY(Math.PI / 2);
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      this.roadGroup.add(mesh);

      if (withSidewalks) {
        const swWidth = 2.8;
        const swHeight = 0.15;
        const swTex = sidewalkBaseTex.clone();
        swTex.needsUpdate = true;
        if (!isEastWest) {
          swTex.repeat.set(1, Math.max(1, Math.round(length / 4.5)));
        } else {
          swTex.repeat.set(Math.max(1, Math.round(length / 4.5)), 1);
        }
        const swTiledMat = new THREE.MeshToonMaterial({
          color: 0xffffff,
          map: swTex,
          gradientMap: this.toonGradientMap,
        });

        if (!isEastWest) {
          const swL = new THREE.Mesh(new THREE.BoxGeometry(swWidth, swHeight, length), swTiledMat);
          swL.position.set(x - width / 2 - swWidth / 2, y + swHeight / 2 - 0.01, z);
          swL.receiveShadow = true;
          addComicOutline(swL);

          const swR = new THREE.Mesh(new THREE.BoxGeometry(swWidth, swHeight, length), swTiledMat);
          swR.position.set(x + width / 2 + swWidth / 2, y + swHeight / 2 - 0.01, z);
          swR.receiveShadow = true;
          addComicOutline(swR);
          this.roadGroup.add(swL, swR);
        } else {
          const swN = new THREE.Mesh(new THREE.BoxGeometry(length, swHeight, swWidth), swTiledMat);
          swN.position.set(x, y + swHeight / 2 - 0.01, z - width / 2 - swWidth / 2);
          swN.receiveShadow = true;
          addComicOutline(swN);

          const swS = new THREE.Mesh(new THREE.BoxGeometry(length, swHeight, swWidth), swTiledMat);
          swS.position.set(x, y + swHeight / 2 - 0.01, z + width / 2 + swWidth / 2);
          swS.receiveShadow = true;
          addComicOutline(swS);
          this.roadGroup.add(swN, swS);
        }
      }
    };

    const addIntersectionBox = (x, z, size = 14.5, y = 0.032) => {
      const geo = new THREE.PlaneGeometry(size, size);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, intersectionMat);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      this.roadGroup.add(mesh);
    };

    this._sharedRoadTex4 = roadTex4;
    this._sharedIntersectionMat = intersectionMat;
    this._sharedSidewalkBaseTex = sidewalkBaseTex;
    this._sharedBridgeDeckMat = bridgeDeckMat;
    this._sharedBridgeRailMat = bridgeRailMat;
    this._sharedBridgePillarMat = bridgePillarMat;

    // --- PRIMARY NORTH-SOUTH ARTERIES (extended to Frontier Ring z = ±170) ---
    // 1. Ocean Drive (x = 80, z from -170 to 170)
    addRoadStrip(80, 0, 14, 344, false, 0.02, true);
    // 2. Washington Ave (x = 40, z from -170 to 170)
    addRoadStrip(40, 0, 14, 344, false, 0.02, true);
    // 3. Starfish Island Central Blvd (x = -30, z from -60 to 60)
    addRoadStrip(-30, 0, 12, 120, false, 0.025, true);
    // 4. Little Haiti Blvd (x = -115, z from -170 to 170)
    addRoadStrip(-115, 0, 14, 344, false, 0.02, true);
    // 5. West Industrial Ave (x = -152, z from -170 to 170)
    addRoadStrip(-152, 0, 11, 344, false, 0.02, true);

    // --- PRIMARY EAST-WEST ARTERIES & CROSS STREETS ---
    // 1. Starfish Causeway (z = 0, x from -152 to 80)
    addRoadStrip(57, 0, 14, 46, true, 0.024, true);    // Ocean Beach link
    addRoadStrip(-30, 0, 14, 84, true, 0.026, true);   // Across Starfish Island
    addRoadStrip(-126, 0, 14, 52, true, 0.024, true);  // Little Haiti link

    // 2. North Beach Crossway (z = -90, x from -152 to 80)
    addRoadStrip(57, -90, 13, 46, true, 0.024, true);
    addRoadStrip(-126, -90, 13, 52, true, 0.024, true);

    // 3. Argon Port Highway (z = 95, x from -152 to 80)
    addRoadStrip(57, 95, 14, 46, true, 0.024, true);
    addRoadStrip(-126, 95, 14, 52, true, 0.024, true);

    // 4. Midtown Cross Streets (z = -45, z = 45, z = -135, z = 140)
    addRoadStrip(60, -45, 12, 40, true, 0.024, false);
    addRoadStrip(60, 45, 12, 40, true, 0.024, false);
    addRoadStrip(60, -135, 12, 40, true, 0.024, false);
    addRoadStrip(60, 140, 12, 40, true, 0.024, false);

    addRoadStrip(-133, -45, 12, 38, true, 0.024, false);
    addRoadStrip(-133, 45, 12, 38, true, 0.024, false);
    addRoadStrip(-133, -135, 12, 38, true, 0.024, false);

    // --- CAUSEWAY BRIDGES OVER BISCAYNE BAY & FRONTIER GATEWAYS ---
    const buildCausewayBridge = (xMin, xMax, zCenter, width = 16, _name = 'Bridge') => {
      const span = xMax - xMin;
      const cx = (xMin + xMax) * 0.5;

      // Bridge Deck at Y = 0.42
      const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 0.55, width), bridgeDeckMat);
      deck.position.set(cx, 0.18, zCenter);
      deck.castShadow = true;
      deck.receiveShadow = true;
      addComicOutline(deck);
      this.roadGroup.add(deck);

      // Asphalt surface on bridge deck
      addRoadStrip(cx, zCenter, width - 2.6, span, true, 0.47, false);

      // Pink & White Art Deco Bridge Parapet Guardrails + Arch Supports
      const railN = new THREE.Mesh(new THREE.BoxGeometry(span, 1.05, 0.85), bridgeRailMat);
      railN.position.set(cx, 0.96, zCenter - width / 2 + 0.42);
      railN.castShadow = true;
      addComicOutline(railN);

      const railS = new THREE.Mesh(new THREE.BoxGeometry(span, 1.05, 0.85), bridgeRailMat);
      railS.position.set(cx, 0.96, zCenter + width / 2 - 0.42);
      railS.castShadow = true;
      addComicOutline(railS);
      this.roadGroup.add(railN, railS);

      // Concrete Twin Support Pillars in the Water
      const numPiers = Math.max(2, Math.floor(span / 18));
      for (let i = 1; i < numPiers; i++) {
        const px = xMin + (span * i) / numPiers;
        for (const pz of [zCenter - width * 0.35, zCenter + width * 0.35]) {
          const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 2.4, 8), bridgePillarMat);
          pier.position.set(px, -0.7, pz);
          addComicOutline(pier);
          this.roadGroup.add(pier);
        }
      }
    };

    const buildNorthSouthCausewayBridge = (zMin, zMax, xCenter, width = 16) => {
      const span = zMax - zMin;
      const cz = (zMin + zMax) * 0.5;

      const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.55, span), bridgeDeckMat);
      deck.position.set(xCenter, 0.18, cz);
      deck.castShadow = true;
      deck.receiveShadow = true;
      addComicOutline(deck);
      this.roadGroup.add(deck);

      addRoadStrip(xCenter, cz, width - 2.6, span, false, 0.47, false);

      const railW = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, span), bridgeRailMat);
      railW.position.set(xCenter - width / 2 + 0.42, 0.96, cz);
      railW.castShadow = true;
      addComicOutline(railW);

      const railE = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, span), bridgeRailMat);
      railE.position.set(xCenter + width / 2 - 0.42, 0.96, cz);
      railE.castShadow = true;
      addComicOutline(railE);
      this.roadGroup.add(railW, railE);

      const numPiers = Math.max(2, Math.floor(span / 18));
      for (let i = 1; i < numPiers; i++) {
        const pz = zMin + (span * i) / numPiers;
        for (const px of [xCenter - width * 0.35, xCenter + width * 0.35]) {
          const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 2.4, 8), bridgePillarMat);
          pier.position.set(px, -0.7, pz);
          addComicOutline(pier);
          this.roadGroup.add(pier);
        }
      }
    };

    // 1. East Starfish Bridge: x in [12, 34], z = 0
    buildCausewayBridge(12, 34, 0, 16.5, 'East Starfish Bridge');
    // 2. West Starfish Bridge: x in [-100, -72], z = 0
    buildCausewayBridge(-100, -72, 0, 16.5, 'West Starfish Bridge');
    // 3. North Beach Crossway Bridge: x in [-100, 34], z = -90
    buildCausewayBridge(-100, 34, -90, 15.5, 'North Beach Crossway');
    // 4. Argon Port Highway Causeway: x in [-100, 34], z = 95
    buildCausewayBridge(-100, 34, 95, 16.5, 'Argon Port Highway Bridge');

    // 5. FRONTIER RING CAUSEWAYS & INFINITE CHUNK GATEWAY BRIDGES (connecting core map to ±180m chunk grid):
    // North & South Frontier Ring Boulevards at z = -170 and z = +170 (x from -173 to +120)
    buildCausewayBridge(-173, 120, -170, 15.5, 'North Frontier Causeway');
    buildCausewayBridge(-173, 120, 170, 15.5, 'South Frontier Causeway');
    // North & South Gateway Bridges along x = -120, -115, 0, 40, 80, +120 out to z = ±190
    for (const gx of [-120, -115, 0, 40, 80, 120]) {
      buildNorthSouthCausewayBridge(-190, -162, gx, 15.5);
      buildNorthSouthCausewayBridge(162, 190, gx, 15.5);
    }
    // East Atlantic Gateway Causeway Bridges at z = -120, 0, +120 (from Ocean Drive x = 80 out to x = +180)
    for (const gz of [-120, 0, 120]) {
      addRoadStrip(104, gz, 14, 48, true, 0.03, false); // across beach sand x = 80..128
      buildCausewayBridge(128, 180, gz, 15.5, 'Atlantic Gateway Causeway');
    }
    // West Frontier Boulevard at x = -173 (z from -170 to +170) & West Gateway Bridges at z = -120, 0, +120
    buildNorthSouthCausewayBridge(-170, 170, -173, 15.0);
    buildCausewayBridge(-173, -152, -90, 14.5, 'West North Connector');
    buildCausewayBridge(-180, -152, 0, 15.5, 'West Central Gateway');
    buildCausewayBridge(-173, -152, 95, 14.5, 'West South Connector');
    buildCausewayBridge(-180, -173, -120, 15.5, 'West North Chunk Gateway');
    buildCausewayBridge(-180, -173, 120, 15.5, 'West South Chunk Gateway');

    // --- GRAND THEFT ARGON YELLOW CROSS-HATCHED INTERSECTION BOXES ---
    const majorIntersections = [
      [80, -135], [80, -120], [80, -90], [80, -45], [80, 0], [80, 45], [80, 95], [80, 120], [80, 140], [80, -170], [80, 170],
      [40, -135], [40, -90], [40, -45], [40, 0], [40, 45], [40, 95], [40, 140], [40, -170], [40, 170],
      [-30, 0],
      [-115, -135], [-115, -90], [-115, -45], [-115, 0], [-115, 45], [-115, 95], [-115, -170], [-115, 170],
      [-152, -90], [-152, 0], [-152, 95], [-152, -170], [-152, 170],
      [-120, -170], [0, -170], [120, -170],
      [-120, 170], [0, 170], [120, 170],
      [-173, -120], [-173, 0], [-173, 120],
    ];
    for (const [ix, iz] of majorIntersections) {
      addIntersectionBox(ix, iz, 14.4, ix === 0 || Math.abs(iz) === 170 || ix === -173 ? 0.48 : 0.035);
    }

    this.scene.add(this.roadGroup);

    // --- POPULATE ROAD WAYPOINTS FOR TRAFFIC & POLICE AI ---
    const registerTwoWayRoad = (x1, z1, x2, z2, district, speedLimit = 18) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz) || 1;
      const dirX = dx / len;
      const dirZ = dz / len;
      // Right-hand lane offset (~3.2m from centerline)
      const rightX = -dirZ * 3.2;
      const rightZ = dirX * 3.2;

      const isNS = Math.abs(dirZ) > Math.abs(dirX);
      const axis = isNS ? 'z' : 'x';

      this.roadWaypoints.push({
        x1: x1 + rightX,
        z1: z1 + rightZ,
        x2: x2 + rightX,
        z2: z2 + rightZ,
        dirX,
        dirZ,
        axis,
        coord: isNS ? x1 + rightX : z1 + rightZ,
        pairCoord: isNS ? x1 - rightX : z1 - rightZ,
        minCoord: isNS ? Math.min(z1, z2) : Math.min(x1, x2),
        maxCoord: isNS ? Math.max(z1, z2) : Math.max(x1, x2),
        rotationY: Math.atan2(dirX, dirZ),
        district,
        speedLimit,
      });
      this.roadWaypoints.push({
        x1: x2 - rightX,
        z1: z2 - rightZ,
        x2: x1 - rightX,
        z2: z1 - rightZ,
        dirX: -dirX,
        dirZ: -dirZ,
        axis,
        coord: isNS ? x1 - rightX : z1 - rightZ,
        pairCoord: isNS ? x1 + rightX : z1 + rightZ,
        minCoord: isNS ? Math.min(z1, z2) : Math.min(x1, x2),
        maxCoord: isNS ? Math.max(z1, z2) : Math.max(x1, x2),
        rotationY: Math.atan2(-dirX, -dirZ),
        district,
        speedLimit,
      });
    };

    // Ocean Drive, Washington Ave & Little Haiti Blvd segments
    for (let z = -170; z < 170; z += 50) {
      const zNext = Math.min(170, z + 50);
      registerTwoWayRoad(80, z, 80, zNext, 'OCEAN BEACH', 18);
      registerTwoWayRoad(40, z, 40, zNext, 'OCEAN BEACH', 20);
      registerTwoWayRoad(-115, z, -115, zNext, z >= 50 ? 'ARGON PORT MARINA' : 'LITTLE HAITI', 18);
    }
    // Causeways & Crossways + Frontier Connectors
    registerTwoWayRoad(-180, 0, -115, 0, 'LITTLE HAITI', 20);
    registerTwoWayRoad(-115, 0, -30, 0, 'STARFISH ISLAND', 20);
    registerTwoWayRoad(-30, 0, 40, 0, 'STARFISH ISLAND', 20);
    registerTwoWayRoad(40, 0, 80, 0, 'OCEAN BEACH', 16);
    registerTwoWayRoad(80, 0, 180, 0, 'OCEANFRONT KEYS', 20);
    registerTwoWayRoad(80, -120, 180, -120, 'OCEANFRONT KEYS', 20);
    registerTwoWayRoad(80, 120, 180, 120, 'OCEANFRONT KEYS', 20);
    registerTwoWayRoad(-173, -170, 120, -170, 'OCEAN BEACH', 20);
    registerTwoWayRoad(-173, 170, 120, 170, 'ARGON PORT MARINA', 20);
    registerTwoWayRoad(-173, -170, -173, 170, 'LITTLE HAITI', 20);
    registerTwoWayRoad(-115, -90, 40, -90, 'OCEAN BEACH', 22);
    registerTwoWayRoad(40, -90, 80, -90, 'OCEAN BEACH', 16);
    registerTwoWayRoad(-115, 95, 40, 95, 'ARGON PORT MARINA', 22);
    registerTwoWayRoad(40, 95, 80, 95, 'ARGON PORT MARINA', 18);
    registerTwoWayRoad(-30, -55, -30, 55, 'STARFISH ISLAND', 14);
  }

  // ============================================================================
  // 7. DISTRICT 1: OCEAN BEACH (ART DECO HOTELS, ARGON GAS '86 & BEACH)
  // ============================================================================

  _registerCollider(x, z, width, depth, height, name, district = 'OCEAN BEACH') {
    this.buildingColliders.push({
      minX: x - width * 0.5,
      maxX: x + width * 0.5,
      minZ: z - depth * 0.5,
      maxZ: z + depth * 0.5,
      height,
      name,
      district,
    });
  }

  _addRooftopDetails(group, width, depth, roofY, trimMat) {
    if (!this._sharedRoofDeckTex) {
      this._sharedRoofDeckTex = this._createRooftopTexture();
    }
    const roofTex = this._sharedRoofDeckTex.clone();
    roofTex.needsUpdate = true;
    roofTex.repeat.set(Math.max(1, Math.round(width / 7)), Math.max(1, Math.round(depth / 7)));
    const gravelMat = this._createToonMaterial(0xffffff, { map: roofTex });
    const hvacMat = this._createToonMaterial(0xb4bcc8);
    const darkMetalMat = this._createToonMaterial(0x232834);
    const skylightMat = this._createToonMaterial(0x70e8ff);

    // Recessed tar-and-gravel roof deck surface
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(2, width - 0.9), 0.16, Math.max(2, depth - 0.9)),
      gravelMat
    );
    deck.position.y = roofY + 0.08;
    deck.receiveShadow = true;
    group.add(deck);

    // Perimeter Parapet Coping Walls (4 sides)
    const pH = 0.68;
    const pT = 0.46;
    const northWall = new THREE.Mesh(new THREE.BoxGeometry(width, pH, pT), trimMat);
    northWall.position.set(0, roofY + pH * 0.5, -depth * 0.5 + pT * 0.5);
    addComicOutline(northWall);
    const southWall = new THREE.Mesh(new THREE.BoxGeometry(width, pH, pT), trimMat);
    southWall.position.set(0, roofY + pH * 0.5, depth * 0.5 - pT * 0.5);
    addComicOutline(southWall);
    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(pT, pH, Math.max(1, depth - pT * 2)), trimMat);
    eastWall.position.set(width * 0.5 - pT * 0.5, roofY + pH * 0.5, 0);
    addComicOutline(eastWall);
    const westWall = new THREE.Mesh(new THREE.BoxGeometry(pT, pH, Math.max(1, depth - pT * 2)), trimMat);
    westWall.position.set(-width * 0.5 + pT * 0.5, roofY + pH * 0.5, 0);
    addComicOutline(westWall);
    group.add(northWall, southWall, eastWall, westWall);

    // Twin Rooftop HVAC Condenser Units with Dark Circular Exhaust Fan Grilles & Ductwork
    const zOff = Math.min(depth * 0.30, 5.2);
    for (const side of [-1, 1]) {
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.05, 1.75), hvacMat);
      hvac.position.set(-width * 0.22, roofY + 0.58, side * zOff);
      hvac.castShadow = true;
      addComicOutline(hvac);
      group.add(hvac);

      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.14, 10), darkMetalMat);
      fan.position.set(-width * 0.22, roofY + 1.12, side * zOff);
      addComicOutline(fan, 1.02, 35);
      group.add(fan);

      // Galvanized sheet-metal ventilation duct run
      const duct = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.44, 0.52), hvacMat);
      duct.position.set(-width * 0.04, roofY + 0.38, side * zOff);
      addComicOutline(duct);
      group.add(duct);
    }

    // Industrial Glass Skylight Hatch
    if (depth >= 14) {
      const skyFrame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 3.2), darkMetalMat);
      skyFrame.position.set(width * 0.20, roofY + 0.28, -zOff * 0.65);
      addComicOutline(skyFrame);
      const skyGlass = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.28, 2.85), skylightMat);
      skyGlass.position.set(width * 0.20, roofY + 0.48, -zOff * 0.65);
      addComicOutline(skyGlass);
      group.add(skyFrame, skyGlass);
    }
  }

  _addStorefrontAwnings(group, width, depth, facesEast, stripeColor1 = '#ff2a85', stripeColor2 = '#fff8ee') {
    const awningTex = this._createAwningTexture(stripeColor1, stripeColor2);
    const awningMat = this._createToonMaterial(0xffffff, { map: awningTex });
    const shopGlassMat = new THREE.MeshBasicMaterial({ color: 0xffefc2 });
    const frameMat = this._createToonMaterial(0x1e192b);

    const frontDir = facesEast ? 1 : -1;
    const wallX = (width * 0.5 + 0.06) * frontDir;
    const awningX = (width * 0.5 + 0.92) * frontDir;
    const spanZ = Math.max(3.2, depth * 0.25);

    for (const zSign of [-1, 1]) {
      const zCenter = zSign * (depth * 0.29);
      // Sloped striped canvas awning hood
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.26, spanZ), awningMat);
      hood.position.set(awningX, 3.35, zCenter);
      hood.rotation.z = -frontDir * 0.26;
      hood.castShadow = true;
      addComicOutline(hood);
      group.add(hood);

      // Warm illuminated ground-floor shop display window
      const displayWin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, spanZ * 0.84), shopGlassMat);
      displayWin.position.set(wallX, 1.65, zCenter);
      addComicOutline(displayWin);
      group.add(displayWin);

      // Dark bulkhead wainscot panel below display window
      const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, spanZ * 0.90), frameMat);
      bulkhead.position.set(wallX, 0.30, zCenter);
      group.add(bulkhead);
    }
  }

  _createArtDecoHotel({
    x,
    z,
    width,
    depth,
    height,
    name,
    signText,
    primaryColor,
    secondaryColor,
    neonColor1 = 0xff2a85,
    neonColor2 = 0x00f0ff,
    facesEast = true,
  }) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const hexNeon1 = '#' + new THREE.Color(neonColor1).getHexString();
    const hexNeon2 = '#' + new THREE.Color(neonColor2).getHexString();
    const hexPrimary = '#' + new THREE.Color(primaryColor).getHexString();
    const hexSecondary = '#' + new THREE.Color(secondaryColor).getHexString();

    const winTex = this._createWindowGridTexture(
      '#221636',
      hexNeon2,
      hexNeon1,
      4,
      Math.max(4, Math.floor(height / 3.2)),
      hexPrimary
    );

    const baseMat = this._createToonMaterial(primaryColor);
    const tierMat = this._createToonMaterial(secondaryColor);
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: winTex,
      emissive: new THREE.Color(neonColor1),
      emissiveMap: winTex,
      emissiveIntensity: 0.55,
      roughness: 0.45,
    });
    this.windowMaterials.push(winMat);

    const neonMat1 = new THREE.MeshBasicMaterial({ color: neonColor1 });
    const neonMat2 = new THREE.MeshBasicMaterial({ color: neonColor2 });
    this.neonMaterials.push(neonMat1, neonMat2);

    // Main Hotel Block
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), [
      winMat, winMat, baseMat, baseMat, winMat, winMat,
    ]);
    mainBody.position.y = height * 0.5;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    addComicOutline(mainBody);
    group.add(mainBody);

    // Rooftop Tar-and-Gravel Deck, Parapet Coping Walls, HVAC Units & Skylights on Main Roof
    this._addRooftopDetails(group, width, depth, height, tierMat);

    // Stepped Upper Art Deco Crown Setback
    const tierW = width * 0.66;
    const tierD = depth * 0.58;
    const tierH = 4.0;
    const crownTier = new THREE.Mesh(new THREE.BoxGeometry(tierW, tierH, tierD), tierMat);
    crownTier.position.y = height + tierH * 0.5;
    crownTier.castShadow = true;
    addComicOutline(crownTier);
    group.add(crownTier);

    // Upper Penthouse Roof Gravel Deck & Parapet
    const upperRoofTex = (this._sharedRoofDeckTex || this._createRooftopTexture()).clone();
    upperRoofTex.needsUpdate = true;
    upperRoofTex.repeat.set(2, 2);
    const upperDeck = new THREE.Mesh(
      new THREE.BoxGeometry(tierW - 0.7, 0.14, tierD - 0.7),
      this._createToonMaterial(0xffffff, { map: upperRoofTex })
    );
    upperDeck.position.y = height + tierH + 0.07;
    group.add(upperDeck);

    // Central Fin Spire with Art Deco Stepped Wings
    const spire = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.8, 2.2), neonMat2);
    spire.position.y = height + tierH + 1.9;
    addComicOutline(spire);
    group.add(spire);

    // Vertical Fluted Corner Pilasters on Street Facade
    const frontDir = facesEast ? 1 : -1;
    const frontX = (width * 0.5 + 0.18) * frontDir;
    for (const pz of [-depth * 0.44, -depth * 0.18, depth * 0.18, depth * 0.44]) {
      const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.55, height + 0.4, 0.75), tierMat);
      pilaster.position.set(frontX, height * 0.5 + 0.2, pz);
      addComicOutline(pilaster);
      group.add(pilaster);
    }

    // Horizontal Art Deco Eyebrow Ledges & Neon Racing Tubes
    for (let h = 4.2; h < height - 1.5; h += 4.5) {
      const eyebrow = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.36, depth + 0.6), tierMat);
      eyebrow.position.set(frontX, h, 0);
      addComicOutline(eyebrow);
      group.add(eyebrow);

      const neonTube = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.18, depth + 0.7),
        h % 9 < 4.5 ? neonMat1 : neonMat2
      );
      neonTube.position.set(frontX + 0.45 * frontDir, h + 0.22, 0);
      group.add(neonTube);
    }

    // Ground-floor Entrance Portico & Striped Storefront Awnings
    const portico = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.0, depth * 0.34), tierMat);
    portico.position.set(frontX, 2.0, 0);
    portico.castShadow = true;
    addComicOutline(portico);
    group.add(portico);

    this._addStorefrontAwnings(group, width, depth, facesEast, hexSecondary, '#fff9f0');

    // Vertical Neon Blade Sign projecting toward Ocean Drive
    const signTex = this._createNeonSignTexture(
      signText,
      '#18072c',
      hexNeon2,
      hexNeon1,
      true
    );
    const bladeMat = new THREE.MeshBasicMaterial({ map: signTex });
    this.neonMaterials.push(bladeMat);
    const bladeMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, Math.min(height * 0.68, 13.5), 0.45), bladeMat);
    bladeMesh.position.set(frontX + 1.2 * frontDir, height * 0.58, 0);
    addComicOutline(bladeMesh);
    group.add(bladeMesh);

    this.scene.add(group);
    this._registerCollider(x, z, width, depth, height + tierH, name, 'OCEAN BEACH');
    return group;
  }

  _buildOceanBeachDistrict() {
    // --- ICONIC ART DECO HOTELS FACING OCEAN DRIVE (x = 80) ---
    const hotels = [
      {
        x: 61, z: 22, width: 15, depth: 24, height: 18,
        name: 'Ocean View Hotel', signText: 'OCEAN',
        primaryColor: 0xfff0b8, secondaryColor: 0x62f2e8,
        neonColor1: 0xff2a85, neonColor2: 0x00f0ff,
      },
      {
        x: 61, z: 68, width: 15, depth: 24, height: 20,
        name: 'The Carlyle Hotel', signText: 'CARLYLE',
        primaryColor: 0x9cf7e8, secondaryColor: 0xff9ec4,
        neonColor1: 0x00f0ff, neonColor2: 0xff2a85,
      },
      {
        x: 61, z: -15, width: 15, depth: 18, height: 16,
        name: 'Beacon Hotel', signText: 'BEACON',
        primaryColor: 0xffb3d1, secondaryColor: 0xb8a8ff,
        neonColor1: 0xff2a85, neonColor2: 0x00f0ff,
      },
      {
        x: 61, z: -68, width: 15, depth: 24, height: 19,
        name: 'Colony Hotel', signText: 'COLONY',
        primaryColor: 0xffcfa8, secondaryColor: 0x70e8ff,
        neonColor1: 0x00f0ff, neonColor2: 0xff66aa,
      },
      {
        x: 60, z: -115, width: 16, depth: 24, height: 15,
        name: 'The Malibu Club', signText: 'MALIBU',
        primaryColor: 0xe6b8ff, secondaryColor: 0xff4da6,
        neonColor1: 0xff00aa, neonColor2: 0x00f0ff,
      },
      {
        x: 61, z: 118, width: 15, depth: 24, height: 18,
        name: 'South Beach Deco Suites', signText: 'TROPIC',
        primaryColor: 0xd4c4fb, secondaryColor: 0xffb8d0,
        neonColor1: 0xff2a85, neonColor2: 0x00f0ff,
      },
      {
        x: 61, z: -152, width: 15, depth: 20, height: 17,
        name: 'North Point Plaza', signText: 'MIRAGE',
        primaryColor: 0xb4f2e0, secondaryColor: 0xffcaa6,
        neonColor1: 0x00f0ff, neonColor2: 0xff2a85,
      },
    ];

    for (const h of hotels) {
      this._createArtDecoHotel(h);
    }

    // --- WASHINGTON AVE DECO COMMERCIAL BLOCKS ---
    const washBlocks = [
      { x: 48, z: -115, width: 8, depth: 20, height: 13, name: 'Washington Synth Records', signText: 'SYNTH', primaryColor: 0xffd1dc, secondaryColor: 0x80f5ff },
      { x: 48, z: -68, width: 8, depth: 22, height: 14, name: 'Vice Fashion Boutique', signText: 'MODA', primaryColor: 0xc2f0e8, secondaryColor: 0xffa6c9 },
      { x: 48, z: 22, width: 8, depth: 20, height: 13, name: 'Ocean Drive Diner', signText: 'DINER', primaryColor: 0xffe6b3, secondaryColor: 0xff66a3 },
      { x: 48, z: 68, width: 8, depth: 22, height: 15, name: 'Vice Custom Garage', signText: 'TURBO', primaryColor: 0xc8d8ff, secondaryColor: 0x00f0ff },
    ];
    for (const wb of washBlocks) {
      this._createArtDecoHotel({ ...wb, facesEast: false });
    }

    // --- ARGON GAS '86 STATION (x: 60, z: -38) - MATCHING GRAND THEFT ARGON SCREENSHOT ---
    this._buildViceGasStation(60, -38);

    // --- OCEAN BEACH PROMENADE UMBRELLAS, LIFEGUARD TOWERS & LOUNGERS ---
    this._buildBeachProps();

    // --- GRAND THEFT ARGON SIDEWALK STREET FURNITURE (US MAIL BOXES, HYDRANTS, CAFE TABLES, NEWSRACKS) ---
    this._buildStreetFurniture();
  }

  _buildStreetFurniture() {
    const furnGroup = new THREE.Group();

    const mailBlueMat = this._createToonMaterial(0x1d56a8);
    const mailStripeMat = this._createToonMaterial(0xf5f7fa);
    const hydrantRedMat = this._createToonMaterial(0xe02828);
    const silverMat = this._createToonMaterial(0xd8dfe8);
    const newsYellowMat = this._createToonMaterial(0xffc818);
    const newsCyanMat = this._createToonMaterial(0x00b8e6);
    const darkMetalMat = this._createToonMaterial(0x1f222d);

    // 1. Iconic Blue US Mail Collection Boxes at Sidewalk Corners (matching Reference Screenshot 1!)
    const mailboxCoords = [
      [71.6, -24], [71.6, 10], [71.6, 36], [71.6, -54], [88.4, -10], [88.4, 34],
      [48.2, -10], [48.2, 36], [-106.8, -10], [-106.8, 36],
    ];
    for (const [mx, mz] of mailboxCoords) {
      const mb = new THREE.Group();
      mb.position.set(mx, 0.12, mz);

      const boxBody = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.95, 0.62), mailBlueMat);
      boxBody.position.y = 0.48;
      boxBody.castShadow = true;
      addComicOutline(boxBody);
      mb.add(boxBody);

      // Rounded barrel postal top
      const archTop = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.66, 8), mailBlueMat);
      archTop.rotation.z = Math.PI / 2;
      archTop.position.y = 0.96;
      addComicOutline(archTop);
      mb.add(archTop);

      // White US Mail stripe band
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.64), mailStripeMat);
      stripe.position.y = 0.72;
      mb.add(stripe);

      furnGroup.add(mb);
    }

    // 2. Cast-Iron Red Fire Hydrants along Curbs
    const hydrantCoords = [
      [72.2, -18], [72.2, 16], [72.2, 58], [72.2, -76],
      [87.8, -32], [87.8, 18], [87.8, 64],
      [32.2, -22], [32.2, 26], [-107.2, -25], [-107.2, 22],
    ];
    for (const [hx, hz] of hydrantCoords) {
      const hg = new THREE.Group();
      hg.position.set(hx, 0.12, hz);

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.72, 8), hydrantRedMat);
      body.position.y = 0.36;
      body.castShadow = true;
      addComicOutline(body);
      hg.add(body);

      const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.16, 0.16), silverMat);
      nozzle.position.y = 0.48;
      addComicOutline(nozzle);
      hg.add(nozzle);

      const bonnet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), silverMat);
      bonnet.position.y = 0.72;
      hg.add(bonnet);

      furnGroup.add(hg);
    }

    // 3. Paired Newspaper Vending Boxes ("VICE HERALD" & "MIAMI DAILY")
    const newsCoords = [
      [70.2, 14], [70.2, 30], [70.2, -12], [70.2, -62], [70.2, 62],
    ];
    for (const [nx, nz] of newsCoords) {
      for (let k = 0; k < 2; k++) {
        const rack = new THREE.Mesh(
          new THREE.BoxGeometry(0.52, 0.92, 0.48),
          k === 0 ? newsYellowMat : newsCyanMat
        );
        rack.position.set(nx, 0.58, nz + k * 0.65);
        rack.castShadow = true;
        addComicOutline(rack);
        furnGroup.add(rack);
      }
    }

    // 4. Sidewalk Bistro Café Tables & Pastel Parasols along Ocean Drive Hotel Terraces (x = 69.6)
    const cafeZ = [16, 28, 62, 74, -19, -62, -74, 112, 124];
    const cafeColors = [0xff2a85, 0x00e5ff, 0xffaa33, 0x33eba8];
    cafeZ.forEach((cz, idx) => {
      const cg = new THREE.Group();
      cg.position.set(69.6, 0.12, cz);

      const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.10, 10), mailStripeMat);
      tableTop.position.y = 0.76;
      addComicOutline(tableTop);
      cg.add(tableTop);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.76, 6), darkMetalMat);
      leg.position.y = 0.38;
      cg.add(leg);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.15, 6), mailStripeMat);
      pole.position.y = 1.08;
      cg.add(pole);

      const parasol = new THREE.Mesh(
        new THREE.ConeGeometry(1.35, 0.62, 8),
        this._createToonMaterial(cafeColors[idx % cafeColors.length])
      );
      parasol.position.y = 2.18;
      parasol.castShadow = true;
      addComicOutline(parasol);
      cg.add(parasol);

      furnGroup.add(cg);
    });

    this.scene.add(furnGroup);
  }

  _buildViceGasStation(x, z) {
    const gasGroup = new THREE.Group();
    gasGroup.position.set(x, 0, z);

    // Concrete forecourt pad right up to Ocean Drive West sidewalk
    const padMat = this._createToonMaterial(0xd4cec6);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(20, 0.14, 18), padMat);
    pad.position.set(3.5, 0.07, 0);
    pad.receiveShadow = true;
    addComicOutline(pad);
    gasGroup.add(pad);

    // Convenience Store Kiosk on West side (x - 3.2) with Rooftop HVAC & Parapet
    const kioskMat = this._createToonMaterial(0xf5eee6);
    const kioskTrimMat = this._createToonMaterial(0xff5518);
    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(6.2, 4.4, 12.5), kioskMat);
    kiosk.position.set(-3.2, 2.2, 0);
    kiosk.castShadow = true;
    kiosk.receiveShadow = true;
    addComicOutline(kiosk);
    gasGroup.add(kiosk);

    const kioskGroup = new THREE.Group();
    kioskGroup.position.set(-3.2, 0, 0);
    this._addRooftopDetails(kioskGroup, 6.2, 12.5, 4.4, kioskTrimMat);
    gasGroup.add(kioskGroup);

    this._registerCollider(x - 3.2, z, 6.2, 12.5, 4.4, 'Argon Gas Kiosk', 'OCEAN BEACH');

    // Iconic Glowing Neon-Orange & Red-Striped Overhang Canopy (matching Grand Theft Argon top-left!)
    const canopyOrangeMat = new THREE.MeshBasicMaterial({ color: 0xff7718 });
    const canopyRoofTopMat = new THREE.MeshBasicMaterial({ color: 0xff9438 });
    const canopyTrimMat = new THREE.MeshBasicMaterial({ color: 0xffee55 });
    const pillarMat = this._createToonMaterial(0xfaf6f0);
    this.neonMaterials.push(canopyOrangeMat, canopyRoofTopMat, canopyTrimMat);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.45, 14.8), canopyOrangeMat);
    canopy.position.set(5.8, 5.6, 0);
    canopy.castShadow = true;
    addComicOutline(canopy);
    gasGroup.add(canopy);

    // Warm glowing recessed roof deck and under-canopy light pool on the forecourt
    const canopyDeck = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.25, 13.5), canopyRoofTopMat);
    canopyDeck.position.set(5.8, 6.35, 0);
    addComicOutline(canopyDeck);
    gasGroup.add(canopyDeck);

    const forecourtGlowTex = this._createRadialGlowTexture('rgba(255, 165, 60, 0.75)', 'rgba(255, 80, 20, 0)');
    const forecourtGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 18),
      new THREE.MeshBasicMaterial({
        map: forecourtGlowTex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    forecourtGlow.rotation.x = -Math.PI / 2;
    forecourtGlow.position.set(5.8, 0.16, 0);
    gasGroup.add(forecourtGlow);

    // Glowing Yellow/White horizontal racing band around canopy
    const canopyBand = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.38, 15.1), canopyTrimMat);
    canopyBand.position.set(5.8, 5.6, 0);
    gasGroup.add(canopyBand);

    // "ARGON GAS '86" Rooftop Fascia Sign facing Ocean Drive
    const gasSignTex = this._createNeonSignTexture("ARGON GAS '86", '#b82800', '#ffee44', '#ffffff', false);
    const gasSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 1.55, 10.5),
      new THREE.MeshBasicMaterial({ map: gasSignTex })
    );
    gasSign.position.set(11.5, 6.65, 0);
    addComicOutline(gasSign);
    gasGroup.add(gasSign);

    // Twin Support Columns & Fuel Pump Islands
    const pumpRedMat = this._createToonMaterial(0xff2e38);
    const bollardMat = this._createToonMaterial(0xffcc00);

    for (const iz of [-3.6, 3.6]) {
      // Concrete island curb
      const island = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.28, 1.9), pillarMat);
      island.position.set(5.8, 0.2, iz);
      addComicOutline(island);
      gasGroup.add(island);

      // Canopy support column
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 5.4, 10), pillarMat);
      col.position.set(5.8, 2.8, iz);
      col.castShadow = true;
      addComicOutline(col);
      gasGroup.add(col);

      // Twin Retro Red/White Fuel Pumps
      for (const px of [4.0, 7.6]) {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.85, 0.65), pumpRedMat);
        pump.position.set(px, 1.15, iz);
        pump.castShadow = true;
        addComicOutline(pump);
        gasGroup.add(pump);
      }

      // Protective Yellow Bollards
      for (const bx of [2.5, 9.0]) {
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.95, 8), bollardMat);
        bollard.position.set(bx, 0.55, iz);
        addComicOutline(bollard);
        gasGroup.add(bollard);
      }

      // Register solid AABB colliders for the fuel pump islands so neither players nor pedestrians walk through fuel pumps
      this._registerCollider(x + 5.8, z + iz, 6.6, 2.0, 5.4, 'Argon Gas Fuel Pump Island', 'OCEAN BEACH');
      this._registerCollider(61.8, z + iz, 6.6, 2.0, 5.4, 'Argon Gas Fuel Pump Island West', 'OCEAN BEACH');
    }

    this.scene.add(gasGroup);
  }

  _buildBeachProps() {
    const beachGroup = new THREE.Group();
    const umbrellaColors = [0xff2a85, 0x00e5ff, 0xffaa33, 0xa66bff, 0x33eba8];
    const poleMat = this._createToonMaterial(0xf5f0ea);
    const woodMat = this._createToonMaterial(0xdeb887);

    // 28 Pastel Beach Umbrellas & Lounge Chairs along x in [102, 124]
    for (let i = 0; i < 28; i++) {
      const uz = -140 + i * 10.2 + (i % 2) * 3.0;
      const ux = 103 + (i % 3) * 7.0;
      const uColor = umbrellaColors[i % umbrellaColors.length];

      const umb = new THREE.Group();
      umb.position.set(ux, 0, uz);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6), poleMat);
      pole.position.y = 1.25;
      umb.add(pole);

      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(1.85, 0.85, 8),
        this._createToonMaterial(uColor)
      );
      canopy.position.y = 2.45;
      canopy.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.12;
      canopy.castShadow = true;
      addComicOutline(canopy);
      umb.add(canopy);

      // Beach Lounger & Towel
      const lounger = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.25, 0.85),
        this._createToonMaterial(0xffffff)
      );
      lounger.position.set(0.9, 0.16, 1.1);
      addComicOutline(lounger);
      umb.add(lounger);

      beachGroup.add(umb);
    }

    // 3 Iconic Miami Pastel Lifeguard Towers along Ocean Beach
    const towerZPositions = [-65, 8, 78];
    const towerColors = [0xff66a3, 0x4be8e0, 0xffb84d];
    towerZPositions.forEach((tz, idx) => {
      const tg = new THREE.Group();
      tg.position.set(116, 0, tz);

      // Stilts
      const legGeo = new THREE.BoxGeometry(0.28, 2.4, 0.28);
      for (const lx of [-1.2, 1.2]) {
        for (const lz of [-1.2, 1.2]) {
          const leg = new THREE.Mesh(legGeo, woodMat);
          leg.position.set(lx, 1.2, lz);
          tg.add(leg);
        }
      }

      // Cabin
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 2.6, 3.2),
        this._createToonMaterial(towerColors[idx])
      );
      cabin.position.y = 3.5;
      cabin.castShadow = true;
      addComicOutline(cabin);
      tg.add(cabin);

      // Pitched Roof
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(2.7, 1.2, 4),
        this._createToonMaterial(0xffffff)
      );
      roof.position.y = 5.4;
      roof.rotation.y = Math.PI / 4;
      addComicOutline(roof);
      tg.add(roof);

      beachGroup.add(tg);
      this._registerCollider(116, tz, 3.4, 3.4, 5.5, `Lifeguard Tower ${idx + 1}`, 'OCEAN BEACH');
    });

    this.scene.add(beachGroup);
  }

  // ============================================================================
  // 8. DISTRICT 2: STARFISH ISLAND (VERCETTI ESTATE MANSION, POOL & VILLAS)
  // ============================================================================

  _buildStarfishIslandDistrict() {
    const sfGroup = new THREE.Group();

    const mansionWinTex = this._createWindowGridTexture('#2a1528', '#ffdf99', '#00f0ff', 5, 3, '#ffb09c');
    const coralWallMat = this._createToonMaterial(0xffffff, { map: mansionWinTex });
    const creamTrimMat = this._createToonMaterial(0xfff6eb);
    const terracottaMat = this._createToonMaterial(0xd95b43);
    const poolWaterMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
    const hedgeMat = this._createToonMaterial(0x288c52);

    // --- VERCETTI ESTATE / STARFISH MANSION (x: -30, z: -26) ---
    const mansion = new THREE.Group();
    mansion.position.set(-30, 0, -26);

    // Central Palatial Block
    const centerBlock = new THREE.Mesh(new THREE.BoxGeometry(22, 10.5, 12), coralWallMat);
    centerBlock.position.y = 5.25;
    centerBlock.castShadow = true;
    centerBlock.receiveShadow = true;
    addComicOutline(centerBlock);
    mansion.add(centerBlock);

    // East & West Flanking Wings
    for (const wx of [-14, 14]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(8, 8.2, 14), coralWallMat);
      wing.position.set(wx, 4.1, 1.5);
      wing.castShadow = true;
      addComicOutline(wing);
      mansion.add(wing);

      const wingRoof = new THREE.Mesh(new THREE.BoxGeometry(8.8, 1.2, 14.8), terracottaMat);
      wingRoof.position.set(wx, 8.8, 1.5);
      addComicOutline(wingRoof);
      mansion.add(wingRoof);
    }

    // Main Terracotta Roof Crown & Rooftop Helipad/Skylight Details
    const mainRoof = new THREE.Mesh(new THREE.BoxGeometry(23.2, 1.5, 13.2), terracottaMat);
    mainRoof.position.y = 11.2;
    addComicOutline(mainRoof);
    mansion.add(mainRoof);
    this._addRooftopDetails(mansion, 21.6, 11.6, 11.95, creamTrimMat);

    // Grand Twin-Column Front Portico & Sweeping Staircase (South side facing z = -12)
    const porticoRoof = new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.1, 5.2), creamTrimMat);
    porticoRoof.position.set(0, 9.2, 7.8);
    addComicOutline(porticoRoof);
    mansion.add(porticoRoof);

    for (const cx of [-3.4, -1.2, 1.2, 3.4]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 8.6, 10), creamTrimMat);
      col.position.set(cx, 4.3, 9.8);
      col.castShadow = true;
      addComicOutline(col);
      mansion.add(col);
    }

    // Sweeping Grand Steps
    for (let s = 0; s < 4; s++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(8.5 + s * 1.1, 0.45, 4.2 + s * 1.1),
        creamTrimMat
      );
      step.position.set(0, (3 - s) * 0.42 + 0.22, 8.8 + s * 0.8);
      addComicOutline(step);
      mansion.add(step);
    }

    // Circular Driveway Fountain at (x: -30, z: -7.5) -> local (0, 0, 18.5)
    const fountainBasin = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.75, 14), creamTrimMat);
    fountainBasin.position.set(0, 0.38, 18.5);
    addComicOutline(fountainBasin);
    mansion.add(fountainBasin);

    const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.82, 14), poolWaterMat);
    fountainWater.position.set(0, 0.40, 18.5);
    mansion.add(fountainWater);

    // Backyard Turquoise Swimming Pool at (x: -30, z: -44) -> local (0, 0, -18)
    const poolDeck = new THREE.Mesh(new THREE.BoxGeometry(20, 0.18, 12), creamTrimMat);
    poolDeck.position.set(0, 0.09, -18);
    poolDeck.receiveShadow = true;
    addComicOutline(poolDeck);
    mansion.add(poolDeck);

    const poolSurface = new THREE.Mesh(new THREE.BoxGeometry(15, 0.24, 7.5), poolWaterMat);
    poolSurface.position.set(0, 0.14, -18);
    mansion.add(poolSurface);

    sfGroup.add(mansion);
    this._registerCollider(-30, -26, 34, 14, 12, 'Vercetti Estate Mansion', 'STARFISH ISLAND');
    this._registerCollider(-44, -24.5, 8.8, 14.8, 9.5, 'Vercetti Estate West Wing', 'STARFISH ISLAND');
    this._registerCollider(-16, -24.5, 8.8, 14.8, 9.5, 'Vercetti Estate East Wing', 'STARFISH ISLAND');
    this._registerCollider(-30, -7.5, 6.4, 6.4, 1.5, 'Vercetti Estate Circular Fountain', 'STARFISH ISLAND');

    // --- ADDITIONAL STARFISH ISLAND LUXURY VILLAS ---
    const villas = [
      { x: -54, z: 28, w: 14, d: 14, h: 8.5, color: 0xbaf5e8, hex: '#baf5e8', name: 'Villa Palmera West' },
      { x: -6, z: 28, w: 14, d: 14, h: 8.5, color: 0xffd6ba, hex: '#ffd6ba', name: 'Casa Del Sol East' },
      { x: -55, z: -32, w: 12, d: 12, h: 8.0, color: 0xe4c6ff, hex: '#e4c6ff', name: 'Starfish North Cove Villa' },
      { x: -5, z: -32, w: 12, d: 12, h: 8.0, color: 0xffc2d8, hex: '#ffc2d8', name: 'Biscayne Point Estate' },
    ];

    for (const v of villas) {
      const vg = new THREE.Group();
      vg.position.set(v.x, 0, v.z);

      const vWinTex = this._createWindowGridTexture('#231630', '#00f0ff', '#ff2a85', 3, 2, v.hex);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(v.w, v.h, v.d),
        this._createToonMaterial(0xffffff, { map: vWinTex })
      );
      body.position.y = v.h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      addComicOutline(body);
      vg.add(body);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(v.w + 1.0, 1.1, v.d + 1.0), terracottaMat);
      roof.position.y = v.h + 0.55;
      addComicOutline(roof);
      vg.add(roof);
      this._addRooftopDetails(vg, v.w, v.d, v.h + 1.1, creamTrimMat);

      // Privacy Hedge
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(v.w + 4, 1.6, 1.0), hedgeMat);
      hedge.position.set(0, 0.8, v.z > 0 ? -v.d * 0.5 - 2.2 : v.d * 0.5 + 2.2);
      addComicOutline(hedge);
      vg.add(hedge);

      sfGroup.add(vg);
      this._registerCollider(v.x, v.z, v.w, v.d, v.h + 1.1, v.name, 'STARFISH ISLAND');
    }

    this.scene.add(sfGroup);
  }

  // ============================================================================
  // 9. DISTRICT 3: LITTLE HAITI (STOREFRONTS, KAUFMAN CABS, GRAFFITI & DUMPSTERS)
  // ============================================================================

  _buildLittleHaitiDistrict() {
    const haitiGroup = new THREE.Group();

    const roofMetalMat = this._createToonMaterial(0x6e5a56);
    const kaufmanWinTex = this._createWindowGridTexture('#1e1928', '#ffdd22', '#ff6600', 4, 2, '#f7c824');
    const yellowCabMat = this._createToonMaterial(0xffffff, { map: kaufmanWinTex });
    const darkTrimMat = this._createToonMaterial(0x1e1928);

    // --- KAUFMAN CABS DISPATCH DEPOT (x: -135, z: -55) ---
    const kaufman = new THREE.Group();
    kaufman.position.set(-135, 0, -55);

    const depotBody = new THREE.Mesh(new THREE.BoxGeometry(16, 7.5, 20), yellowCabMat);
    depotBody.position.y = 3.75;
    depotBody.castShadow = true;
    depotBody.receiveShadow = true;
    addComicOutline(depotBody);
    kaufman.add(depotBody);

    this._addRooftopDetails(kaufman, 16, 20, 7.5, darkTrimMat);
    this._addStorefrontAwnings(kaufman, 16, 20, true, '#1e1928', '#ffcc00');

    // Black Racing Stripe around Kaufman Cabs
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(16.3, 1.1, 20.3), darkTrimMat);
    stripe.position.y = 5.4;
    kaufman.add(stripe);

    // Rooftop "KAUFMAN CABS" Neon Sign & Radio Dispatch Antenna
    const cabSignTex = this._createNeonSignTexture('KAUFMAN CABS', '#1e1608', '#ffcc00', '#ffdd22', false);
    const cabSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 2.6, 13.5),
      new THREE.MeshBasicMaterial({ map: cabSignTex })
    );
    cabSign.position.set(7.5, 9.0, 0);
    addComicOutline(cabSign);
    kaufman.add(cabSign);

    // Tall Radio Dispatch Lattice Mast
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.65, 11, 6),
      this._createToonMaterial(0xd8d8e2)
    );
    antenna.position.set(-2, 13.0, -4);
    addComicOutline(antenna);
    kaufman.add(antenna);

    haitiGroup.add(kaufman);
    this._registerCollider(-135, -55, 16, 20, 9.0, 'Kaufman Cabs Depot', 'LITTLE HAITI');

    // --- WEATHERED STOREFRONTS WITH 1980s GRAFFITI MURALS, AWNINGS & ROOFTOP DETAILS ---
    const storefronts = [
      {
        x: -135, z: -18, w: 14, d: 18, h: 8.5,
        color: 0xd99b82, hex: '#d99b82', tag: 'VICE 86', c1: '#ff2a85', c2: '#00f0ff',
        name: 'Little Haiti Bodega & Bakery',
      },
      {
        x: -135, z: 18, w: 15, d: 20, h: 9.5,
        color: 0x7ac7b8, hex: '#7ac7b8', tag: 'HAITI KINGS', c1: '#ffee33', c2: '#ff2a85',
        name: 'Print Works & Laundromat',
      },
      {
        x: -135, z: -112, w: 15, d: 22, h: 8.0,
        color: 0xc9b88a, hex: '#c9b88a', tag: 'MAMBO', c1: '#00f0ff', c2: '#9933ff',
        name: 'Papairie Auto Parts',
      },
      {
        x: -135, z: 54, w: 15, d: 16, h: 7.5,
        color: 0xe0a6b8, hex: '#e0a6b8', tag: 'CHOP SHOP', c1: '#ff5500', c2: '#00f0ff',
        name: 'Westside Motel',
      },
    ];

    for (const sf of storefronts) {
      const sg = new THREE.Group();
      sg.position.set(sf.x, 0, sf.z);

      const sfWinTex = this._createWindowGridTexture('#21162c', sf.c1, sf.c2, 4, 2, sf.hex);
      const wallMat = this._createToonMaterial(0xffffff, { map: sfWinTex });
      const body = new THREE.Mesh(new THREE.BoxGeometry(sf.w, sf.h, sf.d), wallMat);
      body.position.y = sf.h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      addComicOutline(body);
      sg.add(body);

      // Corrugated Metal Roof Overhang & Rooftop HVAC/Gravel Details
      const roof = new THREE.Mesh(new THREE.BoxGeometry(sf.w + 1.2, 0.65, sf.d + 1.2), roofMetalMat);
      roof.position.y = sf.h + 0.32;
      addComicOutline(roof);
      sg.add(roof);
      this._addRooftopDetails(sg, sf.w, sf.d, sf.h + 0.65, roofMetalMat);
      this._addStorefrontAwnings(sg, sf.w, sf.d, true, sf.c1, '#fff6eb');

      // Graffiti Mural Panel on East/Alley Facade
      const grafTex = this._createGraffitiTexture(sf.tag, '#b88d74', sf.c1, sf.c2);
      const grafPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(sf.d * 0.65, 3.6),
        new THREE.MeshBasicMaterial({ map: grafTex })
      );
      grafPanel.rotation.y = Math.PI / 2;
      grafPanel.position.set(sf.w * 0.5 + 0.08, 3.2, 0);
      sg.add(grafPanel);

      haitiGroup.add(sg);
      this._registerCollider(sf.x, sf.z, sf.w, sf.d, sf.h + 0.65, sf.name, 'LITTLE HAITI');
    }

    // --- INTERACTIVE ALLEY DUMPSTERS ---
    const dumpsterMat = this._createToonMaterial(0x286e46);
    const lidMat = this._createToonMaterial(0x1f222e);
    const dumpsterCoords = [
      [-126, -29],
      [-126, 4],
      [-126, -70],
      [51, 45], // Ocean Beach alley dumpster
    ];
    for (const [dx, dz] of dumpsterCoords) {
      const dg = new THREE.Group();
      dg.position.set(dx, 0, dz);
      const bin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.55, 1.65), dumpsterMat);
      bin.position.y = 0.78;
      bin.castShadow = true;
      addComicOutline(bin);
      dg.add(bin);

      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.25, 1.75), lidMat);
      lid.position.y = 1.62;
      addComicOutline(lid);
      dg.add(lid);

      haitiGroup.add(dg);
    }

    this.scene.add(haitiGroup);
  }

  // ============================================================================
  // 10. DISTRICT 4: ARGON PORT MARINA (YACHT PIERS, CONTAINERS & CRANES)
  // ============================================================================

  _buildVicePortDistrict() {
    const portGroup = new THREE.Group();

    const timberDeckMat = this._createToonMaterial(0xa87c56);
    const concretePierMat = this._createToonMaterial(0xc4beb8);
    const pilingMat = this._createToonMaterial(0x4a382b);
    const craneYellowMat = this._createToonMaterial(0xffb81c);

    // --- CONCRETE & TIMBER YACHT PIERS EXTENDING INTO SOUTHERN BAY ---
    // Pier 1: East Yacht Pier at (x: 15, z: 103..132, boarding at z: 112)
    // Pier 2: West Yacht Pier at (x: -55, z: 103..132, boarding at z: 115)
    const buildYachtPier = (xCenter, zStart, zEnd, label) => {
      const len = zEnd - zStart;
      const cz = (zStart + zEnd) * 0.5;
      const width = 14.0;

      const pier = new THREE.Group();
      pier.position.set(xCenter, 0, cz);

      // Concrete Sub-base
      const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, len), concretePierMat);
      base.position.y = -0.05;
      base.receiveShadow = true;
      addComicOutline(base);
      pier.add(base);

      // Timber Plank Decking
      const deck = new THREE.Mesh(new THREE.BoxGeometry(width - 1.2, 0.16, len - 1.0), timberDeckMat);
      deck.position.y = 0.26;
      deck.receiveShadow = true;
      addComicOutline(deck);
      pier.add(deck);

      // Timber Mooring Bollards & Pilings along edges
      for (let zOff = -len * 0.42; zOff <= len * 0.42; zOff += 6.5) {
        for (const xSide of [-width * 0.46, width * 0.46]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.9, 8), pilingMat);
          post.position.set(xSide, 0.35, zOff);
          post.castShadow = true;
          addComicOutline(post);
          pier.add(post);
        }
      }

      // Dockside Neon Arch Sign at Pier Entrance
      const signTex = this._createNeonSignTexture(label, '#0d1b2a', '#00f0ff', '#ff2a85', false);
      const arch = new THREE.Mesh(
        new THREE.BoxGeometry(9.2, 1.8, 0.45),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      arch.position.set(0, 4.4, -len * 0.44);
      addComicOutline(arch);
      pier.add(arch);

      for (const px of [-4.2, 4.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.4, 8), concretePierMat);
        post.position.set(px, 2.2, -len * 0.44);
        addComicOutline(post);
        pier.add(post);
      }

      portGroup.add(pier);
    };

    buildYachtPier(15, 102, 134, 'MARINA PIER 1');
    buildYachtPier(-55, 102, 134, 'YACHT CLUB 2');

    // --- STACKED COLORFUL SHIPPING CONTAINERS ---
    const containerColors = [0xff2a85, 0x00d8f0, 0xffbe19, 0xff6224, 0x6c42ff];
    const containerStacks = [
      // West Argon Port Container Yard
      { x: -135, z: 112, tiers: 2, rot: 0 },
      { x: -126, z: 112, tiers: 3, rot: 0 },
      { x: -135, z: 126, tiers: 2, rot: 0 },
      { x: -126, z: 126, tiers: 1, rot: 0 },
      { x: -140, z: 80, tiers: 2, rot: Math.PI / 2 },
      // East Argon Port Cargo Yard
      { x: 58, z: 80, tiers: 2, rot: 0 },
      { x: 58, z: 148, tiers: 2, rot: 0 },
    ];

    containerStacks.forEach((st, idx) => {
      const cW = 3.4;
      const cH = 3.2;
      const cD = 9.5;
      for (let t = 0; t < st.tiers; t++) {
        const col = containerColors[(idx + t) % containerColors.length];
        const box = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, cD), this._createToonMaterial(col));
        box.position.set(st.x, t * cH + cH * 0.5, st.z);
        box.rotation.y = st.rot;
        box.castShadow = true;
        box.receiveShadow = true;
        addComicOutline(box);
        portGroup.add(box);
      }
      const w = st.rot === 0 ? cW : cD;
      const d = st.rot === 0 ? cD : cW;
      this._registerCollider(st.x, st.z, w, d, st.tiers * cH, `Shipping Container ${idx + 1}`, 'ARGON PORT MARINA');
    });

    // --- TALL PORT GANTRY CRANE (x: -131, z: 119) ---
    const crane = new THREE.Group();
    crane.position.set(-131, 0, 119);
    for (const lx of [-5.5, 5.5]) {
      for (const lz of [-4.5, 4.5]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 18, 0.9), craneYellowMat);
        leg.position.set(lx, 9, lz);
        leg.castShadow = true;
        addComicOutline(leg);
        crane.add(leg);
      }
    }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(24, 1.5, 10), craneYellowMat);
    boom.position.set(4, 18.2, 0);
    boom.castShadow = true;
    addComicOutline(boom);
    crane.add(boom);
    portGroup.add(crane);

    this.scene.add(portGroup);
  }

  // ============================================================================
  // 10B. EXPANDED CITY LANDMARKS, SKYLINE, HELIPADS & ESCOBAR INTERNATIONAL AIRPORT
  // ============================================================================

  _createHelipadMarkings(x, y, z, radius = 4.6, ringHex = 0x00f0ff, hHex = 0xffee33, labelText = '') {
    const padGroup = new THREE.Group();
    padGroup.position.set(x, y, z);

    const padBaseMat = this._createToonMaterial(0x2d3240);
    const ringMat = new THREE.MeshBasicMaterial({ color: ringHex });
    const hMat = new THREE.MeshBasicMaterial({ color: hHex });
    this.neonMaterials.push(ringMat, hMat);

    // Octagonal dark tarmac helipad disc
    const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.25, 0.10, 16), padBaseMat);
    baseDisc.position.y = 0.05;
    baseDisc.receiveShadow = true;
    addComicOutline(baseDisc, 1.02, 30);
    padGroup.add(baseDisc);

    // Outer glowing perimeter ring
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(radius * 0.78, radius * 0.90, 24), ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.11;
    padGroup.add(ringMesh);

    // Bold 'H' marking in center
    const barW = radius * 0.16;
    const barLen = radius * 0.95;
    const leftLeg = new THREE.Mesh(new THREE.PlaneGeometry(barW, barLen), hMat);
    leftLeg.rotation.x = -Math.PI / 2;
    leftLeg.position.set(-radius * 0.28, 0.115, 0);

    const rightLeg = new THREE.Mesh(new THREE.PlaneGeometry(barW, barLen), hMat);
    rightLeg.rotation.x = -Math.PI / 2;
    rightLeg.position.set(radius * 0.28, 0.115, 0);

    const crossBar = new THREE.Mesh(new THREE.PlaneGeometry(radius * 0.56, barW), hMat);
    crossBar.rotation.x = -Math.PI / 2;
    crossBar.position.set(0, 0.115, 0);
    padGroup.add(leftLeg, rightLeg, crossBar);

    // 4 Corner Perimeter Aviation Beacon Lights
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const bx = Math.cos(a) * (radius - 0.25);
      const bz = Math.sin(a) * (radius - 0.25);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 6),
        i % 2 === 0 ? ringMat : hMat
      );
      bulb.position.set(bx, 0.18, bz);
      padGroup.add(bulb);
    }

    if (labelText) {
      const signTex = this._createNeonSignTexture(labelText, '#120824', '#00f0ff', '#ffee33', false);
      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 1.1, 4.2),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      signBoard.position.set(-radius - 0.6, 1.4, 0);
      addComicOutline(signBoard);
      padGroup.add(signBoard);
    }

    this.scene.add(padGroup);
    return padGroup;
  }

  _buildExpandedCityLandmarks() {
    const landmarkGroup = new THREE.Group();

    // --- 1. SUNSHINE AUTOS SHOWROOM (x: 48, z: 118) ---
    {
      const saGroup = new THREE.Group();
      saGroup.position.set(48, 0, 118);

      const wallMat = this._createToonMaterial(0xfff5e4);
      const tealTrimMat = this._createToonMaterial(0x00d8e6);
      const coralTrimMat = this._createToonMaterial(0xff4d88);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x66f2ff,
        emissive: new THREE.Color(0x00c8ff),
        emissiveIntensity: 0.45,
        roughness: 0.2,
      });
      this.windowMaterials.push(glassMat);

      // 2-story showroom block (width: 7.6, depth: 20, height: 10.5)
      const body = new THREE.Mesh(new THREE.BoxGeometry(7.6, 10.5, 20), wallMat);
      body.position.y = 5.25;
      body.castShadow = true;
      body.receiveShadow = true;
      addComicOutline(body);
      saGroup.add(body);

      // Ground-floor panoramic glass showroom facade facing Washington Ave (West, -X)
      const showroomGlass = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 16.5), glassMat);
      showroomGlass.position.set(-3.75, 2.3, 0);
      addComicOutline(showroomGlass);
      saGroup.add(showroomGlass);

      // Service Check-In Garage Bays on South Wing
      const bayDoorMat = this._createToonMaterial(0x283044);
      for (const bz of [-6.0, 0.0, 6.0]) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 4.4), coralTrimMat);
        frame.position.set(-3.82, 4.45, bz);
        addComicOutline(frame);
        saGroup.add(frame);

        const rollup = new THREE.Mesh(new THREE.BoxGeometry(0.38, 3.2, 3.6), bayDoorMat);
        rollup.position.set(3.75, 1.6, bz);
        addComicOutline(rollup);
        saGroup.add(rollup);
      }

      this._addRooftopDetails(saGroup, 7.6, 20, 10.5, tealTrimMat);

      // "SUNSHINE AUTOS" Neon Fascia Sign
      const saSignTex = this._createNeonSignTexture('SUNSHINE AUTOS', '#1a0a2e', '#00f0ff', '#ffdd22', false);
      const saSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 2.2, 14.5),
        new THREE.MeshBasicMaterial({ map: saSignTex })
      );
      saSign.position.set(-3.95, 9.2, 0);
      addComicOutline(saSign);
      saGroup.add(saSign);

      // Rooftop Rotating Display Car Pedestal
      const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 1.1, 14), tealTrimMat);
      pedBase.position.set(0, 11.05, 0);
      addComicOutline(pedBase);
      saGroup.add(pedBase);

      const displayCarPivot = new THREE.Group();
      displayCarPivot.position.set(0, 11.65, 0);
      const carBodyMat = this._createToonMaterial(0xff2a85);
      const carGlassMat = new THREE.MeshBasicMaterial({ color: 0x99f8ff });
      const carChassis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 3.6), carBodyMat);
      carChassis.position.y = 0.42;
      addComicOutline(carChassis);
      const carCabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.45, 1.8), carGlassMat);
      carCabin.position.set(0, 0.85, -0.2);
      addComicOutline(carCabin);
      displayCarPivot.add(carChassis, carCabin);
      displayCarPivot.rotation.x = 0.08;
      saGroup.add(displayCarPivot);

      this.animatedLandmarkProps.push({
        type: 'spin_y',
        mesh: displayCarPivot,
        speed: 1.15,
      });

      landmarkGroup.add(saGroup);
      this._registerCollider(48, 118, 7.6, 20, 12.5, 'Sunshine Autos Showroom', 'OCEAN BEACH');
    }

    // --- 2. VICE POINT MALL (x: 48, z: -150) ---
    {
      const mallGroup = new THREE.Group();
      mallGroup.position.set(48, 0, -150);

      const pinkStuccoMat = this._createToonMaterial(0xffb8d8);
      const cyanTrimMat = this._createToonMaterial(0x4be8e0);
      const atriumGlassMat = new THREE.MeshStandardMaterial({
        color: 0x80f8ff,
        emissive: new THREE.Color(0x00e5ff),
        emissiveIntensity: 0.52,
        roughness: 0.25,
      });
      this.windowMaterials.push(atriumGlassMat);

      const mallWinTex = this._createWindowGridTexture('#241434', '#00f0ff', '#ff2a85', 4, 3, '#ffb8d8');
      const mallWallMat = this._createToonMaterial(0xffffff, { map: mallWinTex });

      const mainBlock = new THREE.Mesh(new THREE.BoxGeometry(7.8, 12.5, 18), [
        mallWallMat, mallWallMat, pinkStuccoMat, pinkStuccoMat, mallWallMat, mallWallMat,
      ]);
      mainBlock.position.y = 6.25;
      mainBlock.castShadow = true;
      mainBlock.receiveShadow = true;
      addComicOutline(mainBlock);
      mallGroup.add(mainBlock);

      // Vaulted Cyan Glass Barrel-Atrium Roof
      const vault = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 16.4, 10, 1, false, 0, Math.PI), atriumGlassMat);
      vault.rotation.x = Math.PI / 2;
      vault.position.set(0, 12.5, 0);
      addComicOutline(vault);
      mallGroup.add(vault);

      // Neon Entrance Archway & Fascia Sign
      const mallSignTex = this._createNeonSignTexture('VICE POINT MALL', '#1d0930', '#00f0ff', '#ff2a85', false);
      const mallSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 2.3, 14.2),
        new THREE.MeshBasicMaterial({ map: mallSignTex })
      );
      mallSign.position.set(-4.0, 10.6, 0);
      addComicOutline(mallSign);
      mallGroup.add(mallSign);

      const portico = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.5, 7.2), cyanTrimMat);
      portico.position.set(-4.1, 2.25, 0);
      addComicOutline(portico);
      mallGroup.add(portico);

      landmarkGroup.add(mallGroup);
      this._registerCollider(48, -150, 7.8, 18, 15.5, 'Vice Point Mall', 'OCEAN BEACH');
    }

    // --- 3. POLE POSITION CLUB & DEGENATRON ARCADE (x: 48, z: -20) ---
    {
      const clubGroup = new THREE.Group();
      clubGroup.position.set(48, 0, -20);

      const clubWinTex = this._createWindowGridTexture('#160828', '#ff00aa', '#00f0ff', 4, 3, '#2d1448');
      const clubWallMat = this._createToonMaterial(0xffffff, { map: clubWinTex });
      const magentaNeonMat = new THREE.MeshBasicMaterial({ color: 0xff1a8c });
      const cyanNeonMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      this.neonMaterials.push(magentaNeonMat, cyanNeonMat);

      const body = new THREE.Mesh(new THREE.BoxGeometry(7.6, 12.5, 20), clubWallMat);
      body.position.y = 6.25;
      body.castShadow = true;
      body.receiveShadow = true;
      addComicOutline(body);
      clubGroup.add(body);

      this._addRooftopDetails(clubGroup, 7.6, 20, 12.5, this._createToonMaterial(0xff2a85));

      // Dual Neon Signs: "POLE POSITION" (South half) & "DEGENATRON" (North half)
      const ppSignTex = this._createNeonSignTexture('POLE POSITION', '#180428', '#ff00aa', '#00f0ff', false);
      const ppSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 2.0, 9.2),
        new THREE.MeshBasicMaterial({ map: ppSignTex })
      );
      ppSign.position.set(-3.95, 9.5, 4.8);
      addComicOutline(ppSign);
      clubGroup.add(ppSign);

      const degSignTex = this._createNeonSignTexture('DEGENATRON 86', '#091428', '#00f0ff', '#ff2a85', false);
      const degSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 2.0, 9.2),
        new THREE.MeshBasicMaterial({ map: degSignTex })
      );
      degSign.position.set(-3.95, 9.5, -4.8);
      addComicOutline(degSign);
      clubGroup.add(degSign);

      // Horizontal Neon Racing Strips across front facade
      for (const ny of [4.2, 7.2, 11.8]) {
        const tube = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.22, 19.6),
          ny === 7.2 ? cyanNeonMat : magentaNeonMat
        );
        tube.position.set(-3.92, ny, 0);
        clubGroup.add(tube);
      }

      landmarkGroup.add(clubGroup);
      this._registerCollider(48, -20, 7.6, 20, 13.0, 'Pole Position & Degenatron', 'OCEAN BEACH');
    }

    // --- 4. WASHINGTON BEACH ACPD PRECINCT HQ WITH ROOFTOP HELIPAD (x: 48, z: 152) ---
    {
      const vcpdGroup = new THREE.Group();
      vcpdGroup.position.set(48, 0, 152);

      const vcpdWinTex = this._createWindowGridTexture('#122238', '#70e8ff', '#ffffff', 4, 3, '#c8ece8');
      const vcpdWallMat = this._createToonMaterial(0xffffff, { map: vcpdWinTex });
      const tealTrimMat = this._createToonMaterial(0x1f8a9c);
      const whiteTrimMat = this._createToonMaterial(0xf5f8fa);

      const hqBody = new THREE.Mesh(new THREE.BoxGeometry(8.2, 12.5, 13.5), vcpdWallMat);
      hqBody.position.y = 6.25;
      hqBody.castShadow = true;
      hqBody.receiveShadow = true;
      addComicOutline(hqBody);
      vcpdGroup.add(hqBody);

      const parapet = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.8, 13.9), tealTrimMat);
      parapet.position.y = 12.6;
      addComicOutline(parapet);
      vcpdGroup.add(parapet);

      const vcpdSignTex = this._createNeonSignTexture('ACPD PRECINCT', '#091d36', '#00f0ff', '#ffee33', false);
      const vcpdSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 2.0, 11.2),
        new THREE.MeshBasicMaterial({ map: vcpdSignTex })
      );
      vcpdSign.position.set(-4.2, 10.2, 0);
      addComicOutline(vcpdSign);
      vcpdGroup.add(vcpdSign);

      // Entrance Columns
      for (const cz of [-2.4, 2.4]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 4.4, 8), whiteTrimMat);
        col.position.set(-4.3, 2.2, cz);
        addComicOutline(col);
        vcpdGroup.add(col);
      }

      landmarkGroup.add(vcpdGroup);
      this._registerCollider(48, 152, 8.2, 13.5, 12.8, 'Washington Beach ACPD Precinct', 'OCEAN BEACH');

      // Rooftop Helipad 'H' Marking on ACPD Precinct
      this._createHelipadMarkings(48, 13.0, 152, 3.4, 0x00f0ff, 0xffffff);
    }

    // --- 5. OCEAN BEACH LIGHTHOUSE (x: 122, z: 152) ---
    {
      const lhGroup = new THREE.Group();
      lhGroup.position.set(122, 0, 152);

      const stoneMat = this._createToonMaterial(0xd8d0c5);
      const redStripeMat = this._createToonMaterial(0xe62e3d);
      const whiteStripeMat = this._createToonMaterial(0xfaf8f5);
      const darkIronMat = this._createToonMaterial(0x1e222d);
      const lanternGlassMat = new THREE.MeshBasicMaterial({ color: 0xfff4b8 });
      this.neonMaterials.push(lanternGlassMat);

      // Octagonal Stone Jetty Base
      const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.0, 3.2, 10), stoneMat);
      base.position.y = 1.6;
      base.castShadow = true;
      base.receiveShadow = true;
      addComicOutline(base);
      lhGroup.add(base);

      // 6 Alternating Red & White Tapered Lighthouse Tower Bands (up to 21.2m)
      const bandH = 3.0;
      for (let i = 0; i < 6; i++) {
        const rBot = THREE.MathUtils.lerp(3.1, 1.85, i / 6);
        const rTop = THREE.MathUtils.lerp(3.1, 1.85, (i + 1) / 6);
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(rTop, rBot, bandH, 10),
          i % 2 === 0 ? redStripeMat : whiteStripeMat
        );
        seg.position.y = 3.2 + i * bandH + bandH * 0.5;
        seg.castShadow = true;
        addComicOutline(seg);
        lhGroup.add(seg);
      }

      // Observation Gallery Deck & Railing at y = 21.2
      const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.35, 0.55, 12), darkIronMat);
      gallery.position.y = 21.4;
      addComicOutline(gallery);
      lhGroup.add(gallery);

      // Glowing Glass Lantern Room & Red Cupola Dome (total height ~24.8m)
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 2.2, 10), lanternGlassMat);
      lantern.position.y = 22.7;
      addComicOutline(lantern);
      lhGroup.add(lantern);

      const cupola = new THREE.Mesh(new THREE.ConeGeometry(1.85, 1.8, 10), redStripeMat);
      cupola.position.y = 24.6;
      addComicOutline(cupola);
      lhGroup.add(cupola);

      // Rotating Golden Searchlight Beam Cone (this.lighthouseBeam)
      const beamPivot = new THREE.Group();
      beamPivot.position.set(0, 22.7, 0);

      const beamGeo = new THREE.ConeGeometry(7.5, 42.0, 16, 1, true);
      beamGeo.translate(0, -21.0, 0);
      beamGeo.rotateX(-Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffe878,
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const beamCone1 = new THREE.Mesh(beamGeo, beamMat);
      const beamCone2 = new THREE.Mesh(beamGeo, beamMat);
      beamCone2.rotation.y = Math.PI;
      beamPivot.add(beamCone1, beamCone2);
      lhGroup.add(beamPivot);
      this.lighthouseBeam = beamPivot;

      landmarkGroup.add(lhGroup);
      this._registerCollider(122, 152, 6.2, 6.2, 24.8, 'Ocean Beach Lighthouse', 'OCEAN BEACH');
    }

    // --- 6. OCEAN BEACH AVIATION HELIPAD (x: 90.2, z: -16) & SEAPLANE BOARDWALK (x: 112, z: -26) ---
    this._createHelipadMarkings(90.2, 0.16, -16, 4.2, 0x00f0ff, 0xffee33, 'VICE HELI PAD');
    this._createHelipadMarkings(-30.0, 0.14, -54.0, 4.4, 0x00f0ff, 0xffffff, 'VERCETTI HELIPAD');

    {
      const spDock = new THREE.Group();
      spDock.position.set(112, 0.05, -26);

      const timberMat = this._createToonMaterial(0xb08052);
      const pilingMat = this._createToonMaterial(0x4a3525);
      const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xff2a85 });
      this.neonMaterials.push(neonCyanMat, neonPinkMat);

      // Timber Boardwalk Jetty extending from beach sand toward surf
      const deck = new THREE.Mesh(new THREE.BoxGeometry(18.0, 0.24, 9.0), timberMat);
      deck.position.y = 0.12;
      deck.receiveShadow = true;
      addComicOutline(deck);
      spDock.add(deck);

      for (let px = -7.5; px <= 7.5; px += 5.0) {
        for (const pz of [-4.1, 4.1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.8, 8), pilingMat);
          post.position.set(px, 0.5, pz);
          addComicOutline(post);
          spDock.add(post);
        }
      }

      // Neon Perimeter Strips
      const stripN = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.12, 0.22), neonCyanMat);
      stripN.position.set(0, 0.26, -4.3);
      const stripS = stripN.clone();
      stripS.position.set(0, 0.26, 4.3);
      spDock.add(stripN, stripS);

      // "VICE SEAPLANE CHARTERS" Neon Arch Sign at West End of Boardwalk
      const spSignTex = this._createNeonSignTexture('VICE SEAPLANE CHARTERS', '#0b192e', '#00f0ff', '#ff2a85', false);
      const archSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 1.65, 8.2),
        new THREE.MeshBasicMaterial({ map: spSignTex })
      );
      archSign.position.set(-8.2, 3.8, 0);
      addComicOutline(archSign);
      spDock.add(archSign);

      for (const pz of [-3.6, 3.6]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 3.8, 8), pilingMat);
        leg.position.set(-8.2, 1.9, pz);
        addComicOutline(leg);
        spDock.add(leg);
      }

      landmarkGroup.add(spDock);
    }

    // --- 7. INTERGLOBAL FILMS STUDIO LOT (x: -54, z: -54) ---
    {
      const studioGroup = new THREE.Group();
      studioGroup.position.set(-54, 0, -54);

      const creamStageMat = this._createToonMaterial(0xf7efe2);
      const turquoiseTrimMat = this._createToonMaterial(0x00d8c8);
      const coralBandMat = this._createToonMaterial(0xff5286);

      // Soundstage A Main Building (width: 14, depth: 10, height: 10.5)
      const stageA = new THREE.Mesh(new THREE.BoxGeometry(14, 10.5, 10), creamStageMat);
      stageA.position.set(0, 5.25, -4.0);
      stageA.castShadow = true;
      stageA.receiveShadow = true;
      addComicOutline(stageA);
      studioGroup.add(stageA);

      // Barrel-Vaulted Soundstage Roof
      const stageVault = new THREE.Mesh(
        new THREE.CylinderGeometry(4.8, 4.8, 13.6, 10, 1, false, 0, Math.PI),
        turquoiseTrimMat
      );
      stageVault.rotation.z = Math.PI / 2;
      stageVault.position.set(0, 10.5, -4.0);
      addComicOutline(stageVault);
      studioGroup.add(stageVault);

      // Horizontal Deco Racing Stripes on Soundstage
      const band = new THREE.Mesh(new THREE.BoxGeometry(14.3, 0.85, 10.3), coralBandMat);
      band.position.set(0, 7.6, -4.0);
      addComicOutline(band);
      studioGroup.add(band);

      // "INTERGLOBAL FILMS" Neon Sign facing South Courtyard
      const igSignTex = this._createNeonSignTexture('INTERGLOBAL FILMS', '#0d1e2d', '#00f0ff', '#ff2a85', false);
      const igSign = new THREE.Mesh(
        new THREE.BoxGeometry(11.8, 2.1, 0.45),
        new THREE.MeshBasicMaterial({ map: igSignTex })
      );
      igSign.position.set(0, 9.2, 1.25);
      addComicOutline(igSign);
      studioGroup.add(igSign);

      // Iconic Studio Water Tower on Roof
      const wtTank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 10), creamStageMat);
      wtTank.position.set(-4.2, 14.2, -4.0);
      addComicOutline(wtTank);
      const wtCone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.1, 10), coralBandMat);
      wtCone.position.set(-4.2, 15.9, -4.0);
      addComicOutline(wtCone);
      studioGroup.add(wtTank, wtCone);

      landmarkGroup.add(studioGroup);
      this._registerCollider(-54, -58, 14, 10, 13.5, 'InterGlobal Films Soundstage', 'STARFISH ISLAND');
    }

    // --- 8. CAFÉ ROBINA (x: -135, z: 72) ---
    {
      const cafeGroup = new THREE.Group();
      cafeGroup.position.set(-135, 0, 72);

      const cafeWinTex = this._createWindowGridTexture('#2b1610', '#ffcc44', '#ff4422', 4, 2, '#f5d2a8');
      const cafeWallMat = this._createToonMaterial(0xffffff, { map: cafeWinTex });
      const terracottaMat = this._createToonMaterial(0xc84b31);

      const body = new THREE.Mesh(new THREE.BoxGeometry(14, 8.2, 15), cafeWallMat);
      body.position.y = 4.1;
      body.castShadow = true;
      body.receiveShadow = true;
      addComicOutline(body);
      cafeGroup.add(body);

      const parapet = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.9, 15.6), terracottaMat);
      parapet.position.y = 8.4;
      addComicOutline(parapet);
      cafeGroup.add(parapet);

      this._addRooftopDetails(cafeGroup, 14, 15, 8.2, terracottaMat);
      this._addStorefrontAwnings(cafeGroup, 14, 15, true, '#1f7a3e', '#fff8ee');

      const robinaSignTex = this._createNeonSignTexture('CAFE ROBINA', '#240b08', '#ffcc00', '#ff3344', false);
      const robinaSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 2.1, 11.5),
        new THREE.MeshBasicMaterial({ map: robinaSignTex })
      );
      robinaSign.position.set(7.1, 7.2, 0);
      addComicOutline(robinaSign);
      cafeGroup.add(robinaSign);

      landmarkGroup.add(cafeGroup);
      this._registerCollider(-135, 72, 14, 15, 9.0, 'Café Robina', 'LITTLE HAITI');
    }

    // --- 9. CHERRY POPPER ICE CREAM FACTORY (x: -135, z: -75) ---
    {
      const cpGroup = new THREE.Group();
      cpGroup.position.set(-135, 0, -75);

      const cpWinTex = this._createWindowGridTexture('#28122b', '#ff66b2', '#66ffe0', 4, 2, '#ffcce6');
      const cpWallMat = this._createToonMaterial(0xffffff, { map: cpWinTex });
      const mintTrimMat = this._createToonMaterial(0x70f5d8);
      const pinkSwirlMat = this._createToonMaterial(0xff5ca8);
      const creamSwirlMat = this._createToonMaterial(0xfff8f0);
      const waffleMat = this._createToonMaterial(0xd99b52);
      const cherryNeonMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
      this.neonMaterials.push(cherryNeonMat);

      const body = new THREE.Mesh(new THREE.BoxGeometry(14, 8.8, 13), cpWallMat);
      body.position.y = 4.4;
      body.castShadow = true;
      body.receiveShadow = true;
      addComicOutline(body);
      cpGroup.add(body);

      this._addRooftopDetails(cpGroup, 14, 13, 8.8, mintTrimMat);
      this._addStorefrontAwnings(cpGroup, 14, 13, true, '#ff4d94', '#e6fff9');

      const cpSignTex = this._createNeonSignTexture('CHERRY POPPER', '#2b0824', '#00f0ff', '#ff2a85', false);
      const cpSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 2.2, 11.2),
        new THREE.MeshBasicMaterial({ map: cpSignTex })
      );
      cpSign.position.set(7.1, 7.8, 0);
      addComicOutline(cpSign);
      cpGroup.add(cpSign);

      // Giant 3D Pink & White Swirled Soft-Serve Ice Cream Cone on Roof!
      const coneGroup = new THREE.Group();
      coneGroup.position.set(2.0, 9.0, 0);

      const waffleCone = new THREE.Mesh(new THREE.ConeGeometry(1.75, 3.8, 10), waffleMat);
      waffleCone.rotation.x = Math.PI;
      waffleCone.position.y = 1.9;
      addComicOutline(waffleCone);
      coneGroup.add(waffleCone);

      const scoop1 = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.65, 8, 14), creamSwirlMat);
      scoop1.rotation.x = Math.PI / 2;
      scoop1.position.y = 3.85;
      addComicOutline(scoop1);
      const scoop2 = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.55, 8, 14), pinkSwirlMat);
      scoop2.rotation.x = Math.PI / 2;
      scoop2.position.y = 4.65;
      addComicOutline(scoop2);
      const scoop3 = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.5, 10), creamSwirlMat);
      scoop3.position.y = 5.55;
      addComicOutline(scoop3);

      const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.52, 8, 8), cherryNeonMat);
      cherry.position.set(0.25, 6.45, 0);
      addComicOutline(cherry);
      coneGroup.add(scoop1, scoop2, scoop3, cherry);
      cpGroup.add(coneGroup);

      this.animatedLandmarkProps.push({
        type: 'spin_y',
        mesh: coneGroup,
        speed: 0.75,
      });

      landmarkGroup.add(cpGroup);
      this._registerCollider(-135, -75, 14, 13, 14.5, 'Cherry Popper Ice Cream Factory', 'LITTLE HAITI');
    }

    // --- 10. DOWNTOWN VCN SKYSCRAPER & HYMAN CONDO TOWERS (5 TALL WESTERN SKYLINE TOWERS at x: -162) ---
    const skylineTowers = [
      {
        x: -162, z: -115, w: 7.4, d: 18, h: 30,
        name: 'VCN Broadcast Tower', signText: 'VCN NEWS',
        primaryColor: 0x9cf0ff, secondaryColor: 0xff2a85,
        neon1: 0x00f0ff, neon2: 0xff2a85, hasSpire: true,
      },
      {
        x: -162, z: -68, w: 7.4, d: 18, h: 32,
        name: 'Hyman Condo Tower', signText: 'HYMAN CONDOS',
        primaryColor: 0xffcce8, secondaryColor: 0x62f2e8,
        neon1: 0xff2a85, neon2: 0x00f0ff, hasSpire: true,
      },
      {
        x: -162, z: -20, w: 7.4, d: 17, h: 24,
        name: 'Schuman Medical Center', signText: 'SCHUMAN MED',
        primaryColor: 0xdff8ff, secondaryColor: 0x00d8f0,
        neon1: 0x00f0ff, neon2: 0x22ffaa, hasSpire: false,
      },
      {
        x: -162, z: 25, w: 7.4, d: 18, h: 27,
        name: 'Banco Corrupto / Vice Bank', signText: 'VICE BANK',
        primaryColor: 0xffeab3, secondaryColor: 0x48e5c2,
        neon1: 0xffcc00, neon2: 0x00f0ff, hasSpire: true,
      },
      {
        x: -162, z: 68, w: 7.4, d: 17, h: 25,
        name: 'WKTT / V-Rock Tower', signText: 'WKTT RADIO',
        primaryColor: 0xd8b8ff, secondaryColor: 0xff3399,
        neon1: 0xff00aa, neon2: 0x00f0ff, hasSpire: true,
      },
    ];

    for (const st of skylineTowers) {
      const tg = this._createArtDecoHotel({
        x: st.x,
        z: st.z,
        width: st.w,
        depth: st.d,
        height: st.h,
        name: st.name,
        signText: st.signText,
        primaryColor: st.primaryColor,
        secondaryColor: st.secondaryColor,
        neonColor1: st.neon1,
        neonColor2: st.neon2,
        facesEast: true,
      });

      if (st.hasSpire) {
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.45, 7.5, 6),
          this._createToonMaterial(0xe2e8f0)
        );
        mast.position.y = st.h + 7.5;
        addComicOutline(mast);
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.38, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff2a85 })
        );
        beacon.position.y = st.h + 11.4;
        tg.add(mast, beacon);
      }
    }

    // --- 11. ADDITIONAL ICONIC DISTRICT LANDMARKS (WELL STACKED PIZZA, RYTON AIDE, HARDWARE, LEAF LINKS, BOATHOUSE) ---
    const extraLandmarks = [
      {
        x: -135, z: -148, w: 14, d: 14, h: 9.5,
        name: 'Well Stacked Pizza Co.', signText: 'PIZZA CO',
        primaryColor: 0xffd6c2, secondaryColor: 0xff3333,
        neon1: 0xff3333, neon2: 0x33ff77, facesEast: true,
      },
      {
        x: -135, z: -34.5, w: 13, d: 8.5, h: 8.5,
        name: 'Ryton Aide Pharmacy', signText: 'RYTON AIDE',
        primaryColor: 0xc8f7f0, secondaryColor: 0x00d8f0,
        neon1: 0x00f0ff, neon2: 0xff2a85, facesEast: true,
      },
      {
        x: -135, z: 34.5, w: 13, d: 8.5, h: 8.5,
        name: 'Bunch of Tools Hardware', signText: 'TOOLS 86',
        primaryColor: 0xffdfba, secondaryColor: 0xff7722,
        neon1: 0xff8800, neon2: 0x00f0ff, facesEast: true,
      },
      {
        x: -6, z: -54, w: 12, d: 11, h: 9.0,
        name: 'Leaf Links Country Club', signText: 'LEAF LINKS',
        primaryColor: 0xc2f7dc, secondaryColor: 0xff9ec4,
        neon1: 0x22ff99, neon2: 0xff2a85, facesEast: false,
      },
      {
        x: -6, z: 52, w: 12, d: 11, h: 9.5,
        name: 'Casa Mendez Bay Villa', signText: 'MENDEZ',
        primaryColor: 0xffe4c4, secondaryColor: 0x00e5ff,
        neon1: 0xffaa33, neon2: 0x00f0ff, facesEast: false,
      },
      {
        x: -54, z: 52, w: 12, d: 11, h: 8.5,
        name: 'Starfish Tennis & Cabana Club', signText: 'CABANA',
        primaryColor: 0xd4f5ff, secondaryColor: 0xff66a3,
        neon1: 0x00f0ff, neon2: 0xff2a85, facesEast: true,
      },
      {
        x: 61, z: 152, w: 14, d: 12, h: 12.5,
        name: 'Ocean Bay Marina Yacht Club', signText: 'YACHT CLUB',
        primaryColor: 0xc6f2ff, secondaryColor: 0xff80b8,
        neon1: 0x00f0ff, neon2: 0xff2a85, facesEast: true,
      },
    ];

    for (const el of extraLandmarks) {
      this._createArtDecoHotel({
        x: el.x,
        z: el.z,
        width: el.w,
        depth: el.d,
        height: el.h,
        name: el.name,
        signText: el.signText,
        primaryColor: el.primaryColor,
        secondaryColor: el.secondaryColor,
        neonColor1: el.neon1,
        neonColor2: el.neon2,
        facesEast: el.facesEast,
      });
    }

    // --- 12. ESCOBAR INTERNATIONAL AIRPORT & AIRFIELD (x: -146.. -152, z: 60..148) ---
    {
      const airportGroup = new THREE.Group();

      const towerWhiteMat = this._createToonMaterial(0xf5f8fc);
      const towerTealMat = this._createToonMaterial(0x00c8d8);
      const towerPinkMat = this._createToonMaterial(0xff3388);
      const cabGlassMat = new THREE.MeshBasicMaterial({ color: 0x66f4ff });
      this.neonMaterials.push(cabGlassMat);

      // Escobar Control Tower at (x: -144.5, z: 142) — clear of runway x = -152
      const ctGroup = new THREE.Group();
      ctGroup.position.set(-144.5, 0, 142);

      const basePodium = new THREE.Mesh(new THREE.BoxGeometry(6.2, 6.0, 6.8), towerWhiteMat);
      basePodium.position.y = 3.0;
      basePodium.castShadow = true;
      addComicOutline(basePodium);
      ctGroup.add(basePodium);

      const shaft = new THREE.Mesh(new THREE.BoxGeometry(4.2, 14.5, 4.2), towerWhiteMat);
      shaft.position.y = 13.0;
      shaft.castShadow = true;
      addComicOutline(shaft);
      ctGroup.add(shaft);

      // Vertical Teal Art Deco Fin Ribs on Control Tower Shaft
      for (const side of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(4.8, 14.0, 0.55), towerTealMat);
        fin.position.set(0, 13.0, side * 1.4);
        addComicOutline(fin);
        ctGroup.add(fin);
      }

      // Flared Observation & Radar Cab at Top (y = 20..24.5)
      const lowerCollar = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 2.5, 1.4, 8), towerTealMat);
      lowerCollar.position.y = 20.6;
      addComicOutline(lowerCollar);
      ctGroup.add(lowerCollar);

      const glassCab = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 3.5, 2.2, 8), cabGlassMat);
      glassCab.position.y = 22.4;
      addComicOutline(glassCab);
      ctGroup.add(glassCab);

      const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.2, 0.7, 8), towerPinkMat);
      cabRoof.position.y = 23.85;
      addComicOutline(cabRoof);
      ctGroup.add(cabRoof);

      // "ESCOBAR AIR" Vertical Neon Sign on Control Tower
      const escSignTex = this._createNeonSignTexture('ESCOBAR AIR', '#081b2e', '#00f0ff', '#ff2a85', false);
      const escSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 1.8, 6.4),
        new THREE.MeshBasicMaterial({ map: escSignTex })
      );
      escSign.position.set(3.2, 5.2, 0);
      addComicOutline(escSign);
      ctGroup.add(escSign);

      // Rotating Green & White Aerodrome Beacon at y = 25.0
      const beaconPivot = new THREE.Group();
      beaconPivot.position.set(0, 24.8, 0);
      const beaconHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.9, 8), towerTealMat);
      addComicOutline(beaconHousing);
      beaconPivot.add(beaconHousing);

      const beamGeo = new THREE.ConeGeometry(3.2, 22.0, 12, 1, true);
      beamGeo.translate(0, -11.0, 0);
      beamGeo.rotateX(-Math.PI / 2);
      const greenBeam = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({
          color: 0x22ff88,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const whiteBeam = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.24,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      whiteBeam.rotation.y = Math.PI;
      beaconPivot.add(greenBeam, whiteBeam);
      ctGroup.add(beaconPivot);
      this.aerodromeBeacon = beaconPivot;

      airportGroup.add(ctGroup);
      this._registerCollider(-144.5, 142, 6.2, 6.8, 25.0, 'Escobar Airport Control Tower', 'ARGON PORT MARINA');

      // Runway Threshold Piano-Key Stripes, Centerline Dashes & "09 / 27" Numbers along x = -152, z in [60, 148]
      const stripeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf4f7fc });
      const stripeYellowMat = new THREE.MeshBasicMaterial({ color: 0xffd822 });
      const greenEdgeMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
      const cyanEdgeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      this.neonMaterials.push(greenEdgeMat, cyanEdgeMat);

      for (const threshZ of [62, 146]) {
        for (let sx = -4.2; sx <= 4.2; sx += 1.4) {
          const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 4.8), stripeWhiteMat);
          bar.rotation.x = -Math.PI / 2;
          bar.position.set(-152 + sx, 0.036, threshZ);
          airportGroup.add(bar);
        }
      }

      // Runway Number Decals "09" & "27"
      const makeRunwayNumPlane = (numStr, zPos, rotY) => {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 128;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 256, 128);
        ctx.fillStyle = '#f4f8ff';
        ctx.font = '900 84px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(numStr, 128, 64);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(6.8, 3.4),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
        );
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = rotY;
        m.position.set(-152, 0.038, zPos);
        airportGroup.add(m);
      };
      makeRunwayNumPlane('09', 70, 0);
      makeRunwayNumPlane('27', 138, Math.PI);

      // Glowing Cyan/Green Runway Edge Light Posts along x = -157.8 and x = -146.2
      for (let rz = 60; rz <= 148; rz += 11) {
        for (const rx of [-157.8, -146.2]) {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.16, 0.55, 6),
            rz % 22 === 0 ? greenEdgeMat : cyanEdgeMat
          );
          post.position.set(rx, 0.28, rz);
          airportGroup.add(post);
        }
      }

      // Animated Orange-and-White Striped Airport Windsock at (-144.5, 118)
      const wsGroup = new THREE.Group();
      wsGroup.position.set(-144.5, 0, 118);
      const wsPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.14, 5.8, 6),
        towerWhiteMat
      );
      wsPole.position.y = 2.9;
      addComicOutline(wsPole);
      wsGroup.add(wsPole);

      const sockPivot = new THREE.Group();
      sockPivot.position.set(0, 5.6, 0);
      const orangeSockMat = this._createToonMaterial(0xff5511);
      for (let s = 0; s < 4; s++) {
        const r1 = 0.42 - s * 0.06;
        const r2 = 0.42 - (s + 1) * 0.06;
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(r2, r1, 0.55, 8),
          s % 2 === 0 ? orangeSockMat : towerWhiteMat
        );
        seg.rotation.z = Math.PI / 2;
        seg.position.set(0.35 + s * 0.52, -s * 0.04, 0);
        addComicOutline(seg);
        sockPivot.add(seg);
      }
      wsGroup.add(sockPivot);
      this.airportWindsock = sockPivot;
      airportGroup.add(wsGroup);

      landmarkGroup.add(airportGroup);
    }

    this.scene.add(landmarkGroup);
  }

  // ============================================================================
  // 10C. 6 DRIVEABLE 3D UNIQUE STUNT JUMP RAMPS
  // ============================================================================

  _createStuntRampDeckTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1e1630';
    ctx.fillRect(0, 0, 256, 512);

    // Bold Yellow & Hot-Pink Chevron Launch Arrows pointing upward (+Y in UV)
    for (let y = 24; y < 500; y += 64) {
      ctx.fillStyle = (y / 64) % 2 === 0 ? '#ffee22' : '#ff2a85';
      ctx.beginPath();
      ctx.moveTo(128, y);
      ctx.lineTo(232, y + 42);
      ctx.lineTo(232, y + 66);
      ctx.lineTo(128, y + 24);
      ctx.lineTo(24, y + 66);
      ctx.lineTo(24, y + 42);
      ctx.closePath();
      ctx.fill();
    }

    // Glowing Cyan Side Guide Borders
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(0, 0, 16, 512);
    ctx.fillRect(240, 0, 16, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  _buildStuntRamps() {
    const rampConfigs = [
      {
        id: 'stunt_ocean_seawall',
        name: 'Ocean Beach Seawall Jump',
        x: 88.5,
        z: -3.5,
        dirX: 1,
        dirZ: 0,
        width: 4.2,
        length: 6.5,
        height: 2.2,
        baseY: 0.02,
      },
      {
        id: 'stunt_starfish_canal',
        name: 'Starfish Causeway Canal Jump',
        x: 30.0,
        z: 3.2,
        dirX: -1,
        dirZ: 0,
        width: 4.0,
        length: 6.0,
        height: 2.0,
        baseY: 0.45,
      },
      {
        id: 'stunt_vice_gas_rooftop',
        name: "Argon Gas '86 Rooftop Jump",
        x: 72.5,
        z: -48.0,
        dirX: 0,
        dirZ: 1,
        width: 3.8,
        length: 6.0,
        height: 2.3,
        baseY: 0.02,
      },
      {
        id: 'stunt_marina_pier',
        name: 'Marina Yacht Pier Launch',
        x: 15.0,
        z: 124.0,
        dirX: 0,
        dirZ: 1,
        width: 4.2,
        length: 6.5,
        height: 2.2,
        baseY: 0.34,
      },
      {
        id: 'stunt_little_haiti_junkyard',
        name: 'Little Haiti Junkyard Jump',
        x: -111.8,
        z: -32.0,
        dirX: 0,
        dirZ: -1,
        width: 4.0,
        length: 6.0,
        height: 2.1,
        baseY: 0.02,
      },
      {
        id: 'stunt_escobar_runway',
        name: 'Escobar Runway Take-Off Ramp',
        x: -152.0,
        z: 82.0,
        dirX: 0,
        dirZ: 1,
        width: 4.5,
        length: 7.0,
        height: 2.4,
        baseY: 0.02,
      },
    ];

    const rampDeckTex = this._createStuntRampDeckTexture();
    const rampDeckMat = new THREE.MeshBasicMaterial({ map: rampDeckTex });
    const sidePlateMat = this._createToonMaterial(0xffb81c);
    const railNeonMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const lipNeonMat = new THREE.MeshBasicMaterial({ color: 0xff2a85 });
    this.neonMaterials.push(rampDeckMat, railNeonMat, lipNeonMat);

    for (const rc of rampConfigs) {
      const rampGroup = new THREE.Group();
      rampGroup.position.set(rc.x, rc.baseY || 0.02, rc.z);
      // Orient local +Z along launch direction (dirX, dirZ)
      rampGroup.rotation.y = Math.atan2(rc.dirX, rc.dirZ);

      const hw = rc.width * 0.5;
      const hl = rc.length * 0.5;
      const h = rc.height - (rc.baseY || 0.02);

      // Sloped Deck Surface from (z = -hl, y = 0.02) to (z = +hl, y = h)
      const slopeLen = Math.hypot(rc.length, h);
      const slopeAngle = Math.atan2(h, rc.length);

      const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(rc.width, 0.18, slopeLen), [
        sidePlateMat,
        sidePlateMat,
        rampDeckMat,
        sidePlateMat,
        sidePlateMat,
        lipNeonMat,
      ]);
      deckMesh.position.set(0, h * 0.5, 0);
      deckMesh.rotation.x = -slopeAngle;
      deckMesh.castShadow = true;
      deckMesh.receiveShadow = true;
      addComicOutline(deckMesh);
      rampGroup.add(deckMesh);

      // Neon Side Guide Rails along the sloped deck
      for (const sx of [-hw + 0.14, hw - 0.14]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, slopeLen), railNeonMat);
        rail.position.set(sx, h * 0.5 + 0.15, 0);
        rail.rotation.x = -slopeAngle;
        addComicOutline(rail);
        rampGroup.add(rail);
      }

      // Steel Truss Support Struts under the high launch lip (z = +hl)
      for (const sx of [-hw + 0.25, 0, hw - 0.25]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, h, 0.45), sidePlateMat);
        post.position.set(sx, h * 0.5, hl - 0.35);
        post.castShadow = true;
        addComicOutline(post);
        rampGroup.add(post);

        const midPost = new THREE.Mesh(new THREE.BoxGeometry(0.28, h * 0.5, 0.38), sidePlateMat);
        midPost.position.set(sx, h * 0.25, 0);
        addComicOutline(midPost);
        rampGroup.add(midPost);
      }

      this.scene.add(rampGroup);

      const spanX = Math.abs(rc.dirX) > 0.5 ? rc.length : rc.width;
      const spanZ = Math.abs(rc.dirZ) > 0.5 ? rc.length : rc.width;

      this.stuntRamps.push({
        ...rc,
        minX: rc.x - spanX * 0.5,
        maxX: rc.x + spanX * 0.5,
        minZ: rc.z - spanZ * 0.5,
        maxZ: rc.z + spanZ * 0.5,
        completed: false,
        mesh: rampGroup,
      });
    }
  }

  getStuntRamps() {
    return this.stuntRamps;
  }

  // ============================================================================
  // 10D. 12 ICONIC ARGON CITY EASTER EGGS
  // ============================================================================

  _buildEasterEggs() {
    const eggRoot = new THREE.Group();

    const goldMat = this._createToonMaterial(0xffd700);
    const crimsonNeonMat = new THREE.MeshBasicMaterial({ color: 0xff1144 });
    const cyanNeonMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const pinkNeonMat = new THREE.MeshBasicMaterial({ color: 0xff2a85 });
    const tileWhiteMat = this._createToonMaterial(0xf2f4f8);
    this.neonMaterials.push(crimsonNeonMat, cyanNeonMat, pinkNeonMat);

    // 1. 1986 Jan Hammer Neon Synth & Arcade Studio ("SYNTH '86") (x: 53.5, z: 4.5)
    {
      const g = new THREE.Group();
      g.position.set(53.5, 0, 4.5);

      const studioWallMat = this._createToonMaterial(0x1f1438);
      const chromeStandMat = this._createToonMaterial(0xd8e2ec);
      const alcove = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 2.8), studioWallMat);
      alcove.position.y = 1.6;
      addComicOutline(alcove);
      g.add(alcove);

      const cyanBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.5), cyanNeonMat);
      cyanBackdrop.position.set(0, 1.55, 1.42);
      g.add(cyanBackdrop);

      const signTex = this._createNeonSignTexture("SYNTH '86", '#14082c', '#00f0ff', '#ff2a85', false);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.78, 0.26),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      sign.position.set(0, 3.6, 1.2);
      addComicOutline(sign);
      g.add(sign);

      // 3D Dual-Tier 1980s Analog Keyboard Synthesizer Stand
      const synthGroup = new THREE.Group();
      synthGroup.position.set(-0.45, 0.12, 2.05);

      const standLeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.35, 6), chromeStandMat);
      standLeg1.position.set(0, 0.65, 0);
      standLeg1.rotation.z = 0.42;
      const standLeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.35, 6), chromeStandMat);
      standLeg2.position.set(0, 0.65, 0);
      standLeg2.rotation.z = -0.42;
      const lowerKeybed = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.14, 0.46), tileWhiteMat);
      lowerKeybed.position.set(0, 1.15, 0);
      addComicOutline(lowerKeybed);
      const upperKeybed = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.12, 0.40), pinkNeonMat);
      upperKeybed.position.set(0, 1.48, -0.10);
      upperKeybed.rotation.x = 0.22;
      addComicOutline(upperKeybed);
      synthGroup.add(standLeg1, standLeg2, lowerKeybed, upperKeybed);
      g.add(synthGroup);

      // Classic "DEGENATRON" 8-Bit Arcade Cabinet beside the Synth Rig
      const cabMat = this._createToonMaterial(0x160d2e);
      const arcadeCab = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.05, 0.92), cabMat);
      arcadeCab.position.set(0.92, 1.05, 1.95);
      addComicOutline(arcadeCab);
      const arcadeScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.68), pinkNeonMat);
      arcadeScreen.position.set(0.92, 1.42, 2.42);
      g.add(arcadeCab, arcadeScreen);

      this.animatedLandmarkProps.push({ type: 'spin_y', mesh: synthGroup, speed: 1.6 });
      eggRoot.add(g);
      this._registerCollider(53.5, 4.5, 3.2, 2.8, 3.6, "Synth '86 Studio Alcove", 'OCEAN BEACH');

      this.easterEggs.push({
        id: 'egg_synth_studio_86',
        name: "1986 Jan Hammer 'Synth 86' Studio",
        description: 'Glowing neon synthwave studio alcove with a dual-tier 1980s analog keyboard rig and Degenatron cabinet.',
        x: 53.5,
        y: 0.12,
        z: 4.5,
        radius: 5.5,
        district: 'OCEAN BEACH',
        discovered: false,
        mesh: g,
      });
    }

    // 2. Cement-Shoes Submarine Mafia Goon (x: 31.5, z: 22.0)
    {
      const g = new THREE.Group();
      g.position.set(31.5, -0.32, 22.0);

      const concreteMat = this._createToonMaterial(0x9a9ea8);
      const suitMat = this._createToonMaterial(0x28344a);
      const skinMat = this._createToonMaterial(0xd8b898);
      const buoyRedMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });

      // Concrete Block Feet on shallow bay shelf
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.85), concreteMat);
      block.position.y = -0.35;
      addComicOutline(block);
      g.add(block);

      // Pinstripe Suit Torso & Fedora Hat visible right through the turquoise water
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.05, 0.42), suitMat);
      torso.position.y = 0.22;
      addComicOutline(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), skinMat);
      head.position.y = 0.88;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10), concreteMat);
      brim.position.y = 1.04;
      addComicOutline(brim);
      g.add(torso, head, brim);

      // Floating Red & White Marker Buoy above
      const buoy = new THREE.Group();
      buoy.position.set(1.1, 0.35, 0);
      const floatCone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.95, 8), buoyRedMat);
      floatCone.position.y = 0.45;
      addComicOutline(floatCone);
      buoy.add(floatCone);
      g.add(buoy);

      this.animatedLandmarkProps.push({ type: 'bob_y', mesh: buoy, baseY: 0.35, amp: 0.14, speed: 2.5 });
      eggRoot.add(g);

      this.easterEggs.push({
        id: 'egg_cement_shoes',
        name: 'Cement-Shoes Mafia Goon',
        description: 'Sleeping with the fishes off the East Bay Seawall in concrete overshoes.',
        x: 31.5,
        y: 0.0,
        z: 22.0,
        radius: 6.0,
        district: 'OCEAN BEACH',
        discovered: false,
        mesh: g,
      });
    }

    // 3. VCN Chocolate Easter Egg Pedestal (x: 53.5, z: -20.0)
    {
      const g = new THREE.Group();
      g.position.set(53.5, 0, -20.0);

      const chocoMat = this._createToonMaterial(0x6b3a1e);
      const icingMat = this._createToonMaterial(0xff80bf);

      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.45, 1.1, 10), cyanNeonMat);
      ped.position.y = 0.55;
      addComicOutline(ped);
      g.add(ped);

      const eggMeshGroup = new THREE.Group();
      eggMeshGroup.position.set(0, 2.35, 0);
      const eggGeo = new THREE.SphereGeometry(1.05, 12, 12);
      eggGeo.scale(0.82, 1.28, 0.82);
      const eggMesh = new THREE.Mesh(eggGeo, chocoMat);
      addComicOutline(eggMesh);
      eggMeshGroup.add(eggMesh);

      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.12, 8, 16), icingMat);
      ribbon.rotation.x = Math.PI / 2;
      addComicOutline(ribbon);
      eggMeshGroup.add(ribbon);
      g.add(eggMeshGroup);

      const signTex = this._createNeonSignTexture("HAPPY EASTER '86", '#241028', '#ff80bf', '#ffee33', false);
      const plaque = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.75, 2.8),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      plaque.position.set(1.3, 0.85, 0);
      addComicOutline(plaque);
      g.add(plaque);

      this.animatedLandmarkProps.push({ type: 'spin_y', mesh: eggMeshGroup, speed: 1.4 });
      eggRoot.add(g);

      this.easterEggs.push({
        id: 'egg_vcn_chocolate',
        name: "VCN 'Happy Easter 86' Chocolate Egg",
        description: 'The legendary giant frosted chocolate Easter Egg hidden in Argon City.',
        x: 53.5,
        y: 0.12,
        z: -20.0,
        radius: 5.5,
        district: 'OCEAN BEACH',
        discovered: false,
        mesh: g,
      });
    }

    // 4. InterGlobal Moon Lander Stage Prop (x: -54.0, z: -50.0)
    {
      const g = new THREE.Group();
      g.position.set(-54.0, 0, -50.0);

      const lunarGreyMat = this._createToonMaterial(0x8c929e);
      const silverAscentMat = this._createToonMaterial(0xdce2ec);

      // Cratered Lunar Studio Floor Pad
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.2, 0.22, 16), lunarGreyMat);
      pad.position.y = 0.11;
      addComicOutline(pad);
      g.add(pad);

      // Gold-Foil Octagonal Descent Stage
      const descent = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 1.45, 8), goldMat);
      descent.position.y = 1.65;
      addComicOutline(descent);
      g.add(descent);

      // 4 Spidery Lunar Landing Legs & Footpads
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const lx = Math.cos(a) * 2.25;
        const lz = Math.sin(a) * 2.25;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.85, 6), goldMat);
        leg.position.set(lx * 0.78, 0.95, lz * 0.78);
        leg.rotation.z = -Math.cos(a) * 0.45;
        leg.rotation.x = Math.sin(a) * 0.45;
        addComicOutline(leg);
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.10, 8), goldMat);
        foot.position.set(lx, 0.25, lz);
        g.add(leg, foot);
      }

      // Silver Ascent Module Cabin
      const ascent = new THREE.Mesh(new THREE.DodecahedronGeometry(1.25, 0), silverAscentMat);
      ascent.position.y = 2.95;
      addComicOutline(ascent);
      g.add(ascent);

      // Studio US Lunar Flag on Pole
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), silverAscentMat);
      flagPole.position.set(3.2, 1.4, 1.2);
      const flagBanner = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.06), crimsonNeonMat);
      flagBanner.position.set(3.75, 2.35, 1.2);
      addComicOutline(flagBanner);
      g.add(flagPole, flagBanner);

      eggRoot.add(g);

      this.easterEggs.push({
        id: 'egg_moon_lander',
        name: 'InterGlobal Apollo Moon Lander Set',
        description: 'Gold-foil Apollo lunar lander and studio crater floor on the InterGlobal Films backlot.',
        x: -54.0,
        y: 0.12,
        z: -50.0,
        radius: 6.5,
        district: 'STARFISH ISLAND',
        discovered: false,
        mesh: g,
      });
    }

    // 5. Ocean Beach Sandcastle & Buried Pirate Treasure Chest (x: 114.0, z: 4.0)
    {
      const g = new THREE.Group();
      g.position.set(114.0, 0, 4.0);

      const sandCastleMat = this._createToonMaterial(0xe8c882);
      const woodChestMat = this._createToonMaterial(0x7a4924);

      const keep = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 2.2), sandCastleMat);
      keep.position.y = 0.6;
      addComicOutline(keep);
      g.add(keep);

      for (const tx of [-1.1, 1.1]) {
        for (const tz of [-1.1, 1.1]) {
          const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 1.75, 8), sandCastleMat);
          turret.position.set(tx, 0.88, tz);
          addComicOutline(turret);
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.65, 8), pinkNeonMat);
          cone.position.set(tx, 2.05, tz);
          addComicOutline(cone);
          g.add(turret, cone);
        }
      }

      // Open Pirate Treasure Chest brimming with Gold Bullion
      const chest = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.75), woodChestMat);
      chest.position.set(2.1, 0.35, 0.4);
      addComicOutline(chest);
      const goldPile = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 0.62), goldMat);
      goldPile.position.set(2.1, 0.72, 0.4);
      addComicOutline(goldPile);
      g.add(chest, goldPile);

      eggRoot.add(g);

      this.easterEggs.push({
        id: 'egg_sandcastle_treasure',
        name: 'Ocean Beach Sandcastle & Pirate Gold',
        description: 'Four-turret beach sandcastle beside an unearthed 17th-century Spanish gold chest.',
        x: 114.0,
        y: 0.02,
        z: 4.0,
        radius: 5.5,
        district: 'OCEAN BEACH',
        discovered: false,
        mesh: g,
      });
    }

    // 6. Neon Flamingo Flock (x: 90.2, z: 28.0)
    {
      const g = new THREE.Group();
      g.position.set(90.2, 0.14, 28.0);

      const offsets = [
        [0, 0], [-1.2, -1.4], [1.1, -1.1], [-0.9, 1.5], [1.2, 1.3], [0.2, -2.5], [-0.4, 2.7],
      ];
      for (const [fx, fz] of offsets) {
        const fl = new THREE.Group();
        fl.position.set(fx, 0, fz);
        fl.rotation.y = (fx + fz) * 1.2;

        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 5), goldMat);
        leg.position.y = 0.38;
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), pinkNeonMat);
        body.scale.set(0.8, 0.9, 1.35);
        body.position.y = 0.78;
        addComicOutline(body);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 6), pinkNeonMat);
        neck.position.set(0, 1.12, 0.24);
        neck.rotation.x = 0.25;
        fl.add(leg, body, neck);
        g.add(fl);
      }

      eggRoot.add(g);

      this.easterEggs.push({
        id: 'egg_neon_flamingos',
        name: 'Argon City Neon Flamingo Flock',
        description: 'Seven glowing neon-pink lawn flamingos gathered in the Ocean Drive palm park.',
        x: 90.2,
        y: 0.14,
        z: 28.0,
        radius: 5.5,
        district: 'OCEAN BEACH',
        discovered: false,
        mesh: g,
      });
    }

    // 7. InterGlobal Giant Fiberglass Great White Shark Prop (x: -47.5, z: -50.0)
    {
      const g = new THREE.Group();
      g.position.set(-47.5, 0, -50.0);

      const sharkBlueMat = this._createToonMaterial(0x3a7ca5);
      const bellyWhiteMat = this._createToonMaterial(0xf2f6fa);

      const body = new THREE.Mesh(new THREE.ConeGeometry(1.15, 4.8, 10), sharkBlueMat);
      body.rotation.x = Math.PI / 2;
      body.position.y = 1.65;
      addComicOutline(body);
      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.35, 4), sharkBlueMat);
      dorsal.position.set(0, 2.75, -0.3);
      addComicOutline(dorsal);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 1.1), bellyWhiteMat);
      jaw.position.set(0, 1.35, 1.8);
      addComicOutline(jaw);
      g.add(body, dorsal, jaw);

      eggRoot.add(g);

      this.easterEggs.push({
        id: 'egg_studio_shark',
        name: 'InterGlobal Mechanical Shark Prop',
        description: 'Giant fiberglass Great White Shark movie prop on the studio backlot.',
        x: -47.5,
        y: 0.12,
        z: -50.0,
        radius: 5.5,
        district: 'STARFISH ISLAND',
        discovered: false,
        mesh: g,
      });
    }

    // 8. Vercetti Estate "THE WORLD IS YOURS" Golden Globe Fountain (x: -30.0, z: -36.5)
    {
      const g = new THREE.Group();
      g.position.set(-30.0, 0.12, -36.5);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.16, 8, 18), cyanNeonMat);
      ring.position.y = 1.95;
      addComicOutline(ring);
      const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.92, 1), goldMat);
      globe.position.y = 1.95;
      addComicOutline(globe);
      g.add(ring, globe);

      const signTex = this._createNeonSignTexture('THE WORLD IS YOURS', '#1c1204', '#ffd700', '#00f0ff', false);
      const plaque = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.65, 0.28),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      plaque.position.set(0, 0.55, 1.2);
      addComicOutline(plaque);
      g.add(plaque);

      this.animatedLandmarkProps.push({ type: 'spin_y', mesh: globe, speed: 1.2 });
      eggRoot.add(g);

      this.easterEggs.push({
        id: 'egg_world_is_yours',
        name: "Vercetti 'The World Is Yours' Globe",
        description: 'Spinning golden Scarface globe monument on the Vercetti Estate terrace.',
        x: -30.0,
        y: 0.12,
        z: -36.5,
        radius: 5.5,
        district: 'STARFISH ISLAND',
        discovered: false,
        mesh: g,
      });
    }

    // 9. Degenatron 8-Bit Arcade Shrine (x: 53.5, z: -13.5)
    {
      const g = new THREE.Group();
      g.position.set(53.5, 0.12, -13.5);

      const cabMat = this._createToonMaterial(0x1c1236);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 1.2), cabMat);
      cab.position.y = 1.15;
      addComicOutline(cab);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.85), pinkNeonMat);
      screen.position.set(0.62, 1.5, 0);
      screen.rotation.y = Math.PI / 2;
      g.add(cab, screen);

      eggRoot.add(g);

      this.easterEggs.push({
        id: 'egg_degenatron_cabinet',
        name: '1986 Degenatron Arcade Shrine',
        description: "Glowing outdoor 8-bit Degenatron 'Defender of the Faith' arcade cabinet.",
        x: 53.5,
        y: 0.12,
        z: -13.5,
        radius: 5.0,
        district: 'OCEAN BEACH',
        discovered: false,
        mesh: g,
      });
    }

    // 10. Cherry Popper Mascot Cone Shrine (x: -126.5, z: -75.0)
    {
      const g = new THREE.Group();
      g.position.set(-126.5, 0.12, -75.0);

      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.85, 10), pinkNeonMat);
      ped.position.y = 0.42;
      addComicOutline(ped);
      const topOrb = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 10), cyanNeonMat);
      topOrb.position.y = 1.35;
      addComicOutline(topOrb);
      g.add(ped, topOrb);

      eggRoot.add(g);

      this.easterEggs.push({
        id: 'egg_cherry_popper_shrine',
        name: "Cherry Popper 'Distribution' Pedestal",
        description: 'Neon-lit Cherry Popper ice cream mascot pedestal outside the factory gates.',
        x: -126.5,
        y: 0.12,
        z: -75.0,
        radius: 5.5,
        district: 'LITTLE HAITI',
        discovered: false,
        mesh: g,
      });
    }

    // 11. Romero's Funeraria Golden Skull Bust (x: -126.5, z: -12.0)
    {
      const g = new THREE.Group();
      g.position.set(-126.5, 0.12, -12.0);

      const altar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.2), this._createToonMaterial(0x281838));
      altar.position.y = 0.55;
      addComicOutline(altar);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 8), goldMat);
      skull.position.y = 1.45;
      addComicOutline(skull);
      g.add(altar, skull);

      eggRoot.add(g);

      this.easterEggs.push({
        id: 'egg_romeros_funeraria',
        name: "Romero's Funeraria Skull Shrine",
        description: 'Little Haiti funerary shrine with a gleaming golden skull bust.',
        x: -126.5,
        y: 0.12,
        z: -12.0,
        radius: 5.5,
        district: 'LITTLE HAITI',
        discovered: false,
        mesh: g,
      });
    }

    // 12. Offshore Smuggler Narco Mini-Submarine (x: 132.5, z: -52.0)
    {
      const g = new THREE.Group();
      g.position.set(132.5, -0.22, -52.0);

      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 5.2, 10), goldMat);
      hull.rotation.z = Math.PI / 2;
      hull.position.y = 0.15;
      addComicOutline(hull);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 1.35, 8), goldMat);
      tower.position.y = 0.95;
      addComicOutline(tower);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), cyanNeonMat);
      scope.position.set(0, 1.85, 0);
      g.add(hull, tower, scope);

      this.animatedLandmarkProps.push({ type: 'bob_y', mesh: g, baseY: -0.22, amp: 0.12, speed: 1.9 });
      eggRoot.add(g);

      this.easterEggs.push({
        id: 'egg_narco_minisub',
        name: 'Offshore Smuggler Mini-Submarine',
        description: 'Yellow narco mini-sub with glowing cyan periscope surfacing off Ocean Beach.',
        x: 132.5,
        y: 0.0,
        z: -52.0,
        radius: 7.0,
        district: 'OCEAN BEACH',
        discovered: false,
        mesh: g,
      });
    }

    this.scene.add(eggRoot);
  }

  getEasterEggs() {
    return this.easterEggs;
  }

  // ============================================================================
  // 11. ROYAL PALM TREES (130+ WITH TROPICAL WIND SWAY) & DECO STREETLAMPS
  // ============================================================================

  createPalmTree(x, y = 0, z = 0, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);

    if (!this._sharedPalmFrondMat) {
      const frondTex = this._createPalmFrondTexture();
      this._sharedPalmFrondMat = this._createToonMaterial(0xffffff, {
        map: frondTex,
        side: THREE.DoubleSide,
      });
    }
    const trunkMat = this._createToonMaterial(0x8c6448);
    const ringMat = this._createToonMaterial(0x694730);
    const crownshaftMat = this._createToonMaterial(0x36964c);
    const frondMat = this._sharedPalmFrondMat;
    const coconutMat = this._createToonMaterial(0x4f321c);
    const pitMat = this._createToonMaterial(0x4a4542);

    // Base sidewalk tree planter ring / coastal root collar
    const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.14, 8), pitMat);
    baseRing.position.y = 0.07;
    addComicOutline(baseRing, 1.02, 35);
    group.add(baseRing);

    // Segmented Curved Royal Palm Trunk (7 stacked tapered cylinders)
    const curveDir = ((Math.sin(x * 0.37 + z * 0.53) * 43758.54) % 1) * Math.PI * 2;
    const cosD = Math.cos(curveDir);
    const sinD = Math.sin(curveDir);

    let curX = 0;
    let curY = 0;
    let curZ = 0;
    const segs = 7;
    const segH = 1.32;

    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      const rBot = THREE.MathUtils.lerp(0.42, 0.19, i / segs);
      const rTop = THREE.MathUtils.lerp(0.42, 0.19, (i + 1) / segs);
      const lean = Math.sin(t * Math.PI * 0.85) * 0.22;

      const segMesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH, 7), i % 2 === 0 ? trunkMat : ringMat);
      segMesh.position.set(curX + cosD * lean * 0.5, curY + segH * 0.5, curZ + sinD * lean * 0.5);
      segMesh.rotation.z = -cosD * lean * 0.45;
      segMesh.rotation.x = sinD * lean * 0.45;
      segMesh.castShadow = true;
      addComicOutline(segMesh, 1.02, 35);
      group.add(segMesh);

      curX += cosD * lean;
      curY += segH * 0.96;
      curZ += sinD * lean;
    }

    // Smooth green Royal Palm crownshaft cylinder at top of trunk
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.75, 7), crownshaftMat);
    shaft.position.set(curX, curY + 0.25, curZ);
    addComicOutline(shaft, 1.02, 35);
    group.add(shaft);

    // Crown Group at top of trunk (animated in update() for tropical wind sway)
    const crown = new THREE.Group();
    crown.position.set(curX, curY + 0.52, curZ);

    // Coconuts cluster
    for (let c = 0; c < 4; c++) {
      const ca = (c * Math.PI * 2) / 4;
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), coconutMat);
      nut.position.set(Math.cos(ca) * 0.26, -0.22, Math.sin(ca) * 0.26);
      crown.add(nut);
    }

    // 11 Multi-Segment Tapered Arched Feather-Fronds (6 lower spreading + 5 upper canopy)
    const frondCount = 11;
    for (let f = 0; f < frondCount; f++) {
      const isUpper = f >= 6;
      const tierIdx = isUpper ? f - 6 : f;
      const tierCount = isUpper ? 5 : 6;
      const angle = (tierIdx / tierCount) * Math.PI * 2 + (isUpper ? 0.32 : 0.0);

      const frondPivot = new THREE.Group();
      frondPivot.rotation.y = angle;
      frondPivot.rotation.z = (f % 2 === 0 ? 1 : -1) * 0.08;

      // Segment 1: Rising inner petiole & wide feather leaflet base
      const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.06, 1.35), frondMat);
      seg1.position.set(0, isUpper ? 0.46 : 0.28, 0.65);
      seg1.rotation.x = isUpper ? -0.48 : -0.28;
      seg1.castShadow = true;
      addComicOutline(seg1, 1.02, 30);

      // Segment 2: Arching middle feather blade (widest leaflet span)
      const seg2 = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.05, 1.45), frondMat);
      seg2.position.set(0, isUpper ? 0.66 : 0.42, 1.92);
      seg2.rotation.x = isUpper ? 0.06 : 0.18;
      seg2.castShadow = true;
      addComicOutline(seg2, 1.02, 30);

      // Segment 3: Gracefully drooping tapered frond tip
      const seg3 = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 1.25), frondMat);
      seg3.position.set(0, isUpper ? 0.34 : 0.05, 3.08);
      seg3.rotation.x = isUpper ? 0.52 : 0.64;
      seg3.castShadow = true;
      addComicOutline(seg3, 1.02, 30);

      frondPivot.add(seg1, seg2, seg3);
      crown.add(frondPivot);
    }

    crown.scale.setScalar(0.76);
    group.add(crown);

    // Stylized Dark Ground Shadow Blob
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.65, 12),
      new THREE.MeshBasicMaterial({
        color: 0x10081c,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.set(curX * 0.5, 0.03, curZ * 0.5);
    group.add(shadowDisc);

    this.scene.add(group);

    this.palmCrownMeshes.push({
      crown,
      phase: x * 0.19 + z * 0.27,
    });

    this.palmColliders.push({
      x,
      z,
      radius: 0.58 * scale,
      mesh: group,
      destructible: true,
    });

    return group;
  }

  createBoulevardTree(x, y = 0, z = 0, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);

    if (!this._sharedFoliageDarkMat) {
      const darkTex = this._createFoliageClusterTexture('#1f753b', '#38a852');
      const midTex = this._createFoliageClusterTexture('#298c46', '#4ec462');
      const brightTex = this._createFoliageClusterTexture('#38a654', '#6ee075');
      this._sharedFoliageDarkMat = this._createToonMaterial(0xffffff, { map: darkTex });
      this._sharedFoliageMidMat = this._createToonMaterial(0xffffff, { map: midTex });
      this._sharedFoliageBrightMat = this._createToonMaterial(0xffffff, { map: brightTex });
    }

    const barkMat = this._createToonMaterial(0x5c402c);
    const grateMat = this._createToonMaterial(0x232630);
    const curbRimMat = this._createToonMaterial(0xbeb6aa);

    // Sidewalk Square Tree Pit Curb Rim & Cast-Iron Grate (matching Reference Screenshot 2!)
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.10, 1.75), curbRimMat);
    rim.position.y = 0.05;
    addComicOutline(rim);
    group.add(rim);

    const grate = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.12, 1.48), grateMat);
    grate.position.y = 0.06;
    group.add(grate);

    // Sturdy Tapered Hardwood Trunk & Forked Branches
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.7, 7), barkMat);
    trunk.position.y = 1.35;
    trunk.castShadow = true;
    addComicOutline(trunk, 1.03, 35);
    group.add(trunk);

    for (let b = 0; b < 3; b++) {
      const ba = (b * Math.PI * 2) / 3 + 0.4;
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.15, 1.35, 6), barkMat);
      limb.position.set(Math.cos(ba) * 0.42, 2.65, Math.sin(ba) * 0.42);
      limb.rotation.z = -Math.cos(ba) * 0.52;
      limb.rotation.x = Math.sin(ba) * 0.52;
      addComicOutline(limb, 1.03, 35);
      group.add(limb);
    }

    // Multi-Clustered Graphic-Novel Leafy Canopy (5 sculpted low-poly puffs with comic outlines)
    const crown = new THREE.Group();
    crown.position.set(0, 3.35, 0);

    const clusters = [
      { x: 0.0, y: 0.55, z: 0.0, r: 1.42, sy: 0.78, mat: this._sharedFoliageBrightMat },
      { x: -0.82, y: 0.12, z: 0.52, r: 1.12, sy: 0.75, mat: this._sharedFoliageMidMat },
      { x: 0.85, y: 0.16, z: 0.46, r: 1.08, sy: 0.75, mat: this._sharedFoliageMidMat },
      { x: -0.45, y: 0.05, z: -0.78, r: 1.15, sy: 0.74, mat: this._sharedFoliageDarkMat },
      { x: 0.58, y: 0.08, z: -0.72, r: 1.05, sy: 0.74, mat: this._sharedFoliageDarkMat },
    ];

    for (const c of clusters) {
      const puffGeo = new THREE.DodecahedronGeometry(c.r, 1);
      puffGeo.scale(1.0, c.sy, 1.0);
      const puff = new THREE.Mesh(puffGeo, c.mat);
      puff.position.set(c.x, c.y, c.z);
      puff.castShadow = true;
      puff.receiveShadow = true;
      addComicOutline(puff, 1.03, 28);
      crown.add(puff);
    }

    crown.scale.setScalar(0.84);
    group.add(crown);

    // Ground Shadow Blob
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 12),
      new THREE.MeshBasicMaterial({
        color: 0x10081c,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.set(0, 0.03, 0);
    group.add(shadowDisc);

    this.scene.add(group);

    this.palmCrownMeshes.push({
      crown,
      phase: x * 0.23 + z * 0.31,
    });

    this.palmColliders.push({
      x,
      z,
      radius: 0.58 * scale,
      mesh: group,
      destructible: true,
    });

    return group;
  }

  _buildPalmTreesAndStreetlamps() {
    // 1. Line Ocean Drive Promenade & Sidewalks (Royal Palms on East Promenade x = 91.8, alternating Palms & Leafy Boulevard Trees on West Sidewalk x = 70.6)
    let treeIndex = 0;
    for (let z = -152; z <= 152; z += 16) {
      if (
        Math.abs(z) < 9 ||
        Math.abs(z - (-16)) < 10 ||
        Math.abs(z - (-45)) < 8 ||
        Math.abs(z - 45) < 8 ||
        Math.abs(z - (-90)) < 9 ||
        Math.abs(z - 95) < 9
      ) {
        continue;
      }
      const s1 = 0.88 + ((Math.abs(z * 7) % 10) * 0.02);
      this.createPalmTree(91.8, 0.12, z, s1);

      // Skip West sidewalk trees right in front of Argon Gas '86 (-48..-28) so the orange canopy is 100% unobstructed
      if (z < -52 || z > -26) {
        if (treeIndex % 2 === 0) {
          this.createBoulevardTree(70.8, 0.12, z + 4, 0.90);
        } else {
          this.createPalmTree(68.8, 0.12, z + 4, 0.88);
        }
      }
      treeIndex++;
    }

    // 2. Beach Sand Coconut Palms (x = 100..107)
    for (let z = -145; z <= 145; z += 20) {
      if (Math.abs(z - (-26)) < 10) continue; // Keep Seaplane Boardwalk approach clear
      this.createPalmTree(100.5 + (Math.abs(z) % 5), 0.0, z, 0.96);
    }

    // 3. Washington Ave Palms & Boulevard Shade Trees (x = 31.5 and x = 47.4)
    for (let z = -140; z <= 140; z += 22) {
      if (Math.abs(z) < 10 || Math.abs(z - (-90)) < 10 || Math.abs(z - 95) < 10) continue;
      this.createPalmTree(31.5, 0.12, z, 0.90);
      this.createBoulevardTree(47.4, 0.12, z + 8, 0.86);
    }

    // 4. Starfish Island Grand Palm Colonade & Mansion Grounds
    for (let x = -66; x <= 6; x += 16) {
      if (Math.abs(x - (-30)) > 11) {
        this.createPalmTree(x, 0.12, -10.5, 0.92);
        this.createPalmTree(x, 0.12, 10.5, 0.92);
      }
    }
    for (let z = -56; z <= 56; z += 18) {
      if (Math.abs(z) > 14) {
        this.createPalmTree(-19.5, 0.12, z, 0.90);
        this.createBoulevardTree(-40.5, 0.12, z, 0.88);
      }
    }

    // 5. Little Haiti & Argon Port Palms + Boulevard Trees (both sides of Little Haiti Blvd & Marina Promenade)
    for (let z = -148; z <= 136; z += 16) {
      if (Math.abs(z) < 10 || Math.abs(z - (-90)) < 10 || Math.abs(z - 95) < 10) continue;
      this.createPalmTree(-106.5, 0.12, z, 0.90);
      if (Math.abs(z) % 32 === 0) {
        this.createBoulevardTree(-123.2, 0.12, z + 6, 0.88);
      }
    }

    // 6. Argon Port Marina & Starfish Island Perimeter Palms
    for (let x = -64; x <= 6; x += 16) {
      this.createPalmTree(x, 0.12, -62, 0.92);
      this.createPalmTree(x, 0.12, 62, 0.92);
    }

    // --- TWIN-ARM 1980s DECO STREETLAMPS WITH WARM GROUND LIGHT POOLS ---
    const poleMat = this._createToonMaterial(0xd8d2dc);
    const poolTex = this._createRadialGlowTexture('rgba(255, 205, 125, 0.72)', 'rgba(255, 70, 160, 0)');

    const addStreetLamp = (x, z, rotY = 0) => {
      const lamp = new THREE.Group();
      lamp.position.set(x, 0, z);
      lamp.rotation.y = rotY;

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 6.8, 6), poleMat);
      pole.position.y = 3.4;
      addComicOutline(pole, 1.02, 35);
      lamp.add(pole);

      const crossArm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.14), poleMat);
      crossArm.position.y = 6.7;
      lamp.add(crossArm);

      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffdf99 });
      this.streetLampBulbs.push(bulbMat);

      for (const bx of [-1.2, 1.2]) {
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.35), bulbMat);
        head.position.set(bx, 6.62, 0);
        lamp.add(head);
      }

      // Warm circular light pool projected onto the asphalt/sidewalk
      const poolMat = new THREE.MeshBasicMaterial({
        map: poolTex,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.streetLampPools.push(poolMat);

      const poolDisc = new THREE.Mesh(new THREE.PlaneGeometry(13.0, 13.0), poolMat);
      poolDisc.rotation.x = -Math.PI / 2;
      poolDisc.position.y = 0.045;
      lamp.add(poolDisc);

      this.scene.add(lamp);
    };

    // Place Streetlamps along Ocean Drive, Washington Ave, Starfish Causeway & Little Haiti Blvd
    for (let z = -145; z <= 145; z += 28) {
      addStreetLamp(71.8, z, 0);
      addStreetLamp(88.2, z + 14, 0);
      addStreetLamp(31.8, z, 0);
      addStreetLamp(-106.8, z, 0);
    }
    for (let x = -90; x <= 30; x += 24) {
      addStreetLamp(x, -8.2, Math.PI / 2);
      addStreetLamp(x, 8.2, Math.PI / 2);
    }
  }

  // ============================================================================
  // 12. INTERACTABLE ZONES & PULSING 3D GROUND MARKERS
  // ============================================================================

  _buildInteractableMarkers() {
    const definitions = [
      {
        id: 'gas_ocean_beach',
        type: 'gas_station',
        x: 66,
        z: -38,
        radius: 4.8,
        label: "ARGON GAS '86 — CRAFT MOLOTOVS [E]",
        color: 0x00f0ff,
        district: 'OCEAN BEACH',
        data: { price: 100, yieldCount: 4 },
      },
      {
        id: 'safehouse_vercetti',
        type: 'safehouse',
        x: -30,
        z: -8,
        radius: 4.5,
        label: 'VERCETTI ESTATE SAFEHOUSE STASH [E]',
        color: 0x22ff88,
        district: 'STARFISH ISLAND',
        data: { heal: 100, clearHeat: true },
      },
      {
        id: 'safehouse_ocean_view',
        type: 'safehouse',
        x: 69.5,
        z: 22,
        radius: 3.8,
        label: 'OCEAN VIEW HOTEL SUITE [E]',
        color: 0x22ff88,
        district: 'OCEAN BEACH',
        data: { heal: 100, clearHeat: true },
      },
      {
        id: 'dumpster_haiti_1',
        type: 'dumpster',
        x: -124.5,
        z: -29,
        radius: 3.5,
        label: 'SEARCH ALLEY DUMPSTER [E]',
        color: 0xffe600,
        district: 'LITTLE HAITI',
        data: { lootTable: 'contraband_or_weapon' },
      },
      {
        id: 'dumpster_haiti_2',
        type: 'dumpster',
        x: -124.5,
        z: 4,
        radius: 3.5,
        label: 'SEARCH PRINT WORKS DUMPSTER [E]',
        color: 0xffe600,
        district: 'LITTLE HAITI',
        data: { lootTable: 'contraband_or_weapon' },
      },
      {
        id: 'dumpster_ocean_alley',
        type: 'dumpster',
        x: 52.5,
        z: 45,
        radius: 3.5,
        label: 'SEARCH BACK-ALLEY DUMPSTER [E]',
        color: 0xffe600,
        district: 'OCEAN BEACH',
        data: { lootTable: 'contraband_or_weapon' },
      },
      {
        id: 'beach_stash_north',
        type: 'beach_stash',
        x: 108,
        z: -28,
        radius: 3.6,
        label: 'SMUGGLER BEACH COOLER STASH [E]',
        color: 0xff2a85,
        district: 'OCEAN BEACH',
        data: { cashBonus: 500 },
      },
      {
        id: 'beach_stash_south',
        type: 'beach_stash',
        x: 110,
        z: 36,
        radius: 3.6,
        label: 'SURFER COOLER STASH [E]',
        color: 0xff2a85,
        district: 'OCEAN BEACH',
        data: { cashBonus: 650 },
      },
      {
        id: 'boat_dock_east',
        type: 'boat_dock',
        x: 15,
        z: 112,
        radius: 5.0,
        label: 'ARGON PORT MARINA PIER 1 — BOARD SPEEDBOAT [F]',
        color: 0x00f0ff,
        district: 'ARGON PORT MARINA',
        data: { spawnX: 23.5, spawnZ: 116 },
      },
      {
        id: 'boat_dock_west',
        type: 'boat_dock',
        x: -55,
        z: 115,
        radius: 5.0,
        label: 'YACHT CLUB PIER 2 — BOARD SPEEDBOAT [F]',
        color: 0x00f0ff,
        district: 'ARGON PORT MARINA',
        data: { spawnX: -46.5, spawnZ: 118 },
      },
      {
        id: 'rampage_ocean_drive',
        type: 'rampage',
        x: 86,
        z: -12,
        radius: 3.8,
        label: 'NEON RAMPAGE CHALLENGE [E]',
        color: 0xff3344,
        district: 'OCEAN BEACH',
        data: { targetKills: 12, duration: 45 },
      },
      {
        id: 'dealer_malibu',
        type: 'dealer',
        x: 70,
        z: -104,
        radius: 3.8,
        label: 'MALIBU CLUB CONTACT — TRADE STASH [E]',
        color: 0xb84dff,
        district: 'OCEAN BEACH',
        data: { specialty: 'Neon Dust', priceMultiplier: 1.35 },
      },
      {
        id: 'dealer_haiti',
        type: 'dealer',
        x: -124,
        z: -48,
        radius: 3.8,
        label: 'LITTLE HAITI CONTACT — TRADE STASH [E]',
        color: 0xb84dff,
        district: 'LITTLE HAITI',
        data: { specialty: 'island_herb', priceMultiplier: 0.78 },
      },
    ];

    for (const def of definitions) {
      const groundY = this.getGroundHeightAt(def.x, def.z);
      const markerGroup = new THREE.Group();
      markerGroup.position.set(def.x, groundY + 0.06, def.z);

      // Outer pulsing ring
      const ringGeo = new THREE.RingGeometry(def.radius * 0.62, def.radius * 0.82, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      markerGroup.add(ringMesh);

      // Floating rotating octahedron crystal chevron above marker
      const gemMat = new THREE.MeshBasicMaterial({
        color: def.color,
        wireframe: false,
      });
      const gemMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.68, 0), gemMat);
      gemMesh.position.y = 1.9;
      addComicOutline(gemMesh);
      markerGroup.add(gemMesh);

      // Beach cooler prop if type === 'beach_stash'
      if (def.type === 'beach_stash') {
        const cooler = new THREE.Mesh(
          new THREE.BoxGeometry(1.15, 0.75, 0.75),
          this._createToonMaterial(0xff2a85)
        );
        cooler.position.y = 0.38;
        addComicOutline(cooler);
        markerGroup.add(cooler);
      }

      this.scene.add(markerGroup);

      const entry = {
        ...def,
        y: groundY,
        mesh: markerGroup,
      };
      this.interactables.push(entry);
      this.interactableVisuals.push({ ringMesh, ringMat, gemMesh, baseRadius: def.radius });
    }
  }

  // ============================================================================
  // 13. WEATHER PARTICLES (NEON RAIN STREAKS)
  // ============================================================================

  _buildWeatherParticles() {
    const count = 900;
    const positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const rx = (Math.random() - 0.5) * 90;
      const ry = Math.random() * 42;
      const rz = (Math.random() - 0.5) * 90;
      const idx = i * 6;
      positions[idx] = rx;
      positions[idx + 1] = ry;
      positions[idx + 2] = rz;
      positions[idx + 3] = rx - 0.4;
      positions[idx + 4] = ry - 2.2;
      positions[idx + 5] = rz - 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0x99f6ff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.rainSystem = new THREE.LineSegments(geo, this.rainMat);
    this.rainSystem.frustumCulled = false;
    this.scene.add(this.rainSystem);
  }

  // ============================================================================
  // 14. DAY/NIGHT & WEATHER CYCLE CONTROLS
  // ============================================================================

  setTimeOfDay(hours) {
    this.timeOfDay = ((Number(hours) % 24) + 24) % 24;
    const h = this.timeOfDay;

    // Compute smooth factors for Day (10..15), Sunset/Dawn (16..19.5 & 5.5..8), Night (20..5)
    let nightFactor = 0.0;
    if (h >= 19.5) nightFactor = Math.min(1.0, (h - 19.5) / 1.8);
    else if (h <= 5.5) nightFactor = Math.min(1.0, (5.5 - h) / 1.8);
    else if (h > 17.5) nightFactor = (h - 17.5) * 0.25;

    let sunsetFactor = 0.0;
    if (h >= 15.0 && h <= 19.5) {
      sunsetFactor = 1.0 - Math.abs(h - 17.0) / 2.5;
    } else if (h >= 5.5 && h <= 8.5) {
      sunsetFactor = 1.0 - Math.abs(h - 7.0) / 1.5;
    }
    sunsetFactor = THREE.MathUtils.clamp(sunsetFactor, 0.0, 1.0);

    // Sky Dome Palette Interpolation
    const dayTop = new THREE.Color(0x0088e8);
    const dayMid = new THREE.Color(0x52d6f4);
    const dayHor = new THREE.Color(0xcff8ff);

    const sunTop = new THREE.Color(0x1f0b3d);
    const sunMid = new THREE.Color(0xc92478);
    const sunHor = new THREE.Color(0xff9248);

    const nightTop = new THREE.Color(0x070414);
    const nightMid = new THREE.Color(0x1c0d3b);
    const nightHor = new THREE.Color(0x4a154b);

    const topCol = dayTop.clone().lerp(sunTop, sunsetFactor).lerp(nightTop, nightFactor);
    const midCol = dayMid.clone().lerp(sunMid, sunsetFactor).lerp(nightMid, nightFactor);
    const horCol = dayHor.clone().lerp(sunHor, sunsetFactor).lerp(nightHor, nightFactor);

    this.skyUniforms.uTopColor.value.copy(topCol);
    this.skyUniforms.uMidColor.value.copy(midCol);
    this.skyUniforms.uHorizonColor.value.copy(horCol);
    this.skyUniforms.uNightFactor.value = nightFactor;

    // Scene Fog & Background
    this.scene.background.copy(midCol);
    this.scene.fog.color.copy(midCol);

    // Sun / Moon Angle & Color (keep strong graphic-novel readability even at night!)
    const sunAngle = ((h - 6.0) / 24.0) * Math.PI * 2;
    const sunElev = Math.max(0.28, Math.sin(sunAngle));
    const sunHoriz = Math.cos(sunAngle);
    this.skyUniforms.uSunDir.value.set(sunHoriz, Math.sin(sunAngle) * 0.55 + 0.15, -0.35).normalize();

    this.sunLight.color.setHex(
      nightFactor > 0.6 ? 0x9ab8ff : sunsetFactor > 0.4 ? 0xffb278 : 0xfff8eb
    );
    this.sunLight.intensity = THREE.MathUtils.lerp(2.15, 1.32, nightFactor * 0.65);
    this.hemiLight.intensity = THREE.MathUtils.lerp(1.15, 0.90, nightFactor);

    // Modulate Neon Signs, Windows, Streetlamp Ground Pools & Hero PointLights (NEVER toggle .visible!)
    const neonGlow = THREE.MathUtils.clamp(sunsetFactor * 0.85 + nightFactor * 1.15, 0.25, 1.25);
    for (const wm of this.windowMaterials) {
      wm.emissiveIntensity = neonGlow * 0.9;
    }
    const poolOpacity = THREE.MathUtils.clamp(sunsetFactor * 0.72 + nightFactor * 0.95, 0.12, 0.95);
    for (const pm of this.streetLampPools) {
      pm.opacity = poolOpacity;
    }
    for (const pl of this.accentPointLights) {
      pl.light.intensity = pl.baseIntensity * neonGlow;
    }

    // Water & Post-processing Uniforms
    this.waterUniforms.uSunsetFactor.value = sunsetFactor;
    this.waterUniforms.uNightFactor.value = nightFactor;
    this.postMaterial.uniforms.uSunsetFactor.value = sunsetFactor;
    this.postMaterial.uniforms.uNightFactor.value = nightFactor;

    const heatHaze = this.weather === 'heatwave' ? 0.65 : (1.0 - nightFactor) * 0.24;
    this.postMaterial.uniforms.uHeatHaze.value = heatHaze;

    // Store current sun offset vector for shadow-following in updateCamera
    this._sunOffset = new THREE.Vector3(sunHoriz * 85, sunElev * 95 + 35, -45);
  }

  getTimeOfDay() {
    return this.timeOfDay;
  }

  setWeather(mode = 'clear') {
    this.weather = mode;
    if (mode === 'neon_rain') {
      this.rainMat.opacity = 0.58;
      this.postMaterial.uniforms.uRainFactor.value = 1.0;
      this.postMaterial.uniforms.uHeatHaze.value = 0.05;
      this.scene.fog.density = 0.0032;
    } else if (mode === 'heatwave') {
      this.rainMat.opacity = 0.0;
      this.postMaterial.uniforms.uRainFactor.value = 0.0;
      this.postMaterial.uniforms.uHeatHaze.value = 0.68;
      this.scene.fog.density = 0.0024;
    } else {
      this.rainMat.opacity = 0.0;
      this.postMaterial.uniforms.uRainFactor.value = 0.0;
      this.postMaterial.uniforms.uHeatHaze.value = 0.22;
      this.scene.fog.density = 0.0018;
    }
  }

  getWeather() {
    return this.weather;
  }

  setCameraMode(mode) {
    if (['chinatown_high', 'cinematic_angled', 'street_chase'].includes(mode)) {
      this.cameraMode = mode;
    }
    return this.cameraMode;
  }

  cycleCameraMode() {
    const modes = ['chinatown_high', 'cinematic_angled', 'street_chase'];
    const idx = (modes.indexOf(this.cameraMode) + 1) % modes.length;
    this.cameraMode = modes[idx];
    return this.cameraMode;
  }

  addCameraShake(intensity = 0.5) {
    this.cameraShakeAmount = Math.min(2.5, this.cameraShakeAmount + Number(intensity || 0));
  }

  // ============================================================================
  // 15. DYNAMIC GRAND THEFT ARGON 3D TRACKING CAMERA
  // ============================================================================

  updateCamera(dt, targetState = {}) {
    const clampedDt = Math.min(0.1, Math.max(0.001, dt || 0.016));

    // Extract target position & velocity safely
    const pos = targetState.position || this.cameraFocus;
    const tx = pos.x !== undefined ? pos.x : 80;
    const ty = pos.y !== undefined ? pos.y : 0;
    const tz = pos.z !== undefined ? pos.z : 12;

    const vel = targetState.velocity || { x: 0, y: 0, z: 0 };
    const vx = vel.x || 0;
    const vz = vel.z || 0;
    const speed = Math.hypot(vx, vz);

    const isCombat = Boolean(targetState.isCombat);
    const driftFactor = Number(targetState.driftFactor || 0);
    const heading = targetState.heading !== undefined ? targetState.heading : Math.atan2(vx, vz);

    // 1. Velocity Look-Ahead Pan (pans ahead in driving direction up to 6.0m)
    const maxLookAhead = 6.0;
    const desiredLookX = (vx / Math.max(12, speed)) * Math.min(maxLookAhead, speed * 0.26);
    const desiredLookZ = (vz / Math.max(12, speed)) * Math.min(maxLookAhead, speed * 0.26);

    this.cameraLookAhead.x = THREE.MathUtils.lerp(this.cameraLookAhead.x, desiredLookX, clampedDt * 4.2);
    this.cameraLookAhead.z = THREE.MathUtils.lerp(this.cameraLookAhead.z, desiredLookZ, clampedDt * 4.2);

    if (Math.hypot(tx - this.cameraFocus.x, tz - this.cameraFocus.z) > 95.0) {
      this.cameraFocus.set(tx + this.cameraLookAhead.x, ty + 0.8, tz + this.cameraLookAhead.z);
    } else {
      this.cameraFocus.x = THREE.MathUtils.lerp(this.cameraFocus.x, tx + this.cameraLookAhead.x, clampedDt * 7.5);
      this.cameraFocus.y = THREE.MathUtils.lerp(this.cameraFocus.y, ty + 0.8, clampedDt * 7.5);
      this.cameraFocus.z = THREE.MathUtils.lerp(this.cameraFocus.z, tz + this.cameraLookAhead.z, clampedDt * 7.5);
    }

    // 2. Dynamic Height Zoom (Combat ~22m, Standard ~25m, High-Speed Driving ~32-36m)
    let targetHeight = 25.0;
    let zBackOffset = 12.8; // ~63 deg oblique Grand Theft Argon pitch!

    if (this.cameraMode === 'chinatown_high') {
      if (isCombat && speed < 5) {
        targetHeight = 21.5;
        zBackOffset = 11.2;
      } else {
        targetHeight = THREE.MathUtils.clamp(24.5 + speed * 0.36, 24.5, 35.5);
        zBackOffset = targetHeight * 0.52; // ~62.5° high-angle Grand Theft Argon oblique pitch!
      }
    } else if (this.cameraMode === 'cinematic_angled') {
      targetHeight = THREE.MathUtils.clamp(19.0 + speed * 0.30, 18.0, 28.0);
      zBackOffset = targetHeight * 0.76; // ~52° angled view
    } else if (this.cameraMode === 'street_chase') {
      targetHeight = THREE.MathUtils.clamp(8.5 + speed * 0.14, 8.0, 13.5);
      zBackOffset = targetHeight * 1.45;
    }

    // Flight & Stunt Air Follow: smoothly expand camera height & pullback when airborne or piloting aircraft
    const altitude = Math.max(0, Number(targetState.position?.y || 0));
    const isAircraft = Boolean(targetState.isAircraft);
    if (isAircraft || altitude > 1.8) {
      targetHeight += Math.min(26, altitude * 0.95);
      zBackOffset += Math.min(18, altitude * 0.55);
    }

    this.currentZoomHeight = THREE.MathUtils.lerp(this.currentZoomHeight, targetHeight, clampedDt * 4.5);

    // 3. Oblique Grand Theft Argon Diagonal Yaw (-0.50 rad = ~29° diagonal street orientation!)
    // With desiredYaw ≈ -0.50, camOffsetX = -sin(-0.50) * zBackOffset = +0.48 * zBackOffset (Southeast of target),
    // looking Northwest (-X, -Z) so the West-side Art Deco facades & Argon Gas '86 canopy are in full 3D view
    // and the camera NEVER sits over the West-side building roofs!
    const baseObliqueYaw =
      this.cameraYawOverride !== undefined ? this.cameraYawOverride : -0.50;
    let desiredYaw = baseObliqueYaw;
    if (this.cameraMode === 'street_chase' && speed > 1.5) {
      desiredYaw = heading;
    } else {
      desiredYaw =
        baseObliqueYaw +
        THREE.MathUtils.clamp(-vx * 0.007 + driftFactor * 0.12, -0.18, 0.18);
    }
    this.currentHeadingYaw = THREE.MathUtils.lerp(this.currentHeadingYaw, desiredYaw, clampedDt * 4.5);

    const camOffsetX = -Math.sin(this.currentHeadingYaw) * zBackOffset;
    const camOffsetZ = Math.cos(this.currentHeadingYaw) * zBackOffset;

    const desiredCamX = this.cameraFocus.x + camOffsetX;
    const desiredCamY = this.cameraFocus.y + this.currentZoomHeight;
    const desiredCamZ = this.cameraFocus.z + camOffsetZ;

    if (Math.hypot(desiredCamX - this.cameraCurrentPos.x, desiredCamZ - this.cameraCurrentPos.z) > 95.0) {
      this.currentZoomHeight = targetHeight;
      this.cameraCurrentPos.set(desiredCamX, this.cameraFocus.y + targetHeight, desiredCamZ);
    } else {
      this.cameraCurrentPos.x = THREE.MathUtils.lerp(this.cameraCurrentPos.x, desiredCamX, clampedDt * 8.5);
      this.cameraCurrentPos.y = THREE.MathUtils.lerp(this.cameraCurrentPos.y, desiredCamY, clampedDt * 8.5);
      this.cameraCurrentPos.z = THREE.MathUtils.lerp(this.cameraCurrentPos.z, desiredCamZ, clampedDt * 8.5);
    }

    // 4. Trauma Camera Shake (Explosions, Cop Takedowns, Collisions)
    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;
    if (this.cameraShakeAmount > 0.005) {
      this.cameraShakeTime += clampedDt * 38.0;
      const s = this.cameraShakeAmount;
      shakeX = Math.sin(this.cameraShakeTime * 1.7) * s * 0.85;
      shakeY = Math.cos(this.cameraShakeTime * 2.3) * s * 0.55;
      shakeZ = Math.sin(this.cameraShakeTime * 2.9) * s * 0.85;
      this.cameraShakeAmount = Math.max(0, this.cameraShakeAmount - clampedDt * 2.6);
    }

    this.camera.position.set(
      this.cameraCurrentPos.x + shakeX,
      this.cameraCurrentPos.y + shakeY,
      this.cameraCurrentPos.z + shakeZ
    );
    this.camera.lookAt(this.cameraFocus.x, this.cameraFocus.y, this.cameraFocus.z);

    // Apply subtle high-speed drift roll
    this.currentDriftRoll = THREE.MathUtils.lerp(
      this.currentDriftRoll,
      THREE.MathUtils.clamp(driftFactor * 0.045, -0.06, 0.06),
      clampedDt * 6.0
    );
    this.camera.rotation.z += this.currentDriftRoll;

    // Keep Sky Dome, Infinite Ocean Water Plane & Rain centered on CameraFocus, and snap Sun Shadow Frustum
    this.skyDome.position.set(this.cameraFocus.x, 0, this.cameraFocus.z);
    if (this.waterUniforms && this.waterUniforms.uCameraXZ) {
      this.waterUniforms.uCameraXZ.value.set(this.cameraFocus.x, this.cameraFocus.z);
    }
    if (this.waterMesh) {
      const waterSnapX = Math.round(this.cameraFocus.x / 16.0) * 16.0;
      const waterSnapZ = Math.round(this.cameraFocus.z / 16.0) * 16.0;
      this.waterMesh.position.set(waterSnapX, -0.25, waterSnapZ);
    }
    if (this.rainSystem) {
      this.rainSystem.position.set(
        this.cameraFocus.x,
        (this.elapsedTime * -28.0) % 18.0,
        this.cameraFocus.z
      );
    }
    if (this._sunOffset) {
      const snapX = Math.round(this.cameraFocus.x * 0.5) * 2.0;
      const snapZ = Math.round(this.cameraFocus.z * 0.5) * 2.0;
      this.sunLight.target.position.set(snapX, 0, snapZ);
      this.sunLight.position.set(
        snapX + this._sunOffset.x,
        this._sunOffset.y,
        snapZ + this._sunOffset.z
      );
    }
  }

  // ============================================================================
  // 16. WORLD UPDATE & RENDER PIPELINE
  // ============================================================================

  update(dt, targetState = {}) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt || 0.016));
    this.elapsedTime += safeDt;

    // Stream Minecraft-style Infinite Procedural World Chunks around player
    const pos = targetState.position || this.cameraFocus;
    const tx = pos && pos.x !== undefined ? pos.x : 80;
    const tz = pos && pos.z !== undefined ? pos.z : -26;
    this.updateInfiniteChunks(tx, tz);

    // Update Shader Time Uniforms
    this.waterUniforms.uTime.value = this.elapsedTime;
    this.skyUniforms.uTime.value = this.elapsedTime;
    this.postMaterial.uniforms.uTime.value = this.elapsedTime;

    // Sway 130+ Royal Palm Tree Crowns organically in the tropical wind
    const windTime = this.elapsedTime * 2.2;
    const windBonus = this.weather === 'neon_rain' ? 1.75 : 1.0;
    for (let i = 0; i < this.palmCrownMeshes.length; i++) {
      const p = this.palmCrownMeshes[i];
      p.crown.rotation.z = Math.sin(windTime + p.phase) * 0.065 * windBonus;
      p.crown.rotation.x = Math.cos(windTime * 0.8 + p.phase) * 0.048 * windBonus;
    }

    // Animate Lighthouse Searchlight Beam, Airport Aerodrome Beacon, Windsock & Landmark Props
    if (this.lighthouseBeam) {
      this.lighthouseBeam.rotation.y = this.elapsedTime * 0.85;
    }
    if (this.aerodromeBeacon) {
      this.aerodromeBeacon.rotation.y = -this.elapsedTime * 1.65;
    }
    if (this.airportWindsock) {
      this.airportWindsock.rotation.y = Math.sin(this.elapsedTime * 1.9) * 0.35;
      this.airportWindsock.rotation.z = Math.sin(this.elapsedTime * 4.2) * 0.08 * windBonus;
    }
    for (let i = 0; i < this.animatedLandmarkProps.length; i++) {
      const ap = this.animatedLandmarkProps[i];
      if (!ap || !ap.mesh) continue;
      if (ap.type === 'spin_y') {
        ap.mesh.rotation.y = this.elapsedTime * (ap.speed || 1.0);
      } else if (ap.type === 'bob_y') {
        ap.mesh.position.y =
          (ap.baseY || 0) + Math.sin(this.elapsedTime * (ap.speed || 2.0) + i) * (ap.amp || 0.12);
      }
    }

    // Pulse & Rotate Interactable Ground Rings & Floating Crystals
    for (let i = 0; i < this.interactableVisuals.length; i++) {
      const iv = this.interactableVisuals[i];
      const pulse = 1.0 + 0.14 * Math.sin(this.elapsedTime * 3.8 + i);
      iv.ringMesh.scale.setScalar(pulse);
      iv.ringMat.opacity = 0.58 + 0.28 * Math.sin(this.elapsedTime * 4.5 + i);
      iv.gemMesh.rotation.y = this.elapsedTime * 2.4 + i;
      iv.gemMesh.position.y = 1.85 + Math.sin(this.elapsedTime * 3.2 + i) * 0.28;
    }

    // Update Water Wake Foam Ripples
    for (let i = 0; i < this.waterWakes.length; i++) {
      const w = this.waterWakes[i];
      if (!w.active) continue;
      w.age += safeDt;
      if (w.age >= w.maxAge) {
        w.active = false;
        w.mat.opacity = 0.0;
      } else {
        const progress = w.age / w.maxAge;
        w.mesh.position.x += w.vx * safeDt;
        w.mesh.position.z += w.vz * safeDt;
        w.mesh.scale.setScalar(0.65 + progress * 2.35);
        w.mat.opacity = (1.0 - progress) * 0.78;
      }
    }

    // Update Tracking Camera
    this.updateCamera(safeDt, targetState);
  }

  render() {
    if (!this.renderer) return;

    // Pass 1: Render 3D Scene + Depth into offscreen WebGLRenderTarget (samples: 0)
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // Pass 2: Fullscreen Sobel Comic-Outline & Argon City Cel-Shading LUT Quad
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }

  resize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderTarget.setSize(w, h);
    this.postMaterial.uniforms.uResolution.value.set(w, h);
  }

  // ============================================================================
  // 16B. SEEDED PROCEDURAL CITY GENERATOR (DOWNTOWN METROPOLIS VS. SUBURBS)
  // ============================================================================

  _mulberry32(seed) {
    let a = (Number(seed) >>> 0) || 1986;
    return () => {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  _isProceduralParcelClear(x, z, w, d, pad = 1.2) {
    const minX = x - w * 0.5 - pad;
    const maxX = x + w * 0.5 + pad;
    const minZ = z - d * 0.5 - pad;
    const maxZ = z + d * 0.5 + pad;

    // 1. Keep all N-S arteries (x = 80, 40, -115, -152, and Starfish -30) 100% clear
    const nsRoads = [
      { x: 80, halfW: 9.8, zMin: -170, zMax: 170 },
      { x: 40, halfW: 9.6, zMin: -170, zMax: 170 },
      { x: -30, halfW: 8.6, zMin: -64, zMax: 64 },
      { x: -115, halfW: 9.6, zMin: -170, zMax: 170 },
      { x: -152, halfW: 5.8, zMin: -150, zMax: 155 },
    ];
    for (const r of nsRoads) {
      if (maxZ > r.zMin && minZ < r.zMax && maxX > r.x - r.halfW && minX < r.x + r.halfW) {
        return false;
      }
    }

    // 2. Keep all E-W cross-streets & bridge causeways (z = -135, -90, -45, 0, 45, 95, 140) 100% clear
    const ewRoads = [
      { z: -135, halfD: 6.4, xMin: 38, xMax: 84 },
      { z: -135, halfD: 6.4, xMin: -154, xMax: -113 },
      { z: -90, halfD: 8.4, xMin: -156, xMax: 86 },
      { z: -45, halfD: 6.4, xMin: 38, xMax: 84 },
      { z: -45, halfD: 6.4, xMin: -154, xMax: -113 },
      { z: 0, halfD: 8.8, xMin: -156, xMax: 86 },
      { z: 45, halfD: 6.4, xMin: 38, xMax: 84 },
      { z: 45, halfD: 6.4, xMin: -154, xMax: -113 },
      { z: 95, halfD: 8.8, xMin: -156, xMax: 86 },
      { z: 140, halfD: 6.4, xMin: 38, xMax: 84 },
    ];
    for (const r of ewRoads) {
      if (maxX > r.xMin && minX < r.xMax && maxZ > r.z - r.halfD && minZ < r.z + r.halfD) {
        return false;
      }
    }

    // 3. Keep Argon Gas '86 forecourt (x: 52..72, z: -48..-28) & Escobar Airport Runway (x < -138, z > 55) 100% clear
    if (maxX > 51.5 && minX < 72.5 && maxZ > -48.5 && minZ < -27.5) {
      return false;
    }
    if (minX < -138.0 && maxZ > 55.0) {
      return false;
    }

    // 4. Keep existing static & already-placed procedural building colliders clear
    for (let i = 0; i < this.buildingColliders.length; i++) {
      const b = this.buildingColliders[i];
      if (maxX > b.minX && minX < b.maxX && maxZ > b.minZ && minZ < b.maxZ) {
        return false;
      }
    }

    return true;
  }

  _createProceduralSkyscraper(parcel, rand, idx, targetChunk = null) {
    const { x, z, baseW, baseD, facesEast } = parcel;
    const w = baseW * (0.90 + rand() * 0.16);
    const d = baseD * (0.88 + rand() * 0.16);
    const h = Math.round((18.0 + rand() * 18.0) * 10) / 10; // 18.0m .. 36.0m
    const archetype = Math.floor(rand() * 3); // 0: Stepped Ziggurat, 1: Corporate Neon Finance, 2: Art Deco High-Rise Condos

    const palettes = [
      { primary: 0x9cf0ff, secondary: 0xff2a85, neon1: 0x00f0ff, neon2: 0xff2a85, bg: '#161b33' },
      { primary: 0xffe6b8, secondary: 0x00e5ff, neon1: 0xffcc00, neon2: 0x00f0ff, bg: '#1f1830' },
      { primary: 0xe2c4ff, secondary: 0x48f2d2, neon1: 0xff00aa, neon2: 0x00f0ff, bg: '#1a1230' },
      { primary: 0xbaf7e8, secondary: 0xff66a3, neon1: 0x00f0ff, neon2: 0xff55aa, bg: '#142234' },
      { primary: 0xffcce0, secondary: 0x70d8ff, neon1: 0xff2a85, neon2: 0xffee33, bg: '#22142e' },
      { primary: 0xd0e4ff, secondary: 0xff884d, neon1: 0x00f0ff, neon2: 0xffaa22, bg: '#141d34' },
    ];
    const pal = palettes[Math.floor(rand() * palettes.length)];
    const signNames = [
      'ARGON CORP',
      'PACIFIC BANK',
      "POLYBIUS '86",
      'NEON TOWERS',
      'OCEANIC PLAZA',
      'BISCAYNE TECH',
      'SUNSET MEDIA',
      'MIAMI TRUST',
      'SYNTH CORP',
      'ATLANTIC HQ',
    ];
    const signText = signNames[(idx + Math.floor(rand() * signNames.length)) % signNames.length];

    const hexPrimary = '#' + new THREE.Color(pal.primary).getHexString();
    const hexNeon1 = '#' + new THREE.Color(pal.neon1).getHexString();
    const hexNeon2 = '#' + new THREE.Color(pal.neon2).getHexString();

    const group = new THREE.Group();
    if (targetChunk) {
      group.position.set(x - targetChunk.wx, 0, z - targetChunk.wz);
    } else {
      group.position.set(x, 0, z);
    }

    const rows = Math.max(6, Math.floor(h / 2.8));
    const cols = Math.max(3, Math.round(Math.max(w, d) / 3.2));
    const winTex = this._createWindowGridTexture(pal.bg, hexNeon1, hexNeon2, cols, rows, hexPrimary);

    const baseMat = this._createToonMaterial(pal.primary);
    const tierMat = this._createToonMaterial(pal.secondary);
    const steelMat = this._createToonMaterial(0xd8e0ec);
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: winTex,
      emissive: new THREE.Color(pal.neon1),
      emissiveMap: winTex,
      emissiveIntensity: 0.58,
      roughness: 0.38,
    });
    this.windowMaterials.push(winMat);
    if (targetChunk) {
      targetChunk.windowMaterials.push(winMat);
    } else {
      this.proceduralWindowMaterials.push(winMat);
    }

    const neonMat1 = new THREE.MeshBasicMaterial({ color: pal.neon1 });
    const neonMat2 = new THREE.MeshBasicMaterial({ color: pal.neon2 });
    this.neonMaterials.push(neonMat1, neonMat2);
    if (targetChunk) {
      targetChunk.neonMaterials.push(neonMat1, neonMat2);
    } else {
      this.proceduralNeonMaterials.push(neonMat1, neonMat2);
    }

    let totalHeight = h;

    if (archetype === 0) {
      // ARCHETYPE 0: STEPPED GLASS ZIGGURAT TOWER (3 stepped tiers + neon crown trim + spire or helipad)
      const h1 = h * 0.56;
      const h2 = h * 0.26;
      const h3 = h * 0.18;

      const tier1 = new THREE.Mesh(new THREE.BoxGeometry(w, h1, d), [
        winMat, winMat, baseMat, baseMat, winMat, winMat,
      ]);
      tier1.position.y = h1 * 0.5;
      tier1.castShadow = true;
      tier1.receiveShadow = true;
      addComicOutline(tier1);
      group.add(tier1);

      const trim1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.32, d + 0.35), neonMat1);
      trim1.position.y = h1;
      group.add(trim1);

      const w2 = w * 0.78;
      const d2 = d * 0.78;
      const tier2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), [
        winMat, winMat, tierMat, tierMat, winMat, winMat,
      ]);
      tier2.position.y = h1 + h2 * 0.5;
      tier2.castShadow = true;
      addComicOutline(tier2);
      group.add(tier2);

      const trim2 = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.32, 0.28, d2 + 0.32), neonMat2);
      trim2.position.y = h1 + h2;
      group.add(trim2);

      const w3 = w * 0.54;
      const d3 = d * 0.54;
      const tier3 = new THREE.Mesh(new THREE.BoxGeometry(w3, h3, d3), [
        winMat, winMat, baseMat, baseMat, winMat, winMat,
      ]);
      tier3.position.y = h1 + h2 + h3 * 0.5;
      tier3.castShadow = true;
      addComicOutline(tier3);
      group.add(tier3);

      const trim3 = new THREE.Mesh(new THREE.BoxGeometry(w3 + 0.28, 0.26, d3 + 0.28), neonMat1);
      trim3.position.y = h;
      group.add(trim3);

      if (rand() > 0.45) {
        // Illuminated Spire & Aviation Beacon
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.48, 6.2, 6), steelMat);
        spire.position.y = h + 3.1;
        addComicOutline(spire);
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), neonMat2);
        beacon.position.y = h + 6.35;
        group.add(spire, beacon);
        totalHeight = h + 6.5;
      } else {
        // Rooftop Helipad 'H' Disc
        const padDisc = new THREE.Mesh(
          new THREE.CylinderGeometry(Math.min(w3, d3) * 0.42, Math.min(w3, d3) * 0.45, 0.14, 12),
          this._createToonMaterial(0x282d3c)
        );
        padDisc.position.y = h + 0.12;
        addComicOutline(padDisc);
        const hBar = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w3, d3) * 0.42, 0.06, 0.35), neonMat2);
        hBar.position.y = h + 0.22;
        group.add(padDisc, hBar);
      }
    } else if (archetype === 1) {
      // ARCHETYPE 1: CORPORATE NEON FINANCE TOWER (Vertical pilasters + glowing rooftop corporate sign banner)
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
        winMat, winMat, baseMat, baseMat, winMat, winMat,
      ]);
      body.position.y = h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      addComicOutline(body);
      group.add(body);

      this._addRooftopDetails(group, w, d, h, tierMat);

      // Vertical Fluted Steel/Concrete Pilasters on East & West Facades
      const frontDir = facesEast ? 1 : -1;
      for (const side of [-1, 1]) {
        const px = side * (w * 0.5 + 0.16);
        for (const zFrac of [-0.42, -0.14, 0.14, 0.42]) {
          const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.42, h + 0.4, 0.62), steelMat);
          pilaster.position.set(px, h * 0.5 + 0.2, d * zFrac);
          addComicOutline(pilaster);
          group.add(pilaster);
        }
      }

      // Glowing Rooftop Corporate Sign Banner
      const signTex = this._createNeonSignTexture(signText, '#100724', hexNeon1, hexNeon2, false);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex });
      this.neonMaterials.push(signMat);
      if (targetChunk) {
        targetChunk.neonMaterials.push(signMat);
      } else {
        this.proceduralNeonMaterials.push(signMat);
      }
      const bannerW = Math.max(5.5, d * 0.78);
      const banner = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.3, bannerW), signMat);
      banner.position.set(frontDir * (w * 0.5 - 0.35), h + 1.55, 0);
      addComicOutline(banner);
      group.add(banner);
      totalHeight = h + 2.8;
    } else {
      // ARCHETYPE 2: ART DECO HIGH-RISE CONDOS (Contrasting vertical bays + horizontal neon racing bands + HVAC chillers)
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
        winMat, winMat, baseMat, baseMat, winMat, winMat,
      ]);
      body.position.y = h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      addComicOutline(body);
      group.add(body);

      this._addRooftopDetails(group, w, d, h, tierMat);

      // Stepped Art Deco Penthouse Crown
      const penthouse = new THREE.Mesh(new THREE.BoxGeometry(w * 0.64, 3.4, d * 0.62), tierMat);
      penthouse.position.y = h + 1.7;
      penthouse.castShadow = true;
      addComicOutline(penthouse);
      group.add(penthouse);

      // Horizontal Neon Racing Bands & Balcony Eyebrows every 4.2m
      for (let by = 4.2; by < h - 1.5; by += 4.2) {
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.55, 0.28, d + 0.55), tierMat);
        ledge.position.y = by;
        addComicOutline(ledge);
        group.add(ledge);

        const neonBand = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.68, 0.16, d + 0.68),
          Math.floor(by / 4.2) % 2 === 0 ? neonMat1 : neonMat2
        );
        neonBand.position.y = by + 0.18;
        group.add(neonBand);
      }

      totalHeight = h + 3.4;
    }

    const towerName = `${signText} Tower`;
    if (targetChunk) {
      targetChunk.group.add(group);
      const col = {
        x,
        z,
        width: w,
        depth: d,
        minX: x - w * 0.5,
        maxX: x + w * 0.5,
        minZ: z - d * 0.5,
        maxZ: z + d * 0.5,
        height: totalHeight,
        name: towerName,
        district: targetChunk.biome,
        _chunkKey: targetChunk.key,
      };
      this.buildingColliders.push(col);
      targetChunk.colliders.push(col);
      const fp = {
        x,
        z,
        w,
        d,
        h: totalHeight,
        zone: 'downtown',
        archetype,
        name: towerName,
        color: hexPrimary,
        _chunkKey: targetChunk.key,
      };
      this.proceduralBlockFootprints.push(fp);
      targetChunk.footprints.push(fp);
    } else {
      this.proceduralCityGroup.add(group);
      this._registerCollider(x, z, w, d, totalHeight, towerName, 'DOWNTOWN METROPOLIS');
      this.proceduralBlockFootprints.push({
        x,
        z,
        w,
        d,
        h: totalHeight,
        zone: 'downtown',
        archetype,
        name: towerName,
        color: hexPrimary,
      });
    }
  }

  _createProceduralSuburbanHome(lot, rand, idx, targetChunk = null) {
    const { x, z, lotW = 12.5, lotD = 11.2, streetDirX = -1, streetDirZ = 0, district = 'PALM SPRINGS SUBURBS' } = lot;

    // 1. Seeded 1980s Florida Suburban Pastel Stucco & Roof Palettes
    const stuccoPalette = [
      { hex: '#b2dfdb', num: 0xb2dfdb }, // Mint
      { hex: '#ffccbc', num: 0xffccbc }, // Peach
      { hex: '#fff9c4', num: 0xfff9c4 }, // Butter yellow
      { hex: '#b3e5fc', num: 0xb3e5fc }, // Sky blue
      { hex: '#f8bbd0', num: 0xf8bbd0 }, // Coral pink
      { hex: '#e1bee7', num: 0xe1bee7 }, // Lavender
    ];
    const roofPalette = [
      0xd84315, // Terracotta tile
      0x5d4037, // Cedar shingle
      0x37474f, // Slate grey
    ];
    const turfColors = [0x2e7d32, 0x388e3c];

    const stucco = stuccoPalette[(idx + Math.floor(rand() * stuccoPalette.length)) % stuccoPalette.length];
    const roofHex = roofPalette[Math.floor(rand() * roofPalette.length)];
    const turfHex = turfColors[idx % turfColors.length];

    const houseW = 5.4 + rand() * 1.1; // 5.4m .. 6.5m
    const houseD = 5.6 + rand() * 1.1; // 5.6m .. 6.7m
    const houseH = Math.round((3.8 + rand() * 2.0) * 10) / 10; // 3.8m .. 5.8m

    const garageW = 3.6 + rand() * 0.5;
    const garageD = 4.6 + rand() * 0.5;
    const garageH = Math.min(houseH - 0.5, 3.3);
    const garageSide = rand() > 0.5 ? 1 : -1;

    const homeGroup = new THREE.Group();
    if (targetChunk) {
      homeGroup.position.set(x - targetChunk.wx, 0, z - targetChunk.wz);
    } else {
      homeGroup.position.set(x, 0, z);
    }

    // 2. Manicured Green Suburban Lawn Plot (#2e7d32 / #388e3c turf pad)
    const lawnMat = this._createToonMaterial(turfHex);
    const lawnPad = new THREE.Mesh(new THREE.BoxGeometry(lotW, 0.16, lotD), lawnMat);
    lawnPad.position.y = 0.08;
    lawnPad.receiveShadow = true;
    addComicOutline(lawnPad);
    homeGroup.add(lawnPad);

    // 3. Pastel Stucco House Body with Comic Outlines & Warm Lit Window Panes
    const winTex = this._createWindowGridTexture(
      '#241830',
      '#ffefc2',
      '#80f5ff',
      2,
      houseH > 4.8 ? 2 : 1,
      stucco.hex
    );
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: winTex,
      emissive: new THREE.Color(0xffdf99),
      emissiveMap: winTex,
      emissiveIntensity: 0.42,
      roughness: 0.65,
    });
    this.windowMaterials.push(wallMat);
    if (targetChunk) {
      targetChunk.windowMaterials.push(wallMat);
    } else {
      this.proceduralWindowMaterials.push(wallMat);
    }

    const stuccoMat = this._createToonMaterial(stucco.num);
    const roofMat = this._createToonMaterial(roofHex);
    const creamTrimMat = this._createToonMaterial(0xf7f4eb);
    const chimneyBrickMat = this._createToonMaterial(0x8d4034);
    const drivewayMat = this._createToonMaterial(0xcfc8be);

    const houseOffsetZ = -garageSide * 1.4;
    const body = new THREE.Mesh(new THREE.BoxGeometry(houseW, houseH, houseD), [
      wallMat, wallMat, stuccoMat, stuccoMat, wallMat, wallMat,
    ]);
    body.position.set(0, houseH * 0.5 + 0.12, houseOffsetZ);
    body.castShadow = true;
    body.receiveShadow = true;
    addComicOutline(body);
    homeGroup.add(body);

    // 4. Pitched Gable / Hip Roof (ConeGeometry rotated Math.PI / 4) + Brick Chimney
    const roofRadius = Math.max(houseW, houseD) * 0.78;
    const roofCone = new THREE.Mesh(new THREE.ConeGeometry(roofRadius, 2.2, 4), roofMat);
    roofCone.position.set(0, houseH + 1.18, houseOffsetZ);
    roofCone.rotation.y = Math.PI / 4;
    roofCone.castShadow = true;
    addComicOutline(roofCone);
    homeGroup.add(roofCone);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.78, 2.3, 0.78), chimneyBrickMat);
    chimney.position.set(-houseW * 0.26, houseH + 1.35, houseOffsetZ - houseD * 0.24);
    chimney.castShadow = true;
    addComicOutline(chimney);
    homeGroup.add(chimney);

    // 5. Attached Suburban Garage Wing with White/Cream Paneled Roll-Up Garage Door + Concrete Driveway Apron
    const garageZ = houseOffsetZ + garageSide * (houseD * 0.5 + garageD * 0.5 - 0.2);
    const garageX = streetDirX * 0.35;
    const garageMesh = new THREE.Mesh(new THREE.BoxGeometry(garageW, garageH, garageD), stuccoMat);
    garageMesh.position.set(garageX, garageH * 0.5 + 0.12, garageZ);
    garageMesh.castShadow = true;
    garageMesh.receiveShadow = true;
    addComicOutline(garageMesh);
    homeGroup.add(garageMesh);

    const garageRoof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(garageW, garageD) * 0.76, 1.45, 4),
      roofMat
    );
    garageRoof.position.set(garageX, garageH + 0.82, garageZ);
    garageRoof.rotation.y = Math.PI / 4;
    addComicOutline(garageRoof);
    homeGroup.add(garageRoof);

    // White/Cream Paneled Roll-Up Garage Door facing Street
    const doorDirX = streetDirX !== 0 ? streetDirX : 1;
    const garageDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, garageH * 0.76, garageD * 0.74),
      creamTrimMat
    );
    garageDoor.position.set(garageX + doorDirX * (garageW * 0.5 + 0.05), garageH * 0.42 + 0.12, garageZ);
    addComicOutline(garageDoor);
    homeGroup.add(garageDoor);

    // Concrete Driveway Apron leading from Garage Door toward the Street
    const apronLen = Math.max(2.6, (lotW * 0.5 - garageW * 0.5) + 0.8);
    const driveway = new THREE.Mesh(
      new THREE.BoxGeometry(apronLen, 0.08, garageD * 0.78),
      drivewayMat
    );
    driveway.position.set(
      garageX + doorDirX * (garageW * 0.5 + apronLen * 0.5 - 0.1),
      0.15,
      garageZ
    );
    driveway.receiveShadow = true;
    addComicOutline(driveway);
    homeGroup.add(driveway);

    // 6. Suburban Yard Details: Picket Fence / Hedge, Curbside Mailbox, Backyard Turquoise Pool (#00e5ff) & Shade Trees
    const fenceMat = rand() > 0.45 ? creamTrimMat : this._createToonMaterial(0x1f6e32);
    const fenceN = new THREE.Mesh(new THREE.BoxGeometry(lotW - 0.4, 0.78, 0.24), fenceMat);
    fenceN.position.set(0, 0.52, -lotD * 0.5 + 0.2);
    addComicOutline(fenceN);
    const fenceS = fenceN.clone();
    fenceS.position.set(0, 0.52, lotD * 0.5 - 0.2);
    homeGroup.add(fenceN, fenceS);

    // Curbside Mailbox on Post by Driveway
    const mbPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 1.05, 6),
      this._createToonMaterial(0x6d4c41)
    );
    const mbX = doorDirX * (lotW * 0.5 - 0.45);
    const mbZ = garageZ - garageSide * (garageD * 0.48);
    mbPost.position.set(mbX, 0.62, mbZ);
    const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.28), creamTrimMat);
    mbBox.position.set(mbX, 1.18, mbZ);
    addComicOutline(mbBox);
    const mbFlag = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.22, 0.08),
      this._createToonMaterial(0xff2a55)
    );
    mbFlag.position.set(mbX, 1.28, mbZ + 0.16);
    homeGroup.add(mbPost, mbBox, mbFlag);

    // Backyard Turquoise Swimming Pool (#00e5ff) or Patio Umbrella behind the house
    const backX = -doorDirX * (houseW * 0.5 + 1.55);
    if (Math.abs(backX) + 1.4 < lotW * 0.5) {
      const poolCoping = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 4.2), creamTrimMat);
      poolCoping.position.set(backX, 0.18, houseOffsetZ);
      addComicOutline(poolCoping);
      const poolWater = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.18, 3.6),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff })
      );
      poolWater.position.set(backX, 0.20, houseOffsetZ);
      homeGroup.add(poolCoping, poolWater);
    }

    // 1-2 Lush Suburban Shade Trees on the Yard Corner
    const treeCount = rand() > 0.4 ? 2 : 1;
    for (let t = 0; t < treeCount; t++) {
      const tx = (t === 0 ? doorDirX : -doorDirX) * (lotW * 0.36);
      const tz = houseOffsetZ - garageSide * (houseD * 0.38);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.22, 2.2, 6),
        this._createToonMaterial(0x5d4037)
      );
      trunk.position.set(tx, 1.2, tz);
      addComicOutline(trunk);
      const canopy = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.15, 1),
        this._createToonMaterial(0x43a047)
      );
      canopy.position.set(tx, 2.65, tz);
      canopy.castShadow = true;
      addComicOutline(canopy);
      homeGroup.add(trunk, canopy);
    }

    // Register solid AABB colliders for both Main House and Attached Garage so players/cars/NPCs never walk through
    const minFootX = Math.min(-houseW * 0.5, garageX - garageW * 0.5);
    const maxFootX = Math.max(houseW * 0.5, garageX + garageW * 0.5);
    const minFootZ = Math.min(houseOffsetZ - houseD * 0.5, garageZ - garageD * 0.5);
    const maxFootZ = Math.max(houseOffsetZ + houseD * 0.5, garageZ + garageD * 0.5);
    const totalW = maxFootX - minFootX;
    const totalD = maxFootZ - minFootZ;
    const centerFootX = x + (minFootX + maxFootX) * 0.5;
    const centerFootZ = z + (minFootZ + maxFootZ) * 0.5;

    const homeName = `Suburban Residence ${idx + 1}`;
    if (targetChunk) {
      targetChunk.group.add(homeGroup);
      const col = {
        x: centerFootX,
        z: centerFootZ,
        width: totalW,
        depth: totalD,
        minX: centerFootX - totalW * 0.5,
        maxX: centerFootX + totalW * 0.5,
        minZ: centerFootZ - totalD * 0.5,
        maxZ: centerFootZ + totalD * 0.5,
        height: houseH + 2.0,
        name: homeName,
        district: targetChunk.biome,
        _chunkKey: targetChunk.key,
      };
      this.buildingColliders.push(col);
      targetChunk.colliders.push(col);
      const fp = {
        x: centerFootX,
        z: centerFootZ,
        w: totalW,
        d: totalD,
        h: houseH + 2.0,
        zone: 'suburban',
        name: homeName,
        color: stucco.hex,
        _chunkKey: targetChunk.key,
      };
      this.proceduralBlockFootprints.push(fp);
      targetChunk.footprints.push(fp);
    } else {
      this.proceduralCityGroup.add(homeGroup);
      this._registerCollider(centerFootX, centerFootZ, totalW, totalD, houseH + 2.0, homeName, district);
      this.proceduralBlockFootprints.push({
        x: centerFootX,
        z: centerFootZ,
        w: totalW,
        d: totalD,
        h: houseH + 2.0,
        zone: 'suburban',
        name: homeName,
        color: stucco.hex,
      });
    }
  }

  regenerateProceduralCity(newSeed) {
    if (newSeed !== undefined && newSeed !== null && Number.isFinite(Number(newSeed)) && Number(newSeed) > 0) {
      this.citySeed = Math.floor(Number(newSeed));
    } else {
      this.citySeed = Math.floor(Math.random() * 900000) + 100000;
    }

    // Unload all active outer chunks first so their colliders/footprints/materials are cleanly removed
    if (this.activeChunks && this.activeChunks.size > 0) {
      for (const [key, chunk] of Array.from(this.activeChunks.entries())) {
        this._unloadChunk(key, chunk);
      }
      this.activeChunks.clear();
    }

    // Remove previous procedural materials from dynamic time-of-day arrays
    if (this.proceduralWindowMaterials && this.proceduralWindowMaterials.length > 0) {
      const procWinSet = new Set(this.proceduralWindowMaterials);
      this.windowMaterials = this.windowMaterials.filter((m) => !procWinSet.has(m));
      this.proceduralWindowMaterials = [];
    }
    if (this.proceduralNeonMaterials && this.proceduralNeonMaterials.length > 0) {
      const procNeonSet = new Set(this.proceduralNeonMaterials);
      this.neonMaterials = this.neonMaterials.filter((m) => !procNeonSet.has(m));
      this.proceduralNeonMaterials = [];
    }
    if (this.proceduralPalmMeshes && this.proceduralPalmMeshes.length > 0) {
      const procPalmSet = new Set(this.proceduralPalmMeshes);
      this.palmCrownMeshes = this.palmCrownMeshes.filter((p) => !procPalmSet.has(p));
      this.proceduralPalmMeshes = [];
    }

    // Dispose and clear previous procedural city meshes
    if (this.proceduralCityGroup) {
      this.proceduralCityGroup.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
        }
      });
      while (this.proceduralCityGroup.children.length > 0) {
        this.proceduralCityGroup.remove(this.proceduralCityGroup.children[0]);
      }
    }

    // Reset buildingColliders to static base and clear proceduralBlockFootprints
    this.buildingColliders = [...(this.staticBuildingColliders || [])];
    this.proceduralBlockFootprints = [];

    const rand = this._mulberry32(this.citySeed);

    // --- ZONE A: MAJOR CITY / DOWNTOWN METROPOLIS CANDIDATE PARCELS (12-16 Towering Skyscrapers) ---
    const downtownCandidates = [
      // Brickell / Downtown Waterfront Avenue (x in [18, 30], z < -12)
      { x: 23.0, z: -154.0, baseW: 9.0, baseD: 11.5, facesEast: true },
      { x: 23.0, z: -139.0, baseW: 9.0, baseD: 11.5, facesEast: true },
      { x: 23.0, z: -124.0, baseW: 9.0, baseD: 11.5, facesEast: true },
      { x: 23.0, z: -108.0, baseW: 9.0, baseD: 11.5, facesEast: true },
      { x: 23.0, z: -74.0, baseW: 9.0, baseD: 11.5, facesEast: true },
      { x: 23.0, z: -59.0, baseW: 9.0, baseD: 11.5, facesEast: true },
      { x: 23.0, z: -44.0, baseW: 9.0, baseD: 11.5, facesEast: true },
      { x: 23.0, z: -29.0, baseW: 9.0, baseD: 11.0, facesEast: true },
      { x: 23.0, z: -16.5, baseW: 9.0, baseD: 9.5, facesEast: true },
      // West Downtown Skyline Strip (x = -163.5, z < 50)
      { x: -163.5, z: -148.0, baseW: 6.8, baseD: 12.5, facesEast: true },
      { x: -163.5, z: -134.0, baseW: 6.8, baseD: 10.0, facesEast: true },
      { x: -163.5, z: -92.0, baseW: 6.8, baseD: 11.5, facesEast: true },
      { x: -163.5, z: -44.0, baseW: 6.8, baseD: 12.5, facesEast: true },
      { x: -163.5, z: 2.0, baseW: 6.8, baseD: 11.5, facesEast: true },
      { x: -163.5, z: 46.0, baseW: 6.8, baseD: 11.5, facesEast: true },
      // North-Central Commercial High-Rise Parcels
      { x: 48.0, z: -52.5, baseW: 7.2, baseD: 6.5, facesEast: false },
    ];

    const targetDowntownCount = 13 + Math.floor(rand() * 4); // 13..16 skyscrapers
    let downtownCount = 0;
    for (let i = 0; i < downtownCandidates.length; i++) {
      if (downtownCount >= targetDowntownCount) break;
      const cand = downtownCandidates[i];
      if (this._isProceduralParcelClear(cand.x, cand.z, cand.baseW, cand.baseD, 0.8)) {
        this._createProceduralSkyscraper(cand, rand, downtownCount);
        downtownCount++;
      }
    }

    // --- ZONE B: SUBURBAN NEIGHBORHOODS (PALM SPRINGS SUBURBS, BAYSHORE ESTATES & STARFISH SUBURBS: 18-24 Homes) ---
    const suburbanCandidates = [
      // Palm Springs Suburbs & West Bayshore Estates (x in [-98, -76])
      { x: -87.5, z: -154.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: -141.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: -124.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: -108.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: -74.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: -60.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: -44.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: -29.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: -16.0, lotW: 12.8, lotD: 10.4, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: 16.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: 30.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: 44.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: 58.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: -87.5, z: 73.0, lotW: 12.8, lotD: 10.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      // Starfish Island Suburban Estates
      { x: -54.0, z: -17.0, lotW: 11.8, lotD: 9.6, streetDirX: 1, district: 'STARFISH SUBURBS' },
      { x: -54.0, z: 14.2, lotW: 11.8, lotD: 9.6, streetDirX: 1, district: 'STARFISH SUBURBS' },
      { x: -54.0, z: 40.8, lotW: 11.8, lotD: 9.4, streetDirX: 1, district: 'STARFISH SUBURBS' },
      { x: -6.0, z: -17.0, lotW: 11.8, lotD: 9.6, streetDirX: -1, district: 'STARFISH SUBURBS' },
      { x: -6.0, z: 14.2, lotW: 11.8, lotD: 9.6, streetDirX: -1, district: 'STARFISH SUBURBS' },
      { x: -6.0, z: 40.8, lotW: 11.8, lotD: 9.4, streetDirX: -1, district: 'STARFISH SUBURBS' },
      { x: -41.5, z: 14.2, lotW: 9.6, lotD: 9.4, streetDirX: 1, district: 'STARFISH SUBURBS' },
      { x: -18.5, z: 14.2, lotW: 9.6, lotD: 9.4, streetDirX: -1, district: 'STARFISH SUBURBS' },
      // East Mainland Residential Avenues
      { x: 48.0, z: -34.8, lotW: 7.8, lotD: 8.2, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: 48.0, z: 35.5, lotW: 7.8, lotD: 8.2, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: 48.0, z: 83.5, lotW: 7.8, lotD: 7.8, streetDirX: -1, district: 'PALM SPRINGS SUBURBS' },
      { x: 61.0, z: 84.0, lotW: 11.2, lotD: 7.8, streetDirX: 1, district: 'PALM SPRINGS SUBURBS' },
    ];

    const targetSuburbanCount = 19 + Math.floor(rand() * 5); // 19..23 suburban homes
    let suburbanCount = 0;
    for (let i = 0; i < suburbanCandidates.length; i++) {
      if (suburbanCount >= targetSuburbanCount) break;
      const lot = suburbanCandidates[i];
      if (this._isProceduralParcelClear(lot.x, lot.z, lot.lotW * 0.72, lot.lotD * 0.78, 0.5)) {
        this._createProceduralSuburbanHome(lot, rand, suburbanCount);
        suburbanCount++;
      }
    }

    // Re-stream infinite outer chunks around current focus with the updated seed
    if (this.infiniteChunksGroup) {
      const fx = this.cameraFocus ? this.cameraFocus.x : 80;
      const fz = this.cameraFocus ? this.cameraFocus.z : -26;
      this.updateInfiniteChunks(fx, fz, true);
    }

    if (this.skyUniforms) {
      this.setTimeOfDay(this.timeOfDay);
    }

    return {
      seed: this.citySeed,
      downtownCount,
      suburbanCount,
      totalBlocks: this.proceduralBlockFootprints.length,
    };
  }

  getProceduralBlocks() {
    return this.proceduralBlockFootprints;
  }

  getCitySeed() {
    return this.citySeed;
  }

  // ============================================================================
  // 16C. MINECRAFT-STYLE INFINITE PROCEDURAL CHUNK STREAMING ENGINE
  // ============================================================================

  getPlayerChunkCoords(x = 0, z = 0) {
    const cs = this.chunkSize || 120;
    const half = cs * 0.5;
    return {
      cx: Math.floor((Number(x) + half) / cs),
      cz: Math.floor((Number(z) + half) / cs),
    };
  }

  _getChunkBiomeInfo(cx, cz) {
    if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1) {
      return { isCore: true, biome: 'CORE ARGON CITY', seed: this.citySeed || 198601 };
    }
    const baseSeed = Number(this.citySeed) || 198601;
    let h =
      (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ Math.imul(baseSeed, 83492791)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    const biomes = [
      'NEON METROPOLIS',
      'SUBURBAN PALMS',
      'OCEANFRONT KEYS',
      'TROPICAL ARCHIPELAGO',
    ];
    const biomeIdx = ((h >>> 8) + Math.abs(cx * 3 + cz * 5)) % 4;
    return {
      isCore: false,
      biome: biomes[biomeIdx],
      seed: h || 198601,
    };
  }

  _addChunkPalm(chunkGroup, chunkPalmList, lx, lz, height = 8.8, leanX = 0.25, leanZ = 0.1, phase = 0) {
    const palmGroup = new THREE.Group();
    palmGroup.position.set(lx, 0, lz);

    const trunkMat = this._createToonMaterial(0x8a6242);
    const frondMat = this._createToonMaterial(0x1f9e55, { side: THREE.DoubleSide });

    const segments = 4;
    const segH = height / segments;
    let curX = 0;
    let curZ = 0;
    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      const rBottom = THREE.MathUtils.lerp(0.32, 0.15, t);
      const rTop = THREE.MathUtils.lerp(0.32, 0.15, (s + 1) / segments);
      const segGeo = new THREE.CylinderGeometry(rTop, rBottom, segH + 0.08, 6);
      const segMesh = new THREE.Mesh(segGeo, trunkMat);
      const nextX = leanX * Math.pow((s + 1) / segments, 1.5);
      const nextZ = leanZ * Math.pow((s + 1) / segments, 1.5);
      segMesh.position.set((curX + nextX) * 0.5, s * segH + segH * 0.5, (curZ + nextZ) * 0.5);
      segMesh.rotation.z = -(nextX - curX) * 0.45;
      segMesh.rotation.x = (nextZ - curZ) * 0.45;
      addComicOutline(segMesh);
      palmGroup.add(segMesh);
      curX = nextX;
      curZ = nextZ;
    }

    const crownGroup = new THREE.Group();
    crownGroup.position.set(curX, height, curZ);
    const frondCount = 6;
    for (let f = 0; f < frondCount; f++) {
      const angle = (f / frondCount) * Math.PI * 2;
      const frondPivot = new THREE.Group();
      frondPivot.rotation.y = angle;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 2.75), frondMat);
      blade.position.set(0, -0.18, 1.35);
      blade.rotation.x = 0.36;
      addComicOutline(blade);
      frondPivot.add(blade);
      crownGroup.add(frondPivot);
    }
    palmGroup.add(crownGroup);
    chunkGroup.add(palmGroup);

    const entry = { crown: crownGroup, phase };
    this.palmCrownMeshes.push(entry);
    chunkPalmList.push(entry);
  }

  _addChunkStuntRamp(chunk, lx, lz, width, length, height, dirX, dirZ, id) {
    const rampGroup = new THREE.Group();
    rampGroup.position.set(lx, 0.02, lz);
    const yaw = Math.atan2(dirX, dirZ);
    rampGroup.rotation.y = yaw;

    const deckMat = this._createToonMaterial(0xffb800);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff2a85 });
    const railMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const slopeLen = Math.hypot(length, height);
    const pitch = Math.atan2(height, length);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.24, slopeLen), deckMat);
    deck.position.set(0, height * 0.5, 0);
    deck.rotation.x = -pitch;
    addComicOutline(deck);
    rampGroup.add(deck);

    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, slopeLen), railMat);
      rail.position.set(side * (width * 0.5 - 0.12), height * 0.5 + 0.14, 0);
      rail.rotation.x = -pitch;
      rampGroup.add(rail);
    }

    const support = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.88, height, 0.65),
      this._createToonMaterial(0x37474f)
    );
    support.position.set(0, height * 0.5, length * 0.44);
    addComicOutline(support);
    rampGroup.add(support);

    const chevron = new THREE.Mesh(new THREE.BoxGeometry(width * 0.65, 0.06, 1.2), stripeMat);
    chevron.position.set(0, height * 0.78 + 0.15, length * 0.26);
    chevron.rotation.x = -pitch;
    rampGroup.add(chevron);

    chunk.group.add(rampGroup);

    const rampObj = {
      id,
      x: chunk.wx + lx,
      z: chunk.wz + lz,
      width,
      length,
      height,
      baseY: 0.02,
      dirX,
      dirZ,
      _chunkKey: chunk.key,
    };
    this.stuntRamps.push(rampObj);
    chunk.stuntRamps.push(rampObj);
  }

  _generateChunk(cx, cz) {
    const cs = this.chunkSize || 120;
    const wx = cx * cs;
    const wz = cz * cs;
    const key = `${cx},${cz}`;
    const info = this._getChunkBiomeInfo(cx, cz);
    const rand = this._mulberry32(info.seed);

    const chunkGroup = new THREE.Group();
    chunkGroup.name = `InfiniteChunk_${cx}_${cz}`;
    chunkGroup.position.set(wx, 0, wz);

    const isSandyKey = info.biome === 'OCEANFRONT KEYS';
    const isArchipelago = info.biome === 'TROPICAL ARCHIPELAGO';
    const chunk = {
      key,
      cx,
      cz,
      wx,
      wz,
      centerX: wx,
      centerZ: wz,
      biome: info.biome,
      districtName: info.biome,
      seed: info.seed,
      landRect: isArchipelago
        ? { minX: wx - 22, maxX: wx + 22, minZ: wz - 22, maxZ: wz + 22 }
        : { minX: wx - 52, maxX: wx + 52, minZ: wz - 52, maxZ: wz + 52 },
      beachRect: isSandyKey
        ? { minX: wx - 55, maxX: wx + 55, minZ: wz - 55, maxZ: wz + 55 }
        : null,
      group: chunkGroup,
      colliders: [],
      footprints: [],
      roadLanes: [],
      stuntRamps: [],
      palmCrowns: [],
      windowMaterials: [],
      neonMaterials: [],
    };

    const seawallMat = this._createToonMaterial(0xcbd2db);
    const bridgeDeckMat = this._sharedBridgeDeckMat || this._createToonMaterial(0x9ca2ad);
    const bridgeRailMat = this._sharedBridgeRailMat || this._createToonMaterial(0xff80b0);
    const bridgePillarMat = this._sharedBridgePillarMat || this._createToonMaterial(0xe5ddd5);
    const roadTex = this._sharedRoadTex4 || this._createRoadTexture(4, true);
    const roadMat = new THREE.MeshToonMaterial({
      map: roadTex,
      gradientMap: this.toonGradientMap,
    });
    const intersectionMat =
      this._sharedIntersectionMat ||
      new THREE.MeshToonMaterial({
        map: this._createIntersectionTexture(),
        gradientMap: this.toonGradientMap,
      });
    const sidewalkMat = this._createToonMaterial(0xd8d2c7);

    // Helper to build an over-water Causeway Bridge segment in local chunk coordinates
    const addLocalBridgeSpan = (lx, lz, spanW, spanL, isEastWest) => {
      const deckGeo = new THREE.BoxGeometry(
        isEastWest ? spanL : spanW,
        0.48,
        isEastWest ? spanW : spanL
      );
      const deckMesh = new THREE.Mesh(deckGeo, bridgeDeckMat);
      deckMesh.position.set(lx, 0.16, lz);
      deckMesh.receiveShadow = true;
      addComicOutline(deckMesh);
      chunkGroup.add(deckMesh);

      const asphGeo = new THREE.PlaneGeometry(spanW - 1.4, spanL);
      asphGeo.rotateX(-Math.PI / 2);
      if (isEastWest) {
        asphGeo.rotateY(Math.PI / 2);
      }
      const asphMesh = new THREE.Mesh(asphGeo, roadMat);
      asphMesh.position.set(lx, 0.41, lz);
      asphMesh.receiveShadow = true;
      chunkGroup.add(asphMesh);

      for (const side of [-1, 1]) {
        const railGeo = isEastWest
          ? new THREE.BoxGeometry(spanL, 0.72, 0.45)
          : new THREE.BoxGeometry(0.45, 0.72, spanL);
        const railMesh = new THREE.Mesh(railGeo, bridgeRailMat);
        if (isEastWest) {
          railMesh.position.set(lx, 0.65, lz + side * (spanW * 0.5 - 0.25));
        } else {
          railMesh.position.set(lx + side * (spanW * 0.5 - 0.25), 0.65, lz);
        }
        addComicOutline(railMesh);
        chunkGroup.add(railMesh);
      }

      const pGeo = new THREE.CylinderGeometry(0.65, 0.80, 2.5, 8);
      const p1 = new THREE.Mesh(pGeo, bridgePillarMat);
      const p2 = new THREE.Mesh(pGeo, bridgePillarMat);
      if (isEastWest) {
        p1.position.set(lx, -0.85, lz - spanW * 0.34);
        p2.position.set(lx, -0.85, lz + spanW * 0.34);
      } else {
        p1.position.set(lx - spanW * 0.34, -0.85, lz);
        p2.position.set(lx + spanW * 0.34, -0.85, lz);
      }
      chunkGroup.add(p1, p2);
    };

    // Helper to build a local road strip + optional sidewalks
    const addLocalRoad = (lx, lz, width, length, isEastWest, withSidewalks = true) => {
      const geo = new THREE.PlaneGeometry(width, length);
      geo.rotateX(-Math.PI / 2);
      if (isEastWest) {
        geo.rotateY(Math.PI / 2);
      }
      const mesh = new THREE.Mesh(geo, roadMat);
      mesh.position.set(lx, 0.05, lz);
      mesh.receiveShadow = true;
      chunkGroup.add(mesh);

      if (withSidewalks) {
        const swW = 2.4;
        const swH = 0.15;
        if (!isEastWest) {
          for (const side of [-1, 1]) {
            const sw = new THREE.Mesh(new THREE.BoxGeometry(swW, swH, length), sidewalkMat);
            sw.position.set(lx + side * (width * 0.5 + swW * 0.5), 0.08, lz);
            sw.receiveShadow = true;
            addComicOutline(sw);
            chunkGroup.add(sw);
          }
        } else {
          for (const side of [-1, 1]) {
            const sw = new THREE.Mesh(new THREE.BoxGeometry(length, swH, swW), sidewalkMat);
            sw.position.set(lx, 0.08, lz + side * (width * 0.5 + swW * 0.5));
            sw.receiveShadow = true;
            addComicOutline(sw);
            chunkGroup.add(sw);
          }
        }
      }
    };

    // 1. Central Cross-Chunk Intersection Box (connects N-S and E-W avenues at (0, 0))
    const interGeo = new THREE.PlaneGeometry(14.6, 14.6);
    interGeo.rotateX(-Math.PI / 2);
    const interMesh = new THREE.Mesh(interGeo, intersectionMat);
    interMesh.position.set(0, 0.06, 0);
    interMesh.receiveShadow = true;
    chunkGroup.add(interMesh);

    // 2. Register 2-way N-S & E-W AI Traffic & Police Pursuit Road Lanes across the entire 120m chunk
    const zMin = wz - 60;
    const zMax = wz + 60;
    const xMin = wx - 60;
    const xMax = wx + 60;
    chunk.roadLanes.push(
      {
        axis: 'z',
        coord: wx - 3.2,
        pairCoord: wx + 3.2,
        minCoord: zMin,
        maxCoord: zMax,
        rotationY: 0,
        x1: wx - 3.2,
        z1: zMin,
        x2: wx - 3.2,
        z2: zMax,
        dirX: 0,
        dirZ: 1,
        district: info.biome,
        speedLimit: 20,
      },
      {
        axis: 'z',
        coord: wx + 3.2,
        pairCoord: wx - 3.2,
        minCoord: zMin,
        maxCoord: zMax,
        rotationY: Math.PI,
        x1: wx + 3.2,
        z1: zMax,
        x2: wx + 3.2,
        z2: zMin,
        dirX: 0,
        dirZ: -1,
        district: info.biome,
        speedLimit: 20,
      },
      {
        axis: 'x',
        coord: wz + 3.2,
        pairCoord: wz - 3.2,
        minCoord: xMin,
        maxCoord: xMax,
        rotationY: Math.PI / 2,
        x1: xMin,
        z1: wz + 3.2,
        x2: xMax,
        z2: wz + 3.2,
        dirX: 1,
        dirZ: 0,
        district: info.biome,
        speedLimit: 20,
      },
      {
        axis: 'x',
        coord: wz - 3.2,
        pairCoord: wz + 3.2,
        minCoord: xMin,
        maxCoord: xMax,
        rotationY: -Math.PI / 2,
        x1: xMax,
        z1: wz - 3.2,
        x2: xMin,
        z2: wz - 3.2,
        dirX: -1,
        dirZ: 0,
        district: info.biome,
        speedLimit: 20,
      }
    );

    // 3. Build 4 Outer Border Highway Causeway Bridges (connecting ±50m..±60m seamlessly across water channels)
    addLocalBridgeSpan(0, -55, 15.2, 12.0, false); // North Causeway
    addLocalBridgeSpan(0, 55, 15.2, 12.0, false);  // South Causeway
    addLocalBridgeSpan(-55, 0, 15.2, 12.0, true);  // West Causeway
    addLocalBridgeSpan(55, 0, 15.2, 12.0, true);   // East Causeway

    // 4. Construct Biome-Specific Island Foundation, Architecture, Foliage & Stunt Ramps
    if (info.biome === 'NEON METROPOLIS') {
      // Concrete Island Slab (104m x 104m) + Seawall
      const slabMat = this._createToonMaterial(0xb4bcc8);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(104, 0.9, 104), slabMat);
      slab.position.set(0, -0.44, 0);
      slab.receiveShadow = true;
      addComicOutline(slab);
      chunkGroup.add(slab);

      const wall = new THREE.Mesh(new THREE.BoxGeometry(105.2, 1.05, 105.2), seawallMat);
      wall.position.set(0, -0.58, 0);
      addComicOutline(wall);
      chunkGroup.add(wall);

      // Cross-Island 4-Lane Avenues
      addLocalRoad(0, -28.5, 14.0, 43.0, false, true);
      addLocalRoad(0, 28.5, 14.0, 43.0, false, true);
      addLocalRoad(-28.5, 0, 14.0, 43.0, true, true);
      addLocalRoad(28.5, 0, 14.0, 43.0, true, true);

      // 8 Skyscraper Parcels across the 4 City Quadrants
      const parcels = [
        { x: wx - 24, z: wz - 24, baseW: 11.5, baseD: 12.0, facesEast: true },
        { x: wx - 39, z: wz - 37, baseW: 10.5, baseD: 11.5, facesEast: true },
        { x: wx + 24, z: wz - 24, baseW: 11.5, baseD: 12.0, facesEast: false },
        { x: wx + 39, z: wz - 37, baseW: 10.5, baseD: 11.5, facesEast: false },
        { x: wx - 24, z: wz + 24, baseW: 11.5, baseD: 12.0, facesEast: true },
        { x: wx - 39, z: wz + 37, baseW: 10.5, baseD: 11.5, facesEast: true },
        { x: wx + 24, z: wz + 24, baseW: 11.5, baseD: 12.0, facesEast: false },
        { x: wx + 39, z: wz + 37, baseW: 10.5, baseD: 11.5, facesEast: false },
      ];
      for (let i = 0; i < parcels.length; i++) {
        if (i < 6 || rand() > 0.25) {
          this._createProceduralSkyscraper(parcels[i], rand, i + Math.abs(cx * 7 + cz * 11), chunk);
        }
      }

      // Corner Royal Palms along the avenue intersection
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          this._addChunkPalm(chunkGroup, chunk.palmCrowns, sx * 11.5, sz * 11.5, 9.2, sx * 0.28, sz * 0.22, sx + sz);
          this._addChunkPalm(chunkGroup, chunk.palmCrowns, sx * 46.0, sz * 11.5, 8.6, sx * 0.24, sz * 0.18, sx * 2);
        }
      }

      // Stunt Jump Ramp launching across the North or East Causeway
      this._addChunkStuntRamp(
        chunk,
        3.2,
        -43.0,
        4.6,
        9.5,
        2.65,
        0,
        -1,
        `chunk_ramp_${cx}_${cz}`
      );
    } else if (info.biome === 'SUBURBAN PALMS') {
      // Lush Green Suburban Island Slab (104m x 104m)
      const grassMat = this._createToonMaterial(0x52b868);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(104, 0.9, 104), grassMat);
      slab.position.set(0, -0.44, 0);
      slab.receiveShadow = true;
      addComicOutline(slab);
      chunkGroup.add(slab);

      const wall = new THREE.Mesh(new THREE.BoxGeometry(105.2, 1.0, 105.2), seawallMat);
      wall.position.set(0, -0.58, 0);
      addComicOutline(wall);
      chunkGroup.add(wall);

      // Cross-Island Tree-Lined Avenues
      addLocalRoad(0, -28.5, 13.0, 43.0, false, true);
      addLocalRoad(0, 28.5, 13.0, 43.0, false, true);
      addLocalRoad(-28.5, 0, 13.0, 43.0, true, true);
      addLocalRoad(28.5, 0, 13.0, 43.0, true, true);

      // 8 Single-Family 1980s Florida Ranch Homes with Pools & Garages
      const homeLots = [
        { x: wx - 22, z: wz - 22, lotW: 13.5, lotD: 11.8, streetDirX: 1, district: 'SUBURBAN PALMS' },
        { x: wx - 22, z: wz - 38, lotW: 13.5, lotD: 11.8, streetDirX: 1, district: 'SUBURBAN PALMS' },
        { x: wx + 22, z: wz - 22, lotW: 13.5, lotD: 11.8, streetDirX: -1, district: 'SUBURBAN PALMS' },
        { x: wx + 22, z: wz - 38, lotW: 13.5, lotD: 11.8, streetDirX: -1, district: 'SUBURBAN PALMS' },
        { x: wx - 22, z: wz + 22, lotW: 13.5, lotD: 11.8, streetDirX: 1, district: 'SUBURBAN PALMS' },
        { x: wx - 22, z: wz + 38, lotW: 13.5, lotD: 11.8, streetDirX: 1, district: 'SUBURBAN PALMS' },
        { x: wx + 22, z: wz + 22, lotW: 13.5, lotD: 11.8, streetDirX: -1, district: 'SUBURBAN PALMS' },
        { x: wx + 22, z: wz + 38, lotW: 13.5, lotD: 11.8, streetDirX: -1, district: 'SUBURBAN PALMS' },
      ];
      for (let i = 0; i < homeLots.length; i++) {
        this._createProceduralSuburbanHome(homeLots[i], rand, i + Math.abs(cx * 5 + cz * 9), chunk);
      }

      // Corner Neighborhood Parks with Gazebo/Fountain & Palms at outer quadrant corners (±40, ±28)
      const parkFountainMat = this._createToonMaterial(0xf7f4eb);
      const waterPoolMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const px = sx * 40;
          const pz = sz * 28;
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.55, 10), parkFountainMat);
          rim.position.set(px, 0.28, pz);
          addComicOutline(rim);
          const water = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.62, 10), waterPoolMat);
          water.position.set(px, 0.30, pz);
          chunkGroup.add(rim, water);

          this._addChunkPalm(chunkGroup, chunk.palmCrowns, px + sx * 4.2, pz - sz * 4.2, 8.5, sx * 0.3, sz * 0.2, sx - sz);
          this._addChunkPalm(chunkGroup, chunk.palmCrowns, sx * 10.5, sz * 14.0, 8.8, sx * 0.22, sz * 0.15, sx + sz);
        }
      }
    } else if (info.biome === 'OCEANFRONT KEYS') {
      // Golden Sand Beach Key Island (108m x 108m) + Inner Pastel Promenade Plaza (76m x 76m)
      const sandMat = this._createToonMaterial(0xf7d894);
      const sandSlab = new THREE.Mesh(new THREE.BoxGeometry(108, 0.72, 108), sandMat);
      sandSlab.position.set(0, -0.36, 0);
      sandSlab.receiveShadow = true;
      addComicOutline(sandSlab);
      chunkGroup.add(sandSlab);

      const plazaMat = this._createToonMaterial(0x7ee8dc);
      const plazaSlab = new THREE.Mesh(new THREE.BoxGeometry(76, 0.86, 76), plazaMat);
      plazaSlab.position.set(0, -0.41, 0);
      plazaSlab.receiveShadow = true;
      addComicOutline(plazaSlab);
      chunkGroup.add(plazaSlab);

      // Cross-Island Beach Boulevard
      addLocalRoad(0, -28.5, 13.5, 43.0, false, true);
      addLocalRoad(0, 28.5, 13.5, 43.0, false, true);
      addLocalRoad(-28.5, 0, 13.5, 43.0, true, true);
      addLocalRoad(28.5, 0, 13.5, 43.0, true, true);

      // 4 Art Deco Oceanfront Resort Hotels with Pastel Facades & Neon Crown Trim
      const resortConfigs = [
        { lx: -24, lz: -24, w: 12.5, d: 14.5, h: 14.5, col1: 0xffb3d1, col2: 0x62f2e8, neon: 0xff2a85, name: 'Keys Flamingo Resort' },
        { lx: 24, lz: -24, w: 12.5, d: 14.5, h: 16.0, col1: 0xfff0b8, col2: 0xff80b0, neon: 0x00f0ff, name: 'Biscayne Keys Hotel' },
        { lx: -24, lz: 24, w: 12.5, d: 14.5, h: 15.0, col1: 0x9cf7e8, col2: 0xd4c4fb, neon: 0xff2a85, name: 'Coral Reef Deco Club' },
        { lx: 24, lz: 24, w: 12.5, d: 14.5, h: 13.5, col1: 0xe6b8ff, col2: 0x70e8ff, neon: 0x00f0ff, name: 'Key Largo Surf Plaza' },
      ];
      for (let i = 0; i < resortConfigs.length; i++) {
        const rc = resortConfigs[i];
        const hex1 = '#' + new THREE.Color(rc.col1).getHexString();
        const hexN = '#' + new THREE.Color(rc.neon).getHexString();
        const winTex = this._createWindowGridTexture('#201532', hexN, '#ffefc2', 3, 4, hex1);
        const winMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: winTex,
          emissive: new THREE.Color(rc.neon),
          emissiveMap: winTex,
          emissiveIntensity: 0.55,
          roughness: 0.42,
        });
        this.windowMaterials.push(winMat);
        chunk.windowMaterials.push(winMat);

        const baseMat = this._createToonMaterial(rc.col1);
        const tierMat = this._createToonMaterial(rc.col2);
        const neonMat = new THREE.MeshBasicMaterial({ color: rc.neon });
        this.neonMaterials.push(neonMat);
        chunk.neonMaterials.push(neonMat);

        const hGroup = new THREE.Group();
        hGroup.position.set(rc.lx, 0, rc.lz);

        const body = new THREE.Mesh(new THREE.BoxGeometry(rc.w, rc.h, rc.d), [
          winMat, winMat, baseMat, baseMat, winMat, winMat,
        ]);
        body.position.y = rc.h * 0.5;
        body.castShadow = true;
        body.receiveShadow = true;
        addComicOutline(body);
        hGroup.add(body);

        const crown = new THREE.Mesh(new THREE.BoxGeometry(rc.w * 0.72, 2.8, rc.d * 0.72), tierMat);
        crown.position.y = rc.h + 1.4;
        addComicOutline(crown);
        hGroup.add(crown);

        const neonBand = new THREE.Mesh(new THREE.BoxGeometry(rc.w + 0.45, 0.28, rc.d + 0.45), neonMat);
        neonBand.position.y = rc.h;
        hGroup.add(neonBand);

        chunkGroup.add(hGroup);

        const worldX = wx + rc.lx;
        const worldZ = wz + rc.lz;
        const col = {
          x: worldX,
          z: worldZ,
          width: rc.w,
          depth: rc.d,
          minX: worldX - rc.w * 0.5,
          maxX: worldX + rc.w * 0.5,
          minZ: worldZ - rc.d * 0.5,
          maxZ: worldZ + rc.d * 0.5,
          height: rc.h + 2.8,
          name: rc.name,
          district: 'OCEANFRONT KEYS',
          _chunkKey: chunk.key,
        };
        this.buildingColliders.push(col);
        chunk.colliders.push(col);
        const fp = {
          x: worldX,
          z: worldZ,
          w: rc.w,
          d: rc.d,
          h: rc.h + 2.8,
          zone: 'keys_resort',
          name: rc.name,
          color: hex1,
          _chunkKey: chunk.key,
        };
        this.proceduralBlockFootprints.push(fp);
        chunk.footprints.push(fp);
      }

      // Beach Lifeguard Towers, Striped Umbrellas & Royal Palms along the sandy perimeter (±44, ±44)
      const umbrellaColors = [0xff2a85, 0x00e5ff, 0xffcc00, 0xff6633];
      for (let i = 0; i < 4; i++) {
        const sx = i % 2 === 0 ? -1 : 1;
        const sz = i < 2 ? -1 : 1;
        const bx = sx * 43;
        const bz = sz * 43;

        // Beach Umbrella
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6),
          this._createToonMaterial(0xf7f4eb)
        );
        pole.position.set(bx, 1.2, bz);
        const canopy = new THREE.Mesh(
          new THREE.ConeGeometry(1.85, 0.75, 8),
          this._createToonMaterial(umbrellaColors[i])
        );
        canopy.position.set(bx, 2.4, bz);
        addComicOutline(canopy);
        chunkGroup.add(pole, canopy);

        this._addChunkPalm(chunkGroup, chunk.palmCrowns, sx * 45, sz * 18, 9.0, sx * 0.35, sz * 0.25, i);
        this._addChunkPalm(chunkGroup, chunk.palmCrowns, sx * 18, sz * 45, 8.6, sx * 0.25, sz * 0.35, i + 1.5);
      }

      // Waterfront Beach Stunt Ramp
      this._addChunkStuntRamp(
        chunk,
        42.0,
        3.2,
        4.6,
        9.5,
        2.7,
        1,
        0,
        `chunk_keys_ramp_${cx}_${cz}`
      );
    } else {
      // TROPICAL ARCHIPELAGO: Elevated Cross-Ocean Causeway Overpass + 4 Corner Coral-Sand Islets & Lighthouse/Radio Tower
      addLocalBridgeSpan(0, -28.0, 15.2, 42.0, false);
      addLocalBridgeSpan(0, 28.0, 15.2, 42.0, false);
      addLocalBridgeSpan(-28.0, 0, 15.2, 42.0, true);
      addLocalBridgeSpan(28.0, 0, 15.2, 42.0, true);

      // Central Elevated Causeway Plaza Deck
      const hubDeck = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.52, 16.5), bridgeDeckMat);
      hubDeck.position.set(0, 0.16, 0);
      addComicOutline(hubDeck);
      chunkGroup.add(hubDeck);

      const isletSandMat = this._createToonMaterial(0xf7d894);
      const isletTurfMat = this._createToonMaterial(0x46b868);
      const dockWoodMat = this._createToonMaterial(0x8d5b3c);

      // 4 Tropical Coral-Sand Islets at (±34, ±34), each 32m x 32m
      for (let i = 0; i < 4; i++) {
        const sx = i % 2 === 0 ? -1 : 1;
        const sz = i < 2 ? -1 : 1;
        const ix = sx * 34;
        const iz = sz * 34;

        const sandBase = new THREE.Mesh(new THREE.BoxGeometry(32, 0.72, 32), isletSandMat);
        sandBase.position.set(ix, -0.32, iz);
        sandBase.receiveShadow = true;
        addComicOutline(sandBase);

        const turfCap = new THREE.Mesh(new THREE.BoxGeometry(22, 0.82, 22), isletTurfMat);
        turfCap.position.set(ix, -0.35, iz);
        turfCap.receiveShadow = true;
        addComicOutline(turfCap);
        chunkGroup.add(sandBase, turfCap);

        // Wooden Boat Pier connecting Islet toward the Causeway
        const pier = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.28, 12.0), dockWoodMat);
        pier.position.set(ix, 0.22, iz - sz * 17.0);
        addComicOutline(pier);
        chunkGroup.add(pier);

        this._addChunkPalm(chunkGroup, chunk.palmCrowns, ix + sx * 5, iz + sz * 5, 9.2, sx * 0.38, sz * 0.28, i);
        this._addChunkPalm(chunkGroup, chunk.palmCrowns, ix - sx * 5, iz + sz * 6, 8.2, -sx * 0.25, sz * 0.32, i + 2);

        if (i === 0) {
          // Islet 0: Vice Archipelago Lighthouse / Beacon Tower
          const lhWhite = this._createToonMaterial(0xf7f4eb);
          const lhRed = this._createToonMaterial(0xff2a55);
          const lhBeacon = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
          this.neonMaterials.push(lhBeacon);
          chunk.neonMaterials.push(lhBeacon);

          const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.5, 15.0, 10), lhWhite);
          tower.position.set(ix, 7.5, iz);
          addComicOutline(tower);
          const band = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.2, 4.2, 10), lhRed);
          band.position.set(ix, 8.5, iz);
          addComicOutline(band);
          const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 10), lhBeacon);
          lantern.position.set(ix, 16.0, iz);
          const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.8, 10), lhRed);
          cap.position.set(ix, 17.9, iz);
          addComicOutline(cap);
          chunkGroup.add(tower, band, lantern, cap);

          const col = {
            x: wx + ix,
            z: wz + iz,
            width: 5.2,
            depth: 5.2,
            minX: wx + ix - 2.6,
            maxX: wx + ix + 2.6,
            minZ: wz + iz - 2.6,
            maxZ: wz + iz + 2.6,
            height: 18.8,
            name: 'Archipelago Lighthouse',
            district: 'TROPICAL ARCHIPELAGO',
            _chunkKey: chunk.key,
          };
          this.buildingColliders.push(col);
          chunk.colliders.push(col);
          const fp = {
            x: wx + ix,
            z: wz + iz,
            w: 5.2,
            d: 5.2,
            h: 18.8,
            zone: 'archipelago_landmark',
            name: 'Archipelago Lighthouse',
            color: '#ff2a55',
            _chunkKey: chunk.key,
          };
          this.proceduralBlockFootprints.push(fp);
          chunk.footprints.push(fp);
        } else if (i === 3) {
          // Islet 3: Keys Yacht & Tiki Boathouse Pavilion
          const tikiWood = this._createToonMaterial(0xa66c38);
          const tikiRoof = this._createToonMaterial(0xd89b3c);
          const neonCyan = new THREE.MeshBasicMaterial({ color: 0xff2a85 });
          this.neonMaterials.push(neonCyan);
          chunk.neonMaterials.push(neonCyan);

          const lodge = new THREE.Mesh(new THREE.BoxGeometry(8.5, 4.6, 8.5), tikiWood);
          lodge.position.set(ix, 2.3, iz);
          addComicOutline(lodge);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 3.2, 4), tikiRoof);
          roof.position.set(ix, 6.2, iz);
          roof.rotation.y = Math.PI / 4;
          addComicOutline(roof);
          const trim = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.24, 8.8), neonCyan);
          trim.position.set(ix, 4.6, iz);
          chunkGroup.add(lodge, roof, trim);

          const col = {
            x: wx + ix,
            z: wz + iz,
            width: 8.5,
            depth: 8.5,
            minX: wx + ix - 4.25,
            maxX: wx + ix + 4.25,
            minZ: wz + iz - 4.25,
            maxZ: wz + iz + 4.25,
            height: 7.8,
            name: 'Archipelago Boathouse',
            district: 'TROPICAL ARCHIPELAGO',
            _chunkKey: chunk.key,
          };
          this.buildingColliders.push(col);
          chunk.colliders.push(col);
          const fp = {
            x: wx + ix,
            z: wz + iz,
            w: 8.5,
            d: 8.5,
            h: 7.8,
            zone: 'archipelago_landmark',
            name: 'Archipelago Boathouse',
            color: '#d89b3c',
            _chunkKey: chunk.key,
          };
          this.proceduralBlockFootprints.push(fp);
          chunk.footprints.push(fp);
        }
      }

      // Over-water Causeway Stunt Jump Ramp
      this._addChunkStuntRamp(
        chunk,
        -3.2,
        24.0,
        4.6,
        9.5,
        2.8,
        0,
        1,
        `chunk_arch_ramp_${cx}_${cz}`
      );
    }

    this.infiniteChunksGroup.add(chunkGroup);
    return chunk;
  }

  _unloadChunk(key, chunk) {
    if (!chunk) return;

    if (chunk.group && this.infiniteChunksGroup) {
      this.infiniteChunksGroup.remove(chunk.group);
      chunk.group.traverse((child) => {
        if (child.isMesh && child.geometry) {
          child.geometry.dispose();
        }
      });
    }

    if (chunk.windowMaterials && chunk.windowMaterials.length > 0) {
      const winSet = new Set(chunk.windowMaterials);
      this.windowMaterials = this.windowMaterials.filter((m) => !winSet.has(m));
      for (const m of chunk.windowMaterials) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }

    if (chunk.neonMaterials && chunk.neonMaterials.length > 0) {
      const neonSet = new Set(chunk.neonMaterials);
      this.neonMaterials = this.neonMaterials.filter((m) => !neonSet.has(m));
      for (const m of chunk.neonMaterials) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }

    if (chunk.palmCrowns && chunk.palmCrowns.length > 0) {
      const palmSet = new Set(chunk.palmCrowns);
      this.palmCrownMeshes = this.palmCrownMeshes.filter((p) => !palmSet.has(p));
    }

    this.buildingColliders = this.buildingColliders.filter((c) => c._chunkKey !== key);
    this.proceduralBlockFootprints = this.proceduralBlockFootprints.filter((f) => f._chunkKey !== key);
    if (this.stuntRamps) {
      this.stuntRamps = this.stuntRamps.filter((r) => r._chunkKey !== key);
    }
  }

  updateInfiniteChunks(playerX = 80, playerZ = -26, forceReload = false) {
    if (!this.infiniteChunksGroup || !this.activeChunks) return;
    const { cx: pcx, cz: pcz } = this.getPlayerChunkCoords(playerX, playerZ);

    if (
      !forceReload &&
      this._lastStreamedChunkX === pcx &&
      this._lastStreamedChunkZ === pcz
    ) {
      return;
    }
    this._lastStreamedChunkX = pcx;
    this._lastStreamedChunkZ = pcz;

    // 1. Unload distant chunks beyond Chebyshev distance > 3
    for (const [key, chunk] of Array.from(this.activeChunks.entries())) {
      const dist = Math.max(Math.abs(chunk.cx - pcx), Math.abs(chunk.cz - pcz));
      if (dist > 3 || forceReload) {
        this._unloadChunk(key, chunk);
        this.activeChunks.delete(key);
      }
    }

    // 2. Stream in 5x5 chunk window (radius = 2 -> 600m x 600m active world around player)
    const radius = this.chunkLoadRadius || 2;
    let newlyGenerated = 0;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        // Core 3x3 Argon City map is chunks [-1..1, -1..1]
        if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1) {
          continue;
        }
        const key = `${cx},${cz}`;
        if (!this.activeChunks.has(key)) {
          const chunk = this._generateChunk(cx, cz);
          this.activeChunks.set(key, chunk);
          newlyGenerated++;
        }
      }
    }

    if (newlyGenerated > 0 && this.skyUniforms) {
      this.setTimeOfDay(this.timeOfDay);
    }
  }

  getActiveChunks() {
    if (!this.activeChunks) return [];
    return Array.from(this.activeChunks.values());
  }

  getActiveRoadLanesAround(x = 0, z = 0, radius = 260) {
    const r = Math.max(80, Number(radius) || 260);
    const results = [];

    // 1. Include core map roadWaypoints within radius
    if (this.roadWaypoints) {
      for (let i = 0; i < this.roadWaypoints.length; i++) {
        const wp = this.roadWaypoints[i];
        const midX = (wp.x1 + wp.x2) * 0.5;
        const midZ = (wp.z1 + wp.z2) * 0.5;
        if (Math.abs(midX - x) <= r + 90 && Math.abs(midZ - z) <= r + 90) {
          results.push(wp);
        }
      }
    }

    // 2. Include roadLanes from all currently active procedural chunks within radius
    if (this.activeChunks) {
      for (const chunk of this.activeChunks.values()) {
        if (Math.abs(chunk.wx - x) <= r + 80 && Math.abs(chunk.wz - z) <= r + 80) {
          for (let i = 0; i < chunk.roadLanes.length; i++) {
            results.push(chunk.roadLanes[i]);
          }
        }
      }
    }

    return results;
  }

  // ============================================================================
  // 17. WORLD QUERIES (DISTRICTS, WATER, HEIGHT, COLLIDERS, WAYPOINTS)
  // ============================================================================

  getDistrictAt(x, z) {
    // Outer Procedural Chunks beyond the [-180, 180] core Argon City map
    if (Math.abs(x) > 180.0 || Math.abs(z) > 180.0) {
      const { cx, cz } = this.getPlayerChunkCoords(x, z);
      const info = this._getChunkBiomeInfo(cx, cz);
      return info.biome;
    }

    if (z > 70 && x < -125) {
      return 'ESCOBAR INTERNATIONAL';
    }
    if (z > 70 && x < 34) {
      return 'ARGON PORT MARINA';
    }
    // Major City / Downtown Metropolis high-rise financial & commercial zones
    if (
      (x >= 14 && x <= 34 && z < -10) ||
      (x < -145 && z < 55) ||
      (x < -112 && z < -28)
    ) {
      return 'DOWNTOWN METROPOLIS';
    }
    // Palm Springs & Bayshore Suburban Neighborhoods
    if (
      (x >= -110 && x <= -74 && z >= -165 && z <= 86) ||
      (x >= 42 && x <= 68 && z >= 78 && z <= 90)
    ) {
      return 'PALM SPRINGS SUBURBS';
    }
    // Starfish Island & Starfish Suburbs
    if (x >= -74 && x <= 14 && z >= -70 && z <= 70) {
      if ((Math.abs(z) >= 11 && Math.abs(z) <= 21) || z >= 36) {
        return 'STARFISH SUBURBS';
      }
      return 'STARFISH ISLAND';
    }
    if (x < -74) {
      return 'LITTLE HAITI';
    }
    if (z > 90) {
      return 'ARGON PORT MARINA';
    }
    return 'OCEAN BEACH';
  }

  isWaterAt(x, z) {
    // --- 1. OUTER PROCEDURAL CHUNKS BEYOND [-180, 180] ---
    if (Math.abs(x) > 180.0 || Math.abs(z) > 180.0) {
      // Frontier North/South Gateway Bridges at x = -120, -115, 0, 40, 80, +120 spanning across z = ±180..±192
      if (
        Math.abs(z) <= 192.0 &&
        (Math.abs(x - (-120.0)) <= 8.5 ||
          Math.abs(x - (-115.0)) <= 8.5 ||
          Math.abs(x) <= 8.5 ||
          Math.abs(x - 40.0) <= 8.5 ||
          Math.abs(x - 80.0) <= 8.5 ||
          Math.abs(x - 120.0) <= 8.5)
      ) {
        return false;
      }

      const { cx, cz } = this.getPlayerChunkCoords(x, z);
      const lx = x - cx * 120;
      const lz = z - cz * 120;

      // Cross-chunk 4-way Highway Causeway Bridges & Avenues (lx in [-8.2, 8.2] or lz in [-8.2, 8.2])
      if (Math.abs(lx) <= 8.2 || Math.abs(lz) <= 8.2) {
        return false;
      }

      const info = this._getChunkBiomeInfo(cx, cz);
      if (info.biome === 'TROPICAL ARCHIPELAGO') {
        // 4 Corner Coral-Sand Islets at (±34, ±34), each 32m x 32m (so [18..50]), plus boat piers
        if (
          Math.abs(Math.abs(lx) - 34.0) <= 16.0 &&
          Math.abs(Math.abs(lz) - 34.0) <= 16.0
        ) {
          return false;
        }
        // Wooden boat piers connecting islets toward causeways
        if (Math.abs(Math.abs(lx) - 34.0) <= 3.2 && Math.abs(lz) >= 11.0 && Math.abs(lz) <= 24.0) {
          return false;
        }
        return true;
      }

      if (info.biome === 'OCEANFRONT KEYS') {
        // 108m x 108m sandy island key
        return !(Math.abs(lx) <= 54.0 && Math.abs(lz) <= 54.0);
      }

      // NEON METROPOLIS & SUBURBAN PALMS: 104m x 104m island slab
      return !(Math.abs(lx) <= 52.0 && Math.abs(lz) <= 52.0);
    }

    // --- 2. CORE MAP GATEWAY CAUSEWAY BRIDGES & FRONTIER RING ROADS ---
    // North & South Frontier Ring Causeways at z = ±170 (x in [-176, 126])
    if ((Math.abs(z - (-170.0)) <= 8.5 || Math.abs(z - 170.0) <= 8.5) && x >= -176.0 && x <= 126.0) {
      return false;
    }
    // West Frontier Causeway at x = -173 (z in [-174, 174])
    if (x >= -179.5 && x <= -166.0 && z >= -174.0 && z <= 174.0) {
      return false;
    }
    // North & South Gateway Bridges at x = -120, -115, 0, 40, 80, +120 (z in [-180, -156] or [156, 180])
    if (
      (Math.abs(x - (-120.0)) <= 8.5 ||
        Math.abs(x - (-115.0)) <= 8.5 ||
        Math.abs(x) <= 8.5 ||
        Math.abs(x - 40.0) <= 8.5 ||
        Math.abs(x - 80.0) <= 8.5 ||
        Math.abs(x - 120.0) <= 8.5) &&
      Math.abs(z) >= 156.0 &&
      Math.abs(z) <= 180.0
    ) {
      return false;
    }
    // East & West Gateway Causeways at z = -120, 0, +120 (x in [80, 180] or [-180, -164])
    if (
      (Math.abs(z - (-120.0)) <= 8.5 || Math.abs(z) <= 8.5 || Math.abs(z - 120.0) <= 8.5) &&
      ((x >= 80.0 && x <= 180.0) || (x >= -180.0 && x <= -164.0))
    ) {
      return false;
    }

    // Extended N-S Main Arteries reaching Frontier Ring Causeways at z = ±170
    if (
      (Math.abs(x - 80.0) <= 8.5 || Math.abs(x - 40.0) <= 8.5 || Math.abs(x - (-115.0)) <= 8.5) &&
      Math.abs(z) <= 180.0
    ) {
      return false;
    }

    // Outer Atlantic Ocean & Bay boundaries inside core [-180, 180] (Beach surf shoreline is at x = 128.0)
    if (x > 128.0 || x < -168.0 || z < -166.0 || z > 166.0) {
      return true;
    }

    // East Mainland (Ocean Beach + Golden Beach Sand): x in [34.0, 128.0], z in [-166.0, 166.0]
    if (x >= 34.0 && x <= 128.0) {
      return false;
    }

    // Downtown Metropolis Waterfront Terrace: x in [15.0, 34.0], z in [-164.0, -12.0]
    if (x >= 15.0 && x <= 34.0 && z >= -164.0 && z <= -12.0) {
      return false;
    }

    // West Mainland (Little Haiti + West Container Yard): x in [-168.0, -100.0], z in [-166.0, 158.0]
    if (x >= -168.0 && x <= -100.0 && z <= 158.0) {
      return false;
    }

    // Palm Springs & Bayshore Estates Suburban Peninsula: x in [-100.0, -75.0]
    if (
      x >= -100.0 &&
      x <= -75.0 &&
      ((z >= -164.0 && z <= -10.0) || (z >= 10.0 && z <= 86.0))
    ) {
      return false;
    }

    // Inside Biscayne Bay Channel: x in (-100.0, 34.0)
    // 1. Starfish Island Landmass: x in [-72.0, 12.0], z in [-68.0, 68.0]
    if (x >= -72.0 && x <= 12.0 && z >= -68.0 && z <= 68.0) {
      return false;
    }

    // 2. East & West Starfish Causeway Bridges: z in [-8.2, 8.2]
    if (z >= -8.2 && z <= 8.2 && x >= -100.0 && x <= 34.0) {
      return false;
    }

    // 3. North Beach Crossway Bridge: z in [-97.8, -82.2]
    if (z >= -97.8 && z <= -82.2 && x >= -100.0 && x <= 34.0) {
      return false;
    }

    // 4. Argon Port Highway Causeway: z in [87.2, 102.8]
    if (z >= 87.2 && z <= 102.8 && x >= -100.0 && x <= 34.0) {
      return false;
    }

    // 5. Argon Port Marina Yacht Piers:
    // East Yacht Pier: x in [8.2, 21.8], z in [102.0, 134.0]
    if (x >= 8.2 && x <= 21.8 && z >= 102.0 && z <= 134.0) {
      return false;
    }
    // West Yacht Pier: x in [-61.8, -48.2], z in [102.0, 134.0]
    if (x >= -61.8 && x <= -48.2 && z >= 102.0 && z <= 134.0) {
      return false;
    }

    return true;
  }

  getWaterHeight(x = 0, z = 0) {
    return -0.25 + Math.sin(this.elapsedTime * 1.8 + x * 0.08 + z * 0.06) * 0.04;
  }

  getGroundHeightAt(x, z) {
    // 1. Check 3D Unique Stunt Jump Ramps first so vehicles smoothly climb 0.02 -> ramp.height!
    if (this.stuntRamps && this.stuntRamps.length > 0) {
      for (let i = 0; i < this.stuntRamps.length; i++) {
        const r = this.stuntRamps[i];
        const dx = x - r.x;
        const dz = z - r.z;
        const along = dx * r.dirX + dz * r.dirZ;
        const perp = Math.abs(-dx * r.dirZ + dz * r.dirX);
        if (Math.abs(along) <= r.length * 0.5 && perp <= r.width * 0.5) {
          const t = THREE.MathUtils.clamp((along + r.length * 0.5) / r.length, 0, 1);
          return THREE.MathUtils.lerp(r.baseY || 0.02, r.height, t);
        }
      }
    }

    if (this.isWaterAt(x, z)) {
      return -0.35;
    }

    // 2. Outer Procedural Chunks beyond [-180, 180]
    if (Math.abs(x) > 180.0 || Math.abs(z) > 180.0) {
      const { cx, cz } = this.getPlayerChunkCoords(x, z);
      const lx = x - cx * 120;
      const lz = z - cz * 120;
      const info = this._getChunkBiomeInfo(cx, cz);

      // Over-water causeway spans at chunk borders (|lx| > 49 or |lz| > 49) or Archipelago overpass
      if (
        Math.abs(lx) > 49.0 ||
        Math.abs(lz) > 49.0 ||
        (info.biome === 'TROPICAL ARCHIPELAGO' && (Math.abs(lx) <= 8.2 || Math.abs(lz) <= 8.2))
      ) {
        return 0.38;
      }

      // Chunk internal roadways
      if (Math.abs(lx) <= 7.0 || Math.abs(lz) <= 7.0) {
        return 0.03;
      }

      // Sandy perimeter slope on Oceanfront Keys
      if (info.biome === 'OCEANFRONT KEYS' && (Math.abs(lx) > 40.0 || Math.abs(lz) > 40.0)) {
        return 0.02;
      }

      return 0.12;
    }

    // 3. Core Map Gateway Bridges & Frontier Causeways over Bay/Ocean
    if (
      (Math.abs(z - (-120.0)) <= 8.2 || Math.abs(z) <= 8.2 || Math.abs(z - 120.0) <= 8.2) &&
      (x > 125.0 || x < -166.0)
    ) {
      return 0.38;
    }
    if (
      (Math.abs(x - (-120.0)) <= 8.2 || Math.abs(x) <= 8.2 || Math.abs(x - 120.0) <= 8.2) &&
      Math.abs(z) > 162.0
    ) {
      return 0.38;
    }
    if (x > -100 && x < 34 && (Math.abs(z - (-170.0)) <= 8.2 || Math.abs(z - 170.0) <= 8.2)) {
      return 0.42;
    }

    // Causeway Bridge Decks over Biscayne Bay
    const inBayChannel = (x > -100 && x < -72) || (x > 12 && x < 34);
    if (inBayChannel && Math.abs(z) <= 8.5) {
      return 0.45;
    }
    if (x > -100 && x < 34 && (Math.abs(z - (-90)) <= 8.2 || Math.abs(z - 95) <= 8.5)) {
      return 0.45;
    }

    // Argon Port Marina Yacht Piers
    if (z > 102.5 && ((x >= 8 && x <= 22) || (x >= -62 && x <= -48))) {
      return 0.34;
    }

    // Ocean Beach Shoreline Sand Slope
    if (x > 94 && x <= 128) {
      const t = THREE.MathUtils.clamp((x - 118) / 10, 0, 1);
      return THREE.MathUtils.lerp(0.02, -0.18, t);
    }

    // Roadway carriageways vs raised sidewalks
    const onOceanDr = Math.abs(x - 80) <= 7.0;
    const onWashAve = Math.abs(x - 40) <= 7.0;
    const onStarfishBlvd = Math.abs(x - (-30)) <= 6.0 && Math.abs(z) <= 60;
    const onHaitiBlvd = Math.abs(x - (-115)) <= 7.0;
    const onRunwayAve = Math.abs(x - (-152)) <= 6.0;
    const onWestFrontier = Math.abs(x - (-173)) <= 6.5;
    const onCrossRoad =
      Math.abs(z) <= 7.0 ||
      Math.abs(z - (-90)) <= 6.5 ||
      Math.abs(z - 95) <= 7.0 ||
      Math.abs(z - (-45)) <= 6.0 ||
      Math.abs(z - 45) <= 6.0 ||
      Math.abs(z - (-170)) <= 7.0 ||
      Math.abs(z - 170) <= 7.0;

    if (onOceanDr || onWashAve || onStarfishBlvd || onHaitiBlvd || onRunwayAve || onWestFrontier || onCrossRoad) {
      return 0.02;
    }

    return 0.12;
  }

  // Aliases queried by VehicleTrafficPoliceSystem and CharacterWeaponWantedSystem
  getGroundHeight(x, z) {
    return this.getGroundHeightAt(x, z);
  }

  getHeightAt(x, z) {
    return this.getGroundHeightAt(x, z);
  }

  isBeachSandAt(x, z) {
    if (Math.abs(x) > 180.0 || Math.abs(z) > 180.0) {
      const { cx, cz } = this.getPlayerChunkCoords(x, z);
      const lx = x - cx * 120;
      const lz = z - cz * 120;
      if (Math.abs(lx) <= 8.2 || Math.abs(lz) <= 8.2) return false;
      const info = this._getChunkBiomeInfo(cx, cz);
      if (info.biome === 'OCEANFRONT KEYS') {
        return Math.abs(lx) <= 54.0 && Math.abs(lz) <= 54.0 && (Math.abs(lx) >= 38.0 || Math.abs(lz) >= 38.0);
      }
      if (info.biome === 'TROPICAL ARCHIPELAGO') {
        return Math.abs(Math.abs(lx) - 34.0) <= 16.0 && Math.abs(Math.abs(lz) - 34.0) <= 16.0;
      }
      return false;
    }
    return x >= 93.2 && x <= 129.2 && z >= -166.0 && z <= 166.0;
  }

  /**
   * Resolves 2D circle collisions against all building AABB colliders and bridge side-guardrails
   * with smooth rounded-corner normals (nx, nz) so vehicles slide cleanly along barriers without
   * getting snagged, while leaving ocean/bay shorelines open so land vehicles driven into water sink.
   * No outer world boundary clamp exists: players can travel infinitely across procedural chunks!
   */
  resolveCircleCollision(x, z, radius = 1.0, isBoat = false) {
    let rx = Number(x) || 0;
    let rz = Number(z) || 0;
    const r = Math.max(0.2, Number(radius) || 1.0);
    let hit = false;
    let nx = 0;
    let nz = 0;
    let contactX = rx;
    let contactZ = rz;

    if (!isBoat) {
      // 1. Resolve against all Building & Structure AABB Colliders (core + active procedural chunks)
      for (let i = 0; i < this.buildingColliders.length; i++) {
        const b = this.buildingColliders[i];
        // Quick broadphase reject
        if (rx + r <= b.minX || rx - r >= b.maxX || rz + r <= b.minZ || rz - r >= b.maxZ) {
          continue;
        }

        const cx = THREE.MathUtils.clamp(rx, b.minX, b.maxX);
        const cz = THREE.MathUtils.clamp(rz, b.minZ, b.maxZ);
        const dx = rx - cx;
        const dz = rz - cz;
        const distSq = dx * dx + dz * dz;

        if (distSq < r * r) {
          hit = true;
          if (distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const pushNx = dx / dist;
            const pushNz = dz / dist;
            rx = cx + pushNx * (r + 0.02);
            rz = cz + pushNz * (r + 0.02);
            nx = pushNx;
            nz = pushNz;
            contactX = cx;
            contactZ = cz;
          } else {
            // Center is inside AABB: push out via nearest face
            const dLeft = rx - b.minX;
            const dRight = b.maxX - rx;
            const dTop = rz - b.minZ;
            const dBottom = b.maxZ - rz;
            const minOverlap = Math.min(dLeft, dRight, dTop, dBottom);
            if (minOverlap === dLeft) {
              rx = b.minX - r - 0.02;
              nx = -1;
              nz = 0;
              contactX = b.minX;
              contactZ = rz;
            } else if (minOverlap === dRight) {
              rx = b.maxX + r + 0.02;
              nx = 1;
              nz = 0;
              contactX = b.maxX;
              contactZ = rz;
            } else if (minOverlap === dTop) {
              rz = b.minZ - r - 0.02;
              nx = 0;
              nz = -1;
              contactX = rx;
              contactZ = b.minZ;
            } else {
              rz = b.maxZ + r + 0.02;
              nx = 0;
              nz = 1;
              contactX = rx;
              contactZ = b.maxZ;
            }
          }
        }
      }

      // 2. Outer Procedural Chunk Causeway Bridge Guardrails (smooth lateral slide on over-water bridge spans)
      if (Math.abs(rx) > 180.0 || Math.abs(rz) > 180.0) {
        const { cx, cz } = this.getPlayerChunkCoords(rx, rz);
        const lx = rx - cx * 120;
        const lz = rz - cz * 120;
        const info = this._getChunkBiomeInfo(cx, cz);
        const isArch = info.biome === 'TROPICAL ARCHIPELAGO';
        const spanHalf = 7.6 - r;

        if ((Math.abs(lz) > 51.5 || (isArch && Math.abs(lz) > 8.2)) && Math.abs(lx) <= 8.5) {
          if (lx < -spanHalf) {
            rx = cx * 120 - spanHalf;
            nx = 1;
            nz = 0;
            contactX = cx * 120 - 7.6;
            contactZ = rz;
            hit = true;
          } else if (lx > spanHalf) {
            rx = cx * 120 + spanHalf;
            nx = -1;
            nz = 0;
            contactX = cx * 120 + 7.6;
            contactZ = rz;
            hit = true;
          }
        } else if ((Math.abs(lx) > 51.5 || (isArch && Math.abs(lx) > 8.2)) && Math.abs(lz) <= 8.5) {
          if (lz < -spanHalf) {
            rz = cz * 120 - spanHalf;
            nx = 0;
            nz = 1;
            contactX = rx;
            contactZ = cz * 120 - 7.6;
            hit = true;
          } else if (lz > spanHalf) {
            rz = cz * 120 + spanHalf;
            nx = 0;
            nz = -1;
            contactX = rx;
            contactZ = cz * 120 + 7.6;
            hit = true;
          }
        }
      } else {
        // 3. Core Map Causeway Bridge Side Parapet Guardrails (smooth lateral slide while on bridge spans)
        const inBaySpan = rx > -99.5 && rx < 33.5;
        if (inBaySpan) {
          const onNorthBridge = rz >= -98.0 && rz <= -82.0;
          const onSouthBridge = rz >= 87.0 && rz <= 103.0;
          const onNorthFrontier = rz >= -178.0 && rz <= -162.0;
          const onSouthFrontier = rz >= 162.0 && rz <= 178.0;
          const onEastSpan = rx > 12.2 && rx < 33.5 && Math.abs(rz) <= 8.5;
          const onWestSpan = rx > -99.5 && rx < -72.2 && Math.abs(rz) <= 8.5;
          const onEastPier = rx >= 8.0 && rx <= 22.0 && rz >= 98.0;
          const onWestPier = rx >= -62.0 && rx <= -48.0 && rz >= 98.0;
          const onCentralNorthGateway = Math.abs(rx) <= 8.5 && rz < -162.0;
          const onCentralSouthGateway = Math.abs(rx) <= 8.5 && rz > 162.0;

          if (onNorthBridge) {
            const bMinZ = -97.2 + r;
            const bMaxZ = -82.8 - r;
            if (rz < bMinZ) {
              rz = bMinZ;
              nx = 0;
              nz = 1;
              contactX = rx;
              contactZ = -97.2;
              hit = true;
            } else if (rz > bMaxZ) {
              rz = bMaxZ;
              nx = 0;
              nz = -1;
              contactX = rx;
              contactZ = -82.8;
              hit = true;
            }
          } else if (onSouthBridge) {
            const bMinZ = 87.8 + r;
            const bMaxZ = 102.2 - r;
            if (rz < bMinZ) {
              rz = bMinZ;
              nx = 0;
              nz = 1;
              contactX = rx;
              contactZ = 87.8;
              hit = true;
            } else if (rz > bMaxZ && !onEastPier && !onWestPier) {
              rz = bMaxZ;
              nx = 0;
              nz = -1;
              contactX = rx;
              contactZ = 102.2;
              hit = true;
            }
          } else if (onNorthFrontier && !onCentralNorthGateway) {
            const bMinZ = -177.2 + r;
            const bMaxZ = -162.8 - r;
            if (rz < bMinZ) {
              rz = bMinZ;
              nx = 0;
              nz = 1;
              contactX = rx;
              contactZ = -177.2;
              hit = true;
            } else if (rz > bMaxZ) {
              rz = bMaxZ;
              nx = 0;
              nz = -1;
              contactX = rx;
              contactZ = -162.8;
              hit = true;
            }
          } else if (onSouthFrontier && !onCentralSouthGateway) {
            const bMinZ = 162.8 + r;
            const bMaxZ = 177.2 - r;
            if (rz < bMinZ) {
              rz = bMinZ;
              nx = 0;
              nz = 1;
              contactX = rx;
              contactZ = 162.8;
              hit = true;
            } else if (rz > bMaxZ) {
              rz = bMaxZ;
              nx = 0;
              nz = -1;
              contactX = rx;
              contactZ = 177.2;
              hit = true;
            }
          } else if (onEastSpan || onWestSpan) {
            const bMinZ = -7.7 + r;
            const bMaxZ = 7.7 - r;
            if (rz < bMinZ) {
              rz = bMinZ;
              nx = 0;
              nz = 1;
              contactX = rx;
              contactZ = -7.7;
              hit = true;
            } else if (rz > bMaxZ) {
              rz = bMaxZ;
              nx = 0;
              nz = -1;
              contactX = rx;
              contactZ = 7.7;
              hit = true;
            }
          }
        }
      }
    } else {
      // Speedboat collision: keep boats inside navigable water across both core map and infinite ocean chunks!
      if (!this.isWaterAt(rx, rz)) {
        hit = true;
        if (Math.abs(rx) > 180.0 || Math.abs(rz) > 180.0) {
          const { cx, cz } = this.getPlayerChunkCoords(rx, rz);
          const lx = rx - cx * 120;
          const lz = rz - cz * 120;
          if (Math.abs(lx) >= Math.abs(lz)) {
            const signX = lx >= 0 ? 1 : -1;
            rx = cx * 120 + signX * (54.5 + r);
            nx = signX;
          } else {
            const signZ = lz >= 0 ? 1 : -1;
            rz = cz * 120 + signZ * (54.5 + r);
            nz = signZ;
          }
        } else if (rx >= 34.0 && rx <= 128.0) {
          if (rx < 81.0) {
            rx = 33.5 - r;
            nx = -1;
          } else {
            rx = 128.5 + r;
            nx = 1;
          }
        } else if (rx >= 15.0 && rx <= 34.0 && rz <= -12.0) {
          rx = 14.5 - r;
          nx = -1;
        } else if (rx <= -100.0 && rz <= 158.0) {
          rx = -99.5 + r;
          nx = 1;
        } else if (rx >= -100.0 && rx <= -75.0 && rz <= 86.0) {
          rx = -74.5 + r;
          nx = 1;
        } else if (rx >= -72.0 && rx <= 12.0 && rz >= -68.0 && rz <= 68.0) {
          const dW = Math.abs(rx - (-72.0));
          const dE = Math.abs(12.0 - rx);
          const dN = Math.abs(rz - (-68.0));
          const dS = Math.abs(68.0 - rz);
          const m = Math.min(dW, dE, dN, dS);
          if (m === dW) { rx = -72.5 - r; nx = -1; }
          else if (m === dE) { rx = 12.5 + r; nx = 1; }
          else if (m === dN) { rz = -68.5 - r; nz = -1; }
          else { rz = 68.5 + r; nz = 1; }
        } else if (rz >= 102.0 && rz <= 134.5) {
          if (rx >= 8.0 && rx <= 22.0) {
            rx = rx < 15.0 ? 7.6 - r : 22.4 + r;
            nx = rx < 15.0 ? -1 : 1;
          } else if (rx >= -62.0 && rx <= -48.0) {
            rx = rx < -55.0 ? -62.4 - r : -47.6 + r;
            nx = rx < -55.0 ? -1 : 1;
          }
        }
      }
    }

    return { x: rx, z: rz, hit, nx, nz, contactX, contactZ };
  }

  getBuildingColliders() {
    return this.buildingColliders;
  }

  getPalmColliders() {
    return this.palmColliders;
  }

  getInteractables() {
    return this.interactables;
  }

  getRoadWaypoints() {
    return this.roadWaypoints;
  }
}

export default ViceCityWorld;
