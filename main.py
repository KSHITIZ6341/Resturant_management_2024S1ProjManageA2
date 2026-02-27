import contextlib
import os
import shutil
import subprocess
import sys
import time
import webbrowser

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
FRONTEND_URL = "http://localhost:5173"


def run_command(command, cwd):
    """Spawn a child process and let the platform resolve the executable."""
    if sys.platform.startswith("win"):
        cmd = subprocess.list2cmdline(command)
        return subprocess.Popen(cmd, cwd=cwd, shell=True)
    return subprocess.Popen(command, cwd=cwd)


def wait_for_url(url, timeout=30):
    try:
        import urllib.request
    except ImportError:
        return False

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status < 500:
                    return True
        except Exception:
            time.sleep(0.5)
    return False


def ensure_backend_ready():
    print("Ensuring backend database schema exists...")
    try:
        subprocess.run(
            [sys.executable, "-c", "from src.database import init_db; init_db()"],
            cwd=BACKEND_DIR,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError("Failed to initialise backend database") from exc


def resolve_npm():
    npm_path = shutil.which("npm")
    if npm_path is None and sys.platform.startswith("win"):
        npm_path = shutil.which("npm.cmd")
    if npm_path is None:
        raise RuntimeError("npm executable not found. Install Node.js and ensure npm is on PATH.")
    return npm_path


def main():
    processes = []

    try:
        ensure_backend_ready()

        print("Starting backend server...")
        backend_process = run_command([sys.executable, "app.py"], cwd=BACKEND_DIR)
        processes.append(("backend", backend_process))

        print("Starting frontend development server...")
        frontend_process = run_command([resolve_npm(), "run", "dev"], cwd=FRONTEND_DIR)
        processes.append(("frontend", frontend_process))

        print(f"Waiting for frontend to respond at {FRONTEND_URL}...")
        if wait_for_url(FRONTEND_URL):
            webbrowser.open(FRONTEND_URL)
        else:
            print("Could not confirm frontend availability yet; opening browser anyway.")
            webbrowser.open(FRONTEND_URL)

        print("Servers are running. Press Ctrl+C to stop.")
        while True:
            for name, proc in processes:
                if proc.poll() is not None:
                    raise RuntimeError(f"{name} process exited with code {proc.returncode}")
            time.sleep(1)

    except KeyboardInterrupt:
        print("\nShutting down servers...")
    except RuntimeError as exc:
        print(f"\n{exc}")
    finally:
        for name, proc in processes:
            if proc.poll() is None:
                print(f"Terminating {name}...")
                proc.terminate()
        for name, proc in processes:
            if proc.poll() is None:
                with contextlib.suppress(Exception):
                    proc.wait(timeout=5)
        print("Servers have been shut down.")


if __name__ == "__main__":
    main()