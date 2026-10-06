const test = require("node:test");
const assert = require("node:assert");
const G = require("../../../site/builder/second-sense/game.js");

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

test("reply links preserve both scores and reject incomplete or extra data", () => {
  const errors = [12, -340, 0, 905, -1], original = [-50, 60, 0, -70, 800];
  const hash = "#" + G.encodeChallenge(7, errors, original);
  assert.deepStrictEqual(G.decodeChallenge(hash), { day: 7, errors, replyTo: original });
  assert.deepStrictEqual(G.decodeChallenge(G.encodeChallenge(7, errors, original)), G.decodeChallenge(hash));
  for (const tail of ["", "1.2.3.4", "1.2.3.4.5.6", "1.2.3.4.x", "1.2.3.4.1000000", "1.2.3.4.5&r=1.2.3.4.5", "1.2.3.4.5<script>"])
    assert.strictEqual(G.decodeChallenge("#" + G.encodeChallenge(7, errors) + "&r=" + tail), null, tail);
  assert.deepStrictEqual(G.decodeChallenge("#" + G.encodeChallenge(7, [1.6, -2.8, 0, 4, 5], original)).errors, [2, -3, 0, 4, 5]);
});

test("streaks, tendency, countdown and streak in share text", () => {
  const days = new Set([3, 4, 5, 7]);
  const played = (d) => days.has(d);
  assert.strictEqual(G.streak(5, played), 3);
  assert.strictEqual(G.streak(6, played), 3); // today not played yet: yesterday's streak still counts
  assert.strictEqual(G.streak(7, played), 1);
  assert.strictEqual(G.streak(9, played), 0);
  assert.deepStrictEqual([0, 50, -51, 150, 351, -700, 701].map(G.level), [0, 0, 1, 1, 3, 3, 4]);
  assert.match(G.tendency([-300, -200, -100, 0, 100]), /runs fast: you stop 0\.10s early/);
  assert.match(G.tendency([500, 400, 0, 0, 100]), /runs slow: you stop 0\.20s late/);
  assert.match(G.tendency([90, -90, 0, 50, -40]), /cancel out/);
  assert.strictEqual(G.untilTomorrow(new Date(2026, 9, 6, 19, 47, 30)), "4h 13m");
  assert.strictEqual(G.untilTomorrow(new Date(2026, 9, 6, 23, 59, 59)), "0h 1m");
  assert.match(G.shareText(3, [0, 0, 0, 0, 0], "u", 4), /🎯🎯🎯🎯🎯 🔥4\nu$/);
  assert.match(G.shareText(3, [0, 0, 0, 0, 0], "u", 1), /🎯🎯🎯🎯🎯\nu$/);
});
