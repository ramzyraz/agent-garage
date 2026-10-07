# State

_Last updated: session 15 (Claude Code), day 5._

## Mission now

The human froze Namesake (7/10, `site/namesake/`) and asked us to build from the Investigator's backlog
(`projects/investigator/BACKLOG.md`, briefs in `site/research/briefs/`). Earlier products are frozen: don't touch them.
`site/builder/index.html` lists projects (current first). Backlog #1 is `in progress (Builder)`; #2 (sheet music OMR) is open.

## Product: Untangle (backlog #1, brief 001)

**See how any spreadsheet really works.** https://ramzyraz.github.io/agent-garage/builder/untangle/
Drop in an .xlsx/.xlsm; everything runs in the tab (no server, no upload, no libraries). `#sample` opens the demo.

- **Map:** sheets as cards in dependency layers (inputs → results), edges weighted by reference count,
  role bar (input/calc/output/data), issue badge, dashed = hidden sheet. Goes top-to-bottom when the
  left-to-right layout would need >25% shrinking (most desktops with 5+ layers too). Click → sheet.
  Below: "Where are the inputs?" (ranked by reach), "What looks wrong?", "Where does it end?" (outputs).
- **Sheet grid:** virtualised rows (26px), ≤200 columns, cells coloured by role, issue outlines,
  copied-formula blocks outlined. Selecting a cell highlights precedents (cyan) / dependents (violet);
  a short-range issue marks the left-out cell red dashed.
- **Inspector:** human label ("Staff · 2030" from row label + column header/year row), value, issues,
  formula text, plain-English line for simple formulas, formula **tree with values at each node** (only
  when our recalculation matches Excel's saved value, else saved values for refs only and the reason),
  "one of N copies", upstream inputs ("Built from 12 inputs through 17 formulas"), downstream impact
  ("14 cells on 3 sheets would change, including 6 final results") + highlight button.
- **Issues:** override (typed number amid copies, with the value the formula would give), inconsistent
  formula, short range (SUM etc. stops one before a sibling; shows corrected total), #REF!/errors,
  hard-coded constants (per block; ignores 0/1/years/units/positional args), unused assumption, empty-cell
  refs, INDIRECT/OFFSET, external links, missing sheet, unknown name, circular refs, hidden sheets.
- **Inputs tab:** every typed value a formula uses, ranked by transitive reach.
- Errors: .xls/encrypted (OLE magic) and non-zip files get plain messages. Macros noted, never run.
- Analytics: fixed events only (`sample-opened`, `file-opened`, `issue-opened`), path `/agent-garage/builder/untangle/`.

## Files

- `site/builder/untangle/zip.js` zip reader (DecompressionStream deflate-raw, zip64). `xlsx.js` streaming XML
  scanner + workbook reader: shared strings, inline strings, **shared formulas expanded** via `shiftFormula`,
  array/dataTable flags, defined names, tables, external links, styles → `fmt` (pct/date/money).
- `formula.js` tokenizer (refs incl. quoted/3D/external sheets, structured refs, errors, intersection),
  Pratt parser → AST, `print`, `walk`, `r1c1Key` (copy detection), `shiftFormula`.
- `evaluate.js` ~90 Excel functions incl. lookups, SUMIFS, LET; lazy IF/IFERROR/CHOOSE; throws `Unsupported`.
- `model.js` `buildModel(wb)`: refs (names/tables resolved), graph with shared **range nodes** (edge budget 4M,
  then truncates with a note), memoised `dependentsOf`, Tarjan cycles, labels (binary search over heading rows),
  blocks (vertical runs merged sideways), roles, input reach (time-boxed to budget/4), issues, sheet layers,
  `recompute(fc)`, `evalText`. `app.js` UI; `style.css`; `samples/northwind-plan.xlsx`.
- `projects/builder/tools/make-sample.mjs` regenerates the sample (values computed by our evaluator).
  Planted: Costs!F6 typed 2,280,000 (formula gives 2,736,000), P&L!H8 =SUM(C8:F8) misses 2031, marketing
  =…*0.04 while the 5% assumption is unused, hidden Scratch sheet feeds Dashboard, Scratch!B6 #REF!.

## Verification (session 15)

- `node --test projects/builder/tests/*.test.js`: 8 pass (parser shapes, shared formula shift, evaluator,
  all planted sample issues + no column-pattern noise, every sample formula recomputes, tracing, cycles/
  inconsistent/empty/INDIRECT fixture, .xls/garbage rejection, 60k-formula workbook). `tests/xlsx-fixture.js`
  writes small test workbooks.
- `node projects/builder/tests/untangle-browser.cjs` (serve `site/` on :8765; puppeteer-core in /tmp/pt; Chrome
  /usr/bin/google-chrome): sample via hash, map, issue list, override click, tree recompute, precedent jump,
  inputs, phone (390px) no overflow on all views, real upload, bad file message, no console errors, no external requests.
- Performance (Node): 60k formulas with quadratic running SUMs: read 0.25 s + model 3.6 s (hits edge budget).
  The sample maps in ~60 ms. Main thread blocks while mapping (spinner freezes).
- **Never tested on a real Excel-made file.** Only our own generated workbooks. HUMAN_NEEDED #14 asks.

## Next 3 tasks

1. Robustness on real files: build fixtures that mimic Excel/LibreOffice/Google output (styles-heavy, shared
   strings with rich text, tables + structured refs, dynamic arrays/spill, data tables, chart sheets, external
   links, defined names with sheet scope, 3D refs). Find public sample workbooks (e.g. Enron corpus, which the
   brief suggests) if reachable, and check false positives on them.
2. Move parsing/modelling into a Web Worker with progress, so big files don't freeze the page; show sheet-level
   progress. Consider a block-level view in the grid for huge sheets (canvas minimap).
3. "What if": edit an input in the inspector and recalculate downstream with our evaluator (only where every
   formula on the path recomputes), showing which results move. Then launch posts (Show HN, r/excel) in HUMAN_NEEDED.

## Open problems

- Labels are heuristics (nearest text left / heading above / year rows). Generic headings (Value, Amount…) are dropped.
- Pattern-break checks require the neighbours to be a block along that direction (avoids row-model noise);
  they may miss breaks at the edges of a block.
- Unsupported in recalculation: array formulas, dynamic arrays, OFFSET/INDIRECT, many date/text/finance functions.
  The tree still shows saved values; it just doesn't show in-between values.
- The map on desktop often uses the vertical layout (6 layers don't fit side by side); fine but tall.
- No per-file sharing (files never leave the browser, by design). The shareable demo is `#sample`.

## Users

- No outside user yet. The human's guidance: build real, impressive solutions from the backlog; Namesake was
  "good enough" at 7/10 from the evaluator. The brief's audience: people who inherit workbooks (finance, ops,
  research, government) and care about privacy.
