const test = require("node:test");
const assert = require("node:assert");
const W = require("../../../site/builder/world.js");
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
  const S = require("../../../site/builder/surface.js");
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

test("twin worlds hang clear of the first moon and the giant, lit by the same sun", () => {
  const S = require("../../../site/builder/surface.js");
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2], len = (a) => Math.sqrt(dot(a, a));
  const norm = (a) => a.map((x) => x / len(a));
  const T = (s, v) => [dot(v, s.E), dot(v, s.U), dot(v, s.N)];   // planet space -> the shader's tangent frame
  const kinds = new Set();
  for (let i = 0; i < 300; i++) {
    const w = W.generate("name " + i), f = W.generate("friend " + i), t0 = 7;
    const c = S.companion(w, f, t0), s = S.site(w, t0);
    for (const v of [c.dir, c.rt, c.up, c.sun]) assert.ok(Math.abs(len(v) - 1) < 1e-9);
    assert.ok(Math.abs(dot(c.dir, c.rt)) < 1e-9 && Math.abs(dot(c.dir, c.up)) < 1e-9);
    assert.ok(c.dir[1] > 0.27, "well above the horizon");
    assert.ok(c.sun[2] > -0.75, "not a black disc: the sun is not straight behind it");
    const own = Math.atan(c.size);   // the whole sprite, rings included
    let other = null;
    if (w.render.kind === 2) other = { dir: T(s, norm(s.O.map((x) => -x))), radius: Math.asin(1 / len(s.O)) };
    else if (w.render.moons.length) {
      const m = w.render.moons[0], a = m.phase + (t0 + 4) * 0.33 * m.speed;
      const P = [Math.cos(a)*m.orbit, Math.sin(a)*Math.sin(m.inclination)*m.orbit, Math.sin(a)*Math.cos(m.inclination)*m.orbit];
      const rel = P.map((x, k) => x - s.O[k]);
      other = { dir: T(s, norm(rel)), radius: Math.asin(Math.min(1, m.radius / len(rel))) };
    }
    if (other) {
      const sep = Math.acos(Math.max(-1, Math.min(1, dot(other.dir, c.dir))));
      assert.ok(sep > other.radius + own * 0.6, `${w.name}: twin overlaps the ${w.render.kind === 2 ? "giant" : "moon"}`);
    }
    kinds.add(w.kind);
  }
  assert.strictEqual(kinds.size, 7);
});
