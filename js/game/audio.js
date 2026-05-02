/* ═══════════════════════════════════════════════════════════
   audio.js — Web Audio API: OGG sounds loaded from assets/audio/
   Graceful fallback to synthesised beeps if fetch/decode fails.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const AudioCtxCtor = window.AudioContext || window.webkitAudioContext;
let audioCtx        = null;
let soundMuted      = false;
let _soundTimers    = [];

// Decoded AudioBuffer cache
const _buffers = { jump: null, die: null, milestone: null };

// Load state: 'idle' | 'loading' | 'ready' | 'failed'
let _loadState = 'idle';

export function getSoundMuted() { return soundMuted; }
export function setSoundMuted(v) { soundMuted = v; }

export function initAudio() {
  if (!AudioCtxCtor) return;
  try {
    if (!audioCtx) audioCtx = new AudioCtxCtor();
    if (_loadState === 'idle' || _loadState === 'failed') _loadAllBuffers();
  } catch (e) { audioCtx = null; }
}

export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
}

// ── Buffer loading via fetch ─────────────────────────────
// P2 FIX: Safari and iOS WebKit do not support OGG Vorbis at all — attempting
// to decode an .ogg file returns a DOMException and audio falls back to
// synthesised beeps.  We probe canPlayType() once at load time and select the
// right extension so Safari can use the MP3 variants.
const _audioExt = (function detectAudioFormat() {
  if (typeof Audio === 'undefined') return '.ogg';
  const probe = new Audio();
  if (probe.canPlayType('audio/ogg; codecs="vorbis"') !== '') return '.ogg';
  if (probe.canPlayType('audio/mpeg')                 !== '') return '.mp3';
  return '.ogg'; // best-guess fallback; will fail gracefully
}());

const _SND_FILES = {
  jump:      'assets/audio/jump'      + _audioExt,
  die:       'assets/audio/die'       + _audioExt,
  milestone: 'assets/audio/milestone' + _audioExt,
};

/**
 * Override audio file paths from data/audio.json.
 * The JSON may specify any extension — it is stripped and replaced
 * with the browser-detected format (_audioExt) so Safari gets .mp3
 * and everything else gets .ogg regardless of what the JSON says.
 * Call this before the first user interaction (before initAudio).
 */
export function applyAudioConfig(json) {
  if (!json) return;
  ['jump', 'die', 'milestone'].forEach(function (key) {
    if (typeof json[key] === 'string') {
      const base = json[key].replace(/\.[^/.]+$/, ''); // strip extension
      _SND_FILES[key] = base + _audioExt;
    }
  });
}

function _loadBuffer(key, url) {
  return fetch(url)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    })
    .then(function(ab) {
      return new Promise(function(resolve, reject) {
        audioCtx.decodeAudioData(ab, resolve, reject);
      });
    })
    .then(function(decoded) {
      _buffers[key] = decoded;
      return true;       
    })
    .catch(function(err) {
      console.warn('[Audio] Failed to load ' + key + ' (' + url + '):', err);
      return false;  // signal failure
    });
}

function _loadAllBuffers() {
  if (!audioCtx) return;
  _loadState = 'loading';
  Promise.all(
    Object.keys(_SND_FILES).map(function(k) {
      return _loadBuffer(k, _SND_FILES[k]);
    })
  ).then(function(results) {
    _loadState = results.every(Boolean) ? 'ready' : 'failed';
  });
}

/**
 * Play a cached AudioBuffer corresponding to the provided sound key.
 * Attempts to schedule playback using the shared AudioContext; if the specific buffer is still loading, returns `null` to indicate a deferred fallback should be used.
 * @param {string} key - Sound key identifying the cached buffer (e.g., "jump", "die", "milestone").
 * @param {number} [vol] - Playback gain multiplier (defaults to 1.0 when omitted).
 * @returns {true | null | false} `true` if playback was successfully scheduled, `null` if the requested buffer is still loading, `false` if muted, no audio context, the buffer is missing, or scheduling failed.
 */
function _playBuffer(key, vol) {
  if (soundMuted || !audioCtx) return false;
  // Per-key check first: if this buffer loaded successfully, play it regardless
  // of whether other files failed. _loadState==='failed' only means at least one
  // OTHER key failed — it should not silence a successfully-loaded buffer.
  if (_loadState === 'loading' && !_buffers[key]) return null;
  if (!_buffers[key]) return false;
  resumeAudio();
  try {
    const src  = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = _buffers[key];
    src.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(vol || 1.0, audioCtx.currentTime);
    src.start(audioCtx.currentTime);
    return true;
  } catch (e) { return false; }
}

// ── Fallback synth beeps ──────────────────────────────────
function _scheduleSound(fn, delay) {
  _soundTimers.push(setTimeout(fn, delay));
}

export function cancelSoundTimers() {
  _soundTimers.forEach(function(id) { clearTimeout(id); });
  _soundTimers = [];
}

export function playBeep(freq, type, dur, vol, endF) {
  if (soundMuted || !audioCtx) return;
  resumeAudio();
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = type || 'square';
    const t = audioCtx.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    if (endF) osc.frequency.exponentialRampToValueAtTime(endF, t + dur);
    gain.gain.setValueAtTime(vol || 0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
  } catch (e) { console.warn('[Audio] playBeep:', e); }
}

// ── Public sound functions ────────────────────────────────
// _playBuffer returns true (played), false (unavailable/failed), or
// null (still loading). Treat null the same as false so the synth
// fallback fires on early actions before the fetch completes.
export function soundJump() {
  const result = _playBuffer('jump', 0.9);
  if (result !== true)
    playBeep(400, 'square', 0.12, 0.07, 880);
}

export function soundDie() {
  const result = _playBuffer('die', 1.0);
  if (result !== true) {
    playBeep(440, 'square', 0.10, 0.08);
    _scheduleSound(function() { playBeep(220, 'square', 0.18, 0.07); }, 90);
  }
}

export function soundMilestone() {
  const result = _playBuffer('milestone', 0.85);
  if (result !== true) {
    playBeep(660, 'square', 0.07, 0.07);
    _scheduleSound(function() { playBeep(880,  'square', 0.07, 0.07); },  70);
    _scheduleSound(function() { playBeep(1100, 'square', 0.12, 0.07); }, 140);
  }
}
