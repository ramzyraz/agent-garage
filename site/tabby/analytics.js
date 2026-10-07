// Only fixed usage labels leave Tabby; never send the tab or the page title.
(function () {
  const events = new Set([
    "expense-added",
    "populated-link-copied",
    "populated-summary-copied",
    "shared-tab-opened",
    "example-opened",
  ]);
  const pending = [];
  let ready = false;

  function send(name) {
    try {
      window.goatcounter.count({ path: name, title: "Tabby", referrer: "", event: true });
    } catch (e) { /* Analytics must never interrupt the tab. */ }
  }

  window.TabbyAnalytics = {
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
    no_onload: true, path: "/agent-garage/tabby/", title: "Tabby", referrer: "",
  });
  script.addEventListener("load", () => {
    try {
      const gc = window.goatcounter;
      // count.js also sends location.search separately as `q`. Remove it before
      // the first request, even though our ledger normally lives in the hash.
      const getData = gc.get_data;
      gc.get_data = function (vars) {
        const data = getData(vars);
        delete data.q;
        return data;
      };
      gc.count();
      ready = true;
      pending.splice(0).forEach(send);
    } catch (e) { /* A blocked counter leaves the product fully usable. */ }
  });
  document.head.append(script);
})();
