#!/usr/bin/env python3
"""Serve the portfolio pages with concurrent asset requests."""
import argparse
import gzip
import io
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

SITE = Path(__file__).resolve().parents[1] / "site"


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        clean_path = urlsplit(self.path).path
        if clean_path in ('/api/health', '/healthz'):
            payload = b'{"status":"ok"}\n'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

    def send_head(self):
        parts = Path(unquote(urlsplit(self.path).path)).parts
        if any(p.startswith(".") or p == "_src" for p in parts):
            self.send_error(404)
            return None
        path=Path(self.translate_path(self.path))
        if path.is_dir():
            path=path/'index.html'
        if path.is_file() and path.suffix in ('.html','.css','.js','.mjs','.json','.svg') and 'gzip' in self.headers.get('Accept-Encoding',''):
            # Match the text compression a production static host should supply.
            body=gzip.compress(path.read_bytes(),compresslevel=5)
            self.send_response(200)
            self.send_header('Content-Type',self.guess_type(str(path)))
            self.send_header('Content-Encoding','gzip')
            self.send_header('Vary','Accept-Encoding')
            self.send_header('Cache-Control','no-cache')
            self.send_header('Content-Length',str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        return super().send_head()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(SITE))
    with PreviewServer(("127.0.0.1", args.port), handler) as server:
        print("Preview: http://127.0.0.1:%d/" % server.server_port, flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
