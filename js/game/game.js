/* ═══════════════════════════════════════════════════════════
   game.js — Barrel re-export for all game sub-modules.
   External tooling (tests, dev console) can import everything
   from this single entry point instead of individual files.
   ═══════════════════════════════════════════════════════════ */
'use strict';

export { Engine }                                        from './engine.js';
export { initRenderer, draw, rebuildSkyLayer }           from './renderer.js';
export { initPlayer, updatePlayer, tickIdleAnimation,
         jump, startDuck, endDuck }                      from './player.js';
export { initObstacles, updateObstacles, spawnObstacle } from './obstacles.js';
export { checkCollision }                                from './physics.js';
export { setupInput, teardownInput }                     from './input.js';
export { initAudio, soundJump, soundDie, soundMilestone,
         cancelSoundTimers, getSoundMuted, setSoundMuted,
         applyAudioConfig }                              from './audio.js';
export { CONFIG, W, H, GY,
         DINO_W, DINO_H, DUCK_H, DINO_X,
         applyJSONConfig, applyObstaclesConfig }          from './config.js';
export { G }                                             from './runtime.js';

