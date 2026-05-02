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
 * Merge incoming leaderboard entries into the stored leaderboard, trim to capacity, and persist with a top-10 → top-5 fallback.
 *
 * If `knownExisting` is provided it is used instead of reading storage and the initial top-10 write attempt is skipped.
 * On successful save returns the saved leaderboard (trimmed to either 10 or 5 entries); on failure dispatches a `db:criticalFailure` event and returns `null`.
 *
 * @param {Array<object>} newLb - New leaderboard entries to merge (objects with at least `recordId` and `score` properties).
 * @param {Array<object>} [knownExisting] - Optional existing leaderboard to use instead of reading from storage; when supplied the initial top-10 save attempt is not performed.
 * @returns {Array<object>|null} The saved leaderboard array (top-10 or top-5) on success, or `null` if persisting failed.
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

  // Only attempt a prune if it would actually reduce the payload size.
  let prunedToFive = false;
  if (combined.length > 5) {
    combined = combined.slice(0, 5);
    prunedToFive = true;
    if (dbSet(KEY, JSON.stringify(combined))) {
      console.warn('[DB] Storage critical: pruned to top 5');
      return combined;
    }
  } else {
    // combined is already <=5 entries — attempt the write before declaring failure.
    if (dbSet(KEY, JSON.stringify(combined))) return combined;
  }

  const message = prunedToFive
    ? 'Storage completely full — even top-5 pruning failed'
    : 'Storage completely full — leaderboard payload (<=5) failed to save';
  window.dispatchEvent(new CustomEvent('db:criticalFailure', {
    detail: { message, key: KEY },
  }));
  return null;
}

export function getLeaderboard() {
  const raw = dbGet(KEY);
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  }
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
