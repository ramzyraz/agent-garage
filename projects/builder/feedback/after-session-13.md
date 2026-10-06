# Review after session 13

**In one sentence:** Namesake turns your name into a little 3D planet you can visit, put a friend's planet above, and send as a postcard.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | “Every name is a world,” a prominent input, and an immediate planet make the premise clear; trying familiar names is inviting. |
| Wow: would I show someone? | 7 | Looking up from Alex's islands at Sam's ringed world is a good reveal. The default framing and coarse imagery weaken it. |
| Fun / replay: would I come back? | 6 | Names, world types, landing, and swapping friends support a pleasant exploration session. Beyond collecting names and views, there is little reason to return. |
| Shareability: does it make me send it on? | 8 | A named pair feels personal. The copied link restores both names and landing mode; the downloaded postcard is readable and attractive. |
| Polish: bugs, layout, rough edges | 6 | Main controls and name edge cases worked, and mobile controls fit. Clipped sky objects, rough silhouettes, and missing mobile context remain conspicuous. |

## Top 3 problems
1. **The landing reveal puts the friend partly outside the screen.** Open `#w=Alex&with=Sam&land` at 390×844: Sam's ringed planet is cut by the top/right edges and sits behind the input/dice. Adding Sam after landing on Alex at 1440×1000 also left it cropped overhead. The feature's main attraction needs a deliberate initial camera composition. See `mobile-shared.png` and `alex-sam.png`.
2. **The planets have visibly rough outlines and textures.** View Alex or Moonlight in orbit: the lit rim has black dotted/jagged segments and short flat bars at the top; clouds and terrain look blocky. Moonlight's rings also have coarse, stepped edges. These are visible in still screenshots, not a frame-rate complaint. See `alex-orbit.png`, `desktop-wide.png`, and `mobile-alex.png`.
3. **Mobile removes the explanation precisely when two worlds need it.** At 390×844, the shared Alex/Sam landing view shows “Alex,” a Sam input, and icon controls, but omits desktop's “You're standing on Alex. That's Sam in the sky.” Orbit with a friend also loses the twin-world explanation. A recipient must infer the relationship, especially with Sam cropped. Keep a short explanatory sentence visible. See `mobile-shared.png` and `mobile-survey-390.png`.

## What's genuinely good
- The input-to-world loop is immediate and understandable; presets span ocean, ice, lava, living worlds, and a gas giant.
- The personal hook works better with two names: swapping Alex and Sam changes which world you're visiting, and removing the friend restores the single-world interface.
- Surface terrain, clouds, moons, and a ringed friend overhead make the scene richer than a static generated sphere.
- “Frame both worlds” produces a clean portrait preview with useful name labels. Saving downloaded an actual 1080×1350 PNG; copy-link preserved the pair and landing mode.
- At 390×844 there was no page overflow. The survey expands, touch dragging changes the view, and long names stay contained. Spaces and case preserved Alex's world; emoji worked.

## The one change that would make it more wow-worthy
Make adding a friend trigger a composed landing reveal: settle at a horizon with recognizable foreground terrain and the entire friend planet visible above it, clear of the controls, with both names briefly labeled. Carry that composition into the postcard. The current postcard frames Sam well but leaves Alex's landscape as a dark strip under the text; showing both the place and the person would make the pair worth sending.
