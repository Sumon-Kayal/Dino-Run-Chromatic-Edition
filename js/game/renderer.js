/* ═══════════════════════════════════════════════════════════
   renderer.js — Three-layer canvas renderer
   ───────────────────────────────────────────────────────────
   LAYER ARCHITECTURE (P2 improvement):
     bgCanvas  (alpha:false) — sky fill, ground line, stars.
               Redrawn ONLY when the day/night palette changes.
               No clear needed between frames — bg is always opaque.
     gameCanvas (transparent) — scrolling ground dots, moon, clouds,
               obstacles, dino.  Cleared + redrawn every frame.
     uiCanvas  (transparent) — HUD score text, milestone flash.
               Cleared + redrawn every frame.

   vs. the old single-canvas approach, this eliminates:
     • One full-canvas drawImage blit per frame (skyCanvas → main)
     • Clearing and repainting the static background each frame
     giving a measurable FPS headroom at high game speeds.

   OTHER PERF FIXES (carried forward):
     FIX #2 — Sprite caching: dino/cactus/ptera frames pre-rendered
              to offscreen canvases; each draw is one drawImage().
     FIX #3 — Speed-bar lerpRGB pre-computed into a 101-entry LUT;
              no hex-string parsing per frame.
   ═══════════════════════════════════════════════════════════ */
'use strict';

import {
  W, H, GY, CONFIG,
  C, _pal, _lastDayPhase, setLastDayPhase,
  HUD_SCORE_X, HUD_HI_X, HUD_FONT, HUD_Y,
  GROUND_PERIOD,
} from './config.js';
import { G } from './runtime.js';

// ── Layer contexts ────────────────────────────────────────
let bgCtx   = null;   // background layer (sky / stars / ground line)
let ctx     = null;   // game layer      (entities / clouds / moon)
let uiCtx   = null;   // ui layer        (HUD text / flash)

// Fill-style dedup for the game layer — skip redundant .fillStyle assignments
let _lastFill = '';
function setFill(color) {
  if (color !== _lastFill) { ctx.fillStyle = color; _lastFill = color; }
}

// ── Colour math ───────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

function lerpRGB(ca, cb, t) {
  const pa = parseInt(ca.slice(1), 16);
  const pb = parseInt(cb.slice(1), 16);
  const r  = (lerp((pa >> 16) & 0xff, (pb >> 16) & 0xff, t)) | 0;
  const g  = (lerp((pa >>  8) & 0xff, (pb >>  8) & 0xff, t)) | 0;
  const bl = (lerp( pa        & 0xff,  pb        & 0xff, t)) | 0;
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

// ── FIX #3: Speed-bar colour LUT ─────────────────────────
const SPEED_BAR_LUTS = (function buildLUT() {
  const lut = new Array(101);
  for (let i = 0; i <= 100; i++) {
    const pct = i / 100;
    lut[i] = pct < 0.5
      ? lerpRGB('#1a73e8', '#e67e22', pct * 2)
      : lerpRGB('#e67e22', '#c0392b', (pct - 0.5) * 2);
  }
  return lut;
}());

// ── Background layer ──────────────────────────────────────
// Draws the static scene onto bgCtx.
// Called once at init and again whenever the day/night palette changes.
// Because bgCanvas has alpha:false, we simply overwrite — no clearRect needed.
export function rebuildSkyLayer() {
  redrawBgLayer();
}

function redrawBgLayer() {
  if (!bgCtx || !_pal.bgC) return;

  // Sky fill (covers the whole canvas — alpha:false means no compositing cost)
  bgCtx.fillStyle = _pal.bgC;
  bgCtx.fillRect(0, 0, W, H);

  // Ground line
  bgCtx.fillStyle = _pal.fgC;
  bgCtx.fillRect(0, GY, W, 2);

  // Stars (fade in with night)
  if (G.dayPhase > 0.1) {
    bgCtx.globalAlpha = G.dayPhase * 0.6;
    bgCtx.fillStyle   = _pal.fgDark;
    G.stars.forEach((s) => bgCtx.fillRect(s.x, s.y, s.r, s.r));
    bgCtx.globalAlpha = 1;
  }
}

// ── FIX #2: Sprite cache ──────────────────────────────────
const spriteCache = {};

function makeOffscreen(w, h) {
  const cvs = document.createElement('canvas');
  cvs.width  = w;
  cvs.height = h;
  return { cvs, ctx: cvs.getContext('2d') };
}

function _px(sctx, color, x, y, w, h) {
  sctx.fillStyle = color;
  sctx.fillRect(x | 0, y | 0, w, h);
}

function buildDinoSprite(key, frame, jumping, ducking, fgC, fgDark, bgC) {
  const W_S = 56, H_S = 60;
  const entry = makeOffscreen(W_S, H_S);
  const sc = entry.ctx;
  sc.clearRect(0, 0, W_S, H_S);
  const c = fgC, ca = fgDark, ey = bgC;

  if (ducking) {
    _px(sc, c,  14, 0,  28, 4);
    _px(sc, c,  10, 4,  32, 8);
    _px(sc, c,  14, 10,  4, 4);
    _px(sc, c,  20, 10, 20, 4);
    _px(sc, ey, 32, 3,   5, 5);
    _px(sc, c,   0, 8,   8, 6);
    _px(sc, c,   2, 8,  36, 8);
    _px(sc, c,   4, 14, 32, 6);
    const lf = frame === 0 ? [12, 24] : [18, 30];
    _px(sc, c, lf[0],   18, 6, 10);
    _px(sc, c, lf[0]-2, 22, 12, 6);
    _px(sc, c, lf[1],   18, 6, 8);
    _px(sc, c, lf[1]+2, 22, 10, 4);
  } else {
    _px(sc, c,  20, 0,  22, 4);
    _px(sc, c,  14, 4,  30, 12);
    _px(sc, c,  16, 14,  4, 4);
    _px(sc, c,  22, 14, 22, 6);
    _px(sc, ey, 30, 4,   6, 6);
    _px(sc, c,  14, 18, 12, 4);
    _px(sc, c,   4, 18, 34, 6);
    _px(sc, c,   2, 24, 36, 10);
    _px(sc, c,   4, 34, 28, 6);
    _px(sc, c,   8, 38, 20, 4);
    _px(sc, ca,  0, 22, 10, 6);
    _px(sc, ca,  0, 28,  6, 6);
    _px(sc, ca,  2, 32,  4, 4);
    _px(sc, ca, 22, 22,  8, 4);
    _px(sc, ca, 24, 26,  6, 4);
    if (!jumping) {
      const fL = frame === 0 ? 14 : 22;
      const bL = frame === 0 ? 26 : 10;
      _px(sc, c, fL,   42, 8, 10);
      _px(sc, c, fL-2, 48, 14, 4);
      _px(sc, c, bL,   42, 8, 8);
      _px(sc, c, bL+2, 46, 12, 4);
    } else {
      _px(sc, c, 12, 42,  8, 8);
      _px(sc, c, 10, 46, 14, 4);
      _px(sc, c, 26, 42,  8, 6);
      _px(sc, c, 26, 44, 12, 4);
    }
  }
  entry.color = fgC + '|' + fgDark + '|' + bgC;
  spriteCache[key] = entry;
}

function buildCactusSprite(key, w, h, fgC) {
  const entry = makeOffscreen(w, h);
  const sc = entry.ctx;
  sc.clearRect(0, 0, w, h);
  const sw = 6, aw = 6, cx = Math.floor(w / 2) - 3;
  sc.fillStyle = fgC;
  sc.fillRect(cx, 0, sw, h);
  const ljy = Math.floor(h * 0.30), lup = Math.floor(h * 0.24);
  sc.fillRect(0,       ljy,       cx + sw, aw);
  sc.fillRect(0,       ljy - lup, aw, lup + aw);
  const rjy = Math.floor(h * 0.46), rup = Math.floor(h * 0.20), rx = cx + sw;
  sc.fillRect(rx,      rjy,       w - rx, aw);
  sc.fillRect(w - aw,  rjy - rup, aw, rup + aw);
  entry.color = fgC;
  spriteCache[key] = entry;
}

function buildPteraSprite(key, frame, fgC, bgC) {
  const W_S = 48, H_S = 32;
  const entry = makeOffscreen(W_S, H_S);
  const sc = entry.ctx;
  sc.clearRect(0, 0, W_S, H_S);
  const c = fgC, ey = bgC;
  _px(sc, c,  12,  8, 22, 10);
  _px(sc, c,  28,  4, 10, 12);
  _px(sc, c,  36,  6,  8,  4);
  _px(sc, c,  40,  8,  4,  2);
  _px(sc, ey, 31,  5,  4,  4);
  _px(sc, c,   8, 12,  6,  4);
  _px(sc, c,   4, 14,  6,  4);
  _px(sc, c,   0, 16,  4,  2);
  if (frame === 0) {
    _px(sc, c,  2,  0, 12,  4);
    _px(sc, c,  6,  4, 10,  4);
    _px(sc, c, 12,  8,  6,  4);
    _px(sc, c, 22,  4,  8,  4);
    _px(sc, c, 26,  0, 10,  4);
  } else {
    _px(sc, c,  6, 18, 10,  4);
    _px(sc, c,  2, 22, 10,  4);
    _px(sc, c,  0, 24,  8,  4);
    _px(sc, c, 22, 18, 10,  4);
    _px(sc, c, 28, 22,  8,  4);
    _px(sc, c, 30, 24,  8,  4);
  }
  entry.color = fgC + '|' + bgC;
  spriteCache[key] = entry;
}

function rebuildSprites() {
  const { fgC, fgDark, bgC } = _pal;
  buildDinoSprite('dino_run0',  0, false, false, fgC, fgDark, bgC);
  buildDinoSprite('dino_run1',  1, false, false, fgC, fgDark, bgC);
  buildDinoSprite('dino_jump',  0, true,  false, fgC, fgDark, bgC);
  buildDinoSprite('dino_duck0', 0, false, true,  fgC, fgDark, bgC);
  buildDinoSprite('dino_duck1', 1, false, true,  fgC, fgDark, bgC);
  buildPteraSprite('ptera_0', 0, fgC, bgC);
  buildPteraSprite('ptera_1', 1, fgC, bgC);
  for (const k of Object.keys(spriteCache)) {
    if (k.startsWith('cactus_')) delete spriteCache[k];
  }
}

// ── Sprite draw helpers (game layer) ─────────────────────
function drawDino(x, y, frame, jumping, ducking) {
  let key;
  if (ducking)      key = frame === 0 ? 'dino_duck0' : 'dino_duck1';
  else if (jumping) key = 'dino_jump';
  else              key = frame === 0 ? 'dino_run0'  : 'dino_run1';
  const sp = spriteCache[key];
  if (sp) ctx.drawImage(sp.cvs, x | 0, y | 0);
}

function drawCactus(x, y, w, h) {
  const key = 'cactus_' + w + '_' + h;
  let sp = spriteCache[key];
  if (!sp || sp.color !== _pal.fgC) {
    buildCactusSprite(key, w, h, _pal.fgC);
    sp = spriteCache[key];
  }
  ctx.drawImage(sp.cvs, x | 0, y | 0);
}

function drawCloud(x, y, w) {
  setFill(C.cloud);
  ctx.fillRect( x            | 0,  y      | 0, w,        10);
  ctx.fillRect((x + 10)      | 0, (y - 8) | 0, w * 0.5,  10);
  ctx.fillRect((x + w * 0.4) | 0, (y - 6) | 0, w * 0.4,   8);
}

function drawPtera(x, y, frame) {
  const sp = spriteCache['ptera_' + frame];
  if (sp) ctx.drawImage(sp.cvs, x | 0, y | 0);
}

// ── Main draw — called every frame ───────────────────────
export function draw() {
  // ── Palette update (cheap: only runs when dayPhase changes) ──
  if (G.dayPhase !== _lastDayPhase) {
    setLastDayPhase(G.dayPhase);
    _pal.bgC    = lerpRGB('#ffffff', '#404040', G.dayPhase);
    _pal.fgC    = lerpRGB('#535353', '#f0f0f0', G.dayPhase);
    _pal.fgDark = lerpRGB('#404040', '#d0d0d0', G.dayPhase);
    _pal.dimC   = lerpRGB('#d4d4d4', '#606060', G.dayPhase);
    // BG layer: repaint static scene with new palette colours
    redrawBgLayer();
    // Sprite cache: repaint all offscreen sprites in new palette
    rebuildSprites();
  }
  const { fgC, fgDark, dimC, bgC } = _pal;

  C.dino    = fgC;
  C.dinoAcc = fgDark;
  C.cactus  = fgC;
  C.ptera   = fgC;
  C.cloud   = dimC;
  C.eye     = bgC;

  // ── Game layer — clear and repaint moving entities ────────
  ctx.clearRect(0, 0, W, H);
  // Re-apply smoothing — some browsers reset it after clearRect
  ctx.imageSmoothingEnabled = false;
  _lastFill = '';

  // Scrolling ground texture dots
  setFill(dimC);
  for (let gx = -(G.groundScrollX | 0); gx < W; gx += GROUND_PERIOD) {
    ctx.fillRect(gx,                     GY + 8,  2, 1);
    ctx.fillRect(gx + GROUND_PERIOD / 2, GY + 14, 3, 1);
  }

  // Moon (fades in with dayPhase)
  if (G.dayPhase > 0.05) {
    ctx.globalAlpha = Math.min(G.dayPhase * 1.8, 1);
    const my = 40, mr = 14;
    setFill(fgC);
    ctx.beginPath(); ctx.arc(G.moonX | 0, my, mr, 0, Math.PI * 2); ctx.fill();
    setFill(bgC);
    ctx.beginPath(); ctx.arc((G.moonX - 5) | 0, my - 2, mr - 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Clouds
  G.clouds.forEach((c) => drawCloud(c.x, c.y, c.w));

  // Obstacles
  G.obstacles.forEach((o) => {
    if (o.type === 'cactus') {
      const n = o.count || 1, sw = o.singleW || o.w;
      for (let k = 0; k < n; k++) drawCactus(o.x + k * (sw + 6), o.y, sw, o.h);
    } else if (o.type === 'ptera') {
      drawPtera(o.x, o.y, o.frame);
    }
  });

  // Dino
  drawDino(G.dino.x, G.dino.y, G.dino.frame, G.dino.jumping, G.dino.ducking);

  // ── UI layer — clear and repaint HUD ─────────────────────
  uiCtx.clearRect(0, 0, W, H);
  uiCtx.imageSmoothingEnabled = false;

  // HUD score text
  uiCtx.textBaseline = 'top';
  uiCtx.font         = HUD_FONT;
  uiCtx.fillStyle    = fgDark;
  uiCtx.fillText(String(Math.floor(G.score)).padStart(5, '0'), HUD_SCORE_X, HUD_Y);
  uiCtx.fillStyle    = dimC;
  uiCtx.fillText('HI ' + String(G.hiScore).padStart(5, '0'), HUD_HI_X, HUD_Y);
  uiCtx.textBaseline = 'alphabetic';

  // Milestone flash (full-screen tint on the UI layer)
  if (G.flashFrames > 0) {
    uiCtx.globalAlpha = (G.flashFrames / 8) * 0.4;
    uiCtx.fillStyle   = fgC;
    uiCtx.fillRect(0, 0, W, H);
    uiCtx.globalAlpha = 1;
    G.flashFrames--;
  }

  // FIX #3: Speed bar — LUT avoids lerpRGB() per frame
  const speedPct = Math.max(0, Math.min(
    (CONFIG.SPEED_MAX - CONFIG.SPEED_MIN) > 0
      ? (G.speed - CONFIG.SPEED_MIN) / (CONFIG.SPEED_MAX - CONFIG.SPEED_MIN)
      : 0,
    1
  ));
  const barPx  = (speedPct * W) | 0;
  const lutIdx = Math.max(0, Math.min((speedPct * 100) | 0, 100));
  const barCol = SPEED_BAR_LUTS[lutIdx];
  uiCtx.fillStyle = barCol;
  uiCtx.fillRect(0, H - 4, barPx, 4);
  uiCtx.fillStyle = dimC;
  uiCtx.fillRect(barPx, H - 4, W - barPx, 4);
}

// ── Canvas setup helper ───────────────────────────────────
// Applies crisp-pixel flags and HiDPI scaling to a single canvas.
// Returns the context. Extracted so it can be called identically for
// all three layers without duplicating the DPR / smoothing boilerplate.
function setupCanvas(canvasEl, contextOptions) {
  const context = canvasEl.getContext('2d', contextOptions || {});
  if (!context) throw new Error('renderer: 2D context unavailable on ' + canvasEl.id);

  // Disable smoothing (all vendor prefixes)
  context.imageSmoothingEnabled = false;
  if ('webkitImageSmoothingEnabled' in context) context.webkitImageSmoothingEnabled = false;
  if ('mozImageSmoothingEnabled'    in context) context.mozImageSmoothingEnabled    = false;
  if ('msImageSmoothingEnabled'     in context) context.msImageSmoothingEnabled     = false;

  // HiDPI / Retina scaling
  const dpr = window.devicePixelRatio || 1;
  if (dpr > 1) {
    const cssW = canvasEl.offsetWidth  || W;
    const cssH = canvasEl.offsetHeight || H;
    canvasEl.width  = Math.round(cssW * dpr);
    canvasEl.height = Math.round(cssH * dpr);
    canvasEl.style.width  = cssW + 'px';
    canvasEl.style.height = cssH + 'px';
    context.scale(dpr, dpr);
    // Re-apply after scale (some browsers reset it)
    context.imageSmoothingEnabled = false;
  }

  return context;
}

/**
 * Initialise all three canvas layers.
 * Must be called once, after the DOM is ready, before any drawing.
 */
export function initRenderer() {
  const bgCanvas   = document.getElementById('bgCanvas');
  const gameCanvas = document.getElementById('gameCanvas');
  const uiCanvas   = document.getElementById('uiCanvas');

  // bgCanvas is opaque (alpha:false) — the browser can skip blending entirely
  // when compositing it against the page background, saving a per-pixel multiply.
  bgCtx  = setupCanvas(bgCanvas,   { alpha: false });
  ctx    = setupCanvas(gameCanvas,  {});
  uiCtx  = setupCanvas(uiCanvas,    {});

  // Seed the palette and pre-build sprite cache with day colours
  _pal.bgC    = '#ffffff';
  _pal.fgC    = '#535353';
  _pal.fgDark = '#404040';
  _pal.dimC   = '#d4d4d4';
  rebuildSprites();
}