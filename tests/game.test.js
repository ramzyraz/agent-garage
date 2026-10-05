const test = require("node:test");
const assert = require("node:assert");
const G = require("../site/game.js");

test("puzzle numbers follow the local calendar day", () => {
  assert.strictEqual(G.dayNumber(new Date(2026, 9, 5, 0, 1)), 1);
  assert.strictEqual(G.dayNumber(new Date(2026, 9, 5, 23, 59)), 1);
  assert.strictEqual(G.dayNumber(new Date(2026, 9, 6, 0, 0)), 2);
  assert.strictEqual(G.dayNumber(new Date(2026, 10, 1, 12)), 28); // across the DST change
});

test("daily targets are deterministic, in range, and differ by day", () => {
  assert.deepStrictEqual(G.targets(1), G.targets(1));
  assert.notDeepStrictEqual(G.targets(1), G.targets(2));
  for (let d = 1; d < 400; d++) {
    const t = G.targets(d);
    assert.strictEqual(t.length, G.ROUNDS);
    t.forEach((ms) => { assert.ok(ms >= 1500 && ms <= 10000, `${d}: ${ms}`); assert.strictEqual(ms % 10, 0); });
  }
});

test("grades, titles and share text", () => {
  assert.deepStrictEqual([0, -50, 120, -300, 700, 701].map(G.grade), ["🎯", "🎯", "🟩", "🟨", "🟧", "🟥"]);
  assert.strictEqual(G.title(250), "Atomic clock");
  assert.strictEqual(G.title(9999), "Goldfish");
  assert.strictEqual(
    G.shareText(3, [10, -120, 300, -800, 40], "https://x/"),
    "Second Sense #3: off by 1.27s total (Kitchen timer)\n🎯🟩🟨🟥🎯\nhttps://x/"
  );
});

test("challenge links round-trip and reject junk", () => {
  const h = "#" + G.encodeChallenge(7, [12, -340, 0, 905, -1]);
  assert.deepStrictEqual(G.decodeChallenge(h), { day: 7, errors: [12, -340, 0, 905, -1] });
  for (const bad of ["", "#", "#c=7.1.2.3", "#c=x.1.2.3.4.5", "#c=7.1.2.3.4.5.6", "#c=7.1.2.3.4.5<script>"])
    assert.strictEqual(G.decodeChallenge(bad), null, bad);
});
