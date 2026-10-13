/**
 * Argon Towers (Grasslands) — 2.5D Three.js Master Game Engine Orchestrator (`src/main.js`)
 *
 * Connects:
 * 1. `ArgonTowersGrid` (`src/grid_pathfinding.js`)
 * 2. `TowerSystem` & `TOWER_DEFS` (`src/tower_system.js`)
 * 3. `EnemyWaveSystem`, `ENEMY_DEFS`, `WAVE_SCHEDULE` (`src/enemy_waves.js`)
 * 4. `ArgonTowersVisuals` (`src/visuals_vfx.js`)
 * 5. `ArgonTowersAudio` & `ArgonTowersHUD` (`src/audio_ui_hud.js`)
 */

const THREE = typeof window !== 'undefined' ? window.THREE : null;
const GRID_CONFIG = typeof window !== 'undefined' ? window.GRID_CONFIG : null;
const ArgonTowersGrid = typeof window !== 'undefined' ? window.ArgonTowersGrid : null;
const TOWER_DEFS = typeof window !== 'undefined' ? window.TOWER_DEFS : null;
const TowerInstance = typeof window !== 'undefined' ? window.TowerInstance : null;
const TowerSystem = typeof window !== 'undefined' ? window.TowerSystem : null;
const ENEMY_DEFS = typeof window !== 'undefined' ? window.ENEMY_DEFS : null;
const WAVE_SCHEDULE = typeof window !== 'undefined' ? window.WAVE_SCHEDULE : null;
const getWaveDefinition = typeof window !== 'undefined' ? window.getWaveDefinition : null;
const EnemyUnit = typeof window !== 'undefined' ? window.EnemyUnit : null;
const EnemyWaveSystem = typeof window !== 'undefined' ? window.EnemyWaveSystem : null;
const ArgonTowersVisuals = typeof window !== 'undefined' ? window.ArgonTowersVisuals : null;
const ArgonTowersAudio = typeof window !== 'undefined' ? window.ArgonTowersAudio : null;
const ArgonTowersHUD = typeof window !== 'undefined' ? window.ArgonTowersHUD : null;

class ArgonTowersEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.hudContainer = document.getElementById('hud-root');

    const params = new URLSearchParams(window.location.search || '');
    this.captureMode = params.get('capture') === '1';
    this.initialScenario = params.get('scenario') || '';
    this.initialView = params.get('view') || '';

    // Core Game State
    this.gold = 20; // Classic starting gold ($20) for initial open-field maze construction
    this.score = 0;
    this.lives = 20;
    this.round = 1;
    this.maxRounds = 100;
    this.paused = false;
    this.speed = 1;
    this.gameOver = false;
    this.victory = false;
    this.endlessMode = false;
    this.buildPhase = true;
    this.waveStartedOnce = false;

    this.selectedTowerType = null;
    this.selectedTower = null;
    this.showFlowField = false;

    this._elapsedTime = 0;
    this._lastFrameTime = performance.now();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._hitPoint = new THREE.Vector3();

    this._initThree();
    this._initSubsystems();
    this._bindCanvasControls();
    this._setupInitialState();

    // Expose deterministic API for Critic & automated testing
    window.__ARGON_TOWERS__ = this;
    window.argonTowersEngine = this;

    // Render initial frames immediately
    this.step(0.016, true);
    if (!this.captureMode) {
      this._rafId = requestAnimationFrame((t) => this._loop(t));
    }
  }

  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x234210);

    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    const aspect = w / Math.max(1, h);

    // High-angle 2.5D camera framing the 18x10 Grasslands field + borders like the reference screenshots
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 160);
    this._applyCameraFraming(this.initialView || 'overview', aspect);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (THREE.SRGBColorSpace !== undefined) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding !== undefined) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    // Warm sunlit Grasslands lighting (no dynamic PointLight allocations during combat)
    const hemiLight = new THREE.HemisphereLight(0xf6ffe0, 0x3b5c1e, 0.95);
    hemiLight.position.set(0, 35, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff6dc, 1.35);
    sunLight.position.set(-14, 34, 16);
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xaad8ff, 0.42);
    rimLight.position.set(18, 22, -14);
    this.scene.add(rimLight);

    window.addEventListener('resize', () => this._onResize());
  }

  _applyCameraFraming(viewMode = 'overview', aspect = window.innerWidth / Math.max(1, window.innerHeight)) {
    this.currentViewMode = viewMode;
    // Adjust vertical FOV if viewport is narrower than 16:9 so the 44-unit-wide battlefield never clips horizontally
    const refAspect = 16 / 9;
    const baseFov = viewMode === 'tesla_zoom' ? 28 : 40;
    if (aspect < refAspect) {
      const rad = (baseFov * Math.PI) / 180;
      const newRad = 2 * Math.atan(Math.tan(rad / 2) * (refAspect / Math.max(0.5, aspect)));
      this.camera.fov = Math.min(68, (newRad * 180) / Math.PI);
    } else {
      this.camera.fov = baseFov;
    }

    if (viewMode === 'tesla_zoom') {
      // Close-up framing matching ref_early_tesla_zoom.png (West entry + Tesla & Gatling maze cluster)
      this.camera.position.set(-5.0, 21.5, 7.6);
      this.camera.lookAt(-5.0, 0.0, 0.2);
    } else {
      // Full Grasslands battlefield 2.5D framing matching ref_paused_midgame.jpg & ref_round89_dense_maze.png
      this.camera.position.set(0.0, 33.2, 9.6);
      this.camera.lookAt(0.0, 0.0, 0.45);
    }
    this.camera.updateProjectionMatrix();
  }

  _onResize() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    this.camera.aspect = w / Math.max(1, h);
    this._applyCameraFraming(this.currentViewMode || 'overview', this.camera.aspect);
    this.renderer.setSize(w, h);
    if (this.hud) {
      this.hud.updateTowerRingPosition(this.camera);
    }
  }

  _initSubsystems() {
    // 1. Audio Engine (Lyria 3 + Gemini 3.8 Flash TTS + Positional Web Audio)
    this.audio = new ArgonTowersAudio();
    window.argonTowersAudio = this.audio;
    this.audio.preloadAll();

    // 2. 2.5D Hand-Painted Visuals & VFX Engine
    this.visuals = new ArgonTowersVisuals(this.scene, this.camera, this.renderer);
    this.visuals.buildEnvironment();

    // 3. 18x10 Open-Field Mazing Grid & Flow-Field Pathfinding
    this.grid = new ArgonTowersGrid(this.scene, this.camera, this.canvas, {
      onMazeChanged: () => {
        if (this.waveSystem) {
          this.waveSystem.rerouteAllGroundEnemies(this.grid);
        }
        const pathTiles = this.grid.getShortestMazeDistanceTiles();
        if (pathTiles >= 32 && this.hud) {
          this.hud.unlockAchievement(
            'master_mazer',
            'Master Mazer',
            `Engineered a winding ${Math.round(pathTiles)}-tile serpentine kill corridor!`
          );
        }
      },
    });

    // 4. Tower System (Gatling, Goo, Missile, Tesla)
    this.towerSystem = new TowerSystem({
      scene: this.scene,
      visuals: this.visuals,
      audio: this.audio,
    });

    // 5. Enemy Wave & AI System (Rounds 1..100+)
    this.waveSystem = new EnemyWaveSystem({
      scene: this.scene,
      grid: this.grid,
      visuals: this.visuals,
      audio: this.audio,
      autoStartNextWave: true,
      betweenWaveDelay: 7.5,
      callbacks: {
        onEnemyKilled: (enemy) => this._handleEnemyKilled(enemy),
        onEnemyLeak: (enemy, livesCost) => this._handleEnemyLeak(enemy, livesCost),
        onWaveStart: (roundNum, waveDef) => this._handleWaveStart(roundNum, waveDef),
        onWaveComplete: (roundNum, waveDef) => this._handleWaveComplete(roundNum, waveDef),
        onWarningBanner: (bannerText, waveDef) => {
          if (this.hud) {
            this.hud.showWaveBanner(
              waveDef.round,
              `ROUND ${waveDef.round}`,
              bannerText,
              Boolean(waveDef.isAirWave || waveDef.isBossWave)
            );
          }
        },
      },
    });

    // 6. Authentic Diegetic HUD
    this.hud = new ArgonTowersHUD({
      container: this.hudContainer,
      audio: this.audio,
      camera: this.camera,
      canvas: this.canvas,
      towerDefs: TOWER_DEFS,
      gold: this.gold,
      score: this.score,
      round: this.round,
      maxRounds: this.maxRounds,
      lives: this.lives,
      paused: this.paused,
      speed: this.speed,
      onTogglePause: (isPaused) => {
        if (this.buildPhase && !this.waveStartedOnce) {
          this.callNextWaveEarly();
          return;
        }
        this.paused = Boolean(isPaused);
        this.audio.setPaused(this.paused);
        this._syncHUD();
      },
      onSpeedChange: (newSpeed) => {
        this.speed = Number(newSpeed) || 1;
        this._syncHUD();
      },
      onNextWave: () => this.callNextWaveEarly(),
      onSelectTower: (towerType) => this.selectTowerToBuild(towerType),
      onCancelPlacement: () => this.cancelTowerPlacement(),
      onPlaceTowerAtScreen: (towerType, clientX, clientY) => {
        this.selectTowerToBuild(towerType);
        this._attemptPlaceAtClientPos(clientX, clientY, false);
      },
      onUpgradeTower: (tower) => this.upgradeSelectedTower(tower),
      onSellTower: (tower) => this.sellSelectedTower(tower),
      onCyclePriority: (tower) => this.cycleTowerPriority(tower),
      onLoadDemoMaze: () => this.buildSerpentineMaze('serpentine'),
      onJumpToRound: (roundNum) => this.jumpToRound(roundNum),
      onToggleFlowField: (enabled) => {
        this.showFlowField = Boolean(enabled);
        this.grid.setPlacementMode(this.showFlowField || this.buildPhase || Boolean(this.selectedTowerType));
      },
      onRestart: () => this.restartGame(),
      onContinueEndless: () => {
        this.victory = false;
        this.endlessMode = true;
        this.paused = false;
        this.waveSystem.startNextWave(this.grid);
        this._syncHUD();
      },
    });
  }

  _setupInitialState() {
    if (this.initialScenario) {
      this.loadScenario(this.initialScenario);
      return;
    }

    if (this.hud) this.hud.suppressTransientUI = true;
    // Start in Pre-Game Build Phase: open field, $20 starting gold, waiting for player to place towers & click START WAVE 1 ▶
    this.gold = 20;
    this.score = 0;
    this.lives = 20;
    this.round = 1;
    this.paused = false;
    this.buildPhase = true;
    this.waveStartedOnce = false;

    this.waveSystem.currentRound = 0;
    this.waveSystem.waveActive = false;
    this.waveSystem.betweenWaveTimer = 0;

    // Show subtle placement grid & path preview during initial build phase so the player can plan their maze
    this.grid.setPlacementMode(true);

    this._syncHUD();
    this.clearTransientUI();
    if (this.hud) {
      this.hud.suppressTransientUI = false;
      if (!this.captureMode) {
        this.hud.showWaveBanner(
          1,
          'BUILD PHASE — ROUND 1',
          'Place your starting towers ($20), then click "START WAVE 1 ▶"!',
          false
        );
      }
    }
  }

  // ============================================================================
  // INTERACTIVE POINTER / TOUCH / DRAG-AND-DROP CONTROLS
  // ============================================================================

  _raycastGround(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    this._ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const hit = this._raycaster.ray.intersectPlane(this._groundPlane, this._hitPoint);
    if (!hit) return null;
    return { x: this._hitPoint.x, z: this._hitPoint.z };
  }

  _bindCanvasControls() {
    // Unlock Web Audio on first user gesture
    const unlockAudioOnce = () => {
      this.audio.unlock();
      this.audio.startMusic(false);
    };
    window.addEventListener('pointerdown', unlockAudioOnce, { once: true });

    // Pointer move: update 3D tile hover preview during click-to-place OR drag-and-drop
    window.addEventListener('pointermove', (e) => {
      const activeType =
        this.selectedTowerType ||
        (this.hud && this.hud._dragState && this.hud._dragState.towerType) ||
        null;

      if (!activeType) return;

      const worldPt = this._raycastGround(e.clientX, e.clientY);
      if (!worldPt) {
        this.grid.hideHoverPreview();
        return;
      }

      const def = TOWER_DEFS[activeType] || TOWER_DEFS.gatling;
      const tier1Range = def.tiers[0].range;
      const activeGroundEnemies = this.waveSystem.enemies.filter(
        (en) => en && !en.isDead && !en.isAir
      );

      this.grid.updateHoverFromWorld(
        worldPt.x,
        worldPt.z,
        activeGroundEnemies,
        def.cost,
        this.gold,
        tier1Range,
        activeType
      );
    });

    // Canvas click: either place armed tower OR select/inspect an existing tower on the grid
    this.canvas.addEventListener('click', (e) => {
      if (this.gameOver) return;

      // Close gear popover if open
      if (this.hud && this.hud._gearMenuOpen) {
        this.hud._gearMenuOpen = false;
        this.hud.elGearPopover?.classList.remove('is-open');
      }

      if (this.selectedTowerType) {
        // Keep shift-click or affordable repeat placement ergonomic
        this._attemptPlaceAtClientPos(e.clientX, e.clientY, e.shiftKey);
        return;
      }

      // Check if player clicked an existing tower on the grid
      const worldPt = this._raycastGround(e.clientX, e.clientY);
      if (!worldPt) return;

      const g = this.grid.worldToGrid(worldPt.x, worldPt.z);
      if (g.inBounds) {
        const clickedTower = this.towerSystem.getTowerAt(g.col, g.row);
        if (clickedTower) {
          this.selectPlacedTower(clickedTower);
          return;
        }
      }

      // Clicked empty grass with no tower armed -> close radial ring
      this.clearSelectedTower();
    });
  }

  selectTowerToBuild(towerType) {
    if (!towerType) {
      this.cancelTowerPlacement();
      return;
    }
    const norm = String(towerType).toLowerCase();
    const def = TOWER_DEFS[norm];
    if (!def) return;

    this.clearSelectedTower();
    this.selectedTowerType = norm;
    this.grid.setPlacementMode(true, norm, def.tiers[0].range);
    this._syncHUD();
  }

  cancelTowerPlacement() {
    this.selectedTowerType = null;
    this.grid.setPlacementMode(this.showFlowField || this.buildPhase);
    this.grid.hideHoverPreview();
    if (this.hud && this.hud.state.selectedTowerType) {
      this.hud.state.selectedTowerType = null;
      this.hud._updateDockSelectionUI?.();
    }
    this._syncHUD();
  }

  selectPlacedTower(tower) {
    if (!tower) {
      this.clearSelectedTower();
      return;
    }
    this.cancelTowerPlacement();
    this.selectedTower = tower;
    this.audio.playButtonClick();
    this.grid.showRangeIndicator(tower.x, tower.z, tower.range, 0x5ce1ff);
    if (this.hud) {
      this.hud.openTowerRing(tower, this.camera);
    }
  }

  clearSelectedTower() {
    this.selectedTower = null;
    this.grid.hideRangeIndicator();
    if (this.hud) {
      this.hud.closeTowerRing();
    }
  }

  _attemptPlaceAtClientPos(clientX, clientY, keepArmed = false) {
    const towerType = this.selectedTowerType;
    if (!towerType) return false;

    const worldPt = this._raycastGround(clientX, clientY);
    if (!worldPt) return false;

    const g = this.grid.worldToGrid(worldPt.x, worldPt.z);
    const result = this.placeTower(towerType, g.col, g.row, false);

    if (result.success) {
      const def = TOWER_DEFS[towerType];
      // Disarm after single click unless Shift is held or player wants to chain-build with plenty of gold
      if (!keepArmed || this.gold < def.cost) {
        this.cancelTowerPlacement();
        if (this.hud) this.hud.cancelPlacement();
      }
      return true;
    }
    return false;
  }

  /**
   * Validates and places a tower at `(col, row)`.
   * Enforces strict anti-trap maze validation so enemies can never be sealed off!
   */
  placeTower(towerType, col, row, ignoreCost = false) {
    const norm = String(towerType || 'gatling').toLowerCase();
    const def = TOWER_DEFS[norm];
    if (!def) {
      return { success: false, reason: 'UNKNOWN_TYPE' };
    }

    const activeGroundEnemies = this.waveSystem.enemies.filter(
      (en) => en && !en.isDead && !en.isAir
    );
    const effectiveGold = ignoreCost ? Infinity : this.gold;
    const check = this.grid.validatePlacement(
      col,
      row,
      activeGroundEnemies,
      def.cost,
      effectiveGold
    );

    const worldPos = this.grid.gridToWorld(col, row);

    if (!check.valid) {
      this.grid.triggerInvalidFlash(col, row, check.reason);
      this.audio.playInvalidPlacement(worldPos.x);

      let msg = 'INVALID!';
      if (check.reason === 'PATH_BLOCKED') msg = 'PATH BLOCKED!';
      else if (check.reason === 'ENEMY_TRAPPED') msg = "CAN'T TRAP ENEMY!";
      else if (check.reason === 'ENEMY_ON_TILE') msg = 'ENEMY ON TILE!';
      else if (check.reason === 'TILE_OCCUPIED') msg = 'OCCUPIED!';
      else if (check.reason === 'INSUFFICIENT_GOLD') msg = `NEED $${def.cost}!`;

      this.visuals.spawnFloatingText(worldPos.x, 1.4, worldPos.z, msg, '#ff3b3b');
      return { success: false, reason: check.reason };
    }

    if (!ignoreCost) {
      this.gold -= def.cost;
    }

    const tower = this.towerSystem.createTower(norm, col, row, worldPos.x, worldPos.z);
    this.grid.placeTowerOnGrid(col, row, tower);

    if (!ignoreCost) {
      this.visuals.spawnFloatingText(worldPos.x, 1.5, worldPos.z, `-$${def.cost}`, '#ffd54f');
    }

    if (norm === 'tesla' && this.hud) {
      this.hud.unlockAchievement('high_voltage', 'High Voltage!', 'Deployed a 120,000-Volt Tesla Coil Spire!');
    }

    this._syncHUD();
    return { success: true, tower, previewPath: check.previewPath };
  }

  upgradeSelectedTower(towerArg = null) {
    const tower = towerArg || this.selectedTower;
    if (!tower) return { success: false, reason: 'NO_TOWER' };

    const cost = tower.getUpgradeCost();
    if (cost === null || tower.tier >= 3) {
      this.audio.playInvalidBuzz(tower.x);
      return { success: false, reason: 'MAX_TIER' };
    }
    if (this.gold < cost) {
      this.audio.playInvalidBuzz(tower.x);
      this.visuals.spawnFloatingText(tower.x, 1.6, tower.z, `NEED $${cost}!`, '#ff3b3b');
      return { success: false, reason: 'INSUFFICIENT_GOLD' };
    }

    this.gold -= cost;
    this.towerSystem.upgradeTower(tower.id);
    this.visuals.spawnFloatingText(tower.x, 1.8, tower.z, `TIER ${tower.tier}!`, '#69ff47');

    if (this.selectedTower && this.selectedTower.id === tower.id) {
      this.grid.showRangeIndicator(tower.x, tower.z, tower.range, 0x5ce1ff);
      if (this.hud) this.hud.openTowerRing(tower, this.camera);
    }

    if (tower.tier === 3 && this.hud) {
      this.hud.unlockAchievement('max_firepower', 'Maximum Overdrive', `Upgraded a ${tower.name} to Tier 3!`);
    }

    this._syncHUD();
    return { success: true, tower };
  }

  sellSelectedTower(towerArg = null) {
    const tower = towerArg || this.selectedTower;
    if (!tower) return { success: false, reason: 'NO_TOWER' };

    const refund = tower.getSellValue();
    const { col, row, x, z } = tower;

    this.towerSystem.sellTower(tower.id);
    this.grid.removeTowerFromGrid(col, row);
    this.gold += refund;

    this.visuals.spawnFloatingText(x, 1.6, z, `+$${refund}`, '#ffd740');
    this.clearSelectedTower();
    this._syncHUD();

    return { success: true, refund };
  }

  cycleTowerPriority(towerArg = null) {
    const tower = towerArg || this.selectedTower;
    if (!tower) return null;
    const nextPriority = tower.cyclePriority(1);
    if (this.hud && this.selectedTower && this.selectedTower.id === tower.id) {
      this.hud.openTowerRing(tower, this.camera);
    }
    return nextPriority;
  }

  // ============================================================================
  // WAVE & COMBAT EVENT HANDLERS
  // ============================================================================

  _handleEnemyKilled(enemy) {
    if (!enemy || enemy._bountyAwarded) return;
    enemy._bountyAwarded = true;

    const bounty = Number(enemy.bounty) || 1;
    const pts = Number(enemy.score) || 50;
    this.gold += bounty;
    this.score += pts;

    if (this.waveSystem.stats.totalKilled === 1 && this.hud) {
      this.hud.unlockAchievement('first_blood', 'First Blood!', 'Eliminated the first invading unit!');
    }
    if (enemy.isAir && this.hud) {
      this.hud.unlockAchievement('sky_shredder', 'Sky Shredder!', 'Shot down an enemy aircraft bypassing the maze!');
    }
    if (enemy.type === 'zeppelin' && this.hud) {
      this.hud.unlockAchievement('blimp_buster', 'Dreadnought Down!', 'Destroyed a Boss Dreadnought Zeppelin!');
    }

    if (this.selectedTower && this.hud) {
      this.hud.openTowerRing(this.selectedTower, this.camera);
    }
    this._syncHUD();
  }

  _handleEnemyLeak(enemy, livesCost = 1) {
    if (this.gameOver) return;
    const cost = Math.max(1, Number(livesCost) || 1);
    this.lives = Math.max(0, this.lives - cost);
    this.visuals.spawnFloatingText(17.5, 1.8, enemy ? enemy.z : 0, `-${cost} ❤`, '#ff2e38');
    this._syncHUD();

    if (this.lives <= 0) {
      this.gameOver = true;
      this.paused = true;
      if (this.hud) {
        this.hud.showGameOverModal(
          {
            round: this.round,
            score: this.score,
            kills: this.waveSystem.stats.totalKilled,
            towers: this.towerSystem.towers.length,
          },
          () => this.restartGame()
        );
      }
    }
  }

  _handleWaveStart(roundNum, waveDef) {
    this.round = roundNum;
    this.buildPhase = false;
    this.waveStartedOnce = true;
    this.grid.setPlacementMode(this.showFlowField || Boolean(this.selectedTowerType));

    if (this.hud) {
      const sub = waveDef.warningBanner || waveDef.title || `Wave ${roundNum} Deployed`;
      this.hud.showWaveBanner(
        roundNum,
        `ROUND ${roundNum}`,
        sub,
        Boolean(waveDef.isAirWave || waveDef.isBossWave)
      );
    }
    this._syncHUD();
  }

  _handleWaveComplete(roundNum, waveDef) {
    const clearGold = waveDef?.clearBonusGold || (2 + Math.floor(roundNum * 0.45));
    const clearScore = waveDef?.clearBonusScore || (100 + roundNum * 35);
    this.gold += clearGold;
    this.score += clearScore;

    this.visuals.spawnFloatingText(0, 2.2, 0, `WAVE CLEAR! +$${clearGold}`, '#69ff47');

    if (roundNum >= this.maxRounds && !this.endlessMode && !this.victory) {
      this.victory = true;
      this.paused = true;
      this.audio.playVictoryFanfare();
      if (this.hud) {
        this.hud.unlockAchievement('century_commander', 'Grasslands Legend!', 'Conquered all 100 Rounds of Argon Towers!');
        this.hud.showVictoryModal(
          {
            round: roundNum,
            score: this.score,
            kills: this.waveSystem.stats.totalKilled,
            towers: this.towerSystem.towers.length,
          },
          () => {
            this.victory = false;
            this.endlessMode = true;
            this.paused = false;
            this.waveSystem.startNextWave(this.grid);
            this._syncHUD();
          },
          () => this.restartGame()
        );
      }
    }
    this._syncHUD();
  }

  callNextWaveEarly() {
    if (this.gameOver) return;
    if (this.buildPhase || !this.waveStartedOnce) {
      this.buildPhase = false;
      this.waveStartedOnce = true;
      this.paused = false;
      this.grid.setPlacementMode(this.showFlowField || Boolean(this.selectedTowerType));
      this.waveSystem.startWave(1, this.grid);
      this._syncHUD();
      return;
    }

    if (!this.waveSystem.waveActive) {
      this.gold += 5;
      this.score += 75;
      this.visuals.spawnFloatingText(-15.5, 1.8, 0, 'EARLY CALL +$5!', '#ffd740');
      this.waveSystem.startNextWave(this.grid);
      this._syncHUD();
    } else if (this.waveSystem.spawnQueue.length > 0) {
      // Flush remaining spawns faster and grant +$5 bravery bonus
      for (let i = 0; i < this.waveSystem.spawnQueue.length; i++) {
        this.waveSystem.spawnQueue[i].time = Math.min(
          this.waveSystem.spawnQueue[i].time,
          this.waveSystem.waveTimer + i * 0.42
        );
      }
      this.gold += 5;
      this.visuals.spawnFloatingText(-15.5, 1.8, 0, 'RUSH BONUS +$5!', '#ffd740');
      this._syncHUD();
    }
  }

  // ============================================================================
  // PRESET MAZES, SCENARIOS & TELEMETRY (FOR PLAYER & CRITIC LOOP)
  // ============================================================================

  buildSerpentineMaze(presetName = 'serpentine') {
    this.clearSelectedTower();
    this.cancelTowerPlacement();

    const prevSuppress = this.hud ? Boolean(this.hud.suppressTransientUI) : false;
    if (this.hud) this.hud.suppressTransientUI = true;

    // Clear existing towers and refund
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        if (this.grid.cells[r][c]) {
          this.grid.removeTowerFromGrid(c, r);
        }
      }
    }
    this.towerSystem.clearAll();

    const presetTiles = this.grid.getSerpentinePresetTiles(presetName);
    for (let i = 0; i < presetTiles.length; i++) {
      const item = presetTiles[i];
      this.placeTower(item.type || 'gatling', item.col, item.row, true);
      if (item.tier && item.tier > 1) {
        const t = this.towerSystem.getTowerAt(item.col, item.row);
        if (t) {
          while (t.tier < item.tier) {
            this.towerSystem.upgradeTower(t.id);
          }
        }
      }
    }

    this.waveSystem.rerouteAllGroundEnemies(this.grid);
    this._syncHUD();
    if (this.hud) this.hud.suppressTransientUI = prevSuppress;
    return {
      towersPlaced: this.towerSystem.towers.length,
      shortestMazeTiles: this.grid.getShortestMazeDistanceTiles(),
    };
  }

  clearTransientUI(resetAchievements = false) {
    if (this.hud && typeof this.hud.clearTransientUI === 'function') {
      this.hud.clearTransientUI(resetAchievements);
    }
    if (this.visuals && typeof this.visuals.clearFloatingTexts === 'function') {
      this.visuals.clearFloatingTexts();
    }
  }

  jumpToRound(roundNum) {
    const r = Math.max(1, Math.floor(Number(roundNum) || 1));
    this.round = r;
    this.buildPhase = false;
    this.waveStartedOnce = true;
    this.gameOver = false;
    this.victory = false;
    this.paused = false;

    if (this.hud) this.hud.suppressTransientUI = true;
    // Give appropriate gold & maze if jumping to mid/late rounds
    if (r >= 80 && this.towerSystem.towers.length < 15) {
      this.buildSerpentineMaze('serpentine');
      this.gold = 156;
      this.score = 210075;
      // Upgrade a rich mix of towers to Tier 2 & Tier 3
      this.towerSystem.towers.forEach((t, idx) => {
        if (idx % 2 === 0) this.towerSystem.upgradeTower(t.id);
        if (idx % 3 === 0) this.towerSystem.upgradeTower(t.id);
      });
    } else if (r >= 16 && this.towerSystem.towers.length < 8) {
      this.buildSerpentineMaze('serpentine');
      this.gold = 95;
      this.score = 31275;
    }

    this.grid.setPlacementMode(this.showFlowField || Boolean(this.selectedTowerType));
    this.waveSystem.jumpToRound(r, this.grid);
    this.waveSystem.spawnInstantTestWave({ round: r, grid: this.grid });
    this._syncHUD();
    this.clearTransientUI();
    if (this.hud) this.hud.suppressTransientUI = false;
  }

  loadScenario(name) {
    const key = String(name || '').toLowerCase();
    if (this.hud) this.hud.suppressTransientUI = true;
    this.clearTransientUI(true);
    this.clearSelectedTower();
    this.cancelTowerPlacement();
    this.waveSystem.clearAllEnemies();
    this.buildPhase = false;
    this.waveStartedOnce = true;

    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        if (this.grid.cells[r][c]) {
          this.grid.removeTowerFromGrid(c, r);
        }
      }
    }
    this.towerSystem.clearAll();
    this.grid.setPlacementMode(this.showFlowField);
    this._applyCameraFraming('overview');

    if (key === 'round89_dense_maze' || key === 'dense_maze') {
      // Mirrors ref_round89_dense_maze.png: sprawling multi-row serpentine maze of Gatling, Goo, Missile, and Tesla towers at Round 89
      this.buildSerpentineMaze('serpentine');
      this.towerSystem.towers.forEach((t, idx) => {
        if (idx % 2 === 0) this.towerSystem.upgradeTower(t.id);
        if (idx % 4 === 0) this.towerSystem.upgradeTower(t.id);
      });
      this.gold = 156;
      this.score = 210075;
      this.lives = 18;
      this.round = 89;
      this.waveSystem.currentRound = 89;
      this.waveSystem.spawnInstantTestWave({
        grid: this.grid,
        enemies: [
          { type: 'mech', pathFraction: 0.24, hpMultiplier: 3.5 },
          { type: 'transport', pathFraction: 0.34, hpMultiplier: 3.0 },
          { type: 'biker', pathFraction: 0.42, hpMultiplier: 2.5 },
          { type: 'grunt', pathFraction: 0.48, hpMultiplier: 2.5 },
          { type: 'grunt', pathFraction: 0.52, hpMultiplier: 2.5 },
          { type: 'mech', pathFraction: 0.60, hpMultiplier: 3.5 },
          { type: 'chopper', x: -3.5, z: -2.2, hpMultiplier: 2.5 },
          { type: 'zeppelin', x: 1.5, z: 1.0, hpMultiplier: 3.0, isBoss: true },
        ],
      });
      // Advance simulation 1.2s so missiles, slime streams, Tesla arcs, and explosions are active in frame!
      for (let i = 0; i < 24; i++) this.step(0.05, false);
    } else if (key === 'round16_air_blitz' || key === 'air_raid') {
      // Highlights Air Units (Choppers + Zeppelin) flying straight across and bypassing the ground maze with crisp drop shadows
      this.buildSerpentineMaze('serpentine');
      this.gold = 85;
      this.score = 42800;
      this.lives = 19;
      this.round = 16;
      this.waveSystem.currentRound = 16;
      this.waveSystem.spawnInstantTestWave({
        grid: this.grid,
        enemies: [
          { type: 'chopper', x: -10.5, z: -4.2, hpMultiplier: 12.0 },
          { type: 'chopper', x: -6.2, z: -2.0, hpMultiplier: 12.0 },
          { type: 'chopper', x: -1.8, z: 2.6, hpMultiplier: 12.0 },
          { type: 'chopper', x: 2.4, z: 4.8, hpMultiplier: 12.0 },
          { type: 'zeppelin', x: -3.8, z: 0.2, hpMultiplier: 8.0, isBoss: true },
          { type: 'biker', pathFraction: 0.35, hpMultiplier: 8.0 },
          { type: 'grunt', pathFraction: 0.45, hpMultiplier: 8.0 },
          { type: 'transport', pathFraction: 0.25, hpMultiplier: 8.0 },
        ],
      });
      for (let i = 0; i < 12; i++) this.step(0.05, false);
    } else if (key === 'tesla_zoom' || key === 'early_tesla') {
      // Mirrors ref_early_tesla_zoom.png: close-up of West entry with Tesla spires arcing blue-white lightning into red Grunts
      this._applyCameraFraming('tesla_zoom');
      const cluster = [
        { type: 'gatling', col: 1, row: 3, tier: 2 },
        { type: 'tesla', col: 2, row: 3, tier: 2 },
        { type: 'tesla', col: 3, row: 4, tier: 3 },
        { type: 'gatling', col: 1, row: 6, tier: 2 },
        { type: 'gatling', col: 2, row: 5, tier: 2 },
        { type: 'tesla', col: 4, row: 5, tier: 2 },
        { type: 'gatling', col: 3, row: 7, tier: 2 },
        { type: 'goo', col: 4, row: 7, tier: 2 },
        { type: 'missile', col: 5, row: 3, tier: 2 },
        { type: 'gatling', col: 6, row: 4, tier: 1 },
        { type: 'goo', col: 7, row: 4, tier: 2 },
        { type: 'gatling', col: 8, row: 4, tier: 1 },
      ];
      for (const item of cluster) {
        this.placeTower(item.type, item.col, item.row, true);
        const t = this.towerSystem.getTowerAt(item.col, item.row);
        if (t && item.tier) {
          while (t.tier < item.tier) this.towerSystem.upgradeTower(t.id);
        }
      }
      this.gold = 309;
      this.score = 10820;
      this.lives = 20;
      this.round = 14;
      this.waveSystem.currentRound = 14;
      this.waveSystem.spawnInstantTestWave({
        grid: this.grid,
        enemies: [
          { type: 'grunt', x: -15.2, z: -0.6, hpMultiplier: 40.0 },
          { type: 'grunt', x: -13.6, z: 0.4, hpMultiplier: 40.0 },
          { type: 'grunt', x: -12.1, z: -1.1, hpMultiplier: 40.0 },
          { type: 'grunt', x: -10.8, z: 0.8, hpMultiplier: 40.0 },
          { type: 'grunt', x: -9.4, z: -0.3, hpMultiplier: 40.0 },
          { type: 'biker', x: -8.0, z: 0.6, hpMultiplier: 40.0 },
        ],
      });
      // Ready Tesla cooldowns right before final step so branching lightning arcs are visibly mid-discharge!
      for (let i = 0; i < 6; i++) this.step(0.04, false);
      this.towerSystem.towers.forEach((t) => {
        if (t.type === 'tesla') t.cooldown = 0;
      });
      this.step(0.02, false);
    } else if (key === 'midgame_maze' || key === 'paused_midgame') {
      // Mirrors ref_paused_midgame.jpg: diagonal chevron maze in center-left with Bikers & Grunts + Radial Upgrade Ring open
      const diagMaze = [
        { type: 'gatling', col: 2, row: 5, tier: 2 },
        { type: 'gatling', col: 3, row: 6, tier: 2 },
        { type: 'gatling', col: 3, row: 7, tier: 3 },
        { type: 'gatling', col: 4, row: 7, tier: 2 },
        { type: 'gatling', col: 5, row: 8, tier: 2 },
        { type: 'goo', col: 6, row: 7, tier: 2 },
        { type: 'goo', col: 6, row: 6, tier: 2 },
        { type: 'goo', col: 5, row: 4, tier: 2 },
        { type: 'gatling', col: 6, row: 4, tier: 3 },
        { type: 'goo', col: 6, row: 3, tier: 2 },
        { type: 'gatling', col: 7, row: 2, tier: 3 },
        { type: 'goo', col: 8, row: 1, tier: 2 },
        { type: 'gatling', col: 9, row: 1, tier: 2 },
        { type: 'gatling', col: 10, row: 0, tier: 1 },
        { type: 'gatling', col: 8, row: 5, tier: 2 },
        { type: 'goo', col: 8, row: 6, tier: 2 },
        { type: 'gatling', col: 9, row: 4, tier: 2 },
        { type: 'goo', col: 9, row: 5, tier: 2 },
        { type: 'gatling', col: 10, row: 3, tier: 2 },
        { type: 'goo', col: 10, row: 4, tier: 2 },
        { type: 'missile', col: 12, row: 6, tier: 2 },
        { type: 'missile', col: 13, row: 6, tier: 2 },
        { type: 'missile', col: 12, row: 8, tier: 2 },
        { type: 'missile', col: 13, row: 8, tier: 2 },
        { type: 'goo', col: 14, row: 4, tier: 2 },
        { type: 'gatling', col: 15, row: 5, tier: 2 },
        { type: 'gatling', col: 15, row: 6, tier: 2 },
        { type: 'gatling', col: 16, row: 4, tier: 1 },
      ];
      for (const item of diagMaze) {
        this.placeTower(item.type, item.col, item.row, true);
        const t = this.towerSystem.getTowerAt(item.col, item.row);
        if (t && item.tier) {
          while (t.tier < item.tier) this.towerSystem.upgradeTower(t.id);
        }
      }
      this.gold = 59;
      this.score = 31275;
      this.lives = 19;
      this.round = 22;
      this.waveSystem.currentRound = 22;
      this.waveSystem.spawnInstantTestWave({
        grid: this.grid,
        enemies: [
          { type: 'biker', pathFraction: 0.22, hpMultiplier: 2.2 },
          { type: 'biker', pathFraction: 0.28, hpMultiplier: 2.2 },
          { type: 'grunt', pathFraction: 0.34, hpMultiplier: 2.2 },
          { type: 'biker', pathFraction: 0.41, hpMultiplier: 2.2 },
          { type: 'grunt', pathFraction: 0.48, hpMultiplier: 2.2 },
          { type: 'biker', pathFraction: 0.56, hpMultiplier: 2.2 },
          { type: 'biker', pathFraction: 0.64, hpMultiplier: 2.2 },
          { type: 'biker', pathFraction: 0.72, hpMultiplier: 2.2 },
        ],
      });
      for (let i = 0; i < 16; i++) this.step(0.05, false);
    }

    this._syncHUD();
    this.clearTransientUI();
    if (this.hud) this.hud.suppressTransientUI = false;
    this.step(0.016, true);
  }

  restartGame() {
    if (this.hud) this.hud.suppressTransientUI = true;
    this.clearTransientUI(true);
    this.clearSelectedTower();
    this.cancelTowerPlacement();
    this.waveSystem.reset();

    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        if (this.grid.cells[r][c]) {
          this.grid.removeTowerFromGrid(c, r);
        }
      }
    }
    this.towerSystem.clearAll();
    this.showFlowField = false;

    this.gold = 20;
    this.score = 0;
    this.lives = 20;
    this.round = 1;
    this.buildPhase = true;
    this.waveStartedOnce = false;
    this.paused = false;
    this.speed = 1;
    this.gameOver = false;
    this.victory = false;
    this.endlessMode = false;

    this._setupInitialState();
    this.clearTransientUI();
    if (this.hud) this.hud.suppressTransientUI = false;
  }

  _syncHUD() {
    if (!this.hud) return;
    const totalWaveUnits = this.waveSystem.currentWaveDef?.totalUnits || 10;
    const remainingSpawns = this.waveSystem.spawnQueue.length;
    const activeCount = this.waveSystem.enemies.length;
    const progress = Math.max(
      0,
      Math.min(1, 1 - (remainingSpawns + activeCount * 0.5) / Math.max(1, totalWaveUnits))
    );

    this.hud.update({
      gold: this.gold,
      score: this.score,
      round: this.round,
      maxRounds: this.maxRounds,
      lives: this.lives,
      paused: this.paused,
      speed: this.speed,
      waveActive: this.waveSystem.waveActive,
      waveCooldown: this.waveSystem.betweenWaveTimer,
      waveProgress: progress,
      buildPhase: this.buildPhase,
      waveStartedOnce: this.waveStartedOnce,
      showFlowField: this.showFlowField,
      selectedTowerType: this.selectedTowerType,
      selectedTower: this.selectedTower,
    });
  }

  // ============================================================================
  // DETERMINISTIC SIMULATION STEP & RENDER LOOP
  // ============================================================================

  step(dt = 0.016, renderFrame = true) {
    const clampedDt = Math.min(0.1, Math.max(0.001, Number(dt) || 0.016));

    if (!this.paused && !this.gameOver) {
      const subSteps = Math.max(1, Math.min(4, Math.round(this.speed)));
      const stepDt = clampedDt;

      for (let s = 0; s < subSteps; s++) {
        this._elapsedTime += stepDt;
        this.waveSystem.update(stepDt, this.grid, this.visuals, this.audio);
        this.towerSystem.update(
          stepDt,
          this.waveSystem.enemies,
          this.visuals,
          this.audio,
          (killedEnemy) => this._handleEnemyKilled(killedEnemy)
        );
        this.visuals.updateVFX(stepDt, this._elapsedTime);
        this.grid.update(stepDt, this._elapsedTime);
      }
    } else {
      this._elapsedTime += clampedDt;
      this.grid.update(clampedDt, this._elapsedTime);
    }

    if (this.hud && this.selectedTower) {
      this.hud.updateTowerRingPosition(this.camera);
    }
    this._syncHUD();

    if (renderFrame && this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this._lastFrameTime) * 0.001));
    this._lastFrameTime = now;
    this.step(dt, true);
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  getTelemetry() {
    return {
      gold: this.gold,
      score: this.score,
      lives: this.lives,
      round: this.round,
      paused: this.paused,
      speed: this.speed,
      towersCount: this.towerSystem.towers.length,
      activeEnemiesCount: this.waveSystem.enemies.length,
      activeAirEnemies: this.waveSystem.enemies.filter((e) => e.isAir && !e.isDead).length,
      activeGroundEnemies: this.waveSystem.enemies.filter((e) => !e.isAir && !e.isDead).length,
      shortestMazeTiles: this.grid.getShortestMazeDistanceTiles(),
      totalSpawned: this.waveSystem.stats.totalSpawned,
      totalKilled: this.waveSystem.stats.totalKilled,
      totalLeaked: this.waveSystem.stats.totalLeaked,
      waveScheduleCount: WAVE_SCHEDULE.length,
      towerTypesAvailable: Object.keys(TOWER_DEFS),
      enemyTypesAvailable: Object.keys(ENEMY_DEFS),
    };
  }
}

if (typeof window !== 'undefined') {
  window.ArgonTowersEngine = ArgonTowersEngine;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ArgonTowersEngine());
  } else {
    new ArgonTowersEngine();
  }
}

export { ArgonTowersEngine };
export default ArgonTowersEngine;
