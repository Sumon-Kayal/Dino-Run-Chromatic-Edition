# Changelog

All notable changes to Dino Run — Chromatic Edition are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [4.0.0] — 2026-03-22

### Fixed

- **`SCORE:` label inconsistency between HTML template and JS** (`game.js`)  
  The HTML template initialised `#go-score` as `SCORE 00000` (no colon) but
  `gameOver()` wrote `'SCORE: ' + …` (with colon), causing the colon to appear
  only after the first game over and then persist for the rest of the session.
  Changed `'SCORE: '` to `'SCORE '` in `gameOver()` so both are consistent
  from first render.

- **`var dbStats` should be `let`** (`game.js`)  
  `dbStats` was declared with `var` at module level but unconditionally
  reassigned in the `boot()` IIFE via `dbStats = DB.getStats()`. Declaring a
  reassigned binding with `var` obscures intent and breaks static analysis.
  Changed to `let` to correctly signal that the variable is mutable and
  block-scoped.

- **`const clouds` / `const stars` regression introduced during ES6 migration**
  (`game.js`)  
  The automated `var`→`const`/`let` pass incorrectly declared `clouds` and
  `stars` as `const` because the reassignment check only scanned top-level
  scope. Both arrays are fully reassigned inside `initGame()` (`clouds = [];`
  / `stars = [];`) on every game restart. A `const` binding cannot be
  reassigned — this would have thrown `TypeError: Assignment to constant
  variable` on every game start after the first, making the game unplayable
  from the second run onwards. Fixed to `let`.

### Changed

- **Speed tuned to match original Chrome Dino** (`game.js`)  
  The previous speed constants produced a game that was far easier at the start
  and reached maximum difficulty much too quickly. Speed values and ramp rate
  are now derived directly from the original Chromium source:

  | Parameter | Before | After | Source |
  |---|---|---|---|
  | `SPEED_MIN` | 5.5 | **8.5** | 6 px/f × canvas scale 1.4233 |
  | `SPEED_MAX` | 18.0 | **18.5** | 13 px/f × canvas scale 1.4233 |
  | Ramp divisor | 600 | **2660** | original reaches max at ~2660 score |
  | `PTERA_SCORE` | 200 | **900** | 200 × (2660/600), proportional |

  The original Chromium `Runner.config` uses `SPEED = 6` and `MAX_SPEED = 13`
  on a 600 px canvas, with `ACCELERATION = 0.001` px/frame² — taking ~7000
  frames (~117 s at 60 Hz) to reach max speed. At an average speed of
  9.5 px/frame and a score coefficient of 0.025 that corresponds to reaching
  max speed at approximately score 2660. Our canvas is 854 px wide
  (scale factor 1.4233), so both speed endpoints are multiplied by that
  factor. `initGame()` updated to initialise `speed` from `CONFIG.SPEED_MIN`
  instead of the hardcoded literal `5.5`.

- **ES6 modernisation — `var` eliminated from `game.js` and `db.js`**
  (`game.js`, `db.js`)  
  All `var` declarations replaced with `const` or `let` based on whether the
  binding is ever reassigned:

  `game.js`:
  - **16 `const`** — immutable bindings: `DB`, `canvas`, `ctx`, `W`, `H`,
    `GY`, `GRAVITY`, `JUMP_V`, `DINO_W`, `DINO_H`, `DUCK_H`, `DINO_X`,
    `CONFIG`, `C`, `AudioCtxCtor`, `MONTHS`.
  - **25 `let`** at module scope — mutable game state: `state`, `score`,
    `hiScore`, `speed`, `frameCount`, `animFrame`, `lastTime`, `dino`,
    `obstacles`, `clouds`, `stars`, `obsCooldown`, `dayPhase`, `dayDir`,
    `dayTimer`, `dayPauseAt`, `duckHeld`, `playerName`, `paused`,
    `flashFrames`, `lastMilestone`, `audioCtx`, `soundMuted`, `dbStats`,
    `gameObstacles`.
  - **74 `let`** inside function bodies replacing all `var` locals.

  `db.js`:
  - **12 `const`** — immutable bindings: `useLocalStorage`, `memStore`,
    `DB_VERSION`, `MONTHS`, and all single-assignment locals.
  - **14 `let`** — mutable bindings: `quotaUsed`, `quotaTotal`, `quotaError`,
    and reassigned locals (`stored`, `raw`, `lb`, `combined`, etc.).

- **ES6 modernisation — arrow functions** (`game.js`, `db.js`)  
  Simple single-expression callbacks converted from `function(x) { … }` to
  `(x) => { … }` for conciseness. Applied to all `.forEach()`, `.filter()`,
  `.map()`, `.sort()`, `.then()`, `.catch()`, and `setTimeout()` callbacks
  where the callback does not use `this` or `arguments`.

  `game.js`: 11 callbacks converted.  
  `db.js`:   7 callbacks converted.

  The one event-listener callback that uses `this` (the `muteBtn` click
  handler, which sets `this.textContent` and `this.classList`) was
  deliberately left as a regular `function` expression — converting it to an
  arrow would rebind `this` to the enclosing lexical scope and break the
  handler.

- **JSDoc type annotations added to all public functions** (`game.js`)  
  12 functions documented with `@param` and `@returns` JSDoc blocks:
  `px`, `lerp`, `lerpRGB`, `initGame`, `jump`, `gameOver`, `spawn`,
  `update`, `draw`, `loop`, `updateStatUI`, `renderLeaderboard`.
  Annotations describe parameter types, units, and semantics (e.g.
  `@param {number} dt - Delta-time multiplier (1.0 = one 60 Hz frame)`).
  No runtime behaviour changed.

---

## [3.5.0] — 2026-03-22

### Fixed

- **`:fullscreen body` missing `height: 100vh`** (`style.css`)  
  The base `body` rule uses `min-height: 100vh`. Inside `:fullscreen`,
  `justify-content: center` on a flex column requires an explicit fixed height —
  `min-height` leaves the container open-ended so vertical centering has no anchor
  and the game frame sits at the top instead of the middle of the screen. Added
  `height: 100vh` to the `:fullscreen body` and `:-webkit-full-screen body` rules.

- **Dead `:-moz-full-screen` CSS rules removed** (`style.css`)  
  Firefox 64 shipped the standard unprefixed `:fullscreen` pseudo-class and
  dropped the `-moz-` prefix entirely. Our stated minimum is Firefox 93, so the
  `:-moz-full-screen` selector blocks were unreachable dead code. More critically,
  pre-CSS4 parsers drop an **entire** comma-grouped rule block when any single
  selector in the group is unknown — meaning the standard `:fullscreen` rules
  could have been silently discarded on some engines. All `:-moz-full-screen`
  selectors removed; the header comment updated to reflect the correct browser
  matrix.

- **`element.style.color = 'var(--danger)'` replaced with `setProperty()`** (`game.js`)  
  The CSSOM shorthand property setter (`element.style.color = value`) expects a
  resolved value. Passing `'var(--danger)'` via the shorthand is not guaranteed
  by spec — some browsers accept it, others silently discard it, leaving the badge
  in the wrong colour after a storage-full failure. Both instances replaced with
  `element.style.setProperty('color', 'var(--danger)')`, which is the correct CSSOM
  path for CSS custom property references in inline styles. The paired reset was
  changed from `style.color = ''` to `style.removeProperty('color')` for symmetry.

### Notes

Cross-browser compatibility matrix confirmed for all targets in v3.5.0:

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

⚠ `e.code` is unreliable on Android software keyboards. Game uses touch buttons
as primary Android input; keyboard shortcuts are secondary.  
Librewolf may block fullscreen via privacy settings — the `.catch()` guard handles
this gracefully. Android system navigation bar may remain visible in fullscreen —
expected browser behaviour, not a code defect.

---

## [3.0.0] — 2026-03-21

### Fixed

- **`--gold` CSS variable mismatched JS medal colour** (`style.css`)  
  `--gold` was `#b8860b` (dark antique gold). The dead CSS medal rules that used
  this value were removed in v1.5.0, but the variable itself was never corrected.
  `renderLeaderboard()` in `game.js` uses `#ffd700` for the rank-1 medal via
  `td.style.color`, and `stat-value.gold` in the stats panel reads `var(--gold)`.
  Both now agree: `--gold` is `#ffd700`.

- **`updateStatUI()` called 60 times per second** (`game.js`)  
  The function was called at the end of every `update()` tick, performing DOM
  writes on every frame even though session stats only change on game-over or
  leaderboard clear events. Removed from `update()`; it is now called only in
  `gameOver()` and the clearLb handler where stats actually change.

- **Speed bar formula hardcoded `5.5` and `12.5`** (`game.js`)  
  The `speed-fill` width calculation used literal values that duplicated the
  speed range constants. If `CONFIG.SPEED_MIN` or `CONFIG.SPEED_MAX` were
  adjusted, the bar would silently show wrong values. Fixed to derive from
  `CONFIG` like everything else.

- **`DB.clearLeaderboard()` had no caller contract warning** (`db.js`)  
  The method only clears `dino:lb`. Callers must also reset `dbStats.bestScore`
  and call `DB.saveStats()` or the v2.0.0 stats desync bug silently recurs.
  Added a JSDoc warning comment on the public method documenting this dependency.

### Added

- **480p canvas resolution (854×480, 16:9)** (`game.js`, `index.html`)  
  Canvas intrinsic size changed from 900×300 (3:1) to 854×480 (16:9). Ground
  position `GY` updated from 225 to 360 (75% of 480). All world geometry
  already used `W`, `H`, and `GY` as variables — no hardcoded coordinates
  changed. The extra vertical space above and below the ground gives the scene
  more breathing room and makes pterodactyl flight paths more readable.

- **Fullscreen mode** (`game.js`, `index.html`, `style.css`)  
  Press `F` or click the `FULL` button to enter fullscreen. The game scales to
  fill the viewport maintaining the 854:480 (16:9) aspect ratio via
  `min(100vw, calc(100vh × 854/480))`. Header, panels, and footer are hidden
  in fullscreen. Mobile controls float at the bottom as a semi-transparent bar.
  Button label toggles to `EXIT FS` when active. Uses the standard Fullscreen
  API with `:-webkit-full-screen` prefix for Safari compatibility.


  All spawn and speed tuning constants extracted from inline magic numbers into
  a named `CONFIG` object at the top of `game.js`. Covers `SPEED_MIN`,
  `SPEED_MAX`, `PTERA_CHANCE`, `PTERA_SCORE`, all cactus dimensions,
  `CACTUS_DBL`, and all obstacle cooldown parameters. Values are identical to
  v2.0.0 — this is a refactor only, no gameplay change.

- **"NEW BEST" banner on game-over screen** (`game.js`, `index.html`, `style.css`)  
  A gold pulsing `★ NEW BEST ★` line appears on the game-over overlay when the
  player beats their previous best score. Only shown when `prevBest > 0` to
  avoid displaying on the very first game. Implemented via a hidden
  `#go-newbest` element toggled by `gameOver()`.

- **`M` keyboard shortcut for mute** (`game.js`, `index.html`)  
  Pressing `M` now toggles mute, identical to clicking the mute button.
  The start screen hint updated to include `M = MUTE`.

- **Schema versioning and v0→v1 migration** (`db.js`)  
  Added `dino:version` storage key and a `migrate()` IIFE that runs at boot.
  v0→v1 patch backfills missing `recordId` fields on old leaderboard entries
  so `pruneAndSave` dedup works correctly on data saved before v2.0.0.
  Future schema changes can be handled by incrementing `DB_VERSION` and adding
  a migration branch.

- **Inline SVG favicon** (`index.html`)  
  Pixel-art dinosaur favicon embedded as a `data:` URI in a `<link>` tag.
  No extra file required.

- **`<meta name="description">`** (`index.html`)  
  Added for correct link previews when the repo URL is shared.

- **`<title>` corrected** (`index.html`)  
  Was `"Dino Run"`, now `"Dino Run — Chromatic Edition"` to match the
  README, footer, and canvas branding.

- **`0.0.0.0` binding documented** (`server.py`)  
  Added an inline comment explaining why the server binds to all interfaces
  (Termux/Cromite requirement) and how to restrict to loopback if desired.

- **`.gitignore`** (new file)  
  Excludes `cert.pem` and `key.pem` from version control, enforcing the
  security guidance that was already documented in the README.

---

## [2.0.0] — 2026-03-21

### Fixed

- **Stats and leaderboard desync after clearing** (`game.js`)  
  Clicking CLEAR wiped `dino:lb` from localStorage but left `dbStats.bestScore`
  untouched in `dino:stats`. On next page load the stats panel showed a stale
  best score (e.g. 1069) while the leaderboard showed no records. The clear
  handler now resets `dbStats.bestScore = 0`, calls `DB.saveStats()` to persist
  the change, and calls `updateStatUI()` to refresh the panel immediately.

- **Stats panel not refreshed after clearing** (`game.js`)  
  The CLEAR handler updated the header HI value but never called `updateStatUI()`,
  so the BEST SCORE row in the session stats panel kept its stale value until the
  next `gameOver()` call. Fixed alongside the desync bug above.

- **Stats and leaderboard desync on quota overflow in `gameOver()`** (`game.js`)  
  `DB.saveStats(dbStats)` was called before `DB.addScore()`. If the leaderboard
  write then failed due to a full quota, `dino:stats` already had the new high
  score committed while `dino:lb` did not — producing the same split-brain state
  as the clear bug above. The write order is now reversed: `DB.addScore()` is
  attempted first, and `DB.saveStats()` is only committed on success. On failure
  `dbStats.bestScore` is rolled back to the existing leaderboard leader's score
  before saving, keeping both stores consistent.

- **Dead CSS medal-colouring rules conflicting with JS** (`style.css`)  
  Three CSS rules (`:first-child`, `:nth-child(2)`, `:nth-child(3)`) coloured
  the top-3 leaderboard rows, but `renderLeaderboard()` already applies colours
  via `td.style.color` (inline styles always win over class rules). The CSS rules
  were therefore unreachable dead code. They also used mismatched shades —
  dark gold `#b8860b` in CSS versus bright gold `#ffd700` in JS for rank 1.
  The dead CSS blocks have been removed; JS remains the single source of truth
  for medal colours.

- **URL-encoded path bypass in `server.py` credential guard** (`server.py`)  
  `_is_denied()` compared `os.path.basename(self.path)` against `{'cert.pem',
  'key.pem'}`. Because `self.path` is the raw undecoded URL string, a request
  for `/%63ert.pem` (URL-encoded `c`) bypassed the check. Added
  `urllib.parse.unquote()` before the basename extraction so encoded variants
  are normalised before comparison.

---

## [1.5.0] — 2026-03-21

### Fixed

- **`pruneAndRetry` discarded new score on quota overflow** (`db.js`)  
  The old implementation pruned the stored leaderboard but then threw away the
  incoming score entirely. Renamed to `pruneAndSave`; it now merges the new
  entry with existing data, sorts by score, and keeps the top 10 (with a top-5
  hard fallback). New scores are no longer silently lost when storage is full.

- **`addScore` returned success even when save failed** (`db.js`)  
  `addScore()` always returned the leaderboard array regardless of whether
  `saveLeaderboard()` succeeded. It now returns `null` on failure so callers
  can distinguish a persisted score from an ephemeral one.

- **Leaderboard rendered as saved when it wasn't** (`game.js`)  
  The game-over handler called `renderLeaderboard(lb)` unconditionally.
  It now checks the return value of `DB.addScore()`: on `null` it falls back to
  rendering the last persisted board and sets the storage badge to
  `STORAGE FULL ⚠ — Score not saved`.

- **Unused `val` parameter in `pruneAndRetry`** (`db.js`)  
  The parameter was marked `no-unused-vars` but genuinely never read.
  Removed as part of the `pruneAndSave` rewrite.

- **Quota display showed stale text on first load** (`index.html`)  
  `#db-status` was initialised to the static string `"LOCAL STORAGE"` before
  the async `navigator.storage.estimate()` call resolved. Changed to
  `"Calculating…"` so users never see incorrect quota information.

- **`server.py` cert paths relative to CWD instead of script directory** (`server.py`)  
  `load_cert_chain` used bare `'cert.pem'` / `'key.pem'` strings. If the server
  was launched from a different working directory the certs would not be found
  even though they exist next to the script. Fixed to use
  `os.path.join(DIR, 'cert.pem')` consistent with how `DIR` is already used for
  the file-serving root.

- **Vendor-prefixed CSS declarations removed** (`style.css`)  
  All handwritten `-webkit-` and `-moz-` prefix declarations were tripping
  the repo's Stylelint rules. Removed 39 prefixed lines across 13 affected
  blocks including `display: -webkit-flex`, `-webkit-flex-direction`,
  `-webkit-align-items`, `-webkit-justify-content`, `-webkit-flex-wrap`,
  `-webkit-flex-shrink`, `-webkit-flex`, `-webkit-transition`,
  `-webkit-transform`, `-webkit-user-select`, `-webkit-animation`,
  `image-rendering: -webkit-optimize-contrast`,
  `image-rendering: -moz-crisp-edges`, and both `@-webkit-keyframes`
  blocks (`blink`, `pulse`). Their unprefixed standard equivalents
  (`display: flex`, `flex-direction`, `align-items`, `@keyframes`, etc.)
  were already present in every block and are unchanged. Autoprefixer
  is responsible for adding browser prefixes at build time.

### Added

- `README.md` — setup instructions, project structure, storage documentation,
  browser compatibility table, cert generation guide.
- `CHANGELOG.md` — this file.

### Security

- Leaderboard names rendered via `textContent` throughout — no `innerHTML`
  usage, no XSS surface.
- TLS cert/key files (`cert.pem`, `key.pem`) should not be committed to version
  control. Generate locally with `openssl` (see README).
  
---

## [1.0.0] — 2026-03-20

### Fixed

- **`pruneAndRetry` discarded new score on quota overflow** (`db.js`)  
  The old implementation pruned the stored leaderboard but then threw away the
  incoming score entirely. Renamed to `pruneAndSave`; it now merges the new
  entry with existing data, sorts by score, and keeps the top 10 (with a top-5
  hard fallback). New scores are no longer silently lost when storage is full.

- **`addScore` returned success even when save failed** (`db.js`)  
  `addScore()` always returned the leaderboard array regardless of whether
  `saveLeaderboard()` succeeded. It now returns `null` on failure so callers
  can distinguish a persisted score from an ephemeral one.

- **Leaderboard rendered as saved when it wasn't** (`game.js`)  
  The game-over handler called `renderLeaderboard(lb)` unconditionally.
  It now checks the return value of `DB.addScore()`: on `null` it falls back to
  rendering the last persisted board and sets the storage badge to
  `STORAGE FULL ⚠ — Score not saved`.

- **Unused `val` parameter in `pruneAndRetry`** (`db.js`)  
  The parameter was marked `no-unused-vars` but genuinely never read.
  Removed as part of the `pruneAndSave` rewrite.

- **Quota display showed stale text on first load** (`index.html`)  
  `#db-status` was initialised to the static string `"LOCAL STORAGE"` before
  the async `navigator.storage.estimate()` call resolved. Changed to
  `"Calculating…"` so users never see incorrect quota information.

- **`server.py` cert paths relative to CWD instead of script directory** (`server.py`)  
  `load_cert_chain` used bare `'cert.pem'` / `'key.pem'` strings. If the server
  was launched from a different working directory the certs would not be found
  even though they exist next to the script. Fixed to use
  `os.path.join(DIR, 'cert.pem')` consistent with how `DIR` is already used for
  the file-serving root.

### Added

- `README.md` — setup instructions, project structure, storage documentation,
  browser compatibility table, cert generation guide.
- `CHANGELOG.md` — this file.

### Security

- Leaderboard names rendered via `textContent` throughout — no `innerHTML`
  usage, no XSS surface.
- TLS cert/key files (`cert.pem`, `key.pem`) should not be committed to version
  control. Generate locally with `openssl` (see README).

---

## [0.9.0-rc] — Testing Period: 2026-03-15 to 2026-03-19

### Testing Summary

Pre-release testing across browsers, platforms, and storage conditions
prior to the 1.0.0 public release on 2026-03-20.

---

### 2026-03-15 — Initial Distribution

- Builds distributed to testers on Chrome 88+ (Windows, macOS, Linux),
  Firefox 93+ (Linux), Cromite 142+ (Android), and Safari 13+ (iOS).
- Termux/Android test environment verified: `server.py` HTTPS and HTTP
  fallback confirmed functional on Android 12 and 13.
- No blockers found on first load across all platforms.

---

### 2026-03-16 — Storage Stress Testing

**Reported (Chrome/Windows — tester EU-01):**
- Filling the leaderboard past 10 entries under simulated low-quota
  conditions caused new scores to silently disappear. No error shown.
  Reproduced consistently at localStorage ~4.8 MB fill level.
  → Root cause: `pruneAndRetry` pruned old data but discarded the
    incoming score. Logged for fix.

**Reported (Firefox/Linux — tester IN-01):**
- `addScore()` returned the leaderboard array even when the underlying
  `saveLeaderboard()` call failed (quota exceeded). Game showed the
  score as saved when it was not.
  → Confirmed cross-browser. Logged for fix.

**Reported (Cromite/Android — tester IN-02):**
- On first load, the DB badge displayed `"LOCAL STORAGE"` before
  `navigator.storage.estimate()` resolved. Briefly showed incorrect
  quota (0%) on slow devices.
  → Low severity cosmetic issue. Logged for fix.

---

### 2026-03-17 — Game-Over Flow & Rendering

**Reported (Chrome/macOS — tester US-01):**
- After a quota-overflow failure, the leaderboard rendered the new
  (unsaved) score instead of the last persisted board. Players were
  misled into thinking their score was recorded.
  → Tied to the `addScore` null-return issue. Logged for fix.

**Reported (Edge/Windows — tester EU-02):**
- `STORAGE FULL` warning badge never appeared during overflow
  conditions. The game continued as if storage succeeded.
  → Same root cause as above. Confirmed on Edge Chromium 88+.

---

### 2026-03-18 — Server & Environment Testing

**Reported (Termux — tester IN-01):**
- Launching `server.py` from a directory other than the project root
  caused TLS cert loading to fail silently, falling back to HTTP even
  when `cert.pem` / `key.pem` were present next to the script.
  → `load_cert_chain` was using bare relative paths instead of
    `os.path.join(DIR, ...)`. Logged for fix.

**No new gameplay issues reported.** Physics, pterodactyl spawning,
day/night cycle, and audio confirmed stable across all platforms.

---

### 2026-03-19 — Final Verification Pass

- All five reported issues confirmed reproducible and logged.
- Code review flagged unused `val` parameter in `pruneAndRetry` as
  a lint violation (`no-unused-vars`). Noted for cleanup alongside
  the `pruneAndSave` rewrite.
- Safari/iOS 13: no storage or rendering issues found.
- Samsung Internet 12: confirmed functional.
- **Go/no-go decision: proceed to 1.0.0 with all fixes applied.**
