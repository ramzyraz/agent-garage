// Rightsize end-to-end in Chrome. Needs: python3 -m http.server 8765 --directory site
// and puppeteer-core in /tmp/pt. Uses the live Open-Meteo APIs for the "your house" flow.
// Usage: node projects/builder/tests/rightsize-browser.cjs /tmp/rs-out
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const out = process.argv[2] || '/tmp/rs-out';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:8765/builder/rightsize/';
const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../site/builder/rightsize/sample.json')));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], protocolTimeout: 90000 });
  const errors = [];
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await wait(2500);

  // 1. Example is in the first view with a chart, two quote verdicts and the design point
  const first = await page.evaluate(() => {
    const r = document.querySelector('#chart svg').getBoundingClientRect();
    return { headline: document.querySelector('#headline').textContent, chartBottom: r.bottom, pts: document.querySelectorAll('#chart .pt').length,
      verdicts: [...document.querySelectorAll('.verdict')].map((v) => v.className), badge: document.querySelector('#badge').textContent };
  });
  assert.match(first.headline, /25,\d00 Btu\/h/);
  assert.ok(first.chartBottom <= 800, 'chart fits in the first view');
  assert.equal(first.pts, 12);
  assert.deepEqual(first.verdicts.map((c) => c.split(' ')[1]), ['fits', 'cycles']);
  assert.match(first.badge, /made-up/);
  await page.screenshot({ path: path.join(out, 'landing.png') });

  // 2. Units toggle
  await page.click('#unit-toggle');
  assert.match(await page.$eval('#headline', (e) => e.textContent), /\d\.\d kW/);
  await page.click('#unit-toggle');

  // 3. Your own house: place search, paste bills in a different format, add quotes, run with live weather
  await page.click('#go-yours');
  await page.type('#place-q', 'Denver');
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.click('#place-form button');
    await page.waitForSelector('#place-results .choice, #place-results .bad', { timeout: 30000 });
    if (await page.$('#place-results .choice')) break;
    console.log('place search refused:', await page.$eval('#place-results', (e) => e.textContent), '- retrying in 30s');
    await wait(30000);
  }
  const firstPlace = await page.$eval('#place-results .choice', (b) => b.textContent);
  assert.match(firstPlace, /Denver/);
  await page.click('#place-results .choice');
  const pasted = ['Billing period          Therms   Amount'].concat(sample.bills.map((b) => {
    const [y1, m1, d1] = b.start.split('-'), [y2, m2, d2] = b.end.split('-');
    return `${+m1}/${+d1}/${y1} - ${+m2}/${+d2}/${y2}   ${b.amount} therms   $${(b.amount * 1.1).toFixed(2)}`;
  })).join('\n');
  await page.$eval('#paste', (t, v) => { t.value = v; }, pasted);
  await page.click('#paste-add');
  assert.match(await page.$eval('#paste-msg', (e) => e.textContent), /Added 12 bills/);
  assert.equal(await page.$$eval('#bills-table tbody tr', (r) => r.length), 12);
  await page.click('#add-quote');
  await page.type('#quotes .quote-row:last-child input[data-k=tons]', '4');
  await page.type('#quotes .quote-row:last-child input[data-k=min47]', '19000');
  await page.click('#add-quote');
  await page.type('#quotes .quote-row:last-child input[data-k=tons]', '2.5');
  // Open-Meteo counts 10 years of hourly data as ~260 calls against a ~600/minute free limit,
  // so back-to-back test runs can be refused. A person sees the "wait a minute" message; the test waits once.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.click('#run');
    await page.waitForFunction(() => document.querySelector('#badge').classList.contains('yours') || /bad/.test(document.querySelector('#run-msg').className), { timeout: 60000, polling: 250 });
    const m = await page.$eval('#run-msg', (e) => e.textContent);
    if (!/Weather download/.test(m)) break;
    assert.match(m, /wait a minute/);
    console.log('weather service refused; waiting 65s and retrying once');
    await wait(65000);
  }
  const mine = await page.evaluate(() => ({ badge: document.querySelector('#badge').textContent, headline: document.querySelector('#headline').textContent,
    range: document.querySelector('#range').textContent, msg: document.querySelector('#run-msg').textContent, verdicts: [...document.querySelectorAll('.verdict')].map((v) => v.textContent.replace(/\s+/g, ' ').trim()), hash: location.hash }));
  console.log('Your-house result:', mine.headline, '|', mine.range, '|', mine.msg);
  assert.match(mine.badge, /Your house · Denver/);
  const mineBtu = Number(mine.headline.match(/([\d,]+) Btu\/h/)[1].replace(/,/g, ''));
  // Same bills, live weather for a slightly different grid point: should land close to the bundled example.
  assert.ok(Math.abs(mineBtu - 25400) < 2500, `live-weather result ${mineBtu}`);
  assert.equal(mine.verdicts.length, 2);
  assert.match(mine.verdicts[0], /Quote A · 4 tons/);
  assert.match(mine.verdicts[0], /hours a year/);
  assert.match(mine.verdicts[1], /Ask for its output/);
  assert.match(mine.hash, /^#r=/);
  await wait(1500); // let the smooth scroll back to the result finish
  await page.screenshot({ path: path.join(out, 'your-house.png') });

  // 4. Share link rebuilds the same result in a fresh tab
  const p2 = await browser.newPage();
  p2.on('pageerror', (e) => errors.push('shared: ' + e.message));
  await p2.bringToFront();
  await p2.setViewport({ width: 1280, height: 800 });
  await p2.goto(BASE + mine.hash, { waitUntil: 'networkidle0' });
  await p2.waitForFunction(() => document.querySelector('#badge').classList.contains('yours'), { timeout: 60000, polling: 250 }).catch(async (e) => { console.log('p2:', await p2.$eval('#run-msg', (x) => x.textContent)); throw e; });
  assert.equal(await p2.$eval('#headline', (e) => e.textContent), mine.headline);
  assert.equal(await p2.$$eval('#bills-table tbody tr', (r) => r.length), 12);

  // 5. A broken share link falls back to the example with a note
  const p3 = await browser.newPage();
  await p3.bringToFront();
  await p3.goto(BASE + '#r=not-valid-data', { waitUntil: 'networkidle0' });
  await wait(1500);
  assert.match(await p3.$eval('#badge', (e) => e.textContent), /Example/);
  assert.match(await p3.$eval('#checks', (e) => e.textContent), /damaged/);
  // Same tab, a valid link: only the # changes, the page must rebuild
  await p3.evaluate((h) => { location.hash = h; }, mine.hash);
  await p3.waitForFunction(() => document.querySelector('#badge')?.classList.contains('yours'), { timeout: 60000, polling: 250 });
  assert.equal(await p3.$eval('#headline', (e) => e.textContent), mine.headline);
  await page.bringToFront();

  // 6. Errors the person can act on
  await page.click('#clear-bills');
  await page.click('#run');
  assert.match(await page.$eval('#run-msg', (e) => e.textContent), /at least 3 bills/);

  // 7. Phone: narrow chart, no horizontal overflow, readable tick text
  const phone = await browser.newPage();
  phone.on('pageerror', (e) => errors.push('phone: ' + e.message));
  await phone.bringToFront();
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await phone.goto(BASE, { waitUntil: 'networkidle0' });
  await wait(2500);
  const ph = await phone.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, vb: document.querySelector('#chart svg').getAttribute('viewBox'),
    tick: document.querySelector('#chart .tick').getBoundingClientRect().height, headlineTop: document.querySelector('#headline').getBoundingClientRect().top }));
  assert.ok(ph.overflow <= 0, `phone overflow ${ph.overflow}`);
  assert.equal(ph.vb, '0 0 400 440');
  assert.ok(ph.tick >= 10, `tick text ${ph.tick}px`);
  await phone.screenshot({ path: path.join(out, 'phone.png') });
  await phone.evaluate(() => document.querySelector('#chart').scrollIntoView());
  await wait(300);
  await phone.screenshot({ path: path.join(out, 'phone-chart.png') });

  // 8. Print layout renders the report (PDF)
  await page.bringToFront();
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await wait(2500);
  await page.evaluate(() => { document.querySelector('#numbers').open = true; });
  await page.pdf({ path: path.join(out, 'report.pdf'), format: 'Letter', printBackground: true });
  assert.ok(fs.statSync(path.join(out, 'report.pdf')).size > 20000);

  // A refused weather request (rate limit) logs a network error in the console; that is expected when it happens.
  const real = errors.filter((e) => !/Failed to load resource|CORS policy|ERR_FAILED|429/.test(e));
  if (real.length !== errors.length) console.log('ignored network errors:', errors.length - real.length);
  assert.deepEqual(real, []);
  await browser.close();
  console.log('rightsize browser: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
