# 🦖 Dino Run — Chromatic Edition

A faithful, offline-first Chrome Dino clone with a chromatic day/night cycle,
pterodactyls, persistent local leaderboard, and a full Web Audio sound engine.
Completely offline — no network calls, tracking, or dependencies.

> **Current version:** `0.7.0-beta`  
> See [CHANGELOG.md](CHANGELOG.md) for the full history.

---

## Features

- **Chrome-accurate physics** — delta-time game loop (Hz-independent), linear
  speed ramp, gravity and jump arc tuned against the original Chromium source
- **Day/Night transition** — smooth chromatic fade from full day to full night
  triggered at score 700; stars, crescent moon, and full palette inversion
- **Obstacle variety** — single, double, and triple cactus clusters; three
  pterodactyl flight heights requiring jump, duck, or either
- **Web Audio sound engine** — jump, death, and milestone sounds built from
  Web Audio API oscillators; no audio files required
- **Persistent leaderboard** — top 10 scores stored in `localStorage` with
  player names and timestamps; survives page reloads
- **Session stats** — games played, best score, best time, obstacles dodged,
  deaths, total distance
- **Fullscreen support** — `F` key or `FULL` button; 16:9 aspect ratio
  preserved via CSS `min()` scaling; header/panels hidden in fullscreen
- **Mobile controls** — touch-friendly JUMP / DUCK / PAUSE / MUTE / FULL
  button bar; works on Android Cromite and Firefox for Android
- **Offline-first** — zero CDN requests; all fonts are local `.woff2` files
- **Storage quota awareness** — live quota badge; graceful degradation to
  in-memory store in private/restricted contexts; quota-full warning with
  actionable recovery steps
- **Accessibility** — full ARIA markup; `prefers-reduced-motion` respected;
  keyboard-navigable controls; screen-reader-compatible leaderboard table

---

## Project Structure

```text
dino-run/
├── index.html          # Shell, overlays, stats panel, leaderboard UI
├── game.js             # Game engine — physics, rendering, input, audio, HUD
├── db.js               # Storage layer — localStorage / in-memory, quota, stats
├── style.css           # All styles including fullscreen, dark palette, animations
├── server.py           # Local HTTPS dev server (required for Termux / Cromite)
├── cert.pem            # TLS certificate  ← generate locally, never commit
├── key.pem             # TLS private key  ← generate locally, never commit
├── db.test.js          # Unit tests for db.js  (node db.test.js)
├── game.test.js        # Unit tests for game.js pure logic  (node game.test.js)
├── fonts/
│   ├── press-start-2p.woff2
│   └── vt323.woff2
└── CHANGELOG.md
```

---

## Quick Start

### Desktop (Chrome / Firefox / Edge)

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

### Android (Termux + Cromite)

Cromite enforces HTTPS for Web Audio and fullscreen when not on `localhost`.
The bundled `server.py` sets up a local TLS server to satisfy this.

**1. Generate a self-signed certificate** (one-time):

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 365 -nodes -subj "/CN=localhost"
```

Place `cert.pem` and `key.pem` in the project root.

**2. Start the server:**

```bash
python3 server.py
```

**3. Open in Cromite:**

```text
https://localhost:1999
```

Accept the self-signed certificate warning on first visit (**Advanced → Proceed**).

> ⚠️ `cert.pem` and `key.pem` are in `.gitignore`. Never commit them.

---

## Running Tests

Both test files use the Node.js built-in test runner — no `npm install` needed.

```bash
node db.test.js      # Storage layer tests (~40 assertions)
node game.test.js    # Game logic tests (~35 assertions)
```

`game.test.js` reads `game.js` from the current working directory. Run from
the project root.

---

## Controls

| Action | Keyboard | Mobile |
|---|---|---|
| Jump / Start / Restart | `Space` or `↑` | JUMP button or tap canvas |
| Duck | `↓` (hold) | DUCK button (hold) |
| Pause / Resume | `P` | PAUSE button |
| Mute / Unmute | `M` | 🔊 button |
| Fullscreen | `F` | FULL button |

---

## Gameplay

### Speed

The game starts at **speed 6** (`SPEED_START`) and ramps linearly via
`speed += 0.002 × dt` each frame, capped at **13** (`SPEED_CAP`). The
speed bar fills from `0%` at start to `100%` at cap, using the formula
`(speed - 6) / (13 - 6)` normalized to 0-100%.

### Day / Night

The scene starts in full daylight. Once the player reaches **score 700**, the
background gradually transitions to night over approximately 500 frames (~8 s).
Night persists for the remainder of the run.

### Obstacles

| Type | Condition | How to clear |
|---|---|---|
| Single cactus | Always | Jump over |
| Double cactus (35%) | Always | Jump over |
| Triple cactus (12%) | Always | Jump over |
| Pterodactyl — high (`GY−120`) | Score > 900 | Duck under (mid-air dino can enter this band) |
| Pterodactyl — mid (`GY−40`) | Score > 900 | Jump over (ducking also hits) |
| Pterodactyl — low (`GY−69`) | Score > 900 | Jump over or duck under |

Obstacle spawn cooldown scales with speed: ~60–85 frames at start; ~20–45
frames at cap. Up to 5 obstacles exist simultaneously.

### Jump Physics

| Parameter | Value |
|---|---|
| `GRAVITY` | `0.55` per frame² |
| `JUMP_V` | `−11.5` px/frame |
| Fast-fall (duck mid-air) | `+3.8 × dt` added to `vy` per frame |

### Hitboxes

| Box | Inset |
|---|---|
| Dino (standing / ducking) | `x+9`, `y+7`, `w−14` (constant), `h−12` |
| Obstacle (cactus / ptera) | `+5` each side (`w−10`, `h−10`) |

---

## Leaderboard & Stats

### Player Name

Enter a name (up to 10 characters) in the leaderboard panel and press **SAVE**
or `Enter`. The active name is shown as `▶ NAME` above the table.

### Leaderboard

Top 10 scores persisted with player name, score, and a formatted timestamp.
Rank 1–3 are colour-coded (gold / silver / bronze).

Click **CLEAR** to wipe all leaderboard records. This also resets the persisted
best score and best time.

### Stats Panel

| Stat | Description |
|---|---|
| GAMES PLAYED | Total runs across all sessions |
| BEST SCORE | All-time high score |
| BEST TIME | Longest run (wall-clock, pause-excluded) |
| OBSTACLES DODGED | Total obstacles passed |
| DEATHS | Total deaths |
| TOTAL DISTANCE | Sum of all run scores |

### Resetting Scores

| Action | HI Score | Best Score | Best Time | Leaderboard records |
|---|---|---|---|---|
| `✕` button (header) | ✓ reset | ✓ reset | — | — |
| CLEAR (leaderboard) | ✓ reset | ✓ reset | ✓ reset | ✓ wiped |

---

## Storage

### Backend

| Backend | Condition | Persistence |
|---|---|---|
| `localStorage` | Available and writable | Survives page reloads |
| In-memory | Private context or unavailable | Session only |

### Keys

| Key | Content |
|---|---|
| `dino:lb` | Leaderboard array (JSON, top 10) |
| `dino:stats` | Stats object |
| `dino:player` | Player name string |
| `dino:version` | Schema version integer (current: `1`) |

### Quota Management

- `navigator.storage.persist()` requested at startup
- `navigator.storage.estimate()` polled (debounced 2 s) — shown in badge as `BACKEND · NKB (X%)`
- On `QuotaExceededError`: prune to top 5 and retry; on total failure show
  blocking alert with recovery steps
- All storage writes return `true` / `false` / `null`; no silent data loss

---

## Architecture Notes

### `game.js`

| Concern | Approach |
|---|---|
| Game loop | `requestAnimationFrame`; `dt` = elapsed ms / 16.667, clamped to 3.0 |
| Speed | Linear ramp `+= 0.002 × dt`, range `SPEED_START (6)` → `SPEED_CAP (13)` |
| Physics | Euler integration; all values scaled by `dt` — Hz-independent |
| DOM access | All elements cached once in `const DOM = {…}` at startup |
| Canvas palette | `lerpRGB()` result cached; rebuilt only when `dayPhase` changes |
| Sky layer | Baked onto `OffscreenCanvas` on each `dayPhase` change; blitted each frame |
| `fillStyle` | Deduplicated via `setFill()` — only written when colour changes |
| HUD text | `textContent` deduplicated — skipped when string unchanged |
| Speed bar | `style.width` deduplicated — skipped when integer `%` unchanged; uses literal `6` and `13` in formula `(speed - 6) / (13 - 6)` with division-by-zero guard |
| Collision | Two reusable `_dinoBox` / `_obsBox` objects mutated in-place each frame |
| Obstacle array | Cleaned in-place with reverse `splice` — no per-frame allocation |
| Sound timers | `setTimeout` IDs tracked in `_soundTimers`; cancelled on restart |
| Pause | Wall-clock `pauseStartTime` captured; `gameStartWallTime` offset on resume |
| Best time | `performance.now()` wall-clock delta — correct at 60 / 120 / 144 Hz |

### `db.js`

| Concern | Approach |
|---|---|
| Backend detection | Try/catch probe at module load |
| Declaration order | `quotaUsed`, `quotaTotal`, `quotaError`, `_quotaTimer` declared before `migrate()` IIFE — avoids TDZ crash on fresh install |
| Score validation | `isFinite` + `>= 0` guard in `addScore`; invalid values stored as `0` |
| `pruneAndSave` | When `knownExisting` provided, skips redundant top-10 retry; falls back to top-5; dispatches `db:criticalFailure` on total failure |
| Return values | `addScore` / `saveLeaderboard` return saved array or `null`; callers never assume success |
| `this` safety | API captured in `api` local; internal calls use `api.method()` directly |
| Quota polling | Debounced 2 s; initial eager call at boot |
| Schema migration | `migrate()` IIFE at boot; v0→v1 backfills missing `recordId` fields |

### `server.py`

| Concern | Approach |
|---|---|
| Binding | `0.0.0.0:1999` — required for Termux/Cromite same-device access |
| TLS setup | `find_ssl_files` validates pair and returns ready-to-use `SSLContext`; `bind_and_activate=False` ensures socket is TLS-wrapped before first `listen()` |
| Exception scope | `except (ssl.SSLError, OSError)` — catches both bad cert pairs and missing/unreadable files |
| Request timeout | `Handler.timeout = 10` — slowloris mitigation |
| Credential guard | `_DENIED` covers all `*.pem / *.crt / *.key` files in DIR; iterative URL-decode prevents encoded bypass |
| HSTS | Only emitted when `Handler.tls_enabled` is `True` — not sent over plain HTTP |
| Fallback gating | `ThreadingHTTPServer` only instantiated after `ALLOW_HTTP_FALLBACK` check — no socket bound on exit paths |
| Security headers | `X-Frame-Options`, `X-Content-Type-Options`, `CSP`, `Referrer-Policy`, `Permissions-Policy`, `HSTS` on every response |

---

## Browser Compatibility

| Feature | Chrome 88+ / Cromite 142+ | Firefox 93+ / Librewolf | Firefox Android 93+ |
|---|---|---|---|
| Canvas 2D, `fillRect`, `globalAlpha` | ✓ | ✓ | ✓ |
| `image-rendering: pixelated` | ✓ | ✓ | ✓ |
| Web Audio API | ✓ | ✓ | ✓ |
| `navigator.storage.estimate/persist` | ✓ | ✓ | ✓ |
| Fullscreen API (standard) | ✓ | ✓ | ✓ |
| `:-webkit-full-screen` CSS | ✓ | n/a | n/a |
| CSS `min()`, `clamp()`, custom properties | ✓ | ✓ | ✓ |
| `passive: false` listener option | ✓ | ✓ | ✓ |
| `classList.toggle(name, force)` | ✓ | ✓ | ✓ |
| `e.code` keyboard events | ✓ | ✓ | ⚠ virtual kbd |
| `woff2` fonts, `padStart`, `CustomEvent` | ✓ | ✓ | ✓ |
| `prefers-reduced-motion` | ✓ | ✓ | ✓ |

**Notes:**

- `e.code` is unreliable on Android software keyboards. Touch buttons are the
  primary Android input; keyboard shortcuts are secondary.
- Librewolf may block fullscreen via privacy settings — the `.catch()` guard
  handles this gracefully.
- Safari was confirmed functional during `0.0.1.0-rc` testing (Safari 13+ /
  iOS 13+) but is not an officially supported target.

---

## Generating TLS Certificates

```bash
openssl req -x509 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

Both files must be in the same directory as `server.py`. They are excluded
by `.gitignore`. Regenerate on expiry by deleting and rerunning the command.

---

## License

MIT — see [LICENSE](LICENSE).  
Copyright © 2026 Sumon Kayal.