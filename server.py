from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl
import os
import sys
import urllib.parse

# ── Serve from this script's folder, not wherever you ran it from ──
DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    # SEC-2: Set a per-request read timeout so a slow/stalled client cannot
    # hold the single-threaded server's connection open indefinitely (slowloris).
    # 10 s is generous for a local game page — all assets are small.
    timeout = 10

    # Populated after cert/key paths are resolved (see bottom of file).
    # FIX-13: derived from actual cert/key basenames so the deny list stays
    # correct if filenames are ever changed — no second edit required.
    _DENIED: set = set()

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
        return os.path.basename(decoded) in self._DENIED

    # SEC-1: Inject security headers into every response.
    # Called by SimpleHTTPRequestHandler.send_response() before body headers.
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
        # Disable browser features not used by the game
        self.send_header(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=()'
        )
        # HSTS: tell browsers to always use HTTPS for this origin (1 year)
        # max-age=31536000; includeSubDomains is omitted — localhost only
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

httpd = HTTPServer(('0.0.0.0', 1999), Handler)
# Binds to all interfaces (not just 127.0.0.1) so Cromite on Android can
# reach the server via localhost when running in Termux. On a desktop this
# also makes the game reachable from other devices on the LAN at your
# machine's local IP (e.g. https://192.168.x.x:1999). If you want loopback
# only, change '0.0.0.0' to '127.0.0.1'.

# ssl.wrap_socket() was removed in Python 3.12.
# SSLContext is the correct API (works Python 3.4 → 3.12+).
cert = os.path.join(DIR, 'cert.pem')
key  = os.path.join(DIR, 'key.pem')
if not os.path.exists(cert) or not os.path.exists(key):
    print("ERROR: cert.pem / key.pem not found.")
    print("Generate them with:")
    print("  openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \\")
    print("    -days 365 -nodes -subj '/CN=localhost'")
    sys.exit(1)

# FIX-13: derive the deny set from the actual cert/key basenames so it stays
# correct if either filename is ever changed — no second edit required.
Handler._DENIED = {os.path.basename(cert), os.path.basename(key)}

ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(certfile=cert, keyfile=key)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
print("HTTPS running on https://localhost:1999")

httpd.serve_forever()
