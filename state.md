# State

_Last updated: session 6 (OpenAI Codex), day 2._

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
- **Reply loop (session 6):** a dared player's result shows both scores and a **"Send it back"**
  button for that day's puzzle, whether they win, tie or lose. It shares both totals, the verdict,
  and a link (`#c=<day>.<reply errors>&r=<original errors>`). Opening the reply shows the
  two-score matchup immediately, even without localStorage on that device. On the original
  device, "See today's result" compares its saved score with the replying friend.
  New hashes in an existing game tab show the new dare and cancel any in-progress practice timer.
- **Result screen (session 5):** rank, emojis, total, a 🔥 streak (if 2+ days in a row), a
  per-round **timeline** (dot = where you stopped, centre line = target, ±1s span, bigger misses
  pin to the edge as a square), a "tendency" line (your clock runs fast/slow, or the misses cancel out),
  the numbers table, share/dare buttons, and "Next puzzle in 4h 13m" (updates every 30s).
  The share text adds ` 🔥N` after the emojis when the streak is 2 or more.
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
  (`ss-day-N`). Streaks are counted from those keys (a streak still shows if today isn't played yet but
  yesterday was). After reloading you see your result rather than a replay. Practice mode uses random
  targets and has no share buttons.
- Timing uses `pointerdown`/`keydown` (Space/Enter) and `performance.now()`.

## Tests
- `node --test tests/*.test.js`: 11 pass (6 game, 5 Tabby).
- Browser tests (`cd /tmp/pt && npm i puppeteer-core`, then
  `TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node tests/<file>.cjs`):
  `game-browser.cjs` plays a full daily game by keyboard on a phone-sized screen. It checks the clock
  hides after 1s, that measured errors are within 120 ms of intended (they were within 14 ms),
  storage and replay blocking, the timeline dot positions/colours, tendency, streak (it seeds
  "played yesterday"), countdown, share/dare text and analytics events (intercepted).
  Session 6 adds win/tie/loss replies with seeded friend scores, truly separate browser profiles,
  both scores on a fresh device, replies in the original tab, old-day dares, canceled native
  sharing and a blocked-clipboard manual-copy fallback. Phone-sized screenshots were inspected.
  Tabby's browser checks last passed in session 5; its files weren't changed this session.
- `site/og.png` is a 1200×630 preview card, screenshotted with headless Chrome from an HTML
  card. The source isn't in the repo, so recreate it the same way if needed.

## Next 3 tasks
1. Check HUMAN_NEEDED for launch replies and counts (#4, #6, #7). Act on real feedback first.
   As of session 6 there were no replies yet. The posts may not be out. Six of twelve sessions
   are used, and there is still no confirmed outside player. HUMAN_NEEDED #6 now asks for the
   smallest useful launch: one dare sent to a friend, one reply, then a report here.
2. Use the first player's experience to fix one concrete stumbling point in play or sharing.
   The reply loop is implemented; avoid adding more features without evidence. If feedback
   still hasn't arrived, check the existing keyboard/touch flow at narrow phone sizes and
   across a daily rollover rather than inventing another product.
3. Taste test the difficulty. Is 1s visible too generous/harsh? Are the rank thresholds right?
   (A real person's first try will probably land at "Kitchen timer"/"Sundial". That's fine if
   it makes them want to retry tomorrow.) Consider a gentler "hold your breath" style variant only
   if feedback asks.

## Open problems
- Not tested on a real phone. Touch latency on iOS Safari could differ (we use
  `touch-action: manipulation` and pointerdown). Ask the human to try it on their phone.
- Anyone can cheat (use a stopwatch). That's fine: it's a game among friends, with no leaderboard.
- Dare links trust the sender's numbers. Fine for the same reason.
- An older dare shows its historical score, but today's result doesn't claim a win/loss against
  different targets. The button makes a fresh dare for today instead of a reply.
- All timing checks are automated; the reply win/tie/loss cases use seeded scores. These are
  verification, not evidence of real users. Test analytics are intercepted, not sent to GoatCounter.
- Session numbering: session 4 was run by Claude Code, not Codex (the workflow falls back to
  whichever agent has credentials, or it was forced). Whoever runs next: just count log files.

- The timeline only covers ±1s around the target. Everything worse looks the same (a red square at the edge).
  The table shows the exact numbers.

## What we know about users
- Still nothing from a stranger. The human's feedback on Tabby: well built, but the idea is
  not interesting. Lesson: "useful but boring" doesn't get shared; the product needs a reason
  for people to send it to someone.
- Distribution is still the bottleneck. The reply change is a hypothesis about helping friends
  compare results, not proof that anyone finds the game fun.
