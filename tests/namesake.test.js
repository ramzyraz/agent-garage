const test = require("node:test");
const assert = require("node:assert");
const W = require("../site/world.js");
const { createHash } = require("node:crypto");

test("adding moons preserves the previously shared worlds", () => {
  const oldFields = Array.from({ length: 400 }, (_, i) => {
    const w = W.generate("name " + i);
    delete w.render.moons;
    return w;
  });
  assert.strictEqual(createHash("sha256").update(JSON.stringify(oldFields)).digest("hex"),
    "221e2a46f7372ee927803b056f303adb6729cfa7675ec4f96819576e0c59dc21");
});

test("major moons match the survey and orbit outside the planet and rings", () => {
  for (let i = 0; i < 400; i++) {
    const w = W.generate("name " + i), r = w.render;
    assert.strictEqual(r.moons.length, Math.min(Number(w.facts[5][1]), 3));
    for (const m of r.moons) {
      assert.ok(m.orbit - m.radius > (r.ring ? r.ringOut : 1));
      assert.ok(m.radius > 0 && m.radius < 0.3 && m.speed > 0);
      assert.ok(m.color.every((c) => Number.isFinite(c) && c >= 0 && c <= 1));
    }
  }
});

test("same name gives the same world, ignoring case and spacing", () => {
  const a = W.generate("Ada Lovelace"), b = W.generate("  ada   LOVELACE ");
  assert.strictEqual(a.seed, b.seed);
  assert.deepStrictEqual(a.render, b.render);
  assert.deepStrictEqual(a.facts, b.facts);
  assert.strictEqual(b.name, "ada LOVELACE"); // display keeps what was typed
});

test("different names give different worlds and every kind shows up", () => {
  const kinds = new Set(), seeds = new Set();
  for (let i = 0; i < 400; i++) {
    const w = W.generate("name " + i);
    kinds.add(w.kind); seeds.add(w.seed);
    assert.ok(w.render.pal.length === 6 && w.render.pal.flat().every((c) => c >= 0 && c <= 1 && Number.isFinite(c)));
    assert.ok(w.render.ringOut > w.render.ringIn);
    assert.ok(!/\{[cn]\}/.test(w.note), w.note);
    assert.strictEqual(w.facts.length, 6);
  }
  assert.strictEqual(kinds.size, W.KINDS.length);
  assert.ok(seeds.size > 395);
});

test("empty names fall back, long names are cut, random names are pronounceable", () => {
  assert.strictEqual(W.generate("   ").name, "Earth");
  assert.strictEqual(W.generate("x".repeat(80)).name.length, 40);
  const r = W.rng(7);
  for (let i = 0; i < 50; i++) assert.match(W.randomName(r), /^[A-Z][a-z]{2,12}$/);
});

test("landing sites: a proper horizon, a risen sun, and the first moon in the sky", () => {
  const S = require("../site/surface.js");
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2], len = (a) => Math.sqrt(dot(a, a));
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  for (let i = 0; i < 300; i++) {
    const w = W.generate("name " + i), r = w.render, s = S.site(w, 7);
    for (const v of [s.U, s.N, s.E, s.L]) assert.ok(close(len(v), 1));
    assert.ok(close(dot(s.U, s.N), 0) && close(dot(s.U, s.E), 0) && close(dot(s.N, s.E), 0));
    const sunUp = dot(s.L, s.U);
    assert.ok(sunUp > 0.1 && sunUp < 0.3, "low sun above the horizon");
    if (r.kind === 2) {
      assert.ok(len(s.O) > 2.2, "a gas giant's moon stands well clear of the giant");
      assert.ok(dot(s.O.map((x) => -x), s.U) / len(s.O) > 0.3, "the giant is up in the sky");
    } else {
      assert.ok(close(len(s.O), 1), "rocky worlds: standing on the surface");
      if (r.moons.length) {
        const m = r.moons[0], a = m.phase + (7 + 4) * 0.33 * m.speed;
        const P = [Math.cos(a)*m.orbit, Math.sin(a)*Math.sin(m.inclination)*m.orbit, Math.sin(a)*Math.cos(m.inclination)*m.orbit];
        const rel = P.map((x, k) => x - s.O[k]);
        assert.ok(dot(rel, s.U) / len(rel) > 0.2, "first moon is up when you land: " + w.name);
      }
    }
  }
});
