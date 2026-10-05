// Second Sense: pure game logic (no DOM). Works in the browser and in Node tests.
(function (root) {
  const ROUNDS = 5;
  const VISIBLE_MS = 1000; // the clock is shown for the first second, then you're blind
  const EPOCH = Date.UTC(2026, 9, 5); // puzzle #1 = 5 Oct 2026
  // Each round gets a little longer, so the blind part grows.
  const RANGES = [[1.5, 3], [2.5, 4.5], [3.5, 6], [5, 8], [6.5, 10]];

  // Puzzle number for a date, using the player's local calendar day.
  function dayNumber(date) {
    const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.floor((local - EPOCH) / 86400000) + 1;
  }

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Targets in milliseconds, rounded to 10 ms so they display as e.g. 4.37s.
  function targets(seed) {
    const r = rng(seed * 2654435761);
    return RANGES.map(([lo, hi]) => Math.round((lo + r() * (hi - lo)) * 100) * 10);
  }

  function grade(errorMs) {
    const e = Math.abs(errorMs);
    if (e <= 50) return "🎯";
    if (e <= 150) return "🟩";
    if (e <= 350) return "🟨";
    if (e <= 700) return "🟧";
    return "🟥";
  }

  const TITLES = [
    [250, "Atomic clock"],
    [600, "Metronome"],
    [1200, "Swiss watch"],
    [2000, "Kitchen timer"],
    [3500, "Sundial"],
    [Infinity, "Goldfish"],
  ];
  function title(totalMs) {
    return TITLES.find(([max]) => totalMs <= max)[1];
  }

  function fmt(ms) {
    return (ms / 1000).toFixed(2) + "s";
  }

  function total(errors) {
    return errors.reduce((s, e) => s + Math.abs(e), 0);
  }

  function shareText(day, errors, url) {
    const t = total(errors);
    return [
      `Second Sense #${day}: off by ${fmt(t)} total (${title(t)})`,
      errors.map(grade).join(""),
      url,
    ].join("\n");
  }

  // Challenge links carry only the puzzle number and each round's error (in ms).
  function encodeChallenge(day, errors) {
    return "c=" + day + "." + errors.map((e) => Math.round(e)).join(".");
  }

  function decodeChallenge(hash) {
    const m = /^#?c=(\d{1,5})((?:\.-?\d{1,6}){5})$/.exec(hash || "");
    if (!m) return null;
    const errors = m[2].slice(1).split(".").map(Number);
    return { day: Number(m[1]), errors };
  }

  const api = { ROUNDS, VISIBLE_MS, dayNumber, targets, grade, title, fmt, total, shareText, encodeChallenge, decodeChallenge };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Game = api;
})(this);
