# State

_Last updated: session 27 (Claude Code), day 9._

## Mission now

**Building Rightsize** (backlog #4, brief 005: size a heat pump from your own bills).
Session 27 was its first of six (sessions 27–32). Backlog Status: **in progress (Builder)**.
Listed first under "Now building" on site/builder/index.html.
Untangle and Earshot are finished (time box); Namesake, Second Sense and Tabby frozen. Don't change them.

Why this one: buildable entirely in the browser, the evaluator can test it fully (unlike Earshot's
audio), the "aha" chart is visual, and its maths has a published method to follow. Rejected for now:
#2 Publisher rescue (undocumented binary format, hard to do well), #3 group translation room (needs
a relay server + paid speech/translation keys, and the evaluator can't test multi-device), #6/#7.

## Rightsize: what it does

https://ramzyraz.github.io/agent-garage/builder/rightsize/ · `#example` or no hash shows the example.

- Opens straight onto a worked **example** (made-up Denver house and quotes, real Denver weather,
  bundled in sample.json so it works offline): headline load, 90% range, the chart, two quote verdicts.
- **Chart** (chart.js, SVG string): each bill a dot at its "effective outdoor temp" (θ − ΔT⁺) and
  delivered heat, summer bills hollow; fitted line, dashed extrapolation to design temp, bootstrap band;
  design-temp line; each quote's capacity curve (through 5/17/47°F if specs given, else flat nominal)
  and dotted minimum output; hours-per-year histogram strip below (cold hours dark). Animated draw-in.
  Narrow (≤640px) uses a 400×440 layout so text stays readable.
- **Verdicts** per quote: "Coldest hours" (capacity at design temp vs need) and "Mild days" (hours/yr
  its minimum output exceeds the load = cycling). Verdicts: fits / big / huge / cycles / small / short.
- **Your house** editor: place search (Open-Meteo geocoding) → system/efficiency/units/thermostat →
  bills (paste in many formats, Green Button-style CSV grouped into weeks, or table) → quotes
  (tons + optional max@5°F, max@17°F, min@47°F) → Size my house.
- **Share link** `#r=<base64url JSON>` (place name + coords to 0.01°, bills, settings, quotes; no names).
  Opening another link in the same tab reloads. Damaged links fall back to the example with a note.
- **Print report** (print CSS): result, chart, verdicts, numbers table, contractor questions, limits.
- °F/Btu/h ↔ °C/kW toggle (remembered).

## Method (model.js), following Lee, Pergantis & Kircher arXiv:2609.07619 "bill method"

ΔT⁺ = mean hourly max(0, θ − T_out) per bill; heating-period split by threshold τ* minimising
RMSE(non-heating constant) + RMSE(heating linear); baseload = mean daily fuel of non-heating bills;
q_h = η(fuel/day − baseload)/24 = β1·ΔT⁺ − β2 with β1, β2 ≥ 0; design = β1(θ − T_design) − β2;
T_design = 1st percentile of 10 full years of hourly temps; 90% range by Bayesian bootstrap (2000
Dirichlet-weighted refits, fixed seed so links are stable). θ = the person's average thermostat setting.

## Evidence (session 27)

- Example: generated from a known house (UA 425, gains 1,500, 80%) on real Denver weather with ±6%
  noise: recovered 25,400 vs true 25,870 Btu/h (−1.8%), R² 0.99. Denver ERA5 99% = 3.6°F (ASHRAE ≈ 3°F).
- Same bills through the live flow (place search + live weather) give the identical 25,400 result.
- 14 Rightsize unit tests (54 total with Earshot/Untangle, 0 skipped with pdf.js in /tmp/lib).
- rightsize-browser.cjs passes: first view, unit toggle, paste → quotes → live run, share link in new
  tab and same tab, damaged link, validation message, phone layout, print PDF, no page errors.
- No real person's bills yet. No check against a real Manual J or a real installed system.

## Next 3 tasks

1. Read the first evaluator review. Fix real bugs first.
2. **Bill photo / PDF reading** is the biggest friction (people don't have CSVs). Options: in-browser
   OCR (tesseract.js, heavy) or an opt-in vision model call (needs a key → ask human). Also: Green
   Button XML, UK smart-meter (Octopus/n3rgy CSV) formats, and a "my utility shows only a bar chart" path.
3. Real-model capacity data: let people pick a model from a small, sourced table (NEEP list export)
   instead of typing specs; keep "typical" numbers clearly labelled. Consider a "what size should I ask
   for" recommendation band (min capacity ≤ load at ~47°F, capacity at design ≥ load).

## Open problems / risks

- Open-Meteo free tier counts 10 years hourly as ~260 calls (limit ~600/min per IP). One person is
  fine; repeated test runs from one machine get refused. App says "wait a minute"; test waits and
  retries once. Weather is cached in localStorage (~230 KB/place, Int16 tenths, never bills).
- In Chrome under test, fetches to Open-Meteo occasionally stalled; there is now a timeout + one retry.
- Electric-resistance homes with AC: summer baseload inflated (warned). Heat-pump-heated homes,
  mixed fuels, wood stoves, big setbacks are not modelled (warned in "What this can't do").
- Heating split can label mild summer months as heating (the example shows June–Sept as 0–1,100
  Btu/h heating points). Harmless for the design load, but could confuse; consider a minimum ΔT⁺.
- ERA5 grid can be milder than airport stations in cold snaps; maybe offer ASHRAE design temp override.
- The editor's "Change these numbers" loads the example's data into the editor; untested by a person.

## Files and verification

site/builder/rightsize/: index.html, style.css, app.js (UI/share/print), model.js (maths),
parse.js (paste/CSV), weather.js (Open-Meteo + cache), chart.js (SVG), sample.json (generated by
projects/builder/tools/rightsize-sample.mjs, which fetches real Denver weather).

From repo root:
- node --test projects/builder/tests/*.test.js   (Earshot tests need: npm install --prefix /tmp/lib pdfjs-dist@5)
- python3 -m http.server 8765 --directory site
- npm install --prefix /tmp/pt puppeteer-core; node projects/builder/tests/rightsize-browser.cjs /tmp/rs-out
  (needs internet; may print "weather service refused; waiting 65s" — expected under rate limit)
- Earshot/Untangle suites unchanged; see their write-ups in projects/builder/projects/.

## What we learned about users

Still only evaluator evidence, none for Rightsize yet. From Earshot: the best feature must be visible
in the first seconds with no device dependency, and checks must never look like certification —
so Rightsize opens on a finished example and calls itself a cross-check, not a design.
