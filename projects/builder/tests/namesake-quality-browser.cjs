// Drive real UI/WebGL with a controlled RAF clock, without adding analytics visits.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require(process.env.TABBY_PUPPETEER || 'puppeteer-core');
const SITE = path.join(__dirname, '../../../site/builder');
(async () => {
  const out = process.argv[2] || '/tmp/namesake-quality';
  await fs.mkdir(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewport({ width: 1280, height: 760 });
    await page.evaluateOnNewDocument(() => {
      let callback, now;
      window.requestAnimationFrame = cb => { callback = cb; return 1; };
      window.step = ms => { now = (now == null ? performance.now() : now) + ms; const cb = callback; callback = null; cb(now); };
    });
    await page.setRequestInterception(true);
    page.on('request', async req => {
      if (new URL(req.url()).hostname !== 'localhost') return req.abort();
      const file = new URL(req.url()).pathname.slice(1) || 'index.html';
      const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
      await req.respond({ contentType, body: await fs.readFile(path.join(SITE, file)) });
    });
    const dimensions = () => page.$eval('#sky', c => [c.width, c.height]);
    const ticks = (n, ms) => page.evaluate(([n, ms]) => { for (let i = 0; i < n; i++) step(ms); }, [n, ms]);
    await page.goto('http://localhost/#w=Dreadrilaer&land');
    assert.deepEqual(errors, [], 'page startup');
    assert.equal(await page.evaluate(() => __namesake.state.mode), 'land', 'landed link startup');
    const initial = await dimensions();
    assert.ok(initial[0] * initial[1] <= 361000, 'initial landscape pixel budget: ' + initial);
    await ticks(1, 16); // discard startup/compilation
    await ticks(4, 1000);
    const lowered = await dimensions();
    assert.ok(lowered[0] < initial[0] && lowered[1] < initial[1], 'four stalled frames lower resolution');
    const card = await page.evaluate(() => {
      __namesake.state.fade = 1;
      const c = __namesake.makePostcard(); return [c.width, c.height, c.toDataURL()];
    });
    assert.deepEqual(card.slice(0, 2), [1080, 1350], 'postcard remains full size');
    assert.deepEqual(await dimensions(), lowered, 'export restores live resolution');
    await fs.writeFile(path.join(out, 'postcard.png'), Buffer.from(card[2].split(',')[1], 'base64'));
    await ticks(1, 10000); // export/paused clock must not be counted
    await ticks(3, 1000);
    assert.deepEqual(await dimensions(), lowered, 'export resets frame feedback');
    await ticks(1, 1000);
    assert.ok((await dimensions())[0] < lowered[0]);
    await page.evaluate(() => __namesake.setMode('orbit'));
    assert.deepEqual(await dimensions(), [1280, 760], 'orbit retains its resolution');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await ticks(5, 1000);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await ticks(1, 10000);
    await ticks(3, 16);
    assert.deepEqual(await dimensions(), [1280, 760], 'background/foreground transition does not lower resolution');
    await page.evaluate(() => { location.hash = '#w=Monday&land'; });
    await page.waitForFunction(() => __namesake.state.mode === 'land' && __namesake.state.world.name === 'Monday', { polling: 100 });
    assert.ok((await page.evaluate(() => location.hash)).endsWith('&land'), 'surface hashchange keeps its mode');
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('http://localhost/?phone#w=Dreadrilaer&land');
    assert.deepEqual(await dimensions(), [390, 844], 'fresh phone starts at CSS resolution');
    await ticks(1, 16);
    await ticks(4, 300);
    const phonePixel = await page.evaluate(() => {
      __namesake.state.fade = 1; step(16);
      const canvas = document.getElementById('sky'), gl = canvas.getContext('webgl'), p = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width/2), Math.floor(canvas.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return [...p];
    });
    assert.ok(phonePixel[0] + phonePixel[1] + phonePixel[2] > 80, 'adaptive phone giant is visible: ' + phonePixel);
    await page.screenshot({ path: path.join(out, 'phone-adaptive.png') });
    assert.deepEqual(await dimensions(), [293, 633], 'phone at first adaptive level');
    await page.goto('http://localhost/?hq#w=Dreadrilaer&land');
    await ticks(5, 1000);
    assert.deepEqual(await dimensions(), [390, 844], 'HQ ignores feedback and budget');
    assert.deepEqual(errors, []);
    console.log('PASS: landed links, early adaptation, independent orbit resolution, full postcards, export/background reset, phone, HQ');

  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
