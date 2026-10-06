// Real counter integration: all requests intercepted; never adds dashboard visitors.
// Also exercises the survey/share fallback without WebGL.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require(process.env.TABBY_PUPPETEER || 'puppeteer-core');
(async () => {
  const response = await fetch('https://gc.zgo.at/count.js');
  assert.ok(response.ok);
  const counter = await response.text();
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const blocked of [false, true]) {
      const page = await browser.newPage(), hits = [], errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: 390, height: 844 });
      await page.evaluateOnNewDocument(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          return type === 'webgl' ? null : getContext.call(this, type, ...args);
        };
        window.copied = [];
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => window.copied.push(text) } });
      });
      await page.setRequestInterception(true);
      page.on('request', async req => {
        const url = new URL(req.url());
        if (url.hostname === 'ramzyraz.goatcounter.com') {
          hits.push(url); return req.respond({ status: 204 });
        }
        if (url.hostname === 'gc.zgo.at') return blocked ? req.abort() : req.respond({ contentType: 'application/javascript', body: counter });
        assert.equal(url.hostname, 'ramzyraz.github.io');
        const file = url.pathname.split('/').pop() || 'index.html';
        const body = await fs.readFile(path.join(__dirname, '../../../site/builder', file));
        await req.respond({ contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html', body });
      });
      await page.goto('https://ramzyraz.github.io/agent-garage/builder/?PRIVATE_QUERY=secret#w=PRIVATE%20NAME&with=PRIVATE%20FRIEND', { waitUntil: 'networkidle0' });
      assert.equal(await page.$eval('#nogl', e => e.hidden), false);
      assert.equal(await page.$eval('#title', e => e.textContent), 'PRIVATE NAME');
      await page.click('#copy');
      await page.waitForFunction(() => window.copied.length === 1);
      assert.ok((await page.evaluate(() => window.copied[0])).includes('#w=PRIVATE%20NAME&with=PRIVATE%20FRIEND'));
      const card = await page.evaluate(() => {
        const c = __namesake.makePostcard(); return [c.width, c.height, c.getContext('2d').getImageData(1, 1, 1, 1).data[3]];
      });
      assert.deepEqual(card, [1080, 1350, 255]);
      await page.$eval('#friend', e => { e.value = 'PRIVATE SECOND FRIEND'; e.dispatchEvent(new Event('input')); });
      await page.waitForFunction(() => __namesake.state.friend.name === 'PRIVATE SECOND FRIEND');
      await page.$eval('#friend', e => e.dispatchEvent(new Event('change')));
      await page.click('#swap');
      await page.waitForNetworkIdle({ idleTime: 100 });
      if (blocked) assert.equal(hits.length, 0);
      else {
        assert.deepEqual(hits.map(u => u.searchParams.get('p')).sort(), ['/agent-garage/builder/', 'link-opened', 'link-copied', 'twin-opened', 'twin-named', 'twin-swapped'].sort());
        for (const hit of hits) {
          assert.equal(hit.searchParams.get('t'), 'Namesake');
          assert.equal(hit.searchParams.has('q'), false);
          assert.equal(hit.searchParams.has('r'), false);
          assert.ok(!decodeURIComponent(hit.href).includes('PRIVATE'));
        }
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: correct homepage counter path, private names/query/referrer, all twin events, blocked analytics, no-WebGL survey and postcard');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
