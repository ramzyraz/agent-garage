# Microsoft Publisher is gone: rescue a lifetime of .pub files, privately and still editable

> Microsoft removed Publisher from Microsoft 365 on October 1, 2026, leaving churches, clubs, small businesses and older home users with hundreds or thousands of .pub newsletters, bulletins and cookbooks. The official fix is to re-save each file as PDF one at a time in the very app that is going away, and the tools that open .pub without Publisher are paid, cloud-based, lossy or lock you into a new format.

**Found:** 2026-10-12 · **Pain** 5/5 · **Reach** 4/5 · **Buildable** 3/5 · **Wow potential** 4/5

## The problem

**What happened.** Microsoft's support page says: "In October 2026, Microsoft Publisher will reach its end of life." Microsoft 365
subscribers "will no longer be able to open or edit Publisher files in Publisher", with removal "on or shortly after October 1, 2026,
as the removal update process rolls out". Support for the perpetual version ends on October 13, 2026. Perpetual copies keep running
but get no more fixes. Microsoft's advice is to "Convert your existing files to another format before 10/1/2026"
([Microsoft Support](https://support.microsoft.com/en-us/publisher)). An MVP adds that "there is no version of Office 2024 which
includes Publisher", and that Microsoft no longer sells Office Professional 2021
([Microsoft Q&A, Apr 2026](https://learn.microsoft.com/en-us/answers/questions/5855781/how-can-i-continue-to-use-microsoft-publisher-afte)).
So anyone who doesn't already own Publisher has no official way to open a .pub file at all.

**People have huge archives.** All of these are from Microsoft's own forums:
- "I have hundreds of files in Published and the only help I can find is to convert them all to .pdf format. Then what?" (Elizabeth Benn, Oct 31, 2025)
  and "I literally have thousands of Publisher templates!" (Gina Lyell, Jan 7, 2026)
  ([Microsoft Q&A, "What replaces Publisher"](https://learn.microsoft.com/en-us/answers/questions/5604759/what-replaces-publisher))
- "across my four disk partitions I have 4,197 .pub files." "Converting them all will be an enormous task — truly unreasonable,
  especially at my age." (Gionnidal, Feb 5, 2026)
  ([Microsoft Tech Community](https://techcommunity.microsoft.com/discussions/microsoft-365/publisher/4350740))
- "We use Publisher mostly for newsletters and we have literally hundreds, if not thousands of Publisher files." (Elijah L, Apr 16, 2026)
  ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5855781/how-can-i-continue-to-use-microsoft-publisher-afte))
- "I have over 250k Publisher files that I have been working on changing over to Corel Draw" (Jeffro33, Aug 10, 2026). Another user
  describes mass-converting 4,500+ files to PowerPoint: "The PPT files aren't perfect but at least I have access to my info for now."
  (laner, Sep 30, 2026) ([Tech Community, "Publisher replacement ideas", 47 replies](https://techcommunity.microsoft.com/discussions/microsoft-365/publisher-replacement-ideas/4391141))

**These are living documents.** People don't just want to look at them, they want to keep editing:
- "I have made several cook books for my family, children and grandchildren.. I add to those books every year" (Grammy in Texas, Oct 10, 2026)
- "I am 85 years old. I use publisher to maintain address lists for over 170 other old people." (Joan Styve, Sep 13, 2026)
- "Many small organisations like churches use Publisher to produce newsletters and flyers and there are millions of such archived
  documents that will no longer be accesible." (Steve Mellor, Sep 10, 2026)

(All three from [Microsoft Q&A, "Why is Publisher being discontinued"](https://learn.microsoft.com/en-us/answers/questions/5872698/why-is-publisher-being-discontinued).
"Millions" is that user's guess, not a measured figure.) Church bodies have published their own migration guidance. The Church of England
calls Publisher "a trusted tool for creating service sheets, newsletters, parish magazines and much more"
([Church of England Digital Labs, Aug 28, 2026](https://www.churchofengland.org/resources/digital-labs/blogs/microsoft-publisher-retiring-heres-what-churches-need-know)).
The Methodist Church says the question has come up "in several conversations with circuit administrators and operations officers"
([Methodist Church, Apr 13, 2026](https://www.methodist.org.uk/for-churches/digital-church/digital-training-blog/microsoft-publisher-is-being-retired-here-is-what-we-suggest-instead/)).

**Microsoft's own route loses the layout.** The official way to get an editable file is .pub → PDF → open the PDF in Word. Microsoft
warns that layout may shift, especially in documents with many graphics ([Microsoft Support](https://support.microsoft.com/en-us/publisher)).
Users are blunt about it: "You cannot convert Publisher files to Word files. They will not convert. This is absolute nonsense!!"
(Rheteeter, Sep 10, 2026, 30+ votes, [Q&A](https://learn.microsoft.com/en-us/answers/questions/5872698/why-is-publisher-being-discontinued)).
"Word is NOT the same for formatting newsletters. The whole advantage of Publisher is that you can tell it where you want something
and it will stay there... Pictures and text boxes move all over the place" (Elijah L,
[Q&A](https://learn.microsoft.com/en-us/answers/questions/5855781/how-can-i-continue-to-use-microsoft-publisher-afte)).
On bulk conversion, a volunteer MVP says: "As far as I know, the only way to convert Publisher file is resaving them one by one."
(Stefan Blom, Feb 14, 2026, [Q&A](https://learn.microsoft.com/en-us/answers/questions/5604759/what-replaces-publisher)).

**The workarounds are fragile.** The most-upvoted answer in one thread (50+ found it helpful) describes having a computer shop
uninstall Microsoft 365 and install Office 2021 Professional Plus just to keep opening old files
([Q&A](https://learn.microsoft.com/en-us/answers/questions/5872698/why-is-publisher-being-discontinued)). Others dig out old install
discs. Those copies are now out of support and won't be reinstallable forever.

## How big is it

- **Who:** Publisher was bundled with Microsoft 365 Personal, Family and Business plans for years. Its users skew towards churches,
  schools, clubs, charities, small businesses and older home users, the people least likely to have a designer or IT department.
  I couldn't find a reliable count of Publisher users or .pub files. The individual archives above range from hundreds to 250,000 files.
- **How urgent:** Microsoft 365 users lost Publisher 11 days ago, and perpetual support ends tomorrow (October 13, 2026). Everyone who
  missed the deadline, or only now finds an old .pub on a shared drive, has no first-party way to open it. That will keep happening
  for years as people find old files.
- **Press attention:** Computerworld ([Sep 21, 2026](https://www.computerworld.com/?p=4224008)) notes that "most other desktop
  publishing software can't open PUB files" and that Microsoft's batch script "only works if you have a working, licensed version of
  Publisher on your PC."
- **Market signal:** At least six commercial products launched or repositioned around this deadline (below). That proves demand. It
  also shows the free, private option is missing.

## What exists today

| Option | What it does | Why it falls short |
|---|---|---|
| **Re-save in Publisher** (Microsoft's advice, plus its `Convert-PubFileToPDF.ps1` sample script) | PDF per file, batch possible with PowerShell | Needs a working, licensed Publisher. Output is PDF only, so nothing stays editable. ([Microsoft](https://support.microsoft.com/en-us/publisher), [Computerworld](https://www.computerworld.com/?p=4224008)) |
| **PubFile Rescue** ([pubfilerescue.com](https://pubfilerescue.com/)) | Free Windows script that bulk-exports a folder to PDF | Drives your own copy of Publisher, so it's useless once Publisher is gone. Its paid "rebuild in Canva" service is $179 per publication. |
| **PublisherRescue** ([pricing](https://publisherrescue.com/en/pricing)) | Online conversion to PDF, plus editable PPTX on higher tiers | €19 / 50 files, €49 / 250, €129 / 1,000. Files are stored on its servers ("Files deleted after 7 days" on Starter). Output is PDF/PPTX, not a layout format. |
| **ConvertAPI** ([blog, Aug 18, 2026](https://www.convertapi.com/blog/microsoft-publisher-end-of-life)) | Cloud API: PUB → PDF/JPG/PNG/TIFF | A developer API, not a tool for a church secretary. Output is not editable. Files go to the cloud. |
| **PublishMedia** ([site](https://publishmediasoftware.com/microsoft-publisher-replacement)) | Browser importer into its own editor | First file free, then paid. The page itself says "No import tool can guarantee a flawless result for every Publisher file." |
| **PubKeep** ([AlternativeTo listing](https://alternativeto.net/software/pubkeep/about/)) | Windows/Mac Publisher clone that opens and edits .pub | $99+ one-time. Saves to its own `.pubk` format, so users swap one proprietary format for another. |
| **PUB Editor & Converter** (Mac, [waerfa](https://waerfa.com/pub-editor-converter-for-ms-publisher)) | View/edit, export PDF | Paid, Mac only, PDF output. |
| **CorelDRAW** ([docs](https://product.corel.com/help/CorelDRAW/540215253/EN/Doc/Microsoft_Publisher_PUB.html)) | Imports .pub | Paid. Only "versions 2002, 2003, and 2007". Long list of unsupported features (styles, border art, headers/footers, some table borders). |
| **LibreOffice Draw / Scribus** (via the open-source **libmspub** library) | Free import of .pub | Desktop install. Computerworld says Draw's handling of complex layouts "can be flaky". Converts one file at a time through a general-purpose drawing app, which isn't a workflow for non-technical users. |
| **Affinity** (now free from Canva), **Canva** | Common recommended replacements for *new* work | Neither documents native .pub import, as far as I could find. The Methodist Church guide says Affinity Publisher 2 "can open most Publisher files", but I couldn't confirm this anywhere else. Computerworld says most DTP software can't. Canva's own route is via PDF or PPTX. |

**The open-source core is alive.** [libmspub](https://git.libreoffice.org/libmspub) (MPL 2.0) is what LibreOffice uses to read .pub.
It handles Publisher 97, 2000/2002 and later formats, and ships converters, including `pub2svg`, that turn each page into SVG. Its most
recent commits (Sept–Oct 2026) are fixes for crashes and bugs found by fuzzing, including Publisher 97 text handling. I checked the
repository directly. It is a C++ library depending on librevenge, boost, ICU and zlib, so compiling it to WebAssembly is real work, but
not research. ZetaOffice has shown that the whole of LibreOffice can run in a browser, though at around a gigabyte of code
([The Register, Feb 2025](https://www.theregister.com/2025/02/13/libreoffice_wasm_zetaoffice/)). A focused libmspub build would be far
smaller.

**My read (opinion):** what's missing is a free, private, bulk, friendly tool that turns a whole folder of .pub files into a faithful
archive *and* into editable files in open formats that free tools (Affinity, Scribus, LibreOffice, Inkscape, Word/PowerPoint) can
open. Every existing option misses at least one of these: free, private, bulk, editable, open format, or easy for a non-technical person.

## What a great solution would need

- **Runs locally, no upload.** These archives include member address lists, parish records and family documents. Parsing in the
  browser (libmspub compiled to WebAssembly, or a new JS/TS parser) means files never leave the computer, and it can be a static site
  with no hosting costs.
- **A whole folder, not one file.** Drag in a folder or a zip with thousands of .pub files and subfolders. Show progress, skip and
  report broken files, and keep the folder structure in the output.
- **See before you convert.** A thumbnail gallery of every publication, with search over the text inside them ("find the 2014
  Christmas bulletin"). This is the "wow" moment for someone with 4,000 files they haven't been able to browse.
- **Faithful archive output.** PDF per publication, with real text (searchable, selectable) and embedded images, and fonts substituted
  sensibly when the originals aren't installed.
- **Editable output that keeps the layout.** At least one open, positioned format. Candidates: SVG per page, ODG (LibreOffice Draw),
  Scribus SLA, IDML (Affinity and InDesign import it), or PPTX (absolutely positioned boxes, opens in PowerPoint, Keynote, Google
  Slides and Canva). The builders should pick based on what free tools import best. Text must stay real, editable text. Images should
  also be extractable on their own (people often just want their photos back).
- **Honest fidelity reporting.** Flag what didn't convert cleanly (WordArt, border art, linked text boxes across pages, tables, mail
  merge fields, Publisher 97/98 files) per file, so people know which documents to check.
- **Optional: keep editing in the browser.** A simple positioned-box editor that opens the converted pages, so Grandma can add this
  year's recipes to her cookbook without learning a new DTP app. That would make it a real Publisher replacement, not just a converter.
- **Plain-language, senior-friendly design.** Many of the people with this problem are not technical. Big targets, no jargon, one
  obvious path: "Choose your folder → see your publications → download".

**Hard parts:** .pub is an undocumented binary format, so fidelity is capped by what libmspub understands. Beating LibreOffice's import
means fixing or extending the parser. Building libmspub's dependencies for WebAssembly (ICU in particular) and keeping the bundle small.
Handling thousands of files without running out of browser memory (stream them; File System Access API where available). Font
substitution. Testing needs a corpus of real .pub files across Publisher versions. libmspub's fuzzing corpus and public sample files are
a start. The builders should **not** count on Microsoft documenting the format.

## Sources

- Microsoft Support, "Microsoft Publisher will no longer be supported after October 2026": https://support.microsoft.com/en-us/publisher
- Microsoft Q&A, "What replaces Publisher": https://learn.microsoft.com/en-us/answers/questions/5604759/what-replaces-publisher
- Microsoft Q&A, "Why is Publisher being discontinued": https://learn.microsoft.com/en-us/answers/questions/5872698/why-is-publisher-being-discontinued
- Microsoft Q&A, "How can I continue to use Microsoft Publisher after…": https://learn.microsoft.com/en-us/answers/questions/5855781/how-can-i-continue-to-use-microsoft-publisher-afte
- Microsoft Tech Community, "Publisher": https://techcommunity.microsoft.com/discussions/microsoft-365/publisher/4350740
- Microsoft Tech Community, "Publisher replacement ideas": https://techcommunity.microsoft.com/discussions/microsoft-365/publisher-replacement-ideas/4391141
- Church of England Digital Labs (Aug 28, 2026): https://www.churchofengland.org/resources/digital-labs/blogs/microsoft-publisher-retiring-heres-what-churches-need-know
- The Methodist Church (Apr 13, 2026): https://www.methodist.org.uk/for-churches/digital-church/digital-training-blog/microsoft-publisher-is-being-retired-here-is-what-we-suggest-instead/
- Computerworld, Preston Gralla (Sep 21, 2026): https://www.computerworld.com/?p=4224008
- PubFile Rescue: https://pubfilerescue.com/
- PublisherRescue pricing: https://publisherrescue.com/en/pricing
- ConvertAPI (Aug 18, 2026): https://www.convertapi.com/blog/microsoft-publisher-end-of-life
- PublishMedia: https://publishmediasoftware.com/microsoft-publisher-replacement
- PubKeep on AlternativeTo: https://alternativeto.net/software/pubkeep/about/
- PUB Editor & Converter (Mac): https://waerfa.com/pub-editor-converter-for-ms-publisher
- CorelDRAW help, Microsoft Publisher (PUB): https://product.corel.com/help/CorelDRAW/540215253/EN/Doc/Microsoft_Publisher_PUB.html
- libmspub source (MPL 2.0): https://git.libreoffice.org/libmspub
- The Register on ZetaOffice / LibreOffice in WebAssembly (Feb 13, 2025): https://www.theregister.com/2025/02/13/libreoffice_wasm_zetaoffice/

Not opened (blocked): TheStreet's "Microsoft retires an Office app Oct. 1, leaving files stranded" and Neowin's coverage both returned
403, so I haven't used them.
