# Review after session 19

**In one sentence:** Untangle turns an inherited Excel workbook into an explorable map, points out suspicious formulas, and shows how a changed input or proposed repair affects the answers.

Reviewed the live current project in Chrome at 1440×1000 and 390×844 with touch, using the sample, two uploaded workbooks, invalid files/values, and offline loading; inspected screenshots and the exported report.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | Clear promise, immediate sample, no account or setup. The initial map is much less striking than the promise. |
| Wow: would I show someone? | 7 | The salary-to-profit trace and repair consequences earn a demonstration; the default stack of cards does not. |
| Usefulness: does it solve the problem? | 7 | Strong navigation, formula trees, exact issue locations and honest checks. Large-workbook previews can fail to reach the answer people need. |
| Fun / replay: would I come back? | 6 | Exploring mistakes and consequences is satisfying; repeat use depends on having another workbook to investigate. |
| Shareability: does it make me send it on? | 6 | A useful recommendation for spreadsheet owners; the local HTML report shares evidence, but discovering that requires entering a preview. |
| Polish: bugs, layout, rough edges | 7 | Readable, responsive and careful with invalid inputs. Preview navigation loses context, and the default overview wastes space. |

## Top 3 problems

1. **The what-if feature stops short on a very ordinary large model.** Upload `large-review.xlsx`: 10,000 rows of `=A[row]*Assumptions!$B$1`, with `Summary!B1=SUM(Detail!B2:B10001)`. Open Multiplier and preview 2 → 3. The map knows about 10,001 dependents and the final total, but the preview calculates only 999 dependent changes, reports 1,001 unsupported/unverified and 8,000 unchecked, and features three individual Revenue rows instead of Total revenue. The warning is honest; the task remains unsolved. These are basic multiplication and SUM formulas, not exotic Excel features.

2. **Inspecting a trace step discards the preview context.** On the phone, open the sample → Try a higher salary → Average net margin → Staff · 2027. The preview closes and opens Costs!C6 with its original 912,000 value. There is no visible “return to preview” control. Following the evidence interrupts the investigation; for a custom value, users must reconstruct their scenario. Preserve the value, selected outcome and scroll position, and provide a return route.

3. **The default “Compact overview” buries the strongest visual.** Open the sample on desktop: six sheets become large stacked cards, pushing Dashboard and the useful summaries below the first screen. At 390px, single-sheet stages use only about half the available card width and leave a tall empty column. Switching to Diagram on desktop reveals a legible whole-workbook flow immediately. The default looks like a directory, while the better view actually explains the relationships.

## What's genuinely good

- The salary preview gives a concrete outcome: 38,000 → 42,000 changes five-year net profit from -1,341,919 to -1,797,919, with a readable cross-sheet chain and the short-SUM warning carried into it.
- Costs!F6 identifies a typed-over formula, proposes the exact replacement, and previews both profit and the change in best year. This is actionable spreadsheet auditing.
- A separate uploaded workbook resolved a named range and SUMIF correctly, detected a saved 99 where recalculation gave 11, and withheld that unverified result from the what-if calculation.
- 10,000 copied formulas really became one readable block; the large workbook mapped in about half a second here. Compression earns the headline claim.
- Offline file loading worked. Invalid workbook and number entries received clear errors. The exported repair report opened independently and contained the trace, formulas, values and every calculated change.

## The one change that would make it more wow-worthy

Make previews work backward from a chosen final answer through compressed formula blocks. The 10,000-row workbook should show **Total revenue: 100,010,000 → 150,015,000**, with the affected blocks highlighted on the map. Reaching the business answer at realistic scale would turn an impressive demo into a tool an inheritor can depend on.
