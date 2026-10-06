// Namesake: turns any name into a planet. Pure logic, no DOM, so it can be tested in Node.
// The same name always gives the same world (case and spacing don't matter).
(function (root) {
  function normalize(name) {
    return String(name || "").trim().replace(/\s+/g, " ").slice(0, 40);
  }

  // FNV-1a, then mulberry32.
  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (const ch of s.toLowerCase()) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
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

  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)];
  }

  const KINDS = [
    { id: "terran", label: "Living world", w: 26 },
    { id: "ocean", label: "Ocean world", w: 12 },
    { id: "desert", label: "Desert world", w: 13 },
    { id: "ice", label: "Ice world", w: 11 },
    { id: "lava", label: "Lava world", w: 10 },
    { id: "gas", label: "Gas giant", w: 18 },
    { id: "alien", label: "Strange world", w: 10 },
  ];

  function pickKind(r) {
    const total = KINDS.reduce((s, k) => s + k.w, 0);
    let x = r() * total;
    for (const k of KINDS) { if ((x -= k.w) < 0) return k; }
    return KINDS[0];
  }

  // Six colours from deep water to peaks: deep, shallow, low, mid, high, snow.
  function palette(kind, r) {
    const j = (n) => (r() - 0.5) * n;
    switch (kind) {
      case "terran": return [hsl(215 + j(20), 0.7, 0.16), hsl(195 + j(20), 0.6, 0.35), hsl(95 + j(50), 0.45, 0.32),
        hsl(80 + j(60), 0.35, 0.28), hsl(30 + j(20), 0.2, 0.36), hsl(210, 0.15, 0.92)];
      case "ocean": return [hsl(220 + j(30), 0.75, 0.12), hsl(185 + j(30), 0.7, 0.38), hsl(50 + j(20), 0.5, 0.65),
        hsl(120 + j(60), 0.5, 0.3), hsl(100 + j(40), 0.3, 0.3), hsl(200, 0.2, 0.95)];
      case "desert": { const h = 25 + j(30); return [hsl(h, 0.5, 0.25), hsl(h + 5, 0.55, 0.38), hsl(h + 10, 0.6, 0.55),
        hsl(h, 0.55, 0.45), hsl(h - 10, 0.45, 0.32), hsl(h + 15, 0.4, 0.8)]; }
      case "ice": return [hsl(215 + j(20), 0.5, 0.2), hsl(200 + j(20), 0.5, 0.45), hsl(200 + j(20), 0.25, 0.75),
        hsl(210 + j(30), 0.2, 0.85), hsl(220 + j(20), 0.15, 0.7), hsl(200, 0.3, 0.98)];
      case "lava": return [hsl(10 + j(20), 0.2, 0.07), hsl(15 + j(20), 0.2, 0.1), hsl(20 + j(20), 0.12, 0.14),
        hsl(0, 0.05, 0.2), hsl(0, 0.04, 0.28), hsl(20 + j(30), 1, 0.55)];
      case "gas": { const h = r() * 360; const h2 = h + 25 + j(60);
        return [hsl(h, 0.45, 0.3), hsl(h2, 0.5, 0.55), hsl(h + 10, 0.35, 0.75), hsl(h2 + 20, 0.55, 0.42),
          hsl(h - 15, 0.4, 0.62), hsl(h + 180 + j(40), 0.6, 0.5)]; }
      default: { const h = r() * 360; const h2 = h + 120 + j(80);
        return [hsl(h, 0.7, 0.15), hsl(h + 20, 0.7, 0.4), hsl(h2, 0.6, 0.4), hsl(h2 + 30, 0.55, 0.3),
          hsl(h2 + 60, 0.4, 0.45), hsl(h + 180, 0.4, 0.88)]; }
    }
  }

  const NOTES = {
    terran: ["Forests here turn {c} every autumn.", "There are cities on the night side. Nobody has answered our signal yet.",
      "The rivers run uphill twice a year when the moons line up.", "Birdsong was recorded from orbit."],
    ocean: ["The tides are {n} metres high.", "Something enormous moves under the ice-free seas.",
      "There are only {n} islands, and each has its own weather.", "The waves glow {c} at night."],
    desert: ["The dunes sing at sunset, around 90 Hz.", "Sandstorms here last about {n} years.",
      "We found glass plains made by ancient lightning.", "It hasn't rained in {n} million years."],
    ice: ["The glaciers creak in a rhythm, like breathing.", "A frozen ocean lies {n} km under the ice.",
      "Snow falls upward near the poles.", "The ice is {c}-tinted and older than the Sun."],
    lava: ["The surface melts and reforms every {n} days.", "It rains molten glass on the night side.",
      "The volcanoes erupt in time with the tides.", "The rivers glow {c} and can be seen from three systems away."],
    gas: ["A storm bigger than Earth has raged for {n} centuries.", "Diamond hail falls through the deep clouds.",
      "Its winds reach {n}00 km/h at the equator.", "Floating microbes were detected in the {c} bands."],
    alien: ["The colours don't match anything in our catalogue.", "The ground is warm, faintly, everywhere.",
      "Instruments report a heartbeat every {n} hours.", "The atmosphere smells of {c} rain, the probe says."],
  };
  const COLOUR_WORDS = ["violet", "amber", "crimson", "teal", "silver", "gold", "rose", "cobalt", "emerald", "copper"];
  const GREEK = ["Alpha", "Beta", "Gamma", "Delta", "Tau", "Sigma", "Kappa", "Lyra", "Vega", "Orion"];

  function generate(rawName) {
    const name = normalize(rawName) || "Earth";
    const seed = hashString(name);
    const r = rng(seed);
    const kind = pickKind(r);
    const k = kind.id;
    const pal = palette(k, r);
    const rocky = k !== "gas";

    const sea = { terran: 0.45 + r() * 0.15, ocean: 0.68 + r() * 0.12, desert: r() < 0.5 ? 0 : 0.3,
      ice: 0.25 + r() * 0.2, lava: 0.42 + r() * 0.1, gas: 0, alien: 0.3 + r() * 0.3 }[k];
    const cloud = { terran: 0.35 + r() * 0.35, ocean: 0.45 + r() * 0.35, desert: r() * 0.15, ice: 0.2 + r() * 0.3,
      lava: 0.15 + r() * 0.25, gas: 0, alien: r() * 0.6 }[k];
    const ice = { terran: 0.72 + r() * 0.15, ocean: 0.8 + r() * 0.15, desert: 0.95 + r() * 0.1, ice: 0.5 + r() * 0.25,
      lava: 2, gas: 2, alien: 0.8 + r() * 0.3 }[k];
    const atmo = { terran: hsl(205, 0.8, 0.6), ocean: hsl(195, 0.8, 0.6), desert: hsl(30, 0.7, 0.6),
      ice: hsl(190, 0.5, 0.75), lava: hsl(15, 0.9, 0.5), gas: pal[4], alien: hsl(r() * 360, 0.8, 0.6) }[k];
    const cloudCol = k === "lava" ? [0.25, 0.22, 0.2] : k === "alien" ? hsl(r() * 360, 0.4, 0.85) : [1, 1, 1];
    const hasRing = k === "gas" ? r() < 0.6 : r() < 0.12;
    const ringIn = 1.3 + r() * 0.3;
    const ringOut = ringIn + 0.35 + r() * 0.6;
    const ringCol = k === "gas" ? pal[2] : hsl(30 + r() * 40, 0.25, 0.7);
    const cities = k === "terran" && r() < 0.55 ? 1 : 0;

    const radius = k === "gas" ? 4 + r() * 8 : 0.3 + r() * 1.9;
    const gravity = k === "gas" ? 1.1 + r() * 2 : radius * (0.7 + r() * 0.6);
    const day = k === "gas" ? 8 + r() * 10 : 6 + r() * 60;
    const year = Math.round(40 + r() * 900);
    const temp = { terran: 5 + r() * 25, ocean: 8 + r() * 22, desert: 35 + r() * 50, ice: -120 + r() * 90,
      lava: 600 + r() * 900, gas: -180 + r() * 80, alien: -40 + r() * 120 }[k];
    const moons = Math.floor(Math.pow(r(), 1.6) * (k === "gas" ? 80 : 5));
    const designation = `${GREEK[Math.floor(r() * GREEK.length)]}-${100 + Math.floor(r() * 9900)} ${"bcdefg"[Math.floor(r() * 6)]}`;
    const notes = NOTES[k];
    const note = notes[Math.floor(r() * notes.length)]
      .replace("{c}", COLOUR_WORDS[Math.floor(r() * COLOUR_WORDS.length)])
      .replace("{n}", String(2 + Math.floor(r() * 40)));

    return {
      name, seed, kind: k, label: kind.label, designation, note,
      render: {
        kind: k === "gas" ? 2 : k === "lava" ? 1 : 0,
        seed: [r() * 100, r() * 100, r() * 100],
        sea, cloud, ice, cities,
        rough: rocky ? 0.2 + r() * 0.8 : 0,
        scale: rocky ? 1.2 + r() * 1.8 : 1,
        bands: 6 + r() * 14,
        tilt: (r() - 0.5) * 0.9,
        spin: (0.04 + r() * 0.08) * (r() < 0.15 ? -1 : 1),
        pal, atmo, cloudCol,
        ring: hasRing ? 1 : 0, ringIn, ringOut, ringCol,
      },
      facts: [
        ["Radius", `${radius.toFixed(2)} × Earth`],
        ["Gravity", `${gravity.toFixed(2)} g`],
        ["Day", `${day.toFixed(1)} h`],
        ["Year", `${year} days`],
        ["Surface", `${Math.round(temp)} °C`],
        ["Moons", String(moons)],
      ],
    };
  }

  // Pronounceable random names for "Surprise me".
  function randomName(r = Math.random) {
    const on = ["k", "v", "t", "s", "m", "n", "l", "r", "z", "th", "dr", "qu", "b", "x", "", "ph", "c"];
    const nu = ["a", "e", "i", "o", "u", "ae", "io", "y", "ea"];
    let s = "";
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) s += on[Math.floor(r() * on.length)] + nu[Math.floor(r() * nu.length)];
    if (r() < 0.5) s += ["n", "s", "r", "x", "th", "l"][Math.floor(r() * 6)];
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const api = { normalize, hashString, rng, generate, randomName, KINDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.World = api;
})(typeof window !== "undefined" ? window : globalThis);
