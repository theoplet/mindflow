import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import urllib.parse
import os

class VercelDevHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent aggressive browser caching during development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ('/open', '/new') or parsed.path.startswith('/open?') or parsed.path.startswith('/new?'):
            new_path = '/index.html'
            if parsed.query:
                new_path += '?' + parsed.query
            self.path = new_path
        return super().do_GET()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = ThreadingHTTPServer(('127.0.0.1', port), VercelDevHandler)
    server.daemon_threads = True
    print(f"Dev server running at http://127.0.0.1:{port}/ with Vercel rewrites and multithreading")
    server.serve_forever()
