// Existing-tag reuse, original-view isolation, rotated pages and safe fallback.
// Server: python3 -m http.server 8765 --directory site
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../../..');
const BASE = process.env.EARSHOT_URL || 'http://localhost:8765/builder/earshot/';
const out = path.resolve(process.argv[2] || '/tmp/earshot-existing-browser');
fs.mkdirSync(out, { recursive: true });
const pause = ms => new Promise(r => setTimeout(r, ms));
const mod = name => import(pathToFileURL(path.join(ROOT, 'site/builder/earshot', name)));
async function waitFile(name) {
  const file = path.join(out, name);
  for (let n = 0; n < 100; n++) { if (fs.existsSync(file)) return file; await pause(100); }
  throw new Error('No download: ' + name);
}
const signature = bs => JSON.parse(JSON.stringify(bs.filter(b => b.type !== 'artifact').map(b => ({ type: b.type, level: b.level, text: b.text, alt: b.alt, headerRows: b.headerRows, rows: b.rows?.map(r => r.map(c => c.text)) }))));
(async () => {
  const pdfjs = await import('/tmp/lib/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  const L = await mod('vendor/pdf-lib.esm.min.js');
  const { extractDocument } = await mod('extract.js');
  const { analyze } = await mod('analyze.js');
  const { tagPdf } = await mod('tagger.js');
  const { existingStructure } = await mod('existing.js');
  const sample = new Uint8Array(fs.readFileSync(path.join(ROOT, 'site/builder/earshot/sample.pdf')));
  const doc = await pdfjs.getDocument({ data: sample.slice(), verbosity: 0 }).promise;
  const ex = await extractDocument(pdfjs, doc);
  const { blocks } = analyze(ex.pages);
  blocks.find(b => b.type === 'figure').alt = 'Original author: two canoes on a green pond';
  blocks.find(b => b.type === 'h').level = 2;
  [blocks[1], blocks[2]] = [blocks[2], blocks[1]];
  const { bytes: tagged } = await tagPdf(L, sample, { pages: ex.pages, blocks, title: 'Author title', lang: 'en-US' });
  const input = path.join(out, 'original-tagged.pdf'); fs.writeFileSync(input, tagged);
  const unsafe = await L.PDFDocument.load(tagged);
  const findTH = v => {
    v = unsafe.context.lookup(v);
    if (v instanceof L.PDFArray) { for (const child of v.asArray()) { const hit = findTH(child); if (hit) return hit; } }
    if (v instanceof L.PDFDict) {
      if (v.lookup(L.PDFName.of('S'))?.decodeText?.() === 'TH') return v;
      return findTH(v.lookup(L.PDFName.of('K')));
    }
  };
  findTH(unsafe.catalog.lookup(L.PDFName.of('StructTreeRoot'))).set(L.PDFName.of('A'), unsafe.context.obj({ O: 'Table', Scope: 'Row', ColSpan: 2 }));
  const unsafeFile = path.join(out, 'merged-cells.pdf'); fs.writeFileSync(unsafeFile, await unsafe.save());

  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const p = await browser.newPage(), errors = [], sent = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', r => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) { sent.push(r.url()); r.abort(); } else r.continue(); });
    const cdp = await p.createCDPSession();
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: out });
    await p.setViewport({ width: 1440, height: 1000 });
    const upload = async file => {
      await p.goto(BASE);
      await (await p.$('#file')).uploadFile(file);
      await p.waitForFunction(() => !document.querySelector('#app').hidden && window.Earshot.pageEls[0]?.drawn);
      await pause(200);
    };
    await upload(input);
    const originalList = await p.$eval('#order', el => el.textContent);
    assert.match(originalList, /Heading 2/);
    assert.match(originalList, /Original author: two canoes/);
    assert.match(await p.$eval('#banner', el => el.textContent), /already has tags.*order its tags give/);
    await p.screenshot({ path: path.join(out, 'existing-before.png') });

    // Mock only the voice transport: assert the actual queued original roles/order.
    await p.evaluate(() => {
      window.utterances = [];
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel() {}, speak(u) { window.utterances.push(u.text); setTimeout(() => u.onend(), 0); } } });
    });
    await p.click('#listen');
    await p.waitForFunction(() => !window.Earshot.speaking);
    await pause(500); // allow the final speech highlight's smooth scroll to settle
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const speech = await p.evaluate(() => window.utterances);
    assert.match(speech[0], /^Heading level 2/);
    assert.ok(speech.some(t => /Graphic. Original author/.test(t)));
    assert.ok(speech.some(t => /Program:|Ages:/.test(t)), 'original table headers are spoken');
    assert.ok(!speech.some(t => /Published May|Page 1 of 2/.test(t)), 'original artifacts are skipped');

    // Source selection and all edits are undoable. The original view stays fixed.
    // Safe original tags are the default starting point, not layout guesses.
    await p.click('.seg [data-mode="after"]');
    assert.equal(await p.evaluate(() => window.Earshot.source), 'existing');
    assert.equal(await p.evaluate(() => window.Earshot.blocks[0].level), 2);
    assert.match(await p.$eval('#banner', el => el.textContent), /Starting from this PDF’s own tags/);
    const reused = await p.evaluate(() => window.Earshot.blocks.map(b => b.type + ':' + b.text));
    await p.click('#banner .source-actions button:first-child');
    assert.equal(await p.evaluate(() => window.Earshot.source), 'layout');
    assert.equal(await p.evaluate(() => window.Earshot.blocks[0].level), 1, 'layout guesses normalize to H1');
    await p.click('#undo');
    assert.equal(await p.evaluate(() => window.Earshot.source), 'existing');
    assert.deepEqual(await p.evaluate(() => window.Earshot.blocks.map(b => b.type + ':' + b.text)), reused);
    await p.click('#order .item[data-id="0"]');
    await p.keyboard.press('1');
    assert.equal(await p.evaluate(() => window.Earshot.blocks[0].level), 1);
    await p.click('.seg [data-mode="before"]');
    assert.equal(await p.$eval('#order', el => el.textContent), originalList, 'edits must not rewrite before');
    const savedOriginal = path.join(out, 'original-tagged.pdf');
    fs.unlinkSync(savedOriginal); // fixture is now in browser memory; expect a new download
    await p.click('#banner .source-actions button.ghost');
    assert.deepEqual(new Uint8Array(fs.readFileSync(await waitFile('original-tagged.pdf'))), tagged, 'Keep original is byte identical');

    await p.click('.seg [data-mode="after"]');
    const expected = await p.evaluate(() => window.Earshot.blocks.filter(b => b.type !== 'artifact').map(b => ({ type: b.type, level: b.level, text: b.text, alt: b.alt, headerRows: b.headerRows, rows: b.rows?.map(r => r.map(c => c.text)) })));
    fs.rmSync(path.join(out, 'original-tagged (tagged).pdf'), { force: true });
    await p.click('#exportPdf');
    await p.waitForSelector('#result[open]');
    assert.match(await p.$eval('#resultBody', el => el.textContent), /Saved your tagged PDF/);
    const exported = await waitFile('original-tagged (tagged).pdf');
    if (process.env.VERAPDF) assert.match(execFileSync(process.env.VERAPDF, ['--flavour', 'ua1', '--format', 'text', exported]).toString(), /^PASS/m);
    const output = new Uint8Array(fs.readFileSync(exported));
    const outputDoc = await pdfjs.getDocument({ data: output.slice(), verbosity: 0 }).promise;
    assert.deepEqual(signature(existingStructure((await extractDocument(pdfjs, outputDoc)).pages).blocks), expected);
    await p.screenshot({ path: path.join(out, 'existing-export.png') });
    await p.click('#result button');
    // Render both real PDFs in the browser and compare all pixels.
    const differingPixels = await p.evaluate(async ({ a, b }) => {
      const lib = await import('./vendor/pdf.min.mjs');
      const da = await lib.getDocument({ data: new Uint8Array(a) }).promise;
      const db = await lib.getDocument({ data: new Uint8Array(b) }).promise;
      const render = async (d, n) => {
        const pg = await d.getPage(n), vp = pg.getViewport({ scale: 1 });
        const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
        await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      };
      const diffs = [];
      for (let n = 1; n <= da.numPages; n++) {
        const aa = await render(da, n), bb = await render(db, n); let diff = 0;
        for (let i = 0; i < aa.length; i += 4) if (aa[i] !== bb[i] || aa[i + 1] !== bb[i + 1] || aa[i + 2] !== bb[i + 2]) diff++;
        diffs.push(diff);
      }
      await da.destroy(); await db.destroy(); return diffs;
    }, { a: [...tagged], b: [...output] });
    assert.deepEqual(differingPixels, [0, 0], 'reuse/export must not change page appearance');

    await upload(unsafeFile);
    await p.click('.seg [data-mode="after"]');
    assert.equal(await p.evaluate(() => window.Earshot.source), 'layout', 'unsafe tags fall back to layout');
    assert.match(await p.$eval('#banner .source-actions', el => el.textContent), /^Keep original PDF/, 'no reuse button offered');
    await p.click('#tabChecks');
    assert.match(await p.$eval('#checksPanel', el => el.textContent), /Merged table cells/);
    assert.match(await p.$eval('#checksPanel', el => el.textContent), /Row or combined table headers/);

    // Rotation plus a nonzero CropBox. Both overlays and figure crops use the viewport.
    for (const angle of [90, 180, 270]) {
      const rotated = await L.PDFDocument.load(sample);
      for (const page of rotated.getPages()) { page.setRotation(L.degrees(angle)); page.setCropBox(10, 10, 592, 772); }
      const fixture = path.join(out, `rotated-${angle}.pdf`); fs.writeFileSync(fixture, await rotated.save());
      await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await upload(fixture);
      await p.click('.seg [data-mode="after"]');
      const checks = await p.evaluate(() => {
        const S = window.Earshot, p = S.ex.pages[0], pe = S.pageEls[0];
        const b = S.blocks.find(b => b.page === 0 && b.type === 'h');
        const v = pe.viewport.convertToViewportRectangle([b.bbox[0] + p.ox, b.bbox[1] + p.oy, b.bbox[2] + p.ox, b.bbox[3] + p.oy]);
        const ov = document.querySelector(`.ov[data-id="${b.id}"]`);
        return { overflow: document.documentElement.scrollWidth - innerWidth, aspect: pe.wrap.clientWidth / pe.wrap.clientHeight, expectedAspect: pe.canvas.width / pe.canvas.height, x: parseFloat(ov.style.left), y: parseFloat(ov.style.top), ex: Math.min(v[0], v[2]) - 2, ey: Math.min(v[1], v[3]) - 2 };
      });
      assert.ok(checks.overflow <= 1, 'phone overflow at rotation ' + angle);
      assert.ok(Math.abs(checks.aspect - checks.expectedAspect) < .01, 'rotated page is not stretched');
      assert.ok(Math.abs(checks.x - checks.ex) < .01 && Math.abs(checks.y - checks.ey) < .01, 'heading overlay matches rotated crop');
      await p.screenshot({ path: path.join(out, `phone-rotation-${angle}.png`) });
      const htmlName = `rotated-${angle} (accessible).html`;
      fs.rmSync(path.join(out, htmlName), { force: true });
      await p.click('#exportHtml');
      const html = fs.readFileSync(await waitFile(htmlName), 'utf8');
      const crop = html.match(/src="(data:image\/jpeg;base64,[^"]+)"/)[1];
      const dims = await p.evaluate(async src => { const im = new Image(); im.src = src; await im.decode(); return [im.width, im.height]; }, crop);
      assert.deepEqual(dims, angle === 180 ? [504, 280] : [280, 504], 'figure crop follows rotation');
    }
    // Original untagged content is frozen after editing as well.
    await p.setViewport({ width: 1440, height: 1000 });
    await p.goto(BASE + '#sample');
    await p.waitForSelector('.ov .badge');
    const beforeUnt = await p.$eval('#order', el => el.textContent);
    await p.click('.seg [data-mode="after"]');
    const tableId = await p.evaluate(() => window.Earshot.blocks.find(b => b.type === 'table').id);
    await p.click(`#order .item[data-id="${tableId}"]`);
    await p.evaluate(() => [...document.querySelectorAll('.item.sel button')].find(b => b.textContent.startsWith('Not a table')).click());
    await p.click('.seg [data-mode="before"]');
    assert.equal(await p.$eval('#order', el => el.textContent), beforeUnt);
    // A former table's original overlay finds a surviving row after splitting.
    await p.evaluate(id => document.querySelector(`.ov[data-id="${id}"]`).click(), tableId);
    assert.equal(await p.evaluate(() => window.Earshot.mode), 'after');
    assert.equal(await p.evaluate(() => window.Earshot.blocks.find(b => b.id === window.Earshot.sel).type), 'p');
    assert.deepEqual(errors, []);
    assert.deepEqual(sent, []);
    console.log('existing browser: all checks passed', JSON.stringify({ differingPixels, speech: speech.length, rotations: [90, 180, 270] }));
  } finally { await browser.close(); await doc.destroy(); }
})().catch(e => { console.error(e); process.exit(1); });
