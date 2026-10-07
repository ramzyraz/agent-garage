// The session-13 review's cropped Alex/Sam reveal, including a friend added after dragging.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require(process.env.TABBY_PUPPETEER || 'puppeteer-core');
const SITE = path.join(__dirname, '../../../site/builder');
(async () => {
  const out = process.argv[2] || '/tmp/namesake-reveal';
  await fs.mkdir(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    await page.evaluateOnNewDocument(() => {
      let callback, now;
      window.requestAnimationFrame = cb => { callback = cb; return 1; };
      // One draw per tick, plus deterministic app time: no dependence on software WebGL speed.
      window.advance = seconds => {
        const proto = WebGLRenderingContext.prototype, draw = proto.drawArrays, count = Math.round(seconds*10);
        try { for (let i = 0; i < count; i++) {
          // Run every animation update, render only the final frame we actually inspect.
          proto.drawArrays = i === count-1 ? draw : () => {};
          now = (now == null ? performance.now() : now) + 100; callback(now);
        } } finally { proto.drawArrays = draw; }
      };
    });
    await page.setRequestInterception(true);
    page.on('request', async req => {
      if (new URL(req.url()).hostname !== 'localhost') return req.abort();
      const file = new URL(req.url()).pathname.slice(1) || 'index.html';
      const source = file === 'planet.js' && process.env.PLANET_BASELINE ? process.env.PLANET_BASELINE : path.join(SITE, file);
      await req.respond({ contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html', body: await fs.readFile(source) });
    });
    const check = async () => {
      const result = await page.evaluate(() => {
        const a = __namesake, s = a.state, p = a.getLandFraming(), box = a.getView(), site = Surface.site(s.world, s.landTime);
        const camera = { yaw: site.yaw+s.lookYaw+s.comp.look+s.drift, pitch: site.pitch+s.lookPitch,
          focal: s.focal, shiftX: s.landShift[0], shiftY: s.landShift[1] };
        const points = p.points.map(d => Portrait.project(d, camera, innerWidth, innerHeight));
        const horizon = Portrait.project([Math.sin(camera.yaw), 0, Math.cos(camera.yaw)], camera, innerWidth, innerHeight);
        const note = document.getElementById('note'), card = document.getElementById('card');
        return { box, points, horizon, noteVisible: getComputedStyle(note).display !== 'none' && note.getBoundingClientRect().height > 0,
          note: note.textContent, scroll: card.scrollHeight-card.clientHeight, labels: !document.getElementById('skylabels').hidden };
      });
      for (const p of result.points) assert.ok(p.z > 0 && p.x > result.box.left && p.x < result.box.right &&
        p.y > result.box.top && p.y < result.box.bottom, 'sky subject clips UI: '+JSON.stringify({p,box:result.box}));
      assert.ok(result.horizon.y < result.box.top+0.72*(result.box.bottom-result.box.top), 'foreground reserved');
      assert.ok(result.noteVisible && /sky|giant/.test(result.note), 'explanation stays visible');
      assert.ok(result.scroll <= 1, 'actions require scrolling: '+result.scroll);
      assert.ok(result.labels, 'arrival names visible');
    };
    for (const [width, height] of [[390,844], [320,640], [1440,1000]]) {
      await page.setViewport({ width, height });
      for (const [world, friend] of [['Alex','Sam'], ['Dreadrilaer','Monday']]) {
        await page.goto(`http://localhost/?hq#w=${world}&with=${friend}&land`);
        await page.evaluate(() => advance(5.2));
        await check();
        await page.screenshot({ path: path.join(out, `${world}-${friend}-${width}.png`) });
      }
    }
    // Add the friend to an already-explored surface: recenter, then keep drag/zoom responsive.
    await page.goto('http://localhost/?hq#w=Alex&land');
    await page.evaluate(() => advance(5.2));
    await page.mouse.move(1100, 350); await page.mouse.down(); await page.mouse.move(700, 500); await page.mouse.up();
    await page.click('#addfriend'); await page.type('#friend', 'Sam');
    await page.waitForFunction(() => __namesake.state.friend?.name === 'Sam', { polling: 100 });
    await page.evaluate(() => advance(1.2)); await check();
    await page.screenshot({ path: path.join(out, 'added-Sam.png') });
    const yaw = await page.evaluate(() => __namesake.state.lookYaw);
    await page.mouse.move(1100, 350); await page.mouse.down(); await page.mouse.move(900, 380); await page.mouse.up();
    assert.notEqual(await page.evaluate(() => __namesake.state.lookYaw), yaw);
    await page.click('#unpair');
    assert.equal(await page.evaluate(() => __namesake.getLandFraming()), null);
    // Frozen full-resolution orbits to inspect the critic's rough-rim names.
    for (const name of ['Alex', 'Moonlight']) {
      await page.goto(`http://localhost/?hq#w=${name}`);
      await page.evaluate(() => { const s = __namesake.state; s.dist = s.targetDist; s.formT = 1; advance(0.1); });
      await page.screenshot({ path: path.join(out, `${name}-orbit.png`) });
    }
    assert.deepEqual(errors, []);
    console.log('PASS: full sky subjects clear of controls, ground/context/names, added-friend recenter, dragging, remove; images in '+out);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
