# State

_Last updated: session 4 (Claude Code), day 2._

## The product: Second Sense (pivoted in session 4)

**A 30-second daily game: stop the clock at an exact target time after the clock disappears.**
https://ramzyraz.github.io/builder/ (Pages is live, HTTP 200. The deploy runs after every session.)

- **The loop:** you get 5 targets (e.g. 4.37s). Tap to start. The clock shows for 1 second,
  then fades to `?.??`. Tap to stop when you *feel* you've hit it. Each round gets
  an emoji (🎯 ≤0.05s, 🟩 ≤0.15, 🟨 ≤0.35, 🟧 ≤0.7, 🟥 worse). Your total error
  gives you a rank (Atomic clock, Metronome, Swiss watch, Kitchen timer, Sundial, Goldfish).
- **Why it should spread:** everyone gets the same targets each day (like Wordle), so results
  can be compared. "Share result" copies a Wordle-style emoji line. **"Dare a friend"** copies a
  link (`#c=<day>.<5 errors in ms>`). The friend who opens it sees "You've been dared:
  off by 1.29s…", and after playing sees whether they won.
- **Why we pivoted:** the human (HUMAN_NEEDED #5, now Done) said Tabby was "meh":
  expense splitters are everywhere and nobody shares one for fun. They asked for something people
  play, screenshot and send to friends. Ideas considered in session 4 are in `log/session-04.md`.
- **Tabby still works** at https://ramzyraz.github.io/builder/tabby/ (moved to `site/tabby/`,
  with its own analytics path `/builder/tabby/`). Don't spend sessions on it.

## Files
- `site/game.js`: pure logic (puzzle number from the local date, seeded targets, grades, titles,
  share text, dare-link encoding). `site/play.js`: UI. `site/analytics.js`: GoatCounter, fixed
  labels only. Events: `daily-started`, `daily-finished`, `result-shared`, `challenge-copied`,
  `challenge-opened`, `practice-started`. No scores or links are sent.
- Puzzle #1 = 5 Oct 2026 (local calendar day). Today's result is saved in localStorage
  (`ss-day-N`). After reloading you see your result rather than a replay. Practice mode uses random
  targets and has no share buttons.
- Timing uses `pointerdown`/`keydown` (Space/Enter) and `performance.now()`.

## Tests
- `node --test tests/*.test.js`: 9 pass (4 game, 5 Tabby).
- Browser tests (`cd /tmp/pt && npm i puppeteer-core`, then
  `TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node tests/<file>.cjs`):
  `game-browser.cjs` plays a full daily game by keyboard on a phone-sized screen. It checks the clock
  hides after 1s, that measured errors are within 120 ms of intended (they were within 14 ms),
  storage and replay blocking, share/dare text, the dare link in a fresh page, malformed hashes, and
  analytics events (intercepted). The `tabby-*.cjs` tests still pass after the move.
- `site/og.png` is a 1200×630 preview card, screenshotted with headless Chrome from an HTML
  card. The source isn't in the repo, so recreate it the same way if needed.

## Next 3 tasks
1. Check HUMAN_NEEDED for launch replies and counts (#6, #7). Act on real feedback first.
2. Make the result **screenshot-worthy**. Right now it's text and emojis. Ideas: a mini "timeline"
   showing where you stopped vs the target for each round, a "streak" counter (localStorage),
   and a countdown to the next puzzle. Keep it fast.
3. Taste test the difficulty. Is 1s visible too generous/harsh? Are the rank thresholds right?
   (A real person's first try will probably land at "Kitchen timer"/"Sundial". That's fine if
   it makes them want to retry tomorrow.) Consider a gentler "hold your breath" style variant only
   if feedback asks.

## Open problems
- Not tested on a real phone. Touch latency on iOS Safari could differ (we use
  `touch-action: manipulation` and pointerdown). Ask the human to try it on their phone.
- Anyone can cheat (use a stopwatch). That's fine: it's a game among friends, with no leaderboard.
- Dare links trust the sender's numbers. Fine for the same reason.
- If a friend opens a dare from an older puzzle, they play today's targets, and the banner says so.
- Session numbering: session 4 was run by Claude Code, not Codex (the workflow falls back to
  whichever agent has credentials, or it was forced). Whoever runs next: just count log files.

## What we know about users
- Still nothing from a stranger. The human's feedback on Tabby: well built, but the idea is
  not interesting. Lesson: "useful but boring" doesn't get shared; the product needs a reason
  for people to send it to someone.
