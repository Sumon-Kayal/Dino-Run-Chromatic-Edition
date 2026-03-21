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

    # Block TLS credential files from being served even though they sit in DIR.
    # Both GET and HEAD are intercepted; any other method falls through to the
    # default 501 handler so no new attack surface is added.
    _DENIED = {'cert.pem', 'key.pem'}

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

ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(certfile=cert, keyfile=key)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
print("HTTPS running on https://localhost:1999")

httpd.serve_forever()
