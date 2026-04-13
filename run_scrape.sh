#!/bin/bash
# =============================================================================
# UQBS Course Profile Scraper — Local Runner
# =============================================================================
# Run this script on your Mac to scrape UQBS course profiles and optionally
# push the results to GitHub.
#
# Usage:
#   ./run_scrape.sh                     # Scrape all UQBS courses, current semester
#   ./run_scrape.sh --semester 7620     # Specific semester
#   ./run_scrape.sh --courses MGTS1601 ACCT1101   # Specific courses
#   ./run_scrape.sh --max 5            # Test with 5 courses
#   ./run_scrape.sh --push             # Scrape and push to GitHub
#
# Schedule with launchd (see setup instructions in README.md)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# --- Configuration ---
PUSH_TO_GIT=false
SCRAPER_ARGS=()

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --push)
            PUSH_TO_GIT=true
            shift
            ;;
        *)
            SCRAPER_ARGS+=("$1")
            shift
            ;;
    esac
done

# --- Ensure Python dependencies ---
if ! python3 -c "import bs4, requests" 2>/dev/null; then
    echo "Installing dependencies..."
    pip3 install -r scraper/requirements.txt --quiet
fi

# --- Run the scraper ---
echo "=== UQBS Course Profile Scraper ==="
echo "Started: $(date)"
echo ""

python3 scraper/scrape.py "${SCRAPER_ARGS[@]}"

echo ""
echo "Finished: $(date)"

# --- Push to GitHub (if requested and if repo is a git repo) ---
if [ "$PUSH_TO_GIT" = true ] && [ -d ".git" ]; then
    echo ""
    echo "=== Pushing to GitHub ==="

    git add profiles/
    if git diff --cached --quiet; then
        echo "No changes to commit."
    else
        TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")
        PROFILE_COUNT=$(find profiles/ -name "*.json" | wc -l | tr -d ' ')
        git commit -m "Scrape update: ${PROFILE_COUNT} profiles as at ${TIMESTAMP}"
        git push
        echo "Pushed successfully."
    fi
fi
