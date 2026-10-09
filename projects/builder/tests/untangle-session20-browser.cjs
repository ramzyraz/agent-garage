// Review-19 regression: follow a trace without losing a custom scenario or repair.
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const assert = require('node:assert/strict');
const {mkdirSync,readFileSync,existsSync,rmSync} = require('node:fs');
const path = require('node:path');
const BASE = process.env.UNTANGLE_URL || 'http://localhost:8765/builder/untangle/';
const out = path.resolve(process.argv[2] || '/tmp/untangle-session20');
mkdirSync(out, {recursive:true});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    const p = await browser.newPage(), errors = [], sent = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', r => { if (!r.url().startsWith('http://localhost')) {sent.push(r.url());r.abort();} else r.continue(); });
    const session = await p.createCDPSession();
    await session.send('Page.setDownloadBehavior', {behavior:'allow', downloadPath:out});
    for (const phone of [false, true]) {
      await p.setViewport(phone ? {width:390,height:844,isMobile:true,hasTouch:true} : {width:1440,height:1000});
      await p.goto(BASE+'#sample'); await p.waitForSelector('svg.map .node');
      if (phone) {
        const widths = await p.$$eval('.compact-lane > div', els => els.filter(el=>el.children.length===1).map(el=>({lane:el.clientWidth,card:el.firstElementChild.getBoundingClientRect().width})));
        assert.ok(widths.length && widths.every(w=>Math.abs(w.lane-w.card)<2), 'single cards use the full phone lane');
      }
      await p.click('[data-suggested]');
      await p.$eval('.scenario-editor input', el=>{el.value='45000';el.dispatchEvent(new Event('input',{bubbles:true}));});
      await p.$eval('.scenario-editor', el=>el.requestSubmit());
      const chosen = await p.$$eval('.repair-outcome', els=>els.findIndex(el=>/Average net margin/.test(el.textContent)));
      assert.ok(chosen>=0); await p.click(`[data-trace="${chosen}"]`);
      await p.$eval('.scenario-sheets', el=>el.open=true);
      const state = async()=>p.$eval('#repairDialog', el=>({
        value:el.querySelector('.scenario-editor input')?.value,
        trace:el.querySelector('[data-trace][aria-pressed=true]')?.dataset.trace,
        text:el.querySelector('.ripple').textContent,
        expanded:el.querySelector('.scenario-sheets').open,
        scroll:el.querySelector('.repair-slot').scrollTop,
      }));
      // Repeat the trip; the banner also survives ordinary navigation while paused.
      for (let n=0;n<2;n++) {
        const step = '.ripple .stop:nth-child(2) [data-cell]';
        await p.$eval(step,el=>el.scrollIntoView({block:'center'}));
        const before = await state();
        assert.ok(before.scroll>0);
        await p.click(step); await wait(50);
        assert.equal(await p.$('#repairDialog'),null);
        assert.match(await p.$eval('.insp-head',el=>el.textContent),/Costs!C6/);
        assert.match(await p.$eval('.insp-value',el=>el.textContent),/912,000/, 'inspector shows the original saved staff cost');
        const bar = await p.$eval('.preview-return',el=>({text:el.textContent,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,hidden:el.hidden}));
        assert.match(bar.text,/Inspecting original saved values/);
        assert.ok(!bar.hidden && bar.top>=0 && bar.bottom<=(phone?844:1000));
        if (phone && n===0) await p.screenshot({path:path.join(out,'phone-inspection-return.png')});
        if (n===1) await p.click('[data-view=map]');
        await p.click('.resume-preview');
        const after = await state();
        assert.deepEqual(after,before, 'custom value, outcome, trace, expanded details and scroll survive');
        assert.equal(await p.$eval('.ripple .stop',el=>getComputedStyle(el).animationName),'none', 'returning shows the existing trace immediately');
        assert.equal(await p.$eval('.download-repair',el=>el.disabled),false);
      }
      await p.screenshot({path:path.join(out,phone?'phone-restored-preview.png':'desktop-restored-preview.png')});
      const report = path.join(out,'untangle-input-scenario.html');rmSync(report,{force:true});
      await p.click('.download-repair');
      for(let n=0;n<50&&!existsSync(report);n++)await wait(100);
      const html=readFileSync(report,'utf8');
      assert.match(html,/45,000/);assert.match(html,/How it reaches Average net margin/);
      assert.doesNotMatch(html,/<script|<button|https?:\/\//);
      await p.click('.close-repair');await wait(50);
      assert.equal(await p.$('.preview-return'),null);
      assert.equal(await p.evaluate(()=>window.__untangle.preview),null);
      // Repairs use the same return route and chosen-result retention.
      await p.click('[data-view=issues]');await p.click('.issue[data-issue="0"]');await p.click('[data-preview]');
      const best=await p.$$eval('.repair-outcome',els=>els.findIndex(el=>/Best year/.test(el.textContent)));
      await p.click(`[data-trace="${best}"]`);
      await p.click('.ripple .stop:nth-child(2) [data-cell]');await wait(50);
      await p.click('.resume-preview');
      assert.equal(await p.$eval('[data-trace][aria-pressed=true]',el=>el.dataset.trace),String(best));
      assert.match(await p.$eval('.ripple .stop-end',el=>el.textContent),/2030\s*→\s*2031/);
      // A new preview replaces a paused one; discarding removes retained state.
      await p.click('.ripple .stop:first-child [data-cell]');await wait(50);
      await p.click('#inspector [data-preview]');
      assert.equal(await p.$$eval('.preview-return',els=>els.length),1);
      assert.equal(await p.$eval('.preview-return',el=>el.hidden),true);
      await p.click('.ripple .stop:nth-child(2) [data-cell]');await wait(50);
      await p.click('.discard-preview');
      assert.equal(await p.$('.preview-return'),null);
      assert.equal(await p.evaluate(()=>window.__untangle.preview),null);
      // Opening another workbook while paused must discard its old private scenario.
      await p.click('[data-view=map]');await p.click('[data-suggested]');
      await p.click('.ripple .stop:nth-child(2) [data-cell]');await wait(50);
      await(await p.$('#file')).uploadFile(path.resolve('site/builder/untangle/samples/northwind-plan.xlsx'));
      await p.waitForFunction(()=>window.__untangle.fileName==='northwind-plan.xlsx');
      assert.equal(await p.$('.preview-return'),null);
      assert.equal(await p.evaluate(()=>window.__untangle.preview),null);
    }
    // Verify the finished project card opens the product from the built index.
    await p.goto('http://localhost:8765/builder/');
    assert.match(await p.$eval('h2',el=>el.textContent),/Finished/);
    await p.click('a[href="untangle/"]');await p.waitForSelector('#trySample');
    assert.deepEqual(errors,[]);assert.deepEqual(sent,[]);
    console.log('session 20 browser: desktop/phone custom scenarios and repairs retain results, details, scroll and report; return/discard/replacement/file reset and finished index pass');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
