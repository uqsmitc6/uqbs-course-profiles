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
]

# Targeted stopword-join rules --------------------------------------------
# These handle the very common UQ policy-text pattern where a known
# capitalised vocabulary word (Policy, Procedure, UQ, etc.) is glued to a
# lowercase stopword (and, or, the) which is in turn glued to another
# capitalised word, producing artefacts like "PolicyandProcedure" or
# "UQand the". We anchor on an exact-match vocabulary to avoid ever
# splitting legitimate English words (e.g. "Introduction" would never match
# because "Introduction" isn't in the whitelist).
_VOCAB_WORDS = (
    r"Policy|Procedure|Procedures|Guide|Guides|Service|Services|"
    r"Report|Reports|Manual|Manuals|Library|Integrity|Assessment|Assessments|"
    r"Examination|Examinations|Adjustment|Adjustments|Code|Codes|Statement|"
    r"Statements|Framework|Frameworks|Regulation|Regulations|Rule|Rules|"
    r"Misconduct|Handbook|Handbooks|Plan|Plans|Policies|Act|Acts|Standard|"
    r"Standards|Charter|Form|Forms"
)
_STOPWORDS = r"and|or|the"

_SPECIFIC_JOINS = [
    # "Policyand Procedure" / "Policyand understand" → insert space between
    # known vocab-word and stopword. Since the vocab list is a closed,
    # specific set of UQ policy-text nouns, false positives on real English
    # words are effectively impossible. Trailing `\b` ensures we only match
    # complete stopwords (not "andor" or "orthe").
    (re.compile(rf"\b({_VOCAB_WORDS})({_STOPWORDS})\b"), r"\1 \2"),
    # "UQand" / "UQor" / "UQthe" — no lookahead needed because "UQ" is a
    # highly specific token; false positives effectively impossible.
    (re.compile(rf"\b(UQ)({_STOPWORDS})\b"), r"\1 \2"),
    # "my.UQand" / "Learn.UQor" where the stopword is also directly glued to
    # the next word (e.g. "Learn.UQormy" → "Learn.UQ or my"). Handle first
    # so the later rule doesn't leave a half-joined "ormy" behind.
    (re.compile(rf"\b((?:my|Learn)\.UQ)({_STOPWORDS})(?=[a-z])"), r"\1 \2 "),
    # "my.UQand " / "Learn.UQor " — stopword followed by its natural word
    # boundary (already separated from next word).
    (re.compile(rf"\b((?:my|Learn)\.UQ)({_STOPWORDS})\b"), r"\1 \2"),
    # "onmy.UQ" / "atmy.UQ" / "bymy.UQ" — short preposition glued to "my.UQ".
    # No trailing word boundary (the 'Q' is followed by a word char in the
    # worst case). Preceding word-boundary sufficient.
    (re.compile(r"\b(on|at|in|by|via|about)(my\.UQ)"), r"\1 \2"),
    # "SI-netto" / "SI-netand" / "SI-netor" — UQ's "SI-net" is the student
    # system name, often glued to a following stopword.
    (re.compile(rf"\b(SI-net)({_STOPWORDS}|to)\b"), r"\1 \2"),
    # "thePolicy" / "theGuide" — lowercase "the" glued to a vocab-word with
    # capital initial. Must be preceded by whitespace or start-of-string to
    # avoid matching inside legitimate words.
    (re.compile(rf"(^|\s)(the)({_VOCAB_WORDS})\b"), r"\1\2 \3"),
    # "Library.Learning" / "Guide.Learning" — a vocab-word ending in a
    # period followed directly by another capitalised word.
    (re.compile(rf"\b({_VOCAB_WORDS})\.([A-Z][a-z])"), r"\1. \2"),
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
    # Apply targeted stopword-join rules twice so multi-join sequences like
    # "Procedureand thePolicy" get fully expanded in one pass (first pass
    # handles "Procedureand", second picks up "thePolicy" after whitespace
    # is introduced).
    for _ in range(2):
        for pattern, repl in _SPECIFIC_JOINS:
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
