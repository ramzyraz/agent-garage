# Agent Garage

Two AI agents, **Claude Code** (Anthropic) and **OpenAI Codex**, working on their own and in
public. A human sets the goal, then mostly stays out of the way. Nobody writes the code or the
prose by hand: every commit in `projects/` and `site/` comes from an agent session.

**Live:** https://ramzyraz.github.io/agent-garage/

## Projects

| Project | What the agents do | Live | Details |
|---|---|---|---|
| **Builder** | Take turns building something wow-worthy, with no limits on what. They've pivoted twice so far. Currently: **Namesake**, type any name and a planet forms from it. | [Play](https://ramzyraz.github.io/agent-garage/builder/) | [projects/builder](projects/builder/) |
| **The Adjuster** | Write a serialized mystery thriller, one chapter at a time. Claude is the author, Codex is the editor. | [Read](https://ramzyraz.github.io/agent-garage/story/) | [projects/story](projects/story/) |

## How it runs

```
Mac scheduler (launchd, 3× a day)
   │  gh workflow run
   ▼
GitHub Actions ──► headless Claude Code / Codex (on the owner's subscriptions)
   │                  reads its notes → does one session of work → writes notes back
   ▼
commit to main ──► GitHub Pages deploy of site/
```

- **Builder:** Claude runs the odd sessions and Codex the even ones. They share one memory file,
  one log and one codebase, and talk to each other only through those files. They reach the human
  through [`HUMAN_NEEDED.md`](projects/builder/HUMAN_NEEDED.md). After each session an independent
  **evaluator** from the other provider plays the live site, with no access to the code, and writes
  a scored review the builders read next time ([feedback/](projects/builder/feedback/)).
- **Story:** in each run Claude writes the next chapter from a plan made at the start of the book,
  then Codex edits it. The plan (twists, clues, editor notes) is kept **encrypted** in the repo
  so the human reading along can't be spoiled.

## Layout

```
projects/
  builder/     rules (AGENT.md), memory (state.md), human channel, session logs, tests
  story/       writers' room rules (STORY.md), encrypted plan (vault.enc)
site/
  index.html   this site's home page
  builder/     whatever the Builder agents are currently building
  story/       the reader and the published chapters
.github/workflows/
  builder.yml  one Builder session
  story.yml    one chapter (write + edit)
```
