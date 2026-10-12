// Wrap-up: missed wrapped table review, unchanged originals, repair/export/restore.
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const BASE = process.env.EARSHOT_URL || 'http://localhost:8765/builder/earshot/';
const out = path.resolve(process.argv[2] || '/tmp/es26');
fs.mkdirSync(out, { recursive: true });
const pause = ms => new Promise(r => setTimeout(r, ms));
async function download(re) {
  for (let i = 0; i < 100; i++) {
    const f = fs.readdirSync(out).find(f => re.test(f));
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
    await print.setContent('<!doctype html><html lang="en"><head><title>Community workshops</title><style>body{font:16px Arial;margin:40px}table{border-collapse:collapse;width:330px;table-layout:fixed}td,th{border:1px solid;padding:8px;text-align:left;vertical-align:top}th:first-child{width:160px}h1{font-size:24px}</style></head><body><h1>Community workshops</h1><p>Book a place at the library.</p><table><tr><th>Workshop</th><th>When</th><th>Cost</th></tr><tr><td>Digital confidence skills for older adults</td><td>Monday</td><td>$10</td></tr><tr><td>Cooking affordable meals for a family</td><td>Tuesday</td><td>Free</td></tr><tr><td>Bike repairs</td><td>Friday</td><td>$5</td></tr></table><p>Next meeting is in June.</p></body></html>');
    const doc = await L.PDFDocument.load(await print.pdf({ format: 'A4' }));
    await print.close();
    doc.catalog.delete(L.PDFName.of('StructTreeRoot')); doc.catalog.delete(L.PDFName.of('MarkInfo'));
    const input = path.join(out, 'wrapped-table.pdf'); fs.writeFileSync(input, await doc.save());
    const p = await browser.newPage();
    p.on('dialog', d => d.accept());
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.setRequestInterception(true);
    p.on('request', r => { if (!/^(http:\/\/localhost|data:|blob:)/.test(r.url())) { sent.push(r.url()); r.abort(); } else r.continue(); });
    await (await p.createCDPSession()).send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: out });
    await p.setViewport({ width: 1440, height: 1000 });
    await p.goto(BASE); await (await p.$('#file')).uploadFile(input);
    await p.waitForFunction(() => !document.querySelector('#app').hidden && window.Earshot.pageEls[0]?.drawn);
    const before = await p.$eval('#order', e => e.textContent);
    await p.click('.seg [data-mode="after"]');
    assert.equal(await p.evaluate(() => window.Earshot.blocks.some(b => b.type === 'table')), false);
    assert.equal(await p.$eval('#banner', e => e.classList.contains('ok')), false);
    await p.click('#tabChecks');
    const task = await p.$$eval('.chk', es => es.find(e => /^Aligned text/.test(e.querySelector('strong').textContent))?.textContent);
    assert.match(task || '', /wrong headings/);
    await p.screenshot({ path: path.join(out, 'wrapped-review.png') });
    await p.$$eval('.chk .linkish', es => es.find(e => e.textContent === 'Review possible table').click());
    await p.waitForSelector('.table-preview table');
    assert.ok(Number(await p.$eval('input[aria-label="Rows"]', e => e.value)) > 4, 'wrapped baselines need row adjustment');
    assert.equal(await p.$eval('input[aria-label="Columns"]', e => e.value), '3');
    await p.$eval('input[aria-label="Rows"]', e => { e.value = 4; e.dispatchEvent(new Event('change')); });
    // Use the gaps between actual rows, independently of the initial guess.
    const dividers = await p.evaluate(() => {
      const page = window.Earshot.ex.pages[0];
      const get = s => page.items.find(it => it.s.trim() === s);
      const rows = ['Workshop', 'Monday', 'Tuesday', 'Friday'].map(s => get(s));
      const bottom = Math.min(...page.items.filter(it => /Bike repairs|Friday|\$5/.test(it.s)).map(it => it.y - .22 * it.size)) - 2;
      const top = Math.max(...page.items.filter(it => /Workshop|When|Cost/.test(it.s)).map(it => it.y + .9 * it.size)) + 2;
      const gaps = [
        (rows[0].y - rows[0].size * .22 + rows[1].y + rows[1].size * .9) / 2,
        (get('skills for older adults').y - rows[1].size * .22 + rows[2].y + rows[2].size * .9) / 2,
        (get('meals for a family').y - rows[2].size * .22 + rows[3].y + rows[3].size * .9) / 2,
      ];
      return gaps.map(y => (top - y) / (top - bottom) * 100);
    });
    await p.$$eval('.table-controls details', es => es.forEach(e => e.open = true));
    for (let i = 0; i < 3; i++) await p.$eval(`input[aria-label="Rows divider ${i + 1}"]`, (e, pct) => { e.value = pct; e.dispatchEvent(new Event('input')); }, dividers[i]);
    assert.match(await p.$eval('.table-preview', e => e.textContent), /Workshop: Digital confidence skills for older adults, When: Monday, Cost: \$10/);
    await p.screenshot({ path: path.join(out, 'wrapped-preview.png') });
    await p.click('.table-actions .primary');
    const expected = [['Workshop', 'When', 'Cost'], ['Digital confidence skills for older adults', 'Monday', '$10'], ['Cooking affordable meals for a family', 'Tuesday', 'Free'], ['Bike repairs', 'Friday', '$5']];
    assert.deepEqual(await p.evaluate(() => window.Earshot.blocks.find(b => b.type === 'table').rows.map(r => r.map(c => c.text))), expected);
    await p.click('.seg [data-mode="before"]'); assert.equal(await p.$eval('#order', e => e.textContent), before);
    await p.click('.seg [data-mode="after"]'); await p.click('#tabChecks');
    assert.equal(await p.$$eval('.chk', es => es.some(e => /^Aligned text/.test(e.querySelector('strong').textContent))), false);
    assert.equal(await p.$eval('#checkCount', e => e.textContent), 'Review', 'no overall success checkmark after repair');
    assert.match(await p.$eval('#banner', e => e.textContent), /structure still needs your review/);
    await p.click('#exportHtml'); const html = fs.readFileSync(await download(/\.html$/), 'utf8');
    assert.match(html, /<td>Digital confidence skills for older adults<\/td><td>Monday<\/td><td>\$10<\/td>/);
    await p.click('#exportPdf'); await p.waitForSelector('#result[open]');
    const tagged = await download(/tagged\)\.pdf$/);
    if (process.env.VERAPDF) assert.match(execFileSync(process.env.VERAPDF, ['--flavour', 'ua1', '--format', 'text', tagged]).toString(), /^PASS/m);
    await p.click('#result button'); await p.click('#saveSession');
    const draft = await download(/\.earshot$/);
    await p.click('#undo'); await p.click('#tabChecks');
    assert.equal(await p.evaluate(() => window.Earshot.blocks.some(b => b.type === 'table')), false);
    assert.equal(await p.$$eval('.chk', es => es.some(e => /^Aligned text/.test(e.querySelector('strong').textContent))), true, 'Undo restores the review task');
    await p.reload(); await (await p.$('#sessionFile')).uploadFile(draft);
    await p.waitForFunction(() => window.Earshot.blocks.some(b => b.type === 'table') && !document.querySelector('#app').hidden);
    assert.deepEqual(await p.evaluate(() => window.Earshot.blocks.find(b => b.type === 'table').rows.map(r => r.map(c => c.text))), expected);
    await p.close();
    const m = await browser.newPage();
    m.on('pageerror', e => errors.push(e.message));
    await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await m.goto(BASE); await (await m.$('#file')).uploadFile(input);
    await m.waitForFunction(() => !document.querySelector('#app').hidden && window.Earshot.pageEls[0]?.drawn);
    await m.click('.seg [data-mode="after"]'); await m.click('[data-panel="checks"]');
    await m.$$eval('.chk .linkish', es => es.find(e => e.textContent === 'Review possible table').click());
    await m.waitForSelector('.table-preview table');
    assert.equal(await m.evaluate(() => document.querySelector('.table-dialog').scrollWidth > document.querySelector('.table-dialog').clientWidth), false);
    await m.screenshot({ path: path.join(out, 'phone-wrapped-review.png') });
    assert.deepEqual(errors, []); assert.deepEqual(sent, []);
    console.log(JSON.stringify({ output: out, errors, externalRequests: sent, tagged: !!process.env.VERAPDF }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
