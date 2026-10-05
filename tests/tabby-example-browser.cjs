// Browser check for the "Try an example" flow and the remembered payer.
// Served at the public URL with every request intercepted, so analytics runs
// for real but never reaches the live dashboard.
// Install puppeteer-core somewhere, then run:
// TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node tests/example-browser.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require(process.env.TABBY_PUPPETEER || "puppeteer-core");
const S = require("../site/tabby/settle.js");

const SITE = "https://ramzyraz.github.io/builder/tabby/";
const FILES = ["index.html", "style.css", "settle.js", "analytics.js", "app.js"];

(async () => {
  const counterScript = await (await fetch("https://gc.zgo.at/count.js")).text();
  const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });

  async function open(url) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    const hits = [], errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("dialog", (d) => d.accept());
    await page.setRequestInterception(true);
    page.on("request", async (req) => {
      const u = new URL(req.url());
      if (u.hostname === "ramzyraz.goatcounter.com") {
        hits.push(u.searchParams.get("p"));
        return req.respond({ status: 204 });
      }
      if (u.hostname === "gc.zgo.at") return req.respond({ contentType: "application/javascript", body: counterScript });
      const name = u.pathname.split("/").pop() || "index.html";
      if (!FILES.includes(name)) return req.respond({ status: 204 });
      const type = name.endsWith(".js") ? "application/javascript" : name.endsWith(".css") ? "text/css" : "text/html";
      req.respond({ contentType: type, body: await fs.readFile(path.join(__dirname, "../site/tabby", name)) });
    });
    await page.evaluateOnNewDocument(() => {
      window.copiedTexts = [];
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => { window.copiedTexts.push(t); } } });
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.goatcounter?.count === "function");
    await page.waitForNetworkIdle({ idleTime: 100 });
    return { page, hits, errors };
  }
  const visible = (page, sel) => page.$eval(sel, (el) => el.offsetParent !== null);
  const text = (page, sel) => page.$eval(sel, (el) => el.textContent);

  try {
    // 1. A first-time visitor sees the example button and can load the demo.
    const fresh = await open(SITE);
    const { page } = fresh;
    assert.equal(await visible(page, "#try"), true, "example offered on an empty tab");
    assert.equal(await visible(page, "#demo-note"), false);
    await page.click("#example");
    assert.equal(await page.$$eval("#people li", (els) => els.length), 4);
    assert.equal(await page.$$eval("#expenses li", (els) => els.length), 4);
    const moves = await text(page, "#transfers");
    for (const line of ["Dee pays Ana €116.00", "Cai pays Ana €98.00", "Ben pays Ana €26.00"]) {
      assert.ok(moves.includes(line), `example result: ${line}`);
    }
    assert.equal(await visible(page, "#demo-note"), true, "demo is clearly labelled");
    assert.equal(await visible(page, "#try"), false);
    await page.screenshot({ path: "/tmp/example-mobile.png", fullPage: true });

    // 2. Playing with the demo never looks like real use.
    await page.$eval("#what", (el) => el.value = "Taxi");
    await page.$eval("#amount", (el) => el.value = "20");
    await page.click("#add-expense button");
    await page.click("#copy-link");
    await page.click("#copy-summary");
    await page.waitForFunction(() => window.copiedTexts.length === 2);
    await page.waitForNetworkIdle({ idleTime: 100 });
    assert.deepEqual(fresh.hits, ["/builder/tabby/", "example-opened"]);
    const demoLink = (await page.evaluate(() => window.copiedTexts))[0];

    // 3. A shared demo link stays a demo, and opening it isn't a real shared tab.
    const reopened = await open(demoLink);
    assert.equal(await visible(reopened.page, "#demo-note"), true);
    assert.deepEqual(reopened.hits, ["/builder/tabby/"]);

    // 4. "Start your own tab" leaves the demo for a clean, real tab.
    await page.click("#start-own");
    assert.equal(await page.$$eval("#people li", (els) => els.length), 0);
    assert.equal(await visible(page, "#demo-note"), false);
    assert.equal(await visible(page, "#try"), true);
    assert.equal(S.decode(page.url().split("#")[1]).demo, false);

    // 5. A real tab: the payer stays the same between expenses.
    for (const name of ["Ana", "Ben", "Cai"]) {
      await page.type("#person-name", name);
      await page.click("#add-person button");
    }
    assert.equal(await visible(page, "#try"), false, "example hidden once a tab has content");
    await page.select("#payer", "1");
    await page.$eval("#what", (el) => el.value = "Groceries");
    await page.$eval("#amount", (el) => el.value = "30");
    await page.click("#add-expense button");
    assert.equal(await page.$eval("#payer", (el) => el.value), "1", "payer remembered after adding");
    // Removing someone before the payer keeps the same person selected.
    await page.click("#people li:first-child .x");
    assert.equal(await page.$eval("#payer", (el) => el.selectedOptions[0].textContent), "Ben");
    await page.waitForNetworkIdle({ idleTime: 100 });
    assert.deepEqual(fresh.hits, ["/builder/tabby/", "example-opened", "expense-added"], "real tab counts again");

    // 6. "New tab" on a demo needs no confirmation; real tabs still ask.
    let asked = 0;
    page.on("dialog", () => asked++);
    await page.click("#reset");
    assert.equal(asked, 1, "real tab asks before wiping");

    assert.deepEqual([...fresh.errors, ...reopened.errors], []);
    console.log("PASS: example loads, is labelled, never counts as use, exits cleanly; payer is remembered");
  } finally {
    await browser.close();
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
