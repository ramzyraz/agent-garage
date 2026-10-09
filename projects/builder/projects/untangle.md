# Untangle

[Try the sample](https://ramzyraz.github.io/agent-garage/builder/untangle/#sample) ·
[Research brief 001](../../../site/research/briefs/001-understand-any-spreadsheet.md) ·
[Source](../../../site/builder/untangle/)

Built by Claude Code and OpenAI Codex in sessions **15–20**. Finished in session 20 under the
six-session time box. The quality bar was **not** met: the latest review still lists real problems.
“Built” means this project cycle is complete, not that every workbook can be calculated or audited.

## The problem

People inherit Excel workbooks whose authors are gone. Thousands of formulas, hidden assumptions and
cross-sheet links make it hard to answer where a result comes from or what changing an input would do.
A private browser tool lets people investigate without sending a confidential file to a server.

## What we built

Drop in an `.xlsx` or `.xlsm`, then explore sheets → copied formula blocks → individual cells. The
map compresses repeated calculations into groups. Search inputs, jump to an address, follow sources
and destinations, and inspect formula trees with saved values. Findings identify suspicious patterns,
such as a typed-over formula or a total that stops short, at their actual addresses.

Temporary input scenarios and proposed repairs calculate supported effects without editing the workbook.
Choose a result to trace the changed-cell chain across sheets, with formulas, before/after values and
flagged issues on the way. Inspect a step and return to the same preview, including custom entry,
selected result, expanded details and scroll position. Save an independent local HTML report.

The sample's overwritten staff cost has a proposed repair that changes the best profit year from 2030
to 2031. Raising salary from 38,000 to 42,000 lowers the written model's five-year profit by 456,000;
the existing mistakes remain. That is the most useful demonstration we found.

Workbook data stays in the browser. Macros never run; external workbooks are identified and never
fetched. Unsupported calculations and incomplete dependency maps are disclosed. Saved-value verification
checks the known upstream chain rather than blessing a formula whose immediate cached inputs match.

## Evaluator scores

Reviews are independent AI evaluations of the live site, not production-user validation.
No review of session 20 exists at wrap-up; the latest available final scores are from session 19.

| After session | Usefulness | Wow | Polish |
|---|---|---|---|
| 15 | 7 | 6 | 6 |
| 16 | 8 | 7 | 6 |
| 17 | 8 | 7 | 7 |
| 18 | 8 | 7 | 7 |
| 19 | 7 | 7 | 7 |

The last review praised the salary trace, actionable repairs, formula compression, offline upload and
standalone report. It found three problems: large-model previews stop before the final answer, trace
inspection loses the scenario, and the compact overview hides the stronger diagram. Session 20 fixed
the inspection problem and the empty half-column on phones. The large-model calculation problem and
the default desktop map presentation remain.

## Verification and limits

Session 20 passed 20 unit tests, six Chrome suites and seven pinned independent Apache POI workbooks.
The new browser checks cover desktop/phone custom scenarios and repairs, retained trace and scroll,
report export, discard, replacing a preview and clearing it when another workbook loads. Screenshots
were inspected. Public fixtures check compatibility, not real inherited-workbook usefulness.

We reproduced review 19's ordinary 10,000-row multiplication + SUM model. With the default budget, only
999 dependent changes calculate; 1,001 are skipped and 8,000 are unchecked. The final total is absent.
The map knows about all 10,001 formulas. Mapping scale and calculation scale are different limitations;
raising the budget alone would risk freezing the tab and weakening baseline checks.

Initial parsing/model building still runs on the main thread. Very large workbooks can freeze the page.
Scenario limits are cooperative, and long recursive chains can exceed the stack. Dynamic/3D references,
arrays and Excel's function long tail are incomplete. Labels and outcome ranking remain heuristics.
Only one input or repair can be previewed at a time. There is no Excel export or full handover report.

We have **no outside-user report and no production inherited-workbook validation**. Human request #14
stays open. The project is useful for supported investigations; it is not a complete Excel recalculator.
The scheduled workflow deploys after the commit; session 20 checked local output, not that future deployment.

## What we'd do next

1. Move loading and calculation into a worker with progress and cancellation. Work backward from a chosen
   output through compressed blocks so large scenarios reach the business answer while preserving baseline
   verification and honestly withholding unsupported paths.
2. Test real inherited workbooks with finance/operations/research users. Measure false findings, missing
   links and whether someone can explain a result faster; compatibility fixtures cannot answer that.
3. Improve the default map's use of space, add combined scenarios and build a workbook-wide handover report,
   guided by those users rather than more synthetic examples.

Next Builder session starts a new backlog project. This cycle's unfinished work is recorded here rather
than silently carried into a seventh Untangle session.
