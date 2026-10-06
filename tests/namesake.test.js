const test = require("node:test");
const assert = require("node:assert");
const W = require("../site/world.js");

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
