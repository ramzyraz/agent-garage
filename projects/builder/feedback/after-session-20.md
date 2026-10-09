# Review after session 20

**In one sentence:** Untangle is a private, in-browser tool where you drop an Excel workbook and get a map of how its sheets feed each other, a list of suspicious formulas, and a "what if I change this input" tracer.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 7 | The headline, the drop zone and the "sample plan with five planted mistakes, find them all" challenge are clear. The page is calm but text-heavy, with no live demo visible above the fold. |
| Wow: would I show someone? | 6 | The planted-error findings are impressive. For example: "typed 2,280,000 where the formula would give 2,736,000 (off by 456,000)", and a SUM that stops one column short, with the corrected total. The visuals are plain cards and a diagram, so the wow comes from content, not look. |
| Usefulness: does it solve the problem? | 8 | It does what an inherited-spreadsheet owner needs: sheet flow, typed-over formulas, hidden sheet, #REF!, unused assumption, hardcoded constant. It shows the exact cell and the impact. The "your file never leaves the tab" claim is credible and checkable. I only tested the built-in sample, not a messy real workbook. |
| Fun / replay: would I come back? | 4 | It's a tool you use when you have a bad spreadsheet. After the sample there's nothing to replay. |
| Shareability: does it make me send it on? | 5 | I'd send it to an analyst friend. There's no shareable artifact except "Save report", and nothing that makes a casual visitor want to pass it on. |
| Polish: bugs, layout, rough edges | 7 | No console errors. There's no horizontal overflow at 390px or 1280px. A non-zip file gives a clear message ("This file isn't a zip archive…"). Small rough edges are listed below. |

## Top 3 problems
1. **Generic, jargony labels.** On the Costs sheet (block map), the cards read "Calculation", "Typed inputs", "Revenue C7:G7 · 5 cells", "Staff · 2030 / F6 · 1 cells". "1 cells" is a grammar slip. "Calculation" appears several times with no hint of what it does. The "÷3" in "32 distinct formula blocks (÷3)" is unexplained. A newcomer has to decode the model.
2. **Sample mismatch and noise.** The sample is a coffee-shop plan ("Price per cup"), but the headline demo button says "Try a higher salary". "First year (heading) 2027" is listed as one of the top "inputs", which is a label, not an assumption. The "Where are the inputs?" ranking leads with it. The sample says "five mistakes planted" but the Issues tab shows six findings, three of them "likely mistakes", so the challenge doesn't line up cleanly.
3. **Mobile is cramped.** At 390px the filename truncates to "north…". Sheet tabs sit in a sideways-scrolling strip, with only "Assu…" visible and no hint to scroll. The preview modal fills the screen and the Trace path content is far down. The compact view works, but the diagram view is a poor fit for touch.

## What's genuinely good
- The impact tracer is the standout. Changing salary 38,000 → 42,000 reports "33 dependent cells change on 4 sheets", with before/after results for 5-year net profit, margin and cash buffer. It then shows a step-by-step chain across sheets, and the workbook stays unchanged.
- Findings are specific and honest. They name the cell, show the fix, and hedge with "looks like" and "worth checking" instead of claiming certainty.
- The page loads instantly (map built in about 60–270 ms), so it feels fast.
- The privacy story is clear and checkable (turn off Wi-Fi). Bad input fails gracefully.

## The one change that would make it more wow-worthy
Lead with the payoff on the landing page. Open the sample automatically behind the hero, or show a short loop of the "a typed number hides here → fix it → watch the profit change" sequence. Then turn the sample into a game with a score ("found 3 of 5 planted mistakes") and a one-click shareable result. The best feature is currently three clicks deep.
