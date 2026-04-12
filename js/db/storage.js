/* ═══════════════════════════════════════════════════════════
   storage.js — Quota tracking and storage persistence events
   Exports refreshQuota() used by database.js after each write.
   ═══════════════════════════════════════════════════════════ */
'use strict';

// Debounce interval for quota refresh (ms) — avoids hammering storage.estimate()
const QUOTA_DEBOUNCE_MS = 2000;

let quotaUsed  = 0;
let quotaTotal = 5 * 1024 * 1024;   // assume 5 MB default
let _quotaTimer = null;

export function getQuotaUsed()  { return quotaUsed;  }
export function getQuotaTotal() { return quotaTotal; }

/**
 * Debounced quota estimate — fires at most once per 2 seconds.
 * Dispatches `db:quota` with { used, total } on the window.
 */
export function refreshQuota() {
  if (!navigator.storage || !navigator.storage.estimate) return;
  if (_quotaTimer !== null) return;
  _quotaTimer = setTimeout(function () {
    _quotaTimer = null;
    navigator.storage.estimate().then(function (est) {
      quotaUsed  = est.usage  || 0;
      quotaTotal = est.quota  || quotaTotal;
      window.dispatchEvent(new CustomEvent('db:quota', {
        detail: { used: quotaUsed, total: quotaTotal },
      }));
    }).catch(function () {});
  }, QUOTA_DEBOUNCE_MS);
}

// ── Eager quota fetch at startup ─────────────────────────
(function eagerRefresh() {
  if (!navigator.storage || !navigator.storage.estimate) return;
  navigator.storage.estimate().then(function (est) {
    quotaUsed  = est.usage  || 0;
    quotaTotal = est.quota  || quotaTotal;
    window.dispatchEvent(new CustomEvent('db:quota', {
      detail: { used: quotaUsed, total: quotaTotal },
    }));
  }).catch(function () {});
}());

// Request persistent storage so the browser won't evict our data
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
