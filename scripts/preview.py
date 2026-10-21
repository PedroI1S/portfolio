#!/usr/bin/env python3
"""Serve the portfolio pages with concurrent asset requests."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

SITE = Path(__file__).resolve().parents[1] / "site"


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128


class PreviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        parts = Path(unquote(urlsplit(self.path).path)).parts
        if any(p.startswith(".") or p == "_src" for p in parts):
            self.send_error(404)
            return None
        return super().send_head()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(SITE))
    with PreviewServer(("127.0.0.1", args.port), handler) as server:
        print("Preview: http://127.0.0.1:%d/work/" % server.server_port, flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
