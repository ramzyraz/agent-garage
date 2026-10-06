# Review after session 12

**In one sentence:** Namesake: type any name and get a procedurally generated 3D planet (same name, same world for everyone) with a name-specific one-line fact and stats. You can land on a moon, put a friend's name beside yours, and share a link or postcard.

## Scores (1–10)
| | Score | Why |
|---|---|---|
| First 10 seconds: do I get it, am I hooked? | 7 | "Every name is a world" plus a planet already spinning is clear at once. On mobile the default is a nice desert world ("Saturday"). On desktop the "Try: your name / Pizza / Monday / Grandma / Atlantis" chips are a good nudge. The planet isn't dramatic enough to hook on its own. |
| Wow: would I show someone? | 6 | The concept is good, and "Pizza" as a green banded gas giant with moons is charming. The renders are only decent: pixelated limb edges, blobby textures, and a pink halo on "PizzAtlantis". It reads as "nice procedural planet", not "an AI built that?!". |
| Fun / replay: would I come back? | 6 | Typing names is a fun loop (I tried 7 and each gave a different type and line). The dice and the friend comparison add some depth. It's a toy with no goal, though, so the replay is "try a few names and leave". |
| Shareability: does it make me send it on? | 7 | Deterministic worlds, a Copy link button, a Save postcard button and "put a friend's world in this sky" are the right hooks. "What's *your* name's planet?" is a naturally viral prompt. |
| Polish: bugs, layout, rough edges | 6 | No console or page errors, and the mobile layout fits cleanly. Rough edges are listed below. |

## Top 3 problems
1. **Landing looks weak.** On desktop, Land on Pizza (gas giant, "Land on a moon") gives a washed-out olive-grey haze. The planet is a big soft green blob and the ground is a thin hazy strip at the bottom edge. The scene I'd expect to be the payoff is the least impressive screen. On mobile (screenshot ~1s after tapping Land) the whole screen was a flat lilac wash, and the planet's edge was pixelated against it.
2. **Rendering is pixelated and soft.** Planet limbs show stair-stepped jaggies (visible on the Pizza gas giant and the mobile desert world). Gas-giant bands look smeared. The pixel look might be deliberate, but next to the smooth glow and atmosphere it looks like low resolution, not style.
3. **Layout and edge cases.**
   - Desktop: the planet sits far right with a large empty middle and a left card, so the composition feels unbalanced.
   - Long names: a 40+ character name is cut to "PizzAtlant<b>x</AA…" in the title, with no hint of the full name.
   - The page footer text on the landed screen is nearly unreadable over the bright ground (desktop, bottom right).
   - On mobile, the "Try:" chips aren't shown, so a first-time phone visitor sees only an empty "Type any name…" box. The "Add a friend" button is small and dashed, so it's easy to miss.

## What's genuinely good
- The premise is instantly understood and personal. Everyone wants to see their own name.
- The facts are well written and specific to the name: "It hasn't rained in 27 million years", "The tides are 34 metres high", "Nobody has answered our signal yet."
- Variety is real: desert, gas giant, ocean, living and "strange" worlds, with rings and moons. The stats panel (radius, gravity, day, year, moons) gives it a science feel.
- The interactions are smooth and sensible. The input, the dice, Land / Back to orbit, the friend comparison with swap and close buttons, and Copy link all work with no JS errors. Special characters are shown as text safely.
- The mobile layout is tidy, with large tap targets and a card that doesn't cover the planet.

## The one change that would make it more wow-worthy
Make the landing the showpiece. Replace the hazy strip with a real first-person surface view: a proper horizon, terrain and sky colours matched to the world type, the parent planet or rings looming overhead, and a slow camera drift. Then make the postcard that screen, captioned with the name and the fact, since it's the image people would actually post.
