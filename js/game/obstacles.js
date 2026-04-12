/* ═══════════════════════════════════════════════════════════
   obstacles.js — Cactus / Pterodactyl spawning and movement

   Spawning logic matches Chrome references exactly:
     File 2 — Horizon.updateObstacles():
       spawn when: lastObs.x + lastObs.w + lastObs.gap < canvasWidth
       flag:       lastObs.followingObstacleCreated = true  (prevents double-spawn)
     File 3 — Obstacle.getGap():
       minGap = round(width * speed + typeConfig.minGap * gapCoefficient)
       maxGap = round(minGap * maxGapCoefficient)
       gap    = random(minGap, maxGap)
   ═══════════════════════════════════════════════════════════ */
'use strict';

import {
  W, GY, CONFIG,
  MIN_GAP_CACTUS, MIN_GAP_PTERA, MAX_GAP_COEFF,
  DINO_X,
  PTERA_W, PTERA_H,
  PTERA_Y_LOW, PTERA_Y_MID, PTERA_Y_HIGH,
  CACTUS_INTRA_GAP,
  ANIM_PERIOD,
  OBS_CULL_MARGIN,
  STARTUP_COOLDOWN,
} from './config.js';
import { G } from './runtime.js';

// Startup cooldown imported from config.js as STARTUP_COOLDOWN

/**
 * Calculate gap for an obstacle — matches Obstacle.getGap() reference (file 3).
 * minGap = round(obsWidth * speed + typeMinGap * gapCoefficient)
 * maxGap = round(minGap * MAX_GAP_COEFF)
 * result = random(minGap, maxGap)
 */
function calcGap(obsWidth, typeMinGap) {
  const minGap = Math.round(obsWidth * G.speed + typeMinGap * G.gapCoefficient);
  const maxGap = Math.round(minGap * MAX_GAP_COEFF);
  return minGap + Math.floor(Math.random() * (maxGap - minGap + 1));
}

/**
 * Spawn a cactus or pterodactyl at the right edge.
 * Each obstacle carries a pre-calculated .gap and .followingCreated flag.
 */
export function spawnObstacle() {
  const isPtera = Math.random() < CONFIG.PTERA_CHANCE && G.score > CONFIG.PTERA_SCORE;

  if (!isPtera) {
    const h       = CONFIG.CACTUS_H_MIN + Math.floor(Math.random() * CONFIG.CACTUS_H_RNG);
    const singleW = CONFIG.CACTUS_W_MIN + Math.floor(Math.random() * CONFIG.CACTUS_W_RNG);
    const cl      = Math.random() < CONFIG.CACTUS_TRIPLE ? 3
                  : Math.random() < CONFIG.CACTUS_DBL    ? 2 : 1;
    const INTRA   = CACTUS_INTRA_GAP;
    const totalW  = singleW * cl + INTRA * (cl - 1);
    G.obstacles.push({
      type: 'cactus',
      x: W + 10, y: GY - h,
      w: totalW, h,
      count: cl, singleW,
      gap: calcGap(totalW, MIN_GAP_CACTUS),
      passed: false, followingCreated: false,
    });
  } else {
    const hs = [PTERA_Y_LOW, PTERA_Y_HIGH, PTERA_Y_MID];
    G.obstacles.push({
      type: 'ptera',
      x: W + 10,
      y: hs[Math.floor(Math.random() * 3)],
      w: PTERA_W, h: PTERA_H,
      frame: 0, ft: 0,
      gap: calcGap(PTERA_W, MIN_GAP_PTERA),
      passed: false, followingCreated: false,
    });
  }
}

/**
 * Move obstacles, animate pteras, spawn next via gap-position check.
 * Matches Horizon.updateObstacles() reference (file 2).
 */
export function updateObstacles(dt) {
  // ── Move + animate ───────────────────────────────────────
  for (let i = 0; i < G.obstacles.length; i++) {
    const o = G.obstacles[i];
    o.x -= G.speed * dt;
    if (o.type === 'ptera') {
      o.ft += dt;
      if (o.ft > ANIM_PERIOD) { o.ft = 0; o.frame = (o.frame + 1) % 2; }
    }
  }

  // ── Spawn logic ──────────────────────────────────────────
  if (G.obstacles.length === 0) {
    // No obstacles yet — count down startup cooldown
    G.obsCooldown -= dt;
    if (G.obsCooldown <= 0) spawnObstacle();
  } else {
    // Gap-based spawn — matches reference:
    // "if (lastObstacle.xPos + lastObstacle.width + lastObstacle.gap) < canvasWidth"
    const last = G.obstacles[G.obstacles.length - 1];
    if (!last.followingCreated &&
        (last.x + last.w + last.gap) < W) {
      spawnObstacle();
      last.followingCreated = true;   // matches followingObstacleCreated flag
    }
  }

  // ── Track passed ─────────────────────────────────────────
  for (let i = 0; i < G.obstacles.length; i++) {
    const o = G.obstacles[i];
    if (!o.passed && o.x + o.w < DINO_X) {
      o.passed = true;
      G.sessionStats.obstacles++;
      G.gameObstacles++;
    }
  }

  // ── Remove off-screen ────────────────────────────────────
  for (let i = G.obstacles.length - 1; i >= 0; i--) {
    if (G.obstacles[i].x <= -OBS_CULL_MARGIN) G.obstacles.splice(i, 1);
  }
}

/**
 * Reset obstacle state for a new run.
 */
export function initObstacles() {
  G.obstacles     = [];
  G.gameObstacles = 0;
  G.obsCooldown   = STARTUP_COOLDOWN;
}
