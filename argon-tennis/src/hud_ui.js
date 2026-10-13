// ============================================================================
// Argon Tennis — Authentic Argon Tennis Tennis HUD, Scoreboard & 2D Mii Portraits
// ============================================================================

import { renderAllHudMiiAvatars, renderMiiAvatar } from './mii_avatars.js';

export class HudUI {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.bannerTimer = null;
    this.timingPopupTimer = null;
    this.skillHistory = [980, 1005, 1030, 1065, 1120];
    this.selectedGamesToWin = 2; // Best of 3 default
    this.selectedInputMode = 'mouse';
    this.selectedDifficulty = 'casual';
    this.currentRoomId = 'default';
    this.currentTunnelUrl = (typeof window !== 'undefined' && window.location ? window.location.origin : '');

    // Cache DOM elements
    this.elTitleModal = document.getElementById('title-modal');
    this.elCompanionModal = document.getElementById('companion-modal');
    this.elVictoryModal = document.getElementById('victory-modal');

    this.elScoreCenter = document.getElementById('score-center-display');
    this.elScorePlayer = document.getElementById('score-player-text');
    this.elScoreSep = document.getElementById('score-separator');
    this.elScoreOpponent = document.getElementById('score-opponent-text');

    this.elGamesPlayer = document.getElementById('games-pill-player');
    this.elGamesOpponent = document.getElementById('games-pill-opponent');

    this.elServerTag = document.getElementById('server-tag');
    this.elPlayerNameplate = document.getElementById('player-nameplate');
    this.elTimingPopup = document.getElementById('timing-popup');
    this.elTimingGrade = document.getElementById('timing-popup-grade');
    this.elTimingDetail = document.getElementById('timing-popup-detail');

    this.elBannerLayer = document.getElementById('center-banner-layer');
    this.elBannerText = document.getElementById('center-banner-text');
    this.elBannerSub = document.getElementById('center-banner-sub');

    this.elReplayBadge = document.getElementById('replay-badge');
    this.elTimingCursor = document.getElementById('timing-cursor');
    this.elGaugeModeTitle = document.getElementById('gauge-mode-title');
    this.elGaugeSpeedReadout = document.getElementById('gauge-speed-readout');

    this.elAudioDot = document.getElementById('audio-status-dot');
    this.elAudioLabel = document.getElementById('audio-track-label');
    this.elCameraLabel = document.getElementById('camera-mode-label');

    this.elWebcamPip = document.getElementById('webcam-pip-card');
    this.elWebcamDot = document.getElementById('webcam-status-dot');
    this.elPhoneDot = document.getElementById('phone-status-dot');
    this.elPhoneLabel = document.getElementById('phone-status-label');

    this.elOpponentPresencePill = document.getElementById('opponent-presence-pill');
    this.elOpponentPresenceText = document.getElementById('opponent-presence-text');
    this._lastRoomStatus = {};
    this._lastOtherReady = false;
    this._justJoinedTimer = null;

    this._renderAllMiiPortraits();
    this._bindEvents();
    this._initUrlParamsState();
  }

  // --------------------------------------------------------------------------
  // Render Crisp Argon Tennis SVG & HiDPI Mii Portraits Across HUD
  // --------------------------------------------------------------------------
  _renderAllMiiPortraits() {
    renderAllHudMiiAvatars();
  }

  _drawMiiFace(canvas, opts = {}) {
    renderMiiAvatar(canvas, opts.characterId || canvas?.id || 'player1', opts);
  }

  _initUrlParamsState() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = (params.get('room') || '').trim().toUpperCase();
    const roleParam = (params.get('role') || 'p1').trim().toLowerCase() === 'p2' ? 'p2' : 'p1';
    const modeParam = (params.get('mode') || params.get('difficulty') || '').toLowerCase();
    this.playerRole = roleParam;

    if (roomParam && roomParam !== 'DEFAULT') {
      this.currentRoomId = roomParam;
      this._setDifficultySelection('1v1', { notify: false });
    } else if (['casual', 'pro', '1v1'].includes(modeParam)) {
      this._setDifficultySelection(modeParam, { notify: false });
    }

    if (roleParam === 'p2') {
      const youTag = document.querySelector('.you-tag');
      if (youTag) youTag.textContent = 'Player 1';
      const oppLabel = document.getElementById('setup-opponent-label');
      if (oppLabel) oppLabel.textContent = 'You';
    }

    this.updateMultiplayerRoomInfo({
      roomId: this.currentRoomId,
      tunnelUrl: this.currentTunnelUrl,
      role: this.playerRole,
    });
  }

  _setDifficultySelection(difficulty, { notify = true } = {}) {
    const norm = ['casual', 'pro', '1v1'].includes(difficulty) ? difficulty : 'casual';
    this.selectedDifficulty = norm;

    const diffBtns = document.querySelectorAll('#difficulty-mode-group .wii-green-choice');
    diffBtns.forEach((b) => {
      b.classList.toggle('selected', b.dataset.difficulty === norm);
    });

    const matchLengthSection = document.getElementById('match-length-section');
    if (norm === '1v1') {
      if (matchLengthSection) matchLengthSection.classList.add('hidden');
      this.selectedGamesToWin = 1;
      this.configureGameBubbles(1);
      if (notify && this.callbacks.onSelectMatchLength) {
        this.callbacks.onSelectMatchLength(1);
      }
    } else {
      if (matchLengthSection) matchLengthSection.classList.remove('hidden');
      const selectedLengthBtn = document.querySelector('#match-length-group .wii-green-choice.selected');
      const totalGames = parseInt(selectedLengthBtn?.dataset?.games || '3', 10);
      this.selectedGamesToWin = Math.ceil(totalGames / 2);
      this.configureGameBubbles(this.selectedGamesToWin);
      if (notify && this.callbacks.onSelectMatchLength) {
        this.callbacks.onSelectMatchLength(this.selectedGamesToWin);
      }
    }

    const oppLabel = document.getElementById('setup-opponent-label');
    if (oppLabel && this.playerRole !== 'p2') {
      if (norm === '1v1') {
        oppLabel.textContent = 'Player 2';
      } else if (norm === 'pro') {
        oppLabel.textContent = 'Matt';
      } else {
        oppLabel.textContent = 'Club AI';
      }
    }

    this.updateOpponentPresence(this._lastRoomStatus || {});

    if (notify && this.callbacks.onSelectDifficulty) {
      this.callbacks.onSelectDifficulty(norm);
    }
  }

  // --------------------------------------------------------------------------
  // Bind DOM Controls & Modals
  // --------------------------------------------------------------------------
  _bindEvents() {
    // Difficulty / Opponent Mode Buttons (Casual AI | Pro AI | 1v1 Match)
    const diffBtns = document.querySelectorAll('#difficulty-mode-group .wii-green-choice');
    diffBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const diff = btn.dataset.difficulty || 'casual';
        this._setDifficultySelection(diff, { notify: true });
      });
    });

    // Match Length Buttons
    const lengthBtns = document.querySelectorAll('#match-length-group .wii-green-choice');
    lengthBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        lengthBtns.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        const totalGames = parseInt(btn.dataset.games || '3', 10);
        this.selectedGamesToWin = Math.ceil(totalGames / 2);
        this.configureGameBubbles(this.selectedGamesToWin);
        if (this.callbacks.onSelectMatchLength) {
          this.callbacks.onSelectMatchLength(this.selectedGamesToWin);
        }
      });
    });

    // Input Mode Buttons
    const inputBtns = document.querySelectorAll('#input-mode-group .wii-cyan-choice');
    inputBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        inputBtns.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedInputMode = btn.dataset.input || 'mouse';
        if (this.callbacks.onSelectInputMode) {
          this.callbacks.onSelectInputMode(this.selectedInputMode);
        }
      });
    });

    // Start Match Button
    const startBtn = document.getElementById('btn-start-match');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.hideTitleModal();
        if (this.callbacks.onStartMatch) {
          this.callbacks.onStartMatch({
            gamesToWin: this.selectedGamesToWin,
            inputMode: this.selectedInputMode,
            difficulty: this.selectedDifficulty,
          });
        }
      });
    }

    // Audio Toggle
    const audioBtn = document.getElementById('btn-audio-toggle');
    if (audioBtn) {
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onToggleAudio) {
          this.callbacks.onToggleAudio();
        }
      });
    }

    // Camera Cycle
    const camBtn = document.getElementById('btn-camera-cycle');
    if (camBtn) {
      camBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onCycleCamera) {
          this.callbacks.onCycleCamera();
        }
      });
    }

    // Replay Toggle
    const replayBtn = document.getElementById('btn-replay-trigger');
    if (replayBtn) {
      replayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onToggleReplay) {
          this.callbacks.onToggleReplay();
        }
      });
    }

    // Webcam Toggle
    const webcamBtn = document.getElementById('btn-webcam-toggle');
    if (webcamBtn) {
      webcamBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onToggleWebcam) {
          this.callbacks.onToggleWebcam();
        }
      });
    }

    // Phone Companion & 1v1 Multiplayer Hub Modal Buttons
    const phoneBtn = document.getElementById('btn-phone-racket');
    if (phoneBtn) {
      phoneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openMultiplayerModal();
      });
    }

    const mpBtn = document.getElementById('btn-multiplayer-modal');
    if (mpBtn) {
      mpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openMultiplayerModal();
      });
    }

    const createRoomBtn = document.getElementById('btn-create-1v1-room');
    if (createRoomBtn) {
      createRoomBtn.addEventListener('click', async () => {
        createRoomBtn.disabled = true;
        createRoomBtn.textContent = 'Creating...';
        try {
          if (this.callbacks.onCreateMultiplayerRoom) {
            const data = await this.callbacks.onCreateMultiplayerRoom();
            if (data && data.roomId) {
              this.currentRoomId = data.roomId;
              this._setDifficultySelection('1v1', { notify: false });
              this.updateMultiplayerRoomInfo({
                roomId: data.roomId,
                tunnelUrl: data.tunnelUrl || this.currentTunnelUrl,
                urls: data.urls,
              });
            }
          }
        } finally {
          createRoomBtn.disabled = false;
          createRoomBtn.textContent = '+ New 1v1 Room';
        }
      });
    }

    const saveTunnelBtn = document.getElementById('btn-save-tunnel-url');
    if (saveTunnelBtn) {
      saveTunnelBtn.addEventListener('click', async () => {
        const input = document.getElementById('tunnel-url-input');
        const rawUrl = (input ? input.value : '').trim().replace(/\/+$/, '');
        if (!rawUrl) return;
        this.currentTunnelUrl = rawUrl;
        try {
          await fetch('/api/tunnel/url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tunnelUrl: rawUrl }),
          });
        } catch (_) {}
        this.updateMultiplayerRoomInfo({
          roomId: this.currentRoomId,
          tunnelUrl: this.currentTunnelUrl,
        });
        saveTunnelBtn.textContent = 'Saved ✓';
        setTimeout(() => {
          saveTunnelBtn.textContent = 'Update Tunnel';
        }, 1400);
      });
    }

    const closeCompanionBtn = document.getElementById('btn-close-companion');
    if (closeCompanionBtn) {
      closeCompanionBtn.addEventListener('click', () => {
        if (this.elCompanionModal) this.elCompanionModal.classList.add('hidden');
      });
    }

    // Victory Modal Play Again / Menu
    const playAgainBtn = document.getElementById('btn-play-again');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        this.hideVictoryModal();
        if (this.callbacks.onPlayAgain) {
          this.callbacks.onPlayAgain();
        }
      });
    }

    const returnTitleBtn = document.getElementById('btn-return-title');
    if (returnTitleBtn) {
      returnTitleBtn.addEventListener('click', () => {
        this.hideVictoryModal();
        this.showTitleModal();
      });
    }
  }

  async openMultiplayerModal() {
    if (!this.elCompanionModal) return;
    try {
      const res = await fetch('/api/tunnel/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.tunnelUrl) {
          this.currentTunnelUrl = data.tunnelUrl;
          const input = document.getElementById('tunnel-url-input');
          if (input) input.value = data.tunnelUrl;
        }
      }
    } catch (_) {}

    this.updateMultiplayerRoomInfo({
      roomId: this.currentRoomId,
      tunnelUrl: this.currentTunnelUrl,
    });
    this.elCompanionModal.classList.remove('hidden');
  }

  // --------------------------------------------------------------------------
  // Modal Visibility Helpers
  // --------------------------------------------------------------------------
  hideTitleModal() {
    document.documentElement.classList.add('autoplay-mode');
    if (this.elTitleModal) {
      this.elTitleModal.classList.add('hidden');
      this.elTitleModal.style.display = 'none';
    }
  }

  showTitleModal() {
    document.documentElement.classList.remove('autoplay-mode');
    if (this.elTitleModal) {
      this.elTitleModal.classList.remove('hidden');
      this.elTitleModal.style.display = 'flex';
    }
  }

  hideVictoryModal() {
    if (this.elVictoryModal) this.elVictoryModal.classList.add('hidden');
  }

  showVictoryModal({ playerWon, playerGames, opponentGames }) {
    if (!this.elVictoryModal) return;
    const banner = document.getElementById('victory-result-banner');
    const scoreEl = document.getElementById('victory-match-score');
    const ratingEl = document.getElementById('skill-rating-value');

    if (banner) {
      banner.textContent = playerWon ? 'YOU WIN!' : 'TRY AGAIN!';
      banner.style.color = playerWon ? '#ffea28' : '#9ad4ff';
    }
    if (scoreEl) {
      scoreEl.textContent = `Final Games: ${playerGames} - ${opponentGames}`;
    }
    const latestSkill = playerWon ? 1145 : 1020;
    if (ratingEl) ratingEl.textContent = String(latestSkill);

    this._drawSkillGraph(playerWon);
    this.elVictoryModal.classList.remove('hidden');
  }

  _drawSkillGraph(playerWon) {
    const canvas = document.getElementById('skill-graph-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background grid (matches storyboard_sheet_5.jpg)
    ctx.fillStyle = '#f8fbff';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#d0dce8';
    ctx.lineWidth = 1;
    for (let y = 25; y < h; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // PRO 1000 dashed threshold line
    const proY = h * 0.56;
    ctx.strokeStyle = '#9aaab8';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, proY);
    ctx.lineTo(w, proY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#6c7c8c';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('PRO 1000', 8, proY - 5);

    // Skill curve
    const pts = playerWon
      ? [0.74, 0.66, 0.58, 0.45, 0.24]
      : [0.74, 0.66, 0.58, 0.52, 0.55];
    ctx.strokeStyle = '#1f96f2';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((py, i) => {
      const x = 24 + (i / (pts.length - 1)) * (w - 48);
      const y = h * py;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Endpoint dot
    const lastX = w - 24;
    const lastY = h * pts[pts.length - 1];
    ctx.fillStyle = '#ffea28';
    ctx.beginPath();
    ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#006cc4';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // --------------------------------------------------------------------------
  // Scoreboard & Game Bubble Updates
  // --------------------------------------------------------------------------
  configureGameBubbles(gamesToWin = 2) {
    [this.elGamesPlayer, this.elGamesOpponent].forEach((container) => {
      if (!container) return;
      const bubbles = container.querySelectorAll('.game-bubble');
      bubbles.forEach((b, idx) => {
        if (idx < Math.max(1, gamesToWin)) {
          b.classList.remove('hidden');
        } else {
          b.classList.add('hidden');
        }
      });
    });
  }

  updateScoreboard({
    playerScoreText = '00',
    opponentScoreText = '00',
    deuceLabel = null,
    playerGames = 0,
    opponentGames = 0,
    gamesToWin = 2,
  }) {
    if (!this.elScoreCenter) return;

    if (deuceLabel) {
      this.elScoreCenter.classList.add('deuce-mode');
      this.elScorePlayer.textContent = deuceLabel;
      this.elScoreSep.classList.add('hidden');
      this.elScoreOpponent.classList.add('hidden');
    } else {
      this.elScoreCenter.classList.remove('deuce-mode');
      this.elScorePlayer.textContent = playerScoreText;
      this.elScoreSep.classList.remove('hidden');
      this.elScoreOpponent.classList.remove('hidden');
      this.elScoreOpponent.textContent = opponentScoreText;
    }

    this.configureGameBubbles(gamesToWin);

    if (this.elGamesPlayer) {
      const bubbles = this.elGamesPlayer.querySelectorAll('.game-bubble');
      bubbles.forEach((b, i) => b.classList.toggle('won', i < playerGames));
    }
    if (this.elGamesOpponent) {
      const bubbles = this.elGamesOpponent.querySelectorAll('.game-bubble');
      bubbles.forEach((b, i) => b.classList.toggle('won', i < opponentGames));
    }
  }

  // --------------------------------------------------------------------------
  // 3D-Projected Floating Server Tag & Court Nameplates
  // --------------------------------------------------------------------------
  updateServerTag(screenPos, visible) {
    if (!this.elServerTag) return;
    if (!visible || !screenPos || !screenPos.visible) {
      this.elServerTag.classList.add('hidden');
      return;
    }
    this.elServerTag.classList.remove('hidden');
    const clampedX = Math.max(80, Math.min(window.innerWidth - 80, screenPos.x));
    const clampedY = Math.max(95, Math.min(window.innerHeight - 90, screenPos.y));
    this.elServerTag.style.left = `${clampedX.toFixed(1)}px`;
    this.elServerTag.style.top = `${clampedY.toFixed(1)}px`;
  }

  updatePlayerNameplate(screenPos, visible) {
    if (!this.elPlayerNameplate) return;
    if (!visible || !screenPos || !screenPos.visible) {
      this.elPlayerNameplate.classList.add('hidden');
      return;
    }
    this.elPlayerNameplate.classList.remove('hidden');
    const clampedX = Math.max(90, Math.min(window.innerWidth - 90, screenPos.x));
    const clampedY = Math.max(120, Math.min(window.innerHeight - 50, screenPos.y));
    this.elPlayerNameplate.style.left = `${clampedX.toFixed(1)}px`;
    this.elPlayerNameplate.style.top = `${clampedY.toFixed(1)}px`;
  }

  showTimingPopup({ grade = 'PERFECT', detail = 'POWER TOPSPIN • 176 KM/H', screenPos = null, durationMs = 1100 }) {
    if (!this.elTimingPopup) return;
    if (this.timingPopupTimer) clearTimeout(this.timingPopupTimer);

    this.elTimingGrade.textContent = grade;
    this.elTimingGrade.className = 'timing-grade';
    if (grade.includes('EARLY')) this.elTimingGrade.classList.add('grade-early');
    else if (grade.includes('LATE')) this.elTimingGrade.classList.add('grade-late');
    else this.elTimingGrade.classList.add('grade-perfect');

    this.elTimingDetail.textContent = detail;

    if (screenPos && screenPos.visible) {
      const x = Math.max(110, Math.min(window.innerWidth - 110, screenPos.x));
      const y = Math.max(110, Math.min(window.innerHeight - 120, screenPos.y));
      this.elTimingPopup.style.left = `${x.toFixed(1)}px`;
      this.elTimingPopup.style.top = `${y.toFixed(1)}px`;
    } else {
      this.elTimingPopup.style.left = '50%';
      this.elTimingPopup.style.top = '54%';
    }

    this.elTimingPopup.classList.remove('hidden');
    if (durationMs > 0) {
      this.timingPopupTimer = setTimeout(() => {
        this.elTimingPopup.classList.add('hidden');
      }, durationMs);
    }
  }

  // --------------------------------------------------------------------------
  // Glossy Center Banner Callouts ("Start", "Game Point", "15 - 00", "Game!")
  // --------------------------------------------------------------------------
  showCenterBanner(text, { style = 'style-gold', subText = '', durationMs = 1500, persistent = false } = {}) {
    if (!this.elBannerLayer || !this.elBannerText) return;
    if (this.bannerTimer) {
      clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }

    this.elBannerText.textContent = text;
    this.elBannerText.className = `center-banner-text ${style}`;

    if (this.elBannerSub) {
      if (subText) {
        this.elBannerSub.textContent = subText;
        this.elBannerSub.classList.remove('hidden');
      } else {
        this.elBannerSub.classList.add('hidden');
      }
    }

    this.elBannerLayer.classList.remove('hidden');

    if (!persistent && durationMs > 0) {
      this.bannerTimer = setTimeout(() => {
        this.hideCenterBanner();
      }, durationMs);
    }
  }

  hideCenterBanner() {
    if (this.bannerTimer) {
      clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }
    if (this.elBannerLayer) {
      this.elBannerLayer.classList.add('hidden');
    }
  }

  // --------------------------------------------------------------------------
  // Instant Replay Badge & Bottom Dock Status
  // --------------------------------------------------------------------------
  setReplayMode(active) {
    document.body.classList.toggle('replay-mode', Boolean(active));
    if (this.elReplayBadge) {
      this.elReplayBadge.classList.toggle('hidden', !active);
    }
  }

  setActiveShotChip(_shotType) {
    // No-op: shot type is determined by swing motion/mechanics, not on-screen buttons.
  }

  updateTimingGauge({ cursorNormalized = 0.5, modeTitle = 'SWING TIMING', speedText = 'READY' }) {
    if (this.elTimingCursor) {
      const pct = Math.max(4, Math.min(96, cursorNormalized * 100));
      this.elTimingCursor.style.left = `${pct.toFixed(1)}%`;
    }
    if (this.elGaugeModeTitle) this.elGaugeModeTitle.textContent = modeTitle;
    if (this.elGaugeSpeedReadout) this.elGaugeSpeedReadout.textContent = speedText;
  }

  updateAudioStatus({ playing, trackName }) {
    if (this.elAudioDot) {
      this.elAudioDot.classList.toggle('music-on', Boolean(playing));
    }
    if (this.elAudioLabel) {
      this.elAudioLabel.textContent = playing ? `Lyria: ${trackName || 'Sunny Rally'}` : 'Lyria: Muted';
    }
  }

  updateCameraLabel(modeName) {
    if (this.elCameraLabel) {
      this.elCameraLabel.textContent = modeName;
    }
  }

  updateMotionStatus({ webcamActive = false, phoneConnected = false, p1Phone = false, p2Phone = false }) {
    if (this.elWebcamPip) {
      this.elWebcamPip.classList.toggle('hidden', !webcamActive);
    }
    if (this.elWebcamDot) {
      this.elWebcamDot.classList.toggle('active', Boolean(webcamActive));
    }
    if (this.elPhoneDot) {
      this.elPhoneDot.classList.toggle('active', Boolean(phoneConnected || p1Phone || p2Phone));
    }
    if (this.elPhoneLabel) {
      if (p1Phone && p2Phone) {
        this.elPhoneLabel.textContent = 'P1 & P2 Rackets';
      } else if (phoneConnected || p1Phone || p2Phone) {
        this.elPhoneLabel.textContent = 'Racket Connected';
      } else {
        this.elPhoneLabel.textContent = 'Pocket Racket';
      }
    }
  }

  updateMultiplayerRoomInfo(roomStatus = {}) {
    const merged = { ...(this._lastRoomStatus || {}), ...roomStatus };
    this._lastRoomStatus = merged;

    if (merged.roomId) {
      this.currentRoomId = String(merged.roomId).toLowerCase();
    }
    if (merged.role) {
      this.playerRole = String(merged.role).toLowerCase() === 'p2' ? 'p2' : 'p1';
    }
    if (merged.tunnelUrl) {
      this.currentTunnelUrl = String(merged.tunnelUrl).replace(/\/+$/, '');
      const tunnelInput = document.getElementById('tunnel-url-input');
      if (tunnelInput && document.activeElement !== tunnelInput) {
        tunnelInput.value = this.currentTunnelUrl;
      }
    }

    const isP2 = this.playerRole === 'p2';
    const cardP1 = document.getElementById('mp-card-p1');
    const cardP2 = document.getElementById('mp-card-p2');
        const newRoomBtn = document.getElementById('btn-create-1v1-room');

    if (cardP1) cardP1.classList.toggle('hidden', isP2);
    if (cardP2) cardP2.classList.toggle('hidden', !isP2);
        if (newRoomBtn) newRoomBtn.classList.toggle('hidden', isP2);

    const roomBadge = document.getElementById('companion-room-badge');
    if (roomBadge) {
      roomBadge.textContent = `ROOM #${this.currentRoomId.toUpperCase()} • ${isP2 ? 'PLAYER 2' : 'PLAYER 1'}`;
    }

    const roomEnc = encodeURIComponent(this.currentRoomId);
    const tunnelBase = (this.currentTunnelUrl || window.location.origin).replace(/\/+$/, '');
    const p1CompanionUrl = `${tunnelBase}/companion.html?room=${roomEnc}&role=p1`;
    const p2CompanionUrl = `${tunnelBase}/companion.html?room=${roomEnc}&role=p2`;

    const linkP1 = document.getElementById('companion-link');
    if (linkP1) {
      linkP1.href = p1CompanionUrl;
    }
    const linkP2 = document.getElementById('companion-link-p2');
    if (linkP2) {
      linkP2.href = p2CompanionUrl;
    }

    const qrP1 = document.getElementById('companion-qr');
    if (qrP1) {
      const targetSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&format=png&data=${encodeURIComponent(p1CompanionUrl)}`;
      if (qrP1.dataset.lastSrc !== targetSrc) {
        qrP1.src = targetSrc;
        qrP1.dataset.lastSrc = targetSrc;
      }
    }
    const qrP2 = document.getElementById('companion-qr-p2');
    if (qrP2) {
      const targetSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&format=png&data=${encodeURIComponent(p2CompanionUrl)}`;
      if (qrP2.dataset.lastSrc !== targetSrc) {
        qrP2.src = targetSrc;
        qrP2.dataset.lastSrc = targetSrc;
      }
    }

    const courtP1 = document.getElementById('court-link-p1');
    if (courtP1) {
      courtP1.href = `/?room=${roomEnc}&role=p1`;
    }
    const courtP2 = document.getElementById('court-link-p2');
    if (courtP2) {
      courtP2.href = `/?room=${roomEnc}&role=p2`;
    }

    const p1Status = document.getElementById('mp-p1-status');
    if (p1Status) {
      const active = Boolean(merged.p1Phone || merged.p1Online);
      p1Status.textContent = merged.p1Phone ? 'Connected ✓' : active ? 'Court Ready' : 'Scan QR';
      p1Status.classList.toggle('online', Boolean(merged.p1Phone));
    }

    const p2Status = document.getElementById('mp-p2-status');
    if (p2Status) {
      const active = Boolean(merged.p2Phone || merged.p2Online);
      p2Status.textContent = merged.p2Phone ? 'Connected ✓' : active ? 'Court Ready' : 'Scan QR';
      p2Status.classList.toggle('online', Boolean(merged.p2Phone));
    }

    const activeStatusBadge = document.getElementById('mp-active-status');
    if (activeStatusBadge) {
      const myPhoneConnected = isP2 ? Boolean(merged.p2Phone) : Boolean(merged.p1Phone);
      activeStatusBadge.textContent = myPhoneConnected ? 'Connected ✓' : 'Scan QR';
      activeStatusBadge.classList.toggle('online', myPhoneConnected);
    }

    this.updateOpponentPresence(merged);
  }

  updateOpponentPresence(status = {}) {
    const is1v1 = Boolean(
      status.isMultiplayer ||
      this.selectedDifficulty === '1v1' ||
      (this.currentRoomId && this.currentRoomId !== 'default')
    );

    const oppBadge = document.querySelector('.mii-side-opponent .mii-avatar-badge:not(.secondary-mii)');
    if (!is1v1) {
      if (this.elOpponentPresencePill) {
        this.elOpponentPresencePill.classList.add('hidden');
      }
      if (oppBadge) {
        oppBadge.classList.remove('opponent-ready');
      }
      this._lastOtherReady = false;
      return;
    }

    const hostName = (status.hostName && status.hostName.trim()) ? status.hostName.trim() : 'Player 1';
    const guestName = (status.guestName && status.guestName.trim()) ? status.guestName.trim() : 'Player 2';
    const isP2 = this.playerRole === 'p2';

    let otherReady = false;
    let labelText = '';

    if (isP2) {
      otherReady = Boolean(status.p2Phone || status.p1Phone || status.p1Online);
      if (status.p2Phone) {
        labelText = `Racket Ready • ${hostName} Joined`;
      } else if (status.p1Phone || status.p1Online) {
        labelText = `${hostName} Ready • Scan QR for Phone Racket`;
      } else {
        labelText = `Waiting for ${hostName}…`;
      }
    } else {
      otherReady = Boolean(status.p2Phone || status.p2Online);
      if (status.p2Phone && status.p2Online) {
        labelText = `${guestName} Connected • Ready to Serve!`;
      } else if (status.p2Phone) {
        labelText = `${guestName}'s Racket Ready • Ready to Serve!`;
      } else if (status.p2Online) {
        labelText = `${guestName} Joined • Ready to Serve!`;
      } else {
        labelText = `Waiting for ${guestName}…`;
      }
    }

    if (this.elOpponentPresencePill) {
      this.elOpponentPresencePill.classList.remove('hidden');
      this.elOpponentPresencePill.classList.toggle('ready', otherReady);
      this.elOpponentPresencePill.classList.toggle('in-rally', Boolean(status.inRally));

      if (otherReady && !this._lastOtherReady) {
        this.elOpponentPresencePill.classList.remove('just-joined');
        void this.elOpponentPresencePill.offsetWidth;
        this.elOpponentPresencePill.classList.add('just-joined');
        if (this._justJoinedTimer) clearTimeout(this._justJoinedTimer);
        this._justJoinedTimer = setTimeout(() => {
          if (this.elOpponentPresencePill) {
            this.elOpponentPresencePill.classList.remove('just-joined');
          }
        }, 950);
      }
    }

    if (this.elOpponentPresenceText) {
      this.elOpponentPresenceText.textContent = labelText;
    }

    if (oppBadge) {
      oppBadge.classList.toggle('opponent-ready', otherReady);
    }

    const oppSetupLabel = document.getElementById('setup-opponent-label');
    if (oppSetupLabel && this.selectedDifficulty === '1v1' && !isP2) {
      oppSetupLabel.textContent = otherReady ? `🟢 ${guestName} Ready` : guestName;
    }

    this._lastOtherReady = otherReady;
  }
}
