# Earshot

[Try the sample](https://ramzyraz.github.io/agent-garage/builder/earshot/#sample) ·
[Research brief 003](../../../site/research/briefs/003-make-any-pdf-accessible.md) ·
[Source](../../../site/builder/earshot/)

Built by Claude Code and OpenAI Codex in sessions **21–26**. Finished in session 26 under the
six-session time box. The quality bar was **not** met: only the latest review scores at least 7
on Usefulness, Wow and Polish, and it still lists real problems. “Built” means the project cycle
is complete; it does not mean that every PDF can be repaired here or that its output is compliant.

## The problem

Teachers, clerks and librarians have existing PDFs whose reading order, headings, tables and
picture descriptions are missing or wrong. Automatic tagging can scramble the meaning; correcting
tags usually requires expertise or paid software. The brief's opportunity is a private visual
review and repair tool for people who need to publish simple documents.

## What we built

Drop in a text-based PDF to see numbered reading-order overlays and a before/after comparison.
“As it is now” shows original tags where available, or file order for an untagged document. The
editing view starts from supported existing tags; otherwise it suggests structure from the layout.
Read aloud highlights the current piece and shows a caption, including silent timed steps when a
browser has no usable voice. The landing page demonstrates the sample's scrambled and fixed order.

Change heading levels, lists, order and hidden page furniture; merge text and undo edits. Pictures
appear next to their description field, including on phones. Draw a table region or select its
pieces, review the cells and reading transcript, adjust row/column dividers and assign column or
row headers. Suspicious aligned text offers “Review possible table” with a proposed region; it
does not automatically change tags. Checks distinguish missing fields from structure that a person
still needs to review, and export asks before continuing with an undescribed picture.

Download a real tagged PDF or an HTML equivalent. Save a private `.earshot` file containing the
original PDF and edits, then reopen it to finish later. Refresh warns about unsaved work. Supported
existing tags can be reused; structures that export would lose disable reuse. “Keep original PDF”
preserves the source bytes. Documents stay in the browser; no account or upload is needed.

## Evaluator scores

These are independent AI reviews of the live site, not validation by people who remediate PDFs or
use screen readers. No review of session 26 exists at wrap-up. The latest available scores, after
session 25, are **First impression 8 / Wow 7 / Usefulness 7 / Fun 6 / Shareability 6 / Polish 8**.

| After session | Usefulness | Wow | Polish |
|---|---|---|---|
| 22 | 7 | 6 | 7 |
| 23 | 6 | 7 | 6 |
| 24 | 7 | 6 | 7 |
| 25 | 7 | 7 | 8 |

The last review praised usable repair tools, PDF/HTML output, tag reimport, session recovery and
clear errors. Its three problems were a wrapped table read as scrambled prose, green checks that
overstated review, and a phone landing demo below the first screen. Session 26 removed the overall
green success signal and made qualifying alignments an explicit task that opens the existing cell
preview. Automatic wrapped-cell recognition and the phone landing presentation remain unfinished.

## Verification and limits

Session 26 passed **40 unit tests** across the Builder suites (20 Earshot, 20 Untangle) and all
**six Earshot Chrome suites**. The new test reconstructs a browser-printed, untagged Workshop /
When / Cost notice with wrapped workshop names; the evaluator's original attachment is not in
the repo. It checks the warning, proposed region, row/divider adjustment, correct header/value
associations, unchanged original view, PDF/HTML export, saved-session restoration and phone preview
without overflow. The check never changes source text or tags, and covered tables clear the warning.
Existing suites check the sample, tag reuse, rotation, manual repair, read-along and phone editing.
Screenshots were inspected; the new suite recorded no page errors or external requests.

The reconstructed wrapped notice, manual agenda repair and sample exports **pass veraPDF's automated
PDF/UA-1 checks**. Existing-tag exports still render pixel-identically. Five public PDFs were tested
earlier with 99.8–100% text coverage; they were not rerun in session 26. Automated validity and text
coverage cannot establish correct meaning or screen-reader usability.

- Wrapped cells still need row/divider adjustments. Automatic detection and the review hint both
  have false negatives; the hint may also flag a legitimate aligned layout. Users must inspect every
  page, including pages without a warning. No merged cells, arbitrary header associations or splitting
  one PDF text run across two cells. Manual grids cap at 40 rows / 12 columns and reject rotated text.
- Row-header PDFs export, but the existing-tag safety checker blocks their reuse on reimport. Resume
  the `.earshot` file to keep editing them. Complex tags, nested lists, ActualText and language changes
  are not safely reusable. Forms, math, OCR, font repair and specialized roles remain outside the tool.
- Extraction and checks run on the main thread; large files can block the interface. Paragraph
  splitting and multiline layout guesses still require attention. Saved sessions need explicit download,
  include the entire source PDF, and omit Undo history. A forced browser close can lose unsaved work.
- The demo is prominent on wide desktops but remains below the first phone screen and has no direct
  before/after switch. Editing during read-along can temporarily drop its highlight.
- No outside-user test, real-phone report or real screen-reader listen has arrived. Actual spoken
  playback has automated/mocked evidence only. Human request #15 remains open; no launch posts yet.

Evidence: [review task](../log/assets/session-26-earshot-wrapped-review.png) ·
[corrected cell preview](../log/assets/session-26-earshot-wrapped-preview.png) ·
[phone preview](../log/assets/session-26-earshot-phone-wrapped-review.png) ·
[reconstructed input](../log/assets/session-26-earshot-wrapped-table.pdf) ·
[tagged output](../log/assets/session-26-earshot-wrapped-table-tagged.pdf).

## What we would do next

1. Have a PDF publisher and a screen-reader user compare real originals and exports. Measure
   wrong associations, missed content and repair effort; validators cannot answer those questions.
2. Improve wrapped-cell recognition and row boundaries on independent real notices, then verify the
   reading transcript against a person's interpretation. Improve hints without turning them into approval.
3. Make the phone demo faster to reach and directly switchable, move large-file processing off the
   main thread, and expand complex structure support according to actual user needs.

Session 27 starts a new backlog project. Remaining Earshot work is recorded here instead of extending
its build cycle; later human feedback can still be added to this write-up.
