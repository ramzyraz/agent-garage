// Earshot end-to-end: open the sample, compare before/after, fix things,
// export a tagged PDF and an HTML version, on desktop and phone.
// Usage: node earshot-browser.cjs [outdir]   (server: python3 -m http.server 8765 --directory site)
// Set VERAPDF=/path/to/verapdf to also validate the exported PDF against PDF/UA-1.
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const assert = require('node:assert/strict');
const { mkdirSync, readdirSync, rmSync, readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const BASE = process.env.EARSHOT_URL || 'http://localhost:8765/builder/earshot/';
const out = path.resolve(process.argv[2] || '/tmp/earshot-browser');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const waitFile = async (re, ms = 15000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const f = readdirSync(out).find(n => re.test(n) && !n.endsWith('.crdownload'));
    if (f) return path.join(out, f);
    await wait(200);
  }
  throw new Error('download did not appear: ' + re);
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const p = await browser.newPage(), errors = [], sent = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.setRequestInterception(true);
    p.on('request', r => { if (!r.url().startsWith('http://localhost')) { sent.push(r.url()); r.abort(); } else r.continue(); });
    const cdp = await p.createCDPSession();
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: out });

    // ---- desktop ----
    await p.setViewport({ width: 1440, height: 1000 });
    await p.goto(BASE);
    await p.screenshot({ path: path.join(out, 'landing.png') });
    await p.click('#trySample');
    await p.waitForSelector('.ov .badge');
    await wait(400);
    const before = await p.evaluate(() => ({
      banner: document.querySelector('#banner').textContent,
      first: [...document.querySelectorAll('#order .item .txt')].slice(0, 3).map(e => e.textContent),
      mode: document.querySelector('.seg [aria-checked="true"]').dataset.mode,
    }));
    assert.equal(before.mode, 'before');
    assert.match(before.banner, /no tags/);
    assert.match(before.first[0], /Published May 2027/, 'file order starts with the footer');
    await p.screenshot({ path: path.join(out, 'desktop-before.png') });

    await p.click('.seg [data-mode="after"]');
    await wait(200);
    const after = await p.evaluate(() => {
      const S = window.Earshot;
      return {
        order: S.blocks.filter(b => b.type !== 'artifact').map(b => (b.type === 'h' ? 'H' + b.level : b.type) + ':' + b.text.slice(0, 24)),
        hidden: S.blocks.filter(b => b.type === 'artifact').length,
        todo: document.querySelector('#checkCount').textContent,
      };
    });
    assert.deepEqual(after.order.slice(0, 5).map(s => s.split(':')[0]), ['H1', 'p', 'H2', 'p', 'li']);
    assert.ok(after.order.indexOf('H2:How to register') < after.order.indexOf('H2:Financial assistance'), 'left column read before right');
    assert.ok(after.order.some(s => s.startsWith('table')), 'table found');
    assert.equal(after.hidden, 6, 'two headers, two footers, two page numbers hidden');
    assert.equal(after.todo, '1', 'one thing to do: the picture description');
    await p.screenshot({ path: path.join(out, 'desktop-after.png') });

    // Fix the picture via the check.
    await p.click('#tabChecks');
    await p.click('#checksPanel .chk.s-todo .linkish');
    await p.waitForSelector('.item.sel textarea');
    await p.type('.item.sel textarea', 'Two canoes on a pond below green hills on a sunny day');
    await p.$eval('.item.sel textarea', el => el.dispatchEvent(new Event('change')));
    await wait(100);
    assert.equal(await p.$eval('#checkCount', e => e.textContent), '✓');

    // Keyboard edits: select the intro paragraph, make it H2, undo; move; hide.
    const introId = await p.evaluate(() => window.Earshot.blocks.find(b => b.type === 'p').id);
    await p.click(`#order .item[data-id="${introId}"]`);
    await p.keyboard.press('2');
    assert.equal(await p.evaluate(id => window.Earshot.blocks.find(b => b.id === id).type, introId), 'h');
    await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
    assert.equal(await p.evaluate(id => window.Earshot.blocks.find(b => b.id === id).type, introId), 'p');
    const idx = () => p.evaluate(id => window.Earshot.blocks.findIndex(b => b.id === id), introId);
    const i0 = await idx();
    await p.keyboard.down('Alt'); await p.keyboard.press('ArrowDown'); await p.keyboard.up('Alt');
    assert.equal(await idx(), i0 + 1);
    await p.click('#undo');
    assert.equal(await idx(), i0);
    await p.screenshot({ path: path.join(out, 'desktop-editing.png') });

    // Clicking a box on the page selects it in the list.
    await p.click('.ov.t-table');
    assert.equal(await p.$eval('#order .item.sel .chip', e => e.textContent), 'Table');

    // Export tagged PDF.
    await p.click('#exportPdf');
    await p.waitForSelector('#result[open]');
    const result = await p.$eval('#resultBody', e => e.textContent);
    assert.match(result, /Saved your tagged PDF/, result);
    assert.match(result, /(\d+) of \1 text pieces/, 'all text tagged');
    assert.match(result, /H1 ×1/);
    await p.screenshot({ path: path.join(out, 'desktop-export.png') });
    await p.click('#result button');
    const pdfFile = await waitFile(/tagged\)\.pdf$/);
    if (process.env.VERAPDF) {
      const v = execFileSync(process.env.VERAPDF, ['--flavour', 'ua1', '--format', 'text', pdfFile]).toString();
      assert.match(v, /^PASS/m, v);
      console.log('veraPDF:', v.trim());
    }
    await p.click('#exportHtml');
    const htmlFile = await waitFile(/accessible\)\.html$/);
    const html = readFileSync(htmlFile, 'utf8');
    assert.match(html, /<h1>Summer Recreation Programs 2027<\/h1>/);
    assert.match(html, /<th scope="col">Program<\/th>/);
    assert.match(html, /alt="Two canoes/);
    assert.ok(!/Page 1 of 2/.test(html), 'page furniture left out of HTML');

    // ---- phone ----
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await p.goto('about:blank');
    await p.goto(BASE + '#sample');
    await p.waitForSelector('.ov .badge');
    await wait(400);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, 'no horizontal overflow on phone: ' + overflow);
    await p.screenshot({ path: path.join(out, 'phone-before.png') });
    await p.click('.seg [data-mode="after"]');
    await wait(200);
    await p.screenshot({ path: path.join(out, 'phone-after.png') });
    await p.tap('.ov.t-figure');
    await wait(300);
    assert.equal(await p.evaluate(() => document.querySelector('#app').dataset.panel), 'order', 'tapping the page opens the list');
    await p.screenshot({ path: path.join(out, 'phone-order.png') });

    assert.deepEqual(errors, [], 'no page errors');
    assert.deepEqual(sent, [], 'no external requests');
    console.log('earshot browser: all checks passed', JSON.stringify({ order: after.order.length, hidden: after.hidden }));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
