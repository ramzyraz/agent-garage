// Turn pasted bill text or a utility CSV export into [{ start, end, amount }].
import { dayNumber, isoFromDay } from './model.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');

function validIso(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return isoFromDay(dayNumber(iso)) === iso ? iso : null;
}

// Find dates in a line. Returns [{ iso, at, len, monthOnly }].
// Slash dates are read as month/day/year unless the first part is over 12 (then day/month/year),
// or `dayFirst` is set for the whole paste.
export function findDates(line, dayFirst = false) {
  const out = [];
  let m;
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/g;
  while ((m = iso.exec(line))) { const v = validIso(+m[1], +m[2], +m[3]); if (v) out.push({ iso: v, at: m.index, len: m[0].length }); }
  const slash = /(?<![\d-])(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})(?![\d-])/g;
  while ((m = slash.exec(line))) {
    let a = +m[1], b = +m[2], y = +m[3];
    if (y < 100) y += 2000;
    const df = dayFirst || a > 12;
    const v = df ? validIso(y, b, a) : validIso(y, a, b);
    if (v) out.push({ iso: v, at: m.index, len: m[0].length });
  }
  const named = /\b(\d{1,2})?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{1,2}(?!\d))?,?\s*(\d{4})\b/gi;
  while ((m = named.exec(line))) {
    const mon = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    const day = +(m[1] || m[3] || 0);
    const v = validIso(+m[4], mon, day || 1);
    if (v) out.push({ iso: v, at: m.index, len: m[0].length, monthOnly: !day });
  }
  return out.sort((p, q) => p.at - q.at);
}

function lastNumber(line, dates) {
  let rest = line;
  for (const d of [...dates].sort((p, q) => q.at - p.at)) rest = rest.slice(0, d.at) + ' '.repeat(d.len) + rest.slice(d.at + d.len);
  // Drop money amounts so "$84.10" isn't read as usage when usage comes first.
  const nums = [...rest.replace(/[$£€]\s?[\d,]+(\.\d+)?/g, ' ').matchAll(/-?\d[\d,]*(\.\d+)?/g)].map((x) => parseFloat(x[0].replace(/,/g, '')));
  return nums.length ? nums[0] : null;
}

export function parsePasted(text, { dayFirst = false } = {}) {
  const rows = [];
  const skipped = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const dates = findDates(line, dayFirst);
    const amount = lastNumber(line, dates);
    if (!dates.length || amount == null) { skipped.push(line); continue; }
    if (dates.length >= 2) rows.push({ start: dates[0].iso, end: dates[1].iso, amount });
    else if (dates[0].monthOnly) {
      const s = dayNumber(dates[0].iso);
      const d = new Date(s * 86400000); d.setUTCMonth(d.getUTCMonth() + 1);
      rows.push({ start: dates[0].iso, end: d.toISOString().slice(0, 10), amount });
    } else rows.push({ read: dates[0].iso, amount });
  }
  // Single read dates: each bill runs from the previous read to this one.
  const reads = rows.filter((r) => r.read).sort((p, q) => p.read.localeCompare(q.read));
  const bills = rows.filter((r) => !r.read);
  for (let i = 1; i < reads.length; i++) bills.push({ start: reads[i - 1].read, end: reads[i].read, amount: reads[i].amount });
  if (reads.length === 1) skipped.push('A single meter-read date needs a second one before it.');
  bills.sort((p, q) => p.start.localeCompare(q.start));
  return { bills: bills.filter((b) => b.end > b.start), skipped };
}

// Green Button / utility "download my data" CSV: interval rows with a date (and maybe times) and usage.
// Rows are summed into 7-day periods so each point averages over a week of weather.
export function parseUsageCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headerAt = lines.findIndex((l) => /usage|consumption|quantity|value/i.test(l) && /date|start/i.test(l));
  if (headerAt < 0) return null;
  const split = (l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').trim()).filter((_, i, a) => i < a.length);
  const head = split(lines[headerAt]).map((h) => h.toLowerCase());
  const dateCol = head.findIndex((h) => /^date$|start date|^start|interval start|read date/.test(h));
  const useCol = head.findIndex((h) => /usage|consumption|quantity|^value/.test(h));
  const unitCol = head.findIndex((h) => /^units?$/.test(h));
  if (dateCol < 0 || useCol < 0) return null;
  const perDay = new Map();
  let unit = null;
  for (const l of lines.slice(headerAt + 1)) {
    const c = split(l);
    const d = findDates(c[dateCol] || '');
    const v = parseFloat((c[useCol] || '').replace(/,/g, ''));
    if (!d.length || !Number.isFinite(v)) continue;
    const day = dayNumber(d[0].iso);
    perDay.set(day, (perDay.get(day) || 0) + v);
    if (unitCol >= 0 && c[unitCol]) unit = c[unitCol].toLowerCase();
  }
  const days = [...perDay.keys()].sort((a, b) => a - b);
  if (days.length < 14) return null;
  const bills = [];
  for (let s = days[0]; s + 7 <= days.at(-1) + 1; s += 7) {
    let sum = 0, have = 0;
    for (let d = s; d < s + 7; d++) if (perDay.has(d)) { sum += perDay.get(d); have++; }
    if (have === 7) bills.push({ start: isoFromDay(s), end: isoFromDay(s + 7), amount: Math.round(sum * 100) / 100 });
  }
  const guess = unit && (/therm/.test(unit) ? 'therm' : /ccf/.test(unit) ? 'ccf' : /kwh/.test(unit) ? 'kwh' : /m3|m³|cubic met/.test(unit) ? 'm3' : null);
  return { bills, unit: guess, days: days.length };
}
