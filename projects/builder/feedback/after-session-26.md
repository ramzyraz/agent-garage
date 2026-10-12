# Review after session 26

**In one sentence:** A browser-only tool that shows how a screen reader reads your PDF (scrambled order, unlabeled pictures), lets you fix headings, tables, reading order and alt text, then exports a tagged PDF or HTML.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | Headline is clear. The live demo draws a scrambled path across the page with a "READ 4 OF 16" caption. The "Try a sample PDF" button works with no upload. |
| Wow: would I show someone? | 6 | The before/after reading-order visualisation is a good idea. But I had no sound (the headless browser has no voice), so the "hear it" hook was a silent caption box. It is useful rather than jaw-dropping. |
| Usefulness: does it solve the problem? | 8 | Solves a real accessibility problem. Sample loads in about 2s and the banner explains it ("jumps around 5 times, 6 pieces of page furniture, skips 1 picture"). "With Earshot's fixes" finds 6 headings, 1 table, 3 list items and hides the page furniture. There is a picture-alt prompt before download. The Checks panel admits it can't verify structure. I did not test real-world messy PDFs. |
| Fun / replay: would I come back? | 4 | It's a utility. I'd come back only if I had a PDF to fix. Nothing playful, and no scoring or progress. |
| Shareability: does it make me send it on? | 5 | "Your PDF stays in this tab" is a good trust line. There is no shareable before/after result, and nothing to send except the link. |
| Polish: bugs, layout, rough edges | 7 | No JS errors. A non-PDF upload gets a clear error. Desktop layout is clean. Rough edges are listed below. |

## Top 3 problems
1. The "Sound off" button in the read-aloud bar renders as struck-through "Sound" next to "off" (desktop and mobile). It is ambiguous whether sound is on or off. The bar says "No voice available in this browser: reading silently". On a machine with no voice the headline feature is silent, and the only hint is small text.
2. On mobile (390px) the sticky read-aloud bar covers about a quarter of the screen over the Checks list. The tab row is oversized: "Pages / Reading order / Checks" are three large buttons, and the Read/Undo/More/Download controls stack above the page, so the document starts below the fold. Each of the 6 controls is large, so the first screen is mostly chrome.
3. The counts disagree. The landing demo says "READ 4 OF 16", but the editor says "READING 4 OF 48" for the same sentence. The Checks panel shows "Document title ✓" for a title Earshot silently set, while the banner still calls the file "untitled". The "1 thing needs you before export" count is easy to miss.

## What's genuinely good
- The sample PDF is well chosen: a real-looking town notice with a two-column layout, bullets and a picture. The before/after toggle shows an actual difference.
- Numbered reading-order badges on the page, with a matching list, make the scramble visible without audio.
- The honest copy, such as "cannot confirm that headings, reading order or table associations are correct. Read through every page", builds trust.
- Keyboard shortcuts for heading levels, a "Make a table" tool, and save/resume session files show depth.
- The picture dialog before download ("Describe it" / "Download anyway") nudges without blocking.

## The one change that would make it more wow-worthy
Make the audio the hero. Include a bundled recorded or synthesized clip, so "As it is now" vs "With Earshot's fixes" plays the same page as scrambled and then as sensible, even when the browser has no voice. Right now the best moment depends on the visitor's device. Add a shareable before/after clip or image as well.
