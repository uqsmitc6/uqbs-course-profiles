# UQBS Course Profile Scraper

Enriched course profile scraper for UQ Business School courses. Captures a comprehensive data set from published UQ course profiles for use in learning design, Graduate Attribute mapping, and Assurance of Learning reporting.

Built on the [JacSON](https://github.com/uq-course-profiles/jacson) architecture by Geoff, extended for UQBS-specific needs.

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

## Scheduling (macOS)

UQ servers block requests from cloud/datacenter IPs (including GitHub Actions), so the scraper needs to run from a machine with a residential or university IP address.

To schedule weekly runs on your Mac:

1. Edit the path in `com.uqbs.course-scraper.plist` to match your local repo location
2. Copy the plist to `~/Library/LaunchAgents/`
3. Load it:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.uqbs.course-scraper.plist
   ```

The default schedule is Sundays at 9:00 PM AEST. The scraper will run, then commit and push any changes to GitHub.

To run manually at any time: `./run_scrape.sh --push`

## GitHub Actions (experimental)

A GitHub Actions workflow is included at `.github/workflows/scrape.yml` in case UQ changes their IP blocking policy. It supports manual dispatch with semester and course filters. Currently not expected to work due to UQ's IP restrictions on cloud providers.

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
