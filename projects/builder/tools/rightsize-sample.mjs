// Builds site/builder/rightsize/sample.json: a made-up Denver house on real Denver weather.
// Usage: node projects/builder/tools/rightsize-sample.mjs
// Weather: Open-Meteo historical archive (ERA5), fetched once and stored so the sample works offline.
import { writeFileSync } from 'node:fs';
import { climateStats, dayNumber, isoFromDay, rng } from '../../../site/builder/rightsize/model.js';

const lat = 39.7392, lon = -104.9847;
const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
  `&start_date=2016-01-01&end_date=2025-12-31&hourly=temperature_2m&temperature_unit=fahrenheit&timezone=auto`;
const data = await (await fetch(url)).json();
const temps = data.hourly.temperature_2m;
const startDay = dayNumber('2016-01-01');
const climate = climateStats(temps);

// The made-up house: 425 Btu/h per °F of heat loss, 1,500 Btu/h of internal gains,
// 80% furnace, thermostat averaging 68 °F, 0.75 therm/day for hot water and cooking.
const house = { ua: 425, gains: 1500, eff: 0.8, theta: 68, base: 0.75 };
const reads = ['2024-09-27', '2024-10-28', '2024-11-25', '2024-12-27', '2025-01-28', '2025-02-26',
  '2025-03-27', '2025-04-28', '2025-05-28', '2025-06-26', '2025-07-28', '2025-08-27', '2025-09-26'];
const rand = rng(7);
const bills = [];
for (let i = 1; i < reads.length; i++) {
  const s = dayNumber(reads[i - 1]), e = dayNumber(reads[i]);
  let heat = 0;
  for (let h = (s - startDay) * 24; h < (e - startDay) * 24; h++) heat += Math.max(0, house.ua * (house.theta - temps[h]) - house.gains);
  const therms = (heat / house.eff) / 1e5 + house.base * (e - s);
  const noisy = therms * (1 + (rand() - 0.5) * 0.12);
  bills.push({ start: reads[i - 1], end: reads[i], amount: Math.round(noisy) });
}

const seriesFrom = dayNumber(reads[0]) - 2, seriesTo = dayNumber(reads.at(-1)) + 2;
const series = temps.slice((seriesFrom - startDay) * 24, (seriesTo - startDay) * 24).map((t) => Math.round(t * 10) / 10);
const histogram = Object.fromEntries(Object.entries(climate.histogram).map(([k, v]) => [k, Math.round(v * 10) / 10]));

const sample = {
  note: 'Made-up house with real Denver weather (Open-Meteo / ERA5). Bills generated from the house above with ±6% noise.',
  place: { name: 'Denver, Colorado', lat, lon, timezone: data.timezone },
  house,
  bills, unit: 'therm', system: 'gasOld', theta: 68,
  // Illustrative spec-sheet numbers (not a specific model): a cold-climate 2.5 ton and a standard 4 ton.
  quotes: [{ label: 'Quote A', tons: 2.5, cap5: 25500, cap17: 28000, min47: 8500 }, { label: 'Quote B', tons: 4, cap5: 30000, cap17: 36000, min47: 19000 }],
  weather: { startDay: seriesFrom, startIso: isoFromDay(seriesFrom), temps: series },
  climate: { years: climate.years, t99: Math.round(climate.t99 * 10) / 10, t996: Math.round(climate.t996 * 10) / 10, coldest: climate.coldest, histogram, span: '2016–2025' },
};
writeFileSync(new URL('../../../site/builder/rightsize/sample.json', import.meta.url), JSON.stringify(sample));
console.log(bills, sample.climate.t99, `${series.length} hours`);
