// Measure completed surface frames in software WebGL, not JS command submission time.
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require(process.env.TABBY_PUPPETEER || 'puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    await page.setContent('<canvas id="sky"></canvas>');
    for (const file of ['world.js', 'planet.js', 'surface.js', 'quality.js'])
      await page.addScriptTag({ content: await fs.readFile(path.join(__dirname, '../../../site/namesake', file), 'utf8') });
    const costs = await page.evaluate(() => {
      const canvas = document.getElementById('sky'), renderer = Planet.createRenderer(canvas);
      const surface = Surface.createSurface(renderer.gl), q = RenderQuality.create(1);
      const scale = q.scale('land', 1280, 760), pixel = new Uint8Array(4);
      const complete = () => renderer.gl.readPixels(Math.floor(canvas.width/2), Math.floor(canvas.height/2),
        1, 1, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixel);
      // Chrome's gl.finish() returned immediately in this environment. Reading back a pixel
      // forces the browser to deliver the completed drawing before stopping the clock.
      return ['Dreadrilaer', 'Monday', 'Atlantis'].flatMap(name => {
        const state = { world: World.generate(name), time: 8, landTime: 4, fade: 1, focal: 1 };
        return [1, scale].map(s => {
          canvas.width = Math.round(1280*s); canvas.height = Math.round(760*s);
          surface.draw(state); complete(); // warm the shader
          const samples = [];
          for (let i = 0; i < 3; i++) {
            const start = performance.now(); surface.draw(state); complete(); samples.push(performance.now() - start);
          }
          return { name, width: canvas.width, height: canvas.height, samplesMs: samples,
            medianMs: [...samples].sort((a, b) => a - b)[1] };
        });
      });
    });
    console.log(JSON.stringify({ renderer: 'Chrome / SwiftShader (not a phone GPU)', costs }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
