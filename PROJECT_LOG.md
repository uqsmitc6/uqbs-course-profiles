# Project Log — UQBS Course Profile Scraper

> **Last updated:** 2026-06-03 — LO-to-assessment override overlay built (Session 10): CSV→JSON pipeline, replace-per-assessment merge in viewer, coverage diagnostic. Diagnostic found 9 partial-drop courses the original audit missed.
> **Project:** UQBS Course Profile Viewer and Learning Design Intelligence Platform
> **Tech stack:** Python 3 / BeautifulSoup / requests / GitHub Actions / GitHub Pages
> **Repository:** [uqsmitc6/uqbs-course-profiles](https://github.com/uqsmitc6/uqbs-course-profiles)

---

## Current State

The scraper is built, tested, and **production-ready**. It extracts a comprehensive field set from UQ course profile pages — significantly richer than Geoff's JacSON scraper (which covers the whole university but with fewer fields). As of Session 9 (2026-06-02), the scraper supports **all of UQ** via the `--all-uq` flag (3,271 courses across 1,750 per semester), while the live UQBS viewer remains completely isolated via dual manifests. The all-of-UQ expansion is driven by ATLAS, a TIG-funded project that consumes this scraper's JSON as its data spine.

**Evolving vision:** The project started as a way to easily navigate published ECPs and download info from the browser (the bulk export is a standout feature). It's now actively becoming a **learning design intelligence platform** for the UQBS team. Two overlay data layers are now built and integrated: **Assurance of Learning (AoL)** and the **LO-to-assessment override** layer (Session 10, patches UQ's Drupal bug that drops LO mappings fully or partially). The AoL layer uses an overlay architecture: team maintains a CSV (`taxonomy/aol-template.csv`), an import script converts it to JSON (`taxonomy/aol-status.json`), and the viewer loads it at runtime to show AoL status across course, programme, and dashboard views. This same pattern will be used for GA mapping, assessment typologies, Indigenous curriculum tracking, and assessment security classification.

**AoL lifecycle:** TBD → Identified → Rubric in Dev → Active → Established. Grain: semester + course + GA + assessment item + rubric link. Data starts from Sem 1 2026 onwards. If a mapping doesn't go ahead, the row is simply removed (no "disrupted" or "N/A" status needed).

**GA vs AoL relationship (confirmed with AD L&T):** GA mapping is broader than AoL and persists independently — it's about constructive alignment against PLOs. AoL is a subset that gets the full rubric integration treatment. More GAs will be mapped than AoL implemented in most cases. The goal is for all GAs to be covered by some AoL criteria, but not necessarily all within a single assessment. GA mapping is a precursor to AoL, but GA mapping will continue to exist and matter even after AoL is fully rolled out. All courses targeted for AoL mapping starting Sem 2 2026.

### Key Architecture Decisions in Effect

- "Standalone repo, separate from Geoff's JacSON" — decided 2026-04-13. Keeps UQBS-enriched data independent from university-wide scrapes.
- "GitHub Actions as primary runner" — confirmed working 2026-04-13. UQ's `course-profiles.uq.edu.au` domain is accessible from GitHub Actions runners (Geoff's concern about IP blocking applies to `programs-courses.uq.edu.au`, not course profiles).
- "GitHub Tree API for URL discovery" — decided 2026-04-13. Uses Geoff's JacSON repo file listing to find profile URLs (class codes + semester codes) instead of hitting `programs-courses.uq.edu.au` which returns 405 from GitHub Actions.
- "Course list from taxonomy JSON" — decided 2026-04-13, overhauled 2026-04-15. Uses uqbs-programs.json (323 courses, 23 programmes) as source of truth for UQBS scrapes. Verified against my.UQ structured data for all programmes.
- "All-of-UQ via JacSON index" — decided 2026-06-02. `--all-uq` flag bypasses taxonomy and uses full JacSON repo index (3,271 courses, 1,750 in current semester). UQBS taxonomy remains the filter for the viewer manifest.
- "Dual manifests — keep 'em separated" — decided 2026-06-02. `manifest.json` is UQBS-only (powers the live viewer, never affected by all-of-UQ data). `manifest-all.json` is everything (consumed by ATLAS). Built from a single scan of profiles/.
- "Local Mac for historical backfill, Actions for ongoing" — decided 2026-06-02. One-off historical semester scrapes run locally (~15 min per semester at --delay 0.5). Weekly cron stays UQBS-only by default; all-of-UQ available via manual dispatch.
- "Local Mac runner kept as secondary option" — script and launchd plist available for local runs.
- "Overlay architecture for internal data layers" — decided 2026-04-15. Each data layer (AoL, GA, typologies, etc.) has its own CSV→JSON import pipeline and JSON overlay file, loaded by the viewer at runtime. Keeps each layer independently updatable and avoids bloating uqbs-programs.json.
- "AoL lifecycle: TBD → Identified → Rubric in Dev → Active → Established" — decided 2026-04-15, TBD added after team feedback. Simpler than textbook AACSB 5-stage model; matches UQBS team's actual workflow. "Disrupted" status removed — unmapped items are simply deleted.
- "AoL data starts Sem 1 2026 onwards" — decided 2026-04-15. No need to backfill historical data.

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
| 9 | DONE | ~~Post-deploy bug fixes: LO codes, assessment→LO mapping, policy-text run-ons~~ | 2026-04-14 | — | All three fixed in Session 6 |
| 10 | DONE | ~~Viewer polish: Classic/Fun theme, downloads, dark-mode toggle~~ | 2026-04-14 | — | Shipped in Session 6 |
| 11 | DONE | ~~Taxonomy overhaul: 14→23 programmes, verified against my.UQ~~ | 2026-04-15 | — | Shipped in Session 7 |
| 12 | TODO | Populate empty major course lists (BAFE Economics/Finance, 3 MEI fields) | 2026-04-15 | Low | my.UQ only provides plan codes, not individual courses |
| 13 | TODO | Add missing program_code values to 11 legacy programmes | 2026-04-15 | Low | Pre-existing entries; codes available from my.UQ pages |
| 14 | TODO | **Graduate Attribute (GA) mapping** — integrate GA data into taxonomy/viewer | 2026-04-15 | High | See Phase 3A below |
| 15 | DONE | ~~**Assurance of Learning (AoL) mapping** — semester-aware status tracking~~ | 2026-04-15 | — | Shipped in Session 8: overlay architecture, import script, viewer integration, dashboard |
| 16 | TODO | **Assessment typologies mapping** | 2026-04-15 | Med | See Phase 3C below |
| 17 | TODO | **Indigenising the curriculum** — tracking and visibility | 2026-04-15 | Med | See Phase 3D below |
| 18 | TODO | **Assessment security** — classification per assessment item | 2026-04-15 | Med | See Phase 3E below |
| 19 | TODO | **Visual redesign** — more colourful Classic mode + radical Fun mode overhaul | 2026-04-15 | Low | Separate project, partially underway |
| 20 | TODO | **Scrape automation audit** — confirm weekly cron is running, review what Sean needs to do manually | 2026-04-15 | Med | See "Scrape Automation Status" section |
| 21 | TODO | **Scrape history / change tracking** — decide on approach for maintaining profile history | 2026-04-15 | Med | See "Scrape History" section |
| 22 | DONE | ~~**All-of-UQ scraper expansion** — --all-uq flag, dual manifests, --delay flag~~ | 2026-06-02 | — | Shipped in Session 9 |
| 23 | TODO | **Backfill historical semesters** — run --all-uq locally for semesters 7450–7620 | 2026-06-02 | Med | ~30 min per semester on Mac; see Session 9 for instructions |
| 24 | TODO | **Switch weekly cron to all-of-UQ** — once backfill is verified, update cron default | 2026-06-02 | Med | Currently cron stays UQBS-only for safety |
| 25 | DONE | ~~**All-of-UQ browser page** — browse-all.html with school filter~~ | 2026-06-02 | — | Shipped in Session 9 |
| 26 | DONE | ~~**LO-to-assessment override system** — manual CSV overrides for courses where Drupal doesn't render the mapping~~ | 2026-06-02 | — | Shipped in Session 10: replace-per-assessment overlay + coverage diagnostic |
| 27 | TODO | **Backfill remaining semesters** — 7450, 7460, 7480, 7490, 7520, 7560, 7580, 7590, 7660 | 2026-06-02 | Med | ~15 min each on Mac with --delay 0.5 |
| 28 | DONE | ~~**Fill in LO override CSV**~~ | 2026-06-03 | — | Session 11: all 135 rows filled from Jac API, 0 warnings |
| 29 | DONE | ~~**Review 9 suspected-partial courses**~~ | 2026-06-03 | — | Session 11: 8 MISSING_SOME filled from Jac; ECON3430 verified correct (LO5/6 genuinely unassessed) |
| 30 | DONE | ~~**Persist activity-to-LO mapping**~~ | 2026-06-03 | — | Saved to `taxonomy/sources/activity-lo-mapping-jac-7620.json` (43 courses, 753 rows) via gzip+base64 transfer |
| 31 | TODO | **Commit & push the filled overrides** — `git add taxonomy/ docs/taxonomy/ scraper/jac_extract.js` then commit/push to deploy via Pages | 2026-06-03 | High | Sean's action; live viewer unchanged until pushed |
| 32 | NOTE | **MBA courses are a special case** — run multiple offerings per semester (weekend/intensive/teaching periods) with *different* assessments; use SI-NET class-number matching, not semester-period matching | 2026-06-03 | Med | `jac_extract.js` now supports `{code:[classNumber]}` matching; MGTS7812 was the example this round |

---

## Phase 3 Roadmap — Learning Design Intelligence Layer

The next major phase turns this from a course profile viewer into a learning design intelligence platform. All of these features involve **internal team data** that isn't published in official UQ systems, so the core architecture challenge is: how do we ingest, store, and update this data without it being a pain to maintain?

### Data Ingestion Strategy (applies to all Phase 3 features)

The team needs to be able to update this data easily — not one course at a time, but by dumping a spreadsheet. Proposed approach:

- **Spreadsheet as source of truth:** Each data layer (GA, AoL, typologies, etc.) has a canonical CSV/XLSX that the team maintains (likely on SharePoint alongside rubrics)
- **Import script:** A Python script (similar to `build_manifest.py`) that reads the spreadsheet and merges it into the taxonomy JSON or a separate overlay JSON
- **Overlay architecture:** Rather than cramming everything into `uqbs-programs.json`, consider separate data files (e.g. `taxonomy/ga-mapping.json`, `taxonomy/aol-status.json`) that the viewer loads and merges at runtime. This keeps each data layer independently updatable
- **Semester awareness:** AoL status in particular changes semester to semester. The data structure needs a semester dimension — e.g. `{ "MGTS1601": { "7620": { "status": "delivered", "rubric_url": "..." }, "7660": { "status": "proposed" } } }`
- **Validation on import:** Script should flag missing courses, unknown programme keys, etc. before writing

### Phase 3A — Graduate Attribute (GA) Mapping

**What:** Each course is mapped to one or more of UQ's Graduate Attributes. This mapping tells us which GAs are assessed in which courses across each programme.

**Current state:** Item #6 notes GA mapping in the taxonomy spreadsheet is draft/WIP. The programme-course mappings are now solid (Session 7), so GA integration can proceed.

**Key considerations:**
- GA mapping is at the course level (which GAs does this course assess?) but the interesting views are at the programme level (GA coverage heatmap across a programme's courses)
- The viewer could show GA chips per course (like the existing programme chips) and a programme-level GA coverage matrix
- GAs are relatively stable across semesters — this is more of a "set and occasionally revise" dataset

### Phase 3B — Assurance of Learning (AoL) Mapping

**What:** AACSB Assurance of Learning tracks whether specific learning goals are being assessed, collected, and reviewed. This is closely related to GA mapping but has its own lifecycle.

**Key considerations:**
- AoL status changes semester to semester: proposed → delivered → collected → reviewed → closed-the-loop
- The mapping is through **rubrics** — each AoL measure is assessed via a rubric criterion in a specific assessment item
- Need to link to rubric files (likely on Teams SharePoint) — so the data structure needs a `rubric_url` or similar field per AoL measure
- The viewer needs a way to show "where are we at across the portfolio this semester" — a status dashboard, not just a per-course view
- Multiple semesters of data need to coexist (to show progress over time for AACSB reporting) but this shouldn't become an infinite backwards database — probably keep 2–3 years / 4–6 semesters and archive older data

### Phase 3C — Assessment Typologies

**What:** Classification of each assessment item by type (e.g. exam, essay, presentation, group project, portfolio, etc.) — richer than what's in the published ECP.

**Key considerations:**
- Some typology data may already be inferrable from the scraped assessment summaries (title patterns, weight, etc.)
- The team likely has a more nuanced classification than what's published
- Useful for portfolio-level views: "how many exams vs. authentic assessments across the programme?"

### Phase 3D — Indigenising the Curriculum

**What:** Tracking which courses have embedded Indigenous perspectives, content, or pedagogies, and to what degree.

**Key considerations:**
- This is sensitive data that should be accurate and not performative
- Likely a per-course flag or scale, possibly with notes on what the Indigenous content involves
- Useful for programme-level reporting on progress toward UQ's reconciliation commitments

### Phase 3E — Assessment Security

**What:** Classification of assessment items by security level (e.g. invigilated exam, online proctored, take-home, open-book, AI-permitted, etc.).

**Key considerations:**
- Relevant to academic integrity discussions and AI policy
- Could partially be inferred from scraped ECP data (exam vs. assignment) but the team likely has more granular classifications
- Changes semester to semester as assessment designs evolve

---

## Scrape Automation Status

**Current setup:** The scraper runs via GitHub Actions on a **weekly cron schedule** (every Sunday at 9 PM AEST / 11:00 UTC). It can also be triggered manually via workflow dispatch with optional filters (specific semester, course codes, or max count for testing).

**What's automated:**
- URL discovery (via Geoff's JacSON repo tree API)
- Profile scraping and JSON output
- Manifest regeneration (`build_manifest.py`)
- Git commit and push of new/updated profiles
- GitHub Pages redeployment (triggered by the push)

**What Sean needs to do manually:** Effectively nothing for routine scrapes. The weekly cron handles it. Manual intervention only needed for: adding new courses to the taxonomy (which triggers inclusion in future scrapes), or running an ad-hoc scrape via the GitHub Actions UI.

**Question to resolve:** Is the weekly cron actually firing? Sean should check the Actions tab for recent automated runs. If it hasn't run since the initial setup, the cron may need the workflow to exist on the default branch.

---

## Scrape History & Change Tracking

**Current behaviour:** Each scrape **overwrites** the existing JSON files in `profiles/{semester}/`. The only history is git commit history — each commit is timestamped and includes a profile count, so you can `git diff` between commits to see what changed. But there's no structured changelog or archive.

**Geoff's approach (JacSON):** Worth investigating — does JacSON maintain historical snapshots or just overwrite?

**Design questions to resolve:**
- **How much history matters?** For the LD team's purposes, do we need to know "MGTS1601's assessment changed between week 3 and week 8 of Sem 1"? Or is "here's the latest for each semester" sufficient?
- **Semester as natural boundary:** Profiles change within a semester (coordinators update ECPs), but the most meaningful comparison is probably semester-over-semester. Consider: keep one "canonical" snapshot per semester (e.g. the week-1 scrape) and flag if later scrapes detect changes.
- **Storage concern:** Sean doesn't want this to become an infinite backwards database or unwieldy. Options: (a) git history only (current — lightweight but hard to query), (b) structured diff log (a JSON changelog per course noting what fields changed and when), (c) semester snapshots (keep `profiles/7620-week1/` alongside `profiles/7620-latest/`), (d) keep N semesters and archive older ones to a separate branch or release.
- **Recommended starting point:** Add a lightweight diff step to the scraper that, after writing updated profiles, generates a `changes.json` summary listing which courses had field changes since last scrape. This gives visibility without storing full historical copies.

---

## Session History

### Session 11 — 2026-06-03 — Jac extraction: all 43 mappings recovered & filled

**Focus:** Fill the (blank) `lo-overrides.csv` with the real, authoritative LO-to-assessment mappings for all 43 affected courses, pulled from UQ's Jac curriculum system via Claude in Chrome.

**Key discovery — the mapping is in Jac and recoverable via API:** UQ's Jac (curriculum.uq.edu.au/cms/classes) holds the authoritative assessment↔LO mapping that the published ECP drops. The published HTML and even the page-rendered grid hide the mapped state in a visual matrix (cells carry a `span.active-cell` only when mapped — no accessible label). Rather than scrape 43 rendered pages, the whole thing was done via Jac's internal REST API:
- **Auth:** the Jac SPA stores a JWT in `localStorage['token']`; sent as `Authorization: Bearer`. (Used in-session only, never printed/exfiltrated.)
- **Search:** `POST /api/v1/classes/get-resources` `{courseCode, pageSize:100, …}` → `items[]` with `classId`, `curriculumVersionId`, `fromYYYYSS`, `stateName`. `fromYYYYSS` encodes year+period: **202601 = Semester 1 2026** (= our semester code 7620).
- **Mapping:** `GET /api/v1/curriculums/v2/{curriculumVersionId}/components` → 487-item form-builder array. The two mapping matrices sit in a component whose `changeTracking[last].value` parses to `{headings:[{title:"N. …"}], rows:[{subformInstanceTitle, cells:[{active}]}]}`. A cell is mapped iff `cell.active`; column i = LO(i+1). First matrix (lower index) = **Assessment**, second = **Activity** (confirmed by subform header text).
- Dead ends (both return `[]`): `/complex-mappings/curriculum-mappings/{id}` (program-level), `/entity-references/{id}/links`.
- **Reusable recipe saved:** `scraper/jac_extract.js` (browser console snippet) — re-runs assessment + activity extraction for any course list / semester. Use it next semester (change `TARGET`).

**Extraction run:** All 43 courses pulled via the API in chunked browser calls (≈7s/course; the components payload is heavy). 100% success, 0 errors. Every assessment came back with a non-empty LO list — confirming the bug is purely a publish/render fault and the data is intact upstream.

**Fill pipeline (`outputs/jac_assess_mapping.json` → `fill_from_jac.py` → CSV):**
- Joined Jac assessment titles onto the scaffolded CSV rows (which carry scraped ECP titles), keeping the scraped title so the viewer matches at runtime. Matching via alphanumeric-only normalisation (handles "Power Point" vs "PowerPoint") with a difflib fallback.
- Result: **135/135 rows filled across 43 courses, 0 warnings** on import (every title matches a scraped assessment, every LO in range, nothing clobbered).
- Provenance copy: `taxonomy/sources/lo-overrides-source-jac-7620.json`.

**Two edge cases resolved:**
- **MGTS7812 — dual offerings.** Runs two Sem-1-2026 classes (20136 & 22215) with *genuinely different* A1 assessments ("Organisation Case-Study" vs "Stakeholder Simulation"). Pulled both Jac instances and filled both offerings' titles. (General note: a course can have >1 instance per semester with different assessments; `jac_extract.js` takes the first Published — iterate `cands` if every offering is needed.)
- **ECON3430 — false-positive partial.** The coverage diagnostic flagged it `UNREFERENCED` (LO5/LO6 assessed by nothing). Jac confirms LO5/LO6 are *genuinely not assessed* by any item, and the scraped mapping already matches Jac exactly. So it's correct as published — **no override needed**. (Exactly the intended workflow: diagnostic flags candidates, human/Jac verification clears the false positives.)

**Verification:** import 0 warnings; coverage report shows 43/44 flagged courses now carry an override (ECON3430 correctly excluded); 6-course render spot-check (incl. dual-offering MGTS7812 and several partial-drops) all PASS — override chips + ✎ legend present and correct.

**Open items closed:** #28 (fill CSV) → DONE. #29 (review 9 suspected partials) → DONE: the 8 `MISSING_SOME` filled from Jac; ECON3430 verified correct.

**Activity-to-LO mapping:** captured in-session for all 43 (Sean asked to keep it "for later"). Not persisted to a file this session — the 57 KB exceeded the console export channel cleanly, and nothing consumes it yet. Re-pull on demand with `scraper/jac_extract.js` (returns `activity` alongside `assess`). **TODO #30** added.

**Follow-ups added after first report (same session):**
- **MBA robustness:** `jac_extract.js` rewritten to match by SI-NET class number (`{code:[classNumber]}`) as well as year+period. MBA courses run multiple offerings per semester with different assessments and don't map cleanly to a single period — class-number matching (the middle number in our `COURSE-CLASSNUM-SEM` filenames) ties a Jac instance to the exact scraped class. Instance metadata (class number, year, period, mode) lives in `item.metadataValues` keyed by `metadataClassConfigId` (6=class number, 7=year, 8=period). See item #32.
- **Activity mapping persisted:** `taxonomy/sources/activity-lo-mapping-jac-7620.json` (43 courses, 753 activity rows). Transferred out of the browser via gzip+base64 (the plain JSON was too big for the console channel and duplicated). Item #30 closed.
- **Shareable how-to doc:** `Recovering the dropped LO mappings - how it was done.md` (in the repo root folder) — plain-language explainer for a colleague.

**Landmine for next session:** the override CSV/JSON now contains real data but is **not yet committed/pushed** — Sean needs to `git add taxonomy/ docs/taxonomy/ scraper/jac_extract.js && commit && push` to deploy via GitHub Pages. Until then the live viewer is unchanged.

---

### Session 10 — 2026-06-03 — LO-to-assessment override overlay

**Focus:** Build the manual override system (open item #26) for the 30 UQBS courses where UQ's Drupal-published ECP drops the learning-outcome-to-assessment mapping. Mid-session, Sean's colleague flagged a twist: the bug can also drop *only some* of an assessment's LOs (partial render), not just the whole mapping.

**Why the twist matters (design pivot):** The original plan (item #26) was a gap-fill overlay — "scraped data wins, override only fills empty mappings." That assumes an assessment either has its full LO list or nothing. A *partial* render means scraped data is present but wrong, so a gap-fill override would never fire and the partial would silently stand. A partial also looks identical to a legitimate "this assessment only assesses some LOs" — nothing automatic can tell them apart with certainty.

**Decision — REPLACE per assessment (not gap-fill):** An override row is the authoritative full LO list for one course+assessment. If a row exists it wins entirely; otherwise scraped data stands. One rule handles all three cases: missing entirely, partially dropped, correct (no row). Confirmed with Sean (he was unsure; I made the call). Easy to switch to union later if data entry feels heavy.
- **Safety net for replace:** the bug only ever *drops* LOs, never invents them, so a half-typed override could clobber LOs Drupal *did* render. `import_lo_overrides.py` warns loudly when an override omits an LO the scraper captured ("override drops scraped LOx — intended?").

**New files:**
- `taxonomy/lo-overrides.csv` — source of truth. Columns: `semester_code` (optional; blank = all semesters, value = that semester only, exact wins over blank), `course_code`, `assessment_title`, `learning_outcomes` (tolerant: "LO1, LO2" / "1,2" / "L01,L02"), `notes`. Scaffolded with 135 blank rows across 43 course offerings (all MISSING_ALL + MISSING_SOME in 7620, UQBS-only). Assessment titles pulled from scraped `assessment_summary` so they match exactly.
- `scraper/import_lo_overrides.py` — CSV→JSON overlay (mirrors `import_aol.py`). Validates: course in taxonomy, assessment_title matches a scraped assessment (lists candidates on mismatch), LO refs within course LO range, duplicate rows, and the drop-scraped-LO safety warning. Writes flat-array overlay to `taxonomy/lo-overrides.json` + `docs/taxonomy/lo-overrides.json`. Modes: `--validate-only`, `--scaffold [--uqbs-only] [--semester]`. Blank LO rows are skipped (not errors) so a half-filled CSV imports cleanly.
- `scraper/lo_coverage_report.py` — diagnostic that scans profiles and flags `MISSING_ALL` (whole mapping dropped), `MISSING_SOME` (partial — some assessments have refs, some don't), `UNREFERENCED` (a course LO assessed by nothing — suspected partial), `OK`. Writes `logs/lo-coverage-report.csv`. Flags are *candidates* — a dropped LO is indistinguishable from a deliberately-unassessed one, so humans confirm.

**Diagnostic earned its keep immediately:** semester 7620 UQBS-only — 35 MISSING_ALL (matches the original audit), but **8 MISSING_SOME + 1 UNREFERENCED that the original 30-course audit completely missed** because they render *some* LO mapping and therefore looked fine. New cases (none in the original list): BISM7221, BISM7808, MGTS3301, MGTS4603, MGTS7308, MGTS7809, MGTS7812, RBUS4411 (partial), ECON3430 (LO5/LO6 unreferenced). This is exactly the failure mode the colleague warned about.

**Viewer changes (`docs/assets/app.js`):**
- `loadLoOverrides()` + `STORE.loOverrides` + `DATA_PATHS.loOverrides` (graceful fallback to empty on 404).
- `normTitle()` (mirrors Python `_norm_title`) and `getLoOverrideMap(courseCode, semesterCode)` → `{ normTitle → {los, notes} }` with exact-semester-wins-over-blank precedence.
- Applied with replace precedence (override → summary-row LOs → scraped details map) in: course-detail assessment summary table, assessment-detail "Linked LOs" line, Markdown export, printable-HTML export. Overridden mappings render with a distinct amber `.lo-chip.override` chip, a ✎ mark, and a legend ("manually corrected — UQ's published course profile omitted it"). Exports carry an inline "(manually corrected …)" note.
- `loadLoOverrides()` added to `initBrowser` and `initCourseDetail` load chains.

**Other files:**
- `docs/assets/styles.css` — `.lo-chip.override`, `.lo-override-mark`, `.lo-override-legend` + dark-mode variants (amber accent reads on both palettes). Brace balance 217/217.
- `.github/workflows/scrape.yml` — added "Rebuild LO overrides overlay" step after the AoL step (`taxonomy/` and `docs/taxonomy/` already in `git add`, so the generated JSON commits automatically).

**Verification:**
- `node --check docs/assets/app.js` → OK; `py_compile` both scripts → OK; CSS 217/217; both JSON overlays valid; workflow YAML parses.
- Import validation tested against a fixture CSV — every edge case caught: duplicate, bad title (+ candidate list), out-of-range LO, drop-scraped-LO clobber warning, unknown course.
- Resolver logic tested by loading the real `app.js` in a Node VM sandbox: 7/7 pass — full-missing replace, partial replace (adds dropped LO), blank-semester applies when no exact, exact-semester wins over blank, no-override → null, case/space-insensitive title match, parseLoRefs zero-typo.
- End-to-end render test (real BISM2207 profile + an override): override chips, ✎ mark, and legend all present, and only on the overridden assessment (override chip count = 2, exactly the override's LOs).
- Deliverable left clean: `lo-overrides.json` restored to 0 overrides (no test data committed); CSV holds 135 blank scaffold rows for the team.

**Landmines / watch out for:**
- The CSV ships **blank** — the feature is dormant (viewer shows no change) until the team fills LO lists from curriculum docs and reruns `import_lo_overrides.py`. That's correct behaviour, not a bug.
- `assessment_title` in the CSV must match the scraped title. The scaffold pre-fills them correctly; if a coordinator renames an assessment in a future semester, the import will warn (title not found) — re-scaffold or fix by hand.
- Replace semantics: entering only the *missing* LOs for a partial will drop the correct ones. The import warns, but the team should enter the **full** authoritative list per assessment.
- `--scaffold` only seeds courses where an assessment has *no* scraped LOs (MISSING_ALL/SOME). `UNREFERENCED` courses (e.g. ECON3430) won't be scaffolded — handle those by hand from the coverage report.

---

### Session 9 — 2026-06-02 — All-of-UQ scraper expansion

**Focus:** Expand the scraper from UQBS-only (323 courses) to all of UQ (~1,900 courses per semester) while keeping the live UQBS viewer completely unaffected. Driven by ATLAS, a separate TIG-funded project that uses this scraper's JSON as its data spine and needs profiles for non-UQBS courses.

**Design principle — keep 'em separated:**
- The UQBS viewer (`manifest.json`) is never affected by all-of-UQ data
- Default scraper behaviour (no flags) remains UQBS-only
- All-of-UQ is opt-in via `--all-uq` flag
- Two manifests: `manifest.json` (UQBS-filtered) and `manifest-all.json` (everything)
- ATLAS reads `manifest-all.json`; the UQBS viewer reads `manifest.json`

**Changes to `scraper/scrape.py`:**
- Added `--all-uq` flag: bypasses UQBS taxonomy, uses full JacSON repo index as course list
- Added `--delay` / `-d` flag: adjustable request spacing (default 1.0s, minimum 0.2s) for faster historical backfills
- `load_all_uq_course_list()`: new function that pulls all course codes from JacSON index, optionally filtered to a specific semester
- `main()` accepts `all_uq` and `delay` parameters
- Pre-fetches JacSON index before course list loading (needed for both discovery and all-of-UQ enumeration)

**Changes to `scraper/build_manifest.py`:**
- Now produces two manifests from a single scan of `profiles/`
- `manifest.json`: filtered to courses in `taxonomy/uqbs-programs.json` (831 UQBS profiles)
- `manifest-all.json`: all profiles (838 currently, will grow to ~1,900+ per semester after backfill)
- Falls back gracefully if taxonomy file is missing

**Changes to `.github/workflows/scrape.yml`:**
- Added `all_uq` boolean input for manual workflow dispatch
- Scheduled cron stays UQBS-only (safe default)
- Commits now include `manifest-all.json`

**Verification:**
- Both Python files pass syntax check
- Manifest builder tested: 831 UQBS / 838 all-of-UQ (7 non-taxonomy courses correctly excluded from UQBS manifest)
- JacSON repo confirmed active (13,621 commits, updated 5 hours ago) with ~1,908 files in semester 7620

**Historical backfill instructions (run on Mac):**
```bash
cd /Users/uqsmitc6_local/Documents/GitHub/uqbs-course-profiles

# Test with a small batch first
python scraper/scrape.py --all-uq --semester 7620 --max 10

# Then do each semester (oldest to newest), ~30 min each at default delay
python scraper/scrape.py --all-uq --semester 7450
git add profiles/ && git commit -m "Backfill: semester 7450 (all-of-UQ)"
git push

# Repeat for 7460, 7480, 7490, 7520, 7560, 7580, 7590, 7620, 7660
# Use --delay 0.5 to halve the time for historical (static) semesters
```

**ATLAS connection:** ATLAS is a TIG-funded platform helping academics redesign assessments for the AI era. It consumes this scraper's JSON as its data spine. The first ATLAS component is a course visualiser with Bloom's/SOLO analysis, assessment security classification, and constructive alignment checks. ATLAS gates UQBS-specific features (GA, AoL) by `coordinating_unit` field — the scraper just provides faithful data for all courses.

**Scale confirmed from JacSON repo:**
- Semester 7620: ~1,908 profile files (GitHub truncated listing at 1,000 + 908 omitted)
- 11 semester folders: 7450, 7460, 7480, 7490, 7520, 7560, 7580, 7590, 7620, 7660
- Course prefixes span all faculties: ABTS, ACCT, ADPS, AERO, AGRC, MINE, etc.
- Non-UQBS profiles use identical HTML structure (same course-profiles.uq.edu.au template)

**Backfill executed:** Semester 7620 backfilled locally on Sean's Mac — 1,750 courses, 1,906 profiles scraped (1 failure), pushed to repo.

**All-of-UQ browser page (`docs/browse-all.html`):**
- Separate page reading `manifest-all.json`, with School/Faculty filter instead of Programme/AoL columns
- Same search, sort, semester filter, level/mode/location filters, CSV/ZIP exports
- Nav links updated across all pages: "Courses" renamed to "UQBS", new "All UQ" link added
- `initAllBrowser()`, `renderAllBrowser()`, `applyAllFilters()`, `exportAllFilteredAsCsv()` added to app.js

**LO-to-assessment mapping audit:**
- Investigated BISM2207 — Drupal bug confirmed. The LO-to-assessment mapping data exists in curriculum documents but Drupal doesn't render it in the published ECP HTML. No hidden data in the DOM.
- Audited all 202 UQBS profiles in semester 7620: 167 have LO mapping (83%), 35 are missing it
- 30 of the 35 missing are Business School courses (see list below)
- Proposed solution: manual override CSV in `taxonomy/lo-overrides.csv`, same overlay pattern as AoL. Scraper never touches it. Viewer merges at runtime — scraped data takes precedence, override fills gaps.
- Courses missing LO-assessment mapping: ACCT3101, ACCT7106, BISM2207, BISM2208, BISM3208, BISM7807, EVNT7052, FINM7407, FINM7805, HOSP2005, HOSP7052, IBUS2301, IBUS2302, IBUS3306, IBUS7302, IBUS7306, IBUS7312, MGTS3601, MGTS3609, MGTS7309, MGTS7619, MGTS7803, MGTS7810, MGTS7820, MKTG7503, MKTG7510, TIMS7317, TOUR7020, TOUR7023, TOUR7032

---

### Session 8 — 2026-04-15 — Assurance of Learning (AoL) integration

**Focus:** Build the first internal data overlay layer — Assurance of Learning tracking — from data model through to viewer integration and a dedicated dashboard page.

**Requirements gathered:**
- AoL tracking is currently scattered/informal across the team — no single structured tracker
- Lifecycle is simpler than textbook AACSB: Identified → Rubric in Dev → Active → Established (+ Disrupted)
- Granularity: semester + course + GA + assessment item + rubric (SharePoint links)
- Start from Sem 1 2026 onwards — no historical backfill needed
- 2 GAs per course (per existing GA rubric integration skill rules)

**Architecture decisions:**
- **Overlay architecture** — AoL data lives in `taxonomy/aol-status.json`, separate from the programme taxonomy. Loaded by the viewer at runtime and merged client-side. This pattern will be reused for GA mapping, typologies, etc.
- **CSV as source of truth** — Team maintains `taxonomy/aol-template.csv` (7 columns: semester_code, course_code, ga, assessment_title, status, rubric_url, notes). Import script converts to JSON with validation.
- **5 lifecycle statuses** — `identified` (team flagged a match), `rubric_in_dev` (rubric being built), `active` (rubric built and in use), `established` (loop closed — data collected and reviewed), `disrupted` (assessment/mapping changed, needs remapping).

**New files created:**
- `taxonomy/aol-template.csv` — Template CSV with 11 sample entries across 7 courses for Sem 1 2026
- `taxonomy/aol-status.json` — Generated JSON overlay (also written to `docs/taxonomy/`)
- `scraper/import_aol.py` — Import script: reads CSV, validates against taxonomy (flags unknown courses, bad statuses, duplicates), writes JSON overlay to both `taxonomy/` and `docs/taxonomy/`. Supports `--validate-only` mode.
- `docs/aol.html` — Dedicated AoL dashboard page

**Files changed:**
- `docs/assets/app.js` — Major additions:
  - `loadAol()` data loader with graceful fallback
  - `getAolForCourse()` helper, `AOL_STATUS` config, `aolStatusChip()` and `aolGaChip()` display helpers
  - `initBrowser()` — loads AoL data; `render()` — adds AoL column to course browser table
  - `initCourseDetail()` / `renderCourseDetail()` — loads AoL; shows AoL status card (semester, GA, assessment, status, rubric link, notes)
  - `initProgram()` / `renderProgramDetail()` — loads AoL; adds AoL column to programme course tables
  - `initAol()` / `renderAolDashboard()` — new dashboard with summary stats, status cards, GA coverage heatmap per semester, full entry tables with course links
  - Updated `window.UQBS` exports
- `docs/assets/styles.css` — AoL chip styles (5 status colours), GA chips, dashboard stat cards, heatmap cells, dark mode overrides for all AoL colours
- `docs/index.html` — Added AoL nav link, AoL table header column, updated colspan
- `docs/course.html` — Added AoL nav link
- `docs/program.html` — Added AoL nav link
- `.github/workflows/scrape.yml` — Added "Rebuild AoL overlay" step after manifest; updated git add to include taxonomy/ and docs/taxonomy/

**Verification:**
- `node --check docs/assets/app.js` → OK
- CSS brace balance: 202/202 — OK
- JSON validation: aol-status.json, docs/taxonomy/aol-status.json, uqbs-programs.json — all valid
- AoL import validation: 11 entries, 0 errors, 0 warnings (all courses found in taxonomy)
- All 4 HTML files structurally valid

**Sample AoL data (11 entries for demonstration):**
- 7 courses: MGTS1601, MGTS2604, MGTS3601, ACCT1101, MKTG1501, ECON1011, FINM1416
- Status distribution: 3 identified, 3 rubric_in_dev, 3 active, 1 established, 1 disrupted
- GAs covered: GA1, GA2, GA3, GA4, GA5, GA6

**Workflow for the team going forward:**
1. Edit `taxonomy/aol-template.csv` (add/update rows)
2. Run `python scraper/import_aol.py` (or let GitHub Actions do it on next scrape)
3. Commit and push — GitHub Pages redeploys automatically
4. AoL dashboard and per-course/programme views update with new data

---

### Session 7 — 2026-04-15 — Taxonomy overhaul: 14→23 programmes

**Focus:** Full audit and rebuild of `taxonomy/uqbs-programs.json` based on structured data from 18 my.UQ programme pages. A deep research audit (using only UQ sources) revealed material errors across 10 of 14 existing programmes.

**Audit findings (errors in the original taxonomy):**
- **MBus:** 11→9 fields — "Leadership" renamed to "Law for Business", "Strategy and Entrepreneurship" renamed to "Entrepreneurship and Innovation", "International Management" dropped, "Sustainable Business" added
- **MEI:** 6→7 fields — all names changed (e.g. "Community Engagement" → "Civil Society and International Development", "Food Entrepreneurship" → "Food and Agribusiness Innovation")
- **MBusAn:** fake "Applied Analytics" and "Strategic Analytics" majors removed (no majors exist); core expanded 2→12
- **MBA:** fake "Strategy" and "Leadership" majors removed (no majors exist); restructured to flexible core A/B + program electives
- **Grad Dip:** fake "Applied Business" major removed; restructured to flexible core + program electives + research courses
- **BAB:** core fixed 16→14 (removed 2 erroneous codes), confirmed 8 majors
- **BAFE:** core fixed 19→18 (removed 1 erroneous code), added flexible core (18) and general pathway courses (2)
- **MFIM:** renamed from "Master of Financial and Investment Management" to "Master of Finance and Investment Management"
- **MTHEM:** renamed from "Master of Tourism, Hospitality and Event Management" to "Master of Tourism, Hotel and Event Management"; added pathway prerequisites
- **BAFE/BAB:** added "(Honours)" suffix to display names

**New programmes added (9):**
- BBusManHons — Bachelor of Business Management (Honours) (2129)
- BComHons — Bachelor of Commerce (Honours) (2131)
- GCBus — Graduate Certificate in Business (5248)
- GCBusAdmin — Graduate Certificate in Business Administration (5769)
- GCBusAn — Graduate Certificate in Business Analytics (5726)
- GCCom — Graduate Certificate in Commerce (5326)
- GCEI — Graduate Certificate in Entrepreneurship and Innovation (5689)
- GCFIM — Graduate Certificate in Finance and Investment Management (5764)
- GCTHEM — Graduate Certificate in Tourism, Hotel and Event Management (5547)

**New taxonomy fields introduced:**
- `program_code` — UQ numeric programme code (e.g. 5248)
- `is_programme` — `false` for the Elective cross-programme tag
- `foundational_courses` — prerequisite/bridging courses (GCBus, MBus)
- `capstone` — capstone course list (MBus, MEI)
- `pathway_to` — key of the master's programme this Grad Cert feeds into
- `pathway_prerequisites` — courses required before entering the pathway (MTHEM)
- `flexible_core`, `flexible_core_a`, `flexible_core_b` — flexible/elective core variants
- `program_electives` — programme-level elective pools
- `research_courses`, `advanced_courses`, `general_pathway_courses` — specialised course categories

**Taxonomy stats after rebuild:** 23 programmes (7 UG + 15 PG + 1 Elective tag), 323 unique courses, 521 course→programme mappings. Reverse mapping (`course_programs`) validated — 0 integrity errors.

**Viewer updates:**
- `renderProgramDetail()` now renders all new course-list fields (foundational, flexible core, capstone, pathway prerequisites, etc.) with descriptive section headings
- `renderProgramIndex()` filters out `is_programme: false` entries, shows `program_code` where available
- Programme filter dropdown on course browser excludes non-programme entries
- PG programmes show "Fields / Specialisations" heading instead of "Majors"
- Empty major course lists show a "see my.UQ for details" note instead of an empty table

**Known limitations:**
- 5 major/field course lists are empty: BAFE Economics, BAFE Finance (my.UQ references plan codes only, not individual courses), MEI Agri-Food Chains, MEI Business Management, MEI Data and AI
- 11 legacy programmes still lack `program_code` values
- MBus "Law for Business" field inherited old "Leadership" course list — may not be fully accurate
- GCEI "Food Entrepreneurship" field name differs from MEI's "Food and Agribusiness Innovation" — possible naming inconsistency in UQ systems

**Files changed:**
- `taxonomy/uqbs-programs.json` — Full rebuild (3898→4626 lines)
- `docs/assets/app.js` — Programme detail renderer extended for new fields; programme index and filter updated for `is_programme`

**Verification:**
- Forward/reverse mapping integrity: 323/323 courses, 0 errors
- `node --check docs/assets/app.js` → syntax valid
- All 23 programme core/major counts match my.UQ structured data

---

### Session 6 — 2026-04-14 — Viewer polish: bug fixes, themes, downloads, dark mode

**Focus:** Tidy up three bugs visible on the live viewer (LO code duplication, missing assessment→LO mapping, policy-text word-run-on), then add visual polish (Classic/Fun theme toggle, Auto/Light/Dark colour-mode toggle) and richer downloads.

**Bug fixes (live-site issues):**
1. **Learning-outcome codes rendered as `L0L01`** — data shape varied (`lo.number` could be `"LO1."`, `"L01"`, `1`, or `"1"`). Added `loDisplayCode(lo)` helper that trims a trailing period, upper-cases, and prepends `LO` only if not already present. Applied in the viewer, markdown export, and printable HTML.
2. **Assessment-summary "LOs" column empty** — data captured in `assessment_details.learning_outcomes_assessed` was never merged into the summary table. Added `parseLoRefs()` that tolerates `"LO1, LO2"`, `"L01, L02"` (common zero-typo in source), `"L.O. 1, L.O. 2"`, and bare-number `"1, 2, 3"` variants; and `buildAssessmentLoMap()` keyed by assessment title. Summary renderer now merges and hides the LOs column entirely when no assessment has any LOs.
3. **Policy-and-procedure text a "hot mess"** — `soup.get_text(strip=True)` in the original scraper concatenated sibling text nodes without separators, producing artefacts like `"Policyand Procedure"`, `"UQand the"`, `"Learn.UQormy SI-netto"`. Fixed both for historical data and future scrapes:
   - `scraper/clean_existing.py` gained a closed-vocabulary rule set (`_VOCAB_WORDS` = Policy, Procedure, Guide, Service, Report, Manual, Library, Integrity, Assessment, Examination, etc. + plurals; `_STOPWORDS` = and, or, the) plus targeted joins for `UQ`, `my.UQ`, `Learn.UQ`, and `SI-net`. URLs and emails are shielded with `\x00N\x00` placeholders to prevent damage. Applied in a 2-pass loop so `"Procedureand thePolicy"` fully expands in one clean run.
   - `scraper/scrape.py` mirrors the same rules via `_apply_stopword_joins()` inside `normalise_ws()`, so new scrapes won't reintroduce the artefacts.

**Viewer polish (new features):**
- **Classic/Fun theme toggle** — `data-theme="classic"` (default, understated UQ branding) and `data-theme="fun"` (magazine/editorial: gradient header with halftone dots, serif display font at 16px base, larger radii, zebra rows, faculty-prefix colour-coded course codes, pull-quote-styled assessment details, pill-shaped buttons). Toggle button in header nav; selection persisted in `localStorage["uqbs-theme"]`. Inline `<script>` in `<head>` applies the attribute before first paint to prevent FOUC.
- **Manual Auto/Light/Dark colour-mode toggle** — second header button, independent of theme. `data-color-mode="light"` / `"dark"` force a palette; "auto" (the default, attribute absent) falls back to `@media (prefers-color-scheme: dark)`. CSS duplicates the dark variable block across the media query (narrowed with `:not([data-color-mode="light"]):not([data-color-mode="dark"])`) and explicit manual selectors, so manual choice wins cleanly. Persisted in `localStorage["uqbs-color-mode"]`. Separate FOUC script in each HTML file.
- **Faculty-prefix colour coding** (Fun theme only) — 10 accent colours mapped by course-code prefix (`ACCT`, `FINM`, `MGTS`, `MKTG`, `TIMS`, `LAWS`, `BUSN`, `ECON`, `LEIS`, `TOUR`). Applied via `td.code.prefix-XXXX a` rules; helper `coursePrefix(code)` added to app.js.

**Downloads (richer exports):**
- Per-course download bar on `course.html`: JSON, Markdown, printable HTML (opens in new window, A4 print stylesheet hides header/nav/toggles).
- Bulk actions on `index.html`: CSV of filtered courses, ZIP of filtered Markdown, ZIP of filtered raw JSON. Uses JSZip 3.10.1 loaded via CDN; filename based on active filters.

**Files changed:**
- `docs/assets/app.js` — LO helpers (`loDisplayCode`, `parseLoRefs`, `buildAssessmentLoMap`), column-hide logic, theme + colour-mode modules, per-course and bulk download logic, `coursePrefix()` helper.
- `docs/assets/styles.css` — Full theming refactor to CSS variables, Classic vs Fun variants, manual + auto dark-mode blocks, mode-toggle button styles, print stylesheet updated to hide both toggles.
- `docs/index.html`, `docs/course.html`, `docs/program.html` — FOUC script extended to cover colour mode; second header button added; JSZip loaded on index only.
- `scraper/clean_existing.py` — `_VOCAB_WORDS`, `_STOPWORDS`, `_SPECIFIC_JOINS` (8 rules), 2-pass application inside `_insert_boundaries()`.
- `scraper/scrape.py` — Mirrored stopword rules via `_apply_stopword_joins()`; integrated into `normalise_ws()`.

**Verification:**
- `node --check docs/assets/app.js` → OK
- CSS brace balance: 161/161
- localStorage round-trip (Node simulation): `applyColorMode('dark' → 'light' → 'auto' → 'bogus')` behaves correctly (attribute removed for `auto`, `bogus` normalised to `auto`)
- All 838 historical profiles re-processed through `clean_existing.py` — 0 remaining stopword artefacts

**User-reported outcome after deploy:**
- LO codes display correctly (`LO1`, not `L0L01`)
- Assessment summary shows LOs as chips per assessment
- Policies and procedures text reads cleanly
- Classic/Fun toggle confirmed working
- Dark-mode button added (this session) alongside theme toggle

---

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
│   ├── scrape.py                 ← Main scraper (all extraction logic + normalise_ws stopword joins)
│   ├── build_manifest.py         ← Generates docs/assets/manifest.json (lean index)
│   ├── clean_existing.py         ← One-time cleanup pass over profiles/ (boundary + stopword rules)
│   ├── import_aol.py             ← AoL CSV→JSON overlay importer
│   ├── import_lo_overrides.py    ← LO-override CSV→JSON overlay importer (--scaffold, --validate-only)
│   ├── lo_coverage_report.py     ← Diagnostic: flags missing/partial LO mappings → logs/lo-coverage-report.csv
│   └── requirements.txt          ← Python dependencies
├── docs/                         ← GitHub Pages static viewer
│   ├── index.html                ← Course browser (search, filter, sort, bulk downloads)
│   ├── course.html               ← Per-course detail (JSON / MD / printable HTML downloads)
│   ├── program.html              ← Program index + per-program core/majors
│   ├── assets/
│   │   ├── app.js                ← Fetch + render + theme + colour-mode + downloads
│   │   ├── styles.css            ← Classic/Fun themes, auto + manual dark mode, print stylesheet
│   │   └── manifest.json         ← Generated — lean index of all profiles
│   └── serve_local.sh            ← Local dev: regenerate manifest + symlinks + :8000
├── profiles/                     ← Scraped JSON output (per semester)
│   └── {semester_code}/
│       └── {COURSE-CLASS-SEM}.json
├── taxonomy/
│   ├── uqbs-programs.json        ← UQBS program/course taxonomy
│   ├── aol-template.csv          ← AoL source CSV (team-maintained)
│   ├── aol-status.json           ← Generated AoL overlay
│   ├── lo-overrides.csv          ← LO-override source CSV (team-maintained; 135 blank scaffold rows)
│   └── lo-overrides.json         ← Generated LO-override overlay (also in docs/taxonomy/)
├── logs/                         ← Scrape run logs
├── run_scrape.sh                 ← Local runner script
├── com.uqbs.course-scraper.plist ← macOS launchd config
├── README.md                     ← Setup and usage docs
├── PROJECT_LOG.md                ← This file
└── .gitignore
```

---

## Changelog

- **2026-06-03** — DATA — Recovered all 43 courses' authoritative assessment→LO mappings from Jac (curriculum.uq.edu.au) via its REST API (`get-resources` → `curriculums/v2/{cvid}/components` → matrix parse). Filled `lo-overrides.csv` (135/135 rows, 0 warnings); all renders verified. Reusable recipe in `scraper/jac_extract.js`. MGTS7812 dual-offering handled; ECON3430 verified correct (no override). Not yet committed/pushed.
- **2026-06-03** — FEATURE — LO-to-assessment override overlay (item #26). Replace-per-assessment semantics handles both full and *partial* Drupal LO-mapping drops. New: `taxonomy/lo-overrides.csv` (135 blank scaffold rows / 43 offerings), `scraper/import_lo_overrides.py`, `scraper/lo_coverage_report.py`, viewer merge + amber override chips/legend, workflow rebuild step. Resolver 7/7 sandbox tests + end-to-end render pass.
- **2026-06-03** — FINDING — Coverage diagnostic surfaced 9 partial-drop courses the Session 9 audit missed (8 MISSING_SOME + ECON3430 UNREFERENCED) — they render *some* LOs so looked fine. Logged as open item #29 for team review.
- **2026-04-14** — FEATURE — Added manual Auto/Light/Dark colour-mode toggle in header nav (alongside existing Classic/Fun theme toggle); persisted in `localStorage["uqbs-color-mode"]`; CSS now responds to `[data-color-mode]` attribute in addition to `prefers-color-scheme`
- **2026-04-14** — FEATURE — Classic/Fun theme toggle with `data-theme` attribute; magazine/editorial styling for Fun (gradient header, serif display, faculty-prefix colour-coded codes, pull-quote assessment details); FOUC-prevention inline script on all three pages
- **2026-04-14** — FEATURE — Bulk downloads on course browser (CSV / ZIP Markdown / ZIP JSON, filtered) via JSZip; per-course downloads on course detail (JSON / Markdown / printable HTML with A4 print stylesheet)
- **2026-04-14** — RESOLUTION — Policy-text stopword joins fixed in historical data (`scraper/clean_existing.py`) and future scrapes (`scraper/scrape.py` → `normalise_ws`); closed-vocabulary rules prevent false positives; URLs/emails shielded during regex pass; 0 remaining artefacts across 838 profiles
- **2026-04-14** — RESOLUTION — Assessment summary LOs column now populated from `assessment_details.learning_outcomes_assessed`; `parseLoRefs()` tolerates `LO1`, `L01` (zero-typo), `L.O. 1`, and bare-number variants; column hidden when no assessment has any linked LOs
- **2026-04-14** — RESOLUTION — LO code rendering fixed (`loDisplayCode()` helper) — handles `lo.number` as `"LO1."`, `"L01"`, `1`, or `"1"` without doubling the `LO` prefix
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
