// Pure logic, shared by the page and the tests. No DOM here.
// Amounts are always integer cents.

(function (root) {
  // Split `cents` among `n` people as evenly as possible.
  // The first (cents % n) people pay one extra cent.
  function splitEven(cents, n) {
    const base = Math.floor(cents / n);
    const extra = cents - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
  }

  // state: { people: [name], expenses: [{ what, amount, payer, among: [index] }] }
  // Returns net balance per person: positive = is owed money, negative = owes.
  function balances(state) {
    const net = state.people.map(() => 0);
    for (const e of state.expenses) {
      const among = e.among.filter((i) => i >= 0 && i < state.people.length);
      if (!among.length || !(e.amount > 0)) continue;
      net[e.payer] += e.amount;
      splitEven(e.amount, among.length).forEach((share, k) => {
        net[among[k]] -= share;
      });
    }
    return net;
  }

  // Greedy: biggest debtor pays biggest creditor until everyone is square.
  // Gives at most (people - 1) transfers.
  function transfers(net) {
    const debt = [];
    const cred = [];
    net.forEach((v, i) => {
      if (v < 0) debt.push({ i, v: -v });
      else if (v > 0) cred.push({ i, v });
    });
    const out = [];
    while (debt.length && cred.length) {
      debt.sort((a, b) => b.v - a.v);
      cred.sort((a, b) => b.v - a.v);
      const d = debt[0];
      const c = cred[0];
      const amt = Math.min(d.v, c.v);
      out.push({ from: d.i, to: c.i, amount: amt });
      d.v -= amt;
      c.v -= amt;
      if (!d.v) debt.shift();
      if (!c.v) cred.shift();
    }
    return out;
  }

  // Compact link format: v1 + base64url(JSON of arrays).
  function encode(state) {
    const compact = {
      t: state.title || "",
      c: state.currency || "$",
      p: state.people,
      e: state.expenses.map((e) => [e.what, e.amount, e.payer, e.among]),
    };
    if (state.demo) compact.x = 1; // the built-in example, not a real trip
    const bytes = new TextEncoder().encode(JSON.stringify(compact));
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return "1" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decode(str) {
    if (!str || str[0] !== "1") return null;
    try {
      const b64 = str.slice(1).replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      const o = JSON.parse(new TextDecoder().decode(bytes));
      return {
        title: String(o.t || ""),
        currency: String(o.c || "$"),
        people: (o.p || []).map(String),
        expenses: (o.e || []).map(([what, amount, payer, among]) => ({
          what: String(what),
          amount: Math.round(Number(amount)) || 0,
          payer: Number(payer) || 0,
          among: (among || []).map(Number),
        })),
        demo: o.x === 1,
      };
    } catch (err) {
      return null;
    }
  }

  // "12.5" / "12,50" / "$12" -> 1250 cents. Returns NaN if not a number.
  function parseAmount(text) {
    const cleaned = String(text).trim().replace(/[^\d.,-]/g, "").replace(",", ".");
    if (!cleaned) return NaN;
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n * 100) : NaN;
  }

  function fmt(cents, currency) {
    const sign = cents < 0 ? "-" : "";
    return sign + (currency || "$") + (Math.abs(cents) / 100).toFixed(2);
  }

  const api = { splitEven, balances, transfers, encode, decode, parseAmount, fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Settle = api;
})(typeof window !== "undefined" ? window : globalThis);
