# Review after session 24

**In one sentence:** Earshot is a browser-only tool that shows how a screen reader would read your PDF's scrambled structure, lets you fix headings, tables and reading order, and exports a tagged PDF.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 6 | The headline and the orange "Try a sample PDF" button are clear. But the promised "watch a screen reader read it twice" demo sits below the fold and looked empty when I scrolled to it (see problem 1). The pitch is text, not a visible hook. |
| Wow: would I show someone? | 6 | Numbered boxes on the page jumping around (8, 15, 16, 9...) and then sorting into order is a real aha. The hearing part, which is the hook, I couldn't verify in headless Chrome. |
| Usefulness: does it solve the problem? | 7 | It solves a real problem for a narrow group. Auto-detected headings, list items, a table with headers, hidden running headers/footers, title and language all work. It exports a tagged PDF (the download dialog reported 71 of 71 text pieces tagged) and an HTML version. Only the sample PDF was tried; I didn't test a messy real-world file. |
| Fun / replay: would I come back? | 4 | It's a utility. After fixing one document there's no pull to return, apart from the next PDF you need to fix. |
| Shareability: does it make me send it on? | 5 | The privacy badge ("Your PDF stays in this tab") is good. There's nothing to share and no before/after result to show. A person fixing a PDF has no reason to post it. |
| Polish: bugs, layout, rough edges | 7 | No console errors. Desktop and mobile layouts are clean, with no horizontal overflow at 390px. The error message for a bad file is friendly. But the demo panel looks broken, and mobile stacks a lot of controls before the PDF. |

## Top 3 problems
1. **Landing demo looks broken.** Load /builder/earshot/ on desktop, wait 3s, scroll to "Watch a screen reader read the same page twice". It shows "Loading the sample…" over a blank white page and an empty dark box, with Play and Hear it buttons beside them. The product's best moment (before/after) isn't visible without clicking, and what's visible looks like a failure.
2. **Mobile editor buries the content (390×844).** After "Try a sample", the title is truncated ("Millbrook summ…"). Six controls, a save note and a long warning banner come before the page. The PDF only starts around y=570, so the first screen is all chrome. It also has three tabs (Pages / Reading order / Checks) where desktop shows two panes. Editing a table or dragging a region on touch is untested and likely hard.
3. **The audio side isn't discoverable or verifiable.** "▶ Listen" sits among five similar buttons and nothing visibly changed when I pressed it (headless has no speech engine, so I can't tell if it works). There's no on-screen read-along, such as a highlighted current box or a caption, that makes the before/after difference visible without sound. The "1 thing needs you before export" banner and the "Describe it" link are also easy to miss. Exporting without alt text still succeeds, with a small amber warning.

## What's genuinely good
- Sample-first flow: one click gives a realistic two-page notice with an obvious problem.
- The overlay with numbered boxes makes an invisible problem (reading order) visible. The "As it is now" / "With Earshot's fixes" toggle is a clear before/after.
- The Checks tab is concrete and honest: title, language, picture description, heading levels, table headers, hidden page furniture. It says "A person still has to confirm the meaning" rather than overclaiming.
- It outputs a real tagged PDF with a verification summary, which is far beyond a mock-up.
- Keyboard shortcuts for heading level, move and merge are shown in the panel. Resuming a saved session is supported. The privacy claim is prominent.

## The one change that would make it more wow-worthy
Put a self-playing before/after on the first screen. Run the sample page with a visible highlight stepping through the boxes in file order, with captions of the scrambled sentences, then again in fixed order. It should work with no sound and no clicks. A visitor would see the problem and the fix in five seconds, which is a better hook than a paragraph of text.
