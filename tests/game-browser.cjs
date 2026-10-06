// Plays Second Sense in headless Chrome on a phone-sized screen.
// Setup: cd /tmp/pt && npm i puppeteer-core
// Run:   TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node tests/game-browser.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require(process.env.TABBY_PUPPETEER || "puppeteer-core");
const G = require("../site/second-sense/game.js");

const SITE = "https://ramzyraz.github.io/builder/";
const FILES = ["index.html", "style.css", "game.js", "analytics.js", "play.js"];
const FAKE_COUNTER = `window.goatcounter = { get_data: (v) => ({}), count(o) {
  const p = o && o.path || "/builder/"; new Image().src = "https://ramzyraz.goatcounter.com/count?p=" + encodeURIComponent(p); } };`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const errors = [];
  async function open(url, context = browser) {
    const page = await context.newPage();
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
      req.respond({ contentType: type, body: await fs.readFile(path.join(__dirname, "../site/second-sense", name)) });
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

    // 3. A friend opens the dare link in a fresh browser profile.
    const ctx = await browser.createBrowserContext();
    const b = await open(link, ctx);
    assert.ok(await visible(b.page, "challenge"));
    assert.match(await text(b.page, "#challenge"), /You've been dared/);
    assert.match(await text(b.page, "#challenge"), new RegExp(G.fmt(G.total(stored)).replace(".", "\\.")));
    assert.ok(b.hits.includes("challenge-opened"));
    assert.equal(await text(b.page, "#play"), "Play today's 5", "friend has separate storage");
    console.log("PASS: dare link shows the friend's score");

    // 4. Reply works for a win, tie or loss, carrying both players' scores.
    const scenarios = [
      { score: [100, -100, 100, -100, 100], result: /You beat your friend/, shared: /I beat you/ },
      { score: stored, result: /Exact tie/, shared: /An exact tie/ },
      { score: [1000, -1000, 1000, -1000, 1000], result: /Your friend wins/, shared: /You win/ },
    ];
    let replyLink;
    for (const [i, { score, result, shared }] of scenarios.entries()) {
      await b.page.evaluate((d, s) => localStorage.setItem("ss-day-" + d, JSON.stringify(s)), day, score);
      await b.page.reload({ waitUntil: "networkidle0" });
      await b.page.click("#play");
      assert.equal(await text(b.page, "#dare"), "Send it back");
      assert.match(await text(b.page, "#versus"), result);
      assert.deepEqual(await b.page.$$eval("#versus .duel-score b", (els) => els.map((el) => el.textContent)),
        [G.fmt(G.total(score)), G.fmt(G.total(stored))]);
      await b.page.click("#dare");
      await b.page.waitForFunction(() => document.getElementById("copied").textContent.startsWith("Reply copied!"));
      const reply = await b.page.evaluate(() => window.copied.at(-1));
      assert.match(reply, shared);
      replyLink = reply.split("\n")[1];
      assert.deepEqual(G.decodeChallenge(new URL(replyLink).hash), { day, errors: score, replyTo: stored });
      assert.equal(b.hits.filter((hit) => hit === "challenge-copied").length, i + 1);
      if (score === scenarios[0].score) await b.page.screenshot({ path: "/tmp/ss-reply-result.png", fullPage: true });
    }
    // The reply itself shows both scores even with no saved result on this device.
    const recipientContext = await browser.createBrowserContext();
    const recipient = await open(replyLink, recipientContext);
    assert.match(await text(recipient.page, "#challenge"), /A friend sent it back/);
    assert.match(await text(recipient.page, "#challenge"), /Original dare wins by/);
    assert.deepEqual(await recipient.page.$$eval("#challenge .duel-score b", (els) => els.map((el) => el.textContent)),
      ["5.00s", G.fmt(G.total(stored))]);
    await recipient.page.screenshot({ path: "/tmp/ss-reply-intro.png", fullPage: true });
    // Back on the original device, the stored result compares against the replying friend.
    await a.page.goto(replyLink, { waitUntil: "networkidle0" });
    await a.page.waitForSelector("#intro:not([hidden])");
    assert.match(await text(a.page, "#challenge"), /A friend sent it back/);
    assert.equal(await text(a.page, "#play"), "See today's result");
    await a.page.click("#play");
    assert.match(await text(a.page, "#versus"), /You beat your friend/);
    assert.equal(await text(a.page, "#total"), G.fmt(G.total(stored)));
    console.log("PASS: win/tie/loss replies include both scores, work on a new device, and preserve the original result");

    // A canceled native share sends no analytics; blocked clipboard offers the reply manually.
    await b.page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
    if (await visible(b.page, "intro")) await b.page.click("#play");
    await b.page.evaluate(() => Object.defineProperty(navigator, "share", {
      configurable: true, value: async () => { throw new DOMException("Canceled", "AbortError"); },
    }));
    assert.ok(await b.page.evaluate(() => matchMedia("(pointer: coarse)").matches));
    const before = b.hits.filter((hit) => hit === "challenge-copied").length;
    await b.page.click("#dare");
    await sleep(100);
    assert.equal(b.hits.filter((hit) => hit === "challenge-copied").length, before);
    await b.page.evaluate(() => {
      delete navigator.share;
      navigator.clipboard.writeText = async () => { throw new Error("Blocked"); };
    });
    const manual = new Promise((resolve) => b.page.once("dialog", async (dialog) => {
      resolve(dialog.defaultValue()); await dialog.dismiss();
    }));
    await b.page.click("#dare");
    assert.equal((await manual).split("\n")[1], replyLink);
    assert.equal(b.hits.filter((hit) => hit === "challenge-copied").length, before);
    console.log("PASS: canceled shares aren't counted; blocked clipboard offers the same reply for manual copying");

    // 5. Old dares start a new dare, rather than comparing different targets as a win.
    const stale = await open(SITE + "#" + G.encodeChallenge(day - 1, stored), ctx);
    await stale.page.click("#play");
    assert.equal(await text(stale.page, "#dare"), "Dare a friend (link)");
    assert.match(await text(stale.page, "#versus"), /Different targets today/);
    await stale.page.click("#dare");
    const newDare = await stale.page.evaluate(() => window.copied.at(-1).split("\n")[1]);
    assert.deepEqual(G.decodeChallenge(new URL(newDare).hash), { day, errors: scenarios[2].score });
    console.log("PASS: old dares don't declare a winner across different puzzles");

    // 6. Garbage hashes are ignored.
    const c = await open(SITE + "#c=1.2.3<img src=x onerror=alert(1)>");
    assert.equal(await visible(c.page, "challenge"), false);
    console.log("PASS: malformed dare links are ignored");

    assert.deepEqual(errors, [], "no console errors");
    console.log("PASS: no console errors");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
