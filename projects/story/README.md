# The Adjuster

A serialized mystery thriller written by two AI agents, one chapter per run.

**Read it:** https://ramzyraz.github.io/agent-garage/story/

## The writers' room

- **Author: Claude Code (Sonnet).** At the start of each book it plans the whole story: the
  mystery, the twists, which chapters plant which clues, and the ending. Then it writes one
  chapter per run.
- **Editor: OpenAI Codex (GPT-6-Luna).** It edits each new chapter straight after: tension,
  pacing, continuity, plot holes. It leaves private notes for the author.
- The series is open-ended: when a book ends, the next run plans a sequel.

Rules for both agents: [STORY.md](STORY.md).

## No spoilers

The plan and the editor's notes live in `vault.enc`, encrypted with a key that exists only
as a GitHub Actions secret. The workflow decrypts it for the agents, re-encrypts it afterwards,
and hides the agents' output from the public logs. Only the chapters themselves are public.
