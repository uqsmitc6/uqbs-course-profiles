/* UQBS Course Profile Viewer — app.js
 *
 * Shared helpers + page-specific controllers. Vanilla JS, no build.
 * Data sources are relative to the site root:
 *   ./assets/manifest.json       -- lean index of all profiles
 *   ./profiles/{semester}/*.json -- full profile JSONs (loaded on demand)
 *   ./taxonomy/uqbs-programs.json -- program/major mappings
 */

// ---- shared ---------------------------------------------------------------
const STORE = {
  manifest: null,
  taxonomy: null,
  aol: null,
  loOverrides: null,
};

const DATA_PATHS = {
  manifest: "./assets/manifest.json",
  manifestAll: "./assets/manifest-all.json",
  taxonomy: "./taxonomy/uqbs-programs.json",
  aol: "./taxonomy/aol-status.json",
  loOverrides: "./taxonomy/lo-overrides.json",
};

async function loadManifest() {
  if (STORE.manifest) return STORE.manifest;
  const res = await fetch(DATA_PATHS.manifest, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load manifest: ${res.status}`);
  STORE.manifest = await res.json();
  return STORE.manifest;
}

async function loadManifestAll() {
  if (STORE.manifestAll) return STORE.manifestAll;
  const res = await fetch(DATA_PATHS.manifestAll, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load full manifest: ${res.status}`);
  STORE.manifestAll = await res.json();
  return STORE.manifestAll;
}

async function loadTaxonomy() {
  if (STORE.taxonomy) return STORE.taxonomy;
  const res = await fetch(DATA_PATHS.taxonomy, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load taxonomy: ${res.status}`);
  STORE.taxonomy = await res.json();
  return STORE.taxonomy;
}

async function loadAol() {
  if (STORE.aol) return STORE.aol;
  const res = await fetch(DATA_PATHS.aol, { cache: "no-cache" });
  if (!res.ok) { STORE.aol = { semesters: {} }; return STORE.aol; }
  STORE.aol = await res.json();
  return STORE.aol;
}

// Manual LO-to-assessment override overlay (patches the Drupal ECP bug that
// drops LO mappings, fully or partially). Graceful fallback when absent.
async function loadLoOverrides() {
  if (STORE.loOverrides) return STORE.loOverrides;
  const res = await fetch(DATA_PATHS.loOverrides, { cache: "no-cache" });
  if (!res.ok) { STORE.loOverrides = { overrides: [] }; return STORE.loOverrides; }
  STORE.loOverrides = await res.json();
  return STORE.loOverrides;
}

// Get AoL entries for a specific course code (across all semesters, or for a specific semester)
function getAolForCourse(aol, courseCode, semesterCode) {
  if (!aol || !aol.semesters) return [];
  const entries = [];
  for (const [sem, data] of Object.entries(aol.semesters)) {
    if (semesterCode && sem !== semesterCode) continue;
    for (const e of (data.entries || [])) {
      if (e.course_code === courseCode) entries.push({ ...e, semester_code: sem, semester_label: data.label });
    }
  }
  return entries;
}

// Status display config
const AOL_STATUS = {
  tbd:           { label: "TBD",            icon: "📋", cls: "aol-tbd" },
  identified:    { label: "Identified",     icon: "🔍", cls: "aol-identified" },
  rubric_in_dev: { label: "Rubric in Dev",  icon: "🔨", cls: "aol-rubric-dev" },
  active:        { label: "Active",         icon: "✅", cls: "aol-active" },
  established:   { label: "Established",    icon: "🏆", cls: "aol-established" },
};

function aolStatusChip(status) {
  const s = AOL_STATUS[status] || { label: status, icon: "?", cls: "aol-unknown" };
  return `<span class="aol-chip ${s.cls}" title="${escapeHtml(s.label)}">${s.icon} ${escapeHtml(s.label)}</span>`;
}

function aolGaChip(ga) {
  return `<span class="aol-ga-chip" title="${escapeHtml(ga)}">${escapeHtml(ga)}</span>`;
}

async function loadCourseJson(relPath) {
  const res = await fetch(`./${relPath}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${relPath}: ${res.status}`);
  return res.json();
}

function getAllCourses(manifest) {
  // Flatten all semesters into one list of {..., semester_code}
  const out = [];
  for (const [sem, entries] of Object.entries(manifest.semesters || {})) {
    for (const e of entries) {
      out.push({ ...e, semester_code: e.semester_code || sem });
    }
  }
  return out;
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Parse study_period into a short label, e.g. "Semester 1, 2026 (23/02/...)" → "S1 2026".
// Falls back to semester_code if study_period is missing.
function semesterLabel(course) {
  const sp = course.study_period || "";
  const m = sp.match(/Semester\s+(\d),?\s+(\d{4})/i);
  if (m) return `S${m[1]} ${m[2]}`;
  const sm = sp.match(/Summer\s+Semester,?\s+(\d{4})/i);
  if (sm) return `Sum ${sm[1]}`;
  // Fallback: derive from semester_code
  const code = course.semester_code || "";
  // Known UQ codes — derive label
  const codeMap = {
    "7460": "S2 2024", "7480": "Sum 2025", "7520": "S1 2025",
    "7560": "S2 2025", "7580": "Sum 2026", "7620": "S1 2026",
    "7660": "S2 2026", "7700": "S1 2027", "7740": "S2 2027",
  };
  return codeMap[code] || code;
}

// Extract the 4-letter faculty prefix from a course code (e.g. "MGTS1601" → "MGTS").
// Used for Fun-theme faculty-colour coding on table rows.
function coursePrefix(code) {
  if (!code) return "";
  const m = String(code).match(/^([A-Z]{3,4})/);
  return m ? m[1] : "";
}

// Normalise a learning-outcome code for display. Source data sometimes has
// `lo.number = "LO1."` (already prefixed with "LO" and trailing period) and
// sometimes `lo.number = 1` (bare). Produce a canonical "LO1" form.
function loDisplayCode(lo) {
  if (!lo) return "";
  if (lo.code) return String(lo.code).trim().replace(/\.$/, "");
  const n = lo.number;
  if (n == null) return "";
  const s = String(n).trim().replace(/\.$/, "");
  // If already starts with "LO" (case-insensitive), normalise to uppercase
  if (/^lo\d+$/i.test(s)) return s.toUpperCase();
  // Otherwise prepend "LO"
  return `LO${s}`;
}

// Parse a "learning_outcomes_assessed" string into ["LO1","LO2",…].
// Handles variations: "L.O. 1", "LO1", "LO 1", "L01" (zero-typo), "1".
function parseLoRefs(s) {
  if (!s) return [];
  const text = String(s);
  const nums = new Set();
  // Pattern A: L + (O or 0) + optional dot + optional space + digits
  //   matches "LO1", "LO.1", "L.O.1", "L O 1", "L01", "L0.1"
  const reA = /L\.?[O0]\.?\s*(\d+)/gi;
  // Pattern B: bare numbers preceded by a comma/space/start (for strings
  //   like "1, 2, 3") — only used if Pattern A matched nothing
  const reB = /(?:^|[,;\s])(\d+)(?=[,;\s]|$)/g;
  let m;
  while ((m = reA.exec(text)) !== null) nums.add(m[1]);
  if (nums.size === 0) {
    while ((m = reB.exec(text)) !== null) nums.add(m[1]);
  }
  // Preserve first-seen order
  return Array.from(nums).map(n => `LO${n}`);
}

// Build a lookup { assessmentTitle → [LO1, LO2, …] } from assessment_details.
function buildAssessmentLoMap(c) {
  const map = {};
  if (!c || !Array.isArray(c.assessment_details)) return map;
  for (const d of c.assessment_details) {
    const title = (d && d.title ? String(d.title).trim() : "");
    if (!title) continue;
    const refs = parseLoRefs(d.learning_outcomes_assessed || d.learning_outcomes);
    if (refs.length) map[title] = refs;
  }
  return map;
}

// Normalise an assessment title for matching (case/space-insensitive).
// Mirrors _norm_title() in scraper/import_lo_overrides.py.
function normTitle(t) {
  return String(t || "").trim().replace(/\s+/g, " ").toLowerCase();
}

// Resolve the manual LO overrides for a course offering into a lookup keyed by
// normalised assessment title: { normTitle → { los:[…], notes } }.
// Precedence (most specific wins): an override scoped to this exact SI-NET
// class (class_number) beats an exact-semester override, which beats a
// blank-semester (all-semesters) override for the same assessment.
// Class-scoped overrides exist because parallel deliveries (MBA intensive vs
// standard, in-person vs external) can share an assessment title but map
// different LOs. A class-scoped entry never applies to a different class.
function getLoOverrideMap(courseCode, semesterCode, classCode) {
  const ov = STORE.loOverrides;
  if (!ov || !Array.isArray(ov.overrides) || !courseCode) return {};
  const blank = {}, exact = {}, exactClass = {};
  for (const o of ov.overrides) {
    if (o.course_code !== courseCode) continue;
    const los = Array.isArray(o.learning_outcomes) ? o.learning_outcomes : [];
    if (!los.length) continue;
    const rec = { los, notes: o.notes || null };
    const nt = normTitle(o.assessment_title);
    const semMatches = o.semester_code && semesterCode && o.semester_code === semesterCode;
    if (o.class_number) {
      // Scoped to one class: applies only when both class and semester match.
      if (semMatches && classCode && String(o.class_number) === String(classCode)) {
        exactClass[nt] = rec;
      }
    } else if (semMatches) {
      exact[nt] = rec;
    } else if (!o.semester_code) {
      blank[nt] = rec;
    }
  }
  // most specific last so it wins the merge
  return Object.assign({}, blank, exact, exactClass);
}

// Produce the COMPLETE record for a course: the scraped profile with any
// missing/incomplete LO mappings restored from Jac (the authored curriculum
// record). Used by the JSON downloads so every user-facing surface serves
// complete data. Restored fields carry a provenance marker; the stored
// profiles/ JSONs remain raw ingestion (what UQ's published page contains).
function completeCourseJson(c) {
  const ovMap = getLoOverrideMap(c.course_code, c.semester_code, c.class_code);
  if (!Object.keys(ovMap).length) return c;
  const copy = JSON.parse(JSON.stringify(c));
  const restored = [];
  for (const d of (copy.assessment_details || [])) {
    const ov = ovMap[normTitle(d.title)];
    if (!ov) continue;
    d.learning_outcomes_assessed = ov.los.join(", ");
    d.learning_outcomes_assessed_source = "jac";
    restored.push((d.title || "").trim());
  }
  if (restored.length) {
    copy._lo_mapping_provenance = {
      note: "LO-to-assessment mappings for the assessments listed were restored from Jac (curriculum.uq.edu.au), the authored curriculum record. UQ's published course profile omits them due to a publishing fault.",
      restored_from_jac: restored,
    };
  }
  return copy;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-AU", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function getQueryParam(name) {
  const p = new URLSearchParams(window.location.search);
  return p.get(name);
}

// Given a course code (e.g. ACCT1101) and taxonomy, return all program roles
function programRolesFor(code, taxonomy) {
  if (!taxonomy || !taxonomy.course_programs) return [];
  return taxonomy.course_programs[code] || [];
}

// ---- export helpers -------------------------------------------------------

// Convert incidental HTML (from scraper-stripped fields) to plain text.
function htmlToText(html) {
  if (!html) return "";
  let t = String(html);
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/p>/gi, "\n\n");
  t = t.replace(/<\/li>/gi, "\n");
  t = t.replace(/<\/div>/gi, "\n");
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  t = t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

function htmlToMarkdown(html) {
  if (!html) return "";
  let md = String(html);
  md = md.replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b>([\s\S]*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i>([\s\S]*?)<\/i>/gi, "*$1*");
  md = md.replace(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<li>([\s\S]*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/p>/gi, "\n\n");
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<[^>]+>/g, "");
  md = md.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  return md.replace(/\n{3,}/g, "\n\n").trim();
}

function stripLoSuffix(topic) {
  return String(topic || "").replace(/\s*Learning outcomes?:.*$/i, "").trim();
}

function safeFilename(c, ext) {
  const parts = [c.course_code, c.class_code, c.semester_code].filter(Boolean);
  return `${parts.join("-") || "course"}.${ext}`;
}

// Trigger browser download of a text/bytes blob.
function downloadBlob(content, filename, mimeType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Generate a Markdown document from a full course JSON.
function buildCourseMarkdown(c, taxonomy) {
  const lines = [];
  const ovMap = getLoOverrideMap(c.course_code, c.semester_code, c.class_code);
  lines.push(`# ${c.course_code} — ${c.course_title || ""}`);
  lines.push("");
  const metaRows = [
    ["Full code", c.full_course_code],
    ["Study period", c.study_period],
    ["Study level", c.study_level],
    ["Units", c.units],
    ["Attendance mode", c.attendance_mode],
    ["Location", c.location],
    ["Coordinating unit", c.coordinating_unit],
    ["Administrative campus", c.administrative_campus],
    ["Course profile URL", c.url],
    ["Scraped", c.scraped_at],
  ].filter(([, v]) => v);
  for (const [k, v] of metaRows) lines.push(`- **${k}:** ${v}`);

  const roles = taxonomy ? programRolesFor(c.course_code, taxonomy) : [];
  if (roles.length) {
    lines.push("", "## Program mapping", "");
    for (const r of roles) {
      lines.push(`- **${r.program}** (${r.program_name || ""}): ${r.role || ""}`);
    }
  }

  if (c.course_description) {
    lines.push("", "## Course description", "", htmlToMarkdown(c.course_description));
  }
  if (c.course_aims) {
    lines.push("", "## Course aims", "", htmlToMarkdown(c.course_aims));
  }

  if (c.requirements && typeof c.requirements === "object") {
    const hasAny = Object.values(c.requirements).some(v => v && (Array.isArray(v) ? v.length : String(v).trim()));
    if (hasAny) {
      lines.push("", "## Requirements");
      for (const [key, label] of [
        ["prerequisites", "Prerequisites"],
        ["incompatible", "Incompatible courses"],
        ["companions", "Companions"],
        ["recommended_prerequisites", "Recommended prerequisites"],
        ["restrictions", "Restrictions"],
      ]) {
        const v = c.requirements[key];
        if (!v) continue;
        const items = Array.isArray(v) ? v : [v];
        if (!items.length) continue;
        lines.push("", `**${label}**`, "");
        for (const item of items) lines.push(`- ${String(item)}`);
      }
    }
  }

  if (Array.isArray(c.learning_outcomes) && c.learning_outcomes.length) {
    lines.push("", "## Course learning outcomes", "");
    for (const lo of c.learning_outcomes) {
      const code = loDisplayCode(lo);
      lines.push(`- **${code}** ${lo.description || ""}`);
    }
  }

  if (Array.isArray(c.assessment_summary) && c.assessment_summary.length) {
    lines.push("", "## Assessment summary", "");
    lines.push("| # | Task | Category | Weight | Due |");
    lines.push("|---|------|----------|--------|-----|");
    c.assessment_summary.forEach((a, i) => {
      const title = (a.title || "").replace(/\|/g, "/");
      const cat = (a.category || a.type || "").replace(/\|/g, "/");
      const w = (a.weighting || a.weight || "").replace(/\|/g, "/");
      const due = (a.due_date || a.due || "").replace(/\|/g, "/");
      lines.push(`| ${i + 1} | ${title} | ${cat} | ${w} | ${due} |`);
    });
  }

  if (Array.isArray(c.assessment_details) && c.assessment_details.length) {
    lines.push("", "## Assessment details", "");
    c.assessment_details.forEach((a, i) => {
      lines.push(`### ${i + 1}. ${a.title || a.name || "Assessment"}`);
      lines.push("");
      const meta = [];
      if (a.weighting || a.weight) meta.push(`**Weight:** ${a.weighting || a.weight}`);
      if (a.due_date || a.due) meta.push(`**Due:** ${a.due_date || a.due}`);
      if (a.category || a.type) meta.push(`**Category:** ${a.category || a.type}`);
      if (a.mode) meta.push(`**Mode:** ${a.mode}`);
      if (a.other_conditions) meta.push(`**Conditions:** ${a.other_conditions}`);
      if (meta.length) { lines.push(meta.join(" · ")); lines.push(""); }
      const ov = ovMap[normTitle(a.title)];
      const lo = ov ? ov.los : (a.learning_outcomes_assessed != null ? a.learning_outcomes_assessed : a.learning_outcomes);
      if (lo) {
        const loStr = Array.isArray(lo) ? lo.join(", ") : String(lo);
        if (loStr) { lines.push(`**Linked LOs:** ${loStr}${ov ? " _(from Jac, the authored curriculum record — omitted from the published profile)_" : ""}`); lines.push(""); }
      }
      if (Array.isArray(a.special_indicators) && a.special_indicators.length) {
        lines.push(`**Indicators:** ${a.special_indicators.join(", ")}`); lines.push("");
      }
      for (const [key, label] of [
        ["task_description", "Task description"],
        ["task", "Task"],
        ["exam_details", "Exam details"],
        ["submission_guidelines", "Submission guidelines"],
        ["deferral_or_extension", "Deferral or extension"],
        ["late_submission", "Late submission"],
        ["marking_criteria", "Marking criteria"],
        ["ai_statement", "AI / academic integrity"],
      ]) {
        const v = a[key];
        if (!v) continue;
        lines.push(`#### ${label}`, "");
        if (Array.isArray(v)) v.forEach(x => lines.push(`- ${String(x)}`));
        else lines.push(htmlToMarkdown(String(v)));
        lines.push("");
      }
      lines.push("---", "");
    });
  }

  if (Array.isArray(c.learning_activities) && c.learning_activities.length) {
    lines.push("", "## Weekly learning activities", "");
    lines.push("| Period | Type | Topic | LOs |");
    lines.push("|--------|------|-------|-----|");
    for (const la of c.learning_activities) {
      const period = (la.learning_period || "").replace(/\|/g, "/").replace(/\n/g, " ");
      const type = (la.activity_type || "").replace(/\|/g, "/");
      const topic = stripLoSuffix(la.topic).replace(/\|/g, "/").replace(/\n/g, " ");
      const los = Array.isArray(la.learning_outcomes) ? la.learning_outcomes.join(", ") : (la.learning_outcomes || "");
      lines.push(`| ${period} | ${type} | ${topic} | ${los} |`);
    }
  }

  if (c.learning_resources && typeof c.learning_resources === "object") {
    const entries = Object.entries(c.learning_resources).filter(([, v]) => v);
    if (entries.length) {
      lines.push("", "## Learning resources", "");
      for (const [k, v] of entries) {
        const label = k.replace(/_/g, " ").replace(/\b\w/g, s => s.toUpperCase());
        lines.push(`**${label}**`, "");
        if (Array.isArray(v)) v.forEach(x => lines.push(`- ${String(x)}`));
        else lines.push(htmlToMarkdown(String(v)));
        lines.push("");
      }
    }
  } else if (typeof c.learning_resources === "string" && c.learning_resources.trim()) {
    lines.push("", "## Learning resources", "", htmlToMarkdown(c.learning_resources));
  }

  if (c.timetable) {
    lines.push("", "## Timetable", "", htmlToMarkdown(String(c.timetable)));
  }

  if (Array.isArray(c.course_contacts) && c.course_contacts.length) {
    lines.push("", "## Course contacts", "");
    for (const s of c.course_contacts) {
      const bits = [s.name, s.role, s.email].filter(Boolean);
      lines.push(`- ${bits.join(" — ")}`);
    }
  }
  if (Array.isArray(c.course_staff) && c.course_staff.length) {
    lines.push("", "## Course staff", "");
    for (const s of c.course_staff) {
      const bits = [s.name, s.role, s.email].filter(Boolean);
      lines.push(`- ${bits.join(" — ")}`);
    }
  }

  if (c.policies_and_procedures) {
    lines.push("", "## Policies and procedures", "", htmlToMarkdown(String(c.policies_and_procedures)));
  }

  lines.push("", "---", "", `*Generated ${new Date().toLocaleDateString("en-AU")} from the [UQBS Course Profile Viewer](https://uqsmitc6.github.io/uqbs-course-profiles/).*`);
  return lines.join("\n");
}

// Build a standalone HTML document optimised for print-to-PDF.
function buildPrintableHtml(c, taxonomy) {
  const esc = escapeHtml;
  const ovMap = getLoOverrideMap(c.course_code, c.semester_code, c.class_code);
  const roles = taxonomy ? programRolesFor(c.course_code, taxonomy) : [];
  const progLine = roles.length
    ? roles.map(r => `${esc(r.program)} (${esc(r.role || "")})`).join(" · ")
    : "";

  const parts = [];
  parts.push(`<!DOCTYPE html><html lang="en-AU"><head><meta charset="utf-8">
<title>${esc(c.course_code)} — ${esc(c.course_title || "")}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #222; font-size: 11pt; line-height: 1.5; max-width: 780px; margin: 0 auto; padding: 16px; }
  h1 { color: #51247A; font-size: 20pt; margin: 0 0 4px; }
  h2 { color: #51247A; font-size: 14pt; border-bottom: 2px solid #51247A; padding-bottom: 4px; margin: 22px 0 10px; }
  h3 { font-size: 12pt; margin: 16px 0 6px; }
  h4 { font-size: 11pt; color: #51247A; margin: 12px 0 4px; }
  .meta { color: #555; font-size: 10pt; margin-bottom: 6px; }
  .prog { background: #f6f0fa; border-left: 3px solid #BB9237; padding: 8px 12px; margin: 8px 0 14px; font-size: 10pt; }
  dl.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 8px 0 16px; font-size: 10pt; }
  dl.kv dt { font-weight: bold; color: #51247A; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 8px 0 14px; }
  th { background: #51247A; color: #fff; padding: 6px 8px; text-align: left; font-size: 10pt; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:nth-child(even) td { background: #faf7fd; }
  .assessment { border: 1px solid #ddd; border-radius: 6px; padding: 14px; margin-bottom: 12px; page-break-inside: avoid; }
  .footer { margin-top: 28px; font-size: 9pt; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
  ul, ol { margin: 6px 0 10px; padding-left: 22px; }
  li { margin-bottom: 3px; }
  a { color: #51247A; }
</style></head><body>`);

  parts.push(`<h1>${esc(c.course_code)} — ${esc(c.course_title || "")}</h1>`);
  const metaBits = [c.full_course_code, c.study_period, c.study_level, c.attendance_mode, c.location, c.units]
    .filter(Boolean).map(esc).join(" · ");
  if (metaBits) parts.push(`<div class="meta">${metaBits}</div>`);
  if (progLine) parts.push(`<div class="prog"><b>Program mapping:</b> ${progLine}</div>`);

  const over = [
    ["Coordinating unit", c.coordinating_unit],
    ["Administrative campus", c.administrative_campus],
    ["Source", c.url ? `<a href="${esc(c.url)}">${esc(c.url)}</a>` : null],
    ["Scraped", c.scraped_at],
  ].filter(([, v]) => v);
  if (over.length) {
    parts.push(`<dl class="kv">${over.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${k === "Source" ? v : esc(v)}</dd>`).join("")}</dl>`);
  }

  if (c.course_description) {
    parts.push(`<h2>Course description</h2><div>${renderLongText(c.course_description)}</div>`);
  }
  if (c.course_aims) {
    parts.push(`<h2>Course aims</h2><div>${renderLongText(c.course_aims)}</div>`);
  }

  if (c.requirements && typeof c.requirements === "object") {
    const rows = [];
    for (const [key, label] of [
      ["prerequisites", "Prerequisites"],
      ["incompatible", "Incompatible courses"],
      ["companions", "Companions"],
      ["recommended_prerequisites", "Recommended prerequisites"],
      ["restrictions", "Restrictions"],
    ]) {
      const v = c.requirements[key];
      if (!v) continue;
      if (Array.isArray(v) && v.length) rows.push(`<dt>${esc(label)}</dt><dd>${v.map(x => esc(String(x))).join("<br>")}</dd>`);
      else if (typeof v === "string" && v.trim()) rows.push(`<dt>${esc(label)}</dt><dd>${esc(v)}</dd>`);
    }
    if (rows.length) parts.push(`<h2>Requirements</h2><dl class="kv">${rows.join("")}</dl>`);
  }

  if (Array.isArray(c.learning_outcomes) && c.learning_outcomes.length) {
    parts.push(`<h2>Learning outcomes</h2><ol>`);
    for (const lo of c.learning_outcomes) {
      const code = loDisplayCode(lo);
      parts.push(`<li><b>${esc(code)}</b> ${esc(lo.description || "")}</li>`);
    }
    parts.push(`</ol>`);
  }

  if (Array.isArray(c.assessment_summary) && c.assessment_summary.length) {
    parts.push(`<h2>Assessment summary</h2><table><thead><tr><th>#</th><th>Task</th><th>Category</th><th>Weight</th><th>Due</th></tr></thead><tbody>`);
    c.assessment_summary.forEach((a, i) => {
      parts.push(`<tr><td>${i + 1}</td><td><b>${esc(a.title || "")}</b></td><td>${esc(a.category || a.type || "")}</td><td>${esc(a.weighting || a.weight || "")}</td><td>${esc(a.due_date || a.due || "")}</td></tr>`);
    });
    parts.push(`</tbody></table>`);
  }

  if (Array.isArray(c.assessment_details) && c.assessment_details.length) {
    parts.push(`<h2>Assessment details</h2>`);
    c.assessment_details.forEach((a, i) => {
      parts.push(`<div class="assessment"><h3>${i + 1}. ${esc(a.title || "Assessment")}</h3>`);
      const m = [];
      if (a.weighting || a.weight) m.push(`<b>Weight:</b> ${esc(a.weighting || a.weight)}`);
      if (a.due_date || a.due) m.push(`<b>Due:</b> ${esc(a.due_date || a.due)}`);
      if (a.category || a.type) m.push(`<b>Category:</b> ${esc(a.category || a.type)}`);
      if (a.mode) m.push(`<b>Mode:</b> ${esc(a.mode)}`);
      if (a.other_conditions) m.push(`<b>Conditions:</b> ${esc(a.other_conditions)}`);
      if (m.length) parts.push(`<p>${m.join(" · ")}</p>`);
      const ov = ovMap[normTitle(a.title)];
      const lo = ov ? ov.los : (a.learning_outcomes_assessed != null ? a.learning_outcomes_assessed : a.learning_outcomes);
      if (lo) {
        const loStr = Array.isArray(lo) ? lo.join(", ") : String(lo);
        if (loStr) parts.push(`<p><b>Linked LOs:</b> ${esc(loStr)}${ov ? " (from Jac, the authored curriculum record — omitted from the published profile)" : ""}</p>`);
      }
      for (const [key, label] of [
        ["task_description", "Task description"],
        ["task", "Task"],
        ["exam_details", "Exam details"],
        ["submission_guidelines", "Submission guidelines"],
        ["deferral_or_extension", "Deferral or extension"],
        ["late_submission", "Late submission"],
        ["marking_criteria", "Marking criteria"],
        ["ai_statement", "AI / academic integrity"],
      ]) {
        const v = a[key];
        if (!v) continue;
        if (Array.isArray(v)) parts.push(`<h4>${esc(label)}</h4><ul>${v.map(x => `<li>${esc(String(x))}</li>`).join("")}</ul>`);
        else parts.push(`<h4>${esc(label)}</h4>${renderLongText(String(v))}`);
      }
      parts.push(`</div>`);
    });
  }

  if (Array.isArray(c.learning_activities) && c.learning_activities.length) {
    parts.push(`<h2>Weekly learning activities</h2><table><thead><tr><th>Period</th><th>Type</th><th>Topic</th><th>LOs</th></tr></thead><tbody>`);
    for (const la of c.learning_activities) {
      const topic = stripLoSuffix(la.topic);
      const los = Array.isArray(la.learning_outcomes) ? la.learning_outcomes.join(", ") : (la.learning_outcomes || "");
      parts.push(`<tr><td>${esc(la.learning_period || "")}</td><td>${esc(la.activity_type || "")}</td><td>${esc(topic)}</td><td>${esc(los)}</td></tr>`);
    }
    parts.push(`</tbody></table>`);
  }

  if (c.learning_resources && typeof c.learning_resources === "object") {
    const rows = [];
    for (const [k, v] of Object.entries(c.learning_resources)) {
      if (!v) continue;
      const label = k.replace(/_/g, " ").replace(/\b\w/g, s => s.toUpperCase());
      if (Array.isArray(v)) rows.push(`<dt>${esc(label)}</dt><dd>${v.map(x => esc(String(x))).join("<br>")}</dd>`);
      else rows.push(`<dt>${esc(label)}</dt><dd>${renderLongText(String(v))}</dd>`);
    }
    if (rows.length) parts.push(`<h2>Learning resources</h2><dl class="kv">${rows.join("")}</dl>`);
  } else if (typeof c.learning_resources === "string" && c.learning_resources.trim()) {
    parts.push(`<h2>Learning resources</h2><div>${renderLongText(c.learning_resources)}</div>`);
  }

  if (c.timetable) parts.push(`<h2>Timetable</h2><div>${renderLongText(String(c.timetable))}</div>`);

  const staffRender = list => `<ul>${list.map(s => `<li><b>${esc(s.name || "")}</b>${s.role ? ` — ${esc(s.role)}` : ""}${s.email ? ` — <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ""}</li>`).join("")}</ul>`;
  if (Array.isArray(c.course_contacts) && c.course_contacts.length) parts.push(`<h2>Course contacts</h2>${staffRender(c.course_contacts)}`);
  if (Array.isArray(c.course_staff) && c.course_staff.length) parts.push(`<h2>Course staff</h2>${staffRender(c.course_staff)}`);

  if (c.policies_and_procedures) parts.push(`<h2>Policies and procedures</h2><div>${renderLongText(String(c.policies_and_procedures))}</div>`);

  parts.push(`<div class="footer">Generated ${esc(new Date().toLocaleDateString("en-AU"))} from the UQBS Course Profile Viewer · <a href="https://uqsmitc6.github.io/uqbs-course-profiles/">uqsmitc6.github.io/uqbs-course-profiles</a></div>`);
  parts.push(`</body></html>`);
  return parts.join("");
}

// Open a new window with the print-friendly HTML and trigger the print dialog.
function printCourseToPdf(c, taxonomy) {
  const html = buildPrintableHtml(c, taxonomy);
  const w = window.open("", "_blank");
  if (!w) {
    alert("Your browser blocked the print window. Please allow pop-ups for this site, or use Ctrl/⌘+P on this page.");
    return;
  }
  w.document.open(); w.document.write(html); w.document.close();
  // Wait for render, then print
  const trigger = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
  if (w.document.readyState === "complete") setTimeout(trigger, 350);
  else w.addEventListener("load", () => setTimeout(trigger, 150));
}

function downloadCourseMarkdown(c, taxonomy) {
  const md = buildCourseMarkdown(c, taxonomy);
  downloadBlob(md, safeFilename(c, "md"), "text/markdown;charset=utf-8");
}

function downloadCourseJson(c) {
  const json = JSON.stringify(completeCourseJson(c), null, 2);
  downloadBlob(json, safeFilename(c, "json"), "application/json;charset=utf-8");
}

// =========================================================================
// Page: BROWSER (index.html)
// =========================================================================
async function initBrowser() {
  const $body = document.getElementById("courses-body");
  const $count = document.getElementById("course-count");
  const $meta = document.getElementById("meta-info");
  try {
    const [manifest, taxonomy, aol] = await Promise.all([loadManifest(), loadTaxonomy().catch(() => null), loadAol().catch(() => null), loadLoOverrides().catch(() => null)]);
    const courses = getAllCourses(manifest);
    STORE.allCourses = courses;
    STORE.taxonomy = taxonomy;
    STORE.aol = aol;
    $meta.innerHTML = `<span>Scrape generated</span> <b>${escapeHtml(fmtDate(manifest.generated_at))}</b> <span>· ${manifest.total_profiles} profiles</span>`;

    // Populate filter dropdowns
    populateSelect("filter-level", uniqueSorted(courses.map(c => c.study_level)));
    populateSelect("filter-mode", uniqueSorted(courses.map(c => c.attendance_mode)));
    populateSelect("filter-location", uniqueSorted(courses.map(c => c.location)));
    if (taxonomy && taxonomy.programs) {
      const progOpts = Object.entries(taxonomy.programs)
        .filter(([, v]) => v.is_programme !== false)
        .map(([k, v]) => ({ value: k, label: `${v.name} (${k})` }));
      populateSelect("filter-program", progOpts);
    }

    // Populate semester filter and default to most recent
    const semCodes = uniqueSorted(courses.map(c => c.semester_code));
    const semOpts = semCodes.map(code => {
      const sample = courses.find(c => c.semester_code === code);
      return { value: code, label: sample ? semesterLabel(sample) : code };
    });
    populateSelect("filter-semester", semOpts);
    // Default to most recent semester
    const $semFilter = document.getElementById("filter-semester");
    if ($semFilter && semCodes.length) {
      $semFilter.value = semCodes[semCodes.length - 1];
    }

    // Initial render
    STORE.sort = { key: "course_code", dir: "asc" };
    bindControls();
    render();
  } catch (err) {
    $body.innerHTML = `<tr><td colspan="7" class="error">Error loading data: ${escapeHtml(err.message)}</td></tr>`;
    console.error(err);
  }
}

function populateSelect(id, options) {
  const $sel = document.getElementById(id);
  if (!$sel) return;
  for (const opt of options) {
    const el = document.createElement("option");
    if (typeof opt === "string") { el.value = opt; el.textContent = opt; }
    else { el.value = opt.value; el.textContent = opt.label; }
    $sel.appendChild(el);
  }
}

function bindControls() {
  for (const id of ["search", "filter-semester", "filter-level", "filter-mode", "filter-location", "filter-program"]) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", render);
  }
  // Sortable headers
  document.querySelectorAll("table.courses th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (STORE.sort.key === key) {
        STORE.sort.dir = STORE.sort.dir === "asc" ? "desc" : "asc";
      } else {
        STORE.sort = { key, dir: "asc" };
      }
      render();
    });
  });
  // CSV export
  const $export = document.getElementById("export-csv");
  if ($export) $export.addEventListener("click", exportFilteredAsCsv);
  const $zipMd = document.getElementById("export-zip-md");
  if ($zipMd) $zipMd.addEventListener("click", () => exportFilteredAsZip("md"));
  const $zipJson = document.getElementById("export-zip-json");
  if ($zipJson) $zipJson.addEventListener("click", () => exportFilteredAsZip("json"));
}

async function exportFilteredAsZip(format) {
  if (typeof JSZip === "undefined") {
    alert("ZIP library (JSZip) didn't load. Please check your network and try again.");
    return;
  }
  const courses = applySort(applyFilters(STORE.allCourses || []));
  if (!courses.length) {
    alert("No courses match the current filters.");
    return;
  }
  // Safety cap — warn the user for large selections
  if (courses.length > 300) {
    if (!confirm(`You're about to download ${courses.length} profiles. This may take a minute and will fetch ${courses.length} files. Continue?`)) return;
  }

  const $status = document.getElementById("bulk-status");
  const setStatus = msg => { if ($status) $status.textContent = msg; };
  setStatus(`Preparing ${courses.length} profile${courses.length === 1 ? "" : "s"}…`);

  const taxonomy = STORE.taxonomy;
  const zip = new JSZip();

  // Fetch with modest concurrency so we don't hammer the CDN or the browser.
  const CONCURRENCY = 6;
  let done = 0, failed = 0;
  let idx = 0;
  async function worker() {
    while (idx < courses.length) {
      const i = idx++;
      const c = courses[i];
      try {
        const full = await loadCourseJson(c.file);
        if (format === "md") {
          const md = buildCourseMarkdown(full, taxonomy);
          zip.file(`${safeFilename(full, "md")}`, md);
        } else {
          zip.file(`${safeFilename(full, "json")}`, JSON.stringify(completeCourseJson(full), null, 2));
        }
      } catch (err) {
        failed++;
        console.error(`Failed to fetch ${c.file}:`, err);
      }
      done++;
      if (done % 10 === 0 || done === courses.length) {
        setStatus(`Building ${format.toUpperCase()} ZIP · ${done}/${courses.length}${failed ? ` (${failed} failed)` : ""}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, courses.length) }, worker));

  // Add a manifest listing everything included, plus taxonomy if JSON.
  const manifestLines = [
    `# UQBS Course Profile Viewer — bulk export`,
    ``,
    `- Format: ${format.toUpperCase()}`,
    `- Courses: ${courses.length - failed}${failed ? ` (${failed} failed)` : ""}`,
    `- Generated: ${new Date().toISOString()}`,
    `- Filters applied at export time.`,
    ``,
  ];
  zip.file("README.md", manifestLines.join("\n"));

  setStatus(`Compressing ${format.toUpperCase()} ZIP…`);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const stamp = new Date().toISOString().slice(0, 10);
  const fname = `uqbs-courses-${stamp}-${courses.length}-${format}.zip`;
  downloadBlob(blob, fname, "application/zip");
  setStatus(`Done — ${courses.length - failed} profiles exported${failed ? `, ${failed} failed` : ""}.`);
  // Clear status after a short delay
  setTimeout(() => setStatus(""), 6000);
}

function exportFilteredAsCsv() {
  const courses = applySort(applyFilters(STORE.allCourses || []));
  const taxonomy = STORE.taxonomy;
  const columns = [
    "course_code", "course_title", "full_course_code", "study_level",
    "units", "attendance_mode", "location", "study_period",
    "coordinating_unit", "lo_count", "assessment_count",
    "programs", "scraped_at", "url",
  ];
  const csvEscape = v => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(",")];
  for (const c of courses) {
    const roles = taxonomy ? programRolesFor(c.course_code, taxonomy) : [];
    const progs = roles.map(r => `${r.program}:${r.role || ""}`).join("; ");
    const row = columns.map(col => {
      if (col === "programs") return csvEscape(progs);
      return csvEscape(c[col]);
    });
    lines.push(row.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const now = new Date().toISOString().slice(0, 10);
  const filename = `uqbs-courses-${now}-${courses.length}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function applyFilters(courses) {
  const q = (document.getElementById("search")?.value || "").trim().toLowerCase();
  const sem = document.getElementById("filter-semester")?.value;
  const level = document.getElementById("filter-level")?.value;
  const mode = document.getElementById("filter-mode")?.value;
  const loc = document.getElementById("filter-location")?.value;
  const prog = document.getElementById("filter-program")?.value;

  return courses.filter(c => {
    if (q) {
      const hay = `${c.course_code} ${c.course_title || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (sem && c.semester_code !== sem) return false;
    if (level && c.study_level !== level) return false;
    if (mode && c.attendance_mode !== mode) return false;
    if (loc && c.location !== loc) return false;
    if (prog && STORE.taxonomy && STORE.taxonomy.course_programs) {
      const roles = STORE.taxonomy.course_programs[c.course_code] || [];
      if (!roles.some(r => r.program === prog)) return false;
    }
    return true;
  });
}

function applySort(courses) {
  const { key, dir } = STORE.sort;
  const mult = dir === "asc" ? 1 : -1;
  return [...courses].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * mult;
    return String(av).localeCompare(String(bv), "en", { numeric: true }) * mult;
  });
}

function render() {
  const $body = document.getElementById("courses-body");
  const $count = document.getElementById("course-count");
  const courses = applySort(applyFilters(STORE.allCourses || []));
  $count.textContent = courses.length;

  if (courses.length === 0) {
    $body.innerHTML = `<tr><td colspan="9" class="empty">No courses match the current filters.</td></tr>`;
    updateSortIndicators();
    return;
  }

  const taxonomy = STORE.taxonomy;
  const rows = courses.map(c => {
    const roles = taxonomy ? programRolesFor(c.course_code, taxonomy) : [];
    const progChips = roles.slice(0, 3).map(r => {
      const isCore = (r.role || "").toLowerCase() === "core";
      const cls = isCore ? "chip role-core" : "chip";
      return `<span class="${cls}" title="${escapeHtml(r.program_name || r.program)} — ${escapeHtml(r.role || "")}">${escapeHtml(r.program)}</span>`;
    }).join("");
    const more = roles.length > 3 ? `<span class="chip muted">+${roles.length - 3}</span>` : "";
    const levelClass = (c.study_level || "").toLowerCase().includes("post") ? "level-pill pg" : "level-pill";
    const fullCode = c.full_course_code || [c.course_code, c.class_code, c.semester_code].filter(Boolean).join("-");
    const pfx = coursePrefix(c.course_code);
    const codeCls = pfx ? `code prefix-${pfx}` : "code";
    const aolEntries = STORE.aol ? getAolForCourse(STORE.aol, c.course_code) : [];
    const aolCell = aolEntries.length
      ? aolEntries.map(e => `<span class="aol-chip ${(AOL_STATUS[e.status] || {}).cls || ''}" title="${escapeHtml(e.ga)}: ${escapeHtml((AOL_STATUS[e.status] || {}).label || e.status)}">${escapeHtml(e.ga)}</span>`).join(" ")
      : "";
    const semLabel = semesterLabel(c);
    return `
      <tr>
        <td class="${codeCls}"><a href="course.html?file=${encodeURIComponent(c.file)}">${escapeHtml(c.course_code || "")}</a></td>
        <td>${escapeHtml(c.course_title || "")}</td>
        <td class="nowrap">${escapeHtml(semLabel)}</td>
        <td><span class="${levelClass}">${escapeHtml(c.study_level || "")}</span></td>
        <td>${escapeHtml(c.units || "")}</td>
        <td>${escapeHtml(c.attendance_mode || "")}</td>
        <td>${escapeHtml(c.location || "")}</td>
        <td>${progChips}${more}</td>
        <td class="aol-col">${aolCell}</td>
      </tr>`;
  }).join("");
  $body.innerHTML = rows;
  updateSortIndicators();
}

function updateSortIndicators() {
  document.querySelectorAll("table.courses th[data-sort]").forEach(th => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sort === STORE.sort.key) {
      th.classList.add(STORE.sort.dir === "asc" ? "sort-asc" : "sort-desc");
    }
  });
}

// =========================================================================
// Page: COURSE DETAIL (course.html)
// =========================================================================
async function initCourseDetail() {
  const $root = document.getElementById("course-root");
  const filePath = getQueryParam("file");
  if (!filePath) {
    $root.innerHTML = `<div class="error">No course specified. Append <code>?file=profiles/{semester}/{course}.json</code> to the URL.</div>`;
    return;
  }
  try {
    const [course, manifest, taxonomy, aol] = await Promise.all([
      loadCourseJson(filePath), loadManifest(), loadTaxonomy().catch(() => null), loadAol().catch(() => null), loadLoOverrides().catch(() => null)
    ]);
    STORE.currentCourse = course;
    STORE.currentTaxonomy = taxonomy;
    STORE.aol = aol;

    // Find all offerings of this course across semesters
    const allCourses = getAllCourses(manifest);
    const otherOfferings = allCourses
      .filter(c => c.course_code === course.course_code && c.file !== filePath)
      .sort((a, b) => (b.semester_code || "").localeCompare(a.semester_code || ""));

    renderCourseDetail($root, course, taxonomy, otherOfferings, filePath);
    document.title = `${course.course_code} — ${course.course_title}`;
    // Wire up download buttons after render
    const $pdf = document.getElementById("dl-pdf");
    const $md = document.getElementById("dl-md");
    const $json = document.getElementById("dl-json");
    if ($pdf) $pdf.addEventListener("click", () => printCourseToPdf(course, taxonomy));
    if ($md) $md.addEventListener("click", () => downloadCourseMarkdown(course, taxonomy));
    if ($json) $json.addEventListener("click", () => downloadCourseJson(course));
  } catch (err) {
    $root.innerHTML = `<div class="error">Error loading profile: ${escapeHtml(err.message)}</div>`;
    console.error(err);
  }
}

function renderCourseDetail($root, c, taxonomy, otherOfferings, currentFile) {
  // Default for backward compat
  otherOfferings = otherOfferings || [];
  const roles = taxonomy ? programRolesFor(c.course_code, taxonomy) : [];
  const progChips = roles.map(r => {
    const isCore = (r.role || "").toLowerCase() === "core";
    const cls = isCore ? "chip role-core" : "chip";
    return `<span class="${cls}" title="${escapeHtml(r.role || "")}"><a href="program.html?program=${encodeURIComponent(r.program)}">${escapeHtml(r.program_name || r.program)}</a> · ${escapeHtml(r.role || "")}</span>`;
  }).join(" ");

  const parts = [];

  // Semester picker (if multiple offerings exist)
  let semPickerHtml = "";
  if (otherOfferings.length > 0) {
    const currentLabel = semesterLabel(c);
    const links = otherOfferings.map(o => {
      const label = semesterLabel(o);
      return `<a href="course.html?file=${encodeURIComponent(o.file)}" class="sem-pick-link">${escapeHtml(label)}</a>`;
    }).join("");
    semPickerHtml = `
      <div class="semester-picker">
        <span class="sem-pick-current" title="Currently viewing">${escapeHtml(currentLabel)}</span>
        ${links}
      </div>
    `;
  }

  // Header card
  const filePath = currentFile || getQueryParam("file");
  const rawJsonLink = filePath ? `<a href="./${escapeHtml(filePath)}" target="_blank" rel="noopener">Raw JSON ↗</a>` : "";
  parts.push(`
    <div class="course-header">
      <div><span class="code">${escapeHtml(c.full_course_code || c.course_code)}</span></div>
      <h1>${escapeHtml(c.course_code || "")} — ${escapeHtml(c.course_title || "")}</h1>
      <div class="meta">
        ${escapeHtml(c.study_level || "")} · ${escapeHtml(c.units || "")} ·
        ${escapeHtml(c.attendance_mode || "")} · ${escapeHtml(c.location || "")}
        ${c.url ? ` · <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">View on course-profiles.uq.edu.au ↗</a>` : ""}
        ${rawJsonLink ? ` · ${rawJsonLink}` : ""}
      </div>
      <div class="meta small" style="margin-top:4px">Last scraped: ${escapeHtml(fmtDate(c.scraped_at))}</div>
      ${semPickerHtml}
      ${progChips ? `<div style="margin-top:10px">${progChips}</div>` : ""}
    </div>
  `);

  // Download bar
  parts.push(`
    <div class="download-bar" aria-label="Download this profile">
      <button id="dl-pdf" class="dl-btn" type="button" title="Opens a print-friendly view — use Save as PDF in the print dialog">
        <span aria-hidden="true">🖨️</span> Save as PDF
      </button>
      <button id="dl-md" class="dl-btn" type="button" title="Download a clean Markdown (.md) version — good for LLMs and notes">
        <span aria-hidden="true">📝</span> Download Markdown
      </button>
      <button id="dl-json" class="dl-btn" type="button" title="Download the raw profile JSON">
        <span aria-hidden="true">{ }</span> Download JSON
      </button>
    </div>
  `);

  // Overview
  const overviewRows = [
    ["Study period", c.study_period],
    ["Coordinating unit", c.coordinating_unit],
    ["Administrative campus", c.administrative_campus],
  ].filter(([_, v]) => v);
  if (overviewRows.length) {
    parts.push(`
      <div class="card">
        <h2 style="margin-top:0">Overview</h2>
        <dl class="kv-grid">
          ${overviewRows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("")}
        </dl>
      </div>
    `);
  }

  // Description
  if (c.course_description) {
    parts.push(`
      <div class="card">
        <h2>Course description</h2>
        <div>${renderLongText(c.course_description)}</div>
      </div>
    `);
  }

  // Requirements (dict: prerequisites, incompatible, restrictions — each a list)
  if (c.requirements && typeof c.requirements === "object") {
    const reqRows = [];
    for (const [key, label] of [
      ["prerequisites", "Prerequisites"],
      ["incompatible", "Incompatible courses"],
      ["companions", "Companions"],
      ["restrictions", "Restrictions"],
      ["recommended_prerequisites", "Recommended prerequisites"],
    ]) {
      const v = c.requirements[key];
      if (!v) continue;
      if (Array.isArray(v) && v.length) {
        reqRows.push(`<dt>${escapeHtml(label)}</dt><dd>${v.map(item => escapeHtml(String(item))).join("<br>")}</dd>`);
      } else if (typeof v === "string" && v.trim()) {
        reqRows.push(`<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(v)}</dd>`);
      }
    }
    if (reqRows.length) {
      parts.push(`
        <div class="card">
          <h2>Requirements</h2>
          <dl class="kv-grid">${reqRows.join("")}</dl>
        </div>
      `);
    }
  }

  // Aims
  if (c.course_aims) {
    parts.push(`
      <div class="card">
        <h2>Course aims</h2>
        <div>${renderLongText(c.course_aims)}</div>
      </div>
    `);
  }

  // Learning outcomes
  if (c.learning_outcomes && c.learning_outcomes.length) {
    parts.push(`
      <div class="card">
        <h2>Learning outcomes</h2>
        ${c.learning_outcomes.map(lo => {
          const code = loDisplayCode(lo);
          return `
            <div class="lo-item">
              <div class="lo-code">${escapeHtml(code)}</div>
              <div>${escapeHtml(lo.description || "")}</div>
            </div>
          `;
        }).join("")}
      </div>
    `);
  }

  // Assessment summary — merge LO mapping from assessment_details when
  // the summary rows don't carry it directly.
  if (c.assessment_summary && c.assessment_summary.length) {
    const loMap = buildAssessmentLoMap(c);
    const ovMap = getLoOverrideMap(c.course_code, c.semester_code, c.class_code);
    // Resolve the LO list for one assessment row: override wins, then any LOs
    // carried on the summary row, then the scraped assessment-details map.
    const resolveLos = (a) => {
      const title = (a.title || "").trim();
      const ov = ovMap[normTitle(title)];
      if (ov) return { los: ov.los, override: true, notes: ov.notes };
      if (a.learning_outcomes && a.learning_outcomes.length) return { los: a.learning_outcomes, override: false };
      if (title && loMap[title]) return { los: loMap[title], override: false };
      return { los: [], override: false };
    };
    const resolved = c.assessment_summary.map(resolveLos);
    const hasAnyLos = resolved.some(r => r.los && r.los.length);
    const anyOverride = resolved.some(r => r.override);
    const loHeader = hasAnyLos ? `<th>LOs</th>` : "";
    const rows = c.assessment_summary.map((a, i) => {
      const { los, override, notes } = resolved[i];
      const chips = los.length
        ? los.map(x => `<span class="lo-chip${override ? " override" : ""}"${override ? ` title="From Jac, the authored curriculum record — omitted from the published profile${notes ? ": " + escapeHtml(notes) : ""}"` : ""}>${escapeHtml(x)}</span>`).join(" ")
        : "—";
      const mark = override ? ` <span class="lo-override-mark" title="From Jac, the authored curriculum record — omitted from the published profile by a publishing fault">Jac</span>` : "";
      const loCell = hasAnyLos ? `<td class="lo-list">${chips}${mark}</td>` : "";
      return `
        <tr>
          <td><b>${escapeHtml(a.title || "")}</b>
            ${a.conditions && a.conditions.length ? `<span class="conditions">${a.conditions.map(escapeHtml).join(" · ")}</span>` : ""}
          </td>
          <td class="nowrap">${escapeHtml(a.category || a.type || "")}</td>
          <td class="weight nowrap">${escapeHtml(a.weighting || a.weight || "")}</td>
          <td>${escapeHtml(a.due_date || a.due || "")}</td>
          ${loCell}
        </tr>
      `;
    }).join("");
    const legend = anyOverride
      ? `<p class="lo-override-legend">Mappings marked <span class="lo-override-mark">Jac</span> are from the authored curriculum record in Jac. UQ's published profile omits them due to a publishing fault.</p>`
      : "";
    parts.push(`
      <div class="card">
        <h2>Assessment</h2>
        <table class="assessment">
          <thead><tr><th>Task</th><th>Category</th><th>Weight</th><th>Due</th>${loHeader}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${legend}
      </div>
    `);
  }

  // AoL status card
  const aolEntries = STORE.aol ? getAolForCourse(STORE.aol, c.course_code) : [];
  if (aolEntries.length) {
    const aolRows = aolEntries.map(e => {
      const statusInfo = AOL_STATUS[e.status] || { label: e.status, icon: "?", cls: "" };
      return `<tr>
        <td>${escapeHtml(e.semester_label || e.semester_code)}</td>
        <td>${aolGaChip(e.ga)}</td>
        <td>${escapeHtml(e.assessment_title)}</td>
        <td><span class="aol-chip ${statusInfo.cls}">${statusInfo.icon} ${escapeHtml(statusInfo.label)}</span></td>
        <td>${e.rubric_url ? `<a href="${escapeHtml(e.rubric_url)}" target="_blank" rel="noopener">View rubric ↗</a>` : '<span class="muted">—</span>'}</td>
        <td class="muted small">${escapeHtml(e.notes || "")}</td>
      </tr>`;
    }).join("");
    parts.push(`
      <div class="card aol-card">
        <h2>Assurance of Learning</h2>
        <table class="assessment">
          <thead><tr><th>Semester</th><th>GA</th><th>Assessment</th><th>Status</th><th>Rubric</th><th>Notes</th></tr></thead>
          <tbody>${aolRows}</tbody>
        </table>
      </div>
    `);
  }

  // Assessment details
  if (c.assessment_details && c.assessment_details.length) {
    const ovMapDetail = getLoOverrideMap(c.course_code, c.semester_code, c.class_code);
    parts.push(`
      <div class="card">
        <h2>Assessment details</h2>
        ${c.assessment_details.map(a => renderAssessmentDetail(a, ovMapDetail)).join("")}
      </div>
    `);
  }

  // Timetable
  if (c.timetable) {
    parts.push(`
      <div class="card">
        <h2>Timetable</h2>
        <div>${renderLongText(c.timetable)}</div>
      </div>
    `);
  }

  // Contacts
  if (c.course_contacts && c.course_contacts.length) {
    parts.push(`
      <div class="card">
        <h2>Course contacts</h2>
        <div class="staff-list">
          ${c.course_contacts.map(renderStaffCard).join("")}
        </div>
      </div>
    `);
  }

  // Staff
  if (c.course_staff && c.course_staff.length) {
    parts.push(`
      <div class="card">
        <h2>Course staff</h2>
        <div class="staff-list">
          ${c.course_staff.map(renderStaffCard).join("")}
        </div>
      </div>
    `);
  }

  // Learning activities (list of {learning_period, activity_type, topic, learning_outcomes})
  if (Array.isArray(c.learning_activities) && c.learning_activities.length) {
    const rows = c.learning_activities.map(la => {
      // Strip trailing "Learning outcomes:..." which the scraper concatenates into topic
      const topic = (la.topic || "").replace(/\s*Learning outcomes?:.*$/i, "").trim();
      const los = Array.isArray(la.learning_outcomes) ? la.learning_outcomes.join(", ") : (la.learning_outcomes || "");
      return `<tr>
        <td class="nowrap">${escapeHtml(la.learning_period || "")}</td>
        <td class="nowrap">${escapeHtml(la.activity_type || "")}</td>
        <td>${escapeHtml(topic)}</td>
        <td class="nowrap small">${escapeHtml(los)}</td>
      </tr>`;
    }).join("");
    parts.push(`
      <div class="card">
        <h2>Learning activities</h2>
        <table class="assessment">
          <thead><tr><th>Period</th><th>Type</th><th>Topic</th><th>LOs</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  // Learning resources (dict: library_resources, etc. — may be string or list)
  if (c.learning_resources && typeof c.learning_resources === "object") {
    const lrRows = [];
    const labelMap = {
      library_resources: "Library resources",
      additional_resources: "Additional resources",
      required_resources: "Required resources",
      recommended_resources: "Recommended resources",
    };
    for (const [key, val] of Object.entries(c.learning_resources)) {
      if (!val) continue;
      const label = labelMap[key] || key.replace(/_/g, " ").replace(/\b\w/g, s => s.toUpperCase());
      let rendered;
      if (Array.isArray(val)) {
        rendered = val.map(v => escapeHtml(String(v))).join("<br>");
      } else {
        rendered = renderLongText(String(val));
      }
      lrRows.push(`<dt>${escapeHtml(label)}</dt><dd>${rendered}</dd>`);
    }
    if (lrRows.length) {
      parts.push(`
        <div class="card">
          <h2>Learning resources</h2>
          <dl class="kv-grid">${lrRows.join("")}</dl>
        </div>
      `);
    }
  } else if (typeof c.learning_resources === "string" && c.learning_resources.trim()) {
    parts.push(`
      <div class="card">
        <h2>Learning resources</h2>
        <div>${renderLongText(c.learning_resources)}</div>
      </div>
    `);
  }

  // Policies
  if (c.policies_and_procedures) {
    parts.push(`
      <div class="card">
        <h2>Policies and procedures</h2>
        <div>${renderLongText(c.policies_and_procedures)}</div>
      </div>
    `);
  }

  $root.innerHTML = parts.join("");
}

function renderAssessmentDetail(a, ovMap) {
  const meta = [];
  if (a.weighting || a.weight) meta.push(`<b>Weight:</b> ${escapeHtml(a.weighting || a.weight)}`);
  if (a.due_date || a.due) meta.push(`<b>Due:</b> ${escapeHtml(a.due_date || a.due)}`);
  if (a.category || a.type) meta.push(`<b>Category:</b> ${escapeHtml(a.category || a.type)}`);
  if (a.mode) meta.push(`<b>Mode:</b> ${escapeHtml(a.mode)}`);
  if (a.other_conditions) meta.push(`<b>Conditions:</b> ${escapeHtml(a.other_conditions)}`);

  // Learning outcomes assessed — a manual override (if present) is the
  // authoritative list; otherwise use the scraped value ("L01, L02" or list).
  const ov = ovMap ? ovMap[normTitle(a.title)] : null;
  let loStr = "", loOverride = false;
  if (ov) {
    loStr = ov.los.join(", ");
    loOverride = true;
  } else {
    const loField = a.learning_outcomes_assessed != null ? a.learning_outcomes_assessed : a.learning_outcomes;
    if (Array.isArray(loField)) loStr = loField.map(x => String(x)).join(", ");
    else if (loField) loStr = String(loField);
  }

  // Special indicators (list of strings)
  let indicators = "";
  if (Array.isArray(a.special_indicators) && a.special_indicators.length) {
    indicators = a.special_indicators.map(s => `<span class="chip">${escapeHtml(String(s))}</span>`).join(" ");
  }

  const sections = [];
  for (const [key, label] of [
    ["task_description", "Task description"],
    ["task", "Task"],
    ["exam_details", "Exam details"],
    ["submission_guidelines", "Submission guidelines"],
    ["deferral_or_extension", "Deferral or extension"],
    ["late_submission", "Late submission"],
    ["marking_criteria", "Marking criteria"],
    ["ai_statement", "AI / academic integrity"],
  ]) {
    const v = a[key];
    if (!v) continue;
    if (Array.isArray(v)) {
      sections.push(`<h4>${label}</h4><ul class="plain">${v.map(x => `<li>${escapeHtml(String(x))}</li>`).join("")}</ul>`);
    } else {
      sections.push(`<h4>${label}</h4>${renderLongText(String(v))}`);
    }
  }

  return `
    <div class="assessment-detail">
      <h4>${escapeHtml(a.title || a.name || "Assessment")}</h4>
      ${meta.length ? `<div class="a-meta">${meta.join(" · ")}</div>` : ""}
      ${indicators ? `<div style="margin-bottom:8px">${indicators}</div>` : ""}
      ${loStr ? `<div class="small muted">Linked LOs: ${escapeHtml(loStr)}${loOverride ? ` <span class="lo-override-mark" title="From Jac, the authored curriculum record — omitted from the published profile by a publishing fault">Jac</span>` : ""}</div>` : ""}
      ${sections.join("")}
    </div>
  `;
}

function renderStaffCard(s) {
  const name = s.name || "";
  const role = s.role || "";
  const email = s.email || "";
  return `
    <div class="staff-card">
      <div class="name">${escapeHtml(name)}</div>
      ${role ? `<div class="role">${escapeHtml(role)}</div>` : ""}
      ${email ? `<div class="email"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>` : ""}
    </div>
  `;
}

// Render long text: if already contains HTML-like content keep it conservatively as escaped paragraphs
function renderLongText(text) {
  if (!text) return "";
  // Split on double newlines; escape and wrap each paragraph
  const paras = String(text).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return paras.map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

// =========================================================================
// Page: PROGRAM (program.html)
// =========================================================================
async function initProgram() {
  const $root = document.getElementById("program-root");
  const progKey = getQueryParam("program");

  try {
    const [manifest, taxonomy, aol] = await Promise.all([loadManifest(), loadTaxonomy(), loadAol().catch(() => null)]);
    const courses = getAllCourses(manifest);
    STORE.allCourses = courses;
    STORE.taxonomy = taxonomy;
    STORE.aol = aol;

    if (!progKey) {
      renderProgramIndex($root, taxonomy, courses);
    } else {
      renderProgramDetail($root, progKey, taxonomy, courses);
    }
  } catch (err) {
    $root.innerHTML = `<div class="error">Error: ${escapeHtml(err.message)}</div>`;
    console.error(err);
  }
}

function renderProgramIndex($root, taxonomy, courses) {
  document.title = "Programs — UQBS Course Profile Viewer";
  const coursesByCode = {};
  for (const c of courses) coursesByCode[c.course_code] = c;

  const programEntries = Object.entries(taxonomy.programs).filter(([, p]) => p.is_programme !== false);
  const items = programEntries.map(([key, p]) => {
    const scrapedCount = Object.entries(taxonomy.course_programs || {}).filter(([code, roles]) => {
      return roles.some(r => r.program === key) && coursesByCode[code];
    }).length;
    const codeLabel = p.program_code ? ` · ${p.program_code}` : "";
    return `
      <a class="program-card" href="program.html?program=${encodeURIComponent(key)}" style="display:block">
        <div class="level">${escapeHtml(p.level || "")}</div>
        <h3>${escapeHtml(p.name || key)}</h3>
        <div class="muted small">${escapeHtml(key)}${escapeHtml(codeLabel)}</div>
        <div class="count">${scrapedCount} course${scrapedCount === 1 ? "" : "s"} with scraped profile${scrapedCount === 1 ? "" : "s"}</div>
      </a>
    `;
  }).join("");

  $root.innerHTML = `
    <h1>Programs</h1>
    <p class="subtitle">${programEntries.length} UQBS programs. Click through to see core and majors.</p>
    <div class="program-list">${items}</div>
  `;
}

function renderProgramDetail($root, progKey, taxonomy, courses) {
  const p = taxonomy.programs[progKey];
  if (!p) {
    $root.innerHTML = `<div class="error">Unknown program: ${escapeHtml(progKey)}</div>`;
    return;
  }
  document.title = `${p.name} — UQBS Course Profile Viewer`;
  const coursesByCode = {};
  for (const c of courses) coursesByCode[c.course_code] = c;

  function renderCourseRow(code) {
    const c = coursesByCode[code];
    const pfx = coursePrefix(code);
    const codeCls = pfx ? `code prefix-${pfx}` : "code";
    const courseAol = STORE.aol ? getAolForCourse(STORE.aol, code) : [];
    const aolTd = courseAol.length
      ? `<td class="aol-col">${courseAol.map(e => `<span class="aol-chip ${(AOL_STATUS[e.status] || {}).cls || ''}" title="${escapeHtml((AOL_STATUS[e.status] || {}).label || e.status)}: ${escapeHtml(e.assessment_title)}">${escapeHtml(e.ga)}</span>`).join(" ")}</td>`
      : `<td class="aol-col"></td>`;
    if (c) {
      return `<tr>
        <td class="${codeCls}"><a href="course.html?file=${encodeURIComponent(c.file)}">${escapeHtml(code)}</a></td>
        <td>${escapeHtml(c.course_title || "")}</td>
        <td>${escapeHtml(c.units || "")}</td>
        <td>${escapeHtml(c.attendance_mode || "")}</td>
        ${aolTd}
      </tr>`;
    }
    return `<tr>
      <td class="${codeCls} muted">${escapeHtml(code)}</td>
      <td class="muted"><em>not in current scrape</em></td>
      <td></td><td></td>
      ${aolTd}
    </tr>`;
  }

  const codeLabel = p.program_code ? ` · ${p.program_code}` : "";
  const parts = [`
    <a href="program.html" class="small">← All programs</a>
    <h1 style="margin-top:8px">${escapeHtml(p.name)}</h1>
    <p class="subtitle">${escapeHtml(progKey)}${escapeHtml(codeLabel)} · ${escapeHtml(p.level || "")}</p>
  `];

  // Pathway info (for Grad Certs)
  if (p.pathway_to) {
    const dest = taxonomy.programs[p.pathway_to];
    const destName = dest ? dest.name : p.pathway_to;
    parts.push(`<p class="muted small" style="margin-top:-8px">Pathway to: <a href="program.html?program=${encodeURIComponent(p.pathway_to)}">${escapeHtml(destName)}</a></p>`);
  }

  // Helper: render a named course-list section
  function renderSection(title, codes) {
    if (!codes || !codes.length) return;
    parts.push(`
      <div class="card">
        <h2>${escapeHtml(title)} <span class="muted small">(${codes.length})</span></h2>
        <table class="assessment">
          <thead><tr><th>Code</th><th>Title</th><th>Units</th><th>Mode</th><th>AoL</th></tr></thead>
          <tbody>${codes.map(renderCourseRow).join("")}</tbody>
        </table>
      </div>
    `);
  }

  renderSection("Core courses", p.core);
  renderSection("Foundational courses", p.foundational_courses);
  renderSection("Flexible core", p.flexible_core);
  renderSection("Flexible core A", p.flexible_core_a);
  renderSection("Flexible core B", p.flexible_core_b);
  renderSection("Capstone", p.capstone);
  renderSection("Program electives", p.program_electives);
  renderSection("Research courses", p.research_courses);
  renderSection("Advanced courses", p.advanced_courses);
  renderSection("General pathway courses", p.general_pathway_courses);
  renderSection("Pathway prerequisites", p.pathway_prerequisites);

  if (p.majors && Object.keys(p.majors).length) {
    // Use contextual heading based on programme level
    const majorHeading = (p.level === "PG") ? "Fields / Specialisations" : "Majors";
    parts.push(`<h2>${majorHeading}</h2>`);
    for (const [major, codes] of Object.entries(p.majors)) {
      if (!codes.length) {
        parts.push(`
          <div class="card major-section">
            <h3>${escapeHtml(major)} <span class="muted small">(no courses listed)</span></h3>
            <p class="muted small"><em>Course list not available — see my.UQ for details.</em></p>
          </div>
        `);
      } else {
        parts.push(`
          <div class="card major-section">
            <h3>${escapeHtml(major)} <span class="muted small">(${codes.length})</span></h3>
            <table class="assessment">
              <thead><tr><th>Code</th><th>Title</th><th>Units</th><th>Mode</th></tr></thead>
              <tbody>${codes.map(renderCourseRow).join("")}</tbody>
            </table>
          </div>
        `);
      }
    }
  }

  if (p.electives && p.electives.length) {
    renderSection("Electives", p.electives);
  }

  $root.innerHTML = parts.join("");
}

// =========================================================================
// Theme toggle (Classic ⇄ Fun), shared across all pages
// =========================================================================
const THEMES = ["classic", "fun"];
const THEME_LABELS = { classic: "Classic", fun: "Fun" };
const THEME_ICONS = { classic: "◐", fun: "✦" };
const THEME_STORAGE_KEY = "uqbs-theme";

function getCurrentTheme() {
  const t = document.documentElement.getAttribute("data-theme");
  return THEMES.includes(t) ? t : "classic";
}

function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = "classic";
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (_) { /* ignore */ }
  updateThemeToggleLabel(theme);
}

function updateThemeToggleLabel(theme) {
  const $btn = document.getElementById("theme-toggle");
  if (!$btn) return;
  // Button shows the theme you'll switch TO, to make it obvious what happens
  const next = theme === "classic" ? "fun" : "classic";
  const $label = $btn.querySelector(".tt-label");
  const $icon = $btn.querySelector(".tt-icon");
  if ($label) $label.textContent = THEME_LABELS[next];
  if ($icon) $icon.textContent = THEME_ICONS[next];
  $btn.setAttribute("aria-pressed", theme === "fun" ? "true" : "false");
  $btn.title = `Switch to ${THEME_LABELS[next]} theme`;
}

// =========================================================================
// Page: AOL DASHBOARD (aol.html)
// =========================================================================
async function initAol() {
  const $root = document.getElementById("aol-root");
  try {
    const [manifest, taxonomy, aol] = await Promise.all([
      loadManifest(), loadTaxonomy(), loadAol()
    ]);
    STORE.allCourses = getAllCourses(manifest);
    STORE.taxonomy = taxonomy;
    STORE.aol = aol;
    renderAolDashboard($root, aol, taxonomy, STORE.allCourses);
  } catch (err) {
    $root.innerHTML = `<div class="error">Error: ${escapeHtml(err.message)}</div>`;
    console.error(err);
  }
}

function renderAolDashboard($root, aol, taxonomy, courses) {
  if (!aol || !aol.semesters || !Object.keys(aol.semesters).length) {
    $root.innerHTML = `
      <h1>Assurance of Learning Dashboard</h1>
      <div class="card"><p>No AoL data loaded. Add entries to <code>taxonomy/aol-template.csv</code> and run <code>python scraper/import_aol.py</code>.</p></div>
    `;
    return;
  }

  const coursesByCode = {};
  for (const c of courses) coursesByCode[c.course_code] = c;

  const parts = [];
  parts.push(`<h1>Assurance of Learning Dashboard</h1>`);

  // Summary stats across all semesters
  const allEntries = [];
  for (const [sem, data] of Object.entries(aol.semesters)) {
    for (const e of (data.entries || [])) {
      allEntries.push({ ...e, semester_code: sem, semester_label: data.label });
    }
  }

  const statusCounts = {};
  const gaCounts = {};
  const uniqueCourses = new Set();
  for (const e of allEntries) {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    gaCounts[e.ga] = (gaCounts[e.ga] || 0) + 1;
    uniqueCourses.add(e.course_code);
  }

  parts.push(`
    <div class="stat-bar">
      <div class="stat"><b>${allEntries.length}</b><span>AoL entries</span></div>
      <div class="stat"><b>${uniqueCourses.size}</b><span>courses with AoL</span></div>
      <div class="stat"><b>${Object.keys(aol.semesters).length}</b><span>semester${Object.keys(aol.semesters).length === 1 ? '' : 's'}</span></div>
    </div>
  `);

  // Status summary cards
  const statusOrder = ["tbd", "identified", "rubric_in_dev", "active", "established"];
  const statusCards = statusOrder.map(s => {
    const info = AOL_STATUS[s] || {};
    const count = statusCounts[s] || 0;
    return `<div class="aol-stat-card ${info.cls || ''}"><div class="aol-stat-icon">${info.icon || '?'}</div><div class="aol-stat-count">${count}</div><div class="aol-stat-label">${escapeHtml(info.label || s)}</div></div>`;
  }).join("");
  parts.push(`<div class="aol-status-summary">${statusCards}</div>`);

  // Per-semester sections
  for (const [sem, data] of Object.entries(aol.semesters).sort(([a],[b]) => b.localeCompare(a))) {
    const entries = data.entries || [];
    if (!entries.length) continue;

    // Group by programme (via taxonomy)
    const byProg = {};
    const noProg = [];
    for (const e of entries) {
      const progRoles = taxonomy && taxonomy.course_programs ? (taxonomy.course_programs[e.course_code] || []) : [];
      if (progRoles.length) {
        for (const r of progRoles) {
          byProg[r.program] = byProg[r.program] || [];
          byProg[r.program].push(e);
        }
      } else {
        noProg.push(e);
      }
    }

    parts.push(`<h2>${escapeHtml(data.label || sem)}</h2>`);

    // GA coverage heatmap for this semester
    const gaNames = aol._metadata?.graduate_attributes || {};
    const gas = ["GA1", "GA2", "GA3", "GA4", "GA5", "GA6"];
    const semGaCounts = {};
    for (const e of entries) {
      semGaCounts[e.ga] = (semGaCounts[e.ga] || 0) + 1;
    }
    const gaHeatRow = gas.map(g => {
      const n = semGaCounts[g] || 0;
      const label = gaNames[g] || g;
      const intensity = n === 0 ? "aol-heat-0" : n <= 2 ? "aol-heat-1" : n <= 4 ? "aol-heat-2" : "aol-heat-3";
      return `<td class="aol-heat ${intensity}" title="${escapeHtml(label)}: ${n} course${n === 1 ? '' : 's'}">${g}<br><b>${n}</b></td>`;
    }).join("");
    parts.push(`
      <div class="card">
        <h3 style="margin-top:0">GA Coverage</h3>
        <table class="aol-heatmap"><tr>${gaHeatRow}</tr></table>
      </div>
    `);

    // Full entry table for this semester
    const rows = entries.map(e => {
      const info = AOL_STATUS[e.status] || {};
      const c = coursesByCode[e.course_code];
      const courseLink = c ? `<a href="course.html?file=${encodeURIComponent(c.file)}">${escapeHtml(e.course_code)}</a>` : escapeHtml(e.course_code);
      const progRoles = taxonomy && taxonomy.course_programs ? (taxonomy.course_programs[e.course_code] || []) : [];
      const progChips = progRoles.slice(0, 2).map(r => `<span class="chip">${escapeHtml(r.program)}</span>`).join(" ");
      return `<tr>
        <td class="code">${courseLink}</td>
        <td>${c ? escapeHtml(c.course_title || '') : '<span class="muted">—</span>'}</td>
        <td>${aolGaChip(e.ga)}</td>
        <td>${escapeHtml(e.assessment_title)}</td>
        <td><span class="aol-chip ${info.cls || ''}">${info.icon || ''} ${escapeHtml(info.label || e.status)}</span></td>
        <td>${e.rubric_url ? `<a href="${escapeHtml(e.rubric_url)}" target="_blank" rel="noopener">Rubric ↗</a>` : ''}</td>
        <td>${progChips}</td>
      </tr>`;
    }).join("");

    parts.push(`
      <div class="card">
        <h3 style="margin-top:0">All AoL Entries</h3>
        <table class="assessment aol-table">
          <thead><tr><th>Code</th><th>Title</th><th>GA</th><th>Assessment</th><th>Status</th><th>Rubric</th><th>Programs</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  $root.innerHTML = parts.join("");
}

function initTheme() {
  // The inline <script> in <head> has already applied the data-theme attribute
  // for FOUC prevention. Here we just wire the toggle button.
  const current = getCurrentTheme();
  updateThemeToggleLabel(current);
  const $btn = document.getElementById("theme-toggle");
  if ($btn && !$btn.dataset.themeBound) {
    $btn.dataset.themeBound = "1";
    $btn.addEventListener("click", () => {
      const next = getCurrentTheme() === "classic" ? "fun" : "classic";
      applyTheme(next);
    });
  }
}

// Call theme init immediately once the script runs (DOM is ready because
// this script is at end of body), and also again inside each page-init in
// case the button is added dynamically.
if (typeof document !== "undefined") {
  initTheme();
}

// =========================================================================
// Colour-mode toggle (Auto ⇄ Light ⇄ Dark), independent of theme
// =========================================================================
const COLOR_MODES = ["auto", "light", "dark"];
const COLOR_MODE_LABELS = { auto: "Auto", light: "Light", dark: "Dark" };
const COLOR_MODE_ICONS = { auto: "☾", light: "☀", dark: "●" };
const COLOR_MODE_STORAGE_KEY = "uqbs-color-mode";

function getCurrentColorMode() {
  // The <head> FOUC script only sets the attribute when mode is light/dark;
  // "auto" is represented by the attribute being absent. Fall back to
  // localStorage so the button label stays accurate across pages.
  const attr = document.documentElement.getAttribute("data-color-mode");
  if (COLOR_MODES.includes(attr)) return attr;
  try {
    const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (COLOR_MODES.includes(stored)) return stored;
  } catch (_) { /* ignore */ }
  return "auto";
}

function applyColorMode(mode) {
  if (!COLOR_MODES.includes(mode)) mode = "auto";
  if (mode === "auto") {
    document.documentElement.removeAttribute("data-color-mode");
  } else {
    document.documentElement.setAttribute("data-color-mode", mode);
  }
  try { localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode); } catch (_) { /* ignore */ }
  updateColorModeToggleLabel(mode);
}

function updateColorModeToggleLabel(mode) {
  const $btn = document.getElementById("mode-toggle");
  if (!$btn) return;
  const $label = $btn.querySelector(".mt-label");
  const $icon = $btn.querySelector(".mt-icon");
  if ($label) $label.textContent = COLOR_MODE_LABELS[mode];
  if ($icon) $icon.textContent = COLOR_MODE_ICONS[mode];
  // Show the NEXT mode in the tooltip so users know what a click will do
  const nextIdx = (COLOR_MODES.indexOf(mode) + 1) % COLOR_MODES.length;
  const next = COLOR_MODES[nextIdx];
  $btn.title = `Colour mode: ${COLOR_MODE_LABELS[mode]} (click for ${COLOR_MODE_LABELS[next]})`;
  $btn.setAttribute("aria-label", `Colour mode: ${COLOR_MODE_LABELS[mode]}. Click to switch to ${COLOR_MODE_LABELS[next]}.`);
}

function initColorMode() {
  const current = getCurrentColorMode();
  // Don't re-apply if already set — avoids a flash on page load
  updateColorModeToggleLabel(current);
  const $btn = document.getElementById("mode-toggle");
  if ($btn && !$btn.dataset.modeBound) {
    $btn.dataset.modeBound = "1";
    $btn.addEventListener("click", () => {
      const cur = getCurrentColorMode();
      const idx = (COLOR_MODES.indexOf(cur) + 1) % COLOR_MODES.length;
      applyColorMode(COLOR_MODES[idx]);
    });
  }
}

if (typeof document !== "undefined") {
  initColorMode();
}

// =========================================================================
// Page: ALL-OF-UQ BROWSER (browse-all.html)
// =========================================================================
async function initAllBrowser() {
  const $body = document.getElementById("courses-body");
  const $count = document.getElementById("course-count");
  const $meta = document.getElementById("meta-info");
  try {
    const manifest = await loadManifestAll();
    const courses = getAllCourses(manifest);
    STORE.allCourses = courses;
    // No taxonomy or AoL for all-of-UQ view
    STORE.taxonomy = null;
    STORE.aol = null;
    $meta.innerHTML = `<span>Scrape generated</span> <b>${escapeHtml(fmtDate(manifest.generated_at))}</b> <span>· ${manifest.total_profiles} profiles</span>`;

    // Populate filter dropdowns
    populateSelect("filter-level", uniqueSorted(courses.map(c => c.study_level)));
    populateSelect("filter-mode", uniqueSorted(courses.map(c => c.attendance_mode)));
    populateSelect("filter-location", uniqueSorted(courses.map(c => c.location)));
    populateSelect("filter-school", uniqueSorted(courses.map(c => c.coordinating_unit)));

    // Populate semester filter and default to most recent
    const semCodes = uniqueSorted(courses.map(c => c.semester_code));
    const semOpts = semCodes.map(code => {
      const sample = courses.find(c => c.semester_code === code);
      return { value: code, label: sample ? semesterLabel(sample) : code };
    });
    populateSelect("filter-semester", semOpts);
    const $semFilter = document.getElementById("filter-semester");
    if ($semFilter && semCodes.length) {
      $semFilter.value = semCodes[semCodes.length - 1];
    }

    // Initial render
    STORE.sort = { key: "course_code", dir: "asc" };
    bindAllBrowserControls();
    renderAllBrowser();
  } catch (err) {
    $body.innerHTML = `<tr><td colspan="8" class="error">Error loading data: ${escapeHtml(err.message)}</td></tr>`;
    console.error(err);
  }
}

function bindAllBrowserControls() {
  for (const id of ["search", "filter-semester", "filter-level", "filter-mode", "filter-location", "filter-school"]) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", renderAllBrowser);
  }
  document.querySelectorAll("table.courses th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (STORE.sort.key === key) {
        STORE.sort.dir = STORE.sort.dir === "asc" ? "desc" : "asc";
      } else {
        STORE.sort = { key, dir: "asc" };
      }
      renderAllBrowser();
    });
  });
  // CSV export
  const $export = document.getElementById("export-csv");
  if ($export) $export.addEventListener("click", exportAllFilteredAsCsv);
  const $zipMd = document.getElementById("export-zip-md");
  if ($zipMd) $zipMd.addEventListener("click", () => exportFilteredAsZip("md"));
  const $zipJson = document.getElementById("export-zip-json");
  if ($zipJson) $zipJson.addEventListener("click", () => exportFilteredAsZip("json"));
}

function applyAllFilters(courses) {
  const q = (document.getElementById("search")?.value || "").trim().toLowerCase();
  const sem = document.getElementById("filter-semester")?.value;
  const level = document.getElementById("filter-level")?.value;
  const mode = document.getElementById("filter-mode")?.value;
  const loc = document.getElementById("filter-location")?.value;
  const school = document.getElementById("filter-school")?.value;

  return courses.filter(c => {
    if (q) {
      const hay = `${c.course_code} ${c.course_title || ""} ${c.coordinating_unit || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (sem && c.semester_code !== sem) return false;
    if (level && c.study_level !== level) return false;
    if (mode && c.attendance_mode !== mode) return false;
    if (loc && c.location !== loc) return false;
    if (school && c.coordinating_unit !== school) return false;
    return true;
  });
}

function renderAllBrowser() {
  const $body = document.getElementById("courses-body");
  const $count = document.getElementById("course-count");
  const courses = applySort(applyAllFilters(STORE.allCourses || []));
  $count.textContent = courses.length;

  if (courses.length === 0) {
    $body.innerHTML = `<tr><td colspan="8" class="empty">No courses match the current filters.</td></tr>`;
    updateSortIndicators();
    return;
  }

  const rows = courses.map(c => {
    const levelClass = (c.study_level || "").toLowerCase().includes("post") ? "level-pill pg" : "level-pill";
    const pfx = coursePrefix(c.course_code);
    const codeCls = pfx ? `code prefix-${pfx}` : "code";
    const semLabel = semesterLabel(c);
    const school = c.coordinating_unit || "";
    return `
      <tr>
        <td class="${codeCls}"><a href="course.html?file=${encodeURIComponent(c.file)}">${escapeHtml(c.course_code || "")}</a></td>
        <td>${escapeHtml(c.course_title || "")}</td>
        <td class="nowrap">${escapeHtml(semLabel)}</td>
        <td><span class="${levelClass}">${escapeHtml(c.study_level || "")}</span></td>
        <td>${escapeHtml(c.units || "")}</td>
        <td>${escapeHtml(c.attendance_mode || "")}</td>
        <td>${escapeHtml(c.location || "")}</td>
        <td class="school-col">${escapeHtml(school)}</td>
      </tr>`;
  }).join("");
  $body.innerHTML = rows;
  updateSortIndicators();
}

function exportAllFilteredAsCsv() {
  const courses = applySort(applyAllFilters(STORE.allCourses || []));
  if (!courses.length) return;
  const headers = ["course_code", "course_title", "semester_code", "study_level", "units", "attendance_mode", "location", "coordinating_unit"];
  const csvRows = [headers.join(",")];
  for (const c of courses) {
    const row = headers.map(h => {
      const v = c[h] ?? "";
      return `"${String(v).replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(","));
  }
  downloadBlob(csvRows.join("\n"), "uq-all-courses.csv", "text/csv;charset=utf-8");
}

// Export to window so inline <script> hooks can call them
window.UQBS = {
  initBrowser,
  initAllBrowser,
  initCourseDetail,
  initProgram,
  initAol,
  initTheme,
  applyTheme,
  initColorMode,
  applyColorMode,
};
