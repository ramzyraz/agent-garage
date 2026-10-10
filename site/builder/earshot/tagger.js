// Writes a tagged PDF from Earshot's reviewed structure. Every page's content
// stream is copied byte for byte, with marked-content operators inserted
// around each text run, picture and drawing: real content gets an MCID that
// the structure tree points to, everything else becomes an Artifact.
// Existing tags are replaced (optional-content markers are kept).

import { lex, interpret, PATH_START, PATH_PAINT, SHOW } from './contentstream.js';
import { itemBox } from './analyze.js';

const enc = new TextEncoder();

export async function tagPdf(L, bytes, plan) {
  const { PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber, PDFString, PDFHexString, PDFRawStream, decodePDFRawStream } = L;
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const ctx = doc.context;
  const N = k => PDFName.of(k);
  const get = (d, k) => (d && d.lookup ? d.lookup(N(k)) : undefined);
  const num = v => (v && v.asNumber ? v.asNumber() : typeof v === 'number' ? v : undefined);
  const nameOf = v => (v && v.decodeText ? v.decodeText() : v ? String(v).replace(/^\//, '') : '');
  const report = { pages: 0, mcids: 0, unmatchedText: 0, emptyLeaves: [], figuresWithoutAlt: 0, links: 0, formsWithText: 0, unembeddedFonts: [], strippedTags: 0, splitOps: 0, forms: 0, fieldsWithoutName: 0, unmatchedSamples: [] };

  // ---- leaves: the smallest tagged pieces, per page ----
  const leaves = new Map();
  const pageLeaves = plan.pages.map(() => []);
  const addLeaf = (key, page, role, rects, extra = {}) => {
    const leaf = { key, page, role, rects, mcids: [], ...extra };
    leaves.set(key, leaf);
    pageLeaves[page].push(leaf);
    return leaf;
  };
  const boxes = items => items.map(itemBox);
  const isBulletItem = it => /^[•▪●◦‣⁃∙·■□–—*-]$|^\(?\d{1,2}[.)]$|^\(?[a-z][.)]$/.test(it.s.trim());
  for (const b of plan.blocks) {
    if (b.type === 'artifact') {
      const pag = /header/i.test(b.why || '') ? 'Header' : /footer|page number/i.test(b.why || '') ? 'Footer' : null;
      addLeaf('a' + b.id, b.page, null, b.image ? [b.bbox] : boxes(b.items), { artifact: true, pag, isImage: !!b.image });
    } else if (b.type === 'table') {
      b.rows.forEach((r, ri) => r.forEach((c, ci) => addLeaf(`${b.id}:${ri}:${ci}`, b.page, ri < (b.headerRows || 0) ? 'TH' : 'TD', boxes(c.items))));
    } else if (b.type === 'figure') {
      addLeaf(String(b.id), b.page, 'Figure', [b.bbox], { isImage: true });
    } else if (b.type === 'li') {
      const its = b.items.slice().sort((p, q) => q.y - p.y || p.x - q.x);
      const first = its[0];
      if (first && isBulletItem(first) && its.length > 1) {
        addLeaf(b.id + ':lbl', b.page, 'Lbl', boxes([first]));
        addLeaf(b.id + ':body', b.page, 'LBody', boxes(its.slice(1)));
      } else addLeaf(b.id + ':body', b.page, 'LBody', boxes(b.items));
    } else {
      addLeaf(String(b.id), b.page, b.type === 'h' ? 'H' + (b.level || 1) : 'P', boxes(b.items));
    }
  }

  const pages = doc.getPages();
  report.pages = pages.length;
  const parentArrays = [];

  // Decode every page's content streams first (some need an async fallback).
  const decoded = [];
  for (const page of pages) {
    const contents = page.node.Contents();
    const streams = !contents ? [] : contents instanceof PDFArray ? contents.asArray().map(r => ctx.lookup(r)) : [contents];
    const parts = [];
    for (const st of streams) parts.push(await decodeStream(st));
    decoded.push(parts);
  }

  pages.forEach((page, pn) => {
    const off = plan.pages[pn] || { ox: 0, oy: 0 };
    const node = page.node;
    const res = node.Resources ? node.Resources() : get(node, 'Resources');
    const fontDict = get(res, 'Font');
    const xobjDict = get(res, 'XObject');
    const fontCache = {};
    const fonts = name => {
      if (name in fontCache) return fontCache[name];
      const f = fontDict && fontDict.lookup(N(name));
      return (fontCache[name] = f instanceof PDFDict ? fontMetrics(f) : null);
    };

    // Decode all content streams into one byte array.
    const parts = decoded[pn];
    const total = parts.reduce((n, p) => n + p.length + 1, 0);
    const src = new Uint8Array(total);
    let at = 0;
    for (const p of parts) { src.set(p, at); at += p.length; src[at++] = 10; }

    const ops = lex(src);
    const out = [];
    const emit = s => out.push(typeof s === 'string' ? enc.encode(s) : s);
    let open = null, mcid = 0, inPath = false;
    const mcStack = [];
    const parentArr = [];
    const close = () => { if (open) { emit('EMC\n'); open = null; } };
    const ensure = target => {
      const key = target.leaf ? 'L' + target.leaf.key : 'A' + (target.pag || '');
      if (open && open.key === key) return;
      close();
      if (target.leaf) {
        target.leaf.mcids.push(mcid);
        parentArr[mcid] = target.leaf;
        emit(`/${target.leaf.role.replace(/^H\d$/, m => m)} <</MCID ${mcid}>> BDC\n`);
        mcid++;
      } else if (target.pag) emit(`/Artifact <</Type /Pagination /Subtype /${target.pag}>> BDC\n`);
      else emit('/Artifact BMC\n');
      open = { key };
    };
    const local = box => [box[0] - off.ox, box[1] - off.oy, box[2] - off.ox, box[3] - off.oy];
    const textLeaves = pageLeaves[pn].filter(l => !l.isImage);
    const imageLeaves = pageLeaves[pn].filter(l => l.isImage);
    const matchText = box => {
      const b = local(box), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, hgt = b[3] - b[1];
      let best = null, bestScore = Infinity;
      for (const l of textLeaves) for (const r of l.rects) {
        const dx = Math.max(r[0] - cx, 0, cx - r[2]), dy = Math.max(r[1] - cy, 0, cy - r[3]);
        const d = Math.hypot(dx, dy);
        const score = d === 0 ? -1 / ((r[2] - r[0]) * (r[3] - r[1]) + 1) : d;
        if (score < bestScore) { bestScore = score; best = l; }
      }
      return best && bestScore < Math.max(2, 0.6 * hgt) ? best : null;
    };
    const matchImage = box => {
      const b = local(box);
      let best = null, bestIoU = 0.3;
      for (const l of imageLeaves) {
        const r = l.rects[0];
        const ix = Math.max(0, Math.min(b[2], r[2]) - Math.max(b[0], r[0])), iy = Math.max(0, Math.min(b[3], r[3]) - Math.max(b[1], r[1]));
        const inter = ix * iy, uni = (b[2] - b[0]) * (b[3] - b[1]) + (r[2] - r[0]) * (r[3] - r[1]) - inter;
        const iou = uni > 0 ? inter / uni : 0;
        if (iou > bestIoU) { bestIoU = iou; best = l; }
      }
      return best;
    };
    const target = leaf => (leaf && !leaf.artifact ? { leaf } : { pag: leaf && leaf.pag });

    interpret(ops, fonts, (o, info, inText) => {
      const op = o.op;
      if (op === 'BDC' || op === 'BMC') {
        const tag = o.args[0] && o.args[0].name;
        if (tag === 'OC') { close(); mcStack.push(true); emit(src.subarray(o.start, o.end)); emit('\n'); } else { mcStack.push(false); report.strippedTags++; }
        return;
      }
      if (op === 'EMC') {
        const keep = mcStack.pop();
        if (keep) { close(); emit(src.subarray(o.start, o.end)); emit('\n'); }
        return;
      }
      if (op === 'q' || op === 'Q' || op === 'BT' || op === 'ET') close();
      if (op === 'TJ' && inText && info && Array.isArray(o.args[0])) {
        // One TJ can cover several pieces (a section number and its title,
        // table cells): split it at piece boundaries. Splitting a TJ array
        // draws exactly the same glyphs in the same places.
        const arr = o.args[0];
        const targets = info.segs.map(b => (b ? matchText(b) : undefined));
        const keys = new Set(targets.filter(t => t !== undefined).map(t => (t ? t.key : '')));
        if (keys.size > 1) {
          let run = [], runTarget;
          const flush = () => {
            if (!run.length) return;
            if (runTarget !== undefined) ensure(target(runTarget)); else if (!open) ensure({});
            emit(`[${run.map(serial).join(' ')}] TJ\n`);
            run = [];
          };
          arr.forEach((el, k) => {
            const t = targets[k];
            if (t !== undefined && runTarget !== undefined && t !== runTarget) flush();
            if (t !== undefined) { runTarget = t; if (!t && el.str && el.str.length) report.unmatchedText++; }
            run.push(el);
          });
          flush();
          report.splitOps++;
          return;
        }
      }
      if (SHOW.has(op) && inText && info) {
        const leaf = matchText(info.box);
        if (!leaf && info.glyphs) {
          report.unmatchedText++;
          if (report.unmatchedSamples.length < 12) report.unmatchedSamples.push({ page: pn, box: local(info.box).map(Math.round) });
        }
        ensure(target(leaf));
      } else if (PATH_START.has(op) && !inPath && !inText) {
        inPath = true;
        ensure({});
      } else if (op === 'sh') {
        ensure({});
      } else if (op === 'Do' && info) {
        const xo = xobjDict && xobjDict.lookup(N(o.args[0] && o.args[0].name));
        const sub = xo && nameOf(get(xo.dict || xo, 'Subtype'));
        if (sub === 'Image') ensure(target(matchImage(info.box)));
        else if (sub === 'Form') {
          const bb = get(xo.dict, 'BBox'), m = get(xo.dict, 'Matrix');
          const bbox = bb ? bb.asArray().map(num) : [0, 0, 1, 1];
          const mat = m ? m.asArray().map(num) : [1, 0, 0, 1, 0, 0];
          const full = mulM(mat, info.ctm);
          const pts = [[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[0], bbox[3]], [bbox[2], bbox[3]]].map(([x, y]) => [full[0] * x + full[2] * y + full[4], full[1] * x + full[3] * y + full[5]]);
          const box = local([Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]);
          const tally = new Map();
          for (const l of textLeaves) for (const r of l.rects) {
            const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2;
            if (cx >= box[0] && cx <= box[2] && cy >= box[1] && cy <= box[3]) tally.set(l, (tally.get(l) || 0) + 1);
          }
          const img = matchImage(box);
          if (img) ensure(target(img));
          else if (tally.size) {
            report.formsWithText++;
            ensure(target([...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]));
          } else ensure({});
        } else ensure({});
      } else if (op === 'BI' && info) {
        ensure(target(matchImage(info.box)));
      }
      emit(src.subarray(o.start, o.end));
      emit('\n');
      if (PATH_PAINT.has(op)) inPath = false;
    });
    close();
    while (mcStack.pop() === true) emit('EMC\n');

    const size = out.reduce((n, p) => n + p.length, 0);
    const buf = new Uint8Array(size);
    let k = 0;
    for (const p of out) { buf.set(p, k); k += p.length; }
    node.set(N('Contents'), ctx.register(ctx.flateStream(buf)));
    node.set(N('StructParents'), PDFNumber.of(pn));
    node.set(N('Tabs'), N('S'));
    parentArrays[pn] = parentArr;
    report.mcids += mcid;

    // Fonts must be embedded for PDF/UA.
    if (fontDict) for (const [, ref] of fontDict.entries()) {
      const f = ctx.lookup(ref);
      if (f instanceof PDFDict && !fontEmbedded(f)) report.unembeddedFonts.push(nameOf(get(f, 'BaseFont')));
    }
  });

  // ---- structure tree ----
  const root = ctx.obj({ Type: 'StructTreeRoot' });
  const rootRef = ctx.register(root);
  const docEl = ctx.obj({ Type: 'StructElem', S: 'Document', P: rootRef });
  const docRef = ctx.register(docEl);
  root.set(N('K'), docRef);
  const pageRefs = pages.map(p => p.ref);
  const kids = new Map(); // parent ref → array of child refs
  const addKid = (parentRef, ref) => { if (!kids.has(parentRef)) kids.set(parentRef, []); kids.get(parentRef).push(ref); };
  const elem = (role, parentRef, extra = {}) => {
    const d = ctx.obj({ Type: 'StructElem', S: role, P: parentRef });
    for (const [k, v] of Object.entries(extra)) d.set(N(k), v);
    const ref = ctx.register(d);
    addKid(parentRef, ref);
    return { d, ref };
  };
  const leafElem = (leaf, parentRef, extra) => {
    if (!leaf || !leaf.mcids.length) { if (leaf) report.emptyLeaves.push(leaf.key); return null; }
    const e = elem(leaf.role, parentRef, extra);
    e.d.set(N('Pg'), pageRefs[leaf.page]);
    e.d.set(N('K'), leaf.mcids.length === 1 ? PDFNumber.of(leaf.mcids[0]) : ctx.obj(leaf.mcids));
    leaf.ref = e.ref;
    return e;
  };
  const real = plan.blocks.filter(b => b.type !== 'artifact');
  for (let i = 0; i < real.length; i++) {
    const b = real[i];
    if (b.type === 'li') {
      const list = elem('L', docRef);
      while (i < real.length && real[i].type === 'li') {
        const li = elem('LI', list.ref);
        leafElem(leaves.get(real[i].id + ':lbl'), li.ref);
        leafElem(leaves.get(real[i].id + ':body'), li.ref);
        i++;
      }
      i--;
    } else if (b.type === 'table') {
      const t = elem('Table', docRef);
      b.rows.forEach((r, ri) => {
        const tr = elem('TR', t.ref);
        r.forEach((c, ci) => {
          const header = ri < (b.headerRows || 0);
          leafElem(leaves.get(`${b.id}:${ri}:${ci}`), tr.ref, header ? { A: ctx.obj({ O: 'Table', Scope: 'Column' }) } : {});
        });
      });
    } else if (b.type === 'figure') {
      const off = plan.pages[b.page] || { ox: 0, oy: 0 };
      const extra = { A: ctx.obj({ O: 'Layout', BBox: [b.bbox[0] + off.ox, b.bbox[1] + off.oy, b.bbox[2] + off.ox, b.bbox[3] + off.oy] }) };
      if (b.alt && b.alt.trim()) extra.Alt = PDFHexString.fromText(b.alt.trim()); else report.figuresWithoutAlt++;
      leafElem(leaves.get(String(b.id)), docRef, extra);
    } else {
      leafElem(leaves.get(String(b.id)), docRef);
    }
  }

  // Links: a Link element per link annotation, inside the element it covers.
  let nextKey = pages.length;
  const nums = [];
  pages.forEach((page, pn) => {
    const annots = get(page.node, 'Annots');
    if (!(annots instanceof PDFArray)) return;
    const off = plan.pages[pn] || { ox: 0, oy: 0 };
    annots.asArray().forEach(ref => {
      const a = ctx.lookup(ref);
      if (!(a instanceof PDFDict)) return;
      a.delete(N('StructParent'));
      const subtype = nameOf(get(a, 'Subtype'));
      if (subtype === 'Widget') {
        // Form fields: a Form element pointing at the widget, in reading order
        // near the text it sits in or next to.
        const flags = num(get(a, 'F')) || 0;
        if (flags & 2) return; // hidden
        const rect = get(a, 'Rect');
        const r = rect ? rect.asArray().map(num) : [0, 0, 0, 0];
        const cx = (r[0] + r[2]) / 2 - off.ox, cy = (r[1] + r[3]) / 2 - off.oy;
        const host = nearestLeaf(pageLeaves[pn], cx, cy);
        const field = get(a, 'Parent') instanceof PDFDict && !get(a, 'T') ? get(a, 'Parent') : a;
        const tu = get(field, 'TU') || get(a, 'TU');
        const form = elem('Form', host ? host.ref : docRef, tu ? { Alt: tu } : {});
        if (!tu) report.fieldsWithoutName++;
        form.d.set(N('Pg'), page.ref);
        form.d.set(N('K'), ctx.obj([ctx.obj({ Type: 'OBJR', Obj: ref, Pg: page.ref })]));
        a.set(N('StructParent'), PDFNumber.of(nextKey));
        nums.push(nextKey, form.ref);
        nextKey++;
        report.forms++;
        return;
      }
      if (subtype !== 'Link') return;
      const rect = get(a, 'Rect');
      const r = rect ? rect.asArray().map(num) : [0, 0, 0, 0];
      const cx = (r[0] + r[2]) / 2 - off.ox, cy = (r[1] + r[3]) / 2 - off.oy;
      const host = pageLeaves[pn].find(l => l.ref && l.rects.some(q => cx >= q[0] - 2 && cx <= q[2] + 2 && cy >= q[1] - 2 && cy <= q[3] + 2));
      const link = elem('Link', host ? host.ref : docRef);
      link.d.set(N('Pg'), page.ref);
      link.d.set(N('K'), ctx.obj([ctx.obj({ Type: 'OBJR', Obj: ref, Pg: page.ref })]));
      if (!get(a, 'Contents')) {
        const act = get(a, 'A');
        const uri = act && get(act, 'URI');
        a.set(N('Contents'), PDFHexString.fromText(uri ? `Link to ${uri.decodeText ? uri.decodeText() : uri}` : 'Link'));
      }
      a.set(N('StructParent'), PDFNumber.of(nextKey));
      nums.push(nextKey, link.ref);
      nextKey++;
      report.links++;
    });
  });

  // Children arrays (leaf elements already have K = MCIDs; hosts of links get a mixed K).
  for (const [parentRef, refs] of kids) {
    const d = parentRef === rootRef ? null : ctx.lookup(parentRef);
    if (!d) continue;
    const existing = d.get(N('K'));
    const arr = [];
    if (existing) {
      if (existing instanceof PDFArray) arr.push(...existing.asArray()); else arr.push(existing);
    }
    arr.push(...refs);
    d.set(N('K'), ctx.obj(arr));
  }

  const parentNums = [];
  parentArrays.forEach((arr, pn) => {
    const refs = [];
    for (let m = 0; m < arr.length; m++) refs.push(arr[m] && arr[m].ref ? arr[m].ref : ctx.obj(null));
    parentNums.push(pn, ctx.register(ctx.obj(refs)));
  });
  parentNums.push(...nums);
  root.set(N('ParentTree'), ctx.register(ctx.obj({ Nums: parentNums })));
  root.set(N('ParentTreeNextKey'), PDFNumber.of(nextKey));

  // ---- document-level settings ----
  const cat = doc.catalog;
  cat.set(N('MarkInfo'), ctx.obj({ Marked: true }));
  cat.set(N('StructTreeRoot'), rootRef);
  if (plan.lang) cat.set(N('Lang'), PDFString.of(plan.lang));
  const title = (plan.title || '').trim();
  if (title) doc.setTitle(title, { showInWindowTitleBar: true });
  const vp = cat.lookup(N('ViewerPreferences'));
  if (vp instanceof PDFDict) vp.set(N('DisplayDocTitle'), ctx.obj(true)); else cat.set(N('ViewerPreferences'), ctx.obj({ DisplayDocTitle: true }));
  doc.setProducer('Earshot (agent-garage) with pdf-lib');
  doc.setModificationDate(new Date());
  const xmp = enc.encode(xmpPacket(title, plan.lang));
  cat.set(N('Metadata'), ctx.register(ctx.stream(xmp, { Type: 'Metadata', Subtype: 'XML', Length: xmp.length })));

  const outBytes = await doc.save({ useObjectStreams: false });
  return { bytes: outBytes, report };

  // ---- helpers needing pdf-lib classes ----
  async function decodeStream(st) {
    if (!(st instanceof PDFRawStream)) return st.getUnencodedContents ? st.getUnencodedContents() : st.getContents();
    try {
      return decodePDFRawStream(st).decode();
    } catch (e) {
      // pdf-lib is strict about zlib headers; fall back to the platform inflater,
      // keeping whatever decodes before any corruption (as pdf.js does).
      const raw = st.getContents();
      if (raw.length < 3) return new Uint8Array(0);
      for (const [fmt, data] of [['deflate', raw], ['deflate-raw', raw.subarray(2)], ['deflate-raw', raw]]) {
        const got = await inflate(fmt, data);
        if (got && got.length) { report.repairedStreams = (report.repairedStreams || 0) + 1; return got; }
      }
      throw e;
    }
  }
  function fontMetrics(f) {
    const sub = nameOf(get(f, 'Subtype'));
    if (sub === 'Type0') {
      const desc = get(f, 'DescendantFonts');
      const cid = desc && desc.lookup(0);
      const dw = num(get(cid, 'DW')) || 1000;
      const map = new Map();
      const W = get(cid, 'W');
      if (W instanceof PDFArray) {
        const a = W.asArray().map(v => ctx.lookup(v) || v);
        for (let i = 0; i < a.length;) {
          const first = num(a[i]);
          const next = a[i + 1];
          if (next instanceof PDFArray) { next.asArray().forEach((w, k) => map.set(first + k, num(ctx.lookup(w) || w))); i += 2; } else { const last = num(next), w = num(a[i + 2]); for (let c = first; c <= last && c - first < 65536; c++) map.set(c, w); i += 3; }
        }
      }
      return { twoByte: true, width: c => (map.has(c) ? map.get(c) : dw) };
    }
    const first = num(get(f, 'FirstChar')) || 0;
    const ws = get(f, 'Widths');
    const widths = ws instanceof PDFArray ? ws.asArray().map(w => num(ctx.lookup(w) || w) || 0) : null;
    const fd = get(f, 'FontDescriptor');
    const missing = num(get(fd, 'MissingWidth')) || 500;
    let scale = 1;
    if (sub === 'Type3') { const fm = get(f, 'FontMatrix'); scale = fm ? num(fm.lookup(0)) * 1000 : 1; }
    return { twoByte: false, width: c => (widths && c >= first && c - first < widths.length ? widths[c - first] * scale : missing) };
  }
  function fontEmbedded(f) {
    const sub = nameOf(get(f, 'Subtype'));
    if (sub === 'Type3') return true;
    let fd = get(f, 'FontDescriptor');
    if (sub === 'Type0') { const d = get(f, 'DescendantFonts'); fd = get(d && d.lookup(0), 'FontDescriptor'); }
    return !!(fd && (get(fd, 'FontFile') || get(fd, 'FontFile2') || get(fd, 'FontFile3')));
  }
}

async function inflate(format, data) {
  if (typeof DecompressionStream === 'undefined') return null;
  const chunks = [];
  try {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    writer.write(data).catch(() => {});
    writer.close().catch(() => {});
    const reader = ds.readable.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } catch { /* keep what decoded */ }
  const n = chunks.reduce((k, c) => k + c.length, 0);
  const out = new Uint8Array(n);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

function nearestLeaf(leaves, cx, cy) {
  let best = null, bd = Infinity;
  for (const l of leaves) {
    if (!l.ref || l.artifact) continue;
    for (const q of l.rects) {
      const d = Math.hypot(Math.max(q[0] - cx, 0, cx - q[2]), Math.max(q[1] - cy, 0, cy - q[3]));
      if (d < bd) { bd = d; best = l; }
    }
  }
  return bd < 60 ? best : null;
}

function serial(el) {
  if (typeof el === 'number') return String(Math.round(el * 1000) / 1000);
  if (el && el.str) return '<' + Array.from(el.str, b => b.toString(16).padStart(2, '0')).join('') + '>';
  return '';
}

function mulM(m, n) {
  return [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
}

function xmlEscape(s) {
  return String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}
function xmpPacket(title, lang) {
  const now = new Date().toISOString();
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(title)}</rdf:li></rdf:Alt></dc:title>
${lang ? `<dc:language><rdf:Bag><rdf:li>${xmlEscape(lang)}</rdf:li></rdf:Bag></dc:language>` : ''}
<xmp:ModifyDate>${now}</xmp:ModifyDate>
<xmp:MetadataDate>${now}</xmp:MetadataDate>
<pdf:Producer>Earshot (agent-garage) with pdf-lib</pdf:Producer>
<pdfuaid:part>1</pdfuaid:part>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}
