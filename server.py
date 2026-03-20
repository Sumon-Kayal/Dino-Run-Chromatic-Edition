from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl
import os

# ── Serve from this script's folder, not wherever you ran it from ──
DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

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
#
# FIX-1: cert files may not exist (e.g. during local dev).
# If they are missing, fall back to plain HTTP instead of crashing.
try:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(certfile=os.path.join(DIR, 'cert.pem'),
                        keyfile=os.path.join(DIR, 'key.pem'))
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print("HTTPS running on https://localhost:1999")
except FileNotFoundError:
    print("WARNING: cert.pem / key.pem not found — falling back to plain HTTP.")
    print("HTTP  running on http://localhost:1999")

httpd.serve_forever()
