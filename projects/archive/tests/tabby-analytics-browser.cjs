// Browser/privacy check using the real GoatCounter script. Every counting request
// is intercepted, so this test never adds visitors to the live dashboard.
// Install puppeteer-core locally, then run:
// TABBY_PUPPETEER=../.session-tools/node_modules/puppeteer-core node tests/analytics-browser.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require(process.env.TABBY_PUPPETEER || "puppeteer-core");
const S = require("../../../site/tabby/settle.js");

(async () => {
  const response = await fetch("https://gc.zgo.at/count.js");
  assert.ok(response.ok, "Can fetch the counter script for an integration check");
  const counterScript = await response.text();
  const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const ledger = {
    title: "PRIVATE TRIP ☕", currency: "$", people: ["PRIVATE ANA", "PRIVATE BEN", "PRIVATE CAI"],
    expenses: [
      { what: "PRIVATE HOTEL", amount: 30000, payer: 0, among: [0, 1, 2] },
      { what: "PRIVATE DINNER", amount: 9000, payer: 1, among: [0, 1] },
    ],
  };
  const code = S.encode(ledger);

  async function open(url, mode = "normal") {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const hits = [], errors = [];
    let externalScripts = 0;
    let delayed;
    page.on("pageerror", (err) => errors.push(err.message));
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      const requested = new URL(request.url());
      if (requested.hostname === "ramzyraz.goatcounter.com") {
        hits.push(requested);
        await request.respond({ status: 204 });
      } else if (requested.hostname === "gc.zgo.at") {
        externalScripts++;
        if (mode === "blocked") await request.abort();
        else if (mode === "delayed") delayed = request;
        else await request.respond({ contentType: "application/javascript", body: counterScript });
      } else {
        const filename = requested.pathname.split("/").pop() || "index.html";
        if (!["index.html", "style.css", "settle.js", "analytics.js", "app.js"].includes(filename)) {
          await request.respond({ status: 204 });
          return;
        }
        const body = await fs.readFile(path.join(__dirname, "../../../site/tabby", filename));
        const contentType = filename.endsWith(".js") ? "application/javascript" : filename.endsWith(".css") ? "text/css" : "text/html";
        await request.respond({ contentType, body });
      }
    });
    await page.evaluateOnNewDocument(() => {
      window.copiedTexts = [];
      window.failCopy = false;
      window.prompts = 0;
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text) => {
        if (window.failCopy) throw new Error("clipboard blocked");
        window.copiedTexts.push(text);
      } } });
      window.prompt = () => { window.prompts++; return null; };
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#transfers").textContent.length > 0);
    return { page, hits, errors, scripts: () => externalScripts, release: () => delayed.respond({ contentType: "application/javascript", body: counterScript }) };
  }

  async function addExpense(page, amount) {
    await page.$eval("#what", (el) => el.value = "PRIVATE TAXI");
    await page.$eval("#amount", (el, value) => el.value = value, amount);
    await page.click("#add-expense button");
  }

  try {
    const shared = await open("https://ramzyraz.github.io/agent-garage/tabby/?PRIVATE_QUERY=secret#" + code);
    await shared.page.waitForFunction(() => typeof window.goatcounter?.count === "function");
    assert.equal(await shared.page.$eval("#title", (el) => el.value), ledger.title);
    const transfers = await shared.page.$eval("#transfers", (el) => el.textContent);
    assert.ok(transfers.includes("PRIVATE CAI pays PRIVATE ANA $100.00"));
    assert.ok(transfers.includes("PRIVATE BEN pays PRIVATE ANA $55.00"));
    await shared.page.click("#copy-link");
    await shared.page.click("#copy-summary");
    await shared.page.waitForFunction(() => window.copiedTexts.length === 2);
    const copied = await shared.page.evaluate(() => window.copiedTexts);
    assert.ok(copied[0].includes(code), "Sharing retains ledger data for the group");
    assert.ok(copied[1].includes("PRIVATE BEN → PRIVATE ANA: $55.00"));
    await addExpense(shared.page, "invalid");
    assert.equal(await shared.page.$eval("#expense-error", (el) => el.hidden), false);
    await addExpense(shared.page, "12.00");
    await shared.page.waitForNetworkIdle({ idleTime: 100 });
    assert.deepEqual(shared.hits.map((hit) => hit.searchParams.get("p")).sort(), [
      "/agent-garage/tabby/", "expense-added", "populated-link-copied", "populated-summary-copied", "shared-tab-opened",
    ].sort());
    for (const hit of shared.hits) {
      assert.equal(hit.searchParams.get("t"), "Tabby");
      assert.equal(hit.searchParams.has("q"), false, "Query strings stay private");
      assert.equal(hit.searchParams.has("r"), false, "Referrers stay private");
      assert.ok(!decodeURIComponent(hit.href).includes("PRIVATE"));
      assert.ok(!hit.href.includes(code), "No encoded ledger in analytics");
    }
    await shared.page.evaluate(() => window.failCopy = true);
    await shared.page.click("#copy-link");
    await shared.page.waitForFunction(() => window.prompts === 1);
    await shared.page.waitForNetworkIdle({ idleTime: 100 });
    assert.equal(shared.hits.length, 5, "Failed clipboard writes are not counted as sharing");
    assert.deepEqual(shared.errors, []);
    console.log("PASS: private payloads, shared-link opening, valid expenses, successful sharing, failed clipboard");

    const delayed = await open("https://ramzyraz.github.io/agent-garage/tabby/", "delayed");
    await delayed.page.click("#copy-link");
    for (const name of ["Ana", "Ben"]) {
      await delayed.page.type("#person-name", name);
      await delayed.page.click("#add-person button");
    }
    await addExpense(delayed.page, "10");
    await delayed.release();
    await delayed.page.waitForNetworkIdle({ idleTime: 100 });
    assert.deepEqual(delayed.hits.map((hit) => hit.searchParams.get("p")), ["/agent-garage/tabby/", "expense-added"]);
    assert.deepEqual(delayed.errors, []);
    console.log("PASS: delayed script preserves events; empty-tab copies do not count as use");

    const blocked = await open("https://ramzyraz.github.io/agent-garage/tabby/#" + code, "blocked");
    await addExpense(blocked.page, "10");
    await blocked.page.click("#copy-summary");
    await blocked.page.waitForFunction(() => window.copiedTexts.length === 1);
    assert.equal(await blocked.page.$$eval("#expenses li", (els) => els.length), 3);
    assert.equal(blocked.hits.length, 0);
    assert.deepEqual(blocked.errors, []);
    console.log("PASS: blocked analytics leaves adding expenses and sharing usable");

    const local = await open("http://localhost:8000/#" + code);
    await local.page.click("#copy-link");
    assert.equal(local.scripts(), 0);
    assert.equal(local.hits.length, 0);
    assert.deepEqual(local.errors, []);
    console.log("PASS: local development makes no analytics requests");
  } finally {
    await browser.close();
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
