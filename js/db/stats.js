/* ═══════════════════════════════════════════════════════════
   stats.js — Persistent stats, player name, schema migration
   ═══════════════════════════════════════════════════════════ */
'use strict';

import { dbGet, dbSet } from './database.js';

// ── Schema versioning ────────────────────────────────────
const DB_VERSION = 1;

(function migrate() {
  const stored = parseInt(dbGet('dino:version') || '0', 10);
  if (stored >= DB_VERSION) return;

  // v0 → v1: backfill missing recordId on older leaderboard entries
  if (stored < 1) {
    const raw = dbGet('dino:lb');
    if (raw) {
      try {
        const lb = JSON.parse(raw);
        let changed = false;
        lb.forEach((e) => {
          if (!e.recordId) {
            e.recordId = Date.now().toString(36) +
              Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
            changed = true;
          }
        });
        if (changed) {
          if (!dbSet('dino:lb', JSON.stringify(lb))) {
            console.warn('[Stats] Migration failed: could not save backfilled leaderboard');
            return;
          }
        }
      } catch (err) { /* corrupt data — leave it */ }
    }
  }
  dbSet('dino:version', String(DB_VERSION));
}());

// ── Stats ─────────────────────────────────────────────────
const STATS_DEFAULTS = {
  games: 0, deaths: 0, obstacles: 0,
  totalDist: 0, bestScore: 0, bestTime: 0,
};

export function getStats() {
  const raw = dbGet('dino:stats');
  try {
    if (raw) return Object.assign({}, STATS_DEFAULTS, JSON.parse(raw));
    return { ...STATS_DEFAULTS };
  } catch (e) { return { ...STATS_DEFAULTS }; }
}

export function saveStats(s) {
  return dbSet('dino:stats', JSON.stringify(s));
}

// ── Player name ───────────────────────────────────────────
export function getPlayerName() {
  return dbGet('dino:player') || 'ANON';
}

export function savePlayerName(name) {
  return dbSet('dino:player', name);
}