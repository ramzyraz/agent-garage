// The middle zoom level: copied formulas and contiguous input runs, with real links.
import { rangeText, addr } from './model.js';

export function sheetFlow(m, sheet) {
  const nodes = new Map(), edges = new Map(), sourceAt = new Map();
  const inputNodes = new Map();
  // Keep input groups contiguous; never combine unrelated assumptions across a gap.
  const ordered = [...m.inputs].sort((a, b) => a.sheet - b.sheet || a.c - b.c || a.r - b.r);
  let run;
  for (const p of ordered) {
    if (run && run.sheet === p.sheet && run.c1 === p.c && run.r2 === p.r - 1) { run.r2 = p.r; run.n++; }
    else {
      run = { id: `i${p.sheet},${p.c},${p.r}`, sheet: p.sheet, c1: p.c, c2: p.c, r1: p.r, r2: p.r, n: 1, kind: 'input' };
      inputNodes.set(run.id, run);
    }
    sourceAt.set(`${p.sheet}!${p.c},${p.r}`, run);
  }
  // Year-by-year assumptions often sit across a row; compress those too.
  let horizontal = null;
  for (const n of [...inputNodes.values()].sort((a,b) => a.sheet-b.sheet || a.r1-b.r1 || a.c1-b.c1)) {
    const rowLabel = m.labelOf(n.sheet, n.c1, n.r1).row;
    if (n.r1 === n.r2 && rowLabel && horizontal && horizontal.sheet === n.sheet && horizontal.r1 === n.r1 && horizontal.c2 === n.c1 - 1 && horizontal.rowLabel === rowLabel) {
      horizontal.c2 = n.c2; horizontal.n += n.n;
      inputNodes.delete(n.id);
      sourceAt.set(`${n.sheet}!${n.c1},${n.r1}`, horizontal);
    } else { horizontal = n.r1 === n.r2 ? n : null; if (horizontal) horizontal.rowLabel = rowLabel; }
  }
  for (const n of inputNodes.values()) {
    n.rangeText = rangeText(n);
    n.label = (n.c2 > n.c1 ? n.rowLabel : n.n > 1 ? m.labelOf(n.sheet, n.c1, n.r1).col : m.labelText(n.sheet, n.c1, n.r1)) || 'Typed inputs';
  }
  const formulaNodes = new Map(m.blocks.map((b) => [b.id, { ...b, cells: undefined, sample: b.sample, id: `b${b.id}`, block: b.id, kind: 'formula', label: b.label || 'Calculation' }]));
  const add = (n) => { nodes.set(n.id, n); return n; };
  const connect = (a, b) => {
    if (!a || !b) return;
    add(a); add(b);
    const k = `${a.id}>${b.id}`;
    const e = edges.get(k);
    if (e) e.n++; else edges.set(k, { from: a.id, to: b.id, n: 1 });
  };
  const source = (s, cell) => cell?.fc ? formulaNodes.get(cell.fc.block.id) : sourceAt.get(`${s}!${cell?.c},${cell?.r}`);
  const rangeCache = new Map();
  for (const b of m.blocks.filter((x) => x.sheet === sheet)) {
    const to = add(formulaNodes.get(b.id));
    for (const fc of b.cells) for (const ref of fc.refs) {
      if (ref.sheet == null) {
        if (ref.ext != null) connect({ id: `e${ref.ext}`, kind: 'external', label: 'Another workbook', rangeText: String(ref.ext), n: 0 }, to);
        continue;
      }
      let src;
      if (ref.rangeNode) {
        src = rangeCache.get(ref.rangeNode);
        if (!src) {
          src = new Map();
          for (const cell of ref.rangeNode.cells) { const n = source(ref.sheet, cell); if (n) src.set(n.id, n); }
          rangeCache.set(ref.rangeNode, src);
        }
      } else {
        const rg = ref.range;
        const n = source(ref.sheet, m.cell(ref.sheet, rg.c1, rg.r1));
        src = n ? new Map([[n.id, n]]) : new Map();
      }
      for (const n of src.values()) connect(n, to);
    }
    // Show where this sheet's work goes, rather than making its final calculation look isolated.
    const consumers = new Map();
    for (const fc of b.cells) for (const dep of m.dependentsOf(sheet, fc.c, fc.r)) if (dep.sheet !== sheet) consumers.set(dep.sheet, dep.sheet);
    for (const s of consumers.keys()) connect(to, { id: `s${s}`, sheet: s, kind: 'sheet', label: m.sheets[s].name, rangeText: 'Uses these results', n: 0 });
  }
  // A sheet containing only assumptions still gets a useful overview.
  for (const n of inputNodes.values()) if (n.sheet === sheet) {
    add(n);
    const consumers = new Set();
    for (let c = n.c1; c <= n.c2; c++) for (let r = n.r1; r <= n.r2; r++) for (const dep of m.dependentsOf(sheet, c, r)) if (dep.sheet !== sheet) consumers.add(dep.sheet);
    for (const s of consumers) connect(n, { id: `s${s}`, sheet: s, kind: 'sheet', label: m.sheets[s].name, rangeText: 'Uses these inputs', n: 0 });
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export function flowLayers(flow) {
  // Kahn's algorithm; remaining cyclic nodes share a layer and retain their visible edges.
  const layer = new Map(flow.nodes.map((n) => [n.id, 0]));
  const indegree = new Map(flow.nodes.map((n) => [n.id, 0]));
  const next = new Map(flow.nodes.map((n) => [n.id, []]));
  for (const e of flow.edges) { indegree.set(e.to, indegree.get(e.to) + 1); next.get(e.from).push(e.to); }
  const queue = flow.nodes.filter((n) => !indegree.get(n.id)).map((n) => n.id);
  for (let j = 0; j < queue.length; j++) for (const id of next.get(queue[j])) {
    layer.set(id, Math.max(layer.get(id), layer.get(queue[j]) + 1));
    indegree.set(id, indegree.get(id) - 1);
    if (!indegree.get(id)) queue.push(id);
  }
  return layer;
}
