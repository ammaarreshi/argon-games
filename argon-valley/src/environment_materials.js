import * as THREE from '../assets/vendor/three.module.js';
import {
  applyWorldCurve,
  applyWorldCurveToHierarchy,
  WORLD_CURVE_UNIFORMS,
} from './world_curve_engine.js';

/**
 * Deterministic PRNG (Mulberry32) so procedural textures, foliage clusters,
 * flower gardens, and pebbles are 100% reproducible across runs.
 */
function createSeededRandom(seed = 1337) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Helper to draw a soft rounded equilateral/isosceles triangle on a 2D canvas
 * for the signature Argon Valley triangle-mosaic grass & dirt.
 */
function drawRoundedTriangle(ctx, cx, cy, size, pointingUp, cornerRadius = 3.2) {
  const h = size * 0.88;
  const halfW = size * 0.56;
  const dir = pointingUp ? -1 : 1;
  const p0 = { x: cx, y: cy + dir * (h * 0.58) };
  const p1 = { x: cx - halfW, y: cy - dir * (h * 0.42) };
  const p2 = { x: cx + halfW, y: cy - dir * (h * 0.42) };

  ctx.beginPath();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.moveTo((p0.x + p1.x) * 0.5, (p0.y + p1.y) * 0.5);
  ctx.arcTo(p1.x, p1.y, p2.x, p2.y, cornerRadius);
  ctx.arcTo(p2.x, p2.y, p0.x, p0.y, cornerRadius);
  ctx.arcTo(p0.x, p0.y, p1.x, p1.y, cornerRadius);
  ctx.closePath();
  ctx.fill();
}

/**
 * Safe wrapper around applyWorldCurve so materials are never double-hooked.
 */
function safeApplyWorldCurve(material, options = {}) {
  if (!material || material.userData?.worldCurveApplied) {
    return material;
  }
  try {
    applyWorldCurve(material, options);
    material.userData = material.userData || {};
    material.userData.worldCurveApplied = true;
  } catch (err) {
    // Fallback if world_curve_engine signature differs
  }
  return material;
}

/**
 * MaterialFactory: Generates high-craft procedural CanvasTextures and tactile,
 * toy-like THREE.MeshPhysicalMaterial instances with Argon Valley's signature
 * warm satin sheen, rounded triangle grass patterns, scalloped leaf shingles,
 * sedimentary cliff strata, and zero harsh metallic speculars.
 */
export class MaterialFactory {
  static _cache = new Map();

  static _getCached(key, builderFn) {
    if (MaterialFactory._cache.has(key)) {
      return MaterialFactory._cache.get(key);
    }
    const val = builderFn();
    MaterialFactory._cache.set(key, val);
    return val;
  }

  /**
   * Iconic Argon Valley emerald-clover grass (`#48a832`) patterned with bold, readable
   * `16x16` rounded triangles (`▲` / `▼`) per tile in golden yellow-lime (`#96e044`),
   * fresh clover (`#62be3c`), and deep moss green (`#328222`), with `repeat: 12x12`.
   */
  static createGrassMaterial(options = {}) {
    const repeatX = options.repeatX ?? 12;
    const repeatY = options.repeatY ?? 12;
    const cacheKey = `grass_v2_${repeatX}_${repeatY}`;

    const textures = MaterialFactory._getCached(cacheKey, () => {
      const size = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d');

      const rand = createSeededRandom(4021);

      // Rich emerald-clover lawn base (#48a832)
      ctx.fillStyle = '#48a832';
      ctx.fillRect(0, 0, size, size);

      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      // Organic sunlit golden-green and deeper emerald clover zones
      for (let i = 0; i < 36; i++) {
        const px = rand() * size;
        const py = rand() * size;
        const radius = 95 + rand() * 150;
        const isWarmPatch = rand() > 0.44;

        for (let ox = -size; ox <= size; ox += size) {
          for (let oy = -size; oy <= size; oy += size) {
            const grad = ctx.createRadialGradient(
              px + ox,
              py + oy,
              radius * 0.1,
              px + ox,
              py + oy,
              radius
            );
            if (isWarmPatch) {
              grad.addColorStop(0, 'rgba(132, 214, 62, 0.28)');
              grad.addColorStop(1, 'rgba(72, 168, 50, 0.0)');
            } else {
              grad.addColorStop(0, 'rgba(46, 128, 32, 0.24)');
              grad.addColorStop(1, 'rgba(72, 168, 50, 0.0)');
            }
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(px + ox, py + oy, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 16x16 bold, unmistakable Argon Valley rounded-triangle mosaic grid (`▲` and `▼`)
      const cols = 16;
      const rows = 16;
      const cellW = size / cols;
      const cellH = size / rows;

      const palette = [
        '#96e044', // bright golden-lime triangle (high contrast!)
        '#86d43c', // warm yellow-green triangle
        '#62be3a', // light clover
        '#328222', // deep forest clover triangle
        '#2b741b', // rich moss shadow triangle
      ];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const patchWave =
            Math.sin((c / cols) * Math.PI * 4.0 + 0.6) *
              Math.cos((r / rows) * Math.PI * 4.0 - 0.3) +
            Math.sin(((c + r) / cols) * Math.PI * 2.0) * 0.55;

          const roll = rand();
          if (roll < 0.12) continue;

          let color;
          if (patchWave > 0.25) {
            color = roll > 0.38 ? '#96e044' : roll > 0.16 ? '#86d43c' : '#328222';
          } else if (patchWave < -0.25) {
            color = roll > 0.45 ? '#328222' : roll > 0.2 ? '#2b741b' : '#86d43c';
          } else {
            color = palette[Math.floor(rand() * palette.length)];
          }

          const jitterX = (rand() - 0.5) * cellW * 0.26;
          const jitterY = (rand() - 0.5) * cellH * 0.26;
          const cx = (c + 0.5) * cellW + jitterX;
          const cy = (r + 0.5) * cellH + jitterY;
          const triSize = cellW * (0.64 + rand() * 0.2);
          const pointingUp = (r + c) % 2 === 0 ? rand() > 0.15 : rand() < 0.15;

          ctx.fillStyle = color;
          for (let ox = -size; ox <= size; ox += size) {
            for (let oy = -size; oy <= size; oy += size) {
              if (
                cx + ox > -triSize &&
                cx + ox < size + triSize &&
                cy + oy > -triSize &&
                cy + oy < size + triSize
              ) {
                drawRoundedTriangle(
                  ctx,
                  cx + ox,
                  cy + oy,
                  triSize,
                  pointingUp,
                  triSize * 0.22
                );
              }
            }
          }

          bCtx.fillStyle = pointingUp ? '#949494' : '#6c6c6c';
          drawRoundedTriangle(bCtx, cx, cy, triSize * 0.9, pointingUp, triSize * 0.2);
        }
      }

      // Micro-blade velvet texture in bump map
      for (let i = 0; i < 2800; i++) {
        const bx = rand() * size;
        const by = rand() * size;
        const bh = 5 + rand() * 8;
        bCtx.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)';
        bCtx.lineWidth = 1.6;
        bCtx.beginPath();
        bCtx.moveTo(bx, by);
        bCtx.lineTo(bx + (rand() - 0.5) * 3, by - bh);
        bCtx.stroke();
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(repeatX, repeatY);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      map.needsUpdate = true;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(repeatX, repeatY);
      bumpMap.needsUpdate = true;

      return { map, bumpMap };
    });

    const mat = new THREE.MeshPhysicalMaterial({
      map: textures.map,
      bumpMap: textures.bumpMap,
      bumpScale: 0.032,
      roughness: 0.78,
      metalness: 0.0,
      sheen: 0.34,
      sheenColor: new THREE.Color('#8ee654'),
      sheenRoughness: 0.68,
      ...(options.materialProps || {}),
    });

    return safeApplyWorldCurve(mat, options.curveOptions);
  }

  /**
   * Terracotta/ochre-tan sedimentary cliff rock (`ref_06_cliff_waterfall.png` &
   * `ref_01_beach_sunset.png`) with vertical chiseled facets and horizontal
   * sedimentary color strata (`#df9e6c` top band, `#cc8755` mid band,
   * `#b57042` lower band, `#8a5432` base shadow) and matte clay roughness (`0.84`).
   */
  static createCliffMaterial(options = {}) {
    const variant = options.variant || 'main';
    const cacheKey = `cliff_v2_${variant}`;

    const textures = MaterialFactory._getCached(cacheKey, () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d');

      const rand = createSeededRandom(7712);

      // Note: Canvas y=0 corresponds to UV v=1 (top of cliff), y=size to UV v=0 (bottom of cliff)
      const strataGrad = ctx.createLinearGradient(0, 0, 0, size);
      if (variant === 'coastal') {
        strataGrad.addColorStop(0.0, '#dc8656');
        strataGrad.addColorStop(0.35, '#cf7646');
        strataGrad.addColorStop(0.7, '#bc6438');
        strataGrad.addColorStop(0.9, '#9e502a');
        strataGrad.addColorStop(1.0, '#7d3d1e');
      } else {
        strataGrad.addColorStop(0.0, '#e4a26e');
        strataGrad.addColorStop(0.32, '#df9a66');
        strataGrad.addColorStop(0.35, '#cc8450');
        strataGrad.addColorStop(0.66, '#c8804c');
        strataGrad.addColorStop(0.69, '#b26b3c');
        strataGrad.addColorStop(0.88, '#ae6738');
        strataGrad.addColorStop(0.91, '#844c28');
        strataGrad.addColorStop(1.0, '#744020');
      }
      ctx.fillStyle = strataGrad;
      ctx.fillRect(0, 0, size, size);

      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      const numCols = 8;
      const colW = size / numCols;
      for (let i = 0; i < numCols; i++) {
        const x0 = i * colW;
        const shade = (i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0.35) * 0.085;
        ctx.fillStyle =
          shade > 0
            ? `rgba(255, 224, 188, ${shade})`
            : `rgba(60, 26, 10, ${Math.abs(shade)})`;
        ctx.fillRect(x0, 0, colW, size);

        ctx.strokeStyle = 'rgba(86, 42, 18, 0.34)';
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0 + (rand() - 0.5) * 5, size * 0.5);
        ctx.lineTo(x0, size);
        ctx.stroke();

        const bGrad = bCtx.createLinearGradient(x0, 0, x0 + colW, 0);
        bGrad.addColorStop(0, i % 2 === 0 ? '#9c9c9c' : '#646464');
        bGrad.addColorStop(0.5, '#828282');
        bGrad.addColorStop(1, i % 2 === 0 ? '#646464' : '#9c9c9c');
        bCtx.fillStyle = bGrad;
        bCtx.fillRect(x0, 0, colW, size);
      }

      for (let i = 0; i < 1600; i++) {
        const gx = rand() * size;
        const gy = rand() * size;
        const r = 1 + rand() * 2.2;
        ctx.fillStyle =
          rand() > 0.5 ? 'rgba(255, 220, 185, 0.08)' : 'rgba(85, 42, 18, 0.10)';
        ctx.fillRect(gx, gy, r, r);
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.ClampToEdgeWrapping;
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      map.needsUpdate = true;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.ClampToEdgeWrapping;
      bumpMap.needsUpdate = true;

      return { map, bumpMap };
    });

    const mat = new THREE.MeshPhysicalMaterial({
      map: textures.map,
      bumpMap: textures.bumpMap,
      bumpScale: 0.06,
      roughness: 0.84,
      metalness: 0.0,
      sheen: 0.14,
      sheenColor: new THREE.Color('#f0b686'),
      sheenRoughness: 0.82,
      ...(options.materialProps || {}),
    });

    return safeApplyWorldCurve(mat, options.curveOptions);
  }

  /**
   * Silky warm golden-apricot beach sand (`#efc57c`) with subtle wind-ripple
   * normal/bump map and warm satin sheen (`ref_01_beach_sunset.png`, `ref_05`).
   */
  static createSandMaterial(options = {}) {
    const repeatX = options.repeatX ?? 10;
    const repeatY = options.repeatY ?? 10;
    const wet = Boolean(options.wet);
    const cacheKey = `sand_v2_${repeatX}_${repeatY}_${wet}`;

    const textures = MaterialFactory._getCached(cacheKey, () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d');

      const rand = createSeededRandom(9012);

      ctx.fillStyle = wet ? '#d2a664' : '#eec47c';
      ctx.fillRect(0, 0, size, size);

      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      for (let y = 0; y < size; y += 4) {
        const wave = Math.sin((y / size) * Math.PI * 16.0);
        ctx.fillStyle =
          wave > 0
            ? `rgba(255, 234, 188, ${0.12 * wave})`
            : `rgba(202, 152, 84, ${0.11 * Math.abs(wave)})`;
        ctx.fillRect(0, y, size, 3);

        const bVal = Math.round(128 + wave * 24);
        bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
        bCtx.fillRect(0, y, size, 4);
      }

      for (let i = 0; i < 3200; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 0.8 + rand() * 1.6;
        ctx.fillStyle =
          rand() > 0.45 ? 'rgba(255, 242, 210, 0.22)' : 'rgba(192, 142, 76, 0.16)';
        ctx.fillRect(x, y, r, r);

        bCtx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
        bCtx.fillRect(x, y, r, r);
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(repeatX, repeatY);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      map.needsUpdate = true;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(repeatX, repeatY);
      bumpMap.needsUpdate = true;

      return { map, bumpMap };
    });

    const mat = new THREE.MeshPhysicalMaterial({
      map: textures.map,
      bumpMap: textures.bumpMap,
      bumpScale: 0.022,
      roughness: wet ? 0.44 : 0.78,
      metalness: 0.0,
      sheen: 0.25,
      sheenColor: new THREE.Color('#ffe8b8'),
      sheenRoughness: 0.6,
      ...(options.materialProps || {}),
    });

    return safeApplyWorldCurve(mat, options.curveOptions);
  }

  /**
   * Warm milk-chocolate / ochre-tan packed earth (`#c48e52`) with subtle darker
   * soil flecks and soft triangle mosaic integration (`ref_02_house_yard.png`).
   */
  static createDirtPathMaterial(options = {}) {
    const cacheKey = `dirt_path_v2_${options.variant || 'default'}`;

    const textures = MaterialFactory._getCached(cacheKey, () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d');

      const rand = createSeededRandom(5518);

      ctx.fillStyle = '#c48e52';
      ctx.fillRect(0, 0, size, size);

      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      const grid = 12;
      const cell = size / grid;
      const dirtTones = ['#ce9a5e', '#b88248', '#ad783e', '#d09e64'];
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          if (rand() < 0.22) continue;
          const cx = (c + 0.5 + (rand() - 0.5) * 0.25) * cell;
          const cy = (r + 0.5 + (rand() - 0.5) * 0.25) * cell;
          const triSize = cell * (0.64 + rand() * 0.2);
          const up = (r + c) % 2 === 0;
          ctx.fillStyle = dirtTones[Math.floor(rand() * dirtTones.length)];
          drawRoundedTriangle(ctx, cx, cy, triSize, up, triSize * 0.22);

          bCtx.fillStyle = up ? '#8b8b8b' : '#757575';
          drawRoundedTriangle(bCtx, cx, cy, triSize * 0.9, up, triSize * 0.2);
        }
      }

      for (let i = 0; i < 800; i++) {
        const px = rand() * size;
        const py = rand() * size;
        const pr = 1.2 + rand() * 2.8;
        ctx.fillStyle =
          rand() > 0.5 ? 'rgba(224, 178, 120, 0.22)' : 'rgba(136, 88, 42, 0.22)';
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(2, 2);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      map.needsUpdate = true;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(2, 2);
      bumpMap.needsUpdate = true;

      return { map, bumpMap };
    });

    const mat = new THREE.MeshPhysicalMaterial({
      map: textures.map,
      bumpMap: textures.bumpMap,
      bumpScale: 0.028,
      roughness: 0.85,
      metalness: 0.0,
      sheen: 0.18,
      sheenColor: new THREE.Color('#e0b27c'),
      sheenRoughness: 0.75,
      polygonOffset: Boolean(options.polygonOffset),
      polygonOffsetFactor: options.polygonOffset ? -1 : 0,
      polygonOffsetUnits: options.polygonOffset ? -1 : 0,
      ...(options.materialProps || {}),
    });

    return safeApplyWorldCurve(mat, options.curveOptions);
  }

  /**
   * Wood materials for trees, furniture, cottage doors, log benches, and campfires.
   */
  static createWoodMaterial(variant = 'pine', options = {}) {
    const v = String(variant || 'pine').toLowerCase();
    const cacheKey = `wood_v2_${v}`;

    const textures = MaterialFactory._getCached(cacheKey, () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d');

      const rand = createSeededRandom(3104 + v.length * 97);

      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      if (v === 'log_cut' || v === 'rings' || v === 'stump_top') {
        const cx = size * 0.5;
        const cy = size * 0.5;
        ctx.fillStyle = '#ebd0a4';
        ctx.fillRect(0, 0, size, size);

        const maxR = size * 0.49;
        for (let r = maxR; r > 6; r -= 6) {
          const ratio = r / maxR;
          if (ratio > 0.88) {
            ctx.fillStyle = ratio > 0.93 ? '#6b401e' : '#85522a';
          } else {
            const ringWave = Math.sin(r * 0.48);
            ctx.fillStyle =
              ringWave > 0.35 ? '#d7b480' : ringWave < -0.35 ? '#e4c798' : '#efd5ab';
          }
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();

          const bVal = Math.round(128 + Math.sin(r * 0.48) * 18);
          bCtx.strokeStyle = `rgb(${bVal},${bVal},${bVal})`;
          bCtx.lineWidth = 3;
          bCtx.beginPath();
          bCtx.arc(cx, cy, r, 0, Math.PI * 2);
          bCtx.stroke();
        }

        ctx.fillStyle = '#c49b64';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (v === 'bark' || v === 'cedar' || v === 'trunk') {
        // Warm cinnamon-brown tree trunk bark with soft organic vertical grooves (ref_02, ref_04, ref_06)
        ctx.fillStyle = '#9e6232';
        ctx.fillRect(0, 0, size, size);

        const numStrips = 20;
        const stripW = size / numStrips;
        for (let i = 0; i < numStrips; i++) {
          const x = i * stripW;
          const tone = i % 3 === 0 ? '#ad6e3c' : i % 3 === 1 ? '#8e5528' : '#9b5f30';
          ctx.fillStyle = tone;
          ctx.fillRect(x, 0, stripW + 2, size);

          ctx.strokeStyle = 'rgba(108, 58, 24, 0.55)';
          ctx.lineWidth = 4.0;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.bezierCurveTo(
            x + (rand() - 0.5) * 12,
            size * 0.33,
            x + (rand() - 0.5) * 12,
            size * 0.66,
            x,
            size
          );
          ctx.stroke();

          bCtx.strokeStyle = '#525252';
          bCtx.lineWidth = 4;
          bCtx.beginPath();
          ctx.moveTo(x, 0);
          bCtx.lineTo(x, size);
          bCtx.stroke();

          bCtx.fillStyle = '#949494';
          bCtx.fillRect(x + 4, 0, stripW - 8, size);
        }
      } else if (v === 'palm_bark') {
        // Golden-tan segmented coconut palm trunk rings (ref_01, ref_05)
        ctx.fillStyle = '#c8904c';
        ctx.fillRect(0, 0, size, size);
        const rings = 12;
        const ringH = size / rings;
        for (let i = 0; i < rings; i++) {
          const y = i * ringH;
          const grad = ctx.createLinearGradient(0, y, 0, y + ringH);
          grad.addColorStop(0.0, '#986630');
          grad.addColorStop(0.22, '#d8a25e');
          grad.addColorStop(0.76, '#c48c48');
          grad.addColorStop(1.0, '#8c5a28');
          ctx.fillStyle = grad;
          ctx.fillRect(0, y, size, ringH);

          bCtx.fillStyle = '#585858';
          bCtx.fillRect(0, y, size, 4);
        }
      } else {
        let baseColor = '#e6c28b';
        let grainDark = '#cfa468';
        let grainLight = '#f2d4a2';

        if (v === 'red_painted' || v === 'door' || v === 'red') {
          baseColor = '#d44a38';
          grainDark = '#b83828';
          grainLight = '#e25c4a';
        } else if (v === 'dark_charred' || v === 'dark' || v === 'stump_bark') {
          baseColor = '#3d281c';
          grainDark = '#26170f';
          grainLight = '#543828';
        } else if (v === 'oak' || v === 'medium' || v === 'signpost') {
          baseColor = '#be864e';
          grainDark = '#9e6a36';
          grainLight = '#d29c64';
        } else if (v === 'white_painted' || v === 'white') {
          baseColor = '#f4efe6';
          grainDark = '#dfd8cc';
          grainLight = '#ffffff';
        } else if (v.startsWith('#')) {
          baseColor = variant;
          grainDark = 'rgba(0,0,0,0.12)';
          grainLight = 'rgba(255,255,255,0.12)';
        }

        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 95; i++) {
          const y = (i / 95) * size;
          ctx.strokeStyle = i % 2 === 0 ? grainDark : grainLight;
          ctx.globalAlpha = 0.26;
          ctx.lineWidth = 2 + rand() * 3.5;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(
            size * 0.33,
            y + (rand() - 0.5) * 16,
            size * 0.66,
            y + (rand() - 0.5) * 16,
            size,
            y
          );
          ctx.stroke();

          bCtx.strokeStyle = i % 2 === 0 ? '#727272' : '#8e8e8e';
          bCtx.lineWidth = 2;
          bCtx.beginPath();
          ctx.moveTo(0, y);
          bCtx.lineTo(size, y);
          bCtx.stroke();
        }
        ctx.globalAlpha = 1.0;
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      map.needsUpdate = true;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.needsUpdate = true;

      return { map, bumpMap };
    });

    const isBark =
      v === 'bark' || v === 'cedar' || v === 'trunk' || v === 'dark_charred' || v === 'palm_bark';
    const mat = new THREE.MeshPhysicalMaterial({
      map: textures.map,
      bumpMap: textures.bumpMap,
      bumpScale: isBark ? 0.038 : 0.018,
      roughness: isBark ? 0.82 : 0.64,
      metalness: 0.0,
      sheen: isBark ? 0.16 : 0.26,
      sheenColor: new THREE.Color(isBark ? '#d4965e' : '#fae0b8'),
      sheenRoughness: 0.72,
      ...(options.materialProps || {}),
    });

    return safeApplyWorldCurve(mat, options.curveOptions);
  }

  /**
   * Woven felt/canvas fabric material with micro-weave bump map and high
   * velvet cloth sheen (`sheen: 0.65, sheenRoughness: 0.5`).
   */
  static createFabricMaterial(variant = 'canvas', options = {}) {
    const v = String(variant || 'canvas').toLowerCase();
    const customColors = Array.isArray(options) ? options : options?.colors;
    const cacheKey = `fabric_v2_${v}_${customColors ? customColors.join('_') : 'std'}`;

    const textures = MaterialFactory._getCached(cacheKey, () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d');

      if (v === 'chevron_towel' || v === 'chevron') {
        const colors = customColors || [
          '#20c2b8',
          '#f8d838',
          '#44a8e8',
          '#f46890',
          '#244878',
          '#f6f4ec',
        ];
        const bands = 18;
        const bandH = size / bands;
        const zigCount = 8;
        const zigW = size / zigCount;

        ctx.fillStyle = colors[0];
        ctx.fillRect(0, 0, size, size);

        for (let b = -2; b < bands + 2; b++) {
          ctx.fillStyle = colors[((b % colors.length) + colors.length) % colors.length];
          ctx.beginPath();
          const yBase = b * bandH;
          ctx.moveTo(0, yBase);
          for (let z = 0; z <= zigCount; z++) {
            const x = z * zigW;
            const yOffset = z % 2 === 0 ? 0 : bandH * 0.85;
            ctx.lineTo(x, yBase + yOffset);
          }
          for (let z = zigCount; z >= 0; z--) {
            const x = z * zigW;
            const yOffset = z % 2 === 0 ? 0 : bandH * 0.85;
            ctx.lineTo(x, yBase + bandH + yOffset);
          }
          ctx.closePath();
          ctx.fill();
        }
      } else if (v === 'rainbow_hammock' || v === 'hammock' || v === 'striped') {
        const stripes = customColors || [
          '#f26d85',
          '#d86898',
          '#f5ead6',
          '#f8df72',
          '#f5ead6',
          '#6ec4e8',
          '#4898d8',
          '#f26d85',
        ];
        const stripeH = size / stripes.length;
        for (let i = 0; i < stripes.length; i++) {
          ctx.fillStyle = stripes[i];
          ctx.fillRect(0, i * stripeH, size, stripeH + 1);
        }
      } else if (v === 'blue_white_stripe' || v === 'umbrella') {
        const stripes = customColors || ['#2662e6', '#f8fafc'];
        const num = 8;
        const w = size / num;
        for (let i = 0; i < num; i++) {
          ctx.fillStyle = stripes[i % stripes.length];
          ctx.fillRect(i * w, 0, w + 1, size);
        }
      } else if (v === 'gingham' || v === 'red_gingham') {
        const grid = 8;
        const cell = size / grid;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        for (let r = 0; r < grid; r++) {
          for (let c = 0; c < grid; c++) {
            if (r % 2 === 0 && c % 2 === 0) {
              ctx.fillStyle = '#dc2f2f';
            } else if (r % 2 === 0 || c % 2 === 0) {
              ctx.fillStyle = '#f28282';
            } else {
              continue;
            }
            ctx.fillRect(c * cell, r * cell, cell, cell);
          }
        }
      } else if (v === 'green_plaid') {
        ctx.fillStyle = '#62bd4c';
        ctx.fillRect(0, 0, size, size);
        const step = size / 6;
        ctx.fillStyle = 'rgba(248, 224, 72, 0.55)';
        for (let i = 0; i < 6; i += 2) {
          ctx.fillRect(i * step, 0, step * 0.45, size);
          ctx.fillRect(0, i * step, size, step * 0.45);
        }
        ctx.fillStyle = 'rgba(38, 108, 42, 0.45)';
        for (let i = 1; i < 6; i += 2) {
          ctx.fillRect(i * step, 0, step * 0.3, size);
          ctx.fillRect(0, i * step, size, step * 0.3);
        }
      } else if (v === 'purple_chevron') {
        ctx.fillStyle = '#7e4ce2';
        ctx.fillRect(0, 0, size, size);
        const colors = ['#7e4ce2', '#e84898', '#44c2e8', '#9864f0'];
        const bands = 12;
        const bandH = size / bands;
        for (let b = 0; b < bands; b++) {
          ctx.fillStyle = colors[b % colors.length];
          ctx.fillRect(0, b * bandH, size, bandH * 0.65);
        }
      } else if (v === 'yellow_tent' || v === 'tent') {
        ctx.fillStyle = '#f6d62e';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#dfb814';
        ctx.lineWidth = 4;
        for (let x = 64; x < size; x += 128) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, size);
          ctx.stroke();
        }
      } else if (v === 'tarp' || v === 'tan_tarp') {
        ctx.fillStyle = '#d4ab6a';
        ctx.fillRect(0, 0, size, size);
      } else {
        const baseHex = options?.color || (v.startsWith('#') ? variant : '#f6f3eb');
        ctx.fillStyle = baseHex;
        ctx.fillRect(0, 0, size, size);
      }

      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);
      const step = 4;
      for (let y = 0; y < size; y += step) {
        ctx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)';
        ctx.fillRect(0, y, size, 2);
        bCtx.fillStyle = y % 8 === 0 ? '#969696' : '#6a6a6a';
        bCtx.fillRect(0, y, size, 2);
      }
      for (let x = 0; x < size; x += step) {
        ctx.fillStyle = x % 8 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)';
        ctx.fillRect(x, 0, 2, size);
        bCtx.fillStyle = x % 8 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
        bCtx.fillRect(x, 0, 2, size);
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      map.needsUpdate = true;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.needsUpdate = true;

      return { map, bumpMap };
    });

    const isTent = v === 'yellow_tent' || v === 'tent';
    const mat = new THREE.MeshPhysicalMaterial({
      map: textures.map,
      bumpMap: textures.bumpMap,
      bumpScale: 0.024,
      roughness: 0.78,
      metalness: 0.0,
      sheen: 0.65,
      sheenColor: new THREE.Color(isTent ? '#fff59e' : '#ffffff'),
      sheenRoughness: 0.5,
      transmission: isTent ? 0.1 : 0.0,
      thickness: isTent ? 0.2 : 0.0,
      side: THREE.DoubleSide,
      ...(options?.materialProps || {}),
    });

    return safeApplyWorldCurve(mat, options?.curveOptions);
  }

  /**
   * High-contrast Scalloped Leaf Shingle Material (`#72d23e` top highlight,
   * `#4cac30` mid, `#2b721e` shadow tier) with painted overlapping 3-lobed
   * Argon Valley leaf shingles and bump map so tree crowns look like lush sculpted
   * Argon Valley leaves (`ref_02`, `ref_03`, `ref_04`, `ref_06`).
   */
  static createFoliageMaterial(tier = 'mid', options = {}) {
    const t = String(tier || 'mid').toLowerCase();
    const cacheKey = `foliage_v2_${t}`;

    const textures = MaterialFactory._getCached(cacheKey, () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d');

      let topHex = '#66c63c';
      let baseHex = '#4cac30';
      let bottomHex = '#317c1c';
      let rimShadowHex = '#1e5810';

      if (t === 'top' || t === 'highlight' || t === 'light') {
        topHex = '#8ae24c';
        baseHex = '#6ed03c';
        bottomHex = '#50ac28';
        rimShadowHex = '#38861a';
      } else if (t === 'bottom' || t === 'shadow' || t === 'dark' || t === 'lower') {
        topHex = '#469c2c';
        baseHex = '#2e781e';
        bottomHex = '#1d5812';
        rimShadowHex = '#113a09';
      } else if (t === 'palm') {
        topHex = '#68c83c';
        baseHex = '#4ca828';
        bottomHex = '#32801a';
        rimShadowHex = '#1e580e';
      } else if (t === 'stem' || t === 'leaf') {
        topHex = '#58bc3c';
        baseHex = '#429e2a';
        bottomHex = '#2c7a1a';
        rimShadowHex = '#1d5610';
      } else if (t.startsWith('#')) {
        topHex = tier;
        baseHex = tier;
        bottomHex = tier;
      }

      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0.0, topHex);
      grad.addColorStop(0.55, baseHex);
      grad.addColorStop(1.0, bottomHex);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      // Paint overlapping scalloped 3-lobed Argon Valley leaf shingles across the texture!
      const rows = 5;
      const cols = 5;
      const cellW = size / cols;
      const cellH = size / rows;

      for (let r = -1; r <= rows; r++) {
        for (let c = -1; c <= cols; c++) {
          const staggerX = (r % 2) * (cellW * 0.5);
          const cx = (c + 0.5) * cellW + staggerX;
          const cy = (r + 0.5) * cellH;
          const leafR = cellW * 0.54;

          // Dark scalloped under-rim shadow
          ctx.fillStyle = rimShadowHex;
          ctx.globalAlpha = 0.42;
          ctx.beginPath();
          ctx.arc(cx - leafR * 0.42, cy + leafR * 0.22, leafR * 0.46, 0, Math.PI * 2);
          ctx.arc(cx + leafR * 0.42, cy + leafR * 0.22, leafR * 0.46, 0, Math.PI * 2);
          ctx.arc(cx, cy + leafR * 0.38, leafR * 0.52, 0, Math.PI * 2);
          ctx.fill();

          // Plump 3-lobed leaf body
          const leafGrad = ctx.createLinearGradient(cx, cy - leafR * 0.6, cx, cy + leafR * 0.6);
          leafGrad.addColorStop(0.0, topHex);
          leafGrad.addColorStop(0.65, baseHex);
          leafGrad.addColorStop(1.0, bottomHex);
          ctx.fillStyle = leafGrad;
          ctx.globalAlpha = 0.92;
          ctx.beginPath();
          ctx.arc(cx - leafR * 0.4, cy + leafR * 0.1, leafR * 0.45, 0, Math.PI * 2);
          ctx.arc(cx + leafR * 0.4, cy + leafR * 0.1, leafR * 0.45, 0, Math.PI * 2);
          ctx.arc(cx, cy + leafR * 0.24, leafR * 0.5, 0, Math.PI * 2);
          ctx.arc(cx, cy - leafR * 0.15, leafR * 0.56, 0, Math.PI * 2);
          ctx.fill();

          // Subtle sunlit midrib vein
          ctx.strokeStyle = topHex;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx, cy - leafR * 0.45);
          ctx.lineTo(cx, cy + leafR * 0.45);
          ctx.stroke();

          // Matching bump map shingle relief
          bCtx.fillStyle = '#4a4a4a';
          bCtx.beginPath();
          ctx.arc(cx, cy + leafR * 0.36, leafR * 0.52, 0, Math.PI * 2);
          bCtx.fill();

          bCtx.fillStyle = '#b4b4b4';
          bCtx.beginPath();
          bCtx.arc(cx - leafR * 0.38, cy + leafR * 0.08, leafR * 0.42, 0, Math.PI * 2);
          bCtx.arc(cx + leafR * 0.38, cy + leafR * 0.08, leafR * 0.42, 0, Math.PI * 2);
          bCtx.arc(cx, cy + leafR * 0.2, leafR * 0.48, 0, Math.PI * 2);
          bCtx.fill();
        }
      }
      ctx.globalAlpha = 1.0;

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(2, 2);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      map.needsUpdate = true;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(2, 2);
      bumpMap.needsUpdate = true;

      return { map, bumpMap };
    });

    const mat = new THREE.MeshPhysicalMaterial({
      map: textures.map,
      bumpMap: textures.bumpMap,
      bumpScale: 0.045,
      roughness: 0.68,
      metalness: 0.0,
      sheen: 0.35,
      sheenColor: new THREE.Color('#92ec58'),
      sheenRoughness: 0.65,
      transmission: 0.0,
      ...(options.materialProps || {}),
    });

    return safeApplyWorldCurve(mat, {
      swayAmount: options.swayAmount ?? 0.022,
      swaySpeed: options.swaySpeed ?? 1.4,
      ...(options.curveOptions || {}),
    });
  }

  /**
   * Continuous V-notched Coconut Palm Frond material with alpha-tested leaflet cutouts
   * so palm fronds look like lush, arched tropical fan blades (`ref_01` & `ref_05`).
   */
  static createPalmFrondMaterial(options = {}) {
    const cacheKey = 'palm_frond_blade_v2';
    const textures = MaterialFactory._getCached(cacheKey, () => {
      const w = 512;
      const h = 512;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, w, h);

      // Draw continuous central rachis spine + closely overlapping curved pinnae leaflets
      const cx = w * 0.5;
      const numPinnae = 14;
      for (let i = 0; i < numPinnae; i++) {
        const t = i / (numPinnae - 1);
        const y = h * (0.06 + t * 0.88);
        // Taper width at base and tip like an oval palm frond
        const spanW = Math.sin(Math.pow(t, 0.72) * Math.PI) * (w * 0.47);
        const leafH = (h / numPinnae) * 0.92;

        for (const side of [-1, 1]) {
          const grad = ctx.createLinearGradient(cx, y, cx + side * spanW, y + leafH * 0.4);
          grad.addColorStop(0.0, '#68c83c');
          grad.addColorStop(0.35, '#4ca828');
          grad.addColorStop(0.85, '#36881c');
          grad.addColorStop(1.0, '#286c14');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(cx, y - leafH * 0.48);
          ctx.quadraticCurveTo(
            cx + side * spanW * 0.65,
            y - leafH * 0.35,
            cx + side * spanW,
            y + leafH * 0.15
          );
          ctx.quadraticCurveTo(
            cx + side * spanW * 0.55,
            y + leafH * 0.52,
            cx,
            y + leafH * 0.48
          );
          ctx.closePath();
          ctx.fill();
        }
      }

      // Bright sunlit central midrib spine
      const spineGrad = ctx.createLinearGradient(0, 0, 0, h);
      spineGrad.addColorStop(0.0, '#88dc4e');
      spineGrad.addColorStop(1.0, '#4ca828');
      ctx.fillStyle = spineGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 10, h * 0.04);
      ctx.lineTo(cx + 10, h * 0.04);
      ctx.lineTo(cx + 3, h * 0.96);
      ctx.lineTo(cx - 3, h * 0.96);
      ctx.closePath();
      ctx.fill();

      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      map.needsUpdate = true;
      return { map };
    });

    const mat = new THREE.MeshPhysicalMaterial({
      map: textures.map,
      alphaTest: 0.35,
      roughness: 0.62,
      metalness: 0.0,
      sheen: 0.35,
      sheenColor: new THREE.Color('#92ec58'),
      sheenRoughness: 0.6,
      side: THREE.DoubleSide,
      ...(options.materialProps || {}),
    });

    return safeApplyWorldCurve(mat, {
      swayAmount: options.swayAmount ?? 0.028,
      swaySpeed: options.swaySpeed ?? 1.45,
    });
  }

  /**
   * Toy-like glazed fruit (`#e82820` cherry-red apple or `#f87c18` Valencia orange)
   * with `roughness: 0.24, clearcoat: 0.65, clearcoatRoughness: 0.22, sheen: 0.3`.
   */
  static createGlossyFruitMaterial(fruitType = 'apple', options = {}) {
    const type = String(fruitType || 'apple').toLowerCase();
    const cacheKey = `fruit_v2_${type}`;

    const textures = MaterialFactory._getCached(cacheKey, () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const rand = createSeededRandom(type === 'orange' ? 8821 : 1942);

      if (type === 'orange') {
        const grad = ctx.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0.0, '#ff9c1e');
        grad.addColorStop(0.35, '#f47212');
        grad.addColorStop(0.85, '#e05808');
        grad.addColorStop(1.0, '#c84804');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 450; i++) {
          ctx.fillStyle =
            rand() > 0.5 ? 'rgba(255, 195, 80, 0.22)' : 'rgba(175, 60, 4, 0.18)';
          ctx.beginPath();
          ctx.arc(rand() * size, rand() * size, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'coconut') {
        const grad = ctx.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0.0, '#72be36');
        grad.addColorStop(0.5, '#569e26');
        grad.addColorStop(1.0, '#3e7a1a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
      } else {
        // Rich cherry-red Argon Valley apple with subtle golden crown blush
        const grad = ctx.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0.0, '#f2a828');
        grad.addColorStop(0.14, '#eb381c');
        grad.addColorStop(0.5, '#dc1e18');
        grad.addColorStop(0.88, '#bc1210');
        grad.addColorStop(1.0, '#9c0c0c');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 28; i++) {
          const x = rand() * size;
          ctx.strokeStyle =
            rand() > 0.4 ? 'rgba(255, 180, 65, 0.15)' : 'rgba(150, 8, 8, 0.18)';
          ctx.lineWidth = 3 + rand() * 5;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + (rand() - 0.5) * 14, size);
          ctx.stroke();
        }
      }

      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
      return { map };
    });

    const mat = new THREE.MeshPhysicalMaterial({
      map: textures.map,
      roughness: type === 'coconut' ? 0.38 : 0.24,
      metalness: 0.0,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
      sheen: 0.3,
      sheenColor: new THREE.Color(
        type === 'orange' ? '#ffc466' : type === 'coconut' ? '#a6eb6c' : '#ff9888'
      ),
      sheenRoughness: 0.4,
      ...(options.materialProps || {}),
    });

    return safeApplyWorldCurve(mat, options.curveOptions);
  }

  /**
   * Satin matte clay material with zero harsh metallic speculars.
   */
  static createClayMaterial(colorHex = '#e8dfd1', roughness = 0.55, options = {}) {
    const color = new THREE.Color(colorHex);
    const sheenColor = color.clone().lerp(new THREE.Color('#ffffff'), 0.35);
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness,
      metalness: 0.0,
      sheen: 0.26,
      sheenColor,
      sheenRoughness: 0.68,
      ...(options.materialProps || {}),
    });
    return safeApplyWorldCurve(mat, options.curveOptions);
  }

  /**
   * Toy-like satin plastic material with soft clearcoat and zero harsh metallic glare.
   */
  static createPlasticMaterial(colorHex = '#ffffff', roughness = 0.35, options = {}) {
    const color = new THREE.Color(colorHex);
    const sheenColor = color.clone().lerp(new THREE.Color('#ffffff'), 0.4);
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness,
      metalness: 0.0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.32,
      sheen: 0.22,
      sheenColor,
      sheenRoughness: 0.5,
      ...(options.materialProps || {}),
    });
    return safeApplyWorldCurve(mat, options.curveOptions);
  }

  /**
   * Chiseled dark coastal boulder / stone material (`#56525c` slate, `#8c8e94` bridge, `#edeae4` marble).
   */
  static createStoneMaterial(variant = 'slate', options = {}) {
    const v = String(variant || 'slate').toLowerCase();
    let colorHex = '#56525c';
    let roughness = 0.78;
    if (v === 'bridge' || v === 'cobble') {
      colorHex = '#8c8e94';
      roughness = 0.78;
    } else if (v === 'marble' || v === 'fountain') {
      colorHex = '#edeae2';
      roughness = 0.45;
    } else if (v.startsWith('#')) {
      colorHex = variant;
    }

    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colorHex),
      roughness,
      metalness: 0.02,
      sheen: 0.14,
      sheenColor: new THREE.Color('#9ea4b0'),
      sheenRoughness: 0.78,
      flatShading: options.flatShading ?? (v === 'slate' || v === 'boulder'),
      ...(options.materialProps || {}),
    });
    return safeApplyWorldCurve(mat, options.curveOptions);
  }

  /**
   * Shared radial soft dark-green/umber gradient alpha material for grounding
   * trees, flowers, rocks, props, and characters into the grass/sand.
   */
  static createContactShadowMaterial(opacity = 0.42) {
    const key = `contact_shadow_tex`;
    const map = MaterialFactory._getCached(key, () => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const cx = size * 0.5;
      const cy = size * 0.5;
      const grad = ctx.createRadialGradient(cx, cy, size * 0.06, cx, cy, size * 0.48);
      grad.addColorStop(0.0, 'rgba(18, 36, 14, 0.92)');
      grad.addColorStop(0.48, 'rgba(22, 42, 16, 0.58)');
      grad.addColorStop(0.78, 'rgba(26, 46, 18, 0.20)');
      grad.addColorStop(1.0, 'rgba(26, 46, 18, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    });

    const mat = new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    return safeApplyWorldCurve(mat);
  }

  /**
   * Returns a horizontal `THREE.Mesh` (`PlaneGeometry` rotated `-Math.PI / 2`)
   * with a radial soft dark-green/brown gradient alpha `CanvasTexture`
   * (`depthWrite: false`, `polygonOffset: true`) that grounds any object into
   * the grass or sand.
   */
  static createContactShadowDisc(radiusX = 1.0, radiusZ = 1.0, opacity = 0.42) {
    const geo = new THREE.PlaneGeometry(radiusX * 2.0, radiusZ * 2.0, 4, 4);
    geo.rotateX(-Math.PI / 2);
    const mat = MaterialFactory.createContactShadowMaterial(opacity);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.018;
    mesh.renderOrder = 1;
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.userData.noShadow = true;
    mesh.name = 'ContactShadowDisc';
    return mesh;
  }

  // Instance method delegators
  createGrassMaterial(options) {
    return MaterialFactory.createGrassMaterial(options);
  }
  createCliffMaterial(options) {
    return MaterialFactory.createCliffMaterial(options);
  }
  createSandMaterial(options) {
    return MaterialFactory.createSandMaterial(options);
  }
  createDirtPathMaterial(options) {
    return MaterialFactory.createDirtPathMaterial(options);
  }
  createWoodMaterial(variant, options) {
    return MaterialFactory.createWoodMaterial(variant, options);
  }
  createFabricMaterial(variant, options) {
    return MaterialFactory.createFabricMaterial(variant, options);
  }
  createFoliageMaterial(tier, options) {
    return MaterialFactory.createFoliageMaterial(tier, options);
  }
  createPalmFrondMaterial(options) {
    return MaterialFactory.createPalmFrondMaterial(options);
  }
  createGlossyFruitMaterial(fruitType, options) {
    return MaterialFactory.createGlossyFruitMaterial(fruitType, options);
  }
  createClayMaterial(colorHex, roughness, options) {
    return MaterialFactory.createClayMaterial(colorHex, roughness, options);
  }
  createPlasticMaterial(colorHex, roughness, options) {
    return MaterialFactory.createPlasticMaterial(colorHex, roughness, options);
  }
  createStoneMaterial(variant, options) {
    return MaterialFactory.createStoneMaterial(variant, options);
  }
  createContactShadowMaterial(opacity) {
    return MaterialFactory.createContactShadowMaterial(opacity);
  }
  createContactShadowDisc(radiusX, radiusZ, opacity) {
    return MaterialFactory.createContactShadowDisc(radiusX, radiusZ, opacity);
  }
}

export const materialFactory = new MaterialFactory();

/**
 * Shared vertex shader snippet that applies the exact same world-horizon curvature
 * (`WORLD_CURVE_UNIFORMS`) to custom Ocean, River, and Waterfall `ShaderMaterial`s.
 */
const WATER_CURVE_VERTEX_SHADER = /* glsl */ `
  uniform float uCurveStrength;
  uniform float uCurveRadialX;
  uniform float uCameraZ;
  uniform float uCameraX;
  uniform float uCurveStartDist;
  uniform float uCurveEnabled;
  uniform float uTime;

  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying vec3 vNormalW;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPos = worldPosition.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);

    if (uCurveEnabled > 0.5) {
      float dz = worldPosition.z - uCameraZ;
      float dx = (worldPosition.x - uCameraX) * uCurveRadialX;
      float dist = max(0.0, length(vec2(dx, dz)) - uCurveStartDist);
      worldPosition.y -= uCurveStrength * dist * dist;
    }

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

function createSharedCurveUniforms(extraUniforms = {}) {
  const wc = WORLD_CURVE_UNIFORMS || {};
  return {
    uCurveStrength: wc.uCurveStrength || { value: 0.0115 },
    uCurveRadialX: wc.uCurveRadialX || { value: 0.22 },
    uCameraZ: wc.uCameraZ || { value: 0.0 },
    uCameraX: wc.uCameraX || { value: 0.0 },
    uCurveStartDist: wc.uCurveStartDist || { value: 5.5 },
    uCurveEnabled: wc.uCurveEnabled || { value: 1.0 },
    uTime: wc.uTime || { value: 0.0 },
    ...extraUniforms,
  };
}

/**
 * EnvironmentBuilder: Constructs the complete Argon Valley
 * multi-tier sculpted island environment, custom water shaders, lush 3-tier
 * smooth-normal scalloped fruit & palm trees, 3D tulip & cosmos flower beds,
 * dirt path network, and watertight faceted coastal boulders.
 */
export class EnvironmentBuilder {
  constructor(scene, gridSystem = null) {
    this.scene = scene;
    this.gridSystem = gridSystem;

    this.root = new THREE.Group();
    this.root.name = 'CozyIslandEnvironment';

    this.terrainGroup = new THREE.Group();
    this.terrainGroup.name = 'SculptedTerrainGroup';
    this.root.add(this.terrainGroup);

    this.dirtPathGroup = new THREE.Group();
    this.dirtPathGroup.name = 'DirtPathGroup';
    this.root.add(this.dirtPathGroup);

    this.vegetationGroup = new THREE.Group();
    this.vegetationGroup.name = 'VegetationGroup';
    this.root.add(this.vegetationGroup);

    this.rockGroup = new THREE.Group();
    this.rockGroup.name = 'CoastalRocksGroup';
    this.root.add(this.rockGroup);

    this.waterGroup = new THREE.Group();
    this.waterGroup.name = 'WaterSystemGroup';
    this.root.add(this.waterGroup);

    this.trees = [];
    this.flowers = [];
    this.rocks = [];
    this.grassTufts = [];
    this.digHoles = [];
    this.fallingFruits = [];
    this.collectableItems = [];
    this._digCounter = 0;
    this.dirtTileKeys = new Set();
    this._sharedGeometries = {};
    this.activePreset = 'free_roam';

    // Build all island subsystems
    this._buildMultiTierTerrain();
    this._buildCliffInclineRamp();
    this._buildInitialDirtPath();
    this._buildTrees();
    this._buildFlowersAndTufts();
    this._buildCoastalBoulders();
    this.waterSystem = this._buildWaterSystem();

    try {
      applyWorldCurveToHierarchy(this.terrainGroup);
      applyWorldCurveToHierarchy(this.dirtPathGroup);
      applyWorldCurveToHierarchy(this.vegetationGroup);
      applyWorldCurveToHierarchy(this.rockGroup);
    } catch (e) {
      // Individual materials already have safeApplyWorldCurve applied
    }

    if (this.scene && typeof this.scene.add === 'function') {
      this.scene.add(this.root);
    }

    this.update = this.update.bind(this);
    this.addDirtTile = this.addDirtTile.bind(this);
    this.spawnDigHole = this.spawnDigHole.bind(this);
    this.shakeNearestTree = this.shakeNearestTree.bind(this);
    this.waterFlowersNear = this.waterFlowersNear.bind(this);
    this.collectNearbyItems = this.collectNearbyItems.bind(this);
    this.setScenePreset = this.setScenePreset.bind(this);
    this.setPreset = this.setScenePreset.bind(this);
  }

  build() {
    return this;
  }

  _getRiverCenterZ(x) {
    return -3.85 + Math.sin((x + 2.5) * 0.14) * 0.52;
  }

  _getRiverHalfWidth(x) {
    return 1.05 + Math.cos(x * 0.18) * 0.08;
  }

  _getRiverDepthFactor(x, z) {
    // 1. Main East-West River (`x in [-38, 10.6]`)
    const rCenter = this._getRiverCenterZ(x);
    const rHalf = this._getRiverHalfWidth(x);
    let minSignedDist = Math.abs(z - rCenter) - rHalf;
    if (x > 10.6) {
      minSignedDist = Math.hypot(x - 10.6, Math.max(0, Math.abs(z - rCenter) - rHalf));
    }

    // 2. Waterfall Plunge Pool Basin (`ref_06_cliff_waterfall.png` left side!)
    if (z >= -13.65 && z <= -3.2 && x >= -16.0 && x <= -5.5) {
      let rightBankX = -8.85;
      if (z > -7.8 && z < -5.3) {
        const notchT = Math.sin(((z + 7.8) / 2.5) * Math.PI);
        rightBankX = -8.85 + notchT * 1.38;
      } else if (z >= -5.3) {
        rightBankX = -9.65;
      }
      const leftBankX = -14.2;
      const dx = Math.max(leftBankX - x, x - rightBankX);
      const dz = Math.max(-13.55 - z, z - -3.6);
      const poolDist = Math.max(dx, dz);
      minSignedDist = Math.min(minSignedDist, poolDist);
    }

    // 3. River Mouth Southern Branch (`ref_05_beach_bridge_villagers.png` right side!)
    // Flows under the Stone Arch Bridge at (10.2, 14.2) southward into the ocean at z = 22
    if (z >= -4.5 && z <= 23.0 && x >= 7.8 && x <= 15.5) {
      const mouthCenterX = 10.45 + Math.sin((z + 4.0) * 0.14) * 0.35;
      const mouthHalfW = z > 15.0 ? 1.55 + (z - 15.0) * 0.22 : 1.42;
      const mouthDist = Math.abs(x - mouthCenterX) - mouthHalfW;
      minSignedDist = Math.min(minSignedDist, mouthDist);
    }

    return minSignedDist;
  }

  _getShorelineZ(x) {
    // Deep right-hand cove around x = 1.6..4.8 so ref_01 shows the sweeping diagonal ocean shoreline!
    const ref01Cove = Math.exp(-Math.pow((x - 3.3) / 1.95, 2.0)) * 4.25;
    const estuaryInlet = Math.exp(-Math.pow((x - 10.45) / 2.1, 2.0)) * 3.4;
    const leftSweep = THREE.MathUtils.clamp((-x + 1.0) / 5.0, 0.0, 1.0) * 0.55;
    return 21.55 + leftSweep - ref01Cove - estuaryInlet;
  }

  getTerrainHeightAt(x, z) {
    if (z < -13.5) {
      if (x > -13.1 && x < -8.9) {
        return 2.82;
      }
      return 3.2;
    }
    const riverDist = this._getRiverDepthFactor(x, z);
    if (riverDist < 0.0) {
      const t = THREE.MathUtils.clamp(-riverDist / 0.55, 0.0, 1.0);
      return THREE.MathUtils.lerp(0.55, -0.25, t);
    }
    if (z <= 13.5) {
      return 0.6;
    }
    // Left coastal terracotta bluff top (where the ref_01 Apple Tree at -5.2, 14.5 sits)
    if (x >= -12.5 && x <= -2.4 && z >= 13.5 && z <= 15.6) {
      const tipT = THREE.MathUtils.clamp((x - -3.8) / 1.4, 0.0, 1.0);
      return THREE.MathUtils.lerp(0.96, 0.52, tipT);
    }
    if (z <= 13.8) {
      const t = (z - 13.5) / 0.3;
      return THREE.MathUtils.lerp(0.6, 0.52, t);
    }
    if (z <= 22.5) {
      const t = THREE.MathUtils.clamp((z - 13.8) / (22.5 - 13.8), 0.0, 1.0);
      const smoothT = t * t * (3.0 - 2.0 * t);
      return THREE.MathUtils.lerp(0.52, 0.02, smoothT);
    }
    const subT = THREE.MathUtils.clamp((z - 22.5) / 2.0, 0.0, 1.0);
    return THREE.MathUtils.lerp(0.02, -0.55, subT);
  }

  _buildMultiTierTerrain() {
    const grassMat = MaterialFactory.createGrassMaterial({ repeatX: 14, repeatY: 14 });
    const upperGrassMat = MaterialFactory.createGrassMaterial({ repeatX: 12, repeatY: 6 });
    const cliffMat = MaterialFactory.createCliffMaterial({ variant: 'main' });
    const coastalCliffMat = MaterialFactory.createCliffMaterial({ variant: 'coastal' });
    const sandMat = MaterialFactory.createSandMaterial({ repeatX: 12, repeatY: 6 });
    const bankTopSoilMat = MaterialFactory.createClayMaterial('#c88450', 0.84);
    const bankWetSoilMat = MaterialFactory.createClayMaterial('#7c4b2b', 0.68);
    const grassLipMat = MaterialFactory.createClayMaterial('#4cac34', 0.75);

    // --- A. UPPER CLIFF PLATEAU (z in [-32, -13.5], y = 3.2) ---
    const upperWidth = 72;
    const upperDepth = 18.5;
    const upperGeo = new THREE.PlaneGeometry(upperWidth, upperDepth, 144, 36);
    upperGeo.rotateX(-Math.PI / 2);
    const uPos = upperGeo.attributes.position;

    for (let i = 0; i < uPos.count; i++) {
      const vx = uPos.getX(i);
      let vz = uPos.getZ(i) - 22.75;

      if (vz > -14.5) {
        const edgeFactor = THREE.MathUtils.clamp((vz + 14.5) / 1.0, 0, 1);
        if (vx < -13.1) {
          vz += edgeFactor * 0.55;
        } else if (vx > -5.2) {
          vz -= edgeFactor * 0.45;
        }
      }

      let vy = 3.2;
      const distFromNotch = Math.abs(vx - -11.0) - 2.05;
      if (distFromNotch < 0.0) {
        const depthT = THREE.MathUtils.clamp(-distFromNotch / 0.45, 0, 1);
        vy = THREE.MathUtils.lerp(3.2, 2.76, depthT);
      }

      uPos.setXYZ(i, vx, vy, vz);
    }
    upperGeo.computeVertexNormals();
    this.upperPlateauMesh = new THREE.Mesh(upperGeo, upperGrassMat);
    this.upperPlateauMesh.receiveShadow = true;
    this.upperPlateauMesh.castShadow = true;
    this.terrainGroup.add(this.upperPlateauMesh);

    // --- B. VERTICALLY FACETED TERRACOTTA CLIFF WALL & OVERHANGING GRASS LIP (ref_06) ---
    this.cliffWallGroup = this._buildFacetedCliffWall(cliffMat, grassLipMat, bankTopSoilMat);

    // --- C. MAIN VILLAGE GRASS PLATEAU (z in [-13.5, 13.6], y = 0.6) ---
    const mainWidth = 72;
    const mainDepth = 27.4;
    const segX = 180;
    const segZ = 96;
    const mainGeo = new THREE.PlaneGeometry(mainWidth, mainDepth, segX, segZ);
    mainGeo.rotateX(-Math.PI / 2);
    const mPos = mainGeo.attributes.position;

    for (let i = 0; i < mPos.count; i++) {
      const vx = mPos.getX(i);
      const vz = mPos.getZ(i);
      const riverDist = this._getRiverDepthFactor(vx, vz);

      let vy = 0.6;
      if (riverDist < 0.15) {
        const t = THREE.MathUtils.clamp((0.15 - riverDist) / 0.65, 0.0, 1.0);
        const smoothT = t * t * (3.0 - 2.0 * t);
        vy = THREE.MathUtils.lerp(0.6, -0.28, smoothT);
      }

      if (vz > 13.1 && riverDist > 0.2) {
        const edgeT = THREE.MathUtils.clamp((vz - 13.1) / 0.6, 0.0, 1.0);
        vy -= edgeT * edgeT * 0.1;
      }

      mPos.setXYZ(i, vx, vy, vz);
    }
    mainGeo.computeVertexNormals();
    this.mainGrassMesh = new THREE.Mesh(mainGeo, grassMat);
    this.mainGrassMesh.receiveShadow = true;
    this.mainGrassMesh.castShadow = false;
    this.terrainGroup.add(this.mainGrassMesh);

    // Flat uninterrupted lawn cover for `house_yard` (ref_02) and `tent_horizon` (ref_04)
    // so those two scenes have a 100% solid rolling green grass horizon with no river cut!
    const flatLawnGeo = new THREE.PlaneGeometry(72, 34, 144, 68);
    flatLawnGeo.rotateX(-Math.PI / 2);
    this.flatLawnCoverMesh = new THREE.Mesh(flatLawnGeo, grassMat);
    this.flatLawnCoverMesh.position.set(0, 0.602, -6.5);
    this.flatLawnCoverMesh.receiveShadow = true;
    this.flatLawnCoverMesh.visible = false;
    this.terrainGroup.add(this.flatLawnCoverMesh);

    // --- D. RECESSED STEPPED TERRACOTTA SOIL RIVERBANK RIMS (ref_03 & ref_06) ---
    this.riverbankGroup = this._buildSteppedRiverbankRims(bankTopSoilMat, bankWetSoilMat);

    // --- E. TERRACOTTA COASTAL BLUFF (ref_01 left side) & GOLDEN SANDY BEACH (z in [13.4, 25.4]) ---
    this._buildCoastalBluffAndBeach(coastalCliffMat, grassLipMat, sandMat);
  }

  _buildFacetedCliffWall(cliffMat, grassLipMat, soilMat) {
    const cliffGroup = new THREE.Group();
    cliffGroup.name = 'UpperCliffWall';

    const getCliffZ = (x) => {
      if (x < -13.1) return -12.95 + Math.sin(x * 0.35) * 0.12;
      if (x > -5.4) {
        const stepT = THREE.MathUtils.clamp((x - -5.4) / 0.7, 0, 1);
        return THREE.MathUtils.lerp(-13.5, -14.05, stepT) + Math.sin(x * 0.3) * 0.08;
      }
      return -13.5 + Math.sin(x * 0.4) * 0.08;
    };

    const buildWallSpan = (xStart, xEnd) => {
      const colStep = 0.76;
      const numCols = Math.ceil((xEnd - xStart) / colStep);
      const dx = (xEnd - xStart) / numCols;

      const tierHeights = [0.6, 0.82, 1.55, 2.35, 3.16];
      const positions = [];
      const uvs = [];
      const indices = [];

      let vertOffset = 0;
      for (let c = 0; c < numCols; c++) {
        const x0 = xStart + c * dx;
        const x1 = x0 + dx;
        const facetOut0 = (c * 7) % 3 === 0 ? 0.11 : (c * 7) % 3 === 1 ? -0.07 : 0.02;
        const facetOut1 = ((c + 1) * 7) % 3 === 0 ? 0.11 : ((c + 1) * 7) % 3 === 1 ? -0.07 : 0.02;

        const zBase0 = getCliffZ(x0) + facetOut0;
        const zBase1 = getCliffZ(x1) + facetOut1;

        for (let t = 0; t < tierHeights.length - 1; t++) {
          const yBot = tierHeights[t];
          const yTop = tierHeights[t + 1];

          const batterBot = t === 0 ? 0.12 : (3 - t) * 0.03;
          const batterTop = (3 - (t + 1)) * 0.03;

          const p00 = [x0, yBot, zBase0 + batterBot];
          const p10 = [x1, yBot, zBase1 + batterBot];
          const p11 = [x1, yTop, zBase1 + batterTop];
          const p01 = [x0, yTop, zBase0 + batterTop];

          positions.push(...p00, ...p10, ...p11, ...p01);

          const u0 = (x0 - xStart) / 6.0;
          const u1 = (x1 - xStart) / 6.0;
          const vBot = (yBot - 0.6) / 2.56;
          const vTop = (yTop - 0.6) / 2.56;
          uvs.push(u0, vBot, u1, vBot, u1, vTop, u0, vTop);

          indices.push(
            vertOffset,
            vertOffset + 1,
            vertOffset + 2,
            vertOffset,
            vertOffset + 2,
            vertOffset + 3
          );
          vertOffset += 4;
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const wallMesh = new THREE.Mesh(geo, cliffMat);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      cliffGroup.add(wallMesh);

      // Flush overhanging rounded bright-green grass lip along the top of the cliff wall (ref_06!)
      const lipPoints = [];
      for (let c = 0; c <= numCols; c++) {
        const lx = xStart + c * dx;
        const lz = getCliffZ(lx) + 0.05;
        lipPoints.push(new THREE.Vector3(lx, 0.0, lz));
      }
      const lipCurve = new THREE.CatmullRomCurve3(lipPoints);
      const lipGeo = new THREE.TubeGeometry(lipCurve, numCols * 2, 0.13, 8, false);
      lipGeo.scale(1.0, 0.45, 1.25);
      const lipMesh = new THREE.Mesh(lipGeo, grassLipMat);
      lipMesh.position.y = 3.17;
      lipMesh.castShadow = true;
      lipMesh.receiveShadow = true;
      cliffGroup.add(lipMesh);
    };

    buildWallSpan(-34.0, -13.05);
    buildWallSpan(-8.95, 34.0);

    // Recessed terracotta banks along the upper waterfall river channel (below y = 3.20!)
    for (const sideX of [-13.08, -8.92]) {
      const bankGeo = new THREE.BoxGeometry(0.38, 0.34, 18.0, 2, 2, 24);
      const bankMesh = new THREE.Mesh(bankGeo, soilMat);
      bankMesh.position.set(sideX, 2.98, -22.5);
      bankMesh.receiveShadow = true;
      cliffGroup.add(bankMesh);
    }

    // Small grass terrace ledge on the far left of the waterfall (ref_06 left edge!)
    const leftLedgeGeo = new THREE.CylinderGeometry(0.95, 1.08, 1.35, 10, 2);
    const leftLedge = new THREE.Mesh(leftLedgeGeo, cliffMat);
    leftLedge.position.set(-14.2, 1.25, -11.8);
    leftLedge.castShadow = true;
    leftLedge.receiveShadow = true;
    cliffGroup.add(leftLedge);

    const leftLedgeCapGeo = new THREE.CylinderGeometry(1.02, 1.02, 0.14, 12);
    const leftLedgeCap = new THREE.Mesh(leftLedgeCapGeo, grassLipMat);
    leftLedgeCap.position.set(-14.2, 1.92, -11.8);
    cliffGroup.add(leftLedgeCap);

    this.terrainGroup.add(cliffGroup);
    return cliffGroup;
  }

  /**
   * Builds the recessed stepped terracotta-brown soil riverbanks (`#c88450` upper
   * bevel, `#7c4b2b` dark wet waterline rim) sitting BELOW the `y = 0.60` grass
   * plateau with zero protruding pool-noodle tubes!
   */
  _buildSteppedRiverbankRims(bankTopSoilMat, bankWetSoilMat) {
    const bankGroup = new THREE.Group();
    bankGroup.name = 'SteppedRiverbanks';

    const buildBankRibbon = (points, radiusTop = 0.24, radiusWet = 0.18) => {
      if (points.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(points);
      const segs = Math.max(24, points.length * 4);

      // Upper warm terracotta soil step (top sits at y = 0.29 + 0.24*0.85 = 0.494, cleanly below y = 0.60 grass!)
      const upperGeo = new THREE.TubeGeometry(curve, segs, radiusTop, 8, false);
      const upperMesh = new THREE.Mesh(upperGeo, bankTopSoilMat);
      upperMesh.scale.y = 0.85;
      upperMesh.position.y = 0.29;
      upperMesh.receiveShadow = true;
      upperMesh.castShadow = true;
      bankGroup.add(upperMesh);

      // Lower dark wet soil waterline rim (sits at y = 0.14 right at the y = 0.18 river waterline)
      const wetGeo = new THREE.TubeGeometry(curve, segs, radiusWet, 8, false);
      const wetMesh = new THREE.Mesh(wetGeo, bankWetSoilMat);
      wetMesh.scale.y = 0.75;
      wetMesh.position.y = 0.14;
      wetMesh.receiveShadow = true;
      bankGroup.add(wetMesh);
    };

    // 1. North Bank of East-West River (from x = -8.8 to x = 9.4)
    const northBankPts = [];
    for (let x = -8.8; x <= 9.4; x += 0.6) {
      const z = this._getRiverCenterZ(x) - this._getRiverHalfWidth(x) - 0.05;
      northBankPts.push(new THREE.Vector3(x, 0, z));
    }
    buildBankRibbon(northBankPts, 0.24, 0.19);

    // 2. South Bank of East-West River (from x = -16.0 to x = 9.0)
    const southBankPts = [];
    for (let x = -16.0; x <= 9.0; x += 0.6) {
      const z = this._getRiverCenterZ(x) + this._getRiverHalfWidth(x) + 0.05;
      southBankPts.push(new THREE.Vector3(x, 0, z));
    }
    buildBankRibbon(southBankPts, 0.24, 0.19);

    // 3. Waterfall Plunge Basin Right Stepped Bank (`ref_06_cliff_waterfall.png` foreground-left!)
    const plungeRightPts = [
      new THREE.Vector3(-8.85, 0, -13.4),
      new THREE.Vector3(-8.95, 0, -11.5),
      new THREE.Vector3(-9.0, 0, -9.8),
      new THREE.Vector3(-8.85, 0, -8.2),
      new THREE.Vector3(-8.2, 0, -7.2),
      new THREE.Vector3(-7.5, 0, -6.3),
      new THREE.Vector3(-7.45, 0, -5.85),
      new THREE.Vector3(-8.4, 0, -5.35),
      new THREE.Vector3(-9.2, 0, -4.95),
    ];
    buildBankRibbon(plungeRightPts, 0.26, 0.21);

    const peninsulaPts = [
      new THREE.Vector3(-12.2, 0, -5.0),
      new THREE.Vector3(-10.2, 0, -4.95),
      new THREE.Vector3(-8.8, 0, -4.85),
    ];
    buildBankRibbon(peninsulaPts, 0.24, 0.19);

    // 4. River Mouth Banks (`ref_05` right side)
    const mouthWestPts = [];
    const mouthEastPts = [];
    for (let z = -3.8; z <= 14.5; z += 0.8) {
      const cx = 10.45 + Math.sin((z + 4.0) * 0.14) * 0.35;
      mouthWestPts.push(new THREE.Vector3(cx - 1.45, 0, z));
      mouthEastPts.push(new THREE.Vector3(cx + 1.45, 0, z));
    }
    buildBankRibbon(mouthWestPts, 0.22, 0.18);
    buildBankRibbon(mouthEastPts, 0.22, 0.18);

    this.terrainGroup.add(bankGroup);
    return bankGroup;
  }

  _buildCoastalBluffAndBeach(coastalCliffMat, grassLipMat, sandMat) {
    const beachGroup = new THREE.Group();
    beachGroup.name = 'CoastalBluffAndBeach';

    // 1. Golden Sandy Beach Mesh (z from 13.4 to 25.4, x from -36 to 36)
    const bWidth = 72;
    const bDepth = 12.0;
    const bGeo = new THREE.PlaneGeometry(bWidth, bDepth, 160, 48);
    bGeo.rotateX(-Math.PI / 2);
    const bPos = bGeo.attributes.position;
    const colors = new Float32Array(bPos.count * 3);

    const dryColor = new THREE.Color('#ffffff');
    const wetColor = new THREE.Color('#cfa870');
    const deepSubmergedColor = new THREE.Color('#7ca89e');
    const tmpColor = new THREE.Color();

    for (let i = 0; i < bPos.count; i++) {
      const vx = bPos.getX(i);
      const vz = bPos.getZ(i) + 19.4;
      const shoreZ = this._getShorelineZ(vx);
      const riverDist = this._getRiverDepthFactor(vx, vz);

      let vy;
      if (vz <= 13.8) {
        const t = THREE.MathUtils.clamp((vz - 13.5) / 0.3, 0.0, 1.0);
        vy = THREE.MathUtils.lerp(0.6, 0.52, t);
      } else if (vz <= 22.5) {
        const t = THREE.MathUtils.clamp((vz - 13.8) / (22.5 - 13.8), 0.0, 1.0);
        const smoothT = t * t * (3.0 - 2.0 * t);
        vy = THREE.MathUtils.lerp(0.52, 0.02, smoothT);
      } else {
        const t = THREE.MathUtils.clamp((vz - 22.5) / 2.0, 0.0, 1.0);
        vy = THREE.MathUtils.lerp(0.02, -0.55, t);
      }

      if (vz > shoreZ - 0.35) {
        const subT = THREE.MathUtils.clamp((vz - (shoreZ - 0.35)) / 2.2, 0.0, 1.0);
        vy = Math.min(vy, THREE.MathUtils.lerp(0.16, -0.45, subT));
      }

      if (riverDist < 0.0) {
        const rt = THREE.MathUtils.clamp(-riverDist / 0.7, 0.0, 1.0);
        vy = Math.min(vy, THREE.MathUtils.lerp(0.18, -0.35, rt));
      }

      bPos.setXYZ(i, vx, vy, vz);

      const distToWater = Math.min(shoreZ - vz, Math.max(0.0, riverDist));
      if (distToWater < -0.5) {
        tmpColor.copy(deepSubmergedColor);
      } else if (distToWater < 1.1) {
        const wetT = THREE.MathUtils.clamp((1.1 - distToWater) / 1.6, 0.0, 1.0);
        tmpColor.copy(dryColor).lerp(wetColor, wetT * 0.72);
      } else {
        tmpColor.copy(dryColor);
      }
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }

    bGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    bGeo.computeVertexNormals();
    sandMat.vertexColors = true;
    sandMat.needsUpdate = true;

    this.beachMesh = new THREE.Mesh(bGeo, sandMat);
    this.beachMesh.receiveShadow = true;
    beachGroup.add(this.beachMesh);

    // 2. Sculpted Terracotta Coastal Earth Bluff (`ref_01_beach_sunset.png` left side!)
    const bluffGroup = new THREE.Group();
    bluffGroup.name = 'LeftCoastalTerracottaBluff';

    const bluffCols = 18;
    const xMin = -12.5;
    const xMax = -1.75;
    const stepX = (xMax - xMin) / bluffCols;

    const getBluffFrontZ = (x) => {
      const taper = THREE.MathUtils.clamp((x - xMin) / (xMax - xMin), 0, 1);
      return 16.5 - taper * 1.2 + Math.sin(x * 0.65) * 0.16;
    };

    const getBluffTopY = (x) => {
      const tipT = THREE.MathUtils.clamp((x - -3.6) / 1.85, 0, 1);
      return THREE.MathUtils.lerp(1.02, 0.42, tipT * tipT);
    };

    const wallPos = [];
    const wallUvs = [];
    const wallIdx = [];
    let wVert = 0;

    for (let c = 0; c < bluffCols; c++) {
      const x0 = xMin + c * stepX;
      const x1 = x0 + stepX;
      const z0 = getBluffFrontZ(x0) + (c % 2 === 0 ? 0.07 : -0.05);
      const z1 = getBluffFrontZ(x1) + ((c + 1) % 2 === 0 ? 0.07 : -0.05);
      const yTop0 = getBluffTopY(x0);
      const yTop1 = getBluffTopY(x1);
      const yBot = 0.25;

      const p00 = [x0, yBot, z0 + 0.34];
      const p10 = [x1, yBot, z1 + 0.34];
      const p11 = [x1, yTop1, z1];
      const p01 = [x0, yTop0, z0];

      wallPos.push(...p00, ...p10, ...p11, ...p01);
      wallUvs.push(c / 4, 0, (c + 1) / 4, 0, (c + 1) / 4, 1, c / 4, 1);
      wallIdx.push(wVert, wVert + 1, wVert + 2, wVert, wVert + 2, wVert + 3);
      wVert += 4;
    }

    const bluffWallGeo = new THREE.BufferGeometry();
    bluffWallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
    bluffWallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUvs, 2));
    bluffWallGeo.setIndex(wallIdx);
    bluffWallGeo.computeVertexNormals();

    const bluffWallMesh = new THREE.Mesh(bluffWallGeo, coastalCliffMat);
    bluffWallMesh.castShadow = true;
    bluffWallMesh.receiveShadow = true;
    bluffGroup.add(bluffWallMesh);

    const capGeo = new THREE.PlaneGeometry(xMax - xMin, 4.4, bluffCols * 2, 12);
    capGeo.rotateX(-Math.PI / 2);
    const cPos = capGeo.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const lx = cPos.getX(i) + (xMin + xMax) * 0.5;
      const normZ = (cPos.getZ(i) + 2.2) / 4.4;
      const frontZ = getBluffFrontZ(lx);
      const wz = THREE.MathUtils.lerp(12.2, frontZ + 0.04, normZ);
      const topY = getBluffTopY(lx);
      const wy = THREE.MathUtils.lerp(0.62, topY, Math.sin(normZ * Math.PI * 0.5));
      cPos.setXYZ(i, lx, wy, wz);
    }
    capGeo.computeVertexNormals();
    const bluffGrassMat = MaterialFactory.createGrassMaterial({ repeatX: 5, repeatY: 3 });
    const bluffCapMesh = new THREE.Mesh(capGeo, bluffGrassMat);
    bluffCapMesh.receiveShadow = true;
    bluffCapMesh.castShadow = true;
    bluffGroup.add(bluffCapMesh);

    const lipPts = [];
    for (let c = 0; c <= bluffCols; c++) {
      const lx = xMin + c * stepX;
      lipPts.push(new THREE.Vector3(lx, getBluffTopY(lx) - 0.03, getBluffFrontZ(lx) + 0.04));
    }
    const bluffLipCurve = new THREE.CatmullRomCurve3(lipPts);
    const bluffLipGeo = new THREE.TubeGeometry(bluffLipCurve, 36, 0.09, 8, false);
    const bluffLipMesh = new THREE.Mesh(bluffLipGeo, grassLipMat);
    bluffLipMesh.castShadow = true;
    bluffGroup.add(bluffLipMesh);

    this.leftCoastalBluffGroup = bluffGroup;
    beachGroup.add(bluffGroup);
    this.terrainGroup.add(beachGroup);
  }

  /**
   * Builds a sculpted Argon Valley natural stone & wooden log incline ramp at
   * `x in [-4.6, -2.4], z in [-14.2, -10.2]` rising smoothly from `y = 0.60`
   * (Main Village Grass Plateau) up to `y = 3.20` (Upper Cliff Plateau).
   */
  _buildCliffInclineRamp() {
    const rampGroup = new THREE.Group();
    rampGroup.name = 'CliffInclineRamp';

    const dirtMat = MaterialFactory.createDirtPathMaterial({ polygonOffset: true });
    const logMat = MaterialFactory.createWoodMaterial('bark');
    const logCutMat = MaterialFactory.createWoodMaterial('log_cut');
    const wallMat = MaterialFactory.createCliffMaterial({ variant: 'main' });

    const numSteps = 10;
    const zStart = -10.25;
    const zEnd = -14.05;
    const xCenter = -3.5;
    const rampWidth = 2.05;

    for (let i = 0; i < numSteps; i++) {
      const t0 = i / numSteps;
      const t1 = (i + 1) / numSteps;
      const z0 = THREE.MathUtils.lerp(zStart, zEnd, t0);
      const z1 = THREE.MathUtils.lerp(zStart, zEnd, t1);
      const zMid = (z0 + z1) * 0.5;
      const stepDepth = Math.abs(z1 - z0);

      const smoothT = ((t0 + t1) * 0.5) * ((t0 + t1) * 0.5) * (3.0 - 2.0 * ((t0 + t1) * 0.5));
      const yTop = THREE.MathUtils.lerp(0.62, 3.2, smoothT);
      const h = Math.max(0.08, yTop - 0.56);

      // Terracotta earth riser block supporting the step
      const riserGeo = new THREE.BoxGeometry(rampWidth, h, stepDepth + 0.08);
      const riserMesh = new THREE.Mesh(riserGeo, wallMat);
      riserMesh.position.set(xCenter, 0.56 + h * 0.5, zMid);
      riserMesh.castShadow = true;
      riserMesh.receiveShadow = true;
      rampGroup.add(riserMesh);

      // Warm packed dirt tread on top of each step
      const treadGeo = new THREE.BoxGeometry(rampWidth - 0.14, 0.05, stepDepth + 0.04);
      const treadMesh = new THREE.Mesh(treadGeo, dirtMat);
      treadMesh.position.set(xCenter, yTop + 0.01, zMid);
      treadMesh.receiveShadow = true;
      rampGroup.add(treadMesh);

      // Rounded wooden log riser beam across the front edge of each step
      const logGeo = new THREE.CylinderGeometry(0.085, 0.085, rampWidth + 0.1, 12);
      logGeo.rotateZ(Math.PI / 2);
      const logMesh = new THREE.Mesh(logGeo, logMat);
      logMesh.position.set(xCenter, yTop - 0.01, z0);
      logMesh.castShadow = true;
      logMesh.receiveShadow = true;
      rampGroup.add(logMesh);

      // Log end caps
      for (const side of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.CircleGeometry(0.082, 10), logCutMat);
        cap.position.set(xCenter + side * ((rampWidth + 0.11) * 0.5), yTop - 0.01, z0);
        cap.rotation.y = side * (Math.PI / 2);
        rampGroup.add(cap);
      }
    }

    this.cliffInclineRamp = rampGroup;
    this.terrainGroup.add(rampGroup);
  }

  _buildInitialDirtPath() {
    this._dirtMat = MaterialFactory.createDirtPathMaterial({ polygonOffset: true });
    this._dirtRimMat = MaterialFactory.createClayMaterial('#b48046', 0.88);
    this.yardPathTiles = [];
    this.dynamicDirtTiles = [];

    const verticalTiles = [
      [-6.5, -8.2],
      [-5.8, -8.2],
      [-5.1, -8.2],
      [-6.5, -7.5],
      [-5.8, -7.5],
      [-6.1, -6.8],
      [-6.1, -6.1],
      [-6.1, -5.4],
      [-6.1, -4.65],
    ];
    const horizontalTiles = [
      [-5.2, -6.2],
      [-4.4, -6.2],
      [-3.6, -6.2],
      [-2.8, -6.2],
    ];

    for (const [tx, tz] of [...verticalTiles, ...horizontalTiles]) {
      const patch = this._createRoundedDirtPatch(tx, tz, 1.15, 1.15);
      if (patch) this.yardPathTiles.push(patch);
    }

    // Freshly patted circular dirt mound right under the player's trowel in ref_02 (-1.72, -6.12)
    this.trowelMoundSpot = this._createFreshPattedDirtSpot(-1.72, -6.12);
    this.yardPathTiles.push(this.trowelMoundSpot);

    // Dug shovel soil clod spot right in front of the player's shovel in ref_06 (-7.55, -8.15)
    this.cliffDigHole = this.spawnDigHole(-7.55, -8.15, true);
  }

  _createRoundedDirtPatch(x, z, width = 1.15, depth = 1.15) {
    const key = `${Math.round(x * 2) / 2},${Math.round(z * 2) / 2}`;
    if (this.dirtTileKeys.has(key)) return null;
    this.dirtTileKeys.add(key);

    const yBase = this.getTerrainHeightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, yBase + 0.012, z);
    group.userData.tileKey = key;
    group.userData.tileX = x;
    group.userData.tileZ = z;

    const shape = new THREE.Shape();
    const hw = width * 0.5;
    const hd = depth * 0.5;
    const r = Math.min(hw, hd) * 0.38;

    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
    shape.lineTo(hw, hd - r);
    shape.quadraticCurveTo(hw, hd, hw - r, hd);
    shape.lineTo(-hw + r, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.06,
      bevelThickness: 0.014,
    });
    extrudeGeo.rotateX(Math.PI / 2);

    const tileMesh = new THREE.Mesh(extrudeGeo, this._dirtMat);
    tileMesh.receiveShadow = true;
    group.add(tileMesh);

    this.dirtPathGroup.add(group);
    return group;
  }

  _createFreshPattedDirtSpot(x, z) {
    const yBase = this.getTerrainHeightAt(x, z);
    const spotGroup = new THREE.Group();
    spotGroup.position.set(x, yBase + 0.015, z);

    const baseGeo = new THREE.CylinderGeometry(0.46, 0.52, 0.03, 18);
    const baseMesh = new THREE.Mesh(baseGeo, this._dirtMat);
    baseMesh.receiveShadow = true;
    spotGroup.add(baseMesh);

    const moundGeo = new THREE.SphereGeometry(0.24, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    moundGeo.scale(1.15, 0.45, 1.0);
    const moundMesh = new THREE.Mesh(moundGeo, this._dirtMat);
    moundMesh.position.set(0.08, 0.01, -0.02);
    spotGroup.add(moundMesh);

    const pebbleGeo = new THREE.DodecahedronGeometry(0.045, 1);
    const pebble = new THREE.Mesh(pebbleGeo, this._dirtRimMat);
    pebble.position.set(-0.48, 0.03, 0.14);
    spotGroup.add(pebble);

    this.dirtPathGroup.add(spotGroup);
    return spotGroup;
  }

  addDirtTile(x, z) {
    // Check if any dirt tile already exists near (x, z) -> toggle/remove it!
    if (this.yardPathTiles && this.yardPathTiles.length > 0) {
      for (let i = this.yardPathTiles.length - 1; i >= 0; i--) {
        const dt = this.yardPathTiles[i];
        if (!dt || !dt.position) continue;
        if (Math.hypot(dt.position.x - x, dt.position.z - z) < 0.68) {
          this.dirtPathGroup.remove(dt);
          if (dt.userData?.tileKey) {
            this.dirtTileKeys.delete(dt.userData.tileKey);
          }
          const roundKey = `${Math.round(x * 2) / 2},${Math.round(z * 2) / 2}`;
          this.dirtTileKeys.delete(roundKey);
          this.yardPathTiles.splice(i, 1);
          if (this.dynamicDirtTiles) {
            const dIdx = this.dynamicDirtTiles.indexOf(dt);
            if (dIdx >= 0) this.dynamicDirtTiles.splice(dIdx, 1);
          }
          if (this.gridSystem && typeof this.gridSystem.toggleDirtPathAt === 'function') {
            try {
              this.gridSystem.toggleDirtPathAt(x, z);
            } catch (e) {
              // ignore
            }
          }
          return { action: 'removed', placed: false, x, z };
        }
      }
    }

    const roundKey = `${Math.round(x * 2) / 2},${Math.round(z * 2) / 2}`;
    this.dirtTileKeys.delete(roundKey);
    const patch = this._createRoundedDirtPatch(x, z, 1.12, 1.12);
    if (patch) {
      safeApplyWorldCurve(patch);
      this.yardPathTiles.push(patch);
      if (!this.dynamicDirtTiles) this.dynamicDirtTiles = [];
      this.dynamicDirtTiles.push(patch);
      if (this.gridSystem && typeof this.gridSystem.toggleDirtPathAt === 'function') {
        try {
          this.gridSystem.toggleDirtPathAt(x, z);
        } catch (e) {
          // ignore
        }
      }
      return { action: 'added', placed: true, patch, x, z };
    }
    return { action: 'exists', placed: false, x, z };
  }

  _createBellBagMesh() {
    const bagGroup = new THREE.Group();
    bagGroup.name = 'BellBagCollectable';

    const sackMat = MaterialFactory.createClayMaterial('#f2c84b', 0.52);
    const ribbonMat = MaterialFactory.createClayMaterial('#d93829', 0.48);
    const starMat = MaterialFactory.createClayMaterial('#d47a18', 0.42);

    const bodyGeo = new THREE.SphereGeometry(0.24, 16, 14);
    bodyGeo.scale(1.05, 0.92, 1.0);
    const body = new THREE.Mesh(bodyGeo, sackMat);
    body.position.y = 0.18;
    body.castShadow = true;
    bagGroup.add(body);

    const tieGeo = new THREE.TorusGeometry(0.095, 0.028, 8, 16);
    tieGeo.rotateX(Math.PI / 2);
    const tie = new THREE.Mesh(tieGeo, ribbonMat);
    tie.position.y = 0.36;
    bagGroup.add(tie);

    const ruffleGeo = new THREE.ConeGeometry(0.14, 0.12, 10);
    ruffleGeo.rotateX(Math.PI);
    const ruffle = new THREE.Mesh(ruffleGeo, sackMat);
    ruffle.position.y = 0.41;
    bagGroup.add(ruffle);

    const starGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 5);
    starGeo.rotateX(Math.PI / 2);
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set(0, 0.18, 0.24);
    bagGroup.add(star);

    safeApplyWorldCurve(bagGroup);
    return bagGroup;
  }

  spawnDigHole(x, z, isInitial = false) {
    // If not initial setup, check if an existing dig hole is nearby -> fill it back in!
    if (!isInitial && this.digHoles && this.digHoles.length > 0) {
      for (let i = this.digHoles.length - 1; i >= 0; i--) {
        const existing = this.digHoles[i];
        if (!existing || !existing.visible) continue;
        const dist = Math.hypot(existing.position.x - x, existing.position.z - z);
        if (dist < 0.88) {
          this.dirtPathGroup.remove(existing);
          this.digHoles.splice(i, 1);
          return { action: 'filled', x: existing.position.x, z: existing.position.z };
        }
      }
    }

    const yBase = this.getTerrainHeightAt(x, z);
    const holeGroup = new THREE.Group();
    holeGroup.position.set(x, yBase + 0.015, z);
    holeGroup.name = 'DugSoilSpot';

    const darkHoleMat = MaterialFactory.createClayMaterial('#4b301b', 0.92);
    const clodMat = MaterialFactory.createClayMaterial('#9e7246', 0.86);
    const lightClodMat = MaterialFactory.createClayMaterial('#b88754', 0.84);

    const holeGeo = new THREE.CylinderGeometry(0.24, 0.2, 0.03, 14);
    const holeMesh = new THREE.Mesh(holeGeo, darkHoleMat);
    holeMesh.position.y = 0.005;
    holeGroup.add(holeMesh);

    const rand = createSeededRandom(Math.round((x * 100 + z * 37) * 13));
    const clodCount = 14;
    for (let i = 0; i < clodCount; i++) {
      const angle = (i / clodCount) * Math.PI * 2.0 + (rand() - 0.5) * 0.35;
      const dist = 0.14 + rand() * 0.24;
      const r = 0.055 + rand() * 0.055;
      const cGeo = new THREE.SphereGeometry(r, 8, 6);
      cGeo.scale(1.15, 0.72 + rand() * 0.5, 1.0);
      const cMesh = new THREE.Mesh(cGeo, i % 2 === 0 ? clodMat : lightClodMat);
      cMesh.position.set(
        Math.cos(angle) * dist,
        0.04 + (i % 3 === 0 ? rand() * 0.16 : 0.02),
        Math.sin(angle) * dist
      );
      cMesh.rotation.set(rand() * Math.PI, rand() * Math.PI, 0);
      cMesh.castShadow = true;
      cMesh.receiveShadow = true;
      holeGroup.add(cMesh);
    }

    safeApplyWorldCurve(holeGroup);
    this.dirtPathGroup.add(holeGroup);
    this.digHoles.push(holeGroup);

    if (isInitial) {
      return holeGroup;
    }

    // Pop out a 500-Bell Treasure Bag on every 2nd dig (or first dig!)
    this._digCounter = (this._digCounter || 0) + 1;
    let spawnedBellBag = false;
    if (this._digCounter % 2 === 1) {
      spawnedBellBag = true;
      const bagX = x + 0.58;
      const bagZ = z + 0.35;
      const bagGroundY = this.getTerrainHeightAt(bagX, bagZ);
      const bagMesh = this._createBellBagMesh();
      bagMesh.position.set(x, yBase + 0.45, z);
      this.vegetationGroup.add(bagMesh);

      const shadow = MaterialFactory.createContactShadowDisc(0.28, 0.28, 0.38);
      shadow.position.set(bagX, bagGroundY + 0.016, bagZ);
      this.vegetationGroup.add(shadow);

      const itemRecord = {
        type: 'bells',
        kind: 'bells',
        amount: 500,
        x: bagX,
        z: bagZ,
        y: bagGroundY + 0.04,
        mesh: bagMesh,
        shadow,
        pickedUp: false,
        ready: false,
        phase: Math.random() * Math.PI * 2,
      };
      this.collectableItems.push(itemRecord);

      this.fallingFruits.push({
        mesh: bagMesh,
        shadow,
        startX: x,
        startZ: z,
        targetX: bagX,
        targetZ: bagZ,
        startY: yBase + 0.55,
        groundY: bagGroundY + 0.04,
        elapsed: 0,
        duration: 0.58,
        done: false,
        itemRecord,
      });
    }

    return { action: 'dug', hole: holeGroup, x, z, spawnedBellBag };
  }

  /**
   * Builds a smooth, **indexed** 3-lobed scalloped leaf cluster geometry (`SphereGeometry(0.45, 22, 18)`)
   * so `computeVertexNormals()` produces silky-smooth curved normals with zero flat polygon facets!
   */
  _getScallopedLeafClusterGeometry() {
    if (this._sharedGeometries.leafCluster) {
      return this._sharedGeometries.leafCluster;
    }

    const geo = new THREE.SphereGeometry(0.45, 22, 18);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const nx = v.x / 0.45;
      const ny = v.y / 0.45;
      const nz = v.z / 0.45;

      // 3 smooth scalloped leaf lobes on the front/bottom face
      const angle = Math.atan2(nx, Math.max(0.001, -ny + 0.38));
      const lobeWave =
        Math.cos(angle * 3.0) * 0.12 * Math.max(0.0, nz + 0.35) * Math.max(0.0, 0.75 - ny);

      v.x *= 1.12 + lobeWave * 0.48;
      v.y *= 0.88 + Math.max(0, -ny) * 0.15;
      v.z *= 0.88 + lobeWave * 0.85;

      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    this._sharedGeometries.leafCluster = geo;
    return geo;
  }

  _createFruitMesh(fruitType = 'apple') {
    const group = new THREE.Group();
    group.name = `Fruit_${fruitType}`;

    const fruitMat = MaterialFactory.createGlossyFruitMaterial(fruitType);
    const stemMat = MaterialFactory.createWoodMaterial('dark_charred');

    const radius = fruitType === 'orange' ? 0.22 : 0.23;
    const bodyGeo = new THREE.SphereGeometry(radius, 20, 16);
    const bPos = bodyGeo.attributes.position;

    for (let i = 0; i < bPos.count; i++) {
      let x = bPos.getX(i);
      let y = bPos.getY(i);
      let z = bPos.getZ(i);
      const ny = y / radius;
      const radial = Math.hypot(x, z) / radius;

      if (fruitType === 'apple') {
        const shoulder = 1.0 + Math.sin(ny * Math.PI * 0.5) * 0.12;
        x *= shoulder;
        z *= shoulder;
        if (radial < 0.45) {
          const dimple = Math.cos((radial / 0.45) * Math.PI * 0.5);
          if (ny > 0.5) y -= dimple * 0.065;
          if (ny < -0.5) y += dimple * 0.04;
        }
      } else {
        x *= 1.04;
        z *= 1.04;
        y *= 0.96;
        if (radial < 0.35 && ny > 0.6) {
          y -= 0.025;
        }
      }
      bPos.setXYZ(i, x, y, z);
    }
    bodyGeo.computeVertexNormals();

    const bodyMesh = new THREE.Mesh(bodyGeo, fruitMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    const stemGeo = new THREE.CylinderGeometry(0.018, 0.026, 0.11, 8);
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.position.set(0.0, radius * 0.88, 0.0);
    stemMesh.rotation.z = -0.22;
    group.add(stemMesh);

    if (fruitType === 'orange') {
      const calyxMat = MaterialFactory.createFoliageMaterial('bottom', { swayAmount: 0 });
      const calyxGeo = new THREE.CylinderGeometry(0.055, 0.02, 0.02, 6);
      const calyx = new THREE.Mesh(calyxGeo, calyxMat);
      calyx.position.set(0, radius * 0.86, 0);
      group.add(calyx);
    }

    return group;
  }

  /**
   * Builds an iconic Argon Valley Hardwood or Fruit Tree (`'apple'`, `'orange'`, or `'hardwood'`)
   * with a seamless 5-root flared trunk and 35 smooth-shaded scalloped leaf clusters.
   */
  _createHardwoodTree(x, z, fruitType = 'apple', scale = 1.0, presets = null) {
    const yBase = this.getTerrainHeightAt(x, z);
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, yBase, z);
    treeGroup.scale.setScalar(scale);
    treeGroup.name = `Argon ValleyTree_${fruitType}`;

    const barkMat = MaterialFactory.createWoodMaterial('bark');
    const topFoliageMat = MaterialFactory.createFoliageMaterial('top');
    const midFoliageMat = MaterialFactory.createFoliageMaterial('mid');
    const botFoliageMat = MaterialFactory.createFoliageMaterial('bottom');

    // 1. Contact Shadow Disc on ground
    const shadowDisc = MaterialFactory.createContactShadowDisc(1.55, 1.45, 0.46);
    treeGroup.add(shadowDisc);

    // 2. Seamless Sculpted Trunk with 5 Rounded Root Flares (no rotated TubeGeometry UV seams!)
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.44, 1.68, 32, 18);
    const tPos = trunkGeo.attributes.position;

    for (let i = 0; i < tPos.count; i++) {
      let vx = tPos.getX(i);
      let vy = tPos.getY(i) + 0.84; // 0.0 at base to 1.68 at top
      let vz = tPos.getZ(i);

      const angle = Math.atan2(vz, vx);
      // 5 prominent rounded root buttresses flaring out smoothly at the base (vy < 0.72)
      const rootHeightFactor = Math.pow(THREE.MathUtils.clamp(1.0 - vy / 0.72, 0.0, 1.0), 1.65);
      const fiveLobedWave = Math.pow(0.5 + 0.5 * Math.cos(angle * 5.0 - 0.25), 1.45);
      const flare = 1.0 + rootHeightFactor * fiveLobedWave * 0.96;

      // Slight organic taper in mid-trunk
      const waist = 1.0 - Math.sin((vy / 1.68) * Math.PI) * 0.09;
      vx *= flare * waist;
      vz *= flare * waist;

      tPos.setXYZ(i, vx, vy, vz);
    }
    trunkGeo.computeVertexNormals();
    const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    // 3. Three-Tier Smooth Scalloped Leaf Cluster Crown
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 1.55, 0);
    crownGroup.name = 'FoliageCrown';

    const clusterGeo = this._getScallopedLeafClusterGeometry();

    const botCore = new THREE.Mesh(new THREE.SphereGeometry(0.96, 20, 16), botFoliageMat);
    botCore.position.set(0, 0.18, 0);
    botCore.scale.set(1.12, 0.72, 1.08);
    botCore.castShadow = true;
    botCore.receiveShadow = true;
    crownGroup.add(botCore);

    const midCore = new THREE.Mesh(new THREE.SphereGeometry(0.84, 20, 16), midFoliageMat);
    midCore.position.set(0, 0.68, 0);
    midCore.scale.set(1.06, 0.75, 1.04);
    midCore.castShadow = true;
    midCore.receiveShadow = true;
    crownGroup.add(midCore);

    const topCore = new THREE.Mesh(new THREE.SphereGeometry(0.64, 20, 16), topFoliageMat);
    topCore.position.set(0, 1.16, 0);
    topCore.scale.set(1.0, 0.82, 1.0);
    topCore.castShadow = true;
    topCore.receiveShadow = true;
    crownGroup.add(topCore);

    const addLeafTierRing = (count, ringRadius, yOffset, scaleMul, mat, phaseOffset = 0) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2.0 + phaseOffset;
        const px = Math.cos(a) * ringRadius;
        const pz = Math.sin(a) * ringRadius * 0.96;
        const py = yOffset + (i % 2 === 0 ? 0.035 : -0.035);

        const puff = new THREE.Mesh(clusterGeo, mat);
        puff.position.set(px, py, pz);
        puff.scale.set(scaleMul * 1.08, scaleMul * 0.96, scaleMul * 0.95);
        puff.lookAt(px * 2.5, py - 0.25, pz * 2.5);
        puff.castShadow = true;
        puff.receiveShadow = true;
        crownGroup.add(puff);
      }
    };

    addLeafTierRing(13, 0.98, 0.12, 1.06, botFoliageMat, 0.0);
    addLeafTierRing(11, 0.82, 0.62, 0.98, midFoliageMat, 0.28);
    addLeafTierRing(8, 0.56, 1.08, 0.88, topFoliageMat, 0.14);

    for (let k = 0; k < 3; k++) {
      const ka = (k * Math.PI * 2.0) / 3.0 + 0.4;
      const apexPuff = new THREE.Mesh(clusterGeo, topFoliageMat);
      apexPuff.position.set(Math.cos(ka) * 0.22, 1.38, Math.sin(ka) * 0.22);
      apexPuff.scale.set(0.86, 0.78, 0.86);
      apexPuff.rotation.x = -Math.PI * 0.28;
      apexPuff.rotation.y = ka;
      apexPuff.castShadow = true;
      apexPuff.receiveShadow = true;
      crownGroup.add(apexPuff);
    }

    // 4. Hang 3 Plump Glossy 3D Fruits on the Lower-Front of Fruit Trees (`'apple'` or `'orange'`)
    const fruitMeshes = [];
    if (fruitType === 'apple' || fruitType === 'orange') {
      const fruitOffsets = [
        new THREE.Vector3(-0.56, 0.14, 1.12),
        new THREE.Vector3(0.58, 0.12, 1.10),
        new THREE.Vector3(0.02, 0.56, 0.98),
      ];
      for (const offset of fruitOffsets) {
        const fruit = this._createFruitMesh(fruitType);
        fruit.position.copy(offset);
        fruit.userData.homeOffset = offset.clone();
        crownGroup.add(fruit);
        fruitMeshes.push(fruit);
      }
    }

    treeGroup.add(crownGroup);
    this.vegetationGroup.add(treeGroup);

    if (
      this.gridSystem &&
      typeof this.gridSystem.registerCollider === 'function' &&
      (!presets || presets.includes('free_roam'))
    ) {
      try {
        this.gridSystem.registerCollider(x, z, 0.55, { type: 'tree', fruitType });
      } catch (e) {
        // ignore
      }
    }

    const treeRecord = {
      type: fruitType,
      x,
      z,
      y: yBase,
      mesh: treeGroup,
      crown: crownGroup,
      fruits: fruitMeshes,
      shakeTimer: 0,
      fruitsDropped: false,
      presets,
    };
    this.trees.push(treeRecord);
    return treeRecord;
  }

  /**
   * Builds a Coconut Palm Tree (`ref_01` & `ref_05`) with a continuous curved
   * segmented trunk and 7 continuous arched feather-pinnae palm fronds over 2 green coconuts.
   */
  _createCoconutPalmTree(x, z, leanDirX = 0.28, scale = 1.0, presets = null) {
    const yBase = this.getTerrainHeightAt(x, z);
    const palmGroup = new THREE.Group();
    palmGroup.position.set(x, yBase, z);
    palmGroup.scale.setScalar(scale);
    palmGroup.name = 'CoconutPalmTree';

    const palmBarkMat = MaterialFactory.createWoodMaterial('palm_bark');
    const frondMat = MaterialFactory.createPalmFrondMaterial();
    const coconutMat = MaterialFactory.createGlossyFruitMaterial('coconut');

    palmGroup.add(MaterialFactory.createContactShadowDisc(1.35, 1.25, 0.36));

    // 1. Continuous Curved Segmented Trunk
    const totalHeight = 2.35;
    const trunkGeo = new THREE.CylinderGeometry(0.17, 0.32, totalHeight, 24, 28);
    const tPos = trunkGeo.attributes.position;

    for (let i = 0; i < tPos.count; i++) {
      let vx = tPos.getX(i);
      let vy = tPos.getY(i) + totalHeight * 0.5;
      let vz = tPos.getZ(i);

      const t = THREE.MathUtils.clamp(vy / totalHeight, 0.0, 1.0);
      // Segmented ring ridge relief
      const ringBulge = 1.0 + Math.sin(t * Math.PI * 22.0) * 0.032;
      vx *= ringBulge;
      vz *= ringBulge;

      // Smooth graceful lean curve
      vx += Math.pow(t, 1.45) * leanDirX;
      vz += Math.sin(t * Math.PI) * 0.08;

      tPos.setXYZ(i, vx, vy, vz);
    }
    trunkGeo.computeVertexNormals();

    const trunkMesh = new THREE.Mesh(trunkGeo, palmBarkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    palmGroup.add(trunkMesh);

    const topPoint = new THREE.Vector3(leanDirX, totalHeight, 0.02);

    // 2. Crown Group (2 green coconuts + 7 continuous arching palm frond blades)
    const crownGroup = new THREE.Group();
    crownGroup.position.copy(topPoint);
    crownGroup.name = 'PalmCrown';

    const fruitMeshes = [];
    for (const side of [-1, 1]) {
      const cocoGeo = new THREE.SphereGeometry(0.24, 16, 14);
      cocoGeo.scale(0.92, 1.12, 0.92);
      const coco = new THREE.Mesh(cocoGeo, coconutMat);
      coco.position.set(side * 0.22, -0.18, 0.24);
      coco.rotation.z = side * 0.25;
      coco.castShadow = true;
      crownGroup.add(coco);
      fruitMeshes.push(coco);
    }

    // Shared curved palm frond blade geometry (continuous arched V-folded leaf blade!)
    if (!this._sharedGeometries.palmFrondBlade) {
      const fWidth = 0.94;
      const fLen = 1.68;
      const fGeo = new THREE.PlaneGeometry(fWidth, fLen, 16, 24);
      const fPos = fGeo.attributes.position;

      for (let i = 0; i < fPos.count; i++) {
        const lx = fPos.getX(i); // in [-fWidth/2, fWidth/2]
        const ly = fPos.getY(i); // in [-fLen/2, fLen/2]
        const st = (ly + fLen * 0.5) / fLen; // 0 at crown base, 1 at frond tip
        const nx = lx / (fWidth * 0.5);

        // Graceful parabolic arch outward (Z) and drooping downward (Y)
        const distZ = 0.12 + st * 1.48;
        const archY = Math.sin(st * Math.PI * 0.72) * 0.34 - Math.pow(st, 1.85) * 0.78;
        // V-fold along central midrib + drooping pinnae tips
        const vFoldY = -Math.abs(nx) * 0.14 * Math.sin(st * Math.PI);

        fPos.setXYZ(i, lx, archY + vFoldY, distZ);
      }
      fGeo.computeVertexNormals();
      this._sharedGeometries.palmFrondBlade = fGeo;
    }

    const numFronds = 7;
    for (let f = 0; f < numFronds; f++) {
      const fAngle = (f / numFronds) * Math.PI * 2.0 + 0.35;
      const frondMesh = new THREE.Mesh(this._sharedGeometries.palmFrondBlade, frondMat);
      frondMesh.rotation.y = fAngle;
      frondMesh.castShadow = true;
      frondMesh.receiveShadow = true;
      crownGroup.add(frondMesh);
    }

    palmGroup.add(crownGroup);
    this.vegetationGroup.add(palmGroup);

    if (this.gridSystem && typeof this.gridSystem.registerCollider === 'function') {
      try {
        this.gridSystem.registerCollider(x, z, 0.45, { type: 'palm_tree', fruitType: 'coconut' });
      } catch (e) {
        // ignore
      }
    }

    const treeRecord = {
      type: 'coconut',
      x,
      z,
      y: yBase,
      mesh: palmGroup,
      crown: crownGroup,
      fruits: fruitMeshes,
      shakeTimer: 0,
      fruitsDropped: false,
      presets,
    };
    this.trees.push(treeRecord);
    return treeRecord;
  }

  /**
   * Places all Hardwood, Apple, Orange, and Coconut Palm Trees with scene-preset
   * tags so each of the 6 reference views (`ref_01`..`ref_06`) is framed cleanly.
   */
  _buildTrees() {
    // --- ref_01_beach_sunset.png ---
    this._createHardwoodTree(-4.8, 14.8, 'apple', 0.98, ['beach_sunset', 'free_roam', 'follow_player']);
    this._createHardwoodTree(-3.4, 10.8, 'hardwood', 0.85, ['beach_sunset']);
    // Single iconic palm tree in ref_01 left-midground (scaled to 0.78 so fronds frame the left horizon!)
    this._createCoconutPalmTree(-1.35, 16.6, 0.26, 0.78, ['beach_sunset', 'free_roam', 'follow_player']);

    // --- ref_02_house_yard.png ---
    this._createHardwoodTree(-7.5, -6.6, 'hardwood', 0.95, ['house_yard', 'free_roam', 'follow_player']);
    this._createHardwoodTree(2.8, -6.8, 'apple', 0.98, ['house_yard', 'free_roam', 'follow_player']);
    this._createHardwoodTree(-0.3, -11.8, 'hardwood', 0.95, ['house_yard', 'free_roam', 'follow_player']);
    this._createHardwoodTree(2.1, -12.4, 'apple', 0.9, ['house_yard', 'free_roam', 'follow_player']);

    // --- ref_03_flower_garden_river.jpg ---
    // North-bank Apple Orchard row + 2 right-edge framing apple trees
    this._createHardwoodTree(-8.2, -7.8, 'apple', 0.95, ['flower_river', 'free_roam', 'follow_player']);
    this._createHardwoodTree(-5.0, -8.0, 'apple', 0.96, ['flower_river']);
    this._createHardwoodTree(-1.8, -7.8, 'apple', 0.96, ['flower_river']);
    this._createHardwoodTree(1.2, -8.0, 'apple', 0.95, ['flower_river']);
    this._createHardwoodTree(4.0, -7.8, 'apple', 0.94, ['flower_river']);
    this._createHardwoodTree(3.1, -1.5, 'apple', 0.98, ['flower_river', 'free_roam', 'follow_player']);
    this._createHardwoodTree(2.8, 0.85, 'apple', 0.96, ['flower_river']);

    // --- ref_04_yellow_tent_horizon.jpg ---
    this._createHardwoodTree(6.4, -6.0, 'hardwood', 0.96, ['tent_horizon', 'free_roam', 'follow_player']);
    this._createHardwoodTree(7.3, -3.6, 'hardwood', 0.82, ['tent_horizon']);
    this._createHardwoodTree(12.2, -5.8, 'hardwood', 0.96, ['tent_horizon', 'free_roam', 'follow_player']);
    this._createHardwoodTree(15.2, -6.8, 'hardwood', 0.92, ['tent_horizon', 'free_roam', 'follow_player']);
    this._createHardwoodTree(6.5, -13.2, 'hardwood', 0.9, ['tent_horizon']);
    this._createHardwoodTree(8.8, -13.5, 'hardwood', 0.92, ['tent_horizon', 'free_roam', 'follow_player']);
    this._createHardwoodTree(11.4, -13.5, 'hardwood', 0.9, ['tent_horizon', 'free_roam', 'follow_player']);
    this._createHardwoodTree(14.2, -13.2, 'hardwood', 0.92, ['tent_horizon', 'free_roam', 'follow_player']);

    // --- ref_05_beach_bridge_villagers.png ---
    this._createCoconutPalmTree(1.4, 18.2, -0.22, 0.92, ['bridge_plaza', 'free_roam', 'follow_player']);
    this._createCoconutPalmTree(3.6, 15.0, 0.2, 0.88, ['bridge_plaza', 'free_roam', 'follow_player']);
    this._createCoconutPalmTree(7.2, 15.0, -0.18, 0.88, ['bridge_plaza', 'free_roam', 'follow_player']);
    this._createHardwoodTree(1.5, 10.5, 'hardwood', 0.9, ['bridge_plaza']);
    this._createHardwoodTree(7.4, 10.5, 'hardwood', 0.9, ['bridge_plaza']);
    this._createHardwoodTree(12.2, 10.8, 'hardwood', 0.9, ['bridge_plaza']);

    // --- ref_06_cliff_waterfall.png ---
    this._createHardwoodTree(-5.6, -8.6, 'orange', 1.0, ['cliff_waterfall']);
    this._createHardwoodTree(-9.4, -8.6, 'orange', 1.0, ['free_roam', 'follow_player']);
    this._createHardwoodTree(-7.2, -15.6, 'hardwood', 0.92, ['cliff_waterfall', 'free_roam', 'follow_player']);
    this._createHardwoodTree(-2.8, -15.8, 'hardwood', 0.92, ['cliff_waterfall', 'free_roam', 'follow_player']);
  }

  shakeNearestTree(x = 0, z = 0, maxDist = 2.75) {
    if (!this.trees.length) return null;
    let nearest = null;
    let bestDist = Infinity;

    for (const tree of this.trees) {
      if (!tree.mesh.visible) continue;
      const d = Math.hypot(tree.x - x, tree.z - z);
      if (d < bestDist) {
        bestDist = d;
        nearest = tree;
      }
    }

    if (!nearest || bestDist > maxDist) return null;
    nearest.shakeTimer = 0.72;

    // If tree hasn't dropped its loot recently, drop 3 bouncy collectables (fruit or Coin pouches + apple)!
    if (!nearest.fruitsDropped) {
      nearest.fruitsDropped = true;
      nearest.regrowTimer = 18.0; // Regrows after 18s!

      const isFruitTree = nearest.fruits && nearest.fruits.length > 0;
      const fruitKind =
        nearest.type === 'orange'
          ? 'orange'
          : nearest.type === 'coconut'
          ? 'coconut'
          : 'apple';

      if (isFruitTree) {
        for (const f of nearest.fruits) {
          f.visible = false;
        }
      }

      const dropOffsets = [
        { dx: -0.78, dz: 0.72 },
        { dx: 0.04, dz: 1.05 },
        { dx: 0.82, dz: 0.68 },
      ];

      dropOffsets.forEach((off, idx) => {
        const targetX = nearest.x + off.dx;
        const targetZ = nearest.z + off.dz;
        const groundY = this.getTerrainHeightAt(targetX, targetZ);

        // Hardwood trees drop 1 Red Apple + 2 Coin Pouches; Fruit/Palm trees drop 3 fruits!
        const dropAsBellBag = !isFruitTree && idx > 0;
        const droppedMesh = dropAsBellBag
          ? this._createBellBagMesh()
          : this._createFruitMesh(fruitKind);
        const startY = nearest.y + 1.85;
        droppedMesh.position.set(nearest.x + off.dx * 0.45, startY, nearest.z + off.dz * 0.45);
        safeApplyWorldCurve(droppedMesh);
        this.vegetationGroup.add(droppedMesh);

        const shadow = MaterialFactory.createContactShadowDisc(0.24, 0.24, 0.38);
        shadow.position.set(targetX, groundY + 0.016, targetZ);
        this.vegetationGroup.add(shadow);

        const itemRecord = dropAsBellBag
          ? {
              type: 'bells',
              kind: 'bells',
              amount: 200,
              x: targetX,
              z: targetZ,
              y: groundY + 0.04,
              mesh: droppedMesh,
              shadow,
              pickedUp: false,
              ready: false,
              phase: idx * 1.4,
            }
          : {
              type: 'fruit',
              kind: fruitKind,
              x: targetX,
              z: targetZ,
              y: groundY + 0.2,
              mesh: droppedMesh,
              shadow,
              pickedUp: false,
              ready: false,
              phase: idx * 1.4,
            };
        this.collectableItems.push(itemRecord);

        this.fallingFruits.push({
          mesh: droppedMesh,
          shadow,
          startX: droppedMesh.position.x,
          startZ: droppedMesh.position.z,
          targetX,
          targetZ,
          startY,
          groundY: dropAsBellBag ? groundY + 0.04 : groundY + 0.2,
          elapsed: -idx * 0.08,
          duration: 0.68,
          done: false,
          itemRecord,
        });
      });

      return {
        tree: nearest,
        droppedFruit: true,
        isHardwoodLoot: !isFruitTree,
        fruitKind,
        count: 3,
      };
    }

    return { tree: nearest, droppedFruit: false, fruitKind: nearest.type, count: 0 };
  }

  /**
   * Waters all visible flowers within `radius` of `(x, z)`, making buds bloom,
   * triggering a juicy spring scale bounce, and returning the watered flowers.
   */
  waterFlowersNear(x, z, radius = 2.5) {
    const wateredList = [];
    for (const fl of this.flowers) {
      if (!fl.mesh || !fl.mesh.visible) continue;
      const dist = Math.hypot(fl.x - x, fl.z - z);
      if (dist <= radius) {
        fl.watered = true;
        fl.bounceTimer = 0.65;
        if (fl.headGroup) {
          fl.mode = 'bloom';
          fl.headGroup.scale.setScalar(1.16);
          for (const child of fl.headGroup.children) {
            if (child.rotation && child.geometry === this._sharedGeometries.tulipPetalGeo) {
              child.rotation.x = -0.06;
            }
          }
        }
        wateredList.push(fl);
      }
    }
    return wateredList;
  }

  /**
   * Collects any dropped fruit or Coin pouches within `radius` of `(x, z)`.
   */
  collectNearbyItems(x, z, radius = 1.45) {
    const collected = [];
    if (!this.collectableItems || !this.collectableItems.length) return collected;

    for (let i = this.collectableItems.length - 1; i >= 0; i--) {
      const item = this.collectableItems[i];
      if (!item || item.pickedUp || !item.ready) continue;
      const dist = Math.hypot(item.x - x, item.z - z);
      if (dist <= radius) {
        item.pickedUp = true;
        if (item.mesh && item.mesh.parent) {
          item.mesh.parent.remove(item.mesh);
        }
        if (item.shadow && item.shadow.parent) {
          item.shadow.parent.remove(item.shadow);
        }
        collected.push(item);
        this.collectableItems.splice(i, 1);
      }
    }
    return collected;
  }

  _createTulipPlant(x, z, colorName = 'red', mode = 'bloom', presets = null) {
    const yBase = this.getTerrainHeightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, yBase, z);
    group.name = `Tulip_${colorName}`;

    const colorMap = {
      red: '#e62418',
      yellow: '#f6c814',
      pink: '#f26298',
      white: '#fcfaf2',
    };
    const hex = colorMap[colorName] || colorName;

    if (!this._sharedGeometries.tulipMaterials) {
      this._sharedGeometries.tulipMaterials = {};
    }
    const matKey = `${colorName}_${mode}`;
    if (!this._sharedGeometries.tulipMaterials[matKey]) {
      this._sharedGeometries.tulipMaterials[matKey] = MaterialFactory.createClayMaterial(
        hex,
        0.44,
        {
          curveOptions: { swayAmount: 0.02, swaySpeed: 1.8 },
          materialProps: {
            sheen: 0.35,
            sheenColor: new THREE.Color('#ffffff'),
            clearcoat: 0.16,
          },
        }
      );
    }
    const petalMat = this._sharedGeometries.tulipMaterials[matKey];

    if (!this._sharedGeometries.flowerStemMat) {
      this._sharedGeometries.flowerStemMat = MaterialFactory.createFoliageMaterial('stem', {
        swayAmount: 0.018,
        swaySpeed: 1.8,
      });
    }
    const stemMat = this._sharedGeometries.flowerStemMat;

    group.add(MaterialFactory.createContactShadowDisc(0.28, 0.26, 0.38));

    if (!this._sharedGeometries.tulipLeafGeo) {
      const lGeo = new THREE.ConeGeometry(0.11, 0.42, 8, 4);
      lGeo.scale(1.15, 1.0, 0.36);
      lGeo.translate(0, 0.18, 0);
      this._sharedGeometries.tulipLeafGeo = lGeo;
    }

    for (let l = 0; l < 4; l++) {
      const a = l * Math.PI * 0.5 + 0.35;
      const leaf = new THREE.Mesh(this._sharedGeometries.tulipLeafGeo, stemMat);
      leaf.rotation.y = a;
      leaf.rotation.x = 0.52;
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      group.add(leaf);
    }

    if (!this._sharedGeometries.tulipStemGeo) {
      this._sharedGeometries.tulipStemGeo = new THREE.CylinderGeometry(0.032, 0.038, 0.36, 8);
    }
    const stem = new THREE.Mesh(this._sharedGeometries.tulipStemGeo, stemMat);
    stem.position.y = 0.18;
    group.add(stem);

    const headGroup = new THREE.Group();
    headGroup.position.y = 0.36;

    if (!this._sharedGeometries.tulipPetalGeo) {
      const pGeo = new THREE.SphereGeometry(0.115, 12, 10);
      pGeo.scale(0.82, 1.48, 0.45);
      pGeo.translate(0, 0.09, 0);
      this._sharedGeometries.tulipPetalGeo = pGeo;
    }

    const scaleFactor = mode === 'bud' ? 0.78 : 1.08;
    headGroup.scale.setScalar(scaleFactor);

    for (let p = 0; p < 6; p++) {
      const pa = (p / 6) * Math.PI * 2.0;
      const isInner = p % 2 === 1;
      const rOff = isInner ? 0.068 : 0.082;
      const petal = new THREE.Mesh(this._sharedGeometries.tulipPetalGeo, petalMat);
      petal.position.set(Math.cos(pa) * rOff, isInner ? 0.01 : 0.0, Math.sin(pa) * rOff);
      petal.rotation.y = -pa + Math.PI * 0.5;
      petal.rotation.x = mode === 'bud' ? -0.22 : -0.08;
      petal.castShadow = true;
      petal.receiveShadow = true;
      headGroup.add(petal);
    }

    if (!this._sharedGeometries.stamenMat) {
      this._sharedGeometries.stamenMat = MaterialFactory.createClayMaterial('#f8b61e', 0.5);
    }
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 8),
      this._sharedGeometries.stamenMat
    );
    center.position.y = 0.07;
    headGroup.add(center);

    group.add(headGroup);
    this.vegetationGroup.add(group);
    this.flowers.push({
      type: 'tulip',
      color: colorName,
      mode,
      x,
      z,
      mesh: group,
      headGroup,
      watered: false,
      bounceTimer: 0,
      presets,
    });
    return group;
  }

  _createCosmosPlant(x, z, colorName = 'white', presets = null) {
    const yBase = this.getTerrainHeightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, yBase, z);
    group.name = `Cosmos_${colorName}`;

    const colorMap = {
      white: '#fcfaf5',
      yellow: '#f6ce18',
      red: '#e4281e',
    };
    const hex = colorMap[colorName] || colorName;

    if (!this._sharedGeometries.cosmosMaterials) {
      this._sharedGeometries.cosmosMaterials = {};
    }
    if (!this._sharedGeometries.cosmosMaterials[colorName]) {
      this._sharedGeometries.cosmosMaterials[colorName] = MaterialFactory.createClayMaterial(
        hex,
        0.48,
        { curveOptions: { swayAmount: 0.022, swaySpeed: 1.9 } }
      );
    }
    const petalMat = this._sharedGeometries.cosmosMaterials[colorName];
    const stemMat =
      this._sharedGeometries.flowerStemMat ||
      MaterialFactory.createFoliageMaterial('stem', { swayAmount: 0.02, swaySpeed: 1.9 });
    const centerMat =
      this._sharedGeometries.stamenMat || MaterialFactory.createClayMaterial('#f59c1a', 0.48);

    group.add(MaterialFactory.createContactShadowDisc(0.32, 0.3, 0.36));

    if (!this._sharedGeometries.cosmosPetalGeo) {
      const cpGeo = new THREE.SphereGeometry(0.075, 10, 8);
      cpGeo.scale(0.58, 0.22, 1.55);
      cpGeo.translate(0, 0, 0.11);
      this._sharedGeometries.cosmosPetalGeo = cpGeo;
    }

    for (let l = 0; l < 6; l++) {
      const la = (l / 6) * Math.PI * 2.0;
      const leaf = new THREE.Mesh(this._sharedGeometries.tulipLeafGeo, stemMat);
      leaf.scale.set(0.65, 0.78, 0.65);
      leaf.rotation.y = la;
      leaf.rotation.x = 0.68;
      group.add(leaf);
    }

    const bloomOffsets = [
      { ox: -0.08, oy: 0.48, oz: 0.04, s: 1.05, tiltX: 0.42 },
      { ox: 0.14, oy: 0.38, oz: 0.1, s: 0.88, tiltX: 0.52 },
    ];

    for (const b of bloomOffsets) {
      const stem = new THREE.Mesh(this._sharedGeometries.tulipStemGeo, stemMat);
      stem.position.set(b.ox * 0.6, b.oy * 0.5, b.oz * 0.6);
      stem.scale.set(0.75, b.oy / 0.36, 0.75);
      group.add(stem);

      const head = new THREE.Group();
      head.position.set(b.ox, b.oy, b.oz);
      head.rotation.x = b.tiltX;
      head.scale.setScalar(b.s);

      for (let p = 0; p < 8; p++) {
        const pa = (p / 8) * Math.PI * 2.0;
        const petal = new THREE.Mesh(this._sharedGeometries.cosmosPetalGeo, petalMat);
        petal.rotation.y = pa;
        petal.castShadow = true;
        head.add(petal);
      }

      const button = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), centerMat);
      button.scale.set(1.0, 0.55, 1.0);
      button.position.y = 0.02;
      head.add(button);

      group.add(head);
    }

    this.vegetationGroup.add(group);
    this.flowers.push({
      type: 'cosmos',
      color: colorName,
      mode: 'bloom',
      x,
      z,
      mesh: group,
      watered: false,
      bounceTimer: 0,
      presets,
    });
    return group;
  }

  _createWildGrassTuft(x, z, scale = 1.0, withYellowBuds = false, presets = null) {
    const yBase = this.getTerrainHeightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, yBase, z);
    group.scale.setScalar(scale);

    const bladeMat =
      this._sharedGeometries.flowerStemMat ||
      MaterialFactory.createFoliageMaterial('mid', { swayAmount: 0.03, swaySpeed: 2.0 });

    if (!this._sharedGeometries.grassBladeGeo) {
      const bGeo = new THREE.ConeGeometry(0.055, 0.38, 6);
      bGeo.scale(1.0, 1.0, 0.35);
      bGeo.translate(0, 0.18, 0);
      this._sharedGeometries.grassBladeGeo = bGeo;
    }

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2.0 + i * 0.3;
      const blade = new THREE.Mesh(this._sharedGeometries.grassBladeGeo, bladeMat);
      blade.rotation.y = a;
      blade.rotation.x = 0.22 + (i % 3) * 0.14;
      blade.scale.y = 0.75 + (i % 2) * 0.35;
      blade.castShadow = true;
      group.add(blade);
    }

    if (withYellowBuds) {
      const budMat =
        this._sharedGeometries.stamenMat || MaterialFactory.createClayMaterial('#f8d21c', 0.45);
      for (let k = 0; k < 2; k++) {
        const bud = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), budMat);
        bud.position.set((k - 0.5) * 0.14, 0.38, 0.04);
        group.add(bud);
      }
    }

    this.vegetationGroup.add(group);
    this.grassTufts.push({ mesh: group, x, z, presets });
    return group;
  }

  _buildFlowersAndTufts() {
    const riverPresets = ['flower_river', 'free_roam', 'follow_player'];
    const yardPresets = ['house_yard', 'free_roam', 'follow_player'];

    // --- A. ref_03 Foreground Tulip Garden Grid (x in [-4.8, -1.5], z in [-0.2, 1.3]) ---
    const fgRows = [
      { z: -0.2, colors: ['red', 'red', 'yellow', 'yellow', 'red', 'red'], xs: [-4.7, -4.05, -3.4, -2.75, -2.1, -1.5] },
      { z: 0.28, colors: ['red', 'yellow', 'red'], xs: [-4.35, -3.1, -1.8] },
      { z: 0.78, colors: ['yellow', 'yellow', 'red', 'red', 'yellow', 'yellow'], xs: [-4.75, -4.1, -3.45, -2.75, -2.1, -1.45] },
      { z: 1.28, colors: ['yellow', 'red', 'yellow'], xs: [-4.4, -3.1, -1.75] },
    ];
    for (const row of fgRows) {
      row.xs.forEach((tx, idx) => {
        this._createTulipPlant(tx, row.z, row.colors[idx], 'bloom', riverPresets);
      });
    }

    // --- B. ref_03 Riverbank Pink & White Tulip Bed (x in [-5.5, -1.8], z in [-2.4, -1.4]) ---
    const bankRows = [
      { z: -2.35, colors: ['pink', 'pink', 'white', 'white', 'pink', 'pink'], xs: [-5.4, -4.7, -4.0, -3.3, -2.6, -1.9] },
      { z: -1.9, colors: ['white', 'pink', 'white', 'pink', 'pink', 'white'], xs: [-5.1, -4.4, -3.7, -3.0, -2.35, -1.75] },
      { z: -1.45, colors: ['pink', 'white', 'pink'], xs: [-4.75, -3.65, -2.55] },
    ];
    for (const row of bankRows) {
      row.xs.forEach((tx, idx) => {
        this._createTulipPlant(tx, row.z, row.colors[idx], 'bloom', riverPresets);
      });
    }

    // --- C. ref_03 Cosmos Daisy Patch (x in [-7.2, -5.2], z in [-0.5, 1.2]) ---
    const cosmosSpots = [
      { x: -7.1, z: -0.45, c: 'white' },
      { x: -6.35, z: -0.4, c: 'white' },
      { x: -5.55, z: -0.35, c: 'yellow' },
      { x: -7.2, z: 0.15, c: 'red' },
      { x: -6.5, z: 0.2, c: 'white' },
      { x: -5.75, z: 0.25, c: 'yellow' },
      { x: -5.2, z: 0.35, c: 'yellow' },
      { x: -7.05, z: 0.75, c: 'red' },
      { x: -6.25, z: 0.82, c: 'white' },
      { x: -5.45, z: 0.88, c: 'white' },
    ];
    for (const spot of cosmosSpots) {
      this._createCosmosPlant(spot.x, spot.z, spot.c, riverPresets);
    }

    // --- D. ref_02 Cottage Yard Tulip Beds ---
    const barnabyTulips = [
      { x: 0.25, z: -8.0, c: 'yellow' },
      { x: 0.85, z: -8.1, c: 'red' },
      { x: 1.45, z: -8.0, c: 'red' },
      { x: 1.82, z: -7.6, c: 'red' },
      { x: 0.55, z: -7.45, c: 'yellow' },
      { x: 1.15, z: -7.35, c: 'yellow' },
      { x: 0.95, z: -6.85, c: 'yellow' },
    ];
    for (const t of barnabyTulips) {
      this._createTulipPlant(t.x, t.z, t.c, 'bud', yardPresets);
    }

    const leftTreeTulips = [
      { x: -7.9, z: -7.8, c: 'red' },
      { x: -6.15, z: -7.85, c: 'yellow' },
      { x: -5.85, z: -7.35, c: 'yellow' },
      { x: -8.1, z: -6.65, c: 'red' },
      { x: -7.55, z: -6.25, c: 'red' },
      { x: -6.95, z: -6.15, c: 'red' },
      { x: -6.05, z: -6.65, c: 'red' },
      { x: -5.85, z: -6.15, c: 'red' },
    ];
    for (const t of leftTreeTulips) {
      this._createTulipPlant(t.x, t.z, t.c, 'bud', yardPresets);
    }

    // --- E. Wild Grass Tufts ---
    const beachTufts = [
      [-5.8, 15.0, 1.15, true],
      [-5.1, 15.3, 1.25, true],
      [-4.4, 15.1, 1.1, true],
      [-3.6, 14.9, 1.0, false],
      [-2.9, 14.7, 0.95, false],
    ];
    for (const [gx, gz, gs, buds] of beachTufts) {
      this._createWildGrassTuft(gx, gz, gs, buds, ['beach_sunset', 'free_roam', 'follow_player']);
    }

    const riverBankTufts = [
      [-8.8, -6.9, 1.15, false],
      [-7.2, -7.1, 1.1, false],
      [-5.6, -7.0, 1.2, false],
      [-4.2, -7.1, 1.15, false],
      [-2.4, -7.0, 1.05, false],
      [-0.6, -7.1, 1.1, false],
      [2.6, -7.0, 1.1, false],
    ];
    for (const [gx, gz, gs, buds] of riverBankTufts) {
      this._createWildGrassTuft(gx, gz, gs, buds, ['flower_river', 'free_roam', 'follow_player']);
    }

    const tentTufts = [
      [7.4, -8.2, 0.95, false],
      [8.8, -8.1, 0.9, false],
    ];
    for (const [gx, gz, gs, buds] of tentTufts) {
      this._createWildGrassTuft(gx, gz, gs, buds, ['tent_horizon', 'free_roam', 'follow_player']);
    }
  }

  /**
   * 5. Watertight Faceted Dark Coastal Boulders (`#56525c`):
   * Uses a continuous deterministic function of rounded `(vx, vy, vz)` coordinates
   * so shared vertices of `DodecahedronGeometry` NEVER tear apart into cracks!
   */
  _buildCoastalBoulders() {
    const slateMat = MaterialFactory.createStoneMaterial('slate', { flatShading: true });
    const darkWetSlateMat = MaterialFactory.createStoneMaterial('#46424a', { flatShading: true });

    const createChiseledBoulder = (
      x,
      y,
      z,
      sx,
      sy,
      sz,
      rotY = 0,
      mat = slateMat,
      presets = null
    ) => {
      const geo = new THREE.DodecahedronGeometry(1.0, 1);
      const pos = geo.attributes.position;

      for (let i = 0; i < pos.count; i++) {
        // Round to 4 decimals so all shared corner vertices receive the EXACT same offset!
        const qx = Math.round(pos.getX(i) * 10000) / 10000;
        let qy = Math.round(pos.getY(i) * 10000) / 10000;
        const qz = Math.round(pos.getZ(i) * 10000) / 10000;

        if (qy < -0.25) qy = -0.35 + (qy + 0.25) * 0.25;
        if (qy > 0.45) qy = 0.45 + (qy - 0.45) * 0.45;

        const facetWave =
          1.0 +
          Math.sin(qx * 3.1 + qz * 2.3) * 0.065 +
          Math.cos(qy * 4.2 - qx * 1.9) * 0.045;

        pos.setXYZ(i, qx * sx * facetWave, qy * sy, qz * sz * facetWave);
      }
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.rockGroup.add(mesh);
      this.rocks.push({ x, z, mesh, presets });
      return mesh;
    };

    // --- ref_01_beach_sunset.png right-side coastal boulder & flat slate rock shelf ---
    // Positioned at (1.95, 0.16, 17.6) and (3.45, 0.48, 17.2) on the distant right shoreline
    // behind the campfire and ocean surf just like ref_01!
    createChiseledBoulder(
      1.95,
      0.16,
      17.6,
      1.55,
      0.28,
      0.95,
      0.06,
      slateMat,
      ['beach_sunset', 'free_roam', 'follow_player']
    );
    createChiseledBoulder(
      3.45,
      0.48,
      17.2,
      1.35,
      1.15,
      1.15,
      -0.2,
      darkWetSlateMat,
      ['beach_sunset', 'free_roam', 'follow_player']
    );

    // --- ref_05_beach_bridge_villagers.png river mouth coastal boulders ---
    createChiseledBoulder(
      7.5,
      0.22,
      20.2,
      0.86,
      0.62,
      0.78,
      0.42,
      slateMat,
      ['bridge_plaza', 'free_roam', 'follow_player']
    );
    createChiseledBoulder(
      8.5,
      0.28,
      19.8,
      0.92,
      0.72,
      0.82,
      -0.3,
      darkWetSlateMat,
      ['bridge_plaza', 'free_roam', 'follow_player']
    );

    if (this.gridSystem && typeof this.gridSystem.registerCollider === 'function') {
      try {
        this.gridSystem.registerCollider(3.45, 17.2, 1.35, { type: 'rock' });
        this.gridSystem.registerCollider(8.0, 20.0, 1.15, { type: 'rock' });
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * 6. Stylized Ocean, River & Foaming Waterfall Shader (`waterSystem`)
   */
  _buildWaterSystem() {
    // --- A. OCEAN WATER SHADER MESH ---
    const oceanUniforms = createSharedCurveUniforms({
      uShallowColor: { value: new THREE.Color('#2ea89c') },
      uMidColor: { value: new THREE.Color('#15788c') },
      uDeepColor: { value: new THREE.Color('#0c4f68') },
      uFoamUnderlay: { value: new THREE.Color('#196260') },
      uFoamColor: { value: new THREE.Color('#ffffff') },
      uScenePresetMode: { value: 0.0 }, // 1.0 = beach_sunset, 2.0 = bridge_plaza
    });

    const oceanFragShader = /* glsl */ `
      uniform float uTime;
      uniform vec3 uShallowColor;
      uniform vec3 uMidColor;
      uniform vec3 uDeepColor;
      uniform vec3 uFoamUnderlay;
      uniform vec3 uFoamColor;
      uniform float uScenePresetMode;

      varying vec3 vWorldPos;
      varying vec2 vUv;

      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      vec2 voronoi(vec2 x, float timeOffset) {
        vec2 n = floor(x);
        vec2 f = fract(x);
        float f1 = 8.0;
        float f2 = 8.0;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash2(n + g);
            o = 0.5 + 0.42 * sin(timeOffset + 6.2831 * o);
            vec2 r = g - f + o;
            float d = dot(r, r);
            if (d < f1) {
              f2 = f1;
              f1 = d;
            } else if (d < f2) {
              f2 = d;
            }
          }
        }
        return vec2(sqrt(f1), sqrt(f2));
      }

      float getShorelineZ(float x) {
        float ref01Cove = exp(-pow((x - 3.3) / 1.95, 2.0)) * 4.25;
        float estuaryInlet = exp(-pow((x - 10.45) / 2.1, 2.0)) * 3.4;
        float leftSweep = clamp((-x + 1.0) / 5.0, 0.0, 1.0) * 0.55;
        return 21.55 + leftSweep - ref01Cove - estuaryInlet;
      }

      void main() {
        float shoreZ = getShorelineZ(vWorldPos.x);
        float shoreDist = vWorldPos.z - shoreZ;

        if (shoreDist < -0.25) {
          discard;
        }

        float tide = sin(uTime * 1.45 + vWorldPos.x * 0.25) * 0.14;
        float d = max(0.0, shoreDist + tide);

        // Rich tropical turquoise-to-cerulean water gradient
        float midMix = smoothstep(0.35, 2.4, d);
        float deepMix = smoothstep(2.2, 6.8, d);
        vec3 waterCol = mix(uShallowColor, uMidColor, midMix);
        waterCol = mix(waterCol, uDeepColor, deepMix);

        // 1. Lacy Voronoi / Cellular Sea-Foam Web in the shallow surf zone (d in [0.04, 1.75])
        vec2 foamUv = vWorldPos.xz * vec2(1.55, 1.95) + vec2(0.0, uTime * 0.22);
        vec2 v1 = voronoi(foamUv, uTime * 0.65);
        vec2 v2 = voronoi(foamUv * 2.1 + 3.7, -uTime * 0.45);

        float cellEdge1 = 1.0 - smoothstep(0.05, 0.21, v1.y - v1.x);
        float cellEdge2 = 1.0 - smoothstep(0.04, 0.17, v2.y - v2.x);
        float lacyWeb = clamp(cellEdge1 * 0.9 + cellEdge2 * 0.55, 0.0, 1.0);
        float surfZoneMask = smoothstep(0.0, 0.18, d) * (1.0 - smoothstep(1.25, 1.78, d));

        // Darker teal bubble holes inside the Voronoi web so the white lace pops like ref_01 & ref_05!
        waterCol = mix(waterCol, uFoamUnderlay, surfZoneMask * (1.0 - lacyWeb) * 0.58);
        float lacyFoam = lacyWeb * surfZoneMask * 0.94;

        // 2. Two Crisp, Rhythmic White Shoreline Wave Ribbons (ref_01 & ref_05!)
        float wave1Pos = 1.62 - sin(uTime * 1.45) * 0.14 + sin(vWorldPos.x * 0.5) * 0.07;
        float wave1 = 1.0 - smoothstep(0.045, 0.14, abs(d - wave1Pos));

        float wave2Pos = 2.82 - cos(uTime * 1.45) * 0.18 + cos(vWorldPos.x * 0.42 + 1.0) * 0.09;
        float wave2 = (1.0 - smoothstep(0.04, 0.13, abs(d - wave2Pos))) * 0.95;

        float shoreLip = (1.0 - smoothstep(0.0, 0.14, d)) * 0.88;

        float totalFoam = clamp(max(max(wave1, wave2), max(lacyFoam, shoreLip)), 0.0, 1.0);
        vec3 finalColor = mix(waterCol, uFoamColor, totalFoam);

        float alpha = smoothstep(-0.18, 0.14, shoreDist);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    const oceanMat = new THREE.ShaderMaterial({
      uniforms: oceanUniforms,
      vertexShader: WATER_CURVE_VERTEX_SHADER,
      fragmentShader: oceanFragShader,
      transparent: true,
      depthWrite: false,
    });
    oceanMat.userData.worldCurveApplied = true;

    const oceanGeo = new THREE.PlaneGeometry(110, 48, 180, 80);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.set(0, 0.14, 34.0); // spans z from 10.0 to 58.0
    oceanMesh.renderOrder = 2;
    this.waterGroup.add(oceanMesh);

    // --- B. RIVER WATER MESH (`y = 0.18`) & UPPER CLIFF RIVER (`y = 3.0`) ---
    const riverUniforms = createSharedCurveUniforms({
      uWaterColor: { value: new THREE.Color('#3b92dc') },
      uWaterHighlight: { value: new THREE.Color('#5cb0f2') },
      uWaterDeep: { value: new THREE.Color('#2872b8') },
    });

    const riverFragShader = /* glsl */ `
      uniform float uTime;
      uniform vec3 uWaterColor;
      uniform vec3 uWaterHighlight;
      uniform vec3 uWaterDeep;

      varying vec3 vWorldPos;
      varying vec2 vUv;

      float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      void main() {
        float ripple = sin(vWorldPos.x * 1.8 + uTime * 1.6) * cos(vWorldPos.z * 2.1 - uTime * 1.2);
        vec3 col = mix(uWaterDeep, uWaterColor, 0.65 + ripple * 0.18);
        col = mix(col, uWaterHighlight, smoothstep(0.2, 0.85, ripple));

        float distFromPlunge = length(vWorldPos.xz - vec2(-11.0, -12.6));
        if (distFromPlunge < 7.5 && vWorldPos.y < 1.5) {
          float ringWave = sin(distFromPlunge * 4.5 - uTime * 3.8);
          float ringMask = smoothstep(0.88, 0.97, ringWave) * (1.0 - distFromPlunge / 7.5) * 0.45;
          col = mix(col, vec3(1.0), ringMask);
        }

        vec2 spGrid = floor(vWorldPos.xz * 1.35);
        vec2 spLocal = fract(vWorldPos.xz * 1.35) - 0.5;
        float rnd = hash21(spGrid);
        float twinkle = sin(uTime * 2.8 + rnd * 18.0);
        if (rnd > 0.72 && twinkle > 0.25) {
          float dot1 = 1.0 - smoothstep(0.03, 0.065, length(spLocal - vec2(-0.08, 0.0)));
          float dot2 = 1.0 - smoothstep(0.025, 0.055, length(spLocal - vec2(0.08, -0.04)));
          col = mix(col, vec3(1.0), clamp(dot1 + dot2, 0.0, 1.0) * smoothstep(0.25, 0.7, twinkle));
        }

        gl_FragColor = vec4(col, 0.94);
      }
    `;

    const riverMat = new THREE.ShaderMaterial({
      uniforms: riverUniforms,
      vertexShader: WATER_CURVE_VERTEX_SHADER,
      fragmentShader: riverFragShader,
      transparent: true,
    });
    riverMat.userData.worldCurveApplied = true;

    const lowerRiverGeo = new THREE.PlaneGeometry(68, 36, 136, 72);
    lowerRiverGeo.rotateX(-Math.PI / 2);
    const lowerRiverMesh = new THREE.Mesh(lowerRiverGeo, riverMat);
    lowerRiverMesh.position.set(0, 0.18, 4.0);
    this.waterGroup.add(lowerRiverMesh);

    const upperRiverGeo = new THREE.PlaneGeometry(4.1, 18.5, 16, 36);
    upperRiverGeo.rotateX(-Math.PI / 2);
    const upperRiverMesh = new THREE.Mesh(upperRiverGeo, riverMat);
    upperRiverMesh.position.set(-11.0, 3.02, -22.75);
    this.waterGroup.add(upperRiverMesh);

    const waterfallData = this._buildWaterfall(oceanUniforms.uTime);

    return {
      oceanMesh,
      lowerRiverMesh,
      upperRiverMesh,
      ...waterfallData,
      oceanUniforms,
      riverUniforms,
    };
  }

  _buildWaterfall(sharedTimeUniform) {
    const wfGroup = new THREE.Group();
    wfGroup.name = 'WaterfallSystem';

    const wfUniforms = createSharedCurveUniforms({
      uTime: sharedTimeUniform || { value: 0.0 },
      uWaterBase: { value: new THREE.Color('#64aae4') },
      uWaterMid: { value: new THREE.Color('#8ec8f6') },
      uFoamWhite: { value: new THREE.Color('#ffffff') },
    });

    const wfFragShader = /* glsl */ `
      uniform float uTime;
      uniform vec3 uWaterBase;
      uniform vec3 uWaterMid;
      uniform vec3 uFoamWhite;

      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        float scrollY = vUv.y + uTime * 1.65;

        float col1 = sin(vUv.x * 42.0) * 0.5 + 0.5;
        float col2 = cos(vUv.x * 86.0 + 1.4) * 0.5 + 0.5;
        float streakNoise = sin(scrollY * 14.0 + col1 * 4.5) * 0.5 + 0.5;
        float fineStreak = cos(scrollY * 26.0 - col2 * 6.0) * 0.5 + 0.5;

        float verticalRibs = smoothstep(0.32, 0.78, col1 * 0.6 + col2 * 0.4);
        float foamStreak = smoothstep(0.38, 0.82, verticalRibs * 0.65 + streakNoise * 0.35);

        float topCrestFoam = smoothstep(0.76, 0.92, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y)) * 0.55;
        float bottomPlungeFoam = 1.0 - smoothstep(0.05, 0.42, vUv.y + (col1 - 0.5) * 0.14);

        vec3 baseCol = mix(uWaterBase, uWaterMid, fineStreak * 0.6);
        float totalWhite = clamp(foamStreak * 0.78 + topCrestFoam + bottomPlungeFoam, 0.0, 1.0);
        vec3 finalCol = mix(baseCol, uFoamWhite, totalWhite);

        gl_FragColor = vec4(finalCol, 0.96);
      }
    `;

    const wfMat = new THREE.ShaderMaterial({
      uniforms: wfUniforms,
      vertexShader: WATER_CURVE_VERTEX_SHADER,
      fragmentShader: wfFragShader,
      transparent: true,
      side: THREE.DoubleSide,
    });
    wfMat.userData.worldCurveApplied = true;

    const wfWidth = 4.12;
    const wfHeight = 2.86;
    const wfGeo = new THREE.PlaneGeometry(wfWidth, wfHeight, 32, 28);
    const wPos = wfGeo.attributes.position;

    for (let i = 0; i < wPos.count; i++) {
      const vx = wPos.getX(i) - 11.0;
      const normY = (wPos.getY(i) + wfHeight * 0.5) / wfHeight;
      const wy = THREE.MathUtils.lerp(0.18, 3.02, normY);

      let wz = -13.38;
      if (normY > 0.78) {
        const crestT = (normY - 0.78) / 0.22;
        wz -= crestT * crestT * 0.38;
      } else {
        wz += Math.sin(normY * Math.PI) * 0.12;
      }

      wPos.setXYZ(i, vx, wy, wz);
    }
    wfGeo.computeVertexNormals();

    const waterfallSheet = new THREE.Mesh(wfGeo, wfMat);
    wfGroup.add(waterfallSheet);

    // Churning white foam cylinders & splash droplets at the plunge pool base
    const foamMat = MaterialFactory.createClayMaterial('#ffffff', 0.35, {
      materialProps: {
        emissive: new THREE.Color('#d8eefc'),
        emissiveIntensity: 0.22,
      },
    });

    const foamRollers = [];
    const numRollers = 11;
    for (let r = 0; r < numRollers; r++) {
      const rx = -12.85 + (r / (numRollers - 1)) * 3.7;
      const radius = 0.22 + (r % 2) * 0.06;
      const puffGeo = new THREE.SphereGeometry(radius, 12, 10);
      puffGeo.scale(1.25, 0.75, 1.1);
      const puff = new THREE.Mesh(puffGeo, foamMat);
      puff.position.set(rx, 0.22, -13.24 + (r % 2) * 0.08);
      wfGroup.add(puff);
      foamRollers.push({ mesh: puff, baseY: 0.22, phase: r * 0.85 });
    }

    const splashDroplets = [];
    const dropGeo = new THREE.SphereGeometry(0.065, 8, 8);
    for (let d = 0; d < 14; d++) {
      const drop = new THREE.Mesh(dropGeo, foamMat);
      const baseX = -12.7 + (d / 13) * 3.4;
      drop.position.set(baseX, 0.3, -13.1);
      wfGroup.add(drop);
      splashDroplets.push({
        mesh: drop,
        baseX,
        baseZ: -13.12 + (d % 3) * 0.12,
        phase: d * 0.47,
        speed: 2.2 + (d % 4) * 0.35,
      });
    }

    try {
      applyWorldCurveToHierarchy(wfGroup);
    } catch (e) {
      // ignore
    }

    this.waterGroup.add(wfGroup);

    return {
      waterfallGroup: wfGroup,
      waterfallSheet,
      waterfallUniforms: wfUniforms,
      foamRollers,
      splashDroplets,
    };
  }

  /**
   * Configures scene-specific environment visibility so each of the 6 reference shots
   * (`beach_sunset`, `house_yard`, `flower_river`, `tent_horizon`, `bridge_plaza`,
   * `cliff_waterfall`) has an authentic, uncluttered background and horizon!
   */
  setScenePreset(presetName = 'free_roam') {
    const aliasMap = {
      ref_01: 'beach_sunset',
      ref_02: 'house_yard',
      ref_03: 'flower_river',
      ref_04: 'tent_horizon',
      ref_05: 'bridge_plaza',
      ref_06: 'cliff_waterfall',
      '1': 'beach_sunset',
      '2': 'house_yard',
      '3': 'flower_river',
      '4': 'tent_horizon',
      '5': 'bridge_plaza',
      '6': 'cliff_waterfall',
      '0': 'free_roam',
    };
    const preset = aliasMap[presetName] || presetName || 'free_roam';
    this.activePreset = preset;

    const isFreeRoam = preset === 'free_roam' || preset === 'follow_player';
    const showCliffAndWaterfall = isFreeRoam || preset === 'cliff_waterfall';

    // 1. Upper Cliff Wall & Waterfall only in `cliff_waterfall` or `free_roam`
    if (this.upperPlateauMesh) this.upperPlateauMesh.visible = showCliffAndWaterfall;
    if (this.cliffWallGroup) this.cliffWallGroup.visible = showCliffAndWaterfall;
    if (this.cliffInclineRamp) this.cliffInclineRamp.visible = isFreeRoam;
    if (this.waterSystem?.upperRiverMesh) {
      this.waterSystem.upperRiverMesh.visible = showCliffAndWaterfall;
    }
    if (this.waterSystem?.waterfallGroup) {
      this.waterSystem.waterfallGroup.visible = showCliffAndWaterfall;
    }

    // 2. Main Grass Plateau vs Uninterrupted Flat Lawn vs Beach Sunset Peninsula
    if (this.mainGrassMesh) {
      this.mainGrassMesh.visible = preset !== 'beach_sunset';
    }
    if (this.flatLawnCoverMesh) {
      this.flatLawnCoverMesh.visible = preset === 'house_yard' || preset === 'tent_horizon';
    }
    if (this.riverbankGroup) {
      this.riverbankGroup.visible =
        isFreeRoam ||
        preset === 'flower_river' ||
        preset === 'bridge_plaza' ||
        preset === 'cliff_waterfall';
    }
    if (this.waterSystem?.lowerRiverMesh) {
      this.waterSystem.lowerRiverMesh.visible =
        isFreeRoam ||
        preset === 'flower_river' ||
        preset === 'bridge_plaza' ||
        preset === 'cliff_waterfall';
    }

    // 3. Ocean Shoreline Mode (`1.0` for `beach_sunset` right-hand ocean sweep)
    if (this.waterSystem?.oceanUniforms?.uScenePresetMode) {
      this.waterSystem.oceanUniforms.uScenePresetMode.value =
        preset === 'beach_sunset' ? 1.0 : preset === 'bridge_plaza' ? 2.0 : 0.0;
    }

    // 4. Dirt Path Tiles & Cliff Dig Hole
    const showYardPath = isFreeRoam || preset === 'house_yard';
    if (this.yardPathTiles) {
      for (const tile of this.yardPathTiles) {
        if (tile) tile.visible = showYardPath;
      }
    }
    if (this.cliffDigHole) {
      this.cliffDigHole.visible = isFreeRoam || preset === 'cliff_waterfall';
    }

    // 5. Trees, Flowers, Wild Grass Tufts & Coastal Boulders
    for (const tree of this.trees) {
      tree.mesh.visible =
        !tree.presets || tree.presets.includes(preset);
    }
    for (const fl of this.flowers) {
      fl.mesh.visible =
        isFreeRoam || !fl.presets || fl.presets.includes(preset);
    }
    for (const tuft of this.grassTufts) {
      tuft.mesh.visible =
        isFreeRoam || !tuft.presets || tuft.presets.includes(preset);
    }
    for (const rock of this.rocks) {
      rock.mesh.visible =
        isFreeRoam || !rock.presets || rock.presets.includes(preset);
    }
  }

  update(dt = 0.016, elapsed = 0.0) {
    const timeVal = elapsed || performance.now() * 0.001;

    if (this.waterSystem) {
      if (this.waterSystem.oceanUniforms?.uTime) {
        this.waterSystem.oceanUniforms.uTime.value = timeVal;
      }
      if (this.waterSystem.riverUniforms?.uTime) {
        this.waterSystem.riverUniforms.uTime.value = timeVal;
      }
      if (this.waterSystem.waterfallUniforms?.uTime) {
        this.waterSystem.waterfallUniforms.uTime.value = timeVal;
      }

      if (this.waterSystem.foamRollers && this.waterSystem.waterfallGroup?.visible) {
        for (const roller of this.waterSystem.foamRollers) {
          const w = Math.sin(timeVal * 5.2 + roller.phase);
          roller.mesh.position.y = roller.baseY + w * 0.035;
          const s = 1.0 + Math.cos(timeVal * 4.6 + roller.phase) * 0.14;
          roller.mesh.scale.set(1.25 * s, 0.75 * s, 1.1 * s);
        }
      }

      if (this.waterSystem.splashDroplets && this.waterSystem.waterfallGroup?.visible) {
        for (const sp of this.waterSystem.splashDroplets) {
          const cycle = (timeVal * sp.speed + sp.phase) % 1.0;
          const arcY = Math.sin(cycle * Math.PI) * 0.38;
          sp.mesh.position.set(
            sp.baseX + Math.sin(sp.phase + timeVal) * 0.06,
            0.2 + arcY,
            sp.baseZ + cycle * 0.28
          );
          const ds = Math.sin(cycle * Math.PI);
          sp.mesh.scale.setScalar(0.6 + ds * 0.7);
        }
      }
    }

    for (const tree of this.trees) {
      if (tree.shakeTimer > 0) {
        tree.shakeTimer = Math.max(0, tree.shakeTimer - dt);
        const norm = tree.shakeTimer / 0.72;
        const wobble = Math.sin((1.0 - norm) * 38.0) * norm * 0.14;
        tree.crown.rotation.z = wobble;
        tree.crown.rotation.x = wobble * 0.55;
      } else if (tree.crown.rotation.z !== 0 || tree.crown.rotation.x !== 0) {
        tree.crown.rotation.z = 0;
        tree.crown.rotation.x = 0;
      }

      // Regrow dropped fruit after cooldown
      if (tree.fruitsDropped && tree.regrowTimer !== undefined) {
        tree.regrowTimer -= dt;
        if (tree.regrowTimer <= 0) {
          tree.fruitsDropped = false;
          tree.regrowTimer = undefined;
          for (const f of tree.fruits) {
            f.visible = true;
          }
        }
      }
    }

    // Animate freshly watered flower bounce
    for (const fl of this.flowers) {
      if (fl.bounceTimer && fl.bounceTimer > 0) {
        fl.bounceTimer = Math.max(0, fl.bounceTimer - dt);
        const bNorm = fl.bounceTimer / 0.65;
        const s = 1.0 + Math.sin((1.0 - bNorm) * Math.PI * 3.0) * bNorm * 0.28;
        fl.mesh.scale.set(s, 1.0 / Math.sqrt(s), s);
      } else if (fl.mesh && fl.mesh.scale.x !== 1.0) {
        fl.mesh.scale.set(1, 1, 1);
      }
    }

    for (const f of this.fallingFruits) {
      if (f.done) continue;
      f.elapsed += dt;
      if (f.elapsed < 0) continue;

      const t = Math.min(1.0, f.elapsed / f.duration);
      const curX = THREE.MathUtils.lerp(f.startX, f.targetX, t);
      const curZ = THREE.MathUtils.lerp(f.startZ, f.targetZ, t);

      let curY;
      if (t < 0.55) {
        const fallT = t / 0.55;
        curY = THREE.MathUtils.lerp(f.startY, f.groundY, fallT * fallT);
      } else if (t < 0.82) {
        const b1 = (t - 0.55) / 0.27;
        curY = f.groundY + Math.sin(b1 * Math.PI) * 0.36;
      } else {
        const b2 = (t - 0.82) / 0.18;
        curY = f.groundY + Math.sin(b2 * Math.PI) * 0.12;
      }

      f.mesh.position.set(curX, curY, curZ);
      if (t >= 1.0) {
        f.mesh.position.y = f.groundY;
        f.done = true;
        if (f.itemRecord) {
          f.itemRecord.ready = true;
        }
      }
    }

    // Gentle bobbing & spinning of ready collectable items on the ground
    if (this.collectableItems && this.collectableItems.length > 0) {
      for (const item of this.collectableItems) {
        if (!item || item.pickedUp || !item.ready || !item.mesh) continue;
        const bob = Math.sin(timeVal * 3.2 + (item.phase || 0)) * 0.045;
        item.mesh.position.y = item.y + Math.max(0, bob);
        item.mesh.rotation.y += dt * 1.1;
      }
    }
  }
}

export default {
  MaterialFactory,
  materialFactory,
  EnvironmentBuilder,
};
