#!/usr/bin/env python3
"""Argon Valley — Multi-threaded HTTP Server."""

import argparse
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
import re
import sys
from urllib.parse import urlparse

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

mimetypes.init()
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("model/gltf+json", ".gltf")
mimetypes.add_type("audio/mpeg", ".mp3")
mimetypes.add_type("audio/wav", ".wav")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("text/html", ".html")


class ReuseThreadingHTTPServer(ThreadingHTTPServer):
  allow_reuse_address = True
  daemon_threads = True


class CozyIslandRequestHandler(SimpleHTTPRequestHandler):
  """HTTP handler supporting Cloudtop health checks, CORS, byte ranges, and static ES modules."""

  extensions_map = {
      **SimpleHTTPRequestHandler.extensions_map,
      ".glb": "model/gltf-binary",
      ".gltf": "model/gltf+json",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".js": "application/javascript",
      ".mjs": "application/javascript",
      ".json": "application/json",
      ".css": "text/css",
      ".html": "text/html; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
  }

  def __init__(self, *args, **kwargs):
    super().__init__(*args, directory=ROOT_DIR, **kwargs)

  def log_message(self, format_str, *args):
    path = getattr(self, "path", "")
    if path.startswith("/___rPc_sWiTcH___"):
      return
    super().log_message(format_str, *args)

  def end_headers(self):
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS")
    self.send_header("Access-Control-Allow-Headers", "Content-Type, Range, Accept")
    self.send_header("Accept-Ranges", "bytes")
    self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
    self.send_header("Pragma", "no-cache")
    self.send_header("Expires", "0")
    super().end_headers()

  def _send_text(self, status_code: int, text: str, head_only: bool = False):
    body = text.encode("utf-8")
    self.send_response(status_code)
    self.send_header("Content-Type", "text/plain; charset=utf-8")
    self.send_header("Content-Length", str(len(body)))
    self.end_headers()
    if not head_only:
      self.wfile.write(body)

  def _send_json(self, status_code: int, data: dict):
    body = json.dumps(data).encode("utf-8")
    self.send_response(status_code)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Content-Length", str(len(body)))
    self.end_headers()
    self.wfile.write(body)

  def do_OPTIONS(self):
    self.send_response(HTTPStatus.NO_CONTENT)
    self.send_header("Content-Length", "0")
    self.end_headers()

  def do_HEAD(self):
    parsed = urlparse(self.path)
    if parsed.path == "/___rPc_sWiTcH___":
      self._send_text(HTTPStatus.OK, "OK", head_only=True)
      return
    super().do_HEAD()

  def do_GET(self):
    parsed = urlparse(self.path)
    route = parsed.path
    if route == "/___rPc_sWiTcH___":
      self._send_text(HTTPStatus.OK, "OK", head_only=False)
      return
    if route == "/api/health":
      self._send_json(HTTPStatus.OK, {"ok": True, "service": "cozy_island_engine"})
      return

    # Support HTTP Range requests for HTML5 <audio> (.mp3 Lyria 3 & .wav Gemini 3.8 Flash TTS)
    range_header = self.headers.get("Range")
    if range_header and (route.endswith(".mp3") or route.endswith(".wav")):
      local_path = self.translate_path(self.path)
      if os.path.isfile(local_path):
        try:
          file_size = os.path.getsize(local_path)
          match = re.match(r"bytes=(\d+)-(\d*)", range_header)
          if match:
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else file_size - 1
            end = min(end, file_size - 1)
            if 0 <= start <= end < file_size:
              length = end - start + 1
              with open(local_path, "rb") as f:
                f.seek(start)
                chunk = f.read(length)
              mime = "audio/mpeg" if route.endswith(".mp3") else "audio/wav"
              self.send_response(HTTPStatus.PARTIAL_CONTENT)
              self.send_header("Content-Type", mime)
              self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
              self.send_header("Content-Length", str(len(chunk)))
              self.end_headers()
              self.wfile.write(chunk)
              return
        except OSError:
          pass

    super().do_GET()


def main():
  parser = argparse.ArgumentParser(description="Argon Valley HTTP Server")
  parser.add_argument(
      "--port",
      type=int,
      default=int(os.environ.get("PORT", "8096")),
      help="Port to listen on (default: 8096)",
  )
  parser.add_argument(
      "--host",
      type=str,
      default="0.0.0.0",
      help="Host interface to bind (default: 0.0.0.0)",
  )
  args = parser.parse_args()

  server = ReuseThreadingHTTPServer((args.host, args.port), CozyIslandRequestHandler)
  print(
      f"[Argon Valley Server] Serving {ROOT_DIR} on http://{args.host}:{args.port} "
            flush=True,
  )
  try:
    server.serve_forever()
  except KeyboardInterrupt:
    server.server_close()
    sys.exit(0)


if __name__ == "__main__":
  main()
