// Surface ("Land") view: frozen renders of every world kind, plus sanity checks.
// TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node tests/namesake-surface-browser.cjs [outdir] [names…]
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require(process.env.TABBY_PUPPETEER || 'puppeteer-core');

(async () => {
  const out = process.argv[2] || '/tmp/namesake-surface';
  const extra = process.argv.slice(3);
  await fs.mkdir(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setContent('<canvas id="render" width="400" height="300"></canvas>');
    for (const file of ['world.js', 'planet.js', 'surface.js']) await page.addScriptTag({ content: await fs.readFile(path.join(__dirname, '../site', file), 'utf8') });
    const result = await page.evaluate((extra) => {
      const canvas = document.getElementById('render');
      const planet = Planet.createRenderer(canvas);
      const surface = Surface.createSurface(planet.gl);
      const names = extra.length ? extra : ['Ada Lovelace', 'Dreadrilaer', 'Pizza', 'Monday', 'Grandma', 'Atlantis',
        ...Array.from({ length: 18 }, (_, i) => 'name ' + i)];
      const cols = 4, atlas = document.createElement('canvas');
      atlas.width = cols*400; atlas.height = Math.ceil(names.length/cols)*330;
      const g = atlas.getContext('2d'); g.fillStyle = '#03040a'; g.fillRect(0, 0, atlas.width, atlas.height);
      const kinds = new Set(), stats = [];
      names.forEach((name, i) => {
        const world = World.generate(name);
        surface.draw({ world, time: 8, landTime: 4, focal: 1.0, fade: 1 });
        const px = new Uint8Array(400*300*4);
        planet.gl.readPixels(0, 0, 400, 300, planet.gl.RGBA, planet.gl.UNSIGNED_BYTE, px);
        let sum = 0, sq = 0;
        for (let k = 0; k < px.length; k += 16) { const v = px[k] + px[k+1] + px[k+2]; sum += v; sq += v*v; }
        const n = px.length/16, mean = sum/n;
        stats.push({ name, kind: world.kind, mean, sd: Math.sqrt(sq/n - mean*mean) });
        const x = i%cols*400, y = Math.floor(i/cols)*330;
        g.drawImage(canvas, x, y);
        g.fillStyle = '#e9ecf5'; g.font = '14px sans-serif';
        g.fillText(name + ' · ' + world.label + (world.render.ring ? ' · rings' : '') + ' · ' + world.render.moons.length + ' moons', x+8, y+318);
        kinds.add(world.kind);
      });
      return { atlas: atlas.toDataURL('image/png'), kinds: [...kinds], stats };
    }, extra);
    await fs.writeFile(path.join(out, 'surface-atlas.png'), Buffer.from(result.atlas.split(',')[1], 'base64'));
    assert.deepEqual(errors, []);
    for (const s of result.stats) assert.ok(s.mean > 12 && s.sd > 6, `${s.name} surface is not blank/flat: ${JSON.stringify(s)}`);
    if (!extra.length) assert.equal(result.kinds.length, 7, 'surface atlas covers every world kind');
    console.log('PASS: surface views render for', result.stats.length, 'worlds:', result.kinds.join(', '));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
