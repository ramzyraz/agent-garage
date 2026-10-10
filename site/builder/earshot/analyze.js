// Earshot layout analysis. Pure functions, no DOM, no pdf.js: takes positioned
// text items and images per page and proposes the structure a screen reader
// needs: reading order, headings, paragraphs, lists, tables, figures and
// page furniture (artifacts). Coordinates are PDF user space, y grows upward.
//
// page = { w, h, items: [{ s, x, y, w, size, font, bold, i }], images: [{ x, y, w, h, i }] }
// returns { blocks, bodySize } where each block is
// { id, page, type: 'h'|'p'|'li'|'table'|'figure'|'artifact', level, text, bbox,
//   items: [item], rows (table), headerRows (table), alt (figure), fileIndex, why }

const BULLET = /^([•▪●◦‣⁃∙·■□–—*-]|\(?\d{1,2}[.)]|\(?[a-z][.)])(\s|$)/;

const LABEL = /^(\(?\d{1,2}(\.\d{1,2})*[.)]?|[IVX]{1,4}\.|[A-Z][.)]|[\u2022\u25AA\u25CF\u25E6\u2023\u2043\u2219\u00B7\u25A0\u25A1*\u2013-])$/;

export function itemBox(it) {
  if (!it.rot) return [it.x, it.y - 0.22 * it.size, it.x + it.w, it.y + 0.9 * it.size];
  // Rotated text: run along (dx, dy), glyphs rise along (-dy, dx).
  const dx = it.dx, dy = it.dy, ux = -dy, uy = dx;
  const pts = [[0, -0.22], [0, 0.9], [it.w, -0.22], [it.w, 0.9]].map(([a, u]) => [it.x + dx * a + ux * u * it.size, it.y + dy * a + uy * u * it.size]);
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
export function union(boxes) {
  let b = null;
  for (const x of boxes) {
    if (!x) continue;
    b = b ? [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])] : x.slice();
  }
  return b;
}

function mode(values) {
  const m = new Map();
  for (const [v, wgt] of values) m.set(v, (m.get(v) || 0) + wgt);
  let best = null, bw = -1;
  for (const [v, wgt] of m) if (wgt > bw) { best = v; bw = wgt; }
  return best;
}

// Join a row of items into text, inserting spaces where the gap looks like one.
function joinItems(items) {
  let out = '', prev = null;
  for (const it of items) {
    if (prev) {
      const gap = it.x - (prev.x + prev.w);
      if (gap > 0.12 * Math.min(it.size, prev.size) && !out.endsWith(' ') && !it.s.startsWith(' ')) out += ' ';
    }
    out += it.s;
    prev = it;
  }
  return out.replace(/\s+/g, ' ').trim();
}

// 1. Lines: items on one baseline, split where the horizontal gap is large
// (columns, table cells).
export function buildLines(items) {
  const live = items.filter(it => it.s && it.s.trim() && it.w > 0);
  live.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of live) {
    const row = rows.find(r => Math.abs(r.y - it.y) < 0.35 * Math.max(r.size, it.size) && Math.abs(r.size - it.size) < 0.5 * Math.max(r.size, it.size));
    if (row) { row.items.push(it); } else rows.push({ y: it.y, size: it.size, items: [it] });
  }
  const lines = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    let cur = null;
    for (const it of row.items) {
      const gap = cur ? it.x - cur.x1 : 0;
      // A lone label ("3.1", "•", "IV.") stays with the text after it.
      const label = cur && cur.items.length === 1 && LABEL.test(cur.items[0].s.trim()) && gap < 3 * it.size;
      if (!cur || (gap > 1.0 * Math.max(it.size, cur.items.at(-1).size) && !label) || gap < -2 * it.size) {
        cur = { items: [], x1: -Infinity };
        lines.push(cur);
      }
      cur.items.push(it);
      cur.x1 = Math.max(cur.x1, it.x + it.w);
    }
  }
  for (const l of lines) finishLine(l);
  return lines;
}
function finishLine(l) {
  l.bbox = union(l.items.map(itemBox));
  l.text = joinItems(l.items);
  l.size = mode(l.items.map(it => [Math.round(it.size * 2) / 2, it.s.length]));
  l.font = mode(l.items.map(it => [it.font, it.s.length]));
  l.bold = l.items.filter(it => it.bold).reduce((n, it) => n + it.s.length, 0) > l.text.length / 2;
  l.y = Math.max(...l.items.map(it => it.y));
  l.x0 = l.bbox[0];
  l.fileIndex = Math.min(...l.items.map(it => it.i));
}

// 2. Page furniture: short lines in the top/bottom margin that repeat across
// pages (digits ignored), or that look like page numbers.
export function findArtifacts(pages) {
  // Only page-number-like digits may differ between pages: "Page 3 of 9",
  // or a number at either end. "Table A-1." and "Table A-2." are different.
  const norm = t => t.toLowerCase().replace(/\s+/g, ' ').trim()
    .replace(/\bpage\s*\d+(\s*(of|\/)\s*\d+)?/g, 'page #').replace(/^\d+\s+|\s+\d+$/g, '# ').replace(/^\d+$/, '#').trim();
  const pageNo = /^(page\s*)?#+(\s*(of|\/)\s*#+)?$|^[-–]\s*#+\s*[-–]$/;
  const counts = new Map();
  for (const p of pages) {
    const seen = new Set();
    for (const l of p.lines) if (inMargin(l, p)) seen.add(norm(l.text));
    for (const t of seen) counts.set(t, (counts.get(t) || 0) + 1);
  }
  for (const p of pages) {
    for (const l of p.lines) {
      if (!inMargin(l, p)) continue;
      const n = norm(l.text);
      if (pageNo.test(n)) l.artifact = 'Page number';
      else if (pages.length > 1 && counts.get(n) >= 2) l.artifact = l.bbox[1] > p.h / 2 ? 'Running header' : 'Running footer';
    }
  }
}
function inMargin(l, p) {
  return l.bbox[1] > p.h * 0.9 || l.bbox[3] < p.h * 0.1;
}

// 3. Tables: three or more consecutive rows of short, aligned cells.
export function findTables(lines, bodySize) {
  const free = lines.filter(l => !l.artifact);
  const rows = [];
  for (const l of free.slice().sort((a, b) => b.y - a.y)) {
    const r = rows.find(r => Math.abs(r.y - l.y) < 0.35 * l.size);
    if (r) r.cells.push(l); else rows.push({ y: l.y, cells: [l] });
  }
  rows.forEach(r => r.cells.sort((a, b) => a.x0 - b.x0));
  const tables = [];
  let run = [];
  const flush = () => {
    if (run.length >= 3) tables.push(run);
    run = [];
  };
  const fill = r => r.cells.reduce((s, c) => s + c.bbox[2] - c.bbox[0], 0) / (r.cells.at(-1).bbox[2] - r.cells[0].bbox[0]);
  const aligned = (a, b) => a.cells.length === b.cells.length &&
    a.cells.every((c, k) => Math.abs(c.x0 - b.cells[k].x0) < 0.8 * bodySize || Math.abs(c.bbox[2] - b.cells[k].bbox[2]) < 0.8 * bodySize);
  for (const r of rows) {
    const ok = r.cells.length >= 2 && fill(r) < 0.62;
    const prev = run.at(-1);
    if (ok && prev && aligned(prev, r) && prev.y - r.y < 3.2 * bodySize) run.push(r);
    else { flush(); if (ok) run.push(r); }
  }
  flush();
  return tables.map(t => {
    const cells = t.flatMap(r => r.cells);
    cells.forEach(c => { c.inTable = true; });
    const first = t[0].cells;
    const headerRows = first.every(c => c.bold || c.font !== t[1].cells[0].font) || first.every(c => !/\d/.test(c.text)) ? 1 : 0;
    return { rows: t.map(r => r.cells), headerRows, bbox: union(cells.map(c => c.bbox)) };
  });
}

// 4. Reading order: recursive XY-cut over line, table and image boxes.
// Tall vertical gutters split first (columns read left to right), then
// horizontal gaps; consecutive bands that share a gutter are rejoined so a
// heading row lined up across two columns doesn't interleave them.
export function readingOrder(units, size) {
  if (units.length <= 1) return units.slice();
  const H = union(units.map(u => u.bbox));
  const v = verticalCut(units, H, size);
  if (v) return [...readingOrder(v[0], size), ...readingOrder(v[1], size)];
  const bands = horizontalBands(units);
  if (bands.length === 1) return units.slice().sort((a, b) => b.bbox[3] - a.bbox[3] || a.bbox[0] - b.bbox[0]);
  const merged = [];
  for (const b of bands) {
    const last = merged.at(-1);
    if (last && last.bottom - b.top < 2.5 * size && sharedGutter(last.units, b.units, size)) {
      last.units.push(...b.units); last.bottom = b.bottom;
    } else merged.push({ ...b, units: b.units.slice() });
  }
  if (merged.length === 1) {
    const v2 = verticalCut(merged[0].units, union(merged[0].units.map(u => u.bbox)), size, true);
    if (v2) return [...readingOrder(v2[0], size), ...readingOrder(v2[1], size)];
    return bands.flatMap(b => readingOrder(b.units, size));
  }
  return merged.flatMap(b => readingOrder(b.units, size));
}
function gutters(units, size) {
  const xs = units.map(u => [u.bbox[0], u.bbox[2]]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let end = xs[0][1];
  for (const [a, b] of xs.slice(1)) {
    if (a - end >= Math.max(8, 0.8 * size)) out.push([end, a]);
    end = Math.max(end, b);
  }
  return out;
}
function verticalCut(units, H, size, force) {
  let best = null;
  for (const [g0, g1] of gutters(units, size)) {
    const left = units.filter(u => u.bbox[2] <= g0 + 0.01), right = units.filter(u => u.bbox[0] >= g1 - 0.01);
    const hl = span(left), hr = span(right), hh = H[3] - H[1];
    const tall = force || (hl >= 0.5 * hh && hr >= 0.5 * hh);
    if (tall && (!best || g1 - g0 > best.w)) best = { w: g1 - g0, sides: [left, right] };
  }
  return best && best.sides;
}
function span(us) {
  const b = union(us.map(u => u.bbox));
  return b ? b[3] - b[1] : 0;
}
function horizontalBands(units) {
  const sorted = units.slice().sort((a, b) => b.bbox[3] - a.bbox[3]);
  const bands = [];
  for (const u of sorted) {
    const b = bands.at(-1);
    if (b && u.bbox[3] > b.bottom) { b.units.push(u); b.bottom = Math.min(b.bottom, u.bbox[1]); } else bands.push({ top: u.bbox[3], bottom: u.bbox[1], units: [u] });
  }
  return bands;
}
function sharedGutter(a, b, size) {
  const ga = gutters(a, size), gb = gutters(b, size);
  return ga.some(([a0, a1]) => gb.some(([b0, b1]) => Math.min(a1, b1) - Math.max(a0, b0) > 4));
}

// 5. Blocks: consecutive lines in reading order with the same style become
// a paragraph; bullet lines start list items.
function groupLines(ordered, bodySize) {
  const blocks = [];
  let cur = null;
  for (const l of ordered) {
    const bullet = BULLET.test(l.text);
    const prev = cur && cur.lines.at(-1);
    const sameStyle = prev && Math.abs(prev.size - l.size) < 0.6 && prev.font === l.font;
    const close = prev && prev.y - l.y > 0 && prev.y - l.y < 1.75 * l.size;
    const indent = cur && (cur.kind === 'li' ? Math.abs(l.x0 - cur.textX) < 0.9 * l.size : Math.abs(l.x0 - cur.lines[0].x0) < 3 * l.size || (cur.lines.length === 1 && l.x0 < cur.lines[0].x0));
    if (cur && !bullet && sameStyle && close && indent && !l.inTable) {
      cur.lines.push(l);
    } else {
      cur = { kind: bullet ? 'li' : 'p', lines: [l] };
      if (bullet) {
        const second = l.items.length > 1 && l.items[0].s.trim().length <= 3 ? l.items[1].x : l.x0 + 1.2 * l.size;
        cur.textX = second;
      }
      blocks.push(cur);
    }
  }
  return blocks;
}

// Whole document.
export function analyze(pagesIn) {
  const pages = pagesIn.map((p, n) => ({ ...p, n, lines: buildLines(p.items) }));
  const allLines = pages.flatMap(p => p.lines);
  const bodySize = mode(allLines.map(l => [l.size, l.text.length])) || 10;
  const bodyFont = mode(allLines.map(l => [l.font, l.text.length]));
  findArtifacts(pages);

  const blocks = [];
  let id = 0;
  const headingStyles = new Map();
  for (const p of pages) {
    const tables = findTables(p.lines, bodySize);
    const units = [];
    for (const t of tables) units.push({ kind: 'table', bbox: t.bbox, table: t });
    for (const l of p.lines) if (!l.artifact && !l.inTable) units.push({ kind: 'line', bbox: l.bbox, line: l });
    const area = p.w * p.h;
    const figures = [];
    for (const im of p.images) {
      const bbox = [im.x, im.y, im.x + im.w, im.y + im.h];
      if (im.w * im.h > area * 0.004 && im.w > 18 && im.h > 18) units.push({ kind: 'figure', bbox, image: im });
      else figures.push({ bbox, image: im });
    }
    const ordered = readingOrder(units, bodySize);
    // Lines between non-line units are grouped separately.
    let run = [];
    const flushRun = () => {
      for (const g of groupLines(run, bodySize)) {
        const items = g.lines.flatMap(l => l.items);
        const text = g.lines.map(l => l.text).join(' ').replace(/\s+/g, ' ');
        const l0 = g.lines[0];
        const b = { id: id++, page: p.n, type: g.kind, text, items, lines: g.lines, bbox: union(g.lines.map(l => l.bbox)), size: l0.size, font: l0.font, bold: l0.bold };
        const short = g.lines.length <= 3 && text.length < 140 && !/[.;,:]$/.test(text);
        const bigger = l0.size >= bodySize * 1.12;
        const distinct = l0.bold && l0.size >= bodySize * 0.95;
        const rotated = l0.items.some(it => it.rot);
        if (g.kind === 'p' && short && !rotated && (bigger || distinct) && /\p{L}/u.test(text) && text.length >= 3 && !/^(and|or|the|of|to|in)$/i.test(text) && !/@|https?:|www\./i.test(text)) {
          b.type = 'h';
          const key = `${Math.round(l0.size * 2) / 2}|${l0.bold || l0.font !== bodyFont}`;
          headingStyles.set(key, l0.size);
          b.styleKey = key;
          b.why = bigger ? `Larger text (${fmt(l0.size)}pt vs body ${fmt(bodySize)}pt)` : 'Short bold line';
        } else if (g.kind === 'li') {
          b.why = 'Starts with a bullet or number';
        }
        blocks.push(b);
      }
      run = [];
    };
    for (const u of ordered) {
      if (u.kind === 'line') { run.push(u.line); continue; }
      flushRun();
      if (u.kind === 'table') {
        const t = u.table;
        blocks.push({
          id: id++, page: p.n, type: 'table', bbox: t.bbox, headerRows: t.headerRows,
          rows: t.rows.map(r => r.map(c => ({ text: c.text, items: c.items, bbox: c.bbox }))),
          items: t.rows.flat().flatMap(c => c.items),
          text: `Table, ${t.rows.length} rows, ${t.rows[0].length} columns`,
          why: `${t.rows.length} rows of aligned cells`,
        });
      } else {
        blocks.push({ id: id++, page: p.n, type: 'figure', bbox: u.bbox, items: [], image: u.image, alt: '', text: '', why: 'Picture' });
      }
    }
    flushRun();
    for (const l of p.lines.filter(l => l.artifact)) {
      blocks.push({ id: id++, page: p.n, type: 'artifact', text: l.text, items: l.items, lines: [l], bbox: l.bbox, why: l.artifact });
    }
    for (const f of figures) blocks.push({ id: id++, page: p.n, type: 'artifact', text: '', items: [], image: f.image, bbox: f.bbox, why: 'Tiny decorative image' });
  }
  // Heading levels: distinct heading styles ranked by size, largest = 1.
  const styles = [...headingStyles.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1)).map(e => e[0]);
  for (const b of blocks) if (b.type === 'h') b.level = Math.min(6, styles.indexOf(b.styleKey) + 1);
  normalizeLevels(blocks);
  for (const b of blocks) b.fileIndex = b.items.length ? Math.min(...b.items.map(it => it.i)) : (b.image ? b.image.i : 1e9);
  return { blocks, bodySize };
}

// Screen readers expect an outline without gaps: start at 1, never skip down a level.
// Keeps the relative order of the original levels, so two headings in the
// same style stay at the same depth within a section.
export function normalizeLevels(blocks) {
  const stack = [];
  for (const b of blocks) {
    if (b.type !== 'h') continue;
    const orig = b.origLevel || b.level;
    b.origLevel = orig;
    while (stack.length && stack.at(-1) >= orig) stack.pop();
    b.level = Math.min(6, stack.length + 1);
    stack.push(orig);
  }
}

const fmt = n => (Math.round(n * 10) / 10).toString();

// The order a reader would meet text in an untagged file: content-stream order.
export function fileOrder(blocks) {
  return blocks.slice().sort((a, b) => a.page - b.page || a.fileIndex - b.fileIndex);
}

// What a screen reader announces for a block (used by Listen and the list).
export function spoken(b) {
  switch (b.type) {
    case 'h': return `Heading level ${b.level}. ${b.text}`;
    case 'li': return `List item. ${b.text.replace(BULLET, '').trim()}`;
    case 'table': {
      const hdr = b.headerRows ? b.rows[0].map(c => c.text) : null;
      const body = b.rows.slice(b.headerRows ? 1 : 0).map(r => r.map((c, k) => hdr ? `${hdr[k]}: ${c.text}` : c.text).join(', ')).join('. ');
      return `Table with ${b.rows.length} rows and ${b.rows[0].length} columns. ${body}`;
    }
    case 'figure': return b.alt ? `Graphic. ${b.alt}` : 'Unlabeled graphic';
    case 'artifact': return '';
    default: return b.text;
  }
}
export function stripBullet(t) {
  return t.replace(BULLET, '').trim();
}
