// Rebuild the static sharing image using the actual surface shader, without network requests.
// TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node projects/builder/tools/build-preview.cjs
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require(process.env.TABBY_PUPPETEER || 'puppeteer-core');
const SITE = path.join(__dirname, '../../../site/namesake');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<canvas id="sky" width="1200" height="630"></canvas>');
    for (const file of ['world.js', 'planet.js', 'surface.js'])
      await page.addScriptTag({ content: await fs.readFile(path.join(SITE, file), 'utf8') });
    const png = await page.evaluate(() => {
      const canvas = document.getElementById('sky'), renderer = Planet.createRenderer(canvas);
      Surface.createSurface(renderer.gl).draw({ world: World.generate('Dreadrilaer'), time: 8, landTime: 4,
        fade: 1, focal: 0.75, lookYaw: -0.5, lookPitch: -0.1 });
      const out = document.createElement('canvas'); out.width = 1200; out.height = 630;
      const g = out.getContext('2d'); g.drawImage(canvas, 0, 0);
      const shade = g.createLinearGradient(0, 0, 920, 0);
      shade.addColorStop(0, '#03040a'); shade.addColorStop(0.42, '#03040ad9'); shade.addColorStop(1, '#03040a00');
      g.fillStyle = shade; g.fillRect(0, 0, 1200, 630);
      g.font = '600 28px sans-serif'; g.fillStyle = '#9fc4ff'; g.fillText('NAMESAKE', 56, 92);
      g.font = '700 60px sans-serif'; g.fillStyle = '#ffffff';
      g.fillText('Every name', 56, 197); g.fillText('is a world.', 56, 265);
      g.font = '400 27px sans-serif'; g.fillStyle = '#cdd3e1';
      g.fillText('Type yours. Land on it.', 56, 326); g.fillText('Look up.', 56, 367);
      g.font = '400 18px sans-serif'; g.fillStyle = '#9aa3b8';
      g.fillText('Dreadrilaer · view from its moon', 56, 568);
      return out.toDataURL('image/png');
    });
    if (errors.length) throw new Error(errors.join('\n'));
    await fs.writeFile(path.join(SITE, 'og.png'), Buffer.from(png.split(',')[1], 'base64'));
    console.log('Built site/namesake/og.png (1200 × 630) from the surface shader.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
