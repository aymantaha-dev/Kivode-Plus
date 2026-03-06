<div align="center">

# Kivode+ Desktop

**Secure AI-assisted desktop code workspace built with Electron + React + TypeScript**

<p align="center">
  <img src="./assets/banner.png" alt="Kivode+ Banner" />
</p>

<p>
  <a href="#quick-start"><img alt="Quick Start" src="https://img.shields.io/badge/Quick_Start-Get_Started-4F46E5?style=for-the-badge" /></a>
  <a href="#build-and-package"><img alt="Build" src="https://img.shields.io/badge/Build-Cross_Platform-0EA5E9?style=for-the-badge" /></a>
  <a href="#python-runtime-bundled-offline"><img alt="Python Runtime" src="https://img.shields.io/badge/Python_Runtime-Bundled_Offline-16A34A?style=for-the-badge" /></a>
  <a href="#security"><img alt="Security" src="https://img.shields.io/badge/Security-Hardened-DC2626?style=for-the-badge" /></a>
</p>

<p>
  <img alt="Electron" src="https://img.shields.io/badge/Electron-Desktop-47848F" />
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF" />
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11+-3776AB" />
</p>

</div>

---

## Table of Contents

- [What is Kivode+ Desktop?](#what-is-kivode-desktop)
- [Contribution Model](#contribution-model)
- [Community Ecosystem](#community-ecosystem)
- [Community Builds](#community-builds)
- [Core Features](#core-features)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Complete Setup (Step by Step)](#complete-setup-step-by-step)
- [Python Runtime (Bundled Offline)](#python-runtime-bundled-offline)
- [Run in Development](#run-in-development)
- [Build and Package](#build-and-package)
- [Verification and Security Gates](#verification-and-security-gates)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Community and Credits](#community-and-credits)
- [License](#license)

## What is Kivode+ Desktop?

Kivode+ Desktop is a desktop engineering environment focused on secure AI workflows.

It combines:

- a hardened Electron main process,
- a modern React renderer,
- policy-controlled filesystem and process execution,
- an offline-capable bundled Python runtime for sandboxed operations,
- repository and project analysis features.

## Contribution Model

This repository is the **Reference Implementation** of Kivode+.

The governance model is intentionally designed for an ecosystem of **Independent Fork** projects:

- Community developers are encouraged to fork this repository and build their own versions.
- Developers may modify, rename, and publish their versions in their own GitHub repositories.
- Each derivative project is owned, maintained, and supported by its own developer team.
- The official Kivode+ repository does **not** merge external feature forks directly into the Reference Implementation.

In this model, community innovation happens in independent repositories, while the Reference Implementation remains the official baseline.

## Community Ecosystem

Kivode+ supports a public ecosystem where developers can submit their projects for a potential **Directory Listing** on the official platform.

Developer Submissions are reviewed through:

https://kivode.com/apps/submit

Approved listings may include:

- project name,
- screenshots,
- project description,
- repository link,
- developer profile,
- social media links.

For submission and review details, see:

- [`docs/community/directory-model.md`](./docs/community/directory-model.md)
- [`docs/community/submission-process.md`](./docs/community/submission-process.md)
- [`docs/dev/submissions/guidelines.md`](./docs/dev/submissions/guidelines.md)
- [`docs/dev/submissions/review-criteria.md`](./docs/dev/submissions/review-criteria.md)

## Community Builds

The official website maintains a curated directory of **Community Builds**.

| Project       | Developer | Repository     | Description         |
| ------------- | --------- | -------------- | ------------------- |
| Example Build | devname   | github.com/... | Improved UI version |

---

## Core Features

| Area | Capability | Notes |
|---|---|---|
| Code Editing | Multi-file editor, tabs, formatting support | Built with CodeMirror + Prettier workflow |
| AI Assistance | Multi-provider orchestration | Provider/model controls exposed in settings |
| Security | IPC boundaries, command policy, FS allowlist, redaction | Security-critical logic stays in `src/main/security` |
| Sandbox | Controlled Python task execution | Uses bundled runtime + offline wheels |
| GitHub Workflows | Repository clone, README and analytics support | Routed through trusted main-process services |
| Release Packaging | Windows/macOS/Linux targets | Scripts available in `package.json` |

---

## Architecture at a Glance

For the full architecture document, read [`ARCHITECTURE_OVERVIEW.md`](./ARCHITECTURE_OVERVIEW.md).

```text
src/
  main/
    security/
    services/
    python/
  renderer/
    src/
      components/
      stores/
      utils/
resources/python/
  bootstrap/
  runtime/<platform-arch>/
  wheels/<platform-arch>/
scripts/
```

See [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) for deeper details.

## Prerequisites

### Required

- Node.js **20+**
- npm **10+**
- Git **2.40+**

### Optional but recommended

- Python **3.11+** locally (for development tooling only)
- Build toolchain for your OS (see platform-specific section)

> In packaged production builds, Python tasks must run using the bundled runtime from `resources/python/runtime/<platform-arch>` and not system Python.

---

## Quick Start

```bash
git clone https://github.com/aymantaha-dev/kivode-plus.git
cd kivode-plus
npm install
npm run dev
```

---

## Complete Setup (Step by Step)

> This section is written to be directly usable from **Terminal (Linux/macOS)** and **PowerShell (Windows)**, with Python commands shown in both standard and launcher style where needed.

### 1) Clone repository

**Terminal (Linux/macOS):**

```bash
git clone https://github.com/aymantaha-dev/kivode-plus.git
cd kivode-plus
```

**PowerShell (Windows):**

```powershell
git clone https://github.com/aymantaha-dev/kivode-plus.git
Set-Location kivode-plus
```


### 2) Install Node dependencies

**Terminal / PowerShell:**

```bash
npm install
```

### 3) Create Python virtual environment (recommended for local Python checks)

Use one of the following command styles depending on your shell.

**A) Terminal (Linux/macOS):**

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r resources/python/requirements.txt
```

**B) PowerShell (Windows):**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r resources/python/requirements.txt
```

**C) Windows Python Launcher style (optional):**

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
py -3.11 -m pip install --upgrade pip
py -3.11 -m pip install -r resources/python/requirements.txt
```

### 4) Add / update Python runtime resources (for packaged app)

When you want Python features to work in packaged builds, make sure the following paths are populated for each target platform:

```text
resources/python/
  assistant_env.py
  requirements.txt
  runtime/<platform-arch>/...      # Python executable lives here
  wheels/<platform-arch>/*.whl     # Offline wheels live here
```

#### What to add exactly

- Add Python runtime files under `resources/python/runtime/<platform-arch>/`
  - Windows executable: `python.exe`
  - Linux/macOS executable: `bin/python3`
- Add all required wheel files under `resources/python/wheels/<platform-arch>/`
- Keep `resources/python/assistant_env.py` and `resources/python/requirements.txt` present and updated

#### Commands to stage offline wheels before build

Use the following commands to place wheel files in the correct platform folder before packaging.

**A) Terminal (Linux/macOS):**

```bash
# 1) Select your packaging target
export KIVODE_PLATFORM=linux-x64

# 2) Create the destination folder used by packaged builds
mkdir -p "resources/python/wheels/${KIVODE_PLATFORM}"

# 3) Copy your prepared wheels into the destination
cp /path/to/your/wheels/*.whl "resources/python/wheels/${KIVODE_PLATFORM}/"

# 4) Verify required wheels are present for that target
node scripts/verify-sandbox-assets.mjs --platform="${KIVODE_PLATFORM}"
```

**B) PowerShell (Windows):**

```powershell
# 1) Select your packaging target
$KivodePlatform = "win32-x64"

# 2) Create the destination folder used by packaged builds
New-Item -ItemType Directory -Force -Path "resources/python/wheels/$KivodePlatform" | Out-Null

# 3) Copy your prepared wheels into the destination
Copy-Item "C:\path\to\your\wheels\*.whl" "resources/python/wheels/$KivodePlatform\" -Force

# 4) Verify required wheels are present for that target
node scripts/verify-sandbox-assets.mjs --platform=$KivodePlatform
```

> Required destination format: `resources/python/wheels/<platform-arch>/*.whl`.

#### Supported platform keys

- `win32-x64`, `win32-arm64`
- `darwin-x64`, `darwin-arm64`
- `linux-x64`, `linux-arm64`

> Packaging already includes both `src/main/python/**/*.py` and `resources/python/**/*` through `extraResources` in build config.

### 5) Validate app before building (recommended pre-build gate)

Run these checks in order:

```bash
npm run security:check
npm run verify:baseline
npm run verify:sandbox-assets
```

Optional platform-specific checks:

```bash
npm run verify:sandbox-assets:win32-x64
```

### 6) Build app

First, run production compilation:

```bash
npm run build
```

Then package for your target OS:

```bash
# Windows
npm run build:windows

# macOS
npm run build:mac

# Linux
npm run build:linux
```

If your machine has the required host/toolchain setup, you can attempt all targets:

```bash
npm run build:all
```

> **Cross-platform note:** Electron packaging is toolchain-dependent. In practice, it is most reliable to build each target on its native OS (Windows/macOS/Linux) or with a properly configured CI pipeline for each platform.

---

## Python Runtime (Bundled Offline)

Kivode+ uses a bundled Python strategy for packaged applications.

### Runtime directories

Each platform requires:

- `resources/python/runtime/<platform-arch>/...` (Python executable)
- `resources/python/wheels/<platform-arch>/...` (all required wheel files)

Supported platform keys:

- `win32-x64`, `win32-arm64`
- `darwin-x64`, `darwin-arm64`
- `linux-x64`, `linux-arm64`

### Expected executable paths

- **Windows**: `resources/python/runtime/<platform-arch>/python.exe`
- **Linux/macOS**: `resources/python/runtime/<platform-arch>/bin/python3`

### Required wheels

Wheels must satisfy `resources/python/requirements.txt` for each platform target:

- PyYAML
- beautifulsoup4
- toml
- jedi
- radon
- pygments

### Why runtime can appear "Unavailable"

If UI shows Python unavailable after packaging, usually one of these is missing:

1. Bundled executable is not under `resources/python/runtime/<platform-arch>`.
2. Offline wheels are missing under `resources/python/wheels/<platform-arch>`.
3. `assistant_env.py` was not packaged to `resources/python/assistant_env.py`.
4. Built app architecture does not match bundled runtime architecture.

### Important behavior

- In packaged mode, Python execution is restricted to **bundled runtime only**.
- System-installed Python fallback is intentionally disabled for packaged builds.

---

## Run in Development

### Full app (recommended)

```bash
npm run dev
```

### Run renderer only

```bash
npm run dev:renderer
```

### Run main process only

```bash
npm run dev:main
```

---

## Build and Package

### Standard production build

```bash
npm run build
```

### Windows package

```bash
npm run build:windows
```

### macOS package

```bash
npm run build:mac
```

### Linux package

```bash
npm run build:linux
```

### All targets (host/toolchain dependent)

```bash
npm run build:all
```

---

## Verification and Security Gates

Run all critical checks before release:

```bash
npm run test
npm run security:check
npm run verify:baseline
npm run verify:sandbox-assets
```

Optional platform-targeted asset verification:

```bash
npm run verify:sandbox-assets:win32-x64
```

---

## Platform Notes

### Windows

- Use PowerShell or Git Bash.
- Ensure Visual Studio Build Tools are available for native dependencies.
- Validate bundled runtime path: `resources/python/runtime/win32-x64/python.exe` (or arm64 key).

### macOS

- Install Xcode Command Line Tools.
- Validate bundled runtime path: `resources/python/runtime/darwin-*/bin/python3`.

### Linux

- Install common build tools (`build-essential`, Python dev headers as needed).
- Validate bundled runtime path: `resources/python/runtime/linux-*/bin/python3`.

---

## Troubleshooting

### Python badge shows unavailable in app

1. Run:
   ```bash
   npm run verify:sandbox-assets
   ```
2. Confirm packaged runtime executable path exists for your target platform.
3. Confirm wheels directory contains all required `.whl` files.
4. Rebuild and relaunch app after assets are corrected.

### Build succeeds but packaged app cannot run Python tasks

- Verify `extraResources` packaging includes both:
  - `src/main/python/**/*.py`
  - `resources/python/**/*`
- Ensure platform/arch runtime and wheels match packaged target.

### Security checks fail

- Run:
  ```bash
  npm run security:check
  npm run verify:baseline
  ```
- Apply fixes without weakening allowlists/sandbox boundaries.

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening pull requests.

## Project Structure

```text
.
├── assets/
├── docs/
│   ├── community/
│   └── dev/submissions/
├── resources/
│   └── python/
├── scripts/
├── src/
│   ├── main/
│   │   ├── python/
│   │   ├── security/
│   │   └── services/
│   └── renderer/
├── ARCHITECTURE_OVERVIEW.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

- Security reporting: [SECURITY.md](./SECURITY.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

## Contributing

Please read:

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`SECURITY.md`](./SECURITY.md)
- [`CHANGELOG.md`](./CHANGELOG.md)

---

## Community and Credits

Developed by **aymantaha-dev@**

- GitHub: `https://github.com/aymantaha-dev`
- Instagram: `https://instagram.com/aymantaha.dev`
- Discord: `https://discord.gg/rUdaR8PG`

---

## License

Licensed under the **Kivode Community Non-Commercial License 1.0**.
See [`LICENSE`](./LICENSE).
