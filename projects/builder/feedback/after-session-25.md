# Review after session 25

**In one sentence:** Earshot lets you see and hear a PDF’s scrambled reading order, repair its structure, and download a version that is easier to use with a screen reader.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | Excellent headline and immediately available sample; the live demonstration is buried on phones. |
| Wow: would I show someone? | 7 | Watching an untagged, scrambled notice become ordered headings, lists and a table is compelling. The transformation needs a faster payoff. |
| Usefulness: does it solve the problem? | 7 | Real PDF export, existing-tag import and manual repairs make this useful for simple school/council documents. Ordinary wrapped table cells still defeat the suggestions. |
| Fun / replay: would I come back? | 6 | I would return for another document; inspecting structures is work, and the sample provides little reason to replay. |
| Shareability: does it make me send it on? | 6 | Worth forwarding to colleagues who remediate PDFs, but the before/after benefit takes too much patience to demonstrate casually. |
| Polish: bugs, layout, rough edges | 8 | Clear desktop panels, usable phone tabs, helpful errors and working undo/session restore. The green checks overstate how much has been reviewed. |

Tested live in Chrome at 1440×1000 and 390×844 with touch; inspected screenshots, sample edits, PDF/HTML exports, session restore, exported-PDF reimport, separate test PDFs and invalid/blank files. No source or builder logs inspected.

## Top 3 problems

1. **An ordinary wrapped table becomes scrambled prose.** Upload [wrapped-table.pdf](wrapped-table.pdf), then choose “With Earshot’s fixes.” Its Workshop / When / Cost table has three data rows, with two workshop names wrapping onto a second line. Earshot finds no table, makes the column labels H2 headings, and reads “$10 skills for older adults” and “Free meals for a family.” See [the screenshot](wrapped-table.png). This corrupts the meaning of exactly the public notices the product targets. Manual recovery works: draw around the table and change Rows from 6 to 4; the preview then contains the correct cells.

2. **Unreviewed structure gets a green success signal.** On that same upload, open Checks before making any repairs: “Checks ✓,” “No missing fields found,” and “4 headings with no level gaps” accompany the broken table. The text does ask for human review and includes a missed-table advisory, but the dominant visual signal is success. Distinguish “fields present” from “structure reviewed,” and make suspicious alignments a visible review task instead of a generic informational reminder.

3. **The phone landing page postpones the demonstration.** At 390×844, the headline, explanatory paragraph, upload box, sample explanation and resume link put the live demo heading around 850 CSS pixels down; its page preview is farther down still. The demo starts with publication/page-number furniture and offers Pause, Hear it and an editor link, but no quick “show the fixed order” control. A new visitor must scroll and wait to experience the strongest selling point. Put a short, directly switchable before/after above the long explanation.

## What's genuinely good

- The built-in notice becomes a sensible column-by-column order with six headings, a real fee table, list items and hidden repeated furniture. A separate opening-hours PDF also had its headings and two-column table detected correctly.
- The repair tools are substantive: drawing a missed table recovered wrapped cell text; changing heading levels and hiding pieces updated checks, and Undo restored them. Picture descriptions have an actual image preview, including on phones.
- Downloaded PDF tags survived reimport, including the table and my picture description. The saved .earshot session restored that description, and the HTML export was readable and retained the image and table. These are useful deliverables for the target audience.
- Missing picture descriptions trigger an export intervention; malformed PDFs and pages without selectable text get clear errors while preserving the previous document. The interface explicitly explains the limits of automated checks.

## The one change that would make it more wow-worthy

Turn suspicious table layouts into a guided repair moment: highlight “These aligned lines may be a table,” open the existing region/cell preview in one click, and play the corrected header/value reading immediately after confirmation. The wrapped-table test already becomes correct with the existing tools; discovering that repair should feel obvious and rewarding instead of requiring the visitor to distrust a green check.
