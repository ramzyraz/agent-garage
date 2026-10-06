// Render landing views for several names straight from the surface shader into one contact sheet.
// TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node projects/builder/tools/surface-atlas.cjs out.png [names...]
// SURFACE_TIME=<seconds after landing> (default 4) · SURFACE_SIZE=WxH per tile (default 480x300)
// Append @d to a name to draw it partway through the arrival descent, e.g. Atlantis@0.6 (1 = start).
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require(process.env.TABBY_PUPPETEER || 'puppeteer-core');
const SITE = path.join(__dirname, '../../../site/builder');
const [out = '/tmp/atlas.png', ...rest] = process.argv.slice(2);
const names = rest.length ? rest : ['Pizza', 'Alice', 'Hello', 'Atlantis', 'Grandma', 'Monday', 'Saturday', 'Dreadrilaer'];
const [W, H] = (process.env.SURFACE_SIZE || '480x300').split('x').map(Number);
const T = Number(process.env.SURFACE_TIME || 4);
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    await page.setContent(`<canvas id="sky" width="${W}" height="${H}"></canvas>`);
    for (const file of ['world.js', 'planet.js', 'surface.js'])
      await page.addScriptTag({ content: await fs.readFile(path.join(SITE, file), 'utf8') });
    const png = await page.evaluate((names, W, H, T) => {
      const canvas = document.getElementById('sky'), renderer = Planet.createRenderer(canvas);
      const surface = Surface.createSurface(renderer.gl);
      const cols = Math.min(4, names.length), rows = Math.ceil(names.length / cols);
      const out = document.createElement('canvas'); out.width = W * cols; out.height = H * rows;
      const g = out.getContext('2d');
      names.forEach((name, i) => {
        const [n, d] = name.split('@'), world = World.generate(n);
        surface.draw({ world, time: T, landTime: 0, fade: 1, focal: 1, lookYaw: 0, lookPitch: 0, descent: Number(d || 0) });
        const x = (i % cols) * W, y = Math.floor(i / cols) * H;
        g.drawImage(canvas, x, y);
        g.font = '600 14px sans-serif'; g.fillStyle = '#fff'; g.fillText(`${name} · ${world.kind}`, x + 8, y + 20);
      });
      return out.toDataURL('image/png');
    }, names, W, H, T);
    if (errors.length) throw new Error(errors.join('\n'));
    await fs.writeFile(out, Buffer.from(png.split(',')[1], 'base64'));
    console.log('Wrote', out);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
