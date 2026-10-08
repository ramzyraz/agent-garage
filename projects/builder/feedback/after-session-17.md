# Review after session 17

**In one sentence:** Untangle turns an inherited Excel workbook into explorable dependency maps, explains suspicious formulas, and previews what selected repairs would change.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | Clear promise, obvious file drop, and a sample with planted mistakes remove the need to bring a workbook. |
| Wow: would I show someone? | 7 | Seeing one staff-cost repair change the best profit year from 2030 to 2031 is compelling; reaching that moment takes several clicks. |
| Usefulness: does it solve the problem? | 8 | Exact-cell findings, grouped formulas, upstream inputs and downstream results genuinely help a new workbook owner. Ordinary input changes cannot be simulated. |
| Fun / replay: would I come back? | 6 | Useful reason to return with another workbook, but the sample offers little progression after inspecting its findings. |
| Shareability: does it make me send it on? | 7 | I'd send this to spreadsheet-heavy colleagues; downloadable repair reports provide a concrete thing to share. The report is a plain table, without the visual explanation. |
| Polish: bugs, layout, rough edges | 7 | Clean typography and usable phone controls, but oversized diagrams, misleading inferred labels and a stale validation message weaken confidence. |

## Top 3 problems

1. **The maps make me assemble the overview by scrolling.** Open the sample → Costs → Block map. Even at 1440px, several source/calculation cards sit beyond the right edge and arrows converge from offscreen. Explore → Total costs helps, but its eight source groups extend below the map's visible area. At 390×844, the default map shows roughly one column; the initial workbook screen spends nearly 460px on header, statistics and validation before the diagram starts. Provide fit/zoom and a compact overview, with readable detail on selection. Evidence: `actual-blocks.png`, `focused-block.png`, `phone-map-viewport.png`, `phone-blocks-viewport.png`.

2. **“If you change this” stops short of answering the practical question.** Sample → Inputs → search “salary” → Salary per staff member. I get 38 known dependent cells and saved result values, but cannot enter a new salary and see the effects. The highlight button reports “0 highlighted on this sheet, 38 more elsewhere.” Actual before/after calculations are reserved for proposed repairs. Let ordinary inputs use the same temporary preview machinery, so an inheritor can test their understanding without returning to Excel.

3. **Inferred labels can misidentify the data being explained.** Upload `visitor-test.xlsx` → Summary → Go to B4. This workbook has an Item column with Coffee in Sales Data!A2 and Tea in A3, and a VLOOKUP for Tea. The upstream list labels A3 as “Coffee” while displaying its value “Tea.” The app borrows the preceding row's text as a confident label, creating a misleading explanation. Prefer actual headers or the cell address when context is ambiguous. Evidence: `lookup-tree.png`. A smaller reproducible bug: enter “nonsense” in Go to cell, then a valid address; the old “Use an address…” error remains even after successful navigation (`valid-after-invalid.png`).

## What's genuinely good

- The Costs!F6 finding explains the overwritten formula, reconstructs its neighbours' pattern and quantifies the 456,000 discrepancy. This is actionable evidence, not a generic warning.
- Its repair preview follows the consequences through costs, tax and net profit, including a 371,623 decline in five-year profit and a changed best year. That's the strongest demonstration of value.
- The short SUM repair identifies the omitted cell and previews the corrected total; Save report produced a readable standalone HTML file with formulas, values and calculation limits.
- Privacy has a practical demonstration: after disabling browser networking, my uploaded workbook still loaded and mapped successfully.
- My uploaded workbook's named reference and VLOOKUP produced useful trees; INDIRECT was explicitly flagged as an incomplete dependency source. A sparse workbook's B10000 was directly reachable, a values-only workbook remained usable, and a corrupt .xlsx received a clear error.
- Sheet → block → cell navigation and the separation between likely mistakes and things worth checking fit the inherited-workbook problem well.

## The one change that would make it more wow-worthy

Let me temporarily change any input and watch before/after values propagate along a compact dependency path to the workbook's key results. Start with salary in the sample: one editable number, visible consequences across sheets, and a report I can keep. The repair preview already demonstrates why this would be powerful.

Tested the live site in headless Chrome at 1440×1000 and 390×844 with touch enabled; reviewed the linked research brief, screenshots, sample workflows, uploads and downloaded report. No source code, repository or builder logs inspected. Large production workbooks were not validated.
