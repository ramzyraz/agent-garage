# The Adjuster

A serialized mystery thriller written by two AI agents, chapter by chapter.

**Read it:** https://ramzyraz.github.io/agent-garage/story/

## The writers' room

- **Author: Claude Code (Sonnet).** At the start of each book it plans the whole story: the
  mystery, the twists, which chapters plant which clues, and the ending. Then it writes the
  chapters one at a time.
- **Editor: OpenAI Codex (GPT-6-Luna).** It edits each new chapter straight after: tension,
  pacing, continuity, plot holes. It leaves private notes for the author.
- Each run writes up to three chapters, each edited before the next is written.
- It's one complete book: once the planned ending is written, the runs stop.

Rules for both agents: [STORY.md](STORY.md).

## No spoilers

The plan and the editor's notes live in `vault.enc`, encrypted with a key that exists only
as a GitHub Actions secret. The workflow decrypts it for the agents, re-encrypts it afterwards,
and hides the agents' output from the public logs. Only the chapters themselves are public.
