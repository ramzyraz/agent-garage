// Reads a PDF with pdf.js into Earshot's page model (see analyze.js).
// Works in the browser and in Node (tests pass in the pdf.js module).

const BOLD = /bold|black|heavy|semibold|demi|extrab/i;

function mul(m, n) {
  return [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
}

export async function extractPage(pdfjs, page, index) {
  const [x0, y0, x1, y1] = page.view;
  const ops = await page.getOperatorList();
  const tc = await page.getTextContent({ includeMarkedContent: true });
  let tree = null;
  try { tree = await page.getStructTree(); } catch { /* malformed or absent tree */ }
  const fontInfo = {};
  for (const name of new Set(tc.items.map(it => it.fontName).filter(Boolean))) {
    let real = '';
    try { const f = page.commonObjs.get(name); real = (f && (f.name || f.loadedName)) || ''; } catch { /* not loaded */ }
    fontInfo[name] = { real, bold: BOLD.test(real) };
  }
  const items = [];
  const marked = [];
  let i = 0;
  tc.items.forEach(it => {
    if (it.type === 'beginMarkedContent' || it.type === 'beginMarkedContentProps') { marked.push(it); return; }
    if (it.type === 'endMarkedContent') { marked.pop(); return; }
    if (typeof it.str !== 'string') return;
    const t = it.transform;
    const size = Math.hypot(t[2], t[3]) || it.height || 10;
    items.push({
      s: it.str, x: t[4] - x0, y: t[5] - y0, w: it.width, size,
      font: (fontInfo[it.fontName] && fontInfo[it.fontName].real) || it.fontName,
      bold: !!(fontInfo[it.fontName] && fontInfo[it.fontName].bold), i: i++,
      markedIds: marked.map(m => m.id).filter(Boolean), artifact: marked.some(m => m.tag === 'Artifact'),
      rot: Math.abs(t[1]) > 0.01 * size, dx: t[0] / size, dy: t[1] / size,
    });
  });
  // Images: follow the transformation matrix through the operator list.
  const O = pdfjs.OPS, images = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [], imageMarked = [];
  ops.fnArray.forEach((fn, k) => {
    const a = ops.argsArray[k];
    if (fn === O.beginMarkedContent || fn === O.beginMarkedContentProps) imageMarked.push({ tag: a[0], mcid: a[1] });
    else if (fn === O.endMarkedContent) imageMarked.pop();
    else if (fn === O.save) stack.push(ctm);
    else if (fn === O.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === O.transform) ctm = mul(a, ctm);
    else if (fn === O.paintFormXObjectBegin) { stack.push(ctm); if (a && a[0]) ctm = mul(a[0], ctm); }
    else if (fn === O.paintFormXObjectEnd) ctm = stack.pop() || ctm;
    else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintImageMaskXObject || fn === O.paintImageXObjectRepeat) {
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => [ctm[0] * u + ctm[2] * v + ctm[4], ctm[1] * u + ctm[3] * v + ctm[5]]);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x = Math.min(...xs) - x0, y = Math.min(...ys) - y0;
      images.push({ x, y, w: Math.max(...xs) - x0 - x, h: Math.max(...ys) - y0 - y, i: 100000 + k, mcid: imageMarked.map(m => m.mcid).filter(Number.isInteger).at(-1), artifact: imageMarked.some(m => m.tag === 'Artifact') });
    }
  });
  return { n: index, tree, ref: page.ref ? `${page.ref.num}R${page.ref.gen || ''}` : '', rotation: page.rotate, w: x1 - x0, h: y1 - y0, ox: x0, oy: y0, items, images };
}

export async function extractDocument(pdfjs, doc, onProgress) {
  const pages = [];
  let tagged = false, structSummary = null;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const extracted = await extractPage(pdfjs, page, n - 1);
    pages.push(extracted);
    if (extracted.tree && extracted.tree.children && extracted.tree.children.length) {
      tagged = true;
      structSummary = structSummary || {};
      const counts = summarize(extracted.tree);
      for (const [role, count] of Object.entries(counts)) structSummary[role] = (structSummary[role] || 0) + count;
    }
    if (onProgress) onProgress(n, doc.numPages);
  }
  let meta = {};
  try { meta = await doc.getMetadata(); } catch { /* none */ }
  let markInfo = null;
  try { markInfo = await doc.getMarkInfo(); } catch { /* none */ }
  const info = meta.info || {};
  const dcTitle = meta.metadata && meta.metadata.get ? meta.metadata.get('dc:title') : null;
  return {
    pages, tagged: tagged || !!(markInfo && markInfo.Marked), structSummary,
    title: (dcTitle || info.Title || '').trim(), lang: (info.Language || '').trim(),
    producer: info.Producer || '', encrypted: !!info.IsEncrypted,
  };
}

function summarize(tree) {
  const counts = {};
  (function walk(n) {
    if (n.role) counts[n.role] = (counts[n.role] || 0) + 1;
    (n.children || []).forEach(walk);
  })(tree);
  return counts;
}
