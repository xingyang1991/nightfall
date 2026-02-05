#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-4010}"
BASE_URL="http://127.0.0.1:${PORT}"

if ! command -v node >/dev/null 2>&1; then
  echo "[FAIL] node not found. Please install Node.js first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[FAIL] npm not found. Please install npm or use your package manager."
  exit 1
fi

LOG_FILE="${ROOT_DIR}/artifacts/preflight_server.log"
mkdir -p "${ROOT_DIR}/artifacts"

export PORT
export NF_AUTH_SECRET="${NF_AUTH_SECRET:-devsecret}"
export NF_TOOL_MODE="${NF_TOOL_MODE:-stub}"
export NF_MOMENTS_REVIEW="${NF_MOMENTS_REVIEW:-true}"
export NF_IMAGE_SEARCH_ENABLED="${NF_IMAGE_SEARCH_ENABLED:-false}"

echo "[INFO] Starting server on ${BASE_URL} ..."
npm run --silent server > "${LOG_FILE}" 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[INFO] Waiting for /health ..."
python3 - <<'PY'
import time, urllib.request, os
base = "http://127.0.0.1:%s" % (os.environ.get("PORT", "4010"))
for _ in range(30):
    try:
        with urllib.request.urlopen(base + "/health", timeout=1) as resp:
            if resp.status == 200:
                print("[INFO] /health OK")
                raise SystemExit(0)
    except Exception:
        time.sleep(0.5)
print("[FAIL] Server did not become healthy in time")
raise SystemExit(1)
PY

python3 - <<'PY'
import json, urllib.request, urllib.error, sys, os

base = "http://127.0.0.1:%s" % (os.environ.get("PORT", "4010"))

def request(method, path, data=None, headers=None):
    url = base + path
    payload = None
    if data is not None:
        payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method=method)
    req.add_header("Content-Type", "application/json")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read()
            return resp.status, body, resp.getheader("content-type")
    except urllib.error.HTTPError as e:
        return e.code, e.read(), e.headers.get("content-type")
    except Exception as e:
        return None, str(e).encode("utf-8"), None

results = []

status, body, _ = request("GET", "/health")
results.append(("GET /health", status))

status, body, _ = request("POST", "/api/bootstrap", data={})
results.append(("POST /api/bootstrap", status))
try:
    boot = json.loads(body)
except Exception:
    boot = {}

token = boot.get("auth_token")
headers = {"Authorization": f"Bearer {token}"} if token else {}

status, body, _ = request("GET", "/api/scenes", headers=headers)
results.append(("GET /api/scenes", status))

status, body, _ = request("GET", "/api/atmosphere?lat=31.23&lng=121.47&city=Shanghai&uid=test_user", headers=headers)
results.append(("GET /api/atmosphere", status))

action_payload = {
    "action": {"name": "TONIGHT_SUBMIT_ORDER", "payload": {"text": "找个安静的地方工作"}},
    "sessionId": boot.get("sessionId"),
    "userId": boot.get("userId")
}
status, body, _ = request("POST", "/api/action", data=action_payload, headers=headers)
results.append(("POST /api/action TONIGHT_SUBMIT_ORDER", status))

status, body, _ = request("GET", "/api/tickets?user_id=test_user", headers=headers)
results.append(("GET /api/tickets", status))

period = {"type": "month", "start": "2026-02-01", "end": "2026-02-28"}
status, body, _ = request("POST", "/api/archives", data={"user_id": "test_user", "period": period}, headers=headers)
results.append(("POST /api/archives", status))
try:
    arch = json.loads(body).get("archive")
except Exception:
    arch = None

status, body, _ = request("GET", "/api/archives?user_id=test_user", headers=headers)
results.append(("GET /api/archives", status))

share_path = None
if arch and arch.get("id"):
    status, body, _ = request("POST", f"/api/archives/{arch['id']}/share", headers=headers)
    results.append(("POST /api/archives/:id/share", status))
    try:
        share = json.loads(body)
        share_path = share.get("share_url")
    except Exception:
        share_path = None

if share_path:
    status, body, _ = request("GET", share_path)
    results.append(("GET /share/archive/:id", status))

status, body, _ = request("GET", "/api/moments?limit=5", headers=headers)
results.append(("GET /api/moments", status))

png_data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
image_data = f"data:image/png;base64,{png_data}"
status, body, _ = request("POST", "/api/moments", data={"user_id": "test_user", "image_data": image_data, "caption": "test"}, headers=headers)
results.append(("POST /api/moments", status))

try:
    moment = json.loads(body)
except Exception:
    moment = None

if moment and moment.get("id"):
    status, body, _ = request("POST", f"/api/moments/{moment['id']}/like", headers=headers)
    results.append(("POST /api/moments/:id/like", status))

print("=== Preflight Smoke Results ===")
all_ok = True
for name, st in results:
    ok = st == 200
    all_ok = all_ok and ok
    print(f"{'[PASS]' if ok else '[FAIL]'} {name} -> {st}")

if not all_ok:
    print("One or more checks failed. See server log for details.")
    raise SystemExit(1)
PY

echo "[OK] Preflight smoke checks passed."
