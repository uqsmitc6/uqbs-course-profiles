#!/usr/bin/env python3
"""
lo_coverage_report.py — Diagnose where the Drupal ECP bug has dropped
learning-outcome-to-assessment mappings (fully or partially).

The bug is invisible: a dropped LO looks exactly like an assessment that
deliberately doesn't assess that LO. This report can't tell those apart with
certainty — no machine can — but it surfaces the *candidates* a human should
check against curriculum documents.

For each course offering it reports:
  - total course LOs
  - which assessments carry NO scraped LO refs at all  (MISSING)
  - which course LOs are never referenced by ANY assessment  (UNREFERENCED)
  - whether an override already exists for the course (so you can skip it)

Flags:
  MISSING_ALL   every assessment lacks LO refs — whole mapping dropped
  MISSING_SOME  some assessments have refs, some don't — likely partial drop
  UNREFERENCED  one or more course LOs are assessed by nothing — suspect partial
  OK            every assessment has refs and every LO is assessed somewhere

Usage
  python scraper/lo_coverage_report.py                 # all semesters
  python scraper/lo_coverage_report.py --semester 7620 # one semester
  python scraper/lo_coverage_report.py --uqbs-only      # restrict to taxonomy
  python scraper/lo_coverage_report.py --flagged-only   # hide OK rows
Output: prints a summary and writes logs/lo-coverage-report.csv
"""

import argparse
import csv
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROFILES_DIR = REPO_ROOT / "profiles"
TAXONOMY = REPO_ROOT / "taxonomy" / "uqbs-programs.json"
OVERRIDES = REPO_ROOT / "taxonomy" / "lo-overrides.json"
LOG_OUT = REPO_ROOT / "logs" / "lo-coverage-report.csv"

_RE_LO = re.compile(r"L\.?[O0]\.?\s*(\d+)", re.IGNORECASE)
_RE_BARE = re.compile(r"(?:^|[,;\s])(\d+)(?=[,;\s]|$)")


def parse_lo_refs(s):
    if not s:
        return []
    text = str(s)
    seen = []
    for m in _RE_LO.finditer(text):
        if m.group(1) not in seen:
            seen.append(m.group(1))
    if not seen:
        for m in _RE_BARE.finditer(text):
            if m.group(1) not in seen:
                seen.append(m.group(1))
    return [f"LO{n}" for n in seen]


def load_known_courses(path):
    if not path.exists():
        return None
    tax = json.load(open(path, "r", encoding="utf-8"))
    known = set()
    for prog in tax.get("programs", {}).values():
        for field in ["core", "flexible_core", "flexible_core_a", "flexible_core_b",
                      "program_electives", "foundational_courses", "capstone",
                      "pathway_prerequisites", "research_courses", "advanced_courses",
                      "general_pathway_courses"]:
            known.update(prog.get(field, []))
        for codes in prog.get("majors", {}).values():
            known.update(codes)
    return known


def load_override_courses(path):
    """Set of course codes that already have at least one filled override."""
    if not path.exists():
        return set()
    try:
        obj = json.load(open(path, "r", encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return set()
    return {o.get("course_code") for o in obj.get("overrides", []) if o.get("course_code")}


def assess_profile(d):
    """Return (lo_count, rows) where rows = [(title, [los], has_refs)]."""
    lo_count = len(d.get("learning_outcomes", []))
    detail_los = {}
    for it in d.get("assessment_details", []) or []:
        t = re.sub(r"\s+", " ", str(it.get("title") or "").strip()).lower()
        if t:
            detail_los[t] = parse_lo_refs(it.get("learning_outcomes_assessed")
                                          or it.get("learning_outcomes"))
    rows = []
    for a in d.get("assessment_summary", []) or []:
        title = (a.get("title") or "").strip()
        if not title:
            continue
        key = re.sub(r"\s+", " ", title.lower())
        los = detail_los.get(key, [])
        rows.append((title, los, bool(los)))
    return lo_count, rows


def main():
    p = argparse.ArgumentParser(description="LO coverage diagnostic")
    p.add_argument("--semester", default=None, help="Restrict to one semester code")
    p.add_argument("--uqbs-only", action="store_true",
                   help="Restrict to courses in the UQBS taxonomy")
    p.add_argument("--flagged-only", action="store_true",
                   help="Only show course offerings with a flag (hide OK)")
    args = p.parse_args()

    known = load_known_courses(TAXONOMY)
    override_courses = load_override_courses(OVERRIDES)

    if not PROFILES_DIR.exists():
        print("No profiles/ directory found.")
        sys.exit(1)

    results = []
    for sem_dir in sorted(PROFILES_DIR.iterdir()):
        if not sem_dir.is_dir():
            continue
        sem = sem_dir.name
        if args.semester and sem != args.semester:
            continue
        seen_courses = set()
        for jf in sorted(sem_dir.glob("*.json")):
            try:
                d = json.load(open(jf, "r", encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            course = (d.get("course_code") or "").strip().upper()
            if not course or (course, sem) in seen_courses:
                continue
            seen_courses.add((course, sem))
            if args.uqbs_only and known is not None and course not in known:
                continue

            lo_count, rows = assess_profile(d)
            if not rows:
                continue
            n_assess = len(rows)
            n_with = sum(1 for _, _, h in rows if h)
            referenced = set()
            for _, los, _ in rows:
                referenced.update(los)
            all_los = {f"LO{i}" for i in range(1, lo_count + 1)}
            unreferenced = sorted(all_los - referenced,
                                  key=lambda x: int(x[2:]))

            if n_with == 0:
                flag = "MISSING_ALL"
            elif n_with < n_assess:
                flag = "MISSING_SOME"
            elif unreferenced:
                flag = "UNREFERENCED"
            else:
                flag = "OK"

            results.append({
                "semester": sem,
                "course": course,
                "flag": flag,
                "lo_count": lo_count,
                "assessments": n_assess,
                "assessments_with_los": n_with,
                "unreferenced_los": " ".join(unreferenced),
                "has_override": "yes" if course in override_courses else "",
            })

    # Write CSV
    LOG_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["semester", "course", "flag", "lo_count",
                                          "assessments", "assessments_with_los",
                                          "unreferenced_los", "has_override"])
        w.writeheader()
        for r in sorted(results, key=lambda x: (x["semester"], x["flag"], x["course"])):
            if args.flagged_only and r["flag"] == "OK":
                continue
            w.writerow(r)

    # Summary
    from collections import Counter
    by_flag = Counter(r["flag"] for r in results)
    total = len(results)
    print(f"Scanned {total} course offerings"
          + (f" in semester {args.semester}" if args.semester else "")
          + (" (UQBS only)" if args.uqbs_only else "") + ".\n")
    for flag in ["MISSING_ALL", "MISSING_SOME", "UNREFERENCED", "OK"]:
        n = by_flag.get(flag, 0)
        pct = (100 * n / total) if total else 0
        print(f"  {flag:<13} {n:>4}  ({pct:4.1f}%)")
    flagged = total - by_flag.get("OK", 0)
    print(f"\n  {flagged} offerings need review "
          f"({100*flagged/total:.1f}%) — candidates for manual override.")
    covered = sum(1 for r in results if r["flag"] != "OK" and r["has_override"])
    if covered:
        print(f"  {covered} of those already have an override on file.")
    print(f"\n✓ Full report: {LOG_OUT}")
    print("\nNote: UNREFERENCED and MISSING_SOME are *suspected* partials — a "
          "dropped LO is indistinguishable from a deliberately-unassessed LO. "
          "Confirm against curriculum docs before entering an override.")


if __name__ == "__main__":
    main()
