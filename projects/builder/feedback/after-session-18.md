# Review after session 18

**In one sentence:** Untangle turns an inherited Excel workbook into an explorable map, explains suspicious cells, and previews how input changes or repairs affect the results, privately in your browser.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | Clear problem, prominent upload, and an immediate sample; the compelling result arrives after opening the salary preview. |
| Wow: would I show someone? | 7 | Finding a typed-over formula and tracing its financial consequences is impressive; the actual maps look less impressive than the analysis underneath. |
| Usefulness: does it solve the problem? | 8 | Sheet/block/cell navigation, input ranking, exact issue locations and working previews address workbook handover directly. The map still makes relationships harder to read than they should be. |
| Fun / replay: would I come back? | 6 | Exploring mistakes and scenarios is satisfying. I'd return with another workbook, rather than replay the same sample. |
| Shareability: does it make me send it on? | 6 | A useful recommendation for spreadsheet-heavy colleagues; downloadable reports work, but their long tables aren't a particularly memorable explanation to send someone. |
| Polish: bugs, layout, rough edges | 7 | Uploads, error handling and calculations held up in my tests. Small diagrams, mobile inspection friction and misleading green preview styling remain. |

## Top 3 problems

1. **The central map hides connections or makes them too small.** Desktop, open sample → Map: Compact overview gives successive steps, without individual reference arrows, despite the instruction about arrow thickness. Revenue → Block map puts Costs in Step 3 and Revenue in Step 4; this doesn't explain that the revenue calculation feeds Costs. Map → Diagram initially shows the six-sheet graph at 60%, occupying a narrow strip at the left of a largely empty panel, with tiny secondary labels ([screenshot](diagram.png)). Fit/zoom controls also remain visible in Compact overview although its cards don't visibly scale. Show readable connections and make the graph use its available space.

2. **Phone inspection separates the cell from its explanation.** At 390×844 with touch, open sample → Issues → typed-over Costs!F6. The page returns to the top; the selected cell's inspector begins below the grid, outside the initial viewport. The grid scrolls horizontally to F6 and loses the row labels, so the visible numbers have little context ([screenshot](cell-phone.png)). Selecting a cell should expose its explanation immediately, with row labels retained while scrolling.

3. **Every calculated change looks favorable.** Open sample → “Try a higher salary”: net profit worsens from -1,341,919 to -1,797,919 and cash buffer rises from 741,676 to 765,676, but the new values and cards are green. The saved report repeats that treatment ([screenshot](salary.png)). Green reads as success in a financial scenario. Use neutral styling for calculated changes unless you can establish whether they are favorable.

## What's genuinely good

- The sample catches all five advertised planted mistake patterns and separately flags the hidden sheet. Findings explain the evidence, affected cells, proposed formula and numerical discrepancy; Costs!F6 is demonstrably off by 456,000.
- Repairing that cell in preview changes the best profit year from 2030 to 2031. This turns an abstract formula warning into a concrete consequence worth investigating.
- A workbook I uploaded with arithmetic, IF and VLOOKUP matched all six saved formula results. Changing units from 10 to 12 correctly changed revenue 200→240, tax 20→24 and net 180→216.
- A generated 30,001-formula workbook mapped in 845 ms and compressed to four blocks. That earns the compression claim, although this was a regular synthetic workbook, not an arbitrary enterprise model.
- Processing worked with browser networking disabled. A malformed .xlsx produced a clear error; an empty workbook loaded cleanly; invalid cell addresses gave guidance, and cross-sheet jumps worked.
- The downloaded HTML report opened independently and preserved the scenario and individual calculated changes. Saved-value checks clearly distinguish matching calculations from a complete audit.

## The one change that would make it more wow-worthy

Make a selected issue or input reveal one readable causal path through the workbook, with connected sheet/block nodes and before→after result values on that same map. Start with Costs!F6: show the missing 456,000 flowing through costs, tax and profit, ending at “best year: 2030→2031.” The underlying analysis already earns that moment; the presentation currently disperses it across the grid, inspector and modal.
