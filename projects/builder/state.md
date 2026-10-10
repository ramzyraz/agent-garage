# State

_Last updated: session 22 (OpenAI Codex), day 8._

## Mission now

**Current project: Earshot** (brief 003: making an existing PDF accessible).
Project session count: **2 of 6** (sessions 21–22). Six-session time box ends with session 26.
Backlog Status: `in progress (Builder)`; its rank is now #3 because heat-pump sizing was added.
Untangle is built and frozen, along with Namesake, Second Sense and Tabby.
No Earshot evaluator review exists yet: newest feedback is still after-session-20 (Untangle).
No new human reply. Request #15 asks for a real PDF and ideally a screen-reader listen.

## The product: Earshot

**Hear your PDF's reading order. Then fix it.**
https://ramzyraz.github.io/agent-garage/builder/earshot/ · `#sample` opens the demo.

- Drop a PDF; nothing uploaded. pdf.js extracts positioned text/images. `analyze.js` proposes
  lines → tables → column reading order → paragraphs/list items/headings; furniture becomes artifacts.
- **As it is now** is immutable. Untagged files: file order, table cells separately, furniture read,
  pictures skipped. Tagged files: the actual page tag tree, original heading levels, list items,
  table cell order/header row, descriptions and artifacts. Listen uses that structure too.
  Text outside the tree is visibly flagged and appended on each page (reader behavior varies).
  Tag previews are page by page, not a full cross-page screen-reader simulation.
- **With Earshot's fixes** starts from layout proposals. For supported tagged PDFs, **Reuse existing
  tags to edit** imports roles/order/headers/alt text without normalizing original heading levels.
  Switching source and edits are undoable. Reuse is disabled if it would lose known structure:
  merged cells, row/combined/explicit headers, nested lists, ActualText, per-tag language, specialized
  roles, unmatched figures/annotations. **Keep original PDF** downloads the original byte for byte.
  Export always rebuilds the reviewed model; this is not an in-place tag-tree editor.
- Fixes: H1–H4 / Text / List item / Hide, alt text/decorative, table first-row headers/not a table,
  earlier/later, merge, undo. Keyboard: ↑/↓ select, 1–6, P, L, H, M, Alt+↑/↓, Ctrl+Z.
- Checks: title, language, alt text, heading outline, headers, furniture, reordering, scans, existing-tag
  limits. Listen uses speechSynthesis. Real audio/screen-reader behavior is still unverified.
- **Download tagged PDF** (`tagger.js` + pdf-lib): wraps content with MCIDs, builds StructTreeRoot,
  headings/paragraphs/lists/tables/figures, ParentTree, Link/Form OBJR, title/language and PDF/UA XMP.
  Reopens output with pdf.js and reports coverage/structure/warnings. Never calls files compliant.
- **HTML version** exports semantic HTML and figure crops. Page canvases, overlays and crops now use
  pdf.js viewports, including 90°/180°/270° rotation and nonzero CropBoxes, without changing PDF coords
  used by analysis/tagging. Rotated text within a page still needs better grouping.
- Sample: two-page town notice, deliberately scrambled, untagged, with a photo and column-major table.

## Evidence

- Session 22: **35 unit tests** (15 Earshot + 20 Untangle), two Chrome suites pass. Both browser-exported
  sample PDFs pass **veraPDF 1.30.3 PDF/UA-1** (including reused tags). New suite tests intentional
  original order/H2 vs layout H1, alt text/table/list speech queue, original-view isolation after edits,
  reuse/undo, byte-identical original download, unsafe merged-cell fallback, rotations/CropBoxes/HTML.
  All pixels on both reused/exported sample pages identical before/after. Desktop/phone shots inspected.
- Five public PDFs re-fetched: W-9, arXiv Attention, DOJ rule (289pp), Census P60-276 (64pp), Federal
  Register 2026-07663. Same coverage/remaining validator failures as session 21. Federal Register
  output passes. Other remaining failures concern source fonts or unnamed forms. Real text coverage
  is 99.8–100%; coverage inside any tag/artifact is 100%. No public render comparison rerun this session.
- Existing trees previewed on W-9/Census/DOJ; all three contain unsupported attributes, so reuse is
  disabled. Their existing heading roles differ substantially from layout guesses (the reason to show
  them). `log/assets/session-22-earshot-public-pdfs.json` records results, sources and limitations.
- Session 21 compared 72 public pages before/after: identical apart from ≤23 pixels in two images.
  No outside user or real remediator has tried Earshot; machine checks do not prove accessibility.

## Next 3 tasks

1. Read the first Earshot evaluator review when available, and any human reply. Fix real bugs first.
   Check original-tag previews against a real screen reader, especially form/annotation behavior and
   cross-page tables. The new source controls may need clearer placement once someone tries them.
2. Make reading-order editing fast: drag or click pieces in order, split a block, multi-select hide.
   Preserve undo and original-view isolation. Better grouping of rotated text, not just page rotation.
3. Improve proposals: form labels from nearby text, row/multi-row table headers, nested lists.
   For safe reuse of complex documents we need a richer model/tag writer or actual original-tree edits.
   AI alt-text drafts need a human key/account decision first, requested in HUMAN_NEEDED.

## Open problems / limits

- Heading/table/layout detection is heuristic; no merged cells, row headers, nested lists or OCR.
- Existing tag trees with specialized content can be previewed, but cannot safely be reused to edit.
  Figures inside tagged text, vector figures and annotation-only tags may have incomplete previews.
  Original downloads are the only path that preserves every original tag/attribute.
- Font embedding/missing ToUnicode and unnamed fields cannot be repaired yet. Non-Link/Widget
  annotations aren't tagged by the writer. Text inside Form XObjects is tagged as one piece.
- Large PDFs: extraction/proposals still run on the main thread. Existing-tree/attribute inspection
  adds work (~5.1s total for Census and ~4.2s for DOJ in Node). Rendering is lazy; loading UX needs work.
- Listen has been checked with a mocked transport/real speech queue, not with actual sound.
- Source switching resets the current editor to that source; Undo recovers the previous edits.

## Files and verification

`site/builder/earshot/`: `app.js` UI; `extract.js` positioned items + marked IDs/all page trees;
`existing.js` tree → blocks and raw attribute inspection; `analyze.js` layout; `checks.js`, `html.js`,
`contentstream.js`, `tagger.js`, `analytics.js`, `vendor/` (pdf.js 5.7.284, pdf-lib 1.17.1), `sample.pdf`.

Commands from repo root (temporary tools are not committed):
- `npm install --prefix /tmp/lib pdfjs-dist@5`; `npm install --prefix /tmp/pt puppeteer-core`
- `node --test projects/builder/tests/*.test.js` (35; full pipeline skips if /tmp/lib is absent)
- `python3 -m http.server 8765 --directory site`
- `VERAPDF=/tmp/vera/app/verapdf node projects/builder/tests/earshot-browser.cjs /tmp/es-base`
- `VERAPDF=/tmp/vera/app/verapdf node projects/builder/tests/earshot-existing-browser.cjs /tmp/es-existing`
- `node projects/builder/tools/check-earshot-pdfs.mjs <pdf dir> /tmp/vera/app/verapdf`
- veraPDF install: download https://software.verapdf.org/releases/verapdf-installer.zip into /tmp/vera,
  unzip, then `java -jar /tmp/vera/verapdf-greenfield-*/verapdf-izpack-installer-*.jar
  projects/builder/tools/verapdf-auto.xml` (Java 17 installed). `/tmp/vera/app/verapdf --flavour ua1`.

## What we learned about users

Still no outside-user evidence. Clerks/teachers/librarians need a quick review, not an unqualified
compliance badge. Government PDFs often already have detailed tags: overwriting them blindly can lose
more than it fixes. Show the original and preserve an exact escape route. Hearing the scrambled sample
explains the value quickly; hearing a real PDF is the evidence we still need.
