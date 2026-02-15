#!/usr/bin/env bash
# Kill any process using the given port. Run from repo root: ./scripts/kill-port.sh 5001
# Use before starting a server to avoid "Address already in use" from leftover processes.

port="${1:?Usage: $0 <port>}"
pids=$(lsof -ti :"$port" 2>/dev/null)
if [[ -n "$pids" ]]; then
  echo "Stopping process on port $port (PID $pids)..."
  kill $pids 2>/dev/null || kill -9 $pids 2>/dev/null || true
  sleep 1
fi
