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

  /**
   * Update internal storage quota metrics and notify the app of current usage.
   *
   * When available, queries navigator.storage.estimate(), updates the module's
   * quotaUsed and quotaTotal values and clears quotaError, then dispatches a
   * window "db:quota" CustomEvent with detail { used, total }. Failures are
   * silently ignored.
   */
  function refreshQuota() {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        quotaUsed  = est.usage  || 0;
        quotaTotal = est.quota  || quotaTotal;
        quotaError = false;
        /* Fire a custom event so game.js can update the badge */
        window.dispatchEvent(new CustomEvent('db:quota', {
          detail: { used: quotaUsed, total: quotaTotal }
        }));
      }).catch(() => {});
    }
  }
  refreshQuota();

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
   * Store a string value under the given key in the selected storage backend.
   * @param {string} key - Storage key.
   * @param {string} val - String value to store; call `JSON.stringify` first for non-strings.
   * @returns {boolean} `true` if the value was written, `false` if the write failed (quota exceeded or other storage error).
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

  /**
   * Format the current date and time as a compact display timestamp.
   *
   * The produced string follows the pattern: DD Mon 'YY HH:MM (for example, "19 Mar '26 14:07").
   * Months use three-letter English abbreviations from the module's MONTHS array.
   * @returns {string} The formatted timestamp.
   */
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
   * Merge new leaderboard entries with stored leaderboard, prune to fit storage limits, and attempt to save.
   * @param {string} key - Storage key for the leaderboard.
   * @param {Array<Object>} newLb - New leaderboard entries to add; entries are expected to include `recordId` and `score`.
   * @returns {boolean} `true` if the leaderboard was saved successfully after merging/pruning, `false` otherwise.
   */
  function pruneAndSave(key, newLb) {
    const existing = (function () {
      let raw = dbGet(key);
      try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
    }());

    /* Merge new entries, dedup by recordId, sort best-first, keep top 10 */
    let combined = existing.concat(newLb.filter((n) => {
      return !existing.some(function (e) { return e.recordId === n.recordId; });
    }));
    combined.sort((a, b) => { return b.score - a.score; });
    combined = combined.slice(0, 10);

    if (dbSet(key, JSON.stringify(combined))) { return true; }

    /* Still too large — fall back to top 5 */
    if (combined.length > 5) {
      combined = combined.slice(0, 5);
      return dbSet(key, JSON.stringify(combined));
    }
    return false;
  }

  /* ─── Public API ────────────────────────────────────────── */
  return {

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
      let json = JSON.stringify(lb);   /* compact — no whitespace */
      if (dbSet('dino:lb', json)) { return true; }
      /* Quota exceeded — merge + prune, then retry */
      if (!pruneAndSave('dino:lb', lb)) {
        console.error('[DB] Failed to save leaderboard after pruning');
        return false;
      }
      return true;
    },

    /**
     * Add score to local top-10.
     * Stores: recordId (stable unique id), name, score, when (display timestamp).
     * @param  {string} name
     * @param  {number} score
     * @returns {Array} updated leaderboard
     */
    addScore: function (name, score) {
      let lb = this.getLeaderboard();
      lb.push({
        recordId: makeId(),        // stable unique id — dedup key in pruneAndSave
        name:     String(name),    // FIX-4: plain string; textContent handles XSS
        score:    score,
        when:     makeTimestamp()  // display only — not used for identity
      });
      lb.sort((a, b) => { return b.score - a.score; });
      lb = lb.slice(0, 10);
      if (!this.saveLeaderboard(lb)) {
        console.warn('[DB] Score not persisted — storage full');
        return null;  // FIX-2: signal failure to caller
      }
      return lb;
    },

    /* Stats ------------------------------------------------- */
    getStats: function () {
      let raw = dbGet('dino:stats');
      const def = { games:0, deaths:0, obstacles:0, totalDist:0, bestScore:0 };
      try { return raw ? JSON.parse(raw) : def; }
      catch (e) { return def; }
    },

    saveStats: function (s) {
      dbSet('dino:stats', JSON.stringify(s));
    },

    /* Player name ------------------------------------------- */
    getPlayerName: function () {
      return dbGet('dino:player') || 'ANON';
    },

    savePlayerName: function (n) {
      dbSet('dino:player', n);
    },

    /* Clear leaderboard ------------------------------------- */
    // NOTE: This only clears dino:lb. Callers are responsible for
    // also resetting dbStats.bestScore = 0 and calling DB.saveStats()
    // to keep the stats panel in sync. See clearLbBtn handler in game.js.
    // Failing to do so recreates the stats/leaderboard desync fixed in v2.0.0.
    clearLeaderboard: function () {
      dbSet('dino:lb', JSON.stringify([]));
    }

  };

}());
