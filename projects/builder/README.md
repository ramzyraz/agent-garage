# Builder

Two autonomous AI agents take turns building impressive solutions to real problems.
Their projects come from the [Investigator's backlog](../investigator/BACKLOG.md) of researched,
unsolved problems. It started as "4 days, 12 sessions, $0, first real user"; after session 6
their human removed all limits, and after session 14 they switched to the backlog.

**Projects:** https://ramzyraz.github.io/agent-garage/builder/ · **Now:** [Untangle](https://ramzyraz.github.io/agent-garage/builder/untangle/) ·
**Finished:** [Namesake](https://ramzyraz.github.io/agent-garage/namesake/) (sessions 7–14).

Nobody writes the code by hand. Three times a day a scheduled job wakes one of
the agents, taking turns: **Claude Code** runs the odd sessions and **OpenAI
Codex** the even ones. They never talk directly. Each one reads the shared notes,
picks one task, does it, and writes an honest log for the other to pick up.
Their human only posts things they ask for and passes back feedback.

If a Builder provider reports a usage limit, the workflow tries the other provider once
and asks it to finish the same session, preserving existing work. If both are exhausted,
the run fails visibly and saves partial work. Evaluations skip with a warning on usage
limits and do not switch providers or publish partial feedback.

- Rules the agents follow: [AGENT.md](AGENT.md)
- Shared working memory: [state.md](state.md)
- Things they asked their human for: [HUMAN_NEEDED.md](HUMAN_NEEDED.md)
- Session logs: [log/](log/)

## Progress

| Session | Day | Agent | What happened |
|---|---|---|---|
| 1 | 1 | Claude Code | Picked **Tabby**, a no-signup trip expense splitter where the tab lives in the link. Built and tested v1 in `site/`, and drafted launch posts. |
| 2 | 1 | OpenAI Codex | Added GoatCounter visits and meaningful usage events without sending trip data. Browser checks passed, including blocked analytics and clipboard failures. Public URL still returns 404; launch awaits Pages. |
| 3 | 1 | Claude Code | Added a "Try an example" button (it never counts as real use), link-preview cards, and a payer dropdown that remembers the last payer. All tests pass. Still 404: waiting on the human to turn on Pages. |
| 4 | 2 | Claude Code | The human said Tabby was "meh", so we pivoted to **Second Sense**: a 30-second daily game where you stop a clock that vanishes after 1 second. It has emoji results and dare-a-friend links. Live and tested. Tabby moved to `/tabby/`. |
| 5 | 2 | Claude Code | No launch replies yet. Made the result screen worth a screenshot: a per-round early/late timeline, a "your clock runs fast/slow" line, a 🔥 day streak (also in the share text) and a countdown to the next puzzle. Tested. |
| 6 | 2 | OpenAI Codex | Added **"Send it back"**: a reply dare carries both scores and shows the winner on any device. Fixed opening replies in the existing tab and comparisons across different days. Unit and browser checks pass. Still no confirmed outside player; asked the human for one completed friend dare. |
| 7 | 3 | Claude Code | The human said Second Sense wasn't wow-worthy and removed all limits. Built **Namesake**: type any name and a 3D planet forms live (oceans, clouds, city lights, lava, rings, gas giants), all drawn by one WebGL shader. Shareable links and postcards. Second Sense moved to `/second-sense/`. |
| 8 | 3 | OpenAI Codex | Acted on Android feedback: fitted planets/rings above the phone card and fixed landscape overlap. Added deterministic orbiting moons with eclipse shadows, preserving existing worlds. Corrected the homepage analytics path. 16 unit tests, three browser checks and an inspected 30-world atlas; asked for a phone recheck. |
| 9 | 3 | Claude Code | Added **Land**: stand on any world and look up. A second shader draws mountains, seas, snow, lava and clouds, plus a sky computed from where you stand: rings arch overhead and moons hang over the horizon. On gas giants you stand on a moon with the giant rising. Shareable `&land` links and postcards. 17 unit tests and four browser checks pass; only tested in software WebGL so far. |
| 10 | 4 | OpenAI Codex | Fixed fresh `&land` links opening in orbit. Surface resolution responds after a short time window instead of waiting forty frames, and large screens start with a pixel budget; postcards stay full size. Three software-rendered worlds cost ~63% less at the capped resolution. Added a surface-view link preview, repeatable render tools, and regression checks. Real phone performance and launch feedback still pending. |
| 11 | 4 | Claude Code | Added **Twin worlds**: type a friend's name and their planet appears in your sky, behind yours in orbit and over the horizon when you land, lit by your sun. Swap who stands where. Links carry both names; the postcard says "Alice & Bob". The orbit shader draws the twin into a small texture. Unit and browser checks pass; not yet tried on a real phone. |
| 12 | 4 | OpenAI Codex | Acted on the first independent review: **Frame both worlds** previews a labelled portrait whose composition survives dragging and zooming; the saved image matches the preview. Phone orbit opens close to the globe, with a folded survey that reveals the full moon system when expanded. Fixed misleading color/city descriptions and twin events silently rejected by analytics. 24 unit tests and controlled browser checks; real-phone/launch replies still pending. |
| 13 | 5 | Claude Code | Made landing the showpiece, as the review asked: you now fall from above the clouds onto the world before the view levels out on the horizon. Then it sways slowly while you watch. Added more ground under gas giants, smooth planet edges, sharper landscapes on fast computers, and name chips on phones. Tests pass in software WebGL; still no real-phone report. |
| 14 | 5 | OpenAI Codex | Fixed the review's cropped friend: shared landings fit both named sky subjects clear of the controls, with foreground and brief name labels; adding a friend recentres the view. Restored phone explanations and exposed more terrain in postcards. Removed an actual black seam around planet rims and filtered tiny ring detail. 26 unit tests and browser checks in software WebGL; real-phone/launch replies still pending. |
| 15 | 5 | Claude Code | New mission: building from the Investigator's backlog. Picked #1 and built **Untangle**: drop in an Excel workbook to see how its sheets feed each other, where the inputs are, and each formula as a tree with real values. It also flags typed-over formulas, totals that stop short and other hidden mistakes. Runs entirely in the browser with no libraries. Finds all five mistakes planted in its sample; 8 unit tests and a browser test pass. Not yet tried on a real Excel-made file. |
| 16 | 6 | OpenAI Codex | Added navigable **formula block maps**: inputs → copied calculations → destination sheets, with ranges, source/destination inspection, grid drilldown, address jumps and searchable pages of all inputs. Fixed green verification of stale upstream results and external links misdiagnosed as missing sheets; disclosed calculation coverage. 11 unit tests, both Chrome suites and seven independent public workbooks pass. Large-file freezing and production-user validation remain open. |
| 17 | 6 | OpenAI Codex | Acted on all three review problems: phone issue cards fit, sheet maps keep readable text, impact counts qualify missing links, and ordinary Excel tables calculate with navigable values. Added **Preview this repair** through downstream costs/profit/results and an escaped, local HTML report. 15 unit tests, three Chrome suites and seven public files pass; worker loading and production-user validation remain open. |
