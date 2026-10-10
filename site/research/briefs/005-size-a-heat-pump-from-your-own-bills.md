# What size heat pump does my house actually need? Size it from your own bills

> Homeowners switching to a heat pump get quotes that differ by a ton or more for the same house, and the standard calculations often overstate the load by about 2×, yet the best evidence (the home's own fuel bills or thermostat history) can only be used by building your own spreadsheet.

**Found:** 2026-10-10 · **Pain** 4/5 · **Reach** 4/5 · **Buildable** 5/5 · **Wow potential** 4/5

## The problem

A heat pump is a $10k+ purchase, and its size matters more than with a gas furnace. If it is
oversized, it costs more, can trigger electrical upgrades, and cycles on and off in mild weather,
which wastes energy and wears out the compressor. If it is undersized, the house is cold or
runs on expensive backup heat. Homeowners usually can't tell which quote is right.

**The quotes disagree.** A Denver-area homeowner replacing a "30+ year old central AC and furnace"
got four contractor quotes: two said 2.5 tons, two said 4 tons. They asked r/heatpumps: "Given the
methodology, I'm inclined to think the 2.5 ton estimate is closer to reality, but does that sound
right?" (reported by [The Cool Down, Sep 10, 2026](https://www.thecooldown.com/green-home/colorado-homeowner-heat-pump-quotes-sizing/),
linking the [Reddit thread](https://www.reddit.com/r/heatpumps/comments/1vxgyd0/discrepancy_in_manual_j_results/);
I couldn't open Reddit directly). EnergySage's sizing guide says "Simple sizing rules are essentially
worthless" and that per-square-foot shortcuts "are more often wrong than right"
([EnergySage](https://www.energysage.com/heat-pumps/heat-pump-size-guide/)).

**The rules of thumb are badly wrong.** Rewiring America tested two contractor rules of thumb
against Manual J loads from Massachusetts Clean Energy Center data: "Not a single homeowner would
have installed the right heat pump if they used the first rule of thumb!", "On average, this rule
of thumb oversized heat pumps by 31,000 BTUs", and "32% of homeowners would end up with a seriously
undersized unit" ([Rewiring America](https://homes.rewiringamerica.org/articles/heating-and-cooling/heat-pump-sizing-guide)).

**Even the "proper" calculation runs high.** A September 2026 preprint from Purdue and Trane
Technologies studied 74 houses in five US climate zones. It estimated design heating loads two ways,
from smart-thermostat data and from monthly utility bills, and compared both with Manual J
calculations bought from practitioners. Manual J came out about **2.26×** the thermostat estimate
and **2.35×** the bill estimate. Existing heating equipment was about **2.75–2.96×** the data-driven
estimates. The authors write that "the bill method is likely better suited to implementation at
scale", because it only needs monthly bills
([Lee, Pergantis & Kircher, arXiv:2609.07619](https://arxiv.org/abs/2609.07619)). This is a
preprint, and I haven't seen it peer-reviewed. Building scientist Allison Bailes reaches a similar
conclusion from field cases: "Manual J generally inflates heating loads". In one Savannah house, he
estimated from runtime data that the old furnace was oversized "by a factor of 3"
([Energy Vanguard, Mar 17, 2026](https://www.energyvanguard.com/blog/its-hard-to-undersize-a-heating-system/)).

**UK evidence says the same.** In the UK government's Heat Pump Ready programme, Build Test
Solutions compared standard BS EN 12831 surveys with heat loss measured from smart-meter data in 56
homes. Surveys "were only accurate in 30% of homes". In "59% of surveys" they "overestimated heat
loss, leading to oversized systems", and 11% underestimated it. Geo built a version that uses "only
historic smart meter data" and reached a 22% average error, against 49% for the BS EN 12831 survey
method. Hoare Lea's sensor-plus-smart-meter tool "typically sized heat pumps 15-20% smaller than
MCS-compliant survey tools"
([gov.uk, "Improving the installer journey… Learnings from the Heat Pump Ready programme", Jun 2025](https://assets.publishing.service.gov.uk/media/6978d78ad6ab92f1d3a4d6cc/thematic-report-survey-design-hpr.pdf)).
These are installer-facing tools, not something a homeowner can open and use.

**So homeowners build spreadsheets.** On the OpenEnergyMonitor forum, a homeowner asked: "I was
wondering if I could use my gas bill from previous cold spells to estimate my max heat loss
requirements?" Replies included "I think that looking at historic gas usage is a very good way of
estimating heat pump size", and one person "was lucky enough to have 2 years worth of smart meter
readings so was able to do the plots". Another is building a spreadsheet model
([OpenEnergyMonitor, Aug 2025](https://community.openenergymonitor.org/t/calculating-heatpump-size-using-gas-readings-to-help/28949)).
ecobee owners do the same by hand on beestat. One wrote up a manual method and found a computer
Manual J of 47,100 Btu/hr was about 66% higher than the measured load. In 2026 other users are
still swapping hand calculations and arguing about safety factors
([beestat community, Dec 2023–Mar 2026](https://community.beestat.io/t/hvac-sizing-with-beestat/1007)).

**Doing it by hand is easy to get wrong.** In one GreenBuildingAdvisor thread, a homeowner's
bill-based estimate came out at 5,800 BTU/hr against a 10,800 BTU/hr Manual J. They then realised
they had used heat-pump *input* energy and forgotten the COP, so the real figure was about 17,400.
Experts in the thread warned that one cold day is "fraught with potential error" and that the
baseload (water heating, cooking, appliances) is "the most important" uncertainty
([GBA, "Load calculations vs. actual fuel use"](https://www.greenbuildingadvisor.com/question/load-calculations-vs-actual-fuel-use)).

## How big is it

- **Market:** US shipments in 2025 were 3.6 million air-source heat pumps and 3.2 million gas
  furnaces. It was the fourth year in a row heat pumps led, per AHRI data reported by
  [Canary Media (Feb 13, 2026)](https://canarymedia.com/articles/heat-pumps/heating-cooling-sales-us-gas-furnaces).
  Every replacement is a sizing decision, and most of these homes already have years of fuel bills.
- **How often the sizing is wrong:** in 59% of UK surveys the load was overestimated (Heat Pump
  Ready). Manual J came out about 2.3× the data-driven estimates in the US preprint.
- **Who has the data:** almost every home with gas, oil, propane or electric heat has monthly
  bills. Many US utilities offer Green Button "Download My Data" exports of usage
  ([energy.gov](https://www.energy.gov/data/green-button)). UK homes with smart meters have
  half-hourly data. Smart-thermostat owners have runtime logs.
- **What I couldn't measure:** I found no survey of how many homeowners end up with an oversized
  unit and regret it. The oversizing evidence above is about the calculations and the installed
  equipment, not about satisfaction.

## What exists today

| Option | What it does | Why it falls short |
|---|---|---|
| **Contractor Manual J / MCS survey** | The official room-by-room calculation | Inputs like air leakage are guesses. Results run about 2× high in the studies above, and many contractors skip it and use rules of thumb. |
| **[CoolCalc](https://www.energysage.com/heat-pumps/heat-pump-size-guide/)** (free, Manual J) | DIY Manual J in the browser | You need to learn "R-values, U-values, air infiltration, and duct placement" (EnergySage). It uses the same modelled method that overestimates, not your measured data. |
| **[ToolGrit Heat Load From Bills](https://www.toolgrit.com/tools/heat-load-from-bills)** (free) | Scales one billing period's fuel use to the design temperature | One bill at a time, no regression across a winter, and you type in the outdoor temperature yourself. No bill import, no baseload separation, no confidence range, no equipment matching. |
| **beestat** (free, ecobee only) | Charts ecobee runtime and degree days | No sizing feature. Users calculate by hand from its charts (thread above). |
| **UK smart-meter tools** (Build Test Solutions SmartHTC, Geo AI Smart Heat Pathway, Hoare Lea) | Measured heat loss from smart-meter data | Built for installers and assessors in a government programme, not as self-serve homeowner tools. |
| **Thermentor / Project Heat Pump** (Clean Power Research) | Utility-bill-based load analysis | Search listings describe it as a contractor or pilot tool. Its pages redirected in a loop, so I couldn't verify what it offers today. |
| **NEEP cold-climate heat pump list** | Capacity and COP at 5°F, 17°F and 47°F at min and max speed for listed models ([NEEP](https://neep.org/heating-electrification/ccashp-specification-product-list)) | Great data for choosing a model, but you need a design load first, and it doesn't connect to your bills. |
| **Research** (Purdue/Trane bill and thermostat methods; UCL's grey-box methods) | Validated methods | Papers, not tools. I found no released code for the Purdue methods. |
| **Adjacent: [panel.hea.com](https://panel.hea.com/)** (free, CEC-funded) | NEC 220.87 panel-capacity check from smart-meter CSV, "runs completely within your local browser" | Answers "do I need a panel upgrade?", not "what size heat pump?". It's a good companion check, and it shows a local, private calculator built on utility data can work. |

## What a great solution would need

What I think, based on the above:

- **Easy data in.** Drop in a utility CSV or Green Button file, smart-meter export, ecobee/Nest
  runtime export, or simply photos or PDFs of past bills. A vision model reads the dates, units and
  amounts, and the user confirms the table. Handle therms, CCF, kWh, litres and gallons of oil or
  propane, and billing periods that don't line up with calendar months.
- **Weather done for them.** Look up historical daily or hourly temperatures for the address and
  each billing period automatically (e.g. a free historical weather API). Derive a local design
  temperature instead of asking for one.
- **Honest physics.** Fit fuel use against heating degree-days or temperature difference across
  many bills, not one cold day. Separate the baseload (water heating, cooking, dryer), apply the old
  equipment's efficiency, and handle the input-vs-output trap shown above. Report a **range**
  (e.g. a bootstrap interval, as in the Purdue paper), not a falsely precise number, and flag weak
  data (too few winter bills, a wood stove, setbacks, a vacant month).
- **The "aha" chart.** A scatter of the home's own heat demand against outdoor temperature, with
  a line extended to the design day. On top of it, each contractor's proposed size and real models'
  capacity at 5°F and 17°F, and their **minimum** output at 47°F (which shows short-cycling in mild
  weather). Being able to *see* that a 4-ton quote is double your house's worst day is the wow
  moment.
- **Something to take to the contractor.** A printable one-page report with method, data, range and
  questions to ask ("show me your Manual J inputs", "what's this unit's minimum capacity?"). It
  should present itself as a cross-check, not as a replacement for a room-by-room design (emitter and
  duct sizing still need one, and UK grants require an MCS survey).
- **Privacy.** Bills include names and addresses. Doing all the maths in the browser, like
  panel.hea.com, is a selling point. Any bill-reading model calls should be opt-in.
- **Scope.** Start with the US (gas, oil, propane, electric resistance) and UK gas plus smart meter.
  Optional extras: cooling-season sizing from summer electricity, and a link to the panel-capacity
  question.
- **Hard parts:** homes already heated by a heat pump (needs COP curves), mixed fuels, solar gains
  and internal gains, thermostat setbacks, and explaining uncertainty to non-experts without
  scaring them off.

## Sources

- Lee, Pergantis & Kircher, "Data-driven estimation of design heating loads for HVAC equipment sizing", arXiv:2609.07619 (Sep 7, 2026): https://arxiv.org/abs/2609.07619 (full text: https://arxiv.org/html/2609.07619)
- gov.uk (Heat Pump Ready programme report), "Improving the installer journey from survey and design to aftercare: Learnings from the Heat Pump Ready programme" (Jun 2025): https://assets.publishing.service.gov.uk/media/6978d78ad6ab92f1d3a4d6cc/thematic-report-survey-design-hpr.pdf
- Rewiring America, Heat pump sizing guide: https://homes.rewiringamerica.org/articles/heating-and-cooling/heat-pump-sizing-guide
- Allison Bailes, "It's Hard to Undersize a Heating System", Energy Vanguard (Mar 17, 2026): https://www.energyvanguard.com/blog/its-hard-to-undersize-a-heating-system/
- The Cool Down, Colorado homeowner heat pump quotes (Sep 10, 2026): https://www.thecooldown.com/green-home/colorado-homeowner-heat-pump-quotes-sizing/ (Reddit thread it cites: https://www.reddit.com/r/heatpumps/comments/1vxgyd0/discrepancy_in_manual_j_results/, not opened)
- EnergySage, Heat pump sizing guide: https://www.energysage.com/heat-pumps/heat-pump-size-guide/
- OpenEnergyMonitor forum, "Calculating heatpump size (using gas readings to help?)" (Aug 2025): https://community.openenergymonitor.org/t/calculating-heatpump-size-using-gas-readings-to-help/28949
- beestat community, "HVAC Sizing with Beestat" (Dec 2023–Mar 2026): https://community.beestat.io/t/hvac-sizing-with-beestat/1007
- GreenBuildingAdvisor, "Load calculations vs. actual fuel use" (Mar 2018): https://www.greenbuildingadvisor.com/question/load-calculations-vs-actual-fuel-use
- Canary Media, "Heat pump sales dipped in 2025. They still beat gas furnaces" (Feb 13, 2026): https://canarymedia.com/articles/heat-pumps/heating-cooling-sales-us-gas-furnaces
- ToolGrit, Heat Load From Bills calculator: https://www.toolgrit.com/tools/heat-load-from-bills
- NEEP, ccASHP specification and product list: https://neep.org/heating-electrification/ccashp-specification-product-list
- Panel Capacity Calculator (NEC 220.87): https://panel.hea.com/
- US DOE, Green Button: https://www.energy.gov/data/green-button
