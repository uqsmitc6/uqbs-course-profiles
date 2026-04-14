#!/usr/bin/env python3
"""
One-time cleanup pass for existing scraped profiles.

The old scraper used ``soup.get_text(strip=True)`` which collapses sibling
text nodes without a separator, producing artefacts like
``"IntroductionIntroduction to Management Accounting"`` or ``"nHide"``.

Future scrapes use ``get_text(separator=" ", strip=True)`` + ``normalise_ws``
and don't have this problem — but existing JSON files do. This script
re-processes every profile in ``profiles/**/*.json``, inserting spaces at
likely word boundaries and normalising whitespace, then writes back in
place.

Usage:
    python scraper/clean_existing.py            # real run, rewrites files
    python scraper/clean_existing.py --dry-run  # show counts only
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Reuse normalise_ws from the scraper
sys.path.insert(0, str(Path(__file__).resolve().parent))
from scrape import normalise_ws  # noqa: E402

PROFILES_DIR = Path(__file__).resolve().parent.parent / "profiles"

# ---- word-boundary heuristics --------------------------------------------
# These patterns target the specific artefact produced by
# ``get_text(strip=True)`` on consecutive sibling elements: a word ending in
# lowercase letter (or punctuation / digit) immediately followed by the
# start of another word. We skip the much riskier case of two sibling
# UPPERCASE strings since that would split legitimate acronyms.

_BOUNDARY_RULES = [
    # lowercase + TitleCase ("introductionIntroduction" → "introduction Introduction")
    (re.compile(r"([a-z])([A-Z][a-z])"), r"\1 \2"),
    # lowercase + ACRONYM ("ProcedureAI" → "Procedure AI")
    (re.compile(r"([a-z])([A-Z]{2,})"), r"\1 \2"),
    # punctuation + Capital ("policy.The next" → "policy. The next")
    (re.compile(r"([.!?;:,])([A-Z][a-z])"), r"\1 \2"),
    # digit-percent + Capital ("25%Task" → "25% Task")
    (re.compile(r"(\d%)([A-Z])"), r"\1 \2"),
    # digit + Capital letter + lowercase ("5Mark" → "5 Mark")
    (re.compile(r"(\d)([A-Z][a-z])"), r"\1 \2"),
    # closing paren / bracket + Capital ("profile)See" → "profile) See")
    (re.compile(r"([)\]])([A-Z][a-z])"), r"\1 \2"),
    # Stopword-boundary rule removed: too many legitimate English words end
    # in stopword letter sequences (e.g. "Introducti|on") to match safely.
]

# Keys whose string values should NOT be regex-rewritten (URLs, emails, codes).
_SKIP_KEYS = {"url", "email", "phone", "course_code", "class_code",
              "semester_code", "full_course_code"}


def _insert_boundaries(s: str) -> str:
    """Apply word-boundary regex, protecting URLs and emails from damage."""
    # Shield URLs and emails with sentinel tokens
    placeholders: list[str] = []

    def _stash(match: re.Match) -> str:
        placeholders.append(match.group(0))
        return f"\x00{len(placeholders) - 1}\x00"

    protected = re.sub(r"https?://\S+|\S+@\S+\.\S+", _stash, s)
    for pattern, repl in _BOUNDARY_RULES:
        protected = pattern.sub(repl, protected)

    def _unstash(match: re.Match) -> str:
        return placeholders[int(match.group(1))]

    return re.sub(r"\x00(\d+)\x00", _unstash, protected)


def _walk_and_fix(value, parent_key: str = ""):
    """Recursively apply boundary fixes to strings inside the tree."""
    if isinstance(value, str):
        if parent_key in _SKIP_KEYS:
            return value
        return _insert_boundaries(value)
    if isinstance(value, list):
        return [_walk_and_fix(v, parent_key) for v in value]
    if isinstance(value, dict):
        return {k: _walk_and_fix(v, k) for k, v in value.items()}
    return value


def clean_profile(profile: dict) -> dict:
    fixed = _walk_and_fix(profile)
    return normalise_ws(fixed)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true",
                   help="Report affected files without writing changes.")
    p.add_argument("--profiles-dir", type=Path, default=PROFILES_DIR,
                   help="Path to profiles/ directory.")
    args = p.parse_args()

    if not args.profiles_dir.exists():
        print(f"No profiles directory at {args.profiles_dir}", file=sys.stderr)
        sys.exit(1)

    files = sorted(args.profiles_dir.glob("*/*.json"))
    print(f"Scanning {len(files)} profile(s) in {args.profiles_dir}")

    changed = 0
    total_diffs = 0
    for f in files:
        with f.open(encoding="utf-8") as fh:
            before = json.load(fh)
        after = clean_profile(before)
        if before != after:
            changed += 1
            # Approximate diff size: char-length difference across all strings
            before_chars = json.dumps(before, ensure_ascii=False)
            after_chars = json.dumps(after, ensure_ascii=False)
            total_diffs += abs(len(after_chars) - len(before_chars))
            if not args.dry_run:
                with f.open("w", encoding="utf-8") as fh:
                    json.dump(after, fh, indent=2, ensure_ascii=False)

    verb = "would change" if args.dry_run else "changed"
    print(f"{verb} {changed}/{len(files)} files "
          f"(≈{total_diffs} characters of whitespace inserted)")


if __name__ == "__main__":
    main()
