# Kivode+ Python Sandbox

## Embedded Runtime (No System Python Dependency)
Kivode+ now uses a bundled Python runtime from app resources only.

- Runtime source path (read-only): `resources/python/runtime/<platform>/...`
- Offline wheels source path (read-only): `resources/python/wheels/<platform>/...`
- Bootstrap script: `resources/python/bootstrap/ensure_env.py`
- Requirements: `resources/python/requirements.txt`

Sandbox execution **does not fallback** to `python` from system PATH.
If bundled runtime is missing, sandbox fails explicitly.

## User Writable Environment
A platform-specific venv is created in app data on first run/update:

- Windows: `%APPDATA%/Kivode+/python-sandbox/<platform>/venv`
- macOS: `~/Library/Application Support/Kivode+/python-sandbox/<platform>/venv`
- Linux: `~/.local/share/Kivode+/python-sandbox/<platform>/venv`

## Bootstrapping Flow (Offline)
1. `SandboxService.ensureEnvironment()` checks if venv python exists.
2. If missing, it runs `ensure_env.py` with bundled runtime.
3. `ensure_env.py` creates venv and installs dependencies via:
   - `pip install --no-index --find-links <wheels-dir> -r requirements.txt`
4. Service logs the exact python path used for sandbox tasks.

## Installed Sandbox Packages
- `PyYAML==6.0.3`
- `beautifulsoup4==4.12.*`
- `toml==0.10.*`
- `jedi==0.19.*`
- `radon==6.*`
- `pygments==2.19.*`


## Payload Transport to `sandbox_runner.py`
The runner supports three input modes (backward compatible):
- `--input "<json-string>"`
- `--input-file <path-to-json>`
- `--input-stdin` (reads full JSON from stdin)

Priority order:
1. `--input-file`
2. `--input-stdin`
3. `--input`

On Windows/PowerShell, passing large JSON via CLI quoting is unreliable, so Kivode+ main process now uses `--input-file` for task payload transport.

## Limits
- Default timeout: 5s per task (max 15s).
- Default memory: 256MB per task (max 512MB).
- stdout/stderr truncated to 200KB.

## Security Policy (MVP)
- Network blocked by policy (`socket`, `requests`, `httpx`, `aiohttp`, `urllib*`, `ssl`, `ftplib`).
- Process spawn blocked (`subprocess`, `os.system`, `os.popen`, `ctypes`).
- Filesystem restricted:
  - Read inside workspace root only.
  - Write only inside `<workspace>/.kivode/sandbox/`.
- Import allowlist enforced in `sandbox_policy.py`.

## Failure Behavior
If runtime/wheels/bootstrap fail:
- `sandbox:ensureEnvironment` returns failure.
- UI shows failed environment state.
- Task execution returns explicit error; no silent fallback to system python.

## Update Behavior
After app update, bootstrap re-validates the venv.
If required packages are missing/mismatched, local offline reinstall is attempted from bundled wheels.

## Hard Sandbox TODO
OS-level isolation remains TODO:
- Windows: Job Objects + process-scoped firewall rule.
- macOS: sandbox-exec / App Sandbox entitlements.
- Linux: bubblewrap or firejail.


## CI Asset Population
The workflow `.github/workflows/python-sandbox-assets.yml` now performs:
- Runtime staging into `resources/python/runtime/<platform>` (starting with real Windows x64 runtime assets, plus other matrix targets).
- Offline wheel generation into `resources/python/wheels/<platform>`.
- Verification gate (`node scripts/verify-sandbox-assets.mjs --platform=<platform>`) that fails if runtime executable or required wheels are missing.
- Smoke execution of `HtmlSeoAuditTask` and printing `sys.executable` from the bundled venv python.

## Build Verification Gate
Use this before release packaging:
- `npm run verify:sandbox-assets`
- `npm run build:release`

These commands fail when runtime executable or required wheels are missing for the current platform.
