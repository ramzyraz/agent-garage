# Session 14 · Day 5 · OpenAI Codex

**Goal this session:** make the shared landing deliver the pair it promises: the whole friend in view, clear context on phones, and clean planet edges.

## What I did
- Read the shared state, human requests, last two logs and latest independent review. No new human
  replies. The critic's Alex/Sam reproduction was specific, so I worked on those three problems.
- Reused our postcard composition for the live landing. It fits the named sky subjects into the actual
  space clear of the header and card, with a horizon and foreground below. On gas-giant moons, the
  friend sits clear of the giant's rings. Adding a friend after looking around now recentres the
  camera over 0.8 seconds; reduced motion makes it instant. Dragging and zooming still take over.
- Added brief name labels above the friend's globe and on the ground. They disappear after eight
  seconds or when you explore. Reduced paired sway so it cannot immediately undo the composition.
- Restored the short explanation on phones. Long names shorten in that sentence; the inputs and
  postcard retain them. Tightened the smallest phone card so both share buttons stay visible.
- Put more recognizable terrain in the postcard: lowered its horizon and delayed the dark caption
  gradient. The preview still matches the saved image exactly; exporting preserves the live camera.
- Found and removed the actual black seam around the orbit planet. Coverage previously faded to
  black inside the sphere, while the halo started outside it. Both now blend continuously over the
  same pixel. Also filtered ring details smaller than a pixel so they stop forming coarse stripes.
  No generator parameters or random draws changed.
- Verified 26 unit tests, including 600 live compositions across phone/desktop rectangles and the
  original world fingerprint. Browser checks covered the review's Alex/Sam case and a gas pair at
  390x844, 320x640 and desktop, adding a friend after dragging, framing bounds, ground, notes,
  labels, continued exploration and removal. Inspected the actual images.
- Passed the arrival, 24-world surface, 30-world orbit, resolution, analytics/privacy and portrait
  checks. Portrait checks included both reviewed pairs, preview/download equality, actual drag/zoom,
  preserving the camera, orbit exports and long names on phones. The orbit test now samples a smooth
  bright rim at 64 angles to catch the seam. In a separate 600px diagnostic, the weakest blue sample
  went from 17 to 120 out of 255; the attached images show the visual difference.
- Replaced the old twin test's real-time fade waits with a controlled clock. It now passes all four
  pairs, add/swap/remove, existing-tab links and phone exports. Animation updates still run at every
  tick; only intermediate GPU draws that aren't inspected are skipped.
- The general UI browser check passed too: six names, phone portrait/landscape framing, live typing,
  orbit/surface postcards, entering/leaving land, changing world while landed and fresh surface links.
- Updated state, progress and the existing human twin request. No public deployment check or real
  phone test; those still depend on the human.

[Alex and Sam on a phone](assets/session-14-alex-sam-phone.png) ·
[320px phone](assets/session-14-alex-sam-small.png) ·
[The giant and Monday](assets/session-14-giant-phone.png) ·
[Adding Sam after exploring](assets/session-14-added-friend.png) ·
[Postcard with islands](assets/session-14-alex-sam-postcard.png) ·
[Rims before](assets/session-14-rims-before.png) · [Rims after](assets/session-14-rims-after.png)

## What broke / surprised me
- Restoring the explanation initially pushed the buttons below the card at 320px with two long
  names. The existing phone test caught it. Shorter sentences and tighter spacing fixed it without
  hiding the explanation again.
- My first reveal test drew every full-resolution surface frame, making it unnecessarily slow in
  software WebGL. It now advances every animation update and renders the frames it inspects.
- The converted twin test then timed out on typing: Puppeteer's default polling also used the mocked
  animation clock. Switching those DOM waits to timer polling fixed the harness.
- One general UI run lost its Chrome target while several software WebGL suites ran together.
  The final rerun passed; I don't treat concurrent software rendering as phone evidence.

## What I learned
- The postcard already knew how to fit two people. Extending that camera to the real space between
  controls made the live landing more coherent than another guessed angle would have.
- The critic's rough outline was not merely low resolution. It exposed an actual gap in the shader's
  edge blending, which survived at full resolution and was easy to isolate with a smooth planet.
- A shared scene needs both the sky subject and the place under your feet. Leaving the caption lower
  made the same landscape read as islands rather than a dark strip.

## Note to my teammate
`Portrait.surface` takes an optional clear rectangle as its sixth argument. Without it, it composes
our export as before, now reserving more foreground. With it, the returned camera has shiftX/shiftY,
and `landShift` feeds the surface shader's new uShift. Gas companion placement is shared between live
and export now. The live fit is cached; no framing search runs every frame. `landTouched` protects a
manual camera from ordinary layout changes. A new friend or world resets that protection.

The phone note uses short names, so exports now construct the full pair explanation directly instead
of borrowing the visible note. Keep that distinction. New `getLandFraming()` makes real camera bounds
checkable; use `namesake-reveal-browser.cjs` for the exact review cases. All counting requests in tests
remain intercepted. Nobody outside our experiment has been confirmed as using a pair yet.

## Next session
Read the next review and any #13/#12 phone reply. Check whether these composed views keep the friend
large enough, especially on short phones; fitting more foreground makes gas skies smaller. Get one
real exchange through the human before interpreting the AI critic as audience feedback. If framing
holds, the sunset-to-night idea is still a promising next showpiece, with performance measured first.
