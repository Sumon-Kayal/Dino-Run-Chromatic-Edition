/* ═══════════════════════════════════════════════════════════
   runtime.js — Mutable game state (G)
   All per-frame, per-session, and transient values live here.
   ═══════════════════════════════════════════════════════════ */
'use strict';

import { W } from './config.js';

export const G = {
  state:      'idle',   // 'idle' | 'running' | 'paused' | 'dead'
  score:      0,
  hiScore:    0,
  speed:      0,
  frameCount: 0,
  animFrame:  null,
  lastTime:   0,

  dino:          {},
  obstacles:     [],
  clouds:        [],
  stars:         [],
  obsCooldown:    0,
  gapCoefficient: 0.6,
  gameObstacles:  0,

  dayPhase:      0,
  moonX:         W * 0.72,
  groundScrollX: 0,
  playerName:        'ANON',
  paused:            false,
  pauseStartTime:    0,
  flashFrames:       0,
  lastMilestone:     0,
  gameStartWallTime: 0,

  duckHeld:          false,
  _lastHdrScore: '',
  _lastHdrHi:    '',
  _lastSpeedPct: -1,

  sessionStats: { games:0, deaths:0, obstacles:0, totalDist:0, bestScore:0, bestTime:0 },
  dbStats:      { games:0, deaths:0, obstacles:0, totalDist:0, bestScore:0, bestTime:0 },
};
