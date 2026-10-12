// Manual table recovery, original-view isolation, portable drafts and phone picture context.
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const BASE = process.env.EARSHOT_URL || 'http://localhost:8765/builder/earshot/';
const out = path.resolve(process.argv[2] || '/tmp/es24');
fs.mkdirSync(out, { recursive: true });
const pause = ms => new Promise(r => setTimeout(r, ms));
async function download(re) {
  for (let n = 0; n < 100; n++) {
    const f = fs.readdirSync(out).find(n => re.test(n));
    if (f) return path.join(out, f);
    await pause(100);
  }
  throw new Error('Missing download: ' + re);
}
(async () => {
  const L = await import('../../../site/builder/earshot/vendor/pdf-lib.esm.min.js');
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [], sent = [];
  try {
    const print = await browser.newPage();
    await print.setContent('<!doctype html><html lang="en"><head><title>School board agenda</title><style>body{font:16px Arial;margin:40px}table{border-collapse:collapse;width:300px}td,th{border:1px solid;padding:8px;text-align:left}h1{font-size:24px}</style></head><body><h1>School board agenda</h1><p>Review the two department requests below.</p><table><tr><th>Department</th><th>Request</th><th>Decision</th></tr><tr><td>Library</td><td>$8,000</td><td>Pending</td></tr><tr><td>Sports</td><td>$12,000</td><td>Approved</td></tr></table><p>Next meeting is in June.</p></body></html>');
    const raw = await print.pdf({ format: 'A4' }); await print.close();
    const doc = await L.PDFDocument.load(raw);
    doc.catalog.delete(L.PDFName.of('StructTreeRoot')); doc.catalog.delete(L.PDFName.of('MarkInfo'));
    const input = path.join(out, 'agenda.pdf'); fs.writeFileSync(input, await doc.save());
    const p = await browser.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.setRequestInterception(true);
    p.on('request', r => { if (!/^(http:\/\/localhost|data:|blob:)/.test(r.url())) { sent.push(r.url()); r.abort(); } else r.continue(); });
    const cdp = await p.createCDPSession();
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: out });
    await p.setViewport({ width: 1440, height: 1000 });
    await p.goto(BASE); await (await p.$('#file')).uploadFile(input);
    await p.waitForFunction(() => !document.querySelector('#app').hidden && window.Earshot.pageEls[0]?.drawn);
    const before = await p.$eval('#order', e => e.textContent);
    await p.click('.seg [data-mode="after"]');
    assert.equal(await p.evaluate(() => window.Earshot.blocks.filter(b => b.type === 'table').length), 0, 'reproduces a missed small table');
    await p.click('#makeTable'); await p.waitForSelector('.table-stage');
    await p.waitForFunction(() => document.querySelector('.region-choices input')); // rendered (a blank canvas is already 300px wide)
    const region = await p.evaluate(() => {
      const page = window.Earshot.ex.pages[0], c = document.querySelector('.table-stage'), rect = c.getBoundingClientRect();
      const texts = ['Department', 'Request', 'Decision', 'Library', '$8,000', 'Pending', 'Sports', '$12,000', 'Approved'];
      const its = page.items.filter(it => texts.includes(it.s.trim()));
      const x0 = Math.min(...its.map(it => it.x)) - 4, x1 = Math.max(...its.map(it => it.x + it.w)) + 4;
      const y0 = Math.min(...its.map(it => it.y - it.size * .22)) - 4, y1 = Math.max(...its.map(it => it.y + it.size)) + 4;
      return { x0: rect.left + x0 / page.w * rect.width, x1: rect.left + x1 / page.w * rect.width,
        y0: rect.top + (page.h - y1) / page.h * rect.height, y1: rect.top + (page.h - y0) / page.h * rect.height };
    });
    await p.mouse.move(region.x0, region.y0); await p.mouse.down(); await p.mouse.move(region.x1, region.y1, { steps: 10 }); await p.mouse.up();
    await p.waitForSelector('.table-preview table');
    assert.equal(await p.$eval('input[aria-label="Rows"]', e => e.value), '3');
    assert.equal(await p.$eval('input[aria-label="Columns"]', e => e.value), '3');
    assert.match(await p.$eval('.table-preview', e => e.textContent), /Request: \$8,000, Decision: Pending/);
    // Divider controls immediately reassign cell contents, then restore the right division.
    await p.$eval('input[aria-label="Columns divider 1"]', e => { e.value = 95; e.dispatchEvent(new Event('input')); });
    assert.equal(await p.$eval('input[aria-label="Columns"]', e => e.value), '3', 'crossing a divider is rejected');
    await p.$eval('input[aria-label="Columns"]', e => { e.value = 2; e.dispatchEvent(new Event('change')); });
    assert.equal(await p.$$eval('.table-preview tr:first-child th', es => es.length), 2);
    await p.$eval('input[aria-label="Columns"]', e => { e.value = 3; e.dispatchEvent(new Event('change')); });
    await p.$eval('input[aria-label="Rows"]', e => { e.value = 4; e.dispatchEvent(new Event('change')); });
    assert.equal(await p.$$eval('.table-preview tr', es => es.length), 4);
    await p.$eval('input[aria-label="Rows"]', e => { e.value = 3; e.dispatchEvent(new Event('change')); });
    await p.screenshot({ path: path.join(out, 'table-preview.png') });
    await p.click('.table-actions .primary');
    const table = await p.evaluate(() => {
      const b = window.Earshot.blocks.find(b => b.type === 'table');
      return { id: b.id, rows: b.rows.map(r => r.map(c => c.text)) };
    });
    assert.deepEqual(table.rows, [['Department', 'Request', 'Decision'], ['Library', '$8,000', 'Pending'], ['Sports', '$12,000', 'Approved']]);
    await p.click('.seg [data-mode="before"]'); assert.equal(await p.$eval('#order', e => e.textContent), before);
    await p.click('.seg [data-mode="after"]'); await p.click('#undo');
    assert.equal(await p.evaluate(() => window.Earshot.blocks.some(b => b.type === 'table')), false);
    // Exercise the keyboard-friendly alternative and retain row headers in both formats.
    await p.click('#makeTable'); await p.waitForFunction(() => document.querySelector('.region-choices input'));
    await p.$eval('.region-choices details', e => e.open = true);
    await p.$$eval('.region-choices label', labels => labels.forEach(l => { if (/Department|Request|Decision|Library|\$8,000|Pending|Sports|\$12,000|Approved/.test(l.textContent)) l.querySelector('input').click(); }));
    await p.click('.region-choices button');
    await p.$$eval('.table-controls label', labels => labels.find(l => l.textContent === 'First column holds row headers').querySelector('input').click());
    await p.click('.table-actions .primary');
    await p.click('#exportHtml');
    const htmlFile = await download(/accessible\)\.html$/);
    const html = fs.readFileSync(htmlFile, 'utf8');
    assert.match(html, /<th scope="row">Library<\/th><td>\$8,000<\/td><td>Pending<\/td>/);
    await p.click('#exportPdf'); await p.waitForSelector('#result[open]');
    assert.match(await p.$eval('#resultBody', e => e.textContent), /100%/);
    const pdfFile = await download(/tagged\)\.pdf$/);
    if (process.env.VERAPDF) assert.match(execFileSync(process.env.VERAPDF, ['--flavour', 'ua1', '--format', 'text', pdfFile]).toString(), /^PASS/m);
    await p.click('#result button');
    await p.screenshot({ path: path.join(out, 'repaired-agenda.png') });
    // Refresh warns; choosing to stay preserves the reviewed table.
    const dialog = new Promise(resolve => p.once('dialog', async d => { assert.equal(d.type(), 'beforeunload'); await d.dismiss(); resolve(); }));
    await p.evaluate(() => { setTimeout(() => location.reload(), 0); }); await dialog; await pause(200);
    assert.equal(await p.evaluate(() => window.Earshot.blocks.some(b => b.type === 'table')), true);
    await p.click('#saveSession'); const draft = await download(/\.earshot$/);
    const saved = JSON.parse(fs.readFileSync(draft, 'utf8'));
    assert.equal(Buffer.from(saved.pdf, 'base64').equals(fs.readFileSync(input)), true);
    const model = await p.evaluate(() => window.Earshot.blocks.map(b => ({ type: b.type, text: b.text, rows: b.rows?.map(r => r.map(c => c.text)) })));
    await p.reload(); await (await p.$('#sessionFile')).uploadFile(draft);
    await p.waitForFunction(() => !document.querySelector('#app').hidden && window.Earshot.mode === 'after' && window.Earshot.pageEls[0]?.drawn && window.Earshot.blocks.some(b => b.type === 'table'));
    assert.deepEqual(await p.evaluate(() => window.Earshot.blocks.map(b => ({ type: b.type, text: b.text, rows: b.rows?.map(r => r.map(c => c.text)) }))), model);
    assert.equal(await p.evaluate(() => window.Earshot.mode), 'after');
    await p.close();

    const m = await browser.newPage();
    await (await m.createCDPSession()).send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: out });
    m.on('pageerror', e => errors.push(e.message));
    await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await m.goto(BASE + '#sample'); await m.waitForSelector('.ov .badge');
    await m.click('.seg [data-mode="after"]'); await m.click('[data-panel="checks"]');
    await m.click('#checksPanel .chk.s-todo .linkish');
    await m.waitForFunction(() => document.querySelector('.figure-preview')?.naturalWidth > 0);
    const context = await m.$eval('.figure-preview', e => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }));
    assert.ok(context.w > 200 && context.h > 70, JSON.stringify(context));
    await m.$eval('.figure-preview', e => e.scrollIntoView({ block: 'center' }));
    assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await m.screenshot({ path: path.join(out, 'phone-picture.png') });
    await m.type('.item.sel textarea', 'Two canoes on the water');
    await m.evaluate(() => { if (innerWidth < 900 && !document.querySelector('#app').classList.contains('tools-open')) document.querySelector('#moreTools').click(); }); // phone: secondary tools sit behind More
    await m.click('#saveSession');
    const sampleDraft = await download(/^Millbrook.*\.earshot$/);
    await m.reload(); await (await m.$('#sessionFile')).uploadFile(sampleDraft);
    await m.waitForFunction(() => !document.querySelector('#app').hidden && window.Earshot.mode === 'after' && window.Earshot.pageEls[0]?.drawn && window.Earshot.blocks.some(b => b.alt === 'Two canoes on the water'));
    await m.click('#moreTools');
    await m.click('#makeTable'); await m.waitForFunction(() => document.querySelector('.region-choices input'));
    assert.equal(await m.evaluate(() => document.querySelector('.table-dialog').scrollWidth > document.querySelector('.table-dialog').clientWidth), false);
    await m.screenshot({ path: path.join(out, 'phone-table-tool.png') });
    await m.close();
    assert.deepEqual(errors, []); assert.deepEqual(sent, []);
    console.log('session 24 browser: table repair/export/undo, private draft restore, refresh warning and phone context pass');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
