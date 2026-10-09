# Audio description for everyday video: lectures, council meetings and how-tos

> Accessibility rules require spoken descriptions of what's on screen in prerecorded video, but human describers cost $7–11 a minute, AI drafts can't be published unreviewed, and there's no fast, cheap way for an ordinary staff member to turn a draft into a good description track.

**Found:** 2026-10-09 · **Pain** 4/5 · **Reach** 3/5 · **Buildable** 4/5 · **Wow potential** 5/5

## The problem

Captions help people who can't hear a video. **Audio description (AD)** helps people who can't see
it: a narrator says what's on screen ("The slide shows a bar chart: sales doubled from 2020 to
2024"). WCAG success criterion 1.2.5, part of the Level AA standard that US public institutions now
have to meet, says simply: "Audio description is provided for all prerecorded video content in
synchronized media" ([W3C, Understanding 1.2.5](https://www.w3.org/WAI/WCAG21/Understanding/audio-description-prerecorded.html)).
It isn't needed when the soundtrack already conveys everything important. When the gaps in
speech are too short, W3C describes **extended** description, which pauses the video to make time.

The US Department of Justice moved the compliance date for large public entities to April 26,
2027, and to April 26, 2028 for smaller ones, citing the fact that technology "does not yet reliably
automate the remediation of inaccessible content at scale"
([Federal Register 2026-07663](https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web),
[official PDF](https://public-inspection.federalregister.gov/2026-07663.pdf); see brief
[003](003-make-any-pdf-accessible.md) for more on that rule).

The best evidence I found is a working-group report from the **University of Washington**
([Recommendations for April 2025](https://www.washington.edu/accessibility/academic-course-content-action-team/video-audio-report/)):

- "Very few videos at the UW are currently audio described." Its 3Play Media orders from 2015 to March 2025 add up to only a few hundred recordings.
- Human description costs "$7.35 per video minute (standard) or $11.00 per video minute (extended)".
  For roughly 2 million minutes of video that comes to **$14.7M–$22M**. 3Play's AI description is $1.00–$1.50 per minute.
- But on AI: "This technology is not yet mature enough to be useful for people who depend on audio
  description", and "No AI audio description is reliable enough to be published without review at
  this point." 3Play's own testing called AI useful mainly as "a first draft".
- The report worries that making instructors edit descriptions "could have the unintentional
  consequence" of them avoiding video altogether.

So the job is clear: **AI writes a draft, a human must review and fix it, and that review step is
the expensive, scary, unscalable part.**

The volunteer world shows the same pattern. YouDescribe, run by the Smith-Kettlewell Eye Research
Institute, lets blind viewers request descriptions for YouTube videos. "Only 7% of requested
videos on the wishlist have audio descriptions", and the platform's 3,000 volunteers "can't keep up"
([Northeastern Global News, Jun 2025](https://news.northeastern.edu/2025/06/27/video-accessibility-blind-users-ai)).
In May 2026 it added a "Prompted Interface" that "gives volunteers AI-assisted draft scripts they
can review, correct, and refine"
([Smith-Kettlewell, May 21, 2026](https://www.ski.org/?p=17016)).

Blind users' own organisations set the quality bar. The American Council of the Blind's adopted
TTS guidelines ([ACB](https://www.acb.org/node/9229)) say "Human-voiced Audio Description remains the
gold standard", "Audiences must be informed when TTS is used", and blind and low-vision people
"must participate in and be a part of the evaluation and quality control".

## How big is it

- **Who needs it:** every US public school district, college, university, city and county that posts
  prerecorded video, plus federally funded health providers under a parallel HHS rule. A single
  university has on the order of 2 million minutes (UW figure above).
- **Who does the work:** central accessibility teams are tiny. An Educause poll cited by Inside
  Higher Ed found "40 percent of institutions have just one or two staff members on campus dedicated
  to technology accessibility"
  ([Nov 2025](https://www.insidehighered.com/opinion/columns/editors-note/2025/11/06/colleges-are-running-out-time-digital-accessibility)).
- **Beyond compliance:** YouDescribe's 93% unmet wishlist shows demand from blind viewers for
  ordinary online video, not only course material.
- I scored Reach 3/5 rather than higher because the people *doing* the work are a specialised group
  (accessibility staff, instructional designers, comms teams, volunteers), even though the people
  who benefit are many more.

## What exists today

| Option | What it does | Why it falls short |
|---|---|---|
| **Human AD vendors** (e.g. 3Play Media) | Professional scripts and voicing | $7.35–$11.00/min at UW's rates, so institutions describe almost nothing. |
| **AI AD from caption vendors** (3Play AI at $1–1.50/min per UW; also Verbit, Subly, ViddyScribe, Maestra, Echo Labs and others) | Automatic draft descriptions | UW: not reliable enough to publish without review. The review/editing tools are inside each vendor's platform. Pricing is often "request a demo" (e.g. [Subly](https://www.getsubly.com/compliance/ada-title-ii-education)). I didn't test these products' editors myself. |
| **YouDescribe** (free, nonprofit) | Volunteer description of YouTube videos, now with AI-drafted scripts | YouTube only. It's built for volunteers describing public videos, not for an institution describing its own lecture capture, Panopto or MP4 files. |
| **Panopto's built-in description editing** | Instructors can type descriptions | UW says this "should be exercised with caution". Instructors aren't trained describers, and there's no AI help or quality check mentioned. |
| **Research** (e.g. Rescribe, [arXiv 2010.03667](https://arxiv.org/abs/2010.03667)) | Tools for fitting descriptions into gaps and auto-editing them | Research prototypes, not products. |

**What I think (not a finding):** most institutional video isn't cinema. It's lectures with slides,
screen recordings, council meetings and how-to demos. In those, most missing visual information is
**text and diagrams on screen**, which current vision models read well. A tool that specialises in
that kind of video, finds the speech gaps, drafts short descriptions that fit them, and makes
human review fast and pleasant could cut the cost per minute dramatically. It would also be a
striking demo: drop in a lecture, then listen to it described.

## What a great solution would need

- **Input:** an MP4/WebM upload or a link the user owns, plus an existing caption file if there is one
  (re-using captions avoids describing what the speaker already says).
- **Gap finding:** voice-activity detection to find silences long enough for a description, and
  flag moments where something important appears with no gap, so extended description is needed.
- **Drafting:** sample frames at scene or slide changes and send them with the transcript to a vision
  model. It should describe only what the audio *doesn't* already say, keep descriptions short
  enough to fit the gap, and follow a style guide (present tense, no interpretation, read on-screen
  text).
- **The review UI is the product:** a timeline with each description shown next to its frame, its
  fit to the gap (too long = red), one-click accept/edit/regenerate, keyboard-only operation,
  and a "watch with descriptions" preview. The reviewer must be able to finish a 10-minute lecture in
  a few minutes. The **reviewer may be blind** (ACB says blind people should take part in quality
  control), so the tool itself must work fully with a screen reader.
- **Output:** a WebVTT description track (HTML `<track kind="descriptions">`), a mixed audio
  track or MP4 with voiced descriptions (with clear TTS disclosure per ACB), an extended-AD
  version that pauses the video, and a text transcript with descriptions included.
- **Cost and privacy:** vision-model calls cost money. Sampling frames only at visual changes keeps
  costs low. Many lecture videos include students' faces, so builders need a clear data policy and
  ideally a bring-your-own-key option.
- **Hard parts:** judging what is *important* (YouDescribe researchers note humans are still better
  at this), fast-moving demos, describing people respectfully, multiple languages, and honest
  quality claims. It must never call AI output "compliant" without human review.

## Sources

- University of Washington, Course Content Multimedia Working Group, "Recommendations for April 2025": https://www.washington.edu/accessibility/academic-course-content-action-team/video-audio-report/
- W3C, Understanding SC 1.2.5 Audio Description (Prerecorded): https://www.w3.org/WAI/WCAG21/Understanding/audio-description-prerecorded.html
- DOJ interim final rule (Apr 20, 2026), Federal Register 2026-07663: https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web (full text: https://public-inspection.federalregister.gov/2026-07663.pdf)
- American Council of the Blind, Guidelines for the Use of Text to Speech (TTS) in AD (adopted): https://www.acb.org/node/9229
- Northeastern Global News, "video accessibility blind users ai" (Jun 27, 2025): https://news.northeastern.edu/2025/06/27/video-accessibility-blind-users-ai
- Smith-Kettlewell, "YouDescribe Launches Two New Describer Interfaces for GAAD 2026" (May 21, 2026): https://www.ski.org/?p=17016
- Inside Higher Ed, "Colleges Are Running Out of Time on Digital Accessibility" (Nov 6, 2025): https://www.insidehighered.com/opinion/columns/editors-note/2025/11/06/colleges-are-running-out-time-digital-accessibility
- Subly, ADA Title II education page: https://www.getsubly.com/compliance/ada-title-ii-education
- Rescribe: Authoring and Automatically Editing Audio Descriptions: https://arxiv.org/abs/2010.03667
