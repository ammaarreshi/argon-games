/**
 * @fileoverview Master Orchestrator (`src/main.js`) for The Corridor — Argon Studio / Corridor Engine Psychological Horror
 * Integrates:
 * - Agent 1 (`src/fp_engine_flashlight.js`): `FlashlightSystem`, `FirstPersonEngine`, `CAMERA_PRESETS`
 * - Agent 2 (`src/pt_corridor_env.js`): `PTMaterialLibrary`, `PTCorridorEnvironment`
 * - Agent 3 (`src/horror_entity_ai.js`): `LisaEntityController`
 * - Agent 4 (`src/soundscape_audio.js`): `PTSoundscapeEngine`
 * - Agent 5 (`src/loop_logic_shaders.js`): `PTPostProcessor`, `CorridorLoopManager`, `PTUIManager`
 */

import * as THREE from '../assets/vendor/three.module.js';
import {
  FlashlightSystem,
  FirstPersonEngine,
  CAMERA_PRESETS,
} from './fp_engine_flashlight.js';
import { PTCorridorEnvironment } from './pt_corridor_env.js';
import { LisaEntityController } from './horror_entity_ai.js';
import { PTSoundscapeEngine } from './soundscape_audio.js';
import {
  PTPostProcessor,
  CorridorLoopManager,
  PTUIManager,
} from './loop_logic_shaders.js';

/**
 * Generates a subtle, dark indoor PMREM environment reflection texture so
 * wet blood puddles, porcelain, cracked mirrors, brass doorknobs, pill bottles,
 * and Lisa's cataract eye have realistic Corridor Engine specular highlights without
 * adding artificial ambient washout to unlit shadow zones.
 */
function createFoxEngineDarkPMREMEnv(renderer) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x040303);

  // Subtle warm tungsten ceiling reflection panel
  const warmTop = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 3.2),
    new THREE.MeshBasicMaterial({ color: 0x3a2818, side: THREE.DoubleSide })
  );
  warmTop.position.set(0, 4.0, -3.0);
  warmTop.rotation.x = Math.PI / 2;
  envScene.add(warmTop);

  // Subtle cold fluorescent grazing highlight
  const coldSide = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.8),
    new THREE.MeshBasicMaterial({ color: 0x162420, side: THREE.DoubleSide })
  );
  coldSide.position.set(-4.0, 2.2, -4.0);
  coldSide.lookAt(0, 1.5, 0);
  envScene.add(coldSide);

  // Subtle red clock / rim specular accent
  const redRim = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2),
    new THREE.MeshBasicMaterial({ color: 0x2a0808, side: THREE.DoubleSide })
  );
  redRim.position.set(2.5, 1.2, -5.0);
  redRim.lookAt(0, 1.2, 0);
  envScene.add(redRim);

  const envRT = pmremGenerator.fromScene(envScene, 0.04);
  pmremGenerator.dispose();
  return envRT.texture;
}

class PTHorrorEngineApp {
  constructor() {
    this.params = new URLSearchParams(window.location.search);
    this.isCaptureMode =
      this.params.get('capture') === '1' || this.params.get('capture') === 'true';
    this.isCleanMode =
      this.params.get('clean') === '1' ||
      this.params.get('clean') === 'true' ||
      this.params.get('hud') === '0';

    this.initialPreset =
      this.params.get('preset') || (this.isCaptureMode ? 'foyer_corridor' : 'free_roam');
    this.initialLoop = Number(this.params.get('loop')) || (this.isCaptureMode ? 1 : 2);

    this.canvas = document.getElementById('pt-canvas');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'pt-canvas';
      const vp = document.getElementById('viewport') || document.body;
      vp.appendChild(this.canvas);
    }

    // 1. Initialize WebGLRenderer (Corridor Engine PBR & Shadow configuration)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(this.isCaptureMode ? 1.0 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.captureMode = this.isCaptureMode;

    // 2. Initialize Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020202);
    this.scene.fog = new THREE.FogExp2(0x050403, 0.048);
    this.scene.environment = createFoxEngineDarkPMREMEnv(this.renderer);
    this.scene.captureMode = this.isCaptureMode;

    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.06,
      28.0
    );
    this.scene.add(this.camera);

    // 3. Instantiate the 5 Domain Subsystems
    this.soundscape = new PTSoundscapeEngine(this.camera);
    this.environment = new PTCorridorEnvironment(this.scene, this.renderer);
    this.environment.captureMode = this.isCaptureMode;

    this.flashlight = new FlashlightSystem(this.scene, this.camera, this.renderer);
    this.flashlight.captureMode = this.isCaptureMode;

    this.lisaController = new LisaEntityController(this.scene, {
      camera: this.camera,
      flashlight: this.flashlight,
      soundscape: this.soundscape,
      captureMode: this.isCaptureMode,
    });

    this.postProcessor = new PTPostProcessor(this.renderer, this.scene, this.camera);

    this.loopManager = new CorridorLoopManager({
      environment: this.environment,
      flashlight: this.flashlight,
      lisaController: this.lisaController,
      soundscape: this.soundscape,
      postProcessor: this.postProcessor,
      initialLoop: this.initialLoop,
    });

    this.uiManager = new PTUIManager({
      loopManager: this.loopManager,
      cleanMode: this.isCleanMode,
      captureMode: this.isCaptureMode,
      callbacks: {
        onSelectPreset: (presetName) => {
          this.soundscape.playUIClick?.();
          this.applyPreset(presetName, null, false);
        },
        onSelectLoop: (loopNum) => {
          this.soundscape.playUIClick?.();
          this.setLoop(loopNum);
        },
        onToggleFlashlight: () => {
          this.toggleFlashlight();
        },
        onTriggerFlickerScare: () => {
          this.triggerSuspenseFlickerScare();
        },
        onTriggerJumpScare: () => {
          this.triggerLisaJumpScare();
        },
        onTriggerRadio: () => {
          this.triggerRadioBroadcast();
        },
        onToggleAudio: () => {
          const muted = this.soundscape.toggleMute();
          this.uiManager.setAudioMutedState(muted);
        },
        onCollectClue: () => {
          this.loopManager.collectNextPhotoPiece();
          this.soundscape.playClueCollect?.();
        },
        onSolveRiddle: () => {
          this.loopManager.solveRiddle204863();
          this.soundscape.playPhoneRing?.();
        },
      },
    });

    this.fpEngine = new FirstPersonEngine(this.camera, this.canvas, this.scene, {
      flashlight: this.flashlight,
      flashlightSystem: this.flashlight,
      captureMode: this.isCaptureMode,
      initialPreset: this.initialPreset,
      interactables: this.environment.interactables || [],
      isBathroomOpen: () => {
        const ang = this.environment?.props?.bathroomDoorAngle ?? 1.18;
        return Math.abs(ang) >= 0.35;
      },
      onFootstep: (surface, stepCount, isRunning) => {
        this.soundscape.playFootstep(surface, isRunning);
      },
      onLoopThresholdReached: () => {
        this.loopManager.advanceLoop();
      },
      onInteract: (interactable) => {
        this.handleInteractable(interactable);
      },
      onHoverInteractable: (interactable) => {
        this.uiManager.setReticleTarget(interactable);
      },
      onToggleFlashlight: (isOn) => {
        this.soundscape.playFlashlightClick?.(isOn);
        this.uiManager.updateTelemetry({ flashlightOn: isOn });
      },
      onFlashlightToggle: (isOn) => {
        this.soundscape.playFlashlightClick?.(isOn);
        this.uiManager.updateTelemetry({ flashlightOn: isOn });
      },
      onZoomChange: (isZoomed) => {
        this.uiManager.updateTelemetry({ isZoomed });
      },
      onSelectPreset: (presetName) => {
        this.applyPreset(presetName, null, false);
      },
      onTriggerFlicker: () => {
        this.triggerSuspenseFlickerScare();
      },
      onTriggerJumpScare: () => {
        this.triggerLisaJumpScare();
      },
    });

    this.loopManager.bindSubsystems({
      environment: this.environment,
      flashlight: this.flashlight,
      fpEngine: this.fpEngine,
      lisaController: this.lisaController,
      soundscape: this.soundscape,
      postProcessor: this.postProcessor,
      uiManager: this.uiManager,
    });

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.activePreset = this.initialPreset;

    // Live Autonomous Horror Pacing Director state
    this.horrorDirector = {
      introRadioFired: false,
      firstFlickerFired: false,
      bathroomCreakFired: false,
      periodicTimer: 0,
      cycleIndex: 0,
    };

    this._bindGlobalShortcuts();
    this._bindResize();
    this._bindAudioUnlock();

    // Apply initial preset & clean mode without blocking page load
    this.uiManager.setCleanMode(this.isCleanMode);
    this.applyPreset(this.initialPreset, this.initialLoop, false);

    if (!this.isCaptureMode) {
      setTimeout(() => {
        this.renderSingleFrame(0.016);
        this._startAnimationLoop();
      }, 60);
    }
  }

  _bindResize() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = Math.max(1, window.innerHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.postProcessor.setSize(w, h);
      if (this.isCaptureMode) {
        this.renderSingleFrame(0.016);
      }
    });
  }

  _bindAudioUnlock() {
    const unlock = () => {
      this.soundscape.init?.();
      this.soundscape.resume?.();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  _bindGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      const key = e.key.toLowerCase();
      if (e.key === '1') this.applyPreset('foyer_corridor');
      else if (e.key === '2') this.applyPreset('corner_radio_clock');
      else if (e.key === '3') this.applyPreset('bathroom_sink_horror');
      else if (e.key === '4') this.applyPreset('lisa_corner_stalk');
      else if (e.key === '5') this.applyPreset('red_hell_fridge_loop');
      else if (e.key === '6') this.applyPreset('lisa_jumpscare_closeup');
      else if (e.key === '0') this.applyPreset('free_roam');
      else if (key === 'f') this.toggleFlashlight();
      else if (key === 'x') this.triggerSuspenseFlickerScare();
      else if (key === 'j') this.triggerLisaJumpScare();
      else if (key === 'r') this.triggerRadioBroadcast();
      else if (key === 'p') this.uiManager.togglePhotoDrawer();
      else if (key === 'm') {
        const muted = this.soundscape.toggleMute();
        this.uiManager.setAudioMutedState(muted);
      } else if (key === 'h') {
        this.uiManager.toggleHudVisibility();
      }
    });
  }

  handleInteractable(interactable) {
    if (!interactable) return;
    this.soundscape.playClueCollect?.();
    this.loopManager.inspectObject(interactable);

    const id = String(interactable.id || '').toLowerCase();
    if (id.includes('radio')) {
      this.triggerRadioBroadcast();
    } else if (id.includes('bathroom_door')) {
      this.soundscape.playDoorCreak?.(true);
      this.environment.setBathroomDoorAngle?.((58 * Math.PI) / 180);
    } else if (id.includes('sink') || id.includes('fetus')) {
      this.soundscape.playBathroomFetusCry?.();
      this.uiManager.showSubtitle(
        'Ten months earlier, he lost his job and turned to the bottle...',
        4.5,
        'SINK SPECIMEN'
      );
    } else if (id.includes('phone') || id.includes('telephone')) {
      this.soundscape.triggerPhoneCall?.((text, dur, spk) => {
        this.uiManager.showSubtitle(text, dur, spk);
      });
    }
  }

  toggleFlashlight(forceState = undefined) {
    const isOn = this.flashlight.toggle(forceState);
    this.soundscape.playFlashlightClick?.(isOn);
    this.uiManager.updateTelemetry({ flashlightOn: isOn });
    return isOn;
  }

  triggerRadioBroadcast() {
    this.soundscape.init?.();
    this.soundscape.resume?.();
    const clip =
      this.loopManager.currentLoop === 3 ? 'radio_numbers_204863' : 'radio_broadcast_01';
    this.soundscape.triggerRadioBroadcast?.(clip, (text, dur, spk) => {
      this.uiManager.showSubtitle(text, dur || 5.0, spk || 'AM RADIO 204863');
    });
    this.uiManager.showSubtitle(
      clip === 'radio_numbers_204863'
        ? "Don't touch that dial now, we're just getting started... 2 - 0 - 4 - 8 - 6 - 3."
        : 'Look behind you. I said... look behind you.',
      5.0,
      'AM RADIO 204863'
    );
  }

  triggerSuspenseFlickerScare() {
    this.soundscape.init?.();
    this.soundscape.resume?.();
    this.soundscape.playFlashlightFlickerBuzz?.(0.95);

    this.flashlight.triggerSuspenseFlickerSequence('haunted_reveal', {
      onFlashOn: (pulseIndex) => {
        this.soundscape.playFlashlightFlickerBuzz?.(0.8);
        this.postProcessor.triggerGlitchPulse(0.65, 0.28);
        if (pulseIndex === 1) {
          this.lisaController.setPresetPose('lisa_corner_stalk', this.camera);
          this.uiManager.showSubtitle(
            'Look behind you. I said... look behind you.',
            2.4,
            'AM RADIO'
          );
        } else if (pulseIndex === 2) {
          this.lisaController.onFlashOn?.(2);
          this.soundscape.triggerGhostWhisper?.((text, dur, spk) => {
            this.uiManager.showSubtitle(text, dur, spk);
          });
        }
      },
      onBlackout: (blackoutIndex) => {
        this.lisaController.onBlackout?.(blackoutIndex);
        this.soundscape.playHeartbeat?.(0.95);
      },
      onSequenceComplete: () => {
        if (this.activePreset !== 'lisa_corner_stalk' && this.activePreset !== 'lisa_jumpscare_closeup') {
          this.lisaController.hide?.();
        }
      },
    });
  }

  triggerLisaJumpScare() {
    this.soundscape.init?.();
    this.soundscape.resume?.();
    this.soundscape.playJumpScareStinger?.((text, dur, spk) => {
      this.uiManager.showSubtitle(text, dur, spk);
    });
    this.postProcessor.triggerJumpScareGlitch(1.0, 1.4);
    this.fpEngine.triggerCameraFlinch(1.0, 0.95);
    this.lisaController.triggerJumpScare?.(this.camera, () => {
      if (this.activePreset !== 'lisa_jumpscare_closeup') {
        this.applyPreset(this.activePreset, this.loopManager.currentLoop, true);
      }
    });
    this.uiManager.showSubtitle("Forgive me... I'm right behind you!", 3.2, 'LISA');
  }

  setLoop(loopNumber) {
    this.loopManager.setLoop(loopNumber);
    this.environment.setLoopState?.(loopNumber);
    if (this.isCaptureMode) {
      this.renderSingleFrame(0.016);
    }
  }

  /**
   * Synchronizes all 5 subsystems to one of the 6 reference presets (`foyer_corridor` .. `lisa_jumpscare_closeup`)
   * or `'free_roam'`.
   */
  applyPreset(presetName, explicitLoop = null, immediate = true) {
    const presetKey = String(presetName || 'foyer_corridor').toLowerCase();
    this.activePreset = presetKey;

    const presetCfg = CAMERA_PRESETS[presetKey] || CAMERA_PRESETS.foyer_corridor;
    const targetLoop = explicitLoop || presetCfg.loopIndex || 1;

    // 1. Sync Loop Manager & Post-Processing Grading
    this.loopManager.syncToCameraPreset(presetKey, { silent: immediate });
    if (explicitLoop) {
      this.loopManager.setLoop(targetLoop, {
        silent: true,
        preservePresetGrading: true,
        skipLisaSync: true,
        immediate: true,
      });
    }
    this.postProcessor.setPresetGrading(presetKey, true);

    // 2. Sync Environment props & lighting to preset
    this.environment.setLoopState?.(targetLoop);
    this.environment.setSceneEnvironmentPreset?.(presetKey);

    // 3. Sync Camera & First-Person Engine
    this.fpEngine.setCameraPreset(presetKey);

    // 4. Sync Flashlight & First-Person Hand Rig
    this.flashlight.setPresetState(presetKey);

    // 5. Sync Lisa Entity Pose (`lisa_corner_stalk` & `lisa_jumpscare_closeup`)
    this.lisaController.setPresetPose(presetKey, this.camera);

    // 6. Sync UI Pills & Telemetry
    this.uiManager.setActivePresetPill(presetKey);
    if ((presetKey === 'foyer_corridor' || presetKey === 'free_roam') && !this.isCleanMode) {
      // Show iconic The Corridor radio subtitle in interactive HUD shot_07 and on initial boot
      this.uiManager.showSubtitle(
        'Look behind you. I said... look behind you. — 204863',
        this.isCaptureMode ? 0 : 6.0,
        'AM RADIO'
      );
    }

    // In live interactive mode, clicking preset 6 triggers the live 24Hz jump scare lunge
    if (!this.isCaptureMode && !immediate && presetKey === 'lisa_jumpscare_closeup') {
      this.triggerLisaJumpScare();
    }

    if (immediate) {
      this.renderSingleFrame(0.016);
    }
  }

  /**
   * Deterministic capture hook invoked by `scripts/capture_scenes.py`.
   */
  setCaptureState(presetName, loopNum = null, isClean = true) {
    this.isCaptureMode = true;
    this.isCleanMode = Boolean(isClean);
    if (this.flashlight) this.flashlight.captureMode = true;
    if (this.fpEngine) this.fpEngine.captureMode = true;
    if (this.environment) this.environment.captureMode = true;
    if (this.lisaController) this.lisaController.captureMode = true;

    this.uiManager.setCleanMode(this.isCleanMode);
    if (typeof window.setCleanMode === 'function') {
      window.setCleanMode(this.isCleanMode);
    }

    this.applyPreset(presetName, loopNum, false);

    // Advance one non-rendering tick so all world matrices and lights settle, then render 1 frame
    this.step(0.016, false);
    this.renderSingleFrame(0.016);
    return `OK:${presetName}:loop=${this.loopManager.currentLoop}:clean=${this.isCleanMode}`;
  }

  /**
   * Autonomous Live Horror Pacing Director — orchestrates unscripted flashlight voltage stutters,
   * bathroom door creaks, corner peeks, multi-stage blackout stalks, and behind-the-player scares
   * during live first-person exploration.
   */
  _updateLiveHorrorDirector(dt) {
    if (this.isCaptureMode || !this.horrorDirector) return;

    const hd = this.horrorDirector;
    const pos = this.camera.position;

    // Update environment proximity (opens far archway void & bathroom doorway as player walks down Wing A)
    this.environment.updatePlayerProximity?.(pos);

    // 1. At t = 2.6s: Nervous flashlight voltage micro-flicker + radio static broadcast
    if (!hd.introRadioFired && this.elapsed >= 2.6) {
      hd.introRadioFired = true;
      this.flashlight.triggerSuspenseFlickerSequence?.('micro_flicker');
      this.soundscape.playFlashlightFlickerBuzz?.(0.55);
      this.uiManager.showSubtitle(
        'Look behind you. I said... look behind you.',
        5.2,
        'AM RADIO 204863'
      );
    }

    // 2. Walking past z < -3.6 in Wing A (or at t = 9.5s): Full 5-stage haunted blackout reveal of Lisa
    if (
      !hd.firstFlickerFired &&
      ((pos.z < -3.6 && pos.z > -8.5) || this.elapsed >= 9.5)
    ) {
      hd.firstFlickerFired = true;
      hd.periodicTimer = 0;
      this.triggerSuspenseFlickerScare();
    }

    // 3. Approaching the Bathroom Doorway (z ∈ [-9.6, -6.8]): Door creaks open & sink fetus whimpers
    if (!hd.bathroomCreakFired && pos.z < -6.8 && pos.z > -9.8) {
      hd.bathroomCreakFired = true;
      this.soundscape.playDoorCreak?.(true);
      this.environment.setBathroomDoorAngle?.(1.22);
      this.uiManager.showSubtitle(
        '*The bathroom door creaks open on its own... Something is crying in the sink.*',
        4.8,
        'CORRIDOR'
      );
    }

    // 4. Periodic unscripted haunting cycle every 15s during live exploration
    hd.periodicTimer += dt;
    if (hd.periodicTimer >= 15.0) {
      hd.periodicTimer = 0;
      hd.cycleIndex = (hd.cycleIndex + 1) % 3;

      if (hd.cycleIndex === 0) {
        this.triggerSuspenseFlickerScare();
      } else if (hd.cycleIndex === 1) {
        this.lisaController.triggerCornerPeek?.(
          pos.z < -7.5 ? 'north_corner' : 'bathroom_door'
        );
        this.soundscape.triggerGhostWhisper?.((text, dur, spk) => {
          this.uiManager.showSubtitle(text, dur, spk);
        });
      } else {
        this.lisaController.triggerBehindPlayerStalk?.(this.camera);
        this.uiManager.showSubtitle(
          'Look behind you. I said... look behind you.',
          4.5,
          'AM RADIO'
        );
      }
    }
  }

  /**
   * Advances simulation by `dt` seconds; optionally skips WebGL render pass for fast automated tests.
   */
  step(dt = 0.016, renderFrame = true) {
    this.elapsed += dt;

    if (!this.isCaptureMode) {
      this.fpEngine.update(dt, this.elapsed, this.environment.interactables);
      this._updateLiveHorrorDirector(dt);
    } else {
      this.camera.updateMatrixWorld(true);
    }

    this.flashlight.update(dt, this.elapsed, this.camera);

    const loopState = this.loopManager.getLoopState();
    if (loopState) {
      loopState.playerPosition = this.camera.position;
    }
    this.environment.update(dt, this.elapsed, loopState);

    if (!this.isCaptureMode) {
      this.lisaController.update(
        dt,
        this.elapsed,
        this.camera.position,
        this.camera,
        this.flashlight,
        this.loopManager.currentLoop
      );
    }

    this.loopManager.update(dt, this.elapsed, this.camera.position);
    this.soundscape.update(dt, this.elapsed, this.camera, this.loopManager.currentLoop);
    if (this.flashlight && this.flashlight.beamScreenState) {
      this.postProcessor.syncFlashlightState?.(this.flashlight.beamScreenState);
    }
    this.postProcessor.update(dt, this.elapsed);

    if (renderFrame) {
      this.postProcessor.render(this.scene, this.camera, dt, this.elapsed);
    }
  }

  renderSingleFrame(dt = 0.016) {
    this.step(dt, true);
  }

  _startAnimationLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.renderSingleFrame(dt);
    };
    requestAnimationFrame(animate);
  }
}

// Initialize on DOMContentLoaded
function initPTHorrorEngine() {
  if (window.__PT_HORROR__) return window.__PT_HORROR__;
  const app = new PTHorrorEngineApp();
  window.__PT_HORROR__ = app;
  window.setCameraPreset = (preset) => app.applyPreset(preset);
  return app;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPTHorrorEngine);
} else {
  initPTHorrorEngine();
}
