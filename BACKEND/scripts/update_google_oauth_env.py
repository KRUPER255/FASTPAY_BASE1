#!/usr/bin/env python3
"""
Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend and dashboard env files
from a Google OAuth client secret JSON file.

Usage:
  python scripts/update_google_oauth_env.py [path/to/client_secret_*.json]

If no path given, looks for BACKEND/client_secret_google.json.
"""
import json
import os
import re
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(BACKEND_DIR)
DASHBOARD_DIR = os.path.join(REPO_ROOT, "DASHBOARD")


def load_client_secret(json_path: str) -> tuple[str, str]:
    """Load client_id and client_secret from Google JSON. Supports 'web' or 'installed'."""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Google Cloud Console download can be under "web" or "installed"
    block = data.get("web") or data.get("installed") or data
    client_id = (block.get("client_id") or "").strip()
    client_secret = (block.get("client_secret") or "").strip()
    if not client_id or not client_secret:
        raise SystemExit("JSON must contain client_id and client_secret (under 'web' or 'installed' or top-level)")
    return client_id, client_secret


def update_env_file(path: str, client_id: str, client_secret: str, is_dashboard: bool = False) -> None:
    """Set or replace GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in an .env file."""
    if not os.path.isfile(path):
        print(f"  Skip (not found): {path}")
        return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    id_var = "VITE_GOOGLE_CLIENT_ID" if is_dashboard else "GOOGLE_CLIENT_ID"
    id_pattern = re.compile(r"^(" + re.escape(id_var) + r")=.*$", re.MULTILINE)
    secret_pattern = re.compile(r"^(GOOGLE_CLIENT_SECRET)=.*$", re.MULTILINE)
    content = id_pattern.sub(f"{id_var}={client_id}", content)
    content = secret_pattern.sub(f"GOOGLE_CLIENT_SECRET={client_secret}", content)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Updated: {path}")


def main() -> None:
    if len(sys.argv) > 1:
        json_path = os.path.abspath(sys.argv[1])
    else:
        json_path = os.path.join(BACKEND_DIR, "client_secret_google.json")
    if not os.path.isfile(json_path):
        print(f"Usage: python {__file__} <path/to/client_secret_*.json>")
        print(f"File not found: {json_path}")
        print("Copy your Google client secret JSON into BACKEND/ (e.g. client_secret_google.json) and run again.")
        sys.exit(1)
    client_id, client_secret = load_client_secret(json_path)
    print(f"Loaded client_id: {client_id[:30]}...")
    print("Updating env files...")
    update_env_file(os.path.join(BACKEND_DIR, ".env.staging"), client_id, client_secret)
    update_env_file(os.path.join(BACKEND_DIR, ".env.production"), client_id, client_secret)
    update_env_file(os.path.join(DASHBOARD_DIR, ".env.staging"), client_id, client_secret, is_dashboard=True)
    update_env_file(os.path.join(DASHBOARD_DIR, ".env.production"), client_id, client_secret, is_dashboard=True)
    print("Done. Restart backend (and rebuild dashboard if you use VITE_ vars) for changes to take effect.")


if __name__ == "__main__":
    main()
