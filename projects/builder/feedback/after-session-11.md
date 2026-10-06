# Review after session 11

**In one sentence:** Namesake turns any name into a 3D planet you can land on, with a friend's planet hanging in its sky.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | “Every name is a world” and the input explain it immediately; the phone's tiny planet weakens the reveal. |
| Wow: would I show someone? | 7 | Landing on Pizza's moon beneath an enormous green gas giant is worth showing; some ground views look coarse. |
| Fun / replay: would I come back? | 6 | Names, world types, and swapping with a friend invite experimentation. After a few visits, there is little beyond another name and another view. |
| Shareability: does it make me send it on? | 7 | Named postcards and links to a shared sky give it a personal reason to travel; exported framing can lose the friend. |
| Polish: bugs, layout, rough edges | 7 | Core controls and shared-state restoration worked. Mobile composition, long-name crowding, and contradictory flavor text need attention. |

Tested the live site in Chrome at 1440×1000 and 390×844 with touch, including presets, random names, landing, pairing, swapping, removal, dragging, zooming, copying, and PNG downloads. Emoji, accents, angle brackets, blank input, and long names were also tried. Software-rendering frame rate was not scored.

## Top 3 problems

1. **The phone gives the information card more presence than the world.** At 390×844, enter “Grandma” in orbit: the planet is roughly 100 pixels across, while the expanded card occupies about 370 pixels vertically. Its lava detail barely reads. Start with a larger planet and a compact survey. A 40-character name plus a friend makes this worse: the share row is partially clipped at the card's bottom in the initial view, although scrolling inside the card reveals it.

2. **The description and visible world disagree.** Enter “Hello”: the card says “The rivers glow teal,” but the globe has bright orange-red lava. Landing also shows orange channels, and the downloaded postcard repeats the teal claim beside the orange planet. Match descriptive details to what the visitor can actually see.

3. **A paired postcard can omit the friend it advertises.** Enter “Pizza,” land on its moon, add “Alice,” then drag left about 200 pixels and zoom in before saving. My PNG says “TWIN WORLDS” and “Pizza & Alice,” but shows a cropped Pizza and a cratered moon; Alice is outside the picture. Give paired exports a composed camera view that guarantees both named worlds are visible.

## What's genuinely good

- The worlds have real visual variety: Monday's icy texture, Grandma's glowing lava, and Atlantis's rings and night-side city lights are distinguishable at a glance on desktop.
- The moon landing beneath Pizza's huge gas giant changes the sense of scale dramatically. This is the strongest reveal I encountered.
- Putting Alice in Hello's sky and swapping places works, including exchanging the names and changing the terrain. It makes the name gimmick feel social.
- Copy link produced a readable invitation plus a URL. Opening the Pizza/Alice URL in a fresh browser restored both names and the moon landing.
- The single-world PNG has clean typography, readable facts, and no interface clutter. Unicode input displayed literally; clearing the field kept the previous world rather than breaking the scene.

## The one change that would make it more wow-worthy

Make the shared sky a deliberate portrait of two people: a “Frame both worlds” action that composes the horizon and both planets, visibly labels each name, and exports that same composition. The personal connection is already the best reason to send this; make the resulting image unmistakable and reliably beautiful.
