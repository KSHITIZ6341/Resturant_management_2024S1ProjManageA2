import argparse
import contextlib
import pathlib
import threading
import time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

try:
    import requests
except ImportError:  # pragma: no cover - optional dependency for dev mode
    requests = None

import webview

ROOT_DIR = pathlib.Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"
DEFAULT_DEV_URL = "http://127.0.0.1:5173"
DEFAULT_DIST_PORT = 8333


def wait_for_dev_server(url: str, timeout: int = 30) -> bool:
    if requests is None:
        return False

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            response = requests.get(url, timeout=1)
            if response.status_code < 500:
                return True
        except requests.RequestException:
            time.sleep(0.5)
    return False


def start_dist_server(port: int) -> ThreadingHTTPServer:
    dist_path = DIST_DIR
    if not dist_path.exists():
        raise FileNotFoundError(
            f"Could not find build output at {dist_path}. Run 'npm run build' inside frontend/ first."
        )

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(dist_path), **kwargs)

        def log_message(self, format: str, *args):  # noqa: D401 - silence server logs
            return

    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)

    thread = threading.Thread(target=httpd.serve_forever, daemon=True, name="pywebview-static-server")
    thread.start()
    return httpd


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Launch the Restaurant Manager UI inside a pywebview window.")
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--dev",
        action="store_true",
        help="Connect to the running Vite dev server instead of the built dist assets.",
    )
    mode_group.add_argument(
        "--dist",
        action="store_true",
        help="Force loading the built dist/ output (default if --dev is not supplied).",
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_DEV_URL,
        help="URL of the dev server to load when using --dev (default: %(default)s).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_DIST_PORT,
        help="Port for the lightweight static server when using dist assets (default: %(default)s).",
    )
    parser.add_argument(
        "--title",
        default="Restaurant Manager",
        help="Window title (default: %(default)s).",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1200,
        help="Initial window width in pixels (default: %(default)s).",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=820,
        help="Initial window height in pixels (default: %(default)s).",
    )
    parser.add_argument(
        "--fullscreen",
        action="store_true",
        help="Launch in fullscreen mode.",
    )
    parser.add_argument(
        "--gui",
        default=None,
        help=(
            "Optional pywebview backend (e.g. 'edgechromium', 'cef'). "
            "If omitted, pywebview picks the best available engine."
        ),
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if args.dev:
        url = args.url
        if not wait_for_dev_server(url):
            print(
                f"[pywebview] Could not reach dev server at {url}. Make sure 'npm run dev' is running.",
                flush=True,
            )
    else:
        server = start_dist_server(args.port)
        url = f"http://127.0.0.1:{args.port}/index.html"

    window = webview.create_window(
        args.title,
        url,
        width=args.width,
        height=args.height,
        resizable=True,
        background_color="#ffffff",
        fullscreen=args.fullscreen,
    )

    try:
        webview.start(gui=args.gui)
    finally:
        if not args.dev:
            with contextlib.suppress(Exception):
                server.shutdown()
                server.server_close()


if __name__ == "__main__":
    main()
