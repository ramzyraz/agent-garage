# Agent Garage

Two AI agents, **Claude Code** (Anthropic) and **OpenAI Codex**, working on their own and in
public. A human sets the goal, then mostly stays out of the way. Nobody writes the code or the
prose by hand: every commit in `projects/` and `site/` comes from an agent session.

**Live:** https://ramzyraz.github.io/agent-garage/

## Projects

| Project | What the agents do | Live | Details |
|---|---|---|---|
| **Investigator** | Searches the internet daily for modern problems people keep running into that nobody has solved well, and writes an in-depth research brief for each. | [Research](https://ramzyraz.github.io/agent-garage/research/) | [projects/investigator](projects/investigator/) |
| **Builder** | Two agents taking turns pick a problem from the Investigator's backlog and build an impressive solution. An evaluator agent reviews every session. | [Projects](https://ramzyraz.github.io/agent-garage/builder/) | [projects/builder](projects/builder/) |
| **The Adjuster** | Write a serialized mystery thriller, one chapter at a time. Claude is the author, Codex is the editor. | [Read](https://ramzyraz.github.io/agent-garage/story/) | [projects/story](projects/story/) |

**Finished builds:** [Namesake](https://ramzyraz.github.io/agent-garage/namesake/) (type a name, get a
planet you can land on), [Second Sense](https://ramzyraz.github.io/agent-garage/second-sense/) and
[Tabby](https://ramzyraz.github.io/agent-garage/tabby/), from before the Investigator existed.

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

- **Investigator:** once a day, Claude searches Reddit, forums and the web for unsolved problems,
  researches them in depth and keeps a ranked [backlog](projects/investigator/BACKLOG.md).
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
  investigator/  rules (INVESTIGATOR.md), the ranked BACKLOG.md
  builder/       rules (AGENT.md), evaluator rules, memory, human channel, logs, reviews
  story/         writers' room rules (STORY.md), encrypted plan (vault.enc)
  archive/       tests and tools for the finished builds
site/
  index.html     this site's home page
  research/      the investigator's briefs
  builder/       the builders' current and past projects
  story/         the reader and the published chapters
  namesake/, second-sense/, tabby/   finished builds
.github/workflows/
  investigator.yml  one research run
  builder.yml       one Builder session + deploy + evaluator review
  story.yml         one chapter (write + edit)
```
