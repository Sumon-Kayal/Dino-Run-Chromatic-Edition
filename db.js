/* ═══════════════════════════════════════════════════════════
   DINO RUN — CHROMATIC EDITION
   db.js — Local Storage Layer  (5 MB aware)

   All data is stored LOCALLY on this device only.
   No global leaderboard. No network calls. Fully offline.

   Storage backend (auto-detected):
     1. localStorage  — Chrome, Firefox, Safari, Edge, Cromite…
     2. In-memory     — private/restricted contexts (session only)

   5 MB strategy:
     · Data stored with JSON.stringify (no whitespace)
     · navigator.storage.persist() requested at startup to prevent
       the browser evicting our data under storage pressure
     · navigator.storage.estimate() polled so the UI can show
       real quota usage
     · QuotaExceededError caught and surfaced instead of silently
       swallowed — writes that exceed quota return false and the
       caller can decide how to handle it

   Exposes: window.DB  (must be loaded before game.js)
   ═══════════════════════════════════════════════════════════ */
'use strict';

window.DB = (function () {

  /* ─── Backend detection ─────────────────────────────────── */
  const useLocalStorage = (function () {
    try {
      localStorage.setItem('_dinotest', '1');
      localStorage.removeItem('_dinotest');
      return true;
    } catch (e) { return false; }
  }());

  /* ─── In-memory fallback ────────────────────────────────── */
  const memStore = {};

  /* ─── Schema versioning ─────────────────────────────────── */
  // Bump DB_VERSION whenever the stored JSON schema changes.
  // The migration block below runs once on first load of the new version
  // so old saved data is upgraded rather than silently breaking.
  const DB_VERSION = 1;

  (function migrate() {
    let stored = parseInt(dbGet('dino:version') || '0', 10);
    if (stored >= DB_VERSION) return;
    // v0 → v1: leaderboard entries had no recordId field.
    // Patch existing entries so pruneAndSave dedup works correctly.
    if (stored < 1) {
      let raw = dbGet('dino:lb');
      if (raw) {
        try {
          let lb = JSON.parse(raw);
          let changed = false;
          lb.forEach((e) => {
            if (!e.recordId) {
              e.recordId = Date.now().toString(36) + Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
              changed = true;
            }
          });
          if (changed) dbSet('dino:lb', JSON.stringify(lb));
        } catch (err) { /* corrupt data — leave it, getLeaderboard() handles it */ }
      }
    }
    dbSet('dino:version', String(DB_VERSION));
  }());


  let quotaUsed  = 0;     // bytes used  (from estimate())
  let quotaTotal = 5 * 1024 * 1024;  // default assume 5 MB
  let quotaError = false; // true when last write hit quota limit

  /* Request persistent storage so the browser won't evict us */
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  /* ─── Quota refresh (debounced) ─────────────────────────── */
  /* OPT-DB-1: refreshQuota() is called after every successful dbSet().
     A single game-over triggers dbSet 2–3 times in quick succession
     (leaderboard, stats, player name), each firing navigator.storage.estimate()
     — an async IPC call to the browser process. Debouncing ensures at most
     one estimate fires per 2-second window regardless of write burst size. */
  let _quotaTimer = null;
  function refreshQuota() {
    if (!navigator.storage || !navigator.storage.estimate) return;
    if (_quotaTimer !== null) return;   // already scheduled — skip duplicate
    _quotaTimer = setTimeout(function () {
      _quotaTimer = null;
      navigator.storage.estimate().then(function (est) {
        quotaUsed  = est.usage  || 0;
        quotaTotal = est.quota  || quotaTotal;
        quotaError = false;
        window.dispatchEvent(new CustomEvent('db:quota', {
          detail: { used: quotaUsed, total: quotaTotal }
        }));
      }).catch(function () {});
    }, 2000);
  }
  /* Eager call at startup — run immediately, not debounced, so the badge
     shows real quota info as soon as the page loads. */
  (function refreshQuotaEager() {
    if (!navigator.storage || !navigator.storage.estimate) return;
    navigator.storage.estimate().then(function (est) {
      quotaUsed  = est.usage  || 0;
      quotaTotal = est.quota  || quotaTotal;
      window.dispatchEvent(new CustomEvent('db:quota', {
        detail: { used: quotaUsed, total: quotaTotal }
      }));
    }).catch(function () {});
  }());

  /* ─── Low-level get / set ───────────────────────────────── */

  /**
   * Read a value from storage.
   * @param  {string} key
   * @returns {string|null}
   */
  function dbGet(key) {
    if (useLocalStorage) {
      try { return localStorage.getItem(key); }
      catch (e) { return null; }
    }
    return (key in memStore) ? memStore[key] : null;
  }

  /**
   * Write a value to storage.
   * BUG-4 FIX: catches QuotaExceededError explicitly instead of
   *            swallowing it silently. Returns false on failure.
   * @param  {string} key
   * @param  {string} val  — must be a string (JSON.stringify first)
   * @returns {boolean} true = success, false = quota exceeded / error
   */
  function dbSet(key, val) {
    if (useLocalStorage) {
      try {
        localStorage.setItem(key, val);
        /* Refresh quota estimate after every successful write */
        refreshQuota();
        return true;
      } catch (e) {
        let name = e.name || '';
        if (name === 'QuotaExceededError' ||
            name === 'NS_ERROR_DOM_QUOTA_REACHED' ||   /* Firefox */
            e.code === 22 ||                            /* Chrome  */
            e.code === 1014) {                          /* Firefox */
          quotaError = true;
          window.dispatchEvent(new CustomEvent('db:quotaFull'));
          console.warn('[DB] localStorage quota exceeded — key:', key);
        } else {
          console.warn('[DB] localStorage write error:', e);
        }
        return false;
      }
    }
    /* in-memory fallback */
    memStore[key] = val;
    return true;
  }

  /* ─── Helpers ───────────────────────────────────────────── */

  // FIX-4: escapeText() was here but it caused a double-encoding visual bug.
  // game.js renders leaderboard names via td.textContent (not innerHTML), which
  // is already 100% XSS-safe. Manual entity encoding made "&lt;" print
  // literally on screen instead of "<". The function has been removed; names
  // are stored and retrieved as plain strings.

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];

  /** Returns "19 Mar '26 14:07" */
  function makeTimestamp() {
    const now = new Date();
    const d   = String(now.getDate()).padStart(2, '0');
    const mon = MONTHS[now.getMonth()];
    const yr  = String(now.getFullYear()).slice(-2);
    const hh  = String(now.getHours()).padStart(2, '0');
    const mm  = String(now.getMinutes()).padStart(2, '0');
    return d + ' ' + mon + " '" + yr + ' ' + hh + ':' + mm;
  }

  /**
   * Returns a short unique id: timestamp-ms + 4 random hex chars.
   * Used as a stable identity key for leaderboard entries so that
   * two scores recorded in the same minute are never treated as
   * duplicates during quota-triggered merges.
   */
  function makeId() {
    return Date.now().toString(36) + Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  }

  /* ─── Quota pruning ─────────────────────────────────────── */
  /**
   * BUG-1 FIX: returns the array actually persisted (or null on total failure).
   *
   * OPT-DB-2: accepts an optional `knownExisting` parameter. When the caller
   * already holds the pre-existing leaderboard in memory (as saveLeaderboard
   * does), passing it here skips the dbGet() + JSON.parse() round-trip that
   * would otherwise re-read from localStorage unnecessarily.
   *
   * @param {string}      key
   * @param {Array}       newLb          — entries to persist
   * @param {Array|null}  [knownExisting] — in-memory existing array if available
   * @returns {Array|null}
   */
  function pruneAndSave(key, newLb, knownExisting) {
    /* OPT-DB-2: use the provided in-memory array if available; only hit storage
       when we genuinely don't know the current on-disk state. */
    const existing = knownExisting || (function () {
      let raw = dbGet(key);
      try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
    }());

    /* Merge new entries, dedup by recordId, sort best-first, keep top 10 */
    let combined = existing.concat(newLb.filter((n) => {
      return !existing.some(function (e) { return e.recordId === n.recordId; });
    }));
    combined.sort((a, b) => { return b.score - a.score; });
    combined = combined.slice(0, 10);

    if (dbSet(key, JSON.stringify(combined))) { return combined; }

    /* Still too large — fall back to top 5 */
    if (combined.length > 5) {
      combined = combined.slice(0, 5);
      if (dbSet(key, JSON.stringify(combined))) {
        console.warn('[DB] Storage critical: pruned to top 5 to fit quota');
        return combined;
      }
    }
    /* Complete failure */
    window.dispatchEvent(new CustomEvent('db:criticalFailure', {
      detail: { message: 'Storage completely full — even top-5 pruning failed', key: key }
    }));
    return null;
  }

  /* ─── Public API ────────────────────────────────────────── */
  /* BUG-4 FIX: local alias used by addScore() so method calls resolve
     correctly regardless of call-site `this` context. */
  let api;
  return (api = {

    /** Which storage backend is active */
    backendName: useLocalStorage
      ? 'LOCAL STORAGE \xB7 OFFLINE'
      : 'IN-MEMORY (SESSION ONLY)',

    /** Current quota info — updated async by refreshQuota() */
    get quotaUsed()  { return quotaUsed;  },
    get quotaTotal() { return quotaTotal; },
    get quotaError() { return quotaError; },

    /* Leaderboard ------------------------------------------ */
    getLeaderboard: function () {
      let raw = dbGet('dino:lb');
      try { return raw ? JSON.parse(raw) : []; }
      catch (e) { return []; }
    },

    saveLeaderboard: function (lb) {
      let json = JSON.stringify(lb);
      if (dbSet('dino:lb', json)) { return lb; }
      /* Quota exceeded — merge + prune, then retry.
         OPT-DB-2: pass lb as knownExisting so pruneAndSave skips dbGet+JSON.parse.
         lb is already a sorted top-10 built from getLeaderboard() + new entry,
         so it is the definitive in-memory state; no storage re-read needed. */
      let saved = pruneAndSave('dino:lb', lb, lb);
      if (!saved) {
        console.error('[DB] Failed to save leaderboard after pruning');
        return null;
      }
      return saved;
    },

    /**
     * Add score to local top-10.
     * Stores: recordId (stable unique id), name, score, when (display timestamp).
     * @param  {string} name
     * @param  {number} score  — must be a finite non-negative integer
     * @returns {Array|null}   updated leaderboard that was actually persisted,
     *                         or null if the write failed entirely
     */
    addScore: function (name, score) {
      /* BUG-2 FIX: validate score before touching storage.
         NaN or Infinity would corrupt sort() (all comparisons return false,
         making sort output undefined) and persist garbage to localStorage.
         Clamp to a safe integer — if score is somehow bad, store 0 so the
         entry at least appears with correct rank rather than thrashing sort. */
      let safeScore = (typeof score === 'number' && isFinite(score) && score >= 0)
        ? Math.floor(score)
        : 0;
      if (safeScore !== score) {
        console.warn('[DB] addScore: invalid score value', score, '— stored as', safeScore);
      }

      /* BUG-4 FIX: capture the API object in a local alias so getLeaderboard()
         and saveLeaderboard() resolve correctly even if addScore is ever called
         without its object context (destructuring, callbacks in strict mode). */
      let lb = api.getLeaderboard();
      lb.push({
        recordId: makeId(),           // stable unique id — dedup key in pruneAndSave
        name:     String(name),       // plain string; textContent handles XSS
        score:    safeScore,
        when:     makeTimestamp()     // display only — not used for identity
      });
      lb.sort((a, b) => { return b.score - a.score; });
      lb = lb.slice(0, 10);

      /* BUG-1 FIX: saveLeaderboard now returns the array that was actually
         persisted (which may be fewer than 10 entries after pruning), or null
         on total failure. Return it directly so callers render exactly what's
         on disk — no more session/reload discrepancy. */
      let saved = api.saveLeaderboard(lb);
      if (!saved) {
        console.warn('[DB] Score not persisted — storage full');
        return null;
      }
      return saved;
    },

    /* Stats ------------------------------------------------- */
    getStats: function () {
      let raw = dbGet('dino:stats');
      /* BUG-3 FIX: include bestTime: 0 in the default so callers never receive
         undefined for this field — the previous default omitted it, leaving a
         latent undefined-propagation trap for any future code without a || 0 guard. */
      const def = { games:0, deaths:0, obstacles:0, totalDist:0, bestScore:0, bestTime:0 };
      try { return raw ? JSON.parse(raw) : def; }
      catch (e) { return def; }
    },

    saveStats: function (s) {
      // FIX-9: return the write result so callers can detect quota failures.
      // Previously ignored — silent data loss if storage was exhausted.
      return dbSet('dino:stats', JSON.stringify(s));
    },

    /* Player name ------------------------------------------- */
    getPlayerName: function () {
      return dbGet('dino:player') || 'ANON';
    },

    savePlayerName: function (n) {
      // FIX-9: propagate write result
      return dbSet('dino:player', n);
    },

    /* Clear leaderboard ------------------------------------- */
    // NOTE: This only clears dino:lb. Callers are responsible for
    // also resetting dbStats.bestScore = 0 and calling DB.saveStats()
    // to keep the stats panel in sync. See clearLbBtn handler in game.js.
    // Failing to do so recreates the stats/leaderboard desync fixed in v2.0.0.
    clearLeaderboard: function () {
      // FIX-9: propagate write result
      return dbSet('dino:lb', JSON.stringify([]));
    }

  });
}());
