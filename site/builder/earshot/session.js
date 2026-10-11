// A portable editing session includes the original PDF and references back to
// its text runs. Restore source geometry from a fresh extraction and validate
// the reviewed table dividers separately.
import { itemBox, union } from './analyze.js';

export function sessionModel(S) {
  return { title: S.title, lang: S.lang, source: S.source, blocks: S.blocks.map(b => ({
    id: b.id, page: b.page, type: b.type, level: b.level, text: b.text, alt: b.alt, why: b.why,
    items: b.items.map(it => it.i), image: b.image?.i, headerRows: b.headerRows, headerCols: b.headerCols,
    tableGrid: b.tableGrid,
    rows: b.rows?.map(r => r.map(c => ({ text: c.text, items: c.items.map(it => it.i) }))),
  })) };
}
export function restoreModel(model, pages) {
  const bad = () => { throw new Error('This editing session has invalid or duplicate pieces. Open the original PDF instead.'); };
  if (!model || typeof model.title !== 'string' || typeof model.lang !== 'string' || !Array.isArray(model.blocks) || !model.blocks.length) bad();
  const ids = new Set(), used = new Set(), images = new Set();
  const blocks = model.blocks.map(b => {
    const page = pages[b.page];
    if (!page || !Number.isInteger(b.page) || !Number.isInteger(b.id) || ids.has(b.id) || !['h', 'p', 'li', 'table', 'figure', 'artifact'].includes(b.type)) bad();
    ids.add(b.id);
    if (b.type === 'h' && (!Number.isInteger(b.level) || b.level < 1 || b.level > 6)) bad();
    const getItems = refs => {
      if (!Array.isArray(refs)) bad();
      return refs.map(i => {
        const it = page.items.find(it => it.i === i), key = `${b.page}:${i}`;
        if (!it || used.has(key)) bad(); used.add(key); return it;
      });
    };
    let rows, items, tableGrid;
    if (b.type === 'table') {
      if (!Array.isArray(b.rows) || b.rows.length < 1 || !b.rows[0].length || b.rows.some(r => !Array.isArray(r) || r.length !== b.rows[0].length)) bad();
      if (![0, 1].includes(b.headerRows || 0) || ![0, 1].includes(b.headerCols || 0)) bad();
      rows = b.rows.map(r => r.map(c => { const items = getItems(c.items); return { text: String(c.text || ''), items, bbox: union(items.map(itemBox)) }; }));
      items = rows.flatMap(r => r.flatMap(c => c.items));
      if (b.tableGrid) {
        const g = b.tableGrid;
        if (!Array.isArray(g.box) || g.box.length !== 4 || !g.box.every(Number.isFinite) || g.box[2] <= g.box[0] || g.box[3] <= g.box[1] ||
          !Array.isArray(g.cutsX) || !Array.isArray(g.cutsY) || g.cutsX.length !== rows[0].length - 1 || g.cutsY.length !== rows.length - 1 ||
          !g.cutsX.every((v, i) => Number.isFinite(v) && v > g.box[0] && v < g.box[2] && (!i || v > g.cutsX[i - 1])) ||
          !g.cutsY.every((v, i) => Number.isFinite(v) && v > g.box[1] && v < g.box[3] && (!i || v < g.cutsY[i - 1]))) bad();
        tableGrid = { box: g.box.slice(), cutsX: g.cutsX.slice(), cutsY: g.cutsY.slice() };
      }
    } else items = getItems(b.items);
    const image = b.image == null ? undefined : page.images.find(im => im.i === b.image);
    if (b.image != null) {
      const key = `${b.page}:${b.image}`;
      if (!image || images.has(key)) bad(); images.add(key);
    }
    if (b.type === 'figure' && !image || !items.length && !image) bad();
    const bbox = image ? [image.x, image.y, image.x + image.w, image.y + image.h] : union(items.map(itemBox));
    return { id: b.id, page: b.page, type: b.type, level: b.level, text: String(b.text || ''), alt: String(b.alt || ''),
      why: String(b.why || ''), items, image, bbox, rows, tableGrid, headerRows: b.headerRows || 0, headerCols: b.headerCols || 0,
      fileIndex: items.length ? Math.min(...items.map(it => it.i)) : image.i };
  });
  // Reject damaged sessions which would silently drop real source text.
  for (const p of pages) for (const it of p.items) if (it.s.trim() && it.w > 0 && !used.has(`${p.n}:${it.i}`)) bad();
  return { blocks, title: model.title, lang: model.lang, source: model.source === 'existing' ? 'existing' : 'layout' };
}
export function encodeSession(S) {
  let binary = '';
  for (let i = 0; i < S.bytes.length; i += 32768) binary += String.fromCharCode(...S.bytes.subarray(i, i + 32768));
  return JSON.stringify({ format: 'earshot-session', version: 1, name: S.name, pdf: btoa(binary), model: sessionModel(S) });
}
export function decodeSession(text) {
  const data = JSON.parse(text);
  if (data.format !== 'earshot-session' || data.version !== 1 || typeof data.pdf !== 'string' || typeof data.name !== 'string') throw new Error('This is not a supported Earshot editing session.');
  const binary = atob(data.pdf);
  return { ...data, bytes: Uint8Array.from(binary, c => c.charCodeAt(0)) };
}
