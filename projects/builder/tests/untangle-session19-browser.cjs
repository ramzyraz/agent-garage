// Review-18 regressions: traced causal paths, neutral change styling, phone inspection and readable map links.
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const assert = require('node:assert/strict');
const {mkdirSync,existsSync,readFileSync,rmSync} = require('node:fs');
const path = require('node:path');
const BASE = process.env.UNTANGLE_URL || 'http://localhost:8765/builder/untangle/';
const out = path.resolve(process.argv[2] || '/tmp/untangle-session19');
mkdirSync(out, {recursive:true});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    const p = await b.newPage(), errors = [], sent = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.setRequestInterception(true);
    p.on('request', (r) => { if (!r.url().startsWith('http://localhost')) { sent.push(r.url()); r.abort(); } else r.continue(); });
    const session = await p.createCDPSession();
    await session.send('Page.setDownloadBehavior', {behavior:'allow', downloadPath:out});
    await p.emulateMediaFeatures([{name:'prefers-reduced-motion', value:'reduce'}]);
    await p.setViewport({width:1440, height:1000});
    await p.goto(BASE + '#sample'); await p.waitForSelector('svg.map .node');

    // Salary scenario: the traced chain reaches the leading result through real cells.
    await p.click('[data-suggested]');
    const stops = () => p.$$eval('.ripple .stop', (els) => els.map((el) => el.querySelector('small').textContent.split(' · ')[0]));
    let chain = await stops();
    assert.equal(chain[0], 'Assumptions!B11'); assert.equal(chain.at(-1), 'Dashboard!B4');
    assert.equal(chain.length, 8);
    assert.match(await p.$eval('.ripple h4', (el) => el.textContent), /5-year net profit/);
    assert.match(await p.$eval('.ripple', (el) => el.textContent), /\+ 2 other changed sources/);
    assert.match(await p.$eval('.ripple .stop-flag', (el) => el.textContent), /SUM range stops one column short/, 'the path names a known mistake it passes through');
    // Neutral styling: a worse profit is not presented in the success green.
    const colors = await p.$$eval('.repair-values b', (els) => [...new Set(els.map((el) => getComputedStyle(el).color))]);
    assert.deepEqual(colors, ['rgb(24, 34, 48)']);
    assert.match(await p.$eval('[data-trace="2"]', (el) => el.textContent), /\+24,000/);
    await p.click('[data-trace="2"]');
    chain = await stops();
    assert.equal(chain.at(-1), 'Dashboard!B9');
    assert.ok(chain.includes('Scratch!B4'), 'the cash buffer path crosses the hidden sheet');
    assert.equal(await p.$eval('[data-trace="2"]', (el) => el.getAttribute('aria-pressed')), 'true');
    assert.equal(await p.$eval('[data-trace="0"]', (el) => el.getAttribute('aria-pressed')), 'false');
    await p.screenshot({path:path.join(out, 'salary-path.png')});
    // A step opens its cell.
    await p.click('.ripple .stop:nth-child(3) .linkish');
    assert.equal(await p.$('#repairDialog'), null);
    assert.equal(await p.$eval('.insp-head .addr', (el) => el.textContent), 'Costs!C9');

    // The review's example: the repaired staff cost reaches "best year 2030 → 2031".
    await p.click('[data-view=issues]'); await p.click('.issue[data-issue="0"]'); await p.click('[data-preview]');
    const best = await p.$$eval('.repair-outcome', (els) => els.findIndex((el) => /Best year/.test(el.textContent)));
    assert.ok(best >= 0, 'best year is a leading outcome');
    await p.click(`[data-trace="${best}"]`);
    chain = await stops();
    assert.deepEqual(chain, ['Costs!F6', 'Costs!F9', 'P&L!F5', 'P&L!F6', 'P&L!F8', 'Dashboard!B6']);
    assert.match(await p.$eval('.ripple .stop-end', (el) => el.textContent), /2030\s*→\s*2031/);
    assert.match(await p.$eval('.ripple .stop-start', (el) => el.textContent), /Proposed repair/);
    assert.equal(await p.$$eval('.ripple .stop-moved', (els) => els.length), 2);
    await p.$eval('.ripple', (el) => el.scrollIntoView());
    await p.screenshot({path:path.join(out, 'repair-best-year.png')});
    const file = path.join(out, 'untangle-repair-preview.html'); rmSync(file, {force:true});
    await p.click('.download-repair');
    for (let i = 0; i < 50 && !existsSync(file); i++) await wait(100);
    const html = readFileSync(file, 'utf8');
    assert.match(html, /How it reaches Best year for profit/, 'the report traces the chosen result'); assert.match(html, /ripple-path/);
    assert.doesNotMatch(html, /<button|<script|https?:\/\//);
    assert.doesNotMatch(html, /13704b/, 'report changes are neutral too');
    await p.click('.close-repair');

    // Maps: compact cards name real sources/destinations; zoom only applies to the diagram.
    await p.click('[data-view=map]');
    assert.equal(await p.$eval('[data-map-zoom=fit]', (el) => getComputedStyle(el).display), 'none');
    const revenue = await p.$$eval('.compact-node', (els) => els.find((el) => /^Revenue/.test(el.textContent)).textContent);
    assert.match(revenue, /← from Assumptions/); assert.match(revenue, /→ feeds Costs, P&L, Dashboard/);
    await p.click('[data-map-mode=diagram]');
    assert.notEqual(await p.$eval('[data-map-zoom=fit]', (el) => getComputedStyle(el).display), 'none');
    const shape = await p.$eval('svg.map', (el) => { const r = el.getBoundingClientRect(), v = el.parentElement.getBoundingClientRect(); return {w:r.width, h:r.height, vw:v.width}; });
    assert.ok(shape.w > shape.h * 2 && shape.w > shape.vw * 0.85, 'desktop diagram runs left to right and uses the panel width');
    await p.screenshot({path:path.join(out, 'map-diagram.png')});
    // Running formulas (year headers) no longer push destinations ahead of their sources.
    await p.evaluate(() => [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === 'Revenue').click());
    await p.waitForSelector('.compact-lane');
    const lanes = await p.$$eval('.compact-lane', (els) => els.map((el) => [...el.querySelectorAll('.compact-node b')].map((b) => b.textContent)));
    const lane = (name) => lanes.findIndex((l) => l.includes(name));
    assert.ok(lane('Revenue') < lane('Costs') && lane('Price per cup') < lane('Revenue'), JSON.stringify(lanes));
    await p.screenshot({path:path.join(out, 'revenue-blocks.png')});

    // Phone: choosing an issue shows its explanation first; pinned row labels survive horizontal scrolling.
    await p.setViewport({width:390, height:844, isMobile:true, hasTouch:true});
    await p.goto(BASE + '#sample'); await p.waitForSelector('svg.map .node');
    await p.click('[data-view=issues]'); await p.click('.issue[data-issue="0"]'); await wait(300);
    const top = await p.$eval('#inspector', (el) => el.getBoundingClientRect().top);
    assert.ok(top >= 0 && top < 200, `inspector starts in view (${top})`);
    assert.match(await p.$eval('#inspector', (el) => el.textContent), /Typed number where a formula/);
    assert.ok(await p.$eval('.grid', (el) => el.classList.contains('pinned')), 'grid scrolled to F6 pins the label column');
    const label = await p.$$eval('.rh', (els) => els.find((el) => el.firstChild.textContent === '6')?.textContent);
    assert.equal(label, '6Staff');
    await p.click('.to-grid'); await wait(600);
    const grid = await p.$eval('#gridScroll', (el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
    assert.ok(grid, 'the grid link scrolls back to the cell');
    await p.screenshot({path:path.join(out, 'phone-grid-pinned.png')});
    await p.click('[data-preview]');
    assert.ok(await p.evaluate(() => document.querySelector('.ripple').scrollWidth <= document.querySelector('.ripple').clientWidth + 1));
    await p.$eval('.ripple', (el) => el.scrollIntoView());
    await p.screenshot({path:path.join(out, 'phone-path.png')});
    assert.deepEqual(errors, []); assert.deepEqual(sent, []);
    console.log('session 19 browser: traced paths (salary, cash buffer, best year), neutral changes, report, map links/ordering/diagram width, phone inspector and pinned labels pass');
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
