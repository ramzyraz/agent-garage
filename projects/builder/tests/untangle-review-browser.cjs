// Regression cases from the independent session-15 review, plus block navigation.
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const BASE = process.env.UNTANGLE_URL || 'http://localhost:8765/builder/untangle/';
const out = process.argv[2] || '/tmp/untangle-review';
mkdirSync(out, { recursive: true });

(async () => {
  const { makeXlsx } = await import('./xlsx-fixture.js');
  const dir = mkdtempSync(path.join(tmpdir(), 'untangle-review-'));
  const fixture = (name, sheets) => { const file = path.join(dir, name); writeFileSync(file, makeXlsx(sheets)); return file; };
  const stale = fixture('stale.xlsx', [{ name: 'Stale', rows: { A2: 10, B2: ['=A2*2', 99], C2: ['=B2+1', 100] } }]);
  const external = fixture('edge-cases.xlsx', [{ name: 'Results', rows: { B12: ["='[missing.xlsx]Sheet1'!A1", 42] } }]);
  const rows = { A1: 'Units', B1: 'Double' };
  for (let r=2; r<=10001; r++) { rows['A'+r]=r; rows['B'+r]=['=A'+r+'*2', r*2]; }
  rows.GU2 = 5; rows.GV2 = ['=GU2*2',10];
  const large = fixture('large.xlsx', [{ name: 'Data', rows }, { name: 'Summary', rows: { B2: ['=SUM(Data!B2:B10001)', 100030000] } }]);
  const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', args:['--no-sandbox'] });
  try {
    const p = await b.newPage(), errors = [], sent = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', r => { if (!r.url().startsWith('http://localhost')) { sent.push(r.url()); r.abort(); } else r.continue(); });
    await p.setViewport({ width:1440, height:950 });
    const upload = async file => { await p.goto(BASE); await (await p.$('#file')).uploadFile(file); await p.waitForSelector('svg.map .node'); };
    const jump = async address => {
      await p.$eval('[data-jump-sheet] input', (el, text) => { el.value=text; }, address);
      await p.$eval('[data-jump-sheet]', el => el.requestSubmit());
      await p.waitForSelector('.insp-head .addr');
    };
    await upload(stale);
    assert.equal(await p.evaluate(()=>window.__untangle.model.verification.mismatched),1);
    assert.match(await p.$eval('#summary',e=>e.textContent), /things to check/);
    await p.click('#sheetTabs button');
    await jump('C2');
    assert.equal(await p.$('.recalc.ok'),null);
    assert.match(await p.$eval('.recalc',e=>e.textContent), /Upstream Stale!B2/);
    await p.screenshot({path:path.join(out,'stale.png')});
    await p.click('[data-cell="0,2,2"]');
    assert.match(await p.$eval('.recalc',e=>e.textContent), /20 instead of 99/);
    await upload(external);
    await p.click('[data-view=issues]');
    assert.match(await p.$eval('.issue',e=>e.textContent), /another file/);
    assert.doesNotMatch(await p.$eval('.issue',e=>e.textContent), /doesn't exist/);
    await p.click('.issue');
    assert.equal(await p.$('.recalc.ok'),null);
    assert.match(await p.$eval('.tree',e=>e.textContent), /in another file/);
    await p.screenshot({path:path.join(out,'external.png')});
    await upload(large);
    await p.click('#sheetTabs button[data-sheet="0"]');
    assert.equal(await p.$$eval('.flow-node',n=>n.length), 5, 'three-group main flow plus far-column input and formula');
    assert.ok((await p.$eval('.block-map',e=>e.textContent)).includes('A2:A10001'));
    await p.click('[data-flow-node="b0"]');
    assert.match(await p.$eval('#inspector',e=>e.textContent), /10,000 copies/);
    await p.screenshot({path:path.join(out,'large-blocks.png')});
    await p.click('[data-cell="0,2,10001"]');
    assert.equal(await p.$eval('.insp-head .addr',e=>e.textContent),'Data!B10001');
    assert.ok(await p.$('.cell.sel[data-r="10001"]'));
    await jump('GV2');
    assert.equal(await p.$eval('.insp-head .addr',e=>e.textContent),'Data!GV2');
    assert.ok(await p.$('.cell.sel[data-c="204"]'), 'jump beyond 200 columns');
    await p.click('#sheetTabs button[data-sheet="1"]');
    await jump('B2');
    await p.click('.tree [data-range]');
    assert.ok(await p.$('.block-map'));
    assert.match(await p.$eval('.range-note',e=>e.textContent),/B2:B10001/);
    assert.match(await p.$eval('#inspector',e=>e.textContent),/A range, not one cell/);
    await p.click('[data-sheet-mode=grid]');
    await jump('Summary!B2');
    await p.click('[data-inputs-for]');
    assert.equal(await p.$$eval('.inputs-list li',n=>n.length), 100, 'all upstream inputs are accessible in pages');
    await p.click('#nextInputs');
    assert.match(await p.$eval('#stage',e=>e.textContent),/101–200 of 10,000/);
    await p.$eval('#inputSearch input',e=>e.value='Data!A10001');
    await p.$eval('#inputSearch',e=>e.requestSubmit());
    assert.equal(await p.$$eval('.inputs-list li',n=>n.length), 1);
    await p.click('.inputs-list .row-btn');
    assert.equal(await p.$eval('.insp-head .addr',e=>e.textContent),'Data!A10001');
    // Review case on a narrow touch screen, including both view modes.
    await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await upload(large); // Changing touch emulation reloads the page in Chrome.
    await p.click('#sheetTabs button[data-sheet="0"]');
    assert.ok(await p.$('.block-map'));
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1));
    await p.screenshot({path:path.join(out,'large-phone.png'),fullPage:true});
    await p.click('[data-sheet-mode=grid]');
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1));
    // Saved #REF! is never a green verification result.
    await p.goto(BASE+'#sample'); await p.waitForSelector('svg.map .node');
    await p.click('#sheetTabs button[data-sheet="5"]'); await jump('B6');
    assert.equal(await p.$('.recalc.ok'),null);
    assert.match(await p.$eval('.recalc',e=>e.textContent),/#REF!/);
    if (process.env.UNTANGLE_PUBLIC_FIXTURES) {
      await p.setViewport({width:1440,height:950});
      const names = ['shared_formulas.xlsx','FormulaSheetRange.xlsx','evaluate_formula_with_structured_table_references.xlsx','WithChartSheet.xlsx','link-external-workbook-b.xlsx','FormulaEvalTestData_Copy.xlsx','simple-table-named-range.xlsx'];
      for (const name of names) {
        await upload(path.join(process.env.UNTANGLE_PUBLIC_FIXTURES,name));
        await p.click('#sheetTabs button');
        await p.waitForSelector('.block-map');
        assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1));
        if (name === 'FormulaEvalTestData_Copy.xlsx') {
          assert.equal(await p.$$eval('.flow-node',nodes=>nodes.length),80);
          assert.match(await p.$eval('.range-note',e=>e.textContent), /Showing 80/);
          const value = await p.$eval('#blockFocus option:nth-child(2)',e=>e.value);
          await p.select('#blockFocus',value);
          assert.ok(await p.$('#inspector .ftext'));
        }
        if (name === 'shared_formulas.xlsx') await p.screenshot({path:path.join(out,'excel-shared-formulas.png')});
        console.log('public workbook browser:',name);
      }
    }
    assert.deepEqual(errors,[]); assert.deepEqual(sent,[]);
    console.log('review browser: stale chain, error, external reference, large block flow, ranges, 10k input browsing, wide-column jump and phone all pass');
  } finally { await b.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
