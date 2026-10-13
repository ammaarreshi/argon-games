/**
 * @fileoverview Master Orchestrator (`src/main.js`) for Argon Airspace
 * 1950s Argon Airways Airspace Management Edition (Three.js Orthographic Engine).
 *
 * Wires together:
 *  - Agent 1: Pre-generated static assets (`./assets/textures/`, `./assets/audio/{music,voice,sfx}/`)
 *  - Agent 2: `FlightPathInputSystem` (`src/spline_input_paths.js`)
 *  - Agent 3: `FlightKinematicsSystem` & `AircraftEntity` (`src/flight_kinematics.js`)
 *  - Agent 4: `TrafficAndCollisionDirector` & `MAP_DEFINITIONS` (`src/traffic_collision_director.js`)
 *  - Agent 5: `FlightRenderEngine` (`src/render_world_ui.js`)
 *  - Agent 6: `FlightAudioEngine` (`src/spatial_audio_engine.js`)
 */

import { FlightPathInputSystem } from './spline_input_paths.js';
import {
  AIRCRAFT_CLASSES,
  AUSSIE_PRAISE_STRINGS,
  AircraftEntity,
  FlightKinematicsSystem,
} from './flight_kinematics.js';
import {
  MAP_DEFINITIONS,
  TrafficAndCollisionDirector,
} from './traffic_collision_director.js';
import { FlightRenderEngine } from './render_world_ui.js';
import { FlightAudioEngine } from './spatial_audio_engine.js';

export class FlightControlGame {
  constructor(options = {}) {
    this.options = options || {};

    // Parse URL parameters for initial map or deterministic capture mode
    const params = new URLSearchParams(
      typeof window !== 'undefined' && window.location ? window.location.search : ''
    );
    const initialMapParam = params.get('map');
    this.captureMode = params.get('capture') === '1';

    this.currentMapId =
      initialMapParam && MAP_DEFINITIONS[initialMapParam]
        ? initialMapParam
        : options.initialMapId || 'classic_outback';

    this.gameState = 'PLAYING'; // 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'BRIEFING'
    this.fastForward = false;
    this.landedCount = 0;
    this.highScores = this._loadHighScores();
    this.highScore = this.highScores[this.currentMapId] || 0;
    this.personalBestAnnounced = false;
    this._gameOverModalTimeout = null;

    // 1. Initialize Spatial Audio Engine (Agent 6)
    this.audioEngine = new FlightAudioEngine({
      mapId: this.currentMapId,
      hostessKey: MAP_DEFINITIONS[this.currentMapId]?.hostessKey || 'hostess_wendy',
      onVoiceSubtitle: (speaker, text, hostessKey) => {
        if (this.renderEngine) {
          this.renderEngine.showWendyToast(speaker, text, hostessKey, 4200);
        }
      },
    });

    // 2. Initialize Three.js Orthographic Render Engine & 1950s Bezel HUD (Agent 5)
    this.renderEngine = new FlightRenderEngine({
      container:
        options.container ||
        (typeof document !== 'undefined'
          ? document.getElementById('flight-control-app') || document.body
          : null),
      onSelectMap: (mapId) => this.selectMap(mapId),
      onToggleFastForward: () => this.toggleFastForward(),
      onTogglePause: () => this.togglePause(),
      onToggleMute: () => this.toggleMute(),
      onRestartGame: (mapId) => this.restartGame(mapId || this.currentMapId),
      onResumeGame: () => this.resumeGame(),
      onTriggerRushWave: () => this.triggerRushWave(6),
    });

    // 3. Initialize Flight Kinematics System (Agent 3)
    this.kinematics = new FlightKinematicsSystem({
      onTouchdownStart: (plane, runway, praiseText) => {
        this._handleTouchdownStart(plane, runway, praiseText);
      },
      onLandingComplete: (plane, runway) => {
        this._handleLandingComplete(plane, runway);
      },
    });

    // 4. Initialize Traffic & Spatial Collision Director (Agent 4)
    this.director = new TrafficAndCollisionDirector({
      mapId: this.currentMapId,
      createAircraft: (classId, x, y, heading, extra) =>
        new AircraftEntity({
          ...(extra || {}),
          classId,
          x,
          y,
          heading,
        }),
      onAircraftSpawned: (plane) => {
        this._handleAircraftSpawned(plane);
      },
      onProximityWarning: (activeConflicts, newConflicts) => {
        this._handleProximityWarning(activeConflicts, newConflicts);
      },
      onMidAirCollision: (crashEvent) => {
        this._handleMidAirCollision(crashEvent);
      },
    });

    // 5. Initialize Spline Path Input & Dashed Ribbon System (Agent 2)
    this.pathInput = new FlightPathInputSystem({
      THREE: typeof window !== 'undefined' ? window.THREE : undefined,
      scene: this.renderEngine.scene,
      camera: this.renderEngine.camera,
      renderer: this.renderEngine.renderer,
      domElement: this.renderEngine.canvas,
      getAircraft: () => this.director.activePlanes,
      getRunways: () => this.getCurrentMap().runways,
      onPlaneSelected: (plane) => {
        this.audioEngine.unlock();
        if (typeof this.audioEngine.playPlaneSelect === 'function') {
          this.audioEngine.playPlaneSelect(plane.x);
        } else {
          this.audioEngine.playPathDrawTick(plane.x);
        }
      },
      onPathPointAdded: (plane, wx, wy) => {
        void wy;
        this.audioEngine.playPathDrawTick(wx);
      },
      onRunwayLocked: (plane, runway) => {
        this.audioEngine.playRunwayLock(runway.thresholdX ?? plane.x, runway);
      },
      onInvalidApproach: (plane, runway) => {
        if (runway) runway.invalidApproachFlash = 0.6;
        if (plane) plane.invalidApproachFlash = 0.6;
      },
    });

    // Build initial map scene & spawn opening air traffic
    this.selectMap(this.currentMapId, { silentIntro: false });

    // Bind window resize & keyboard shortcuts
    this._bindWindowEvents();

    // Start RAF loop unless in deterministic capture mode
    this._lastRafTime = performance.now();
    this._rafId = null;
    if (!this.captureMode) {
      this._startLoop();
    } else {
      this.step(0.016, true);
    }
  }

  getCurrentMap() {
    return (
      MAP_DEFINITIONS[this.currentMapId] ||
      this.director.currentMap ||
      MAP_DEFINITIONS.classic_outback
    );
  }

  _loadHighScores() {
    const defaults = {
      classic_outback: 19,
      tropical_island: 14,
      alpine_winter: 12,
    };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('fc_panam_highscores_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return { ...defaults, ...parsed };
          }
        }
      }
    } catch (_e) {
      // Ignore storage errors inside sandboxed Origins
    }
    return defaults;
  }

  _saveHighScores() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          'fc_panam_highscores_v1',
          JSON.stringify(this.highScores)
        );
      }
    } catch (_e) {
      // Ignore storage errors inside sandboxed Origins
    }
  }

  selectMap(mapId, options = {}) {
    if (!MAP_DEFINITIONS[mapId]) {
      mapId = 'classic_outback';
    }
    if (this._gameOverModalTimeout) {
      clearTimeout(this._gameOverModalTimeout);
      this._gameOverModalTimeout = null;
    }

    this.currentMapId = mapId;
    const mapDef = MAP_DEFINITIONS[mapId];

    this.gameState = 'PLAYING';
    this.fastForward = false;
    this.landedCount = 0;
    this.highScore = this.highScores[mapId] || 12;
    this.personalBestAnnounced = false;

    this.renderEngine.hideClipboardModal();
    this.renderEngine.buildMapScene(mapDef);
    this.renderEngine.resize();

    this.pathInput.clearAllPaths();
    this.director.resetForMap(mapId);

    this.audioEngine.setMapTheme(mapId, mapDef.hostessKey);
    this.audioEngine.setHighDensityMode(false);

    this.renderEngine.updateHUD({
      landedCount: this.landedCount,
      highScore: this.highScore,
      mapId: this.currentMapId,
      fastForward: this.fastForward,
      isPaused: false,
      isMuted: this.audioEngine.isMuted,
    });

    if (!options.silentIntro) {
      const welcomeText =
        mapId === 'tropical_island'
          ? 'Aloha Captain! Guide seaplanes to the turquoise buoy channel and jets to the beach strip!'
          : mapId === 'alpine_winter'
          ? 'Welcome to Alpine Peak! Watch for crosswinds on the snow runways and glacial fjord!'
          : 'Welcome aboard, guest! Drag any aircraft to its matching colored runway or helipad!';
      this.renderEngine.showWendyToast(
        'WENDY • ARGON STEWARDESS',
        welcomeText,
        mapDef.hostessKey,
        4500
      );
      if (this.audioEngine.isUnlocked) {
        this.audioEngine.playVoice('wendy_welcome', { force: true });
      }
    }

    this.renderEngine.updateAircraft(this.director.activePlanes, 0.016, this.renderEngine.time);
    this.renderEngine.updatePerimeterWarnings(
      this.director.pendingSpawns,
      0.016,
      this.renderEngine.time
    );
    this.renderEngine.render(0.016);
  }

  /**
   * Optional helper to seed a smooth starter path on the first aircraft when requested.
   */
  _seedStarterGuidancePaths() {
    const planes = this.director.activePlanes;
    if (!Array.isArray(planes) || planes.length === 0) return;

    const firstPlane = planes[0];
    if (firstPlane) {
      this.routePlaneToCompatibleRunway(firstPlane, { lockRunway: true });
    }
  }

  /**
   * Programmatically routes `plane` along a smooth curved Catmull-Rom approach path
   * to a compatible runway or helipad on the current map, starting with a tangent
   * lead-out along `plane.heading` so it never creates an unreachable hairpin turn.
   */
  routePlaneToCompatibleRunway(plane, options = {}) {
    if (!plane || plane.state !== 'FLYING') return false;
    const runways = this.getCurrentMap().runways || [];
    const compatible = runways.filter((r) =>
      this.kinematics.isRunwayCompatible(plane, r, runways)
    );
    if (compatible.length === 0) return false;

    compatible.sort(
      (a, b) =>
        Math.hypot(plane.x - a.thresholdX, plane.y - a.thresholdY) -
        Math.hypot(plane.x - b.thresholdX, plane.y - b.thresholdY)
    );
    const rw = compatible[0];
    const lockRunway = options.lockRunway !== undefined ? options.lockRunway : true;

    const leadOutX = plane.x + Math.cos(plane.heading || 0) * 34;
    const leadOutY = plane.y + Math.sin(plane.heading || 0) * 34;
    const controlPts = [
      { x: plane.x, y: plane.y },
      { x: leadOutX, y: leadOutY },
    ];

    if (rw.isHelipad) {
      const midX = (leadOutX + rw.thresholdX) * 0.5 + (leadOutY - rw.thresholdY) * 0.18;
      const midY = (leadOutY + rw.thresholdY) * 0.5 - (leadOutX - rw.thresholdX) * 0.18;
      controlPts.push({ x: midX, y: midY });
      controlPts.push({ x: rw.thresholdX, y: rw.thresholdY });
    } else {
      const rHeading = rw.heading;
      const preX = rw.thresholdX - Math.cos(rHeading) * 76;
      const preY = rw.thresholdY - Math.sin(rHeading) * 76;
      const midX = (leadOutX + preX) * 0.5;
      const midY = (leadOutY + preY) * 0.5;
      controlPts.push({ x: midX, y: midY });
      controlPts.push({ x: preX, y: preY });
      controlPts.push({ x: rw.thresholdX, y: rw.thresholdY });
    }

    const smooth = this.pathInput.evaluateCentripetalCatmullRom(controlPts, 5.0, 0.5);
    plane.pathWaypoints = smooth;
    plane.waypoints = smooth;
    plane.isLockedToRunway = Boolean(lockRunway);
    plane.lockedRunwayId = lockRunway ? rw.id : null;
    plane.lockedRunway = lockRunway ? rw : null;
    this.pathInput.updatePlanePathMesh(plane);
    return true;
  }

  restartGame(mapId = this.currentMapId) {
    this.selectMap(mapId, { silentIntro: false });
  }

  toggleFastForward() {
    if (this.gameState !== 'PLAYING') return;
    this.fastForward = !this.fastForward;
    this.director.setFastForward(this.fastForward);
    this.renderEngine.setFastForwardState(this.fastForward);
    this.audioEngine.setHighDensityMode(
      this.director.isHighDensityAirspace(this.director.activePlanes)
    );
  }

  togglePause() {
    if (this.gameState === 'GAME_OVER') return;
    if (this.gameState === 'PAUSED') {
      this.resumeGame();
    } else {
      this.gameState = 'PAUSED';
      this.renderEngine.showPauseModal({
        landedCount: this.landedCount,
        highScore: this.highScore,
        mapDef: this.getCurrentMap(),
      });
    }
  }

  resumeGame() {
    if (this.gameState === 'PAUSED' || this.gameState === 'BRIEFING') {
      this.gameState = 'PLAYING';
      this.renderEngine.hideClipboardModal();
      this._lastRafTime = performance.now();
    }
  }

  toggleMute() {
    const nextMuted = !this.audioEngine.isMuted;
    if (typeof this.audioEngine.setMuted === 'function') {
      this.audioEngine.setMuted(nextMuted);
    } else {
      this.audioEngine.isMuted = nextMuted;
    }
    this.renderEngine.setMuteState(nextMuted);
  }

  triggerRushWave(count = 6) {
    if (this.gameState !== 'PLAYING') return null;
    const res = this.director.spawnRushWave(count);
    this.audioEngine.setHighDensityMode(true);
    this.audioEngine.playVoice('wendy_seatbelts');
    this.renderEngine.updateAircraft(this.director.activePlanes, 0.016, this.renderEngine.time);
    this.renderEngine.updatePerimeterWarnings(
      this.director.pendingSpawns,
      0.016,
      this.renderEngine.time
    );
    return res;
  }

  _handleAircraftSpawned(plane) {
    void plane;
  }

  _getCaptainProfileForPlane(plane) {
    const classId = (plane && plane.classId) || 'prop_yellow';
    if (classId === 'jet_red') {
      return {
        portraitKey: 'captain_jet',
        speaker: 'CAPT. HANK • CLIPPER HEAVY',
      };
    }
    if (classId === 'seaplane_green') {
      return {
        portraitKey: 'captain_seaplane',
        speaker: 'CAPT. KAHALE • SEAPLANE',
      };
    }
    if (classId === 'heli_blue') {
      return {
        portraitKey: 'captain_chopper',
        speaker: 'CAPT. MAC • RESCUE CHOPPER',
      };
    }
    if (classId === 'prop_blue') {
      return {
        portraitKey: 'captain_bush',
        speaker: 'CAPT. BRUCE • SKYLARK PROP',
      };
    }
    return {
      portraitKey: 'captain_bush',
      speaker: 'CAPT. BRUCE • SUNBIRD PROP',
    };
  }

  _handleTouchdownStart(plane, runway, praiseText) {
    // Clean up path ribbon immediately when plane locks onto runway touchdown rollout
    this.pathInput.removePlanePath(plane);

    // Increment score on touchdown!
    this.landedCount = this.director.recordLanding(plane, runway);
    const beatRecord = this.landedCount > this.highScore;
    if (beatRecord) {
      this.highScore = this.landedCount;
      this.highScores[this.currentMapId] = this.highScore;
      this._saveHighScores();
    }

    this.renderEngine.updateHUD({
      landedCount: this.landedCount,
      highScore: this.highScore,
    });

    // Spawn floating Aussie / Argon praise text ("YOU BEWDY!", "COMMENDABLE", etc.)
    const label =
      praiseText ||
      AUSSIE_PRAISE_STRINGS[this.landedCount % AUSSIE_PRAISE_STRINGS.length];
    this.renderEngine.spawnPraiseFloater(plane.x, plane.y, label, plane.colorHex);

    // Play spatial brass touchdown bell + landed aircraft's distinct Captain portrait & callout
    const captain = this._getCaptainProfileForPlane(plane);
    const prevVoiceTime = this.audioEngine.lastVoiceTimeMs;
    this.audioEngine.playLandingBell(
      plane.x,
      this.landedCount,
      label,
      captain.portraitKey,
      captain.speaker
    );

    // Even if audio voice cooldown suppressed a second voice line within 5.5s, update the visual Captain toast!
    const hasConflict =
      this.director.activeConflicts && this.director.activeConflicts.length > 0;
    if (this.audioEngine.lastVoiceTimeMs === prevVoiceTime && !hasConflict) {
      this.renderEngine.showWendyToast(
        captain.speaker,
        label,
        captain.portraitKey,
        3400
      );
    }

    if (beatRecord && !this.personalBestAnnounced && this.landedCount >= 5) {
      this.personalBestAnnounced = true;
      this.audioEngine.playVoice('wendy_personal_best', { force: true });
      if (typeof this.audioEngine.playVictoryStinger === 'function') {
        this.audioEngine.playVictoryStinger();
      }
    } else if (this.landedCount === 5) {
      this.audioEngine.playVoice('wendy_beverage');
    } else if (this.landedCount === 10) {
      this.audioEngine.playVoice('wendy_seatbelts');
    }
  }

  _handleLandingComplete(plane, runway) {
    void runway;
    this.pathInput.removePlanePath(plane);
    const idx = this.director.activePlanes.indexOf(plane);
    if (idx !== -1) {
      this.director.activePlanes.splice(idx, 1);
    }
  }

  _handleProximityWarning(activeConflicts, newConflicts) {
    if (newConflicts && newConflicts.length > 0) {
      if (typeof this.audioEngine.triggerProximityWarning === 'function') {
        this.audioEngine.triggerProximityWarning(activeConflicts);
      }
    }
  }

  _handleMidAirCollision(crashEvent) {
    if (this.gameState === 'GAME_OVER') return;
    this.gameState = 'GAME_OVER';
    this.fastForward = false;
    this.renderEngine.setFastForwardState(false);

    // 1. Trigger comic-strip explosion cloud, flying metal debris & screen shake
    this.renderEngine.triggerCrashVFX(crashEvent);

    // 2. Play spatial crash explosion & schedule rubber stamp thud
    this.audioEngine.playCrashExplosion(crashEvent.x);

    // 3. Show the 1950s Argon Airways Vintage Clipboard Scorecard after a brief dramatic beat (650ms)
    const isNewRecord = this.landedCount > 0 && this.landedCount >= this.highScore;
    if (this._gameOverModalTimeout) {
      clearTimeout(this._gameOverModalTimeout);
    }
    this._gameOverModalTimeout = setTimeout(() => {
      if (this.gameState === 'GAME_OVER') {
        this.renderEngine.showGameOverModal({
          landedCount: this.landedCount,
          highScore: this.highScore,
          isNewRecord,
          mapDef: this.getCurrentMap(),
          crashEvent,
        });
      }
    }, 650);
  }

  /**
   * Advances simulation by `dt` seconds and optionally renders a frame.
   * Exposed on `window.__FLIGHT_CONTROL__.step(dt, renderFrame)` for deterministic verification.
   */
  step(dt = 0.016, renderFrame = true) {
    const clampedDt = Math.min(Math.max(Number(dt) || 0.016, 0.001), 0.1);
    const simDt =
      this.gameState === 'PLAYING'
        ? clampedDt * (this.fastForward ? 2.0 : 1.0)
        : 0;

    const mapDef = this.getCurrentMap();
    const runways = mapDef.runways || [];

    if (this.gameState === 'PLAYING' && simDt > 0) {
      // 1. Step aircraft flight kinematics, banking, boundary turnback & landing rollout
      this.kinematics.update(this.director.activePlanes, simDt, runways, {
        onTouchdownStart: (plane, rw, praise) =>
          this._handleTouchdownStart(plane, rw, praise),
        onLandingComplete: (plane, rw) => this._handleLandingComplete(plane, rw),
      });

      // 2. Trim spline path ribbons behind advancing aircraft
      this.pathInput.update(simDt, this.director.activePlanes, runways);

      // 3. Step traffic director (perimeter `!` countdowns, new spawns & 2-stage collision engine)
      const dirState = this.director.update(simDt, this.director.activePlanes, {
        fastForwardActive: this.fastForward,
        landedCount: this.landedCount,
        autoPruneLanded: true,
      });

      // 4. Update spatial proximity klaxon & Lyria 3 dynamic lounge->swing crossfader
      this.audioEngine.updateProximityAlarm(dirState.activeConflicts || [], clampedDt);
      this.audioEngine.setHighDensityMode(Boolean(dirState.isHighDensity));
      if (typeof this.audioEngine.update === 'function') {
        this.audioEngine.update(clampedDt);
      }
    } else {
      // Stop proximity alarm when paused or game over
      this.audioEngine.updateProximityAlarm([], clampedDt);
    }

    // 5. Sync 2.5D aircraft meshes, drop shadows, rotors, and perimeter `!` badges
    this.renderEngine.updateAircraft(
      this.director.activePlanes,
      clampedDt,
      this.renderEngine.time + clampedDt
    );
    this.renderEngine.updatePerimeterWarnings(
      this.director.pendingSpawns,
      clampedDt,
      this.renderEngine.time + clampedDt
    );

    if (renderFrame) {
      this.renderEngine.render(clampedDt);
    }
  }

  /**
   * Deterministic scene preset staging for visual verification & Critic comparison
   * against the 4 original Argon Airspace reference screenshots.
   */
  applyScenePreset(preset = 'outback_spline_routing') {
    if (this._gameOverModalTimeout) {
      clearTimeout(this._gameOverModalTimeout);
      this._gameOverModalTimeout = null;
    }

    if (preset === 'outback_spline_routing') {
      this.selectMap('classic_outback', { silentIntro: true });
      this.landedCount = 19;
      this.highScore = 89;
      this.renderEngine.updateHUD({ landedCount: 19, highScore: 89 });

      this.director.activePlanes = [];
      this.director.pendingSpawns = [];
      this.pathInput.clearAllPaths();

      // 1. Red Jet approaching NE threshold along a smooth locked white spline curve
      const jet = new AircraftEntity({
        id: 'preset_jet_1',
        classId: 'jet_red',
        x: 40,
        y: 195,
        heading: -0.35,
      });
      jet.bankAngle = -0.38;
      this.director.activePlanes.push(jet);
      const jetRwy = this.getCurrentMap().runways.find((r) => r.id === 'runway_jet_main');
      const jetCurve = this.pathInput.evaluateCentripetalCatmullRom(
        [
          { x: jet.x, y: jet.y },
          { x: 165, y: 205 },
          { x: 215, y: 155 },
          { x: jetRwy.thresholdX, y: jetRwy.thresholdY },
        ],
        5.0,
        0.5
      );
      jet.pathWaypoints = jetCurve;
      jet.isLockedToRunway = true;
      jet.lockedRunwayId = jetRwy.id;
      jet.lockedRunway = jetRwy;
      this.pathInput.updatePlanePathMesh(jet);

      // 2. Yellow Prop carving a holding-pattern arc in the SW quadrant toward South Prop runway
      const propY = new AircraftEntity({
        id: 'preset_prop_y',
        classId: 'prop_yellow',
        x: -115,
        y: -55,
        heading: -0.75,
      });
      propY.bankAngle = 0.34;
      propY.isSelected = true;
      this.director.activePlanes.push(propY);
      const propCurve = this.pathInput.evaluateCentripetalCatmullRom(
        [
          { x: propY.x, y: propY.y },
          { x: -45, y: -165 },
          { x: 95, y: -205 },
          { x: 230, y: -158 },
          { x: 192, y: -132 },
        ],
        5.0,
        0.5
      );
      propY.pathWaypoints = propCurve;
      propY.isLockedToRunway = false;
      this.pathInput.updatePlanePathMesh(propY);

      // 3. Blue Prop on Upper-West runway approach
      const propB = new AircraftEntity({
        id: 'preset_prop_b',
        classId: 'prop_blue',
        x: -245,
        y: 145,
        heading: -0.15,
      });
      propB.bankAngle = -0.25;
      this.director.activePlanes.push(propB);
      this.routePlaneToCompatibleRunway(propB, { lockRunway: false });

      // 4. Rescue Helicopter approaching East Helipad
      const heli = new AircraftEntity({
        id: 'preset_heli_1',
        classId: 'heli_blue',
        x: 315,
        y: 65,
        heading: -2.25,
      });
      this.director.activePlanes.push(heli);
      this.routePlaneToCompatibleRunway(heli, { lockRunway: true });

      // Perimeter '!' warning at bottom edge (matching Screenshot 1)
      this.director.pendingSpawns.push({
        id: 'warn_south_1',
        classId: 'jet_red',
        edge: 'BOTTOM',
        edgeX: -125,
        edgeY: -280,
        spawnX: -125,
        spawnY: -302,
        entryHeading: Math.PI * 0.45,
        timer: 1.2,
        maxTimer: 3.0,
        colorHex: 0xff3b30,
      });

      this.renderEngine.showWendyToast(
        'WENDY • ARGON CABIN PA',
        'Welcome aboard, guest! Drag any aircraft to its matching colored runway or helipad.',
        'hostess_wendy',
        10000
      );
    } else if (preset === 'tropical_island_seaplanes') {
      this.selectMap('tropical_island', { silentIntro: true });
      this.landedCount = 24;
      this.highScore = 89;
      this.renderEngine.updateHUD({ landedCount: 24, highScore: 89 });

      this.director.activePlanes = [];
      this.director.pendingSpawns = [];
      this.pathInput.clearAllPaths();

      // 1. Catalina Seaplane curving into the Turquoise Buoy Water Channel
      const sea = new AircraftEntity({
        id: 'preset_sea_1',
        classId: 'seaplane_green',
        x: 85,
        y: 165,
        heading: -0.65,
      });
      sea.bankAngle = 0.35;
      this.director.activePlanes.push(sea);
      this.routePlaneToCompatibleRunway(sea, { lockRunway: true });

      // 2. Red Jet curving along the mainland toward the West Mainland Jet Runway
      const jet = new AircraftEntity({
        id: 'preset_jet_beach',
        classId: 'jet_red',
        x: -135,
        y: -175,
        heading: 1.45,
      });
      jet.bankAngle = -0.42;
      jet.isSelected = true;
      this.director.activePlanes.push(jet);
      const beachCurve = this.pathInput.evaluateCentripetalCatmullRom(
        [
          { x: jet.x, y: jet.y },
          { x: -125, y: 15 },
          { x: -165, y: 165 },
          { x: -235, y: 115 },
        ],
        5.0,
        0.5
      );
      jet.pathWaypoints = beachCurve;
      jet.isLockedToRunway = false;
      this.pathInput.updatePlanePathMesh(jet);

      // 3. Blue Prop approaching East Beachfront Runway
      const propB = new AircraftEntity({
        id: 'preset_prop_island',
        classId: 'prop_blue',
        x: 245,
        y: -135,
        heading: 2.35,
      });
      this.director.activePlanes.push(propB);
      this.routePlaneToCompatibleRunway(propB, { lockRunway: false });

      // 4. Helicopter approaching Beachfront Helipad
      const heli = new AircraftEntity({
        id: 'preset_heli_island',
        classId: 'heli_blue',
        x: 105,
        y: -195,
        heading: 1.85,
      });
      this.director.activePlanes.push(heli);
      this.routePlaneToCompatibleRunway(heli, { lockRunway: true });

      this.director.pendingSpawns.push({
        id: 'warn_beach_1',
        classId: 'seaplane_green',
        edge: 'RIGHT',
        edgeX: 440,
        edgeY: 45,
        spawnX: 462,
        spawnY: 45,
        entryHeading: Math.PI,
        timer: 1.4,
        maxTimer: 3.0,
        colorHex: 0x2ee6a8,
      });

      this.renderEngine.showWendyToast(
        'LEILANI • ISLAND HOSTESS',
        'Cleared for the lagoon buoy channel! Mind the cross-traffic over Paradise Beach!',
        'hostess_hawaii',
        10000
      );
    } else if (preset === 'alpine_touchdown_praise') {
      this.selectMap('alpine_winter', { silentIntro: true });
      this.landedCount = 31;
      this.highScore = 89;
      this.renderEngine.updateHUD({ landedCount: 31, highScore: 89 });

      this.director.activePlanes = [];
      this.director.pendingSpawns = [];
      this.pathInput.clearAllPaths();

      // 1. Red Jet mid-rollout on the Alpine Jet Runway (descending glide-slope!)
      const jetLanding = new AircraftEntity({
        id: 'preset_jet_landing',
        classId: 'jet_red',
        x: -88,
        y: 46,
        heading: Math.atan2(-180, 340),
      });
      jetLanding.state = 'LANDING';
      jetLanding.altitude = 0.25;
      jetLanding.visualScale = 0.78;
      jetLanding.opacity = 0.98;
      this.director.activePlanes.push(jetLanding);

      // 2. Yellow Prop holding in a smooth approach curve
      const propY = new AircraftEntity({
        id: 'preset_alpine_prop',
        classId: 'prop_yellow',
        x: 225,
        y: 165,
        heading: -2.35,
      });
      propY.bankAngle = -0.35;
      this.director.activePlanes.push(propY);
      this.routePlaneToCompatibleRunway(propY, { lockRunway: true });

      // 3. Green Seaplane/Skiplane approaching the Green Ski Strip
      const sea = new AircraftEntity({
        id: 'preset_alpine_sea',
        classId: 'seaplane_green',
        x: -365,
        y: -35,
        heading: -1.15,
      });
      this.director.activePlanes.push(sea);
      this.routePlaneToCompatibleRunway(sea, { lockRunway: false });

      // Spawn bold tilted praise floater ("YOU BEWDY!") above the landing jet with clean separation
      this.renderEngine.spawnPraiseFloater(-115, 92, 'YOU BEWDY!', 0xffd60a);
      for (const fl of this.renderEngine.activeFloaters) {
        fl.age = 0.28;
        fl.mesh.scale.set(1.08, 1.08, 1);
      }
      this.renderEngine.showWendyToast(
        'CAPT. HANK • CLIPPER HEAVY',
        'You bewdy! Smooth glacier touchdown on Runway One-Two!',
        'captain_jet',
        10000
      );
    } else if (preset === 'proximity_hazard_rings') {
      this.selectMap('classic_outback', { silentIntro: true });
      this.landedCount = 19;
      this.highScore = 1316;
      this.renderEngine.updateHUD({ landedCount: 19, highScore: 1316 });

      this.director.activePlanes = [];
      this.director.pendingSpawns = [];
      this.pathInput.clearAllPaths();

      // Two aircraft breaching Stage 1 separation minimums (dist = 56 <= 64) near NE apron
      // Side-by-side hazard rings with clean non-overlapping trajectories (Argon Screenshot 4!)
      const p1 = new AircraftEntity({
        id: 'conflict_1',
        classId: 'prop_blue',
        x: 98,
        y: 168,
        heading: -1.65,
      });
      const p2 = new AircraftEntity({
        id: 'conflict_2',
        classId: 'prop_yellow',
        x: 152,
        y: 152,
        heading: -2.20,
      });
      this.director.activePlanes.push(p1, p2);
      p1.pathWaypoints = this.pathInput.evaluateCentripetalCatmullRom(
        [
          { x: p1.x, y: p1.y },
          { x: 62, y: 152 },
          { x: 10, y: 125 },
        ],
        5.0,
        0.5
      );
      this.pathInput.updatePlanePathMesh(p1);
      p2.pathWaypoints = this.pathInput.evaluateCentripetalCatmullRom(
        [
          { x: p2.x, y: p2.y },
          { x: 225, y: 85 },
          { x: 245, y: -85 },
          { x: 192, y: -132 },
        ],
        5.0,
        0.5
      );
      this.pathInput.updatePlanePathMesh(p2);

      // Additional background traffic matching Screenshot 4
      const jetLeft = new AircraftEntity({
        id: 'bg_jet',
        classId: 'jet_red',
        x: -315,
        y: 135,
        heading: -0.18,
      });
      const propBottom = new AircraftEntity({
        id: 'bg_prop',
        classId: 'prop_yellow',
        x: -115,
        y: -125,
        heading: 0.90,
      });
      this.director.activePlanes.push(jetLeft, propBottom);
      jetLeft.pathWaypoints = this.pathInput.evaluateCentripetalCatmullRom(
        [
          { x: jetLeft.x, y: jetLeft.y },
          { x: -95, y: 195 },
          { x: 95, y: 195 },
          { x: 150, y: 95 },
        ],
        5.0,
        0.5
      );
      jetLeft.isLockedToRunway = true;
      jetLeft.lockedRunwayId = 'runway_jet_main';
      this.pathInput.updatePlanePathMesh(jetLeft);

      propBottom.pathWaypoints = this.pathInput.evaluateCentripetalCatmullRom(
        [
          { x: propBottom.x, y: propBottom.y },
          { x: -65, y: -35 },
          { x: 10, y: 125 },
        ],
        5.0,
        0.5
      );
      this.pathInput.updatePlanePathMesh(propBottom);

      this.director.evaluateCollisions(this.director.activePlanes);
      this.renderEngine.showWendyToast(
        'WENDY • PROXIMITY ALERT',
        'Crikey, look out! Keep those aircraft separated!',
        'hostess_nurse',
        10000
      );
    } else if (preset === 'midair_collision_explosion') {
      this.selectMap('classic_outback', { silentIntro: true });
      this.landedCount = 27;
      this.highScore = 89;
      this.renderEngine.updateHUD({ landedCount: 27, highScore: 89 });

      const p1 = this.director.activePlanes[0];
      const p2 = this.director.activePlanes[1];
      if (p1 && p2) {
        p1.x = 28;
        p1.y = 44;
        p2.x = 46;
        p2.y = 34;
        p1.inProximityWarning = true;
        p2.inProximityWarning = true;
      }
      this.pathInput.clearAllPaths();
      this.gameState = 'GAME_OVER';
      this.renderEngine.triggerCrashVFX({ x: 37, y: 39, planeA: p1, planeB: p2 });
      this.renderEngine._updateExplosions(0.16);
      this.renderEngine.showWendyToast(
        'CAPT. BRUCE • EMERGENCY',
        'Mayday! Mid-air collision over the central apron — logging incident report!',
        'captain_bush',
        10000
      );
    } else if (preset === 'panam_clipboard_scorecard') {
      this.selectMap('classic_outback', { silentIntro: true });
      this.pathInput.clearAllPaths();
      this.landedCount = 42;
      this.highScore = 42;
      this.renderEngine.updateHUD({ landedCount: 42, highScore: 42 });
      this.gameState = 'GAME_OVER';
      this.renderEngine.showGameOverModal({
        landedCount: 42,
        highScore: 42,
        isNewRecord: true,
        mapDef: this.getCurrentMap(),
        portraitKey: 'captain_jet',
      });
    }

    this.renderEngine.updateAircraft(
      this.director.activePlanes,
      0.016,
      this.renderEngine.time + 0.25
    );
    this.renderEngine.updatePerimeterWarnings(
      this.director.pendingSpawns,
      0.016,
      this.renderEngine.time + 0.25
    );
    this.renderEngine.render(0.016);
    return `OK:${preset}:planes=${this.director.activePlanes.length}`;
  }

  _startLoop() {
    const tick = (now) => {
      this._rafId = requestAnimationFrame(tick);
      const rawDt = (now - this._lastRafTime) / 1000;
      this._lastRafTime = now;
      this.step(rawDt, true);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _bindWindowEvents() {
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', () => {
      if (this.renderEngine) {
        this.renderEngine.resize();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFastForward();
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        this.togglePause();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        this.toggleMute();
      } else if (e.key === 'r' || e.key === 'R') {
        if (this.gameState === 'GAME_OVER') {
          e.preventDefault();
          this.restartGame(this.currentMapId);
        }
      } else if (e.key === '1') {
        this.selectMap('classic_outback');
      } else if (e.key === '2') {
        this.selectMap('tropical_island');
      } else if (e.key === '3') {
        this.selectMap('alpine_winter');
      }
    });
  }
}

// Boot the game automatically once the DOM is ready
function bootFlightControl() {
  if (typeof window === 'undefined') return;
  if (window.__FLIGHT_CONTROL__) return;
  const game = new FlightControlGame();
  window.__FLIGHT_CONTROL__ = game;
  window.__ARGON_AIRSPACE__ = game;
  window.FlightControlGame = FlightControlGame;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootFlightControl);
  } else {
    bootFlightControl();
  }
}
