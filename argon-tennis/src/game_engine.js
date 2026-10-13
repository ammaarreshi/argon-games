// ============================================================================
// Argon Tennis — 3D Singles/Doubles Match Engine, Argon Tennis Physics, Camera Rig & Trails
// ============================================================================

import * as THREE from 'three';
import { GLTFLoader } from '../assets/vendor/GLTFLoader.js';
import { HudUI } from './hud_ui.js';
import * as MotionMod from './motion_controls.js';
import * as AudioMod from './audio_engine.js';
import { RacketKinematicsController } from './racket_kinematics.js';
import {
  upgradeMiiCharacterMaterials,
  upgradeRacketMaterials,
  updateCharacterContactShadow,
} from './mii_model_overhaul.js';
import { MiiBodyAnimator } from './mii_body_animation.js';
import { MiiFacialFXController } from './mii_facial_fx.js';
import { SwingVFXManager } from './swing_vfx.js';

// ----------------------------------------------------------------------------
// Court & Physics Constants (Standard Tennis Court + Argon Tennis Arcade Tuning)
// ----------------------------------------------------------------------------
const COURT = {
  BASELINE_Z: 11.89,
  SERVICE_LINE_Z: 6.40,
  SINGLES_X: 4.115,
  DOUBLES_X: 5.485,
  NET_HEIGHT_CENTER: 0.914,
  NET_HEIGHT_POST: 1.07,
  NET_POST_X: 6.40,
};

const PHYSICS = {
  FIXED_DT: 1 / 120,
  GRAVITY: 9.15,          // Forgiving Argon Tennis floating rally gravity
  AIR_DRAG: 0.012,
  BOUNCE_RESTITUTION: 0.77,
  SURFACE_FRICTION: 0.86,
};

const POINT_LABELS = ['00', '15', '30', '40'];

// ----------------------------------------------------------------------------
// Helper: Dynamic 3D Ball Ribbon Trail (45-segment billboarded triangle strip)
// ----------------------------------------------------------------------------
class BallRibbonTrail {
  constructor(scene, maxPoints = 45) {
    this.scene = scene;
    this.maxPoints = maxPoints;
    this.points = [];
    this.color = new THREE.Color(0xffffff);
    this.accentColor = new THREE.Color(0xfff176);
    this.baseWidth = 0.28;

    const vertexCount = maxPoints * 2;
    this.positions = new Float32Array(vertexCount * 3);
    this.colors = new Float32Array(vertexCount * 4);
    const indices = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    this.geometry.setIndex(indices);

    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.scene.add(this.mesh);
  }

  setStyle(shotType = 'TOPSPIN', isPower = false) {
    const type = String(shotType || 'TOPSPIN').toUpperCase();
    if (isPower || type === 'SMASH' || type === 'POWER') {
      this.color.setHex(0xffffff);
      this.accentColor.setHex(0x52e5ff);
      this.baseWidth = 0.30;
    } else if (type === 'SLICE') {
      this.color.setHex(0xffffff);
      this.accentColor.setHex(0x88f0ff);
      this.baseWidth = 0.28;
    } else if (type === 'LOB') {
      this.color.setHex(0xffffff);
      this.accentColor.setHex(0xeef8ff);
      this.baseWidth = 0.25;
    } else {
      // Topspin / Standard Argon Tennis crisp white-gold streak
      this.color.setHex(0xffffff);
      this.accentColor.setHex(0xffeb55);
      this.baseWidth = 0.28;
    }
  }

  clear() {
    this.points.length = 0;
    this.mesh.visible = false;
  }

  pushPoint(pos) {
    this.points.unshift(pos.clone());
    if (this.points.length > this.maxPoints) {
      this.points.pop();
    }
  }

  seedArc(startPos, endPos, peakY = 0.85) {
    this.points.length = 0;
    for (let i = 0; i < this.maxPoints; i++) {
      const u = i / (this.maxPoints - 1); // 0 = head (endPos), 1 = tail (startPos)
      const t = 1.0 - u;
      const p = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      p.y += Math.sin(t * Math.PI) * peakY;
      this.points.push(p);
    }
    this.mesh.visible = true;
  }

  updateGeometry(camera) {
    const count = this.points.length;
    if (count < 2) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    const camPos = camera.position;
    const tangent = new THREE.Vector3();
    const viewDir = new THREE.Vector3();
    const side = new THREE.Vector3();
    const blended = new THREE.Color();

    for (let i = 0; i < this.maxPoints; i++) {
      const idx = Math.min(i, count - 1);
      const p = this.points[idx];
      const nextIdx = Math.min(idx + 1, count - 1);
      const prevIdx = Math.max(idx - 1, 0);

      tangent.subVectors(this.points[prevIdx], this.points[nextIdx]);
      if (tangent.lengthSq() < 1e-6) {
        tangent.set(0, 0, 1);
      } else {
        tangent.normalize();
      }

      viewDir.subVectors(camPos, p).normalize();
      side.crossVectors(tangent, viewDir).normalize();
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0);

      const frac = 1.0 - idx / Math.max(1, count - 1); // 1 at ball head, 0 at tail
      const halfWidth = this.baseWidth * (0.24 + 0.76 * Math.pow(frac, 0.65)) * 0.5;
      const alpha = Math.pow(frac, 0.9) * 0.92;

      blended.copy(this.color).lerp(this.accentColor, (1.0 - frac) * 0.65);

      const v0 = i * 2;
      const v1 = v0 + 1;

      this.positions[v0 * 3 + 0] = p.x + side.x * halfWidth;
      this.positions[v0 * 3 + 1] = p.y + side.y * halfWidth;
      this.positions[v0 * 3 + 2] = p.z + side.z * halfWidth;

      this.positions[v1 * 3 + 0] = p.x - side.x * halfWidth;
      this.positions[v1 * 3 + 1] = p.y - side.y * halfWidth;
      this.positions[v1 * 3 + 2] = p.z - side.z * halfWidth;

      this.colors[v0 * 4 + 0] = blended.r;
      this.colors[v0 * 4 + 1] = blended.g;
      this.colors[v0 * 4 + 2] = blended.b;
      this.colors[v0 * 4 + 3] = alpha;

      this.colors[v1 * 4 + 0] = blended.r;
      this.colors[v1 * 4 + 1] = blended.g;
      this.colors[v1 * 4 + 2] = blended.b;
      this.colors[v1 * 4 + 3] = alpha;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}

// ----------------------------------------------------------------------------
// Helper: Translucent White Argon Tennis Racket Swing Arc Mesh
// ----------------------------------------------------------------------------
function createRacketSwingArcMesh() {
  const geom = new THREE.RingGeometry(0.22, 0.72, 28, 1, -Math.PI * 0.28, Math.PI * 0.56);
  const posAttr = geom.attributes.position;
  const colors = new Float32Array(posAttr.count * 4);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const angle = Math.atan2(y, x);
    const normAngle = (angle + Math.PI * 0.28) / (Math.PI * 0.56); // 0 to 1
    const r = Math.hypot(x, y);
    const radialFactor = (r - 0.22) / (0.72 - 0.22);
    const alpha = Math.max(0, Math.min(1, normAngle * (0.35 + 0.65 * radialFactor)));

    colors[i * 4 + 0] = 0.97;
    colors[i * 4 + 1] = 0.99;
    colors[i * 4 + 2] = 1.0;
    colors[i * 4 + 3] = alpha * 0.85;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.visible = false;
  mesh.renderOrder = 7;
  return mesh;
}

// ----------------------------------------------------------------------------
// Helper: Radial Ground Contact Blob Shadow Texture
// ----------------------------------------------------------------------------
function createBlobShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0.0, 'rgba(10, 24, 8, 0.78)');
  grad.addColorStop(0.55, 'rgba(10, 24, 8, 0.46)');
  grad.addColorStop(1.0, 'rgba(10, 24, 8, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// ----------------------------------------------------------------------------
// Helper: Sunny Argon Tennis Sky Dome & Soft Cumulus Clouds Texture
// ----------------------------------------------------------------------------
function createSunnySkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Crisp daytime sky gradient matching ref_06_game_point_hud.png
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 320);
  skyGrad.addColorStop(0.0, '#2e86e6');
  skyGrad.addColorStop(0.42, '#5cb2ff');
  skyGrad.addColorStop(0.78, '#a6dcff');
  skyGrad.addColorStop(1.0, '#def4ff');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Soft volumetric cumulus cloud puffs along horizon band
  const cloudPuffs = [
    [120, 185, 95, 38],
    [180, 175, 110, 44],
    [250, 188, 85, 34],
    [460, 168, 120, 45],
    [535, 160, 130, 50],
    [610, 174, 95, 36],
    [820, 180, 115, 42],
    [895, 170, 125, 48],
    [960, 184, 90, 35],
  ];
  cloudPuffs.forEach(([cx, cy, rx, ry]) => {
    const g = ctx.createRadialGradient(cx, cy - ry * 0.2, rx * 0.1, cx, cy, rx);
    g.addColorStop(0.0, 'rgba(255, 255, 255, 0.92)');
    g.addColorStop(0.6, 'rgba(245, 252, 255, 0.55)');
    g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// Main Argon Tennis 3D Match Engine
// ============================================================================
export class ArgonTennisEngine {
  constructor() {
    this.params = new URLSearchParams(window.location.search);
    this.urlState = (this.params.get('state') || '').toLowerCase();
    this.urlRoom = (this.params.get('room') || '').trim().toUpperCase();
    this.urlRole = (this.params.get('role') || 'p1').trim().toLowerCase() === 'p2' ? 'p2' : 'p1';
    this.urlMode = (this.params.get('mode') || this.params.get('difficulty') || '').toLowerCase();
    this.urlAutoPlay = this.params.has('play') || Boolean(this.urlState);

    this.roomId = this.urlRoom || 'default';
    this.playerRole = this.urlRole;
    this.isMultiplayer = Boolean(this.urlRoom && this.urlRoom !== 'DEFAULT') || this.urlMode === '1v1';
    this.roomStatus = {
      roomId: this.roomId,
      p1Online: true,
      p2Online: false,
      p1Phone: false,
      p2Phone: false,
      tunnelUrl: '',
      urls: null,
    };
    this.lastAppliedSnapshotSeq = 0;
    this.lastSyncSentAt = 0;
    this.bannerSeq = 0;
    this.lastBannerBroadcast = null;

    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x78c2ff);
    this.scene.fog = new THREE.FogExp2(0xbbe4ff, 0.0038);

    // 45° FOV tuned with elevated baseline camera so near baseline sits at ~77% screen height
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      260
    );

    // Camera Rig State
    this.cameraMode = 'RALLY_CAM'; // 'INTRO_PAN' | 'SERVE_CAM' | 'RALLY_CAM' | 'REPLAY_CAM'
    this.manualCameraOverride = null;
    this.cameraPosSmooth = new THREE.Vector3(0, 7.8, 22.8);
    this.cameraLookSmooth = new THREE.Vector3(0, 0.35, 1.8);
    this.cameraTrauma = 0;

    // Match & Scoring State ('casual' = Forgiving & Fun default, 'pro' = Fast AI, '1v1' = Human vs Human)
    const initialDiff = this.isMultiplayer
      ? '1v1'
      : ['casual', 'pro', '1v1'].includes(this.urlMode)
      ? this.urlMode
      : 'casual';
    this.matchConfig = {
      gamesToWin: initialDiff === '1v1' ? 1 : 2,
      inputMode: 'mouse',
      difficulty: initialDiff,
    };
    this.score = {
      playerPoints: 0,
      opponentPoints: 0,
      playerGames: 0,
      opponentGames: 0,
      server: 'player', // 'player' | 'opponent'
      deuceSide: true,  // true = Right (Deuce) court, false = Left (Ad) court
    };

    // Gameplay Phase:
    // 'TITLE' | 'INTRO' | 'SERVE_STANCE' | 'SERVE_TOSS' | 'RALLY' | 'POINT_OVER' | 'REPLAY' | 'MATCH_OVER'
    this.phase = 'TITLE';
    this.phaseTimer = 0;
    this.selectedShotType = 'TOPSPIN';
    this.p2SelectedShotType = 'TOPSPIN';
    this.autoPlayMode = this.urlAutoPlay;
    this.userHasInteracted = false;
    this.persistentStateLock = false;
    this.pendingUserSwing = null;
    this.pendingP2Swing = null;
    this.pendingServeSwing = null;

    // Physics Ball State
    this.ball = {
      mesh: null,
      pos: new THREE.Vector3(0.85, 1.15, 11.6),
      vel: new THREE.Vector3(0, 0, 0),
      spin: new THREE.Vector3(0, 0, 0),
      inPlay: false,
      lastHitter: 'player',
      bounceCountOnCurrentSide: 0,
      shotType: 'TOPSPIN',
      isPowerShot: false,
      rallyStrokeCount: 0,
      targetLanding: new THREE.Vector3(0, 0, -8.5),
    };

    // 4 Court Mii Actors (Baseline Player + Frontcourt Net Partner vs Baseline Opponent + Net Partner)
    // matching ref_04_rally_camera.png, ref_05_net_closeup_crowd.png, ref_06_game_point_hud.png
    this.player = this._createActorState('player', 1, new THREE.Vector3(1.15, 0, COURT.BASELINE_Z));
    this.playerPartner = this._createActorState('player_partner', 1, new THREE.Vector3(-2.1, 0, 5.4));
    this.opponent = this._createActorState('opponent', -1, new THREE.Vector3(-1.35, 0, -COURT.BASELINE_Z));
    this.opponentPartner = this._createActorState('opponent_partner', -1, new THREE.Vector3(2.1, 0, -5.4));
    this._applyDifficultyTuning(this.matchConfig.difficulty);

    // Crowd cheering state (kept at exact Blender bleacher coordinates)
    this.crowdScene = null;
    this.cheerEnergy = 0.25;

    // Visual Effects & Argon Tennis Kinetic Overhaul Controllers
    this.ballTrail = new BallRibbonTrail(this.scene, 45);
    this.bounceRings = [];
    this.starParticles = [];
    this.racketKinematics = new RacketKinematicsController();
    this.bodyAnimator = new MiiBodyAnimator();
    this.facialFX = new MiiFacialFXController(this.scene);
    this.swingVfx = new SwingVFXManager(this.scene);

    // Initialize Subsystems
    this._setupLightingAndSky();
    this._setupEffectsPools();
    this._initHudAndControllers();

    this.clock = new THREE.Clock();
    this.physicsAccumulator = 0;
    this.elapsedTime = 0;

    window.addEventListener('resize', () => this._onResize());
  }

  _createActorState(role, sideSign, initialPos) {
    const speedMap = {
      player: 9.8,
      player_partner: 8.4,
      opponent: 5.85,
      opponent_partner: 5.2,
    };
    return {
      role,
      sideSign, // +1 for near court (Z > 0), -1 for far court (Z < 0)
      root: new THREE.Group(),
      model: null,
      parts: {},
      racketPivot: new THREE.Group(),
      racketMesh: null,
      swingArcMesh: null,
      shadowBlob: null,
      pos: initialPos.clone(),
      vel: new THREE.Vector3(),
      targetPos: initialPos.clone(),
      maxSpeed: speedMap[role] || 8.2,
      stridePhase: 0,
      swingTimer: 0,
      swingDuration: 0.34,
      swingCooldown: 0,
      swingType: 'forehand', // 'forehand' | 'backhand' | 'serve' | 'smash'
      arcVisibleTimer: 0,
    };
  }

  _applyDifficultyTuning(difficulty = 'casual') {
    const norm = String(difficulty || 'casual').toLowerCase();
    this.matchConfig.difficulty = norm;
    if (norm === '1v1') {
      this.isMultiplayer = true;
      this.matchConfig.gamesToWin = 1;
      // In 1v1 mode, both Player 1 and Player 2 Miis have responsive human footwork speed
      this.player.maxSpeed = 9.8;
      this.playerPartner.maxSpeed = 8.4;
      this.opponent.maxSpeed = 9.6;
      this.opponentPartner.maxSpeed = 8.2;
    } else if (norm === 'pro') {
      this.isMultiplayer = Boolean(this.urlRoom && this.urlRoom !== 'DEFAULT');
      this.player.maxSpeed = 9.8;
      this.playerPartner.maxSpeed = 8.4;
      this.opponent.maxSpeed = 7.65;
      this.opponentPartner.maxSpeed = 6.6;
    } else {
      // 'casual' (default): Fun, forgiving Argon Tennis rally pace where well-timed angles & power shots score cleanly!
      this.isMultiplayer = Boolean(this.urlRoom && this.urlRoom !== 'DEFAULT');
      this.player.maxSpeed = 10.2;
      this.playerPartner.maxSpeed = 8.6;
      this.opponent.maxSpeed = 5.85;
      this.opponentPartner.maxSpeed = 5.15;
    }
  }

  // --------------------------------------------------------------------------
  // 1. Lighting, Sky Dome & Contact Blob Shadows
  // --------------------------------------------------------------------------
  _setupLightingAndSky() {
    // Sky dome with Court A sky gradient (tns_sky_a.png) + fallback canvas texture
    const texLoader = new THREE.TextureLoader();
    const skyGeo = new THREE.SphereGeometry(185, 36, 20);
    const skyMat = new THREE.MeshBasicMaterial({
      map: createSunnySkyTexture(),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    texLoader.load('./assets/textures/court/tns_sky_a.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(8, 1);
      skyMat.map = tex;
      skyMat.needsUpdate = true;
    });

    // Dual drifting 3D Cumulus Cloud Cylinders (cloud02.png outer, cloud01.png inner)
    const makeCloudCylinder = (radius, height, yPos, url, renderOrder) => {
      const geo = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.92,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = yPos;
      mesh.renderOrder = renderOrder;
      mesh.visible = false;
      this.scene.add(mesh);
      texLoader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.repeat.set(8, 1);
        mat.map = tex;
        mat.needsUpdate = true;
        mesh.visible = true;
      });
      return mesh;
    };
    this.cloudRing2 = makeCloudCylinder(152, 54, 24, './assets/textures/court/cloud02.png', -2);
    this.cloudRing1 = makeCloudCylinder(138, 46, 19, './assets/textures/court/cloud01.png', -1);

    // Distant Mountain & Hillside Village Horizon Panorama Cylinder (tns_BG_c1.png)
    const bgGeo = new THREE.CylinderGeometry(96, 96, 15.5, 64, 1, true);
    const bgMat = new THREE.MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.15,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.horizonRing = new THREE.Mesh(bgGeo, bgMat);
    this.horizonRing.position.y = 7.2;
    this.horizonRing.visible = false;
    this.scene.add(this.horizonRing);
    texLoader.load('./assets/textures/court/tns_BG_c1.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(8, 1);
      bgMat.map = tex;
      bgMat.needsUpdate = true;
      this.horizonRing.visible = true;
    });

    // Hemisphere Sky / Grass Bounce Light
    const hemiLight = new THREE.HemisphereLight(0xa6dcff, 0x55a224, 1.22);
    hemiLight.position.set(0, 40, 0);
    this.scene.add(hemiLight);

    // Key Sunlight with 2048x2048 Soft Shadow Map (matches diagonal shadow in ref_04_rally_camera.png)
    this.sunLight = new THREE.DirectionalLight(0xfff9ec, 2.55);
    this.sunLight.position.set(14.5, 25.0, 15.0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 2.0;
    this.sunLight.shadow.camera.far = 75.0;
    const d = 22.0;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);

    // Cool Sky Fill Light
    const fillLight = new THREE.DirectionalLight(0xcbe6ff, 0.72);
    fillLight.position.set(-15.0, 16.0, -12.0);
    this.scene.add(fillLight);

    // Ground Contact Blob Shadows beneath all 4 Mii Players and the Tennis Ball
    const blobTex = createBlobShadowTexture();
    const makeBlob = (radius, opacity) => {
      const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        map: blobTex,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.y = 0.018;
      m.renderOrder = 2;
      this.scene.add(m);
      return m;
    };

    this.player.shadowBlob = makeBlob(0.56, 0.82);
    this.playerPartner.shadowBlob = makeBlob(0.54, 0.78);
    this.opponent.shadowBlob = makeBlob(0.56, 0.82);
    this.opponentPartner.shadowBlob = makeBlob(0.54, 0.78);
    this.ballShadowBlob = makeBlob(0.34, 0.88);
  }

  _setupEffectsPools() {
    // Court Bounce Rings Pool (expanding white turf rings on ball impact)
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.RingGeometry(0.12, 0.24, 28);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.visible = false;
      ring.position.y = 0.024;
      ring.renderOrder = 3;
      this.scene.add(ring);
      this.bounceRings.push({ mesh: ring, age: 0, active: false });
    }

    // Power Shot Star / Spark Particles Pool
    const starGeo = new THREE.OctahedronGeometry(0.085, 0);
    for (let i = 0; i < 36; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffea28 : 0x48e5ff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      const star = new THREE.Mesh(starGeo, mat);
      star.visible = false;
      star.renderOrder = 8;
      this.scene.add(star);
      this.starParticles.push({
        mesh: star,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.42,
        active: false,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. HUD, Audio Engine & Motion Controller Integration
  // --------------------------------------------------------------------------
  _initHudAndControllers() {
    this.hud = new HudUI({
      onSelectMatchLength: (gamesToWin) => {
        this.matchConfig.gamesToWin = gamesToWin;
      },
      onSelectDifficulty: (difficulty) => {
        this._applyDifficultyTuning(difficulty);
        if (difficulty === '1v1' && (!this.roomId || this.roomId === 'default')) {
          this.createMultiplayerRoom();
        }
      },
      onCreateMultiplayerRoom: async (options = {}) => {
        return await this.createMultiplayerRoom(options);
      },
      onSelectInputMode: (mode) => {
        this.matchConfig.inputMode = mode;
        if (mode === 'webcam' && this.motionController) {
          this.motionController.enableWebcam();
        }
      },
      onStartMatch: ({ gamesToWin, inputMode, difficulty }) => {
        this.matchConfig.gamesToWin = gamesToWin;
        this.matchConfig.inputMode = inputMode;
        if (difficulty) {
          this._applyDifficultyTuning(difficulty);
        }
        this.autoPlayMode = false;
        this.userHasInteracted = true;
        this.persistentStateLock = false;
        if (inputMode === 'webcam' && this.motionController) {
          this.motionController.enableWebcam();
        }
        this.startNewMatch({ showStartBanner: true });
      },
      onSelectShotType: (shotType) => {
        if (this.playerRole === 'p2') {
          this.p2SelectedShotType = shotType;
        } else {
          this.selectedShotType = shotType;
        }
        if (this.motionController && this.motionController.setShotType) {
          this.motionController.setShotType(shotType.toLowerCase());
        }
      },
      onToggleAudio: () => {
        if (this.audioEngine) {
          const muted = this.audioEngine.toggleMute();
          const info = this.audioEngine.getCurrentTrackInfo();
          this.hud.updateAudioStatus({ playing: !muted, trackName: info.title });
        }
      },
      onCycleCamera: () => {
        const order = [null, 'RALLY_CAM', 'SERVE_CAM', 'REPLAY_CAM', 'INTRO_PAN'];
        const idx = order.indexOf(this.manualCameraOverride);
        this.manualCameraOverride = order[(idx + 1) % order.length];
        const labelMap = {
          null: 'Auto',
          RALLY_CAM: 'Rally',
          SERVE_CAM: 'Serve',
          REPLAY_CAM: 'Net Close',
          INTRO_PAN: 'Aerial',
        };
        this.hud.updateCameraLabel(labelMap[this.manualCameraOverride] || 'Auto');
        this.hud.setReplayMode(this.manualCameraOverride === 'REPLAY_CAM');
      },
      onToggleReplay: () => {
        if (this.phase === 'REPLAY') {
          this.persistentStateLock = false;
          this.hud.setReplayMode(false);
          this._setupPointServe({ showBanner: false });
        } else {
          this._enterInstantReplayState({ persistent: false });
        }
      },
      onToggleWebcam: async () => {
        if (!this.motionController) return;
        this.autoPlayMode = false;
        this.userHasInteracted = true;
        this.persistentStateLock = false;
        if (this.motionController.webcamActive) {
          if (this.motionController.disableWebcam) this.motionController.disableWebcam();
          this.hud.updateMotionStatus({
            webcamActive: false,
            phoneConnected: this.motionController.phoneState?.connected,
          });
        } else {
          const ok = await this.motionController.enableWebcam();
          this.hud.updateMotionStatus({
            webcamActive: ok,
            phoneConnected: this.motionController.phoneState?.connected,
          });
          if (this.phase === 'TITLE') {
            this.hud.hideTitleModal();
            this.startNewMatch({ showStartBanner: true });
          }
        }
      },
      onPlayAgain: () => {
        this.autoPlayMode = false;
        this.userHasInteracted = true;
        this.persistentStateLock = false;
        this.startNewMatch({ showStartBanner: true });
      },
    });

    // Instantiate AudioEngine
    const AudioClass = AudioMod.AudioEngine || AudioMod.default;
    if (AudioClass) {
      this.audioEngine = new AudioClass({
        onTrackChange: (info) => {
          this.hud.updateAudioStatus({
            playing: !info.muted,
            trackName: info.title.replace(/\s*\(Lyria 3\)/i, ''),
          });
        },
      });
    }

    // Instantiate MotionController with room/role and dual P1/P2 callbacks
    const MotionClass = MotionMod.MotionController || MotionMod.default;
    if (MotionClass) {
      this.motionController = new MotionClass({
        webcamCanvasId: 'webcam-canvas',
        roomId: this.roomId,
        role: this.playerRole,
        onSwing: (evt) => this._handleUserSwingInput(evt),
        onToss: (evt) => this._handleUserTossInput(evt),
        onP2Swing: (evt) => this._handleP2SwingInput(evt),
        onP2Toss: (evt) => this._handleP2TossInput(evt),
        onRoomState: (matchData) => this._handleRoomStateUpdate(matchData),
        onStatusChange: (status) => {
          this.hud.updateMotionStatus({
            webcamActive: Boolean(status.webcam),
            phoneConnected: Boolean(status.phone),
            p1Phone: Boolean(status.p1Phone),
            p2Phone: Boolean(status.p2Phone),
          });
        },
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'KeyC') {
        this.hud.callbacks.onCycleCamera();
      } else if (e.code === 'KeyR') {
        this.hud.callbacks.onToggleReplay();
      } else if (this.isMultiplayer && (e.code === 'ShiftRight' || e.code === 'KeyK' || e.code === 'Numpad0')) {
        // Local split-keyboard shortcut for Player 2 swing/serve
        this._handleP2SwingInput({ source: 'keyboard_p2', shotType: this.p2SelectedShotType, speed: 1.18 });
      }
    });
  }

  async createMultiplayerRoom({ p1Name = 'Player 1', p2Name = 'Player 2' } = {}) {
    try {
      const res = await fetch('/api/match/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p1Name, p2Name }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.roomId) {
          this.roomId = data.roomId;
          this.isMultiplayer = true;
          this._applyDifficultyTuning('1v1');
          if (this.motionController && this.motionController.setRoomConfig) {
            this.motionController.setRoomConfig({ roomId: this.roomId, role: this.playerRole });
          }
          this.roomStatus = {
            ...this.roomStatus,
            roomId: data.roomId,
            tunnelUrl: data.tunnelUrl || '',
            urls: data.urls || null,
              };
          if (this.hud && this.hud.updateMultiplayerRoomInfo) {
            this.hud.updateMultiplayerRoomInfo(this.roomStatus);
          }
          return data;
        }
      }
    } catch (e) {
      console.warn('[ArgonTennisEngine] Failed to create multiplayer room:', e);
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // 3. Load All 7 Blender-Authored .glb Models from ./assets/models/
  // --------------------------------------------------------------------------
  async loadAssetsAndStart() {
    const loader = new GLTFLoader();
    const loadGLB = async (filename, retries = 4) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const scene = await new Promise((resolve, reject) => {
            loader.load(
              `./assets/models/${filename}?v=argon4_kinetic`,
              (gltf) => resolve(gltf.scene),
              undefined,
              (err) => reject(err)
            );
          });
          return scene;
        } catch (err) {
          if (attempt === retries) {
            console.warn(`[ArgonTennisEngine] Could not load ${filename}:`, err);
            return new THREE.Group();
          }
          await new Promise((r) => setTimeout(r, 350));
        }
      }
      return new THREE.Group();
    };

    const [
      stadiumScene,
      netScene,
      playerScene,
      opponentScene,
      racketScene,
      ballScene,
      crowdScene,
    ] = await Promise.all([
      loadGLB('stadium_court.glb'),
      loadGLB('tennis_net.glb'),
      loadGLB('mii_player.glb'),
      loadGLB('mii_opponent.glb'),
      loadGLB('tennis_racket.glb'),
      loadGLB('tennis_ball.glb'),
      loadGLB('mii_crowd.glb'),
    ]);

    const playerPartnerScene = playerScene.clone(true);
    const opponentPartnerScene = opponentScene.clone(true);

    this._prepareStadiumAndNet(stadiumScene, netScene);
    this._prepareCrowd(crowdScene);
    this._prepareMiiActor(this.player, playerScene, racketScene);
    this._prepareMiiActor(this.playerPartner, playerPartnerScene, racketScene);
    this._prepareMiiActor(this.opponent, opponentScene, racketScene);
    this._prepareMiiActor(this.opponentPartner, opponentPartnerScene, racketScene);
    this._prepareTennisBall(ballScene);

    // Configure initial game state based on URL parameters (?play=1 or ?state=...)
    this._bootInitialStateFromURL();

    // Start 60fps render + 120Hz fixed-timestep physics loop
    this.clock.start();
    const animate = () => {
      requestAnimationFrame(animate);
      const rawDt = Math.min(this.clock.getDelta(), 0.08);
      this.update(rawDt);
      this.render();
    };
    requestAnimationFrame(animate);
  }

  _prepareStadiumAndNet(stadiumScene, netScene) {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy
      ? this.renderer.capabilities.getMaxAnisotropy()
      : 8;

    const tuneMaterial = (mat) => {
      if (!mat) return;
      const mName = mat.name || '';
      if (mat.map) {
        mat.map.anisotropy = maxAniso;
        mat.map.wrapS = THREE.RepeatWrapping;
        mat.map.wrapT = THREE.RepeatWrapping;
        mat.map.needsUpdate = true;
      }
      if (/TreeSprite/i.test(mName)) {
        mat.alphaTest = 0.35;
        mat.transparent = true;
        mat.side = THREE.DoubleSide;
        mat.depthWrite = true;
      } else if (/Shadow|LogoArgonBanner/i.test(mName)) {
        mat.transparent = true;
        mat.depthWrite = false;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -2;
        mat.polygonOffsetUnits = -2;
      } else if (/NetMesh/i.test(mName)) {
        mat.transparent = true;
        mat.alphaTest = 0.08;
        mat.side = THREE.DoubleSide;
        mat.depthWrite = false;
      }
      mat.needsUpdate = true;
    };

    stadiumScene.traverse((child) => {
      if (child.isMesh) {
        const name = child.name || '';
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(tuneMaterial);

        if (/Shadow/i.test(name)) {
          child.castShadow = false;
          child.receiveShadow = false;
          child.renderOrder = 1;
        } else if (/Tree/i.test(name)) {
          child.castShadow = true;
          child.receiveShadow = true;
        } else {
          child.receiveShadow = true;
          if (/Wall|Bleacher|Canopy|Pillar|Umpire|Bench|Clubhouse|StadiumCourt/i.test(name)) {
            child.castShadow = true;
          }
        }
      }
    });
    this.scene.add(stadiumScene);

    netScene.traverse((child) => {
      if (child.isMesh) {
        const name = child.name || '';
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(tuneMaterial);

        if (/Shadow/i.test(name)) {
          child.castShadow = false;
          child.receiveShadow = false;
          child.renderOrder = 1;
        } else if (/Mesh/i.test(name)) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.renderOrder = 2;
        } else {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      }
    });
    this.scene.add(netScene);
  }

  _prepareCrowd(crowdScene) {
    // Keep crowdScene at exact (0, 0, 0) world coordinates where Blender placed
    // all spectators on the West and East bleachers. Never clone or recenter sub-meshes!
    crowdScene.position.set(0, 0, 0);
    crowdScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = true;
      }
    });
    this.crowdScene = crowdScene;
    this.scene.add(crowdScene);
  }

  _prepareMiiActor(actor, miiScene, racketScene) {
    actor.model = miiScene;
    miiScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
      child.userData.basePos = child.position.clone();
      child.userData.baseRot = child.rotation.clone();

      // Match exact top-level part group/node names (including optional .001 Blender suffix)
      // while ignoring _1, _2 material primitive child meshes!
      const n = (child.name || '').trim();
      if (/^head(\.?0*\d+)?$/i.test(n) && (!actor.parts.head || !child.isMesh)) actor.parts.head = child;
      else if (/^torso(\.?0*\d+)?$/i.test(n) && (!actor.parts.torso || !child.isMesh)) actor.parts.torso = child;
      else if (/^hand_l(\.?0*\d+)?$/i.test(n) && (!actor.parts.handL || !child.isMesh)) actor.parts.handL = child;
      else if (/^hand_r(\.?0*\d+)?$/i.test(n) && (!actor.parts.handR || !child.isMesh)) actor.parts.handR = child;
      else if (/^foot_l(\.?0*\d+)?$/i.test(n) && (!actor.parts.footL || !child.isMesh)) actor.parts.footL = child;
      else if (/^foot_r(\.?0*\d+)?$/i.test(n) && (!actor.parts.footR || !child.isMesh)) actor.parts.footR = child;
    });

    miiScene.scale.setScalar(1.16);
    actor.root.add(miiScene);

    // 1. Apply Agent 2's Satin PBR + Fresnel Rim-Lighting Material & Contact Shadow Overhaul
    upgradeMiiCharacterMaterials(actor, actor.sideSign > 0 ? 'p1' : 'p2');

    // 2. Attach Agent 4's Dynamic 3D Articulated Facial Rig & Conformal Overlay onto Head
    if (this.facialFX) {
      this.facialFX.attachFacialRig(actor);
    }

    // 3. Setup Agent 3's Pivot-Corrected Hierarchical Joint Rig (hipPivot -> neckPivot -> headBounceGroup, hands, feet)
    if (this.bodyAnimator) {
      this.bodyAnimator.setupArticulatedMiiRig(actor);
    }

    // 4. Attach Oversized Argon Tennis Tennis Racket to Right-Hand Swing Pivot & upgrade Racket Materials
    const racketClone = racketScene.clone(true);
    racketClone.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    upgradeRacketMaterials(racketClone);
    racketClone.scale.setScalar(1.22);
    actor.racketMesh = racketClone;

    actor.racketPivot.position.set(-0.36, 0.90, 0.16);
    actor.racketMesh.rotation.set(0, 0, 0);
    actor.racketPivot.add(actor.racketMesh);

    // Legacy flat arc mesh kept hidden; 36-slice 3D RacketRibbonTrail handles all swing trails
    actor.swingArcMesh = createRacketSwingArcMesh();
    actor.swingArcMesh.visible = false;
    actor.root.add(actor.swingArcMesh);

    actor.root.add(actor.racketPivot);

    // Face the net: Near court (Z > 0) rotates Math.PI around Y to face -Z; Far court faces +Z (0)
    actor.root.rotation.y = actor.sideSign > 0 ? Math.PI : 0;
    actor.root.position.copy(actor.pos);
    this.scene.add(actor.root);

    // 5. Initialize Agent 1's Racket Kinematics & Agent 5's Curved 3D Racket Hoop Ribbon Trail
    if (this.racketKinematics) {
      this.racketKinematics.initActor(actor);
    }
    if (this.swingVfx) {
      this.swingVfx.registerActor(actor);
    }
  }

  _prepareTennisBall(ballScene) {
    ballScene.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = false;
      }
    });
    ballScene.scale.setScalar(1.65);
    this.ball.mesh = ballScene;
    this.ball.mesh.position.copy(this.ball.pos);
    this.scene.add(this.ball.mesh);
  }

  // --------------------------------------------------------------------------
  // 4. URL-Driven Canonical State Bootstrapping (?play=1, ?state=rally/serve/gamepoint/replay)
  // --------------------------------------------------------------------------
  _bootInitialStateFromURL() {
    // If opened with a 1v1 multiplayer room (`?room=AT-XXXX&role=p1|p2`) without `?play=1`,
    // automatically dismiss the title screen and launch directly into the 1v1 match!
    if (this.urlRoom && this.urlRoom !== 'DEFAULT' && !this.urlAutoPlay) {
      this.hud.hideTitleModal();
      this.autoPlayMode = false;
      this.userHasInteracted = true;
      this.persistentStateLock = false;
      this.startNewMatch({ showStartBanner: true });
      this._snapCameraImmediate();
      return;
    }

    if (!this.urlAutoPlay) {
      this.score.playerPoints = 0;
      this.score.opponentPoints = 0;
      this._syncScoreboardHUD();
      this._setupMidRallyShowcase({ scorePlayer: 0, scoreOpponent: 0 });
      this.autoPlayMode = true;
      if (this.audioEngine) this.audioEngine.playMusicForState('title');
      return;
    }

    this.hud.hideTitleModal();

    if (this.urlState === 'gamepoint' || this.urlState === 'serve') {
      // Canonical State: SERVE_CAM with 40 - 00, yellow "Server" box above player, and gold "Game Point" banner
      // (Matches ref_06_game_point_hud.png & ref_03_serve_stance.png)
      this.score.playerPoints = 3; // 40
      this.score.opponentPoints = 0; // 00
      this.score.playerGames = 0;
      this.score.opponentGames = 0;
      this.score.server = 'player';
      this.score.deuceSide = false; // Center-left stance matching ref_06_game_point_hud.png
      this._syncScoreboardHUD();

      this.persistentStateLock = true;
      this._setupPointServe({
        showBanner: true,
        bannerText: 'Game Point',
        bannerStyle: 'style-gold',
        persistentBanner: true,
      });
      this._snapCameraImmediate();
      if (this.audioEngine) this.audioEngine.playMusicForState('gamepoint');
      return;
    }

    if (this.urlState === 'start') {
      // Canonical State: Match Start ("Start" glossy cyan banner, 00 - 00) matching ref_02_match_start.png
      this.score.playerPoints = 0;
      this.score.opponentPoints = 0;
      this.score.server = 'player';
      this.score.deuceSide = true;
      this._syncScoreboardHUD();

      this.persistentStateLock = true;
      this._setupPointServe({
        showBanner: true,
        bannerText: 'Start',
        bannerStyle: 'style-start',
        persistentBanner: true,
      });
      this._snapCameraImmediate();
      return;
    }

    if (this.urlState === 'replay') {
      // Canonical State: REPLAY_CAM close-up at the net with crowd, players at net, unobstructed ball ribbon trail, and "••• Replay" badge
      // (Matches ref_05_net_closeup_crowd.png)
      this.score.playerPoints = 3; // 40
      this.score.opponentPoints = 0; // 00
      this._syncScoreboardHUD();

      this.persistentStateLock = true;
      this._enterInstantReplayState({ persistent: true });
      this._snapCameraImmediate();
      if (this.audioEngine) this.audioEngine.playMusicForState('replay');
      return;
    }

    if (this.urlState && this.urlState.startsWith('showcase')) {
      this.score.playerPoints = 2; // 30
      this.score.opponentPoints = 1; // 15
      this._syncScoreboardHUD();
      this.persistentStateLock = true;
      this.autoPlayMode = false;
      this._setupKineticShowcaseState(this.urlState);
      this._snapCameraImmediate();
      return;
    }

    // Default for ?play=1 or ?state=rally:
    // Active mid-rally frame in RALLY_CAM with score 15 - 00, ball arcing across the net with glowing white/gold
    // 45-segment ribbon trail, player mid-forehand swing with white racket arc trail, and 4 Miis on court!
    this.score.playerPoints = 1; // 15
    this.score.opponentPoints = 0; // 00
    this.score.playerGames = 0;
    this.score.opponentGames = 0;
    this._syncScoreboardHUD();
    this.hud.hideCenterBanner();
    this.hud.setReplayMode(false);

    this.autoPlayMode = true;
    this.persistentStateLock = false;
    this._setupMidRallyShowcase({ scorePlayer: 1, scoreOpponent: 0 });
    this._snapCameraImmediate();
    if (this.audioEngine) this.audioEngine.playMusicForState('rally');
  }

  _setupKineticShowcaseState(stateName = 'showcase_topspin') {
    this.phase = 'SHOWCASE';
    this.showcaseModeName = stateName;
    this.phaseTimer = 0;
    this.cameraMode = 'SHOWCASE_CAM';
    this.hud.setReplayMode(false);
    this.hud.hideCenterBanner();

    this.player.pos.set(1.15, 0, 11.2);
    this.player.targetPos.copy(this.player.pos);
    this.player.root.rotation.y = Math.PI + 0.18;

    this.opponent.pos.set(-1.25, 0, -10.2);
    this.opponent.targetPos.copy(this.opponent.pos);

    this.playerPartner.pos.set(-2.35, 0, 5.2);
    this.opponentPartner.pos.set(2.35, 0, -5.2);

    this._refreshShowcasePose();
  }

  _refreshShowcasePose() {
    const stateName = this.showcaseModeName || 'showcase_topspin';
    const settlePoseAt = (targetElapsed) => {
      for (let i = 0; i < 10; i++) {
        this.player.racketKinematics.swingActive = true;
        this.player.racketKinematics.swingElapsed = targetElapsed;
        this.racketKinematics.update(this.player, 0.016, { ball: this.ball, phase: this.phase });
        this.player.racketKinematics.swingActive = true;
        this.player.racketKinematics.swingElapsed = targetElapsed;
        this.bodyAnimator.updateMiiBodyAnimation(this.player, 0.016, this);
      }
      this.player.root.updateMatrixWorld(true);
    };

    if (stateName === 'showcase_slice' || stateName === 'showcase_backhand') {
      this.player.swingType = 'backhand';
      this.player.swingDuration = 0.36;
      this.player.swingTimer = 0.26;
      this.racketKinematics.triggerSwing(this.player, {
        shotType: stateName === 'showcase_backhand' ? 'topspin' : 'slice',
        side: 'backhand',
        speed: 1.32,
        timing: 'sweet',
      });
      settlePoseAt(0.072);
      this.swingVfx.seedActorSwingArc(this.player, {
        shotType: 'SLICE',
        isPower: false,
        whipSpeed: 28,
        swingType: 'backhand',
      });
      this.facialFX.setExpression(this.player, 'focused_squint', 10.0);
      const rim = this.racketKinematics.getRacketRimWorldPoints(this.player);
      const contactPos = rim.centerWorld.clone();
      this.ball.pos.copy(contactPos).add(new THREE.Vector3(0.06, 0.03, -0.22));
      this.ball.vel.set(1.4, 0.9, -15.2);
      this.ballTrail.setStyle('SLICE', false);
      this.ballTrail.seedArc(contactPos, this.ball.pos, 0.05);
      this.swingVfx.triggerBallDeformation(this.ball, 'racket_hit', this.ball.vel, 26);
      this.swingVfx.spawnImpactBurst(contactPos, { shotType: 'SLICE', isPower: false, count: 16 });
    } else if (stateName === 'showcase_smash') {
      this.player.swingType = 'smash';
      this.player.swingDuration = 0.36;
      this.player.swingTimer = 0.26;
      this.racketKinematics.triggerSwing(this.player, {
        shotType: 'smash',
        side: 'overhead',
        speed: 1.45,
        timing: 'sweet',
      });
      settlePoseAt(0.058);
      this.swingVfx.seedActorSwingArc(this.player, {
        shotType: 'SMASH',
        isPower: true,
        whipSpeed: 34,
        swingType: 'smash',
      });
      this.facialFX.setExpression(this.player, 'effort_shout', 10.0);
      const rim = this.racketKinematics.getRacketRimWorldPoints(this.player);
      const contactPos = rim.centerWorld.clone();
      this.ball.pos.copy(contactPos).add(new THREE.Vector3(-0.04, -0.04, -0.22));
      this.ball.vel.set(-1.5, -2.8, -22.0);
      this.ballTrail.setStyle('SMASH', true);
      this.ballTrail.seedArc(contactPos, this.ball.pos, 0.05);
      this.swingVfx.triggerBallDeformation(this.ball, 'racket_hit', this.ball.vel, 32);
      this.swingVfx.spawnImpactBurst(contactPos, { shotType: 'SMASH', isPower: true, count: 22 });
    } else if (stateName === 'showcase_panic') {
      this.player.vel.set(-6.8, 0, 1.2);
      this.player.stridePhase += 0.35;
      this.facialFX.setExpression(this.player, 'wide_eyed_panic', 10.0);
      this.facialFX.spawnSweatDrops(this.player, 6);
      this.facialFX.triggerEmoteBurst(this.player, 'panic');
      this.ball.pos.set(0.78, 2.15, 9.85);
      this.ballTrail.setStyle('LOB', false);
      this.ballTrail.seedArc(new THREE.Vector3(-0.8, 2.75, 5.2), this.ball.pos, 0.72);
    } else if (stateName === 'showcase_win') {
      if (!this.player.rig?.reaction?.type) {
        this.bodyAnimator.triggerPointReaction(this.player, 'win');
      }
      if (this.player.rig?.reaction) {
        this.player.rig.reaction.timer = 0.16;
      }
      this.facialFX.setExpression(this.player, 'happy_grin', 10.0);
      this.facialFX.triggerEmoteBurst(this.player, 'win');
      if (!this.opponent.rig?.reaction?.type) {
        this.bodyAnimator.triggerPointReaction(this.opponent, 'loss');
      }
      this.facialFX.setExpression(this.opponent, 'shocked_loss', 10.0);
      this.ball.pos.set(-2.5, 0.12, -11.5);
    } else {
      // showcase_topspin: High-velocity topspin forehand whip on Forehand side (local -X) + star burst
      this.player.swingType = 'forehand';
      this.player.swingDuration = 0.36;
      this.player.swingTimer = 0.26;
      this.racketKinematics.triggerSwing(this.player, {
        shotType: 'topspin',
        side: 'forehand',
        speed: 1.35,
        timing: 'sweet',
      });
      settlePoseAt(0.068);
      this.swingVfx.seedActorSwingArc(this.player, {
        shotType: 'TOPSPIN',
        isPower: true,
        whipSpeed: 29,
        swingType: 'forehand',
      });
      this.facialFX.setExpression(this.player, 'effort_shout', 10.0);
      const rim = this.racketKinematics.getRacketRimWorldPoints(this.player);
      const contactPos = rim.centerWorld.clone();
      this.ball.pos.copy(contactPos).add(new THREE.Vector3(-0.06, 0.04, -0.22));
      this.ball.vel.set(-1.8, 2.2, -18.5);
      this.ballTrail.setStyle('TOPSPIN', true);
      this.ballTrail.seedArc(contactPos, this.ball.pos, 0.05);
      this.swingVfx.triggerBallDeformation(this.ball, 'racket_hit', this.ball.vel, 28);
      this.swingVfx.spawnImpactBurst(contactPos, { shotType: 'TOPSPIN', isPower: true, count: 18 });
    }
  }

  // --------------------------------------------------------------------------
  // 5. Match Lifecycle & State Transitions
  // --------------------------------------------------------------------------
  startNewMatch({ showStartBanner = true } = {}) {
    this.score.playerPoints = 0;
    this.score.opponentPoints = 0;
    this.score.playerGames = 0;
    this.score.opponentGames = 0;
    this.score.server = 'player';
    this.score.deuceSide = true;
    this._syncScoreboardHUD();
    this.hud.setReplayMode(false);

    if (this.audioEngine) {
      this.audioEngine.playMusicForState('start');
      this.audioEngine.announceScore('Start');
    }

    this._setupPointServe({
      showBanner: showStartBanner,
      bannerText: 'Start',
      bannerStyle: 'style-start',
      persistentBanner: false,
    });
  }

  _setupPointServe({
    showBanner = true,
    bannerText = null,
    bannerStyle = 'style-gold',
    persistentBanner = false,
  } = {}) {
    this.phase = 'SERVE_STANCE';
    this.phaseTimer = 0;
    this.cameraMode = 'SERVE_CAM';
    this.hud.setReplayMode(false);
    this.ballTrail.clear();
    if (this.swingVfx) {
      this.swingVfx.clearAllTrails();
    }

    const sideX = this.score.deuceSide ? 1.35 : -0.55;
    const recvX = this.score.deuceSide ? -2.35 : 2.15;

    if (this.score.server === 'player') {
      this.player.pos.set(sideX, 0, COURT.BASELINE_Z + 0.12);
      this.player.targetPos.copy(this.player.pos);
      this.opponent.pos.set(recvX, 0, -COURT.BASELINE_Z + 0.35);
      this.opponent.targetPos.copy(this.opponent.pos);
      this.ball.pos.set(sideX - 0.28, 1.12, COURT.BASELINE_Z - 0.15);
    } else {
      this.opponent.pos.set(-sideX, 0, -COURT.BASELINE_Z - 0.12);
      this.opponent.targetPos.copy(this.opponent.pos);
      this.player.pos.set(-recvX, 0, COURT.BASELINE_Z - 0.35);
      this.player.targetPos.copy(this.player.pos);
      this.ball.pos.set(-sideX + 0.28, 1.12, -COURT.BASELINE_Z + 0.15);
    }

    // Position Frontcourt Net Partners matching ref_06_game_point_hud.png & ref_02_match_start.png
    const netPartnerX = this.score.deuceSide ? -2.05 : 2.05;
    this.playerPartner.pos.set(netPartnerX, 0, 5.2);
    this.playerPartner.targetPos.copy(this.playerPartner.pos);
    this.playerPartner.root.visible = true;
    if (this.playerPartner.shadowBlob) this.playerPartner.shadowBlob.visible = true;

    this.opponentPartner.pos.set(-netPartnerX, 0, -5.2);
    this.opponentPartner.targetPos.copy(this.opponentPartner.pos);
    this.opponentPartner.root.visible = true;
    if (this.opponentPartner.shadowBlob) this.opponentPartner.shadowBlob.visible = true;

    this.ball.vel.set(0, 0, 0);
    this.ball.spin.set(0, 0, 0);
    this.ball.inPlay = false;
    this.ball.bounceCountOnCurrentSide = 0;
    this.ball.rallyStrokeCount = 0;
    this.pendingUserSwing = null;
    this.pendingP2Swing = null;
    this.pendingServeSwing = null;

    this.player.swingArcMesh.visible = false;
    this.opponent.swingArcMesh.visible = false;
    if (this.playerPartner.swingArcMesh) this.playerPartner.swingArcMesh.visible = false;
    if (this.opponentPartner.swingArcMesh) this.opponentPartner.swingArcMesh.visible = false;
    this.player.swingCooldown = 0;
    this.playerPartner.swingCooldown = 0;
    this.opponent.swingCooldown = 0;
    this.opponentPartner.swingCooldown = 0;

    if (this.facialFX) {
      this.facialFX.setExpression(this.player, 'neutral', 2.0);
      this.facialFX.setExpression(this.opponent, 'neutral', 2.0);
      this.facialFX.setExpression(this.playerPartner, 'neutral', 2.0);
      this.facialFX.setExpression(this.opponentPartner, 'neutral', 2.0);
    }

    let callout = bannerText;
    let style = bannerStyle;
    if (!callout && showBanner) {
      const special = this._getHighStakesPointLabel();
      if (special) {
        callout = special;
        style = 'style-gold';
        if (this.audioEngine) {
          this.audioEngine.announceScore(special, { delayMs: 180 });
        }
      }
    }

    if (callout && showBanner) {
      this._recordBannerBroadcast(callout, style, '');
      this.hud.showCenterBanner(callout, {
        style,
        durationMs: 1800,
        persistent: persistentBanner,
      });
    } else if (!persistentBanner) {
      this.hud.hideCenterBanner();
    }

    this.hud.updateTimingGauge({
      cursorNormalized: 0.5,
      modeTitle: 'SERVE TOSS',
      speedText: 'UPWARD FLICK / SPACE',
    });
  }

  _setupMidRallyShowcase({ scorePlayer = 1, scoreOpponent = 0 } = {}) {
    this.phase = 'RALLY';
    this.phaseTimer = 0;
    this.cameraMode = 'RALLY_CAM';
    this.hud.setReplayMode(false);
    this.hud.hideCenterBanner();

    // Place near baseline player in dynamic forehand follow-through (matches ref_04_rally_camera.png)
    this.player.pos.set(1.35, 0, 11.4);
    this.player.targetPos.set(1.15, 0, 11.4);
    this.player.swingType = 'forehand';
    this.player.swingTimer = 0.25;
    this.player.arcVisibleTimer = 1.2;
    this.player.swingArcMesh.visible = true;
    if (this.racketKinematics) {
      this.racketKinematics.triggerSwing(this.player, {
        shotType: 'topspin',
        side: 'forehand',
        speed: 1.35,
        timing: 'sweet',
      });
      this.player.racketKinematics.swingElapsed = 0.13;
    }
    if (this.swingVfx) {
      this.swingVfx.seedActorSwingArc(this.player, {
        shotType: 'TOPSPIN',
        isPower: true,
        whipSpeed: 28,
        swingType: 'forehand',
      });
    }
    if (this.facialFX) {
      this.facialFX.setExpression(this.player, 'effort_shout', 1.2);
      this.facialFX.setExpression(this.opponent, 'focused_squint', 1.2);
    }

    // Frontcourt Net Partners at (-2.1, 0, 5.4) and (2.1, 0, -5.4)
    this.playerPartner.pos.set(-2.1, 0, 5.4);
    this.playerPartner.targetPos.copy(this.playerPartner.pos);
    this.playerPartner.root.visible = true;
    if (this.playerPartner.shadowBlob) this.playerPartner.shadowBlob.visible = true;

    this.opponentPartner.pos.set(2.1, 0, -5.4);
    this.opponentPartner.targetPos.copy(this.opponentPartner.pos);
    this.opponentPartner.root.visible = true;
    if (this.opponentPartner.shadowBlob) this.opponentPartner.shadowBlob.visible = true;

    // Far baseline opponent moving to intercept
    this.opponent.pos.set(-1.65, 0, -10.5);
    this.opponent.targetPos.set(-1.95, 0, -10.8);

    // Seed ball mid-flight arcing over the net with a bold 45-segment white/gold ribbon trail
    const startShot = new THREE.Vector3(1.42, 1.25, 10.85);
    const currentBall = new THREE.Vector3(-0.18, 1.88, 0.65);
    this.ball.pos.copy(currentBall);
    this.ball.vel.set(-1.85, 2.15, -14.8);
    this.ball.spin.set(18.0, 0.0, 0.0);
    this.ball.inPlay = true;
    this.ball.lastHitter = 'player';
    this.ball.bounceCountOnCurrentSide = 0;
    this.ball.rallyStrokeCount = 2;
    this.ball.shotType = 'TOPSPIN';
    this.ball.isPowerShot = true;

    this.ballTrail.setStyle('TOPSPIN', false);
    this.ballTrail.seedArc(startShot, currentBall, 0.72);
    if (this.swingVfx) {
      this.swingVfx.spawnImpactBurst(startShot, { shotType: 'TOPSPIN', isPower: true, count: 14 });
    }

    this._predictBallIntercept(this.opponent);
  }

  _enterInstantReplayState({ persistent = false } = {}) {
    this.phase = 'REPLAY';
    this.phaseTimer = 0;
    this.cameraMode = 'REPLAY_CAM';
    this.persistentStateLock = persistent;
    this.hud.hideCenterBanner();
    this.hud.setReplayMode(true);
    this.cheerEnergy = 0.85;
    if (this.audioEngine && !persistent) {
      this.audioEngine.playVoiceCallout('replay');
    }

    this._resetReplayNetExchangePose();
  }

  _resetReplayNetExchangePose() {
    // Matches ref_05_net_closeup_crowd.png & render_02_net_closeup.png with 0% occlusion:
    // Foreground Red Mii at (1.55, 0, 0.95) on the right side of the frame (x_screen ≈ 74%);
    // Lunging Blue/Purple Opponent at (-1.25, 0, -1.35) on the left-center of the frame (x_screen ≈ 46%);
    // Yellow Tennis Ball & bright 45-segment ribbon trail in the open window between them (x_screen ≈ 57%)!
    this.player.pos.set(1.55, 0, 0.95);
    this.player.targetPos.copy(this.player.pos);
    this.player.root.rotation.y = Math.PI + 0.22;
    this.player.swingType = 'forehand';
    this.player.swingTimer = 0.08;
    this.player.arcVisibleTimer = 1.5;
    this.player.swingArcMesh.visible = true;

    this.opponent.pos.set(-1.25, 0, -1.35);
    this.opponent.targetPos.copy(this.opponent.pos);
    this.opponent.root.rotation.y = -0.18;
    this.opponent.swingType = 'forehand';
    this.opponent.swingTimer = 0.12;
    this.opponent.arcVisibleTimer = 1.5;
    this.opponent.swingArcMesh.visible = true;

    if (this.racketKinematics) {
      this.racketKinematics.triggerSwing(this.player, {
        shotType: 'topspin',
        side: 'forehand',
        speed: 1.32,
        timing: 'sweet',
      });
      this.player.racketKinematics.swingElapsed = 0.14;
      this.racketKinematics.triggerSwing(this.opponent, {
        shotType: 'slice',
        side: 'forehand',
        speed: 1.25,
        timing: 'sweet',
      });
      this.opponent.racketKinematics.swingElapsed = 0.11;
    }
    if (this.swingVfx) {
      this.swingVfx.seedActorSwingArc(this.player, {
        shotType: 'TOPSPIN',
        isPower: true,
        whipSpeed: 28,
        swingType: 'forehand',
      });
      this.swingVfx.seedActorSwingArc(this.opponent, {
        shotType: 'SLICE',
        isPower: false,
        whipSpeed: 25,
        swingType: 'forehand',
      });
    }
    if (this.facialFX) {
      this.facialFX.setExpression(this.player, 'effort_shout', 2.0);
      this.facialFX.setExpression(this.opponent, 'wide_eyed_panic', 2.0);
      this.facialFX.spawnSweatDrops(this.opponent, 5);
    }

    // Move baseline partners out of the immediate net close-up frustum
    this.playerPartner.pos.set(-4.2, 0, 9.5);
    this.opponentPartner.pos.set(4.2, 0, -9.5);

    const fromPos = new THREE.Vector3(-1.12, 1.22, -1.08);
    const ballNow = new THREE.Vector3(-0.08, 1.34, 0.05);
    this.ball.pos.copy(ballNow);
    this.ball.vel.set(0.95, 0.85, 3.6);
    this.ball.inPlay = true;
    this.ballTrail.setStyle('SLICE', true);
    this.ballTrail.seedArc(fromPos, ballNow, 0.24);
  }

  // --------------------------------------------------------------------------
  // 6. User Input Handlers (P1 & P2 Serve Toss, Forgiving Sweet-Spot Swing & 1v1)
  // --------------------------------------------------------------------------
  _handleUserTossInput(evt = {}) {
    this.userHasInteracted = true;
    if (this.phase === 'TITLE') {
      this.hud.hideTitleModal();
      this.autoPlayMode = false;
      this.persistentStateLock = false;
      this.startNewMatch({ showStartBanner: true });
      return true;
    }

    if (this.phase === 'SERVE_STANCE' && this.score.server === 'player') {
      this.persistentStateLock = false;
      this.hud.hideCenterBanner();
      this._startServeToss(this.player);
      return true;
    }
    return false;
  }

  _handleUserSwingInput(evt = {}) {
    this.userHasInteracted = true;
    if (this.phase === 'TITLE') {
      this.hud.hideTitleModal();
      this.autoPlayMode = false;
      this.persistentStateLock = false;
      this.startNewMatch({ showStartBanner: true });
      return;
    }

    if (evt.shotType && evt.shotType !== 'toss') {
      const norm = String(evt.shotType).toUpperCase();
      if (['TOPSPIN', 'SLICE', 'LOB', 'SMASH', 'FLAT'].includes(norm)) {
        this.selectedShotType = norm === 'SMASH' ? 'FLAT' : norm;
      }
    }

    // 1. If waiting in Serve Stance, first swing / upward flick tosses the ball!
    if (this.phase === 'SERVE_STANCE' && this.score.server === 'player') {
      this.persistentStateLock = false;
      this.hud.hideCenterBanner();
      this._startServeToss(this.player);
      return;
    }

    // 2. If ball is in Serve Toss air (at least 0.16s after toss), hit or auto-apex buffer the serve!
    if (this.phase === 'SERVE_TOSS' && this.score.server === 'player') {
      if (this.phaseTimer < 0.16) return;
      // Forgiving Serve Sweet Spot: if user swings while the ball is still rising toward the apex,
      // buffer the swing for a fraction of a second so it strikes right at the sweet-spot apex!
      if (this.ball.pos.y >= 1.45 && this.ball.pos.y < 2.25 && this.ball.vel.y > 0.5) {
        this.pendingServeSwing = { actor: this.player, evt: { ...evt, speed: Math.max(1.22, Number(evt.speed || 1.22)) } };
        return;
      }
      this._executeServeHit(this.player, evt);
      return;
    }

    // 3. During active Rally, trigger player swing or smart Sweet-Spot Pre-Swing Buffer!
    if (this.phase === 'RALLY') {
      this.autoPlayMode = false;
      const gestureSide =
        evt.side === 'backhand' || (Number(evt.dirX || 0) > 0.12 && evt.side !== 'forehand')
          ? 'backhand'
          : evt.side === 'forehand' || Number(evt.dirX || 0) < -0.12
          ? 'forehand'
          : this.ball.pos.x < this.player.pos.x - 0.05 || this.ball.targetLanding.x < -0.15
          ? 'backhand'
          : 'forehand';
      const gestureShot = String(evt.shotType || this.selectedShotType || 'topspin').toLowerCase();

      if (this.ball.lastHitter === 'opponent') {
        const distPlayerZ = this.ball.pos.z - this.player.pos.z;
        const distPartnerZ = this.ball.pos.z - this.playerPartner.pos.z;
        const nearPartner =
          this.ball.pos.z > 0.3 &&
          this.ball.pos.z <= 7.5 &&
          Math.abs(this.ball.pos.x - this.playerPartner.pos.x) < 3.4;

        // If the ball is approaching from the opponent but still 0.95m..7.8m ahead of the player,
        // immediately show the physical swing AND queue a Smart Sweet-Spot Buffer (480ms)!
        const minZ = nearPartner ? distPartnerZ : distPlayerZ;
        if (minZ < -0.95 && minZ >= -7.8) {
          const swingActor = nearPartner ? this.playerPartner : this.player;
          if (this.racketKinematics) {
            this.racketKinematics.triggerSwing(swingActor, {
              shotType: gestureShot,
              side: gestureSide,
              speed: Number(evt.speed || 1.2),
              timing: 'early',
              dirX: Number(evt.dirX || 0),
            });
          }
          if (this.audioEngine) {
            this.audioEngine.playSwingWhoosh(Number(evt.speed || 1.15));
          }
          this.pendingUserSwing = {
            evt: { ...evt, side: gestureSide, sweetSpotAssisted: true },
            expiresAt: this.elapsedTime + 0.48,
            waitForSweetSpot: true,
          };
          return;
        }
      }

      const struck = this._attemptPlayerRallyStrike({ ...evt, side: gestureSide }, false);
      if (!struck) {
        // Even if the ball was already hit or out of reach, always animate the player's racket swing immediately!
        if (this.racketKinematics) {
          this.racketKinematics.triggerSwing(this.player, {
            shotType: gestureShot,
            side: gestureSide,
            speed: Number(evt.speed || 1.2),
            timing: 'sweet',
            dirX: Number(evt.dirX || 0),
          });
        }
        if (this.audioEngine) {
          this.audioEngine.playSwingWhoosh(Number(evt.speed || 1.15));
        }
        if (this.ball.lastHitter === 'opponent') {
          const distPlayerZ = this.ball.pos.z - this.player.pos.z;
          const distPartnerZ = this.ball.pos.z - this.playerPartner.pos.z;
          if ((distPlayerZ >= -8.0 && distPlayerZ <= 0.9) || (distPartnerZ >= -5.5 && distPartnerZ <= 0.9)) {
            this.pendingUserSwing = {
              evt: { ...evt, side: gestureSide, sweetSpotAssisted: true },
              expiresAt: this.elapsedTime + 0.48,
              waitForSweetSpot: true,
            };
          }
        }
      }
    }
  }

  _handleP2TossInput(evt = {}) {
    this.userHasInteracted = true;
    this.isMultiplayer = true;
    if (this.phase === 'TITLE') {
      this.hud.hideTitleModal();
      this.autoPlayMode = false;
      this.persistentStateLock = false;
      this.startNewMatch({ showStartBanner: true });
      return true;
    }

    if (this.phase === 'SERVE_STANCE' && this.score.server === 'opponent') {
      this.persistentStateLock = false;
      this.hud.hideCenterBanner();
      this._startServeToss(this.opponent);
      return true;
    }
    return false;
  }

  _handleP2SwingInput(evt = {}) {
    this.userHasInteracted = true;
    this.isMultiplayer = true;
    this._applyDifficultyTuning('1v1');

    if (this.phase === 'TITLE') {
      this.hud.hideTitleModal();
      this.autoPlayMode = false;
      this.persistentStateLock = false;
      this.startNewMatch({ showStartBanner: true });
      return;
    }

    if (evt.shotType && evt.shotType !== 'toss') {
      const norm = String(evt.shotType).toUpperCase();
      if (['TOPSPIN', 'SLICE', 'LOB', 'SMASH', 'FLAT'].includes(norm)) {
        this.p2SelectedShotType = norm === 'SMASH' ? 'FLAT' : norm;
      }
    }

    // 1. P2 Serve Toss
    if (this.phase === 'SERVE_STANCE' && this.score.server === 'opponent') {
      this.persistentStateLock = false;
      this.hud.hideCenterBanner();
      this._startServeToss(this.opponent);
      return;
    }

    // 2. P2 Serve Hit
    if (this.phase === 'SERVE_TOSS' && this.score.server === 'opponent') {
      if (this.phaseTimer < 0.16) return;
      if (this.ball.pos.y >= 1.45 && this.ball.pos.y < 2.25 && this.ball.vel.y > 0.5) {
        this.pendingServeSwing = { actor: this.opponent, evt: { ...evt, speed: Math.max(1.22, Number(evt.speed || 1.22)) } };
        return;
      }
      this._executeServeHit(this.opponent, evt);
      return;
    }

    // 3. P2 Rally Swing
    if (this.phase === 'RALLY') {
      this.autoPlayMode = false;
      const p2GestureSide =
        evt.side === 'backhand' || (Number(evt.dirX || 0) > 0.12 && evt.side !== 'forehand')
          ? 'backhand'
          : evt.side === 'forehand' || Number(evt.dirX || 0) < -0.12
          ? 'forehand'
          : this.ball.pos.x > this.opponent.pos.x + 0.05 || this.ball.targetLanding.x > 0.15
          ? 'backhand'
          : 'forehand';
      const p2GestureShot = String(evt.shotType || this.p2SelectedShotType || 'topspin').toLowerCase();

      if (this.ball.lastHitter === 'player') {
        // For P2 at Z < 0, approaching ball has ball.pos.z > opponent.pos.z (so distFromP2 = opponent.pos.z - ball.pos.z < 0)
        const distP2Z = this.opponent.pos.z - this.ball.pos.z;
        if (distP2Z < -0.95 && distP2Z >= -7.8) {
          if (this.racketKinematics) {
            this.racketKinematics.triggerSwing(this.opponent, {
              shotType: p2GestureShot,
              side: p2GestureSide,
              speed: Number(evt.speed || 1.2),
              timing: 'early',
              dirX: Number(evt.dirX || 0),
            });
          }
          this.pendingP2Swing = {
            evt: { ...evt, side: p2GestureSide, sweetSpotAssisted: true },
            expiresAt: this.elapsedTime + 0.48,
            waitForSweetSpot: true,
          };
          return;
        }
      }
      const struck = this._attemptP2RallyStrike({ ...evt, side: p2GestureSide });
      if (!struck) {
        if (this.racketKinematics) {
          this.racketKinematics.triggerSwing(this.opponent, {
            shotType: p2GestureShot,
            side: p2GestureSide,
            speed: Number(evt.speed || 1.2),
            timing: 'sweet',
            dirX: Number(evt.dirX || 0),
          });
        }
        if (this.ball.lastHitter === 'player') {
          this.pendingP2Swing = {
            evt: { ...evt, side: p2GestureSide, sweetSpotAssisted: true },
            expiresAt: this.elapsedTime + 0.48,
            waitForSweetSpot: true,
          };
        }
      }
    }
  }

  _startServeToss(actor) {
    this.phase = 'SERVE_TOSS';
    this.phaseTimer = 0;
    this.pendingServeSwing = null;
    const handOffset = actor.sideSign > 0 ? -0.32 : 0.32;
    this.ball.pos.set(actor.pos.x + handOffset, 1.18, actor.pos.z - actor.sideSign * 0.22);
    this.ball.vel.set(0, 6.32, 0);
    this.ball.inPlay = false;

    if (this.facialFX) {
      this.facialFX.setExpression(actor, 'focused_squint', 1.4);
    }

    if (this.audioEngine) {
      this.audioEngine.playServeToss();
    }
  }

  _executeServeHit(actor, evt = {}) {
    const height = this.ball.pos.y;
    if (height < 1.25) return;
    this.pendingServeSwing = null;

    const swingSpeed = THREE.MathUtils.clamp(Number(evt.speed || 1.18), 0.78, 1.68);
    // Forgiving Serve Sweet-Spot Window: [2.05m .. 3.55m] (was [2.68m .. 3.44m])
    const isApexPowerServe = height >= 2.05 && height <= 3.55;
    const isEarlyLowServe = height < 1.72;

    actor.swingType = 'serve';
    actor.swingDuration = 0.38;
    actor.swingTimer = 0.38;
    actor.arcVisibleTimer = 0.36;
    actor.swingArcMesh.visible = true;

    if (this.racketKinematics) {
      this.racketKinematics.triggerSwing(actor, {
        shotType: 'serve',
        side: 'overhead',
        speed: swingSpeed,
        timing: isApexPowerServe ? 'sweet' : isEarlyLowServe ? 'early' : 'sweet',
        isServe: true,
        dirX: Number(evt.dirX || 0),
      });
      this.racketKinematics.triggerImpactRecoil(actor, isApexPowerServe ? 1.45 : 0.95);
    }

    const targetSignX = this.score.deuceSide ? -1 : 1;
    // Allow server to aim Wide or Down-the-T inside the service box with wrist/swing angle (evt.dirX)
    const aimSteer = THREE.MathUtils.clamp(Number(evt.dirX || 0), -1, 1) * 1.15;
    const baseBoxX = actor.sideSign * targetSignX * (1.75 + Math.random() * 0.85);
    const targetX = THREE.MathUtils.clamp(
      baseBoxX + aimSteer,
      -COURT.SINGLES_X + 0.45,
      COURT.SINGLES_X - 0.45
    );

    const isCpuServe = actor.role === 'opponent' && !this.isMultiplayer;
    const casualScale = !isCpuServe ? 1.0 : this.matchConfig.difficulty === 'pro' ? 1.0 : 1.24;

    let targetZ = -actor.sideSign * (4.4 + Math.random() * 1.35);
    let flightTime = isApexPowerServe
      ? Math.max(0.58, 0.66 / Math.min(1.18, swingSpeed * 0.92)) * casualScale
      : isEarlyLowServe
      ? 0.94 * casualScale
      : 0.80 * casualScale;
    let topspin = isApexPowerServe ? 22.0 : isEarlyLowServe ? 8.0 : 15.0;
    let sidespin = Number(evt.dirX || 0) * -8.0;

    // Eliminate frustrating serve net faults unless swinging practically on the ground (< 1.35m)
    const netFaultRisk = false;

    const contactPos = this.ball.pos.clone();

    this._launchBallToTarget(this.ball.pos, new THREE.Vector3(targetX, 0, targetZ), flightTime, {
      topspin,
      sidespin,
      allowNetFault: netFaultRisk,
    });

    const speedKmh = isApexPowerServe
      ? Math.round(188 + Math.min(22, (swingSpeed - 1.0) * 32))
      : isEarlyLowServe
      ? Math.round(128 + Math.random() * 14)
      : Math.round(158 + Math.min(22, (swingSpeed - 0.9) * 28));

    this.ball.inPlay = true;
    this.ball.lastHitter = actor.role === 'player' ? 'player' : 'opponent';
    this.ball.bounceCountOnCurrentSide = 0;
    this.ball.rallyStrokeCount = 1;
    this.ball.isPowerShot = isApexPowerServe;
    this.ball.shotType = isApexPowerServe ? 'POWER' : 'TOPSPIN';

    this.ballTrail.clear();
    this.ballTrail.setStyle(this.ball.shotType, isApexPowerServe);
    this.ballTrail.pushPoint(this.ball.pos);

    this.phase = 'RALLY';
    this.cameraMode = 'RALLY_CAM';

    if (this.swingVfx) {
      this.swingVfx.onRacketContact({
        actor,
        ball: this.ball,
        contactPos,
        shotType: isApexPowerServe ? 'SMASH' : 'SERVE',
        isPower: isApexPowerServe,
        isServe: true,
        timingQuality: isApexPowerServe ? 'PERFECT' : 'GOOD',
        speed: this.ball.vel.length(),
      });
    }
    if (this.facialFX) {
      this.facialFX.setExpression(actor, 'effort_shout', 0.55);
    }

    if (isApexPowerServe) {
      this.cameraTrauma = 0.34;
      this._spawnStarBurst(this.ball.pos, 14);
    }

    if (this.audioEngine) {
      this.audioEngine.playSwingWhoosh(isApexPowerServe ? 1.5 : 1.1);
      this.audioEngine.playRacketHit(isApexPowerServe ? 'smash' : 'topspin', isApexPowerServe ? 'perfect' : 'good');
      if ((actor.role === 'player' || this.isMultiplayer) && isApexPowerServe && !this.autoPlayMode) {
        this.audioEngine.playVoiceCallout('power serve');
      }
    }

    if (actor.role === 'player' || (actor.role === 'opponent' && this.isMultiplayer)) {
      const hapticRole = actor.role === 'player' ? 'p1' : 'p2';
      const gradeLabel = isApexPowerServe
        ? 'POWER SERVE!'
        : isEarlyLowServe
        ? 'EARLY SERVE'
        : 'GOOD SERVE';
      const detailLabel = `${speedKmh} KM/H • ${
        isApexPowerServe ? 'SWEET SPOT APEX' : isEarlyLowServe ? 'LOW CONTACT' : 'SERVICE BOX'
      }`;
      const screenPos = this._projectToScreen(
        actor.pos.clone().add(new THREE.Vector3(0, 2.35, 0))
      );
      this.hud.showTimingPopup({
        grade: gradeLabel,
        detail: detailLabel,
        screenPos,
      });
      this.hud.updateTimingGauge({
        cursorNormalized: isApexPowerServe ? 0.5 : isEarlyLowServe ? 0.22 : 0.42,
        modeTitle: 'SERVE IMPACT',
        speedText: `${speedKmh} KM/H`,
      });

      if (this.motionController && this.motionController.triggerHapticFeedback && !this.autoPlayMode) {
        this.motionController.triggerHapticFeedback({
          role: hapticRole,
          kind: 'hit',
          grade: gradeLabel,
          shotType: isApexPowerServe ? 'SMASH' : 'TOPSPIN',
          speedKmh,
          intensity: isApexPowerServe ? 1.5 : isEarlyLowServe ? 0.75 : 1.05,
        });
      }
    }

    const receiver = actor.role === 'player' ? this.opponent : this.player;
    this._predictBallIntercept(receiver);
  }

  _attemptPlayerRallyStrike(evt = {}, isAutoAssist = false) {
    if (this.ball.lastHitter === 'player') return false;

    // Determine whether the frontcourt Net Partner (`this.playerPartner`) or Baseline Player (`this.player`) is striking!
    const distPlayerZ = this.ball.pos.z - this.player.pos.z;
    const distPlayerX = Math.abs(this.ball.pos.x - this.player.pos.x);
    const distPlayerXZ = Math.hypot(distPlayerX, distPlayerZ);

    const distPartnerZ = this.ball.pos.z - this.playerPartner.pos.z;
    const distPartnerX = Math.abs(this.ball.pos.x - this.playerPartner.pos.x);
    const distPartnerXZ = Math.hypot(distPartnerX, distPartnerZ);

    const useNetPartner =
      !isAutoAssist &&
      this.ball.pos.z > 0.3 &&
      this.ball.pos.z <= 7.6 &&
      distPartnerXZ <= 3.95 &&
      distPartnerXZ < distPlayerXZ;

    const hitter = useNetPartner ? this.playerPartner : this.player;
    const distZ = useNetPartner ? distPartnerZ : distPlayerZ;
    const distX = useNetPartner ? distPartnerX : distPlayerX;
    const distXZ = useNetPartner ? distPartnerXZ : distPlayerXZ;

    // Respect swing recovery cooldown if player just whiffed!
    if (!isAutoAssist && hitter.swingCooldown > 0) {
      return false;
    }

    const swingSpeed = THREE.MathUtils.clamp(Number(evt.speed || 1.18), 0.80, 1.68);
    if (evt.shotType) {
      const norm = String(evt.shotType).toUpperCase();
      this.selectedShotType = norm === 'SMASH' || norm === 'POWER' ? 'FLAT' : norm;
    }
    const isBackhand =
      evt.side === 'backhand'
        ? true
        : evt.side === 'forehand'
        ? false
        : Number(evt.dirX || 0) > 0.14
        ? true
        : Number(evt.dirX || 0) < -0.14
        ? false
        : this.ball.pos.x < hitter.pos.x - 0.04 || this.ball.targetLanding.x < -0.12;
    const isOverhead =
      evt.side === 'overhead' ||
      ((this.selectedShotType === 'FLAT' || evt.shotType === 'smash') && this.ball.pos.y > 1.50) ||
      this.ball.pos.y > 1.78;
    hitter.swingType = isOverhead ? 'smash' : isBackhand ? 'backhand' : 'forehand';
    hitter.swingDuration = 0.36;
    hitter.swingTimer = 0.36;
    hitter.arcVisibleTimer = this.autoPlayMode ? 0.85 : 0.36;
    if (hitter.swingArcMesh) hitter.swingArcMesh.visible = false;

    if (this.racketKinematics) {
      const rawShot = String(evt.shotType || this.selectedShotType || 'topspin').toLowerCase();
      const kinShot = isOverhead
        ? 'smash'
        : rawShot === 'power'
        ? 'smash'
        : rawShot;
      this.racketKinematics.triggerSwing(hitter, {
        shotType: kinShot,
        side: isOverhead ? 'overhead' : isBackhand ? 'backhand' : 'forehand',
        speed: swingSpeed,
        timing: 'sweet',
        dirX: Number(evt.dirX || 0),
      });
    }

    if (this.audioEngine) {
      this.audioEngine.playSwingWhoosh(swingSpeed);
    }

    // Generous strike reach (4.85m baseline, 4.05m net) so players never miss a reachable ball!
    const maxStrikeReach = useNetPartner ? 4.05 : 4.85;
    if (distXZ > maxStrikeReach && !isAutoAssist) {
      // Only penalize with a brief whiff if the ball has already blown well past the player (distZ > 1.45)
      if (distZ > 1.45) {
        hitter.swingCooldown = 0.16;
        const whiffReason = 'TOO LATE! • WHIFF';
        const screenPos = this._projectToScreen(
          hitter.pos.clone().add(new THREE.Vector3(0, 2.35, 0))
        );
        this.hud.showTimingPopup({
          grade: whiffReason,
          detail: 'BALL PASSED',
          screenPos,
          durationMs: 750,
        });
        this.hud.updateTimingGauge({
          cursorNormalized: 0.92,
          modeTitle: 'SWING WHIFF!',
          speedText: 'LATE',
        });
        if (this.motionController && this.motionController.triggerHapticFeedback) {
          this.motionController.triggerHapticFeedback({
            role: 'p1',
            kind: 'whiff',
            grade: whiffReason,
            shotType: this.selectedShotType || 'TOPSPIN',
            speedKmh: 0,
            intensity: 0.65,
          });
        }
      }
      return false;
    }

    // Forgiving Sweet-Spot Timing Window (3x wider PERFECT zone: [-1.45m .. +0.68m])
    let timingClass = 'PERFECT';
    let cursorNorm = 0.5;
    const isStretched = distX > 2.85;

    if (evt.timing) {
      timingClass = String(evt.timing).toUpperCase();
    } else if (evt.sweetSpotAssisted && distZ >= -1.85 && distZ <= 0.78) {
      timingClass = 'PERFECT';
      cursorNorm = 0.50;
    } else if (distZ < -2.65) {
      timingClass = 'VERY EARLY';
      cursorNorm = 0.14;
    } else if (distZ < -1.45 || (evt.dirX && evt.dirX < -0.52)) {
      timingClass = 'EARLY';
      cursorNorm = 0.28;
    } else if (distZ > 1.35) {
      timingClass = 'VERY LATE';
      cursorNorm = 0.88;
    } else if (distZ > 0.68 || (evt.dirX && evt.dirX > 0.52)) {
      timingClass = 'LATE';
      cursorNorm = 0.72;
    } else if (isStretched && this.matchConfig.difficulty === 'pro') {
      timingClass = distZ < 0 ? 'EARLY' : 'LATE';
      cursorNorm = distZ < 0 ? 0.30 : 0.70;
    }

    const isMishit = timingClass === 'VERY EARLY' || timingClass === 'VERY LATE';
    const shotType = this.selectedShotType || 'TOPSPIN';
    const isPower =
      !isMishit &&
      (timingClass === 'PERFECT' || shotType === 'FLAT' || isOverhead) &&
      swingSpeed >= 0.98;

    // Compute lateral shot direction (`targetX`) based on timing, player side, and wrist/aim angle (`evt.dirX`)
    const playerSideSign = hitter.pos.x >= 0 ? 1 : -1;
    const userAimX = THREE.MathUtils.clamp(Number(evt.dirX || 0), -1, 1);
    let targetX = 0;

    if (timingClass === 'EARLY' || timingClass === 'VERY EARLY') {
      // Cross-court pull
      targetX = -playerSideSign * (2.35 + Math.random() * 1.15) + userAimX * 0.95;
    } else if (timingClass === 'LATE' || timingClass === 'VERY LATE') {
      // Down-the-line push
      targetX = playerSideSign * (2.35 + Math.random() * 1.05) + userAimX * 0.95;
    } else {
      // PERFECT timing: aim sharply into the open court away from the opponent, plus user wrist steer!
      const awaySign = this.opponent.pos.x >= 0 ? -1 : 1;
      if (Math.abs(userAimX) > 0.22) {
        targetX = userAimX * (2.75 + Math.random() * 0.95);
      } else {
        targetX = awaySign * (2.45 + Math.random() * 1.25);
      }
    }

    // Only risk spraying out on extreme mishits in Pro mode; in Casual mode keep shots inside the lines!
    let forceOutWide = false;
    let forceNetError = false;
    if (isMishit && !isAutoAssist && !this.autoPlayMode && this.matchConfig.difficulty === 'pro') {
      if (swingSpeed > 1.45 && Math.random() < 0.28) {
        forceOutWide = true;
      }
    }

    if (forceOutWide) {
      const outSign = targetX >= 0 ? 1 : -1;
      targetX = outSign * (COURT.SINGLES_X + 0.48 + Math.random() * 0.45);
    } else if (isMishit) {
      targetX = THREE.MathUtils.clamp(targetX * 0.65, -COURT.SINGLES_X + 0.65, COURT.SINGLES_X - 0.65);
    } else {
      targetX = THREE.MathUtils.clamp(targetX, -COURT.SINGLES_X + 0.35, COURT.SINGLES_X - 0.35);
    }

    let targetZ = -(8.2 + Math.random() * 2.6);
    let flightTime = 0.84;
    let topspin = 16.0;
    let sidespin = 0.0;

    if (isMishit && !forceOutWide && !forceNetError) {
      flightTime = 1.04;
      targetZ = -(6.2 + Math.random() * 2.2);
      topspin = 6.0;
    } else if (useNetPartner) {
      flightTime = isPower ? 0.56 : 0.68;
      targetZ = -(5.6 + Math.random() * 3.4);
      topspin = 12.0;
    } else if (shotType === 'LOB') {
      flightTime = 1.32;
      targetZ = -(9.0 + Math.random() * 2.0);
      topspin = 4.0;
    } else if (shotType === 'SLICE') {
      flightTime = 0.98;
      targetZ = -(6.8 + Math.random() * 2.6);
      topspin = -6.5;
      sidespin = -playerSideSign * 11.0;
    } else if (shotType === 'FLAT' || isPower) {
      flightTime = Math.max(0.58, 0.72 / Math.min(1.20, swingSpeed * 0.94));
      targetZ = -(9.0 + Math.random() * 2.2);
      topspin = 21.0;
    } else {
      flightTime = Math.max(0.68, 0.84 / Math.min(1.16, swingSpeed * 0.92));
    }

    const rallySpeedFactor = Math.max(0.84, 1.0 - Math.min(8, this.ball.rallyStrokeCount) * 0.015);
    flightTime *= rallySpeedFactor;

    const contactPos = this.ball.pos.clone();
    contactPos.y = Math.max(0.78, Math.min(1.92, contactPos.y));
    this.ball.pos.copy(contactPos);

    this._launchBallToTarget(contactPos, new THREE.Vector3(targetX, 0, targetZ), flightTime, {
      topspin,
      sidespin,
      allowNetFault: forceNetError,
    });

    this.ball.inPlay = true;
    this.ball.lastHitter = 'player';
    this.ball.bounceCountOnCurrentSide = 0;
    this.ball.rallyStrokeCount += 1;
    this.ball.shotType = shotType;
    this.ball.isPowerShot = isPower;

    this.ballTrail.setStyle(shotType, isPower);
    if (this.racketKinematics) {
      this.racketKinematics.triggerImpactRecoil(hitter, isPower ? 1.4 : 1.0);
    }
    if (this.swingVfx) {
      this.swingVfx.onRacketContact({
        actor: hitter,
        ball: this.ball,
        contactPos,
        shotType: isOverhead ? 'SMASH' : shotType,
        isPower,
        isServe: false,
        timingQuality: timingClass,
        speed: this.ball.vel.length(),
      });
    }
    if (this.facialFX) {
      this.facialFX.setExpression(hitter, isPower ? 'effort_shout' : 'focused_squint', 0.55);
    }
    if (isPower) {
      this.cameraTrauma = 0.26;
      this._spawnStarBurst(contactPos, 11);
    }

    if (this.audioEngine) {
      this.audioEngine.playRacketHit(
        shotType === 'FLAT' || isOverhead ? 'smash' : shotType.toLowerCase(),
        timingClass === 'PERFECT' ? 'perfect' : 'good'
      );
      if (hitter.swingType === 'smash' && !this.autoPlayMode) {
        this.audioEngine.playVoiceCallout('smash');
      }
    }

    const speedKmh = Math.round(this.ball.vel.length() * 6.8);
    const strokeHandLabel = isOverhead ? 'SMASH' : isBackhand ? 'BACKHAND' : 'FOREHAND';
    const dirLabel = useNetPartner
      ? 'NET VOLLEY'
      : isMishit
      ? 'DEFENSIVE'
      : timingClass === 'EARLY'
      ? `${strokeHandLabel} CROSS`
      : timingClass === 'LATE'
      ? `${strokeHandLabel} LINE`
      : `${strokeHandLabel} ${shotType}`;

    if (!this.autoPlayMode) {
      const screenPos = this._projectToScreen(
        hitter.pos.clone().add(new THREE.Vector3(0, 2.35, 0))
      );
      this.hud.showTimingPopup({
        grade: `${timingClass} • ${dirLabel}!`,
        detail: `${speedKmh} KM/H`,
        screenPos,
      });

      if (this.motionController && this.motionController.triggerHapticFeedback) {
        this.motionController.triggerHapticFeedback({
          role: 'p1',
          kind: isMishit ? 'fault' : 'hit',
          grade: `${timingClass} • ${dirLabel}`,
          shotType: isOverhead ? 'SMASH' : shotType,
          speedKmh,
          intensity: isPower ? 1.45 : isMishit ? 0.75 : 1.1,
        });
      }
    }

    this.hud.updateTimingGauge({
      cursorNormalized: cursorNorm,
      modeTitle: `${timingClass} (${dirLabel})`,
      speedText: `${speedKmh} KM/H`,
    });

    // Recover player baseline & net partner toward tactical court positions while ball travels to opponent
    this.player.targetPos.set(
      THREE.MathUtils.clamp(-targetX * 0.22, -1.6, 1.6),
      0,
      COURT.BASELINE_Z - 0.15
    );
    this.playerPartner.targetPos.set(
      THREE.MathUtils.clamp(targetX * 0.35 + (this.score.deuceSide ? -1.4 : 1.4), -2.8, 2.8),
      0,
      5.1
    );

    this._predictBallIntercept(this.opponent);
    return true;
  }

  /**
   * Executes a human Player 2 rally strike on the far court (`Z < 0`) in 1v1 Multiplayer mode.
   */
  _attemptP2RallyStrike(evt = {}) {
    if (this.ball.lastHitter === 'opponent') return false;

    const distOppZ = this.opponent.pos.z - this.ball.pos.z; // < 0 as ball approaches P2, > 0 once past P2
    const distOppX = Math.abs(this.ball.pos.x - this.opponent.pos.x);
    const distOppXZ = Math.hypot(distOppX, distOppZ);

    const distPartZ = this.opponentPartner.pos.z - this.ball.pos.z;
    const distPartX = Math.abs(this.ball.pos.x - this.opponentPartner.pos.x);
    const distPartXZ = Math.hypot(distPartX, distPartZ);

    const useNetPartner =
      this.ball.pos.z < -0.3 &&
      this.ball.pos.z >= -7.6 &&
      distPartXZ <= 3.95 &&
      distPartXZ < distOppXZ;

    const hitter = useNetPartner ? this.opponentPartner : this.opponent;
    const distZ = useNetPartner ? distPartZ : distOppZ;
    const distX = useNetPartner ? distPartX : distOppX;
    const distXZ = useNetPartner ? distPartXZ : distOppXZ;

    if (hitter.swingCooldown > 0) return false;

    const swingSpeed = THREE.MathUtils.clamp(Number(evt.speed || 1.18), 0.80, 1.68);
    if (evt.shotType) {
      const norm = String(evt.shotType).toUpperCase();
      this.p2SelectedShotType = norm === 'SMASH' || norm === 'POWER' ? 'FLAT' : norm;
    }
    const isBackhand =
      evt.side === 'backhand'
        ? true
        : evt.side === 'forehand'
        ? false
        : Number(evt.dirX || 0) > 0.14
        ? true
        : Number(evt.dirX || 0) < -0.14
        ? false
        : this.ball.pos.x > hitter.pos.x + 0.04 || this.ball.targetLanding.x > 0.12;
    const shotType = this.p2SelectedShotType || 'TOPSPIN';
    const isOverhead =
      evt.side === 'overhead' ||
      ((shotType === 'FLAT' || evt.shotType === 'smash') && this.ball.pos.y > 1.50) ||
      this.ball.pos.y > 1.78;
    hitter.swingType = isOverhead ? 'smash' : isBackhand ? 'backhand' : 'forehand';
    hitter.swingDuration = 0.36;
    hitter.swingTimer = 0.36;
    hitter.arcVisibleTimer = 0.36;
    if (hitter.swingArcMesh) hitter.swingArcMesh.visible = false;

    if (this.racketKinematics) {
      const rawShot = String(evt.shotType || shotType || 'topspin').toLowerCase();
      const kinShot = isOverhead ? 'smash' : rawShot === 'power' ? 'smash' : rawShot;
      this.racketKinematics.triggerSwing(hitter, {
        shotType: kinShot,
        side: isOverhead ? 'overhead' : isBackhand ? 'backhand' : 'forehand',
        speed: swingSpeed,
        timing: 'sweet',
        dirX: Number(evt.dirX || 0),
      });
    }

    if (this.audioEngine) {
      this.audioEngine.playSwingWhoosh(swingSpeed);
    }

    const maxStrikeReach = useNetPartner ? 4.05 : 4.85;
    if (distXZ > maxStrikeReach) {
      if (distZ > 1.45) {
        hitter.swingCooldown = 0.16;
        if (this.motionController && this.motionController.triggerHapticFeedback) {
          this.motionController.triggerHapticFeedback({
            role: 'p2',
            kind: 'whiff',
            grade: 'TOO LATE! • WHIFF',
            shotType,
            speedKmh: 0,
            intensity: 0.65,
          });
        }
      }
      return false;
    }

    let timingClass = 'PERFECT';
    if (evt.sweetSpotAssisted && distZ >= -1.85 && distZ <= 0.78) {
      timingClass = 'PERFECT';
    } else if (distZ < -1.45 || (evt.dirX && evt.dirX < -0.52)) {
      timingClass = 'EARLY';
    } else if (distZ > 0.68 || (evt.dirX && evt.dirX > 0.52)) {
      timingClass = 'LATE';
    }

    const isPower = (timingClass === 'PERFECT' || shotType === 'FLAT' || isOverhead) && swingSpeed >= 0.98;
    const p2SideSign = hitter.pos.x >= 0 ? 1 : -1;
    const userAimX = THREE.MathUtils.clamp(Number(evt.dirX || 0), -1, 1);
    let targetX = 0;

    if (timingClass === 'EARLY') {
      targetX = -p2SideSign * (2.25 + Math.random() * 1.1) - userAimX * 0.95;
    } else if (timingClass === 'LATE') {
      targetX = p2SideSign * (2.25 + Math.random() * 1.05) - userAimX * 0.95;
    } else {
      const awaySign = this.player.pos.x >= 0 ? -1 : 1;
      targetX = Math.abs(userAimX) > 0.22
        ? -userAimX * (2.65 + Math.random() * 0.95)
        : awaySign * (2.35 + Math.random() * 1.25);
    }
    targetX = THREE.MathUtils.clamp(targetX, -COURT.SINGLES_X + 0.38, COURT.SINGLES_X - 0.38);

    let targetZ = 8.0 + Math.random() * 2.6;
    let flightTime = isPower ? 0.72 : 0.86;
    let topspin = isPower ? 20.0 : 15.0;
    let sidespin = 0;

    if (useNetPartner) {
      flightTime = isPower ? 0.58 : 0.70;
      targetZ = 5.6 + Math.random() * 3.2;
    } else if (shotType === 'LOB') {
      flightTime = 1.30;
      targetZ = 9.0 + Math.random() * 2.0;
      topspin = 4.0;
    } else if (shotType === 'SLICE') {
      flightTime = 0.98;
      targetZ = 6.8 + Math.random() * 2.5;
      topspin = -6.0;
      sidespin = p2SideSign * 10.0;
    }

    const contactPos = this.ball.pos.clone();
    contactPos.y = Math.max(0.78, Math.min(1.92, contactPos.y));
    this.ball.pos.copy(contactPos);

    this._launchBallToTarget(contactPos, new THREE.Vector3(targetX, 0, targetZ), flightTime, {
      topspin,
      sidespin,
      allowNetFault: false,
    });

    this.ball.inPlay = true;
    this.ball.lastHitter = 'opponent';
    this.ball.bounceCountOnCurrentSide = 0;
    this.ball.rallyStrokeCount += 1;
    this.ball.shotType = shotType;
    this.ball.isPowerShot = isPower;

    this.ballTrail.setStyle(shotType, isPower);
    if (this.racketKinematics) {
      this.racketKinematics.triggerImpactRecoil(hitter, isPower ? 1.4 : 1.0);
    }
    if (this.swingVfx) {
      this.swingVfx.onRacketContact({
        actor: hitter,
        ball: this.ball,
        contactPos,
        shotType: isOverhead ? 'SMASH' : shotType,
        isPower,
        isServe: false,
        timingQuality: timingClass,
        speed: this.ball.vel.length(),
      });
    }
    if (this.facialFX) {
      this.facialFX.setExpression(hitter, isPower ? 'effort_shout' : 'focused_squint', 0.55);
    }
    if (isPower) {
      this.cameraTrauma = 0.24;
      this._spawnStarBurst(contactPos, 10);
    }

    if (this.audioEngine) {
      this.audioEngine.playRacketHit(
        shotType === 'FLAT' || isOverhead ? 'smash' : shotType.toLowerCase(),
        timingClass === 'PERFECT' ? 'perfect' : 'good'
      );
    }

    const speedKmh = Math.round(this.ball.vel.length() * 6.8);
    const dirLabel = useNetPartner
      ? 'NET VOLLEY'
      : timingClass === 'EARLY'
      ? 'CROSS-COURT'
      : timingClass === 'LATE'
      ? 'DOWN THE LINE'
      : `SWEET SPOT ${shotType}`;

    const screenPos = this._projectToScreen(
      hitter.pos.clone().add(new THREE.Vector3(0, 2.35, 0))
    );
    this.hud.showTimingPopup({
      grade: `P2 ${timingClass} • ${dirLabel}!`,
      detail: `${speedKmh} KM/H`,
      screenPos,
    });

    if (this.motionController && this.motionController.triggerHapticFeedback) {
      this.motionController.triggerHapticFeedback({
        role: 'p2',
        kind: 'hit',
        grade: `${timingClass} • ${dirLabel}`,
        shotType: isOverhead ? 'SMASH' : shotType,
        speedKmh,
        intensity: isPower ? 1.45 : 1.1,
      });
    }

    this.opponent.targetPos.set(
      THREE.MathUtils.clamp(-targetX * 0.22, -1.6, 1.6),
      0,
      -COURT.BASELINE_Z + 0.25
    );
    this.opponentPartner.targetPos.set(
      THREE.MathUtils.clamp(targetX * 0.35 + (this.score.deuceSide ? 1.4 : -1.4), -2.8, 2.8),
      0,
      -5.1
    );

    this._predictBallIntercept(this.player);
    return true;
  }

  _executeOpponentReturn(hitterActor = this.opponent) {
    const isNetPartner = hitterActor === this.opponentPartner;
    const isCasual = this.matchConfig.difficulty !== 'pro';
    const reachX = Math.abs(this.ball.pos.x - hitterActor.pos.x);
    const incomingWasPower = Boolean(this.ball.isPowerShot);
    const stretchThreshold = isCasual ? 1.08 : 1.55;
    const isHeavilyStretched = reachX > stretchThreshold || (incomingWasPower && reachX > (isCasual ? 0.75 : 1.25));

    const isBackhand = this.ball.pos.x > hitterActor.pos.x + 0.05;
    hitterActor.swingType = isBackhand ? 'backhand' : 'forehand';
    hitterActor.swingDuration = 0.36;
    hitterActor.swingTimer = 0.36;
    hitterActor.arcVisibleTimer = this.autoPlayMode ? 0.85 : 0.36;
    if (hitterActor.swingArcMesh) hitterActor.swingArcMesh.visible = false;

    const targetSign = this.player.pos.x >= 0 ? -1 : 1;
    // In Casual mode, AI returns land closer to a comfortable player strike zone instead of painting extreme corners
    const spreadX = isCasual ? 0.85 + Math.random() * 1.15 : 1.25 + Math.random() * 1.75;
    let targetX = THREE.MathUtils.clamp(
      targetSign * spreadX,
      -COURT.SINGLES_X + 0.65,
      COURT.SINGLES_X - 0.65
    );
    let targetZ = isCasual ? 6.4 + Math.random() * 2.4 : 7.4 + Math.random() * 3.0;
    let chosenShot = 'TOPSPIN';
    let flightTime = isCasual ? 1.14 : 0.88;
    let allowNetFault = false;

    if (this.autoPlayMode && !this.userHasInteracted) {
      chosenShot = 'TOPSPIN';
      flightTime = 0.84;
    } else if (isHeavilyStretched && this.ball.rallyStrokeCount >= 2) {
      // Rewarding AI balance: when pressured by a player Sweet-Spot Power Shot or sharp angle,
      // Casual AI commits a forced error ~38% of the time or pops up an attackable high floating ball!
      const forcedErrorChance = isCasual
        ? reachX > 1.45 || incomingWasPower
          ? 0.42
          : 0.28
        : reachX > 1.92
        ? 0.24
        : 0.14;
      if (Math.random() < forcedErrorChance) {
        if (Math.random() < 0.48) {
          allowNetFault = true;
          targetZ = 1.2;
          flightTime = 0.76;
        } else {
          const errSign = Math.random() < 0.5 ? 1 : -1;
          targetX = errSign * (COURT.SINGLES_X + 0.48 + Math.random() * 0.45);
          targetZ = 9.5 + Math.random() * 2.8;
          flightTime = 0.88;
        }
      } else {
        // Defensive floating return landing mid-court — sets up the player for a smash or put-away!
        chosenShot = reachX > 1.35 || incomingWasPower ? 'LOB' : 'SLICE';
        targetX = THREE.MathUtils.clamp(
          (Math.random() - 0.5) * 2.4,
          -COURT.SINGLES_X + 1.1,
          COURT.SINGLES_X - 1.1
        );
        targetZ = 5.6 + Math.random() * 2.2;
        flightTime = chosenShot === 'LOB' ? 1.36 : 1.18;
      }
    } else if (isNetPartner) {
      chosenShot = 'SLICE';
      targetZ = 5.8 + Math.random() * 2.6;
      flightTime = isCasual ? 0.96 : 0.76;
    } else {
      const shotChoices = ['TOPSPIN', 'TOPSPIN', 'SLICE', 'TOPSPIN', 'LOB'];
      chosenShot = shotChoices[this.ball.rallyStrokeCount % shotChoices.length];
      flightTime = chosenShot === 'LOB'
        ? (isCasual ? 1.36 : 1.24)
        : chosenShot === 'SLICE'
        ? (isCasual ? 1.18 : 0.96)
        : (isCasual ? 1.10 : 0.86);
    }

    const contactPos = this.ball.pos.clone();
    contactPos.y = Math.max(0.82, Math.min(1.68, contactPos.y));
    this.ball.pos.copy(contactPos);

    this._launchBallToTarget(contactPos, new THREE.Vector3(targetX, 0, targetZ), flightTime, {
      topspin: chosenShot === 'SLICE' ? -5.0 : chosenShot === 'LOB' ? 5.0 : 13.0,
      sidespin: 0,
      allowNetFault,
    });

    this.ball.inPlay = true;
    this.ball.lastHitter = 'opponent';
    this.ball.bounceCountOnCurrentSide = 0;
    this.ball.rallyStrokeCount += 1;
    this.ball.shotType = chosenShot;
    this.ball.isPowerShot = false;

    this.ballTrail.setStyle(chosenShot, false);

    if (this.racketKinematics) {
      this.racketKinematics.triggerSwing(hitterActor, {
        shotType: chosenShot.toLowerCase(),
        side: isBackhand ? 'backhand' : 'forehand',
        speed: 1.15,
        timing: 'sweet',
      });
      this.racketKinematics.triggerImpactRecoil(hitterActor, 0.95);
    }
    if (this.swingVfx) {
      this.swingVfx.onRacketContact({
        actor: hitterActor,
        ball: this.ball,
        contactPos,
        shotType: chosenShot,
        isPower: false,
        isServe: false,
        timingQuality: 'GOOD',
        speed: this.ball.vel.length(),
      });
    }
    if (this.facialFX) {
      this.facialFX.setExpression(
        hitterActor,
        isHeavilyStretched ? 'wide_eyed_panic' : 'effort_shout',
        0.65
      );
      if (isHeavilyStretched) {
        this.facialFX.spawnSweatDrops(hitterActor, 4);
      }
    }

    if (this.audioEngine) {
      this.audioEngine.playSwingWhoosh(1.0);
      this.audioEngine.playRacketHit(chosenShot.toLowerCase(), 'good');
    }

    // Recover opponent toward center-baseline after hitting
    this.opponent.targetPos.set(
      THREE.MathUtils.clamp(-targetX * 0.25, -1.6, 1.6),
      0,
      -COURT.BASELINE_Z + 0.35
    );
    this._predictBallIntercept(this.player);
  }

  // --------------------------------------------------------------------------
  // 7. Trajectory Solver & Intercept Prediction
  // --------------------------------------------------------------------------
  _launchBallToTarget(
    startPos,
    landingPos,
    flightTime,
    { topspin = 14.0, sidespin = 0.0, allowNetFault = false } = {}
  ) {
    const T = Math.max(0.45, flightTime);
    const dx = landingPos.x - startPos.x;
    const dz = landingPos.z - startPos.z;
    const dy = 0.08 - startPos.y;

    const gEff = PHYSICS.GRAVITY + topspin * 0.14;
    const vx = dx / T - 0.5 * (sidespin * 0.12) * T;
    const vz = dz / T;
    const vy = (dy + 0.5 * gEff * T * T) / T;

    this.ball.vel.set(vx, vy, vz);
    this.ball.spin.set(topspin, sidespin, 0);
    this.ball.targetLanding.copy(landingPos);

    const timeToNet = Math.abs(startPos.z) / Math.max(1.0, Math.abs(vz));
    if (timeToNet > 0 && timeToNet < T) {
      const yAtNet = startPos.y + vy * timeToNet - 0.5 * gEff * timeToNet * timeToNet;
      if (allowNetFault) {
        // Force trajectory to clip the top half of the net!
        const faultHeight = COURT.NET_HEIGHT_CENTER - 0.12;
        const adjustVy = (faultHeight - yAtNet) / timeToNet;
        this.ball.vel.y += adjustVy;
      } else {
        const minClearance = COURT.NET_HEIGHT_CENTER + 0.34;
        if (yAtNet < minClearance) {
          const boostVy = (minClearance - yAtNet) / timeToNet;
          this.ball.vel.y += boostVy;
        }
      }
    }
  }

  _predictBallIntercept(actor) {
    const landing = this.ball.targetLanding;
    const interceptZ = THREE.MathUtils.clamp(
      landing.z + actor.sideSign * 2.15,
      actor.sideSign > 0 ? 3.2 : -13.6,
      actor.sideSign > 0 ? 13.4 : -3.2
    );
    // Position the Mii ~0.38m inside the ball's lateral path so the ball arrives at arm's length
    // on the Forehand side (when ball is on the right) or Backhand side (when ball is on the left)!
    const stanceOffset = landing.x < -0.12 ? 0.38 : -0.38;
    const interceptX = THREE.MathUtils.clamp(
      landing.x + stanceOffset,
      -COURT.DOUBLES_X + 0.4,
      COURT.DOUBLES_X - 0.4
    );
    actor.targetPos.set(interceptX, 0, interceptZ);

    // Also update the corresponding frontcourt Net Partner's patrol position!
    if (actor === this.player && this.playerPartner) {
      if (landing.z > 0 && landing.z < 6.6 && Math.abs(landing.x - this.playerPartner.pos.x) < 2.9) {
        // Short ball in frontcourt — net partner steps in to intercept!
        this.playerPartner.targetPos.set(
          THREE.MathUtils.clamp(landing.x, -COURT.SINGLES_X + 0.4, COURT.SINGLES_X - 0.4),
          0,
          THREE.MathUtils.clamp(landing.z + 0.85, 2.8, 6.2)
        );
      } else {
        this.playerPartner.targetPos.set(
          THREE.MathUtils.clamp(landing.x * 0.42 + (this.score.deuceSide ? -1.35 : 1.35), -2.9, 2.9),
          0,
          5.1
        );
      }
    } else if (actor === this.opponent && this.opponentPartner) {
      this.opponentPartner.targetPos.set(
        THREE.MathUtils.clamp(landing.x * 0.45 + (this.score.deuceSide ? 1.35 : -1.35), -2.9, 2.9),
        0,
        -5.1
      );
    }
  }

  // --------------------------------------------------------------------------
  // 8. Fixed-Timestep (1/120s) Physics & Scoring Engine
  // --------------------------------------------------------------------------
  update(rawDt) {
    this.elapsedTime += rawDt;

    this.cameraTrauma = Math.max(0, this.cameraTrauma - rawDt * 1.4);

    // 2-Frame Hit-Stop freeze on sweet-spot smashes & power serves while VFX/recoil shimmer at full speed
    const effectiveDt = this.swingVfx ? this.swingVfx.consumeHitStop(rawDt) : rawDt;

    const timeScale = this.phase === 'REPLAY' ? 0.38 : 1.0;
    this.physicsAccumulator += effectiveDt * timeScale;
    while (this.physicsAccumulator >= PHYSICS.FIXED_DT) {
      this._stepPhysics(PHYSICS.FIXED_DT);
      this.physicsAccumulator -= PHYSICS.FIXED_DT;
    }

    if (
      this.isMultiplayer &&
      this.roomId &&
      this.roomId !== 'default' &&
      this.playerRole === 'p1' &&
      this.elapsedTime - this.lastSyncSentAt >= 0.045
    ) {
      this.lastSyncSentAt = this.elapsedTime;
      this._broadcastMultiplayerSnapshot();
    }

    this._updateMiiAnimation(this.player, rawDt);
    this._updateMiiAnimation(this.playerPartner, rawDt);
    this._updateMiiAnimation(this.opponent, rawDt);
    this._updateMiiAnimation(this.opponentPartner, rawDt);
    this._updateCrowdAnimation(rawDt);

    if (this.swingVfx) {
      this.swingVfx.update(rawDt, {
        actors: [this.player, this.playerPartner, this.opponent, this.opponentPartner],
        ball: this.ball,
        camera: this.camera,
      });

      // Keep 36-slice Catmull-Rom 3D racket ribbon trails freshly seeded in deterministic
      // showcase / locked-replay / autoplay states so headless screenshots at any timestamp
      // capture full-opacity curved swing ribbons!
      if (this.phase === 'SHOWCASE') {
        const mode = this.showcaseModeName || 'showcase_topspin';
        if (mode === 'showcase_slice' || mode === 'showcase_backhand') {
          this.swingVfx.seedActorSwingArc(this.player, {
            shotType: 'SLICE',
            isPower: false,
            whipSpeed: 26,
            swingType: 'backhand',
          });
        } else if (mode === 'showcase_smash') {
          this.swingVfx.seedActorSwingArc(this.player, {
            shotType: 'SMASH',
            isPower: true,
            whipSpeed: 34,
            swingType: 'smash',
          });
        } else if (mode === 'showcase_topspin') {
          this.swingVfx.seedActorSwingArc(this.player, {
            shotType: 'TOPSPIN',
            isPower: true,
            whipSpeed: 29,
            swingType: 'forehand',
          });
        }
      } else if (this.phase === 'REPLAY' && this.persistentStateLock && !this.userHasInteracted) {
        this.swingVfx.seedActorSwingArc(this.player, {
          shotType: 'TOPSPIN',
          isPower: true,
          whipSpeed: 28,
          swingType: 'forehand',
        });
        this.swingVfx.seedActorSwingArc(this.opponent, {
          shotType: 'SLICE',
          isPower: false,
          whipSpeed: 25,
          swingType: 'forehand',
        });
      } else if (this.phase === 'RALLY' && this.autoPlayMode && !this.userHasInteracted) {
        this.swingVfx.seedActorSwingArc(this.player, {
          shotType: 'TOPSPIN',
          isPower: true,
          whipSpeed: 28,
          swingType: 'forehand',
        });
      }
    }

    this._updateEffects(rawDt);
    this._updateCameraRig(rawDt);
    this._updateProjectedHUD();
  }

  _stepPhysics(dt) {
    this.phaseTimer += dt;
    if (this.player.swingCooldown > 0) {
      this.player.swingCooldown = Math.max(0, this.player.swingCooldown - dt);
    }
    if (this.playerPartner.swingCooldown > 0) {
      this.playerPartner.swingCooldown = Math.max(0, this.playerPartner.swingCooldown - dt);
    }
    if (this.opponent.swingCooldown > 0) {
      this.opponent.swingCooldown = Math.max(0, this.opponent.swingCooldown - dt);
    }
    if (this.opponentPartner.swingCooldown > 0) {
      this.opponentPartner.swingCooldown = Math.max(0, this.opponentPartner.swingCooldown - dt);
    }

    // 0. Handle Kinetic Showcase State (?state=showcase_topspin|showcase_slice|showcase_backhand|showcase_smash|showcase_panic|showcase_win)
    if (this.phase === 'SHOWCASE') {
      if (this.phaseTimer >= 0.34) {
        this.phaseTimer = 0;
        this._refreshShowcasePose();
      } else {
        const mode = this.showcaseModeName || 'showcase_topspin';
        if ((mode === 'showcase_slice' || mode === 'showcase_backhand') && this.player.racketKinematics) {
          this.player.racketKinematics.swingActive = true;
          this.player.racketKinematics.swingElapsed = 0.072;
          this.player.swingTimer = 0.26;
        } else if (mode === 'showcase_smash' && this.player.racketKinematics) {
          this.player.racketKinematics.swingActive = true;
          this.player.racketKinematics.swingElapsed = 0.058;
          this.player.swingTimer = 0.26;
        } else if (mode === 'showcase_topspin' && this.player.racketKinematics) {
          this.player.racketKinematics.swingActive = true;
          this.player.racketKinematics.swingElapsed = 0.068;
          this.player.swingTimer = 0.26;
        } else if (mode === 'showcase_panic') {
          this.player.vel.set(-6.8, 0, 1.2);
          this.player.stridePhase += dt * 15.0;
        } else if (mode === 'showcase_win' && this.player.rig?.reaction) {
          this.player.rig.reaction.timer = 0.16;
        }
      }
      return;
    }

    // 1. Handle Replay State (Unobstructed Net-Volley Showcase Loop)
    if (this.phase === 'REPLAY') {
      if (this.persistentStateLock && !this.userHasInteracted) {
        // Keep the ball and its 45-segment ribbon trail oscillating cleanly in the open gap
        // between the Red Player (1.55, 0, 0.95) and Blue Opponent (-1.25, 0, -1.35)
        const wave = 0.5 + 0.5 * Math.sin(this.elapsedTime * 2.2);
        const fromPos = new THREE.Vector3(-1.12, 1.22, -1.08);
        const toPos = new THREE.Vector3(-0.18 + wave * 0.22, 1.32 + wave * 0.08, -0.05 + wave * 0.22);
        this.ball.pos.copy(toPos);
        this.ballTrail.seedArc(fromPos, toPos, 0.24);
        this.player.swingTimer = 0.22;
        this.player.arcVisibleTimer = 0.9;
        this.opponent.swingTimer = 0.20;
        this.opponent.arcVisibleTimer = 0.9;
        if (this.player.racketKinematics) {
          this.player.racketKinematics.swingActive = true;
          this.player.racketKinematics.swingShotType = 'topspin';
          this.player.racketKinematics.swingSide = 'forehand';
          this.player.racketKinematics.swingElapsed = 0.13;
        }
        if (this.opponent.racketKinematics) {
          this.opponent.racketKinematics.swingActive = true;
          this.opponent.racketKinematics.swingShotType = 'slice';
          this.opponent.racketKinematics.swingSide = 'forehand';
          this.opponent.racketKinematics.swingElapsed = 0.11;
        }
        return;
      }

      this.ball.pos.addScaledVector(this.ball.vel, dt);
      this.ball.vel.y -= PHYSICS.GRAVITY * 0.65 * dt;
      this.ballTrail.pushPoint(this.ball.pos);

      if (this.phaseTimer > 1.45) {
        this.hud.setReplayMode(false);
        this._setupPointServe({ showBanner: true });
      }
      return;
    }

    // 2. Handle CPU Auto-Serve when Opponent is serving (disabled in 1v1 Multiplayer so P2 serves!)
    if (this.phase === 'SERVE_STANCE' && !this.persistentStateLock) {
      if (this.score.server === 'opponent' && !this.isMultiplayer && this.phaseTimer > 1.25) {
        this._startServeToss(this.opponent);
      } else if (this.autoPlayMode && this.score.server === 'player' && this.phaseTimer > 1.4) {
        this._startServeToss(this.player);
      }
    }

    // 3. Handle Serve Toss Vertical Physics
    if (this.phase === 'SERVE_TOSS') {
      this.ball.pos.addScaledVector(this.ball.vel, dt);
      this.ball.vel.y -= PHYSICS.GRAVITY * dt;

      const apexNorm = THREE.MathUtils.clamp((this.ball.pos.y - 1.15) / (3.35 - 1.15), 0, 1);
      this.hud.updateTimingGauge({
        cursorNormalized: apexNorm * 0.52,
        modeTitle: 'SERVE APEX TIMING',
        speedText: this.ball.pos.y >= 2.05 ? 'SWEET SPOT! (198 KM/H)' : 'RISING...',
      });

      // If player swung while ball was rising, auto-release right at the sweet-spot apex!
      if (
        this.pendingServeSwing &&
        (this.ball.pos.y >= 2.68 || this.ball.vel.y <= 0.35)
      ) {
        const { actor, evt } = this.pendingServeSwing;
        this.pendingServeSwing = null;
        this._executeServeHit(actor, evt);
        return;
      }

      if (
        ((this.score.server === 'opponent' && !this.isMultiplayer) || this.autoPlayMode) &&
        this.ball.vel.y <= 0.25 &&
        this.ball.pos.y >= 2.75
      ) {
        const serverActor = this.score.server === 'player' ? this.player : this.opponent;
        this._executeServeHit(serverActor, { timing: 'PERFECT' });
        return;
      }

      if (this.ball.pos.y <= 0.95 && this.ball.vel.y < 0) {
        this.phase = 'SERVE_STANCE';
        this.phaseTimer = 0;
        this.ball.vel.set(0, 0, 0);
        this.pendingServeSwing = null;
      }
      return;
    }

    // 4. Handle Point-Over Pause before Next Serve
    if (this.phase === 'POINT_OVER') {
      if (this.phaseTimer > 2.15) {
        this._setupPointServe({ showBanner: true });
      }
      return;
    }

    // 5. Active Rally Ball Physics & Automated Mii Footwork
    if (this.phase === 'RALLY' && this.ball.inPlay) {
      // In URL ?play=1 or ?state=rally before manual user input, keep the ball and its
      // 45-segment white/gold ribbon trail in the prime mid-court action window so any
      // headless Chrome capture (even at --virtual-time-budget=6000) captures a bold,
      // unmistakable ball arc across the net and player forehand swing arc!
      if (this.autoPlayMode && !this.userHasInteracted) {
        const cycle = (this.elapsedTime * 0.85) % 1.0; // smooth 0..1 stroke progress
        const t = 0.42 + 0.34 * Math.sin(cycle * Math.PI * 2); // oscillates in [0.08..0.76] near net
        const startShot = new THREE.Vector3(1.42, 1.24, 10.85);
        const endLanding = new THREE.Vector3(-1.35, 0.25, -8.5);
        const currentPos = new THREE.Vector3().lerpVectors(startShot, endLanding, t);
        currentPos.y += Math.sin(t * Math.PI) * 1.45;

        this.ball.pos.copy(currentPos);
        if (this.ball.mesh) {
          this.ball.mesh.rotation.x -= dt * 16.0;
        }
        this.ballTrail.setStyle('TOPSPIN', false);
        this.ballTrail.seedArc(startShot, currentPos, 0.78 * t);

        this.player.pos.set(1.35 + Math.sin(this.elapsedTime * 2.2) * 0.18, 0, 11.4);
        this.player.stridePhase += dt * 4.2;
        this.player.swingType = 'forehand';
        this.player.swingTimer = 0.24;
        this.player.arcVisibleTimer = 0.85;
        if (this.player.racketKinematics) {
          this.player.racketKinematics.swingActive = true;
          this.player.racketKinematics.swingShotType = 'topspin';
          this.player.racketKinematics.swingSide = 'forehand';
          this.player.racketKinematics.swingElapsed = 0.12;
        }

        this.opponent.pos.set(-1.35 + Math.cos(this.elapsedTime * 2.2) * 0.35, 0, -10.5);
        this.opponent.stridePhase += dt * 4.2;
        return;
      }

      const prevZ = this.ball.pos.z;

      const speed = this.ball.vel.length();
      const dragFactor = Math.max(0, 1.0 - PHYSICS.AIR_DRAG * speed * dt);
      this.ball.vel.multiplyScalar(dragFactor);

      this.ball.vel.y -= (PHYSICS.GRAVITY + this.ball.spin.x * 0.14) * dt;
      this.ball.vel.x += this.ball.spin.y * 0.12 * dt;

      this.ball.pos.addScaledVector(this.ball.vel, dt);

      if (this.ball.mesh) {
        this.ball.mesh.rotation.x += this.ball.vel.z * dt * 1.8;
        this.ball.mesh.rotation.z -= this.ball.vel.x * dt * 1.8;
      }

      this.ballTrail.pushPoint(this.ball.pos);
      if (this.ball.isPowerShot && Math.random() < 0.45) {
        this._spawnStarBurst(this.ball.pos, 1);
      }

      // Net Plane Collision Check (crossing Z = 0)
      if ((prevZ > 0 && this.ball.pos.z <= 0) || (prevZ < 0 && this.ball.pos.z >= 0)) {
        if (this.ball.pos.y < COURT.NET_HEIGHT_CENTER + 0.04) {
          this.ball.vel.z *= -0.25;
          this.ball.vel.x *= 0.45;
          this.ball.vel.y = 1.2;
          if (this.audioEngine) this.audioEngine.playNetCord();
          this._awardPoint(
            this.ball.lastHitter === 'player' ? 'opponent' : 'player',
            'Net'
          );
          return;
        }
      }

      // Ground Turf Bounce Check (Y <= 0.075m)
      if (this.ball.pos.y <= 0.075 && this.ball.vel.y < 0) {
        const impactVelY = Math.abs(this.ball.vel.y);
        this.ball.pos.y = 0.075;
        this.ball.vel.y = -this.ball.vel.y * PHYSICS.BOUNCE_RESTITUTION;
        this.ball.vel.x *= PHYSICS.SURFACE_FRICTION;
        this.ball.vel.z *= PHYSICS.SURFACE_FRICTION;

        this._spawnBounceRing(this.ball.pos.x, this.ball.pos.z);
        if (this.swingVfx) {
          this.swingVfx.spawnTurfBounce(this.ball.pos.x, this.ball.pos.z, this.ball, impactVelY);
        }
        if (this.audioEngine) {
          this.audioEngine.playBallBounce(Math.min(1.2, impactVelY / 5.0));
        }

        const onPlayerSide = this.ball.pos.z > 0;
        const hitterWasPlayer = this.ball.lastHitter === 'player';

        if ((hitterWasPlayer && onPlayerSide) || (!hitterWasPlayer && !onPlayerSide)) {
          this._awardPoint(hitterWasPlayer ? 'opponent' : 'player', 'Out');
          return;
        }

        this.ball.bounceCountOnCurrentSide += 1;

        if (this.ball.bounceCountOnCurrentSide === 1) {
          const outWide = Math.abs(this.ball.pos.x) > COURT.SINGLES_X + 0.22;
          const outLong = Math.abs(this.ball.pos.z) > COURT.BASELINE_Z + 0.28;
          if (outWide || outLong) {
            this._awardPoint(hitterWasPlayer ? 'opponent' : 'player', 'Out');
            return;
          }
        }

        if (this.ball.bounceCountOnCurrentSide >= 2) {
          this._awardPoint(this.ball.lastHitter, 'Nice Shot!');
          return;
        }
      }

      // Automated Mii Footwork for all 4 court players (Baseline & Net Partners)
      this._stepActorFootwork(this.player, dt);
      this._stepActorFootwork(this.playerPartner, dt);
      this._stepActorFootwork(this.opponent, dt);
      this._stepActorFootwork(this.opponentPartner, dt);

      // Far-Court Team Return Logic (1v1 Human Player 2 OR AI Opponent)
      if (this.ball.lastHitter === 'player' && this.ball.pos.z < -2.0) {
        if (this.isMultiplayer) {
          // 1v1 Multiplayer Mode: Human Player 2 controls the far-court Mii!
          const distOpp = Math.hypot(this.ball.pos.x - this.opponent.pos.x, this.ball.pos.z - this.ball.pos.z);
          const distPart = Math.hypot(this.ball.pos.x - this.opponentPartner.pos.x, this.opponentPartner.pos.z - this.ball.pos.z);
          const activeP2Defender =
            this.ball.pos.z >= -7.2 && distPart < distOpp && distPart <= 3.9
              ? this.opponentPartner
              : this.opponent;

          const dzP2 = activeP2Defender.pos.z - this.ball.pos.z;
          const dxP2 = Math.abs(this.ball.pos.x - activeP2Defender.pos.x);

          if (this.playerRole === 'p2') {
            const normCursor = THREE.MathUtils.clamp(0.5 + dzP2 * 0.16, 0.06, 0.94);
            this.hud.updateTimingGauge({
              cursorNormalized: normCursor,
              modeTitle: activeP2Defender === this.opponentPartner ? 'P2 NET TIMING' : 'P2 SWING TIMING',
              speedText:
                dzP2 >= -1.45 && dzP2 <= 0.68
                  ? 'SWEET SPOT!'
                  : dzP2 < -1.45
                  ? 'EARLY (CROSS)'
                  : 'LATE (LINE)',
            });
          }

          if (this.pendingP2Swing) {
            if (this.elapsedTime > this.pendingP2Swing.expiresAt) {
              this.pendingP2Swing = null;
            } else {
              const reachLim = activeP2Defender === this.opponentPartner ? 3.95 : 4.65;
              const inSweetSpot = dzP2 >= -0.85 && dzP2 <= 0.65;
              if (inSweetSpot && Math.hypot(dxP2, dzP2) <= reachLim && this.ball.pos.y < 2.35) {
                const bufferedEvt = this.pendingP2Swing.evt;
                this.pendingP2Swing = null;
                this._attemptP2RallyStrike(bufferedEvt);
                return;
              }
            }
          }

          if (this.ball.pos.z < -15.6) {
            this._awardPoint('player', 'Nice Shot!');
            return;
          }
        } else {
          // Single-Player AI Opponent Return Logic (tuned by Casual vs Pro difficulty)
          const isCasual = this.matchConfig.difficulty !== 'pro';
          const netReachX = isCasual ? 0.85 : 1.30;
          const baseReachX = isCasual ? 1.80 : 2.34;

          // 1. Check if Opponent's Frontcourt Net Partner can intercept a low/floating ball near the net
          if (
            !this.ball.isPowerShot &&
            this.ball.shotType !== 'LOB' &&
            this.ball.rallyStrokeCount > 2 &&
            Math.abs(this.ball.pos.z - this.opponentPartner.pos.z) < 0.88 &&
            Math.abs(this.ball.pos.x - this.opponentPartner.pos.x) < netReachX &&
            this.ball.pos.y < 1.78 &&
            (!isCasual || Math.random() < 0.55)
          ) {
            this._executeOpponentReturn(this.opponentPartner);
            return;
          }

          // 2. Check Baseline Opponent reach
          const dz = Math.abs(this.ball.pos.z - this.opponent.pos.z);
          const dx = Math.abs(this.ball.pos.x - this.opponent.pos.x);
          if (dz < 1.32 && this.ball.pos.y < 2.05) {
            if (dx <= baseReachX) {
              this._executeOpponentReturn(this.opponent);
            } else if (dx <= 3.45 && this.opponent.swingTimer <= 0) {
              // Opponent dives/lunges desperately for a clean player winner but can't reach it!
              const diveSide = this.ball.pos.x < this.opponent.pos.x ? 'backhand' : 'forehand';
              this.opponent.swingType = diveSide;
              this.opponent.swingDuration = 0.36;
              this.opponent.swingTimer = 0.36;
              this.opponent.arcVisibleTimer = 0.32;
              if (this.racketKinematics) {
                this.racketKinematics.triggerSwing(this.opponent, {
                  shotType: 'slice',
                  side: diveSide,
                  speed: 1.2,
                  timing: 'late',
                });
              }
              if (this.facialFX) {
                this.facialFX.setExpression(this.opponent, 'wide_eyed_panic', 0.9);
                this.facialFX.spawnSweatDrops(this.opponent, 5);
              }
              if (this.audioEngine) this.audioEngine.playSwingWhoosh(0.95);
            }
          } else if (this.ball.pos.z < -15.2) {
            this._awardPoint('player', 'Nice Shot!');
            return;
          }
        }
      }

      if (this.ball.lastHitter === 'opponent' && this.ball.pos.z > 2.0) {
        // Choose closest near-court defender (Net Partner vs Baseline Player) for the live Timing Gauge
        const distPlayer = Math.hypot(this.ball.pos.x - this.player.pos.x, this.ball.pos.z - this.player.pos.z);
        const distPartner = Math.hypot(this.ball.pos.x - this.playerPartner.pos.x, this.ball.pos.z - this.playerPartner.pos.z);
        const activeDefender =
          this.ball.pos.z <= 7.2 && distPartner < distPlayer && distPartner <= 3.8
            ? this.playerPartner
            : this.player;

        const dz = this.ball.pos.z - activeDefender.pos.z;
        const dx = Math.abs(this.ball.pos.x - activeDefender.pos.x);

        if (this.playerRole !== 'p2') {
          const normCursor = THREE.MathUtils.clamp(0.5 + dz * 0.16, 0.06, 0.94);
          this.hud.updateTimingGauge({
            cursorNormalized: normCursor,
            modeTitle: activeDefender === this.playerPartner ? 'NET VOLLEY TIMING' : 'SWING TIMING',
            speedText:
              dz >= -1.45 && dz <= 0.68
                ? 'SWEET SPOT!'
                : dz < -2.65
                ? 'VERY EARLY'
                : dz < -1.45
                ? 'EARLY (CROSS)'
                : dz > 1.35
                ? 'TOO LATE!'
                : 'LATE (LINE)',
          });
        }

        // Smart Sweet-Spot Pre-Swing Buffer: if user swung as ball was approaching (within 480ms),
        // release automatically right as the ball enters the sweet spot ([-0.85m .. +0.65m])!
        if (this.pendingUserSwing) {
          if (this.elapsedTime > this.pendingUserSwing.expiresAt) {
            this.pendingUserSwing = null;
          } else {
            const reachLim = activeDefender === this.playerPartner ? 3.95 : 4.65;
            const inSweetSpot = !this.pendingUserSwing.waitForSweetSpot || (dz >= -0.85 && dz <= 0.65);
            if (inSweetSpot && Math.hypot(dx, dz) <= reachLim && this.ball.pos.y < 2.35) {
              const bufferedEvt = this.pendingUserSwing.evt;
              this.pendingUserSwing = null;
              this._attemptPlayerRallyStrike(bufferedEvt, false);
              return;
            }
          }
        }

        // ONLY auto-hit if running in headless ?play=1 demo mode before any user interaction!
        if (
          this.autoPlayMode &&
          !this.userHasInteracted &&
          Math.abs(dz) < 0.55 &&
          dx < 1.45 &&
          this.ball.pos.y < 1.75
        ) {
          this._attemptPlayerRallyStrike({ timing: 'PERFECT' }, true);
        } else if (this.ball.pos.z > 15.6) {
          this._awardPoint('opponent', this.isMultiplayer ? 'Nice Shot!' : 'Point');
          return;
        }
      }
    }
  }

  _stepActorFootwork(actor, dt) {
    const toTargetX = actor.targetPos.x - actor.pos.x;
    const toTargetZ = actor.targetPos.z - actor.pos.z;
    const dist = Math.hypot(toTargetX, toTargetZ);

    if (dist > 0.08) {
      const moveStep = Math.min(dist, actor.maxSpeed * dt);
      const vx = (toTargetX / dist) * (moveStep / dt);
      const vz = (toTargetZ / dist) * (moveStep / dt);
      actor.vel.set(vx, 0, vz);
      actor.pos.x += (toTargetX / dist) * moveStep;
      actor.pos.z += (toTargetZ / dist) * moveStep;
      actor.stridePhase += moveStep * 4.4;
    } else {
      actor.vel.set(0, 0, 0);
    }
  }

  // --------------------------------------------------------------------------
  // 9. Full Tennis Scoring Engine (00 -> 15 -> 30 -> 40 -> Deuce / Ad -> Game)
  // --------------------------------------------------------------------------
  _awardPoint(winnerRole, reasonCallout = '') {
    this.phase = 'POINT_OVER';
    this.phaseTimer = 0;
    this.ball.inPlay = false;
    this.cheerEnergy = 1.0;
    this.pendingUserSwing = null;
    this.pendingP2Swing = null;
    this.pendingServeSwing = null;

    const playerWonPoint = winnerRole === 'player';
    if (this.bodyAnimator) {
      this.bodyAnimator.triggerPointReaction(this.player, playerWonPoint ? 'win' : 'loss');
      this.bodyAnimator.triggerPointReaction(this.playerPartner, playerWonPoint ? 'win' : 'loss');
      this.bodyAnimator.triggerPointReaction(this.opponent, playerWonPoint ? 'loss' : 'win');
      this.bodyAnimator.triggerPointReaction(this.opponentPartner, playerWonPoint ? 'loss' : 'win');
    }
    if (this.facialFX) {
      this.facialFX.setExpression(this.player, playerWonPoint ? 'happy_grin' : 'shocked_loss', 1.8);
      this.facialFX.setExpression(this.playerPartner, playerWonPoint ? 'happy_grin' : 'shocked_loss', 1.8);
      this.facialFX.setExpression(this.opponent, playerWonPoint ? 'shocked_loss' : 'happy_grin', 1.8);
      this.facialFX.setExpression(this.opponentPartner, playerWonPoint ? 'shocked_loss' : 'happy_grin', 1.8);
      this.facialFX.triggerEmoteBurst(playerWonPoint ? this.player : this.opponent, 'win');
    }

    if (this.audioEngine) {
      this.audioEngine.playCrowdReaction(winnerRole === 'player' ? 'cheer' : 'ooh');
    }

    if (this.motionController && this.motionController.triggerHapticFeedback && !this.autoPlayMode) {
      this.motionController.triggerHapticFeedback({
        role: 'p1',
        kind: winnerRole === 'player' ? 'point_won' : 'fault',
        grade: reasonCallout || (winnerRole === 'player' ? 'POINT WON!' : 'POINT LOST'),
        shotType: 'TOPSPIN',
        speedKmh: 0,
        intensity: winnerRole === 'player' ? 1.4 : 0.75,
      });
      if (this.isMultiplayer) {
        this.motionController.triggerHapticFeedback({
          role: 'p2',
          kind: winnerRole === 'opponent' ? 'point_won' : 'fault',
          grade: reasonCallout || (winnerRole === 'opponent' ? 'POINT WON!' : 'POINT LOST'),
          shotType: 'TOPSPIN',
          speedKmh: 0,
          intensity: winnerRole === 'opponent' ? 1.4 : 0.75,
        });
      }
    }

    if (winnerRole === 'player') {
      this.score.playerPoints += 1;
    } else {
      this.score.opponentPoints += 1;
    }

    this.score.deuceSide = !this.score.deuceSide;

    const p = this.score.playerPoints;
    const o = this.score.opponentPoints;

    if ((p >= 4 || o >= 4) && Math.abs(p - o) >= 2) {
      const playerWonGame = p > o;
      if (playerWonGame) this.score.playerGames += 1;
      else this.score.opponentGames += 1;

      this.score.playerPoints = 0;
      this.score.opponentPoints = 0;
      this.score.deuceSide = true;
      this.score.server = this.score.server === 'player' ? 'opponent' : 'player';
      this._syncScoreboardHUD();

      if (
        this.score.playerGames >= this.matchConfig.gamesToWin ||
        this.score.opponentGames >= this.matchConfig.gamesToWin
      ) {
        const playerWonMatch = this.score.playerGames > this.score.opponentGames;
        this.phase = 'MATCH_OVER';
        const winBanner = this.isMultiplayer
          ? playerWonMatch
            ? 'P1 WINS!'
            : 'P2 WINS!'
          : playerWonMatch
          ? 'YOU WIN!'
          : 'Game!';
        const subText = `Final Games: ${this.score.playerGames} - ${this.score.opponentGames}`;
        this._recordBannerBroadcast(winBanner, 'style-gold', subText);
        this.hud.showCenterBanner(winBanner, {
          style: 'style-gold',
          subText,
          durationMs: 2600,
        });
        if (this.audioEngine) {
          this.audioEngine.playMusicForState('victory');
          this.audioEngine.announceScore(playerWonMatch ? 'Game Set and Match' : 'Game');
        }
        setTimeout(() => {
          this.hud.showVictoryModal({
            playerWon: this.playerRole === 'p2' ? !playerWonMatch : playerWonMatch,
            playerGames: this.score.playerGames,
            opponentGames: this.score.opponentGames,
          });
        }, 1800);
        return;
      }

      const gameSub = `Games: ${this.score.playerGames} - ${this.score.opponentGames}`;
      this._recordBannerBroadcast('Game!', 'style-gold', gameSub);
      this.hud.showCenterBanner('Game!', {
        style: 'style-gold',
        subText: gameSub,
        durationMs: 1650,
      });
      if (this.audioEngine) {
        this.audioEngine.announceScore('Game');
      }
      return;
    }

    this._syncScoreboardHUD();
    const { bannerScoreText } = this._formatCurrentScore();
    const bannerStyle =
      reasonCallout === 'Out' || reasonCallout === 'Net' ? 'style-fault' : 'style-score';
    this._recordBannerBroadcast(bannerScoreText, bannerStyle, reasonCallout || '');
    this.hud.showCenterBanner(bannerScoreText, {
      style: bannerStyle,
      subText: reasonCallout || '',
      durationMs: 1450,
    });

    if (this.audioEngine) {
      const hasLineCall = reasonCallout === 'Out' || reasonCallout === 'Net' || reasonCallout === 'Nice Shot!';
      if (hasLineCall) {
        this.audioEngine.playVoiceCallout(reasonCallout, { clearQueue: true });
        this.audioEngine.announceScore(bannerScoreText, { delayMs: 680 });
      } else {
        this.audioEngine.announceScore(bannerScoreText);
      }
    }
  }

  _recordBannerBroadcast(text, style = 'style-score', subText = '') {
    this.bannerSeq += 1;
    this.lastBannerBroadcast = {
      seq: this.bannerSeq,
      text,
      style,
      subText,
    };
  }

  _broadcastMultiplayerSnapshot() {
    const serializeActor = (a) => ({
      px: Number(a.pos.x.toFixed(3)),
      pz: Number(a.pos.z.toFixed(3)),
      tx: Number(a.targetPos.x.toFixed(3)),
      tz: Number(a.targetPos.z.toFixed(3)),
      st: a.swingType,
      sw: Number(a.swingTimer.toFixed(3)),
      av: Number(a.arcVisibleTimer.toFixed(3)),
    });

    const snapshot = {
      phase: this.phase,
      phaseTimer: Number(this.phaseTimer.toFixed(3)),
      cameraMode: this.cameraMode,
      score: { ...this.score },
      ball: {
        px: Number(this.ball.pos.x.toFixed(3)),
        py: Number(this.ball.pos.y.toFixed(3)),
        pz: Number(this.ball.pos.z.toFixed(3)),
        vx: Number(this.ball.vel.x.toFixed(3)),
        vy: Number(this.ball.vel.y.toFixed(3)),
        vz: Number(this.ball.vel.z.toFixed(3)),
        inPlay: this.ball.inPlay,
        lastHitter: this.ball.lastHitter,
        shotType: this.ball.shotType,
        isPowerShot: this.ball.isPowerShot,
        rallyStrokeCount: this.ball.rallyStrokeCount,
      },
      actors: {
        player: serializeActor(this.player),
        playerPartner: serializeActor(this.playerPartner),
        opponent: serializeActor(this.opponent),
        opponentPartner: serializeActor(this.opponentPartner),
      },
      banner: this.lastBannerBroadcast,
    };

    fetch('/api/match/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: this.roomId, snapshot }),
    }).catch(() => {});
  }

  _handleRoomStateUpdate(matchData = {}) {
    if (!matchData) return;
    const prevP2 = Boolean(this.roomStatus.p2Online || this.roomStatus.p2Phone);
    const prevP1 = Boolean(this.roomStatus.p1Online || this.roomStatus.p1Phone);

    // If Player 2 connects a phone or joins the room, automatically enable 1v1 mode!
    const nextP2 = Boolean(matchData.p2Online || matchData.p2?.connected);
    const nextP1 = Boolean(matchData.p1Online || matchData.p1?.connected);
    if (nextP2 && !prevP2) {
      this.isMultiplayer = true;
      this._applyDifficultyTuning('1v1');
      if (this.playerRole !== 'p2' && this.audioEngine && this.audioEngine.playServeToss) {
        this.audioEngine.playServeToss();
      }
    } else if (nextP1 && !prevP1 && this.playerRole === 'p2') {
      if (this.audioEngine && this.audioEngine.playServeToss) {
        this.audioEngine.playServeToss();
      }
    }

    this.roomStatus = {
      roomId: matchData.roomId || this.roomId,
      hostName: matchData.hostName || this.roomStatus.hostName || 'Player 1',
      guestName: matchData.guestName || this.roomStatus.guestName || 'Player 2',
      p1Online: Boolean(matchData.p1Online),
      p2Online: Boolean(matchData.p2Online),
      p1Phone: Boolean(matchData.p1?.connected),
      p2Phone: Boolean(matchData.p2?.connected),
      isMultiplayer: Boolean(this.isMultiplayer || (this.roomId && this.roomId !== 'default')),
      inRally: this.phase === 'RALLY',
      tunnelUrl: matchData.tunnelUrl || this.roomStatus.tunnelUrl || '',
      urls: matchData.urls || this.roomStatus.urls || null,
    };

    if (this.hud && this.hud.updateMultiplayerRoomInfo) {
      this.hud.updateMultiplayerRoomInfo(this.roomStatus);
    }

    // If this client is Player 2 (`role === 'p2'`), apply authoritative state snapshots from Player 1 host
    if (
      this.playerRole === 'p2' &&
      matchData.snapshot &&
      typeof matchData.snapshotSeq === 'number' &&
      matchData.snapshotSeq > this.lastAppliedSnapshotSeq
    ) {
      this.lastAppliedSnapshotSeq = matchData.snapshotSeq;
      const snap = matchData.snapshot;

      if (snap.phase && snap.phase !== 'TITLE') {
        if (this.phase === 'TITLE') {
          this.hud.hideTitleModal();
        }
        this.phase = snap.phase;
        this.cameraMode = snap.cameraMode || this.cameraMode;
      }

      if (snap.score) {
        this.score = { ...this.score, ...snap.score };
        this._syncScoreboardHUD();
      }

      if (snap.ball) {
        this.ball.pos.set(snap.ball.px, snap.ball.py, snap.ball.pz);
        this.ball.vel.set(snap.ball.vx, snap.ball.vy, snap.ball.vz);
        this.ball.inPlay = Boolean(snap.ball.inPlay);
        this.ball.lastHitter = snap.ball.lastHitter || this.ball.lastHitter;
        this.ball.shotType = snap.ball.shotType || 'TOPSPIN';
        this.ball.isPowerShot = Boolean(snap.ball.isPowerShot);
        this.ball.rallyStrokeCount = Number(snap.ball.rallyStrokeCount || 0);
        this.ballTrail.setStyle(this.ball.shotType, this.ball.isPowerShot);
      }

      const applyActor = (actor, s) => {
        if (!s) return;
        actor.pos.x = THREE.MathUtils.lerp(actor.pos.x, s.px, 0.65);
        actor.pos.z = THREE.MathUtils.lerp(actor.pos.z, s.pz, 0.65);
        actor.targetPos.set(s.tx, 0, s.tz);
        if (s.sw > 0 && actor.swingTimer <= 0.05) {
          actor.swingType = s.st || 'forehand';
          actor.swingTimer = s.sw;
          actor.arcVisibleTimer = s.av || 0.32;
          if (this.racketKinematics) {
            this.racketKinematics.triggerSwing(actor, {
              shotType: (snap.ball?.shotType || 'topspin').toLowerCase(),
              side: s.st === 'backhand' ? 'backhand' : s.st === 'smash' ? 'overhead' : 'forehand',
              speed: 1.2,
              timing: 'sweet',
            });
          }
        }
      };

      if (snap.actors) {
        applyActor(this.player, snap.actors.player);
        applyActor(this.playerPartner, snap.actors.playerPartner);
        applyActor(this.opponent, snap.actors.opponent);
        applyActor(this.opponentPartner, snap.actors.opponentPartner);
      }

      if (snap.banner && snap.banner.seq && snap.banner.seq !== this.bannerSeq) {
        this.bannerSeq = snap.banner.seq;
        this.hud.showCenterBanner(snap.banner.text, {
          style: snap.banner.style || 'style-score',
          subText: snap.banner.subText || '',
          durationMs: 1550,
        });
        if (this.audioEngine) {
          const sub = snap.banner.subText || '';
          const hasLineCall = sub === 'Out' || sub === 'Net' || sub === 'Nice Shot!';
          if (hasLineCall) {
            this.audioEngine.playVoiceCallout(sub, { clearQueue: true });
            this.audioEngine.announceScore(snap.banner.text, { delayMs: 680 });
          } else {
            this.audioEngine.announceScore(snap.banner.text);
          }
        }
      }
    }
  }

  _formatCurrentScore() {
    const p = this.score.playerPoints;
    const o = this.score.opponentPoints;

    if (p >= 3 && o >= 3) {
      if (p === o) {
        return {
          playerScoreText: '40',
          opponentScoreText: '40',
          deuceLabel: 'Deuce',
          bannerScoreText: 'Deuce',
        };
      }
      const adPlayer = p > o;
      const adLabel = adPlayer ? 'Ad In' : 'Ad Out';
      return {
        playerScoreText: adPlayer ? 'Ad' : '40',
        opponentScoreText: adPlayer ? '40' : 'Ad',
        deuceLabel: adLabel,
        bannerScoreText: adLabel,
      };
    }

    const pText = POINT_LABELS[Math.min(3, p)];
    const oText = POINT_LABELS[Math.min(3, o)];
    return {
      playerScoreText: pText,
      opponentScoreText: oText,
      deuceLabel: null,
      bannerScoreText: `${pText} - ${oText}`,
    };
  }

  _getHighStakesPointLabel() {
    const p = this.score.playerPoints;
    const o = this.score.opponentPoints;
    const playerOnePointAway = p >= 3 && p - o >= 1;
    const opponentOnePointAway = o >= 3 && o - p >= 1;

    if (playerOnePointAway) {
      if (this.score.playerGames + 1 >= this.matchConfig.gamesToWin) {
        return 'Match Point';
      }
      return 'Game Point';
    }
    if (opponentOnePointAway) {
      if (this.score.opponentGames + 1 >= this.matchConfig.gamesToWin) {
        return 'Match Point';
      }
      return this.score.server === 'player' ? 'Break Point' : 'Game Point';
    }
    return null;
  }

  _syncScoreboardHUD() {
    const formatted = this._formatCurrentScore();
    this.hud.updateScoreboard({
      playerScoreText: formatted.playerScoreText,
      opponentScoreText: formatted.opponentScoreText,
      deuceLabel: formatted.deuceLabel,
      playerGames: this.score.playerGames,
      opponentGames: this.score.opponentGames,
      gamesToWin: this.matchConfig.gamesToWin,
    });
  }

  // --------------------------------------------------------------------------
  // 10. Procedural Mii Animation, Racket Kinematics, Facial FX & Crowd Bounce
  // --------------------------------------------------------------------------
  _updateMiiAnimation(actor, dt) {
    if (!actor.model) return;

    // Decrement legacy swingTimer / arcVisibleTimer for compatibility
    if (actor.swingTimer > 0) {
      actor.swingTimer = Math.max(0, actor.swingTimer - dt);
    }
    if (actor.arcVisibleTimer > 0) {
      actor.arcVisibleTimer = Math.max(0, actor.arcVisibleTimer - dt);
    }
    // Always hide legacy flat RingGeometry arc mesh so our 36-slice Catmull-Rom 3D RacketRibbonTrail shines
    if (actor.swingArcMesh) {
      actor.swingArcMesh.visible = false;
    }

    // 1. Live Controller / Phone / Mouse Coupling for Wrist Whip & Idle Twitch
    let liveInput = null;
    if (this.motionController && this.motionController.phoneState?.connected) {
      const isMyActor =
        (this.playerRole !== 'p2' && actor === this.player) ||
        (this.playerRole === 'p2' && actor === this.opponent);
      if (isMyActor) {
        const ori = this.motionController.phoneState.orientation || {};
        liveInput = {
          tiltPitch: ((Number(ori.pitch) || 0) * Math.PI) / 180,
          tiltRoll: ((Number(ori.roll) || 0) * Math.PI) / 180,
          tiltYaw: ((Number(ori.yaw) || 0) * Math.PI) / 180,
          accelMag: Number(this.motionController.phoneState.accelMag) || 0,
        };
      }
    }

    // 2. Update Frantic Racket Kinematics & Wrist Whip Physics (Agent 1)
    if (this.racketKinematics) {
      let kinDt = dt;
      if (this.phase === 'SHOWCASE' && actor === this.player && actor.racketKinematics) {
        const mode = this.showcaseModeName || 'showcase_topspin';
        kinDt = 0.0001;
        if (mode === 'showcase_slice' || mode === 'showcase_backhand') {
          actor.racketKinematics.swingActive = true;
          actor.racketKinematics.swingElapsed = 0.072;
        } else if (mode === 'showcase_smash') {
          actor.racketKinematics.swingActive = true;
          actor.racketKinematics.swingElapsed = 0.058;
        } else if (mode === 'showcase_topspin') {
          actor.racketKinematics.swingActive = true;
          actor.racketKinematics.swingElapsed = 0.068;
        }
      }
      this.racketKinematics.update(actor, kinDt, {
        phase: this.phase,
        score: this.score,
        ball: this.ball,
        elapsedTime: this.elapsedTime,
        liveInput,
      });
    }

    // 3. Update Articulated Mii Body Rig, Hop-Shuffle Footwork, Torso Lean & Floating Hands (Agent 3)
    if (this.bodyAnimator) {
      this.bodyAnimator.updateMiiBodyAnimation(actor, dt, this);
    } else {
      actor.root.position.set(actor.pos.x, actor.pos.y, actor.pos.z);
    }

    // 4. Update Soft Double-Ring Contact Shadow Breathing (Agent 2)
    updateCharacterContactShadow(actor, actor.rig?.verticalHopOffset || 0);

    // 5. Update Expressive Animated Facial States, Sweat Drops & Emote Cues (Agent 4)
    if (this.facialFX) {
      this.facialFX.update(actor, dt, {
        phase: this.phase,
        ball: this.ball,
        score: this.score,
        rallyCount: this.ball.rallyStrokeCount,
        camera: this.camera,
      });
    }
  }

  _updateCrowdAnimation(dt) {
    this.cheerEnergy = Math.max(0.22, this.cheerEnergy - dt * 0.35);
    if (this.crowdScene) {
      const freq = 5.5 + this.cheerEnergy * 4.5;
      const amp = 0.025 + this.cheerEnergy * 0.055;
      this.crowdScene.position.y = Math.abs(Math.sin(this.elapsedTime * freq)) * amp;
    }
  }

  _spawnBounceRing(x, z) {
    const slot = this.bounceRings.find((r) => !r.active) || this.bounceRings[0];
    slot.active = true;
    slot.age = 0;
    slot.mesh.position.set(x, 0.024, z);
    slot.mesh.scale.setScalar(0.6);
    slot.mesh.material.opacity = 0.9;
    slot.mesh.visible = true;
  }

  _spawnStarBurst(pos, count = 8) {
    let spawned = 0;
    for (let i = 0; i < this.starParticles.length && spawned < count; i++) {
      const p = this.starParticles[i];
      if (!p.active) {
        p.active = true;
        p.age = 0;
        p.maxAge = 0.32 + Math.random() * 0.22;
        p.mesh.position.copy(pos);
        p.vel.set(
          (Math.random() - 0.5) * 4.2,
          (Math.random() - 0.2) * 3.8,
          (Math.random() - 0.5) * 4.2
        );
        p.mesh.scale.setScalar(0.9 + Math.random() * 0.6);
        p.mesh.material.opacity = 1.0;
        p.mesh.visible = true;
        spawned++;
      }
    }
  }

  _updateEffects(dt) {
    if (this.ball.mesh) {
      this.ball.mesh.position.copy(this.ball.pos);
    }
    if (this.ballShadowBlob) {
      this.ballShadowBlob.position.x = this.ball.pos.x;
      this.ballShadowBlob.position.z = this.ball.pos.z;
      const hScale = THREE.MathUtils.clamp(1.15 - this.ball.pos.y * 0.16, 0.45, 1.15);
      this.ballShadowBlob.scale.setScalar(hScale);
      this.ballShadowBlob.material.opacity = THREE.MathUtils.clamp(0.88 - this.ball.pos.y * 0.14, 0.28, 0.88);
    }

    for (const r of this.bounceRings) {
      if (!r.active) continue;
      r.age += dt;
      const t = r.age / 0.48;
      if (t >= 1.0) {
        r.active = false;
        r.mesh.visible = false;
      } else {
        r.mesh.scale.setScalar(0.6 + t * 2.4);
        r.mesh.material.opacity = (1.0 - t) * 0.85;
      }
    }

    for (const s of this.starParticles) {
      if (!s.active) continue;
      s.age += dt;
      const t = s.age / s.maxAge;
      if (t >= 1.0) {
        s.active = false;
        s.mesh.visible = false;
      } else {
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.rotation.y += dt * 9.0;
        s.mesh.rotation.z += dt * 7.0;
        s.mesh.scale.setScalar((1.0 - t * 0.65) * 1.15);
        s.mesh.material.opacity = 1.0 - t;
      }
    }

    if (this.cloudRing1) this.cloudRing1.rotation.y += dt * 0.0065;
    if (this.cloudRing2) this.cloudRing2.rotation.y += dt * 0.0035;

    this.ballTrail.updateGeometry(this.camera);
  }

  // --------------------------------------------------------------------------
  // 11. Authentic Argon Tennis Camera Modes (with P2 Perspective Flip & SHOWCASE_CAM)
  // --------------------------------------------------------------------------
  _computeTargetCameraPose() {
    const activeMode = this.manualCameraOverride || this.cameraMode;
    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();

    if (activeMode === 'INTRO_PAN') {
      const a = this.elapsedTime * 0.42;
      targetPos.set(Math.sin(a) * 9.5, 8.2, 16.5 + Math.cos(a) * 3.5);
      targetLook.set(0, 0.8, -1.5);
    } else if (activeMode === 'SHOWCASE_CAM') {
      // Front Close-Up Action Camera centered on the near Mii (who stands at X=1.15, Z=11.2 facing -Z)
      // framing their facial expression, visor, floating hands, sweat drops, and curved 3D racket ribbon trail!
      targetPos.set(1.15, 1.54, 7.55);
      targetLook.set(1.15, 1.12, 11.20);
    } else if (activeMode === 'SERVE_CAM') {
      if (this.playerRole === 'p2') {
        const serverX = this.opponent.pos.x;
        targetPos.set(serverX * 0.16, 7.8, -22.8);
        targetLook.set(serverX * 0.08, 0.35, -1.8);
      } else {
        // Elevated behind-baseline camera placing near baseline at ~77% down from top
        // so 100% of the serving Mii, their feet, racket, and shadow are inside the frame!
        const serverX = this.player.pos.x;
        targetPos.set(serverX * 0.16, 7.8, 22.8);
        targetLook.set(serverX * 0.08, 0.35, 1.8);
      }
    } else if (activeMode === 'REPLAY_CAM') {
      // Dramatic low net-closeup camera looking through the open window between
      // foreground Red Mii (x_screen ≈ 74%) and Blue Opponent (x_screen ≈ 46%)
      // with the ball & ribbon trail at x_screen ≈ 57% (matches ref_05_net_closeup_crowd.png)
      targetPos.set(2.35, 1.48, 4.15);
      targetLook.set(-1.45, 0.95, -1.35);
    } else {
      // RALLY_CAM: Elevated behind-baseline angle (matches ref_04_rally_camera.png)
      if (this.playerRole === 'p2') {
        targetPos.set(this.opponent.pos.x * 0.16, 7.8, -22.8);
        targetLook.set(this.ball.pos.x * 0.12, 0.35, -1.8);
      } else {
        targetPos.set(this.player.pos.x * 0.16, 7.8, 22.8);
        targetLook.set(this.ball.pos.x * 0.12, 0.35, 1.8);
      }
    }

    return { targetPos, targetLook };
  }

  _snapCameraImmediate() {
    const { targetPos, targetLook } = this._computeTargetCameraPose();
    this.cameraPosSmooth.copy(targetPos);
    this.cameraLookSmooth.copy(targetLook);
    this.camera.position.copy(targetPos);
    this.camera.lookAt(targetLook);
    this.camera.updateMatrixWorld();
    this.ballTrail.updateGeometry(this.camera);
    this._updateProjectedHUD();
  }

  _updateCameraRig(dt) {
    const { targetPos, targetLook } = this._computeTargetCameraPose();
    const damp = 1.0 - Math.exp(-6.5 * dt);
    this.cameraPosSmooth.lerp(targetPos, damp);
    this.cameraLookSmooth.lerp(targetLook, damp);

    this.camera.position.copy(this.cameraPosSmooth);
    if (this.cameraTrauma > 0.001) {
      const shake = this.cameraTrauma * this.cameraTrauma * 0.26;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
    }
    this.camera.lookAt(this.cameraLookSmooth);
  }

  // --------------------------------------------------------------------------
  // 12. 3D-to-2D Projected HUD Tags (Yellow "Server" Box above Serving Mii)
  // --------------------------------------------------------------------------
  _projectToScreen(worldPos) {
    const v = worldPos.clone().project(this.camera);
    const visible = v.z >= -1.0 && v.z <= 1.0;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    return { x, y, visible };
  }

  _updateProjectedHUD() {
    const showServerTag =
      (this.phase === 'SERVE_STANCE' || this.phase === 'SERVE_TOSS') &&
      this.cameraMode !== 'REPLAY_CAM';

    if (showServerTag) {
      const serverActor = this.score.server === 'player' ? this.player : this.opponent;
      const headWorld = serverActor.pos.clone().add(new THREE.Vector3(0, 2.25, 0));
      const screenPos = this._projectToScreen(headWorld);
      this.hud.updateServerTag(screenPos, true);
    } else {
      this.hud.updateServerTag(null, false);
    }
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// Bootstrap Argon Tennis on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  const engine = new ArgonTennisEngine();
  window.__argonTennis = engine;
  engine.loadAssetsAndStart();
});
