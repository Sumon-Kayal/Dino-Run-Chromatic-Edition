#!/usr/bin/env python3

import os
import ssl
import sys
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from typing import ClassVar

# ── Paths ──────────────────────────────────────────────────────────────────────
# server.py lives in  Dino-Run-Chromatic-Edition-main-Chromatic-Edition-main/
# Static files live in Dino-Run-Chromatic-Edition-main-Chromatic-Edition-main/           (one level up — the project root)
# TLS certificates live in Dino-Run-Chromatic-Edition-main-Chromatic-Edition-main/assets/certs/
DIR         = os.path.dirname(os.path.abspath(__file__))   # .../Dino-Run-Chromatic-Edition-main-Chromatic-Edition-main/assets/certs/
ROOT        = os.path.dirname(DIR)                          # .../Dino-Run-Chromatic-Edition-main-Chromatic-Edition-main/
CERT_DIR    = os.path.join(DIR, "certs")                    # .../Dino-Run-Chromatic-Edition-main-Chromatic-Edition-main/assets/certs/
# Security note: For production deployments, change PUBLIC_ROOT to a dedicated
# public/ subdirectory to prevent serving sensitive files from the project root.
PUBLIC_ROOT = ROOT

# Set ALLOW_HTTP_FALLBACK=1 (or 'true'/'yes') in the environment to let the
# server start in plain HTTP when SSL setup fails.  Off by default.
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
    before being returned.

    Returns:
        (ctx, cert_path, key_path, had_pair_candidates)
    """
    if not os.path.isdir(directory):
        return None, None, None, False

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
                ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                ctx.load_cert_chain(certfile=c_path, keyfile=k_path)
                return ctx, c_path, k_path, had_pair_candidates
            except (ssl.SSLError, OSError):
                continue

    return None, None, None, had_pair_candidates


# ─────────────────────────────────────────────
# 🛡️ Secure Handler
# ─────────────────────────────────────────────
class Handler(SimpleHTTPRequestHandler):

    timeout = 10

    # Populated after cert/key paths are resolved (see bottom of file).
    _DENIED: ClassVar[frozenset] = frozenset()

    tls_enabled: ClassVar[bool] = False

    def __init__(self, *args, **kwargs):
        # Serve files from the public root directory (configurable above).
        # For production, set PUBLIC_ROOT to a dedicated public/ subdirectory.
        super().__init__(*args, directory=PUBLIC_ROOT, **kwargs)

    def _is_denied(self):
        # Strip query string and decode URL-encoding iteratively
        path = self.path.split('?')[0]
        while True:
            decoded = urllib.parse.unquote(path)
            if decoded == path:
                break
            path = decoded

        # Normalize path to resolve . and .. components
        normalized = os.path.normpath(decoded)

        # Extract basename and check against denied set
        basename = os.path.basename(normalized).lower()
        if basename in self._DENIED:
            return True

        # Block if normalized path attempts to access CERT_DIR subtree
        # Convert to absolute path relative to PUBLIC_ROOT for comparison
        try:
            abs_path = os.path.abspath(os.path.join(PUBLIC_ROOT, normalized.lstrip('/')))
            abs_cert_dir = os.path.abspath(CERT_DIR)
            # Check if the requested path is inside CERT_DIR
            if abs_path.startswith(abs_cert_dir + os.sep) or abs_path == abs_cert_dir:
                return True
        except (ValueError, OSError):
            # Path traversal attempt or invalid path
            return True

        # Block directory requests with empty basename (e.g., /)
        if not basename and normalized == '/':
            return False  # Allow root

        return False

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header(
            'Content-Security-Policy',
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self'; "
            "font-src 'self'; "
            "img-src 'self' data:; "
            "media-src 'none'; "
            "object-src 'none'; "
            "frame-ancestors 'none'"
        )
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=()'
        )
        if self.tls_enabled:
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
        if self._is_denied():
            self.send_error(403, 'Forbidden')
            return
        self.send_error(405, 'Method Not Allowed')

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
# Security note: Binding to 127.0.0.1 restricts access to localhost only.
# Binding to 0.0.0.0 allows network access — use with caution.
HOST = '127.0.0.1'
PORT = 1999

# Block all TLS-related files found in CERT_DIR from being served over HTTP.
_TLS_EXTS = ('.pem', '.crt', '.key')
if os.path.isdir(CERT_DIR):
    Handler._DENIED = frozenset(
        f.lower() for f in os.listdir(CERT_DIR)
        if f.lower().endswith(_TLS_EXTS)
    )

ctx, cert, key, had_pair_candidates = find_ssl_files(CERT_DIR)

if ctx and cert and key:
    try:
        httpd = ThreadingHTTPServer((HOST, PORT), Handler, bind_and_activate=False)
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
        httpd.server_bind()
        httpd.server_activate()
        Handler.tls_enabled = True

        print("🔐 HTTPS ENABLED")
        print(f"   Cert : {os.path.relpath(cert, DIR)}")
        print(f"   Key  : {os.path.relpath(key,  DIR)}")
        print(f"   Denied TLS files ({len(Handler._DENIED)}): {', '.join(sorted(Handler._DENIED))}")
        print(f"   Serving from : {ROOT}")
        print(f"➡  https://localhost:{PORT}")

    except (ssl.SSLError, OSError) as e:
        if ALLOW_HTTP_FALLBACK:
            httpd = ThreadingHTTPServer((HOST, PORT), Handler)
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
        httpd = ThreadingHTTPServer((HOST, PORT), Handler)
        print("⚠  TLS files were found, but no valid cert/key pair could be loaded → HTTP mode")
        print("   To require HTTPS, fix or remove the broken TLS files.")
        print(f"➡  http://localhost:{PORT}")
    else:
        print("✖  TLS files were found, but no valid cert/key pair could be loaded.")
        print("   To allow HTTP fallback, set:  ALLOW_HTTP_FALLBACK=1")
        sys.exit(1)
else:
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print("🌐 No valid SSL cert/key pair found → HTTP mode")
    print(f"   Place *.pem/*.crt + *.key/*.pem in:  {os.path.relpath(CERT_DIR)}")
    print(f"➡  http://localhost:{PORT}")


# ─────────────────────────────────────────────
# ▶ Run
# ─────────────────────────────────────────────
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\n🛑 Server stopped")