/* ═══════════════════════════════════════════════════════════
   db.js — Barrel re-export for all db sub-modules.
   External tooling (tests, dev console) can import everything
   from this single entry point instead of individual files.
   ═══════════════════════════════════════════════════════════ */
'use strict';

export { backendName, dbGet, dbSet }                          from './database.js';
export { addScore, getLeaderboard, saveLeaderboard,
         clearLeaderboard }                                   from './leaderboard.js';
export { getStats, saveStats, getPlayerName, savePlayerName } from './stats.js';
export { getQuotaUsed, getQuotaTotal, refreshQuota }          from './storage.js';

