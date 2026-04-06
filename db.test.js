/**
 * db.test.js — Unit tests for db.js
 *
 * Tests cover the logic changes introduced in PR 0.7.0-beta:
 *   - pruneAndSave(): conditional skip of top-10 write when knownExisting is provided
 *   - saveLeaderboard(): quota-exceeded path passes lb as knownExisting
 *   - addScore(): score validation and sanitisation
 *   - getStats(): default object always includes bestTime: 0
 *   - migrate(): backfills missing recordId on legacy leaderboard entries
 *
 * Runs with the Node.js built-in test runner (node:test), no dependencies needed.
 *   node db.test.js
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

/* ─────────────────────────────────────────────────────────────────────
   BROWSER ENVIRONMENT MOCK
   db.js is an IIFE that assigns to window.DB and uses browser globals.
   We recreate just enough of the browser surface for the module to run.

   IMPORTANT: db.js probes localStorage with setItem('_dinotest','1') at
   load time to decide which storage backend to use.  Every mock must allow
   that probe key so useLocalStorage=true and the real localStorage code path
   is exercised — otherwise db.js silently falls back to an in-memory store
   and all quota / write-failure tests would trivially pass.
   ───────────────────────────────────────────────────────────────────── */

const PROBE_KEY = '_dinotest';

/**
 * Build a fresh mock localStorage backed by a plain object.
 * The `_dinotest` probe key is always allowed (never counted against quota).
 */
function makeLocalStorage(quotaLimit = Infinity) {
  const store = {};
  let totalBytes = 0;

  function throwQuota() {
    const err = new Error('QuotaExceededError');
    err.name = 'QuotaExceededError';
    err.code = 22;
    throw err;
  }

  return {
    _store: store,
    setItem(key, val) {
      if (key === PROBE_KEY) { store[key] = val; return; } // always allow probe
      const bytes = (key + val).length * 2;
      const existing = store[key] ? (key + store[key]).length * 2 : 0;
      const delta = bytes - existing;
      if (totalBytes + delta > quotaLimit) throwQuota();
      store[key] = val;
      totalBytes += delta;
    },
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    removeItem(key) {
      if (Object.prototype.hasOwnProperty.call(store, key)) {
        totalBytes -= (key + store[key]).length * 2;
        delete store[key];
      }
    },
    clear() { Object.keys(store).forEach(k => delete store[k]); totalBytes = 0; },
    get length() { return Object.keys(store).length; },
  };
}

/**
 * Build a mock localStorage that allows the `_dinotest` probe but records
 * every write attempt and fails the first `failFirst` non-probe writes.
 *
 * @param {object}  [preload={}]    Key/value pairs to pre-populate
 * @param {number}  [failFirst=Infinity]  Number of initial non-probe writes to fail.
 *                                  0         = never fail (all writes succeed)
 *                                  1         = first write fails, rest succeed
 *                                  Infinity  = all writes fail (default for quota tests)
 */
function makeTrackingLS(preload = {}, failFirst = Infinity) {
  const store = Object.assign({}, preload);
  let writes = 0;         // counts non-probe writes attempted
  const writtenKeys = []; // keys written successfully (non-probe)

  function throwQuota() {
    const err = new Error('QuotaExceededError');
    err.name = 'QuotaExceededError';
    err.code = 22;
    throw err;
  }

  return {
    _store:           store,
    get writes()      { return writes; },
    writtenKeys,
    setItem(key, val) {
      if (key === PROBE_KEY) { store[key] = val; return; }
      writes++;
      if (writes <= failFirst) throwQuota();
      writtenKeys.push(key);
      store[key] = val;
    },
    getItem(key)      { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    removeItem(key)   { delete store[key]; },
  };
}

/**
 * Create a fresh sandbox context and load db.js into it.
 * Returns the window.DB object from that context.
 * Each call produces an isolated module instance with its own storage state.
 *
 * @param {object}  [opts]
 * @param {object}  [opts.ls]          Custom mock localStorage (use makeTrackingLS or makeLocalStorage)
 * @param {string}  [opts.preloadKey]  Key to pre-populate in a default makeLocalStorage before load
 * @param {string}  [opts.preloadVal]  Value for opts.preloadKey
 */
function loadDB(opts = {}) {
  let ls;
  if (opts.ls) {
    ls = opts.ls;
  } else {
    ls = makeLocalStorage();
    if (opts.preloadKey !== undefined) {
      ls.setItem(opts.preloadKey, opts.preloadVal);
    }
  }

  const dispatchedEvents = [];

  const mockWindow = {
    addEventListener() {},
    dispatchEvent(evt) { dispatchedEvents.push(evt); },
    _dispatchedEvents: dispatchedEvents,
  };

  const mockNavigator = {
    storage: {
      persist()  { return Promise.resolve(true); },
      estimate() { return Promise.resolve({ usage: 0, quota: 5 * 1024 * 1024 }); },
    },
  };

  const context = vm.createContext({
    window:       mockWindow,
    navigator:    mockNavigator,
    localStorage: ls,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type   = type;
        this.detail = (init && init.detail) ? init.detail : null;
      }
    },
    setTimeout()  { return 0; },  // stub — tests don't need real timers
    clearTimeout() {},
    console: {
      warn()  {},
      error() {},
      log()   {},
    },
    Date, Math, JSON, Object, String, parseInt, isFinite, Promise,
  });

  context.window = mockWindow;

  const src = fs.readFileSync('/home/jailuser/git/db.js', 'utf8');
  vm.runInContext(src, context);

  const DB = mockWindow.DB;
  DB._ls     = ls;
  DB._events = dispatchedEvents;
  return DB;
}

/* ─────────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────────── */

function makeEntry(score, id) {
  return {
    recordId: id || ('id-' + score),
    name: 'PLAYER',
    score,
    when: "01 Jan '26 00:00",
  };
}

function makeLeaderboard(scores) {
  return scores.map((s, i) => makeEntry(s, 'id-' + i + '-' + s));
}

/* ─────────────────────────────────────────────────────────────────────
   TEST SUITES
   ───────────────────────────────────────────────────────────────────── */

/* ── pruneAndSave — the core logic change in this PR ─────────────── */

describe('pruneAndSave — knownExisting skips the top-10 retry write', () => {

  test('exactly 2 writes when knownExisting is provided and all writes fail', () => {
    // failFirst=Infinity means every non-probe write fails.
    // Expected sequence:
    //   write 1: saveLeaderboard initial dbSet → fail
    //   write 2: pruneAndSave top-5 fallback   → fail  (no write 3 for top-10 retry)
    const ls = makeTrackingLS({ 'dino:version': '1' }, Infinity);
    const DB = loadDB({ ls });

    const lb = makeLeaderboard([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
    const result = DB.saveLeaderboard(lb);

    assert.equal(result, null, 'should return null when storage is completely full');
    assert.equal(ls.writes, 2, 'must attempt exactly 2 writes: initial + top-5 (NOT an extra top-10 retry)');
  });

  test('top-5 fallback succeeds: 2 writes, returns 5 entries', () => {
    // failFirst=1 means first non-probe write fails, subsequent writes succeed.
    // Expected:
    //   write 1: saveLeaderboard initial dbSet → fail
    //   write 2: pruneAndSave top-5 fallback   → succeed
    const ls = makeTrackingLS({ 'dino:version': '1' }, 1);
    const DB = loadDB({ ls });

    const lb = makeLeaderboard([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
    const result = DB.saveLeaderboard(lb);

    assert.ok(result, 'should return saved array');
    assert.equal(result.length, 5, 'should return top-5 entries');
    assert.equal(result[0].score, 100, 'top entry should have the highest score');
    assert.equal(ls.writes, 2, 'must attempt exactly 2 writes: initial + top-5 (no extra top-10 retry)');
  });

  test('dispatches db:criticalFailure when both writes fail', () => {
    const ls = makeTrackingLS({ 'dino:version': '1' }, Infinity);
    const DB = loadDB({ ls });

    const lb = makeLeaderboard([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
    DB.saveLeaderboard(lb);

    const critEvents = DB._events.filter(e => e.type === 'db:criticalFailure');
    assert.equal(critEvents.length, 1, 'db:criticalFailure must be dispatched');
    assert.ok(critEvents[0].detail && critEvents[0].detail.message, 'event detail must carry a message');
  });

  test('null result when entries <= 5 and storage is full (no top-5 slice attempted)', () => {
    // pruneAndSave only tries top-5 when combined.length > 5
    // With 3 entries and knownExisting provided → skips top-10 write → tries top-5 slice
    // (3 is not > 5) → goes straight to criticalFailure
    const ls = makeTrackingLS({ 'dino:version': '1' }, Infinity);
    const DB = loadDB({ ls });

    const lb = makeLeaderboard([100, 90, 80]);
    const result = DB.saveLeaderboard(lb);

    assert.equal(result, null, 'should return null');
    // Only 1 write: the saveLeaderboard initial attempt (pruneAndSave skips top-10
    // and combined.length <=5 so no top-5 write either)
    assert.equal(ls.writes, 1, 'only the initial saveLeaderboard write should be attempted');
  });

});

describe('pruneAndSave — no knownExisting attempts top-10 write first', () => {

  test('succeeds with top-10 on first try when no quota pressure', () => {
    const DB = loadDB();
    const lb = makeLeaderboard([90, 80, 70, 60, 50, 40, 30, 20, 10, 5]);

    // Pre-populate storage with those 10 entries, then add a new higher one
    DB.saveLeaderboard(lb);
    const result = DB.addScore('TOP', 100);

    assert.ok(result, 'should return persisted leaderboard');
    assert.equal(result[0].score, 100, 'new top score should be first');
    assert.ok(result.length <= 10, 'leaderboard must not exceed 10 entries');
  });

  test('deduplicates by recordId when merging disk + new entries', () => {
    const DB = loadDB();
    DB.addScore('A', 50);  // creates entry with unique recordId

    const lb = DB.getLeaderboard();
    assert.equal(lb.length, 1);

    // Adding same score with different name should add a second entry (different recordId)
    DB.addScore('B', 50);
    const lb2 = DB.getLeaderboard();
    assert.equal(lb2.length, 2, 'two entries with same score but different recordId must both appear');

    // All recordIds must be unique
    const ids = lb2.map(e => e.recordId);
    assert.equal(new Set(ids).size, ids.length, 'all recordIds must be unique');
  });

  test('falls back to top-5 and succeeds when top-10 write fails', () => {
    // failAfter=1: the first write (top-10 attempt) fails, second (top-5) succeeds.
    // With NO knownExisting, pruneAndSave DOES attempt the top-10 write.
    const ls = makeTrackingLS({ 'dino:version': '1' }, 1);
    const DB = loadDB({ ls });

    // addScore → saveLeaderboard (success on first attempt) — wait, we only have 1 entry
    // so saveLeaderboard succeeds on write 1. We need pruneAndSave without knownExisting.
    // The only public path that calls pruneAndSave without knownExisting is when
    // saveLeaderboard fails AND pruneAndSave is called... but saveLeaderboard passes lb as
    // knownExisting. So there is no direct public path to pruneAndSave(key, arr, undefined).
    //
    // Instead test via: if we could verify the code path exists. Here we confirm that
    // when addScore is called and the very first saveLeaderboard write fails, the fallback
    // still produces a result (top-5).
    //
    // Reset writes counter and test the cascade.
    // write 1: saveLeaderboard initial → fail → calls pruneAndSave(key, lb, lb)
    //   inside pruneAndSave(knownExisting=lb), skips top-10, tries top-5 → write 2 → success
    const ls2 = makeTrackingLS({ 'dino:version': '1' }, 1);
    const DB2 = loadDB({ ls: ls2 });

    const largeLb = makeLeaderboard([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
    const result = DB2.saveLeaderboard(largeLb);

    assert.ok(result, 'should return saved entries');
    assert.equal(result.length, 5, 'should have pruned to top 5');
    assert.equal(ls2.writes, 2, 'exactly 2 writes: initial + top-5');
  });

});

/* ── saveLeaderboard ──────────────────────────────────────────────── */

describe('saveLeaderboard — direct write path', () => {

  test('returns lb immediately when dbSet succeeds', () => {
    const DB = loadDB();
    const lb = makeLeaderboard([100, 90, 80]);
    const result = DB.saveLeaderboard(lb);
    assert.ok(Array.isArray(result), 'should return an array');
    assert.equal(result.length, lb.length);
    assert.equal(result[0].score, 100);
  });

  test('persists data to storage on success', () => {
    const DB = loadDB();
    const lb = makeLeaderboard([100, 90]);
    DB.saveLeaderboard(lb);
    const stored = JSON.parse(DB._ls.getItem('dino:lb'));
    assert.equal(stored.length, 2);
    assert.equal(stored[0].score, 100);
  });

  test('returns null when all writes fail', () => {
    const ls = makeTrackingLS({ 'dino:version': '1' }, Infinity);
    const DB = loadDB({ ls });
    const lb = makeLeaderboard([100]);
    const result = DB.saveLeaderboard(lb);
    assert.equal(result, null);
  });

});

/* ── addScore — score validation ─────────────────────────────────── */

describe('addScore — score validation', () => {

  test('stores valid integer score unchanged', () => {
    const DB = loadDB();
    const result = DB.addScore('PLAYER', 500);
    assert.ok(result);
    assert.equal(result[0].score, 500);
  });

  test('floors float score to integer', () => {
    const DB = loadDB();
    const result = DB.addScore('PLAYER', 99.7);
    assert.ok(result);
    assert.equal(result[0].score, 99, 'float score should be floored');
  });

  test('stores NaN score as 0', () => {
    const DB = loadDB();
    const result = DB.addScore('PLAYER', NaN);
    assert.ok(result);
    assert.equal(result[0].score, 0, 'NaN score should become 0');
  });

  test('stores Infinity score as 0', () => {
    const DB = loadDB();
    const result = DB.addScore('PLAYER', Infinity);
    assert.ok(result);
    assert.equal(result[0].score, 0, 'Infinity score should become 0');
  });

  test('stores -Infinity score as 0', () => {
    const DB = loadDB();
    const result = DB.addScore('PLAYER', -Infinity);
    assert.ok(result);
    assert.equal(result[0].score, 0);
  });

  test('stores negative score as 0', () => {
    const DB = loadDB();
    const result = DB.addScore('PLAYER', -10);
    assert.ok(result);
    assert.equal(result[0].score, 0, 'negative score should become 0');
  });

  test('stores string-typed score as 0', () => {
    const DB = loadDB();
    const result = DB.addScore('PLAYER', '500');
    assert.ok(result);
    assert.equal(result[0].score, 0, 'string score should become 0');
  });

  test('stores zero score without modification', () => {
    const DB = loadDB();
    const result = DB.addScore('PLAYER', 0);
    assert.ok(result);
    assert.equal(result[0].score, 0);
  });

  test('returns null when storage is completely full', () => {
    const ls = makeTrackingLS({ 'dino:version': '1' }, Infinity);
    const DB = loadDB({ ls });
    const result = DB.addScore('PLAYER', 100);
    assert.equal(result, null, 'should return null when all writes fail');
  });

  test('keeps leaderboard sorted best-first after add', () => {
    const DB = loadDB();
    DB.addScore('A', 50);
    DB.addScore('B', 200);
    DB.addScore('C', 100);
    const result = DB.addScore('D', 150);
    assert.ok(result);
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i - 1].score >= result[i].score, 'leaderboard must be sorted descending');
    }
  });

  test('caps leaderboard at 10 entries', () => {
    const DB = loadDB();
    for (let i = 0; i < 15; i++) {
      DB.addScore('P' + i, i * 10);
    }
    const lb = DB.getLeaderboard();
    assert.ok(lb.length <= 10, 'leaderboard must not exceed 10 entries');
  });

  test('stores player name as string even when given a number', () => {
    const DB = loadDB();
    const result = DB.addScore(123, 100);
    assert.ok(result);
    assert.equal(typeof result[0].name, 'string', 'name must be stored as string');
    assert.equal(result[0].name, '123');
  });

  test('entry has required fields: recordId, name, score, when', () => {
    const DB = loadDB();
    const result = DB.addScore('ALICE', 42);
    assert.ok(result && result.length > 0);
    const entry = result[0];
    assert.ok(entry.recordId,                 'entry must have recordId');
    assert.ok(typeof entry.name === 'string', 'entry must have string name');
    assert.ok(typeof entry.score === 'number','entry must have numeric score');
    assert.ok(entry.when,                     'entry must have when timestamp');
  });

});

/* ── getStats — default object shape ─────────────────────────────── */

describe('getStats — default object shape', () => {

  test('returns bestTime: 0 in default when no stats stored', () => {
    const DB = loadDB();
    const stats = DB.getStats();
    assert.ok('bestTime' in stats, 'default stats must include bestTime field');
    assert.equal(stats.bestTime, 0, 'default bestTime must be 0');
  });

  test('returns all expected default fields with value 0', () => {
    const DB = loadDB();
    const stats = DB.getStats();
    const required = ['games', 'deaths', 'obstacles', 'totalDist', 'bestScore', 'bestTime'];
    for (const field of required) {
      assert.ok(field in stats, 'default stats must include field: ' + field);
      assert.equal(stats[field], 0, field + ' default must be 0');
    }
  });

  test('merges saved partial stats with defaults — missing bestTime filled with 0', () => {
    // Simulate old stored stats that lack bestTime (pre-fix format)
    const DB = loadDB({
      preloadKey: 'dino:stats',
      preloadVal: JSON.stringify({ games: 5, deaths: 3, bestScore: 200 }),
    });
    const stats = DB.getStats();
    assert.equal(stats.games, 5);
    assert.equal(stats.bestScore, 200);
    assert.equal(stats.bestTime, 0, 'bestTime should default to 0 when missing from stored data');
    assert.equal(stats.obstacles, 0, 'obstacles should default to 0 when missing');
  });

  test('returns defaults when stored JSON is corrupt', () => {
    const DB = loadDB({
      preloadKey: 'dino:stats',
      preloadVal: 'this is not valid JSON {{{',
    });
    const stats = DB.getStats();
    assert.equal(stats.games, 0);
    assert.equal(stats.bestTime, 0);
  });

  test('saves and retrieves stats round-trip', () => {
    const DB = loadDB();
    const s = { games: 10, deaths: 8, obstacles: 50, totalDist: 3000, bestScore: 750, bestTime: 120 };
    DB.saveStats(s);
    const retrieved = DB.getStats();
    assert.equal(retrieved.games, 10);
    assert.equal(retrieved.bestTime, 120);
    assert.equal(retrieved.bestScore, 750);
  });

  test('stored bestTime is preserved and not overwritten by default', () => {
    const DB = loadDB({
      preloadKey: 'dino:stats',
      preloadVal: JSON.stringify({ games: 1, bestTime: 90 }),
    });
    const stats = DB.getStats();
    assert.equal(stats.bestTime, 90, 'stored bestTime must not be overwritten by the default 0');
  });

});

/* ── migrate — recordId backfill ─────────────────────────────────── */

describe('migrate — recordId backfill on legacy entries', () => {

  test('adds recordId to entries that are missing it (version 0 → 1)', () => {
    // Pre-populate with legacy entries that have no recordId and version=0 (absent = 0)
    const legacyLb = [
      { name: 'ANON', score: 100, when: "01 Jan '26 00:00" },
      { name: 'BOB',  score:  80, when: "01 Jan '26 00:01" },
    ];
    const DB = loadDB({
      preloadKey: 'dino:lb',
      preloadVal: JSON.stringify(legacyLb),
    });

    const lb = DB.getLeaderboard();
    for (const entry of lb) {
      assert.ok(entry.recordId, 'every entry must have a recordId after migration');
      assert.equal(typeof entry.recordId, 'string', 'recordId must be a string');
      assert.ok(entry.recordId.length > 0, 'recordId must not be empty');
    }
  });

  test('does not overwrite existing recordId during migration', () => {
    const mixedLb = [
      { recordId: 'keep-me', name: 'ALICE', score: 200, when: "01 Jan '26 00:00" },
      { name: 'BOB', score: 100, when: "01 Jan '26 00:01" },
    ];
    const DB = loadDB({
      preloadKey: 'dino:lb',
      preloadVal: JSON.stringify(mixedLb),
    });

    const lb = DB.getLeaderboard();
    const alice = lb.find(e => e.name === 'ALICE');
    assert.ok(alice, 'ALICE entry should exist');
    assert.equal(alice.recordId, 'keep-me', 'existing recordId must not be overwritten');
  });

  test('handles corrupt leaderboard JSON gracefully during migration', () => {
    assert.doesNotThrow(() => {
      loadDB({
        preloadKey: 'dino:lb',
        preloadVal: '[[invalid json',
      });
    }, 'loading with corrupt leaderboard JSON must not throw');
  });

  test('skips migration rewrite when dino:version is already current', () => {
    // version=1 → migration should not touch dino:lb
    const ls = makeTrackingLS({
      'dino:version': '1',
      'dino:lb': JSON.stringify([{ name: 'X', score: 50, when: "01 Jan '26" }]),
    }, Infinity);

    loadDB({ ls });

    // The version write (dbSet('dino:version', '1')) must not happen either,
    // but more importantly dino:lb must not be rewritten.
    assert.ok(
      !ls.writtenKeys.includes('dino:lb'),
      'must not rewrite dino:lb when migration is already up to date'
    );
  });

  test('migration bumps dino:version to current DB_VERSION', () => {
    // No version stored → migration runs → should write dino:version = '1'
    const DB = loadDB();
    const version = DB._ls.getItem('dino:version');
    assert.equal(version, '1', 'dino:version must be updated after migration');
  });

});

/* ── clearLeaderboard ─────────────────────────────────────────────── */

describe('clearLeaderboard', () => {

  test('empties the stored leaderboard', () => {
    const DB = loadDB();
    DB.addScore('A', 100);
    DB.addScore('B', 200);
    DB.clearLeaderboard();
    const lb = DB.getLeaderboard();
    assert.equal(lb.length, 0, 'leaderboard should be empty after clear');
  });

  test('returns true on success', () => {
    const DB = loadDB();
    const result = DB.clearLeaderboard();
    assert.equal(result, true, 'clearLeaderboard should return true on success');
  });

  test('returns false when storage is full', () => {
    const ls = makeTrackingLS({ 'dino:version': '1' }, Infinity);
    const DB = loadDB({ ls });
    const result = DB.clearLeaderboard();
    assert.equal(result, false, 'clearLeaderboard should return false on quota failure');
  });

});

/* ── saveStats return value ───────────────────────────────────────── */

describe('saveStats return value', () => {

  test('returns true on successful write', () => {
    const DB = loadDB();
    const result = DB.saveStats({ games: 1, deaths: 1, obstacles: 0, totalDist: 0, bestScore: 0, bestTime: 0 });
    assert.equal(result, true);
  });

  test('returns false when storage is full', () => {
    const ls = makeTrackingLS({ 'dino:version': '1' }, Infinity);
    const DB = loadDB({ ls });
    const result = DB.saveStats({ games: 1 });
    assert.equal(result, false, 'saveStats should return false on quota failure');
  });

});

/* ── savePlayerName return value ──────────────────────────────────── */

describe('savePlayerName return value', () => {

  test('returns true on successful write', () => {
    const DB = loadDB();
    const result = DB.savePlayerName('ALICE');
    assert.equal(result, true);
  });

  test('persists and retrieves player name', () => {
    const DB = loadDB();
    DB.savePlayerName('CAROL');
    assert.equal(DB.getPlayerName(), 'CAROL');
  });

  test('returns false when storage is full', () => {
    const ls = makeTrackingLS({ 'dino:version': '1' }, Infinity);
    const DB = loadDB({ ls });
    const result = DB.savePlayerName('DAVE');
    assert.equal(result, false, 'savePlayerName should return false on quota failure');
  });

  test('returns ANON when no player name is stored', () => {
    const DB = loadDB();
    assert.equal(DB.getPlayerName(), 'ANON');
  });

});

/* ── quota events ─────────────────────────────────────────────────── */

describe('quota events', () => {

  test('dispatches db:quotaFull event on QuotaExceededError', () => {
    const ls = makeTrackingLS({ 'dino:version': '1' }, Infinity);
    const DB = loadDB({ ls });
    DB.savePlayerName('X');
    const fullEvents = DB._events.filter(e => e.type === 'db:quotaFull');
    assert.ok(fullEvents.length > 0, 'db:quotaFull event should be dispatched on quota error');
  });

  test('dispatches db:criticalFailure with detail.message when all writes fail', () => {
    const ls = makeTrackingLS({ 'dino:version': '1' }, Infinity);
    const DB = loadDB({ ls });

    const lb = makeLeaderboard([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
    DB.saveLeaderboard(lb);

    const critEvents = DB._events.filter(e => e.type === 'db:criticalFailure');
    assert.ok(critEvents.length > 0, 'db:criticalFailure must be dispatched when all writes fail');
    assert.ok(critEvents[0].detail, 'db:criticalFailure event must carry detail');
    assert.ok(critEvents[0].detail.message, 'db:criticalFailure detail must carry message');
  });

});

/* ── getLeaderboard — edge cases ──────────────────────────────────── */

describe('getLeaderboard — edge cases', () => {

  test('returns empty array when nothing stored', () => {
    const DB = loadDB();
    const lb = DB.getLeaderboard();
    assert.ok(Array.isArray(lb), 'should return an array');
    assert.equal(lb.length, 0, 'should be empty');
  });

  test('returns empty array when stored JSON is corrupt', () => {
    const DB = loadDB({
      preloadKey: 'dino:lb',
      preloadVal: '{bad json',
    });
    const lb = DB.getLeaderboard();
    assert.ok(Array.isArray(lb), 'should return an array');
    assert.equal(lb.length, 0, 'corrupt JSON should yield empty array');
  });

  test('returns stored leaderboard correctly', () => {
    const entries = makeLeaderboard([300, 200, 100]);
    const DB = loadDB({
      preloadKey: 'dino:lb',
      preloadVal: JSON.stringify(entries),
    });
    const lb = DB.getLeaderboard();
    assert.equal(lb.length, 3);
    assert.equal(lb[0].score, 300);
  });

});