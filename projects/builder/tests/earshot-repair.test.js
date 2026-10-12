import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { analyze, spoken } from '../../../site/builder/earshot/analyze.js';
import { regionTable, replaceWithTable } from '../../../site/builder/earshot/table.js';
import { sessionModel, restoreModel, encodeSession, decodeSession } from '../../../site/builder/earshot/session.js';
import { toHtml } from '../../../site/builder/earshot/html.js';
import { extractDocument } from '../../../site/builder/earshot/extract.js';
import { tagPdf } from '../../../site/builder/earshot/tagger.js';
import { buildChecks } from '../../../site/builder/earshot/checks.js';
import * as L from '../../../site/builder/earshot/vendor/pdf-lib.esm.min.js';

const makePage = () => {
  let i = 0;
  const items = [['Department', 'Request', 'Decision'], ['Library', '$8,000', 'Pending'], ['Sports', '$12,000', 'Approved']]
    .flatMap((r, ri) => r.map((s, ci) => ({ s, x: 40 + ci * 140, y: 600 - ri * 34, w: s.length * 6, size: 12, font: 'Body', bold: !ri, i: i++ })));
  items.push({ s: 'Outside table', x: 40, y: 680, w: 90, size: 12, font: 'Body', i: i++ });
  return { n: 0, w: 600, h: 800, ox: 0, oy: 0, items, images: [] };
};

test('missed wrapped cells prompt review without changing tags; repaired tables clear the warning', () => {
  let i = 0;
  const p = { n: 0, w: 600, h: 800, images: [], items: [] };
  const row = (texts, y, bold = false) => texts.forEach((s, col) => p.items.push({
    s, x: [40, 215, 340][col], y, w: s.length * 6, size: 12, font: 'Body', bold, i: i++ }));
  row(['Workshop', 'When', 'Cost'], 600, true);
  row(['Digital confidence', 'Monday', '$10'], 558);
  row(['skills for older adults'], 544);
  row(['Cooking affordable', 'Tuesday', 'Free'], 512);
  row(['meals for a family'], 498);
  row(['Bike repairs', 'Friday', '$5'], 466);
  row(['Next meeting is in June.'], 428);
  const blocks = analyze([p]).blocks, unchanged = JSON.stringify(blocks);
  assert.equal(blocks.filter(b => b.type === 'table').length, 0, 'the automatic suggestion still misses wrapped rows');
  const S = { blocks, title: 'Workshops', bodySize: 12, ex: { pages: [p] } };
  const check = buildChecks(S).find(c => c.tableRegion);
  assert.equal(check.status, 'todo');
  assert.equal(check.tableRegion.page, 0);
  assert.ok(check.tableRegion.box[1] > 428, 'region excludes following prose');
  assert.equal(JSON.stringify(blocks), unchanged, 'review check never retags content');
  const table = regionTable(p, check.tableRegion.box, [200, 325], [580, 530, 482]);
  assert.deepEqual(table.rows.map(r => r.map(c => c.text)), [
    ['Workshop', 'When', 'Cost'], ['Digital confidence skills for older adults', 'Monday', '$10'],
    ['Cooking affordable meals for a family', 'Tuesday', 'Free'], ['Bike repairs', 'Friday', '$5']]);
  S.blocks = replaceWithTable(blocks, table).blocks;
  assert.equal(buildChecks(S).some(c => c.tableRegion), false);
  assert.ok(buildChecks(S).some(c => /Structure still needs your review/.test(c.title)));
  assert.deepEqual(S.blocks.flatMap(b => b.items.map(it => it.i)).sort((a, b) => a - b), p.items.map(it => it.i));
});
test('manual table repair preserves every source run and residual prose, and can be restored', () => {
  const p = makePage();
  const before = analyze([p]).blocks;
  const original = JSON.stringify(before);
  const table = regionTable(p, [35, 520, 450, 615], [170, 310], [585, 550], { headerRows: 1, headerCols: 1 });
  // Deliberately merged guess crosses the selected region.
  const merged = { ...before[0], id: 101, type: 'p', items: p.items, text: 'Badly merged prose' };
  const repaired = replaceWithTable([merged], table).blocks;
  assert.equal(repaired.length, 2);
  assert.equal(repaired[1].text, 'Outside table');
  assert.equal(JSON.stringify(before), original, 'original model is untouched');
  assert.deepEqual(repaired.flatMap(b => b.items.map(it => it.i)).sort((a, b) => a - b), p.items.map(it => it.i));
  assert.match(spoken(table), /Row Library.*Request: \$8,000, Decision: Pending/);
  const S = { name: 'agenda.pdf', bytes: new Uint8Array([1, 2, 3]), blocks: repaired, title: 'Agenda', lang: 'en', source: 'layout' };
  const html = toHtml(S);
  assert.match(html, /<th scope="col">Request<\/th>/);
  assert.match(html, /<th scope="row">Library<\/th><td>\$8,000<\/td><td>Pending<\/td>/);
  const saved = decodeSession(encodeSession(S));
  assert.deepEqual(saved.bytes, S.bytes);
  const restored = restoreModel(saved.model, [p]);
  assert.equal(restored.blocks[0].rows[1][1].items[0], p.items[4], 'restore uses original item identity');
  assert.equal(toHtml({ ...S, ...restored }), html);
  const invalid = sessionModel(S);
  invalid.blocks[1].items = [0];
  assert.throws(() => restoreModel(invalid, [p]), /invalid or duplicate/);
  const lost = sessionModel(S); lost.blocks.pop();
  assert.throws(() => restoreModel(lost, [p]), /invalid or duplicate/);
});

test('manual table writes row/column scopes and genuine empty cells without dropping text', { skip: !existsSync('/tmp/lib/node_modules/pdfjs-dist/legacy/build/pdf.mjs') && 'pdf.js not installed' }, async () => {
  const pdfjs = await import('/tmp/lib/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await L.PDFDocument.create();
  const font = await doc.embedFont(L.StandardFonts.Helvetica);
  const p = doc.addPage([600, 800]);
  const fixture = makePage();
  for (const it of fixture.items.filter(it => it.s !== 'Approved')) p.drawText(it.s, { x: it.x, y: it.y, size: it.size, font });
  const bytes = await doc.save();
  const source = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const ex = await extractDocument(pdfjs, source);
  const before = analyze(ex.pages).blocks;
  const table = regionTable(ex.pages[0], [35, 520, 450, 615], [170, 310], [585, 550], { headerRows: 1, headerCols: 1 });
  const blocks = replaceWithTable(before, table).blocks;
  const tagged = await tagPdf(L, bytes, { pages: ex.pages, blocks, title: 'Agenda', lang: 'en' });
  assert.deepEqual(tagged.report.emptyLeaves, []);
  assert.equal(tagged.report.unmatchedText, 0);
  const out = await pdfjs.getDocument({ data: tagged.bytes.slice(), verbosity: 0 }).promise;
  const tree = await (await out.getPage(1)).getStructTree();
  const roles = [];
  (function walk(n) { if (n.role) roles.push(n.role); (n.children || []).forEach(walk); })(tree);
  assert.equal(roles.filter(r => r === 'TH').length, 5);
  assert.equal(roles.filter(r => r === 'TD').length, 4);
  const raw = await L.PDFDocument.load(tagged.bytes);
  const scopes = [];
  for (const [, value] of raw.context.enumerateIndirectObjects()) if (value instanceof L.PDFDict) {
    const attr = value.lookupMaybe(L.PDFName.of('A'), L.PDFDict);
    const scope = attr?.get(L.PDFName.of('Scope'));
    if (scope) scopes.push(scope.toString());
  }
  assert.deepEqual(scopes.sort(), ['/Both', '/Column', '/Column', '/Row', '/Row'].sort());
  await Promise.all([source.destroy(), out.destroy()]);
});
