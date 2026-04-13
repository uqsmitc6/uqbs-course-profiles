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
    return `
      <tr>
        <td class="code"><a href="course.html?file=${encodeURIComponent(c.file)}">${escapeHtml(c.course_code || "")}</a></td>
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
    renderCourseDetail($root, course, taxonomy);
    document.title = `${course.course_code} — ${course.course_title}`;
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

  // Overview
  const overviewRows = [
    ["Study period", c.study_period],
    ["Coordinating unit", c.coordinating_unit],
    ["Administrative campus", c.administrative_campus],
    ["Scraped", fmtDate(c.scraped_at)],
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

  // Requirements
  if (c.requirements) {
    parts.push(`
      <div class="card">
        <h2>Requirements</h2>
        <div>${renderLongText(c.requirements)}</div>
      </div>
    `);
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
        ${c.learning_outcomes.map(lo => `
          <div class="lo-item">
            <div class="lo-code">${escapeHtml(lo.code || "")}</div>
            <div>${escapeHtml(lo.description || "")}</div>
          </div>
        `).join("")}
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

  // Learning activities
  if (c.learning_activities) {
    parts.push(`
      <div class="card">
        <h2>Learning activities</h2>
        <div>${renderLongText(c.learning_activities)}</div>
      </div>
    `);
  }

  // Learning resources
  if (c.learning_resources) {
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

  const sections = [];
  for (const [key, label] of [
    ["task_description", "Task description"],
    ["task", "Task"],
    ["submission_guidelines", "Submission guidelines"],
    ["deferral_or_extension", "Deferral or extension"],
    ["late_submission", "Late submission"],
    ["marking_criteria", "Marking criteria"],
  ]) {
    if (a[key]) sections.push(`<h4>${label}</h4>${renderLongText(a[key])}`);
  }

  return `
    <div class="assessment-detail">
      <h4>${escapeHtml(a.title || a.name || "Assessment")}</h4>
      ${meta.length ? `<div class="a-meta">${meta.join(" · ")}</div>` : ""}
      ${a.learning_outcomes && a.learning_outcomes.length
        ? `<div class="small muted">Linked LOs: ${a.learning_outcomes.map(escapeHtml).join(", ")}</div>` : ""}
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
    if (c) {
      return `<tr>
        <td class="code"><a href="course.html?file=${encodeURIComponent(c.file)}">${escapeHtml(code)}</a></td>
        <td>${escapeHtml(c.course_title || "")}</td>
        <td>${escapeHtml(c.units || "")}</td>
        <td>${escapeHtml(c.attendance_mode || "")}</td>
      </tr>`;
    }
    return `<tr>
      <td class="code muted">${escapeHtml(code)}</td>
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

// Export to window so inline <script> hooks can call them
window.UQBS = {
  initBrowser,
  initCourseDetail,
  initProgram,
};
