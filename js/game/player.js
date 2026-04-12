/* ═══════════════════════════════════════════════════════════
   player.js — Dino logic: jump, duck, physics state
   ═══════════════════════════════════════════════════════════ */
'use strict';

import { GRAVITY, JUMP_V, SPEED_DROP_COEFF, DINO_H, DUCK_H, DINO_X, GY, ANIM_PERIOD } from './config.js';
import { G } from './runtime.js';
import { soundJump, initAudio } from './audio.js';

export function initPlayer() {
  G.dino = {
    x: DINO_X, y: GY - DINO_H,
    vy: 0, jumping: false, ducking: false,
    frame: 0, ft: 0,
  };
}

/**
 * Advance dino physics for one dt step.
 * Order matches Trex.updateJump() reference (file 1):
 *   position update first → gravity applied to velocity after.
 */
export function updatePlayer(dt) {
  const d = G.dino;
  d.ducking = G.duckHeld && !d.jumping;

  if (d.jumping) {
    // Step 1 — Apply velocity to position (reference: yPos += round(vel * [coeff] * frames))
    // speedDrop: multiply velocity by SPEED_DROP_COEFF in the position step only —
    // does NOT accumulate into vy, so releasing duck mid-air restores normal arc.
    const coeff = G.duckHeld ? SPEED_DROP_COEFF : 1.0;
    // Sub-pixel precision (no Math.round) avoids coarse position snapping during
    // descent — the renderer already floors to integers via `y | 0`, so there is
    // no visual jitter, but the collision check now uses the true float position.
    d.y += d.vy * coeff * dt;

    // Step 2 — Apply gravity to velocity (reference: jumpVelocity += gravity * frames)
    d.vy += GRAVITY * dt;

    // Step 3 — Check landing (reference: if yPos > groundYPos → reset)
    const land = GY - DINO_H;
    if (d.y >= land) {
      d.y       = land;
      d.vy      = 0;
      d.jumping = false;
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
  if (!G.dino.jumping && !G.dino.ducking) {
    G.dino.vy      = JUMP_V;
    G.dino.jumping = true;
    soundJump();
  }
}

export function startDuck(duckBtnEl) {
  G.duckHeld = true;
  initAudio();
  if (duckBtnEl) duckBtnEl.classList.add('active');
}

export function endDuck(duckBtnEl) {
  G.duckHeld = false;
  if (duckBtnEl) duckBtnEl.classList.remove('active');
}
