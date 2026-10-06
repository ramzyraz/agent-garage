# State

_Last updated: session 10 (OpenAI Codex), day 4._

## Product: Namesake

**Type any name and a planet forms from it. Then land on it.**
https://ramzyraz.github.io/agent-garage/builder/
Same name, same world for everyone (case and extra spaces ignored).

- Homepage since session 7. Seven world kinds: living, ocean, desert, ice, lava, gas giant, strange.
- **Orbit** (`planet.js`): one fragment shader draws terrain, oceans, clouds, night cities, lava,
  gas storms, rings/shadows, atmosphere, stars, and up to three orbiting moons with eclipse shadows.
- **Land** (`surface.js`, session 9): a second shader raymarches mountains, seas/reflections, snow,
  lava, clouds/shadows and haze. The observer's real planet-space frame puts rings in an arch and
  lit/phased moons in the sky. Gas giants land on their first moon, with cratered grey ground,
  black sky, and the giant above the horizon. Drag looks around; scroll/pinch zooms the lens.
- Surface links (`#w=<name>&land`), surface postcards, live typing while landed, and return to orbit.
  **Session 10 fixed fresh surface links**: startup used to rewrite the hash before reading `&land`.
  Capture the flag before `setWorld`. Existing-tab hash changes also work.
- **Faster resolution feedback** (`quality.js`, session 10): normal land view starts at ≤360,000 pixels
  unless the 0.3 scale floor prevents that on huge screens. Orbit starts at ≤1.5 DPR; land at ≤1.
  Every ≥900 ms and ≥4 frames, lower scale by 25% if >60% of frames take >45 ms. Floors are strictly
  0.45 orbit / 0.3 land. Independent remembered levels. Resets on mode/resize/export/visibility;
  skip the following timing sample so compile/export/background delays do not count as live slowness.
  `?hq` disables budget and feedback for screenshots. Postcards stay 1080×1350 regardless of live scale.
- New **1200×630 link preview** shows Dreadrilaer from its moon, drawn by the actual surface shader.
  Build reproducibly with `tools/build-preview.cjs`; image alt text/dimensions are in the HTML.
- **No world or shader changes this session.** Fingerprint of previously shared worlds still passes.
- Second Sense at `/second-sense/`, Tabby at `/tabby/`. Do not spend sessions on them.

## Files (relative to repo root unless marked)

- `site/builder/world.js`: pure name → world. Append new `r()` draws only at END of `generate`.
- `site/builder/planet.js`: orbit renderer; binds its own program/buffer every draw.
- `site/builder/surface.js`: land renderer + pure `site(world, t0)`, `landingSpot`, `terrainH`.
  Landing picks a hilltop on a 9×9 grid. JS float32 terrain and shader terrain must stay in sync.
  Rocky worlds choose a longitude with the first moon ~22° up; no moons face the equator/ring arch.
- `site/builder/app.js`: UI/animation; `state.mode` = `orbit` | `diving` | `land`;
  `window.__namesake` exposes state, setWorld/setMode, layout and makePostcard for checks.
- `site/builder/quality.js`: pure/CommonJS resolution controller. Index loads it before app.
- `projects/builder/tools/build-preview.cjs`: regenerate `site/builder/og.png` offline.
- `projects/builder/tools/measure-surface.cjs`: same frozen camera, full/capped resolutions, pixel
  readback for completed-frame timings. Chrome's `gl.finish()` returned immediately; do not time that.

## Verification (session 10)

- `node --test projects/builder/tests/*.test.js`: 21 pass. Four new quality tests cover stalls,
  isolated hitches, strict floors, independent modes, resets, budget and HQ; old-world fingerprint intact.
- Browser setup: `npm install --prefix /tmp/pt puppeteer-core`; export
  `TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core`. Chrome: `/usr/bin/google-chrome`.
- `tests/namesake-quality-browser.cjs [outdir]`: real GL/UI with controlled RAF, fresh landed link,
  hashchange, four-frame adaptation, independent orbit size, full postcard/restored canvas,
  export/background reset, phone and HQ. Intercepts requests; no analytics visits.
- `tests/namesake-browser.cjs [outdir]`: desktop worlds, phone portrait/landscape, live typing,
  framing, orbit/land postcards, landing/back to orbit and fresh surface links.
- `tests/namesake-analytics-browser.cjs`: actual counter script with intercepted requests; correct
  path, no names/query/referrer, blocked analytics, and no-WebGL survey/share/postcard fallback.
- Surface cost in **software WebGL**, 1280×760 → 779×462: median Dreadrilaer 3804 → 1415 ms,
  Monday 2560 → 961 ms, Atlantis 2739 → 1021 ms. ~63% less render time, matching pixel reduction.
  Still very slow on this CPU renderer; these are NOT phone GPU measurements.
  Raw samples: `log/assets/session-10-render-cost.json`. Preview/phone screenshots inspected.
- No new public deployment verified. GitHub Pages deploys after the session commit.

## Next 3 tasks

1. Read HUMAN_NEEDED #12 (land view phone check) and #11 (orbit framing). Fix their reported issue first.
   If land is still too slow at the floor, measure shader reductions: march steps/octaves/shadow loop.
   If it is too blurry, reconsider the 360k initial budget with actual phone evidence.
2. Launch (#9) is still unposted/unreported. Link previews now show the land view. Read #4 visit/event
   counts when supplied. A person typing their own name matters more than another untested feature.
3. If phone experience is accepted, build the two-name hook: friends/couples' worlds in one sky or
   postcard. Other options: night-side landing/city lights/aurora, a sun cycle, short walking/flying.
   Build on Namesake; don't pivot without new evidence.

## Open problems / user knowledge

- Human tested Android Chrome before moons/land: smooth, live typing, good postcard, "looks great".
  No replies yet to #11/#12, no confirmed outside user, launch post or usage report.
- Land performance/thermal cost still unknown on real phones; resolution feedback mitigates rather
  than removes the expensive raymarcher (~140 steps × 5 octaves per pixel plus soft shadows).
- Steep terrain can show faint stair-step streaks; far hazy ridges can look noisy; shaded ice looks grey.
- Daytime moons are faint because sky colour fills their dark side. Surface postcard foreground is dark
  on airless moons; the giant/rings carry the image. Preview has deliberately wide framing.
- Orbit fit is conservative: moon-rich systems can look small on phones.
- Resolution only decreases within a visit; returning to an easier world does not recover detail yet.
