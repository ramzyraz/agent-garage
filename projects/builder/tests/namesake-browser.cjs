// Renders Namesake in headless Chrome (software WebGL) and saves screenshots.
// Usage: TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node tests/namesake-browser.cjs [outdir] [names...]
const path = require("path");
const fs = require("fs/promises");
const assert = require("assert");
const puppeteer = require(process.env.TABBY_PUPPETEER || "puppeteer-core");

const SITE = path.join(__dirname, "../../../site/builder");
const OUT = process.argv[2] || "/tmp/namesake-shots";
const NAMES = process.argv.slice(3).length ? process.argv.slice(3) : ["Pizza", "Saturn", "Grandma", "Atlantis", "Monday", "Ada Lovelace"];
const TYPES = { html: "text/html", css: "text/css", js: "text/javascript", png: "image/png" };

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  const errors = [];
  const analytics = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    const u = new URL(req.url());
    if (u.hostname !== "localhost") { analytics.push(u.href); return req.abort(); }
    const name = u.pathname.replace(/^\//, "") || "index.html";
    try {
      req.respond({ contentType: TYPES[name.split(".").pop()] || "text/plain", body: await fs.readFile(path.join(SITE, name)) });
    } catch (e) { req.respond({ status: 404, body: "" }); }
  });

  const shoot = async (name, file, settle = 2200) => {
    await page.goto("http://localhost:8000/?hq#w=" + encodeURIComponent(name));
    await page.waitForFunction(() => window.__namesake && window.__namesake.state.form > 0.99, { timeout: 60000 });
    await new Promise((r) => setTimeout(r, settle));
    await page.screenshot({ path: path.join(OUT, file) });
    return page.evaluate(() => ({ title: document.getElementById("title").textContent, kind: window.__namesake.state.world.kind,
      label: document.getElementById("label").textContent }));
  };

  await page.setViewport({ width: 1280, height: 760 });
  const seen = [];
  for (const n of NAMES) {
    const info = await shoot(n, `desk-${n.replace(/\W+/g, "_")}.png`);
    assert.strictEqual(info.title, n);
    seen.push(`${n}: ${info.label} (${info.kind})`);
  }

  // Phone-sized, plus live typing.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await shoot("Dreadrilaer", "phone.png");
  const checkFit = async () => {
    const fit = await page.evaluate(() => {
      const { state: s, getView, sceneRadius } = window.__namesake;
      const v = getView(), unit = Math.min(innerWidth, innerHeight);
      // A sphere enclosing every orbit bounds all projections, even after dragging.
      const r = sceneRadius(s.world);
      const extent = 1.8 * r / Math.sqrt(s.targetDist*s.targetDist - r*r) * unit;
      const cx = innerWidth/2 + s.shiftX*unit, cy = innerHeight/2 - s.shift*unit;
      return { left: cx-extent-v.left, right: v.right-cx-extent,
        top: cy-extent-v.top, bottom: v.bottom-cy-extent };
    });
    assert.ok(Object.values(fit).every((n) => n >= 0), "system overlaps controls: " + JSON.stringify(fit));
  };
  await checkFit();
  for (const [width, height] of [[320, 640], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.evaluate(() => window.__namesake.layout());
    await checkFit();
    assert.ok(await page.evaluate(() => document.getElementById('card').getBoundingClientRect().top >= document.querySelector('header').getBoundingClientRect().bottom), 'card covers the name box');
    await page.screenshot({ path: path.join(OUT, `phone-${width}x${height}.png`) });
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.evaluate(() => {
    window.__namesake.setWorld('A very long name with forty characters!!!');
    document.getElementById('survey').open = true;
    document.getElementById('status').textContent = 'Link copied. Paste it anywhere.';
    window.__namesake.layout();
  });
  await checkFit();
  await page.$eval("#name", (el) => { el.value = ""; el.focus(); });
  await page.keyboard.type("Zed");
  await page.waitForFunction(() => document.getElementById("title").textContent === "Zed", { timeout: 120000 })
    .catch(async (e) => { console.error(await page.evaluate(() => [document.getElementById("name").value, document.getElementById("title").textContent])); throw e; });
  const hash = await page.evaluate(() => location.hash);
  assert.strictEqual(hash, "#w=Zed");

  // Postcard renders to a 1080x1350 PNG.
  const card = await page.evaluate(() => { const c = window.__namesake.makePostcard(); return [c.width, c.height, c.toDataURL("image/png")]; });
  assert.deepStrictEqual(card.slice(0, 2), [1080, 1350]);
  await fs.writeFile(path.join(OUT, "postcard.png"), Buffer.from(card[2].split(",")[1], "base64"));

  // Pixel sanity: the planet centre must not be black.
  const centre = await page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const c = document.getElementById("sky"); const gl = c.getContext("webgl");
    const s = window.__namesake.state, unit = Math.min(c.width, c.height);
    const px = new Uint8Array(4); gl.readPixels(Math.round(c.width/2 + s.shiftX*unit), Math.round(c.height/2 + s.shift*unit), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return Array.from(px);
  });
  assert.ok(centre[0] + centre[1] + centre[2] > 20, "planet centre is dark: " + centre);

  // Land: dive, fade up on the surface, share/postcard from there, then return to orbit.
  const landed = async (file) => {
    // Software WebGL needs ~1 s per surface frame, so skip the fade-in rather than wait for it.
    await page.waitForFunction(() => window.__namesake.state.mode === "land", { timeout: 60000 });
    await page.evaluate(() => { window.__namesake.state.fade = 1; });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(OUT, file) });
    const info = await page.evaluate(() => {
      const c = document.getElementById("sky"), gl = c.getContext("webgl"), px = new Uint8Array(4 * 9);
      let sum = 0;
      for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.7]]) {
        const p = new Uint8Array(4); gl.readPixels(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
        sum += p[0] + p[1] + p[2];
      }
      return { hash: location.hash, button: document.getElementById("land").textContent, note: document.getElementById("note").textContent,
        survey: getComputedStyle(document.getElementById("survey")).display, sum };
    });
    assert.ok(info.hash.endsWith("&land"), "landed link: " + info.hash);
    assert.ok(/Back to orbit/.test(info.button) && info.survey === "none", "landed UI");
    assert.ok(info.sum > 30, "surface view is not black: " + info.sum);
    return info;
  };
  await page.click("#land");
  const zed = await landed("land-phone-Zed.png");
  assert.ok(/standing on/.test(zed.note));
  const landCard = await page.evaluate(() => { const c = window.__namesake.makePostcard(); return [c.width, c.height, c.toDataURL("image/png")]; });
  assert.deepStrictEqual(landCard.slice(0, 2), [1080, 1350]);
  await fs.writeFile(path.join(OUT, "postcard-land.png"), Buffer.from(landCard[2].split(",")[1], "base64"));
  // Typing while landed swaps the ground under you.
  await page.$eval("#name", (el) => { el.value = ""; el.focus(); });
  await page.keyboard.type("Pizza");
  await page.waitForFunction(() => document.getElementById("title").textContent === "Pizza", { timeout: 120000 });
  const pizza = await landed("land-phone-Pizza.png");
  assert.ok(/moon Pizza I/.test(pizza.note), "gas giants land on a moon: " + pizza.note);
  await page.click("#land");
  await page.waitForFunction(() => window.__namesake.state.mode === "orbit" && !location.hash.includes("land"));
  // A shared landed link opens on the surface (desktop).
  await page.setViewport({ width: 1280, height: 760 });
  await page.goto("http://localhost:8000/?hq#w=Dreadrilaer&land");
  await landed("land-desk-Dreadrilaer.png");
  await page.goto("http://localhost:8000/?hq#w=Monday&land");
  await landed("land-desk-Monday.png");

  assert.deepStrictEqual(errors, [], "console errors");
  assert.ok(analytics.every((u) => !/Pizza|Zed|Saturn|Monday|Dreadrilaer/i.test(u)), "a name leaked to an outside request");
  console.log(seen.join("\n"));
  console.log("namesake browser check passed; screenshots in", OUT);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
