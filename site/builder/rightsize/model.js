// Rightsize model: estimate a home's design heating load from its own fuel bills.
// Method follows Lee, Pergantis & Kircher (arXiv:2609.07619), "bill method":
//   heat delivered q_h = efficiency × (fuel − baseload) / hours
//   q_h = β1·ΔT⁺ − β2, where ΔT⁺ = mean over the period of max(0, θ − T_out(hour))
// Heating periods are chosen automatically (threshold τ* minimising two RMSEs),
// the fit is constrained to β1, β2 ≥ 0, and the range comes from a Bayesian bootstrap.
// Internal units: °F, Btu, Btu/h, days.

export const UNITS = {
  therm: { label: 'therms', btu: 100000 },
  ccf: { label: 'CCF (100 cu ft)', btu: 103700 },
  mcf: { label: 'MCF', btu: 1037000 },
  m3: { label: 'm³ of gas', btu: 36600 },
  kwh: { label: 'kWh', btu: 3412.14 },
  galOil: { label: 'gallons of oil', btu: 138500 },
  litreOil: { label: 'litres of oil', btu: 36590 },
  galPropane: { label: 'gallons of propane', btu: 91500 },
  litrePropane: { label: 'litres of propane', btu: 24170 },
};

export const SYSTEMS = {
  gasOld: { label: 'Gas furnace, older (non-condensing)', efficiency: 0.8, unit: 'therm' },
  gasCondensing: { label: 'Gas furnace, condensing (90%+)', efficiency: 0.94, unit: 'therm' },
  gasBoiler: { label: 'Gas boiler', efficiency: 0.84, unit: 'therm' },
  combiUK: { label: 'Gas combi boiler (UK)', efficiency: 0.85, unit: 'kwh' },
  oil: { label: 'Oil furnace or boiler', efficiency: 0.82, unit: 'galOil' },
  propane: { label: 'Propane furnace', efficiency: 0.8, unit: 'galPropane' },
  electric: { label: 'Electric resistance (baseboard, furnace)', efficiency: 1, unit: 'kwh' },
};

export const BTU_PER_TON = 12000;
export const BTU_PER_KW = 3412.14;
export const fToC = (f) => (f - 32) * 5 / 9;
export const cToF = (c) => c * 9 / 5 + 32;

const DAY_MS = 86400000;
export const dayNumber = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / DAY_MS);
export const isoFromDay = (d) => new Date(d * DAY_MS).toISOString().slice(0, 10);

// weather: { startDay, temps } with temps[i] = °F for hour i counted from startDay 00:00 local.
// Bill periods run from the start read date (inclusive) to the end read date (exclusive).
export function periodStats(bills, weather, theta) {
  return bills.map((b, index) => {
    const s = dayNumber(b.start), e = dayNumber(b.end);
    const days = e - s;
    let n = 0, sumPlus = 0, sumT = 0;
    const from = (s - weather.startDay) * 24, to = (e - weather.startDay) * 24;
    for (let i = Math.max(0, from); i < Math.min(weather.temps.length, to); i++) {
      const t = weather.temps[i];
      if (t == null || Number.isNaN(t)) continue;
      n++; sumT += t; sumPlus += Math.max(0, theta - t);
    }
    const hours = days * 24;
    return {
      index, start: b.start, end: b.end, days, amount: b.amount,
      coverage: hours > 0 ? n / hours : 0,
      dTplus: n ? sumPlus / n : NaN,
      meanT: n ? sumT / n : NaN,
    };
  });
}

// Weighted least squares y = a + b·x. Returns { a, b }.
function wls(xs, ys, ws) {
  let sw = 0, sx = 0, sy = 0;
  for (let i = 0; i < xs.length; i++) { sw += ws[i]; sx += ws[i] * xs[i]; sy += ws[i] * ys[i]; }
  const mx = sx / sw, my = sy / sw;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < xs.length; i++) { sxx += ws[i] * (xs[i] - mx) ** 2; sxy += ws[i] * (xs[i] - mx) * (ys[i] - my); }
  const b = sxx > 0 ? sxy / sxx : 0;
  return { a: my - b * mx, b };
}

// Constrained fit q = β1·x − β2 with β1, β2 ≥ 0.
export function constrainedFit(xs, ys, ws = xs.map(() => 1)) {
  let { a, b } = wls(xs, ys, ws);
  let beta1 = b, beta2 = -a;
  if (beta2 < 0) { // positive intercept is unphysical: refit through the origin
    let sxy = 0, sxx = 0;
    for (let i = 0; i < xs.length; i++) { sxy += ws[i] * xs[i] * ys[i]; sxx += ws[i] * xs[i] * xs[i]; }
    beta1 = sxx > 0 ? sxy / sxx : 0; beta2 = 0;
  }
  if (beta1 < 0) beta1 = 0;
  return { beta1, beta2 };
}

const rmse = (res) => Math.sqrt(res.reduce((s, r) => s + r * r, 0) / Math.max(1, res.length));

// Split periods into non-heating (baseload only) and heating, by threshold on ΔT⁺.
// Daily fuel use (Btu/day) is the quantity compared, as in the paper's Figure 5.
export function selectHeating(points) {
  const sorted = [...points].sort((p, q) => p.dTplus - q.dTplus);
  const n = sorted.length;
  let best = null;
  for (let k = 1; k <= n - 3; k++) { // k = number of non-heating periods
    const off = sorted.slice(0, k), on = sorted.slice(k);
    const meanOff = off.reduce((s, p) => s + p.fuelPerDay, 0) / k;
    const resOff = off.map((p) => p.fuelPerDay - meanOff);
    const { a, b } = wls(on.map((p) => p.dTplus), on.map((p) => p.fuelPerDay), on.map(() => 1));
    const resOn = on.map((p) => p.fuelPerDay - (a + b * p.dTplus));
    const score = rmse(resOff) + rmse(resOn);
    if (b > 0 && (!best || score < best.score)) best = { score, k, tau: off[k - 1].dTplus, baseload: meanOff };
  }
  return best; // null if no split works (e.g. winter-only data)
}

// Small deterministic RNG so a shared link always shows the same range.
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function quantile(sorted, q) {
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

// Design temperature from ≥1 year of hourly temps: 99% = colder than this 1% of hours.
export function climateStats(temps) {
  const vals = Array.from(temps).filter((t) => t != null && !Number.isNaN(t));
  const sorted = Float64Array.from(vals).sort();
  const years = vals.length / 8766;
  const histogram = {}; // whole °F → hours per year
  for (const t of vals) { const k = Math.floor(t); histogram[k] = (histogram[k] || 0) + 1 / years; }
  return {
    years: Math.round(years * 10) / 10,
    t99: quantile(sorted, 0.01),
    t996: quantile(sorted, 0.004),
    coldest: sorted[0],
    histogram,
  };
}

/**
 * Full analysis.
 * input: { bills:[{start,end,amount}], unit, efficiency, theta (°F), weather, climate,
 *          baseloadOverride? (Btu/day), designTemp? (°F) }
 */
export function analyse(input) {
  const { bills, unit, efficiency, theta, weather, climate } = input;
  const btu = UNITS[unit].btu;
  const warnings = [];
  const stats = periodStats(bills, weather, theta).map((p) => ({ ...p, fuelPerDay: (p.amount * btu) / p.days }));
  const usable = stats.filter((p) => p.days > 0 && p.coverage > 0.9 && p.amount >= 0 && Number.isFinite(p.dTplus));
  const dropped = stats.length - usable.length;
  if (dropped) warnings.push({ level: 'warn', text: `${dropped} bill${dropped > 1 ? 's' : ''} couldn't be matched to weather data and ${dropped > 1 ? 'were' : 'was'} left out.` });

  let split = selectHeating(usable);
  let baseload, heating;
  if (input.baseloadOverride != null) {
    baseload = input.baseloadOverride;
    heating = usable.filter((p) => p.fuelPerDay > baseload * 1.15 && p.dTplus > 3);
  } else if (split) {
    baseload = split.baseload;
    heating = usable.filter((p) => p.dTplus > split.tau);
  } else {
    // No summer bills: the fit's intercept can't separate hot water from internal gains.
    heating = usable.filter((p) => p.dTplus > 3);
    const { a } = wls(heating.map((p) => p.dTplus), heating.map((p) => p.fuelPerDay), heating.map(() => 1));
    baseload = Math.max(0, a);
    warnings.push({ level: 'warn', text: 'No summer bills, so hot water and cooking can\'t be measured separately. Add a few summer months to tighten the estimate.' });
  }
  if (heating.length < 3) return { ok: false, reason: 'Rightsize needs at least 3 bills from the heating season (and ideally a full year).', stats: usable, warnings };

  const xs = heating.map((p) => p.dTplus);
  const ys = heating.map((p) => (efficiency * (p.fuelPerDay - baseload)) / 24);
  const fit = constrainedFit(xs, ys);
  const designTemp = input.designTemp ?? climate.t99;
  const dTdes = theta - designTemp;
  const design = fit.beta1 * dTdes - fit.beta2;

  // R² on heating periods
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - (fit.beta1 * xs[i] - fit.beta2)) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Bayesian bootstrap (Dirichlet(1,…,1) weights), 90% interval
  const rand = rng(input.seed ?? 20260907);
  const draws = [], betas = [];
  for (let it = 0; it < 2000; it++) {
    const w = xs.map(() => -Math.log(1 - rand() * 0.999999));
    const f = constrainedFit(xs, ys, w);
    betas.push(f);
    draws.push(f.beta1 * dTdes - f.beta2);
  }
  draws.sort((p, q) => p - q);
  const low = quantile(draws, 0.05), high = quantile(draws, 0.95);

  if (heating.length < 5) warnings.push({ level: 'warn', text: `Only ${heating.length} heating-season bills. The range is wide; a second winter of bills would narrow it.` });
  if (r2 < 0.85) warnings.push({ level: 'warn', text: `Your bills only loosely follow the weather (fit R² ${r2.toFixed(2)}). A wood stove, a vacant month, a second heat source or estimated meter reads can do this.` });
  else warnings.push({ level: 'ok', text: `Your heating bills track the weather closely (fit R² ${r2.toFixed(2)} across ${heating.length} bills).` });
  const estimatedReads = heating.filter((p) => p.days < 20 || p.days > 40).length;
  if (estimatedReads) warnings.push({ level: 'info', text: `${estimatedReads} bill${estimatedReads > 1 ? 's cover' : ' covers'} an unusual number of days. That's fine. Each bill is treated by its own dates.` });
  if (efficiency >= 0.99 && unit === 'kwh') warnings.push({ level: 'info', text: 'Electric heat: summer air conditioning can inflate the "baseload". If you have AC, leave summer bills out or set the baseload by hand.' });

  const maxObserved = Math.max(...xs);
  return {
    ok: true, warnings, stats: usable.map((p) => ({ ...p, q: (efficiency * (p.fuelPerDay - baseload)) / 24 })), heating: heating.map((p) => p.index),
    baseload, fit, r2, theta, designTemp, dTdes, design, low, high,
    maxObservedDT: maxObserved,
    loadAt: (tF) => Math.max(0, fit.beta1 * (theta - tF) - fit.beta2),
    // 90% band of the load line at any outdoor temperature
    bandAt: (tF) => {
      const v = betas.map((f) => Math.max(0, f.beta1 * (theta - tF) - f.beta2)).sort((p, q) => p - q);
      return [quantile(v, 0.05), quantile(v, 0.95)];
    },
    balancePoint: fit.beta1 > 0 ? theta - fit.beta2 / fit.beta1 : theta,
  };
}

// Compare a quoted unit with the load line.
// quote: { label, tons, cap5?, cap17?, min47? } (capacities in Btu/h)
export function judgeQuote(result, quote, climate) {
  const nominal = quote.tons * BTU_PER_TON;
  const ratio = nominal / result.design;
  // Capacity at the design temperature, if spec numbers are given (linear between 5 and 17 °F).
  let capDesign = null;
  if (quote.cap5 && quote.cap17) {
    const t = result.designTemp;
    capDesign = quote.cap5 + (quote.cap17 - quote.cap5) * (t - 5) / 12;
  } else if (quote.cap5 && Math.abs(result.designTemp - 5) < 8) capDesign = quote.cap5;
  let cyclingHours = null, cyclingAbove = null, heatingHours = null, cyclingShare = null;
  if (quote.min47 && climate?.histogram) {
    // Hours per year where the house needs some heat but less than the unit's minimum output.
    cyclingHours = 0; heatingHours = 0;
    for (const [k, h] of Object.entries(climate.histogram)) {
      const load = result.loadAt(Number(k) + 0.5);
      if (load > 0) heatingHours += h;
      if (load > 0 && load < quote.min47) cyclingHours += h;
    }
    cyclingShare = heatingHours ? cyclingHours / heatingHours : 0;
    cyclingAbove = result.theta - (quote.min47 + result.fit.beta2) / Math.max(1e-9, result.fit.beta1);
  }
  const cold = capDesign ? capDesign / result.design : null;
  let verdict;
  if (cold != null && cold < 0.9) verdict = 'short';
  else if (cold == null && ratio < 0.85) verdict = 'small';
  else if (ratio > 2) verdict = 'huge';
  else if (cyclingShare != null && cyclingShare > 0.7) verdict = 'cycles';
  else if (ratio > 1.5 && cyclingShare == null) verdict = 'big';
  else verdict = 'fits';
  return { nominal, ratio, capDesign, cold, cyclingHours, cyclingAbove, heatingHours, cyclingShare, verdict };
}
