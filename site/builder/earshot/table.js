// Manual table repair uses the original positioned text, independent of guesses.
import { itemBox, union, buildLines } from './analyze.js';

export function regionItems(page, box) {
  return page.items.filter(it => {
    const b = itemBox(it), x = (b[0] + b[2]) / 2, y = (b[1] + b[3]) / 2;
    return it.s.trim() && x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
  });
}
export function textOf(items) {
  return buildLines(items).sort((a, b) => b.y - a.y || a.x0 - b.x0).map(l => l.text).join(' ');
}
export function suggestGrid(items, box) {
  const groups = (values, tolerance) => {
    const out = [];
    for (const v of values.sort((a, b) => a - b)) {
      if (!out.length || v - out.at(-1) > tolerance) out.push(v);
    }
    return out;
  };
  const size = items.length ? items.reduce((n, it) => n + it.size, 0) / items.length : 12;
  const xs = groups(items.map(it => it.x), size * 1.5);
  const ys = groups(items.map(it => it.y), size * .6).reverse();
  const cutsX = xs.slice(1).map((x, i) => {
    const prev = items.filter(it => Math.abs(it.x - xs[i]) < size * 1.5);
    const end = Math.max(xs[i], ...prev.map(it => it.x + it.w));
    return (Math.min(end, x) + x) / 2;
  }).filter(x => x > box[0] && x < box[2]);
  const cutsY = ys.slice(1).map((y, i) => (y + ys[i] + size * .6) / 2);
  return { cutsX: cutsX.slice(0, 11), cutsY: cutsY.slice(0, 39) };
}
export function regionTable(page, box, cutsX, cutsY, options = {}) {
  const items = regionItems(page, box);
  const xs = cutsX.slice().sort((a, b) => a - b), ys = cutsY.slice().sort((a, b) => b - a);
  const rows = Array.from({ length: ys.length + 1 }, () => Array.from({ length: xs.length + 1 }, () => ({ items: [] })));
  for (const it of items) {
    const b = itemBox(it), x = (b[0] + b[2]) / 2, y = (b[1] + b[3]) / 2;
    rows[ys.filter(v => y < v).length][xs.filter(v => x > v).length].items.push(it);
  }
  rows.forEach(r => r.forEach(c => { c.text = textOf(c.items); c.bbox = union(c.items.map(itemBox)); }));
  return { page: page.n, type: 'table', bbox: box.slice(), rows, items,
    tableGrid: { box: box.slice(), cutsX: xs, cutsY: ys },
    text: `Table, ${rows.length} rows, ${rows[0].length} columns`,
    fileIndex: Math.min(...items.map(it => it.i)), headerRows: options.headerRows ?? 1,
    headerCols: options.headerCols || 0, why: 'Table region reviewed by you' };
}

// Preserve all text outside the region, even when a guessed paragraph crossed it.
export function replaceWithTable(blocks, table) {
  if (!table.items.length) throw new Error('Draw a region around some selectable text first.');
  if (table.rows.length < 2 || table.rows[0].length < 2) throw new Error('Choose at least two rows and two columns.');
  if (table.items.some(it => it.rot)) throw new Error('Rotated text needs separate review; this table tool currently handles horizontal text.');
  const selected = new Set(table.items.map(it => it.i));
  const out = [];
  let inserted = false, id = Math.max(0, ...blocks.map(b => b.id)) + 1;
  for (const b of blocks) {
    if (b.page !== table.page || !b.items.some(it => selected.has(it.i))) { out.push(b); continue; }
    if (!inserted) { out.push({ ...table, id: id++ }); inserted = true; }
    const remain = b.items.filter(it => !selected.has(it.i));
    if (remain.length) {
      // A table cut in half no longer has trustworthy structure. Keep its
      // remaining text in separate lines rather than inventing associations.
      const runs = b.type === 'table' ? buildLines(remain).map(l => l.items) : [remain];
      for (const items of runs) out.push({ ...b, id: id++, type: b.type === 'table' ? 'p' : b.type,
        rows: undefined, lines: undefined, items, text: textOf(items), bbox: union(items.map(itemBox)),
        fileIndex: Math.min(...items.map(it => it.i)) });
    }
  }
  if (!inserted) throw new Error('This text is outside the editable structure. Try layout suggestions first.');
  return { blocks: out, id: out.find(b => b.items === table.items).id };
}
