# Project Log — UQBS Course Profile Scraper

> **Last updated:** 2026-04-13 16:30
> **Project:** Enriched course profile scraper for UQ Business School
> **Tech stack:** Python 3 / BeautifulSoup / requests
> **Repository:** uqbs-course-profiles (GitHub, not yet pushed)

---

## Current State

The scraper is built and feature-complete. It extracts a comprehensive field set from UQ course profile pages — significantly richer than Geoff's JacSON scraper (which covers the whole university but with fewer fields). Not yet tested against live UQ servers due to Cowork sandbox network restrictions. Awaiting first local test run on Sean's Mac.

### Key Architecture Decisions in Effect

- "Standalone repo, separate from Geoff's JacSON" — decided 2026-04-13. Keeps UQBS-enriched data independent from university-wide scrapes.
- "Run locally on Mac, not GitHub Actions" — decided 2026-04-13. UQ servers block cloud/datacenter IPs (confirmed by Geoff). Mac has residential/university IP.
- "Course list from taxonomy JSON" — decided 2026-04-13. Uses uqbs-programs.json (308 courses, 14 programs) as source of truth.
- "GitHub Actions workflow kept as fallback" — decided 2026-04-13. In case UQ changes IP policy.

---

## Open Items

| # | Category | Description | Since | Priority | Notes |
|---|----------|-------------|-------|----------|-------|
| 1 | TODO | First live test run on Sean's Mac | 2026-04-13 | High | Need to verify parsing against real HTTP responses |
| 2 | TODO | Verify LO extraction works across different course page layouts | 2026-04-13 | High | Fixed the single-wrapper layout, untested on other courses |
| 3 | TODO | Create GitHub repo and push initial code | 2026-04-13 | Med | Sean to set up repo |
| 4 | TODO | Set up launchd scheduling on Sean's Mac | 2026-04-13 | Low | After repo is set up and first test passes |
| 5 | NOTE | GA mapping in taxonomy spreadsheet is draft/WIP | 2026-04-13 | Info | Program-course mappings are correct; GA and typology columns are not finalised |
| 6 | TODO | Consider updating JacSON Viewer to read from this repo's enriched data | 2026-04-13 | Low | Future integration |

---

## Session History

### Session — 2026-04-13

**Focus:** Design and build a UQBS-specific enriched course profile scraper.

**Outcomes:**
- Explored Geoff's JacSON-Pi v1.0.5 codebase to understand existing scraping architecture
- Inspected live UQ course profile page (MGTS1601) via browser to identify all available data fields
- Identified 15+ fields available on the page that Geoff's scraper doesn't capture
- Built complete Python scraper with enriched field extraction
- Created GitHub Actions workflow (may not work due to UQ IP blocking)
- Created local Mac runner script with launchd plist
- Fixed LO extraction bug (single-wrapper layout with alternating paragraphs)
- Fixed assessment summary extraction (was picking up nested tables from detail sections)

**Decisions made:**
- Separate repo from Geoff's JacSON (Sean doesn't have access to Geoff's infrastructure)
- Run locally on Mac rather than GitHub Actions (UQ blocks cloud IPs — confirmed by Geoff)
- Use taxonomy JSON as course list source (308 courses already mapped to programs)

**Issues encountered:**
- Cowork sandbox blocks outbound requests to UQ domains (proxy 403) — cannot test scraper in Cowork
- LO structure on page uses single wrapper div with alternating `<p>` tags for number and description — fixed parser
- Assessment section contains 3 tables (1 summary + 2 in details) — fixed to only grab first non-nested table

**Changes to codebase:**
- `scraper/scrape.py`: Main scraper — all extraction functions
- `scraper/requirements.txt`: beautifulsoup4, requests
- `.github/workflows/scrape.yml`: GitHub Actions workflow (experimental)
- `run_scrape.sh`: Local runner script with git push option
- `com.uqbs.course-scraper.plist`: macOS launchd schedule config
- `taxonomy/uqbs-programs.json`: Copied from existing project
- `README.md`: Setup and usage documentation
- `PROJECT_LOG.md`: This file

**Landmines / Watch out for:**
- UQ course profile page structure may vary between courses — the parser handles several layouts but untested broadly
- The `programs-courses.uq.edu.au` sidebar extraction relies on `<dt>`/`<dd>` patterns that may not be consistent across all courses
- Some courses may not have current-semester profiles available (only archived)
- Rate limiting is set to 1 second between requests — 308 courses × ~2 requests each ≈ 10-15 minutes for a full scrape

---

## Decision Log

| Date | Decision | Rationale | Alternatives Considered | Status |
|------|----------|-----------|------------------------|--------|
| 2026-04-13 | Separate GitHub repo | Sean doesn't have access to Geoff's Pi or repo write access; keeps UQBS data cleanly separated | Fork JacSON, supplementary layer on top | Active |
| 2026-04-13 | Run on Mac locally | UQ blocks cloud/datacenter IPs (GitHub Actions, Cowork sandbox) | GitHub Actions, Cowork on-demand, own Raspberry Pi | Active |
| 2026-04-13 | Taxonomy JSON as course list | Already maintained, has program mappings, 308 courses ready to go | CSV file, Google Sheets integration | Active |

---

## Known Issues & Gotchas

- **UQ IP blocking** — UQ servers (both course-profiles.uq.edu.au and programs-courses.uq.edu.au) block requests from cloud/datacenter IP ranges. Scraper must run from residential or university IPs. First noticed by Geoff (2025), confirmed in Cowork sandbox (2026-04-13).
- **Hidden sections** — Several sections on course profile pages have `class="hidden"` (aims-and-outcomes, assessment, learning-resources, learning-activities, policies-and-guidelines). The HTML content is still in the DOM and parseable by BeautifulSoup — the `hidden` class is CSS-only.

---

## Dependencies & Environment

| Dependency | Version | Purpose | Notes |
|-----------|---------|---------|-------|
| Python | 3.10+ | Runtime | macOS ships with Python 3 via Xcode CLT |
| beautifulsoup4 | >=4.12 | HTML parsing | Core scraping engine |
| requests | >=2.31 | HTTP client | With 1s delay rate limiting |

---

## File Map

```
uqbs-course-profiles/
├── .github/workflows/
│   └── scrape.yml                ← GitHub Actions workflow (experimental)
├── scraper/
│   ├── scrape.py                 ← Main scraper (all extraction logic)
│   └── requirements.txt          ← Python dependencies
├── profiles/                     ← Scraped JSON output (per semester)
│   └── {semester_code}/
│       └── {COURSE-CLASS-SEM}.json
├── taxonomy/
│   └── uqbs-programs.json        ← UQBS program/course taxonomy
├── logs/                         ← Scrape run logs
├── run_scrape.sh                 ← Local runner script
├── com.uqbs.course-scraper.plist ← macOS launchd config
├── README.md                     ← Setup and usage docs
├── PROJECT_LOG.md                ← This file
└── .gitignore
```

---

## Changelog

- **2026-04-13 16:30** — CHANGE — Initial scraper build complete, all files created
- **2026-04-13 16:25** — RESOLUTION — Fixed LO extraction for single-wrapper page layout
- **2026-04-13 16:25** — RESOLUTION — Fixed assessment summary to exclude nested detail tables
- **2026-04-13 16:20** — ISSUE — Cowork sandbox blocks UQ servers (proxy 403)
- **2026-04-13 16:15** — DECISION — Run locally on Mac (UQ blocks cloud IPs)
- **2026-04-13 16:10** — DECISION — Separate repo, GitHub Actions + local, taxonomy for course list
- **2026-04-13 15:45** — NOTE — Inspected live MGTS1601 profile page, identified all extractable fields
- **2026-04-13 15:30** — NOTE — Explored Geoff's JacSON-Pi v1.0.5 codebase
