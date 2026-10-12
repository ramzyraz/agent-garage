// Session 25: demo in the first view, silent read-along, compact phone editor,
// and a prompt before exporting undescribed pictures.
// Server: python3 -m http.server 8765 --directory site
// Usage: node projects/builder/tests/earshot-session25-browser.cjs [out dir]
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.EARSHOT_URL || 'http://localhost:8765/builder/earshot/';
const out = path.resolve(process.argv[2] || '/tmp/earshot-session25');
fs.mkdirSync(out, { recursive: true });
const pause = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text())); };
  try {
    // 1. The evaluator's viewport: the demo is in the first view and plays without scrolling or clicking.
    const d = await browser.newPage();
    watch(d);
    await d.setViewport({ width: 1280, height: 800 });
    await d.goto(BASE);
    await d.waitForFunction(() => document.querySelector('#demo').classList.contains('ready'), { timeout: 8000 });
    await d.waitForFunction(() => /Read [3-9] of/.test(document.querySelector('.demo-count').textContent), { timeout: 8000 });
    const first = await d.evaluate(() => {
      const r = document.querySelector('#demo').getBoundingClientRect(), s = document.querySelector('#trySample').getBoundingClientRect();
      return { demoBottom: r.bottom, sampleBottom: s.bottom, scrollY, said: document.querySelector('.demo-said').textContent, boxes: document.querySelectorAll('.demo-box').length };
    });
    assert.equal(first.scrollY, 0);
    assert.ok(first.demoBottom <= 800 && first.sampleBottom <= 800, JSON.stringify(first));
    assert.ok(first.boxes >= 3 && first.said.length > 5, JSON.stringify(first));
    await d.screenshot({ path: path.join(out, 'landing-1280.png') });
    // Opening a document stops the demo.
    await d.click('#trySample');
    await d.waitForFunction(() => !document.querySelector('#app').hidden && window.Earshot.pageEls[0]?.drawn);
    const shown = await d.$eval('.demo-count', e => e.textContent);
    await pause(1600);
    assert.equal(await d.$eval('.demo-count', e => e.textContent), shown, 'demo is idle behind the editor');

    // 2. Read aloud with no voice (headless Chrome fails synthesis): it still steps visibly.
    await d.click('#listen');
    await d.waitForSelector('#reader:not([hidden])');
    await d.waitForFunction(() => !document.querySelector('#readerNote').hidden, { timeout: 4000 });
    assert.match(await d.$eval('#readerNote', e => e.textContent), /reading silently/);
    const c1 = await d.$eval('#readerCount', e => e.textContent);
    assert.match(c1, /reading 1 of \d+/);
    assert.equal(await d.evaluate(() => document.querySelectorAll('.ov.speaking').length), 1, 'current piece highlighted on the page');
    await d.waitForFunction(() => /reading 2 of/.test(document.querySelector('#readerCount').textContent), { timeout: 8000 });
    await d.screenshot({ path: path.join(out, 'read-along-desktop.png') });
    await d.click('#readerPause');
    const paused = await d.$eval('#readerCount', e => e.textContent);
    await pause(2500);
    assert.equal(await d.$eval('#readerCount', e => e.textContent), paused, 'pause holds');
    await d.click('#readerNext');
    assert.notEqual(await d.$eval('#readerCount', e => e.textContent), paused, 'next steps while paused');
    await d.click('#readerPrev');
    assert.equal(await d.$eval('#readerCount', e => e.textContent), paused);
    await d.click('#readerStop');
    assert.equal(await d.evaluate(() => document.querySelector('#reader').hidden && !window.Earshot.speaking), true);
    assert.equal(await d.evaluate(() => document.querySelectorAll('.speaking').length), 0);
    assert.match(await d.$eval('#listen', e => e.textContent), /Read aloud/);
    // "As it is now" reads the scrambled order, footer first.
    await d.click('.seg [data-mode="before"]');
    await d.click('#listen');
    await d.waitForSelector('#reader:not([hidden])');
    assert.match(await d.$eval('#readerSaid', e => e.textContent), /Published May 2027/);
    assert.match(await d.$eval('#readerCount', e => e.textContent), /As it is now/);
    await d.keyboard.press('Escape');
    assert.equal(await d.$eval('#reader', e => e.hidden), true, 'Escape stops reading');

    // 3. Exporting with an undescribed picture asks first; "Describe it" goes to the field.
    await d.click('.seg [data-mode="after"]');
    await d.click('#exportPdf');
    await d.waitForSelector('#altAsk[open]');
    assert.match(await d.$eval('#altAskTitle', e => e.textContent), /1 picture has no description/);
    await d.waitForFunction(() => document.querySelector('#altAskImg').naturalWidth > 0);
    await d.screenshot({ path: path.join(out, 'alt-ask.png') });
    await d.click('#altAsk button[value="describe"]');
    await d.waitForFunction(() => document.activeElement?.matches('#order .item.sel textarea'));
    assert.equal(await d.$('#result[open]'), null, 'no file written yet');
    await d.click('#exportPdf');
    await d.waitForSelector('#altAsk[open]');
    const cdp = await d.createCDPSession();
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: out });
    await d.click('#altAsk button[value="anyway"]');
    await d.waitForSelector('#result[open]');
    assert.match(await d.$eval('#resultBody', e => e.textContent), /no description yet/);
    await d.click('#result button');
    await d.type('#order .item.sel textarea', 'Two canoes on a pond');
    await d.click('#exportPdf');
    await d.waitForSelector('#result[open]', { timeout: 15000 });
    assert.equal(await d.$('#altAsk[open]'), null, 'described pictures export directly');
    await d.close();

    // 4. Phone: the page starts high up; secondary tools sit behind More.
    const m = await browser.newPage();
    watch(m);
    await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await m.goto(BASE + '#sample');
    await m.waitForFunction(() => !document.querySelector('#app').hidden && window.Earshot.pageEls[0]?.drawn);
    const lay = await m.evaluate(() => ({
      pages: document.querySelector('#pages').getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth - innerWidth,
      hidden: ['#makeTable', '#exportHtml', '.session-bar'].map(s => getComputedStyle(document.querySelector(s)).display),
      download: document.querySelector('#exportPdf').textContent.trim(),
    }));
    assert.ok(lay.pages < 400, `page starts at ${lay.pages}`);
    assert.equal(lay.overflow, 0);
    assert.deepEqual(lay.hidden, ['none', 'none', 'none']);
    await m.screenshot({ path: path.join(out, 'phone-editor.png') });
    await m.tap('#moreTools');
    assert.equal(await m.$eval('#moreTools', e => e.getAttribute('aria-expanded')), 'true');
    assert.notEqual(await m.$eval('#makeTable', e => getComputedStyle(e).display), 'none');
    assert.notEqual(await m.$eval('.session-bar', e => getComputedStyle(e).display), 'none');
    await m.screenshot({ path: path.join(out, 'phone-more.png') });
    await m.tap('#moreTools');
    await m.tap('#listen');
    await m.waitForFunction(() => /reading 2 of/.test(document.querySelector('#readerCount').textContent), { timeout: 8000 });
    assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await m.screenshot({ path: path.join(out, 'phone-read-along.png') });
    await m.close();

    // 5. Phone landing still overflows nothing, and the demo becomes ready.
    const ml = await browser.newPage();
    watch(ml);
    await ml.setViewport({ width: 390, height: 844, isMobile: true });
    await ml.goto(BASE);
    await ml.waitForFunction(() => document.querySelector('#demo').classList.contains('ready'), { timeout: 8000 });
    assert.equal(await ml.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await ml.close();

    assert.deepEqual(errors, []);
    console.log('session 25 browser: all checks passed', JSON.stringify({ phonePageTop: Math.round(lay.pages), demoBottom: Math.round(first.demoBottom) }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
