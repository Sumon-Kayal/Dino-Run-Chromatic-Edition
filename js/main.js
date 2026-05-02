/* ═══════════════════════════════════════════════════════════
   main.js — Entry point: boot, game lifecycle, UI wiring
   Imports all game and DB modules and ties them together.
   ═══════════════════════════════════════════════════════════ */
'use strict';

import { W, H, GY, CONFIG, DINO_H, DINO_X, applyJSONConfig, applyObstaclesConfig,
         CLOUD_COUNT, STAR_COUNT,
         CLOUD_Y_MIN, CLOUD_Y_RNG, CLOUD_W_MIN, CLOUD_W_RNG, CLOUD_SP_MIN, CLOUD_SP_RNG,
         STAR_Y_MARGIN,
         GROUND_PERIOD, GROUND_SCROLL_FACTOR,
         MOON_SCROLL_SPEED, MOON_SPAWN_MIN, MOON_SPAWN_RNG, MOON_CULL_MARGIN,
         CLOUD_SPEED_FACTOR, CLOUD_CULL_X, CLOUD_SPAWN_X,
         GAP_COEFF_INITIAL, GAP_COEFF_SCORE } from './game/config.js';
import { G } from './game/runtime.js';
import { Engine }            from './game/engine.js';
import { initRenderer, draw, rebuildSkyLayer } from './game/renderer.js';
import { initPlayer, updatePlayer, tickIdleAnimation, jump as playerJump, startDuck as playerStartDuck, endDuck as playerEndDuck } from './game/player.js';
import { initObstacles, updateObstacles } from './game/obstacles.js';
import { checkCollision }    from './game/physics.js';
import { setupInput, teardownInput } from './game/input.js';
import { initAudio, soundDie, soundMilestone, cancelSoundTimers, applyAudioConfig } from './game/audio.js';
import { backendName }       from './db/database.js';
import { addScore, getLeaderboard, clearLeaderboard } from './db/leaderboard.js';
import { getStats, saveStats, getPlayerName, savePlayerName } from './db/stats.js';

/* ───────────────────────────────────────────────────────────
   DOM VALIDATION
   Verify all required elements exist before touching the DOM.
   ─────────────────────────────────────────────────────────── */
(function validateDOM() {
  const required = [
    'bgCanvas',      'gameCanvas',    'uiCanvas',      'canvasStack',
    'gameFrame',
    'loadingScreen', 'loadingBar',  'loadingHint',
    'startScreen',   'gameOverScreen', 'pauseScreen',
    'go-score',      'go-hi',          'go-newbest',
    'restartBtn',    'jumpBtn',        'duckBtn',
    'pauseBtn',      'muteBtn',        'fullscreenBtn',
    'hdr-score',     'hdr-hi',         'speed-fill',
    'db-status',
    'stat-games',    'stat-best',      'stat-time',
    'stat-obs',      'stat-deaths',    'stat-dist',
    'lbBody',        'nameInput',      'nameSaveBtn',
    'currentName',   'clearLbBtn',     'resetHiBtn',
  ];
  const missing = required.filter((id) => !document.getElementById(id));
  if (missing.length) {
    throw new Error(
      'main.js: required DOM element(s) missing — check index.html\n' +
      'Missing IDs: ' + missing.join(', ')
    );
  }
}());

/* ───────────────────────────────────────────────────────────
   DOM ELEMENT CACHE
   ─────────────────────────────────────────────────────────── */
const DOM = {
  gameCanvas:     document.getElementById('gameCanvas'),
  bgCanvas:       document.getElementById('bgCanvas'),
  uiCanvas:       document.getElementById('uiCanvas'),
  loadingScreen:  document.getElementById('loadingScreen'),
  loadingBar:     document.getElementById('loadingBar'),
  loadingHint:    document.getElementById('loadingHint'),
  hdrScore:       document.getElementById('hdr-score'),
  hdrHi:          document.getElementById('hdr-hi'),
  speedFill:      document.getElementById('speed-fill'),
  dbStatus:       document.getElementById('db-status'),
  startScreen:    document.getElementById('startScreen'),
  gameOverScreen: document.getElementById('gameOverScreen'),
  pauseScreen:    document.getElementById('pauseScreen'),
  goScore:        document.getElementById('go-score'),
  goHi:           document.getElementById('go-hi'),
  goNewBest:      document.getElementById('go-newbest'),
  restartBtn:     document.getElementById('restartBtn'),
  pauseBtn:       document.getElementById('pauseBtn'),
  muteBtn:        document.getElementById('muteBtn'),
  fullscreenBtn:  document.getElementById('fullscreenBtn'),
  duckBtn:        document.getElementById('duckBtn'),
  jumpBtn:        document.getElementById('jumpBtn'),
  gameFrame:      document.getElementById('gameFrame'),
  currentName:    document.getElementById('currentName'),
  nameInput:      document.getElementById('nameInput'),
  nameSaveBtn:    document.getElementById('nameSaveBtn'),
  clearLbBtn:     document.getElementById('clearLbBtn'),
  resetHiBtn:     document.getElementById('resetHiBtn'),
  lbBody:         document.getElementById('lbBody'),
  statGames:      document.getElementById('stat-games'),
  statBest:       document.getElementById('stat-best'),
  statTime:       document.getElementById('stat-time'),
  statObs:        document.getElementById('stat-obs'),
  statDeaths:     document.getElementById('stat-deaths'),
  statDist:       document.getElementById('stat-dist'),
};

/* ── Storage badge ─────────────────────────────────────── */
DOM.dbStatus.textContent = backendName;

window.addEventListener('db:quota', function (e) {
  if (!e || !e.detail) return;
  const pct    = e.detail.total > 0 ? ((e.detail.used / e.detail.total) * 100).toFixed(1) : '?';
  const usedKB = (e.detail.used / 1024).toFixed(0);
  DOM.dbStatus.textContent = backendName + ' \xB7 ' + usedKB + 'KB (' + pct + '%)';
  DOM.dbStatus.style.removeProperty('color');
});

window.addEventListener('db:quotaFull', function () {
  DOM.dbStatus.textContent = 'STORAGE FULL \u26A0';
  DOM.dbStatus.style.setProperty('color', 'var(--danger)');
});

window.addEventListener('db:criticalFailure', function (e) {
  DOM.dbStatus.textContent = 'STORAGE FULL \u26A0 \u2014 Score not saved';
  DOM.dbStatus.style.setProperty('color', 'var(--danger)');

  // Read the specific failure message from the event detail, if available
  const failureMessage = (e && e.detail && e.detail.message)
    ? e.detail.message
    : 'Your score could not be saved because your browser\u2019s local storage is completely full.';

  alert(
    '\u26A0\uFE0F  STORAGE FULL\n\n' +
    failureMessage + '\n\n' +
    'To fix this:\n' +
    '  1. Clear browser data for this site\n' +
    '  2. Click \u201CCLEAR\u201D to wipe the leaderboard\n' +
    '  3. Close other tabs and try again'
  );
});

/* ───────────────────────────────────────────────────────────
   ENGINES
   ─────────────────────────────────────────────────────────── */
const engine     = new Engine(update, draw);
let   idleRafId  = null;

/**
 * Reset runtime game state to initial values and initialize gameplay subsystems for a new run.
 *
 * Resets score, speed, timers, counters, flags, and environmental state; repositions the moon;
 * initializes player and obstacle systems; clears any active duck input state; generates
 * cloud and star collections used by the renderer; and rebuilds the sky layer to reflect the
 * new environment.
 */
function initGame() {
  cancelSoundTimers();
  G.score           = 0;
  G.speed           = CONFIG.SPEED_MIN;
  G.dayPhase        = 0;
  G.frameCount      = 0;
  G.flashFrames     = 0;
  G.lastMilestone   = 0;
  G.groundScrollX   = 0;
  G._lastSpeedPct   = -1;
  G.gapCoefficient  = GAP_COEFF_INITIAL;
  G.moonX = MOON_SPAWN_MIN + Math.random() * MOON_SPAWN_RNG;

  initPlayer();
  initObstacles();

  // Clear duck input state to prevent stale button/key state carrying over
  G.duckHeld = false;
  const duckBtn = document.querySelector('#duckBtn');
  if (duckBtn) duckBtn.classList.remove('active');

  G.clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    G.clouds.push({
      x:  Math.random() * W,
      y:  CLOUD_Y_MIN + Math.random() * CLOUD_Y_RNG,
      w:  CLOUD_W_MIN + Math.random() * CLOUD_W_RNG,
      sp: CLOUD_SP_MIN + Math.random() * CLOUD_SP_RNG,
    });
  }

  G.stars = [];
  for (let j = 0; j < STAR_COUNT; j++) {
    G.stars.push({
      x: Math.random() * W,
      y: Math.random() * (GY - STAR_Y_MARGIN),
      r: Math.random() < 0.1 ? 2 : 1,
    });
  }

  rebuildSkyLayer();
}

/* ───────────────────────────────────────────────────────────
   GAME LIFECYCLE
   ─────────────────────────────────────────────────────────── */
function startGame() {
  stopIdleLoop();
  engine.stop();
  G.paused            = false;
  G.gameStartWallTime = performance.now();
  G.state             = 'running';
  initGame();
  DOM.startScreen.classList.add('hidden');
  DOM.startScreen.setAttribute('aria-hidden', 'true');
  DOM.gameOverScreen.classList.add('hidden');
  engine.resetTimer();
  engine.start();
}

function restart() {
  engine.stop();
  G.paused            = false;
  G.gameStartWallTime = performance.now();
  G.state             = 'running';
  initGame();
  DOM.gameOverScreen.classList.add('hidden');
  engine.resetTimer();
  engine.start();
}

/**
 * Transition the game into the "dead" state and finalize the run.
 *
 * Stops gameplay, records session and persistent statistics (score, time, deaths, obstacles),
 * attempts to add the score to the leaderboard and save DB stats, rolls back persistent changes
 * on storage failure, and updates leaderboard and game-over UI elements accordingly.
 */
function gameOver() {
  if (G.state === 'dead') return;
  G.state = 'dead';
  engine.stop();
  soundDie();

  G.sessionStats.games++;
  G.sessionStats.deaths++;
  const s = Math.floor(G.score);
  if (s > G.sessionStats.bestScore) G.sessionStats.bestScore = s;
  G.sessionStats.totalDist += s;

  const thisTime = Math.floor((performance.now() - G.gameStartWallTime) / 1000);
  if (thisTime > G.sessionStats.bestTime) G.sessionStats.bestTime = thisTime;

  const prevBest = Math.max(G.hiScore, G.dbStats.bestScore);
  const prevDbStats = { ...G.dbStats };
  if (s > G.hiScore) G.hiScore = s;

  G.dbStats.games++;
  G.dbStats.deaths++;
  G.dbStats.totalDist  += s;
  G.dbStats.obstacles  += G.gameObstacles;
  if (s > G.dbStats.bestScore) G.dbStats.bestScore = s;
  if (thisTime > (G.dbStats.bestTime || 0)) G.dbStats.bestTime = thisTime;

  const lb = addScore(G.playerName, s);
  if (lb) {
    if (!saveStats(G.dbStats)) {
      // saveStats failed — rollback
      G.hiScore = prevBest;
      G.dbStats = prevDbStats;
      const existingLb = getLeaderboard();
      renderLeaderboard(existingLb);
      console.warn('[Game] Stats not saved — storage full');
      DOM.dbStatus.textContent = 'STORAGE FULL \u26A0 \u2014 Score not saved';
      DOM.dbStatus.style.setProperty('color', 'var(--danger)');
    } else {
      renderLeaderboard(lb);
    }
  } else {
    // addScore failed — rollback
    const existingLb = getLeaderboard();
    G.dbStats = prevDbStats;
    G.hiScore = prevBest;
    saveStats(G.dbStats);
    console.warn('[Game] Score not saved — storage full');
    renderLeaderboard(existingLb);
    DOM.dbStatus.textContent = 'STORAGE FULL \u26A0 \u2014 Score not saved';
    DOM.dbStatus.style.setProperty('color', 'var(--danger)');
  }

  updateStatUI();

  DOM.goScore.textContent = 'SCORE ' + String(s).padStart(5, '0');
  DOM.goHi.textContent    = 'HI: '   + String(G.hiScore).padStart(5, '0');
  if (s > prevBest && lb) {
    DOM.goNewBest.classList.remove('hidden');
  } else {
    DOM.goNewBest.classList.add('hidden');
  }
  DOM.gameOverScreen.classList.remove('hidden');
}

/* ───────────────────────────────────────────────────────────
   PAUSE / FULLSCREEN
   ─────────────────────────────────────────────────────────── */
function togglePause() {
  if (G.state !== 'running' && G.state !== 'paused') return;
  initAudio();
  if (!G.paused) {
    G.paused        = true;
    G.state         = 'paused';
    G.pauseStartTime = performance.now();
    engine.stop();
    DOM.pauseScreen.classList.remove('hidden');
    DOM.pauseBtn.classList.add('active');
    DOM.pauseBtn.setAttribute('aria-pressed', 'true');
  } else {
    G.paused            = false;
    G.state             = 'running';
    G.gameStartWallTime += (performance.now() - G.pauseStartTime);
    DOM.pauseScreen.classList.add('hidden');
    DOM.pauseBtn.classList.remove('active');
    DOM.pauseBtn.setAttribute('aria-pressed', 'false');
    engine.resetTimer();
    engine.start();
  }
}

function toggleFullscreen() {
  const el   = DOM.gameFrame;
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  if (!isFs) {
    const req = el.requestFullscreen
      ? el.requestFullscreen()
      : el.webkitRequestFullscreen
        ? el.webkitRequestFullscreen()
        : null;
    if (req && req.catch) req.catch((err) => console.warn('[Fullscreen]', err));
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}

function onFullscreenChange() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  DOM.fullscreenBtn.textContent = isFs ? 'EXIT FS' : 'FULL';
  DOM.fullscreenBtn.classList.toggle('active', isFs);
}
document.addEventListener('fullscreenchange',       onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

// Clean up all input event listeners when the page is torn down.
// Prevents the listener leak from accumulating across hot-reloads in dev.
window.addEventListener('unload', teardownInput);

/* ───────────────────────────────────────────────────────────
   UPDATE (called every frame by engine)
   ─────────────────────────────────────────────────────────── */
function update(dt) {
  G.frameCount++;

  // Physics — update world first
  updatePlayer(dt);
  updateObstacles(dt);

  // Collision check FIRST (matches Runner.update reference):
  // score & speed only increment when there is NO collision.
  if (checkCollision()) { gameOver(); return; }

  // Score & speed — only reached when NOT dead (matches reference)
  G.score += G.speed * CONFIG.SCORE_COEFF * dt;
  if (G.speed < CONFIG.SPEED_MAX) {
    G.speed += CONFIG.ACCELERATION * dt;
    if (G.speed > CONFIG.SPEED_MAX) G.speed = CONFIG.SPEED_MAX;
  }

  // gapCoefficient grows with score (GAP_COEFF_INITIAL → 1.0 over GAP_COEFF_SCORE pts)
  G.gapCoefficient = Math.min(1.0, GAP_COEFF_INITIAL + G.score / GAP_COEFF_SCORE);

  // Milestone flash every 100 pts
  const ms = Math.floor(G.score / 100);
  if (ms > G.lastMilestone) {
    G.lastMilestone = ms;
    G.flashFrames   = 8;
    soundMilestone();
  }

  // Day / Night cycle (starts at DAY_START_SCORE)
  if (G.score > CONFIG.DAY_START_SCORE) {
    G.dayPhase = Math.min(G.dayPhase + CONFIG.DAY_CYCLE_SPEED * dt, 1);
  }

  // Clouds
  G.clouds.forEach((c) => {
    c.x -= c.sp * (G.speed * CLOUD_SPEED_FACTOR) * dt;
    if (c.x < CLOUD_CULL_X) c.x = W + CLOUD_SPAWN_X;
  });

  // Moon scroll
  G.moonX -= MOON_SCROLL_SPEED * dt;
  if (G.moonX < -MOON_CULL_MARGIN) G.moonX = W + MOON_CULL_MARGIN;

  // Ground scroll
  G.groundScrollX = (G.groundScrollX + G.speed * GROUND_SCROLL_FACTOR * dt) % GROUND_PERIOD;

  // HUD dedup
  const sc    = Math.floor(G.score);
  const scStr = String(sc).padStart(5, '0');
  if (scStr !== G._lastHdrScore) { DOM.hdrScore.textContent = scStr; G._lastHdrScore = scStr; }
  const hiStr = String(Math.max(sc, G.hiScore)).padStart(5, '0');
  if (hiStr !== G._lastHdrHi)    { DOM.hdrHi.textContent = hiStr;   G._lastHdrHi    = hiStr; }

  const newSpeedPct = Math.min(
    (CONFIG.SPEED_MAX - CONFIG.SPEED_MIN) > 0
      ? ((G.speed - CONFIG.SPEED_MIN) / (CONFIG.SPEED_MAX - CONFIG.SPEED_MIN)) * 100
      : 0,
    100
  ) | 0;
  if (newSpeedPct !== G._lastSpeedPct) {
    DOM.speedFill.style.width = newSpeedPct + '%';
    DOM.speedFill.parentElement.parentElement.setAttribute('aria-valuenow', newSpeedPct);
    G._lastSpeedPct = newSpeedPct;
  }
}

/* ───────────────────────────────────────────────────────────
   IDLE LOOP
   ─────────────────────────────────────────────────────────── */
function idleLoop() {
  tickIdleAnimation();
  draw();
  if (G.state === 'idle') idleRafId = requestAnimationFrame(idleLoop);
}

function stopIdleLoop() {
  if (idleRafId !== null) { cancelAnimationFrame(idleRafId); idleRafId = null; }
}

/* ───────────────────────────────────────────────────────────
   UI HELPERS
   ─────────────────────────────────────────────────────────── */
function updateStatUI() {
  DOM.statGames.textContent  = G.sessionStats.games;
  DOM.statBest.textContent   = Math.max(G.sessionStats.bestScore, G.dbStats.bestScore);
  DOM.statObs.textContent    = G.sessionStats.obstacles;
  DOM.statDeaths.textContent = G.sessionStats.deaths;
  DOM.statDist.textContent   = G.sessionStats.totalDist;
  const bt = Math.max(G.sessionStats.bestTime, G.dbStats.bestTime || 0);
  DOM.statTime.textContent   = bt ? (Math.floor(bt / 60) + 'm ' + (bt % 60) + 's') : '0s';
}

function renderLeaderboard(lb) {
  const tbody = DOM.lbBody;
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

  if (!lb || !lb.length) {
    const empty   = document.createElement('tr');
    const emptyTd = document.createElement('td');
    emptyTd.setAttribute('colspan', '4');
    emptyTd.className   = 'lb-empty';
    emptyTd.textContent = 'NO RECORDS YET';
    empty.appendChild(emptyTd);
    tbody.appendChild(empty);
    return;
  }

  const medals = ['var(--ce-gold)', 'var(--ce-silver)', 'var(--ce-bronze)'];
  lb.forEach((entry, i) => {
    const tr    = document.createElement('tr');
    const color = medals[i] || null;

    const cols  = [String(i + 1), entry.name || 'ANON', String(entry.score).padStart(5, '0'), entry.when || entry.date || '--'];

    cols.forEach((val, ci) => {
      const td = document.createElement('td');

      if (ci === 0) {
        const badge       = document.createElement('span');
        badge.className   = 'rank-badge';
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
   INPUT WIRING
   ─────────────────────────────────────────────────────────── */
function doJump()      { playerJump(startGame, restart); }
function doStartDuck() { playerStartDuck(DOM.duckBtn); }
function doEndDuck()   { playerEndDuck(DOM.duckBtn); }

setupInput(DOM, {
  jump:             doJump,
  startDuck:        doStartDuck,
  endDuck:          doEndDuck,
  togglePause:      togglePause,
  toggleFullscreen: toggleFullscreen,
  restart:          restart,
});

/* ── Player name ────────────────────────────────────────── */
DOM.nameSaveBtn.addEventListener('click', function () {
  const raw  = (DOM.nameInput.value || '').toUpperCase().trim() || 'ANON';
  G.playerName = raw.slice(0, 10);
  savePlayerName(G.playerName);
  DOM.currentName.textContent = '\u25B6 ' + G.playerName;
  DOM.nameInput.value = '';
});
DOM.nameInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') DOM.nameSaveBtn.click();
});

/* ── Clear leaderboard ──────────────────────────────────── */
DOM.clearLbBtn.addEventListener('click', function () {
  if (!confirm('Clear all leaderboard records?')) return;
  clearLeaderboard();
  G.dbStats.bestScore = 0;
  G.dbStats.bestTime  = 0;
  saveStats(G.dbStats);
  G.sessionStats.bestScore = 0;
  G.sessionStats.bestTime  = 0;
  renderLeaderboard([]);
  G.hiScore    = 0;
  G._lastHdrHi = '';
  DOM.hdrHi.textContent = '00000';
  updateStatUI();
});

/* ── Reset top score ────────────────────────────────────── */
DOM.resetHiBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  if (!confirm('Reset top score to 00000?')) return;
  G.hiScore = 0;
  G.dbStats.bestScore = 0;
  saveStats(G.dbStats);
  G.sessionStats.bestScore = 0;
  G._lastHdrHi = '';
  DOM.hdrHi.textContent = '00000';
  updateStatUI();
});

/* ───────────────────────────────────────────────────────────
   VISIBILITY / FOCUS — auto-pause when tab is backgrounded
   ─────────────────────────────────────────────────────────── */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    if (G.state === 'running' && !G.paused) {
      togglePause();
    } else {
      engine.stop();
      stopIdleLoop();
    }
  } else {
    if (G.state === 'running' && !G.paused) {
      engine.resetTimer();
      engine.start();
    } else if (G.state === 'idle') {
      idleRafId = requestAnimationFrame(idleLoop);
    } else {
      // 'paused' or 'dead' — some browsers discard the canvas backing store
      // when a tab is backgrounded; repaint so the game-over / pause screen
      // doesn't appear blank on return.
      draw();
    }
  }
});

/* ───────────────────────────────────────────────────────────
   BOOT
   ─────────────────────────────────────────────────────────── */
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

(async function boot() {
  // ── Loading screen helpers ─────────────────────────────
  function loadProgress(pct, hint) {
    DOM.loadingBar.style.width  = pct + '%';
    if (hint) DOM.loadingHint.textContent = hint;
  }
  /**
   * Hide the loading screen and reveal the start screen.
   *
   * Updates UI state by adding the `hidden` class to the loading screen, removing the
   * `hidden` class from the start screen, and setting the start screen's `aria-hidden`
   * attribute to `"false"` for accessibility.
   */
  function hideLoading() {
    DOM.loadingScreen.classList.add('hidden');
    DOM.startScreen.classList.remove('hidden');
    DOM.startScreen.setAttribute('aria-hidden', 'false');
  }

  try {
    loadProgress(10, 'Loading config\u2026');

  // Load tunable values from data/config.json before anything touches CONFIG
  try {
    const jsonConfig = await loadJSON('data/config.json');
    applyJSONConfig(jsonConfig);
  } catch (err) {
    console.warn('[boot] Could not load data/config.json — using defaults:', err);
  }

  // Load obstacle tuning from data/obstacles.json
  try {
    const jsonObstacles = await loadJSON('data/obstacles.json');
    applyObstaclesConfig(jsonObstacles);
  } catch (err) {
    console.warn('[boot] Could not load data/obstacles.json — using defaults:', err);
  }

  // Load audio paths from data/audio.json (must run before initAudio)
  try {
    const jsonAudio = await loadJSON('data/audio.json');
    applyAudioConfig(jsonAudio);
  } catch (err) {
    console.warn('[boot] Could not load data/audio.json — using defaults:', err);
  }

  loadProgress(35, 'Initialising renderer\u2026');
  initRenderer();

  loadProgress(60, 'Loading save data\u2026');

  try {
    G.playerName = getPlayerName();
    DOM.currentName.textContent = '\u25B6 ' + G.playerName;

    renderLeaderboard(getLeaderboard());

    G.dbStats = getStats();
    G.hiScore = G.dbStats.bestScore || 0;
    const hiStr = String(G.hiScore).padStart(5, '0');
    DOM.hdrHi.textContent = hiStr;
    G._lastHdrHi = hiStr;
    DOM.statBest.textContent = G.dbStats.bestScore || 0;
    const bt = G.dbStats.bestTime || 0;
    DOM.statTime.textContent = bt ? (Math.floor(bt / 60) + 'm ' + (bt % 60) + 's') : '0s';
  } catch (err) {
    console.warn('Boot DB error (non-fatal):', err);
  }

  loadProgress(85, 'Building game world\u2026');
  initGame();
  G.state = 'idle';

  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  loadProgress(100, 'Ready!');

  // Brief pause so the user sees 100 % before the loading screen disappears.
  await new Promise((resolve) => setTimeout(resolve, 180));
  hideLoading();

  draw();
  idleRafId = requestAnimationFrame(idleLoop);

  } catch (err) {
    // Any uncaught error in the boot sequence would otherwise leave the
    // loading screen up forever with no feedback. Surface it visibly.
    console.error('[boot] Fatal error — game could not start:', err);
    DOM.loadingHint.textContent = 'ERROR: ' + (err && err.message ? err.message : String(err));
    DOM.loadingBar.style.background = 'var(--danger)';
  }
}());
