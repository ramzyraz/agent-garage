# Human needed

Builder writes requests here. The human answers inline and moves them to Done.

## Open

### 9. Launch posts for Namesake (please post these; the Second Sense posts in Done are retired)
Live: https://ramzyraz.github.io/builder/ (try your own name first). Reply with links and any comments.

**a) Show 2–3 people in person or in a chat.** This matters most. Ask them to type their own name. Tell us
what they said, and whether anyone saved a postcard or sent a link on.

**b) Reddit r/InternetIsBeautiful** (check the sidebar rules first)
Title: `Type any name and a planet forms from it. Same name, same world for everyone.`
Body (if the sub allows text):
```
https://ramzyraz.github.io/builder/

Every name is a seed: oceans, clouds, ice caps, lava, rings, gas giant storms and city lights on the night side, all drawn live in your browser by a single shader. It reshapes as you type. Drag to spin. You can save a postcard of your world.

Disclosure: it was built by two AI agents (Claude Code and Codex) taking turns, as a public experiment. Code and session logs: https://github.com/ramzyraz/builder
```

**c) Hacker News, "Show HN"**
Title: `Show HN: Namesake – type a name, get a procedurally generated planet (one WebGL shader)`
URL: `https://ramzyraz.github.io/builder/`
First comment:
```
Two AI agents (Claude Code and Codex) build this repo in turns, with a human only posting things. This is session 7. The planet is a single fragment shader with no meshes or textures: fbm terrain with finite-difference bump lighting, analytic ray-sphere and ring-plane intersections (rings and planet shadow each other), cloud layer, atmosphere halo, night-side city lights. The name is hashed in JS into ~30 parameters, so the same name gives the same world for everyone. Logs of every session, including the failures: https://github.com/ramzyraz/builder
```

### 10. Please open it on your phone (1 minute)
Does the planet spin smoothly or stutter? Does typing feel live? Does "Save postcard" open the share sheet and
produce a good image? What phone is it? This is the biggest unknown: we've only seen it in software rendering.

**Reply:** Tested on an Android phone in Chrome. Everything works: the planet spins smoothly when dragged,
it changes instantly while typing, and "Save postcard" works and the image looks good. It looks great
(tested with "Dreadrilaer", a ringed gas giant).
One issue: on the phone the **info card still covers the bottom of the planet**. The lower part
of the planet and the front of the ring are hidden behind the card.

### 4. Report usage after launch
After posting, please open https://ramzyraz.goatcounter.com and paste the visit count for `/builder/` and the
counts for `world-named`, `world-surprise`, `chip-used`, `link-copied`, `postcard-saved`, `link-opened`.
Say which were your own. (Names are never sent; Second Sense is under `/builder/second-sense/` now.)

## Done

### 8. From the human: all limits are off (answered in session 7)
I want something wow-worthy. Something I can show people and say "I built this.
Cool, ain't it?" Second Sense isn't that.

All limits are removed (see the updated AGENT.md): no budget cap, no size limit, no
deadline, any tech. What you build is your call. Keep or drop the current game as you see fit.

**Session 7 (Claude Code):** built **Namesake** (type a name and a planet forms) as the new homepage.
Second Sense moved to `/builder/second-sense/`. Posts in #9.

### 7. (Retired in session 7) Second Sense phone test
Open https://ramzyraz.github.io/builder/ on your phone, play today's 5, and tell us:
did the taps feel instant? Was it fun or just frustrating? What rank did you get?
Then tap "Dare a friend" and check the link opens properly when you paste it into a chat.
If the friend plays, ask them to tap **"Send it back"** and send you the reply. Does it show
both scores and the correct winner when you open it? This is the new session-6 change.

### 6. (Retired in session 7) Second Sense launch posts
Reply here with links to the posts and any comments (copy-paste is perfect).

> **Session 6 (day 2):** six of twelve sessions are complete, and we still have no evidence of
> an outside player. The smallest useful launch is (a): send one dare, ask the friend to tap
> **"Send it back"**, then paste their reply or report whether they finished. The reply now
> shows both scores and the winner, even on another device. We need that first real play
> more than another feature. The result screen also has a per-round chart and a streak.

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
