/**
 * Argon Towers (Grasslands) 2.5D Three.js Engine
 * Module: Grid System, Dynamic Mazing Engine, Flow Field & A* Pathfinding
 *
 * Implements the 18x10 open-field mazing grid, 8-directional corner-safe
 * Dijkstra flow field, smoothed world-space waypoint extraction with >=1.05u
 * tower clearance, strict anti-trap placement validation, and Three.js visual
 * helpers (grid lines, hover preview with ghost turret & range rings, and
 * animated route preview breadcrumbs).
 */

const GRID_CONFIG = {
  COLS: 18,
  ROWS: 10,
  TILE_SIZE: 2.0,
  HALF_TILE: 1.0,
  WORLD_WIDTH: 36.0,
  WORLD_HEIGHT: 20.0,
  MIN_X: -18.0,
  MAX_X: 18.0,
  MIN_Z: -10.0,
  MAX_Z: 10.0,
  ORIGIN_X: -18.0,
  ORIGIN_Z: -10.0,

  // West Entry Portal: virtual col = -1, rows = [4, 5], world spawn (-19.5, 0.0)
  VIRTUAL_ENTRY_COL: -1,
  ENTRY_COL: 0,
  ENTRY_ROWS: [4, 5],
  ENTRY_MOUTHS: [
    { col: 0, row: 4 },
    { col: 0, row: 5 },
  ],
  ENTRY_WORLD: { x: -19.5, z: 0.0 },
  SPAWN_X: -19.5,
  SPAWN_Z: 0.0,
  ENTRY_X: -19.5,
  ENTRY_Z: 0.0,

  // East Exit Portal: virtual col = 18, rows = [4, 5], world goal (+19.5, 0.0)
  VIRTUAL_EXIT_COL: 18,
  EXIT_COL: 17,
  EXIT_ROWS: [4, 5],
  EXIT_MOUTHS: [
    { col: 17, row: 4 },
    { col: 17, row: 5 },
  ],
  EXIT_WORLD: { x: 19.5, z: 0.0 },
  GOAL_X: 19.5,
  GOAL_Z: 0.0,
  EXIT_X: 19.5,
  EXIT_Z: 0.0,

  // Clearance & validation constants
  MIN_TOWER_CLEARANCE: 1.05,
  SAFE_WAYPOINT_CLEARANCE: 1.26,
  ENEMY_TILE_BLOCK_RADIUS: 0.85,

  // Visual palette
  VALID_COLOR_HEX: 0x3aff5c,
  INVALID_COLOR_HEX: 0xff2e38,
  ROUTE_COLOR_HEX: 0xa8ff47,
  ROUTE_PREVIEW_HEX: 0x4dff88,
};

// 8-directional neighbor offsets: cardinals first, then diagonals
const DIRS_8 = [
  { dc: 1, dr: 0, cost: 1.0, diagonal: false },
  { dc: -1, dr: 0, cost: 1.0, diagonal: false },
  { dc: 0, dr: 1, cost: 1.0, diagonal: false },
  { dc: 0, dr: -1, cost: 1.0, diagonal: false },
  { dc: 1, dr: 1, cost: Math.SQRT2, diagonal: true },
  { dc: 1, dr: -1, cost: Math.SQRT2, diagonal: true },
  { dc: -1, dr: 1, cost: Math.SQRT2, diagonal: true },
  { dc: -1, dr: -1, cost: Math.SQRT2, diagonal: true },
];

class ArgonTowersGrid {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {HTMLElement} domElement
   * @param {Object} callbacks - e.g. { onMazeChanged: () => {} }
   */
  constructor(scene, camera, domElement, callbacks = {}) {
    this.scene = scene || null;
    this.camera = camera || null;
    this.domElement = domElement || null;
    this.callbacks = callbacks || {};

    this.config = GRID_CONFIG;
    this.cols = GRID_CONFIG.COLS;
    this.rows = GRID_CONFIG.ROWS;
    this.tileSize = GRID_CONFIG.TILE_SIZE;

    // 2D grid state [row][col]
    this.cells = [];
    this.distField = [];
    this.nextStep = [];
    this.flowDir = [];

    for (let r = 0; r < this.rows; r++) {
      this.cells[r] = new Array(this.cols).fill(null);
      this.distField[r] = new Array(this.cols).fill(Infinity);
      this.nextStep[r] = new Array(this.cols).fill(null);
      this.flowDir[r] = new Array(this.cols).fill(null);
    }

    this.mainPathWaypoints = [];
    this.shortestMazeTileCount = this.cols;

    // Interaction & preview states
    this.placementActive = false;
    this.currentGridOpacity = 0.07;
    this.hoveredTile = { col: -1, row: -1, inBounds: false, wx: 0, wz: 0 };
    this.previewState = {
      active: false,
      col: -1,
      row: -1,
      valid: true,
      reason: 'OK',
      range: 6.0,
      towerType: 'gatling',
      previewPath: null,
    };

    this.invalidFlash = {
      active: false,
      timer: 0,
      duration: 0.5,
      col: -1,
      row: -1,
      reason: '',
    };

    // Three.js visual helper groups
    this.gridLinesGroup = null;
    this.hoverPreviewGroup = null;
    this.routePreviewGroup = null;
    this.invalidFlashGroup = null;
    this.selectedRangeGroup = null;

    this._gridLineMaterials = [];
    this._routeBreadcrumbs = [];
    this._routeCurvePoints = [];
    this._routeCumulativeLengths = [];
    this._routeTotalLength = 0;
    this._routeLine = null;
    this._routeLineMat = null;

    if (typeof window !== 'undefined' && window.THREE && this.scene) {
      this._initThreeVisualGroups();
    }

    this.recomputeFlowField();
    this.updateRoutePreviewVisual();
  }

  // ===========================================================================
  // Coordinate Conversions & Basic Queries
  // ===========================================================================

  /**
   * Maps world (wx, wz) to grid (col, row) and inBounds flag.
   */
  worldToGrid(wx, wz) {
    const col = Math.floor((wx - GRID_CONFIG.ORIGIN_X) / GRID_CONFIG.TILE_SIZE);
    const row = Math.floor((wz - GRID_CONFIG.ORIGIN_Z) / GRID_CONFIG.TILE_SIZE);
    const inBounds =
      col >= 0 && col < GRID_CONFIG.COLS && row >= 0 && row < GRID_CONFIG.ROWS;
    return { col, row, inBounds };
  }

  /**
   * Maps grid (col, row) to world center { x, z, wx, wz }.
   */
  gridToWorld(col, row) {
    const x = GRID_CONFIG.ORIGIN_X + (col + 0.5) * GRID_CONFIG.TILE_SIZE;
    const z = GRID_CONFIG.ORIGIN_Z + (row + 0.5) * GRID_CONFIG.TILE_SIZE;
    return { x, z, wx: x, wz: z };
  }

  /**
   * Checks if (col, row) is within the 18x10 grid bounds.
   */
  isInBounds(col, row) {
    return (
      col >= 0 && col < GRID_CONFIG.COLS && row >= 0 && row < GRID_CONFIG.ROWS
    );
  }

  /**
   * Returns true if (col, row) is inside the 18x10 grid and unoccupied.
   */
  isBuildable(col, row) {
    return this.isInBounds(col, row) && !this.cells[row][col];
  }

  /**
   * Returns true if (col, row) is inside the 18x10 grid and occupied by a tower.
   */
  isOccupied(col, row) {
    return this.isInBounds(col, row) && Boolean(this.cells[row][col]);
  }

  /**
   * Returns the cell object at (col, row), or null if empty / out of bounds.
   */
  getCell(col, row) {
    if (!this.isInBounds(col, row)) return null;
    return this.cells[row][col];
  }

  /**
   * Returns the tower instance at (col, row), or null.
   */
  getTowerAt(col, row) {
    const cell = this.getCell(col, row);
    if (!cell) return null;
    return cell.tower || cell;
  }

  /**
   * Raycasts normalized device coordinates or screen coordinates against the Y=0 ground plane.
   */
  screenToWorld(clientX, clientY) {
    if (!this.camera || !this.domElement || typeof window === 'undefined' || !window.THREE) {
      return null;
    }
    const THREE = window.THREE;
    const rect = this.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    if (!this._raycaster) {
      this._raycaster = new THREE.Raycaster();
      this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      this._rayTarget = new THREE.Vector3();
    }

    this._raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hit = this._raycaster.ray.intersectPlane(this._groundPlane, this._rayTarget);
    if (!hit) return null;
    const g = this.worldToGrid(hit.x, hit.z);
    return {
      x: hit.x,
      z: hit.z,
      wx: hit.x,
      wz: hit.z,
      col: g.col,
      row: g.row,
      inBounds: g.inBounds,
    };
  }

  // ===========================================================================
  // Real-Time Flow Field & 8-Directional Corner-Safe Pathfinding
  // ===========================================================================

  /**
   * Internal helper to check walkability given an optional blockedOverride.
   */
  _isTileWalkable(col, row, blockedOverride = null) {
    if (!this.isInBounds(col, row)) return false;
    if (this.cells[row][col]) return false;
    if (blockedOverride) {
      if (Array.isArray(blockedOverride)) {
        for (let i = 0; i < blockedOverride.length; i++) {
          if (blockedOverride[i].col === col && blockedOverride[i].row === row) {
            return false;
          }
        }
      } else if (blockedOverride.col === col && blockedOverride.row === row) {
        return false;
      }
    }
    return true;
  }

  /**
   * Computes an 8-directional corner-safe Dijkstra flow field from East Exit
   * mouths (17, 4) and (17, 5) without mutating this.distField if dryRun=true.
   */
  _computeFlowData(blockedOverride = null) {
    const cols = this.cols;
    const rows = this.rows;

    const dist = [];
    const nextStep = [];
    const flowDir = [];

    for (let r = 0; r < rows; r++) {
      dist[r] = new Array(cols).fill(Infinity);
      nextStep[r] = new Array(cols).fill(null);
      flowDir[r] = new Array(cols).fill({ dx: 1, dz: 0, dCol: 1, dRow: 0 });
    }

    // Priority queue (min-heap or sorted open list; 180 nodes max so binary heap / simple min scan is sub-0.05ms)
    const open = [];
    const pushNode = (col, row, d) => {
      open.push({ col, row, d });
    };

    // Seed exit mouth tiles (17, 4) and (17, 5)
    for (let i = 0; i < GRID_CONFIG.EXIT_MOUTHS.length; i++) {
      const mouth = GRID_CONFIG.EXIT_MOUTHS[i];
      if (this._isTileWalkable(mouth.col, mouth.row, blockedOverride)) {
        dist[mouth.row][mouth.col] = 1.0;
        nextStep[mouth.row][mouth.col] = {
          col: GRID_CONFIG.VIRTUAL_EXIT_COL,
          row: mouth.row,
          wx: GRID_CONFIG.EXIT_WORLD.x,
          wz: GRID_CONFIG.EXIT_WORLD.z,
        };
        const mouthWorld = this.gridToWorld(mouth.col, mouth.row);
        const vx = GRID_CONFIG.EXIT_WORLD.x - mouthWorld.x;
        const vz = GRID_CONFIG.EXIT_WORLD.z - mouthWorld.z;
        const vLen = Math.hypot(vx, vz) || 1;
        flowDir[mouth.row][mouth.col] = {
          dx: vx / vLen,
          dz: vz / vLen,
          dCol: 1,
          dRow: 0,
        };
        pushNode(mouth.col, mouth.row, 1.0);
      }
    }

    while (open.length > 0) {
      // Pop minimum distance node
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].d < open[bestIdx].d) {
          bestIdx = i;
        }
      }
      const curr = open[bestIdx];
      open[bestIdx] = open[open.length - 1];
      open.pop();

      const c = curr.col;
      const r = curr.row;
      if (curr.d > dist[r][c] + 1e-6) continue;

      const currWorld = this.gridToWorld(c, r);

      for (let i = 0; i < DIRS_8.length; i++) {
        const dir = DIRS_8[i];
        const nc = c + dir.dc;
        const nr = r + dir.dr;

        if (!this._isTileWalkable(nc, nr, blockedOverride)) continue;

        // Strict corner-cut prevention: diagonal step allowed ONLY if both cardinal neighbors are walkable
        if (dir.diagonal) {
          if (
            !this._isTileWalkable(c + dir.dc, r, blockedOverride) ||
            !this._isTileWalkable(c, r + dir.dr, blockedOverride)
          ) {
            continue;
          }
        }

        // Slight centerline bias (1e-4) keeps paths balanced and clean on open ground
        const centerBias = Math.abs(nr - 4.5) * 1e-4;
        const candDist = dist[r][c] + dir.cost + centerBias;

        if (candDist + 1e-6 < dist[nr][nc]) {
          dist[nr][nc] = candDist;
          nextStep[nr][nc] = {
            col: c,
            row: r,
            wx: currWorld.x,
            wz: currWorld.z,
          };
          const nWorld = this.gridToWorld(nc, nr);
          const vx = currWorld.x - nWorld.x;
          const vz = currWorld.z - nWorld.z;
          const vLen = Math.hypot(vx, vz) || 1;
          flowDir[nr][nc] = {
            dx: vx / vLen,
            dz: vz / vLen,
            dCol: c - nc,
            dRow: r - nr,
          };
          pushNode(nc, nr, candDist);
        }
      }
    }

    return { dist, nextStep, flowDir };
  }

  /**
   * Recomputes the live flow field across all 18x10 tiles and updates
   * this.distField, this.nextStep, this.flowDir, and this.mainPathWaypoints.
   */
  recomputeFlowField(blockedOverride = null) {
    const { dist, nextStep, flowDir } = this._computeFlowData(blockedOverride);

    if (!blockedOverride) {
      this.distField = dist;
      this.nextStep = nextStep;
      this.flowDir = flowDir;

      const mainRoute = this._traceEntryToExitWaypoints(dist, nextStep, null);
      this.mainPathWaypoints = mainRoute.waypoints;
      this.shortestMazeTileCount = mainRoute.tileCount;
    }

    const reachable =
      dist[4][0] < Infinity || dist[5][0] < Infinity;

    return {
      distField: dist,
      nextStep,
      flowDir,
      mainPathWaypoints: this.mainPathWaypoints,
      reachable,
    };
  }

  /**
   * Traces discrete tile chain from a starting (col, row) to East Exit using nextStep.
   */
  _traceTileChain(startCol, startRow, dist, nextStep) {
    const tiles = [];
    if (!this.isInBounds(startCol, startRow)) return tiles;
    if (dist[startRow][startCol] === Infinity) return tiles;

    let c = startCol;
    let r = startRow;
    const visited = new Set();
    const maxSteps = this.cols * this.rows + 4;

    while (c >= 0 && c < this.cols && r >= 0 && r < this.rows && tiles.length < maxSteps) {
      const key = r * this.cols + c;
      if (visited.has(key)) break;
      visited.add(key);

      const w = this.gridToWorld(c, r);
      tiles.push({ col: c, row: r, x: w.x, z: w.z });

      const step = nextStep[r][c];
      if (!step) break;
      if (step.col >= this.cols) {
        // Reached virtual exit portal
        break;
      }
      c = step.col;
      r = step.row;
    }

    return tiles;
  }

  /**
   * Enforces >= 1.05 world unit clearance from all blocked tower centers and
   * applies corner beveling at 90-degree turns so creeps move naturally.
   */
  _smoothAndEnforceClearance(rawPoints, blockedOverride = null) {
    if (rawPoints.length <= 2) return rawPoints;

    // Collect all blocked tile centers
    const blockedCenters = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this._isTileWalkable(c, r, blockedOverride)) {
          const w = this.gridToWorld(c, r);
          blockedCenters.push({ col: c, row: r, x: w.x, z: w.z });
        }
      }
    }

    // Corner rounding at interior turn vertices
    const smoothed = [rawPoints[0]];
    for (let i = 1; i < rawPoints.length - 1; i++) {
      const prev = rawPoints[i - 1];
      const curr = rawPoints[i];
      const next = rawPoints[i + 1];

      const v1x = curr.x - prev.x;
      const v1z = curr.z - prev.z;
      const v2x = next.x - curr.x;
      const v2z = next.z - curr.z;

      const len1 = Math.hypot(v1x, v1z) || 1;
      const len2 = Math.hypot(v2x, v2z) || 1;
      const dot = (v1x * v2x + v1z * v2z) / (len1 * len2);

      // If there is a significant turn (dot < 0.92), round the corner gently
      if (dot < 0.92) {
        const pBefore = {
          x: curr.x - (v1x / len1) * Math.min(0.42, len1 * 0.25),
          z: curr.z - (v1z / len1) * Math.min(0.42, len1 * 0.25),
          col: curr.col,
          row: curr.row,
        };
        const pMid = {
          x: curr.x * 0.72 + (prev.x + next.x) * 0.14,
          z: curr.z * 0.72 + (prev.z + next.z) * 0.14,
          col: curr.col,
          row: curr.row,
        };
        const pAfter = {
          x: curr.x + (v2x / len2) * Math.min(0.42, len2 * 0.25),
          z: curr.z + (v2z / len2) * Math.min(0.42, len2 * 0.25),
          col: curr.col,
          row: curr.row,
        };
        smoothed.push(pBefore, pMid, pAfter);
      } else {
        smoothed.push({ ...curr });
      }
    }
    smoothed.push(rawPoints[rawPoints.length - 1]);

    // Strict clearance pass: push any waypoint within SAFE_WAYPOINT_CLEARANCE (1.26 > 1.05)
    // radially outward from any blocked tower center
    const minClearance = GRID_CONFIG.SAFE_WAYPOINT_CLEARANCE;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < smoothed.length - 1; i++) {
        const wp = smoothed[i];
        for (let b = 0; b < blockedCenters.length; b++) {
          const bc = blockedCenters[b];
          const dx = wp.x - bc.x;
          const dz = wp.z - bc.z;
          const d = Math.hypot(dx, dz);
          if (d < minClearance) {
            if (d > 1e-5) {
              wp.x = bc.x + (dx / d) * minClearance;
              wp.z = bc.z + (dz / d) * minClearance;
            } else {
              wp.x = bc.x + minClearance;
            }
          }
        }
        // Keep interior waypoints within playable Z bounds
        wp.z = Math.max(GRID_CONFIG.MIN_Z + 0.6, Math.min(GRID_CONFIG.MAX_Z - 0.6, wp.z));
      }
    }

    return smoothed;
  }

  /**
   * Traces the shortest path from West Entry (-19.5, 0) through (0, 4..5)
   * to (17, 4..5) and East Exit (+19.5, 0).
   */
  _traceEntryToExitWaypoints(dist, nextStep, blockedOverride = null) {
    // Choose best entry mouth between (0, 4) and (0, 5)
    let bestRow = -1;
    let bestDist = Infinity;
    for (let i = 0; i < GRID_CONFIG.ENTRY_MOUTHS.length; i++) {
      const m = GRID_CONFIG.ENTRY_MOUTHS[i];
      if (this._isTileWalkable(m.col, m.row, blockedOverride)) {
        const d = dist[m.row][m.col];
        if (d < bestDist) {
          bestDist = d;
          bestRow = m.row;
        }
      }
    }

    if (bestRow === -1 || bestDist === Infinity) {
      return { waypoints: [], tileCount: Infinity };
    }

    const tileChain = this._traceTileChain(0, bestRow, dist, nextStep);
    if (tileChain.length === 0) {
      return { waypoints: [], tileCount: Infinity };
    }

    const lastTile = tileChain[tileChain.length - 1];
    const rawPoints = [
      {
        x: GRID_CONFIG.ENTRY_WORLD.x,
        z: GRID_CONFIG.ENTRY_WORLD.z,
        col: GRID_CONFIG.VIRTUAL_ENTRY_COL,
        row: bestRow,
      },
      ...tileChain,
      {
        x: GRID_CONFIG.EXIT_WORLD.x,
        z: GRID_CONFIG.EXIT_WORLD.z,
        col: GRID_CONFIG.VIRTUAL_EXIT_COL,
        row: lastTile.row,
      },
    ];

    const waypoints = this._smoothAndEnforceClearance(rawPoints, blockedOverride);
    return {
      waypoints,
      tileCount: tileChain.length,
    };
  }

  /**
   * Given any ground unit's current (wx, wz), finds its current (col, row)
   * (or nearest walkable neighbor if on the boundary of a newly placed tower)
   * and traces the optimal sequence of world waypoints [{ x, z, col, row }, ...]
   * to East Exit (+19.5, 0.0).
   */
  computePathFromWorld(wx, wz) {
    // Already at or past East border
    if (wx >= GRID_CONFIG.MAX_X) {
      return [
        {
          x: GRID_CONFIG.EXIT_WORLD.x,
          z: GRID_CONFIG.EXIT_WORLD.z,
          col: GRID_CONFIG.VIRTUAL_EXIT_COL,
          row: 4,
        },
      ];
    }

    // Still in West Entry Portal before entering col 0
    if (wx < GRID_CONFIG.MIN_X) {
      if (this.mainPathWaypoints && this.mainPathWaypoints.length > 1) {
        return this.mainPathWaypoints.slice(1).map((wp) => ({ ...wp }));
      }
    }

    const g = this.worldToGrid(wx, wz);
    let startCol = Math.max(0, Math.min(this.cols - 1, g.col));
    let startRow = Math.max(0, Math.min(this.rows - 1, g.row));

    // If current tile is blocked or unreachable, pick nearest reachable neighbor
    if (
      !this._isTileWalkable(startCol, startRow) ||
      this.distField[startRow][startCol] === Infinity
    ) {
      let bestCol = -1;
      let bestRow = -1;
      let bestScore = Infinity;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nc = startCol + dc;
          const nr = startRow + dr;
          if (!this._isTileWalkable(nc, nr)) continue;
          const dField = this.distField[nr][nc];
          if (dField === Infinity) continue;

          const nw = this.gridToWorld(nc, nr);
          const dWorld = Math.hypot(wx - nw.x, wz - nw.z);
          const score = dWorld * 2.0 + dField;
          if (score < bestScore) {
            bestScore = score;
            bestCol = nc;
            bestRow = nr;
          }
        }
      }

      // Fallback full-grid search if 3x3 neighborhood had no walkable reachable tile
      if (bestCol === -1) {
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            if (!this._isTileWalkable(c, r) || this.distField[r][c] === Infinity) {
              continue;
            }
            const nw = this.gridToWorld(c, r);
            const dWorld = Math.hypot(wx - nw.x, wz - nw.z);
            if (dWorld < bestScore) {
              bestScore = dWorld;
              bestCol = c;
              bestRow = r;
            }
          }
        }
      }

      if (bestCol !== -1) {
        startCol = bestCol;
        startRow = bestRow;
      }
    }

    const tileChain = this._traceTileChain(
      startCol,
      startRow,
      this.distField,
      this.nextStep
    );

    if (tileChain.length === 0) {
      return [
        {
          x: GRID_CONFIG.EXIT_WORLD.x,
          z: GRID_CONFIG.EXIT_WORLD.z,
          col: GRID_CONFIG.VIRTUAL_EXIT_COL,
          row: 4,
        },
      ];
    }

    // If the unit has already passed the center of tileChain[0] toward tileChain[1],
    // avoid backtracking to tileChain[0] center
    if (tileChain.length >= 2) {
      const t0 = tileChain[0];
      const t1 = tileChain[1];
      const segX = t1.x - t0.x;
      const segZ = t1.z - t0.z;
      const toUnitX = wx - t0.x;
      const toUnitZ = wz - t0.z;
      if (segX * toUnitX + segZ * toUnitZ > 0.15) {
        tileChain.shift();
      }
    }

    const lastTile = tileChain[tileChain.length - 1];
    const rawPoints = [
      ...tileChain,
      {
        x: GRID_CONFIG.EXIT_WORLD.x,
        z: GRID_CONFIG.EXIT_WORLD.z,
        col: GRID_CONFIG.VIRTUAL_EXIT_COL,
        row: lastTile ? lastTile.row : 4,
      },
    ];

    return this._smoothAndEnforceClearance(rawPoints, null);
  }

  /**
   * Returns flow vector and distance at world (wx, wz).
   */
  getFlowDirectionAtWorld(wx, wz) {
    const g = this.worldToGrid(wx, wz);
    if (!g.inBounds) {
      return { dx: 1, dz: 0, dist: 1 };
    }
    const dir = this.flowDir[g.row][g.col] || { dx: 1, dz: 0 };
    return {
      dx: dir.dx,
      dz: dir.dz,
      dist: this.distField[g.row][g.col],
      nextStep: this.nextStep[g.row][g.col],
    };
  }

  /**
   * Returns the number of discrete tiles along the current shortest entry-to-exit path.
   */
  getShortestMazeDistanceTiles() {
    return this.shortestMazeTileCount;
  }

  /**
   * Returns the current main path waypoints array.
   */
  getMainPathWaypoints() {
    return this.mainPathWaypoints;
  }

  // ===========================================================================
  // Strict Anti-Trap / Maze Validation & Tower Placement Mutation
  // ===========================================================================

  /**
   * Helper to extract enemy world position and check if it's an active ground unit.
   */
  _inspectEnemy(e) {
    if (!e) return { activeGround: false, x: 0, z: 0 };
    if (e.dead || e.isDead || e.reachedExit || e.active === false) {
      return { activeGround: false, x: 0, z: 0 };
    }
    if (typeof e.hp === 'number' && e.hp <= 0) {
      return { activeGround: false, x: 0, z: 0 };
    }
    if (
      e.isAir ||
      e.flying ||
      e.isFlying ||
      e.moveType === 'air' ||
      e.type === 'helicopter' ||
      e.type === 'blimp' ||
      e.type === 'air'
    ) {
      return { activeGround: false, x: 0, z: 0 };
    }

    const x =
      e.x ??
      e.wx ??
      e.position?.x ??
      e.mesh?.position?.x ??
      e.group?.position?.x ??
      0;
    const z =
      e.z ??
      e.wz ??
      e.position?.z ??
      e.mesh?.position?.z ??
      e.group?.position?.z ??
      0;

    return { activeGround: true, x, z };
  }

  /**
   * Strictly validates whether a tower can be placed at (col, row):
   * 1. OUT_OF_BOUNDS
   * 2. TILE_OCCUPIED
   * 3. ENEMY_ON_TILE (within 0.85u of tile center)
   * 4. PATH_BLOCKED (at least one entry mouth (0, 4..5) must reach exit (17, 4..5))
   * 5. ENEMY_TRAPPED (every active ground enemy must still have a valid route to exit)
   * 6. INSUFFICIENT_GOLD
   * 7. OK
   */
  validatePlacement(
    col,
    row,
    activeGroundEnemies = [],
    towerCost = 0,
    currentGold = Infinity
  ) {
    // 1. Bounds check
    if (!this.isInBounds(col, row)) {
      return { valid: false, reason: 'OUT_OF_BOUNDS', previewPath: [] };
    }

    // 2. Occupancy check
    if (this.cells[row][col]) {
      return { valid: false, reason: 'TILE_OCCUPIED', previewPath: [] };
    }

    const tileCenter = this.gridToWorld(col, row);

    // 3. Check if any active ground enemy is physically centered inside (col, row) within 0.85u
    const enemies = Array.isArray(activeGroundEnemies) ? activeGroundEnemies : [];
    for (let i = 0; i < enemies.length; i++) {
      const info = this._inspectEnemy(enemies[i]);
      if (!info.activeGround) continue;
      const distToTileCenter = Math.hypot(
        info.x - tileCenter.x,
        info.z - tileCenter.z
      );
      if (distToTileCenter <= GRID_CONFIG.ENEMY_TILE_BLOCK_RADIUS) {
        return { valid: false, reason: 'ENEMY_ON_TILE', previewPath: [] };
      }
    }

    // 4. Temporarily mark (col, row) as blocked and run Dijkstra from Exit (17, 4..5)
    const blockedOverride = { col, row };
    const { dist, nextStep } = this._computeFlowData(blockedOverride);

    const mouth4Open =
      this._isTileWalkable(0, 4, blockedOverride) && dist[4][0] < Infinity;
    const mouth5Open =
      this._isTileWalkable(0, 5, blockedOverride) && dist[5][0] < Infinity;

    if (!mouth4Open && !mouth5Open) {
      return { valid: false, reason: 'PATH_BLOCKED', previewPath: [] };
    }

    // 5. Check that EVERY active ground enemy has a reachable path to Exit
    for (let i = 0; i < enemies.length; i++) {
      const info = this._inspectEnemy(enemies[i]);
      if (!info.activeGround) continue;

      // Units not yet inside grid (West portal) are safe since mouth4Open || mouth5Open is true
      if (info.x < GRID_CONFIG.MIN_X || info.x >= GRID_CONFIG.MAX_X) {
        continue;
      }

      const eg = this.worldToGrid(info.x, info.z);
      const ec = Math.max(0, Math.min(this.cols - 1, eg.col));
      const er = Math.max(0, Math.min(this.rows - 1, eg.row));

      let canReach =
        this._isTileWalkable(ec, er, blockedOverride) && dist[er][ec] < Infinity;

      // If enemy is near a tile border, check its immediate cardinal walkable neighbors
      if (!canReach) {
        for (let d = 0; d < 4; d++) {
          const nc = ec + DIRS_8[d].dc;
          const nr = er + DIRS_8[d].dr;
          if (
            this._isTileWalkable(nc, nr, blockedOverride) &&
            dist[nr][nc] < Infinity
          ) {
            const nw = this.gridToWorld(nc, nr);
            if (Math.hypot(info.x - nw.x, info.z - nw.z) <= 1.55) {
              canReach = true;
              break;
            }
          }
        }
      }

      if (!canReach) {
        return { valid: false, reason: 'ENEMY_TRAPPED', previewPath: [] };
      }
    }

    const previewRoute = this._traceEntryToExitWaypoints(
      dist,
      nextStep,
      blockedOverride
    );
    const previewPath = previewRoute.waypoints;

    // 6. Gold check
    if (currentGold < towerCost) {
      return {
        valid: false,
        reason: 'INSUFFICIENT_GOLD',
        previewPath,
      };
    }

    // 7. Valid placement
    return {
      valid: true,
      reason: 'OK',
      previewPath,
    };
  }

  /**
   * Places a tower on (col, row), recomputes flow field, updates route preview,
   * and triggers callbacks.onMazeChanged().
   */
  placeTowerOnGrid(col, row, towerObj = {}) {
    if (!this.isInBounds(col, row)) return false;

    const entry = {
      towerId:
        towerObj.id ||
        towerObj.towerId ||
        `tower_${col}_${row}_${Date.now()}`,
      type: towerObj.type || towerObj.towerType || 'gatling',
      tower: towerObj,
      col,
      row,
    };

    this.cells[row][col] = entry;
    this.recomputeFlowField();
    this.updateRoutePreviewVisual();

    if (typeof this.callbacks.onMazeChanged === 'function') {
      this.callbacks.onMazeChanged({
        action: 'place',
        col,
        row,
        tower: towerObj,
        mainPathWaypoints: this.mainPathWaypoints,
      });
    }

    return entry;
  }

  /**
   * Removes a tower from (col, row), recomputes flow field, updates route preview,
   * and triggers callbacks.onMazeChanged().
   */
  removeTowerFromGrid(col, row) {
    if (!this.isInBounds(col, row)) return null;
    const removed = this.cells[row][col];
    if (!removed) return null;

    this.cells[row][col] = null;
    this.recomputeFlowField();
    this.updateRoutePreviewVisual();

    if (typeof this.callbacks.onMazeChanged === 'function') {
      this.callbacks.onMazeChanged({
        action: 'remove',
        col,
        row,
        tower: removed.tower,
        mainPathWaypoints: this.mainPathWaypoints,
      });
    }

    return removed;
  }

  /**
   * Clears all towers from the grid and resets the flow field.
   */
  clearAllTowers() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.cells[r][c] = null;
      }
    }
    this.recomputeFlowField();
    this.updateRoutePreviewVisual();

    if (typeof this.callbacks.onMazeChanged === 'function') {
      this.callbacks.onMazeChanged({
        action: 'clear',
        mainPathWaypoints: this.mainPathWaypoints,
      });
    }
  }

  // ===========================================================================
  // Serpentine Maze Preset Generator
  // ===========================================================================

  /**
   * Returns a list of { col, row, type } tower placements that form a classic
   * multi-switchback Argon Towers serpentine maze across the 18x10 Grasslands
   * field without blocking the exit.
   */
  getSerpentinePresetTiles(presetName = 'serpentine') {
    const placements = [];

    if (presetName === 'starter' || presetName === 'compact') {
      // 2-baffle starter serpentine maze (18 towers)
      const wallA = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // col 4, open at row 0
      const wallB = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // col 9, open at row 9
      for (let i = 0; i < wallA.length; i++) {
        const r = wallA[i];
        const type = r === 1 ? 'goo' : r === 5 ? 'missile' : 'gatling';
        placements.push({ col: 4, row: r, type });
      }
      for (let i = 0; i < wallB.length; i++) {
        const r = wallB[i];
        const type = r === 8 ? 'goo' : r === 4 ? 'tesla' : 'gatling';
        placements.push({ col: 9, row: r, type });
      }
      return placements;
    }

    // Full 4-switchback classic Argon Towers serpentine maze across 18x10 field:
    // Baffle 1 at col 3: rows 1..9 filled (top opening at row 0)
    // Baffle 2 at col 7: rows 0..8 filled (bottom opening at row 9)
    // Baffle 3 at col 11: rows 1..9 filled (top opening at row 0)
    // Baffle 4 at col 14: rows 0..8 filled (bottom opening at row 9)
    const baffles = [
      { col: 3, openRow: 0 },
      { col: 7, openRow: 9 },
      { col: 11, openRow: 0 },
      { col: 14, openRow: 9 },
    ];

    for (let b = 0; b < baffles.length; b++) {
      const { col, openRow } = baffles[b];
      for (let r = 0; r < this.rows; r++) {
        if (r === openRow) continue;
        let type = 'gatling';
        if (Math.abs(r - openRow) === 1) {
          type = 'goo'; // Slow creeps right at each switchback turn
        } else if (r === 4 || r === 5) {
          type = b % 2 === 0 ? 'missile' : 'tesla'; // Heavy splash/shock in center
        } else if (r === 2 || r === 7) {
          type = 'missile';
        }
        placements.push({ col, row: r, type });
      }
    }

    return placements;
  }

  // ===========================================================================
  // Three.js Visual Helpers (Grid Lines, Hover Preview, Route Ribbon, Flash)
  // ===========================================================================

  _initThreeVisualGroups() {
    const THREE = window.THREE;
    this.gridLinesGroup = new THREE.Group();
    this.gridLinesGroup.name = 'ArgonTowersGridLines';

    this.hoverPreviewGroup = new THREE.Group();
    this.hoverPreviewGroup.name = 'Argon TowersHoverPreview';
    this.hoverPreviewGroup.visible = false;

    this.routePreviewGroup = new THREE.Group();
    this.routePreviewGroup.name = 'Argon TowersRoutePreview';

    this.invalidFlashGroup = new THREE.Group();
    this.invalidFlashGroup.name = 'Argon TowersInvalidFlash';
    this.invalidFlashGroup.visible = false;

    this.selectedRangeGroup = new THREE.Group();
    this.selectedRangeGroup.name = 'Argon TowersSelectedRange';
    this.selectedRangeGroup.visible = false;

    this._buildGridLinesVisual();
    this._buildHoverPreviewVisual();
    this._buildRoutePreviewPool();
    this._buildInvalidFlashVisual();
    this._buildSelectedRangeVisual();

    this.scene.add(this.gridLinesGroup);
    this.scene.add(this.routePreviewGroup);
    this.scene.add(this.hoverPreviewGroup);
    this.scene.add(this.invalidFlashGroup);
    this.scene.add(this.selectedRangeGroup);
  }

  _buildGridLinesVisual() {
    const THREE = window.THREE;
    const positions = [];
    const y = 0.025;

    // Vertical lines (col 0..18)
    for (let c = 0; c <= this.cols; c++) {
      const x = GRID_CONFIG.MIN_X + c * this.tileSize;
      positions.push(x, y, GRID_CONFIG.MIN_Z, x, y, GRID_CONFIG.MAX_Z);
    }

    // Horizontal lines (row 0..10)
    for (let r = 0; r <= this.rows; r++) {
      const z = GRID_CONFIG.MIN_Z + r * this.tileSize;
      positions.push(GRID_CONFIG.MIN_X, y, z, GRID_CONFIG.MAX_X, y, z);
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );

    const lineMat = new THREE.LineBasicMaterial({
      color: 0xeaffd0,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });

    const gridSegments = new THREE.LineSegments(lineGeo, lineMat);
    this.gridLinesGroup.add(gridSegments);
    this._gridLineMaterials.push({ mat: lineMat, baseOpacity: 0.0, activeOpacity: 0.45 });

    // Subtle corner crosshairs inside grid intersections
    const tickPositions = [];
    const tickSize = 0.16;
    for (let c = 1; c < this.cols; c++) {
      for (let r = 1; r < this.rows; r++) {
        const x = GRID_CONFIG.MIN_X + c * this.tileSize;
        const z = GRID_CONFIG.MIN_Z + r * this.tileSize;
        tickPositions.push(x - tickSize, y + 0.003, z, x + tickSize, y + 0.003, z);
        tickPositions.push(x, y + 0.003, z - tickSize, x, y + 0.003, z + tickSize);
      }
    }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(tickPositions, 3)
    );
    const tickMat = new THREE.LineBasicMaterial({
      color: 0x7aff9e,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const tickSegments = new THREE.LineSegments(tickGeo, tickMat);
    this.gridLinesGroup.add(tickSegments);
    this._gridLineMaterials.push({ mat: tickMat, baseOpacity: 0.0, activeOpacity: 0.55 });

    // West Entry & East Exit portal mouth brackets (rows 4 & 5 -> Z in [-2, +2])
    const portalPositions = [
      // West Entry bracket
      GRID_CONFIG.MIN_X, y + 0.01, -2.0, GRID_CONFIG.MIN_X - 1.2, y + 0.01, -2.0,
      GRID_CONFIG.MIN_X, y + 0.01, 2.0, GRID_CONFIG.MIN_X - 1.2, y + 0.01, 2.0,
      // East Exit bracket
      GRID_CONFIG.MAX_X, y + 0.01, -2.0, GRID_CONFIG.MAX_X + 1.2, y + 0.01, -2.0,
      GRID_CONFIG.MAX_X, y + 0.01, 2.0, GRID_CONFIG.MAX_X + 1.2, y + 0.01, 2.0,
    ];
    const portalGeo = new THREE.BufferGeometry();
    portalGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(portalPositions, 3)
    );
    const portalMat = new THREE.LineBasicMaterial({
      color: 0xffd84d,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.gridLinesGroup.add(new THREE.LineSegments(portalGeo, portalMat));
    this._gridLineMaterials.push({ mat: portalMat, baseOpacity: 0.0, activeOpacity: 0.75 });
  }

  _buildHoverPreviewVisual() {
    const THREE = window.THREE;

    // 1. Crisp tile footprint quad (2.0 x 2.0)
    const footprintGeo = new THREE.PlaneGeometry(1.94, 1.94);
    footprintGeo.rotateX(-Math.PI / 2);
    this.footprintMat = new THREE.MeshBasicMaterial({
      color: GRID_CONFIG.VALID_COLOR_HEX,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.footprintMesh = new THREE.Mesh(footprintGeo, this.footprintMat);
    this.footprintMesh.position.y = 0.04;
    this.hoverPreviewGroup.add(this.footprintMesh);

    // Tile footprint border outline
    const borderPts = [
      -0.98, 0.05, -0.98, 0.98, 0.05, -0.98,
      0.98, 0.05, -0.98, 0.98, 0.05, 0.98,
      0.98, 0.05, 0.98, -0.98, 0.05, 0.98,
      -0.98, 0.05, 0.98, -0.98, 0.05, -0.98,
    ];
    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(borderPts, 3)
    );
    this.footprintBorderMat = new THREE.LineBasicMaterial({
      color: GRID_CONFIG.VALID_COLOR_HEX,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.footprintBorder = new THREE.LineSegments(
      borderGeo,
      this.footprintBorderMat
    );
    this.hoverPreviewGroup.add(this.footprintBorder);

    // 2. Semi-transparent filled range circle + crisp double perimeter ring
    // Geometries are rotated -Math.PI / 2 in XZ plane so mesh.scale.set(range, 1, range) scales XZ radius directly
    const rangeFillGeo = new THREE.CircleGeometry(1.0, 64);
    rangeFillGeo.rotateX(-Math.PI / 2);
    this.rangeFillMat = new THREE.MeshBasicMaterial({
      color: GRID_CONFIG.VALID_COLOR_HEX,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.rangeFillMesh = new THREE.Mesh(rangeFillGeo, this.rangeFillMat);
    this.rangeFillMesh.position.y = 0.035;
    this.hoverPreviewGroup.add(this.rangeFillMesh);

    const outerRingGeo = new THREE.RingGeometry(0.975, 1.0, 64);
    outerRingGeo.rotateX(-Math.PI / 2);
    this.rangeOuterMat = new THREE.MeshBasicMaterial({
      color: GRID_CONFIG.VALID_COLOR_HEX,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.rangeOuterRing = new THREE.Mesh(outerRingGeo, this.rangeOuterMat);
    this.rangeOuterRing.position.y = 0.042;
    this.hoverPreviewGroup.add(this.rangeOuterRing);

    const innerRingGeo = new THREE.RingGeometry(0.925, 0.942, 64);
    innerRingGeo.rotateX(-Math.PI / 2);
    this.rangeInnerMat = new THREE.MeshBasicMaterial({
      color: GRID_CONFIG.VALID_COLOR_HEX,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.rangeInnerRing = new THREE.Mesh(innerRingGeo, this.rangeInnerMat);
    this.rangeInnerRing.position.y = 0.041;
    this.hoverPreviewGroup.add(this.rangeInnerRing);

    // 3. Diagonal red X cross when invalid or blocking the maze
    this.invalidCrossGroup = new THREE.Group();
    const barGeo1 = new THREE.PlaneGeometry(2.15, 0.28);
    barGeo1.rotateX(-Math.PI / 2);
    barGeo1.rotateY(Math.PI / 4);

    const barGeo2 = new THREE.PlaneGeometry(2.15, 0.28);
    barGeo2.rotateX(-Math.PI / 2);
    barGeo2.rotateY(-Math.PI / 4);

    this.invalidCrossMat = new THREE.MeshBasicMaterial({
      color: GRID_CONFIG.INVALID_COLOR_HEX,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const bar1 = new THREE.Mesh(barGeo1, this.invalidCrossMat);
    const bar2 = new THREE.Mesh(barGeo2, this.invalidCrossMat);
    bar1.position.y = 0.08;
    bar2.position.y = 0.08;
    this.invalidCrossGroup.add(bar1, bar2);
    this.invalidCrossGroup.visible = false;
    this.hoverPreviewGroup.add(this.invalidCrossGroup);

    // 4. Ghost 3D turret silhouette preview
    this.ghostTurretGroup = new THREE.Group();
    this.ghostMat = new THREE.MeshBasicMaterial({
      color: GRID_CONFIG.VALID_COLOR_HEX,
      transparent: true,
      opacity: 0.42,
      wireframe: false,
      depthWrite: false,
    });
    this.ghostWireMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
      depthWrite: false,
    });

    const basePedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.82, 0.45, 12),
      this.ghostMat
    );
    basePedestal.position.y = 0.225;
    this.ghostTurretGroup.add(basePedestal);

    this.ghostHeadGroup = new THREE.Group();
    this.ghostHeadGroup.position.y = 0.55;
    this.ghostTurretGroup.add(this.ghostHeadGroup);

    this._rebuildGhostTurretHead('gatling');
    this.hoverPreviewGroup.add(this.ghostTurretGroup);
  }

  _rebuildGhostTurretHead(towerType = 'gatling') {
    if (!this.ghostHeadGroup || typeof window === 'undefined' || !window.THREE) {
      return;
    }
    const THREE = window.THREE;
    while (this.ghostHeadGroup.children.length > 0) {
      this.ghostHeadGroup.remove(this.ghostHeadGroup.children[0]);
    }

    const t = String(towerType || 'gatling').toLowerCase();
    if (t.includes('goo') || t.includes('glue') || t.includes('slow')) {
      const tank = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 12, 10),
        this.ghostMat
      );
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.2, 0.72, 10),
        this.ghostMat
      );
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(0, 0.05, 0.48);
      this.ghostHeadGroup.add(tank, nozzle);
    } else if (t.includes('missile') || t.includes('rocket')) {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.48, 0.64),
        this.ghostMat
      );
      const podL = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.36, 0.76),
        this.ghostMat
      );
      podL.position.set(-0.42, 0.12, 0.1);
      podL.rotation.x = -0.22;
      const podR = podL.clone();
      podR.position.x = 0.42;
      this.ghostHeadGroup.add(body, podL, podR);
    } else if (t.includes('tesla') || t.includes('spark') || t.includes('lightning')) {
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.34, 1.15, 10),
        this.ghostMat
      );
      spire.position.y = 0.45;
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 10),
        this.ghostMat
      );
      orb.position.y = 1.08;
      this.ghostHeadGroup.add(spire, orb);
    } else {
      // Default Gatling / Turret silhouette
      const turretHead = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.5, 0.44, 12),
        this.ghostMat
      );
      const barrelL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.85, 8),
        this.ghostMat
      );
      barrelL.rotation.x = Math.PI / 2;
      barrelL.position.set(-0.14, 0.04, 0.55);
      const barrelR = barrelL.clone();
      barrelR.position.x = 0.14;
      this.ghostHeadGroup.add(turretHead, barrelL, barrelR);
    }
    this._currentGhostType = t;
  }

  _buildInvalidFlashVisual() {
    const THREE = window.THREE;
    const padGeo = new THREE.PlaneGeometry(1.96, 1.96);
    padGeo.rotateX(-Math.PI / 2);
    this.flashPadMat = new THREE.MeshBasicMaterial({
      color: GRID_CONFIG.INVALID_COLOR_HEX,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const pad = new THREE.Mesh(padGeo, this.flashPadMat);
    pad.position.y = 0.06;

    const barGeo1 = new THREE.PlaneGeometry(2.1, 0.3);
    barGeo1.rotateX(-Math.PI / 2);
    barGeo1.rotateY(Math.PI / 4);
    const barGeo2 = new THREE.PlaneGeometry(2.1, 0.3);
    barGeo2.rotateX(-Math.PI / 2);
    barGeo2.rotateY(-Math.PI / 4);

    this.flashCrossMat = new THREE.MeshBasicMaterial({
      color: 0xff4d55,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const b1 = new THREE.Mesh(barGeo1, this.flashCrossMat);
    const b2 = new THREE.Mesh(barGeo2, this.flashCrossMat);
    b1.position.y = 0.09;
    b2.position.y = 0.09;

    this.invalidFlashGroup.add(pad, b1, b2);
  }

  _buildSelectedRangeVisual() {
    const THREE = window.THREE;
    const fillGeo = new THREE.CircleGeometry(1.0, 64);
    fillGeo.rotateX(-Math.PI / 2);
    this.selRangeFillMat = new THREE.MeshBasicMaterial({
      color: 0x5ce1ff,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.selRangeFill = new THREE.Mesh(fillGeo, this.selRangeFillMat);
    this.selRangeFill.position.y = 0.032;

    const ringGeo = new THREE.RingGeometry(0.975, 1.0, 64);
    ringGeo.rotateX(-Math.PI / 2);
    this.selRangeRingMat = new THREE.MeshBasicMaterial({
      color: 0x5ce1ff,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.selRangeRing = new THREE.Mesh(ringGeo, this.selRangeRingMat);
    this.selRangeRing.position.y = 0.038;

    this.selectedRangeGroup.add(this.selRangeFill, this.selRangeRing);
  }

  _buildRoutePreviewPool() {
    const THREE = window.THREE;
    const count = 44;

    // Chevron / diamond breadcrumb geometry flat in XZ plane pointing along +Z
    const chevronShape = new THREE.Shape();
    chevronShape.moveTo(0, 0.24);
    chevronShape.lineTo(0.18, -0.14);
    chevronShape.lineTo(0, -0.04);
    chevronShape.lineTo(-0.18, -0.14);
    chevronShape.closePath();

    const chevronGeo = new THREE.ShapeGeometry(chevronShape);
    chevronGeo.rotateX(Math.PI / 2);

    this.routeDotMat = new THREE.MeshBasicMaterial({
      color: GRID_CONFIG.ROUTE_COLOR_HEX,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(chevronGeo, this.routeDotMat);
      m.position.y = 0.055;
      m.visible = false;
      this.routePreviewGroup.add(m);
      this._routeBreadcrumbs.push(m);
    }

    const lineGeo = new THREE.BufferGeometry();
    this._routeLineMat = new THREE.LineBasicMaterial({
      color: GRID_CONFIG.ROUTE_COLOR_HEX,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    this._routeLine = new THREE.Line(lineGeo, this._routeLineMat);
    this.routePreviewGroup.add(this._routeLine);
  }

  /**
   * Rebuilds the glowing golden-green breadcrumb / chevron ribbon along the
   * provided waypoints (or this.mainPathWaypoints).
   */
  updateRoutePreviewVisual(waypoints = null) {
    if (!this.routePreviewGroup || typeof window === 'undefined' || !window.THREE) {
      return;
    }
    const THREE = window.THREE;
    const pts =
      Array.isArray(waypoints) && waypoints.length >= 2
        ? waypoints
        : this.mainPathWaypoints;

    if (!pts || pts.length < 2) {
      this._routeCurvePoints = [];
      this._routeTotalLength = 0;
      for (let i = 0; i < this._routeBreadcrumbs.length; i++) {
        this._routeBreadcrumbs[i].visible = false;
      }
      if (this._routeLine) this._routeLine.visible = false;
      return;
    }

    this._routeCurvePoints = pts.map((p) => ({ x: p.x, z: p.z }));
    this._routeCumulativeLengths = [0];
    let totalLen = 0;
    const lineVerts = [pts[0].x, 0.045, pts[0].z];

    for (let i = 1; i < pts.length; i++) {
      const segLen = Math.hypot(
        pts[i].x - pts[i - 1].x,
        pts[i].z - pts[i - 1].z
      );
      totalLen += segLen;
      this._routeCumulativeLengths.push(totalLen);
      lineVerts.push(pts[i].x, 0.045, pts[i].z);
    }
    this._routeTotalLength = totalLen;

    if (this._routeLine) {
      this._routeLine.geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(lineVerts, 3)
      );
      this._routeLine.visible = true;
    }
  }

  /**
   * Enables or disables placement mode and adjusts grid & route preview visibility.
   */
  setPlacementMode(active, towerType = 'gatling', range = 6.0) {
    this.placementActive = Boolean(active);
    if (!this.placementActive) {
      this.hideHoverPreview();
      this.updateRoutePreviewVisual(this.mainPathWaypoints);
    } else {
      this.previewState.towerType = towerType;
      this.previewState.range = range;
    }
  }

  /**
   * Updates the 3D hover preview at (col, row).
   * Supports both object options: updateHoverPreview(col, row, { valid, reason, range, towerType, previewPath })
   * and positional arguments: updateHoverPreview(col, row, valid, range, towerType, previewPath).
   */
  updateHoverPreview(
    col,
    row,
    optionsOrValid = true,
    rangeArg = 6.0,
    towerTypeArg = 'gatling',
    previewPathArg = null
  ) {
    let valid = true;
    let reason = 'OK';
    let range = rangeArg;
    let towerType = towerTypeArg;
    let previewPath = previewPathArg;

    if (optionsOrValid && typeof optionsOrValid === 'object') {
      valid = optionsOrValid.valid !== undefined ? Boolean(optionsOrValid.valid) : true;
      reason = optionsOrValid.reason || (valid ? 'OK' : 'INVALID');
      range = optionsOrValid.range !== undefined ? optionsOrValid.range : this.previewState.range || 6.0;
      towerType = optionsOrValid.towerType || optionsOrValid.type || this.previewState.towerType || 'gatling';
      previewPath = optionsOrValid.previewPath || null;
    } else {
      valid = Boolean(optionsOrValid);
    }

    this.placementActive = true;
    this.hoveredTile = {
      col,
      row,
      inBounds: this.isInBounds(col, row),
      ...this.gridToWorld(col, row),
    };

    if (!this.isInBounds(col, row)) {
      if (this.hoverPreviewGroup) this.hoverPreviewGroup.visible = false;
      this.updateRoutePreviewVisual(this.mainPathWaypoints);
      return;
    }

    this.previewState = {
      active: true,
      col,
      row,
      valid,
      reason,
      range,
      towerType,
      previewPath,
    };

    if (this.hoverPreviewGroup) {
      const worldPos = this.gridToWorld(col, row);
      this.hoverPreviewGroup.position.set(worldPos.x, 0, worldPos.z);
      this.hoverPreviewGroup.visible = true;

      const colorHex = valid
        ? GRID_CONFIG.VALID_COLOR_HEX
        : GRID_CONFIG.INVALID_COLOR_HEX;

      this.footprintMat.color.setHex(colorHex);
      this.footprintBorderMat.color.setHex(colorHex);
      this.rangeFillMat.color.setHex(colorHex);
      this.rangeOuterMat.color.setHex(colorHex);
      this.rangeInnerMat.color.setHex(colorHex);
      this.ghostMat.color.setHex(colorHex);

      // Scale range circle & double perimeter rings via mesh.scale.set(range, 1, range)
      const safeRange = Math.max(0.5, Number(range) || 6.0);
      this.rangeFillMesh.scale.set(safeRange, 1, safeRange);
      this.rangeOuterRing.scale.set(safeRange, 1, safeRange);
      this.rangeInnerRing.scale.set(safeRange, 1, safeRange);

      this.invalidCrossGroup.visible = !valid;

      if (this._currentGhostType !== String(towerType).toLowerCase()) {
        this._rebuildGhostTurretHead(towerType);
      }
    }

    if (valid && Array.isArray(previewPath) && previewPath.length >= 2) {
      this.updateRoutePreviewVisual(previewPath);
    } else {
      this.updateRoutePreviewVisual(this.mainPathWaypoints);
    }
  }

  /**
   * Convenience method to validate & update hover preview directly from world coordinates.
   */
  updateHoverFromWorld(
    wx,
    wz,
    activeGroundEnemies = [],
    towerCost = 0,
    currentGold = Infinity,
    range = 6.0,
    towerType = 'gatling'
  ) {
    const g = this.worldToGrid(wx, wz);
    if (!g.inBounds) {
      this.hideHoverPreview();
      return { valid: false, reason: 'OUT_OF_BOUNDS', col: g.col, row: g.row };
    }
    const validation = this.validatePlacement(
      g.col,
      g.row,
      activeGroundEnemies,
      towerCost,
      currentGold
    );
    this.updateHoverPreview(g.col, g.row, {
      valid: validation.valid,
      reason: validation.reason,
      range,
      towerType,
      previewPath: validation.previewPath,
    });
    return { ...validation, col: g.col, row: g.row };
  }

  /**
   * Hides the placement hover preview and restores the default route ribbon.
   */
  hideHoverPreview() {
    this.previewState.active = false;
    if (this.hoverPreviewGroup) {
      this.hoverPreviewGroup.visible = false;
    }
    this.updateRoutePreviewVisual(this.mainPathWaypoints);
  }

  /**
   * Shows or hides a range circle around an already-placed tower at (wx, wz).
   */
  showRangeIndicator(wx, wz, range = 6.0, colorHex = 0x5ce1ff) {
    if (!this.selectedRangeGroup) return;
    this.selectedRangeGroup.position.set(wx, 0, wz);
    this.selRangeFill.scale.set(range, 1, range);
    this.selRangeRing.scale.set(range, 1, range);
    this.selRangeFillMat.color.setHex(colorHex);
    this.selRangeRingMat.color.setHex(colorHex);
    this.selectedRangeGroup.visible = true;
  }

  hideRangeIndicator() {
    if (this.selectedRangeGroup) {
      this.selectedRangeGroup.visible = false;
    }
  }

  /**
   * Triggers a red invalid-placement flash at (col, row).
   */
  triggerInvalidFlash(col, row, reason = 'INVALID') {
    this.invalidFlash = {
      active: true,
      timer: 0.55,
      duration: 0.55,
      col,
      row,
      reason,
    };

    if (this.invalidFlashGroup && this.isInBounds(col, row)) {
      const w = this.gridToWorld(col, row);
      this.invalidFlashGroup.position.set(w.x, 0, w.z);
      this.invalidFlashGroup.visible = true;
    }
  }

  /**
   * Samples a point and tangent direction along the active route polyline at distance d.
   */
  _sampleRouteAtDistance(d) {
    const pts = this._routeCurvePoints;
    const lens = this._routeCumulativeLengths;
    if (!pts || pts.length < 2) return null;

    const clamped = Math.max(0, Math.min(this._routeTotalLength, d));
    let idx = 0;
    while (idx < lens.length - 2 && lens[idx + 1] < clamped) {
      idx++;
    }

    const segStart = lens[idx];
    const segEnd = lens[idx + 1];
    const segLen = Math.max(1e-5, segEnd - segStart);
    const t = (clamped - segStart) / segLen;

    const p0 = pts[idx];
    const p1 = pts[idx + 1];
    const x = p0.x + (p1.x - p0.x) * t;
    const z = p0.z + (p1.z - p0.z) * t;
    const angle = Math.atan2(p1.x - p0.x, p1.z - p0.z);

    return { x, z, angle };
  }

  /**
   * Per-frame animation update:
   * - Smoothly interpolates grid line opacity (0.07 in combat -> 0.45 during placement)
   * - Pulses hover range rings and rotates ghost turret preview
   * - Animates flowing golden-green route breadcrumbs along mainPathWaypoints / previewPath
   * - Updates red invalid-placement flash timer
   */
  update(dt = 0.016, time = 0) {
    const safeDt = Math.min(0.1, Math.max(0.001, Number(dt) || 0.016));
    const now = Number(time) || performance.now() * 0.001;

    // 1. Smoothly transition grid lines opacity (0.07 normal -> 0.45 when placementActive)
    const isPlacing =
      this.placementActive ||
      (this.hoverPreviewGroup && this.hoverPreviewGroup.visible);
    const lerpFactor = Math.min(1.0, safeDt * 10.0);

    for (let i = 0; i < this._gridLineMaterials.length; i++) {
      const entry = this._gridLineMaterials[i];
      const targetOp = isPlacing ? entry.activeOpacity : entry.baseOpacity;
      entry.mat.opacity += (targetOp - entry.mat.opacity) * lerpFactor;
    }
    this.currentGridOpacity = this._gridLineMaterials[0]
      ? this._gridLineMaterials[0].mat.opacity
      : isPlacing
      ? 0.45
      : 0.07;

    // 2. Pulse hover range ring & rotate ghost turret
    if (this.hoverPreviewGroup && this.hoverPreviewGroup.visible) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 6.0);
      const baseRange = Math.max(0.5, Number(this.previewState.range) || 6.0);
      const innerPulseScale = baseRange * (0.985 + 0.015 * pulse);
      this.rangeInnerRing.scale.set(innerPulseScale, 1, innerPulseScale);
      this.rangeOuterMat.opacity = 0.72 + 0.22 * pulse;
      this.footprintMat.opacity = 0.22 + 0.12 * pulse;

      if (this.ghostHeadGroup) {
        this.ghostHeadGroup.rotation.y = Math.sin(now * 2.2) * 0.45;
      }
    }

    // 3. Animate flowing route preview breadcrumbs along active path
    if (this._routeTotalLength > 0.1 && this._routeBreadcrumbs.length > 0) {
      const speed = isPlacing ? 6.5 : 4.2;
      const offset = (now * speed) % 1.0;
      const count = this._routeBreadcrumbs.length;
      const targetDotOpacity = isPlacing ? 0.76 : 0.0;
      const targetLineOpacity = isPlacing ? 0.42 : 0.0;

      this.routeDotMat.opacity +=
        (targetDotOpacity - this.routeDotMat.opacity) * lerpFactor;
      this.routeDotMat.color.setHex(
        isPlacing ? GRID_CONFIG.ROUTE_PREVIEW_HEX : GRID_CONFIG.ROUTE_COLOR_HEX
      );
      if (this._routeLineMat) {
        this._routeLineMat.opacity +=
          (targetLineOpacity - this._routeLineMat.opacity) * lerpFactor;
      }

      const showDots = this.routeDotMat.opacity > 0.015;
      for (let i = 0; i < count; i++) {
        const mesh = this._routeBreadcrumbs[i];
        if (!showDots) {
          mesh.visible = false;
          continue;
        }
        const frac = (i + offset) / count;
        const distAlong = frac * this._routeTotalLength;
        const sample = this._sampleRouteAtDistance(distAlong);
        if (sample) {
          mesh.visible = true;
          mesh.position.set(sample.x, 0.055, sample.z);
          mesh.rotation.y = sample.angle;
          const edgeFade = Math.sin(frac * Math.PI);
          const s = (isPlacing ? 1.05 : 0.82) * (0.7 + 0.3 * edgeFade);
          mesh.scale.set(s, s, s);
        } else {
          mesh.visible = false;
        }
      }
    }

    // 4. Update invalid placement flash timer
    if (this.invalidFlash.active) {
      this.invalidFlash.timer -= safeDt;
      if (this.invalidFlash.timer <= 0) {
        this.invalidFlash.active = false;
        if (this.invalidFlashGroup) {
          this.invalidFlashGroup.visible = false;
        }
      } else if (this.invalidFlashGroup) {
        const t = this.invalidFlash.timer / this.invalidFlash.duration;
        const flashPulse = Math.abs(Math.sin(now * 28.0));
        this.flashPadMat.opacity = t * (0.35 + 0.4 * flashPulse);
        this.flashCrossMat.opacity = t * 0.95;
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.GRID_CONFIG = GRID_CONFIG;
  window.ArgonTowersGrid = ArgonTowersGrid;
}

export { GRID_CONFIG, ArgonTowersGrid };
export default ArgonTowersGrid;
