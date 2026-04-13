/* ═══════════════════════════════════════════════════════════
   engine.js — Game loop and delta-time timing
   ═══════════════════════════════════════════════════════════ */
'use strict';

import { FRAME_MS, MAX_DT } from './config.js';

export class Engine {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.last   = 0;
    this._raf   = null;
    this._running = false;

    // FIX #1: bind once here — never inside loop().
    // Calling .bind() on every rAF tick allocates a new Function object
    // every ~16 ms, hammering the GC and causing micro-stutter.
    this._boundLoop = this.loop.bind(this);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._raf = requestAnimationFrame(this._boundLoop);
  }

  stop() {
    this._running = false;
    if (this._raf !== null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  loop(t) {
    if (!this._running) return;

    // dt normalised to 60 fps (1.0 = one 60 Hz frame).
    // Clamped to MAX_DT to prevent a "spiral of death" after pauses.
    const dt = this.last ? Math.min((t - this.last) / FRAME_MS, MAX_DT) : 1;
    this.last = t;

    this.update(dt);
    this.render();

    // FIX #1: reuse the already-bound function — no new allocation each frame.
    // Re-check _running in case stop() was called during update() or render().
    if (this._running) this._raf = requestAnimationFrame(this._boundLoop);
  }

  resetTimer() {
    this.last = 0;
  }
}