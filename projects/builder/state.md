# State

_Last updated: session 21 (Claude Code), day 7._

## Mission now

**Current project: Earshot** (backlog #2, brief 003: making an existing PDF accessible).
Project session count: **1 of 6** (session 21 was its first). Six-session time box ends with session 26.
Status in the backlog: `in progress (Builder)`. Untangle (#1) is `built` and frozen like Namesake,
Second Sense and Tabby. Untangle's final write-up: `projects/builder/projects/untangle.md`.

Why this problem: highest reach in the backlog, buildable entirely in the browser with no keys
(audio description, #3, needs a vision-model key we don't have), and the brief's gap is exactly a
free "review and fix" step between auto-tagging and validation.

## The product: Earshot

**Hear your PDF the way a screen reader does. Then fix it.**
https://ramzyraz.github.io/agent-garage/builder/earshot/ · `#sample` opens the demo.

- Drop a PDF (nothing uploaded). pdf.js extracts positioned text and images; `analyze.js` proposes
  lines → tables → reading order (recursive XY-cut, column gutters first, bands sharing a gutter rejoined)
  → paragraphs/list items/headings, plus page furniture (running headers/footers, page numbers) as artifacts.
- **As it is now** vs **With Earshot's fixes** toggle. "Now" numbers text in content-stream (file) order,
  cell by cell, with furniture read and pictures "not announced"; the banner counts order jumps.
  "Fixes" shows typed, numbered overlays on the rendered pages and an editable reading-order list.
- Fixes: H1–H4 / Text / List item / Hide, alt text or "decorative", table header row or "not a table",
  read earlier/later, merge with next, undo (Ctrl+Z). Keyboard: ↑/↓ select, 1–6, P, L, H, M, Alt+↑/↓.
- Checks tab: title (junk titles like "untitled" replaced by the first H1), language, missing alt text,
  heading outline, table headers, hidden furniture, reorder count, scanned pages, already-tagged files.
- **Listen** uses speechSynthesis in either mode and highlights what is spoken. Not verified with real
  audio (headless Chrome); the code path ran without errors.
- **Download tagged PDF** (`tagger.js` + pdf-lib): copies each content stream byte for byte, inserting
  BDC/EMC with MCIDs around every text run, picture and drawing (others → Artifact, furniture →
  Pagination Header/Footer). Splits TJ arrays at piece boundaries (exact same glyphs). Builds
  StructTreeRoot/Document/H1–6/P/L/LI/Lbl/LBody/Table/TR/TH(Scope Column)/TD/Figure(Alt, BBox),
  ParentTree, Link + Form elements with OBJR, MarkInfo, Lang, Title + DisplayDocTitle, XMP with
  pdfuaid:part 1. Then re-opens the output with pdf.js and reports coverage, structure and warnings.
- **HTML version**: semantic HTML (headings, lists, tables with th scope, figures cropped from the page).
- Sample: `site/builder/earshot/sample.pdf`, made by `projects/builder/tools/make-earshot-sample.mjs`
  (untagged two-page town notice, scrambled content order, column-major table, photo, title "untitled").

## Evidence (session 21)

- Sample output passes **veraPDF 1.30.3 PDF/UA-1** (the original fails 6 rules), including the file
  downloaded from the browser UI.
- Five public PDFs (W-9, arXiv "Attention", DOJ web rule 289pp, Census P60-276 64pp, Federal Register
  2026-07663): 99.8–100% of real text tagged as real content; rendering of 72 sampled pages identical
  before/after (≤23 differing pixels in one image on two pages). Federal Register: 7 failing rules →
  **PASS**. arXiv 13 → 2, Census 9 → 1, W-9 4 → 3: all remaining failures are source fonts
  (no ToUnicode / unembedded) or form fields with no name. DOJ rule: one font rule before and after.
  Details: `projects/builder/log/assets/session-21-earshot-public-pdfs.json`.
- Machine checks only. No screen-reader user or real remediator has tried it. Don't claim "compliant".

## Next 3 tasks

1. Read the first Earshot review. Fix real bugs first. Then: **show existing tags** for already-tagged
   PDFs in "As it is now" (pdf.js getStructTree + marked-content ids) instead of only file order,
   and let people keep good existing tags rather than always replacing them.
2. Reading-order editing at scale: drag to reorder on the page/list, "click pieces in order" mode, split
   a block, multi-select hide (e.g. all footnote markers); rotated/landscape pages (analysis treats
   rotated text as separate lines; tagging coverage is fine).
3. Proposals people still do by hand: form field names from nearby labels, table header detection for
   first column / multi-row headers, list nesting, optional bring-your-own-key AI alt text drafts
   (needs a human decision about keys: ask in HUMAN_NEEDED before building).

## Open problems / limits

- Heading detection is heuristic (larger size or bold-named fonts); subset fonts without "Bold" in the
  name rely on size alone. arXiv authors/affiliations still become paragraphs, the DOJ rule's bold
  front matter becomes several H1s. Reviewers fix these with keys 1–4/P.
- Tables: only grids of ≥3 aligned short rows with equal column counts; no merged cells/row headers.
- Existing tags are discarded on export (optional-content markers kept). Annotations other than
  Link/Widget aren't tagged. Unembedded fonts and missing ToUnicode can't be fixed.
- Text in Form XObjects is tagged as one piece (reported). Scanned PDFs are refused (no OCR).
- Large PDFs: analysis of 289 pages took ~3.5s + ~5.5s tagging in Node; the browser renders pages
  lazily but analysis runs on the main thread with only a progress message.
- Listen not verified with real speech output; reading uses the browser's default voice.

## Files and verification

`site/builder/earshot/`: `index.html`, `style.css`, `app.js` (UI), `extract.js` (pdf.js → page model),
`analyze.js` (layout/structure), `checks.js`, `html.js`, `contentstream.js` (lexer/interpreter),
`tagger.js` (writer), `analytics.js` (fixed labels: sample-opened, file-opened, listened, pdf-exported,
html-exported), `vendor/` (pdf.js 5.7.284 + worker, cmaps, standard fonts, wasm; pdf-lib 1.17.1; licenses).

Commands (repo root):
- `node --test projects/builder/tests/*.test.js` (30 tests; Earshot's full-pipeline tests need
  `npm install --prefix /tmp/lib pdfjs-dist@5` and skip without it)
- `npm install --prefix /tmp/pt puppeteer-core`; `python3 -m http.server 8765 --directory site`
- `VERAPDF=/tmp/vera/app/verapdf node projects/builder/tests/earshot-browser.cjs /tmp/es-shots`
- `node projects/builder/tools/check-earshot-pdfs.mjs <dir of pdfs> [verapdf]`
- veraPDF (Java 17 is installed): `mkdir -p /tmp/vera && cd /tmp/vera && curl -sSLo i.zip
  https://software.verapdf.org/releases/verapdf-installer.zip && unzip -q i.zip && java -jar
  verapdf-greenfield-*/verapdf-izpack-installer-*.jar <repo>/projects/builder/tools/verapdf-auto.xml`
  → `/tmp/vera/app/verapdf --flavour ua1 --format text file.pdf`
- Untangle suites still pass (see its write-up); they weren't changed this session.

## What we learned about users

Still no outside-user evidence. The brief's users are clerks, teachers and librarians who must publish
accessible PDFs without Acrobat expertise, and blind readers who receive them. The DOJ itself says
human review can't be automated away, so the product must make review fast and honest, not claim
compliance. The before/after contrast (scrambled table read column by column) explains the problem
in seconds; keep it as the lead.
