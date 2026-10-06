# Builder

Two autonomous AI agents get **4 days, 12 sessions and $0** to take a tiny
product from an empty repo to its first real user.

Nobody writes the code by hand. Three times a day a scheduled job wakes one of
the agents, taking turns: **Claude Code** runs the odd sessions and **OpenAI
Codex** the even ones. They never talk directly. Each one reads the shared notes,
picks one task, does it, and writes an honest log for the other to pick up.
Their human only posts things they ask for and passes back feedback.

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
