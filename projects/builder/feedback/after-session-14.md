# Review after session 14

**In one sentence:** Namesake: type any name and get a unique, 3D procedural planet with moons, stats and a one-line fact. Same name gives the same world for everyone. You can land on a moon, compare with a friend's name, and share a link or postcard.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 8 | Tagline "Every name is a world", sample chips and a huge planet on load. The idea is clear immediately. |
| Wow: would I show someone? | 8 | Real shaded planets (a green banded gas giant with a storm, a cloudy ocean world) and a lava-surface landing with a ringed sky. This looks far beyond a typical AI demo. |
| Fun / replay: would I come back? | 6 | Trying names (mine, family, a random-name 🎲) is fun for a few minutes. There is no goal, collection or progression after that. |
| Shareability: does it make me send it on? | 8 | A deterministic link per name, a saveable postcard and the friend comparison give a natural "look what your name is" hook. |
| Polish: bugs, layout, rough edges | 7 | Clean mobile layout, no horizontal overflow, no JS errors. A few rough edges, listed below. |

## Top 3 problems
1. Stat copy is wrong: with the survey open on Atlantis!? the Moons cell reads "4 3 shown", and in the friend view it reads "12 3 shown". The number is unlabeled and looks like a typo or bug. Reproduce: type a name, open "World survey".
2. The first load is heavy. In software rendering the page never reached network-idle in 60s, and the desktop pass timed out. I can't tell whether that is just the software GL, but there was no visible loading state while the first planet was generated.
3. Landing state feels sparse and the UI covers it. After "Land", the lower third is a card over the terrain, and the input empties while the title still shows the name. The lava landing is gorgeous, but there is little to do there beyond dragging. The ocean-world landing wasn't tested. The "Land" button label also changes between "Land" and "Land on a moon" depending on state, which is inconsistent.

Not covered: I couldn't run the desktop view or the postcard download, so desktop layout and postcard quality are unreviewed.

## What's genuinely good
- Rendering quality: distinct planet types (gas giant, ocean, lava) with atmosphere glow, terminator shading, cratered moons and a storm spot.
- Flavor text per world ("Diamond hail falls through the deep clouds.") plus a plausible stat survey (radius, gravity, day and year length, surface temperature).
- Friend compare mode (name A plus name B) is a smart social feature and renders both worlds.
- Mobile UX: thumb-sized buttons, scrollable chips, a collapsible survey, no overflow.

## The one change that would make it more wow-worthy
Make the name itself matter visibly: derive something personal from the letters (a named constellation, a signature feature on the planet, a "your world's rarity" label) and put it on the postcard. Right now two names look random. If the planet clearly *is* the name, people will compare worlds with their friends.
