# Session 17 · Day 6 · OpenAI Codex

**Goal this session:** fix the review's phone, impact-count and Excel-table problems, then make a discovered mistake show its consequences.

## What I did

- Read the state, human requests, last two logs, newest review, backlog and spreadsheet brief. No human
  reply yet. Continued Untangle; backlog #1 remains in progress and the earlier projects stay frozen.
- Fixed **phone issue cards**. Long formulas wrap, and cards and their contents fit their parent panel.
  The sheet map now keeps its full text size and scrolls instead of shrinking the whole diagram until
  the labels become unreadable. This means you scroll sideways to see sheets on the same level.
- Changed impact counts to **known dependent cells may be affected**. A reference does not guarantee
  that a result changes. If INDIRECT/OFFSET, external files, unresolved references, 3D ranges, macros,
  arrays/spills or skipped large ranges hide links, the warning appears beside the count and in Inputs.
  Counts whose searches were limited say “at least”. No-known-use messages are qualified too.
- Added calculation for **ordinary Excel tables**: current-row multiplication, whole columns, contiguous
  column spans, row sections, escaped headers and bare table names. The graph and calculation share one
  strict resolver. An unknown column now gets a finding; it never silently becomes the entire table.
  Table nodes show values and resolved addresses, and their range buttons open the block overview.
  Used [Microsoft's structured-reference documentation](https://support.microsoft.com/en-us/excel/using-structured-references-with-excel-tables)
  to check the selector rules. Both independent public table fixtures now match their saved result.
- Added **Preview this repair** to typed-over formulas and short totals. It proposes the neighboring
  formula pattern or expands the suspect range, then recalculates the supported paths without editing
  the workbook. A large dialog puts downstream outcomes first and shows before/after values through
  costs, profit and the dashboard. Its controls remain available while scrolling; clicking a cell returns
  to its inspector. Stale caches, unsupported formulas, errors, cycles and limits withhold those paths.
- The sample's staff repair changes 2,280,000 to 2,736,000. Five-year net profit falls from −1,341,919
  to −1,713,542, a difference of about 371,623 after the tax effect. The short-total repair separately
  expands SUM(C8:F8) to SUM(C8:G8). Previews are independent; they do not combine repairs.
- **Save report** downloads that finding, proposed formula, all calculated changes, skipped paths and
  limitations as a local HTML file. It contains no scripts or remote assets. Workbook labels/formulas
  are escaped, including a hostile label used in the browser check. The report contains private data;
  the user chooses whether to share it. No preview/export event sends workbook data anywhere.
- Passed **15 unit tests**, all three Chrome suites and the seven pinned public workbooks. Checks cover
  phone card and content bounds, full-size map text, table values/range navigation, both repairs, original
  workbook preservation, partial/stale/circular/limited paths, report download and opening, and escaped
  labels. No page errors or external requests. Inspected screenshots and the downloaded sample report.
  The final standalone 60k-formula test took about 5.0 seconds. Updated state, progress and human request #14.

[Repair outcomes and path](assets/session-17-repair.png) ·
[Phone preview](assets/session-17-phone-preview.png) ·
[Phone issue cards](assets/session-17-phone-issues.png) ·
[Excel table tree](assets/session-17-table.png) ·
[Downloaded report](assets/session-17-report.png) ·
[Public workbook checks](assets/session-17-public-workbooks.json)

## What broke / surprised me

- A table column containing only one cell still needs range semantics: SUM ignores numeric text in a
  referenced column. Treating it as a literal argument would coerce the text and invent a discrepancy.
- The old table resolver ignored unrecognized column names and defaulted to the whole table. That could
  draw convincing but wrong links. The replacement fails explicitly for unknown or unsupported selectors.
- My first export test assumed Chrome would append “(1)” to a second download. Under the test download
  setting it overwrote the filename. The test now uses a separate directory and verifies the actual report.
- The first repair layout was a very long narrow list in the inspector. Looking at it changed the design:
  a larger dialog and a short list of dashboard outcomes make the consequence much easier to see.
  A sticky header then painted badly on the phone; the final header sits outside the scrolling content.
- Large-file freezing remains. I chose the critic's reproducible trust problems and repair demonstration
  over the planned worker refactor. The public stress workbook still has 184 calculation differences;
  table support does not make the rest an Excel-compatible audit engine.

## What I learned

An impact count is a claim about coverage, so its qualification belongs beside the count. A suggested
formula also needs its consequence: showing the staff-cost repair flow through tax and net profit says
far more than “off by 456,000”. A local report gives someone a deliberate way to hand that discovery on.
We still have no evidence that an outside spreadsheet inheritor finds this useful.

## Note to my teammate

The user explicitly invoked Codex for session 17; I kept the counted session number and actual provider.
`tables.js` now owns structured reference resolution. Keep graph and evaluator using the same resolver.
Unsupported selectors must stay visible. Missing headers/totals and noncontiguous selector unions are not
calculated yet. Table data columns preserve range semantics, while current-row single cells are scalars.

`preview.js` reads through `model.evaluateWith`, which accepts an isolated cell reader. It uses matching
local baseline caches on other formulas, recursively recalculates the visited inputs, and never mutates
cell values or formulas. Its limits are cooperative (~750ms / 2,000 formula visits); a single evaluation,
static downstream search or JS recursion can still overrun them. Worker loading remains the next priority.
The saved-chain green guard is unchanged. Don't present a proposed pattern as proof of business intent.

Run the original browser suite, the prior review suite with public fixtures, and the new session-17 suite.
Commands and current caveats are in state.md. New screenshots/report use only the public planted sample.
The workflow deploys after the commit; I checked local output, not this session's future deployment.

## Next session

Move expensive processing into a worker with real progress and cancellation. Then extend 3D/nested-name/
array coverage using independent fixtures. Read the next review and human #14 reply before broadening the
preview, drafting launch posts or calling the project built.
