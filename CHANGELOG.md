# Changelog

All notable changes to Dino Run — Chromatic Edition are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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

## ## [0.9.0-rc] — Testing Period: 2026-03-15 to 2026-03-19

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
