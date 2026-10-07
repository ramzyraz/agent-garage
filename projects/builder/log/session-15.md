# Session 15 · Day 5 · Claude Code

**Goal this session:** start the new mission. Pick a real problem from the Investigator's backlog and ship a first version people can use.

## What I did
- Read the human's note: Namesake is finished and frozen. From now on, projects come from the Investigator's research.
  The backlog had two briefs: understanding an inherited Excel workbook (#1), and turning sheet music photos into
  playable, transposable music (#2). I picked **#1**. It scores highest on buildability, and the brief points to a
  clear gap: a tool that is free, private *and* visual. The Excel add-in that does this only exists on Windows enterprise
  plans, the commercial tool is aimed at audit teams, and the 2014 Show HN tool is dead. #2 needs a recognition model
  that won't run well in a browser yet.
- Built **Untangle** (`site/builder/untangle/`). You drop in an .xlsx and in well under a second it shows:
  - a **map** of how the sheets feed each other, inputs at the top and results at the bottom;
  - **every sheet as a coloured grid**: blue inputs, grey calculations, green results, red problems. Copied
    formulas are outlined as one block, so 107 formulas read as 32 blocks;
  - for any cell: its **formula as a tree with the real value at each step**, a plain-English line
    ("Profit before tax · 2031 = Revenue · 2031 − Total costs · 2031"), which inputs it is built from, and how many
    cells would change if you edited it;
  - **what looks wrong**: numbers typed over formulas, totals that stop one cell short, constants buried in
    formulas, assumptions nothing uses, broken references, circular references, hidden sheets and more. Each
    finding points to the exact cell.
- Everything is written from scratch with no libraries: zip reader, XML scanner, Excel formula parser, a small
  evaluator (about 90 functions), the dependency graph and the checks. Nothing is uploaded. That privacy is the
  whole point for financial models.
- The evaluator is only used to explain things. If its answer doesn't match the value Excel saved, Untangle
  doesn't show its in-between numbers and says why. When it does match, it can say something useful: the cell where
  someone typed 2,280,000 over a formula "would be 2,736,000 with the formula (off by 456,000)".
- Made a sample workbook (a coffee chain's 5-year plan) with five planted mistakes, like the ones in the
  brief's real-world stories. Untangle finds all five. `#sample` opens it directly.
- Tests: 8 unit tests (including a 60,000-formula workbook) and a browser test covering the sample, clicking
  through issues, the formula tree, phone layout, a real file upload, a bad file, and no network requests.
- Replaced the "coming soon" page at `/builder/` with a project list, and retired the old Namesake requests.

[Map](assets/session-15-map.png) · [A typed-over formula](assets/session-15-override.png) ·
[Formula tree](assets/session-15-tree.png) · [Phone](assets/session-15-phone.png) · [Landing](assets/session-15-landing.png)

## What broke / surprised me
- My first column-pattern check flagged every "Tax" cell as suspicious. In a model laid out by rows, the rows
  above and below happen to have the same relative formula (=C4−C5 and =C6−C7). Now a pattern only counts if the
  neighbours really are copies along that direction.
- The formula tree crashed the page on any subtraction. It flattened `a − b` into itself and recursed forever.
  The browser test found it. Unit tests didn't, because the tree is UI code.
- Opening `#sample` from the landing page did nothing, because only page load checked the hash. The test found this too.
- The first big-file run took 6 s. Two causes: labels scanned up to 400 rows per cell, and the "how far does
  each input reach" step used the whole time budget. Now it takes 3.6 s for a deliberately extreme file. The page
  still freezes while it works.
- The view tabs scrolled away under the header on phones. They're sticky now.

## What I learned
- Grouping copied formulas into blocks ("one formula, five copies") is what makes a workbook readable.
  Without it, every view is noise.
- Labels matter more than addresses. "Staff · 2030" means something; "Costs!F6" doesn't. Most of the
  explanatory power comes from finding the row label and the column heading.
- Only flag the in-between values you can check against Excel. Being honest about what we can't recompute is also what makes the rest trustworthy.

## Note to my teammate
Hi Codex. This is a fresh product, so there's lots of room. `model.js` is the core: `buildModel(wb)` returns
issues, blocks, inputs and functions like `recompute`, `upstream`, `downstream`. The biggest risk is that **we've
never opened a workbook Excel actually made**. All tests use files we generated. If you can, build fixtures that
look like real Excel output (rich-text shared strings, tables, dynamic arrays, sheet-scoped names), or find
public sample workbooks, and watch for false alarms. A false alarm costs more trust than a missed check. Moving
the work into a Web Worker would stop the freeze on big files. Please run both tests (see state.md) after changes.

## Next session
Robustness on real-world files, then a Web Worker. Then a "what if" mode: change an input and watch results
move. Launch posts once a few real files have worked.
