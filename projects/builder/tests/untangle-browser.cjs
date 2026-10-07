// Browser check for Untangle: sample load, map, issues, selection, phone layout, file upload, bad file.
// Usage: (cd site && python3 -m http.server 8765) & node projects/builder/tests/untangle-browser.cjs [outdir]
const puppeteer = require(process.env.TABBY_PUPPETEER || "/tmp/pt/node_modules/puppeteer-core");
const path = require("path");
const assert = require("assert");
const BASE = process.env.UNTANGLE_URL || "http://localhost:8765/builder/untangle/";
const out = process.argv[2] || "/tmp/shots";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const p = await b.newPage();
  const errs = [];
  const sent = [];
  p.on("pageerror", (e) => errs.push(e.stack || e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.setRequestInterception(true);
  p.on("request", (r) => { if (!r.url().startsWith("http://localhost")) { sent.push(r.url()); r.abort(); } else r.continue(); });

  await p.setViewport({ width: 1440, height: 950 });
  await p.goto(BASE, { waitUntil: "networkidle0" });
  await p.screenshot({ path: `${out}/landing.png` });

  // Sample via link
  await p.goto(BASE + "#sample", { waitUntil: "networkidle0" });
  await p.waitForSelector("svg.map .node");
  assert.equal(await p.$$eval("svg.map .node", (n) => n.length), 6);
  assert.ok(await p.$$eval("svg.map .edge", (n) => n.length) >= 8);
  await p.screenshot({ path: `${out}/map.png`, fullPage: true });

  // Issues list contains the planted ones
  await p.click("button[data-view=issues]");
  const titles = await p.$$eval(".issue .title", (n) => n.map((x) => x.textContent));
  for (const want of ["Typed number where a formula should be", "SUM range stops one column short", "Broken reference", "Assumption nobody uses", "0.04 typed into the formula"]) {
    assert.ok(titles.some((t) => t.includes(want)), "missing issue: " + want);
  }
  await p.screenshot({ path: `${out}/issues.png`, fullPage: true });

  // Click the override: lands on Costs!F6 with the expected value
  await p.click(".issue[data-issue='0']");
  await wait(200);
  const head = await p.$eval(".insp-head", (e) => e.textContent);
  assert.ok(head.includes("Costs!F6") && head.includes("2,280,000"), head);
  assert.ok((await p.$eval(".insp-issue", (e) => e.textContent)).includes("2,736,000"));
  assert.ok(await p.$(".cell.sel[data-c='6'][data-r='6']"));
  await p.screenshot({ path: `${out}/override.png` });

  // Click a calc cell in the grid: formula tree recomputes and matches
  await p.click("#sheetTabs button:nth-child(4)"); // P&L
  await p.waitForSelector(".cell[data-c='7'][data-r='8']");
  await p.click(".cell[data-c='7'][data-r='8']");
  await wait(200);
  assert.ok(await p.$(".recalc.ok"), "recompute matches: " + await p.$eval("#inspector", (e) => e.textContent.slice(0, 300)) + errs.join(";"));
  assert.ok((await p.$eval(".plain", (e) => e.textContent)).includes("Profit before tax"));
  assert.ok(await p.$$eval(".cell.hl-prec", (n) => n.length) >= 2);
  await p.click(".tree .tn.ref"); // jump to a precedent
  await wait(200);
  assert.ok((await p.$eval(".insp-head .addr", (e) => e.textContent)).startsWith("P&L!G6"));
  await p.screenshot({ path: `${out}/tree.png` });

  // Inputs view
  await p.click("button[data-view=inputs]");
  assert.ok(await p.$$eval(".inputs-list li", (n) => n.length) === 18);

  // Phone layout: no horizontal overflow on any view
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.waitForSelector("#app:not([hidden]) button[data-view=map]");
  for (const v of ["map", "issues", "inputs"]) {
    await p.click(`button[data-view=${v}]`);
    await wait(100);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `${v} overflows by ${over}px`);
  }
  await p.click("button[data-view=map]");
  await p.screenshot({ path: `${out}/phone-map.png`, fullPage: true });
  await p.click("button[data-view=issues]");
  await p.click(".issue[data-issue='1']");
  await wait(400);
  await p.screenshot({ path: `${out}/phone-issue.png`, fullPage: false });
  await p.evaluate(() => document.querySelector("#inspector").scrollIntoView());
  await p.screenshot({ path: `${out}/phone-inspector.png`, fullPage: false });

  // Real file upload path + bad file message
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(BASE, { waitUntil: "networkidle0" });
  const input = await p.$("#file");
  await input.uploadFile(path.resolve(__dirname, "../../../site/builder/untangle/samples/northwind-plan.xlsx"));
  await p.waitForSelector("svg.map .node");
  assert.equal(await p.$eval("#fileName", (e) => e.textContent), "northwind-plan.xlsx");
  await p.goto(BASE, { waitUntil: "networkidle0" });
  const bad = path.resolve(__dirname, "untangle.test.js");
  const input2 = await p.$("#file");
  await input2.uploadFile(bad);
  await p.waitForSelector("#loadError:not([hidden])");
  console.log("bad file message:", await p.$eval("#loadError", (e) => e.textContent));

  assert.deepEqual(errs, [], "console errors: " + errs.join("\n"));
  assert.deepEqual(sent, [], "external requests: " + sent.join("\n"));
  console.log("untangle browser: all checks passed");
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
