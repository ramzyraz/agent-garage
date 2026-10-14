import { analyse, judgeQuote, SYSTEMS, UNITS, BTU_PER_TON, fToC, cToF, dayNumber, isoFromDay } from './model.js';
import { parsePasted, parseUsageCsv } from './parse.js';
import { searchPlaces, loadWeather } from './weather.js';
import { renderChart, fmtPower, fmtTemp, quoteColor } from './chart.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let sample = null;
let metric = localStorage.getItem('rightsize-metric') === '1';
let shown = null; // { kind: 'sample'|'yours', input, result, quotes, climate, place }

// Editor state (what the person is typing)
const ed = { place: null, system: 'gasOld', efficiency: 0.8, unit: 'therm', theta: 68, bills: [], quotes: [] };

// ---------- result view ----------

const narrowQuery = matchMedia('(max-width: 640px)');
const isNarrow = () => narrowQuery.matches;
narrowQuery.addEventListener('change', () => { if (shown) show(shown); });

function show(view) {
  shown = view;
  const { result, place, kind } = view;
  const climate = view.climate;
  const quotes = view.quotes.filter((q) => q.tons > 0).map((q) => ({ ...q, ...judgeQuote(result, q, climate) }));
  $('#badge').textContent = kind === 'sample' ? 'Example · made-up house and quotes, real Denver weather' : `Your house · ${place.name}`;
  $('#badge').className = 'badge ' + kind;
  const tons = result.design / BTU_PER_TON;
  $('#headline').innerHTML = `${kind === 'sample' ? 'This house' : 'Your house'} needs about <b>${fmtPower(result.design, metric)}</b> <span class="tons">(${tons.toFixed(1)} tons)</span> to stay at ${fmtTemp(result.theta, metric)} through ${esc(place.name.split(',')[0])}'s coldest hours.`;
  $('#range').innerHTML = `Likely between <b>${fmtPower(result.low, metric)}</b> and <b>${fmtPower(result.high, metric)}</b>. Design temperature <b>${fmtTemp(result.designTemp, metric, 1)}</b>: only 1% of hours were colder, ${climate.span}.`;
  $('#chart').innerHTML = renderChart(result, quotes, climate, { metric, place: place.name.split(',')[0], narrow: isNarrow() });
  $('#verdicts').innerHTML = quotes.map((q, i) => verdictHtml(q, i, result)).join('') ||
    `<li class="verdict none">Add a contractor's quote below to see it on the chart.</li>`;
  $('#checks').innerHTML = result.warnings.map((w) => `<li class="${w.level}">${esc(w.text)}</li>`).join('');
  $('#numbers-body').innerHTML = numbersHtml(view);
  document.querySelectorAll('.ask-load').forEach((n) => { n.textContent = `${fmtPower(result.design, metric)} at ${fmtTemp(result.designTemp, metric, 1)}`; });
  $('#unit-toggle').textContent = metric ? '°C · kW' : '°F · Btu/h';
  $('#print').dataset.place = place.name;
}

function verdictHtml(q, i, result) {
  const T = fmtTemp(result.designTemp, metric, 1);
  const head = {
    huge: ['More than double the need', 'Expect a higher price and lots of on-off cycling in mild weather. Ask why it is this big.'],
    big: ['Bigger than needed', 'Some margin is normal, but this is well above what the house used. Ask how they got their number.'],
    cycles: ['Oversized for most of the winter', 'It keeps up on the coldest hours, but even its lowest setting is too much on ordinary winter days.'],
    fits: ['A good fit', ''],
    small: ['On the small side', 'It may lean on backup heat in the coldest hours.'],
    short: ['Falls short in the coldest hours', 'Backup heat would have to carry the rest.'],
  }[q.verdict];
  const lines = [];
  if (q.capDesign) {
    const ok = q.cold >= 0.95;
    lines.push(`<li class="${ok ? 'ok' : q.cold >= 0.9 ? 'warn' : 'bad'}"><b>Coldest hours:</b> delivers about ${fmtPower(q.capDesign, metric)} at ${T}, ${ok ? 'enough' : `${Math.round(q.cold * 100)}% of the need`}.</li>`);
  } else {
    lines.push(`<li class="info"><b>Coldest hours:</b> tons are rated at 47°F and most heat pumps deliver less in the cold. Ask for its output at ${T}.</li>`);
  }
  if (q.cyclingHours != null) {
    const pct = Math.round(q.cyclingShare * 100);
    lines.push(`<li class="${pct > 70 ? 'bad' : pct > 50 ? 'warn' : 'ok'}"><b>Mild days:</b> its lowest output (${fmtPower(q.min47, metric)}) is more than the house needs above ${fmtTemp(q.cyclingAbove, metric)}, so it cycles on and off about <b>${Math.round(q.cyclingHours).toLocaleString('en-US')} hours a year</b> (${pct}% of heating hours).</li>`);
  } else {
    lines.push(`<li class="info"><b>Mild days:</b> add its minimum output at 47°F to see how often it would cycle.</li>`);
  }
  return `<li class="verdict ${q.verdict}" style="--c:${quoteColor(i)}">
    <div class="vh"><span class="sw"></span><b>${esc(q.label)}</b> · ${q.tons} ton${q.tons === 1 ? '' : 's'} <span class="ratio" title="Nominal capacity divided by the measured need">${q.ratio.toFixed(1)}× the need</span></div>
    <p class="vt"><b>${head[0]}.</b> ${head[1]}</p><ul class="vlines">${lines.join('')}</ul></li>`;
}

function numbersHtml(view) {
  const { result, input } = view;
  const heat = new Set(result.heating);
  const rows = result.stats.map((p) => `<tr class="${heat.has(p.index) ? '' : 'off'}"><td>${p.start} → ${p.end}</td><td>${p.days}</td><td>${p.amount} ${esc(UNITS[input.unit].label)}</td><td>${fmtTemp(p.meanT, metric, 1)}</td><td>${heat.has(p.index) ? fmtPower(Math.max(0, p.q), metric) : 'summer: baseload'}</td></tr>`).join('');
  return `<p>Hot water, cooking and other year-round use: <b>${(result.baseload / UNITS[input.unit].btu).toFixed(2)} ${esc(UNITS[input.unit].label)} a day</b>, measured from the summer bills and subtracted from every bill. Efficiency ${Math.round(input.efficiency * 100)}%. Heat loss <b>${fmtPower(result.fit.beta1 * (metric ? 1.8 : 1), metric)} per ${metric ? '°C' : '°F'}</b> of difference between inside and outside, minus about ${fmtPower(result.fit.beta2, metric)} that people, appliances and sunshine supply for free.</p>
  <div class="table-wrap"><table class="nums"><thead><tr><th>Bill</th><th>Days</th><th>Used</th><th>Avg outdoor</th><th>Heat delivered</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

$('#unit-toggle').addEventListener('click', () => {
  metric = !metric;
  localStorage.setItem('rightsize-metric', metric ? '1' : '0');
  if (shown) show(shown);
  syncThetaField();
});

// ---------- sample ----------

async function loadSample() {
  sample = await (await fetch('sample.json')).json();
  return sample;
}
function sampleView() {
  const s = sample;
  const input = { bills: s.bills, unit: s.unit, efficiency: SYSTEMS[s.system].efficiency, theta: s.theta, weather: s.weather, climate: s.climate };
  return { kind: 'sample', input, result: analyse(input), quotes: s.quotes, climate: s.climate, place: s.place };
}

// ---------- editor ----------

function fillSelects() {
  $('#system').innerHTML = Object.entries(SYSTEMS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  $('#unit').innerHTML = Object.entries(UNITS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
}
function syncThetaField() {
  $('#theta').value = metric ? fToC(ed.theta).toFixed(1) : ed.theta;
  $('#theta-unit').textContent = metric ? '(°C, averaged over the day)' : '(°F, averaged over the day)';
}
function syncEditor() {
  $('#system').value = ed.system;
  $('#efficiency').value = ed.efficiency;
  $('#unit').value = ed.unit;
  syncThetaField();
  renderPlace();
  renderBills();
  renderQuotes();
}
function renderPlace() {
  const c = $('#place-chosen');
  c.hidden = !ed.place;
  if (ed.place) c.innerHTML = `Weather for <b>${esc(ed.place.name)}</b> <span class="muted">(${ed.place.lat}, ${ed.place.lon})</span>`;
}

$('#system').addEventListener('change', (e) => {
  ed.system = e.target.value;
  ed.efficiency = SYSTEMS[ed.system].efficiency; ed.unit = SYSTEMS[ed.system].unit;
  $('#efficiency').value = ed.efficiency; $('#unit').value = ed.unit;
});
$('#efficiency').addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (v > 1 && v <= 100) ed.efficiency = v / 100; else if (v > 0) ed.efficiency = v; });
$('#unit').addEventListener('change', (e) => { ed.unit = e.target.value; });
$('#theta').addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) ed.theta = metric ? cToF(v) : v; });

$('#place-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const list = $('#place-results');
  list.innerHTML = '<li class="muted">Searching…</li>';
  try {
    const found = await searchPlaces($('#place-q').value);
    list.innerHTML = found.length ? '' : '<li class="muted">No match. Try the nearest town.</li>';
    for (const p of found) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'choice'; b.textContent = p.name;
      b.addEventListener('click', () => { ed.place = p; list.innerHTML = ''; renderPlace(); });
      li.append(b); list.append(li);
    }
  } catch (err) { list.innerHTML = `<li class="bad">${esc(err.message)}</li>`; }
});

function renderBills() {
  const tb = $('#bills-table tbody');
  tb.innerHTML = '';
  ed.bills.forEach((b, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="date" value="${b.start}" aria-label="Bill ${i + 1} from"></td><td><input type="date" value="${b.end}" aria-label="Bill ${i + 1} to"></td><td><input type="number" step="any" min="0" value="${b.amount}" aria-label="Bill ${i + 1} amount" inputmode="decimal"></td><td><button type="button" class="x" aria-label="Remove bill ${i + 1}">×</button></td>`;
    const [s, en, a] = tr.querySelectorAll('input');
    s.addEventListener('change', () => { b.start = s.value; });
    en.addEventListener('change', () => { b.end = en.value; });
    a.addEventListener('input', () => { b.amount = parseFloat(a.value); });
    tr.querySelector('.x').addEventListener('click', () => { ed.bills.splice(i, 1); renderBills(); });
    tb.append(tr);
  });
  $('#bills-table').classList.toggle('empty', !ed.bills.length);
}
$('#add-row').addEventListener('click', () => {
  const last = ed.bills.at(-1);
  const start = last ? last.end : isoFromDay(Math.floor(Date.now() / 86400000) - 400);
  ed.bills.push({ start, end: isoFromDay(dayNumber(start) + 30), amount: '' });
  renderBills();
  $('#bills-table tbody tr:last-child input[type=number]').focus();
});
$('#clear-bills').addEventListener('click', () => { ed.bills = []; renderBills(); });

function mergeBills(bills) {
  const key = (b) => `${b.start}|${b.end}`;
  const have = new Set(ed.bills.map(key));
  let added = 0;
  for (const b of bills) if (!have.has(key(b))) { ed.bills.push(b); added++; }
  ed.bills.sort((p, q) => p.start.localeCompare(q.start));
  renderBills();
  return added;
}
$('#paste-add').addEventListener('click', () => {
  const { bills, skipped } = parsePasted($('#paste').value, { dayFirst: $('#dayfirst').checked });
  const added = mergeBills(bills);
  $('#paste-msg').className = 'msg ' + (added ? 'good' : 'bad');
  $('#paste-msg').textContent = added
    ? `Added ${added} bill${added > 1 ? 's' : ''}.${skipped.length ? ` Skipped ${skipped.length} line${skipped.length > 1 ? 's' : ''} without a date and an amount.` : ''} Check the dates below.`
    : 'No bills found. Each line needs a date (or two) and an amount.';
  if (added) $('#paste').value = '';
});
$('#csv').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();
  const parsed = parseUsageCsv(text);
  let added = 0, msg;
  if (parsed && parsed.bills.length) {
    added = mergeBills(parsed.bills);
    if (parsed.unit) { ed.unit = parsed.unit; $('#unit').value = parsed.unit; }
    msg = `Read ${parsed.days} days of usage and grouped them into ${parsed.bills.length} weeks.${parsed.unit ? ` Units: ${UNITS[parsed.unit].label}.` : ' Check the units above.'}`;
  } else {
    const p = parsePasted(text, { dayFirst: $('#dayfirst').checked });
    added = mergeBills(p.bills);
    msg = added ? `Added ${added} bills from the file.` : 'Couldn\'t find dates and usage in that file. Try pasting the rows instead.';
  }
  $('#paste-msg').className = 'msg ' + (added ? 'good' : 'bad');
  $('#paste-msg').textContent = msg;
  e.target.value = '';
});

function renderQuotes() {
  const box = $('#quotes');
  box.innerHTML = '';
  ed.quotes.forEach((q, i) => {
    const d = document.createElement('div');
    d.className = 'quote-row';
    d.style.setProperty('--c', quoteColor(i));
    d.innerHTML = `<label>Name<input data-k="label" value="${esc(q.label)}"></label>
      <label>Tons<input data-k="tons" type="number" step="0.5" min="0" value="${q.tons ?? ''}" inputmode="decimal"></label>
      <label>Max at 5°F <span class="muted">Btu/h</span><input data-k="cap5" type="number" step="100" min="0" value="${q.cap5 ?? ''}" inputmode="numeric" placeholder="optional"></label>
      <label>Max at 17°F <span class="muted">Btu/h</span><input data-k="cap17" type="number" step="100" min="0" value="${q.cap17 ?? ''}" inputmode="numeric" placeholder="optional"></label>
      <label>Min at 47°F <span class="muted">Btu/h</span><input data-k="min47" type="number" step="100" min="0" value="${q.min47 ?? ''}" inputmode="numeric" placeholder="optional"></label>
      <button type="button" class="x" aria-label="Remove ${esc(q.label)}">×</button>`;
    d.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => {
      const k = inp.dataset.k;
      q[k] = k === 'label' ? inp.value : (inp.value === '' ? undefined : parseFloat(inp.value));
    }));
    d.querySelector('.x').addEventListener('click', () => { ed.quotes.splice(i, 1); renderQuotes(); });
    box.append(d);
  });
}
$('#add-quote').addEventListener('click', () => {
  ed.quotes.push({ label: `Quote ${String.fromCharCode(65 + ed.quotes.length)}`, tons: undefined });
  renderQuotes();
  $('#quotes .quote-row:last-child input[data-k=tons]').focus();
});

$('#edit-this').addEventListener('click', () => {
  if (shown) {
    const inp = shown.input;
    Object.assign(ed, {
      place: shown.place, unit: inp.unit, efficiency: inp.efficiency, theta: inp.theta,
      system: shown.kind === 'sample' ? sample.system : ed.system,
      bills: inp.bills.map((b) => ({ ...b })), quotes: shown.quotes.map((q) => ({ ...q })),
    });
    syncEditor();
  }
  $('#yours').scrollIntoView({ behavior: 'smooth' });
});

// ---------- run ----------

async function run({ scroll = true } = {}) {
  const msg = $('#run-msg');
  const bills = ed.bills.filter((b) => b.start && b.end && b.end > b.start && Number.isFinite(b.amount) && b.amount >= 0);
  if (!ed.place) { msg.className = 'msg bad'; msg.textContent = 'Pick the town first (step 1), so Rightsize knows the weather.'; return; }
  if (bills.length < 3) { msg.className = 'msg bad'; msg.textContent = 'Add at least 3 bills, including winter ones. A full year is best.'; return; }
  msg.className = 'msg'; msg.textContent = 'Downloading ten years of hourly weather…';
  $('#run').disabled = true;
  try {
    const { weather, climate, lateBills } = await loadWeather(ed.place, bills);
    const input = { bills, unit: ed.unit, efficiency: ed.efficiency, theta: ed.theta, weather, climate };
    const result = analyse(input);
    if (!result.ok) { msg.className = 'msg bad'; msg.textContent = result.reason + (lateBills ? ` (${lateBills} bill${lateBills > 1 ? 's are' : ' is'} too recent for the weather archive.)` : ''); return; }
    if (lateBills) result.warnings.unshift({ level: 'warn', text: `${lateBills} bill${lateBills > 1 ? 's are' : ' is'} too recent for the weather archive (about a week behind) and ${lateBills > 1 ? 'were' : 'was'} left out.` });
    show({ kind: 'yours', input, result, quotes: ed.quotes.map((q) => ({ ...q })), climate, place: ed.place });
    msg.className = 'msg good'; msg.textContent = 'Done. Your result is at the top.';
    history.replaceState(null, '', '#' + encodeShare());
    if (scroll) $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    msg.className = 'msg bad'; msg.textContent = err.message || String(err);
  } finally { $('#run').disabled = false; }
}
$('#run').addEventListener('click', () => run());

// ---------- share + print ----------

const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

function encodeShare() {
  const d = {
    v: 1, p: [ed.place.name, ed.place.lat, ed.place.lon], s: ed.system, e: ed.efficiency, u: ed.unit, t: Math.round(ed.theta * 10) / 10,
    b: ed.bills.filter((b) => b.start && b.end && Number.isFinite(b.amount)).map((b) => [b.start, dayNumber(b.end) - dayNumber(b.start), b.amount]),
    q: ed.quotes.filter((q) => q.tons > 0).map((q) => [q.label, q.tons, q.cap5 || 0, q.cap17 || 0, q.min47 || 0]),
  };
  return 'r=' + b64(JSON.stringify(d));
}
function decodeShare(hash) {
  const m = hash.match(/r=([A-Za-z0-9_-]+)/);
  if (!m) return false;
  const d = JSON.parse(unb64(m[1]));
  Object.assign(ed, {
    place: { name: d.p[0], lat: d.p[1], lon: d.p[2] }, system: SYSTEMS[d.s] ? d.s : 'gasOld', efficiency: d.e, unit: UNITS[d.u] ? d.u : 'therm', theta: d.t,
    bills: d.b.map(([s, days, a]) => ({ start: s, end: isoFromDay(dayNumber(s) + days), amount: a })),
    quotes: d.q.map(([label, tons, cap5, cap17, min47]) => ({ label, tons, cap5: cap5 || undefined, cap17: cap17 || undefined, min47: min47 || undefined })),
  });
  return true;
}

$('#share').addEventListener('click', async () => {
  const btn = $('#share');
  let url = location.href.split('#')[0];
  if (shown?.kind === 'yours') url += '#' + encodeShare(); else url += '#example';
  try { await navigator.clipboard.writeText(url); btn.textContent = 'Link copied'; }
  catch { prompt('Copy this link:', url); }
  setTimeout(() => { btn.textContent = 'Copy link to this result'; }, 2000);
});
$('#print').addEventListener('click', () => {
  $('#numbers').open = true;
  document.title = `Rightsize report · ${shown?.place?.name || ''}`;
  window.print();
});

// ---------- start ----------

fillSelects();
syncEditor();
(async () => {
  await loadSample();
  if (location.hash.includes('r=')) {
    try {
      decodeShare(location.hash);
      syncEditor();
      show(sampleView());
      $('#headline').textContent = 'Loading the shared result…';
      await run({ scroll: false });
      if (shown.kind !== 'yours') {
        show(sampleView());
        $('#checks').insertAdjacentHTML('afterbegin', `<li class="warn">The shared result couldn't be rebuilt: ${esc($('#run-msg').textContent)} Showing the example instead.</li>`);
      }
      return;
    } catch (err) {
      console.warn('Bad share link', err);
      show(sampleView());
      $('#checks').insertAdjacentHTML('afterbegin', '<li class="warn">That shared link looks damaged or incomplete, so here is the example instead.</li>');
      return;
    }
  }
  show(sampleView());
})();
// Opening another shared link in this tab only changes the #, so rebuild from it.
addEventListener('hashchange', () => {
  if (location.hash.includes('r=') && location.hash.slice(1) !== encodeShareSafe()) location.reload();
});
function encodeShareSafe() { try { return ed.place ? encodeShare() : ''; } catch { return ''; } }
