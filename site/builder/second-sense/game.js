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

  // 0 (🎯 within 50 ms) to 4 (🟥 more than 0.7s off).
  const GRADES = ["🎯", "🟩", "🟨", "🟧", "🟥"];
  function level(errorMs) {
    const e = Math.abs(errorMs);
    return [50, 150, 350, 700, Infinity].findIndex((max) => e <= max);
  }
  function grade(errorMs) {
    return GRADES[level(errorMs)];
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

  function shareText(day, errors, url, streakDays) {
    const t = total(errors);
    return [
      `Second Sense #${day}: off by ${fmt(t)} total (${title(t)})`,
      errors.map(grade).join("") + (streakDays > 1 ? ` 🔥${streakDays}` : ""),
      url,
    ].join("\n");
  }

  // Replies also carry the original dare, so both scores survive a different device.
  function encodeChallenge(day, errors, replyTo) {
    const score = (values) => values.map((e) => Math.round(e)).join(".");
    return "c=" + day + "." + score(errors) + (replyTo ? "&r=" + score(replyTo) : "");
  }

  function decodeChallenge(hash) {
    const m = /^#?c=(\d{1,5})((?:\.-?\d{1,6}){5})(?:&r=(-?\d{1,6}(?:\.-?\d{1,6}){4}))?$/.exec(hash || "");
    if (!m) return null;
    const errors = m[2].slice(1).split(".").map(Number);
    const challenge = { day: Number(m[1]), errors };
    if (m[3]) challenge.replyTo = m[3].split(".").map(Number);
    return challenge;
  }

  // Consecutive days played, ending today (or yesterday, if today isn't played yet).
  function streak(today, played) {
    let d = played(today) ? today : today - 1, n = 0;
    while (d > 0 && played(d)) { n++; d--; }
    return n;
  }

  // Do you rush or drag? Based on the average signed error.
  function tendency(errors) {
    const avg = errors.reduce((s, e) => s + e, 0) / errors.length;
    if (Math.abs(avg) < 100) return "No lean either way: your early and late misses cancel out.";
    return avg < 0
      ? `Your inner clock runs fast: you stop ${fmt(-avg)} early on average.`
      : `Your inner clock runs slow: you stop ${fmt(avg)} late on average.`;
  }

  // "4h 12m" until the next local midnight.
  function untilTomorrow(now) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(1, Math.ceil((next - now) / 60000));
    return Math.floor(mins / 60) + "h " + (mins % 60) + "m";
  }

  const api = { ROUNDS, level, streak, tendency, untilTomorrow, VISIBLE_MS, dayNumber, targets, grade, title, fmt, total, shareText, encodeChallenge, decodeChallenge };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Game = api;
})(this);
