import { readWorkbook } from "./xlsx.js";
import { buildModel, fmtValue, fmtNum, addr, numToCol, rangeText } from "./model.js";
import { print, parseA1 } from "./formula.js";
import { sheetFlow, flowLayers } from "./blocks.js";
import { previewRepair, previewInput, parseInputValue } from "./preview.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const track = (e) => { try { window.UTAnalytics && window.UTAnalytics.track(e); } catch (_) { /* never break the app */ } };

const S = { model: null, view: "map", sheet: null, sel: null, hi: null, fileName: "", sheetMode: "blocks", flows: new Map(), flowRange: null, flowFocus: null };
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
  $('#repairDialog')?.remove();
  const t0 = performance.now();
  const wb = await readWorkbook(buf, progress);
  progress("Tracing every formula…");
  await new Promise((r) => setTimeout(r, 20));
  const model = buildModel(wb);
  model.stats.totalMs = Math.round(performance.now() - t0);
  S.model = model; S.fileName = name; S.sel = null; S.hi = null; S.sheet = null; S.grid = null; S.flows = new Map(); S.inputFilter = null; S.flowRange = null; S.flowFocus = null;
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
    <div class="stat ${stats.high ? "bad" : stats.issues ? "warn" : "ok"}"><b>${stats.issues}</b><span>${stats.high ? `things look wrong <em>(${stats.high} likely mistakes)</em>` : stats.issues ? "things to check" : "no issues flagged"}</span></div>
    <div class="stat time"><span>Mapped in ${stats.totalMs < 1000 ? stats.totalMs + " ms" : (stats.totalMs / 1000).toFixed(1) + " s"}, on your device</span></div>
    ${notes.length ? `<details class="notes"><summary>Calculation coverage and limits</summary>${notes.map((n) => `<p>${esc(n)}</p>`).join("")}</details>` : ""}
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
  else { S.inputFilter = null; setView(b.dataset.view); }
});

function setView(v, sheet = null) {
  S.view = v;
  if (v === "sheet") S.sheet = sheet;
  else S.grid = null;
  for (const b of document.querySelectorAll(".tabs button[data-view]")) {
    const on = b.dataset.view === v && (v !== "sheet" || +b.dataset.sheet === sheet);
    b.setAttribute("aria-selected", on ? "true" : "false");
  }
  if (v === "map") renderMap();
  else if (v === "issues") renderIssues();
  else if (v === "inputs") renderInputs();
  else if (v === "sheet") { if (S.sheetMode === "blocks") renderBlocks(sheet); else renderSheet(sheet); }
}

function openSheet(i) {
  S.sheetMode = "blocks"; S.flowRange = null; S.flowFocus = null; S.grid = null;
  S.sel = null; S.hi = null;
  setView("sheet", i);
  renderInspector();
}

function sheetTools(idx) {
  return `<div class="sheet-tools"><div class="mode-switch" aria-label="Sheet view">
    <button data-sheet-mode="blocks" aria-pressed="${S.sheetMode === 'blocks'}">Block map</button>
    <button data-sheet-mode="grid" aria-pressed="${S.sheetMode === 'grid'}">Cell grid</button></div>
    <form class="cell-jump" data-jump-sheet="${idx}"><label>Go to cell <input name="address" placeholder="B10000 or Sheet!B2" aria-label="Cell address" required></label><button class="ghost" type="submit">Go</button><span class="jump-error" role="status"></span></form></div>`;
}

$('#stage').addEventListener('click', (e) => {
  const mode = e.target.closest('[data-sheet-mode]');
  if (mode) { S.sheetMode = mode.dataset.sheetMode; setView('sheet', S.sheet); return; }
  const node = e.target.closest('[data-flow-node],[data-flow-choice]');
  if (node) showFlowNode(node.dataset.flowNode || node.dataset.flowChoice);
});
$('#stage').addEventListener('keydown', (e) => {
  const node = e.target.closest('[data-flow-node],[data-flow-choice]');
  if (node && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showFlowNode(node.dataset.flowNode || node.dataset.flowChoice); }
});
$('#stage').addEventListener('submit', (e) => {
  const form = e.target.closest('[data-jump-sheet]');
  if (!form) return;
  e.preventDefault();
  const text = form.elements.address.value.trim();
  const match = /^(?:(.+)!)?(\$?[A-Za-z]{1,3}\$?[1-9]\d*)$/.exec(text);
  const pos = match && parseA1(match[2]);
  const name = match?.[1]?.replace(/^'|'$/g, '').replace(/''/g, "'");
  const sh = name ? S.model.sheets.find((x) => x.name.toLowerCase() === name.toLowerCase()) : S.model.sheets[+form.dataset.jumpSheet];
  if (!pos || !sh || pos.c > 16384 || pos.r > 1048576) { $('.jump-error', form).textContent = 'Use an address such as B2 or Summary!B2.'; return; }
  $('.jump-error', form).textContent = '';
  selectCell(sh.index, pos.c, pos.r);
});

function flowFor(idx) {
  if (!S.flows.has(idx)) S.flows.set(idx, sheetFlow(S.model, idx));
  return S.flows.get(idx);
}

function openRange(sheet, range) {
  S.sel = null;
  S.sheetMode = 'blocks'; S.flowRange = { sheet, ...range }; S.flowFocus = null; S.grid = null;
  setView('sheet', sheet);
  const flow = flowFor(sheet);
  const hits = flow.nodes.filter((n) => n.sheet === sheet && n.c1 <= range.c2 && n.c2 >= range.c1 && n.r1 <= range.r2 && n.r2 >= range.r1);
  $('#inspector').innerHTML = `<div class="insp-head"><div class="addr">${esc(S.model.sheets[sheet].name)}!${esc(rangeText(range))}</div><h3>A range, not one cell</h3></div>
    <p>${hits.length} input or formula block${hits.length === 1 ? '' : 's'} overlap this range. Click one in the map to see how it works.</p>
    <button class="ghost" data-cell="${sheet},${range.c1},${range.r1}">Open first cell</button>
    <button class="ghost" data-cell="${sheet},${Math.min(range.c2, S.model.sheets[sheet].maxC)},${Math.min(range.r2, S.model.sheets[sheet].maxR)}">Open last used cell</button>`;
  bindOnce($('#inspector'));
}

function renderBlocks(idx) {
  S.grid = null;
  const m = S.model, sh = m.sheets[idx], full = flowFor(idx);
  let flow = full;
  if (S.flowRange || S.flowFocus) {
    const rg = S.flowRange;
    const ids = new Set(full.nodes.filter((n) => rg ? n.sheet === idx && n.c1 <= rg.c2 && n.c2 >= rg.c1 && n.r1 <= rg.r2 && n.r2 >= rg.r1 : n.id === S.flowFocus).map((n) => n.id));
    const related = new Set(ids);
    for (const e of full.edges) if (ids.has(e.from) || ids.has(e.to)) { related.add(e.from); related.add(e.to); }
    flow = { nodes: full.nodes.filter((n) => related.has(n.id)), edges: full.edges.filter((e) => related.has(e.from) && related.has(e.to)) };
  }
  const totalGroups = flow.nodes.length;
  if (totalGroups > 80) {
    const visible = new Set(flow.nodes.slice(0, 80).map((n) => n.id));
    flow = { nodes: flow.nodes.slice(0, 80), edges: flow.edges.filter((e) => visible.has(e.from) && visible.has(e.to)) };
  }
  const layers = flowLayers(flow), grouped = new Map();
  for (const n of flow.nodes) { const l = layers.get(n.id); if (!grouped.has(l)) grouped.set(l, []); grouped.get(l).push(n); }
  const keys = [...grouped.keys()].sort((a, b) => a - b);
  const W = 246, H = 108, GX = 36, GY = 26;
  const available = Math.max(280, $('#stage').clientWidth - 38);
  const vertical = keys.length * (W + GX) > available + GX;
  const count = Math.max(1, ...[...grouped.values()].map((x) => x.length));
  const pos = new Map();
  keys.forEach((l, j) => grouped.get(l).forEach((n, i) => pos.set(n.id, vertical
    ? { x: 20 + i * (W + GX), y: 20 + j * (H + 60) }
    : { x: 20 + j * (W + GX), y: 20 + i * (H + GY) })));
  const width = 40 + (vertical ? count : keys.length) * (W + GX) - GX;
  const height = 40 + (vertical ? keys.length * (H + 60) - 60 : count * (H + GY) - GY);
  let svg = '';
  for (const e of flow.edges) {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) continue;
    const x1 = a.x + (vertical ? W / 2 : W), y1 = a.y + (vertical ? H : H / 2);
    const x2 = b.x + (vertical ? W / 2 : 0), y2 = b.y + (vertical ? 0 : H / 2);
    const d = e.from === e.to ? `M${a.x + W},${a.y + 32} C${a.x + W + 28},${a.y + 5} ${a.x + W + 28},${a.y + 95} ${a.x + W},${a.y + 78}`
      : vertical ? `M${x1},${y1} C${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}` : `M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`;
    svg += `<path class="flow-edge" d="${d}" marker-end="url(#flowArrow)"><title>${e.n} formula reference${e.n === 1 ? '' : 's'}</title></path>`;
  }
  for (const n of flow.nodes) {
    const p = pos.get(n.id), here = n.sheet === idx;
    const issues = m.issues.filter((i) => i.severity !== 'info' && i.sheet === n.sheet && (i.block === n.block && n.block != null || i.c >= n.c1 && i.c <= n.c2 && i.r >= n.r1 && i.r <= n.r2));
    const output = n.kind === 'sheet' || n.sample?.cell.role === 'output';
    const role = n.kind === 'input' ? 'typed inputs' : n.kind === 'sheet' ? 'used on another sheet' : n.kind === 'external' ? 'external source' : here ? output ? 'results' : 'copied calculation' : 'from another sheet';
    const formula = n.kind === 'formula' ? '=' + n.sample.f.replace(/^=/, '') : n.kind === 'input' ? `${fmtNum(n.n)} typed value${n.n === 1 ? '' : 's'}` : '';
    svg += `<g class="flow-node ${n.kind === 'input' ? 'flow-input' : output ? 'flow-output' : ''} ${here ? '' : 'flow-other'}" transform="translate(${p.x},${p.y})" tabindex="0" role="button" data-flow-node="${esc(n.id)}" aria-label="${esc(n.label + ', ' + n.rangeText)}">
      <rect width="${W}" height="${H}" rx="12"/><text x="14" y="21" class="flow-role">${role}</text>
      <text x="14" y="44" class="flow-title">${esc(trim(n.label, 27))}</text>
      <text x="14" y="65" class="flow-address">${esc(trim((n.sheet != null && !here && n.kind !== "sheet" ? m.sheets[n.sheet].name + '!' : '') + n.rangeText, 29))}${n.kind === 'formula' ? ` · ${fmtNum(n.n)}×` : ''}</text>
      <text x="14" y="89" class="flow-formula">${esc(trim(formula, 29))}</text>
      ${issues.length ? `<circle cx="${W-15}" cy="16" r="8" class="b-${issues.some((i) => i.severity === 'high') ? 'high' : 'med'}"><title>${issues.length} findings</title></circle>` : ''}
      <title>${esc(n.label)} · ${esc(n.rangeText)}${formula ? '\n' + esc(formula) : ''}</title></g>`;
  }
  const blocks = m.blocks.filter((b) => b.sheet === idx);
  $('#stage').innerHTML = `<div class="sheet-wrap"><div class="sheet-head"><h2>${esc(sh.name)} · block map</h2>
    <p>${fmtNum(sh.formulaCount || 0)} formulas become ${blocks.length} block${blocks.length === 1 ? "" : "s"}. Follow the arrows, then click a block to inspect its sources or open its cells.</p></div>${sheetTools(idx)}
    <label class="block-filter">Explore <select id="blockFocus"><option value="">All blocks</option>${blocks.map((b) => `<option value="b${b.id}" ${S.flowFocus === 'b'+b.id ? 'selected' : ''}>${esc(b.label || 'Calculation')} · ${esc(b.rangeText)} (${fmtNum(b.n)} copies)</option>`).join('')}</select></label>
    ${S.flowRange ? `<p class="range-note">Showing blocks that overlap <b>${esc(rangeText(S.flowRange))}</b> and their sources. <button class="linkish" data-sheet-open="${idx}">Show whole sheet</button></p>` : ''}
    ${totalGroups > 80 ? `<p class="range-note">Showing 80 of ${fmtNum(totalGroups)} groups. Choose a block in Explore to see its sources and destinations together.</p>` : ''}
    ${mapControls()}
    <div class="compact-map">${keys.map((l,j)=>`<section class="compact-lane"><h3>${j===0?'Sources':`↓ Step ${j+1}`} · ${grouped.get(l).length} groups</h3><div>${grouped.get(l).map((n)=>`<button class="compact-node ${n.kind==='input'?'compact-input':n.kind==='sheet'?'compact-output':''}" data-flow-choice="${esc(n.id)}"><b>${esc(n.label)}</b><small>${esc(n.sheet!=null && n.sheet!==idx && n.kind!=='sheet'?m.sheets[n.sheet].name+'!':'')}${esc(n.rangeText)}${n.n?' · '+fmtNum(n.n)+' cells':''}</small></button>`).join('')}</div></section>`).join('')}</div>
    <div class="flow-scroll diagram-viewport"><svg class="block-map" width="${Math.max(280, width)}" height="${Math.max(100, height)}" viewBox="0 0 ${Math.max(280,width)} ${Math.max(100,height)}" role="img" aria-label="Formula block dependencies"><defs><marker id="flowArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>${svg}</svg></div>
    ${!flow.nodes.length ? '<p class="empty">No formula blocks or referenced inputs on this sheet. Use Cell grid to browse its data.</p>' : ''}
    <p class="flow-hint">Blue = typed inputs · green = results · dashed = another sheet or file. Select a group for readable sources and destinations. Fit shows the diagram together; use + or 100% for detail.</p>
    </div>`;
  bindMapControls($('.sheet-wrap'));
  $('#blockFocus').addEventListener('change', (e) => { S.flowRange = null; S.flowFocus = e.target.value || null; renderBlocks(idx); if (S.flowFocus) showFlowNode(S.flowFocus); });
}

function showFlowNode(id) {
  const m = S.model, flow = flowFor(S.sheet), n = flow.nodes.find((x) => x.id === id);
  if (!n) return;
  if (n.kind === 'sheet') { openSheet(n.sheet); return; }
  const describe = (x) => `<li><button class="row-btn" data-flow-inspect="${esc(x.id)}"><span class="lbl">${esc(x.label)}</span><span class="where">${esc(x.sheet != null && x.kind !== 'sheet' ? m.sheets[x.sheet].name + '!' : '')}${esc(x.rangeText)}${x.n ? ' · '+fmtNum(x.n)+' cells' : ''}</span></button></li>`;
  const sources = flow.edges.filter((e) => e.to === id).map((e) => flow.nodes.find((x) => x.id === e.from));
  const uses = flow.edges.filter((e) => e.from === id).map((e) => flow.nodes.find((x) => x.id === e.to));
  const issues = m.issues.filter((i) => i.sheet === n.sheet && (n.block != null && i.block === n.block || i.c >= n.c1 && i.c <= n.c2 && i.r >= n.r1 && i.r <= n.r2));
  const el = $('#inspector');
  el.innerHTML = `<div class="insp-head"><div class="addr">${esc(n.sheet != null ? m.sheets[n.sheet].name + '!' : '')}${esc(n.rangeText)}</div><h3>${esc(n.label)}</h3></div>
    <p>${n.kind === 'formula' ? `<b>${fmtNum(n.n)}</b> copies of one formula. The representative cell is ${addr(n.c1,n.r1)}.` : n.kind === 'input' ? `<b>${fmtNum(n.n)}</b> typed values feed formulas.` : 'Values from this workbook are unavailable here.'}</p>
    ${n.sample ? `<code class="ftext">=${esc(n.sample.f.replace(/^=/,''))}</code>` : ''}
    ${n.c1 != null ? `<p><button class="ghost" data-cell="${n.sheet},${n.c1},${n.r1}">Open ${addr(n.c1,n.r1)}</button> ${n.n > 1 ? `<button class="ghost" data-cell="${n.sheet},${n.c2},${n.r2}">Last cell ${addr(n.c2,n.r2)}</button>` : ''}</p>` : ''}
    ${issues.map((i) => `<button class="block-issue" data-issue="${i.id}">${esc(i.title)}</button>`).join('')}
    ${sources.length ? `<section class="insp-sec"><h4>Built from ${sources.length} group${sources.length === 1 ? '' : 's'}</h4><ol class="mini">${sources.map(describe).join('')}</ol></section>` : ''}
    ${uses.length ? `<section class="insp-sec"><h4>Feeds ${uses.length} group${uses.length === 1 ? '' : 's'}</h4><ol class="mini">${uses.map(describe).join('')}</ol></section>` : ''}`;
  bindOnce(el);
  el.onclick = (e) => { const b = e.target.closest('[data-flow-inspect]'); if (b) showFlowNode(b.dataset.flowInspect); };
  for (const node of document.querySelectorAll('[data-flow-node],[data-flow-choice]')) node.classList.toggle('active', (node.dataset.flowNode || node.dataset.flowChoice) === id);
  if (window.innerWidth < 900) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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
  const scale = 1;
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
      ${S.fileName.includes('(sample)') ? '<p class="sample-scenario"><button class="ghost" data-scenario="0,2,11" data-suggested="42000">Try a higher salary → see the results</button><span>38,000 → 42,000, without editing the sample</span></p>' : ''}
      ${mapControls()}
      <div class="compact-map">${layerKeys.map((l,j)=>`<section class="compact-lane"><h3>${j===0?'Sources':`↓ Step ${j+1}`}</h3><div>${layers.get(l).map((sh)=>`<button class="compact-node ${sh.counts?.input?'compact-input':sh.counts?.output?'compact-output':''}" data-sheet-open="${sh.index}"><b>${esc(sh.name)}</b><small>${sh.formulaCount||0} formulas · ${sh.state!=='visible'?'hidden sheet':!sh.formulaCount?'inputs / data':'open to explore'}</small></button>`).join('')}</div></section>`).join('')}</div>
      <div class="map-scroll diagram-viewport"><svg class="map" viewBox="0 0 ${width} ${height + 50}" width="${Math.round(width * scale)}" height="${Math.round((height + 50) * scale)}" role="img" aria-label="Sheet dependency map">
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
  bindMapControls($('.map-wrap'));
  svg.addEventListener("click", (e) => { const g = e.target.closest(".node"); if (g) openSheet(+g.dataset.sheet); });
  svg.addEventListener("keydown", (e) => { const g = e.target.closest(".node"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openSheet(+g.dataset.sheet); } });
  svg.addEventListener("mouseover", (e) => {
    const g = e.target.closest(".node");
    svg.classList.toggle("focusing", !!g);
    for (const p of svg.querySelectorAll(".edge")) p.classList.toggle("lit", !!g && (p.dataset.from === g.dataset.sheet || p.dataset.to === g.dataset.sheet));
  });
}

function mapControls() {
  return `<div class="map-controls" aria-label="Map display"><button class="ghost small" data-map-mode="compact">Compact overview</button><button class="ghost small" data-map-mode="diagram">Diagram</button><button class="ghost small" data-map-zoom="fit">Fit</button><button class="ghost small" data-map-zoom="out" aria-label="Zoom out">−</button><output class="map-scale" aria-label="Diagram zoom"></output><button class="ghost small" data-map-zoom="in" aria-label="Zoom in">+</button><button class="ghost small" data-map-zoom="actual">100%</button></div>`;
}

function bindMapControls(root) {
  const viewport = $('.diagram-viewport',root), svg = $('svg',viewport), compact = $('.compact-map',root);
  const vb = svg.viewBox.baseVal;
  let scale = 1, mode = 'compact', fit = true;
  const resize = () => {
    const maxH = Math.min(600,window.innerHeight*.55);
    if (fit) scale = Math.min(1, Math.max(1,root.clientWidth-40)/vb.width, maxH/vb.height);
    svg.setAttribute('width',vb.width*scale); svg.setAttribute('height',vb.height*scale);
    $('.map-scale',root).textContent = `${Math.round(scale*100)}%`;
    viewport.hidden = mode !== 'diagram'; compact.hidden = mode !== 'compact';
    for (const b of root.querySelectorAll('[data-map-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mapMode === mode));
    viewport.scrollLeft = 0; viewport.scrollTop = 0;
  };
  root.addEventListener('click',(e)=>{
    const b = e.target.closest('[data-map-mode],[data-map-zoom]'); if (!b) return;
    if (b.dataset.mapMode) mode = b.dataset.mapMode;
    else {
      mode = 'diagram';
      const action = b.dataset.mapZoom;
      fit = action === 'fit';
      if (action === 'actual') scale = 1;
      else if (!fit) scale = Math.max(.1,Math.min(2,scale*(action==='in'?1.35:1/1.35)));
    }
    resize();
  });
  svg.addEventListener('focusin',(e)=>{ if (e.target.matches('[role=button]')) e.target.scrollIntoView({block:'nearest',inline:'nearest'}); });
  const observer = new ResizeObserver(()=>{if (fit) resize();}); observer.observe(root);
  // The observed DOM node is replaced on navigation; disconnect once detached.
  const cleanup = new MutationObserver(()=>{if (!root.isConnected) {observer.disconnect();cleanup.disconnect();}});
  cleanup.observe($('#stage'),{childList:true});
  resize();
}

function inputRow(i) {
  const m = S.model;
  const lbl = i.label || m.labelText(i.sheet, i.c, i.r) || "unlabelled";
  return `<li><button class="row-btn" data-cell="${i.sheet},${i.c},${i.r}"><span class="lbl">${esc(lbl)}</span><span class="val">${esc(fmtValue(i.cell))}</span><span class="where">${esc(m.sheets[i.sheet].name)}!${addr(i.c, i.r)} · ${i.reachLimited ? "at least " : ""}${fmtNum(i.reach)} known dependent cell${i.reach === 1 ? "" : "s"}</span></button></li>`;
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
    const b = e.target.closest("[data-cell],[data-issue],[data-goto],[data-sheet-open],[data-range],[data-inputs-for],[data-preview],[data-scenario]");
    if (!b || !root.contains(b)) return;
    if (b.dataset.preview != null) { showRepairPreview(+b.dataset.preview, b); return; }
    if (b.dataset.scenario) { showInputPreview(b.dataset.scenario.split(',').map(Number), b); return; }
    if (b.dataset.inputsFor) { const [s,c,r] = b.dataset.inputsFor.split(',').map(Number); S.inputFilter = S.model.upstream(S.model.cell(s,c,r).fc).inputs; setView('inputs'); return; }
    if (b.dataset.range) { const [sheet,c1,c2,r1,r2] = b.dataset.range.split(',').map(Number); openRange(sheet,{c1,c2,r1,r2}); return; }
    if (b.dataset.goto) { setView(b.dataset.goto); window.scrollTo({ top: $("#app").offsetTop - 8, behavior: "smooth" }); return; }
    if (b.dataset.sheetOpen != null) { openSheet(+b.dataset.sheetOpen); return; }
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
  "empty-ref": "Reads an empty cell", untraceable: "Hidden data source", external: "Link to another file", "saved-mismatch": "Saved result differs", "unknown-name": "Unknown name", "table-reference": "Unresolved table reference", hidden: "Hidden sheet",
};

function renderIssues() {
  const m = S.model;
  const groups = [["high", "Likely mistakes", "These usually mean a number is wrong."], ["medium", "Worth checking", "Results and dependencies to verify before trusting this workbook."], ["info", "For your information", ""]];
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

function renderInputs(page = 0, query = "") {
  const m = S.model;
  const filterKeys = S.inputFilter && new Set(S.inputFilter.map((p) => `${p.sheet},${p.c},${p.r}`));
  const filtered = (filterKeys ? m.inputs.filter((i) => filterKeys.has(`${i.sheet},${i.c},${i.r}`)) : m.inputs).filter((i) => !query || `${i.label || ''} ${m.sheets[i.sheet].name}!${addr(i.c,i.r)}`.toLowerCase().includes(query.toLowerCase()));
  const shownInputs = filtered.slice(page * 100, (page + 1) * 100);
  $("#stage").innerHTML = `<div class="list-wrap">
    <h2>The numbers this workbook rests on</h2>
    <p class="list-sub">Typed values with known formula references, ranked by the number of dependent cells we traced. A dependent formula may keep the same result when an input changes.</p>
    ${dependencyWarning(m)}
    ${S.inputFilter ? `<p class="range-note">Showing ${fmtNum(S.inputFilter.length)} inputs upstream of the selected formula. <button class="linkish" id="allInputs">Show every input</button></p>` : ''}
    <form id="inputSearch" class="input-search"><label>Find an input <input name="query" value="${esc(query)}" placeholder="Label, sheet or address"></label><button class="ghost">Search</button></form>
    <p class="muted">${filtered.length ? `${fmtNum(page*100+1)}–${fmtNum(Math.min((page+1)*100,filtered.length))} of ${fmtNum(filtered.length)} inputs` : 'No inputs match.'}</p>
    <ol class="inputs-list">${shownInputs.map((i) => {
      const pct = m.formulas.length ? Math.round((i.reach / m.formulas.length) * 100) : 0;
      return `<li><button class="row-btn" data-cell="${i.sheet},${i.c},${i.r}">
        <span class="lbl">${esc(i.label || "unlabelled")}</span>
        <span class="val">${esc(fmtValue(i.cell))}</span>
        <span class="where">${esc(m.sheets[i.sheet].name)}!${addr(i.c, i.r)}</span>
        <span class="reach"><i style="width:${Math.max(2, pct)}%"></i></span>
        <span class="reach-txt">${i.reachLimited ? "at least " : ""}${fmtNum(i.reach)} known dependent cell${i.reach === 1 ? "" : "s"}${i.reachSheets ? ` on ${i.reachSheets.size} sheet${i.reachSheets.size === 1 ? "" : "s"}` : ""}</span>
      </button></li>`;
    }).join("")}</ol>
  </div>`;
  const form = $('#inputSearch');
  form.addEventListener('submit', (e) => { e.preventDefault(); renderInputs(0, form.elements.query.value.trim()); });
  if (filtered.length > 100) {
    const nav = document.createElement('div'); nav.className = 'input-pages';
    nav.innerHTML = `<button class="ghost" id="prevInputs" ${page === 0 ? 'disabled' : ''}>Previous 100</button><button class="ghost" id="nextInputs" ${(page+1)*100 >= filtered.length ? 'disabled' : ''}>Next 100</button>`;
    $('.inputs-list').after(nav);
    $('#prevInputs').onclick = () => renderInputs(page-1,query);
    $('#nextInputs').onclick = () => renderInputs(page+1,query);
  }
  const all = $("#allInputs"); if (all) all.onclick = () => { S.inputFilter = null; renderInputs(); };
}

// ---------------- sheet grid ----------------

const RH = 26;
function renderSheet(idx) {
  const m = S.model;
  const sh = m.sheets[idx];
  const selected = S.sel?.sheet === idx ? S.sel : null;
  // A direct jump may target a cell beyond the usual 200-column viewport.
  const firstC = selected && selected.c > 200 ? Math.max(1, selected.c - 20) : 1;
  const maxC = Math.min(Math.max(sh.maxC || 1, selected?.c || 1, firstC), firstC + 199);
  const maxR = Math.max(sh.maxR || 1, selected?.r || 1);
  // Column widths from content.
  const widths = [];
  for (let c = 1; c <= maxC; c++) {
    if (c < firstC) { widths.push(0); continue; }
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
      <p>${sh.formulaCount ? `${fmtNum(sh.formulaCount)} formulas in ${m.blocks.filter((b) => b.sheet === idx).length} blocks` : "No formulas"}${sh.counts && sh.counts.input ? ` · ${sh.counts.input} inputs` : ""}${iss.length ? ` · <button class="linkish" data-goto="issues">${iss.length} issue${iss.length > 1 ? "s" : ""}</button>` : ""}${sh.maxC > 200 ? ` · columns ${numToCol(firstC)}–${numToCol(maxC)} (jump to reach another column)` : ""}</p>
      ${sheetTools(idx)}
      <div class="legend small"><span><i class="k-input"></i>input</span><span><i class="k-calc"></i>calculation</span><span><i class="k-output"></i>result</span><span><i class="k-issue"></i>issue</span><span><i class="k-prec"></i>feeds the selected cell</span><span><i class="k-dep"></i>uses it</span>${S.hi && S.hi.missed && S.hi.missed.size ? `<span><i class="k-missed"></i>left out of the range</span>` : ""}</div>
    </div>
    <div class="grid-scroll" id="gridScroll">
      <div class="grid" style="width:${total}px;height:${(maxR + 1) * RH}px">
        <div class="colhead" style="width:${total}px"><div class="corner"></div>${widths.map((w, i) => w ? `<div class="ch" style="left:${left[i]}px;width:${w}px">${numToCol(i + 1)}</div>` : "").join("")}</div>
        <div class="rows"></div>
        <div class="blocks">${blocks.map((b) => b.c1 >= firstC && b.c1 <= maxC ? `<div class="blk" title="${esc(`${b.n} copies of one formula${b.label ? `: ${b.label}` : ""}`)}" style="left:${left[b.c1 - 1]}px;top:${b.r1 * RH}px;width:${left[Math.min(b.c2, maxC) - 1] + widths[Math.min(b.c2, maxC) - 1] - left[b.c1 - 1]}px;height:${(b.r2 - b.r1 + 1) * RH}px"></div>` : "").join("")}</div>
      </div>
    </div>
  </div>`;
  const scroll = $("#gridScroll");
  const rowsEl = scroll.querySelector(".rows");
  const grid = { idx, sh, maxC, maxR, firstC, widths, left, issueCells, scroll, rowsEl };
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
    for (let c = g.firstC; c <= g.maxC; c++) {
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
  const wasGrid = S.view === "sheet" && S.sheet === sheet && S.sheetMode === "grid";
  S.sheetMode = "grid";
  if (!wasGrid || c < S.grid.firstC || c > S.grid.maxC || r > S.grid.maxR) setView("sheet", sheet);
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
  el.onclick = null;
  if (!S.sel) {
    el.innerHTML = `<div class="insp-empty"><h3>Click a block or cell</h3><p>A block shows its sources and destinations. Open a cell to see its formula as a tree with the real value at every step, what it's built from, and what changes if you edit it.</p>${m && m.issues.length ? `<p>Or start with <button class="linkish" data-goto="issues">what looks wrong</button>.</p>` : ""}</div>`;
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
    <div class="insp-label">${lbl ? `<small>Nearby heading</small> ${esc(lbl)}` : "<span class=muted>no clear heading nearby</span>"}</div>
    <div class="insp-value ${cell && cell.value && cell.value.error ? "is-err" : ""}">${cell ? esc(fmtValue(cell)) : "<span class=muted>empty</span>"}</div>
    <div class="insp-role">${roleText(cell)}</div>
  </div>`;
  for (const i of issues) html += `<div class="insp-issue ${i.severity}"><b>${esc(i.title)}</b><p>${esc(i.detail)}</p>${i.expected ? `<button class="ghost small preview-button" data-preview="${i.id}">Preview this repair</button><div class="repair-slot" aria-live="polite"></div>` : ""}</div>`;

  if (cell && !cell.f && !cell.array && !cell.dataTable && ['number','string','boolean'].includes(typeof cell.value))
    html += `<section class="insp-sec input-scenario"><h4>Try a different input</h4><p>Change this value temporarily and calculate its effects across sheets.</p><button class="ghost" data-scenario="${sheet},${c},${r}">Try a different value</button><p class="small">One input at a time. Your workbook stays unchanged.</p></section>`;

  if (cell && cell.fc) {
    const fc = cell.fc;
    const rc = m.recompute(fc);
    html += `<section class="insp-sec"><h4>Formula</h4><code class="ftext">=${esc(fc.f.replace(/^=/, ""))}</code>`;
    const plain = fc.ast ? explain(fc.ast, fc) : null;
    if (plain) html += `<p class="plain">${plain}</p>`;
    if (fc.ast) {
      html += `<div class="tree">${treeNode(fc.ast, fc, rc.ok ? rc.trace : null, true)}</div>`;
      html += `<p class="recalc ${rc.ok ? "ok" : ""}">${rc.ok ? `✓ This formula and its ${rc.checked - 1} upstream formulas match Excel’s saved values using saved inputs. The tree shows those values; this is not an audit of the workbook.` : esc(rc.reason || "")}</p>${rc.problem ? `<button class="ghost small" data-cell="${rc.problem.sheet},${rc.problem.c},${rc.problem.r}">Inspect upstream discrepancy</button>` : ""}`;
    } else html += `<p class="recalc">${esc(fc.parseError || "")}</p>`;
    if (fc.block && fc.block.n > 1) html += `<p class="copies">One of <b>${fc.block.n}</b> copies of this formula in ${esc(m.sheets[sheet].name)}!${fc.block.rangeText}${fc.block.label ? ` (“${esc(fc.block.label)}”${fc.block.span ? `, ${esc(fc.block.span)}` : ""})` : ""}.</p>`;
    html += `</section>`;
    const up = m.upstream(fc);
    const ins = up.inputs.filter((p) => p.cell && p.cell.role === "input");
    if (ins.length) {
      const shown = ins.slice(0, 12);
      html += `<section class="insp-sec"><h4>Built from ${ins.length} input${ins.length > 1 ? "s" : ""}${up.formulas.size ? ` through ${up.formulas.size} formula${up.formulas.size > 1 ? "s" : ""}` : ""}</h4><ol class="mini">${shown.map((p) => cellRow(p.sheet, p.c, p.r)).join("")}</ol>${ins.length > shown.length ? `<p class="muted">…and ${fmtNum(ins.length - shown.length)} more. <button class="linkish" data-inputs-for="${sheet},${c},${r}">Browse all these inputs</button></p>` : ""}</section>`;
    }
  }
  if (cell) {
    const deps = [...m.dependentsOf(sheet, c, r)];
    if (deps.length) {
      const down = m.downstream(sheet, c, r);
      const sheetsHit = new Set([...down].map((f) => f.sheet));
      const outs = [...down].filter((f) => f.cell.role === "output");
      html += `<section class="insp-sec"><h4>If you change this</h4>
        <p class="impact">${down.truncated ? "At least " : ""}<b>${fmtNum(down.size)}</b> known dependent cell${down.size === 1 ? "" : "s"} on <b>${sheetsHit.size}</b> sheet${sheetsHit.size === 1 ? "" : "s"} may be affected${outs.length ? `, including ${outs.length} final result${outs.length > 1 ? "s" : ""}` : ""}.</p>${dependencyWarning(m)}
        <ol class="mini">${deps.slice(0, 8).map((d) => cellRow(d.sheet, d.c, d.r, "uses it directly")).join("")}</ol>
        ${deps.length > 8 ? `<p class="muted">…and ${deps.length - 8} more that use it directly.</p>` : ""}
        ${outs.length && outs.length !== deps.length ? `<p class="sub-h">Final results it reaches</p><ol class="mini">${outs.slice(0, 6).map((d) => cellRow(d.sheet, d.c, d.r)).join("")}</ol>` : ""}
        <button class="ghost small" id="showDown">Highlight everything downstream on this sheet</button>
      </section>`;
    } else if (cell.fc) html += `<section class="insp-sec"><h4>If you change this</h4><p class="muted">No known formula references use this cell. It may be a final result (or left over).</p>${dependencyWarning(m)}</section>`;
    else if (!cell.fc) html += `<section class="insp-sec"><h4>If you change this</h4><p class="muted">No known formula references read this value.</p>${dependencyWarning(m)}</section>`;
  }
  el.innerHTML = html;
  const sd = $("#showDown", el);
  if (sd) sd.addEventListener("click", () => {
    const down = m.downstream(sheet, c, r);
    S.hi.down = new Set([...down].filter((f) => f.sheet === sheet).map((f) => f.c + "," + f.r));
    if (S.view === "sheet" && S.grid) drawRows(S.grid);
    sd.textContent = `${S.hi.down.size} highlighted on this sheet${down.size > S.hi.down.size ? `, ${down.size - S.hi.down.size} more elsewhere` : ""}`;
  });
  bindOnce(el);
}

function showRepairPreview(id, button) {
  const issue = S.model.issues[id], result = previewRepair(S.model, issue);
  if (!result.ok) { button.nextElementSibling.innerHTML = `<p class="coverage-warning">${esc(result.reason)}</p>`; return; }
  showScenarioPreview(issue, result, button);
}

function showInputPreview([sheet,c,r], button) {
  showScenarioPreview({ sheet,c,r, kind:'input' }, null, button);
  if (button.dataset.suggested) {
    const editor = $('.scenario-editor', $('#repairDialog'));
    editor.elements.value.value = button.dataset.suggested;
    editor.requestSubmit();
  }
}

function scenarioPath(m, changed) {
  const groups = new Map();
  for (const row of changed) {
    if (!groups.has(row.sheet)) groups.set(row.sheet, []);
    groups.get(row.sheet).push(row);
  }
  const ordered = [...groups].sort((a,b) => Number(b[1].some((r)=>r.target)) - Number(a[1].some((r)=>r.target)) || m.sheets[a[0]].layer - m.sheets[b[0]].layer || a[0]-b[0]);
  return `<div class="scenario-path" aria-label="Calculated changes grouped by sheet">${ordered.map(([sheet,rows],i) => {
    const example = rows.find((r)=>r.target) || (i===ordered.length-1 ? rows[0] : rows.find((r)=>m.cell(r.sheet,r.c,r.r)?.role === 'output') || rows[rows.length-1]);
    return `${i ? '<span class="scenario-arrow" aria-hidden="true">→</span>' : ''}<div class="scenario-sheet"><b>${esc(m.sheets[sheet].name)}</b><small>${rows.length} previewed cell${rows.length===1?'':'s'}</small><span>${esc(m.labelText(example.sheet,example.c,example.r) || addr(example.c,example.r))}</span><small>${esc(m.where(example.sheet,example.c,example.r))}</small><div class="repair-values"><span>${esc(fmtValue(m.cell(sheet,example.c,example.r),example.before))}</span><span>→</span><b>${esc(fmtValue(m.cell(sheet,example.c,example.r),example.after))}</b></div></div>`;
  }).join('')}</div><p class="small">Sheets ordered from the changed cell toward results. Cards summarize calculated changes; arrows show that order, not every individual reference.</p>`;
}

function showScenarioPreview(change, initialResult, button) {
  const m = S.model, input = change.kind === 'input', target = m.cell(change.sheet,change.c,change.r);
  const where = m.where(change.sheet,change.c,change.r);
  const heading = input ? 'What this input could change' : 'What this repair could change';
  const explanation = input ? 'One change using original saved inputs. Workbook unchanged. Existing formulas, including any mistakes, stay as written. Previews do not combine.' : 'Temporary calculation using saved inputs. Your file is unchanged. This proposed formula follows a pattern; confirm it matches the intended business logic in Excel.';
  $('#repairDialog')?.remove();
  const dialog = document.createElement('dialog'); dialog.id = 'repairDialog'; dialog.className = 'repair-dialog';
  dialog.dataset.kind = input ? 'input' : 'repair';
  dialog.setAttribute('aria-label', input ? 'Temporary input scenario' : 'Proposed repair preview');
  const type = typeof target.value === 'boolean' ? 'boolean' : typeof target.value;
  const raw = target.fmt === 'pct' ? `${target.value*100}%` : String(target.value);
  dialog.innerHTML = `<div class="repair-dialog-head"><span>${esc(S.fileName)} · local preview</span><div class="repair-actions"><button class="ghost download-repair" ${input?'disabled':''}>Save report</button><button class="ghost close-repair">Close preview</button></div></div>
    ${input ? `<form class="scenario-editor"><div><b>${esc(m.labelText(change.sheet,change.c,change.r)||where)}</b><small>${esc(where)} · saved value ${esc(fmtValue(target))}</small></div><label>Value type <select name="type" aria-label="Value type"><option value="number" ${type==='number'?'selected':''}>Number</option><option value="text" ${type==='string'?'selected':''}>Text</option><option value="boolean" ${type==='boolean'?'selected':''}>TRUE / FALSE</option></select></label><label>Temporary value <input name="value" aria-label="Temporary value" value="${esc(raw)}" autocomplete="off"></label><button class="ghost">Preview effects</button><details class="scenario-help"><summary>Value entry help</summary><p class="small">Numbers: no commas or currency symbols; percentages such as 30% work. Dates use Excel’s numeric serial. Text is literal, even if it starts with =.</p></details><p class="scenario-error" role="status"></p></form>` : ''}
    <div class="repair-slot" aria-live="polite"></div>`;
  document.body.append(dialog);
  const slot = $('.repair-slot', dialog);
  let result = initialResult, changed = [];
  const format = (row, field) => fmtValue(m.cell(row.sheet, row.c, row.r), row[field]);
  const difference = (row) => typeof row.before === 'number' && typeof row.after === 'number' ? fmtValue(m.cell(row.sheet,row.c,row.r),row.after-row.before) : 'Value changed';
  const limits = () => `${result.skipped.length} unsupported or unverified; ${result.unchecked} not checked${result.truncated ? '; downstream search capped' : ''}.`;
  const render = () => {
    for (const save of dialog.querySelectorAll('.download-repair')) save.disabled = !result?.ok;
    if (!result) { slot.innerHTML = `<section class="repair-preview"><h4>${heading}</h4><p>Enter a value above, then preview its effects on known dependent cells.</p><p>${explanation}</p>${dependencyWarning(m)}</section>`; return; }
    if (!result.ok) { slot.innerHTML = `<p class="coverage-warning">${esc(result.reason)}</p>`; return; }
    changed = [...result.changed].sort((a,b) => Number(b.target||false)-Number(a.target||false) || m.sheets[a.sheet].layer-m.sheets[b.sheet].layer || a.sheet-b.sheet || a.r-b.r || a.c-b.c);
    const changeRow = (row) => `<li class="repair-step"><button class="linkish" data-cell="${row.sheet},${row.c},${row.r}">${esc(m.labelText(row.sheet,row.c,row.r)||m.where(row.sheet,row.c,row.r))}</button><small>${esc(m.where(row.sheet,row.c,row.r))}${row.target ? input ? ' · temporary input' : ' · proposed repair' : m.cell(row.sheet,row.c,row.r).role==='output' ? ' · final result' : ''}</small><div class="repair-values"><span>${esc(format(row,'before'))}</span><span aria-label="becomes">→</span><b>${esc(format(row,'after'))}</b></div><small>Difference: ${esc(difference(row))}</small></li>`;
    const results = changed.filter((r)=>!r.target).sort((a,b) => m.sheets[b.sheet].layer-m.sheets[a.sheet].layer || a.r-b.r || a.c-b.c).slice(0,3);
    slot.innerHTML = `<section class="repair-preview"><h4>${heading}</h4>${input ? `<p class="scenario-value"><b>${esc(where)}</b>: ${esc(format(changed[0],'before'))} → <b>${esc(format(changed[0],'after'))}</b></p>` : `<code class="ftext">=${esc(result.formula.replace(/^=/,''))}</code>`}
      <p>${explanation}</p><p><b>${changed.length-1} dependent cells change</b> on ${new Set(changed.filter((r)=>!r.target).map((r)=>r.sheet)).size} sheets. ${result.unchanged} known dependents keep the same value.</p>
      ${dependencyWarning(m)}${result.complete ? '' : `<p class="coverage-warning">Partial preview: ${esc(limits())} Only calculated paths appear below. Recalculate in Excel before relying on these values.</p>`}
      ${results.length ? `<div class="repair-outcomes">${results.map((r)=>`<div class="repair-outcome"><span>${esc(m.labelText(r.sheet,r.c,r.r)||m.where(r.sheet,r.c,r.r))}</span><small>${esc(m.where(r.sheet,r.c,r.r))}</small><div class="repair-values"><span>${esc(format(r,'before'))}</span><span>→</span><b>${esc(format(r,'after'))}</b></div><small>Difference: ${esc(difference(r))}</small></div>`).join('')}</div>` : ''}
      ${result.complete ? '<p class="recalc">All known affected cells were checked in this preview. Untangle’s calculations may differ from Excel.</p>' : ''}
      <h4>Across the sheets</h4>${scenarioPath(m,changed)}
      <details class="scenario-details"><summary>Every previewed cell (${changed.length})</summary><ol class="repair-path">${changed.slice(0,50).map(changeRow).join('')}</ol>${changed.length>50 ? `<p>Showing the first 50 of ${changed.length} changes. The downloaded report includes them all.</p>` : ''}</details>
      ${result.skipped.length ? `<details><summary>${result.skipped.length} paths we could not calculate</summary><ol>${result.skipped.slice(0,20).map((r)=>`<li>${esc(m.where(r.sheet,r.c,r.r))}: ${esc(r.reason)}</li>`).join('')}</ol>${result.skipped.length>20?'<p>More paths are listed in the downloaded report.</p>':''}</details>` : ''}
      <p class="small">Save report keeps every calculated change and the sheet overview. It contains workbook names, formulas and values. It is saved locally; share it only with people you choose.</p></section>`;
    slot.scrollTop = 0;
  };
  if (input) {
    const editor = $('.scenario-editor',dialog);
    editor.addEventListener('submit', (e) => {
      e.preventDefault();
      $('.scenario-error',editor).textContent = '';
      try { result = previewInput(m,change,parseInputValue(editor.elements.value.value,editor.elements.type.value)); }
      catch (e) { result = {ok:false,reason:e.message}; $('.scenario-error',editor).textContent = e.message; }
      render();
    });
    editor.addEventListener('input', () => { result=null; $('.scenario-error',editor).textContent=''; render(); });
  }
  $('.close-repair', dialog).onclick = () => dialog.close();
  dialog.addEventListener('close', () => { dialog.remove(); if (button.isConnected) button.focus(); });
  bindRowButtons(dialog);
  dialog.addEventListener('click', (e) => { if (e.target.closest('[data-cell]')) dialog.close(); });
  $('.download-repair',dialog).onclick = () => {
    if (!result?.ok) return;
    const reportRows = changed.map((row)=>`<tr><td>${esc(m.where(row.sheet,row.c,row.r))}</td><td>${esc(m.labelText(row.sheet,row.c,row.r)||'')}</td><td>${esc(format(row,'before'))}</td><td>${esc(format(row,'after'))}</td><td>${esc(difference(row))}</td></tr>`).join('');
    const description = input ? `<p>Temporary input at ${esc(where)}: ${esc(format(changed[0],'before'))} → ${esc(format(changed[0],'after'))}</p>` : `<p>${esc(change.title)}</p><p>${esc(change.detail)}</p><p>Proposed formula at ${esc(where)}: <code>=${esc(result.formula.replace(/^=/,''))}</code></p>`;
    const report = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Untangle ${input?'input scenario':'repair preview'}</title><style>body{font:16px system-ui;max-width:1100px;margin:30px auto;padding:20px;color:#182230}table{border-collapse:collapse;display:block;overflow:auto}th,td{padding:10px;border:1px solid #ddd;text-align:left}code,p,li{overflow-wrap:anywhere}h1{font-size:26px}.scenario-path{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.scenario-sheet{border:1px solid #a6d8c4;border-radius:10px;padding:14px;max-width:260px;overflow-wrap:anywhere}.scenario-sheet>b,.scenario-sheet>small,.scenario-sheet>span{display:block}.scenario-sheet small{font-size:12px;color:#4a5565}.repair-values{margin-top:10px;font-size:14px}.repair-values b{color:#13704b}</style><h1>Untangle · ${input?'temporary input scenario':'proposed repair'}</h1><p>Workbook: ${esc(S.fileName)}</p>${description}<p>${explanation} The workbook was not edited. Untangle's calculations may differ from Excel. Recalculate in Excel before relying on these values.</p>${dependencyWarning(m)}<p>${result.complete?'All known affected cells were checked.':'Partial preview: '+esc(limits())} ${result.unchanged} dependents keep the same value.</p><h2>Across the sheets</h2>${scenarioPath(m,changed)}<h2>Every previewed cell</h2><table><thead><tr><th>Cell</th><th>Nearby heading</th><th>Saved value</th><th>Preview value</th><th>Difference</th></tr></thead><tbody>${reportRows}</tbody></table><h2>Paths we could not calculate (${result.skipped.length})</h2><ul>${result.skipped.map((r)=>`<li>${esc(m.where(r.sheet,r.c,r.r))}: ${esc(r.reason)}</li>`).join('')}</ul><p>Created locally with Untangle. Contains private workbook information; share deliberately.</p>`;
    const url = URL.createObjectURL(new Blob([report], {type:'text/html;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = input ? 'untangle-input-scenario.html' : 'untangle-repair-preview.html'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  render(); dialog.showModal();
  if (input) $('.scenario-editor input',dialog).focus();
}

function bindOnce(el) {
  if (el.dataset.bound) return;
  el.dataset.bound = "1";
  bindRowButtons(el);
}

function dependencyWarning(m) {
  return m.dependencyGaps.length ? `<p class="coverage-warning">Incomplete dependency map: ${esc(m.dependencyGaps.join(', '))} can hide links. Counts and highlights include only known dependencies; other cells may also be affected.</p>` : '';
}

function roleText(cell) {
  if (!cell) return "";
  return {
    input: "Input: a typed value that formulas use",
    calc: "Calculation: used by other formulas",
    output: "Result: no known formula references use it",
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
  return { single, range: rg, sheet: ref.sheet, c: rg.c1, r: rg.r1, label, n, where: `${ref.sheet !== fc.sheet ? sheetName + "!" : ""}${rangeText(rg)}` };
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
    case "ref": case "table": {
      const info = refInfo(n, fc);
      if (info && info.range && info.range.r2 < info.range.r1) return `<span class="tn ref">${esc(n.table + n.spec)}</span><span class="tv">empty table</span>`;
      if (!info) return `<span class="tn ref ext">${esc(n.text || n.table + n.spec)}</span> <span class="muted">${n.ext != null ? "in another file" : ""}</span>`;
      const shownVal = info.single ? `<span class="tv">${esc(info.cell ? fmtValue(info.cell) : "blank")}</span>` : `<span class="tv muted">${info.n ? info.n + " cells" : "whole " + (n.range?.wholeCol ? "column" : "row")}</span>`;
      return `<button class="tn ref" ${info.single ? `data-cell="${info.sheet},${info.c},${info.r}"` : `data-range="${info.sheet},${info.range.c1},${info.range.c2},${info.range.r1},${info.range.r2}"`}><span class="ta">${esc(n.type === "table" ? n.table + n.spec : info.where)}</span>${n.type === "table" ? `<span class="tl">${esc(info.where)}</span>` : ""}${info.label ? `<span class="tl">${esc(info.label)}</span>` : ""}</button>${shownVal}`;
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
      case "ref": case "table": {
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
