# UQBS Course Profile Scraper + Viewer

Enriched course profile scraper and static-site viewer for UQ Business School courses. Captures a comprehensive data set from published UQ course profiles for use in learning design, Graduate Attribute mapping, and Assurance of Learning reporting.

Built on the [JacSON](https://github.com/uq-course-profiles/jacson) architecture by Geoff, extended for UQBS-specific needs.

**Components:**

- `scraper/` — Python scraper that produces enriched JSON per course
- `docs/` — Static-site viewer (vanilla HTML + JS, no build step) served via GitHub Pages
- `taxonomy/` — UQBS program/course taxonomy driving both the scraper and the viewer

**Runs automatically:** The scrape workflow runs weekly on GitHub Actions. New JSONs are committed to the repo and the viewer redeploys within a minute.

## What it captures

The scraper pulls data from two UQ domains:

**From course-profiles.uq.edu.au** (the full profile page):

- Course title, code, semester, study period
- Study level (UG/PG), units, coordinating unit, administrative campus
- Course description (full overview text)
- Course aims statement
- Course requirements (prerequisites, incompatible courses, companions)
- Learning outcomes (number + description)
- Assessment summary (category, title, weight, due date)
- Assessment details per item:
  - Task description, submission guidelines
  - Learning outcomes assessed (assessment-to-LO mapping)
  - Mode, category, conditions (time-limited, secure, etc.)
  - Exam details
  - AI/academic integrity statements
  - Deferral/extension and late submission policies
  - Special indicators
- Learning activities (week, type, topic, LO mapping)
- Learning resources
- Course contacts and staff
- Timetable information
- Policies and procedures

**From programs-courses.uq.edu.au** (the course catalogue):

- Faculty, school
- Class hours (e.g. "Seminar 2 Hours/Week")
- Duration
- Study abroad eligibility
- Course description (short version)

## Course list

The scraper uses `taxonomy/uqbs-programs.json` as its source of truth for which courses to scrape. This taxonomy contains 308 UQBS courses across 14 programs (both UG and PG), extracted from the UQBS GA Mapping spreadsheet.

## Quick start

```bash
# Install dependencies
pip3 install -r scraper/requirements.txt

# Test with a single course
python3 scraper/scrape.py --courses MGTS1601

# Scrape a specific semester only
python3 scraper/scrape.py --semester 7620

# Scrape first 10 courses (for testing)
python3 scraper/scrape.py --max 10

# Full scrape (all 308 UQBS courses)
python3 scraper/scrape.py

# Using the runner script (with optional git push)
./run_scrape.sh --courses MGTS1601 ACCT1101
./run_scrape.sh --push   # scrape all + commit and push
```

## Output

Scraped profiles are saved as JSON files under `profiles/{semester_code}/`:

```
profiles/
├── 7620/
│   ├── MGTS1601-20353-7620.json
│   ├── ACCT1101-20001-7620.json
│   └── ...
└── 7660/
    └── ...
```

## Scheduling

**Primary: GitHub Actions** — `.github/workflows/scrape.yml` runs weekly (Sundays 9pm AEST) and supports manual dispatch with semester/course filters. `course-profiles.uq.edu.au` is accessible from GitHub Actions runners, so the full scrape runs cleanly in the cloud. The workflow commits new profiles back to the repo, which automatically triggers a viewer redeploy.

**Optional: macOS launchd** — For a local backup runner, edit the path in `com.uqbs.course-scraper.plist` and install it with `launchctl load ~/Library/LaunchAgents/com.uqbs.course-scraper.plist`. Manual run: `./run_scrape.sh --push`.

## Viewer (GitHub Pages)

The `docs/` folder is a vanilla HTML/JS static site that renders the scraped data. Three pages:

- `index.html` — Searchable/filterable course browser (by program, level, mode, location)
- `course.html?file=…` — Per-course detail view showing every scraped field
- `program.html?program=…` — Program/major navigation with course lists pulled from the taxonomy

**Deployment:** The `.github/workflows/pages.yml` workflow rebuilds the site whenever `profiles/`, `taxonomy/`, or `docs/` change. It regenerates the lean manifest (`docs/assets/manifest.json`), stages `profiles/` and `taxonomy/` into `docs/`, and deploys to GitHub Pages. You'll need to enable Pages in the repo settings ("Build and deployment" → Source: "GitHub Actions").

**Local dev:**

```bash
./docs/serve_local.sh           # rebuild manifest, stage symlinks, serve on :8000
# then open http://localhost:8000/index.html
```

The manifest generator can be run independently:

```bash
python3 scraper/build_manifest.py   # writes docs/assets/manifest.json
```

## Semester codes

| Code | Semester |
|------|----------|
| 7620 | Semester 1, 2026 |
| 7660 | Semester 2, 2026 |

Pattern: digit 0 = decade base (7 for 2020s), digit 1 = year offset from 2020, digit 2 = term (2=Sem1, 6=Sem2), digit 3 = sub-term (0).

## Dependencies

- Python 3.10+
- beautifulsoup4
- requests

---

*Built by Sean Smith, Learning Designer, UQ Business School, with assistance from Claude (Anthropic).*
