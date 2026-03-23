# Changelog

All notable changes to Dino Run — Chromatic Edition are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [5.2.2] — 2026-03-23

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

## [5.2.1] — 2026-03-23

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

## [5.2.0] — 2026-03-23

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

## [5.2.0-pre] — 2026-03-23

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

## [5.1.2] — 2026-03-23

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

## [5.1.1] — 2026-03-23

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

## [5.1.0] — 2026-03-23

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

## [5.0.4] — 2026-03-23

### Fixed

- **CSS backtick syntax in `:fullscreen body` background rule** (`style.css`)  
  The rule read `background: \`#000\`` — JavaScript template literal syntax that
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

## [5.0.3] — 2026-03-23

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

## [5.0.2] — 2026-03-23

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

## [5.0.1] — 2026-03-23

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

## [5.0.0] — 2026-03-22


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
