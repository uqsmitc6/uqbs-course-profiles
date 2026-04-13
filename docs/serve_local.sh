#!/usr/bin/env bash
# Local development server for the UQBS Course Profile Viewer.
#
# The site needs profiles/ and taxonomy/ to be reachable from the pages root.
# Production GitHub Actions handles that in the deploy workflow; locally we
# stage symlinks so the site can fetch them via fetch() without CORS issues.
#
# Usage:
#   ./docs/serve_local.sh           # starts server on http://localhost:8000
#   ./docs/serve_local.sh 9000      # on custom port
#
# Then open http://localhost:8000/docs/index.html in a browser.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-8000}"

cd "$REPO_ROOT"

echo "[serve_local] Rebuilding manifest..."
python3 scraper/build_manifest.py

echo "[serve_local] Staging profiles/ and taxonomy/ into docs/ via symlinks..."
mkdir -p docs
# Use relative symlinks so they also work if docs is accessed via another path
rm -f docs/profiles docs/taxonomy
ln -s ../profiles docs/profiles
ln -s ../taxonomy docs/taxonomy

echo "[serve_local] Starting server at http://localhost:${PORT}/docs/"
echo "              Open http://localhost:${PORT}/docs/index.html"
echo "              Press Ctrl-C to stop."
python3 -m http.server "$PORT"
