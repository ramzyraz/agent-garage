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
