// Plays Second Sense in headless Chrome on a phone-sized screen.
// Setup: cd /tmp/pt && npm i puppeteer-core
// Run:   TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node tests/game-browser.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require(process.env.TABBY_PUPPETEER || "puppeteer-core");
const G = require("../site/game.js");

const SITE = "https://ramzyraz.github.io/builder/";
const FILES = ["index.html", "style.css", "game.js", "analytics.js", "play.js"];
const FAKE_COUNTER = `window.goatcounter = { get_data: (v) => ({}), count(o) {
  const p = o && o.path || "/builder/"; new Image().src = "https://ramzyraz.goatcounter.com/count?p=" + encodeURIComponent(p); } };`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const errors = [];
  async function open(url) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: false });
    const hits = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.setRequestInterception(true);
    page.on("request", async (req) => {
      const u = new URL(req.url());
      if (u.hostname === "ramzyraz.goatcounter.com") { hits.push(u.searchParams.get("p")); return req.respond({ status: 204 }); }
      if (u.hostname === "gc.zgo.at") return req.respond({ contentType: "application/javascript", body: FAKE_COUNTER });
      const name = u.pathname.split("/").pop() || "index.html";
      if (!FILES.includes(name)) return req.respond({ status: 204 });
      const type = name.endsWith(".js") ? "application/javascript" : name.endsWith(".css") ? "text/css" : "text/html";
      req.respond({ contentType: type, body: await fs.readFile(path.join(__dirname, "../site", name)) });
    });
    await page.evaluateOnNewDocument(() => {
      window.copied = [];
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => { window.copied.push(t); } } });
    });
    await page.goto(url, { waitUntil: "networkidle0" });
    return { page, hits };
  }
  const visible = (page, id) => page.$eval("#" + id, (el) => !el.hidden);
  const text = (page, sel) => page.$eval(sel, (el) => el.textContent);

  // Play all five rounds with the keyboard, stopping each at target + offset.
  async function play(page, offsets) {
    const targets = [];
    for (let i = 0; i < 5; i++) {
      assert.equal(await text(page, "#roundno"), `Round ${i + 1}/5`);
      const target = Math.round(parseFloat(await text(page, "#target")) * 1000);
      targets.push(target);
      await page.keyboard.press("Space");
      await sleep(300);
      assert.match(await text(page, "#clock"), /^0\.[1-4]\d$/, "clock visible early on");
      await sleep(900);
      assert.equal(await text(page, "#clock"), "?.??", "clock hidden after 1s");
      await sleep(target - 1200 + offsets[i]);
      await page.keyboard.press("Space");
      assert.ok(await visible(page, "next"));
      await page.keyboard.press("Enter"); // focus is on Next: must advance exactly one round
    }
    return targets;
  }

  try {
    const day = G.dayNumber(new Date());
    // 1. Fresh visitor plays today's puzzle.
    const a = await open(SITE);
    assert.match(await text(a.page, "#daylabel"), new RegExp(`#${day}$`));
    assert.equal(await visible(a.page, "challenge"), false);
    await a.page.evaluate((d) => localStorage.setItem("ss-day-" + (d - 1), "[0,0,0,0,0]"), day); // played yesterday
    await a.page.click("#play");
    const targets = await play(a.page, [0, 0, 400, 0, -900]);
    assert.deepEqual(targets, G.targets(day), "browser uses today's shared targets");
    assert.ok(await visible(a.page, "result"));
    const emojis = await text(a.page, "#emojis");
    assert.equal([...emojis].length, 5);
    const stored = await a.page.evaluate((d) => JSON.parse(localStorage.getItem("ss-day-" + d)), day);
    assert.equal(stored.length, 5);
    // Timer accuracy in a headless browser: within ~120 ms of what we aimed for.
    [0, 0, 400, 0, -900].forEach((o, i) => assert.ok(Math.abs(stored[i] - o) < 120, `round ${i + 1}: ${stored[i]} vs ${o}`));
    assert.equal(emojis, stored.map(G.grade).join(""));
    // Result extras: per-round timeline, tendency, streak, countdown.
    const dots = await a.page.$$eval(".tl-dot", (els) => els.map((el) => [el.className, parseFloat(el.style.left)]));
    assert.equal(dots.length, 5);
    dots.forEach(([cls, left], i) => {
      assert.ok(cls.includes("g" + G.level(stored[i])), cls);
      assert.ok(Math.abs(left - (50 + 50 * Math.max(-1, Math.min(1, stored[i] / 1000)))) < 0.1, `dot ${i}: ${left}`);
    });
    assert.ok(dots[4][1] < 15, "the 0.9s-early round sits near the left edge");
    assert.equal(await text(a.page, "#tendency"), G.tendency(stored));
    assert.equal(await text(a.page, "#streak"), "🔥 2-day streak");
    assert.match(await text(a.page, "#comeback"), /^Next puzzle in \d+h \d+m\.$/);
    await a.page.screenshot({ path: "/tmp/ss-result.png", fullPage: true });
    await a.page.click("#share");
    await a.page.click("#dare");
    const [share, dare] = await a.page.evaluate(() => window.copied);
    assert.equal(share, G.shareText(day, stored, SITE, 2));
    assert.match(share, / 🔥2\n/);
    const link = dare.split("\n")[1];
    assert.equal(link, SITE + "#" + G.encodeChallenge(day, stored));
    assert.deepEqual(a.hits, ["/builder/", "daily-started", "daily-finished", "result-shared", "challenge-copied"]);
    console.log("PASS: daily game plays, hides the clock after 1s, stores the result, shares text and a dare link");
    console.log("      measured errors:", stored.join(", "), "ms; result:", await text(a.page, "#rank"), emojis);

    // 2. Reload: can't replay today, but sees the result; practice is not shareable.
    await a.page.reload({ waitUntil: "networkidle0" });
    assert.equal(await text(a.page, "#play"), "See today's result");
    await a.page.click("#play");
    assert.equal(await text(a.page, "#emojis"), emojis);
    await a.page.click("#again");
    assert.equal(await text(a.page, "#roundno"), "Round 1/5");
    console.log("PASS: reload shows today's result instead of a replay; practice starts");
    await a.page.close();

    // 3. A friend opens the dare link in a fresh browser profile.
    const ctx = await browser.createBrowserContext();
    const pageB = await ctx.newPage(); await pageB.close();
    const b = await open(link);
    assert.ok(await visible(b.page, "challenge"));
    assert.match(await text(b.page, "#challenge"), /You've been dared/);
    assert.match(await text(b.page, "#challenge"), new RegExp(G.fmt(G.total(stored)).replace(".", "\\.")));
    assert.ok(b.hits.includes("challenge-opened"));
    console.log("PASS: dare link shows the friend's score");

    // 4. Garbage hashes are ignored.
    const c = await open(SITE + "#c=1.2.3<img src=x onerror=alert(1)>");
    assert.equal(await visible(c.page, "challenge"), false);
    console.log("PASS: malformed dare links are ignored");

    assert.deepEqual(errors, [], "no console errors");
    console.log("PASS: no console errors");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
