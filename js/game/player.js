/* ═══════════════════════════════════════════════════════════
   player.js — Dino logic: jump, duck, physics state
   ═══════════════════════════════════════════════════════════ */
'use strict';

import { GRAVITY, JUMP_V, SPEED_DROP_COEFF, SPEED_DROP_START_V,
         JUMP_MIN_RISE_FRAC, JUMP_MAX_RISE_FRAC, JUMP_DROP_V_FRAC,
         DINO_H, DUCK_H, DINO_X, GY, ANIM_PERIOD } from './config.js';
import { G } from './runtime.js';
import { soundJump, initAudio } from './audio.js';

export function initPlayer() {
  G.dino = {
    x: DINO_X, y: GY - DINO_H,
    vy: 0, jumping: false, ducking: false,
    // Jump state machine (Chromium Trex): fast-fall flag, "minimum height reached"
    // flag, and a latched jump-key release (see endJump()).
    speedDrop: false, reachedMin: false, releaseQueued: false,
    frame: 0, ft: 0,
  };
}

/**
 * Chromium Trex.endJump(): once the minimum height has been reached, cap the
 * upward speed at the drop velocity. A no-op while rising slower than that,
 * while falling, or before the minimum height — so it can never push the dino up.
 */
function applyEndJump(d) {
  const dropV = JUMP_V * JUMP_DROP_V_FRAC;   // negative (upward)
  if (d.reachedMin && d.vy < dropV) d.vy = dropV;
}

/**
 * Advance dino physics for one dt step.
 * Order matches Trex.updateJump() reference:
 *   position update → gravity on velocity → min/max-height checks → landing.
 */
export function updatePlayer(dt) {
  const d = G.dino;
  d.ducking = G.duckHeld && !d.jumping;

  if (d.jumping) {
    const land = GY - DINO_H;

    // Step 1 — Apply velocity to position (reference: yPos += round(vel * [coeff] * frames)).
    // The speed-drop multiplier lives in the position step only (it never accumulates
    // into vy, so releasing Down mid-air restores the normal arc). startSpeedDrop()
    // forces vy > 0 before setting d.speedDrop, and gravity only grows it, so the
    // multiplier can only ever scale a *downward* move — never a rise.
    // Sub-pixel precision (no Math.round) avoids coarse position snapping during
    // descent — the renderer already floors to integers via `y | 0`, so there is
    // no visual jitter, but the collision check now uses the true float position.
    d.y += d.vy * (d.speedDrop ? SPEED_DROP_COEFF : 1.0) * dt;

    // Step 2 — Apply gravity to velocity (reference: jumpVelocity += gravity * frames)
    d.vy += GRAVITY * dt;

    // Step 3 — Jump-height limits (reference: minJumpHeight / maxJumpHeight).
    const rise = land - d.y;
    const apex = (JUMP_V * JUMP_V) / (2 * GRAVITY);   // free-flight apex, px
    if (rise > apex * JUMP_MIN_RISE_FRAC || d.speedDrop) d.reachedMin = true;
    // A release that arrived before the minimum height is applied as soon as it is reached.
    if (d.releaseQueued) applyEndJump(d);
    // Past the maximum height the climb is capped (reference: yPos < maxJumpHeight → endJump()).
    if (rise > apex * JUMP_MAX_RISE_FRAC || d.speedDrop) applyEndJump(d);

    // Step 4 — Check landing (reference: if yPos > groundYPos → reset)
    if (d.y >= land) {
      d.y             = land;
      d.vy            = 0;
      d.jumping       = false;
      d.speedDrop     = false;
      d.reachedMin    = false;
      d.releaseQueued = false;
      // Recompute ducking state after landing so collision checks reflect correct state
      d.ducking = G.duckHeld && !d.jumping;
    }
  } else {
    d.y = GY - (d.ducking ? DUCK_H : DINO_H);
  }

  // Walking animation
  d.ft += dt;
  if (d.ft > ANIM_PERIOD) { d.ft = 0; d.frame = (d.frame + 1) % 2; }
}

export function tickIdleAnimation() {
  const d = G.dino;
  d.ft += 1;
  if (d.ft > ANIM_PERIOD) { d.ft = 0; d.frame = (d.frame + 1) % 2; }
}

/**
 * Trigger jump — also handles start/restart when idle/dead.
 */
export function jump(onStart, onRestart) {
  if (G.state === 'paused') return;
  initAudio();
  if (G.state === 'idle') { onStart && onStart(); return; }
  if (G.state === 'dead') { onRestart && onRestart(); return; }
  // No jump while ducking (reference: !jumping && !ducking). G.duckHeld is checked
  // too because d.ducking is only refreshed once per update — Down pressed in the
  // same frame as jump must still win.
  if (!G.dino.jumping && !G.dino.ducking && !G.duckHeld) {
    G.dino.vy            = JUMP_V;
    G.dino.jumping       = true;
    G.dino.speedDrop     = false;
    G.dino.reachedMin    = false;
    G.dino.releaseQueued = false;
    soundJump();
  }
}

/**
 * Jump key / touch released — Chromium Trex.endJump(): shortens the hop by capping
 * upward speed once the minimum height has been reached.
 *
 * Chromium simply ignores a release that arrives before the minimum height, so an
 * ultra-short tap becomes a full-height jump. In this larger world that window is
 * ~70 ms, so the release is latched instead and applied the moment the minimum
 * height is reached: every tap is a consistent short hop. No-op when not airborne
 * (a stale release can never leak into the next jump).
 */
export function endJump() {
  const d = G.dino;
  if (!d || !d.jumping) return;
  d.releaseQueued = true;
  applyEndJump(d);
}

/**
 * Down pressed while airborne — Chromium Trex.setSpeedDrop(): cancel the rise and
 * start falling immediately, with the fall multiplied by SPEED_DROP_COEFF.
 * Chromium sets the velocity to exactly 1; Math.max keeps a fast fall that is
 * already quicker than that from being braked in this larger world.
 */
function startSpeedDrop() {
  const d = G.dino;
  if (!d || !d.jumping || G.state !== 'running') return;
  d.speedDrop = true;
  d.vy        = Math.max(d.vy, SPEED_DROP_START_V);
}

export function startDuck(duckBtnEl) {
  G.duckHeld = true;
  initAudio();
  if (duckBtnEl) duckBtnEl.classList.add('active');
  startSpeedDrop();
}

export function endDuck(duckBtnEl) {
  G.duckHeld = false;
  // Reference onKeyUp: tRex.speedDrop = false — velocity is kept, only the multiplier ends.
  if (G.dino) G.dino.speedDrop = false;
  if (duckBtnEl) duckBtnEl.classList.remove('active');
}
