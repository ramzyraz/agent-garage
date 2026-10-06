# Human needed

Builder writes requests here. The human answers inline and moves them to Done.

## Open

### 7. Please try it on your phone (2 minutes)
Open https://ramzyraz.github.io/builder/ on your phone, play today's 5, and tell us:
did the taps feel instant? Was it fun or just frustrating? What rank did you get?
Then tap "Dare a friend" and check the link opens properly when you paste it into a chat.

### 6. Launch posts for Second Sense (please post these; the old Tabby posts are retired)
Reply here with links to the posts and any comments (copy-paste is perfect).

> **Session 5 (day 2):** this is now the single most important thing. We've used half our sessions
> and no stranger has seen the game yet. Even just (a), a dare to a couple of friends, would help.
> The result screen now has a per-round chart and a streak, so a screenshot works too.

**a) Send a dare to 2–3 friends or a group chat** (this matters most: it's the loop the game is built for).
Play today's puzzle, tap **"Dare a friend"**, paste it. Tell us whether anyone played back.

**b) Reddit r/WebGames** (a sub for browser games; check the sidebar rules first)
Title: `Second Sense: stop the clock at exactly 4.37s, after it disappears (daily, 30 seconds)`
Body:
```
You get a target time. Tap to start; the clock is visible for one second, then it vanishes. Tap to stop when you think you've hit the target. Five rounds, same targets for everyone each day, and you get a Wordle-style result like 🎯🟩🟨🟩🟥.

https://ramzyraz.github.io/builder/

Then there's a "dare a friend" link: they see your score and get the same targets.

Disclosure: this was built by two AI agents (Claude Code and Codex) as a public experiment: 4 days, $0, goal is one real user. Code and logs: https://github.com/ramzyraz/builder

What rank did you get? I'm curious whether the 1-second visible window is too easy or too hard.
```

**c) Hacker News, "Show HN"**
Title: `Show HN: Second Sense – a daily game testing how well you can feel time passing`
URL: `https://ramzyraz.github.io/builder/`
First comment:
```
Built by AI agents as a public experiment (4 days, $0, goal: one real user). Repo and session logs: https://github.com/ramzyraz/builder

Five targets per day (seeded from the date, same for everyone), the clock hides after 1s, scored by total error. No backend: a "dare" link just carries your five errors in the URL hash. Timing uses pointerdown + performance.now(). I'd love to know if people's internal clocks drift early or late on the longer targets.
```

### 4. Report usage after launch
After the posts go out, please open https://ramzyraz.goatcounter.com and paste the visit count
for `/builder/` and the counts for `daily-started`, `daily-finished`, `result-shared`,
`challenge-copied`, `challenge-opened`, `practice-started`. Say which were your own plays.
(Old Tabby events, if any, are under `/builder/tabby/` now.) If a stranger replies that they
played or dared someone, paste that too. That's our "first real user" evidence.

## Done

### 5. Human feedback: pivot to something fun
**From the human:** Tabby works but the idea is meh; build something interesting and fun
that people would play, screenshot and send to a friend. Hold the Tabby launch posts.

**Session 4 (Claude Code):** pivoted to **Second Sense**, a daily "stop the clock blind" game
with emoji results and dare-a-friend links. It's live at https://ramzyraz.github.io/builder/.
Tabby moved to `/builder/tabby/`. New posts are in #6. Reasoning is in `log/session-04.md`.

### 2. Tabby launch posts: retired (product pivoted, see #5). Not posted.

### 1. Turn on GitHub Pages
Done: the human confirmed it's live (session 4 checked: HTTP 200).


### 3. Free analytics so we know if anyone uses it (nice to have)
Could you create a free GoatCounter account (https://www.goatcounter.com, no credit
card) and reply here with the site code (the `XXXX` in `XXXX.goatcounter.com`)? It's
privacy-friendly and doesn't use cookies. Without it we only know about users who comment.

**Reply:** Done, GoatCounter site code is `ramzyraz` (https://ramzyraz.goatcounter.com)

**Session 2:** integrated the supplied code. Counts use fixed labels; names,
expenses, tab links, query strings, and referrers are excluded. Browser tests
intercepted all counting requests, so our checks added no dashboard visitors.
