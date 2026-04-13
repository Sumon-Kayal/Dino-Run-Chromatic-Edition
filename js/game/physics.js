/* ═══════════════════════════════════════════════════════════
   physics.js — Collision detection

   Matches checkForCollision() reference (file 4) exactly:
     "const firstObstacle = this.horizon.obstacles[0]"
     → only the nearest (first) obstacle is checked.

   Two-pass AABB:
     Pass 1: outer whole-entity box (fast reject)
     Pass 2: inner hitboxes adjusted by world position
             (matches createAdjustedCollisionBox + boxCompare)
   ═══════════════════════════════════════════════════════════ */
'use strict';

import { DINO_W, DUCK_H, DINO_H, GY,
         HIT_DUCK_INSET_X, HIT_DUCK_INSET_W, HIT_DUCK_INSET_Y, HIT_DUCK_INSET_H,
         HIT_BODY_INSET_X, HIT_BODY_INSET_W, HIT_BODY_INSET_Y, HIT_BODY_INSET_H,
         HIT_HEAD_X, HIT_HEAD_Y, HIT_HEAD_W_INSET, HIT_HEAD_H,
         HIT_OBS_SHRINK } from './config.js';
import { G } from './runtime.js';

/**
 * AABB overlap — matches boxCompare() reference (file 4).
 * Boxes: { x, y, w, h }
 */
function boxCompare(a, b) {
  return (
    a.x       < b.x + b.w &&
    a.x + a.w > b.x       &&
    a.y       < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Reusable temp boxes to avoid per-frame allocations
const tempBoxA = { x: 0, y: 0, w: 0, h: 0 };
const tempBoxB = { x: 0, y: 0, w: 0, h: 0 };

/**
 * Offset a local hitbox by entity world position into a target box.
 * Matches createAdjustedCollisionBox() reference but mutates target.
 */
function adjustBox(target, local, entity) {
  target.x = local.x + entity.x;
  target.y = local.y + entity.y;
  target.w = local.w;
  target.h = local.h;
}

/**
 * Two-pass collision against obstacles[0] only — matches reference.
 * @returns {boolean}
 */
export function checkCollision() {
  if (G.obstacles.length === 0) return false;

  // Reference: "const firstObstacle = this.horizon.obstacles[0]"
  const o = G.obstacles[0];
  if (!o) return false;

  const dh = G.dino.ducking ? DUCK_H : DINO_H;

  // Adjust dino Y position based on height when not jumping
  // (matches updatePlayer behavior: d.y = GY - (d.ducking ? DUCK_H : DINO_H))
  const dy = G.dino.jumping ? G.dino.y : (G.dino.y + (DINO_H - dh));

  // ── Pass 1: outer AABB (fast reject) ────────────────────
  const dinoOuter = { x: G.dino.x, y: dy, w: DINO_W,  h: dh  };
  const obsOuter  = { x: o.x,      y: o.y,      w: o.w,     h: o.h };
  if (!boxCompare(dinoOuter, obsOuter)) return false;

  // ── Pass 2: inner per-hitbox AABB ───────────────────────
  // Dino inner boxes: ducking → one wide low box;
  //                   running → body box + head/neck box.
  //
  // Body bottom raised by 8 px vs the original y+40 floor: the sprite's leg
  // pixels are transparent below ~y+32, so the old box caused collisions to
  // fire while the dino was still visually above the cactus top on descent.
  const dinoBoxes = G.dino.ducking
    ? [{ x: HIT_DUCK_INSET_X, y: HIT_DUCK_INSET_Y, w: DINO_W - HIT_DUCK_INSET_W, h: dh - HIT_DUCK_INSET_H }]  // duck body
    : [
        { x: HIT_BODY_INSET_X, y: HIT_BODY_INSET_Y, w: DINO_W - HIT_BODY_INSET_W, h: dh - HIT_BODY_INSET_H }, // body
        { x: HIT_HEAD_X, y: HIT_HEAD_Y, w: DINO_W - HIT_HEAD_W_INSET, h: HIT_HEAD_H }, // head/neck
      ];

  // Obstacle inner box — shrunk 8 px per side (was 5 px).
  // Combined with the tighter dino body this gives ~17 px of extra forgiveness
  // on descent without affecting ground-level run-into collisions.
  const obsBoxes = [{
    x: HIT_OBS_SHRINK, y: HIT_OBS_SHRINK,
    w: Math.max(1, o.w - HIT_OBS_SHRINK * 2),
    h: Math.max(1, o.h - HIT_OBS_SHRINK * 2),
  }];

  for (const db of dinoBoxes) {
    adjustBox(tempBoxA, db, G.dino);
    for (const ob of obsBoxes) {
      adjustBox(tempBoxB, ob, o);
      if (boxCompare(tempBoxA, tempBoxB)) return true;
    }
  }

  return false;
}