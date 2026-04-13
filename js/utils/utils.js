/* ═══════════════════════════════════════════════════════════
   utils.js — Shared utility functions
   Imported by renderer (lerp) and available to any module.
   ═══════════════════════════════════════════════════════════ */
'use strict';

/** Clamp v to [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation between a and b by t ∈ [0, 1]. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Return a random integer in [min, max] inclusive. */
export function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Format a numeric score as a zero-padded 5-digit string. */
export function formatScore(n) {
  return String(Math.floor(n)).padStart(5, '0');
}

/** Deep-clone a plain JSON-serialisable object. */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

