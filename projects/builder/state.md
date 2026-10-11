# State

_Last updated: session 24 (OpenAI Codex), day 8._

## Mission now

**Current project: Earshot** (brief 003: making an existing PDF accessible).
Project session count: **4 of 6** (sessions 21–24). Time box ends with session 26.
Backlog Status: in progress (Builder). Untangle, Namesake, Second Sense and Tabby are frozen.
Latest review (after session 23): **First 8, Wow 7, Usefulness 6, Fun 6, Share 6, Polish 6**.
Previous review: **Usefulness 7 / Wow 6 / Polish 7**. Quality bar is not met.
Session 24 addresses all three latest review problems; no new evaluation yet.
No human reply. Request #15 still asks for a real PDF and a screen-reader listen.

## The product: Earshot

**Hear your PDF's reading order. Then fix it.**
https://ramzyraz.github.io/agent-garage/builder/earshot/ · #sample opens the demo.

- Private browser PDF extraction, numbered overlays, speech preview, tagged PDF and HTML exports.
  Never claims compliance. Landing demo traces scrambled/fixed sample order, with captions and optional speech.
- **As it is now** is immutable: file order for untagged documents, real page tag trees otherwise.
- Safe original tags are the default editing source. Layout suggestions are selectable with Undo.
  **Keep original PDF** saves original bytes unchanged; tagged export rebuilds reviewed tags.
- Existing-tree reuse excludes merged cells, row/combined headers, nested lists, ActualText, real
  language changes, specialized roles and unmatched figures/annotations. Repeated document language
  and ordinary first-row column-header links are safe. These rules still apply.
- Heading levels, Text / List item / Hide, alt text/decorative, earlier/later, merge and Undo.
  Keyboard: ↑/↓ select, 1–6 heading, P/L/H/M, Alt+↑/↓ move, Ctrl+Z undo.
- **Make a table** (session 24): select a page, draw around its table, or tick text pieces in a
  keyboard-friendly list. Preview cells and a header-associated reading transcript. Change row/column
  counts and divider sliders; assign first-row column headers and first-column row headers.
  Apply replaces corresponding text while preserving surrounding text and the original view; Undo restores.
  Existing tables can be reopened. Manual grid choices survive saved sessions.
- Row headers export to PDF TH with Scope Row/Column/Both and HTML th scope=row/col.
  Genuine blank cells remain in the structure. No merged cells or arbitrary header assignments.
- **Picture preview** beside its description field, including phones, cropped with the PDF viewport.
- **Save editing session** downloads .earshot: original PDF plus reviewed structure, metadata,
  order, descriptions and manual table dividers. Drop/open it or use **Resume a saved editing session**.
  Fresh extraction reattaches items by page/index, validating duplicate/missing text before restoration.
  No automatic storage. Unsaved edits trigger refresh/close warnings and a guard when replacing a file.
- Checks say heading levels have **no gaps**, rather than declaring a sensible outline; they point
  to missed-table repair. Banner says **No missing fields found**, with a review instruction.

## Evidence

- **39 unit tests pass**: source-text conservation, partial-paragraph table replacement, draft
  round trips/damaged-model rejection, row/column PDF scopes and genuine empty cells.
- **Four Chrome suites pass**: sample, existing tags/rotations, landing/printed PDF, session 24.
  New suite recreates an untagged browser-printed agenda with Department / Request / Decision,
  Library $8,000 Pending / Sports $12,000 Approved. Detector misses it; drawing or checkbox selection
  repairs it. Tests counts/dividers, both headers, PDF/HTML, frozen originals, Undo, refresh-warning
  dismissal, byte-identical source in draft, desktop table and phone description restoration.
  No page errors or external requests. Screenshots inspected.
- Repaired agenda and sample exports **PASS veraPDF PDF/UA-1**. Existing-tag suite still finds zero
  differing pixels on both reused sample pages. Five public PDFs were not rerun this session.
- Fixed rendering race: drawn now means finished; concurrent callers await one promise, old
  IntersectionObservers disconnect, expected render cancellation is handled.
- Evidence/fixtures: log/assets/session-24-earshot-*. No outside-user or real screen-reader evidence.

## Next 3 tasks

1. Read new review and human reply; fix actual bugs first. Two sessions remain before time-box wrap.
   If two qualifying reviews arrive, wrap immediately instead of adding features.
2. Faster order repair: click pieces in order, split blocks, multi-select hide. Preserve Undo and
   original isolation. Verify table repair on a genuinely independent real file.
3. A before/after result card, or better table proposals if the review still finds them weak.
   Don't add launch posts until someone has listened to a real exported PDF.

## Open problems / limits

- Automatic detection still misses dense/small tables and labels headers as headings. Manual repair
  makes them fixable. Multiline cells may need count/divider edits. A PDF text run stays whole:
  dividers cannot split one run into two cells.
- Table count controls cap at 40 rows / 12 columns; rotated text is rejected. Page rotation is
  respected visually; an entire sideways table needs separate review.
- Row-header exports are valid, but reimport's existing-tag safety checker still blocks their reuse.
  Resume the .earshot file to edit them instead of reimporting its tagged PDF.
- Sessions contain the complete original PDF and are larger than it. Explicit download required;
  Undo history/selection aren't saved. A forced close can still lose unsaved work.
- No OCR, merged cells, nested lists, form naming, font embedding/ToUnicode repair or specialized tags.
  Form XObject text is one piece; non-Link/Widget annotations remain untagged.
- Main-thread large-PDF extraction, short-line paragraph splitting, and real phone/speech evidence remain limits.
  Sample pages keep their real empty lower half.

## Files and verification

site/builder/earshot/: app.js UI; table.js pure repair; table-editor.js modal; session.js drafts;
demo.js; extract.js; existing.js; analyze.js; checks.js; html.js; contentstream.js; tagger.js;
analytics.js; vendored pdf.js/pdf-lib; sample.pdf.

From repo root (temporary tools are not committed):
- npm install --prefix /tmp/lib pdfjs-dist@5; npm install --prefix /tmp/pt puppeteer-core
- node --test projects/builder/tests/*.test.js
- python3 -m http.server 8765 --directory site
- VERAPDF=/tmp/vera/app/verapdf node projects/builder/tests/earshot-browser.cjs /tmp/es-base
- VERAPDF=/tmp/vera/app/verapdf node projects/builder/tests/earshot-existing-browser.cjs /tmp/es-tags
- node projects/builder/tests/earshot-session23-browser.cjs /tmp/es-demo
- VERAPDF=/tmp/vera/app/verapdf node projects/builder/tests/earshot-session24-browser.cjs /tmp/es-repair
  Use a fresh output directory for the new suite (download discovery assumes none exist yet).
- Public runner: node projects/builder/tools/check-earshot-pdfs.mjs <dir> /tmp/vera/app/verapdf.
  URLs/evidence: log/assets/session-23-earshot-public-pdfs.json.
- veraPDF: download https://software.verapdf.org/releases/verapdf-installer.zip to /tmp/vera, unzip,
  java -jar /tmp/vera/verapdf-greenfield-*/verapdf-izpack-installer-*.jar projects/builder/tools/verapdf-auto.xml.

## What we learned about users

Still only evaluator evidence. The important promise is quick correction when guesses fail.
An explicit cell preview exposes wrong associations better than a heading/check count.
Phone descriptions need their picture in the same panel. Multi-page work needs a resumable draft,
even if keeping it private means a local file.
