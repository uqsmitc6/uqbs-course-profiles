#!/usr/bin/env python3
"""Build lean manifests of scraped course profiles.

Scans profiles/{semester_code}/*.json and writes:
  docs/assets/manifest.json      — UQBS courses only (filtered by taxonomy)
  docs/assets/manifest-all.json  — all courses (entire profiles/ directory)

The UQBS manifest powers the live viewer at uqsmitc6.github.io and is never
affected by all-of-UQ scrapes. The full manifest is consumed by ATLAS and
other downstream tools that need the complete dataset.

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
MANIFEST_ALL_PATH = DOCS_DIR / "assets" / "manifest-all.json"
TAXONOMY_PATH = REPO_ROOT / "taxonomy" / "uqbs-programs.json"


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


def _load_uqbs_course_codes() -> set[str] | None:
    """Load UQBS course codes from taxonomy. Returns None if file missing."""
    if not TAXONOMY_PATH.exists():
        print(
            f"warn: taxonomy not found at {TAXONOMY_PATH}; "
            "UQBS-filtered manifest will include all courses",
            file=sys.stderr,
        )
        return None
    with open(TAXONOMY_PATH, encoding="utf-8") as f:
        taxonomy = json.load(f)
    return set(taxonomy.get("course_programs", {}).keys())


def _scan_all_profiles() -> list[tuple[str, dict]]:
    """Scan profiles/ and return (relative_path, summary_fields) pairs."""
    if not PROFILES_DIR.exists():
        raise SystemExit(f"profiles directory not found: {PROFILES_DIR}")

    all_entries = []
    for semester_dir in sorted(PROFILES_DIR.iterdir()):
        if not semester_dir.is_dir():
            continue
        sem_code = semester_dir.name
        for jf in sorted(semester_dir.glob("*.json")):
            try:
                with jf.open() as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError) as exc:
                print(f"warn: skipping {jf.name}: {exc}", file=sys.stderr)
                continue
            rel = f"profiles/{sem_code}/{jf.name}"
            all_entries.append((rel, _summary_fields(data, rel)))
    return all_entries


def _build_manifest(entries: list[tuple[str, dict]]) -> dict:
    """Group entries by semester and build the manifest dict."""
    semesters: dict[str, list] = {}
    for _rel, summary in entries:
        sem = summary.get("semester_code") or "unknown"
        semesters.setdefault(sem, []).append(summary)
    total = sum(len(v) for v in semesters.values())
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_profiles": total,
        "semesters": semesters,
    }


def _write_manifest(manifest: dict, path: Path, label: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        json.dump(manifest, f, indent=2)
    print(
        f"Wrote {path.relative_to(REPO_ROOT)} "
        f"({manifest['total_profiles']} {label} profiles across "
        f"{len(manifest['semesters'])} semester(s))"
    )


def main() -> None:
    # Scan all profiles once
    all_entries = _scan_all_profiles()

    # Build and write the full manifest (all-of-UQ)
    full_manifest = _build_manifest(all_entries)
    _write_manifest(full_manifest, MANIFEST_ALL_PATH, "all-of-UQ")

    # Build and write the UQBS-filtered manifest
    uqbs_codes = _load_uqbs_course_codes()
    if uqbs_codes is not None:
        uqbs_entries = [
            (rel, s) for rel, s in all_entries
            if s.get("course_code") in uqbs_codes
        ]
    else:
        uqbs_entries = all_entries  # fallback: include everything

    uqbs_manifest = _build_manifest(uqbs_entries)
    _write_manifest(uqbs_manifest, MANIFEST_PATH, "UQBS")


if __name__ == "__main__":
    main()
