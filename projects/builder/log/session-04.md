# Session 04 · Day 2 · Claude Code

**Goal this session:** follow the human's feedback (Tabby is "meh") and ship a playable,
shareable, *fun* first version of a new product in one session.

## What I did
- Read the human's reply in HUMAN_NEEDED #5: Pages is live, but drop Tabby and build
  something people would play, screenshot and send to a friend. I agree with them. Tabby solved a
  real problem, but nobody shares an expense splitter for fun, and that's what we needed.
- Considered five ideas:
  1. **Name → monster generator** (type your name, get a unique creature). Very shareable, but
     the result is only as good as the art, and generated SVG art is a big quality risk to ship in a session.
  2. **"Draw a perfect circle" scorer.** Proven fun, but neal.fun already did it famously.
  3. **Daily emoji/word puzzle.** Wordle clones are everywhere, and puzzles need good content daily.
  4. **"Which costs more?" higher/lower game.** Fun, but it needs a dataset we'd have to source and check.
  5. **Second Sense (chosen):** stop a clock at an exact target time *after it disappears*.
     It takes a second to understand, a round lasts 30 seconds, it needs no content or art, and it's
     honestly a little addictive. Daily shared targets plus a Wordle-style emoji line give people
     something to compare. A **dare link** carries your score to a friend, which reuses the
     "data lives in the link" trick from Tabby.
- Moved Tabby to `site/tabby/` (still live at `/builder/tabby/`, all its tests still pass) and
  built Second Sense at the site root: `game.js` (pure logic), `play.js` (UI), new style,
  analytics with new fixed event names, and a new link-preview image.
- Verified: 4 new unit tests. A headless-Chrome test plays a whole daily game, and the
  stops it measured were within 14 ms of where the test aimed. It also checks that the clock hides after 1s,
  that you can't replay today after reloading, the share text, that the dare link opens for a "friend",
  that junk links are ignored, that analytics requests are intercepted, and that there are no
  console errors. I also tapped through it with touch on a phone-sized screen and looked at screenshots.
- Wrote new launch posts (HUMAN_NEEDED #6), with "send a dare to friends" first.

## What broke / surprised me
- This is session 4, an even number, so by the rules it should have been Codex's session. It was run as Claude
  Code. Probably the workflow's fallback when one agent has no credentials, or a manual run.
  I just counted log files and carried on.
- In the screenshot, the revealed time was barely readable because browsers grey out disabled
  buttons. One CSS line fixed it, and I'd have missed it without looking at the screenshot.
- A subtle keyboard bug I caught before it happened: pressing Enter on a focused "Next" button
  would have run both my shortcut and the button's own click, skipping a round. The browser test
  now presses Enter on that button to prove it advances exactly one round.

## What I learned
- The human's feedback is the first real user signal we've had: "well built" isn't the same as
  "worth sharing". I designed the new product around the share and the dare from the start.

## Note to my teammate
Hi Codex. Sorry for the sudden pivot. The human asked for it, and your analytics pattern carried
straight over (`site/analytics.js` is the same design with new event names, title
"Second Sense"). The best next step is to make the result screen worth screenshotting
(see state.md task 2), unless feedback comes in first. Please don't add a leaderboard or
backend. The game should stay $0 and serverless.

## Next session
Check for launch replies and phone feedback. Then improve the result screen (per-round
timeline, streaks, countdown to tomorrow's puzzle).
