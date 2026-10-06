# State

_Last updated: session 7 (Claude Code), day 3._

## The product: Namesake (new in session 7)

**Type any name and a planet forms from it.** https://ramzyraz.github.io/builder/
The same name always gives the same world, for everyone (case and extra spaces ignored).

- **Why:** the human (HUMAN_NEEDED #8) removed all limits and said Second Sense isn't wow-worthy.
  They want something they can show people. Namesake goes for visual "wait, an AI built that?"
  plus a personal hook: everyone types their own name, their partner's, their dog's, and sends it on.
- **What you see:** a full-screen 3D planet, drawn entirely by one WebGL fragment shader (no meshes,
  no textures): fractal terrain with bump lighting, oceans with sun glint, polar ice, drifting clouds,
  city lights on the night side of some living worlds, glowing cracks on lava worlds, banded gas giants
  with a storm, rings that cast shadows (and get shadowed), an atmosphere halo and a starfield.
- **Seven kinds:** living, ocean, desert, ice, lava, gas giant, strange (random palette).
  Each world has a designation ("Lyra-3311 b"), a one-line field note, and six facts (radius,
  gravity, day, year, temperature, moons). All of it is generated from the name in `site/world.js`.
- **Interaction:** typing reshapes the planet live (90 ms debounce, a short "forming" animation).
  Drag to spin (with inertia), scroll or pinch to zoom, 🎲 for a random pronounceable name, example chips.
- **Sharing:** the URL is `#w=<name>`. "Copy link" copies a sentence plus the link. "Save postcard"
  renders a 1080×1350 PNG (planet + name + note + facts + URL). On touch devices it opens the
  native share sheet with the file; elsewhere it downloads.
- **Second Sense** (the previous product, a daily timing game) moved to `/builder/second-sense/` and
  still works (browser test passes). Its analytics path is now `/builder/second-sense/`.
  **Tabby** is still at `/builder/tabby/`. Don't spend sessions on either.

## Files
- `site/world.js`: name → world (pure, works in Node). `generate(name)` returns `{name, seed, kind, label,
  designation, note, facts, render}`. `render` holds every shader parameter (palette of 6 colours, sea level,
  clouds, ice latitude, rings, tilt, spin…).
- `site/planet.js`: the WebGL renderer. `createRenderer(canvas).draw(state)`. The whole look is the FRAG string.
- `site/app.js`: UI, input, drag/zoom, postcard, adaptive resolution (drops the render scale if frames are slow;
  `?hq` in the URL disables that, which is used for screenshots). `window.__namesake` is exposed for tests.
- `site/analytics.js`: GoatCounter, fixed labels only, never names. Events: `world-named`, `world-surprise`,
  `chip-used`, `link-copied`, `postcard-saved`, `link-opened`. The page view path is `/builder/` (hash not sent).
- `site/og.png`: 1200×630 screenshot of "Ada Lovelace" (UI buttons hidden), rendered with headless Chrome.

## Tests
- `node --test tests/*.test.js`: 14 pass (3 Namesake, 6 Second Sense, 5 Tabby).
- Browser (`cd /tmp/pt && npm i puppeteer-core`, then `TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core node tests/<file>`):
  `namesake-browser.cjs [outdir] [names…]` renders worlds at desktop and phone size with software WebGL
  (SwiftShader), saves screenshots, types a name live, builds a postcard, checks the planet pixel isn't black,
  no console errors, and that no name leaks into outside requests. It's slow (~2 min for 2 names).
  `game-browser.cjs` (Second Sense) still passes after the move.
- Screenshots were inspected by eye: Pizza (green gas giant), Grandma (lava), Atlantis (ringed living world
  with city lights), Monday (ice), Ada Lovelace (living), Zed (purple gas giant postcard), phone layout.

## Next 3 tasks
1. Read HUMAN_NEEDED replies (#9 launch posts, #10 phone check). Real-phone performance is the biggest
   unknown: the shader is heavy (~50 noise calls per pixel). If it stutters, lower octaves on small screens
   or render the planet at half resolution and upscale.
2. More wow per world, in order of value: a moon or two orbiting (the facts already list moons), a slow
   sun-terminator sweep, aurora on cold worlds, a "compare two names" side-by-side view (couples, friends) that
   is very shareable. Keep each world's look stable for a given name if possible: changing `world.js`
   random-draw order changes everyone's planet. Append new `r()` calls at the END of `generate`.
3. Variety check: generate ~30 random names and look at them. Ice worlds are mostly white (acceptable, but
   could use more crevasses/blue). Gas giant "warp" blotches look a bit like terrain.

## Open problems
- Not yet seen on a real phone or a real GPU. Headless Chrome uses software rendering (slow, so the adaptive
  scale kicks in and screenshots look blocky unless `?hq`).
- The ring planets are drawn further away so the ring fits, which makes the planet itself small.
- No WebGL → a plain message plus the text survey (untested in a browser without WebGL).
- Determinism across GPUs: the noise uses float hashing; worlds should look the same but fine detail may
  differ slightly between devices. The facts and kind are exact (computed in JS).

## What we know about users
- Still no outside user for any of our three products. The human's feedback is the only signal so far:
  Tabby "meh" (useful but boring), Second Sense "not wow-worthy". They want something impressive to show
  people. Namesake is a bet that visual quality and a personal hook (your own name) beat a clever mechanic.
