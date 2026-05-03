# 🦕 Dino Run — Chromatic Edition

<div align="center">

A fully offline Chrome-style endless runner with day/night cycle,  
pterodactyls, persistent local leaderboard, and session stats.  
No network calls · No tracking · No image assets.

[![Live Demo](https://img.shields.io/badge/▶%20Play%20Now-GitHub%20Pages-4CAF50?style=flat-square&logo=github)](https://sumon-kayal.github.io/Dino-Run-Chromatic-Edition/)
[![GitHub Stars](https://img.shields.io/github/stars/Sumon-Kayal/Dino-Run-Chromatic-Edition?style=flat-square&logo=github)](https://github.com/Sumon-Kayal/Dino-Run-Chromatic-Edition/stargazers)
[![License](https://img.shields.io/github/license/Sumon-Kayal/Dino-Run-Chromatic-Edition?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.8.0--beta-blue?style=flat-square)](CHANGELOG.md)
[![CodeQL](https://github.com/Sumon-Kayal/Dino-Run-Chromatic-Edition/actions/workflows/codeql.yml/badge.svg)](https://github.com/Sumon-Kayal/Dino-Run-Chromatic-Edition/actions/workflows/codeql.yml)
[![CodeRabbit Reviews](https://img.shields.io/coderabbit/prs/github/Sumon-Kayal/Dino-Run-Chromatic-Edition?utm_source=oss&utm_medium=github&utm_campaign=Sumon-Kayal%2FDino-Run-Chromatic-Edition&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews&style=flat-square)](https://coderabbit.ai)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/Sumon-Kayal/Dino-Run-Chromatic-Edition/pulls)

> **Beta:** This project is under active development. Core gameplay is stable, but APIs and config
> file schemas may change between minor versions. Check [CHANGELOG.md](CHANGELOG.md) before
> upgrading.

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🌐 Live Demo](#-live-demo)
- [🚀 Quick Start](#-quick-start)
- [🖥️ Platform Setup Guide](#-platform-setup-guide)
- [🔐 Generating the self-signed certificate](#-generating-the-self-signed-certificate)
- [🟦 Caddy (alternative dev server)](#-caddy-alternative-dev-server)
- [📁 Project Structure](#-project-structure)
- [🔤 Fonts](#-fonts)
- [🎮 Controls](#-controls)
- [💾 Storage](#-storage)
  - [🗝️ Storage keys](#-storage-keys)
  - [📊 Quota handling](#-quota-handling)
  - [⚙️ Reset options](#-reset-options)
- [🏆 Leaderboard](#-leaderboard)
- [♿ Accessibility](#-accessibility)
- [🌐 Browser Compatibility](#-browser-compatibility)
- [🔧 Technical Notes](#-technical-notes)
- [🔒 Security](#-security)
  - [Server (server.py)](#server-serverpy)
  - [Server (Caddyfile)](#server-caddyfile)
  - [Static Analysis (CodeQL)](#static-analysis-codeql)
  - [PR Review Tracking (CodeRabbit)](#pr-review-tracking-coderabbit)
- [🧩 Architecture Notes](#-architecture-notes)
- [🧪 Tests](#-tests)
- [🗒️ Changelog](#-changelog)
- [📄 License](#-license)
- [🔖 Third-Party Components](#-third-party-components)
- [📜 Attribution](#-attribution)
---

## ✨ Features

- **Endless runner** with delta-time physics — Hz-independent at 60 / 90 / 120 / 144 Hz
- **Speed calibrated to the original Chrome Dino** — `6 → 13 px/frame`, reaching max speed at score ~2660
- **Chromatic day/night cycle** — colour-interpolated sky, crescent moon, stars, cloud parallax
- **Fullscreen mode** — `F` key or `FULL` button; canvas scales to fill viewport at 16:9
- **Top-10 local leaderboard** — persisted in `localStorage` (session-only fallback for private contexts)
- **★ NEW BEST ★ banner** — pulsing gold overlay when the player beats their previous best
- **5 MB storage awareness** — live quota display, graceful pruning on overflow, user-visible alert on critical failure
- **Web Audio** sound effects — `.ogg` / `.mp3` files loaded at runtime with synthesised beep fallback; paths driven by `data/audio.json`; mutable via `M`
- **Mobile-friendly** — touch jump/duck controls, no double-fire on tap
- **Keyboard shortcuts** — `Space`/`↑` jump · `↓` duck · `P` pause · `M` mute · `F` fullscreen
- **Reset top score** — `✕` button beside the HI display resets the high score while keeping leaderboard records
- **Accessible** — ARIA labels, live regions, screen-reader-compatible, `prefers-reduced-motion` support
- **HTTPS dev server** — security headers and HTTP method guards for both options; per-request timeout (10-second guard) only in Python `server.py` (no direct per-request equivalent in `Caddyfile`)
- **Modular ES module architecture** — game engine and DB layer split into focused, dependency-clean modules
- **JSON-driven tuning** — physics, speed, obstacle geometry, and audio paths configurable without editing source code

---

## 🌐 Live Demo

**▶ [Play instantly in your browser — no install required](https://sumon-kayal.github.io/Dino-Run-Chromatic-Edition/)**

> Hosted on **GitHub Pages** · No server needed · Runs entirely client-side

The live build is deployed directly from the `main` branch and reflects the latest stable release. Because the game uses the **Web Audio API** and **ES modules**, it requires a modern browser — see [Browser Compatibility](#-browser-compatibility) for the full matrix.

### What works on GitHub Pages

| Feature | Status |
|---|---|
| Full gameplay (jump, duck, pterodactyls) | ✅ |
| Day / night colour cycle | ✅ |
| Web Audio sound effects (`.ogg`) | ✅ |
| Persistent leaderboard & stats | ✅ via `localStorage` |
| Fullscreen mode (`F` key / button) | ✅ |
| Mobile touch controls | ✅ |
| `prefers-reduced-motion` support | ✅ |

### Notes

- **Storage** — scores and stats are saved to the browser's `localStorage`. They persist across sessions on the same device and browser, but are not shared between devices. Clearing site data removes them.
- **No HTTPS cert required** — unlike the local dev server (`server.py` / Caddy), GitHub Pages serves over HTTPS automatically so no self-signed certificate setup is needed.
- **Audio autoplay** — browsers require a user gesture before starting audio. The first `Space` / tap will unlock the audio context; sound plays normally from that point on.
- **Private / incognito mode** — `localStorage` is blocked in most browsers when in private mode; the game falls back to in-memory session storage and all scores are lost on tab close.

---

## 🚀 Quick Start

Clone the repository and start the local HTTPS server — no build step required.

### 🔗 Clone from GitHub

```bash
git clone https://github.com/Sumon-Kayal/Dino-Run-Chromatic-Edition.git
cd Dino-Run-Chromatic-Edition
```

If `assets/certs/cert.pem` / `assets/certs/key.pem` are missing, generate them
before running `server.py` — see the [certificate section](#-generating-the-self-signed-certificate) below.
If using Caddy instead, skip the certificate section — run `caddy trust` once and then `caddy run`.

---

## 🖥️ Platform Setup Guide

### 🪟 Windows

```bash
cd Dino-Run-Chromatic-Edition/
python server.py
```

Open: [`https://localhost:1999`](https://localhost:1999)

### 🍎 macOS

```bash
cd Dino-Run-Chromatic-Edition/
python3 server.py
```

Open: [`https://localhost:1999`](https://localhost:1999)

### 🐧 Linux

```bash
cd Dino-Run-Chromatic-Edition/
python3 server.py
```

Open: [`https://localhost:1999`](https://localhost:1999)

### 📱 Termux (Android)

```bash
pkg update && pkg upgrade -y
pkg install python git -y

git clone https://github.com/Sumon-Kayal/Dino-Run-Chromatic-Edition.git
cd Dino-Run-Chromatic-Edition/

python3 server.py
```

Open: [`https://localhost:1999`](https://localhost:1999)

Fallback (no correct MIME types, pixel fonts may not load):
```bash
python3 -m http.server 1999
```

---

## 🟦 Caddy (alternative dev server)

[Caddy v2](https://caddyserver.com) is a zero-config HTTPS server that provisions a trusted
local certificate automatically — **no `openssl` command, no browser security
warnings, no manual cert renewal.** If you prefer not to use `server.py` or
Python, Caddy is a drop-in alternative that provides the same security headers,
method guards, and certificate-directory protection defined in the `Caddyfile`
at the project root.

### One-time setup: trust the local CA

```bash
caddy trust
```

This installs Caddy's internal CA into your OS trust store so browsers
accept `https://localhost` without a warning. Only required once per machine.

> **Firefox** maintains its own trust store. After running `caddy trust`,
> also visit `about:preferences#privacy` → **Certificates** → **View Certificates**
> → **Authorities** → **Import** and import
> `$HOME/.local/share/caddy/pki/authorities/local/root.crt`
> (Linux) or the equivalent path on your platform.

### 🪟 Windows

```bash
# Install (pick one)
winget install Caddy.Caddy
# — or —
choco install caddy

# Run from the project root
cd Dino-Run-Chromatic-Edition/
caddy run
```

Open: [`https://localhost:1999`](https://localhost:1999)

### 🍎 macOS

```bash
brew install caddy

cd Dino-Run-Chromatic-Edition/
caddy run
```

Open: [`https://localhost:1999`](https://localhost:1999)

### 🐧 Linux

```bash
# Debian / Ubuntu
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

cd Dino-Run-Chromatic-Edition/
caddy run
```

Open: [`https://localhost:1999`](https://localhost:1999)

> Other distros: see the [official install guide](https://caddyserver.com/docs/install).

### 📱 Termux (Android)

Caddy is not in the standard Termux package index. Download the pre-built ARM64
binary directly from the GitHub release page:

```bash
pkg update && pkg upgrade -y
pkg install curl tar -y

# Download and unpack the latest Caddy release for ARM64
TAG=$(curl -s https://api.github.com/repos/caddyserver/caddy/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
curl -L "https://github.com/caddyserver/caddy/releases/download/${TAG}/caddy_${TAG}_linux_arm64.tar.gz" \
  | tar -xz caddy
chmod +x caddy
```

> **ARMv7 device?** Replace both occurrences of `arm64` (in the filename and tag variable) with `armv7` in the script above.  
> Latest release URL: <https://github.com/caddyserver/caddy/releases/latest>

#### Trust the local CA on Android

`caddy trust` installs Caddy's CA into the system trust store, which requires
root on Android. Use the manual import path instead:

**Step 1 — generate the CA cert by starting Caddy once:**

```bash
cd Dino-Run-Chromatic-Edition/
./caddy run &
```

Caddy writes its root CA to:

```text
$HOME/.local/share/caddy/pki/authorities/local/root.crt
```

**Step 2 — import the CA into Android:**

1. Copy `root.crt` to a location accessible by the Android file manager
   (e.g. `/sdcard/Download/caddy-root.crt`).
2. Open **Android Settings → Security → Encryption & credentials →
   Install a certificate → CA certificate**.
3. Select `caddy-root.crt` and confirm.

> The exact path varies by Android version and manufacturer skin — search
> "Install CA certificate" in Android Settings if you cannot find it.

**Step 3 — start Caddy properly:**

```bash
# Stop the background instance from Step 1
kill %1

# Start for real
./caddy run
```

Open: [`https://localhost:1999`](https://localhost:1999)

> **Rooted device?** You can run `./caddy trust` directly instead of the
> manual import steps above.

#### Moving Caddy to your PATH (optional)

```bash
mkdir -p $PREFIX/bin
mv caddy $PREFIX/bin/caddy
```

After this, use `caddy run` instead of `./caddy run`.

### Stopping Caddy

Press `Ctrl+C` in the terminal where `caddy run` is active.

### Caddy vs `server.py` — quick comparison

| Feature | `server.py` | `Caddyfile` |
|---|---|---|
| Runtime required | Python 3.6+ | Caddy v2 binary |
| TLS certificate | Manual `openssl` | Auto-provisioned |
| Browser trust | Manual (accept warning) | `caddy trust` (desktop) / manual CA import (Android) |
| Security headers | ✓ | ✓ (identical values) |
| Cert-dir block (403) | ✓ | ✓ |
| Method guards (405) | ✓ | ✓ |
| HTTP fallback mode | `ALLOW_HTTP_FALLBACK=1` | Not applicable (always HTTPS) |
| `Server:` header | `BaseHTTP/…` | Suppressed (`-Server`) |
| Termux install | `pkg install python` | Manual binary download |

---

## 🔐 Generating the self-signed certificate

> **Caddy users can skip this section entirely.** `caddy trust` + `caddy run`
> handle certificate provisioning automatically. The steps below apply only
> to `server.py`.

If `cert.pem` and `key.pem` are not present, generate them locally before
running `server.py`:

```bash
openssl req -x509 -newkey rsa:2048 \
  -keyout assets/certs/key.pem -out assets/certs/cert.pem \
  -days 365 -nodes -subj "/CN=localhost"
```

The cert is for local HTTPS only — it is not trusted by any external CA, which
is expected and fine for a localhost dev server. `server.py` prints a clear
error with the generation command if the files are missing when it starts.

---

## 📁 Project Structure

```text
Dino-Run-Chromatic-Edition/
├── index.html                  # UI structure, overlays, panels, ARIA semantics
├── assets/
│   ├── audio/
│   │   ├── die.mp3             # Death sound (MP3 — used by Safari / iOS)
│   │   ├── die.ogg             # Death sound (OGG Vorbis — all other browsers)
│   │   ├── jump.mp3            # Jump sound (MP3)
│   │   ├── jump.ogg            # Jump sound (OGG)
│   │   ├── milestone.mp3       # Milestone sound (MP3)
│   │   └── milestone.ogg       # Milestone sound (OGG)
│   ├── certs/
│   │   ├── cert.pem            # Local TLS certificate — generate with openssl (not in git)
│   │   └── key.pem             # Local TLS private key  — generate with openssl (not in git)
│   └── fonts/
│       ├── press-start-2p.woff2   # Pixel heading font
│       └── vt323.woff2            # Monospace stats / leaderboard font
├── css/
│   ├── base.css                # Reset, custom properties (base + CE theme tokens),
│   │                           #   ::selection, scrollbar polish, layout primitives
│   ├── game.css                # Canvas stack, overlays, HUD bar
│   ├── ui.css                  # Buttons, leaderboard, stats panel, name input,
│   │                           #   NEW BEST ce-pulse animation, speed-bar transition
│   └── accessibility.css       # Screen-reader utilities, :focus-visible ring,
│                               #   reduced-motion overrides
├── data/
│   ├── config.json             # Physics & speed tuning (gravity, jumpVelocity,
│   │                           #   acceleration, initialSpeed, maxSpeed)
│   ├── obstacles.json          # Obstacle geometry tuning (cactus width, height,
│   │                           #   minGap; pterodactyl minGap)
│   └── audio.json              # Audio file paths — extension stripped at runtime
│                               #   and replaced with browser-detected .ogg or .mp3
├── js/
│   ├── main.js                 # ES module entry point — boot, game lifecycle, UI wiring
│   ├── game/
│   │   ├── game.js             # Barrel re-export — re-exports everything from all game
│   │   │                       #   sub-modules for test tooling and external consumers
│   │   ├── engine.js           # Engine class: delta-time rAF game loop
│   │   ├── config.js           # Static constants (CONFIG, W, H, GY) + applyJSONConfig()
│   │   │                       #   + applyObstaclesConfig() — populated from data/*.json at boot
│   │   ├── runtime.js          # Mutable game state (G object)
│   │   ├── state.js            # Compatibility shim — re-exports from config.js + runtime.js
│   │   │                       #   (deprecated; import directly from source modules instead)
│   │   ├── audio.js            # Web Audio: browser-format detection, OGG/MP3 load,
│   │   │                       #   synthesised beep fallback, applyAudioConfig()
│   │   ├── player.js           # Dino physics: jump, duck, idle animation
│   │   ├── obstacles.js        # Cactus / pterodactyl spawning and movement
│   │   ├── physics.js          # Two-pass AABB collision detection
│   │   ├── renderer.js         # Three-layer canvas renderer (bgCanvas / gameCanvas / uiCanvas)
│   │   └── input.js            # Keyboard + mobile touch controls; full listener teardown
│   ├── db/
│   │   ├── database.js         # dbGet / dbSet (localStorage + in-memory fallback)
│   │   ├── storage.js          # Quota tracking + db:quota / db:criticalFailure events
│   │   ├── leaderboard.js      # Top-10 leaderboard with pruning fallback
│   │   └── stats.js            # Stats, player name, schema migration
│   └── utils/
│       └── utils.js            # Shared utilities: clamp, lerp, randomInt,
│                               #   formatScore, deepClone
├── server.py                   # Python HTTPS dev server with security headers (Python 3.6+)
│                               #   TLS certs live in assets/certs/ (cert.pem, key.pem)
├── Caddyfile                   # Caddy v2 HTTPS dev server — alternative to server.py
│                               #   Auto-provisions a trusted local cert via `caddy trust`
├── tests/
│   └── all.test.mjs            # Node --test regression suite — DB layer, audio, input,
│                               #   leaderboard pruning, and game-logic changes (v0.8.0-beta)
├── .github/
│   └── workflows/
│       ├── codeql.yml              # CodeQL SAST — runs on push/PR to main and weekly
│       └── coderabbit-pr-tracker.yml  # CodeRabbit PR tracker — posts review status on every PR
├── .gitignore                  # Excludes cert.pem / key.pem from version control
├── .coderabbit.yaml            # CodeRabbit AI review config — per-path engine guards
├── README.md                   # Project documentation (this file)
├── CHANGELOG.md                # Full release history with per-fix root-cause analysis
├── THIRD_PARTY.md              # Third-party license attributions (Chromium BSD-3-Clause)
└── LICENSE                     # MIT

```

---

## 🔤 Fonts

Fonts are loaded from `assets/fonts/` at runtime. If the directory or files are
missing, the game falls back to the system monospace font — fully playable
but without the retro pixel look.

To add the fonts manually (~50 KB total):

```bash
mkdir -p assets/fonts
curl -L -o assets/fonts/press-start-2p.woff2 \
  https://cdn.jsdelivr.net/fontsource/fonts/press-start-2p@5.0.0/latin-400-normal.woff2
curl -L -o assets/fonts/vt323.woff2 \
  https://cdn.jsdelivr.net/fontsource/fonts/vt323@5.0.0/latin-400-normal.woff2
```

---

## 🎮 Controls

| Action                  | Keyboard             | Mobile                        |
|-------------------------|----------------------|-------------------------------|
| Start                   | Space / ↑            | Tap screen                    |
| Jump                    | Space / ↑            | Tap / ▲ JUMP button           |
| Duck                    | Hold ↓               | Hold ▼ DUCK button            |
| Fast-fall (airborne)    | Hold ↓ while jumping | Hold ▼ DUCK while airborne    |
| Pause                   | P                    | ❙❙ PAUSE button               |
| Mute                    | M                    | 🔊 MUTE button                |
| Fullscreen              | F                    | FULL button                   |
| Restart                 | Space / ↑            | ↺ RESTART button              |
| Reset top score         | —                    | ✕ beside HI display in header |

---

## 💾 Storage

All data is stored **locally on your device only**. No server, no network,
no global leaderboard.

| Context                  | Backend      | Persists across sessions |
|--------------------------|--------------|--------------------------|
| localhost / any browser  | `localStorage` | ✓ Yes                    |
| Private / Incognito      | In-memory    | ✗ Session only           |

The DB badge in the Stats panel shows which backend is active and live storage
usage (e.g. `LOCAL STORAGE · OFFLINE · 12KB (0.2%)`).

### 🗝️ Storage keys

| Key             | Contents                                                         |
|-----------------|------------------------------------------------------------------|
| `dino:lb`       | Top-10 leaderboard entries (JSON array)                          |
| `dino:stats`    | Lifetime stats: games, deaths, obstacles, distance, best score, best time |
| `dino:player`   | Player display name (max 10 chars, uppercase)                    |
| `dino:version`  | Schema version — triggers automatic data migration on upgrade    |

### 📊 Quota handling

`localStorage` storage quotas vary by browser, platform, and user settings,
with ~5 MB per origin being a typical approximate value. The game uses a few
KB at most. `navigator.storage.persist()` is called at startup to request
persistent storage (though approval is not guaranteed) and help prevent
eviction under browser storage pressure.

If a write fails, the storage layer merges the new score with existing entries,
sorts by score, and prunes to top-10 (falling back to top-5 if still too large).
A `db:criticalFailure` event is dispatched on total failure — triggering a
blocking alert with recovery steps. Quota usage is read via
`navigator.storage.estimate()`, debounced to at most one IPC call per 2 seconds.

### ⚙️ Reset options

| Action           | HI display | Best score (persisted) | Best time | Leaderboard records |
|------------------|:----------:|:----------------------:|:---------:|:-------------------:|
| **✕** HI button  | ✓ reset    | ✓ reset                | —         | Intact              |
| **CLEAR** button | ✓ reset    | ✓ reset                | ✓ reset   | ✓ wiped             |

---

## 🏆 Leaderboard

- **Local top-10** sorted by score (highest first)
- Each entry stores: player name, score, and full timestamp (e.g. `19 Mar '26 14:07`)
- Gold / Silver / Bronze highlight for top 3
- Persists across browser sessions via `localStorage`
- Enter your name in the leaderboard panel; saves immediately on `SAVE` or `Enter`

---

## ♿ Accessibility

- All interactive controls have `aria-label` attributes
- Toggle buttons (`PAUSE`, `MUTE`) sync `aria-pressed` on every state change
- Game canvas has `role="application"` and a descriptive `aria-label`
- Game-over overlay is `role="alertdialog"` — announced immediately by screen readers
- Speed bar has `role="progressbar"` with live `aria-valuenow`
- Storage badge and player name display are `aria-live` regions
- Player name `<input>` has a programmatically associated `<label>` (visually hidden via `.sr-only`)
- Stat panel values use `aria-labelledby` linking to their label spans
- `blink`, `pulse`, and `go-newbest` animations are fully disabled under
  `prefers-reduced-motion: reduce` (WCAG 2.1 §2.3.3)

---

## 🌐 Browser Compatibility

| Browser                | Minimum version |
|------------------------|-----------------|
| Chrome / Chromium      | 88+             |
| Cromite                | 142+            |
| Edge (Chromium)        | 88+             |
| Firefox                | 93+             |
| Librewolf / Waterfox   | 93+             |
| Safari / iOS Safari    | 13+             |
| Samsung Internet       | 12+             |

> **ES modules** (`type="module"`) are required and supported by all listed browsers.  
> **Safari / iOS** — OGG Vorbis is not supported; the audio module detects this via `canPlayType()` and selects `.mp3` automatically. Both formats ship in `assets/audio/`.  
> **`e.code` keyboard events** are unreliable on Android software keyboards — on-screen
> touch buttons are the primary Android input; keyboard shortcuts are secondary.  
> **Librewolf** may block fullscreen via privacy settings — the `.catch()` guard handles this gracefully.  

---

## 🔧 Technical Notes

### Canvas & rendering

- Intrinsic resolution: **854 × 480 px (16:9)**, scaled to full width via CSS
- **Three-layer canvas stack** (`bgCanvas` / `gameCanvas` / `uiCanvas`) — static background redrawn only on palette change; moving entities and HUD clear+repaint every frame
- All sprites built programmatically with `fillRect` into offscreen canvases, then composited with `drawImage` — zero external image assets, zero HTTP requests for graphics
- In fullscreen, canvas scales to fill the viewport maintaining 16:9 via CSS `min()`
- `will-change: transform` promotes the canvas to its own GPU compositor layer
- `contain: layout style` on the game frame isolates layout recalculation

### Physics & timing

- **Delta-time physics**: all movement scaled by `dt` (normalised to 1.0 = one 60 Hz frame)
- Ground scroll uses accumulated `groundScrollX` (not `frameCount`) — Hz-independent; offset negated so texture scrolls left
- Best-time tracking uses `performance.now()` wall-clock delta — Hz-independent; pause duration is subtracted via `pauseStartTime` offset so only active play time counts
- Collision uses **two-pass AABB** (matches Chrome source `checkForCollision`):
  pass 1 fast-rejects with outer entity box; pass 2 checks per-part inner boxes
  (body + head/neck for standing; single wide box for ducking) against obstacle
  inner box shrunk 5 px per side

### JSON-driven configuration

All three `data/` JSON files are fetched sequentially at boot before the renderer
or game world initialise. Fetch failure for any file is non-fatal — the game
falls back to the hardcoded defaults in `config.js` with a `console.warn`.

| File | Applied by | What it controls |
|------|------------|------------------|
| `data/config.json` | `applyJSONConfig()` in `config.js` | `gravity`, `jumpVelocity`, `acceleration`, `initialSpeed`, `maxSpeed` |
| `data/obstacles.json` | `applyObstaclesConfig()` in `config.js` | Cactus `width`, `height`, `minGap`; pterodactyl `minGap` |
| `data/audio.json` | `applyAudioConfig()` in `audio.js` | Sound file base paths — extension auto-replaced with `.ogg` or `.mp3` per browser |

### Performance summary

| Optimisation | Benefit |
|--------------|---------|
| DOM element cache (`const DOM`) | Zero `getElementById` calls at runtime |
| Palette cache (`_pal`) | `lerpRGB` skipped when `dayPhase` unchanged |
| Static background layer (`bgCanvas`) | Background, horizon, and stars drawn once per `dayPhase` change on dedicated layer; no per-frame blit |
| `setFill()` dedup | ~50% fewer `ctx.fillStyle` writes per frame |
| HUD `textContent` dedup | Eliminates style recalcs when score hasn't changed |
| Speed bar integer dedup | `style.width` only written when `%` actually changes |
| In-place obstacle splice | Zero `Array.filter` allocations at 60 Hz |
| Debounced `refreshQuota()` | One storage IPC call per 2 s vs 2–3 per game-over |
| ES module tree shaking | Each module imports only what it uses — no global namespace |
| Sprite offscreen cache | Dino / cactus / ptera frames pre-rendered to offscreen canvases; rebuilt only on palette change |
| Speed-bar colour LUT | 101-entry precomputed array — zero `lerpRGB` calls per frame |

### Speed constants

| Parameter     | Value  | Notes                                           |
|---------------|--------|-------------------------------------------------|
| `SPEED_MIN`   | 6      | Starting speed (px/frame at 60 Hz)              |
| `SPEED_MAX`   | 13     | Cap speed (px/frame at 60 Hz)                   |
| `ACCELERATION`| 0.001  | Speed ramp per `dt`                             |
| `SCORE_COEFF` | 0.025  | Score increment per `(speed × dt)`              |
| `PTERA_SCORE` | 700    | Score threshold before pterodactyls can appear  |
| `PTERA_CHANCE`| 0.06   | Per-spawn probability of a pterodactyl (6%)     |

### Obstacle spawn mix

| Type          | Probability | Notes                         |
|---------------|:-----------:|-------------------------------|
| Single cactus | 50%         | Always                        |
| Double cactus | 45%         | Always                        |
| Triple cactus | 5%          | Always                        |
| Pterodactyl   | 6%          | Only when score > `PTERA_SCORE` (700) |

Cactus probabilities apply only when the pterodactyl roll fails (94% of spawns when score > 700).
Effective overall distribution: ptera 6%, single 47%, double 42.3%, triple 4.7%.

### Pterodactyl flight heights

Three distinct heights with specific dodge requirements:

| Height  | Bottom edge | Standing dino | Ducking dino | Required action    |
|---------|-------------|:-------------:|:------------:|--------------------|
| GY−40   | GY−12       | **HIT**       | **HIT**      | Jump over          |
| GY−69   | GY−41       | **HIT**       | Clear        | Jump or duck       |
| GY−120  | GY−92       | Clear         | Clear        | Duck mid-air       |

### Audio

Sound effects ship in both `.ogg` (OGG Vorbis) and `.mp3` formats under
`assets/audio/`. The audio module probes `canPlayType()` once at load time and
selects the appropriate extension — Safari and iOS WebKit receive `.mp3`;
all other browsers receive `.ogg`. The active paths can be overridden via
`data/audio.json` without editing source code; the extension in the JSON is
always replaced with the browser-detected format at runtime.

Sounds are loaded via `fetch` + `Web Audio API` (`decodeAudioData`). If the
fetch or decode fails for any sound, that sound automatically falls back to a
synthesised oscillator beep — the game remains fully playable with no manual
configuration.

---

## 🔒 Security

### Server (`server.py`)

Every HTTP response includes the following security headers:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` — blocks MIME sniffing |
| `X-Frame-Options` | `DENY` — blocks clickjacking via iframe |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; media-src 'self'; object-src 'none'; frame-ancestors 'none'` |
| `Referrer-Policy` | `no-referrer` — no URL leakage |
| `Permissions-Policy` | camera, microphone, geolocation, payment — all disabled |
| `Strict-Transport-Security` | `max-age=31536000` — HTTPS-only for 1 year |

Additional hardening:

- **10-second request timeout** — prevents slowloris / hung-connection DOS on the single-threaded server
- **Method guards** — `POST`, `PUT`, `DELETE`, `OPTIONS` all return 405; credential file paths return 403 regardless of method, before the body is read
- **Dynamic deny list** — cert/key basenames derived at startup from the actual loaded paths (`assets/certs/`), not hardcoded strings
- **Iterative URL decode** — path decoded in a loop until stable before basename extraction (blocks `/%2563ert.pem` and multi-encoded bypass attempts)

### Server (`Caddyfile`)

The `Caddyfile` enforces the same security posture as `server.py` via Caddy v2
directives:

| Header / Guard | Configured as |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Content-Security-Policy` | Identical policy to `server.py` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | camera, microphone, geolocation, payment — all disabled |
| `Strict-Transport-Security` | `max-age=31536000` |
| `Server:` header | Suppressed via `-Server` |
| Method guards | `not method GET HEAD` → 405 |
| Cert-dir block | `path /assets/certs/*` → 403 |

Note: Caddy does not have a configurable per-request timeout equivalent to
`server.py`'s 10-second timeout — rely on OS-level TCP keepalive for
slowloris protection in the unlikely event that matters for a localhost dev
server.

### Static Analysis (CodeQL)

All JavaScript source is scanned by **GitHub CodeQL** on every push and pull
request targeting `main`, and on a weekly schedule.

| Property | Detail |
|---|---|
| Workflow | `.github/workflows/codeql.yml` |
| Language | `javascript-typescript` (covers all `.js` and `.mjs` files) |
| Query suite | `security-and-quality` — security queries (XSS, prototype pollution, ReDoS, path traversal, unsafe deserialisation) plus quality rules (dead code, unused imports, unreachable branches, missing error handling) |
| Scope | `js/` and `tests/` — assets, fonts, and certs excluded |
| Triggers | Push to `main` · PR targeting `main` · Weekly (Monday 03:17 UTC) · Manual dispatch |
| Results | GitHub **Security** tab → Code scanning alerts |

CodeQL results are uploaded as SARIF and surface in the repository Security
tab. Any high or critical severity finding blocks merge via the branch
protection ruleset.

### PR Review Tracking (CodeRabbit)

Every pull request targeting `main` receives an automated tracker comment
posted by `.github/workflows/coderabbit-pr-tracker.yml`. The comment is
updated on every subsequent push to the PR.

| Property | Detail |
|---|---|
| Workflow | `.github/workflows/coderabbit-pr-tracker.yml` |
| Trigger | PR opened, synchronised, or reopened against `main` |
| Engine guard table | Flags 11 engine-critical files — shows ✅ unchanged / ⚠️ CHANGED per file |
| Parity checklist | Lists all 10 Chromium reference constants with required values |
| CodeQL link | Direct link to the Security tab code-scanning results for the PR |
| Comment behaviour | Creates on first push; updates in place on subsequent pushes (no spam) |

The tracker requires only the automatic `GITHUB_TOKEN` — no additional
secrets or third-party tokens needed.

- Player names rendered exclusively via `textContent` — zero `innerHTML`, zero XSS surface
- Score validated as a finite non-negative number before storage — prevents NaN/Infinity corruption of `localStorage` and `Array.sort()`
- `localStorage` is origin-scoped to `https://localhost:1999` — no cross-origin contamination possible
- `JSON.parse` results used as plain data only — no prototype pollution vector

---

## 🧩 Architecture Notes

All mutable game state lives in a single `G` object exported from `runtime.js`.
Every module imports and mutates `G` directly — no prop-drilling, no global namespace pollution.
Static constants (`CONFIG`, `W`, `H`, `GY`) are exported from `config.js` and populated
from the three `data/` JSON files at boot before any game logic runs.

DB modules follow a clean one-directional import chain:
`storage.js` ← `database.js` ← `leaderboard.js` / `stats.js`. No circular dependencies.

`input.js` receives callbacks so it stays fully decoupled from game logic.

`game.js` is a barrel re-export of all game sub-modules — external tooling,
tests, and dev-console code can import any symbol from a single entry point
without knowing the internal file layout.

`state.js` is a deprecated compatibility shim that re-exports from `config.js`
and `runtime.js`. Prefer importing directly from those source modules.

### `js/game/`

| Module | Concern | Key detail |
|-------------|------------------------|------------|
| `game.js` | Barrel re-export | Re-exports all public symbols from the 10 game sub-modules |
| `engine.js` | Game loop | `requestAnimationFrame`; `dt` = elapsed ms / 16.667, clamped to 3.0; bound loop function allocated once in constructor |
| `config.js` | Static constants | `CONFIG`, `W`, `H`, `GY`; `applyJSONConfig()` + `applyObstaclesConfig()` populate from `data/` at boot |
| `runtime.js` | Mutable state | `G` object — all per-frame and per-session state |
| `state.js` | Compatibility shim | Re-exports `config.js` + `runtime.js` — deprecated, kept for backwards compatibility |
| `physics.js` | Collision | Two-pass AABB; reusable box objects — zero allocations per frame; obstacle box shrunk 5 px per side |
| `renderer.js` | Canvas drawing | Three-layer stack; `lerpRGB` palette cached; sprite offscreen cache; `CACTUS_INTRA_GAP` used for multi-cactus spacing; `lerp` imported from `utils.js` |
| `obstacles.js` | Obstacle management | Gap-based spawning matching Chrome source; `CACTUS_INTRA_GAP` constant controls intra-cluster spacing |
| `audio.js` | Sound | Browser format detection; `fetch` + `decodeAudioData` for OGG/MP3; synthesised beep fallback; `applyAudioConfig()` for JSON path overrides |
| `player.js` | Dino physics | Jump, duck, fast-fall, idle animation; sub-pixel `y` position for smooth descent |
| `input.js` | Input | Callbacks-based; full listener registry enables zero-leak `teardownInput()` |

### `js/utils/`

| Module | Concern | Key detail |
|------------|------------------------|------------|
| `utils.js` | Shared utilities | `clamp`, `lerp` (imported by `renderer.js`), `randomInt`, `formatScore`, `deepClone` |

### `js/db/`

| Module | Concern | Key detail |
|-------------|------------------------|------------|
| `database.js` | Backend | Try/catch probe at load; `dbGet` / `dbSet` API |
| `storage.js` | Quota | Debounced 2 s polling; `navigator.storage.persist()` at startup |
| `leaderboard.js` | Scores | `pruneAndSave` falls back to top-5; dispatches `db:criticalFailure` on total failure |
| `stats.js` | Stats & migration | `migrate()` IIFE at boot; v0→v1 backfills missing `recordId` fields |

---

## 🧪 Tests

The full test suite covers the DB layer and core game logic.

```bash
node --experimental-vm-modules tests/all.test.mjs
```

> Requires Node.js 18+. No npm install needed — the suite uses only built-in Node APIs and ES modules.

---

## 🗒️ Changelog

Full release history with per-fix root-cause analysis in [CHANGELOG.md](CHANGELOG.md).

---

## 📄 License

This project is licensed under the MIT License — see [LICENSE](LICENSE).

---

## 🔖 Third-Party Components

Portions of this project are derived from the [Chromium Dino game](https://source.chromium.org/chromium/chromium/src/+/main:components/neterror/resources/offline.js).

- Original authors: The Chromium Authors
- License: BSD 3-Clause License

These include:

- Game logic concepts (physics, obstacle system, collision handling)
- Structural behaviour inspired by the original implementation
- Audio assets (`jump`, `die`, `milestone` sounds)

All such components have been adapted, refactored, and integrated into a new modular architecture.

---

## 📜 Attribution

Redistributions of this project must retain:

- The MIT License (this project)
- The BSD 3-Clause License (Chromium components)

See [THIRD_PARTY.md](THIRD_PARTY.md) for full license text and attribution details.
