#!/usr/bin/env python3
"""Argon Tennis — HTTP Static Server, 1v1 Multiplayer & Phone Motion-Controller Relay."""

import argparse
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import random
import re
import socket
import string
import sys
import threading
import time
from urllib.parse import parse_qs, quote, urlparse

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

MIME_OVERRIDES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".wasm": "application/wasm",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
}


class RacketRelayState:
  """Thread-safe relay for a single player's mobile phone motion controller."""

  def __init__(self, role: str = "p1"):
    self.role = role
    self._lock = threading.Lock()
    self._seq = 0
    self._last_swing = None
    self._connected_clients = 0
    self._last_heartbeat = 0.0
    self._telemetry_seq = 0
    self._last_telemetry = {
        "seq": 0,
        "swingType": "flat",
        "wristPitch": 0.0,
        "wristRoll": 0.0,
        "swingSpeed": 0.0,
        "accelPeak": 0.0,
        "aimX": 0.0,
        "timestamp": 0.0,
    }
    self._feedback_seq = 0
    self._last_feedback = None

  def record_feedback(self, payload: dict) -> dict:
    with self._lock:
      self._feedback_seq += 1
      self._last_feedback = {
          "seq": self._feedback_seq,
          "grade": str(payload.get("grade", "GOOD")),
          "swingType": str(payload.get("swingType", "flat")),
          "speedKmh": int(payload.get("speedKmh", 95)),
          "isServe": bool(payload.get("isServe", False)),
          "timestamp": time.time(),
      }
      return dict(self._last_feedback)

  def record_swing(self, payload: dict) -> dict:
    with self._lock:
      self._seq += 1
      self._last_heartbeat = time.time()
      self._connected_clients = max(1, self._connected_clients)

      raw_type = str(payload.get("swingType", payload.get("type", "flat"))).lower()
      if raw_type not in ("flat", "topspin", "slice", "lob", "power"):
        raw_type = "flat"

      try:
        speed = float(payload.get("speed", 1.0))
      except (TypeError, ValueError):
        speed = 1.0
      speed = max(0.35, min(1.85, speed))

      try:
        aim_x = float(payload.get("aimX", 0.0))
      except (TypeError, ValueError):
        aim_x = 0.0
      aim_x = max(-1.0, min(1.0, aim_x))

      try:
        wrist_pitch = float(payload.get("wristPitch", 0.0))
      except (TypeError, ValueError):
        wrist_pitch = 0.0
      try:
        wrist_roll = float(payload.get("wristRoll", 0.0))
      except (TypeError, ValueError):
        wrist_roll = 0.0
      try:
        accel_peak = float(payload.get("accelPeak", speed * 18.0))
      except (TypeError, ValueError):
        accel_peak = speed * 18.0

      self._last_swing = {
          "seq": self._seq,
          "role": self.role,
          "swingType": raw_type,
          "speed": round(speed, 3),
          "aimX": round(aim_x, 3),
          "wristPitch": round(wrist_pitch, 1),
          "wristRoll": round(wrist_roll, 1),
          "accelPeak": round(accel_peak, 1),
          "serve": bool(payload.get("serve", False)),
          "timestamp": self._last_heartbeat,
      }
      self._telemetry_seq += 1
      self._last_telemetry = {
          "seq": self._telemetry_seq,
          "swingType": raw_type,
          "wristPitch": round(wrist_pitch, 1),
          "wristRoll": round(wrist_roll, 1),
          "swingSpeed": round(speed, 3),
          "accelPeak": round(accel_peak, 1),
          "aimX": round(aim_x, 3),
          "timestamp": self._last_heartbeat,
      }
      return dict(self._last_swing)

  def record_telemetry(self, payload: dict) -> dict:
    with self._lock:
      now = time.time()
      self._last_heartbeat = now
      self._connected_clients = max(1, self._connected_clients)
      self._telemetry_seq += 1
      self._last_telemetry = {
          "seq": self._telemetry_seq,
          "swingType": str(payload.get("swingType", "flat")).lower(),
          "wristPitch": round(float(payload.get("wristPitch", 0.0) or 0.0), 1),
          "wristRoll": round(float(payload.get("wristRoll", 0.0) or 0.0), 1),
          "swingSpeed": round(float(payload.get("swingSpeed", 0.0) or 0.0), 3),
          "accelPeak": round(float(payload.get("accelPeak", 0.0) or 0.0), 1),
          "aimX": round(float(payload.get("aimX", 0.0) or 0.0), 3),
          "timestamp": now,
      }
      return dict(self._last_telemetry)

  def get_state(self) -> dict:
    with self._lock:
      now = time.time()
      active = (now - self._last_heartbeat) < 25.0
      return {
          "ok": True,
          "role": self.role,
          "connected": active,
          "seq": self._seq,
          "lastSwing": self._last_swing,
          "telemetrySeq": self._telemetry_seq,
          "telemetry": self._last_telemetry,
          "feedbackSeq": self._feedback_seq,
          "lastFeedback": self._last_feedback,
          "serverTime": now,
      }


class MatchRoom:
  """Represents a live 1v1 or solo court room with P1 & P2 rackets + synced court state."""

  def __init__(self, room_id: str, host_name: str = "Player 1", guest_name: str = "Player 2", games_to_win: int = 2):
    self.room_id = room_id
    self.created_at = time.time()
    self.host_name = host_name
    self.guest_name = guest_name
    self.games_to_win = games_to_win
    self.rackets = {
        "p1": RacketRelayState("p1"),
        "p2": RacketRelayState("p2"),
    }
    self._lock = threading.Lock()
    self._match_seq = 0
    self._match_snapshot = None
    self._p1_desktop_heartbeat = 0.0
    self._p2_desktop_heartbeat = 0.0

  def get_racket(self, role: str) -> RacketRelayState:
    norm = "p2" if str(role or "").lower() in ("p2", "2", "opponent", "guest") else "p1"
    return self.rackets[norm]

  def update_match_snapshot(self, payload: dict) -> dict:
    with self._lock:
      self._match_seq += 1
      self._p1_desktop_heartbeat = time.time()
      self._match_snapshot = {
          "seq": self._match_seq,
          "timestamp": self._p1_desktop_heartbeat,
          "state": payload,
      }
      return dict(self._match_snapshot)

  def touch_desktop_role(self, role: str, player_name: str = ""):
    with self._lock:
      now = time.time()
      if str(role or "").lower() in ("p2", "2", "opponent", "guest"):
        self._p2_desktop_heartbeat = now
        if player_name:
          self.guest_name = player_name[:20]
      else:
        self._p1_desktop_heartbeat = now
        if player_name:
          self.host_name = player_name[:20]

  def get_room_state(self) -> dict:
    p1_state = self.rackets["p1"].get_state()
    p2_state = self.rackets["p2"].get_state()
    with self._lock:
      now = time.time()
      return {
          "ok": True,
          "roomId": self.room_id,
          "hostName": self.host_name,
          "guestName": self.guest_name,
          "gamesToWin": self.games_to_win,
          "p1Connected": p1_state["connected"],
          "p2Connected": p2_state["connected"],
          "p1DesktopOnline": (now - self._p1_desktop_heartbeat) < 12.0,
          "p2DesktopOnline": (now - self._p2_desktop_heartbeat) < 12.0,
          "p1Racket": p1_state,
          "p2Racket": p2_state,
          "matchSeq": self._match_seq,
          "matchSnapshot": self._match_snapshot,
          "serverTime": now,
      }


class RoomAndTunnelManager:
  """Manages all active 1v1 match rooms and base URLs for mobile companion rackets."""

  def __init__(self):
    self._lock = threading.Lock()
    self._rooms = {
        "default": MatchRoom("default", host_name="Player 1", guest_name="Player 2"),
    }
    self._port = 8080
    self._tunnel_url = os.environ.get("TUNNEL_URL", os.environ.get("PUBLIC_BASE_URL", "")).rstrip("/")
    self._desktop_base_url = os.environ.get("DESKTOP_BASE_URL", os.environ.get("PUBLIC_BASE_URL", "")).rstrip("/")

  def set_port(self, port: int):
    self._port = port
    default_url = f"http://localhost:{port}"
    if not self._desktop_base_url:
      self._desktop_base_url = default_url
    if not self._tunnel_url:
      self._tunnel_url = default_url

  def get_tunnel_url(self) -> str:
    with self._lock:
      return self._tunnel_url

  def set_tunnel_url(self, url: str) -> str:
    cleaned = str(url or "").strip().rstrip("/")
    if cleaned.endswith("/companion.html"):
      cleaned = cleaned[: -len("/companion.html")]
    if cleaned and not cleaned.startswith("http"):
      cleaned = "https://" + cleaned
    with self._lock:
      if cleaned:
        self._tunnel_url = cleaned
      return self._tunnel_url

  def get_or_create_room(self, room_id: str) -> MatchRoom:
    rid = (room_id or "default").strip().lower() or "default"
    with self._lock:
      if rid not in self._rooms:
        self._rooms[rid] = MatchRoom(rid)
      return self._rooms[rid]

  def create_new_room(self, host_name: str = "Player 1", guest_name: str = "Player 2", games_to_win: int = 2, custom_room_id: str = "") -> MatchRoom:
    with self._lock:
      if custom_room_id:
        rid = re.sub(r"[^a-zA-Z0-9_-]", "", custom_room_id).lower()[:24] or "match1"
      else:
        suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
        rid = f"at-{suffix}"
      room = MatchRoom(rid, host_name=host_name or "Player 1", guest_name=guest_name or "Player 2", games_to_win=games_to_win)
      self._rooms[rid] = room
      return room

  def build_room_links(self, room: MatchRoom, request_host: str = "") -> dict:
    base = self.get_tunnel_url() or (f"http://{request_host}" if request_host else f"http://localhost:{self._port}")
    base = base.rstrip("/")
    rid = quote(room.room_id)
    p1_companion = f"{base}/companion.html?room={rid}&role=p1"
    p2_companion = f"{base}/companion.html?room={rid}&role=p2"
    return {
        "roomId": room.room_id,
        "desktopBaseUrl": base,
        "tunnelBaseUrl": base,
        "joinUrl": f"{base}/join.html?room={rid}",
        "p1DesktopUrl": f"{base}/?room={rid}&role=p1&mode=1v1",
        "p2DesktopUrl": f"{base}/?room={rid}&role=p2&mode=1v1",
        "p1CompanionUrl": p1_companion,
        "p2CompanionUrl": p2_companion,
        "p1QrImageUrl": f"https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&format=png&data={quote(p1_companion, safe='')}",
        "p2QrImageUrl": f"https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&format=png&data={quote(p2_companion, safe='')}",
    }


MANAGER = RoomAndTunnelManager()


class ReuseThreadingHTTPServer(ThreadingHTTPServer):
  allow_reuse_address = True
  daemon_threads = True


class ArgonTennisRequestHandler(SimpleHTTPRequestHandler):
  extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **MIME_OVERRIDES}

  def __init__(self, *args, **kwargs):
    super().__init__(*args, directory=ROOT_DIR, **kwargs)

  def log_message(self, format_str, *args):
    path = getattr(self, "path", "")
    if any(path.startswith(p) for p in ("/api/racket/state", "/api/racket/telemetry", "/api/racket/feedback", "/api/match/state", "/api/match/sync")):
      return
    super().log_message(format_str, *args)

  def end_headers(self):
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    self.send_header("Access-Control-Allow-Headers", "Content-Type, Range")
    self.send_header("Cache-Control", "no-cache")
    super().end_headers()

  def _send_json(self, status_code: int, data: dict):
    body = json.dumps(data).encode("utf-8")
    self.send_response(status_code)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Content-Length", str(len(body)))
    self.end_headers()
    self.wfile.write(body)

  def _extract_room_and_role(self, parsed_url, payload: dict = None):
    qs = parse_qs(parsed_url.query)
    room_id = (payload or {}).get("room") or (payload or {}).get("roomId") or (qs.get("room") or qs.get("roomId") or ["default"])[0]
    role = (payload or {}).get("role") or (qs.get("role") or ["p1"])[0]
    return str(room_id or "default").strip().lower(), str(role or "p1").strip().lower()

  def do_OPTIONS(self):
    self.send_response(HTTPStatus.NO_CONTENT)
    self.end_headers()

  def do_GET(self):
    parsed = urlparse(self.path)
    route = parsed.path
    room_id, role = self._extract_room_and_role(parsed)

    if route == "/api/tunnel/status":
      room = MANAGER.get_or_create_room(room_id)
      links = MANAGER.build_room_links(room, request_host=self.headers.get("Host", ""))
      self._send_json(
          HTTPStatus.OK,
          {
              "ok": True,
              "tunnelUrl": MANAGER.get_tunnel_url(),
              "roomId": room.room_id,
              "links": links,
          },
      )
      return

    if route in ("/api/racket/state", "/api/racket/poll"):
      room = MANAGER.get_or_create_room(room_id)
      racket = room.get_racket(role)
      state = racket.get_state()
      room_state = room.get_room_state()
      state["roomId"] = room.room_id
      state["p1Connected"] = room_state["p1Connected"]
      state["p2Connected"] = room_state["p2Connected"]
      state["tunnelUrl"] = MANAGER.get_tunnel_url()
      self._send_json(HTTPStatus.OK, state)
      return

    if route == "/api/match/state":
      room = MANAGER.get_or_create_room(room_id)
      qs = parse_qs(parsed.query)
      if qs.get("desktop") == ["1"]:
        room.touch_desktop_role(role, player_name=(qs.get("name") or [""])[0])
      state = room.get_room_state()
      state["links"] = MANAGER.build_room_links(room, request_host=self.headers.get("Host", ""))
      state["tunnelUrl"] = MANAGER.get_tunnel_url()
      self._send_json(HTTPStatus.OK, state)
      return

    super().do_GET()

  def do_POST(self):
    parsed = urlparse(self.path)
    route = parsed.path

    length = int(self.headers.get("Content-Length", "0") or "0")
    raw_body = self.rfile.read(length) if length > 0 else b"{}"
    try:
      payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
      payload = {}

    room_id, role = self._extract_room_and_role(parsed, payload)

    if route == "/api/racket/swing":
      room = MANAGER.get_or_create_room(room_id)
      swing = room.get_racket(role).record_swing(payload)
      self._send_json(HTTPStatus.OK, {"ok": True, "roomId": room.room_id, "role": role, "swing": swing})
      return

    if route in ("/api/racket/heartbeat", "/api/racket/telemetry"):
      room = MANAGER.get_or_create_room(room_id)
      tel = room.get_racket(role).record_telemetry(payload)
      state = room.get_racket(role).get_state()
      self._send_json(
          HTTPStatus.OK,
          {
              "ok": True,
              "roomId": room.room_id,
              "role": role,
              "telemetry": tel,
              "feedbackSeq": state["feedbackSeq"],
              "lastFeedback": state["lastFeedback"],
          },
      )
      return

    if route == "/api/racket/feedback":
      room = MANAGER.get_or_create_room(room_id)
      fb = room.get_racket(role).record_feedback(payload)
      self._send_json(HTTPStatus.OK, {"ok": True, "roomId": room.room_id, "role": role, "feedback": fb})
      return

    if route == "/api/tunnel/url":
      new_url = MANAGER.set_tunnel_url(payload.get("tunnelUrl", ""))
      self._send_json(HTTPStatus.OK, {"ok": True, "tunnelUrl": new_url})
      return

    if route == "/api/match/create":
      host_name = str(payload.get("hostName") or payload.get("p1Name") or "Player 1")
      guest_name = str(payload.get("guestName") or payload.get("p2Name") or "Player 2")
      games_to_win = int(payload.get("gamesToWin") or 2)
      custom_room = str(payload.get("roomId") or "").strip()
      room = MANAGER.create_new_room(
          host_name=host_name,
          guest_name=guest_name,
          games_to_win=games_to_win,
          custom_room_id=custom_room,
      )
      links = MANAGER.build_room_links(room, request_host=self.headers.get("Host", ""))
      self._send_json(
          HTTPStatus.OK,
          {
              "ok": True,
              "roomId": room.room_id,
              "tunnelUrl": MANAGER.get_tunnel_url(),
              "links": links,
              "urls": links,
          },
      )
      return

    if route == "/api/match/sync":
      room = MANAGER.get_or_create_room(room_id)
      snap = room.update_match_snapshot(payload.get("snapshot") or payload)
      p2_racket = room.get_racket("p2").get_state()
      self._send_json(
          HTTPStatus.OK,
          {
              "ok": True,
              "roomId": room.room_id,
              "seq": snap["seq"],
              "p2Racket": p2_racket,
              "p2DesktopOnline": room.get_room_state()["p2DesktopOnline"],
          },
      )
      return

    self._send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": f"Unknown endpoint {route}"})


def main():
  parser = argparse.ArgumentParser(description="Argon Tennis HTTP, 1v1 Multiplayer & Pocket Racket Relay Server")
  parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")), help="Port to listen on (default: 8080)")
  parser.add_argument("--host", type=str, default="0.0.0.0", help="Host interface to bind (default: 0.0.0.0)")
  parser.add_argument("--tunnel-url", type=str, default=os.environ.get("TUNNEL_URL", ""), help="Optional public HTTPS base URL for mobile companion rackets")
  args = parser.parse_args()

  MANAGER.set_port(args.port)
  if args.tunnel_url:
    MANAGER.set_tunnel_url(args.tunnel_url)

  server = ReuseThreadingHTTPServer((args.host, args.port), ArgonTennisRequestHandler)
  print(f"[Argon Tennis Server] Serving {ROOT_DIR} on http://localhost:{args.port}", flush=True)
  try:
    server.serve_forever()
  except KeyboardInterrupt:
    print("\n[Argon Tennis Server] Shutting down.", flush=True)
    server.server_close()
    sys.exit(0)


if __name__ == "__main__":
  main()
