#!/usr/bin/env bash
# ============================================================================
# Argon Tennis — One-Command Launcher & Cloud / Corp URL Reporter
# 100% Compliant with go/remote-access-security-policy-faq (ZERO reverse tunnels)
# Usage:
#   argontennis            (starts local server + outbound GChat DM bridge, prints URLs)
#   argontennis --restart  (restarts local server & outbound GChat DM bridge)
# ============================================================================
set -euo pipefail

PORT="${PORT:-8080}"
CLOUD_URL="https://argon-tennis-sandbox-170440.uc.r.appspot.com"
CITC_DIR="/google/src/cloud/ammaar/gauntlet_argon_tennis_loop/google3/experimental/users/ammaar/argon_tennis"
HOME_DIR="/usr/local/google/home/ammaar/argon_tennis_gauntlet"

if [[ -d "${CITC_DIR}" && -f "${CITC_DIR}/server.py" ]]; then
  APP_DIR="${CITC_DIR}"
elif [[ -d "${HOME_DIR}" && -f "${HOME_DIR}/server.py" ]]; then
  APP_DIR="${HOME_DIR}"
else
  echo "Error: Could not find Argon Tennis directory." >&2
  exit 1
fi

if [[ "${1:-}" == "--restart" ]]; then
  pkill -f "argon_tennis.*/server.py" 2>/dev/null || true
  pkill -f "cloudrun_gchat_dm_bridge.py" 2>/dev/null || true
  sleep 0.5
fi

# 1. Ensure local Cloudtop server is running on $PORT (no reverse tunnels)
if ! curl -fsS "http://127.0.0.1:${PORT}/api/tunnel/status" >/dev/null 2>&1; then
  nohup python3 "${APP_DIR}/server.py" --port "${PORT}" --no-auto-tunnel </dev/null >/tmp/argon_tennis_server.log 2>&1 &
  for _ in {1..30}; do
    if curl -fsS "http://127.0.0.1:${PORT}/api/tunnel/status" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

# 2. Ensure outbound-only Cloudtop Google Chat 1:1 DM bridge is running
if ! pgrep -f "cloudrun_gchat_dm_bridge.py" >/dev/null 2>&1; then
  nohup python3 "${APP_DIR}/scripts/cloudrun_gchat_dm_bridge.py" --cloud-run-url "${CLOUD_URL}" </dev/null >/tmp/argon_tennis_dm_bridge.log 2>&1 &
fi

CORP_URL="http://ammaarais.c.googlers.com:${PORT}"

cat <<EOF
========================================================================
🎾 ARGON TENNIS IS LIVE (Google Cloud + Corp Cloudtop — Zero Tunnels)
========================================================================

🌐 PERMANENT CLOUD DEPLOYMENT (1v1 Multiplayer, Mobile Phones & GChat):
   • Player 1 Game (Desktop):    ${CLOUD_URL}/index.html?room=default&role=p1
   • Player 1 Phone Controller:  ${CLOUD_URL}/companion.html?room=default&role=p1
   • Player 2 Game (Desktop):    ${CLOUD_URL}/index.html?room=default&role=p2
   • Player 2 Phone Controller:  ${CLOUD_URL}/companion.html?room=default&role=p2
   • Google Chat App Webhook:    ${CLOUD_URL}/api/gchat/webhook

🖥️ LOCAL CORP CLOUDTOP SERVER (ÜberProxy):
   • ${CORP_URL}/index.html

========================================================================
EOF
