// UI for Tabby. State lives in location.hash (shareable) and localStorage (backup).
(function () {
  const S = window.Settle;
  const $ = (id) => document.getElementById(id);
  const STORE = "tabby:last";

  let state = load();

  function empty() {
    return { title: "", currency: "$", people: [], expenses: [] };
  }

  function load() {
    const fromHash = S.decode(location.hash.slice(1));
    if (fromHash) return fromHash;
    return S.decode(localStorage.getItem(STORE) || "") || empty();
  }

  function save() {
    const code = S.encode(state);
    history.replaceState(null, "", "#" + code);
    try { localStorage.setItem(STORE, code); } catch (e) { /* private mode */ }
  }

  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    Object.assign(n, props || {});
    kids.forEach((k) => n.append(k));
    return n;
  }

  function render() {
    const cur = state.currency;
    $("title").value = state.title;
    $("currency").value = cur;
    document.title = (state.title ? state.title + " · " : "") + "Tabby";

    // People
    const people = $("people");
    people.replaceChildren(...state.people.map((name, i) => {
      const x = el("button", { className: "x", title: "Remove " + name, textContent: "×" });
      x.onclick = () => removePerson(i);
      return el("li", {}, name, x);
    }));

    // Expense form
    const enough = state.people.length >= 2;
    $("expense-card").classList.toggle("disabled", !enough);
    $("payer").replaceChildren(...state.people.map((name, i) => el("option", { value: i, textContent: name })));
    $("among").replaceChildren(...state.people.map((name, i) => {
      const box = el("input", { type: "checkbox", checked: true, value: i });
      return el("label", { className: "check" }, box, " " + name);
    }));
    if (!enough) {
      $("among").replaceChildren(el("em", { textContent: "add at least two people first" }));
    }

    // Expense list, newest first
    const exps = state.expenses.map((e, i) => ({ e, i })).reverse();
    $("expenses").replaceChildren(...exps.map(({ e, i }) => {
      const who = e.among.length === state.people.length ? "everyone" : e.among.map((k) => state.people[k]).join(", ");
      const x = el("button", { className: "x", title: "Delete", textContent: "×" });
      x.onclick = () => { state.expenses.splice(i, 1); save(); render(); };
      return el("li", {},
        el("span", { className: "what", textContent: e.what }),
        el("span", { className: "meta", textContent: `${state.people[e.payer]} paid ${S.fmt(e.amount, cur)} · split: ${who}` }),
        x);
    }));

    // Results
    const net = S.balances(state);
    const moves = S.transfers(net);
    const total = state.expenses.reduce((s, e) => s + e.amount, 0);
    if (!state.expenses.length) {
      $("transfers").replaceChildren(el("li", { className: "muted", textContent: "Add an expense to see who owes whom." }));
    } else if (!moves.length) {
      $("transfers").replaceChildren(el("li", { textContent: "Everyone is square. 🎉" }));
    } else {
      $("transfers").replaceChildren(...moves.map((m) => el("li", { className: "move" },
        el("strong", { textContent: state.people[m.from] }), " pays ",
        el("strong", { textContent: state.people[m.to] }), " ",
        el("span", { className: "amt", textContent: S.fmt(m.amount, cur) }))));
    }
    $("balances").replaceChildren(
      ...state.people.map((name, i) => el("li", {
        textContent: `${name}: ${net[i] > 0 ? "is owed " + S.fmt(net[i], cur) : net[i] < 0 ? "owes " + S.fmt(-net[i], cur) : "square"}`,
      })),
      el("li", { className: "muted", textContent: `Total spent: ${S.fmt(total, cur)}` }),
    );
  }

  function removePerson(i) {
    const name = state.people[i];
    const used = state.expenses.some((e) => e.payer === i || e.among.includes(i));
    if (used && !confirm(`${name} is part of some expenses. Remove them anyway? Expenses they paid will be deleted, and they'll be dropped from splits.`)) return;
    state.expenses = state.expenses
      .filter((e) => e.payer !== i)
      .map((e) => ({ ...e, among: e.among.filter((k) => k !== i) }))
      .filter((e) => e.among.length)
      .map((e) => ({
        ...e,
        payer: e.payer > i ? e.payer - 1 : e.payer,
        among: e.among.map((k) => (k > i ? k - 1 : k)),
      }));
    state.people.splice(i, 1);
    save(); render();
  }

  $("add-person").onsubmit = (ev) => {
    ev.preventDefault();
    const name = $("person-name").value.trim();
    if (!name) return;
    if (state.people.includes(name)) { $("person-name").select(); return; }
    state.people.push(name);
    $("person-name").value = "";
    save(); render();
    $("person-name").focus();
  };

  $("add-expense").onsubmit = (ev) => {
    ev.preventDefault();
    const err = $("expense-error");
    const amount = S.parseAmount($("amount").value);
    const among = [...$("among").querySelectorAll("input:checked")].map((b) => Number(b.value));
    let msg = "";
    if (state.people.length < 2) msg = "Add at least two people first.";
    else if (!(amount > 0)) msg = "Amount should be a number like 42.50.";
    else if (!among.length) msg = "Pick at least one person to split with.";
    err.hidden = !msg;
    err.textContent = msg;
    if (msg) return;
    state.expenses.push({ what: $("what").value.trim(), amount, payer: Number($("payer").value), among });
    $("what").value = "";
    $("amount").value = "";
    save(); render();
    $("what").focus();
  };

  $("title").oninput = () => { state.title = $("title").value; save(); document.title = state.title + " · Tabby"; };
  $("currency").onchange = () => { state.currency = $("currency").value.trim() || "$"; save(); render(); };

  function flash(text) {
    $("copied").textContent = text;
    $("copied").hidden = false;
    setTimeout(() => ($("copied").hidden = true), 2500);
  }

  async function copy(text, okMsg) {
    try { await navigator.clipboard.writeText(text); flash(okMsg); }
    catch (e) { prompt("Copy this:", text); }
  }

  $("copy-link").onclick = () => { save(); copy(location.href, "Link copied. Paste it in the group chat."); };

  $("copy-summary").onclick = () => {
    save();
    const cur = state.currency;
    const moves = S.transfers(S.balances(state));
    const total = state.expenses.reduce((s, e) => s + e.amount, 0);
    const lines = [
      `${state.title || "Our trip"}: ${S.fmt(total, cur)} total`,
      ...(moves.length
        ? moves.map((m) => `• ${state.people[m.from]} → ${state.people[m.to]}: ${S.fmt(m.amount, cur)}`)
        : ["Everyone is square."]),
      `Details: ${location.href}`,
    ];
    copy(lines.join("\n"), "Summary copied.");
  };

  $("reset").onclick = () => {
    if (!confirm("Start a new, empty tab? (Keep the current link if you want to come back to this one.)")) return;
    state = empty();
    save(); render();
  };

  window.addEventListener("hashchange", () => { state = load(); render(); });

  render();
})();
