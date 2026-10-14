// The load-line chart: each bill as a point, the fitted line extended to the coldest hours,
// and every quote drawn on top. Pure SVG string so it prints and screenshots cleanly.
import { fToC, BTU_PER_KW } from './model.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function fmtPower(btu, metric, { unit = true } = {}) {
  if (metric) return `${(btu / BTU_PER_KW).toFixed(btu < 34121 ? 1 : 0)}${unit ? ' kW' : ''}`;
  const r = btu >= 10000 ? Math.round(btu / 100) * 100 : Math.round(btu / 10) * 10;
  return `${r.toLocaleString('en-US')}${unit ? ' Btu/h' : ''}`;
}
export const fmtTemp = (f, metric, digits = 0) => metric ? `${fToC(f).toFixed(digits)}°C` : `${f.toFixed(digits)}°F`;

const QUOTE_COLORS = ['#2563c9', '#8b3fd1', '#0f8a7e', '#b45309', '#be185d'];
export const quoteColor = (i) => QUOTE_COLORS[i % QUOTE_COLORS.length];

export function renderChart(result, quotes, climate, { metric = false, place = '', narrow = false } = {}) {
  const [W, H, L, R, T, B] = narrow ? [400, 440, 46, 62, 26, 92] : [760, 470, 70, 140, 26, 96];
  const pw = W - L - R, ph = H - T - B;
  const theta = result.theta;
  const pts = result.stats.map((p) => ({ ...p, x: theta - p.dTplus, y: result.heating.includes(p.index) ? (p.q ?? 0) : null }));
  const xMin = Math.floor((Math.min(result.designTemp, ...pts.map((p) => p.x)) - 6) / 10) * 10;
  const xMax = Math.ceil((theta + 2) / 10) * 10;
  const yTop = Math.max(result.high, ...quotes.map((q) => Math.max(q.nominal, q.cap5 || 0)), ...pts.map((p) => p.y || 0)) * 1.12;
  const yStep = niceStep(metric ? yTop / BTU_PER_KW : yTop, 5) * (metric ? BTU_PER_KW : 1);
  const yMax = Math.ceil(yTop / yStep) * yStep;
  const X = (t) => L + ((t - xMin) / (xMax - xMin)) * pw;
  const Y = (v) => T + ph - (v / yMax) * ph;
  const o = [];
  o.push(`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-labelledby="chart-title chart-desc" xmlns="http://www.w3.org/2000/svg">`);
  o.push(`<title id="chart-title">Heat this house needs at each outdoor temperature</title>`);
  o.push(`<desc id="chart-desc">${esc(`${result.heating.length} heating bills plotted against outdoor temperature. The fitted line reaches ${fmtPower(result.design, metric)} at the design temperature of ${fmtTemp(result.designTemp, metric, 1)}. ` + quotes.map((q) => `${q.label}: ${q.tons} tons, ${fmtPower(q.nominal, metric)} nominal.`).join(' '))}</desc>`);

  // grid + axes
  for (let v = 0; v <= yMax + 1; v += yStep) {
    o.push(`<line class="grid" x1="${L}" x2="${L + pw}" y1="${Y(v)}" y2="${Y(v)}"/>`);
    o.push(`<text class="tick" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${fmtPower(v, metric, { unit: false })}</text>`);
  }
  const xTicks = metric ? range(Math.ceil(fToC(xMin) / 5) * 5, fToC(xMax), 5).map((c) => c * 9 / 5 + 32) : range(xMin, xMax, 10);
  for (const t of xTicks) {
    o.push(`<line class="grid v" x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${T + ph}"/>`);
    o.push(`<text class="tick" x="${X(t)}" y="${T + ph + 16}" text-anchor="middle">${metric ? Math.round(fToC(t)) : t}°</text>`);
  }
  o.push(`<text class="axis" x="${L}" y="${T - 10}">${metric ? 'kW' : 'Btu/h'} of heat needed</text>`);
  o.push(`<text class="axis" x="${L + pw}" y="${T + ph + 16}" text-anchor="start" dx="18">${narrow ? '' : 'outdoor '}${metric ? '°C' : '°F'}</text>`);

  // hours-per-year strip
  const hy = T + ph + 24, hh = 34;
  const hist = Object.entries(climate.histogram || {}).map(([k, h]) => [Number(k), h]).filter(([k]) => k >= xMin && k < xMax);
  const hMax = Math.max(1, ...hist.map(([, h]) => h));
  o.push(`<g class="hist">`);
  for (const [k, h] of hist) {
    const bh = Math.max(0.5, (h / hMax) * hh);
    o.push(`<rect x="${X(k)}" y="${hy + hh - bh}" width="${Math.max(1, X(k + 1) - X(k) - 0.6)}" height="${bh}" class="${k < result.designTemp ? 'cold' : ''}"><title>${esc(`${fmtTemp(k, metric)}: about ${h < 1 ? h.toFixed(1) : Math.round(h)} hours a year`)}</title></rect>`);
  }
  o.push(`</g><text class="note" x="${L}" y="${hy + hh + 16}">${narrow ? `Hours a year at each temperature, ${esc(climate.span || '')}` : `How many hours a year ${esc(place || 'it')} spends at each temperature (${esc(climate.span || '')})`}</text>`);

  // uncertainty band + line
  const lineFrom = Math.max(xMin, result.designTemp - 4), lineTo = result.balancePoint;
  const steps = 40, up = [], dn = [];
  for (let i = 0; i <= steps; i++) {
    const t = lineFrom + (lineTo - lineFrom) * i / steps;
    const [lo, hi] = result.bandAt(t);
    up.push(`${X(t).toFixed(1)},${Y(hi).toFixed(1)}`); dn.unshift(`${X(t).toFixed(1)},${Y(lo).toFixed(1)}`);
  }
  o.push(`<polygon class="band" points="${up.join(' ')} ${dn.join(' ')}"/>`);
  const obsCold = theta - result.maxObservedDT;
  o.push(`<line class="fit extrap" x1="${X(lineFrom)}" y1="${Y(result.loadAt(lineFrom))}" x2="${X(obsCold)}" y2="${Y(result.loadAt(obsCold))}"/>`);
  o.push(`<line class="fit" x1="${X(obsCold)}" y1="${Y(result.loadAt(obsCold))}" x2="${X(lineTo)}" y2="${Y(0)}"/>`);

  // design temperature
  const dx = X(result.designTemp), dy = Y(result.design);
  o.push(`<line class="design" x1="${dx}" x2="${dx}" y1="${T}" y2="${T + ph}"/>`);
  o.push(`<line class="design" x1="${dx}" x2="${dx}" y1="${hy}" y2="${hy + hh}"/>`);
  o.push(`<text class="design-label" x="${dx + 6}" y="${T + 12}">${narrow ? '' : 'coldest 1% of hours: '}${fmtTemp(result.designTemp, metric, 1)}</text>`);

  // quotes
  quotes.forEach((q, i) => {
    const c = quoteColor(i), y = Y(q.nominal);
    o.push(`<g class="quote" style="--c:${c};animation-delay:${1.6 + i * 0.25}s">`);
    if (q.cap5 && q.cap17) {
      const t1 = xMin, c1 = q.cap5 + (q.cap17 - q.cap5) * (t1 - 5) / 12;
      o.push(`<polyline points="${X(t1)},${Y(Math.max(0, c1))} ${X(5)},${Y(q.cap5)} ${X(17)},${Y(q.cap17)} ${X(47)},${y} ${X(xMax)},${y}"/>`);
    } else o.push(`<line x1="${L}" x2="${L + pw}" y1="${y}" y2="${y}"/>`);
    if (q.min47) o.push(`<line class="min" x1="${X(35)}" x2="${L + pw}" y1="${Y(q.min47)}" y2="${Y(q.min47)}"/><text class="qmin" x="${L + pw + 6}" y="${Y(q.min47) + 4}">${narrow ? 'lowest' : esc(q.label) + ' lowest'}</text>`);
    o.push(`<text x="${L + pw + 6}" y="${y - 3}">${esc(q.label)}</text><text class="qsub" x="${L + pw + 6}" y="${y + 11}">${q.tons} ton${narrow ? '' : ' · ' + fmtPower(q.nominal, metric)}</text>`);
    o.push(`</g>`);
  });

  // bill points
  pts.forEach((p, i) => {
    const heat = p.y != null;
    const y = heat ? Y(Math.max(0, p.y)) : Y(0);
    const r = Math.max(4, Math.min(8, Math.sqrt(p.days) * 1.2));
    o.push(`<circle class="pt ${heat ? '' : 'off'}" cx="${X(p.x).toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" style="animation-delay:${(0.1 + i * 0.06).toFixed(2)}s"><title>${esc(`${p.start} → ${p.end}: ${p.amount} on the bill. ${heat ? `About ${fmtPower(p.y, metric)} of heat on average` : 'Summer bill: used to measure hot water and cooking'}`)}</title></circle>`);
  });

  o.push(`<circle class="design-dot" cx="${dx}" cy="${dy}" r="7"/>`);
  const labelLeft = dx > L + pw * 0.55;
  const big = fmtPower(result.design, metric), small = narrow ? 'needed on a design day' : 'this house\'s need on a design day';
  const bw = Math.max(big.length * 11.5, small.length * 6.6) + 16, bx = labelLeft ? dx - 14 - bw : dx + 14, by = dy + 14;
  o.push(`<g class="design-callout"><rect x="${bx}" y="${by}" width="${bw}" height="46" rx="8"/><text x="${bx + 8}" y="${by + 21}"><tspan class="big">${big}</tspan><tspan x="${bx + 8}" dy="17">${small}</tspan></text></g>`);
  o.push(`</svg>`);
  return o.join('');
}

function niceStep(max, n) {
  const raw = max / n, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}
function range(a, b, s) { const out = []; for (let v = a; v <= b + 1e-9; v += s) out.push(Math.round(v * 100) / 100); return out; }
