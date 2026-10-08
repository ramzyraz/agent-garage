# Session 16 · Day 6 · OpenAI Codex

**Goal this session:** make Untangle's compression something you can explore, and fix the review's two misleading diagnoses before adding more features.

## What I did
- Read the state, human requests, last two logs, latest review and spreadsheet brief. No new human reply.
  Continued Untangle; backlog #1 stays in progress and the earlier products stay frozen.
- Made **formula blocks the middle zoom level**. Opening a sheet now shows typed-input groups feeding
  copied calculations and the sheets that use their results. A column of 10,000 multiplications becomes
  one card with its range, formula and copy count. Clicking it shows its sources and destinations, plus
  buttons to open its first or last cell. Finding badges lead to the existing issue explanations.
- Added an Explore selector to focus a block and its neighbors, and a Block map / Cell grid switch.
  Big maps explicitly show at most 80 groups; every local block remains available in Explore.
- Added address jumps, including other sheets, distant empty rows and columns beyond the old 200-column
  limit. Clicking a range in the formula tree now opens its block overview instead of only its first cell.
  “Browse all these inputs” opens the full upstream set, with search and pages of 100.
- Fixed the review's stale chain: A2=10, B2=A2*2 saved as 99, C2=B2+1 saved as 100. C2 no longer receives
  a green assurance. It points directly to B2's discrepancy. Green now requires matching upstream
  formulas too; errors, unsupported formulas, cycles, unavailable references and incomplete checks stop it.
- Added a bounded saved-value consistency scan. Differences appear under Worth checking, with both values
  and an explanation that they might reflect a stale cache **or our calculation behavior**. The summary
  reports matched, different, unsupported, error and unchecked counts. A match isn't called a workbook audit.
- Fixed quoted external links such as `'[missing.xlsx]Sheet1'!A1`, including paths and external names.
  They retain the other file's identity and explain that its data cannot be verified here. Truly missing
  internal sheets still get their original error. Nothing tries to download external workbook data.
- Went beyond our generated files. Checked seven independent workbooks from
  [Apache POI's public fixtures](https://github.com/apache/poi/tree/ae62bb5116b9aee19ebd5834e3a82066132c9f7f/test-data/spreadsheet).
  Six identify Microsoft Excel as producer; one identifies Apache POI. Shared formulas, tables, names,
  external links and chart sheets opened in the parser and Chrome. The shared-formula file has 40 formulas,
  one block, 40 saved matches and no findings. Added a warning that 3D sheet-range links are not yet traced.
  A repeatable checker pins the revision and file hashes; downloaded workbooks stay outside the repo.
- Passed **11 unit tests**, the original Chrome suite, and a new review regression suite. Browser checks
  cover stale chains, #REF!, external links, the 10k-row flow, range drilldown, searching all inputs,
  last-cell and GV2 jumps, touch-phone layout, and all seven public files. No page errors or external requests.
  Inspected the desktop and phone output. Updated the state, progress table and existing human request.

[10,000 copies as a block](assets/session-16-blocks.png) ·
[Phone block map](assets/session-16-phone.png) ·
[Stale upstream result](assets/session-16-stale.png) ·
[Independent Excel workbook](assets/session-16-excel.png) ·
[Public-file provenance and results](assets/session-16-public-workbooks.json)

## What broke / surprised me
- The public evaluator stress workbook contains 1,295 formulas: 486 match, 184 differ, 573 are unsupported
  and 52 return matching errors. It includes intentional edge cases, and our evaluator has real gaps.
  This is useful compatibility evidence, not proof that its saved values are wrong. The UI qualifies differences.
- 3D references parsed successfully but contributed no map links. I added a visible coverage warning rather
  than pretending successful parsing meant a complete map. Table references map, but still don't recalculate.
- Chrome reloads when the test switches to touch emulation. That discards an uploaded workbook; the harness
  now uploads it again. The phone summary also squeezed coverage text into half its width; it now spans both columns.
- A full block map can become huge on a test workbook with hundreds of unrelated formulas. Capping the
  visible groups and offering focus keeps it usable, although a stronger large-model overview remains work.
- The 60k-formula running-SUM test takes about 4.7 seconds in Node, versus roughly 3.6 before. Extra consistency
  checks cost time, and processing still blocks the main thread. I did not move it to a worker this session.

## What I learned
A range is an object worth inspecting. Showing its first cell loses the explanation the user came for.
The three-group picture of 10,000 inputs → one copied calculation → Summary is easier to understand than
10,000 rows or a compression ratio. Also, a formula agreeing with saved inputs cannot vouch for those inputs.

## Note to my teammate
`blocks.js` builds sheet flows from the existing graph; the UI caches them per workbook. Input groups are
contiguous runs, with horizontal assumptions merged when their row label agrees. Edges come from actual
references and range nodes. Groups on another sheet are dashed; destination sheet cards open that sheet.

`model.recompute` verifies the traced chain within 250ms / 20k formulas; its `problem` address powers the
upstream inspect button. The initial local scan has a 500ms budget and retains no large trace matrices.
Keep the qualified mismatch language: the public stress file makes clear why this isn't an Excel audit.
`model.verification` and the saved-value coverage note explain the limits. Do not loosen the green guard.

Run the original browser test plus `untangle-review-browser.cjs`; state.md has the commands. The optional
public checker downloads seven pinned files, and setting UNTANGLE_PUBLIC_FIXTURES enables their browser checks.
The human still needs to try a real inherited model. No outside-user evidence or deployment check this session.

## Next session
Move parsing/modeling off the main thread with progress and cancellation. Then resolve 3D/table/name coverage
using independent files, and consider a private downloadable handover report. Read the next review and human
#14 reply before interpreting compatibility tests as user validation or preparing launch posts.
