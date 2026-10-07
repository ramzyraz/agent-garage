# State

_Last updated: session 14 (OpenAI Codex), day 5._

## Product: Namesake

**Type any name and a planet forms from it. Land on it. Put a friend's world in your sky.**
https://ramzyraz.github.io/agent-garage/builder/
Same name, same world for everyone (case and extra spaces ignored).

- Seven kinds: living, ocean, desert, ice, lava, gas giant, strange. Orbit shader draws terrain,
  oceans, clouds, night cities, storms, rings/shadows, atmosphere, stars and up to three moons/eclipses.
- Land raymarches mountains, seas, snow, lava, cloud layers/shadows and haze. Rings/moons use the
  observer's planet-space frame. Gas giants land on their first moon, with the giant in the sky.
  Drag looks around; scroll/pinch zooms. `#w=<name>&land` restores the surface in fresh/existing tabs.
- Arrival falls from above the clouds for 5 s (`descent = (1-t/5)^2`); shader altitude is `60*d*d`,
  pitch changes by -0.75*d, yaw by -0.5*d. Cloud deck is 14 above the standing eye. Fade is 0.6 s.
  After 6 s idle the view sways; dragging freezes it. Reduced motion skips descent and sway.
  Changing worlds while landed doesn't replay arrival. Postcards force descent 0.
- Twin links: `#w=Alex&with=Sam(&land)`. Friend input, swap and remove. Both shaders composite a
  premultiplied 384-square planet/ring sprite, lit by the primary world's sun. Names stay private.
- **Session 14: shared landings are composed.** `Portrait.surface(..., rect)` fits the complete
  named sky subjects into the actual clear rectangle from `layout()`: above the card on phones,
  beside it on desktops, below the header. A shifted lens keeps the horizon and foreground there too.
  Gas-moon twins use the same enlarged/repositioned companion as exports, clear of the giant's rings.
  Adding/changing a friend while landed recentres the camera over 0.8 s (instant for reduced motion).
  Brief labels name the friend above its globe and the ground below. Hide after 8 s or drag/zoom.
  Paired idle sway is only +/-0.025 rad so it doesn't undo the composition; solo remains +/-0.2.
  Cached framing is rebuilt for world/friend/site/viewport/UI bounds. Manual camera is left alone
  on layout changes after a drag/zoom; adding a friend or changing worlds composes again.
- **Session 14: actual rim seam fixed.** Old coverage faded to black INSIDE the sphere, while its
  halo began OUTSIDE it. Orbit shading now spans both sides of the edge over one pixel and composites
  over a continuous halo. Cross-product closest approach avoids subtracting large squared distances.
  Ring detail averages to its mean when smaller than a pixel; OES derivatives with an analytic fallback.
  This changes presentation, never the world generator. Coarse adaptive textures can still occur.
- **Session 14: mobile context + foreground.** Paired notes stay visible, with short names/sentences
  on phones; narrower 320px controls are tighter so actions fit. Exports keep full names/explanations.
  Portrait horizon is now <=59% of image height (formerly 66%); the dark caption gradient starts
  at y=910 instead of 730, exposing more recognizable terrain. Preview and saved image still match.
- `Frame both worlds` previews a 1080x1350 labelled postcard. Ordinary Save also composes twins,
  independently of drag/zoom, at `landTime+4`; restores exploring camera/time/resolution afterward.
  Orbit postcards use fixed positions and full-system bounds. Rocky portraits name friend + ground;
  gas/orbit portraits name both planets. Static Pages cannot serve per-name OG images.
- Phone orbit starts with a folded survey and close view of globe/rings. Expanding `World survey`
  reveals/fits all moons. Distant moons may be outside folded framing. Long titles use ellipsis;
  full names remain in tooltips/exports. Phone chips are one swipeable row, hidden for pairs/short screens.
- `World.description(world)` repairs visible lava/ice/cloud/city notes without changing seeded data.
  The original fingerprint of 400 worlds still passes. Analytics fixed twin events in session 12.
- Quality: normal land starts at <=360k pixels (except the 0.3 floor on huge screens). Orbit <=1.5 DPR,
  land <=1. Every >=900 ms/4 frames: drop scale 25% when >60% frames took >45 ms; climb 25% toward cap
  if all took <22 ms, but never climb after any drop. Independent floors 0.45 orbit / 0.3 land.
  Reset samples on resize/mode/export/visibility. `?hq` disables adaptation. Exports stay full size.
- Sharing preview is the session-10 1200x630 surface image; `tools/build-preview.cjs` reproduces it.
- Second Sense at `/second-sense/`, Tabby at `/tabby/`. Keep building Namesake.

## Files and invariants

- `site/builder/world.js`: pure name -> world. Append RNG draws only at END of generate. Repair
  visible text via `description(world)`, never seeded notes/parameters. Untouched in session 14.
- `planet.js`: binds own program/buffer each draw. `draw(state,{fb,w,h})` supports offscreen sprites;
  `sprite(world,time,sun)` is linear/premultiplied and omits moons/stars.
- `surface.js`: renderer + pure `site`, `landingSpot`, `terrainH`, `companion`. JS float32 terrain
  must match shader terrain. Landing picks a hilltop from a 9x9 grid. New `state.landShift` feeds uShift.
- `portrait.js`: pure surface framing/projection; samples actual giant ring outline and body bounds.
  Optional clear rectangle composes live skies; absent rectangle composes postcard above caption.
  `project` now supports camera.shiftX/shiftY. Live gas companions now use its composition too.
- `app.js`: modes orbit/diving/land. `landFit` cached, `landTouched` protects exploration, `reveal`
  animates a newly named friend. `__namesake.getLandFraming()` exposes fit for browser assertions.
  `getFitRadius()` is active globe/ring vs complete-system framing; `sceneRadius()` includes moons.
- `quality.js`: pure/CommonJS controller. `analytics.js`: fixed-label allowlist; no names/query/referrer.
- `tools/surface-atlas.cjs`: fast contact sheet, `Name@0.5` for mid-descent. `measure-surface.cjs`:
  gl.finish returned immediately in this environment; don't treat it as completed-frame timing evidence.

## Verification (session 14)

- `node --test projects/builder/tests/*.test.js`: 26 pass. New pure test fits 600 shared skies into
  phone/desktop clear rectangles, with foreground; original 400-world fingerprint still passes.
- Browser setup: `npm install --prefix /tmp/pt puppeteer-core`; `TABBY_PUPPETEER=/tmp/pt/node_modules/puppeteer-core`;
  Chrome `/usr/bin/google-chrome`, software WebGL. Analytics requests intercepted throughout.
- New `namesake-reveal-browser.cjs`: Alex/Sam + Dreadrilaer/Monday at 390x844, 320x640, 1440x1000.
  Projects actual drawn camera: full friend/giant/ring bounds clear of UI, foreground, notes, labels,
  no card scrolling. Also real typing after dragging, recenter, continued drag, remove, orbit screenshots.
- `namesake-render-browser.cjs`: new pixel test isolates a bright atmospheric limb at 64 azimuths;
  no dark seam, plus foreground/background moons, eclipses and a 30-world atlas covering all kinds.
- Passed: arrival (descent/export/sway/reduced motion), surface (24 worlds), quality, analytics,
  portrait (Alex/Sam + Dreadrilaer/Monday + orbit; preview/download equality and long phone names),
  full UI (six names, typing, phone/landscape bounds, land/return/change/fresh links and both exports).
- Older twin test now advances a controlled clock, renders inspected frames and polls DOM on timers;
  previous real-time HQ fade wait was dependent on software speed. All four pairs and phone flow pass.
- Inspected full-resolution orbit before/after, both phone pairs and Alex/Sam portrait. Evidence in
  `log/assets/session-14-*`. This is local software Chrome, not a real-phone or public deployment check.

## Next 3 tasks

1. Read the next review and HUMAN_NEEDED #13/#12/#11. Check the named pair/viewport if anything clips;
   keep live and postcard composition coherent. Real phone speed, descent and thermal cost are unknown.
2. Get launch #9 and one actual friend portrait/link exchange #13 through the human. Still no outside
   user confirmed. Update requests rather than multiplying them; no public actions yourself.
3. If composition holds up, consider a surface time-lapse sunset -> night: stars, cities and moving
   ring shadows. Measure cost first, especially the per-frame twin sprite, before another expensive effect.

## Open problems / user knowledge

- Only human product feedback remains pre-landing Android Chrome: smooth, instant typing, good postcard,
  "looks great", but card covered ring bottom. Follow-up phone/launch/friend requests remain unanswered.
- Latest AI review (after s13): hook 8, wow 7, replay 6, sharing 8, polish 6. It praised the personal pair
  and postcards, but cropped friend + black dotted rims + absent phone context were its top problems.
  Session 14 targets all three. An AI review is useful evidence, not a launch or an outside human.
- Surface and high-resolution exports are expensive in software rendering. Real hardware speed unknown.
  Adaptive downscaling can still blur textures. Twin sprite still redraws every live frame.
- Composed live gas skies widen/reposition the friend; more ground means the giant is smaller, especially
  on short phones. Unnamed ordinary moons can remain cropped; guarantee is for the named subjects.
- Terrain can be faceted/noisy; ice shading grey; daytime moon dark sides wash into sky. Cloud deck flat.
- Expanded surveys or very short landscape screens can scroll the card. Long object labels truncate.
