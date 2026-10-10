// Runs Earshot's pipeline (extract → analyze → tag → re-read) on PDFs in a folder
// and reports structure, coverage and timing. Optional PDF/UA-1 check with veraPDF.
// Usage: node check-earshot-pdfs.mjs <pdf dir> [path/to/verapdf]
// Needs pdfjs-dist installed in /tmp/lib (npm install --prefix /tmp/lib pdfjs-dist@5).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import * as L from '../../../site/builder/earshot/vendor/pdf-lib.esm.min.js';
import { extractDocument } from '../../../site/builder/earshot/extract.js';
import { analyze } from '../../../site/builder/earshot/analyze.js';
import { tagPdf } from '../../../site/builder/earshot/tagger.js';

const pdfjs = await import(process.env.PDFJS || '/tmp/lib/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const dir = process.argv[2];
const vera = process.argv[3];
const outDir = path.join(dir, 'tagged');
mkdirSync(outDir, { recursive: true });
const rows = [];
for (const f of readdirSync(dir).filter(n => n.endsWith('.pdf')).sort()) {
  const row = { file: f };
  try {
    const bytes = new Uint8Array(readFileSync(path.join(dir, f)));
    const t0 = Date.now();
    const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
    const ex = await extractDocument(pdfjs, doc);
    const { blocks } = analyze(ex.pages);
    row.pages = ex.pages.length;
    row.taggedBefore = ex.tagged;
    row.analyzeMs = Date.now() - t0;
    const c = t => blocks.filter(b => b.type === t).length;
    row.blocks = { h: c('h'), p: c('p'), li: c('li'), table: c('table'), figure: c('figure'), artifact: c('artifact') };
    row.firstHeadings = blocks.filter(b => b.type === 'h').slice(0, 5).map(b => `H${b.level} ${b.text.slice(0, 40)}`);
    for (const b of blocks) if (b.type === 'figure') b.alt = 'Test description';
    const t1 = Date.now();
    const { bytes: out, report } = await tagPdf(L, bytes, { pages: ex.pages, blocks, title: ex.title || 'Test title', lang: 'en-US' });
    row.tagMs = Date.now() - t1;
    row.report = { mcids: report.mcids, unmatchedText: report.unmatchedText, emptyLeaves: report.emptyLeaves.length, links: report.links, formsWithText: report.formsWithText, unembedded: [...new Set(report.unembeddedFonts)].length, strippedTags: report.strippedTags };
    const outPath = path.join(outDir, f);
    writeFileSync(outPath, out);
    // Coverage: every visible text item inside marked content?
    const d2 = await pdfjs.getDocument({ data: out.slice(), verbosity: 0 }).promise;
    let inside = 0, outside = 0, realChars = 0, artChars = 0;
    const alnum = s => (s.match(/[\p{L}\p{N}]/gu) || []).length;
    let moved = 0;
    const sig = items => items.filter(i => i.str && i.str.trim()).map(i => `${i.str}@${i.transform.map(v => v.toFixed(1))}`).sort();
    for (let n = 1; n <= d2.numPages; n++) {
      const tc = await (await d2.getPage(n)).getTextContent({ includeMarkedContent: true });
      const a = sig((await (await doc.getPage(n)).getTextContent()).items), b = sig(tc.items);
      const setB = new Set(b);
      moved += a.filter(x => !setB.has(x)).length + Math.abs(a.length - b.length);
      const stack = [];
      for (const it of tc.items) {
        if (it.type === 'beginMarkedContent' || it.type === 'beginMarkedContentProps') stack.push(it.tag);
        else if (it.type === 'endMarkedContent') stack.pop();
        else if (it.str && it.str.trim()) {
          if (stack.length) inside++; else outside++;
          if (stack.includes('Artifact')) artChars += alnum(it.str); else if (stack.length) realChars += alnum(it.str);
        }
      }
    }
    const expectedArt = blocks.filter(b => b.type === 'artifact').reduce((k, b) => k + alnum(b.text || ''), 0);
    const expectedReal = blocks.filter(b => b.type !== 'artifact').reduce((k, b) => k + alnum(b.text || '') + (b.rows ? b.rows.flat().reduce((m, c) => m + alnum(c.text), 0) - alnum(b.text) : 0), 0);
    row.coverage = `${inside}/${inside + outside}`;
    row.textMoved = moved;
    row.realText = `${realChars} tagged / ${expectedReal} expected; artifact ${artChars} vs ${expectedArt} expected`;
    if (vera) {
      for (const [label, file] of [['before', path.join(dir, f)], ['after', outPath]]) {
        let txt = '';
        try { txt = execFileSync(vera, ['--flavour', 'ua1', '--format', 'xml', file], { maxBuffer: 1 << 28 }).toString(); } catch (e) { txt = String(e.stdout || ''); }
        const failed = [...txt.matchAll(/clause="([^"]+)" testNumber="(\d+)" status="failed" failedChecks="(\d+)"/g)].map(m => `${m[1]}-${m[2]}×${m[3]}`);
        row['vera_' + label] = /isCompliant="true"/.test(txt) ? 'PASS' : failed.join(' ') || 'error';
      }
    }
  } catch (e) {
    row.error = String(e && e.stack || e).split('\n').slice(0, 3).join(' | ');
  }
  rows.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(path.join(dir, 'earshot-report.json'), JSON.stringify(rows, null, 1));
