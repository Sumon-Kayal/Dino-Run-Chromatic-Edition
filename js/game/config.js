/* ═══════════════════════════════════════════════════════════
   config.js — Static world constants and tunable CONFIG
   Populated from data/config.json at boot via applyJSONConfig().
   ═══════════════════════════════════════════════════════════ */
'use strict';

// World dimensions (canvas intrinsic pixels — 854×480, 16:9)
export const W  = 854;
export const H  = 480;
export const GY = 360;   // ground Y (75% of H)

// Physics defaults — may be overridden by data/config.json
export let GRAVITY          = 0.48;
export let JUMP_V           = -12.2;
export const SPEED_DROP_COEFF = 3.0;   // fast-fall multiplier

// Dino dimensions
export const DINO_W = 44;
export const DINO_H = 52;
export const DUCK_H = 28;
export const DINO_X = 80;

// Pterodactyl dimensions (sprite bounding box)
export const PTERA_W = 44;
export const PTERA_H = 28;

// Pterodactyl flight-height presets (world Y positions)
export const PTERA_Y_LOW  = GY - 40;   // ground-skimmer
export const PTERA_Y_MID  = GY - 69;   // mid-air
export const PTERA_Y_HIGH = GY - 120;  // high flier

// Gap-based spawning constants
export const MIN_GAP_CACTUS  = 120;
export const MIN_GAP_PTERA   = 150;
export const MAX_GAP_COEFF   = 1.5;

// World population constants
export const CLOUD_COUNT = 5;
export const STAR_COUNT  = 60;

// Game loop timing
export const FRAME_MS  = 1000 / 60;  // milliseconds per 60 Hz frame
export const MAX_DT    = 3;           // dt clamp — prevents spiral-of-death after pauses

// Animation frame period (in dt units at 60 fps)
export const ANIM_PERIOD = 8;

// Ground texture scroll period (pixels)
export const GROUND_PERIOD = 30;

// HUD layout constants
export const HUD_SCORE_X  = W - 130;
export const HUD_HI_X     = W - 232;
export const HUD_FONT     = '12px "Press Start 2P", monospace';
export const HUD_Y        = 10;

// Obstacle intra-cactus gap (pixels between cactus columns in a cluster)
export const CACTUS_INTRA_GAP = 6;

// Gap coefficient range — grows from initial to 1.0 over GAP_COEFF_SCORE points
export const GAP_COEFF_INITIAL = 0.6;
export const GAP_COEFF_SCORE   = 3000; // score at which gap coefficient reaches 1.0

// Moon scroll / spawn constants
export const MOON_SCROLL_SPEED = 0.28;           // px per dt unit
export const MOON_SPAWN_MIN    = W * 0.72;        // leftmost spawn X
export const MOON_SPAWN_RNG    = W * 0.24;        // spawn X random range
export const MOON_CULL_MARGIN  = 32;              // px off-screen before wrap

// Cloud scroll constants
export const CLOUD_SPEED_FACTOR = 0.1;            // fraction of game speed clouds move at
export const CLOUD_CULL_X       = -200;           // off-left cull threshold
export const CLOUD_SPAWN_X      = 50;             // respawn distance past right edge

// Obstacle off-screen cull threshold (px past left edge before removal)
export const OBS_CULL_MARGIN   = 120;
// Frames before the first obstacle spawns at game start
export const STARTUP_COOLDOWN  = 95;

// Cloud spawn geometry
export const CLOUD_Y_MIN    = 40;    // px from top of canvas
export const CLOUD_Y_RNG    = 60;    // random range added to Y_MIN
export const CLOUD_W_MIN    = 60;    // minimum cloud width
export const CLOUD_W_RNG    = 80;    // random range added to W_MIN
export const CLOUD_SP_MIN   = 0.4;   // minimum cloud scroll speed multiplier
export const CLOUD_SP_RNG   = 0.3;   // random range added to SP_MIN

// Star spawn geometry
export const STAR_Y_MARGIN  = 50;    // px clearance above ground line (GY)

// Ground scroll speed as a fraction of game speed
export const GROUND_SCROLL_FACTOR = 0.3;

// Tunable CONFIG — physics/game scalars loaded from data/config.json
export const CONFIG = {
  SPEED_MIN:     5,
  SPEED_MAX:     13,
  ACCELERATION:  0.0015,
  SCORE_COEFF:   0.04,
  // Day/night cycle
  DAY_START_SCORE:  700,    // score at which the night cycle begins
  DAY_CYCLE_SPEED:  0.002,  // dayPhase increment per dt unit
  // Pterodactyls
  PTERA_CHANCE:  0.22,
  PTERA_SCORE:   700,
  // Cactus shape
  CACTUS_H_MIN:  40,
  CACTUS_H_RNG:  34,
  CACTUS_W_MIN:  16,
  CACTUS_W_RNG:  12,
  CACTUS_TRIPLE: 0.08,
  CACTUS_DBL:    0.32,
};

// Draw colour palette — mutated by renderer on dayPhase change
export const C = {
  cloud:   '#e0e0e0',
  dino:    '#535353',
  dinoAcc: '#404040',
  eye:     '#ffffff',
  cactus:  '#535353',
  ptera:   '#535353',
};

// Palette cache
export const _pal = { bgC: '', fgC: '', fgDark: '', dimC: '' };
export let _lastDayPhase = -1;
export function setLastDayPhase(v) { _lastDayPhase = v; }

// Reusable hitbox objects (no per-frame allocations)
export const _dinoBox = { x: 0, y: 0, w: DINO_W - 14, h: 0 };
export const _obsBox  = { x: 0, y: 0, w: 0, h: 0 };

/* ── Apply loaded JSON config ────────────────────────────── */
export function applyJSONConfig(json) {
  if (!json) return;

  if (json.physics) {
    // Gravity: validate numeric, enforce reasonable range [0.1, 2.0]
    if (json.physics.gravity !== undefined) {
      let g = Number(json.physics.gravity);
      if (typeof g === 'number' && !isNaN(g) && g >= 0.1 && g <= 2.0) {
        GRAVITY = g;
      } else {
        console.warn('[config] Invalid gravity value — ignoring:', json.physics.gravity);
      }
    }

    // Jump velocity: validate numeric, enforce reasonable range [-20, -5]
    if (json.physics.jumpVelocity !== undefined) {
      let jv = Number(json.physics.jumpVelocity);
      if (typeof jv === 'number' && !isNaN(jv) && jv >= -20 && jv <= -5) {
        JUMP_V = jv;
      } else {
        console.warn('[config] Invalid jumpVelocity value — ignoring:', json.physics.jumpVelocity);
      }
    }

    // Acceleration: validate numeric, enforce non-negative
    if (json.physics.acceleration !== undefined) {
      let acc = Number(json.physics.acceleration);
      if (typeof acc === 'number' && !isNaN(acc) && acc >= 0) {
        CONFIG.ACCELERATION = acc;
      } else {
        console.warn('[config] Invalid acceleration value — ignoring:', json.physics.acceleration);
      }
    }
  }

  if (json.game) {
    let minSpeed, maxSpeed;

    // Initial speed: validate numeric, enforce non-negative
    if (json.game.initialSpeed !== undefined) {
      minSpeed = Number(json.game.initialSpeed);
      if (typeof minSpeed === 'number' && !isNaN(minSpeed) && minSpeed >= 0) {
        CONFIG.SPEED_MIN = minSpeed;
      } else {
        console.warn('[config] Invalid initialSpeed value — ignoring:', json.game.initialSpeed);
        minSpeed = CONFIG.SPEED_MIN;
      }
    } else {
      minSpeed = CONFIG.SPEED_MIN;
    }

    // Max speed: validate numeric, enforce non-negative
    if (json.game.maxSpeed !== undefined) {
      maxSpeed = Number(json.game.maxSpeed);
      if (typeof maxSpeed === 'number' && !isNaN(maxSpeed) && maxSpeed >= 0) {
        CONFIG.SPEED_MAX = maxSpeed;
      } else {
        console.warn('[config] Invalid maxSpeed value — ignoring:', json.game.maxSpeed);
        maxSpeed = CONFIG.SPEED_MAX;
      }
    } else {
      maxSpeed = CONFIG.SPEED_MAX;
    }

    // Ensure initialSpeed <= maxSpeed; if not, swap or reject
    if (CONFIG.SPEED_MIN > CONFIG.SPEED_MAX) {
      console.warn('[config] initialSpeed > maxSpeed — swapping values');
      [CONFIG.SPEED_MIN, CONFIG.SPEED_MAX] = [CONFIG.SPEED_MAX, CONFIG.SPEED_MIN];
    }
  }
}

// ── Collision hitbox offsets (tuned to match sprite visual bounds) ────────────
// These are calibrated pixel values — changing them affects gameplay feel.
// Duck body: inset from sprite edges to match actual visible duck silhouette
export const HIT_DUCK_INSET_X  = 10;   // left inset
export const HIT_DUCK_INSET_W  = 22;   // total width reduction (left+right)
export const HIT_DUCK_INSET_Y  =  6;   // top inset
export const HIT_DUCK_INSET_H  = 14;   // total height reduction

// Run body box (lower region)
export const HIT_BODY_INSET_X  = 10;
export const HIT_BODY_INSET_W  = 22;
export const HIT_BODY_INSET_Y  =  6;
export const HIT_BODY_INSET_H  = 26;   // taller reduction — legs are transparent below ~y+32

// Head/neck box (upper region)
export const HIT_HEAD_X        = 16;
export const HIT_HEAD_Y        =  2;
export const HIT_HEAD_W_INSET  = 30;   // DINO_W - 30
export const HIT_HEAD_H        = 14;

// Obstacle inner-box shrink per side (forgiveness margin)
export const HIT_OBS_SHRINK    =  8;