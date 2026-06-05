#!/usr/bin/env python3
"""Join Jac-extracted assessment->LO mappings (backlog batch, multi-semester)
onto lo-overrides.csv as new semester-specific rows — CLASS-AWARE.

Logic per (semester, course, normalised title):
  - collect the LO list from each scraped class's matching Jac instance
  - all classes agree on one non-empty list -> ONE row, blank class_number
  - classes disagree -> one CLASS-SCOPED row per class with a non-empty list;
    classes whose Jac mapping is empty get NO row (their blank is faithful)
  - all empty -> no row (Jac maps nothing; nothing to restore)

Inputs: logs/jac-backlog-extract.json  {COURSE-CLASS-SEM: {nLO, assess:[{t,los}]}}
        logs/backlog-worklist.json     [{course, semester, class, flag, titles}]
Appends to taxonomy/lo-overrides.csv keeping SCRAPED titles (viewer matches at
runtime). Dry run by default; pass --write to append.
"""
import json, csv, re, sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
norm = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower())

jac = json.load(open(ROOT/'logs/jac-backlog-extract.json'))
work = json.load(open(ROOT/'logs/backlog-worklist.json'))

existing = list(csv.DictReader(open(ROOT/'taxonomy/lo-overrides.csv')))
existing_keys = {(r['semester_code'], (r.get('class_number') or '').strip(),
                  r['course_code'], norm(r['assessment_title'])) for r in existing}

SEM_LABEL = {"7460": "Sem 2 2024", "7480": "Summer 2024-25", "7520": "Sem 1 2025",
             "7560": "Sem 2 2025", "7580": "Summer 2025-26"}

# ---- gather: (sem, course, ntitle) -> {class: (los tuple, scraped title)} ----
gathered = defaultdict(dict)
problems = []
for w in work:
    trip = f"{w['course']}-{w['class']}-{w['semester']}"
    j = jac.get(trip)
    if not j:
        problems.append(f"NO JAC DATA: {trip}")
        continue
    jmap = {norm(a['t']): tuple(a['los']) for a in j['assess']}
    jtitles = list(jmap.keys())
    for title in w['titles']:
        n = norm(title)
        los, how = jmap.get(n), 'exact'
        if los is None:
            best, score = None, 0
            for jt in jtitles:
                s = SequenceMatcher(None, n, jt).ratio()
                if s > score:
                    best, score = jt, s
            if best and score >= 0.75:
                los, how = jmap[best], f'fuzzy {score:.2f}'
                problems.append(f"FUZZY OK: {trip} '{title}' ({how})")
            else:
                problems.append(f"NO MATCH: {trip} '{title}' vs {[a['t'] for a in j['assess']]}")
                continue
        gathered[(w['semester'], w['course'], n)][w['class']] = (los, title)

# ---- decide rows ----
new_rows, n_shared, n_scoped, n_empty, n_skipped = [], 0, 0, 0, 0
for (sem, course, n), by_class in sorted(gathered.items()):
    distinct = set(los for los, _ in by_class.values())
    title = next(t for _, t in by_class.values())
    note_base = f"Source: Jac curriculum.uq.edu.au, {SEM_LABEL[sem]}"
    if distinct == {()}:
        n_empty += len(by_class)
        continue
    if len(distinct) == 1:
        los = next(iter(distinct))
        key = (sem, '', course, n)
        if key in existing_keys:
            n_skipped += 1
            continue
        new_rows.append({'semester_code': sem, 'class_number': '',
                         'course_code': course, 'assessment_title': title,
                         'learning_outcomes': ', '.join(f'LO{x}' for x in los),
                         'notes': f"{note_base} (auto-extracted)"})
        existing_keys.add(key)
        n_shared += 1
    else:
        # parallel classes disagree -> class-scoped rows, empties get nothing
        for cls, (los, t) in sorted(by_class.items()):
            if not los:
                n_empty += 1
                continue
            key = (sem, cls, course, n)
            if key in existing_keys:
                n_skipped += 1
                continue
            new_rows.append({'semester_code': sem, 'class_number': cls,
                             'course_code': course, 'assessment_title': t,
                             'learning_outcomes': ', '.join(f'LO{x}' for x in los),
                             'notes': f"{note_base} class {cls} only — parallel "
                                      f"deliveries map differently (auto-extracted)"})
            existing_keys.add(key)
            n_scoped += 1

print(f"shared rows {n_shared} | class-scoped rows {n_scoped} | "
      f"empty-in-Jac (no row) {n_empty} | skipped(already present) {n_skipped} | "
      f"problems {len(problems)}")
for p in problems:
    print('  ', p)
if '--write' in sys.argv and new_rows:
    with open(ROOT/'taxonomy/lo-overrides.csv', 'a', newline='') as f:
        wtr = csv.DictWriter(f, fieldnames=['semester_code', 'class_number',
                                            'course_code', 'assessment_title',
                                            'learning_outcomes', 'notes'])
        wtr.writerows(new_rows)
    print(f"appended {len(new_rows)} rows to taxonomy/lo-overrides.csv")
else:
    print("(dry run — pass --write to append)")
