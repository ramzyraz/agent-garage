// Read the existing page tag tree, rather than guessing roles from its layout.
// pdf.js resolves RoleMap and gives content IDs shared with marked text.
import { itemBox, union } from './analyze.js';

const CONTAINERS = new Set(['Root', 'Document', 'Part', 'Sect', 'Div', 'Art', 'L', 'THead', 'TBody', 'TFoot']);
const refs = node => node.type === 'content' ? [node.id] : (node.children || []).flatMap(refs);
const imageBox = im => [im.x, im.y, im.x + im.w, im.y + im.h];
const text = items => items.map(it => it.s).join(' ').replace(/\s+/g, ' ').trim();

// pdf.js does not expose table spans/scope or per-element language. Inspect
// those in the original PDF before offering reuse, so good tags aren't
// silently replaced by a less capable model.
export async function inspectExistingAttributes(L, bytes) {
  const doc = await L.PDFDocument.load(bytes, { updateMetadata: false });
  const N = L.PDFName.of, seen = new Set(), issues = new Set();
  const lookup = (d, key) => d.lookup(N(key));
  const str = v => v?.decodeText?.() ?? (v ? String(v) : '');
  const lang = v => str(v).toLowerCase().split('-')[0].trim();
  const docLang = lang(lookup(doc.catalog, 'Lang'));
  const attrList = v => {
    const a = doc.context.lookup(lookup(v, 'A'));
    return (a instanceof L.PDFArray ? a.asArray().map(x => doc.context.lookup(x)) : [a]).filter(x => x instanceof L.PDFDict);
  };
  const headersOf = v => {
    for (const d of [v, ...attrList(v)]) {
      const hs = d && lookup(d, 'Headers');
      if (hs) return hs instanceof L.PDFArray ? hs.asArray().map(x => str(doc.context.lookup(x))) : [str(hs)];
    }
    return null;
  };
  const kids = v => {
    const k = doc.context.lookup(lookup(v, 'K'));
    return (k instanceof L.PDFArray ? k.asArray() : [k]).map(x => doc.context.lookup(x)).filter(x => x instanceof L.PDFDict && lookup(x, 'S'));
  };
  const role = v => lookup(v, 'S')?.decodeText?.();
  // Browsers and Word write /Headers on every data cell even for a plain
  // table: each cell pointing at the header above it in the first row. That
  // is exactly what one column-header row exports, so it is safe to reuse.
  const simpleHeaders = table => {
    const rows = [];
    const collect = v => kids(v).forEach(k => { const r = role(k); if (r === 'TR') rows.push(kids(k).filter(c => ['TH', 'TD'].includes(role(c)))); else if (['THead', 'TBody', 'TFoot'].includes(r)) collect(k); });
    collect(table);
    if (!rows.length) return true;
    const ids = rows[0].map(c => role(c) === 'TH' ? str(lookup(c, 'ID')) : null);
    return rows.every((r, ri) => r.every((c, ci) => {
      const hs = headersOf(c);
      if (!hs || !hs.length) return true;
      return ri > 0 && hs.length === 1 && ids[ci] && hs[0] === ids[ci];
    }));
  };
  const walk = (value, listDepth = 0, inSimpleTable = false) => {
    const v = doc.context.lookup(value);
    if (!v || seen.has(v)) return;
    seen.add(v);
    if (v instanceof L.PDFArray) { v.asArray().forEach(child => walk(child, listDepth, inSimpleTable)); return; }
    if (!(v instanceof L.PDFDict)) return;
    const r = role(v);
    if (r === 'L') {
      if (listDepth) issues.add('Nested list levels cannot be preserved on export; keep the original or use layout suggestions.');
      listDepth++;
    }
    if (r === 'Table') inSimpleTable = simpleHeaders(v);
    if (lookup(v, 'ActualText')) issues.add('Replacement text (ActualText) cannot be preserved on export; keep the original PDF.');
    // A tag that repeats the document's own language changes nothing.
    if (lookup(v, 'Lang') && lang(lookup(v, 'Lang')) !== docLang) issues.add('Language changes within the document cannot be preserved on export; keep the original PDF.');
    if (headersOf(v) && !inSimpleTable) issues.add('Explicit table header associations cannot be preserved on export; keep the original PDF.');
    for (const a of attrList(v)) {
      if ((lookup(a, 'RowSpan')?.asNumber?.() || 1) > 1 || (lookup(a, 'ColSpan')?.asNumber?.() || 1) > 1) issues.add('Merged table cells cannot be preserved on export; keep the original PDF.');
      const scope = lookup(a, 'Scope')?.decodeText?.();
      if (scope && scope !== 'Column') issues.add('Row or combined table headers cannot be preserved on export; keep the original PDF.');
    }
    walk(lookup(v, 'K'), listDepth, inSimpleTable);
  };
  walk(lookup(doc.catalog, 'StructTreeRoot'));
  return [...issues];
}

export function existingStructure(pages) {
  const blocks = [], issues = new Set();
  let linkedChars = 0, totalChars = 0, unlinkedChars = 0;
  for (const p of pages) {
    const usedItems = new Set(), usedImages = new Set();
    const ids = new Set(refs(p.tree || {}));
    // An image's operator MCID is numeric. Match it only to this page's main
    // stream IDs (Form XObjects use a different prefix and need more work).
    const mainPrefix = `p${p.ref || ''}`;
    const findImages = wanted => p.images.filter(im => Number.isInteger(im.mcid) && wanted.some(id => id === `${mainPrefix}_mc${im.mcid}`));
    const collect = node => {
      const wanted = refs(node);
      const items = p.items.filter(it => it.s.trim() && !it.artifact && it.markedIds?.some(id => wanted.includes(id)) && !usedItems.has(it));
      const images = findImages(wanted).filter(im => !usedImages.has(im));
      items.forEach(it => usedItems.add(it));
      images.forEach(im => usedImages.add(im));
      linkedChars += items.reduce((n, it) => n + it.s.trim().length, 0);
      return { items, images, bbox: union([...items.map(itemBox), ...images.map(imageBox)]) };
    };
    const add = (type, node, data, extra = {}) => {
      const b = { id: blocks.length, page: p.n, type, text: text(data.items), items: data.items, bbox: data.bbox,
        fileIndex: data.items.length ? Math.min(...data.items.map(it => it.i)) : data.images[0]?.i ?? 1e9,
        sourceRole: node.role, why: `Existing ${node.role} tag`, ...extra };
      blocks.push(b);
      return b;
    };
    const visit = node => {
      if (!node) return;
      if (CONTAINERS.has(node.role)) { (node.children || []).forEach(visit); return; }
      if (node.role === 'Table') {
        const rowNodes = [];
        const rowsIn = n => { if (n.role === 'TR') rowNodes.push(n); else (n.children || []).forEach(rowsIn); };
        rowsIn(node);
        const rows = rowNodes.map(r => (r.children || []).filter(c => c.role === 'TH' || c.role === 'TD').map(c => {
          const data = collect(c);
          return { text: text(data.items), items: data.items, bbox: data.bbox, role: c.role };
        }));
        if (rows.length && rows.every(r => r.length && r.length === rows[0].length && r.every(c => c.bbox))) {
          let headerRows = 0;
          while (headerRows < rows.length && rows[headerRows].every(c => c.role === 'TH')) headerRows++;
          if (rows.slice(headerRows).some(r => r.some(c => c.role === 'TH')) || headerRows > 1) issues.add('Complex table headers need review; export supports one column-header row.');
          const items = rows.flat().flatMap(c => c.items);
          add('table', node, { items, images: [], bbox: union(rows.flat().map(c => c.bbox)) }, { rows, headerRows, text: `Table, ${rows.length} rows, ${rows[0].length} columns` });
          return;
        }
        // Keep already-collected cell text, even when the grid is not editable.
        rows.flat().forEach(c => { c.items.forEach(it => usedItems.delete(it)); linkedChars -= c.items.reduce((n, it) => n + it.s.trim().length, 0); });
        issues.add('A complex table is shown as text; keep the original or rebuild its table structure.');
      }
      const semantic = /^(H[1-6]|P|LI|Figure|Table)$/.test(node.role || '');
      if (!semantic && node.children?.some(c => c.role) && !node.alt && !node.actualText) { node.children.forEach(visit); return; }
      const data = collect(node);
      if (!data.bbox && node.bbox?.length === 4) data.bbox = [node.bbox[0] - (p.ox || 0), node.bbox[1] - (p.oy || 0), node.bbox[2] - (p.ox || 0), node.bbox[3] - (p.oy || 0)];
      if (node.actualText) issues.add('Replacement text (ActualText) needs an editor that preserves it; keep the original PDF.');
      if (node.role === 'LI' && node.children?.some(c => refs(c).length && c.role === 'L')) issues.add('Nested lists cannot be reused without flattening their levels; keep the original or use layout suggestions.');
      if (!data.items.length && !data.images.length && !node.alt && !node.actualText) {
        if (refs(node).some(id => ids.has(id)) || node.children?.some(c => c.type === 'object')) issues.add('Some tags point to annotations or content that Earshot cannot preview.');
        return;
      }
      if (node.role === 'Figure') {
        add('figure', node, data, { image: data.images[0], alt: node.alt || node.actualText || '', text: '' });
        if (data.images.length !== 1 || data.items.length) issues.add('A figure contains drawings or text; its exported structure needs a careful check.');
      } else {
        const type = /^H[1-6]$/.test(node.role) ? 'h' : node.role === 'LI' ? 'li' : 'p';
        add(type, node, data, { ...(type === 'h' ? { level: +node.role[1] } : {}), ...(node.actualText ? { text: node.actualText } : {}) });
        if (!semantic) issues.add(`The ${node.role || 'unknown'} role is retained as text when reusing tags.`);
        if (data.images.length) issues.add('Pictures inside text tags need review before export.');
      }
    };
    visit(p.tree);
    for (const it of p.items.filter(it => it.s.trim())) {
      totalChars += it.s.trim().length;
      if (usedItems.has(it)) continue;
      if (!it.artifact) unlinkedChars += it.s.trim().length;
      add(it.artifact ? 'artifact' : 'p', { role: it.artifact ? 'Artifact' : 'Unlinked text' }, { items: [it], images: [], bbox: itemBox(it) }, { why: it.artifact ? 'Existing artifact' : 'Outside the existing tag tree', unlinked: !it.artifact });
    }
    for (const im of p.images) if (!usedImages.has(im)) {
      add('artifact', { role: im.artifact ? 'Artifact' : 'Untagged picture' }, { items: [], images: [im], bbox: imageBox(im) }, { image: im, why: im.artifact ? 'Existing decorative picture' : 'Not announced by existing tags', unlinked: !im.artifact });
    }
  }
  if (unlinkedChars) issues.add(`${unlinkedChars.toLocaleString()} text characters are outside the existing tag tree; included at the end of each page for review.`);
  const canReuse = ![...issues].some(issue => !issue.includes('outside the existing tag tree'));
  return { blocks, issues: [...issues], linkedChars, totalChars, unlinkedChars, canReuse, hasTree: pages.some(p => p.tree?.children?.length) };
}
