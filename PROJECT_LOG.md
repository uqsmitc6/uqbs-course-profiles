# Project Log — UQBS Course Profile Scraper

> **Last updated:** 2026-04-14 — Phase 2 viewer built (static site in `docs/`, deploys to GitHub Pages), manifest generator added, scrape workflow updated to regen manifest on each run
> **Project:** Enriched course profile scraper for UQ Business School
> **Tech stack:** Python 3 / BeautifulSoup / requests
> **Repository:** [uqsmitc6/uqbs-course-profiles](https://github.com/uqsmitc6/uqbs-course-profiles)

---

## Current State

The scraper is built, tested, and **production-ready**. It extracts a comprehensive field set from UQ course profile pages — significantly richer than Geoff's JacSON scraper (which covers the whole university but with fewer fields). Nine GitHub Actions runs completed; all extraction bugs resolved. The full Semester 1 2026 scrape (Run 9) produced 202 JSON files with 100% coverage on all critical fields and no detected extraction bugs.

### Key Architecture Decisions in Effect

- "Standalone repo, separate from Geoff's JacSON" — decided 2026-04-13. Keeps UQBS-enriched data independent from university-wide scrapes.
- "GitHub Actions as primary runner" — confirmed working 2026-04-13. UQ's `course-profiles.uq.edu.au` domain is accessible from GitHub Actions runners (Geoff's concern about IP blocking applies to `programs-courses.uq.edu.au`, not course profiles).
- "GitHub Tree API for URL discovery" — decided 2026-04-13. Uses Geoff's JacSON repo file listing to find profile URLs (class codes + semester codes) instead of hitting `programs-courses.uq.edu.au` which returns 405 from GitHub Actions.
- "Course list from taxonomy JSON" — decided 2026-04-13. Uses uqbs-programs.json (308 courses, 14 programs) as source of truth.
- "Local Mac runner kept as secondary option" — script and launchd plist available for local runs.

---

## Open Items

| # | Category | Description | Since | Priority | Notes |
|---|----------|-------------|-------|----------|-------|
| 1 | DONE | ~~First live test run~~ | 2026-04-13 | — | Completed via GitHub Actions (5 runs) |
| 2 | DONE | ~~Verify LO extraction across layouts~~ | 2026-04-13 | — | Fixed off-by-one bug; tested against both server HTML and browser DOM |
| 3 | DONE | ~~Create GitHub repo and push initial code~~ | 2026-04-13 | — | Repo: uqsmitc6/uqbs-course-profiles |
| 4 | DONE | ~~Run a broader test (multiple courses, e.g. --max 5)~~ | 2026-04-13 | — | Completed with full semester scrape (Run 9, 202 profiles) |
| 5 | TODO | Set up launchd scheduling on Sean's Mac (optional) | 2026-04-13 | Low | GitHub Actions is primary; local is secondary |
| 6 | NOTE | GA mapping in taxonomy spreadsheet is draft/WIP | 2026-04-13 | Info | Program-course mappings are correct; GA and typology columns are not finalised |
| 7 | TODO | Consider updating JacSON Viewer to read from this repo's enriched data | 2026-04-13 | Low | Future integration |
| 8 | TODO | Update README.md to reflect GitHub Actions as confirmed primary runner | 2026-04-13 | Med | Remove "experimental" language |

---

## Session History

### Session 5 — 2026-04-14 — Phase 2: viewer + automation

**Focus:** Build a static-site visualiser that reads the scraped JSON directly, hosted on GitHub Pages, auto-redeployed when the scraper commits new data.

**Design decisions:**
- **Vanilla HTML/JS, no build step** — opens locally, no framework drift, anyone on the LD team can clone + tweak
- **Pull from repo on load** (not rebuild-per-change) — site fetches `manifest.json` + individual course JSONs at runtime; GitHub Pages just serves static files
- **Same repo as scraper** — `docs/` folder inside `uqbs-course-profiles`; one source of truth
- **Deploy via Actions workflow** (not "deploy from folder") — lets us stage `profiles/` and `taxonomy/` into the pages artefact without duplicating files in the repo

**New files:**
- `scraper/build_manifest.py` — Generates `docs/assets/manifest.json`, a lean index of every profile with summary fields (~200-byte entries vs ~10KB full JSONs). Browser loads this once for the table view, fetches full JSONs on demand.
- `docs/index.html` — Course browser: searchable/filterable table (search, program, level, mode, location), sortable columns, program chips per course
- `docs/course.html` — Per-course detail view, one card per JSON section (description, aims, LOs, assessment summary + details, contacts, staff, activities, resources, policies, timetable, requirements)
- `docs/program.html` — Program index + program detail pages with core + majors from taxonomy
- `docs/assets/styles.css` — UQ purple + gold palette, responsive
- `docs/assets/app.js` — Shared fetch/render logic, page-specific init functions
- `docs/serve_local.sh` — Local dev: regenerates manifest, symlinks profiles/taxonomy into docs/, serves on :8000
- `.github/workflows/pages.yml` — Pages deploy workflow (triggered on push to profiles/, taxonomy/, docs/, or build_manifest.py; plus manual dispatch)

**Changes to existing files:**
- `.github/workflows/scrape.yml` — Added manifest regen step before commit; now commits both `profiles/` and `docs/assets/manifest.json` so the pages workflow fires with fresh data
- `.gitignore` — Ignore `docs/profiles` and `docs/taxonomy` (created as symlinks by serve_local.sh)
- `README.md` — Updated Scheduling section (GitHub Actions now primary, not experimental); added Viewer section

**Local verification:**
- `build_manifest.py`: 202 profiles indexed from single semester (7620)
- `python3 -m http.server` in docs/: all endpoints return 200 (index, manifest, taxonomy, individual course JSON)
- Cross-lookup verified: manifest + taxonomy combined correctly gives ACCT1101 → BBusMan Core, BTHEM Core
- JS syntax validated with `node -c`

**Outstanding — user action required:**
- Enable GitHub Pages in repo settings: Settings → Pages → Build and deployment → Source: "GitHub Actions"
- First pages deploy will run automatically on next push

**Phase 3 candidates (deferred):**
- Interactive dashboard (Streamlit/Observable) with cross-course analytics
- GA coverage heatmap (pending finalised GA mappings in the taxonomy spreadsheet)
- Assessment landscape view (weight × timing × type by program)
- Compare-two-courses side-by-side view
- Diff reports when profiles change week-to-week

---

### Session 4 — 2026-04-14 — Full semester validation

**Focus:** Run a full-semester scrape to validate all accumulated fixes hold at scale.

**Run 9 (full Semester 1 2026, 308 courses):**
- Duration: ~4 minutes (11:12:04 → 11:17:03 UTC)
- 308 courses processed, 198 found in JacSON index, 202 profiles scraped (some courses have multiple class offerings)
- 0 failures
- 110 warnings — all "No profiles found in JacSON repo" (courses not offered in Sem 1 2026; expected, not bugs)

**Quality sweep across all 202 profiles:**

| Field | Coverage | Notes |
|-------|----------|-------|
| `course_description` | 202 / 202 (100%) | |
| `learning_outcomes` | 202 / 202 (100%) | LO count range 3–7; no heading-prefix bugs; no LO-code leakage across boundaries |
| `assessment_summary` | 202 / 202 (100%) | Clean titles; indicators captured as `conditions` |
| `assessment_details` | 202 / 202 (100%) | |
| `timetable` | 202 / 202 (100%) | |
| `learning_activities` | 202 / 202 (100%) | |
| `learning_resources` | 202 / 202 (100%) | |
| `policies_and_procedures` | 202 / 202 (100%) | |
| `course_aims` | 201 / 202 (99.5%) | 1 legitimately empty (ADVT7512) |
| `course_staff` | 194 / 202 (96.0%) | 8 courses with no separate staff section |
| `requirements` | 192 / 202 (95.0%) | 10 courses with no stated pre/corequisites |
| `course_contacts` | 186 / 202 (92.1%) | Some courses use only `course-staff` |

**Bug sweeps — all clean at scale:**
- LO heading-prefix contamination: 0 / 202
- LO-code leakage across boundaries: 0 / 202
- Staff duplicates (same name + role): 0 / 202
- Assessment summary title contamination: 0 / 202 (earlier false-positive flags were legitimate titles like "Online Quiz", "AI Assisted Case Study")
- Empty LO descriptions: 0 / 202
- Critical field missing (desc + LOs + assessment): 0 / 202

**Verdict:** Production-ready. All Session 1–3 fixes hold at scale. Remaining coverage gaps (aims 99.5%, staff 96%, contacts 92%) reflect genuinely absent sections on source pages rather than scraper bugs — spot-checked and confirmed.

**Changes to codebase:**
- `PROJECT_LOG.md`: Updated with Run 9 results and Session 4 validation notes.

---

### Session 3 — 2026-04-13 (evening, continued)

**Focus:** Broader testing and iterative data quality fixes across multiple courses.

**Run 6 (5 ACCT courses, semester 7620):**
- 3 of 5 courses had profiles (ACCT1101, ACCT1102, ACCT1110). ACCT1111 and ACCT1112 not offered in Sem 1 2026.
- LOs correct across all three. Assessment detail scoping working.
- Found: summary title concatenation, staff role/dedup issues, aims missing on ACCT1101.

**Run 7 (MGTS1301, BSAN1201, MGTS7610, MGTS2603, MGTS7619, semester 7620):**
- 4 of 5 courses had profiles. BSAN1201 not in JacSON repo.
- MGTS1301, MGTS2603, MGTS7610: all fields correct including aims, contacts, staff with roles, clean assessment titles with conditions.
- MGTS7619 issues: staff role assignment wrong (interleaved role groups inside single wrapper), assessment detail LOs genuinely absent from page.
- Cross-checked all findings via browser JavaScript on live pages.

**Fixes applied:**
1. **Assessment summary titles had indicators jammed in** — e.g. `"Final ExaminationIdentity VerifiedIn-person"`. Root cause: the title `<td>` contains an `<a>` tag (title) followed by a `<ul class="icon-list">` (indicators like "Identity Verified", "In-person", "Team or group-based"). Using `get_text()` on the whole cell concatenated everything. Fix: extract just the `<a>` text for the title; capture indicators separately as a `conditions` list.
2. **Staff extraction missing roles and duplicating entries** — The staff section uses `<h3 class="staff-cards__role">` as a group heading above the cards (unlike contacts where role is inside each card). Fix: iterate `.staff-cards` groups, get role from heading, then iterate cards within. Added dedup by name+email.
3. **Due dates concatenated** — Multiple `<p>` tags in the due date cell were joined without separators. Fix: use `get_text(separator="; ")`.

4. **Aims extraction missed bare text nodes** — ACCT1101's aims text is a bare text node directly inside the `<section>`, not wrapped in a `<p>` tag (server HTML: `<p></p>Text here.`). The original code explicitly skipped `NavigableString` children. Fix: now captures bare text nodes (with `len > 10` filter). Verified via browser JS on the live ACCT1101 page.
5. **Staff role groups interleaved inside single wrapper** — MGTS7619's staff section has one `.staff-cards` div containing multiple `<h3>` role headings ("Lecturer", "Course facilitator") with their `.staff-cards__cards` divs interleaved. Previous code used `select(".staff-cards")` which found the single wrapper, then grabbed only the first `<h3>`. Fix: now walks `h3.staff-cards__role` headings directly and finds the next `.staff-cards__cards` sibling for each. Dedup changed from `(name, email)` to `(name, role)` to allow same person under different roles.

**Investigations (no fix needed):**
- ACCT1102 missing contacts: browser-verified — page has no `course-contact` section at all, only staff cards. Data is correct as-is.
- MGTS7619 missing assessment detail LOs: browser-verified — the page's `<dl>` for each assessment item simply has no "Learning outcomes" DT. Genuinely absent from the course profile.
- Assessment detail LOs show `L01` instead of `LO1`: this is how UQ formats them in the assessment section. Left as-is to faithfully reflect source data.

**Cross-check against Geoff's code:**
- Geoff's `extract_special_indicators` (line 71-82) captures icon-list indicators with CSS class and text — our summary fix captures the same info from the summary table cells.
- Geoff's `extract_assessment_details` uses `find_next('dt', string='...')` which searches forward globally (not scoped to each item). Our sibling-walking approach is more robust.
- Geoff doesn't extract aims, policies, or staff — these are UQBS-enriched fields unique to our scraper.

**Changes to codebase:**
- `scraper/scrape.py`: Fixed assessment summary titles, staff interleaved role groups, due date separator, aims bare text nodes.
- `PROJECT_LOG.md`: Updated with Runs 6-7 results and Session 3 notes.

---

### Session 2 — 2026-04-13 (evening)

**Focus:** Fix LO off-by-one bug identified in Session 1 testing.

**Root cause analysis:**
- The raw server HTML (what `requests.get()` receives) has a different structure to the browser-rendered DOM (what "Save page as" captures)
- Server HTML (Layout A): `<p><strong>LO1.</strong> Description text here.</p>` — LO number and description in the SAME `<p>` tag
- Browser DOM (Layout B): `<p><strong>LO1.</strong> </p><p>Description text here.</p><p></p>` — separate `<p>` tags
- The original code walked to the next sibling `<p>` first, which in Layout A grabbed the NEXT LO's paragraph (off by one)
- The "fallback" same-`<p>` extraction (which was correct) only ran if the sibling walk found nothing — but it always found the wrong thing

**Fix applied:**
- Reversed priority: check same-`<p>` first (strip LO number prefix), fall back to sibling walk
- Added safety-net regex strip of any leading `LO\d+\.?` from descriptions
- Verified against Geoff's JacSON extraction approach (lines 88-94 of `jacson.py`) — Geoff uses the same same-`<p>` strategy

**Verification:**
- Tested against Layout A (server HTML), Layout B (browser DOM), and actual browser-saved MGTS1601 page — all correct
- GitHub Actions Run 5: LOs now match Geoff's JacSON output exactly
- Assessment details still correct (fix from Session 1 Run 4 holding)

**Changes to codebase:**
- `scraper/scrape.py`: Rewrote `_extract_learning_outcomes()` — reversed same-`<p>` / sibling priority, added safety-net regex
- `PROJECT_LOG.md`: Updated with Runs 1-5 results

---

### Session 1 — 2026-04-13 (afternoon)

**Focus:** Design and build a UQBS-specific enriched course profile scraper. Test via GitHub Actions.

**Outcomes:**
- Explored Geoff's JacSON-Pi v1.0.5 codebase to understand existing scraping architecture
- Inspected live UQ course profile page (MGTS1601) via browser to identify all available data fields
- Identified 15+ fields available on the page that Geoff's scraper doesn't capture
- Built complete Python scraper with enriched field extraction
- Created GitHub Actions workflow — confirmed working (course-profiles.uq.edu.au IS accessible from GH Actions)
- Created local Mac runner script with launchd plist
- Fixed multiple extraction bugs across 5 GitHub Actions test runs (see below)

**GitHub Actions test runs:**
1. **Run 1** — FAIL — exit code 128. Missing `permissions: contents: write` in workflow YAML.
2. **Run 2** — FAIL — 405 from `programs-courses.uq.edu.au`. Replaced discovery mechanism with GitHub Tree API (fetches JacSON repo file listing).
3. **Run 3** — SUCCESS — MGTS1601 scraped and committed. But JSON review revealed: assessment details not scoped (all items got same data), LO descriptions off by one.
4. **Run 4** — SUCCESS — Assessment detail scoping fixed (sibling-walking approach with `el.__copy__()` into temp `Tag`). LO off-by-one still present.
5. **Run 5** — SUCCESS — LO off-by-one fixed (see Session 2). All fields now correct.

**Decisions made:**
- Separate repo from Geoff's JacSON (Sean doesn't have access to Geoff's infrastructure)
- GitHub Actions as primary runner (course-profiles.uq.edu.au accessible; Geoff's IP concern was about programs-courses.uq.edu.au)
- GitHub Tree API for URL discovery (programs-courses.uq.edu.au returns 405 from GH Actions)
- Use taxonomy JSON as course list source (308 courses already mapped to programs)

**Issues encountered:**
- Cowork sandbox blocks outbound requests to UQ domains (proxy 403) — cannot test from Cowork
- `programs-courses.uq.edu.au` returns 405 from GitHub Actions — replaced with GitHub Tree API
- Assessment section has 3 tables (1 summary + 2 in details) — fixed to skip nested tables
- Assessment detail `<h3>` tags share one parent `<section>` — fixed with sibling-walking scoping
- LO off-by-one due to server HTML vs browser DOM structure difference — fixed in Session 2

**Changes to codebase:**
- `scraper/scrape.py`: Main scraper — all extraction functions, multiple bug fixes
- `scraper/requirements.txt`: beautifulsoup4, requests
- `.github/workflows/scrape.yml`: GitHub Actions workflow (weekly + manual dispatch)
- `run_scrape.sh`: Local runner script with git push option
- `com.uqbs.course-scraper.plist`: macOS launchd schedule config
- `taxonomy/uqbs-programs.json`: Copied from existing project
- `README.md`: Setup and usage documentation
- `PROJECT_LOG.md`: This file

**Landmines / Watch out for:**
- UQ course profile page structure may vary between courses — parser handles two known LO layouts but untested broadly
- Some courses may not have current-semester profiles available (only archived)
- Rate limiting is set to 1 second between requests — 308 courses × ~2 requests each ≈ 10-15 minutes for a full scrape

---

## Decision Log

| Date | Decision | Rationale | Alternatives Considered | Status |
|------|----------|-----------|------------------------|--------|
| 2026-04-13 | Separate GitHub repo | Sean doesn't have access to Geoff's Pi or repo write access; keeps UQBS data cleanly separated | Fork JacSON, supplementary layer on top | Active |
| 2026-04-13 | GitHub Actions as primary runner | Confirmed working — course-profiles.uq.edu.au accessible from GH Actions runners | Local Mac only, own Raspberry Pi | Active |
| 2026-04-13 | GitHub Tree API for URL discovery | programs-courses.uq.edu.au returns 405 from GH Actions; Tree API gives full file listing from Geoff's JacSON repo in one call | Scrape programs-courses.uq.edu.au, hardcoded URL list | Active |
| 2026-04-13 | Taxonomy JSON as course list | Already maintained, has program mappings, 308 courses ready to go | CSV file, Google Sheets integration | Active |
| 2026-04-13 | Same-`<p>` first for LO extraction | Server HTML puts LO number + description in same `<p>` tag; matches Geoff's approach in jacson.py | Sibling walk first (caused off-by-one), regex on full text | Active |

---

## Known Issues & Gotchas

- **`programs-courses.uq.edu.au` blocks cloud IPs** — Returns 405 from GitHub Actions runners and Cowork sandbox. Geoff reported this as a general UQ IP block, but it only applies to this domain. `course-profiles.uq.edu.au` is fully accessible from GitHub Actions.
- **Server HTML vs browser DOM differ** — The raw HTML served by `course-profiles.uq.edu.au` (what `requests.get()` receives) has a different structure to the browser-rendered DOM (after JavaScript execution). Known differences: LO number + description in the same `<p>` (server) vs separate `<p>` tags (browser); aims text as bare text nodes (server) vs wrapped in `<p>` (browser, sometimes). The scraper handles all known layout variants.
- **Page content varies between courses** — Some courses lack certain sections entirely (e.g. ACCT1102 has no `course-contact` section, only `course-staff`; some courses have no aims text). The scraper handles missing sections gracefully — fields are simply omitted from the JSON.
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
│   └── scrape.yml                ← GitHub Actions workflow (weekly Sun 9pm AEST + manual)
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

- **2026-04-14** — PHASE 2 — Built static-site viewer (`docs/`): course browser, per-course detail, program/major pages; deploys via GitHub Pages workflow; manifest generator added to scraper
- **2026-04-14** — MILESTONE — Run 9 (full semester, 308 courses) completed: 202 profiles, 0 failures, 100% coverage on critical fields; scraper declared production-ready
- **2026-04-13 22:00** — RESOLUTION — Fixed staff interleaved role groups (MGTS7619); changed dedup to `(name, role)` to allow same person under different roles
- **2026-04-13 21:45** — TEST (Run 7) — GitHub Actions: 4/5 MGTS courses scraped. MGTS7619 staff roles wrong, assessment LOs genuinely absent.
- **2026-04-13 21:30** — RESOLUTION — Fixed aims extraction for bare text nodes (ACCT1101); browser-verified via JS on live page
- **2026-04-13 21:15** — RESOLUTION — Fixed assessment summary titles (separated indicators into `conditions` field), staff roles/dedup, due date separators
- **2026-04-13 21:00** — TEST (Run 6) — GitHub Actions: 3/5 ACCT courses scraped (2 not offered in Sem 1). LOs correct across all. Identified summary title and staff issues.
- **2026-04-13 20:30** — RESOLUTION — Fixed LO off-by-one bug; reversed same-`<p>` / sibling priority in `_extract_learning_outcomes()`
- **2026-04-13 20:15** — ANALYSIS — Identified root cause: server HTML puts LO number + desc in same `<p>`; confirmed by comparing with Geoff's jacson.py approach
- **2026-04-13 20:00** — NOTE — Sean provided manual page download (browser "Save As") and course profile viewer extension for HTML structure analysis
- **2026-04-13 19:00** — TEST (Run 5) — GitHub Actions: LOs correct, assessment details correct. All extraction verified against Geoff's JacSON output.
- **2026-04-13 18:30** — TEST (Run 4) — GitHub Actions: Assessment detail scoping fixed. LO off-by-one still present.
- **2026-04-13 18:00** — RESOLUTION — Fixed assessment detail scoping (sibling-walking with `el.__copy__()` into temp Tag)
- **2026-04-13 17:30** — TEST (Run 3) — GitHub Actions: First successful scrape of MGTS1601. JSON review found assessment detail scoping bug and LO off-by-one.
- **2026-04-13 17:15** — RESOLUTION — Replaced `programs-courses.uq.edu.au` discovery with GitHub Tree API
- **2026-04-13 17:00** — TEST (Run 2) — GitHub Actions: 405 from programs-courses.uq.edu.au
- **2026-04-13 16:45** — RESOLUTION — Added `permissions: contents: write` and `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` to workflow
- **2026-04-13 16:40** — TEST (Run 1) — GitHub Actions: exit code 128 (missing permissions)
- **2026-04-13 16:30** — CHANGE — Initial scraper build complete, all files created. Repo pushed via GitHub Desktop.
- **2026-04-13 16:25** — RESOLUTION — Fixed LO extraction for single-wrapper page layout
- **2026-04-13 16:25** — RESOLUTION — Fixed assessment summary to exclude nested detail tables
- **2026-04-13 16:20** — ISSUE — Cowork sandbox blocks UQ servers (proxy 403)
- **2026-04-13 16:15** — DECISION — GitHub Actions as primary runner (confirmed course-profiles.uq.edu.au accessible)
- **2026-04-13 16:10** — DECISION — Separate repo, GitHub Actions + local, taxonomy for course list
- **2026-04-13 15:45** — NOTE — Inspected live MGTS1601 profile page, identified all extractable fields
- **2026-04-13 15:30** — NOTE — Explored Geoff's JacSON-Pi v1.0.5 codebase
