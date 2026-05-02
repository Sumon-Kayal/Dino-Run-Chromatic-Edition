/* ═══════════════════════════════════════════════════════════
   input.js — Keyboard events and mobile controls
   ═══════════════════════════════════════════════════════════ */
'use strict';

import { getSoundMuted, setSoundMuted, initAudio } from './audio.js';

// ── Listener registry ────────────────────────────────────
// Every addEventListener call is recorded here so teardownInput()
// can remove them all — preventing the 1-2 MB leak that accumulated
// across repeated game restarts when listeners were never removed.
const _listeners = [];

function _on(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  _listeners.push({ target, event, handler, options });
}

/**
 * Remove every listener registered by setupInput().
 * Call this on game teardown / page unload if needed.
 */
export function teardownInput() {
  _listeners.forEach(({ target, event, handler, options }) => {
    target.removeEventListener(event, handler, options);
  });
  _listeners.length = 0;
}

/**
 * Attach keyboard, pointer/touch, and UI button event handlers to the provided DOM elements and record them for later removal.
 *
 * @param {object} DOM - Cached DOM references required by the input handlers. Expected properties: `gameFrame`, `restartBtn`, `jumpBtn`, `duckBtn`, `pauseBtn`, `muteBtn`, `fullscreenBtn`.
 * @param {object} handlers - Callback functions invoked by input events. Expected properties: `jump`, `startDuck`, `endDuck`, `togglePause`, `toggleFullscreen`, `restart`.
 */
export function setupInput(DOM, handlers) {
  const { jump, startDuck, endDuck, togglePause, toggleFullscreen } = handlers;

  /**
   * Handle keydown events for game input controls.
   *
   * Ignores events originating from interactive elements and ignores auto-repeated events.
   * Maps keys to game actions:
   * - `Space` or `ArrowUp`: trigger jump
   * - `ArrowDown`: start ducking
   * - `KeyP`: toggle pause
   * - `KeyM`: toggle sound mute and update the mute button's UI
   * - `KeyF`: toggle fullscreen
   *
   * @param {KeyboardEvent} e - The keydown event to handle.
   */
  function onKeyDown(e) {
    // Bail out if focus is in an interactive control
    if (e.target) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.target.contentEditable === 'true') return;
      if (e.target.closest('button, [role="button"], [contenteditable="true"]')) return;
    }
    // P2 FIX: Ignore auto-repeat events — without this, holding Space causes
    // the jump callback to fire dozens of times per second (auto-jump bug).
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault(); jump();
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault(); startDuck();
    }
    if (e.code === 'KeyP') {
      e.preventDefault(); togglePause();
    }
    if (e.code === 'KeyM') {
      e.preventDefault();
      const muted = !getSoundMuted();
      setSoundMuted(muted);
      initAudio();
      DOM.muteBtn.textContent = muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
      DOM.muteBtn.classList.toggle('active', muted);
      DOM.muteBtn.setAttribute('aria-pressed', String(muted));
    }
    if (e.code === 'KeyF') {
      e.preventDefault(); toggleFullscreen();
    }
  }

  function onKeyUp(e) {
    // Bail out if focus is in an interactive control
    if (e.target) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.target.contentEditable === 'true') return;
      if (e.target.closest('button, [role="button"], [contenteditable="true"]')) return;
    }
    if (e.code === 'ArrowDown') endDuck();
  }

  _on(document, 'keydown', onKeyDown);
  _on(document, 'keyup',   onKeyUp);

  // ── Game frame — click / touch ──────────────────────────
  _on(DOM.gameFrame, 'click', jump);
  _on(DOM.gameFrame, 'touchstart', function (e) {
    e.preventDefault(); jump();
  }, { passive: false });

  // ── Restart button ──────────────────────────────────────
  _on(DOM.restartBtn, 'click', function (e) {
    e.stopPropagation(); handlers.restart();
  });
  _on(DOM.restartBtn, 'touchstart', function (e) {
    e.stopPropagation(); e.preventDefault(); handlers.restart();
  }, { passive: false });

  // ── Jump button ─────────────────────────────────────────
  _on(DOM.jumpBtn, 'click', jump);
  _on(DOM.jumpBtn, 'touchstart', function (e) {
    e.preventDefault(); jump();
  }, { passive: false });

  // ── Duck button ─────────────────────────────────────────
  _on(DOM.duckBtn, 'mousedown',   startDuck);
  _on(DOM.duckBtn, 'mouseup',     endDuck);
  _on(DOM.duckBtn, 'mouseleave',  endDuck);
  _on(DOM.duckBtn, 'touchstart', function (e) {
    e.preventDefault(); startDuck();
  }, { passive: false });
  _on(DOM.duckBtn, 'touchend',    function (e) { e.preventDefault(); endDuck(); }, { passive: false });
  _on(DOM.duckBtn, 'touchcancel', function (e) { e.preventDefault(); endDuck(); }, { passive: false });
  _on(document, 'mouseup', endDuck);
  _on(window,   'blur',    endDuck);

  // ── Pause button ────────────────────────────────────────
  _on(DOM.pauseBtn, 'click', function (e) {
    e.stopPropagation(); togglePause();
  });
  _on(DOM.pauseBtn, 'touchstart', function (e) {
    e.stopPropagation(); e.preventDefault(); togglePause();
  }, { passive: false });

  // ── Mute button ─────────────────────────────────────────
  _on(DOM.muteBtn, 'click', function (e) {
    e.stopPropagation();
    const muted = !getSoundMuted();
    setSoundMuted(muted);
    initAudio();
    this.textContent = muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
    this.classList.toggle('active', muted);
    this.setAttribute('aria-pressed', String(muted));
  });

  // ── Fullscreen button ────────────────────────────────────
  _on(DOM.fullscreenBtn, 'click', function (e) {
    e.stopPropagation(); toggleFullscreen();
  });
}