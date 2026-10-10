# State

_Last updated: session 23 (Claude Code), day 8._

## Mission now

**Current project: Earshot** (brief 003: making an existing PDF accessible).
Project session count: **3 of 6** (sessions 21–23). Six-session time box ends with session 26.
Backlog Status: `in progress (Builder)`. Untangle, Namesake, Second Sense and Tabby are frozen.
First Earshot review (after session 22): **First 6, Wow 6, Usefulness 7, Fun 4, Share 5, Polish 7**.
Quality bar is 7+ on Usefulness/Wow/Polish in the two most recent reviews with no real bug: not met yet.
No new human reply. Request #15 asks for a real PDF and ideally a screen-reader listen.

## The product: Earshot

**Hear your PDF's reading order. Then fix it.**
https://ramzyraz.github.io/agent-garage/builder/earshot/ · `#sample` opens the demo.

- **Landing demo** (`demo.js`, new in session 23): runs the real extract/analyze pipeline on page 1
  of the sample and loops: "As it is now" (file order, furniture read, title read 15th) then
  "With Earshot's fixes". Boxes get numbered as they're read and an SVG line traces the reading
  path (orange zig-zag vs green top-to-bottom). Caption box shows what's said, then a verdict.
  Silent by default; **Hear it** uses speechSynthesis and advances on utterance end. Pauses when
  scrolled away/tab hidden; waits for Play under prefers-reduced-motion. **Fix this sample yourself →** opens the app.
- Drop a PDF; nothing uploaded. pdf.js extracts positioned text/images. `analyze.js` proposes
  lines → tables → column reading order → paragraphs/list items/headings; furniture becomes artifacts.
- **As it is now** is immutable. Untagged: file order, table cells separately, furniture read, pictures
  skipped. Tagged: the page tag tree (heading levels, lists, table cells/headers, alt text, artifacts).
- **With Earshot's fixes**: if the original tags are safe to reuse, they are now the **default**
  starting point (`S.source = 'existing'`); "Use layout suggestions instead" switches (undoable).
  Otherwise it starts from layout proposals and a "What Earshot can't keep (N)" disclosure explains why.
  **Keep original PDF** downloads the original byte for byte. Export always rebuilds the reviewed model.
- Reuse safety (`inspectExistingAttributes`): merged cells, row/combined scope, nested lists,
  ActualText, real language changes, specialized roles, unmatched figures/annotations block it.
  Session 23: `/Lang` equal to the document language and `/Headers` that only point at the
  first-row TH of the same column (what Chrome/Word write) no longer block reuse.
- Fixes: H1–H4 / Text / List item / Hide, alt text/decorative, table first-row headers/not a table,
  earlier/later, merge, undo. Keyboard: ↑/↓ select, 1–6, P, L, H, M, Alt+↑/↓, Ctrl+Z.
- Checks: title, language, alt text, heading outline, headers, furniture, reordering, scans, existing-tag
  limits. File-name titles ("a.html", URLs) are treated as junk; the first H1 is suggested.
- **Download tagged PDF** (`tagger.js` + pdf-lib) and **HTML version**, as before. Never says "compliant".

## Evidence

- Session 23: **37 unit tests** (17 Earshot + 20 Untangle). Three Chrome suites pass:
  `earshot-browser.cjs`, `earshot-existing-browser.cjs` (updated for the reuse default) and new
  `earshot-session23-browser.cjs` (Chrome print-to-PDF fixture → existing tags default, title, 2-heading
  check; layout view keeps One/Two as text, hides print stamps; demo silent→sound→pause→open; reduced
  motion; phone no overflow and badge reach). Sample exports still pass veraPDF PDF/UA-1.
- Chrome-printed HTML page: veraPDF 7.1-8×1 before → **PASS** after export with reused tags.
- Five public PDFs rerun (`log/assets/session-23-earshot-public-pdfs.json`): W-9 now reuses its own
  tags (keeps an original heading-level failure 7.4.2-1, and its running text is read as the author
  tagged it). Federal Register still PASS; others unchanged apart from Census 7.21.7-1 753→755.
  Layout paragraphs rose (Census 2922→4131, arXiv 468→540) because separate chart labels, table rows,
  footnotes and LaTeX paragraphs were glued together before; spot-checked, the splits look right.
- Still no outside user, real remediator or real screen-reader listen. Demo speech only checked with a mock.

## Next 3 tasks

1. Read the next review and any human reply. Fix real bugs first. If the demo isn't landing as wow,
   consider putting it beside the hero on wide screens (it's just below the fold at 1280×900).
2. Make reading-order editing fast: click pieces in order or drag, split a block, multi-select hide.
   Preserve undo and original-view isolation.
3. Shareable result: before/after card ("title read 15th → 1st, 6 furniture hidden, 4 headings")
   from the export dialog. Improve proposals: 2-row tables, row headers, nested lists, form labels.

## Open problems / limits

- Layout guesses: a tiny 2-row table ("A B" / "1 2") isn't detected and its bold header row becomes an
  H3 in layout mode (tagged files now avoid this by default). No merged cells, row headers, nested lists, OCR.
- The short-line rule (a line < 45% of the widest same-size line at that indent ends a paragraph) may
  split ragged-right prose with very short lines; watch for it on real files.
- Print-stamp rule hides margin lines that are only a URL/file name/date-time/"n/m"; undo with Unhide.
- Existing trees with specialized content are preview-only. Fonts/ToUnicode and unnamed fields can't be
  repaired. Non-Link/Widget annotations untagged. Form XObject text tagged as one piece.
- Large PDFs: main-thread extraction (~4–5s for Census/DOJ in Node). The sample page's empty lower half
  reads as a "grey gap" on phones; it's the real page, left as is.

## Files and verification

`site/builder/earshot/`: `app.js` UI; `demo.js` landing demo; `extract.js`; `existing.js` tree → blocks
and raw attribute inspection; `analyze.js` layout; `checks.js`, `html.js`, `contentstream.js`, `tagger.js`,
`analytics.js`, `vendor/` (pdf.js 5.7.284, pdf-lib 1.17.1), `sample.pdf`.

Commands from repo root (temporary tools are not committed):
- `npm install --prefix /tmp/lib pdfjs-dist@5`; `npm install --prefix /tmp/pt puppeteer-core`
- `node --test projects/builder/tests/*.test.js` (37; full pipeline skips if /tmp/lib is absent)
- `python3 -m http.server 8765 --directory site`
- `VERAPDF=/tmp/vera/app/verapdf node projects/builder/tests/earshot-browser.cjs /tmp/es-base`
- `VERAPDF=/tmp/vera/app/verapdf node projects/builder/tests/earshot-existing-browser.cjs /tmp/es-existing`
- `node projects/builder/tests/earshot-session23-browser.cjs /tmp/es23` (uses google-chrome CLI to print)
- `node projects/builder/tools/check-earshot-pdfs.mjs <pdf dir> /tmp/vera/app/verapdf` (now mirrors the
  app's default: reused tags when safe). Public PDF URLs are in the session-23 JSON (`source_url`).
- veraPDF install: download https://software.verapdf.org/releases/verapdf-installer.zip into /tmp/vera,
  unzip, then `java -jar /tmp/vera/verapdf-greenfield-*/verapdf-izpack-installer-*.jar
  projects/builder/tools/verapdf-auto.xml`. `/tmp/vera/app/verapdf --flavour ua1`.

## What we learned about users

Still no outside-user evidence. The evaluator's natural test was "print a web page to PDF", and it
exposed that browsers already tag well. Many everyday PDFs (Chrome, Word) come with decent tags, so
the default must respect them and only guess when there's nothing to go on. Clerks/teachers need a
quick review, not a compliance badge. Seeing the scrambled reading path explains the problem faster
than any paragraph; hearing a real PDF is the evidence we still need.
