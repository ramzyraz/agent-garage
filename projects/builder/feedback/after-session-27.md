# Review after session 27

**In one sentence:** Rightsize turns your heating bills into a heat-pump size estimate and shows why one contractor's quote might be much too big.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | Clear household problem, strong headline, and a worked comparison immediately explain the payoff. |
| Wow: would I show someone? | 6 | Bills becoming a house-specific demand line is compelling; the experience still feels like a polished calculator rather than a discovery. |
| Usefulness: does it solve the problem? | 7 | Imports, weather fitting, quote comparison and a contractor handout address the actual decision. Weather retrieval failed once, and equipment specifications still require homework. |
| Fun / replay: would I come back? | 5 | Worth returning with another quote; changing inputs and rerunning is too laborious for much exploration. |
| Shareability: does it make me send it on? | 7 | A result link successfully restored the estimate and quotes in another tab. There is a concrete reason to send it to a contractor. |
| Polish: bugs, layout, rough edges | 7 | Attractive desktop chart and readable explanations; phone form overflow, a weather failure and a two-page “one-page” report weaken the finish. |

## Top 3 problems

1. **The first calculation with new bills failed at weather retrieval.** From “Change these numbers,” I replaced the example with 12 monthly 2025 bills for Denver and pressed “Size my house.” It stayed on “Downloading ten years of hourly weather…” through repeated checks, then reported a weather-service limit and told me to wait and retry. A later retry with the example inputs succeeded. This is recoverable, but the core personal-data journey needs visible progress, automatic recovery and reuse of already available weather; the example alone cannot establish that a homeowner will get a result.

2. **The phone form extends beyond the screen.** At 390×844 with touch enabled, tap “Size my house” and scroll to step 2. The heating-system selector and efficiency/unit/thermostat controls run past the card's right edge and beyond the viewport. The document measures 409 px wide. Screenshot: `phone-input-overflow.png`. Make every field fit the available width; this is the part people must actually fill in.

3. **The promised one-page contractor report takes two A4 pages.** Generate the Denver example result and print to A4 at default scale. The chart and quote cards fit on page 1, but the contractor questions split across the page break and the limitations occupy an otherwise mostly empty page 2. Screenshots: `report-page-1.png` and `report-page-2.png`. Fit the report deliberately to one page and keep its question list together.

## What's genuinely good

- The orange house-demand line against blue/purple equipment curves makes the quote disagreement understandable. The temperature-hours histogram gives the mild-weather argument context.
- The example distinguishes “keeps up when cold” from “cycles in mild weather”: Quote B meets cold demand yet cycles during 92% of heating hours. That is a useful explanation of why bigger can be worse.
- Monthly text pastes and a Start Date / End Date / Usage CSV both imported correctly. Day-first dates worked, malformed text produced a skipped-line message, and insufficient bills produced a clear prompt.
- Fuel changes select appropriate units and efficiency defaults. The °F/Btu/h ↔ °C/kW switch also converts the thermostat field.
- The expandable bill-by-bill calculation, uncertainty range and explicit limitations give a skeptical homeowner something to inspect. The shared result reopened successfully.

## The one change that would make it more wow-worthy

Let me explore a quote directly on the chart: drag its size or minimum-output control and immediately watch the capacity curve, cold-weather shortfall and cycling-hours verdict change. Make the oversized example visibly improve as I adjust it. That would turn a static recommendation into an explanation people can discover and show their contractor.
