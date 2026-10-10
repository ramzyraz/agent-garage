// Earshot unit tests: node --test projects/builder/tests/*.test.js
// The full-pipeline tests need pdf.js in /tmp/lib (npm install --prefix /tmp/lib pdfjs-dist@5)
// and are skipped without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { lex, interpret } from '../../../site/builder/earshot/contentstream.js';
import { analyze, buildLines, normalizeLevels, fileOrder } from '../../../site/builder/earshot/analyze.js';
import { buildChecks, suggestTitle } from '../../../site/builder/earshot/checks.js';
import { toHtml } from '../../../site/builder/earshot/html.js';
import * as L from '../../../site/builder/earshot/vendor/pdf-lib.esm.min.js';
import { tagPdf } from '../../../site/builder/earshot/tagger.js';
import { extractDocument } from '../../../site/builder/earshot/extract.js';
import { existingStructure, inspectExistingAttributes } from '../../../site/builder/earshot/existing.js';

const enc = s => new TextEncoder().encode(s);
const PDFJS = '/tmp/lib/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
const SAMPLE = new URL('../../../site/builder/earshot/sample.pdf', import.meta.url);

test('existing tag order wins over physical/file order; unlinked text stays visible', () => {
  const a = item('Stored first', 40, 700, 12, { i: 0, markedIds: ['p1R_mc0'] });
  const b = item('Read first', 40, 500, 12, { i: 1, markedIds: ['p1R_mc1'] });
  const hidden = item('Hidden footer', 40, 20, 10, { i: 2, artifact: true });
  const outside = item('Must not disappear', 40, 200, 10, { i: 3, markedIds: ['p1R_mc99'] });
  const tree = { role: 'Root', children: [
    { role: 'H3', children: [{ type: 'content', id: 'p1R_mc1' }] },
    { role: 'P', children: [{ type: 'content', id: 'p1R_mc0' }] },
  ] };
  const ex = existingStructure([{ n: 0, ref: '1R', items: [a, b, hidden, outside], images: [], tree }]);
  assert.equal(ex.blocks[0].text, 'Read first');
  assert.equal(ex.blocks[0].level, 3, 'do not normalize original heading levels');
  assert.equal(ex.blocks[1].text, 'Stored first');
  assert.equal(ex.blocks[2].type, 'artifact');
  assert.equal(ex.blocks[3].unlinked, true);
  assert.equal(ex.unlinkedChars, outside.s.length);
  assert.equal(ex.canReuse, true, 'unlinked text can be included for review');
});

test('unsafe original structures are previewed but cannot be reused silently', () => {
  const it = item('Formula text', 20, 300, 10, { markedIds: ['p1R_mc0'] });
  const ex = existingStructure([{ n: 0, ref: '1R', items: [it], images: [], tree: { role: 'Root', children: [{ role: 'Formula', actualText: 'a squared', children: [{ type: 'content', id: 'p1R_mc0' }] }] } }]);
  assert.equal(ex.blocks[0].text, 'a squared');
  assert.equal(ex.canReuse, false);
  assert.ok(ex.issues.some(i => i.includes('ActualText')));
  assert.ok(ex.issues.some(i => i.includes('Formula')));
});

test('raw tag attribute check catches merged cells, row headers and nested lists', async () => {
  const d = await L.PDFDocument.create();
  d.addPage();
  const root = d.context.obj({ Type: 'StructTreeRoot', K: [
    { S: 'TH', A: { O: 'Table', Scope: 'Row', ColSpan: 2 } },
    { S: 'TD', A: { O: 'Table', RowSpan: 2, Headers: [L.PDFString.of('header')] } },
    { S: 'L', K: { S: 'LI', K: { S: 'L' } } },
    { S: 'P', Lang: L.PDFString.of('de') },
  ] });
  d.catalog.set(L.PDFName.of('StructTreeRoot'), d.context.register(root));
  const issues = await inspectExistingAttributes(L, await d.save());
  for (const word of ['Merged', 'Row or combined', 'Nested list', 'Language changes', 'Explicit table']) assert.ok(issues.some(i => i.includes(word)), word);
});

test('existing tags survive reuse/export, including table headers, alt text and hidden furniture', { skip: !existsSync(PDFJS) && 'pdf.js not installed' }, async () => {
  const pdfjs = await import(PDFJS);
  const bytes = new Uint8Array(readFileSync(SAMPLE));
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const ex = await extractDocument(pdfjs, doc);
  const { blocks } = analyze(ex.pages);
  blocks.find(b => b.type === 'figure').alt = 'A description from the original author';
  // A deliberate order and role different from Earshot's layout proposals.
  const a = blocks.findIndex(b => b.type === 'p');
  [blocks[a], blocks[a + 1]] = [blocks[a + 1], blocks[a]];
  blocks.find(b => b.type === 'h').level = 2;
  const first = await tagPdf(L, bytes, { pages: ex.pages, blocks, title: 'Original title', lang: 'fr' });
  const taggedDoc = await pdfjs.getDocument({ data: first.bytes.slice(), verbosity: 0 }).promise;
  const taggedEx = await extractDocument(pdfjs, taggedDoc);
  assert.deepEqual(await inspectExistingAttributes(L, first.bytes), []);
  const original = existingStructure(taggedEx.pages);
  assert.equal(original.hasTree, true);
  assert.equal(original.canReuse, true);
  assert.deepEqual(original.issues, []);
  assert.equal(original.unlinkedChars, 0);
  assert.equal(original.blocks[0].level, 2);
  const signature = bs => bs.filter(b => b.type !== 'artifact').map(b => ({ type: b.type, level: b.level, text: b.text.replace(/\s+/g, ' '), alt: b.alt, rows: b.rows?.map(r => r.map(c => c.text)), headerRows: b.headerRows }));
  assert.deepEqual(signature(original.blocks), signature(blocks));
  assert.equal(original.blocks.filter(b => b.type === 'artifact').length, 6);
  const rewritten = await tagPdf(L, first.bytes, { pages: taggedEx.pages, blocks: original.blocks, title: taggedEx.title, lang: taggedEx.lang });
  assert.equal(rewritten.report.unmatchedText, 0);
  assert.deepEqual(rewritten.report.emptyLeaves, []);
  const reusedDoc = await pdfjs.getDocument({ data: rewritten.bytes.slice(), verbosity: 0 }).promise;
  const reusedEx = await extractDocument(pdfjs, reusedDoc);
  assert.deepEqual(signature(existingStructure(reusedEx.pages).blocks), signature(original.blocks));
  assert.equal(reusedEx.title, 'Original title');
  assert.equal(reusedEx.lang, 'fr');
  await Promise.all([doc.destroy(), taggedDoc.destroy(), reusedDoc.destroy()]);
});

test('tags beginning after page three are discovered', { skip: !existsSync(PDFJS) && 'pdf.js not installed' }, async () => {
  const pdfjs = await import(PDFJS);
  const d = await L.PDFDocument.create();
  const font = await d.embedFont(L.StandardFonts.Helvetica);
  for (let n = 0; n < 4; n++) d.addPage([300, 400]).drawText(`Page ${n + 1} text`, { x: 30, y: 200, font });
  const input = await d.save();
  const source = await pdfjs.getDocument({ data: input.slice(), verbosity: 0 }).promise;
  const ex = await extractDocument(pdfjs, source);
  const { blocks } = analyze(ex.pages);
  const out = await tagPdf(L, input, { pages: ex.pages, blocks: blocks.filter(b => b.page === 3), title: 'Late tags', lang: 'en' });
  const result = await pdfjs.getDocument({ data: out.bytes.slice(), verbosity: 0 }).promise;
  const extracted = await extractDocument(pdfjs, result);
  assert.equal(extracted.tagged, true);
  assert.ok(extracted.structSummary.P);
  assert.equal(extracted.pages[0].tree?.children.length || 0, 0);
  assert.ok(extracted.pages[3].tree);
  await Promise.all([source.destroy(), result.destroy()]);
});

test('lexer keeps byte ranges and parses strings, arrays, dicts and inline images', () => {
  const src = enc('q 1 0 0 1 5 5 cm BT /F1 12 Tf (a\\(b\\)\\101) Tj [(x) -250 <4142>] TJ ET /P <</MCID 3>> BDC EMC BI /W 2 /H 1 ID \x00EI\xff EI Q');
  const ops = lex(src);
  assert.deepEqual(ops.map(o => o.op), ['q', 'cm', 'BT', 'Tf', 'Tj', 'TJ', 'ET', 'BDC', 'EMC', 'BI', 'Q']);
  assert.equal(new TextDecoder().decode(ops[4].args[0].str), 'a(b)A');
  assert.equal(ops[5].args[0][1], -250);
  assert.deepEqual([...ops[5].args[0][2].str], [0x41, 0x42]);
  assert.equal(ops[7].args[1].dict.MCID, 3);
  assert.equal(new TextDecoder().decode(src.subarray(ops[1].start, ops[1].end)), '1 0 0 1 5 5 cm');
});

test('interpreter places text using the font widths', () => {
  const ops = lex(enc('BT /F1 10 Tf 1 0 0 1 100 700 Tm (ab) Tj 0 -20 Td [(c) -1000 (d)] TJ ET'));
  const boxes = [];
  interpret(ops, () => ({ twoByte: false, width: () => 500 }), (o, info) => { if (info && info.box) boxes.push({ op: o.op, ...info }); });
  assert.equal(boxes.length, 2);
  assert.deepEqual(boxes[0].box.map(Math.round), [100, 698, 110, 709]); // two glyphs × 5pt
  assert.equal(Math.round(boxes[1].box[0]), 100); // Td moves from the line start
  assert.equal(Math.round(boxes[1].box[2]), 120); // c (5) + gap (10) + d (5)
  assert.equal(boxes[1].segs.filter(Boolean).length, 2);
});

const item = (s, x, y, size = 10, extra = {}) => ({ s, x, y, w: s.length * size * 0.5, size, font: 'Body', bold: false, i: 0, ...extra });

test('two columns are read left then right, page furniture is hidden', () => {
  const page = n => {
    const items = [
      ...(n === 0 ? [item('Annual report', 50, 690, 20, { font: 'Bold', bold: true })] : []),
      ...[0, 1, 2, 3].map(k => item(`left column line ${k} text text text`, 50, 650 - k * 13)),
      ...[0, 1, 2, 3].map(k => item(`right column line ${k} text text tex`, 320, 650 - k * 13)),
      item('City of Example', 50, 770, 8), item(`Page ${n + 1}`, 520, 30, 8),
    ];
    // file order: right column first
    items.reverse().forEach((it, k) => { it.i = k; });
    return { w: 612, h: 792, items, images: [] };
  };
  const { blocks } = analyze([page(0), page(1)]);
  const real = blocks.filter(b => b.page === 0 && b.type !== 'artifact');
  assert.equal(real[0].type, 'h');
  assert.match(real[1].text, /^left column line 0/);
  assert.match(real[2].text, /^right column line 0/);
  const hidden = blocks.filter(b => b.type === 'artifact').map(b => b.why);
  assert.deepEqual(hidden.sort(), ['Page number', 'Page number', 'Running header', 'Running header']);
  assert.match(fileOrder(blocks)[0].text, /Page 1|City/);
});

test('repeated-but-different captions are not mistaken for running headers', () => {
  const pages = [0, 1].map(n => ({ w: 612, h: 792, images: [], items: [item(`Table A-${n + 1}.`, 50, 740), item('Body text that is long enough to read', 50, 600)] }));
  const { blocks } = analyze(pages);
  assert.equal(blocks.filter(b => b.type === 'artifact').length, 0);
});

test('a lone section number stays on the line with its title', () => {
  const lines = buildLines([item('3.1', 72, 500, 10, { bold: true }), item('Encoder and Decoder Stacks', 92, 500, 10, { bold: true })]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, '3.1 Encoder and Decoder Stacks');
});

test('aligned short cells become a table with a header row', () => {
  const rows = [['Program', 'Ages', 'Fee'], ['Day camp', '6-12', '$640'], ['Swim', '4+', '$85'], ['Tennis', '8-15', '$120']];
  const items = rows.flatMap((r, ri) => r.map((c, ci) => item(c, 60 + ci * 160, 600 - ri * 20, 10, { bold: ri === 0, font: ri === 0 ? 'Bold' : 'Body' })));
  const { blocks } = analyze([{ w: 612, h: 792, items, images: [] }]);
  const t = blocks.find(b => b.type === 'table');
  assert.ok(t, 'table found');
  assert.equal(t.rows.length, 4);
  assert.equal(t.headerRows, 1);
});

test('heading levels never skip and keep same-style headings level', () => {
  const bs = [5, 3, 5, 5, 2, 5].map(l => ({ type: 'h', level: l }));
  normalizeLevels(bs);
  assert.deepEqual(bs.map(b => b.level), [1, 1, 2, 2, 1, 2]);
});

test('title suggestion replaces junk titles; checks flag missing alt text', () => {
  const blocks = [{ id: 1, type: 'h', level: 1, text: 'Summer Programs', page: 0, fileIndex: 0, items: [] }, { id: 2, type: 'figure', alt: '', page: 0, bbox: [0, 0, 1, 1], items: [], fileIndex: 1 }];
  assert.equal(suggestTitle('untitled', blocks), 'Summer Programs');
  assert.equal(suggestTitle('Microsoft Word - draft3.docx', blocks), 'Summer Programs');
  assert.equal(suggestTitle('Council agenda, May 2027', blocks), 'Council agenda, May 2027');
  const checks = buildChecks({ blocks, title: 'Summer Programs', ex: { pages: [], tagged: false } });
  assert.ok(checks.some(c => c.status === 'todo' && /picture needs a description/.test(c.title)));
  const html = toHtml({ blocks: [...blocks, { id: 3, type: 'li', text: '• <one>', items: [] }], lang: 'en', title: 'T', name: 'x.pdf' }, {});
  assert.match(html, /<h1>Summer Programs<\/h1>/);
  assert.match(html, /<li>&lt;one&gt;<\/li>/);
});

test('full pipeline on the sample: tags everything, keeps every glyph in place', { skip: !existsSync(PDFJS) && 'pdf.js not installed' }, async () => {
  const pdfjs = await import(PDFJS);
  const bytes = new Uint8Array(readFileSync(SAMPLE));
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const ex = await extractDocument(pdfjs, doc);
  const { blocks } = analyze(ex.pages);
  blocks.find(b => b.type === 'figure').alt = 'Two canoes on a pond';
  const { bytes: out, report } = await tagPdf(L, bytes, { pages: ex.pages, blocks, title: 'Summer Recreation Programs 2027', lang: 'en-US' });
  assert.equal(report.unmatchedText, 0);
  assert.deepEqual(report.emptyLeaves, []);
  const d2 = await pdfjs.getDocument({ data: out.slice(), verbosity: 0 }).promise;
  assert.equal((await d2.getMetadata()).info.Title, 'Summer Recreation Programs 2027');
  assert.equal((await d2.getMarkInfo()).Marked, true);
  const roles = [];
  for (let n = 1; n <= 2; n++) {
    (function walk(x) { if (x.role) roles.push(x.role); (x.children || []).forEach(walk); })(await (await d2.getPage(n)).getStructTree());
    const a = (await (await doc.getPage(n)).getTextContent()).items.filter(i => i.str.trim()).map(i => `${i.str}@${i.transform.map(v => v.toFixed(2))}`);
    const tc = await (await d2.getPage(n)).getTextContent({ includeMarkedContent: true });
    const b = tc.items.filter(i => i.str && i.str.trim()).map(i => `${i.str}@${i.transform.map(v => v.toFixed(2))}`);
    assert.deepEqual(b.slice().sort(), a.slice().sort(), `page ${n} draws the same text in the same places`);
    let depth = 0, outside = 0;
    for (const it of tc.items) {
      if (it.type && it.type.startsWith('beginMarkedContent')) depth++;
      else if (it.type === 'endMarkedContent') depth--;
      else if (it.str && it.str.trim() && !depth) outside++;
    }
    assert.equal(outside, 0, `page ${n}: no text outside tags`);
  }
  for (const r of ['Document', 'H1', 'H2', 'H3', 'P', 'L', 'LI', 'Lbl', 'LBody', 'Table', 'TR', 'TH', 'TD', 'Figure']) assert.ok(roles.includes(r), r);
  assert.equal(roles.filter(r => r === 'TH').length, 4);
});

test('TJ arrays are split at piece boundaries without moving glyphs', { skip: !existsSync(PDFJS) && 'pdf.js not installed' }, async () => {
  const pdfjs = await import(PDFJS);
  // One TJ holds a section number and a title far apart, like LaTeX output.
  const d = await L.PDFDocument.create();
  const font = await d.embedFont(L.StandardFonts.Helvetica);
  const page = d.addPage([400, 400]);
  page.drawText('x', { x: 10, y: 10, size: 1, font }); // registers the font as /F1-ish resource
  const fontKey = page.node.Resources().lookup(L.PDFName.of('Font')).keys()[0].decodeText();
  const content = `BT /${fontKey} 12 Tf 1 0 0 1 50 300 Tm [(Part one) -12000 (Part two)] TJ ET\nBT /${fontKey} 10 Tf 1 0 0 1 50 200 Tm (Body text here.) Tj ET`;
  page.node.set(L.PDFName.of('Contents'), d.context.register(d.context.flateStream(enc(content))));
  const bytes = await d.save();
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const ex = await extractDocument(pdfjs, doc);
  const items = ex.pages[0].items.filter(i => i.s.trim());
  const one = items.find(i => i.s === 'Part one'), two = items.find(i => i.s === 'Part two'), body = items.find(i => /Body/.test(i.s));
  const blocks = [
    { id: 0, page: 0, type: 'h', level: 1, text: 'Part one', items: [one], bbox: [0, 0, 1, 1] },
    { id: 1, page: 0, type: 'h', level: 1, text: 'Part two', items: [two], bbox: [0, 0, 1, 1] },
    { id: 2, page: 0, type: 'p', text: 'Body text here.', items: [body], bbox: [0, 0, 1, 1] },
  ];
  const { bytes: out, report } = await tagPdf(L, bytes, { pages: ex.pages, blocks, title: 'T', lang: 'en' });
  assert.equal(report.splitOps, 1);
  assert.deepEqual(report.emptyLeaves, []);
  const d2 = await pdfjs.getDocument({ data: out.slice(), verbosity: 0 }).promise;
  const tc = await (await d2.getPage(1)).getTextContent({ includeMarkedContent: true });
  const pos = tc.items.filter(i => i.str && i.str.trim()).map(i => `${i.str}@${i.transform.map(v => v.toFixed(2))}`);
  const before = (await (await doc.getPage(1)).getTextContent()).items.filter(i => i.str.trim()).map(i => `${i.str}@${i.transform.map(v => v.toFixed(2))}`);
  assert.deepEqual(pos.sort(), before.sort());
  const tags = tc.items.filter(i => i.type === 'beginMarkedContentProps').map(i => i.tag);
  assert.deepEqual(tags.filter(t => t === 'H1').length, 2, 'each part gets its own H1 marked content');
});

test('browser-style simple header links and repeated document language do not block reuse', async () => {
  const d = await L.PDFDocument.create();
  d.addPage();
  d.catalog.set(L.PDFName.of('Lang'), L.PDFString.of('en-US'));
  const S = L.PDFString.of;
  const th = (id) => ({ S: 'TH', ID: S(id), A: [{ O: 'Table', Scope: 'Column' }, { O: 'Table', RowSpan: 1 }] });
  const td = (h) => ({ S: 'TD', A: [{ O: 'Table', Headers: [S(h)] }, { O: 'Table', ColSpan: 1 }] });
  const root = d.context.obj({ Type: 'StructTreeRoot', K: { S: 'Document', Lang: S('en'), K: [
    { S: 'Table', K: [{ S: 'TR', K: [th('h1'), th('h2')] }, { S: 'TR', K: [td('h1'), td('h2')] }] },
  ] } });
  d.catalog.set(L.PDFName.of('StructTreeRoot'), d.context.register(root));
  assert.deepEqual(await inspectExistingAttributes(L, await d.save()), []);

  // Header pointing at the wrong column, or a real language change, still blocks reuse.
  const e = await L.PDFDocument.create();
  e.addPage();
  e.catalog.set(L.PDFName.of('Lang'), L.PDFString.of('en-US'));
  const root2 = e.context.obj({ Type: 'StructTreeRoot', K: [
    { S: 'Table', K: [{ S: 'TR', K: [th('h1'), th('h2')] }, { S: 'TR', K: [td('h2'), td('h1')] }] },
    { S: 'P', Lang: S('fr') },
  ] });
  e.catalog.set(L.PDFName.of('StructTreeRoot'), e.context.register(root2));
  const issues = await inspectExistingAttributes(L, await e.save());
  assert.ok(issues.some(i => i.includes('Explicit table')));
  assert.ok(issues.some(i => i.includes('Language changes')));
});

test('print stamps in the margin are furniture and do not set the body size', () => {
  const page = { w: 612, h: 792, images: [], items: [
    item('10/10/26, 6:21 PM', 20, 775, 8, { i: 0 }), item('a.html', 300, 775, 8, { i: 1 }),
    item('file:///tmp/ev/a.html', 20, 15, 8, { i: 2 }), item('1/1', 580, 15, 8, { i: 3 }),
    item('Main title', 40, 700, 24, { i: 4 }), item('Intro paragraph text here, long enough to set the width.', 40, 660, 12, { i: 5 }),
    item('One', 60, 630, 12, { i: 6 }), item('Two', 60, 614, 12, { i: 7 }),
  ] };
  const { blocks, bodySize } = analyze([page]);
  assert.equal(bodySize, 12);
  assert.equal(blocks.filter(b => b.type === 'artifact').length, 4);
  assert.deepEqual(blocks.filter(b => b.type === 'h').map(b => b.text), ['Main title']);
  assert.ok(blocks.some(b => b.text === 'One') && blocks.some(b => b.text === 'Two'), 'short lines broken on purpose stay separate');
  assert.equal(suggestTitle('a.html', blocks), 'Main title');
});
