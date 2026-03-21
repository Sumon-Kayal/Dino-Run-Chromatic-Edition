/* ═══════════════════════════════════════════════════════════
   DINO RUN — CHROMATIC EDITION
   game.js — Game engine, rendering, input, UI

   Depends on (must be loaded first):
     db.js  → window.DB
   ═══════════════════════════════════════════════════════════ */
'use strict';

/* BUG-C FIX: guard then alias so all DB.x() calls below are consistent */
if (typeof window.DB === 'undefined') {
  throw new Error('game.js: window.DB not found — load db.js before game.js');
}
const DB = window.DB;

/* Update the DB status badge */
document.getElementById('db-status').textContent = DB.backendName;

/* BUG-4/5 FIX: Listen for quota updates from db.js and show usage in badge */
window.addEventListener('db:quota', function (e) {
  let used  = e.detail.used;
  let total = e.detail.total;
  let pct   = total > 0 ? ((used / total) * 100).toFixed(1) : '?';
  let usedKB = (used / 1024).toFixed(0);
  let badge = document.getElementById('db-status');
  badge.textContent = DB.backendName + ' \xB7 ' + usedKB + 'KB (' + pct + '%)';
  badge.style.removeProperty('color');   // clear danger colour if storage freed up
});

/* Show quota full warning if a write fails */
window.addEventListener('db:quotaFull', function () {
  let el = document.getElementById('db-status');
  el.textContent = 'STORAGE FULL \u26A0';
  // Use setProperty() — the correct CSSOM path for CSS custom property
  // references. element.style.color = 'var(--x)' may be silently ignored
  // by some browsers because the shorthand setter expects a resolved value.
  el.style.setProperty('color', 'var(--danger)');
});

/* ───────────────────────────────────────────────────────────
   CANVAS + CONSTANTS
   ─────────────────────────────────────────────────────────── */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// World dimensions (canvas intrinsic pixels — 854×480, 16:9)
const W  = 854;   // canvas width
const H  = 480;   // canvas height
const GY = 360;   // ground Y position (75% of H)

// Physics
const GRAVITY = 0.65;
const JUMP_V  = -14;

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
  // Speed values derived from original Chrome Dino (Chromium source):
  // start=6 px/frame, max=13 px/frame on a 600px-wide canvas.
  // Our canvas is 854px wide (scale ×1.4233): 6×1.4233≈8.5, 13×1.4233≈18.5.
  SPEED_MIN:    8.5,   // starting speed  (was 5.5 — original scaled from 6 px/f on 600px canvas)
  SPEED_MAX:    18.5,  // terminal speed  (was 18  — original scaled from 13 px/f)
  PTERA_CHANCE: 0.28,  // probability of pterodactyl vs cactus
  PTERA_SCORE:  900,   // score before pteras appear (was 200; scaled with ramp divisor)
  CACTUS_H_MIN: 40,    // cactus minimum height (px)
  CACTUS_H_RNG: 38,    // cactus height random range added to min
  CACTUS_W_MIN: 16,    // cactus minimum stem width
  CACTUS_W_RNG: 14,    // cactus width random range
  CACTUS_DBL:   0.35,  // probability of double-cactus cluster
  OBS_CD_INIT:  60,    // initial obstacle cooldown (frames)
  OBS_CD_MIN:   30,    // minimum cooldown (frames) — hard floor
  OBS_CD_BASE:  55,    // base cooldown for random calculation
  OBS_CD_RNG:   70,    // random range added to base
  OBS_CD_SPEED: 1.5    // speed scaling subtracted from cooldown
};

// Draw colour palette — recalculated each frame in draw()
// Day:  white bg / #535353 fg  (Chrome default)
// Night:#404040 bg / #f0f0f0 fg (Chrome inverted)
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
 * Fill a pixel-aligned rectangle on the game canvas.
 * Coordinates are floored to integers before drawing.
 * @param {string} color - CSS color string for fill.
 * @param {number} x - Left edge (will be floored to an integer).
 * @param {number} y - Top edge (will be floored to an integer).
 * @param {number} w - Width in pixels.
 * @param {number} h - Height in pixels.
 */
function px(color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x|0, y|0, w, h);
}

/* Linear interpolation */
/**
 * Compute the linear interpolation between two numeric endpoints.
 * @param {number} a - Start value.
 * @param {number} b - End value.
 * @param {number} t - Blend factor where 0 yields `a` and 1 yields `b` (typically between 0 and 1).
 * @returns {number} The interpolated value between `a` and `b`.
 */
function lerp(a, b, t) { return a + (b - a) * t; }

/* Interpolate between two #rrggbb hex colours */
/**
 * Interpolate between two #rrggbb hex colours.
 * @param {string} ca - Start colour e.g. "#ffffff"
 * @param {string} cb - End colour
 * @param {number} t  - Blend factor [0..1]
 * @returns {string} CSS rgb() string
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
   GAME STATE
   ─────────────────────────────────────────────────────────── */
let state      = 'idle';   // 'idle' | 'running' | 'dead'
let score      = 0;
let hiScore    = 0;
let speed      = 0;
let frameCount = 0;
let animFrame  = null;
// FIX-1: delta-time tracking — lastTime is reset to 0 before every new game
// so the first frame never computes a huge dt from a prior timestamp.
let lastTime   = 0;

let dino        = {};
let obstacles   = [];
let clouds      = [];
let stars       = [];
let obsCooldown = 0;

// FIX-10: symmetric day/night — both peaks get a 350-frame pause
let dayPhase   = 0;    // 0 = full day, 1 = full night
let dayDir     = 1;    // direction of transition
let dayTimer   = 0;
let dayPauseAt = -1;   // frame number at which pause ends (-1 = not pausing)

let duckHeld   = false;
let playerName = 'ANON';

// ── Pause ──────────────────────────────────────────────────
let paused = false;

// ── Score milestone flash (every 100 pts) ─────────────────
let flashFrames   = 0;
let lastMilestone = 0;

// ── Web Audio ─────────────────────────────────────────────
const AudioCtxCtor = window.AudioContext || window.webkitAudioContext;
let audioCtx     = null;
let soundMuted   = false;

/**
 * Initialize the global AudioContext instance used for sound playback.
 *
 * If an AudioContext constructor is not available or `audioCtx` is already set, this is a no-op.
 * On construction failure the global `audioCtx` is set to `null`.
 */
function initAudio() {
  if (audioCtx || !AudioCtxCtor) return;
  try { audioCtx = new AudioCtxCtor(); } catch(e) { audioCtx = null; }
}
/**
 * Resume the audio context if present and currently suspended.
 *
 * If the shared AudioContext is absent or not in the "suspended" state, this is a no-op.
 * Any errors thrown while resuming are silently ignored.
 */
function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
}
/**
 * Play a short pitched beep using the page AudioContext.
 *
 * If audio is unavailable or currently muted, this function does nothing.
 *
 * @param {number} freq - Start frequency in hertz.
 * @param {string} [type] - Oscillator waveform type (e.g., "sine", "square"); defaults to "square".
 * @param {number} dur - Duration of the beep in seconds.
 * @param {number} [vol] - Peak gain (0.0–1.0); defaults to ~0.07 when omitted.
 * @param {number} [endF] - Optional end frequency in hertz; when provided the frequency ramps to this value over the duration.
 */
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
  } catch(e) {}
}
/**
 * Play the player's jump sound effect.
 */
function soundJump() { playBeep(400, 'square', 0.12, 0.07, 880); }
/**
 * Play the game's death sound effect.
 *
 * Produces a two-step descending square-wave beep: a short 440 Hz tone followed ~90 ms later by a longer 220 Hz tone, both at low volume.
 */
function soundDie() {
  playBeep(440, 'square', 0.10, 0.08);
  setTimeout(() => { playBeep(220, 'square', 0.18, 0.07); }, 90);
}
/**
 * Play the milestone three-tone ascending alert.
 *
 * Emits three short square-wave beeps in succession (660 Hz, 880 Hz, 1100 Hz)
 * with durations approximately 70ms, 70ms, and 120ms respectively.
 */
function soundMilestone() {
  playBeep(660, 'square', 0.07, 0.07);
  setTimeout(() => { playBeep(880,  'square', 0.07, 0.07); }, 70);
  setTimeout(() => { playBeep(1100, 'square', 0.12, 0.07); }, 140);
}

const sessionStats = { games:0, deaths:0, obstacles:0, totalDist:0, bestScore:0 };
let dbStats      = { games:0, deaths:0, obstacles:0, totalDist:0, bestScore:0 };  // ISSUE-2 FIX: let instead of var
let gameObstacles = 0;   // BUG-A FIX: per-game counter, reset each initGame()

/* ───────────────────────────────────────────────────────────
   INITIALISE / RESET
   ─────────────────────────────────────────────────────────── */
/**
 * Reset all game state to initial values. Called before each new game.
 */
function initGame() {
  score      = 0;
  speed      = CONFIG.SPEED_MIN;
  frameCount = 0;
  obstacles  = [];
  obsCooldown = CONFIG.OBS_CD_INIT;
  gameObstacles = 0;   // BUG-A FIX: reset per-game obstacle counter
  flashFrames   = 0;
  lastMilestone = 0;

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

}

/* ───────────────────────────────────────────────────────────
   PLAYER ACTIONS
   ─────────────────────────────────────────────────────────── */
/**
 * Handle player jump input and start or restart the game when appropriate.
 *
 * If the game is paused the input is ignored. When the game is idle this
 * triggers the start sequence; when dead it triggers a restart. Otherwise,
 * if the player can jump, the function applies an upward velocity to the
 * dino, marks it as jumping, and plays the jump sound.
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

/**
 * Begins the player's duck action.
 *
 * Marks the duck input as held, initializes the audio system if needed, and adds the `active` class
 * to the `#duckBtn` element when present to reflect the pressed state.
 */
function startDuck() {
  duckHeld = true;
  initAudio();
  let b = document.getElementById('duckBtn');
  if (b) b.classList.add('active');
}
/**
 * Releases the player's duck action and updates the duck button UI.
 *
 * Clears the internal duck-held flag and removes the "active" class from the #duckBtn element if it exists.
 */
function endDuck() {
  duckHeld = false;
  let b = document.getElementById('duckBtn');
  if (b) b.classList.remove('active');
}

/**
 * Toggle the game's paused state and update UI/animation accordingly.
 *
 * When called while the game is 'running' or 'paused', this function initializes audio, flips the paused flag,
 * sets the public `state` to either `'paused'` or `'running'`, shows or hides the pause screen, updates the
 * pause button active state, cancels the scheduled animation frame when pausing, and resets timing before
 * resuming the main loop.
 */
function togglePause() {
  if (state !== 'running' && state !== 'paused') return;
  initAudio();
  if (!paused) {
    paused = true;
    state  = 'paused';
    cancelAnimationFrame(animFrame);
    document.getElementById('pauseScreen').classList.remove('hidden');
    document.getElementById('pauseBtn').classList.add('active');
  } else {
    paused = false;
    state  = 'running';
    lastTime = 0;
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('pauseBtn').classList.remove('active');
    loop();
  }
}

/**
 * Toggle the document into or out of fullscreen mode using the standard Fullscreen API with a WebKit-prefixed fallback.
 *
 * Attempts to request fullscreen on document.documentElement when not currently fullscreen, or exit fullscreen when active. If the request returns a Promise that rejects, the rejection is caught and a warning is logged to the console.
 */
function toggleFullscreen() {
  let el = document.documentElement;
  // Standard API + webkit prefix for Safari desktop
  let isFs = document.fullscreenElement || document.webkitFullscreenElement;
  if (!isFs) {
    // requestFullscreen() returns a Promise in modern browsers but undefined
    // in Safari < 16.4 — guard before calling .catch() to avoid TypeError.
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
 * Update the fullscreen button label and active state to reflect current fullscreen status.
 *
 * Sets the button text to "EXIT FS" when the document is in fullscreen, otherwise "FULL", and toggles the button's `active` class to match.
 */
function onFullscreenChange() {
  let btn = document.getElementById('fullscreenBtn');
  if (!btn) return;
  let isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  btn.textContent = isFs ? 'EXIT FS' : 'FULL';
  btn.classList.toggle('active', isFs);
}
// Standard event + webkit prefix for Safari
document.addEventListener('fullscreenchange',       onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

/**
 * Begin a new play session by resetting runtime state, initializing game state, hiding start and game-over screens, and starting the main animation loop.
 */
function startGame() {
  cancelAnimationFrame(animFrame);
  paused   = false;
  lastTime = 0;
  state    = 'running';
  initGame();
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameOverScreen').classList.add('hidden');
  loop();
}

/**
 * Restart the game from a dead state and begin a new run.
 *
 * Resets timing and pause state, reinitializes game state, hides the game-over screen,
 * and starts the main game loop.
 */
function restart() {
  cancelAnimationFrame(animFrame);
  paused   = false;
  lastTime = 0;
  state    = 'running';
  initGame();
  document.getElementById('gameOverScreen').classList.add('hidden');
  loop();
}

/**
 * Transition the game to the dead state and finalize score/stat persistence and UI.
 *
 * Updates session and persistent stats, attempts to add the current score to the leaderboard,
 * rolls back `dbStats.bestScore` if leaderboard save fails (e.g., storage full), saves stats,
 * updates the leaderboard and stats UI, and reveals the game-over screen including the
 * "NEW BEST" banner only when the score exceeds a real previous best.
 */
function gameOver() {
  if (state === 'dead') return;   // guard against double-call
  state = 'dead';
  soundDie();

  sessionStats.games++;
  sessionStats.deaths++;
  let s = Math.floor(score);
  if (s > sessionStats.bestScore) sessionStats.bestScore = s;
  sessionStats.totalDist += s;

  // Capture previous best before updating so we can show NEW BEST banner
  let prevBest = Math.max(hiScore, dbStats.bestScore);
  if (s > hiScore) hiScore = s;

  // BUG-A FIX: use gameObstacles (this game only)
  dbStats.games++;
  dbStats.deaths++;
  dbStats.totalDist  += s;
  dbStats.obstacles  += gameObstacles;
  if (s > dbStats.bestScore) dbStats.bestScore = s;

  // BUG-1 FIX (part 2): write leaderboard BEFORE committing stats.
  // If addScore() fails (quota full) we roll back dbStats.bestScore so
  // the two stores never diverge via a failed write.
  let lb = DB.addScore(playerName, s);
  if (lb) {
    DB.saveStats(dbStats);
    renderLeaderboard(lb);
  } else {
    // Leaderboard write failed — revert bestScore to existing lb leader
    let existingLb = DB.getLeaderboard();
    dbStats.bestScore = existingLb.length ? existingLb[0].score : 0;
    DB.saveStats(dbStats);
    console.warn('[Game] Score not saved — storage full');
    renderLeaderboard(existingLb);
    document.getElementById('db-status').textContent = 'STORAGE FULL \u26A0 \u2014 Score not saved';
    document.getElementById('db-status').style.setProperty('color', 'var(--danger)');
  }
  updateStatUI();

  document.getElementById('go-score').textContent =
    'SCORE ' + String(s).padStart(5, '0');  // ISSUE-1 FIX: matches HTML template (no colon)
  document.getElementById('go-hi').textContent =
    'HI: '    + String(hiScore).padStart(5, '0');
  // Show NEW BEST banner only when the player actually beat a real prior score
  let newBestEl = document.getElementById('go-newbest');
  if (s > prevBest && prevBest > 0) {
    newBestEl.classList.remove('hidden');
  } else {
    newBestEl.classList.add('hidden');
  }
  document.getElementById('gameOverScreen').classList.remove('hidden');
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
    // Cactus (single or double cluster)
    let h  = CONFIG.CACTUS_H_MIN + Math.floor(Math.random() * CONFIG.CACTUS_H_RNG);
    let w  = CONFIG.CACTUS_W_MIN + Math.floor(Math.random() * CONFIG.CACTUS_W_RNG);
    let cl = Math.random() < CONFIG.CACTUS_DBL ? 2 : 1;
    obstacles.push({
      type: 'cactus',
      x: W + 10,
      passed: false,
      y: GY - h,
      w: w * cl + (cl - 1) * 5,
      h: h
    });
  } else {
    // Pterodactyl — three possible flight heights.
    // Collision math (shrunk hitboxes, 4px each side):
    //   Ptera bottom edge  = ptera.y + 4 + (28-8) = ptera.y + 24
    //   Standing dino top  = (GY-52)  + 6          = GY - 46
    //   Ducking  dino top  = (GY-28)  + 6          = GY - 22
    //
    // GY-120 (high): bottom = GY-96  < GY-46 → misses standing dino;
    //   mid-air dino CAN enter that band → player must duck, not jump.
    // GY-60  (mid):  bottom = GY-36  > GY-46 → hits standing dino ✓
    //                                  > GY-22 → also hits ducking dino,
    //   so player must JUMP over this one.  Ducking is finally required
    //   vs the GY-120 variant, making it a meaningful mechanic.
    // GY-68  (low):  bottom = GY-44  > GY-46 → hits standing dino ✓
    //                         GY-44  < GY-22 → clears ducking dino ✓
    //   Player may either jump over or duck under.
    //
    // FIX-2: previous mid value was GY-75 (bottom = GY-51), which sits
    // 5px above the standing dino's top (GY-46) — never a collision.
    // Corrected to GY-60 so it properly intersects the standing hitbox.
    let hs = [GY - 60, GY - 120, GY - 68];
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
// FIX-1: dt is a normalised multiplier where 1.0 == one 60 fps frame.
// Every value that was previously a fixed-per-frame amount is now scaled
// by dt so the game runs identically on 60 Hz, 90 Hz, 120 Hz, and 144 Hz.
/**
 * Advance the entire game simulation by the given time step, updating score, day/night cycle, player physics and animation, clouds, obstacle spawning and movement, collision checks, passed-obstacle bookkeeping, and HUD fields.
 * @param {number} dt - Time-step multiplier where 1.0 equals one 60 Hz frame.
function update(dt) {
  frameCount++;
  score += speed * 0.04 * dt;
  speed  = Math.min(CONFIG.SPEED_MIN + (score / 2660) * (CONFIG.SPEED_MAX - CONFIG.SPEED_MIN), CONFIG.SPEED_MAX);  // 2660 = score at which original reaches max speed

  // ── Milestone flash (every 100 pts) ───────────────────
  let ms = Math.floor(score / 100);
  if (ms > lastMilestone) {
    lastMilestone = ms;
    flashFrames   = 8;
    soundMilestone();
  }

  // ── Day / Night cycle ──────────────────────────────────
  // FIX-10: both day-peak and night-peak pause for 350 frames
  dayTimer += dt;
  if (dayPauseAt < 0) {
    // Actively transitioning
    dayPhase += dayDir * 0.005 * dt;
    if (dayPhase >= 1) {
      dayPhase   = 1;
      dayDir     = -1;
      dayPauseAt = dayTimer + 350;   // pause at full night
    }
    if (dayPhase <= 0) {
      dayPhase   = 0;
      dayDir     = 1;
      dayPauseAt = dayTimer + 350;   // pause at full day
    }
  } else if (dayTimer >= dayPauseAt) {
    dayPauseAt = -1;                 // resume transitioning
  }

  // ── Dino physics ───────────────────────────────────────
  dino.ducking = duckHeld && !dino.jumping;

  if (dino.jumping) {
    // FIX-5: mid-air fast-fall — holding duck while airborne slams the dino
    // down quickly, matching the original Chrome Dino mechanic. Without this,
    // dino.ducking is false during a jump so pressing duck did nothing.
    if (duckHeld) dino.vy += 2.5 * dt;
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

  // ── Obstacle spawn ─────────────────────────────────────
  obsCooldown -= dt;
  if (obsCooldown <= 0) {
    spawn();
    obsCooldown = Math.max(
      CONFIG.OBS_CD_MIN,
      Math.floor(CONFIG.OBS_CD_BASE + Math.random() * CONFIG.OBS_CD_RNG - speed * CONFIG.OBS_CD_SPEED)
    );
  }

  // ── Collision detection ────────────────────────────────
  let dh = dino.ducking ? DUCK_H : DINO_H;
  let db = { x: dino.x + 8, y: dino.y + 6, w: DINO_W - 14, h: dh - 10 };

  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];
    o.x -= speed * dt;

    // Pterodactyl wing animation
    if (o.type === 'ptera') {
      o.ft += dt;
      if (o.ft > 10) { o.ft = 0; o.frame = (o.frame + 1) % 2; }
    }

    // AABB hit test (shrunk by 4px each side for leniency)
    let ob = { x: o.x + 4, y: o.y + 4, w: o.w - 8, h: o.h - 8 };
    if (db.x < ob.x + ob.w && db.x + db.w > ob.x &&
        db.y < ob.y + ob.h && db.y + db.h > ob.y) {
      gameOver();
      return;
    }
  }

  // Count obstacles the dino successfully passed (right edge clears dino left)
  obstacles.forEach((o) => {
    if (!o.passed && o.x + o.w < DINO_X) {
      o.passed = true;
      sessionStats.obstacles++;   // session total (shown in UI)
      gameObstacles++;            // per-game count (saved to DB)
    }
  });

  // Remove off-screen obstacles
  obstacles = obstacles.filter((o) => { return o.x > -120; });

  // ── HUD update ─────────────────────────────────────────
  let sc = Math.floor(score);
  document.getElementById('hdr-score').textContent =
    String(sc).padStart(5, '0');
  document.getElementById('hdr-hi').textContent =
    String(Math.max(sc, hiScore)).padStart(5, '0');
  document.getElementById('speed-fill').style.width =
    Math.min(((speed - CONFIG.SPEED_MIN) / (CONFIG.SPEED_MAX - CONFIG.SPEED_MIN)) * 100, 100) + '%';

  // updateStatUI() intentionally removed from here — stats only change on
  // game events (gameOver, clear), not every frame. See those handlers below.
}

/* ───────────────────────────────────────────────────────────
   DRAW (called every frame)
   ─────────────────────────────────────────────────────────── */
/**
 * Render the current frame to the canvas.
 * Pure draw — must not modify game state.
 */
function draw() {
  ctx.clearRect(0, 0, W, H);

  // ── Chrome dino palette: lerp day(white/#535353) ↔ night(#404040/#f0f0f0)
  let bgC    = lerpRGB('#ffffff', '#404040', dayPhase);
  let fgC    = lerpRGB('#535353', '#f0f0f0', dayPhase);
  let fgDark = lerpRGB('#404040', '#d0d0d0', dayPhase);
  let dimC   = lerpRGB('#d4d4d4', '#606060', dayPhase);

  // Push to shared palette used by all draw helpers
  C.dino    = fgC;
  C.dinoAcc = fgDark;
  C.cactus  = fgC;
  C.ptera   = fgC;
  C.cloud   = dimC;
  C.eye     = bgC;   // eye == bg → hollow cutout illusion

  // Background (Chrome uses flat colour, no gradient)
  ctx.fillStyle = bgC;
  ctx.fillRect(0, 0, W, H);

  // Ground horizon line
  ctx.fillStyle = fgC;
  ctx.fillRect(0, GY, W, 2);

  // Ground texture dots (scrolling)
  ctx.fillStyle = dimC;
  for (let gx = ((frameCount * speed * 0.3) % 30) | 0; gx < W; gx += 30) {
    ctx.fillRect(gx,      GY + 8,  2, 1);
    ctx.fillRect(gx + 14, GY + 14, 3, 1);
  }

  // Stars (only visible during night phase)
  if (dayPhase > 0.1) {
    ctx.globalAlpha = dayPhase * 0.6;
    ctx.fillStyle   = fgDark;
    stars.forEach((s) => { ctx.fillRect(s.x, s.y, s.r, s.r); });
    ctx.globalAlpha = 1;
  }

  // Clouds
  clouds.forEach((c) => { drawCloud(c.x, c.y, c.w); });

  // Obstacles
  obstacles.forEach((o) => {
    if (o.type === 'cactus') drawCactus(o.x, o.y, o.w, o.h);
    else                     drawPtera(o.x, o.y, o.frame);
  });

  // Dino
  drawDino(dino.x, dino.y, dino.frame, dino.jumping, dino.ducking);

  // ── Canvas HUD score (FIX-07: explicit textBaseline) ──
  ctx.textBaseline = 'top';
  ctx.font         = '12px "Press Start 2P", monospace';
  ctx.fillStyle    = fgDark;
  ctx.fillText(String(Math.floor(score)).padStart(5, '0'), W - 130, 10);
  ctx.fillStyle = dimC;
  ctx.fillText('HI ' + String(hiScore).padStart(5, '0'), W - 232, 10);
  ctx.textBaseline = 'alphabetic';

  // ── Milestone flash overlay (every 100 pts) ────────────
  if (flashFrames > 0) {
    ctx.globalAlpha = (flashFrames / 8) * 0.4;
    ctx.fillStyle   = fgC;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    flashFrames--;
  }
}

/**
 * Render the pixel-art dinosaur sprite at the specified position using the provided pose and animation frame.
 * @param {number} x - X coordinate of the sprite's top-left corner.
 * @param {number} y - Y coordinate of the sprite's top-left corner.
 * @param {number} frame - Animation frame (0 or 1) selecting leg positions for the walk cycle.
 * @param {boolean} jumping - If true, draw the jumping pose (legs tucked); otherwise draw standing pose.
 * @param {boolean} ducking - If true, draw the ducking/crouch pose (overrides standing/jumping).
 */

function drawDino(x, y, frame, jumping, ducking) {
  let c  = C.dino;
  let ca = C.dinoAcc;
  let ey = C.eye;   // eye == bg colour => hollow-cutout illusion

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
 * Draws a pixel-art cactus inside the given bounding box.
 *
 * Renders a centered vertical stem and two arms (left and right) whose junction
 * positions and rise heights scale proportionally with the provided height.
 * @param {number} x - Left coordinate of the cactus bounding box.
 * @param {number} y - Top coordinate of the cactus bounding box.
 * @param {number} w - Width of the cactus bounding box in pixels.
 * @param {number} h - Height of the cactus bounding box in pixels.
 */
function drawCactus(x, y, w, h) {
  let c   = C.cactus;
  let sw  = 6;                             // stem width (Chrome uses ~6px)
  let aw  = 6;                             // arm width
  let cx  = x + Math.floor(w / 2) - 3;   // stem left edge

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
  let rx  = cx + sw;                               // right of stem
  px(c, rx,        rjy,  w - (rx - x), aw);       // horizontal bar
  px(c, x + w - aw, rjy - rup, aw, rup + aw);     // vertical rise
}

/**
 * Draws a pterodactyl sprite at the specified canvas position and renders one of two wing frames.
 *
 * Renders the ptera's body, head, beak, eye, tail and wings using the current palette.
 * @param {number} x - X coordinate of the sprite origin (leftmost reference).
 * @param {number} y - Y coordinate of the sprite origin (topmost reference).
 * @param {number} frame - Wing animation frame: `0` for wings raised, `1` for wings lowered.
 */
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
  ctx.fillStyle = C.cloud;
  ctx.fillRect( x        | 0,  y        | 0,  w,       10);
  ctx.fillRect((x + 10)  | 0, (y - 8)   | 0,  w * 0.5, 10);
  ctx.fillRect((x + w * 0.4) | 0, (y - 6) | 0, w * 0.4,  8);
}

/* ───────────────────────────────────────────────────────────
   GAME LOOPS
   ─────────────────────────────────────────────────────────── */
/**
 * Main game loop — drives update() and draw() via requestAnimationFrame.
 * @param {DOMHighResTimeStamp} timestamp - Provided by rAF
 */
function loop(timestamp) {
  if (state !== 'running' || paused) return;
  // FIX-1: compute dt normalised to 60 fps (1.0 = one 60 Hz frame).
  // Clamped to 3.0 to prevent a "spiral of death" if the tab was
  // backgrounded and returns with a massive timestamp gap.
  let dt = lastTime ? Math.min((timestamp - lastTime) / (1000 / 60), 3) : 1;
  lastTime = timestamp;
  update(dt);
  draw();
  animFrame = requestAnimationFrame(loop);
}

function idleLoop() {
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
  document.getElementById('stat-games').textContent  = sessionStats.games;
  document.getElementById('stat-best').textContent   =
    Math.max(sessionStats.bestScore, dbStats.bestScore);
  document.getElementById('stat-obs').textContent    = sessionStats.obstacles;
  document.getElementById('stat-deaths').textContent = sessionStats.deaths;
  document.getElementById('stat-dist').textContent   = sessionStats.totalDist;
}

/* Safe DOM-only leaderboard render — shows local top-10 with timestamp */
/**
 * Rebuild the leaderboard table from a sorted array of entries.
 * @param {Array<{name:string, score:number, when:string}>} lb - Top-10 entries
 */
function renderLeaderboard(lb) {
  let tbody = document.getElementById('lbBody');

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
    // 'when' is new field: "19 Mar '26 14:07"
    // fall back to legacy 'date' field for old saved entries
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

// Keyboard — FIX-04: ignore events when typing in the name input
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
    let muteBtn = document.getElementById('muteBtn');
    muteBtn.textContent = soundMuted ? '\uD83D\uDD07' : '\uD83D\uDD06';
    muteBtn.classList.toggle('active', soundMuted);
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
document.getElementById('gameFrame').addEventListener('click', function () {
  jump();
});
document.getElementById('gameFrame').addEventListener('touchstart', function (e) {
  e.preventDefault(); jump();
}, { passive: false });

// Restart button
document.getElementById('restartBtn').addEventListener('click', function (e) {
  e.stopPropagation(); restart();
});
// FIX-3: without this, a tap fires touchstart → bubbles to #gameFrame →
// calls jump() → restart(), then the synthesised click fires restart() again.
// stopPropagation + preventDefault break both paths of the double-call.
document.getElementById('restartBtn').addEventListener('touchstart', function (e) {
  e.stopPropagation();
  e.preventDefault();
  restart();
}, { passive: false });

// Jump button
document.getElementById('jumpBtn').addEventListener('click', jump);
document.getElementById('jumpBtn').addEventListener('touchstart', function (e) {
  e.preventDefault(); jump();
}, { passive: false });

// Duck button
document.getElementById('duckBtn').addEventListener('mousedown', startDuck);
document.getElementById('duckBtn').addEventListener('touchstart', function (e) {
  e.preventDefault(); startDuck();
}, { passive: false });
document.getElementById('duckBtn').addEventListener('touchend', function (e) {
  e.preventDefault(); endDuck();
}, { passive: false });
document.getElementById('duckBtn').addEventListener('touchcancel', function (e) {
  e.preventDefault(); endDuck();
}, { passive: false });

// FIX-03: release duck if mouse leaves the button or window loses focus
document.addEventListener('mouseup', endDuck);
window.addEventListener('blur', endDuck);

// Player name save
document.getElementById('nameSaveBtn').addEventListener('click', function () {
  let raw = (document.getElementById('nameInput').value || '')
    .toUpperCase().trim() || 'ANON';
  playerName = raw.slice(0, 10);
  DB.savePlayerName(playerName);
  document.getElementById('currentName').textContent = '\u25B6 ' + playerName;
  document.getElementById('nameInput').value = '';
});
// FIX-5: pressing Enter while typing a name should submit, just like a real
// form. The input is not inside a <form> tag so the default submit event never
// fires — we wire it up manually here.
document.getElementById('nameInput').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') document.getElementById('nameSaveBtn').click();
});

/* ───────────────────────────────────────────────────────────
   CLEAR LEADERBOARD WIRING
   ─────────────────────────────────────────────────────────── */
document.getElementById('clearLbBtn').addEventListener('click', function() {
  if (!confirm('Clear all leaderboard records?')) return;
  DB.clearLeaderboard();
  // BUG-1/2 FIX: also reset the persisted best score so the stats panel
  // stays in sync with the leaderboard, then refresh the UI immediately.
  dbStats.bestScore = 0;
  DB.saveStats(dbStats);
  renderLeaderboard([]);
  hiScore = 0;
  document.getElementById('hdr-hi').textContent = '00000';
  updateStatUI();
});

/* ───────────────────────────────────────────────────────────
   MUTE / PAUSE BUTTON WIRING
   ─────────────────────────────────────────────────────────── */
document.getElementById('pauseBtn').addEventListener('click', function(e) {
  e.stopPropagation(); togglePause();
});
document.getElementById('pauseBtn').addEventListener('touchstart', function(e) {
  e.stopPropagation(); e.preventDefault(); togglePause();
}, { passive: false });

document.getElementById('muteBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  soundMuted = !soundMuted;
  initAudio();
  this.textContent = soundMuted ? '\uD83D\uDD07' : '\uD83D\uDD06';
  this.classList.toggle('active', soundMuted);
});

document.getElementById('fullscreenBtn').addEventListener('click', function (e) {
  e.stopPropagation(); toggleFullscreen();
});

/* ───────────────────────────────────────────────────────────
   VISIBILITY / FOCUS — pause when the tab is backgrounded
   ─────────────────────────────────────────────────────────── */
// FIX-4: Without this, browsers throttle requestAnimationFrame to ~1 fps
// when the tab is hidden. The game would silently tick at a crawl, then
// resume at full speed — almost certainly killing the player the moment
// they switch back. We instead pause the loop entirely and restart it
// cleanly (resetting lastTime so the first resumed frame gets dt=1 rather
// than a huge stale delta that would teleport obstacles).
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    // Tab became hidden — stop the loop
    cancelAnimationFrame(animFrame);
    animFrame = null;
  } else {
    // Tab became visible again — resume only if a game is in progress
    if (state === 'running' && !paused) {
      lastTime = 0;   // FIX-1 pattern: reset dt baseline so first frame is safe
      loop();
    }
  }
});


(function boot() {
  try {
    // Restore player name
    let name = DB.getPlayerName();
    playerName = name;
    document.getElementById('currentName').textContent = '\u25B6 ' + name;

    // Restore leaderboard
    let lb = DB.getLeaderboard();
    renderLeaderboard(lb);
    if (lb.length) hiScore = lb[0].score;
    document.getElementById('hdr-hi').textContent =
      String(hiScore).padStart(5, '0');

    // Restore global stats
    dbStats = DB.getStats();
    document.getElementById('stat-best').textContent = dbStats.bestScore || 0;

  } catch (err) {
    console.warn('Boot DB error (non-fatal):', err);
  }

  // Start idle state
  initGame();
  state = 'idle';

  // Begin with a 350-frame day pause
  dayPauseAt = 350;
  dayTimer   = 0;

  draw();
  idleLoop();
}());
         



