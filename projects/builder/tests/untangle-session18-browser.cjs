// Review-17 regressions: input scenarios, compact/zoom maps, labels and address errors.
const puppeteer = require('/tmp/pt/node_modules/puppeteer-core');
const assert = require('node:assert/strict');
const {mkdirSync,mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} = require('node:fs');
const path=require('node:path');
const BASE=process.env.UNTANGLE_URL||'http://localhost:8765/builder/untangle/';
const out=path.resolve(process.argv[2]||'/tmp/untangle-session18');
mkdirSync(out,{recursive:true});
(async()=>{
  const {makeXlsx}=await import('./xlsx-fixture.js');
  const dir=mkdtempSync('/tmp/untangle-session18-');
  const visitor=path.join(dir,'visitor.xlsx');
  writeFileSync(visitor,makeXlsx([
    {name:'Sales Data',rows:{A1:'Item',B1:'Price',A2:'Coffee',B2:3,A3:'Tea',B3:2}},
    {name:'Summary',rows:{A4:'Tea',B4:['=VLOOKUP(A4,\'Sales Data\'!A2:B3,2,FALSE)',2]}},
  ]));
  const stale=path.join(dir,'stale.xlsx');
  writeFileSync(stale,makeXlsx([{name:'S',rows:{A1:'</td><script>window.injected=true</script>',B1:10,C1:['=B1*2',99],D1:['=C1+1',100],E1:['=B1+1',11],F1:['=INDIRECT("B1")',10]}}]));
  const table=path.join(dir,'table.xlsx');
  writeFileSync(table,makeXlsx([
    {name:'Sales',rows:{A1:'Units',B1:'Price',C1:'Revenue',A2:2,B2:5,C2:['=[@Units]*[@Price]',10],A3:3,B3:7,C3:['=[@Units]*[@Price]',21]}},
    {name:'Summary',rows:{A1:['=SUM(SalesTable[Revenue])',31]}},
  ],{tables:[{name:'SalesTable',sheet:'Sales',ref:'A1:C3',columns:['Units','Price','Revenue']}]}));
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    const p=await b.newPage(), errors=[],sent=[];
    p.on('pageerror',e=>errors.push(e.message));
    p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await p.setRequestInterception(true);
    p.on('request',r=>{if(!r.url().startsWith('http://localhost')){sent.push(r.url());r.abort();}else r.continue();});
    const upload=async file=>{await p.goto(BASE);await(await p.$('#file')).uploadFile(file);await p.waitForSelector('svg.map .node');};
    const jump=async address=>{await p.$eval('[data-jump-sheet] input',(el,v)=>el.value=v,address);await p.$eval('[data-jump-sheet]',el=>el.requestSubmit());};
    const value=async (text,type)=>{
      await p.$eval('.scenario-editor input',(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},text);
      if(type) await p.select('.scenario-editor select',type);
      await p.$eval('.scenario-editor',el=>el.requestSubmit());
    };
    const save=async name=>{
      const file=path.join(out,name);rmSync(file,{force:true});await p.click('.download-repair');
      for(let i=0;i<50&&!existsSync(file);i++)await new Promise(r=>setTimeout(r,100));
      assert.ok(existsSync(file));return readFileSync(file,'utf8');
    };
    const session=await p.createCDPSession();
    await session.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:out});
    await p.setViewport({width:1440,height:1000});
    await p.goto(BASE+'#sample');await p.waitForSelector('svg.map .node');
    await p.click('[data-suggested]');
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/33 dependent cells change/);
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/1,797,919/);
    assert.match(await p.$eval('.repair-outcome:first-child',el=>el.textContent),/5-year net profit/);
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/including any mistakes/);
    assert.doesNotMatch(await p.$eval('.repair-preview',el=>el.textContent),/Partial preview/);
    assert.equal(await p.evaluate(()=>window.__untangle.model.cell(0,2,11).value),38000);
    assert.equal(await p.$$eval('.scenario-sheet',els=>els.length),5);
    await p.screenshot({path:path.join(out,'salary.png')});
    const html=await save('untangle-input-scenario.html');
    assert.match(html,/Assumptions!B11/);assert.match(html,/Dashboard!B4/);assert.match(html,/1,797,919/);
    assert.match(html,/scenario-path/);assert.doesNotMatch(html,/<script|https?:\/\//);
    const reportPage=await b.newPage();await reportPage.goto('file://'+path.join(out,'untangle-input-scenario.html'));
    assert.equal(await reportPage.$$eval('tbody tr',els=>els.length),34);
    await reportPage.screenshot({path:path.join(out,'salary-report.png'),fullPage:true});await reportPage.close();
    // Editing clears old results and disables export before another calculation.
    await p.$eval('.scenario-editor input',el=>{el.value='nonsense';el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.ok(await p.$eval('.download-repair',el=>el.disabled));
    assert.doesNotMatch(await p.$eval('.repair-slot',el=>el.textContent),/1,797,919/);
    await p.$eval('.scenario-editor',el=>el.requestSubmit());
    assert.match(await p.$eval('.scenario-error',el=>el.textContent),/Enter a number/);
    await value('38000');
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/0 dependent cells change/);
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/38 known dependents keep/);
    await value('42000');await p.click('.close-repair');
    await p.click('[data-sheet="2"]');
    await p.click('[data-map-zoom=fit]');
    const fits=await p.$eval('.block-map',el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.width<=b.width+1&&a.height<=b.height+1;});
    assert.ok(fits,'the complete desktop Costs diagram fits its viewport');
    await p.screenshot({path:path.join(out,'costs-fit.png')});
    const small=await p.$eval('.map-scale',el=>el.textContent);
    await p.click('[data-map-zoom=actual]');assert.equal(await p.$eval('.map-scale',el=>el.textContent),'100%');
    await p.click('[data-map-zoom=out]');assert.notEqual(await p.$eval('.map-scale',el=>el.textContent),'100%');
    await p.click('[data-map-zoom=fit]');assert.equal(await p.$eval('.map-scale',el=>el.textContent),small);
    await p.click('[data-map-mode=compact]');
    await p.screenshot({path:path.join(out,'costs-compact.png')});
    await p.click('[data-flow-choice="b'+await p.evaluate(()=>window.__untangle.model.blocks.find(x=>x.sheet===2&&x.r1===9).id)+'"]');
    assert.match(await p.$eval('#inspector',el=>el.textContent),/Total costs/);
    await p.select('#blockFocus',await p.evaluate(()=> 'b'+window.__untangle.model.blocks.find(x=>x.sheet===2&&x.r1===9).id));
    assert.ok(await p.$eval('.block-map',el=>el.getBoundingClientRect().width<=el.parentElement.clientWidth+1));
    // Address validation must disappear even when navigation stays in the same grid.
    await p.click('[data-sheet-mode=grid]');await jump('nonsense');
    assert.match(await p.$eval('.jump-error',el=>el.textContent),/Use an address/);
    await jump('B2');assert.equal(await p.$eval('.jump-error',el=>el.textContent),'');
    await upload(visitor);await p.click('[data-sheet="1"]');await jump('B4');
    const tea=await p.$$eval('#inspector [data-cell="0,1,3"]',els=>els.map(el=>el.textContent).join(' '));
    assert.match(tea,/Item/);assert.doesNotMatch(tea,/Coffee/);
    await p.click('#inspector [data-cell="1,1,4"]');await p.click('[data-scenario]');
    await value('Coffee','text');assert.match(await p.$eval('.repair-preview',el=>el.textContent),/2.*→.*3/s);
    await p.screenshot({path:path.join(out,'lookup.png')});await p.click('.close-repair');
    await upload(table);await p.click('[data-sheet="0"]');await jump('B3');await p.click('[data-scenario]');await value('10');
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/31.*→.*40/s);
    await p.click('.close-repair');
    await upload(stale);await p.click('[data-sheet="0"]');await jump('B1');await p.click('[data-scenario]');await value('12');
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/Partial preview/);
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/INDIRECT\/OFFSET/);
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/11.*→.*13/s);
    const escaped=await save('untangle-input-scenario.html');
    assert.match(escaped,/&lt;script&gt;/);assert.doesNotMatch(escaped,/<script/);
    assert.equal(await p.evaluate(()=>window.injected),undefined);
    await p.click('.close-repair');
    // A phone starts with readable summaries, and can still inspect full diagrams.
    await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await p.goto(BASE+'#sample');await p.waitForSelector('svg.map .node');
    assert.ok(await p.$eval('.compact-map',el=>!el.hidden));
    assert.ok(await p.$eval('.compact-node b',el=>parseFloat(getComputedStyle(el).fontSize)>=14));
    assert.ok(await p.$eval('.map-controls',el=>el.getBoundingClientRect().top<470),'overview controls arrive early on phone');
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await p.screenshot({path:path.join(out,'phone-map.png'),fullPage:true});
    await p.click('[data-sheet="2"]');
    assert.ok(await p.$eval('.compact-map',el=>!el.hidden));
    assert.ok(await p.$$eval('.compact-node',els=>els.every(el=>el.scrollWidth<=el.clientWidth+1)));
    await p.screenshot({path:path.join(out,'phone-blocks.png'),fullPage:true});
    await p.click('[data-map-zoom=fit]');
    assert.ok(await p.$eval('.block-map',el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.width<=b.width+1&&a.height<=b.height+1;}));
    await p.click('[data-view=map]');await p.click('[data-suggested]');
    assert.match(await p.$eval('.repair-preview',el=>el.textContent),/1,797,919/);
    assert.match(await p.$eval('.repair-outcome:first-child',el=>el.textContent),/5-year net profit/);
    assert.ok(await p.$eval('#repairDialog',el=>el.scrollWidth<=el.clientWidth+1));
    assert.ok(await p.$eval('.repair-slot',el=>el.clientHeight>180),'phone retains room for results under editor');
    await p.screenshot({path:path.join(out,'phone-salary.png')});
    assert.deepEqual(errors,[]);assert.deepEqual(sent,[]);
    console.log('session 18 browser: isolated input scenarios, reset/validation, lookup/table/stale paths, escaped visual report, compact/zoom maps, address error and phone bounds pass');
  } finally {await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
