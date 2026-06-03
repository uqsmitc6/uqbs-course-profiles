/* jac_extract.js — Pull assessment-to-LO (and activity-to-LO) mappings from UQ's
 * Jac curriculum system (curriculum.uq.edu.au) via its internal API.
 *
 * WHY: UQ's published ECP (course-profiles.uq.edu.au, the scraper's source) has a
 * Drupal bug that drops the LO-to-assessment mapping — sometimes wholly, sometimes
 * partially. The authoritative mapping lives in Jac. This snippet recovers it.
 *
 * HOW TO RUN
 *   1. Log in to https://curriculum.uq.edu.au/cms/classes in Chrome.
 *   2. Open DevTools → Console (must be on a curriculum.uq.edu.au page so the
 *      same-origin API + bearer token are available).
 *   3. Paste this whole file, then call one of:
 *        await jacExtract(["BISM2207","ACCT3101"])             // by year+period (default S1 2026)
 *        await jacExtract(["MGTS7812"], {year:2026, period:1}) // explicit semester
 *        await jacExtract({"BISM2207":["20304"]})              // by SI-NET class number (most precise)
 *      Returns { CODE: [ { classNumber, year, period, mode, state, cvid, classId,
 *                          assess:[{title,los}], activity:[{title,los}] } ] }
 *      (one entry per matched instance) and console.logs a JSON blob to copy out.
 *
 * WHY MATCH BY CLASS NUMBER (the MBA / teaching-period case)
 *   Most courses run one instance per semester. But some — notably **MBA courses
 *   (MGTSxxxx)** — run multiple offerings in the same semester (weekend, intensive,
 *   different teaching periods) with DIFFERENT assessments. They also don't always
 *   map cleanly onto a single semester "period" code. The bulletproof way to tie a
 *   Jac instance to a specific scraped class is the **SI-NET class number** (the
 *   middle number in our profile filenames, e.g. BISM2207-`20304`-7620). Pass a
 *   { code: [classNumber, …] } map to match exactly and avoid picking the wrong
 *   offering. Year+period matching is the convenient fallback when there's only one.
 *
 * KEY FACTS (reverse-engineered 2026-06-03)
 *   - Auth: the Jac SPA stores a JWT in localStorage['token']; send as Bearer.
 *           (Used in your own logged-in session only.)
 *   - Search:  POST /api/v1/classes/get-resources  { courseCode, pageSize:100, … }
 *              → { items:[{ classId, curriculumVersionId, fromYYYYSS, stateName, metadataValues }] }
 *   - Instance metadata lives in item.metadataValues, keyed by metadataClassConfigId:
 *              5 = SI-NET course id, 6 = SI-NET class number, 7 = year, 8 = period,
 *              9 = availability {key,value}, 10 = mode {key,value}, 11/12 = start/end.
 *              (fromYYYYSS = year*100 + period, e.g. 202601 = 2026 period 1.)
 *   - Mapping:  GET /api/v1/curriculums/v2/{curriculumVersionId}/components
 *              → 487-item form-builder array. The two mapping matrices sit in a
 *              component whose changeTracking[last].value parses to
 *              { headings:[{title:"N. …"}], rows:[{subformInstanceTitle, cells:[{active}]}] }.
 *              A cell is mapped iff cell.active; column i = heading i = LO(i+1).
 *              First matrix (lower component index) = Assessment, second = Activity.
 *              (curriculum-mappings/{id} and entity-references/{id}/links return [] — wrong endpoint.)
 */

async function jacExtract(codesOrMap, opts = {}) {
  const { year = 2026, period = 1 } = opts;
  // Normalise input: array of codes, or { code: [classNumber, …] }
  const byClassNumber = !Array.isArray(codesOrMap);
  const codes = byClassNumber ? Object.keys(codesOrMap) : codesOrMap;
  const wantedNums = byClassNumber ? codesOrMap : null;

  const t = localStorage.getItem('token');
  const H = { 'Accept': 'application/json', 'Authorization': 'Bearer ' + t };
  const searchBody = (c) => ({
    searchParam: "", states: [], withoutClassOutlineOnly: false, userWorkFlowIds: [],
    courseCode: c, coordinatedByCurrentUser: false, organisationId: 0, excludeIds: [],
    years: [], metadataFilter: null, includeChildOrgs: true, includeOperations: true,
    initiateReviewMode: false, updatedByCurrentUser: false, recentItemsOnly: false,
    baseTemplateId: null, orderByColumn: "editDate", orderDirection: "desc",
    pageIndex: 0, pageSize: 100, generateCSV: false, excludeVet: false,
  });
  const meta = (item, cfgId) => {
    const m = (item.metadataValues || []).find(x => x.metadataClassConfigId === cfgId);
    return m ? m.value : null;
  };
  const latestValue = (item) => {
    const ct = item && item.changeTracking;
    if (!ct || !ct.length) return null;
    try { return JSON.parse(ct[ct.length - 1].value); } catch (e) { return null; }
  };
  const isMatrix = (v) => v && Array.isArray(v.headings) && Array.isArray(v.rows)
    && v.rows[0] && Array.isArray(v.rows[0].cells);
  const parseMatrix = (v) => {
    const lo = v.headings.map(h => { const m = (h.title || '').match(/^(\d+)\./); return m ? 'LO' + m[1] : null; });
    return v.rows.filter(r => !r.deleted).map(r => {
      const title = (r.subformInstanceTitle || r.title || '').replace(/\s*-\s*$/, '').replace(/^\d+\s*-\s*/, '').trim();
      const los = [];
      (r.cells || []).forEach((c, i) => { if (c && c.active && lo[i]) los.push(lo[i]); });
      return { title, los };
    });
  };

  const out = {};
  for (const code of codes) {
    out[code] = [];
    try {
      const j = await (await fetch('/api/v1/classes/get-resources', {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(searchBody(code)),
      })).json();
      let cands = (j.items || []);
      if (byClassNumber) {
        const want = new Set((wantedNums[code] || []).map(String));
        cands = cands.filter(it => want.has(String(meta(it, 6))));
      } else {
        cands = cands.filter(it => String(meta(it, 7)) === String(year) && String(meta(it, 8)) === String(period));
        // Prefer Published if multiple. Still returns all matches.
        cands.sort((a, b) => (b.stateName === 'Published') - (a.stateName === 'Published'));
      }
      if (!cands.length) { out[code] = [{ err: 'no matching instance' }]; continue; }
      for (const pick of cands) {
        const comp = await (await fetch('/api/v1/curriculums/v2/' + pick.curriculumVersionId + '/components',
          { headers: H, credentials: 'include' })).json();
        const matrices = [];
        comp.forEach((sf, si) => (sf.items || []).forEach(it => {
          const v = latestValue(it);
          if (isMatrix(v)) matrices.push({ si, header: (sf.subformHeader || it.label || '') + '', rows: parseMatrix(v) });
        }));
        matrices.sort((a, b) => a.si - b.si);
        let mode = meta(pick, 10); try { mode = JSON.parse(mode).value; } catch (e) {}
        out[code].push({
          classNumber: meta(pick, 6), year: meta(pick, 7), period: meta(pick, 8), mode,
          state: pick.stateName, cvid: pick.curriculumVersionId, classId: pick.classId,
          assess: matrices[0] ? matrices[0].rows : [],
          activity: matrices[1] ? matrices[1].rows : [],
        });
        await new Promise(r => setTimeout(r, 40));
      }
    } catch (e) { out[code] = [{ err: String(e) }]; }
  }
  console.log('JACEXTRACT::' + JSON.stringify(out));
  return out;
}
