// Namesake UI: name box, live planet, share link and postcard.
(function () {
  const W = window.World;
  const A = window.NSAnalytics;
  const $ = (id) => document.getElementById(id);
  const canvas = $("sky");
  const input = $("name");
  const compact = matchMedia("(max-height: 720px) and (max-width: 720px), (max-height: 500px)");
  const setSurvey = () => { $("survey").open = !compact.matches; };
  setSurvey();
  compact.addEventListener("change", setSurvey);
  const SHOWCASE = ["Hello", "Pizza", "Atlantis", "Saturday", "Grandma", "Builder", "Moonlight", "Banana"];

  let renderer = null;
  try { renderer = window.Planet.createRenderer(canvas); } catch (e) { console.error(e); }
  if (!renderer) { $("nogl").hidden = false; canvas.hidden = true; }
  // The surface shader compiles on the first landing, so the orbit view starts as fast as before.
  let surface = null;
  const getSurface = () => {
    if (!surface && renderer) { try { surface = window.Surface.createSurface(renderer.gl); } catch (e) { console.error(e); $("land").hidden = true; } }
    return surface;
  };
  if (renderer && window.Surface) $("land").hidden = false;

  const state = { world: null, time: 0, yaw: 0, userYaw: 0, pitch: 0.28, dist: 6, targetDist: 6, shift: 0, form: 0, formFrom: 0, formT: 1,
    mode: "orbit", fade: 1, lookYaw: 0, lookPitch: 0, focal: 1, landTime: 0 };
  // Separate resolutions: the surface raymarcher is much heavier than the orbit view.
  const scales = { orbit: Math.min(window.devicePixelRatio || 1, 1.5), land: Math.min(window.devicePixelRatio || 1, 1) };
  let scale = scales.orbit;
  const HQ = /[?&]hq\b/.test(location.search); // screenshots: never lower the resolution

  let zoom = 1;
  let view = null;
  function sceneRadius(world) {
    const r = world.render;
    return Math.max(1.12, r.ring ? r.ringOut : 0, ...r.moons.map((m) => m.orbit + m.radius));
  }
  function fitDist(world, halfSize = 0.42) {
    const radius = sceneRadius(world);
    return radius * Math.sqrt(1 + Math.pow(1.8 / Math.max(halfSize, 0.06), 2));
  }
  function layout() {
    const top = $("form").closest("header").getBoundingClientRect();
    const foot = document.querySelector("footer").getBoundingClientRect();
    const stacked = matchMedia("(max-width: 720px), (orientation: portrait)").matches;
    const panelBottom = innerHeight - foot.top + 12;
    $("card").style.setProperty("--card-bottom", panelBottom + "px");
    $("card").style.setProperty("--card-height", Math.max(100, (foot.top - top.bottom - 24) * (stacked ? 0.62 : 1)) + "px");
    const card = $("card").getBoundingClientRect();
    const left = stacked ? 14 : card.right + 22;
    const right = innerWidth - 14;
    const bottom = stacked ? card.top - 14 : foot.top - 14;
    const y = top.bottom + 10;
    const unit = Math.min(innerWidth, innerHeight);
    view = { left, right, top: y, bottom };
    state.shift = (innerHeight / 2 - (y + bottom) / 2) / unit;
    state.shiftX = ((left + right) / 2 - innerWidth / 2) / unit;
    state.fit = Math.max(0.06, Math.min(right - left, bottom - y) * 0.46 / unit);
    if (state.world) state.targetDist = fitDist(state.world, state.fit) * zoom;
  }
  function resize() {
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
    layout();
  }
  addEventListener("resize", resize);
  resize();

  new ResizeObserver(layout).observe($("card"));
  new ResizeObserver(layout).observe(document.querySelector("header"));

  function setWorld(name, { live = false, push = true } = {}) {
    const world = W.generate(name);
    const same = state.world && state.world.seed === world.seed && state.world.name.toLowerCase() === world.name.toLowerCase();
    state.world = world;
    if (!same) {
      state.formFrom = live ? 0.45 : 0;
      state.formT = 0;
      zoom = 1;
    }
    $("title").textContent = world.name;
    $("label").textContent = world.label;
    $("desig").textContent = world.designation;
    $("note").textContent = world.note;
    const facts = $("facts");
    facts.replaceChildren(...world.facts.map(([k, v]) => {
      const d = document.createElement("div");
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      if (k === "Moons" && Number(v) > 3) {
        const small = document.createElement("small"); small.textContent = "3 shown";
        dd.append(small);
      }
      d.append(dt, dd);
      return d;
    }));
    document.title = `${world.name} · Namesake`;
    if (push) setHash();
    $("status").textContent = "";
    if (state.mode === "land") { state.landTime = state.time; state.fade = Math.min(state.fade, 0.5); state.lookYaw = state.lookPitch = 0; }
    showMode();
    layout();
    if (!same && !live) state.dist = state.targetDist * 1.25;
  }

  function setHash() {
    history.replaceState(null, "", "#w=" + encodeURIComponent(state.world.name) + (state.mode === "land" ? "&land" : ""));
  }
  // Land: dive toward the planet, then fade up on its surface. Gas giants have no ground,
  // so you stand on their first moon instead.
  function moonName(world) { return world.name + " I"; }
  function showMode() {
    const landed = state.mode === "land", w = state.world;
    document.body.classList.toggle("landed", landed);
    $("land").textContent = landed ? "🛰️ Back to orbit" : w.kind === "gas" ? "🚀 Land on a moon" : "🚀 Land on this world";
    $("note").textContent = !landed ? w.note : w.kind === "gas"
      ? `A gas giant has no ground, so you're standing on its moon ${moonName(w)}.`
      : `You're standing on ${w.name}. Every world has its own sky.`;
    $("hint").textContent = landed ? "Drag to look around · scroll to zoom" : "Drag to spin · scroll to zoom";
  }
  function setMode(mode) {
    state.mode = mode;
    if (mode === "land") { state.fade = 0; state.landTime = state.time; state.lookYaw = state.lookPitch = 0; state.focal = 1; }
    if (mode === "orbit") { state.dist = 1.7; zoom = 1; layout(); }
    const next = mode === "land" ? scales.land : scales.orbit;
    if (next !== scale) { scale = next; resize(); }
    frames = slow = 0;
    setHash();
    showMode();
  }
  let diveT = 0;
  $("land").addEventListener("click", () => {
    if (state.mode === "orbit") {
      if (!getSurface()) return;
      state.mode = "diving"; diveT = 0; state.targetDist = 1.25;
      A.track("landed");
    } else if (state.mode === "land") setMode("orbit");
  });

  function nameFromHash() {
    const m = /[#&]w=([^&]*)/.exec(location.hash);
    if (!m) return "";
    try { return W.normalize(decodeURIComponent(m[1])); } catch (e) { return ""; }
  }

  // Typing reshapes the planet live.
  let typeTimer = 0;
  input.addEventListener("input", () => {
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => { if (W.normalize(input.value)) setWorld(input.value, { live: true }); }, 90);
  });
  input.addEventListener("change", () => { if (W.normalize(input.value)) A.track("world-named"); });
  $("form").addEventListener("submit", (e) => { e.preventDefault(); input.blur(); });
  $("surprise").addEventListener("click", () => {
    const n = W.randomName();
    input.value = n;
    setWorld(n);
    A.track("world-surprise");
  });
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.textContent === "your name") { input.value = ""; input.focus(); input.placeholder = "Type your name…"; return; }
    input.value = b.textContent;
    setWorld(b.textContent);
    A.track("chip-used");
  });
  addEventListener("hashchange", () => {
    const n = nameFromHash();
    if (n && (!state.world || n !== state.world.name)) { input.value = n; setWorld(n, { push: false }); }
    const land = /[#&]land\b/.test(location.hash);
    if (land && state.mode === "orbit" && getSurface()) setMode("land");
    else if (!land && state.mode === "land") setMode("orbit");
  });

  // Drag to spin, wheel or pinch to zoom.
  const pointers = new Map();
  let vel = 0, pinch = 0;
  let frames = 0, slow = 0;
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); vel = 0; });
  canvas.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch && before > 0 && after > 0) setZoom(zoom * before / after);
      pinch = 1;
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    const k = 3.2 / Math.min(innerWidth, innerHeight);
    if (state.mode === "land") {
      const kl = k * 0.45 / state.focal;
      state.lookYaw -= dx * kl; vel = -dx * kl;
      state.lookPitch = Math.max(-0.8, Math.min(1.1, state.lookPitch + dy * kl));
      return;
    }
    state.userYaw -= dx * k; vel = -dx * k;
    state.pitch = Math.max(-1.3, Math.min(1.3, state.pitch + dy * k));
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  function setZoom(value) {
    if (state.mode === "land") { state.focal = Math.max(0.7, Math.min(2.6, state.focal / value * zoom)); return; }
    zoom = Math.max(0.6, Math.min(2.5, value));
    layout();
  }
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); setZoom(zoom * Math.exp(e.deltaY * 0.0012)); }, { passive: false });

  // Share link.
  function link() { return location.origin + location.pathname + "#w=" + encodeURIComponent(state.world.name) + (state.mode === "land" ? "&land" : ""); }
  $("copy").addEventListener("click", async () => {
    const w = state.world;
    const text = state.mode === "land"
      ? `I'm standing on ${w.kind === "gas" ? "a moon of " : ""}a planet called ${w.name}. Look at this sky: ${link()}`
      : `I found a planet called ${w.name}. ${w.label}, ${w.note} ${link()}`;
    try { await navigator.clipboard.writeText(text); $("status").textContent = "Link copied. Paste it anywhere."; }
    catch (e) { window.prompt("Copy this link:", link()); }
    A.track("link-copied");
  });

  // Postcard: re-render at a fixed size, then draw the survey on top.
  function wrap(g, text, x, y, maxW, lh, draw = true) {
    let line = "";
    for (const word of text.split(" ")) {
      const t = line ? line + " " + word : word;
      if (g.measureText(t).width > maxW && line) { if (draw) g.fillText(line, x, y); y += lh; line = word; } else line = t;
    }
    if (line && draw) g.fillText(line, x, y);
    return y + lh;
  }
  function makePostcard() {
    const w = 1080, h = 1350;
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const g = out.getContext("2d");
    if (renderer) {
      const [cw, ch] = [canvas.width, canvas.height];
      canvas.width = w; canvas.height = h;
      const landed = state.mode === "land" && getSurface();
      if (landed) surface.draw({ ...state, fade: 1, lookPitch: state.lookPitch - 0.12 });
      else renderer.draw({ ...state, form: 1, shiftX: 0, shift: 0.19, dist: fitDist(state.world, 0.36) });
      g.drawImage(canvas, 0, 0);
      canvas.width = cw; canvas.height = ch;
      if (landed) surface.draw(state); else renderer.draw(state);
    } else { g.fillStyle = "#03040a"; g.fillRect(0, 0, w, h); }
    const grad = g.createLinearGradient(0, h - 620, 0, h);
    grad.addColorStop(0, "rgba(3,4,10,0)"); grad.addColorStop(0.35, "rgba(3,4,10,0.85)"); grad.addColorStop(1, "rgba(3,4,10,1)");
    g.fillStyle = grad; g.fillRect(0, h - 620, w, 620);
    const font = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    const wd = state.world;
    // Measure the note and facts first so long ones push the text block up, never into the footer.
    const note = $("note").textContent || wd.note;
    const facts = wd.facts.map(([k, v]) => `${k} ${v}`).join("   ·   ");
    g.font = `italic 36px ${font}`;
    let extra = wrap(g, note, 0, 0, w - 140, 46, false) - 46;
    g.font = `400 28px ${font}`;
    extra += wrap(g, facts, 0, 0, w - 140, 38, false) - 38;
    const lift = Math.max(0, extra - 46);
    g.translate(0, -lift);
    g.fillStyle = "#9aa3b8"; g.font = `500 30px ${font}`;
    const where = state.mode !== "land" ? wd.designation : wd.kind === "gas" ? "VIEW FROM ITS MOON" : "VIEW FROM THE SURFACE";
    g.fillText(`${wd.label.toUpperCase()}  ·  ${where}`, 70, h - 360);
    g.fillStyle = "#ffffff"; g.font = `700 88px ${font}`;
    g.fillText(wd.name, 70, h - 270, w - 140);
    g.fillStyle = "#cdd3e1"; g.font = `italic 36px ${font}`;
    let y = wrap(g, note, 70, h - 205, w - 140, 46);
    g.font = `400 28px ${font}`; g.fillStyle = "#e9ecf5";
    y = wrap(g, facts, 70, y + 10, w - 140, 38);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#6f7890"; g.font = `400 26px ${font}`;
    g.fillText("Every name is a world  ·  ramzyraz.github.io/builder", 70, h - 50);
    return out;
  }
  $("postcard").addEventListener("click", () => {
    const out = makePostcard();
    const fname = "namesake-" + state.world.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png";
    out.toBlob(async (blob) => {
      const file = new File([blob], fname || "namesake.png", { type: "image/png" });
      A.track("postcard-saved");
      if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
        try { await navigator.share({ files: [file], text: link() }); return; } catch (e) { if (e.name === "AbortError") return; }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fname || "namesake.png";
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      $("status").textContent = "Postcard saved.";
    }, "image/png");
  });

  // Animation loop with adaptive resolution for slower phones.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!document.hidden && renderer) {
      state.time += dt;
      state.formT = Math.min(1, state.formT + dt / 1.6);
      const e = 1 - Math.pow(1 - state.formT, 3);
      state.form = state.formFrom + (1 - state.formFrom) * e;
      if (state.mode === "diving") {
        diveT += dt;
        state.targetDist = 1.25;
        if (diveT > 0.9) setMode("land");
      }
      state.dist += (state.targetDist - state.dist) * Math.min(1, dt * 3);
      if (state.mode === "land") {
        state.fade = Math.min(1, state.fade + dt / 1.4);
        if (!pointers.size) { state.lookYaw += vel; vel *= 0.92; }
        surface.draw(state);
      } else {
        if (!pointers.size) { state.userYaw += vel; vel *= 0.94; }
        state.yaw = state.time * state.world.render.spin + state.userYaw;
        renderer.draw(state);
      }
      frames++;
      if (dt > 0.045) slow++;
      if (frames === 40) {
        const floor = state.mode === "land" ? 0.3 : 0.45;
        if (!HQ && slow > 25 && scale > floor) { scale *= 0.75; scales[state.mode === "land" ? "land" : "orbit"] = scale; resize(); }
        frames = 0; slow = 0;
      }
    }
    requestAnimationFrame(frame);
  }

  const initial = nameFromHash();
  if (initial) { input.value = initial; A.track("link-opened"); }
  setWorld(initial || SHOWCASE[Math.floor(Math.random() * SHOWCASE.length)], { push: !!initial });
  if (initial && /[#&]land\b/.test(location.hash) && getSurface()) setMode("land");
  requestAnimationFrame(frame);

  window.__namesake = { state, setWorld, makePostcard, layout, getView: () => view, sceneRadius, setMode };
})();
