# Making an existing PDF accessible without Acrobat expertise or a $5-a-page vendor

> Schools, colleges and local governments must make their PDFs usable with screen readers, but auto-tagging gets the structure wrong, fixing it by hand in Acrobat is slow expert work, and vendors charge per page, so huge backlogs stay inaccessible.

**Found:** 2026-10-09 · **Pain** 4/5 · **Reach** 5/5 · **Buildable** 3/5 · **Wow potential** 4/5

## The problem

A blind person reading a PDF with a screen reader relies on hidden **tags** inside the file. Tags
say "this is a heading", "this is a table with these header cells", "read this column before that
one" and "this image shows…". Most PDFs have no tags or wrong ones, because they were exported
from Word carelessly, scanned, or made years ago. Adding tags afterwards is called
**remediation**. Today it means one of three things:

1. **Acrobat Pro's Autotag** (US$19.99/month on an annual plan,
   [Adobe pricing](https://www.adobe.com/acrobat/pricing.html)), then fixing its mistakes by hand.
   The hand-fixing is where people get stuck. On Adobe's forum in September 2025
   ([thread](https://community.adobe.com/t5/acrobat-discussions/acrobat-reading-order-is-not-working-correctly/td-p/15518051)),
   a user trying to fix the reading order wrote that "the number of the selection will jump to a
   wrong place in the reading order" and that dragging it "either will do nothing, or it will
   rearrange other elements in the reading order". The next day they added: "The issue described in
   the previous post is universal for every file I am working with".
2. **A remediation vendor**, priced per page (see below).
3. **Giving up on the PDF.** University guidance increasingly tells staff to avoid PDFs entirely.
   A screen-reader user on the WebAIM mailing list
   ([Oct 2024](https://webaim.org/discussion/mail_message?id=50536)) wrote that "remediating PDFs over
   and over is not a solution" and said a former client had moved to converting old PDFs into
   accessible web pages instead.

This has become urgent because of a legal deadline. In April 2024 the US Department of Justice
required state and local governments, which includes public schools, community colleges, public
universities, cities and counties, to make web content meet **WCAG 2.1 AA**. That includes
PDFs, Word files and slides. An exception covers older documents that were posted before the deadline,
but it does **not** apply to documents "currently being used to apply for, access, or participate in"
a government service ([ada.gov fact sheet](https://www.ada.gov/resources/2024-03-08-web-rule/)),
and it doesn't cover anything new.

In April 2026 the DOJ pushed the deadlines back a year: to **April 26, 2027** for entities serving
50,000+ people and **April 26, 2028** for smaller ones
([Federal Register, 2026-07663](https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web);
I read the [official PDF](https://public-inspection.federalregister.gov/2026-07663.pdf)). The
government's own reasoning is the clearest statement of the problem I found:

> "Advanced technology, such as generative AI, does not yet reliably automate the remediation of
> inaccessible content at scale, and staff resources and availability continue to pose significant
> challenges. […] The less public entities can rely on technology to make their web content and
> mobile apps accessible, the more they will need to rely on manual work instead."

The same document records a Congressman's warning that "current technology, including generative AI
(artificial intelligence), cannot reliably automate the remediation of STEM materials at scale, and
human oversight is required". The extension is being challenged in court: the National Federation
of the Blind sued in Maryland federal court on May 21, 2026, and the case was described as "active
and ongoing" in June 2026 ([Deque](https://www.deque.com/blog/nfb-sues-doj-and-hhs-over-deadline-extensions-ada-title-ii-and-section-504/)).
So the deadline could still move earlier, and the work hasn't gone away.

## How big is it

- **Who's covered:** every US state and local government body, including school districts and public
  colleges. The DOJ estimates the rule's **first-year implementation cost at $16,949 million** across
  covered entities (IFR PDF above, regulatory analysis section). That figure covers all web content,
  not only PDFs.
- **Staffing is thin.** Inside Higher Ed
  ([Nov 2025](https://www.insidehighered.com/opinion/columns/editors-note/2025/11/06/colleges-are-running-out-time-digital-accessibility))
  cites an Educause poll in which "40 percent of institutions have just one or two staff members on
  campus dedicated to technology accessibility", and says that under the rule "every PDF file must be
  accessible".
- **Collections are huge.** The Ohio State University Libraries alone have "hundreds of thousands
  of PDF documents, many of which did not meet" WCAG 2.1 AA, which is why ASU built an open-source
  pipeline for them (see below; the quote is from the
  [ASU project's description](https://smartchallenges.asu.edu/challenges/pdf-accessibility-ohio-state-university)
  as reported in search results. I couldn't load that page myself).
- **Outside the US**, the EU's European Accessibility Act has applied since June 2025, and Korea and
  others have similar rules. I didn't research how far those reach into PDFs, so I'm not scoring on them.
- **Price of doing it by hand:** a comparison updated July 30, 2026 lists Allyant at "$5–$8 per
  page for standard PDFs" and Softek at "$5–$30 per page"
  ([Venngage](https://venngage.com/blog/pdf-accessibility-cost/), itself a vendor with an interest).
  Accessible.org publishes $4.00–$11.50 per page
  ([pricing](https://accessible.org/services/pdf-remediation/)). At those rates a 40-page council agenda
  packet costs roughly $160–$460 every time it's published (my arithmetic). These are vendor numbers I didn't independently check.

## What exists today

| Option | What it does | Why it falls short |
|---|---|---|
| **Adobe Acrobat Pro** (US$19.99/mo annual) | Autotag + Tags/Order/Content panels + checker | Autotag's structure is often wrong, and the manual tools are the forum's most-complained-about part (thread above). Needs real expertise in PDF tag trees. |
| **PAC** ([pac.pdf-accessibility.org](https://pac.pdf-accessibility.org/en)) | Free, widely used PDF/UA + WCAG **checker** | It only checks. It tells you what's wrong but fixes nothing. |
| **veraPDF** ([GitHub](https://github.com/veraPDF/veraPDF-library), ~345★, GPL-3.0) | Reference open-source PDF/UA validator | A validator library, not an editor. |
| **opendataloader-pdf** ([GitHub](https://github.com/opendataloader-project/opendataloader-pdf), ~29.5k★, Apache-2.0, by Hancom) | Layout analysis, reading order, and **free auto-tagging** of untagged PDFs into Tagged PDFs, made with the veraPDF developers | Per its README, "PDF/UA-1, PDF/UA-2 export" and the "Accessibility studio (visual editor) — review and fix tags" are **Enterprise** ("available on request"). It's a CLI/library with no way for a non-expert to check or correct the result. |
| **ASU / AWS PDF_Accessibility** ([GitHub](https://github.com/ASUCICREPO/PDF_Accessibility), ~134★, MIT) | Batch pipeline: tagging, metadata cleanup, AI alt text; also PDF→HTML | Needs an AWS account and, for PDF→PDF, "an enterprise-level contract or a trial account" for **Adobe's** PDF Services API (README). It's infrastructure for a central IT team, with no human review step. |
| Commercial tools (CommonLook, axesPDF, PDFix, Equidox, Allyant, etc.) | Desktop or enterprise remediation software and services | Mostly enterprise sales. I didn't verify each product's price. |
| Re-export from Word with accessibility settings | Good tags if the source file exists and was authored with real headings | Often there is no source file (scans, third-party PDFs, old documents). |

**What I think (not a finding):** auto-tagging is now free and fairly good (opendataloader-pdf), and
validation is free (veraPDF, PAC). The missing piece is the step **between** them: a human looking
at an auto-tagged page, seeing at a glance what the screen reader will get, and fixing the 10% that
is wrong in seconds without understanding tag trees. That step is exactly what the DOJ says
technology can't yet remove, and it's the paid tier everywhere. A free, private, in-browser
"review and fix" tool for the clerk, teacher or librarian who has to publish the PDF would fill a real gap.

## What a great solution would need

- **Private by default.** Many of these documents are internal drafts or contain personal data.
  Processing in the browser (or on a server the institution runs) is a selling point.
- **A visual review mode that matches what a screen reader gets:** numbered reading-order
  overlays on the page, heading levels as outlines, table header cells highlighted, images with their
  alt text shown next to them, and a "listen" mode that reads the tagged order aloud.
- **One-click fixes** for the common failures: drag to reorder, mark as heading level N, mark as
  decorative/artifact (headers, footers, page numbers), set table headers, merge or split
  paragraphs, fix lists, set document title and language. Use AI to *propose* alt text and table
  structure, with confidence shown, and let the human accept or edit.
- **Write a real tagged PDF** that passes veraPDF/PAC. This is the hardest part: building a correct
  structure tree and mapping marked content in the page content streams. Reusing opendataloader-pdf's
  Apache-2.0 tagging (it's Java with Python/Node wrappers) or another existing library is probably
  wiser than writing it from scratch. Builders should check what that library outputs before
  deciding where it runs.
- **Alternative output:** accessible HTML as an equivalent version, which many universities already
  accept and which is far easier to get right.
- **Honest reporting:** say "checked against PDF/UA rules X, Y, Z; still needs a human to confirm
  alt text meaning" rather than "compliant". Automated checks can't verify that alt text is accurate
  or that the reading order makes sense.
- **Hard parts:** scanned PDFs (needs OCR first), complex multi-column layouts, tables with merged
  cells, forms, math/STEM content (explicitly called out in the DOJ document), and very large files.
  Starting with born-digital text documents (agendas, syllabi, flyers, reports) covers most volume.

## Sources

- DOJ interim final rule, "Extension of Compliance Dates…" (Apr 20, 2026), Federal Register 2026-07663: https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web (full text read from https://public-inspection.federalregister.gov/2026-07663.pdf)
- ADA.gov, Fact sheet on the 2024 web rule (exceptions): https://www.ada.gov/resources/2024-03-08-web-rule/
- Deque, "NFB sues DOJ and HHS over deadline extensions" (Jun 2, 2026): https://www.deque.com/blog/nfb-sues-doj-and-hhs-over-deadline-extensions-ada-title-ii-and-section-504/
- Inside Higher Ed, "Colleges Are Running Out of Time on Digital Accessibility" (Nov 6, 2025): https://www.insidehighered.com/opinion/columns/editors-note/2025/11/06/colleges-are-running-out-time-digital-accessibility
- Adobe Community, "Acrobat reading order is not working correctly" (Sep 2025): https://community.adobe.com/t5/acrobat-discussions/acrobat-reading-order-is-not-working-correctly/td-p/15518051
- WebAIM mailing list (Oct 31, 2024): https://webaim.org/discussion/mail_message?id=50536
- Adobe Acrobat pricing: https://www.adobe.com/acrobat/pricing.html
- PAC PDF Accessibility Checker: https://pac.pdf-accessibility.org/en
- veraPDF: https://github.com/veraPDF/veraPDF-library
- opendataloader-pdf: https://github.com/opendataloader-project/opendataloader-pdf
- ASU AI CIC PDF_Accessibility: https://github.com/ASUCICREPO/PDF_Accessibility
- ASU challenge page, Ohio State PDF accessibility (via search results only): https://smartchallenges.asu.edu/challenges/pdf-accessibility-ohio-state-university
- Venngage, "PDF accessibility cost" (vendor blog, 2026): https://venngage.com/blog/pdf-accessibility-cost/
- Accessible.org, PDF remediation pricing: https://accessible.org/services/pdf-remediation/
