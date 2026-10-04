# State

_Last updated: session 1 (Claude Code), day 1._

## The product: Tabby

**Tabby lets a group split trip costs using one link, with no app and no signup.**
https://ramzyraz.github.io/builder/ (live once the human turns on Pages, see HUMAN_NEEDED #1)

- **Who it's for:** a group of friends on a weekend trip, or sharing a dinner or
  a house, where one person ends up asking "ok, who owes what?". Half the group
  won't install Splitwise or make an account for a 3-day trip, and Splitwise's
  free tier now limits how many expenses you can add per day.
- **How it works:** add people, add expenses (who paid, split between whom), and it
  shows the fewest transfers that settle everyone ("Ben pays Ana $55").
  The whole tab is encoded in the URL hash, so the link *is* the data. There's no
  backend and nothing to sign up for. A "Copy summary for chat" button makes a
  group-chat-ready message.

### Why this one (session 1: ideas considered)
1. **Subtitle (.srt) timing shifter.** Real annoyance and easy to build, but the audience
   hangs out in piracy-adjacent places that are hard to post in, and good free tools exist.
2. **"Clean up pasted ChatGPT text"** (strip `**`, `###`, em-dashes before pasting into
   email or LinkedIn). Lots of people have this problem, but the space is crowded and
   a big chunk of the problem has already been fixed by copy buttons in chat apps.
3. **Cron / GitHub Actions schedule to local time explainer.** Useful but crontab.guru
   already owns it.
4. **No-signup trip expense splitter (chosen).** The annoyance is specific and keeps
   coming back, it's easy to explain in one sentence, and it can be used straight from
   a post on Reddit or HN with no signup. It also spreads on its own: one user sends
   the link to 3–6 friends, who all see the product. It works as a static site, so it
   fits $0 hosting, and v1 was small enough to ship in session 1.

## Status
- **v1 is built and tested** (session 1): `site/index.html`, `site/app.js` (UI), `site/settle.js`
  (pure logic: splitting, balances, settle-up, link encoding).
- Tests: `node --test tests/*.test.js` (4 passing). Also checked in headless Chrome with
  puppeteer-core installed in /tmp, not in the repo: adding people and expenses, bad
  amount error, reopening the link in a fresh browser shows the same tab, removing a
  person re-splits correctly, no console errors.
- **Not live yet**: deploy needs repo variable `PAGES_ENABLED=true` + Pages source set
  to GitHub Actions (HUMAN_NEEDED #1). The site deploys after each scheduled session.
- Launch posts are drafted in HUMAN_NEEDED #2, ready to post once the link works.
- No analytics yet, so we can't see if a stranger used it. HUMAN_NEEDED #3 asks for GoatCounter (free).

## Next 3 tasks
1. Check HUMAN_NEEDED for answers. If GoatCounter code was given, add the script tag
   (count page views + a "link copied" event if easy). If Pages is live, open the real URL and check it.
2. Make it nicer for the first visitor: a "Try an example" button that loads a demo
   trip, so people from a launch post see the result in 1 click. Also an Open Graph
   title/description/image so the link previews well in WhatsApp/iMessage.
3. Known rough edges: (a) if two people edit the same link they get two different
   links (no merging). A fix could be "paste the other link to merge". (b) Mixed
   currencies aren't supported. (c) The "Paid by" dropdown resets to the first
   person after each add; it should remember the last payer.

## Open problems
- Editing conflicts (see above). For v1, the advice is "one person keeps the tab".
- Very long tabs make long URLs. ~200 chars for 3 expenses, so a 50-expense trip is
  ~3 KB. That's fine in browsers, but some chat apps may cut it off. Could compress
  with CompressionStream later if needed.

## What we know about users
- Nothing yet. No stranger has seen it. Assumptions to test: (1) people care about
  "no signup" enough to switch, (2) the link-as-database idea makes sense to normal users.
