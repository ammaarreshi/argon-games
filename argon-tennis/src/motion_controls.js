/**
 * Argon Tennis — Unified Motion Controller ES Module (`src/motion_controls.js`)
 *
 * Combines 3 real-time input pipelines into a single normalized swing/toss interface:
 * 1. Webcam Optical-Flow Motion Tracking (`enableWebcam()`) on a 64x48 analysis buffer
 *    with a live mirrored HUD PiP overlay (`<canvas id="webcam-canvas">`).
 * 2. Phone-as-Racket Companion Polling (`GET /api/racket/state` at 20Hz / 50ms) with
 *    live 3D racket orientation telemetry and monotonic `seq` swing dispatch.
 * 3. Desktop Mouse-Flick & Keyboard Controls (`Space`/`Enter`, `Q`/`E`, `Left`/`Right`,
 *    `1` Topspin, `2` Slice, `3` Lob, `4` Power Smash) + `triggerSyntheticSwing()`.
 */

export class MotionController {
  constructor(options = {}) {
    this.onSwing = typeof options.onSwing === 'function' ? options.onSwing : null;
    this.onToss = typeof options.onToss === 'function' ? options.onToss : null;
    this.onP2Swing = typeof options.onP2Swing === 'function' ? options.onP2Swing : null;
    this.onP2Toss = typeof options.onP2Toss === 'function' ? options.onP2Toss : null;
    this.onRoomState = typeof options.onRoomState === 'function' ? options.onRoomState : null;
    this.onStatusChange = typeof options.onStatusChange === 'function' ? options.onStatusChange : null;
    this.onOrientation = typeof options.onOrientation === 'function' ? options.onOrientation : null;

    this.roomId = (options.roomId || 'default').trim().toLowerCase() || 'default';
    this.role = (options.role || 'p1').toLowerCase() === 'p2' ? 'p2' : 'p1';

    this.webcamCanvasId = options.webcamCanvasId || 'webcam-canvas';
    this.webcamCanvas = options.webcamCanvas || null;
    this.webcamCtx = null;

    // Offscreen 64x48 optical-flow analysis buffer
    this.flowWidth = 64;
    this.flowHeight = 48;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.flowWidth;
    this.offscreenCanvas.height = this.flowHeight;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    this.prevLuma = new Float32Array(this.flowWidth * this.flowHeight);
    this.motionEnergyMap = new Float32Array(this.flowWidth * this.flowHeight);
    this.hasPrevFrame = false;

    this.videoElem = null;
    this.webcamStream = null;
    this.webcamActive = false;
    this.smoothedCentroid = { x: 0.5, y: 0.5 };
    this.motionVector = { vx: 0, vy: 0, mag: 0 };
    this.lastWebcamTriggerMs = 0;

    // Phone companion state (P1 & P2)
    this.phonePollIntervalMs = options.phonePollIntervalMs || 50;
    this.phonePollTimer = null;
    this.phoneState = {
      connected: false,
      p2Connected: false,
      lastSeenMs: -1,
      orientation: { pitch: 0, roll: 0, yaw: 0, accelMag: 0, buttonB: false },
      lastSwing: null,
    };
    this.p2PhoneState = {
      connected: false,
      lastSeenMs: -1,
      orientation: { pitch: 0, roll: 0, yaw: 0, accelMag: 0, buttonB: false },
      lastSwing: null,
    };
    this.lastProcessedPhoneSeq = 0;
    this.phonePollInitialized = false;
    this.lastProcessedP2PhoneSeq = 0;
    this.p2PhonePollInitialized = false;

    // Keyboard & Mouse-Flick state
    this.aimBiasX = 0.0; // -1 (left/cross-court) to +1 (right/down-the-line)
    this.selectedShotType = 'topspin';
    this.keysDown = new Set();
    this.pointerDrag = null;
    this.mouseTrail = [];
    this.lastVisualSwing = {
      timestamp: 0,
      dirX: 0,
      dirY: -0.5,
      speed: 0,
      shotType: 'topspin',
      source: 'ready',
    };

    this._listeners = { swing: [], toss: [], status: [], orientation: [] };
    this._rafId = null;
    this._disposed = false;

    this._initDOMBindings();
    this.startPhonePolling();
    this._startHudRenderLoop();
  }

  setRoomConfig({ roomId, role } = {}) {
    if (roomId) {
      this.roomId = String(roomId).trim().toLowerCase() || 'default';
      this.phonePollInitialized = false;
      this.p2PhonePollInitialized = false;
      this.lastProcessedPhoneSeq = 0;
      this.lastProcessedP2PhoneSeq = 0;
    }
    if (role) {
      this.role = String(role).toLowerCase() === 'p2' ? 'p2' : 'p1';
    }
  }

  /**
   * Subscribe to controller events ('swing', 'toss', 'status', 'orientation').
   */
  on(eventName, callback) {
    if (this._listeners[eventName] && typeof callback === 'function') {
      this._listeners[eventName].push(callback);
    }
    return () => {
      if (this._listeners[eventName]) {
        this._listeners[eventName] = this._listeners[eventName].filter((fn) => fn !== callback);
      }
    };
  }

  setShotType(shotType) {
    const valid = ['topspin', 'slice', 'lob', 'smash', 'flat'];
    if (valid.includes(shotType)) {
      this.selectedShotType = shotType;
      this._updateHudShotPills(shotType);
    }
  }

  /**
   * Resolves Swing Side ('forehand' | 'backhand' | 'overhead' | null) from explicit gesture side
   * or horizontal swing velocity (`dirX`).
   */
  _resolveSwingSide(rawSide, dirX = 0) {
    if (rawSide === 'backhand' || rawSide === 'forehand' || rawSide === 'overhead') {
      return rawSide;
    }
    if (dirX > 0.12) return 'backhand';
    if (dirX < -0.12) return 'forehand';
    return null;
  }

  /**
   * Infers Shot Type ('topspin' | 'slice' | 'lob' | 'smash') dynamically from swing kinematics
   * when not already classified by the input gesture pipeline.
   */
  _inferShotTypeFromKinematics({ shotType, dirY = -0.4, pitch = 0, roll = 0, speed = 1.1 } = {}) {
    const valid = ['topspin', 'slice', 'lob', 'smash', 'flat'];
    if (shotType && valid.includes(shotType)) {
      return shotType;
    }
    if ((dirY > 0.35 && speed > 1.22) || speed >= 1.46 || (pitch < -18 && speed >= 1.25)) {
      return 'smash';
    }
    if (dirY > 0.14 || (Math.abs(roll) > 26 && dirY > -0.15)) {
      return 'slice';
    }
    if (dirY < -0.65 || pitch > 26) {
      return 'lob';
    }
    return 'topspin';
  }

  /**
   * Fires a normalized swing event to all registered listeners.
   */
  _emitSwing(rawEvent = {}) {
    const now = performance.now();
    const speed = Math.max(0.5, Math.min(2.0, Number(rawEvent.speed ?? 1.1)));
    const dirX = Math.max(-1.0, Math.min(1.0, Number(rawEvent.dirX ?? rawEvent.angleX ?? this.aimBiasX ?? 0)));
    const dirY = Math.max(-1.0, Math.min(1.0, Number(rawEvent.dirY ?? -0.4)));
    const pitch = Number(rawEvent.pitch ?? this.phoneState.orientation.pitch ?? 0);
    const roll = Number(rawEvent.roll ?? this.phoneState.orientation.roll ?? 0);
    const side = this._resolveSwingSide(rawEvent.side, dirX);
    const shotType = this._inferShotTypeFromKinematics({
      shotType: rawEvent.shotType,
      dirY,
      pitch,
      roll,
      speed,
    });

    const event = {
      type: 'swing',
      role: rawEvent.role || this.role,
      source: rawEvent.source || 'manual',
      side,
      shotType,
      speed,
      dirX,
      dirY,
      angleX: dirX,
      pitch,
      roll,
      timing: rawEvent.timing || null,
      timestamp: rawEvent.timestamp || Date.now(),
    };

    this.lastVisualSwing = {
      timestamp: now,
      side,
      dirX,
      dirY,
      speed,
      shotType,
      source: event.source,
    };

    // If this desktop client is Player 2 (`role === 'p2'`) and swung locally (mouse/keyboard/webcam),
    // relay the swing to the server's P2 racket slot and invoke P2 swing handlers directly.
    if (this.role === 'p2' && rawEvent.role !== 'p1') {
      if (event.source !== 'phone' && !rawEvent._fromPoll) {
        fetch(`/api/racket/swing?room=${encodeURIComponent(this.roomId)}&role=p2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: this.roomId,
            role: 'p2',
            type: 'swing',
            side,
            shotType,
            speed,
            angleX: dirX,
            dirX,
            dirY,
            pitch,
            roll,
            source: event.source,
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && d.swing && typeof d.swing.seq === 'number') {
              this.p2PhonePollInitialized = true;
              this.lastProcessedP2PhoneSeq = Math.max(this.lastProcessedP2PhoneSeq, d.swing.seq);
            }
          })
          .catch(() => {});
      }
      return this._emitP2Swing(event);
    }

    if (typeof this.onSwing === 'function') {
      this.onSwing(event);
    }
    for (const fn of this._listeners.swing) {
      try { fn(event); } catch (e) { console.error(e); }
    }
    return event;
  }

  /**
   * Fires a normalized serve toss event to all registered listeners.
   */
  _emitToss(rawEvent = {}) {
    const now = performance.now();
    const dirX = Number(rawEvent.dirX ?? rawEvent.angleX ?? 0);
    const dirY = Number(rawEvent.dirY ?? -0.9);
    const side = this._resolveSwingSide(rawEvent.side, dirX);
    const shotType = rawEvent.shotType || 'lob';
    const pitch = Number(rawEvent.pitch ?? this.phoneState.orientation.pitch ?? 0);
    const roll = Number(rawEvent.roll ?? this.phoneState.orientation.roll ?? 0);

    const event = {
      type: 'toss',
      role: rawEvent.role || this.role,
      source: rawEvent.source || 'manual',
      side,
      shotType,
      speed: Number(rawEvent.speed ?? 1.0),
      dirX,
      dirY,
      angleX: dirX,
      pitch,
      roll,
      timestamp: rawEvent.timestamp || Date.now(),
    };

    this.lastVisualSwing = {
      timestamp: now,
      side,
      dirX,
      dirY: -0.95,
      speed: 1.1,
      shotType: 'toss',
      source: event.source,
    };

    if (this.role === 'p2' && rawEvent.role !== 'p1') {
      if (event.source !== 'phone' && !rawEvent._fromPoll) {
        fetch(`/api/racket/swing?room=${encodeURIComponent(this.roomId)}&role=p2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: this.roomId,
            role: 'p2',
            type: 'toss',
            side: event.side,
            shotType: event.shotType,
            speed: event.speed,
            angleX: event.dirX,
            dirX: event.dirX,
            dirY: event.dirY,
            pitch: event.pitch,
            roll: event.roll,
            source: event.source,
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && d.swing && typeof d.swing.seq === 'number') {
              this.p2PhonePollInitialized = true;
              this.lastProcessedP2PhoneSeq = Math.max(this.lastProcessedP2PhoneSeq, d.swing.seq);
            }
          })
          .catch(() => {});
      }
      return this._emitP2Toss(event);
    }

    let handled = false;
    if (typeof this.onToss === 'function') {
      const res = this.onToss(event);
      handled = res !== false;
    }
    for (const fn of this._listeners.toss) {
      try {
        const res = fn(event);
        if (res !== false) handled = true;
      } catch (e) {
        console.error(e);
      }
    }

    if (!handled && typeof this.onSwing === 'function') {
      this.onSwing(event);
    }
    return event;
  }

  _emitP2Swing(rawEvent = {}) {
    const speed = Math.max(0.5, Math.min(2.0, Number(rawEvent.speed ?? 1.15)));
    const dirX = Math.max(-1.0, Math.min(1.0, Number(rawEvent.dirX ?? rawEvent.angleX ?? 0)));
    const dirY = Math.max(-1.0, Math.min(1.0, Number(rawEvent.dirY ?? -0.45)));
    const pitch = Number(rawEvent.pitch ?? 0);
    const roll = Number(rawEvent.roll ?? 0);
    const side = this._resolveSwingSide(rawEvent.side, dirX);
    const shotType = this._inferShotTypeFromKinematics({
      shotType: rawEvent.shotType,
      dirY,
      pitch,
      roll,
      speed,
    });

    const event = {
      type: 'swing',
      role: 'p2',
      source: rawEvent.source || 'phone',
      side,
      shotType,
      speed,
      dirX,
      dirY,
      angleX: dirX,
      pitch,
      roll,
      timestamp: rawEvent.timestamp || Date.now(),
    };
    if (typeof this.onP2Swing === 'function') {
      this.onP2Swing(event);
    }
    return event;
  }

  _emitP2Toss(rawEvent = {}) {
    const dirX = Number(rawEvent.dirX ?? rawEvent.angleX ?? 0);
    const dirY = Number(rawEvent.dirY ?? -0.9);
    const side = this._resolveSwingSide(rawEvent.side, dirX);
    const event = {
      type: 'toss',
      role: 'p2',
      source: rawEvent.source || 'phone',
      side,
      shotType: rawEvent.shotType || 'lob',
      speed: Number(rawEvent.speed ?? 1.1),
      dirX,
      dirY,
      angleX: dirX,
      pitch: Number(rawEvent.pitch ?? 0),
      roll: Number(rawEvent.roll ?? 0),
      timestamp: rawEvent.timestamp || Date.now(),
    };
    let handled = false;
    if (typeof this.onP2Toss === 'function') {
      const res = this.onP2Toss(event);
      handled = res !== false;
    }
    if (!handled && typeof this.onP2Swing === 'function') {
      this.onP2Swing(event);
    }
    return event;
  }

  /**
   * Public method for deterministic tests, auto-rally visual verification, and HUD triggers.
   */
  triggerSyntheticSwing(options = {}) {
    const type = options.type || 'swing';
    if (type === 'toss') {
      return this._emitToss({
        source: options.source || 'synthetic',
        side: options.side || null,
        shotType: options.shotType || 'lob',
        speed: options.speed ?? 1.05,
        dirX: options.dirX ?? options.angleX ?? 0,
        dirY: options.dirY ?? -0.9,
      });
    }
    return this._emitSwing({
      source: options.source || 'synthetic',
      side: options.side || null,
      shotType: options.shotType,
      speed: options.speed ?? (options.shotType === 'smash' ? 1.48 : 1.18),
      dirX: options.dirX ?? options.angleX ?? this.aimBiasX ?? 0,
      dirY: options.dirY ?? -0.45,
      pitch: options.pitch,
      roll: options.roll,
      timing: options.timing || null,
    });
  }

  /**
   * Loads `@mediapipe/hands` (21-point 3D hand skeleton detector) from jsDelivr CDN.
   */
  async _ensureMediaPipeHands() {
    if (this.mpHands || this._mpLoading) return;
    this._mpLoading = true;

    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.crossOrigin = 'anonymous';
        s.onload = () => resolve();
        s.onerror = (e) => reject(e);
        document.head.appendChild(s);
      });

    try {
      if (!window.Hands) {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
      }
      if (window.Hands) {
        const hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.4,
          minTrackingConfidence: 0.4,
        });
        hands.onResults((results) => {
          this._mpBusy = false;
          if (results && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            this.latestHandLandmarks = results.multiHandLandmarks[0];
            this.latestHandSeenAt = performance.now();
            this._hasNewHandResult = true;
          } else {
            this.latestHandLandmarks = null;
          }
        });
        await hands.initialize();
        this.mpHands = hands;
      }
    } catch (err) {
      console.warn('[MotionController] MediaPipe Hands CDN fallback to Optical Flow:', err);
    } finally {
      this._mpLoading = false;
    }
  }

  /**
   * Enable live webcam 21-point Hand + Optical-Flow tracking using `getUserMedia`.
   */
  async enableWebcam() {
    if (this.webcamActive) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this._notifyStatus({ webcam: false, error: 'HTTPS required for browser camera access' });
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      this.webcamStream = stream;

      if (!this.videoElem) {
        this.videoElem = document.createElement('video');
        this.videoElem.playsInline = true;
        this.videoElem.muted = true;
      }
      this.videoElem.srcObject = stream;
      await this.videoElem.play();

      this.webcamActive = true;
      this.hasPrevFrame = false;
      this.latestHandLandmarks = null;
      this._mpBusy = false;
      this._ensureMediaPipeHands();
      this._notifyStatus({ webcam: true, phone: this.phoneState.connected });
      this._updateWebcamBadgeUI(true);
      return true;
    } catch (err) {
      console.warn('[MotionController] Webcam access denied or unavailable:', err);
      this.webcamActive = false;
      this._notifyStatus({ webcam: false, error: err.message || 'Camera permission denied' });
      this._updateWebcamBadgeUI(false);
      return false;
    }
  }

  disableWebcam() {
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach((t) => t.stop());
      this.webcamStream = null;
    }
    if (this.videoElem) {
      this.videoElem.srcObject = null;
    }
    this.webcamActive = false;
    this.hasPrevFrame = false;
    this.latestHandLandmarks = null;
    this._notifyStatus({ webcam: false, phone: this.phoneState.connected });
    this._updateWebcamBadgeUI(false);
  }

  async toggleWebcam() {
    if (this.webcamActive) {
      this.disableWebcam();
      return false;
    }
    return this.enableWebcam();
  }

  /**
   * Processes live webcam video frames using 21-point MediaPipe Hands + localized Optical-Flow fallback.
   */
  _processWebcamFrame() {
    if (!this.webcamActive || !this.videoElem || this.videoElem.readyState < 2) return;

    const now = performance.now();
    const isNewVideoFrame = this.videoElem.currentTime !== this._lastVideoTime;

    if (isNewVideoFrame) {
      this._lastVideoTime = this.videoElem.currentTime;
      if (this.mpHands && !this._mpBusy) {
        this._mpBusy = true;
        this.mpHands.send({ image: this.videoElem }).catch(() => {
          this._mpBusy = false;
        });
      }
    }

    const handActive = this.latestHandLandmarks && now - (this.latestHandSeenAt || 0) < 240;

    // 1. If MediaPipe 21-point Hand is tracked, use exact palm centroid (wrist [0] + middle_mcp [9])
    if (handActive) {
      if (!this._hasNewHandResult) return;
      this._hasNewHandResult = false;

      const lm = this.latestHandLandmarks;
      const wrist = lm[0];
      const midMcp = lm[9];
      const cx = 1.0 - (wrist.x * 0.45 + midMcp.x * 0.55);
      const cy = wrist.y * 0.45 + midMcp.y * 0.55;

      this.smoothedCentroid.x = cx;
      this.smoothedCentroid.y = cy;

      if (!this._webcamTrail || this._lastWebcamSource !== 'mediapipe') {
        this._webcamTrail = [];
      }
      this._lastWebcamSource = 'mediapipe';

      this._webcamTrail.push({ x: cx, y: cy, t: now });
      while (this._webcamTrail.length > 5 || (this._webcamTrail.length > 2 && now - this._webcamTrail[0].t > 160)) {
        this._webcamTrail.shift();
      }

      this._evaluateHandTrail(now, true);
      return;
    }

    if (!isNewVideoFrame) return;

    // 2. Fast Optical-Flow fallback on 64x48 buffer (before MediaPipe finishes loading or during motion blur)
    const w = this.flowWidth;
    const h = this.flowHeight;
    const ctx = this.offscreenCtx;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(this.videoElem, -w, 0, w, h);
    ctx.restore();

    const frameData = ctx.getImageData(0, 0, w, h).data;
    let totalWeight = 0;

    const cols = 8;
    const rows = 6;
    const cellW = w / cols;
    const cellH = h / rows;
    const cellMass = new Float32Array(cols * rows);
    const cellSumX = new Float32Array(cols * rows);
    const cellSumY = new Float32Array(cols * rows);

    for (let y = 0; y < h; y++) {
      const cy = Math.min(rows - 1, Math.floor(y / cellH));
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const pIdx = idx * 4;
        const luma = (frameData[pIdx] * 0.299 + frameData[pIdx + 1] * 0.587 + frameData[pIdx + 2] * 0.114) / 255;

        if (this.hasPrevFrame) {
          const diff = Math.abs(luma - this.prevLuma[idx]);
          const energy = diff > 0.11 ? diff : 0;
          this.motionEnergyMap[idx] = this.motionEnergyMap[idx] * 0.45 + energy * 0.55;

          if (energy > 0.13) {
            const wgt = energy;
            totalWeight += wgt;
            const cx = Math.min(cols - 1, Math.floor(x / cellW));
            const cIdx = cy * cols + cx;
            cellMass[cIdx] += wgt;
            cellSumX[cIdx] += (x / w) * wgt;
            cellSumY[cIdx] += (y / h) * wgt;
          }
        }
        this.prevLuma[idx] = luma;
      }
    }

    if (!this.hasPrevFrame) {
      this.hasPrevFrame = true;
      this._webcamTrail = [];
      return;
    }

    let bestClusterMass = 0;
    let bestSumX = 0;
    let bestSumY = 0;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        let cMass = 0;
        let cX = 0;
        let cY = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = gy + dy;
          if (ny < 0 || ny >= rows) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = gx + dx;
            if (nx < 0 || nx >= cols) continue;
            const cIdx = ny * cols + nx;
            cMass += cellMass[cIdx];
            cX += cellSumX[cIdx];
            cY += cellSumY[cIdx];
          }
        }
        if (cMass > bestClusterMass) {
          bestClusterMass = cMass;
          bestSumX = cX;
          bestSumY = cY;
        }
      }
    }

    const concentration = totalWeight > 0.001 ? bestClusterMass / totalWeight : 0;

    if (bestClusterMass > 3.2 && concentration >= 0.45) {
      const cx = bestSumX / bestClusterMass;
      const cy = bestSumY / bestClusterMass;

      this.smoothedCentroid.x = this.smoothedCentroid.x * 0.35 + cx * 0.65;
      this.smoothedCentroid.y = this.smoothedCentroid.y * 0.35 + cy * 0.65;

      if (!this._webcamTrail || this._lastWebcamSource !== 'flow') {
        this._webcamTrail = [];
      }
      this._lastWebcamSource = 'flow';

      this._webcamTrail.push({ x: this.smoothedCentroid.x, y: this.smoothedCentroid.y, t: now });
      while (this._webcamTrail.length > 5 || (this._webcamTrail.length > 2 && now - this._webcamTrail[0].t > 160)) {
        this._webcamTrail.shift();
      }

      this._evaluateHandTrail(now, false);
    } else {
      this.motionVector.vx *= 0.72;
      this.motionVector.vy *= 0.72;
      this.motionVector.mag *= 0.72;
      if (this._webcamTrail && this._webcamTrail.length > 0 && now - this._webcamTrail[this._webcamTrail.length - 1].t > 150) {
        this._webcamTrail = [];
      }
    }
  }

  _evaluateHandTrail(now, isMediaPipe) {
    if (!this._webcamTrail || this._webcamTrail.length < 2) return;

    const oldest = this._webcamTrail[0];
    const newest = this._webcamTrail[this._webcamTrail.length - 1];
    const dtSec = Math.max(0.025, (newest.t - oldest.t) / 1000);
    const netDx = newest.x - oldest.x;
    const netDy = newest.y - oldest.y;
    const netDist = Math.hypot(netDx, netDy);

    let pathLen = 0;
    for (let i = 1; i < this._webcamTrail.length; i++) {
      pathLen += Math.hypot(
        this._webcamTrail[i].x - this._webcamTrail[i - 1].x,
        this._webcamTrail[i].y - this._webcamTrail[i - 1].y
      );
    }
    const consistency = pathLen > 0.001 ? netDist / pathLen : 0;

    const minNetDist = isMediaPipe ? 0.065 : 0.10;
    const minConsistency = isMediaPipe ? 0.62 : 0.70;
    const minMag = isMediaPipe ? 0.62 : 0.85;

    const vx = netDx / dtSec;
    const vy = netDy / dtSec;
    this.motionVector.vx = vx * 0.65;
    this.motionVector.vy = vy * 0.65;
    this.motionVector.mag = consistency >= minConsistency ? Math.hypot(this.motionVector.vx, this.motionVector.vy) : 0;

    if (
      netDist >= minNetDist &&
      consistency >= minConsistency &&
      this.motionVector.mag >= minMag &&
      now - this.lastWebcamTriggerMs > 320
    ) {
      this.lastWebcamTriggerMs = now;
      this._webcamTrail = [newest];

      const speed = Math.min(1.65, Math.max(0.85, 0.75 + this.motionVector.mag * 0.45));
      const dirX = Math.max(-1, Math.min(1, this.motionVector.vx * 0.85));
      const dirY = Math.max(-1, Math.min(1, this.motionVector.vy * 0.85));

      let side = null;
      if (vx > 0.15) {
        side = 'backhand';
      } else if (vx < -0.15) {
        side = 'forehand';
      }

      if ((newest.y < 0.35 && netDy < -0.045 && vy < -0.45) || (vy < -0.85 && Math.abs(vy) > Math.abs(vx) * 1.15)) {
        this._emitToss({
          source: 'webcam',
          side,
          shotType: 'lob',
          speed,
          dirX,
          dirY: -0.9,
        });
      } else {
        let shotType = 'topspin';
        if ((vy > 0.85 && speed > 1.18) || speed >= 1.46) {
          shotType = 'smash';
        } else if (vy > 0.32) {
          shotType = 'slice';
        } else if (vy < -0.58) {
          shotType = 'lob';
        }
        this._emitSwing({
          source: 'webcam',
          side,
          shotType,
          speed,
          dirX,
          dirY,
        });
      }
    }
  }

  /**
   * Polls `GET /api/match/state` every 45ms to sync P1 & P2 Phone Companion Rackets
   * and 1v1 Multiplayer room state.
   */
  startPhonePolling() {
    if (this.phonePollTimer) return;
    const poll = async () => {
      if (this._disposed) return;
      try {
        const q = `?room=${encodeURIComponent(this.roomId || 'default')}&role=${encodeURIComponent(this.role || 'p1')}&touch=1`;
        const res = await fetch(`/api/match/state${q}`, { cache: 'no-store' });
        if (res.ok) {
          const matchData = await res.json();
          if (typeof this.onRoomState === 'function') {
            this.onRoomState(matchData);
          }

          const p1Data = matchData.p1 || matchData;
          const p2Data = matchData.p2 || null;

          const prevConnected = this.phoneState.connected;
          const prevP2Connected = this.p2PhoneState.connected;
          this.phoneState.connected = Boolean(p1Data.connected);
          this.phoneState.lastSeenMs = Number(p1Data.lastSeenMs ?? -1);
          if (p2Data) {
            this.p2PhoneState.connected = Boolean(p2Data.connected);
            this.p2PhoneState.lastSeenMs = Number(p2Data.lastSeenMs ?? -1);
          }

          const myRacketData = (this.role === 'p2' && p2Data) ? p2Data : p1Data;
          if (myRacketData && myRacketData.orientation) {
            this.phoneState.orientation = {
              pitch: Number(myRacketData.orientation.pitch || 0),
              roll: Number(myRacketData.orientation.roll || 0),
              yaw: Number(myRacketData.orientation.yaw || 0),
              accelMag: Number(myRacketData.orientation.accelMag || 0),
              buttonB: Boolean(myRacketData.orientation.buttonB),
            };
            if (typeof this.onOrientation === 'function') {
              this.onOrientation(this.phoneState.orientation);
            }
          }

          const anyPhoneConnected = this.phoneState.connected || this.p2PhoneState.connected;
          if (prevConnected !== this.phoneState.connected || prevP2Connected !== this.p2PhoneState.connected) {
            this._notifyStatus({
              webcam: this.webcamActive,
              phone: anyPhoneConnected,
              p1Phone: this.phoneState.connected,
              p2Phone: this.p2PhoneState.connected,
            });
            this._updatePhoneBadgeUI(anyPhoneConnected);
          }

          // Process P1 Racket swings
          if (p1Data && p1Data.lastSwing && typeof p1Data.lastSwing.seq === 'number') {
            const incomingSeq = p1Data.lastSwing.seq;
            if (!this.phonePollInitialized) {
              this.phonePollInitialized = true;
              const ageMs = Date.now() - Number(p1Data.lastSwing.serverTimeMs || 0);
              this.lastProcessedPhoneSeq = ageMs < 1200 ? incomingSeq - 1 : incomingSeq;
            }

            if (incomingSeq > this.lastProcessedPhoneSeq) {
              this.lastProcessedPhoneSeq = incomingSeq;
              this.phoneState.lastSwing = p1Data.lastSwing;
              const sw = p1Data.lastSwing;
              if (sw.type === 'toss') {
                this._emitToss({
                  source: 'phone',
                  role: 'p1',
                  side: sw.side,
                  shotType: sw.shotType || 'lob',
                  speed: sw.speed || 1.1,
                  dirX: sw.angleX ?? sw.dirX ?? 0,
                  dirY: sw.dirY ?? -0.9,
                  pitch: sw.pitch,
                  roll: sw.roll,
                });
              } else {
                this._emitSwing({
                  source: 'phone',
                  role: 'p1',
                  side: sw.side,
                  shotType: sw.shotType,
                  speed: sw.speed || 1.15,
                  dirX: sw.angleX ?? sw.dirX ?? 0,
                  dirY: sw.dirY ?? -0.45,
                  pitch: sw.pitch,
                  roll: sw.roll,
                });
              }
            }
          } else if (!this.phonePollInitialized) {
            this.phonePollInitialized = true;
            this.lastProcessedPhoneSeq = 0;
          }

          // Process P2 Racket swings (for 1v1 Multiplayer)
          if (p2Data && p2Data.lastSwing && typeof p2Data.lastSwing.seq === 'number') {
            const incomingP2Seq = p2Data.lastSwing.seq;
            if (!this.p2PhonePollInitialized) {
              this.p2PhonePollInitialized = true;
              const ageMs = Date.now() - Number(p2Data.lastSwing.serverTimeMs || 0);
              this.lastProcessedP2PhoneSeq = ageMs < 1200 ? incomingP2Seq - 1 : incomingP2Seq;
            }

            if (incomingP2Seq > this.lastProcessedP2PhoneSeq) {
              this.lastProcessedP2PhoneSeq = incomingP2Seq;
              this.p2PhoneState.lastSwing = p2Data.lastSwing;
              const sw2 = p2Data.lastSwing;
              if (sw2.type === 'toss') {
                this._emitP2Toss({
                  source: 'phone',
                  role: 'p2',
                  side: sw2.side,
                  shotType: sw2.shotType || 'lob',
                  speed: sw2.speed || 1.1,
                  dirX: sw2.angleX ?? sw2.dirX ?? 0,
                  dirY: sw2.dirY ?? -0.9,
                  pitch: sw2.pitch,
                  roll: sw2.roll,
                });
              } else {
                this._emitP2Swing({
                  source: 'phone',
                  role: 'p2',
                  side: sw2.side,
                  shotType: sw2.shotType,
                  speed: sw2.speed || 1.15,
                  dirX: sw2.angleX ?? sw2.dirX ?? 0,
                  dirY: sw2.dirY ?? -0.45,
                  pitch: sw2.pitch,
                  roll: sw2.roll,
                });
              }
            }
          } else if (!this.p2PhonePollInitialized) {
            this.p2PhonePollInitialized = true;
            this.lastProcessedP2PhoneSeq = 0;
          }
        }
      } catch (_) {
        // Ignore transient offline fetch errors
      }
    };

    poll();
    this.phonePollTimer = setInterval(poll, this.phonePollIntervalMs);
  }

  stopPhonePolling() {
    if (this.phonePollTimer) {
      clearInterval(this.phonePollTimer);
      this.phonePollTimer = null;
    }
  }

  /**
   * Sends bidirectional ball-impact / timing / score haptic feedback to the
   * connected Pocket Racket companion and local device vibration API.
   */
  triggerHapticFeedback({
    kind = 'hit',
    grade = 'PERFECT',
    shotType = 'TOPSPIN',
    speedKmh = 165,
    intensity = 1.0,
    role = null,
  } = {}) {
    const targetRole = role || this.role || 'p1';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        if (kind === 'whiff' || kind === 'fault') {
          navigator.vibrate([18, 35, 18]);
        } else if (intensity >= 1.25 || /PERFECT|POWER|SMASH/i.test(grade)) {
          navigator.vibrate([45, 28, 65]);
        } else {
          navigator.vibrate([32]);
        }
      } catch (_) {}
    }

    fetch('/api/racket/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: this.roomId || 'default',
        role: targetRole,
        kind,
        grade,
        shotType,
        speedKmh: Math.round(Number(speedKmh || 150)),
        intensity: Number(intensity || 1.0),
      }),
    }).catch(() => {});
  }

  /**
   * Attaches Desktop Mouse-Flick & Keyboard listeners.
   */
  _initDOMBindings() {
    this._onKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const code = e.code;
      this.keysDown.add(code);

      if (code === 'KeyQ' || code === 'ArrowLeft' || code === 'KeyA') {
        this.aimBiasX = Math.max(-1.0, this.aimBiasX - 0.55);
      } else if (code === 'KeyE' || code === 'ArrowRight' || code === 'KeyD') {
        this.aimBiasX = Math.min(1.0, this.aimBiasX + 0.55);
      } else if (code === 'Digit1') {
        this.setShotType('topspin');
        this._emitSwing({ source: 'keyboard', shotType: 'topspin', speed: 1.18, dirX: this.aimBiasX, dirY: -0.45 });
      } else if (code === 'Digit2') {
        this.setShotType('slice');
        this._emitSwing({ source: 'keyboard', shotType: 'slice', speed: 1.05, dirX: this.aimBiasX, dirY: 0.45 });
      } else if (code === 'Digit3') {
        this.setShotType('lob');
        this._emitSwing({ source: 'keyboard', shotType: 'lob', speed: 1.08, dirX: this.aimBiasX, dirY: -0.85 });
      } else if (code === 'Digit4') {
        this.setShotType('smash');
        this._emitSwing({ source: 'keyboard', shotType: 'smash', speed: 1.48, dirX: this.aimBiasX, dirY: 0.65 });
      } else if (code === 'KeyT' || code === 'ArrowUp' || code === 'KeyW') {
        this._emitToss({ source: 'keyboard', shotType: 'lob', speed: 1.1, dirX: this.aimBiasX, dirY: -0.9 });
      } else if (code === 'Space' || code === 'Enter') {
        e.preventDefault();
        this._emitSwing({
          source: 'keyboard',
          speed: 1.2,
          dirX: this.aimBiasX,
          dirY: -0.45,
        });
      }
    };

    this._onKeyUp = (e) => {
      const code = e.code;
      this.keysDown.delete(code);
      if (
        !this.keysDown.has('KeyQ') &&
        !this.keysDown.has('ArrowLeft') &&
        !this.keysDown.has('KeyA') &&
        !this.keysDown.has('KeyE') &&
        !this.keysDown.has('ArrowRight') &&
        !this.keysDown.has('KeyD')
      ) {
        this.aimBiasX = 0.0;
      }
    };

    this._onPointerDown = (e) => {
      // Ignore clicks on UI buttons, links, or controls
      if (e.target && e.target.closest('button, a, input, select, .hud-interactive, .control-btn')) {
        return;
      }
      this.pointerDrag = {
        startX: e.clientX,
        startY: e.clientY,
        startTime: performance.now(),
        lastX: e.clientX,
        lastY: e.clientY,
      };
      this.mouseTrail = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    };

    this._onPointerMove = (e) => {
      if (!this.pointerDrag) return;
      this.pointerDrag.lastX = e.clientX;
      this.pointerDrag.lastY = e.clientY;
      this.mouseTrail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (this.mouseTrail.length > 20) this.mouseTrail.shift();
    };

    this._onPointerUp = (e) => {
      if (!this.pointerDrag) return;
      const drag = this.pointerDrag;
      this.pointerDrag = null;

      const dx = (e.clientX ?? drag.lastX) - drag.startX;
      const dy = (e.clientY ?? drag.lastY) - drag.startY;
      const dt = Math.max(16, performance.now() - drag.startTime);
      const dist = Math.hypot(dx, dy);

      if (dist < 18) {
        return;
      }

      const velPxMs = dist / dt;
      const speed = Math.min(1.65, Math.max(0.82, 0.78 + velPxMs * 0.42));

      let side = null;
      if (dx > 14) {
        side = 'backhand';
      } else if (dx < -14) {
        side = 'forehand';
      }

      const normX = Math.max(-1, Math.min(1, dx / 180));
      const dirX =
        side === 'backhand'
          ? Math.max(0.22, normX)
          : side === 'forehand'
          ? Math.min(-0.22, normX)
          : normX;
      const dirY = Math.max(-1, Math.min(1, dy / 150));

      // Upward vertical flick => Serve Toss (or Lob if already in rally)
      if (dy < -55 && Math.abs(dy) > Math.abs(dx) * 1.3) {
        this._emitToss({
          source: 'mouse',
          side,
          shotType: 'lob',
          speed,
          dirX,
          dirY: -0.9,
        });
      } else {
        let shotType = 'topspin';
        if ((dy > 38 && speed > 1.22) || speed > 1.46) {
          shotType = 'smash';
        } else if (dy > 14) {
          shotType = 'slice';
        } else if (dy < -32) {
          shotType = 'lob';
        } else {
          shotType = 'topspin';
        }
        this._emitSwing({
          source: 'mouse',
          side,
          shotType,
          speed,
          dirX,
          dirY,
        });
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  /**
   * Renders the HUD `<canvas id="webcam-canvas">` with live mirrored webcam video
   * (or sleek motion radar + phone 3D tilt preview when webcam is off),
   * optical flow vector arrow, and swing power meter bar.
   */
  _startHudRenderLoop() {
    const render = () => {
      if (this._disposed) return;

      if (this.webcamActive) {
        this._processWebcamFrame();
      }

      if (!this.webcamCanvas) {
        this.webcamCanvas = document.getElementById(this.webcamCanvasId);
        if (this.webcamCanvas) {
          this.webcamCtx = this.webcamCanvas.getContext('2d');
        }
      }

      if (this.webcamCanvas && this.webcamCtx) {
        this._drawHudCanvas(this.webcamCtx, this.webcamCanvas.width, this.webcamCanvas.height);
      }

      this._rafId = requestAnimationFrame(render);
    };
    this._rafId = requestAnimationFrame(render);
  }

  _drawHudCanvas(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);

    if (this.webcamActive && this.videoElem && this.videoElem.readyState >= 2) {
      // Draw mirrored live webcam feed
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(this.videoElem, -w, 0, w, h);
      ctx.restore();

      const nowMs = performance.now();
      const handActive = this.latestHandLandmarks && nowMs - (this.latestHandSeenAt || 0) < 240;

      if (handActive) {
        const lm = this.latestHandLandmarks;
        const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4],
          [0, 5], [5, 6], [6, 7], [7, 8],
          [0, 9], [9, 10], [10, 11], [11, 12],
          [0, 13], [13, 14], [14, 15], [15, 16],
          [0, 17], [17, 18], [18, 19], [19, 20],
          [5, 9], [9, 13], [13, 17],
        ];
        ctx.strokeStyle = '#00e436';
        ctx.lineWidth = 2.0;
        for (const [i0, i1] of connections) {
          const p0 = lm[i0];
          const p1 = lm[i1];
          ctx.beginPath();
          ctx.moveTo((1 - p0.x) * w, p0.y * h);
          ctx.lineTo((1 - p1.x) * w, p1.y * h);
          ctx.stroke();
        }
        for (let i = 0; i < lm.length; i++) {
          const p = lm[i];
          ctx.fillStyle = i === 0 || i === 8 || i === 9 ? '#dfff00' : '#ffffff';
          ctx.beginPath();
          ctx.arc((1 - p.x) * w, p.y * h, i === 0 || i === 9 ? 3.5 : 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Overlay optical-flow energy highlights
        const cellW = w / this.flowWidth;
        const cellH = h / this.flowHeight;
        ctx.fillStyle = 'rgba(223, 255, 0, 0.35)';
        for (let y = 0; y < this.flowHeight; y += 2) {
          for (let x = 0; x < this.flowWidth; x += 2) {
            const energy = this.motionEnergyMap[y * this.flowWidth + x];
            if (energy > 0.14) {
              ctx.fillRect(x * cellW, y * cellH, cellW * 1.8, cellH * 1.8);
            }
          }
        }
      }
    } else {
      // Sleek dark translucent Argon Tennis Motion Radar background
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 6, w * 0.5, h * 0.5, w * 0.65);
      grad.addColorStop(0, 'rgba(24, 68, 42, 0.92)');
      grad.addColorStop(1, 'rgba(10, 24, 36, 0.96)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle radar grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(w, h * 0.5);
      ctx.moveTo(w * 0.5, 0);
      ctx.lineTo(w * 0.5, h);
      ctx.arc(w * 0.5, h * 0.5, Math.min(w, h) * 0.32, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw live 3D Racket Tilt & Swing Vector Indicator
    const now = performance.now();
    const swingAge = now - this.lastVisualSwing.timestamp;
    const isRecentSwing = swingAge < 550;

    const cx = this.webcamActive ? this.smoothedCentroid.x * w : w * 0.5;
    const cy = this.webcamActive ? this.smoothedCentroid.y * h : h * 0.52;

    // Draw centroid / racket head ring
    ctx.save();
    const rollRad = ((this.phoneState.orientation.roll || this.aimBiasX * 28) * Math.PI) / 180;
    ctx.translate(cx, cy);
    ctx.rotate(rollRad);
    ctx.strokeStyle = isRecentSwing ? '#dfff00' : '#00c8ff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(0, 28);
    ctx.stroke();
    ctx.restore();

    // Draw velocity vector arrow (from either live webcam motion or recent swing)
    let vecX = this.webcamActive ? this.motionVector.vx * 26 : 0;
    let vecY = this.webcamActive ? this.motionVector.vy * 26 : 0;
    if (isRecentSwing) {
      const fade = 1 - swingAge / 550;
      vecX = this.lastVisualSwing.dirX * 36 * fade;
      vecY = this.lastVisualSwing.dirY * 32 * fade;
    }

    if (Math.hypot(vecX, vecY) > 3) {
      const tx = cx + vecX;
      const ty = cy + vecY;
      const angle = Math.atan2(vecY, vecX);

      ctx.save();
      ctx.strokeStyle = '#dfff00';
      ctx.fillStyle = '#dfff00';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - 7 * Math.cos(angle - 0.5), ty - 7 * Math.sin(angle - 0.5));
      ctx.lineTo(tx - 7 * Math.cos(angle + 0.5), ty - 7 * Math.sin(angle + 0.5));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Bottom Swing Power Bar
    const powerVal = isRecentSwing
      ? Math.min(1, (this.lastVisualSwing.speed / 1.6) * (1 - swingAge / 650))
      : Math.min(1, this.motionVector.mag / 1.4);

    const barH = 5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(6, h - barH - 5, w - 12, barH);
    ctx.fillStyle = powerVal > 0.75 ? '#dfff00' : '#00d2ff';
    ctx.fillRect(6, h - barH - 5, (w - 12) * powerVal, barH);

    // Top-left status label inside canvas (shows recent Swing Side + Shot Type when active)
    ctx.fillStyle = isRecentSwing ? '#dfff00' : 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 9px sans-serif';
    let modeLabel = this.webcamActive
      ? 'CAM OPTICAL FLOW'
      : this.phoneState.connected
      ? 'POCKET RACKET LIVE'
      : 'MOTION RADAR';
    if (isRecentSwing) {
      const sideTag = this.lastVisualSwing.side === 'backhand' ? 'BH' : this.lastVisualSwing.side === 'forehand' ? 'FH' : '';
      const shotTag = (this.lastVisualSwing.shotType || 'topspin').toUpperCase();
      modeLabel = sideTag ? `${sideTag} • ${shotTag}` : shotTag;
    }
    ctx.fillText(modeLabel, 6, 12);
  }

  _updateWebcamBadgeUI(active) {
    const badge = document.getElementById('webcam-status-badge') || document.getElementById('btn-webcam');
    if (badge) {
      badge.classList.toggle('active', active);
    }
  }

  _updatePhoneBadgeUI(connected) {
    const badge = document.getElementById('phone-status-badge') || document.getElementById('phone-racket-status');
    if (badge) {
      badge.classList.toggle('connected', connected);
      badge.textContent = connected ? 'Pocket Racket: Connected' : 'Pocket Racket: Ready';
    }
  }

  _updateHudShotPills(shotType) {
    if (typeof document === 'undefined') return;
    const pills = document.querySelectorAll('[data-shot-type]');
    if (!pills || pills.length === 0) return;
    pills.forEach((el) => {
      el.classList.toggle('active', el.dataset.shotType === shotType);
    });
  }

  _notifyStatus(status) {
    if (typeof this.onStatusChange === 'function') {
      this.onStatusChange(status);
    }
    for (const fn of this._listeners.status) {
      try { fn(status); } catch (e) { console.error(e); }
    }
  }

  dispose() {
    this._disposed = true;
    this.disableWebcam();
    this.stopPhonePolling();
    if (this._rafId) cancelAnimationFrame(this._rafId);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
  }
}

export default MotionController;
