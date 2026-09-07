#!/usr/bin/env python3
"""
carry_forward_lo.py — Heal the Drupal LO-drop automatically, from the profile history.

The published ECP drops the LO-to-assessment mapping for roughly a third of UQBS
courses each semester, sometimes wholly and sometimes partially, and the partial
drops are invisible. The authoritative fix reads Jac (jac_extract.js), which needs a
person with a Jac login. This script needs nobody: it uses the previous offering of
the same course as the witness.

The bug's signature, per assessment:
  - the previous offering has a mapping for an assessment with the same title
    (from its own scraped data, or from an override restored from Jac), and
  - the course's learning outcomes are the same in both offerings (same count,
    same wording, so the LO numbers mean the same thing), and
  - the new offering's mapping for that assessment is empty, or a strict subset
    of the previous one.

Where all three hold, the previous mapping is carried forward as an override row
with a note saying so, so the record is complete and the provenance is visible
("Carried" in the viewer, `source: carried` in the overlay). A manual or Jac row
for the same assessment always wins; this script never writes over one.

What it deliberately does not do: carry a mapping when the titles differ, when the
LO wording changed, or when the new mapping is a superset or an unrelated set.
Those are edits, not drops. A course that deliberately stops assessing an LO will
be carried until someone corrects it in lo-overrides.csv, which the note invites.

Usage
  python scraper/carry_forward_lo.py                  # every semester with profiles
  python scraper/carry_forward_lo.py --semester 7720  # one target semester
  python scraper/carry_forward_lo.py --dry-run        # report, write nothing
Writes taxonomy/lo-carried.csv (regenerated in full each run) and a summary to
logs/lo-carry-report.csv. import_lo_overrides.py reads lo-carried.csv after
lo-overrides.csv.
"""

import argparse
import csv
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROFILES_DIR = REPO_ROOT / "profiles"
TAXONOMY = REPO_ROOT / "taxonomy" / "uqbs-programs.json"
OVERRIDES_CSV = REPO_ROOT / "taxonomy" / "lo-overrides.csv"
CARRIED_CSV = REPO_ROOT / "taxonomy" / "lo-carried.csv"
LOG_OUT = REPO_ROOT / "logs" / "lo-carry-report.csv"

_RE_LO = re.compile(r"L\.?[O0]\.?\s*(\d+)", re.IGNORECASE)
_RE_BARE = re.compile(r"(?:^|[,;\s])(\d+)(?=[,;\s]|$)")


def parse_lo_refs(s):
    if not s:
        return []
    seen = []
    for m in _RE_LO.finditer(str(s)):
        if m.group(1) not in seen:
            seen.append(m.group(1))
    if not seen:
        for m in _RE_BARE.finditer(str(s)):
            if m.group(1) not in seen:
                seen.append(m.group(1))
    return [f"LO{n}" for n in seen]


def norm_title(t):
    return re.sub(r"\s+", " ", str(t or "").strip()).lower()


def norm_text(t):
    return re.sub(r"[^a-z0-9]+", " ", str(t or "").lower()).strip()


def load_known_courses(path):
    if not path.exists():
        return None
    tax = json.load(open(path, encoding="utf-8"))
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


def lo_texts(profile):
    out = []
    for lo in profile.get("learning_outcomes", []) or []:
        if isinstance(lo, dict):
            out.append(norm_text(lo.get("text") or lo.get("description") or lo.get("title") or ""))
        else:
            out.append(norm_text(lo))
    return out


def load_profiles(known):
    """profiles[course][semester] = [ {class, file, los:[text], assess:{ntitle: {title, los}} } ]"""
    profiles = {}
    for sem_dir in sorted(PROFILES_DIR.iterdir()):
        if not sem_dir.is_dir():
            continue
        for jf in sorted(sem_dir.glob("*.json")):
            try:
                d = json.load(open(jf, encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            code = (d.get("course_code") or "").strip().upper()
            if not code or (known is not None and code not in known):
                continue
            assess = {}
            for it in d.get("assessment_details", []) or []:
                t = norm_title(it.get("title"))
                if t:
                    assess[t] = {"title": (it.get("title") or "").strip(),
                                 "los": parse_lo_refs(it.get("learning_outcomes_assessed") or it.get("learning_outcomes"))}
            profiles.setdefault(code, {}).setdefault(sem_dir.name, []).append({
                "class": (d.get("class_code") or "").strip(), "file": jf.name,
                "los": lo_texts(d), "assess": assess})
    return profiles


def load_overrides():
    """Manual and Jac rows: (course, semester or '', class or '', ntitle) -> [LO..]"""
    rows = {}
    if not OVERRIDES_CSV.exists():
        return rows
    with open(OVERRIDES_CSV, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            los = parse_lo_refs(r.get("learning_outcomes"))
            if not los:
                continue
            key = ((r.get("course_code") or "").strip().upper(), (r.get("semester_code") or "").strip(),
                   (r.get("class_number") or "").strip(), norm_title(r.get("assessment_title")))
            rows[key] = los
    return rows


def override_for(overrides, course, sem, cls, ntitle):
    for key in ((course, sem, cls, ntitle), (course, sem, "", ntitle), (course, "", "", ntitle)):
        if key in overrides:
            return overrides[key]
    return None


def effective(overrides, course, sem, prof, ntitle):
    ov = override_for(overrides, course, sem, prof["class"], ntitle)
    if ov:
        return ov, "override"
    return prof["assess"][ntitle]["los"], "scraped"


def previous_offering(profiles, course, target_sem, target_prof):
    """The most recent earlier semester's profile of the course, preferring the
    one whose assessment titles overlap the target's the most."""
    sems = sorted(s for s in profiles.get(course, {}) if s < target_sem)
    for sem in reversed(sems):
        cands = profiles[course][sem]
        best = max(cands, key=lambda p: len(set(p["assess"]) & set(target_prof["assess"])))
        if set(best["assess"]) & set(target_prof["assess"]):
            return sem, best
    return None, None


def carry(profiles, overrides, target_sems):
    carried, report = [], []
    for course in sorted(profiles):
        for sem in sorted(profiles[course]):
            if target_sems and sem not in target_sems:
                continue
            for prof in profiles[course][sem]:
                prev_sem, prev = previous_offering(profiles, course, sem, prof)
                if not prev:
                    continue
                if not prof["los"] or prof["los"] != prev["los"]:
                    # Different outcomes (count or wording): the numbers do not line up.
                    for ntitle, a in prof["assess"].items():
                        if not a["los"] and ntitle in prev["assess"]:
                            report.append([sem, prof["class"], course, a["title"], "not carried",
                                           "learning outcomes changed since " + prev_sem + "; check in Jac"])
                    continue
                for ntitle, a in prof["assess"].items():
                    if ntitle not in prev["assess"]:
                        continue
                    if override_for(overrides, course, sem, prof["class"], ntitle):
                        continue  # a person or Jac already answered
                    prev_los, prev_src = effective(overrides, course, prev_sem, prev, ntitle)
                    if not prev_los:
                        continue
                    cur = a["los"]
                    if cur and not (set(cur) < set(prev_los)):
                        continue  # a superset or a different set is an edit, not a drop
                    if cur == prev_los:
                        continue
                    kind = "whole" if not cur else "partial"
                    note = ("Carried forward from " + prev_sem + " (" + prev_src + "): the " + sem +
                            " profile shows " + (", ".join(cur) if cur else "no mapping") +
                            ", a " + kind + " drop by the publishing fault. Confirm in Jac if the mapping changed.")
                    carried.append({"semester_code": sem, "class_number": prof["class"], "course_code": course,
                                    "assessment_title": a["title"], "learning_outcomes": ", ".join(prev_los), "notes": note})
                    report.append([sem, prof["class"], course, a["title"], "carried (" + kind + ")",
                                   ", ".join(cur) + " -> " + ", ".join(prev_los)])
    return carried, report


def main():
    p = argparse.ArgumentParser(description="Carry LO mappings forward over the Drupal drop")
    p.add_argument("--semester", action="append", help="target semester code (repeatable); default every semester")
    p.add_argument("--all-courses", action="store_true", help="not only the UQBS taxonomy")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    known = None if args.all_courses else load_known_courses(TAXONOMY)
    profiles = load_profiles(known)
    overrides = load_overrides()
    carried, report = carry(profiles, overrides, set(args.semester or []))

    by_sem = {}
    for r in carried:
        by_sem.setdefault(r["semester_code"], set()).add(r["course_code"])
    print(f"Carried {len(carried)} assessment mappings across "
          f"{sum(len(v) for v in by_sem.values())} course offerings"
          + (": " + ", ".join(f"{s} ({len(c)} courses)" for s, c in sorted(by_sem.items())) if by_sem else ""))
    held = [r for r in report if r[4] == "not carried"]
    if held:
        print(f"Not carried, LOs changed (needs a Jac look): {len(held)} assessments in "
              f"{len({(r[0], r[2]) for r in held})} offerings")
    if args.dry_run:
        for r in report:
            print("  " + " | ".join(r))
        return
    CARRIED_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(CARRIED_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["semester_code", "class_number", "course_code",
                                          "assessment_title", "learning_outcomes", "notes"])
        w.writeheader()
        w.writerows(carried)
    LOG_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["semester_code", "class_number", "course_code", "assessment_title", "result", "detail"])
        w.writerows(report)
    print(f"✓ Written: {CARRIED_CSV} and {LOG_OUT}")


if __name__ == "__main__":
    main()
