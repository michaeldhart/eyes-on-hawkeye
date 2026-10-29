---
name: add-city-document
description: Import a newly released city document (PDF) about Project Hawkeye into the Eyes on Hawkeye site, with its Spanish version, timeline entries, people tags and the home page overview update. Use when the user mentions a new document on the city's data center page, a new FOIA release, or asks to check that page for new documents.
---

# Add a City Document

Read `CLAUDE.md` first for voice, conventions and the Spanish style rules. This skill is the procedure; `CLAUDE.md` is the why. Pushing to `main` deploys the live site, so commit and push only when the user says so.

## 1. Find what's new
- Fetch https://www.belvidereil.gov/recent-data-center-information/ and list its `wp-content/uploads` PDF links (ignore unrelated ones, e.g. 2023 files). Compare against `file:` in `_documents/*.md`.
- Download each new PDF into the scratchpad (never into the repo directly). Run `pdfinfo` and `shasum -a 256`; render pages with `pdftoppm -r 80 -png` and look at them (Read renders images).
- If the user gave a plan-first request ("show me a plan"), stop after this step and present what the file is, what you will add, and any decision you need. Otherwise continue.

## 2. Decide the shape
- One short document (a letter, an agreement, a deck): a single `_documents` file, which gets its own timeline dot. No entries.
- A bundle of emails or many unrelated items: `compilation: true`, with one `_entries` file per conversation (not per message).
- Date: the document's own date. For a compilation, the newest message date. Never invent one; if a document has none use `undated: true` with a `date_note`.

## 3. Text (OCR)
- Scans: `ocrmypdf --force-ocr --rotate-pages --sidecar ocr.txt in.pdf out.pdf`. Score pages by common-word share and look at the weak ones.
- Fix OCR errors you can verify on the page image (e.g. `Ce:` for `Cc:`, a misread email address, a signature read as words). Blank pages with only a page number: replace with a bracketed note.
- Sideways or blurry tables and drawings: do not keep garbage text. Replace with a short bracketed description (title, columns, notes paraphrased) and say the figures are in the PDF. Quote no numbers you cannot read reliably.
- Privacy: names stay visible, including private residents (user decision; the records are public). Leave out of the OCR text personal email addresses, phone numbers, home street addresses and IP addresses, replacing each with `[email omitted]`, `[phone omitted]`, `[address omitted]`, `[omitted]`, and put one site note at the top of page 1 saying so. Keep city `.gov` addresses. Never alter the PDF.
- Pass the corrected text to the script with `--text`.

## 4. Ingest
```
python3 scripts/add_document.py <pdf> --title "..." --slug <short-undated-slug> --date YYYY-MM-DD \
  --type correspondence --source "City of Belvidere" \
  --source-url https://www.belvidereil.gov/recent-data-center-information/ \
  [--compilation] --tags a,b --text <corrected.txt> --title-es "..." --summary "..." --summary-es "..."
```
Then edit the front matter: `people:`, `orgs:` slugs, a final summary and Spanish. New tags need a Spanish name in `_data/i18n/tags_es.yml`. Keep the PDF's original filename.

## 5. Entries (compilations only)
- Emails are repeated printouts, newest first. Dedupe by "Sent:" timestamp, keep the clearest copy, and point `pages:` at it.
- One entry per conversation, file `_entries/YYYY-MM-DD-slug.md`, with `document:`, `pages:`, `summary`, `people`, `orgs`, `title_es`, `summary_es`. Date = when the conversation starts.
- Title Case English titles; Spanish in sentence case.

## 6. Writing rules for summaries and entries
- State what the records show and don't show. "The documents don't show..." not "there was no...".
- Attribute every factual or contested claim to who made it (residents' fact sheets, a guide, an official's opinion, the developer's letter). The records don't verify them; say so when it matters. Quote short and exactly.
- Quote times and dates exactly; when two dates exist give both.
- Pronouns: use none for anyone whose pronouns the records don't give (repeat the name). Mayor Morris and Mike Drella use he, as the existing text does. In Spanish avoid gendered articles for them too ("una persona residente", "Erica Bluege (City Clerk)", "la secretaría municipal"); follow `CLAUDE.md` Spanish style otherwise. Never infer gender from a name.
- Spanish: quotes stay English followed by a translation in parentheses; names and email subjects stay as written.

## 7. People
- One `_people/<slug>.md` per new person or organization, tagged on any record that sends, receives or is substantively named. Roles must be traceable: fill `role_source` with the page (e.g. "Email signature (additional documents p. 2)"), and say "role not stated in the records" when it isn't. Include `role_es` and `role_source_es`. No emails or phone numbers.

## 8. Home page overview
- Reread "What the Records Show So Far" in `index.md` and `es/index.md`. Add a short, linked paragraph when the story changed, and fix any sentence the new records make false (especially "the most recent item" and "the records don't show" claims; re-verify each absence claim against all documents).
- The user approved the existing wording line by line: keep edits minimal and list every change for the user to approve.
- Set `overview_through` (newest record covered) and `overview_reviewed` (today) in `_config.yml`.

## 9. Verify and wrap up
- `python3 scripts/check_people.py`, `python3 scripts/check_i18n.py`, `bundle exec jekyll build` (no warnings).
- Preview with the `jekyll` launch config: check the document page (and `/es/`), a timeline entry, and the home page; no console errors.
- Update the content table and counts in `CLAUDE.md` ("State of the content").
- Report what was added, the judgment calls (omissions, descriptions in place of unreadable text, overview edits), and ask before committing and pushing. Commit messages end with the attribution line from the session.
