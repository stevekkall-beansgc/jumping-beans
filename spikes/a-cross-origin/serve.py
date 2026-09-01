#!/usr/bin/env python3
"""Static server with the cross-origin-isolation headers WebMCP requires."""
import http.server, socketserver, sys
from pathlib import Path

PORT, DIR = int(sys.argv[1]), Path(sys.argv[2])
LOCAL_ENGINE_PARTNER_ORIGINS = (
    '"http://127.0.0.1:8084" '
    '"http://127.0.0.1:8085" '
    '"http://127.0.0.1:8086"'
)

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(DIR), **kw)
    def end_headers(self):
        # WebMCP is DISABLED in non-origin-isolated documents (Chrome docs).
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        # CORP lets a COEP:require-corp parent embed our cross-origin assets/iframes.
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        # The embedder must grant the WebMCP `tools` feature at the top level;
        # iframe allow="tools" alone cannot expand an inherited policy.
        if PORT == 8082:
            self.send_header(
                "Permissions-Policy",
                f"tools=(self {LOCAL_ENGINE_PARTNER_ORIGINS})",
            )
        elif PORT == 8182:
            self.send_header(
                "Permissions-Policy",
                'tools=(self "http://127.0.0.1:8183")',
            )
        super().end_headers()

socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), H) as srv:
    print(f"serving {DIR} on http://127.0.0.1:{PORT} (WebMCP-isolated)")
    srv.serve_forever()
