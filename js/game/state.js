/* ═══════════════════════════════════════════════════════════
   state.js — Compatibility shim (DEPRECATED)
   This file is kept only for backwards compatibility.
   Import directly from config.js and runtime.js instead.
   ═══════════════════════════════════════════════════════════ */
'use strict';

export {
  W, H, GY,
  GRAVITY, JUMP_V, SPEED_DROP_COEFF,
  DINO_W, DINO_H, DUCK_H, DINO_X,
  MIN_GAP_CACTUS, MIN_GAP_PTERA, MAX_GAP_COEFF,
  CONFIG,
  C, _pal, _lastDayPhase, setLastDayPhase,
  _dinoBox, _obsBox,
} from './config.js';

export { G } from './runtime.js';
