# Review after session 23

**In one sentence:** Earshot lets you inspect and fix how a PDF reads to a blind reader, then download a tagged PDF without uploading your document.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | Clear promise and obvious sample button; the animated proof sits below the initial phone screen. |
| Wow: would I show someone? | 7 | Watching scrambled order become numbered headings, lists and a table makes an invisible problem tangible. |
| Usefulness: does it solve the problem? | 6 | The sample exports and reopens correctly, but an ordinary small table defeats both detection and the available correction tools. |
| Fun / replay: would I come back? | 6 | Useful reason to return with another document; losing an unfinished session discourages longer jobs. |
| Shareability: does it make me send it on? | 6 | I would send the demo to a clerk or teacher; the tagged PDF and HTML are useful things to pass on. |
| Polish: bugs, layout, rough edges | 6 | Attractive desktop editor and phone layout without horizontal overflow; phone picture editing loses visual context and refresh loses work. |

## Top 3 problems
1. **A simple table becomes misleadingly approved prose.** Upload the review fixture `agenda.pdf`, a browser-printed, untagged school-board agenda with a bordered 3-column table: Department / Request / Decision, plus Library / $8,000 / Pending and Sports / $12,000 / Approved. Choose “With Earshot’s fixes.” It finds **7 headings, 9 paragraphs, no table**, treats the three column headers as H3s, and orders the cells down each column. Nevertheless it says “Ready to export” and Checks ✓. The HTML export repeats this broken association. Selecting a cell offers heading/text/list/hide/merge controls, with no way to reconstruct the table. This blocks the research brief’s central promise: let a non-expert correct the detector’s mistakes. Evidence: `agenda.png`, `table-controls.png`, `exported-html.png`.
2. **Phone alt-text editing hides the picture you need to describe.** At 390×844 with touch, load the sample → fixes → Checks → Describe it. The selected editor shows “Picture with no description yet” and a textarea, but no thumbnail; the PDF is in the separate Pages tab. You must switch views to inspect it and then return to write. The page preview’s tiny text also makes checking details difficult. Put the actual picture next to its description field. Evidence: `phone-description.png`, `phone-editor.png`.
3. **Refresh silently discards unfinished remediation.** Load the sample, add a picture description, then refresh. The landing page returns, with no warning, restored document, or restored edits; reopening the sample starts over. This matters for the multi-page agendas and reports the tool targets. Offer a private local draft or a downloadable editing session, and warn before losing changes.

## What's genuinely good
- The sample is a convincing demonstration: the original starts with footer text and jumps between columns; the proposed order restores the title, sections, lists and table, while visibly retaining hidden page furniture.
- The download is substantive. I wrote a picture description, downloaded the tagged PDF, and uploaded that output again: existing H1/H2/H3, list, table headers, artifacts and my description were preserved. “Keep original PDF” also makes sense for an already-tagged document.
- Heading changes and Undo worked. Metadata, table-header review, decorative-picture handling and explanations of the suggestions make the editor approachable.
- Export reporting distinguishes tagging coverage from human judgement. Exporting with missing alt text explicitly reports the unresolved picture. An invalid PDF receives a readable error.
- Tested the live UI on desktop and a 390×844 touch viewport, plus PDF reimport and rendered HTML output. Headless Chrome had zero speech voices, so I cannot judge audible playback or actual screen-reader fidelity; I did not independently validate PDF/UA.

## The one change that would make it more wow-worthy
Add **“select this region → make it a table”**, with editable rows, columns and header assignments and an immediate reading preview. Recovering the missed budget table in seconds would demonstrate that Earshot can repair a real document when its automatic suggestions fail—the capability that would make me confidently recommend it.
