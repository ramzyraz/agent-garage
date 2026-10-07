# Understanding a spreadsheet someone else built

> People who inherit a complex Excel workbook have no good way to see how it actually works: which sheets feed which, where the key assumptions hide, and which formulas are quietly wrong.

**Found:** 2026-10-07 · **Pain** 4/5 · **Reach** 4/5 · **Buildable** 5/5 · **Wow potential** 4/5

## The problem

Spreadsheets get handed over all the time: someone leaves, a model comes from a partner, a team
takes over a monthly report. The new owner gets thousands of formulas and no map. Excel shows one
formula at a time in a one-line box, and its "Trace Precedents" arrows only work one cell at a time.

In December 2025 someone asked Hacker News
["How do you deal with large, hard-to-read Excel formulas?"](https://news.ycombinator.com/item?id=46322054):

> "When Excel formulas get large, I often lose track of what's actually happening. I'm wondering
> whether representing formulas structurally (instead of plain text) could make them easier to read
> and modify"

The replies give the usual advice: split formulas into helper columns, use named ranges, `LET`,
`LAMBDA`, trace precedents. The original poster explained why that doesn't help with a workbook you
inherited:

> "What I've been running into is cases where large formulas already exist (and refactoring them
> into multiple columns isn't always an option)" … "Even with LET/LAMBDA, the structure still lives
> mostly in a single line of text, and the formula bar UI doesn't really help you reason about that
> structure."

Another commenter [said](https://news.ycombinator.com/item?id=46324528) they "usually copy paste
them to a text editor because the formula bar doesn't have a great editing ui."

This is a known professional problem, not a niche complaint. Felienne Hermans and colleagues
studied spreadsheet users at a large financial company. They found that problems came up when
spreadsheets moved from one employee to another, and built a tool that draws a spreadsheet as a
dataflow diagram ([Breviz paper, arXiv 1111.6895](https://arxiv.org/abs/1111.6895)). A
[summary of that work](https://neverworkintheory.org/2012/05/24/supporting-professional-spreadsheet-users-by-generating-leveled-dataflow-diagrams.html)
notes that "the comprehensibility of such inherited spreadsheets was often seriously lacking—posing
a great risk from a business perspective", and that "the creators of—in their view—simple
spreadsheets only realized the actual complexity of their own creations after having used the
tool."

## How big is it

- **Errors are the norm.** Raymond Panko's review of spreadsheet error research
  ([EuSpRIG 2000, arXiv 0802.3457](https://arxiv.org/abs/0802.3457)) reports that the more careful
  field audits "found errors in at least 86% of the spreadsheets audited." The only technique the
  paper found proven to reduce errors is cell-by-cell inspection, which is exactly what is so
  slow without a map.
- **Real money is involved.** In January 2025 the Swiss canton of Thurgau found an Excel error that
  had understated a 2025–2028 construction programme: the total went from 13.32 to 21.901 million
  francs ([bluewin](https://www.bluewin.ch/en/news/switzerland/canton-of-thurgau-makes-excel-error-costing-millions-li.2605366)).
- **People want this, and the demand isn't new.** A 2014 Show HN for a spreadsheet visualiser,
  ["Instantly Understand Any Spreadsheet"](https://news.ycombinator.com/item?id=8135967), got 192
  points. That product is gone (see below).
- I couldn't verify a reliable count of Excel users, so I give no number here. The reach score
  assumes "most office workers in finance, operations, research and government". That is my
  judgement, not a measured figure.

## What exists today

| Option | What it does | Why it falls short |
|---|---|---|
| Excel **Trace Precedents / Dependents**, Evaluate Formula | Arrows and step-through for one cell | One cell at a time. No overview of the whole workbook, and the arrows get unreadable across sheets. |
| Excel **Inquire** add-in (worksheet and cell relationship diagrams) | Diagrams how sheets and cells link | Microsoft: "Spreadsheet Inquire is available only in Excel for Windows in Microsoft 365 Apps for enterprise plans and equivalent editions" ([support page](https://support.microsoft.com/en-gb/office/see-links-between-worksheets-in-excel-for-windows-e7d7a6b8-6329-4867-ab8c-0262405dbd48)). It isn't available on Mac, the web, or Business/Home plans. |
| **PerfectXL** (commercial; it comes from the Breviz line of research, though I didn't confirm the exact company history) | Risk scans, visual structure, documentation | Aimed at enterprise audit teams. A listing ([fitgap](https://us.fitgap.com/products/049013/perfectxl)) gives pricing from €69/month with no free version. I couldn't open PerfectXL's own pricing page (bot check), so treat the price as unverified. |
| **Slate** (2014, Show HN above) | Turned a cell's formula into an interactive flowchart | Dead: `useslate.com` now redirects to a domain-for-sale page (checked 2026-10-07). Even at launch, an experienced Excel modeller [wrote](https://news.ycombinator.com/item?id=8136143): "Slate shows only very little context; you have to scroll out far to see those 2 or 3 steps away, but at that point everything is too small to read. Furthermore, it doesn't really dissect formulas; for example, an 'if' with two VLOOKUPs is just a pink blob with a bunch of arrows coming in". |
| **graphedexcel** ([GitHub](https://github.com/dalager/graphedexcel)) | Python CLI that builds a cell dependency graph | Needs Python or Docker and outputs static images. It has 4 stars, so it's a hobby project. |
| **TACO-Lens** (research, [VLDB 2023 demo](https://www.vldb.org/pvldb/vol16/p4030-tang.pdf)) | Compresses formula graphs using "tabular locality" (neighbouring cells usually share the same formula shape) so they become readable | A research Excel plugin, not a product. Its key idea is valuable and reusable, though: "as formula graphs become large and complex, it becomes harder for end-users to make sense of formula graphs". |
| **General AI assistants** (Copilot in Excel, Claude: see [Claude's "understand and extend an inherited spreadsheet" use case](https://academy.claude.com/use-cases/understand-and-extend-an-inherited-spreadsheet)) | Read the file and explain it in prose, add comments | You have to upload a possibly confidential model to a cloud service. They give a text answer, not a map you can explore. Their explanations of a 20-sheet model can't easily be checked against the actual formulas. |

**What I think (not a finding):** the gap is a **free, private, visual** tool. You drop in a `.xlsx`
and in seconds you see the whole workbook as a map you can explore. Nothing is uploaded and nothing
needs installing. None of the options above has all three properties.

## What a great solution would need

- **Runs fully in the browser.** The file never leaves the machine and you can say so in one
  sentence. That is the whole trust story for financial models. Parsing `.xlsx` formulas
  client-side is well understood (the format is zipped XML).
- **A real formula parser**, including cross-sheet references, named ranges, structured table
  references, `LET`/`LAMBDA`, dynamic arrays, and `INDIRECT`/`OFFSET` (which can't be resolved
  statically, so flag them honestly).
- **Compression before drawing.** A workbook can have 100,000 formulas. Drawing each cell kills
  any visualisation. Group copied formulas into blocks ("this column computes margin = revenue −
  cost for rows 5–400") the way TACO does, then let users drill down from sheets to blocks to
  cells.
- **Several zoom levels:** sheet-to-sheet flow, then inputs → calculations → outputs inside a
  sheet, then a single formula drawn as a tree with the **actual values** at each node, so you can
  see *why* a number is what it is.
- **Risk flags that point to exact cells:** numbers hard-coded inside formulas (`=B4*0.22`), a
  formula that breaks the pattern of its row or column, references to empty cells, ranges that
  stop one row short, circular references, hidden sheets, external links, errors such as `#REF!`.
- **Answers to the questions an inheritor actually asks:** "Where are the inputs?", "What does
  this output depend on?", "What breaks if I change this cell?"
- **Hard parts:** performance on huge workbooks in a browser tab, layout of large graphs that stays
  readable, and Excel's long tail of functions and reference styles. Explaining in plain language
  without a cloud LLM is optional; if one is used, it should be opt-in and per-formula, never
  send the whole file.
- **Demo-ability:** public sample workbooks (for example spreadsheets from the Enron email corpus,
  which researchers commonly use) would let visitors try it without risking their own files.

## Sources

- Hacker News, "Ask HN: How do you deal with large, hard-to-read Excel formulas?" (Dec 2025): https://news.ycombinator.com/item?id=46322054
- Hacker News comment on the formula bar: https://news.ycombinator.com/item?id=46324528
- Hacker News, "Show HN: Instantly Understand Any Spreadsheet" (Slate, 2014): https://news.ycombinator.com/item?id=8135967
- Hacker News critique of Slate: https://news.ycombinator.com/item?id=8136143
- Hermans, Pinzger, van Deursen, "Breviz: Visualizing Spreadsheets using Dataflow Diagrams": https://arxiv.org/abs/1111.6895
- Never Work in Theory summary of "Supporting Professional Spreadsheet Users by Generating Leveled Dataflow Diagrams": https://neverworkintheory.org/2012/05/24/supporting-professional-spreadsheet-users-by-generating-leveled-dataflow-diagrams.html
- Panko, "Spreadsheet Errors: What We Know. What We Think We Can Do": https://arxiv.org/abs/0802.3457
- bluewin, Thurgau Excel error (2025): https://www.bluewin.ch/en/news/switzerland/canton-of-thurgau-makes-excel-error-costing-millions-li.2605366
- Microsoft, "See links between worksheets" (Inquire availability): https://support.microsoft.com/en-gb/office/see-links-between-worksheets-in-excel-for-windows-e7d7a6b8-6329-4867-ab8c-0262405dbd48
- fitgap PerfectXL listing (pricing, unverified with vendor): https://us.fitgap.com/products/049013/perfectxl
- graphedexcel: https://github.com/dalager/graphedexcel
- Tang et al., TACO-Lens (VLDB 2023 demo): https://www.vldb.org/pvldb/vol16/p4030-tang.pdf
- Claude Academy, "Understand and extend an inherited spreadsheet": https://academy.claude.com/use-cases/understand-and-extend-an-inherited-spreadsheet
