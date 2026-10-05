# Human needed

Builder writes requests here. The human answers inline and moves them to Done.

## Open

### 4. Report usage after launch
Once Pages is live and you've posted #2, please open
https://ramzyraz.goatcounter.com and paste the visitor count and the counts for
`expense-added`, `populated-link-copied`, `populated-summary-copied`,
`shared-tab-opened`, and `example-opened`. Tell us which actions were your own checks, if any.
These are now wired up, but counts alone can't prove a stranger used Tabby for
a real trip. If someone reports actual use in a launch-post reply, paste that
reply too. We need this to judge the experiment honestly.

### 1. Turn on GitHub Pages (blocking launch)
The product (Tabby, in `site/`) is built but not deployed. Please:
- Repo **Settings → Pages → Build and deployment → Source: "GitHub Actions"**.
- Repo **Settings → Secrets and variables → Actions → Variables → New variable**:
  `PAGES_ENABLED` = `true`.
- Then run the `builder-session` workflow once (or wait for the next scheduled one) and
  check that https://ramzyraz.github.io/builder/ loads. Reply here with "live" or what went wrong.

**Session 2 check (2026-10-05):** the public URL still returns HTTP 404.

**Session 3 check (2026-10-05):** still 404. This is the one thing blocking launch;
everything else is ready.

### 2. Launch posts (please post once #1 is live)
Post these as yourself. They're honest about being an AI-built experiment, because
some communities ban undisclosed self-promo. Reply here with links to the posts and
any comments people leave (copy-paste is perfect).

**a) Reddit r/SideProject** (allows self-promo)
Title: `I wanted to split trip costs without making my friends sign up for anything, so (an AI) built a one-link splitter`
Body:
```
Every group trip ends with someone saying "ok who owes what" and half the group refusing to install an app for a 3-day weekend.

Tabby is a tiny web page: add who's in, add what got paid, and it suggests payments to settle up ("Ben pays Ana $55"). No account, no app, no server. The whole tab is stored in the link itself, so you just paste the link in the group chat. There's a "Try an example" button if you just want to see it work.

https://ramzyraz.github.io/builder/

Full disclosure: this is part of an experiment where two AI agents (Claude Code and Codex) try to build a product and get a first real user in 4 days with $0. The code and their logs are public: https://github.com/ramzyraz/builder

Would love blunt feedback: would you actually use this on your next trip? What's missing?
```

**b) Hacker News, "Show HN"**
Title: `Show HN: Split group trip expenses with one link – no signup, data lives in the URL`
URL: `https://ramzyraz.github.io/builder/`
First comment:
```
This was built by AI agents as a public experiment (4 days, $0, goal: one real user). Repo and session logs: https://github.com/ramzyraz/builder

The whole ledger is base64 JSON in the URL hash, so there's no backend. The obvious tradeoff is that two people editing produce two different links; for now the advice is "one person keeps the tab". Curious if people would use it anyway, or what would make them.
```

**c) Optional: send it to one real group** you're in that has a trip or a shared dinner coming
up. Even one friend-of-a-friend using it for real would teach us more than upvotes.

## Done

### 3. Free analytics so we know if anyone uses it (nice to have)
Could you create a free GoatCounter account (https://www.goatcounter.com, no credit
card) and reply here with the site code (the `XXXX` in `XXXX.goatcounter.com`)? It's
privacy-friendly and doesn't use cookies. Without it we only know about users who comment.

**Reply:** Done, GoatCounter site code is `ramzyraz` (https://ramzyraz.goatcounter.com)

**Session 2:** integrated the supplied code. Counts use fixed labels; names,
expenses, tab links, query strings, and referrers are excluded. Browser tests
intercepted all counting requests, so our checks added no dashboard visitors.
