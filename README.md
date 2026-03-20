# 🦕 Dino Run — Chromatic Edition

A fully offline Chrome-style endless runner with day/night cycle,
pterodactyls, persistent local leaderboard, and session stats.  
No network calls · No tracking · No image assets.

---

## Features

- **Endless runner** with delta-time physics (consistent across all refresh rates)
- **Chromatic day/night cycle** with colour-interpolated sky, stars, cloud parallax
- **Top-10 local leaderboard** persisted in `localStorage` (session-only fallback for private contexts)
- **5 MB storage awareness** — quota display, graceful pruning on overflow, user-visible warning
- **Web Audio** sound effects (mutable)
- **Mobile-friendly** — touch jump/duck controls, no double-fire
- **Keyboard shortcuts** — `Space`/`↑` jump · `↓`/hold duck · `P` pause
- **HTTPS dev server** included (`server.py`) with automatic HTTP fallback

---

## Quick Start

### Desktop / any Python environment

```bash
# Unpack, then from the project root:
python3 server.py
```

Open **https://localhost:1999** (accept the self-signed cert warning).  
If `cert.pem` / `key.pem` are missing, the server falls back to plain HTTP automatically.

### Termux (Android)

```bash
# 1. Extract
cd ~/storage/downloads
unzip dino-run.zip
cd dino-run

# 2. Start server
#    Serves on HTTPS if cert.pem / key.pem are present,
#    otherwise falls back to plain HTTP automatically.
python3 server.py

# 3. Open in Cromite
#    https://localhost:1999   (HTTPS, if certs present)
#    http://localhost:1999    (HTTP fallback, no certs needed)
```

One-liner (no correct MIME types, fallback fonts only):
```bash
python3 -m http.server 1999
```

### Generating a self-signed certificate (optional)

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 365 -nodes -subj "/CN=localhost"
```

---

## Project Structure

```
dino-run/
├── index.html          # Main HTML — UI structure, overlays, panels
├── style.css           # All styling (retro pixel aesthetic)
├── db.js               # Storage layer — localStorage / in-memory fallback
├── game.js             # Game engine — physics, rendering, input, audio, UI
├── server.py           # HTTPS dev server (Python 3.4+)
├── fonts/
│   ├── press-start-2p.woff2   # Pixel heading font
│   └── vt323.woff2            # Monospace body font
├── cert.pem            # TLS certificate (self-signed, not tracked in VCS)
├── key.pem             # TLS private key  (self-signed, not tracked in VCS)
├── README.md
└── LICENSE             # MIT
```

---

## Fonts

Fonts are loaded from `fonts/` if present. If the directory or files are
missing, the game falls back to the system monospace font — the retro pixel
look will be absent but the game is fully playable.

To add the fonts manually (~50 KB total):

```bash
mkdir -p fonts
curl -L -o fonts/press-start-2p.woff2 \
  https://cdn.jsdelivr.net/fontsource/fonts/press-start-2p@latest/latin-400-normal.woff2
curl -L -o fonts/vt323.woff2 \
  https://cdn.jsdelivr.net/fontsource/fonts/vt323@latest/latin-400-normal.woff2
```

---

## Controls

| Action  | Keyboard    | Mobile              |
|---------|-------------|---------------------|
| Start   | Space / ↑   | Tap screen          |
| Jump    | Space / ↑   | Tap / ▲ JUMP button |
| Duck    | Hold ↓      | Hold ▼ DUCK button  |
| Pause   | P           | ❙❙ PAUSE button     |
| Restart | Space / Tap | ↺ RESTART button    |

---

## Storage

All data is stored **locally on your device only**. No server, no network,
no global leaderboard.

| Context                 | Backend      | Persists across sessions |
|-------------------------|--------------|--------------------------|
| localhost / any browser | localStorage | ✓ Yes                    |
| Private / Incognito     | In-memory    | ✗ Session only           |

The DB badge in the Stats panel shows which backend is active and current
storage usage (e.g. `LOCAL STORAGE · OFFLINE · 12KB (0.2%)`).

### Storage keys

| Key           | Contents                                            |
|---------------|-----------------------------------------------------|
| `dino:lb`     | Top-10 leaderboard (JSON array)                     |
| `dino:stats`  | Lifetime stats (games, deaths, distance, obstacles) |
| `dino:player` | Player display name (max 10 chars)                  |

### Quota handling

localStorage provides ~5 MB per origin in all major browsers. The game uses
a few KB at most. `navigator.storage.persist()` is requested at startup to
prevent the browser evicting data under storage pressure.

If quota is exceeded, the storage layer merges the new score with existing
entries, sorts by score, and prunes to top-10 (falling back to top-5 if still
over quota). The badge turns red with a `STORAGE FULL ⚠` warning if the score
cannot be persisted.

---

## Leaderboard

- **Local top-10** sorted by score (highest first)
- Each entry stores: player name, score, and full timestamp (e.g. `19 Mar '26 14:07`)
- Gold / Silver / Bronze highlight for top 3
- Persists across browser sessions via localStorage
- Enter your name in the leaderboard panel before playing

---

## Browser Compatibility

| Browser                | Minimum version |
|------------------------|-----------------|
| Chrome / Chromium      | 88+             |
| Cromite                | 142+            |
| Edge (Chromium)        | 88+             |
| Firefox                | 93+             |
| Librewolf / Waterfox   | ✓               |
| Safari / iOS Safari    | 13+             |
| Samsung Internet       | 12+             |

---

## Technical Notes

- Canvas rendered at 900×300 px, scaled to full width via CSS
- All sprites drawn with `fillRect` — no image assets
- Speed scales from 5.5 → 18 as score increases
- Pterodactyls appear after score 200; three flight heights with distinct dodge requirements
- All 12 known cross-browser bugs fixed

---

## License

MIT — see [LICENSE](LICENSE).