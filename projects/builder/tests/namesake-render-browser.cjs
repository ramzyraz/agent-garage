// Frozen render checks and a 30-world visual atlas, independent of animation speed.
// TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node tests/namesake-render-browser.cjs [outdir]
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require(process.env.TABBY_PUPPETEER || 'puppeteer-core');

(async () => {
  const out = process.argv[2] || '/tmp/namesake-renders';
  await fs.mkdir(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<canvas id="render" width="300" height="300"></canvas>');
    for (const file of ['world.js', 'planet.js']) await page.addScriptTag({ content: await fs.readFile(path.join(__dirname, '../../../site/builder', file), 'utf8') });
    const result = await page.evaluate(() => {
      const canvas = document.getElementById('render'), renderer = Planet.createRenderer(canvas);
      if (!renderer) throw new Error('WebGL unavailable');
      const world = World.generate('Ada Lovelace');
      world.render.tilt = 0;
      const state = { world, time: 0, yaw: 0, pitch: 0, dist: 6, shift: 0, shiftX: 0, form: 1 };
      const pixel = () => {
        renderer.draw(state);
        const p = new Uint8Array(4);
        renderer.gl.readPixels(150, 150, 1, 1, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, p);
        return Array.from(p);
      };
      const bare = pixel();
      const moon = { radius: 0.3, orbit: 2, phase: Math.PI/2, speed: 0.1, inclination: 0, color: [0.8, 0.2, 0.1] };
      world.render.moons = [moon];
      const front = pixel();
      moon.phase = -Math.PI/2;
      const behind = pixel();
      // Put a moon on the ray from the front surface toward the sun.
      const sun = [-0.72, 0.32, 0.62], len = Math.hypot(...sun);
      const p = sun.map((v, i) => v/len*1.5 + (i === 2 ? 1 : 0));
      moon.orbit = Math.hypot(...p);
      moon.phase = Math.acos(p[0]/moon.orbit);
      moon.inclination = Math.atan2(p[1], p[2]);
      const eclipse = pixel();
      const atlas = document.createElement('canvas'); atlas.width = 1800; atlas.height = 1680;
      const g = atlas.getContext('2d'); g.fillStyle = '#03040a'; g.fillRect(0, 0, atlas.width, atlas.height);
      const names = ['Ada Lovelace', 'Dreadrilaer', 'Pizza', 'Monday', 'Grandma', 'Atlantis',
        ...Array.from({ length: 24 }, (_, i) => 'name ' + i)];
      const kinds = new Set();
      names.forEach((name, i) => {
        state.world = World.generate(name); state.time = 12; state.yaw = 0.5; state.pitch = 0.28;
        const r = state.world.render;
        const extent = Math.max(1.12, r.ring ? r.ringOut : 0, ...r.moons.map(m => m.orbit + m.radius));
        state.dist = extent*Math.sqrt(1 + (1.8/0.44)**2);
        renderer.draw(state);
        const x = i%6*300, y = Math.floor(i/6)*336;
        g.drawImage(canvas, x, y);
        g.fillStyle = '#e9ecf5'; g.font = '14px sans-serif';
        g.fillText(name + ' · ' + state.world.label, x+10, y+320);
        kinds.add(state.world.kind);
      });
      return { bare, front, behind, eclipse, atlas: atlas.toDataURL('image/png'), kinds: [...kinds] };
    });
    assert.notDeepEqual(result.front, result.bare, 'a foreground moon covers the planet');
    assert.deepEqual(result.behind, result.bare, 'the planet hides a moon behind it');
    assert.ok(result.eclipse.slice(0, 3).reduce((a, b) => a+b, 0) < result.bare.slice(0, 3).reduce((a, b) => a+b, 0)*0.6,
      'a moon eclipses the surface: ' + JSON.stringify([result.bare, result.eclipse]));
    assert.equal(result.kinds.length, 7, 'atlas covers every world kind');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(out, 'atlas.png'), Buffer.from(result.atlas.split(',')[1], 'base64'));
    console.log('PASS: foreground/background moons, eclipse shadow, 30-world atlas with all seven kinds');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
