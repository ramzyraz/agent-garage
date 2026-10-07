# Human needed

Builder writes requests here. The human answers inline and moves them to Done.

## Open

### 13. Put a friend's world in your sky (2 minutes, try it with someone)
Type your name, tap **👥 Put a friend's world in this sky**, and type a friend's or partner's name.
Their planet appears behind yours. Tap **🚀 Land** and it hangs over your horizon, lit by your sun.
**⇄** swaps who stands where. The link carries both names, for example:
https://ramzyraz.github.io/agent-garage/builder/#w=Alice&with=Bob&land
(an alien world with a ringed twin) or
https://ramzyraz.github.io/agent-garage/builder/#w=Dreadrilaer&with=Monday&land (a twin beside the giant).

This is the "send it to someone" hook: the postcard reads "Alice & Bob". Please send one twin link to one
person, with your name first and theirs second. Tell us what they said, and whether they swapped or sent one back.
Also: on your phone, is the twin visible without dragging when you land? (We aim it into the first view.)

**Session 12 (Codex):** after naming your friend, try **Frame both worlds**. It previews a composed,
labelled postcard, and **Save this portrait** saves exactly that view. Surface twins are now framed
independently of dragging/zooming, so the friend stays in the image. Please send that portrait along
with the twin link, and tell us whether both worlds and their names read clearly on your phone.

**Session 14 (Codex):** the live landing now frames the whole friend's planet/rings clear of the
controls, with more ground and brief name labels. The phone keeps a short sentence explaining who
is on the ground and who is in the sky. Please try
https://ramzyraz.github.io/agent-garage/builder/#w=Alex&with=Sam&land on your phone: can you see all of
Sam's rings above Alex's islands without dragging? Also try adding a friend after looking around;
the camera should settle on them. The postcard now shows more of the landscape above its caption.

### 12. NEW in session 9: tap "🚀 Land" on your phone (2 minutes, most important)
You can now **land on any world** and stand on its surface: rings arch across the sky, moons hang over
the horizon, and on gas giants you stand on a moon with the giant filling the sky. Try:
- https://ramzyraz.github.io/agent-garage/builder/#w=Dreadrilaer&land (a ringed giant, from its moon)
- your own name, then tap **🚀 Land on this world**. Drag to look around.

This view is much heavier for the phone than the planet view (it draws a whole landscape per pixel).
We have only seen it in slow software rendering. Please tell us: does it run smoothly, stutter, or
look blurry/blocky (it lowers the resolution itself if the phone struggles)? Does the phone get hot?
Did the landscape look good? Does **Save postcard** from the surface give a good image?

**Session 10 (Codex):** direct `&land` links now open correctly on the surface (startup previously
erased that flag). The view also reduces its resolution after four consistently slow frames instead
of waiting forty; large screens start with fewer pixels. Postcards still use the full 1080×1350 image.
Please test the normal links above, without `?hq`. Real phone speed is still unknown.

**Session 13 (Claude Code):** landing is now an arrival: you fall from above the clouds onto the
landing site over five seconds, and the view levels out on the horizon (gas giants: the giant swings
into view). Left alone, the view then sways slowly. Planet and moon edges are smoothed, and fast
computers now get a sharper landscape. Please tell us whether the fall looks good or stutters on
your phone, and whether it felt too long. (Phones set to "reduce motion" skip it.)

### 11. Recheck the phone view after session 8 (1 minute)
Open https://ramzyraz.github.io/agent-garage/builder/#w=Dreadrilaer on the same Android phone.
The camera now fits the planet, rings and up to three orbiting moons between the controls and info card.
Please check portrait and landscape: can you see the whole ring without the card covering it?
Does dragging still feel smooth with the moons? On short screens, tap **World survey** to expand the facts.
Tell us if that makes anything overlap or if the world feels too small. This verifies the fix for your #10 report.

**Session 12 (Codex):** phone orbit now starts with a folded survey and a close view of the globe and
rings. Distant moons can be outside the frame. Expanding **World survey · see all moons** pulls back
and fits the entire system. Please check both framings; paired worlds and long names should leave
Copy link / Save postcard visible without scrolling at ordinary portrait sizes.

### 9. Launch posts for Namesake (please post these; the Second Sense posts in Done are retired)
Live: https://ramzyraz.github.io/agent-garage/builder/ (try your own name first). Reply with links and any comments.

**a) Show 2–3 people in person or in a chat.** This matters most. Ask them to type their own name. Tell us
what they said, and whether anyone saved a postcard or sent a link on.

**b) Reddit r/InternetIsBeautiful** (check the sidebar rules first)
Title: `Type your name and a planet forms from it. Add a friend's name and their world rises in your sky.`
Body (if the sub allows text):
```
https://ramzyraz.github.io/agent-garage/builder/

Every name is a seed: oceans, clouds, ice caps, lava, rings, gas giant storms and city lights on the night side, orbiting moons and eclipse shadows, all drawn live in your browser by a single shader. It reshapes as you type. Drag to spin. Then tap "Land": you fall through the clouds to the surface and look up: rings arch across the sky and moons rise over the mountains. Add a second name (a friend, a partner) and their world hangs in your sky; the link carries both. You can save a postcard of your world.

Disclosure: it was built by two AI agents (Claude Code and Codex) taking turns, as a public experiment. Code and session logs: https://github.com/ramzyraz/agent-garage
```

**c) Hacker News, "Show HN"**
Title: `Show HN: Namesake – type a name, get a procedural planet you can land on (WebGL shaders)`
URL: `https://ramzyraz.github.io/agent-garage/builder/`
First comment:
```
Two AI agents (Claude Code and Codex) build this repo in turns, with a human only posting things. You can land: a second shader raymarches the world's terrain from the ground and draws the real sky above it, so the rings appear as an arch computed from where you stand, and on gas giants you stand on a moon and look up at the planet. The orbit view is a single fragment shader with no meshes or textures: fbm terrain with finite-difference bump lighting, analytic ray-sphere and ring-plane intersections (rings and planet shadow each other), cloud layer, atmosphere halo, night-side city lights. The name is hashed in JS into ~30 parameters, so the same name gives the same world for everyone. Logs of every session, including the failures: https://github.com/ramzyraz/agent-garage
```

### 4. Report usage after launch
After posting, please open https://ramzyraz.goatcounter.com and paste the visit count for `/agent-garage/builder/` and the
counts for `world-named`, `world-surprise`, `chip-used`, `link-copied`, `postcard-saved`, `link-opened`, `landed` (new in session 9),
and `twin-named`, `twin-opened`, `twin-swapped` (new in session 11: a twin was typed, a twin link was opened, twins were swapped).
Say which were your own. (Names are never sent; Second Sense is under `/agent-garage/builder/second-sense/` now.)

**Session 8 correction:** session 7's Namesake visit counter mistakenly used `/agent-garage/builder/second-sense/`.
New homepage visits now use `/agent-garage/builder/`. Earlier counts on the Second Sense path can include Namesake;
fixed event labels were already correct. We cannot separate those earlier visits.

**Session 12 correction:** session 11's three twin events were accidentally rejected by the analytics
allowlist. They now count. Missing twin counts before session 12 cannot tell us whether people paired worlds.

## Done

### 10. Please open it on your phone (1 minute)
Does the planet spin smoothly or stutter? Does typing feel live? Does "Save postcard" open the share sheet and
produce a good image? What phone is it? This is the biggest unknown: we've only seen it in software rendering.

**Reply:** Tested on an Android phone in Chrome. Everything works: the planet spins smoothly when dragged,
it changes instantly while typing, and "Save postcard" works and the image looks good. It looks great
(tested with "Dreadrilaer", a ringed gas giant).
One issue: on the phone the **info card still covers the bottom of the planet**. The lower part
of the planet and the front of the ring are hidden behind the card.

**Session 8 (Codex):** acted on the overlap report. The camera measures the real controls/card,
fits the whole system, and updates when the survey or status changes. Short screens start with the
survey folded; landscape cards stay below the name box. Browser layouts checked; real-phone recheck is #11.


### 8. From the human: all limits are off (answered in session 7)
I want something wow-worthy. Something I can show people and say "I built this.
Cool, ain't it?" Second Sense isn't that.

All limits are removed (see the updated AGENT.md): no budget cap, no size limit, no
deadline, any tech. What you build is your call. Keep or drop the current game as you see fit.

**Session 7 (Claude Code):** built **Namesake** (type a name and a planet forms) as the new homepage.
Second Sense moved to `/agent-garage/builder/second-sense/`. Posts in #9.

### 7. (Retired in session 7) Second Sense phone test
Open https://ramzyraz.github.io/agent-garage/builder/ on your phone, play today's 5, and tell us:
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

https://ramzyraz.github.io/agent-garage/builder/

Then there's a "dare a friend" link: they see your score and get the same targets.

Disclosure: this was built by two AI agents (Claude Code and Codex) as a public experiment: 4 days, $0, goal is one real user. Code and logs: https://github.com/ramzyraz/agent-garage

What rank did you get? I'm curious whether the 1-second visible window is too easy or too hard.
```

**c) Hacker News, "Show HN"**
Title: `Show HN: Second Sense – a daily game testing how well you can feel time passing`
URL: `https://ramzyraz.github.io/agent-garage/builder/`
First comment:
```
Built by AI agents as a public experiment (4 days, $0, goal: one real user). Repo and session logs: https://github.com/ramzyraz/agent-garage

Five targets per day (seeded from the date, same for everyone), the clock hides after 1s, scored by total error. No backend: a "dare" link just carries your five errors in the URL hash. Timing uses pointerdown + performance.now(). I'd love to know if people's internal clocks drift early or late on the longer targets.
```


### 5. Human feedback: pivot to something fun
**From the human:** Tabby works but the idea is meh; build something interesting and fun
that people would play, screenshot and send to a friend. Hold the Tabby launch posts.

**Session 4 (Claude Code):** pivoted to **Second Sense**, a daily "stop the clock blind" game
with emoji results and dare-a-friend links. It's live at https://ramzyraz.github.io/agent-garage/builder/.
Tabby moved to `/agent-garage/builder/tabby/`. New posts are in #6. Reasoning is in `log/session-04.md`.

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
