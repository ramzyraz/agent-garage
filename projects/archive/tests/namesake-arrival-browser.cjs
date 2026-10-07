// Session 13 arrival: landing falls from above the clouds to the composed first view, postcards never
// capture the fall, the view sways only when left alone, and reduced motion skips both.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require(process.env.TABBY_PUPPETEER || 'puppeteer-core');
const SITE = path.join(__dirname, '../../../site/namesake');
(async () => {
  const out = process.argv[2] || '/tmp/namesake-arrival';
  await fs.mkdir(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    await page.evaluateOnNewDocument(() => {
      let callback, now;
      window.requestAnimationFrame = cb => { callback = cb; return 1; };
      // Advance the app clock by 'seconds' in 100 ms frames (the loop caps dt at 0.1 s).
      window.advance = seconds => { for (let i = 0; i < Math.round(seconds * 10); i++) { now = (now == null ? performance.now() : now) + 100; callback(now); } };
    });
    await page.setRequestInterception(true);
    page.on('request', async req => {
      if (new URL(req.url()).hostname !== 'localhost') return req.abort();
      const file = new URL(req.url()).pathname.slice(1) || 'index.html';
      await req.respond({ contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html', body: await fs.readFile(path.join(SITE, file)) });
    });
    await page.setViewport({ width: 640, height: 400 });
    const shot = async name => {
      const url = await page.evaluate(() => document.querySelector('canvas').toDataURL());
      await fs.writeFile(path.join(out, name), Buffer.from(url.split(',')[1], 'base64'));
      return url;
    };
    const camera = () => page.evaluate(() => { const s = __namesake.state; return { descent: s.descent, drift: s.drift, fade: s.fade, mode: s.mode }; });

    // A fresh landed link arrives from the sky, not already standing.
    await page.goto('http://localhost/?a#w=Atlantis&land');
    await page.evaluate(() => advance(0.1));
    let c = await camera();
    assert.equal(c.mode, 'land');
    assert.ok(c.descent > 0.9, `starts high: ${c.descent}`);
    const high = await shot('atlantis-high.png');
    // A postcard taken mid-fall is the standing view at the same moment.
    const [during, standing] = await page.evaluate(() => {
      const a = __namesake.makePostcard().toDataURL(), s = __namesake.state, d = s.descent;
      s.descent = 0; const b = __namesake.makePostcard().toDataURL(); s.descent = d;
      return [a, b];
    });
    assert.equal(during, standing, 'postcard ignores the descent');
    await page.evaluate(() => advance(2));
    c = await camera();
    assert.ok(c.descent > 0.05 && c.descent < 0.5, `partway down: ${c.descent}`);
    assert.equal(c.fade, 1);
    await shot('atlantis-mid.png');
    await page.evaluate(() => advance(3.2));
    c = await camera();
    assert.equal(c.descent, 0);
    const low = await shot('atlantis-ground.png');
    assert.notEqual(high, low);

    // Left alone, the view starts to sway after a few seconds; a drag freezes it where it is.
    assert.equal(c.drift, 0);
    await page.evaluate(() => advance(5));
    assert.equal((await camera()).drift, 0, 'no sway in the first seconds');
    await page.evaluate(() => advance(10));
    const swaying = (await camera()).drift;
    assert.ok(Math.abs(swaying) > 0.05 && Math.abs(swaying) <= 0.2, `sways gently: ${swaying}`);
    const spot = await page.evaluate(() => {
      for (let y = 40; y < 400; y += 20) for (let x = 620; x > 0; x -= 20) if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') return [x, y];
    });
    await page.mouse.move(...spot); await page.mouse.down();
    await page.evaluate(() => advance(3));
    assert.equal((await camera()).drift, swaying, 'holding the view stops the sway');
    await page.mouse.up();

    // Changing worlds while landed doesn't replay the fall; going back to orbit and landing does.
    await page.evaluate(() => __namesake.setWorld('Pizza'));
    await page.evaluate(() => advance(0.1));
    assert.equal((await camera()).descent, 0);
    await page.evaluate(() => { __namesake.setMode('orbit'); __namesake.setMode('land'); advance(0.1); });
    assert.ok((await camera()).descent > 0.9);
    await page.evaluate(() => advance(5.5));
    await shot('pizza-ground.png');

    // Reduced motion: stand immediately and stay still.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto('http://localhost/?b#w=Alice&land');
    await page.evaluate(() => advance(0.1));
    assert.equal((await camera()).descent, 0);
    await page.evaluate(() => advance(20));
    assert.equal((await camera()).drift, 0);

    assert.deepEqual(errors, []);
    console.log(`PASS: descent from the clouds, postcards unaffected, idle sway, reduced motion · frames in ${out}`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
