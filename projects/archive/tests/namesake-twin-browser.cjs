// Twin worlds: a second name hangs in the first world's sky. Real WebGL (software), real UI.
// Usage: TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node tests/namesake-twin-browser.cjs [outdir]
const path = require("path");
const fs = require("fs/promises");
const assert = require("assert");
const puppeteer = require(process.env.TABBY_PUPPETEER || "puppeteer-core");

const SITE = path.join(__dirname, "../../../site/namesake");
const OUT = process.argv[2] || "/tmp/namesake-twin";
const TYPES = { html: "text/html", css: "text/css", js: "text/javascript", png: "image/png" };
const PAIRS = (process.env.PAIRS || "Alice:Bob,Dreadrilaer:Monday,Atlantis:Saturn,Pizza:Grandma").split(",").map((p) => p.split(":"));

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    let callback, now;
    window.requestAnimationFrame = cb => { callback = cb; return 1; };
    window.advance = seconds => {
      const proto = WebGLRenderingContext.prototype, draw = proto.drawArrays, count = Math.round(seconds*10);
      try { for (let i = 0; i < count; i++) {
        proto.drawArrays = i === count-1 ? draw : () => {};
        now = (now == null ? performance.now() : now) + 100; callback(now);
      } } finally { proto.drawArrays = draw; }
    };
  });
  const errors = [], analytics = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    const u = new URL(req.url());
    if (u.hostname !== "localhost") { analytics.push(u.href); return req.abort(); }
    const name = u.pathname.replace(/^\//, "") || "index.html";
    try { req.respond({ contentType: TYPES[name.split(".").pop()] || "text/plain", body: await fs.readFile(path.join(SITE, name)) }); }
    catch (e) { req.respond({ status: 404, body: "" }); }
  });
  const ready = () => page.evaluate(() => { advance(2); return __namesake.state.form > 0.99; }).then(ok => assert.ok(ok, 'formed world'));
  const landed = () => page.evaluate(() => { advance(5.2); return __namesake.state.mode === 'land' && __namesake.state.fade === 1 && __namesake.state.descent === 0; })
    .then(ok => assert.ok(ok, 'landed and arrived'));
  const ui = () => page.evaluate(() => ({ hash: location.hash, note: document.getElementById("note").textContent,
    friend: document.getElementById("friend").value, bar: !document.getElementById("friendbar").hidden,
    add: !document.getElementById("addfriend").hidden, title: document.getElementById("title").textContent }));

  await page.setViewport({ width: 1280, height: 760 });
  let n = 0;
  for (const [a, b] of PAIRS) {
    n++;
    // Fresh document load each time (query changes), so startup parsing of &with= is what's tested.
    await page.goto(`http://localhost:8000/?hq&n=${n}#w=${encodeURIComponent(a)}&with=${encodeURIComponent(b)}`);
    await ready();
    let s = await ui();
    assert.ok(s.bar && !s.add, "friend bar open for a twin link");
    assert.strictEqual(s.friend, b);
    assert.ok(s.note.includes(b), s.note);
    await page.screenshot({ path: path.join(OUT, `orbit-${a}-${b}.png`) });
    await page.goto(`http://localhost:8000/?hq&n=${n}l#w=${encodeURIComponent(a)}&with=${encodeURIComponent(b)}&land`);
    await landed();
    s = await ui();
    assert.ok(s.note.includes(b) && s.hash.includes("&with=") && s.hash.endsWith("&land"), JSON.stringify(s));
    await page.screenshot({ path: path.join(OUT, `land-${a}-${b}.png`) });
  }

  // UI flow: add a friend by typing, swap, remove.
  await page.goto("http://localhost:8000/?hq&flow#w=Alice");
  await ready();
  let s = await ui();
  assert.ok(s.add && !s.bar);
  await page.click("#addfriend");
  await page.type("#friend", "Bob");
  await page.waitForFunction(() => location.hash === "#w=Alice&with=Bob", { polling: 100 });
  assert.strictEqual(await page.evaluate(() => window.__namesake.state.friend.name), "Bob");
  await page.click("#swap");
  s = await ui();
  assert.strictEqual(s.title, "Bob"); assert.strictEqual(s.friend, "Alice");
  assert.strictEqual(s.hash, "#w=Bob&with=Alice");
  // Twin postcard from orbit.
  const card = await page.evaluate(() => window.__namesake.makePostcard().toDataURL("image/png"));
  await fs.writeFile(path.join(OUT, "postcard-orbit.png"), Buffer.from(card.split(",")[1], "base64"));
  await page.click("#unpair");
  s = await ui();
  assert.ok(s.add && !s.bar && s.hash === "#w=Bob", JSON.stringify(s));
  // Existing-tab hash change adds the twin back.
  await page.evaluate(() => { location.hash = "#w=Bob&with=Carol"; });
  await page.waitForFunction(() => window.__namesake.state.friend && window.__namesake.state.friend.name === "Carol", { polling: 100 });

  // Phone portrait, landed, with a postcard.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto("http://localhost:8000/?hq&phone#w=Dreadrilaer&with=Alice");
  await ready();
  await page.screenshot({ path: path.join(OUT, "phone-orbit.png") });
  await page.goto("http://localhost:8000/?hq&phone2#w=Alice&with=Dreadrilaer&land");
  await landed();
  await page.screenshot({ path: path.join(OUT, "phone-land.png") });
  const lc = await page.evaluate(() => window.__namesake.makePostcard().toDataURL("image/png"));
  await fs.writeFile(path.join(OUT, "postcard-land.png"), Buffer.from(lc.split(",")[1], "base64"));

  assert.deepStrictEqual(errors, []);
  assert.ok(analytics.every((u) => !/Alice|Bob|Carol|Dreadrilaer/i.test(u)), "names never leave the page");
  await browser.close();
  console.log("twin browser check passed; screenshots in", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
