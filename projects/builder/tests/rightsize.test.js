import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyse, judgeQuote, climateStats, constrainedFit, selectHeating, periodStats, dayNumber, isoFromDay, rng } from '../../../site/builder/rightsize/model.js';
import { parsePasted, parseUsageCsv, findDates } from '../../../site/builder/rightsize/parse.js';

const sample = JSON.parse(readFileSync(new URL('../../../site/builder/rightsize/sample.json', import.meta.url)));
const sampleInput = { bills: sample.bills, unit: 'therm', efficiency: 0.8, theta: 68, weather: sample.weather, climate: sample.climate };

// Synthetic weather: a sine-wave year with daily swing, °F, hourly.
function synthWeather(startIso, days, mean = 50, amp = 25) {
  const temps = [];
  for (let h = 0; h < days * 24; h++) {
    const d = h / 24;
    temps.push(mean - amp * Math.cos((2 * Math.PI * (d - 15)) / 365) + 8 * Math.sin((2 * Math.PI * h) / 24));
  }
  return { startDay: dayNumber(startIso), temps };
}
function billsFor(weather, house, startIso, n, len = 30, unitBtu = 1e5) {
  const out = [];
  let s = dayNumber(startIso);
  for (let i = 0; i < n; i++, s += len) {
    let heat = 0;
    for (let h = (s - weather.startDay) * 24; h < (s + len - weather.startDay) * 24; h++) heat += Math.max(0, house.ua * (house.theta - weather.temps[h]) - house.gains);
    out.push({ start: isoFromDay(s), end: isoFromDay(s + len), amount: (heat / house.eff + house.base * len * unitBtu) / unitBtu });
  }
  return out;
}

test('recovers a known house exactly from noise-free bills', () => {
  const weather = synthWeather('2024-01-01', 400);
  const house = { ua: 300, gains: 1200, eff: 0.9, theta: 68, base: 0.6 };
  const bills = billsFor(weather, house, '2024-01-05', 12);
  const climate = { t99: 5, histogram: {} };
  const r = analyse({ bills, unit: 'therm', efficiency: 0.9, theta: 68, weather, climate });
  assert.ok(r.ok);
  const truth = 300 * (68 - 5) - 1200;
  // Monthly averaging of max(0, ...) is slightly nonlinear, so allow a few percent.
  assert.ok(Math.abs(r.design - truth) / truth < 0.05, `design ${r.design} vs ${truth}`);
  assert.ok(r.low <= r.design && r.design <= r.high);
  assert.ok(Math.abs(r.baseload / 1e5 - 0.6) < 0.15, `baseload ${r.baseload / 1e5}`);
});

test('the bundled Denver example lands near the house it was generated from', () => {
  const r = analyse(sampleInput);
  const truth = sample.house.ua * (sample.house.theta - sample.climate.t99) - sample.house.gains;
  assert.ok(r.ok);
  assert.ok(Math.abs(r.design - truth) / truth < 0.06, `${r.design} vs ${truth}`);
  assert.ok(r.r2 > 0.95);
  assert.ok(r.low < truth * 1.02 && r.high > truth * 0.95, 'range should be near the truth');
});

test('efficiency is applied: the same bills from a 95% furnace mean more delivered heat', () => {
  const a = analyse(sampleInput), b = analyse({ ...sampleInput, efficiency: 0.95 });
  assert.ok(Math.abs(b.design / a.design - 0.95 / 0.8) < 0.01);
});

test('quotes: the oversized 4-ton cycles most of the winter; the 2.5-ton fits', () => {
  const r = analyse(sampleInput);
  const [A, B] = sample.quotes.map((q) => judgeQuote(r, q, sample.climate));
  assert.equal(A.verdict, 'fits');
  assert.equal(B.verdict, 'cycles');
  assert.ok(B.cyclingHours > 2 * A.cyclingHours);
  assert.ok(B.cyclingAbove < A.cyclingAbove);
  assert.equal(judgeQuote(r, { tons: 6 }, sample.climate).verdict, 'huge');
  assert.equal(judgeQuote(r, { tons: 1.5 }, sample.climate).verdict, 'small');
  assert.equal(judgeQuote(r, { tons: 2.5, cap5: 15000, cap17: 18000 }, sample.climate).verdict, 'short');
});

test('constrained fit never returns a negative heat loss or negative free gains', () => {
  const f = constrainedFit([10, 20, 30], [5000, 7000, 9000]); // positive intercept
  assert.equal(f.beta2, 0);
  assert.ok(f.beta1 > 0);
  const g = constrainedFit([10, 20, 30], [3000, 7000, 11000]);
  assert.ok(Math.abs(g.beta1 - 400) < 1e-9 && Math.abs(g.beta2 - 1000) < 1e-9);
});

test('heating-season selection separates summer bills', () => {
  const pts = [2, 3, 4, 20, 30, 40, 50].map((x, i) => ({ dTplus: x, fuelPerDay: x < 10 ? 60000 : 60000 + 9000 * x, index: i }));
  const s = selectHeating(pts);
  assert.equal(s.k, 3);
  assert.ok(Math.abs(s.baseload - 60000) < 1);
});

test('winter-only bills still work, with a warning', () => {
  const r = analyse({ ...sampleInput, bills: sample.bills.slice(1, 6) });
  assert.ok(r.ok);
  assert.ok(r.warnings.some((w) => /summer/i.test(w.text)) || r.warnings.some((w) => /heating-season/.test(w.text)));
});

test('too few bills gives a clear reason instead of a number', () => {
  const r = analyse({ ...sampleInput, bills: sample.bills.slice(3, 5) });
  assert.equal(r.ok, false);
  assert.match(r.reason, /at least 3/);
});

test('bills outside the weather data are dropped and reported', () => {
  const bills = [...sample.bills, { start: '2030-01-01', end: '2030-02-01', amount: 100 }];
  const r = analyse({ ...sampleInput, bills });
  assert.ok(r.warnings.some((w) => /couldn't be matched/.test(w.text)));
});

test('periodStats averages only the hours inside each bill', () => {
  const weather = { startDay: dayNumber('2025-01-01'), temps: [...Array(48).fill(40), ...Array(48).fill(60)] };
  const [p] = periodStats([{ start: '2025-01-02', end: '2025-01-04', amount: 1 }], weather, 68);
  assert.equal(p.meanT, 50);
  assert.equal(p.dTplus, 18);
  assert.equal(p.coverage, 1);
});

test('climateStats: 99% design temperature and hours per year', () => {
  const temps = Array.from({ length: 8766 * 2 }, (_, i) => (i % 100)); // 0..99 evenly
  const c = climateStats(temps);
  assert.ok(c.t99 >= 0 && c.t99 <= 1, String(c.t99)); // 1% of a 0–99 cycle is in the bottom value
  assert.ok(Math.abs(c.histogram[50] - 87.66) < 0.5);
});

test('bootstrap is deterministic for a given seed', () => {
  const a = analyse(sampleInput), b = analyse(sampleInput);
  assert.equal(a.low, b.low); assert.equal(a.high, b.high);
  const r = rng(3); assert.equal(rng(3)(), r());
});

test('parser: two dates, read dates, month names, money and day-first', () => {
  const t = `Service period      Usage    Charge
12/27/2024  1/28/2025  193 therms  $210.55
2025-01-28 2025-02-26 159`;
  assert.deepEqual(parsePasted(t).bills, [
    { start: '2024-12-27', end: '2025-01-28', amount: 193 },
    { start: '2025-01-28', end: '2025-02-26', amount: 159 },
  ]);
  assert.deepEqual(parsePasted('Jan 2025, 1,450 kWh\nFeb 2025  1,210').bills, [
    { start: '2025-01-01', end: '2025-02-01', amount: 1450 },
    { start: '2025-02-01', end: '2025-03-01', amount: 1210 },
  ]);
  const reads = parsePasted('Read 2025-01-28  193\nRead 2025-02-26  159\nRead 2025-03-27 97').bills;
  assert.deepEqual(reads, [{ start: '2025-01-28', end: '2025-02-26', amount: 159 }, { start: '2025-02-26', end: '2025-03-27', amount: 97 }]);
  assert.equal(parsePasted('03/02/2025 03/03/2025 50', { dayFirst: true }).bills[0].start, '2025-02-03');
  assert.equal(findDates('31/01/2025')[0].iso, '2025-01-31');
  assert.equal(findDates('15 Jan 2025')[0].iso, '2025-01-15');
  assert.equal(parsePasted('$84.10 12/27/2024 1/28/2025 193').bills[0].amount, 193);
});

test('Green Button style CSV is grouped into full weeks', () => {
  const rows = ['TYPE,DATE,START TIME,END TIME,USAGE,UNITS,COST'];
  for (let d = 0; d < 30; d++) rows.push(`Natural gas usage,${isoFromDay(dayNumber('2025-01-01') + d)},00:00,23:59,${(4 + d * 0.1).toFixed(2)},therms,$5.00`);
  const r = parseUsageCsv(rows.join('\n'));
  assert.equal(r.unit, 'therm');
  assert.equal(r.days, 30);
  assert.equal(r.bills.length, 4);
  assert.equal(r.bills[0].start, '2025-01-01');
  assert.equal(r.bills[0].end, '2025-01-08');
  assert.ok(Math.abs(r.bills[0].amount - (4 * 7 + 0.1 * 21)) < 0.01);
});
