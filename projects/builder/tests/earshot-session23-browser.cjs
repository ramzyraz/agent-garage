// Session 23: landing demo, browser-printed (already tagged) PDFs, phone badges.
// Server: python3 -m http.server 8765 --directory site
// Usage: node projects/builder/tests/earshot-session23-browser.cjs [out dir]
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const BASE = process.env.EARSHOT_URL || 'http://localhost:8765/builder/earshot/';
const out = path.resolve(process.argv[2] || '/tmp/earshot-session23');
fs.mkdirSync(out, { recursive: true });
const pause = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text())); };
  try {
    // The evaluator's case: a simple HTML page printed to PDF by Chrome. Chrome writes good tags.
    const html = path.join(out, 'a.html');
    fs.writeFileSync(html, '<!doctype html><html lang="en"><head><title>a.html</title></head><body><h1>Main title</h1><p>Intro paragraph text here.</p><h2>Section</h2><ul><li>One</li><li>Two</li></ul><table border="1"><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></body></html>');
    const printed = path.join(out, 'a.pdf');
    fs.rmSync(printed, { force: true });
    execFileSync(process.env.CHROME || '/usr/bin/google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', `--print-to-pdf=${printed}`, html], { stdio: 'ignore' });

    const p = await browser.newPage();
    watch(p);
    await p.setViewport({ width: 1280, height: 900 });
    await p.goto(BASE);
    await (await p.$('#file')).uploadFile(printed);
    await p.waitForFunction(() => !document.querySelector('#app').hidden && window.Earshot.pageEls[0]?.drawn);
    await p.click('.seg [data-mode="after"]');
    const state = await p.evaluate(() => ({ source: window.Earshot.source, title: window.Earshot.title, types: window.Earshot.blocks.filter(b => b.type !== 'artifact').map(b => b.type + (b.level || '')) }));
    assert.equal(state.source, 'existing', 'safe browser tags are the starting point');
    assert.equal(state.title, 'Main title', 'a file name is not a title');
    assert.deepEqual(state.types, ['h1', 'p', 'h2', 'li', 'li', 'table']);
    await p.click('#tabChecks');
    const checks = await p.$eval('#checksPanel', el => el.textContent);
    assert.match(checks, /2 headings in a sensible outline/);
    assert.doesNotMatch(checks, /H3/, 'list items and table headers are not headings');
    assert.match(checks, /has column headers/);
    // Layout suggestions on the same file no longer turn list items into headings.
    await p.click('#banner .source-actions button:first-child');
    assert.equal(await p.evaluate(() => window.Earshot.source), 'layout');
    const layout = await p.evaluate(() => window.Earshot.blocks.map(b => `${b.type}${b.level || ''}:${b.text}`));
    assert.ok(layout.includes('p:One') && layout.includes('p:Two'), layout.join(' | '));
    assert.ok(layout.filter(t => t.startsWith('artifact')).length >= 3, 'print date, URL and page number hidden');
    await p.screenshot({ path: path.join(out, 'printed-tagged.png') });
    await p.close();

    // Landing demo: plays without sound, steps through both orders, opens the sample.
    const d = await browser.newPage();
    watch(d);
    await d.setViewport({ width: 1280, height: 900 });
    await d.evaluateOnNewDocument(() => {
      window.utterances = [];
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel() {}, speak(u) { window.utterances.push(u.text); setTimeout(() => u.onend && u.onend(), 20); } } });
    });
    await d.goto(BASE, { waitUntil: 'networkidle0' });
    await d.$eval('#demo', e => e.scrollIntoView());
    await d.waitForFunction(() => document.querySelector('#demo .demo-count').textContent.startsWith('Read 3'), { timeout: 15000 });
    const before = await d.evaluate(() => ({ phase: document.querySelector('#demo').dataset.phase, said: document.querySelector('.demo-said').textContent, boxes: document.querySelectorAll('.demo-box').length }));
    assert.equal(before.phase, 'before');
    assert.equal(before.boxes, 3);
    assert.equal(await d.evaluate(() => window.utterances.length), 0, 'silent until asked');
    await d.click('.demo-sound');
    await d.waitForFunction(() => document.querySelector('#demo').dataset.phase === 'after', { timeout: 30000 });
    const spoken = await d.evaluate(() => window.utterances);
    assert.equal(spoken[0], 'Published May 2027', 'file order reads the footer first');
    assert.ok(spoken.some(t => /title is read 15th/.test(t)), spoken.join(' | '));
    await d.waitForFunction(() => window.utterances.some(t => t.startsWith('Heading level 1. Summer Recreation')), { timeout: 15000 });
    await d.screenshot({ path: path.join(out, 'demo-after.png') });
    await d.click('.demo-play');
    const n = await d.evaluate(() => window.utterances.length);
    await pause(400);
    assert.equal(await d.evaluate(() => window.utterances.length), n, 'pause stops speech');
    await d.click('.demo-open');
    await d.waitForFunction(() => !document.querySelector('#app').hidden && window.Earshot.isSample);
    await d.close();

    // Reduced motion: the demo waits for Play.
    const r = await browser.newPage();
    watch(r);
    await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await r.goto(BASE, { waitUntil: 'networkidle0' });
    await r.$eval('#demo', e => e.scrollIntoView());
    await r.waitForSelector('#demo.ready');
    await pause(1500);
    assert.equal(await r.$eval('.demo-count', e => e.textContent), '');
    await r.click('.demo-play');
    await r.waitForFunction(() => document.querySelector('.demo-count').textContent.startsWith('Read 1'));
    await r.close();

    // Phone: no sideways scrolling on the landing; badges stay near their own box.
    const m = await browser.newPage();
    watch(m);
    await m.setViewport({ width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await m.goto(BASE, { waitUntil: 'networkidle0' });
    await m.$eval('#demo', e => e.scrollIntoView());
    await m.waitForSelector('#demo.ready');
    assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await m.screenshot({ path: path.join(out, 'phone-demo.png') });
    await m.goto(BASE + '#sample');
    await m.waitForFunction(() => !document.querySelector('#app').hidden && window.Earshot.pageEls[0]?.drawn);
    await m.click('.seg [data-mode="after"]');
    const reach = await m.evaluate(() => Math.max(...[...document.querySelectorAll('.ov .badge')].map(b => b.parentElement.getBoundingClientRect().left - b.getBoundingClientRect().left)));
    assert.ok(reach <= 13, `badge reaches ${reach}px outside its box`);
    assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await m.close();

    assert.deepEqual(errors, []);
    console.log('session 23 browser: all checks passed', JSON.stringify({ printed: state.types, demoUtterances: spoken.length }));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
