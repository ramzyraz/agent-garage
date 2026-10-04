// Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const S = require("../site/settle.js");

test("splitEven distributes leftover cents", () => {
  assert.deepStrictEqual(S.splitEven(1000, 3), [334, 333, 333]);
  assert.strictEqual(S.splitEven(1001, 7).reduce((a, b) => a + b), 1001);
});

test("balances sum to zero and transfers settle everyone", () => {
  const state = {
    people: ["Ana", "Ben", "Cai", "Dee"],
    expenses: [
      { what: "Airbnb", amount: 40000, payer: 0, among: [0, 1, 2, 3] },
      { what: "Dinner", amount: 9050, payer: 1, among: [0, 1, 2] },
      { what: "Taxi", amount: 2333, payer: 3, among: [2, 3] },
    ],
  };
  const net = S.balances(state);
  assert.strictEqual(net.reduce((a, b) => a + b), 0);
  const moves = S.transfers(net);
  assert.ok(moves.length <= 3);
  const after = net.slice();
  for (const m of moves) { after[m.from] += m.amount; after[m.to] -= m.amount; }
  assert.deepStrictEqual(after, [0, 0, 0, 0]);
});

test("encode/decode round-trips unicode", () => {
  const state = { title: "Café ☕ trip", currency: "€", people: ["Zoë", "李"], expenses: [{ what: "Crêpes", amount: 1250, payer: 1, among: [0, 1] }] };
  assert.deepStrictEqual(S.decode(S.encode(state)), state);
  assert.strictEqual(S.decode("garbage"), null);
  assert.strictEqual(S.decode("1!!!"), null);
});

test("parseAmount", () => {
  assert.strictEqual(S.parseAmount("12.5"), 1250);
  assert.strictEqual(S.parseAmount("12,50"), 1250);
  assert.strictEqual(S.parseAmount("$ 7"), 700);
  assert.ok(Number.isNaN(S.parseAmount("abc")));
});
