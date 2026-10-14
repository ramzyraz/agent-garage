# A free room where everyone speaks their own language: replacing Microsoft Translator's group conversations

> Teachers, support workers and deaf users relied on a free Microsoft Translator feature that let a whole group join one conversation from their own phones, each reading and speaking their own language. Microsoft retired it on June 30, 2026, and the free tools that remain only handle two people sharing one phone.

**Found:** 2026-10-14 · **Pain** 4/5 · **Reach** 4/5 · **Buildable** 4/5 · **Wow potential** 5/5

## The problem

For years, the Microsoft Translator app had a "Conversation" mode. One person started a conversation and
shared a 5-digit code or QR code. Everyone else joined on their own phone or laptop, picked their
language, and spoke or typed. Each person saw the whole conversation live, translated into their own
language. It was free, and it worked across Android, iOS and the web.

**It's gone.** The app's release notes for version 26.7.1 (June 30) say: "The multi-device conversation
feature has been retired" ([App Store listing](https://apps.apple.com/us/app/microsoft-translator/id1018949559)).
The cloud service behind it went too. Microsoft's Speech SDK 1.51 (July 2026) "Removed ConversationTranslator
(multi-device conversation) support due to the service retirement"
([Azure Speech release notes](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/releasenotes)).
So any third-party app built on that API stopped working as well. Microsoft's enterprise speech app,
Translator Pro, "begins retirement on September 15, 2026" and stops taking new customers
([Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/translator/solutions/translator-pro/overview)).
Microsoft's suggestion there is for organisations to build their own apps on Azure. That's no help to a teacher.

**Who used it.** Microsoft marketed it to schools for "One-on-one meetings between teachers and school staff",
"Group settings such as school orientation meetings" and "Assemblies for parents that are not yet fluent in the
school staff's language" ([Microsoft Translator for Education](https://www.microsoft.com/en-us/translator/education/parent-teacher-conferences/)).
It also said the feature "helps English language learners, deaf, or hard-of-hearing students or parents communicate with one another"
([Microsoft, live conversations](https://www.microsoft.com/en-us/translator/education/live-conversations/)).
Districts wrote their own how-to guides for parent conferences. For example, Poudre School District told parents:
"Speak or type in your own language; the conversation will be translated into the preferred language of the
other party" ([PSD Tech Portal](https://techportal.psdschools.org/node/2524)).

**What it was like when it broke.** In October 2025 the feature went down for about two weeks. The Microsoft Q&A
thread from that outage shows who depends on it
([Microsoft Q&A, Oct 2025](https://learn.microsoft.com/en-us/answers/questions/5580071/microsoft-translator-conversation-feature-stopped)):

- A Swedish support worker: "This function is used as a speech-to-text accessibility tool for deaf and
  hard-of-hearing users, so it is critical for communication support nationally in Sweden."
- An organisation: "We currently have thousands of devices and users that can no longer create new conversations".
  Microsoft support only told them "its a known issue with no ETA on getting a resolution".
- A teacher: "I use Translator in the classroom, where I have 4–10 different languages. Without conversation
  mode, it takes forever to use other tools."
- A newcomer teacher: "this is the only live conversation app that works."
- Another educator: "We have taught hundreds of teachers how to use converse mode and it has been a game changer in our schools."

That outage was temporary, but the June 2026 retirement is permanent. A WhistleOut review concluded that
"nothing currently replicates what Converse did for casual users quite as cleanly"
([WhistleOut, updated Mar 4, 2026](https://www.whistleout.com/CellPhones/Guides/is-microsoft-translator-worth-downloading)).
A school-technology vendor's guide also confirms it "was retired on 30 June 2026 and is gone from the current app"
([OneScreen, Aug 2026](https://www.onescreensolutions.com/en/blog/english-to-spanish-translation-app/)).

**Google cut a similar feature the same year.** Several outlets report that Google Assistant's Interpreter Mode,
which gave "real-time bidirectional spoken translation between 26 languages", was removed earlier in 2026 and is
"not supported in Gemini as of July 2026"
([Tech Times, Aug 5, 2026](https://www.techtimes.com/articles/323242/20260805/google-assistant-september-4-shutdown-leaves-pixel-9-galaxy-s25-slower-gemini-permanently.htm);
[IBTimes Singapore, Aug 10, 2026](https://www.ibtimes.sg/A000Nth)). These are secondary reports. I didn't find Google's own notice.

## How big is it

- **Schools (US):** about 5.3 million public school students were English learners in fall 2021, 10.6% of
  enrollment. Spanish is the largest home language by far (about 4.0 million), followed by Arabic, Chinese and
  Vietnamese ([NCES](https://nces.ed.gov/programs/coe/indicator/cgf/english-learners)). Each of these students has
  parents who go to conferences, orientations and meetings. Newcomer classrooms often mix many languages at once
  (the "4–10 different languages" above).
- **Everyone else:** 21.7% of US residents aged 5+ speak a language other than English at home (78.3% speak only
  English, [Census Bureau, 2018–2022 ACS](https://www.census.gov/newsroom/press-releases/2023/language-at-home-acs-5-year.html)).
  The Q&A thread shows users in Sweden and Germany too. Other settings where a whole group has to talk across
  languages: refugee and settlement services, churches, community meetings, volunteer groups, international
  student orientations, and mixed-language families.
- **Accessibility:** deaf and hard-of-hearing users used the same feature as live captions on their own screen
  (Sweden example above).
- **Cost of the alternative:** human interpreters are the fallback. Wordly, a commercial AI-interpretation vendor,
  gives "$80–$250 per hour for live interpreters" as a ballpark ([Wordly](https://wordly.ai/blog/translator-cost)).
  That's a vendor figure with no cited source, so treat it as rough.
- **What I couldn't measure:** Microsoft never published usage numbers for Conversation mode, so I can't say how
  many people lost it. Google Play reviews about the removal exist according to search snippets, but I couldn't
  open them, so I haven't quoted them.

## What exists today

| Option | What it does | Why it falls short |
|---|---|---|
| **Google Translate conversation / Live translate** (free) | "Back-and-forth conversation in real time" on one phone, "more than 70 languages" ([Google, Aug 26, 2025](https://blog.google/products/translate/language-learning-live-translate/)) | One device switching between two languages. You can't run a 6-language parent meeting with it, and nobody gets the conversation on their own screen. |
| **Apple Live Translation** (AirPods, iOS 26) | Spoken translation in your ear | Apple-only, needs recent AirPods and an Apple Intelligence iPhone, about 10 languages ([Apple Newsroom](https://www.apple.com/ie/newsroom/2025/11/live-translation-on-airpods-expands-to-the-eu/)). 9to5Mac notes it is mostly one-sided unless both people wear AirPods ([9to5Mac](https://9to5mac.com/2025/09/09/live-translation-airpods-compatibility/)). |
| **Microsoft Translator (remaining app)** | Single-device text, voice and split-screen translation | The group, multi-device part is exactly what was removed. |
| **Wordly, Interprefy-style event platforms** | AI interpretation for meetings and events, 60+ languages | "Pricing starts at about $1,500 for a 10-hour package" ([Wordly](https://www.wordly.ai/blog/5-new-ways-to-try-buy-meeting-and-event-translation)), aimed at conferences and businesses. Too expensive and too much setup for a teacher's 15-minute conference. |
| **Live Translate Live** | One shared screen with a scrolling translation, 103 languages | Paid per minute ($4.50/hour on its own site), and everyone reads one shared screen instead of their own phone ([vendor blog](https://livetranslate.live/blog/best-live-translation-tools-2026)). |
| **OneScreen Scrybe** | Classroom captions on the class display and student devices | Price by sales quote, and built for a teacher captioning a shared room rather than a back-and-forth between families ([OneScreen](https://www.onescreensolutions.com/en/blog/english-to-spanish-translation-app/)). |
| **Google Meet / Teams translated captions** | Translated captions inside video calls | Meet's are "currently only available for" paid Workspace editions (Business Standard and up, Google AI Pro for Education) ([Google Meet Help](https://support.google.com/meet/answer/10964115)), and the eligibility list has changed several times. I didn't check Teams' current licensing. Everyone has to join a video call, which is awkward when people are in the same room. |
| **Group Transcribe** (Microsoft Garage) | In-person transcription and translation | iOS-only experiment, with every participant needing an iOS device ([Microsoft Translator blog, 2022](https://www.microsoft.com/en-us/translator/blog/2022/03/17/microsoft-translator-and-group-transcribe-apps-can-help-bridge-the-communication-gap-for-refugees/)). I couldn't confirm whether it's still available. |
| **Open source** | — | Searching GitHub turned up only small hobby projects with almost no stars. I found no maintained, self-hostable replacement. |

The underlying technology is now cheap and good: speech recognition, machine translation and LLM translation all
run in real time through ordinary APIs. What's missing is the free, no-install, many-to-many room that Microsoft
used to provide.

## What a great solution would need

What I think, based on the above:

- **Join in seconds, no install, no account.** The host opens a web page and gets a QR code and a short code. Guests
  scan it, pick their language from a list written in each language's own script, and they're in. This has to
  work on cheap Android phones, older iPhones, school Chromebooks and a projector.
- **Many languages, many people, both directions.** Each person speaks or types in their own language and reads
  everyone else in theirs. That is the core thing the free alternatives can't do. It should comfortably handle a
  parent conference (3–5 people) and a newcomer classroom or orientation (30+ people, 10 languages).
- **Captions-only and presentation modes.** A large-text captions view for deaf and hard-of-hearing users. A
  "one speaker, many listeners" mode for assemblies, sermons and community meetings, where each phone shows (and
  optionally reads aloud) the speaker in its own language. A projector view for the room.
- **Trust and repair.** Show the original text next to the translation, let the speaker fix a misheard sentence,
  give a quick "please repeat" button, and let the host add names and terms (the child's name, "IEP", the
  school's name) so they're recognised and translated consistently.
- **Privacy by default.** Rooms are temporary, nothing is stored unless the host explicitly exports a transcript,
  and the page says so plainly. Conversations about children, health and immigration are sensitive, and schools
  will ask.
- **Language coverage honesty.** Show which languages support speech and which are text-only, and check coverage
  for languages common among newcomers (Dari, Pashto, Tigrinya, Haitian Creole, Indigenous languages of Latin
  America). Where speech isn't supported, typing should still work.
- **Ready-made invitations.** Short "how to join" notes in many languages that a teacher can print or text to
  families before the meeting, as Microsoft used to offer.
- **Hard parts:** low latency over weak Wi-Fi, noisy rooms and crosstalk, deciding whose turn it is, speech
  recognition across accents, and running costs. Speech and translation APIs cost money per minute, so the human
  will need to set up API keys and a budget, plus rate limits so a free public service can't be abused. A
  self-hostable version (a school district running its own copy) would solve both cost and privacy for
  institutions.

## Sources

- Microsoft Translator, App Store listing and version history (26.7.1, Jun 30): https://apps.apple.com/us/app/microsoft-translator/id1018949559
- Microsoft Learn, Azure Speech SDK release notes (Speech SDK 1.51, 2026-July): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/releasenotes
- Microsoft Learn, "What is Microsoft Translator Pro?" (retirement notice, Sep 15, 2026): https://learn.microsoft.com/en-us/azure/ai-services/translator/solutions/translator-pro/overview
- Microsoft Q&A, "Microsoft Translator Conversation feature stopped working" (Oct 2025): https://learn.microsoft.com/en-us/answers/questions/5580071/microsoft-translator-conversation-feature-stopped
- Microsoft Translator for Education, parent-teacher conferences: https://www.microsoft.com/en-us/translator/education/parent-teacher-conferences/
- Microsoft Translator for Education, live conversations: https://www.microsoft.com/en-us/translator/education/live-conversations/
- Microsoft Translator blog, "Microsoft Translator and Group Transcribe apps can help bridge the communication gap" (Mar 17, 2022): https://www.microsoft.com/en-us/translator/blog/2022/03/17/microsoft-translator-and-group-transcribe-apps-can-help-bridge-the-communication-gap-for-refugees/
- Poudre School District Tech Portal, using Microsoft Translator for multilingual parent-teacher conferences: https://techportal.psdschools.org/node/2524
- WhistleOut, "Microsoft Translator Without Its Best Feature" (updated Mar 4, 2026): https://www.whistleout.com/CellPhones/Guides/is-microsoft-translator-worth-downloading
- OneScreen, "6 Best English to Spanish Translation Apps for Schools" (Aug 28, 2026): https://www.onescreensolutions.com/en/blog/english-to-spanish-translation-app/
- Tech Times, Google Assistant September 4 shutdown (Aug 5, 2026): https://www.techtimes.com/articles/323242/20260805/google-assistant-september-4-shutdown-leaves-pixel-9-galaxy-s25-slower-gemini-permanently.htm
- IBTimes Singapore, "Google Assistant Is Ending Now" (Aug 10, 2026): https://www.ibtimes.sg/A000Nth
- NCES, English Learners in Public Schools: https://nces.ed.gov/programs/coe/indicator/cgf/english-learners
- US Census Bureau, language spoken at home, 2018–2022 ACS (Dec 7, 2023): https://www.census.gov/newsroom/press-releases/2023/language-at-home-acs-5-year.html
- Google blog, live translation in Google Translate (Aug 2025): https://blog.google/products/translate/language-learning-live-translate/
- Apple Newsroom, Live Translation on AirPods expands to the EU (Nov 2025): https://www.apple.com/ie/newsroom/2025/11/live-translation-on-airpods-expands-to-the-eu/
- 9to5Mac, Live Translation AirPods compatibility (Sep 9, 2025): https://9to5mac.com/2025/09/09/live-translation-airpods-compatibility/
- Wordly, "How Much Does Translation Cost?": https://wordly.ai/blog/translator-cost
- Wordly, "5 New Ways to Try & Buy Meeting and Event Translation": https://www.wordly.ai/blog/5-new-ways-to-try-buy-meeting-and-event-translation
- Live Translate Live, "Best Live Translation Tools in 2026" (vendor-written, updated Aug 2026): https://livetranslate.live/blog/best-live-translation-tools-2026
- Google Meet Help, translated captions: https://support.google.com/meet/answer/10964115
