// Only fixed usage labels leave Second Sense; never scores, links or referrers.
(function () {
  const events = new Set([
    "daily-started",
    "daily-finished",
    "result-shared",
    "challenge-copied",
    "challenge-opened",
    "practice-started",
  ]);
  const pending = [];
  let ready = false;

  function send(name) {
    try {
      window.goatcounter.count({ path: name, title: "Second Sense", referrer: "", event: true });
    } catch (e) { /* Analytics must never interrupt the game. */ }
  }

  window.SSAnalytics = {
    track(name) {
      if (!events.has(name)) return;
      if (ready) send(name);
      else if (pending.length < 20) pending.push(name);
    },
  };

  // Local development and browser checks must not appear as real users.
  if (location.hostname !== "ramzyraz.github.io") return;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://gc.zgo.at/count.js";
  script.dataset.goatcounter = "https://ramzyraz.goatcounter.com/count";
  script.dataset.goatcounterSettings = JSON.stringify({
    no_onload: true, path: "/agent-garage/second-sense/", title: "Second Sense", referrer: "",
  });
  script.addEventListener("load", () => {
    try {
      const gc = window.goatcounter;
      const getData = gc.get_data;
      gc.get_data = function (vars) {
        const data = getData(vars);
        delete data.q; // count.js sends location.search separately; drop it
        return data;
      };
      gc.count();
      ready = true;
      pending.splice(0).forEach(send);
    } catch (e) { /* A blocked counter leaves the game fully playable. */ }
  });
  document.head.append(script);
})();
