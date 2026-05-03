# Changelog

All notable changes to Dino Run — Chromatic Edition are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.8.0-beta] — CSS & DB Consolidation + Chromium Parity 2026-05-01

### Changed

- **`db.js` deleted** (`js/db/db.js`)  
  `db.js` was a thin barrel file re-exporting every public symbol from the four `js/db/`
  sub-modules. `main.js` already imported directly from each sub-module (`database.js`,
  `leaderboard.js`, `stats.js`) and never consumed the barrel — making `db.js` entirely
  unreferenced dead code. File deleted with no other changes required.

- **`style.css` features integrated into `base.css`, `ui.css`, `accessibility.css`; `style.css` deleted** (`css/`)  
  `style.css` was loaded last as a patch layer containing six feature groups that logically
  belonged in the four existing sheets. Each group moved to its correct home:

  - **CE colour tokens → `base.css` `:root`** — Chromatic Edition custom properties
    (`--ce-day-bg/fg/dim`, `--ce-night-bg/fg/dim`, `--ce-blue`, `--ce-orange`, `--ce-red`,
    `--ce-gold`, `--ce-silver`, `--ce-bronze`) appended to the existing `:root` block under
    a `── Chromatic Edition theme tokens` comment, co-locating all design tokens in one place.

  - **`::selection` → `base.css`** — text selection highlight (`background: var(--ce-blue)`)
    added after the reset block alongside the other global base rules.

  - **Scrollbar polish → `base.css`** — the four `::-webkit-scrollbar` rules (width/height,
    track, thumb, thumb:hover) added after `::selection`, using `--ce-day-dim` and
    `--ce-day-fg` which are now available in the same file.

  - **`@keyframes ce-pulse` + `.go-newbest` animation upgrade → `ui.css`** — the weak
    opacity-only `pulse` keyframe driving `.go-newbest` replaced with `ce-pulse`, which adds
    a `scale(1.08)` transform at the 50 % mark alongside the `opacity: 0.7` dip. `.go-newbest`
    updated from `animation: pulse 1s infinite` to `animation: ce-pulse 0.9s ease-in-out
    infinite`. The `accessibility.css` reduced-motion block continues to suppress it.

  - **`.speed-bar-fill` smooth transition → `ui.css`** — `transition: width 80ms linear`
    added to the existing `.speed-bar-fill` rule so the bar animates smoothly between
    game-loop updates rather than jumping discretely.

  - **`:focus-visible` focus ring → `accessibility.css`** — `outline: 2px solid var(--ce-blue);
    outline-offset: 2px` added above the reduced-motion block. Scoped to `:focus-visible` so
    mouse clicks do not trigger the ring; only keyboard navigation receives it
    (WCAG 2.4.7 — Focus Visible).

  `css/style.css` deleted. `<link rel="stylesheet" href="css/style.css">` removed from
  `index.html`. README file tree updated: `style.css` entry removed; `base.css`, `ui.css`,
  and `accessibility.css` descriptions updated to reflect their expanded responsibilities.

- **Chromium parity — 10 constants aligned to Chromium `runner.js`** (`js/game/config.js`, `data/config.json`)  
  All physics, speed, spawn, and hitbox constants have been aligned to the Chromium reference
  implementation so gameplay feel matches the original exactly:

  | Constant          | Before   | After   | Chromium reference source                   |
  |-------------------|----------|---------|---------------------------------------------|
  | `GRAVITY`         | `0.48`   | `0.6`   | `Trex.config.GRAVITY`                       |
  | `JUMP_V`          | `-12.2`  | `-15`   | `Trex.config.INITIAL_JUMP_VELOCITY`         |
  | `CONFIG.SPEED_MIN`| `5`      | `6`     | `Runner.config.SPEED`                       |
  | `CONFIG.ACCELERATION` | `0.0015` | `0.001` | `Runner.config.ACCELERATION`           |
  | `CONFIG.SCORE_COEFF`  | `0.04`   | `0.025` | `Runner.config.SCORE_COEFF`            |
  | `CONFIG.PTERA_CHANCE` | `0.22`   | `0.06`  | Chromium per-spawn pterodactyl rate    |
  | `CONFIG.CACTUS_TRIPLE`| `0.08`   | `0.05`  | Chromium triple-cactus probability     |
  | `CONFIG.CACTUS_DBL`   | `0.32`   | `0.45`  | Chromium double-cactus probability     |
  | `HIT_OBS_SHRINK`      | `8`      | `5`     | Chromium collision forgiveness margin  |

  `GRAVITY` and `JUMP_V` are calibrated as a pair. `ACCELERATION` and `SCORE_COEFF` together
  restore the reference speed ramp — max speed (`13 px/frame`) is now reached at score ~2660
  instead of the previous ~1920. `PTERA_CHANCE` reduced from 22 % to 6 %: pteras now spawn at
  the Chromium rate rather than 3.7× more frequently. Cactus cluster ratio rebalanced:
  doubles increased from 32 % to 45 %, triples reduced from 8 % to 5 %. `data/config.json`
  updated in sync: `gravity`, `jumpVelocity`, `acceleration`, and `initialSpeed` all reflect
  the new values — runtime overrides via `applyJSONConfig()` now match the source constants.

- **Test suite consolidated — `extended-gameplay.test.mjs` and `extended.test.mjs` merged into `all.test.mjs`** (`tests/`)  
  The three test files have been merged into a single `all.test.mjs` entry point (948 → 1284
  lines). `tests/extended-gameplay.test.mjs` and `tests/extended.test.mjs` deleted. All test
  coverage is preserved; the merge eliminates the need to run multiple test commands and removes
  the risk of the extended suites being skipped in CI.

- **Leaderboard medal colours use CSS custom properties** (`js/main.js`)  
  Hardcoded hex strings `'#ffd700'`, `'#c0c0c0'`, `'#cd7f32'` in the medals array replaced with
  `'var(--ce-gold)'`, `'var(--ce-silver)'`, `'var(--ce-bronze)'`. Medal colours now respond to
  theme changes and remain consistent with the design token layer.

- **`DOM.gameFrame` replaces `document.querySelector('.game-frame')`** (`js/main.js`)  
  The `toggleFullscreen()` function was the only place still using a raw `querySelector` to
  look up the game frame element. Changed to use the pre-cached `DOM.gameFrame` reference,
  consistent with all other DOM access in the file.

- **`db:criticalFailure` handler reads specific message from `e.detail`** (`js/main.js`)  
  The `window.addEventListener('db:criticalFailure', …)` handler previously hardcoded a generic
  failure message. It now reads `e.detail.message` from the event — surfacing the specific
  diagnosis dispatched by `pruneAndSave()` ("even top-5 pruning failed" vs "payload ≤5 failed")
  directly in the alert shown to the player. Falls back to the generic message if `e.detail` is
  absent. A guard `if (!e || !e.detail) return` added to the `db:quota` handler for symmetry.

- **JSDoc added to key functions** (`js/main.js`, `js/game/audio.js`, `js/game/input.js`, `js/db/database.js`, `js/db/leaderboard.js`)  
  JSDoc blocks added to: `initGame()`, `gameOver()`, `hideLoading()` in `main.js`; `_playBuffer()`
  in `audio.js`; `initInput()` and `handleKeydown()` in `input.js`; `dbSet()` in `database.js`;
  `pruneAndSave()` in `leaderboard.js`. Return types and parameter shapes documented; no logic
  changes.

- **`memStore` coerces values to `String`** (`js/db/database.js`)  
  `memStore[key] = val` changed to `memStore[key] = String(val)`. `localStorage` always returns
  strings on `getItem`; the in-memory fallback now behaves identically so callers see the same
  type regardless of which backend is active.

### Fixed

- **`database.js` barrel re-exports created circular import — UI stuck on loading screen** (`js/db/database.js`) — **CRITICAL**  
  An initial implementation of the `db.js` → `database.js` merge appended re-exports of
  `leaderboard.js`, `stats.js`, and `storage.js` to the bottom of `database.js`. Both
  `leaderboard.js` and `stats.js` import `dbGet`/`dbSet` from `database.js`, creating a cycle:
  `database.js → leaderboard.js → database.js`. In affected browsers this stalled ES module
  graph evaluation before `boot()` ran — `hideLoading()` was never called and the loading screen
  never dismissed. Fixed by removing the barrel re-exports entirely; `main.js` already imports
  directly from each sub-module and never needed a barrel in `database.js`.

- **`boot()` IIFE had no top-level error handler — any throw left the loading screen frozen** (`js/main.js`) — **MEDIUM**  
  The async boot IIFE had no outer `try/catch` and no `.catch()` on the returned Promise.
  Any unhandled throw between the JSON-loading blocks and `hideLoading()` (e.g. from
  `initRenderer()` or `initGame()`) would silently reject the Promise, leaving the loading
  screen up with no user-visible feedback and no diagnostic. Wrapped the entire boot body in a
  `try/catch` that writes a red error message into the loading hint on failure so the cause is
  immediately visible without opening DevTools.

- **`pruneAndSave` skipped the initial write for leaderboards already at ≤5 entries** (`js/db/leaderboard.js`) — **MEDIUM**  
  When `knownExisting` was provided and `combined` was already ≤5 entries, the function fell
  straight through to `dispatchEvent(db:criticalFailure)` without attempting a `dbSet` at all —
  incorrectly treating a write that had not been tried as a failure. An `else` branch added to
  attempt the write when no pruning was needed before declaring critical failure.

- **`pruneAndSave` error message always showed the wrong branch** (`js/db/leaderboard.js`) — **MEDIUM**  
  After slicing `combined` down to 5 entries and failing the `dbSet`, the message guard
  `(combined.length > 5)` was always `false` because the slice had already mutated the array.
  The "even top-5 pruning failed" branch was dead code; every full-storage failure reported
  the wrong string. Fixed by introducing a `prunedToFive` boolean flag set before the slice so
  the message correctly reflects whether top-5 pruning was attempted.

- **One failed audio file silenced all buffered sounds** (`js/game/audio.js`) — **MEDIUM**  
  `_loadState` is set to `'failed'` if any of the three OGG/MP3 files fails to load. The guard
  `if (_loadState === 'failed') return false` short-circuited before the per-key buffer check,
  so if e.g. `milestone.ogg` 404'd but `jump.ogg` loaded fine, `soundJump()` fell back to the
  synth beep even though its buffer was populated. Fixed by replacing the global `_loadState`
  guard with per-key logic: check `_buffers[key]` first; only return `null` (loading) when the
  specific buffer is absent and the state is still `'loading'`.

- **★ NEW BEST ★ banner never appeared on the first game ever played** (`js/main.js`) — **LOW**  
  `gameOver()` conditioned the banner on `s > prevBest && prevBest > 0`. When `prevBest` was `0`
  (no previous game on this device), the banner was suppressed even when the player set a
  genuine new best. Removed the `> 0` guard — the banner now fires correctly whenever the
  current score beats the previous best, including the first run.

- **Mute button showed 🔆 (brightness / sun) instead of 🔊 when toggling back to unmuted** (`js/game/input.js`) — **LOW**  
  Both the `M` keyboard shortcut and the click handler assigned `\uD83D\uDD06` (U+1F506,
  HIGH BRIGHTNESS SYMBOL) as the unmuted icon — four codepoints short of the correct
  `\uD83D\uDD0A` (U+1F50A, SPEAKER WITH THREE SOUND WAVES), which matches the `&#128266;`
  used in `index.html` for the initial button state. Fixed in both handler locations.

- **`.go-newbest` pulse animation fired while element was hidden** (`css/ui.css`) — **LOW**  
  The `style.css` → `ui.css` merge dropped the `:not(.hidden)` guard from `.go-newbest`,
  so `ce-pulse` ran on the element even when it carried the `hidden` class — a redundant
  compositor animation loop on every idle and dead frame. Selector restored to
  `.go-newbest:not(.hidden) { animation: ce-pulse … }` with base typography rules kept on the
  plain `.go-newbest` selector.

- **`initGame` hardcoded `0.6` instead of `GAP_COEFF_INITIAL`** (`js/main.js`) — **LOW**  
  `G.gapCoefficient = 0.6` ignored the imported `GAP_COEFF_INITIAL` constant from `config.js`.
  If the constant were ever tuned or overridden at runtime via `applyJSONConfig`, `initGame`
  would silently reset to the stale literal. Changed to `G.gapCoefficient = GAP_COEFF_INITIAL`.

- **Dead variable `prevSessionBest` in `gameOver()`** (`js/main.js`) — **LOW**  
  `const prevSessionBest = G.dbStats.bestScore` was assigned at the top of `gameOver()` and
  never referenced again anywhere in the function. Removed.

- **Canvas not repainted on tab-return when paused or dead** (`js/main.js`) — **LOW**  
  The `visibilitychange` handler restarted the engine for `'running'` and re-queued the idle
  loop for `'idle'`, but had no branch for `'paused'` or `'dead'`. Some mobile browsers and
  PWA contexts discard the canvas backing store when a tab is backgrounded, leaving the canvas
  blank on return even though the DOM overlay was still visible. Added `else { draw(); }` so
  the game-over and pause screens repaint immediately on tab focus.

### Added

- **CodeQL static analysis** (`.github/workflows/codeql.yml`)  
  GitHub CodeQL SAST workflow added. Scans all JavaScript source (`js/`, `tests/`) on
  every push and pull request targeting `main`, and on a weekly schedule (Monday 03:17 UTC).
  Uses the `security-and-quality` query suite — covers XSS, prototype pollution, ReDoS,
  path traversal, unsafe deserialisation, dead code, unused imports, and unreachable branches.
  Results upload as SARIF to the GitHub Security tab. Assets, fonts, and certs excluded from
  scan scope. `security-events: write` permission scoped to the workflow only.

- **CodeRabbit PR Tracker** (`.github/workflows/coderabbit-pr-tracker.yml`)  
  GitHub Actions workflow that posts a structured tracker comment on every PR targeting `main`.
  Comment is created on first push and updated in place on subsequent pushes — no duplicate
  comments. Tracks:
  - **Engine-critical file guard** — 11 guarded paths (`js/game/config.js`, `physics.js`,
    `engine.js`, `player.js`, `obstacles.js`, `js/main.js`, `js/db/database.js`, `audio.js`,
    `input.js`, `data/config.json`, `css/accessibility.css`) flagged ✅ unchanged or
    ⚠️ CHANGED against the PR base commit.
  - **Chromium parity checklist** — all 10 reference constants listed with required values;
    shown whenever `config.js` or `data/config.json` is touched.
  - **Review tool links** — CodeRabbit review status reminder and direct link to the
    GitHub Security tab code-scanning results.
  Requires only the automatic `GITHUB_TOKEN` — no additional secrets needed.

- **CodeRabbit AI review configuration** (`.coderabbit.yaml`)  
  Added `.coderabbit.yaml` to the repo root with `assertive` profile and per-path review
  instructions covering 11 source files. Guards all Chromium reference constants by exact
  value, enforces the two-pass AABB collision structure, prevents circular imports in the DB
  layer, and flags the mute-button emoji codepoint regression. Any PR touching a guarded file
  receives a targeted CodeRabbit review against the constraints defined for that path.

- **Live demo link — GitHub Pages** (`README.md`)  
  Added a `▶ Play Now` shield badge to the README header linking to
  `https://sumon-kayal.github.io/Dino-Run-Chromatic-Edition/`. Added a `## 🌐 Live Demo`
  section covering: prominent play link, feature-status table (gameplay, day/night, Web Audio,
  leaderboard, fullscreen, mobile touch, reduced-motion), and notes on localStorage scope,
  HTTPS, audio autoplay gate, and private/incognito fallback behaviour.

---

## [0.7.5-beta] — Modular Architecture 2026-04-12 

### Changed
- Split monolithic `game.js` into focused ES modules under `js/game/`:
  - `game.js`      — barrel re-export: re-exports all public symbols from every game sub-module for test tooling and external consumers
  - `engine.js`    — `Engine` class: delta-time game loop
  - `config.js`    — static world constants (`CONFIG`, `W`, `H`, `GY`, …); `applyJSONConfig()` and `applyObstaclesConfig()` populate values from `data/` JSON at boot
  - `runtime.js`   — mutable game state object `G`; all per-frame and per-session values
  - `state.js`     — **deprecated compatibility shim**; re-exports from `config.js` and `runtime.js` only; kept for backwards compatibility — import directly from source modules instead
  - `audio.js`     — Web Audio API: jump / death / milestone sounds; `applyAudioConfig()` overrides file paths from `data/audio.json`
  - `player.js`    — dino physics, jump, duck, idle animation
  - `obstacles.js` — cactus / pterodactyl spawning and movement
  - `physics.js`   — AABB collision detection with shrunk hitboxes
  - `renderer.js`  — all canvas drawing: sky, sprites, HUD, speed bar; imports `lerp` from `js/utils/utils.js`
  - `input.js`     — keyboard events and mobile control wiring
- Created `js/utils/utils.js` — shared utility functions: `clamp`, `lerp`, `randomInt`, `formatScore`, `deepClone`
- Split monolithic `db.js` into focused ES modules under `js/db/`:
  - `db.js`          — barrel re-export: re-exports all public symbols from every db sub-module (`backendName`, `dbGet`, `dbSet`, `addScore`, `getLeaderboard`, `saveLeaderboard`, `clearLeaderboard`, `getStats`, `saveStats`, `getPlayerName`, `savePlayerName`, `getQuotaUsed`, `getQuotaTotal`, `refreshQuota`)
  - `database.js`    — `dbGet` / `dbSet` with localStorage / in-memory backend
  - `storage.js`     — quota tracking, `db:quota` / `db:quotaFull` events, persistent storage
  - `leaderboard.js` — top-10 management: `addScore`, `getLeaderboard`, `clearLeaderboard`, pruning
  - `stats.js`       — stats, player name, DB schema migration (v0 → v1)
- Created `js/main.js` as the single ES module entry point
- Moved assets: fonts → `assets/fonts/`, styles split into `css/base.css`, `css/game.css`, `css/ui.css`, `css/accessibility.css`, `css/style.css` (Chromatic Edition theme tokens, NEW BEST pulse animation, scrollbar polish, focus rings)
- Updated `index.html`: `<script type="module" src="js/main.js">`, updated preload hrefs and stylesheet links to reference the new CSS files
- Updated CSS files: font paths now `../assets/fonts/`
- Moved server: `server/server.py` now serves from project root; certs in `server/certs/`
- Updated `server.py`: `CERT_DIR = os.path.join(DIR, "certs")`, `directory=ROOT`
- Added `server/certs/*.pem` to `.gitignore`
- **JSON-driven configuration wired at boot** (`js/main.js`, `js/game/config.js`, `js/game/audio.js`)  
  The boot sequence now fetches all three `data/` JSON files sequentially before the renderer or
  game world initialise. Fetch failure for any file is non-fatal — the game falls back to hardcoded
  defaults with a `console.warn`:
  - `data/config.json` → `applyJSONConfig()` — physics (`gravity`, `jumpVelocity`, `acceleration`) and speed (`initialSpeed`, `maxSpeed`)
  - `data/obstacles.json` → `applyObstaclesConfig()` — cactus `width`, `height`, `minGap`; pterodactyl `minGap`; `MIN_GAP_CACTUS` and `MIN_GAP_PTERA` changed from `const` to `let` to allow runtime override
  - `data/audio.json` → `applyAudioConfig()` — sound file base paths; extension stripped at runtime and replaced with browser-detected `.ogg` or `.mp3`

### Fixed

- **Obstacle inner-box shrink increased 5 → 8 px per side; dino body box tightened** (`js/game/physics.js`, `js/game/config.js`) — **HIGH**  
  Descent-phase false collisions: the dino was dying while still visually above a cactus top on
  the way down. Root cause — the sprite's transparent leg pixels extend below the opaque body
  region (~`y+32`), so the body hitbox bottom was including non-visible pixels.  
  `HIT_OBS_SHRINK` increased from `5` to `8` (obstacle forgiveness margin). `HIT_BODY_INSET_H`
  increased from `18` to `26` so the body box height reduction no longer covers the transparent
  leg region. Combined effect: ~17 px additional forgiveness on descent without affecting
  ground-level run-into collisions.  
  `physics.js` comment updated: `"shrunk 8 px per side (was 5 px)"`.

---

## [0.7.0-beta] — 2026-04-06

### Changed

- **Speed system — hybrid formula removed; pure linear ramp restored** (`game.js`)  
  `update()` previously ran two conflicting speed expressions on the same frame:
  an additive `speed += 0.0025 * dt` followed immediately by a score-derived
  clamp `speed = Math.min(CONFIG.SPEED_MIN + (score / 2660) * (CONFIG.SPEED_MAX -
  CONFIG.SPEED_MIN), CONFIG.SPEED_MAX)`. The second expression overwrote the
  first entirely, making the additive line dead code and tying speed exclusively
  to score rather than elapsed time. At low scores this produced speed values
  well below `SPEED_MIN`, undermining the Chrome-accurate starting pace.

  Replaced with a single linear ramp:
  ```js
  speed += 0.002 * dt;
  if (speed > CONFIG.SPEED_MAX) speed = CONFIG.SPEED_MAX;
  ```
  Speed now ramps continuously from game start at a rate that matches observed
  Chrome Dino pacing more closely.

- **`CONFIG.SPEED_MIN` / `CONFIG.SPEED_MAX` corrected to actual runtime values** (`game.js`)  
  `SPEED_MIN` was `8.5` and `SPEED_MAX` was `18.5` — the 854px-canvas-scaled
  equivalents of the original Chromium values. Both were used as the speed bar
  display range, but the actual gameplay cap was the hardcoded literal `13` and
  the actual start speed was the literal `6`. The constants were therefore
  documentation that disagreed with runtime behaviour.

  Updated to `SPEED_MIN: 5` and `SPEED_MAX: 13` so they match the actual start
  and cap values. `initGame()` now sets `speed = CONFIG.SPEED_MIN` and
  `update()` caps at `CONFIG.SPEED_MAX` throughout — one authoritative source
  for both values. The speed bar formulas in `update()` and `draw()` both use
  `CONFIG.SPEED_MIN` / `CONFIG.SPEED_MAX` with a division-by-zero guard.

- **Day/Night cycle — looping timer replaced with score-triggered one-way fade** (`game.js`)  
  The previous cycle used `dayTimer`, `dayDir`, and `dayPauseAt` to oscillate
  indefinitely between day and night with a 350-frame pause at each extreme.
  Direction reversed on every peak/trough, producing a full loop approximately
  every 1400 frames (~23 s at 60 Hz). This made the night phase feel arbitrary
  and repetitive.

  Replaced the entire timer block with a single score gate:
  ```js
  if (score > 700) {
    dayPhase = Math.min(dayPhase + 0.002 * dt, 1);
  }
  ```
  `dayPhase` starts at `0` (full day) and transitions smoothly to `1` (full
  night) once the player crosses score 700, then stays there for the remainder
  of the run. The transition takes approximately 500 frames (~8 s) to complete.
  `dayTimer`, `dayDir`, and `dayPauseAt` are fully removed — declarations,
  `initGame()` assignments, and `boot()` assignments all deleted.

- **Jump physics — softer arc, lower gravity** (`game.js`)  
  `GRAVITY` reduced from `0.65` to `0.55` and `JUMP_V` from `-14` to `-11.5`.
  The previous values produced a tight, punishing arc mismatched against the
  slower obstacle spawn rate. The new values give the dino a noticeably floatier
  trajectory — hang time increases by approximately 15%, making close-call jumps
  over tall cacti more readable.

- **Mid-air fast-fall — duck multiplier increased** (`game.js`)  
  The downward velocity bonus applied while holding duck during a jump increased
  from `2.5 * dt` to `3.8 * dt`. At the new lower gravity the old value was too
  subtle — fast-fall felt nearly identical to a normal descent. At `3.8` the
  dino snaps down perceptibly when duck is held mid-air.

- **Obstacle cooldown formula — CONFIG constants replaced with direct expression** (`game.js`)  
  The spawn cooldown was derived from four `CONFIG` fields (`OBS_CD_MIN`,
  `OBS_CD_BASE`, `OBS_CD_RNG`, `OBS_CD_SPEED`) which combined to
  `Math.max(30, Math.floor(55 + random * 70 - speed * 1.5))`. The random range
  of `70` frames produced excessive spacing variance.

  Replaced with a tighter expression:
  ```js
  obsCooldown = Math.max(20, (80 - speed * 3.2) + Math.random() * 25);
  ```
  The base shrinks faster with speed (`3.2` vs `1.5` coefficient), random
  spread narrows to `25` frames, and the hard floor drops to `20`. The four
  now-unused `OBS_CD_*` keys have been removed from `CONFIG`; `OBS_CD_INIT`
  is retained.

- **Collision hitboxes — both dino and obstacle boxes tightened by 1 px per side** (`game.js`)  
  Dino box inset changed from `x+8 / y+6 / h-10` to `x+9 / y+7 / h-12`.
  Obstacle box inset changed from `+4 / +4 / w-8 / h-8` to `+5 / +5 / w-10 /
  h-10`. Each side gains 1 px of additional leniency, eliminating the class of
  kills where the dino appeared to clear an obstacle visually but died due to
  invisible hitbox overlap on the sprite's transparent border pixels. Hitbox
  comments updated from `4px each side` to `5px each side`; ptera collision math
  recalculated to reflect new insets.

- **Pterodactyl flight heights corrected** (`game.js`)  
  The mid-height pterodactyl was spawned at `GY - 60`. At that Y position,
  the shrunken hitbox bottom edge (`GY - 36`) sits 10 px above the standing
  dino's hitbox top (`GY - 46`) — the two boxes never overlap, so the mid ptera
  was uncollidable. Corrected to `GY - 40` so the bottom edge (`GY - 16`)
  properly intersects the standing hitbox. The low ptera adjusted from `GY - 68`
  to `GY - 69` for a cleaner 1 px margin against the ducking hitbox. Heights
  are now `[GY - 40, GY - 120, GY - 69]`.

- **`gameOver()` rollback uses pre-write snapshot** (`game.js`)  
  When `DB.addScore()` failed due to a full quota, `dbStats.bestScore` was
  rolled back to `existingLb[0].score` — the leader of the current on-disk
  leaderboard. If the current run's score was higher than any stored score, this
  discarded the legitimate new high. The fix captures `prevSessionBest =
  dbStats.bestScore` before any writes are attempted and uses that snapshot for
  rollback, preserving the player's actual previous best regardless of run order.

- **`visibilitychange` handler — auto-pause captures `pauseStartTime`** (`game.js`)  
  The previous hidden-tab handler unconditionally called
  `cancelAnimationFrame(animFrame)` without going through `togglePause()`,
  meaning `pauseStartTime` was never set. When the tab became visible and the
  player resumed, `gameStartWallTime` was not offset by the hidden duration —
  all backgrounded time counted toward Best Time. The handler now calls
  `togglePause()` when `state === 'running' && !paused`, routing through a
  single consistent code path.

- **Annotation comments stripped** (`game.js`, `db.js`, `server.py`, `index.html`, `style.css`)  
  All internal tracking prefixes (`BUG-#N FIX:`, `OPT-N:`, `FIX-N:`, `SEC-N:`,
  `ISSUE-N FIX:`, `Finding N fix:`) were removed from inline comments across all
  five files. Explanatory comment text was preserved or condensed; no logic was
  changed.

### Fixed

- **`db.js` TDZ crash on first-ever page load** (`db.js`) — **HIGH**  
  `let quotaUsed`, `let quotaTotal`, `let quotaError`, and `let _quotaTimer`
  were declared on lines 71–84, after the `migrate()` IIFE on line 46.
  On a fresh device (no `dino:version` stored), `migrate()` calls `dbSet()`,
  which calls `refreshQuota()`, which reads `_quotaTimer`. All four bindings
  were in the Temporal Dead Zone at that point — `ReferenceError: Cannot access
  '_quotaTimer' before initialization` was thrown, crashing `db.js` before
  `window.DB` was ever assigned. `game.js` guards on `window.DB` and would
  throw a second error immediately after, leaving the game broken on first load
  in any browser with the Storage API available.

  Moved all four `let` declarations to immediately before the `migrate()` IIFE
  so they are fully initialised when `migrate()` runs.

- **`pruneAndSave` redundant top-10 retry when caller already knows it failed** (`db.js`) — **MEDIUM**  
  `saveLeaderboard` calls `dbSet('dino:lb', json)` first. On quota failure it
  calls `pruneAndSave('dino:lb', lb, lb)` — passing `lb` as both the new data
  and the `knownExisting` hint. The old `pruneAndSave` then unconditionally
  attempted another `dbSet` with the same 10-item array that had just failed,
  burning a write attempt that was guaranteed to fail again before reaching the
  top-5 fallback.

  Added a guard: when `knownExisting` is provided by the caller, the top-10
  retry write is skipped — the caller already knows 10 items failed. The first
  fallback attempt is immediately the top-5 slice. This reduces the worst-case
  write count from 3 to 2 under full-quota conditions.

- **`server.py` `find_ssl_files` only caught `ssl.SSLError`, not `OSError`** (`server.py`) — **HIGH**  
  `load_cert_chain` raises `OSError` (specifically `FileNotFoundError`) for
  missing or unreadable files. Between `os.listdir()` and the `load_cert_chain`
  call, a cert file could be deleted or become permission-denied. The uncaught
  `OSError` would propagate out of `find_ssl_files` and crash the entire server
  startup with an unhelpful traceback instead of gracefully skipping the pair.

  Changed `except ssl.SSLError:` to `except (ssl.SSLError, OSError):`.

- **`server.py` socket listened on plain TCP before TLS wrap** (`server.py`) — **HIGH**  
  `ThreadingHTTPServer((HOST, PORT), Handler)` uses `bind_and_activate=True` by
  default, calling `socket.listen()` immediately at construction. The socket was
  actively accepting TCP connections before `ctx.wrap_socket()` was called. A
  client connecting during that window received a raw TCP socket — the TLS
  handshake would fail or the connection would be silently served without
  encryption.

  Changed to `bind_and_activate=False`. The `SSLContext` wraps the socket
  first, then `server_bind()` + `server_activate()` are called manually — TLS
  is in place before the socket ever enters the listen queue.

- **`server.py` validated `SSLContext` thrown away, rebuilt from scratch** (`server.py`) — **MEDIUM**  
  `find_ssl_files` built a complete `SSLContext`, proved the cert/key pair was
  valid via `load_cert_chain`, then returned only the file paths and discarded
  the context. The startup block then created a second `SSLContext` and called
  `load_cert_chain` again on the same files — redundant I/O and a TOCTOU window
  where the files could change between validation and actual use.

  `find_ssl_files` now returns the validated context as the first element of its
  4-tuple: `(ctx, cert_path, key_path, had_pair_candidates)`. The startup block
  calls `ctx.wrap_socket()` directly — no second context, no second file read.

- **`server.py` HSTS header sent over plain HTTP connections** (`server.py`) — **MEDIUM**  
  `end_headers()` unconditionally emitted `Strict-Transport-Security:
  max-age=31536000` on every response. When the server fell back to HTTP (no
  certs found, or `ALLOW_HTTP_FALLBACK=1`), browsers would cache the HSTS
  policy for a year, making the origin unreachable over HTTP on the same browser
  after any future plain-HTTP fallback session. Added `Handler.tls_enabled:
  ClassVar[bool] = False` and set it to `True` after `httpd.server_activate()`
  in the successful TLS path. The HSTS header is only sent when
  `self.tls_enabled` is `True`.

- **`server.py` socket bound before `ALLOW_HTTP_FALLBACK` checked in `had_pair_candidates` branch** (`server.py`) — **LOW**  
  In the `elif had_pair_candidates:` block, `ThreadingHTTPServer((HOST, PORT),
  Handler)` was created unconditionally, binding and listening on the port,
  before the `if ALLOW_HTTP_FALLBACK` check ran. If `ALLOW_HTTP_FALLBACK` was
  false, `sys.exit(1)` fired on the next line — but the socket was already
  bound. Inverted the check: `ALLOW_HTTP_FALLBACK` is evaluated first; the
  server is only instantiated inside the `if ALLOW_HTTP_FALLBACK:` branch.

- **`index.html` inline favicon used unencoded SVG in `data:` URI** (`index.html`) — **LOW**  
  The `<link rel="icon">` `href` contained a raw `<svg …>` string inline in the
  `data:image/svg+xml,` URI without percent-encoding. Unencoded `<`, `>`, and
  `#` in `data:` URIs are handled inconsistently across browsers — Chromite on
  Android and some versions of Firefox may reject or display a broken icon.
  Replaced with a fully `%xx`-encoded URI (`%3Csvg`, `%3E`, `%3Crect`, etc.)
  which is valid in all environments.

### Added

- **`all.test.mjs` — unit tests for `db` modules** (added to unified test suite)  
  Comprehensive test suite using the Node.js built-in `node:test` runner — no
  external dependencies. Run with `node tests/all.test.mjs`. Covers:
  - `pruneAndSave`: write-count assertions proving the conditional top-10 skip,
    top-5 fallback success, `db:criticalFailure` dispatch on total failure
  - `saveLeaderboard`: direct write, quota-exceeded path, `null` return
  - `addScore`: score validation (NaN, Infinity, negative, string, float floor),
    sort correctness, 10-entry cap, required field shape
  - `getStats`: default object always includes `bestTime: 0`, missing-field
    backfill from partial stored data, corrupt JSON recovery, round-trip
  - `migrate`: `recordId` backfill on legacy entries, existing-id preservation,
    corrupt JSON handling, version-current skip, `dino:version` bump
  - `clearLeaderboard` / `saveStats` / `savePlayerName`: return values under
    success and full-quota conditions
  - Quota events: `db:quotaFull` and `db:criticalFailure` dispatch
  - TDZ regression suite: five tests confirming the `migrate()` declaration
    order fix, including `doesNotThrow` guards and initial value assertions

- **`all.test.mjs` — unit tests for changed game logic** (added to unified test suite)  
  Isolated pure-function test suite using the Node.js built-in `node:test`
  runner. Extracts `CONFIG` from the source file directly to validate structural
  changes; mirrors the changed computation formulas as standalone functions.
  Covers:
  - `CONFIG` structure: asserts `OBS_CD_MIN/BASE/RNG/SPEED` removed,
    `OBS_CD_INIT` retained
  - `initGame` speed assignment: asserts `G.speed = CONFIG.SPEED_MIN` is present
  - Speed bar integer percentage (`update()` dedup): boundary values, cap at
    100, monotonicity across valid range
  - Speed bar float percentage (`draw()` bar width): boundary, cap, range [0,1]
  - Speed colour threshold: confirms transition at speed 9.5
  - Speed cap at 13: exact, above, below
  - AABB hitbox shrink: all four dimensions at 5 px per side
  - Removed globals: regex assertions that `dayDir`, `dayTimer`, `dayPauseAt`
    `let` declarations are gone from source
  - Speed bar source literals: confirms `CONFIG.SPEED_MIN` and `CONFIG.SPEED_MAX` are used in the bar calculation (not hardcoded literals)

---

## [0.6.4-beta] — 2026-03-24

### Fixed

- **OPT-4 `skyCanvas` blit missing — sky/stars optimisation was entirely dead code** (`game.js`) — **HIGH**  
  `redrawSkyLayer()` correctly bakes the static sky background, horizon line,
  and stars onto an `OffscreenCanvas` (`skyCanvas`) on every `dayPhase` change.
  However, `draw()` never consumed the result: instead of stamping the baked
  canvas with `ctx.drawImage(skyCanvas, 0, 0)`, the loop fell straight through
  to re-executing the original `ctx.fillRect` background, `ctx.fillRect`
  horizon, and `stars.forEach` pixel loop on the main canvas every single frame.
  The optimisation advertised in the OPT-4 comment produced zero benefit.

  Removed the three redundant drawing blocks from `draw()` and replaced them
  with a single `ctx.drawImage(skyCanvas, 0, 0)` call. The sky layer now
  renders from the pre-baked surface as intended — saving the full
  background fill + horizon fill + up to 60-star forEach loop on every frame
  where `dayPhase` is unchanged (which includes the entire 350-frame day and
  night pause windows).

- **`gameStartWallTime` not offset for pause duration — Best Time inflated by time spent paused** (`game.js`) — **HIGH**  
  `gameStartWallTime` was set once via `performance.now()` at game start and
  never adjusted. `gameOver()` computed elapsed time as
  `performance.now() - gameStartWallTime`, which counts wall-clock milliseconds
  continuously — including any time the game was paused. A player who paused for
  two minutes before dying would have those two minutes silently added to their
  Best Time, making it trivial to inflate the stat.

  Introduced `pauseStartTime` (module-level, initialised to `0`). When pausing,
  `togglePause()` captures `pauseStartTime = performance.now()`. When unpausing,
  it advances the baseline: `gameStartWallTime += (performance.now() -
  pauseStartTime)`. `gameOver()` is unchanged — the subtraction now always
  yields true play time only.

- **`groundScrollX` offset applied with wrong sign — ground texture scrolled right instead of left** (`game.js`) — **HIGH**  
  `groundScrollX` is a monotonically increasing accumulator
  (`(groundScrollX + speed * dt * 0.3) % 30`). `draw()` used it as the loop
  start in `for (let gx = groundScrollX | 0; gx < W; gx += 30)`. Because `gx`
  opens at a positive and growing value, the first dot column shifts rightward
  each frame — the ground texture visually slides to the right while every other
  element (obstacles, clouds, moon) scrolls left. The dino appeared to run
  backwards across the ground.

  Changed the loop initialiser to `for (let gx = -(groundScrollX | 0); gx <
  W; gx += 30)`. Negating the offset makes the starting column shift left each
  frame, matching the scroll direction of all other game elements.

- **`visibilitychange` handler permanently killed `idleLoop` on tab switch from start screen** (`game.js`) — **MEDIUM**  
  The `visibilitychange` listener unconditionally cancelled `animFrame` when the
  tab was hidden, then restarted only `loop` (the game loop) when the tab became
  visible again — and only if `state === 'running'`. If a player switched tabs
  while on the start screen (`state === 'idle'`), `idleLoop` was cancelled and
  never restarted. The dino's walking animation froze permanently until a new
  game was started, making the start screen appear broken.

  Added an `else if (state === 'idle')` branch to the tab-visible handler that
  restarts `idleLoop` via `requestAnimationFrame(idleLoop)`, matching the same
  conditional pattern used for `loop`.

---

## [0.6.3-beta] — 2026-03-23

### Fixed

- **`resetHiBtn` handler incorrectly zeroed `sessionStats.bestTime`** (`game.js`)  
  The README reset table documents the `✕` HI button as score-only — Best Time
  column is explicitly `—` (not reset). The code had `sessionStats.bestTime = 0`
  in the handler, silently contradicting this.

  Impact: if a player's session best time exceeded their persisted best time
  (e.g. session 3m 00s, stored 1m 30s), clicking `✕` would cause `updateStatUI()`
  to render `Math.max(0, 90) = 90s` instead of the correct `Math.max(180, 90) =
  180s` — the BEST TIME stat would silently drop with no indication why.

  Removed `sessionStats.bestTime = 0` from the handler. The `✕` button now resets
  only what the README and UX imply: the HI score display, `dbStats.bestScore`,
  and `sessionStats.bestScore`. Best time is unaffected.

---

## [0.6.2-beta] — 2026-03-23

### Fixed

- **`db.js` syntax error — `SyntaxError: Unexpected token ';'` on line 364 — game would not start** (`db.js`)  
  `return (api = {` on line 247 opened a parenthesis that was never closed.
  The object literal was terminated with `};` instead of `});` — the `)` that
  closes the `(api = …)` assignment expression was missing before the `;`.

  ```js
  // BROKEN — missing closing )
  return (api = {
    …
  };          // ← SyntaxError: Unexpected token ';'

  // FIXED
  return (api = {
    …
  });         // ← ) closes (api = …), then ; ends the return statement
  ```

  Because `db.js` threw a `SyntaxError` during parse, `window.DB` was never
  assigned. `game.js` executes its DB guard immediately on load —
  `if (typeof window.DB === 'undefined') throw new Error(…)` — and crashed
  before `validateDOM`, the DOM cache, or `boot()` had any chance to run.
  The game produced a blank white page in every browser with no visible error
  unless DevTools was open. Root cause introduced when the `api` alias variable
  was added for the BUG-4 `this`-binding fix in v5.0.3.

---

## [0.6.1-beta] — 2026-03-23

### Security

- **No HTTP security headers — clickjacking, MIME sniffing, info-leak** (`server.py`) — **HIGH**  
  The development server emitted no security-related response headers at all.
  Added a `end_headers()` override on the `Handler` class so the following
  headers are injected into every response (static files, errors, redirects):

  | Header | Value |
  |---|---|
  | `X-Content-Type-Options` | `nosniff` |
  | `X-Frame-Options` | `DENY` |
  | `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; media-src 'none'; object-src 'none'; frame-ancestors 'none'` |
  | `Referrer-Policy` | `no-referrer` |
  | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
  | `Strict-Transport-Security` | `max-age=31536000` |

  `img-src data:` is required for the inline SVG favicon. The CSP blocks all
  `eval`, `unsafe-inline`, and cross-origin resource loading. `frame-ancestors
  'none'` mirrors `X-Frame-Options: DENY` for CSP-aware browsers. HSTS
  caches the HTTPS-only requirement for one year.

- **No request timeout — single-threaded server vulnerable to slowloris** (`server.py`) — **HIGH**  
  `BaseHTTPRequestHandler.timeout` defaults to `None` — no per-request read
  deadline. A single client sending one byte per minute would hold the only
  available connection indefinitely, blocking every subsequent request.
  Set `timeout = 10` on the `Handler` class; the base class enforces it via
  `socket.settimeout()` at the start of each connection.

- **`_DENIED` credential guard not applied to POST/PUT/DELETE/OPTIONS** (`server.py`) — **MEDIUM**  
  The cert/key deny list was only wired into `do_GET` and `do_HEAD`. Any future
  addition of `do_POST` or similar methods (by subclassing or a Python stdlib
  update) would bypass the guard silently. Added explicit overrides for
  `do_POST`, `do_PUT`, `do_DELETE`, and `do_OPTIONS` — all check `_is_denied()`
  first, then return 403 if matched or 405 Method Not Allowed otherwise.
  `do_OPTIONS` always returns 405 regardless; this server has no CORS use case
  and should not advertise cross-origin permissions.

- **`setTimeout` IDs not stored — stale audio on fast restart** (`game.js`) — **LOW**  
  `soundDie()` and `soundMilestone()` used bare `setTimeout` calls with no
  reference to the returned timer ID. If the player dies and restarts within
  140 ms (the longest pending delay), the callbacks fire into the new game's
  audio context producing stale sound bleed. Introduced `_scheduleSound(fn,
  delay)` which pushes each ID into a `_soundTimers` array, and
  `_cancelSoundTimers()` which clears them all. `_cancelSoundTimers()` is called
  at the very top of `initGame()` before any state is reset.

---

## [0.5.9-beta] — 2026-03-23

### Fixed (Enterprise Audit — 13 issues)

- **Best-time calculated from `frameCount / 60` — wrong at 120 Hz / 144 Hz** (`game.js`) — **HIGH**  
  `frameCount` increments once per `requestAnimationFrame` tick regardless of
  the monitor's refresh rate. At 120 Hz the counter advances at 120/s, making
  `frameCount / 60` report elapsed time at 2× real speed — a 90-second run
  showed as 3 minutes. Replaced with `performance.now()` wall-clock delta:
  `gameStartWallTime` is set in `startGame()` and `restart()`, and
  `thisTime = Math.floor((performance.now() - gameStartWallTime) / 1000)` is
  used in `gameOver()`. Fully Hz-independent.

- **Ground scroll offset `frameCount * speed * 0.3` — Hz-dependent visual drift** (`game.js`) — **HIGH**  
  Same root cause as the best-time bug. At 120 Hz ground dots scrolled at 2×
  the correct speed, misaligning the visual speed impression from actual gameplay
  speed. Replaced with `groundScrollX`, a module-level accumulator updated each
  `update()` call as `(groundScrollX + speed * dt * 0.3) % 30`. `draw()` reads
  this value directly. `groundScrollX` resets to `0` in `initGame()`.

- **`canvas.getContext('2d')` result never null-checked** (`game.js`) — **HIGH**  
  `getContext('2d')` returns `null` when the browser's hardware acceleration is
  disabled, the canvas limit is exceeded, or a sandboxed context forbids it.
  Every subsequent `ctx.*` call would throw `TypeError: Cannot read properties
  of null` with no useful diagnostic. Added an explicit null guard immediately
  after the `getContext` call with an error message naming the probable cause.

- **`sessionStats.bestScore` / `bestTime` not reset on leaderboard clear or HI reset** (`game.js`) — **HIGH**  
  The CLEAR leaderboard handler zeroed `dbStats.bestScore` and `dbStats.bestTime`
  but left `sessionStats.bestScore` and `sessionStats.bestTime` intact. Because
  `updateStatUI()` renders `Math.max(sessionStats.bestScore, dbStats.bestScore)`,
  the stat panel continued showing the old session high even though the header
  correctly displayed `00000`. Same issue in the new reset-HI handler. Both
  handlers now reset `sessionStats.bestScore = 0` and `sessionStats.bestTime = 0`
  before calling `updateStatUI()`.

- **Per-frame `{ x, y, w, h }` object allocation in collision loop — GC pressure** (`game.js`) — **MEDIUM**  
  `update()` allocated two plain objects on every frame — `db` (dino box) and
  `ob` (obstacle box) — at 60 fps that is 60 dino boxes plus up to 300 obstacle
  boxes per second of heap objects immediately eligible for collection. Replaced
  with two module-level reusable objects `_dinoBox` and `_obsBox` whose
  properties are mutated in-place each frame. Zero allocations per collision
  check after startup.

- **`jumpBtn` and `gameFrame` in `validateDOM` but not in DOM cache** (`game.js`) — **MEDIUM**  
  Both IDs were validated at startup (confirming their existence in the HTML) but
  then looked up again via raw `document.getElementById()` calls during event
  listener wiring — inconsistent with every other element in the codebase. Added
  `jumpBtn` and `gameFrame` to the `DOM` cache; event listener setup now uses
  `DOM.jumpBtn` and `DOM.gameFrame`.

- **`speed-fill` `style.width` written every frame without deduplication** (`game.js`) — **MEDIUM**  
  `DOM.speedFill.style.width = …` was set unconditionally on every `update()`
  tick. A CSS style write triggers layout work in the browser even when the value
  is unchanged. Speed is continuous but the meaningful percentage only changes
  in integer steps (101 possible values: 0–100%). Added `_lastSpeedPct` dedup
  using integer-truncated percent; the write is skipped when the integer value
  matches the previous frame. `aria-valuenow` on the progressbar wrapper is
  updated alongside the width.

- **`playBeep` error silently swallowed — `catch(e) {}`** (`game.js`) — **MEDIUM**  
  The empty catch block in `playBeep` made all Web Audio errors invisible to
  developers. A corrupted audio context, an invalid frequency value, or a
  suspended context that `resumeAudio()` failed to wake would all silently
  produce no sound and no diagnostic. Changed to
  `catch(e) { console.warn('[Audio] playBeep failed:', e); }`.

- **`saveStats`, `savePlayerName`, `clearLeaderboard` ignore `dbSet()` return value** (`db.js`) — **MEDIUM**  
  All three functions called `dbSet()` but discarded its boolean result — a quota
  failure was a silent data loss. Changed all three to `return dbSet(…)` so
  callers can detect and react to write failures consistently with `addScore()`
  and `saveLeaderboard()`.

- **No `prefers-reduced-motion` support — violates WCAG 2.1 §2.3.3** (`style.css`) — **MEDIUM**  
  The `blink` animation on the restart button and `pulse` animations on
  `#go-newbest` and `.db-dot` played unconditionally. Users who have set their
  OS reduced-motion preference experience discomfort or seizure risk from
  repetitive motion. Added:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .blink      { animation: none; opacity: 1; }
    .go-newbest { animation: none; }
    .db-dot     { animation: none; opacity: 1; }
  }
  ```

- **Missing ARIA attributes — screen reader inaccessibility** (`index.html`, `game.js`) — **MEDIUM**  
  Multiple elements had no accessible name or live-region semantics:
  - `<canvas>` — added `role="application"` and descriptive `aria-label`
  - `#hdr-hi`, `#hdr-score` — added `aria-label` ("High score", "Current score"); `aria-hidden="true"` on the visual "HI" label to prevent double-reading
  - `#resetHiBtn`, `#muteBtn`, `#fullscreenBtn` — added `aria-label` (text changes dynamically; a stable label is needed)
  - `#pauseBtn`, `#muteBtn` — added `aria-pressed="false"` initial state; `togglePause()` and both mute handlers now call `setAttribute('aria-pressed', …)` on every toggle
  - Overlays — `#startScreen` and `#pauseScreen` given `role="status" aria-live="polite"`; `#gameOverScreen` given `role="alertdialog" aria-labelledby="go-score" aria-live="assertive"`
  - `#go-newbest` — added `aria-live="polite"` (toggled from hidden)
  - Stat rows — each `<span class="stat-value">` given `aria-labelledby` pointing to its label span
  - Speed bar wrapper — given `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow="0"`; `aria-valuenow` updated whenever `_lastSpeedPct` changes
  - `#clearLbBtn` — added `aria-label="Clear all leaderboard records"`
  - `#db-status` badge — added `aria-live="polite"` so quota updates are announced
  - Controls toolbar — wrapped in `role="toolbar" aria-label="Game controls"`
  - `<th>` elements in leaderboard table — added `scope="col"`

- **`<input id="nameInput">` has no associated `<label>` — violates WCAG 1.3.1** (`index.html`, `style.css`) — **MEDIUM**  
  The `placeholder` attribute is not a substitute for a label — it disappears on
  focus and is not consistently announced by screen readers as a field name.
  Added `<label for="nameInput" class="sr-only">Player name (up to 10
  characters)</label>`. Added `.sr-only` utility class (visually hidden via
  `clip-path: inset(50%)`, 1 × 1 px, `position: absolute`) following the
  modern visually-hidden pattern that keeps content in the accessibility tree
  without the deprecated `clip: rect()` form.

- **`_DENIED` set hardcoded to `{'cert.pem', 'key.pem'}` — silent bypass if filenames change** (`server.py`) — **LOW**  
  If the cert or key file were renamed (e.g. to `server.crt` / `server.key`),
  the deny list would no longer protect them without a manual code edit —
  easy to miss. Replaced with `Handler._DENIED = {os.path.basename(cert),
  os.path.basename(key)}` populated after the cert paths are resolved, so the
  deny set always reflects whatever filenames are actually loaded.

---

## [0.5.8-beta] — 2026-03-23

### Fixed

- **`&nbsp;` text node became an anonymous flex item after score-display flexbox conversion** (`index.html`)  
  When `.score-display` was changed to `display: flex; gap: 4px` to seat the
  new reset button inline, the legacy `&nbsp;` spacer between the button and
  the current-score span was left in the markup. In a flex container, raw text
  nodes become anonymous flex items — the layout was therefore:
  `HI [gap] 00000 [gap] ✕ [gap-item(&nbsp;)] [gap] 00000`, giving the current
  score a visibly wider gap than the other items. Removed the `&nbsp;`; `gap:
  4px` now handles all spacing uniformly.

---

## [0.5.7-beta] — 2026-03-23

### Added

- **Reset top score button** (`index.html`, `style.css`, `game.js`)  
  A small `✕` button (`#resetHiBtn`) placed inline with the HI score display
  in the header. Clicking it prompts for confirmation then:
  - Zeros `hiScore` (in-memory session variable)
  - Zeros `dbStats.bestScore` and `sessionStats.bestScore`
  - Persists via `DB.saveStats()`
  - Writes `'00000'` to `#hdr-hi` (invalidating the OPT-4 cache first)
  - Calls `updateStatUI()` to sync the stats panel

  The full leaderboard table is left intact — individual run records are
  preserved. Use the CLEAR button to wipe everything.

  The button is styled at 14 × 14 px, muted-border at 55% opacity at rest,
  flipping to red (`var(--danger)`) on hover to communicate the destructive
  action. `e.stopPropagation()` prevents the click bubbling to `#gameFrame`
  (which would trigger `jump()`). Added to `validateDOM` required list and
  `DOM` element cache.

---

## [0.5.6-beta] — 2026-03-23

### Performance

- **`refreshQuota()` debounced — eliminates async IPC burst on game-over** (`db.js`)  
  `refreshQuota()` was called after every successful `dbSet()`. A single
  game-over triggers 2–3 `dbSet` calls in quick succession (leaderboard, stats,
  player name), each firing `navigator.storage.estimate()` — an async IPC call
  to the browser process. Added a 2-second debounce via `_quotaTimer`
  (`setTimeout` / `clearTimeout`): at most one estimate fires per 2-second
  window regardless of write-burst size. The initial page-load call is exempt
  (runs eagerly via a separate `refreshQuotaEager` IIFE) so the badge shows real
  quota information as soon as the page loads.

- **`pruneAndSave` skips redundant `dbGet` / `JSON.parse` when caller has in-memory data** (`db.js`)  
  `saveLeaderboard` builds a sorted top-10 array from `getLeaderboard()` plus
  the new entry, then calls `pruneAndSave` on quota overflow. The original
  `pruneAndSave` immediately re-read from localStorage and parsed the JSON it
  had just failed to write — a redundant round-trip. Added an optional
  `knownExisting` parameter; `saveLeaderboard` passes its in-memory `lb` as the
  hint, eliminating the storage re-read in the common quota-overflow path.

- **`transition: width 0.5s ease` removed from `.speed-bar-fill`** (`style.css`)  
  `game.js` updates `style.width` on the speed bar up to 60 times per second.
  A 0.5-second CSS transition fought each update by launching a new compositor
  animation, producing 500 ms of visible lag and redundant GPU work. The bar
  looked like it was perpetually chasing the current value. Removed the
  transition; JS at 60 fps is already smooth.

- **Canvas promoted to dedicated GPU compositing layer; game-frame layout isolated** (`style.css`)  
  Added `will-change: transform` to `canvas` (hints to the browser to promote
  the element to its own compositor layer, so 60 fps canvas repaints no longer
  trigger layout invalidation of surrounding DOM). Added `contain: layout style`
  to `.game-frame` (scopes layout recalculation and CSS counter/property scope
  to inside the frame, preventing canvas repaints from propagating to the page).

- **`transition: all` narrowed to specific properties on `.ctrl-btn` and `.clear-btn`** (`style.css`)  
  `transition: all 0.12s` / `transition: all 0.15s` caused the browser to watch
  every CSS property for changes during input events, including properties that
  are never animated. Replaced with explicit property lists:
  - `.ctrl-btn`: `transition: background 0.12s, color 0.12s, border-color 0.12s, opacity 0.12s`
  - `.clear-btn`: `transition: background 0.15s, color 0.15s`

- **Font preloads added — eliminates FOIT on first load** (`index.html`)  
  Without preloads, the browser discovers `@font-face` declarations only after
  CSS is fully parsed, then begins font fetches. During that gap the page renders
  in the fallback `monospace` face — visually jarring because `'Press Start 2P'`
  is substantially different in metrics and appearance. Added two `<link
  rel="preload" as="font" crossorigin>` tags pointing at the `.woff2` files so
  fetching begins during HTML parsing.

- **`defer` added to script tags** (`index.html`)  
  Scripts placed at end-of-`<body>` are already non-blocking, but `defer` is the
  explicit correct signal: it allows the parser to start fetching both files in
  parallel during HTML parse and guarantees document-order execution after
  parsing is complete (preserving the `db.js → game.js` dependency). Changed
  both `<script>` tags.

- **`theme-color` meta tag added** (`index.html`)  
  Sets the browser UI chrome (address bar, tab strip) on Android and iOS to
  `#f5f5f5` (the page background colour), preventing a white flash during
  initial paint before CSS is applied.

---

## [0.5.4-beta] — 2026-03-23

### Fixed

- **CSS backtick syntax in `:fullscreen body` background rule** (`style.css`)  
  The rule read `` background: `#000` `` — JavaScript template literal syntax that
  CSS parsers do not understand. The declaration was silently ignored, leaving
  the body background as `#f5f5f5` (the default light grey) in fullscreen mode
  instead of black. Fixed to `background: #000`.

- **`#go-hi` initial HTML content mismatched `gameOver()` write format** (`index.html`)  
  The HTML initialised the element as `HI 00000` (no colon) but `gameOver()`
  always wrote `'HI: ' + score` (colon present). On the first game-over the
  display jumped from one format to the other — visually jarring and
  inconsistent between page loads and in-session views. Changed the HTML initial
  value to `HI: 00000` to match what the JS always writes.

- **`clearLbBtn` handler left `dbStats.bestTime` stale after clear** (`game.js`)  
  The handler correctly reset `dbStats.bestScore = 0` and persisted the change,
  but left `dbStats.bestTime` at its previous value. After clicking CLEAR, the
  BEST TIME stat continued displaying the old time associated with records that
  no longer existed. Added `dbStats.bestTime = 0` alongside `bestScore`.

- **Trailing whitespace at end of `style.css`** (`style.css`)  
  Several trailing spaces remained on the final line of the file. Removed.

---

## [0.5.3-beta] — 2026-03-23

### Fixed

- **`pruneAndSave` returned `true` / `false` — leaderboard session/reload discrepancy** (`db.js`)  
  When storage was nearly full and `pruneAndSave` succeeded by falling back to a
  top-5 list, it returned `true`. `saveLeaderboard` passed `true` to `addScore`,
  which returned its 10-entry in-memory `lb` to `gameOver`. The game rendered
  10 rows — correct for the session. On next page load only 5 rows appeared from
  disk. The return value lied about what was actually persisted.  
  `pruneAndSave` now returns the array that was actually saved (or `null` on
  total failure). `saveLeaderboard` propagates it. `addScore` returns it. Callers
  always render exactly what is on disk. Existing `if (!saved)` checks work
  unchanged because `null` is falsy and an array is truthy.

- **NaN / Infinity score corrupted `sort()` and persisted garbage to localStorage** (`db.js`)  
  `addScore(name, score)` stored the raw `score` value with no type check. If
  game physics produced a non-finite value (e.g. `0/0` or `Infinity` from a
  degenerate `dt`), JavaScript's comparator returns `false` for all NaN
  comparisons, making `Array.sort()` output undefined. `JSON.stringify(NaN)`
  produces `null`, so the value would persist as `null` and render as `'00NaN'`
  on next load. Added validation at the top of `addScore`:
  ```js
  let safeScore = (typeof score === 'number' && isFinite(score) && score >= 0)
    ? Math.floor(score) : 0;
  ```
  Invalid values log a `console.warn` and are stored as `0`.

- **`bestTime` missing from `getStats()` default object** (`db.js`)  
  The default stats object was `{ games, deaths, obstacles, totalDist,
  bestScore }` — no `bestTime`. A first-ever run or post-clear load returned
  this object; every callsite guarded with `|| 0`, which masked the gap. Added
  `bestTime: 0` to the default so the field is always present and strongly typed.

- **`this` binding fragility in `addScore`** (`db.js`)  
  `addScore` called `this.getLeaderboard()` and `this.saveLeaderboard()`. In
  strict mode, if the method is invoked without its object receiver (destructuring
  assignment, `Function.prototype.call(null, …)`, passing as a callback), `this`
  is `undefined` and both calls throw. The returned API object is now captured
  in a local `api` variable via `return (api = { … })`, and `addScore` uses
  `api.getLeaderboard()` / `api.saveLeaderboard()` directly. No behavioural
  change for normal call patterns.

---

## [0.5.0-beta] — 2026-03-23

### Performance

- **DOM element cache — eliminates all `getElementById` calls from the hot path** (`game.js`)  
  Added a `const DOM = { … }` object that caches all 27 required elements once
  at startup. The original code called `document.getElementById()` three times
  per frame inside `update()` (score, hi-score, speed bar) and once each inside
  `startDuck` / `endDuck` on every input event. All 60+ per-second lookups
  replaced with direct property reads from `DOM`.

- **Palette cache — skips `lerpRGB()` recomputation when `dayPhase` is unchanged** (`game.js`)  
  `lerpRGB()` is called 4× per frame to produce the day/night colour strings.
  Each call parses two hex literals with `parseInt(…, 16)` and does six floating-
  point operations. `dayPhase` is constant during the 350-frame day and night
  pause windows (over a third of gameplay time) and may repeat across consecutive
  frames when `dt` produces identical increments. Added `_lastDayPhase` sentinel
  and `_pal` cache object; `lerpRGB` is only called when `dayPhase !== _lastDayPhase`.

- **`fillStyle` deduplication — halves canvas state writes per frame** (`game.js`)  
  `ctx.fillStyle = color` is a canvas state write that crosses the JS/WebGL
  bridge even when the value has not changed. `drawDino()` alone makes 18 `px()`
  calls, most consecutive ones sharing the same colour (`C.dino` for the entire
  body). Added `setFill(color)` which guards the assignment with a string
  comparison against `_lastFill`, cutting canvas state changes per frame by
  approximately 50%. `px()` delegates to `setFill()`.

- **HUD `textContent` deduplication — eliminates redundant style recalculation** (`game.js`)  
  `hdr-score` and `hdr-hi` were assigned `textContent` unconditionally every
  frame. Assigning `textContent` triggers browser style recalculation even when
  the string is identical to the current value — 120 style recalcs per second.
  Added `_lastHdrScore` and `_lastHdrHi` cache strings; writes are skipped when
  the padded string has not changed.

- **In-place obstacle cleanup — eliminates per-frame array allocation** (`game.js`)  
  `obstacles = obstacles.filter(…)` allocated a new array on every frame at 60
  Hz — steady minor GC pressure with 2–5 elements. Replaced with a reverse-index
  `splice` loop that mutates the existing array in-place. Zero allocations per
  frame in the common case where no obstacle has gone off-screen.

---

## [0.4.5-beta] — 2026-03-23

### Fixed

- **No DOM validation at startup — `getElementById` failures produced cryptic TypeErrors** (`game.js`)  
  If any required DOM element was missing (renamed ID, missing HTML, failed
  partial load), the first `getElementById` call that returned `null` would
  produce a `TypeError: Cannot read properties of null` at an arbitrary line deep
  in the game engine with no indication of which element was missing. Added a
  `validateDOM()` IIFE immediately after the DB guard that checks all 27 required
  IDs in a single pass and throws a descriptive error listing every missing ID
  before the game touches the DOM.

- **localStorage quota exhaustion produced no user-facing feedback** (`game.js`, `db.js`)  
  When `pruneAndSave` exhausted all fallbacks (top-10 and top-5) and returned
  `null`, the only indication was a small badge update that was easy to miss.
  Added a `db:criticalFailure` custom event dispatched by `pruneAndSave` on
  total failure. A `window.addEventListener('db:criticalFailure', …)` handler in
  `game.js` updates the badge and displays a blocking `alert()` with the specific
  cause and three actionable recovery steps.

- **Footer year hardcoded as `2026`** (`index.html`, `game.js`)  
  The footer displayed a static year that would become stale. Wrapped the year
  in `<span id="footer-year">2026</span>` and added one line to `boot()`:
  `document.getElementById('footer-year').textContent = new Date().getFullYear()`.
  The static `2026` fallback remains for the no-JS case.

- **Trailing whitespace (4 blank lines) at end of `game.js`** (`game.js`)  
  Lines 1184–1187 were empty. Removed.

---

## [0.4.0-beta] — 2026-03-22


### Added

- **Moon in the night sky** (`game.js`)  
  A crescent moon now scrolls slowly from right to left during night phase,
  fading in and out with `dayPhase` alongside the stars. Rendered with two
  `arc()` calls — a filled disc minus an offset cutout to produce the crescent
  shape. Moon X position is randomised at each `initGame()` so it doesn't
  always appear at the same spot. Scroll speed is `0.28 px/frame` (independent
  of game speed).

- **Triple-cactus clusters** (`game.js`)  
  `CONFIG.CACTUS_TRIPLE: 0.12` added. Spawn logic now rolls triple first
  (12% chance), then double (35% of the remainder), then single. This matches
  the original Chromium spawn variety and raises the skill ceiling at high speed.

- **Visually distinct multi-cactus clusters** (`game.js`, `spawn()`, `draw()`)  
  The previous implementation set `w = singleW * count + gap * (count - 1)` and
  passed the full span to a single `drawCactus()` call, producing one fat cactus
  with no visible separation. Players could not tell how many obstacles were in a
  cluster. Each cactus in a cluster is now drawn individually with a 6 px gap
  between them via a loop in `draw()`. The `obstacle` object now stores `count`
  and `singleW`; the total hitbox `w` covers the full span as before, so
  collision detection is unchanged.

- **Canvas speed bar** (`game.js`, `draw()`)  
  A 4 px strip along the very bottom edge of the canvas shows current speed as a
  fraction of `SPEED_MIN → SPEED_MAX`. Colour interpolates blue → orange → red.
  This is the only speed indicator visible in fullscreen mode (the DOM stats
  panel is hidden there). Replaces the DOM-only `#speed-fill` bar as the primary
  indicator; the DOM bar remains for the non-fullscreen stats panel.

- **Idle dino walk animation** (`game.js`, `idleLoop()`)  
  The dino previously stood frozen on the start screen because `idleLoop()`
  only called `draw()` without advancing the walk cycle. `dino.ft` and
  `dino.frame` are now incremented each idle frame at the same cadence used
  during gameplay.

- **BEST TIME stat** (`game.js`, `index.html`)  
  Tracks the longest run in seconds (derived from `frameCount / 60`). Stored
  in both `sessionStats.bestTime` and `dbStats.bestTime` so it persists across
  page reloads. Displayed in the stats panel as `Xm Ys` (e.g. `1m 42s`).
  `updateStatUI()` and the `boot()` IIFE both read and display the value.

### Fixed

- **`loop()` called without a timestamp** (`game.js`)  
  `startGame()`, `restart()`, `togglePause()`, and the `visibilitychange`
  handler all previously called `loop()` directly with no argument, making
  `timestamp` undefined. The `lastTime = 0` guard meant the first frame always
  used `dt = 1` (correct), but then set `lastTime = undefined`, making it
  falsy and causing the second frame to also use `dt = 1` — effectively losing
  one frame of delta-time tracking on every game start and resume. All four
  sites changed to `animFrame = requestAnimationFrame(loop)` so the browser
  always provides a proper `DOMHighResTimeStamp`.

- **Obstacle burst after large dt spike** (`game.js`)  
  If the tab was backgrounded long enough for `obsCooldown` to go deeply
  negative, `spawn()` would be called once per frame for several consecutive
  frames, flooding the screen with obstacles. Added an `obstacles.length < 5`
  guard before `spawn()` so at most 5 obstacles exist simultaneously regardless
  of how stale the cooldown is.

---


## [0.3.5-beta] — 2026-03-22

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

## [0.3.0-beta] — 2026-03-22

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

## [0.2.5-beta] — 2026-03-21

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

## [0.2.0-beta] — 2026-03-21

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

## [0.1.5-beta] — 2026-03-21

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

## [0.1.0-beta] — 2026-03-20

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

## [0.0.1.0-rc] — Initial Testing Period: 2026-03-15 to 2026-03-19

### Testing Summary

---

### 2026-03-19 — Final Verification Pass

- All five reported issues confirmed reproducible and logged.
- Code review flagged unused `val` parameter in `pruneAndRetry` as
  a lint violation (`no-unused-vars`). Noted for cleanup alongside
  the `pruneAndSave` rewrite.
- Safari/iOS 13: no storage or rendering issues found.
- Samsung Internet 12: confirmed functional.
- **Go/no-go decision: proceed to 1.0.0 with all fixes applied.**

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

### 2026-03-15 — Initial Distribution

- Builds distributed to testers on Chrome 88+ (Windows, macOS, Linux),
  Firefox 93+ (Linux), Cromite 142+ (Android), and Safari 13+ (iOS).
- Termux/Android test environment verified: `server.py` HTTPS and HTTP
  fallback confirmed functional on Android 12 and 13.
- No blockers found on first load across all platforms.