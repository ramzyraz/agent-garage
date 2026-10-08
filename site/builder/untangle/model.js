// Turns a parsed workbook into a map: who depends on whom, which formulas are
// copies of each other (blocks), which numbers are the inputs, and what looks wrong.

import { evaluate, sameValue, Unsupported } from "./evaluate.js";
import { parse, walk, r1c1Key, shiftFormula, rangeText, addr, numToCol, MAX_ROW, MAX_COL } from "./formula.js";

const AGG = new Set(["SUM", "AVERAGE", "MIN", "MAX", "COUNT", "COUNTA", "PRODUCT", "SUMPRODUCT", "MEDIAN", "STDEV", "STDEV.S", "AVERAGEA"]);
const UNTRACEABLE = new Set(["INDIRECT", "OFFSET"]);
// Numeric arguments that are positions or settings, not business numbers.
const POSITIONAL = {
  ROUND: [1], ROUNDUP: [1], ROUNDDOWN: [1], TRUNC: [1], FIXED: [1], VLOOKUP: [2, 3], HLOOKUP: [2, 3], INDEX: [1, 2, 3],
  MATCH: [2], XLOOKUP: [4, 5], XMATCH: [2, 3], CHOOSE: [0], OFFSET: [1, 2, 3, 4], LEFT: [1], RIGHT: [1], MID: [1, 2],
  DATE: [0, 1, 2], EDATE: [1], EOMONTH: [1], WEEKDAY: [1], SUBTOTAL: [0], AGGREGATE: [0, 1], TEXT: [1], LARGE: [1], SMALL: [1],
  RANK: [2], "RANK.EQ": [2], PERCENTILE: [1], QUANTILE: [1], IFERROR: [1], IFNA: [1], NETWORKDAYS: [], SEQUENCE: [0, 1, 2, 3],
  TAKE: [1, 2], DROP: [1, 2], CHOOSECOLS: [1, 2, 3, 4], CHOOSEROWS: [1, 2, 3, 4], SORT: [1, 2, 3], FILTER: [2], UNIQUE: [1, 2],
  ADDRESS: [0, 1, 2, 3], LOG: [1], POWER: [1], MOD: [1], CEILING: [1], FLOOR: [1], MROUND: [1], DATEDIF: [], YEARFRAC: [2],
  IF: [], SWITCH: [], RANDBETWEEN: [0, 1], SUMIF: [1], SUMIFS: [], COUNTIF: [1], COUNTIFS: [], AVERAGEIF: [1], AVERAGEIFS: [],
};
const UNIT_CONSTANTS = new Set([2, 3, 4, 6, 7, 10, 12, 24, 52, 60, 100, 365, 360, 1000, 1e6, 0.5, 3600]);

export const key = (s, c, r) => `${s}!${c},${r}`;

export function buildModel(wb, { budgetMs = 4000 } = {}) {
  const t0 = performance.now();
  const sheets = wb.sheets;
  const sheetByName = new Map(sheets.map((s) => [s.name.toLowerCase(), s]));
  const names = new Map(); // "NAME" or "NAME@sheetIndex" -> parsed refs

  const formulas = [];
  const issues = [];
  const notes = [];

  // ---- 1. parse every formula ----
  for (const sh of sheets) {
    if (!sh.cells) continue;
    sh.formulaCount = 0;
    for (const cell of sh.cells.values()) {
      if (!cell.f) continue;
      sh.formulaCount++;
      const fc = { sheet: sh.index, c: cell.c, r: cell.r, cell, f: cell.f, ast: null, refs: [], funcs: new Set(), consts: [], names: [] };
      try { fc.ast = parse(cell.f); } catch (e) { fc.parseError = e.message; }
      fc.key = r1c1Key(cell.f, cell.c, cell.r);
      cell.fc = fc;
      formulas.push(fc);
    }
  }

  // ---- 2. defined names ----
  for (const dn of wb.definedNames) {
    if (/^_xlnm\./i.test(dn.name) || dn.name.startsWith("_xl")) continue;
    let ast = null;
    try { ast = parse(dn.ref); } catch (e) { /* constants or odd names */ }
    const entry = { name: dn.name, ref: dn.ref, scope: dn.scope, hidden: dn.hidden, ast, refs: [] };
    if (ast) collectRefs(ast, entry.refs, dn.scope != null ? dn.scope : 0, null, 0, 0, new Set());
    names.set(dn.name.toUpperCase() + (dn.scope != null ? "@" + dn.scope : ""), entry);
  }

  function lookupName(nm, sheetIdx) {
    const u = nm.toUpperCase();
    return names.get(u + "@" + sheetIdx) || names.get(u);
  }

  function tableRange(node, fc) {
    const t = node.table ? wb.tables.find((x) => x.name.toLowerCase() === node.table.toLowerCase())
      : wb.tables.find((x) => fc && x.sheet === sheets[fc.sheet].name && fc.c >= x.c1 && fc.c <= x.c2 && fc.r >= x.r1 && fc.r <= x.r2);
    if (!t || t.c1 == null) return null;
    const spec = node.spec.replace(/^\[|\]$/g, "");
    const items = spec.match(/\[[^\]]*\]|[^,\[\]]+/g) || [];
    const specials = items.map((x) => x.replace(/^\[|\]$/g, "").trim()).filter(Boolean);
    let r1 = t.r1 + t.headerRows, r2 = t.r2 - t.totalsRows;
    let cols = [];
    const thisRow = /#This Row/i.test(spec) || spec.startsWith("@") || /\[@/.test(node.spec);
    for (let sp of specials) {
      sp = sp.replace(/^@/, "");
      if (/^#All$/i.test(sp)) { r1 = t.r1; r2 = t.r2; }
      else if (/^#Headers$/i.test(sp)) { r1 = r2 = t.r1; }
      else if (/^#Totals$/i.test(sp)) { r1 = r2 = t.r2; }
      else if (/^#Data$/i.test(sp) || /^#This Row$/i.test(sp)) { /* default */ }
      else {
        for (const part of sp.split(":")) {
          const nm = part.replace(/^\[|\]$/g, "").replace(/'(.)/g, "$1").trim().toLowerCase();
          const i = t.columns.findIndex((c) => c.toLowerCase() === nm);
          if (i >= 0) cols.push(t.c1 + i);
        }
      }
    }
    if (thisRow && fc) { r1 = r2 = fc.r; }
    const c1 = cols.length ? Math.min(...cols) : t.c1, c2 = cols.length ? Math.max(...cols) : t.c2;
    return { sheet: sheetByName.get(t.sheet.toLowerCase()).index, range: { c1, c2, r1, r2 } };
  }

  function collectRefs(ast, out, sheetIdx, fc, fcC, fcR, letNames) {
    walk(ast, (n, parent) => {
      if (n.type === "func" && fc) {
        fc.funcs.add(n.name);
        if (n.name === "LET" || n.name === "LAMBDA") n.args.forEach((a, i) => {
          if (a.type === "name" && (n.name === "LAMBDA" ? i < n.args.length - 1 : i % 2 === 0 && i < n.args.length - 1)) letNames.add(a.name.toUpperCase());
        });
      }
      if (n.type === "ref") {
        if (!n.range) return;
        if (n.ext != null) { out.push({ ext: n.ext, sheetName: n.sheet, range: n.range, text: n.text, node: n }); return; }
        let sIdx = sheetIdx;
        if (n.sheet) {
          if (n.sheet.includes(":")) { out.push({ threeD: true, text: n.text, node: n }); return; }
          const s = sheetByName.get(n.sheet.toLowerCase());
          if (!s) { out.push({ missingSheet: n.sheet, text: n.text, node: n }); return; }
          sIdx = s.index;
        }
        out.push({ sheet: sIdx, range: n.range, text: n.text, node: n });
      } else if (n.type === "name") {
        if (n.ext != null) { out.push({ ext: n.ext, text: `[${n.ext}]${n.sheet}!${n.name}`, node: n }); return; }
        if (letNames.has(n.name.toUpperCase()) || /^_xlpm\./i.test(n.name)) return;
        if (fc) fc.names.push(n.name);
        const nm = lookupName(n.name, n.sheet ? sheetByName.get(n.sheet.toLowerCase())?.index : sheetIdx);
        if (nm) for (const r of nm.refs) out.push({ ...r, viaName: nm.name, node: n });
        else if (fc) out.push({ unknownName: n.name, node: n });
      } else if (n.type === "table") {
        const tr = tableRange(n, fc);
        if (tr) out.push({ ...tr, text: n.table + n.spec, node: n, viaTable: true });
      } else if (n.type === "num" && fc) {
        fc.consts.push({ value: n.value, parent, node: n });
      }
    });
  }

  for (const fc of formulas) {
    if (!fc.ast) continue;
    collectRefs(fc.ast, fc.refs, fc.sheet, fc, fc.c, fc.r, new Set());
  }

  // ---- 3. cell graph (with shared range nodes so big ranges stay cheap) ----
  // Column index per sheet: column -> sorted rows of non-empty cells.
  const colIndex = sheets.map((sh) => {
    const m = new Map();
    if (!sh.cells) return m;
    for (const cell of sh.cells.values()) {
      if (!m.has(cell.c)) m.set(cell.c, []);
      m.get(cell.c).push(cell.r);
    }
    for (const arr of m.values()) arr.sort((a, b) => a - b);
    return m;
  });

  function cellsIn(sIdx, rg, limit = Infinity) {
    const out = [];
    const ci = colIndex[sIdx];
    const sh = sheets[sIdx];
    if (!sh || !sh.cells) return out;
    const cols = [...ci.keys()].filter((c) => c >= rg.c1 && c <= rg.c2).sort((a, b) => a - b);
    for (const c of cols) {
      const rows = ci.get(c);
      let lo = 0, hi = rows.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (rows[mid] < rg.r1) lo = mid + 1; else hi = mid; }
      for (let i = lo; i < rows.length && rows[i] <= rg.r2; i++) {
        out.push(sh.cells.get(c + "," + rows[i]));
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  // dependents: cellKey -> Set(fc)
  const rangeNodes = new Map(); // "s|c1|r1|c2|r2" -> { sheet, range, cells:[cell], users:[fc] }
  const directDeps = new Map(); // cell key -> [fc]
  let edgeBudget = 4e6, graphTruncated = false;
  for (const fc of formulas) {
    for (const ref of fc.refs) {
      if (ref.sheet == null) continue;
      const rg = ref.range;
      if (rg.c1 === rg.c2 && rg.r1 === rg.r2) {
        const k = key(ref.sheet, rg.c1, rg.r1);
        if (!directDeps.has(k)) directDeps.set(k, []);
        directDeps.get(k).push(fc);
        continue;
      }
      const rk = `${ref.sheet}|${rg.c1}|${rg.r1}|${rg.c2}|${rg.r2}`;
      let node = rangeNodes.get(rk);
      if (!node) {
        const list = edgeBudget > 0 ? cellsIn(ref.sheet, rg, edgeBudget) : [];
        edgeBudget -= list.length;
        if (edgeBudget <= 0) graphTruncated = true;
        node = { sheet: ref.sheet, range: rg, cells: list, users: [] };
        rangeNodes.set(rk, node);
      }
      node.users.push(fc);
      ref.rangeNode = node;
    }
  }
  // Invert range nodes: cell -> range nodes containing it.
  const cellRanges = new Map();
  for (const node of rangeNodes.values()) {
    for (const cell of node.cells) {
      const k = key(node.sheet, cell.c, cell.r);
      if (!cellRanges.has(k)) cellRanges.set(k, []);
      cellRanges.get(k).push(node);
    }
  }

  const depCache = new Map();
  const NONE = new Set();
  function dependentsOf(s, c, r) {
    const k = key(s, c, r);
    let out = depCache.get(k);
    if (out) return out;
    const d = directDeps.get(k), rs = cellRanges.get(k);
    if (!d && !rs) return NONE;
    out = new Set(d || []);
    if (rs) for (const node of rs) for (const u of node.users) out.add(u);
    depCache.set(k, out);
    return out;
  }

  function precedentCells(fc) {
    const out = [];
    for (const ref of fc.refs) {
      if (ref.sheet == null) continue;
      const rg = ref.range;
      if (rg.c1 === rg.c2 && rg.r1 === rg.r2) {
        const cell = sheets[ref.sheet].cells.get(rg.c1 + "," + rg.r1);
        out.push({ sheet: ref.sheet, c: rg.c1, r: rg.r1, cell, ref });
      } else if (ref.rangeNode) {
        for (const cell of ref.rangeNode.cells) out.push({ sheet: ref.sheet, c: cell.c, r: cell.r, cell, ref });
      }
    }
    return out;
  }

  // Transitive closure helpers (bounded).
  function downstream(s, c, r, limit = 200000) {
    const seen = new Set();
    const queue = [...dependentsOf(s, c, r)];
    for (const q of queue) seen.add(q);
    for (let i = 0; i < queue.length && seen.size < limit; i++) {
      const fc = queue[i];
      for (const d of dependentsOf(fc.sheet, fc.c, fc.r)) if (!seen.has(d)) { seen.add(d); queue.push(d); }
    }
    return seen;
  }
  function upstream(fc, limit = 200000) {
    const seenF = new Set([fc]);
    const leaves = new Map();
    const queue = [fc];
    for (let i = 0; i < queue.length && seenF.size < limit; i++) {
      for (const p of precedentCells(queue[i])) {
        if (p.cell && p.cell.fc) { if (!seenF.has(p.cell.fc)) { seenF.add(p.cell.fc); queue.push(p.cell.fc); } }
        else if (p.cell) leaves.set(key(p.sheet, p.c, p.r), p);
      }
    }
    seenF.delete(fc);
    return { formulas: seenF, inputs: [...leaves.values()] };
  }

  // ---- 4. circular references (iterative Tarjan over formula cells) ----
  const cycles = [];
  {
    const index = new Map(), low = new Map(), onStack = new Set(), stack = [];
    let idx = 0;
    const succ = (fc) => [...dependentsOf(fc.sheet, fc.c, fc.r)];
    for (const start of formulas) {
      if (index.has(start)) continue;
      const work = [[start, succ(start), 0]];
      index.set(start, idx); low.set(start, idx); idx++; stack.push(start); onStack.add(start);
      while (work.length) {
        const top = work[work.length - 1];
        const [v, ss] = top;
        if (top[2] < ss.length) {
          const w = ss[top[2]++];
          if (!index.has(w)) {
            index.set(w, idx); low.set(w, idx); idx++; stack.push(w); onStack.add(w);
            work.push([w, succ(w), 0]);
          } else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
        } else {
          work.pop();
          if (work.length) { const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
          if (low.get(v) === index.get(v)) {
            const comp = [];
            let w;
            do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
            const selfLoop = comp.length === 1 && dependentsOf(v.sheet, v.c, v.r).has(v);
            if (comp.length > 1 || selfLoop) cycles.push(comp);
          }
        }
      }
      if (performance.now() - t0 > budgetMs) { notes.push("Stopped looking for circular references early: the workbook is very large."); break; }
    }
  }

  // ---- 5. labels: what a human would call a cell ----
  function isYearLike(v) { return typeof v === "number" && Number.isInteger(v) && v >= 1900 && v <= 2100; }
  function textAt(sh, c, r) {
    const cell = sh.cells.get(c + "," + r);
    if (!cell) return null;
    if (typeof cell.value === "string" && cell.value.trim() && !cell.f) return cell.value.trim();
    if (typeof cell.value === "string" && cell.value.trim() && cell.f && !/[0-9]{3,}/.test(cell.value)) return cell.value.trim();
    return null;
  }
  const labelCache = new Map();
  // Rows in each column that could be a heading (text or a year), sorted, so lookups are a binary search.
  const headCache = new Map();
  function headerRows(s, c) {
    const k = s + "|" + c;
    let rows = headCache.get(k);
    if (rows) return rows;
    rows = [];
    for (const r of colIndex[s].get(c) || []) {
      const v = sheets[s].cells.get(c + "," + r).value;
      if ((typeof v === "string" && v.trim()) || isYearLike(v)) rows.push(r);
    }
    headCache.set(k, rows);
    return rows;
  }
  function labelOf(s, c, r) {
    const k = key(s, c, r);
    if (labelCache.has(k)) return labelCache.get(k);
    const sh = sheets[s];
    let row = null, col = null;
    for (let cc = c - 1; cc >= 1 && cc >= c - 30; cc--) { const t = textAt(sh, cc, r); if (t) { row = t; break; } }
    const heads = headerRows(s, c);
    let lo = 0, hi = heads.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (heads[mid] < r) lo = mid + 1; else hi = mid; }
    for (let hix = lo - 1; hix >= 0 && hix >= lo - 60; hix--) {
      const rr = heads[hix];
      const cell = sh.cells.get(c + "," + rr);
      // Formulas that produce text are usually results, not headers (unless they copy one, =B$3).
      if (typeof cell.value === "string" && cell.value.trim() && (!cell.f || /^\$?[A-Z]{1,3}\$\d+$/.test(cell.f.replace(/^=/, "")))) { col = cell.value.trim(); break; }
      if (isYearLike(cell.value)) {
        // A header row of years (possibly formulas like =C3+1): needs a year beside it.
        const side = [sh.cells.get((c - 1) + "," + rr), sh.cells.get((c + 1) + "," + rr)];
        if (side.some((x) => x && isYearLike(x.value))) { col = String(cell.value); break; }
      }
    }
    if (col && /^(values?|amounts?|inputs?|numbers?|figures?|assumptions?|data|#|qty)$/i.test(col)) col = null;
    const out = { row: row ? clip(row) : null, col: col ? clip(col) : null };
    labelCache.set(k, out);
    return out;
  }
  function labelText(s, c, r) {
    const l = labelOf(s, c, r);
    if (l.row && l.col && l.row !== l.col) return `${l.row} · ${l.col}`;
    if (l.row || l.col) return l.row || l.col;
    const cell = sheets[s].cells.get(c + "," + r);
    if (cell && isYearLike(cell.value)) {
      const side = [sheets[s].cells.get((c - 1) + "," + r), sheets[s].cells.get((c + 1) + "," + r)];
      if (side.some((x) => x && isYearLike(x.value))) return cell.fc ? "Year heading" : "First year (heading)";
    }
    return null;
  }

  // ---- 6. blocks: copies of the same formula, compressed ----
  const blocks = [];
  for (const sh of sheets) {
    if (!sh.cells) continue;
    const fcs = formulas.filter((f) => f.sheet === sh.index).sort((a, b) => a.c - b.c || a.r - b.r);
    // vertical runs
    const runs = [];
    let cur = null;
    for (const f of fcs) {
      if (cur && cur.key === f.key && cur.c1 === f.c && cur.r2 === f.r - 1) { cur.r2 = f.r; cur.cells.push(f); }
      else { cur = { key: f.key, c1: f.c, c2: f.c, r1: f.r, r2: f.r, cells: [f] }; runs.push(cur); }
    }
    // merge runs side by side with the same rows
    const byPos = new Map(runs.map((r) => [`${r.c1}|${r.r1}|${r.r2}|${r.key}`, r]));
    const used = new Set();
    for (const run of runs.sort((a, b) => a.c1 - b.c1 || a.r1 - b.r1)) {
      if (used.has(run)) continue;
      used.add(run);
      const b = { ...run, cells: [...run.cells] };
      for (;;) {
        const nxt = byPos.get(`${b.c2 + 1}|${b.r1}|${b.r2}|${b.key}`);
        if (!nxt || used.has(nxt)) break;
        used.add(nxt); b.c2 = nxt.c2; b.cells.push(...nxt.cells);
      }
      b.sheet = sh.index;
      b.id = blocks.length;
      b.sample = b.cells[0];
      for (const f of b.cells) f.block = b;
      blocks.push(b);
    }
  }
  for (const b of blocks) {
    const s = b.sheet;
    const n = b.cells.length;
    const horiz = b.r1 === b.r2 && b.c2 > b.c1;
    const vert = b.c1 === b.c2 && b.r2 > b.r1;
    const l = labelOf(s, b.c1, b.r1);
    if (horiz) {
      const lc1 = labelOf(s, b.c1, b.r1).col, lc2 = labelOf(s, b.c2, b.r1).col;
      b.label = l.row || l.col || null;
      b.span = lc1 && lc2 && lc1 !== lc2 ? `${lc1}–${lc2}` : null;
    } else if (vert) {
      b.label = l.col || l.row || null;
      const lr1 = labelOf(s, b.c1, b.r1).row, lr2 = labelOf(s, b.c1, b.r2).row;
      b.span = lr1 && lr2 && lr1 !== lr2 ? `${lr1}–${lr2}` : null;
    } else b.label = labelText(s, b.c1, b.r1);
    b.n = n;
    b.rangeText = rangeText(b);
  }

  // ---- 7. roles ----
  const sheetEdges = new Map(); // "a>b" -> count
  for (const fc of formulas) {
    for (const ref of fc.refs) {
      if (ref.sheet == null || ref.sheet === fc.sheet) continue;
      const k = `${ref.sheet}>${fc.sheet}`;
      sheetEdges.set(k, (sheetEdges.get(k) || 0) + 1);
    }
  }
  const inputs = [];
  for (const sh of sheets) {
    if (!sh.cells) continue;
    sh.counts = { input: 0, calc: 0, output: 0, label: 0, data: 0 };
    for (const cell of sh.cells.values()) {
      const deps = dependentsOf(sh.index, cell.c, cell.r);
      if (cell.fc) {
        cell.role = deps.size ? "calc" : "output";
      } else if (typeof cell.value === "number" || typeof cell.value === "boolean" || (cell.value && cell.value.error)) {
        cell.role = deps.size ? "input" : "data";
        if (deps.size) inputs.push({ sheet: sh.index, c: cell.c, r: cell.r, cell, direct: deps.size });
      } else if (typeof cell.value === "string") {
        cell.role = deps.size ? "input" : "label";
        if (deps.size) inputs.push({ sheet: sh.index, c: cell.c, r: cell.r, cell, direct: deps.size });
      } else cell.role = "data";
      sh.counts[cell.role]++;
    }
  }
  // How far does each input reach? (bounded by time)
  let impactExact = true;
  inputs.sort((a, b) => b.direct - a.direct);
  const tReach = performance.now();
  for (const inp of inputs) {
    if (performance.now() - tReach > budgetMs / 4) { impactExact = false; inp.reach = inp.direct; continue; }
    const ds = downstream(inp.sheet, inp.c, inp.r, 50000);
    inp.reach = ds.size;
    inp.reachSheets = new Set([...ds].map((f) => f.sheet));
    inp.reachOutputs = [...ds].filter((f) => f.cell.role === "output").length;
  }
  inputs.sort((a, b) => b.reach - a.reach || b.direct - a.direct);
  for (const inp of inputs) inp.label = labelText(inp.sheet, inp.c, inp.r);

  // ---- 8. risk flags ----
  const flag = (type, severity, at, title, detail, extra = {}) => issues.push({ type, severity, ...at, title, detail, ...extra });
  const where = (s, c, r) => `${sheets[s].name}!${addr(c, r)}`;

  // 8a. formulas that fail to parse (we tell the truth about our limits)
  const unparsed = formulas.filter((f) => f.parseError);
  if (unparsed.length) notes.push(`${unparsed.length} formula${unparsed.length > 1 ? "s" : ""} used syntax Untangle couldn't read; their links may be missing.`);

  // 8b. errors
  const errBlocks = new Map();
  for (const fc of formulas) {
    const v = fc.cell.value;
    const hasRefErr = /#REF!/i.test(fc.f);
    if (!(v && v.error) && !hasRefErr) continue;
    const b = fc.block;
    if (errBlocks.has(b)) continue;
    errBlocks.set(b, true);
    const cellsTxt = b.n > 1 ? `${sheets[b.sheet].name}!${b.rangeText} (${b.n} cells)` : where(fc.sheet, fc.c, fc.r);
    if (hasRefErr) flag("ref-error", "high", { sheet: fc.sheet, c: fc.c, r: fc.r, block: b.id }, `Broken reference (#REF!) in ${cellsTxt}`,
      "A cell or sheet this formula pointed to was deleted. Excel replaced the address with #REF!, so the formula can never work.");
    else flag("error", "high", { sheet: fc.sheet, c: fc.c, r: fc.r, block: b.id }, `${v.error} error in ${cellsTxt}`,
      "Excel saved an error here. Anything that uses this cell inherits it unless it is caught with IFERROR.");
  }

  // 8c. hard-coded numbers inside formulas, reported once per block
  for (const b of blocks) {
    const fc = b.sample;
    if (/#REF!/i.test(fc.f)) continue; // already reported as broken
    const found = [];
    for (const k of fc.consts) {
      const v = k.value;
      if (v === 0 || v === 1) continue;
      const p = k.parent;
      if (p && p.type === "func") {
        const pos = POSITIONAL[p.name];
        const ai = p.args.indexOf(k.node);
        if (pos && (pos.includes(ai) || pos.length === 0 && ["IF", "SWITCH", "SUMIFS", "COUNTIFS", "AVERAGEIFS", "SUMIF", "COUNTIF"].includes(p.name) && ai !== 0)) continue;
      }
      if (p && p.type === "bin" && p.op === "^" && p.right === k.node && v === 2) continue;
      if (p && p.type === "array") continue;
      if (p && p.type === "unary" && k.value === 1) continue;
      if (isYearLike(v)) continue;
      found.push(v);
    }
    if (!found.length) continue;
    const business = found.filter((v) => !UNIT_CONSTANTS.has(Math.abs(v)));
    if (!business.length) continue;
    const shown = [...new Set(business)].slice(0, 3).map(fmtNum).join(", ");
    const cellsTxt = b.n > 1 ? `${sheets[b.sheet].name}!${b.rangeText} (${b.n} copies)` : where(fc.sheet, fc.c, fc.r);
    flag("hardcoded", "medium", { sheet: fc.sheet, c: fc.c, r: fc.r, block: b.id },
      `${shown} typed into the formula${b.label ? ` for “${b.label}”` : ""}`,
      `${cellsTxt}: ${fc.f.startsWith("=") ? fc.f : "=" + fc.f}. ${b.n > 1 ? "If this number ever changes, someone has to find and edit every copy." : "If this number ever changes, someone has to know it's hiding here."} Assumptions are safer in their own labelled cell.`,
      { values: business });
  }

  // 8d. pattern breaks: a typed number or a different formula in the middle of a row/column of copies
  for (const sh of sheets) {
    if (!sh.cells) continue;
    for (const cell of sh.cells.values()) {
      for (const [dc, dr, dir] of [[1, 0, "row"], [0, 1, "column"]]) {
        const a = sh.cells.get((cell.c - dc) + "," + (cell.r - dr));
        const b = sh.cells.get((cell.c + dc) + "," + (cell.r + dr));
        if (!a || !b || !a.fc || !b.fc || a.fc.key !== b.fc.key) continue;
        // The neighbours must really be copies along this direction, not a coincidence.
        const along = (blk) => blk && (dc ? blk.c2 > blk.c1 : blk.r2 > blk.r1);
        if (!along(a.fc.block) && !along(b.fc.block)) continue;
        // Ignore the end of a row/column that is a total of it.
        if (cell.fc && cell.fc.key === a.fc.key) continue;
        const at = { sheet: sh.index, c: cell.c, r: cell.r };
        const lbl = labelText(sh.index, cell.c, cell.r);
        const nice = `${where(sh.index, cell.c, cell.r)}${lbl ? ` (“${lbl}”)` : ""}`;
        if (!cell.fc && typeof cell.value === "number") {
          flag("override", "high", at, `Typed number where a formula should be: ${nice}`,
            `Both neighbours in this ${dir} calculate it with a formula, but this cell holds a typed ${fmtNum(cell.value)}. Following the pattern, it would be =${shiftFormula(a.fc.f, cell.c - a.c, cell.r - a.r)}. A typed number won't update when the inputs change. This is the classic hidden spreadsheet error.`,
            { expected: shiftFormula(a.fc.f, cell.c - a.c, cell.r - a.r) });
        } else if (cell.fc && cell.fc.key !== a.fc.key) {
          flag("inconsistent", "high", at, `Formula breaks the pattern of its ${dir}: ${nice}`,
            `Its neighbours both compute =${b.fc.f.replace(/^=/, "")} (relative to their position), but this one is =${cell.f.replace(/^=/, "")}. Sometimes that's deliberate; often it's a slip.`);
        }
        break;
      }
    }
  }

  // 8e. ranges that stop one short
  for (const b of blocks) {
    const fc = b.sample;
    if (!fc.ast) continue;
    walk(fc.ast, (n) => {
      if (n.type !== "func" || !AGG.has(n.name)) return;
      for (const arg of n.args) {
        if (arg.type !== "ref" || !arg.range || arg.range.wholeCol || arg.range.wholeRow) continue;
        const ref = fc.refs.find((x) => x.node === arg);
        if (!ref || ref.sheet == null) continue;
        const rg = arg.range;
        const sh = sheets[ref.sheet];
        const isCol = rg.c1 === rg.c2 && rg.r2 > rg.r1, isRow = rg.r1 === rg.r2 && rg.c2 > rg.c1;
        if (!isCol && !isRow) continue;
        const len = isCol ? rg.r2 - rg.r1 + 1 : rg.c2 - rg.c1 + 1;
        const inside = cellsIn(ref.sheet, rg);
        const numericInside = inside.filter((c) => typeof c.value === "number").length;
        if (numericInside < Math.max(2, len * 0.6)) continue;
        for (const [nc, nr, end] of isCol ? [[rg.c1, rg.r2 + 1, "after"], [rg.c1, rg.r1 - 1, "before"]] : [[rg.c2 + 1, rg.r1, "after"], [rg.c1 - 1, rg.r1, "before"]]) {
          if (nc < 1 || nr < 1) continue;
          if (ref.sheet === fc.sheet && nc === fc.c && nr === fc.r) continue;
          const nb = sh.cells.get(nc + "," + nr);
          if (!nb || typeof nb.value !== "number") continue;
          // A neighbouring total of the same range is not a missed item.
          if (nb.fc && nb.fc.funcs.has(n.name)) continue;
          if (nb.fc && nb.fc.refs.some((x) => x.sheet === ref.sheet && x.range && x.range.c1 <= rg.c1 && x.range.c2 >= rg.c2 && x.range.r1 <= rg.r1 && x.range.r2 >= rg.r2)) continue;
          const nl = labelOf(ref.sheet, nc, nr);
          const nlbl = (isCol ? nl.row : nl.col) || null;
          if (nlbl && /total|sum|average|avg|mean|subtotal/i.test(nlbl)) continue;
          // The neighbour should look like a sibling of the range: same kind of cell.
          const sibling = inside[end === "after" ? inside.length - 1 : 0];
          if (!sibling || (!!sibling.fc !== !!nb.fc)) continue;
          if (sibling.fc && nb.fc && sibling.fc.key !== nb.fc.key) continue;
          const cellsTxt = b.n > 1 ? `${sheets[b.sheet].name}!${b.rangeText}` : where(fc.sheet, fc.c, fc.r);
          flag("short-range", "high", { sheet: fc.sheet, c: fc.c, r: fc.r, block: b.id },
            `${n.name} range stops one ${isCol ? "row" : "column"} short in ${cellsTxt}`,
            `${n.name}(${arg.text}) leaves out ${sh.name}!${addr(nc, nr)}${nlbl ? ` (“${nlbl}”, ${fmtNum(nb.value)})` : ` (${fmtNum(nb.value)})`}, right ${end === "after" ? (isCol ? "below" : "beside") : (isCol ? "above" : "before")} it, which looks like part of the same list.`,
            { missed: { sheet: ref.sheet, c: nc, r: nr } });
          return;
        }
      }
    });
  }

  // 8f. references to empty cells (single cells only)
  {
    const seen = new Set();
    for (const b of blocks) {
      const fc = b.sample;
      for (const ref of fc.refs) {
        if (ref.sheet == null || ref.viaName || ref.viaTable) continue;
        const rg = ref.range;
        if (rg.c1 !== rg.c2 || rg.r1 !== rg.r2) continue;
        const target = sheets[ref.sheet].cells.get(rg.c1 + "," + rg.r1);
        if (target) continue;
        // ISBLANK / ="" checks are deliberate.
        if (fc.funcs.has("ISBLANK") || /""/.test(fc.f)) continue;
        const k = `${b.id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        flag("empty-ref", "medium", { sheet: fc.sheet, c: fc.c, r: fc.r, block: b.id },
          `Uses an empty cell: ${sheets[ref.sheet].name}!${addr(rg.c1, rg.r1)}`,
          `${b.n > 1 ? `${sheets[b.sheet].name}!${b.rangeText}` : where(fc.sheet, fc.c, fc.r)} reads ${ref.text}, which is blank, so Excel treats it as 0. Was a value deleted or a row moved?`,
          { target: { sheet: ref.sheet, c: rg.c1, r: rg.r1 } });
      }
    }
  }

  // 8g. untraceable functions, external links, missing sheets, unknown names
  for (const b of blocks) {
    const fc = b.sample;
    const cellsTxt = b.n > 1 ? `${sheets[b.sheet].name}!${b.rangeText} (${b.n} cells)` : where(fc.sheet, fc.c, fc.r);
    const at = { sheet: fc.sheet, c: fc.c, r: fc.r, block: b.id };
    const un = [...fc.funcs].filter((f) => UNTRACEABLE.has(f));
    if (un.length) flag("untraceable", "medium", at, `${un.join(" and ")} hides where data comes from: ${cellsTxt}`,
      `${un.join("/")} builds its reference while Excel calculates, so nobody (including Untangle) can see from the formula which cells it really reads. The map may be missing links here.`);
    const ext = fc.refs.filter((r) => r.ext != null);
    if (ext.length) {
      const e = typeof ext[0].ext === "number" ? wb.externals[ext[0].ext - 1] : { file: ext[0].ext };
      flag("external", "medium", at, `Pulls numbers from another file: ${cellsTxt}`,
        `It reads ${ext[0].text}${e ? ` in “${e.file}”` : ""}. That workbook is not open here, so its dependencies and values cannot be verified. Excel’s saved result is shown.`, { file: e ? e.file : null });
    }
    const ms = fc.refs.filter((r) => r.missingSheet);
    if (ms.length) flag("ref-error", "high", at, `Points to a sheet that doesn't exist: ${cellsTxt}`, `It reads ${ms[0].text}, but there's no sheet called “${ms[0].missingSheet}”.`);
    const unk = fc.refs.filter((r) => r.unknownName);
    if (unk.length) flag("unknown-name", "medium", at, `Unknown name “${unk[0].unknownName}” in ${cellsTxt}`, "This name isn't defined in the workbook, so Excel would show #NAME?, unless it comes from an add-in.");
  }

  // 8h. circular references
  for (const comp of cycles) {
    const f = comp[0];
    flag("circular", "high", { sheet: f.sheet, c: f.c, r: f.r }, `Circular reference through ${comp.length} cell${comp.length > 1 ? "s" : ""}`,
      `${comp.slice(0, 6).map((x) => where(x.sheet, x.c, x.r)).join(" → ")}${comp.length > 6 ? " → …" : ""} depend on themselves. Excel either refuses to calculate or iterates, and the result depends on settings you can't see.`,
      { cycle: comp.map((x) => ({ sheet: x.sheet, c: x.c, r: x.r })) });
  }

  // 8i. hidden sheets that feed visible ones
  for (const sh of sheets) {
    if (sh.state === "visible") continue;
    const feeds = [...sheetEdges.entries()].filter(([k]) => +k.split(">")[0] === sh.index && sheets[+k.split(">")[1]].state === "visible");
    const n = feeds.reduce((s, [, v]) => s + v, 0);
    flag("hidden", n ? "medium" : "info", { sheet: sh.index, c: 1, r: 1 }, `${sh.state === "veryHidden" ? "Very hidden" : "Hidden"} sheet: ${sh.name}`,
      n ? `${n} formula reference${n > 1 ? "s" : ""} on visible sheets read from it, so part of the logic is out of sight.${sh.state === "veryHidden" ? " “Very hidden” sheets can't even be unhidden from Excel's menu, only with VBA." : ""}`
        : `Nothing on visible sheets reads from it.${sh.state === "veryHidden" ? " “Very hidden” sheets can only be unhidden with VBA." : ""}`);
  }

  // 8j. unused assumptions: a labelled number in an inputs list that nothing reads
  for (const sh of sheets) {
    if (!sh.cells || !sh.counts || sh.counts.input < 3) continue;
    for (const cell of sh.cells.values()) {
      if (cell.role !== "data" || typeof cell.value !== "number") continue;
      const lbl = labelOf(sh.index, cell.c, cell.r).row;
      if (!lbl || /note|total|source|version|year|date/i.test(lbl)) continue;
      // Neighbours above/below in the same column are used inputs: this is an assumptions list.
      const up = sh.cells.get(cell.c + "," + (cell.r - 1)), dn = sh.cells.get(cell.c + "," + (cell.r + 1));
      if (!((up && up.role === "input") || (dn && dn.role === "input"))) continue;
      flag("unused-input", "medium", { sheet: sh.index, c: cell.c, r: cell.r }, `Assumption nobody uses: “${lbl}” (${fmtValue(cell)})`,
        `${where(sh.index, cell.c, cell.r)} sits in a list of inputs, but no formula reads it. Either it's left over, or a formula that should use it has the number typed in instead.`);
    }
  }

  // Link related findings: an unused input whose value appears typed in a formula.
  for (const u of issues.filter((i) => i.type === "unused-input")) {
    const v = sheets[u.sheet].cells.get(u.c + "," + u.r).value;
    const hc = issues.find((i) => i.type === "hardcoded" && i.values.some((x) => Math.abs(x - v) < 1e-12));
    if (hc) u.detail += ` ${hc.title.split(" typed")[0]} is typed into ${blockText(hc)}; is that what should come from here?`;
  }
  function blockText(i) { const b = blocks[i.block]; return b ? `${sheets[b.sheet].name}!${b.rangeText}` : where(i.sheet, i.c, i.r); }

  // ---- recompute formulas from saved values (for the in-between values in formula trees) ----
  function ctxFor(sheetIdx, nameStack = new Set()) {
    const ctx = {
      ref(n) {
        if (n.ext != null) throw new Unsupported("external file");
        const sh = n.sheet ? sheetByName.get(n.sheet.toLowerCase()) : sheets[sheetIdx];
        if (!sh || !sh.cells) throw new Unsupported("sheet");
        const rg = { ...n.range };
        if (rg.c1 === rg.c2 && rg.r1 === rg.r2) return sh.cells.get(rg.c1 + "," + rg.r1)?.value ?? null;
        if ((rg.r2 - rg.r1 + 1) * (rg.c2 - rg.c1 + 1) > 200000) {
          // Whole columns: clip to the used area.
          rg.r2 = Math.min(rg.r2, sh.maxR || 1); rg.c2 = Math.min(rg.c2, sh.maxC || 1);
        }
        if ((rg.r2 - rg.r1 + 1) * (rg.c2 - rg.c1 + 1) > 200000) throw new Unsupported("ranges larger than 200,000 cells");
        const out = [];
        for (let r = rg.r1; r <= rg.r2; r++) {
          const row = [];
          for (let c = rg.c1; c <= rg.c2; c++) row.push(sh.cells.get(c + "," + r)?.value ?? null);
          out.push(row);
        }
        return out;
      },
      name(n) {
        if (n.ext != null) throw new Unsupported("external file");
        const scope = n.sheet ? sheetByName.get(n.sheet.toLowerCase())?.index : sheetIdx;
        const nm = lookupName(n.name, scope);
        if (!nm || !nm.ast) throw new Unsupported("name");
        if (nameStack.has(nm)) throw new Unsupported("circular defined name");
        return evaluate(nm.ast, ctxFor(nm.scope != null ? nm.scope : scope, new Set([...nameStack, nm]))).value;
      },
    };
    return ctx;
  }
  // Local checks use saved precedents. A match alone never verifies an upstream chain.
  const localCache = new Map();
  function localCheck(fc, withTrace = false) {
    if (!withTrace && localCache.has(fc)) return localCache.get(fc);
    let out;
    if (!fc.ast) out = { ok: false, status: "unsupported", reason: "Untangle couldn't read this formula." };
    else if (fc.cell.value == null) out = { ok: false, status: "unsupported", reason: "Excel did not save a result for this formula; no value can be verified." };
    else if (fc.cell.array || fc.cell.dataTable) out = { ok: false, status: "unsupported", reason: "Array formulas and data tables aren't recomputed yet." };
    else try {
      const { value, trace } = evaluate(fc.ast, ctxFor(fc.sheet));
      const error = value && typeof value === "object" && "error" in value;
      const match = Boolean(sameValue(value, fc.cell.value));
      out = { ok: match && !error, status: !match ? "mismatch" : error ? "error" : "match", value,
        ...(withTrace ? { trace } : {}),
        reason: error && match ? `This formula returns ${value.error}; matching an error does not verify a working result.`
          : match ? null : `Using Excel's saved inputs, Untangle gets ${fmtValue(fc.cell, value)} instead of ${fmtValue(fc.cell)}. This may be a stale saved result or a calculation difference; recalculate in Excel to check.` };
    } catch (e) {
      if (!(e instanceof Unsupported)) throw e;
      out = { ok: false, status: "unsupported", reason: `Untangle can't recalculate ${/^[A-Z.]+$/.test(e.message) ? e.message + "()" : e.message} yet, so only Excel's saved values are shown.` };
    }
    // Traces can contain large range matrices; retain only the small outcome between selections.
    const { trace, ...small } = out;
    localCache.set(fc, small);
    return out;
  }
  const cyclic = new Set(cycles.flat());
  function recompute(fc) {
    const own = localCheck(fc, true);
    if (!own.ok) return own;
    if (cyclic.has(fc)) return { ok: false, reason: "This formula belongs to a circular reference; its result cannot be verified." };
    const seen = new Set([fc]), queue = [fc];
    const deadline = performance.now() + 250;
    for (let j = 0; j < queue.length; j++) {
      const f = queue[j];
      if (f.refs.some((r) => r.ext != null || r.threeD || r.missingSheet || r.unknownName) || [...f.funcs].some((n) => UNTRACEABLE.has(n)))
        return { ok: false, reason: `The dependency chain includes unavailable or dynamic references at ${where(f.sheet, f.c, f.r)}. Only saved values are shown.` };
      if (graphTruncated) return { ok: false, reason: "Some dependency links were skipped in this large workbook, so the full chain cannot be verified." };
      for (const p of precedentCells(f)) {
        const dep = p.cell?.fc;
        if (!dep || seen.has(dep)) continue;
        if (seen.size >= 20000 || performance.now() > deadline)
          return { ok: false, reason: "The upstream chain is too large to verify here; only saved values are shown." };
        seen.add(dep); queue.push(dep);
        const rc = localCheck(dep);
        if (!rc.ok || cyclic.has(dep)) return { ok: false, problem: { sheet: dep.sheet, c: dep.c, r: dep.r },
          reason: `Upstream ${where(dep.sheet, dep.c, dep.r)} ${rc.status === "mismatch" ? "doesn't match its saved result" : "cannot be verified"}. ${rc.reason || "It has a circular reference."} Only saved values are shown for this formula.` };
      }
    }
    return { ...own, checked: seen.size };
  }

  // A bounded scan surfaces stale caches without suggesting an audit of unsupported functions.
  const verification = { attempted: 0, matched: 0, mismatched: 0, unsupported: 0, errors: 0 };
  const mismatches = new Map();
  const checkDeadline = performance.now() + Math.min(500, budgetMs / 4);
  for (const fc of formulas) {
    if (performance.now() > checkDeadline) break;
    const rc = localCheck(fc);
    verification.attempted++;
    if (rc.status === "match") verification.matched++;
    else if (rc.status === "mismatch") {
      verification.mismatched++;
      const group = mismatches.get(fc.block.id);
      if (group) group.n++;
      else mismatches.set(fc.block.id, { fc, rc, n: 1 });
    } else if (rc.status === "error") verification.errors++;
    else verification.unsupported++;
  }
  for (const { fc, rc, n } of mismatches.values()) flag("saved-mismatch", "medium",
    { sheet: fc.sheet, c: fc.c, r: fc.r }, `${n > 1 ? n + " saved results differ" : "Saved result differs"} from recalculation: ${where(fc.sheet, fc.c, fc.r)}`,
    rc.reason + (n > 1 ? ` ${n} cells in ${fc.block.rangeText} have this discrepancy.` : ""));
  notes.push(`Saved-value check: ${fmtNum(verification.matched)} of ${fmtNum(formulas.length)} formulas matched using saved inputs; ${fmtNum(verification.mismatched)} differed, ${fmtNum(verification.unsupported)} unsupported, ${fmtNum(verification.errors)} returned errors, ${fmtNum(formulas.length - verification.attempted)} not checked. A match is not a full workbook audit.`);
  function evalText(text, sheetIdx) {
    try { return evaluate(parse(text), ctxFor(sheetIdx)).value; } catch (e) { return undefined; }
  }
  for (const i of issues) {
    if (i.type !== "override") continue;
    const v = evalText(i.expected, i.sheet);
    const typed = sheets[i.sheet].cells.get(i.c + "," + i.r).value;
    if (typeof v === "number" && Math.abs(v - typed) > 1e-9 * Math.max(1, Math.abs(v))) {
      i.expectedValue = v;
      i.detail += ` Using saved input values, the formula would give ${fmtNum(v)}, not ${fmtNum(typed)} (off by ${fmtNum(Math.abs(v - typed))}).`;
    } else if (typeof v === "number") i.detail += " Right now the typed value happens to match what the formula would give.";
  }
  for (const i of issues) {
    if (i.type !== "short-range") continue;
    const fc = sheets[i.sheet].cells.get(i.c + "," + i.r).fc;
    const missed = sheets[i.missed.sheet].cells.get(i.missed.c + "," + i.missed.r);
    if (fc && typeof fc.cell.value === "number" && typeof missed.value === "number" && fc.funcs.has("SUM")) {
      i.detail += ` If it's included, the result goes from ${fmtNum(fc.cell.value)} to ${fmtNum(fc.cell.value + missed.value)}.`;
    }
  }

  const order = { high: 0, medium: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity] || a.sheet - b.sheet || a.r - b.r || a.c - b.c);
  issues.forEach((x, i) => { x.id = i; });

  // ---- 9. sheet-level map ----
  const sheetLinks = [...sheetEdges.entries()].map(([k, n]) => { const [from, to] = k.split(">").map(Number); return { from, to, n }; });
  // Layer sheets: inputs on the left, outputs on the right (longest path, cycles broken).
  const layer = new Map(sheets.map((s) => [s.index, 0]));
  for (let iter = 0; iter < sheets.length; iter++) {
    let changed = false;
    for (const l of sheetLinks) {
      if (l.from === l.to) continue;
      if (layer.get(l.to) < layer.get(l.from) + 1 && layer.get(l.from) + 1 < sheets.length) { layer.set(l.to, layer.get(l.from) + 1); changed = true; }
    }
    if (!changed) break;
  }
  for (const sh of sheets) sh.layer = layer.get(sh.index);

  const stats = {
    sheets: sheets.length,
    hiddenSheets: sheets.filter((s) => s.state !== "visible").length,
    cells: sheets.reduce((s, x) => s + (x.cells ? x.cells.size : 0), 0),
    formulas: formulas.length,
    blocks: blocks.length,
    inputs: inputs.length,
    outputs: formulas.filter((f) => f.cell.role === "output").length,
    issues: issues.filter((i) => i.severity !== "info").length,
    high: issues.filter((i) => i.severity === "high").length,
    names: [...names.values()].filter((n) => !n.hidden).length,
    tables: wb.tables.length,
    externals: wb.externals.filter(Boolean).length,
    ms: Math.round(performance.now() - t0),
  };
  if (graphTruncated) notes.push("This workbook has an enormous number of range references; some links between cells beyond the first few million were skipped.");
  if (!impactExact) notes.push("Ranked the first inputs by full reach; the rest by direct use, to keep this fast.");
  const threeDCount = formulas.filter((f) => f.refs.some((r) => r.threeD)).length;
  if (threeDCount) notes.push(`${threeDCount} formulas use 3D sheet ranges (such as Sheet1:Sheet3!A1). These links are not traced yet; their inputs are missing from the map.`);
  if (wb.hasMacros) notes.push("This workbook contains macros (VBA). Untangle doesn't run or read them; anything they change is not on the map.");

  return {
    wb, sheets, formulas, blocks, inputs, issues, notes, stats, names, sheetLinks, cycles, verification,
    recompute, evalText, dependentsOf, precedentCells, downstream, upstream, labelOf, labelText, cellsIn, where,
    cell: (s, c, r) => sheets[s]?.cells?.get(c + "," + r) || null,
  };
}


function clip(s) { s = s.replace(/\s+/g, " "); return s.length > 48 ? s.slice(0, 46) + "…" : s; }

export function fmtNum(v) {
  if (typeof v !== "number") return String(v);
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.001 || a >= 1e15)) return v.toExponential(3);
  return (+v.toPrecision(10)).toLocaleString("en-US", { maximumFractionDigits: a >= 1000 ? 0 : a >= 1 ? 2 : 4 });
}

export function fmtValue(cell, v = cell ? cell.value : null) {
  if (v == null) return "blank";
  if (Array.isArray(v)) return fmtValue(null, v[0]?.[0]) + (v.length * (v[0]?.length || 1) > 1 ? " …" : "");
  if (typeof v === "object" && "error" in v) return v.error;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v.length > 60 ? `“${v.slice(0, 58)}…”` : `“${v}”`;
  const fmt = cell && cell.fmt;
  if (fmt === "pct") return `${(+(v * 100).toPrecision(10)).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  if (fmt === "date" && v > 0 && v < 2958466) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000));
    return d.toISOString().slice(0, 10);
  }
  if (Number.isInteger(v) && v >= 1900 && v <= 2100 && fmt !== "money") return String(v); // a year
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return fmtNum(v);
}

export { addr, numToCol, rangeText, MAX_ROW, MAX_COL };
