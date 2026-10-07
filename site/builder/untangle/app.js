import { readWorkbook } from "./xlsx.js";
import { buildModel, fmtValue, fmtNum, addr, numToCol, rangeText } from "./model.js";
import { print } from "./formula.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const track = (e) => { try { window.UTAnalytics && window.UTAnalytics.track(e); } catch (_) { /* never break the app */ } };

const S = { model: null, view: "map", sheet: null, sel: null, hi: null, fileName: "" };
window.__untangle = S; // for tests

// ---------------- loading ----------------

const fileInput = $("#file");
const drop = $("#drop");
fileInput.addEventListener("change", () => { if (fileInput.files[0]) openFile(fileInput.files[0]); fileInput.value = ""; });
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
for (const ev of ["dragenter", "dragover"]) document.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); });
for (const ev of ["dragleave", "drop"]) document.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "drop" || e.target === document.documentElement) drop.classList.remove("over"); });
document.addEventListener("drop", (e) => {
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) openFile(f);
});
$("#trySample").addEventListener("click", () => openSample());
$("#openAnother").addEventListener("click", () => fileInput.click());

async function openSample() {
  progress("Opening the sample workbook…");
  try {
    const res = await fetch("samples/northwind-plan.xlsx");
    if (!res.ok) throw new Error("Couldn't download the sample.");
    track("sample-opened");
    await load(await res.arrayBuffer(), "northwind-plan.xlsx (sample)");
    if (location.hash !== "#sample") history.replaceState(null, "", "#sample");
  } catch (e) { fail(e); }
}

async function openFile(file) {
  if (!/\.(xlsx|xlsm|xltx|xltm)$/i.test(file.name) && !/spreadsheetml/.test(file.type)) {
    if (/\.xls$/i.test(file.name)) return fail(new Error("That's an old-style .xls file. In Excel choose File › Save As › Excel Workbook (.xlsx), then drop the new file here."));
    if (/\.(csv|ods|numbers)$/i.test(file.name)) return fail(new Error("Untangle reads Excel .xlsx files. CSV files have no formulas to map; for .ods or .numbers, export to .xlsx first."));
  }
  progress(`Reading ${file.name}…`);
  try {
    const buf = await file.arrayBuffer();
    track("file-opened");
    await load(buf, file.name);
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  } catch (e) { fail(e); }
}

function progress(msg) {
  const p = $("#loadProgress");
  $("#loadError").hidden = true;
  p.hidden = false; p.textContent = msg;
}
function fail(e) {
  console.warn(e);
  const el = $("#loadError");
  $("#loadProgress").hidden = true;
  showLanding();
  el.hidden = false;
  el.textContent = e && e.message ? e.message : "Something went wrong reading that file.";
}

async function load(buf, name) {
  const t0 = performance.now();
  const wb = await readWorkbook(buf, progress);
  progress("Tracing every formula…");
  await new Promise((r) => setTimeout(r, 20));
  const model = buildModel(wb);
  model.stats.totalMs = Math.round(performance.now() - t0);
  S.model = model; S.fileName = name; S.sel = null; S.hi = null; S.sheet = null;
  $("#loadProgress").hidden = true;
  $("#landing").hidden = true;
  $("#app").hidden = false;
  $("#fileBar").hidden = false;
  $("#fileName").textContent = name;
  setTopH();
  document.title = `${name} · Untangle`;
  renderSummary();
  renderSheetTabs();
  setView("map");
  renderInspector();
  window.scrollTo(0, 0);
}

function showLanding() {
  $("#landing").hidden = false;
  $("#app").hidden = true;
  $("#fileBar").hidden = true;
}

// ---------------- summary + tabs ----------------

function renderSummary() {
  const { stats, sheets, notes } = S.model;
  const visible = sheets.length - stats.hiddenSheets;
  const ratio = stats.formulas ? Math.max(1, Math.round(stats.formulas / Math.max(1, stats.blocks))) : 0;
  $("#summary").innerHTML = `
    <div class="stat"><b>${stats.sheets}</b><span>sheet${stats.sheets === 1 ? "" : "s"}${stats.hiddenSheets ? ` <em>(${stats.hiddenSheets} hidden)</em>` : ""}</span></div>
    <div class="stat"><b>${fmtNum(stats.formulas)}</b><span>formulas</span></div>
    <div class="stat"><b>${fmtNum(stats.blocks)}</b><span>distinct formula blocks${ratio > 1 ? ` <em>(÷${ratio})</em>` : ""}</span></div>
    <div class="stat"><b>${fmtNum(stats.inputs)}</b><span>inputs feed them</span></div>
    <div class="stat ${stats.high ? "bad" : stats.issues ? "warn" : "ok"}"><b>${stats.issues}</b><span>${stats.high ? `things look wrong <em>(${stats.high} likely mistakes)</em>` : stats.issues ? "things to check" : "no problems found"}</span></div>
    <div class="stat time"><span>Mapped in ${stats.totalMs < 1000 ? stats.totalMs + " ms" : (stats.totalMs / 1000).toFixed(1) + " s"}, on your device</span></div>
    ${notes.length ? `<div class="notes">${notes.map((n) => `<p>ⓘ ${esc(n)}</p>`).join("")}</div>` : ""}
    ${visible === 0 ? "" : ""}`;
  $("#issueCount").textContent = stats.issues || "";
  $("#inputCount").textContent = stats.inputs || "";
}

function renderSheetTabs() {
  const el = $("#sheetTabs");
  el.innerHTML = S.model.sheets.filter((s) => s.kind === "sheet").map((s) => {
    const n = S.model.issues.filter((i) => i.sheet === s.index && i.severity !== "info").length;
    return `<button role="tab" data-view="sheet" data-sheet="${s.index}" class="${s.state !== "visible" ? "hidden-sheet" : ""}">${esc(s.name)}${n ? ` <span class="dot" title="${n} issue${n > 1 ? "s" : ""}"></span>` : ""}</button>`;
  }).join("");
}

document.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-view]");
  if (!b) return;
  if (b.dataset.view === "sheet") openSheet(+b.dataset.sheet);
  else setView(b.dataset.view);
});

function setView(v, sheet = null) {
  S.view = v;
  if (v === "sheet") S.sheet = sheet;
  for (const b of document.querySelectorAll(".tabs button[data-view]")) {
    const on = b.dataset.view === v && (v !== "sheet" || +b.dataset.sheet === sheet);
    b.setAttribute("aria-selected", on ? "true" : "false");
  }
  if (v === "map") renderMap();
  else if (v === "issues") renderIssues();
  else if (v === "inputs") renderInputs();
  else if (v === "sheet") renderSheet(sheet);
}

function openSheet(i) { setView("sheet", i); }

// ---------------- map ----------------

function renderMap() {
  const m = S.model;
  const sheets = m.sheets.filter((s) => s.kind === "sheet" || s.kind === "chart");
  const W = 196, H = 112;
  const layers = new Map();
  for (const s of sheets) { if (!layers.has(s.layer)) layers.set(s.layer, []); layers.get(s.layer).push(s); }
  const layerKeys = [...layers.keys()].sort((a, b) => a - b);
  const colOf = new Map(layerKeys.map((l, i) => [l, i]));
  const maxPer = Math.max(...[...layers.values()].map((x) => x.length));
  const avail = Math.max(280, ($("#stage").clientWidth || 900) - 38);
  const hWidth = 48 + layerKeys.length * W + (layerKeys.length - 1) * 64;
  // Wide screens: left to right. Narrow ones: top to bottom, so nothing hides off-screen.
  const vertical = hWidth * 0.8 > avail && layerKeys.length > 1;
  const GX = vertical ? 22 : 64, GY = vertical ? 64 : 30;
  const pos = new Map();
  for (const l of layerKeys) {
    const list = layers.get(l);
    list.sort((a, b) => bary(a) - bary(b) || a.index - b.index);
    const off = (maxPer - list.length) * ((vertical ? W + GX : H + GY)) / 2;
    list.forEach((s, i) => pos.set(s.index, vertical
      ? { x: 24 + off + i * (W + GX), y: 24 + colOf.get(l) * (H + GY) }
      : { x: 24 + colOf.get(l) * (W + GX), y: 24 + off + i * (H + GY) }));
  }
  function bary(s) {
    const ins = m.sheetLinks.filter((x) => x.to === s.index && pos.has(x.from));
    if (!ins.length) return s.index;
    const k = vertical ? "x" : "y";
    return ins.reduce((t, x) => t + pos.get(x.from)[k] * x.n, 0) / ins.reduce((t, x) => t + x.n, 0);
  }
  const width = vertical ? 48 + maxPer * W + (maxPer - 1) * GX + 60 : hWidth;
  const height = vertical ? 48 + layerKeys.length * H + (layerKeys.length - 1) * GY : 48 + maxPer * H + (maxPer - 1) * GY;
  const scale = Math.min(1, avail / width);
  const maxN = Math.max(1, ...m.sheetLinks.map((l) => l.n));

  let edges = "";
  for (const l of m.sheetLinks) {
    const a = pos.get(l.from), b = pos.get(l.to);
    if (!a || !b || l.from === l.to) continue;
    const w = 1.4 + 5 * Math.sqrt(l.n / maxN);
    let d;
    if (vertical) {
      if (b.y > a.y) {
        const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y - 8, my = (y1 + y2) / 2;
        d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
      } else {
        const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x + W + 6, y2 = b.y + H / 2, out = Math.max(x1, x2) + 50;
        d = `M${x1},${y1} C${out},${y1} ${out},${y2} ${x2},${y2}`;
      }
    } else if (b.x > a.x) {
      const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x - 8, y2 = b.y + H / 2, mx = (x1 + x2) / 2;
      d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    } else {
      // Backwards or same column: loop around below.
      const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y + H + 6, dip = Math.max(y1, y2) + 46;
      d = `M${x1},${y1} C${x1},${dip} ${x2},${dip} ${x2},${y2}`;
    }
    edges += `<path class="edge" data-from="${l.from}" data-to="${l.to}" d="${d}" stroke-width="${w.toFixed(1)}" marker-end="url(#arrow)"><title>${esc(m.sheets[l.from].name)} → ${esc(m.sheets[l.to].name)}: ${l.n} reference${l.n > 1 ? "s" : ""}</title></path>`;
  }
  let nodes = "";
  for (const s of sheets) {
    const p = pos.get(s.index);
    const c = s.counts || { input: 0, calc: 0, output: 0, data: 0, label: 0 };
    const tot = c.input + c.calc + c.output + c.data || 1;
    const bw = W - 28;
    let x = 14;
    const seg = (n, cls) => { const w = (n / tot) * bw; const r = w > 0.5 ? `<rect x="${x.toFixed(1)}" y="${H - 22}" width="${w.toFixed(1)}" height="8" class="${cls}"/>` : ""; x += w; return r; };
    const bar = seg(c.input, "r-input") + seg(c.calc, "r-calc") + seg(c.output, "r-output") + seg(c.data, "r-data");
    const iss = m.issues.filter((i) => i.sheet === s.index && i.severity !== "info");
    const high = iss.some((i) => i.severity === "high");
    const nb = m.blocks.filter((b) => b.sheet === s.index).length;
    const role = !s.formulaCount ? (c.input ? "inputs" : "data") : c.output > c.calc ? "results" : "calculations";
    nodes += `<g class="node ${s.state !== "visible" ? "is-hidden" : ""}" data-sheet="${s.index}" transform="translate(${p.x},${p.y})" tabindex="0" role="button" aria-label="Open sheet ${esc(s.name)}">
      <rect class="card" width="${W}" height="${H}" rx="12"/>
      <text x="14" y="26" class="n-name">${esc(trim(s.name, 22))}</text>
      ${s.state !== "visible" ? `<text x="14" y="44" class="n-hidden">${s.state === "veryHidden" ? "very hidden" : "hidden"} sheet</text>` : `<text x="14" y="44" class="n-role">${role}</text>`}
      <text x="14" y="66" class="n-meta">${s.kind === "chart" ? "chart sheet" : s.formulaCount ? `${fmtNum(s.formulaCount)} formula${s.formulaCount > 1 ? "s" : ""} · ${nb} block${nb === 1 ? "" : "s"}` : `${fmtNum(s.cells ? s.cells.size : 0)} cells, no formulas`}</text>
      ${c.input ? `<text x="14" y="82" class="n-meta">${c.input} input${c.input > 1 ? "s" : ""} used elsewhere</text>` : ""}
      ${bar}
      ${iss.length ? `<g transform="translate(${W - 18},18)"><circle r="12" class="${high ? "b-high" : "b-med"}"/><text y="4.5" text-anchor="middle" class="b-txt">${iss.length}</text></g>` : ""}
    </g>`;
  }
  const inputsHome = topBy(m.inputs.map((i) => i.sheet));
  const outputSheets = m.sheets.filter((s) => s.counts && s.counts.output).sort((a, b) => b.layer - a.layer || b.counts.output - a.counts.output);
  $("#stage").innerHTML = `
    <div class="map-wrap">
      <div class="map-head">
        <h2>How the sheets feed each other</h2>
        <p>Numbers flow ${vertical ? "down" : "left to right"} along the arrows; thicker means more references. Click a sheet to open it.</p>
      </div>
      <div class="map-scroll"><svg class="map" viewBox="0 0 ${width} ${height + 50}" width="${Math.round(width * scale)}" height="${Math.round((height + 50) * scale)}" role="img" aria-label="Sheet dependency map">
        <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>
        ${edges}${nodes}
      </svg></div>
      <div class="legend"><span><i class="k-input"></i>inputs (typed numbers that formulas use)</span><span><i class="k-calc"></i>calculations</span><span><i class="k-output"></i>results (nothing else uses them)</span><span><i class="k-data"></i>other data</span></div>
    </div>
    <div class="overview">
      <div class="ov-card">
        <h3>Where are the inputs?</h3>
        <p class="ov-sub">${m.inputs.length ? `${m.inputs.length} typed values feed the formulas${inputsHome != null ? `, mostly on <b>${esc(m.sheets[inputsHome].name)}</b>` : ""}. The ones that reach furthest:` : "No typed values feed the formulas."}</p>
        <ol class="mini">${m.inputs.slice(0, 5).map(inputRow).join("")}</ol>
        ${m.inputs.length > 5 ? `<button class="more" data-goto="inputs">All ${m.inputs.length} inputs →</button>` : ""}
      </div>
      <div class="ov-card">
        <h3>What looks wrong?</h3>
        ${m.issues.filter((i) => i.severity !== "info").length ? `<ol class="mini issues-mini">${m.issues.filter((i) => i.severity !== "info").slice(0, 5).map((i) => `<li><button class="row-btn" data-issue="${i.id}"><span class="sev ${i.severity}"></span><span>${esc(i.title)}</span></button></li>`).join("")}</ol>
        ${m.stats.issues > 5 ? `<button class="more" data-goto="issues">All ${m.stats.issues} issues →</button>` : `<button class="more" data-goto="issues">Explain these →</button>`}` : `<p class="ov-sub">Nothing obviously wrong. Untangle checks for the common mistakes; it can't know what the numbers are meant to be.</p>`}
      </div>
      <div class="ov-card">
        <h3>Where does it end?</h3>
        <p class="ov-sub">${outputSheets.length ? "Results that nothing else uses, the likely “answers” of the workbook:" : "No final results found."}</p>
        <ol class="mini">${outputSheets.slice(0, 2).flatMap((s) => m.formulas.filter((f) => f.sheet === s.index && f.cell.role === "output").slice(0, 4)).slice(0, 5).map((f) => `<li><button class="row-btn" data-cell="${f.sheet},${f.c},${f.r}"><span class="lbl">${esc(m.labelText(f.sheet, f.c, f.r) || addr(f.c, f.r))}</span><span class="val">${esc(fmtValue(f.cell))}</span><span class="where">${esc(m.sheets[f.sheet].name)}!${addr(f.c, f.r)}</span></button></li>`).join("")}</ol>
      </div>
    </div>`;
  const svg = $("#stage svg.map");
  svg.addEventListener("click", (e) => { const g = e.target.closest(".node"); if (g) openSheet(+g.dataset.sheet); });
  svg.addEventListener("keydown", (e) => { const g = e.target.closest(".node"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openSheet(+g.dataset.sheet); } });
  svg.addEventListener("mouseover", (e) => {
    const g = e.target.closest(".node");
    svg.classList.toggle("focusing", !!g);
    for (const p of svg.querySelectorAll(".edge")) p.classList.toggle("lit", !!g && (p.dataset.from === g.dataset.sheet || p.dataset.to === g.dataset.sheet));
  });
}

function inputRow(i) {
  const m = S.model;
  const lbl = i.label || m.labelText(i.sheet, i.c, i.r) || "unlabelled";
  return `<li><button class="row-btn" data-cell="${i.sheet},${i.c},${i.r}"><span class="lbl">${esc(lbl)}</span><span class="val">${esc(fmtValue(i.cell))}</span><span class="where">${esc(m.sheets[i.sheet].name)}!${addr(i.c, i.r)} · drives ${fmtNum(i.reach)} cell${i.reach === 1 ? "" : "s"}</span></button></li>`;
}

function topBy(arr) {
  const c = new Map();
  for (const x of arr) c.set(x, (c.get(x) || 0) + 1);
  let best = null, n = 0;
  for (const [k, v] of c) if (v > n) { best = k; n = v; }
  return best;
}

function bindRowButtons(root) {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cell],[data-issue],[data-goto],[data-sheet-open]");
    if (!b || !root.contains(b)) return;
    if (b.dataset.goto) { setView(b.dataset.goto); window.scrollTo({ top: $("#app").offsetTop - 8, behavior: "smooth" }); return; }
    if (b.dataset.sheetOpen) { openSheet(+b.dataset.sheetOpen); return; }
    if (b.dataset.issue) {
      const i = S.model.issues[+b.dataset.issue];
      track("issue-opened");
      selectCell(i.sheet, i.c, i.r, { issue: i });
      return;
    }
    const [s, c, r] = b.dataset.cell.split(",").map(Number);
    selectCell(s, c, r);
  });
}

// ---------------- issues + inputs ----------------

const ISSUE_INFO = {
  override: "Typed over a formula", inconsistent: "Breaks the pattern", "short-range": "Range stops short", "ref-error": "Broken reference",
  error: "Error value", circular: "Circular reference", hardcoded: "Number inside a formula", "unused-input": "Unused assumption",
  "empty-ref": "Reads an empty cell", untraceable: "Hidden data source", external: "Link to another file", "unknown-name": "Unknown name", hidden: "Hidden sheet",
};

function renderIssues() {
  const m = S.model;
  const groups = [["high", "Likely mistakes", "These usually mean a number is wrong."], ["medium", "Worth checking", "Risky habits that make the next mistake likely."], ["info", "For your information", ""]];
  $("#stage").innerHTML = `<div class="list-wrap">
    <h2>What looks wrong</h2>
    <p class="list-sub">Untangle checks every formula for the patterns behind most real spreadsheet errors. Each finding points to exact cells. Click one to see it in place.</p>
    ${m.issues.length ? groups.map(([sev, title, sub]) => {
      const list = m.issues.filter((i) => i.severity === sev);
      if (!list.length) return "";
      return `<h3 class="grp"><span class="sev ${sev}"></span>${title} <span class="count">${list.length}</span></h3>${sub ? `<p class="grp-sub">${sub}</p>` : ""}
        <div class="cards">${list.map((i) => `<button class="issue" data-issue="${i.id}">
          <span class="kind">${esc(ISSUE_INFO[i.type] || i.type)}</span>
          <span class="title">${esc(i.title)}</span>
          <span class="detail">${esc(i.detail)}</span>
          <span class="loc">${esc(m.sheets[i.sheet].name)}!${addr(i.c, i.r)} →</span>
        </button>`).join("")}</div>`;
    }).join("") : `<p class="empty">No problems found. That doesn't prove the numbers are right, only that none of the common error patterns appear.</p>`}
    <details class="checks"><summary>What Untangle checks</summary>
      <ul>
        <li><b>Typed over a formula:</b> a number in the middle of a row or column of copied formulas.</li>
        <li><b>Breaks the pattern:</b> a formula that differs from the copies on both sides of it.</li>
        <li><b>Range stops short:</b> a SUM/AVERAGE/… whose range ends one cell before more of the same list.</li>
        <li><b>Number inside a formula:</b> business constants like =B4*0.22 (0, 1, years and units like 12 or 100 are ignored).</li>
        <li><b>Unused assumption:</b> a labelled number in a list of inputs that no formula reads.</li>
        <li><b>Broken references, error values, circular references, empty cells, INDIRECT/OFFSET, links to other files, unknown names, hidden sheets.</b></li>
      </ul>
    </details>
  </div>`;
}

function renderInputs() {
  const m = S.model;
  $("#stage").innerHTML = `<div class="list-wrap">
    <h2>The numbers this workbook rests on</h2>
    <p class="list-sub">Every typed value that a formula uses, ranked by how many cells it ends up driving. Change one of the top ones and much of the workbook moves.</p>
    <ol class="inputs-list">${m.inputs.map((i) => {
      const pct = m.formulas.length ? Math.round((i.reach / m.formulas.length) * 100) : 0;
      return `<li><button class="row-btn" data-cell="${i.sheet},${i.c},${i.r}">
        <span class="lbl">${esc(i.label || "unlabelled")}</span>
        <span class="val">${esc(fmtValue(i.cell))}</span>
        <span class="where">${esc(m.sheets[i.sheet].name)}!${addr(i.c, i.r)}</span>
        <span class="reach"><i style="width:${Math.max(2, pct)}%"></i></span>
        <span class="reach-txt">drives ${fmtNum(i.reach)} cell${i.reach === 1 ? "" : "s"}${i.reachSheets ? ` on ${i.reachSheets.size} sheet${i.reachSheets.size === 1 ? "" : "s"}` : ""}</span>
      </button></li>`;
    }).join("")}</ol>
  </div>`;
}

// ---------------- sheet grid ----------------

const RH = 26;
function renderSheet(idx) {
  const m = S.model;
  const sh = m.sheets[idx];
  const maxC = Math.min(Math.max(sh.maxC || 1, 1), 200);
  const maxR = Math.max(sh.maxR || 1, 1);
  // Column widths from content.
  const widths = [];
  for (let c = 1; c <= maxC; c++) {
    let w = 0;
    for (let r = 1; r <= Math.min(maxR, 300); r++) {
      const cell = sh.cells.get(c + "," + r);
      if (cell) w = Math.max(w, cellText(cell).length);
    }
    widths.push(Math.max(54, Math.min(240, w * 7.4 + 18)));
  }
  const left = [];
  let acc = 46;
  for (const w of widths) { left.push(acc); acc += w; }
  const total = acc;
  const iss = m.issues.filter((i) => i.sheet === idx);
  const issueCells = new Map();
  for (const i of iss) {
    if (i.severity === "info") continue;
    const b = i.block != null ? m.blocks[i.block] : null;
    if (b && b.sheet === idx && i.type !== "short-range" && i.type !== "empty-ref") for (const f of b.cells) issueCells.set(f.c + "," + f.r, i.severity);
    else issueCells.set(i.c + "," + i.r, i.severity);
  }
  const blocks = m.blocks.filter((b) => b.sheet === idx && b.n > 1);
  $("#stage").innerHTML = `<div class="sheet-wrap">
    <div class="sheet-head">
      <h2>${esc(sh.name)}${sh.state !== "visible" ? ` <span class="tag">${sh.state === "veryHidden" ? "very hidden" : "hidden"}</span>` : ""}</h2>
      <p>${sh.formulaCount ? `${fmtNum(sh.formulaCount)} formulas in ${m.blocks.filter((b) => b.sheet === idx).length} blocks` : "No formulas"}${sh.counts && sh.counts.input ? ` · ${sh.counts.input} inputs` : ""}${iss.length ? ` · <button class="linkish" data-goto="issues">${iss.length} issue${iss.length > 1 ? "s" : ""}</button>` : ""}${sh.maxC > 200 ? " · showing the first 200 columns" : ""}</p>
      <div class="legend small"><span><i class="k-input"></i>input</span><span><i class="k-calc"></i>calculation</span><span><i class="k-output"></i>result</span><span><i class="k-issue"></i>issue</span><span><i class="k-prec"></i>feeds the selected cell</span><span><i class="k-dep"></i>uses it</span>${S.hi && S.hi.missed && S.hi.missed.size ? `<span><i class="k-missed"></i>left out of the range</span>` : ""}</div>
    </div>
    <div class="grid-scroll" id="gridScroll">
      <div class="grid" style="width:${total}px;height:${(maxR + 1) * RH}px">
        <div class="colhead" style="width:${total}px"><div class="corner"></div>${widths.map((w, i) => `<div class="ch" style="left:${left[i]}px;width:${w}px">${numToCol(i + 1)}</div>`).join("")}</div>
        <div class="rows"></div>
        <div class="blocks">${blocks.map((b) => b.c1 <= maxC ? `<div class="blk" title="${esc(`${b.n} copies of one formula${b.label ? `: ${b.label}` : ""}`)}" style="left:${left[b.c1 - 1]}px;top:${b.r1 * RH}px;width:${left[Math.min(b.c2, maxC) - 1] + widths[Math.min(b.c2, maxC) - 1] - left[b.c1 - 1]}px;height:${(b.r2 - b.r1 + 1) * RH}px"></div>` : "").join("")}</div>
      </div>
    </div>
  </div>`;
  const scroll = $("#gridScroll");
  const rowsEl = scroll.querySelector(".rows");
  const grid = { idx, sh, maxC, maxR, widths, left, issueCells, scroll, rowsEl };
  S.grid = grid;
  let raf = 0;
  const draw = () => { raf = 0; drawRows(grid); };
  scroll.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(draw); });
  scroll.addEventListener("click", (e) => {
    const d = e.target.closest(".cell");
    if (!d) return;
    selectCell(idx, +d.dataset.c, +d.dataset.r, { fromGrid: true });
  });
  drawRows(grid);
}

function cellText(cell) {
  if (!cell) return "";
  return fmtValue(cell).replace(/^“|”$/g, "");
}

function drawRows(g) {
  const m = S.model;
  const top = g.scroll.scrollTop, h = g.scroll.clientHeight || 600;
  const r1 = Math.max(1, Math.floor(top / RH) - 5), r2 = Math.min(g.maxR, Math.ceil((top + h) / RH) + 5);
  const hi = S.hi && S.hi.sheet === g.idx ? S.hi : null;
  let html = "";
  for (let r = r1; r <= r2; r++) {
    html += `<div class="row" style="top:${r * RH}px;width:${g.left[g.left.length - 1] + g.widths[g.widths.length - 1]}px"><div class="rh">${r}</div>`;
    for (let c = 1; c <= g.maxC; c++) {
      const cell = g.sh.cells.get(c + "," + r);
      const k = c + "," + r;
      const sel = S.sel && S.sel.sheet === g.idx && S.sel.c === c && S.sel.r === r;
      const cls = ["cell"];
      if (cell) cls.push("ro-" + (cell.role || "data"));
      if (cell && typeof cell.value === "number") cls.push("num");
      const sev = g.issueCells.get(k);
      if (sev) cls.push("iss-" + sev);
      if (hi) { if (hi.prec.has(k)) cls.push("hl-prec"); if (hi.dep.has(k)) cls.push("hl-dep"); if (hi.down && hi.down.has(k)) cls.push("hl-down"); if (hi.missed && hi.missed.has(k)) cls.push("hl-missed"); }
      if (sel) cls.push("sel");
      if (!cell && !sev && !sel && !(hi && (hi.prec.has(k) || hi.dep.has(k)))) continue;
      html += `<div class="${cls.join(" ")}" data-c="${c}" data-r="${r}" style="left:${g.left[c - 1]}px;width:${g.widths[c - 1]}px"${cell && cell.f ? ` title="=${esc(cell.f.replace(/^=/, ""))}"` : ""}>${esc(cellText(cell))}</div>`;
    }
    html += "</div>";
  }
  g.rowsEl.innerHTML = html;
  // Make empty cells clickable too.
  g.rowsEl.onclick = (e) => {
    if (e.target.closest(".cell") || e.target.closest(".rh")) return;
    const rect = g.rowsEl.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const r = Math.floor(y / RH);
    let c = 0;
    for (let i = 0; i < g.left.length; i++) if (x >= g.left[i]) c = i + 1;
    if (r >= 1 && c >= 1) selectCell(g.idx, c, r, { fromGrid: true });
  };
  void m;
}

function scrollToCell(c, r) {
  const g = S.grid;
  if (!g) return;
  const x = g.left[Math.min(c, g.maxC) - 1] || 0, y = r * RH;
  const s = g.scroll;
  if (y < s.scrollTop + RH || y > s.scrollTop + s.clientHeight - RH * 2) s.scrollTop = Math.max(0, y - s.clientHeight / 3);
  if (x < s.scrollLeft + 46 || x > s.scrollLeft + s.clientWidth - 120) s.scrollLeft = Math.max(0, x - 120);
}

// ---------------- selection + inspector ----------------

function selectCell(sheet, c, r, opts = {}) {
  const m = S.model;
  S.sel = { sheet, c, r };
  const cell = m.cell(sheet, c, r);
  // highlight sets on the selected sheet
  const prec = new Set(), dep = new Set();
  if (cell && cell.fc) for (const p of m.precedentCells(cell.fc)) if (p.sheet === sheet) prec.add(p.c + "," + p.r);
  if (cell && cell.fc) for (const ref of cell.fc.refs) if (ref.sheet === sheet && ref.range && (ref.range.r2 - ref.range.r1 + 1) * (ref.range.c2 - ref.range.c1 + 1) <= 400)
    for (let rr = ref.range.r1; rr <= ref.range.r2; rr++) for (let cc = ref.range.c1; cc <= ref.range.c2; cc++) prec.add(cc + "," + rr);
  for (const d of m.dependentsOf(sheet, c, r)) if (d.sheet === sheet) dep.add(d.c + "," + d.r);
  const missed = new Set();
  if (opts.issue && opts.issue.missed && opts.issue.missed.sheet === sheet) missed.add(opts.issue.missed.c + "," + opts.issue.missed.r);
  S.hi = { sheet, prec, dep, missed, down: null };
  if (S.view !== "sheet" || S.sheet !== sheet) setView("sheet", sheet);
  else drawRows(S.grid);
  scrollToCell(c, r);
  if (S.grid) drawRows(S.grid);
  renderInspector(opts.issue);
  if (!opts.fromGrid && window.innerWidth < 900) $("#gridScroll").scrollIntoView({ behavior: "smooth", block: "start" });
  else if (opts.fromGrid && window.innerWidth < 900) $("#inspector").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderInspector(issue) {
  const m = S.model;
  const el = $("#inspector");
  if (!S.sel) {
    el.innerHTML = `<div class="insp-empty"><h3>Click any cell</h3><p>You'll see its formula as a tree with the real value at every step, what it's built from, and what changes if you edit it.</p>${m && m.issues.length ? `<p>Or start with <button class="linkish" data-goto="issues">what looks wrong</button>.</p>` : ""}</div>`;
    bindOnce(el);
    return;
  }
  const { sheet, c, r } = S.sel;
  const cell = m.cell(sheet, c, r);
  const lbl = m.labelText(sheet, c, r);
  const issues = m.issues.filter((i) => (i.sheet === sheet && i.c === c && i.r === r) || (i.block != null && cell && cell.fc && cell.fc.block && i.block === cell.fc.block.id));
  if (issue && !issues.includes(issue)) issues.unshift(issue);
  let html = `<div class="insp-head">
    <div class="addr">${esc(m.sheets[sheet].name)}!${addr(c, r)}</div>
    <div class="insp-label">${lbl ? esc(lbl) : "<span class=muted>no label nearby</span>"}</div>
    <div class="insp-value ${cell && cell.value && cell.value.error ? "is-err" : ""}">${cell ? esc(fmtValue(cell)) : "<span class=muted>empty</span>"}</div>
    <div class="insp-role">${roleText(cell)}</div>
  </div>`;
  for (const i of issues) html += `<div class="insp-issue ${i.severity}"><b>${esc(i.title)}</b><p>${esc(i.detail)}</p></div>`;

  if (cell && cell.fc) {
    const fc = cell.fc;
    const rc = m.recompute(fc);
    html += `<section class="insp-sec"><h4>Formula</h4><code class="ftext">=${esc(fc.f.replace(/^=/, ""))}</code>`;
    const plain = fc.ast ? explain(fc.ast, fc) : null;
    if (plain) html += `<p class="plain">${plain}</p>`;
    if (fc.ast) {
      html += `<div class="tree">${treeNode(fc.ast, fc, rc.ok ? rc.trace : null, true)}</div>`;
      html += `<p class="recalc ${rc.ok ? "ok" : ""}">${rc.ok ? "✓ Untangle recalculated this formula and got the same answer Excel saved, so the in-between values are trustworthy." : esc(rc.reason || "")}</p>`;
    } else html += `<p class="recalc">${esc(fc.parseError || "")}</p>`;
    if (fc.block && fc.block.n > 1) html += `<p class="copies">One of <b>${fc.block.n}</b> copies of this formula in ${esc(m.sheets[sheet].name)}!${fc.block.rangeText}${fc.block.label ? ` (“${esc(fc.block.label)}”${fc.block.span ? `, ${esc(fc.block.span)}` : ""})` : ""}.</p>`;
    html += `</section>`;
    const up = m.upstream(fc);
    const ins = up.inputs.filter((p) => p.cell && p.cell.role === "input");
    if (ins.length) {
      const shown = ins.slice(0, 12);
      html += `<section class="insp-sec"><h4>Built from ${ins.length} input${ins.length > 1 ? "s" : ""}${up.formulas.size ? ` through ${up.formulas.size} formula${up.formulas.size > 1 ? "s" : ""}` : ""}</h4><ol class="mini">${shown.map((p) => cellRow(p.sheet, p.c, p.r)).join("")}</ol>${ins.length > shown.length ? `<p class="muted">…and ${ins.length - shown.length} more.</p>` : ""}</section>`;
    }
  }
  if (cell) {
    const deps = [...m.dependentsOf(sheet, c, r)];
    if (deps.length) {
      const down = m.downstream(sheet, c, r);
      const sheetsHit = new Set([...down].map((f) => f.sheet));
      const outs = [...down].filter((f) => f.cell.role === "output");
      html += `<section class="insp-sec"><h4>If you change this</h4>
        <p class="impact"><b>${fmtNum(down.size)}</b> cell${down.size === 1 ? "" : "s"} on <b>${sheetsHit.size}</b> sheet${sheetsHit.size === 1 ? "" : "s"} would change${outs.length ? `, including ${outs.length} final result${outs.length > 1 ? "s" : ""}` : ""}.</p>
        <ol class="mini">${deps.slice(0, 8).map((d) => cellRow(d.sheet, d.c, d.r, "uses it directly")).join("")}</ol>
        ${deps.length > 8 ? `<p class="muted">…and ${deps.length - 8} more that use it directly.</p>` : ""}
        ${outs.length && outs.length !== deps.length ? `<p class="sub-h">Final results it reaches</p><ol class="mini">${outs.slice(0, 6).map((d) => cellRow(d.sheet, d.c, d.r)).join("")}</ol>` : ""}
        <button class="ghost small" id="showDown">Highlight everything downstream on this sheet</button>
      </section>`;
    } else if (cell.fc) html += `<section class="insp-sec"><h4>If you change this</h4><p class="muted">Nothing else in the workbook uses this cell. It's a final result (or left over).</p></section>`;
    else if (typeof cell.value === "number") html += `<section class="insp-sec"><h4>If you change this</h4><p class="muted">No formula reads this number, so changing it changes nothing else.</p></section>`;
  }
  el.innerHTML = html;
  const sd = $("#showDown", el);
  if (sd) sd.addEventListener("click", () => {
    const down = m.downstream(sheet, c, r);
    S.hi.down = new Set([...down].filter((f) => f.sheet === sheet).map((f) => f.c + "," + f.r));
    if (S.grid) drawRows(S.grid);
    sd.textContent = `${S.hi.down.size} highlighted on this sheet${down.size > S.hi.down.size ? `, ${down.size - S.hi.down.size} more elsewhere` : ""}`;
  });
  bindOnce(el);
}

function bindOnce(el) {
  if (el.dataset.bound) return;
  el.dataset.bound = "1";
  bindRowButtons(el);
}

function roleText(cell) {
  if (!cell) return "";
  return {
    input: "Input: a typed value that formulas use",
    calc: "Calculation: used by other formulas",
    output: "Result: nothing else uses it",
    label: "Text",
    data: cell.fc ? "" : typeof cell.value === "number" ? "Typed number that no formula uses" : "",
  }[cell.role] || "";
}

function cellRow(s, c, r, note) {
  const m = S.model;
  const cell = m.cell(s, c, r);
  const lbl = m.labelText(s, c, r);
  return `<li><button class="row-btn" data-cell="${s},${c},${r}"><span class="lbl">${esc(lbl || addr(c, r))}</span><span class="val">${esc(cell ? fmtValue(cell) : "blank")}</span><span class="where">${esc(m.sheets[s].name)}!${addr(c, r)}${note ? "" : ""}</span></button></li>`;
}

// ----- formula tree -----

const OPS = { "*": "×", "/": "÷", "-": "−", "+": "+", "^": "^", "&": "&", "=": "=", "<>": "≠", "<": "<", ">": ">", "<=": "≤", ">=": "≥" };
const OP_WORD = { "*": "multiply", "/": "divide", "-": "subtract", "+": "add", "^": "power", "&": "join text", "=": "equal?", "<>": "different?", "<": "less than?", ">": "greater than?", "<=": "at most?", ">=": "at least?" };

function refInfo(node, fc) {
  const m = S.model;
  const ref = fc.refs.find((x) => x.node === node);
  if (!ref || ref.sheet == null) return null;
  const rg = ref.range;
  const single = rg.c1 === rg.c2 && rg.r1 === rg.r2;
  const sheetName = m.sheets[ref.sheet].name;
  if (single) {
    const cell = m.cell(ref.sheet, rg.c1, rg.r1);
    return { single, sheet: ref.sheet, c: rg.c1, r: rg.r1, cell, label: m.labelText(ref.sheet, rg.c1, rg.r1), where: `${ref.sheet !== fc.sheet ? sheetName + "!" : ""}${addr(rg.c1, rg.r1)}` };
  }
  const rowL = rg.r1 === rg.r2 ? m.labelOf(ref.sheet, rg.c1, rg.r1).row : null;
  const colL = rg.c1 === rg.c2 ? m.labelOf(ref.sheet, rg.c1, rg.r1).col : null;
  const a = m.labelOf(ref.sheet, rg.c1, rg.r1), b = m.labelOf(ref.sheet, rg.c2, rg.r2);
  let label = rowL || colL || null;
  const span = rg.r1 === rg.r2 && a.col && b.col && a.col !== b.col ? `${a.col}–${b.col}` : rg.c1 === rg.c2 && a.row && b.row && a.row !== b.row ? `${a.row}–${b.row}` : null;
  if (label && span) label += `, ${span}`;
  else if (!label) label = span;
  const n = rg.wholeCol || rg.wholeRow ? null : (rg.r2 - rg.r1 + 1) * (rg.c2 - rg.c1 + 1);
  return { single, sheet: ref.sheet, c: rg.c1, r: rg.r1, label, n, where: `${ref.sheet !== fc.sheet ? sheetName + "!" : ""}${rangeText(rg)}` };
}

function valTxt(v) {
  if (v === undefined) return "";
  if (Array.isArray(v)) {
    const n = v.length * (v[0] ? v[0].length : 0);
    return n === 1 ? fmtValue(null, v[0][0]) : `${n} values`;
  }
  return fmtValue(null, v && v.error ? { error: v.error } : v);
}

function treeNode(n, fc, trace, root = false) {
  const m = S.model;
  if (n.type === "paren") return treeNode(n.expr, fc, trace, root);
  const v = trace ? trace.get(n) : undefined;
  const val = v !== undefined && !(Array.isArray(v) && v.length * (v[0] || []).length > 1) ? `<span class="tv">${esc(valTxt(v))}</span>` : "";
  const kids = (list) => `<ul>${list.map((k) => `<li>${treeNode(k, fc, trace)}</li>`).join("")}</ul>`;
  switch (n.type) {
    case "ref": {
      const info = refInfo(n, fc);
      if (!info) return `<span class="tn ref ext">${esc(n.text)}</span> <span class="muted">${n.ext != null ? "in another file" : ""}</span>`;
      const shownVal = info.single ? `<span class="tv">${esc(info.cell ? fmtValue(info.cell) : "blank")}</span>` : `<span class="tv muted">${info.n ? info.n + " cells" : "whole " + (n.range.wholeCol ? "column" : "row")}</span>`;
      return `<button class="tn ref" data-cell="${info.sheet},${info.c},${info.r}"><span class="ta">${esc(info.where)}</span>${info.label ? `<span class="tl">${esc(info.label)}</span>` : ""}</button>${shownVal}`;
    }
    case "name": {
      const nm = [...m.names.values()].find((x) => x.name.toUpperCase() === n.name.toUpperCase());
      const r0 = nm && nm.refs[0];
      if (r0 && r0.sheet != null && r0.range && r0.range.c1 === r0.range.c2 && r0.range.r1 === r0.range.r2) {
        const cell = m.cell(r0.sheet, r0.range.c1, r0.range.r1);
        return `<button class="tn ref" data-cell="${r0.sheet},${r0.range.c1},${r0.range.r1}"><span class="ta">${esc(n.name)}</span><span class="tl">named cell ${esc(m.sheets[r0.sheet].name)}!${addr(r0.range.c1, r0.range.r1)}</span></button><span class="tv">${esc(cell ? fmtValue(cell) : "blank")}</span>`;
      }
      return `<span class="tn name">${esc(n.name)}</span>${nm ? ` <span class="muted">= ${esc(nm.ref)}</span>` : ` <span class="muted">(defined inside the formula)</span>`}${val}`;
    }
    case "num": {
      const hard = !root && n.value !== 0 && n.value !== 1 && fc.block && S.model.issues.some((i) => i.type === "hardcoded" && i.block === fc.block.id && i.values.includes(n.value));
      return `<span class="tn lit ${hard ? "hard" : ""}">${esc(fmtNum(n.value))}</span>${hard ? `<span class="hard-tag">typed into the formula</span>` : ""}`;
    }
    case "str": return `<span class="tn lit">"${esc(n.value)}"</span>`;
    case "bool": return `<span class="tn lit">${n.value ? "TRUE" : "FALSE"}</span>`;
    case "err": return `<span class="tn err">${esc(n.value)}</span>`;
    case "missing": return `<span class="muted">(left empty)</span>`;
    case "table": return `<span class="tn ref">${esc(n.table + n.spec)}</span> <span class="muted">table column</span>`;
    case "func": return `<span class="tn fn">${esc(n.name)}</span>${val}${n.args.length ? kids(n.args) : ""}`;
    case "bin": {
      // Flatten chains of the same operator: a + b + c reads better as one node.
      const parts = [];
      const collect = (x) => { if (x.type === "bin" && x.op === n.op && (n.op === "+" || n.op === "*" || n.op === "&")) { collect(x.left); collect(x.right); } else parts.push(x); };
      collect(n.left); collect(n.right);
      return `<span class="tn op" title="${esc(OP_WORD[n.op] || n.op)}">${esc(OPS[n.op] || n.op)}</span><span class="op-word">${esc(OP_WORD[n.op] || "")}</span>${val}${kids(parts)}`;
    }
    case "unary": return `<span class="tn op">${n.op === "-" ? "negative" : n.op}</span>${val}${kids([n.expr])}`;
    case "percent": return `<span class="tn op">%</span>${val}${kids([n.expr])}`;
    case "array": return `<span class="tn lit">${esc(print(n))}</span>`;
    case "union": return `<span class="tn op">several ranges</span>${kids(n.items)}`;
    default: return `<span class="tn">${esc(print(n))}</span>${val}`;
  }
}

// Plain-language reading of simple formulas: "Revenue = Price per cup × Cups sold".
function explain(ast, fc) {
  let complex = false;
  const words = (n, depth) => {
    if (depth > 4) { complex = true; return ""; }
    switch (n.type) {
      case "paren": return `(${words(n.expr, depth + 1)})`;
      case "ref": {
        const i = refInfo(n, fc);
        if (!i) { complex = true; return ""; }
        if (!i.label) return `<span class="pw">${esc(i.where)}</span>`;
        return `<span class="pw">${esc(i.label)}</span>`;
      }
      case "name": return `<span class="pw">${esc(n.name)}</span>`;
      case "num": return esc(fmtNum(n.value));
      case "str": return `“${esc(n.value)}”`;
      case "bin": if (!OPS[n.op]) { complex = true; return ""; } return `${words(n.left, depth + 1)} ${OPS[n.op]} ${words(n.right, depth + 1)}`;
      case "unary": return `${n.op === "-" ? "−" : ""}${words(n.expr, depth + 1)}`;
      case "percent": return `${words(n.expr, depth + 1)}%`;
      case "func": {
        const one = { SUM: "total of", AVERAGE: "average of", MIN: "smallest of", MAX: "largest of", COUNT: "count of", ROUND: "rounded" };
        if (one[n.name] && n.args.length === 1) return `${one[n.name]} ${words(n.args[0], depth + 1)}`;
        if (n.name === "MAX" && n.args.length === 2 && n.args[0].type === "num" && n.args[0].value === 0) return `${words(n.args[1], depth + 1)} (never below 0)`;
        if (n.name === "ROUND" && n.args.length === 2) return `${words(n.args[0], depth + 1)}, rounded`;
        if (n.name === "IFERROR" && n.args.length === 2) return `${words(n.args[0], depth + 1)} (or ${words(n.args[1], depth + 1)} if that fails)`;
        if (n.name === "IF" && n.args.length === 3) return `if ${words(n.args[0], depth + 1)} then ${words(n.args[1], depth + 1)}, otherwise ${words(n.args[2], depth + 1)}`;
        complex = true; return "";
      }
    }
    complex = true;
    return "";
  };
  const s = words(ast, 0);
  if (complex || !s || !/class="pw"/.test(s)) return null;
  const lbl = S.model.labelText(fc.sheet, fc.c, fc.r);
  return `<span class="pw self">${esc(lbl || addr(fc.c, fc.r))}</span> = ${s}`;
}

function trim(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

// ---------------- start ----------------
const setTopH = () => document.documentElement.style.setProperty("--topH", $(".top").offsetHeight + "px");
setTopH();
window.addEventListener("resize", setTopH);
bindRowButtons($("#stage"));
if (location.hash === "#sample") openSample();
window.addEventListener("hashchange", () => { if (location.hash === "#sample" && (!S.model || !S.fileName.includes("sample"))) openSample(); });
