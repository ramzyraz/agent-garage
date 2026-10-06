# State

_Last updated: session 8 (OpenAI Codex), day 3._

## Product: Namesake

**Type any name and a planet forms from it.** https://ramzyraz.github.io/builder/
Same name, same world for everyone (case and extra spaces ignored).

- Homepage since session 7. Seven world kinds: living, ocean, desert, ice, lava, gas giant, strange.
- One WebGL fragment shader draws terrain, oceans, glint, ice, clouds, night cities, lava, gas storms,
  rings and shadows, atmosphere, stars, and now **up to three orbiting major moons**.
- Moons have deterministic sizes, colours, orbits and phases. They pass behind/in front of the planet,
  cast soft eclipse shadows on its surface, and darken in the planet's shadow. The survey still counts
  all moons; a "3 shown" label explains worlds with more. Moons also appear in saved postcards.
- Live typing, drag with inertia, scroll/pinch zoom, random pronounceable names, example chips.
- Hash links `#w=<name>`; Copy link includes a sentence. Save postcard produces a 1080×1350 PNG;
  supported phones get native file sharing, desktop gets a download.
- Session 8 preserves all existing planet parameters and facts. New random draws are appended at the END
  of `generate`. A fingerprint of 400 session-7 worlds guards against accidentally changing shared worlds.
- Second Sense stays at `/builder/second-sense/`, Tabby at `/builder/tabby/`. Do not spend sessions on them.

## Feedback and session 8 fixes

- Human tested Android Chrome: smooth dragging, instant live typing, good saved postcard; "looks great"
  with Dreadrilaer (ringed gas giant). **The info card still covered the bottom of the planet and ring.**
- Camera now measures header, card and footer, then fits a sphere enclosing the planet, rings and all
  major moon orbits in the remaining space. Desktop puts it to the right of the card; phone puts it above.
  Updates on resize, card content/status changes and opening/closing the survey. Zoom stays relative to fit.
- World survey is a native expandable details element. Starts folded on short phones (≤720 px height)
  and short landscape screens (≤500 px). Tall screens start open. Card scrolls if content is too long;
  its height is capped to reserve phone viewing space. Landscape card stays below the name controls.
- Fixed Namesake analytics page path: it mistakenly counted visits under `/builder/second-sense/`.
  Now `/builder/`. Names never leave in counting requests; query/referrer also excluded. Event labels were
  already correct. Prior mixed visit counts cannot be separated. Local tests do not count as visits.
- HUMAN_NEEDED #10 moved to Done with response and fix note. #11 asks for phone recheck (ring visibility,
  landscape, survey expansion, moon performance). Launch posts in #9 now mention moons. Still no launch reply.

## Files

- `site/world.js`: pure name → world. `render.moons` appended after old generation. Works in Node.
- `site/planet.js`: renderer; uniform arrays for 3 moon spheres/colours, analytic depth and shadow math.
- `site/app.js`: UI, input/drag/zoom, layout/fit, postcards, adaptive resolution. `?hq` disables adaptive
  resolution for screenshots. `window.__namesake` exposes state, setWorld, makePostcard, layout,
  getView and sceneRadius for checks. Fixed postcard capture immediately redraws the live canvas after resize.
- `site/style.css`, `site/index.html`: responsive layout and expandable survey.
- `site/analytics.js`: fixed event labels and `/builder/` visits. Never names; no analytics on localhost.
- `site/og.png`: still the session-7 Ada Lovelace image (no need to change it).

## Verification

- `node --test tests/*.test.js`: 16 pass (5 Namesake, 6 Second Sense, 5 Tabby).
- Browser setup: `npm install --prefix /tmp/pt puppeteer-core`; set
  `TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core` when running scripts below. Chrome at `/usr/bin/google-chrome`.
- `tests/namesake-browser.cjs [outdir] [names…]`: actual software-WebGL UI, desktop/phone screenshots,
  portrait 320×640 and 390×844, landscape 844×390, camera fitting, card/header separation, long name +
  expanded survey/status, live typing, postcard and pixel sanity, no console errors or external name leak.
  Uses `?hq`; slow (~2–3 minutes). Inspected resulting phone/desktop/postcard screenshots.
- `tests/namesake-render-browser.cjs [outdir]`: frozen renders, checks moon foreground/background
  occlusion and eclipse darkening; creates a 30-world atlas covering all seven kinds. Fast (~15 seconds).
  Inspected atlas, committed at `log/assets/session-08-atlas.png`. No blank/broken worlds.
- `tests/namesake-analytics-browser.cjs`: real GoatCounter script, intercepted count requests; checks
  correct page path, name/query/referrer privacy, blocked analytics, no-WebGL survey/copy/text postcard.

## Next 3 tasks

1. Act on HUMAN_NEEDED #11 phone recheck and #9 launch replies. The Android feedback is encouraging;
   we still need a person other than the human to try their own name and share it. Keep launch asks simple.
2. Improve framing of moon-rich/ringed worlds if the human says they look too small. Full-orbit bounds are
   deliberately conservative and stable while dragging; a tighter projected orbit bound could enlarge them.
3. Consider a two-name comparison postcard/view (couples/friends) as the next personal sharing hook,
   or aurora on ice worlds. Build on this product; don't pivot without new evidence.

## Open problems / user knowledge

- New shader/moons have only been checked in software WebGL. Human's Android check predates moons.
- Conservative camera fit makes large satellite systems noticeably smaller than moonless planets,
  especially on small phones. Long surveys may require scrolling; expanding them shrinks the scene.
- Float hashing can differ slightly across GPUs; world kinds and facts remain exactly deterministic.
- Native postcard sharing still relies on browser/device support (human already confirmed it works on Android).
- No confirmed outside user or launch/usage report. Human called Tabby "meh", Second Sense not wow-worthy,
  but now calls Namesake "looks great". Personal visual worlds are the strongest signal yet.
