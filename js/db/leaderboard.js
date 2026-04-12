/* ═══════════════════════════════════════════════════════════
   leaderboard.js — Top-10 local leaderboard management
   ═══════════════════════════════════════════════════════════ */
'use strict';

import { dbGet, dbSet } from './database.js';

const KEY = 'dino:lb';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];

function makeTimestamp() {
  const now = new Date();
  const d   = String(now.getDate()).padStart(2, '0');
  const mon = MONTHS[now.getMonth()];
  const yr  = String(now.getFullYear()).slice(-2);
  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  return d + ' ' + mon + " '" + yr + ' ' + hh + ':' + mm;
}

function makeId() {
  return Date.now().toString(36) +
    Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
}

/**
 * Merge + prune leaderboard to fit under quota.
 * Falls back from top-10 to top-5. Returns saved array or null.
 */
function pruneAndSave(newLb, knownExisting) {
  const existing = knownExisting || (function () {
    const raw = dbGet(KEY);
    try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
  }());

  let combined = existing.concat(newLb.filter((n) =>
    !existing.some((e) => e.recordId === n.recordId)
  ));
  combined.sort((a, b) => b.score - a.score);
  combined = combined.slice(0, 10);

  if (!knownExisting) {
    if (dbSet(KEY, JSON.stringify(combined))) return combined;
  }

  let prunedToFive = false;
  if (combined.length > 5) {
    combined = combined.slice(0, 5);
    prunedToFive = true;
  }

  if (dbSet(KEY, JSON.stringify(combined))) {
    if (prunedToFive) console.warn('[DB] Storage critical: pruned to top 5');
    return combined;
  }

  window.dispatchEvent(new CustomEvent('db:criticalFailure', {
    detail: { message: 'Storage completely full — even top-5 pruning failed', key: KEY },
  }));
  return null;
}

export function getLeaderboard() {
  const raw = dbGet(KEY);
  try { return raw ? JSON.parse(raw) : []; }
  catch (e) { return []; }
}

export function saveLeaderboard(lb) {
  const json = JSON.stringify(lb);
  if (dbSet(KEY, json)) return lb;
  const saved = pruneAndSave(lb, lb);
  if (!saved) { console.error('[DB] Failed to save leaderboard after pruning'); return null; }
  return saved;
}

/**
 * Add a score to the local top-10.
 * @param {string} name
 * @param {number} score
 * @returns {Array|null} updated leaderboard, or null on failure
 */
export function addScore(name, score) {
  const safeScore = (typeof score === 'number' && isFinite(score) && score >= 0)
    ? Math.floor(score) : 0;

  let lb = getLeaderboard();
  lb.push({ recordId: makeId(), name: String(name), score: safeScore, when: makeTimestamp() });
  lb.sort((a, b) => b.score - a.score);
  lb = lb.slice(0, 10);

  const saved = saveLeaderboard(lb);
  if (!saved) { console.warn('[DB] Score not persisted — storage full'); return null; }
  return saved;
}

export function clearLeaderboard() {
  return dbSet(KEY, JSON.stringify([]));
}
