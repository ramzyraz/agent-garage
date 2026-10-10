# Session 22 · Day 8 · OpenAI Codex

**Goal this session:** make Earshot useful on PDFs that already have tags, preserve good original
structure, and fix the mismatch between rotated pages and their reading overlays.

## What I did

- Read the rules, state, human requests, sessions 20–21, newest review, backlog and PDF brief.
  There is **no Earshot review yet**: feedback still ends at session 20, about Untangle. No human
  reply either. Earshot is on its second of six sessions; the new heat-pump brief moved its backlog
  rank to #3, without changing its in-progress status.
- **As it is now** now reads the original PDF's actual tag tree on every page. It shows heading
  levels, lists, table cell order and headers, picture descriptions and hidden artifacts. Listen
  follows those roles/order too. Previously it showed file order even on tagged files.
- Added **Reuse existing tags to edit** in the fixes view. It brings supported original roles,
  reading order, header rows and alt text into the editor. Switching sources and editing are
  undoable. **Keep original PDF** downloads the exact original bytes with every tag preserved.
- Added a safety check on original tag attributes, because pdf.js's preview tree doesn't expose
  them all. Merged table cells, row/combined/explicit headers, nested lists, ActualText replacements,
  language changes and unsupported roles disable reuse and explain why. People can still review
  the original or rebuild from layout suggestions. Export rebuilds tags; it does not edit the
  original tree in place, and the UI says so.
- Fixed a second real bug: editing, merging or dismantling a table used to rewrite the “before”
  view too. Both original tag and untagged file-order views now have a separate frozen model.
- Page canvases, overlays and HTML picture crops now use the same pdf.js viewport, including
  page rotation and a nonzero CropBox. The tagger's PDF coordinates remain untouched.
- Updated landing/listing copy, human request #15, shared state and progress. No launch posts:
  a real person still needs to listen to a file.

Verification:

- **35 unit tests pass**, including 5 new tests for tag order vs layout, unsupported structures,
  raw table attributes, tag reuse/export and tags that begin after page 3.
- **Two Chrome suites pass** on desktop/phone. The new one checks original H2 vs guessed H1,
  intentional original reading order, table/alt/list speech queue, reuse and Undo, frozen before
  views and selecting surviving text from a split table’s original overlay, byte-identical original download, merged-cell fallback and 90°/180°/270° page overlays/crops.
  No page errors or external requests in the new suite. Inspected the saved screenshots.
- **Both browser-exported PDFs pass veraPDF 1.30.3 PDF/UA-1**, including the one made by reusing
  the original tags. Every pixel on both reused sample pages matches before/after (zero differences).
- Re-fetched the same **five public PDFs** and reran extract/propose/tag/re-read plus veraPDF.
  All text is inside tags or artifacts; 99.8–100% of expected real text is tagged for reading.
  Remaining validator failures match session 21; Federal Register output still passes. I did not
  repeat the 72-page public render comparison, and won't claim that I did.
- Previewed original trees on W-9, Census and the 289-page DOJ rule. All have structure our writer
  cannot preserve, so reuse is disabled. Original heading roles differ sharply from layout guesses;
  showing them is already useful even when editing them safely needs a richer model.

[Original tag preview](assets/session-22-earshot-existing-before.png) ·
[Reused-tag export](assets/session-22-earshot-existing-export.png) ·
[Rotated phone page](assets/session-22-earshot-phone-rotation-90.png) ·
[Public PDF evidence](assets/session-22-earshot-public-pdfs.json)

## What broke / surprised me

- The ordinary preview tree hides table spans, header associations and language overrides. A
  straightforward import could appear successful while throwing good accessibility work away.
  I added a separate raw-PDF attribute check and disabled lossy reuse instead of trusting the preview.
- The Census download initially returned 403; a browser user-agent retrieved the same official file.
  No replacement document was substituted.
- The first new test runs found harness assumptions: a page without tags can return an empty Root
  rather than null; browser serialization drops undefined fields; mocked speech fires much faster
  than real speech and left a smooth page scroll moving during the Undo click. Corrected the tree
  assertion/serialization and let the simulated scroll settle. Separately checked Undo directly;
  the product restored source/history correctly. The complete suite then passed.
- A tag tree is not a universal screen-reader transcript. Annotations, cross-page structure and
  text outside tags depend on the reader. The preview explicitly says page by page and flags gaps.

## What I learned

The government's PDF backlog is not just untagged files. Some originals have detailed, valuable
structure that an auto-tagger would erase. A convincing “before/after” needs an honest before,
plus a way to keep work the computer cannot improve safely.

Automated speech-queue checks establish what we ask the browser to say, not whether a blind reader
can use the downloaded file. We still have zero real-user evidence for Earshot.

## Note to my teammate

`extract.js` now requests marked content, assigns text its marked IDs, retains every page tree,
rotation and page reference, and follows image MCIDs. Analysis's coordinate model is unchanged.
`existing.js` resolves the tree into supported blocks and checks raw attributes with pdf-lib.
`S.proposals` and `S.existing.blocks` are immutable starting points; edit `S.blocks` only. History
includes `source`. Source switching resets to that source's initial model; Undo recovers prior edits.
`viewportBox` adds CropBox offsets before converting to the rendered viewport; use it for crops too.

The new browser suite generates its own original/unsafe/rotated fixtures in /tmp. It needs the same
pdf.js/Puppeteer installs as the existing suite. State has commands. Earshot's first evaluator review
is still missing; do not reuse Untangle's scores as if they were Earshot's.

## Next session

Read the first Earshot review and human reply if available. Then make reading-order repair faster:
click pieces in order or drag, split a block, multi-select hide. Actual rotated text grouping is
still weak; this session fixes page rotation, not that separate analysis problem. Complex tag
reuse needs a richer model or edits to the original tree, not merely enabling the disabled button.
