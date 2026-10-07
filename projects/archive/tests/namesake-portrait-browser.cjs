// The critic's off-camera friend reproduction, preview/download equality and compact phone UI.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require(process.env.TABBY_PUPPETEER || 'puppeteer-core');
const SITE = path.join(__dirname, '../../../site/namesake');
(async () => {
  const out = process.argv[2] || '/tmp/namesake-portrait';
  await fs.mkdir(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.evaluateOnNewDocument(() => {
      let callback, now;
      window.requestAnimationFrame = cb => { callback = cb; return 1; };
      window.step = ms => { now = (now == null ? performance.now() : now) + ms; callback(now); };
      window.saved = [];
      const toBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(cb, ...args) { saved.push(this.toDataURL()); return toBlob.call(this, cb, ...args); };
    });
    await page.setRequestInterception(true);
    page.on('request', async req => {
      if (new URL(req.url()).hostname !== 'localhost') return req.abort();
      const file = new URL(req.url()).pathname.slice(1) || 'index.html';
      await req.respond({ contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html', body: await fs.readFile(path.join(SITE, file)) });
    });
    await page.setViewport({ width: 1440, height: 1000 });
    const pairs = process.env.PORTRAIT_PAIRS === undefined ? [['Pizza', 'Alice'], ['Alice', 'Bob'], ['Dreadrilaer', 'Monday']] : process.env.PORTRAIT_PAIRS.split(',').filter(Boolean).map(p => p.split(':'));
    for (const [world, friend] of pairs) {
      await page.goto(`http://localhost/?case=${world}#w=${world}&with=${friend}&land`);
      await page.evaluate(() => { __namesake.state.fade = 1; step(16); });
      const before = await page.evaluate(() => __namesake.makePostcard().toDataURL());
      const originalFocal = await page.evaluate(() => __namesake.state.focal);
      // Actually drag and zoom as in the review. The frozen clock leaves this camera in place.
      await page.mouse.move(1100, 320); await page.mouse.down(); await page.mouse.move(850, 390, { steps: 4 }); await page.mouse.up();
      await page.mouse.wheel({ deltaY: -1000 });
      const state = await page.evaluate(() => {
        const s = __namesake.state;
        return { lookYaw: s.lookYaw, lookPitch: s.lookPitch, focal: s.focal, time: s.time, landTime: s.landTime };
      });
      assert.ok(state.focal > originalFocal, 'review zoom reproduced');
      await page.click('#frameboth');
      const preview = await page.$eval('#portraitimage', e => e.src);
      assert.equal(preview, before, 'paired framing ignores drag/zoom');
      assert.deepEqual(await page.evaluate(() => {
        const s = __namesake.state; return { lookYaw: s.lookYaw, lookPitch: s.lookPitch, focal: s.focal, time: s.time, landTime: s.landTime };
      }), state, 'export preserves live camera and time');
      assert.ok(await page.$eval('#portrait', e => e.open));
      await page.screenshot({ path: path.join(out, `preview-${world}.png`) });
      await page.click('#portraitsave');
      assert.equal(await page.evaluate(() => saved.at(-1)), preview, 'download is the exact preview');
      await fs.writeFile(path.join(out, `portrait-${world}.png`), Buffer.from(preview.split(',')[1], 'base64'));
      await page.click('#portraitclose');
      assert.equal(await page.$eval('#portrait', e => e.open), false);
    }
    if (pairs.length || process.env.PORTRAIT_ORBIT) {
      await page.goto('http://localhost/?orbit#w=Alice&with=Bob');
      await page.evaluate(() => { const s = __namesake.state; s.form = s.formT = 1; s.dist = s.targetDist; step(16); });
      await page.click('#frameboth');
      const png = await page.$eval('#portraitimage', e => e.src);
      await fs.writeFile(path.join(out, 'portrait-orbit.png'), Buffer.from(png.split(',')[1], 'base64'));
      await page.setViewport({ width: 390, height: 844 });
      const fit = await page.$eval('#portraitimage', e => {
        const r = e.getBoundingClientRect(), d = document.getElementById('portrait').getBoundingClientRect();
        return { aspect: r.height/r.width, width: d.width, height: d.height };
      });
      assert.ok(Math.abs(fit.aspect - 1.25) < 0.01 && fit.width < 390 && fit.height < 844, 'phone preview fits without distorting the image: ' + JSON.stringify(fit));
      await page.screenshot({ path: path.join(out, 'phone-preview.png') });
      await page.click('#portraitclose');
    }
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('http://localhost/?phone#w=Grandma');
    await page.evaluate(() => { const s = __namesake.state; s.form = s.formT = 1; s.dist = s.targetDist; step(16); });
    assert.equal(await page.$eval('#survey', e => e.open), false);
    const layout = await page.evaluate(() => {
      const s = __namesake.state, card = document.getElementById('card').getBoundingClientRect();
      return { card: card.height, planet: 2*1.8/Math.sqrt(s.targetDist*s.targetDist - 1)*innerWidth };
    });
    assert.ok(layout.card < 300 && layout.planet > 260, JSON.stringify(layout));
    await page.screenshot({ path: path.join(out, 'phone-Grandma.png') });
    const closeDist = await page.evaluate(() => __namesake.state.targetDist);
    await page.$eval('#survey', e => { e.open = true; __namesake.layout(); });
    assert.ok(await page.evaluate(d => __namesake.state.targetDist > d, closeDist), 'survey pulls back to all moons');
    await page.$eval('#survey', e => { e.open = false; __namesake.layout(); });
    for (const [width, height] of [[390, 844], [320, 640]]) {
      await page.setViewport({ width, height });
      await page.evaluate(() => {
        __namesake.setWorld('A very long name with forty characters!!!');
        document.getElementById('friend').value = 'An equally long friend name goes here!!!';
        __namesake.setFriend(document.getElementById('friend').value);
        document.getElementById('name').value = __namesake.state.world.name;
        __namesake.layout();
        const s = __namesake.state; s.form = s.formT = 1; s.dist = s.targetDist; step(16);
        const c = document.getElementById('sky'), gl = c.getContext('webgl'), px = new Uint8Array(4);
        gl.readPixels(Math.floor(c.width/2), Math.floor(c.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      });
      const fits = await page.$eval('#card', el => ({ client: el.clientHeight, scroll: el.scrollHeight }));
      assert.ok(fits.scroll <= fits.client + 1, 'default phone actions clipped: ' + JSON.stringify(fits));
      await page.screenshot({ path: path.join(out, `phone-long-${width}.png`) });
    }
    await page.click('#swap');
    assert.match(await page.$eval('#title', e => e.textContent), /equally long friend/);
    await page.click('#unpair');
    assert.equal(await page.$eval('#frameboth', e => e.hidden), true);
    await page.evaluate(() => { location.hash = '#w=Pizza&with=Alice&land'; });
    await page.waitForFunction(() => __namesake.state.mode === 'land' && __namesake.state.friend.name === 'Alice', { polling: 100 });
    await page.goto('http://localhost/?hello#w=Hello');
    assert.match(await page.$eval('#note', e => e.textContent), /rivers glow orange-red/);
    assert.deepEqual(errors, []);
    console.log('PASS: composed twin portraits, real drag/zoom, exact preview download, preserved camera, phone reveal/actions, corrected lava');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
