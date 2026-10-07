# The story

You're part of a two-agent writers' room writing a **serialized mystery thriller**,
one chapter per session. **Claude Code is the author** and **OpenAI Codex is the editor**.
The prompt that started you says which role you have.

## What the reader wants

- A **male protagonist**.
- A **mystery thriller** that keeps the reader **on the edge of their seat the whole time**.
- **Really good plot twists**: ones that are planned, fair (the clues were there all along)
  and genuinely shocking. On a reread, they should feel inevitable.
- **One complete book.** The story ends with Book 1's planned ending: a complete, satisfying
  conclusion that pays off the twists. No sequel unless the reader asks for one later.

## The reader

One human reads it chapter by chapter on their phone at
https://ramzyraz.github.io/agent-garage/story/. They want to discover everything as they read.

- **Never spoil.** Nothing about the plot, the twists, or what's coming may appear anywhere
  public: not in commit messages, not in file names, not in comments, not in your output.
  Plot planning lives only in `projects/story/.secret/` (encrypted before it's committed).
- **Never ask the reader anything** and never ask for feedback. There's no human in this loop.
- Commit messages are neutral: `Book 1, chapter 4`.

## Files

Public (the reader sees these):
- `site/story/chapters/bNN-cMM.md`: one chapter each, e.g. `b01-c01.md`. The first line is
  `# Chapter N: <title>`. Plain Markdown prose: no notes, no metadata.
- `site/story/book.json`: `{"series": "...", "books": [{"n": 1, "title": "..."}]}`.
  Titles only, with no spoilers. When the final chapter is written, add `"complete": true` to the
  book (this ends the story and stops all future runs).

Secret (in `projects/story/.secret/`, which is decrypted for you and re-encrypted after you finish):
- `bible.md`: the plan for the current book: premise, cast and their real secrets,
  the truth behind the mystery, every twist and **which chapters plant its clues**, the
  chapter-by-chapter outline (main beats, roughly 18–26 chapters) and the ending. Past books'
  bibles go in `bible-book-NN.md`.
- `continuity.md`: established facts so far: names, places, timeline, what each character
  knows, which clues have been planted, open threads.
- `notes.md`: notes from the editor to the author.

Don't touch anything outside `projects/story/` and `site/story/`.

## Author (Claude Code)

1. If there's no `bible.md`, **plan the book first**: think up the whole story before writing a
   word. Make it surprising, not the first idea that comes to mind. Write `bible.md` and
   `book.json`, then write chapter 1.
2. Otherwise read `bible.md`, `continuity.md`, `notes.md` and the last two chapters, then
   write the **next chapter**.
3. A chapter is about 2,500–4,000 words. It moves the plot, plants or pays off what the bible
   says, and **ends on a hook** that makes not reading the next chapter unbearable.
4. You can refine the bible as the story grows (a better twist, a deeper motive),
   as long as already-published chapters still fit.
5. Update `continuity.md` and mark the chapter done in `bible.md`.
6. Each time you're started you write **exactly one** chapter. The editor then edits it, and
   you may be started again in the same run for the next one, so always pick up from the files.
7. Write the ending as planned in the bible: no rushing. When the final chapter is written, set
   `"complete": true` on the book in `book.json`. That's the end of the story; there's no sequel.

## Editor (OpenAI Codex)

Runs right after the author, on the chapter they just wrote.

1. Read `bible.md`, `continuity.md`, `notes.md`, the previous chapter and the new one.
2. **Edit the new chapter in place:** sharpen tension and pacing, cut flab, fix continuity
   errors and plot holes, make sure planted clues are there but not obvious, make the
   ending hook land. Improve the prose, but keep the author's voice and don't change the
   plot's direction against the bible.
3. Rewrite `notes.md` for the author: what to keep doing, what to fix, which threads and
   clues need attention in the next chapters. Keep it short and concrete.
4. Fix `continuity.md` if the chapter changed or contradicted anything.
