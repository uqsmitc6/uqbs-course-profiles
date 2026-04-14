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
};

const DATA_PATHS = {
  manifest: "./assets/manifest.json",
  taxonomy: "./taxonomy/uqbs-programs.json",
};

async function loadManifest() {
  if (STORE.manifest) return STORE.manifest;
  const res = await fetch(DATA_PATHS.manifest, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load manifest: ${res.status}`);
  STORE.manifest = await res.json();
  return STORE.manifest;
}

async function loadTaxonomy() {
  if (STORE.taxonomy) return STORE.taxonomy;
  const res = await fetch(DATA_PATHS.taxonomy, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load taxonomy: ${res.status}`);
  STORE.taxonomy = await res.json();
  return STORE.taxonomy;
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

// Extract the 4-letter faculty prefix from a course code (e.g. "MGTS1601" → "MGTS").
// Used for Fun-theme faculty-colour coding on table rows.
function coursePrefix(code) {
  if (!code) return "";
  const m = String(code).match(/^([A-Z]{3,4})/);
  return m ? m[1] : "";
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
      const code = lo.code || (lo.number != null ? `LO${lo.number}` : "");
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
      const lo = a.learning_outcomes_assessed != null ? a.learning_outcomes_assessed : a.learning_outcomes;
      if (lo) {
        const loStr = Array.isArray(lo) ? lo.join(", ") : String(lo);
        if (loStr) { lines.push(`**Linked LOs:** ${loStr}`); lines.push(""); }
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
      const code = lo.code || (lo.number != null ? `LO${lo.number}` : "");
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
      const lo = a.learning_outcomes_assessed != null ? a.learning_outcomes_assessed : a.learning_outcomes;
      if (lo) {
        const loStr = Array.isArray(lo) ? lo.join(", ") : String(lo);
        if (loStr) parts.push(`<p><b>Linked LOs:</b> ${esc(loStr)}</p>`);
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
  const json = JSON.stringify(c, null, 2);
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
    const [manifest, taxonomy] = await Promise.all([loadManifest(), loadTaxonomy().catch(() => null)]);
    const courses = getAllCourses(manifest);
    STORE.allCourses = courses;
    STORE.taxonomy = taxonomy;
    $meta.innerHTML = `<span>Scrape generated</span> <b>${escapeHtml(fmtDate(manifest.generated_at))}</b> <span>· ${manifest.total_profiles} profiles</span>`;

    // Populate filter dropdowns
    populateSelect("filter-level", uniqueSorted(courses.map(c => c.study_level)));
    populateSelect("filter-mode", uniqueSorted(courses.map(c => c.attendance_mode)));
    populateSelect("filter-location", uniqueSorted(courses.map(c => c.location)));
    if (taxonomy && taxonomy.programs) {
      const progOpts = Object.entries(taxonomy.programs).map(([k, v]) => ({ value: k, label: `${v.name} (${k})` }));
      populateSelect("filter-program", progOpts);
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
  for (const id of ["search", "filter-level", "filter-mode", "filter-location", "filter-program"]) {
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
          zip.file(`${safeFilename(full, "json")}`, JSON.stringify(full, null, 2));
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
  const level = document.getElementById("filter-level")?.value;
  const mode = document.getElementById("filter-mode")?.value;
  const loc = document.getElementById("filter-location")?.value;
  const prog = document.getElementById("filter-program")?.value;

  return courses.filter(c => {
    if (q) {
      const hay = `${c.course_code} ${c.course_title || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
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
    $body.innerHTML = `<tr><td colspan="7" class="empty">No courses match the current filters.</td></tr>`;
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
    return `
      <tr>
        <td class="${codeCls}"><a href="course.html?file=${encodeURIComponent(c.file)}">${escapeHtml(c.course_code || "")}</a></td>
        <td>${escapeHtml(c.course_title || "")}</td>
        <td><span class="${levelClass}">${escapeHtml(c.study_level || "")}</span></td>
        <td>${escapeHtml(c.units || "")}</td>
        <td>${escapeHtml(c.attendance_mode || "")}</td>
        <td>${escapeHtml(c.location || "")}</td>
        <td>${progChips}${more}</td>
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
    const [course, taxonomy] = await Promise.all([loadCourseJson(filePath), loadTaxonomy().catch(() => null)]);
    STORE.currentCourse = course;
    STORE.currentTaxonomy = taxonomy;
    renderCourseDetail($root, course, taxonomy);
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

function renderCourseDetail($root, c, taxonomy) {
  const roles = taxonomy ? programRolesFor(c.course_code, taxonomy) : [];
  const progChips = roles.map(r => {
    const isCore = (r.role || "").toLowerCase() === "core";
    const cls = isCore ? "chip role-core" : "chip";
    return `<span class="${cls}" title="${escapeHtml(r.role || "")}"><a href="program.html?program=${encodeURIComponent(r.program)}">${escapeHtml(r.program_name || r.program)}</a> · ${escapeHtml(r.role || "")}</span>`;
  }).join(" ");

  const parts = [];

  // Header card
  const filePath = getQueryParam("file");
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
          const code = lo.code || (lo.number != null ? `LO${lo.number}` : "");
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

  // Assessment summary
  if (c.assessment_summary && c.assessment_summary.length) {
    const rows = c.assessment_summary.map(a => `
      <tr>
        <td><b>${escapeHtml(a.title || "")}</b>
          ${a.conditions && a.conditions.length ? `<span class="conditions">${a.conditions.map(escapeHtml).join(" · ")}</span>` : ""}
        </td>
        <td class="nowrap">${escapeHtml(a.category || a.type || "")}</td>
        <td class="weight nowrap">${escapeHtml(a.weighting || a.weight || "")}</td>
        <td>${escapeHtml(a.due_date || a.due || "")}</td>
        <td>${a.learning_outcomes && a.learning_outcomes.length ? a.learning_outcomes.map(escapeHtml).join(", ") : ""}</td>
      </tr>
    `).join("");
    parts.push(`
      <div class="card">
        <h2>Assessment</h2>
        <table class="assessment">
          <thead><tr><th>Task</th><th>Category</th><th>Weight</th><th>Due</th><th>LOs</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  // Assessment details
  if (c.assessment_details && c.assessment_details.length) {
    parts.push(`
      <div class="card">
        <h2>Assessment details</h2>
        ${c.assessment_details.map(renderAssessmentDetail).join("")}
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

function renderAssessmentDetail(a) {
  const meta = [];
  if (a.weighting || a.weight) meta.push(`<b>Weight:</b> ${escapeHtml(a.weighting || a.weight)}`);
  if (a.due_date || a.due) meta.push(`<b>Due:</b> ${escapeHtml(a.due_date || a.due)}`);
  if (a.category || a.type) meta.push(`<b>Category:</b> ${escapeHtml(a.category || a.type)}`);
  if (a.mode) meta.push(`<b>Mode:</b> ${escapeHtml(a.mode)}`);
  if (a.other_conditions) meta.push(`<b>Conditions:</b> ${escapeHtml(a.other_conditions)}`);

  // Learning outcomes assessed — can be string ("L01, L02") or list
  const loField = a.learning_outcomes_assessed != null ? a.learning_outcomes_assessed : a.learning_outcomes;
  let loStr = "";
  if (Array.isArray(loField)) loStr = loField.map(x => String(x)).join(", ");
  else if (loField) loStr = String(loField);

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
      ${loStr ? `<div class="small muted">Linked LOs: ${escapeHtml(loStr)}</div>` : ""}
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
    const [manifest, taxonomy] = await Promise.all([loadManifest(), loadTaxonomy()]);
    const courses = getAllCourses(manifest);
    STORE.allCourses = courses;
    STORE.taxonomy = taxonomy;

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

  const items = Object.entries(taxonomy.programs).map(([key, p]) => {
    const mapped = Object.values(taxonomy.course_programs || {}).flat().filter(x => x.program === key);
    const scrapedCount = Object.entries(taxonomy.course_programs || {}).filter(([code, roles]) => {
      return roles.some(r => r.program === key) && coursesByCode[code];
    }).length;
    return `
      <a class="program-card" href="program.html?program=${encodeURIComponent(key)}" style="display:block">
        <div class="level">${escapeHtml(p.level || "")}</div>
        <h3>${escapeHtml(p.name || key)}</h3>
        <div class="muted small">${escapeHtml(key)}</div>
        <div class="count">${scrapedCount} course${scrapedCount === 1 ? "" : "s"} with scraped profile${scrapedCount === 1 ? "" : "s"}</div>
      </a>
    `;
  }).join("");

  $root.innerHTML = `
    <h1>Programs</h1>
    <p class="subtitle">${Object.keys(taxonomy.programs).length} UQBS programs. Click through to see core and majors.</p>
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
    if (c) {
      return `<tr>
        <td class="${codeCls}"><a href="course.html?file=${encodeURIComponent(c.file)}">${escapeHtml(code)}</a></td>
        <td>${escapeHtml(c.course_title || "")}</td>
        <td>${escapeHtml(c.units || "")}</td>
        <td>${escapeHtml(c.attendance_mode || "")}</td>
      </tr>`;
    }
    return `<tr>
      <td class="${codeCls} muted">${escapeHtml(code)}</td>
      <td class="muted"><em>not in current scrape</em></td>
      <td></td><td></td>
    </tr>`;
  }

  const parts = [`
    <a href="program.html" class="small">← All programs</a>
    <h1 style="margin-top:8px">${escapeHtml(p.name)}</h1>
    <p class="subtitle">${escapeHtml(progKey)} · ${escapeHtml(p.level || "")}</p>
  `];

  if (p.core && p.core.length) {
    parts.push(`
      <div class="card">
        <h2>Core courses <span class="muted small">(${p.core.length})</span></h2>
        <table class="assessment">
          <thead><tr><th>Code</th><th>Title</th><th>Units</th><th>Mode</th></tr></thead>
          <tbody>${p.core.map(renderCourseRow).join("")}</tbody>
        </table>
      </div>
    `);
  }

  if (p.majors && Object.keys(p.majors).length) {
    parts.push(`<h2>Majors</h2>`);
    for (const [major, codes] of Object.entries(p.majors)) {
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

  if (p.electives && p.electives.length) {
    parts.push(`
      <div class="card">
        <h2>Electives <span class="muted small">(${p.electives.length})</span></h2>
        <table class="assessment">
          <thead><tr><th>Code</th><th>Title</th><th>Units</th><th>Mode</th></tr></thead>
          <tbody>${p.electives.map(renderCourseRow).join("")}</tbody>
        </table>
      </div>
    `);
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

// Export to window so inline <script> hooks can call them
window.UQBS = {
  initBrowser,
  initCourseDetail,
  initProgram,
  initTheme,
  applyTheme,
};
