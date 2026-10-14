// Historical weather from Open-Meteo (free, no key). Only a place name or rounded
// coordinates are sent; bill amounts never leave the browser.
import { climateStats, dayNumber, isoFromDay } from './model.js';

export async function searchPlaces(query) {
  const q = query.trim();
  if (!q) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
  const data = await fetchJson(url, 8000, 'Place search');
  return (data.results || []).map((r) => ({
    name: [r.name, r.admin1, r.country_code === 'US' ? null : r.country].filter(Boolean).join(', '),
    lat: Math.round(r.latitude * 100) / 100,
    lon: Math.round(r.longitude * 100) / 100,
  }));
}

const cache = new Map();

// Weather (never bills) is kept in localStorage as tenths of a degree, so reopening a result
// or a shared link doesn't download ten years again. About 230 KB per place; the oldest is dropped.
const STORE = 'rightsize-weather:';
function storeGet(key) {
  try {
    const raw = localStorage.getItem(STORE + key);
    if (!raw) return null;
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    return Array.from(new Int16Array(bytes.buffer), (v) => (v === -32768 ? null : v / 10));
  } catch { return null; }
}
function storePut(key, temps) {
  const ints = Int16Array.from(temps, (t) => (t == null ? -32768 : Math.round(t * 10)));
  const bytes = new Uint8Array(ints.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const value = btoa(bin);
  for (let tries = 0; tries < 4; tries++) {
    try { localStorage.setItem(STORE + key, value); return; } catch {
      const old = Object.keys(localStorage).filter((k) => k.startsWith(STORE));
      if (!old.length) return;
      localStorage.removeItem(old[0]);
    }
  }
}

// fetch with a time limit and one retry: a stalled connection shouldn't leave "Searching…" forever.
async function fetchJson(url, ms, what, advice = ' Check your connection and try again.') {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
      if (!res.ok) throw new Error(`${what} failed (${res.status}).`);
      return await res.json();
    } catch (e) {
      if (attempt === 1) throw new Error((e.name === 'TimeoutError' ? `${what} took too long.` : e.message.startsWith(what) ? e.message : `${what} failed.`) + advice);
    }
  }
}

// Hourly temps (°F) covering the bills, plus 10 full years for the design temperature.
export async function loadWeather(place, bills, now = new Date()) {
  const thisYear = now.getUTCFullYear();
  const climateFrom = dayNumber(`${thisYear - 10}-01-01`), climateTo = dayNumber(`${thisYear - 1}-12-31`);
  const first = Math.min(...bills.map((b) => dayNumber(b.start))) - 1;
  const last = Math.max(...bills.map((b) => dayNumber(b.end))) + 1;
  const latest = Math.floor(now.getTime() / 86400000) - 6; // the archive lags by about 5 days
  const from = Math.min(first, climateFrom), to = Math.min(Math.max(last, climateTo), latest);
  const key = `${place.lat},${place.lon},${from},${to}`;
  if (!cache.has(key)) {
    const stored = storeGet(key);
    if (stored) cache.set(key, Promise.resolve(stored));
  }
  if (!cache.has(key)) {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${place.lat}&longitude=${place.lon}` +
      `&start_date=${isoFromDay(from)}&end_date=${isoFromDay(to)}&hourly=temperature_2m&temperature_unit=fahrenheit&timezone=auto`;
    cache.set(key, fetchJson(url, 30000, 'Weather download', ' The free weather service limits how much each connection can download per minute: wait a minute, then press Size my house again.').then((data) => {
      if (!data.hourly) throw new Error(data.reason || 'Weather service returned no data.');
      storePut(key, data.hourly.temperature_2m);
      return data.hourly.temperature_2m;
    }));
  }
  let temps;
  try { temps = await cache.get(key); } catch (e) { cache.delete(key); throw e; }
  const climateTemps = temps.slice((climateFrom - from) * 24, (climateTo + 1 - from) * 24);
  const climate = climateStats(climateTemps);
  climate.span = `${thisYear - 10}–${thisYear - 1}`;
  return {
    weather: { startDay: from, temps },
    climate,
    lateBills: bills.filter((b) => dayNumber(b.end) > latest).length,
  };
}
