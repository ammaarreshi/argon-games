import * as THREE from '../assets/vendor/three.module.js';

/**
 * Shared global uniforms driving the signature Argon Valley
 * cylindrical rolling-world horizon deformation and organic foliage wind sway.
 */
export const WORLD_CURVE_UNIFORMS = {
  uCurveStrength: { value: 0.0115 },
  uCurveRadialX: { value: 0.22 },
  uCameraZ: { value: 0.0 },
  uCameraX: { value: 0.0 },
  uCurveStartDist: { value: 5.5 },
  uCurveEnabled: { value: 1.0 },
  uTime: { value: 0.0 },
  uWindStrength: { value: 1.0 },
};

/**
 * Injects the Argon Valley cylindrical rolling-world vertex deformation
 * (and optional organic foliage wind sway + squash-and-stretch) into any
 * Three.js material (`MeshPhysicalMaterial`, `MeshStandardMaterial`,
 * `MeshBasicMaterial`, `MeshLambertMaterial`, `MeshToonMaterial`, or
 * `MeshDepthMaterial`).
 *
 * @param {THREE.Material|THREE.Material[]} material
 * @param {Object} [options]
 * @param {number} [options.swayAmount=0.0]
 * @param {number} [options.swaySpeed=1.8]
 * @param {number} [options.swayHeightScale=0.65]
 * @returns {THREE.Material|THREE.Material[]}
 */
export function applyWorldCurve(material, options = {}) {
  if (!material) return material;
  if (Array.isArray(material)) {
    for (let i = 0; i < material.length; i++) {
      applyWorldCurve(material[i], options);
    }
    return material;
  }

  material.userData = material.userData || {};
  const swayAmount =
    options.swayAmount !== undefined
      ? Number(options.swayAmount)
      : material.userData.swayAmount !== undefined
        ? Number(material.userData.swayAmount)
        : 0.0;
  const swaySpeed =
    options.swaySpeed !== undefined
      ? Number(options.swaySpeed)
      : material.userData.swaySpeed !== undefined
        ? Number(material.userData.swaySpeed)
        : 1.85;
  const swayHeightScale =
    options.swayHeightScale !== undefined
      ? Number(options.swayHeightScale)
      : 0.65;

  material.userData.swayAmount = swayAmount;
  material.userData.swaySpeed = swaySpeed;
  material.userData.swayHeightScale = swayHeightScale;

  if (material.userData.worldCurveApplied) {
    if (material.userData.worldCurveShader) {
      material.userData.worldCurveShader.uniforms.uSwayAmount.value = swayAmount;
      material.userData.worldCurveShader.uniforms.uSwaySpeed.value = swaySpeed;
      material.userData.worldCurveShader.uniforms.uSwayHeightScale.value =
        swayHeightScale;
    }
    return material;
  }

  material.userData.worldCurveApplied = true;

  // If this is a custom ShaderMaterial, bind shared uniforms without clobbering custom GLSL
  if (material.isShaderMaterial || material.isRawShaderMaterial) {
    material.uniforms = material.uniforms || {};
    Object.assign(material.uniforms, WORLD_CURVE_UNIFORMS);
    return material;
  }

  const prevOnBeforeCompile = material.onBeforeCompile;
  const prevCacheKey =
    typeof material.customProgramCacheKey === 'function'
      ? material.customProgramCacheKey.bind(material)
      : null;

  const cacheSuffix = `ac_world_curve_v1_sway_${swayAmount.toFixed(3)}_${swaySpeed.toFixed(2)}`;
  material.customProgramCacheKey = function () {
    const base = prevCacheKey ? prevCacheKey() : '';
    return `${base}|${cacheSuffix}`;
  };

  material.onBeforeCompile = function (shader, renderer) {
    if (prevOnBeforeCompile) {
      prevOnBeforeCompile.call(this, shader, renderer);
    }

    shader.uniforms.uCurveStrength = WORLD_CURVE_UNIFORMS.uCurveStrength;
    shader.uniforms.uCurveRadialX = WORLD_CURVE_UNIFORMS.uCurveRadialX;
    shader.uniforms.uCameraZ = WORLD_CURVE_UNIFORMS.uCameraZ;
    shader.uniforms.uCameraX = WORLD_CURVE_UNIFORMS.uCameraX;
    shader.uniforms.uCurveStartDist = WORLD_CURVE_UNIFORMS.uCurveStartDist;
    shader.uniforms.uCurveEnabled = WORLD_CURVE_UNIFORMS.uCurveEnabled;
    shader.uniforms.uTime = WORLD_CURVE_UNIFORMS.uTime;
    shader.uniforms.uWindStrength = WORLD_CURVE_UNIFORMS.uWindStrength;
    shader.uniforms.uSwayAmount = { value: material.userData.swayAmount || 0.0 };
    shader.uniforms.uSwaySpeed = { value: material.userData.swaySpeed || 1.85 };
    shader.uniforms.uSwayHeightScale = {
      value: material.userData.swayHeightScale || 0.65,
    };

    material.userData.worldCurveShader = shader;

    if (!shader.vertexShader.includes('uniform float uCurveStrength;')) {
      shader.vertexShader =
        `
uniform float uCurveStrength;
uniform float uCurveRadialX;
uniform float uCameraZ;
uniform float uCameraX;
uniform float uCurveStartDist;
uniform float uCurveEnabled;
uniform float uTime;
uniform float uWindStrength;
uniform float uSwayAmount;
uniform float uSwaySpeed;
uniform float uSwayHeightScale;
` + shader.vertexShader;
    }

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 wp = modelMatrix * mvPosition;
if (uSwayAmount > 0.0001) {
  float localH = max(0.0, transformed.y) * uSwayHeightScale;
  float hFactor = clamp(localH, 0.0, 2.4);
  float phase = uTime * uSwaySpeed + wp.x * 0.72 + wp.z * 0.64;
  float waveX = sin(phase) * 0.055 + sin(phase * 2.15 + 1.3) * 0.022;
  float waveZ = cos(phase * 0.88 + 0.7) * 0.042;
  float squash = 1.0 + sin(phase * 1.7) * 0.018 * uSwayAmount * uWindStrength;
  wp.x += waveX * uSwayAmount * uWindStrength * hFactor;
  wp.z += waveZ * uSwayAmount * uWindStrength * hFactor;
  wp.y -= (abs(waveX) * 0.028 * uSwayAmount * uWindStrength * hFactor) * squash;
}
if (uCurveEnabled > 0.5) {
  float dz = wp.z - uCameraZ;
  float dx = (wp.x - uCameraX) * uCurveRadialX;
  float dist = max(0.0, length(vec2(dx, dz)) - uCurveStartDist);
  wp.y -= uCurveStrength * dist * dist;
}
mvPosition = viewMatrix * wp;
gl_Position = projectionMatrix * mvPosition;
`
    );

    // Keep worldPosition synchronized with wp so shadow map projections on curved
    // receivers align with createCurvedDepthMaterial shadow casters.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `
#include <worldpos_vertex>
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
  worldPosition = wp;
#endif
`
    );
  };

  material.needsUpdate = true;
  return material;
}

const _depthMaterialCache = new Map();

/**
 * Creates a `THREE.MeshDepthMaterial` with `RGBADepthPacking` and the exact same
 * world-curve + wind-sway vertex shader so shadow-casting curved meshes cast
 * accurate shadows onto curved terrain.
 *
 * @param {Object} [options]
 * @param {number} [options.swayAmount=0.0]
 * @param {number} [options.swaySpeed=1.85]
 * @param {THREE.Texture} [options.map]
 * @param {number} [options.alphaTest=0.0]
 * @returns {THREE.MeshDepthMaterial}
 */
export function createCurvedDepthMaterial(options = {}) {
  const swayAmount = Number(options.swayAmount || 0.0);
  const swaySpeed = Number(options.swaySpeed || 1.85);
  const alphaTest = Number(options.alphaTest || 0.0);
  const map = options.map || null;

  if (!map && alphaTest === 0.0) {
    const cacheKey = `${swayAmount.toFixed(3)}_${swaySpeed.toFixed(2)}`;
    if (_depthMaterialCache.has(cacheKey)) {
      return _depthMaterialCache.get(cacheKey);
    }
    const depthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
    });
    applyWorldCurve(depthMat, { swayAmount, swaySpeed });
    _depthMaterialCache.set(cacheKey, depthMat);
    return depthMat;
  }

  const depthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map,
    alphaTest,
  });
  applyWorldCurve(depthMat, { swayAmount, swaySpeed });
  return depthMat;
}

/**
 * Traverses a `THREE.Object3D` hierarchy, configures `castShadow` and `receiveShadow`
 * (unless `mesh.userData.noShadow` is set), applies `applyWorldCurve` to every mesh
 * material (respecting `mesh.userData.swayAmount` if present), and attaches
 * `mesh.customDepthMaterial = createCurvedDepthMaterial(...)` when `mesh.castShadow` is true.
 *
 * @param {THREE.Object3D} rootObject
 * @param {Object} [options]
 * @returns {THREE.Object3D}
 */
export function applyWorldCurveToHierarchy(rootObject, options = {}) {
  if (!rootObject || typeof rootObject.traverse !== 'function') {
    return rootObject;
  }

  rootObject.traverse((child) => {
    if (!child.isMesh) return;
    child.userData = child.userData || {};

    const primaryMat = Array.isArray(child.material)
      ? child.material[0]
      : child.material;

    const isTransparentDecal = Boolean(
      primaryMat &&
        primaryMat.transparent &&
        (primaryMat.depthWrite === false || primaryMat.opacity < 0.72)
    );

    if (!child.userData.noShadow) {
      if (child.userData.castShadow !== undefined) {
        child.castShadow = Boolean(child.userData.castShadow);
      } else if (options.castShadow !== undefined) {
        child.castShadow = Boolean(options.castShadow) && !isTransparentDecal;
      } else {
        child.castShadow = !isTransparentDecal;
      }

      if (child.userData.receiveShadow !== undefined) {
        child.receiveShadow = Boolean(child.userData.receiveShadow);
      } else if (options.receiveShadow !== undefined) {
        child.receiveShadow = Boolean(options.receiveShadow);
      } else {
        child.receiveShadow = true;
      }
    }

    const meshSwayAmount =
      child.userData.swayAmount !== undefined
        ? child.userData.swayAmount
        : options.swayAmount !== undefined
          ? options.swayAmount
          : primaryMat && primaryMat.userData && primaryMat.userData.swayAmount !== undefined
            ? primaryMat.userData.swayAmount
            : 0.0;

    const meshSwaySpeed =
      child.userData.swaySpeed !== undefined
        ? child.userData.swaySpeed
        : options.swaySpeed !== undefined
          ? options.swaySpeed
          : 1.85;

    const curveOpts = {
      ...options,
      swayAmount: meshSwayAmount,
      swaySpeed: meshSwaySpeed,
    };

    if (child.material) {
      applyWorldCurve(child.material, curveOpts);
    }

    if (child.castShadow && !child.userData.noDepthMaterial) {
      child.customDepthMaterial = createCurvedDepthMaterial({
        swayAmount: meshSwayAmount,
        swaySpeed: meshSwaySpeed,
        map: primaryMat && primaryMat.alphaTest > 0 ? primaryMat.map : null,
        alphaTest: primaryMat && primaryMat.alphaTest ? primaryMat.alphaTest : 0.0,
      });
    }
  });

  return rootObject;
}

/**
 * Spatial coordinate, continuous heightfield, surface classification, dirt path
 * tile registry, and circle-collider resolution system for the 80x80m Argon Valley.
 */
export class IslandGridSystem {
  constructor(width = 80, depth = 80, tileSize = 1.0) {
    this.width = width;
    this.depth = depth;
    this.tileSize = tileSize;
    this.halfWidth = width * 0.5;
    this.halfDepth = depth * 0.5;

    /** @type {Map<string, {x: number, z: number, gx: number, gz: number}>} */
    this.dirtPathTiles = new Map();

    /** @type {Array<{x: number, z: number, radius: number, meta: Object}>} */
    this.colliders = [];

    this._initDefaultDirtPaths();
  }

  /**
   * Pre-populates the signature L-shaped ochre dirt path in front of the Player
   * Cottage House (`x = -6.5, z = -9.5` leading down to `z = -5.5` and turning
   * right to `x = -2.2, z = -6.2`) matching `ref_02_house_yard.png`.
   */
  _initDefaultDirtPaths() {
    const initialCoords = [
      // Porch welcome landing right in front of cottage steps (x = -6.5, z = -8.0)
      [-7.2, -8.2],
      [-6.5, -8.2],
      [-5.8, -8.2],
      [-7.2, -7.5],
      [-6.5, -7.5],
      [-5.8, -7.5],
      // Main vertical stem going down from cottage door toward foreground
      [-6.5, -6.8],
      [-5.8, -6.8],
      [-6.5, -6.2],
      [-5.8, -6.2],
      [-6.5, -5.5],
      [-5.8, -5.5],
      [-6.5, -4.8],
      // Horizontal L-arm turning right toward player trowel spot (x = -2.2, z = -6.2)
      [-5.0, -6.5],
      [-5.0, -5.9],
      [-4.2, -6.5],
      [-4.2, -5.9],
      [-3.4, -6.5],
      [-3.4, -5.9],
      [-2.6, -6.2],
      [-2.2, -6.2],
    ];

    for (const [x, z] of initialCoords) {
      this._setDirtTileInternal(x, z, true);
    }
  }

  _tileKey(x, z) {
    const gx = Math.round(x / 0.8);
    const gz = Math.round(z / 0.8);
    return { key: `${gx},${gz}`, gx, gz, x: gx * 0.8, z: gz * 0.8 };
  }

  _setDirtTileInternal(x, z, enabled = true) {
    const { key, gx, gz } = this._tileKey(x, z);
    if (enabled) {
      this.dirtPathTiles.set(key, { x, z, gx, gz });
    } else {
      this.dirtPathTiles.delete(key);
    }
  }

  /**
   * Center Z coordinate of the East-West winding river at world X.
   * Synchronized 1:1 with EnvironmentBuilder._getRiverCenterZ(x).
   * @param {number} x
   * @returns {number}
   */
  getRiverCenterZ(x) {
    return -3.85 + Math.sin((x + 2.5) * 0.14) * 0.52;
  }

  /**
   * Half-width of the river channel at world X.
   * Synchronized 1:1 with EnvironmentBuilder._getRiverHalfWidth(x).
   * @param {number} x
   * @returns {number}
   */
  getRiverHalfWidth(x) {
    return 1.05 + Math.cos(x * 0.18) * 0.08;
  }

  /**
   * Returns true if `(x, z)` lies on any of the island's bridges:
   * 1. Central Wooden Footbridge (`x in [-5.0, -2.4], z in [-5.6, -2.1]`)
   * 2. Eastern Wooden Footbridge (`x in [4.1, 6.7], z in [-5.6, -2.1]`)
   * 3. River Mouth Stone Arch Bridge (`x in [7.6, 13.2], z in [12.6, 15.8]`)
   * @param {number} x
   * @param {number} z
   * @returns {boolean}
   */
  isBridgeAt(x, z) {
    // 1. Central Wooden Footbridge across East-West river (Cottage Yard <-> Flower Garden)
    if (x >= -5.0 && x <= -2.4 && z >= -5.6 && z <= -2.1) {
      return true;
    }
    // 2. Eastern Wooden Footbridge across East-West river (Yellow Tent <-> Plaza Fountain)
    if (x >= 4.1 && x <= 6.7 && z >= -5.6 && z <= -2.1) {
      return true;
    }
    // 3. Stone Arch Bridge spanning the southern river mouth
    if (x >= 7.6 && x <= 13.2 && z >= 12.6 && z <= 15.8) {
      return true;
    }
    return false;
  }

  /**
   * Returns true if `(x, z)` is on the sculpted natural cliff incline ramp
   * connecting the Main Village Grass Plateau (`y = 0.60` at `z = -10.2`) to
   * the Upper Cliff Plateau (`y = 3.20` at `z = -14.2`).
   * @param {number} x
   * @param {number} z
   * @returns {boolean}
   */
  isCliffRampAt(x, z) {
    return x >= -4.8 && x <= -2.2 && z >= -14.4 && z <= -10.2;
  }

  /**
   * Returns the water surface elevation at `(x, z)`, if water is present.
   * @param {number} x
   * @param {number} z
   * @returns {number}
   */
  getWaterHeight(x, z) {
    if (z < -13.5 && x >= -13.2 && x <= -8.8) {
      return 2.95;
    }
    if (z >= -13.5 && z <= 13.5) {
      const rCenter = this.getRiverCenterZ(x);
      const rHalf = this.getRiverHalfWidth(x);
      if (Math.abs(z - rCenter) < rHalf) {
        return 0.18;
      }
    }
    // North-South river mouth channel flowing from East-West river down to ocean
    if (z >= -4.2 && z <= 22.8 && x >= 8.9 && x <= 11.9) {
      return 0.18;
    }
    return 0.0;
  }

  /**
   * Continuous terrain heightfield matching Agent 2's multi-tier island geometry.
   * @param {number} x
   * @param {number} z
   * @returns {number}
   */
  getTerrainHeight(x, z) {
    // 1a. Central or Eastern Wooden Footbridge across the East-West river
    if (
      ((x >= -5.0 && x <= -2.4) || (x >= 4.1 && x <= 6.7)) &&
      z >= -5.6 &&
      z <= -2.1
    ) {
      const normZ = THREE.MathUtils.clamp((z - -3.85) / 1.75, -1.0, 1.0);
      return 0.6 + Math.cos(normZ * Math.PI * 0.5) * 0.24;
    }

    // 1b. Stone Arch Bridge spanning the river mouth at x in [7.6, 13.2], z in [12.6, 15.8]
    if (x >= 7.6 && x <= 13.2 && z >= 12.6 && z <= 15.8) {
      const normX = THREE.MathUtils.clamp((x - 10.45) / 2.6, -1.0, 1.0);
      return 0.6 + Math.cos(normX * Math.PI * 0.5) * 0.52;
    }

    // 1c. Natural Cliff Incline Ramp (x in [-4.8, -2.2], z in [-14.4, -10.2])
    if (this.isCliffRampAt(x, z)) {
      const t = THREE.MathUtils.clamp((-10.2 - z) / (-10.2 - -14.0), 0.0, 1.0);
      const smoothT = t * t * (3.0 - 2.0 * t);
      return THREE.MathUtils.lerp(0.6, 3.2, smoothT);
    }

    // 2. Upper Cliff Plateau (north of z = -13.5)
    if (z < -13.5 && Math.abs(x) < 28.0) {
      if (x >= -13.2 && x <= -8.8) {
        return 2.95;
      }
      return 3.2;
    }

    // 3. Main Village Grass Plateau (-13.5 <= z <= 13.5 and |x| < 30)
    if (z >= -13.5 && z <= 13.5 && Math.abs(x) < 30.0) {
      const riverZ = this.getRiverCenterZ(x);
      const riverHalf = this.getRiverHalfWidth(x);
      const distToRiver = Math.abs(z - riverZ);
      if (distToRiver < riverHalf) {
        return -0.35;
      }
      // North-South river mouth channel on eastern side (x in [9.1, 11.8], z > riverZ)
      if (z >= riverZ && x >= 9.1 && x <= 11.8) {
        return -0.35;
      }
      return 0.6;
    }

    // 4. Southern Sandy Beach & Ocean Shore (z > 13.5 or radial island shore)
    if (z > 13.5) {
      if (z <= 13.8) {
        const t = (z - 13.5) / 0.3;
        return THREE.MathUtils.lerp(0.6, 0.52, t);
      }
      if (z <= 22.5) {
        const t = THREE.MathUtils.clamp((z - 13.8) / (22.5 - 13.8), 0.0, 1.0);
        // Smooth cosine-eased beach slope from 0.52 down to 0.02 at the shoreline
        const smoothT = t * t * (3.0 - 2.0 * t);
        return THREE.MathUtils.lerp(0.52, 0.02, smoothT);
      }
      if (z <= 24.5) {
        const t = THREE.MathUtils.clamp((z - 22.5) / 2.0, 0.0, 1.0);
        return THREE.MathUtils.lerp(0.02, -0.6, t);
      }
      return -0.6;
    }

    // Radial lateral shore for |x| >= 28..36
    const absX = Math.abs(x);
    if (absX >= 28.0) {
      if (absX >= 35.0) return -0.6;
      const t = (absX - 28.0) / 7.0;
      return THREE.MathUtils.lerp(0.52, -0.6, t);
    }

    return 0.6;
  }

  /**
   * Returns true if `(x, z)` is on a dirt path tile.
   * @param {number} x
   * @param {number} z
   * @returns {boolean}
   */
  isDirtPathAt(x, z) {
    // Check exact L-shaped yard path bounding boxes + dynamic tiles
    const inPorchLanding = x >= -7.45 && x <= -5.45 && z >= -8.55 && z <= -7.15;
    const inVerticalStem = x >= -6.95 && x <= -5.45 && z >= -8.55 && z <= -4.45;
    const inHorizontalArm = x >= -6.45 && x <= -1.85 && z >= -6.85 && z <= -5.55;
    if (inPorchLanding || inVerticalStem || inHorizontalArm) {
      return true;
    }

    const { key } = this._tileKey(x, z);
    if (this.dirtPathTiles.has(key)) return true;

    for (const tile of this.dirtPathTiles.values()) {
      if (Math.hypot(x - tile.x, z - tile.z) <= 0.62) {
        return true;
      }
    }
    return false;
  }

  /**
   * Classifies the surface at `(x, z)` for footstep audio, tool interactions,
   * and movement rules.
   * @param {number} x
   * @param {number} z
   * @returns {'bridge' | 'dirt_path' | 'stone_plaza' | 'river' | 'ocean' | 'cliff' | 'sand' | 'grass'}
   */
  getSurfaceType(x, z) {
    if (this.isBridgeAt(x, z)) {
      return 'bridge';
    }

    if (this.isCliffRampAt(x, z)) {
      return 'dirt_path';
    }

    if (z > 22.5 || Math.abs(x) > 34.5) {
      return 'ocean';
    }

    if (z < -13.5 && Math.abs(x) < 28.0) {
      if (x >= -13.2 && x <= -8.8) {
        return 'river';
      }
      return 'cliff';
    }

    const riverZ = this.getRiverCenterZ(x);
    const riverHalf = this.getRiverHalfWidth(x);
    if (z >= -13.5 && z <= 13.5 && Math.abs(z - riverZ) < riverHalf) {
      return 'river';
    }

    // North-South river mouth channel flowing south into the ocean near x = 9.1..11.8
    if (z >= riverZ && z <= 22.5 && x >= 9.1 && x <= 11.8) {
      return 'river';
    }

    // Waterfall plunge pool at x in [-12.6, -9.2], z in [-13.5, -10.8]
    if (x >= -12.6 && x <= -9.2 && z >= -13.5 && z <= -10.8) {
      return 'river';
    }

    if (this.isDirtPathAt(x, z)) {
      return 'dirt_path';
    }

    // Marble fountain stone plaza area (x around 4.5, z around 13.2)
    if (x >= 2.0 && x <= 7.2 && z >= 10.8 && z <= 15.2) {
      return 'stone_plaza';
    }

    if (z > 13.5 || Math.abs(x) >= 28.0) {
      return 'sand';
    }

    return 'grass';
  }

  /**
   * Toggles a dirt path tile at `(x, z)` and returns `{ added, tile, tiles }`.
   * @param {number} x
   * @param {number} z
   */
  toggleDirtPathAt(x, z) {
    const surface = this.getSurfaceType(x, z);
    if (surface === 'river' || surface === 'ocean' || surface === 'bridge') {
      return { added: false, tile: null, tiles: this.getDirtPathTiles() };
    }

    const { key, gx, gz, x: snappedX, z: snappedZ } = this._tileKey(x, z);
    if (this.dirtPathTiles.has(key)) {
      this.dirtPathTiles.delete(key);
      return { added: false, tile: { x: snappedX, z: snappedZ, gx, gz }, tiles: this.getDirtPathTiles() };
    }

    const tile = { x: snappedX, z: snappedZ, gx, gz };
    this.dirtPathTiles.set(key, tile);
    return { added: true, tile, tiles: this.getDirtPathTiles() };
  }

  /**
   * Returns an array of all active dirt path tile descriptors `{ x, z, gx, gz }`.
   */
  getDirtPathTiles() {
    return Array.from(this.dirtPathTiles.values());
  }

  /**
   * Registers a circular obstacle collider in the island grid.
   * @param {number} x
   * @param {number} z
   * @param {number} [radius=0.6]
   * @param {Object} [meta={}]
   */
  registerCollider(x, z, radius = 0.6, meta = {}) {
    const entry = {
      x: Number(x),
      z: Number(z),
      radius: Math.max(0.05, Number(radius)),
      meta: meta || {},
      disabled: false,
    };
    this.colliders.push(entry);
    return entry;
  }

  /**
   * Clears all registered dynamic colliders.
   */
  clearColliders() {
    this.colliders.length = 0;
  }

  /**
   * Checks whether `(x, z)` is walkable given the origin `(fromX, fromZ)`.
   * @param {number} fromX
   * @param {number} fromZ
   * @param {number} toX
   * @param {number} toZ
   * @returns {boolean}
   */
  _isStepWalkable(fromX, fromZ, toX, toZ) {
    // World boundary clamp
    if (Math.abs(toX) > 27.5 || toZ < -26.0 || toZ > 22.4) {
      return false;
    }

    const nextSurf = this.getSurfaceType(toX, toZ);
    if (nextSurf === 'ocean') {
      return false;
    }
    if (nextSurf === 'river' && !this.isBridgeAt(toX, toZ)) {
      return false;
    }

    // Prevent walking directly through the vertical cliff wall (z = -13.5),
    // EXCEPT when walking along the natural cliff incline ramp!
    const fromOnCliff = fromZ < -13.5;
    const toOnCliff = toZ < -13.5;
    if (fromOnCliff !== toOnCliff) {
      if (!this.isCliffRampAt(fromX, fromZ) && !this.isCliffRampAt(toX, toZ)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Resolves character movement from `(curX, curZ)` to `(nextX, nextZ)` with
   * smooth sliding against riverbanks, cliffs, ocean surf, and circular colliders.
   * Guarantees the player can NEVER get trapped inside a collider or non-walkable spot.
   *
   * @param {number} curX
   * @param {number} curZ
   * @param {number} nextX
   * @param {number} nextZ
   * @param {number} [radius=0.34]
   * @returns {{x: number, z: number, y: number, surface: string, collided: boolean, hitCollider: Object|null}}
   */
  resolveMovement(curX, curZ, nextX, nextZ, radius = 0.34) {
    let resolvedX = nextX;
    let resolvedZ = nextZ;
    let collided = false;
    let hitCollider = null;

    if (!this._isStepWalkable(curX, curZ, resolvedX, resolvedZ)) {
      collided = true;
      // Try sliding along X or Z independently
      if (this._isStepWalkable(curX, curZ, nextX, curZ)) {
        resolvedX = nextX;
        resolvedZ = curZ;
      } else if (this._isStepWalkable(curX, curZ, curX, nextZ)) {
        resolvedX = curX;
        resolvedZ = nextZ;
      } else {
        resolvedX = curX;
        resolvedZ = curZ;
      }
    }

    // Push out against registered circular colliders
    for (let i = 0; i < this.colliders.length; i++) {
      const col = this.colliders[i];
      if (!col || col.disabled) continue;

      const minDist = col.radius + radius;
      const dx = resolvedX - col.x;
      const dz = resolvedZ - col.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist) {
        collided = true;
        hitCollider = col;
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = (minDist - dist) / dist;
          const candX = resolvedX + dx * push;
          const candZ = resolvedZ + dz * push;
          if (this._isStepWalkable(curX, curZ, candX, candZ)) {
            resolvedX = candX;
            resolvedZ = candZ;
          } else {
            // If player started inside the collider and is moving outward, allow the outward step
            const curDistSq = (curX - col.x) * (curX - col.x) + (curZ - col.z) * (curZ - col.z);
            if (distSq < curDistSq) {
              resolvedX = curX;
              resolvedZ = curZ;
            }
          }
        } else {
          resolvedX = col.x + minDist;
        }
      }
    }

    const y = this.getTerrainHeight(resolvedX, resolvedZ);
    const surface = this.getSurfaceType(resolvedX, resolvedZ);

    return {
      x: resolvedX,
      z: resolvedZ,
      y,
      surface,
      collided,
      hitCollider,
    };
  }
}

/**
 * Authoritative camera presets framing each of the 6 Argon Valley
 * reference scenes + dynamic gameplay follow mode.
 */
export const CAMERA_SCENE_PRESETS = {
  beach_sunset: {
    name: 'beach_sunset',
    label: 'Beach Sunset (Ref 01)',
    camPos: new THREE.Vector3(0.0, 2.05, 25.2),
    lookAt: new THREE.Vector3(0.0, 1.05, 16.5),
    fov: 33,
    curveStrength: 0.014,
    curveStartDist: 5.5,
    timePreset: 'golden_hour',
  },
  house_yard: {
    name: 'house_yard',
    label: 'House Yard (Ref 02)',
    camPos: new THREE.Vector3(-2.5, 7.55, 1.35),
    lookAt: new THREE.Vector3(-2.5, 0.85, -7.8),
    fov: 34,
    curveStrength: 0.011,
    curveStartDist: 5.5,
    timePreset: 'noon',
  },
  flower_river: {
    name: 'flower_river',
    label: 'Flower Garden & River (Ref 03)',
    camPos: new THREE.Vector3(-2.8, 4.35, 4.65),
    lookAt: new THREE.Vector3(-2.8, 0.95, -3.4),
    fov: 32,
    curveStrength: 0.012,
    curveStartDist: 5.5,
    timePreset: 'noon',
  },
  tent_horizon: {
    name: 'tent_horizon',
    label: 'Yellow Tent Horizon (Ref 04)',
    camPos: new THREE.Vector3(9.2, 3.65, -0.6),
    lookAt: new THREE.Vector3(9.5, 0.85, -8.8),
    fov: 32,
    curveStrength: 0.015,
    curveStartDist: 5.5,
    timePreset: 'noon',
  },
  bridge_plaza: {
    name: 'bridge_plaza',
    label: 'Beach & Bridge Plaza (Ref 05)',
    camPos: new THREE.Vector3(5.8, 4.35, 27.2),
    lookAt: new THREE.Vector3(5.8, 0.75, 16.8),
    fov: 34,
    curveStrength: 0.010,
    curveStartDist: 5.5,
    timePreset: 'noon',
  },
  cliff_waterfall: {
    name: 'cliff_waterfall',
    label: 'Cliff & Waterfall (Ref 06)',
    camPos: new THREE.Vector3(-7.5, 5.35, -1.35),
    lookAt: new THREE.Vector3(-7.7, 1.05, -10.4),
    fov: 34,
    curveStrength: 0.011,
    curveStartDist: 5.5,
    timePreset: 'noon',
  },
  follow_player: {
    name: 'follow_player',
    label: 'Follow Player',
    offset: new THREE.Vector3(0.0, 6.6, 8.8),
    lookAtOffset: new THREE.Vector3(0.0, 0.75, -0.35),
    fov: 33,
    curveStrength: 0.0115,
    curveStartDist: 5.5,
  },
};

/**
 * Smooth spring-damped diorama camera rig supporting the 6 deterministic Argon Valley
 * reference presets, dynamic player follow mode, Q/E pitch/yaw tilt, and
 * continuous synchronization of `WORLD_CURVE_UNIFORMS.uCameraX` and `uCameraZ`.
 */
export class CozyCameraRig {
  constructor(camera, domElement = null) {
    this.camera = camera;
    this.domElement = domElement;

    if (this.camera && this.camera.far < 450) {
      this.camera.far = 450;
      this.camera.updateProjectionMatrix();
    }

    this.presets = CAMERA_SCENE_PRESETS;
    this.activePreset = 'house_yard';

    this.currentPos = new THREE.Vector3(-2.5, 7.55, 1.35);
    this.targetPos = new THREE.Vector3(-2.5, 7.55, 1.35);

    this.currentLookAt = new THREE.Vector3(-2.5, 0.85, -7.8);
    this.targetLookAt = new THREE.Vector3(-2.5, 0.85, -7.8);

    this.currentFov = 34;
    this.targetFov = 34;

    this.currentCurveStrength = 0.011;
    this.targetCurveStrength = 0.011;

    this.currentCurveStartDist = 5.5;
    this.targetCurveStartDist = 5.5;

    this.followOffset = new THREE.Vector3(0.0, 6.6, 8.8);
    this.followLookAtOffset = new THREE.Vector3(0.0, 0.75, -0.35);
    this.followTargetPos = new THREE.Vector3(-2.05, 0.6, -6.25);

    this.zoomFactor = 1.0;
    this.yawAngle = 0.0;
    this.pitchOffset = 0.0;
    this.damping = 7.5;

    this._keys = { q: false, e: false };
    this._bindControls();
    this.setCameraPreset('follow_player', true);
  }

  _bindControls() {
    if (typeof window === 'undefined') return;

    this._onKeyDown = (e) => {
      if (e.code === 'KeyQ' || e.code === 'BracketLeft') this._keys.q = true;
      if (e.code === 'KeyR' || e.code === 'BracketRight') this._keys.e = true;
    };

    this._onKeyUp = (e) => {
      if (e.code === 'KeyQ' || e.code === 'BracketLeft') this._keys.q = false;
      if (e.code === 'KeyR' || e.code === 'BracketRight') this._keys.e = false;
    };

    this._onWheel = (e) => {
      const delta = Math.sign(e.deltaY) * 0.06;
      this.zoomFactor = THREE.MathUtils.clamp(this.zoomFactor + delta, 0.62, 1.48);
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    const wheelTarget = this.domElement || window;
    if (wheelTarget && typeof wheelTarget.addEventListener === 'function') {
      wheelTarget.addEventListener('wheel', this._onWheel, { passive: true });
    }
  }

  /**
   * Switches the camera to one of the 6 reference scene presets or `'follow_player'`.
   * Also supports view-style aliases (`'standard'`, `'low_horizon'`, `'high_diorama'`, `'closeup'`).
   *
   * @param {string} presetName
   * @param {boolean} [immediate=false]
   */
  setCameraPreset(presetName, immediate = false) {
    // Support view mode aliases described in ARCHITECTURE.md
    if (presetName === 'standard') {
      this.pitchOffset = 0.0;
      this.zoomFactor = 1.0;
      presetName = 'follow_player';
    } else if (presetName === 'low_horizon') {
      this.pitchOffset = -2.2;
      this.zoomFactor = 0.95;
      this.targetCurveStrength = 0.015;
      presetName = 'follow_player';
    } else if (presetName === 'high_diorama') {
      this.pitchOffset = 2.4;
      this.zoomFactor = 1.15;
      this.targetCurveStrength = 0.009;
      presetName = 'follow_player';
    } else if (presetName === 'closeup') {
      this.pitchOffset = -1.1;
      this.zoomFactor = 0.68;
      presetName = 'follow_player';
    }

    const preset = this.presets[presetName];
    if (!preset) return false;

    this.activePreset = presetName;

    if (presetName === 'follow_player') {
      this.targetFov = preset.fov;
      this.targetCurveStrength = preset.curveStrength;
      this.targetCurveStartDist = preset.curveStartDist;
      this._computeFollowTargets();
    } else {
      this.zoomFactor = 1.0;
      this.yawAngle = 0.0;
      this.pitchOffset = 0.0;
      this.targetPos.copy(preset.camPos);
      this.targetLookAt.copy(preset.lookAt);
      this.targetFov = preset.fov;
      this.targetCurveStrength = preset.curveStrength;
      this.targetCurveStartDist = preset.curveStartDist;
    }

    if (immediate) {
      this.currentPos.copy(this.targetPos);
      this.currentLookAt.copy(this.targetLookAt);
      this.currentFov = this.targetFov;
      this.currentCurveStrength = this.targetCurveStrength;
      this.currentCurveStartDist = this.targetCurveStartDist;
      this._applyToCamera();
    }

    return true;
  }

  /**
   * Updates the tracked player world position used when in `'follow_player'` mode.
   * @param {number|THREE.Vector3|THREE.Object3D} xOrObj
   * @param {number} [y]
   * @param {number} [z]
   */
  setFollowTarget(xOrObj, y, z) {
    if (xOrObj && typeof xOrObj === 'object') {
      const pos = xOrObj.position || xOrObj;
      if (pos.x !== undefined && pos.z !== undefined) {
        this.followTargetPos.set(pos.x, pos.y || 0, pos.z);
      }
    } else if (typeof xOrObj === 'number') {
      this.followTargetPos.set(xOrObj, y || 0, z || 0);
    }
  }

  _computeFollowTargets() {
    const cosY = Math.cos(this.yawAngle);
    const sinY = Math.sin(this.yawAngle);
    const baseX = this.followOffset.x * this.zoomFactor;
    const baseY = (this.followOffset.y + this.pitchOffset) * this.zoomFactor;
    const baseZ = this.followOffset.z * this.zoomFactor;

    const rotX = baseX * cosY + baseZ * sinY;
    const rotZ = -baseX * sinY + baseZ * cosY;

    this.targetPos.set(
      this.followTargetPos.x + rotX,
      Math.max(1.4, this.followTargetPos.y + baseY),
      this.followTargetPos.z + rotZ
    );
    this.targetLookAt.set(
      this.followTargetPos.x + this.followLookAtOffset.x,
      this.followTargetPos.y + this.followLookAtOffset.y,
      this.followTargetPos.z + this.followLookAtOffset.z
    );
  }

  _applyToCamera() {
    if (this.camera) {
      this.camera.position.copy(this.currentPos);
      this.camera.lookAt(this.currentLookAt);
      let needsProj = false;
      if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
        this.camera.fov = this.currentFov;
        needsProj = true;
      }
      if (this.camera.far < 450) {
        this.camera.far = 450;
        needsProj = true;
      }
      if (needsProj) {
        this.camera.updateProjectionMatrix();
      }
    }

    // Anchor the flat near-field around the focal foreground area (between lookAt and camera)
    // so characters, furniture legs, and ground shadows never float, while background
    // terrain and horizon curve smoothly downward.
    const focalX = THREE.MathUtils.lerp(this.currentLookAt.x, this.currentPos.x, 0.25);
    const focalZ = THREE.MathUtils.lerp(this.currentLookAt.z, this.currentPos.z, 0.25);

    WORLD_CURVE_UNIFORMS.uCameraX.value = focalX;
    WORLD_CURVE_UNIFORMS.uCameraZ.value = focalZ;
    WORLD_CURVE_UNIFORMS.uCurveStrength.value = this.currentCurveStrength;
    WORLD_CURVE_UNIFORMS.uCurveStartDist.value = this.currentCurveStartDist;
  }

  /**
   * Advances spring-damped camera interpolation and updates `WORLD_CURVE_UNIFORMS`.
   * @param {number} dt
   * @param {THREE.Object3D|THREE.Vector3|Object} [followTarget]
   */
  update(dt = 0.016, followTarget = null) {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.1);

    if (followTarget) {
      this.setFollowTarget(followTarget);
    }

    // Handle Q / E gentle camera pitch/yaw tilt
    if (this._keys.q) {
      this.pitchOffset = THREE.MathUtils.clamp(this.pitchOffset - safeDt * 2.5, -2.4, 2.8);
    }
    if (this._keys.e) {
      this.pitchOffset = THREE.MathUtils.clamp(this.pitchOffset + safeDt * 2.5, -2.4, 2.8);
    }

    if (this.activePreset === 'follow_player') {
      this._computeFollowTargets();
    }

    const alpha = 1.0 - Math.exp(-this.damping * safeDt);
    this.currentPos.lerp(this.targetPos, alpha);
    this.currentLookAt.lerp(this.targetLookAt, alpha);
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, this.targetFov, alpha);
    this.currentCurveStrength = THREE.MathUtils.lerp(
      this.currentCurveStrength,
      this.targetCurveStrength,
      alpha
    );
    this.currentCurveStartDist = THREE.MathUtils.lerp(
      this.currentCurveStartDist,
      this.targetCurveStartDist,
      alpha
    );

    this._applyToCamera();
  }
}

/**
 * Lighting, sky gradient, and cloud color palettes for `'noon'`, `'golden_hour'`,
 * `'morning'`, and `'night'`.
 */
const TIME_OF_DAY_PRESETS = {
  noon: {
    sunPos: new THREE.Vector3(16.0, 28.0, 14.0),
    sunColor: new THREE.Color('#fff9e6'),
    sunIntensity: 1.65,
    hemiSkyColor: new THREE.Color('#8cd3ff'),
    hemiGroundColor: new THREE.Color('#68b84c'),
    hemiIntensity: 0.78,
    ambientColor: new THREE.Color('#d9ecff'),
    ambientIntensity: 0.28,
    zenithColor: new THREE.Color('#3b9ef2'),
    midSkyColor: new THREE.Color('#6ec3fa'),
    horizonColor: new THREE.Color('#bfe8ff'),
    glowColor: new THREE.Color('#fff6d6'),
    cloudLitColor: new THREE.Color('#ffffff'),
    cloudShadowColor: new THREE.Color('#c8dff2'),
    cloudRimColor: new THREE.Color('#fffdf2'),
    starIntensity: 0.0,
  },
  golden_hour: {
    sunPos: new THREE.Vector3(24.0, 13.5, -18.0),
    sunColor: new THREE.Color('#ffcf75'),
    sunIntensity: 1.55,
    hemiSkyColor: new THREE.Color('#7bc9c4'),
    hemiGroundColor: new THREE.Color('#d49557'),
    hemiIntensity: 0.72,
    ambientColor: new THREE.Color('#ffe0b5'),
    ambientIntensity: 0.28,
    // Matches ref_01_beach_sunset.png: deep dusty teal zenith -> warm aqua mid -> golden-amber horizon
    zenithColor: new THREE.Color('#3888a2'),
    midSkyColor: new THREE.Color('#72b8b2'),
    horizonColor: new THREE.Color('#f6d47e'),
    glowColor: new THREE.Color('#ffe898'),
    cloudLitColor: new THREE.Color('#eee0be'),
    cloudShadowColor: new THREE.Color('#848d96'),
    cloudRimColor: new THREE.Color('#ffe898'),
    starIntensity: 0.0,
  },
  morning: {
    sunPos: new THREE.Vector3(22.0, 22.0, 12.0),
    sunColor: new THREE.Color('#fff4d4'),
    sunIntensity: 1.65,
    hemiSkyColor: new THREE.Color('#9ad8ff'),
    hemiGroundColor: new THREE.Color('#7ac756'),
    hemiIntensity: 0.78,
    ambientColor: new THREE.Color('#e8f4ff'),
    ambientIntensity: 0.28,
    zenithColor: new THREE.Color('#57acef'),
    midSkyColor: new THREE.Color('#8acdf7'),
    horizonColor: new THREE.Color('#dff2fc'),
    glowColor: new THREE.Color('#fff5d6'),
    cloudLitColor: new THREE.Color('#fffdf7'),
    cloudShadowColor: new THREE.Color('#cedfed'),
    cloudRimColor: new THREE.Color('#fff9e2'),
    starIntensity: 0.0,
  },
  night: {
    sunPos: new THREE.Vector3(-14.0, 24.0, 12.0),
    sunColor: new THREE.Color('#8eb8ff'),
    sunIntensity: 0.95,
    hemiSkyColor: new THREE.Color('#2c4478'),
    hemiGroundColor: new THREE.Color('#1d3328'),
    hemiIntensity: 0.72,
    ambientColor: new THREE.Color('#283b66'),
    ambientIntensity: 0.28,
    zenithColor: new THREE.Color('#0f1c3d'),
    midSkyColor: new THREE.Color('#1d3566'),
    horizonColor: new THREE.Color('#38578f'),
    glowColor: new THREE.Color('#5475ad'),
    cloudLitColor: new THREE.Color('#4b6491'),
    cloudShadowColor: new THREE.Color('#253659'),
    cloudRimColor: new THREE.Color('#7494c9'),
    starIntensity: 1.0,
  },
};

/**
 * Manages the directional sun/moon light (`2048x2048` shadow map), hemisphere &
 * ambient fill lights, custom multi-stop Argon Valley sky dome shader, and 18 sculpted
 * puffy 3D clouds that curve along the horizon.
 */
export class DayNightCycle {
  constructor(scene = null) {
    this.root = new THREE.Group();
    this.root.name = 'DayNightCycleRoot';

    this.activePreset = 'noon';
    this.currentMode = 'noon';
    this._current = this._cloneState(TIME_OF_DAY_PRESETS.noon);
    this._target = this._cloneState(TIME_OF_DAY_PRESETS.noon);

    this._buildLights();
    this._buildSkyDome();
    this._buildClouds();

    this.setTimePreset('noon', true);

    if (scene && typeof scene.add === 'function') {
      scene.add(this.root);
    }
  }

  _cloneState(preset) {
    return {
      sunPos: preset.sunPos.clone(),
      sunColor: preset.sunColor.clone(),
      sunIntensity: preset.sunIntensity,
      hemiSkyColor: preset.hemiSkyColor.clone(),
      hemiGroundColor: preset.hemiGroundColor.clone(),
      hemiIntensity: preset.hemiIntensity,
      ambientColor: preset.ambientColor.clone(),
      ambientIntensity: preset.ambientIntensity,
      zenithColor: preset.zenithColor.clone(),
      midSkyColor: preset.midSkyColor.clone(),
      horizonColor: preset.horizonColor.clone(),
      glowColor: preset.glowColor.clone(),
      cloudLitColor: preset.cloudLitColor.clone(),
      cloudShadowColor: preset.cloudShadowColor.clone(),
      cloudRimColor: preset.cloudRimColor.clone(),
      starIntensity: preset.starIntensity,
    };
  }

  _buildLights() {
    this.sunLight = new THREE.DirectionalLight('#fff9e6', 1.65);
    this.sunLight.position.set(16.0, 28.0, 14.0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.00035;
    this.sunLight.shadow.normalBias = 0.018;
    this.sunLight.shadow.camera.left = -26;
    this.sunLight.shadow.camera.right = 26;
    this.sunLight.shadow.camera.top = 26;
    this.sunLight.shadow.camera.bottom = -26;
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 90.0;
    this.sunLight.shadow.radius = 2.0;

    this.sunLight.target.position.set(0.0, 0.0, -4.0);
    this.root.add(this.sunLight);
    this.root.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight('#8cd3ff', '#68b84c', 0.78);
    this.hemiLight.position.set(0, 35, 0);
    this.root.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight('#d9ecff', 0.28);
    this.root.add(this.ambientLight);
  }

  _buildSkyDome() {
    const skyGeo = new THREE.SphereGeometry(220, 48, 32);
    this.skyUniforms = {
      uZenithColor: { value: new THREE.Color('#3b9ef2') },
      uMidSkyColor: { value: new THREE.Color('#6ec3fa') },
      uHorizonColor: { value: new THREE.Color('#bfe8ff') },
      uGlowColor: { value: new THREE.Color('#fff6d6') },
      uSunDirection: { value: new THREE.Vector3(0.45, 0.55, -0.7).normalize() },
      uStarIntensity: { value: 0.0 },
      uTime: WORLD_CURVE_UNIFORMS.uTime,
    };

    const skyMat = new THREE.ShaderMaterial({
      name: 'ValleySkyDomeMaterial',
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenithColor;
        uniform vec3 uMidSkyColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uGlowColor;
        uniform vec3 uSunDirection;
        uniform float uStarIntensity;
        uniform float uTime;
        varying vec3 vWorldDir;

        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          // Map view-ray elevation across the visible curved horizon sky band [-0.14..+0.18]
          // so both low-angle beach views and elevated diorama views display the full
          // zenith -> mid-sky -> warm horizon Argon Valley gradient.
          float h = clamp((dir.y + 0.14) / 0.31, 0.0, 1.0);

          vec3 col = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.45, h));
          col = mix(col, uZenithColor, smoothstep(0.38, 0.92, h));

          // Warm solar glow localized to the right-side sunset horizon (matches ref_01_beach_sunset.png)
          vec3 sunDir = normalize(uSunDirection);
          float sunAlignment = max(0.0, dot(dir, sunDir));
          float rightHorizonMask = smoothstep(-0.05, 0.65, dir.x) * (1.0 - smoothstep(0.0, 0.72, h));
          float solarGlow = pow(sunAlignment, 4.5) * 0.35 + rightHorizonMask * 0.55;
          col = mix(col, uGlowColor, clamp(solarGlow, 0.0, 0.72));

          // Twinkling night stars
          if (uStarIntensity > 0.01 && dir.y > -0.05) {
            vec3 starCell = floor(dir * 190.0);
            float rnd = hash31(starCell);
            if (rnd > 0.993) {
              float twinkle = 0.55 + 0.45 * sin(uTime * 2.8 + rnd * 60.0);
              col += vec3(0.95, 0.97, 1.0) * twinkle * uStarIntensity * smoothstep(-0.05, 0.18, dir.y);
            }
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.name = 'ValleySkyDome';
    this.skyDome.frustumCulled = false;
    this.skyDome.userData.noShadow = true;
    this.skyDome.renderOrder = -10;
    this.root.add(this.skyDome);
  }

  _buildClouds() {
    this.cloudGroup = new THREE.Group();
    this.cloudGroup.name = 'ValleyCloudGroup';

    this.cloudUniforms = {
      uLitColor: { value: new THREE.Color('#ffffff') },
      uShadowColor: { value: new THREE.Color('#c8dff2') },
      uRimColor: { value: new THREE.Color('#fffdf2') },
      uSunDirection: { value: new THREE.Vector3(0.55, 0.45, -0.65).normalize() },
      uCurveStrength: WORLD_CURVE_UNIFORMS.uCurveStrength,
      uCurveRadialX: WORLD_CURVE_UNIFORMS.uCurveRadialX,
      uCameraZ: WORLD_CURVE_UNIFORMS.uCameraZ,
      uCameraX: WORLD_CURVE_UNIFORMS.uCameraX,
      uCurveStartDist: WORLD_CURVE_UNIFORMS.uCurveStartDist,
      uCurveEnabled: WORLD_CURVE_UNIFORMS.uCurveEnabled,
    };

    this.cloudMaterial = new THREE.ShaderMaterial({
      name: 'ValleyPuffyCloudMaterial',
      uniforms: this.cloudUniforms,
      vertexShader: `
        uniform float uCurveStrength;
        uniform float uCurveRadialX;
        uniform float uCameraZ;
        uniform float uCameraX;
        uniform float uCurveStartDist;
        uniform float uCurveEnabled;

        varying vec3 vWorldNormal;
        varying float vLocalY;

        void main() {
          vLocalY = position.y;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          if (uCurveEnabled > 0.5) {
            float dz = wp.z - uCameraZ;
            float dx = (wp.x - uCameraX) * uCurveRadialX;
            float dist = max(0.0, length(vec2(dx, dz)) - uCurveStartDist);
            wp.y -= uCurveStrength * dist * dist * 0.65;
          }
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uLitColor;
        uniform vec3 uShadowColor;
        uniform vec3 uRimColor;
        uniform vec3 uSunDirection;

        varying vec3 vWorldNormal;
        varying float vLocalY;

        void main() {
          vec3 n = normalize(vWorldNormal);
          vec3 sunDir = normalize(uSunDirection);

          // Two-tone sculpted Argon Valley cloud shading: warm cream-lit top/rim and soft slate-taupe belly shadow
          float ndl = dot(n, sunDir) * 0.5 + 0.5;
          float topMask = smoothstep(-0.28, 0.55, n.y * 0.65 + vLocalY * 0.45);
          float litFactor = smoothstep(0.36, 0.78, ndl * 0.42 + topMask * 0.58);

          vec3 col = mix(uShadowColor, uLitColor, litFactor);

          // Subtle golden-hour rim highlight along the lower-right sunward edge (matches ref_01)
          float sunRim = smoothstep(0.58, 0.92, dot(n, normalize(vec3(0.75, -0.22, -0.45))));
          col = mix(col, uRimColor, sunRim * 0.38);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    // 18 sculpted puffy 3D Argon Valley clouds:
    // - Group A (10 clouds at z in [5.8, 7.2]): framed 1:1 in the beach_sunset sky (ref_01)
    //   while positioned behind the flower_river (z=4.2), house_yard (z=-0.8), tent_horizon (z=-0.6),
    //   and cliff_waterfall (z=-3.6) cameras!
    // - Group B (8 clouds at z in [-22, -30]): framed in the northern sky strip of
    //   tent_horizon, house_yard, flower_river, and cliff_waterfall.
    const cloudConfigs = [
      // Beach Sunset sky clouds (1:1 screen placement matching ref_01_beach_sunset.png)
      { x: -3.6, y: 5.05, z: 6.5, sx: 2.55, sy: 0.68, sz: 1.25, speed: 0.08 },
      { x: 1.75, y: 4.55, z: 6.2, sx: 2.35, sy: 0.64, sz: 1.20, speed: 0.07 },
      { x: 1.45, y: 3.05, z: 6.6, sx: 2.45, sy: 0.86, sz: 1.30, speed: 0.09 },
      { x: -2.15, y: 2.05, z: 6.0, sx: 2.05, sy: 0.38, sz: 0.95, speed: 0.06 },
      { x: -4.45, y: 1.45, z: 6.2, sx: 1.45, sy: 0.32, sz: 0.80, speed: 0.07 },
      { x: 0.25, y: 1.35, z: 5.8, sx: 1.75, sy: 0.34, sz: 0.85, speed: 0.06 },
      { x: 1.35, y: 1.78, z: 6.1, sx: 1.55, sy: 0.32, sz: 0.80, speed: 0.08 },
      { x: 6.85, y: 1.95, z: 6.4, sx: 3.15, sy: 0.44, sz: 1.15, speed: 0.07 },
      { x: -8.2, y: 4.45, z: 6.8, sx: 2.25, sy: 0.56, sz: 1.10, speed: 0.08 },
      { x: 8.1, y: 4.75, z: 6.8, sx: 2.35, sy: 0.58, sz: 1.15, speed: 0.07 },

      // Northern Horizon sky clouds (visible in house_yard, flower_river, tent_horizon, cliff_waterfall)
      { x: -11.5, y: 3.1, z: -23.0, sx: 2.8, sy: 0.65, sz: 1.3, speed: 0.09 },
      { x: -3.8, y: 2.95, z: -22.5, sx: 2.6, sy: 0.62, sz: 1.25, speed: 0.08 },
      { x: 4.2, y: 3.15, z: -23.5, sx: 2.7, sy: 0.64, sz: 1.3, speed: 0.09 },
      { x: 13.8, y: 2.85, z: -22.0, sx: 2.9, sy: 0.58, sz: 1.25, speed: 0.08 },
      { x: 19.2, y: 3.05, z: -23.5, sx: 2.5, sy: 0.55, sz: 1.2, speed: 0.07 },
      { x: -17.5, y: 3.4, z: -25.0, sx: 3.0, sy: 0.68, sz: 1.35, speed: 0.08 },
      { x: 0.5, y: 3.6, z: -26.0, sx: 3.1, sy: 0.70, sz: 1.4, speed: 0.07 },
      { x: 9.8, y: 3.45, z: -25.5, sx: 2.8, sy: 0.64, sz: 1.3, speed: 0.09 },
    ];

    this.clouds = [];
    const puffGeo = new THREE.SphereGeometry(1.0, 20, 16);

    for (let i = 0; i < cloudConfigs.length; i++) {
      const cfg = cloudConfigs[i];
      const cluster = new THREE.Group();
      cluster.position.set(cfg.x, cfg.y, cfg.z);
      cluster.userData = {
        baseX: cfg.x,
        baseY: cfg.y,
        baseZ: cfg.z,
        speed: cfg.speed,
        phase: i * 1.37,
        noShadow: true,
      };

      // Build each sculpted Argon Valley cloud from 4 overlapping flattened puffs
      const puffs = [
        { ox: 0.0, oy: 0.08, oz: 0.0, rx: 1.0, ry: 0.85, rz: 0.9 },
        { ox: -0.62, oy: -0.06, oz: 0.08, rx: 0.74, ry: 0.68, rz: 0.75 },
        { ox: 0.64, oy: -0.04, oz: -0.05, rx: 0.78, ry: 0.72, rz: 0.78 },
        { ox: 0.15, oy: 0.22, oz: -0.12, rx: 0.68, ry: 0.65, rz: 0.7 },
      ];

      for (let p = 0; p < puffs.length; p++) {
        const pf = puffs[p];
        const mesh = new THREE.Mesh(puffGeo, this.cloudMaterial);
        mesh.position.set(pf.ox * cfg.sx * 0.55, pf.oy * cfg.sy, pf.oz * cfg.sz * 0.5);
        mesh.scale.set(pf.rx * cfg.sx * 0.55, pf.ry * cfg.sy, pf.rz * cfg.sz * 0.55);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.userData.noShadow = true;
        cluster.add(mesh);
      }

      this.cloudGroup.add(cluster);
      this.clouds.push(cluster);
    }

    this.root.add(this.cloudGroup);
  }

  /**
   * Switches time-of-day lighting and sky colors (`'noon'`, `'golden_hour'`,
   * `'morning'`, `'night'`).
   * @param {'noon' | 'golden_hour' | 'morning' | 'night'} mode
   * @param {boolean} [immediate=true]
   */
  setTimePreset(mode, immediate = true) {
    const resolvedMode = TIME_OF_DAY_PRESETS[mode] ? mode : 'noon';
    const preset = TIME_OF_DAY_PRESETS[resolvedMode];
    this.activePreset = resolvedMode;
    this.currentMode = resolvedMode;
    this._target = this._cloneState(preset);

    if (immediate) {
      this._current = this._cloneState(preset);
      this._applyState(this._current);
    }
  }

  _applyState(state) {
    this.sunLight.position.copy(state.sunPos);
    this.sunLight.color.copy(state.sunColor);
    this.sunLight.intensity = state.sunIntensity;

    this.hemiLight.color.copy(state.hemiSkyColor);
    this.hemiLight.groundColor.copy(state.hemiGroundColor);
    this.hemiLight.intensity = state.hemiIntensity;

    this.ambientLight.color.copy(state.ambientColor);
    this.ambientLight.intensity = state.ambientIntensity;

    this.skyUniforms.uZenithColor.value.copy(state.zenithColor);
    this.skyUniforms.uMidSkyColor.value.copy(state.midSkyColor);
    this.skyUniforms.uHorizonColor.value.copy(state.horizonColor);
    this.skyUniforms.uGlowColor.value.copy(state.glowColor);
    this.skyUniforms.uSunDirection.value.copy(state.sunPos).normalize();
    this.skyUniforms.uStarIntensity.value = state.starIntensity;

    this.cloudUniforms.uLitColor.value.copy(state.cloudLitColor);
    this.cloudUniforms.uShadowColor.value.copy(state.cloudShadowColor);
    this.cloudUniforms.uRimColor.value.copy(state.cloudRimColor);
    this.cloudUniforms.uSunDirection.value.copy(state.sunPos).normalize();
  }

  /**
   * Smoothly interpolates sky/light transitions, keeps `skyDome` centered on the
   * camera/focal anchor to prevent far-plane clipping, and drifts the 3D clouds.
   * @param {number} dt
   * @param {number} [elapsed=0]
   * @param {THREE.Vector3|Object} [focusPos=null]
   */
  update(dt = 0.016, elapsed = 0, focusPos = null) {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.1);
    if (elapsed > 0) {
      WORLD_CURVE_UNIFORMS.uTime.value = elapsed;
    } else {
      WORLD_CURVE_UNIFORMS.uTime.value += safeDt;
    }

    // Keep skyDome centered on the camera/focal XZ so it is never clipped by camera.far
    if (this.skyDome) {
      this.skyDome.position.set(
        WORLD_CURVE_UNIFORMS.uCameraX.value,
        0,
        WORLD_CURVE_UNIFORMS.uCameraZ.value
      );
    }

    const alpha = 1.0 - Math.exp(-4.5 * safeDt);
    const c = this._current;
    const t = this._target;

    c.sunPos.lerp(t.sunPos, alpha);
    c.sunColor.lerp(t.sunColor, alpha);
    c.sunIntensity = THREE.MathUtils.lerp(c.sunIntensity, t.sunIntensity, alpha);

    c.hemiSkyColor.lerp(t.hemiSkyColor, alpha);
    c.hemiGroundColor.lerp(t.hemiGroundColor, alpha);
    c.hemiIntensity = THREE.MathUtils.lerp(c.hemiIntensity, t.hemiIntensity, alpha);

    c.ambientColor.lerp(t.ambientColor, alpha);
    c.ambientIntensity = THREE.MathUtils.lerp(c.ambientIntensity, t.ambientIntensity, alpha);

    c.zenithColor.lerp(t.zenithColor, alpha);
    c.midSkyColor.lerp(t.midSkyColor, alpha);
    c.horizonColor.lerp(t.horizonColor, alpha);
    c.glowColor.lerp(t.glowColor, alpha);

    c.cloudLitColor.lerp(t.cloudLitColor, alpha);
    c.cloudShadowColor.lerp(t.cloudShadowColor, alpha);
    c.cloudRimColor.lerp(t.cloudRimColor, alpha);
    c.starIntensity = THREE.MathUtils.lerp(c.starIntensity, t.starIntensity, alpha);

    this._applyState(c);

    // Gentle drift of puffy 3D clouds around their base anchor positions
    const time = WORLD_CURVE_UNIFORMS.uTime.value;
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];
      const ud = cloud.userData;
      cloud.position.x = ud.baseX + Math.sin(time * ud.speed + ud.phase) * 0.45;
      cloud.position.y = ud.baseY + Math.cos(time * (ud.speed * 1.4) + ud.phase) * 0.06;
    }
  }
}
