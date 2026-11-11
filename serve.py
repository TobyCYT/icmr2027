import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

class ExtensionlessHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """
    HTTP request handler that automatically resolves extensionless URLs 
    (e.g., /date, /cfc, /cft) to their corresponding .html files, 
    matching the production nginx configuration.
    """
    def translate_path(self, path):
        translated = super().translate_path(path)
        if not os.path.exists(translated) and os.path.exists(translated + ".html"):
            return translated + ".html"
        return translated

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"Starting ICMR 2027 local dev server at: http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    http.server.test(
        HandlerClass=ExtensionlessHTTPRequestHandler,
        port=PORT,
        bind="127.0.0.1"
    )
