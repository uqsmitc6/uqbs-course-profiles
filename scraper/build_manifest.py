#!/usr/bin/env python3
"""Build a lean manifest of all scraped course profiles.

Scans profiles/{semester_code}/*.json and writes:
  docs/assets/manifest.json

The manifest lets the visualiser render the course browser without
fetching every individual JSON. Each entry contains only the summary
fields needed for the table view; detail pages fetch the full JSON
on demand.

Usage:
  python scraper/build_manifest.py

Exit code is non-zero if profiles/ is empty or no semesters found.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PROFILES_DIR = REPO_ROOT / "profiles"
DOCS_DIR = REPO_ROOT / "docs"
MANIFEST_PATH = DOCS_DIR / "assets" / "manifest.json"


def _summary_fields(data: dict, relative_path: str) -> dict:
    """Pick the lean summary fields for the browser table."""
    return {
        "course_code": data.get("course_code"),
        "class_code": data.get("class_code"),
        "semester_code": data.get("semester_code"),
        "full_course_code": data.get("full_course_code"),
        "course_title": data.get("course_title"),
        "study_period": data.get("study_period"),
        "study_level": data.get("study_level"),
        "location": data.get("location"),
        "attendance_mode": data.get("attendance_mode"),
        "units": data.get("units"),
        "coordinating_unit": data.get("coordinating_unit"),
        "url": data.get("url"),
        "scraped_at": data.get("scraped_at"),
        "assessment_count": len(data.get("assessment_summary") or []),
        "lo_count": len(data.get("learning_outcomes") or []),
        "file": relative_path,
    }


def build_manifest() -> dict:
    if not PROFILES_DIR.exists():
        raise SystemExit(f"profiles directory not found: {PROFILES_DIR}")

    semesters: dict[str, list] = {}
    total = 0

    for semester_dir in sorted(PROFILES_DIR.iterdir()):
        if not semester_dir.is_dir():
            continue
        sem_code = semester_dir.name
        entries = []
        for jf in sorted(semester_dir.glob("*.json")):
            try:
                with jf.open() as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError) as exc:
                print(f"warn: skipping {jf.name}: {exc}", file=sys.stderr)
                continue
            rel = f"profiles/{sem_code}/{jf.name}"
            entries.append(_summary_fields(data, rel))
        semesters[sem_code] = entries
        total += len(entries)

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_profiles": total,
        "semesters": semesters,
    }
    return manifest


def main() -> None:
    manifest = build_manifest()
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MANIFEST_PATH.open("w") as f:
        json.dump(manifest, f, indent=2)
    print(
        f"Wrote {MANIFEST_PATH.relative_to(REPO_ROOT)} "
        f"({manifest['total_profiles']} profiles across "
        f"{len(manifest['semesters'])} semester(s))"
    )


if __name__ == "__main__":
    main()
