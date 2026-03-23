# 🦕 Dino Run — Chromatic Edition

A fully offline Chrome-style endless runner with day/night cycle,
pterodactyls, persistent local leaderboard, and session stats.  
No network calls · No tracking · No image assets.

**Current version: 5.2.2**

---

## ✨ Features

- **Endless runner** with delta-time physics — Hz-independent at 60 / 90 / 120 / 144 Hz
- **Speed calibrated to the original Chrome Dino** — `8.5 → 18.5 px/frame` derived from Chromium source, reaching max speed at score ~2660
- **Chromatic day/night cycle** — colour-interpolated sky, crescent moon, stars, cloud parallax
- **Fullscreen mode** — `F` key or `FULL` button; canvas scales to fill viewport at 16:9
- **Top-10 local leaderboard** persisted in `localStorage` (session-only fallback for private contexts)
- **★ NEW BEST ★ banner** — pulsing gold overlay when the player beats their previous best
- **5 MB storage awareness** — live quota display, graceful pruning on overflow, user-visible alert on critical failure
- **Web Audio** sound effects (mutable, `M` shortcut)
- **Mobile-friendly** — touch jump/duck controls, no double-fire on tap
- **Keyboard shortcuts** — `Space`/`↑` jump · `↓` duck · `P` pause · `M` mute · `F` fullscreen
- **Reset top score** — `✕` button beside the HI display resets the high score while keeping leaderboard records
- **Accessible** — ARIA labels, live regions, screen-reader–compatible, `prefers-reduced-motion` support
- **HTTPS dev server** with security headers, request timeout, and HTTP method guards (`server.py`)

---

## 🚀 Quick Start

### 🌐 Clone from GitHub

```bash
git clone https://github.com/Sumon-Kayal/Dino-Run-Chromatic-Edition.git
cd Dino-Run-Chromatic-Edition
```

If `cert.pem` / `key.pem` are missing, generate them before running `server.py`
— see the [certificate section](#-generating-the-self-signed-certificate) below.

---

## 🖥️ Platform Setup Guide

### 🪟 Windows

```bash
cd Dino-Run-Chromatic-Edition
python server.py
```

Open: https://localhost:1999

### 🍎 macOS

```bash
cd Dino-Run-Chromatic-Edition
python3 server.py
```

Open: https://localhost:1999

### 🐧 Linux

```bash
cd Dino-Run-Chromatic-Edition
python3 server.py
```

Open: https://localhost:1999

### 📱 Termux (Android)

```bash
pkg update && pkg upgrade
pkg install python git

git clone https://github.com/Sumon-Kayal/Dino-Run-Chromatic-Edition.git
cd Dino-Run-Chromatic-Edition

python server.py
```

Open: https://localhost:1999

Fallback (no correct MIME types, pixel fonts may not load):
```bash
python3 -m http.server 1999
```

### 🔐 Generating the self-signed certificate

If `cert.pem` and `key.pem` are not present, generate them locally before
running `server.py`:

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 365 -nodes -subj "/CN=localhost"
```

The cert is for local HTTPS only — it is not trusted by any external CA, which
is expected and fine for a localhost dev server. `server.py` prints a clear
error with the generation command if the files are missing when it starts.

---

## 📁 Project Structure

```text
Dino-Run-Chromatic-Edition/
├── index.html          # UI structure, overlays, panels, ARIA semantics
├── style.css           # Retro pixel aesthetic + accessibility + reduced-motion
├── db.js               # Storage layer — localStorage / in-memory fallback
├── game.js             # Game engine — physics, rendering, input, audio, UI
├── server.py           # HTTPS dev server with security headers (Python 3.6+)
├── fonts/
│   ├── press-start-2p.woff2   # Pixel heading font
│   └── vt323.woff2            # Monospace stats / leaderboard font
├── cert.pem            # Local TLS certificate — generate with openssl (not in git)
├── key.pem             # Local TLS private key  — generate with openssl (not in git)
├── .gitignore          # Excludes cert.pem / key.pem from version control
├── .github/
│   └── workflows/
│       └── codeql.yml  # CodeQL security analysis workflow
├── README.md
├── CHANGELOG.md
└── LICENSE             # MIT
```

---

## 🔤 Fonts

Fonts are loaded from `fonts/` at runtime. If the directory or files are
missing, the game falls back to the system monospace font — fully playable
but without the retro pixel look.

To add the fonts manually (~50 KB total):

```bash
mkdir -p fonts
curl -L -o fonts/press-start-2p.woff2 \
  https://cdn.jsdelivr.net/fontsource/fonts/press-start-2p@latest/latin-400-normal.woff2
curl -L -o fonts/vt323.woff2 \
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

### 🗝️ Storage keys

| Key             | Contents                                                         |
|-----------------|------------------------------------------------------------------|
| `dino:lb`       | Top-10 leaderboard entries (JSON array)                          |
| `dino:stats`    | Lifetime stats: games, deaths, obstacles, distance, best time    |
| `dino:player`   | Player display name (max 10 chars, uppercase)                    |
| `dino:version`  | Schema version — triggers automatic data migration on upgrade    |

### 📊 Quota handling

localStorage provides ~5 MB per origin in all major browsers. The game uses
a few KB at most. `navigator.storage.persist()` is requested at startup to
prevent eviction under browser storage pressure.

If a write fails, the storage layer merges the new score with existing entries,
sorts by score, and prunes to top-10 (falling back to top-5 if still too large).
A `db:criticalFailure` event is dispatched on total failure — triggering a
blocking alert with recovery steps. Quota usage is read via
`navigator.storage.estimate()`, debounced to at most one IPC call per 2 seconds.

### 🏆 Reset options

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

> **Note on `e.code` keyboard events:** unreliable on Android software keyboards.
> The game uses on-screen touch buttons as primary Android input; keyboard
> shortcuts are secondary. Librewolf may block fullscreen via privacy settings —
> the `.catch()` guard handles this gracefully.

---

## 🔧 Technical Notes

#### Canvas & rendering

- Intrinsic resolution: **854 × 480 px (16:9)**, scaled to full width via CSS
- All sprites drawn with `fillRect` — zero image assets, zero HTTP requests for graphics
- In fullscreen, canvas scales to fill the viewport maintaining 16:9 via CSS `min()`
- `will-change: transform` promotes the canvas to its own GPU compositor layer
- `contain: layout style` on the game frame isolates layout recalculation

#### Physics & timing

- **Delta-time physics**: all movement scaled by `dt` (normalised to 1.0 = one 60 Hz frame)
- Ground scroll uses accumulated `groundScrollX` (not `frameCount`) — Hz-independent
- Best-time tracking uses `performance.now()` wall-clock delta — Hz-independent
- Hitbox collision uses reusable `_dinoBox` / `_obsBox` objects — zero allocations per frame

#### Performance summary

| Optimisation | Benefit |
|---|---|
| DOM element cache (`const DOM`) | Zero `getElementById` calls at runtime |
| Palette cache (`_pal`) | `lerpRGB` skipped when `dayPhase` unchanged |
| `setFill()` dedup | ~50% fewer `ctx.fillStyle` writes per frame |
| HUD `textContent` dedup | Eliminates style recalcs when score hasn't changed |
| Speed bar integer dedup | `style.width` only written when `%` actually changes |
| In-place obstacle splice | Zero `Array.filter` allocations at 60 Hz |
| Debounced `refreshQuota()` | One storage IPC call per 2 s vs 2–3 per game-over |

#### Speed constants

| Parameter     | Value | Source                                    |
|---------------|-------|-------------------------------------------|
| `SPEED_MIN`   | 8.5   | 6 px/f × 854/600 canvas scale             |
| `SPEED_MAX`   | 18.5  | 13 px/f × 854/600 canvas scale            |
| Ramp divisor  | 2660  | Score at which original reaches max speed |
| `PTERA_SCORE` | 900   | 200 × (2660/600), proportional to ramp    |

#### Pterodactyl flight heights

Three distinct heights with specific dodge requirements:

| Height | Bottom edge | Standing dino | Ducking dino | Required action |
|--------|-------------|:-------------:|:------------:|-----------------|
| GY−60  | GY−36       | **HIT**       | **HIT**      | Jump over       |
| GY−68  | GY−44       | **HIT**       | Clear        | Jump or duck    |
| GY−120 | GY−96       | Clear         | Clear        | Duck (mid-air)  |

---

## 🔒 Security

### Server (`server.py`)

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
- **Dynamic deny list** — cert/key basenames derived at startup from the actual loaded paths, not hardcoded strings
- **Iterative URL decode** — path decoded in a loop until stable before basename extraction (blocks `/%2563ert.pem` and multi-encoded bypass attempts)

### Client (`game.js`, `db.js`)

- Player names rendered exclusively via `textContent` — zero `innerHTML`, zero XSS surface
- Score validated as a finite non-negative number before storage — prevents NaN/Infinity corruption of localStorage and `Array.sort()`
- localStorage is origin-scoped to `https://localhost:1999` — no cross-origin contamination possible
- `JSON.parse` results used as plain data only — no prototype pollution vector

---

## 📋 Changelog

Full release history with per-fix root-cause analysis in [CHANGELOG.md](CHANGELOG.md)
(v0.9.0-rc through v5.2.0, 17 releases).

---

## 📄 License

MIT — see [LICENSE](LICENSE).
