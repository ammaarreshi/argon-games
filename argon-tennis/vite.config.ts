import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

interface ReqLike {
  url?: string;
  method?: string;
  on(event: string, listener: (...args: any[]) => void): void;
}

interface ResLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface SwingRecord {
  seq: number;
  role: string;
  type: string;
  shotType: string;
  speed: number;
  angleX: number;
  dirX: number;
  dirY: number;
  pitch: number;
  roll: number;
  yaw: number;
  timestamp: number;
  serverTimeMs: number;
  source: string;
}

interface RacketSlot {
  role: string;
  seq: number;
  lastSeenTs: number;
  connected: boolean;
  orientation: {
    pitch: number;
    roll: number;
    yaw: number;
    accelMag: number;
    buttonB: boolean;
    connected: boolean;
  };
  lastSwing: SwingRecord | null;
  swingHistory: SwingRecord[];
  feedbackSeq: number;
  lastFeedback: Record<string, unknown> | null;
}

interface RoomRecord {
  roomId: string;
  hostName: string;
  guestName: string;
  gamesToWin: number;
  rackets: { p1: RacketSlot; p2: RacketSlot };
  stateSeq: number;
  matchSnapshot: Record<string, unknown> | null;
  p1DesktopSeenTs: number;
  p2DesktopSeenTs: number;
}

function createRacketSlot(role: string): RacketSlot {
  return {
    role,
    seq: 0,
    lastSeenTs: 0,
    connected: false,
    orientation: {
      pitch: 0,
      roll: 0,
      yaw: 0,
      accelMag: 0,
      buttonB: false,
      connected: false,
    },
    lastSwing: null,
    swingHistory: [],
    feedbackSeq: 0,
    lastFeedback: null,
  };
}

function createRoomRecord(roomId: string, hostName = 'Player 1', guestName = 'Player 2', gamesToWin = 2): RoomRecord {
  return {
    roomId,
    hostName,
    guestName,
    gamesToWin,
    rackets: {
      p1: createRacketSlot('p1'),
      p2: createRacketSlot('p2'),
    },
    stateSeq: 0,
    matchSnapshot: null,
    p1DesktopSeenTs: 0,
    p2DesktopSeenTs: 0,
  };
}

function getSlotState(slot: RacketSlot) {
  const now = Date.now();
  const lastSeenMs = slot.lastSeenTs > 0 ? Math.max(0, now - slot.lastSeenTs) : -1;
  const isConnected = slot.connected && lastSeenMs >= 0 && lastSeenMs < 12000;
  return {
    role: slot.role,
    connected: isConnected,
    lastSeenMs,
    orientation: { ...slot.orientation, connected: isConnected },
    lastSwing: slot.lastSwing ? { ...slot.lastSwing } : null,
    lastFeedback: slot.lastFeedback ? { ...slot.lastFeedback } : null,
    swingHistory: slot.swingHistory.slice(-15),
  };
}

function readJsonBody(req: ReqLike): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    req.on('data', (chunk: unknown) => chunks.push(String(chunk)));
    req.on('end', () => {
      try {
        const raw = chunks.join('');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res: ResLike, status: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.end(body);
}

function argonTennisRelayPlugin(): Plugin {
  const rooms = new Map<string, RoomRecord>();
  rooms.set('default', createRoomRecord('default'));
  const cloudBaseUrl = 'http://localhost:8080';

  const getRoom = (roomIdRaw?: string | null): RoomRecord => {
    const clean = (roomIdRaw || 'default').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase() || 'default';
    const key = clean === 'DEFAULT' ? 'default' : clean;
    let room = rooms.get(key);
    if (!room) {
      room = createRoomRecord(key);
      rooms.set(key, room);
    }
    return room;
  };

  const attachMiddleware = (middlewares: { use: (fn: (req: ReqLike, res: ResLike, next: () => void) => void) => void }) => {
    middlewares.use(async (req, res, next) => {
      const rawUrl = req.url || '/';
      const parsed = new URL(rawUrl, 'http://localhost:3000');
      const pathname = parsed.pathname;

      if (pathname === '/___rPc_sWiTcH___') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('OK');
        return;
      }

      if (pathname.startsWith('/assets/models/') || pathname.startsWith('/assets/audio/')) {
        res.statusCode = 302;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Location', `${cloudBaseUrl}${pathname}`);
        res.end();
        return;
      }

      if (!pathname.startsWith('/api/')) {
        next();
        return;
      }

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.end();
        return;
      }

      const qRoom = parsed.searchParams.get('room') || 'default';
      const qRoleRaw = (parsed.searchParams.get('role') || 'p1').toLowerCase();
      const qRole: 'p1' | 'p2' = qRoleRaw === 'p2' || qRoleRaw === '2' || qRoleRaw === 'opponent' ? 'p2' : 'p1';

      if (req.method === 'GET' && pathname === '/api/racket/state') {
        const room = getRoom(qRoom);
        const slot = room.rackets[qRole];
        sendJson(res, 200, {
          ...getSlotState(slot),
          roomId: room.roomId,
          tunnelUrl: cloudBaseUrl,
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/tunnel/status') {
        const room = getRoom(qRoom);
        const roomParam = room.roomId !== 'default' ? `room=${room.roomId}&` : '';
        sendJson(res, 200, {
          ok: true,
          active: true,
          tunnelUrl: cloudBaseUrl,
          companionUrl: `${cloudBaseUrl}/companion.html?${roomParam}role=${qRole}`,
          joinUrl: `${cloudBaseUrl}/join.html?room=${room.roomId}&role=${qRole}`,
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/match/state') {
        const room = getRoom(qRoom);
        const touch = parsed.searchParams.get('touch');
        if (touch === 'p1' || touch === 'p2') {
          if (touch === 'p2') room.p2DesktopSeenTs = Date.now();
          else room.p1DesktopSeenTs = Date.now();
        }
        const now = Date.now();
        const p1Racket = getSlotState(room.rackets.p1);
        const p2Racket = getSlotState(room.rackets.p2);
        const p1DesktopOnline = room.p1DesktopSeenTs > 0 && now - room.p1DesktopSeenTs < 8000;
        const p2DesktopOnline = room.p2DesktopSeenTs > 0 && now - room.p2DesktopSeenTs < 8000;
        sendJson(res, 200, {
          ok: true,
          roomId: room.roomId,
          hostName: room.hostName,
          guestName: room.guestName,
          gamesToWin: room.gamesToWin,
          p1Online: p1DesktopOnline,
          p2Online: p2DesktopOnline,
          p1DesktopOnline,
          p2DesktopOnline,
          p1PhoneConnected: p1Racket.connected,
          p2PhoneConnected: p2Racket.connected,
          p1: p1Racket,
          p2: p2Racket,
          rackets: { p1: p1Racket, p2: p2Racket },
          snapshotSeq: room.stateSeq,
          snapshot: room.matchSnapshot,
          tunnelUrl: cloudBaseUrl,
        });
        return;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const roomId = String(body.room || qRoom || 'default');
        const roleRaw = String(body.role || qRole || 'p1').toLowerCase();
        const role: 'p1' | 'p2' = roleRaw === 'p2' || roleRaw === '2' || roleRaw === 'opponent' ? 'p2' : 'p1';
        const room = getRoom(roomId);
        const slot = room.rackets[role];

        if (pathname === '/api/racket/swing') {
          const now = Date.now();
          slot.seq += 1;
          slot.lastSeenTs = now;
          slot.connected = true;
          const swing: SwingRecord = {
            seq: slot.seq,
            role: slot.role,
            type: String(body.type || 'swing').toLowerCase() === 'toss' ? 'toss' : 'swing',
            shotType: String(body.shotType || 'topspin').toLowerCase(),
            speed: Number(body.speed ?? 1.0),
            angleX: Number(body.angleX ?? body.dirX ?? 0),
            dirX: Number(body.angleX ?? body.dirX ?? 0),
            dirY: Number(body.dirY ?? 0),
            pitch: Number(body.pitch ?? slot.orientation.pitch ?? 0),
            roll: Number(body.roll ?? slot.orientation.roll ?? 0),
            yaw: Number(body.yaw ?? slot.orientation.yaw ?? 0),
            timestamp: Number(body.timestamp ?? now),
            serverTimeMs: now,
            source: String(body.source || 'phone'),
          };
          slot.lastSwing = swing;
          slot.swingHistory.push(swing);
          if (slot.swingHistory.length > 50) slot.swingHistory.shift();
          sendJson(res, 200, { ok: true, roomId: room.roomId, role: slot.role, swing });
          return;
        }

        if (pathname === '/api/racket/telemetry') {
          slot.lastSeenTs = Date.now();
          slot.connected = Boolean(body.connected ?? true);
          slot.orientation = {
            pitch: Number(body.pitch ?? slot.orientation.pitch ?? 0),
            roll: Number(body.roll ?? slot.orientation.roll ?? 0),
            yaw: Number(body.yaw ?? slot.orientation.yaw ?? 0),
            accelMag: Number(body.accelMag ?? 0),
            buttonB: Boolean(body.buttonB ?? false),
            connected: slot.connected,
          };
          sendJson(res, 200, {
            ok: true,
            roomId: room.roomId,
            role: slot.role,
            orientation: slot.orientation,
            lastFeedback: slot.lastFeedback,
          });
          return;
        }

        if (pathname === '/api/racket/feedback') {
          slot.feedbackSeq += 1;
          slot.lastFeedback = {
            seq: slot.feedbackSeq,
            role: slot.role,
            kind: String(body.kind || 'hit'),
            grade: String(body.grade || 'PERFECT'),
            shotType: String(body.shotType || 'TOPSPIN'),
            speedKmh: Number(body.speedKmh ?? 160),
            intensity: Number(body.intensity ?? 1.0),
            serverTimeMs: Date.now(),
          };
          sendJson(res, 200, { ok: true, roomId: room.roomId, feedback: slot.lastFeedback });
          return;
        }

        if (pathname === '/api/match/sync') {
          room.stateSeq += 1;
          room.p1DesktopSeenTs = Date.now();
          const snap = (body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : body) as Record<string, unknown>;
          room.matchSnapshot = { ...snap, seq: room.stateSeq, serverTimeMs: Date.now() };
          sendJson(res, 200, {
            ok: true,
            roomId: room.roomId,
            seq: room.stateSeq,
            p2Racket: getSlotState(room.rackets.p2),
          });
          return;
        }

        if (pathname === '/api/match/create') {
          const newId = 'AT-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          const created = createRoomRecord(
            newId,
            String(body.hostName || 'Ammaar'),
            String(body.guestName || 'Challenger'),
            Number(body.gamesToWin || 2),
          );
          rooms.set(newId, created);
          sendJson(res, 200, {
            ok: true,
            roomId: newId,
            hostDesktopUrl: `${cloudBaseUrl}/?room=${newId}&role=p1`,
            guestDesktopUrl: `${cloudBaseUrl}/?room=${newId}&role=p2`,
            p1PhoneUrl: `${cloudBaseUrl}/companion.html?room=${newId}&role=p1`,
            p2PhoneUrl: `${cloudBaseUrl}/companion.html?room=${newId}&role=p2`,
            guestJoinHubUrl: `${cloudBaseUrl}/join.html?room=${newId}&role=p2`,
          });
          return;
        }
      }

      next();
    });
  };

  return {
    name: 'argon-tennis-relay',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    plugins: [react(), argonTennisRelayPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '../assets/vendor/GLTFLoader.js': 'three/examples/jsm/loaders/GLTFLoader.js',
        '@': path.resolve('.'),
      },
    },
  };
});
