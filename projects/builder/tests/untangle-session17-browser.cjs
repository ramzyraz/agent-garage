// Session-16 review reproductions, repair preview and local export.
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const BASE = process.env.UNTANGLE_URL || 'http://localhost:8765/builder/untangle/';
const out = path.resolve(process.argv[2] || '/tmp/untangle-session17');
mkdirSync(out, { recursive: true });

(async () => {
  const { makeXlsx } = await import('./xlsx-fixture.js');
  const dir = mkdtempSync(path.join(tmpdir(), 'untangle-session17-'));
  const table = path.join(dir,'table.xlsx');
  writeFileSync(table,makeXlsx([
    {name:'Sales',rows:{A1:'Units',B1:'Price',C1:'Revenue',A2:2,B2:5,C2:['=[@Units]*[@Price]',10],A3:3,B3:7,C3:['=[@Units]*[@Price]',21]}},
    {name:'Summary',rows:{B1:['=SUM(SalesTable[Revenue])',31]}},
  ],{tables:[{name:'SalesTable',sheet:'Sales',ref:'A1:C3',columns:['Units','Price','Revenue']}]}));
  const edge = path.join(dir,'edge.xlsx');
  writeFileSync(edge,makeXlsx([
    {name:'Inputs',rows:{A2:'Price',B2:10,B3:2,C1:['=B2*B3',20]}},
    {name:'Results',rows:{B4:['=INDIRECT("Inputs!B2")*Inputs!B3',20]}},
  ]));
  const text = path.join(dir,'text-preview.xlsx');
  writeFileSync(text,makeXlsx([{name:'S',rows:{A1:1,A2:3,A3:3,A4:4,B4:['=A4*2',8],B1:['=A1*2',2],B2:4,B3:['=A3*2',6],
    C2:['=IF(B2>5,"higher","lower")',0],D2:'</td><script>window.reportInjected=true</script>',E2:['=B2+1',5]}}]));
  // C2 has a deliberately wrong numeric cache for a text formula. Withhold that
  // path, and still export the supported E2 change with its untrusted nearby label.
  const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    const p = await b.newPage(), errors=[], sent=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.setRequestInterception(true);
    p.on('request',r=>{ if (!r.url().startsWith('http://localhost')) {sent.push(r.url());r.abort();} else r.continue(); });
    const upload = async file => { await p.goto(BASE); await (await p.$('#file')).uploadFile(file); await p.waitForSelector('svg.map .node'); };
    const jump = async address => {
      await p.$eval('[data-jump-sheet] input',(el,text)=>el.value=text,address);
      await p.$eval('[data-jump-sheet]',el=>el.requestSubmit());
    };
    await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await p.goto(BASE+'#sample'); await p.waitForSelector('svg.map .node');
    // Cards must fit their panel, not only the document (overflow can be clipped).
    await p.click('[data-view=issues]');
    assert.ok(await p.$$eval('.issue',cards=>cards.every(c=>{
      const a=c.getBoundingClientRect(), parent=c.parentElement.getBoundingClientRect();
      return a.left>=parent.left-1 && a.right<=parent.right+1 && c.scrollWidth<=c.clientWidth+1;
    })), 'every phone issue card and its contents fit');
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await p.screenshot({path:path.join(out,'phone-issues.png'),fullPage:true});
    await p.click('[data-view=map]');
    const map = await p.$eval('svg.map',el=>({scale:el.getBoundingClientRect().width/el.viewBox.baseVal.width,scroll:el.parentElement.scrollWidth,visible:el.parentElement.clientWidth}));
    assert.ok(map.scale>=0.99,'sheet text is not shrunk');
    assert.ok(map.scroll>map.visible,'large map scrolls at readable size');
    await p.screenshot({path:path.join(out,'phone-map.png'),fullPage:true});
    await p.click('[data-view=issues]'); await p.click('.issue[data-issue="0"]');
    await p.click('[data-preview]');
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/2,736,000/);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.ok(await p.$eval('#repairDialog',el=>el.scrollWidth<=el.clientWidth+1));
    await p.$eval('#repairDialog > .repair-slot',el=>el.scrollTop=0);
    assert.ok(await p.evaluate(()=>{ const c=document.querySelector('.close-repair').getBoundingClientRect(); const h=document.querySelector('.repair-dialog-head').getBoundingClientRect(); return c.bottom<=h.bottom+1; }), 'close control stays within the header');
    await p.screenshot({path:path.join(out,'phone-preview.png')});
    await p.setViewport({width:1440,height:1100});
    await p.goto(BASE+'#sample'); await p.waitForSelector('svg.map .node');
    await p.click('[data-view=issues]'); await p.click('.issue[data-issue="0"]'); await p.click('[data-preview]');
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/−1,713,542|-1,713,542/);
    assert.doesNotMatch(await p.$eval('.repair-preview',el=>el.textContent),/Partial preview/);
    assert.equal(await p.evaluate(()=>window.__untangle.model.cell(2,6,6).value),2280000);
    await p.$eval('#repairDialog > .repair-slot',el=>el.scrollTop=0);
    await p.screenshot({path:path.join(out,'repair-preview.png')});
    const session = await p.createCDPSession();
    await session.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:out});
    const report = path.join(out,'untangle-repair-preview.html'); rmSync(report,{force:true});
    await p.click('.download-repair');
    for (let i=0;i<50&&!existsSync(report);i++) await new Promise(r=>setTimeout(r,100));
    assert.ok(existsSync(report),'local report download');
    const html=readFileSync(report,'utf8');
    assert.match(html,/Costs!F6/); assert.match(html,/Dashboard!B4/); assert.match(html,/1,713,542/);
    assert.match(html,/workbook was not edited/); assert.doesNotMatch(html,/<script|https?:\/\//);
    const reportPage = await b.newPage(); await reportPage.goto('file://'+report);
    assert.equal(await reportPage.$$eval('tbody tr',els=>els.length),14);
    await reportPage.screenshot({path:path.join(out,'repair-report.png'),fullPage:true}); await reportPage.close();
    await p.click('.close-repair');
    await p.click('[data-view=issues]'); await p.click('.issue[data-issue="1"]'); await p.click('[data-preview]');
    assert.match(await p.$eval('.repair-preview .ftext',el=>el.textContent),/SUM\(C8:G8\)/);
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/1,189,321/);
    await p.click('.close-repair');
    await upload(edge); await p.click('[data-sheet="0"]'); await jump('B2');
    assert.match(await p.$eval('.impact',el=>el.textContent),/known dependent/);
    assert.match(await p.$eval('#inspector .coverage-warning',el=>el.textContent),/INDIRECT\/OFFSET/);
    await p.screenshot({path:path.join(out,'incomplete-impact.png')});
    // No known dependents must not claim that a dynamic reference uses nothing.
    await jump('B9');
    await upload(table); await p.click('[data-sheet="1"]'); await jump('B1');
    assert.ok(await p.$('.recalc.ok'));
    assert.match(await p.$eval('.tree',el=>el.textContent),/SalesTable\[Revenue\].*Sales!C2:C3/);
    await p.screenshot({path:path.join(out,'table-tree.png')});
    await p.click('.tree [data-range]'); assert.ok(await p.$('.block-map'));
    await p.click('[data-sheet="0"]'); await jump('C3');
    assert.ok(await p.$('.recalc.ok')); assert.match(await p.$eval('.tree',el=>el.textContent),/21/);
    assert.match(await p.$eval('.tree',el=>el.textContent),/7/);
    // Export escapes untrusted workbook labels; discrepant text is withheld.
    await upload(text); await p.click('[data-view=issues]');
    await p.click('.issue[data-issue="0"]'); await p.click('[data-preview]');
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/Partial preview/);
    const escapedDir=path.join(out,'escaped'); mkdirSync(escapedDir,{recursive:true});
    const escapedReport=path.join(escapedDir,'untangle-repair-preview.html'); rmSync(escapedReport,{force:true});
    await session.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:escapedDir});
    await p.click('.download-repair');
    for(let i=0;i<50&&!existsSync(escapedReport);i++) await new Promise(r=>setTimeout(r,100));
    assert.ok(existsSync(escapedReport));
    assert.match(readFileSync(escapedReport,'utf8'),/&lt;script&gt;/);
    assert.doesNotMatch(readFileSync(escapedReport,'utf8'),/<script/);
    assert.deepEqual(errors,[]); assert.deepEqual(sent,[]);
    console.log('session 17 browser: phone card bounds/readable map, impact warning, table values/drilldown, both repairs, unchanged workbook and safe local report pass');
  } finally {await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
