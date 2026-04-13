# 🦕 Dino Run — Chromatic Edition

A fully offline Chrome-style endless runner with day/night cycle,
pterodactyls, persistent local leaderboard, and session stats.  
No network calls · No tracking · No image assets.

**Current version: 0.7.5-beta**

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Sumon-Kayal/Dino-Run-Chromatic-Edition?utm_source=oss&utm_medium=github&utm_campaign=Sumon-Kayal%2FDino-Run-Chromatic-Edition&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)


---

## ✨ Features

- **Endless runner** with delta-time physics — Hz-independent at 60 / 90 / 120 / 144 Hz
- **Speed calibrated to the original Chrome Dino** — `5 → 13 px/frame`, reaching max speed at score ~2660
- **Chromatic day/night cycle** — colour-interpolated sky, crescent moon, stars, cloud parallax
- **Fullscreen mode** — `F` key or `FULL` button; canvas scales to fill viewport at 16:9
- **Top-10 local leaderboard** persisted in `localStorage` (session-only fallback for private contexts)
- **★ NEW BEST ★ banner** — pulsing gold overlay when the player beats their previous best
- **5 MB storage awareness** — live quota display, graceful pruning on overflow, user-visible alert on critical failure
- **Web Audio** sound effects — `.ogg` / `.mp3` files loaded at runtime with synthesised beep fallback; paths driven by `data/audio.json`; mutable via `M`
- **Mobile-friendly** — touch jump/duck controls, no double-fire on tap
- **Keyboard shortcuts** — `Space`/`↑` jump · `↓` duck · `P` pause · `M` mute · `F` fullscreen
- **Reset top score** — `✕` button beside the HI display resets the high score while keeping leaderboard records
- **Accessible** — ARIA labels, live regions, screen-reader–compatible, `prefers-reduced-motion` support
- **HTTPS dev server** with security headers, request timeout, and HTTP method guards (`server.py`)
- **Modular ES module architecture** — game engine and DB layer split into focused, dependency-clean modules
- **JSON-driven tuning** — physics, speed, obstacle geometry, and audio paths configurable without editing source code

---

## 🚀 Quick Start

### 🌐 Clone from GitHub

```bash
git clone https://github.com/Sumon-Kayal/Dino-Run-Chromatic-Edition.git
cd Dino-Run-Chromatic-Edition
```

If `server/certs/cert.pem` / `server/certs/key.pem` are missing, generate them
before running `server.py` — see the [certificate section](#-generating-the-self-signed-certificate) below.

---

## 🖥️ Platform Setup Guide

### 🪟 Windows

```bash
cd Dino-Run-Chromatic-Edition/
python server.py
```

Open: https://localhost:1999

### 🍎 macOS

```bash
cd Dino-Run-Chromatic-Edition/
python3 server.py
```

Open: https://localhost:1999

### 🐧 Linux

```bash
cd Dino-Run-Chromatic-Edition/
python3 server.py
```

Open: https://localhost:1999

### 📱 Termux (Android)

```bash
pkg update && pkg upgrade -y
pkg install python git -y

git clone https://github.com/Sumon-Kayal/Dino-Run-Chromatic-Edition.git
cd Dino-Run-Chromatic-Edition/

python3 server.py
```

Open: https://localhost:1999

Fallback (no correct MIME types, pixel fonts may not load):
```bash
python3 -m http.server 1999
```

## 🔐 Generating the self-signed certificate

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
│       ├── cert.pem            # Local TLS certificate — generate with openssl (not in git)
│       └── key.pem             # Local TLS private key  — generate with openssl (not in git)
│   └── fonts/
│       ├── press-start-2p.woff2   # Pixel heading font
│       └── vt323.woff2            # Monospace stats / leaderboard font
├── css/
│   ├── base.css                # Reset, custom properties, layout primitives
│   ├── game.css                # Canvas stack, overlays, HUD bar
│   ├── ui.css                  # Buttons, leaderboard, stats panel, name input
│   ├── accessibility.css       # Screen-reader utilities, reduced-motion overrides
│   └── style.css               # Chromatic Edition theme tokens (CSS custom properties),
│                               #   NEW BEST pulse animation, scrollbar polish, focus rings
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
│   │   ├── db.js               # Barrel re-export for db sub-modules
│   │   ├── database.js         # dbGet / dbSet (localStorage + in-memory fallback)
│   │   ├── storage.js          # Quota tracking + db:quota / db:criticalFailure events
│   │   ├── leaderboard.js      # Top-10 leaderboard with pruning fallback
│   │   └── stats.js            # Stats, player name, schema migration
│   └── utils/
│       └── utils.js            # Shared utilities: clamp, lerp, randomInt,
│                               #   formatScore, deepClone
├── server.py                   # HTTPS dev server with security headers (Python 3.6+)
│                               #   TLS certs live in assets/certs/ (cert.pem, key.pem)
├── tests/
│   └── all.test.mjs            # Full test suite — db layer + game logic
├── .gitignore                  # Excludes cert.pem / key.pem from version control
├── .github/
│   └── workflows/
│       └── codeql.yml          # CodeQL security analysis workflow
├── README.md
├── CHANGELOG.md
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
  https://cdn.jsdelivr.net/fontsource/fonts/press-start-2p@latest/latin-400-normal.woff2
curl -L -o assets/fonts/vt323.woff2 \
  https://cdn.jsdelivr.net/fontsource/fonts/vt323@latest/latin-400-normal.woff2
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
| Restart                 | Space / Tap          | ↺ RESTART button              |
| Reset top score         | —                    | ✕ beside HI display in header |

---

## 💾 Storage

All data is stored **locally on your device only**. No server, no network,
no global leaderboard.

| Context                  | Backend      | Persists across sessions |
|--------------------------|--------------|--------------------------|
| localhost / any browser  | localStorage | ✓ Yes                    |
| Private / Incognito      | In-memory    | ✗ Session only           |

The DB badge in the Stats panel shows which backend is active and live storage
usage (e.g. `LOCAL STORAGE · OFFLINE · 12KB (0.2%)`).

## 🗝️ Storage keys

| Key             | Contents                                                         |
|-----------------|------------------------------------------------------------------|
| `dino:lb`       | Top-10 leaderboard entries (JSON array)                          |
| `dino:stats`    | Lifetime stats: games, deaths, obstacles, distance, best score, best time |
| `dino:player`   | Player display name (max 10 chars, uppercase)                    |
| `dino:version`  | Schema version — triggers automatic data migration on upgrade    |

## 📊 Quota handling

localStorage provides ~5 MB per origin in all major browsers. The game uses
a few KB at most. `navigator.storage.persist()` is requested at startup to
prevent eviction under browser storage pressure.

If a write fails, the storage layer merges the new score with existing entries,
sorts by score, and prunes to top-10 (falling back to top-5 if still too large).
A `db:criticalFailure` event is dispatched on total failure — triggering a
blocking alert with recovery steps. Quota usage is read via
`navigator.storage.estimate()`, debounced to at most one IPC call per 2 seconds.

## 🏆 Reset options

| Action           | HI display | Best score (persisted) | Best time | Leaderboard records |
|------------------|:----------:|:----------------------:|:---------:|:-------------------:|
| **✕** HI button  | ✓ reset    | ✓ reset                | —         | Intact              |
| **CLEAR** button | ✓ reset    | ✓ reset                | ✓ reset   | ✓ wiped             |

---

## 🏆 Leaderboard

- **Local top-10** sorted by score (highest first)
- Each entry stores: player name, score, and full timestamp (e.g. `19 Mar '26 14:07`)
- Gold / Silver / Bronze highlight for top 3
- Persists across browser sessions via localStorage
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
| Librewolf / Waterfox   | ✓               |
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
- All sprites drawn with `fillRect` — zero image assets, zero HTTP requests for graphics
- In fullscreen, canvas scales to fill the viewport maintaining 16:9 via CSS `min()`
- `will-change: transform` promotes the canvas to its own GPU compositor layer
- `contain: layout style` on the game frame isolates layout recalculation

### Physics & timing

- **Delta-time physics**: all movement scaled by `dt` (normalised to 1.0 = one 60 Hz frame)
- Ground scroll uses accumulated `groundScrollX` (not `frameCount`) — Hz-independent; offset negated so texture scrolls left
- Best-time tracking uses `performance.now()` wall-clock delta — Hz-independent; pause duration is subtracted via `pauseStartTime` offset so only active play time counts
- Collision uses **two-pass AABB** (matches Chrome source `checkForCollision`): pass 1 fast-rejects with outer entity box; pass 2 checks per-part inner boxes (body + head/neck for standing; single wide box for ducking) against obstacle inner box shrunk 8 px per side

### JSON-driven configuration

All three `data/` JSON files are fetched sequentially at boot before the renderer
or game world initialise. Fetch failure for any file is non-fatal — the game
falls back to the hardcoded defaults in `config.js` with a `console.warn`.

| File | Applied by | What it controls |
|---|---|---|
| `data/config.json` | `applyJSONConfig()` in `config.js` | `gravity`, `jumpVelocity`, `acceleration`, `initialSpeed`, `maxSpeed` |
| `data/obstacles.json` | `applyObstaclesConfig()` in `config.js` | Cactus `width`, `height`, `minGap`; pterodactyl `minGap` |
| `data/audio.json` | `applyAudioConfig()` in `audio.js` | Sound file base paths — extension auto-replaced with `.ogg` or `.mp3` per browser |

### Performance summary

| Optimisation | Benefit |
|---|---|
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
| `SPEED_MIN`   | 5      | Starting speed (px/frame at 60 Hz)              |
| `SPEED_MAX`   | 13     | Cap speed (px/frame at 60 Hz)                   |
| `ACCELERATION`| 0.0015 | Speed ramp per `dt`                             |
| `SCORE_COEFF` | 0.04   | Score increment per `(speed × dt)`              |
| `PTERA_SCORE` | 700    | Score threshold before pterodactyls can appear  |
| `PTERA_CHANCE`| 0.22   | Per-spawn probability of a pterodactyl (22%)    |

### Obstacle spawn mix

| Type          | Probability | Notes                         |
|---------------|:-----------:|-------------------------------|
| Single cactus | 60%         | Always                        |
| Double cactus | 32%         | Always                        |
| Triple cactus | 8%          | Always                        |
| Pterodactyl   | 22% chance  | Only when score > `PTERA_SCORE` (700) |

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

### Server (`server/server.py`)

Every HTTP response includes the following security headers:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` — blocks MIME sniffing |
| `X-Frame-Options` | `DENY` — blocks clickjacking via iframe |
| `Content-Security-Policy` | `default-src 'self'`; `img-src 'self' data:` for SVG favicon |
| `Referrer-Policy` | `no-referrer` — no URL leakage |
| `Permissions-Policy` | camera, microphone, geolocation, payment all disabled |
| `Strict-Transport-Security` | `max-age=31536000` — HTTPS-only for 1 year |

Additional hardening:

- **10-second request timeout** — prevents slowloris / hung-connection DOS on the single-threaded server
- **Method guards** — `POST`, `PUT`, `DELETE`, `OPTIONS` all return 405; credential file paths return 403 regardless of method, before the body is read
- **Dynamic deny list** — cert/key basenames derived at startup from the actual loaded paths (`server/certs/`), not hardcoded strings
- **Iterative URL decode** — path decoded in a loop until stable before basename extraction (blocks `/%2563ert.pem` and multi-encoded bypass attempts)

### Client (`js/game/`, `js/db/`)

- Player names rendered exclusively via `textContent` — zero `innerHTML`, zero XSS surface
- Score validated as a finite non-negative number before storage — prevents NaN/Infinity corruption of localStorage and `Array.sort()`
- localStorage is origin-scoped to `https://localhost:1999` — no cross-origin contamination possible
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
|---|---|---|
| `game.js` | Barrel re-export | Re-exports all public symbols from the 9 game sub-modules |
| `engine.js` | Game loop | `requestAnimationFrame`; `dt` = elapsed ms / 16.667, clamped to 3.0; bound loop function allocated once in constructor |
| `config.js` | Static constants | `CONFIG`, `W`, `H`, `GY`; `applyJSONConfig()` + `applyObstaclesConfig()` populate from `data/` at boot |
| `runtime.js` | Mutable state | `G` object — all per-frame and per-session state |
| `state.js` | Compatibility shim | Re-exports `config.js` + `runtime.js` — deprecated, kept for backwards compatibility |
| `physics.js` | Collision | Two-pass AABB; reusable box objects — zero allocations per frame; obstacle box shrunk 8 px per side |
| `renderer.js` | Canvas drawing | Three-layer stack; `lerpRGB` palette cached; sprite offscreen cache; `CACTUS_INTRA_GAP` used for multi-cactus spacing; `lerp` imported from `utils.js` |
| `obstacles.js` | Obstacle management | Gap-based spawning matching Chrome source; `CACTUS_INTRA_GAP` constant controls intra-cluster spacing |
| `audio.js` | Sound | Browser format detection; `fetch` + `decodeAudioData` for OGG/MP3; synthesised beep fallback; `applyAudioConfig()` for JSON path overrides |
| `player.js` | Dino physics | Jump, duck, fast-fall, idle animation; sub-pixel `y` position for smooth descent |
| `input.js` | Input | Callbacks-based; full listener registry enables zero-leak `teardownInput()` |

### `js/utils/`

| Module | Concern | Key detail |
|---|---|---|
| `utils.js` | Shared utilities | `clamp`, `lerp` (imported by `renderer.js`), `randomInt`, `formatScore`, `deepClone` |

### `js/db/`

| Module | Concern | Key detail |
|---|---|---|
| `db.js` | Barrel re-export | Re-exports all public symbols from all 4 db sub-modules (`database`, `leaderboard`, `stats`, `storage`) |
| `database.js` | Backend | Try/catch probe at load; `dbGet` / `dbSet` API |
| `storage.js` | Quota | Debounced 2 s polling; `navigator.storage.persist()` at startup |
| `leaderboard.js` | Scores | `pruneAndSave` falls back to top-5; dispatches `db:criticalFailure` on total failure |
| `stats.js` | Stats & migration | `migrate()` IIFE at boot; v0→v1 backfills missing `recordId` fields |

---

## 📋 Changelog

Full release history with per-fix root-cause analysis in [CHANGELOG.md](CHANGELOG.md)

---

## 📄 License

This project is licensed under the MIT License — see [LICENSE](LICENSE).

---

## Third-Party Components

Portions of this project are derived from the Chromium Dino game from https://source.chromium.org/chromium/chromium/src/+/main:components/neterror/resources/offline.js.

- Original authors: The Chromium Authors
- License: BSD 3-Clause License

These include:

- Game logic concepts (physics, obstacle system, collision handling)
- Structural behavior inspired by the original implementation
- Audio assets ("jump", "die", "milestone" sounds)

All such components have been adapted, refactored, and integrated into a new modular architecture.

---

## 📜 Attribution

Redistributions of this project must retain:

- The MIT License (this project)
- The BSD 3-Clause License (Chromium components)

See [THIRD_PARTY.md](THIRD_PARTY.md) for full license text and attribution details.
