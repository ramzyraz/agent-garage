# Review after session 16

**In one sentence:** Untangle turns an inherited Excel workbook into an explorable map of its inputs, formulas, results, and suspicious cells, entirely in your browser.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | Clear problem, obvious file drop, and a sample with planted mistakes make it easy to start. |
| Wow: would I show someone? | 7 | Finding a 456,000 staff-cost error and explaining the missing year in a total is impressive; the maps themselves look utilitarian. |
| Usefulness: does it solve the problem? | 8 | Sheet → block → cell tracing answers the inheritance questions well. Large copied ranges compress successfully; dynamic references and table evaluation leave gaps. |
| Fun / replay: would I come back? | 6 | I'd return with another workbook. The sample invites detective work, but there's no guided reveal or repair preview. |
| Shareability: does it make me send it on? | 4 | I'd send the tool to spreadsheet colleagues, but there's no visible report export or way to share the particular finding/path I explored. |
| Polish: bugs, layout, rough edges | 6 | Clean desktop typography and useful cell highlighting; phone issue cards overflow, and the phone overview map shrinks text to near illegibility. |

## Top 3 problems

1. **Phone issue cards break the layout.** At 390×844 with touch, open the sample → Issues. All three “Likely mistakes” cards extend beyond their parent panel: their right edge is about 453 px on a 390 px screen. The staff formula and explanatory text run off the right edge. Wrap the formula and constrain the cards. Screenshot: `phone-issues-viewport.png`.

2. **Impact counts sound complete when dependencies are missing.** Upload `edge-cases.xlsx` and open Inputs!B2. “6 cells on 1 sheet would change” omits Results!B4, whose formula is `=INDIRECT("Inputs!B2")*Inputs!B3`. Issues correctly warns that INDIRECT can hide links, but the input's impact panel carries no such qualification. Put the incompleteness warning beside the count and describe these as known dependencies. Screenshot: `edge-price.png`.

3. **Ordinary Excel tables lose the promised intermediate values.** Upload `table.xlsx` → Summary → Go to B1. `=SUM(SalesTable[Revenue])` shows a bare table-column node and “Untangle can't recalculate table yet”; all five formulas are marked unsupported, including simple `=[@Units]*[@Price]` calculations. Dependencies are mapped, which helps, but the “why this number?” experience stops for a common workbook format. Screenshot: `table-cell.png`.

## What's genuinely good

- The sample catches all five advertised mistakes plus its hidden sheet. Explanations supply exact addresses, suggested formulas, and numerical consequences; Costs!F6 and P&L!H8 are particularly convincing.
- Compression earns its place: my uploaded 10,000-row workbook had 30,000 formulas reduced to three blocks, mapped in 859 ms. Jumping to E10001 and searching for B10001 both worked.
- The privacy promise survived a practical check: after loading the page, I disabled browser networking and uploaded workbooks successfully. Invalid archives get a readable error; an empty workbook renders without crashing.
- Named ranges and LET worked in my fixture. Stale saved values, a circular reference, division by zero, and an empty-cell reference were flagged. Saved-value agreement is explicitly distinguished from an audit.
- All six sample sheets and all six issue drill-downs opened successfully. The grid highlights actual sources, dependents, and the cell omitted from a suspicious SUM.

## The one change that would make it more wow-worthy

Add a local **preview this repair** action: for Costs!F6, show the proposed formula and animate its effect through total costs, profit, and the dashboard, with before/after values and explicit calculation limits. The tool already finds a consequential mistake; showing what that mistake does to the business would make the discovery worth demonstrating.
