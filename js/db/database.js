/* ═══════════════════════════════════════════════════════════
   database.js — Core localStorage / in-memory storage methods
   ═══════════════════════════════════════════════════════════ */
'use strict';

// Legacy browser error codes for localStorage quota exceeded
// (DOMException.code was not standardised — these cover Chrome/Safari/Firefox)
const QUOTA_ERR_CODE_LEGACY  = 22;    // Chrome / Safari
const QUOTA_ERR_CODE_FIREFOX = 1014;  // Firefox NS_ERROR_DOM_QUOTA_REACHED

import { refreshQuota } from './storage.js';

// ── Backend detection ────────────────────────────────────
const useLocalStorage = (function () {
  try {
    localStorage.setItem('_dinotest', '1');
    localStorage.removeItem('_dinotest');
    return true;
  } catch (e) { return false; }
}());

const memStore = {};

export const backendName = useLocalStorage
  ? 'LOCAL STORAGE \xB7 OFFLINE'
  : 'IN-MEMORY (SESSION ONLY)';

/**
 * Read a value from storage.
 * @param {string} key
 * @returns {string|null}
 */
export function dbGet(key) {
  if (useLocalStorage) {
    try { return localStorage.getItem(key); }
    catch (e) { return null; }
  }
  return (key in memStore) ? memStore[key] : null;
}

/**
 * Write a value to storage.
 * @param {string} key
 * @param {string} val  - must be a string (JSON.stringify first)
 * @returns {boolean} true = success, false = quota exceeded / error
 */
export function dbSet(key, val) {
  if (useLocalStorage) {
    try {
      localStorage.setItem(key, val);
      refreshQuota();
      return true;
    } catch (e) {
      const name = e.name || '';
      if (
        name === 'QuotaExceededError' ||
        name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === QUOTA_ERR_CODE_LEGACY  ||
        e.code === QUOTA_ERR_CODE_FIREFOX
      ) {
        window.dispatchEvent(new CustomEvent('db:quotaFull'));
        console.warn('[DB] localStorage quota exceeded — key:', key);
      } else {
        console.warn('[DB] localStorage write error:', e);
      }
      return false;
    }
  }
  memStore[key] = val;
  return true;
}
