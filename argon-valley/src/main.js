import * as THREE from '../assets/vendor/three.module.js';
import {
  WORLD_CURVE_UNIFORMS,
  applyWorldCurveToHierarchy,
  IslandGridSystem,
  CozyCameraRig,
  DayNightCycle,
} from './world_curve_engine.js';
import {
  MaterialFactory,
  materialFactory,
  EnvironmentBuilder,
} from './environment_materials.js';
import { PropsAndFurnitureBuilder } from './props_furniture.js';
import { CharactersAndAnimManager } from './characters_anim.js';
import {
  CozyPostProcessor,
  ParticleSystemManager,
  CozyAudioEngine,
  CozyUIManager,
} from './fx_audio_ui.js';

const FISH_CATALOG = [
  {
    name: 'Red Snapper',
    bells: 3000,
    color: '#ff5242',
    finColor: '#ff9688',
    scale: 1.15,
    pun: 'I caught a Red Snapper! It looks pretty dapper!',
  },
  {
    name: 'Nishikigoi Koi',
    bells: 4000,
    color: '#ff6820',
    finColor: '#fffdf4',
    scale: 1.2,
    pun: 'I caught a Koi! Don\'t be coy, it\'s a beauty!',
  },
  {
    name: 'Sea Bass',
    bells: 400,
    color: '#52987a',
    finColor: '#88c8a8',
    scale: 1.25,
    pun: 'I caught a Sea Bass! No, wait—it\'s at least a C+!',
  },
  {
    name: 'Goldfish',
    bells: 1300,
    color: '#ffaa1d',
    finColor: '#ffe078',
    scale: 0.85,
    pun: 'I caught a Goldfish! It\'s worth its weight in gold!',
  },
];

const DIY_PROJECTS = [
  { name: 'Island Apple Tart', icon: '🥧', bells: 800 },
  { name: 'Sunset Shell Lamp', icon: '🐚', bells: 950 },
  { name: 'Cozy Pine Bonsai', icon: '🪴', bells: 850 },
  { name: 'Golden Tulip Wreath', icon: '🌼', bells: 1000 },
];

class CozyIslandApp {
  constructor() {
    this.container = document.getElementById('canvas-container') || document.body;
    this.width = window.innerWidth || 1280;
    this.height = window.innerHeight || 720;

    // 1. Renderer Setup (High-Resolution Soft Shadows + sRGB Pipeline)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping; // Handled in CozyPostProcessor
    this.container.appendChild(this.renderer.domElement);

    // 2. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#80d4ff');
    this.camera = new THREE.PerspectiveCamera(33, this.width / this.height, 0.25, 450);

    // 3. Engine & World Curve Subsystems (Agent 1)
    this.gridSystem = new IslandGridSystem();
    this.cameraRig = new CozyCameraRig(this.camera, this.renderer.domElement);
    this.dayNight = new DayNightCycle(this.scene);

    // 4. Environment & Tactile Materials (Agent 2)
    this.materials = materialFactory || new MaterialFactory();
    this.environment = new EnvironmentBuilder(this.scene, this.gridSystem);

    // 5. Props & Furniture (Agent 3)
    this.props = new PropsAndFurnitureBuilder(this.scene, this.gridSystem, this.materials);

    // 6. Characters & Animation (Agent 4)
    this.characters = new CharactersAndAnimManager(this.scene, this.gridSystem, this.materials);

    // 7. FX, Post-Processing, Audio & Cozy Gameplay UI (Agent 5)
    this.postProcessor = new CozyPostProcessor(this.renderer, this.scene, this.camera);
    this.particles = new ParticleSystemManager(this.scene);
    this.audio = new CozyAudioEngine();

    // Pocket Inventory & Island Activity State
    this.inventory = {
      bells: 1500,
      apple: 2,
      orange: 1,
      coconut: 0,
      watered: 0,
      fish: 0,
      bugs: 0,
      crafts: 0,
    };
    this._diyIndex = 0;
    this._currentContextAction = null;

    // 8. Build 3D Gameplay Helpers (Click-to-Walk Target Ring + 3D Fishing Bobber & Fish)
    this._initGameplay3DHelpers();

    this.ui = new CozyUIManager({
      audioEngine: this.audio,
      cameraRig: this.cameraRig,
      dayNight: this.dayNight,
      characters: this.characters,
      particles: this.particles,
      onSelectPreset: (presetName) => this.applyScenePreset(presetName),
      onSelectTimeOfDay: (tod) => this.applyTimeOfDay(tod),
      onSelectTool: (toolName) => {
        this.characters.setTool(toolName);
      },
      onCycleOutfit: () => {
        const nextOutfit = this.characters.cycleOutfit();
        const pretty = String(nextOutfit || '').replace(/_/g, ' ');
        this.ui.showToast('👕', `Switched outfit to ${pretty}!`, 2000);
      },
      onAction: (action) => this.handleUIAction(action),
      onGiftVillager: (villagerName) => this.giftFruitToVillager(villagerName),
      onTriggerContextPrompt: () => this.executeContextPromptAction(),
    });
    this.ui.updateInventoryUI(this.inventory);

    // 9. Parse URL Query Parameters (Default = 'free_roam' Gameplay!)
    this._applyInitialURLState();

    // 10. Interactive World Raycasting, Click-to-Walk & Keyboard Hooks
    this._bindWorldInteractions();

    // 11. Resize & Animation Loop
    window.addEventListener('resize', () => this._onResize());
    this.clock = new THREE.Clock();
    this.elapsed = 0;

    // Expose global handle for debugging & verification
    window.__COZY_ISLAND__ = this;

    // Render an immediate initial frame
    this.step(0.016);
    const params = new URLSearchParams(window.location.search);
    if (params.get('capture') !== '1') {
      this._animate();
    }
  }

  // --------------------------------------------------------------------------
  // 3D Gameplay Visuals: Click-to-Walk Ring & 3D Fishing Bobber / Fish
  // --------------------------------------------------------------------------
  _initGameplay3DHelpers() {
    // A. Click-to-Walk Glowing Ground Ring
    this.walkTargetGroup = new THREE.Group();
    this.walkTargetGroup.visible = false;
    const ringGeo = new THREE.RingGeometry(0.24, 0.36, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7ce0b8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.walkRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.walkTargetGroup.add(this.walkRingMesh);
    applyWorldCurveToHierarchy(this.walkTargetGroup);
    this.scene.add(this.walkTargetGroup);
    this.walkRingTimer = 0;

    // B. 3D Fishing Bobber, Ripple Ring, Fish Shadow & Leap Fish
    this.fishingGroup = new THREE.Group();
    this.fishingGroup.name = 'InteractiveFishingGroup';
    this.fishingGroup.visible = false;

    // Red-and-white float bobber
    this.bobberMesh = new THREE.Group();
    const bobTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      new THREE.MeshStandardMaterial({ color: 0xf23828, roughness: 0.3 })
    );
    const bobBot = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 14, 12, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52),
      new THREE.MeshStandardMaterial({ color: 0xfffdf4, roughness: 0.35 })
    );
    const bobPeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0xf23828, roughness: 0.3 })
    );
    bobPeg.position.y = 0.12;
    this.bobberMesh.add(bobTop, bobBot, bobPeg);
    this.fishingGroup.add(this.bobberMesh);

    // Expanding water ripple ring around bobber
    const rippleGeo = new THREE.RingGeometry(0.14, 0.22, 24);
    rippleGeo.rotateX(-Math.PI / 2);
    this.bobberRippleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.bobberRipple = new THREE.Mesh(rippleGeo, this.bobberRippleMat);
    this.fishingGroup.add(this.bobberRipple);

    // Swimming dark fish silhouette in water
    this.fishShadowGroup = new THREE.Group();
    const shadowBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0x0d3b54,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      })
    );
    shadowBody.scale.set(0.65, 0.25, 1.55);
    const shadowTail = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.22, 4),
      shadowBody.material
    );
    shadowTail.rotation.x = -Math.PI / 2;
    shadowTail.position.z = -0.26;
    this.fishShadowGroup.add(shadowBody, shadowTail);
    this.fishingGroup.add(this.fishShadowGroup);

    // Celebratory 3D Caught Fish Mesh (leaps out of water when reeled in!)
    this.caughtFishGroup = new THREE.Group();
    this.caughtFishGroup.visible = false;
    this.caughtFishBodyMat = new THREE.MeshStandardMaterial({
      color: 0xff5242,
      roughness: 0.28,
      metalness: 0.05,
    });
    this.caughtFishFinMat = new THREE.MeshStandardMaterial({
      color: 0xff9688,
      roughness: 0.38,
    });
    const fBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12),
      this.caughtFishBodyMat
    );
    fBody.scale.set(0.55, 0.85, 1.45);
    const fTail = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.26, 4),
      this.caughtFishFinMat
    );
    fTail.rotation.x = -Math.PI / 2;
    fTail.scale.set(0.35, 1.0, 1.0);
    fTail.position.z = -0.28;
    const fEyeL = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x181818 })
    );
    fEyeL.position.set(0.08, 0.04, 0.16);
    const fEyeR = fEyeL.clone();
    fEyeR.position.x = -0.08;
    this.caughtFishGroup.add(fBody, fTail, fEyeL, fEyeR);
    this.fishingGroup.add(this.caughtFishGroup);

    applyWorldCurveToHierarchy(this.fishingGroup);
    this.scene.add(this.fishingGroup);

    this.fishingState = {
      active: false,
      phase: 'idle', // 'cast' | 'nibble' | 'bite' | 'reeling'
      timer: 0,
      waterX: 0,
      waterY: 0.15,
      waterZ: 0,
      nibbleCount: 0,
      caughtSpec: null,
    };
  }

  // --------------------------------------------------------------------------
  // Startup & Preset State (Defaults to Free Roam Gameplay!)
  // --------------------------------------------------------------------------
  _applyInitialURLState() {
    const params = new URLSearchParams(window.location.search);
    const presetParam = params.get('preset') || params.get('scene') || 'free_roam';
    const timeParam = params.get('time') || params.get('tod');
    const curveParam = params.get('curve');
    const postParam = params.get('post');

    const indexMap = {
      '1': 'beach_sunset',
      '2': 'house_yard',
      '3': 'flower_river',
      '4': 'tent_horizon',
      '5': 'bridge_plaza',
      '6': 'cliff_waterfall',
      '0': 'free_roam',
    };
    const resolvedPreset = indexMap[presetParam] || presetParam;

    this.applyScenePreset(resolvedPreset, true);
    this.ui.selectPreset(resolvedPreset, false);

    if (timeParam) {
      this.applyTimeOfDay(timeParam, true);
      this.ui.setTimeOfDay(timeParam);
    }

    if (curveParam !== null) {
      const val = parseFloat(curveParam);
      if (Number.isFinite(val)) {
        WORLD_CURVE_UNIFORMS.uCurveStrength.value = val;
      }
    }

    if (postParam === '0' || postParam === 'false') {
      this.postProcessor.enabled = false;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
    }
  }

  applyScenePreset(presetName, immediate = false) {
    this._cancelFishing();
    const isFreeRoam = presetName === 'free_roam' || presetName === 'follow_player';
    const camPreset = isFreeRoam ? 'follow_player' : presetName;

    const defaultTimes = {
      free_roam: 'noon',
      beach_sunset: 'golden_hour',
      house_yard: 'noon',
      flower_river: 'noon',
      tent_horizon: 'noon',
      bridge_plaza: 'noon',
      cliff_waterfall: 'noon',
    };
    const targetTod = defaultTimes[presetName] || this.ui?.activeTimeOfDay || 'noon';

    this.dayNight.setTimePreset(targetTod, true);
    this.environment.setScenePreset?.(presetName);
    this.props.setScenePreset?.(presetName);
    this.characters.setScenePosePreset(presetName);
    this.cameraRig.setCameraPreset(camPreset, immediate || !isFreeRoam);
    this.particles?.setScenePreset?.(presetName);
    this.audio?.setTimeOfDay?.(targetTod);
  }

  applyTimeOfDay(tod, immediate = false) {
    this.dayNight.setTimePreset(tod, immediate);
    this.audio?.setTimeOfDay?.(tod);
  }

  // --------------------------------------------------------------------------
  // Core Gameplay Mechanics: Tools, Shaking, Pickup, Fishing, Bugs, Sitting, DIY
  // --------------------------------------------------------------------------
  handleUIAction(action) {
    if (action === 'use_tool') {
      this.triggerPrimaryToolOrInteract();
    } else if (action === 'sit_wave') {
      this.toggleSitOrWave();
    } else if (action === 'talk_villager') {
      const pPos = this.characters.player.group.position;
      const v =
        this.characters.getClosestVillager(pPos.x, pPos.z, 4.5, true);
      if (v) {
        this.talkToVillager(v);
      }
    }
  }

  toggleSitOrWave(targetSeat = null) {
    const player = this.characters.player;
    const pPos = player.group.position;

    if (player.seatedOn || player.pose === 'sit') {
      player.standUpFromSeat();
      this.audio.playUIClick?.();
      this.ui.showToast('🚶', 'Stood up and ready to explore!', 1800);
      return;
    }

    const seat = targetSeat || this.props.getNearestSeat?.(pPos.x, pPos.z, 2.2);
    if (seat && Math.hypot(seat.x - pPos.x, seat.z - pPos.z) < 2.25) {
      // Temporarily disable this seat's collider so the player can sit on its center and walk off freely
      if (this.gridSystem && Array.isArray(this.gridSystem.colliders)) {
        for (const col of this.gridSystem.colliders) {
          if (Math.hypot(col.x - seat.x, col.z - seat.z) < 0.85) {
            col.disabled = true;
            seat._disabledCollider = col;
          }
        }
      }
      player.seatedOn = seat;
      player.targetPos = null;
      player.group.position.set(seat.x, seat.y - 0.32, seat.z);
      if (Number.isFinite(seat.rotY)) {
        player.group.rotation.y = seat.rotY;
      }
      player.setPose('sit');
      this.audio.playUIClick?.();
      this.ui.showToast('🪑', `Relaxing on the ${seat.label || 'seat'}! Press WASD or E to stand.`, 2600);
    } else {
      player.setPose('wave');
      player.actionTimer = 1.1;
      this.audio.playUIClick?.();
    }
  }

  talkToVillager(villager) {
    if (!villager) return;
    const player = this.characters.player;
    const pPos = player.group.position;
    if (player.seatedOn) player.standUpFromSeat();

    // Face each other warmly
    villager.faceToward?.(pPos.x, pPos.z);
    const dx = villager.group.position.x - pPos.x;
    const dz = villager.group.position.z - pPos.z;
    player.group.rotation.y = Math.atan2(dx, dz);
    player.setPose('wave');
    player.actionTimer = 0.85;

    this.ui.cycleVillagerDialogue(villager.name);
  }

  giftFruitToVillager(villagerName) {
    const fruitOrder = [
      { key: 'apple', label: 'Red Apple', icon: '🍎' },
      { key: 'orange', label: 'Valencia Orange', icon: '🍊' },
      { key: 'coconut', label: 'Island Coconut', icon: '🥥' },
    ];
    const chosen = fruitOrder.find((f) => this.inventory[f.key] > 0);
    if (!chosen) {
      this.audio.playUIClick?.();
      this.ui.showToast(
        '🌳',
        'No fruit in your Pocket! Press [Space] by an Apple or Orange tree to shake some down!',
        3200
      );
      return;
    }

    this.inventory[chosen.key] -= 1;
    this.inventory.bells += 300;
    this.ui.updateInventoryUI(this.inventory, chosen.key);
    this.audio.playCatchFanfare?.();

    const vObj = this.characters.villagers.find((v) => v.name === villagerName);
    if (vObj) {
      vObj.happyBounceTimer = 1.2;
      this.particles.emitFlowerSparkle?.(
        vObj.group.position.x,
        vObj.group.position.y + 0.9,
        vObj.group.position.z
      );
    }

    this.ui.showGiftDialogue(villagerName);
    this.ui.showToast(
      '💝',
      `Gifted 1 ${chosen.icon} ${chosen.label} to ${villagerName}! Received +300 💰 Coins!`,
      3200
    );
  }

  craftAtWorkbench() {
    const player = this.characters.player;
    if (player.seatedOn) player.standUpFromSeat();

    // Face the DIY Workbench at (0.4, -5.4)
    player.group.rotation.y = Math.atan2(0.4 - player.group.position.x, -5.4 - player.group.position.z);
    player.triggerToolAction();

    const project = DIY_PROJECTS[this._diyIndex % DIY_PROJECTS.length];
    this._diyIndex++;
    this.inventory.crafts += 1;
    this.inventory.bells += project.bells;
    this.ui.updateInventoryUI(this.inventory);

    this.particles.emitDirtBurst?.(0.4, 1.15, -5.4);
    this.particles.emitFlowerSparkle?.(0.4, 1.25, -5.4);
    this.audio.playCatchFanfare?.();
    this.ui.showToast(
      project.icon,
      `DIY Crafted: ${project.name}! Sold to Argon Market for +${project.bells} 💰 Coins!`,
      3400
    );
  }

  _collectItemsAroundPlayer(radius = 1.45) {
    const pPos = this.characters.player.group.position;
    const picked = this.environment.collectNearbyItems?.(pPos.x, pPos.z, radius);
    if (!picked || !picked.length) return false;

    this.audio.playPickupChime?.();
    for (const item of picked) {
      if (item.type === 'bells' || item.kind === 'bells' || item.type === 'bell_bag') {
        const val = item.amount || item.bellValue || 500;
        this.inventory.bells += val;
        this.ui.updateInventoryUI(this.inventory, 'bells');
        this.ui.showToast('💰', `Picked up a Coin Pouch (+${val} Coins)!`, 2400);
      } else {
        const rawKind = item.kind || item.type || 'apple';
        const key = rawKind === 'orange' ? 'orange' : rawKind === 'coconut' ? 'coconut' : 'apple';
        const icon = key === 'orange' ? '🍊' : key === 'coconut' ? '🥥' : '🍎';
        const name = key === 'orange' ? 'Valencia Orange' : key === 'coconut' ? 'Coconut' : 'Red Apple';
        this.inventory[key] = (this.inventory[key] || 0) + 1;
        this.inventory.bells += 50;
        this.ui.updateInventoryUI(this.inventory, key);
        this.ui.showToast(icon, `Picked up a fresh ${name} (+50 Coins)!`, 2200);
      }
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // 3D Fishing Cast, Nibble & Catch Loop
  // --------------------------------------------------------------------------
  _findWaterTargetNearPlayer(maxRange = 4.2) {
    const player = this.characters.player;
    const pPos = player.group.position;
    const rotY = player.group.rotation.y;

    // 1. Check along player facing direction first
    for (let dist = 1.4; dist <= maxRange; dist += 0.45) {
      const tx = pPos.x + Math.sin(rotY) * dist;
      const tz = pPos.z + Math.cos(rotY) * dist;
      const surf = this.gridSystem.getSurfaceType(tx, tz);
      if (surf === 'river' || surf === 'ocean') {
        return {
          x: tx,
          z: tz,
          y: surf === 'ocean' ? 0.05 : 0.18,
          surface: surf,
        };
      }
    }

    // 2. Otherwise radial search around player so casting near any bank always succeeds!
    for (let dist = 1.5; dist <= maxRange; dist += 0.5) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const tx = pPos.x + Math.cos(ang) * dist;
        const tz = pPos.z + Math.sin(ang) * dist;
        const surf = this.gridSystem.getSurfaceType(tx, tz);
        if (surf === 'river' || surf === 'ocean') {
          return {
            x: tx,
            z: tz,
            y: surf === 'ocean' ? 0.05 : 0.18,
            surface: surf,
          };
        }
      }
    }
    return null;
  }

  _startFishingCast(waterTarget) {
    if (!waterTarget) return false;
    const player = this.characters.player;
    if (player.seatedOn) player.standUpFromSeat();

    this.ui.selectTool('fishing_rod', false);
    player.setTool('fishing_rod');
    player.targetPos = null;
    player.group.rotation.y = Math.atan2(
      waterTarget.x - player.group.position.x,
      waterTarget.z - player.group.position.z
    );
    player.setPose('fishing');

    this.fishingState.active = true;
    this.fishingState.phase = 'cast';
    this.fishingState.timer = 0;
    this.fishingState.waterX = waterTarget.x;
    this.fishingState.waterY = waterTarget.y;
    this.fishingState.waterZ = waterTarget.z;
    this.fishingState.nibbleCount = 0;
    this.fishingState.caughtSpec =
      FISH_CATALOG[Math.floor(Math.random() * FISH_CATALOG.length)];

    this.fishingGroup.visible = true;
    this.bobberMesh.visible = true;
    this.bobberRipple.visible = true;
    this.fishShadowGroup.visible = true;
    this.caughtFishGroup.visible = false;

    this.bobberMesh.position.set(waterTarget.x, waterTarget.y + 0.03, waterTarget.z);
    this.bobberRipple.position.set(waterTarget.x, waterTarget.y + 0.02, waterTarget.z);
    this.fishShadowGroup.position.set(
      waterTarget.x + 0.9,
      waterTarget.y - 0.06,
      waterTarget.z + 0.6
    );

    this.audio.playSplash?.();
    this.ui.showToast('🎣', 'Cast line into the water! Watch the bobber...', 2200);
    return true;
  }

  _reelInFish() {
    if (!this.fishingState.active) return;
    if (this.fishingState.phase === 'reeling') return;

    const spec = this.fishingState.caughtSpec || FISH_CATALOG[0];
    this.fishingState.phase = 'reeling';
    this.fishingState.timer = 0;

    this.bobberMesh.visible = false;
    this.fishShadowGroup.visible = false;
    this.caughtFishGroup.visible = true;
    this.caughtFishBodyMat.color.set(spec.color);
    this.caughtFishFinMat.color.set(spec.finColor);
    this.caughtFishGroup.scale.setScalar(spec.scale || 1.0);
    this.caughtFishGroup.position.set(
      this.fishingState.waterX,
      this.fishingState.waterY + 0.2,
      this.fishingState.waterZ
    );

    this.audio.playSplash?.();
    this.audio.playCatchFanfare?.();

    this.inventory.fish += 1;
    this.inventory.bells += spec.bells;
    this.ui.updateInventoryUI(this.inventory, 'fish');
    this.ui.showToast('🐟', `${spec.pun} (+${spec.bells.toLocaleString()} 💰 Coins)`, 3600);
  }

  _cancelFishing() {
    if (!this.fishingState) return;
    this.fishingState.active = false;
    this.fishingState.phase = 'idle';
    if (this.fishingGroup) this.fishingGroup.visible = false;
    if (this.characters?.player?.pose === 'fishing' && this.characters.currentPreset === 'free_roam') {
      this.characters.player.setPose('idle');
    }
  }

  _updateFishing(dt, elapsed) {
    if (!this.fishingState || !this.fishingState.active) return;
    const st = this.fishingState;
    st.timer += dt;

    const pPos = this.characters.player.group.position;
    if (st.phase === 'cast' || st.phase === 'nibble') {
      // Gentle bobber float + fish swimming closer
      const bobOffset = Math.sin(elapsed * 5.0) * 0.025;
      const nibbleDip = st.phase === 'nibble' ? -Math.abs(Math.sin(st.timer * 18.0)) * 0.08 : 0;
      this.bobberMesh.position.set(st.waterX, st.waterY + 0.03 + bobOffset + nibbleDip, st.waterZ);

      // Ripple pulse
      const rScale = 0.7 + ((elapsed * 1.4) % 1.0) * 1.4;
      this.bobberRipple.scale.setScalar(rScale);
      this.bobberRippleMat.opacity = Math.max(0.05, (1.0 - ((elapsed * 1.4) % 1.0)) * 0.65);

      // Swim fish shadow toward bobber
      const approach = Math.min(1.0, st.timer / 1.45);
      const fx = st.waterX + (1.0 - approach) * 0.85 * Math.cos(elapsed * 2.0);
      const fz = st.waterZ + (1.0 - approach) * 0.75 * Math.sin(elapsed * 2.0);
      this.fishShadowGroup.position.set(fx, st.waterY - 0.05, fz);
      this.fishShadowGroup.rotation.y = Math.atan2(st.waterX - fx, st.waterZ - fz);

      if (st.phase === 'cast' && st.timer >= 0.75) {
        st.phase = 'nibble';
        this.audio.playUIClick?.();
      } else if (st.phase === 'nibble' && st.timer >= 1.45) {
        st.phase = 'bite';
        st.timer = 0;
        this.audio.playSplash?.();
        this.ui.showToast('💦', 'BITE! Press [Space] or Click to reel it in!', 1800);
      }
    } else if (st.phase === 'bite') {
      // Bobber plunged underwater & churning ripple
      this.bobberMesh.position.set(
        st.waterX,
        st.waterY - 0.09 + Math.sin(elapsed * 25.0) * 0.04,
        st.waterZ
      );
      this.bobberRipple.scale.setScalar(1.2 + Math.sin(elapsed * 20.0) * 0.4);
      this.bobberRippleMat.opacity = 0.85;

      // Auto-reel after 0.65s so the player never loses a bite!
      if (st.timer >= 0.65) {
        this._reelInFish();
      }
    } else if (st.phase === 'reeling') {
      // Parabolic arc from water to player's hands!
      const t = Math.min(1.0, st.timer / 0.85);
      const cx = THREE.MathUtils.lerp(st.waterX, pPos.x, t);
      const cz = THREE.MathUtils.lerp(st.waterZ, pPos.z, t);
      const cy =
        THREE.MathUtils.lerp(st.waterY + 0.2, pPos.y + 1.15, t) +
        Math.sin(t * Math.PI) * 1.45;
      this.caughtFishGroup.position.set(cx, cy, cz);
      this.caughtFishGroup.rotation.y += dt * 10.0;
      this.caughtFishGroup.rotation.x = Math.sin(t * Math.PI) * 0.5;

      if (st.timer >= 0.95) {
        this._cancelFishing();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Primary Tool / Spacebar Action Dispatcher
  // --------------------------------------------------------------------------
  triggerPrimaryToolOrInteract() {
    const player = this.characters.player;
    const pPos = player.group.position;

    // 1. If fishing bobber is active in water, reel it in!
    if (this.fishingState.active && this.fishingState.phase !== 'reeling') {
      this._reelInFish();
      return;
    }

    // 2. If seated, stand up first
    if (player.seatedOn) {
      player.standUpFromSeat();
      return;
    }

    // 3. Check if there are dropped items right at our feet to pick up
    if (this._collectItemsAroundPlayer(1.5)) {
      return;
    }

    const nearestTree = this._getNearestTree(pPos.x, pPos.z, 2.35);
    const rotY = player.group.rotation.y;
    const frontX = pPos.x + Math.sin(rotY) * 0.95;
    const frontZ = pPos.z + Math.cos(rotY) * 0.95;
    const tool = player.currentTool;

    // 4. Execute active tool or smart context fallback
    if (tool === 'bug_net') {
      player.triggerToolAction();
      this.audio.playNetWhoosh?.();
      const res = this.characters.catchNearestCritter(pPos.x, pPos.z, 2.8);
      if (res && res.caught) {
        this.audio.playCatchFanfare?.();
        this.particles.emitFlowerSparkle?.(res.position.x, res.position.y, res.position.z);
        this.inventory.bugs += 1;
        this.inventory.bells += res.bellValue;
        this.ui.updateInventoryUI(this.inventory, 'bugs');
        this.ui.showToast(
          '🦋',
          `Caught a ${res.speciesName}! (+${res.bellValue.toLocaleString()} 💰 Coins)`,
          3200
        );
      } else if (nearestTree) {
        this._shakeTree(nearestTree);
      } else {
        this.ui.showToast('🦋', 'Swung Bug Net! Get closer to a butterfly or dragonfly!', 2000);
      }
      return;
    }

    if (tool === 'fishing_rod') {
      const waterTarget = this._findWaterTargetNearPlayer(4.5);
      if (waterTarget) {
        this._startFishingCast(waterTarget);
      } else if (nearestTree) {
        this._shakeTree(nearestTree);
      } else {
        player.triggerToolAction();
        this.ui.showToast('🎣', 'Walk near the river or ocean shore to cast your Fishing Rod!', 2400);
      }
      return;
    }

    if (tool === 'shovel') {
      player.triggerToolAction();
      const digRes = this.environment.spawnDigHole?.(frontX, frontZ, false);
      this.particles.emitDirtBurst?.(frontX, pPos.y + 0.15, frontZ);
      this.audio.playShovelDig?.();
      if (digRes && digRes.action === 'filled') {
        this.ui.showToast('⛏️', 'Filled in the soil hole!', 1800);
      } else if (digRes && digRes.spawnedBellBag) {
        this.audio.playPickupChime?.();
        this.ui.showToast('💰', 'Dug up a 500-Coin Pouch! Walk over it or press Space to collect!', 2800);
      } else {
        this.ui.showToast('⛏️', 'Dug a fresh soil hole! (Press Space again to fill it in)', 2200);
      }
      return;
    }

    if (tool === 'trowel') {
      player.triggerToolAction();
      const tileRes = this.environment.addDirtTile?.(frontX, frontZ);
      this.particles.emitDirtBurst?.(frontX, pPos.y + 0.1, frontZ);
      this.audio.playTrowelPat?.();
      if (tileRes && (tileRes.action === 'removed' || tileRes.placed === false)) {
        this.ui.showToast('🧱', 'Cleared dirt path tile back to lush grass!', 1900);
      } else {
        this.ui.showToast('🧱', 'Laid a warm ochre dirt path tile! (Press again to clear)', 2100);
      }
      return;
    }

    if (tool === 'watering_can') {
      const wateredList = this.environment.waterFlowersNear?.(frontX, frontZ, 2.6);
      const count = Array.isArray(wateredList) ? wateredList.length : (wateredList?.count || 0);
      if (count > 0) {
        player.triggerToolAction();
        this.particles.emitWaterSpray?.(
          { x: pPos.x, y: pPos.y, z: pPos.z },
          { x: Math.sin(rotY), z: Math.cos(rotY) }
        );
        const list = Array.isArray(wateredList) ? wateredList : (wateredList.positions || []);
        for (const fl of list) {
          this.particles.emitFlowerSparkle?.(fl.x, fl.y ?? 0.6, fl.z);
        }
        this.audio.playWateringCan?.();
        this.inventory.watered += count;
        this.inventory.bells += count * 25;
        this.ui.updateInventoryUI(this.inventory, 'watered');
        this.ui.showToast(
          '🌷',
          `Watered ${count} flowers! They're sparkling! (+${count * 25} 💰 Coins)`,
          2600
        );
        return;
      }
      if (nearestTree) {
        this._shakeTree(nearestTree);
        return;
      }
      player.triggerToolAction();
      this.particles.emitWaterSpray?.(
        { x: pPos.x, y: pPos.y, z: pPos.z },
        { x: Math.sin(rotY), z: Math.cos(rotY) }
      );
      this.audio.playWateringCan?.();
      this.ui.showToast('🚿', 'Watered the grass! Walk up to tulips or cosmos to make them sparkle!', 2200);
      return;
    }

    // Hands / 'none' tool -> shake nearest tree!
    if (nearestTree) {
      this._shakeTree(nearestTree);
    } else {
      player.setPose('wave');
      player.actionTimer = 1.0;
      this.audio.playUIClick?.();
    }
  }

  _getNearestTree(x, z, maxDist = 2.7) {
    if (!this.environment || !Array.isArray(this.environment.trees)) return null;
    let best = null;
    let bestDist = maxDist;
    for (const t of this.environment.trees) {
      const meshObj = t.mesh || t.group;
      if (meshObj && !meshObj.visible) continue;
      const d = Math.hypot(t.x - x, t.z - z);
      if (d <= bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  _shakeTree(tree) {
    if (!tree) return false;
    const pPos = this.characters.player.group.position;
    this.characters.player.group.rotation.y = Math.atan2(tree.x - pPos.x, tree.z - pPos.z);
    const shook = this.environment.shakeNearestTree?.(tree.x, tree.z, 1.5);
    if (shook) {
      this.audio.playTreeShake?.();
      const fruitLabel =
        tree.type === 'orange'
          ? 'Valencia Oranges 🍊'
          : tree.type === 'coconut' || tree.type === 'palm'
          ? 'Coconuts 🥥'
          : 'Red Apples 🍎';
      if (shook.droppedFruit && shook.isHardwoodLoot) {
        this.ui.showToast('🌳', 'Shook the hardwood tree! 2 Coin Pouches 💰 & a Red Apple 🍎 bounced out!', 2600);
      } else if (shook.droppedFruit) {
        this.ui.showToast('🌳', `Shook the tree! 3 ${fruitLabel} bounced onto the grass!`, 2400);
      } else {
        this.ui.showToast('🍃', 'Shook the tree leaves!', 1600);
      }
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // Contextual Action Prompt Evaluation & Execution
  // --------------------------------------------------------------------------
  _projectToScreen(x, y, z) {
    this._projVec = this._projVec || new THREE.Vector3();
    this._projVec.set(x, y, z);
    // Apply world curve Y offset before projecting so the pill tracks curved objects accurately!
    if (WORLD_CURVE_UNIFORMS.uCurveEnabled.value > 0.5) {
      const dz = z - WORLD_CURVE_UNIFORMS.uCameraZ.value;
      const dx = (x - WORLD_CURVE_UNIFORMS.uCameraX.value) * WORLD_CURVE_UNIFORMS.uCurveRadialX.value;
      const dist = Math.max(0.0, Math.hypot(dx, dz) - WORLD_CURVE_UNIFORMS.uCurveStartDist.value);
      this._projVec.y -= WORLD_CURVE_UNIFORMS.uCurveStrength.value * dist * dist;
    }
    this._projVec.project(this.camera);
    return {
      x: (this._projVec.x * 0.5 + 0.5) * this.width,
      y: (-this._projVec.y * 0.5 + 0.5) * this.height,
    };
  }

  _evaluateNearestContextAction() {
    const player = this.characters.player;
    const pPos = player.group.position;

    // 1. Active Fishing Bobber
    if (this.fishingState && this.fishingState.active && this.fishingState.phase !== 'reeling') {
      const scr = this._projectToScreen(
        this.fishingState.waterX,
        this.fishingState.waterY + 0.55,
        this.fishingState.waterZ
      );
      return {
        type: 'reel_fish',
        key: 'Space',
        label:
          this.fishingState.phase === 'bite'
            ? '🎣 BITE! Reel In Fish!'
            : '🎣 Waiting for bite...',
        screenX: scr.x,
        screenY: scr.y,
      };
    }

    // 2. Seated on a Stump / Bench
    if (player.seatedOn) {
      const scr = this._projectToScreen(pPos.x, pPos.y + 1.55, pPos.z);
      return {
        type: 'stand_up',
        key: 'E',
        label: '🪑 Stand Up',
        screenX: scr.x,
        screenY: scr.y,
      };
    }

    // 3. Nearest Collectable Item (within 1.9m)
    if (this.environment && Array.isArray(this.environment.collectableItems)) {
      let bestItem = null;
      let bestD = 1.9;
      for (const it of this.environment.collectableItems) {
        if (!it || it.pickedUp || !it.ready || (it.mesh && !it.mesh.visible)) continue;
        const d = Math.hypot(it.x - pPos.x, it.z - pPos.z);
        if (d < bestD) {
          bestD = d;
          bestItem = it;
        }
      }
      if (bestItem) {
        const scr = this._projectToScreen(bestItem.x, (bestItem.y ?? 0.6) + 0.45, bestItem.z);
        const kind = bestItem.kind || bestItem.type;
        const label =
          kind === 'bells' || kind === 'bell_bag'
            ? '💰 Pick Up 500 Coins'
            : kind === 'orange'
            ? '🍊 Pick Up Orange'
            : kind === 'coconut'
            ? '🥥 Pick Up Coconut'
            : '🍎 Pick Up Red Apple';
        return {
          type: 'pickup_item',
          key: 'Space',
          label,
          screenX: scr.x,
          screenY: scr.y,
        };
      }
    }

    // 4. Nearest Villager (within 2.9m)
    const villager = this.characters.getClosestVillager(pPos.x, pPos.z, 2.9, false);
    if (villager) {
      const scr = this._projectToScreen(
        villager.group.position.x,
        villager.group.position.y + 1.55,
        villager.group.position.z
      );
      return {
        type: 'talk_villager',
        villager,
        key: 'E',
        label: `💬 Talk to ${villager.name}`,
        screenX: scr.x,
        screenY: scr.y,
      };
    }

    // 5. Nearest Critter (Butterfly / Dragonfly within 2.6m)
    const critter = this.characters.getClosestCritter?.(pPos.x, pPos.z, 2.6);
    if (critter) {
      const scr = this._projectToScreen(
        critter.group.position.x,
        critter.group.position.y + 0.45,
        critter.group.position.z
      );
      return {
        type: 'catch_critter',
        critter,
        key: 'Space',
        label: `🦋 Catch ${critter.speciesName || 'Butterfly'}`,
        screenX: scr.x,
        screenY: scr.y,
      };
    }

    // 6. DIY Carpenter's Workbench at (0.4, 0.6, -5.4)
    if (Math.hypot(0.4 - pPos.x, -5.4 - pPos.z) < 2.15) {
      const scr = this._projectToScreen(0.4, 1.85, -5.4);
      return {
        type: 'diy_workbench',
        key: 'E',
        label: '🔨 Craft at DIY Workbench',
        screenX: scr.x,
        screenY: scr.y,
      };
    }

    // 7. Nearest Tree (within 2.5m)
    const tree = this._getNearestTree(pPos.x, pPos.z, 2.5);
    if (tree) {
      const scr = this._projectToScreen(tree.x, tree.y + 2.2, tree.z);
      const tName =
        tree.type === 'orange'
          ? 'Orange Tree 🍊'
          : tree.type === 'palm'
          ? 'Coconut Palm 🥥'
          : 'Apple Tree 🍎';
      return {
        type: 'shake_tree',
        tree,
        key: 'Space',
        label: `🌳 Shake ${tName}`,
        screenX: scr.x,
        screenY: scr.y,
      };
    }

    // 8. Nearest Seat (within 2.1m)
    const seat = this.props.getNearestSeat?.(pPos.x, pPos.z, 2.1);
    if (seat) {
      const scr = this._projectToScreen(seat.x, seat.y + 0.85, seat.z);
      return {
        type: 'sit_seat',
        seat,
        key: 'E',
        label: `🪑 Sit on ${seat.label || 'Bench'}`,
        screenX: scr.x,
        screenY: scr.y,
      };
    }

    // 9. Near River or Ocean Shoreline -> Offer Fishing Cast!
    const waterTarget = this._findWaterTargetNearPlayer(3.1);
    if (waterTarget) {
      const scr = this._projectToScreen(waterTarget.x, waterTarget.y + 0.45, waterTarget.z);
      return {
        type: 'cast_fishing',
        waterTarget,
        key: 'Space',
        label: '🎣 Cast Fishing Rod',
        screenX: scr.x,
        screenY: scr.y,
      };
    }

    return null;
  }

  executeContextPromptAction() {
    const act = this._currentContextAction;
    if (!act) {
      this.triggerPrimaryToolOrInteract();
      return;
    }
    switch (act.type) {
      case 'reel_fish':
        this._reelInFish();
        break;
      case 'stand_up':
        this.characters.player.standUpFromSeat();
        break;
      case 'pickup_item':
        this._collectItemsAroundPlayer(2.0);
        break;
      case 'talk_villager':
        this.talkToVillager(act.villager);
        break;
      case 'catch_critter':
        this.ui.selectTool('bug_net', false);
        this.characters.setTool('bug_net');
        this.triggerPrimaryToolOrInteract();
        break;
      case 'diy_workbench':
        this.craftAtWorkbench();
        break;
      case 'shake_tree':
        this._shakeTree(act.tree);
        break;
      case 'sit_seat':
        this.toggleSitOrWave(act.seat);
        break;
      case 'cast_fishing':
        this._startFishingCast(act.waterTarget);
        break;
      default:
        this.triggerPrimaryToolOrInteract();
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Keyboard & 3D Pointer (Click-to-Walk & Click-to-Interact)
  // --------------------------------------------------------------------------
  _bindWorldInteractions() {
    this._raycaster = new THREE.Raycaster();
    this._pointerNDC = new THREE.Vector2();

    // Pointer Click on 3D Canvas -> Smart Click-to-Interact or Click-to-Walk!
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;

      // Ensure camera is following player if user clicks in the world
      if (this.cameraRig.activePreset !== 'follow_player') {
        this.cameraRig.setCameraPreset('follow_player', false);
      }

      // If fishing bobber is active and biting/cast, clicking reels it in!
      if (this.fishingState && this.fishingState.active) {
        this._reelInFish();
        return;
      }

      const rect = this.renderer.domElement.getBoundingClientRect();
      this._pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointerNDC, this.camera);

      // Intersect against terrain & water or horizontal plane y = 0.6
      const targets = [];
      if (this.environment?.root) targets.push(this.environment.root);
      if (this.props?.root) targets.push(this.props.root);
      if (this.characters?.root) targets.push(this.characters.root);

      const hits = this._raycaster.intersectObjects(targets, true);
      if (!hits.length) return;

      const hitPt = hits[0].point;
      const wx = hitPt.x;
      const wz = hitPt.z;
      const pPos = this.characters.player.group.position;

      // 1. Check if clicked directly on or beside a Villager
      const clickedVillager = this.characters.getClosestVillager(wx, wz, 1.35, false);
      if (clickedVillager) {
        const distToPlayer = Math.hypot(
          clickedVillager.group.position.x - pPos.x,
          clickedVillager.group.position.z - pPos.z
        );
        if (distToPlayer <= 3.0) {
          this.talkToVillager(clickedVillager);
        } else {
          this._walkPlayerTo(
            clickedVillager.group.position.x - 0.8,
            clickedVillager.group.position.z + 0.9,
            () => this.talkToVillager(clickedVillager)
          );
        }
        return;
      }

      // 2. Check if clicked on a Critter (Butterfly / Dragonfly)
      const clickedCritter = this.characters.getClosestCritter?.(wx, wz, 1.35);
      if (clickedCritter) {
        this.ui.selectTool('bug_net', false);
        this.characters.setTool('bug_net');
        if (Math.hypot(wx - pPos.x, wz - pPos.z) <= 2.6) {
          this.triggerPrimaryToolOrInteract();
        } else {
          this._walkPlayerTo(wx, wz, () => this.triggerPrimaryToolOrInteract());
        }
        return;
      }

      // 3. Check if clicked on a Tree
      const clickedTree = this._getNearestTree(wx, wz, 1.35);
      if (clickedTree) {
        if (Math.hypot(clickedTree.x - pPos.x, clickedTree.z - pPos.z) <= 2.4) {
          this._shakeTree(clickedTree);
        } else {
          this._walkPlayerTo(clickedTree.x, clickedTree.z + 1.35, () =>
            this._shakeTree(clickedTree)
          );
        }
        return;
      }

      // 4. Check if clicked on the DIY Workbench (0.4, -5.4)
      if (Math.hypot(wx - 0.4, wz - -5.4) < 1.25) {
        if (Math.hypot(pPos.x - 0.4, pPos.z - -5.4) <= 2.15) {
          this.craftAtWorkbench();
        } else {
          this._walkPlayerTo(-0.4, -5.4, () => this.craftAtWorkbench());
        }
        return;
      }

      // 5. Check if clicked on a Seat
      const clickedSeat = this.props.getNearestSeat?.(wx, wz, 1.05);
      if (clickedSeat) {
        if (Math.hypot(clickedSeat.x - pPos.x, clickedSeat.z - pPos.z) <= 2.2) {
          this.toggleSitOrWave(clickedSeat);
        } else {
          this._walkPlayerTo(clickedSeat.x, clickedSeat.z + 0.9, () =>
            this.toggleSitOrWave(clickedSeat)
          );
        }
        return;
      }

      // 6. Check if clicked on River or Ocean water -> Cast Fishing Rod!
      const surf = this.gridSystem.getSurfaceType(wx, wz);
      if (surf === 'river' || surf === 'ocean') {
        const waterTarget = {
          x: wx,
          z: wz,
          y: surf === 'ocean' ? 0.05 : 0.18,
          surface: surf,
        };
        if (Math.hypot(wx - pPos.x, wz - pPos.z) <= 4.6) {
          this._startFishingCast(waterTarget);
        } else {
          // Walk toward the bank near that water spot
          const bankZ = surf === 'ocean' ? 19.5 : wz > -3.8 ? wz + 2.2 : wz - 2.2;
          this._walkPlayerTo(wx, bankZ, () => this._startFishingCast(waterTarget));
        }
        return;
      }

      // 7. Default: Walk smoothly to the clicked terrain point!
      this._walkPlayerTo(wx, wz, null);
    });

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      // Switch to dynamic follow camera if user moves with WASD/Arrows
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          e.code
        )
      ) {
        if (this.fishingState.active) {
          this._cancelFishing();
        }
        if (this.cameraRig.activePreset !== 'follow_player') {
          this.cameraRig.setCameraPreset('follow_player', false);
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        this.triggerPrimaryToolOrInteract();
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        const pPos = this.characters.player.group.position;
        if (this.characters.player.seatedOn) {
          this.characters.player.standUpFromSeat();
          return;
        }
        const villager = this.characters.getClosestVillager(pPos.x, pPos.z, 3.1, false);
        if (villager) {
          this.talkToVillager(villager);
        } else if (Math.hypot(0.4 - pPos.x, -5.4 - pPos.z) < 2.2) {
          this.craftAtWorkbench();
        } else {
          this.toggleSitOrWave();
        }
      }
    });
  }

  _walkPlayerTo(wx, wz, onArrive = null) {
    if (this.fishingState.active) this._cancelFishing();
    const gy = this.gridSystem.getTerrainHeight(wx, wz);
    this.walkTargetGroup.position.set(wx, gy + 0.04, wz);
    this.walkTargetGroup.visible = true;
    this.walkRingTimer = 2.5;
    this.characters.player.moveTo(wx, wz, () => {
      this.walkTargetGroup.visible = false;
      if (typeof onArrive === 'function') onArrive();
    });
  }

  _onResize() {
    this.width = window.innerWidth || 1280;
    this.height = window.innerHeight || 720;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.postProcessor.setSize(this.width, this.height);
  }

  step(dt, renderFrame = true) {
    const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
    this.elapsed += clampedDt;
    WORLD_CURVE_UNIFORMS.uTime.value = this.elapsed;

    const playerObj = this.characters.player.group;

    // 1. Update all 5 domain subsystems
    this.cameraRig.update(clampedDt, playerObj);
    this.dayNight.update(clampedDt, this.elapsed, playerObj.position);
    this.environment.update(clampedDt, this.elapsed);
    this.props.update(clampedDt, this.elapsed, this.dayNight.currentMode);
    this.characters.update(clampedDt, this.elapsed);
    this.particles.update(clampedDt, this.elapsed, {
      player: this.characters.player,
      gridSystem: this.gridSystem,
      timeOfDay: this.dayNight.currentMode,
    });

    // 2. Auto-collect dropped fruits & Coin pouches when walking over them in free roam
    if (
      this.characters.currentPreset === 'free_roam' ||
      this.characters.currentPreset === 'follow_player'
    ) {
      this._collectItemsAroundPlayer(1.2);
    }

    // 3. Update 3D Fishing Bobber & Click-to-Walk Ring
    this._updateFishing(clampedDt, this.elapsed);
    if (this.walkTargetGroup && this.walkTargetGroup.visible) {
      this.walkRingTimer -= clampedDt;
      const pulse = 0.85 + Math.sin(this.elapsed * 7.0) * 0.18;
      this.walkRingMesh.scale.setScalar(pulse);
      if (this.walkRingTimer <= 0 || !this.characters.player.targetPos) {
        this.walkTargetGroup.visible = false;
      }
    }

    // 4. Update Floating 3D Contextual Action Prompt Pill
    if (renderFrame) {
      this._currentContextAction = this._evaluateNearestContextAction();
      this.ui.updateContextPrompt(this._currentContextAction);
      this.ui.update(clampedDt, this.elapsed);

      // 5. Render with SSAO, Warm Bloom, Tilt-Shift DOF & Argon Valley Pastel Color Grading
      if (this.postProcessor && this.postProcessor.enabled) {
        this.postProcessor.render(clampedDt, this.elapsed);
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    }
  }

  setCaptureState(presetName, tod = null, clean = true) {
    const uiRoot = document.getElementById('ui-root');
    if (clean) {
      document.documentElement.classList.add('clean-mode');
      document.body?.classList.add('clean-mode');
      if (uiRoot) uiRoot.style.display = 'none';
      this.ui.setCleanMode?.(true);
    } else {
      document.documentElement.classList.remove('clean-mode');
      document.body?.classList.remove('clean-mode');
      if (uiRoot) {
        uiRoot.classList.remove('clean-hidden');
        uiRoot.style.display = '';
      }
      this.ui.isCleanMode = false;
      this.ui.setCleanMode?.(false);
    }
    this.ui.selectPreset(presetName, false);
    this.applyScenePreset(presetName, true);
    if (tod) {
      this.applyTimeOfDay(tod, true);
      this.ui.setTimeOfDay(tod);
    }
    this.step(0.016);
    return presetName;
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = this.clock.getDelta();
    this.step(dt);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    new CozyIslandApp();
  });
} else {
  new CozyIslandApp();
}
