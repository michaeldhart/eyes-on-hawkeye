# State of the content

*Moved out of `CLAUDE.md` so the always-loaded file stays short. Read this when ingesting a document or checking what is already on the site. Update the table and counts here after each ingest. Text is unchanged.*

Six documents from https://www.belvidereil.gov/recent-data-center-information/ (released September and October 2026):

| Slug | What it is |
|---|---|
| `letter-of-support` | Mayor's May 22, 2025 letter to Datawatt supporting Project Hawkeye and raising annexation and utilities |
| `expense-reimbursement-agreement` | Developer reimburses the city's review costs from April 1, 2026; dated May 26, 2026 |
| `initial-concept` | Undated as posted, but it is two developer decks joined: pages 1–11 = the Nov 25, 2024 deck (communications pp. 232–242), pages 12–18 = the Nov 7, 2024 deck (pp. 249–255). Type presentation, not an application; kept `undated: true` with a `date_note` explaining this; JLL named as Datawatt's representative |
| `communications-2024-2026` | 313-page email compilation (`compilation: true`); broken into 31 timeline entries in `_entries/` covering Nov 2024 to Jul 2026 |
| `additional-foia-documents` | 67-page second compilation (posted Oct 2026), Sep 4 to Oct 26, 2026; 8 entries. Mostly aldermen and residents, none from or to the developer: the Oct 21 two-alderman agenda request (Brereton, Albertini), residents' emails and fact sheets, a Growth Dimensions committee packet, and an Alderman Peterson exchange. Names stay visible (user decision for private residents too). The OCR text omits personal emails, phone numbers, a home address and an IP address (marked in a site note at the top); the PDF is untouched |
| `datawatt-letter-to-council` | 5 pages, Oct 29, 2026: email from Datawatt CEO David Halligan to the mayor and City Attorney with a letter to the mayor and City Council (power is the "most critical priority", no applications filed, closed-loop cooling, no tax incentives, open public forum) and two 20-year property tax tables. The tables (pp. 4–5) are sideways and too blurry to read, so the OCR text describes them and quotes no figures; the summary points to the PDF (user decision). Halligan's phone number is omitted from the OCR text |

The procedure for adding any new city document lives in the project skill `.claude/skills/add-city-document/SKILL.md` (use it; this file holds the conventions behind it). Decisions made while adding the October 2026 releases: names stay visible even for private residents (the records are public); the OCR text leaves out personal emails, phone numbers, home addresses and IP addresses (marked by a site note on page 1; the PDF is untouched); sideways or blurry tables are described, not transcribed, with figures left to the PDF; no pronouns are used for people whose pronouns the records don't give (Spanish uses neutral phrasing); contested claims are attributed to whoever made them.

How the communications file was processed (reuse for future compilations): the PDF is a stack of repeated printouts of the same email chains, newest first, so the ~337 headers collapse to ~110 unique messages. Dedupe by the "Sent:" timestamp, keep the best OCR copy, then read chronologically and write one entry per conversation (not per message), with the page where the clearest copy of it appears. Verify key figures against the scanned page image (the Read tool renders PDF pages) before quoting them. Upside-down attachment pages need `ocrmypdf --rotate-pages`; the sidecar text is what lives in the document body. Pages that are still gibberish after that (sideways slides) can be re-OCR'd by rendering with `pdftoppm -r 300`, rotating with `sips`, and running `tesseract`; check the result against the page image, and for pages that are mostly a drawing write a short bracketed description instead of keeping junk text. Score page quality by the share of common English words. Quote numbers and wording exactly as written in the emails and flag unclear units or names (e.g. "Bush"/"Busch", "250-500 MGD"). Report what the file shows and what it doesn't (calendar invites often carry no agenda).

Open work, in priority order:
1. Decide where PDFs live long term.
2. Keep adding documents as the city releases them, each with its Spanish version. Spanish reviewers set `es_reviewed: true` as they go (none reviewed yet).
3. Possible features: an RSS feed, a corrections log. When adding documents or entries, also tag people and orgs.
