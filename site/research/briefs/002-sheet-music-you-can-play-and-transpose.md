# Turning a PDF or photo of sheet music into music you can hear, fix and transpose

> Musicians constantly get parts as PDFs or paper in the wrong key for their instrument, and turning them into editable music still means either paying for a scanning app that makes mistakes or retyping the notes by hand.

**Found:** 2026-10-07 · **Pain** 4/5 · **Reach** 3/5 · **Buildable** 3/5 · **Wow potential** 5/5

## The problem

Amateur and semi-pro musicians in community bands, big bands, church groups, choirs and school
ensembles get most of their music as PDFs or photocopies. Often the part is written for the wrong
instrument (concert pitch for a B♭ clarinet, a bass part needed for 4th trombone), or they want to
*hear* it to learn it. The image has to become real notation first: optical music recognition
(OMR). That step still fails often enough that people give up.

On a brass players' forum in December 2024, a user asked
["Any decent software to transpose from/to PDF?"](https://forum.dwerden.com/forum/euphonium-tuba-and-general-music/general-music-discussion/general-discussion-of-anything/144941-any-decent-software-to-transpose-from-to-pdf?p=144956)
because they needed to turn bass parts into trombone parts for big-band charts. The forum's
administrator replied:

> "I have the same wish as Gary, but after trying many options and spending quite a bit of money,
> I conclude there is no simple app to do this."

He added: "With AI, maybe even in a year or two???"

On the MuseScore forum, a user who converted 28 PDFs
([Dec 2024](https://musescore.org/en/node/372490)) wrote:

> "I have converted 28 pdfs to .mscz and when I open them they have quite a few errors. It will
> take a long time to rectify them - is there any kind of workaround to improve accuracy?"

The replies: "Use a commercial, fee-based program", "No program does these tasks absolutely
perfectly!", and "Such a simple score can be transcribed into musescore by hand in a few minutes."
In other words, the advice is to retype it.

An earlier MuseScore thread ([Jun 2021](https://musescore.org/en/node/322021)) describes the
typical experience:

> "The very first attempt I made with one piece of sheet music was really encouraging, converting
> the first handful of measures correctly, then after that it went off the rails; and none of the
> rest of that music or any subsequent attempts with any other music have even been remotely close
> to what it's supposed to be."

The professional notation program Dorico has no scanning at all. When a user asked "Do Steinberg
offer a facility to scan sheet music into Dorico?"
([Steinberg forum, Jun 2023](https://forums.steinberg.net/t/scan-sheet-music/854461)), the answers
pointed to third-party apps: "PlayScore for simple, quick jobs and Photoscore for complex stuff."

(The two musescore.org threads sit behind a bot check. I read them through the Internet Archive's
copies, e.g. `web.archive.org/web/2026/https://musescore.org/en/node/372490`.)

## How big is it

- **Who has it:** anyone who plays a transposing instrument (clarinet, saxophone, trumpet, horn)
  from music written for someone else, choir members learning parts from PDFs, and teachers and
  band leaders adapting arrangements for the players they actually have. I couldn't find a
  trustworthy count of amateur ensemble musicians, so Reach is my estimate (3/5: large and
  recurring, but not everyone).
- **It recurs across many communities**, on forums for different instruments and programs
  (dwerden.com for brass, musescore.org, forums.steinberg.net), and over many years (2021–2024 threads above).
- **People pay to work around it.** PlayScore 2 is a subscription app. One App Store reviewer wrote
  "I've lowered my rating from 5 to 2 stars because a recent update to PlayScore2 removed existing
  features and demanded a paid subscription"
  ([reviews aggregated on justuseapp](https://justuseapp.com/en/app/1449591118/playscore-2/reviews)).
- **Research is very active**, which shows the problem is still open. LEGATO 2 (July 2026) claims
  "new state-of-the-art performance in both OMR and downstream sheet music understanding"
  ([arXiv 2607.05769](https://arxiv.org/abs/2607.05769)).

## What exists today

| Option | What it does | Why it falls short |
|---|---|---|
| **MuseScore "Import PDF"** (free) | Sends the PDF to a server running Audiveris, returns a score | One-pass and unreliable (threads above). Fixing the output in a full notation editor is slower than retyping simple parts. |
| **Audiveris** ([GitHub](https://github.com/Audiveris/audiveris), ~2.9k stars, AGPL-3.0, active) | Open-source desktop OMR engine with a correction editor | A Java desktop app, intimidating for non-technical musicians. Weaker on phone photos. |
| **homr** ([GitHub](https://github.com/liebharc/homr), ~420 stars, AGPL-3.0, active Oct 2026) | Open-source OMR for *camera photos* → MusicXML, transformer-based | A command-line Python tool. Output still needs checking and fixing somewhere else. |
| **oemer** ([GitHub](https://github.com/BreezeWhite/oemer), ~800 stars, MIT) | End-to-end OMR from phone photos → MusicXML | Last pushed April 2025. A command-line research-grade tool. |
| **LEGATO** ([Hugging Face](https://huggingface.co/guangyangmusic/legato), MIT, gated) | Large pretrained model, full-page typeset scores → ABC notation | Built on Llama 3.2 11B Vision and needs "~20GB+ for full precision", so it isn't a consumer tool. The model card says performance "may degrade on handwritten scores, low-quality scans, or unusual layouts". |
| **PlayScore 2** (iOS/Android, subscription) | Snap a photo, hear playback, export | Accuracy complaints in reviews: "Playback missed accidentals and mangled note lengths and count. Some rests were played as notes." / "It completely misses a bunch of notes" ([justuseapp](https://justuseapp.com/en/app/1449591118/playscore-2/reviews)). Plus subscription friction. |
| **Soundslice** (web, paid) | PDF/photo scanning into an interactive player, actively improved ([2025 review](https://www.soundslice.com/blog/302/soundslice-year-in-review-2025/)) | A paid product. I couldn't open its pricing page (404), so I make no claim about cost. It's a strong incumbent for some users, and builders should study it. |
| PhotoScore, SmartScore, ScanScore, Newzik | Commercial OMR | Mostly desktop or paid. Forum users recommend different tools for different score types, which suggests none is reliably good across the board. I didn't verify each product's current price. |

**What I think (not a finding):** recognition will never be perfect. So the winning product isn't
"better OMR". It's **OMR plus the fastest possible way to fix the last 5% of mistakes**, right on
top of the original image, followed by one-tap transposition, playback and a clean printable part.
Every tool above treats correction as someone else's problem: export to MusicXML, then fight a
notation editor.

## What a great solution would need

- **Input:** multi-page PDFs and phone photos (skewed, shadowed, curved pages).
- **Recognition:** reuse an existing open model rather than training from scratch. homr and oemer
  run on CPU, and LEGATO is far heavier. Note the licences: homr and Audiveris are AGPL-3.0, while
  oemer and LEGATO are MIT. Whether recognition runs in the browser (ONNX/WebGPU) or on a small
  server is the builders' call; a server costs money and raises privacy questions for copyrighted
  scores.
- **Correction UI as the core feature:** show the recognised notes overlaid on the original
  image. Highlight low-confidence symbols first. Fix a wrong pitch, duration or accidental with one
  click or key. Check by **listening** while a cursor follows the original image. Use measure
  durations that don't add up as an automatic error detector.
- **Instant output:** transpose for B♭/E♭/F instruments or any interval, change clef (bass part →
  tenor trombone), print clean parts (MusicXML render), play back with tempo control and
  loop a passage, and export MusicXML/MIDI for people who do use MuseScore or Dorico.
- **Hard parts:** dense piano and orchestral scores, lyrics under choir parts, multi-voice staves,
  tuplets, repeats and D.S./coda navigation for playback, and honest accuracy reporting. Start
  with single-line parts (wind, brass, voice), where the pain is sharpest and accuracy is most
  achievable.
- **Copyright:** the tool should process the user's own files for personal use and not host or
  share scores.

## Sources

- dwerden.com forum, "Any decent software to transpose from/to PDF?" (Dec 2024): https://forum.dwerden.com/forum/euphonium-tuba-and-general-music/general-music-discussion/general-discussion-of-anything/144941-any-decent-software-to-transpose-from-to-pdf?p=144956
- MuseScore forum, "imported pdfs require lots of editing" (Dec 2024): https://musescore.org/en/node/372490
- MuseScore forum, "Tips for Importing/Converting PDF" (Jun 2021): https://musescore.org/en/node/322021
- Steinberg forum, "Scan sheet music" (Jun 2023): https://forums.steinberg.net/t/scan-sheet-music/854461
- PlayScore 2 reviews (justuseapp): https://justuseapp.com/en/app/1449591118/playscore-2/reviews
- Soundslice, "Soundslice year in review, 2025": https://www.soundslice.com/blog/302/soundslice-year-in-review-2025/
- Audiveris: https://github.com/Audiveris/audiveris
- homr: https://github.com/liebharc/homr
- oemer: https://github.com/BreezeWhite/oemer
- LEGATO model card: https://huggingface.co/guangyangmusic/legato
- Yang et al., "LEGATO 2: Toward Multimodal Sheet Music Recognition and Understanding" (2026): https://arxiv.org/abs/2607.05769
