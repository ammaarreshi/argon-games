import * as THREE from '../assets/vendor/three.module.js';
import { applyWorldCurveToHierarchy } from './world_curve_engine.js';

/**
 * Creates a centered, beveled 3D box geometry with zero sharp edges.
 * Every furniture plank, beam, stone block, and radio body uses this or rounded primitives.
 */
function createRoundedBoxGeometry(width, height, depth, radius = 0.04, smoothness = 3) {
  const r = Math.min(radius, width * 0.45, height * 0.45, depth * 0.45);
  const w = Math.max(0.002, width - r * 2);
  const h = Math.max(0.002, height - r * 2);
  const d = Math.max(0.002, depth - r * 2);

  const shape = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;

  shape.moveTo(-hw, -hh - r);
  shape.lineTo(hw, -hh - r);
  shape.quadraticCurveTo(hw + r, -hh - r, hw + r, -hh);
  shape.lineTo(hw + r, hh);
  shape.quadraticCurveTo(hw + r, hh + r, hw, hh + r);
  shape.lineTo(-hw, hh + r);
  shape.quadraticCurveTo(-hw - r, hh + r, -hw - r, hh);
  shape.lineTo(-hw - r, -hh);
  shape.quadraticCurveTo(-hw - r, -hh - r, -hw, -hh - r);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelSegments: Math.max(2, smoothness),
    steps: 1,
    bevelSize: r,
    bevelThickness: r,
    curveSegments: Math.max(4, smoothness * 2),
  });

  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Helper to create a procedural CanvasTexture in sRGB color space.
 */
function makeCanvasTexture(width, height, drawFn, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX > 1 || repeatY > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Agent 3: Props & Furniture Builder for Argon Valley (Argon Valley).
 * Builds all houses, tents, bridges, fountains, yard DIY furniture, and beach props,
 * organized into clean scene-preset sector groups.
 */
export class PropsAndFurnitureBuilder {
  constructor(scene, gridSystem, materialFactory) {
    if (
      scene &&
      !scene.isScene &&
      typeof scene.add !== 'function' &&
      (scene.scene || scene.gridSystem || scene.materialFactory)
    ) {
      materialFactory = scene.materialFactory;
      gridSystem = scene.gridSystem;
      scene = scene.scene;
    }

    this.scene = scene || null;
    this.gridSystem = gridSystem || null;
    this.materialFactory = materialFactory || null;

    this.root = new THREE.Group();
    this.root.name = 'PropsAndFurnitureRoot';

    // Sector groups for deterministic scene-preset framing
    this.cottageYardGroup = new THREE.Group();
    this.cottageYardGroup.name = 'CottageYardGroup';
    this.flowerRiverGroup = new THREE.Group();
    this.flowerRiverGroup.name = 'FlowerRiverGroup';
    this.tentClearingGroup = new THREE.Group();
    this.tentClearingGroup.name = 'TentClearingGroup';
    this.beachSunsetGroup = new THREE.Group();
    this.beachSunsetGroup.name = 'BeachSunsetGroup';
    this.bridgePlazaGroup = new THREE.Group();
    this.bridgePlazaGroup.name = 'BridgePlazaGroup';
    this.riverBridgesGroup = new THREE.Group();
    this.riverBridgesGroup.name = 'RiverBridgesGroup';

    this.root.add(
      this.cottageYardGroup,
      this.flowerRiverGroup,
      this.tentClearingGroup,
      this.beachSunsetGroup,
      this.bridgePlazaGroup,
      this.riverBridgesGroup
    );

    this.interactables = [];
    this.seats = [];
    this.animatedSwingPivots = [];
    this.animatedCampfires = [];
    this.animatedFountains = [];
    this.cottageGlowMaterials = [];
    this.mailboxFlags = [];

    this._materials = {};
    this._built = false;
    this.activePreset = 'free_roam';

    this.update = this.update.bind(this);
    this.getNearestInteractable = this.getNearestInteractable.bind(this);
    this.getNearestSeat = this.getNearestSeat.bind(this);
    this.setScenePreset = this.setScenePreset.bind(this);
    this.setPreset = this.setPreset.bind(this);
    this.build = this.build.bind(this);

    this.build();
  }

  build() {
    if (this._built) {
      return this;
    }
    this._built = true;

    this._initSharedMaterials();

    // -------------------------------------------------------------------------
    // SECTOR 1: Cozy Player Cottage Yard (ref_02_house_yard.png)
    // -------------------------------------------------------------------------
    this._buildPlayerCottage(-5.8, -9.8, this.cottageYardGroup);
    this._buildRedMailbox(-3.45, -8.25, this.cottageYardGroup);
    this._buildSteelDrumBoiler(-2.2, -9.4, this.cottageYardGroup);
    this._buildWoodenSwingBench(0.8, -9.2, 0.0, 'swing_yard', this.cottageYardGroup);
    this._buildLogBenchWithCoffee(-1.85, -7.85, 0.0, this.cottageYardGroup);
    this._buildCarvedArrowSignpost(1.2, -7.4, -0.15, this.cottageYardGroup);
    this._buildDIYWorkbench(0.55, -4.85, -Math.PI / 2, this.cottageYardGroup);
    this._buildMetalFoldingTableAndChair(-2.3, -4.45, -1.15, -4.45, this.cottageYardGroup);
    this._buildRainbowHammock(-5.6, -4.6, 0.12, this.cottageYardGroup);

    // -------------------------------------------------------------------------
    // SECTOR 2: Flower Garden & Riverbank (ref_03_flower_garden_river.jpg)
    // -------------------------------------------------------------------------
    this._buildRiverbankStoolAndFirewood(-6.8, -2.0, this.flowerRiverGroup);
    this._buildWoodenSwingBench(0.95, -2.05, 0.0, 'swing_garden', this.flowerRiverGroup);
    this._buildCarvedArrowSignpost(2.15, -0.85, 0.25, this.flowerRiverGroup);

    // -------------------------------------------------------------------------
    // SECTOR 3: Yellow Triangular Tent Clearing (ref_04_yellow_tent_horizon.jpg)
    // -------------------------------------------------------------------------
    this._buildYellowTent(11.4, -9.0, this.tentClearingGroup);
    this._buildWoodenPostMailbox(9.8, -7.2, this.tentClearingGroup);
    this._buildDroppedTentGroundItems(this.tentClearingGroup);

    // -------------------------------------------------------------------------
    // SECTOR 4: Sunset Beach & Campfire (ref_01_beach_sunset.png)
    // -------------------------------------------------------------------------
    this._buildBeachLogStumpSeat(0.0, 19.5, this.beachSunsetGroup);
    this._buildCracklingCampfire(1.25, 19.6, true, this.beachSunsetGroup);
    this._buildChevronBeachTowelAndSandals(-2.8, 20.0, -2.9, 20.6, this.beachSunsetGroup);
    this._buildCoconutDrink(-1.85, 20.3, this.beachSunsetGroup);
    this._buildVintagePortableRadio(-2.15, 19.1, 0.18, this.beachSunsetGroup);
    this._buildPinkScallopSeashell(2.05, 18.35, -0.35, 1.22, this.beachSunsetGroup, 0.18);

    // -------------------------------------------------------------------------
    // SECTOR 5: Bridge, Plaza Marble Fountain & Beach Resort (ref_05_beach_bridge_villagers.png)
    // -------------------------------------------------------------------------
    this._buildStoneArchBridge(9.2, 14.5, Math.PI / 2, this.bridgePlazaGroup);
    this._buildPlazaFountainAndFences(4.5, 13.2, this.bridgePlazaGroup);
    this._buildBeachResortProps(this.bridgePlazaGroup);

    // -------------------------------------------------------------------------
    // SECTOR 6: Free-Roam Wooden River Footbridges across the East-West River
    // -------------------------------------------------------------------------
    this._buildWoodenRiverBridge(-3.7, -3.85, this.riverBridgesGroup);
    this._buildWoodenRiverBridge(5.4, -3.85, this.riverBridgesGroup);

    // Apply the Argon Valley rolling world horizon shader to all meshes in our hierarchy
    if (typeof applyWorldCurveToHierarchy === 'function') {
      applyWorldCurveToHierarchy(this.root);
    }

    // Preserve non-shadow-casting flags on ground shadow decals, flames, and water jets
    this.root.traverse((obj) => {
      if (obj.isMesh && obj.userData && obj.userData.noShadow) {
        obj.castShadow = false;
        obj.receiveShadow = false;
      } else if (obj.isMesh && obj.userData && obj.userData.noCastShadow) {
        obj.castShadow = false;
      }
    });

    if (this.scene && typeof this.scene.add === 'function' && this.root.parent !== this.scene) {
      this.scene.add(this.root);
    }

    return this;
  }

  /**
   * Builds a cozy Argon Valley log-and-plank footbridge across the East-West river
   * (`z` from `-5.5` to `-2.2`) so the player can walk smoothly between the north and south banks.
   */
  _buildWoodenRiverBridge(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'WoodenRiverFootbridge';
    group.position.set(x, 0.56, z);

    const bridgeW = 2.15;
    const spanZ = 3.35;
    const numPlanks = 13;
    const archPeakY = 0.24;

    // Two arched side stringer beams
    for (const side of [-1, 1]) {
      const beamSegs = 8;
      for (let s = 0; s < beamSegs; s++) {
        const tm = (s + 0.5) / beamSegs;
        const zPos = (tm - 0.5) * spanZ;
        const archY = Math.sin(tm * Math.PI) * archPeakY;
        const dYdZ = ((Math.PI * archPeakY) / spanZ) * Math.cos(tm * Math.PI);
        const pitch = -Math.atan(dYdZ);

        const beam = new THREE.Mesh(
          createRoundedBoxGeometry(0.16, 0.14, spanZ / beamSegs + 0.04, 0.025, 2),
          this._materials.darkWalnutWood
        );
        beam.position.set(side * (bridgeW * 0.5 - 0.12), archY - 0.04, zPos);
        beam.rotation.x = pitch;
        group.add(beam);
      }
    }

    // Wooden transverse deck planks
    for (let i = 0; i < numPlanks; i++) {
      const tm = (i + 0.5) / numPlanks;
      const zPos = (tm - 0.5) * spanZ;
      const archY = Math.sin(tm * Math.PI) * archPeakY;
      const dYdZ = ((Math.PI * archPeakY) / spanZ) * Math.cos(tm * Math.PI);
      const pitch = -Math.atan(dYdZ);

      const plank = new THREE.Mesh(
        createRoundedBoxGeometry(bridgeW, 0.08, 0.22, 0.02, 2),
        i % 2 === 0 ? this._materials.pineWood : this._materials.mediumWood
      );
      plank.position.set(0, archY + 0.03, zPos);
      plank.rotation.x = pitch;
      group.add(plank);
    }

    // Low rustic log posts at the 4 corners & midpoints
    for (const side of [-1, 1]) {
      for (const zFrac of [-0.46, 0.0, 0.46]) {
        const tm = zFrac + 0.5;
        const zPos = zFrac * spanZ;
        const archY = Math.sin(tm * Math.PI) * archPeakY;
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.085, 0.095, 0.52, 10),
          this._materials.darkWalnutWood
        );
        post.position.set(side * (bridgeW * 0.5 - 0.06), archY + 0.26, zPos);
        group.add(post);

        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 10, 8),
          this._materials.pineWood
        );
        cap.scale.set(1.0, 0.45, 1.0);
        cap.position.set(side * (bridgeW * 0.5 - 0.06), archY + 0.52, zPos);
        group.add(cap);
      }
    }

    parentGroup.add(group);
  }

  /**
   * Switches sector visibility cleanly so each reference camera preset has zero cross-sector clutter.
   */
  setScenePreset(presetName) {
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

    switch (preset) {
      case 'beach_sunset': {
        this.beachSunsetGroup.visible = true;
        this.bridgePlazaGroup.visible = false;
        this.cottageYardGroup.visible = false;
        this.flowerRiverGroup.visible = false;
        this.tentClearingGroup.visible = false;
        if (this.riverBridgesGroup) this.riverBridgesGroup.visible = false;
        break;
      }
      case 'house_yard': {
        this.cottageYardGroup.visible = true;
        this.flowerRiverGroup.visible = false;
        this.tentClearingGroup.visible = false;
        this.beachSunsetGroup.visible = false;
        this.bridgePlazaGroup.visible = false;
        if (this.riverBridgesGroup) this.riverBridgesGroup.visible = false;
        break;
      }
      case 'flower_river': {
        this.flowerRiverGroup.visible = true;
        this.cottageYardGroup.visible = false;
        this.tentClearingGroup.visible = false;
        this.beachSunsetGroup.visible = false;
        this.bridgePlazaGroup.visible = false;
        if (this.riverBridgesGroup) this.riverBridgesGroup.visible = false;
        break;
      }
      case 'tent_horizon': {
        this.tentClearingGroup.visible = true;
        this.cottageYardGroup.visible = false;
        this.flowerRiverGroup.visible = false;
        this.beachSunsetGroup.visible = false;
        this.bridgePlazaGroup.visible = false;
        if (this.riverBridgesGroup) this.riverBridgesGroup.visible = false;
        break;
      }
      case 'bridge_plaza': {
        this.bridgePlazaGroup.visible = true;
        this.beachSunsetGroup.visible = false;
        this.cottageYardGroup.visible = false;
        this.flowerRiverGroup.visible = false;
        this.tentClearingGroup.visible = false;
        if (this.riverBridgesGroup) this.riverBridgesGroup.visible = false;
        break;
      }
      case 'cliff_waterfall': {
        this.cottageYardGroup.visible = false;
        this.flowerRiverGroup.visible = false;
        this.tentClearingGroup.visible = false;
        this.beachSunsetGroup.visible = false;
        this.bridgePlazaGroup.visible = false;
        if (this.riverBridgesGroup) this.riverBridgesGroup.visible = false;
        break;
      }
      default: {
        // 'free_roam' / 'follow_player'
        this.cottageYardGroup.visible = true;
        this.flowerRiverGroup.visible = true;
        this.tentClearingGroup.visible = true;
        this.beachSunsetGroup.visible = true;
        this.bridgePlazaGroup.visible = true;
        if (this.riverBridgesGroup) this.riverBridgesGroup.visible = true;
        break;
      }
    }
  }

  setPreset(presetName) {
    this.setScenePreset(presetName);
  }

  // ============================================================================
  // SPATIAL & TERRAIN HELPERS
  // ============================================================================

  _getTerrainY(x, z) {
    if (z >= -13.5 && z <= 13.5) {
      return 0.6;
    }
    if (this.gridSystem && typeof this.gridSystem.getTerrainHeight === 'function') {
      const h = this.gridSystem.getTerrainHeight(x, z);
      if (typeof h === 'number' && !Number.isNaN(h)) {
        // Keep beach items safely above the ocean water plane (y = 0.08..0.12)
        if (z > 13.5) {
          return Math.max(0.18, h);
        }
        return h;
      }
    }
    if (z < -14.0) return 3.2;
    if (z > 14.0) {
      const t = Math.min(1.0, Math.max(0.0, (z - 14.0) / 12.0));
      return Math.max(0.18, 0.6 - t * 1.0);
    }
    return 0.6;
  }

  _getBeachSlopePitch(x, z) {
    const yBack = this._getTerrainY(x, z - 0.5);
    const yFront = this._getTerrainY(x, z + 0.5);
    return Math.min(0.035, Math.max(-0.035, Math.atan2(yBack - yFront, 1.0) * 0.5));
  }

  _registerCollider(x, z, radius, metadata = {}) {
    if (this.gridSystem && typeof this.gridSystem.registerCollider === 'function') {
      return this.gridSystem.registerCollider(x, z, radius, metadata);
    }
    return null;
  }

  _registerInteractable(info) {
    this.interactables.push(info);
    if (info.type === 'seat') {
      this.seats.push(info);
    }
  }

  getNearestInteractable(x, z, maxDist = 2.4) {
    let best = null;
    let bestD2 = maxDist * maxDist;
    for (let i = 0; i < this.interactables.length; i++) {
      const item = this.interactables[i];
      const dx = item.x - x;
      const dz = item.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = item;
      }
    }
    return best;
  }

  getNearestSeat(x, z, maxDist = 2.2) {
    let best = null;
    let bestD2 = maxDist * maxDist;
    for (let i = 0; i < this.seats.length; i++) {
      const seat = this.seats[i];
      const dx = seat.x - x;
      const dz = seat.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = seat;
      }
    }
    return best;
  }

  _addContactShadow(parentGroup, radiusX, radiusZ, opacity = 0.36, offsetY = 0.016) {
    const geo = new THREE.PlaneGeometry(radiusX * 2.0, radiusZ * 2.0, 4, 4);
    geo.rotateX(-Math.PI / 2);

    const mat = this._materials.contactShadow.clone();
    mat.opacity = opacity;

    const disc = new THREE.Mesh(geo, mat);
    disc.position.y = offsetY;
    disc.renderOrder = 1;
    disc.userData.noShadow = true;
    parentGroup.add(disc);
    return disc;
  }

  // ============================================================================
  // SHARED TACTILE PBR MATERIALS
  // ============================================================================

  _initSharedMaterials() {
    const shadowTex = makeCanvasTexture(128, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.06, w * 0.5, h * 0.5, w * 0.48);
      grad.addColorStop(0.0, 'rgba(18, 28, 16, 0.85)');
      grad.addColorStop(0.55, 'rgba(20, 30, 18, 0.42)');
      grad.addColorStop(1.0, 'rgba(20, 30, 18, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });

    this._materials.contactShadow = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });

    const stuccoTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f5efe2';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) {
        const px = Math.random() * w;
        const py = Math.random() * h;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(230, 218, 198, 0.35)' : 'rgba(255, 252, 245, 0.35)';
        ctx.fillRect(px, py, 3, 3);
      }
    }, 2, 2);

    this._materials.cottageStucco = new THREE.MeshPhysicalMaterial({
      map: stuccoTex,
      color: 0xf5efe2,
      roughness: 0.82,
      metalness: 0.0,
      sheen: 0.25,
      sheenColor: new THREE.Color(0xfff8eb),
    });

    this._materials.cottageQuoin = new THREE.MeshPhysicalMaterial({
      color: 0xe6decb,
      roughness: 0.8,
      sheen: 0.2,
    });

    const makeWoodTex = (baseHex, grainHex) =>
      makeCanvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = baseHex;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = grainHex;
        ctx.lineWidth = 2;
        for (let y = 0; y < h; y += 6) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          for (let x = 0; x <= w; x += 16) {
            ctx.lineTo(x, y + Math.sin(x * 0.06 + y * 0.1) * 2.2);
          }
          ctx.stroke();
        }
      }, 1, 1);

    this._materials.timberWood = new THREE.MeshPhysicalMaterial({
      map: makeWoodTex('#b87442', 'rgba(142, 82, 38, 0.28)'),
      color: 0xb87442,
      roughness: 0.65,
      sheen: 0.3,
      sheenColor: new THREE.Color(0xe6a872),
    });

    this._materials.pineWood = new THREE.MeshPhysicalMaterial({
      map: makeWoodTex('#e4be8e', 'rgba(188, 142, 88, 0.25)'),
      color: 0xe4be8e,
      roughness: 0.58,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xfff0d6),
    });

    this._materials.mediumWood = new THREE.MeshPhysicalMaterial({
      map: makeWoodTex('#c68c53', 'rgba(148, 96, 46, 0.28)'),
      color: 0xc68c53,
      roughness: 0.62,
      sheen: 0.3,
    });

    this._materials.darkWalnutWood = new THREE.MeshPhysicalMaterial({
      map: makeWoodTex('#5c3922', 'rgba(38, 22, 12, 0.35)'),
      color: 0x5c3922,
      roughness: 0.65,
      sheen: 0.25,
    });

    this._materials.barkWood = new THREE.MeshPhysicalMaterial({
      map: makeWoodTex('#4e3524', 'rgba(28, 18, 10, 0.45)'),
      color: 0x4e3524,
      roughness: 0.85,
      sheen: 0.18,
    });

    const logRingTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;
      ctx.fillStyle = '#dfb888';
      ctx.fillRect(0, 0, w, h);

      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.48);
      grad.addColorStop(0.0, '#c2915c');
      grad.addColorStop(0.25, '#dab282');
      grad.addColorStop(0.78, '#e5c295');
      grad.addColorStop(0.92, '#c89966');
      grad.addColorStop(1.0, '#62422a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.49, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(150, 98, 52, 0.42)';
      ctx.lineWidth = 2.2;
      for (let r = 14; r < w * 0.44; r += 13) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    this._materials.logEndRings = new THREE.MeshPhysicalMaterial({
      map: logRingTex,
      roughness: 0.62,
      sheen: 0.28,
      sheenColor: new THREE.Color(0xffe9c8),
    });

    this._materials.cutLogSeat = new THREE.MeshPhysicalMaterial({
      map: makeWoodTex('#d9b488', 'rgba(176, 132, 82, 0.25)'),
      color: 0xd9b488,
      roughness: 0.56,
      clearcoat: 0.1,
      sheen: 0.32,
    });

    const stoneTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#868890';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1500; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(110, 112, 120, 0.3)' : 'rgba(165, 168, 176, 0.28)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
    }, 2, 2);

    this._materials.foundationStone = new THREE.MeshPhysicalMaterial({
      map: stoneTex,
      color: 0x787880,
      roughness: 0.78,
      sheen: 0.15,
    });

    this._materials.stoopStone = new THREE.MeshPhysicalMaterial({
      map: stoneTex,
      color: 0x868690,
      roughness: 0.74,
      sheen: 0.18,
    });

    this._materials.marbleStone = new THREE.MeshPhysicalMaterial({
      map: stoneTex,
      color: 0xc8cbd2,
      roughness: 0.48,
      clearcoat: 0.2,
      clearcoatRoughness: 0.35,
      sheen: 0.25,
    });

    this._materials.roofTileMain = new THREE.MeshPhysicalMaterial({
      color: 0xd84438,
      roughness: 0.52,
      clearcoat: 0.18,
      clearcoatRoughness: 0.38,
      sheen: 0.3,
      sheenColor: new THREE.Color(0xff9488),
    });

    this._materials.roofTileAlt = new THREE.MeshPhysicalMaterial({
      color: 0xe25244,
      roughness: 0.5,
      clearcoat: 0.18,
      sheen: 0.3,
    });

    this._materials.cottageDoorRed = new THREE.MeshPhysicalMaterial({
      color: 0xd64c3b,
      roughness: 0.48,
      clearcoat: 0.22,
      clearcoatRoughness: 0.35,
      sheen: 0.3,
    });

    this._materials.mailboxRed = new THREE.MeshPhysicalMaterial({
      color: 0xdc3c30,
      roughness: 0.38,
      metalness: 0.12,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
    });

    this._materials.brass = new THREE.MeshPhysicalMaterial({
      color: 0xe5bc48,
      roughness: 0.28,
      metalness: 0.82,
      clearcoat: 0.4,
    });

    this._materials.bushLeafMain = new THREE.MeshPhysicalMaterial({
      color: 0x4eb83b,
      roughness: 0.65,
      sheen: 0.45,
      sheenColor: new THREE.Color(0x98f26b),
    });

    this._materials.bushLeafLight = new THREE.MeshPhysicalMaterial({
      color: 0x68d149,
      roughness: 0.62,
      sheen: 0.5,
      sheenColor: new THREE.Color(0xb6ff85),
    });
  }

  // ============================================================================
  // 1. COZY PLAYER COTTAGE HOUSE & RED MAILBOX (ref_02_house_yard.png)
  // ============================================================================

  _buildPlayerCottage(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'PlayerCottageHouse';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 2.75, 2.45, 0.44, 0.015);

    // 1. Raised moulded stone foundation base (#787880)
    const foundGeo = createRoundedBoxGeometry(4.1, 0.36, 3.5, 0.05, 3);
    const foundMesh = new THREE.Mesh(foundGeo, this._materials.foundationStone);
    foundMesh.position.set(0, 0.18, 0);
    group.add(foundMesh);

    const foundLipGeo = createRoundedBoxGeometry(4.22, 0.09, 3.62, 0.035, 3);
    const foundLip = new THREE.Mesh(foundLipGeo, this._materials.stoopStone);
    foundLip.position.set(0, 0.35, 0);
    group.add(foundLip);

    // 2-step front stone stoop (#868690)
    const step1Geo = createRoundedBoxGeometry(1.88, 0.16, 0.72, 0.04, 3);
    const step1 = new THREE.Mesh(step1Geo, this._materials.stoopStone);
    step1.position.set(0, 0.08, 1.98);
    group.add(step1);

    const step2Geo = createRoundedBoxGeometry(1.74, 0.16, 0.46, 0.04, 3);
    const step2 = new THREE.Mesh(step2Geo, this._materials.stoopStone);
    step2.position.set(0, 0.24, 1.84);
    group.add(step2);

    // 2. Cream stucco main house body (#f5efe2)
    const wallW = 3.84;
    const wallH = 2.05;
    const wallD = 3.24;
    const wallGeo = createRoundedBoxGeometry(wallW, wallH, wallD, 0.06, 3);
    const wallMesh = new THREE.Mesh(wallGeo, this._materials.cottageStucco);
    wallMesh.position.set(0, 0.36 + wallH * 0.5, 0);
    group.add(wallMesh);

    // Triangular Gable Front & Back Stucco Wall Peaks
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-wallW * 0.5, 0);
    gableShape.lineTo(wallW * 0.5, 0);
    gableShape.lineTo(0, 1.48);
    gableShape.closePath();

    const gableDepth = wallD - 0.16;
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
      depth: gableDepth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03,
    });
    gableGeo.translate(0, 0, -gableDepth * 0.5);
    gableGeo.computeVertexNormals();
    const gableMesh = new THREE.Mesh(gableGeo, this._materials.cottageStucco);
    gableMesh.position.set(0, 0.36 + wallH, 0);
    group.add(gableMesh);

    // Subtle warm stone corner quoins along front corners (positioned cleanly inward of corner posts and proud of stucco wall)
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const qW = i % 2 === 0 ? 0.36 : 0.25;
        const quoinGeo = createRoundedBoxGeometry(qW, 0.24, 0.12, 0.025, 2);
        const quoin = new THREE.Mesh(quoinGeo, this._materials.cottageQuoin);
        quoin.position.set(
          side * (wallW * 0.5 - qW * 0.5 - 0.22),
          0.68 + i * 0.38,
          wallD * 0.5 - 0.01
        );
        group.add(quoin);
      }
    }

    // 3. Warm caramel timber framing beams (#b87442) — staggered Z planes to prevent any coplanar z-fighting
    const sillBeamGeo = createRoundedBoxGeometry(wallW + 0.08, 0.18, wallD + 0.08, 0.035, 2);
    const sillBeam = new THREE.Mesh(sillBeamGeo, this._materials.timberWood);
    sillBeam.position.set(0, 0.46, 0);
    group.add(sillBeam);

    const cornerPostGeo = createRoundedBoxGeometry(0.22, wallH + 0.08, 0.22, 0.04, 2);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(cornerPostGeo, this._materials.timberWood);
        post.position.set(sx * (wallW * 0.5 - 0.02), 0.36 + wallH * 0.5, sz * (wallD * 0.5 - 0.02));
        group.add(post);
      }
    }

    const roofAngle = Math.atan2(1.52, wallW * 0.5 + 0.25);
    for (const side of [-1, 1]) {
      const rakeBeamGeo = createRoundedBoxGeometry(2.55, 0.16, 0.16, 0.035, 2);
      const rakeBeam = new THREE.Mesh(rakeBeamGeo, this._materials.timberWood);
      rakeBeam.position.set(side * 1.02, 2.98, wallD * 0.5 + 0.05 + (side > 0 ? 0.008 : 0.0));
      rakeBeam.rotation.z = -side * roofAngle;
      group.add(rakeBeam);

      const braceGeo = createRoundedBoxGeometry(0.85, 0.14, 0.14, 0.03, 2);
      const brace = new THREE.Mesh(braceGeo, this._materials.timberWood);
      brace.position.set(side * 0.42, 2.96, wallD * 0.5 + 0.015);
      brace.rotation.z = side * 0.68;
      group.add(brace);
    }

    const kingPostGeo = createRoundedBoxGeometry(0.16, 0.95, 0.18, 0.03, 2);
    const kingPost = new THREE.Mesh(kingPostGeo, this._materials.timberWood);
    kingPost.position.set(0, 3.28, wallD * 0.5 + 0.085);
    group.add(kingPost);

    // 4. Steep pitched gable roof with overlapping rows of rounded terracotta roof tiles (#d84438)
    const roofGroup = new THREE.Group();
    roofGroup.position.set(0, 2.38, 0);
    group.add(roofGroup);

    const slopeLen = 2.68;
    const roofDepth = wallD + 0.58;
    for (const side of [-1, 1]) {
      const slopePivot = new THREE.Group();
      slopePivot.position.set(0, 1.54, 0);
      slopePivot.rotation.z = -side * roofAngle;
      roofGroup.add(slopePivot);

      const fasciaGeo = createRoundedBoxGeometry(slopeLen, 0.14, roofDepth, 0.04, 2);
      const fascia = new THREE.Mesh(fasciaGeo, this._materials.timberWood);
      fascia.position.set(side * (slopeLen * 0.5 - 0.05), -0.04, 0);
      slopePivot.add(fascia);

      const subFasciaGeo = createRoundedBoxGeometry(slopeLen + 0.04, 0.09, roofDepth + 0.04, 0.03, 2);
      const subFascia = new THREE.Mesh(subFasciaGeo, this._materials.cottageStucco);
      subFascia.position.set(side * (slopeLen * 0.5 - 0.05), 0.04, 0);
      slopePivot.add(subFascia);

      const numRows = 6;
      const numCols = 9;
      const tileRadius = 0.18;
      const tileGeo = new THREE.CylinderGeometry(tileRadius * 0.92, tileRadius, slopeLen / numRows + 0.08, 12);
      tileGeo.rotateZ(Math.PI / 2);

      for (let r = 0; r < numRows; r++) {
        const rx = side * (0.24 + r * 0.39);
        const ry = 0.11 + (numRows - r) * 0.012;
        for (let c = 0; c < numCols; c++) {
          const cz = -roofDepth * 0.45 + (c / (numCols - 1)) * (roofDepth * 0.9);
          const tileMat = (r + c) % 3 === 0 ? this._materials.roofTileAlt : this._materials.roofTileMain;
          const tile = new THREE.Mesh(tileGeo, tileMat);
          tile.position.set(rx, ry, cz);
          tile.scale.set(1.0, 0.58, 1.05);
          slopePivot.add(tile);
        }
      }
    }

    const ridgeGeo = new THREE.CylinderGeometry(0.16, 0.16, roofDepth + 0.08, 14);
    ridgeGeo.rotateX(Math.PI / 2);
    const ridgeCap = new THREE.Mesh(ridgeGeo, this._materials.roofTileMain);
    ridgeCap.position.set(0, 1.62, 0);
    roofGroup.add(ridgeCap);

    // Cozy brick chimney on left-rear roof slope
    const chimneyGroup = new THREE.Group();
    chimneyGroup.position.set(-1.15, 3.45, -0.65);
    const chimneyBody = new THREE.Mesh(
      createRoundedBoxGeometry(0.56, 0.95, 0.56, 0.04, 2),
      this._materials.roofTileMain
    );
    chimneyGroup.add(chimneyBody);
    const chimneyRim = new THREE.Mesh(
      createRoundedBoxGeometry(0.66, 0.14, 0.66, 0.04, 2),
      this._materials.stoopStone
    );
    chimneyRim.position.y = 0.46;
    chimneyGroup.add(chimneyRim);
    const chimneyPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.19, 0.26, 14),
      this._materials.timberWood
    );
    chimneyPot.position.y = 0.62;
    chimneyGroup.add(chimneyPot);
    group.add(chimneyGroup);

    // 5. Iconic Rounded-Arch Red Wooden Front Door (#d64c3b) inside hollow curved timber arch frame
    //    (Hollow arch cutout + stepped Z planes eliminate any coplanar z-fighting between arch, slab, trim, and glass)
    const doorGroup = new THREE.Group();
    doorGroup.position.set(0, 0.36, wallD * 0.5 + 0.02);
    group.add(doorGroup);

    const createArchShape = (w, rectH, archR, innerHole = null) => {
      const s = new THREE.Shape();
      s.moveTo(-w * 0.5, 0);
      s.lineTo(w * 0.5, 0);
      s.lineTo(w * 0.5, rectH);
      s.absarc(0, rectH, archR, 0, Math.PI, false);
      s.lineTo(-w * 0.5, 0);
      if (innerHole) {
        const hw = innerHole.w * 0.5;
        const hole = new THREE.Path();
        hole.moveTo(-hw, 0.02);
        hole.lineTo(-hw, innerHole.rectH);
        hole.absarc(0, innerHole.rectH, innerHole.archR, Math.PI, 0, true);
        hole.lineTo(hw, 0.02);
        hole.lineTo(-hw, 0.02);
        s.holes.push(hole);
      }
      return s;
    };

    // Hollow timber arch frame: front face at z = -0.04 + 0.14 + 0.035 = +0.135 (and hollow behind the door slab)
    const outerArchGeo = new THREE.ExtrudeGeometry(
      createArchShape(1.56, 1.38, 0.78, { w: 1.16, rectH: 1.30, archR: 0.58 }),
      {
        depth: 0.14,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.035,
        bevelThickness: 0.035,
        curveSegments: 24,
      }
    );
    const outerArch = new THREE.Mesh(outerArchGeo, this._materials.timberWood);
    outerArch.position.set(0, 0, -0.04);
    doorGroup.add(outerArch);

    // Red wooden door slab: back at z = +0.02, front face at z = 0.05 + 0.12 + 0.03 = +0.200 (6.5cm proud of outerArch)
    const doorSlabGeo = new THREE.ExtrudeGeometry(createArchShape(1.24, 1.32, 0.62), {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03,
      curveSegments: 24,
    });
    const doorSlab = new THREE.Mesh(doorSlabGeo, this._materials.cottageDoorRed);
    doorSlab.position.set(0, 0.02, 0.05);
    doorGroup.add(doorSlab);

    // Lower door raised panel: back at z = +0.205, front face at z = +0.245 (4.5cm proud of doorSlab)
    const panelFrameGeo = createRoundedBoxGeometry(0.86, 0.56, 0.04, 0.018, 2);
    const panelFrame = new THREE.Mesh(panelFrameGeo, this._materials.cottageDoorRed);
    panelFrame.position.set(0, 0.52, 0.225);
    doorGroup.add(panelFrame);

    // 4-pane arched/circular glass window inside upper door: front face at z = 0.205 + 0.03 + 0.012 = +0.247
    const windowGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x3b2c28,
      emissive: new THREE.Color(0xffb84d),
      emissiveIntensity: 0.35,
      roughness: 0.2,
      clearcoat: 0.8,
    });
    this.cottageGlowMaterials.push(windowGlassMat);

    const winArchGeo = new THREE.ExtrudeGeometry(createArchShape(0.68, 0.34, 0.34), {
      depth: 0.03,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      curveSegments: 18,
    });
    const winGlass = new THREE.Mesh(winArchGeo, windowGlassMat);
    winGlass.position.set(0, 1.12, 0.205);
    doorGroup.add(winGlass);

    // 4-pane window muntin crossbars (+) — staggered in Z so vBar and hBar never z-fight at their intersection
    const vBar = new THREE.Mesh(
      createRoundedBoxGeometry(0.068, 0.68, 0.036, 0.012, 2),
      this._materials.cottageDoorRed
    );
    vBar.position.set(0, 1.45, 0.262);
    doorGroup.add(vBar);

    const hBar = new THREE.Mesh(
      createRoundedBoxGeometry(0.68, 0.068, 0.042, 0.012, 2),
      this._materials.cottageDoorRed
    );
    hBar.position.set(0, 1.43, 0.266);
    doorGroup.add(hBar);

    // Round brass doorknob on the left (matching ref_02)
    const knobBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.075, 0.04, 14),
      this._materials.brass
    );
    knobBase.rotation.x = Math.PI / 2;
    knobBase.position.set(-0.44, 0.96, 0.22);
    doorGroup.add(knobBase);

    const knobBall = new THREE.Mesh(new THREE.SphereGeometry(0.078, 16, 14), this._materials.brass);
    knobBall.position.set(-0.44, 0.96, 0.275);
    doorGroup.add(knobBall);

    // Warm side windows on left & right cottage walls
    for (const side of [-1, 1]) {
      const sideWinGroup = new THREE.Group();
      sideWinGroup.position.set(side * (wallW * 0.5 + 0.03), 1.48, 0);
      sideWinGroup.rotation.y = side * (Math.PI / 2);

      const frame = new THREE.Mesh(
        createRoundedBoxGeometry(0.86, 0.86, 0.09, 0.03, 2),
        this._materials.timberWood
      );
      sideWinGroup.add(frame);

      const glass = new THREE.Mesh(
        createRoundedBoxGeometry(0.68, 0.68, 0.05, 0.018, 2),
        windowGlassMat
      );
      glass.position.z = 0.055;
      sideWinGroup.add(glass);

      const sill = new THREE.Mesh(
        createRoundedBoxGeometry(0.98, 0.1, 0.18, 0.025, 2),
        this._materials.timberWood
      );
      sill.position.set(0, -0.45, 0.055);
      sideWinGroup.add(sill);

      group.add(sideWinGroup);
    }

    // 6. Flanking lush rounded camellia/holly bushes tucked against left & right walls (ref_02)
    this._buildLushRoundBush(group, -2.35, 0.0, 0.85, 1.05);
    this._buildLushRoundBush(group, -2.42, 0.0, -0.35, 0.92);
    this._buildLushRoundBush(group, 2.35, 0.0, 0.85, 1.05);
    this._buildLushRoundBush(group, 2.42, 0.0, -0.35, 0.92);

    parentGroup.add(group);
    this._registerCollider(x, z, 2.25, { type: 'house', name: 'Player Cottage' });
    this._registerInteractable({
      id: 'player_cottage_door',
      type: 'door',
      label: 'Cozy Cottage',
      x,
      y: groundY,
      z: z + 2.1,
      radius: 1.4,
      mesh: group,
    });
  }

  _buildLushRoundBush(parentGroup, lx, ly, lz, scale = 1.0) {
    const bush = new THREE.Group();
    bush.position.set(lx, ly, lz);
    bush.scale.setScalar(scale);

    const puffs = [
      { x: 0.0, y: 0.44, z: 0.0, r: 0.48, light: false },
      { x: -0.22, y: 0.34, z: 0.2, r: 0.36, light: true },
      { x: 0.24, y: 0.35, z: 0.18, r: 0.36, light: true },
      { x: 0.0, y: 0.62, z: 0.06, r: 0.35, light: true },
      { x: -0.18, y: 0.42, z: -0.2, r: 0.34, light: false },
      { x: 0.2, y: 0.4, z: -0.18, r: 0.34, light: false },
    ];

    const sphereGeo = new THREE.SphereGeometry(1.0, 14, 12);
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      const mat = p.light ? this._materials.bushLeafLight : this._materials.bushLeafMain;
      const m = new THREE.Mesh(sphereGeo, mat);
      m.position.set(p.x, p.y, p.z);
      m.scale.set(p.r, p.r * 0.92, p.r);
      bush.add(m);
    }

    parentGroup.add(bush);
  }

  _buildRedMailbox(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'RedMailbox';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 0.42, 0.42, 0.36, 0.015);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.075, 0.88, 14),
      this._materials.mailboxRed
    );
    post.position.y = 0.44;
    group.add(post);

    const boxLower = new THREE.Mesh(
      createRoundedBoxGeometry(0.46, 0.24, 0.58, 0.035, 3),
      this._materials.mailboxRed
    );
    boxLower.position.set(0, 0.94, 0);
    group.add(boxLower);

    const boxVaultGeo = new THREE.CylinderGeometry(0.228, 0.228, 0.56, 16);
    boxVaultGeo.rotateX(Math.PI / 2);
    const boxVault = new THREE.Mesh(boxVaultGeo, this._materials.mailboxRed);
    boxVault.position.set(0, 1.06, 0);
    group.add(boxVault);

    const hood = new THREE.Mesh(
      createRoundedBoxGeometry(0.36, 0.07, 0.08, 0.02, 2),
      this._materials.mailboxRed
    );
    hood.position.set(0, 1.05, 0.305);
    group.add(hood);

    const slotMat = new THREE.MeshPhysicalMaterial({ color: 0x3b1210, roughness: 0.8 });
    const slot = new THREE.Mesh(createRoundedBoxGeometry(0.3, 0.04, 0.04, 0.01, 2), slotMat);
    slot.position.set(0, 1.01, 0.312);
    group.add(slot);

    const flagPivot = new THREE.Group();
    flagPivot.position.set(0.24, 0.96, 0.08);
    const flagStem = new THREE.Mesh(
      createRoundedBoxGeometry(0.03, 0.24, 0.035, 0.01, 2),
      this._materials.brass
    );
    flagStem.position.y = 0.11;
    flagPivot.add(flagStem);
    const flagTip = new THREE.Mesh(
      createRoundedBoxGeometry(0.035, 0.08, 0.11, 0.015, 2),
      this._materials.cottageStucco
    );
    flagTip.position.set(0, 0.21, 0.035);
    flagPivot.add(flagTip);
    group.add(flagPivot);
    this.mailboxFlags.push(flagPivot);

    parentGroup.add(group);
    this._registerCollider(x, z, 0.35, { type: 'mailbox', name: 'Red Mailbox' });
    this._registerInteractable({
      id: 'cottage_mailbox',
      type: 'mailbox',
      label: 'Mailbox',
      x,
      y: groundY,
      z,
      radius: 1.1,
      mesh: group,
    });
  }

  // ============================================================================
  // 2. ICONIC YELLOW TRIANGULAR CANVAS TENT & DROPPED ITEMS (ref_04)
  // ============================================================================

  _buildYellowTent(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'YellowCanvasTent';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 2.55, 2.55, 0.4, 0.014);

    const tarpTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#c6a87b';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(155, 124, 82, 0.28)';
      ctx.lineWidth = 2;
      for (let i = 0; i < w; i += 8) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
      }
      ctx.strokeStyle = '#a8895c';
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, w - 16, h - 16);
    });

    const tarpMat = new THREE.MeshPhysicalMaterial({
      map: tarpTex,
      color: 0xc6a87b,
      roughness: 0.78,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xffe7c2),
    });

    const tarp = new THREE.Mesh(createRoundedBoxGeometry(3.85, 0.05, 4.05, 0.02, 2), tarpMat);
    tarp.position.set(0, 0.028, 0.05);
    group.add(tarp);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cornerFold = new THREE.Mesh(
          createRoundedBoxGeometry(0.42, 0.055, 0.42, 0.02, 2),
          tarpMat
        );
        cornerFold.position.set(sx * 1.76, 0.04, sz * 1.84 + 0.05);
        cornerFold.rotation.y = sx * sz * 0.25;
        group.add(cornerFold);
      }
    }

    const tentCanvasMat = new THREE.MeshPhysicalMaterial({
      color: 0xfae038,
      roughness: 0.52,
      transmission: 0.18,
      thickness: 0.35,
      sheen: 0.65,
      sheenColor: new THREE.Color(0xfff59e),
    });

    const tentFrontMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4ce24,
      roughness: 0.56,
      transmission: 0.14,
      sheen: 0.6,
      sheenColor: new THREE.Color(0xfff18a),
    });

    const tentFlapMat = new THREE.MeshPhysicalMaterial({
      color: 0xebb916,
      roughness: 0.58,
      sheen: 0.55,
    });

    const tentW = 3.25;
    const tentH = 2.62;
    const tentD = 3.45;
    const wallKneeH = 0.38;

    const tentShape = new THREE.Shape();
    tentShape.moveTo(-tentW * 0.5, 0);
    tentShape.lineTo(tentW * 0.5, 0);
    tentShape.lineTo(tentW * 0.5, wallKneeH);
    tentShape.lineTo(0, tentH);
    tentShape.lineTo(-tentW * 0.5, wallKneeH);
    tentShape.closePath();

    const tentBodyGeo = new THREE.ExtrudeGeometry(tentShape, {
      depth: tentD,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.045,
      bevelThickness: 0.045,
    });
    tentBodyGeo.translate(0, 0, -tentD * 0.5);
    tentBodyGeo.computeVertexNormals();

    const tentBody = new THREE.Mesh(tentBodyGeo, tentCanvasMat);
    tentBody.position.set(0, 0.05, 0);
    group.add(tentBody);

    const slopeAngle = Math.atan2(tentH - wallKneeH, tentW * 0.5);
    const slopeLen = Math.hypot(tentW * 0.5 + 0.12, tentH - wallKneeH + 0.08);
    for (const side of [-1, 1]) {
      const eavePanel = new THREE.Mesh(
        createRoundedBoxGeometry(slopeLen, 0.06, tentD + 0.16, 0.025, 2),
        tentCanvasMat
      );
      eavePanel.position.set(
        side * (tentW * 0.25 + 0.03),
        wallKneeH + (tentH - wallKneeH) * 0.5 + 0.06,
        0
      );
      eavePanel.rotation.z = -side * slopeAngle;
      group.add(eavePanel);
    }

    const doorFlapGeo = createRoundedBoxGeometry(1.18, 1.68, 0.08, 0.025, 2);
    const doorFlap = new THREE.Mesh(doorFlapGeo, tentFlapMat);
    doorFlap.position.set(0, 0.89, tentD * 0.5 + 0.065);
    group.add(doorFlap);

    const doorSeam = new THREE.Mesh(
      createRoundedBoxGeometry(0.035, 1.66, 0.095, 0.01, 2),
      tentFrontMat
    );
    doorSeam.position.set(0, 0.89, tentD * 0.5 + 0.10);
    group.add(doorSeam);

    const ridgePoleGeo = new THREE.CylinderGeometry(0.055, 0.055, tentD + 0.34, 12);
    ridgePoleGeo.rotateX(Math.PI / 2);
    const ridgePole = new THREE.Mesh(ridgePoleGeo, this._materials.mediumWood);
    ridgePole.position.set(0, tentH + 0.05, 0);
    group.add(ridgePole);

    const ropeMat = new THREE.MeshPhysicalMaterial({
      color: 0xeae2ce,
      roughness: 0.75,
    });

    for (const side of [-1, 1]) {
      for (const zOff of [-0.95, 0.95]) {
        const start = new THREE.Vector3(side * (tentW * 0.5 + 0.04), wallKneeH + 0.16, zOff);
        const end = new THREE.Vector3(side * (tentW * 0.5 + 0.62), 0.08, zOff);
        const dir = new THREE.Vector3().subVectors(end, start);
        const len = dir.length();

        const ropeGeo = new THREE.CylinderGeometry(0.014, 0.014, len, 8);
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.position.copy(start).addScaledVector(dir, 0.5);
        rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        group.add(rope);

        const pegGroup = new THREE.Group();
        pegGroup.position.set(end.x, 0.0, end.z);
        pegGroup.rotation.z = side * 0.35;

        const pegShaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.048, 0.028, 0.26, 10),
          this._materials.pineWood
        );
        pegShaft.position.y = 0.1;
        pegGroup.add(pegShaft);

        const pegBand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.052, 0.052, 0.045, 10),
          this._materials.cottageDoorRed
        );
        pegBand.position.y = 0.17;
        pegGroup.add(pegBand);

        group.add(pegGroup);
      }
    }

    parentGroup.add(group);
    this._registerCollider(x, z, 2.0, { type: 'tent', name: 'Yellow Canvas Tent' });
    this._registerInteractable({
      id: 'yellow_tent',
      type: 'tent',
      label: 'Camping Tent',
      x,
      y: groundY,
      z: z + 1.9,
      radius: 1.4,
      mesh: group,
    });
  }

  _buildWoodenPostMailbox(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'RusticWoodenMailbox';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 0.4, 0.4, 0.35, 0.015);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 0.78, 12),
      this._materials.mediumWood
    );
    post.position.y = 0.39;
    group.add(post);

    const boxBody = new THREE.Mesh(
      createRoundedBoxGeometry(0.48, 0.34, 0.36, 0.03, 3),
      this._materials.pineWood
    );
    boxBody.position.set(0, 0.88, 0);
    group.add(boxBody);

    const boxRoof = new THREE.Mesh(
      createRoundedBoxGeometry(0.54, 0.07, 0.42, 0.025, 2),
      this._materials.mediumWood
    );
    boxRoof.position.set(0, 1.07, 0);
    group.add(boxRoof);

    const slot = new THREE.Mesh(
      createRoundedBoxGeometry(0.32, 0.045, 0.04, 0.01, 2),
      this._materials.darkWalnutWood
    );
    slot.position.set(0, 0.94, 0.18);
    group.add(slot);

    const flagMat = new THREE.MeshPhysicalMaterial({ color: 0x5c85b8, roughness: 0.45 });
    const flag = new THREE.Mesh(createRoundedBoxGeometry(0.03, 0.18, 0.07, 0.01, 2), flagMat);
    flag.position.set(-0.26, 0.94, 0.05);
    group.add(flag);

    parentGroup.add(group);
    this._registerCollider(x, z, 0.32, { type: 'mailbox', name: 'Wooden Mailbox' });
  }

  _buildDroppedTentGroundItems(parentGroup = this.root) {
    // Plump glossy red apples arranged in the clearing (matching ref_04_yellow_tent_horizon.jpg)
    const appleCoords = [
      { x: 7.05, z: -7.4 },
      { x: 7.95, z: -7.4 },
      { x: 8.85, z: -7.4 },
      { x: 7.95, z: -7.95 },
    ];
    for (let i = 0; i < appleCoords.length; i++) {
      this._buildDroppedApple(appleCoords[i].x, appleCoords[i].z, parentGroup);
    }

    // Tan drawstring Bell / nursery sapling bags with green leaf tufts sticking out of tied necks (ref_04)
    const bagCoords = [
      { x: 7.05, z: -8.5 },
      { x: 7.95, z: -8.5 },
      { x: 8.85, z: -8.5 },
      { x: 8.85, z: -7.95 },
    ];
    for (let i = 0; i < bagCoords.length; i++) {
      this._buildDroppedSaplingBag(bagCoords[i].x, bagCoords[i].z, parentGroup);
    }
  }

  _buildDroppedApple(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 0.3, 0.3, 0.38, 0.014);

    const appleMat = new THREE.MeshPhysicalMaterial({
      color: 0xd9261e,
      roughness: 0.22,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xff9e88),
    });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 16), appleMat);
    body.scale.set(1.06, 0.94, 1.06);
    body.position.y = 0.21;
    group.add(body);

    const dimpleMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4b642,
      roughness: 0.35,
      clearcoat: 0.4,
    });
    const dimple = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.025, 8, 14), dimpleMat);
    dimple.rotation.x = Math.PI / 2;
    dimple.position.y = 0.39;
    group.add(dimple);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.024, 0.11, 8),
      this._materials.darkWalnutWood
    );
    stem.position.set(0, 0.44, 0);
    stem.rotation.z = 0.18;
    group.add(stem);

    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), this._materials.bushLeafLight);
    leaf.scale.set(1.4, 0.35, 0.75);
    leaf.position.set(0.055, 0.45, 0);
    leaf.rotation.z = 0.35;
    group.add(leaf);

    parentGroup.add(group);
  }

  _buildDroppedSaplingBag(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 0.3, 0.3, 0.38, 0.014);

    const pouchMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4aa72,
      roughness: 0.76,
      sheen: 0.4,
      sheenColor: new THREE.Color(0xffe5bd),
    });

    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), pouchMat);
    pouch.scale.set(1.06, 0.92, 1.06);
    pouch.position.y = 0.19;
    group.add(pouch);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.105, 0.026, 8, 16),
      this._materials.timberWood
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.35;
    group.add(collar);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.095, 0.085, 12), pouchMat);
    rim.position.y = 0.39;
    group.add(rim);

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.2, 7),
        this._materials.bushLeafLight
      );
      blade.position.set(Math.cos(angle) * 0.055, 0.49, Math.sin(angle) * 0.055);
      blade.rotation.z = -Math.cos(angle) * 0.32;
      blade.rotation.x = Math.sin(angle) * 0.32;
      group.add(blade);
    }

    parentGroup.add(group);
  }

  // ============================================================================
  // 3. STONE ARCH BRIDGE & PLAZA MARBLE FOUNTAIN (ref_05)
  // ============================================================================

  _buildStoneArchBridge(x, z, rotY = Math.PI / 2, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'StoneArchBridge';
    const baseGroundY = 0.55;
    group.position.set(x, baseGroundY, z);
    group.rotation.y = rotY;

    const bridgeW = 2.9;
    const spanZ = 5.6;
    const numSegments = 16;
    const archPeakY = 0.68;

    for (let i = 0; i < numSegments; i++) {
      const t0 = i / numSegments;
      const t1 = (i + 1) / numSegments;
      const tm = (t0 + t1) * 0.5;
      const zPos = (tm - 0.5) * spanZ;
      const archY = Math.sin(tm * Math.PI) * archPeakY;
      const dYdZ = ((Math.PI * archPeakY) / spanZ) * Math.cos(tm * Math.PI);
      const pitch = -Math.atan(dYdZ);

      const segLen = spanZ / numSegments + 0.05;
      const deckSeg = new THREE.Mesh(
        createRoundedBoxGeometry(bridgeW, 0.22, segLen, 0.03, 2),
        this._materials.stoopStone
      );
      deckSeg.position.set(0, archY, zPos);
      deckSeg.rotation.x = pitch;
      group.add(deckSeg);

      for (const side of [-1, 1]) {
        const wallSeg = new THREE.Mesh(
          createRoundedBoxGeometry(0.26, 0.58, segLen, 0.03, 2),
          this._materials.foundationStone
        );
        wallSeg.position.set(side * (bridgeW * 0.5 - 0.14), archY + 0.32, zPos);
        wallSeg.rotation.x = pitch;
        group.add(wallSeg);

        const capSeg = new THREE.Mesh(
          createRoundedBoxGeometry(0.34, 0.11, segLen + 0.02, 0.03, 2),
          this._materials.marbleStone
        );
        capSeg.position.set(side * (bridgeW * 0.5 - 0.14), archY + 0.63, zPos);
        capSeg.rotation.x = pitch;
        group.add(capSeg);

        const voussoir = new THREE.Mesh(
          createRoundedBoxGeometry(0.32, 0.26, segLen * 0.92, 0.025, 2),
          this._materials.foundationStone
        );
        voussoir.position.set(side * (bridgeW * 0.5 - 0.14), archY - 0.12, zPos);
        voussoir.rotation.x = pitch;
        group.add(voussoir);
      }
    }

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pillar = new THREE.Mesh(
          createRoundedBoxGeometry(0.44, 0.82, 0.44, 0.04, 3),
          this._materials.foundationStone
        );
        pillar.position.set(sx * (bridgeW * 0.5 - 0.14), 0.32, sz * (spanZ * 0.5 - 0.15));
        group.add(pillar);

        const cap = new THREE.Mesh(
          createRoundedBoxGeometry(0.52, 0.12, 0.52, 0.035, 3),
          this._materials.marbleStone
        );
        cap.position.set(sx * (bridgeW * 0.5 - 0.14), 0.76, sz * (spanZ * 0.5 - 0.15));
        group.add(cap);
      }
    }

    parentGroup.add(group);
  }

  _buildPlazaFountainAndFences(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'PlazaMarbleFountain';
    const groundY = 0.6;
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 2.35, 2.35, 0.4, 0.014);

    const plazaPad = new THREE.Mesh(
      new THREE.CylinderGeometry(2.65, 2.75, 0.08, 28),
      this._materials.marbleStone
    );
    plazaPad.position.y = 0.04;
    group.add(plazaPad);

    const basinWall = new THREE.Mesh(
      new THREE.CylinderGeometry(1.72, 1.64, 0.52, 28),
      this._materials.foundationStone
    );
    basinWall.position.y = 0.3;
    group.add(basinWall);

    const basinRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.68, 0.12, 12, 32),
      this._materials.marbleStone
    );
    basinRim.rotation.x = Math.PI / 2;
    basinRim.position.y = 0.56;
    group.add(basinRim);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x6cd8f0,
      emissive: new THREE.Color(0x2890b8),
      emissiveIntensity: 0.25,
      roughness: 0.12,
      transmission: 0.55,
      clearcoat: 0.9,
    });
    const waterPool = new THREE.Mesh(new THREE.CylinderGeometry(1.56, 1.56, 0.08, 26), waterMat);
    waterPool.position.y = 0.5;
    group.add(waterPool);

    const lowerPedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.54, 0.65, 20),
      this._materials.marbleStone
    );
    lowerPedestal.position.y = 0.72;
    group.add(lowerPedestal);

    const midBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.86, 0.38, 0.24, 24),
      this._materials.marbleStone
    );
    midBowl.position.y = 1.08;
    group.add(midBowl);

    const midRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.84, 0.065, 10, 24),
      this._materials.marbleStone
    );
    midRim.rotation.x = Math.PI / 2;
    midRim.position.y = 1.19;
    group.add(midRim);

    const upperSpoutColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.26, 0.48, 16),
      this._materials.marbleStone
    );
    upperSpoutColumn.position.y = 1.38;
    group.add(upperSpoutColumn);

    const jetGroup = new THREE.Group();
    jetGroup.position.y = 0.52;
    group.add(jetGroup);

    const foamMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2fbff,
      emissive: new THREE.Color(0xbbeeff),
      emissiveIntensity: 0.38,
      transparent: true,
      opacity: 0.86,
      roughness: 0.2,
    });

    const topPlume = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 16, 1, true), foamMat);
    topPlume.position.y = 1.32;
    topPlume.rotation.x = Math.PI;
    topPlume.userData.noShadow = true;
    jetGroup.add(topPlume);

    const cascadeCurtain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.84, 1.08, 0.68, 20, 1, true),
      foamMat
    );
    cascadeCurtain.position.y = 0.34;
    cascadeCurtain.userData.noShadow = true;
    jetGroup.add(cascadeCurtain);

    const foamRing = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.07, 8, 24), foamMat);
    foamRing.rotation.x = Math.PI / 2;
    foamRing.position.y = 0.04;
    foamRing.userData.noShadow = true;
    jetGroup.add(foamRing);

    this.animatedFountains.push({
      topPlume,
      cascadeCurtain,
      foamRing,
    });

    // White picket fence sections flanking the plaza (matching ref_05)
    const whiteFenceMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4f6fa,
      roughness: 0.48,
      clearcoat: 0.2,
      sheen: 0.25,
    });

    for (const side of [-1, 1]) {
      const fenceGroup = new THREE.Group();
      fenceGroup.position.set(side * 3.65, 0, 0.35);

      const spanW = 3.1;
      for (const ry of [0.32, 0.68]) {
        const rail = new THREE.Mesh(
          createRoundedBoxGeometry(spanW, 0.08, 0.07, 0.02, 2),
          whiteFenceMat
        );
        rail.position.y = ry;
        fenceGroup.add(rail);
      }

      const numPickets = 9;
      for (let i = 0; i < numPickets; i++) {
        const px = -spanW * 0.5 + (i / (numPickets - 1)) * spanW;
        const isPost = i === 0 || i === numPickets - 1 || i === 4;
        const picket = new THREE.Mesh(
          createRoundedBoxGeometry(
            isPost ? 0.14 : 0.095,
            isPost ? 0.96 : 0.86,
            isPost ? 0.14 : 0.06,
            0.025,
            2
          ),
          whiteFenceMat
        );
        picket.position.set(px, isPost ? 0.48 : 0.43, 0);
        fenceGroup.add(picket);
      }

      group.add(fenceGroup);
    }

    parentGroup.add(group);
    this._registerCollider(x, z, 1.85, { type: 'fountain', name: 'Plaza Marble Fountain' });
  }

  // ============================================================================
  // 4. HOUSE YARD & DIY CRAFTING PROPS (ref_02 & ref_03)
  // ============================================================================

  _buildWoodenSwingBench(x, z, rotY = 0, id = 'swing_bench', parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = `WoodenSwingBench_${id}`;
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);
    group.rotation.y = rotY;

    this._addContactShadow(group, 1.35, 0.78, 0.36, 0.015);

    const frameW = 2.18;
    const frameH = 1.92;
    const legSpreadZ = 0.92;

    const legLen = Math.hypot(frameH, legSpreadZ * 0.5);
    const legAngle = Math.atan2(legSpreadZ * 0.5, frameH);
    const legGeo = new THREE.CylinderGeometry(0.058, 0.065, legLen, 12);

    for (const side of [-1, 1]) {
      const sx = side * (frameW * 0.5 - 0.12);
      for (const fb of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, this._materials.pineWood);
        leg.position.set(sx, frameH * 0.5, fb * legSpreadZ * 0.25);
        leg.rotation.x = -fb * legAngle;
        group.add(leg);
      }

      const tieBar = new THREE.Mesh(
        createRoundedBoxGeometry(0.09, 0.09, legSpreadZ * 0.82, 0.025, 2),
        this._materials.pineWood
      );
      tieBar.position.set(sx, 0.32, 0);
      group.add(tieBar);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.14, 12),
        this._materials.pineWood
      );
      cap.position.set(sx, frameH + 0.02, 0);
      group.add(cap);
    }

    const topBeamGeo = new THREE.CylinderGeometry(0.065, 0.065, frameW + 0.16, 14);
    topBeamGeo.rotateZ(Math.PI / 2);
    const topBeam = new THREE.Mesh(topBeamGeo, this._materials.pineWood);
    topBeam.position.set(0, frameH - 0.04, 0);
    group.add(topBeam);

    const swingPivot = new THREE.Group();
    swingPivot.position.set(0, frameH - 0.04, 0);
    group.add(swingPivot);

    const chainMat = new THREE.MeshPhysicalMaterial({
      color: 0x454952,
      roughness: 0.38,
      metalness: 0.78,
    });

    const benchW = 1.56;
    const dropY = -1.26;

    for (const side of [-1, 1]) {
      const cx = side * (benchW * 0.5 + 0.02);

      const bracket = new THREE.Mesh(
        createRoundedBoxGeometry(0.08, 0.12, 0.12, 0.02, 2),
        chainMat
      );
      bracket.position.set(cx, -0.04, 0);
      swingPivot.add(bracket);

      for (const cz of [-0.18, 0.18]) {
        const cStart = new THREE.Vector3(cx, -0.08, 0);
        const cEnd = new THREE.Vector3(cx, dropY + 0.24, cz);
        const dir = new THREE.Vector3().subVectors(cEnd, cStart);
        const chain = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, dir.length(), 8),
          chainMat
        );
        chain.position.copy(cStart).addScaledVector(dir, 0.5);
        chain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        swingPivot.add(chain);
      }

      const armRest = new THREE.Mesh(
        createRoundedBoxGeometry(0.09, 0.075, 0.52, 0.025, 2),
        this._materials.pineWood
      );
      armRest.position.set(cx, dropY + 0.24, 0.02);
      swingPivot.add(armRest);

      const armPost = new THREE.Mesh(
        createRoundedBoxGeometry(0.08, 0.24, 0.08, 0.02, 2),
        this._materials.pineWood
      );
      armPost.position.set(cx, dropY + 0.12, 0.18);
      swingPivot.add(armPost);
    }

    const seatFrame = new THREE.Mesh(
      createRoundedBoxGeometry(benchW + 0.08, 0.08, 0.5, 0.025, 2),
      this._materials.pineWood
    );
    seatFrame.position.set(0, dropY, 0.03);
    swingPivot.add(seatFrame);

    for (const by of [0.22, 0.42]) {
      const backSlat = new THREE.Mesh(
        createRoundedBoxGeometry(benchW + 0.06, 0.12, 0.065, 0.02, 2),
        this._materials.pineWood
      );
      backSlat.position.set(0, dropY + by, -0.2);
      swingPivot.add(backSlat);
    }

    for (const side of [-1, 1]) {
      const backStile = new THREE.Mesh(
        createRoundedBoxGeometry(0.085, 0.52, 0.08, 0.02, 2),
        this._materials.pineWood
      );
      backStile.position.set(side * (benchW * 0.5 - 0.04), dropY + 0.24, -0.2);
      swingPivot.add(backStile);
    }

    this.animatedSwingPivots.push({
      pivot: swingPivot,
      phase: x * 0.7 + z * 0.3,
    });

    parentGroup.add(group);
    this._registerCollider(x, z, 0.95, { type: 'furniture', name: 'Wooden Swing Bench' });
    this._registerInteractable({
      id,
      type: 'seat',
      label: 'Swinging Bench',
      x,
      y: groundY + 0.58,
      z,
      seatY: groundY + 0.58,
      facingY: rotY,
      radius: 1.35,
      mesh: group,
    });
  }

  _buildLogBenchWithCoffee(x, z, rotY = 0, parentGroup = this.root, withCoffee = true) {
    const group = new THREE.Group();
    group.name = 'LogBenchWithCoffee';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);
    group.rotation.y = rotY;

    this._addContactShadow(group, 1.15, 0.46, 0.38, 0.015);

    const legGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.54, 16);
    legGeo.rotateX(Math.PI / 2);
    for (const lx of [-0.56, 0.56]) {
      const leg = new THREE.Mesh(legGeo, [
        this._materials.mediumWood,
        this._materials.logEndRings,
        this._materials.logEndRings,
      ]);
      leg.position.set(lx, 0.16, 0);
      group.add(leg);
    }

    const seatSlab = new THREE.Mesh(
      createRoundedBoxGeometry(1.88, 0.22, 0.54, 0.08, 4),
      this._materials.cutLogSeat
    );
    seatSlab.position.set(0, 0.35, 0);
    group.add(seatSlab);

    if (withCoffee) {
      const cupGroup = new THREE.Group();
      cupGroup.position.set(0.54, 0.46, 0.02);

      const porcelainMat = new THREE.MeshPhysicalMaterial({
        color: 0xf8f9fc,
        roughness: 0.16,
        clearcoat: 0.9,
        clearcoatRoughness: 0.1,
      });

      const saucer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.11, 0.032, 20),
        porcelainMat
      );
      saucer.position.y = 0.016;
      cupGroup.add(saucer);

      const saucerRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.018, 10, 20),
        porcelainMat
      );
      saucerRim.rotation.x = Math.PI / 2;
      saucerRim.position.y = 0.028;
      cupGroup.add(saucerRim);

      const cupBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.068, 0.13, 20),
        porcelainMat
      );
      cupBody.position.y = 0.085;
      cupGroup.add(cupBody);

      const cupHandle = new THREE.Mesh(
        new THREE.TorusGeometry(0.042, 0.014, 8, 16),
        porcelainMat
      );
      cupHandle.position.set(0.088, 0.09, 0);
      cupGroup.add(cupHandle);

      const espressoMat = new THREE.MeshPhysicalMaterial({
        color: 0x331c10,
        roughness: 0.14,
        clearcoat: 0.95,
      });
      const coffeeSurface = new THREE.Mesh(
        new THREE.CylinderGeometry(0.078, 0.078, 0.015, 18),
        espressoMat
      );
      coffeeSurface.position.y = 0.145;
      cupGroup.add(coffeeSurface);

      group.add(cupGroup);
    }

    parentGroup.add(group);
    this._registerCollider(x, z, 0.85, { type: 'furniture', name: 'Log Bench' });
    this._registerInteractable({
      id: `log_bench_${Math.round(x * 10)}_${Math.round(z * 10)}`,
      type: 'seat',
      label: 'Log Bench',
      x: x - 0.25,
      y: groundY + 0.46,
      z,
      seatY: groundY + 0.46,
      facingY: rotY,
      radius: 1.2,
      mesh: group,
    });
  }

  _buildDIYWorkbench(x, z, rotY = -Math.PI / 2, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'DIYCarpentersWorkbench';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);
    group.rotation.y = rotY;

    this._addContactShadow(group, 1.15, 0.68, 0.4, 0.015);

    const benchW = 1.76;
    const benchD = 0.88;
    const tableY = 0.78;

    const legGeo = createRoundedBoxGeometry(0.12, tableY, 0.12, 0.03, 2);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, this._materials.pineWood);
        leg.position.set(sx * (benchW * 0.5 - 0.12), tableY * 0.5, sz * (benchD * 0.5 - 0.12));
        group.add(leg);
      }
    }

    const lowerShelf = new THREE.Mesh(
      createRoundedBoxGeometry(benchW - 0.16, 0.07, benchD - 0.16, 0.02, 2),
      this._materials.pineWood
    );
    lowerShelf.position.set(0, 0.22, 0);
    group.add(lowerShelf);

    const apron = new THREE.Mesh(
      createRoundedBoxGeometry(benchW - 0.14, 0.2, benchD - 0.14, 0.025, 2),
      this._materials.pineWood
    );
    apron.position.set(0, tableY - 0.14, 0);
    group.add(apron);

    const ironMat = new THREE.MeshPhysicalMaterial({
      color: 0x2b2e34,
      roughness: 0.42,
      metalness: 0.75,
    });

    for (const dx of [-0.42, 0.42]) {
      const pull = new THREE.Mesh(createRoundedBoxGeometry(0.16, 0.04, 0.04, 0.01, 2), ironMat);
      pull.position.set(dx, tableY - 0.14, benchD * 0.5 - 0.05);
      group.add(pull);
    }

    const tabletop = new THREE.Mesh(
      createRoundedBoxGeometry(benchW, 0.1, benchD, 0.035, 3),
      this._materials.pineWood
    );
    tabletop.position.set(0, tableY, 0);
    group.add(tabletop);

    const pegboardH = 0.74;
    const pegboard = new THREE.Mesh(
      createRoundedBoxGeometry(benchW, pegboardH, 0.1, 0.03, 2),
      this._materials.pineWood
    );
    pegboard.position.set(0, tableY + pegboardH * 0.5, -benchD * 0.5 + 0.06);
    group.add(pegboard);

    const topCap = new THREE.Mesh(
      createRoundedBoxGeometry(benchW + 0.04, 0.06, 0.16, 0.02, 2),
      this._materials.mediumWood
    );
    topCap.position.set(0, tableY + pegboardH + 0.02, -benchD * 0.5 + 0.06);
    group.add(topCap);

    const pegShelf = new THREE.Mesh(
      createRoundedBoxGeometry(0.75, 0.045, 0.16, 0.015, 2),
      this._materials.mediumWood
    );
    pegShelf.position.set(-0.36, tableY + 0.42, -benchD * 0.5 + 0.16);
    group.add(pegShelf);

    const canColors = [0x38984c, 0xf2c830, 0xd84034];
    for (let i = 0; i < canColors.length; i++) {
      const canMat = new THREE.MeshPhysicalMaterial({
        color: canColors[i],
        roughness: 0.3,
        clearcoat: 0.6,
      });
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.13, 12), canMat);
      can.position.set(-0.56 + i * 0.18, tableY + 0.5, -benchD * 0.5 + 0.16);
      group.add(can);
    }

    const pliersMat = new THREE.MeshPhysicalMaterial({ color: 0xd8382c, roughness: 0.4 });
    const pliers = new THREE.Mesh(createRoundedBoxGeometry(0.08, 0.24, 0.03, 0.01, 2), pliersMat);
    pliers.position.set(0.32, tableY + 0.36, -benchD * 0.5 + 0.13);
    pliers.rotation.z = 0.12;
    group.add(pliers);

    const topSurfaceY = tableY + 0.055;

    // 1. Wooden Carpenter's Mallet
    const malletGroup = new THREE.Group();
    malletGroup.position.set(-0.56, topSurfaceY + 0.06, -0.06);
    malletGroup.rotation.y = 0.58;
    const malletHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.24, 14),
      this._materials.mediumWood
    );
    malletHead.rotation.z = Math.PI / 2;
    malletGroup.add(malletHead);
    const malletHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.028, 0.38, 10),
      this._materials.pineWood
    );
    malletHandle.rotation.x = Math.PI / 2;
    malletHandle.position.set(0, -0.01, 0.2);
    malletGroup.add(malletHandle);
    group.add(malletGroup);

    // 2. Hand Saw / Coping Saw
    const sawGroup = new THREE.Group();
    sawGroup.position.set(-0.22, topSurfaceY + 0.028, 0.08);
    sawGroup.rotation.y = -0.12;
    const sawHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.025, 0.18, 10),
      this._materials.mediumWood
    );
    sawHandle.rotation.x = Math.PI / 2;
    sawHandle.position.set(0, 0, 0.18);
    sawGroup.add(sawHandle);

    const bladeMat = new THREE.MeshPhysicalMaterial({
      color: 0xaeb6c2,
      roughness: 0.28,
      metalness: 0.85,
    });
    const sawFrame = new THREE.Mesh(
      createRoundedBoxGeometry(0.16, 0.024, 0.32, 0.006, 2),
      bladeMat
    );
    sawFrame.position.set(0.04, 0, -0.04);
    sawGroup.add(sawFrame);
    group.add(sawGroup);

    // 3. Scattered black iron nails
    for (let n = 0; n < 4; n++) {
      const nail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.11, 6), ironMat);
      nail.rotation.x = Math.PI / 2;
      nail.rotation.z = 0.4 + n * 0.65;
      nail.position.set(-0.08 + (n % 2) * 0.12, topSurfaceY + 0.012, -0.05 + n * 0.06);
      group.add(nail);
    }

    // 4. Crisp White Blueprint Sheet with blue architectural lines (proud of tabletop bevel)
    const blueprintTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f2f6fc';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#3b629b';
      ctx.lineWidth = 4;
      ctx.strokeRect(16, 16, w - 32, h - 32);
      ctx.strokeRect(36, 40, 92, 76);
      ctx.strokeRect(142, 40, 74, 110);
      ctx.beginPath();
      ctx.moveTo(36, 150);
      ctx.lineTo(128, 150);
      ctx.moveTo(36, 178);
      ctx.lineTo(190, 178);
      ctx.stroke();
      ctx.fillStyle = '#d64538';
      ctx.fillRect(152, 188, 46, 16);
    });

    const blueprintMat = new THREE.MeshPhysicalMaterial({
      map: blueprintTex,
      roughness: 0.55,
      sheen: 0.2,
    });
    const blueprint = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.018, 0.46), blueprintMat);
    blueprint.position.set(0.44, topSurfaceY + 0.022, 0.1);
    blueprint.rotation.y = 0.05;
    group.add(blueprint);

    const scroll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.36, 14),
      blueprintMat
    );
    scroll.rotation.z = Math.PI / 2;
    scroll.position.set(0.54, topSurfaceY + 0.05, -0.22);
    group.add(scroll);

    parentGroup.add(group);
    this._registerCollider(x, z, 0.85, { type: 'workbench', name: 'DIY Workbench' });
    this._registerInteractable({
      id: 'diy_workbench',
      type: 'craft',
      label: 'DIY Workbench',
      x,
      y: groundY,
      z,
      radius: 1.4,
      mesh: group,
    });
  }

  _buildMetalFoldingTableAndChair(tableX, tableZ, chairX, chairZ, parentGroup = this.root) {
    // 1. Outdoor Metal Folding Table (matching bottom-center foreground of ref_02)
    const tableGroup = new THREE.Group();
    tableGroup.name = 'OutdoorMetalFoldingTable';
    const tableGroundY = this._getTerrainY(tableX, tableZ);
    tableGroup.position.set(tableX, tableGroundY, tableZ);

    this._addContactShadow(tableGroup, 0.72, 0.98, 0.38, 0.015);

    const tableW = 1.06;
    const tableD = 1.56;
    const tableH = 0.66;

    const tableTopTex = makeCanvasTexture(256, 384, (ctx, w, h) => {
      ctx.fillStyle = '#dcdfe6';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b4bac4';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);
      ctx.strokeStyle = '#8b929e';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(10, h * 0.5);
      ctx.lineTo(w - 10, h * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#252830';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 4;
      ctx.stroke();
    });

    const tableTopMat = new THREE.MeshPhysicalMaterial({
      map: tableTopTex,
      roughness: 0.38,
      metalness: 0.18,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
    });

    const metalLegMat = new THREE.MeshPhysicalMaterial({
      color: 0xbac2cc,
      roughness: 0.32,
      metalness: 0.75,
    });

    const topSlab = new THREE.Mesh(
      createRoundedBoxGeometry(tableW, 0.065, tableD, 0.03, 3),
      tableTopMat
    );
    topSlab.position.set(0, tableH, 0);
    tableGroup.add(topSlab);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.025, tableH, 10),
          metalLegMat
        );
        leg.position.set(sx * (tableW * 0.42), tableH * 0.5, sz * (tableD * 0.42));
        tableGroup.add(leg);
      }
    }

    parentGroup.add(tableGroup);
    this._registerCollider(tableX, tableZ, 0.78, { type: 'furniture', name: 'Outdoor Folding Table' });

    // 2. Director's Chair with white canvas seat & backrest (matching ref_02)
    const chairGroup = new THREE.Group();
    chairGroup.name = 'DirectorsChair';
    const chairGroundY = this._getTerrainY(chairX, chairZ);
    chairGroup.position.set(chairX, chairGroundY, chairZ);
    chairGroup.rotation.y = -Math.PI / 2;

    this._addContactShadow(chairGroup, 0.46, 0.46, 0.36, 0.015);

    const whiteCanvasMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4f5f8,
      roughness: 0.68,
      sheen: 0.45,
      sheenColor: new THREE.Color(0xffffff),
    });

    const cW = 0.58;
    const cD = 0.54;
    const seatH = 0.44;

    const scissorLen = Math.hypot(cD, seatH);
    const scissorAngle = Math.atan2(cD, seatH);
    for (const side of [-1, 1]) {
      for (const cross of [-1, 1]) {
        const leg = new THREE.Mesh(
          createRoundedBoxGeometry(0.048, scissorLen, 0.048, 0.012, 2),
          this._materials.timberWood
        );
        leg.position.set(side * (cW * 0.5), seatH * 0.5, 0);
        leg.rotation.x = cross * scissorAngle * 0.78;
        chairGroup.add(leg);
      }

      const rearPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.52, 10),
        this._materials.timberWood
      );
      rearPost.position.set(side * (cW * 0.5), seatH + 0.24, -cD * 0.42);
      chairGroup.add(rearPost);

      const frontPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.24, 10),
        this._materials.timberWood
      );
      frontPost.position.set(side * (cW * 0.5), seatH + 0.12, cD * 0.38);
      chairGroup.add(frontPost);

      const arm = new THREE.Mesh(
        createRoundedBoxGeometry(0.065, 0.042, cD * 0.92, 0.015, 2),
        this._materials.timberWood
      );
      arm.position.set(side * (cW * 0.5), seatH + 0.23, 0);
      chairGroup.add(arm);
    }

    const canvasSeat = new THREE.Mesh(
      createRoundedBoxGeometry(cW + 0.02, 0.045, cD * 0.88, 0.015, 2),
      whiteCanvasMat
    );
    canvasSeat.position.set(0, seatH, 0);
    chairGroup.add(canvasSeat);

    const canvasBack = new THREE.Mesh(
      createRoundedBoxGeometry(cW + 0.04, 0.22, 0.045, 0.015, 2),
      whiteCanvasMat
    );
    canvasBack.position.set(0, seatH + 0.36, -cD * 0.42);
    chairGroup.add(canvasBack);

    parentGroup.add(chairGroup);
    this._registerCollider(chairX, chairZ, 0.42, { type: 'furniture', name: 'Directors Chair' });
    this._registerInteractable({
      id: 'directors_chair',
      type: 'seat',
      label: "Director's Chair",
      x: chairX,
      y: chairGroundY + seatH,
      z: chairZ,
      seatY: chairGroundY + seatH,
      facingY: -Math.PI / 2,
      radius: 1.0,
      mesh: chairGroup,
    });
  }

  _buildRainbowHammock(x, z, rotY = 0, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'RainbowStripedHammock';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);
    group.rotation.y = rotY;

    this._addContactShadow(group, 1.35, 0.65, 0.38, 0.015);

    const spanX = 2.25;
    const widthZ = 0.82;

    for (const sz of [-1, 1]) {
      const skid = new THREE.Mesh(
        createRoundedBoxGeometry(spanX * 0.78, 0.07, 0.08, 0.02, 2),
        this._materials.darkWalnutWood
      );
      skid.position.set(0, 0.04, sz * (widthZ * 0.5));
      group.add(skid);
    }

    for (const sx of [-1, 1]) {
      const crossFoot = new THREE.Mesh(
        createRoundedBoxGeometry(0.08, 0.07, widthZ + 0.14, 0.02, 2),
        this._materials.darkWalnutWood
      );
      crossFoot.position.set(sx * (spanX * 0.38), 0.04, 0);
      group.add(crossFoot);

      for (const sz of [-1, 1]) {
        const strut = new THREE.Mesh(
          createRoundedBoxGeometry(0.07, 1.08, 0.07, 0.02, 2),
          this._materials.darkWalnutWood
        );
        strut.position.set(sx * (spanX * 0.44), 0.5, sz * (widthZ * 0.35));
        strut.rotation.z = -sx * 0.42;
        strut.rotation.x = sz * 0.18;
        group.add(strut);
      }

      const spreader = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, widthZ * 0.92, 10),
        this._materials.pineWood
      );
      spreader.rotation.x = Math.PI / 2;
      spreader.position.set(sx * 0.82, 0.78, 0);
      group.add(spreader);
    }

    const hammockTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
      const stripes = [
        '#e84c88', // vibrant pink
        '#fbe7d0', // cream
        '#f2ce48', // sunny yellow
        '#6cc2e2', // sky blue
        '#eb6854', // coral
        '#4ea8cf', // turquoise blue
        '#e84c88', // pink
      ];
      const sh = h / stripes.length;
      for (let i = 0; i < stripes.length; i++) {
        ctx.fillStyle = stripes[i];
        ctx.fillRect(0, i * sh, w, sh + 1);
      }
    });

    const hammockMat = new THREE.MeshPhysicalMaterial({
      map: hammockTex,
      roughness: 0.65,
      sheen: 0.55,
      sheenColor: new THREE.Color(0xfff5fa),
      side: THREE.DoubleSide,
    });

    const segsX = 20;
    const segsZ = 10;
    const slingGeo = new THREE.PlaneGeometry(1.64, 0.76, segsX, segsZ);
    slingGeo.rotateX(-Math.PI / 2);

    const posAttr = slingGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const nx = vx / 0.82;
      const nz = vz / 0.38;
      const sagX = (1.0 - nx * nx) * -0.28;
      const sagZ = (1.0 - nz * nz) * -0.06;
      posAttr.setY(i, 0.78 + sagX + sagZ);
    }
    slingGeo.computeVertexNormals();

    const slingMesh = new THREE.Mesh(slingGeo, hammockMat);
    group.add(slingMesh);

    parentGroup.add(group);
    this._registerCollider(x, z, 0.9, { type: 'furniture', name: 'Rainbow Hammock' });
  }

  _buildSteelDrumBoiler(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'SteelDrumWaterBoiler';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 0.62, 0.62, 0.42, 0.015);

    const cinderMat = new THREE.MeshPhysicalMaterial({
      color: 0x80848c,
      roughness: 0.84,
    });

    for (const sx of [-0.3, 0.3]) {
      const block = new THREE.Mesh(
        createRoundedBoxGeometry(0.22, 0.24, 0.58, 0.025, 2),
        cinderMat
      );
      block.position.set(sx, 0.12, 0);
      group.add(block);
    }

    const steelMat = new THREE.MeshPhysicalMaterial({
      color: 0x9aa0a8,
      roughness: 0.38,
      metalness: 0.68,
      clearcoat: 0.25,
    });

    const drumH = 1.02;
    const drumR = 0.36;
    const drumBody = new THREE.Mesh(
      new THREE.CylinderGeometry(drumR, drumR, drumH, 24),
      steelMat
    );
    drumBody.position.y = 0.24 + drumH * 0.5;
    group.add(drumBody);

    for (const ry of [0.28, 0.58, 0.92, 1.24]) {
      const hoop = new THREE.Mesh(
        new THREE.TorusGeometry(drumR + 0.012, 0.022, 10, 24),
        steelMat
      );
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = ry;
      group.add(hoop);
    }

    const waterTop = new THREE.Mesh(
      new THREE.CylinderGeometry(drumR - 0.03, drumR - 0.03, 0.02, 20),
      new THREE.MeshPhysicalMaterial({ color: 0x567a8a, roughness: 0.2, clearcoat: 0.8 })
    );
    waterTop.position.y = 1.24;
    group.add(waterTop);

    const fireGroup = new THREE.Group();
    fireGroup.position.set(0, 0.04, 0.05);
    group.add(fireGroup);

    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.045, 0.42, 8),
        this._materials.barkWood
      );
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i - 1.5) * 0.45;
      log.position.y = 0.04;
      fireGroup.add(log);
    }

    const flames = [];
    const flameColors = [0xff4500, 0xff8c1a, 0xffe042, 0xff6600];
    for (let i = 0; i < 4; i++) {
      const fMat = new THREE.MeshBasicMaterial({
        color: flameColors[i],
        transparent: true,
        opacity: 0.9,
      });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 10), fMat);
      flame.position.set((i - 1.5) * 0.085, 0.12, 0.06);
      flame.userData.noShadow = true;
      fireGroup.add(flame);
      flames.push(flame);
    }

    this.animatedCampfires.push({
      flames,
      light: null,
      baseIntensity: 0,
      phase: 2.1,
    });

    parentGroup.add(group);
    this._registerCollider(x, z, 0.48, { type: 'furniture', name: 'Steel Drum Boiler' });
  }

  _buildCarvedArrowSignpost(x, z, rotY = -0.15, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'CarvedWoodenArrowSignpost';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);
    group.rotation.y = rotY;

    this._addContactShadow(group, 0.44, 0.36, 0.36, 0.015);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.09, 0.96, 12),
      this._materials.timberWood
    );
    post.position.y = 0.48;
    group.add(post);

    const signShape = new THREE.Shape();
    signShape.moveTo(-0.48, 0.0);
    signShape.lineTo(-0.22, 0.22);
    signShape.lineTo(0.42, 0.22);
    signShape.lineTo(0.42, -0.22);
    signShape.lineTo(-0.22, -0.22);
    signShape.closePath();

    const signGeo = new THREE.ExtrudeGeometry(signShape, {
      depth: 0.07,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    signGeo.center();

    const signTex = makeCanvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#cf965a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#8b572a';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      ctx.fillStyle = '#5c3416';
      ctx.beginPath();
      ctx.moveTo(52, 62);
      ctx.lineTo(80, 34);
      ctx.lineTo(108, 62);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(60, 60, 40, 34);
      ctx.fillStyle = '#cf965a';
      ctx.fillRect(74, 72, 12, 22);

      ctx.strokeStyle = '#5c3416';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(124, 68);
      ctx.quadraticCurveTo(140, 48, 156, 68);
      ctx.quadraticCurveTo(172, 88, 188, 64);
      ctx.quadraticCurveTo(204, 46, 220, 68);
      ctx.stroke();
    });

    const signFaceMat = new THREE.MeshPhysicalMaterial({
      map: signTex,
      roughness: 0.62,
      sheen: 0.3,
    });

    const signPlank = new THREE.Mesh(signGeo, [signFaceMat, this._materials.mediumWood]);
    signPlank.position.set(-0.02, 0.66, 0.08);
    group.add(signPlank);

    const reliefMat = this._materials.darkWalnutWood;
    const roofRelief = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.08, 4), reliefMat);
    roofRelief.rotation.y = Math.PI / 4;
    roofRelief.scale.set(1.2, 1.0, 0.35);
    roofRelief.position.set(-0.16, 0.71, 0.14);
    group.add(roofRelief);

    const houseRelief = new THREE.Mesh(
      createRoundedBoxGeometry(0.11, 0.09, 0.025, 0.008, 2),
      reliefMat
    );
    houseRelief.position.set(-0.16, 0.63, 0.14);
    group.add(houseRelief);

    for (let i = 0; i < 3; i++) {
      const waveSeg = new THREE.Mesh(
        createRoundedBoxGeometry(0.09, 0.028, 0.025, 0.008, 2),
        reliefMat
      );
      waveSeg.position.set(0.05 + i * 0.09, 0.65 + (i % 2 === 0 ? 0.015 : -0.015), 0.14);
      waveSeg.rotation.z = i % 2 === 0 ? 0.38 : -0.38;
      group.add(waveSeg);
    }

    parentGroup.add(group);
    this._registerCollider(x, z, 0.35, { type: 'signpost', name: 'Wooden Arrow Signpost' });
  }

  _buildRiverbankStoolAndFirewood(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'RiverbankStoolAndFirewood';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 0.85, 0.55, 0.38, 0.015);

    const stoolGroup = new THREE.Group();
    stoolGroup.position.set(0.28, 0, 0.05);

    const seatTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.27, 0.08, 20),
      [this._materials.pineWood, this._materials.logEndRings, this._materials.pineWood]
    );
    seatTop.position.y = 0.44;
    stoolGroup.add(seatTop);

    const seatBevel = new THREE.Mesh(
      new THREE.TorusGeometry(0.265, 0.025, 10, 20),
      this._materials.pineWood
    );
    seatBevel.rotation.x = Math.PI / 2;
    seatBevel.position.y = 0.46;
    stoolGroup.add(seatBevel);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.03, 0.44, 10),
        this._materials.pineWood
      );
      leg.position.set(Math.cos(a) * 0.17, 0.22, Math.sin(a) * 0.17);
      leg.rotation.z = -Math.cos(a) * 0.14;
      leg.rotation.x = Math.sin(a) * 0.14;
      stoolGroup.add(leg);
    }
    group.add(stoolGroup);

    const woodPile = new THREE.Group();
    woodPile.position.set(-0.36, 0, -0.05);
    woodPile.rotation.y = 0.22;

    const logOffsets = [
      { x: -0.14, y: 0.09, r: 0.09 },
      { x: 0.04, y: 0.09, r: 0.09 },
      { x: 0.22, y: 0.09, r: 0.09 },
      { x: -0.05, y: 0.24, r: 0.085 },
      { x: 0.13, y: 0.24, r: 0.085 },
      { x: 0.04, y: 0.38, r: 0.08 },
    ];

    for (let i = 0; i < logOffsets.length; i++) {
      const lo = logOffsets[i];
      const fLog = new THREE.Mesh(
        new THREE.CylinderGeometry(lo.r, lo.r, 0.48, 12),
        [this._materials.barkWood, this._materials.logEndRings, this._materials.logEndRings]
      );
      fLog.rotation.x = Math.PI / 2;
      fLog.position.set(lo.x, lo.y, 0);
      woodPile.add(fLog);
    }
    group.add(woodPile);

    parentGroup.add(group);
    this._registerCollider(x, z, 0.55, { type: 'furniture', name: 'Wooden Stool & Firewood' });
    this._registerInteractable({
      id: 'riverbank_stool',
      type: 'seat',
      label: 'Wooden Stool',
      x: x + 0.28,
      y: groundY + 0.48,
      z: z + 0.05,
      seatY: groundY + 0.48,
      facingY: 0,
      radius: 1.0,
      mesh: stoolGroup,
    });
  }

  // ============================================================================
  // 5. BEACH & SUNSET CAMPFIRE PROPS (ref_01_beach_sunset.png & ref_05)
  // ============================================================================

  _buildBeachLogStumpSeat(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'BeachLogStumpSeat';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 0.48, 0.46, 0.42, 0.015);

    const targetTopWorldY = 0.62;
    const stumpH = Math.max(0.42, targetTopWorldY - groundY);
    const stumpR = 0.33;

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(stumpR * 0.95, stumpR * 1.04, stumpH + 0.04, 24),
      [this._materials.barkWood, this._materials.logEndRings, this._materials.barkWood]
    );
    trunk.position.y = stumpH * 0.5 - 0.02;
    group.add(trunk);

    const numFlutes = 14;
    for (let i = 0; i < numFlutes; i++) {
      const a = (i / numFlutes) * Math.PI * 2;
      const flute = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.048, stumpH, 8),
        this._materials.barkWood
      );
      flute.position.set(Math.cos(a) * (stumpR * 0.94), stumpH * 0.48, Math.sin(a) * (stumpR * 0.94));
      group.add(flute);
    }

    const topDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(stumpR * 0.91, stumpR * 0.94, 0.028, 24),
      this._materials.logEndRings
    );
    topDisc.position.y = stumpH - 0.01;
    group.add(topDisc);

    parentGroup.add(group);
    this._registerCollider(x, z, 0.36, { type: 'seat', name: 'Beach Log Stump' });
    this._registerInteractable({
      id: 'beach_log_stump',
      type: 'seat',
      label: 'Log Stump',
      x,
      y: 0.62,
      z,
      seatY: 0.62,
      facingY: 0,
      radius: 1.2,
      mesh: group,
    });
  }

  _buildCracklingCampfire(x, z, withPointLight = true, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'CracklingBeachCampfire';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 0.56, 0.56, 0.42, 0.015);

    const emberMat = new THREE.MeshPhysicalMaterial({
      color: 0xff3b00,
      emissive: new THREE.Color(0xff4800),
      emissiveIntensity: 1.2,
      roughness: 0.6,
    });
    const emberBed = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), emberMat);
    emberBed.scale.set(1.15, 0.42, 1.15);
    emberBed.position.y = 0.06;
    group.add(emberBed);

    const numLogs = 6;
    for (let i = 0; i < numLogs; i++) {
      const a = (i / numLogs) * Math.PI * 2 + 0.25;
      const logPivot = new THREE.Group();
      logPivot.rotation.y = a;

      const logMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.064, 0.54, 10),
        [this._materials.barkWood, this._materials.logEndRings, emberMat]
      );
      logMesh.position.set(0.14, 0.18, 0);
      logMesh.rotation.z = 0.62;
      logPivot.add(logMesh);
      group.add(logPivot);
    }

    const flameConfigs = [
      { color: 0xfff275, r: 0.13, h: 0.46, x: 0.0, z: 0.0, y: 0.24, opacity: 0.95 },
      { color: 0xff941a, r: 0.19, h: 0.58, x: -0.03, z: 0.02, y: 0.29, opacity: 0.88 },
      { color: 0xff5500, r: 0.22, h: 0.66, x: 0.03, z: -0.02, y: 0.32, opacity: 0.78 },
      { color: 0xff2a00, r: 0.16, h: 0.54, x: -0.06, z: -0.03, y: 0.34, opacity: 0.72 },
      { color: 0xffaa22, r: 0.12, h: 0.48, x: 0.06, z: 0.04, y: 0.28, opacity: 0.85 },
    ];

    const flames = [];
    for (let i = 0; i < flameConfigs.length; i++) {
      const fc = flameConfigs[i];
      const fMat = new THREE.MeshBasicMaterial({
        color: fc.color,
        transparent: true,
        opacity: fc.opacity,
        depthWrite: false,
      });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(fc.r, fc.h, 12), fMat);
      cone.position.set(fc.x, fc.y, fc.z);
      cone.userData.noShadow = true;
      cone.userData.baseX = fc.x;
      cone.userData.baseY = fc.y;
      cone.userData.baseZ = fc.z;
      group.add(cone);
      flames.push(cone);
    }

    let pointLight = null;
    if (withPointLight) {
      pointLight = new THREE.PointLight(0xff8a30, 1.85, 8.5, 1.8);
      pointLight.position.set(0, 0.58, 0);
      group.add(pointLight);
      this.campfireLight = pointLight;
    }

    this.animatedCampfires.push({
      flames,
      emberMat,
      light: pointLight,
      baseIntensity: 1.85,
      phase: x * 0.5,
    });

    parentGroup.add(group);
    this._registerCollider(x, z, 0.42, { type: 'campfire', name: 'Beach Campfire' });
    this._registerInteractable({
      id: `campfire_${Math.round(x * 10)}`,
      type: 'campfire',
      label: 'Campfire',
      x,
      y: groundY,
      z,
      radius: 1.2,
      mesh: group,
    });
  }

  _buildChevronBeachTowelAndSandals(towelX, towelZ, sandalsX, sandalsZ, parentGroup = this.root) {
    // 1. Chevron Woven Beach Towel (elevated safely above water plane on the left beach in ref_01)
    const towelGroup = new THREE.Group();
    towelGroup.name = 'ChevronWovenBeachTowel';
    const towelGroundY = Math.max(0.22, this._getTerrainY(towelX, towelZ));
    towelGroup.position.set(towelX, towelGroundY, towelZ);

    this._addContactShadow(towelGroup, 1.04, 0.58, 0.3, 0.01);

    const chevronTex = makeCanvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#24b4c8';
      ctx.fillRect(0, 0, w, h);

      const colors = ['#1b5fd6', '#26c2b8', '#f5d238', '#f07442', '#38a2e2', '#94e070'];
      const zigW = 32;
      const bandH = 26;

      for (let row = -2; row < h / bandH + 3; row++) {
        ctx.strokeStyle = colors[((row % colors.length) + colors.length) % colors.length];
        ctx.lineWidth = bandH * 0.78;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        const baseY = row * bandH;
        for (let col = 0; col <= w / zigW + 1; col++) {
          const px = col * zigW;
          const py = baseY + (col % 2 === 0 ? -14 : 14);
          if (col === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      ctx.fillStyle = '#1d7cb8';
      ctx.fillRect(0, 0, 14, h);
      ctx.fillRect(w - 14, 0, 14, h);
    });

    const towelMat = new THREE.MeshPhysicalMaterial({
      map: chevronTex,
      roughness: 0.74,
      sheen: 0.55,
      sheenColor: new THREE.Color(0xe6ffff),
    });

    const towelMesh = new THREE.Mesh(
      createRoundedBoxGeometry(1.88, 0.036, 0.98, 0.015, 2),
      towelMat
    );
    towelMesh.position.y = 0.025;
    towelGroup.add(towelMesh);

    parentGroup.add(towelGroup);

    // 2. Pair of cute orange slide sandals in front of the towel (ref_01)
    const sandalsGroup = new THREE.Group();
    sandalsGroup.name = 'OrangeSlideSandals';
    const sandalsGroundY = Math.max(0.22, this._getTerrainY(sandalsX, sandalsZ));
    sandalsGroup.position.set(sandalsX, sandalsGroundY, sandalsZ);

    this._addContactShadow(sandalsGroup, 0.24, 0.2, 0.3, 0.01);

    const soleMat = new THREE.MeshPhysicalMaterial({ color: 0x787c86, roughness: 0.65 });
    const strapMat = new THREE.MeshPhysicalMaterial({
      color: 0xf28c24,
      roughness: 0.42,
      clearcoat: 0.25,
    });

    for (const side of [-1, 1]) {
      const shoe = new THREE.Group();
      shoe.position.set(side * 0.1, 0.024, 0);
      shoe.rotation.y = side * -0.08;

      const sole = new THREE.Mesh(
        createRoundedBoxGeometry(0.115, 0.03, 0.25, 0.012, 2),
        soleMat
      );
      shoe.add(sole);

      const footbed = new THREE.Mesh(
        createRoundedBoxGeometry(0.1, 0.02, 0.23, 0.008, 2),
        strapMat
      );
      footbed.position.y = 0.016;
      shoe.add(footbed);

      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.052, 0.02, 8, 14, Math.PI),
        strapMat
      );
      strap.position.set(0, 0.022, -0.01);
      shoe.add(strap);

      sandalsGroup.add(shoe);
    }

    parentGroup.add(sandalsGroup);
  }

  _buildCoconutDrink(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'CoconutDrink';
    const groundY = Math.max(0.22, this._getTerrainY(x, z));
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 0.26, 0.26, 0.38, 0.014);

    const huskMat = new THREE.MeshPhysicalMaterial({
      color: 0x568022,
      roughness: 0.46,
      clearcoat: 0.28,
      sheen: 0.35,
      sheenColor: new THREE.Color(0x96cc48),
    });

    const coconutBody = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 16), huskMat);
    coconutBody.scale.set(1.06, 0.96, 1.06);
    coconutBody.position.y = 0.17;
    group.add(coconutBody);

    const fleshMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8f0dc,
      roughness: 0.45,
      sheen: 0.3,
    });
    const fleshRim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.06, 18), fleshMat);
    fleshRim.position.y = 0.31;
    group.add(fleshRim);

    const juice = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.02, 16),
      new THREE.MeshPhysicalMaterial({ color: 0xeef8f6, roughness: 0.15, clearcoat: 0.9 })
    );
    juice.position.y = 0.335;
    group.add(juice);

    const flowerGroup = new THREE.Group();
    flowerGroup.position.set(0.05, 0.35, 0.05);
    flowerGroup.rotation.x = 0.35;
    flowerGroup.rotation.z = -0.25;

    const petalMat = new THREE.MeshPhysicalMaterial({
      color: 0xff4c8b,
      roughness: 0.38,
      sheen: 0.5,
      sheenColor: new THREE.Color(0xffb8d4),
    });

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), petalMat);
      petal.scale.set(1.25, 0.32, 0.85);
      petal.position.set(Math.cos(a) * 0.048, 0, Math.sin(a) * 0.048);
      petal.rotation.y = -a;
      flowerGroup.add(petal);
    }

    const stamen = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 8, 8),
      new THREE.MeshPhysicalMaterial({ color: 0xffe042, roughness: 0.4 })
    );
    stamen.position.y = 0.015;
    flowerGroup.add(stamen);
    group.add(flowerGroup);

    const strawMat = new THREE.MeshPhysicalMaterial({
      color: 0xe02828,
      roughness: 0.25,
      clearcoat: 0.6,
    });
    const strawLower = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.16, 10), strawMat);
    strawLower.position.set(0.06, 0.4, -0.02);
    strawLower.rotation.z = -0.25;
    group.add(strawLower);

    const strawUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.09, 10), strawMat);
    strawUpper.position.set(0.11, 0.48, -0.02);
    strawUpper.rotation.z = -0.95;
    group.add(strawUpper);

    parentGroup.add(group);
  }

  _buildVintagePortableRadio(x, z, rotY = 0.18, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'VintagePortableRadio';
    const groundY = Math.max(0.24, this._getTerrainY(x, z));
    group.position.set(x, groundY, z);
    group.rotation.y = rotY;

    this._addContactShadow(group, 0.34, 0.22, 0.36, 0.014);

    const creamMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6e4e0,
      roughness: 0.36,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
    });

    const darkGrilleMat = new THREE.MeshPhysicalMaterial({
      color: 0x22252b,
      roughness: 0.55,
    });

    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4dae2,
      roughness: 0.2,
      metalness: 0.88,
    });

    const rW = 0.52;
    const rH = 0.32;
    const rD = 0.18;

    const body = new THREE.Mesh(createRoundedBoxGeometry(rW, rH, rD, 0.032, 3), creamMat);
    body.position.y = rH * 0.5 + 0.01;
    group.add(body);

    const grille = new THREE.Mesh(
      createRoundedBoxGeometry(0.28, 0.22, 0.02, 0.012, 2),
      darkGrilleMat
    );
    grille.position.set(-0.08, rH * 0.5 + 0.005, rD * 0.5 + 0.018);
    group.add(grille);

    const tunerWindow = new THREE.Mesh(
      createRoundedBoxGeometry(0.045, 0.2, 0.02, 0.006, 2),
      darkGrilleMat
    );
    tunerWindow.position.set(0.11, rH * 0.5 + 0.005, rD * 0.5 + 0.018);
    group.add(tunerWindow);

    const redNeedle = new THREE.Mesh(
      createRoundedBoxGeometry(0.038, 0.025, 0.024, 0.004, 2),
      this._materials.mailboxRed
    );
    redNeedle.position.set(0.11, rH * 0.5 + 0.04, rD * 0.5 + 0.032);
    group.add(redNeedle);

    for (const ky of [0.12, 0.22]) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 12), darkGrilleMat);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(0.19, ky, rD * 0.5 + 0.022);
      group.add(knob);
    }

    const handleBar = new THREE.Mesh(
      createRoundedBoxGeometry(0.36, 0.024, 0.028, 0.008, 2),
      chromeMat
    );
    handleBar.position.set(0, rH + 0.06, 0);
    group.add(handleBar);

    for (const sx of [-0.16, 0.16]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), chromeMat);
      post.position.set(sx, rH + 0.03, 0);
      group.add(post);
    }

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.01, 0.44, 8),
      chromeMat
    );
    antenna.position.set(0.04, rH + 0.11, -0.03);
    antenna.rotation.z = -1.18;
    group.add(antenna);

    parentGroup.add(group);
    this._registerInteractable({
      id: 'vintage_radio',
      type: 'radio',
      label: 'Portable Radio',
      x,
      y: groundY,
      z,
      radius: 1.0,
      mesh: group,
    });
  }

  _buildBeachResortProps(parentGroup = this.root) {
    // 1. Tall Blue-and-White Striped Beach Umbrella (x = 3.6, z = 16.8, matching ref_05)
    this._buildStripedBeachUmbrella(3.6, 16.8, parentGroup);

    // 2. Two White Slatted Beach Loungers (x = 3.5, z = 17.5 and x = 6.8, z = 17.2, matching ref_05)
    this._buildWhiteBeachLounger(3.5, 17.5, 0.04, parentGroup);
    this._buildWhiteBeachLounger(6.8, 17.2, -0.04, parentGroup);

    // 3. Horizontal Beach Log Bench (x = 4.2, z = 18.2, matching ref_05)
    this._buildLogBenchWithCoffee(4.2, 18.2, 0.0, parentGroup, false);

    // 4. Crackling Beach Campfire & Coconut Drink for ref_05
    this._buildCracklingCampfire(3.2, 19.2, false, parentGroup);
    this._buildCoconutDrink(2.1, 19.8, parentGroup);

    // 5. Vertical Blue-and-White Striped Surfboard (x = 7.8, z = 16.5, matching ref_05)
    this._buildStripedSurfboard(7.8, 16.5, parentGroup);

    // 6. Pink Scalloped Seashell on the beach
    this._buildPinkScallopSeashell(5.4, 19.6, 0.35, 1.05, parentGroup);
  }

  _buildStripedBeachUmbrella(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'StripedBeachUmbrella';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 1.25, 1.25, 0.34, 0.015);

    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = -0.06;
    tiltGroup.rotation.x = 0.04;
    group.add(tiltGroup);

    const poleH = 2.45;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.048, poleH, 12),
      this._materials.pineWood
    );
    pole.position.y = poleH * 0.5;
    tiltGroup.add(pole);

    const umbrellaTex = makeCanvasTexture(512, 256, (ctx, w, h) => {
      const stripes = 8;
      const sw = w / stripes;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#2452d6' : '#f7f9fc';
        ctx.fillRect(i * sw, 0, sw + 1, h);
      }
    });

    const canopyMat = new THREE.MeshPhysicalMaterial({
      map: umbrellaTex,
      roughness: 0.52,
      sheen: 0.45,
      side: THREE.DoubleSide,
    });

    const canopyGeo = new THREE.SphereGeometry(1.38, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.44);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.scale.set(1.0, 0.68, 1.0);
    canopy.position.y = poleH - 0.58;
    tiltGroup.add(canopy);

    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 10),
      new THREE.MeshPhysicalMaterial({ color: 0xf7f9fc, roughness: 0.3 })
    );
    finial.position.y = poleH + 0.38;
    tiltGroup.add(finial);

    parentGroup.add(group);
    this._registerCollider(x, z, 0.35, { type: 'furniture', name: 'Beach Umbrella' });
  }

  _buildWhiteBeachLounger(x, z, rotY = 0, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'WhiteSlattedBeachLounger';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);
    group.rotation.y = rotY;
    group.rotation.x = this._getBeachSlopePitch(x, z);

    this._addContactShadow(group, 0.58, 0.98, 0.34, 0.014);

    const whiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2f5fa,
      roughness: 0.36,
      clearcoat: 0.3,
      sheen: 0.25,
    });

    const lW = 0.78;
    const lD = 1.62;
    const bedY = 0.28;

    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(
        createRoundedBoxGeometry(0.06, 0.065, lD, 0.02, 2),
        whiteMat
      );
      rail.position.set(sx * (lW * 0.5 - 0.03), bedY, 0);
      group.add(rail);

      for (const sz of [-0.62, 0.62]) {
        const leg = new THREE.Mesh(
          createRoundedBoxGeometry(0.055, bedY, 0.065, 0.018, 2),
          whiteMat
        );
        leg.position.set(sx * (lW * 0.5 - 0.03), bedY * 0.5, sz);
        group.add(leg);
      }
    }

    for (let i = 0; i < 8; i++) {
      const sz = -0.15 + i * 0.13;
      const slat = new THREE.Mesh(
        createRoundedBoxGeometry(lW - 0.06, 0.035, 0.095, 0.012, 2),
        whiteMat
      );
      slat.position.set(0, bedY + 0.02, sz);
      group.add(slat);
    }

    const backGroup = new THREE.Group();
    backGroup.position.set(0, bedY + 0.02, -0.22);
    backGroup.rotation.x = 0.54;
    for (let i = 0; i < 5; i++) {
      const slat = new THREE.Mesh(
        createRoundedBoxGeometry(lW - 0.06, 0.035, 0.095, 0.012, 2),
        whiteMat
      );
      slat.position.set(0, 0, -0.08 - i * 0.12);
      backGroup.add(slat);
    }
    group.add(backGroup);

    parentGroup.add(group);
    this._registerCollider(x, z, 0.68, { type: 'seat', name: 'Beach Lounger' });
    this._registerInteractable({
      id: `beach_lounger_${Math.round(x * 10)}`,
      type: 'seat',
      label: 'Poolside Lounger',
      x,
      y: groundY + bedY,
      z,
      seatY: groundY + bedY,
      facingY: rotY,
      radius: 1.15,
      mesh: group,
    });
  }

  _buildStripedSurfboard(x, z, parentGroup = this.root) {
    const group = new THREE.Group();
    group.name = 'StripedSurfboard';
    const groundY = this._getTerrainY(x, z);
    group.position.set(x, groundY, z);

    this._addContactShadow(group, 0.42, 0.35, 0.36, 0.014);

    const shape = new THREE.Shape();
    shape.moveTo(0, -0.95);
    shape.quadraticCurveTo(0.32, -0.45, 0.28, 0.25);
    shape.quadraticCurveTo(0.24, 0.82, 0, 1.15);
    shape.quadraticCurveTo(-0.24, 0.82, -0.28, 0.25);
    shape.quadraticCurveTo(-0.32, -0.45, 0, -0.95);

    const boardGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      curveSegments: 24,
    });
    boardGeo.center();

    const surfTex = makeCanvasTexture(256, 512, (ctx, w, h) => {
      ctx.fillStyle = '#f6f8fc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2554d8';
      ctx.fillRect(0, h * 0.08, w, h * 0.14);
      ctx.fillRect(0, h * 0.28, w, h * 0.12);
      ctx.fillRect(0, h * 0.56, w, h * 0.14);
      ctx.fillStyle = '#182b68';
      ctx.fillRect(0, h * 0.74, w, h * 0.26);
    });

    const boardMat = new THREE.MeshPhysicalMaterial({
      map: surfTex,
      roughness: 0.15,
      clearcoat: 0.92,
      clearcoatRoughness: 0.08,
    });

    const boardMesh = new THREE.Mesh(boardGeo, boardMat);
    boardMesh.position.y = 0.98;
    boardMesh.rotation.x = -0.08;
    boardMesh.rotation.y = -0.15;
    group.add(boardMesh);

    parentGroup.add(group);
    this._registerCollider(x, z, 0.36, { type: 'prop', name: 'Surfboard' });
  }

  _buildPinkScallopSeashell(x, z, rotY = 0, scale = 1.0, parentGroup = this.root, explicitY = null) {
    const group = new THREE.Group();
    group.name = 'PinkScallopSeashell';
    const groundY = typeof explicitY === 'number' ? explicitY : Math.max(0.18, this._getTerrainY(x, z));
    group.position.set(x, groundY, z);
    group.rotation.y = rotY;
    group.scale.setScalar(scale);

    this._addContactShadow(group, 0.24, 0.22, 0.32, 0.01);

    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xf47a5e,
      roughness: 0.38,
      clearcoat: 0.35,
      sheen: 0.4,
      sheenColor: new THREE.Color(0xffbfa8),
    });

    const numRibs = 7;
    for (let i = 0; i < numRibs; i++) {
      const t = i / (numRibs - 1) - 0.5;
      const angle = t * 1.15;
      const ribLen = 0.26 * (1.0 - Math.abs(t) * 0.28);
      const rib = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.036, ribLen, 8),
        shellMat
      );
      rib.rotation.x = Math.PI / 2 - 0.16;
      rib.rotation.z = -angle;
      rib.position.set(Math.sin(angle) * (ribLen * 0.42), 0.04, Math.cos(angle) * (ribLen * 0.42) - 0.08);
      group.add(rib);
    }

    const hinge = new THREE.Mesh(
      createRoundedBoxGeometry(0.14, 0.035, 0.06, 0.012, 2),
      shellMat
    );
    hinge.position.set(0, 0.025, -0.1);
    group.add(hinge);

    parentGroup.add(group);
  }

  // ============================================================================
  // ANIMATION & DAY/NIGHT UPDATE LOOP
  // ============================================================================

  update(dt = 0.016, elapsed = 0, timeOfDay = 'noon') {
    const t = elapsed || performance.now() * 0.001;

    // 1. Gently rock the Wooden Swing Benches
    for (let i = 0; i < this.animatedSwingPivots.length; i++) {
      const s = this.animatedSwingPivots[i];
      s.pivot.rotation.x = Math.sin(t * 1.65 + s.phase) * 0.082;
    }

    // 2. Flicker and dance the Campfire & Boiler Fire flames + amber PointLight
    for (let i = 0; i < this.animatedCampfires.length; i++) {
      const cf = this.animatedCampfires[i];
      for (let j = 0; j < cf.flames.length; j++) {
        const cone = cf.flames[j];
        const freq = 6.5 + j * 1.9;
        const p = t * freq + cf.phase + j * 1.1;
        const scaleY = 1.0 + Math.sin(p) * 0.18 + Math.cos(p * 1.7) * 0.08;
        const scaleXZ = 1.0 - Math.sin(p) * 0.07;
        cone.scale.set(scaleXZ, scaleY, scaleXZ);
        cone.rotation.z = Math.sin(p * 0.8) * 0.11;
        cone.rotation.x = Math.cos(p * 0.9) * 0.09;
      }
      if (cf.light) {
        const flicker =
          Math.sin(t * 9.2 + cf.phase) * 0.22 + Math.cos(t * 15.4 + cf.phase) * 0.14;
        const nightBoost = timeOfDay === 'night' || timeOfDay === 'golden_hour' ? 1.15 : 0.85;
        cf.light.intensity = (cf.baseIntensity + flicker) * nightBoost;
      }
    }

    // 3. Animate Plaza Marble Fountain water jets & foaming ring
    for (let i = 0; i < this.animatedFountains.length; i++) {
      const fn = this.animatedFountains[i];
      const pulse = 1.0 + Math.sin(t * 5.2) * 0.08;
      fn.topPlume.scale.set(1.0 + Math.cos(t * 4.5) * 0.06, pulse, 1.0 + Math.sin(t * 4.5) * 0.06);
      fn.topPlume.rotation.y = t * 1.4;
      fn.cascadeCurtain.rotation.y = -t * 0.9;
      const ringScale = 0.96 + Math.sin(t * 3.8) * 0.06;
      fn.foamRing.scale.set(ringScale, ringScale, 1.0);
    }

    // 4. Adjust Cottage window warm interior glow based on timeOfDay
    const targetGlow =
      timeOfDay === 'night'
        ? 1.25
        : timeOfDay === 'golden_hour'
        ? 0.78
        : timeOfDay === 'morning'
        ? 0.42
        : 0.3;
    for (let i = 0; i < this.cottageGlowMaterials.length; i++) {
      const mat = this.cottageGlowMaterials[i];
      mat.emissiveIntensity += (targetGlow - mat.emissiveIntensity) * Math.min(1.0, dt * 4.0);
    }
  }
}

export default PropsAndFurnitureBuilder;
