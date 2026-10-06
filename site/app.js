// Namesake UI: name box, live planet, share link and postcard.
(function () {
  const W = window.World;
  const A = window.NSAnalytics;
  const $ = (id) => document.getElementById(id);
  const canvas = $("sky");
  const input = $("name");
  const SHOWCASE = ["Hello", "Pizza", "Atlantis", "Saturday", "Grandma", "Builder", "Moonlight", "Banana"];

  let renderer = null;
  try { renderer = window.Planet.createRenderer(canvas); } catch (e) { console.error(e); }
  if (!renderer) { $("nogl").hidden = false; canvas.hidden = true; }

  const state = { world: null, time: 0, yaw: 0, userYaw: 0, pitch: 0.28, dist: 6, targetDist: 6, shift: 0, form: 0, formFrom: 0, formT: 1 };
  let scale = Math.min(window.devicePixelRatio || 1, 1.5);
  const HQ = /[?&]hq\b/.test(location.search); // screenshots: never lower the resolution

  function portrait() { return innerHeight > innerWidth; }
  function resize() {
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
    state.shift = portrait() ? 0.2 : 0;
  }
  addEventListener("resize", resize);
  resize();

  function baseDist(world) {
    const r = world.render;
    return Math.max(5.3, r.ring ? r.ringOut / 0.24 : 0);
  }

  function setWorld(name, { live = false, push = true } = {}) {
    const world = W.generate(name);
    const same = state.world && state.world.seed === world.seed && state.world.name.toLowerCase() === world.name.toLowerCase();
    state.world = world;
    if (!same) {
      state.formFrom = live ? 0.45 : 0;
      state.formT = 0;
      state.targetDist = baseDist(world);
      if (!live) state.dist = state.targetDist * 1.25;
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
      d.append(dt, dd);
      return d;
    }));
    document.title = `${world.name} · Namesake`;
    if (push) history.replaceState(null, "", "#w=" + encodeURIComponent(world.name));
    $("status").textContent = "";
  }

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
  });

  // Drag to spin, wheel or pinch to zoom.
  const pointers = new Map();
  let vel = 0, pinch = 0;
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); vel = 0; });
  canvas.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch && before > 0) state.targetDist = clampDist(state.targetDist * before / after);
      pinch = 1;
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    const k = 3.2 / Math.min(innerWidth, innerHeight);
    state.userYaw -= dx * k; vel = -dx * k;
    state.pitch = Math.max(-1.3, Math.min(1.3, state.pitch + dy * k));
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  function clampDist(d) { return Math.max(1.9, Math.min(24, d)); }
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); state.targetDist = clampDist(state.targetDist * Math.exp(e.deltaY * 0.0012)); }, { passive: false });

  // Share link.
  function link() { return location.origin + location.pathname + "#w=" + encodeURIComponent(state.world.name); }
  $("copy").addEventListener("click", async () => {
    const text = `I found a planet called ${state.world.name}. ${state.world.label}, ${state.world.note} ${link()}`;
    try { await navigator.clipboard.writeText(text); $("status").textContent = "Link copied. Paste it anywhere."; }
    catch (e) { window.prompt("Copy this link:", link()); }
    A.track("link-copied");
  });

  // Postcard: re-render at a fixed size, then draw the survey on top.
  function wrap(g, text, x, y, maxW, lh) {
    let line = "";
    for (const word of text.split(" ")) {
      const t = line ? line + " " + word : word;
      if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = word; } else line = t;
    }
    if (line) g.fillText(line, x, y);
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
      renderer.draw({ ...state, form: 1, shift: 0.15, dist: baseDist(state.world) });
      g.drawImage(canvas, 0, 0);
      canvas.width = cw; canvas.height = ch;
    } else { g.fillStyle = "#03040a"; g.fillRect(0, 0, w, h); }
    const grad = g.createLinearGradient(0, h - 520, 0, h);
    grad.addColorStop(0, "rgba(3,4,10,0)"); grad.addColorStop(0.35, "rgba(3,4,10,0.85)"); grad.addColorStop(1, "rgba(3,4,10,1)");
    g.fillStyle = grad; g.fillRect(0, h - 520, w, 520);
    const font = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    const wd = state.world;
    g.fillStyle = "#9aa3b8"; g.font = `500 30px ${font}`;
    g.fillText(`${wd.label.toUpperCase()}  ·  ${wd.designation}`, 70, h - 360);
    g.fillStyle = "#ffffff"; g.font = `700 88px ${font}`;
    g.fillText(wd.name, 70, h - 270, w - 140);
    g.fillStyle = "#cdd3e1"; g.font = `italic 36px ${font}`;
    let y = wrap(g, wd.note, 70, h - 205, w - 140, 46);
    g.font = `400 28px ${font}`; g.fillStyle = "#e9ecf5";
    const facts = wd.facts.map(([k, v]) => `${k} ${v}`).join("   ·   ");
    y = wrap(g, facts, 70, y + 10, w - 140, 38);
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
  let last = performance.now(), slow = 0, frames = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!document.hidden && renderer) {
      state.time += dt;
      state.formT = Math.min(1, state.formT + dt / 1.6);
      const e = 1 - Math.pow(1 - state.formT, 3);
      state.form = state.formFrom + (1 - state.formFrom) * e;
      state.dist += (state.targetDist - state.dist) * Math.min(1, dt * 3);
      if (!pointers.size) { state.userYaw += vel; vel *= 0.94; }
      state.yaw = state.time * state.world.render.spin + state.userYaw;
      renderer.draw(state);
      frames++;
      if (dt > 0.045) slow++;
      if (frames === 40) {
        if (!HQ && slow > 25 && scale > 0.45) { scale *= 0.75; resize(); }
        frames = 0; slow = 0;
      }
    }
    requestAnimationFrame(frame);
  }

  const initial = nameFromHash();
  if (initial) { input.value = initial; A.track("link-opened"); }
  setWorld(initial || SHOWCASE[Math.floor(Math.random() * SHOWCASE.length)], { push: !!initial });
  requestAnimationFrame(frame);

  window.__namesake = { state, setWorld, makePostcard };
})();
