#!/usr/bin/env python3
"""Teacher backend entry. Run: python3 run.py (or ./run.py with venv)."""
# Fix macOS Python SSL cert verification before any HTTPS imports
import os as _os
if "SSL_CERT_FILE" not in _os.environ:
    try:
        import certifi
        _os.environ["SSL_CERT_FILE"] = certifi.where()
    except ImportError:
        pass

from app import create_app, socketio

app = create_app()

if __name__ == "__main__":
    socketio.run(app, debug=True, host="0.0.0.0", port=5001, allow_unsafe_werkzeug=True)
