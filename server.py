#!/usr/bin/env python3

import os
import ssl
import sys
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from typing import ClassVar

# ── Serve from this script's folder, not wherever you ran it from ──
DIR = os.path.dirname(os.path.abspath(__file__))

# Set ALLOW_HTTP_FALLBACK=1 (or 'true'/'yes') in the environment to let the
# server start in plain HTTP when SSL setup fails. Off by default — a broken
# TLS config should be an explicit, visible decision, not a silent downgrade.
ALLOW_HTTP_FALLBACK = os.environ.get('ALLOW_HTTP_FALLBACK', '').lower() in ('1', 'true', 'yes')


# ─────────────────────────────────────────────
# 🔍 Auto-detect SSL files (any name/ext)
# ─────────────────────────────────────────────
def find_ssl_files(directory):
    """Scan directory for the first cert+key pair that actually loads cleanly.

    Cert candidates : *.pem, *.crt
    Key  candidates : *.key, *.pem
    A file is never paired with itself (e.g. a combined .pem is skipped
    unless a separate key file is also present).

    Each candidate pair is validated with ssl.SSLContext.load_cert_chain
    before being returned. Pairs that fail (mismatched cert/key, wrong
    format, etc.) are skipped silently.

     Returns:
         (cert_path, key_path, had_pair_candidates): On success, paths to
             the validated cert and key files. On failure, (None, None, bool)
             where the bool indicates whether any candidate pairs existed.
    """
    certs = []
    keys  = []

    for f in os.listdir(directory):
        name = f.lower()
        if name.endswith(('.pem', '.crt')):
            certs.append(f)
        if name.endswith(('.key', '.pem')):
            keys.append(f)

    had_pair_candidates = bool(certs) and bool(keys)

    for c in certs:
        for k in keys:
            if c == k:
                continue
            c_path = os.path.join(directory, c)
            k_path = os.path.join(directory, k)
            try:
                # Validate the pair is a real, matching cert+key before
                # committing to it — catches mismatches early.
                ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                ctx.load_cert_chain(certfile=c_path, keyfile=k_path)
                return c_path, k_path, had_pair_candidates
            except ssl.SSLError:
                continue  # try next pair

    return None, None, had_pair_candidates


# ─────────────────────────────────────────────
# 🛡️ Secure Handler
# ─────────────────────────────────────────────
class Handler(SimpleHTTPRequestHandler):

    # SEC-2: Set a per-request read timeout so a slow/stalled client cannot
    # hold a thread open indefinitely (slowloris mitigation).
    # 10 s is generous for a local game page — all assets are small.
    timeout = 10

    # Populated after cert/key paths are resolved (see bottom of file).
    # FIX-13: derived from actual cert/key basenames so the deny list stays
    # correct if filenames are ever changed — no second edit required.
    _DENIED: ClassVar[frozenset[str]] = frozenset()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def _is_denied(self):
        # BUG-4 FIX: iteratively URL-decode the path before extracting the
        # basename. A single unquote() pass is insufficient — /%2563ert.pem
        # decodes once to /%63ert.pem (basename still "%63ert.pem", no match).
        # Loop until the string is stable so all encoding layers are stripped.
        path = self.path.split('?')[0]
        while True:
            decoded = urllib.parse.unquote(path)
            if decoded == path:
                break
            path = decoded
        return os.path.basename(decoded).lower() in self._DENIED

    # SEC-1: Inject security headers into every response.
    # Called by SimpleHTTPRequestHandler before body headers are flushed.
    def end_headers(self):
        # Prevent MIME-type sniffing (CVE class: content-type confusion attacks)
        self.send_header('X-Content-Type-Options', 'nosniff')
        # Prevent framing from any origin — blocks clickjacking
        self.send_header('X-Frame-Options', 'DENY')
        # Strict CSP: only same-origin scripts/styles/fonts; no eval or inline
        # scripts other than what the page already uses (none — all external files)
        self.send_header(
            'Content-Security-Policy',
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self'; "
            "font-src 'self'; "
            "img-src 'self' data:; "   # data: needed for inline SVG favicon
            "media-src 'none'; "
            "object-src 'none'; "
            "frame-ancestors 'none'"   # belt-and-suspenders with X-Frame-Options
        )
        # Do not send the Referer header when navigating away
        self.send_header('Referrer-Policy', 'no-referrer')
        # Disable browser features not used by the app
        self.send_header(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=()'
        )
        # HSTS: tell browsers to always use HTTPS for this origin (1 year).
        # includeSubDomains is omitted — localhost only.
        self.send_header('Strict-Transport-Security', 'max-age=31536000')
        super().end_headers()

    def do_GET(self):
        if self._is_denied():
            self.send_error(403, 'Forbidden')
            return
        super().do_GET()

    def do_HEAD(self):
        if self._is_denied():
            self.send_error(403, 'Forbidden')
            return
        super().do_HEAD()

    # SEC-3: SimpleHTTPRequestHandler does not implement POST/PUT/DELETE/OPTIONS
    # (they return 501 via the base class). Explicitly gate them here so that
    # if a future Python version or subclass ever adds those methods, the deny
    # list is still enforced before the body is read or files are touched.
    def do_POST(self):
        if self._is_denied():
            self.send_error(403, 'Forbidden')
            return
        self.send_error(405, 'Method Not Allowed')

    def do_PUT(self):
        if self._is_denied():
            self.send_error(403, 'Forbidden')
            return
        self.send_error(405, 'Method Not Allowed')

    def do_DELETE(self):
        if self._is_denied():
            self.send_error(403, 'Forbidden')
            return
        self.send_error(405, 'Method Not Allowed')

    def do_OPTIONS(self):
        # OPTIONS is used by CORS preflight — reject it; this server is not a
        # CORS endpoint and should not advertise any cross-origin permissions.
        if self._is_denied():
            self.send_error(403, 'Forbidden')
            return
        self.send_error(405, 'Method Not Allowed')

    # Correct MIME types — Firefox silently rejects fonts without them
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.html':  'text/html; charset=utf-8',
        '.css':   'text/css; charset=utf-8',
        '.js':    'application/javascript; charset=utf-8',
        '.woff2': 'font/woff2',
        '.woff':  'font/woff',
        '.ttf':   'font/ttf',
        '.json':  'application/json',
    }


# ─────────────────────────────────────────────
# 🚀 Server Init
# ─────────────────────────────────────────────
HOST = '0.0.0.0'
# Binds to all interfaces (not just 127.0.0.1) so Cromite on Android can
# reach the server via localhost when running in Termux. On a desktop this
# also makes the app reachable from other LAN devices at your machine's
# local IP (e.g. https://192.168.x.x:1999). Change to '127.0.0.1' for
# loopback-only.
PORT = 1999

httpd = ThreadingHTTPServer((HOST, PORT), Handler)

cert, key, had_pair_candidates = find_ssl_files(DIR)

# Finding 1 fix: collect ALL TLS-related filenames in DIR into _DENIED,
# not just the chosen pair. Any *.pem / *.crt / *.key file sitting next
# to the script could contain private key material and must be blocked
# from HTTP responses regardless of which pair was selected for TLS.
_TLS_EXTS = ('.pem', '.crt', '.key')
Handler._DENIED = frozenset(
    f.lower() for f in os.listdir(DIR)
    if f.lower().endswith(_TLS_EXTS)
)

if cert and key:
    try:
        # ssl.wrap_socket() was removed in Python 3.12.
        # SSLContext is the correct API (works Python 3.4 → 3.12+).
        # Note: load_cert_chain was already validated inside find_ssl_files;
        # we re-wrap the socket here with the same context.
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(certfile=cert, keyfile=key)
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

        print("🔐 HTTPS ENABLED")
        print(f"   Cert : {os.path.basename(cert)}")
        print(f"   Key  : {os.path.basename(key)}")
        print(f"   Denied TLS files ({len(Handler._DENIED)}): {', '.join(sorted(Handler._DENIED))}")
        print(f"➡  https://localhost:{PORT}")

    except (ssl.SSLError, OSError) as e:
        # ssl.SSLError  — bad cert/key material or mismatch
        # OSError       — socket wrap failure, missing file (FileNotFoundError
        #                 is a subclass), or other I/O error at bind time
        # Finding 3 fix: do NOT silently fall back to plaintext HTTP.
        # A broken TLS config is an error, not a recoverable condition.
        # Set ALLOW_HTTP_FALLBACK=1 in the environment to override.
        if ALLOW_HTTP_FALLBACK:
            print("⚠  SSL setup failed → falling back to HTTP  (ALLOW_HTTP_FALLBACK is set)")
            print(f"   Reason: {e}")
            print(f"➡  http://localhost:{PORT}")
        else:
            print("✖  SSL setup failed. Refusing to start in plaintext HTTP.")
            print(f"   Reason: {e}")
            print("   To allow HTTP fallback, set:  ALLOW_HTTP_FALLBACK=1")
            sys.exit(1)

elif had_pair_candidates:
    if ALLOW_HTTP_FALLBACK:
        print("⚠  TLS files were found, but no valid cert/key pair could be loaded → HTTP mode")
        print("   To require HTTPS, fix or remove the broken TLS files.")
        print(f"➡  http://localhost:{PORT}")
    else:
        print("✖  TLS files were found, but no valid cert/key pair could be loaded.")
        print("   To allow HTTP fallback, set:  ALLOW_HTTP_FALLBACK=1")
        sys.exit(1)
 else:
     print("🌐 No valid SSL cert/key pair found → HTTP mode")
     print("   To enable HTTPS, place any *.pem/*.crt + *.key/*.pem pair")
     print("   in the same folder as this script, then restart.")
     print(f"➡  http://localhost:{PORT}")


# ─────────────────────────────────────────────
# ▶ Run
# ─────────────────────────────────────────────
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\n🛑 Server stopped")
