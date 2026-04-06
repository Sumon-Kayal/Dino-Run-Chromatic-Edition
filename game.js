/* ═══════════════════════════════════════════════════════════
   DINO RUN — CHROMATIC EDITION
   game.js — Game engine, rendering, input, UI

   Depends on (must be loaded first):
     db.js  → window.DB
   ═══════════════════════════════════════════════════════════ */
'use strict';

/* Guard then alias so all DB.x() calls below are consistent */
if (typeof window.DB === 'undefined') {
  throw new Error('game.js: window.DB not found — load db.js before game.js');
}
const DB = window.DB;

/* ───────────────────────────────────────────────────────────
   DOM VALIDATION
   Verify all required elements exist before the game touches
   the DOM. Throws a descriptive error during development.
   ─────────────────────────────────────────────────────────── */
(function validateDOM() {
  const required = [
    'gameCanvas',    'gameFrame',
    'startScreen',   'gameOverScreen', 'pauseScreen',
    'go-score',      'go-hi',          'go-newbest',
    'restartBtn',    'jumpBtn',         'duckBtn',
    'pauseBtn',      'muteBtn',         'fullscreenBtn',
    'hdr-score',     'hdr-hi',          'speed-fill',
    'db-status',
    'stat-games',    'stat-best',       'stat-time',
    'stat-obs',      'stat-deaths',     'stat-dist',
    'lbBody',        'nameInput',       'nameSaveBtn',
    'currentName',   'clearLbBtn',      'resetHiBtn'
  ];
  const missing = required.filter(function (id) {
    return !document.getElementById(id);
  });
  if (missing.length) {
    throw new Error(
      'game.js: required DOM element(s) missing — check index.html\n' +
      'Missing IDs: ' + missing.join(', ')
    );
  }
}());

/* ───────────────────────────────────────────────────────────
   DOM ELEMENT CACHE
   Cache every element touched at runtime once at startup.
   Eliminates getElementById() from the hot game loop.
   ─────────────────────────────────────────────────────────── */
const DOM = {
  /* Canvas */
  gameCanvas:     document.getElementById('gameCanvas'),
  /* Header HUD — written every frame */
  hdrScore:       document.getElementById('hdr-score'),
  hdrHi:          document.getElementById('hdr-hi'),
  speedFill:      document.getElementById('speed-fill'),
  /* Storage badge */
  dbStatus:       document.getElementById('db-status'),
  /* Overlays */
  startScreen:    document.getElementById('startScreen'),
  gameOverScreen: document.getElementById('gameOverScreen'),
  pauseScreen:    document.getElementById('pauseScreen'),
  goScore:        document.getElementById('go-score'),
  goHi:           document.getElementById('go-hi'),
  goNewBest:      document.getElementById('go-newbest'),
  /* Buttons */
  restartBtn:     document.getElementById('restartBtn'),
  pauseBtn:       document.getElementById('pauseBtn'),
  muteBtn:        document.getElementById('muteBtn'),
  fullscreenBtn:  document.getElementById('fullscreenBtn'),
  duckBtn:        document.getElementById('duckBtn'),
  jumpBtn:        document.getElementById('jumpBtn'),
  gameFrame:      document.getElementById('gameFrame'),
  /* Player / leaderboard */
  currentName:    document.getElementById('currentName'),
  nameInput:      document.getElementById('nameInput'),
  nameSaveBtn:    document.getElementById('nameSaveBtn'),
  clearLbBtn:     document.getElementById('clearLbBtn'),
  resetHiBtn:     document.getElementById('resetHiBtn'),
  lbBody:         document.getElementById('lbBody'),
  /* Stats panel */
  statGames:      document.getElementById('stat-games'),
  statBest:       document.getElementById('stat-best'),
  statTime:       document.getElementById('stat-time'),
  statObs:        document.getElementById('stat-obs'),
  statDeaths:     document.getElementById('stat-deaths'),
  statDist:       document.getElementById('stat-dist'),
};

/* Update the DB status badge */
DOM.dbStatus.textContent = DB.backendName;

/* Listen for quota updates from db.js and show usage in badge */
window.addEventListener('db:quota', function (e) {
  let used   = e.detail.used;
  let total  = e.detail.total;
  let pct    = total > 0 ? ((used / total) * 100).toFixed(1) : '?';
  let usedKB = (used / 1024).toFixed(0);
  DOM.dbStatus.textContent = DB.backendName + ' \xB7 ' + usedKB + 'KB (' + pct + '%)';
  DOM.dbStatus.style.removeProperty('color');   // clear danger colour if storage freed up
});

/* Show quota full warning if a write fails */
window.addEventListener('db:quotaFull', function () {
  DOM.dbStatus.textContent = 'STORAGE FULL \u26A0';
  DOM.dbStatus.style.setProperty('color', 'var(--danger)');
});

/* Show a prominent modal when pruning fallback fails */
window.addEventListener('db:criticalFailure', function () {
  DOM.dbStatus.textContent = 'STORAGE FULL \u26A0 \u2014 Score not saved';
  DOM.dbStatus.style.setProperty('color', 'var(--danger)');
  alert(
    '\u26A0\uFE0F  STORAGE FULL\n\n' +
    'Your score could not be saved because your browser\u2019s ' +
    'local storage is completely full.\n\n' +
    'To fix this:\n' +
    '  1. Clear browser data for this site\n' +
    '  2. Click \u201CCLEAR\u201D to wipe the leaderboard\n' +
    '  3. Close other tabs and try again'
  );
});

/* ───────────────────────────────────────────────────────────
   CANVAS + CONSTANTS
   ─────────────────────────────────────────────────────────── */
const canvas = DOM.gameCanvas;
const ctx    = canvas.getContext('2d');

/* Sky layer optimisation — OffscreenCanvas bakes the static sky
   (background fill + horizon line + stars) once per dayPhase change instead
   of redrawing them every frame. */
let skyCanvas = null;
let skyCtx    = null;

if (!ctx) {
  throw new Error(
    'game.js: canvas 2D context unavailable. ' +
    'Hardware acceleration may be disabled, or the browser context is restricted.'
  );
}

// World dimensions (canvas intrinsic pixels — 854×480, 16:9)
const W  = 854;   // canvas width
const H  = 480;   // canvas height
const GY = 360;   // ground Y position (75% of H)

// Physics
const GRAVITY = 0.55;
const JUMP_V  = -11.5;

// Dino dimensions
const DINO_W = 44;
const DINO_H = 52;
const DUCK_H = 28;   // height when ducking
const DINO_X = 80;   // fixed horizontal position

/* ───────────────────────────────────────────────────────────
   TUNING CONFIG — all magic numbers in one place
   Change values here to adjust difficulty, spawn rates, etc.
   ─────────────────────────────────────────────────────────── */
const CONFIG = {
  // Speed values derived from original Chrome Dino (Chromium source)
  SPEED_MIN:    6,     // starting speed
  SPEED_MAX:    13,    // terminal speed
  PTERA_CHANCE: 0.28,  // probability of pterodactyl vs cactus
  PTERA_SCORE:  900,   // score before pteras appear
  CACTUS_H_MIN: 40,    // cactus minimum height (px)
  CACTUS_H_RNG: 38,    // cactus height random range added to min
  CACTUS_W_MIN: 16,    // cactus minimum stem width
  CACTUS_W_RNG: 14,    // cactus width random range
  CACTUS_TRIPLE: 0.12, // probability of triple-cactus cluster
  CACTUS_DBL:   0.35,  // probability of double-cactus cluster
  OBS_CD_INIT:  60,    // initial obstacle cooldown (frames)
};

// Draw colour palette — recalculated each frame in draw()
// Day:  white bg / #535353 fg
// Night:#404040 bg / #f0f0f0 fg
const C = {
  cloud:   '#e0e0e0',
  dino:    '#535353',
  dinoAcc: '#404040',
  eye:     '#ffffff',
  cactus:  '#535353',
  ptera:   '#535353'
};

/* Pixel-fill shorthand */
/**
 * Pixel-fill shorthand — fills a rectangle on the canvas.
 * @param {string} color - CSS colour string
 * @param {number} x - Left edge (floored)
 * @param {number} y - Top edge (floored)
 * @param {number} w - Width in pixels
 * @param {number} h - Height in pixels
 */
function px(color, x, y, w, h) {
  setFill(color);
  ctx.fillRect(x|0, y|0, w, h);
}

/* Linear interpolation */
/**
 * Linear interpolation between two numbers.
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Blend factor [0..1]
 * @returns {number}
 */
function lerp(a, b, t) { return a + (b - a) * t; }

/* Interpolate between two #rrggbb hex colours */
/**
 * Interpolates between two #rrggbb hex colors.
 * @param {string} ca - Start color (e.g. "#ffffff").
 * @param {string} cb - End color.
 * @param {number} t - Blend factor between 0 and 1.
 * @returns {string} An `rgb(r,g,b)` CSS color string representing the blended color.
 */
function lerpRGB(ca, cb, t) {
  let pa = parseInt(ca.slice(1), 16);
  let pb = parseInt(cb.slice(1), 16);
  let r  = (lerp((pa >> 16) & 0xff, (pb >> 16) & 0xff, t)) | 0;
  let g  = (lerp((pa >>  8) & 0xff, (pb >>  8) & 0xff, t)) | 0;
  let bl = (lerp( pa        & 0xff,  pb        & 0xff, t)) | 0;
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

/* ───────────────────────────────────────────────────────────
   PALETTE CACHE & FILL-STYLE DEDUP
   lerpRGB() parses hex and does float arithmetic 4× per frame.
   Cache the results and skip recomputation when dayPhase is
   the same as last frame.
   ─────────────────────────────────────────────────────────── */
let _lastFill     = '';       // tracks current ctx.fillStyle to skip redundant sets
let _lastDayPhase = -1;       // sentinel: -1 forces first-frame palette build
const _pal = { bgC: '', fgC: '', fgDark: '', dimC: '' };

/**
 * Update the canvas 2D context's fill style only when the provided color differs from the last applied color.
 * @param {string} color - CSS color string to apply to ctx.fillStyle.
 */
function setFill(color) {
  if (color !== _lastFill) { ctx.fillStyle = color; _lastFill = color; }
}

/**
 * Draws and caches the static sky background onto the offscreen sky canvas.
 *
 * Uses the current palette and `dayPhase` to render the sky fill, a horizon line, and stars.
 * Stars are rendered only when `dayPhase > 0.1` with their alpha scaled by `dayPhase`.
 *
 * No-op when the offscreen sky context or palette is not available.
 */
function redrawSkyLayer() {
  if (!skyCtx || !_pal.bgC) return;
  skyCtx.clearRect(0, 0, W, H);
  
  // Sky background
  skyCtx.fillStyle = _pal.bgC;
  skyCtx.fillRect(0, 0, W, H);
  
  // Horizon line
  skyCtx.fillStyle = _pal.fgC;
  skyCtx.fillRect(0, GY, W, 2);
  
  // Stars
  if (dayPhase > 0.1) {
    skyCtx.globalAlpha = dayPhase * 0.6;
    skyCtx.fillStyle   = _pal.fgDark;
    stars.forEach(function (s) { skyCtx.fillRect(s.x, s.y, s.r, s.r); });
    skyCtx.globalAlpha = 1;
  }
}

/* ───────────────────────────────────────────────────────────
   REUSABLE HITBOX OBJECTS
   Mutating fixed objects eliminates per-frame allocations.
   ─────────────────────────────────────────────────────────── */
const _dinoBox = { x: 0, y: 0, w: DINO_W - 14, h: 0 };
const _obsBox  = { x: 0, y: 0, w: 0, h: 0 };

/* ───────────────────────────────────────────────────────────
   GAME STATE
   ─────────────────────────────────────────────────────────── */
let state      = 'idle';   // 'idle' | 'running' | 'dead'
let score      = 0;
let hiScore    = 0;
let speed      = 0;
let frameCount = 0;
let animFrame  = null;
let lastTime   = 0;

let dino        = {};
let obstacles   = [];
let clouds      = [];
let stars       = [];
let obsCooldown = 0;

let dayPhase   = 0;    // 0 = full day, 1 = full night

let duckHeld   = false;
let playerName = 'ANON';

// ── Moon ───────────────────────────────────────────────────
// Scrolls slowly from right to left; wraps.
let moonX      = W * 0.72;

// ── Pause ──────────────────────────────────────────────────
let paused         = false;
let pauseStartTime = 0;   

// ── Score milestone flash (every 100 pts) ─────────────────
let flashFrames   = 0;
let lastMilestone = 0;

// HUD textContent dedup — skip DOM write when displayed string is unchanged
let _lastHdrScore = '';
let _lastHdrHi    = '';

// Speed bar dedup — skip style.width write when percentage hasn't changed
let _lastSpeedPct = -1;

// Wall-clock game start time for accurate bestTime at any refresh rate.
let gameStartWallTime = 0;

// Accumulated ground scroll offset
let groundScrollX = 0;

// ── Web Audio ─────────────────────────────────────────────
const AudioCtxCtor = window.AudioContext || window.webkitAudioContext;
let audioCtx     = null;
let soundMuted   = false;

// Track pending sound setTimeout IDs so they can be cancelled 
// on restart, preventing stale sounds.
let _soundTimers = [];

/**
 * Schedule a sound callback to run after the given delay and track its timeout ID for later cancellation.
 * @param {Function} fn - The callback to invoke when the timer fires.
 * @param {number} delay - Delay in milliseconds before invoking `fn`.
 */
function _scheduleSound(fn, delay) {
  _soundTimers.push(setTimeout(fn, delay));
}
function _cancelSoundTimers() {
  _soundTimers.forEach(function (id) { clearTimeout(id); });
  _soundTimers = [];
}

function initAudio() {
  if (audioCtx || !AudioCtxCtor) return;
  try { audioCtx = new AudioCtxCtor(); } catch(e) { audioCtx = null; }
}
function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
}
function playBeep(freq, type, dur, vol, endF) {
  if (soundMuted || !audioCtx) return;
  resumeAudio();
  try {
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = type || 'square';
    let t = audioCtx.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    if (endF) osc.frequency.exponentialRampToValueAtTime(endF, t + dur);
    gain.gain.setValueAtTime(vol || 0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
  } catch(e) { console.warn('[Audio] playBeep failed:', e); }
}
function soundJump() { playBeep(400, 'square', 0.12, 0.07, 880); }
function soundDie() {
  playBeep(440, 'square', 0.10, 0.08);
  _scheduleSound(function () { playBeep(220, 'square', 0.18, 0.07); }, 90);
}
/**
 * Play a three-note ascending milestone chime.
 *
 * Plays an immediate short beep, then schedules two additional ascending beeps at 70ms intervals.
 */
function soundMilestone() {
  playBeep(660, 'square', 0.07, 0.07);
  _scheduleSound(function () { playBeep(880,  'square', 0.07, 0.07); }, 70);
  _scheduleSound(function () { playBeep(1100, 'square', 0.12, 0.07); }, 140);
}

const sessionStats = { games:0, deaths:0, obstacles:0, totalDist:0, bestScore:0, bestTime:0 };
let dbStats      = { games:0, deaths:0, obstacles:0, totalDist:0, bestScore:0, bestTime:0 };  
let gameObstacles = 0; 

/* ───────────────────────────────────────────────────────────
   INITIALISE / RESET
   ─────────────────────────────────────────────────────────── */
/**
 * Initialize and reset all runtime game state to start a new run.
 *
 * Resets scores, speed, timers, counters, and simulation entities (dino, obstacles, clouds, stars),
 * cancels pending sound timers, randomizes moon and ambient positions, and recreates the offscreen
 * sky canvas so the baked sky (horizon and stars) is regenerated for the new game.
 */
function initGame() {
  _cancelSoundTimers();
  score      = 0;
  speed      = CONFIG.SPEED_MIN;

  // Chrome-like day start
  dayPhase = 0;
  frameCount = 0;
  obstacles  = [];
  obsCooldown = CONFIG.OBS_CD_INIT;
  gameObstacles = 0;   
  flashFrames   = 0;
  lastMilestone = 0;
  groundScrollX = 0;   
  _lastSpeedPct = -1;  
  moonX = W * 0.72 + Math.random() * W * 0.24;  // randomise start position

  dino = {
    x: DINO_X, y: GY - DINO_H,
    vy: 0, jumping: false, ducking: false,
    frame: 0, ft: 0
  };

  clouds = [];
  for (let i = 0; i < 5; i++) {
    clouds.push({
      x:  Math.random() * W,
      y:  40 + Math.random() * 60,
      w:  60 + Math.random() * 80,
      sp: 0.4 + Math.random() * 0.3
    });
  }

  stars = [];
  for (let j = 0; j < 60; j++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * (GY - 50),
      r: Math.random() < 0.1 ? 2 : 1
    });
  }

  // (re)create the sky OffscreenCanvas on each new game so star positions
  // are baked in on the first draw call.
  skyCanvas = document.createElement('canvas');
  skyCanvas.width  = W;
  skyCanvas.height = H;
  skyCtx = skyCanvas.getContext('2d', { alpha: false });
  redrawSkyLayer();

}

/* ───────────────────────────────────────────────────────────
   PLAYER ACTIONS
   ─────────────────────────────────────────────────────────── */
/**
 * Handle a jump action from keyboard, touch, or click.
 * Also acts as the start/restart trigger when in idle/dead states.
 */
function jump() {
  if (state === 'paused') return;   // ignore input while paused
  initAudio();
  if (state === 'idle') { startGame(); return; }
  if (state === 'dead') { restart();   return; }
  if (!dino.jumping && !dino.ducking) {
    dino.vy      = JUMP_V;
    dino.jumping = true;
    soundJump();
  }
}

function startDuck() {
  duckHeld = true;
  initAudio();
  let b = DOM.duckBtn;
  if (b) b.classList.add('active');
}
function endDuck() {
  duckHeld = false;
  let b = DOM.duckBtn;
  if (b) b.classList.remove('active');
}

/**
 * Toggle the game's paused state, updating UI, timers, and the animation loop.
 *
 * When called while the game is `'running'`, pauses the run: records pause start time,
 * cancels the animation frame, displays the pause screen, and updates pause button state.
 * When called while the game is `'paused'`, resumes the run: adjusts the stored run start
 * time to exclude the paused duration, hides the pause screen, and restarts the animation loop.
 * Calling this function has no effect if the global `state` is neither `'running'` nor `'paused'`.
 *
 * Also ensures the audio subsystem is initialized before changing pause state.
 */
function togglePause() {
  if (state !== 'running' && state !== 'paused') return;
  initAudio();
  if (!paused) {
    paused = true;
    state  = 'paused';
    pauseStartTime = performance.now();
    cancelAnimationFrame(animFrame);
    DOM.pauseScreen.classList.remove('hidden');
    DOM.pauseBtn.classList.add('active');
    DOM.pauseBtn.setAttribute('aria-pressed', 'true');
  } else {
    paused = false;
    state  = 'running';
    // Offset the wall-clock start time by the duration spent paused so
    // gameOver() doesn't count pause time toward the run's elapsed seconds.
    gameStartWallTime += (performance.now() - pauseStartTime);
    lastTime = 0;
    DOM.pauseScreen.classList.add('hidden');
    DOM.pauseBtn.classList.remove('active');
    DOM.pauseBtn.setAttribute('aria-pressed', 'false');
    animFrame = requestAnimationFrame(loop);
  }
}

/**
 * Toggles the document between fullscreen and normal display.
 *
 * If the document is not currently fullscreen, requests fullscreen on the
 * documentElement; if it is fullscreen, exits fullscreen. Errors from the
 * fullscreen request are caught and logged to the console when supported.
 */
function toggleFullscreen() {
  let el = document.documentElement;
  let isFs = document.fullscreenElement || document.webkitFullscreenElement;
  if (!isFs) {
    // requestFullscreen() returns a Promise in modern browsers but undefined
    // in older Webkit — guard before calling .catch().
    let req = el.requestFullscreen
      ? el.requestFullscreen()
      : el.webkitRequestFullscreen
        ? el.webkitRequestFullscreen()
        : null;
    if (req && req.catch) {
      req.catch((err) => {
        console.warn('[Fullscreen] Request failed:', err);
      });
    }
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}

/**
 * Sync the fullscreen button's label and active state with the document's fullscreen status.
 *
 * Updates the button text to "EXIT FS" when fullscreen is active, otherwise "FULL", and toggles the button's "active" CSS class. Does nothing if the fullscreen button is not present.
 */
function onFullscreenChange() {
  let btn = DOM.fullscreenBtn;
  if (!btn) return;
  let isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  btn.textContent = isFs ? 'EXIT FS' : 'FULL';
  btn.classList.toggle('active', isFs);
}

document.addEventListener('fullscreenchange',       onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

/**
 * Start a new game run and enter the running state.
 *
 * Resets pause and timing state, records the wall-clock start time, reinitializes
 * run-specific game state, hides the start and game-over screens, and begins
 * the main animation loop.
 */
function startGame() {
  cancelAnimationFrame(animFrame);
  paused            = false;
  lastTime          = 0;
  gameStartWallTime = performance.now();
  state             = 'running';
  initGame();
  DOM.startScreen.classList.add('hidden');
  DOM.gameOverScreen.classList.add('hidden');
  animFrame = requestAnimationFrame(loop);
}

/**
 * Restart the current run by reinitializing game state and starting the main loop.
 *
 * Cancels any pending animation frame, resets pause and timing state, reinitializes runtime
 * data via initGame(), hides the game-over screen, and schedules the next animation frame.
 */
function restart() {
  cancelAnimationFrame(animFrame);
  paused            = false;
  lastTime          = 0;
  gameStartWallTime = performance.now();
  state             = 'running';
  initGame();
  DOM.gameOverScreen.classList.add('hidden');
  animFrame = requestAnimationFrame(loop);
}

/**
 * End the current run: mark the game as dead, record and persist run statistics, update leaderboard, and show the game-over UI.
 *
 * Increments session and persistent counters (games, deaths, distance, obstacles), updates best score/time, attempts to add the score to the leaderboard, and saves stats. If leaderboard insertion fails due to storage quota, restores the previous persisted best-score and updates the DB status indicator. Plays the death sound and reveals the game-over screen (including the "NEW BEST" banner when appropriate) and refreshes on-screen stat displays and leaderboard rendering.
 */
function gameOver() {
  if (state === 'dead') return;
  state = 'dead';
  soundDie();

  // Cache the user's actual previous best in case of quota rollback
  let prevSessionBest = dbStats.bestScore;

  sessionStats.games++;
  sessionStats.deaths++;
  let s = Math.floor(score);
  if (s > sessionStats.bestScore) sessionStats.bestScore = s;
  sessionStats.totalDist += s;
  
  let thisTime = Math.floor((performance.now() - gameStartWallTime) / 1000);
  if (thisTime > sessionStats.bestTime) sessionStats.bestTime = thisTime;

  // Capture previous best before updating so we can show NEW BEST banner
  let prevBest = Math.max(hiScore, dbStats.bestScore);
  if (s > hiScore) hiScore = s;

  dbStats.games++;
  dbStats.deaths++;
  dbStats.totalDist  += s;
  dbStats.obstacles  += gameObstacles;
  if (s > dbStats.bestScore) dbStats.bestScore = s;
  if (thisTime > (dbStats.bestTime || 0)) dbStats.bestTime = thisTime;

  // Write leaderboard BEFORE committing stats.
  // If addScore() fails (quota full) roll back dbStats.bestScore
  let lb = DB.addScore(playerName, s);
  if (lb) {
    DB.saveStats(dbStats);
    renderLeaderboard(lb);
  } else {
    // Leaderboard write failed — revert bestScore to the user's actual previous best
    let existingLb = DB.getLeaderboard();
    dbStats.bestScore = prevSessionBest;
    DB.saveStats(dbStats);
    console.warn('[Game] Score not saved — storage full');
    renderLeaderboard(existingLb);
    DOM.dbStatus.textContent = 'STORAGE FULL \u26A0 \u2014 Score not saved';
    DOM.dbStatus.style.setProperty('color', 'var(--danger)');
  }
  updateStatUI();

  DOM.goScore.textContent =
    'SCORE ' + String(s).padStart(5, '0');
  DOM.goHi.textContent =
    'HI: '    + String(hiScore).padStart(5, '0');
  let newBestEl = DOM.goNewBest;
  if (s > prevBest && prevBest > 0) {
    newBestEl.classList.remove('hidden');
  } else {
    newBestEl.classList.add('hidden');
  }
  DOM.gameOverScreen.classList.remove('hidden');
}

/* ───────────────────────────────────────────────────────────
   OBSTACLE SPAWNING
   ─────────────────────────────────────────────────────────── */
/**
 * Spawn a new obstacle (cactus or pterodactyl) at the right edge.
 */
function spawn() {
  let isPtera = Math.random() < CONFIG.PTERA_CHANCE && score > CONFIG.PTERA_SCORE;

  if (!isPtera) {
    // Cactus — single, double, or triple cluster.
    // Each cactus in a cluster is drawn individually so players can clearly
    // see how many they need to clear.  The hitbox covers the full span.
    let h        = CONFIG.CACTUS_H_MIN + Math.floor(Math.random() * CONFIG.CACTUS_H_RNG);
    let singleW  = CONFIG.CACTUS_W_MIN + Math.floor(Math.random() * CONFIG.CACTUS_W_RNG);
    let cl       = Math.random() < CONFIG.CACTUS_TRIPLE ? 3
                 : Math.random() < CONFIG.CACTUS_DBL    ? 2
                 : 1;
    const GAP    = 6;  // pixel gap between cacti in a cluster
    let totalW   = singleW * cl + GAP * (cl - 1);
    obstacles.push({
      type: 'cactus',
      x: W + 10,
      passed: false,
      y: GY - h,
      w: totalW,
      h: h,
      count:   cl,      // number of cacti to draw
      singleW: singleW  // width of each individual cactus
    });
  } else {
    // Pterodactyl — three possible flight heights.
    // Collision math (shrunk hitboxes, 5px each side):
    //   Ptera bottom edge  = ptera.y + 5 + (28-10) = ptera.y + 23
    //   Standing dino top  = (GY-52)  + 7         = GY - 45
    //   Ducking  dino top  = (GY-28)  + 7         = GY - 21
    //
    // GY-120 (high): bottom = GY-96  < GY-46 → misses standing dino;
    //   mid-air dino CAN enter that band → player must duck, not jump.
    // GY-40  (mid):  bottom = GY-16  > GY-46 → hits standing dino ✓
    //                                > GY-22 → also hits ducking dino,
    //   so player must JUMP over this one.  Ducking is finally required
    //   vs the GY-120 variant, making it a meaningful mechanic.
    // GY-69  (low):  bottom = GY-44  > GY-46 → hits standing dino ✓
    //                         GY-44  < GY-22 → clears ducking dino ✓
    //   Player may either jump over or duck under.
    let hs = [GY - 40, GY - 120, GY - 69];
    obstacles.push({
      type: 'ptera',
      x: W + 10,
      passed: false,
      y: hs[Math.floor(Math.random() * 3)],
      w: 44, h: 28,
      frame: 0, ft: 0
    });
  }
}

/* ───────────────────────────────────────────────────────────
   UPDATE (called every frame)
   ─────────────────────────────────────────────────────────── */
/**
 * Advance the game simulation by one logical update step.
 *
 * Updates score and speed, advances player physics and animations, moves and spawns obstacles,
 * clouds, and moon, performs collision detection (calling gameOver on impact), tracks passed
 * obstacles and removes off-screen ones, accumulates ground scroll, and refreshes HUD elements.
 * @param {number} dt - Time-step multiplier where 1.0 equals one 60 Hz frame; larger values represent proportionally longer updates.
 */
function update(dt) {
  frameCount++;
  score += speed * 0.04 * dt;

  // Chrome-like linear speed
  speed += 0.002 * dt;
  if (speed > CONFIG.SPEED_MAX) speed = CONFIG.SPEED_MAX;

  // ── Milestone flash (every 100 pts) ───────────────────
  let ms = Math.floor(score / 100);
  if (ms > lastMilestone) {
    lastMilestone = ms;
    flashFrames   = 8;
    soundMilestone();
  }

  // ── Day / Night cycle ──────────────────────────────────
  if (score > 700) {
    dayPhase = Math.min(dayPhase + 0.002 * dt, 1);
  }

  // ── Dino physics ───────────────────────────────────────
  dino.ducking = duckHeld && !dino.jumping;

  if (dino.jumping) {
    // Mid-air fast-fall — holding duck while airborne slams the dino down quickly
    if (duckHeld) dino.vy += 3.8 * dt;
    dino.vy += GRAVITY * dt;
    dino.y  += dino.vy * dt;
    let land = GY - DINO_H;   // always land at standing height
    if (dino.y >= land) {
      dino.y       = land;
      dino.vy      = 0;
      dino.jumping = false;
    }
  } else {
    dino.y = GY - (dino.ducking ? DUCK_H : DINO_H);
  }

  // Walking animation
  dino.ft += dt;
  if (dino.ft > 8) { dino.ft = 0; dino.frame = (dino.frame + 1) % 2; }

  // ── Clouds ─────────────────────────────────────────────
  clouds.forEach((c) => {
    c.x -= c.sp * (speed * 0.1) * dt;
    if (c.x < -200) c.x = W + 50;
  });

  // ── Moon scroll ────────────────────────────────────────
  moonX -= 0.28 * dt;
  if (moonX < -32) moonX = W + 32;

  // ── Obstacle spawn ─────────────────────────────────────
  obsCooldown -= dt;
  if (obsCooldown <= 0) {
    if (obstacles.length < 5) spawn();   // cap: prevent burst after long dt spike
    obsCooldown = Math.max(
      20,
      (80 - speed * 3.2) + Math.random() * 25
    );
  }

  // Accumulate ground scroll distance
  groundScrollX = (groundScrollX + speed * dt * 0.3) % 30;

  // ── Collision detection ────────────────────────────────
  let dh = dino.ducking ? DUCK_H : DINO_H;
  // Mutate reusable hitbox objects
  _dinoBox.x = dino.x + 9;
  _dinoBox.y = dino.y + 7;
  _dinoBox.h = dh - 12;
  // _dinoBox.w is constant (DINO_W - 14)

  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];
    o.x -= speed * dt;

    // Pterodactyl wing animation
    if (o.type === 'ptera') {
      o.ft += dt;
      if (o.ft > 10) { o.ft = 0; o.frame = (o.frame + 1) % 2; }
    }

    // AABB hit test (shrunk by 5px each side for leniency)
    _obsBox.x = o.x + 5;
    _obsBox.y = o.y + 5;
    _obsBox.w = o.w - 10;
    _obsBox.h = o.h - 10;
    if (_dinoBox.x < _obsBox.x + _obsBox.w && _dinoBox.x + _dinoBox.w > _obsBox.x &&
        _dinoBox.y < _obsBox.y + _obsBox.h && _dinoBox.y + _dinoBox.h > _obsBox.y) {
      gameOver();
      return;
    }
  }

  // Count obstacles the dino successfully passed (right edge clears dino left)
  obstacles.forEach((o) => {
    if (!o.passed && o.x + o.w < DINO_X) {
      o.passed = true;
      sessionStats.obstacles++;   
      gameObstacles++;            
    }
  });

  // Remove off-screen obstacles in-place
  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (obstacles[i].x <= -120) obstacles.splice(i, 1);
  }

  // ── HUD update ─────────────────────────────────────────
  // Only write textContent when the displayed string actually changes.
  let sc    = Math.floor(score);
  let scStr = String(sc).padStart(5, '0');
  if (scStr !== _lastHdrScore) { DOM.hdrScore.textContent = scStr; _lastHdrScore = scStr; }
  let hiStr = String(Math.max(sc, hiScore)).padStart(5, '0');
  if (hiStr !== _lastHdrHi)    { DOM.hdrHi.textContent = hiStr;   _lastHdrHi    = hiStr; }
  
  // Dedup speed bar width
  let newSpeedPct = Math.min(
  ((CONFIG.SPEED_MAX - CONFIG.SPEED_MIN) > 0
    ? ((speed - CONFIG.SPEED_MIN) / (CONFIG.SPEED_MAX - CONFIG.SPEED_MIN)) * 100
    : 0),
  100
  ) | 0;   // integer percent — 101 distinct values max
  if (newSpeedPct !== _lastSpeedPct) {
    DOM.speedFill.style.width = newSpeedPct + '%';
    DOM.speedFill.parentElement.parentElement.setAttribute('aria-valuenow', newSpeedPct);
    _lastSpeedPct = newSpeedPct;
  }
}

/* ───────────────────────────────────────────────────────────
   DRAW (called every frame)
   ─────────────────────────────────────────────────────────── */
/**
 * Render the current game frame onto the main canvas using the current visual state.
 *
 * Draws the baked sky layer (with day/night palette), ground texture, moon, clouds,
 * obstacles, the dino sprite, on-canvas HUD (score/hi), milestone flash overlay,
 * and the bottom speed bar. Rebuilds the palette and sky bake only when the day
 * phase changes to minimize work.
 *
 * This function performs pure rendering and must not modify game state. It relies
 * on externally maintained globals for all input state and drawing helpers.
 */
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Debug overlay — enable from DevTools: window.showDebug = true
  if (window.showDebug) {
    ctx.fillStyle   = _pal.bgC || '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle   = '#000';
    ctx.font        = '12px monospace';
    ctx.textBaseline = 'top';
    let elapsed = draw._lastT ? performance.now() - draw._lastT : 16.67;
    ctx.fillText('FPS: ' + Math.round(1000 / elapsed) +
                 ' | Phase: ' + dayPhase.toFixed(2) +
                 ' | skyCtx: ' + (skyCtx ? 'ready' : 'null'), 10, 20);
    ctx.textBaseline = 'alphabetic';
  }
  draw._lastT = performance.now();

  // Palette cache — only rebuild lerpRGB strings when dayPhase changes.
  if (dayPhase !== _lastDayPhase) {
    _lastDayPhase   = dayPhase;
    _pal.bgC    = lerpRGB('#ffffff', '#404040', dayPhase);
    _pal.fgC    = lerpRGB('#535353', '#f0f0f0', dayPhase);
    _pal.fgDark = lerpRGB('#404040', '#d0d0d0', dayPhase);
    _pal.dimC   = lerpRGB('#d4d4d4', '#606060', dayPhase);
    redrawSkyLayer();
  }
  let bgC    = _pal.bgC;
  let fgC    = _pal.fgC;
  let fgDark = _pal.fgDark;
  let dimC   = _pal.dimC;

  // Push to shared palette used by all draw helpers
  C.dino    = fgC;
  C.dinoAcc = fgDark;
  C.cactus  = fgC;
  C.ptera   = fgC;
  C.cloud   = dimC;
  C.eye     = bgC;   // eye == bg → hollow cutout illusion

  // Blit the pre-baked sky layer
  ctx.drawImage(skyCanvas, 0, 0);

  // Ground texture dots (scrolling)
  setFill(dimC);
  for (let gx = -(groundScrollX | 0); gx < W; gx += 30) {
    ctx.fillRect(gx,      GY + 8,  2, 1);
    ctx.fillRect(gx + 14, GY + 14, 3, 1);
  }

  // Moon — crescent shape, fades in with dayPhase like the stars
  if (dayPhase > 0.05) {
    ctx.globalAlpha = Math.min(dayPhase * 1.8, 1);
    let my = 40;
    let mr = 14;
    // Filled disc
    setFill(fgC);
    ctx.beginPath(); ctx.arc(moonX | 0, my, mr, 0, Math.PI * 2); ctx.fill();
    // Cutout offset to the left → crescent pointing right
    setFill(bgC);
    ctx.beginPath(); ctx.arc((moonX - 5) | 0, my - 2, mr - 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Clouds
  clouds.forEach((c) => { drawCloud(c.x, c.y, c.w); });

  // Obstacles
  obstacles.forEach((o) => {
    if (o.type === 'cactus') {
      // Draw each cactus in the cluster individually
      let n  = o.count   || 1;
      let sw = o.singleW || o.w;
      for (let k = 0; k < n; k++) {
        drawCactus(o.x + k * (sw + 6), o.y, sw, o.h);
      }
    } else {
      drawPtera(o.x, o.y, o.frame);
    }
  });

  // Dino
  drawDino(dino.x, dino.y, dino.frame, dino.jumping, dino.ducking);

  // ── Canvas HUD score ──
  ctx.textBaseline = 'top';
  ctx.font         = '12px "Press Start 2P", monospace';
  setFill(fgDark);
  ctx.fillText(String(Math.floor(score)).padStart(5, '0'), W - 130, 10);
  setFill(dimC);
  ctx.fillText('HI ' + String(hiScore).padStart(5, '0'), W - 232, 10);
  ctx.textBaseline = 'alphabetic';

  // ── Milestone flash overlay (every 100 pts) ────────────
  if (flashFrames > 0) {
    ctx.globalAlpha = (flashFrames / 8) * 0.4;
    setFill(fgC);
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    flashFrames--;
  }

  // ── Canvas speed bar — bottom-edge strip ───────────────
  // Always visible, including in fullscreen (where the DOM
  // stats panel is hidden). Colour shifts blue → orange → red.
  let speedPct = Math.min(
    (CONFIG.SPEED_MAX - CONFIG.SPEED_MIN) > 0
      ? (speed - CONFIG.SPEED_MIN) / (CONFIG.SPEED_MAX - CONFIG.SPEED_MIN)
      : 0,
    1
  );
  let barPx = (speedPct * W) | 0;
  let barCol = speedPct < 0.5
    ? lerpRGB('#1a73e8', '#e67e22', speedPct * 2)
    : lerpRGB('#e67e22', '#c0392b', (speedPct - 0.5) * 2);
  setFill(barCol);
  ctx.fillRect(0, H - 4, barPx, 4);
  setFill(dimC);
  ctx.fillRect(barPx, H - 4, W - barPx, 4);
}

/**
 * Draws the pixel-art dinosaur sprite at the specified canvas coordinates using the current palette and pose.
 * @param {number} x - X coordinate of the sprite's top-left corner.
 * @param {number} y - Y coordinate of the sprite's top-left corner.
 * @param {number} frame - Animation frame index (0 or 1) selecting walk-leg positions.
 * @param {boolean} jumping - When true, render the jumping (tucked legs) pose.
 * @param {boolean} ducking - When true, render the ducking/crouched pose (overrides standing/jumping pose).
 */

function drawDino(x, y, frame, jumping, ducking) {
  let c  = C.dino;
  let ca = C.dinoAcc;
  let ey = C.eye;   

  /* ── DUCKING (bounding box 44 × 28) ────────────────────── */
  if (ducking) {
    // Head (horizontal, pushed forward)
    px(c,  x+14, y+0,  28, 4);   // crown
    px(c,  x+10, y+4,  32, 8);   // head block
    px(c,  x+14, y+10,  4, 4);   // mouth notch left (gap)
    px(c,  x+20, y+10, 20, 4);   // jaw
    px(ey, x+32, y+3,   5, 5);   // eye cutout
    // Body
    px(c,  x+0,  y+8,   8, 6);   // tail stub
    px(c,  x+2,  y+8,  36, 8);   // body upper
    px(c,  x+4,  y+14, 32, 6);   // body lower
    // Legs (short alternating stumps)
    let lf = frame === 0 ? [x+12, x+24] : [x+18, x+30];
    px(c,  lf[0],    y+18, 6, 10);
    px(c,  lf[0]-2,  y+22, 12, 6); // front foot
    px(c,  lf[1],    y+18, 6, 8);
    px(c,  lf[1]+2,  y+22, 10, 4); // back foot
    return;
  }

  /* ── STANDING / JUMPING (bounding box 44 × 52) ─────────── */
  // Head — top-right block, Chrome T-Rex style
  px(c,  x+20, y+0,  22, 4);    // crown strip
  px(c,  x+14, y+4,  30, 12);   // main head block
  px(c,  x+16, y+14,  4, 4);    // chin-left gap (open mouth hint)
  px(c,  x+22, y+14, 22, 6);    // lower jaw / chin

  // Eye (background colour = hollow)
  px(ey, x+30, y+4,   6, 6);

  // Neck
  px(c,  x+14, y+18, 12, 4);

  // Body
  px(c,  x+4,  y+18, 34, 6);    // shoulder span
  px(c,  x+2,  y+24, 36, 10);   // mid body (widest)
  px(c,  x+4,  y+34, 28, 6);    // lower body
  px(c,  x+8,  y+38, 20, 4);    // hip taper

  // Tail (Chrome-style stepped silhouette, extends left)
  px(ca, x+0,  y+22, 10, 6);    // tail base
  px(ca, x+0,  y+28,  6, 6);    // tail mid
  px(ca, x+2,  y+32,  4, 4);    // tail tip

  // Arm (tiny stub below neck)
  px(ca, x+22, y+22,  8, 4);
  px(ca, x+24, y+26,  6, 4);

  // Legs (animated walk cycle)
  if (!jumping) {
    // Frame 0: left-front / right-back   Frame 1: reversed
    let fL = frame === 0 ? x+14 : x+22;  // front leg x
    let bL = frame === 0 ? x+26 : x+10;  // back  leg x
    // Front leg (longer, bigger foot)
    px(c,  fL,    y+42, 8, 10);
    px(c,  fL-2,  y+48, 14, 4);
    // Back leg (shorter, smaller foot)
    px(c,  bL,    y+42, 8, 8);
    px(c,  bL+2,  y+46, 12, 4);
  } else {
    // Both legs tucked during jump
    px(c,  x+12, y+42,  8, 8);
    px(c,  x+10, y+46, 14, 4);
    px(c,  x+26, y+42,  8, 6);
    px(c,  x+26, y+44, 12, 4);
  }
}

/**
 * Draws a pixel-art cactus at the given position and size using the current cactus color.
 *
 * The cactus is composed of a central stem and two arms (left and right), scaled to the
 * provided width and height to preserve the intended pixel-art silhouette.
 *
 * @param {number} x - Leftmost x-coordinate of the cactus cluster.
 * @param {number} y - Topmost y-coordinate of the cactus (smaller y is higher on screen).
 * @param {number} w - Total width of the cactus cluster in pixels.
 * @param {number} h - Total height of the cactus in pixels.
 */
function drawCactus(x, y, w, h) {
  let c   = C.cactus;
  let sw  = 6;                             // stem width
  let aw  = 6;                             // arm width
  let cx  = x + Math.floor(w / 2) - 3;     // stem left edge

  // ── Main stem ───────────────────────────────────────────
  px(c, cx, y, sw, h);

  // ── Left arm ────────────────────────────────────────────
  // Junction at ~30% down; arm rises for ~22% of h, then has a flat cap
  let ljy = y + Math.floor(h * 0.30);     // junction y
  let lup = Math.floor(h * 0.24);         // how far up the arm rises
  px(c, x,         ljy,       cx - x + sw, aw);   // horizontal bar (to stem)
  px(c, x,         ljy - lup, aw,   lup + aw);    // vertical rise

  // ── Right arm ───────────────────────────────────────────
  let rjy = y + Math.floor(h * 0.46);
  let rup = Math.floor(h * 0.20);
  let rx  = cx + sw;                              // right of stem
  px(c, rx,        rjy,  w - (rx - x), aw);       // horizontal bar
  px(c, x + w - aw, rjy - rup, aw, rup + aw);     // vertical rise
}

function drawPtera(x, y, frame) {
  let c  = C.ptera;
  let ey = C.eye;

  // ── Body ────────────────────────────────────────────────
  px(c, x+12, y+8,  22, 10);

  // ── Head (right of body, slightly above) ────────────────
  px(c, x+28, y+4,  10, 12);

  // ── Beak (stepped point to the right) ───────────────────
  px(c, x+36, y+6,   8,  4);
  px(c, x+40, y+8,   4,  2);

  // ── Eye ─────────────────────────────────────────────────
  px(ey, x+31, y+5,  4,  4);

  // ── Tail (left, small) ───────────────────────────────────
  px(c, x+8,  y+12,  6,  4);
  px(c, x+4,  y+14,  6,  4);
  px(c, x+0,  y+16,  4,  2);

  // ── Wings (two-frame flap) ───────────────────────────────
  if (frame === 0) {
    // Wings raised: sweep upward from body
    px(c, x+2,  y+0,  12,  4);   // left tip
    px(c, x+6,  y+4,  10,  4);   // left mid
    px(c, x+12, y+8,   6,  4);   // left root (touches body)
    px(c, x+22, y+4,   8,  4);   // right mid
    px(c, x+26, y+0,  10,  4);   // right tip
  } else {
    // Wings lowered: sweep downward from body
    px(c, x+6,  y+18, 10,  4);   // left root lower
    px(c, x+2,  y+22, 10,  4);   // left mid
    px(c, x+0,  y+24,  8,  4);   // left tip
    px(c, x+22, y+18, 10,  4);   // right root lower
    px(c, x+28, y+22,  8,  4);   // right mid
    px(c, x+30, y+24,  8,  4);   // right tip
  }
}

function drawCloud(x, y, w) {
  setFill(C.cloud);
  ctx.fillRect( x        | 0,  y        | 0,  w,       10);
  ctx.fillRect((x + 10)  | 0, (y - 8)   | 0,  w * 0.5, 10);
  ctx.fillRect((x + w * 0.4) | 0, (y - 6) | 0, w * 0.4,  8);
}

/* ───────────────────────────────────────────────────────────
   GAME LOOPS
   ─────────────────────────────────────────────────────────── */
/**
 * Advance game state and render frames while the game is in the running state.
 *
 * Uses the provided high-resolution timestamp to compute a normalized delta time
 * (1.0 = one 60 Hz frame) which is clamped to 3.0 to avoid excessively large updates
 * after pauses or backgrounding.
 * @param {DOMHighResTimeStamp} timestamp - High-resolution timestamp from requestAnimationFrame used to compute delta time.
 */
function loop(timestamp) {
  if (state !== 'running' || paused) return;
  // Compute dt normalised to 60 fps (1.0 = one 60 Hz frame).
  // Clamped to 3.0 to prevent a "spiral of death" after pausing/backgrounding.
  let dt = lastTime ? Math.min((timestamp - lastTime) / (1000 / 60), 3) : 1;
  lastTime = timestamp;
  update(dt);
  draw();
  animFrame = requestAnimationFrame(loop);
}

function idleLoop() {
  // Advance walk animation so the dino moves its legs on the start screen
  dino.ft += 1;
  if (dino.ft > 8) { dino.ft = 0; dino.frame = (dino.frame + 1) % 2; }
  draw();
  if (state === 'idle') animFrame = requestAnimationFrame(idleLoop);
}

/* ───────────────────────────────────────────────────────────
   UI HELPERS
   ─────────────────────────────────────────────────────────── */
/**
 * Write current session + DB stats to the stats panel DOM elements.
 * Only called on game-over and leaderboard-clear events (not every frame).
 */
function updateStatUI() {
  DOM.statGames.textContent  = sessionStats.games;
  DOM.statBest.textContent   = Math.max(sessionStats.bestScore, dbStats.bestScore);
  DOM.statObs.textContent    = sessionStats.obstacles;
  DOM.statDeaths.textContent = sessionStats.deaths;
  DOM.statDist.textContent   = sessionStats.totalDist;
  let bt = Math.max(sessionStats.bestTime, dbStats.bestTime || 0);
  DOM.statTime.textContent   =
    bt ? (Math.floor(bt / 60) + 'm ' + (bt % 60) + 's') : '0s';
}

/* Safe DOM-only leaderboard render — shows local top-10 with timestamp */
/**
 * Populate the leaderboard table body with the provided sorted entries.
 *
 * Clears existing rows and inserts one row per entry; if `lb` is empty or falsy,
 * inserts a single "NO RECORDS YET" row spanning all columns.
 *
 * @param {Array<{name?:string, score:number, when?:string}>} lb - Leaderboard entries sorted highest-first. `name` may be omitted (displayed as "ANON"); `when` is an optional timestamp string. */
function renderLeaderboard(lb) {
  let tbody = DOM.lbBody;

  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

  if (!lb || !lb.length) {
    let empty   = document.createElement('tr');
    let emptyTd = document.createElement('td');
    emptyTd.setAttribute('colspan', '4');
    emptyTd.className   = 'lb-empty';
    emptyTd.textContent = 'NO RECORDS YET';
    empty.appendChild(emptyTd);
    tbody.appendChild(empty);
    return;
  }
  let medals = ['#ffd700', '#c0c0c0', '#cd7f32'];

  lb.forEach((entry, i) => {
    let tr    = document.createElement('tr');
    let color = medals[i] || null;
    let when  = entry.when || entry.date || '--';
    let cols  = [
      String(i + 1),
      entry.name  || 'ANON',
      String(entry.score).padStart(5, '0'),
      when
    ];

    cols.forEach((val, ci) => {
      let td = document.createElement('td');
      if (ci === 0) {
        let badge       = document.createElement('span');
        badge.className = 'rank-badge';
        badge.textContent = val;
        td.appendChild(badge);
      } else {
        td.textContent = val;
      }
      if (color) td.style.color = color;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

/* ───────────────────────────────────────────────────────────
   INPUT HANDLERS
   ─────────────────────────────────────────────────────────── */

// Keyboard
document.addEventListener('keydown', function (e) {
  if (e.target && e.target.tagName === 'INPUT') return;
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
    soundMuted = !soundMuted;
    initAudio();
    let muteBtn = DOM.muteBtn;
    muteBtn.textContent = soundMuted ? '\uD83D\uDD07' : '\uD83D\uDD06';
    muteBtn.classList.toggle('active', soundMuted);
    muteBtn.setAttribute('aria-pressed', String(soundMuted));
  }
  if (e.code === 'KeyF') {
    e.preventDefault(); toggleFullscreen();
  }
});
document.addEventListener('keyup', function (e) {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'ArrowDown') endDuck();
});

// Game frame — click / touch
DOM.gameFrame.addEventListener('click', function () {
  jump();
});
DOM.gameFrame.addEventListener('touchstart', function (e) {
  e.preventDefault(); jump();
}, { passive: false });

// Restart button
DOM.restartBtn.addEventListener('click', function (e) {
  e.stopPropagation(); restart();
});
DOM.restartBtn.addEventListener('touchstart', function (e) {
  e.stopPropagation();
  e.preventDefault();
  restart();
}, { passive: false });

// Jump button
DOM.jumpBtn.addEventListener('click', jump);
DOM.jumpBtn.addEventListener('touchstart', function (e) {
  e.preventDefault(); jump();
}, { passive: false });

// Duck button
DOM.duckBtn.addEventListener('mousedown', startDuck);
DOM.duckBtn.addEventListener('touchstart', function (e) {
  e.preventDefault(); startDuck();
}, { passive: false });
DOM.duckBtn.addEventListener('touchend', function (e) {
  e.preventDefault(); endDuck();
}, { passive: false });
DOM.duckBtn.addEventListener('touchcancel', function (e) {
  e.preventDefault(); endDuck();
}, { passive: false });

// Release duck if mouse leaves the button or window loses focus
document.addEventListener('mouseup', endDuck);
window.addEventListener('blur', endDuck);

// Player name save
DOM.nameSaveBtn.addEventListener('click', function () {
  let raw = (DOM.nameInput.value || '').toUpperCase().trim() || 'ANON';
  playerName = raw.slice(0, 10);
  DB.savePlayerName(playerName);
  DOM.currentName.textContent = '\u25B6 ' + playerName;
  DOM.nameInput.value = '';
});
DOM.nameInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') DOM.nameSaveBtn.click();
});

/* ───────────────────────────────────────────────────────────
   CLEAR LEADERBOARD WIRING
   ─────────────────────────────────────────────────────────── */
DOM.clearLbBtn.addEventListener('click', function() {
  if (!confirm('Clear all leaderboard records?')) return;
  DB.clearLeaderboard();
  
  dbStats.bestScore = 0;
  dbStats.bestTime  = 0;
  DB.saveStats(dbStats);
  
  sessionStats.bestScore = 0;
  sessionStats.bestTime  = 0;
  
  renderLeaderboard([]);
  hiScore = 0;
  _lastHdrHi = '';
  DOM.hdrHi.textContent = '00000';
  updateStatUI();
});

/* ───────────────────────────────────────────────────────────
   RESET TOP SCORE WIRING
   Resets only the displayed HI score and the persisted bestScore
   stat. The full leaderboard records are left intact.
   ─────────────────────────────────────────────────────────── */
DOM.resetHiBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  if (!confirm('Reset top score to 00000?')) return;
  hiScore = 0;
  dbStats.bestScore = 0;
  DB.saveStats(dbStats);
  
  sessionStats.bestScore = 0;
  _lastHdrHi = '';
  DOM.hdrHi.textContent = '00000';
  updateStatUI();
});

/* ───────────────────────────────────────────────────────────
   MUTE / PAUSE BUTTON WIRING
   ─────────────────────────────────────────────────────────── */
DOM.pauseBtn.addEventListener('click', function(e) {
  e.stopPropagation(); togglePause();
});
DOM.pauseBtn.addEventListener('touchstart', function(e) {
  e.stopPropagation(); e.preventDefault(); togglePause();
}, { passive: false });

DOM.muteBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  soundMuted = !soundMuted;
  initAudio();
  this.textContent = soundMuted ? '\uD83D\uDD07' : '\uD83D\uDD06';
  this.classList.toggle('active', soundMuted);
  this.setAttribute('aria-pressed', String(soundMuted));
});

DOM.fullscreenBtn.addEventListener('click', function (e) {
  e.stopPropagation(); toggleFullscreen();
});

/* ───────────────────────────────────────────────────────────
   VISIBILITY / FOCUS — pause when the tab is backgrounded
   ─────────────────────────────────────────────────────────── */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    // Auto-trigger the proper pause logic if actively running so 
    // pauseStartTime is cleanly captured.
    if (state === 'running' && !paused) {
      togglePause();
    } else {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  } else {
    // Tab became visible again — resume the appropriate loop for the current state
    if (state === 'running' && !paused) {
      lastTime = 0;
      animFrame = requestAnimationFrame(loop);
    } else if (state === 'idle') {
      animFrame = requestAnimationFrame(idleLoop);
    }
  }
});


(function boot() {
  try {
    // Restore player name
    let name = DB.getPlayerName();
    playerName = name;
    DOM.currentName.textContent = '\u25B6 ' + name;

    // Restore leaderboard
    let lb = DB.getLeaderboard();
    renderLeaderboard(lb);
    
    // Restore global stats
    dbStats = DB.getStats();
    hiScore = dbStats.bestScore || 0;
     let hiStr = String(hiScore).padStart(5, '0');
     DOM.hdrHi.textContent = hiStr;
     _lastHdrHi = hiStr;
    DOM.statBest.textContent = dbStats.bestScore || 0;
    let bt = dbStats.bestTime || 0;
    DOM.statTime.textContent =
      bt ? (Math.floor(bt / 60) + 'm ' + (bt % 60) + 's') : '0s';

  } catch (err) {
    console.warn('Boot DB error (non-fatal):', err);
  }

  // Start idle state
  initGame();
  state = 'idle';

  // Update footer year dynamically
  let footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  draw();
  idleLoop();
}());