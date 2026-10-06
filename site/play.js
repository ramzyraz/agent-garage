// Second Sense: UI. Game rules live in game.js.
(function () {
  const G = window.Game;
  const $ = (id) => document.getElementById(id);
  const track = (name) => window.SSAnalytics?.track(name);
  const today = G.dayNumber(new Date());
  const BASE = location.origin + location.pathname;
  const played = (d) => { try { return !!localStorage.getItem("ss-day-" + d); } catch (e) { return false; } };
  const saved = () => { try { return JSON.parse(localStorage.getItem("ss-day-" + today)); } catch (e) { return null; } };

  const challenge = G.decodeChallenge(location.hash);
  let game = null; // { daily, targets, errors, round, phase, start, raf }

  $("daylabel").textContent = "· Puzzle #" + today;

  function show(id) {
    for (const s of ["intro", "round", "result"]) $(s).hidden = s !== id;
  }

  // ---- Intro ----
  if (challenge) {
    track("challenge-opened");
    const t = G.total(challenge.errors);
    const same = challenge.day === today;
    $("challenge").hidden = false;
    $("challenge").innerHTML =
      `<b>You've been dared.</b> A friend was off by <b>${G.fmt(t)}</b> in total ` +
      `(${G.title(t)}) ${challenge.errors.map(G.grade).join("")} on puzzle #${challenge.day}.` +
      (same ? " Same targets for you. Can you beat it?" : " Today's targets are different, but try to beat that score.");
  }
  if (saved()) {
    $("play").textContent = "See today's result";
  }

  $("play").addEventListener("click", () => {
    const prev = saved();
    if (prev) return showResult({ daily: true, targets: G.targets(today), errors: prev });
    track("daily-started");
    startGame(true, G.targets(today));
  });
  $("practice").addEventListener("click", startPractice);
  $("again").addEventListener("click", startPractice);

  function startPractice() {
    track("practice-started");
    startGame(false, G.targets(Math.floor(Math.random() * 1e9)));
  }

  // ---- Rounds ----
  function startGame(daily, targets) {
    game = { daily, targets, errors: [], round: 0 };
    show("round");
    setupRound();
  }

  function setupRound() {
    game.phase = "ready";
    $("roundno").textContent = `Round ${game.round + 1}/${G.ROUNDS}`;
    $("target").textContent = G.fmt(game.targets[game.round]);
    $("clock").textContent = "0.00";
    $("clock").className = "clock";
    $("hint").textContent = "Tap to start";
    $("verdict").textContent = "";
    $("next").hidden = true;
    $("pad").disabled = false;
    $("pad").focus({ preventScroll: true });
  }

  function tick() {
    const ms = performance.now() - game.start;
    if (ms < G.VISIBLE_MS) {
      $("clock").textContent = (ms / 1000).toFixed(2);
    } else if (!$("clock").classList.contains("blind")) {
      $("clock").textContent = "?.??";
      $("clock").classList.add("blind");
    }
    game.raf = requestAnimationFrame(tick);
  }

  function press(at) {
    if (!game || $("round").hidden) return;
    if (game.phase === "ready") {
      game.phase = "running";
      game.start = at;
      $("hint").textContent = "Tap to stop";
      game.raf = requestAnimationFrame(tick);
    } else if (game.phase === "running") {
      cancelAnimationFrame(game.raf);
      const elapsed = at - game.start;
      const target = game.targets[game.round];
      const err = Math.round(elapsed - target);
      game.errors.push(err);
      game.phase = "done";
      $("pad").disabled = true;
      $("clock").textContent = (elapsed / 1000).toFixed(2);
      $("clock").className = "clock reveal";
      $("hint").textContent = "";
      const how = Math.abs(err) <= 5 ? "dead on!" : G.fmt(Math.abs(err)) + (err < 0 ? " early" : " late");
      $("verdict").textContent = `${G.grade(err)} ${how}`;
      game.round++;
      $("next").textContent = game.round < G.ROUNDS ? "Next round" : "See result";
      $("next").hidden = false;
      $("next").focus({ preventScroll: true });
    }
  }

  // pointerdown fires sooner than click, which matters when 50 ms is the difference.
  $("pad").addEventListener("pointerdown", (e) => { e.preventDefault(); press(performance.now()); });
  document.addEventListener("keydown", (e) => {
    if (e.repeat || $("round").hidden) return;
    if ((e.code === "Space" || e.code === "Enter") && game && game.phase !== "done") {
      e.preventDefault();
      press(performance.now());
    } else if ((e.code === "Space" || e.code === "Enter") && game?.phase === "done" && document.activeElement !== $("next")) {
      e.preventDefault();
      $("next").click();
    }
  });
  $("next").addEventListener("click", () => {
    if (game.round < G.ROUNDS) return setupRound();
    if (game.daily) {
      try { localStorage.setItem("ss-day-" + today, JSON.stringify(game.errors)); } catch (e) {}
      track("daily-finished");
    }
    showResult(game);
  });

  // ---- Result ----
  let current = null;
  function showResult(g) {
    current = g;
    show("result");
    const t = G.total(g.errors);
    $("resultlabel").textContent = g.daily ? `Puzzle #${today}` : "Practice round (not today's puzzle)";
    $("rank").textContent = G.title(t);
    $("emojis").textContent = g.errors.map(G.grade).join("");
    $("total").textContent = G.fmt(t);
    $("tendency").textContent = G.tendency(g.errors);
    drawTimeline(g);
    $("rounds").innerHTML = "<tr><th>Target</th><th>You</th><th>Off</th></tr>" + g.targets.map((tg, i) => {
      const e = g.errors[i];
      return `<tr><td>${G.fmt(tg)}</td><td>${G.fmt(tg + e)}</td><td>${G.grade(e)} ${e < 0 ? "−" : "+"}${G.fmt(Math.abs(e))}</td></tr>`;
    }).join("");
    $("shareactions").hidden = !g.daily;
    $("copied").textContent = "";
    if (challenge && g.daily) {
      const mine = t, theirs = G.total(challenge.errors);
      $("versus").hidden = false;
      $("versus").textContent = mine < theirs
        ? `You beat your friend by ${G.fmt(theirs - mine)}. Send it back to them.`
        : mine === theirs ? "Exact tie with your friend. Spooky."
        : `Your friend wins by ${G.fmt(mine - theirs)}. Practice, then try again tomorrow.`;
    } else $("versus").hidden = true;
    const s = g.daily ? G.streak(today, played) : 0;
    $("streak").hidden = s < 2;
    $("streak").textContent = `🔥 ${s}-day streak`;
    clearInterval(countdown);
    const tickDown = () => { $("comeback").textContent = `Next puzzle in ${G.untilTomorrow(new Date())}.`; };
    if (g.daily) { tickDown(); countdown = setInterval(tickDown, 30000); } else $("comeback").textContent = "";
  }
  let countdown = null;

  // One row per round: the target is the centre line, the dot is where you stopped.
  const SPAN = 1000; // ms shown either side of the target; bigger misses pin to the edge
  function drawTimeline(g) {
    $("timeline").innerHTML = g.targets.map((tg, i) => {
      const e = g.errors[i];
      const x = 50 + 50 * Math.max(-1, Math.min(1, e / SPAN));
      const off = Math.abs(e) > SPAN ? " off" : "";
      const label = `Round ${i + 1}: target ${G.fmt(tg)}, ${Math.abs(e) <= 5 ? "dead on" : G.fmt(Math.abs(e)) + (e < 0 ? " early" : " late")}`;
      return `<div class="tl-row" title="${label}"><span class="tl-t">${G.fmt(tg)}</span>` +
        `<span class="tl-track"><span class="tl-dot g${G.level(e)}${off}" style="left:${x.toFixed(1)}%"></span></span></div>`;
    }).join("") + `<div class="tl-axis"><span>← early</span><span>target</span><span>late →</span></div>`;
  }

  async function copy(text, okMsg) {
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text });
        $("copied").textContent = "Shared!";
        return true;
      }
      await navigator.clipboard.writeText(text);
      $("copied").textContent = okMsg;
      return true;
    } catch (e) {
      if (e && e.name === "AbortError") return false; // user closed the share sheet
      window.prompt("Copy this:", text);
      return false;
    }
  }

  $("share").addEventListener("click", async () => {
    if (await copy(G.shareText(today, current.errors, BASE, G.streak(today, played)), "Copied! Paste it in the group chat.")) track("result-shared");
  });
  $("dare").addEventListener("click", async () => {
    const t = G.total(current.errors);
    const link = BASE + "#" + G.encodeChallenge(today, current.errors);
    const text = `I was off by ${G.fmt(t)} on today's Second Sense ${current.errors.map(G.grade).join("")}. Beat that:\n${link}`;
    if (await copy(text, "Dare copied! Send it to someone.")) track("challenge-copied");
  });
})();
