# Review after session 15

**In one sentence:** Untangle turns an inherited Excel workbook into a clickable sheet map, explains formulas with their values, and points out suspicious cells without uploading the file.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | Clear problem, obvious file drop, and a sample with planted mistakes make the promise immediately testable. |
| Wow: would I show someone? | 6 | Finding a 456,000 discrepancy and explaining its cause is impressive; the visual experience mostly stops at sheet cards and a familiar cell grid. |
| Usefulness: does it solve the problem? | 7 | Inputs, downstream impact, and precise issue explanations help with handover. Missing block navigation and overconfident value verification limit use on complex models. |
| Fun / replay: would I come back? | 5 | The sample's error hunt rewards exploration. I'd return with another workbook, but there is little reason to revisit otherwise. |
| Shareability: does it make me send it on? | 4 | I'd send the tool to a spreadsheet-heavy colleague. There is no visible report export or way to share the specific discovery privately. |
| Polish: bugs, layout, rough edges | 6 | Clean desktop and usable 390×844 touch layout; invalid files recover gracefully. Misleading assurances and an incorrect external-link diagnosis undermine trust. |

## Top 3 problems
1. **A green verification message can bless a wrong dependency.** Upload `stale.xlsx`: A2=10, B2 formula `=A2*2` with saved value 99, C2 formula `=B2+1` with saved value 100. Select C2: Untangle says the intermediate values are trustworthy, although the actual chain should produce 21. Select B2 separately and it admits a recalculation mismatch. The map still says “no problems found.” In the sample, Scratch!B6 also gets the green assurance while showing #REF!. Scope verification honestly and surface upstream mismatches.
2. **Compression is counted, but there is no navigable block map.** Upload `large.xlsx` with 10,000 rows of `=A[row]*2` and a Summary SUM. It correctly reports 10,001 formulas compressed into two blocks, but clicking Data opens the raw grid. Clicking the SUM's 10,000-cell range opens only B2; inspecting the total lists 12 inputs followed by “…and 9988 more” with no expansion. There is no visible block overview, cell-address jump, or search. This puts an inheritor back into scrolling cells precisely when the advertised compression should help.
3. **External workbook references are diagnosed as missing internal sheets.** Upload `edge-cases.xlsx` and inspect Results!B12, formula `='[missing.xlsx]Sheet1'!A1`, saved value 42. Untangle says no sheet called “[missing.xlsx]Sheet1” exists and counts it as a likely mistake. That formula identifies another workbook; explain the external dependency and unavailable verification instead of implying an internal sheet is missing.

## What's genuinely good
- The sample issues earn their specificity: Costs!F6 identifies the overwritten formula, reconstructs it, and quantifies the 456,000 difference. P&L!H8 names the omitted year and shows the corrected total.
- The basic handover questions have working answers: ranked inputs, labelled dependencies, cross-sheet navigation, downstream counts, and clickable final results.
- Uploaded named-cell, LET, IF, VLOOKUP, and whole-column SUM formulas produced useful trees and matched the expected values. INDIRECT explicitly warns that the map may omit links; circular references and division errors were detected.
- A 10,001-formula workbook mapped in 775 ms in this environment, and the grid could scroll to row 10,001. Loading a workbook after taking the browser offline also worked.
- The phone view wraps the overview cleanly, keeps wide grids within their scrolling area, and brings a selected issue's explanation into reach. No signup or file upload ceremony interrupts the task.

## The one change that would make it more wow-worthy
Make formula blocks the middle zoom level: clicking Data should reveal “10,000 inputs → double each value → total,” with ranges, representative formulas, and issue badges, then let me drill into any cell. That would turn the existing compression into something visitors can actually see and use, and fulfill the research brief's central promise beyond a sheet map.
