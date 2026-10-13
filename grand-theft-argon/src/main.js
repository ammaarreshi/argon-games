import * as THREE from '../assets/vendor/three.module.js';
import { ViceCityWorld } from './world_cel_camera.js';
import { VehicleTrafficPoliceSystem } from './vehicles_traffic_police.js';
import { CombatWeaponsSystem } from './combat_weapons_targeting.js';
import { MiniGamesAndEconomySystem } from './minigames_pda_economy.js';
import { VFXHudAndAudioSystem } from './vfx_hud_audio.js';

export class ViceCityChinatownEngine {
  constructor() {
    this.container = document.getElementById('vc-canvas-container') || document.body;
    this.contextPromptEl = document.getElementById('vc-context-prompt');
    this.debugBarEl = document.getElementById('vc-debug-bar');

    const params = new URLSearchParams(window.location.search);
    this.isCaptureMode = params.get('capture') === '1';
    this.isDebugMode = params.get('debug') === '1';
    this.initialScenePreset = params.get('scene') || params.get('preset') || '';

    if (this.isDebugMode) {
      document.body.classList.add('vc-debug-mode');
    }

    // 1. Initialize WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 2. Initialize Input State
    this.keys = {};
    this.inputState = {
      keys: this.keys,
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      handbrake: false,
      spaceJustPressed: false,
      interact: false,
      fire: false,
      mouseDown: false,
      throwSecondary: false,
      nextWeapon: false,
      prevWeapon: false,
      cycleThrowable: false,
      cycleTarget: false,
      aimWorldX: NaN,
      aimWorldZ: NaN,
      mouseX: window.innerWidth * 0.5,
      mouseY: window.innerHeight * 0.5,
    };
    this._raycaster = new THREE.Raycaster();
    this._mouseNDC = new THREE.Vector2();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._aimHitPoint = new THREE.Vector3();

    // 3. Instantiate Agent 1: Argon City World, Cel-Shading & Camera Rig
    this.world = new ViceCityWorld(this.renderer);

    // 4. Instantiate Agent 6: VFX, Grand Theft Argon Comic HUD & Spatial Audio Engine
    this.vfxHud = new VFXHudAndAudioSystem(this.world.scene, this.world.camera, this.world, {
      onOpenPager: () => this.economySystem?.togglePDA(),
      onTogglePager: () => this.economySystem?.togglePDA(),
      onSelectWeapon: (weaponId) => this.combatSystem?.selectWeapon(weaponId),
      onCycleThrowable: () => this.combatSystem?.cycleThrowable(),
      onCycleRadio: () => {
        const st = this.vfxHud.cycleRadioStation();
        if (st && st.id === 'flash_fm') this.vfxHud.playVoice('dj_flash_intro');
        else if (st && st.id === 'wave_103') this.vfxHud.playVoice('dj_wave_intro');
      },
    });

    // 5. Instantiate Agent 2: Vehicle Physics, Traffic & ACPD Pursuit AI
    this.vehicleSystem = new VehicleTrafficPoliceSystem(this.world.scene, this.world, {
      onExplosion: (x, y, z, scale = 1.25) => {
        this.vfxHud.spawnExplosion(x, y, z, scale);
        this.world.addCameraShake(0.95);
        this.combatSystem?.applyExplosionDamageAt(x, z, 8.0, 180, false);
        this.economySystem?.onVehicleDestroyed(false);
      },
      onVehicleExplode: (vehicle) => {
        this.vfxHud.spawnExplosion(vehicle.x, (vehicle.y || 0) + 0.8, vehicle.z, 1.35);
        this.world.addCameraShake(1.0);
        this.combatSystem?.applyExplosionDamageAt(vehicle.x, vehicle.z, 8.5, 190, false);
        this.economySystem?.onVehicleDestroyed(Boolean(vehicle.isPolice));
      },
      onSpark: (x, y, z, count = 12) => {
        this.vfxHud.spawnSparks(x, y, z, count);
        this.world.addCameraShake(0.22);
      },
      onCallout: (text, subtext = '', color = '#ffffff') => {
        this.vfxHud.addCallout(text, subtext, color);
        if (text && text.includes('NEAR MISS')) {
          this.combatSystem?.addCash(100);
        } else if (text && text.includes('DRIFT')) {
          this.combatSystem?.addCash(150);
        }
      },
      onCopTakedown: (copOrData, wreckedCount, requiredCount) => {
        const cop = copOrData?.vehicle || copOrData;
        const wCount = copOrData?.copsWrecked ?? wreckedCount ?? 1;
        const rCount = copOrData?.copsRequired ?? requiredCount ?? 1;
        this.vfxHud.addCallout('COP TAKEDOWN!', `SQUAD CAR WRECKED (${wCount}/${Math.max(1, rCount)})`, '#ff2a85');
        if (cop && Number.isFinite(cop.x)) {
          this.vfxHud.spawnSparks(cop.x, 1.1, cop.z, 22);
        }
        this.world.addCameraShake(0.75);
        this.vfxHud.playVoice('protag_takedown');
        this.combatSystem?.addCash(500);
        this.economySystem?.onVehicleDestroyed(true);
      },
      onWantedChange: (stateOrNewStars, oldStarsArg) => {
        const newStars =
          typeof stateOrNewStars === 'object' && stateOrNewStars !== null
            ? Number(stateOrNewStars.stars ?? 0)
            : Number(stateOrNewStars ?? 0);
        const oldStars =
          typeof oldStarsArg === 'number' ? oldStarsArg : Number(this._lastKnownWantedStars ?? 0);
        this._lastKnownWantedStars = newStars;

        if (newStars > oldStars) {
          if (newStars >= 3) {
            this.vfxHud.playVoice('dispatch_swat');
          } else {
            this.vfxHud.playVoice('dispatch_ocean_drive');
          }
        } else if (newStars === 0 && oldStars > 0) {
          this.vfxHud.addCallout('PURSUIT ESCAPED!', 'ACPD LOST IN THE NEON', '#00f0ff');
          this.vfxHud.playVoice('protag_escape');
        }
      },
      onPursuitEscaped: () => {
        this._lastKnownWantedStars = 0;
        this.vfxHud.addCallout('PURSUIT ESCAPED!', 'ACPD HEAT CLEARED', '#00f0ff');
        this.vfxHud.playVoice('protag_escape');
      },
      onCarjackVehicle: (vehicle, info = {}) => {
        if (info.wasOccupiedTraffic || info.wasPoliceCar) {
          this.combatSystem?.spawnCarjackedDriver?.(vehicle);
        }
      },
      onRequestHotwire: (vehicle, onComplete) => {
        if (this.economySystem) {
          vehicle.hotwireIgnitionLocked = true;
          this.economySystem.startHotwireMiniGame(
            vehicle,
            () => {
              vehicle.hotwireIgnitionLocked = false;
              vehicle.requiresHotwire = false;
              vehicle.isHotwired = true;
              if (typeof vehicle.unlockHotwire === 'function') vehicle.unlockHotwire();
              if (typeof onComplete === 'function') onComplete();
              this.vfxHud.addCallout('EXOTIC HOTWIRED!', `${vehicle.name || 'SUPERCAR'} UNLOCKED`, '#00f0ff');
            },
            () => {
              vehicle.hotwireIgnitionLocked = false;
              this.combatSystem?.exitVehicle();
              this.vehicleSystem?.exitVehicle(this.combatSystem?.getPlayerState());
            }
          );
        } else if (typeof onComplete === 'function') {
          onComplete();
        }
      },
      onPlaySound: (sfxId, opts) => {
        this.vfxHud.playSFX(sfxId, opts);
      },
    });

    // 6. Instantiate Agent 3: Combat Engine, Targeting & Weapons
    this.combatSystem = new CombatWeaponsSystem(this.world.scene, this.world, this.vehicleSystem, {
      onMuzzleFlash: (x, y, z, tx, ty, tz) => {
        this.vfxHud.spawnMuzzleFlash(x, y, z, tx, ty, tz);
      },
      onBloodSplatter: (x, z) => {
        this.vfxHud.spawnBloodSplatter(x, z);
      },
      onFireGrid: (x, z, duration = 6.5) => {
        this.vfxHud.spawnFireGrid(x, z, duration);
      },
      onExplosion: (x, y, z, scale = 1.2) => {
        this.vfxHud.spawnExplosion(x, y, z, scale);
        this.world.addCameraShake(0.85);
      },
      onCallout: (text, subtext = '', color = '#ffffff') => {
        this.vfxHud.addCallout(text, subtext, color);
      },
      onKillNPC: (npc, weapon) => {
        this.economySystem?.onEnemyKilled(weapon?.id || 'any');
        if (npc && npc.faction === 'acpd') {
          this.vehicleSystem.addWantedHeat(100);
        } else if (npc && npc.isHostile) {
          this.vehicleSystem.addWantedHeat(22);
        } else {
          this.vehicleSystem.addWantedHeat(45);
        }
      },
      onPedestrianPanic: () => {
        if (Math.random() < 0.25) {
          this.vfxHud.playVoice(Math.random() < 0.5 ? 'ped_panic' : 'ped_insult');
        }
      },
      onPedestrianSpeak: (evt) => {
        if (!evt) return;
        const bx = Number.isFinite(evt.x) ? evt.x : evt.npc?.x ?? 80;
        const by = Number.isFinite(evt.y) ? evt.y : (evt.npc?.y ?? 0) + 2.15;
        const bz = Number.isFinite(evt.z) ? evt.z : evt.npc?.z ?? -20;
        this.vfxHud.spawnSpeechBubble?.(bx, by, bz, evt.text || '', evt.style || 'chat', evt.speaker || '');
      },
      onPedestrianBubble: (npc, text, style = 'chat') => {
        if (!npc) return;
        this.vfxHud.spawnSpeechBubble?.(npc.x, (npc.y || 0) + 2.15, npc.z, text || '', style);
      },
      onPlayVoice: (clipId) => {
        this.vfxHud.playVoice(clipId);
      },
      onPlaySFX: (sfxId, opts) => {
        this.vfxHud.playSFX(sfxId, opts);
      },
      onCashPickup: (amount) => {
        this.vfxHud.addCallout(`+$${amount}`, 'CASH BUNDLE', '#2ee866');
        this.vfxHud.playSFX('cash_pickup');
      },
    });

    // 7. Instantiate Agent 5: Mini-Games, Pager/PDA & Black Market Economy
    this.economySystem = new MiniGamesAndEconomySystem(
      this.world.scene,
      this.world,
      this.combatSystem,
      this.vehicleSystem,
      {
        onCallout: (text, subtext = '', color = '#00f0ff') => {
          this.vfxHud.addCallout(text, subtext, color);
        },
        onCashChange: (delta, reason) => {
          if (delta > 0 && reason) {
            this.vfxHud.addCallout(`+$${delta.toLocaleString()}`, reason, '#2ee866');
          }
        },
        onPlaySFX: (sfxId, opts) => {
          this.vfxHud.playSFX(sfxId, opts);
        },
        onPlayVoice: (clipId) => {
          this.vfxHud.playVoice(clipId);
        },
        onWaypointChange: (wp) => {
          if (wp) {
            this.vfxHud.addCallout('GPS LOCKED', wp.label || 'TARGET WAYPOINT', '#00f0ff');
          }
        },
      }
    );

    // 8. Setup Initial Player Spawn on Ocean Drive in Sunset Red Striped Cheetah
    this._setupInitialHeroScenario();

    // 9. Bind Input & Debug Listeners
    this._bindEvents();

    // 10. Start Main Loop or Capture Mode
    this.lastFrameTime = performance.now();
    if (this.isCaptureMode) {
      // Warm up world & traffic for 3 tiny steps before staging the hero preset
      for (let i = 0; i < 3; i++) {
        this.step(0.016, false);
      }
      if (this.initialScenePreset) {
        this.applyScenePreset(this.initialScenePreset);
      } else {
        this.step(0.004, true);
      }
    } else {
      if (this.initialScenePreset) {
        this.applyScenePreset(this.initialScenePreset);
      }
      this._rafId = requestAnimationFrame((ts) => this._loop(ts));
    }
  }

  _setupInitialHeroScenario() {
    this._lastKnownWantedStars = 0;
    this._lastChunkKey = '0,0';
    this.vehicleSystem.clearWanted();

    const allVehicles = this.vehicleSystem.getVehicles() || [];
    // Reuse the Sunset Red w/ White Racing Stripes 1986 Cheetah spawned by VehicleTrafficPoliceSystem
    let heroCar = allVehicles.find((v) => v.type === 'cheetah' && v.striped);
    if (!heroCar) {
      heroCar = this.vehicleSystem.spawnVehicle('cheetah', 83.2, -26, Math.PI, {
        colorHex: 0xe6192e,
        striped: true,
        requiresHotwire: false,
        isHotwired: true,
        isTraffic: false,
        isParked: false,
      });
    } else {
      heroCar.x = 83.2;
      heroCar.z = -26;
      heroCar.rotationY = Math.PI;
      heroCar.isParked = false;
      heroCar.isTraffic = false;
    }
    this.heroCar = heroCar;
    this._lastDrivenVehicle = heroCar;

    // Reuse the parked Flamingo Pink Infernus on the West curb of Ocean Drive
    this.parkedExotic =
      allVehicles.find((v) => v.type === 'infernus' && v.requiresHotwire) ||
      this.vehicleSystem.spawnVehicle('infernus', 73.4, -15, 0, {
        colorHex: 0xff2a85,
        striped: false,
        requiresHotwire: true,
        isParked: true,
      });

    // Place player inside the Sunset Red Striped Cheetah by default so driving feels immediate!
    this.combatSystem.x = heroCar.x;
    this.combatSystem.z = heroCar.z;
    this.combatSystem.enterVehicle(heroCar);
    this.vehicleSystem.enterVehicle(heroCar, this.combatSystem.getPlayerState());
    this.vehicleSystem.clearWanted();

    // Snap camera immediately to Ocean Drive hero car with oblique Grand Theft Argon angle
    this.world.cameraFocus.set(80.5, 0.8, -26);
    this.world.cameraCurrentPos.set(87.0, 25.5, -14);
    this.world.updateCamera(0.016, {
      position: { x: heroCar.x, y: 0, z: heroCar.z },
      velocity: { x: 0, y: 0, z: 0 },
      heading: Math.PI,
    });
  }

  applyScenePreset(presetName) {
    const p = String(presetName || '').toLowerCase();

    // Ensure any open modals, stale callouts, and transient speech bubbles are cleared before switching scene presets
    this.economySystem.closeActiveModal();
    if (this.vfxHud) {
      this.vfxHud.callouts = [];
      this.vfxHud.speechBubbles = [];
    }
    let customCamFocus = null;
    let customCamPos = null;

    if (p === 'ocean_night_chase' || p === 'screenshot1' || p === 'night') {
      // Matches Reference Screenshot 1:
      // Nighttime (Tue 02:01) by the glowing neon-orange ARGON GAS '86 canopy (x=65.8, z=-38) & cyan fuel ring,
      // 3-Star Wanted pursuit, red/white striped Cheetah surrounded by ACPD cruisers with headlights & sirens!
      this.world.setTimeOfDay(2.02); // 02:01 AM
      this.world.setWeather('clear');
      this.vfxHud.hudState.dayName = 'Tue';
      this.vfxHud.hudState.clockTime = '02:01';
      this.vfxHud.hudState.unreadCount = 59;

      if (!this.combatSystem.inVehicle && this.heroCar) {
        this.combatSystem.enterVehicle(this.heroCar);
        this.vehicleSystem.enterVehicle(this.heroCar, this.combatSystem.getPlayerState());
      }
      if (this.heroCar) {
        this.heroCar.x = 76.5;
        this.heroCar.z = -35.5;
        this.heroCar.rotationY = Math.PI * 0.90;
        this.heroCar.vx = 0.0;
        this.heroCar.vz = 0.0;
        this.heroCar.speed = 14.1;
      }

      this.vehicleSystem.setWantedStars(3);
      this.vfxHud.hudState.wantedLevel = 3;
      this.vfxHud.hudState.copsRequired = 3;
      this.vfxHud.hudState.copsWrecked = 0;

      // Position 3 ACPD cruisers around the intersection & Argon Gas '86 canopy matching Screenshot 1
      const cops = this.vehicleSystem.getVehicles().filter((v) => v.isPolice && !v.isWrecked);
      const copPlacements = [
        { x: 73.2, z: -30.5, rot: Math.PI * 0.86 },
        { x: 80.8, z: -30.0, rot: Math.PI * 0.98 },
        { x: 71.0, z: -40.5, rot: Math.PI * 0.80 },
      ];
      for (let i = 0; i < copPlacements.length; i++) {
        const cp = copPlacements[i];
        const cop =
          cops[i] ||
          this.vehicleSystem.spawnVehicle('vcpd_cruiser', cp.x, cp.z, cp.rot, {
            isPolice: true,
            isPursuitCop: true,
          });
        cop.x = cp.x;
        cop.z = cp.z;
        cop.rotationY = cp.rot;
        cop.vx = 0;
        cop.vz = 0;
        cop.isWrecked = false;
        cop.isExploded = false;
      }

      customCamFocus = { x: 74.0, y: 0.8, z: -36.5 };
      customCamPos = { x: 82.5, y: 25.0, z: -24.0 };
      this.vfxHud.showDistrictBanner('OCEAN BEACH');
    } else if (p === 'ocean_day_takedown' || p === 'screenshot2' || p === 'day') {
      // Matches Reference Screenshot 2:
      // Sunny Afternoon (Mon 15:04) on Ocean Drive, 4-Star Wanted level,
      // Red/white striped sports car firing a bright yellow-orange tracer beam ahead,
      // yellow Kaufman Cabs on the avenue, a wrecked ACPD police car right beside the player with a bold Red 'X',
      // and "NEAR MISS" callout in the top-left!
      this.world.setTimeOfDay(15.07); // 15:04 PM
      this.world.setWeather('clear');
      this.vfxHud.hudState.dayName = 'Mon';
      this.vfxHud.hudState.clockTime = '15:04';

      if (!this.combatSystem.inVehicle && this.heroCar) {
        this.combatSystem.enterVehicle(this.heroCar);
        this.vehicleSystem.enterVehicle(this.heroCar, this.combatSystem.getPlayerState());
      }
      if (this.heroCar) {
        this.heroCar.x = 78.5;
        this.heroCar.z = -1.5;
        this.heroCar.rotationY = Math.PI * 0.88;
        this.heroCar.vx = 0.0;
        this.heroCar.vz = 0.0;
        this.heroCar.speed = 14.5;
      }

      this.vehicleSystem.setWantedStars(4);
      // Wreck a pursuing police cruiser right beside the player car so the Red 'X' stamp is prominently visible!
      const cops = this.vehicleSystem.getVehicles().filter((v) => v.isPolice);
      const targetCop =
        cops[0] ||
        this.vehicleSystem.spawnVehicle('vcpd_cruiser', 74.8, 2.0, Math.PI * 0.65, {
          isPolice: true,
          isPursuitCop: true,
        });
      targetCop.x = 74.8;
      targetCop.z = 2.0;
      targetCop.vx = 0;
      targetCop.vz = 0;
      targetCop.rotationY = Math.PI * 0.65;
      this.vehicleSystem._wreckPoliceVehicle(targetCop, 'COP TAKEDOWN!');

      // Place a second active pursuing ACPD cruiser ahead on Ocean Drive being hit by the drive-by tracer!
      const aheadCop =
        cops[1] ||
        this.vehicleSystem.spawnVehicle('vcpd_cruiser', 76.8, -9.5, Math.PI * 0.92, {
          isPolice: true,
          isPursuitCop: true,
        });
      aheadCop.x = 76.8;
      aheadCop.z = -9.5;
      aheadCop.vx = 0;
      aheadCop.vz = 0;
      aheadCop.rotationY = Math.PI * 0.92;
      aheadCop.isWrecked = false;

      // Spawn yellow Kaufman Cabs & traffic around the intersection like Screenshot 2
      const cab1 = this.vehicleSystem.spawnVehicle('kaufman_cab', 82.4, -3.5, Math.PI * 0.92, {
        isTraffic: true,
      });
      cab1.vx = 0;
      cab1.vz = 0;
      const cab2 = this.vehicleSystem.spawnVehicle('kaufman_cab', 83.0, -11.5, Math.PI * 0.90, {
        isTraffic: true,
      });
      cab2.vx = 0;
      cab2.vz = 0;

      // Spawn bright yellow-orange drive-by muzzle flash & tracer beam from player car window to target cop ahead!
      this.vfxHud.spawnMuzzleFlash(78.1, 1.28, -2.8, 76.8, 1.22, -9.2);
      this.vfxHud.spawnSparks(76.8, 1.25, -9.0, 16);

      // Set top-left callout to "NEAR MISS" matching Screenshot 2
      this.vfxHud.callouts = [
        {
          text: 'NEAR MISS',
          subtext: 'OCEAN DRIVE BONUS +$100',
          color: '#ffffff',
          accent: '#ffd700',
          age: 0.08,
          duration: 8.0,
        },
      ];

      customCamFocus = { x: 78.0, y: 0.8, z: -4.0 };
      customCamPos = { x: 85.5, y: 24.5, z: 7.5 };
    } else if (p === 'starfish_mansion' || p === 'combat') {
      // Golden Sunset shootout & Molotov fire grid at Starfish Island Vercetti Estate Mansion forecourt
      this.world.setTimeOfDay(18.25); // Golden Sunset / Neon dusk
      this.world.setWeather('clear');
      this.vehicleSystem.setWantedStars(2);

      if (this.combatSystem.inVehicle) {
        this.combatSystem.exitVehicle();
        this.vehicleSystem.exitVehicle(this.combatSystem.getPlayerState());
      }
      this.combatSystem.x = -24.8;
      this.combatSystem.z = -7.2;
      this.combatSystem.rotationY = Math.PI * 1.12;
      this.combatSystem.selectWeapon('mac10');

      // Spawn Cartel enforcers on the mansion steps & courtyard and lock onto one
      this.combatSystem.spawnRampageWave('cartel', 5, -30.0, -13.0);
      this.vfxHud.spawnFireGrid(-26.2, -11.2, 9.0);
      this.vfxHud.spawnMuzzleFlash(-25.0, 1.38, -7.8, -29.8, 1.35, -13.2);
      this.vfxHud.addCallout('2X CHAIN!', 'STARFISH ESTATE ASSAULT', '#ff2a85');
      this.vfxHud.showDistrictBanner('STARFISH ISLAND');

      customCamFocus = { x: -28.0, y: 1.0, z: -10.0 };
      customCamPos = { x: -20.5, y: 21.5, z: 2.0 };
    } else if (p === 'marina_speedboat' || p === 'boat') {
      // Piloting the sleek twin-outboard Cigarette Speedboat in open turquoise water at Argon Port Marina
      this.world.setTimeOfDay(16.75);
      this.world.setWeather('clear');
      this.vehicleSystem.setWantedStars(1);

      const boats = this.vehicleSystem.getVehicles().filter((v) => v.isBoat);
      const boat =
        boats[0] ||
        this.vehicleSystem.spawnVehicle('cigarette_boat', -2.0, 122.0, Math.PI * 0.22, {
          isBoat: true,
        });
      boat.x = -2.0;
      boat.z = 122.0;
      boat.rotationY = Math.PI * 0.22;
      boat.vx = 0.0;
      boat.vz = 0.0;
      boat.speed = 14.2;

      this.combatSystem.enterVehicle(boat);
      this.vehicleSystem.enterVehicle(boat, this.combatSystem.getPlayerState());
      for (let i = 0; i < 8; i++) {
        this.world.addWaterWake(-2.0 - i * 1.1, 122.0 - i * 1.3, -2.5, -3.0);
      }
      this.vfxHud.showDistrictBanner('ARGON PORT MARINA');
      this.vfxHud.playVoice('dispatch_boat');

      customCamFocus = { x: 1.0, y: 0.2, z: 121.0 };
      customCamPos = { x: 8.5, y: 24.5, z: 133.5 };
    } else if (p === 'minigame_hotwire' || p === 'hotwire') {
      this.world.setTimeOfDay(21.5);
      if (this.parkedExotic) {
        this.economySystem.startHotwireMiniGame(this.parkedExotic);
      }
    } else if (p === 'minigame_molotov' || p === 'molotov') {
      this.world.setTimeOfDay(2.02);
      this.economySystem.startMolotovMiniGame();
    } else if (p === 'minigame_stash' || p === 'dumpster') {
      this.world.setTimeOfDay(16.5);
      this.economySystem.startStashMiniGame({ label: 'Little Haiti Alley Dumpster', type: 'dumpster' });
    } else if (p === 'pda_economy' || p === 'pda') {
      this.world.setTimeOfDay(21.0);
      this.economySystem.openPDA('market');
    } else if (p === 'ocean_cruise_carjack' || p === 'ocean_cruise' || p === 'carjack') {
      // Peaceful 0-Star Ocean Drive afternoon showing abundant curbside jackable exotics,
      // orderly two-way traffic, pedestrian comic speech bubble banter, and the player on foot next to a jackable Cheetah GT
      this.world.setTimeOfDay(15.2);
      this.world.setWeather('clear');
      this.vehicleSystem.clearWanted();
      if (this.combatSystem.inVehicle) {
        this.combatSystem.exitVehicle();
        this.vehicleSystem.exitVehicle(this.combatSystem.getPlayerState());
      }
      this.combatSystem.x = 82.8;
      this.combatSystem.z = -19.5;
      this.combatSystem.rotationY = Math.PI * 0.25;
      const npcs = this.combatSystem.getNPCs?.() || [];
      const nearPed = npcs.find((n) => !n.isDead && n.faction === 'civilian') || npcs[0];
      if (nearPed) {
        nearPed.x = 87.2;
        nearPed.z = -21.0;
        nearPed.mesh?.position.set(nearPed.x, nearPed.y || 0.12, nearPed.z);
        this.vfxHud.spawnSpeechBubble?.(
          nearPed.x,
          (nearPed.y || 0.12) + 2.15,
          nearPed.z,
          "Closing a million-dollar condo on my Motorola brick phone!",
          'chat',
          'WALL ST YUPPIE'
        );
      }
      this.vfxHud.showDistrictBanner('OCEAN BEACH');
      this.vfxHud.callouts = [];
      this.vfxHud.addCallout('OCEAN DRIVE CRUISING', '0 STARS — PRESS [F] OR [E] TO JACK ANY RIDE', '#00f0ff');
      customCamFocus = { x: 79.5, y: 0.8, z: -20.5 };
      customCamPos = { x: 87.5, y: 24.5, z: -8.5 };
    } else if (p === 'pursuit_evade' || p === 'evade') {
      // Active 2-Star Pursuit Evasion on Ocean Drive showing pulsing Cyan/Gold Wanted Stars
      // and the "EVADING ACPD..." progress bar when breaking police line-of-sight!
      this.world.setTimeOfDay(21.8);
      this.world.setWeather('clear');
      if (!this.combatSystem.inVehicle && this.heroCar) {
        this.combatSystem.enterVehicle(this.heroCar);
        this.vehicleSystem.enterVehicle(this.heroCar, this.combatSystem.getPlayerState());
      }
      if (this.heroCar) {
        this.heroCar.x = 83.2;
        this.heroCar.z = 12.0;
        this.heroCar.rotationY = Math.PI;
        this.heroCar.speed = 26.5;
      }
      this.vehicleSystem.setWantedStars(2);
      this.vehicleSystem.isEvading = true;
      this.vehicleSystem.escapeTimer = 5.8;
      this.vehicleSystem.escapeDuration = 8.5;
      this.vehicleSystem.escapeProgress = 0.68;
      this.vfxHud.callouts = [];
      this.vfxHud.addCallout('EVADING ACPD PURSUIT!', 'KEEP OUT OF POLICE SIGHT TO CLEAR HEAT', '#00f0ff');
      customCamFocus = { x: 80.5, y: 0.8, z: 10.0 };
      customCamPos = { x: 88.5, y: 25.0, z: 22.0 };
    } else if (p === 'seaplane_flight' || p === 'plane' || p === 'skimmer') {
      // Soaring in the Dodo Skimmer Seaplane above Ocean Beach & Seaplane Boardwalk at Golden Hour
      this.world.setTimeOfDay(17.2);
      this.world.setWeather('clear');
      this.vehicleSystem.clearWanted();

      const planes = this.vehicleSystem.getVehicles().filter((v) => v.type === 'skimmer_plane');
      const plane =
        planes[0] ||
        this.vehicleSystem.spawnVehicle('skimmer_plane', 94.0, -18.0, Math.PI * 0.85, {
          isParked: false,
        });
      plane.x = 94.0;
      plane.y = 14.5;
      plane.z = -18.0;
      plane.rotationY = Math.PI * 0.85;
      plane.forwardSpeed = 38.0;
      plane.speed = 38.0;
      plane.vx = Math.sin(plane.rotationY) * 38.0;
      plane.vz = Math.cos(plane.rotationY) * 38.0;
      plane.vy = 1.6;
      plane.pitch = -0.12;
      plane.pitchAngle = -0.12;
      plane.roll = -0.22;
      plane.rollAngle = -0.22;

      this.combatSystem.enterVehicle(plane);
      this.vehicleSystem.enterVehicle(plane, this.combatSystem.getPlayerState());
      plane.y = 14.5;
      plane.forwardSpeed = 38.0;
      plane.speed = 38.0;
      plane.pitch = -0.12;
      plane.roll = -0.22;
      this.vehicleSystem._spawnWingtipContrail?.(plane);
      this.vfxHud.showDistrictBanner('OCEAN BEACH AIRSPACE');
      this.vfxHud.callouts = [];
      this.vfxHud.addCallout('DODO SKIMMER SEAPLANE', 'HOLD [W] + [SPACE] TO CLIMB • [A/D] BANK TURN', '#00f0ff');
      customCamFocus = { x: 88.0, y: 11.0, z: -20.0 };
      customCamPos = { x: 108.0, y: 36.0, z: 2.0 };
    } else if (p === 'chopper_flight' || p === 'heli' || p === 'maverick') {
      // Flying the Argon Maverick Chopper past the Downtown VCN Skyscraper Skyline & Cherry Popper Factory
      this.world.setTimeOfDay(18.4);
      this.world.setWeather('clear');
      this.vehicleSystem.clearWanted();

      const helis = this.vehicleSystem.getVehicles().filter((v) => v.type === 'maverick_heli');
      const heli =
        helis[0] ||
        this.vehicleSystem.spawnVehicle('maverick_heli', -118.0, -22.0, Math.PI * 0.25, {
          isParked: false,
        });
      heli.x = -118.0;
      heli.y = 17.5;
      heli.z = -22.0;
      heli.rotationY = Math.PI * 0.25;
      heli.forwardSpeed = 28.0;
      heli.speed = 28.0;
      heli.vx = Math.sin(heli.rotationY) * 28.0;
      heli.vz = Math.cos(heli.rotationY) * 28.0;
      heli.vy = 0.8;
      heli.pitch = 0.14;
      heli.pitchAngle = 0.14;
      heli.roll = 0.16;
      heli.rollAngle = 0.16;

      this.combatSystem.enterVehicle(heli);
      this.vehicleSystem.enterVehicle(heli, this.combatSystem.getPlayerState());
      heli.y = 17.5;
      heli.forwardSpeed = 28.0;
      heli.speed = 28.0;
      heli.pitch = 0.14;
      heli.roll = 0.16;
      this.vfxHud.showDistrictBanner('DOWNTOWN SKYLINE');
      this.vfxHud.callouts = [];
      this.vfxHud.addCallout('ARGON MAVERICK CHOPPER', '[W/S] FLY • [SPACE] CLIMB • [F] LAND ON HELIPAD', '#ff2a85');
      customCamFocus = { x: -136.0, y: 13.5, z: -24.0 };
      customCamPos = { x: -94.0, y: 39.0, z: 4.0 };
    } else if (p === 'stunt_jump' || p === 'stunt') {
      // Mid-air Unique Stunt Jump in the Deluxo '86 Gullwing launching off the Ocean Beach Seawall Ramp!
      this.world.setTimeOfDay(16.2);
      this.world.setWeather('clear');
      this.vehicleSystem.clearWanted();

      const deluxos = this.vehicleSystem.getVehicles().filter((v) => v.type === 'deluxo');
      const car =
        deluxos[0] ||
        this.vehicleSystem.spawnVehicle('deluxo', 92.5, -3.5, Math.PI * 0.5, {
          isParked: false,
        });
      car.x = 92.5;
      car.y = 4.4;
      car.z = -3.5;
      car.rotationY = Math.PI * 0.5;
      car.forwardSpeed = 36.0;
      car.speed = 36.0;
      car.vx = Math.sin(car.rotationY) * 36.0;
      car.vz = Math.cos(car.rotationY) * 36.0;
      car.vy = 6.5;
      car.isAirborne = true;
      car.pitch = 0.26;
      car.pitchAngle = 0.26;

      this.combatSystem.enterVehicle(car);
      this.vehicleSystem.enterVehicle(car, this.combatSystem.getPlayerState());
      car.y = 4.4;
      car.forwardSpeed = 36.0;
      car.speed = 36.0;
      car.isAirborne = true;
      car.pitch = 0.26;
      if (this.economySystem) {
        this.economySystem.tikiCollectedCount = Math.max(3, this.economySystem.tikiCollectedCount || 0);
      }
      this.vfxHud.spawnSparks(89.5, 1.8, -3.5, 22);
      this.vfxHud.callouts = [];
      this.vfxHud.addCallout('INSANE STUNT BONUS! +$2,000', 'OCEAN BEACH SEAWALL LAUNCH • 42M JUMP', '#ffd600');
      customCamFocus = { x: 91.0, y: 2.2, z: -3.5 };
      customCamPos = { x: 103.5, y: 24.5, z: 10.5 };
    } else if (p === 'suburban_neighborhood' || p === 'suburbs' || p === 'suburban') {
      // Procedural 1980s Florida Suburban Neighborhood (Palm Springs Suburbs):
      // Pastel single-family ranch homes on green lawns with pitched gable roofs, driveways, fences & pools!
      this.world.setTimeOfDay(15.6);
      this.world.setWeather('clear');
      this.vehicleSystem.clearWanted();

      if (!this.combatSystem.inVehicle && this.heroCar) {
        this.combatSystem.enterVehicle(this.heroCar);
        this.vehicleSystem.enterVehicle(this.heroCar, this.combatSystem.getPlayerState());
      }
      if (this.heroCar) {
        this.heroCar.x = -108.5;
        this.heroCar.y = 0.0;
        this.heroCar.z = -18.0;
        this.heroCar.rotationY = Math.PI * 0.92;
        this.heroCar.forwardSpeed = 16.0;
        this.heroCar.speed = 16.0;
        this.heroCar.vx = 0;
        this.heroCar.vz = 0;
      }
      this.vfxHud.showDistrictBanner('PALM SPRINGS SUBURBS');
      this.vfxHud.callouts = [];
      const seedNum = typeof this.world.getCitySeed === 'function' ? this.world.getCitySeed() : 1986;
      this.vfxHud.addCallout(
        `PALM SPRINGS SUBURBS • SEED #${seedNum}`,
        'PROCEDURAL 80S RANCH HOMES, LAWNS & POOLS • PRESS [N] TO RESEED MAP',
        '#2ee866'
      );
      customCamFocus = { x: -92.0, y: 1.5, z: -16.0 };
      customCamPos = { x: -116.0, y: 27.0, z: 6.0 };
    } else if (p === 'downtown_procedural' || p === 'downtown' || p === 'metropolis') {
      // Procedural Major City / Downtown Metropolis high-rise skyscraper district!
      this.world.setTimeOfDay(20.2);
      this.world.setWeather('clear');
      this.vehicleSystem.clearWanted();

      if (!this.combatSystem.inVehicle && this.heroCar) {
        this.combatSystem.enterVehicle(this.heroCar);
        this.vehicleSystem.enterVehicle(this.heroCar, this.combatSystem.getPlayerState());
      }
      if (this.heroCar) {
        this.heroCar.x = -115.0;
        this.heroCar.y = 0.0;
        this.heroCar.z = -42.0;
        this.heroCar.rotationY = Math.PI;
        this.heroCar.forwardSpeed = 20.0;
        this.heroCar.speed = 20.0;
        this.heroCar.vx = 0;
        this.heroCar.vz = 0;
      }
      this.vfxHud.showDistrictBanner('DOWNTOWN METROPOLIS');
      this.vfxHud.callouts = [];
      const seedNum = typeof this.world.getCitySeed === 'function' ? this.world.getCitySeed() : 1986;
      this.vfxHud.addCallout(
        `DOWNTOWN METROPOLIS • SEED #${seedNum}`,
        'PROCEDURAL HIGH-RISE ZIGGURAT & FINANCE TOWERS • PRESS [N] TO RESEED',
        '#00f0ff'
      );
      customCamFocus = { x: -134.0, y: 8.5, z: -42.0 };
      customCamPos = { x: -96.0, y: 34.0, z: -14.0 };
    }

    // Sync scene transforms with a tiny 2ms step and lock custom oblique camera framing if set
    this.step(0.002, false);
    const curVeh = this.combatSystem.getPlayerState()?.currentVehicle;
    if (curVeh && (p === 'seaplane_flight' || p === 'plane' || p === 'skimmer')) {
      curVeh.speed = 38.0;
      curVeh.forwardSpeed = 38.0;
    } else if (curVeh && (p === 'chopper_flight' || p === 'heli' || p === 'maverick')) {
      curVeh.speed = 28.0;
      curVeh.forwardSpeed = 28.0;
    } else if (curVeh && (p === 'stunt_jump' || p === 'stunt')) {
      curVeh.speed = 36.0;
      curVeh.forwardSpeed = 36.0;
      curVeh.y = 4.4;
      curVeh.isAirborne = true;
    }
    if (customCamFocus && customCamPos) {
      this.world.cameraFocus.set(customCamFocus.x, customCamFocus.y, customCamFocus.z);
      this.world.cameraCurrentPos.set(customCamPos.x, customCamPos.y, customCamPos.z);
      this.world.camera.position.set(customCamPos.x, customCamPos.y, customCamPos.z);
      this.world.camera.lookAt(customCamFocus.x, customCamFocus.y, customCamFocus.z);
    }
    if (this.vfxHud) {
      this.vfxHud.activeSubtitle = null;
      this.vfxHud.speechBubbles = p === 'ocean_cruise_carjack' || p === 'ocean_cruise' || p === 'carjack' ? this.vfxHud.speechBubbles : [];
    }
    this.step(0.002, true);
    if (curVeh && (p === 'seaplane_flight' || p === 'plane' || p === 'skimmer')) {
      curVeh.speed = 38.0;
      curVeh.forwardSpeed = 38.0;
      this.vfxHud.hudState.vehicleSpeed = 38.0;
      this.vfxHud._renderComicHud(this.vfxHud._lastGameState || {});
    } else if (curVeh && (p === 'chopper_flight' || p === 'heli' || p === 'maverick')) {
      curVeh.speed = 28.0;
      curVeh.forwardSpeed = 28.0;
      this.vfxHud.hudState.vehicleSpeed = 28.0;
      this.vfxHud._renderComicHud(this.vfxHud._lastGameState || {});
    }
    if (customCamFocus && customCamPos) {
      this.world.cameraFocus.set(customCamFocus.x, customCamFocus.y, customCamFocus.z);
      this.world.cameraCurrentPos.set(customCamPos.x, customCamPos.y, customCamPos.z);
      this.world.camera.position.set(customCamPos.x, customCamPos.y, customCamPos.z);
      this.world.camera.lookAt(customCamFocus.x, customCamFocus.y, customCamFocus.z);
      this.world.render();
    }

    if (p === 'minigame_hotwire' || p === 'hotwire') {
      const mg = this.economySystem.activeMiniGame;
      if (mg && mg.type === 'hotwire' && mg.data && mg.data.wires) {
        mg.stage = 2;
        mg.data.wires[0].progress = 0.68;
        mg.data.wires[1].progress = 0.32;
        this.economySystem._addSparks(350, 151, '#ff2a9d', 22);
        this.economySystem._addSparks(350, 241, '#00f6ff', 18);
        this.economySystem._syncMiniGameHeader();
        this.economySystem._renderMiniGameCanvas();
      }
    }
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.world.resize(window.innerWidth, window.innerHeight);
      if (this.isCaptureMode) {
        if (this.initialScenePreset) {
          this.applyScenePreset(this.initialScenePreset);
        } else {
          this.step(0.002, true);
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      const key = e.key;
      const wasDown = Boolean(this.keys[code]);
      this.keys[code] = true;
      this.keys[key] = true;

      // Toggle Debug Bar with Backquote (`)
      if (code === 'Backquote') {
        document.body.classList.toggle('vc-debug-mode');
        return;
      }

      // Pager / PDA Toggle (P)
      if (code === 'KeyP' && !wasDown) {
        this._clearAllKeys();
        this.economySystem.togglePDA();
        return;
      }

      // If a mini-game or PDA modal is open, let Escape close it or Space advance mini-game
      if (this.economySystem.isModalOpen()) {
        return;
      }

      if (code === 'Space' && !wasDown) {
        this.inputState.spaceJustPressed = true;
      }

      // Enter / Exit Vehicle, Aircraft, or Speedboat (F or Enter)
      if ((code === 'KeyF' || code === 'Enter') && !wasDown) {
        this._toggleEnterExitVehicle();
      }

      // Quick-Board / Summon Flyable Seaplane or Chopper (V)
      if (code === 'KeyV' && !wasDown) {
        this._quickBoardOrSummonAircraft();
      }

      // Regenerate Fresh Procedural City Layout (N)
      if (code === 'KeyN' && !wasDown) {
        this.regenerateProceduralCity();
      }

      // Contextual Interact (E): Gas Station Molotovs, Dumpster/Beach Stash, Dealer, Safehouse, Rampage
      if (code === 'KeyE' && !wasDown) {
        this.inputState.interact = true;
        this._handleContextualInteract();
      }

      // Throw Secondary (Molotov / Grenade) with G
      if (code === 'KeyG' && !wasDown) {
        this.combatSystem.throwSecondary();
      }

      // Switch Throwable Type (Molotov <-> Grenade) with B
      if (code === 'KeyB' && !wasDown) {
        const th = this.combatSystem.cycleThrowable();
        if (th) {
          this.vfxHud.addCallout(`EQUIPPED ${th.name.toUpperCase()}`, `COUNT: ${th.count}`, '#ffaa00');
        }
      }

      // Cycle Lock-On Target with Tab
      if (code === 'Tab' && !wasDown) {
        e.preventDefault();
        this.inputState.cycleTarget = true;
      }

      // Hold Q for Neon Radial Weapon Wheel
      if (code === 'KeyQ' && !wasDown) {
        this.vfxHud.hudState.weaponWheelOpen = true;
      }

      // Number Keys 1..9 select Weapons 0..8
      if (code.startsWith('Digit') && !wasDown) {
        const digit = parseInt(code.replace('Digit', ''), 10);
        if (digit >= 1 && digit <= 9) {
          this.combatSystem.selectWeapon(digit - 1);
        }
      }

      // Cycle Radio Station (R)
      if (code === 'KeyR' && !wasDown) {
        const station = this.vfxHud.cycleRadioStation();
        if (station) {
          this.vfxHud.addCallout(`♪ ${station.name}`, station.genre || 'ARGON RADIO', '#00f0ff');
          if (station.id === 'flash_fm') this.vfxHud.playVoice('dj_flash_intro');
          else if (station.id === 'wave_103') this.vfxHud.playVoice('dj_wave_intro');
        }
      }

      // Cycle Camera Angle (C)
      if (code === 'KeyC' && !wasDown) {
        const mode = this.world.cycleCameraMode();
        this.vfxHud.addCallout('CAMERA RIG', mode.toUpperCase().replace(/_/g, ' '), '#00f0ff');
      }

      // Cycle Time of Day (T)
      if (code === 'KeyT' && !wasDown) {
        const cur = this.world.getTimeOfDay();
        const next = cur < 10 ? 15.07 : cur < 17 ? 18.5 : 2.02;
        this.world.setTimeOfDay(next);
        const label = next < 6 ? 'NEON NIGHT 02:01' : next < 17 ? 'TROPICAL DAY 15:04' : 'ARGON SUNSET 18:30';
        this.vfxHud.addCallout(label, 'ATMOSPHERIC CYCLE', '#ff2a85');
      }

      // Toggle Outfit (O)
      if (code === 'KeyO' && !wasDown) {
        this.combatSystem.toggleOutfit();
        this.vfxHud.addCallout('OUTFIT SWAPPED', 'ARGON WARDROBE', '#00f0ff');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      this.keys[e.key] = false;
      if (e.code === 'KeyQ') {
        this.vfxHud.hudState.weaponWheelOpen = false;
      }
    });

    // Clear all held keys if the browser window loses focus or tab visibility changes
    window.addEventListener('blur', () => this._clearAllKeys());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._clearAllKeys();
    });

    // Mouse Aiming & Firing
    window.addEventListener('mousemove', (e) => {
      this.inputState.mouseX = e.clientX;
      this.inputState.mouseY = e.clientY;
      this._updateMouseWorldAim(e.clientX, e.clientY);
    });

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (this.economySystem.isModalOpen()) return;
      if (e.button === 0) {
        this.inputState.mouseDown = true;
        this.inputState.fire = true;
        this._updateMouseWorldAim(e.clientX, e.clientY);
      } else if (e.button === 2) {
        this.inputState.cycleTarget = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.inputState.mouseDown = false;
        this.inputState.fire = false;
      }
    });

    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener(
      'wheel',
      (e) => {
        if (this.economySystem.isModalOpen()) return;
        this.combatSystem.cycleWeapon(e.deltaY > 0 ? 1 : -1);
      },
      { passive: true }
    );

    // Clickable Contextual Prompt Banner
    if (this.contextPromptEl) {
      this.contextPromptEl.addEventListener('click', () => {
        if (this._pendingContextAction === 'vehicle') {
          this._toggleEnterExitVehicle();
        } else {
          this._handleContextualInteract();
        }
      });
    }

    // Debug Bar Buttons (when ?debug=1 or Backquote is active)
    if (this.debugBarEl) {
      this.debugBarEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const act = btn.getAttribute('data-action');
        if (act === 'time-day') this.applyScenePreset('ocean_day_takedown');
        else if (act === 'time-sunset') this.applyScenePreset('starfish_mansion');
        else if (act === 'time-night') this.applyScenePreset('ocean_night_chase');
        else if (act === 'wanted-up') {
          const cur = this.vehicleSystem.getWantedHUDState().stars;
          this.vehicleSystem.setWantedStars(Math.min(5, cur + 1));
        } else if (act === 'cop-takedown') {
          this.vehicleSystem.forceWreckNearestCop(this.combatSystem.getPlayerState());
        } else if (act === 'hotwire') {
          this.economySystem.startHotwireMiniGame(this.parkedExotic || this.heroCar);
        } else if (act === 'molotov') {
          this.economySystem.startMolotovMiniGame();
        } else if (act === 'dumpster') {
          this.economySystem.startStashMiniGame({ label: 'Ocean Alley Stash', type: 'dumpster' });
        } else if (act === 'pda') {
          this.economySystem.togglePDA();
        } else if (act === 'rampage') {
          this.economySystem.startRampage('neon_arcade_blitz');
        } else if (act === 'boat') {
          this.applyScenePreset('marina_speedboat');
        } else if (act === 'plane') {
          this.applyScenePreset('seaplane_flight');
        } else if (act === 'heli') {
          this.applyScenePreset('chopper_flight');
        } else if (act === 'stunt') {
          this.applyScenePreset('stunt_jump');
        } else if (act === 'suburbs') {
          this.applyScenePreset('suburban_neighborhood');
        } else if (act === 'reseed') {
          this.regenerateProceduralCity();
        }
      });
    }
  }

  _clearAllKeys() {
    for (const k of Object.keys(this.keys)) {
      this.keys[k] = false;
    }
    this.inputState.forward = false;
    this.inputState.backward = false;
    this.inputState.left = false;
    this.inputState.right = false;
    this.inputState.sprint = false;
    this.inputState.handbrake = false;
    this.inputState.descend = false;
    this.inputState.spaceJustPressed = false;
    this.inputState.mouseDown = false;
    this.inputState.fire = false;
    if (this.vfxHud?.hudState) {
      this.vfxHud.hudState.weaponWheelOpen = false;
    }
  }

  regenerateProceduralCity(customSeed) {
    if (typeof this.world?.regenerateProceduralCity !== 'function') return null;
    const nextSeed =
      typeof customSeed === 'number'
        ? customSeed
        : Math.floor(Math.random() * 900000) + 100000;
    const applied = this.world.regenerateProceduralCity(nextSeed);
    const seedNum = typeof applied === 'object' && applied !== null ? applied.seed : applied;
    this.vfxHud.addCallout(
      `NEW PROCEDURAL CITY! • SEED #${seedNum}`,
      'FRESH DOWNTOWN SKYSCRAPERS & SUBURBAN NEIGHBORHOODS GENERATED',
      '#2ee866'
    );
    this.vfxHud.playSFX('cash_pickup');
    return seedNum;
  }

  _quickBoardOrSummonAircraft() {
    const pState = this.combatSystem.getPlayerState();
    const allVehicles = this.vehicleSystem.getVehicles() || [];
    const prevVeh = pState.currentVehicle;
    const currentType = prevVeh?.type;
    // Alternate between Dodo Skimmer Seaplane and Argon Maverick Chopper when pressing [V]
    const desiredType = currentType === 'skimmer_plane' ? 'maverick_heli' : 'skimmer_plane';

    // Always default summoned aircraft heading to North (Math.PI, up-screen aligned with camera)
    const launchHeading = Math.PI;
    const spawnX = pState.x;
    const spawnZ = pState.z;

    if (pState.inVehicle) {
      this.combatSystem.exitVehicle();
      this.vehicleSystem.exitVehicle(this.combatSystem.getPlayerState());
      // Move any exited ground car 6m aside so it never collides with or blocks the aircraft!
      if (prevVeh && !prevVeh.isAircraft) {
        prevVeh.x += 6.0;
        prevVeh.vx = 0;
        prevVeh.vz = 0;
        prevVeh.speed = 0;
        prevVeh.forwardSpeed = 0;
        if (prevVeh.mesh) {
          prevVeh.mesh.position.set(prevVeh.x, prevVeh.y || 0, prevVeh.z);
        }
      }
    }

    let targetAircraft = allVehicles.find(
      (v) => v.type === desiredType && !v.isExploded && !v.isWrecked
    );
    if (!targetAircraft) {
      targetAircraft = this.vehicleSystem.spawnVehicle(
        desiredType,
        spawnX,
        spawnZ,
        launchHeading,
        { isParked: false }
      );
    } else {
      targetAircraft.x = spawnX;
      targetAircraft.z = spawnZ;
      targetAircraft.rotationY = launchHeading;
      targetAircraft.isParked = false;
    }

    // Start in a stable stationary hover above obstacles with ZERO auto-acceleration
    // so the aircraft only moves in the direction the player presses (WASD / Arrow keys)!
    targetAircraft.y = Math.max(14.0, (pState.y || 0) + 12.0);
    targetAircraft.forwardSpeed = 0;
    targetAircraft.speed = 0;
    targetAircraft.vx = 0;
    targetAircraft.vz = 0;
    targetAircraft.vy = 0;
    targetAircraft.pitchAngle = 0;
    targetAircraft.rollAngle = 0;
    targetAircraft.isAirborne = true;
    targetAircraft.isSinking = false;
    if (targetAircraft.mesh) {
      targetAircraft.mesh.position.set(targetAircraft.x, targetAircraft.y, targetAircraft.z);
    }

    this.combatSystem.enterVehicle(targetAircraft);
    this.vehicleSystem.enterVehicle(targetAircraft, this.combatSystem.getPlayerState());
    targetAircraft.y = Math.max(14.0, targetAircraft.y || 14.0);
    targetAircraft.forwardSpeed = 0;
    targetAircraft.speed = 0;
    targetAircraft.vx = 0;
    targetAircraft.vz = 0;
    targetAircraft.vy = 0;
    this._lastDrivenVehicle = targetAircraft;
    this.vfxHud.addCallout(
      `PILOTING ${targetAircraft.name.toUpperCase()}`,
      '[WASD] FLY DIRECTION • [SPACE] CLIMB • [SHIFT] DESCEND • [F] EXIT',
      '#00f0ff'
    );
  }

  _updateMouseWorldAim(clientX, clientY) {
    this._mouseNDC.x = (clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    this._mouseNDC.y = -(clientY / Math.max(1, window.innerHeight)) * 2 + 1;
    this._raycaster.setFromCamera(this._mouseNDC, this.world.camera);
    if (this._raycaster.ray.intersectPlane(this._groundPlane, this._aimHitPoint)) {
      this.inputState.aimWorldX = this._aimHitPoint.x;
      this.inputState.aimWorldZ = this._aimHitPoint.z;
    }
  }

  _toggleEnterExitVehicle() {
    const pState = this.combatSystem.getPlayerState();
    if (pState.inVehicle) {
      const exitedVeh = pState.currentVehicle;
      this._lastDrivenVehicle = exitedVeh;
      this._lastExitTime = performance.now();
      this.combatSystem.exitVehicle();
      this.vehicleSystem.exitVehicle(this.combatSystem.getPlayerState());
      this.vfxHud.addCallout('ON FOOT', 'PRESS [F] NEAR ANY CAR, BOAT, OR PLANE (OR [V] TO FLY)', '#00f0ff');
    } else {
      const recentlyExited =
        this._lastDrivenVehicle && performance.now() - (this._lastExitTime || 0) < 6000;
      // Prefer a new car/aircraft within 10.5m if we just hopped out of our previous ride
      const nearest =
        (recentlyExited &&
          this.vehicleSystem.findNearestInteractableVehicle(
            pState.x,
            pState.z,
            10.5,
            this._lastDrivenVehicle
          )) ||
        this.vehicleSystem.findNearestInteractableVehicle(pState.x, pState.z, 11.5);
      if (nearest) {
        const isNewHijack = nearest !== this._lastDrivenVehicle;
        const wasTraffic = Boolean(nearest.isTraffic && !nearest.isParked);
        this.combatSystem.enterVehicle(nearest);
        this.vehicleSystem.enterVehicle(nearest, this.combatSystem.getPlayerState());
        this._lastDrivenVehicle = nearest;
        if (nearest.isAircraft || nearest.type === 'skimmer_plane' || nearest.type === 'maverick_heli') {
          this.vfxHud.addCallout(
            `PILOTING ${nearest.name.toUpperCase()}`,
            '[WASD] FLY DIRECTION • [SPACE] CLIMB • [SHIFT] DESCEND • [F] EXIT',
            '#00f0ff'
          );
        } else if (nearest.isBoat) {
          this.vfxHud.addCallout(`BOARDED ${nearest.name.toUpperCase()}`, 'ARGON MARINE PATROL', '#00f0ff');
          this.vfxHud.playVoice('dispatch_boat');
        } else if (!nearest.requiresHotwire || nearest.isHotwired) {
          const actionVerb = wasTraffic ? 'CARJACKED' : 'DRIVING';
          const subLabel = wasTraffic ? 'DRIVER PULLED OUT ON OCEAN DRIVE' : 'OCEAN DRIVE CRUISING';
          this.vfxHud.addCallout(`${actionVerb} ${nearest.name.toUpperCase()}`, subLabel, '#ff2a85');
          if (isNewHijack) {
            this.vfxHud.playVoice('protag_carjack');
          }
        }
      } else {
        this.vfxHud.addCallout('NO VEHICLE IN RANGE', 'WALK TO ANY CAR/PLANE & PRESS [F] (OR PRESS [V] FOR AIRCRAFT)', '#ffd600');
      }
    }
  }

  _handleContextualInteract() {
    if (this.economySystem.nearbyContext) {
      this.economySystem._triggerNearbyContext();
      return;
    }
    // Check world interactables if player is near gas station / safehouse / dumpster / boat dock
    const pState = this.combatSystem.getPlayerState();
    const list = this.world.getInteractables() || [];
    for (const item of list) {
      const d = Math.hypot(pState.x - item.x, pState.z - item.z);
      if (d <= (item.radius || 5.0) + 2.0) {
        if (item.type === 'gas_station') {
          if (this.vehicleSystem.getWantedHUDState().stars > 0) {
            this.vehicleSystem.clearWanted('pay_n_spray');
            this.vfxHud.addCallout("ARGON GAS '86 RESPRAY!", 'HEAT CLEARED & RIDE REPAIRED', '#00f0ff');
          }
          this.economySystem.startMolotovMiniGame();
          return;
        } else if (item.type === 'safehouse') {
          if (this.vehicleSystem.getWantedHUDState().stars > 0) {
            this.vehicleSystem.clearWanted('safehouse');
          }
          this.economySystem.openPDA('stash');
          return;
        } else if (item.type === 'dumpster' || item.type === 'beach_stash') {
          this.economySystem.startStashMiniGame(item);
          return;
        } else if (item.type === 'rampage') {
          this.economySystem.startRampage(item.id || 'neon_arcade_blitz');
          return;
        } else if (item.type === 'dealer') {
          this.economySystem.openDealerTrade(item);
          return;
        } else if (item.type === 'boat_dock') {
          const boats = this.vehicleSystem.getVehicles().filter((v) => v.isBoat);
          if (boats.length > 0) {
            this.combatSystem.enterVehicle(boats[0]);
            this.vehicleSystem.enterVehicle(boats[0], this.combatSystem.getPlayerState());
            this.vfxHud.playVoice('dispatch_boat');
            return;
          }
        }
      }
    }
    // Otherwise, pressing E near a vehicle also enters / carjacks / exits it!
    this._toggleEnterExitVehicle();
  }

  _updateContextPrompt(playerState) {
    if (!this.contextPromptEl) return;
    if (this.economySystem.isModalOpen()) {
      this.contextPromptEl.classList.remove('visible');
      return;
    }

    if (!playerState.inVehicle) {
      const recentlyExited =
        this._lastDrivenVehicle && performance.now() - (this._lastExitTime || 0) < 6000;
      const nearCar =
        (recentlyExited &&
          this.vehicleSystem.findNearestInteractableVehicle(
            playerState.x,
            playerState.z,
            10.5,
            this._lastDrivenVehicle
          )) ||
        this.vehicleSystem.findNearestInteractableVehicle(playerState.x, playerState.z, 11.5);
      if (nearCar) {
        this._pendingContextAction = 'vehicle';
        const isAir =
          Boolean(nearCar.isAircraft) ||
          nearCar.type === 'skimmer_plane' ||
          nearCar.type === 'maverick_heli';
        const verb = isAir
          ? 'PILOT'
          : nearCar.isBoat
          ? 'BOARD'
          : nearCar.requiresHotwire && !nearCar.isHotwired
          ? 'HOTWIRE'
          : nearCar.isTraffic && !nearCar.isParked
          ? 'CARJACK'
          : 'ENTER';
        this.contextPromptEl.innerHTML = `<span class="key-badge">F</span> <span class="key-badge">E</span> ${verb} ${nearCar.name.toUpperCase()}`;
        this.contextPromptEl.classList.add('visible');
        return;
      }
    } else if (
      !playerState.currentVehicle?.isAirborne &&
      !playerState.currentVehicle?.isAircraft &&
      (playerState.y || 0) < 1.2 &&
      Math.abs(playerState.currentVehicle?.speed || playerState.currentVehicle?.forwardSpeed || 0) < 2.5 &&
      (this.vehicleSystem.getWantedHUDState?.().stars || 0) === 0
    ) {
      // While stopped or slow-cruising past a parked exotic/aircraft or stopped traffic car at 0 Stars, hint that [F] exits to jack/pilot it!
      const otherCar = this.vehicleSystem.findNearestInteractableVehicle(
        playerState.x,
        playerState.z,
        9.5,
        playerState.currentVehicle
      );
      if (otherCar && otherCar !== playerState.currentVehicle) {
        this._pendingContextAction = 'vehicle';
        const isAir =
          Boolean(otherCar.isAircraft) ||
          otherCar.type === 'skimmer_plane' ||
          otherCar.type === 'maverick_heli';
        const verb = isAir
          ? 'EXIT TO PILOT'
          : otherCar.requiresHotwire && !otherCar.isHotwired
          ? 'EXIT TO HOTWIRE'
          : 'EXIT TO CARJACK';
        this.contextPromptEl.innerHTML = `<span class="key-badge">F</span> ${verb} ${otherCar.name.toUpperCase()}`;
        this.contextPromptEl.classList.add('visible');
        return;
      }
    }

    this._pendingContextAction = null;
    this.contextPromptEl.classList.remove('visible');
  }

  _buildHudGameState(pState, wantedState, econState, isAircraft = false, activeVeh = null) {
    const veh = activeVeh || pState?.currentVehicle || null;
    const air =
      isAircraft ||
      Boolean(
        veh &&
          (veh.isAircraft || veh.type === 'skimmer_plane' || veh.type === 'maverick_heli')
      );
    return {
      playerState: pState,
      wantedState,
      economyState: econState,
      vehicles: this.vehicleSystem.getVehicles(),
      npcs: this.combatSystem.getNPCs(),
      interactables: this.economySystem.getInteractableMarkers(),
      activeChunks:
        typeof this.world.getActiveChunks === 'function' ? this.world.getActiveChunks() : [],
      timeOfDay: this.world.getTimeOfDay(),
      inVehicle: Boolean(pState?.inVehicle),
      inAircraft: air,
      currentVehicle: veh,
      vehicleSpeed: veh ? veh.speed || 0 : 0,
      isDrifting: Boolean(veh && veh.isDrifting),
      sirenActive: Boolean(wantedState?.stars > 0 && wantedState?.activeCopsCount > 0),
    };
  }

  update(dt = 0.016, renderFrame = true) {
    return this.step(dt, renderFrame);
  }

  step(dt = 0.016, renderFrame = true) {
    const safeDt = Math.min(0.05, Math.max(0.001, Number(dt) || 0.016));

    // Merge keyboard + virtual touch controls
    const touch = this.vfxHud.getTouchInput() || {};
    const modalOpen = this.economySystem.isModalOpen();

    this.inputState.forward = !modalOpen && Boolean(this.keys.KeyW || this.keys.ArrowUp || touch.moveY < -0.2);
    this.inputState.backward = !modalOpen && Boolean(this.keys.KeyS || this.keys.ArrowDown || touch.moveY > 0.2);
    this.inputState.left = !modalOpen && Boolean(this.keys.KeyA || this.keys.ArrowLeft || touch.moveX < -0.2);
    this.inputState.right = !modalOpen && Boolean(this.keys.KeyD || this.keys.ArrowRight || touch.moveX > 0.2);
    this.inputState.sprint = !modalOpen && Boolean(this.keys.ShiftLeft || this.keys.ShiftRight);
    this.inputState.handbrake = !modalOpen && Boolean(this.keys.Space || touch.drifting);
    this.inputState.fire = !modalOpen && Boolean(this.inputState.mouseDown || this.keys.KeyJ || touch.firing);

    // 1. Get current player state
    let playerState = this.combatSystem.getPlayerState();

    // 2. Update Vehicle Physics, Traffic, Aircraft Flight & ACPD Pursuit AI
    this.vehicleSystem.update(safeDt, playerState, modalOpen ? {} : this.inputState);

    // 3. Update Combat, Player Movement/Swimming, Weapons & District NPCs
    this.combatSystem.update(safeDt, modalOpen ? {} : this.inputState);
    playerState = this.combatSystem.getPlayerState();

    // Ensure playerState.y reflects vehicle/aircraft altitude when inside a vehicle or plane!
    const activeVeh = playerState.currentVehicle;
    if (activeVeh && typeof activeVeh.y === 'number') {
      playerState.y = activeVeh.y;
    }

    // 4. Apply Molotov Fire Grid damage to nearby NPCs & Vehicles
    const fireGrids = this.vfxHud.getActiveFireGrids();
    if (fireGrids && fireGrids.length > 0) {
      for (const fg of fireGrids) {
        this.combatSystem.applyExplosionDamageAt(fg.x, fg.z, fg.radius || 3.4, safeDt * 28.0, true);
      }
    }

    // 5. Update Mini-Games, 1986 Pager/PDA, Hidden Tiki Packages & Contraband Economy
    this.economySystem.update(safeDt, playerState, this.inputState);

    // 6. Update Contextual Prompt
    this._updateContextPrompt(playerState);

    // 7. Build Target State for Dynamic High-Angle Grand Theft Argon Camera & World Update
    const isAircraft = Boolean(
      activeVeh &&
        (activeVeh.isAircraft ||
          activeVeh.type === 'skimmer_plane' ||
          activeVeh.type === 'maverick_heli')
    );
    const targetState = {
      position: {
        x: playerState.x,
        y: activeVeh ? activeVeh.y || 0 : playerState.y || 0,
        z: playerState.z,
      },
      velocity: {
        x: activeVeh ? activeVeh.vx : playerState.vx || 0,
        y: activeVeh ? activeVeh.vy || 0 : 0,
        z: activeVeh ? activeVeh.vz : playerState.vz || 0,
      },
      heading: activeVeh ? activeVeh.rotationY : playerState.rotationY || 0,
      isCombat: Boolean(playerState.isCombat),
      isAircraft,
      driftFactor: activeVeh && activeVeh.isDrifting ? activeVeh.driftAngle || 0.35 : 0,
    };
    this.world.update(safeDt, targetState);

    // 7b. Trigger Chunk Discovery Callouts When Entering a New Outer Procedural Chunk
    const cx = Math.round(playerState.x / 120);
    const cz = Math.round(playerState.z / 120);
    const chunkKey = `${cx},${cz}`;
    if (chunkKey !== this._lastChunkKey) {
      this._lastChunkKey = chunkKey;
      if (Math.abs(cx) > 1 || Math.abs(cz) > 1) {
        const chunkObj = this.world.activeChunks?.get?.(chunkKey);
        const districtName =
          chunkObj?.biomeName ||
          chunkObj?.district ||
          chunkObj?.name ||
          (typeof this.world.getDistrictAt === 'function'
            ? this.world.getDistrictAt(playerState.x, playerState.z)
            : 'PROCEDURAL SECTOR');
        this.vfxHud.showDistrictBanner?.(`${districtName} (${cx}, ${cz})`);
        this.vfxHud.addCallout?.(
          `NEW PROCEDURAL CHUNK (${cx}, ${cz})`,
          `${districtName} • SEED ${this.world.getCitySeed?.() || 1986}`,
          '#00f0ff'
        );
      }
    }

    // 8. Update VFX, Grand Theft Argon Comic HUD & Spatial Audio Engine
    const wantedState = this.vehicleSystem.getWantedHUDState();
    const economyState = this.economySystem.getEconomyHUDState();
    const hudGameState = this._buildHudGameState(
      playerState,
      wantedState,
      economyState,
      isAircraft,
      activeVeh
    );

    if (renderFrame) {
      this.vfxHud.update(safeDt, hudGameState);
      this.world.render();
    }

    // Reset one-shot frame triggers
    this.inputState.spaceJustPressed = false;
    this.inputState.interact = false;
    this.inputState.cycleTarget = false;
    this.inputState.nextWeapon = false;
    this.inputState.prevWeapon = false;
  }

  _loop(timestamp) {
    const dt = Math.min(0.05, Math.max(0.001, (timestamp - this.lastFrameTime) * 0.001));
    this.lastFrameTime = timestamp;
    this.step(dt, true);
    this._rafId = requestAnimationFrame((ts) => this._loop(ts));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__VICE_CITY__ = new ViceCityChinatownEngine();
window.__GRAND_THEFT_ARGON__ = window.__VICE_CITY__;
});
